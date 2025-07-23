import { afterAll, beforeAll, beforeEach, describe, it, expect } from 'bun:test'
import { clearTestData, articles, setupTestDatabase } from '@babel-feed/pgdb'
import { ArticleStorage } from '../services/article-storage'
import { getTestDb } from '@babel-feed/pgdb'

const testArticle = {
  url: 'https://example.com/a1',
  title: 'Test Article',
  publishedAt: new Date(),
  source: 'test',
  sourceLanguage: 'en',
  metadata: { sourceId: 'src1' }
}

beforeAll(async () => {
  await setupTestDatabase()
})

describe('ArticleStorage', () => {
  let storage: ArticleStorage


  beforeEach(async () => {
    await clearTestData()
    storage = new ArticleStorage()
  })

  it('should store new articles', async () => {
    await storage.saveArticles([testArticle])
    const db = getTestDb()
    const rows = await db.select().from(articles)
    expect(rows.length).toBe(1)
    expect(rows[0].url).toBe(testArticle.url)
  })

  it('should ignore duplicates', async () => {
    await storage.saveArticles([testArticle])
    await storage.saveArticles([testArticle])
    const db = getTestDb()
    const rows = await db.select().from(articles)
    expect(rows.length).toBe(1)
  })
})

