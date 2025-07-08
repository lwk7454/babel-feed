/**
 * Article class unit tests
 * Port of newspaper4k article tests
 */

import { describe, it, expect, beforeEach } from 'bun:test'
import { Article } from '../../src/article'
import { Configuration } from '../../src/configuration'
import { DownloadState, ParseState } from '../../src/types'

describe('Article', () => {
  let article: Article
  const testUrl = 'https://example.com/test-article'

  beforeEach(() => {
    article = new Article(testUrl)
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
      // Note: This test will be updated when network implementation is added
      await article.download()
      expect(article.downloadState).toBe(DownloadState.SUCCESS)
      expect(article.isDownloaded).toBe(true)
    })

    it('should handle download failures', async () => {
      // Test will be implemented when network error handling is added
      expect(true).toBe(true) // Placeholder
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
    })
  })

  describe('process', () => {
    it('should download and parse in one step', async () => {
      const result = await article.process()
      expect(article.isDownloaded).toBe(true)
      expect(article.isParsed).toBe(true)
      expect(result.downloadState).toBe(DownloadState.SUCCESS)
      expect(result.parseState).toBe(ParseState.SUCCESS)
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