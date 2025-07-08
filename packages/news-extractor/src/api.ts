/**
 * High-level API functions
 * Port of newspaper4k API functions
 */

import { Article } from './article'
import { Source } from './source'
import { Configuration } from './configuration'

/**
 * Extract text from a URL
 * Port of newspaper4k fulltext() function
 */
export async function fulltext(url: string, config?: Configuration): Promise<string> {
  const article = new Article(url, config)
  const result = await article.process()
  return result.text
}

/**
 * Build a source from a URL
 * Port of newspaper4k build() function
 */
export async function build(url: string, config?: Configuration): Promise<Source> {
  const source = new Source(url, config)
  await source.build()
  return source
}

/**
 * Get hot/trending articles from a source
 * Port of newspaper4k hot() function
 */
export async function hot(url: string, config?: Configuration): Promise<Article[]> {
  const source = new Source(url, config)
  await source.build()
  
  // Implementation for hot articles detection will be added in Phase 7
  // For now, return first few articles
  return source.articles.slice(0, 5)
}

/**
 * Extract article from URL with full processing
 */
export async function extract(url: string, config?: Configuration): Promise<Article> {
  const article = new Article(url, config)
  await article.process()
  return article
}

/**
 * Build source and extract all articles
 */
export async function extractAll(sourceUrl: string, config?: Configuration): Promise<Article[]> {
  const source = new Source(sourceUrl, config)
  return await source.generateArticles()
}

/**
 * Quick extraction with minimal configuration
 */
export async function quickExtract(url: string): Promise<{
  title?: string;
  text: string;
  authors?: string[];
  publishDate?: Date;
}> {
  const article = new Article(url)
  const result = await article.process()
  
  return {
    title: result.metadata.title,
    text: result.text,
    authors: result.metadata.authors,
    publishDate: result.metadata.publishDate
  }
}