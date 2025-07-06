// Aggregator types
export interface Article {
  id: string;
  title: string;
  content: string;
  summary?: string;
  url: string;
  imageUrl?: string;
  sourceId: string;
  sourceName: string;
  author?: string;
  publishedAt: Date;
  processedAt: Date;
  language: string;
  category?: string;
  tags?: string[];
  sentiment?: number;
  contentHash: string;
  translations?: Record<string, ArticleTranslation>;
}

export interface ArticleTranslation {
  title: string;
  content: string;
  summary?: string;
  language: string;
  translatedAt: Date;
  translationProvider: string;
}

export interface ProcessingResult {
  processed: number;
  articles: Article[];
  errors: number;
  duplicates: number;
  translations: number;
  processingTime: number;
}

export interface FetchResult {
  sourceId: string;
  articles: RawArticle[];
  errors: string[];
  fetchTime: number;
  contentType: 'rss' | 'html' | 'json';
}

export interface RawArticle {
  title: string;
  content: string;
  url: string;
  imageUrl?: string;
  author?: string;
  publishedAt: Date;
  sourceLanguage: string;
}

export interface AIProcessingTask {
  type: 'translate' | 'summarize' | 'tag' | 'categorize' | 'sentiment';
  articleId: string;
  content: string;
  targetLanguage?: string;
  priority: 'high' | 'normal' | 'low';
  retryCount: number;
  maxRetries: number;
}

export interface ContentHash {
  hash: string;
  algorithm: 'md5' | 'sha256' | 'fuzzy';
  content: string;
  createdAt: Date;
}

// TODO: Add more types as needed
// - Content extraction results
// - Quality scoring metrics
// - Processing pipeline status
// - Error tracking types
// - Performance metrics