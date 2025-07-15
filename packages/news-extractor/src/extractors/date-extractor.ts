/**
 * DateExtractor - Extract publication dates
 * Ported from Python newspaper4k pubdate_extractor.py
 */

import type { CheerioAPI, Cheerio } from 'cheerio'
import type { Element } from 'domhandler'
import { Configuration } from '../configuration.js'
import { PUBLISH_DATE_META_INFO, PUBLISH_DATE_TAGS } from './defines.js'
import { RelativeDateParser } from './relative-date-parser.js'

interface DateMatch {
  date: Date
  score: number
}

export class DateExtractor {
  private config: Configuration
  private pubdate: Date | null = null
  private relativeDateParser: RelativeDateParser

  constructor(config: Configuration) {
    this.config = config
    this.relativeDateParser = new RelativeDateParser()
  }

  /**
   * Parse publication date from URL and document - exact port from Python
   * 3 strategies for publishing date extraction in descending accuracy:
   * 1. Pubdate from URL
   * 2. Pubdate from metadata
   * 3. Raw regex searches in the HTML + added heuristics
   */
  public parse(articleUrl: string, $: CheerioAPI): Date | null {
    const parseDateStr = (dateStr: string, isUrlDate = false): Date | null => {
      if (!dateStr) return null
      
      try {
        // Handle URL dates specially to avoid timezone issues
        if (isUrlDate) {
          // Convert URL date format (2023/11/06) to ISO format to avoid timezone issues
          const urlDateRegex = /^(\d{4})[\/\-\._](\d{1,2})[\/\-\._](\d{1,2})$/
          const match = dateStr.match(urlDateRegex)
          if (match) {
            const [, year, month, day] = match
            // Create date in UTC to avoid timezone issues
            const date = new Date(Date.UTC(parseInt(year), parseInt(month) - 1, parseInt(day)))
            if (isNaN(date.getTime())) return null
            return date
          }
        }
        
        // Handle Japanese/compact ISO date format: 20180619T055000+0900
        const compactIsoRegex = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})([+-]\d{4})$/
        const compactMatch = dateStr.match(compactIsoRegex)
        if (compactMatch) {
          const [, year, month, day, hour, minute, second, timezone] = compactMatch
          // Convert to standard ISO format
          const standardIso = `${year}-${month}-${day}T${hour}:${minute}:${second}${timezone.slice(0, 3)}:${timezone.slice(3)}`
          const date = new Date(standardIso)
          if (isNaN(date.getTime())) return null
          return date
        }
        
        const date = new Date(dateStr)
        if (isNaN(date.getTime())) return null
        return date
      } catch {
        return null
      }
    }

    const dateMatches: DateMatch[] = []

    // Strategy 1: Extract from URL using strict date regex
    const strictDateRegex = /(19|20)\d{2}[\/\-\._]\d{1,2}[\/\-\._]\d{1,2}/
    const dateMatch = articleUrl.match(strictDateRegex)
    if (dateMatch) {
      const dateMatchStr = dateMatch[0]
      const dateObj = parseDateStr(dateMatchStr, true)
      if (dateObj) {
        // High score for URL dates to match Python priority (Python gives score 10)
        dateMatches.push({ date: dateObj, score: 10 })
      }
    }

    // Strategy 2: Extract from JSON-LD structured data
    $('script[type="application/ld+json"]').each((_, scriptEl) => {
      try {
        const jsonData = JSON.parse($(scriptEl).text())
        this.extractDatesFromJsonLd(jsonData, dateMatches, parseDateStr)
      } catch {
        // Invalid JSON, continue
      }
    })

    // Strategy 2.5: Extract from relative date patterns
    this.extractRelativeDates($, dateMatches, parseDateStr)

    // Strategy 3: Extract from <time> tags
    $('time').each((_, timeEl) => {
      const $timeEl = $(timeEl)
      const datetime = $timeEl.attr('datetime')
      if (datetime) {
        const dateObj = parseDateStr(datetime)
        if (dateObj) {
          const text = $timeEl.text()
          // Boost if it has the word "published" or "on"
          if (text && /published|\bon:/i.test(text)) {
            dateMatches.push({ date: dateObj, score: 8 })
          } else {
            dateMatches.push({ date: dateObj, score: 5 })
          }
        }
      }
    })

    // Strategy 4: Extract from meta tags and known date elements
    const candidates: Array<[Cheerio<Element>, string]> = []

    // Get meta tags with known date properties
    for (const metaInfo of PUBLISH_DATE_META_INFO) {
      $(`meta[name="${metaInfo}"], meta[property="${metaInfo}"]`).each((_, el) => {
        candidates.push([$(el), 'content'])
      })
    }

    // Get elements with known date attributes
    for (const dateTag of PUBLISH_DATE_TAGS) {
      $(`[${dateTag.attribute}="${dateTag.value}"]`).each((_, el) => {
        candidates.push([$(el) as Cheerio<Element>, dateTag.content])
      })
    }

    // Process all candidates
    for (const [element, contentAttr] of candidates) {
      const dateStr = element.attr(contentAttr)
      const dateObj = parseDateStr(dateStr || '')
      if (dateObj) {
        let score = 6
        
        // Boost meta tags, especially precise ones
        if (element.prop('tagName')?.toLowerCase() === 'meta') {
          score += 2
          
          // Extra boost for highly precise meta tags
          const property = element.attr('property') || element.attr('name')
          if (property === 'article:published_time') {
            score += 2 // Total score becomes 10
          }
        }
        
        // Penalize future dates and very old articles
        const now = new Date()
        const daysDiff = Math.floor((now.getTime() - dateObj.getTime()) / (1000 * 60 * 60 * 24))
        
        if (daysDiff < 0) { // articles from the future
          score -= 2
        } else if (daysDiff > 25 * 365) { // very old articles (25+ years)
          score -= 1
        }
        
        dateMatches.push({ date: dateObj, score })
      }
    }

    // Sort by score (highest first) and return the best match
    dateMatches.sort((a, b) => b.score - a.score)
    this.pubdate = dateMatches.length > 0 ? dateMatches[0].date : null
    return this.pubdate
  }

  /**
   * Extract dates from JSON-LD structured data
   */
  private extractDatesFromJsonLd(data: Record<string, unknown> | unknown[] | string, dateMatches: DateMatch[], parseDateStr: (str: string) => Date | null): void {
    if (typeof data === 'object' && data !== null && !Array.isArray(data)) {
      const obj = data as Record<string, unknown>
      if ('@graph' in obj && Array.isArray(obj['@graph'])) {
        const graph = obj['@graph'] as unknown[]
        for (const item of graph) {
          if (typeof item === 'object' && item !== null) {
            const itemObj = item as Record<string, unknown>
            const dateStr = itemObj.datePublished as string | undefined
            if (dateStr) {
              const dateObj = parseDateStr(dateStr)
              if (dateObj) {
                dateMatches.push({ date: dateObj, score: 10 })
              }
            }
          }
        }
      } else {
        // Check top-level date fields
        const dateFields = ['datePublished', 'dateCreated']
        for (const field of dateFields) {
          if (field in obj && typeof obj[field] === 'string') {
            const dateObj = parseDateStr(obj[field] as string)
            if (dateObj) {
              const score = field === 'datePublished' ? 9 : 8
              dateMatches.push({ date: dateObj, score })
            }
          }
        }
      }
    }
  }

  /**
   * Extract relative dates from time elements and article content
   */
  private extractRelativeDates($: CheerioAPI, dateMatches: DateMatch[], parseDateStr: (dateStr: string, isUrlDate?: boolean) => Date | null): void {
    const language = this.config.language || 'en'
    
    // Strategy 2.5a: Check <time> elements with relative text content
    $('time').each((_, timeEl) => {
      const $timeEl = $(timeEl)
      const text = $timeEl.text().trim()
      const datetime = $timeEl.attr('datetime')
      
      if (text) {
        // Check if the text contains relative time expressions
        const relativeMatch = this.relativeDateParser.parse(text, language)
        if (relativeMatch) {
          if (datetime) {
            // If we have both datetime and relative text, use the datetime but give it highest score
            const dateObj = parseDateStr(datetime)
            if (dateObj) {
              // Highest score for time elements with both datetime and relative text
              const score = 11 // Higher than URL/JSON-LD (10) since it has both precise datetime and relative confirmation
              dateMatches.push({ date: dateObj, score })
            }
          } else {
            // No datetime attribute, use relative parsing
            const score = Math.floor(relativeMatch.confidence * 7) // Max score of 7
            dateMatches.push({ date: relativeMatch.date, score })
          }
        }
      }
    })
    
    // Strategy 2.5b: Check common date container elements
    const dateSelectors = [
      '.date', '.publish-date', '.published', '.timestamp', '.byline',
      '.article-date', '.post-date', '.entry-date', '.time',
      '[class*="date"]', '[class*="time"]', '[class*="published"]'
    ]
    
    for (const selector of dateSelectors) {
      $(selector).each((_, el) => {
        const $el = $(el)
        const text = $el.text().trim()
        
        if (text && text.length < 100) { // Avoid long content blocks
          const relativeMatch = this.relativeDateParser.parse(text, language)
          if (relativeMatch) {
            // Lower score for content-based extraction
            const score = Math.floor(relativeMatch.confidence * 6) // Max score of 6
            dateMatches.push({ date: relativeMatch.date, score })
          }
        }
      })
    }
    
    // Strategy 2.5c: Check article content for relative dates (limited search)
    const contentElements = $('article, .article-body, .content, .post-content, .entry-content')
    if (contentElements.length > 0) {
      contentElements.first().find('p, div, span').each((_, el) => {
        const $el = $(el)
        const text = $el.text().trim()
        
        // Only check relatively short text blocks that might contain dates
        if (text && text.length > 5 && text.length < 200) {
          const relativeMatch = this.relativeDateParser.parse(text, language)
          if (relativeMatch) {
            // Lowest score for content-based extraction
            const score = Math.floor(relativeMatch.confidence * 4) // Max score of 4
            dateMatches.push({ date: relativeMatch.date, score })
          }
        }
      })
    }
  }

}