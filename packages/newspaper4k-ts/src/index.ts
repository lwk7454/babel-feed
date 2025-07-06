/**
 * Newspaper4k-TS - TypeScript implementation of newspaper4k for article extraction
 * 
 * Main entry point providing newspaper4k-compatible API
 */

export { Article } from './article';
export { Source } from './source';
export { Configuration } from './configuration';

// Extractors
export { ContentExtractor } from './extractors/content-extractor';
export { TitleExtractor } from './extractors/title-extractor';
export { AuthorExtractor } from './extractors/author-extractor';
export { DateExtractor } from './extractors/date-extractor';
export { ImageExtractor } from './extractors/image-extractor';
export { VideoExtractor } from './extractors/video-extractor';
export { MetadataExtractor } from './extractors/metadata-extractor';

// NLP modules
export { LanguageDetector } from './nlp/language-detector';
export { KeywordExtractor } from './nlp/keyword-extractor';
export { Summarizer } from './nlp/summarizer';

// Utilities
export { HttpClient } from './utils/http-client';
export { UrlUtils } from './utils/url-utils';
export { TextUtils } from './utils/text-utils';

// Types and config
export * from './types';
export * from './config';

// Main API functions (newspaper4k compatible)

/**
 * Create and process a single article (shortcut function)
 */
export async function article(url: string, language?: string, config?: any): Promise<Article> {
  const { Article: ArticleClass } = await import('./article');
  const articleConfig = { language, ...config };
  const articleInstance = new ArticleClass(url, articleConfig);
  await articleInstance.build();
  return articleInstance;
}

/**
 * Extract fulltext from HTML content
 */
export async function fulltext(html: string, language: string = 'en'): Promise<string> {
  const { ContentExtractor } = await import('./extractors/content-extractor');
  const extractor = new ContentExtractor({ language });
  const result = await extractor.extract(html);
  return result.text;
}

/**
 * Get list of supported languages
 */
export function languages(): string[] {
  return ['en', 'zh', 'ja', 'es', 'fr', 'de', 'it', 'pt', 'ru', 'ar', 'ko', 'nl', 'pl', 'tr', 'sv', 'no', 'da', 'fi', 'el', 'he', 'th', 'vi', 'id', 'ms', 'hi', 'bn'];
}

/**
 * Get popular news source URLs
 */
export function popularUrls(): string[] {
  return [
    'https://www.bbc.com/news',
    'https://www.cnn.com',
    'https://www.reuters.com',
    'https://www.ap.org',
    'https://www.theguardian.com',
    'https://www.nytimes.com',
    'https://www.washingtonpost.com',
    'https://www.bloomberg.com',
    'https://www.wsj.com',
    'https://www.ft.com'
  ];
}

// Default export
const newspaper4k = {
  Article,
  Source,
  Configuration,
  article,
  fulltext,
  languages,
  popularUrls
};

export default newspaper4k;