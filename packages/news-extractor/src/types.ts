/**
 * Core types for news extraction
 */

export interface ArticleMetadata {
  title?: string;
  description?: string;
  author?: string;
  publisher?: string;
  image?: string;
  url?: string;
  canonical?: string;
  type?: string;
  siteName?: string;
  language?: string;
  locale?: string;
  section?: string;
  keywords?: string[];
  openGraph?: Record<string, string>;
  twitter?: Record<string, string>;
  // Legacy fields for compatibility
  authors?: string[];
  publishDate?: Date;
  topImage?: string;
  images?: string[];
  videos?: string[];
  tags?: string[];
  canonicalUrl?: string;
  metaDescription?: string;
  metaKeywords?: string;
  metaFavicon?: string;
  metaLang?: string;
  metaImage?: string;
  openGraphData?: Record<string, any>;
  twitterData?: Record<string, any>;
  jsonLdData?: Record<string, any>;
}

export interface ExtractionResult {
  title: string;
  text: string;
  authors: string[];
  publishDate: Date | null;
  metadata: ArticleMetadata;
  images: string[];
  videos: string[];
  topNode: any;
  html?: string;
  cleanedHtml?: string;
  downloadState?: DownloadState;
  parseState?: ParseState;
}

export enum DownloadState {
  NOT_STARTED,
  STARTED,
  SUCCESS,
  FAILED
}

export enum ParseState {
  NOT_STARTED,
  STARTED,
  SUCCESS,
  FAILED
}

export interface NetworkConfig {
  timeout?: number;
  retries?: number;
  userAgent?: string;
  headers?: Record<string, string>;
  followRedirects?: boolean;
  maxRedirects?: number;
}

export interface ProcessingConfig {
  minWordCount?: number;
  maxText?: number;
  fetchImages?: boolean;
  followMetaRefresh?: boolean;
  cleanArticleHtml?: boolean;
  httpSuccessOnly?: boolean;
  language?: string;
  // NOTE: maxKeywords removed - no keyword extraction in this package
}

export interface LanguageConfig {
  code: string;
  name: string;
  tokenizer?: string;
  unicodeRanges?: string[];
  // NOTE: stopwords removed - no keyword extraction in this package
}

/**
 * Exception types for news extraction
 */
export class ArticleException extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ArticleException'
  }
}

export class ArticleBinaryDataException extends ArticleException {
  constructor(message: string) {
    super(message)
    this.name = 'ArticleBinaryDataException'
  }
}