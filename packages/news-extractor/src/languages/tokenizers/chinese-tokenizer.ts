/**
 * Chinese Tokenizer
 * Ported from Python newspaper4k languages/zh.py
 * 
 * Note: This is a basic implementation. For production use,
 * integrate with nodejieba or similar Chinese word segmentation library
 */

import { AbstractTokenizer } from './base-tokenizer.js'

/**
 * Chinese tokenizer for word segmentation
 * In production, this should use a proper Chinese segmentation library like nodejieba
 */
export class ChineseTokenizer extends AbstractTokenizer {
  constructor() {
    super('zh')
  }

  /**
   * Basic Chinese tokenization
   * TODO: Integrate with nodejieba for proper Chinese word segmentation
   * Currently provides character-level segmentation as fallback
   */
  tokenize(text: string): string[] {
    if (!text || text.trim().length === 0) {
      return []
    }

    const cleanedText = this.cleanText(text)
    
    // Basic implementation: character-level tokenization for Chinese
    // This is a fallback - proper implementation should use jieba.js
    const tokens: string[] = []
    
    for (let i = 0; i < cleanedText.length; i++) {
      const char = cleanedText[i]
      
      // Check if character is Chinese (simplified/traditional)
      if (this.isChineseCharacter(char)) {
        tokens.push(char)
      } else if (/\s/.test(char)) {
        // Skip whitespace
        continue
      } else if (/[a-zA-Z0-9]/.test(char)) {
        // Collect consecutive Latin characters/numbers
        let latinWord = char
        while (i + 1 < cleanedText.length && /[a-zA-Z0-9]/.test(cleanedText[i + 1])) {
          i++
          latinWord += cleanedText[i]
        }
        if (latinWord.length > 0) {
          tokens.push(latinWord.toLowerCase())
        }
      }
    }

    return this.filterTokens(tokens)
  }

  /**
   * Check if character is Chinese (CJK Unified Ideographs)
   */
  private isChineseCharacter(char: string): boolean {
    const code = char.charCodeAt(0)
    return (
      (code >= 0x4e00 && code <= 0x9fff) ||  // CJK Unified Ideographs
      (code >= 0x3400 && code <= 0x4dbf) ||  // CJK Extension A
      (code >= 0xf900 && code <= 0xfaff) ||  // CJK Compatibility Ideographs
      (code >= 0x3100 && code <= 0x312f) ||  // Bopomofo
      (code >= 0x31a0 && code <= 0x31bf)     // Bopomofo Extended
    )
  }

  /**
   * Detect if text contains significant Chinese content
   */
  static isChineseText(text: string): boolean {
    let chineseChars = 0
    for (const char of text) {
      const code = char.charCodeAt(0)
      if ((code >= 0x4e00 && code <= 0x9fff) || 
          (code >= 0x3400 && code <= 0x4dbf)) {
        chineseChars++
      }
    }
    return chineseChars / text.length > 0.3  // >30% Chinese characters
  }
}

/**
 * Factory function for Chinese tokenizer with jieba integration
 * TODO: Implement when nodejieba is added as dependency
 */
export function createChineseTokenizer(): ChineseTokenizer {
  // Future: Check if nodejieba is available and use it
  // const jieba = require('nodejieba')
  // return new JiebaTokenizer(jieba)
  
  return new ChineseTokenizer()
}