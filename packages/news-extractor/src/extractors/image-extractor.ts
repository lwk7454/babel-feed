/**
 * ImageExtractor - Extract article images
 * Ported from Python newspaper4k image_extractor.py
 */

import type { Cheerio, CheerioAPI } from 'cheerio'
import type { Element } from 'domhandler'
import { Configuration } from '../configuration.js'
import { META_IMAGE_TAGS } from './defines.js'

interface ImageCandidate {
  url: string
  score: number
  distance?: number
}

export class ImageExtractor {
  private config: Configuration
  private topImage: string | null = null
  private metaImage: string | null = null
  private images: string[] = []
  private favicon: string | null = null

  constructor(config: Configuration) {
    this.config = config
  }

  /**
   * Main method to extract images from document - exact port from Python
   */
  public parse($: CheerioAPI, topNode: Cheerio<Element> | null, articleUrl: string): string[] {
    this.favicon = this.getFavicon($)
    this.metaImage = this.getMetaImage($)
    
    if (this.metaImage) {
      this.metaImage = this.resolveUrl(this.metaImage, articleUrl)
    }
    
    this.images = this.getImages($)
      .map(url => this.resolveUrl(url, articleUrl))
      .filter((url): url is string => url !== null && url.trim() !== '')
    
    this.topImage = this.getTopImage($, topNode, articleUrl)
    
    return this.images
  }

  /**
   * Extract favicon from website
   */
  private getFavicon($: CheerioAPI): string {
    const iconLinks = $('link[rel*="icon"]')
    if (iconLinks.length > 0) {
      const href = iconLinks.first().attr('href')
      return href || ''
    }
    return ''
  }

  /**
   * Extract image from meta tags with scoring
   */
  private getMetaImage($: CheerioAPI): string {
    const candidates: ImageCandidate[] = []
    
    for (const elem of META_IMAGE_TAGS) {
      let elements: Cheerio<Element>
      
      if (elem.value.includes('|')) {
        // Handle regex patterns like "image_src|img_src"
        const values = elem.value.split('|')
        elements = $() as Cheerio<Element>  // Empty collection
        for (const value of values) {
          elements = elements.add($(`${elem.tag}[${elem.attr}="${value}"]`) as Cheerio<Element>)
        }
      } else {
        elements = $(`${elem.tag}[${elem.attr}="${elem.value}"]`) as Cheerio<Element>
      }
      
      elements.each((_, el) => {
        const url = $(el).attr(elem.content)
        if (url) {
          candidates.push({ url, score: elem.score })
        }
      })
    }
    
    // Filter out empty URLs and sort by score
    const validCandidates = candidates
      .filter(c => c.url)
      .sort((a, b) => b.score - a.score)
    
    return validCandidates.length > 0 ? validCandidates[0].url : ''
  }

  /**
   * Get all images from document with src attribute handling
   */
  private getImages($: CheerioAPI): string[] {
    const getSrc = (img: Cheerio<Element>): string | null => {
      // Account for src, data-src and other attributes
      const element = img.get(0) as Element
      if (!element || !element.attribs) return null
      
      const srcAttrs = Object.keys(element.attribs)
        .filter(attr => attr.includes('src'))
        .map(attr => element.attribs[attr])
        .filter(src => src && !src.startsWith('data:'))
      
      // Sort to prefer http(s) URLs
      srcAttrs.sort((a, b) => {
        const aIsHttp = a.toLowerCase().startsWith('http')
        const bIsHttp = b.toLowerCase().startsWith('http')
        if (aIsHttp && !bIsHttp) return -1
        if (!aIsHttp && bIsHttp) return 1
        return 0
      })
      
      return srcAttrs.length > 0 ? srcAttrs[0] : null
    }
    
    const images: string[] = []
    $('img').each((_, img) => {
      const src = getSrc($(img))
      if (src) {
        images.push(src)
      }
    })
    
    return images
  }

  /**
   * Get top image with quality scoring and distance calculation
   */
  private getTopImage($: CheerioAPI, topNode: Cheerio<Element> | null, articleUrl: string): string {
    const nodeDistance = (node1: Cheerio<Element>, node2: Cheerio<Element>): number => {
      // Simplified distance calculation - count parent traversals
      let distance = 0
      let current = node2
      
      // Try to find common ancestor and calculate distance
      while (current.length > 0 && !current.is(node1)) {
        current = current.parent() as Cheerio<Element>
        distance++
        if (distance > 20) break // Prevent infinite loops
      }
      
      return distance
    }
    
    // Check meta image first
    if (this.metaImage) {
      // In real implementation, would check image size here
      return this.metaImage
    }
    
    const imgCandidates: Array<{ element: Cheerio<Element>, distance: number }> = []
    
    let firstValidImage: string | null = null
    
    $('img').each((_, img) => {
      const $img = $(img)
      const src = $img.attr('src')
      
      if (!src || src.startsWith('data:')) {
        return
      }
      
      if (topNode && topNode.length > 0) {
        const distance = nodeDistance(topNode, $img)
        imgCandidates.push({ element: $img, distance })
      } else {
        // If no top node, store first valid image
        if (!firstValidImage) {
          const resolvedUrl = this.resolveUrl(src, articleUrl)
          if (resolvedUrl) {
            firstValidImage = resolvedUrl
          }
        }
      }
    })
    
    // Return first valid image if no top node
    if (!topNode && firstValidImage) {
      return firstValidImage
    }
    
    // Sort by distance (closest to top node first)
    imgCandidates.sort((a, b) => a.distance - b.distance)
    
    // Return first valid image
    for (const candidate of imgCandidates) {
      const src = candidate.element.attr('src')
      if (src) {
        const resolvedUrl = this.resolveUrl(src, articleUrl)
        if (resolvedUrl) {
          return resolvedUrl
        }
      }
    }
    
    return ''
  }

  /**
   * Resolve relative URLs to absolute URLs - port of urljoin_if_valid
   */
  private resolveUrl(url: string, baseUrl: string): string | null {
    if (!url || !baseUrl) return null
    
    try {
      // Already absolute URL
      if (url.startsWith('http://') || url.startsWith('https://')) {
        return url
      }
      
      // Protocol-relative URL
      if (url.startsWith('//')) {
        const protocol = baseUrl.startsWith('https') ? 'https:' : 'http:'
        return protocol + url
      }
      
      // Relative URL - use URL constructor
      const base = new URL(baseUrl)
      const resolved = new URL(url, base)
      return resolved.toString()
    } catch {
      return null
    }
  }
  
  /**
   * Get the top image (main article image)
   */
  public get topImageUrl(): string | null {
    return this.topImage
  }
  
  /**
   * Get the meta image
   */
  public get metaImageUrl(): string | null {
    return this.metaImage
  }
  
  /**
   * Get the favicon
   */
  public get faviconUrl(): string | null {
    return this.favicon
  }
}