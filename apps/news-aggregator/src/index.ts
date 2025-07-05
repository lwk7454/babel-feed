import { initializeDatabase } from '../../../packages/pgdb/src';
import { logger } from './utils/logger';
import { config } from './config/config';
import { NewsAggregator } from './services/aggregator';

async function main() {
  try {
    logger.info('Starting News Aggregator Service...');
    
    // Initialize database connection
    await initializeDatabase();
    logger.info('Database connection established');
    
    // Initialize aggregator service
    const aggregator = new NewsAggregator();
    await aggregator.initialize();
    await aggregator.start();
    
    logger.info('News Aggregator Service started successfully');
    logger.info(`Service running in ${config.environment} mode`);
    
    // Log initial status
    const status = await aggregator.getStatus();
    logger.info('Initial status:', {
      running: status.running,
      sources: status.health.summary.totalSources,
      healthySources: status.health.summary.healthySources,
    });
    
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