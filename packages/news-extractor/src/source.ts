/**
 * Source class - Represents a news website/domain
 * Port of newspaper4k Source class
 */

import { Article } from './article'
import { Configuration } from './configuration'
import { NetworkClient } from './network'
import { ContentExtractor } from './extractors/content-extractor'
import RSSParser from 'rss-parser'
import type { CheerioAPI } from 'cheerio'
import type { Element } from 'domhandler'

export interface SourceConfig {
  [key: string]: unknown
}

export class Source {
  id: string
  config: SourceConfig
  private _url: string
  private _config: Configuration
  private _articles: Article[] = []
  private _categoryUrls: string[] = []
  private _feedUrls: string[] = []
  private _brand = ''
  private _description = ''
  private _domain = ''
  private _favicon = ''
  private _isBuilt = false
  private networkClient: NetworkClient
  private contentExtractor: ContentExtractor
  private rssParser: RSSParser

  constructor(id: string, config: SourceConfig | Configuration) {
    this.id = id
    this.config = config as SourceConfig
    this._url = (this.config.url as string) || ''
    this._config = config instanceof Configuration ? config : Configuration.fromJSON(config)
    this._domain = this.extractDomain(this._url)
    this.networkClient = new NetworkClient(this._config)
    this.contentExtractor = new ContentExtractor(this._config)
    this.rssParser = new RSSParser()
  }

  /**
   * Build source by discovering articles and feeds
   */
  async build(): Promise<void> {
    try {
      await this.setCategories()
      await this.setFeeds()
      await this.generateArticles()
      this._isBuilt = true
    } catch (error) {
      throw new Error(`Failed to build source: ${error}`)
    }
  }

  /**
   * Download all articles from source
   */
  async downloadArticles(): Promise<void> {
    if (!this._isBuilt) {
      throw new Error('Source must be built before downloading articles')
    }

    const downloadPromises = this._articles.map(article => article.download())
    await Promise.all(downloadPromises)
  }

  /**
   * Parse all downloaded articles
   */
  async parseArticles(): Promise<void> {
    const parsePromises = this._articles
      .filter(article => article.isDownloaded)
      .map(article => article.parse())
    
    await Promise.all(parsePromises)
  }

  /**
   * Set category URLs by analyzing homepage
   */
  async setCategories(): Promise<void> {
    try {
      const response = await this.networkClient.get(this._url)
      if (!response.data) return

      const $ = this.contentExtractor.loadHtml(response.data)
      const categoryUrls = this.extractCategoryUrls($)
      this._categoryUrls = categoryUrls
    } catch (error) {
      console.warn(`Failed to set categories for ${this._url}:`, error)
    }
  }

  /**
   * Set feed URLs by discovering RSS feeds
   */
  async setFeeds(): Promise<void> {
    try {
      const feedUrls = await this.discoverFeedUrls()
      this._feedUrls = feedUrls
    } catch (error) {
      console.warn(`Failed to set feeds for ${this._url}:`, error)
    }
  }

  /**
   * Extract category URLs from homepage
   */
  private extractCategoryUrls($: CheerioAPI): string[] {
    const categoryUrls: string[] = []
    const seenUrls = new Set<string>()
    
    // Common category URL patterns
    const categoryPatterns = [
      /\/(section|category|topic|news|world|politics|business|sports|tech|science)\/*/i,
      /\/[a-z-]+\/$/
    ]
    
    // URL stopwords to exclude
    const stopwords = new Set([
      'about', 'contact', 'privacy', 'terms', 'careers', 'advertise',
      'subscribe', 'login', 'register', 'search', 'archive', 'sitemap'
    ])

    $('a[href]').each((_: number, element: Element) => {
      const href = $(element).attr('href')
      if (!href) return

      try {
        const url = new URL(href, this._url)
        const path = url.pathname.toLowerCase()
        
        // Skip if contains stopwords
        if (stopwords.has(path.split('/')[1])) return
        
        // Check if matches category patterns
        const isCategory = categoryPatterns.some(pattern => pattern.test(path))
        if (isCategory && !seenUrls.has(url.href)) {
          categoryUrls.push(url.href)
          seenUrls.add(url.href)
        }
      } catch {
        // Invalid URL, skip
      }
    })

    return categoryUrls.slice(0, 20) // Limit to 20 categories
  }

  /**
   * Discover RSS feed URLs
   */
  private async discoverFeedUrls(): Promise<string[]> {
    const feedUrls: string[] = []
    const commonSuffixes = ['/feed', '/feeds', '/rss', '/rss.xml', '/feed.xml']
    
    // Try common feed URLs
    const candidateUrls = [
      ...commonSuffixes.map(suffix => this._url + suffix)
    ]

    // Add category feed URLs
    for (const categoryUrl of this._categoryUrls) {
      for (const suffix of commonSuffixes) {
        candidateUrls.push(categoryUrl + suffix)
      }
    }

    // Get feed URLs from HTML content
    try {
      const response = await this.networkClient.get(this._url)
      if (response.data) {
        const $ = this.contentExtractor.loadHtml(response.data)
        const htmlFeedUrls = this.contentExtractor.getFeedUrls($, this._url)
        candidateUrls.push(...htmlFeedUrls)
      }
    } catch (error) {
      console.warn(`Failed to extract feed URLs from HTML: ${error}`)
    }

    // Test URLs in parallel
    const requests = candidateUrls.map(async (url) => {
      try {
        const response = await this.networkClient.get(url, { timeout: 5000 })
        if (this.isValidFeed(response.data)) {
          return url
        }
      } catch {
        // URL failed, ignore
      }
      return null
    })

    const results = await Promise.all(requests)
    return [...new Set(results.filter(url => url !== null) as string[])] // Deduplicate
  }

  /**
   * Check if content is a valid RSS/Atom feed
   */
  private isValidFeed(content: string): boolean {
    if (!content) return false
    
    const feedIndicators = [
      '<rss',
      '<feed',
      'application/rss+xml',
      'application/atom+xml',
      '<channel>',
      '<entry>'
    ]
    
    const lowerContent = content.toLowerCase()
    return feedIndicators.some(indicator => lowerContent.includes(indicator))
  }

  /**
   * Generate articles from feeds
   */
  private async feedsToArticles(): Promise<Article[]> {
    const articles: Article[] = []
    
    for (const feedUrl of this._feedUrls) {
      try {
        const response = await this.networkClient.get(feedUrl)
        const feed = await this.rssParser.parseString(response.data)
        
        for (const item of feed.items) {
          if (item.link) {
            const article = new Article(item.link, this._config)
            
            // Set metadata from feed
            const metadata = article.metadata
            if (item.title) metadata.title = item.title
            if (item.pubDate) metadata.publishDate = new Date(item.pubDate)
            if (item.contentSnippet) metadata.metaDescription = item.contentSnippet
            
            articles.push(article)
          }
        }
      } catch (error) {
        console.warn(`Failed to parse feed ${feedUrl}:`, error)
      }
    }
    
    return articles
  }

  /**
   * Generate articles from source
   */
  async generateArticles(): Promise<Article[]> {
    if (!this._isBuilt) {
      await this.build()
    }
    
    // Get articles from feeds
    const feedArticles = await this.feedsToArticles()
    this._articles = [...this._articles, ...feedArticles]
    
    await this.downloadArticles()
    await this.parseArticles()
    return this._articles
  }

  /**
   * Add article to source
   */
  addArticle(article: Article): void {
    this._articles.push(article)
  }

  /**
   * Get article by URL
   */
  getArticle(url: string): Article | undefined {
    return this._articles.find(article => article.url === url)
  }

  /**
   * Extract domain from URL
   */
  private extractDomain(url: string): string {
    try {
      const urlObj = new URL(url)
      return urlObj.hostname
    } catch {
      return ''
    }
  }

  // Getters
  get url(): string { return this._url }
  get domain(): string { return this._domain }
  get brand(): string { return this._brand }
  get description(): string { return this._description }
  get favicon(): string { return this._favicon }
  get articles(): Article[] { return this._articles }
  get categoryUrls(): string[] { return this._categoryUrls }
  get feedUrls(): string[] { return this._feedUrls }
  get isBuilt(): boolean { return this._isBuilt }
  get size(): number { return this._articles.length }

  // Setters for testing
  set articles(articles: Article[]) { this._articles = articles }
  set categoryUrls(urls: string[]) { this._categoryUrls = urls }
  set feedUrls(urls: string[]) { this._feedUrls = urls }
}