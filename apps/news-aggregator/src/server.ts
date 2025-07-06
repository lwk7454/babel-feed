#!/usr/bin/env bun
import { logger } from './modules/common/logger'
import { config } from './modules/common/config'
import { ensureDbConnection } from './modules/common/db'
import { AdminAPIServer } from './api/admin-api'

async function main() {
  try {
    logger.info('Starting News Aggregator Admin API Server...')
    
    // Initialize database connection
    await ensureDbConnection()
    
    // Start admin API server
    const apiServer = new AdminAPIServer()
    await apiServer.initialize()
    await apiServer.start()
    
    logger.info('News Aggregator Admin API Server started successfully')
    logger.info(`Server running in ${config.environment} mode`)
    
  } catch (error) {
    logger.error('Failed to start News Aggregator Admin API Server:', error)
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
  logger.error('Unhandled error in server:', error)
  process.exit(1)
})