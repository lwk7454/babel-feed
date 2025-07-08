/**
 * Default Tokenizer for Latin-based Languages
 * Ported from Python newspaper4k default tokenization logic
 */

import { AbstractTokenizer } from './base-tokenizer.js'

/**
 * Default tokenizer for space-separated languages (English, Spanish, French, etc.)
 * Handles most European languages that use spaces to separate words
 */
export class DefaultTokenizer extends AbstractTokenizer {
  constructor(language = 'en') {
    super(language)
  }

  /**
   * Tokenize text using whitespace and punctuation as delimiters
   * Matches Python newspaper4k default tokenization behavior
   */
  tokenize(text: string): string[] {
    if (!text || text.trim().length === 0) {
      return []
    }

    const cleanedText = this.cleanText(text)
    
    // Split on whitespace and punctuation, preserve apostrophes in contractions
    const tokens = cleanedText
      .toLowerCase()
      .replace(/[^\w\s'-]/g, ' ')  // Remove punctuation except apostrophes and hyphens
      .split(/\s+/)
      .filter(token => token.length > 0)
      .map(token => this.cleanToken(token))
      .filter(token => token.length > 0)

    return this.filterTokens(tokens)
  }

  /**
   * Clean individual token
   */
  private cleanToken(token: string): string {
    // Remove leading/trailing punctuation but preserve internal apostrophes
    return token.replace(/^['-]+|['-]+$/g, '')
  }

  /**
   * Check if text appears to be in a language that uses space separation
   */
  static isSpaceSeparatedLanguage(text: string): boolean {
    // Simple heuristic: if text has reasonable amount of spaces, assume space-separated
    const words = text.trim().split(/\s+/)
    const avgWordLength = text.replace(/\s+/g, '').length / words.length
    
    // Most space-separated languages have average word length 3-7 characters
    return words.length > 1 && avgWordLength >= 2 && avgWordLength <= 12
  }
}