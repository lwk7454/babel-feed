/**
 * Tokenizer Factory
 * Creates appropriate tokenizer based on language code
 * Ported from Python newspaper4k language tokenizer selection
 */

import type { BaseTokenizer } from './base-tokenizer.js'
import { DefaultTokenizer } from './default-tokenizer.js'
import { ChineseTokenizer } from './chinese-tokenizer.js'
import { JapaneseTokenizer } from './japanese-tokenizer.js'

/**
 * Language-specific tokenizer mapping
 * Matches Python newspaper4k supported languages
 */
const TOKENIZER_MAP: Record<string, () => BaseTokenizer> = {
  // Chinese (Simplified and Traditional)
  'zh': () => new ChineseTokenizer(),
  'zh-cn': () => new ChineseTokenizer(),
  'zh-tw': () => new ChineseTokenizer(),
  
  // Japanese
  'ja': () => new JapaneseTokenizer(),
  
  // Default tokenizer for space-separated languages
  'en': () => new DefaultTokenizer('en'),
  'es': () => new DefaultTokenizer('es'),
  'fr': () => new DefaultTokenizer('fr'),
  'de': () => new DefaultTokenizer('de'),
  'it': () => new DefaultTokenizer('it'),
  'pt': () => new DefaultTokenizer('pt'),
  'ru': () => new DefaultTokenizer('ru'),
  'ar': () => new DefaultTokenizer('ar'),
  'ko': () => new DefaultTokenizer('ko'),
  'th': () => new DefaultTokenizer('th'),
  'hi': () => new DefaultTokenizer('hi'),
  'bn': () => new DefaultTokenizer('bn'),
  'ta': () => new DefaultTokenizer('ta'),
  'te': () => new DefaultTokenizer('te'),
  'he': () => new DefaultTokenizer('he'),
  'tr': () => new DefaultTokenizer('tr'),
  'pl': () => new DefaultTokenizer('pl'),
  'nl': () => new DefaultTokenizer('nl'),
  'sv': () => new DefaultTokenizer('sv'),
  'da': () => new DefaultTokenizer('da'),
  'no': () => new DefaultTokenizer('no'),
  'fi': () => new DefaultTokenizer('fi'),
  'cs': () => new DefaultTokenizer('cs'),
  'hu': () => new DefaultTokenizer('hu'),
  'ro': () => new DefaultTokenizer('ro'),
  'bg': () => new DefaultTokenizer('bg'),
  'hr': () => new DefaultTokenizer('hr'),
  'sk': () => new DefaultTokenizer('sk'),
  'sl': () => new DefaultTokenizer('sl'),
  'et': () => new DefaultTokenizer('et'),
  'lv': () => new DefaultTokenizer('lv'),
  'lt': () => new DefaultTokenizer('lt'),
  'uk': () => new DefaultTokenizer('uk'),
  'be': () => new DefaultTokenizer('be'),
  'mk': () => new DefaultTokenizer('mk'),
  'sq': () => new DefaultTokenizer('sq'),
  'sr': () => new DefaultTokenizer('sr'),
  'bs': () => new DefaultTokenizer('bs'),
  'mt': () => new DefaultTokenizer('mt'),
  'cy': () => new DefaultTokenizer('cy'),
  'ga': () => new DefaultTokenizer('ga'),
  'is': () => new DefaultTokenizer('is'),
  'eu': () => new DefaultTokenizer('eu'),
  'ca': () => new DefaultTokenizer('ca'),
  'gl': () => new DefaultTokenizer('gl'),
  'af': () => new DefaultTokenizer('af'),
  'sw': () => new DefaultTokenizer('sw'),
  'ms': () => new DefaultTokenizer('ms'),
  'id': () => new DefaultTokenizer('id'),
  'vi': () => new DefaultTokenizer('vi'),
  'ur': () => new DefaultTokenizer('ur'),
  'fa': () => new DefaultTokenizer('fa'),
  'ka': () => new DefaultTokenizer('ka'),
  'hy': () => new DefaultTokenizer('hy'),
  'az': () => new DefaultTokenizer('az'),
  'kk': () => new DefaultTokenizer('kk'),
  'ky': () => new DefaultTokenizer('ky'),
  'uz': () => new DefaultTokenizer('uz'),
  'mn': () => new DefaultTokenizer('mn'),
  'ne': () => new DefaultTokenizer('ne')
}

/**
 * Tokenizer factory class
 */
export class TokenizerFactory {
  private static cache: Map<string, BaseTokenizer> = new Map()

  /**
   * Get tokenizer for specified language
   * Caches tokenizer instances for performance
   */
  static getTokenizer(language: string): BaseTokenizer {
    const normalizedLang = language.toLowerCase()
    
    // Check cache first
    if (this.cache.has(normalizedLang)) {
      return this.cache.get(normalizedLang)!
    }

    // Create new tokenizer
    const tokenizerFactory = TOKENIZER_MAP[normalizedLang]
    const tokenizer = tokenizerFactory ? tokenizerFactory() : new DefaultTokenizer(normalizedLang)
    
    // Cache and return
    this.cache.set(normalizedLang, tokenizer)
    return tokenizer
  }

  /**
   * Check if language has specialized tokenizer
   */
  static hasSpecializedTokenizer(language: string): boolean {
    const normalizedLang = language.toLowerCase()
    return normalizedLang in TOKENIZER_MAP && 
           !['en', 'es', 'fr', 'de', 'it', 'pt'].includes(normalizedLang)
  }

  /**
   * Get list of supported languages
   */
  static getSupportedLanguages(): string[] {
    return Object.keys(TOKENIZER_MAP)
  }

  /**
   * Clear tokenizer cache
   */
  static clearCache(): void {
    this.cache.clear()
  }

  /**
   * Create tokenizer for text-based language detection
   * Uses heuristics to determine best tokenizer
   */
  static createAdaptiveTokenizer(text: string): BaseTokenizer {
    if (ChineseTokenizer.isChineseText && ChineseTokenizer.isChineseText(text)) {
      return new ChineseTokenizer()
    }
    
    if (JapaneseTokenizer.isJapaneseText && JapaneseTokenizer.isJapaneseText(text)) {
      return new JapaneseTokenizer()
    }
    
    // Default to space-separated tokenizer
    return new DefaultTokenizer()
  }
}