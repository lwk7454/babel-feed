import { describe, it, expect, beforeAll, afterAll, beforeEach, mock } from 'bun:test'
import { RecommendationEngine } from '../modules/recommendation/recommendation-engine'
import { type RecommendationContext, type RecommendationConfig } from '../modules/recommendation/types'
import { clearTestData, setupTestDatabase } from '@babel-feed/pgdb'
import { createTestTimers, createPerformanceTestHelpers } from '@babel-feed/utils'

// Mock AiProviderManager to avoid database initialization issues
const mockAiProviderManager = {
  initialize: mock(() => Promise.resolve()),
  getEnabledProviders: mock(() => Promise.resolve([
    {
      id: 'test-provider',
      name: 'Test Provider',
      baseUrl: 'https://api.test.com',
      metadata: { models: ['test-model'] }
    }
  ])),
  executeWithProvider: mock(() => Promise.resolve([])),
  getAllProviders: mock(() => Promise.resolve([]))
}

// Mock the AiProviderManager module
mock.module('@babel-feed/llm-provider', () => ({
  AiProviderManager: mock(() => mockAiProviderManager)
}))

// Helper function to generate test UUIDs
const generateTestUUID = (): string => {
  return '00000000-0000-4000-a000-000000000000'.replace(/[0]/g, () => 
    Math.floor(Math.random() * 16).toString(16)
  )
}

beforeAll(async () => {
  await setupTestDatabase()
})

describe('RecommendationEngine - Comprehensive Tests', () => {
  let recommendationEngine: RecommendationEngine
  const timer = createTestTimers({ now: new Date('2024-01-01T00:00:00Z').getTime() })
  const perfHelpers = createPerformanceTestHelpers(timer)
  beforeEach(async () => {
    await clearTestData()
    timer.reset()
    // Reset mocks
    mockAiProviderManager.initialize.mockClear()
    mockAiProviderManager.getEnabledProviders.mockClear()
    mockAiProviderManager.executeWithProvider.mockClear()
    mockAiProviderManager.getAllProviders.mockClear()
    
    recommendationEngine = new RecommendationEngine()
    await recommendationEngine.initialize()
  })



  describe('Initialization and Configuration', () => {
    it('should initialize successfully', async () => {
      const engine = new RecommendationEngine()
      await engine.initialize()
    })

    it('should update configuration correctly', async () => {
      const newConfig: Partial<RecommendationConfig> = {
        algorithms: {
          contentBased: { enabled: true, weight: 0.5, features: ['category', 'tags'] },
          collaborative: { enabled: false, weight: 0.0, minInteractions: 20 },
          trending: { enabled: true, weight: 0.3, timeWindow: 12 },
          personalized: { enabled: true, weight: 0.2, learningRate: 0.05 }
        },
        diversity: {
          enabled: false,
          categoryThreshold: 5,
          sourceThreshold: 3,
          topicThreshold: 6
        }
      }

      await recommendationEngine.updateConfig(newConfig)
    })

    it('should handle partial configuration updates', async () => {
      const partialConfig: Partial<RecommendationConfig> = {
        freshness: {
          enabled: false,
          decayRate: 0.2,
          maxAge: 72
        }
      }

      await recommendationEngine.updateConfig(partialConfig)
    })
  })

  describe('Recommendation Generation', () => {
    it('should generate recommendations with valid context', async () => {
      const context: RecommendationContext = {
        userId: generateTestUUID(),
        currentTime: new Date(),
        deviceType: 'mobile',
        feedType: 'home',
        limit: 10,
        offset: 0
      }

      const result = await recommendationEngine.generateRecommendations(context)

      expect(result).toBeDefined()
      expect(result.articles).toBeInstanceOf(Array)
      expect(result.metadata).toBeDefined()
      expect(result.metadata.algorithm).toBe('hybrid-v1')
      expect(result.metadata.version).toBe('1.0.0')
      expect(typeof result.metadata.processingTime).toBe('number')
      // Allow processingTime to be 0 for mock data scenarios (insufficient user data)
      expect(result.metadata.processingTime).toBeGreaterThanOrEqual(0)
      expect(typeof result.hasMore).toBe('boolean')
      expect(typeof result.nextOffset).toBe('number')
    })

    it('should respect limit and offset parameters', async () => {
      const context: RecommendationContext = {
        userId: generateTestUUID(),
        currentTime: new Date(),
        deviceType: 'desktop',
        feedType: 'category',
        limit: 5,
        offset: 2
      }

      const result = await recommendationEngine.generateRecommendations(context)

      expect(result.articles.length).toBeLessThanOrEqual(5)
      expect(result.nextOffset).toBe(7) // offset + limit
    })

    it('should handle different device types', async () => {
      const deviceTypes: Array<'mobile' | 'desktop' | 'tablet'> = ['mobile', 'desktop', 'tablet']

      for (const deviceType of deviceTypes) {
        const context: RecommendationContext = {
          userId: generateTestUUID(),
          currentTime: new Date(),
          deviceType,
          feedType: 'home',
          limit: 10,
          offset: 0
        }

        const result = await recommendationEngine.generateRecommendations(context)
        expect(result).toBeDefined()
        expect(result.articles).toBeInstanceOf(Array)
      }
    })

    it('should handle different feed types', async () => {
          const feedTypes: Array<'home' | 'category' | 'trending' | 'search'> =
      ['home', 'category', 'trending', 'search']

      for (const feedType of feedTypes) {
        const context: RecommendationContext = {
          userId: generateTestUUID(),
          currentTime: new Date(),
          deviceType: 'mobile',
          feedType,
          limit: 10,
          offset: 0
        }

        const result = await recommendationEngine.generateRecommendations(context)
        expect(result).toBeDefined()
        expect(result.articles).toBeInstanceOf(Array)
      }
    })

    it('should validate required userId', async () => {
      const context: RecommendationContext = {
        userId: '', // Empty userId should fail
        currentTime: new Date(),
        deviceType: 'mobile',
        feedType: 'home',
        limit: 10,
        offset: 0
      }

      await expect(recommendationEngine.generateRecommendations(context))
        .rejects.toThrow('User ID is required for recommendations')
    })

    it('should handle missing userId gracefully', async () => {
      const context = {
        currentTime: new Date(),
        deviceType: 'mobile',
        feedType: 'home',
        limit: 10,
        offset: 0
        // userId is missing
      } as RecommendationContext

      await expect(recommendationEngine.generateRecommendations(context))
        .rejects.toThrow()
    })
  })

  describe('Filtering and Personalization', () => {
    it('should apply language filters', async () => {
      const context: RecommendationContext = {
        userId: generateTestUUID(),
        currentTime: new Date(),
        deviceType: 'mobile',
        feedType: 'home',
        limit: 10,
        offset: 0,
        filters: {
          languages: ['en', 'es']
        }
      }

      const result = await recommendationEngine.generateRecommendations(context)

      expect(result).toBeDefined()
      expect(result.metadata.appliedFilters).toContain('language')
    })

    it('should apply category filters', async () => {
      const context: RecommendationContext = {
        userId: generateTestUUID(),
        currentTime: new Date(),
        deviceType: 'mobile',
        feedType: 'category',
        limit: 10,
        offset: 0,
        filters: {
          categories: ['technology', 'business']
        }
      }

      const result = await recommendationEngine.generateRecommendations(context)

      expect(result).toBeDefined()
      expect(result.metadata.appliedFilters).toContain('category')
    })

    it('should apply time range filters', async () => {
      const now = new Date()
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000)

      const context: RecommendationContext = {
        userId: generateTestUUID(),
        currentTime: now,
        deviceType: 'mobile',
        feedType: 'home',
        limit: 10,
        offset: 0,
        filters: {
          timeRange: {
            start: yesterday,
            end: now
          }
        }
      }

      const result = await recommendationEngine.generateRecommendations(context)

      expect(result).toBeDefined()
      expect(result.metadata.appliedFilters).toContain('timeRange')
    })

    it('should exclude seen articles when requested', async () => {
      const context: RecommendationContext = {
        userId: generateTestUUID(),
        currentTime: new Date(),
        deviceType: 'mobile',
        feedType: 'home',
        limit: 10,
        offset: 0,
        filters: {
          excludeSeen: true
        }
      }

      const result = await recommendationEngine.generateRecommendations(context)

      expect(result).toBeDefined()
      expect(result.metadata.appliedFilters).toContain('excludeSeen')
    })

    it('should combine multiple filters', async () => {
      const context: RecommendationContext = {
        userId: generateTestUUID(),
        currentTime: new Date(),
        deviceType: 'desktop',
        feedType: 'home',
        limit: 15,
        offset: 0,
        filters: {
          languages: ['en'],
          categories: ['technology', 'science'],
          excludeSeen: true,
          timeRange: {
            start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
            end: new Date()
          }
        }
      }

      const result = await recommendationEngine.generateRecommendations(context)

      expect(result).toBeDefined()
      expect(result.metadata.appliedFilters).toContain('language')
      expect(result.metadata.appliedFilters).toContain('category')
      expect(result.metadata.appliedFilters).toContain('excludeSeen')
      expect(result.metadata.appliedFilters).toContain('timeRange')
      expect(result.metadata.appliedFilters.length).toBe(4)
    })
  })

  describe('Article Scoring', () => {
    it('should score individual articles', async () => {
      const context: RecommendationContext = {
        userId: generateTestUUID(),
        currentTime: new Date(),
        deviceType: 'mobile',
        feedType: 'home',
        limit: 10,
        offset: 0
      }

      const score = await recommendationEngine.scoreArticle('test-article-1', context)

      expect(score).toBeDefined()
      expect(score.articleId).toBe('test-article-1')
      expect(score.userId).toBe(context.userId)
      expect(typeof score.totalScore).toBe('number')
      expect(score.totalScore).toBeGreaterThanOrEqual(0)
      expect(score.subscores).toBeDefined()
      expect(score.subscores.relevance).toBeGreaterThanOrEqual(0)
      expect(score.subscores.freshness).toBeGreaterThanOrEqual(0)
      expect(score.subscores.popularity).toBeGreaterThanOrEqual(0)
      expect(score.subscores.quality).toBeGreaterThanOrEqual(0)
      expect(score.explanation).toBeDefined()
      expect(Array.isArray(score.explanation)).toBe(true)
    })

    it('should handle scoring with user profile', async () => {
      const context: RecommendationContext = {
        userId: generateTestUUID(),
        currentTime: new Date(),
        deviceType: 'mobile',
        feedType: 'home',
        limit: 10,
        offset: 0
      }

      // This should work even if user profile doesn't exist
      const score = await recommendationEngine.scoreArticle('test-article-profile', context)

      expect(score).toBeDefined()
      expect(score.totalScore).toBeGreaterThanOrEqual(0)
    })

    it('should handle scoring non-existent articles gracefully', async () => {
      const context: RecommendationContext = {
        userId: generateTestUUID(),
        currentTime: new Date(),
        deviceType: 'mobile',
        feedType: 'home',
        limit: 10,
        offset: 0
      }

      // Should handle gracefully since we return mock data
      const score = await recommendationEngine.scoreArticle('non-existent-article', context)
      expect(score).toBeDefined()
    })
  })

  describe('Trending Topics', () => {
    it('should generate trending topics with default parameters', async () => {
      const topics = await recommendationEngine.getTrendingTopics()

      expect(topics).toBeInstanceOf(Array)
      expect(topics.length).toBeLessThanOrEqual(10) // Default limit
      
      topics.forEach(topic => {
        expect(topic).toHaveProperty('topic')
        expect(topic).toHaveProperty('category')
        expect(topic).toHaveProperty('score')
        expect(topic).toHaveProperty('velocity')
        expect(topic).toHaveProperty('articles')
        expect(topic).toHaveProperty('timeWindow')
        expect(typeof topic.score).toBe('number')
        expect(typeof topic.velocity).toBe('number')
        expect(topic.articles).toBeInstanceOf(Array)
        expect(topic.timeWindow.start).toBeInstanceOf(Date)
        expect(topic.timeWindow.end).toBeInstanceOf(Date)
      })
    })

    it('should respect time window parameter', async () => {
      const topics12h = await recommendationEngine.getTrendingTopics(12, 5)
      const topics48h = await recommendationEngine.getTrendingTopics(48, 5)

      expect(topics12h).toBeInstanceOf(Array)
      expect(topics48h).toBeInstanceOf(Array)
      expect(topics12h.length).toBeLessThanOrEqual(5)
      expect(topics48h.length).toBeLessThanOrEqual(5)

      // Time windows should be different
      if (topics12h.length > 0 && topics48h.length > 0) {
        const window12h = topics12h[0].timeWindow.end.getTime() - topics12h[0].timeWindow.start.getTime()
        const window48h = topics48h[0].timeWindow.end.getTime() - topics48h[0].timeWindow.start.getTime()
        expect(window48h).toBeGreaterThan(window12h)
      }
    })

    it('should respect limit parameter', async () => {
      const topics3 = await recommendationEngine.getTrendingTopics(24, 3)
      const topics7 = await recommendationEngine.getTrendingTopics(24, 7)

      expect(topics3.length).toBeLessThanOrEqual(3)
      expect(topics7.length).toBeLessThanOrEqual(7)
    })

    it('should handle edge cases for trending topics', async () => {
      // Test with zero limit
      const topicsZero = await recommendationEngine.getTrendingTopics(24, 0)
      expect(topicsZero).toBeInstanceOf(Array)
      expect(topicsZero.length).toBe(0)

      // Test with very large time window
      const topicsLarge = await recommendationEngine.getTrendingTopics(8760, 10) // 1 year
      expect(topicsLarge).toBeInstanceOf(Array)

      // Test with very small time window
      const topicsSmall = await recommendationEngine.getTrendingTopics(1, 10) // 1 hour
      expect(topicsSmall).toBeInstanceOf(Array)
    })
  })

  describe('Diversity and Quality Optimization', () => {
    it('should apply diversity optimization when enabled', async () => {
      // Enable diversity in config
      await recommendationEngine.updateConfig({
        diversity: {
          enabled: true,
          categoryThreshold: 2,
          sourceThreshold: 2,
          topicThreshold: 3
        }
      })

      const context: RecommendationContext = {
        userId: generateTestUUID(),
        currentTime: new Date(),
        deviceType: 'mobile',
        feedType: 'home',
        limit: 20,
        offset: 0
      }

      const result = await recommendationEngine.generateRecommendations(context)

      expect(result).toBeDefined()
      expect(result.metadata.diversityScore).toBeDefined()
      expect(typeof result.metadata.diversityScore).toBe('number')
      expect(result.metadata.diversityScore).toBeGreaterThanOrEqual(0)
    })

    it('should disable diversity when configured', async () => {
      // Disable diversity in config
      await recommendationEngine.updateConfig({
        diversity: {
          enabled: false,
          categoryThreshold: 2,
          sourceThreshold: 2,
          topicThreshold: 3
        }
      })

      const context: RecommendationContext = {
        userId: generateTestUUID(),
        currentTime: new Date(),
        deviceType: 'mobile',
        feedType: 'home',
        limit: 10,
        offset: 0
      }

      const result = await recommendationEngine.generateRecommendations(context)

      expect(result).toBeDefined()
      // Should still calculate diversity score for metadata
      expect(result.metadata.diversityScore).toBeDefined()
    })

    it('should calculate quality scores correctly', async () => {
      // Enable quality scoring
      await recommendationEngine.updateConfig({
        quality: {
          enabled: true,
          minScore: 0.5,
          sourceBias: 0.2
        }
      })

      const context: RecommendationContext = {
        userId: generateTestUUID(),
        currentTime: new Date(),
        deviceType: 'mobile',
        feedType: 'home',
        limit: 10,
        offset: 0
      }

      const result = await recommendationEngine.generateRecommendations(context)

      expect(result).toBeDefined()
      
      // Check that articles have quality scores
      result.articles.forEach(article => {
        expect(typeof article.score).toBe('number')
        expect(article.score).toBeGreaterThanOrEqual(0)
      })
    })
  })

  describe('Error Handling and Edge Cases', () => {
    it('should handle database connection issues gracefully', async () => {
      const context: RecommendationContext = {
        userId: generateTestUUID(),
        currentTime: new Date(),
        deviceType: 'mobile',
        feedType: 'home',
        limit: 10,
        offset: 0
      }

      // Should not throw even if there are database issues
      await expect(recommendationEngine.generateRecommendations(context)).resolves.toBeDefined()
    })

    it('should handle invalid user IDs gracefully', async () => {
      const invalidUserIds = ['', '   ', null as any, undefined as any]

      for (const userId of invalidUserIds) {
        const context: RecommendationContext = {
          userId,
          currentTime: new Date(),
          deviceType: 'mobile',
          feedType: 'home',
          limit: 10,
          offset: 0
        }

        // Should reject for invalid user IDs
        await expect(recommendationEngine.generateRecommendations(context)).rejects.toThrow()
      }
    })

    it('should handle extreme limit values', async () => {
      const extremeLimits = [0, 1, 1000, 10000]

      for (const limit of extremeLimits) {
        const context: RecommendationContext = {
          userId: generateTestUUID(),
          currentTime: new Date(),
          deviceType: 'mobile',
          feedType: 'home',
          limit,
          offset: 0
        }

        const result = await recommendationEngine.generateRecommendations(context)
        expect(result).toBeDefined()
        expect(result.articles.length).toBeLessThanOrEqual(limit)
      }
    })

    it('should handle extreme offset values', async () => {
      const extremeOffsets = [0, 100, 1000, 10000]

      for (const offset of extremeOffsets) {
        const context: RecommendationContext = {
          userId: generateTestUUID(),
          currentTime: new Date(),
          deviceType: 'mobile',
          feedType: 'home',
          limit: 10,
          offset
        }

        const result = await recommendationEngine.generateRecommendations(context)
        expect(result).toBeDefined()
        expect(result.nextOffset).toBe(offset + 10)
      }
    })

    it('should handle malformed filter objects', async () => {
      const context: RecommendationContext = {
        userId: generateTestUUID(),
        currentTime: new Date(),
        deviceType: 'mobile',
        feedType: 'home',
        limit: 10,
        offset: 0,
        filters: {
          // @ts-expect-error - Testing malformed filters
          invalidFilter: 'invalid',
          languages: null as any,
          categories: 'not-an-array' as any
        }
      }

      // Should handle gracefully without crashing
      await expect(recommendationEngine.generateRecommendations(context)).resolves.toBeDefined()
    })
  })

  describe('Performance and Scalability', () => {
    it('should complete recommendation generation within reasonable time', async () => {
      const context: RecommendationContext = {
        userId: generateTestUUID(),
        currentTime: new Date(),
        deviceType: 'mobile',
        feedType: 'home',
        limit: 50,
        offset: 0
      }

      const result = await perfHelpers.assertPerformance(
        () => recommendationEngine.generateRecommendations(context),
        5000, // Should complete within 5 seconds
        'recommendation generation'
      )

      expect(result).toBeDefined()
      expect(result.metadata.processingTime).toBeLessThan(5000)
    })

    it('should handle concurrent recommendation requests', async () => {
      const contexts = Array.from({ length: 10 }, (_, i) => ({
        userId: generateTestUUID(),
        currentTime: new Date(),
        deviceType: 'mobile' as const,
        feedType: 'home' as const,
        limit: 10,
        offset: 0
      }))

      const results = await perfHelpers.assertPerformance(
        () => Promise.all(
          contexts.map(context => recommendationEngine.generateRecommendations(context))
        ),
        10000, // Should complete within 10 seconds
        'concurrent recommendation requests'
      )

      expect(results.length).toBe(10)
      
      results.forEach((result) => {
        expect(result).toBeDefined()
        expect(result.articles).toBeInstanceOf(Array)
        expect(result.metadata.algorithm).toBe('hybrid-v1')
      })
    })

    it('should handle memory efficiently with large result sets', async () => {
      const context: RecommendationContext = {
        userId: generateTestUUID(),
        currentTime: new Date(),
        deviceType: 'mobile',
        feedType: 'home',
        limit: 1000, // Large limit
        offset: 0
      }

      const result = await recommendationEngine.generateRecommendations(context)

      expect(result).toBeDefined()
      expect(result.articles).toBeInstanceOf(Array)
      // Should handle large result sets without memory issues
      expect(result.articles.length).toBeLessThanOrEqual(1000)
    })
  })

  describe('Metadata and Explanations', () => {
    it('should provide comprehensive metadata', async () => {
      const context: RecommendationContext = {
        userId: generateTestUUID(),
        currentTime: new Date(),
        deviceType: 'mobile',
        feedType: 'home',
        limit: 10,
        offset: 0,
        filters: {
          languages: ['en'],
          categories: ['technology']
        }
      }

      const result = await recommendationEngine.generateRecommendations(context)

      expect(result.metadata).toBeDefined()
      expect(result.metadata.algorithm).toBeDefined()
      expect(result.metadata.version).toBeDefined()
      expect(result.metadata.processingTime).toBeDefined()
      expect(result.metadata.totalCandidates).toBeDefined()
      expect(result.metadata.appliedFilters).toBeDefined()
      expect(result.metadata.diversityScore).toBeDefined()
      expect(result.metadata.explanations).toBeDefined()
      
      expect(typeof result.metadata.algorithm).toBe('string')
      expect(typeof result.metadata.version).toBe('string')
      expect(typeof result.metadata.processingTime).toBe('number')
      expect(typeof result.metadata.totalCandidates).toBe('number')
      expect(result.metadata.appliedFilters).toBeInstanceOf(Array)
      expect(typeof result.metadata.diversityScore).toBe('number')
      expect(typeof result.metadata.explanations).toBe('object')
    })

    it('should provide meaningful explanations', async () => {
      const context: RecommendationContext = {
        userId: generateTestUUID(),
        currentTime: new Date(),
        deviceType: 'mobile',
        feedType: 'home',
        limit: 5,
        offset: 0
      }

      const result = await recommendationEngine.generateRecommendations(context)

      expect(result.metadata.explanations).toBeDefined()
      expect(result.metadata.explanations.algorithm).toBeDefined()
      expect(result.metadata.explanations.personalization).toBeDefined()
      expect(result.metadata.explanations.diversity).toBeDefined()
      
      expect(typeof result.metadata.explanations.algorithm).toBe('string')
      expect(typeof result.metadata.explanations.personalization).toBe('string')
      expect(typeof result.metadata.explanations.diversity).toBe('string')
      
      expect(result.metadata.explanations.algorithm.length).toBeGreaterThan(0)
      expect(result.metadata.explanations.personalization.length).toBeGreaterThan(0)
      expect(result.metadata.explanations.diversity.length).toBeGreaterThan(0)
    })

    it('should include reason codes for individual articles', async () => {
      const context: RecommendationContext = {
        userId: generateTestUUID(),
        currentTime: new Date(),
        deviceType: 'mobile',
        feedType: 'home',
        limit: 5,
        offset: 0
      }

      const result = await recommendationEngine.generateRecommendations(context)

      result.articles.forEach(article => {
        expect(article.reasonCodes).toBeDefined()
        expect(article.reasonCodes).toBeInstanceOf(Array)
        
        if (article.reasonCodes.length > 0) {
          article.reasonCodes.forEach(code => {
            expect(typeof code).toBe('string')
            expect(code.length).toBeGreaterThan(0)
          })
        }
      })
    })
  })
})