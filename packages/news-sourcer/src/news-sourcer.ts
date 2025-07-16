import axios from 'axios'
import { load } from 'cheerio'
import { XMLParser } from 'fast-xml-parser'
import { logger } from '@babel-feed/utils'
import { getDatabase } from '@babel-feed/pgdb'
import { sourceEndpoints, type SourceEndpoint, type NewSourceEndpoint } from '@babel-feed/pgdb'
import { eq, and, gte, desc, asc } from 'drizzle-orm'
import type { 
  RssDiscoveryResult, 
  FeedValidationResult, 
  NewsSourceAnalysis,
  EndpointValidationOptions,
  EndpointValidationResult,
  EndpointMetrics,
  NewsSourcerConfig,
  StoredEndpoint,
  EndpointCreateRequest,
  EndpointUpdateRequest,
  EndpointQuery,
  BulkEndpointOperation
} from './types.js'

export class NewsSourcer {
  private config: NewsSourcerConfig
  private db!: Awaited<ReturnType<typeof getDatabase>>

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
      ...config
    }
  }

  async initialize(): Promise<void> {
    this.db = await getDatabase()
    logger.info('NewsSourcer initialized with database connection')
  }

  /**
   * Phase 1: RSS/Atom feed discovery and validation
   */
  async analyzeSource(url: string): Promise<NewsSourceAnalysis> {
    logger.info(`Starting RSS/Atom discovery for: ${url}`)
    
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
      
      logger.info(`RSS/Atom discovery completed. Found ${analysis.rssFeeds.length} RSS + ${analysis.atomFeeds.length} Atom feeds`)
      
      return analysis
    } catch (error) {
      logger.error('RSS/Atom discovery failed:', error)
      throw error
    }
  }

  /**
   * Discover RSS/Atom feeds from a website
   */
  private async discoverFeeds(url: string): Promise<RssDiscoveryResult[]> {
    const discovered: RssDiscoveryResult[] = []
    
    try {
      // Fetch the main page
      const response = await axios.get(url, { 
        timeout: this.config.validation?.timeout || 10000,
        headers: { 'User-Agent': this.config.userAgent }
      })
      
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
      logger.error('Feed discovery failed:', error)
      return []
    }
  }

  /**
   * Validate an RSS/Atom feed
   */
  private async validateFeed(feedUrl: string): Promise<FeedValidationResult> {
    try {
      const response = await axios.get(feedUrl, { 
        timeout: this.config.validation?.timeout || 10000,
        headers: { 'User-Agent': this.config.userAgent }
      })
      
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
        const response = await axios.get(endpointUrl, { 
          timeout: opts.timeout || 10000,
          headers: { 'User-Agent': this.config.userAgent }
        })
        
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
      lastFetchAt: dbEndpoint.lastFetchAt || undefined,
      lastSuccessAt: dbEndpoint.lastSuccessAt || undefined,
      createdAt: dbEndpoint.createdAt,
      updatedAt: dbEndpoint.updatedAt
    }
  }

}
