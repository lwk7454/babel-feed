import { Article } from './article';
import { ArticleConfig, SourceData, CategoryData, FeedData } from './types';
import { DEFAULT_CONFIG } from './config';
import { HttpClient } from './utils/http-client';
import { UrlUtils } from './utils/url-utils';
import * as cheerio from 'cheerio';

/**
 * Represents a news source/website for article discovery and management
 */
export class Source implements SourceData {
  url: string;
  domain: string;
  articles: Article[] = [];
  categories: CategoryData[] = [];
  feeds: FeedData[] = [];
  brand: string = '';
  description: string = '';
  language: string = '';
  country: string = '';

  private config: ArticleConfig;
  private httpClient: HttpClient;
  private isBuilt: boolean = false;

  constructor(url: string, config: Partial<ArticleConfig> = {}) {
    this.url = url;
    this.domain = UrlUtils.getDomain(url);
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.httpClient = new HttpClient(this.config);
  }

  /**
   * Build the source by discovering articles, feeds, and metadata
   */
  async build(): Promise<void> {
    if (this.isBuilt) return;

    try {
      // Download homepage
      const response = await this.httpClient.get(this.url);
      const html = response.data;
      const $ = cheerio.load(html);

      // Extract source metadata
      await this.extractSourceMetadata($);

      // Discover feeds
      await this.discoverFeeds($);

      // Discover article URLs
      await this.discoverArticles($);

      // Discover categories
      await this.discoverCategories($);

      this.isBuilt = true;
    } catch (error) {
      throw new Error(`Failed to build source: ${error}`);
    }
  }

  /**
   * Extract source metadata from homepage
   */
  private async extractSourceMetadata($: cheerio.CheerioAPI): Promise<void> {
    // Extract site name
    this.brand = 
      $('meta[property="og:site_name"]').attr('content') ||
      $('meta[name="application-name"]').attr('content') ||
      $('title').text().split(/[\|\-]/)[0].trim() ||
      this.domain;

    // Extract description
    this.description = 
      $('meta[property="og:description"]').attr('content') ||
      $('meta[name="description"]').attr('content') ||
      '';

    // Extract language
    this.language = 
      $('html').attr('lang') ||
      $('meta[http-equiv="content-language"]').attr('content') ||
      this.config.language ||
      'en';

    // Normalize language code
    this.language = this.language.split('-')[0].toLowerCase();
  }

  /**
   * Discover RSS/Atom feeds
   */
  private async discoverFeeds($: cheerio.CheerioAPI): Promise<void> {
    const feedUrls = new Set<string>();

    // Look for link tags with feed types
    $('link[type="application/rss+xml"], link[type="application/atom+xml"], link[type="application/feed+json"]').each((_, element) => {
      const href = $(element).attr('href');
      const type = $(element).attr('type');
      const title = $(element).attr('title') || 'Feed';

      if (href) {
        const absoluteUrl = UrlUtils.resolveUrl(href, this.url);
        feedUrls.add(absoluteUrl);

        let feedType: 'rss' | 'atom' | 'json' = 'rss';
        if (type?.includes('atom')) feedType = 'atom';
        else if (type?.includes('json')) feedType = 'json';

        this.feeds.push({
          url: absoluteUrl,
          type: feedType,
          title: title,
          description: '',
          language: this.language
        });
      }
    });

    // Look for common feed URLs
    const commonFeedPaths = [
      '/rss', '/rss.xml', '/feed', '/feed.xml', '/feeds/all.atom.xml',
      '/atom.xml', '/index.xml', '/feed.rss', '/rss/index.xml',
      '/news.rss', '/blog.rss', '/posts.rss'
    ];

    for (const path of commonFeedPaths) {
      const feedUrl = UrlUtils.resolveUrl(path, this.url);
      if (!feedUrls.has(feedUrl)) {
        try {
          const response = await this.httpClient.get(feedUrl);
          if (response.status === 200 && this.isValidFeed(response.data)) {
            feedUrls.add(feedUrl);
            this.feeds.push({
              url: feedUrl,
              type: this.detectFeedType(response.data),
              title: 'Discovered Feed',
              description: '',
              language: this.language
            });
          }
        } catch {
          // Ignore failed attempts
        }
      }
    }
  }

  /**
   * Discover article URLs from homepage and category pages
   */
  private async discoverArticles($: cheerio.CheerioAPI): Promise<void> {
    const articleUrls = new Set<string>();

    // Find article links using various selectors
    const articleSelectors = [
      'a[href*="/article/"]',
      'a[href*="/news/"]',
      'a[href*="/story/"]',
      'a[href*="/post/"]',
      'a[href*="/blog/"]',
      '.article a[href]',
      '.news a[href]',
      '.story a[href]',
      '.post a[href]',
      'article a[href]',
      'h1 a[href]',
      'h2 a[href]',
      'h3 a[href]'
    ];

    articleSelectors.forEach(selector => {
      $(selector).each((_, element) => {
        const href = $(element).attr('href');
        if (href && this.isLikelyArticleUrl(href)) {
          const absoluteUrl = UrlUtils.resolveUrl(href, this.url);
          if (UrlUtils.isSameDomain(absoluteUrl, this.url)) {
            articleUrls.add(absoluteUrl);
          }
        }
      });
    });

    // Create Article instances for discovered URLs
    const maxArticles = 50; // Limit for performance
    const urlArray = Array.from(articleUrls).slice(0, maxArticles);
    
    for (const url of urlArray) {
      const article = new Article(url, this.config);
      this.articles.push(article);
    }
  }

  /**
   * Discover category pages
   */
  private async discoverCategories($: cheerio.CheerioAPI): Promise<void> {
    const categoryUrls = new Set<string>();

    // Look for navigation menus and category links
    const categorySelectors = [
      'nav a[href]',
      '.navigation a[href]',
      '.menu a[href]',
      '.categories a[href]',
      '.category a[href]',
      '.sections a[href]',
      '.section a[href]'
    ];

    categorySelectors.forEach(selector => {
      $(selector).each((_, element) => {
        const href = $(element).attr('href');
        const text = $(element).text().trim();
        
        if (href && text && this.isLikelyCategoryUrl(href, text)) {
          const absoluteUrl = UrlUtils.resolveUrl(href, this.url);
          if (UrlUtils.isSameDomain(absoluteUrl, this.url)) {
            categoryUrls.add(absoluteUrl);
            
            this.categories.push({
              url: absoluteUrl,
              name: text,
              articles: []
            });
          }
        }
      });
    });
  }

  /**
   * Check if URL looks like an article
   */
  private isLikelyArticleUrl(href: string): boolean {
    const articlePatterns = [
      /\/article\//,
      /\/news\//,
      /\/story\//,
      /\/post\//,
      /\/blog\//,
      /\/\d{4}\/\d{1,2}\/\d{1,2}\//,  // Date pattern
      /\/\d{4}-\d{1,2}-\d{1,2}/       // Date pattern
    ];

    return articlePatterns.some(pattern => pattern.test(href));
  }

  /**
   * Check if URL looks like a category page
   */
  private isLikelyCategoryUrl(href: string, text: string): boolean {
    // Skip external links and non-category patterns
    if (href.startsWith('http') && !href.includes(this.domain)) return false;
    if (href.startsWith('#') || href.startsWith('javascript:')) return false;
    if (href.includes('contact') || href.includes('about')) return false;

    // Look for category-like text
    const categoryKeywords = [
      'news', 'business', 'sports', 'technology', 'science', 'health',
      'politics', 'world', 'entertainment', 'lifestyle', 'opinion',
      'local', 'national', 'international', 'economy', 'finance',
      'culture', 'arts', 'travel', 'food', 'fashion', 'auto', 'real estate'
    ];

    const lowerText = text.toLowerCase();
    return categoryKeywords.some(keyword => lowerText.includes(keyword)) ||
           href.includes('/category/') ||
           href.includes('/section/') ||
           href.includes('/tag/');
  }

  /**
   * Check if content is a valid feed
   */
  private isValidFeed(content: string): boolean {
    return content.includes('<rss') || 
           content.includes('<feed') || 
           content.includes('<atom') ||
           content.includes('"version":'); // JSON feed
  }

  /**
   * Detect feed type from content
   */
  private detectFeedType(content: string): 'rss' | 'atom' | 'json' {
    if (content.includes('<rss')) return 'rss';
    if (content.includes('<feed') || content.includes('<atom')) return 'atom';
    if (content.includes('"version":')) return 'json';
    return 'rss'; // Default
  }

  /**
   * Download and parse articles
   */
  async downloadArticles(): Promise<void> {
    const downloadPromises = this.articles.map(async (article) => {
      try {
        await article.download();
      } catch (error) {
        // Log error but continue with other articles
        console.warn(`Failed to download article: ${article.url}`, error);
      }
    });

    await Promise.allSettled(downloadPromises);
  }

  /**
   * Parse downloaded articles
   */
  async parseArticles(): Promise<void> {
    const parsePromises = this.articles.map(async (article) => {
      try {
        if (article.downloadState === 2) { // SUCCESS
          await article.parse();
        }
      } catch (error) {
        // Log error but continue with other articles
        console.warn(`Failed to parse article: ${article.url}`, error);
      }
    });

    await Promise.allSettled(parsePromises);
  }

  /**
   * Get successfully parsed articles
   */
  getParsedArticles(): Article[] {
    return this.articles.filter(article => article.isParsed);
  }

  /**
   * Get articles that are valid according to configuration
   */
  getValidArticles(): Article[] {
    return this.getParsedArticles().filter(article => article.isValidArticle());
  }

  /**
   * Get source statistics
   */
  getStats(): {
    totalArticles: number;
    downloadedArticles: number;
    parsedArticles: number;
    validArticles: number;
    feedCount: number;
    categoryCount: number;
  } {
    const parsed = this.getParsedArticles();
    const valid = this.getValidArticles();

    return {
      totalArticles: this.articles.length,
      downloadedArticles: this.articles.filter(a => a.downloadState === 2).length,
      parsedArticles: parsed.length,
      validArticles: valid.length,
      feedCount: this.feeds.length,
      categoryCount: this.categories.length
    };
  }

  /**
   * Clean up resources
   */
  cleanup(): void {
    this.articles = [];
    this.categories = [];
    this.feeds = [];
  }
}