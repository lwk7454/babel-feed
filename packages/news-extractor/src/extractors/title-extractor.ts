/**
 * TitleExtractor - Extract article titles from multiple sources
 * Ported from Python newspaper4k title_extractor.py
 */

import * as cheerio from 'cheerio'
import { Configuration } from '../configuration.js'
import { TITLE_META_INFO, MOTLEY_REPLACEMENT, TITLE_REPLACEMENTS } from './defines.js'
import { getWords } from '../text.js'

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
      
      // Discard too short texts (fewer than 2 words for space-separated languages, or < 4 chars for others)
      const wordCount = this.getWordCount(titleTextH1)
      if (wordCount <= 2) {
        titleTextH1 = ''
      }
      
      // Clean double spaces (Python logic: " ".join([x for x in title_text_h1.split() if x]))
      titleTextH1 = titleTextH1.split(/\s+/).filter(x => x).join(' ')
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

    // Apply MOTLEY_REPLACEMENT (Python line 114)
    finalTitle = finalTitle.replace(MOTLEY_REPLACEMENT[0], MOTLEY_REPLACEMENT[1])
    
    // Final cleanup
    finalTitle = finalTitle.trim()

    // If final title is similar to h1, prefer h1 (Python lines 119-121)
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
   * Filter text for comparison using language-specific character ranges
   * Based on Python newspaper4k's language_regex function
   */
  private filterText(text: string): string {
    if (!text) return ''
    
    // Get language-specific regex pattern
    const language = this.config.language
    const latinRegex = '\\u00c0-\\u00d6\\u00d8-\\u00f6\\u00f8-\\u00ff\\u0100-\\u024fa-zA-Z0-9\\ '
    
    let languageRegex = ''
    if (language === 'ja') {
      languageRegex = '\\u3040-\\u309f\\u30a0-\\u30ff\\u3190-\\u319f\\u3200-\\u32ff\\u3300-\\u33ff\\u3400-\\u4db5\\u4e00-\\u9fff\\uf900-\\ufaff\\ufe30-\\ufe4f'
    } else if (language === 'zh') {
      languageRegex = '\\u3100-\\u312f\\u31a0-\\u31bf\\u3200-\\u32ff\\u3300-\\u33ff\\u3400-\\u4db5\\u4e00-\\u9fff\\ua000-\\ua48f\\ua490-\\ua4cf\\uf900-\\ufaff\\ufe30-\\ufe4f'
    } else if (language === 'ko') {
      languageRegex = '\\u1100-\\u11ff\\u3130-\\u318f\\u3200-\\u32ff\\u3300-\\u33ff\\u3400-\\u4db5\\u4e00-\\u9fff\\uac00-\\ud7a3\\uf900-\\ufaff\\ufe30-\\ufe4f'
    } else if (language === 'ar') {
      languageRegex = '\\u0600-\\u06ff\\ufb50-\\ufdff\\ufe70-\\ufefe'
    } else if (language === 'ru') {
      languageRegex = '\\u0400-\\u04ff'
    } else if (language === 'hi') {
      languageRegex = '\\u0900-\\u097f'
    } else if (language === 'he') {
      languageRegex = '\\u0590-\\u05ff'
    } else if (language === 'th') {
      languageRegex = '\\u0e00-\\u0e7f'
    }
    
    // Create regex pattern to keep only language-specific characters
    const fullRegex = `[^${languageRegex}${latinRegex}]`
    return text.replace(new RegExp(fullRegex, 'g'), '').toLowerCase()
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

    // Apply TITLE_REPLACEMENTS (Python line 149)
    return titlePieces[largeTextIndex].replace(TITLE_REPLACEMENTS[0], TITLE_REPLACEMENTS[1]).trim()
  }

  /**
   * Get word count for a text, handling different languages appropriately
   */
  private getWordCount(text: string): number {
    if (!text) return 0
    
    // For space-separated languages, use space-based counting
    const spaceWords = text.split(/\s+/).filter(w => w.trim().length > 0)
    
    // For non-space-separated languages like Chinese/Japanese, use character-based approach
    // If text has few spaces but many characters, it's likely CJK
    if (spaceWords.length <= 2 && text.length >= 4) {
      // Use language-aware tokenization
      const words = getWords(text)
      return words.length
    }
    
    return spaceWords.length
  }
}