/**
 * RelativeDateParser - Parse relative/semantic dates like "2 hours ago", "yesterday"
 * Converts relative time expressions to absolute Date objects using system time
 */

export interface RelativePattern {
  pattern: RegExp
  unit: TimeUnit
  multiplier?: number
  fixed?: boolean // For fixed dates like "yesterday", "today"
}

export interface RelativeMatch {
  date: Date
  confidence: number
  originalText: string
  matchedPattern: string
}

export type TimeUnit = 'minute' | 'hour' | 'day' | 'week' | 'month' | 'year'

export class RelativeDateParser {
  private patterns: Map<string, RelativePattern[]> = new Map()
  private referenceTime: Date

  constructor(referenceTime: Date = new Date()) {
    this.referenceTime = referenceTime
    this.initializePatterns()
  }

  /**
   * Parse relative date from text
   */
  public parse(text: string, language = 'en'): RelativeMatch | null {
    if (!text) return null

    const patterns = this.patterns.get(language) || this.patterns.get('en')!
    const cleanText = text.trim().toLowerCase()

    for (const pattern of patterns) {
      const match = cleanText.match(pattern.pattern)
      if (match) {
        const date = this.calculateDate(match, pattern)
        if (date) {
          return {
            date,
            confidence: this.calculateConfidence(match, pattern),
            originalText: text,
            matchedPattern: pattern.pattern.source
          }
        }
      }
    }

    return null
  }

  /**
   * Calculate absolute date from relative pattern match
   */
  private calculateDate(match: RegExpMatchArray, pattern: RelativePattern): Date | null {
    const now = new Date(this.referenceTime)

    if (pattern.fixed) {
      return this.getFixedDate(pattern, now)
    }

    // Extract number from match
    const numberMatch = match[1] || match[0]
    let amount = 1

    if (numberMatch) {
      const parsed = this.parseNumber(numberMatch)
      if (parsed === null) return null
      amount = parsed
    }

    // Apply multiplier if specified
    if (pattern.multiplier) {
      amount *= pattern.multiplier
    }

    return this.subtractTimeUnit(now, pattern.unit, amount)
  }

  /**
   * Parse number from text (handles words like "one", "two", etc.)
   */
  private parseNumber(text: string): number | null {
    const numberWords: Record<string, number> = {
      'a': 1, 'an': 1, 'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5,
      'six': 6, 'seven': 7, 'eight': 8, 'nine': 9, 'ten': 10,
      'eleven': 11, 'twelve': 12, 'thirteen': 13, 'fourteen': 14, 'fifteen': 15,
      'sixteen': 16, 'seventeen': 17, 'eighteen': 18, 'nineteen': 19, 'twenty': 20,
      'thirty': 30, 'forty': 40, 'fifty': 50, 'sixty': 60, 'seventy': 70,
      'eighty': 80, 'ninety': 90, 'hundred': 100,
      // Chinese numbers
      '一': 1, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6, '七': 7, '八': 8, '九': 9, '十': 10,
      '半': 0.5, '几': 3, // "几" (few) defaults to 3
      // Japanese numbers
      '１': 1, '２': 2, '３': 3, '４': 4, '５': 5, '６': 6, '７': 7, '８': 8, '９': 9
    }

    const cleaned = text.toLowerCase().trim()
    
    // Try parsing as number first
    const parsed = parseInt(cleaned, 10)
    if (!isNaN(parsed)) return parsed

    // Try word lookup
    if (numberWords[cleaned]) return numberWords[cleaned]

    return null
  }

  /**
   * Get fixed date (yesterday, today, etc.)
   */
  private getFixedDate(pattern: RelativePattern, now: Date): Date {
    const date = new Date(now)
    
    switch (pattern.unit) {
      case 'day':
        if (pattern.multiplier === -1) {
          // Yesterday
          date.setDate(date.getDate() - 1)
        } else if (pattern.multiplier === 0) {
          // Today (no change)
        } else if (pattern.multiplier === 1) {
          // Tomorrow
          date.setDate(date.getDate() + 1)
        }
        break
      case 'week':
        if (pattern.multiplier === -1) {
          // Last week
          date.setDate(date.getDate() - 7)
        }
        break
      case 'month':
        if (pattern.multiplier === -1) {
          // Last month
          date.setMonth(date.getMonth() - 1)
        }
        break
      case 'year':
        if (pattern.multiplier === -1) {
          // Last year
          date.setFullYear(date.getFullYear() - 1)
        }
        break
    }

    return date
  }

  /**
   * Subtract time unit from date
   */
  private subtractTimeUnit(date: Date, unit: TimeUnit, amount: number): Date {
    const result = new Date(date)

    switch (unit) {
      case 'minute':
        result.setMinutes(result.getMinutes() - amount)
        break
      case 'hour': {
        // Handle fractional hours by converting to minutes
        const totalMinutes = amount * 60
        result.setMinutes(result.getMinutes() - totalMinutes)
        break
      }
      case 'day':
        result.setDate(result.getDate() - amount)
        break
      case 'week':
        result.setDate(result.getDate() - (amount * 7))
        break
      case 'month':
        result.setMonth(result.getMonth() - amount)
        break
      case 'year':
        result.setFullYear(result.getFullYear() - amount)
        break
    }

    return result
  }

  /**
   * Calculate confidence score for match
   */
  private calculateConfidence(match: RegExpMatchArray, pattern: RelativePattern): number {
    let confidence = 0.7 // Base confidence for relative dates

    // Boost confidence for more specific patterns
    if (pattern.fixed) {
      confidence += 0.15 // Fixed dates like "yesterday" are more reliable
    }

    // Boost confidence for exact number matches
    if (match[1] && /^\d+$/.test(match[1])) {
      confidence += 0.1
    }

    // Reduce confidence for very old dates
    const calculatedDate = this.calculateDate(match, pattern)
    if (calculatedDate) {
      const daysDiff = Math.floor((this.referenceTime.getTime() - calculatedDate.getTime()) / (1000 * 60 * 60 * 24))
      if (daysDiff > 30) {
        confidence -= 0.2 // Reduce confidence for dates older than 30 days
      }
    }

    return Math.max(0.1, Math.min(1.0, confidence))
  }

  /**
   * Initialize language-specific patterns
   */
  private initializePatterns(): void {
    // English patterns
    this.patterns.set('en', [
      // Fixed dates
      { pattern: /\byesterday\b/, unit: 'day', multiplier: -1, fixed: true },
      { pattern: /\btoday\b/, unit: 'day', multiplier: 0, fixed: true },
      { pattern: /\btomorrow\b/, unit: 'day', multiplier: 1, fixed: true },
      { pattern: /\blast week\b/, unit: 'week', multiplier: -1, fixed: true },
      { pattern: /\blast month\b/, unit: 'month', multiplier: -1, fixed: true },
      { pattern: /\blast year\b/, unit: 'year', multiplier: -1, fixed: true },

      // Relative with numbers
      { pattern: /(\d+|a|an|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred)\s+minutes?\s+ago/, unit: 'minute' },
      { pattern: /(\d+|a|an|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred)\s+hours?\s+ago/, unit: 'hour' },
      { pattern: /(\d+|a|an|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred)\s+days?\s+ago/, unit: 'day' },
      { pattern: /(\d+|a|an|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred)\s+weeks?\s+ago/, unit: 'week' },
      { pattern: /(\d+|a|an|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred)\s+months?\s+ago/, unit: 'month' },
      { pattern: /(\d+|a|an|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred)\s+years?\s+ago/, unit: 'year' },

      // Short forms
      { pattern: /(\d+)min\s+ago/, unit: 'minute' },
      { pattern: /(\d+)h\s+ago/, unit: 'hour' },
      { pattern: /(\d+)d\s+ago/, unit: 'day' },
      { pattern: /(\d+)w\s+ago/, unit: 'week' },
      { pattern: /(\d+)m\s+ago/, unit: 'month' },
      { pattern: /(\d+)y\s+ago/, unit: 'year' },
    ])

    // Chinese patterns
    this.patterns.set('zh', [
      // Fixed dates
      { pattern: /昨天/, unit: 'day', multiplier: -1, fixed: true },
      { pattern: /今天/, unit: 'day', multiplier: 0, fixed: true },
      { pattern: /明天/, unit: 'day', multiplier: 1, fixed: true },
      { pattern: /上周|上星期/, unit: 'week', multiplier: -1, fixed: true },
      { pattern: /上个月|上月/, unit: 'month', multiplier: -1, fixed: true },
      { pattern: /去年/, unit: 'year', multiplier: -1, fixed: true },

      // Relative with numbers
      { pattern: /(\d+|一|二|三|四|五|六|七|八|九|十|半|几)分钟前/, unit: 'minute' },
      { pattern: /(\d+|一|二|三|四|五|六|七|八|九|十|半|几)小时前/, unit: 'hour' },
      { pattern: /(\d+|一|二|三|四|五|六|七|八|九|十|半|几)天前/, unit: 'day' },
      { pattern: /(\d+|一|二|三|四|五|六|七|八|九|十|半|几)周前/, unit: 'week' },
      { pattern: /(\d+|一|二|三|四|五|六|七|八|九|十|半|几)个月前/, unit: 'month' },
      { pattern: /(\d+|一|二|三|四|五|六|七|八|九|十|半|几)年前/, unit: 'year' },
    ])

    // Japanese patterns
    this.patterns.set('ja', [
      // Fixed dates
      { pattern: /昨日/, unit: 'day', multiplier: -1, fixed: true },
      { pattern: /今日/, unit: 'day', multiplier: 0, fixed: true },
      { pattern: /明日/, unit: 'day', multiplier: 1, fixed: true },
      { pattern: /先週/, unit: 'week', multiplier: -1, fixed: true },
      { pattern: /先月/, unit: 'month', multiplier: -1, fixed: true },
      { pattern: /去年/, unit: 'year', multiplier: -1, fixed: true },

      // Relative with numbers
      { pattern: /(\d+|１|２|３|４|５|６|７|８|９)分前/, unit: 'minute' },
      { pattern: /(\d+|１|２|３|４|５|６|７|８|９)時間前/, unit: 'hour' },
      { pattern: /(\d+|１|２|３|４|５|６|７|８|９)日前/, unit: 'day' },
      { pattern: /(\d+|１|２|３|４|５|６|７|８|９)週間前/, unit: 'week' },
      { pattern: /(\d+|１|２|３|４|５|６|７|８|９)ヶ月前/, unit: 'month' },
      { pattern: /(\d+|１|２|３|４|５|６|７|８|９)年前/, unit: 'year' },
    ])
  }

  /**
   * Set a custom reference time for testing
   */
  public setReferenceTime(time: Date): void {
    this.referenceTime = time
  }

  /**
   * Get all supported languages
   */
  public getSupportedLanguages(): string[] {
    return Array.from(this.patterns.keys())
  }
}