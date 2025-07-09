/**
 * Test utilities for database operations
 * Provides utilities for test database setup, cleanup, and management
 */

import { PGlite } from '@electric-sql/pglite'
import { drizzle as drizzlePglite, PgliteDatabase } from 'drizzle-orm/pglite'
import * as schema from './schema.js'
import {
  articles,
  articleTranslations,
  users
} from './schema.js'
import { migrate } from 'drizzle-orm/pglite/migrator.js'
import { resolve } from 'path'


let testDb: PgliteDatabase<typeof schema> | null = null
let pglite: PGlite | null = null

/**
 * Setup test database connection and run migrations (PGlite only)
 */
export async function setupTestDatabase(): Promise<PgliteDatabase<typeof schema>> {
  pglite = new PGlite()
  await pglite.ready
  testDb = drizzlePglite({ client: pglite, schema })

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
}

/**
 * Cleanup test database connection
 */
export async function cleanupTestDatabase(): Promise<void> {
  if (pglite) {
    await pglite.close()
    pglite = null
    testDb = null
  }
}

/**
 * Clear all test data from database tables (PGlite version)
 */
export async function clearTestData(): Promise<void> {
  if (!testDb) {
    throw new Error('Test database not initialized. Call setupTestDatabase() first.')
  }
  // Dynamically fetch all user table names (excluding SQLite system tables)
  const tablesResult = await testDb.execute(
    `SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%';`
  )
  type TableRow = { name: string }
  const tableNames = (tablesResult.rows as TableRow[]).map(row => row.name)
  if (tableNames.length === 0) return
  // Build and execute TRUNCATE statement for all tables
  const truncateSQL =
    'DELETE FROM ' + tableNames.map(name => `"${name}"`).join('; DELETE FROM ') + ';'
  await testDb.execute(truncateSQL)
}

/**
 * Get the test database instance
 */
export function getTestDb(): PgliteDatabase<typeof schema> {
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
