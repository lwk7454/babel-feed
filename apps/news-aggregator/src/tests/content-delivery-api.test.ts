import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'bun:test'
import { clearTestData, insertTestArticleWithTranslations, getTestDb } from '@babel-feed/pgdb'
import { AdminAPIServer } from '../api/admin-api'

// Ensure test environment is set before any imports
process.env.NODE_ENV = 'test'

describe('Content Delivery API', () => {
  let apiServer: AdminAPIServer
  let baseUrl: string

  beforeAll(async () => {
    // Wait a moment to ensure database is ready
    await new Promise(resolve => setTimeout(resolve, 100))
    apiServer = new AdminAPIServer()
    await apiServer.initialize()
    await apiServer.start()
    baseUrl = 'http://localhost:4000/admin'
  })

  beforeEach(async () => {
    await clearTestData()
  })

  afterAll(async () => {
    await apiServer.stop()
  })

  describe('GET /articles', () => {
    it('should return paginated articles', async () => {
      // Insert test articles
      const article1 = await insertTestArticleWithTranslations({
        url: 'https://example.com/article1',
        source: 'test-source',
        sourceLanguage: 'en'
      }, [{
        language: 'en',
        title: 'Test Article 1',
        summary: 'Test summary 1'
      }])

      const article2 = await insertTestArticleWithTranslations({
        url: 'https://example.com/article2',
        source: 'test-source',
        sourceLanguage: 'en'
      }, [{
        language: 'en',
        title: 'Test Article 2',
        summary: 'Test summary 2'
      }])

      const response = await fetch(`${baseUrl}/articles?page=1&limit=10`)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.articles).toHaveLength(2)
      expect(data.pagination.page).toBe(1)
      expect(data.pagination.limit).toBe(10)
      expect(data.pagination.total).toBe(2)
    })

    it('should filter articles by language', async () => {
      const article = await insertTestArticleWithTranslations({
        url: 'https://example.com/article',
        source: 'test-source',
        sourceLanguage: 'en'
      }, [{
        language: 'zh',
        title: '测试文章',
        summary: '测试摘要'
      }])

      const response = await fetch(`${baseUrl}/articles?language=zh`)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.articles).toHaveLength(1)
      expect(data.articles[0].language).toBe('zh')
      expect(data.articles[0].title).toBe('测试文章')
    })

    it('should search articles by title and summary', async () => {
      const article = await insertTestArticleWithTranslations({
        url: 'https://example.com/article',
        source: 'test-source',
        sourceLanguage: 'en'
      }, [{
        language: 'en',
        title: 'Technology News',
        summary: 'Latest technology updates'
      }])

      const response = await fetch(`${baseUrl}/articles?search=technology`)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.articles).toHaveLength(1)
      expect(data.articles[0].title).toBe('Technology News')
    })
  })

  describe('GET /articles/:id', () => {
    it('should return article with translations', async () => {
      const article = await insertTestArticleWithTranslations({
        url: 'https://example.com/article',
        source: 'test-source',
        sourceLanguage: 'en'
      }, [{
        language: 'en',
        title: 'Test Article',
        summary: 'Test summary'
      }, {
        language: 'zh',
        title: '测试文章',
        summary: '测试摘要'
      }])

      const response = await fetch(`${baseUrl}/articles/${article.id}`)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.id).toBe(article.id)
      expect(data.translations).toHaveLength(2)
      expect(data.translations.find((t: any) => t.language === 'en')).toBeDefined()
      expect(data.translations.find((t: any) => t.language === 'zh')).toBeDefined()
    })

    it('should return 404 for non-existent article', async () => {
      const response = await fetch(`${baseUrl}/articles/123e4567-e89b-12d3-a456-426614174000`)
      expect(response.status).toBe(404)
    })
  })

  describe('GET /articles/search', () => {
    it('should perform full-text search', async () => {
      const article = await insertTestArticleWithTranslations({
        url: 'https://example.com/article',
        source: 'test-source',
        sourceLanguage: 'en'
      }, [{
        language: 'en',
        title: 'Artificial Intelligence Breakthrough',
        summary: 'Scientists achieve major breakthrough in AI research'
      }])

      const response = await fetch(`${baseUrl}/articles/search?q=artificial%20intelligence&language=en`)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.articles).toHaveLength(1)
      expect(data.articles[0].title).toBe('Artificial Intelligence Breakthrough')
      expect(data.query).toBe('artificial intelligence')
    })

    it('should return 400 for missing query', async () => {
      const response = await fetch(`${baseUrl}/articles/search`)
      expect(response.status).toBe(400)
    })
  })

  describe('GET /feed', () => {
    it('should return personalized feed', async () => {
      const article1 = await insertTestArticleWithTranslations({
        url: 'https://example.com/article1',
        source: 'test-source',
        sourceLanguage: 'en'
      }, [{
        language: 'en',
        title: 'Latest News',
        summary: 'Breaking news summary'
      }])

      const article2 = await insertTestArticleWithTranslations({
        url: 'https://example.com/article2',
        source: 'test-source',
        sourceLanguage: 'en'
      }, [{
        language: 'zh',
        title: '最新消息',
        summary: '突发新闻摘要'
      }])

      const response = await fetch(`${baseUrl}/feed?language=en&limit=5`)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.feed).toHaveLength(1)
      expect(data.feed[0].language).toBe('en')
      expect(data.language).toBe('en')
      expect(data.timestamp).toBeDefined()
    })
  })
})