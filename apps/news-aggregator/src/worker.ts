#!/usr/bin/env bun
import { logger } from './modules/common/logger'
import { config } from './modules/common/config'
import { ensureDbConnection } from './modules/common/db'
import { NewsAggregatorService } from './services/news-aggregator-service'

async function main() {
  try {
    logger.info('Starting News Aggregator Worker...')
    
    // Initialize database connection
    await ensureDbConnection()
    
    // Start aggregator/worker service
    const aggregatorService = new NewsAggregatorService()
    await aggregatorService.initialize()
    await aggregatorService.start()
    
    logger.info('News Aggregator Worker started successfully')
    logger.info(`Worker running in ${config.environment} mode`)
    
    // Log initial status
    const status = await aggregatorService.getStatus()
    logger.info('Initial status:', {
      running: status.running,
      modules: Object.keys(status.modules || {}),
    })
    
  } catch (error) {
    logger.error('Failed to start News Aggregator Worker:', error)
    process.exit(1)
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  logger.info('Received SIGINT, shutting down gracefully...')
  process.exit(0)
})

process.on('SIGTERM', () => {
  logger.info('Received SIGTERM, shutting down gracefully...')
  process.exit(0)
})

main().catch((error) => {
  logger.error('Unhandled error in worker:', error)
  process.exit(1)
})