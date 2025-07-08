/**
 * ContentExtractor - Main content extraction coordinator
 * Ported from Python newspaper4k content_extractor.py
 */

import * as cheerio from 'cheerio'
import { Configuration } from '../configuration.js'
import { ArticleBodyExtractor } from './article-body-extractor.js'
import { TitleExtractor } from './title-extractor.js'
import { AuthorExtractor } from './author-extractor.js'
import { DateExtractor } from './date-extractor.js'
import { ImageExtractor } from './image-extractor.js'
import { MetadataExtractor } from './metadata-extractor.js'
import { VideoExtractor } from './video-extractor.js'
import { ExtractionResult, ArticleMetadata } from '../types.js'
import { LanguageDetector } from '../languages/language-detector.js'
import { getTextStats } from '../text.js'
import type { Cheerio, CheerioAPI } from 'cheerio'
import type { Element } from 'domhandler'

export class ContentExtractor {
  private config: Configuration
  private articleBodyExtractor: ArticleBodyExtractor
  private titleExtractor: TitleExtractor
  private authorExtractor: AuthorExtractor
  private dateExtractor: DateExtractor
  private imageExtractor: ImageExtractor
  private metadataExtractor: MetadataExtractor
  private videoExtractor: VideoExtractor

  constructor(config: Configuration) {
    this.config = config
    this.articleBodyExtractor = new ArticleBodyExtractor(config)
    this.titleExtractor = new TitleExtractor(config)
    this.authorExtractor = new AuthorExtractor(config)
    this.dateExtractor = new DateExtractor(config)
    this.imageExtractor = new ImageExtractor(config)
    this.metadataExtractor = new MetadataExtractor(config)
    this.videoExtractor = new VideoExtractor(config)
  }

  /**
   * Extract all content from article HTML with language detection
   */
  public extractContent(url: string, html: string): ExtractionResult {
    const $ = this.articleBodyExtractor.parseHtml(html)

    // Detect article language early
    const detectedLanguage = LanguageDetector.detectWithFallback(
      $, 
      this.config.language, 
      this.config.useMetaLanguage
    )

    // Parse the document and extract content with detected language
    this.articleBodyExtractor.parseWithLanguage($, $, detectedLanguage)
    const topNode = this.articleBodyExtractor.topNode
    
    // Extract all components
    const title = this.getTitle($)
    const authors = this.getAuthors($)
    const publishDate = this.getPublishingDate(url, $)
    const metadata = this.getMetadata(url, $)
    const images = this.getImages(url, $, topNode)
    const videos = this.getVideos($, topNode)
    
    // Extract article text from top node with language-aware processing
    const text = topNode ? this.extractText(topNode, detectedLanguage) : ''
    
    // Get top image and meta image
    const topImage = this.imageExtractor.topImageUrl
    const metaImage = this.imageExtractor.metaImageUrl
    
    // Add language information to metadata
    if (metadata && detectedLanguage) {
      metadata.language = detectedLanguage
    }
    
    // Add image information to metadata
    if (topImage) {
      metadata.topImage = topImage
    }
    if (metaImage) {
      metadata.metaImage = metaImage
    }
    
    return {
      title,
      text,
      authors,
      publishDate,
      metadata,
      images,
      videos,
      topNode: topNode?.get(0) || null
    }
  }

  /**
   * Get article title using multiple extraction methods
   */
  public getTitle($: CheerioAPI): string {
    return this.titleExtractor.parse($)
  }

  /**
   * Get article authors
   */
  public getAuthors($: CheerioAPI): string[] {
    return this.authorExtractor.parse($)
  }

  /**
   * Get article publishing date
   */
  public getPublishingDate(url: string, $: CheerioAPI): Date | null {
    return this.dateExtractor.parse(url, $)
  }

  /**
   * Get article metadata
   */
  public getMetadata(url: string, $: CheerioAPI): ArticleMetadata {
    return this.metadataExtractor.parse(url, $)
  }

  /**
   * Get article images
   */
  public getImages(url: string, $: CheerioAPI, topNode: Cheerio<Element> | null): string[] {
    return this.imageExtractor.parse($, topNode, url)
  }

  /**
   * Get article videos
   */
  public getVideos($: CheerioAPI, topNode: Cheerio<Element> | null): string[] {
    return this.videoExtractor.parse($, topNode)
  }

  /**
   * Get the top node from the article body extractor
   */
  public get topNode(): Cheerio<Element> | null {
    return this.articleBodyExtractor.topNode
  }

  /**
   * Get the complemented top node (with siblings)
   */
  public get topNodeComplemented(): Cheerio<Element> | null {
    return this.articleBodyExtractor.topNodeComplemented
  }

  /**
   * Extract clean text from a node with language-aware processing
   */
  private extractText(node: Cheerio<Element>, language?: string): string {
    if (!node || node.length === 0) return ''
    
    // Remove script and style tags
    node.find('script, style').remove()
    
    // Get text content
    let text = node.text()
    
    // Language-specific text cleaning
    if (language) {
      text = this.cleanTextForLanguage(text, language)
    } else {
      // Default cleaning
      text = text
        .replace(/\s+/g, ' ')
        .replace(/\n+/g, '\n')
        .trim()
    }
    
    return text
  }

  /**
   * Clean text based on language-specific rules
   */
  private cleanTextForLanguage(text: string, language: string): string {
    if (language === 'zh') {
      // Chinese text processing - preserve structure but clean spacing
      return text
        .replace(/\s+/g, ' ') // Normalize whitespace to single spaces
        .replace(/\n+/g, '\n') // Normalize line breaks
        .trim()
    } else if (language === 'ja') {
      // Japanese text processing - preserve structure but clean spacing
      return text
        .replace(/\s+/g, ' ') // Normalize whitespace to single spaces
        .replace(/\n+/g, '\n') // Normalize line breaks
        .trim()
    } else {
      // Default processing for space-separated languages
      return text
        .replace(/\s+/g, ' ')
        .replace(/\n+/g, '\n')
        .trim()
    }
  }
}