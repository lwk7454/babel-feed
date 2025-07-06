import { logger } from '../modules/common/logger'
import { config } from '../modules/common/config'
import { ModuleStatus } from '../modules/common/types'

// Source Manager modules
import { SourceCRUDService } from '../modules/source-manager/source-crud'
import { HealthMonitorService } from '../modules/source-manager/health-monitor'
import { SourceDiscoveryService } from '../modules/source-manager/discovery'

// Aggregator modules
import { FetcherService } from '../modules/aggregator/fetcher'
import { ProcessorService } from '../modules/aggregator/processor'
import { AIIntegrationService } from '../modules/aggregator/ai-integration'
import { DeduplicationService } from '../modules/aggregator/deduplication'

// Legacy services for backward compatibility
import { CacheManager } from './cache-manager'

export class NewsAggregatorService {
  // Source Manager modules
  private sourceCRUD: SourceCRUDService
  private healthMonitor: HealthMonitorService
  private sourceDiscovery: SourceDiscoveryService

  // Aggregator modules
  private fetcher: FetcherService
  private processor: ProcessorService
  private aiIntegration: AIIntegrationService
  private deduplication: DeduplicationService

  // Legacy services for backward compatibility
  private contentCache: CacheManager
  private translationCache: CacheManager<string>
  
  // Legacy service instances (lazy-loaded when needed)
  private legacySourceManager?: any
  private legacyAiProviderManager?: any
  private legacyHealthChecker?: any
  private legacyRssProcessor?: any

  // Service state
  private isRunning = false
  private pollingInterval?: NodeJS.Timeout
  private healthCheckInterval?: NodeJS.Timeout

  constructor() {
    // Initialize source manager modules
    this.sourceCRUD = new SourceCRUDService()
    this.healthMonitor = new HealthMonitorService()
    this.sourceDiscovery = new SourceDiscoveryService()

    // Initialize aggregator modules
    this.fetcher = new FetcherService()
    this.processor = new ProcessorService()
    this.aiIntegration = new AIIntegrationService()
    this.deduplication = new DeduplicationService()

    // Initialize legacy services for backward compatibility
    this.contentCache = CacheManager.createContentCache()
    this.translationCache = CacheManager.createTranslationCache()
  }

  async initialize(): Promise<void> {
    logger.info('Initializing News Aggregator Service...')

    try {
      // Initialize all modules
      await this.sourceCRUD.initialize()
      await this.healthMonitor.initialize()
      await this.sourceDiscovery.initialize()
      await this.fetcher.initialize()
      await this.processor.initialize()
      await this.aiIntegration.initialize()
      await this.deduplication.initialize()

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
      
      // Start source discovery (optional)
      await this.sourceDiscovery.startDiscovery()

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

      // Stop source discovery
      await this.sourceDiscovery.stopDiscovery()

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
      sourceCRUD: { running: true, initialized: true },
      healthMonitor: { running: true, initialized: true },
      sourceDiscovery: this.sourceDiscovery.getStatus().running ? 
        { running: true, initialized: true } : 
        { running: false, initialized: true },
      fetcher: { running: true, initialized: true },
      processor: this.processor.getStatus().running ? 
        { running: true, initialized: true } : 
        { running: false, initialized: true },
      aiIntegration: { running: true, initialized: true },
      deduplication: { running: true, initialized: true },
    }

    return {
      running: this.isRunning,
      modules,
    }
  }

  // Module getters for external access
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

  // Legacy methods for backward compatibility (lazy-loaded)
  getSourceManager() {
    if (!this.legacySourceManager) {
      // Import and instantiate only when needed
      const { NewsSourceManager } = require('./news-source-manager')
      this.legacySourceManager = new NewsSourceManager()
      // Initialize if not already done
      if (!this.legacySourceManager.initialized) {
        this.legacySourceManager.initialize().catch(console.error)
      }
    }
    return this.legacySourceManager
  }

  getAiProviderManager() {
    if (!this.legacyAiProviderManager) {
      const { AiProviderManager } = require('./ai-provider-manager')
      this.legacyAiProviderManager = new AiProviderManager()
      if (!this.legacyAiProviderManager.initialized) {
        this.legacyAiProviderManager.initialize().catch(console.error)
      }
    }
    return this.legacyAiProviderManager
  }

  getHealthChecker() {
    if (!this.legacyHealthChecker) {
      const { HealthChecker } = require('./health-checker')
      this.legacyHealthChecker = new HealthChecker(
        this.getSourceManager(),
        this.getAiProviderManager()
      )
    }
    return this.legacyHealthChecker
  }

  getRssProcessor() {
    if (!this.legacyRssProcessor) {
      const { RssProcessor } = require('./rss-processor')
      this.legacyRssProcessor = new RssProcessor(this.getSourceManager())
    }
    return this.legacyRssProcessor
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
      this.healthMonitor.getHealthStatus().catch(error => {
        logger.error('Health check failed:', error)
      })
    }, healthCheckInterval)

    logger.info(`Health monitoring started with ${healthCheckInterval}ms interval`)
  }

  private async processContent(): Promise<void> {
    try {
      logger.debug('Starting content processing cycle')
      
      // 1. Fetch content from all sources
      const fetchResult = await this.fetcher.fetchFromAllSources()
      
      // 2. Process articles (validation, normalization, etc.)
      const processedArticles = await this.processor.processArticles(fetchResult.articles || [])
      
      // 3. Deduplicate articles
      const deduplicatedArticles = await this.deduplication.deduplicateArticles(processedArticles)
      
      // 4. AI processing (summarization, translation, tagging)
      // TODO: Implement AI processing pipeline
      
      // 5. Store in database
      // TODO: Implement database storage
      
      logger.info(`Content processing cycle complete: ${deduplicatedArticles.length} unique articles processed`)
      
    } catch (error) {
      logger.error('Content processing cycle failed:', error)
    }
  }
}