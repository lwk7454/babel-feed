import { describe, it, expect, beforeEach, mock } from 'bun:test'
import axios from 'axios'
import { FetcherService } from '../modules/aggregator/fetcher'
import { NewsSource } from '../modules/common/types'

// Mock axios
mock.module('axios', () => ({
  default: {
    get: mock(),
    isAxiosError: mock().mockReturnValue(false),
  },
}))

const mockedAxios = axios as any

describe('HTML Content Extraction', () => {
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

    // Reset mocks
    mockedAxios.get.mockReset()
    mockedAxios.isAxiosError.mockReturnValue(false)
  })

  describe('Generic HTML Extraction', () => {
    it('should extract article from generic HTML with meta tags', async () => {
      const mockHtml = `
        <html>
          <head>
            <title>Test Article Title</title>
            <meta property="og:title" content="Test Article Title">
            <meta property="og:description" content="This is a test article description with sufficient length to pass validation">
            <meta property="og:image" content="https://example.com/image.jpg">
            <meta property="article:published_time" content="2024-01-15T10:00:00Z">
            <meta name="author" content="John Doe">
          </head>
          <body>
            <h1>Test Article Title</h1>
            <p>This is a test article description with sufficient length to pass validation</p>
          </body>
        </html>
      `

      mockedAxios.get.mockResolvedValue({ data: mockHtml })

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
        metadata: { extractor: 'generic' }
      })
      expect(articles[0].publishedAt).toBeInstanceOf(Date)
    })

    it('should extract article using h1 title when meta tags missing', async () => {
      const mockHtml = `
        <html>
          <body>
            <h1>Article Title from H1</h1>
            <meta property="article:published_time" content="2024-01-15T10:00:00Z">
            <p>First paragraph content that serves as description</p>
          </body>
        </html>
      `

      mockedAxios.get.mockResolvedValue({ data: mockHtml })

      const articles = await fetcherService.fetchHTML('https://example.com/article', mockSource)

      expect(articles).toHaveLength(1)
      expect(articles[0].title).toBe('Article Title from H1')
      expect(articles[0].description).toBe('First paragraph content that serves as description')
    })

    it('should return empty array when required fields missing', async () => {
      const mockHtml = `
        <html>
          <body>
            <p>Article without title or date</p>
          </body>
        </html>
      `

      mockedAxios.get.mockResolvedValue({ data: mockHtml })

      const articles = await fetcherService.fetchHTML('https://example.com/article', mockSource)

      expect(articles).toHaveLength(0)
    })

    it('should reject articles with invalid dates', async () => {
      const mockHtml = `
        <html>
          <head>
            <title>Test Article</title>
            <meta property="article:published_time" content="2020-01-01T00:00:00Z">
          </head>
          <body>
            <h1>Test Article</h1>
          </body>
        </html>
      `

      mockedAxios.get.mockResolvedValue({ data: mockHtml })

      const articles = await fetcherService.fetchHTML('https://example.com/article', mockSource)

      expect(articles).toHaveLength(0)
    })
  })

  describe('Site-Specific Extraction', () => {
    describe('CNN Extraction', () => {
      it('should extract CNN article with specific selectors', async () => {
        const mockHtml = `
          <html>
            <head>
              <meta name="pubdate" content="2024-01-15T10:00:00Z">
              <meta name="author" content="CNN Reporter">
              <meta property="og:image" content="https://cdn.cnn.com/image.jpg">
            </head>
            <body>
              <h1 class="headline__text">Breaking: CNN News Title</h1>
              <div class="zn-body__paragraph">This is the first paragraph of the CNN article with sufficient content.</div>
              <span class="byline__name">CNN Reporter</span>
            </body>
          </html>
        `

        mockedAxios.get.mockResolvedValue({ data: mockHtml })

        const articles = await fetcherService.fetchHTML('https://cnn.com/article', mockSource)

        expect(articles).toHaveLength(1)
        expect(articles[0]).toMatchObject({
          title: 'Breaking: CNN News Title',
          description: 'This is the first paragraph of the CNN article with sufficient content.',
          imageUrl: 'https://cdn.cnn.com/image.jpg',
          author: 'CNN Reporter',
          metadata: { extractor: 'cnn' }
        })
      })

      it('should fallback to meta tags when CNN selectors fail', async () => {
        const mockHtml = `
          <html>
            <head>
              <meta name="description" content="CNN article description from meta tag">
              <meta name="pubdate" content="2024-01-15T10:00:00Z">
            </head>
            <body>
              <h1 class="headline__text">CNN Title</h1>
            </body>
          </html>
        `

        mockedAxios.get.mockResolvedValue({ data: mockHtml })

        const articles = await fetcherService.fetchHTML('https://cnn.com/article', mockSource)

        expect(articles).toHaveLength(1)
        expect(articles[0].description).toBe('CNN article description from meta tag')
      })
    })

    describe('BBC Extraction', () => {
      it('should extract BBC article with specific selectors', async () => {
        const mockHtml = `
          <html>
            <head>
              <meta property="og:image" content="https://ichef.bbci.co.uk/image.jpg">
            </head>
            <body>
              <h1 data-testid="headline">BBC Breaking News Story</h1>
              <p data-testid="paragraph">First paragraph of BBC article with detailed content.</p>
              <p data-testid="byline">BBC News Reporter</p>
              <time datetime="2024-01-15T10:00:00Z">15 January 2024</time>
            </body>
          </html>
        `

        mockedAxios.get.mockResolvedValue({ data: mockHtml })

        const articles = await fetcherService.fetchHTML('https://bbc.com/article', mockSource)

        expect(articles).toHaveLength(1)
        expect(articles[0]).toMatchObject({
          title: 'BBC Breaking News Story',
          description: 'First paragraph of BBC article with detailed content.',
          imageUrl: 'https://ichef.bbci.co.uk/image.jpg',
          author: 'BBC News Reporter',
          metadata: { extractor: 'bbc' }
        })
      })

      it('should work with BBC legacy selectors', async () => {
        const mockHtml = `
          <html>
            <body>
              <h1 class="story-headline">BBC Legacy Title</h1>
              <time datetime="2024-01-15T10:00:00Z">15 January 2024</time>
              <p>Legacy BBC article content.</p>
            </body>
          </html>
        `

        mockedAxios.get.mockResolvedValue({ data: mockHtml })

        const articles = await fetcherService.fetchHTML('https://bbc.co.uk/article', mockSource)

        expect(articles).toHaveLength(1)
        expect(articles[0].title).toBe('BBC Legacy Title')
      })
    })

    describe('Reuters Extraction', () => {
      it('should extract Reuters article with specific selectors', async () => {
        const mockHtml = `
          <html>
            <head>
              <meta property="og:image" content="https://reuters.com/image.jpg">
            </head>
            <body>
              <h1 data-testid="Headline">Reuters Market Update</h1>
              <p data-testid="paragraph">Reuters reporting on financial markets with detailed analysis.</p>
              <span data-testid="AuthorName">Reuters Staff</span>
              <time datetime="2024-01-15T10:00:00Z">January 15, 2024</time>
            </body>
          </html>
        `

        mockedAxios.get.mockResolvedValue({ data: mockHtml })

        const articles = await fetcherService.fetchHTML('https://reuters.com/article', mockSource)

        expect(articles).toHaveLength(1)
        expect(articles[0]).toMatchObject({
          title: 'Reuters Market Update',
          description: 'Reuters reporting on financial markets with detailed analysis.',
          imageUrl: 'https://reuters.com/image.jpg',
          author: 'Reuters Staff',
          metadata: { extractor: 'reuters' }
        })
      })

      it('should use legacy Reuters selectors when needed', async () => {
        const mockHtml = `
          <html>
            <body>
              <h1 class="ArticleHeader_headline">Reuters Legacy Title</h1>
              <time datetime="2024-01-15T10:00:00Z">January 15, 2024</time>
              <p>Legacy Reuters content.</p>
            </body>
          </html>
        `

        mockedAxios.get.mockResolvedValue({ data: mockHtml })

        const articles = await fetcherService.fetchHTML('https://reuters.com/article', mockSource)

        expect(articles).toHaveLength(1)
        expect(articles[0].title).toBe('Reuters Legacy Title')
      })
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
    it('should handle HTTP 403 errors gracefully', async () => {
      const error = new Error('Request failed with status code 403')
      ;(error as any).response = { status: 403 }
      mockedAxios.isAxiosError.mockReturnValue(true)
      mockedAxios.get.mockRejectedValue(error)

      await expect(fetcherService.fetchHTML('https://example.com/article', mockSource))
        .rejects.toThrow('Access forbidden - site may be blocking scrapers')
    })

    it('should handle HTTP 404 errors gracefully', async () => {
      const error = new Error('Request failed with status code 404')
      ;(error as any).response = { status: 404 }
      mockedAxios.isAxiosError.mockReturnValue(true)
      mockedAxios.get.mockRejectedValue(error)

      await expect(fetcherService.fetchHTML('https://example.com/article', mockSource))
        .rejects.toThrow('Page not found')
    })

    it('should handle timeout errors gracefully', async () => {
      const error = new Error('timeout of 30000ms exceeded')
      ;(error as any).code = 'ECONNABORTED'
      mockedAxios.isAxiosError.mockReturnValue(true)
      mockedAxios.get.mockRejectedValue(error)

      await expect(fetcherService.fetchHTML('https://example.com/article', mockSource))
        .rejects.toThrow('Request timeout')
    })

    it('should handle invalid HTML responses', async () => {
      mockedAxios.get.mockResolvedValue({ data: null })

      await expect(fetcherService.fetchHTML('https://example.com/article', mockSource))
        .rejects.toThrow('Invalid HTML response')
    })

    it('should handle malformed HTML gracefully', async () => {
      const malformedHtml = '<html><body><h1>Title</h1><time>invalid-date</time></body></html>'
      mockedAxios.get.mockResolvedValue({ data: malformedHtml })

      const articles = await fetcherService.fetchHTML('https://example.com/article', mockSource)
      expect(articles).toHaveLength(0) // Should reject due to invalid date
    })
  })

  describe('Content Validation', () => {
    it('should validate date range (not too old)', async () => {
      const mockHtml = `
        <html>
          <head>
            <title>Old Article</title>
            <meta property="article:published_time" content="2020-01-01T00:00:00Z">
          </head>
          <body>
            <h1>Old Article</h1>
          </body>
        </html>
      `

      mockedAxios.get.mockResolvedValue({ data: mockHtml })

      const articles = await fetcherService.fetchHTML('https://example.com/article', mockSource)
      expect(articles).toHaveLength(0)
    })

    it('should validate date range (not too far in future)', async () => {
      const futureDate = new Date()
      futureDate.setMonth(futureDate.getMonth() + 2)

      const mockHtml = `
        <html>
          <head>
            <title>Future Article</title>
            <meta property="article:published_time" content="${futureDate.toISOString()}">
          </head>
          <body>
            <h1>Future Article</h1>
          </body>
        </html>
      `

      mockedAxios.get.mockResolvedValue({ data: mockHtml })

      const articles = await fetcherService.fetchHTML('https://example.com/article', mockSource)
      expect(articles).toHaveLength(0)
    })

    it('should accept recent dates within valid range', async () => {
      const recentDate = new Date()
      recentDate.setDate(recentDate.getDate() - 1) // Yesterday

      const mockHtml = `
        <html>
          <head>
            <title>Recent Article</title>
            <meta property="article:published_time" content="${recentDate.toISOString()}">
          </head>
          <body>
            <h1>Recent Article</h1>
          </body>
        </html>
      `

      mockedAxios.get.mockResolvedValue({ data: mockHtml })

      const articles = await fetcherService.fetchHTML('https://example.com/article', mockSource)
      expect(articles).toHaveLength(1)
      expect(articles[0].publishedAt).toBeInstanceOf(Date)
    })
  })

  describe('HTTP Request Configuration', () => {
    it('should use proper headers for web scraping', async () => {
      const mockHtml = '<html><head><title>Test</title><meta property="article:published_time" content="2024-01-15T10:00:00Z"></head></html>'
      mockedAxios.get.mockResolvedValue({ data: mockHtml })

      await fetcherService.fetchHTML('https://example.com/article', mockSource)

      expect(mockedAxios.get).toHaveBeenCalledWith('https://example.com/article', {
        headers: {
          'User-Agent': 'BabelFeed-NewsAggregator/1.0',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Accept-Encoding': 'gzip, deflate',
          'DNT': '1',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1',
        },
        timeout: 30000,
        maxContentLength: 10 * 1024 * 1024,
        validateStatus: expect.any(Function),
      })
    })

    it('should reject responses larger than limit', async () => {
      const error = new Error('maxContentLength size of 10485760 exceeded')
      mockedAxios.get.mockRejectedValue(error)

      await expect(fetcherService.fetchHTML('https://example.com/huge-page', mockSource))
        .rejects.toThrow('HTML extraction failed')
    })
  })
})