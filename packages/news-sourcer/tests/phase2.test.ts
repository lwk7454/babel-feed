import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import { mock } from 'bun:test'
import { NewsSourcer } from '../src/news-sourcer.js'
import type { 
  EndpointValidationResult, 
  EndpointCreateRequest, 
  EndpointUpdateRequest,
  EndpointQuery,
  BulkEndpointOperation,
  EndpointMetrics 
} from '../src/types.js'

// Mock the database
const mockEndpointData = {
  id: 'test-id',
  sourceId: 'test-source-id',
  endpointUrl: 'https://example.com/rss',
  type: 'rss',
  category: 'news',
  linkSelector: null,
  pollingInterval: 3600,
  reliability: 100,
  priority: 1,
  metadata: {},
  successCount: 0,
  errorCount: 0,
  lastFetchAt: null,
  lastSuccessAt: null,
  createdAt: new Date(),
  updatedAt: new Date()
}

const createMockQuery = () => ({
  where: mock(() => createMockQuery()),
  orderBy: mock(() => createMockQuery()),
  limit: mock(() => createMockQuery()),
  offset: mock(() => createMockQuery()),
  returning: mock(() => Promise.resolve([mockEndpointData])),
  then: mock((callback: (result: any) => any) => Promise.resolve([mockEndpointData]).then(callback))
})

const mockDb = {
  insert: mock(() => ({
    values: mock(() => ({
      returning: mock(() => Promise.resolve([mockEndpointData]))
    }))
  })),
  select: mock(() => ({
    from: mock(() => createMockQuery())
  })),
  update: mock(() => ({
    set: mock(() => ({
      where: mock(() => ({
        returning: mock(() => Promise.resolve([{
          ...mockEndpointData,
          reliability: 90,
          successCount: 5,
          errorCount: 1,
          lastFetchAt: new Date(),
          lastSuccessAt: new Date()
        }]))
      }))
    }))
  })),
  delete: mock(() => ({
    where: mock(() => ({
      returning: mock(() => Promise.resolve([{ id: 'test-id' }]))
    }))
  }))
}

// Mock the database connection
mock.module('@babel-feed/pgdb', () => ({
  getDatabase: mock(() => Promise.resolve(mockDb)),
  sourceEndpoints: {
    id: 'id',
    sourceId: 'sourceId',
    endpointUrl: 'endpointUrl',
    type: 'type',
    category: 'category',
    linkSelector: 'linkSelector',
    pollingInterval: 'pollingInterval',
    reliability: 'reliability',
    priority: 'priority',
    metadata: 'metadata',
    successCount: 'successCount',
    errorCount: 'errorCount',
    lastFetchAt: 'lastFetchAt',
    lastSuccessAt: 'lastSuccessAt',
    createdAt: 'createdAt',
    updatedAt: 'updatedAt'
  }
}))

// Mock axios for HTTP requests
mock.module('axios', () => ({
  default: {
    get: mock((url: string) => {
      if (url === 'https://example.com/rss') {
        return Promise.resolve({
          data: `<?xml version="1.0"?>
            <rss version="2.0">
              <channel>
                <title>Test RSS Feed</title>
                <description>Test feed</description>
                <item>
                  <title>Test Article 1</title>
                  <link>https://example.com/article1</link>
                  <description>Test article 1 description</description>
                </item>
                <item>
                  <title>Test Article 2</title>
                  <link>https://example.com/article2</link>
                  <description>Test article 2 description</description>
                </item>
              </channel>
            </rss>`
        })
      }
      return Promise.reject(new Error('Not found'))
    }),
    head: mock((url: string) => {
      if (url.includes('example.com/article')) {
        return Promise.resolve({ status: 200 })
      }
      return Promise.reject(new Error('Not found'))
    })
  }
}))

describe('NewsSourcer Phase 2 - Endpoint Validation & Database Operations', () => {
  let sourcer: NewsSourcer

  beforeEach(async () => {
    sourcer = new NewsSourcer()
    await sourcer.initialize()
  })

  afterEach(() => {
    mock.restore()
  })

  describe('Enhanced Endpoint Validation', () => {
    it('validates RSS endpoint with retry logic', async () => {
      const result = await sourcer.validateEndpoint('https://example.com/rss')
      
      expect(result).toBeDefined()
      expect(result.endpointUrl).toBe('https://example.com/rss')
      expect(result.type).toBe('rss')
      expect(result.valid).toBe(true)
      expect(result.articleCount).toBe(2)
      expect(result.sampleUrls).toHaveLength(2)
      expect(result.sampleUrls).toContain('https://example.com/article1')
      expect(result.sampleUrls).toContain('https://example.com/article2')
      expect(result.reliability).toBe(1.0)
      expect(result.responseTime).toBeGreaterThanOrEqual(0)
      expect(result.retryCount).toBe(0)
    })

    it('validates RSS endpoint with URL validation', async () => {
      const result = await sourcer.validateEndpoint('https://example.com/rss', { 
        validateUrls: true 
      })
      
      expect(result).toBeDefined()
      expect(result.valid).toBe(true)
      expect(result.reliability).toBe(1.0) // Both URLs should be valid
    })

    it('handles validation errors with retry logic', async () => {
      const result = await sourcer.validateEndpoint('https://invalid.com/rss', {
        maxRetries: 2,
        baseDelay: 100,
        timeout: 1000
      })
      
      expect(result).toBeDefined()
      expect(result.valid).toBe(false)
      expect(result.error).toBeDefined()
      expect(result.retryCount).toBeGreaterThan(0)
    })

    it('respects retry configuration', async () => {
      const result = await sourcer.validateEndpoint('https://invalid.com/rss', {
        maxRetries: 1,
        baseDelay: 100
      })
      
      expect(result).toBeDefined()
      expect(result.valid).toBe(false)
      expect(result.retryCount).toBe(1)
    })
  })

  describe('Database Operations - CRUD', () => {
    it('creates a new endpoint', async () => {
      const request: EndpointCreateRequest = {
        sourceId: 'test-source-id',
        endpointUrl: 'https://example.com/rss',
        type: 'rss',
        category: 'news',
        pollingInterval: 3600,
        reliability: 1.0,
        priority: 1,
        metadata: { discovered: true }
      }

      const result = await sourcer.createEndpoint(request)
      
      expect(result).toBeDefined()
      expect(result.id).toBe('test-id')
      expect(result.sourceId).toBe('test-source-id')
      expect(result.endpointUrl).toBe('https://example.com/rss')
      expect(result.type).toBe('rss')
      expect(result.category).toBe('news')
      expect(result.reliability).toBe(1.0)
      expect(result.priority).toBe(1)
      expect(result.successCount).toBe(0)
      expect(result.errorCount).toBe(0)
    })

    it('updates an endpoint', async () => {
      const request: EndpointUpdateRequest = {
        id: 'test-id',
        reliability: 0.9,
        successCount: 5,
        errorCount: 1,
        lastFetchAt: new Date(),
        lastSuccessAt: new Date()
      }

      const result = await sourcer.updateEndpoint(request)
      
      expect(result).toBeDefined()
      expect(result?.id).toBe('test-id')
      expect(result?.reliability).toBe(0.9)
      expect(result?.successCount).toBe(5)
      expect(result?.errorCount).toBe(1)
      expect(result?.lastFetchAt).toBeDefined()
      expect(result?.lastSuccessAt).toBeDefined()
    })

    it('deletes an endpoint', async () => {
      const result = await sourcer.deleteEndpoint('test-id')
      
      expect(result).toBe(true)
    })

    it('gets an endpoint by ID', async () => {
      const result = await sourcer.getEndpoint('test-id')
      
      expect(result).toBeDefined()
      expect(result?.id).toBe('test-id')
      expect(result?.endpointUrl).toBe('https://example.com/rss')
    })

    it('queries endpoints with filters', async () => {
      const query: EndpointQuery = {
        sourceId: 'test-source-id',
        type: 'rss',
        minReliability: 0.5,
        limit: 10
      }

      const results = await sourcer.queryEndpoints(query)
      
      expect(results).toBeDefined()
      expect(Array.isArray(results)).toBe(true)
      expect(results.length).toBeGreaterThan(0)
      expect(results[0].sourceId).toBe('test-source-id')
    })
  })

  describe('Bulk Operations', () => {
    it('bulk creates endpoints', async () => {
      const operation: BulkEndpointOperation = {
        sourceId: 'test-source-id',
        endpoints: [
          {
            sourceId: 'test-source-id',
            endpointUrl: 'https://example.com/rss',
            type: 'rss',
            category: 'news'
          },
          {
            sourceId: 'test-source-id',
            endpointUrl: 'https://example.com/atom',
            type: 'atom',
            category: 'sports'
          }
        ],
        replaceExisting: false
      }

      const results = await sourcer.bulkCreateEndpoints(operation)
      
      expect(results).toBeDefined()
      expect(Array.isArray(results)).toBe(true)
      expect(results.length).toBe(1) // Mock returns one result
      expect(results[0].sourceId).toBe('test-source-id')
    })

    it('bulk creates endpoints with replacement', async () => {
      const operation: BulkEndpointOperation = {
        sourceId: 'test-source-id',
        endpoints: [
          {
            sourceId: 'test-source-id',
            endpointUrl: 'https://example.com/new-rss',
            type: 'rss',
            category: 'news'
          }
        ],
        replaceExisting: true
      }

      const results = await sourcer.bulkCreateEndpoints(operation)
      
      expect(results).toBeDefined()
      expect(Array.isArray(results)).toBe(true)
    })
  })

  describe('Metrics and Reliability', () => {
    it('updates endpoint metrics', async () => {
      const metrics: EndpointMetrics = {
        successCount: 10,
        errorCount: 2,
        reliability: 0.8,
        lastFetchAt: new Date(),
        lastSuccessAt: new Date()
      }

      await expect(sourcer.updateEndpointMetrics('test-id', metrics)).resolves.toBeUndefined()
    })

    it('calculates reliability score correctly', () => {
      // Test various success/error combinations
      expect(sourcer.calculateReliability(10, 0)).toBe(1.0)
      expect(sourcer.calculateReliability(8, 2)).toBeLessThan(1.0)
      expect(sourcer.calculateReliability(0, 10)).toBe(0)
      expect(sourcer.calculateReliability(0, 0)).toBe(1.0)
      
      // Test exponential decay for failures
      const reliabilityWithFewErrors = sourcer.calculateReliability(10, 2)
      const reliabilityWithManyErrors = sourcer.calculateReliability(10, 10)
      expect(reliabilityWithFewErrors).toBeGreaterThan(reliabilityWithManyErrors)
    })

    it('cleans up stale endpoints', async () => {
      const count = await sourcer.cleanupStaleEndpoints(0.1, 30)
      
      expect(typeof count).toBe('number')
      expect(count).toBeGreaterThanOrEqual(0)
    })
  })

  describe('Error Handling', () => {
    it('handles database connection errors gracefully', async () => {
      const badSourcer = new NewsSourcer()
      // Don't call initialize() to simulate connection failure
      
      await expect(badSourcer.createEndpoint({
        sourceId: 'test',
        endpointUrl: 'https://example.com/rss',
        type: 'rss'
      })).rejects.toThrow()
    })

    it('handles validation timeout errors', async () => {
      const result = await sourcer.validateEndpoint('https://timeout.com/rss', {
        timeout: 1,
        maxRetries: 1
      })
      
      expect(result.valid).toBe(false)
      expect(result.error).toBeDefined()
    })
  })

  describe('Configuration', () => {
    it('respects custom configuration', async () => {
      const customSourcer = new NewsSourcer({
        validation: {
          maxRetries: 1,
          baseDelay: 500,
          timeout: 5000
        },
        userAgent: 'CustomBot/1.0'
      })
      
      await customSourcer.initialize()
      
      const result = await customSourcer.validateEndpoint('https://example.com/rss')
      expect(result).toBeDefined()
    })
  })
})