import { createHash } from 'crypto'
import RSSParser from 'rss-parser'
import * as cheerio from 'cheerio'
import { NewsSource, RawArticle, AggregatorError } from '../modules/common/types'
import { logger } from '../modules/common/logger'
import { NewsSourceManager } from './news-source-manager'

export class RssProcessor {
  private sourceManager: NewsSourceManager
  private processingQueue = new Map<string, Promise<RawArticle[]>>()
  private rssParser: RSSParser

  constructor(sourceManager: NewsSourceManager) {
    this.sourceManager = sourceManager
    this.rssParser = new RSSParser({
      timeout: 30000,
      headers: {
        'User-Agent': 'BabelFeed-NewsAggregator/1.0',
        'Accept': 'application/rss+xml, application/xml, text/xml',
      },
      customFields: {
        item: [
          ['media:content', 'mediaContent'],
          ['media:thumbnail', 'mediaThumbnail'],
          ['description', 'description'],
          ['content:encoded', 'contentEncoded'],
          ['dc:creator', 'author'],
          ['author', 'author'],
        ],
      },
    })
  }

  async processAllSources(): Promise<{
    processed: number
    errors: number
    articles: RawArticle[]
    skipped: number
  }> {
    const enabledSources = await this.sourceManager.getEnabledSources()
    const sourcesToProcess = enabledSources.filter(source => this.shouldProcessSource(source))

    logger.info(`Processing ${sourcesToProcess.length} of ${enabledSources.length} enabled sources (${enabledSources.length - sourcesToProcess.length} skipped due to polling intervals)`)

    const results = await Promise.allSettled(
      sourcesToProcess.map(source => this.processSource(source))
    )

    let totalArticles: RawArticle[] = []
    let processed = 0
    let errors = 0

    for (const result of results) {
      if (result.status === 'fulfilled') {
        processed++
        totalArticles = totalArticles.concat(result.value)
      } else {
        errors++
        logger.error('Source processing failed:', result.reason)
      }
    }

    const skipped = enabledSources.length - sourcesToProcess.length
    logger.info(`RSS processing complete: ${processed} sources processed, ${errors} errors, ${skipped} skipped, ${totalArticles.length} articles`)
    return { processed, errors, articles: totalArticles, skipped }
  }

  private shouldProcessSource(source: NewsSource): boolean {
    if (!source.lastFetched) {
      // Never fetched before, should process
      return true
    }

    const now = new Date()
    const lastFetched = new Date(source.lastFetched)
    const intervalMs = source.pollingInterval // Already in milliseconds
    const nextFetchTime = new Date(lastFetched.getTime() + intervalMs)

    const shouldProcess = now >= nextFetchTime

    if (!shouldProcess) {
      const remainingMinutes = Math.ceil((nextFetchTime.getTime() - now.getTime()) / (60 * 1000))
      const intervalMinutes = Math.ceil(source.pollingInterval / (60 * 1000))
      logger.debug(`Skipping ${source.name}: next fetch in ${remainingMinutes} minutes (interval: ${intervalMinutes}min)`)
    }

    return shouldProcess
  }

  async processSource(source: NewsSource): Promise<RawArticle[]> {
    // Prevent duplicate processing
    const existingProcess = this.processingQueue.get(source.id || '')
    if (existingProcess) {
      logger.debug(`Source ${source.name} already being processed, waiting...`)
      return existingProcess
    }

    const processingPromise = this.doProcessSource(source)
    this.processingQueue.set(source.id || '', processingPromise)

    try {
      const result = await processingPromise
      return result
    } finally {
      this.processingQueue.delete(source.id || '')
    }
  }

  private async doProcessSource(source: NewsSource): Promise<RawArticle[]> {
    logger.debug(`Processing RSS source: ${source.name}`)
    const startTime = Date.now()

    try {
      const articles = await this.fetchAndParseRss(source)
      const processingTime = Date.now() - startTime

      // Update source success metrics
      await this.sourceManager.updateSourceFetchStatus(source.id || '', true)

      logger.info(`Successfully processed ${articles.length} articles from ${source.name} in ${processingTime}ms`)
      return articles
    } catch (error) {
      const processingTime = Date.now() - startTime
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'

      // Update source error metrics
      await this.sourceManager.updateSourceFetchStatus(source.id || '', false, errorMessage)

      logger.error(`Failed to process RSS source ${source.name} after ${processingTime}ms:`, error)
      throw new AggregatorError(`RSS processing failed for ${source.name}`, 'RSS_PROCESSING_ERROR')
    }
  }

  private async fetchAndParseRss(source: NewsSource): Promise<RawArticle[]> {
    try {
      logger.debug(`Fetching RSS feed from: ${source.url}`)

      const feed = await this.rssParser.parseURL(source.url)

      if (!feed.items || feed.items.length === 0) {
        logger.warn(`No items found in RSS feed for ${source.name}`)
        return []
      }

      const articles: RawArticle[] = []

      for (const item of feed.items) {
        try {
          const article = await this.extractArticleFromItem(item, source)
          if (article) {
            articles.push(article)
          }
        } catch (error) {
          logger.warn(`Failed to extract article from item in ${source.name}:`, error)
        }
      }

      logger.debug(`Extracted ${articles.length} articles from ${source.name}`)
      return this.deduplicateArticles(articles)
    } catch (error) {
      logger.error(`RSS parsing failed for ${source.name}:`, error)
      throw new AggregatorError(`RSS parsing failed: ${error instanceof Error ? error.message : 'Unknown error'}`, 'RSS_PARSE_ERROR')
    }
  }

  private async extractArticleFromItem(item: any, source: NewsSource): Promise<RawArticle | null> {
    // Validate required fields
    if (!item.link || !item.title) {
      logger.debug(`Skipping item missing required fields (link or title) from ${source.name}`)
      return null
    }

    try {
      // Extract publication date
      const publishedAt = this.parsePublicationDate(item.pubDate || item.isoDate)
      if (!publishedAt) {
        logger.debug(`Skipping item with invalid date from ${source.name}: ${item.title}`)
        return null
      }

      // Extract description/content
      const description = this.extractDescription(item)

      // Extract image URL
      const imageUrl = this.extractImageUrl(item)

      // Extract author
      const author = this.extractAuthor(item)

      // Create article object
      const article: RawArticle = {
        url: item.link.trim(),
        title: item.title.trim(),
        description,
        imageUrl,
        publishedAt,
        author,
        source: source.name,
        sourceLanguage: source.language,
        tags: item.categories || [],
        metadata: {
          guid: item.guid,
          sourceId: source.id,
          extractedAt: new Date(),
        },
      }

      // Validate article quality
      if (!this.validateArticleQuality(article)) {
        logger.debug(`Skipping low-quality article from ${source.name}: ${article.title}`)
        return null
      }

      return article
    } catch (error) {
      logger.warn(`Failed to extract article from item in ${source.name}:`, error)
      return null
    }
  }

  private parsePublicationDate(dateString?: string): Date | null {
    if (!dateString) return null

    try {
      const parsed = new Date(dateString)
      if (isNaN(parsed.getTime())) return null

      // Reject dates too far in the future (more than 1 day)
      const now = new Date()
      const oneDayFromNow = new Date(now.getTime() + 24 * 60 * 60 * 1000)
      if (parsed > oneDayFromNow) return null

      // Reject dates too old (more than 1 year)
      const oneYearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000)
      if (parsed < oneYearAgo) return null

      return parsed
    } catch (error) {
      logger.debug(`Failed to parse date: ${dateString}`, error)
      return null
    }
  }

  private extractDescription(item: any): string | undefined {
    // Try different description fields in order of preference
    const candidates = [
      item.contentEncoded,
      item.content,
      item.description,
      item.summary,
    ].filter(Boolean)

    if (candidates.length === 0) return undefined

    // Use the longest non-empty description
    let bestDescription = ''
    for (const candidate of candidates) {
      const cleaned = this.cleanHtmlContent(candidate)
      if (cleaned.length > bestDescription.length) {
        bestDescription = cleaned
      }
    }

    return bestDescription.length > 0 ? bestDescription : undefined
  }

  private extractImageUrl(item: any): string | undefined {
    // Try different image sources
    if (item.enclosure?.type?.startsWith('image/')) {
      return item.enclosure.url
    }

    if (item.mediaThumbnail?.url) {
      return item.mediaThumbnail.url
    }

    if (item.mediaContent?.url && item.mediaContent.type?.startsWith('image/')) {
      return item.mediaContent.url
    }

    // Extract image from content using cheerio
    const content = item.contentEncoded || item.content || item.description
    if (content) {
      try {
        const $ = cheerio.load(content)
        const img = $('img').first()
        if (img.length > 0) {
          const src = img.attr('src')
          if (src && this.isValidImageUrl(src)) {
            return src
          }
        }
      } catch (error) {
        logger.debug('Failed to extract image from content:', error)
      }
    }

    return undefined
  }

  private extractAuthor(item: any): string | undefined {
    return item.author || item['dc:creator'] || item.creator || undefined
  }

  private cleanHtmlContent(html: string): string {
    if (!html) return ''

    try {
      const $ = cheerio.load(html)

      // Remove script and style elements
      $('script, style').remove()

      // Get text content and clean it up
      const text = $.text()
        .replace(/\s+/g, ' ')
        .trim()

      return text
    } catch (error) {
      logger.debug('Failed to clean HTML content:', error)
      return html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim()
    }
  }

  private isValidImageUrl(url: string): boolean {
    try {
      const parsed = new URL(url)
      return ['http:', 'https:'].includes(parsed.protocol) &&
        /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(parsed.pathname)
    } catch {
      return false
    }
  }

  private validateArticleQuality(article: RawArticle): boolean {
    // Check minimum title length
    if (article.title.length < 10) {
      return false
    }

    // Check for spam indicators in title
    const spamIndicators = [
      /^(ad|advertisement|sponsored):/i,
      /\b(buy now|click here|free trial)\b/i,
      /^[^a-zA-Z]*$/,  // Title with no letters
    ]

    if (spamIndicators.some(pattern => pattern.test(article.title))) {
      return false
    }

    // Check description quality if present
    if (article.description) {
      if (article.description.length < 20) {
        return false
      }
    }

    // Check URL validity
    try {
      const url = new URL(article.url)
      if (!['http:', 'https:'].includes(url.protocol)) {
        return false
      }
    } catch {
      return false
    }

    return true
  }

  private deduplicateArticles(articles: RawArticle[]): RawArticle[] {
    const seen = new Set<string>()
    const deduped: RawArticle[] = []

    for (const article of articles) {
      const contentHash = this.generateContentHash(article)
      if (!seen.has(contentHash)) {
        seen.add(contentHash)
        deduped.push(article)
      }
    }

    const duplicatesFiltered = articles.length - deduped.length
    if (duplicatesFiltered > 0) {
      logger.debug(`Filtered ${duplicatesFiltered} duplicate articles`)
    }

    return deduped
  }

  private generateContentHash(article: RawArticle): string {
    // Create hash based on URL, title, and normalized publication date for robust deduplication
    const normalizedUrl = article.url.toLowerCase().replace(/[?#].*$/, '') // Remove query params and fragments
    const normalizedTitle = article.title.toLowerCase().trim().replace(/\s+/g, ' ')
    const dateString = article.publishedAt.toISOString().split('T')[0] // Use date part only

    const content = `${normalizedUrl}|${normalizedTitle}|${dateString}`
    return createHash('sha256').update(content).digest('hex')
  }

  async getProcessingStats(): Promise<{
    activeSources: number
    queueLength: number
    totalSources: number
    enabledSources: number
  }> {
    const allSources = await this.sourceManager.getAllSources()
    const enabledSources = await this.sourceManager.getEnabledSources()

    return {
      activeSources: this.processingQueue.size,
      queueLength: this.processingQueue.size,
      totalSources: allSources.length,
      enabledSources: enabledSources.length,
    }
  }
}