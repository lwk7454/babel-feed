#!/usr/bin/env bun

process.env.NODE_ENV = 'test'

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
import { getDatabase, resetDatabaseConnection } from './connection.js'
import * as schema from './schema.js'

// Migration tracking to avoid duplicate runs
let isSetup = false
let setupPromise: Promise<void> | null = null

/**
 * Setup test database connection (PGlite only)
 * Uses singleton database and applies migrations only once
 * This ensures test DB perfectly matches dev DB structure
 */
async function setupTestDatabase(){
  if (isSetup) {
    return // Already setup
  }
  
  // Prevent concurrent setup attempts
  if (setupPromise) {
    return setupPromise
  }
  
  setupPromise = (async () => {
    try {
      // Get the singleton database connection
      const testDb = getDatabase() as ReturnType<typeof drizzle<typeof schema>>
      
      // Apply migrations only once for the singleton database
      const migrationsFolder = path.resolve(__dirname, '../test-migrations')
        
      if (!existsSync(migrationsFolder)) {
        throw new Error('Test migrations folder not found. Migration generation may have failed.')
      }
      
      await migrate(testDb, { migrationsFolder })
      isSetup = true
      console.log('✅ Test database setup completed successfully')
    } catch (error) {
      console.error('❌ Failed to setup test database:', error)
      setupPromise = null // Allow retry
      throw error
    }
  })()
  
  return setupPromise
}

/**
 * Clear all test data from database tables  
 * Silent cleanup that handles PGLite corruption gracefully
 */
export async function clearTestData(): Promise<void> {
  // Ensure database is setup before clearing
  if (!isSetup) {
    await setupTestDatabase()
  }
  
  try {
    const db = getTestDb()
    
    // Core tables that tests depend on
    const coreTables = ['ai_provider_keys', 'ai_providers']
    
    // Try to clear core tables first
    for (const tableName of coreTables) {
      try {
        await db.execute(sql.raw(`DELETE FROM "${tableName}"`))
      } catch {
        // DB might be corrupted, reset connection and retry
        resetDatabaseConnection()
        isSetup = false
        setupPromise = null
        await setupTestDatabase()
        const freshDb = getTestDb()
        await freshDb.execute(sql.raw(`DELETE FROM "${tableName}"`))
      }
    }
    
    console.log('✅ All test data cleared successfully')
  } catch (error) {
    // Final fallback - reset everything
    console.warn('⚠️ DB cleanup failed, resetting connection')
    resetDatabaseConnection()
    isSetup = false
    setupPromise = null
  }
}

/**
 * Get the test database instance
 * Automatically sets up database if not already done
 */
export function getTestDb(): ReturnType<typeof drizzle<typeof schema>> {
  return getDatabase() as ReturnType<typeof drizzle<typeof schema>>
}

/**
 * Reset test database for fresh test runs  
 * Only clears data, keeps same DB instance and migration
 */
export async function resetTestDatabase(): Promise<void> {
  await clearTestData()
}

/**
 * Insert test user data
 * Automatically sets up database if not already done
 */
export async function insertTestUser(userData: Partial<typeof schema.users.$inferInsert> = {}) {
  // Ensure database is setup
  if (!isSetup) {
    await setupTestDatabase()
  }
  
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
 * Automatically sets up database if not already done
 */
export async function insertTestArticleWithTranslations(
  articleData: Partial<typeof schema.articles.$inferInsert> = {},
  translations: Array<Partial<typeof schema.articleTranslations.$inferInsert>> = []
) {
  // Ensure database is setup
  if (!isSetup) {
    await setupTestDatabase()
  }
  
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
