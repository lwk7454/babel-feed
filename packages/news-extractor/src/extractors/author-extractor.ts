/**
 * AuthorExtractor - Extract article authors
 * Ported from Python newspaper4k authors_extractor.py
 */

import type { CheerioAPI, Cheerio } from 'cheerio'
import type { AnyNode, Element } from 'domhandler'
import { Configuration } from '../configuration.js'
import { AUTHOR_ATTRS, AUTHOR_VALS, AUTHOR_STOP_WORDS } from './defines.js'

export class AuthorExtractor {
  private config: Configuration
  private authors: string[] = []

  constructor(config: Configuration) {
    this.config = config
  }

  /**
   * Parse authors from document - exact port from Python
   */
  public parse($: CheerioAPI): string[] {
    const digitsRegex = /\d/
    const authorStopwordsPattern = AUTHOR_STOP_WORDS.map(x => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    const authorStopwords = new RegExp(`\\b(${authorStopwordsPattern.join('|')})\\b`, 'i')

    const containsDigits = (text: string): boolean => {
      return digitsRegex.test(text)
    }

    const uniqifyList = (list: string[]): string[] => {
      const seen = new Map<string, string>()
      for (const item of list) {
        // Normalize whitespace - replace non-breaking spaces and other whitespace with regular spaces
        const normalizedItem = item.replace(/\s+/g, ' ').trim()
        const key = normalizedItem.toLowerCase().trim()
        seen.set(key, normalizedItem)
      }
      return Array.from(seen.entries())
        .filter(([key]) => key) // Python: if item (checks key)
        .map(([, value]) => value)
    }

    const parseByline = (searchStr: string): string[] => {
      // Remove HTML boilerplate
      let cleaned = searchStr.replace(/<[^<]+?>/g, '')
      cleaned = cleaned.replace(/[\n\t\r\u00A0]/g, ' ')

      // Filter out Chinese editor patterns - these are editorial bylines, not authors
      const editorPatterns = [
        /（编辑[：:][^）]*）/g,  // (编辑：...)
        /【责任编辑[：:][^】]*】/g,  // 【责任编辑：...】
        /编辑[：:]/g,  // 编辑：
        /责任编辑[：:]/g,  // 责任编辑：
        /值班编辑[：:]/g,  // 值班编辑：
        /执行编辑[：:]/g   // 执行编辑：
      ]
      
      for (const pattern of editorPatterns) {
        if (pattern.test(cleaned)) {
          // This is an editorial byline, not an author byline
          return []
        }
      }

      // Remove original By statement
      const byMatch = cleaned.match(/\b(by|from)[:\s](.*)/i)
      if (byMatch) {
        cleaned = byMatch[2]
      }

      cleaned = cleaned.trim()

      // Split by common separators
      const nameTokens = cleaned.split(/[·,|]|\sand\s|\set\s|\sund\s|\//)
        .map(s => s.trim())
        .filter(s => !containsDigits(s))
        .filter(s => {
          // For Unicode text (CJK), check character length instead of word count
          if (this.isUnicodeText(s)) {
            return s.length >= 2 && s.length <= 10
          }
          // For space-separated languages, use word count
          const wordCount = (s.match(/\w+/g) || []).length
          return wordCount > 1 && wordCount < 5
        })

      return nameTokens
    }

    const getTextFromElement = (node: Cheerio<Element>): string => {
      if (!node || node.length === 0) return ''
      
      // Clone and remove unwanted tags
      const cloned = node.clone()
      cloned.find('script, style, time').remove()
      return cloned.text() || ''
    }

    const authors: string[] = []
    const matches: Array<[Cheerio<Element>, string]> = []

    // Extract from JSON-LD structured data
    const jsonLdScripts = $('script[type="application/ld+json"]')
    jsonLdScripts.each((_, scriptEl) => {
      try {
        const jsonData = JSON.parse($(scriptEl).text())
        this.extractAuthorsFromJsonLd(jsonData, authors)
      } catch {
        // Invalid JSON, continue
      }
    })

    // Search for author attributes and values
    for (const attr of AUTHOR_ATTRS) {
      for (const val of AUTHOR_VALS) {
        const elements = $(`[${attr}="${val}"]`)
        elements.each((_, el) => {
          // Only process if node is an Element
          if (el.type === 'tag') {
            const element = $(el) as Cheerio<Element>
            const path = this.getElementPath(element)
            matches.push([element, path])
          }
        })
      }
    }

    // Sort by XPath specificity (longer paths first)
    matches.sort((a, b) => b[1].localeCompare(a[1]))

    // Remove parent nodes (keep most specific)
    const matchesReduced: Array<[Cheerio<Element>, string]> = []
    for (const match of matches) {
      if (matchesReduced.length === 0) {
        matchesReduced.push(match)
      } else if (!matchesReduced[matchesReduced.length - 1][1].startsWith(match[1])) {
        matchesReduced.push(match)
      }
    }

    // Sort back to preserve some order
    matchesReduced.sort((a, b) => a[1].localeCompare(b[1]))

    // Extract content from matched elements
    for (const [match] of matchesReduced) {
      let content = ''
      
      if (match.prop('tagName') === 'META') {
        content = match.attr('content') || ''
        
        // For meta tags, validate that the content isn't an editor name
        // by checking if it appears in editorial contexts in the page
        if (content) {
          const editorContextPatterns = [
            new RegExp(`（编辑[：:][^）]*${content}[^）]*）`, 'g'),
            new RegExp(`【责任编辑[：:][^】]*${content}[^】]*】`, 'g'),
            new RegExp(`编辑[：:].*${content}`, 'g'),
            new RegExp(`责任编辑[：:].*${content}`, 'g')
          ]
          
          const pageHTML = $.html()
          let isEditor = false
          for (const pattern of editorContextPatterns) {
            if (pattern.test(pageHTML)) {
              isEditor = true
              break
            }
          }
          
          // If this name appears in editorial contexts, skip it
          if (isEditor) {
            continue
          }
        }
      } else {
        content = getTextFromElement(match)
      }
      
      if (content.length > 0) {
        authors.push(...parseByline(content))
      }
    }

    // Clean up authors of stopwords
    const cleanedAuthors = authors.map(author => 
      author.replace(authorStopwords, '').replace(/^[\s.,-/]+|[\s.,-/]+$/g, '')
    )

    this.authors = uniqifyList(cleanedAuthors)
    return this.authors
  }

  /**
   * Extract authors from JSON-LD structured data
   */
  private extractAuthorsFromJsonLd(data: Record<string, unknown> | unknown[] | string, authors: string[]): void {
    const getAuthors = (vals: Record<string, unknown> | unknown[] | string): void => {
      if (typeof vals === 'object' && vals !== null && !Array.isArray(vals)) {
        const obj = vals as Record<string, unknown>
        if (typeof obj.name === 'string') {
          authors.push(obj.name)
        } else if (Array.isArray(obj.name)) {
          obj.name.forEach(name => {
            if (typeof name === 'string') authors.push(name)
          })
        }
      } else if (Array.isArray(vals)) {
        for (const val of vals) {
          if (typeof val === 'object' && val !== null) {
            const obj = val as Record<string, unknown>
            if (typeof obj.name === 'string') authors.push(obj.name)
          } else if (typeof val === 'string') {
            authors.push(val)
          }
        }
      } else if (typeof vals === 'string') {
        authors.push(vals)
      }
    }

    // Handle array of JSON-LD objects (like Time article)
    if (Array.isArray(data)) {
      for (const item of data) {
        this.extractAuthorsFromJsonLd(item as string | unknown[] | Record<string, unknown>, authors)
      }
      return
    }

    if (typeof data === 'object' && data !== null) {
      const obj = data as Record<string, unknown>
      if ('@graph' in obj && Array.isArray(obj['@graph'])) {
        const graph = obj['@graph'] as unknown[]
        for (const item of graph) {
          if (typeof item === 'object' && item !== null) {
            const itemObj = item as Record<string, unknown>
            if (itemObj['@type'] === 'Person' && typeof itemObj.name === 'string') {
              authors.push(itemObj.name)
            }
            if ('author' in itemObj) {
              getAuthors(itemObj.author as Record<string, unknown> | unknown[] | string)
            }
          }
        }
      } else if ('author' in obj) {
        getAuthors(obj.author as Record<string, unknown> | unknown[] | string)
      }
    }
  }

  /**
   * Get element path for sorting
   */
  private getElementPath(element: Cheerio<Element>): string {
    const path: string[] = []
    let current = element
    
    while (current.length > 0 && current.prop('tagName') !== 'HTML') {
      const tagName = current.prop('tagName')?.toLowerCase() || ''
      const index = current.index()
      path.unshift(`${tagName}[${index}]`)
      current = current.parent()
    }
    
    return '/' + path.join('/')
  }

  /**
   * Check if text contains primarily Unicode characters (CJK)
   */
  private isUnicodeText(text: string): boolean {
    if (!text) return false
    
    // Count CJK characters
    let cjkChars = 0
    for (const char of text) {
      const code = char.charCodeAt(0)
      if (
        (code >= 0x4e00 && code <= 0x9fff) ||  // CJK Unified Ideographs
        (code >= 0x3040 && code <= 0x309f) ||  // Hiragana
        (code >= 0x30a0 && code <= 0x30ff) ||  // Katakana
        (code >= 0x3400 && code <= 0x4dbf) ||  // CJK Extension A
        (code >= 0xac00 && code <= 0xd7af)     // Hangul
      ) {
        cjkChars++
      }
    }
    
    // If more than 50% of characters are CJK, consider it Unicode text
    return cjkChars / text.length > 0.5
  }
}