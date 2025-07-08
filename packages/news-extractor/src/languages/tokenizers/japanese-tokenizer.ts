/**
 * Japanese Tokenizer  
 * Ported from Python newspaper4k languages/ja.py
 * 
 * Note: This is a basic implementation. For production use,
 * integrate with TinySegmenter.js or similar Japanese tokenization library
 */

import { AbstractTokenizer } from './base-tokenizer.js'

/**
 * Japanese tokenizer for text segmentation
 * In production, this should use TinySegmenter.js or MeCab
 */
export class JapaneseTokenizer extends AbstractTokenizer {
  constructor() {
    super('ja')
  }

  /**
   * Basic Japanese tokenization
   * TODO: Integrate with TinySegmenter.js for proper Japanese word segmentation
   * Currently provides character-level segmentation as fallback
   */
  tokenize(text: string): string[] {
    if (!text || text.trim().length === 0) {
      return []
    }

    const cleanedText = this.cleanText(text)
    const tokens: string[] = []
    
    for (let i = 0; i < cleanedText.length; i++) {
      const char = cleanedText[i]
      
      if (this.isHiragana(char) || this.isKatakana(char) || this.isKanji(char)) {
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
   * Check if character is Hiragana
   */
  private isHiragana(char: string): boolean {
    const code = char.charCodeAt(0)
    return code >= 0x3040 && code <= 0x309f
  }

  /**
   * Check if character is Katakana
   */
  private isKatakana(char: string): boolean {
    const code = char.charCodeAt(0)
    return (code >= 0x30a0 && code <= 0x30ff) ||  // Katakana
           (code >= 0xff66 && code <= 0xff9f)     // Half-width Katakana
  }

  /**
   * Check if character is Kanji (Chinese characters used in Japanese)
   */
  private isKanji(char: string): boolean {
    const code = char.charCodeAt(0)
    return (
      (code >= 0x4e00 && code <= 0x9fff) ||  // CJK Unified Ideographs
      (code >= 0x3400 && code <= 0x4dbf) ||  // CJK Extension A
      (code >= 0xf900 && code <= 0xfaff)     // CJK Compatibility Ideographs
    )
  }

  /**
   * Detect if text contains significant Japanese content
   */
  static isJapaneseText(text: string): boolean {
    let japaneseChars = 0
    for (const char of text) {
      const code = char.charCodeAt(0)
      if ((code >= 0x3040 && code <= 0x309f) ||  // Hiragana
          (code >= 0x30a0 && code <= 0x30ff) ||  // Katakana
          (code >= 0x4e00 && code <= 0x9fff)) {   // Kanji
        japaneseChars++
      }
    }
    return japaneseChars / text.length > 0.3  // >30% Japanese characters
  }
}

/**
 * Factory function for Japanese tokenizer with TinySegmenter integration
 * TODO: Implement when TinySegmenter.js is added as dependency
 */
export function createJapaneseTokenizer(): JapaneseTokenizer {
  // Future: Check if TinySegmenter is available and use it
  // const TinySegmenter = require('tiny-segmenter')
  // return new TinySegmenterTokenizer(new TinySegmenter())
  
  return new JapaneseTokenizer()
}