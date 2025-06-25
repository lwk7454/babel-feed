import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { eq, sql } from 'drizzle-orm';
import { DATABASE_CONFIG } from './config.js';

// Import the articles schema from the API project
import { articles } from '../../../apps/babel-api/src/db/schema.js';

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
    console.log('Saving article to database:', {
      id: article.id,
      title: article.title,
      translations: Object.keys(article.titleTranslations).length,
      source: article.source,
      language: article.sourceLanguage
    });
    
    // Insert or update article with translations
    await db.insert(articles).values({
      id: article.id,
      title: article.title,
      titleTranslations: article.titleTranslations,
      summary: article.summary,
      summaryTranslations: article.summaryTranslations,
      url: article.url,
      source: article.source,
      sourceLanguage: article.sourceLanguage,
      availableLanguages: article.availableLanguages,
      imageUrl: article.imageUrl,
      publishedAt: new Date(article.publishedAt),
      createdAt: new Date(),
      updatedAt: new Date()
    }).onConflictDoUpdate({
      target: articles.url, // Conflict on URL since that's the unique field
      set: {
        title: article.title,
        titleTranslations: article.titleTranslations,
        summary: article.summary,
        summaryTranslations: article.summaryTranslations,
        sourceLanguage: article.sourceLanguage,
        availableLanguages: article.availableLanguages,
        imageUrl: article.imageUrl,
        updatedAt: new Date()
      }
    });
    
    console.log('Article saved successfully:', article.id);
    
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
    const result = await db.select().from(articles).where(eq(articles.url, url)).limit(1);
    return result.length > 0;
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
    // Get articles that don't have the specified language in their availableLanguages array
    const result = await db.select().from(articles)
      .where(sql`NOT (${articles.availableLanguages} @> ${JSON.stringify([language])})`);
    
    return result.map(mapDbArticleToArticleData);
  } catch (error) {
    console.error('Error getting articles needing translation:', error);
    return [];
  }
}

/**
 * Map database article to ArticleData interface
 */
function mapDbArticleToArticleData(dbArticle: any): ArticleData {
  return {
    id: dbArticle.id,
    title: dbArticle.title,
    titleTranslations: dbArticle.titleTranslations || {},
    summary: dbArticle.summary,
    summaryTranslations: dbArticle.summaryTranslations || {},
    url: dbArticle.url,
    source: dbArticle.source,
    sourceLanguage: dbArticle.sourceLanguage,
    availableLanguages: dbArticle.availableLanguages || ['en'],
    publishedAt: dbArticle.publishedAt.toISOString(),
    imageUrl: dbArticle.imageUrl
  };
}