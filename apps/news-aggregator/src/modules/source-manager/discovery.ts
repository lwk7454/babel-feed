import { logger } from '@babel-feed/utils'
import { NewsSourcer } from '@babel-feed/news-sourcer'
import { DiscoveredSource } from '../common/types'
import { newsSources, getDatabase } from '@babel-feed/pgdb'
import { eq } from 'drizzle-orm'

export class SourceDiscoveryService {
  private isRunning = false
  private newsSourcer: NewsSourcer
  private db!: Awaited<ReturnType<typeof getDatabase>>

  constructor() {
    this.newsSourcer = new NewsSourcer({
      validation: {
        maxRetries: 3,
        baseDelay: 1000,
        maxDelay: 30000,
        timeout: 10000,
        validateUrls: true
      },
      userAgent: 'BabelFeed-NewsAggregator/1.0'
    })
  }

  async initialize(): Promise<void> {
    this.db = await getDatabase()
    await this.newsSourcer.initialize()
    logger.info('Source discovery service initialized with enhanced NewsSourcer')
  }

  async startDiscovery(): Promise<void> {
    if (this.isRunning) {
      logger.warn('Source discovery is already running')
      return
    }

    this.isRunning = true
    logger.info('Starting enhanced source discovery pipeline')
    
    // TODO: Implement discovery pipeline with public lists and search queries
    // For now, this is a placeholder for the actual automated discovery
    logger.info('Automated discovery pipeline not yet implemented')
  }

  async stopDiscovery(): Promise<void> {
    if (!this.isRunning) {
      logger.warn('Source discovery is not running')
      return
    }

    this.isRunning = false
    logger.info('Stopping source discovery')
  }

  /**
   * Discover and validate RSS/Atom feeds from a list of seed URLs
   */
  async discoverFromSeedList(seedUrls: string[]): Promise<DiscoveredSource[]> {
    logger.info(`Discovering feeds from ${seedUrls.length} seed URLs`)
    const discoveredSources: DiscoveredSource[] = []

    for (const url of seedUrls) {
      try {
        logger.info(`Analyzing source: ${url}`)
        
        // Use NewsSourcer to discover RSS/Atom feeds
        const analysis = await this.newsSourcer.analyzeSource(url)
        
        // Convert RSS feeds to DiscoveredSource format
        for (const rssResult of analysis.rssFeeds) {
          const validationResult = analysis.validationResults.get(rssResult.url)
          if (validationResult?.valid) {
            discoveredSources.push({
              url: rssResult.url,
              name: rssResult.title || this.extractDomainName(url),
              sourceType: 'rss',
              category: this.inferCategory(rssResult.title || '', rssResult.description || ''),
              language: 'en', // TODO: Implement language detection
              quality: this.calculateReliabilityFromValidation(validationResult),
              metadata: {
                originalSiteUrl: url,
                feedTitle: rssResult.title,
                feedDescription: rssResult.description,
                articleCount: validationResult.articleCount,
                sampleUrls: validationResult.sampleUrls
              }
            })
          }
        }

        // Convert Atom feeds to DiscoveredSource format
        for (const atomResult of analysis.atomFeeds) {
          const validationResult = analysis.validationResults.get(atomResult.url)
          if (validationResult?.valid) {
            discoveredSources.push({
              url: atomResult.url,
              name: atomResult.title || this.extractDomainName(url),
              sourceType: 'rss', // Map atom to rss for compatibility with the interface
              category: this.inferCategory(atomResult.title || '', atomResult.description || ''),
              language: 'en', // TODO: Implement language detection
              quality: this.calculateReliabilityFromValidation(validationResult),
              metadata: {
                originalSiteUrl: url,
                feedTitle: atomResult.title,
                feedDescription: atomResult.description,
                articleCount: validationResult.articleCount,
                sampleUrls: validationResult.sampleUrls,
                actualType: 'atom' // Store the actual type in metadata
              }
            })
          }
        }

        logger.info(`Discovered ${analysis.rssFeeds.length + analysis.atomFeeds.length} feeds from ${url}`)
        
      } catch (error) {
        logger.error(`Failed to analyze source ${url}:`, error)
      }
    }

    logger.info(`Total discovered sources: ${discoveredSources.length}`)
    return discoveredSources
  }

  /**
   * Validate a source URL using enhanced NewsSourcer validation
   */
  async validateSource(sourceUrl: string): Promise<boolean> {
    try {
      logger.info(`Validating source: ${sourceUrl}`)
      
      const validationResult = await this.newsSourcer.validateEndpoint(sourceUrl, {
        validateUrls: true,
        maxRetries: 2,
        timeout: 10000
      })

      logger.info(`Validation result for ${sourceUrl}: ${validationResult.valid ? 'valid' : 'invalid'}`)
      return validationResult.valid
      
    } catch (error) {
      logger.error(`Source validation failed for ${sourceUrl}:`, error)
      return false
    }
  }

  /**
   * Score a source's quality and reliability
   */
  async scoreSource(sourceUrl: string): Promise<number> {
    try {
      logger.info(`Scoring source: ${sourceUrl}`)
      
      const validationResult = await this.newsSourcer.validateEndpoint(sourceUrl, {
        validateUrls: true,
        maxRetries: 1,
        timeout: 5000
      })

      if (!validationResult.valid) {
        return 0
      }

      // Calculate composite score based on multiple factors
      let score = 0

      // Base score for valid feed
      score += 0.3

      // Reliability score (URL validation success rate)
      score += (validationResult.reliability || 0) * 0.3

      // Article count score (more articles = higher quality)
      const articleCount = validationResult.articleCount || 0
      const articleScore = Math.min(articleCount / 20, 1) * 0.2
      score += articleScore

      // Response time score (faster = better)
      const responseTime = validationResult.responseTime || 10000
      const responseScore = Math.max(0, (10000 - responseTime) / 10000) * 0.1
      score += responseScore

      // Category bonus (news sources get higher score)
      const category = this.inferCategory(validationResult.title || '', '')
      if (['news', 'politics', 'world', 'technology'].includes(category.toLowerCase())) {
        score += 0.1
      }

      // Normalize to 0-1 range
      score = Math.min(Math.max(score, 0), 1)

      logger.info(`Source ${sourceUrl} scored: ${score.toFixed(3)}`)
      return score
      
    } catch (error) {
      logger.error(`Source scoring failed for ${sourceUrl}:`, error)
      return 0
    }
  }

  /**
   * Add discovered and validated sources to the database
   */
  async addDiscoveredSources(discoveredSources: DiscoveredSource[]): Promise<void> {
    logger.info(`Adding ${discoveredSources.length} discovered sources to database`)

    for (const source of discoveredSources) {
      try {
        // Check if source already exists
        const [existingSource] = await this.db
          .select()
          .from(newsSources)
          .where(eq(newsSources.url, source.url))
          .limit(1)

        if (existingSource) {
          logger.info(`Source already exists: ${source.url}`)
          continue
        }

        // Insert new source
        const [newSource] = await this.db
          .insert(newsSources)
          .values({
            name: source.name,
            slug: this.generateSlug(source.name),
            url: source.url,
            sourceType: source.sourceType,
            language: source.language || 'en',
            category: source.category || 'news',
            tags: [],
            enabled: true,
            pollingInterval: 300000, // 5 minutes
            reliability: Math.floor((source.quality || 0) * 100),
            priority: this.calculatePriority(source.quality || 0, source.category || 'news'),
            metadata: source.metadata || {},
            createdAt: new Date(),
            updatedAt: new Date()
          })
          .returning()

        // Create source endpoint using NewsSourcer
        const actualType = source.metadata?.actualType as string || 'rss'
        await this.newsSourcer.createEndpoint({
          sourceId: newSource.id,
          endpointUrl: source.url,
          type: actualType === 'atom' ? 'atom' : 'rss',
          category: source.category,
          pollingInterval: 3600,
          reliability: source.quality || 0,
          priority: this.calculatePriority(source.quality || 0, source.category || 'news'),
          metadata: source.metadata || {}
        })

        logger.info(`Added new source: ${source.name} (${source.url})`)
        
      } catch (error) {
        logger.error(`Failed to add source ${source.url}:`, error)
      }
    }
  }

  getStatus(): { running: boolean; sourcerInitialized: boolean } {
    return { 
      running: this.isRunning,
      sourcerInitialized: !!this.newsSourcer
    }
  }

  /**
   * Extract domain name from URL for fallback naming
   */
  private extractDomainName(url: string): string {
    try {
      const domain = new URL(url).hostname
      return domain.replace('www.', '').split('.')[0]
    } catch {
      return 'Unknown Source'
    }
  }

  /**
   * Infer category from title and description
   */
  private inferCategory(title: string, description: string): string {
    const text = (title + ' ' + description).toLowerCase()
    
    const categories = {
      technology: ['tech', 'software', 'ai', 'computer', 'digital', 'startup'],
      politics: ['politics', 'government', 'election', 'policy', 'congress'],
      business: ['business', 'finance', 'economy', 'market', 'stock'],
      sports: ['sport', 'football', 'basketball', 'soccer', 'baseball'],
      health: ['health', 'medical', 'doctor', 'medicine', 'wellness'],
      science: ['science', 'research', 'study', 'discovery', 'laboratory'],
      entertainment: ['entertainment', 'movie', 'music', 'celebrity', 'tv']
    }

    for (const [category, keywords] of Object.entries(categories)) {
      if (keywords.some(keyword => text.includes(keyword))) {
        return category
      }
    }

    return 'news'
  }

  /**
   * Calculate reliability score from validation result
   */
  private calculateReliabilityFromValidation(validation: any): number {
    if (!validation?.valid) return 0
    
    let reliability = 0.5 // Base score for valid feed
    
    if (validation.articleCount && validation.articleCount > 0) {
      reliability += 0.2
    }
    
    if (validation.sampleUrls && validation.sampleUrls.length > 0) {
      reliability += 0.1
    }
    
    // Add reliability from URL validation if available
    if (typeof validation.reliability === 'number') {
      reliability = Math.max(reliability, validation.reliability)
    }
    
    return Math.min(reliability, 1.0)
  }

  /**
   * Calculate priority based on reliability and category
   */
  private calculatePriority(reliability: number, category: string): number {
    let priority = Math.floor(reliability * 5) + 1 // 1-5 based on reliability
    
    // Boost priority for important categories
    if (['news', 'politics', 'world', 'technology'].includes(category.toLowerCase())) {
      priority += 2
    }
    
    return Math.min(Math.max(priority, 1), 10)
  }

  /**
   * Generate URL-friendly slug from name
   */
  private generateSlug(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .substring(0, 100)
  }
}