import { beforeEach, describe, it, expect } from 'bun:test'
import { clearTestData, insertTestArticleWithTranslations, getTestDb } from '@babel-feed/pgdb'
import { TranslationStorage, type TranslationData } from '../services/translation-storage'
import { articleTranslations } from '@babel-feed/pgdb'
import { eq } from 'drizzle-orm'


describe('TranslationStorage', () => {
  let storage: TranslationStorage

  beforeEach(async () => {
    await clearTestData()
    storage = new TranslationStorage()
  })

  describe('saveTranslation', () => {
    it('should save new translation', async () => {
      const article = await insertTestArticleWithTranslations()
      const translationData: TranslationData = {
        articleId: article.id,
        language: 'zh-cn',
        title: '测试文章',
        summary: '测试摘要',
        content: '测试内容'
      }

      await storage.saveTranslation(translationData)

      const db = getTestDb()
      const saved = await db
        .select()
        .from(articleTranslations)
        .where(eq(articleTranslations.articleId, article.id))

      expect(saved).toHaveLength(1)
      expect(saved[0].language).toBe('zh-cn')
      expect(saved[0].title).toBe('测试文章')
      expect(saved[0].summary).toBe('测试摘要')
      expect(saved[0].content).toBe('测试内容')
    })

    it('should update existing translation', async () => {
      const article = await insertTestArticleWithTranslations({}, [
        { language: 'zh-cn', title: 'Old Title', summary: 'Old Summary' }
      ])

      const updateData: TranslationData = {
        articleId: article.id,
        language: 'zh-cn',
        title: 'New Title',
        summary: 'New Summary',
        content: 'New Content'
      }

      await storage.saveTranslation(updateData)

      const db = getTestDb()
      const saved = await db
        .select()
        .from(articleTranslations)
        .where(eq(articleTranslations.articleId, article.id))

      expect(saved).toHaveLength(1)
      expect(saved[0].title).toBe('New Title')
      expect(saved[0].summary).toBe('New Summary')
      expect(saved[0].content).toBe('New Content')
    })

    it('should handle missing optional fields', async () => {
      const article = await insertTestArticleWithTranslations()
      const translationData: TranslationData = {
        articleId: article.id,
        language: 'fr',
        title: 'Article de Test'
        // summary and content omitted
      }

      await storage.saveTranslation(translationData)

      const db = getTestDb()
      const saved = await db
        .select()
        .from(articleTranslations)
        .where(eq(articleTranslations.articleId, article.id))

      expect(saved).toHaveLength(1)
      expect(saved[0].title).toBe('Article de Test')
      expect(saved[0].summary).toBeNull()
      expect(saved[0].content).toBeNull()
    })
  })

  describe('saveMultipleTranslations', () => {
    it('should save multiple translations', async () => {
      const article = await insertTestArticleWithTranslations()
      const translations: TranslationData[] = [
        {
          articleId: article.id,
          language: 'zh-cn',
          title: '测试文章',
          summary: '测试摘要'
        },
        {
          articleId: article.id,
          language: 'ja',
          title: 'テスト記事',
          summary: 'テスト要約'
        }
      ]

      await storage.saveMultipleTranslations(translations)

      const db = getTestDb()
      const saved = await db
        .select()
        .from(articleTranslations)
        .where(eq(articleTranslations.articleId, article.id))

      expect(saved).toHaveLength(2)
      expect(saved.map(t => t.language).sort()).toEqual(['ja', 'zh-cn'])
    })

    it('should continue processing on individual failures', async () => {
      const article = await insertTestArticleWithTranslations()
      const translations: TranslationData[] = [
        {
          articleId: article.id,
          language: 'zh-cn',
          title: '测试文章'
        },
        {
          articleId: 'invalid-uuid',
          language: 'ja',
          title: 'テスト記事'
        },
        {
          articleId: article.id,
          language: 'fr',
          title: 'Article de Test'
        }
      ]

      // Should not throw despite one invalid translation
      await storage.saveMultipleTranslations(translations)

      const db = getTestDb()
      const saved = await db
        .select()
        .from(articleTranslations)
        .where(eq(articleTranslations.articleId, article.id))

      // Should have saved the valid translations
      expect(saved).toHaveLength(2)
      expect(saved.map(t => t.language).sort()).toEqual(['fr', 'zh-cn'])
    })
  })

  describe('getTranslation', () => {
    it('should retrieve existing translation', async () => {
      const article = await insertTestArticleWithTranslations({}, [
        { 
          language: 'zh-cn', 
          title: '测试文章', 
          summary: '测试摘要',
          content: '测试内容'
        }
      ])

      const translation = await storage.getTranslation(article.id, 'zh-cn')

      expect(translation).not.toBeNull()
      expect(translation!.articleId).toBe(article.id)
      expect(translation!.language).toBe('zh-cn')
      expect(translation!.title).toBe('测试文章')
      expect(translation!.summary).toBe('测试摘要')
      expect(translation!.content).toBe('测试内容')
    })

    it('should return null for non-existent translation', async () => {
      const article = await insertTestArticleWithTranslations()
      const translation = await storage.getTranslation(article.id, 'non-existent')

      expect(translation).toBeNull()
    })

    it('should handle null database values', async () => {
      const article = await insertTestArticleWithTranslations({}, [
        { 
          language: 'fr', 
          title: 'Article de Test',
          summary: null,
          content: null
        }
      ])

      const translation = await storage.getTranslation(article.id, 'fr')

      expect(translation).not.toBeNull()
      expect(translation!.title).toBe('Article de Test')
      expect(translation!.summary).toBeUndefined()
      expect(translation!.content).toBeUndefined()
    })
  })

  describe('getAvailableLanguages', () => {
    it('should return all languages for an article', async () => {
      const article = await insertTestArticleWithTranslations({}, [
        { language: 'zh-cn', title: '测试文章' },
        { language: 'ja', title: 'テスト記事' },
        { language: 'fr', title: 'Article de Test' }
      ])

      const languages = await storage.getAvailableLanguages(article.id)

      expect(languages.sort()).toEqual(['fr', 'ja', 'zh-cn'])
    })

    it('should return empty array for article with no translations', async () => {
      const article = await insertTestArticleWithTranslations()
      const languages = await storage.getAvailableLanguages(article.id)

      expect(languages).toEqual([])
    })

    it('should return empty array for non-existent article', async () => {
      const languages = await storage.getAvailableLanguages('non-existent-id')

      expect(languages).toEqual([])
    })
  })

  describe('configuration methods', () => {
    it('should return target languages from config', () => {
      const languages = storage.getTargetLanguages()
      expect(Array.isArray(languages)).toBe(true)
      expect(languages.length).toBeGreaterThan(0)
    })

    it('should return translation enabled status', () => {
      const enabled = storage.isTranslationEnabled()
      expect(typeof enabled).toBe('boolean')
    })
  })
})