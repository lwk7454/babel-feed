import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import dotenv from 'dotenv'
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { PGlite } from '@electric-sql/pglite'
import { drizzle as drizzlePglite } from 'drizzle-orm/pglite'
import * as schema from './schema.js'
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import type { PgliteDatabase } from 'drizzle-orm/pglite'

/**
 * Union type for database instance (Postgres or PGlite)
 */
export type DatabaseInstance =
  | PostgresJsDatabase<typeof schema>
  | PgliteDatabase<typeof schema>

// Always load .env from the pgdb root, regardless of where this is imported from
const __dirname = dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: resolve(__dirname, '../.env') })

/**
 * Database connection configuration based on environment
 */
const isDevelopment = process.env.NODE_ENV === 'development' || !process.env.NODE_ENV
// const isProduction = process.env.NODE_ENV === 'production'
const isTest = process.env.NODE_ENV === 'test'


/**
 * Database connection singleton
 */
let dbInstance: DatabaseInstance | null = null

/**
 * Create a Postgres connection (for dev/prod)
 */
function createPostgresConnection() {
  const connectionString = process.env.DATABASE_URL || ''
  const sql = postgres(connectionString, {
    max: process.env.DB_POOL_SIZE ? parseInt(process.env.DB_POOL_SIZE) : 10,
    idle_timeout: 20,
    max_lifetime: 60 * 30, // 30 minutes
    connect_timeout: 10,
    prepare: false, // Disable prepared statements for better compatibility
    debug: false
  })
  return drizzlePostgres(sql, { schema, logger: false })
}

/**
 * Create an in-memory PGlite (Postgres in WASM) connection for tests
 * Returns a fresh instance to avoid memory corruption issues
 */
function createPgLiteTestConnection() {
  const pglite = new PGlite()
  return drizzlePglite(pglite, { schema })
}

export function getDatabase() {
  if (!dbInstance) {
    dbInstance = isTest ? createPgLiteTestConnection() : createPostgresConnection()
  }
  return dbInstance
}

/**
 * Close and cleanup database connection
 * Essential for PGLite to prevent memory leaks
 */
export async function closeDatabaseConnection() {
  if (dbInstance) {
    if (isTest && '$client' in dbInstance && typeof dbInstance.$client.close === 'function') {
      await dbInstance.$client.close()
    }
    dbInstance = null
  }
}

/**
 * Reset database connection (for tests)
 * Creates fresh PGLite instance to avoid corruption
 */
export function resetDatabaseConnection() {
  if (isTest) {
    dbInstance = null // Will create fresh instance on next getDatabase() call
  }
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
