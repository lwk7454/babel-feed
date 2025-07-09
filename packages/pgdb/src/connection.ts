import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import dotenv from 'dotenv'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema.js'

// Always load .env from the pgdb root, regardless of where this is imported from
const __dirname = dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: resolve(__dirname, '../.env') })

/**
 * Database connection configuration based on environment
 */
const isDevelopment = process.env.NODE_ENV === 'development' || !process.env.NODE_ENV
const isProduction = process.env.NODE_ENV === 'production'
const isTest = process.env.NODE_ENV === 'test'

/**
 * Database connection URL configuration
 */
function getDatabaseUrl(): string {
  if (isTest) {
    return process.env.DATABASE_URL_TEST || ''
  }
  return process.env.DATABASE_URL || ''
}

/**
 * PostgreSQL connection configuration
 */
function createPostgresConnection() {
  const connectionString = getDatabaseUrl()

  const sql = postgres(connectionString, {
    max: process.env.DB_POOL_SIZE ? parseInt(process.env.DB_POOL_SIZE) : 10,
    idle_timeout: 20,
    max_lifetime: 60 * 30, // 30 minutes
    connect_timeout: 10,
    prepare: false, // Disable prepared statements for better compatibility
    debug: isDevelopment && process.env.DB_DEBUG === 'true',
    onnotice: isDevelopment && !isTest ? console.log : undefined
  })

  return drizzle(sql, { schema, logger: isDevelopment })
}

/**
 * Database connection singleton
 */
let dbInstance: ReturnType<typeof createPostgresConnection> | null = null

export function getDatabase() {
  if (!dbInstance) {
    try {
      dbInstance = createPostgresConnection()
      const envType = isProduction ? 'production' : isTest ? 'test' : 'development'
      if (!isTest) {
        console.log(`🗄️  Database connection established (${envType})`)
      }
    } catch (error) {
      console.error('❌ Failed to connect to database:', error)
      throw new Error('Database connection failed')
    }
  }

  return dbInstance
}

/**
 * Health check for database connection
 */
export async function checkDatabaseHealth(): Promise<{ healthy: boolean; error?: string }> {
  try {
    const db = getDatabase()

    // Simple query to check connection
    await db.execute('SELECT 1')

    return { healthy: true }
  } catch (error) {
    if (!isTest) {
      console.error('Database health check failed:', error)
    }
    return {
      healthy: false,
      error: error instanceof Error ? error.message : 'Unknown database error'
    }
  }
}

/**
 * Graceful database connection shutdown
 */
export async function closeDatabaseConnection(): Promise<void> {
  if (dbInstance) {
    try {
      // The postgres client doesn't have an explicit close method in the newer versions
      // The connection will be closed when the process exits
      dbInstance = null
      console.log('🗄️  Database connection closed')
    } catch (error) {
      console.error('Error closing database connection:', error)
    }
  }
}


// Export the database instance as default
export const db = getDatabase()
export default db