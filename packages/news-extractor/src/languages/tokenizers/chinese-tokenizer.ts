/**
 * Chinese Tokenizer with nodejieba integration
 * Ported from Python newspaper4k languages/zh.py
 * 
 * Uses nodejieba for proper Chinese word segmentation when available,
 * falls back to character-level segmentation
 */

import { AbstractTokenizer } from './base-tokenizer.js'

// Dynamic import for nodejieba to handle optional dependency
let nodejieba: any = null
try {
  nodejieba = require('nodejieba')
} catch (e) {
  // nodejieba not available, will use fallback
}

/**
 * Chinese tokenizer for word segmentation
 * Integrates with nodejieba for proper Chinese word segmentation
 */
export class ChineseTokenizer extends AbstractTokenizer {
  private readonly useJieba: boolean

  constructor() {
    super('zh')
    this.useJieba = nodejieba !== null
  }

  /**
   * Chinese tokenization with nodejieba integration
   * Falls back to character-level segmentation if nodejieba unavailable
   */
  tokenize(text: string): string[] {
    if (!text || text.trim().length === 0) {
      return []
    }

    const cleanedText = this.cleanText(text)
    
    if (this.useJieba) {
      return this.tokenizeWithJieba(cleanedText)
    } else {
      return this.tokenizeBasic(cleanedText)
    }
  }

  /**
   * Tokenize using nodejieba (production implementation)
   */
  private tokenizeWithJieba(text: string): string[] {
    try {
      // Use cut_all=true to match Python newspaper4k behavior
      const tokens = nodejieba.cut(text, true)
      return this.filterTokens(tokens.filter((token: string) => token.trim().length > 0))
    } catch (error) {
      console.warn('Jieba tokenization failed, falling back to basic tokenization:', error)
      return this.tokenizeBasic(text)
    }
  }

  /**
   * Basic character-level tokenization (fallback)
   */
  private tokenizeBasic(text: string): string[] {
    const tokens: string[] = []
    
    for (let i = 0; i < text.length; i++) {
      const char = text[i]
      
      // Check if character is Chinese (simplified/traditional)
      if (this.isChineseCharacter(char)) {
        tokens.push(char)
      } else if (/\s/.test(char)) {
        // Skip whitespace
        continue
      } else if (/[a-zA-Z0-9]/.test(char)) {
        // Collect consecutive Latin characters/numbers
        let latinWord = char
        while (i + 1 < text.length && /[a-zA-Z0-9]/.test(text[i + 1])) {
          i++
          latinWord += text[i]
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