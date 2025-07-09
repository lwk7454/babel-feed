/**
 * Language Confidence Scoring System
 * Multi-strategy language detection with weighted confidence scores
 * Ported from Python newspaper4k language detection logic
 */

import type { CheerioAPI } from 'cheerio'
import { LanguageDetector } from './language-detector.js'
import { detectLanguageByCharacters } from './unicode-ranges.js'
import { EncodingDetector } from './encoding-detector.js'

/**
 * Language detection result with confidence breakdown
 */
export interface LanguageDetectionResult {
  language: string
  confidence: number
  sources: {
    meta: number
    unicode: number
    encoding: number
    statistical: number
  }
}

/**
 * Detection strategy weights
 * Based on Python newspaper4k priority system
 */
const STRATEGY_WEIGHTS = {
  META: 0.4,      // HTML meta tags (highest priority)
  UNICODE: 0.3,   // Unicode character analysis
  ENCODING: 0.2,  // Character encoding hints
  STATISTICAL: 0.1 // Statistical content analysis
}

/**
 * Multi-strategy language confidence scoring
 */
export class LanguageConfidenceScorer {
  
  /**
   * Detect language with comprehensive confidence scoring
   */
  static detectWithConfidence(
    $: CheerioAPI,
    content: string,
    buffer?: Buffer,
    fallbackLanguage = 'en'
  ): LanguageDetectionResult {
    
    const scores: Record<string, { meta: number; unicode: number; encoding: number; statistical: number }> = {}
    
    // Strategy 1: Meta tag detection (highest priority)
    const metaLanguage = LanguageDetector.detectFromHtml($)
    if (metaLanguage) {
      this.addScore(scores, metaLanguage, 'meta', 1.0)
    }
    
    // Strategy 2: Unicode character analysis
    const unicodeScores = detectLanguageByCharacters(content)
    for (const [lang, confidence] of Object.entries(unicodeScores)) {
      this.addScore(scores, lang, 'unicode', confidence)
    }
    
    // Strategy 3: Encoding detection (if buffer provided)
    if (buffer) {
      const encodingScores = this.detectFromEncoding(buffer)
      for (const [lang, confidence] of Object.entries(encodingScores)) {
        this.addScore(scores, lang, 'encoding', confidence)
      }
    }
    
    // Strategy 4: Statistical content analysis
    const statisticalScores = this.detectFromStatistics(content)
    for (const [lang, confidence] of Object.entries(statisticalScores)) {
      this.addScore(scores, lang, 'statistical', confidence)
    }
    
    // Calculate final weighted scores
    const finalScores: Record<string, number> = {}
    const detectionResults: Record<string, LanguageDetectionResult> = {}
    
    for (const [lang, sources] of Object.entries(scores)) {
      const weightedScore = 
        (sources.meta * STRATEGY_WEIGHTS.META) +
        (sources.unicode * STRATEGY_WEIGHTS.UNICODE) +
        (sources.encoding * STRATEGY_WEIGHTS.ENCODING) +
        (sources.statistical * STRATEGY_WEIGHTS.STATISTICAL)
      
      finalScores[lang] = weightedScore
      detectionResults[lang] = {
        language: lang,
        confidence: weightedScore,
        sources
      }
    }
    
    // Find best match
    let bestLang = fallbackLanguage
    let bestScore = 0
    
    for (const [lang, score] of Object.entries(finalScores)) {
      if (score > bestScore) {
        bestScore = score
        bestLang = lang
      }
    }
    
    return detectionResults[bestLang] || {
      language: fallbackLanguage,
      confidence: 0,
      sources: { meta: 0, unicode: 0, encoding: 0, statistical: 0 }
    }
  }
  
  /**
   * Add score to language detection results
   */
  private static addScore(
    scores: Record<string, { meta: number; unicode: number; encoding: number; statistical: number }>,
    language: string,
    source: 'meta' | 'unicode' | 'encoding' | 'statistical',
    confidence: number
  ): void {
    if (!scores[language]) {
      scores[language] = { meta: 0, unicode: 0, encoding: 0, statistical: 0 }
    }
    scores[language][source] = Math.max(scores[language][source], confidence)
  }
  
  /**
   * Detect language from character encoding patterns
   */
  private static detectFromEncoding(buffer: Buffer): Record<string, number> {
    const results: Record<string, number> = {}
    
    // Try common language-specific encodings
    const encodingTests = [
      { encoding: 'gb2312', language: 'zh', confidence: 0.8 },
      { encoding: 'gbk', language: 'zh', confidence: 0.7 },
      { encoding: 'gb18030', language: 'zh', confidence: 0.9 },
      { encoding: 'big5', language: 'zh', confidence: 0.8 },
      { encoding: 'shift_jis', language: 'ja', confidence: 0.9 },
      { encoding: 'euc-jp', language: 'ja', confidence: 0.8 },
      { encoding: 'iso-2022-jp', language: 'ja', confidence: 0.7 },
      { encoding: 'euc-kr', language: 'ko', confidence: 0.8 },
      { encoding: 'windows-1251', language: 'ru', confidence: 0.7 },
      { encoding: 'koi8-r', language: 'ru', confidence: 0.6 },
      { encoding: 'windows-1256', language: 'ar', confidence: 0.7 },
      { encoding: 'windows-1255', language: 'he', confidence: 0.7 },
      { encoding: 'windows-1254', language: 'tr', confidence: 0.6 },
      { encoding: 'windows-874', language: 'th', confidence: 0.8 }
    ]
    
    for (const test of encodingTests) {
      try {
        const detection = EncodingDetector.detect(buffer, test.language)
        if (detection.encoding === test.encoding && detection.confidence > 0.5) {
          results[test.language] = test.confidence * detection.confidence
        }
      } catch (error) {
        // Skip failed encoding attempts
        continue
      }
    }
    
    return results
  }
  
  /**
   * Statistical content analysis for language detection
   */
  private static detectFromStatistics(content: string): Record<string, number> {
    const results: Record<string, number> = {}
    
    if (!content || content.length < 100) {
      return results
    }
    
    // Word length distribution analysis
    const words = content.split(/\s+/).filter(word => word.length > 0)
    if (words.length === 0) return results
    
    const avgWordLength = words.reduce((sum, word) => sum + word.length, 0) / words.length
    
    // Language-specific statistical patterns
    const patterns = [
      {
        language: 'en',
        avgWordLength: [3, 6],
        commonWords: ['the', 'and', 'of', 'to', 'a', 'in', 'for', 'is', 'on', 'that'],
        confidence: 0.3
      },
      {
        language: 'es',
        avgWordLength: [4, 7],
        commonWords: ['el', 'la', 'de', 'que', 'y', 'en', 'un', 'es', 'se', 'no'],
        confidence: 0.3
      },
      {
        language: 'fr',
        avgWordLength: [4, 8],
        commonWords: ['le', 'de', 'et', 'à', 'un', 'il', 'être', 'et', 'en', 'avoir'],
        confidence: 0.3
      },
      {
        language: 'de',
        avgWordLength: [5, 9],
        commonWords: ['der', 'die', 'und', 'in', 'den', 'von', 'zu', 'das', 'mit', 'sich'],
        confidence: 0.3
      },
      {
        language: 'it',
        avgWordLength: [4, 7],
        commonWords: ['il', 'di', 'che', 'e', 'la', 'per', 'una', 'in', 'con', 'non'],
        confidence: 0.3
      },
      {
        language: 'pt',
        avgWordLength: [4, 7],
        commonWords: ['o', 'de', 'a', 'e', 'do', 'da', 'em', 'um', 'para', 'é'],
        confidence: 0.3
      },
      {
        language: 'ru',
        avgWordLength: [4, 8],
        commonWords: ['в', 'и', 'на', 'не', 'с', 'что', 'я', 'по', 'за', 'из'],
        confidence: 0.3
      }
    ]
    
    for (const pattern of patterns) {
      let score = 0
      
      // Word length scoring
      if (avgWordLength >= pattern.avgWordLength[0] && avgWordLength <= pattern.avgWordLength[1]) {
        score += 0.2
      }
      
      // Common word scoring
      const lowerContent = content.toLowerCase()
      const commonWordMatches = pattern.commonWords.filter(word => 
        lowerContent.includes(word)
      ).length
      
      score += (commonWordMatches / pattern.commonWords.length) * 0.3
      
      if (score > 0.1) {
        results[pattern.language] = Math.min(score, pattern.confidence)
      }
    }
    
    return results
  }
  
  /**
   * Get detection confidence threshold for reliable results
   */
  static getConfidenceThreshold(strategy: 'strict' | 'moderate' | 'loose' = 'moderate'): number {
    switch (strategy) {
      case 'strict':
        return 0.8
      case 'moderate':
        return 0.5
      case 'loose':
        return 0.2
      default:
        return 0.5
    }
  }
  
  /**
   * Get all language candidates above threshold
   */
  static getLanguageCandidates(
    $: CheerioAPI,
    content: string,
    buffer?: Buffer,
    threshold = 0.3
  ): LanguageDetectionResult[] {
    const detection = this.detectWithConfidence($, content, buffer)
    
    // For now, return only the best match
    // In the future, this could return multiple candidates
    return detection.confidence >= threshold ? [detection] : []
  }
}