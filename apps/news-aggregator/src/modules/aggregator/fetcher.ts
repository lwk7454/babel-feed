import axios from 'axios'
import * as cheerio from 'cheerio'
import { logger } from '../common/logger'
import { NewsSource, RawArticle, AggregatorError } from '../common/types'

export class FetcherService {
  private htmlExtractor: HtmlContentExtractor

  constructor() {
    this.htmlExtractor = new HtmlContentExtractor()
  }

  async initialize(): Promise<void> {
    logger.info('Fetcher service initialized')
  }

  async fetchFromAllSources(): Promise<any> {
    logger.info('Fetching from all sources')
    // TODO: Implement independent fetching logic
    return {
      processed: 0,
      articles: [],
      errors: 0,
      skipped: 0
    }
  }

  async fetchFromSource(sourceId: string): Promise<any> {
    logger.info('Fetching from source:', sourceId)
    // TODO: Implement single source fetching
    throw new Error('Not implemented - needs single source fetching')
  }

  // TODO: Enhanced fetching capabilities
  // - Parallel fetching with concurrency control
  // - Retry logic with exponential backoff
  // - Request caching and conditional requests
  // - Content-type detection and handling
  // - Rate limiting per source
  // - Bandwidth monitoring

  async fetchRSS(url: string): Promise<any> {
    // Placeholder implementation
    logger.info('Fetching RSS (placeholder):', url)
    throw new Error('Not implemented - needs RSS fetching logic')
  }

  async fetchHTML(url: string, source: NewsSource): Promise<RawArticle[]> {
    logger.info('Fetching HTML content from:', url)
    return this.htmlExtractor.extractFromUrl(url, source)
  }

  async fetchJSON(url: string): Promise<any> {
    // Placeholder implementation
    logger.info('Fetching JSON (placeholder):', url)
    throw new Error('Not implemented - needs JSON API fetching')
  }

  // Legacy method will be removed after full migration
  getRssProcessor(): any {
    logger.warn('Using legacy getRssProcessor - should be replaced with module methods')
    return null
  }

  async shouldFallbackToHtml(source: NewsSource, rssResult?: RawArticle[]): Promise<boolean> {
    // Fallback to HTML if RSS returned no articles or insufficient articles
    if (!rssResult || rssResult.length === 0) {
      logger.info(`RSS returned no articles for ${source.name}, falling back to HTML extraction`)
      return true
    }

    // Check if RSS articles are too short (insufficient content)
    const insufficientArticles = rssResult.filter(article => 
      !article.description || article.description.length < 100
    )

    if (insufficientArticles.length > rssResult.length * 0.7) {
      logger.info(`RSS articles too short for ${source.name}, falling back to HTML extraction`)
      return true
    }

    return false
  }
}

class HtmlContentExtractor {
  private readonly USER_AGENT = 'BabelFeed-NewsAggregator/1.0'
  private readonly REQUEST_TIMEOUT = 30000
  private readonly MAX_CONTENT_LENGTH = 10 * 1024 * 1024 // 10MB

  async extractFromUrl(url: string, source: NewsSource): Promise<RawArticle[]> {
    try {
      const html = await this.fetchHtml(url)
      const $ = cheerio.load(html)
      
      // Try site-specific extractors first
      const siteSpecificResult = this.tryExtractSiteSpecific($, url, source)
      if (siteSpecificResult) {
        return [siteSpecificResult]
      }

      // Fall back to generic extraction
      const genericResult = this.extractGeneric($, url, source)
      return genericResult ? [genericResult] : []
    } catch (error) {
      logger.error(`HTML extraction failed for ${url}:`, error)
      throw new AggregatorError(`HTML extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`, 'HTML_EXTRACTION_ERROR')
    }
  }

  private async fetchHtml(url: string): Promise<string> {
    try {
      const response = await axios.get(url, {
        headers: {
          'User-Agent': this.USER_AGENT,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Accept-Encoding': 'gzip, deflate',
          'DNT': '1',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1',
        },
        timeout: this.REQUEST_TIMEOUT,
        maxContentLength: this.MAX_CONTENT_LENGTH,
        validateStatus: (status) => status < 400,
      })

      if (!response.data || typeof response.data !== 'string') {
        throw new Error('Invalid HTML response')
      }

      return response.data
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 403) {
          throw new Error('Access forbidden - site may be blocking scrapers')
        }
        if (error.response?.status === 404) {
          throw new Error('Page not found')
        }
        if (error.code === 'ECONNABORTED') {
          throw new Error('Request timeout')
        }
      }
      throw error
    }
  }

  private tryExtractSiteSpecific($: cheerio.CheerioAPI, url: string, source: NewsSource): RawArticle | null {
    const hostname = new URL(url).hostname.toLowerCase()
    
    // CNN specific extraction
    if (hostname.includes('cnn.com')) {
      return this.extractCNN($, url, source)
    }
    
    // BBC specific extraction
    if (hostname.includes('bbc.com') || hostname.includes('bbc.co.uk')) {
      return this.extractBBC($, url, source)
    }
    
    // Reuters specific extraction
    if (hostname.includes('reuters.com')) {
      return this.extractReuters($, url, source)
    }
    
    // Add more site-specific extractors as needed
    return null
  }

  private extractCNN($: cheerio.CheerioAPI, url: string, source: NewsSource): RawArticle | null {
    const title = $('h1.headline__text, h1[data-module="ArticleTitle"]').text().trim()
    const description = $('.zn-body__paragraph').first().text().trim() || 
                       $('meta[name="description"]').attr('content')?.trim()
    const imageUrl = $('img[data-src-mini]').attr('data-src-mini') || 
                     $('meta[property="og:image"]').attr('content')
    const publishedAt = this.parseDate($('meta[name="pubdate"]').attr('content') || 
                                       $('meta[property="article:published_time"]').attr('content'))
    const author = $('span.byline__name').text().trim() || 
                   $('meta[name="author"]').attr('content')?.trim()

    if (!title || !publishedAt) {
      return null
    }

    return {
      url,
      title,
      description,
      imageUrl,
      publishedAt,
      author,
      source: source.name,
      sourceLanguage: source.language,
      metadata: { extractor: 'cnn' }
    }
  }

  private extractBBC($: cheerio.CheerioAPI, url: string, source: NewsSource): RawArticle | null {
    const title = $('h1[data-testid="headline"], h1.story-headline').text().trim()
    const description = $('p[data-testid="paragraph"]').first().text().trim() || 
                       $('meta[name="description"]').attr('content')?.trim()
    const imageUrl = $('img[data-testid="image"]').attr('src') || 
                     $('meta[property="og:image"]').attr('content')
    const publishedAt = this.parseDate($('time').attr('datetime') || 
                                       $('meta[property="article:published_time"]').attr('content'))
    const author = $('p[data-testid="byline"]').text().trim() || 
                   $('meta[name="author"]').attr('content')?.trim()

    if (!title || !publishedAt) {
      return null
    }

    return {
      url,
      title,
      description,
      imageUrl,
      publishedAt,
      author,
      source: source.name,
      sourceLanguage: source.language,
      metadata: { extractor: 'bbc' }
    }
  }

  private extractReuters($: cheerio.CheerioAPI, url: string, source: NewsSource): RawArticle | null {
    const title = $('h1[data-testid="Headline"]').text().trim() || 
                  $('h1.ArticleHeader_headline').text().trim()
    const description = $('p[data-testid="paragraph"]').first().text().trim() || 
                       $('meta[name="description"]').attr('content')?.trim()
    const imageUrl = $('img[data-testid="Image"]').attr('src') || 
                     $('meta[property="og:image"]').attr('content')
    const publishedAt = this.parseDate($('time').attr('datetime') || 
                                       $('meta[property="article:published_time"]').attr('content'))
    const author = $('span[data-testid="AuthorName"]').text().trim() || 
                   $('meta[name="author"]').attr('content')?.trim()

    if (!title || !publishedAt) {
      return null
    }

    return {
      url,
      title,
      description,
      imageUrl,
      publishedAt,
      author,
      source: source.name,
      sourceLanguage: source.language,
      metadata: { extractor: 'reuters' }
    }
  }

  private extractGeneric($: cheerio.CheerioAPI, url: string, source: NewsSource): RawArticle | null {
    // Try common selectors for title
    const title = $('h1').first().text().trim() || 
                  $('meta[property="og:title"]').attr('content')?.trim() || 
                  $('title').text().trim()

    // Try common selectors for description
    const description = $('meta[property="og:description"]').attr('content')?.trim() || 
                        $('meta[name="description"]').attr('content')?.trim() || 
                        $('p').first().text().trim()

    // Try common selectors for image
    const imageUrl = $('meta[property="og:image"]').attr('content') || 
                     $('img').first().attr('src')

    // Try common selectors for date
    const publishedAt = this.parseDate(
      $('meta[property="article:published_time"]').attr('content') || 
      $('meta[name="pubdate"]').attr('content') || 
      $('time').attr('datetime')
    )

    // Try common selectors for author
    const author = $('meta[name="author"]').attr('content')?.trim() || 
                   $('meta[property="article:author"]').attr('content')?.trim()

    if (!title || !publishedAt) {
      logger.debug(`Generic extraction failed for ${url}: missing title or date`)
      return null
    }

    return {
      url,
      title,
      description,
      imageUrl,
      publishedAt,
      author,
      source: source.name,
      sourceLanguage: source.language,
      metadata: { extractor: 'generic' }
    }
  }

  private parseDate(dateStr?: string): Date | null {
    if (!dateStr) {
      return null
    }

    try {
      const date = new Date(dateStr)
      
      // Check if date is valid
      if (isNaN(date.getTime())) {
        return null
      }
      
      // Validate date is reasonable (not too far in past or future)
      const now = new Date()
      const twoYearsAgo = new Date(now.getFullYear() - 2, now.getMonth(), now.getDate())
      const oneWeekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
      
      if (date < twoYearsAgo || date > oneWeekFromNow) {
        logger.debug(`Date outside valid range: ${dateStr} (${date.toISOString()})`)
        return null
      }
      
      return date
    } catch (error) {
      logger.debug(`Failed to parse date: ${dateStr}`, error)
      return null
    }
  }
}