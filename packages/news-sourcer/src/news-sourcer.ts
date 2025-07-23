import { AiProviderManager, LlmClient } from '@babel-feed/llm-provider'
import { getDatabase, getTestDb, sourceEndpoints, type DatabaseInstance, type NewSourceEndpoint, type SourceEndpoint } from '@babel-feed/pgdb'
import { logger } from '@babel-feed/utils'
import axios from 'axios'
import { load } from 'cheerio'
import { and, asc, desc, eq, gte } from 'drizzle-orm'
import { XMLParser } from 'fast-xml-parser'
import { AdaptiveAnalyzer, type ReanalysisResult } from './adaptive-analyzer.js'
import { CircuitBreakerRegistry, type CircuitBreakerMetrics } from './circuit-breaker.js'
import { HealthMonitor, type HealthCheckResult } from './health-monitor.js'
import { MetricsCollector, type CollectedMetrics } from './metrics-collector.js'
import { RateLimiterRegistry, type RateLimiterMetrics } from './rate-limiter.js'
import type {
  BulkEndpointOperation,
  DiscoveredEndpoint,
  EndpointCreateRequest,
  EndpointMetrics,
  EndpointQuery,
  EndpointUpdateRequest,
  EndpointValidationOptions,
  EndpointValidationResult,
  FeedValidationResult,
  HtmlCrawlingConfig,
  LlmAnalysisResult,
  NewsSourceAnalysis,
  NewsSourcerConfig,
  RssDiscoveryResult,
  SourceAnalysisResult,
  StoredEndpoint,
  ValidationResult
} from './types.js'

export class NewsSourcer {
  private config: NewsSourcerConfig
  private db!: DatabaseInstance
  private aiManager!: AiProviderManager
  private llmClient!: LlmClient
  private htmlCrawlingConfig: HtmlCrawlingConfig
  private circuitBreakers: CircuitBreakerRegistry
  private rateLimiters: RateLimiterRegistry
  private healthMonitor: HealthMonitor
  private metricsCollector: MetricsCollector
  private adaptiveAnalyzer: AdaptiveAnalyzer

  constructor(config: NewsSourcerConfig = {}) {
    this.config = {
      validation: {
        maxRetries: 3,
        baseDelay: 1000,
        maxDelay: 30000,
        timeout: 10000,
        validateUrls: true,
        ...config.validation
      },
      userAgent: 'Mozilla/5.0 (compatible; BabelFeed/1.0)',
      parallelRequests: 5,
      circuitBreaker: {
        failureThreshold: 5,
        resetTimeout: 60000,
        timeout: 30000,
        monitoringPeriod: 300000,
        ...config.circuitBreaker
      },
      rateLimit: {
        enabled: true,
        requestsPerSecond: 2,
        burstSize: 5,
        backoffMultiplier: 1.5,
        maxBackoffDelay: 30000,
        ...config.rateLimit
      },
      health: {
        endpointHealthThreshold: 0.8,
        reliabilityThreshold: 0.7,
        circuitBreakerThreshold: 0.2,
        rateLimitRejectionThreshold: 0.1,
        checkInterval: 60000,
        ...config.health
      },
      reanalysis: {
        failureThreshold: 0.3,
        maxConsecutiveFailures: 5,
        cooldownPeriod: 3600000,
        maxReanalysisAttempts: 3,
        stalenessThreshold: 2592000000,
        batchSize: 5,
        scheduleInterval: 1800000,
        ...config.reanalysis
      },
      ...config
    }
    
    this.htmlCrawlingConfig = {
      maxIterations: 5,
      minConfidence: 0.6,
      minSuccessRate: 0.7,
      minSampleUrls: 5,
      timeout: 30000
    }

    this.circuitBreakers = new CircuitBreakerRegistry()
    this.rateLimiters = new RateLimiterRegistry()
    this.healthMonitor = new HealthMonitor(this.config.health)
    this.metricsCollector = new MetricsCollector()
    this.adaptiveAnalyzer = new AdaptiveAnalyzer(this.config.reanalysis)
  }

  async initialize(): Promise<void> {
    // Use test database if available in test mode, otherwise use regular database
    try {
      if (process.env.NODE_ENV === 'test') {
        this.db = getTestDb()
      } else {
        this.db = await getDatabase()
      }
    } catch (error) {
      // Fallback to regular database if test database is not available
      this.db = await getDatabase()
    }
    
    this.aiManager = new AiProviderManager()
    this.llmClient = new LlmClient({
      timeout: 30000,
      retryAttempts: 3,
      retryDelay: 1000
    })
    
    await this.aiManager.initialize()
    await this.llmClient.initialize()
    logger.info('NewsSourcer initialized with database connection, AI provider manager, and LLM client')
  }

  /**
   * Protected HTTP request with circuit breaker and rate limiting
   */
  private async makeProtectedRequest(url: string, options: Record<string, unknown> = {}): Promise<{ data: string }> {
    const domain = new URL(url).hostname
    const circuitBreakerOptions = this.config.circuitBreaker ? {
      failureThreshold: this.config.circuitBreaker.failureThreshold ?? 5,
      resetTimeout: this.config.circuitBreaker.resetTimeout ?? 60000,
      timeout: this.config.circuitBreaker.timeout ?? 30000,
      monitoringPeriod: this.config.circuitBreaker.monitoringPeriod ?? 300000
    } : undefined
    const circuitBreaker = this.circuitBreakers.getCircuitBreaker(domain, circuitBreakerOptions)
    
    // Apply rate limiting if enabled
    if (this.config.rateLimit?.enabled) {
      const rateLimiterOptions = this.config.rateLimit ? {
        requestsPerSecond: this.config.rateLimit.requestsPerSecond ?? 2,
        burstSize: this.config.rateLimit.burstSize ?? 5,
        backoffMultiplier: this.config.rateLimit.backoffMultiplier ?? 1.5,
        maxBackoffDelay: this.config.rateLimit.maxBackoffDelay ?? 30000
      } : undefined
      const rateLimiter = this.rateLimiters.getRateLimiter(domain, rateLimiterOptions)
      await rateLimiter.acquire()
    }

    // Execute request through circuit breaker with metrics
    return await this.metricsCollector.time('http_request', async () => {
      try {
        const result = await circuitBreaker.execute(async () => {
          return await axios.get(url, {
            timeout: this.config.validation?.timeout || 10000,
            headers: { 'User-Agent': this.config.userAgent },
            ...options
          })
        })
        
        this.metricsCollector.incrementCounter('http_requests_total', 1, { domain, status: 'success' })
        this.metricsCollector.recordRate('http_request_rate', { domain })
        
        return result
      } catch (error) {
        this.metricsCollector.incrementCounter('http_requests_total', 1, { domain, status: 'error' })
        this.metricsCollector.incrementCounter('http_request_errors', 1, { domain })
        throw error
      }
    }, { domain })
  }

  /**
   * Get circuit breaker and rate limiter metrics for monitoring
   */
  getMetrics(): { circuitBreakers: Record<string, CircuitBreakerMetrics>; rateLimiters: Record<string, RateLimiterMetrics> } {
    return {
      circuitBreakers: this.circuitBreakers.getAllMetrics(),
      rateLimiters: this.rateLimiters.getAllMetrics()
    }
  }

  /**
   * Get performance metrics
   */
  getPerformanceMetrics(): CollectedMetrics {
    return this.metricsCollector.getMetrics()
  }

  /**
   * Get performance metrics for a specific time window
   */
  getPerformanceMetricsForWindow(windowMs: number): CollectedMetrics {
    return this.metricsCollector.getMetricsForWindow(windowMs)
  }

  /**
   * Export metrics in Prometheus format
   */
  exportPrometheusMetrics(): string {
    return this.metricsCollector.exportPrometheusMetrics()
  }

  /**
   * Log metrics summary
   */
  logMetricsSummary(windowMs?: number): void {
    this.metricsCollector.logMetricsSummary(windowMs)
  }

  /**
   * Reset all performance metrics
   */
  resetMetrics(): void {
    this.metricsCollector.reset()
  }

  /**
   * Reset all circuit breakers and rate limiters
   */
  resetProtection(): void {
    this.circuitBreakers.resetAll()
    this.rateLimiters.resetAll()
  }

  /**
   * Perform a health check on all system components
   */
  async performHealthCheck(): Promise<HealthCheckResult> {
    return await this.healthMonitor.performHealthCheck(
      () => this.queryEndpoints({}),
      () => this.circuitBreakers.getAllMetrics(),
      () => this.rateLimiters.getAllMetrics(),
      () => this.testDatabaseConnection()
    )
  }

  /**
   * Get the last health check result
   */
  getLastHealthCheck(): HealthCheckResult | null {
    return this.healthMonitor.getLastHealthCheck()
  }

  /**
   * Start periodic health checks
   */
  startHealthMonitoring(): void {
    this.healthMonitor.startPeriodicHealthChecks(
      () => this.queryEndpoints({}),
      () => this.circuitBreakers.getAllMetrics(),
      () => this.rateLimiters.getAllMetrics(),
      () => this.testDatabaseConnection()
    )
  }

  /**
   * Stop periodic health checks
   */
  stopHealthMonitoring(): void {
    this.healthMonitor.stopPeriodicHealthChecks()
  }

  /**
   * Test database connection for health monitoring
   */
  private async testDatabaseConnection(): Promise<{ success: boolean; responseTime: number; error?: string }> {
    const startTime = Date.now()
    
    try {
      // Simple database query to test connectivity
      await this.db.select().from(sourceEndpoints).limit(1)
      
      return {
        success: true,
        responseTime: Date.now() - startTime
      }
    } catch (error) {
      return {
        success: false,
        responseTime: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown database error'
      }
    }
  }

  /**
   * Start adaptive re-analysis system
   */
  startAdaptiveReanalysis(): void {
    this.adaptiveAnalyzer.startScheduledReanalysis(
      () => this.queryEndpoints({}),
      (id) => this.getEndpoint(id),
      (url) => this.analyzeHtmlSource(url),
      async (id, updates) => { await this.updateEndpoint({ id, ...updates }) },
      (sourceId, endpoints) => this.bulkCreateEndpoints({ 
        sourceId, 
        endpoints: endpoints.map(ep => ({ ...ep, sourceId }))
      })
    )
  }

  /**
   * Stop adaptive re-analysis system
   */
  stopAdaptiveReanalysis(): void {
    this.adaptiveAnalyzer.stopScheduledReanalysis()
  }

  /**
   * Manually trigger re-analysis for specific endpoint
   */
  async triggerReanalysis(endpointId: string): Promise<ReanalysisResult> {
    this.adaptiveAnalyzer.queueForReanalysis(endpointId)
    
    const results = await this.adaptiveAnalyzer.processReanalysisQueue(
      (id) => this.getEndpoint(id),
      (url) => this.analyzeHtmlSource(url),
      async (id, updates) => { await this.updateEndpoint({ id, ...updates }) },
      (sourceId, endpoints) => this.bulkCreateEndpoints({ 
        sourceId, 
        endpoints: endpoints.map(ep => ({ ...ep, sourceId }))
      })
    )
    
    return results[0] || {
      endpointId,
      success: false,
      newEndpoints: [],
      previousVersion: 'unknown',
      newVersion: 'unknown',
      analysisTime: Date.now(),
      error: 'No results from re-analysis queue'
    }
  }

  /**
   * Get re-analysis statistics
   */
  getReanalysisStats(): {
    queueSize: number
    totalReanalyses: number
    successfulReanalyses: number
    failedReanalyses: number
    endpointsWithHistory: number
    averageReanalysisTime: number
  } {
    return this.adaptiveAnalyzer.getReanalysisStats()
  }

  /**
   * Check if endpoint needs re-analysis
   */
  needsReanalysis(endpoint: StoredEndpoint): boolean {
    return this.adaptiveAnalyzer.shouldReanalyze(endpoint)
  }

  /**
   * Clear re-analysis history
   */
  clearReanalysisHistory(): void {
    this.adaptiveAnalyzer.clearHistory()
  }

  /**
   * Phase 1: RSS/Atom feed discovery and validation
   */
  async analyzeSource(url: string): Promise<NewsSourceAnalysis> {
    logger.info(`Starting RSS/Atom discovery for: ${url}`)
    
    return await this.metricsCollector.time('analyze_source', async () => {
      const analysis: NewsSourceAnalysis = {
        sourceUrl: url,
        rssFeeds: [],
        atomFeeds: [],
        validationResults: new Map(),
        totalEndpoints: 0,
        successRate: 0
      }

      try {
        // Step 1: Discover RSS/Atom feeds
        const discoveredFeeds = await this.discoverFeeds(url)
        this.metricsCollector.setGauge('discovered_feeds', discoveredFeeds.length, { url })
        
        // Step 2: Validate each discovered feed
        const validationPromises = discoveredFeeds.map(feed => 
          this.validateFeed(feed.url).then(result => ({ feed, result }))
        )
        
        const validatedFeeds = await Promise.all(validationPromises)
        
        // Step 3: Process results
        for (const { feed, result } of validatedFeeds) {
          analysis.validationResults.set(feed.url, result)
          
          if (result.valid) {
            if (feed.type === 'rss') {
              analysis.rssFeeds.push(feed)
            } else if (feed.type === 'atom') {
              analysis.atomFeeds.push(feed)
            }
          }
        }
        
        analysis.totalEndpoints = discoveredFeeds.length
        analysis.successRate = discoveredFeeds.length > 0 
          ? (analysis.rssFeeds.length + analysis.atomFeeds.length) / discoveredFeeds.length 
          : 0
        
        // Record metrics
        this.metricsCollector.incrementCounter('source_analysis_total', 1, { status: 'success' })
        this.metricsCollector.setGauge('valid_feeds', analysis.rssFeeds.length + analysis.atomFeeds.length, { url })
        this.metricsCollector.recordHistogram('success_rate', analysis.successRate * 100, { url })
        
        logger.info(`RSS/Atom discovery completed. Found ${analysis.rssFeeds.length} RSS + ${analysis.atomFeeds.length} Atom feeds`)
        
        return analysis
      } catch (error) {
        this.metricsCollector.incrementCounter('source_analysis_total', 1, { status: 'error' })
        this.metricsCollector.incrementCounter('source_analysis_errors', 1, { url })
        logger.error('RSS/Atom discovery failed:', error)
        // Re-throw the error so circuit breaker can properly handle it
        throw error
      }
    }, { url })
  }

  /**
   * Discover RSS/Atom feeds from a website
   */
  private async discoverFeeds(url: string): Promise<RssDiscoveryResult[]> {
    const discovered: RssDiscoveryResult[] = []
    const maxRetries = this.config.validation?.maxRetries || 3
    let lastError: Error | undefined
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        // Fetch the main page
        const response = await this.makeProtectedRequest(url)
        
        const html: string = response.data
        const $ = load(html)
        
        // Method 1: Parse HTML for RSS/Atom link tags
        $('link[rel="alternate"]').each((_, element) => {
          const $link = $(element)
          const type = $link.attr('type')
          const href = $link.attr('href')
          const title = $link.attr('title')
          
          if (href && (type === 'application/rss+xml' || type === 'application/atom+xml')) {
            const feedUrl = new URL(href, url).href
            discovered.push({
              type: type === 'application/rss+xml' ? 'rss' : 'atom',
              url: feedUrl,
              title: title || undefined
            })
          }
        })
        
        // Method 2: Check common RSS/Atom paths
        const commonPaths = ['/rss', '/feed', '/rss.xml', '/atom.xml', '/feeds/all.atom.xml']
        const baseUrl = new URL(url).origin
        
        for (const path of commonPaths) {
          const feedUrl = `${baseUrl}${path}`
          try {
            const feedResponse = await axios.head(feedUrl, { timeout: 5000 })
            if (feedResponse.status === 200) {
              const contentType = feedResponse.headers['content-type'] || ''
              if (contentType.includes('xml') || contentType.includes('rss') || contentType.includes('atom')) {
                discovered.push({
                  type: contentType.includes('atom') ? 'atom' : 'rss',
                  url: feedUrl
                })
              }
            }
          } catch {
            // Ignore errors for common path checking
          }
        }
        
        // Remove duplicates
        const seen = new Set<string>()
        return discovered.filter(feed => {
          if (seen.has(feed.url)) return false
          seen.add(feed.url)
          return true
        })
        
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error')
        
        if (attempt < maxRetries) {
          // Wait before retry with exponential backoff
          let delay = Math.min(
            (this.config.validation?.baseDelay || 1000) * Math.pow(2, attempt),
            this.config.validation?.maxDelay || 30000
          )
          if (process.env.NODE_ENV === 'test') {
            delay = 10
          }
          await new Promise(resolve => setTimeout(resolve, delay))
        } else {
          logger.error('Feed discovery failed after all retries:', error)
          throw lastError
        }
      }
    }
    
    // This should never be reached, but TypeScript requires it
    throw lastError || new Error('Feed discovery failed')
  }

  /**
   * Validate an RSS/Atom feed
   */
  private async validateFeed(feedUrl: string): Promise<FeedValidationResult> {
    try {
      const response = await this.makeProtectedRequest(feedUrl)
      
      const xmlContent = response.data
      
      // Parse XML
      const parser = new XMLParser({
        ignoreAttributes: false,
        attributeNamePrefix: '@_'
      })
      const parsed = parser.parse(xmlContent)
      
      // Determine feed type and extract articles
      if (parsed.rss?.channel) {
        // RSS feed
        const items = parsed.rss.channel.item || []
        const sampleUrls = Array.isArray(items) 
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ? items.slice(0, 5).map((item: any) => item.link).filter(Boolean)
          : items.link ? [items.link] : []
        
        return {
          valid: true,
          feedType: 'rss',
          articleCount: Array.isArray(items) ? items.length : (items.link ? 1 : 0),
          sampleUrls
        }
      } else if (parsed.feed?.entry) {
        // Atom feed
        const entries = parsed.feed.entry || []
        const sampleUrls = Array.isArray(entries)
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ? entries.slice(0, 5).map((entry: any) => entry.link?.['@_href'] || entry.link?.href || entry.link).filter(Boolean)
          : entries.link?.['@_href'] ? [entries.link['@_href']] : []
        
        return {
          valid: true,
          feedType: 'atom', 
          articleCount: Array.isArray(entries) ? entries.length : (entries.link ? 1 : 0),
          sampleUrls
        }
      } else {
        return {
          valid: false,
          feedType: 'unknown',
          error: 'Invalid feed format'
        }
      }
      
    } catch (error) {
      return {
        valid: false,
        feedType: 'unknown',
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * Phase 2: Enhanced endpoint validation with retry logic
   */
  async validateEndpoint(endpointUrl: string, options: EndpointValidationOptions = {}): Promise<EndpointValidationResult> {
    const opts = { ...this.config.validation, ...options }
    const startTime = Date.now()
    let retryCount = 0
    let lastError: string | undefined

    const result: EndpointValidationResult = {
      endpointUrl,
      type: 'rss',
      valid: false,
      reliability: 0,
      retryCount: 0
    }

    while (retryCount <= (opts.maxRetries || 3)) {
      try {
        const response = await this.makeProtectedRequest(endpointUrl, { timeout: opts.timeout || 10000 })
        
        const xmlContent = response.data
        const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' })
        const parsed = parser.parse(xmlContent)
        
        // Determine feed type and extract data
        if (parsed.rss?.channel) {
          const items = parsed.rss.channel.item || []
          const sampleUrls = Array.isArray(items) 
            ? items.slice(0, 5).map((item: { link?: string }) => item.link).filter(Boolean)
            : items.link ? [items.link] : []

          result.type = 'rss'
          result.valid = true
          result.articleCount = Array.isArray(items) ? items.length : (items.link ? 1 : 0)
          result.sampleUrls = sampleUrls
          result.title = parsed.rss.channel.title
          result.category = parsed.rss.channel.category
          
        } else if (parsed.feed?.entry) {
          const entries = parsed.feed.entry || []
          const sampleUrls = Array.isArray(entries)
            ? entries.slice(0, 5).map((entry: { link?: { '@_href'?: string; href?: string } | string }) => 
                typeof entry.link === 'string' ? entry.link : entry.link?.['@_href'] || entry.link?.href
              ).filter(Boolean)
            : entries.link?.['@_href'] ? [entries.link['@_href']] : []

          result.type = 'atom'
          result.valid = true
          result.articleCount = Array.isArray(entries) ? entries.length : (entries.link ? 1 : 0)
          result.sampleUrls = sampleUrls
          result.title = parsed.feed.title
          result.category = parsed.feed.category?.['@_term'] || parsed.feed.category
          
        } else {
          throw new Error('Invalid feed format')
        }

        // Validate sample URLs if requested
        if (opts.validateUrls && result.sampleUrls && result.sampleUrls.length > 0) {
          const urlValidation = await this.validateSampleUrls(result.sampleUrls.slice(0, 3))
          result.reliability = urlValidation.successRate
        } else {
          result.reliability = 1.0
        }

        result.responseTime = Date.now() - startTime
        result.retryCount = retryCount
        
        return result
        
      } catch (error) {
        lastError = error instanceof Error ? error.message : 'Unknown error'
        retryCount++
        
        if (retryCount <= (opts.maxRetries || 3)) {
          const delay = Math.min(
            (opts.baseDelay || 1000) * Math.pow(2, retryCount - 1),
            opts.maxDelay || 30000
          )
          await new Promise(resolve => setTimeout(resolve, delay))
        }
      }
    }

    result.error = lastError
    result.retryCount = retryCount - 1
    result.responseTime = Date.now() - startTime
    
    return result
  }

  /**
   * Validate sample URLs from feeds
   */
  private async validateSampleUrls(urls: string[]): Promise<{ successRate: number; validUrls: string[] }> {
    const validUrls: string[] = []
    
    const validationPromises = urls.map(async (url) => {
      try {
        const response = await axios.head(url, { 
          timeout: 5000,
          headers: { 'User-Agent': this.config.userAgent }
        })
        if (response.status === 200) {
          validUrls.push(url)
          return true
        }
      } catch {
        // Ignore errors, just mark as invalid
      }
      return false
    })
    
    const results = await Promise.all(validationPromises)
    const successCount = results.filter(Boolean).length
    
    return {
      successRate: urls.length > 0 ? successCount / urls.length : 0,
      validUrls
    }
  }

  /**
   * Phase 2: Database operations for source endpoints
   */
  async createEndpoint(request: EndpointCreateRequest): Promise<StoredEndpoint> {
    const now = new Date()
    const endpoint: NewSourceEndpoint = {
      sourceId: request.sourceId,
      endpointUrl: request.endpointUrl,
      type: request.type,
      category: request.category,
      linkSelector: request.linkSelector,
      pollingInterval: request.pollingInterval || 3600,
      reliability: Math.floor((request.reliability || 1.0) * 100),
      priority: request.priority || 1,
      metadata: request.metadata || {},
      successCount: 0,
      errorCount: 0,
      createdAt: now,
      updatedAt: now
    }

    const [created] = await this.db.insert(sourceEndpoints).values(endpoint).returning()
    return this.mapDbEndpointToStored(created)
  }

  async updateEndpoint(request: EndpointUpdateRequest): Promise<StoredEndpoint | null> {
    const updates: Partial<NewSourceEndpoint> = {
      updatedAt: new Date()
    }

    if (request.reliability !== undefined) {
      updates.reliability = Math.floor(request.reliability * 100)
    }
    if (request.successCount !== undefined) {
      updates.successCount = request.successCount
    }
    if (request.errorCount !== undefined) {
      updates.errorCount = request.errorCount
    }
    if (request.lastFetchAt) {
      updates.lastFetchAt = request.lastFetchAt
    }
    if (request.lastSuccessAt) {
      updates.lastSuccessAt = request.lastSuccessAt
    }
    if (request.metadata) {
      updates.metadata = request.metadata
    }

    const [updated] = await this.db
      .update(sourceEndpoints)
      .set(updates)
      .where(eq(sourceEndpoints.id, request.id))
      .returning()

    return updated ? this.mapDbEndpointToStored(updated) : null
  }

  async deleteEndpoint(id: string): Promise<boolean> {
    const result = await this.db
      .delete(sourceEndpoints)
      .where(eq(sourceEndpoints.id, id))
      .returning()

    return result.length > 0
  }

  async getEndpoint(id: string): Promise<StoredEndpoint | null> {
    const [endpoint] = await this.db
      .select()
      .from(sourceEndpoints)
      .where(eq(sourceEndpoints.id, id))
      .limit(1)

    return endpoint ? this.mapDbEndpointToStored(endpoint) : null
  }

  async queryEndpoints(query: EndpointQuery): Promise<StoredEndpoint[]> {
    const conditions = []
    if (query.sourceId) {
      conditions.push(eq(sourceEndpoints.sourceId, query.sourceId))
    }
    if (query.type) {
      conditions.push(eq(sourceEndpoints.type, query.type))
    }
    if (query.minReliability !== undefined) {
      conditions.push(gte(sourceEndpoints.reliability, Math.floor(query.minReliability * 100)))
    }

    // Build the complete query in a single chain based on conditions
    let results: SourceEndpoint[]
    
    if (conditions.length > 0) {
      if (query.limit && query.offset) {
        results = await this.db
          .select()
          .from(sourceEndpoints)
          .where(and(...conditions))
          .orderBy(desc(sourceEndpoints.priority), asc(sourceEndpoints.reliability))
          .limit(query.limit)
          .offset(query.offset)
      } else if (query.limit) {
        results = await this.db
          .select()
          .from(sourceEndpoints)
          .where(and(...conditions))
          .orderBy(desc(sourceEndpoints.priority), asc(sourceEndpoints.reliability))
          .limit(query.limit)
      } else if (query.offset) {
        results = await this.db
          .select()
          .from(sourceEndpoints)
          .where(and(...conditions))
          .orderBy(desc(sourceEndpoints.priority), asc(sourceEndpoints.reliability))
          .offset(query.offset)
      } else {
        results = await this.db
          .select()
          .from(sourceEndpoints)
          .where(and(...conditions))
          .orderBy(desc(sourceEndpoints.priority), asc(sourceEndpoints.reliability))
      }
    } else {
      if (query.limit && query.offset) {
        results = await this.db
          .select()
          .from(sourceEndpoints)
          .orderBy(desc(sourceEndpoints.priority), asc(sourceEndpoints.reliability))
          .limit(query.limit)
          .offset(query.offset)
      } else if (query.limit) {
        results = await this.db
          .select()
          .from(sourceEndpoints)
          .orderBy(desc(sourceEndpoints.priority), asc(sourceEndpoints.reliability))
          .limit(query.limit)
      } else if (query.offset) {
        results = await this.db
          .select()
          .from(sourceEndpoints)
          .orderBy(desc(sourceEndpoints.priority), asc(sourceEndpoints.reliability))
          .offset(query.offset)
      } else {
        results = await this.db
          .select()
          .from(sourceEndpoints)
          .orderBy(desc(sourceEndpoints.priority), asc(sourceEndpoints.reliability))
      }
    }

    return results.map(this.mapDbEndpointToStored)
  }

  async bulkCreateEndpoints(operation: BulkEndpointOperation): Promise<StoredEndpoint[]> {
    const now = new Date()
    
    // Delete existing endpoints if replacing
    if (operation.replaceExisting) {
      await this.db
        .delete(sourceEndpoints)
        .where(eq(sourceEndpoints.sourceId, operation.sourceId))
    }

    const endpoints: NewSourceEndpoint[] = operation.endpoints.map(request => ({
      sourceId: operation.sourceId,
      endpointUrl: request.endpointUrl,
      type: request.type,
      category: request.category,
      linkSelector: request.linkSelector,
      pollingInterval: request.pollingInterval || 3600,
      reliability: Math.floor((request.reliability || 1.0) * 100),
      priority: request.priority || 1,
      metadata: request.metadata || {},
      successCount: 0,
      errorCount: 0,
      createdAt: now,
      updatedAt: now
    }))

    const created = await this.db.insert(sourceEndpoints).values(endpoints).returning()
    return created.map(this.mapDbEndpointToStored)
  }

  async updateEndpointMetrics(id: string, metrics: EndpointMetrics): Promise<void> {
    const updates: Partial<NewSourceEndpoint> = {
      successCount: metrics.successCount,
      errorCount: metrics.errorCount,
      reliability: Math.floor(metrics.reliability * 100),
      updatedAt: new Date()
    }

    if (metrics.lastFetchAt) {
      updates.lastFetchAt = metrics.lastFetchAt
    }
    if (metrics.lastSuccessAt) {
      updates.lastSuccessAt = metrics.lastSuccessAt
    }

    await this.db
      .update(sourceEndpoints)
      .set(updates)
      .where(eq(sourceEndpoints.id, id))
  }

  async cleanupStaleEndpoints(minReliability = 0.1, daysStale = 30): Promise<number> {
    const staleDate = new Date()
    staleDate.setDate(staleDate.getDate() - daysStale)

    const result = await this.db
      .delete(sourceEndpoints)
      .where(
        and(
          gte(sourceEndpoints.reliability, Math.floor(minReliability * 100)),
          gte(sourceEndpoints.lastFetchAt, staleDate)
        )
      )
      .returning()

    logger.info(`Cleaned up ${result.length} stale endpoints`)
    return result.length
  }

  /**
   * Calculate reliability score based on success/error rates
   */
  calculateReliability(successCount: number, errorCount: number): number {
    const totalAttempts = successCount + errorCount
    if (totalAttempts === 0) return 1.0
    
    const successRate = successCount / totalAttempts
    
    // Apply exponential decay for recent failures
    const decayFactor = Math.exp(-errorCount * 0.1)
    
    return Math.max(0, successRate * decayFactor)
  }

  /**
   * Map database endpoint to stored endpoint interface
   */
  private mapDbEndpointToStored(dbEndpoint: SourceEndpoint): StoredEndpoint {
    return {
      id: dbEndpoint.id,
      sourceId: dbEndpoint.sourceId,
      endpointUrl: dbEndpoint.endpointUrl,
      type: dbEndpoint.type as 'rss' | 'atom' | 'html',
      category: dbEndpoint.category || undefined,
      linkSelector: dbEndpoint.linkSelector || undefined,
      pollingInterval: dbEndpoint.pollingInterval,
      reliability: dbEndpoint.reliability / 100,
      priority: dbEndpoint.priority,
      metadata: dbEndpoint.metadata as Record<string, unknown>,
      successCount: dbEndpoint.successCount,
      errorCount: dbEndpoint.errorCount,
      consecutiveFailureCount: dbEndpoint.consecutiveFailureCount || 0,
      lastFetchAt: dbEndpoint.lastFetchAt || undefined,
      lastSuccessAt: dbEndpoint.lastSuccessAt || undefined,
      createdAt: dbEndpoint.createdAt,
      updatedAt: dbEndpoint.updatedAt
    }
  }

  /**
   * Phase 3: LLM-based HTML analysis for sites without RSS feeds
   */
  async analyzeHtmlSource(url: string): Promise<SourceAnalysisResult> {
    const startTime = Date.now()
    logger.info(`Starting LLM-based HTML analysis for: ${url}`)

    const result: SourceAnalysisResult = {
      sourceUrl: url,
      endpoints: [],
      globalConfig: {
        userAgent: this.config.userAgent || 'Mozilla/5.0 (compatible; BabelFeed/1.0)',
        respectRobotsTxt: true,
        baseDelay: 1000
      },
      analysisMetadata: {
        iterations: 0,
        totalAnalysisTime: 0,
        finalConfidence: 0
      }
    }

    try {
      // Step 1: Preprocess HTML
      const htmlContent = await this.fetchAndPreprocessHtml(url)
      
      // Step 2: LLM analysis with iteration loop
      let confidence = 0
      let iteration = 0
      let bestResult: LlmAnalysisResult | null = null
      
      while (iteration < this.htmlCrawlingConfig.maxIterations && confidence < this.htmlCrawlingConfig.minConfidence) {
        iteration++
        result.analysisMetadata.iterations = iteration
        
        logger.debug(`LLM analysis iteration ${iteration} for ${url}`)
        
        const llmResult = await this.performLlmAnalysis(htmlContent, url, bestResult)
        
        if (llmResult.confidence > confidence) {
          confidence = llmResult.confidence
          bestResult = llmResult
        }
        
        // Step 3: Validate LLM proposed selectors
        if (llmResult.endpoints.length > 0) {
          const validatedEndpoints: DiscoveredEndpoint[] = []
          
          for (const endpoint of llmResult.endpoints) {
            const validation = await this.validateHtmlEndpoint(endpoint)
            
            if (validation.valid && validation.successRate >= this.htmlCrawlingConfig.minSuccessRate) {
              endpoint.reliability.testResults = {
                sampleSize: validation.urlCount,
                successRate: validation.successRate,
                avgArticlesPerPage: validation.urlCount
              }
              validatedEndpoints.push(endpoint)
            }
          }
          
          if (validatedEndpoints.length > 0 && 
              validatedEndpoints.some(e => e.reliability.testResults.sampleSize >= this.htmlCrawlingConfig.minSampleUrls)) {
            result.endpoints = validatedEndpoints
            break
          }
        }
        
        // Add delay between iterations (reduce for tests)
        if (iteration < this.htmlCrawlingConfig.maxIterations) {
          const delay = process.env.NODE_ENV === 'test' ? 100 : 2000
          await new Promise(resolve => setTimeout(resolve, delay))
        }
      }
      
      result.analysisMetadata.finalConfidence = confidence
      result.analysisMetadata.totalAnalysisTime = Date.now() - startTime
      
      logger.info(`LLM HTML analysis completed in ${iteration} iterations with ${result.endpoints.length} valid endpoints`)
      
      return result
      
    } catch (error) {
      logger.error('LLM HTML analysis failed:', error)
      result.analysisMetadata.totalAnalysisTime = Date.now() - startTime
      throw error
    }
  }

  /**
   * Fetch and preprocess HTML for LLM analysis
   */
  private async fetchAndPreprocessHtml(url: string): Promise<string> {
    const response = await this.makeProtectedRequest(url)

    const $ = load(response.data)
    
    // Remove scripts, styles, and other non-content elements
    $('script, style, noscript, iframe, object, embed, svg').remove()
    $('nav, footer, aside, .advertisement, .ads, .sidebar, .social-share').remove()
    $('[class*="ad-"], [class*="advertisement"], [id*="ad-"], [id*="advertisement"]').remove()
    
    // Focus on main content areas
    const mainContent = $('main, article, .content, .post, .article, .news, [role="main"]').first()
    const contentHtml = mainContent.length > 0 ? mainContent.html() : $('body').html()
    
    if (!contentHtml) {
      throw new Error('Unable to extract meaningful content from HTML')
    }
    
    // Limit size to 4KB for LLM processing
    const truncatedContent = contentHtml.length > 4096 
      ? contentHtml.substring(0, 4096) + '...[truncated]'
      : contentHtml
    
    return truncatedContent
  }

  /**
   * Perform LLM analysis to extract CSS selectors
   */
  private async performLlmAnalysis(htmlContent: string, sourceUrl: string, previousResult?: LlmAnalysisResult | null): Promise<LlmAnalysisResult> {
    const prompt = this.buildLlmPrompt(htmlContent, sourceUrl, previousResult)
    
    try {
      // Use LlmClient to make the request with proper provider selection and error handling
      const response = await this.llmClient.createChatCompletionWithProviderType({
        model: '*', // Use wildcard to let provider choose the best model for content analysis
        messages: [
          { 
            role: 'system', 
            content: 'You are an expert at analyzing HTML content and extracting CSS selectors for news article links. Always respond with valid JSON only.' 
          },
          { role: 'user', content: prompt }
        ],
        temperature: 0.1,
        max_tokens: 1500,
        response_format: { type: 'json_object' }
      }, 'content_analysis')
      
      const content = response.choices[0]?.message?.content?.trim() || ''
      logger.debug(`LLM response received: ${content.length} characters`)
      
      return this.parseLlmResponse(content, sourceUrl)
    } catch (error) {
      logger.error('LLM analysis failed:', error)
      throw error
    }
  }

  private buildLlmPrompt(htmlContent: string, sourceUrl: string, previousResult?: LlmAnalysisResult | null): string {
    let prompt = `Analyze this HTML content from ${sourceUrl} and extract CSS selectors for article links.

HTML Content:
${htmlContent}

Requirements:
1. Find CSS selectors for article links (required)
2. Find selectors for article titles (optional)
3. Find selectors for publication dates (optional)
4. Identify pagination patterns (optional)
5. Provide confidence score (0.0-1.0)

Return a JSON response with this structure:
{
  "endpoints": [{
    "url": "${sourceUrl}",
    "type": "html",
    "category": "news",
    "priority": 5,
    "crawlingScript": {
      "articleSelector": "CSS_SELECTOR_FOR_ARTICLE_LINKS",
      "titleSelector": "CSS_SELECTOR_FOR_TITLES",
      "timestampSelector": "CSS_SELECTOR_FOR_DATES",
      "paginationSelector": "CSS_SELECTOR_FOR_NEXT_PAGE"
    },
    "reliability": {
      "confidence": 0.8
    }
  }],
  "confidence": 0.8,
  "reasoning": "Explanation of why these selectors were chosen"
}`

    if (previousResult) {
      prompt += `\n\nPrevious analysis result (improve upon this):
${JSON.stringify(previousResult, null, 2)}`
    }

    return prompt
  }

  private parseLlmResponse(response: string, sourceUrl: string): LlmAnalysisResult {
    try {
      const parsed = JSON.parse(response)
      
      // Enhance parsed endpoints with required metadata
      const endpoints: DiscoveredEndpoint[] = parsed.endpoints?.map((ep: Record<string, unknown>) => ({
        ...ep,
        url: sourceUrl,
        reliability: {
          confidence: (ep.reliability as Record<string, unknown>)?.confidence as number || 0.5,
          testResults: {
            sampleSize: 0,
            successRate: 0,
            avgArticlesPerPage: 0
          }
        },
        metadata: {
          discoveredAt: new Date(),
          lastValidated: new Date(),
          llmModel: 'content-analysis-model',
          version: '1.0'
        }
      })) || []
      
      return {
        endpoints,
        confidence: parsed.confidence || 0.5,
        reasoning: parsed.reasoning || 'LLM analysis completed',
        suggestedImprovements: parsed.suggestedImprovements
      }
    } catch (error) {
      logger.error('Failed to parse LLM response:', error)
      throw new Error('Invalid LLM response format')
    }
  }

  /**
   * Validate HTML endpoint by testing selectors
   */
  private async validateHtmlEndpoint(endpoint: DiscoveredEndpoint): Promise<ValidationResult> {
    const result: ValidationResult = {
      valid: false,
      urlCount: 0,
      successRate: 0,
      sampleUrls: [],
      errors: []
    }

    try {
      const response = await this.makeProtectedRequest(endpoint.url)

      const $ = load(response.data)
      const articleLinks = $(endpoint.crawlingScript.articleSelector)
      
      if (articleLinks.length === 0) {
        result.errors.push('No article links found with provided selector')
        return result
      }

      // Extract and validate sample URLs
      const urls: string[] = []
      articleLinks.each((_, element) => {
        const href = $(element).attr('href')
        if (href) {
          const fullUrl = new URL(href, endpoint.url).href
          urls.push(fullUrl)
        }
      })

      if (urls.length === 0) {
        result.errors.push('No valid URLs found in article links')
        return result
      }

      // Test sample URLs
      const sampleUrls = urls.slice(0, Math.min(5, urls.length))
      let validUrls = 0
      
      for (const url of sampleUrls) {
        try {
          const urlResponse = await axios.head(url, { 
            timeout: 5000,
            headers: { 'User-Agent': this.config.userAgent }
          })
          if (urlResponse.status === 200) {
            validUrls++
          }
        } catch {
          // URL validation failed, continue
        }
      }

      result.urlCount = urls.length
      result.sampleUrls = sampleUrls
      result.successRate = sampleUrls.length > 0 ? validUrls / sampleUrls.length : 0
      result.valid = result.successRate >= this.htmlCrawlingConfig.minSuccessRate && 
                     result.urlCount >= this.htmlCrawlingConfig.minSampleUrls

      return result
      
    } catch (error) {
      result.errors.push(error instanceof Error ? error.message : 'Unknown validation error')
      return result
    }
  }

}
