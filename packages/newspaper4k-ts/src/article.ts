import { ArticleConfig, ArticleData, DownloadState, ExtractionResult } from './types';
import { DEFAULT_CONFIG } from './config';
import { ContentExtractor } from './extractors/content-extractor';
import { TitleExtractor } from './extractors/title-extractor';
import { AuthorExtractor } from './extractors/author-extractor';
import { DateExtractor } from './extractors/date-extractor';
import { ImageExtractor } from './extractors/image-extractor';
import { VideoExtractor } from './extractors/video-extractor';
import { MetadataExtractor } from './extractors/metadata-extractor';
import { LanguageDetector } from './nlp/language-detector';
import { KeywordExtractor } from './nlp/keyword-extractor';
import { Summarizer } from './nlp/summarizer';
import { HttpClient } from './utils/http-client';
import { UrlUtils } from './utils/url-utils';
import { TextUtils } from './utils/text-utils';

/**
 * Main Article class for processing and extracting content from web articles
 */
export class Article implements ArticleData {
  // Core content
  title: string = '';
  text: string = '';
  authors: string[] = [];
  publishDate: Date | null = null;
  summary: string = '';
  keywords: string[] = [];
  images: string[] = [];
  movies: string[] = [];
  
  // Metadata
  metaDescription: string = '';
  metaKeywords: string[] = [];
  metaLang: string = '';
  metaSiteName: string = '';
  canonicalLink: string = '';
  topImage: string = '';
  
  // Processing state
  html: string = '';
  articleHtml: string = '';
  isParsed: boolean = false;
  downloadState: DownloadState = DownloadState.NOT_STARTED;
  url: string = '';
  sourceUrl: string = '';
  
  // Language and NLP
  language: string = '';
  sentiment: number = 0;
  readingTime: number = 0;
  complexity: number = 0;
  
  // Private properties
  private config: ArticleConfig;
  private httpClient: HttpClient;
  private contentExtractor: ContentExtractor;
  private titleExtractor: TitleExtractor;
  private authorExtractor: AuthorExtractor;
  private dateExtractor: DateExtractor;
  private imageExtractor: ImageExtractor;
  private videoExtractor: VideoExtractor;
  private metadataExtractor: MetadataExtractor;
  private languageDetector: LanguageDetector;
  private keywordExtractor: KeywordExtractor;
  private summarizer: Summarizer;

  constructor(url: string, config: Partial<ArticleConfig> = {}) {
    this.url = url;
    this.sourceUrl = url;
    this.config = { ...DEFAULT_CONFIG, ...config };
    
    // Initialize components
    this.httpClient = new HttpClient(this.config);
    this.contentExtractor = new ContentExtractor(this.config);
    this.titleExtractor = new TitleExtractor(this.config);
    this.authorExtractor = new AuthorExtractor(this.config);
    this.dateExtractor = new DateExtractor(this.config);
    this.imageExtractor = new ImageExtractor(this.config);
    this.videoExtractor = new VideoExtractor(this.config);
    this.metadataExtractor = new MetadataExtractor(this.config);
    this.languageDetector = new LanguageDetector(this.config);
    this.keywordExtractor = new KeywordExtractor(this.config);
    this.summarizer = new Summarizer(this.config);
  }

  /**
   * Download article HTML content
   */
  async download(): Promise<void> {
    try {
      this.downloadState = DownloadState.FETCHING;
      
      if (!UrlUtils.isValidUrl(this.url)) {
        throw new Error(`Invalid URL: ${this.url}`);
      }

      const response = await this.httpClient.get(this.url);
      this.html = response.data;
      this.downloadState = DownloadState.SUCCESS;
      
    } catch (error) {
      this.downloadState = DownloadState.FAILED;
      throw error;
    }
  }

  /**
   * Parse article content from HTML
   */
  async parse(): Promise<void> {
    if (!this.html) {
      throw new Error('No HTML content to parse. Call download() first.');
    }

    try {
      // Extract metadata first
      const metadata = await this.metadataExtractor.extract(this.html);
      this.metaDescription = metadata.description;
      this.metaKeywords = metadata.keywords;
      this.metaLang = metadata.language;
      this.metaSiteName = metadata.siteName;
      this.canonicalLink = metadata.canonicalUrl;

      // Extract main content
      const contentResult = await this.contentExtractor.extract(this.html);
      this.text = contentResult.text;
      this.articleHtml = contentResult.html;

      // Extract title
      this.title = await this.titleExtractor.extract(this.html, this.text);

      // Extract authors
      this.authors = await this.authorExtractor.extract(this.html);

      // Extract publish date
      this.publishDate = await this.dateExtractor.extract(this.html, this.url);

      // Extract images
      this.images = await this.imageExtractor.extract(this.html, this.url);
      if (this.images.length > 0) {
        this.topImage = this.images[0];
      }

      // Extract videos
      this.movies = await this.videoExtractor.extract(this.html, this.url);

      // Detect language
      this.language = await this.languageDetector.detect(this.text, this.metaLang);

      // Extract keywords
      this.keywords = await this.keywordExtractor.extract(this.text, this.language);

      // Generate summary
      this.summary = await this.summarizer.summarize(this.text, this.language);

      // Calculate reading time and complexity
      this.readingTime = TextUtils.calculateReadingTime(this.text);
      this.complexity = TextUtils.calculateComplexity(this.text);

      this.isParsed = true;
      
    } catch (error) {
      this.isParsed = false;
      throw error;
    }
  }

  /**
   * Download and parse article in one step
   */
  async build(): Promise<void> {
    await this.download();
    await this.parse();
  }

  /**
   * Get article extraction result
   */
  getExtractionResult(): ExtractionResult {
    return {
      title: this.title,
      text: this.text,
      authors: this.authors,
      publishDate: this.publishDate,
      images: this.images,
      videos: this.movies,
      language: this.language,
      meta: {
        description: this.metaDescription,
        keywords: this.metaKeywords,
        siteName: this.metaSiteName,
        canonicalUrl: this.canonicalLink
      }
    };
  }

  /**
   * Check if article meets quality thresholds
   */
  isValidArticle(): boolean {
    const wordCount = TextUtils.countWords(this.text);
    const sentenceCount = TextUtils.countSentences(this.text);
    
    return (
      wordCount >= (this.config.minWordCount || 0) &&
      sentenceCount >= (this.config.minSentCount || 0) &&
      this.title.length > 0 &&
      this.title.length <= (this.config.maxTitle || 1000) &&
      this.text.length <= (this.config.maxText || 1000000)
    );
  }

  /**
   * Get article statistics
   */
  getStats(): {
    wordCount: number;
    sentenceCount: number;
    paragraphCount: number;
    readingTime: number;
    complexity: number;
    imageCount: number;
    videoCount: number;
    keywordCount: number;
  } {
    return {
      wordCount: TextUtils.countWords(this.text),
      sentenceCount: TextUtils.countSentences(this.text),
      paragraphCount: TextUtils.countParagraphs(this.text),
      readingTime: this.readingTime,
      complexity: this.complexity,
      imageCount: this.images.length,
      videoCount: this.movies.length,
      keywordCount: this.keywords.length
    };
  }

  /**
   * Reset article state
   */
  reset(): void {
    this.title = '';
    this.text = '';
    this.authors = [];
    this.publishDate = null;
    this.summary = '';
    this.keywords = [];
    this.images = [];
    this.movies = [];
    this.metaDescription = '';
    this.metaKeywords = [];
    this.metaLang = '';
    this.metaSiteName = '';
    this.canonicalLink = '';
    this.topImage = '';
    this.html = '';
    this.articleHtml = '';
    this.isParsed = false;
    this.downloadState = DownloadState.NOT_STARTED;
    this.language = '';
    this.sentiment = 0;
    this.readingTime = 0;
    this.complexity = 0;
  }
}