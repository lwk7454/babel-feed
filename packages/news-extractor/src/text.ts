/**
 * Text processing utilities
 * Ported from Python newspaper4k text.py
 */

/**
 * Clean up whitespace in text
 */
export function innerTrim(text: string): string {
  if (!text) return ''
  
  // Replace multiple whitespace with single space
  return text.replace(/\s+/g, ' ').trim()
}

/**
 * Remove excess whitespace and clean up text
 */
export function cleanText(text: string): string {
  if (!text) return ''
  
  // Remove multiple spaces, tabs, newlines
  let cleaned = text.replace(/\s+/g, ' ')
  
  // Remove leading/trailing whitespace
  cleaned = cleaned.trim()
  
  // Remove common artifacts
  cleaned = cleaned.replace(/\u00A0/g, ' ') // Non-breaking space
  cleaned = cleaned.replace(/\u2009/g, ' ') // Thin space
  cleaned = cleaned.replace(/\u200B/g, '') // Zero-width space
  
  return cleaned
}

/**
 * Check if text has minimum word count
 */
export function hasMinWords(text: string, minCount = 300): boolean {
  if (!text) return false
  
  const words = text.split(/\s+/).filter(word => word.trim().length > 0)
  return words.length >= minCount
}

/**
 * Check if text has minimum sentence count
 */
export function hasMinSentences(text: string, minCount = 7): boolean {
  if (!text) return false
  
  // Simple sentence splitting - can be enhanced
  const sentences = text.split(/[.!?]+/).filter(sentence => sentence.trim().length > 0)
  return sentences.length >= minCount
}

/**
 * Truncate text to maximum length
 */
export function truncateText(text: string, maxLength: number): string {
  if (!text || text.length <= maxLength) return text
  
  // Try to cut at word boundary
  const truncated = text.substring(0, maxLength)
  const lastSpace = truncated.lastIndexOf(' ')
  
  if (lastSpace > maxLength * 0.8) {
    return truncated.substring(0, lastSpace) + '...'
  }
  
  return truncated + '...'
}

/**
 * Extract word tokens from text
 */
export function getWords(text: string): string[] {
  if (!text) return []
  
  return text
    .toLowerCase()
    .split(/\s+/)
    .filter(word => word.trim().length > 0)
    .map(word => word.replace(/[^\w]/g, ''))
    .filter(word => word.length > 0)
}

/**
 * Get basic text statistics
 */
export interface TextStats {
  wordCount: number;
  sentenceCount: number;
  charCount: number;
  avgWordsPerSentence: number;
}

export function getTextStats(text: string): TextStats {
  if (!text) {
    return {
      wordCount: 0,
      sentenceCount: 0,
      charCount: 0,
      avgWordsPerSentence: 0
    }
  }
  
  const words = getWords(text)
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0)
  
  return {
    wordCount: words.length,
    sentenceCount: sentences.length,
    charCount: text.length,
    avgWordsPerSentence: sentences.length > 0 ? words.length / sentences.length : 0
  }
}

/**
 * Simple content quality check
 */
export function isQualityContent(text: string, minWords = 300, minSentences = 7): boolean {
  const stats = getTextStats(text)
  
  return stats.wordCount >= minWords && 
         stats.sentenceCount >= minSentences &&
         stats.avgWordsPerSentence > 2 && 
         stats.avgWordsPerSentence < 50 // Avoid very long sentences
}