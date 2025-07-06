import { logger } from '../modules/common/logger'
import { config } from '../modules/common/config'
import { ModuleStatus } from '../modules/common/types'

// Core service managers
import { NewsSourceManager } from './news-source-manager'
import { AiProviderManager } from './ai-provider-manager'
import { CacheManager } from './cache-manager'
import { HealthChecker } from './health-checker'
import { RssProcessor } from './rss-processor'

export class NewsAggregatorService {
  // Core service managers
  private sourceManager: NewsSourceManager
  private aiProviderManager: AiProviderManager
  private contentCache: CacheManager
  private translationCache: CacheManager<string>
  private healthChecker: HealthChecker
  private rssProcessor: RssProcessor

  // Service state
  private isRunning = false
  private pollingInterval?: NodeJS.Timeout
  private healthCheckInterval?: NodeJS.Timeout

  constructor() {
    // Initialize core service managers
    this.sourceManager = new NewsSourceManager()
    this.aiProviderManager = new AiProviderManager()
    this.contentCache = CacheManager.createContentCache()
    this.translationCache = CacheManager.createTranslationCache()
    this.healthChecker = new HealthChecker(this.sourceManager, this.aiProviderManager)
    this.rssProcessor = new RssProcessor(this.sourceManager)
  }

  async initialize(): Promise<void> {
    logger.info('Initializing News Aggregator Service...')

    try {
      // Initialize all core services
      await this.sourceManager.initialize()
      await this.aiProviderManager.initialize()
      // Health checker and RSS processor don't need explicit initialization

      this.isRunning = true
      logger.info('News Aggregator Service initialized successfully')
    } catch (error) {
      logger.error('Failed to initialize News Aggregator Service:', error)
      throw error
    }
  }

  async start(): Promise<void> {
    if (!this.isRunning) {
      throw new Error('Service must be initialized before starting')
    }

    logger.info('Starting News Aggregator Service...')

    try {
      // Start content processing
      this.startContentProcessing()
      
      // Start health monitoring
      this.startHealthMonitoring()
      
      // No additional startup actions needed

      logger.info('News Aggregator Service started')
    } catch (error) {
      logger.error('Failed to start News Aggregator Service:', error)
      throw error
    }
  }

  async stop(): Promise<void> {
    logger.info('Stopping News Aggregator Service...')

    try {
      // Stop content processing
      if (this.pollingInterval) {
        clearInterval(this.pollingInterval)
        this.pollingInterval = undefined
      }

      // Stop health monitoring
      if (this.healthCheckInterval) {
        clearInterval(this.healthCheckInterval)
        this.healthCheckInterval = undefined
      }

      // Clean up cache managers
      await this.contentCache.destroy()
      await this.translationCache.destroy()

      this.isRunning = false
      
      logger.info('News Aggregator Service stopped')
    } catch (error) {
      logger.error('Error stopping News Aggregator Service:', error)
      throw error
    }
  }

  async getStatus(): Promise<{ running: boolean; modules?: Record<string, ModuleStatus> }> {
    const modules: Record<string, ModuleStatus> = {
      sourceManager: { running: true, initialized: true },
      aiProviderManager: { running: true, initialized: true },
      contentCache: { running: true, initialized: true },
      translationCache: { running: true, initialized: true },
      healthChecker: { running: true, initialized: true },
      rssProcessor: { running: true, initialized: true },
    }

    return {
      running: this.isRunning,
      modules,
    }
  }

  // Service getters for external access
  getSourceManager(): NewsSourceManager {
    return this.sourceManager
  }

  getAiProviderManager(): AiProviderManager {
    return this.aiProviderManager
  }

  getHealthChecker(): HealthChecker {
    return this.healthChecker
  }

  getRssProcessor(): RssProcessor {
    return this.rssProcessor
  }

  getContentCache(): CacheManager {
    return this.contentCache
  }

  getTranslationCache(): CacheManager<string> {
    return this.translationCache
  }

  private startContentProcessing(): void {
    const pollingInterval = config.aggregator.defaultPollingInterval
    
    // Run initial processing
    this.processContent().catch(error => {
      logger.error('Initial content processing failed:', error)
    })

    // Set up periodic processing
    this.pollingInterval = setInterval(() => {
      this.processContent().catch(error => {
        logger.error('Periodic content processing failed:', error)
      })
    }, pollingInterval)

    logger.info(`Content processing started with ${pollingInterval}ms interval`)
  }

  private startHealthMonitoring(): void {
    // Check health every 30 seconds
    const healthCheckInterval = 30000

    this.healthCheckInterval = setInterval(() => {
      this.healthChecker.getHealthStatus().catch((error: Error) => {
        logger.error('Health check failed:', error)
      })
    }, healthCheckInterval)

    logger.info(`Health monitoring started with ${healthCheckInterval}ms interval`)
  }

  private async processContent(): Promise<void> {
    try {
      logger.debug('Starting content processing cycle')
      
      // 1. Fetch content from all sources using RSS processor
      const sources = await this.sourceManager.getEnabledSources()
      const allArticles = []
      
      for (const source of sources) {
        try {
          const articles = await this.rssProcessor.processSource(source)
          allArticles.push(...articles)
        } catch (error) {
          logger.error(`Failed to process source ${source.name}:`, error)
        }
      }
      
      // 2. Basic deduplication based on URL/title
      const uniqueArticles = this.deduplicateArticles(allArticles)
      
      // 3. AI processing (summarization, translation, tagging)
      // TODO: Implement AI processing pipeline with aiProviderManager
      
      // 4. Store in database
      // TODO: Implement database storage
      
      logger.info(`Content processing cycle complete: ${uniqueArticles.length} unique articles processed`)
      
    } catch (error) {
      logger.error('Content processing cycle failed:', error)
    }
  }

  private deduplicateArticles(articles: Array<{ url: string; title: string }>): Array<{ url: string; title: string }> {
    const seen = new Set<string>()
    return articles.filter(article => {
      const key = `${article.url}|${article.title}`
      if (seen.has(key)) {
        return false
      }
      seen.add(key)
      return true
    })
  }
}