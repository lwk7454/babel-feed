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

/**
 * Stopword statistics for content scoring
 */
export interface StopWordStats {
  stopWordCount: number
  wordCount: number
  score: number
}

// Basic English stopwords for content scoring
const ENGLISH_STOPWORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'been', 'by', 'for', 'from',
  'has', 'he', 'in', 'is', 'it', 'its', 'of', 'on', 'that', 'the', 'to',
  'was', 'were', 'will', 'with', 'the', 'this', 'but', 'they', 'have',
  'had', 'what', 'said', 'each', 'which', 'she', 'do', 'how', 'their',
  'if', 'up', 'out', 'many', 'then', 'them', 'would', 'so', 'some', 'her',
  'him', 'time', 'has', 'two', 'more', 'very', 'what', 'know', 'just',
  'first', 'get', 'over', 'think', 'also', 'its', 'after', 'back', 'other',
  'many', 'than', 'then', 'them', 'well', 'were'
])

// Language-specific stopword sets (basic implementation)
const STOPWORDS: Record<string, Set<string>> = {
  'en': ENGLISH_STOPWORDS,
  'zh': new Set(['的', '一', '是', '在', '不', '了', '有', '和', '人', '这', '中', '大', '为', '上', '个', '国', '我', '以', '要', '他', '时', '来', '用', '们', '生', '到', '作', '地', '于', '出', '就', '分', '对', '成', '会', '可', '主', '发', '年', '动', '同', '工', '也', '能', '下', '过', '子', '说', '产', '种', '面', '而', '方', '后', '多', '定', '行', '学', '法', '所', '民', '得', '经', '十', '三', '之', '进', '着', '等', '部', '度', '家', '电', '力', '里', '如', '水', '化', '高', '自', '二', '理', '起', '小', '物', '现', '实', '加', '量', '都', '两', '体', '制', '机', '当', '使', '点', '从', '业', '本', '去', '把', '性', '好']),
  'ja': new Set(['の', 'に', 'は', 'を', 'た', 'が', 'で', 'て', 'と', 'し', 'れ', 'さ', 'ある', 'いる', 'も', 'する', 'から', 'な', 'こと', 'として', 'い', 'や', 'れる', 'など', 'なっ', 'ない', 'この', 'ため', 'その', 'あっ', 'よう', 'また', 'もの', 'という', 'あり', 'まで', 'られ', 'なる', 'へ', 'か', 'だ', 'これ', 'によって', 'により', 'おり', 'より', 'による', 'ず', 'なり', 'られる', 'において', 'ば', 'なかっ', 'なく', 'しかし', 'について', 'せ', 'だっ', 'その後', 'できる', 'それ'])
}

/**
 * Get stopword statistics for text
 */
export function getStopWords(text: string, language = 'en'): StopWordStats {
  if (!text) {
    return { stopWordCount: 0, wordCount: 0, score: 0 }
  }

  const words = getWords(text)
  const stopwords = STOPWORDS[language] || ENGLISH_STOPWORDS
  
  let stopWordCount = 0
  for (const word of words) {
    if (stopwords.has(word.toLowerCase())) {
      stopWordCount++
    }
  }

  const score = stopWordCount * 1.5 // Weight stopwords higher for scoring

  return {
    stopWordCount,
    wordCount: words.length,
    score
  }
}