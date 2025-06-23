import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { DATABASE_CONFIG } from './config.js';

/**
 * Database connection and article storage
 */

// Database connection
const connectionString = `postgresql://${DATABASE_CONFIG.username}:${DATABASE_CONFIG.password}@${DATABASE_CONFIG.host}:${DATABASE_CONFIG.port}/${DATABASE_CONFIG.database}`;
const client = postgres(connectionString);
export const db = drizzle(client);

export interface ArticleData {
  id: string;
  title: string;
  titleTranslations: Record<string, string>;
  summary?: string;
  summaryTranslations: Record<string, string>;
  url: string;
  source: string;
  sourceLanguage: string;
  availableLanguages: string[];
  publishedAt: string;
  imageUrl?: string;
}

/**
 * Save article with all translations to database
 */
export async function saveArticle(article: ArticleData): Promise<void> {
  try {
    // Note: This would require the actual database schema
    // For now, this is a placeholder that shows the intended structure
    console.log('Saving article to database:', {
      id: article.id,
      title: article.title,
      translations: Object.keys(article.titleTranslations).length,
      source: article.source,
      language: article.sourceLanguage
    });
    
    // In a real implementation, this would insert into the articles table:
    // await db.insert(articlesTable).values({
    //   id: article.id,
    //   title: article.title,
    //   titleTranslations: JSON.stringify(article.titleTranslations),
    //   summary: article.summary,
    //   summaryTranslations: JSON.stringify(article.summaryTranslations),
    //   url: article.url,
    //   source: article.source,
    //   sourceLanguage: article.sourceLanguage,
    //   availableLanguages: article.availableLanguages,
    //   publishedAt: article.publishedAt,
    //   imageUrl: article.imageUrl,
    //   createdAt: new Date().toISOString(),
    //   updatedAt: new Date().toISOString()
    // }).onConflictDoUpdate({
    //   target: articlesTable.id,
    //   set: {
    //     titleTranslations: JSON.stringify(article.titleTranslations),
    //     summaryTranslations: JSON.stringify(article.summaryTranslations),
    //     availableLanguages: article.availableLanguages,
    //     updatedAt: new Date().toISOString()
    //   }
    // });
    
  } catch (error) {
    console.error('Error saving article to database:', error);
    throw error;
  }
}

/**
 * Check if article already exists
 */
export async function articleExists(url: string): Promise<boolean> {
  try {
    // Placeholder implementation
    // In real implementation, this would query the database:
    // const result = await db.select().from(articlesTable).where(eq(articlesTable.url, url)).limit(1);
    // return result.length > 0;
    return false;
  } catch (error) {
    console.error('Error checking article existence:', error);
    return false;
  }
}

/**
 * Get articles that need translation updates
 */
export async function getArticlesNeedingTranslation(language: string): Promise<ArticleData[]> {
  try {
    // Placeholder implementation
    // In real implementation:
    // const articles = await db.select().from(articlesTable)
    //   .where(not(sql`${articlesTable.availableLanguages} @> ${JSON.stringify([language])}`));
    // return articles.map(mapDbArticleToArticleData);
    return [];
  } catch (error) {
    console.error('Error getting articles needing translation:', error);
    return [];
  }
}