import { logger } from '@babel-feed/utils'
import { ModuleStatus } from '../modules/common/types'

// Source Manager modules
import { SourceDiscoveryService } from '../modules/source-manager/discovery'
import { HealthMonitorService } from '../modules/source-manager/health-monitor'
import { SourceCRUDService } from '../modules/source-manager/source-crud'

// Aggregator modules
import { AIIntegrationService } from '../modules/aggregator/ai-integration'
import { DeduplicationService } from '../modules/aggregator/deduplication'
import { FetcherService } from '../modules/aggregator/fetcher'
import { ProcessorService } from '../modules/aggregator/processor'

// Working service managers (for immediate functionality)
import { AiProviderManager } from '@babel-feed/llm-provider'
import { getDatabase } from '@babel-feed/pgdb'
import { ArticleStorage } from './article-storage'
import { CacheManager } from './cache-manager'
import { HealthChecker } from './health-checker'
import { JobScheduler } from './job-scheduler'
import { NewsSourceManager } from './news-source-manager'
import { RssProcessor } from './rss-processor'

export class NewsAggregatorService {
  // Future modules (placeholder implementations)
  private sourceCRUD: SourceCRUDService
  private healthMonitor: HealthMonitorService
  private sourceDiscovery: SourceDiscoveryService
  private fetcher: FetcherService
  private processor: ProcessorService
  private aiIntegration: AIIntegrationService
  private deduplication: DeduplicationService

  // Working service managers (for current functionality)
  private sourceManager: NewsSourceManager
  private aiProviderManager: AiProviderManager
  private contentCache: CacheManager
  private translationCache: CacheManager<string>
  private healthChecker: HealthChecker
  private rssProcessor: RssProcessor
  private articleStorage: ArticleStorage
  private jobScheduler: JobScheduler
  
  // Service state
  private isRunning = false

  constructor() {
    // Initialize future modules (placeholders)
    this.sourceCRUD = new SourceCRUDService()
    this.healthMonitor = new HealthMonitorService()
    this.sourceDiscovery = new SourceDiscoveryService()
    this.fetcher = new FetcherService()
    this.processor = new ProcessorService()
    this.aiIntegration = new AIIntegrationService()
    this.deduplication = new DeduplicationService()

    // Initialize working service managers
    this.sourceManager = new NewsSourceManager()
    this.aiProviderManager = new AiProviderManager()
    this.contentCache = CacheManager.createContentCache()
    this.translationCache = CacheManager.createTranslationCache()
    this.healthChecker = new HealthChecker(this.sourceManager, this.aiProviderManager)
    this.rssProcessor = new RssProcessor(this.sourceManager)
    this.articleStorage = new ArticleStorage()
    this.jobScheduler = new JobScheduler()
  }

  async initialize(): Promise<void> {
    logger.info('Initializing News Aggregator Service...')

    try {
      // Initialize placeholder modules
      await this.sourceCRUD.initialize()
      await this.healthMonitor.initialize()
      await this.sourceDiscovery.initialize()
      await this.fetcher.initialize()
      await this.processor.initialize()
      await this.aiIntegration.initialize()
      await this.deduplication.initialize()

      // Initialize working services
      await this.sourceManager.initialize()
      await this.aiProviderManager.initialize()
      await this.jobScheduler.initialize()
      // article storage requires no explicit initialization
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
      // Start the job scheduler (replaces old monolithic processing)
      await this.jobScheduler.start()

      logger.info('News Aggregator Service started with job scheduler')
    } catch (error) {
      logger.error('Failed to start News Aggregator Service:', error)
      throw error
    }
  }

  async stop(): Promise<void> {
    logger.info('Stopping News Aggregator Service...')

    try {
      // Stop the job scheduler
      await this.jobScheduler.stop()

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
      // Placeholder modules
      sourceCRUD: { running: true, initialized: true },
      healthMonitor: { running: true, initialized: true },
      sourceDiscovery: (this.sourceDiscovery?.getStatus && this.sourceDiscovery.getStatus().running) ? 
        { running: true, initialized: true } : 
        { running: false, initialized: true },
      fetcher: { running: true, initialized: true },
      processor: (this.processor?.getStatus && this.processor.getStatus().running) ? 
        { running: true, initialized: true } : 
        { running: false, initialized: true },
      aiIntegration: { running: true, initialized: true },
      deduplication: { running: true, initialized: true },
      
      // Working services
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

  // Module getters for external access (future implementations)
  getSourceCRUD(): SourceCRUDService {
    return this.sourceCRUD
  }

  getHealthMonitor(): HealthMonitorService {
    return this.healthMonitor
  }

  getSourceDiscovery(): SourceDiscoveryService {
    return this.sourceDiscovery
  }

  getFetcher(): FetcherService {
    return this.fetcher
  }

  getProcessor(): ProcessorService {
    return this.processor
  }

  getAIIntegration(): AIIntegrationService {
    return this.aiIntegration
  }

  getDeduplication(): DeduplicationService {
    return this.deduplication
  }

  // Working service getters (current functionality)
  getSourceManager(): NewsSourceManager {
    return this.sourceManager
  }

  getAiProviderManager(): AiProviderManager {
    return this.aiProviderManager
  }

  getHealthChecker(): HealthChecker {
    return this.healthChecker
  }

  getDatabase() {
    return getDatabase()
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

  getJobScheduler(): JobScheduler {
    return this.jobScheduler
  }
}