/**
 * Unicode Character Ranges for Language Detection
 * Ported from Python newspaper4k languages/__init__.py
 */

/**
 * Unicode character ranges for major languages
 * Used for character-based language detection as fallback
 */
export const UNICODE_RANGES: Record<string, string> = {
  // Chinese (Traditional and Simplified)
  'zh': '\\u3100-\\u312f\\u31a0-\\u31bf\\u3200-\\u32ff\\u3300-\\u33ff\\u3400-\\u4dbf\\u4e00-\\u9fff\\uf900-\\ufaff',
  
  // Japanese (Hiragana, Katakana, Kanji) - prioritize unique Japanese characters
  'ja': '\\u3040-\\u309f\\u30a0-\\u30ff\\uff66-\\uff9f\\u3190-\\u319f\\u31f0-\\u31ff',
  
  // Korean (Hangul)
  'ko': '\\u1100-\\u11ff\\u3130-\\u318f\\uac00-\\ud7af',
  
  // Arabic
  'ar': '\\u0600-\\u06ff\\u0750-\\u077f\\ufb50-\\ufdff\\ufe70-\\ufefe',
  
  // Thai
  'th': '\\u0e00-\\u0e7f',
  
  // Russian/Cyrillic
  'ru': '\\u0400-\\u04ff\\u0500-\\u052f\\u2de0-\\u2dff\\ua640-\\ua69f',
  
  // Greek
  'el': '\\u0370-\\u03ff\\u1f00-\\u1fff',
  
  // Hebrew
  'he': '\\u0590-\\u05ff\\ufb1d-\\ufb4f',
  
  // Hindi/Devanagari
  'hi': '\\u0900-\\u097f\\ua8e0-\\ua8ff',
  
  // Bengali
  'bn': '\\u0980-\\u09ff',
  
  // Tamil
  'ta': '\\u0b80-\\u0bff',
  
  // Telugu
  'te': '\\u0c00-\\u0c7f',
  
  // Georgian
  'ka': '\\u10a0-\\u10ff\\u2d00-\\u2d2f',
  
  // Armenian
  'hy': '\\u0530-\\u058f\\ufb13-\\ufb17'
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
 * Detect language based on character frequency with priority scoring
 * Returns confidence score (0-1) for each detected language
 */
export function detectLanguageByCharacters(text: string): Record<string, number> {
  const results: Record<string, number> = {}
  const textLength = text.length
  
  if (textLength === 0) return results
  
  // Check for unique Japanese characters first (Hiragana/Katakana)
  const hiraganaRegex = /[\u3040-\u309f]/g
  const katakanaRegex = /[\u30a0-\u30ff]/g
  const hiraganaMatches = text.match(hiraganaRegex) || []
  const katakanaMatches = text.match(katakanaRegex) || []
  
  if (hiraganaMatches.length > 0 || katakanaMatches.length > 0) {
    results.ja = (hiraganaMatches.length + katakanaMatches.length) / textLength
    // Boost Japanese score if we find unique Japanese characters
    results.ja *= 1.5
  }
  
  // Check for other languages
  for (const [lang, range] of Object.entries(UNICODE_RANGES)) {
    if (lang === 'ja') continue // Already handled above
    
    const regex = new RegExp(`[${range}]`, 'g')
    const matches = text.match(regex)
    const matchCount = matches ? matches.length : 0
    let confidence = matchCount / textLength
    
    // For Chinese, reduce score if Japanese characters are present
    if (lang === 'zh' && (hiraganaMatches.length > 0 || katakanaMatches.length > 0)) {
      confidence *= 0.5
    }
    
    if (confidence > 0.01) { // Only include languages with >1% character presence
      results[lang] = confidence
    }
  }
  
  return results
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