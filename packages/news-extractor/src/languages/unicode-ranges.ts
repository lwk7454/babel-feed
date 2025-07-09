/**
 * Unicode Character Ranges for Language Detection
 * Ported from Python newspaper4k languages/__init__.py
 * Enhanced with comprehensive Unicode ranges and statistical analysis
 */

/**
 * Comprehensive Unicode character ranges for major languages
 * Includes all Unicode blocks used by each language
 */
export const UNICODE_RANGES: Record<string, string> = {
  // Chinese (Traditional and Simplified) - comprehensive CJK ranges
  'zh': '\\u3100-\\u312f\\u31a0-\\u31bf\\u3200-\\u32ff\\u3300-\\u33ff\\u3400-\\u4dbf\\u4e00-\\u9fff\\uf900-\\ufaff\\ufe30-\\ufe4f\\u20000-\\u2a6df\\u2a700-\\u2b73f\\u2b740-\\u2b81f\\u2b820-\\u2ceaf\\u2ceb0-\\u2ebef\\u2f800-\\u2fa1f',
  
  // Japanese (Hiragana, Katakana, Kanji) - enhanced with all Japanese blocks
  'ja': '\\u3040-\\u309f\\u30a0-\\u30ff\\uff66-\\uff9f\\u3190-\\u319f\\u31f0-\\u31ff\\u3200-\\u32ff\\u3300-\\u33ff\\u3400-\\u4dbf\\u4e00-\\u9fff\\uf900-\\ufaff\\ufe30-\\ufe4f',
  
  // Korean (Hangul and Hanja)
  'ko': '\\u1100-\\u11ff\\u3130-\\u318f\\u3200-\\u32ff\\u3300-\\u33ff\\u3400-\\u4dbf\\u4e00-\\u9fff\\uac00-\\ud7af\\uf900-\\ufaff\\ufe30-\\ufe4f',
  
  // Arabic - complete Arabic script blocks
  'ar': '\\u0600-\\u06ff\\u0750-\\u077f\\u08a0-\\u08ff\\ufb50-\\ufdff\\ufe70-\\ufefe',
  
  // Thai
  'th': '\\u0e00-\\u0e7f',
  
  // Russian/Cyrillic - all Cyrillic blocks
  'ru': '\\u0400-\\u04ff\\u0500-\\u052f\\u2de0-\\u2dff\\ua640-\\ua69f\\u1c80-\\u1c8f',
  
  // Greek - ancient and modern Greek (refined to avoid false positives)
  'el': '\\u0370-\\u03ff\\u1f00-\\u1fff',
  
  // Hebrew
  'he': '\\u0590-\\u05ff\\ufb1d-\\ufb4f',
  
  // Hindi/Devanagari
  'hi': '\\u0900-\\u097f\\ua8e0-\\ua8ff\\u1cd0-\\u1cff',
  
  // Bengali
  'bn': '\\u0980-\\u09ff',
  
  // Tamil
  'ta': '\\u0b80-\\u0bff',
  
  // Telugu
  'te': '\\u0c00-\\u0c7f',
  
  // Georgian
  'ka': '\\u10a0-\\u10ff\\u2d00-\\u2d2f',
  
  // Armenian
  'hy': '\\u0530-\\u058f\\ufb13-\\ufb17',
  
  // Vietnamese
  'vi': '\\u0102\\u0103\\u0110\\u0111\\u0128\\u0129\\u0168\\u0169\\u01a0\\u01a1\\u01af\\u01b0\\u1ea0-\\u1ef9',
  
  // Urdu (Arabic script)
  'ur': '\\u0600-\\u06ff\\u0750-\\u077f\\ufb50-\\ufdff\\ufe70-\\ufefe',
  
  // Persian/Farsi
  'fa': '\\u0600-\\u06ff\\u0750-\\u077f\\ufb50-\\ufdff\\ufe70-\\ufefe',
  
  // Myanmar/Burmese
  'my': '\\u1000-\\u109f\\uaa60-\\uaa7f',
  
  // Khmer
  'km': '\\u1780-\\u17ff\\u19e0-\\u19ff',
  
  // Lao
  'lo': '\\u0e80-\\u0eff',
  
  // Tibetan
  'bo': '\\u0f00-\\u0fff',
  
  // Mongolian
  'mn': '\\u1800-\\u18af',
  
  // Sinhala
  'si': '\\u0d80-\\u0dff',
  
  // Malayalam
  'ml': '\\u0d00-\\u0d7f',
  
  // Kannada
  'kn': '\\u0c80-\\u0cff',
  
  // Gujarati
  'gu': '\\u0a80-\\u0aff',
  
  // Punjabi
  'pa': '\\u0a00-\\u0a7f',
  
  // Oriya
  'or': '\\u0b00-\\u0b7f',
  
  // Assamese
  'as': '\\u0980-\\u09ff'
}

/**
 * Create regex pattern for language detection
 */
export function getLanguageRegex(languageCode: string): RegExp | null {
  const range = UNICODE_RANGES[languageCode.toLowerCase()]
  if (!range) return null
  
  return new RegExp(`[${range}]`, 'g')
}

/**
 * Advanced language detection with statistical analysis and CJK disambiguation
 * Returns confidence score (0-1) for each detected language
 */
export function detectLanguageByCharacters(text: string): Record<string, number> {
  const results: Record<string, number> = {}
  const textLength = text.length
  
  if (textLength === 0) return results
  
  // Enhanced CJK disambiguation
  const cjkAnalysis = analyzeCJKCharacters(text)
  
  // Apply CJK analysis results
  if (cjkAnalysis.japanese > 0) {
    results.ja = cjkAnalysis.japanese
  }
  if (cjkAnalysis.korean > 0) {
    results.ko = cjkAnalysis.korean
  }
  if (cjkAnalysis.chinese > 0) {
    results.zh = cjkAnalysis.chinese
  }
  
  // Check for non-CJK languages
  for (const [lang, range] of Object.entries(UNICODE_RANGES)) {
    if (['ja', 'ko', 'zh'].includes(lang)) continue // Already handled above
    
    const regex = new RegExp(`[${range}]`, 'g')
    const matches = text.match(regex)
    const matchCount = matches ? matches.length : 0
    let confidence = matchCount / textLength
    
    // Apply statistical weighting based on language characteristics
    confidence = applyLanguageWeighting(confidence, lang, text)
    
    if (confidence > 0.01) { // Only include languages with >1% character presence
      results[lang] = confidence
    }
  }
  
  return results
}

/**
 * Enhanced CJK (Chinese/Japanese/Korean) character analysis
 * Provides better disambiguation between similar scripts
 */
function analyzeCJKCharacters(text: string): { japanese: number; korean: number; chinese: number } {
  const textLength = text.length
  if (textLength === 0) return { japanese: 0, korean: 0, chinese: 0 }
  
  // Character type counters
  let hiragana = 0
  let katakana = 0
  let hangul = 0
  let kanji = 0
  let chineseSpecific = 0
  
  for (const char of text) {
    const code = char.charCodeAt(0)
    
    // Hiragana (uniquely Japanese)
    if (code >= 0x3040 && code <= 0x309f) {
      hiragana++
    }
    // Katakana (uniquely Japanese)
    else if ((code >= 0x30a0 && code <= 0x30ff) || (code >= 0xff66 && code <= 0xff9f)) {
      katakana++
    }
    // Hangul (uniquely Korean)
    else if (code >= 0xac00 && code <= 0xd7af) {
      hangul++
    }
    // Kanji/Hanzi (shared between Japanese and Chinese)
    else if (code >= 0x4e00 && code <= 0x9fff) {
      kanji++
    }
    // Chinese-specific characters (Traditional Chinese specific ranges)
    else if ((code >= 0x3400 && code <= 0x4dbf) || (code >= 0xf900 && code <= 0xfaff)) {
      chineseSpecific++
    }
  }
  
  // Calculate confidence scores
  const japanese = calculateJapaneseScore(hiragana, katakana, kanji, textLength)
  const korean = hangul / textLength
  const chinese = calculateChineseScore(kanji, chineseSpecific, hiragana, katakana, textLength)
  
  return { japanese, korean, chinese }
}

/**
 * Calculate Japanese confidence score
 */
function calculateJapaneseScore(hiragana: number, katakana: number, kanji: number, textLength: number): number {
  // Japanese text typically has a mix of hiragana, katakana, and kanji
  const kanaRatio = (hiragana + katakana) / textLength
  const kanjiRatio = kanji / textLength
  
  // Strong indicator: presence of hiragana or katakana
  if (kanaRatio > 0.1) {
    return Math.min(1.0, kanaRatio * 2.0 + kanjiRatio * 0.5)
  }
  
  // Weak indicator: kanji without kana (could be Chinese)
  if (kanjiRatio > 0.3) {
    return kanjiRatio * 0.3
  }
  
  return 0
}

/**
 * Calculate Chinese confidence score
 */
function calculateChineseScore(kanji: number, chineseSpecific: number, hiragana: number, katakana: number, textLength: number): number {
  const kanjiRatio = kanji / textLength
  const chineseSpecificRatio = chineseSpecific / textLength
  const kanaRatio = (hiragana + katakana) / textLength
  
  // Strong indicator: Chinese-specific characters
  if (chineseSpecificRatio > 0.05) {
    return Math.min(1.0, chineseSpecificRatio * 3.0 + kanjiRatio * 0.8)
  }
  
  // Moderate indicator: high kanji ratio without kana
  if (kanjiRatio > 0.5 && kanaRatio < 0.1) {
    return kanjiRatio * 0.8
  }
  
  // Weak indicator: some kanji with minimal kana
  if (kanjiRatio > 0.3 && kanaRatio < 0.05) {
    return kanjiRatio * 0.4
  }
  
  return 0
}

/**
 * Apply statistical weighting based on language characteristics
 */
function applyLanguageWeighting(confidence: number, language: string, text: string): number {
  // Language-specific adjustments
  switch (language) {
    case 'ar':
    case 'fa':
    case 'ur':
      // Arabic scripts: boost if high concentration
      return confidence > 0.3 ? confidence * 1.2 : confidence
    
    case 'th':
      // Thai: boost if high concentration (Thai rarely mixed with other scripts)
      return confidence > 0.2 ? confidence * 1.5 : confidence
    
    case 'ru':
      // Cyrillic: boost if high concentration
      return confidence > 0.4 ? confidence * 1.3 : confidence
    
    case 'el':
      // Greek: boost if high concentration
      return confidence > 0.3 ? confidence * 1.4 : confidence
    
    case 'he':
      // Hebrew: boost if high concentration
      return confidence > 0.3 ? confidence * 1.3 : confidence
    
    case 'hi':
    case 'bn':
    case 'ta':
    case 'te':
    case 'ml':
    case 'kn':
    case 'gu':
    case 'pa':
    case 'or':
    case 'as':
      // Indic scripts: boost if high concentration
      return confidence > 0.3 ? confidence * 1.2 : confidence
    
    default:
      return confidence
  }
}

/**
 * Get most likely language based on character analysis
 */
export function getMostLikelyLanguage(text: string, threshold = 0.1): string | null {
  const results = detectLanguageByCharacters(text)
  
  let maxConfidence = 0
  let bestLanguage: string | null = null
  
  for (const [lang, confidence] of Object.entries(results)) {
    if (confidence > maxConfidence && confidence >= threshold) {
      maxConfidence = confidence
      bestLanguage = lang
    }
  }
  
  return bestLanguage
}