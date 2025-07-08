/**
 * ImageExtractor - Extract article images
 * Ported from Python newspaper4k image_extractor.py
 */

import { cheerio.CheerioAPI, Cheerio, Element } from 'cheerio'
import { Configuration } from '../configuration.js'
import { META_IMAGE_TAGS } from './defines.js'

export class ImageExtractor {
  private config: Configuration

  constructor(config: Configuration) {
    this.config = config
  }

  /**
   * Parse images from document
   */
  public parse($: cheerio.CheerioAPI, topNode: Cheerio<Element> | null, baseUrl: string): string[] {
    const images: Set<string> = new Set()

    // Try meta tags first (highest priority)
    this.extractImagesFromMeta($, baseUrl).forEach(img => images.add(img))

    // Try images in top node (article content)
    if (topNode) {
      this.extractImagesFromNode(topNode, baseUrl).forEach(img => images.add(img))
    }

    // Try all images as fallback
    if (images.size === 0) {
      this.extractImagesFromDocument($, baseUrl).forEach(img => images.add(img))
    }

    return Array.from(images).slice(0, 10) // Limit to 10 images
  }

  /**
   * Extract images from meta tags
   */
  private extractImagesFromMeta($: cheerio.CheerioAPI, baseUrl: string): string[] {
    const images: string[] = []

    META_IMAGE_TAGS.forEach(tag => {
      const selector = `${tag.tag}[${tag.attr}="${tag.value}"]`
      const elements = $(selector)

      elements.each((_, el) => {
        const url = $(el).attr(tag.content)
        if (url) {
          const absoluteUrl = this.resolveUrl(url, baseUrl)
          if (absoluteUrl && this.isValidImageUrl(absoluteUrl)) {
            images.push(absoluteUrl)
          }
        }
      })
    })

    return images
  }

  /**
   * Extract images from a specific node
   */
  private extractImagesFromNode(node: Cheerio<Element>, baseUrl: string): string[] {
    const images: string[] = []

    node.find('img').each((_, img) => {
      const src = node.constructor(img).attr('src')
      if (src) {
        const absoluteUrl = this.resolveUrl(src, baseUrl)
        if (absoluteUrl && this.isValidImageUrl(absoluteUrl)) {
          images.push(absoluteUrl)
        }
      }
    })

    return images
  }

  /**
   * Extract all images from document
   */
  private extractImagesFromDocument($: cheerio.CheerioAPI, baseUrl: string): string[] {
    const images: string[] = []

    $('img').each((_, img) => {
      const src = $(img).attr('src')
      if (src) {
        const absoluteUrl = this.resolveUrl(src, baseUrl)
        if (absoluteUrl && this.isValidImageUrl(absoluteUrl)) {
          images.push(absoluteUrl)
        }
      }
    })

    return images
  }

  /**
   * Resolve relative URLs to absolute URLs
   */
  private resolveUrl(url: string, baseUrl: string): string | null {
    try {
      if (url.startsWith('http')) {
        return url
      }
      
      if (url.startsWith('//')) {
        const protocol = baseUrl.startsWith('https') ? 'https:' : 'http:'
        return protocol + url
      }

      const base = new URL(baseUrl)
      const resolved = new URL(url, base)
      return resolved.toString()
    } catch {
      return null
    }
  }

  /**
   * Check if URL is a valid image URL
   */
  private isValidImageUrl(url: string): boolean {
    if (!url) return false

    // Check file extension
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp']
    const hasImageExtension = imageExtensions.some(ext => 
      url.toLowerCase().includes(ext)
    )

    if (hasImageExtension) return true

    // Check if URL contains image-related keywords
    const imageKeywords = ['image', 'img', 'photo', 'picture', 'pic']
    const hasImageKeyword = imageKeywords.some(keyword => 
      url.toLowerCase().includes(keyword)
    )

    return hasImageKeyword
  }
}