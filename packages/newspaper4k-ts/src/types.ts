/**
 * Core types for newspaper4k-ts
 */

export interface ArticleConfig {
  minWordCount?: number;
  minSentCount?: number;
  maxTitle?: number;
  maxText?: number;
  maxKeywords?: number;
  maxAuthors?: number;
  maxSummarySent?: number;
  memorizeArticles?: boolean;
  fetchImages?: boolean;
  followMetaRefresh?: boolean;
  cleanArticleHtml?: boolean;
  httpSuccessOnly?: boolean;
  timeout?: number;
  maxRetries?: number;
  userAgent?: string;
  headers?: Record<string, string>;
  language?: string;
}

export interface ArticleData {
  // Core content
  title: string;
  text: string;
  authors: string[];
  publishDate: Date | null;
  summary: string;
  keywords: string[];
  images: string[];
  movies: string[];
  
  // Metadata
  metaDescription: string;
  metaKeywords: string[];
  metaLang: string;
  metaSiteName: string;
  canonicalLink: string;
  topImage: string;
  
  // Processing state
  html: string;
  articleHtml: string;
  isParsed: boolean;
  downloadState: DownloadState;
  url: string;
  sourceUrl: string;
  
  // Language and NLP
  language: string;
  sentiment: number;
  readingTime: number;
  complexity: number;
}

export enum DownloadState {
  NOT_STARTED = 0,
  FETCHING = 1,
  SUCCESS = 2,
  FAILED = 3
}

export interface SourceData {
  url: string;
  domain: string;
  articles: ArticleData[];
  categories: CategoryData[];
  feeds: FeedData[];
  brand: string;
  description: string;
  language: string;
  country: string;
}

export interface CategoryData {
  url: string;
  name: string;
  articles: ArticleData[];
}

export interface FeedData {
  url: string;
  type: 'rss' | 'atom' | 'json';
  title: string;
  description: string;
  language: string;
}

export interface ExtractionResult {
  title: string;
  text: string;
  authors: string[];
  publishDate: Date | null;
  images: string[];
  videos: string[];
  language: string;
  meta: {
    description: string;
    keywords: string[];
    siteName: string;
    canonicalUrl: string;
  };
}

export interface ContentNode {
  element: any; // Cheerio element
  score: number;
  text: string;
  linkDensity: number;
  paragraphCount: number;
}

export interface ImageData {
  url: string;
  alt: string;
  width: number;
  height: number;
  size: number;
  format: string;
  score: number;
}

export interface VideoData {
  url: string;
  title: string;
  description: string;
  thumbnail: string;
  duration: number;
  provider: string;
  score?: number;
}

export interface NetworkConfig {
  timeout: number;
  maxRetries: number;
  retryDelay: number;
  userAgent: string;
  headers: Record<string, string>;
  followRedirects: boolean;
  maxRedirects: number;
}