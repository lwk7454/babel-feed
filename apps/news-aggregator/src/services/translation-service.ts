import { logger } from '@babel-feed/utils'
import { AIIntegrationService } from '../modules/aggregator/ai-integration'
import { TranslationStorage, type TranslationData } from './translation-storage'
import { config } from '../modules/common/config'

export interface ArticleContent {
  id: string
  title: string
  summary?: string
  content?: string
  sourceLanguage: string
}

export class TranslationService {
  private aiIntegration: AIIntegrationService
  private translationStorage: TranslationStorage

  constructor(aiIntegration?: AIIntegrationService) {
    this.aiIntegration = aiIntegration || new AIIntegrationService()
    this.translationStorage = new TranslationStorage()
  }

  async initialize(): Promise<void> {
    await this.aiIntegration.initialize()
  }

  async translateAndStoreArticle(article: ArticleContent): Promise<void> {
    if (!this.translationStorage.isTranslationEnabled()) {
      logger.debug('Translation is disabled, skipping article translation')
      return
    }

    const targetLanguages = this.translationStorage.getTargetLanguages()
    logger.debug(`Translating article ${article.id} to languages: ${targetLanguages.join(', ')}`)

    for (const targetLanguage of targetLanguages) {
      // Skip translation if target language is the same as source language
      if (targetLanguage.toLowerCase() === article.sourceLanguage.toLowerCase()) {
        logger.debug(`Skipping translation to ${targetLanguage} - same as source language ${article.sourceLanguage}`)
        continue
      }

      try {
        await this.translateArticleToLanguage(article, targetLanguage)
      } catch (error) {
        logger.error(`Failed to translate article ${article.id} to ${targetLanguage}:`, error)
        // Continue with other languages
      }
    }
  }

  private async translateArticleToLanguage(article: ArticleContent, targetLanguage: string): Promise<void> {
    try {
      // Check if translation already exists
      const existingTranslation = await this.translationStorage.getTranslation(article.id, targetLanguage)
      if (existingTranslation) {
        logger.debug(`Translation already exists for article ${article.id} to ${targetLanguage}`)
        return
      }

      // Translate title
      const translatedTitle = await this.aiIntegration.translateContent(article.title, targetLanguage)
      
      // Translate summary if available
      let translatedSummary: string | undefined
      if (article.summary) {
        translatedSummary = await this.aiIntegration.translateContent(article.summary, targetLanguage)
      }

      // Translate content if available (optional, might be too expensive for all articles)
      let translatedContent: string | undefined
      if (article.content && article.content.length < 5000) { // Only translate shorter content to save costs
        translatedContent = await this.aiIntegration.translateContent(article.content, targetLanguage)
      }

      // Store translation
      const translationData: TranslationData = {
        articleId: article.id,
        language: targetLanguage,
        title: translatedTitle,
        summary: translatedSummary,
        content: translatedContent
      }

      await this.translationStorage.saveTranslation(translationData)
      logger.info(`Successfully translated and stored article ${article.id} to ${targetLanguage}`)

    } catch (error) {
      logger.error(`Failed to translate article ${article.id} to ${targetLanguage}:`, error)
      throw error
    }
  }

  async retranslateArticle(articleId: string, targetLanguage: string): Promise<void> {
    // Force retranslation by removing existing translation first
    // This method could be used for fixing translations or updating to new models
    logger.info(`Force retranslating article ${articleId} to ${targetLanguage}`)
    // Implementation would need to fetch original article and retranslate
    // Left as placeholder for future enhancement
  }

  async getTranslation(articleId: string, language: string): Promise<TranslationData | null> {
    return this.translationStorage.getTranslation(articleId, language)
  }

  async getAvailableLanguages(articleId: string): Promise<string[]> {
    return this.translationStorage.getAvailableLanguages(articleId)
  }

  getTargetLanguages(): string[] {
    return this.translationStorage.getTargetLanguages()
  }

  isEnabled(): boolean {
    return this.translationStorage.isTranslationEnabled()
  }
}