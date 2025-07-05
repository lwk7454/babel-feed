import { DatabaseSourceManager } from './db-source-manager';
import { AiProviderManager } from './ai-provider-manager';
import { HealthChecker } from './health-checker';
import { logger } from '../utils/logger';
import { config } from '../config/config';

export class NewsAggregator {
  private sourceManager: DatabaseSourceManager;
  private aiProviderManager: AiProviderManager;
  private healthChecker: HealthChecker;
  private isRunning = false;

  constructor() {
    this.sourceManager = new DatabaseSourceManager();
    this.aiProviderManager = new AiProviderManager();
    this.healthChecker = new HealthChecker(this.sourceManager, this.aiProviderManager);
  }

  async initialize(): Promise<void> {
    logger.info('Initializing News Aggregator...');

    try {
      // Initialize source manager
      await this.sourceManager.initialize();
      
      // Initialize AI provider manager
      await this.aiProviderManager.initialize();
      
      // TODO: Initialize other services
      // - RSS processor
      // - Cache manager
      // - API server

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
      // TODO: Start periodic tasks
      // - RSS polling
      // - Health monitoring
      // - Cache cleanup
      // - Background processing

      logger.info('News Aggregator services started');
    } catch (error) {
      logger.error('Failed to start News Aggregator services:', error);
      throw error;
    }
  }

  async stop(): Promise<void> {
    logger.info('Stopping News Aggregator services...');

    try {
      // TODO: Stop all services gracefully
      // - Cancel timers
      // - Finish pending operations
      // - Close connections

      // Note: DatabaseSourceManager doesn't need destroy() like the old file-based one
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
}