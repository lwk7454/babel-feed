/**
 * HTML parsing utilities
 * Ported from Python newspaper4k parsers.py
 */

import * as cheerio from 'cheerio'
import iconv from 'iconv-lite'
// Using require for he to avoid type issues
const he = require('he')

const log = console // TODO: Replace with proper logging

export type CheerioElement = any; // Using any for now due to cheerio type complexity
export type CheerioRoot = cheerio.CheerioAPI;

/**
 * Convert HTML string to Unicode if needed
 */
export function getUnicodeHtml(html: string | Buffer): string {
  if (typeof html === 'string') {
    return html
  }
  
  if (!html) {
    return ''
  }

  try {
    // Try UTF-8 first
    const utf8Text = html.toString('utf-8')
    if (utf8Text && !utf8Text.includes('\uFFFD')) {
      return utf8Text
    }
    
    // Try other encodings
    const encodings = ['latin1', 'ascii', 'utf16le']
    for (const encoding of encodings) {
      try {
        const decoded = iconv.decode(html, encoding)
        if (decoded && !decoded.includes('\uFFFD')) {
          return decoded
        }
      } catch {
        continue
      }
    }
    
    // Fallback to UTF-8 with replacement
    return html.toString('utf-8')
  } catch (error) {
    log.warn?.('Failed to decode HTML, using UTF-8 with replacement')
    return html.toString('utf-8')
  }
}

/**
 * Parse HTML string into Cheerio object
 */
export function fromString(html: string | Buffer): CheerioRoot | null {
  const unicodeHtml = getUnicodeHtml(html)
  
  try {
    // Remove XML encoding declarations that Cheerio doesn't handle well
    let cleanHtml = unicodeHtml
    if (cleanHtml.startsWith('<?')) {
      cleanHtml = cleanHtml.replace(/^<\?.*?\?>/g, '')
    }
    
    return cheerio.load(cleanHtml, {
      xml: false
    })
  } catch (error) {
    log.warn?.(`fromString() failed to parse HTML: ${unicodeHtml.substring(0, 20)}...`)
    return null
  }
}

/**
 * Convert Cheerio element to HTML string
 */
export function nodeToString(element: cheerio.Cheerio<any>): string {
  return element.html() || ''
}

/**
 * Get outer HTML of element
 */
export function outerHtml(element: cheerio.Cheerio<any>): string {
  return element.prop('outerHTML') || element.toString()
}

/**
 * Get elements by tag with attribute matching
 */
export function getTags(
  $: CheerioRoot, 
  selector = '*',
  attribs?: Record<string, string>,
  attribsMatch: 'exact' | 'substring' | 'word' = 'exact'
): cheerio.Cheerio<any> {
  let baseSelector = selector
  
  if (attribs) {
    const attrSelectors: string[] = []
    
    for (const [key, value] of Object.entries(attribs)) {
      const lowerValue = value.toLowerCase()
      
      switch (attribsMatch) {
        case 'exact':
          attrSelectors.push(`[${key}="${value}" i]`)
          break
        case 'substring':
          attrSelectors.push(`[${key}*="${lowerValue}" i]`)
          break
        case 'word':
          attrSelectors.push(`[${key}~="${lowerValue}" i]`)
          break
      }
    }
    
    baseSelector += attrSelectors.join('')
  }
  
  return $(baseSelector)
}

/**
 * Get elements by tag with regex attribute matching
 */
export function getTagsRegex(
  $: CheerioRoot,
  selector = '*',
  attribs?: Record<string, string>
): cheerio.Cheerio<any> {
  if (!attribs) {
    return $(selector)
  }
  
  // For regex matching, we need to filter manually
  return $(selector).filter((_index, element) => {
    const $elem = $(element)
    
    return Object.entries(attribs).every(([attr, pattern]) => {
      const value = $elem.attr(attr)
      if (!value) return false
      
      try {
        const regex = new RegExp(pattern, 'i')
        return regex.test(value)
      } catch {
        return false
      }
    })
  })
}

/**
 * Get meta tags by name, property, or itemprop
 */
export function getMetaTags(
  $: CheerioRoot,
  value?: string
): cheerio.Cheerio<any> {
  if (!value) {
    return $('meta')
  }
  
  return $(`meta[name="${value}" i], meta[property="${value}" i], meta[itemprop="${value}" i]`)
}

/**
 * Get elements by multiple tags
 */
export function getElementsByTagsList(
  $: CheerioRoot,
  tagList: string[]
): cheerio.Cheerio<any> {
  const selector = tagList.join(', ')
  return $(selector)
}

/**
 * Get text content from element, stripping unwanted tags
 */
export function getText(element: cheerio.Cheerio<any>): string {
  // Clone the element to avoid modifying original
  const clone = element.clone()
  
  // Remove script, style, and other unwanted elements
  clone.find('script, style, select, option, textarea').remove()
  
  // Get text and clean it up
  const text = clone.text() || ''
  return text.replace(/\s+/g, ' ').trim()
}

/**
 * Get attribute value from element with HTML entity decoding
 */
export function getAttribute(
  element: cheerio.Cheerio<any>,
  attr: string,
  defaultValue?: string
): string | undefined {
  const value = element.attr(attr)
  if (value === undefined) {
    return defaultValue
  }
  
  return he.decode(value)
}

/**
 * Set attribute on element
 */
export function setAttribute(
  element: cheerio.Cheerio<any>,
  attr: string,
  value: string | number
): void {
  element.attr(attr, String(value))
}

/**
 * Remove elements from DOM
 */
export function remove(
  elements: cheerio.Cheerio<any>,
  keepTags?: string[]
): void {
  if (keepTags && keepTags.length > 0) {
    // Move children with specified tags to parent before removing
    elements.each((index, element) => {
      const $elem = cheerio.load(element)
      const $parent = $elem(element).parent()
      
      keepTags.forEach(tag => {
        const $keepElements = $elem(tag)
        $keepElements.each((i, keepElem) => {
          $parent.append(keepElem)
        })
      })
    })
  }
  
  elements.remove()
}

/**
 * Drop tag but keep content
 */
export function dropTags(elements: cheerio.Cheerio<any>): void {
  elements.each((index, element) => {
    const $elem = cheerio.load(element)
    const $element = $elem(element)
    const content = $element.html() || ''
    $element.replaceWith(content)
  })
}

/**
 * Get JSON-LD structured data from page
 */
export function getLdJsonObject($: CheerioRoot): any[] {
  const results: any[] = []
  const jsonLdScripts = $('script[type="application/ld+json"]')
  
  jsonLdScripts.each((index, script) => {
    try {
      const content = $(script).html()
      if (!content) return
      
      const jsonData = JSON.parse(content)
      if (Array.isArray(jsonData)) {
        results.push(...jsonData)
      } else {
        results.push(jsonData)
      }
    } catch (error) {
      log.debug?.(`Failed to parse JSON-LD: ${error}`)
    }
  })
  
  return results
}

/**
 * Get the depth of an element's child tree
 */
export function getNodeDepth($: CheerioRoot, element: cheerio.Cheerio<any>): number {
  let maxDepth = 1
  
  function traverse(elem: cheerio.Cheerio<any>, depth: number): void {
    maxDepth = Math.max(maxDepth, depth)
    
    elem.children().each((index, child) => {
      traverse($(child), depth + 1)
    })
  }
  
  traverse(element, 1)
  return maxDepth
}

/**
 * Get the level of an element in the document tree
 */
export function getLevel($: CheerioRoot, element: cheerio.Cheerio<any>): number {
  let level = 0
  let current = element
  
  while (current.parent().length > 0) {
    level++
    current = current.parent()
  }
  
  return level
}

/**
 * Check if element has high link density (indicating nav/sidebar content)
 */
export function isHighLinkDensity(
  $: CheerioRoot,
  element: cheerio.Cheerio<any>,
  language?: string
): boolean {
  const links = element.find('a, button')
  if (links.length === 0) {
    return false
  }
  
  const text = getText(element)
  const totalWords = getWordCount(text, language)
  
  if (totalWords === 0) {
    return links.length > 0
  }
  
  let linkWordsCount = 0
  links.each((index, link) => {
    const linkText = getText($(link))
    const words = getWordCount(linkText, language)
    linkWordsCount += Math.max(words, 1) // Penalize empty links
  })
  
  const proportion = (linkWordsCount * 100) / totalWords
  
  // Function that starts from 65-70% for small values (0-100 words)
  // and drops to 40-35% for 700-900+ words (flattens at 35%)
  const limitFunction = (x: number) => 87 - 70 / (1.3 + Math.exp(1 - x / 200))
  
  if (proportion > limitFunction(totalWords)) {
    return true
  }
  
  if (totalWords < 50 && links.length > 2 && proportion > 50) {
    return true // Penalize short texts with many links
  }
  
  return false
}

/**
 * Get word count from text
 */
function getWordCount(text: string, language?: string): number {
  if (!text) return 0
  
  // Simple word counting - can be enhanced with language-specific tokenizers
  const words = text.split(/\s+/).filter(word => word.trim().length > 0)
  return words.length
}

/**
 * Get or set gravity score for content extraction
 */
export function getNodeGravityScore(element: cheerio.Cheerio<any>): number {
  const score = element.attr('gravityScore')
  return score ? parseFloat(score) : 0.0
}

export function setNodeGravityScore(
  element: cheerio.Cheerio<any>,
  score: number
): void {
  element.attr('gravityScore', score.toString())
}

/**
 * Create a new element
 */
export function createElement($: CheerioRoot, tag: string, text?: string): cheerio.Cheerio<any> {
  const element = $(`<${tag}></${tag}>`)
  if (text) {
    element.text(text)
  }
  return element
}