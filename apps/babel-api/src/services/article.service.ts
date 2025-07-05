import { getDatabase } from '@babel-feed/pgdb';
import { articles, type Article, type NewArticle } from '@babel-feed/pgdb';
import { eq, desc, sql } from 'drizzle-orm';

/**
 * Article service for managing news articles
 */
export class ArticleService {
  private db = getDatabase();

  /**
   * Get all articles with pagination
   */
  async getArticles(options: {
    limit?: number;
    offset?: number;
    language?: string;
  } = {}): Promise<{ articles: Article[]; total: number }> {
    const { limit = 20, offset = 0, language } = options;

    try {
      // Build query conditions
      const conditions = [];
      if (language) {
        conditions.push(eq(articles.sourceLanguage, language));
      }

      // Get articles with limit and offset
      let query = this.db
        .select()
        .from(articles)
        .orderBy(desc(articles.publishedAt));

      if (conditions.length > 0) {
        query = query.where(sql`${sql.join(conditions, sql` AND `)}`);
      }

      const articlesResult = await query
        .limit(limit)
        .offset(offset);

      // Get total count
      const totalResult = await this.db
        .select({ count: sql<number>`count(*)` })
        .from(articles);

      const total = totalResult[0]?.count || 0;

      return {
        articles: articlesResult,
        total
      };
    } catch (error) {
      console.error('Error fetching articles:', error);
      throw new Error('Failed to fetch articles');
    }
  }

  /**
   * Get a specific article by ID
   */
  async getArticleById(id: string): Promise<Article | null> {
    try {
      const result = await this.db
        .select()
        .from(articles)
        .where(eq(articles.id, id))
        .limit(1);

      return result[0] || null;
    } catch (error) {
      console.error('Error fetching article by ID:', error);
      throw new Error('Failed to fetch article');
    }
  }

  /**
   * Get a specific article by URL
   */
  async getArticleByUrl(url: string): Promise<Article | null> {
    try {
      const result = await this.db
        .select()
        .from(articles)
        .where(eq(articles.url, url))
        .limit(1);

      return result[0] || null;
    } catch (error) {
      console.error('Error fetching article by URL:', error);
      throw new Error('Failed to fetch article');
    }
  }

  /**
   * Create a new article
   */
  async createArticle(articleData: NewArticle): Promise<Article> {
    try {
      const result = await this.db
        .insert(articles)
        .values(articleData)
        .returning();

      return result[0];
    } catch (error) {
      console.error('Error creating article:', error);
      throw new Error('Failed to create article');
    }
  }

  /**
   * Update an existing article
   */
  async updateArticle(id: string, updates: Partial<NewArticle>): Promise<Article | null> {
    try {
      const result = await this.db
        .update(articles)
        .set({ ...updates, updatedAt: new Date() })
        .where(eq(articles.id, id))
        .returning();

      return result[0] || null;
    } catch (error) {
      console.error('Error updating article:', error);
      throw new Error('Failed to update article');
    }
  }

  /**
   * Delete an article
   */
  async deleteArticle(id: string): Promise<boolean> {
    try {
      const result = await this.db
        .delete(articles)
        .where(eq(articles.id, id))
        .returning();

      return result.length > 0;
    } catch (error) {
      console.error('Error deleting article:', error);
      throw new Error('Failed to delete article');
    }
  }

  /**
   * Search articles by title or content
   */
  async searchArticles(query: string, options: {
    limit?: number;
    offset?: number;
    language?: string;
  } = {}): Promise<{ articles: Article[]; total: number }> {
    const { limit = 20, offset = 0, language } = options;

    try {
      const conditions = [
        sql`(${articles.title} ILIKE ${`%${query}%`} OR ${articles.summary} ILIKE ${`%${query}%`})`
      ];

      if (language) {
        conditions.push(eq(articles.sourceLanguage, language));
      }

      // Get articles with search
      const articlesResult = await this.db
        .select()
        .from(articles)
        .where(sql`${sql.join(conditions, sql` AND `)}`)
        .orderBy(desc(articles.publishedAt))
        .limit(limit)
        .offset(offset);

      // Get total count for search
      const totalResult = await this.db
        .select({ count: sql<number>`count(*)` })
        .from(articles)
        .where(sql`${sql.join(conditions, sql` AND `)}`);

      const total = totalResult[0]?.count || 0;

      return {
        articles: articlesResult,
        total
      };
    } catch (error) {
      console.error('Error searching articles:', error);
      throw new Error('Failed to search articles');
    }
  }
}