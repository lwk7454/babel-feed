import { articleTranslations, articles, type NewArticleTranslation, getDatabase, getTestDb } from '@babel-feed/pgdb'
import { eq, and } from 'drizzle-orm'
import { logger } from '@babel-feed/utils'
import { config } from '../modules/common/config'

export interface TranslationData {
  articleId: string
  language: string
  title: string
  summary?: string
  content?: string
}

export class TranslationStorage {
  private db = process.env.NODE_ENV === 'test' ? getTestDb() : getDatabase()

  async saveTranslation(translationData: TranslationData): Promise<void> {
    try {
      // Check if translation already exists for this article and language
      const existing = await this.db
        .select({ id: articleTranslations.id })
        .from(articleTranslations)
        .where(
          and(
            eq(articleTranslations.articleId, translationData.articleId),
            eq(articleTranslations.language, translationData.language)
          )
        )
        .limit(1)

      if (existing.length > 0) {
        // Update existing translation
        await this.db
          .update(articleTranslations)
          .set({
            title: translationData.title,
            summary: translationData.summary,
            content: translationData.content,
            updatedAt: new Date()
          })
          .where(eq(articleTranslations.id, existing[0].id))
        
        logger.debug(`Updated translation for article ${translationData.articleId} to ${translationData.language}`)
      } else {
        // Insert new translation
        const newTranslation: NewArticleTranslation = {
          articleId: translationData.articleId,
          language: translationData.language,
          title: translationData.title,
          summary: translationData.summary,
          content: translationData.content
        }
        
        await this.db.insert(articleTranslations).values(newTranslation)
        logger.debug(`Stored new translation for article ${translationData.articleId} to ${translationData.language}`)
      }
    } catch (error) {
      logger.error(`Failed to store translation for article ${translationData.articleId} (${translationData.language}):`, error)
      throw error
    }
  }

  async saveMultipleTranslations(translations: TranslationData[]): Promise<void> {
    for (const translation of translations) {
      try {
        await this.saveTranslation(translation)
      } catch (error) {
        logger.error(`Failed to save translation for article ${translation.articleId} (${translation.language}):`, error)
        // Continue with other translations
      }
    }
  }

  async getTranslation(articleId: string, language: string): Promise<TranslationData | null> {
    try {
      const result = await this.db
        .select({
          articleId: articleTranslations.articleId,
          language: articleTranslations.language,
          title: articleTranslations.title,
          summary: articleTranslations.summary,
          content: articleTranslations.content
        })
        .from(articleTranslations)
        .where(
          and(
            eq(articleTranslations.articleId, articleId),
            eq(articleTranslations.language, language)
          )
        )
        .limit(1)

      return result.length > 0 ? {
        articleId: result[0].articleId,
        language: result[0].language,
        title: result[0].title,
        summary: result[0].summary ?? undefined,
        content: result[0].content ?? undefined
      } : null
    } catch (error) {
      logger.error(`Failed to get translation for article ${articleId} (${language}):`, error)
      return null
    }
  }

  async getAvailableLanguages(articleId: string): Promise<string[]> {
    try {
      const result = await this.db
        .select({ language: articleTranslations.language })
        .from(articleTranslations)
        .where(eq(articleTranslations.articleId, articleId))

      return result.map(row => row.language)
    } catch (error) {
      logger.error(`Failed to get available languages for article ${articleId}:`, error)
      return []
    }
  }

  getTargetLanguages(): string[] {
    return config.translation.targetLanguages
  }

  isTranslationEnabled(): boolean {
    return config.translation.enabled
  }
}