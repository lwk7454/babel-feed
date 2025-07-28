import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'bun:test'
import { 
  ContentClassifier, 
  SimilarityEngine, 
  BehaviorAnalyzer, 
  RecommendationEngine,
  type RecommendationContext,
  type RecommendationConfig
} from '../modules/recommendation'
import { AiProviderManager } from '@babel-feed/llm-provider'
import { clearTestData } from '@babel-feed/pgdb'

describe('Recommendation System - Phase 5', () => {
  let contentClassifier: ContentClassifier
  let similarityEngine: SimilarityEngine
  let behaviorAnalyzer: BehaviorAnalyzer
  let recommendationEngine: RecommendationEngine
  let mockAiProvider: AiProviderManager

  beforeAll(async () => {
    // Set up test database
    
    // Initialize components
    mockAiProvider = new AiProviderManager()
    contentClassifier = new ContentClassifier(mockAiProvider)
    similarityEngine = new SimilarityEngine(mockAiProvider)
    behaviorAnalyzer = new BehaviorAnalyzer()
    recommendationEngine = new RecommendationEngine()
  })

  beforeEach(async () => {
    await clearTestData()
  })

  describe('ContentClassifier', () => {
    beforeEach(async () => {
      await contentClassifier.initialize()
    })

    it('should classify content with hierarchical tags', async () => {
      const title = 'Breaking: Tech Giants Announce AI Partnership'
      const content = 'Major technology companies have announced a new artificial intelligence partnership to develop cutting-edge machine learning solutions.'
      
      const result = await contentClassifier.classifyContent(title, content)
      
      expect(result).toBeDefined()
      expect(result.hierarchicalTags).toBeInstanceOf(Array)
      expect(result.hierarchicalTags.length).toBeGreaterThan(0)
      
      // Check for technology-related tags
      const techTags = result.hierarchicalTags.filter(tag => 
        tag.category === 'topic' && 
        ['technology', 'ai', 'artificial intelligence', 'tech'].includes(tag.label.toLowerCase())
      )
      expect(techTags.length).toBeGreaterThan(0)
    })

    it('should analyze sentiment correctly', async () => {
      const positiveContent = 'This amazing breakthrough will revolutionize the industry and bring great benefits to everyone.'
      const negativeContent = 'The terrible crisis has caused massive failures and devastating losses for the company.'
      const neutralContent = 'The company reported quarterly earnings and announced standard operational updates.'
      
      const positiveResult = await contentClassifier.classifyContent('Positive News', positiveContent)
      const negativeResult = await contentClassifier.classifyContent('Negative News', negativeContent)
      const neutralResult = await contentClassifier.classifyContent('Neutral News', neutralContent)
      
      expect(positiveResult.sentiment).toBe('positive')
      expect(negativeResult.sentiment).toBe('negative')
      expect(neutralResult.sentiment).toBe('neutral')
      
      expect(positiveResult.sentimentScore).toBeGreaterThan(0.5)
      expect(negativeResult.sentimentScore).toBeGreaterThan(0.5)
      expect(neutralResult.sentimentScore).toBeCloseTo(0.5, 1)
    })

    it('should extract geographic tags', async () => {
      const content = 'The United States and China announced a new trade agreement affecting markets in Tokyo and London.'
      
      const result = await contentClassifier.classifyContent('International Trade', content)
      
      expect(result.geographic).toBeInstanceOf(Array)
      expect(result.geographic.length).toBeGreaterThan(0)
      
      const countryTags = result.geographic.filter(tag => tag.type === 'country')
      const cityTags = result.geographic.filter(tag => tag.type === 'city')
      
      expect(countryTags.length).toBeGreaterThanOrEqual(1)
      expect(cityTags.length).toBeGreaterThanOrEqual(1)
    })

    it('should identify industry classifications', async () => {
      const content = 'The pharmaceutical company announced breakthrough results for its new biotechnology drug, targeting the healthcare market.'
      
      const result = await contentClassifier.classifyContent('Healthcare News', content)
      
      expect(result.industry).toBeInstanceOf(Array)
      expect(result.industry.length).toBeGreaterThan(0)
      
      const healthcareIndustry = result.industry.find(tag => 
        tag.sector === 'healthcare' || tag.subsector === 'pharmaceuticals'
      )
      expect(healthcareIndustry).toBeDefined()
    })

    it('should calculate topic scores', async () => {
      const content = 'Technology companies are investing heavily in artificial intelligence and machine learning research.'
      
      const result = await contentClassifier.classifyContent('Tech Investment', content)
      
      expect(result.topicScores).toBeDefined()
      expect(typeof result.topicScores).toBe('object')
      expect(Object.keys(result.topicScores).length).toBeGreaterThan(0)
      
      // Should have technology-related topics with higher scores
      const techScore = result.topicScores['technology'] || result.topicScores['tech'] || 0
      expect(techScore).toBeGreaterThan(0)
    })
  })

  describe('SimilarityEngine', () => {
    beforeEach(async () => {
      await similarityEngine.initialize()
    })

    it('should compute content vectors', async () => {
      const vector = await similarityEngine.computeContentVector(
        'article-1',
        'Technology News Update',
        'Latest developments in artificial intelligence and machine learning technologies.',
        ['technology', 'ai', 'news'],
        {
          language: 'en',
          category: 'technology',
          publishedAt: new Date()
        }
      )
      
      expect(vector).toBeDefined()
      expect(vector.articleId).toBe('article-1')
      expect(vector.titleVector).toBeInstanceOf(Array)
      expect(vector.contentVector).toBeInstanceOf(Array)
      expect(vector.tagVector).toBeInstanceOf(Array)
      expect(vector.compositeVector).toBeInstanceOf(Array)
      expect(vector.titleVector.length).toBe(5) // Default vector dimension
    })

    it('should calculate similarity between articles', async () => {
      const vector1 = await similarityEngine.computeContentVector(
        'article-1',
        'AI Technology Breakthrough',
        'Artificial intelligence research makes major breakthrough in machine learning.',
        ['ai', 'technology', 'research'],
        { language: 'en', category: 'technology', publishedAt: new Date() }
      )
      
      const vector2 = await similarityEngine.computeContentVector(
        'article-2', 
        'Machine Learning Advances',
        'New machine learning algorithms show promising results in AI applications.',
        ['machine-learning', 'ai', 'algorithms'],
        { language: 'en', category: 'technology', publishedAt: new Date() }
      )
      
      const vector3 = await similarityEngine.computeContentVector(
        'article-3',
        'Sports Championship Results',
        'The football championship concluded with an exciting final match.',
        ['sports', 'football', 'championship'],
        { language: 'en', category: 'sports', publishedAt: new Date() }
      )
      
      const similarity12 = await similarityEngine.computeSimilarity(vector1, vector2)
      const similarity13 = await similarityEngine.computeSimilarity(vector1, vector3)
      
      expect(similarity12.similarity).toBeGreaterThan(similarity13.similarity)
      expect(similarity12.type).toMatch(/semantic|topic|entity/)
      expect(similarity12.features).toBeDefined()
      expect(similarity12.explanation).toBeDefined()
    })

    it('should find similar articles', async () => {
      const targetVector = await similarityEngine.computeContentVector(
        'target',
        'Technology Innovation',
        'Innovation in technology sector drives market growth.',
        ['technology', 'innovation'],
        { language: 'en', category: 'technology', publishedAt: new Date() }
      )
      
      const candidates = [
        await similarityEngine.computeContentVector(
          'candidate-1',
          'Tech Market Analysis',
          'Analysis of technology market trends and growth patterns.',
          ['technology', 'market'],
          { language: 'en', category: 'technology', publishedAt: new Date() }
        ),
        await similarityEngine.computeContentVector(
          'candidate-2',
          'Sports News Update',
          'Latest sports news and game results from around the world.',
          ['sports', 'news'],
          { language: 'en', category: 'sports', publishedAt: new Date() }
        )
      ]
      
      const similar = await similarityEngine.findSimilarArticles(targetVector, candidates, 5)
      
      expect(similar).toBeInstanceOf(Array)
      expect(similar.length).toBeGreaterThan(0)
      expect(similar[0].similarity.similarity).toBeGreaterThan(0)
      
      // Technology article should be more similar than sports article
      const techArticle = similar.find(s => s.articleId === 'candidate-1')
      const sportsArticle = similar.find(s => s.articleId === 'candidate-2')
      
      if (techArticle && sportsArticle) {
        expect(techArticle.similarity.similarity).toBeGreaterThan(sportsArticle.similarity.similarity)
      }
    })
  })

  describe('BehaviorAnalyzer', () => {
    it('should track user interactions', async () => {
      const interaction = {
        articleId: 'test-article-1',
        userId: 'test-user-1',
        type: 'view' as const,
        timestamp: new Date(),
        duration: 120,
        metadata: { deviceType: 'mobile' }
      }
      
      await expect(behaviorAnalyzer.trackUserInteraction(interaction)).resolves.toBeUndefined()
    })

    it('should record feedback', async () => {
      const feedback = {
        userId: 'test-user-1',
        articleId: 'test-article-1',
        type: 'explicit' as const,
        action: 'like' as const,
        rating: 5,
        timestamp: new Date(),
        context: {
          position: 1,
          totalShown: 10,
          algorithm: 'hybrid-v1',
          reasonCodes: ['content-match', 'trending']
        }
      }
      
      await expect(behaviorAnalyzer.recordFeedback(feedback)).resolves.toBeUndefined()
    })

    it('should update reading patterns', async () => {
      const pattern = {
        timeOfDay: 9,
        dayOfWeek: 1,
        duration: 180,
        deviceType: 'mobile' as const,
        scrollDepth: 0.8
      }
      
      await expect(behaviorAnalyzer.updateReadingPattern('test-user-1', pattern)).resolves.toBeUndefined()
    })
  })

  describe('RecommendationEngine', () => {
    beforeEach(async () => {
      await recommendationEngine.initialize()
    })

    it('should initialize successfully', async () => {
      expect(recommendationEngine).toBeDefined()
    })

    it('should update configuration', async () => {
      const newConfig: Partial<RecommendationConfig> = {
        algorithms: {
          contentBased: { enabled: true, weight: 0.4, features: ['category', 'tags'] },
          collaborative: { enabled: false, weight: 0.0, minInteractions: 5 },
          trending: { enabled: true, weight: 0.3, timeWindow: 12 },
          personalized: { enabled: true, weight: 0.3, learningRate: 0.05 }
        }
      }
      
      await expect(recommendationEngine.updateConfig(newConfig)).resolves.toBeUndefined()
    })

    it('should generate trending topics', async () => {
      const topics = await recommendationEngine.getTrendingTopics(24, 5)
      
      expect(topics).toBeInstanceOf(Array)
      // Note: This might return empty array if no data in test environment
      if (topics.length > 0) {
        expect(topics[0]).toHaveProperty('topic')
        expect(topics[0]).toHaveProperty('score')
        expect(topics[0]).toHaveProperty('velocity')
        expect(topics[0]).toHaveProperty('timeWindow')
      }
    })

    it('should handle recommendation context validation', async () => {
      const validContext: RecommendationContext = {
        userId: 'test-user-1',
        currentTime: new Date(),
        deviceType: 'mobile',
        feedType: 'home',
        limit: 10,
        offset: 0
      }
      
      // Test with minimal valid context
      await expect(async () => {
        const result = await recommendationEngine.generateRecommendations(validContext)
        expect(result).toBeDefined()
        expect(result.articles).toBeInstanceOf(Array)
        expect(result.metadata).toBeDefined()
        expect(typeof result.hasMore).toBe('boolean')
      }).not.toThrow()
    })

    it('should handle filters correctly', async () => {
      const contextWithFilters: RecommendationContext = {
        userId: 'test-user-2',
        currentTime: new Date(),
        deviceType: 'desktop',
        feedType: 'category',
        limit: 5,
        offset: 0,
        filters: {
          languages: ['en'],
          categories: ['technology'],
          excludeSeen: true,
          timeRange: {
            start: new Date(Date.now() - 24 * 60 * 60 * 1000), // 24 hours ago
            end: new Date()
          }
        }
      }
      
      await expect(async () => {
        const result = await recommendationEngine.generateRecommendations(contextWithFilters)
        expect(result.metadata.appliedFilters).toContain('language')
        expect(result.metadata.appliedFilters).toContain('category')
        expect(result.metadata.appliedFilters).toContain('timeRange')
        expect(result.metadata.appliedFilters).toContain('excludeSeen')
      }).not.toThrow()
    })
  })

  describe('Integration Tests', () => {
    it('should work end-to-end for content classification and recommendation', async () => {
      // 1. Classify content
      const title = 'Revolutionary AI Technology Transforms Healthcare'
      const content = 'A groundbreaking artificial intelligence system is revolutionizing healthcare by providing accurate diagnoses and treatment recommendations.'
      
      const classification = await contentClassifier.classifyContent(title, content)
      
      expect(classification.hierarchicalTags.length).toBeGreaterThan(0)
      expect(classification.sentiment).toMatch(/positive|negative|neutral/)
      
      // 2. Create content vector
      const vector = await similarityEngine.computeContentVector(
        'integration-test-1',
        title,
        content,
        classification.hierarchicalTags.map(tag => tag.label),
        {
          language: 'en',
          category: 'technology',
          publishedAt: new Date()
        }
      )
      
      expect(vector.compositeVector.length).toBe(5)
      
      // 3. Test recommendation context
      const context: RecommendationContext = {
        userId: 'integration-test-user',
        currentTime: new Date(),
        deviceType: 'mobile',
        feedType: 'home',
        limit: 10,
        offset: 0,
        filters: {
          languages: ['en'],
          categories: ['technology', 'healthcare']
        }
      }
      
      // This should not throw even with no data
      await expect(recommendationEngine.generateRecommendations(context)).resolves.toBeDefined()
    })

    it('should handle error cases gracefully', async () => {
      // Test with empty content
      const emptyResult = await contentClassifier.classifyContent('', '')
      expect(emptyResult).toBeDefined()
      
      // Test with invalid user ID
      const invalidContext: RecommendationContext = {
        userId: '',
        currentTime: new Date(),
        deviceType: 'mobile',
        feedType: 'home',
        limit: 10,
        offset: 0
      }
      
      // Should handle gracefully
      await expect(recommendationEngine.generateRecommendations(invalidContext)).rejects.toThrow()
    })
  })

  afterAll(async () => {
    // Cleanup
    similarityEngine.clearCache()
  })
})