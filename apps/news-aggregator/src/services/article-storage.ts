import { articles, type NewArticle, getDatabase, getTestDb } from '@babel-feed/pgdb'
import { eq } from 'drizzle-orm'
import { RawArticle } from '../modules/common/types'
import { logger } from '../modules/common/logger'

export class ArticleStorage {
  private db = process.env.NODE_ENV === 'test' ? getTestDb() : getDatabase()

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
          await this.db.insert(articles).values(newArticle)
          logger.debug(`Stored article ${raw.title}`)
        }
      } catch (error) {
        logger.error('Failed to store article:', error)
      }
    }
  }
}

