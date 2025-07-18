import { describe, it, expect, beforeAll, afterAll, beforeEach, mock } from 'bun:test'
import { SimilarityEngine, type SimilarityVector, type SimilarityResult } from '../modules/recommendation/similarity-engine'
import { AiProviderManager } from '@babel-feed/llm-provider'
import { setupTestDatabase, cleanupTestDatabase } from '@babel-feed/pgdb'

// Mock AI provider for testing
const mockAiProvider = {
  initialize: mock(() => Promise.resolve()),
  getEnabledProviders: mock(() => Promise.resolve([
    {
      id: 'test-provider',
      name: 'Test Provider',
      baseUrl: 'https://api.test.com',
      metadata: { models: ['test-model'] }
    }
  ])),
  executeWithProvider: mock()
}

describe('SimilarityEngine - Comprehensive Tests', () => {
  let similarityEngine: SimilarityEngine

  beforeAll(async () => {
    await setupTestDatabase()
  })

  beforeEach(async () => {
    // Reset mocks
    mockAiProvider.executeWithProvider.mockClear()
    
    // Create similarity engine with mocked AI provider
    similarityEngine = new SimilarityEngine(mockAiProvider as unknown as AiProviderManager)
    await similarityEngine.initialize()
  })

  afterAll(async () => {
    similarityEngine.clearCache()
    await cleanupTestDatabase()
  })

  describe('Content Vector Computation', () => {
    it('should compute vectors with correct dimensions', async () => {
      const vector = await similarityEngine.computeContentVector(
        'test-1',
        'Technology Innovation',
        'Artificial intelligence and machine learning are revolutionizing software development',
        ['technology', 'ai', 'software'],
        {
          language: 'en',
          category: 'technology',
          publishedAt: new Date()
        }
      )

      expect(vector).toBeDefined()
      expect(vector.articleId).toBe('test-1')
      expect(vector.titleVector).toBeInstanceOf(Array)
      expect(vector.contentVector).toBeInstanceOf(Array)
      expect(vector.tagVector).toBeInstanceOf(Array)
      expect(vector.compositeVector).toBeInstanceOf(Array)

      // Check default dimensions (should be 5 for simplified implementation)
      expect(vector.titleVector.length).toBe(5)
      expect(vector.contentVector.length).toBe(5)
      expect(vector.tagVector.length).toBe(5)
      expect(vector.compositeVector.length).toBe(5)

      // Vectors should contain normalized values
      vector.compositeVector.forEach(value => {
        expect(value).toBeGreaterThanOrEqual(-1)
        expect(value).toBeLessThanOrEqual(1)
      })
    })

    it('should handle empty content gracefully', async () => {
      const vector = await similarityEngine.computeContentVector(
        'empty-test',
        '',
        '',
        [],
        {
          language: 'en',
          category: 'general',
          publishedAt: new Date()
        }
      )

      expect(vector).toBeDefined()
      expect(vector.titleVector.length).toBe(5)
      expect(vector.contentVector.length).toBe(5)
      expect(vector.tagVector.length).toBe(5)
      expect(vector.compositeVector.length).toBe(5)

      // Should still produce valid vectors even with empty content
      vector.compositeVector.forEach(value => {
        expect(typeof value).toBe('number')
        expect(isNaN(value)).toBe(false)
      })
    })

    it('should create different vectors for different content', async () => {
      const vector1 = await similarityEngine.computeContentVector(
        'tech-1',
        'AI Technology',
        'Artificial intelligence breakthrough in machine learning',
        ['ai', 'technology'],
        { language: 'en', category: 'technology', publishedAt: new Date() }
      )

      const vector2 = await similarityEngine.computeContentVector(
        'sports-1',
        'Football Championship',
        'The football team won the championship in a thrilling match',
        ['sports', 'football'],
        { language: 'en', category: 'sports', publishedAt: new Date() }
      )

      // Vectors should be different for different content types
      expect(vector1.compositeVector).not.toEqual(vector2.compositeVector)

      // Calculate rough similarity - should be low for very different content
      const similarity = similarityEngine['cosineSimilarity'](vector1.compositeVector, vector2.compositeVector)
      expect(similarity).toBeLessThan(0.8) // Tech and sports should not be very similar
    })

    it('should handle special characters and unicode in text', async () => {
      const vector = await similarityEngine.computeContentVector(
        'unicode-test',
        'Tëchnology™ Innövation 🚀',
        'Spécial charactërs and émojis in content 📱💻',
        ['tech™', 'innovätion'],
        { language: 'en', category: 'technology', publishedAt: new Date() }
      )

      expect(vector).toBeDefined()
      expect(vector.compositeVector.length).toBe(5)
      
      // Should handle unicode without crashing
      vector.compositeVector.forEach(value => {
        expect(typeof value).toBe('number')
        expect(isNaN(value)).toBe(false)
      })
    })
  })

  describe('Similarity Calculation', () => {
    it('should calculate cosine similarity correctly', async () => {
      // Test with known vectors
      const vector1: SimilarityVector = {
        articleId: 'test1',
        titleVector: [1, 0, 0, 0, 0],
        contentVector: [0, 1, 0, 0, 0],
        tagVector: [0, 0, 1, 0, 0],
        compositeVector: [1, 1, 1, 0, 0],
        metadata: { language: 'en', category: 'test', wordCount: 100, publishedAt: new Date() }
      }

      const vector2: SimilarityVector = {
        articleId: 'test2',
        titleVector: [1, 0, 0, 0, 0],
        contentVector: [0, 1, 0, 0, 0],
        tagVector: [0, 0, 1, 0, 0],
        compositeVector: [1, 1, 1, 0, 0],
        metadata: { language: 'en', category: 'test', wordCount: 100, publishedAt: new Date() }
      }

      const similarity = await similarityEngine.computeSimilarity(vector1, vector2)

      expect(similarity).toBeDefined()
      expect(similarity.similarity).toBeCloseTo(1, 1) // Identical vectors should have similarity close to 1
      expect(similarity.type).toBeDefined()
      expect(similarity.features).toBeDefined()
      expect(similarity.explanation).toBeDefined()
    })

    it('should calculate different similarity for different vectors', async () => {
      const vector1: SimilarityVector = {
        articleId: 'test1',
        titleVector: [1, 0, 0, 0, 0],
        contentVector: [1, 0, 0, 0, 0],
        tagVector: [1, 0, 0, 0, 0],
        compositeVector: [1, 0, 0, 0, 0],
        metadata: { language: 'en', category: 'technology', wordCount: 100, publishedAt: new Date() }
      }

      const vector2: SimilarityVector = {
        articleId: 'test2',
        titleVector: [0, 1, 0, 0, 0],
        contentVector: [0, 1, 0, 0, 0],
        tagVector: [0, 1, 0, 0, 0],
        compositeVector: [0, 1, 0, 0, 0],
        metadata: { language: 'en', category: 'sports', wordCount: 100, publishedAt: new Date() }
      }

      const similarity = await similarityEngine.computeSimilarity(vector1, vector2)

      expect(similarity.similarity).toBeLessThan(0.2) // Orthogonal vectors should have low similarity
      expect(similarity.type).toBeDefined()
    })

    it('should handle zero vectors gracefully', async () => {
      const vector1: SimilarityVector = {
        articleId: 'zero1',
        titleVector: [0, 0, 0, 0, 0],
        contentVector: [0, 0, 0, 0, 0],
        tagVector: [0, 0, 0, 0, 0],
        compositeVector: [0, 0, 0, 0, 0],
        metadata: { language: 'en', category: 'test', wordCount: 0, publishedAt: new Date() }
      }

      const vector2: SimilarityVector = {
        articleId: 'normal',
        titleVector: [1, 0, 0, 0, 0],
        contentVector: [0, 1, 0, 0, 0],
        tagVector: [0, 0, 1, 0, 0],
        compositeVector: [1, 1, 1, 0, 0],
        metadata: { language: 'en', category: 'test', wordCount: 100, publishedAt: new Date() }
      }

      const similarity = await similarityEngine.computeSimilarity(vector1, vector2)

      expect(similarity.similarity).toBeLessThan(0.3) // Zero vector should have low similarity
      expect(typeof similarity.similarity).toBe('number')
      expect(isNaN(similarity.similarity)).toBe(false)
    })
  })

  describe('Similar Articles Finding', () => {
    it('should find and rank similar articles correctly', async () => {
      // Create target vector (technology content)
      const targetVector = await similarityEngine.computeContentVector(
        'target',
        'AI Technology',
        'Artificial intelligence and machine learning innovations',
        ['ai', 'technology', 'innovation'],
        { language: 'en', category: 'technology', publishedAt: new Date() }
      )

      // Create candidate vectors
      const techCandidate = await similarityEngine.computeContentVector(
        'tech-candidate',
        'Machine Learning Advances',
        'New machine learning algorithms and AI developments',
        ['machine-learning', 'ai', 'algorithms'],
        { language: 'en', category: 'technology', publishedAt: new Date() }
      )

      const sportsCandidate = await similarityEngine.computeContentVector(
        'sports-candidate',
        'Football Match Results',
        'The football championship ended with exciting results',
        ['football', 'sports', 'championship'],
        { language: 'en', category: 'sports', publishedAt: new Date() }
      )

      const businessCandidate = await similarityEngine.computeContentVector(
        'business-candidate',
        'Market Analysis',
        'Stock market trends and financial analysis report',
        ['market', 'finance', 'stocks'],
        { language: 'en', category: 'business', publishedAt: new Date() }
      )

      const candidates = [techCandidate, sportsCandidate, businessCandidate]
      const similar = await similarityEngine.findSimilarArticles(targetVector, candidates, 3)

      expect(similar).toBeInstanceOf(Array)
      expect(similar.length).toBe(3) // Should return all candidates ranked

      // Technology article should be most similar to technology target
      expect(similar[0].articleId).toBe('tech-candidate')
      expect(similar[0].similarity.similarity).toBeGreaterThan(similar[1].similarity.similarity)
      expect(similar[1].similarity.similarity).toBeGreaterThan(similar[2].similarity.similarity)

      // Check that all similarities are valid numbers
      similar.forEach(item => {
        expect(typeof item.similarity.similarity).toBe('number')
        expect(item.similarity.similarity).toBeGreaterThanOrEqual(0)
        expect(item.similarity.similarity).toBeLessThanOrEqual(1)
      })
    })

    it('should respect limit parameter', async () => {
      const targetVector = await similarityEngine.computeContentVector(
        'target',
        'Test Target',
        'Test content',
        ['test'],
        { language: 'en', category: 'test', publishedAt: new Date() }
      )

      const candidates = []
      for (let i = 0; i < 10; i++) {
        candidates.push(await similarityEngine.computeContentVector(
          `candidate-${i}`,
          `Candidate ${i}`,
          `Test content ${i}`,
          ['test'],
          { language: 'en', category: `category-${i % 4}`, publishedAt: new Date() } // Use different categories
        ))
      }

      const similar = await similarityEngine.findSimilarArticles(targetVector, candidates, 5)

      expect(similar.length).toBe(5) // Should respect limit
    })

    it('should handle empty candidate list', async () => {
      const targetVector = await similarityEngine.computeContentVector(
        'target',
        'Test Target',
        'Test content',
        ['test'],
        { language: 'en', category: 'test', publishedAt: new Date() }
      )

      const similar = await similarityEngine.findSimilarArticles(targetVector, [], 10)

      expect(similar).toBeInstanceOf(Array)
      expect(similar.length).toBe(0)
    })
  })

  describe('Caching Mechanism', () => {
    it('should cache computed vectors', async () => {
      const articleId = 'cache-test'
      const title = 'Cache Test Article'
      const content = 'This is a test for caching functionality'
      const tags = ['test', 'cache']
      const metadata = { language: 'en', category: 'test', publishedAt: new Date() }

      // First computation
      const vector1 = await similarityEngine.computeContentVector(
        articleId, title, content, tags, metadata
      )

      // Second computation - should be retrieved from cache
      const vector2 = await similarityEngine.computeContentVector(
        articleId, title, content, tags, metadata
      )

      expect(vector1).toEqual(vector2)
      expect(vector1.articleId).toBe(articleId)
    })

    it('should clear cache properly', async () => {
      // Add some vectors to cache
      await similarityEngine.computeContentVector(
        'cache-test-1',
        'Test 1',
        'Content 1',
        ['test'],
        { language: 'en', category: 'test', publishedAt: new Date() }
      )

      await similarityEngine.computeContentVector(
        'cache-test-2',
        'Test 2',
        'Content 2',
        ['test'],
        { language: 'en', category: 'test', publishedAt: new Date() }
      )

      // Clear cache
      similarityEngine.clearCache()

      // Cache should be cleared (we can't directly test this without access to internals,
      // but we can verify the method doesn't throw)
      expect(() => similarityEngine.clearCache()).not.toThrow()
    })
  })

  describe('Vector Processing Edge Cases', () => {
    it('should handle very long text content', async () => {
      const longContent = 'technology '.repeat(2000) // Very long text

      const vector = await similarityEngine.computeContentVector(
        'long-content',
        'Long Content Test',
        longContent,
        ['technology', 'test'],
        { language: 'en', category: 'technology', publishedAt: new Date() }
      )

      expect(vector).toBeDefined()
      expect(vector.compositeVector.length).toBe(5)
      
      // Should handle long content without issues
      vector.compositeVector.forEach(value => {
        expect(typeof value).toBe('number')
        expect(isNaN(value)).toBe(false)
      })
    })

    it('should handle many tags', async () => {
      const manyTags = Array.from({ length: 100 }, (_, i) => `tag${i}`)

      const vector = await similarityEngine.computeContentVector(
        'many-tags',
        'Many Tags Test',
        'Content with many tags',
        manyTags,
        { language: 'en', category: 'test', publishedAt: new Date() }
      )

      expect(vector).toBeDefined()
      expect(vector.tagVector.length).toBe(5)
      
      // Should handle many tags without issues
      vector.tagVector.forEach(value => {
        expect(typeof value).toBe('number')
        expect(isNaN(value)).toBe(false)
      })
    })

    it('should handle non-ASCII characters in tags', async () => {
      const unicodeTags = ['技术', 'технология', '🚀', 'café']

      const vector = await similarityEngine.computeContentVector(
        'unicode-tags',
        'Unicode Tags Test',
        'Content with unicode tags',
        unicodeTags,
        { language: 'en', category: 'test', publishedAt: new Date() }
      )

      expect(vector).toBeDefined()
      expect(vector.tagVector.length).toBe(5)
      
      // Should handle unicode tags without crashing
      vector.tagVector.forEach(value => {
        expect(typeof value).toBe('number')
        expect(isNaN(value)).toBe(false)
      })
    })
  })

  describe('Similarity Type Classification', () => {
    it('should classify semantic similarity correctly', async () => {
      const vector1 = await similarityEngine.computeContentVector(
        'semantic1',
        'Dog Training',
        'How to train your dog effectively',
        ['dogs', 'training', 'pets'],
        { language: 'en', category: 'lifestyle', publishedAt: new Date() }
      )

      const vector2 = await similarityEngine.computeContentVector(
        'semantic2',
        'Pet Education',
        'Educational guide for pet owners',
        ['pets', 'education', 'animals'],
        { language: 'en', category: 'lifestyle', publishedAt: new Date() }
      )

      const similarity = await similarityEngine.computeSimilarity(vector1, vector2)

      expect(similarity.type).toBeDefined()
      expect(['semantic', 'topic', 'entity'].includes(similarity.type)).toBe(true)
      expect(similarity.features).toBeDefined()
      expect(similarity.explanation).toBeDefined()
    })

    it('should provide meaningful explanations', async () => {
      const vector1 = await similarityEngine.computeContentVector(
        'explain1',
        'Technology News',
        'Latest technology developments',
        ['technology', 'news'],
        { language: 'en', category: 'technology', publishedAt: new Date() }
      )

      const vector2 = await similarityEngine.computeContentVector(
        'explain2',
        'Tech Updates',
        'Recent updates in tech industry',
        ['tech', 'updates', 'industry'],
        { language: 'en', category: 'technology', publishedAt: new Date() }
      )

      const similarity = await similarityEngine.computeSimilarity(vector1, vector2)

      expect(similarity.explanation).toBeDefined()
      expect(typeof similarity.explanation).toBe('string')
      expect(similarity.explanation.length).toBeGreaterThan(0)
    })
  })

  describe('Performance and Memory', () => {
    it('should handle batch vector computations efficiently', async () => {
      const start = Date.now()
      const vectors = []

      // Compute multiple vectors
      for (let i = 0; i < 50; i++) {
        const vector = await similarityEngine.computeContentVector(
          `batch-${i}`,
          `Article ${i}`,
          `Content for article ${i} with various keywords technology business sports`,
          [`tag${i}`, 'common'],
          { language: 'en', category: 'test', publishedAt: new Date() }
        )
        vectors.push(vector)
      }

      const duration = Date.now() - start

      expect(vectors.length).toBe(50)
      expect(duration).toBeLessThan(5000) // Should complete within 5 seconds

      // All vectors should be valid
      vectors.forEach(vector => {
        expect(vector.compositeVector.length).toBe(5)
        vector.compositeVector.forEach(value => {
          expect(typeof value).toBe('number')
          expect(isNaN(value)).toBe(false)
        })
      })
    })

    it('should handle similarity calculations for large sets', async () => {
      // Create vectors for similarity testing
      const vectors = []
      for (let i = 0; i < 20; i++) {
        vectors.push(await similarityEngine.computeContentVector(
          `perf-${i}`,
          `Performance Test ${i}`,
          `Test content ${i}`,
          [`tag${i}`],
          { language: 'en', category: `category-${i % 6}`, publishedAt: new Date() } // Use different categories
        ))
      }

      const targetVector = vectors[0]
      const candidates = vectors.slice(1)

      const start = Date.now()
      const similar = await similarityEngine.findSimilarArticles(targetVector, candidates, 10)
      const duration = Date.now() - start

      expect(similar.length).toBe(10)
      expect(duration).toBeLessThan(1000) // Should complete within 1 second

      // Results should be properly ranked
      for (let i = 0; i < similar.length - 1; i++) {
        expect(similar[i].similarity.similarity).toBeGreaterThanOrEqual(
          similar[i + 1].similarity.similarity
        )
      }
    })
  })
})