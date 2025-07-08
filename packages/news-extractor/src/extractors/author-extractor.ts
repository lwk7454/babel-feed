/**
 * AuthorExtractor - Extract article authors
 * Ported from Python newspaper4k authors_extractor.py
 */

import * as cheerio from 'cheerio'
import { Configuration } from '../configuration.js'
import { AUTHOR_ATTRS, AUTHOR_VALS, AUTHOR_STOP_WORDS } from './defines.js'

export class AuthorExtractor {
  private config: Configuration

  constructor(config: Configuration) {
    this.config = config
  }

  /**
   * Parse authors from document
   */
  public parse($: cheerio.CheerioAPI): string[] {
    const authors: Set<string> = new Set()

    // Try meta tags for authors
    AUTHOR_VALS.forEach(authorVal => {
      AUTHOR_ATTRS.forEach(attr => {
        const selector = `meta[${attr}="${authorVal}"]`
        const content = $(selector).attr('content')
        if (content) {
          this.extractAuthorsFromText(content).forEach(author => authors.add(author))
        }
      })
    })

    // Try class and id selectors
    const authorSelectors = [
      '.author', '.byline', '.writer', '.article-author',
      '#author', '#byline', '#writer',
      '[rel="author"]', '[itemprop="author"]'
    ]

    authorSelectors.forEach(selector => {
      $(selector).each((_, el) => {
        const text = $(el).text().trim()
        if (text) {
          this.extractAuthorsFromText(text).forEach(author => authors.add(author))
        }
      })
    })

    const result = Array.from(authors)
      .filter(author => !this.isStopWord(author))
      .slice(0, this.config.maxAuthors)

    return result
  }

  /**
   * Extract individual authors from text
   */
  private extractAuthorsFromText(text: string): string[] {
    if (!text) return []

    // Remove common prefixes
    let cleaned = text.replace(/^By\s+/i, '')
    cleaned = cleaned.replace(/^Author:\s*/i, '')
    cleaned = cleaned.replace(/^Written by\s+/i, '')

    // Split by common separators
    const authors = cleaned
      .split(/[,;&|]|\sand\s/)
      .map(author => author.trim())
      .filter(author => author.length > 0 && author.length < 100)

    return authors
  }

  /**
   * Check if text is a stop word
   */
  private isStopWord(text: string): boolean {
    return AUTHOR_STOP_WORDS.some(stopWord => 
      text.toLowerCase().includes(stopWord.toLowerCase())
    )
  }
}