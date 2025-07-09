/**
 * DateExtractor - Extract publication dates
 * Ported from Python newspaper4k pubdate_extractor.py
 */

import type { CheerioAPI, Cheerio } from 'cheerio'
import type { Element } from 'domhandler'
import { Configuration } from '../configuration.js'
import { PUBLISH_DATE_META_INFO, PUBLISH_DATE_TAGS } from './defines.js'

interface DateMatch {
  date: Date
  score: number
}

export class DateExtractor {
  private config: Configuration
  private pubdate: Date | null = null

  constructor(config: Configuration) {
    this.config = config
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

}