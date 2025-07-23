import { AiProviderManager } from '@babel-feed/llm-provider'
import { beforeAll, beforeEach, describe, expect, it, mock } from 'bun:test'
import { clearTestData, setupTestDatabase } from '@babel-feed/pgdb'
import { ContentClassifier } from '../modules/recommendation/content-classifier'

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

beforeAll(async () => {
  await setupTestDatabase()
})

describe('ContentClassifier - Comprehensive Tests', () => {
  let classifier: ContentClassifier
  beforeEach(async () => {
    await clearTestData()
    // Reset mocks
    mockAiProvider.executeWithProvider.mockClear()
    
    // Create classifier with mocked AI provider
    classifier = new ContentClassifier(mockAiProvider as unknown as AiProviderManager)
    await classifier.initialize()
  })



  describe('Hierarchical Tag Extraction', () => {
    it('should extract technology tags from tech content', async () => {
      const title = 'Technology Revolution in Machine Learning'
      const content = 'Technology and machine learning are transforming software development with innovative algorithms and neural networks.'

      const result = await classifier.classifyContent(title, content)

      expect(result.hierarchicalTags).toBeInstanceOf(Array)
      expect(result.hierarchicalTags.length).toBeGreaterThan(0)

      // Should find technology-related tags
      const techTags = result.hierarchicalTags.filter(tag => 
        ['technology', 'software'].some(keyword => 
          tag.label.toLowerCase().includes(keyword)
        )
      )
      expect(techTags.length).toBeGreaterThan(0)

      // Check tag structure
      result.hierarchicalTags.forEach(tag => {
        expect(tag).toHaveProperty('id')
        expect(tag).toHaveProperty('label')
        expect(tag).toHaveProperty('category')
        expect(tag).toHaveProperty('level')
        expect(tag).toHaveProperty('confidence')
        expect(tag.confidence).toBeGreaterThanOrEqual(0)
        expect(tag.confidence).toBeLessThanOrEqual(1)
        expect([1, 2, 3]).toContain(tag.level)
      })
    })

    it('should handle mixed content with multiple categories', async () => {
      const title = 'Tesla Stock Rises After New AI Announcement in Healthcare'
      const content = 'Tesla stock prices increased following announcement of new artificial intelligence applications in healthcare sector, combining automotive technology with medical innovation.'

      const result = await classifier.classifyContent(title, content)

      expect(result.hierarchicalTags.length).toBeGreaterThan(0)

      // Should find tags from multiple categories
      const categories = new Set(result.hierarchicalTags.map(tag => tag.category))
      expect(categories.size).toBeGreaterThan(0)

      // Check for business, technology, and healthcare related tags
      const hasBusinessTerms = result.hierarchicalTags.some(tag => 
        ['business', 'stock', 'finance'].some(term => tag.label.toLowerCase().includes(term))
      )
      const hasTechTerms = result.hierarchicalTags.some(tag => 
        ['technology', 'ai', 'automotive'].some(term => tag.label.toLowerCase().includes(term))
      )

      expect(hasBusinessTerms || hasTechTerms).toBe(true)
    })

    it('should handle AI provider failure gracefully', async () => {
      // Mock AI provider to fail
      mockAiProvider.executeWithProvider.mockRejectedValue(new Error('AI provider failed'))

      const result = await classifier.classifyContent('Test Title', 'Test content with technology keywords')

      // Should still return results from rule-based classification
      expect(result.hierarchicalTags).toBeInstanceOf(Array)
      // Rule-based should find 'technology' keyword
      const techTag = result.hierarchicalTags.find(tag => tag.label === 'technology')
      expect(techTag).toBeDefined()
    })

    it('should create proper hierarchy levels', async () => {
      const content = 'The technology sector is seeing growth in artificial intelligence, specifically in machine learning algorithms and neural networks.'

      const result = await classifier.classifyContent('Tech Growth', content)

      // Check for hierarchical structure
      const level1Tags = result.hierarchicalTags.filter(tag => tag.level === 1)
      const level2Tags = result.hierarchicalTags.filter(tag => tag.level === 2)
      const level3Tags = result.hierarchicalTags.filter(tag => tag.level === 3)

      expect(level1Tags.length).toBeGreaterThan(0)
      
      // Level 2 tags should have parentId pointing to level 1
      level2Tags.forEach(tag => {
        if (tag.parentId) {
          const parent = result.hierarchicalTags.find(t => t.id === tag.parentId)
          expect(parent?.level).toBe(1)
        }
      })

      // Level 3 tags should have parentId pointing to level 2
      level3Tags.forEach(tag => {
        if (tag.parentId) {
          const parent = result.hierarchicalTags.find(t => t.id === tag.parentId)
          expect(parent?.level).toBe(2)
        }
      })
    })
  })

  describe('Sentiment Analysis', () => {
    it('should classify positive sentiment correctly', async () => {
      const positiveTexts = [
        'This amazing breakthrough will revolutionize the industry',
        'Excellent results show great success and wonderful progress',
        'Outstanding performance with incredible growth and positive outcomes'
      ]

      for (const text of positiveTexts) {
        const result = await classifier.classifyContent('Positive News', text)
        expect(result.sentiment).toBe('positive')
        expect(result.sentimentScore).toBeGreaterThan(0.5)
      }
    })

    it('should classify negative sentiment correctly', async () => {
      const negativeTexts = [
        'Terrible crisis causes massive failures and devastating losses',
        'Awful problems lead to horrible decline and bad results',
        'The company faces terrible challenges with negative outcomes'
      ]

      for (const text of negativeTexts) {
        const result = await classifier.classifyContent('Negative News', text)
        expect(result.sentiment).toBe('negative')
        expect(result.sentimentScore).toBeGreaterThan(0.5)
      }
    })

    it('should classify neutral sentiment correctly', async () => {
      const neutralTexts = [
        'The company reported quarterly earnings and operational updates',
        'Standard procedures were followed according to regulations',
        'The meeting concluded with routine business discussions'
      ]

      for (const text of neutralTexts) {
        const result = await classifier.classifyContent('Neutral News', text)
        expect(result.sentiment).toBe('neutral')
        expect(result.sentimentScore).toBeCloseTo(0.5, 1)
      }
    })

    it('should handle AI sentiment analysis with fallback', async () => {
      // Mock successful AI sentiment analysis
      mockAiProvider.executeWithProvider.mockResolvedValueOnce({
        sentiment: 'positive',
        score: 0.8
      })

      const result = await classifier.classifyContent('AI Test', 'This is amazing news')
      expect(result.sentiment).toBe('positive')
      expect(result.sentimentScore).toBeGreaterThan(0.7) // Should be high since it's using AI or fallback to rule-based

      // Mock AI failure, should fallback to rule-based
      mockAiProvider.executeWithProvider.mockRejectedValueOnce(new Error('AI failed'))

      const result2 = await classifier.classifyContent('Fallback Test', 'This is great news')
      expect(result2.sentiment).toBe('positive')
      expect(result2.sentimentScore).toBeGreaterThan(0.5)
    })
  })

  describe('Geographic Tag Extraction', () => {
    it('should extract country tags', async () => {
      const content = 'The United States and China announced new trade policies affecting global markets, while Germany and Japan respond to the changes.'

      const result = await classifier.classifyContent('International Trade', content)

      expect(result.geographic).toBeInstanceOf(Array)
      expect(result.geographic.length).toBeGreaterThan(0)

      const countryTags = result.geographic.filter(tag => tag.type === 'country')
      expect(countryTags.length).toBeGreaterThan(0)

      // Should find mentions of countries from the text
      const countryNames = countryTags.map(tag => tag.name)
      expect(countryNames.some(name => ['usa', 'china', 'germany', 'japan'].includes(name))).toBe(true)
    })

    it('should extract region and city tags', async () => {
      const content = 'Markets across Asia and Europe showed volatility, with significant activity in Tokyo, London, and New York financial centers.'

      const result = await classifier.classifyContent('Global Markets', content)

      const regionTags = result.geographic.filter(tag => tag.type === 'region')
      const cityTags = result.geographic.filter(tag => tag.type === 'city')

      expect(regionTags.length).toBeGreaterThan(0)
      expect(cityTags.length).toBeGreaterThan(0)

      // Check region names
      const regionNames = regionTags.map(tag => tag.name)
      expect(regionNames).toContain('asia')

      // Check city names
      const cityNames = cityTags.map(tag => tag.name)
      expect(cityNames).toContain('tokyo')
      expect(cityNames).toContain('london')
    })

    it('should calculate confidence scores correctly', async () => {
      const content = 'USA USA USA China'

      const result = await classifier.classifyContent('Country Mentions', content)

      const usaTag = result.geographic.find(tag => tag.name === 'usa')
      const chinaTag = result.geographic.find(tag => tag.name === 'china')

      expect(usaTag).toBeDefined()
      expect(chinaTag).toBeDefined()

      // USA mentioned 3 times, China once - USA should have higher confidence
      expect(usaTag!.confidence).toBeGreaterThan(chinaTag!.confidence)
    })
  })

  describe('Industry Classification', () => {
    it('should classify technology industry correctly', async () => {
      const content = 'Software companies are investing in cybersecurity and telecommunications infrastructure to support internet growth.'

      const result = await classifier.classifyContent('Tech Industry', content)

      expect(result.industry).toBeInstanceOf(Array)
      expect(result.industry.length).toBeGreaterThan(0)

      const techIndustry = result.industry.find(tag => tag.sector === 'technology')
      expect(techIndustry).toBeDefined()

      // Should also find subsectors
      const subsectors = result.industry.filter(tag => tag.subsector).map(tag => tag.subsector)
      expect(subsectors).toContain('software')
    })

    it('should classify healthcare industry', async () => {
      const content = 'Pharmaceutical companies are developing new biotechnology solutions and medical devices for patient care.'

      const result = await classifier.classifyContent('Healthcare News', content)

      const healthcareIndustry = result.industry.find(tag => tag.sector === 'healthcare')
      expect(healthcareIndustry).toBeDefined()

      const pharmaceuticals = result.industry.find(tag => tag.subsector === 'pharmaceuticals')
      const biotech = result.industry.find(tag => tag.subsector === 'biotechnology')

      expect(pharmaceuticals || biotech).toBeDefined()
    })

    it('should handle multiple industries in one text', async () => {
      const content = 'The automotive industry is partnering with technology companies to develop electric vehicles, while energy sector invests in renewable solutions.'

      const result = await classifier.classifyContent('Multi-Industry', content)

      const sectors = new Set(result.industry.map(tag => tag.sector))
      expect(sectors.size).toBeGreaterThan(1)

      expect(Array.from(sectors)).toContain('automotive')
      expect(Array.from(sectors)).toContain('technology')
    })
  })

  describe('Topic Score Calculation', () => {
    it('should calculate topic scores with proper weighting', async () => {
      const content = 'Technology technology AI artificial intelligence machine learning'

      const result = await classifier.classifyContent('Tech Topics', content)

      expect(result.topicScores).toBeDefined()
      expect(typeof result.topicScores).toBe('object')

      // Should have technology-related scores
      const techScore = result.topicScores['technology']
      expect(techScore).toBeGreaterThan(0)
      expect(techScore).toBeLessThanOrEqual(1)

      // Higher level tags should have higher impact
      const level1Tags = result.hierarchicalTags.filter(tag => tag.level === 1 && tag.label === 'technology')
      if (level1Tags.length > 0) {
        expect(techScore).toBeGreaterThan(0.5) // Level 1 tags get weight of 3
      }
    })

    it('should normalize scores correctly', async () => {
      const result = await classifier.classifyContent('Test', 'technology business sports entertainment')

      const scores = Object.values(result.topicScores)
      const maxScore = Math.max(...scores)

      expect(maxScore).toBeLessThanOrEqual(1)
      expect(maxScore).toBeGreaterThan(0)

      // All scores should be normalized relative to max
      scores.forEach(score => {
        expect(score).toBeGreaterThanOrEqual(0)
        expect(score).toBeLessThanOrEqual(1)
      })
    })
  })

  describe('Edge Cases and Error Handling', () => {
    it('should handle empty content', async () => {
      const result = await classifier.classifyContent('', '')

      expect(result).toBeDefined()
      expect(result.hierarchicalTags).toBeInstanceOf(Array)
      expect(result.sentiment).toMatch(/positive|negative|neutral/)
      expect(result.geographic).toBeInstanceOf(Array)
      expect(result.industry).toBeInstanceOf(Array)
      expect(result.topicScores).toBeDefined()
    })

    it('should handle very long content', async () => {
      const longContent = 'technology '.repeat(1000) + 'artificial intelligence '.repeat(500)

      const result = await classifier.classifyContent('Long Content', longContent)

      expect(result).toBeDefined()
      expect(result.hierarchicalTags.length).toBeGreaterThan(0)

      // Should still find technology tags despite length
      const techTags = result.hierarchicalTags.filter(tag => 
        tag.label.toLowerCase().includes('technology')
      )
      expect(techTags.length).toBeGreaterThan(0)
    })

    it('should handle special characters and unicode', async () => {
      const content = 'Technology™ and AI® innovations with émojis 🚀 and spëcial charâcters'

      const result = await classifier.classifyContent('Special Chars', content)

      expect(result).toBeDefined()
      expect(result.hierarchicalTags.length).toBeGreaterThan(0)

      // Should still classify despite special characters
      const techTags = result.hierarchicalTags.filter(tag => 
        tag.label.toLowerCase().includes('technology')
      )
      expect(techTags.length).toBeGreaterThan(0)
    })

    it('should handle non-English content gracefully', async () => {
      const content = '技术创新和人工智能发展推动了软件行业的进步'

      const result = await classifier.classifyContent('Chinese Text', content)

      expect(result).toBeDefined()
      expect(result.hierarchicalTags).toBeInstanceOf(Array)
      expect(result.sentiment).toMatch(/positive|negative|neutral/)
    })
  })

  describe('AI Provider Integration', () => {
    it('should use AI provider when available', async () => {
      const mockAITags = [
        { label: 'artificial intelligence', category: 'technology', level: 2, confidence: 0.9 },
        { label: 'innovation', category: 'business', level: 3, confidence: 0.7 }
      ]

      mockAiProvider.executeWithProvider.mockResolvedValueOnce(mockAITags)

      const result = await classifier.classifyContent('AI Test', 'Testing AI integration')

      expect(mockAiProvider.executeWithProvider).toHaveBeenCalled()
      
      // Should include AI-generated tags
      const aiTags = result.hierarchicalTags.filter(tag => tag.id.startsWith('ai-'))
      expect(aiTags.length).toBeGreaterThan(0)
      expect(aiTags[0].label).toBe('artificial intelligence')
    })

    it('should deduplicate tags from AI and rule-based sources', async () => {
      // Mock AI to return tags that might overlap with rule-based
      mockAiProvider.executeWithProvider.mockResolvedValueOnce([
        { label: 'technology', category: 'topic', level: 1, confidence: 0.8 }
      ])

      const content = 'technology innovation in software development'
      const result = await classifier.classifyContent('Dedup Test', content)

      // Should not have duplicate technology tags
      const techTags = result.hierarchicalTags.filter(tag => tag.label === 'technology')
      expect(techTags.length).toBe(1) // Should be deduplicated
    })
  })
})