import { logger } from '@babel-feed/utils'
import { NewsSourcer, type FeedValidationResult } from '@babel-feed/news-sourcer'
import { DiscoveredSource } from '../common/types'
import { newsSources, getDatabase } from '@babel-feed/pgdb'
import { eq } from 'drizzle-orm'
import axios from 'axios'
import * as cheerio from 'cheerio'

export class SourceDiscoveryService {
  private isRunning = false
  private newsSourcer: NewsSourcer
  private db!: Awaited<ReturnType<typeof getDatabase>>
  private scheduledDiscoveryTimer?: NodeJS.Timeout
  private discoveryInterval = 6 * 60 * 60 * 1000 // 6 hours

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
  }

  async startDiscovery(): Promise<void> {
    if (this.isRunning) {
      logger.warn('Source discovery is already running')
      return
    }

    this.isRunning = true
    logger.info('Starting enhanced source discovery pipeline')
    
    try {
      // Step 1: Crawl public seed lists
      const seedUrls = await this.crawlPublicSeedLists()
      logger.info(`Collected ${seedUrls.length} seed URLs from public sources`)
      
      // Step 2: Discover sources from seed list
      const discoveredSources = await this.discoverFromSeedList(seedUrls)
      logger.info(`Discovered ${discoveredSources.length} potential sources`)
      
      // Step 3: Apply quality scoring and diversity filters
      const qualifiedSources = await this.applyQualityFilters(discoveredSources)
      logger.info(`${qualifiedSources.length} sources passed quality filters`)
      
      // Step 4: Add discovered sources to database
      await this.addDiscoveredSources(qualifiedSources)
      logger.info('Source discovery pipeline completed successfully')
      
    } catch (error) {
      logger.error('Source discovery pipeline failed:', error)
    } finally {
      this.isRunning = false
    }
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
   * Start periodic source discovery
   */
  async startPeriodicDiscovery(intervalHours = 6): Promise<void> {
    this.discoveryInterval = intervalHours * 60 * 60 * 1000
    
    if (this.scheduledDiscoveryTimer) {
      logger.warn('Periodic discovery is already running')
      return
    }

    logger.info(`Starting periodic source discovery (every ${intervalHours} hours)`)
    
    // Run initial discovery
    await this.startDiscovery()
    
    // Schedule recurring discovery
    this.scheduledDiscoveryTimer = setInterval(async () => {
      try {
        logger.info('Running scheduled source discovery')
        await this.startDiscovery()
      } catch (error) {
        logger.error('Scheduled discovery failed:', error)
      }
    }, this.discoveryInterval)
  }

  /**
   * Stop periodic source discovery
   */
  stopPeriodicDiscovery(): void {
    if (this.scheduledDiscoveryTimer) {
      clearInterval(this.scheduledDiscoveryTimer)
      this.scheduledDiscoveryTimer = undefined
      logger.info('Stopped periodic source discovery')
    } else {
      logger.warn('Periodic discovery is not running')
    }
  }

  /**
   * Run discovery for specific seed URLs (manual discovery)
   */
  async discoverFromUrls(urls: string[]): Promise<DiscoveredSource[]> {
    logger.info(`Running manual discovery for ${urls.length} URLs`)
    
    try {
      const discoveredSources = await this.discoverFromSeedList(urls)
      const qualifiedSources = await this.applyQualityFilters(discoveredSources)
      await this.addDiscoveredSources(qualifiedSources)
      
      logger.info(`Manual discovery completed: ${qualifiedSources.length} sources added`)
      return qualifiedSources
    } catch (error) {
      logger.error('Manual discovery failed:', error)
      throw error
    }
  }

  /**
   * Crawl public sources to collect seed URLs for news sites
   */
  async crawlPublicSeedLists(): Promise<string[]> {
    logger.info('Starting public seed list crawling')
    const allSeedUrls: Set<string> = new Set()

    // Wikipedia news sources
    const wikipediaSources = await this.crawlWikipediaSources()
    wikipediaSources.forEach(url => allSeedUrls.add(url))
    logger.info(`Found ${wikipediaSources.length} URLs from Wikipedia`)

    // GitHub news sources lists
    const githubSources = await this.crawlGitHubSources()
    githubSources.forEach(url => allSeedUrls.add(url))
    logger.info(`Found ${githubSources.length} URLs from GitHub`)

    // Curated high-quality news sources
    const curatedSources = this.getCuratedSources()
    curatedSources.forEach(url => allSeedUrls.add(url))
    logger.info(`Added ${curatedSources.length} curated sources`)

    const finalList = Array.from(allSeedUrls)
    logger.info(`Total unique seed URLs collected: ${finalList.length}`)
    return finalList
  }

  /**
   * Crawl Wikipedia's list of news websites
   */
  private async crawlWikipediaSources(): Promise<string[]> {
    const sources: string[] = []
    
    try {
      // List of Wikipedia pages with news sources
      const wikipediaPages = [
        'https://en.wikipedia.org/wiki/List_of_news_websites',
        'https://en.wikipedia.org/wiki/List_of_newspapers_in_the_United_States',
        'https://en.wikipedia.org/wiki/Category:News_websites',
        'https://en.wikipedia.org/wiki/List_of_online_newspapers'
      ]

      for (const pageUrl of wikipediaPages) {
        try {
          const response = await axios.get(pageUrl, {
            timeout: 10000,
            headers: {
              'User-Agent': 'BabelFeed-NewsAggregator/1.0 (https://babel-feed.com; news-discovery)'
            }
          })

          const $ = cheerio.load(response.data)
          
          // Extract URLs from external links in the content
          $('a[href^="http"]').each((_, element) => {
            const url = $(element).attr('href')
            if (url && this.isValidNewsUrl(url)) {
              sources.push(url)
            }
          })
        } catch (error) {
          logger.warn(`Failed to crawl Wikipedia page ${pageUrl}:`, error)
        }
      }
    } catch (error) {
      logger.error('Failed to crawl Wikipedia sources:', error)
    }

    return [...new Set(sources)] // Remove duplicates
  }

  /**
   * Crawl GitHub repositories with news source lists
   */
  private async crawlGitHubSources(): Promise<string[]> {
    const sources: string[] = []
    
    try {
      // Known GitHub repositories with news source lists
      const githubSources = [
        'https://raw.githubusercontent.com/opml/lists/master/lists/news.opml',
        'https://raw.githubusercontent.com/awesome-selfhosted/awesome-selfhosted/master/README.md'
      ]

      for (const sourceUrl of githubSources) {
        try {
          const response = await axios.get(sourceUrl, {
            timeout: 10000,
            headers: {
              'User-Agent': 'BabelFeed-NewsAggregator/1.0'
            }
          })

          if (sourceUrl.endsWith('.opml')) {
            // Parse OPML file
            const opmlSources = this.parseOpmlSources(response.data)
            sources.push(...opmlSources)
          } else {
            // Parse markdown/text content for URLs
            const textSources = this.extractUrlsFromText(response.data)
            sources.push(...textSources)
          }
        } catch (error) {
          logger.warn(`Failed to crawl GitHub source ${sourceUrl}:`, error)
        }
      }
    } catch (error) {
      logger.error('Failed to crawl GitHub sources:', error)
    }

    return [...new Set(sources)] // Remove duplicates
  }

  /**
   * Get curated list of high-quality news sources
   */
  private getCuratedSources(): string[] {
    return [
      // Major international news
      'https://www.bbc.com',
      'https://www.reuters.com',
      'https://www.ap.org',
      'https://www.theguardian.com',
      'https://www.cnn.com',
      'https://www.nytimes.com',
      'https://www.washingtonpost.com',
      'https://www.wsj.com',
      
      // Technology news
      'https://techcrunch.com',
      'https://arstechnica.com',
      'https://www.theverge.com',
      'https://www.wired.com',
      'https://www.engadget.com',
      'https://hacker-news.firebaseio.com',
      
      // International sources
      'https://www.dw.com',
      'https://www.france24.com',
      'https://www.aljazeera.com',
      'https://www.scmp.com',
      'https://www.japantimes.co.jp',
      'https://www.thehindu.com',
      
      // Business and finance
      'https://www.bloomberg.com',
      'https://www.ft.com',
      'https://www.economist.com',
      'https://www.forbes.com',
      'https://www.cnbc.com',
      
      // Science and health
      'https://www.nature.com',
      'https://www.sciencedaily.com',
      'https://www.newscientist.com',
      'https://www.healthline.com'
    ]
  }

  /**
   * Apply quality filters and diversity management
   */
  async applyQualityFilters(sources: DiscoveredSource[]): Promise<DiscoveredSource[]> {
    logger.info(`Applying quality filters to ${sources.length} discovered sources`)
    
    // Sort by quality score (highest first)
    const sortedSources = sources.sort((a, b) => (b.quality || 0) - (a.quality || 0))
    
    // Apply diversity caps per category and language
    const categoryLimits: Record<string, number> = {
      'news': 50,
      'technology': 20,
      'business': 15,
      'politics': 15,
      'science': 10,
      'sports': 10,
      'entertainment': 8
    }
    
    const languageLimits: Record<string, number> = {
      'en': 100,
      'zh-CN': 30,
      'ja': 20,
      'es': 20,
      'fr': 15,
      'de': 15
    }
    
    const categoryCounts: Record<string, number> = {}
    const languageCounts: Record<string, number> = {}
    const qualifiedSources: DiscoveredSource[] = []
    
    for (const source of sortedSources) {
      const category = source.category || 'news'
      const language = source.language || 'en'
      
      // Check quality threshold
      if ((source.quality || 0) < 0.3) {
        logger.debug(`Source ${source.url} rejected: quality too low (${source.quality})`)
        continue
      }
      
      // Check category limits
      const currentCategoryCount = categoryCounts[category] || 0
      const categoryLimit = categoryLimits[category] || 5
      if (currentCategoryCount >= categoryLimit) {
        logger.debug(`Source ${source.url} rejected: category ${category} limit reached`)
        continue
      }
      
      // Check language limits
      const currentLanguageCount = languageCounts[language] || 0
      const languageLimit = languageLimits[language] || 5
      if (currentLanguageCount >= languageLimit) {
        logger.debug(`Source ${source.url} rejected: language ${language} limit reached`)
        continue
      }
      
      // Source passes all filters
      qualifiedSources.push(source)
      categoryCounts[category] = currentCategoryCount + 1
      languageCounts[language] = currentLanguageCount + 1
    }
    
    logger.info(`Quality filtering completed: ${qualifiedSources.length}/${sources.length} sources qualified`)
    return qualifiedSources
  }

  /**
   * Parse OPML file for RSS sources
   */
  private parseOpmlSources(opmlContent: string): string[] {
    const sources: string[] = []
    
    try {
      const $ = cheerio.load(opmlContent, { xmlMode: true })
      
      $('outline').each((_, element) => {
        const xmlUrl = $(element).attr('xmlUrl') || $(element).attr('xmlurl')
        const htmlUrl = $(element).attr('htmlUrl') || $(element).attr('htmlurl')
        
        if (xmlUrl && this.isValidNewsUrl(xmlUrl)) {
          sources.push(xmlUrl)
        }
        if (htmlUrl && this.isValidNewsUrl(htmlUrl)) {
          sources.push(htmlUrl)
        }
      })
      
      // Also try case-insensitive parsing if no results
      if (sources.length === 0) {
        $('outline').each((_, element) => {
          const attrs = element.attribs || {}
          for (const [key, value] of Object.entries(attrs)) {
            if (key.toLowerCase() === 'xmlurl' || key.toLowerCase() === 'htmlurl') {
              if (value && this.isValidNewsUrl(value)) {
                sources.push(value)
              }
            }
          }
        })
      }
    } catch (error) {
      logger.warn('Failed to parse OPML content:', error)
    }
    
    return sources
  }

  /**
   * Extract URLs from text content
   */
  private extractUrlsFromText(text: string): string[] {
    const sources: string[] = []
    
    // Regex to match URLs
    const urlRegex = /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/g
    const matches = text.match(urlRegex)
    
    if (matches) {
      for (const url of matches) {
        if (this.isValidNewsUrl(url)) {
          sources.push(url)
        }
      }
    }
    
    return sources
  }

  /**
   * Check if URL is likely a news source
   */
  private isValidNewsUrl(url: string): boolean {
    try {
      const urlObj = new URL(url)
      const domain = urlObj.hostname.toLowerCase()
      
      // Skip non-HTTP URLs
      if (!['http:', 'https:'].includes(urlObj.protocol)) {
        return false
      }
      
      // Skip obvious non-news domains
      const skipDomains = [
        'facebook.com', 'twitter.com', 'instagram.com', 'youtube.com',
        'linkedin.com', 'pinterest.com', 'reddit.com', 'wikipedia.org',
        'github.com', 'stackoverflow.com', 'amazon.com', 'google.com'
      ]
      
      for (const skipDomain of skipDomains) {
        if (domain.includes(skipDomain)) {
          return false
        }
      }
      
      // Check for news-like patterns
      const newsPatterns = [
        'news', 'times', 'post', 'herald', 'gazette', 'tribune', 'journal',
        'daily', 'weekly', 'press', 'media', 'today', 'wire', 'report'
      ]
      
      for (const pattern of newsPatterns) {
        if (domain.includes(pattern)) {
          return true
        }
      }
      
      // Check for common news TLDs and patterns
      if (domain.endsWith('.news') || 
          domain.includes('news') || 
          domain.includes('media') ||
          /\.(com|org|net|co\.uk|co\.jp|cn)$/.test(domain)) {
        return true
      }
      
      return false
    } catch {
      return false
    }
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

  getStatus(): { running: boolean; sourcerInitialized: boolean; periodicDiscovery: boolean; discoveryInterval: number } {
    return { 
      running: this.isRunning,
      sourcerInitialized: !!this.newsSourcer,
      periodicDiscovery: !!this.scheduledDiscoveryTimer,
      discoveryInterval: this.discoveryInterval
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
  private calculateReliabilityFromValidation(validation: FeedValidationResult): number {
    if (!validation?.valid) return 0
    
    let reliability = 0.5 // Base score for valid feed
    
    if (validation.articleCount && validation.articleCount > 0) {
      reliability += 0.2
    }
    
    if (validation.sampleUrls && validation.sampleUrls.length > 0) {
      reliability += 0.1
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