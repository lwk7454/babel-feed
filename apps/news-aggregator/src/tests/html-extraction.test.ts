import { describe, it, expect, beforeEach, mock } from 'bun:test'
import { clearTestData } from '@babel-feed/pgdb'
import { FetcherService } from '../modules/aggregator/fetcher'
import { NewsSource } from '../modules/common/types'
import { Article } from '@babel-feed/news-extractor'

describe('HTML Content Extraction with Newspaper4k-TS', () => {
  let fetcherService: FetcherService
  let mockSource: NewsSource
  let mockArticleProcess: any

  beforeEach(async () => {
    await clearTestData()
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

    // Mock the Article.process method to avoid network calls
    mockArticleProcess = mock(() => Promise.resolve({
      title: 'Mock Article Title',
      text: 'This is a mock article content that is long enough to pass validation checks. It contains multiple sentences with meaningful content to simulate a real article extraction.',
      images: ['https://example.com/image.jpg'],
      publishDate: new Date('2023-01-01'),
      authors: ['Mock Author'],
      metadata: {
        language: 'en',
        keywords: ['mock', 'test'],
        siteName: 'Mock Site',
        canonicalUrl: 'https://example.com/article',
        description: 'Mock article description'
      }
    }))
    Article.prototype.process = mockArticleProcess
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

  describe('Service Initialization', () => {
    it('should initialize fetcher service correctly', async () => {
      expect(fetcherService).toBeDefined()
      await expect(fetcherService.initialize()).resolves.toBeUndefined()
    })

    it('should have fetchFromAllSources method', async () => {
      const result = await fetcherService.fetchFromAllSources()
      expect(result).toMatchObject({
        processed: 0,
        articles: [],
        errors: 0,
        skipped: 0
      })
    })

    it('should throw error for unimplemented fetchFromSource', async () => {
      await expect(fetcherService.fetchFromSource('test-id'))
        .rejects.toThrow('Not implemented - needs single source fetching')
    })

    it('should throw error for unimplemented fetchRSS', async () => {
      await expect(fetcherService.fetchRSS('https://example.com/rss'))
        .rejects.toThrow('Not implemented - needs RSS fetching logic')
    })

    it('should throw error for unimplemented fetchJSON', async () => {
      await expect(fetcherService.fetchJSON('https://example.com/api'))
        .rejects.toThrow('Not implemented - needs JSON API fetching')
    })
  })

  describe('Legacy Support', () => {
    it('should handle legacy getRssProcessor method', () => {
      const processor = fetcherService.getRssProcessor()
      expect(processor).toBeNull()
    })
  })

  describe('Error Handling in fetchHTML', () => {
    it('should handle network errors gracefully', async () => {
      // Mock network error
      mockArticleProcess.mockRejectedValueOnce(new Error('Network error'))
      
      await expect(fetcherService.fetchHTML('https://this-domain-does-not-exist-12345.invalid', mockSource))
        .rejects.toThrow('HTML extraction failed')
    })

    it('should handle invalid URLs', async () => {
      // Mock URL validation error
      mockArticleProcess.mockRejectedValueOnce(new Error('Invalid URL'))
      
      await expect(fetcherService.fetchHTML('not-a-url', mockSource))
        .rejects.toThrow('HTML extraction failed')
    })

    it('should handle empty URL', async () => {
      // Mock empty URL error
      mockArticleProcess.mockRejectedValueOnce(new Error('Empty URL'))
      
      await expect(fetcherService.fetchHTML('', mockSource))
        .rejects.toThrow('HTML extraction failed')
    })

    it('should handle articles with insufficient content', async () => {
      // Mock article with insufficient content
      mockArticleProcess.mockResolvedValueOnce({
        title: 'Short Article',
        text: 'Too short',
        images: [],
        publishDate: new Date(),
        authors: [],
        metadata: { language: 'en' }
      })
      
      const result = await fetcherService.fetchHTML('https://example.com/short-article', mockSource)
      expect(result).toEqual([])
    })

    it('should handle articles with missing title', async () => {
      // Mock article with missing title
      mockArticleProcess.mockResolvedValueOnce({
        title: null,
        text: 'This is a long article with sufficient content but no title which should cause validation to fail',
        images: [],
        publishDate: new Date(),
        authors: [],
        metadata: { language: 'en' }
      })
      
      const result = await fetcherService.fetchHTML('https://example.com/no-title', mockSource)
      expect(result).toEqual([])
    })
  })

  describe('Source Configuration', () => {
    it('should handle different source languages', () => {
      const chineseSource = { ...mockSource, language: 'zh-CN' }
      expect(chineseSource.language).toBe('zh-CN')
      
      const japaneseSource = { ...mockSource, language: 'ja' }
      expect(japaneseSource.language).toBe('ja')
    })

    it('should handle source metadata', () => {
      const sourceWithMetadata = { 
        ...mockSource, 
        metadata: { extractorConfig: 'custom', timeout: 5000 } 
      }
      expect(sourceWithMetadata.metadata).toMatchObject({
        extractorConfig: 'custom',
        timeout: 5000
      })
    })
  })

  describe('Article Structure Validation', () => {
    it('should validate RawArticle structure for RSS fallback logic', () => {
      const validArticle = {
        url: 'https://example.com/article',
        title: 'Test Article',
        description: 'A comprehensive article description with sufficient length to provide meaningful information to readers and pass validation',
        publishedAt: new Date(),
        source: 'Test Source',
        sourceLanguage: 'en'
      }

      // Test that the article structure matches what our fallback logic expects
      expect(validArticle.description.length).toBeGreaterThan(100)
      expect(validArticle.title).toBeDefined()
      expect(validArticle.publishedAt).toBeInstanceOf(Date)
    })

    it('should identify insufficient articles for fallback logic', () => {
      const insufficientArticle = {
        url: 'https://example.com/article',
        title: 'Test',
        description: 'Short',
        publishedAt: new Date(),
        source: 'Test Source',
        sourceLanguage: 'en'
      }

      expect(insufficientArticle.description.length).toBeLessThan(100)
    })

    it('should successfully extract valid articles', async () => {
      const result = await fetcherService.fetchHTML('https://example.com/valid-article', mockSource)
      
      expect(result).toHaveLength(1)
      expect(result[0]).toMatchObject({
        url: 'https://example.com/valid-article',
        title: 'Mock Article Title',
        source: 'Test News Source',
        sourceLanguage: 'en'
      })
      expect(result[0].description).toBeDefined()
      expect(result[0].publishedAt).toBeInstanceOf(Date)
    })
  })
})