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
   * Comprehensive language detection with confidence scoring
   * Uses multiple strategies for robust detection
   */
  static detectWithConfidence($: CheerioAPI, content?: string, buffer?: Buffer, fallback = 'en'): {
    language: string
    confidence: number
    method: 'meta' | 'unicode' | 'encoding' | 'statistical' | 'fallback'
  } {
    // Strategy 1: Meta tag detection (highest priority)
    const metaLanguage = this.detectFromHtml($)
    if (metaLanguage) {
      return {
        language: metaLanguage,
        confidence: 0.9,
        method: 'meta'
      }
    }

    // Strategy 2: Unicode character analysis
    if (content) {
      const unicodeDetected = getMostLikelyLanguage(content, 0.1)
      if (unicodeDetected) {
        return {
          language: unicodeDetected,
          confidence: 0.7,
          method: 'unicode'
        }
      }
    }

    // Strategy 3: Encoding-based detection
    if (buffer) {
      const encodingResult = this.detectFromEncoding(buffer)
      if (encodingResult) {
        return {
          language: encodingResult.language,
          confidence: encodingResult.confidence,
          method: 'encoding'
        }
      }
    }

    // Strategy 4: Statistical analysis
    if (content) {
      const statisticalResult = this.detectFromStatistics(content)
      if (statisticalResult) {
        return {
          language: statisticalResult.language,
          confidence: statisticalResult.confidence,
          method: 'statistical'
        }
      }
    }

    // Fallback
    return {
      language: fallback,
      confidence: 0.1,
      method: 'fallback'
    }
  }

  /**
   * Detect language from character encoding patterns
   */
  private static detectFromEncoding(buffer: Buffer): { language: string; confidence: number } | null {
    // Import here to avoid circular dependency
    try {
      const { EncodingDetector } = require('./encoding-detector.js')
      const result = EncodingDetector.detect(buffer)
      
      // Map encodings to languages
      const encodingLanguageMap: Record<string, string> = {
        'gb2312': 'zh',
        'gbk': 'zh',
        'gb18030': 'zh',
        'big5': 'zh',
        'shift_jis': 'ja',
        'euc-jp': 'ja',
        'iso-2022-jp': 'ja',
        'euc-kr': 'ko',
        'windows-1251': 'ru',
        'koi8-r': 'ru',
        'windows-1256': 'ar',
        'windows-1255': 'he',
        'windows-1254': 'tr',
        'windows-874': 'th'
      }
      
      const language = encodingLanguageMap[result.encoding]
      if (language && result.confidence > 0.5) {
        return {
          language,
          confidence: result.confidence * 0.6 // Encoding is less reliable than meta/unicode
        }
      }
    } catch (error) {
      // Encoding detection failed
    }
    
    return null
  }

  /**
   * Statistical content analysis for language detection
   */
  private static detectFromStatistics(content: string): { language: string; confidence: number } | null {
    if (!content || content.length < 100) {
      return null
    }

    // Simple word pattern analysis
    const words = content.split(/\s+/).filter(word => word.length > 0)
    if (words.length === 0) return null

    const avgWordLength = words.reduce((sum, word) => sum + word.length, 0) / words.length

    // Very basic statistical indicators
    const lowerContent = content.toLowerCase()
    
    // English indicators
    if (avgWordLength >= 3 && avgWordLength <= 6) {
      const englishWords = ['the', 'and', 'of', 'to', 'a', 'in', 'for', 'is', 'on', 'that']
      const matches = englishWords.filter(word => lowerContent.includes(word)).length
      if (matches >= 3) {
        return { language: 'en', confidence: 0.4 }
      }
    }

    // Spanish indicators
    if (avgWordLength >= 4 && avgWordLength <= 7) {
      const spanishWords = ['el', 'la', 'de', 'que', 'y', 'en', 'un', 'es', 'se', 'no']
      const matches = spanishWords.filter(word => lowerContent.includes(word)).length
      if (matches >= 3) {
        return { language: 'es', confidence: 0.4 }
      }
    }

    return null
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