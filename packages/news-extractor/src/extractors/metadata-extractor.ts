/**
 * MetadataExtractor - Extract article metadata
 * Ported from Python newspaper4k metadata_extractor.py
 */

import { cheerio.CheerioAPI } from 'cheerio'
import { Configuration } from '../configuration.js'
import { ArticleMetadata } from '../types.js'
import { META_LANGUAGE_TAGS } from './defines.js'

export class MetadataExtractor {
  private config: Configuration

  constructor(config: Configuration) {
    this.config = config
  }

  /**
   * Parse metadata from document
   */
  public parse(url: string, $: cheerio.CheerioAPI): ArticleMetadata {
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
   * Extract Open Graph metadata
   */
  private extractOpenGraphMeta($: cheerio.CheerioAPI, metadata: ArticleMetadata): void {
    const ogMeta: Record<string, string> = {}

    $('meta[property^="og:"]').each((_, el) => {
      const property = $(el).attr('property')
      const content = $(el).attr('content')
      if (property && content) {
        const key = property.replace('og:', '')
        ogMeta[key] = content
      }
    })

    // Map common OG properties
    if (ogMeta.title) metadata.title = ogMeta.title
    if (ogMeta.description) metadata.description = ogMeta.description
    if (ogMeta.image) metadata.image = ogMeta.image
    if (ogMeta.url) metadata.url = ogMeta.url
    if (ogMeta.type) metadata.type = ogMeta.type
    if (ogMeta.site_name) metadata.siteName = ogMeta.site_name

    metadata.openGraph = ogMeta
  }

  /**
   * Extract Twitter Card metadata
   */
  private extractTwitterMeta($: cheerio.CheerioAPI, metadata: ArticleMetadata): void {
    const twitterMeta: Record<string, string> = {}

    $('meta[name^="twitter:"]').each((_, el) => {
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
   * Extract basic meta tags
   */
  private extractBasicMeta($: cheerio.CheerioAPI, metadata: ArticleMetadata): void {
    // Description
    if (!metadata.description) {
      const description = $('meta[name="description"]').attr('content')
      if (description) metadata.description = description
    }

    // Keywords
    const keywords = $('meta[name="keywords"]').attr('content')
    if (keywords) {
      metadata.keywords = keywords.split(',').map(k => k.trim())
    }

    // Author
    const author = $('meta[name="author"]').attr('content')
    if (author) metadata.author = author

    // Publisher
    const publisher = $('meta[name="publisher"]').attr('content')
    if (publisher) metadata.publisher = publisher
  }

  /**
   * Extract language from meta tags or HTML lang attribute
   */
  private extractLanguage($: cheerio.CheerioAPI): string | undefined {
    // Try HTML lang attribute first
    const htmlLang = $('html').attr('lang')
    if (htmlLang) {
      return htmlLang.split('-')[0] // Get just the language code
    }

    // Try meta language tags
    for (const tag of META_LANGUAGE_TAGS) {
      const content = $(`${tag.tag}[${tag.attr}="${tag.value}"]`).attr('content')
      if (content) {
        return content.split('-')[0] // Get just the language code
      }
    }

    return undefined
  }

  /**
   * Extract canonical URL
   */
  private extractCanonicalUrl($: cheerio.CheerioAPI, fallbackUrl: string): string {
    const canonical = $('link[rel="canonical"]').attr('href')
    return canonical || fallbackUrl
  }

  /**
   * Extract description from multiple sources
   */
  private extractDescription($: cheerio.CheerioAPI): string | undefined {
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
   * Extract keywords from meta tags
   */
  private extractKeywords($: cheerio.CheerioAPI): string[] | undefined {
    const keywords = $('meta[name="keywords"]').attr('content')
    if (keywords) {
      return keywords
        .split(',')
        .map(k => k.trim())
        .filter(k => k.length > 0)
        .slice(0, 20) // Limit to 20 keywords
    }

    return undefined
  }
}