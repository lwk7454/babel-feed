/**
 * Test database setup for news-sourcer tests
 * Provides utilities for creating test news sources and endpoints
 */

import type { NewNewsSource, NewSourceEndpoint } from '@babel-feed/pgdb'
import { clearTestData, getTestDb, newsSources, sourceEndpoints } from '@babel-feed/pgdb'

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

// Re-export global test utilities for convenience
export { clearTestData, getTestDb }
