import { DatabaseSourceManager } from './db-source-manager';
import { AiProviderManager } from './ai-provider-manager';
import { HealthChecker } from './health-checker';
import { RssProcessor } from './rss-processor';
import { CacheManager } from './cache-manager';
import { logger } from '../utils/logger';
import { config } from '../config/config';

export class NewsAggregator {
  private sourceManager: DatabaseSourceManager;
  private aiProviderManager: AiProviderManager;
  private healthChecker: HealthChecker;
  private rssProcessor: RssProcessor;
  private contentCache: CacheManager;
  private translationCache: CacheManager<string>;
  private isRunning = false;
  private pollingInterval?: NodeJS.Timeout;
  private healthCheckInterval?: NodeJS.Timeout;

  constructor() {
    this.sourceManager = new DatabaseSourceManager();
    this.aiProviderManager = new AiProviderManager();
    this.healthChecker = new HealthChecker(this.sourceManager, this.aiProviderManager);
    this.rssProcessor = new RssProcessor(this.sourceManager);
    this.contentCache = CacheManager.createContentCache();
    this.translationCache = CacheManager.createTranslationCache();
  }

  async initialize(): Promise<void> {
    logger.info('Initializing News Aggregator...');

    try {
      // Initialize source manager
      await this.sourceManager.initialize();
      
      // Initialize AI provider manager
      await this.aiProviderManager.initialize();
      
      // Initialize cache managers (already initialized in constructor)
      logger.info('Cache managers initialized');

      this.isRunning = true;
      logger.info('News Aggregator initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize News Aggregator:', error);
      throw error;
    }
  }

  async start(): Promise<void> {
    if (!this.isRunning) {
      throw new Error('Aggregator must be initialized before starting');
    }

    logger.info('Starting News Aggregator services...');

    try {
      // Start RSS polling
      this.startRssPolling();
      
      // Start health monitoring
      this.startHealthMonitoring();
      
      // Cache cleanup is handled automatically by CacheManager

      logger.info('News Aggregator services started');
    } catch (error) {
      logger.error('Failed to start News Aggregator services:', error);
      throw error;
    }
  }

  async stop(): Promise<void> {
    logger.info('Stopping News Aggregator services...');

    try {
      // Stop RSS polling
      if (this.pollingInterval) {
        clearInterval(this.pollingInterval);
        this.pollingInterval = undefined;
      }

      // Stop health monitoring
      if (this.healthCheckInterval) {
        clearInterval(this.healthCheckInterval);
        this.healthCheckInterval = undefined;
      }

      // Clean up cache managers
      await this.contentCache.destroy();
      await this.translationCache.destroy();

      this.isRunning = false;
      
      logger.info('News Aggregator services stopped');
    } catch (error) {
      logger.error('Error stopping News Aggregator services:', error);
      throw error;
    }
  }

  getSourceManager(): DatabaseSourceManager {
    return this.sourceManager;
  }

  getAiProviderManager(): AiProviderManager {
    return this.aiProviderManager;
  }

  getHealthChecker(): HealthChecker {
    return this.healthChecker;
  }

  async getStatus() {
    return {
      running: this.isRunning,
      health: await this.healthChecker.getHealthStatus(),
      config: {
        environment: config.environment,
        logLevel: config.logLevel,
        pollingInterval: config.aggregator.defaultPollingInterval,
        maxConcurrentSources: config.aggregator.maxConcurrentSources,
      },
    };
  }

  private startRssPolling(): void {
    const pollingInterval = config.aggregator.defaultPollingInterval;
    
    // Run initial processing
    this.processAllSources().catch(error => {
      logger.error('Initial RSS processing failed:', error);
    });

    // Set up periodic processing
    this.pollingInterval = setInterval(() => {
      this.processAllSources().catch(error => {
        logger.error('Periodic RSS processing failed:', error);
      });
    }, pollingInterval);

    logger.info(`RSS polling started with ${pollingInterval}ms interval`);
  }

  private startHealthMonitoring(): void {
    // Check health every 30 seconds
    const healthCheckInterval = 30000;

    this.healthCheckInterval = setInterval(() => {
      this.healthChecker.getHealthStatus().catch(error => {
        logger.error('Health check failed:', error);
      });
    }, healthCheckInterval);

    logger.info(`Health monitoring started with ${healthCheckInterval}ms interval`);
  }

  private async processAllSources(): Promise<void> {
    try {
      logger.debug('Starting RSS processing cycle');
      const result = await this.rssProcessor.processAllSources();
      
      logger.info(`RSS processing cycle complete: ${result.processed} sources, ${result.articles.length} articles, ${result.errors} errors`);
      
      // TODO: Send articles to AI processing pipeline
      // TODO: Store processed articles in database
    } catch (error) {
      logger.error('RSS processing cycle failed:', error);
    }
  }

  // Getter methods for external access
  getRssProcessor(): RssProcessor {
    return this.rssProcessor;
  }

  getContentCache(): CacheManager {
    return this.contentCache;
  }

  getTranslationCache(): CacheManager<string> {
    return this.translationCache;
  }
}