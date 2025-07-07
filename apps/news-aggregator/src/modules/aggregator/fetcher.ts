import { Article } from '../../../../../packages/newspaper4k-ts/src/article'
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
  private readonly config = {
    language: 'en',
    userAgent: 'BabelFeed-NewsAggregator/1.0',
    timeout: 30000,
    maxContentLength: 10 * 1024 * 1024, // 10MB
    minWordCount: 50,
    minSentCount: 3,
    maxTitle: 200,
    maxText: 1000000
  }

  async extractFromUrl(url: string, source: NewsSource): Promise<RawArticle[]> {
    try {
      logger.info(`Extracting content from ${url} using newspaper4k-ts`)
      
      // Create article instance with source language preference
      const article = new Article(url, {
        language: source.language || 'en',
        userAgent: this.config.userAgent,
        timeout: this.config.timeout,
        minWordCount: this.config.minWordCount,
        minSentCount: this.config.minSentCount,
        maxTitle: this.config.maxTitle,
        maxText: this.config.maxText
      })
      
      // Download and parse article content
      await article.build()
      
      // Validate article quality
      if (!article.isValidArticle()) {
        logger.debug(`Article quality validation failed for ${url}`)
        return []
      }
      
      // Extract the data we need
      const result = article.getExtractionResult()
      
      // Convert to our internal format
      const rawArticle: RawArticle = {
        url: article.url,
        title: result.title,
        description: this.generateDescription(result.text, result.meta.description),
        imageUrl: result.images.length > 0 ? result.images[0] : undefined,
        publishedAt: result.publishDate,
        author: result.authors.length > 0 ? result.authors.join(', ') : undefined,
        source: source.name,
        sourceLanguage: result.language || source.language,
        metadata: {
          extractor: 'newspaper4k-ts',
          wordCount: article.getStats().wordCount,
          readingTime: article.getStats().readingTime,
          complexity: article.getStats().complexity,
          keywords: result.meta.keywords?.join(', '),
          siteName: result.meta.siteName,
          canonicalUrl: result.meta.canonicalUrl
        }
      }
      
      // Validate required fields
      if (!rawArticle.title || !rawArticle.publishedAt) {
        logger.debug(`Article missing required fields for ${url}: title=${!!rawArticle.title}, date=${!!rawArticle.publishedAt}`)
        return []
      }
      
      logger.info(`Successfully extracted article from ${url}: "${rawArticle.title}"`)
      return [rawArticle]
      
    } catch (error) {
      logger.error(`HTML extraction failed for ${url}:`, error)
      throw new AggregatorError(`HTML extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`, 'HTML_EXTRACTION_ERROR')
    }
  }
  
  private generateDescription(fullText: string, metaDescription?: string): string {
    // Prefer meta description if available and reasonable length
    if (metaDescription && metaDescription.length > 50 && metaDescription.length < 300) {
      return metaDescription
    }
    
    // Generate description from first paragraph of full text
    if (fullText) {
      const sentences = fullText.split(/[.!?]+/)
      const firstSentences = sentences.slice(0, 2).join('. ').trim()
      
      if (firstSentences.length > 50) {
        return firstSentences.length > 300 ? firstSentences.substring(0, 297) + '...' : firstSentences
      }
    }
    
    return metaDescription || ''
  }
}