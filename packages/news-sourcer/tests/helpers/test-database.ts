/**
 * Test database setup for news-sourcer tests
 * Provides utilities for setting up test database with required tables
 */

import { setupTestDatabase, cleanupTestDatabase, clearTestData, getTestDb } from '@babel-feed/pgdb'
import { newsSources, sourceEndpoints } from '@babel-feed/pgdb'
import type { NewNewsSource, NewSourceEndpoint } from '@babel-feed/pgdb'

let isInitialized = false

/**
 * Setup test database for news-sourcer tests
 */
export async function setupNewsSourcerTestDatabase(): Promise<void> {
  if (isInitialized) {
    return
  }

  // Set test environment
  process.env.NODE_ENV = 'test'
  
  // Initialize test database
  await setupTestDatabase()
  
  isInitialized = true
}

/**
 * Cleanup test database
 */
export async function cleanupNewsSourcerTestDatabase(): Promise<void> {
  if (!isInitialized) {
    return
  }

  await cleanupTestDatabase()
  isInitialized = false
}

/**
 * Clear test data between tests
 */
export async function clearNewsSourcerTestData(): Promise<void> {
  if (!isInitialized) {
    throw new Error('Test database not initialized. Call setupNewsSourcerTestDatabase() first.')
  }
  
  await clearTestData()
}

/**
 * Create a test news source
 */
export async function createTestNewsSource(sourceData: Partial<NewNewsSource> = {}): Promise<typeof newsSources.$inferSelect> {
  const testDb = getTestDb()
  
  const defaultSource: NewNewsSource = {
    name: 'Test News Source',
    slug: `test-source-${Date.now()}`,
    url: 'https://example.com',
    sourceType: 'rss',
    language: 'en',
    category: 'news',
    ...sourceData
  }

  const [source] = await testDb.insert(newsSources).values(defaultSource).returning()
  return source
}

/**
 * Create a test source endpoint
 */
export async function createTestSourceEndpoint(
  sourceId: string,
  endpointData: Partial<NewSourceEndpoint> = {}
): Promise<typeof sourceEndpoints.$inferSelect> {
  const testDb = getTestDb()
  
  const defaultEndpoint: NewSourceEndpoint = {
    sourceId,
    endpointUrl: 'https://example.com/rss',
    type: 'rss',
    category: 'news',
    pollingInterval: 3600,
    reliability: 100,
    priority: 1,
    ...endpointData
  }

  const [endpoint] = await testDb.insert(sourceEndpoints).values(defaultEndpoint).returning()
  return endpoint
}

/**
 * Get test database instance
 */
export function getNewsSourcerTestDb() {
  return getTestDb()
} 