import { Article, ExtractionResult } from '@babel-feed/news-extractor'
import { NewsSourcer } from '@babel-feed/news-sourcer'
import { articles, getDatabase } from '@babel-feed/pgdb'
import { logger } from '@babel-feed/utils'

export interface JobConfig {
  name: string
  interval: number // milliseconds
  enabled: boolean
  maxConcurrency?: number
  retryAttempts?: number
  timeout?: number
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

    // Initialize default job configurations
    this.initializeDefaultJobs()
  }

  private initializeDefaultJobs(): void {
    // News Sourcer Jobs - Find article URLs from sources
    this.addJob({
      name: 'source-discovery',
      interval: 6 * 60 * 60 * 1000, // 6 hours
      enabled: true,
      maxConcurrency: 1,
      retryAttempts: 3,
      timeout: 300000 // 5 minutes
    })

    this.addJob({
      name: 'url-fetching',
      interval: 30 * 60 * 1000, // 30 minutes
      enabled: true,
      maxConcurrency: 5,
      retryAttempts: 2,
      timeout: 60000 // 1 minute
    })

    // News Extractor Jobs - Extract and process content from article URLs
    this.addJob({
      name: 'article-processing',
      interval: 30 * 60 * 1000, // 30 minutes (same as url-fetching)
      enabled: true,
      maxConcurrency: 8,
      retryAttempts: 2,
      timeout: 180000 // 3 minutes
    })

    // Maintenance Jobs
    this.addJob({
      name: 'health-monitoring',
      interval: 5 * 60 * 1000, // 5 minutes
      enabled: true,
      maxConcurrency: 1,
      retryAttempts: 1,
      timeout: 30000 // 30 seconds
    })

    this.addJob({
      name: 'cleanup',
      interval: 24 * 60 * 60 * 1000, // 24 hours
      enabled: true,
      maxConcurrency: 1,
      retryAttempts: 1,
      timeout: 300000 // 5 minutes
    })
  }

  async initialize(): Promise<void> {
    this.db = await getDatabase()
    await this.newsSourcer.initialize()
    
    // Initialize status for all jobs
    for (const [name, config] of this.jobs) {
      this.status.set(name, {
        name,
        running: false,
        totalRuns: 0,
        totalErrors: 0,
        averageProcessingTime: 0
      })
    }

    logger.info('Job scheduler initialized with default jobs')
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

    // Run initial job
    await this.executeJob(jobName)

    // Schedule recurring job
    const timer = setInterval(async () => {
      await this.executeJob(jobName)
    }, config.interval)

    this.timers.set(jobName, timer)
    
    const status = this.status.get(jobName)
    if (status) {
      status.nextRun = new Date(Date.now() + config.interval)
    }

    logger.info(`Started job: ${jobName} (${config.interval}ms interval)`)
  }

  private stopJob(jobName: string): void {
    const timer = this.timers.get(jobName)
    if (timer) {
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

    status.running = true
    status.lastRun = new Date()
    status.totalRuns++

    const startTime = Date.now()
    let result: JobResult

    try {
      logger.debug(`Executing job: ${jobName}`)
      
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
      status.lastSuccess = new Date()
      status.lastError = undefined
      status.averageProcessingTime = this.calculateAverageProcessingTime(
        status.averageProcessingTime,
        status.totalRuns,
        result.processingTime
      )

      logger.info(`Job ${jobName} completed successfully`, {
        processed: result.processed,
        errors: result.errors,
        skipped: result.skipped,
        processingTime: result.processingTime
      })

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      status.lastError = errorMessage
      status.totalErrors++
      
      logger.error(`Job ${jobName} failed:`, error)
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
      // Fetch article URLs from configured sources
      // This would use news-sourcer to get article URLs without extracting content
      const sources = await this.db.select().from(articles).limit(10) // Placeholder
      processed = sources.length

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
      // Get URLs that need content extraction
      const pendingUrls = await this.getPendingArticleUrls()
      
      for (const url of pendingUrls) {
        try {
          // Use news-extractor to extract full article content
          const article = new Article(url)
          const result = await article.process()
          
          if (result.title && result.text) {
            // Process the extracted content immediately (AI summarization, translation, etc.)
            const processedArticle = await this.processAndStoreArticle(url, result)
            if (processedArticle) {
              processed++
            } else {
              skipped++
            }
          } else {
            skipped++
          }
        } catch (error) {
          errors++
          logger.error(`Failed to process article from ${url}:`, error)
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

  private async extractTags(text: string): Promise<string[]> {
    // This would use AI to extract relevant tags
    // For now, return empty array
    return []
  }

  private async detectLanguage(text: string): Promise<string> {
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
    return (currentAverage * (totalRuns - 1) + newProcessingTime) / totalRuns
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
} 