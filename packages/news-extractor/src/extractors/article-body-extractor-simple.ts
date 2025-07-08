/**
 * Simplified ArticleBodyExtractor - Core content extraction 
 * Simplified version for Phase 2 implementation
 */

import * as cheerio from 'cheerio'
import { cheerio.CheerioAPI, Cheerio, AnyNode } from 'cheerio'
import { Configuration } from '../configuration.js'
import { getStopWords } from '../text.js'

export class ArticleBodyExtractor {
  private config: Configuration
  public topNode: Cheerio<AnyNode> | null = null
  public topNodeComplemented: Cheerio<AnyNode> | null = null

  constructor(config: Configuration) {
    this.config = config
  }

  /**
   * Parse HTML and extract article body
   */
  public parse(html: string): void {
    const $ = cheerio.load(html)
    this.topNode = this.calculateBestNode($)
    this.topNodeComplemented = this.topNode // Simplified for now
  }

  /**
   * Parse HTML with existing Cheerio instance
   */
  public parseHtml(html: string): cheerio.CheerioAPI {
    return cheerio.load(html)
  }

  /**
   * Calculate the best node containing article content
   * Simplified version of gravity scoring
   */
  public calculateBestNode($: cheerio.CheerioAPI): Cheerio<AnyNode> | null {
    // Look for common article containers first
    const selectors = [
      'article',
      '[role="article"]',
      '.article-content',
      '.article-body',
      '.post-content',
      '.entry-content',
      '.content',
      'main'
    ]

    for (const selector of selectors) {
      const element = $(selector).first()
      if (element.length > 0 && this.hasGoodContent(element)) {
        return element
      }
    }

    // Fallback: find paragraphs and their common parent
    const paragraphs = $('p')
    if (paragraphs.length === 0) return null

    // Find the element that contains the most paragraphs
    let bestParent: Cheerio<AnyNode> | null = null
    let maxParagraphs = 0

    paragraphs.each((_, p) => {
      let current = $(p).parent()
      while (current.length > 0) {
        const pCount = current.find('p').length
        if (pCount > maxParagraphs) {
          maxParagraphs = pCount
          bestParent = current
        }
        current = current.parent()
      }
    })

    return bestParent
  }

  /**
   * Check if element has good content
   */
  private hasGoodContent(element: Cheerio<AnyNode>): boolean {
    const text = element.text().trim()
    if (text.length < 100) return false

    const wordStats = getStopWords(text, this.config.language)
    return wordStats.wordCount > 50 && wordStats.stopWordCount > 10
  }
}