import { fulltext, Configuration } from '@babel-feed/news-extractor'
import { logger } from '@babel-feed/utils'
import { RawArticle } from '../common/types'
import { ContentClassifier, type ClassificationResult } from '../recommendation/content-classifier'

export class ProcessorService {
  private isRunning = false
  private contentValidator: ContentValidator
  private contentClassifier: ContentClassifier

  constructor() {
    this.contentValidator = new ContentValidator()
    this.contentClassifier = new ContentClassifier()
  }

  async initialize(): Promise<void> {
    await this.contentClassifier.initialize()
    logger.info('Processor service initialized')
  }

  async processArticles(articles: RawArticle[]): Promise<RawArticle[]> {
    logger.info('Processing articles:', articles.length)
    
    const validatedArticles: RawArticle[] = []
    
    for (const article of articles) {
      try {
        const isValid = await this.validateContent(article)
        if (isValid) {
          const processedArticle = await this.normalizeContent(article)
          
          // Apply content classification
          const classificationResult = await this.classifyContent(processedArticle)
          
          // Enhance article with classification data
          const enhancedArticle = this.enrichWithClassification(processedArticle, classificationResult)
          
          validatedArticles.push(enhancedArticle)
        } else {
          logger.debug(`Article validation failed: ${article.title}`)
        }
      } catch (error) {
        logger.warn(`Error processing article: ${article.title}`, error)
      }
    }
    
    logger.info(`Processed ${validatedArticles.length}/${articles.length} articles successfully`)
    return validatedArticles
  }

  async extractContent(rawContent: string): Promise<{
    title: string;
    text: string;
    authors: string[];
    publishDate: Date | null;
    images: string[];
    summary: string;
    keywords: string[];
  }> {
    try {
      // Extract text content first  
      const config = new Configuration()
      config.update({
        language: 'en',
        minWordCount: 10,
        minSentCount: 1,
        maxTitle: 500,
        maxText: 100000
      })
      const extractedText = await fulltext(rawContent, config)
      
      // For now, return basic extraction result
      // In future, we can use the full Article class for complete extraction
      return {
        title: this.extractTitleFromHtml(rawContent),
        text: extractedText,
        authors: [],
        publishDate: null,
        images: [],
        summary: extractedText.substring(0, 500),
        keywords: []
      }
    } catch (error) {
      logger.error('Content extraction failed:', error)
      throw new Error('Content extraction failed')
    }
  }

  private extractTitleFromHtml(html: string): string {
    // Simple title extraction as fallback
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i)
    return titleMatch ? titleMatch[1].trim() : ''
  }

  async validateContent(article: RawArticle): Promise<boolean> {
    return this.contentValidator.validate(article)
  }

  async normalizeContent(article: RawArticle): Promise<RawArticle> {
    return this.contentValidator.normalize(article)
  }

  async classifyContent(article: RawArticle): Promise<ClassificationResult> {
    try {
      const title = article.title || ''
      const content = article.description || ''
      const summary = article.description || ''
      
      return await this.contentClassifier.classifyContent(title, content, summary)
    } catch (error) {
      logger.warn(`Content classification failed for article: ${article.title}`, error)
      
      // Return default classification on failure
      return {
        hierarchicalTags: [],
        sentiment: 'neutral',
        sentimentScore: 0.5,
        geographic: [],
        industry: [],
        topicScores: {}
      }
    }
  }

  enrichWithClassification(article: RawArticle, classification: ClassificationResult): RawArticle {
    // Extract tags from hierarchical classification
    const tags = classification.hierarchicalTags.map(tag => tag.label)
    
    // Add geographic locations as tags
    const geoTags = classification.geographic.map(geo => `geo:${geo.name}`)
    
    // Add industry tags
    const industryTags = classification.industry.map(ind => 
      ind.subsector ? `industry:${ind.sector}:${ind.subsector}` : `industry:${ind.sector}`
    )
    
    // Combine all tags
    const allTags = [...tags, ...geoTags, ...industryTags]
    
    return {
      ...article,
      tags: allTags,
      metadata: {
        ...article.metadata,
        classification: {
          sentiment: classification.sentiment,
          sentimentScore: classification.sentimentScore,
          topicScores: classification.topicScores,
          hierarchicalTags: classification.hierarchicalTags,
          geographic: classification.geographic,
          industry: classification.industry
        }
      }
    }
  }

  
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async enrichContent(_content: any): Promise<any> {
    // Placeholder implementation
    logger.info('Enriching content (placeholder)')
    throw new Error('Not implemented - needs content enrichment logic')
  }

  // TODO: Advanced processing features
  // - Content similarity detection
  // - Spam and low-quality content filtering
  // - Content categorization and tagging
  // - Reading time estimation
  // - Content complexity analysis
  // - Factual accuracy indicators

  getStatus(): { running: boolean } {
    return { running: this.isRunning }
  }
}

class ContentValidator {
  private readonly MIN_TITLE_LENGTH = 10
  private readonly MAX_TITLE_LENGTH = 200
  private readonly MIN_DESCRIPTION_LENGTH = 50
  private readonly MAX_DESCRIPTION_LENGTH = 2000
  private readonly SPAM_KEYWORDS = [
    'click here', 'free download', 'make money fast', 'limited time offer',
    'act now', 'buy now', 'special promotion', 'exclusive deal'
  ]

  async validate(article: RawArticle): Promise<boolean> {
    try {
      // Required field validation
      if (!this.validateRequiredFields(article)) {
        return false
      }

      // Content quality validation
      if (!this.validateContentQuality(article)) {
        return false
      }

      // Date validation
      if (!this.validateDate(article.publishedAt)) {
        return false
      }

      // URL validation
      if (!this.validateUrl(article.url)) {
        return false
      }

      // Spam detection
      if (this.detectSpam(article)) {
        return false
      }

      return true
    } catch (error) {
      logger.warn('Content validation error:', error)
      return false
    }
  }

  async normalize(article: RawArticle): Promise<RawArticle> {
    return {
      ...article,
      title: this.normalizeText(article.title),
      description: article.description ? this.normalizeText(article.description) : undefined,
      author: article.author ? this.normalizeText(article.author) : undefined,
      url: this.normalizeUrl(article.url),
      imageUrl: article.imageUrl ? this.normalizeUrl(article.imageUrl) : undefined,
    }
  }

  private validateRequiredFields(article: RawArticle): boolean {
    if (!article.title || !article.url || !article.publishedAt || !article.source) {
      logger.debug('Missing required fields')
      return false
    }
    return true
  }

  private validateContentQuality(article: RawArticle): boolean {
    // Title validation
    if (article.title.length < this.MIN_TITLE_LENGTH || 
        article.title.length > this.MAX_TITLE_LENGTH) {
      logger.debug(`Invalid title length: ${article.title.length}`)
      return false
    }

    // Description validation (if present)
    if (article.description && 
        (article.description.length < this.MIN_DESCRIPTION_LENGTH || 
         article.description.length > this.MAX_DESCRIPTION_LENGTH)) {
      logger.debug(`Invalid description length: ${article.description.length}`)
      return false
    }

    // Check for obviously broken content
    if (this.isGibberish(article.title)) {
      logger.debug('Title appears to be gibberish')
      return false
    }

    return true
  }

  private validateDate(date: Date): boolean {
    if (!(date instanceof Date) || isNaN(date.getTime())) {
      return false
    }

    const now = new Date()
    const twoYearsAgo = new Date(now.getFullYear() - 2, now.getMonth(), now.getDate())
    const oneWeekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)

    return date >= twoYearsAgo && date <= oneWeekFromNow
  }

  private validateUrl(url: string): boolean {
    try {
      const urlObj = new URL(url)
      return urlObj.protocol === 'http:' || urlObj.protocol === 'https:'
    } catch {
      return false
    }
  }

  private detectSpam(article: RawArticle): boolean {
    const textToCheck = `${article.title} ${article.description || ''}`.toLowerCase()
    
    for (const keyword of this.SPAM_KEYWORDS) {
      if (textToCheck.includes(keyword.toLowerCase())) {
        logger.debug(`Spam keyword detected: ${keyword}`)
        return true
      }
    }

    // Check for excessive capitalization
    const capsRatio = (article.title.match(/[A-Z]/g) || []).length / article.title.length
    if (capsRatio > 0.5 && article.title.length > 20) {
      logger.debug('Excessive capitalization detected')
      return true
    }

    // Check for suspicious punctuation patterns
    if (article.title.includes('!!!') || article.title.includes('???')) {
      logger.debug('Suspicious punctuation pattern detected')
      return true
    }

    return false
  }

  private isGibberish(text: string): boolean {
    // Check for reasonable vowel ratio
    const vowels = (text.match(/[aeiouAEIOU]/g) || []).length
    const consonants = (text.match(/[bcdfghjklmnpqrstvwxyzBCDFGHJKLMNPQRSTVWXYZ]/g) || []).length
    
    if (consonants === 0) return true
    
    const vowelRatio = vowels / (vowels + consonants)
    if (vowelRatio < 0.1 || vowelRatio > 0.8) {
      return true
    }

    // Check for repeated characters
    if (/(.)\1{4,}/.test(text)) {
      return true
    }

    // Check for too many numbers
    const numberRatio = (text.match(/\d/g) || []).length / text.length
    if (numberRatio > 0.5) {
      return true
    }

    return false
  }

  private normalizeText(text: string): string {
    return text
      .trim()
      .replace(/\s+/g, ' ') // Normalize whitespace
      .replace(/[\u0000-\u001F\u007F-\u009F]/g, '') // Remove control characters
  }

  private normalizeUrl(url: string): string {
    try {
      const urlObj = new URL(url.trim())
      return urlObj.toString()
    } catch {
      return url.trim()
    }
  }
}