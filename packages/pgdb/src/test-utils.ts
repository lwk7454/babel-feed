#!/usr/bin/env bun

/**
 * Test utilities for database operations
 * Uses migration-based approach for test database setup
 * Generates fresh migrations from dev schema and applies them to PGlite
 */

import { execSync } from 'child_process'
import { sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/pglite'
import { migrate } from 'drizzle-orm/pglite/migrator'
import { existsSync } from 'fs'
import path from 'path'
import { getDatabase } from './connection.js'
import * as schema from './schema.js'

let testDb: ReturnType<typeof drizzle<typeof schema>> | null = null

/**
 * Generate fresh migrations for test database
 * This ensures test DB schema matches current dev schema exactly
 */
async function generateTestMigrations(): Promise<void> {
  const scriptsDir = path.resolve(__dirname, '../scripts')
  const migrationsScript = path.join(scriptsDir, 'generate-test-migrations.ts')
  
  if (!existsSync(migrationsScript)) {
    throw new Error('Test migrations script not found. Please ensure scripts/generate-test-migrations.ts exists.')
  }
  
  try {
    console.log('🔄 Generating fresh test migrations...')
    execSync(`bun run ${migrationsScript}`, {
      stdio: 'pipe', // Keep quiet during test runs
      cwd: path.resolve(__dirname, '..')
    })
  } catch (error) {
    console.error('Failed to generate test migrations:', error)
    throw error
  }
}

/**
 * Setup test database connection (PGlite only)
 * Generates fresh migrations from schema and applies them
 * This ensures test DB perfectly matches dev DB structure
 */
export async function setupTestDatabase(): Promise<ReturnType<typeof drizzle<typeof schema>>> {
  testDb = getDatabase() as ReturnType<typeof drizzle<typeof schema>>

  // Apply migrations
  const migrationsFolder = path.resolve(__dirname, '../test-migrations')
  
  if (!existsSync(migrationsFolder)) {
    throw new Error('Test migrations folder not found. Migration generation may have failed.')
  }
  
  try {
    await migrate(testDb, { migrationsFolder })
    console.log('✅ Test database migrations applied successfully')
  } catch (error) {
    console.error('Failed to apply test migrations:', error)
    throw error
  }

  return testDb
}

/**
 * Cleanup test database connection
 */
export async function cleanupTestDatabase(): Promise<void> {
  testDb = null
}

/**
 * Clear all test data from database tables
 * Uses schema introspection to dynamically discover and clear all tables
 */
export async function clearTestData(): Promise<void> {
  const db = getTestDb()
  try {
    // Get all table names using information_schema (works with PGLite)
    const tablesResult = await db.execute(sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `)
    
    // Extract table names from PGLite results structure
    const tableNames: string[] = []
    if (tablesResult && typeof tablesResult === 'object' && 'rows' in tablesResult) {
      const rows = (tablesResult as unknown as { rows: Array<{ table_name: string }> }).rows
      for (const row of rows) {
        tableNames.push(row.table_name)
      }
    }
    
    if (tableNames.length === 0) {
      console.log('No tables found to clear')
      return
    }
    
    // Disable foreign key checks temporarily for clean truncation
    await db.execute(sql`SET session_replication_role = replica`)
    
    // Truncate all tables with restart identity and cascade
    for (const tableName of tableNames) {
      await db.execute(sql.raw(`TRUNCATE TABLE "${tableName}" RESTART IDENTITY CASCADE`))
    }
    
    // Re-enable foreign key checks
    await db.execute(sql`SET session_replication_role = DEFAULT`)
    
    console.log(`✅ Cleared ${tableNames.length} tables:`, tableNames.join(', '))
  } catch (error) {
    console.error('❌ Failed to clear test data:', error)
    throw error
  }
}

/**
 * Get the test database instance
 */
export function getTestDb(): ReturnType<typeof drizzle<typeof schema>> {
  if (!testDb) {
    throw new Error('Test database not initialized. Call setupTestDatabase() first.')
  }
  return testDb
}

/**
 * Insert test user data
 */
export async function insertTestUser(db: ReturnType<typeof drizzle<typeof schema>>, userData: Partial<typeof schema.users.$inferInsert> = {}) {
  const [user] = await db.insert(schema.users).values({
    email: 'test@example.com',
    userStatus: 'guest',
    ...userData
  }).returning()
  return user
}

/**
 * Insert test article data
 */
export async function insertTestArticle(db: ReturnType<typeof drizzle<typeof schema>>, articleData: Partial<typeof schema.articles.$inferInsert> = {}) {
  const [article] = await db.insert(schema.articles).values({
    url: 'https://example.com/test',
    source: 'test-source', 
    sourceLanguage: 'en',
    ...articleData
  }).returning()
  return article
}

/**
 * Health check for test database
 */
export async function testDatabaseHealth(db: ReturnType<typeof drizzle<typeof schema>>) {
  try {
    await db.execute(sql`SELECT 1`)
    return { healthy: true }
  } catch (error) {
    return { healthy: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}