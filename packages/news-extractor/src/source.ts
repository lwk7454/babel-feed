/**
 * Source class - Represents a news website/domain
 * Port of newspaper4k Source class
 */

import { Article } from './article'
import { Configuration } from './configuration'

export class Source {
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

  constructor(url: string, config?: Configuration) {
    this._url = url
    this._config = config || new Configuration()
    this._domain = this.extractDomain(url)
  }

  /**
   * Build source by discovering articles and feeds
   */
  async build(): Promise<void> {
    try {
      // Source building implementation will be added in Phase 6
      // For now, mark as placeholder
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
   * Generate articles from source
   */
  async generateArticles(): Promise<Article[]> {
    await this.build()
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