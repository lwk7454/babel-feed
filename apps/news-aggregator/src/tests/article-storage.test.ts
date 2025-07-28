import { afterAll, beforeEach, describe, it, expect, mock } from 'bun:test'
import { clearTestData, articles, articleTranslations, getTestDb } from '@babel-feed/pgdb'
import { ArticleStorage } from '../services/article-storage'
import { TranslationService } from '../services/translation-service'

const testArticle = {
  url: 'https://example.com/a1',
  title: 'Test Article',
  publishedAt: new Date(),
  source: 'test',
  sourceLanguage: 'en',
  metadata: { sourceId: 'src1' }
}


describe('ArticleStorage', () => {
  let storage: ArticleStorage
  let mockTranslationService: any

  beforeEach(async () => {
    await clearTestData()
    
    // Create mock translation service to avoid AI provider initialization
    mockTranslationService = {
      initialize: mock(() => Promise.resolve()),
      isEnabled: mock(() => false),
      translateAndStoreArticle: mock(() => Promise.resolve())
    }
    
    storage = new ArticleStorage(mockTranslationService)
    await storage.initialize()
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

  it('should trigger translation when enabled', async () => {
    // Create storage with translation enabled
    const enabledTranslationService = {
      initialize: mock(() => Promise.resolve()),
      isEnabled: mock(() => true),
      translateAndStoreArticle: mock(() => Promise.resolve())
    }
    
    const storageWithTranslation = new ArticleStorage(enabledTranslationService as unknown as TranslationService)
    await storageWithTranslation.initialize()
    
    await storageWithTranslation.saveArticles([testArticle])
    
    // Verify translation was triggered
    expect(enabledTranslationService.translateAndStoreArticle).toHaveBeenCalledTimes(1)
    expect(enabledTranslationService.translateAndStoreArticle).toHaveBeenCalledWith({
      id: expect.any(String),
      title: testArticle.title,
      summary: undefined,
      content: undefined,
      sourceLanguage: testArticle.sourceLanguage
    })
  })

  it('should not trigger translation when disabled', async () => {
    await storage.saveArticles([testArticle])
    
    // Verify translation was not triggered (service isEnabled returns false)
    expect(mockTranslationService.translateAndStoreArticle).toHaveBeenCalledTimes(0)
  })
})

