import { ArticleConfig } from './types';
import { DEFAULT_CONFIG } from './config';

/**
 * Configuration management for newspaper4k-ts
 */
export class Configuration implements ArticleConfig {
  minWordCount: number;
  minSentCount: number;
  maxTitle: number;
  maxText: number;
  maxKeywords: number;
  maxAuthors: number;
  maxSummarySent: number;
  memorizeArticles: boolean;
  fetchImages: boolean;
  followMetaRefresh: boolean;
  cleanArticleHtml: boolean;
  httpSuccessOnly: boolean;
  timeout: number;
  maxRetries: number;
  userAgent: string;
  headers: Record<string, string>;
  language: string;

  constructor(config: Partial<ArticleConfig> = {}) {
    // Initialize with default config
    const fullConfig = { ...DEFAULT_CONFIG, ...config };
    
    this.minWordCount = fullConfig.minWordCount!;
    this.minSentCount = fullConfig.minSentCount!;
    this.maxTitle = fullConfig.maxTitle!;
    this.maxText = fullConfig.maxText!;
    this.maxKeywords = fullConfig.maxKeywords!;
    this.maxAuthors = fullConfig.maxAuthors!;
    this.maxSummarySent = fullConfig.maxSummarySent!;
    this.memorizeArticles = fullConfig.memorizeArticles!;
    this.fetchImages = fullConfig.fetchImages!;
    this.followMetaRefresh = fullConfig.followMetaRefresh!;
    this.cleanArticleHtml = fullConfig.cleanArticleHtml!;
    this.httpSuccessOnly = fullConfig.httpSuccessOnly!;
    this.timeout = fullConfig.timeout!;
    this.maxRetries = fullConfig.maxRetries!;
    this.userAgent = fullConfig.userAgent!;
    this.headers = { ...fullConfig.headers! };
    this.language = fullConfig.language!;
  }

  /**
   * Update configuration with partial config
   */
  update(config: Partial<ArticleConfig>): void {
    Object.assign(this, config);
  }

  /**
   * Get configuration as plain object
   */
  toObject(): ArticleConfig {
    return {
      minWordCount: this.minWordCount,
      minSentCount: this.minSentCount,
      maxTitle: this.maxTitle,
      maxText: this.maxText,
      maxKeywords: this.maxKeywords,
      maxAuthors: this.maxAuthors,
      maxSummarySent: this.maxSummarySent,
      memorizeArticles: this.memorizeArticles,
      fetchImages: this.fetchImages,
      followMetaRefresh: this.followMetaRefresh,
      cleanArticleHtml: this.cleanArticleHtml,
      httpSuccessOnly: this.httpSuccessOnly,
      timeout: this.timeout,
      maxRetries: this.maxRetries,
      userAgent: this.userAgent,
      headers: { ...this.headers },
      language: this.language
    };
  }

  /**
   * Reset to default configuration
   */
  reset(): void {
    const defaultConfig = new Configuration();
    Object.assign(this, defaultConfig);
  }

  /**
   * Create a copy of this configuration
   */
  clone(): Configuration {
    return new Configuration(this.toObject());
  }

  /**
   * Set browser-like headers for better success rate
   */
  setBrowserHeaders(): void {
    this.headers = {
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9',
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'DNT': '1',
      'Pragma': 'no-cache',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      'Sec-Fetch-User': '?1',
      'Upgrade-Insecure-Requests': '1'
    };
    
    this.userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
  }

  /**
   * Set mobile headers
   */
  setMobileHeaders(): void {
    this.headers = {
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate',
      'Connection': 'keep-alive'
    };
    
    this.userAgent = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
  }

  /**
   * Set minimal headers for faster requests
   */
  setMinimalHeaders(): void {
    this.headers = {
      'Accept': 'text/html,application/xhtml+xml',
      'Accept-Language': 'en-US,en;q=0.5',
      'Connection': 'keep-alive'
    };
    
    this.userAgent = 'Mozilla/5.0 (compatible; Newspaper4k-TS/1.0)';
  }

  /**
   * Set configuration for maximum content extraction
   */
  setMaxContentMode(): void {
    this.fetchImages = true;
    this.cleanArticleHtml = true;
    this.maxKeywords = 50;
    this.maxAuthors = 15;
    this.maxSummarySent = 8;
    this.maxText = 500000;
  }

  /**
   * Set configuration for fast processing
   */
  setFastMode(): void {
    this.fetchImages = false;
    this.cleanArticleHtml = false;
    this.maxKeywords = 15;
    this.maxAuthors = 5;
    this.maxSummarySent = 3;
    this.timeout = 10000;
    this.maxRetries = 1;
  }

  /**
   * Set configuration for high quality articles only
   */
  setHighQualityMode(): void {
    this.minWordCount = 500;
    this.minSentCount = 10;
    this.maxKeywords = 25;
    this.maxSummarySent = 5;
  }

  /**
   * Validate configuration values
   */
  validate(): string[] {
    const errors: string[] = [];

    if (this.minWordCount < 0) {
      errors.push('minWordCount must be non-negative');
    }

    if (this.minSentCount < 0) {
      errors.push('minSentCount must be non-negative');
    }

    if (this.maxTitle <= 0) {
      errors.push('maxTitle must be positive');
    }

    if (this.maxText <= 0) {
      errors.push('maxText must be positive');
    }

    if (this.maxKeywords <= 0) {
      errors.push('maxKeywords must be positive');
    }

    if (this.maxAuthors <= 0) {
      errors.push('maxAuthors must be positive');
    }

    if (this.maxSummarySent <= 0) {
      errors.push('maxSummarySent must be positive');
    }

    if (this.timeout <= 0) {
      errors.push('timeout must be positive');
    }

    if (this.maxRetries < 0) {
      errors.push('maxRetries must be non-negative');
    }

    if (!this.userAgent || this.userAgent.trim().length === 0) {
      errors.push('userAgent cannot be empty');
    }

    if (!this.language || this.language.trim().length === 0) {
      errors.push('language cannot be empty');
    }

    return errors;
  }

  /**
   * Check if configuration is valid
   */
  isValid(): boolean {
    return this.validate().length === 0;
  }

  /**
   * Get configuration summary for debugging
   */
  getSummary(): string {
    return `Configuration Summary:
- Language: ${this.language}
- Min Words: ${this.minWordCount}
- Min Sentences: ${this.minSentCount}
- Max Keywords: ${this.maxKeywords}
- Fetch Images: ${this.fetchImages}
- Timeout: ${this.timeout}ms
- Max Retries: ${this.maxRetries}
- User Agent: ${this.userAgent.substring(0, 50)}...`;
  }
}