/**
 * Language Detection from HTML Meta Tags
 * Ported from Python newspaper4k extractors/metadata_extractor.py
 */

import type { CheerioAPI } from 'cheerio'
import { normalizeLanguageCode, isValidLanguage } from './index.js'
import { getMostLikelyLanguage } from './unicode-ranges.js'

interface MetaLanguageTag {
  selector: string
  attribute: string
}

/**
 * Language detection strategies in order of priority
 * Matches Python newspaper4k detection order
 */
const META_LANGUAGE_STRATEGIES: MetaLanguageTag[] = [
  // HTML lang attribute (highest priority)
  { selector: 'html', attribute: 'lang' },
  
  // OpenGraph locale
  { selector: 'meta[property="og:locale"]', attribute: 'content' },
  
  // HTTP-equiv content language
  { selector: 'meta[http-equiv="content-language"]', attribute: 'content' },
  
  // Meta name lang
  { selector: 'meta[name="lang"]', attribute: 'content' },
  
  // Alternative meta language attributes
  { selector: 'meta[name="language"]', attribute: 'content' },
  { selector: 'meta[property="language"]', attribute: 'content' }
]

export class LanguageDetector {
  /**
   * Detect language from HTML document using meta tags
   * Exact port of Python newspaper4k language detection logic
   */
  static detectFromHtml($: CheerioAPI): string | null {
    for (const strategy of META_LANGUAGE_STRATEGIES) {
      const element = $(strategy.selector).first()
      if (element.length > 0) {
        const langValue = element.attr(strategy.attribute)
        if (langValue) {
          const normalizedLang = this.extractLanguageCode(langValue)
          if (normalizedLang && isValidLanguage(normalizedLang)) {
            return normalizedLang
          }
        }
      }
    }
    
    return null
  }

  /**
   * Extract and validate language code from meta content
   * Matches Python regex validation: ^[A-Za-z]{2}$
   */
  private static extractLanguageCode(value: string): string | null {
    if (!value) return null
    
    // Clean the value and extract language part
    const cleaned = value.trim().toLowerCase()
    
    // Handle locale formats like "en-US", "en_US" 
    const langMatch = cleaned.match(/^([a-z]{2})[-_]?/)
    if (langMatch) {
      return langMatch[1]
    }
    
    // Check if it's a simple 2-character language code
    if (/^[a-z]{2}$/.test(cleaned)) {
      return cleaned
    }
    
    return null
  }

  /**
   * Detect language with configuration fallback
   * Integrates with Configuration class language settings
   */
  static detectWithFallback($: CheerioAPI, configuredLanguage: string, useMetaLanguage: boolean): string {
    if (useMetaLanguage) {
      const detectedLanguage = this.detectFromHtml($)
      if (detectedLanguage) {
        return detectedLanguage
      }
    }
    
    // Try unicode detection as fallback before using configured language
    const contentText = this.extractContentForLanguageDetection($)
    if (contentText) {
      const unicodeDetected = getMostLikelyLanguage(contentText, 0.05) // Lower threshold for fallback
      if (unicodeDetected) {
        return unicodeDetected
      }
    }
    
    return configuredLanguage || 'en'
  }
  
  /**
   * Extract content text for language detection
   * Prioritizes article content over navigation/ads
   */
  private static extractContentForLanguageDetection($: CheerioAPI): string {
    // Try to find main content areas first
    const contentSelectors = [
      'article',
      '[id*="content"]',
      '[class*="content"]',
      '[class*="article"]',
      '[id*="article"]',
      'main',
      '[role="main"]'
    ]
    
    for (const selector of contentSelectors) {
      const elements = $(selector)
      if (elements.length > 0) {
        const text = elements.first().text().trim()
        if (text.length > 100) { // Minimum content length
          return text
        }
      }
    }
    
    // Fallback to body text if no content areas found
    const bodyText = $('body').text().trim()
    return bodyText.length > 100 ? bodyText : ''
  }
}