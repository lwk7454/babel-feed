import { Article, ExtractionResult } from '@babel-feed/news-extractor'
import { NewsSourcer } from '@babel-feed/news-sourcer'
import { articles, sourceEndpoints, newsSources, articleTranslations, getDatabase, JobConfig as DbJobConfig, JobStatus as DbJobStatus, JobExecution } from '@babel-feed/pgdb'
import { eq, and } from 'drizzle-orm'
import RSSParser from 'rss-parser'
import { logger } from '@babel-feed/utils'
import { JobDatabaseService, JobDatabaseServiceImpl } from './job-db'
import { TranslationService } from './translation-service'
import { AIIntegrationService } from '../modules/aggregator/ai-integration'

export interface JobConfig {
  name: string
  interval: number // milliseconds
  enabled: boolean
  maxConcurrency?: number
  retryAttempts?: number
  timeout?: number
}

// Map database job config to service job config
function mapDbJobConfig(dbConfig: DbJobConfig): JobConfig {
  return {
    name: dbConfig.name,
    interval: dbConfig.interval,
    enabled: dbConfig.enabled,
    maxConcurrency: dbConfig.maxConcurrency || 1,
    retryAttempts: dbConfig.retryAttempts || 3,
    timeout: dbConfig.timeout || 60000
  }
}

export interface JobResult {
  success: boolean
  processed: number
  errors: number
  skipped: number
  processingTime: number
  error?: string
}

export interface JobStatus {
  name: string
  running: boolean
  lastRun?: Date
  lastSuccess?: Date
  lastError?: string
  nextRun?: Date
  totalRuns: number
  totalErrors: number
  averageProcessingTime: number
}

export class JobScheduler {
  private jobs: Map<string, JobConfig> = new Map()
  private timers: Map<string, NodeJS.Timeout> = new Map()
  private status: Map<string, JobStatus> = new Map()
  private isRunning = false
  private db!: Awaited<ReturnType<typeof getDatabase>>
  private newsSourcer: NewsSourcer
  private jobDb: JobDatabaseService

  constructor() {
    this.newsSourcer = new NewsSourcer({
      validation: {
        maxRetries: 3,
        baseDelay: 1000,
        maxDelay: 30000,
        timeout: 10000,
        validateUrls: true
      },
      userAgent: 'BabelFeed-NewsAggregator/1.0'
    })

    this.jobDb = new JobDatabaseServiceImpl()
  }

  private async loadJobsFromDatabase(): Promise<void> {
    try {
      // Load job configurations from database
      const dbConfigs = await this.jobDb.getJobConfigs()
      
      this.jobs.clear()
      this.status.clear()
      
      for (const dbConfig of dbConfigs) {
        // Convert database config to service config
        const config = mapDbJobConfig(dbConfig)
        this.jobs.set(config.name, config)
        
        // Load job status from database
        const dbStatus = await this.jobDb.getJobStatus(dbConfig.id)
        if (dbStatus) {
          // Convert database status to service status
          const status: JobStatus = {
            name: config.name,
            running: dbStatus.running,
            lastRun: dbStatus.lastRun || undefined,
            lastSuccess: dbStatus.lastSuccess || undefined,
            lastError: dbStatus.lastError || undefined,
            nextRun: dbStatus.nextRun || undefined,
            totalRuns: dbStatus.totalRuns,
            totalErrors: dbStatus.totalErrors,
            averageProcessingTime: dbStatus.averageProcessingTime
          }
          this.status.set(config.name, status)
        } else {
          // Create default status if not exists
          const defaultStatus: JobStatus = {
            name: config.name,
            running: false,
            totalRuns: 0,
            totalErrors: 0,
            averageProcessingTime: 0
          }
          this.status.set(config.name, defaultStatus)
        }
      }
      
      logger.info(`Loaded ${dbConfigs.length} job configurations from database`)
    } catch (error) {
      logger.error('Failed to load jobs from database:', error)
      throw error
    }
  }

  async initialize(): Promise<void> {
    this.db = await getDatabase()
    await this.newsSourcer.initialize()
    
    // Initialize job database service
    await this.jobDb.initialize() 
    
    // Initialize default jobs in database if they don't exist
    await this.jobDb.initializeDefaultJobs()
    
    // Load jobs and status from database
    await this.loadJobsFromDatabase()

    logger.info('Job scheduler initialized with database-persisted jobs')
  }

  addJob(jobConfig: JobConfig): void {
    this.jobs.set(jobConfig.name, jobConfig)
    logger.info(`Added job: ${jobConfig.name} (${jobConfig.interval}ms interval)`)
  }

  removeJob(jobName: string): void {
    this.stopJob(jobName)
    this.jobs.delete(jobName)
    this.status.delete(jobName)
    logger.info(`Removed job: ${jobName}`)
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('Job scheduler is already running')
      return
    }

    this.isRunning = true
    logger.info('Starting job scheduler...')

    // Start all enabled jobs
    for (const [name, config] of this.jobs) {
      if (config.enabled) {
        await this.startJob(name)
      }
    }

    logger.info('Job scheduler started successfully')
  }

  async stop(): Promise<void> {
    if (!this.isRunning) {
      logger.warn('Job scheduler is not running')
      return
    }

    this.isRunning = false
    logger.info('Stopping job scheduler...')

    // Stop all jobs
    for (const [name] of this.jobs) {
      this.stopJob(name)
    }

    logger.info('Job scheduler stopped')
  }

  private async startJob(jobName: string): Promise<void> {
    const config = this.jobs.get(jobName)
    if (!config || !config.enabled) {
      return
    }

    // Stop existing timer if any
    this.stopJob(jobName)

    // Calculate next run time based on last execution
    const nextRunTime = await this.calculateNextRunTime(jobName)
    const now = Date.now()
    
    if (nextRunTime <= now) {
      // Job should run immediately
      await this.executeJob(jobName)
      // Schedule next run
      this.scheduleNextRun(jobName, config.interval)
    } else {
      // Schedule job to run at the calculated time
      const delay = nextRunTime - now
      logger.info(`Job ${jobName} scheduled to run in ${Math.round(delay / 1000)}s`)
      
      const timer = setTimeout(async () => {
        await this.executeJob(jobName)
        // Schedule recurring job after first execution
        this.scheduleNextRun(jobName, config.interval)
      }, delay)
      
      this.timers.set(jobName, timer)
      
      const status = this.status.get(jobName)
      if (status) {
        status.nextRun = new Date(nextRunTime)
      }
    }

    logger.info(`Started job: ${jobName} (${config.interval}ms interval)`)
  }

  private scheduleNextRun(jobName: string, interval: number): void {
    const timer = setInterval(async () => {
      await this.executeJob(jobName)
    }, interval)
    
    this.timers.set(jobName, timer)
    
    const status = this.status.get(jobName)
    if (status) {
      status.nextRun = new Date(Date.now() + interval)
    }
  }

  private async calculateNextRunTime(jobName: string): Promise<number> {
    try {
      const config = this.jobs.get(jobName)
      if (!config) {
        return Date.now()
      }
      
      // Get the last execution from database
      const dbConfig = await this.jobDb.getJobConfig(jobName)
      if (!dbConfig) {
        return Date.now() // Run immediately if no config found
      }
      
      const lastExecution = await this.jobDb.getLastExecution(dbConfig.id)
      if (!lastExecution || !lastExecution.startedAt) {
        return Date.now() // Run immediately if never executed
      }
      
      // Calculate when the job should run next based on last execution + interval
      const lastRunTime = new Date(lastExecution.startedAt).getTime()
      const nextRunTime = lastRunTime + config.interval
      
      return nextRunTime
    } catch (error) {
      logger.error(`Failed to calculate next run time for ${jobName}:`, error)
      return Date.now() // Default to immediate execution on error
    }
  }

  private stopJob(jobName: string): void {
    const timer = this.timers.get(jobName)
    if (timer) {
      clearTimeout(timer)
      clearInterval(timer)
      this.timers.delete(jobName)
      logger.debug(`Stopped job: ${jobName}`)
    }
  }

  private async executeJob(jobName: string): Promise<void> {
    const config = this.jobs.get(jobName)
    const status = this.status.get(jobName)
    
    if (!config || !status) {
      return
    }

    // Check if job is already running
    if (status.running) {
      logger.debug(`Job ${jobName} is already running, skipping`)
      return
    }

    // Get database config for persistence
    const dbConfig = await this.jobDb.getJobConfig(jobName)
    if (!dbConfig) {
      logger.error(`Database config not found for job: ${jobName}`)
      return
    }

    // Generate unique execution ID
    const executionId = `${jobName}-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`
    const startTime = Date.now()
    
    // Create job execution record
    await this.jobDb.createJobExecution({
      jobConfigId: dbConfig.id,
      executionId,
      status: 'running',
      startedAt: new Date(),
      triggeredBy: 'schedule' // TODO: Track manual vs scheduled
    })

    // Update in-memory and database status
    status.running = true
    status.lastRun = new Date()
    status.totalRuns++
    
    await this.jobDb.updateJobStatus(dbConfig.id, {
      running: true,
      lastRun: new Date(),
      totalRuns: status.totalRuns
    })

    let result: JobResult

    try {
      logger.debug(`Executing job: ${jobName} (${executionId})`)
      
      switch (jobName) {
        case 'source-discovery':
          result = await this.executeSourceDiscovery()
          break
        case 'url-fetching':
          result = await this.executeUrlFetching()
          break
        case 'article-processing':
          result = await this.executeArticleProcessing()
          break
        case 'health-monitoring':
          result = await this.executeHealthMonitoring()
          break
        case 'cleanup':
          result = await this.executeCleanup()
          break
        default:
          throw new Error(`Unknown job: ${jobName}`)
      }

      // Update status on success
      const completedAt = new Date()
      const processingTime = Date.now() - startTime
      
      status.lastSuccess = completedAt
      status.lastError = undefined
      status.averageProcessingTime = this.calculateAverageProcessingTime(
        status.averageProcessingTime,
        status.totalRuns,
        processingTime
      )

      // Update database execution record
      await this.jobDb.updateJobExecution(executionId, {
        status: 'success',
        completedAt,
        processingTime,
        processed: result.processed,
        errors: result.errors,
        skipped: result.skipped,
        result: {
          success: result.success,
          details: {
            processed: result.processed,
            errors: result.errors,
            skipped: result.skipped,
            processingTime
          }
        }
      })

      // Update database status
      await this.jobDb.updateJobStatus(dbConfig.id, {
        running: false,
        lastSuccess: completedAt,
        lastError: null,
        averageProcessingTime: status.averageProcessingTime,
        consecutiveFailures: 0
      })

      logger.info(`Job ${jobName} completed successfully`, {
        executionId,
        processed: result.processed,
        errors: result.errors,
        skipped: result.skipped,
        processingTime
      })

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      const completedAt = new Date()
      const processingTime = Date.now() - startTime
      
      status.lastError = errorMessage
      status.totalErrors++
      
      // Update database execution record
      await this.jobDb.updateJobExecution(executionId, {
        status: 'failed',
        completedAt,
        processingTime,
        errorMessage,
        result: {
          success: false,
          error: errorMessage
        }
      })

      // Update database status
      const dbStatus = await this.jobDb.getJobStatus(dbConfig.id)
      const consecutiveFailures = (dbStatus?.consecutiveFailures || 0) + 1
      
      await this.jobDb.updateJobStatus(dbConfig.id, {
        running: false,
        lastError: errorMessage,
        totalErrors: status.totalErrors,
        consecutiveFailures
      })
      
      logger.error(`Job ${jobName} failed:`, { executionId, error: errorMessage })
    } finally {
      status.running = false
    }
  }

  // News Sourcer Jobs

  private async executeSourceDiscovery(): Promise<JobResult> {
    const startTime = Date.now()
    let processed = 0
    let errors = 0
    const skipped = 0

    try {
      // Use news-sourcer to discover new sources
      // Note: Using analyzeSource instead of discoverFromUrls (which doesn't exist)
      const analysis = await this.newsSourcer.analyzeSource('https://feeds.bbci.co.uk/news/rss.xml')
      processed = analysis.rssFeeds.length + analysis.atomFeeds.length
      logger.info(`Source discovery completed: ${processed} feeds discovered`)

    } catch (error) {
      errors++
      logger.error('Source discovery failed:', error)
    }

    return {
      success: errors === 0,
      processed,
      errors,
      skipped,
      processingTime: Date.now() - startTime
    }
  }

  private async executeUrlFetching(): Promise<JobResult> {
    const startTime = Date.now()
    let processed = 0
    let errors = 0
    const skipped = 0

    try {
      // Get all source endpoints
      const endpoints = await this.db.select().from(sourceEndpoints)
      logger.info(`Processing ${endpoints.length} source endpoints`)
      
      const rssParser = new RSSParser({
        timeout: 30000,
        headers: {
          'User-Agent': 'BabelFeed-NewsAggregator/1.0',
          'Accept': 'application/rss+xml, application/xml, text/xml',
        }
      })

      for (const endpoint of endpoints) {
        try {
          // Get the source info
          const [source] = await this.db
            .select()
            .from(newsSources)
            .where(eq(newsSources.id, endpoint.sourceId))
            .limit(1)
          
          if (!source) {
            logger.warn(`Source not found for endpoint ${endpoint.id}`)
            continue
          }

          // Fetch RSS feed
          const feed = await rssParser.parseURL(endpoint.endpointUrl)
          
          if (!feed.items || feed.items.length === 0) {
            logger.debug(`No items found in RSS feed for ${source.name}`)
            continue
          }

          let articlesFromThisEndpoint = 0

          // Process RSS items - just collect URLs for later extraction
          for (const item of feed.items) {
            if (!item.link || !item.title) {
              continue
            }

            // Check if article already exists
            const existing = await this.db
              .select({ id: articles.id })
              .from(articles)
              .where(eq(articles.url, item.link.trim()))
              .limit(1)
            
            if (existing.length > 0) {
              continue // Skip existing articles
            }

            // Parse publication date
            const publishedAt = item.pubDate ? new Date(item.pubDate) : new Date()
            
            // Insert basic article record (will be filled with extracted content later)
            await this.db.insert(articles).values({
              url: item.link.trim(),
              sourceId: source.id,
              source: source.name,
              sourceLanguage: source.language,
              imageUrl: null, // Will be extracted later
              publishedAt,
              createdAt: new Date(),
              updatedAt: new Date()
            })
            
            articlesFromThisEndpoint++
          }

          processed++
          
          // Update endpoint success metrics
          await this.db
            .update(sourceEndpoints)
            .set({ 
              lastFetchAt: new Date(),
              lastSuccessAt: new Date(),
              successCount: endpoint.successCount + 1
            })
            .where(eq(sourceEndpoints.id, endpoint.id))
          
          logger.info(`Processed ${articlesFromThisEndpoint} articles from ${source.name}`)

        } catch (error) {
          errors++
          logger.error(`Failed to process endpoint ${endpoint.endpointUrl}:`, error)
          
          // Update endpoint error metrics
          await this.db
            .update(sourceEndpoints)
            .set({ 
              lastFetchAt: new Date(),
              errorCount: endpoint.errorCount + 1,
              consecutiveFailureCount: endpoint.consecutiveFailureCount + 1
            })
            .where(eq(sourceEndpoints.id, endpoint.id))
        }
      }

    } catch (error) {
      errors++
      logger.error('URL fetching failed:', error)
    }

    return {
      success: errors === 0,
      processed,
      errors,
      skipped,
      processingTime: Date.now() - startTime
    }
  }

  // News Extractor Jobs - Extract and process content in one step

  private async executeArticleProcessing(): Promise<JobResult> {
    const startTime = Date.now()
    let processed = 0
    let errors = 0
    let skipped = 0

    try {
      // Initialize translation service
      const translationService = new TranslationService()
      await translationService.initialize()
      
      if (!translationService.isEnabled()) {
        logger.info('Translation is disabled, skipping article processing')
        return {
          success: true,
          processed: 0,
          errors: 0,
          skipped: 0,
          processingTime: Date.now() - startTime
        }
      }
      
      const targetLanguages = translationService.getTargetLanguages()
      
      // Get articles that need content extraction (articles without translations indicate they haven't been processed)
      const articlesNeedingProcessing = await this.db
        .select()
        .from(articles)
        .leftJoin(articleTranslations, eq(articles.id, articleTranslations.articleId))
        .where(eq(articleTranslations.articleId, null))
        .limit(10) // Process fewer articles at a time since extraction takes longer
      
      for (const { articles: article } of articlesNeedingProcessing) {
        if (!article) continue
        
        try {
          logger.info(`Extracting content from: ${article.url}`)
          
          // Extract full article content using news-extractor
          const newsArticle = new Article(article.url)
          const extractionResult = await newsArticle.process()
          
          if (!extractionResult.title || !extractionResult.text) {
            logger.warn(`Failed to extract content from ${article.url} - missing title or text`)
            skipped++
            continue
          }
          
          logger.info(`Extracted article: "${extractionResult.title}" (${extractionResult.text.length} chars)`)
          
          // Update article with extracted content metadata
          await this.db
            .update(articles)
            .set({
              imageUrl: extractionResult.images?.[0] || null,
              updatedAt: new Date()
            })
            .where(eq(articles.id, article.id))
          
          // Create translations for all target languages AND original language
          const languagesToProcess = [...targetLanguages]
          
          // Add source language if it's not already in target languages
          if (!languagesToProcess.includes(article.sourceLanguage)) {
            languagesToProcess.push(article.sourceLanguage)
          }
          
          for (const language of languagesToProcess) {
            try {
              let title = extractionResult.title
              let summary = extractionResult.metadata?.description as string || ''
              
              // If this is not the source language, translate it
              if (language !== article.sourceLanguage) {
                logger.debug(`Translating to ${language}`)
                
                // Translate title
                title = await this.translateContent(extractionResult.title, language)
                
                // Generate and translate summary from the full text
                if (!summary && extractionResult.text.length > 200) {
                  // Generate summary from first 2-3 sentences
                  const sentences = extractionResult.text.split(/[.!?]+/).filter(s => s.trim().length > 20)
                  const summaryText = sentences.slice(0, 3).join('. ').trim()
                  if (summaryText) {
                    summary = await this.translateContent(summaryText, language)
                  }
                }
              } else {
                // For source language, generate summary if not available
                if (!summary && extractionResult.text.length > 200) {
                  const sentences = extractionResult.text.split(/[.!?]+/).filter(s => s.trim().length > 20)
                  summary = sentences.slice(0, 3).join('. ').trim()
                }
              }
              
              // Store the translation/summary
              await this.db.insert(articleTranslations).values({
                articleId: article.id,
                language: language,
                title: title,
                summary: summary || `Article from ${article.source}`,
                content: null, // We don't store full content to save space
                createdAt: new Date(),
                updatedAt: new Date()
              })
              
              logger.debug(`Stored ${language} translation for article ${article.id}`)
              
            } catch (translationError) {
              logger.error(`Failed to create ${language} version for article ${article.id}:`, translationError)
              // Continue with other languages
            }
          }
          
          processed++
          logger.info(`Successfully processed article: ${extractionResult.title}`)
          
        } catch (error) {
          errors++
          logger.error(`Failed to extract/process article ${article.id} (${article.url}):`, error)
        }
      }

    } catch (error) {
      errors++
      logger.error('Article processing failed:', error)
    }

    return {
      success: errors === 0,
      processed,
      errors,
      skipped,
      processingTime: Date.now() - startTime
    }
  }
  
  private async translateContent(text: string, targetLanguage: string): Promise<string> {
    try {
      // Use the existing AI integration service from the aggregator module
      const aiService = new AIIntegrationService()
      await aiService.initialize()
      
      const translated = await aiService.translateContent(text, targetLanguage)
      return translated
    } catch (error) {
      logger.error(`Translation failed for language ${targetLanguage}:`, error)
      return text // Return original text if translation fails
    }
  }

  // Maintenance Jobs

  private async executeHealthMonitoring(): Promise<JobResult> {
    const startTime = Date.now()
    let processed = 0
    let errors = 0
    const skipped = 0

    try {
      // Monitor system health, source reliability, etc.
      processed = 1 // Placeholder

    } catch (error) {
      errors++
      logger.error('Health monitoring failed:', error)
    }

    return {
      success: errors === 0,
      processed,
      errors,
      skipped,
      processingTime: Date.now() - startTime
    }
  }

  private async executeCleanup(): Promise<JobResult> {
    const startTime = Date.now()
    let processed = 0
    let errors = 0
    const skipped = 0

    try {
      // Clean up old data, expired cache entries, etc.
      processed = 1 // Placeholder

    } catch (error) {
      errors++
      logger.error('Cleanup failed:', error)
    }

    return {
      success: errors === 0,
      processed,
      errors,
      skipped,
      processingTime: Date.now() - startTime
    }
  }

  // Helper methods

  private async getPendingArticleUrls(): Promise<string[]> {
    // Get URLs that have been discovered but not yet extracted
    // This would query a pending_urls table or similar
    return [] // Placeholder
  }

  private async processAndStoreArticle(url: string, extractionResult: ExtractionResult): Promise<boolean> {
    try {
      // Step 1: Generate summary using AI (if not already present)
      let summary = extractionResult.metadata?.description as string
      if (!summary && extractionResult.text) {
        // Use AI to generate a summary (this would use the AI provider manager)
        summary = await this.generateSummary(extractionResult.text)
      }

      // Step 2: Extract tags/keywords
      const tags = await this.extractTags(extractionResult.text)

      // Step 3: Detect language
      const language = await this.detectLanguage(extractionResult.text)

      // Step 4: Generate reading time estimate
      const readingTime = Math.ceil(extractionResult.text.length / 200) // Rough estimate

      // Step 5: Store only processed metadata (NOT the full text)
      const processedArticle = {
        url,
        title: extractionResult.title,
        summary: summary || '',
        imageUrl: extractionResult.images?.[0] || null,
        sourceLanguage: language,
        publishedAt: extractionResult.publishDate ?? new Date(),
        author: extractionResult.authors?.join(', ') || null,
        metadata: {
          tags,
          readingTime,
          wordCount: extractionResult.text.length,
          extractedAt: new Date(),
          // DO NOT store the full text content
        }
      }

      // Store in database (this would use the articles table)
      await this.storeProcessedArticle(processedArticle)
      
      return true
    } catch (error) {
      logger.error(`Failed to process and store article ${url}:`, error)
      return false
    }
  }

  private async generateSummary(text: string): Promise<string> {
    // This would use the AI provider manager to generate a summary
    // For now, return a simple truncation
    return text.length > 300 ? text.substring(0, 297) + '...' : text
  }

  private async extractTags(_text: string): Promise<string[]> {
    // This would use AI to extract relevant tags
    // For now, return empty array
    return []
  }

  private async detectLanguage(_text: string): Promise<string> {
    // This would use language detection
    // For now, assume English
    return 'en'
  }

  private async storeProcessedArticle(article: {
    url: string
    title: string
    summary: string
    imageUrl: string | null
    sourceLanguage: string
    publishedAt: Date
    author: string | null
    metadata: Record<string, unknown>
  }): Promise<void> {
    // Store the processed article metadata in the database
    // This would insert into the articles table
    logger.info(`Storing processed article: ${article.title}`)
  }

  private calculateAverageProcessingTime(
    currentAverage: number,
    totalRuns: number,
    newProcessingTime: number
  ): number {
    return Math.round((currentAverage * (totalRuns - 1) + newProcessingTime) / totalRuns)
  }

  // Public API

  getJobStatus(jobName: string): JobStatus | undefined {
    return this.status.get(jobName)
  }

  getAllJobStatus(): JobStatus[] {
    return Array.from(this.status.values())
  }

  async runJobNow(jobName: string): Promise<JobResult> {
    const config = this.jobs.get(jobName)
    if (!config) {
      throw new Error(`Job not found: ${jobName}`)
    }

    logger.info(`Manually executing job: ${jobName}`)
    await this.executeJob(jobName)
    
    const status = this.status.get(jobName)
    return {
      success: !status?.lastError,
      processed: 0, // Would need to track this per execution
      errors: status?.lastError ? 1 : 0,
      skipped: 0,
      processingTime: 0
    }
  }

  updateJobConfig(jobName: string, updates: Partial<JobConfig>): void {
    const config = this.jobs.get(jobName)
    if (!config) {
      throw new Error(`Job not found: ${jobName}`)
    }

    const updatedConfig = { ...config, ...updates }
    this.jobs.set(jobName, updatedConfig)

    // Restart job if it's currently running
    if (this.isRunning && updatedConfig.enabled) {
      this.startJob(jobName)
    } else if (!updatedConfig.enabled) {
      this.stopJob(jobName)
    }

    logger.info(`Updated job config: ${jobName}`, updates)
  }

  // Helper method to execute job logic without the persistence wrapper
  private async executeJobLogic(jobName: string): Promise<JobResult> {
    switch (jobName) {
      case 'source-discovery':
        return await this.executeSourceDiscovery()
      case 'url-fetching':
        return await this.executeUrlFetching()
      case 'article-processing':
        return await this.executeArticleProcessing()
      case 'health-monitoring':
        return await this.executeHealthMonitoring()
      case 'cleanup':
        return await this.executeCleanup()
      default:
        throw new Error(`Unknown job: ${jobName}`)
    }
  }

  // Get job execution history
  async getJobHistory(jobName: string, limit = 50): Promise<JobExecution[]> {
    return await this.jobDb.getJobExecutionHistoryByName(jobName, limit)
  }

  // Get database status for a job
  async getJobDatabaseStatus(jobName: string): Promise<DbJobStatus | null> {
    return await this.jobDb.getJobStatusByName(jobName)
  }
} 