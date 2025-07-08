/**
 * Article class unit tests
 * Port of newspaper4k article tests
 */

import { describe, it, expect, beforeEach, mock } from 'bun:test'
import { Article } from '../../src/article'
import { Configuration } from '../../src/configuration'
import { DownloadState, ParseState } from '../../src/types'

// Mock the network module
const mockGetHtml = mock(async (url: string, config: Configuration) => {
  if (url.includes('test-article')) {
    return `
      <html>
        <head>
          <title>Test Article Title</title>
          <meta name="author" content="Test Author">
          <meta name="description" content="Test description">
        </head>
        <body>
          <h1>Test Article Title</h1>
          <div class="content">
            <p>This is the first paragraph of the test article.</p>
            <p>This is the second paragraph with more content.</p>
            <p>This is the third paragraph to ensure sufficient content.</p>
          </div>
        </body>
      </html>
    `
  }
  throw new Error('Mock URL not found')
})

mock.module('../../src/network.js', () => ({
  getHtml: mockGetHtml
}))

describe('Article', () => {
  let article: Article
  const testUrl = 'https://example.com/test-article'

  beforeEach(() => {
    article = new Article(testUrl)
    mockGetHtml.mockClear()
  })

  describe('initialization', () => {
    it('should initialize with URL', () => {
      expect(article.url).toBe(testUrl)
    })

    it('should initialize with default states', () => {
      expect(article.downloadState).toBe(DownloadState.NOT_STARTED)
      expect(article.parseState).toBe(ParseState.NOT_STARTED)
      expect(article.isDownloaded).toBe(false)
      expect(article.isParsed).toBe(false)
    })

    it('should initialize with custom configuration', () => {
      const config = Configuration.forLanguage('zh')
      const customArticle = new Article(testUrl, config)
      expect(customArticle.url).toBe(testUrl)
    })
  })

  describe('download', () => {
    it('should update download state on download', async () => {
      await article.download()
      expect(article.downloadState).toBe(DownloadState.SUCCESS)
      expect(article.isDownloaded).toBe(true)
      expect(article.html).toContain('Test Article Title')
      expect(mockGetHtml).toHaveBeenCalledWith(testUrl, expect.any(Configuration))
    })

    it('should handle download failures', async () => {
      const failingArticle = new Article('https://example.com/nonexistent')
      await expect(failingArticle.download()).rejects.toThrow('Mock URL not found')
      expect(failingArticle.downloadState).toBe(DownloadState.FAILED)
      expect(failingArticle.isDownloaded).toBe(false)
    })
  })

  describe('parse', () => {
    it('should require download before parsing', async () => {
      expect(async () => {
        await article.parse()
      }).toThrow('Article must be downloaded before parsing')
    })

    it('should update parse state on parse', async () => {
      await article.download()
      await article.parse()
      expect(article.parseState).toBe(ParseState.SUCCESS)
      expect(article.isParsed).toBe(true)
      expect(article.title).toBe('Test Article Title')
      expect(article.text).toContain('first paragraph')
      expect(article.authors).toContain('Test Author')
    })
  })

  describe('process', () => {
    it('should download and parse in one step', async () => {
      const result = await article.process()
      expect(article.isDownloaded).toBe(true)
      expect(article.isParsed).toBe(true)
      expect(result.downloadState).toBe(DownloadState.SUCCESS)
      expect(result.parseState).toBe(ParseState.SUCCESS)
      expect(result.title).toBe('Test Article Title')
      expect(result.text).toContain('first paragraph')
      expect(result.authors).toContain('Test Author')
    })
  })

  describe('getters and setters', () => {
    it('should allow setting HTML content', () => {
      const testHtml = '<html><body>Test</body></html>'
      article.html = testHtml
      expect(article.html).toBe(testHtml)
    })

    it('should allow setting text content', () => {
      const testText = 'This is test text'
      article.text = testText
      expect(article.text).toBe(testText)
    })

    it('should allow setting metadata', () => {
      const testMetadata = { title: 'Test Title', authors: ['Test Author'] }
      article.metadata = testMetadata
      expect(article.metadata).toEqual(testMetadata)
      expect(article.title).toBe('Test Title')
      expect(article.authors).toEqual(['Test Author'])
    })
  })

  describe('result generation', () => {
    it('should generate extraction result', () => {
      const result = article.getResult()
      expect(result).toHaveProperty('text')
      expect(result).toHaveProperty('metadata')
      expect(result).toHaveProperty('downloadState')
      expect(result).toHaveProperty('parseState')
    })
  })
})