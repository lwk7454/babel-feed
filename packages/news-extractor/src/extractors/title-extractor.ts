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
   * Follows Python newspaper4k logic exactly
   */
  public parse($: cheerio.CheerioAPI): string {
    // Get title tag
    const titleText = $('title').text().trim()
    if (!titleText) {
      return ''
    }

    // Get h1 tag (longest one)
    const h1Elements = $('h1').toArray()
    let titleTextH1 = ''
    if (h1Elements.length > 0) {
      const h1Texts = h1Elements.map(el => $(el).text().trim())
      h1Texts.sort((a, b) => b.length - a.length)
      titleTextH1 = h1Texts[0] || ''
      
      // Discard too short texts (fewer than 2 words)
      if (titleTextH1.split(' ').length <= 2) {
        titleTextH1 = ''
      }
      
      // Clean double spaces
      titleTextH1 = titleTextH1.split(' ').filter(x => x).join(' ')
    }

    // Get og:title and other meta titles
    const titleTextFb = this.getFbTitle($)

    // Create filtered versions for comparison
    const filterTitleText = this.filterText(titleText)
    const filterTitleTextH1 = this.filterText(titleTextH1)
    const filterTitleTextFb = this.filterText(titleTextFb)

    let finalTitle = titleText
    let usedDelimiter = false

    // Apply Python's title selection rules
    if (titleTextH1 === titleText) {
      usedDelimiter = true
    } else if (filterTitleTextH1 && filterTitleTextH1 === filterTitleTextFb) {
      finalTitle = titleTextH1
      usedDelimiter = true
    } else if (
      filterTitleTextH1 &&
      filterTitleText.includes(filterTitleTextH1) &&
      filterTitleTextFb &&
      filterTitleText.includes(filterTitleTextFb) &&
      titleTextH1.length > titleTextFb.length
    ) {
      finalTitle = titleTextH1
      usedDelimiter = true
    } else if (
      filterTitleTextFb &&
      filterTitleTextFb !== filterTitleText &&
      filterTitleText.startsWith(filterTitleTextFb)
    ) {
      finalTitle = titleTextFb
      usedDelimiter = true
    }

    // If no special rules applied, split by delimiters
    if (!usedDelimiter) {
      const delimiters = ['|', '-', '_', '/', ' » ']
      for (const delimiter of delimiters) {
        if (finalTitle.includes(delimiter)) {
          finalTitle = this.splitTitle(finalTitle, delimiter, titleTextH1)
          usedDelimiter = true
          break
        }
      }
    }

    // Final cleanup
    finalTitle = finalTitle.trim()

    // If final title is similar to h1, prefer h1
    const filterFinalTitle = this.filterText(finalTitle)
    if (filterTitleTextH1 === filterFinalTitle) {
      finalTitle = titleTextH1
    }

    // Truncate if too long
    if (finalTitle.length > this.config.maxTitle) {
      finalTitle = finalTitle.substring(0, this.config.maxTitle).trim()
    }

    return finalTitle
  }

  /**
   * Get Facebook/OpenGraph title from meta tags
   */
  private getFbTitle($: cheerio.CheerioAPI): string {
    for (const metaName of TITLE_META_INFO) {
      // Try name attribute
      const metaTitle = $(`meta[name="${metaName}"]`).attr('content')
      if (metaTitle?.trim()) {
        return metaTitle.trim()
      }
      
      // Try property attribute
      const propTitle = $(`meta[property="${metaName}"]`).attr('content')
      if (propTitle?.trim()) {
        return propTitle.trim()
      }
    }
    return ''
  }

  /**
   * Filter text for comparison (remove non-alphanumeric chars and lowercase)
   */
  private filterText(text: string): string {
    if (!text) return ''
    return text.replace(/[^a-zA-Z0-9]/g, '').toLowerCase()
  }

  /**
   * Split title by delimiter and return best part
   */
  private splitTitle(title: string, delimiter: string, hint?: string): string {
    const titlePieces = title.split(delimiter)
    let largeTextLength = 0
    let largeTextIndex = 0

    const filteredHint = hint ? this.filterText(hint) : ''

    // Find the best title piece
    for (let i = 0; i < titlePieces.length; i++) {
      const current = titlePieces[i].trim()
      
      // If hint matches, use it
      if (filteredHint && filteredHint === this.filterText(current)) {
        largeTextIndex = i
        break
      }
      
      // Otherwise use the longest piece
      if (current.length > largeTextLength) {
        largeTextLength = current.length
        largeTextIndex = i
      }
    }

    return titlePieces[largeTextIndex].trim()
  }
}