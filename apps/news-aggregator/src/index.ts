#!/usr/bin/env bun
import { logger } from './modules/common/logger';
import { config } from './modules/common/config';
import { ensureDbConnection } from './modules/common/db';
import { NewsAggregatorService } from './services/news-aggregator-service';
import { AdminAPIServer } from './api/admin-api';

interface StartupOptions {
  api?: boolean;
  worker?: boolean;
  all?: boolean;
}

async function parseArgs(): Promise<StartupOptions> {
  const args = process.argv.slice(2);
  const options: StartupOptions = {};

  for (const arg of args) {
    switch (arg) {
      case '--api':
        options.api = true;
        break;
      case '--worker':
        options.worker = true;
        break;
      case '--all':
        options.all = true;
        break;
      default:
        logger.warn(`Unknown argument: ${arg}`);
    }
  }

  // Default to all if no specific options
  if (!options.api && !options.worker) {
    options.all = true;
  }

  return options;
}

async function main() {
  try {
    logger.info('Starting News Aggregator Service...');
    
    const options = await parseArgs();
    logger.info('Startup options:', options);

    // Initialize database connection
    await ensureDbConnection();
    
    // Initialize services based on options
    let aggregatorService: NewsAggregatorService | undefined;
    let apiServer: AdminAPIServer | undefined;

    if (options.all || options.worker) {
      // Start aggregator/worker service
      aggregatorService = new NewsAggregatorService();
      await aggregatorService.initialize();
      await aggregatorService.start();
      logger.info('News aggregator worker started');
    }

    if (options.all || options.api) {
      // Start admin API server
      apiServer = new AdminAPIServer();
      await apiServer.initialize();
      await apiServer.start();
      logger.info('Admin API server started');
    }
    
    logger.info('News Aggregator Service started successfully');
    logger.info(`Service running in ${config.environment} mode`);
    
    // Log status if aggregator is running
    if (aggregatorService) {
      const status = await aggregatorService.getStatus();
      logger.info('Initial status:', {
        running: status.running,
        modules: Object.keys(status.modules || {}),
      });
    }
    
  } catch (error) {
    logger.error('Failed to start News Aggregator Service:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  logger.info('Received SIGINT, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  logger.info('Received SIGTERM, shutting down gracefully...');
  process.exit(0);
});

main().catch((error) => {
  logger.error('Unhandled error in main:', error);
  process.exit(1);
});