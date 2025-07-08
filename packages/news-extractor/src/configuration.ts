/**
 * Configuration class for news extraction
 * Ported from Python newspaper4k configuration.py
 */

// Note: LanguageConfig interface removed from import as it's not used in this implementation

export interface RequestsParams {
  timeout?: number;
  proxies?: Record<string, string>;
  headers?: Record<string, string>;
  [key: string]: any;
}

export interface TopImageSettings {
  minWidth: number;
  minHeight: number;
  minArea: number;
  maxRetries: number;
}

export class Configuration {
  // Content limits
  public minWordCount = 300
  public minSentCount = 7
  public maxTitle = 200
  public maxText = 100000
  public maxKeywords = 35 // Kept for compatibility but unused
  public maxAuthors = 10
  public maxSummary = 5000 // Kept for compatibility but unused
  public maxSummarySent = 5 // Kept for compatibility but unused
  public maxFileMemo = 20000

  // Image processing settings
  public topImageSettings: TopImageSettings = {
    minWidth: 300,
    minHeight: 200,
    minArea: 10000,
    maxRetries: 2
  }

  // Behavior flags
  public memorizeArticles = true
  public disableCategoryCache = false
  public fetchImages = true
  public followMetaRefresh = false
  public cleanArticleHtml = true
  public httpSuccessOnly = true
  public allowBinaryContent = false
  public useCachedCategories = true

  // Language settings
  private _language = 'en'
  private _useMetaLanguage = true

  // Network settings
  public requestsParams: RequestsParams = {
    timeout: 7000,
    proxies: {},
    headers: {
      'User-Agent': 'news-extractor/1.0.0'
    }
  }

  // Threading settings
  public numberThreads = 10
  public threadTimeoutSeconds = 10

  // Debugging (deprecated but kept for compatibility)
  public verbose = false

  // Content type handling
  public ignoredContentTypesDefaults: Record<string, string> = {}

  constructor() {
    // Initialize with default values
  }

  /**
   * Update configuration with provided options
   */
  public update(options: Partial<Configuration>): void {
    Object.assign(this, options)
  }

  /**
   * Get the browser user agent string
   */
  public get browserUserAgent(): string {
    if (!this.requestsParams.headers) {
      this.requestsParams.headers = {}
    }
    return this.requestsParams.headers['User-Agent'] || 'news-extractor/1.0.0'
  }

  /**
   * Set the browser user agent string
   */
  public set browserUserAgent(value: string) {
    if (!this.requestsParams.headers) {
      this.requestsParams.headers = {}
    }
    this.requestsParams.headers['User-Agent'] = value
  }

  /**
   * Get request headers
   */
  public get headers(): Record<string, string> | undefined {
    return this.requestsParams.headers
  }

  /**
   * Set request headers
   */
  public set headers(value: Record<string, string>) {
    this.requestsParams.headers = value
  }

  /**
   * Get request timeout
   */
  public get requestTimeout(): number | undefined {
    return this.requestsParams.timeout
  }

  /**
   * Set request timeout
   */
  public set requestTimeout(value: number) {
    this.requestsParams.timeout = value
  }

  /**
   * Get proxies configuration
   */
  public get proxies(): Record<string, string> | undefined {
    return this.requestsParams.proxies
  }

  /**
   * Set proxies configuration
   */
  public set proxies(value: Record<string, string>) {
    this.requestsParams.proxies = value
  }

  /**
   * Get the configured language
   */
  public get language(): string {
    return this._language
  }

  /**
   * Set the language (2-char ISO code)
   */
  public set language(value: string | null) {
    if (value === null) {
      // Default to English with auto-detection enabled
      this._useMetaLanguage = true
      this._language = 'en'
      return
    }

    if (!value || value.length !== 2) {
      throw new Error(
        'Language must be a 2-character language code (e.g., "en" for English, "de" for German)'
      )
    }

    const supportedLanguages = this.getAvailableLanguages()
    if (!supportedLanguages.includes(value)) {
      throw new Error(
        `Language '${value}' is not supported. Supported languages: ${supportedLanguages.join(', ')}`
      )
    }

    // If explicitly set, don't use meta language detection
    this._useMetaLanguage = false
    this._language = value
  }

  /**
   * Check if meta language detection is enabled
   */
  public get useMetaLanguage(): boolean {
    return this._useMetaLanguage
  }

  /**
   * Get list of available languages
   */
  public getAvailableLanguages(): string[] {
    return ['en', 'zh', 'ja', 'ko', 'ar', 'ru', 'es', 'fr', 'de', 'it', 'pt', 'nl', 'sv', 'no', 'da', 'fi']
  }

  /**
   * Validate configuration settings
   */
  public validate(): void {
    if (this.minWordCount < 0) {
      throw new Error('minWordCount must be non-negative')
    }
    if (this.minSentCount < 0) {
      throw new Error('minSentCount must be non-negative')
    }
    if (this.maxTitle <= 0) {
      throw new Error('maxTitle must be positive')
    }
    if (this.maxText <= 0) {
      throw new Error('maxText must be positive')
    }
    if (this.maxAuthors <= 0) {
      throw new Error('maxAuthors must be positive')
    }
    if (this.numberThreads <= 0) {
      throw new Error('numberThreads must be positive')
    }
    if (this.threadTimeoutSeconds <= 0) {
      throw new Error('threadTimeoutSeconds must be positive')
    }
    if (this.requestsParams.timeout && this.requestsParams.timeout <= 0) {
      throw new Error('requestTimeout must be positive')
    }
    if (this.topImageSettings.minWidth <= 0) {
      throw new Error('topImageSettings.minWidth must be positive')
    }
    if (this.topImageSettings.minHeight <= 0) {
      throw new Error('topImageSettings.minHeight must be positive')
    }
    if (this.topImageSettings.minArea <= 0) {
      throw new Error('topImageSettings.minArea must be positive')
    }
    if (this.topImageSettings.maxRetries < 0) {
      throw new Error('topImageSettings.maxRetries must be non-negative')
    }
  }

  /**
   * Create a copy of this configuration
   */
  public clone(): Configuration {
    const config = new Configuration()
    config.update(this)
    return config
  }

  /**
   * Serialize configuration to JSON
   */
  public toJSON(): Record<string, any> {
    return {
      minWordCount: this.minWordCount,
      minSentCount: this.minSentCount,
      maxTitle: this.maxTitle,
      maxText: this.maxText,
      maxKeywords: this.maxKeywords,
      maxAuthors: this.maxAuthors,
      maxSummary: this.maxSummary,
      maxSummarySent: this.maxSummarySent,
      maxFileMemo: this.maxFileMemo,
      topImageSettings: this.topImageSettings,
      memorizeArticles: this.memorizeArticles,
      disableCategoryCache: this.disableCategoryCache,
      fetchImages: this.fetchImages,
      followMetaRefresh: this.followMetaRefresh,
      cleanArticleHtml: this.cleanArticleHtml,
      httpSuccessOnly: this.httpSuccessOnly,
      allowBinaryContent: this.allowBinaryContent,
      useCachedCategories: this.useCachedCategories,
      language: this._language,
      useMetaLanguage: this._useMetaLanguage,
      requestsParams: this.requestsParams,
      numberThreads: this.numberThreads,
      threadTimeoutSeconds: this.threadTimeoutSeconds,
      verbose: this.verbose,
      ignoredContentTypesDefaults: this.ignoredContentTypesDefaults
    }
  }

  /**
   * Load configuration from JSON
   */
  public static fromJSON(data: Record<string, any>): Configuration {
    const config = new Configuration()
    config.update(data)
    return config
  }
}