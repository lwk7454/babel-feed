#!/usr/bin/env bun

/**
 * Test utilities for database operations
 * Uses migration-based approach for test database setup
 * Generates fresh migrations from dev schema and applies them to PGlite
 */

import { sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/pglite'
import { migrate } from 'drizzle-orm/pglite/migrator'
import { existsSync } from 'fs'
import path from 'path'
import { getDatabase } from './connection.js'
import * as schema from './schema.js'
import { PgTable } from 'drizzle-orm/pg-core'

// Use the singleton database connection
let testDb: ReturnType<typeof drizzle<typeof schema>> | null = null

/**
 * Setup test database connection (PGlite only)
 * Uses singleton database and applies migrations only once
 * This ensures test DB perfectly matches dev DB structure
 */
export async function setupTestDatabase(){
  if (testDb) {
    return // Already setup
  }
  
  // Get the singleton database connection
  testDb = getDatabase() as ReturnType<typeof drizzle<typeof schema>>
  
  // Apply migrations only once for the singleton database
  const migrationsFolder = path.resolve(__dirname, '../test-migrations')
    
  if (!existsSync(migrationsFolder)) {
    throw new Error('Test migrations folder not found. Migration generation may have failed.')
  }
  
  await migrate(testDb, { migrationsFolder })
  console.log('✅ Test database migrations applied successfully')
}

/**
 * Clear all test data from database tables
 * Uses schema as single source of truth for table discovery
 */
export async function clearTestData(): Promise<void> {
  const db = getTestDb()
  
  try {
    // Get all table names from the schema - single source of truth
    const tables = Object.values(schema).filter(item =>
      item && 
      typeof item === "object" && 
      'getSQL' in item &&
      typeof item.getSQL === 'function'
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ) as any[]
    
    if (tables.length === 0) {
      console.warn('No tables found in schema for clearing')
      return
    }

    // Extract table names from schema objects
    const tableNames = tables
      .map(table => {
        try {
          // Try different ways to get table name from Drizzle schema objects
          return table[Symbol.for('drizzle:Name')] || 
                 table._.name || 
                 table.getSQL?.()?.match(/CREATE TABLE "([^"]+)"/)?.[1] ||
                 null
        } catch {
          return null
        }
      })
      .filter(Boolean) as string[]

    if (tableNames.length === 0) {
      console.warn('Could not extract table names from schema')
      return
    }

    // Use TRUNCATE CASCADE to handle foreign key constraints automatically
    const truncateSQL = `TRUNCATE TABLE ${tableNames.map(name => `"${name}"`).join(', ')} RESTART IDENTITY CASCADE`
    await db.execute(sql.raw(truncateSQL))
    
    console.log('✅ All test data cleared successfully')
  } catch (error) {
    console.error('❌ Error clearing test data:', error)
    
    // Fallback: Use introspection to get actual table names from database
    try {
      const tablesResult = await db.execute(sql`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_type = 'BASE TABLE'
      `)
      
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const tableNames = (tablesResult as unknown as any[]).map(row => row.table_name)
      
      if (tableNames.length > 0) {
        const truncateSQL = `TRUNCATE TABLE ${tableNames.map(name => `"${name}"`).join(', ')} RESTART IDENTITY CASCADE`
        await db.execute(sql.raw(truncateSQL))
        console.log('✅ All test data cleared successfully (fallback method)')
      } else {
        console.warn('No tables found in database for clearing')
      }
    } catch (fallbackError) {
      console.error('❌ Fallback clearing method also failed:', fallbackError)
    }
  }
}

/**
 * Get the test database instance
 */
export function getTestDb(): ReturnType<typeof drizzle<typeof schema>> {
  if (!testDb) {
    testDb = getDatabase() as ReturnType<typeof drizzle<typeof schema>>
  }
  return testDb
}

/**
 * Insert test user data
 */
export async function insertTestUser(userData: Partial<typeof schema.users.$inferInsert> = {}) {
  const db = getTestDb()
  const [user] = await db.insert(schema.users).values({
    email: 'test@example.com',
    userStatus: 'guest',
    ...userData
  }).returning()
  return user
}
/**
 * Insert test article with translations
 */
export async function insertTestArticleWithTranslations(
  articleData: Partial<typeof schema.articles.$inferInsert> = {},
  translations: Array<Partial<typeof schema.articleTranslations.$inferInsert>> = []
) {
  const db = getTestDb()
  // Insert the article first
  const [article] = await db.insert(schema.articles).values({
    url: 'https://example.com/test',
    source: 'test-source', 
    sourceLanguage: 'en',
    ...articleData
  }).returning()

  // Insert translations if provided
  if (translations.length > 0) {
    const translationData = translations.map(translation => ({
      articleId: article.id,
      language: 'en',
      title: 'Test Article',
      summary: 'Test summary',
      ...translation
    }))
    
    await db.insert(schema.articleTranslations).values(translationData)
  }

  return article
}
