import { describe, it, expect, beforeEach, mock } from 'bun:test'
import { FetcherService } from '../modules/aggregator/fetcher'
import { NewsSource } from '../modules/common/types'

// Mock newspaper4k-ts
mock.module('../../../../../packages/newspaper4k-ts/src/article', () => ({
  Article: class MockArticle {
    url: string
    title: string = ''
    text: string = ''
    authors: string[] = []
    publishDate: Date | null = null
    images: string[] = []
    movies: string[] = []
    metaDescription: string = ''
    metaKeywords: string[] = []
    language: string = ''
    
    constructor(url: string, config: any) {
      this.url = url
      // Mock configuration will be used by test setup
    }
    
    async build() {
      // Mock implementation will be set by individual tests
    }
    
    isValidArticle(): boolean {
      return this.title.length > 0 && this.publishDate !== null
    }
    
    getExtractionResult() {
      return {
        title: this.title,
        text: this.text,
        authors: this.authors,
        publishDate: this.publishDate,
        images: this.images,
        videos: this.movies,
        language: this.language,
        meta: {
          description: this.metaDescription,
          keywords: this.metaKeywords,
          siteName: 'Mock Site',
          canonicalUrl: this.url
        }
      }
    }
    
    getStats() {
      return {
        wordCount: this.text.split(' ').length,
        readingTime: Math.ceil(this.text.split(' ').length / 200),
        complexity: 0.5,
        sentenceCount: 1,
        paragraphCount: 1,
        imageCount: this.images.length,
        videoCount: this.movies.length,
        keywordCount: this.metaKeywords.length
      }
    }
  }
}));

let mockArticleInstance: any

describe('HTML Content Extraction with Newspaper4k-TS', () => {
  let fetcherService: FetcherService
  let mockSource: NewsSource

  beforeEach(() => {
    fetcherService = new FetcherService()
    mockSource = {
      id: 'test-source',
      name: 'Test News Source',
      slug: 'test-news',
      url: 'https://example.com/rss',
      sourceType: 'html' as const,
      language: 'en',
      category: 'general',
      tags: ['test'],
      enabled: true,
      pollingInterval: 3600000,
      reliability: 0.95,
      priority: 1,
      successCount: 10,
      errorCount: 1,
      metadata: {},
    }

    // Reset mock article instance
    const { Article } = require('../../../../../packages/newspaper4k-ts/src/article')
    mockArticleInstance = new Article('', {})
  })

  describe('Newspaper4k-TS Integration', () => {
    it('should extract article using newspaper4k-ts', async () => {
      // Setup mock article data
      mockArticleInstance.title = 'Test Article Title'
      mockArticleInstance.text = 'This is a comprehensive test article with sufficient content to pass validation checks and provide meaningful information to readers.'
      mockArticleInstance.authors = ['John Doe']
      mockArticleInstance.publishDate = new Date('2024-01-15T10:00:00Z')
      mockArticleInstance.images = ['https://example.com/image.jpg']
      mockArticleInstance.language = 'en'
      mockArticleInstance.metaDescription = 'This is a test article description with sufficient length to pass validation'
      mockArticleInstance.metaKeywords = ['test', 'article', 'news']
      
      // Mock the build method to setup the article
      mockArticleInstance.build = mock(async () => {
        // Article data is already set above
      })

      const articles = await fetcherService.fetchHTML('https://example.com/article', mockSource)

      expect(articles).toHaveLength(1)
      expect(articles[0]).toMatchObject({
        url: 'https://example.com/article',
        title: 'Test Article Title',
        description: 'This is a test article description with sufficient length to pass validation',
        imageUrl: 'https://example.com/image.jpg',
        author: 'John Doe',
        source: 'Test News Source',
        sourceLanguage: 'en',
        metadata: { 
          extractor: 'newspaper4k-ts',
          wordCount: expect.any(Number),
          readingTime: expect.any(Number),
          complexity: expect.any(Number),
          keywords: 'test,article,news',
          siteName: 'Mock Site',
          canonicalUrl: 'https://example.com/article'
        }
      })
      expect(articles[0].publishedAt).toBeInstanceOf(Date)
    })

    it('should generate description from article text when meta description is insufficient', async () => {
      mockArticleInstance.title = 'Article Title from H1'
      mockArticleInstance.text = 'First paragraph content that serves as description. This is a longer paragraph with more detailed content that would be used for description generation.'
      mockArticleInstance.publishDate = new Date('2024-01-15T10:00:00Z')
      mockArticleInstance.metaDescription = 'Short' // Too short, should fallback to text
      mockArticleInstance.language = 'en'
      
      mockArticleInstance.build = mock(async () => {})

      const articles = await fetcherService.fetchHTML('https://example.com/article', mockSource)

      expect(articles).toHaveLength(1)
      expect(articles[0].title).toBe('Article Title from H1')
      expect(articles[0].description).toBe('First paragraph content that serves as description. This is a longer paragraph with more detailed content that would be used for description generation.')
    })

    it('should return empty array when required fields missing', async () => {
      mockArticleInstance.title = '' // Missing title
      mockArticleInstance.publishDate = null // Missing date
      mockArticleInstance.text = 'Article without title or date'
      
      mockArticleInstance.build = mock(async () => {})

      const articles = await fetcherService.fetchHTML('https://example.com/article', mockSource)

      expect(articles).toHaveLength(0)
    })

    it('should return empty array when article quality validation fails', async () => {
      mockArticleInstance.title = 'Test Article'
      mockArticleInstance.publishDate = new Date('2024-01-15T10:00:00Z')
      mockArticleInstance.text = 'Short' // Too short to pass validation
      
      // Mock isValidArticle to return false
      mockArticleInstance.isValidArticle = mock(() => false)
      mockArticleInstance.build = mock(async () => {})

      const articles = await fetcherService.fetchHTML('https://example.com/article', mockSource)

      expect(articles).toHaveLength(0)
    })
  })

  describe('Multi-author Support', () => {
    it('should handle multiple authors correctly', async () => {
      mockArticleInstance.title = 'Multi-author Article'
      mockArticleInstance.text = 'This is an article written by multiple authors with comprehensive content.'
      mockArticleInstance.authors = ['Alice Smith', 'Bob Johnson', 'Carol Davis']
      mockArticleInstance.publishDate = new Date('2024-01-15T10:00:00Z')
      mockArticleInstance.language = 'en'
      
      mockArticleInstance.build = mock(async () => {})

      const articles = await fetcherService.fetchHTML('https://example.com/article', mockSource)

      expect(articles).toHaveLength(1)
      expect(articles[0].author).toBe('Alice Smith, Bob Johnson, Carol Davis')
    })

    it('should handle articles with no authors', async () => {
      mockArticleInstance.title = 'Anonymous Article'
      mockArticleInstance.text = 'This is an article with no specified authors.'
      mockArticleInstance.authors = []
      mockArticleInstance.publishDate = new Date('2024-01-15T10:00:00Z')
      mockArticleInstance.language = 'en'
      
      mockArticleInstance.build = mock(async () => {})

      const articles = await fetcherService.fetchHTML('https://example.com/article', mockSource)

      expect(articles).toHaveLength(1)
      expect(articles[0].author).toBeUndefined()
    })
  })

  describe('Fallback Detection', () => {
    it('should recommend fallback when RSS returns no articles', async () => {
      const shouldFallback = await fetcherService.shouldFallbackToHtml(mockSource, [])
      expect(shouldFallback).toBe(true)
    })

    it('should recommend fallback when RSS returns undefined', async () => {
      const shouldFallback = await fetcherService.shouldFallbackToHtml(mockSource, undefined)
      expect(shouldFallback).toBe(true)
    })

    it('should recommend fallback when RSS articles are too short', async () => {
      const shortArticles = [
        {
          url: 'https://example.com/1',
          title: 'Article 1',
          description: 'Short',
          publishedAt: new Date(),
          source: 'Test',
          sourceLanguage: 'en',
        },
        {
          url: 'https://example.com/2',
          title: 'Article 2',
          description: 'Also short',
          publishedAt: new Date(),
          source: 'Test',
          sourceLanguage: 'en',
        },
      ]

      const shouldFallback = await fetcherService.shouldFallbackToHtml(mockSource, shortArticles)
      expect(shouldFallback).toBe(true)
    })

    it('should not recommend fallback for good RSS content', async () => {
      const goodArticles = [
        {
          url: 'https://example.com/1',
          title: 'Article 1',
          description: 'This is a comprehensive article description with sufficient length and detail to provide value to readers',
          publishedAt: new Date(),
          source: 'Test',
          sourceLanguage: 'en',
        },
        {
          url: 'https://example.com/2',
          title: 'Article 2',
          description: 'Another well-written article with detailed content that provides meaningful information to users',
          publishedAt: new Date(),
          source: 'Test',
          sourceLanguage: 'en',
        },
      ]

      const shouldFallback = await fetcherService.shouldFallbackToHtml(mockSource, goodArticles)
      expect(shouldFallback).toBe(false)
    })
  })

  describe('Error Handling', () => {
    it('should handle newspaper4k-ts extraction errors gracefully', async () => {
      mockArticleInstance.build = mock(async () => {
        throw new Error('Failed to download article')
      })

      await expect(fetcherService.fetchHTML('https://example.com/article', mockSource))
        .rejects.toThrow('HTML extraction failed: Failed to download article')
    })

    it('should handle invalid URLs gracefully', async () => {
      mockArticleInstance.build = mock(async () => {
        throw new Error('Invalid URL: not-a-valid-url')
      })

      await expect(fetcherService.fetchHTML('not-a-valid-url', mockSource))
        .rejects.toThrow('HTML extraction failed: Invalid URL: not-a-valid-url')
    })

    it('should handle network timeouts gracefully', async () => {
      mockArticleInstance.build = mock(async () => {
        throw new Error('Request timeout')
      })

      await expect(fetcherService.fetchHTML('https://example.com/article', mockSource))
        .rejects.toThrow('HTML extraction failed: Request timeout')
    })

    it('should handle parsing errors gracefully', async () => {
      mockArticleInstance.build = mock(async () => {
        throw new Error('Failed to parse HTML content')
      })

      await expect(fetcherService.fetchHTML('https://example.com/article', mockSource))
        .rejects.toThrow('HTML extraction failed: Failed to parse HTML content')
    })
  })

  describe('Content Quality Validation', () => {
    it('should validate minimum content requirements', async () => {
      mockArticleInstance.title = 'Quality Article'
      mockArticleInstance.text = 'This is a comprehensive article with sufficient content length and quality to meet all validation requirements and provide value to readers.'
      mockArticleInstance.publishDate = new Date('2024-01-15T10:00:00Z')
      mockArticleInstance.language = 'en'
      
      // Mock quality validation to pass
      mockArticleInstance.isValidArticle = mock(() => true)
      mockArticleInstance.build = mock(async () => {})

      const articles = await fetcherService.fetchHTML('https://example.com/article', mockSource)
      expect(articles).toHaveLength(1)
      expect(articles[0].title).toBe('Quality Article')
    })

    it('should reject articles that fail quality validation', async () => {
      mockArticleInstance.title = 'Poor Quality Article'
      mockArticleInstance.text = 'Short'
      mockArticleInstance.publishDate = new Date('2024-01-15T10:00:00Z')
      
      // Mock quality validation to fail
      mockArticleInstance.isValidArticle = mock(() => false)
      mockArticleInstance.build = mock(async () => {})

      const articles = await fetcherService.fetchHTML('https://example.com/article', mockSource)
      expect(articles).toHaveLength(0)
    })

    it('should accept articles with recent publication dates', async () => {
      const recentDate = new Date()
      recentDate.setDate(recentDate.getDate() - 1) // Yesterday

      mockArticleInstance.title = 'Recent Article'
      mockArticleInstance.text = 'This is a recent article with current and relevant content.'
      mockArticleInstance.publishDate = recentDate
      mockArticleInstance.language = 'en'
      
      mockArticleInstance.build = mock(async () => {})

      const articles = await fetcherService.fetchHTML('https://example.com/article', mockSource)
      expect(articles).toHaveLength(1)
      expect(articles[0].publishedAt).toBeInstanceOf(Date)
    })
  })

  describe('Language and Metadata Handling', () => {
    it('should use source language preference in configuration', async () => {
      mockSource.language = 'zh-CN'
      
      mockArticleInstance.title = 'Chinese Article'
      mockArticleInstance.text = 'This is an article in Chinese language.'
      mockArticleInstance.publishDate = new Date('2024-01-15T10:00:00Z')
      mockArticleInstance.language = 'zh-CN'
      
      mockArticleInstance.build = mock(async () => {})

      const articles = await fetcherService.fetchHTML('https://example.com/article', mockSource)
      expect(articles).toHaveLength(1)
      expect(articles[0].sourceLanguage).toBe('zh-CN')
    })

    it('should include comprehensive metadata in results', async () => {
      mockArticleInstance.title = 'Metadata Test Article'
      mockArticleInstance.text = 'This article tests metadata extraction and inclusion.'
      mockArticleInstance.publishDate = new Date('2024-01-15T10:00:00Z')
      mockArticleInstance.language = 'en'
      mockArticleInstance.metaKeywords = ['test', 'metadata', 'extraction']
      
      mockArticleInstance.build = mock(async () => {})

      const articles = await fetcherService.fetchHTML('https://example.com/article', mockSource)
      expect(articles).toHaveLength(1)
      expect(articles[0].metadata).toMatchObject({
        extractor: 'newspaper4k-ts',
        wordCount: expect.any(Number),
        readingTime: expect.any(Number),
        complexity: expect.any(Number),
        keywords: 'test,metadata,extraction',
        siteName: 'Mock Site',
        canonicalUrl: 'https://example.com/article'
      })
    })
  })

  describe('Image Handling', () => {
    it('should extract and use first image as main image', async () => {
      mockArticleInstance.title = 'Article with Images'
      mockArticleInstance.text = 'This article contains multiple images.'
      mockArticleInstance.publishDate = new Date('2024-01-15T10:00:00Z')
      mockArticleInstance.images = ['https://example.com/image1.jpg', 'https://example.com/image2.jpg']
      mockArticleInstance.language = 'en'
      
      mockArticleInstance.build = mock(async () => {})

      const articles = await fetcherService.fetchHTML('https://example.com/article', mockSource)
      expect(articles).toHaveLength(1)
      expect(articles[0].imageUrl).toBe('https://example.com/image1.jpg')
    })

    it('should handle articles with no images', async () => {
      mockArticleInstance.title = 'Article without Images'
      mockArticleInstance.text = 'This article has no images.'
      mockArticleInstance.publishDate = new Date('2024-01-15T10:00:00Z')
      mockArticleInstance.images = []
      mockArticleInstance.language = 'en'
      
      mockArticleInstance.build = mock(async () => {})

      const articles = await fetcherService.fetchHTML('https://example.com/article', mockSource)
      expect(articles).toHaveLength(1)
      expect(articles[0].imageUrl).toBeUndefined()
    })
  })
})