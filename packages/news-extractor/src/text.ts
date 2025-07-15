/**
 * Text processing utilities
 * Ported from Python newspaper4k text.py
 * Enhanced with multi-language support
 */

import { TokenizerFactory } from './languages/tokenizers/tokenizer-factory.js'
import { getMostLikelyLanguage } from './languages/unicode-ranges.js'

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
 * Extract word tokens from text using language-specific tokenization
 */
export function getWords(text: string, language?: string): string[] {
  if (!text) return []
  
  // Detect language if not provided
  const detectedLanguage = language || getMostLikelyLanguage(text) || 'en'
  
  // Use appropriate tokenizer
  const tokenizer = TokenizerFactory.getTokenizer(detectedLanguage)
  return tokenizer.tokenize(text)
}

/**
 * Extract word tokens from text (legacy method for backward compatibility)
 */
export function getWordsLegacy(text: string): string[] {
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
  language?: string;
}

export function getTextStats(text: string, language?: string): TextStats {
  if (!text) {
    return {
      wordCount: 0,
      sentenceCount: 0,
      charCount: 0,
      avgWordsPerSentence: 0,
      language
    }
  }
  
  // Detect language if not provided
  const detectedLanguage = language || getMostLikelyLanguage(text) || 'en'
  
  const words = getWords(text, detectedLanguage)
  const sentences = getSentences(text, detectedLanguage)
  
  return {
    wordCount: words.length,
    sentenceCount: sentences.length,
    charCount: text.length,
    avgWordsPerSentence: sentences.length > 0 ? words.length / sentences.length : 0,
    language: detectedLanguage
  }
}

/**
 * Split text into sentences based on language
 */
export function getSentences(text: string, language?: string): string[] {
  if (!text) return []
  
  const detectedLanguage = language || getMostLikelyLanguage(text) || 'en'
  
  // Language-specific sentence splitting
  if (detectedLanguage === 'zh') {
    // Chinese uses different punctuation for sentence endings
    return text.split(/[。！？；]+/).filter(s => s.trim().length > 0)
  } else if (detectedLanguage === 'ja') {
    // Japanese sentence endings
    return text.split(/[。！？]+/).filter(s => s.trim().length > 0)
  } else {
    // Default for most languages
    return text.split(/[.!?]+/).filter(s => s.trim().length > 0)
  }
}

/**
 * Simple content quality check with language-aware criteria
 */
export function isQualityContent(text: string, minWords = 300, minSentences = 7, language?: string): boolean {
  const stats = getTextStats(text, language)
  
  // Adjust criteria based on language
  let adjustedMinWords = minWords
  let adjustedMinSentences = minSentences
  
  if (stats.language === 'zh' || stats.language === 'ja') {
    // CJK languages are more dense, adjust thresholds
    adjustedMinWords = Math.floor(minWords * 0.7) // 70% of original threshold
    adjustedMinSentences = Math.floor(minSentences * 0.8) // 80% of original threshold
  }
  
  return stats.wordCount >= adjustedMinWords && 
         stats.sentenceCount >= adjustedMinSentences &&
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

/**
 * Extract time-related phrases from text for relative date parsing
 */
export function extractTimePhrases(text: string, language = 'en'): string[] {
  if (!text) return []
  
  const timePhrases: string[] = []
  const sentences = getSentences(text, language)
  
  // Time-related keywords by language
  const timeKeywords: Record<string, string[]> = {
    'en': [
      'ago', 'yesterday', 'today', 'tomorrow', 'last', 'next', 'previous',
      'minute', 'hour', 'day', 'week', 'month', 'year', 'recently',
      'earlier', 'later', 'now', 'current', 'past', 'future'
    ],
    'zh': [
      '前', '昨天', '今天', '明天', '上', '下', '去年', '明年',
      '分钟', '小时', '天', '周', '星期', '月', '年', '最近',
      '早些时候', '稍后', '现在', '当前', '过去', '未来'
    ],
    'ja': [
      '前', '昨日', '今日', '明日', '先', '来', '去年', '来年',
      '分', '時間', '日', '週間', '月', '年', '最近',
      '早く', '後で', '今', '現在', '過去', '未来'
    ]
  }
  
  const keywords = timeKeywords[language] || timeKeywords['en']
  
  // Look for sentences containing time keywords
  for (const sentence of sentences) {
    const lowerSentence = sentence.toLowerCase()
    let hasTimeKeyword = false
    
    for (const keyword of keywords) {
      if (lowerSentence.includes(keyword.toLowerCase())) {
        hasTimeKeyword = true
        break
      }
    }
    
    if (hasTimeKeyword && sentence.length < 200) {
      timePhrases.push(sentence.trim())
    }
  }
  
  return timePhrases
}

/**
 * Normalize time expressions for consistent parsing
 */
export function normalizeTimeExpression(text: string, language = 'en'): string {
  if (!text) return ''
  
  let normalized = text.toLowerCase().trim()
  
  // Language-specific normalizations
  if (language === 'en') {
    // Normalize common variations
    normalized = normalized.replace(/\bmins?\b/g, 'minutes')
    normalized = normalized.replace(/\bhrs?\b/g, 'hours')
    normalized = normalized.replace(/\bdays?\b/g, 'day')
    normalized = normalized.replace(/\bweeks?\b/g, 'week')
    normalized = normalized.replace(/\bmonths?\b/g, 'month')
    normalized = normalized.replace(/\byears?\b/g, 'year')
    
    // Handle compound expressions first
    normalized = normalized.replace(/\bhalf\s+an?\s+/g, '0.5 ')
    normalized = normalized.replace(/\bcouple\s+of\s+/g, '2 ')
    normalized = normalized.replace(/\bfew\s+/g, '3 ')
    normalized = normalized.replace(/\bseveral\s+/g, '4 ')
    
    // Handle "a/an" articles after compound expressions
    normalized = normalized.replace(/\ba\s+/g, '1 ')
    normalized = normalized.replace(/\ban\s+/g, '1 ')
    
  } else if (language === 'zh') {
    // Chinese normalizations
    normalized = normalized.replace(/分钟/g, '分钟')
    normalized = normalized.replace(/小时/g, '小时')
    normalized = normalized.replace(/个小时/g, '小时')
    normalized = normalized.replace(/天/g, '天')
    normalized = normalized.replace(/个星期/g, '周')
    normalized = normalized.replace(/星期/g, '周')
    normalized = normalized.replace(/个月/g, '月')
    normalized = normalized.replace(/年/g, '年')
    
  } else if (language === 'ja') {
    // Japanese normalizations
    normalized = normalized.replace(/分間/g, '分')
    normalized = normalized.replace(/時間/g, '時間')
    normalized = normalized.replace(/日間/g, '日')
    normalized = normalized.replace(/週間/g, '週間')
    normalized = normalized.replace(/ヶ月/g, 'ヶ月')
    normalized = normalized.replace(/年間/g, '年')
  }
  
  // Remove extra whitespace
  normalized = normalized.replace(/\s+/g, ' ').trim()
  
  return normalized
}

/**
 * Check if text contains potential relative time expressions
 */
export function hasRelativeTimeExpression(text: string, language = 'en'): boolean {
  if (!text) return false
  
  const normalized = normalizeTimeExpression(text, language)
  
  // Common relative time patterns
  const patterns: Record<string, RegExp[]> = {
    'en': [
      /\d+\s*(minute|hour|day|week|month|year)s?\s*ago/i,
      /\b(yesterday|today|tomorrow|last|next|previous)\b/i,
      /\b(recently|earlier|later|now|current)\b/i,
      /\b(a|an|one|two|three|four|five|six|seven|eight|nine|ten)\s+(minute|hour|day|week|month|year)s?\s*ago/i
    ],
    'zh': [
      /\d+\s*(分钟|小时|天|周|月|年)\s*前/,
      /(昨天|今天|明天|上|下|去年|明年)/,
      /(最近|早些时候|稍后|现在|当前)/,
      /(一|二|三|四|五|六|七|八|九|十|几)\s*(分钟|小时|天|周|月|年)\s*前/
    ],
    'ja': [
      /\d+\s*(分|時間|日|週間|月|年)\s*前/,
      /(昨日|今日|明日|先|来|去年|来年)/,
      /(最近|早く|後で|今|現在)/,
      /(１|２|３|４|５|６|７|８|９)\s*(分|時間|日|週間|月|年)\s*前/
    ]
  }
  
  const langPatterns = patterns[language] || patterns['en']
  
  return langPatterns.some(pattern => pattern.test(normalized))
}