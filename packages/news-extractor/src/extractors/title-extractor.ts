/**
 * TitleExtractor - Extract article titles from multiple sources
 * Ported from Python newspaper4k title_extractor.py
 */

import * as cheerio from 'cheerio'
import { Configuration } from '../configuration.js'
import { TITLE_META_INFO } from './defines.js'

export class TitleExtractor {
  private config: Configuration

  constructor(config: Configuration) {
    this.config = config
  }

  /**
   * Parse title from document using multiple extraction methods
   */
  public parse($: cheerio.CheerioAPI): string {
    // Try title tag first
    const titleTag = $('title').text().trim()
    if (titleTag) {
      return this.cleanTitle(titleTag)
    }

    // Try meta tags
    for (const metaName of TITLE_META_INFO) {
      const metaTitle = $(`meta[name="${metaName}"]`).attr('content')
      if (metaTitle) {
        return this.cleanTitle(metaTitle)
      }
      
      const propTitle = $(`meta[property="${metaName}"]`).attr('content')
      if (propTitle) {
        return this.cleanTitle(propTitle)
      }
    }

    // Try h1 tag
    const h1Title = $('h1').first().text().trim()
    if (h1Title) {
      return this.cleanTitle(h1Title)
    }

    return ''
  }

  /**
   * Clean and format title text
   */
  private cleanTitle(title: string): string {
    if (!title) return ''

    // Remove excess whitespace
    let cleaned = title.replace(/\s+/g, ' ').trim()

    // Remove common separators and site names
    cleaned = cleaned.split(' | ')[0]
    cleaned = cleaned.split(' - ')[0]
    cleaned = cleaned.split(' :: ')[0]
    cleaned = cleaned.split(' » ')[0]

    // Truncate if too long
    if (cleaned.length > this.config.maxTitle) {
      cleaned = cleaned.substring(0, this.config.maxTitle).trim()
    }

    return cleaned
  }
}