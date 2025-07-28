import { beforeEach, describe, it, expect, mock } from 'bun:test'
import { clearTestData, insertTestArticleWithTranslations } from '@babel-feed/pgdb'
import { TranslationService, type ArticleContent } from '../services/translation-service'
import { AIIntegrationService } from '../modules/aggregator/ai-integration'

describe('TranslationService', () => {
  let service: TranslationService
  let mockAiIntegration: any

  beforeEach(async () => {
    await clearTestData()
    
    // Create mock AI integration service
    mockAiIntegration = {
      initialize: mock(() => Promise.resolve()),
      translateContent: mock((content: string, targetLanguage: string) => 
        Promise.resolve(`[${targetLanguage.toUpperCase()}] ${content}`)
      )
    }
    
    service = new TranslationService(mockAiIntegration)
    await service.initialize()
  })

  describe('initialization', () => {
    it('should initialize AI integration service', async () => {
      expect(mockAiIntegration.initialize).toHaveBeenCalledTimes(1)
    })
  })

  describe('translateAndStoreArticle', () => {
    it('should translate article to all target languages', async () => {
      const article = await insertTestArticleWithTranslations({
        sourceLanguage: 'en'
      })
      
      const articleContent: ArticleContent = {
        id: article.id,
        title: 'Test Article',
        summary: 'Test summary',
        sourceLanguage: 'en'
      }

      await service.translateAndStoreArticle(articleContent)

      // Verify AI translation was called for target languages
      const targetLanguages = service.getTargetLanguages()
      const expectedCalls = targetLanguages.filter(lang => lang !== 'en').length * 2 // title + summary
      
      expect(mockAiIntegration.translateContent).toHaveBeenCalledTimes(expectedCalls)
      
      // Verify translations were stored
      const availableLanguages = await service.getAvailableLanguages(article.id)
      expect(availableLanguages.length).toBeGreaterThan(0)
    })

    it('should skip translation if disabled', async () => {
      // Create service with mocked translation storage
      const mockTranslationStorage = {
        isTranslationEnabled: mock(() => false),
        getTargetLanguages: mock(() => []),
        getTranslation: mock(() => Promise.resolve(null)),
        saveTranslation: mock(() => Promise.resolve())
      }
      
      const disabledService = new TranslationService(mockAiIntegration)
      // Replace the internal translation storage with our mock
      ;(disabledService as any).translationStorage = mockTranslationStorage
      
      const article = await insertTestArticleWithTranslations()
      const articleContent: ArticleContent = {
        id: article.id,
        title: 'Test Article',
        sourceLanguage: 'en'
      }

      await disabledService.translateAndStoreArticle(articleContent)

      expect(mockAiIntegration.translateContent).toHaveBeenCalledTimes(0)
    })

    it('should skip translation to same language as source', async () => {
      const article = await insertTestArticleWithTranslations({
        sourceLanguage: 'zh-cn'
      })
      
      const articleContent: ArticleContent = {
        id: article.id,
        title: '测试文章',
        sourceLanguage: 'zh-cn'
      }

      await service.translateAndStoreArticle(articleContent)

      // Should not translate to zh-cn since it's the source language
      const calls = mockAiIntegration.translateContent.mock.calls
      const zhCnCalls = calls.filter((call: any[]) => call[1] === 'zh-cn')
      expect(zhCnCalls.length).toBe(0)
    })

    it('should handle translation errors gracefully', async () => {
      // Mock AI service to throw error for specific language
      mockAiIntegration.translateContent = mock((content: string, targetLanguage: string) => {
        if (targetLanguage === 'zh-cn') {
          throw new Error('Translation failed')
        }
        return Promise.resolve(`[${targetLanguage.toUpperCase()}] ${content}`)
      })

      const article = await insertTestArticleWithTranslations({
        sourceLanguage: 'en'
      })
      
      const articleContent: ArticleContent = {
        id: article.id,
        title: 'Test Article',
        sourceLanguage: 'en'
      }

      // Should not throw despite one translation failing
      await service.translateAndStoreArticle(articleContent)

      // Should have attempted all translations
      expect(mockAiIntegration.translateContent).toHaveBeenCalled()
    })

    it('should skip existing translations', async () => {
      // Pre-insert a translation
      const article = await insertTestArticleWithTranslations({
        sourceLanguage: 'en'
      }, [
        { language: 'zh-cn', title: 'Existing Translation' }
      ])
      
      const articleContent: ArticleContent = {
        id: article.id,
        title: 'Test Article',
        sourceLanguage: 'en'
      }

      await service.translateAndStoreArticle(articleContent)

      // Should not have translated to zh-cn since it already exists
      const calls = mockAiIntegration.translateContent.mock.calls
      const zhCnCalls = calls.filter((call: any[]) => call[1] === 'zh-cn')
      expect(zhCnCalls.length).toBe(0)
    })

    it('should translate content only if under length limit', async () => {
      const article = await insertTestArticleWithTranslations({
        sourceLanguage: 'en'
      })
      
      const shortContent = 'Short content'
      const longContent = 'x'.repeat(6000) // Over 5000 character limit
      
      // Test with short content
      let articleContent: ArticleContent = {
        id: article.id,
        title: 'Test Article',
        content: shortContent,
        sourceLanguage: 'en'
      }

      await service.translateAndStoreArticle(articleContent)
      
      // Clear mock calls
      mockAiIntegration.translateContent.mockClear()
      await clearTestData()
      
      // Test with long content
      const article2 = await insertTestArticleWithTranslations({
        sourceLanguage: 'en'
      })
      
      articleContent = {
        id: article2.id,
        title: 'Test Article',
        content: longContent,
        sourceLanguage: 'en'
      }

      await service.translateAndStoreArticle(articleContent)

      // With long content, should only translate title (not content)
      const calls = mockAiIntegration.translateContent.mock.calls
      const contentCalls = calls.filter((call: any[]) => call[0] === longContent)
      expect(contentCalls.length).toBe(0)
    })

    it('should handle articles with no summary or content', async () => {
      const article = await insertTestArticleWithTranslations({
        sourceLanguage: 'en'
      })
      
      const articleContent: ArticleContent = {
        id: article.id,
        title: 'Test Article',
        sourceLanguage: 'en'
        // No summary or content
      }

      await service.translateAndStoreArticle(articleContent)

      // Should only translate title
      const targetLanguages = service.getTargetLanguages().filter(lang => lang !== 'en')
      expect(mockAiIntegration.translateContent).toHaveBeenCalledTimes(targetLanguages.length)
      
      // All calls should be for the title
      const calls = mockAiIntegration.translateContent.mock.calls
      calls.forEach((call: any[]) => {
        expect(call[0]).toBe('Test Article')
      })
    })
  })

  describe('getTranslation', () => {
    it('should retrieve translation', async () => {
      const article = await insertTestArticleWithTranslations({}, [
        { language: 'zh-cn', title: '测试文章', summary: '测试摘要' }
      ])

      const translation = await service.getTranslation(article.id, 'zh-cn')

      expect(translation).not.toBeNull()
      expect(translation!.title).toBe('测试文章')
      expect(translation!.summary).toBe('测试摘要')
    })

    it('should return null for non-existent translation', async () => {
      const article = await insertTestArticleWithTranslations()
      const translation = await service.getTranslation(article.id, 'non-existent')

      expect(translation).toBeNull()
    })
  })

  describe('getAvailableLanguages', () => {
    it('should return available languages for article', async () => {
      const article = await insertTestArticleWithTranslations({}, [
        { language: 'zh-cn', title: '测试文章' },
        { language: 'ja', title: 'テスト記事' }
      ])

      const languages = await service.getAvailableLanguages(article.id)

      expect(languages.sort()).toEqual(['ja', 'zh-cn'])
    })

    it('should return empty array for article with no translations', async () => {
      const article = await insertTestArticleWithTranslations()
      const languages = await service.getAvailableLanguages(article.id)

      expect(languages).toEqual([])
    })
  })

  describe('configuration methods', () => {
    it('should return target languages', () => {
      const languages = service.getTargetLanguages()
      expect(Array.isArray(languages)).toBe(true)
      expect(languages.length).toBeGreaterThan(0)
    })

    it('should return enabled status', () => {
      const enabled = service.isEnabled()
      expect(typeof enabled).toBe('boolean')
    })
  })

  describe('retranslateArticle', () => {
    it('should be a placeholder method', async () => {
      // This is a placeholder method, just verify it doesn't throw
      await expect(service.retranslateArticle('test-id', 'zh-cn')).resolves.toBeUndefined()
    })
  })
})