import { articles, type NewArticle, getDatabase, getTestDb } from '@babel-feed/pgdb'
import { eq } from 'drizzle-orm'
import { RawArticle } from '../modules/common/types'
import { logger } from '@babel-feed/utils'
import { TranslationService, type ArticleContent } from './translation-service'

export class ArticleStorage {
  private db = process.env.NODE_ENV === 'test' ? getTestDb() : getDatabase()
  private translationService: TranslationService

  constructor(translationService?: TranslationService) {
    this.translationService = translationService || new TranslationService()
  }

  async initialize(): Promise<void> {
    await this.translationService.initialize()
    logger.info('Article storage initialized with translation service')
  }

  async saveArticles(rawArticles: RawArticle[]): Promise<void> {
    for (const raw of rawArticles) {
      try {
        const existing = await this.db
          .select()
          .from(articles)
          .where(eq(articles.url, raw.url))
          .limit(1)
        
        if (existing.length === 0) {
          const newArticle: NewArticle = {
            url: raw.url,
            ...(typeof raw.metadata?.sourceId === 'string' && /[0-9a-fA-F-]{36}/.test(raw.metadata.sourceId) ? { sourceId: raw.metadata.sourceId } : {}),
            source: raw.source,
            sourceLanguage: raw.sourceLanguage,
            imageUrl: raw.imageUrl,
            publishedAt: raw.publishedAt
          }
          
          // Insert article and get the generated ID
          const insertResult = await this.db.insert(articles).values(newArticle).returning()
          const articleId = insertResult[0]?.id
          
          if (articleId) {
            logger.debug(`Stored article ${raw.title} with ID ${articleId}`)
            
            // Trigger translation for the new article
            if (this.translationService.isEnabled()) {
              const articleContent: ArticleContent = {
                id: articleId,
                title: raw.title,
                summary: raw.description,
                content: undefined, // We don't have full content in RawArticle
                sourceLanguage: raw.sourceLanguage
              }
              
              // Translate asynchronously to avoid blocking article storage
              this.translationService.translateAndStoreArticle(articleContent).catch(error => {
                logger.error(`Failed to translate article ${articleId}:`, error)
              })
            }
          }
        } else {
          logger.debug(`Article already exists: ${raw.title}`)
        }
      } catch (error) {
        logger.error('Failed to store article:', error)
      }
    }
  }
}

