#!/usr/bin/env bun
/**
 * Initialize default job configurations in the database
 * This script should be run after the database migration to ensure
 * all default jobs are properly configured in the database.
 */

import { JobDatabaseServiceImpl } from '../services/job-db'
import { logger } from '@babel-feed/utils'

async function initializeJobs(): Promise<void> {
  const jobDb = new JobDatabaseServiceImpl()
  
  try {
    logger.info('Initializing job database service...')
    await jobDb.initialize()
    
    logger.info('Populating default job configurations...')
    await jobDb.initializeDefaultJobs()
    
    logger.info('✅ Default job configurations initialized successfully')
    
    // List all jobs to verify
    const configs = await jobDb.getJobConfigs()
    logger.info(`📋 Total jobs configured: ${configs.length}`)
    
    for (const config of configs) {
      logger.info(`  - ${config.name}: ${config.enabled ? '✅ enabled' : '❌ disabled'} (${config.interval}ms interval)`)
    }
    
  } catch (error) {
    logger.error('❌ Failed to initialize jobs:', error)
    process.exit(1)
  }
  
  logger.info('🎉 Job initialization completed successfully')
  process.exit(0)
}

// Run if called directly
if (import.meta.main) {
  initializeJobs()
}