/**
 * DateExtractor - Extract publication dates
 * Ported from Python newspaper4k pubdate_extractor.py
 */

import * as cheerio from 'cheerio'
import { Configuration } from '../configuration.js'
import { PUBLISH_DATE_META_INFO, PUBLISH_DATE_TAGS } from './defines.js'

export class DateExtractor {
  private config: Configuration

  constructor(config: Configuration) {
    this.config = config
  }

  /**
   * Parse publication date from URL and document
   */
  public parse(url: string, $: cheerio.CheerioAPI): Date | null {
    // Try URL date extraction first
    const urlDate = this.extractDateFromUrl(url)
    if (urlDate) return urlDate

    // Try meta tags
    const metaDate = this.extractDateFromMeta($)
    if (metaDate) return metaDate

    // Try structured data
    const structuredDate = this.extractDateFromStructuredData($)
    if (structuredDate) return structuredDate

    // Try time tags
    const timeDate = this.extractDateFromTimeTags($)
    if (timeDate) return timeDate

    return null
  }

  /**
   * Extract date from URL patterns
   */
  private extractDateFromUrl(url: string): Date | null {
    // Common URL date patterns: /2023/12/31/, /2023-12-31/, etc.
    const datePatterns = [
      /\/(\d{4})\/(\d{1,2})\/(\d{1,2})\//,
      /\/(\d{4})-(\d{1,2})-(\d{1,2})\//,
      /\/(\d{4})(\d{2})(\d{2})\//,
      /[\/_](\d{4})-(\d{1,2})-(\d{1,2})[\/_]/
    ]

    for (const pattern of datePatterns) {
      const match = url.match(pattern)
      if (match) {
        const year = parseInt(match[1], 10)
        const month = parseInt(match[2], 10)
        const day = parseInt(match[3], 10)
        
        if (this.isValidDate(year, month, day)) {
          return new Date(year, month - 1, day)
        }
      }
    }

    return null
  }

  /**
   * Extract date from meta tags
   */
  private extractDateFromMeta($: cheerio.CheerioAPI): Date | null {
    for (const metaName of PUBLISH_DATE_META_INFO) {
      // Try name attribute
      let content = $(`meta[name="${metaName}"]`).attr('content')
      if (content) {
        const date = this.parseDate(content)
        if (date) return date
      }

      // Try property attribute
      content = $(`meta[property="${metaName}"]`).attr('content')
      if (content) {
        const date = this.parseDate(content)
        if (date) return date
      }
    }

    return null
  }

  /**
   * Extract date from structured data (JSON-LD)
   */
  private extractDateFromStructuredData($: cheerio.CheerioAPI): Date | null {
    let foundDate: Date | null = null
    
    $('script[type="application/ld+json"]').each((_, el) => {
      try {
        const jsonData = JSON.parse($(el).text())
        const date = this.findDateInJsonData(jsonData)
        if (date) {
          foundDate = date
          return false // Break out of each loop
        }
      } catch {
        // Invalid JSON, continue
      }
    })

    return foundDate
  }

  /**
   * Extract date from time tags
   */
  private extractDateFromTimeTags($: cheerio.CheerioAPI): Date | null {
    const timeElements = $('time')
    
    for (let i = 0; i < timeElements.length; i++) {
      const timeEl = timeElements.eq(i)
      
      // Try datetime attribute
      const datetime = timeEl.attr('datetime')
      if (datetime) {
        const date = this.parseDate(datetime)
        if (date) return date
      }

      // Try text content
      const text = timeEl.text().trim()
      if (text) {
        const date = this.parseDate(text)
        if (date) return date
      }
    }

    return null
  }

  /**
   * Find date in JSON-LD data recursively
   */
  private findDateInJsonData(data: any): Date | null {
    if (!data || typeof data !== 'object') return null

    const dateFields = ['datePublished', 'publishedTime', 'dateCreated', 'publishDate']
    
    for (const field of dateFields) {
      if (data[field]) {
        const date = this.parseDate(data[field])
        if (date) return date
      }
    }

    // Recursive search in nested objects
    for (const key in data) {
      if (typeof data[key] === 'object') {
        const date = this.findDateInJsonData(data[key])
        if (date) return date
      }
    }

    return null
  }

  /**
   * Parse date string into Date object
   */
  private parseDate(dateString: string): Date | null {
    if (!dateString) return null

    try {
      // Remove timezone info for simpler parsing
      let cleaned = dateString.replace(/[TZ].*$/, '')
      cleaned = cleaned.replace(/\+\d{2}:\d{2}$/, '')
      
      const date = new Date(cleaned)
      
      // Check if date is valid and reasonable
      if (isNaN(date.getTime())) return null
      
      const year = date.getFullYear()
      if (year < 1990 || year > new Date().getFullYear() + 1) return null
      
      return date
    } catch {
      return null
    }
  }

  /**
   * Validate date components
   */
  private isValidDate(year: number, month: number, day: number): boolean {
    if (year < 1990 || year > new Date().getFullYear() + 1) return false
    if (month < 1 || month > 12) return false
    if (day < 1 || day > 31) return false
    
    // Check if date actually exists
    const date = new Date(year, month - 1, day)
    return date.getFullYear() === year && 
           date.getMonth() === month - 1 && 
           date.getDate() === day
  }
}