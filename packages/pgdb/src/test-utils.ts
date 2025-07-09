/**
 * Test utilities for database operations
 * Provides utilities for test database setup, cleanup, and management
 */

import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import dotenv from 'dotenv'
import postgres from 'postgres'
import * as schema from './schema.js'
import {
  articles,
  articleTranslations,
  users
} from './schema.js'

// Always load .env from the pgdb root, regardless of where this is imported from
const __dirname = dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: resolve(__dirname, '../.env') })

export interface TestDbConfig {
  max?: number
  idle_timeout?: number
  connect_timeout?: number
  prepare?: boolean
  ssl?: boolean
}

export const defaultTestDbConfig: TestDbConfig = {
  max: 1,
  idle_timeout: 1,
  connect_timeout: 10,
  prepare: false
}

let testDb: ReturnType<typeof drizzle> | null = null
let sql: ReturnType<typeof postgres> | null = null

/**
 * Setup test database connection and run migrations
 */
export async function setupTestDatabase(config: TestDbConfig = defaultTestDbConfig): Promise<ReturnType<typeof drizzle>> {
  try {
    const connectionString = process.env.DATABASE_URL_TEST
    if (!connectionString) {
      throw new Error('DATABASE_URL is not set')
    }

    // Ensure test database exists before connecting
    // await createTestDatabaseIfNotExists()

    // Skip database creation - assume it already exists
    console.log(`🔌 Connecting to test database`)

    // Create SQL connection
    sql = postgres(connectionString, {
      max: config.max || 1,
      idle_timeout: config.idle_timeout || 1,
      connect_timeout: config.connect_timeout || 10,
      prepare: config.prepare || false,
      onnotice: () => {
        // Suppress notices in tests
      }
    })

    // Create Drizzle instance
    testDb = drizzle(sql, { schema })

    // Run migrations to ensure schema is up to date
    const migrationsPath = resolve(__dirname, '../migrations')
    console.log(`🔄 Running migrations from: ${migrationsPath}`)

    try {
      await migrate(testDb, { migrationsFolder: migrationsPath })
      console.log('✅ Migrations completed successfully')
    } catch (migrationError) {
      console.log('⚠️  Migration error:', migrationError)
    }

    // Verify database health
    const health = await testDatabaseHealth()
    if (!health.healthy) {
      throw new Error(`Test database health check failed: ${health.error}`)
    }

    console.log('✅ Test database setup completed successfully')
    return testDb

  } catch (error) {
    console.error('❌ Test database setup failed:', error)
    throw error
  }
}

/**
 * Create test database if it doesn't exist
 */
export async function createTestDatabaseIfNotExists(): Promise<void> {
  // Connect to postgres database to create test database
  let adminConnectionString = process.env.DATABASE_URL_TEST
  if (!adminConnectionString) {
    throw new Error('DATABASE_URL is not set')
  }
  const url = new URL(adminConnectionString)
  const dbName = url.pathname.replace(/^\//, '')
  url.pathname = '/'
  adminConnectionString = url.toString()

  const adminSql = postgres(adminConnectionString, {
    max: 1,
    idle_timeout: 1,
    connect_timeout: 10,
    prepare: false,
    onnotice: () => {
      // Suppress notices
    }
  })

  try {
    // Check if database exists
    const result = await adminSql`
      SELECT 1 FROM pg_database WHERE datname = ${dbName}
    `

    if (result.length === 0) {
      // Database doesn't exist, create it
      await adminSql.unsafe(`CREATE DATABASE "${dbName}"`)
      console.log(`✅ Created test database: ${dbName}`)
    } else {
      console.log(`✅ Test database already exists: ${dbName}`)
    }
  } catch (error) {
    console.error('❌ Error creating test database:', error)
    throw error
  } finally {
    await adminSql.end()
  }
}

/**
 * Cleanup test database connection
 */
export async function cleanupTestDatabase(): Promise<void> {
  if (sql) {
    await sql.end()
    sql = null
    testDb = null
  }
}

/**
 * Clear all test data from database tables
 */
export async function clearTestData(): Promise<void> {
  if (!sql) {
    throw new Error('Test database not initialized. Call setupTestDatabase() first.')
  }

  // Get all user tables in the public schema
  const result = await sql`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public'
  `
  const tableNames = (result as unknown as Array<{ tablename: string }>).map(row => `"${row.tablename}"`)

  if (tableNames.length === 0) return

  // Truncate all tables, restart identity, cascade
  const truncateQuery = `TRUNCATE TABLE ${tableNames.join(', ')} RESTART IDENTITY CASCADE;`
  await sql.unsafe(truncateQuery)
}

/**
 * Get the test database instance
 */
export function getTestDb(): ReturnType<typeof drizzle> {
  if (!testDb) {
    throw new Error('Test database not initialized. Call setupTestDatabase() first.')
  }
  return testDb
}

/**
 * Insert test user data
 */
export async function insertTestUser(userData: Partial<typeof users.$inferInsert> = {}) {
  const testDb = getTestDb()

  const defaultUser = {
    email: 'test@example.com',
    emailVerified: false,
    userStatus: 'guest' as const,
    ...userData
  }

  const [user] = await testDb.insert(users).values(defaultUser).returning()
  return user
}

/**
 * Insert test article data with translations
 */
export async function insertTestArticle(
  articleData: Partial<typeof articles.$inferInsert> = {},
  translationData: Partial<typeof articleTranslations.$inferInsert>[] = []
) {
  const testDb = getTestDb()

  const defaultArticle = {
    url: 'https://example.com/test-article',
    source: 'test-source',
    sourceLanguage: 'en' as const,
    ...articleData
  }

  const [article] = await testDb.insert(articles).values(defaultArticle).returning()

  // Insert default translation if none provided
  if (translationData.length === 0) {
    const defaultTranslation = {
      articleId: article.id,
      language: 'en' as const,
      title: 'Test Article',
      summary: 'Test article summary'
    }

    await testDb.insert(articleTranslations).values(defaultTranslation)
  } else {
    // Insert provided translations
    const translations = translationData.map(translation => ({
      articleId: article.id,
      language: 'en' as const,
      title: 'Test Article',
      summary: 'Test article summary',
      ...translation
    }))

    await testDb.insert(articleTranslations).values(translations)
  }

  return article
}

/**
 * Insert test article translation
 */
export async function insertTestArticleTranslation(translationData: Partial<schema.NewArticleTranslation> = {}) {
  const testDb = getTestDb()

  const defaultTranslation = {
    language: 'en' as const,
    title: 'Test Translation Title',
    summary: 'Test translation summary',
    ...translationData
  }

  const [translation] = await testDb.insert(articleTranslations).values(defaultTranslation as schema.NewArticleTranslation).returning()
  return translation
}

/**
 * Test database health check
 */
export async function testDatabaseHealth(): Promise<{ healthy: boolean; error?: string }> {
  try {
    if (!testDb) {
      return { healthy: false, error: 'Test database not initialized' }
    }

    // Simple query to check connection
    console.log('🔍 Testing database connection...')
    await testDb.select().from(users).limit(1)
    console.log('✅ Database connection successful')
    return { healthy: true }
  } catch (error) {
    console.error('❌ Database health check failed:', error)
    return {
      healthy: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

/**
 * Get test database connection info
 */
export function getTestDbInfo(): TestDbConfig {
  return { ...defaultTestDbConfig }
}