/**
 * Character Encoding Detection
 * Ported from Python newspaper4k encoding detection logic
 * 
 * Uses iconv-lite for encoding detection and conversion
 */

import * as iconv from 'iconv-lite'

/**
 * Common character encodings in order of likelihood
 * Based on Python newspaper4k encoding detection priorities
 */
const COMMON_ENCODINGS = [
  'utf-8',
  'utf-16',
  'utf-16le',
  'utf-16be',
  'iso-8859-1',
  'iso-8859-2',
  'iso-8859-15',
  'windows-1252',
  'windows-1251',
  'gb2312',
  'gbk',
  'gb18030',
  'big5',
  'shift_jis',
  'euc-jp',
  'iso-2022-jp',
  'euc-kr',
  'iso-2022-kr',
  'koi8-r',
  'koi8-u'
]

/**
 * Language-specific encoding preferences
 * Maps language codes to their common encodings
 */
const LANGUAGE_ENCODINGS: Record<string, string[]> = {
  'zh': ['utf-8', 'gb2312', 'gbk', 'gb18030', 'big5'],
  'ja': ['utf-8', 'shift_jis', 'euc-jp', 'iso-2022-jp'],
  'ko': ['utf-8', 'euc-kr', 'iso-2022-kr'],
  'ru': ['utf-8', 'windows-1251', 'koi8-r', 'iso-8859-5'],
  'ar': ['utf-8', 'windows-1256', 'iso-8859-6'],
  'th': ['utf-8', 'windows-874', 'iso-8859-11'],
  'he': ['utf-8', 'windows-1255', 'iso-8859-8'],
  'tr': ['utf-8', 'windows-1254', 'iso-8859-9'],
  'pl': ['utf-8', 'windows-1250', 'iso-8859-2'],
  'cs': ['utf-8', 'windows-1250', 'iso-8859-2'],
  'hu': ['utf-8', 'windows-1250', 'iso-8859-2'],
  'hr': ['utf-8', 'windows-1250', 'iso-8859-2'],
  'sk': ['utf-8', 'windows-1250', 'iso-8859-2'],
  'sl': ['utf-8', 'windows-1250', 'iso-8859-2'],
  'bg': ['utf-8', 'windows-1251', 'iso-8859-5'],
  'mk': ['utf-8', 'windows-1251', 'iso-8859-5'],
  'sr': ['utf-8', 'windows-1251', 'iso-8859-5'],
  'uk': ['utf-8', 'windows-1251', 'koi8-u'],
  'be': ['utf-8', 'windows-1251', 'iso-8859-5']
}

/**
 * Encoding detection result
 */
export interface EncodingDetectionResult {
  encoding: string
  confidence: number
  converted: string
}

/**
 * Character encoding detector
 */
export class EncodingDetector {
  /**
   * Detect character encoding from buffer
   * Uses multiple strategies for robust detection
   */
  static detect(buffer: Buffer, language?: string): EncodingDetectionResult {
    // Check for BOM markers first
    const bomResult = this.detectBOM(buffer)
    if (bomResult) {
      return bomResult
    }

    // Get encoding candidates based on language
    const candidates = this.getEncodingCandidates(language)
    
    // Try each encoding and score the result
    let bestResult: EncodingDetectionResult = {
      encoding: 'utf-8',
      confidence: 0,
      converted: buffer.toString('utf8')
    }

    for (const encoding of candidates) {
      try {
        if (iconv.encodingExists(encoding)) {
          const decoded = iconv.decode(buffer, encoding)
          const confidence = this.calculateConfidence(decoded, language)
          
          if (confidence > bestResult.confidence) {
            bestResult = {
              encoding,
              confidence,
              converted: decoded
            }
          }
        }
      } catch (error) {
        // Skip invalid encodings
        continue
      }
    }

    return bestResult
  }

  /**
   * Detect encoding from Byte Order Mark (BOM)
   */
  private static detectBOM(buffer: Buffer): EncodingDetectionResult | null {
    // UTF-8 BOM
    if (buffer.length >= 3 && 
        buffer[0] === 0xEF && buffer[1] === 0xBB && buffer[2] === 0xBF) {
      return {
        encoding: 'utf-8',
        confidence: 1.0,
        converted: buffer.slice(3).toString('utf8')
      }
    }

    // UTF-16 BE BOM
    if (buffer.length >= 2 && 
        buffer[0] === 0xFE && buffer[1] === 0xFF) {
      return {
        encoding: 'utf-16be',
        confidence: 1.0,
        converted: iconv.decode(buffer.slice(2), 'utf16be')
      }
    }

    // UTF-16 LE BOM
    if (buffer.length >= 2 && 
        buffer[0] === 0xFF && buffer[1] === 0xFE) {
      return {
        encoding: 'utf-16le',
        confidence: 1.0,
        converted: iconv.decode(buffer.slice(2), 'utf16le')
      }
    }

    return null
  }

  /**
   * Get encoding candidates based on language
   */
  private static getEncodingCandidates(language?: string): string[] {
    if (language && LANGUAGE_ENCODINGS[language.toLowerCase()]) {
      // Merge language-specific encodings with common ones
      const langEncodings = LANGUAGE_ENCODINGS[language.toLowerCase()]
      const combined = [...langEncodings, ...COMMON_ENCODINGS]
      // Remove duplicates while preserving order
      return [...new Set(combined)]
    }

    return COMMON_ENCODINGS
  }

  /**
   * Calculate confidence score for decoded text
   * Higher score for text that appears more natural
   */
  private static calculateConfidence(text: string, language?: string): number {
    if (!text || text.length === 0) {
      return 0
    }

    let score = 0
    const length = text.length

    // Check for replacement characters (indicates encoding issues)
    const replacementChars = (text.match(/\uFFFD/g) || []).length
    if (replacementChars > 0) {
      score -= (replacementChars / length) * 0.8
    }

    // Check for control characters (bad sign)
    const controlChars = (text.match(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g) || []).length
    if (controlChars > 0) {
      score -= (controlChars / length) * 0.5
    }

    // Check for valid Unicode ranges
    score += this.scoreUnicodeRanges(text, language)

    // Check for readable ASCII ratio
    const asciiChars = (text.match(/[\x20-\x7E]/g) || []).length
    const asciiRatio = asciiChars / length
    score += Math.min(asciiRatio * 0.3, 0.3)

    // Check for common word patterns
    score += this.scoreWordPatterns(text, language)

    return Math.max(0, Math.min(1, score))
  }

  /**
   * Score based on Unicode character ranges for specific languages
   */
  private static scoreUnicodeRanges(text: string, language?: string): number {
    if (!language) {
      return 0.1 // Base score for unknown language
    }

    const lang = language.toLowerCase()
    let score = 0

    // Language-specific character scoring
    switch (lang) {
      case 'zh':
        score += (text.match(/[\u4e00-\u9fff]/g) || []).length / text.length * 0.4
        break
      case 'ja':
        score += (text.match(/[\u3040-\u309f\u30a0-\u30ff\u4e00-\u9fff]/g) || []).length / text.length * 0.4
        break
      case 'ko':
        score += (text.match(/[\uac00-\ud7af]/g) || []).length / text.length * 0.4
        break
      case 'ar':
        score += (text.match(/[\u0600-\u06ff]/g) || []).length / text.length * 0.4
        break
      case 'ru':
        score += (text.match(/[\u0400-\u04ff]/g) || []).length / text.length * 0.4
        break
      case 'th':
        score += (text.match(/[\u0e00-\u0e7f]/g) || []).length / text.length * 0.4
        break
      case 'he':
        score += (text.match(/[\u0590-\u05ff]/g) || []).length / text.length * 0.4
        break
      case 'hi':
        score += (text.match(/[\u0900-\u097f]/g) || []).length / text.length * 0.4
        break
      default:
        // For Latin-based languages, score based on extended Latin characters
        score += (text.match(/[\u0080-\u024f]/g) || []).length / text.length * 0.2
    }

    return score
  }

  /**
   * Score based on common word patterns
   */
  private static scoreWordPatterns(text: string, language?: string): number {
    // Basic word pattern scoring
    const words = text.split(/\s+/).filter(word => word.length > 0)
    if (words.length === 0) return 0

    // Score based on reasonable word length distribution
    const avgWordLength = words.reduce((sum, word) => sum + word.length, 0) / words.length
    let score = 0

    // Reasonable average word length (2-15 characters)
    if (avgWordLength >= 2 && avgWordLength <= 15) {
      score += 0.2
    }

    // Check for mixed case (indicates natural text)
    const mixedCaseWords = words.filter(word => 
      word !== word.toLowerCase() && word !== word.toUpperCase()
    ).length
    score += Math.min(mixedCaseWords / words.length * 0.1, 0.1)

    return score
  }

  /**
   * Convert text from detected encoding to UTF-8
   */
  static convertToUtf8(buffer: Buffer, language?: string): string {
    const result = this.detect(buffer, language)
    return result.converted
  }

  /**
   * Check if encoding is supported
   */
  static isEncodingSupported(encoding: string): boolean {
    return iconv.encodingExists(encoding)
  }
}