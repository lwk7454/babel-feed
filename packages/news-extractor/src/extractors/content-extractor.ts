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
   * Extract all content from article HTML
   */
  public extractContent(url: string, html: string): ExtractionResult {
    const $ = this.articleBodyExtractor.parseHtml(html)

    // Parse the document and extract content
    this.articleBodyExtractor.parse($)
    const topNode = this.articleBodyExtractor.topNode
    
    // Extract all components
    const title = this.getTitle($)
    const authors = this.getAuthors($)
    const publishDate = this.getPublishingDate(url, $)
    const metadata = this.getMetadata(url, $)
    const images = this.getImages(url, $, topNode)
    const videos = this.getVideos($, topNode)
    
    // Extract article text from top node
    const text = topNode ? this.extractText(topNode) : ''
    
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
  public getTitle($: cheerio.CheerioAPI): string {
    return this.titleExtractor.parse($)
  }

  /**
   * Get article authors
   */
  public getAuthors($: cheerio.CheerioAPI): string[] {
    return this.authorExtractor.parse($)
  }

  /**
   * Get article publishing date
   */
  public getPublishingDate(url: string, $: cheerio.CheerioAPI): Date | null {
    return this.dateExtractor.parse(url, $)
  }

  /**
   * Get article metadata
   */
  public getMetadata(url: string, $: cheerio.CheerioAPI): ArticleMetadata {
    return this.metadataExtractor.parse(url, $)
  }

  /**
   * Get article images
   */
  public getImages(url: string, $: cheerio.CheerioAPI, topNode: cheerio.Cheerio<cheerio.Element> | null): string[] {
    return this.imageExtractor.parse($, topNode, url)
  }

  /**
   * Get article videos
   */
  public getVideos($: cheerio.CheerioAPI, topNode: cheerio.Cheerio<cheerio.Element> | null): string[] {
    return this.videoExtractor.parse($, topNode)
  }

  /**
   * Get the top node from the article body extractor
   */
  public get topNode(): cheerio.Cheerio<cheerio.Element> | null {
    return this.articleBodyExtractor.topNode
  }

  /**
   * Get the complemented top node (with siblings)
   */
  public get topNodeComplemented(): cheerio.Cheerio<cheerio.Element> | null {
    return this.articleBodyExtractor.topNodeComplemented
  }

  /**
   * Extract clean text from a node
   */
  private extractText(node: cheerio.Cheerio<cheerio.Element>): string {
    if (!node || node.length === 0) return ''
    
    // Remove script and style tags
    node.find('script, style').remove()
    
    // Get text content and clean it
    return node.text()
      .replace(/\s+/g, ' ')
      .replace(/\n+/g, '\n')
      .trim()
  }
}