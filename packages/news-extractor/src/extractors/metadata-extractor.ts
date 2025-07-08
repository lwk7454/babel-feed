/**
 * MetadataExtractor - Extract article metadata
 * Ported from Python newspaper4k metadata_extractor.py
 */

import type { CheerioAPI } from 'cheerio'
import type { Element } from 'domhandler'
import { Configuration } from '../configuration.js'
import { ArticleMetadata } from '../types.js'
import { META_LANGUAGE_TAGS } from './defines.js'
import { LanguageDetector } from '../languages/language-detector.js'

export class MetadataExtractor {
  private config: Configuration

  constructor(config: Configuration) {
    this.config = config
  }

  /**
   * Parse metadata from document
   */
  public parse(url: string, $: CheerioAPI): ArticleMetadata {
    const metadata: ArticleMetadata = {}

    // Extract Open Graph metadata
    this.extractOpenGraphMeta($, metadata)

    // Extract Twitter Card metadata
    this.extractTwitterMeta($, metadata)

    // Extract basic meta tags
    this.extractBasicMeta($, metadata)

    // Extract language
    metadata.language = this.extractLanguage($)

    // Extract canonical URL
    metadata.canonical = this.extractCanonicalUrl($, url)

    // Extract description
    if (!metadata.description) {
      metadata.description = this.extractDescription($)
    }

    // Extract keywords
    metadata.keywords = this.extractKeywords($)

    return metadata
  }

  /**
   * Extract Open Graph metadata - enhanced version
   */
  private extractOpenGraphMeta($: CheerioAPI, metadata: ArticleMetadata): void {
    const ogMeta: Record<string, string> = {}

    $('meta[property^="og:"]').each((_: number, el: Element) => {
      const property = $(el).attr('property')
      const content = $(el).attr('content')
      if (property && content) {
        const key = property.replace('og:', '')
        ogMeta[key] = content
      }
    })

    // Also check for name attribute (some sites use this)
    $('meta[name^="og:"]').each((_: number, el: Element) => {
      const name = $(el).attr('name')
      const content = $(el).attr('content')
      if (name && content) {
        const key = name.replace('og:', '')
        if (!ogMeta[key]) { // Don't override property version
          ogMeta[key] = content
        }
      }
    })

    // Map common OG properties with priority (og takes precedence)
    if (ogMeta.title && !metadata.title) metadata.title = ogMeta.title
    if (ogMeta.description && !metadata.description) metadata.description = ogMeta.description
    if (ogMeta.image && !metadata.image) metadata.image = ogMeta.image
    if (ogMeta.url && !metadata.url) metadata.url = ogMeta.url
    if (ogMeta.type) metadata.type = ogMeta.type
    if (ogMeta.site_name) metadata.siteName = ogMeta.site_name
    if (ogMeta.locale) metadata.locale = ogMeta.locale

    metadata.openGraph = ogMeta
  }

  /**
   * Extract Twitter Card metadata
   */
  private extractTwitterMeta($: CheerioAPI, metadata: ArticleMetadata): void {
    const twitterMeta: Record<string, string> = {}

    $('meta[name^="twitter:"]').each((_: number, el: Element) => {
      const name = $(el).attr('name')
      const content = $(el).attr('content')
      if (name && content) {
        const key = name.replace('twitter:', '')
        twitterMeta[key] = content
      }
    })

    // Map common Twitter properties
    if (twitterMeta.title && !metadata.title) metadata.title = twitterMeta.title
    if (twitterMeta.description && !metadata.description) metadata.description = twitterMeta.description
    if (twitterMeta.image && !metadata.image) metadata.image = twitterMeta.image

    metadata.twitter = twitterMeta
  }

  /**
   * Extract basic meta tags - enhanced version
   */
  private extractBasicMeta($: CheerioAPI, metadata: ArticleMetadata): void {
    // Description - try multiple sources
    if (!metadata.description) {
      const descSources = [
        'meta[name="description"]',
        'meta[name="Description"]',
        'meta[property="description"]',
        'meta[name="twitter:description"]'
      ]
      
      for (const selector of descSources) {
        const content = $(selector).attr('content')
        if (content && content.trim()) {
          metadata.description = content.trim()
          break
        }
      }
    }

    // Keywords - try multiple sources
    if (!metadata.keywords) {
      const keywordSources = [
        'meta[name="keywords"]',
        'meta[name="Keywords"]',
        'meta[property="keywords"]',
        'meta[name="news_keywords"]'
      ]
      
      for (const selector of keywordSources) {
        const content = $(selector).attr('content')
        if (content && content.trim()) {
          metadata.keywords = content
            .split(',')
            .map((k: string) => k.trim())
            .filter((k: string) => k.length > 0)
            .slice(0, 20) // Limit to 20 keywords
          break
        }
      }
    }

    // Author - try multiple sources
    if (!metadata.author) {
      const authorSources = [
        'meta[name="author"]',
        'meta[name="Author"]',
        'meta[property="author"]',
        'meta[name="article:author"]',
        'meta[name="dc.creator"]'
      ]
      
      for (const selector of authorSources) {
        const content = $(selector).attr('content')
        if (content && content.trim()) {
          metadata.author = content.trim()
          break
        }
      }
    }

    // Publisher - try multiple sources
    if (!metadata.publisher) {
      const publisherSources = [
        'meta[name="publisher"]',
        'meta[name="Publisher"]',
        'meta[property="publisher"]',
        'meta[name="article:publisher"]',
        'meta[name="dc.publisher"]'
      ]
      
      for (const selector of publisherSources) {
        const content = $(selector).attr('content')
        if (content && content.trim()) {
          metadata.publisher = content.trim()
          break
        }
      }
    }

    // Additional common meta tags
    const articleSection = $('meta[name="article:section"]').attr('content')
    if (articleSection) metadata.section = articleSection
    
    const articleTag = $('meta[name="article:tag"]').attr('content')
    if (articleTag) {
      metadata.tags = articleTag.split(',').map(tag => tag.trim())
    }
  }

  /**
   * Extract language using enhanced language detection
   * Integrates with Configuration language settings
   */
  private extractLanguage($: CheerioAPI): string | undefined {
    return LanguageDetector.detectWithFallback(
      $, 
      this.config.language, 
      this.config.useMetaLanguage
    )
  }

  /**
   * Extract canonical URL
   */
  private extractCanonicalUrl($: CheerioAPI, fallbackUrl: string): string {
    const canonical = $('link[rel="canonical"]').attr('href')
    return canonical || fallbackUrl
  }

  /**
   * Extract description from multiple sources
   */
  private extractDescription($: CheerioAPI): string | undefined {
    // Try meta description
    const metaDesc = $('meta[name="description"]').attr('content')
    if (metaDesc) return metaDesc

    // Try first paragraph
    const firstP = $('p').first().text().trim()
    if (firstP && firstP.length > 50) {
      return firstP.substring(0, 300) + (firstP.length > 300 ? '...' : '')
    }

    return undefined
  }

  /**
   * Extract keywords from meta tags and JSON-LD
   */
  private extractKeywords($: CheerioAPI): string[] | undefined {
    // Try meta keywords first
    const metaKeywords = $('meta[name="keywords"]').attr('content')
    if (metaKeywords) {
      return metaKeywords
        .split(',')
        .map((k: string) => k.trim())
        .filter((k: string) => k.length > 0)
        .slice(0, 20)
    }

    // Try JSON-LD structured data
    const jsonLdKeywords: string[] = []
    $('script[type="application/ld+json"]').each((_, scriptEl) => {
      try {
        const jsonData = JSON.parse($(scriptEl).text())
        this.extractKeywordsFromJsonLd(jsonData, jsonLdKeywords)
      } catch {
        // Invalid JSON, continue
      }
    })

    if (jsonLdKeywords.length > 0) {
      return jsonLdKeywords.slice(0, 20)
    }

    // Try article tags as fallback
    const articleTags = $('meta[name="article:tag"]')
    if (articleTags.length > 0) {
      const tags: string[] = []
      articleTags.each((_, tag) => {
        const content = $(tag).attr('content')
        if (content) tags.push(content.trim())
      })
      return tags.slice(0, 20)
    }

    return undefined
  }

  /**
   * Extract keywords from JSON-LD structured data
   */
  private extractKeywordsFromJsonLd(data: Record<string, unknown> | unknown[] | string, keywords: string[]): void {
    if (!data || typeof data !== 'object') return

    // Check for keywords field
    if ((data as Record<string, unknown>).keywords) {
      const kw = (data as Record<string, unknown>).keywords
      if (typeof kw === 'string') {
        keywords.push(kw)
      } else if (Array.isArray(kw)) {
        keywords.push(...kw.filter((k: unknown): k is string => typeof k === 'string'))
      }
    }

    // Check for tags field
    const tagOrTags = (data as Record<string, unknown>).tag || (data as Record<string, unknown>).tags
    if (tagOrTags) {
      const tags = tagOrTags
      if (Array.isArray(tags)) {
        for (const tag of tags) {
          if (typeof tag === 'string') {
            keywords.push(tag)
          } else if (typeof tag === 'object' && tag !== null && (tag as Record<string, unknown>).name) {
            const name = (tag as Record<string, unknown>).name
            if (typeof name === 'string') keywords.push(name)
          }
        }
      }
    }

    // Recursively search in nested objects and arrays
    if ((data as Record<string, unknown>)['@graph'] && Array.isArray((data as Record<string, unknown>)['@graph'])) {
      for (const item of (data as Record<string, unknown>)['@graph'] as unknown[]) {
        if (typeof item === 'string' || Array.isArray(item) || (typeof item === 'object' && item !== null)) {
          this.extractKeywordsFromJsonLd(item as Record<string, unknown> | unknown[] | string, keywords)
        }
      }
    }
  }
}