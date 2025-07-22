import { getDatabase, checkDatabaseHealth } from '@babel-feed/pgdb'
import { logger } from '@babel-feed/utils'

export * from '@babel-feed/pgdb'

export async function ensureDbConnection(): Promise<void> {
  try {
    // Get the database instance (this will initialize it if needed)
    getDatabase()
    
    // Check if the connection is healthy
    const health = await checkDatabaseHealth()
    if (!health.healthy) {
      throw new Error(`Database health check failed: ${health.error}`)
    }
    
    logger.info('Database connection established')
  } catch (error) {
    logger.error('Database connection failed:', error)
    throw error
  }
}