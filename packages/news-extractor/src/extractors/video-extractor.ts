/**
 * VideoExtractor - Extract video URLs
 * Ported from Python newspaper4k videos_extractor.py
 */

import type { Cheerio, CheerioAPI } from 'cheerio'
import type { Element } from 'domhandler'
import { Configuration } from '../configuration.js'

export class VideoExtractor {
  private config: Configuration

  constructor(config: Configuration) {
    this.config = config
  }

  /**
   * Parse videos from document
   */
  public parse($: CheerioAPI, topNode: Cheerio<Element> | null): string[] {
    const videos: Set<string> = new Set()

    // Try videos in top node first
    if (topNode) {
      this.extractVideosFromNode(topNode, $).forEach(video => videos.add(video))
    }

    // Try structured data
    this.extractVideosFromStructuredData($).forEach(video => videos.add(video))

    // Try embed codes
    this.extractEmbeddedVideos($).forEach(video => videos.add(video))

    return Array.from(videos).slice(0, 5) // Limit to 5 videos
  }

  /**
   * Extract videos from a specific node
   */
  private extractVideosFromNode(node: Cheerio<Element>, $: CheerioAPI): string[] {
    const videos: string[] = []

    // Check for video tags
    node.find('video').each((_, video) => {
      const src = $(video).attr('src')
      if (src && this.isValidVideoUrl(src)) {
        videos.push(src)
      }

      // Check source tags within video
      $(video).find('source').each((_, source) => {
        const srcUrl = $(source).attr('src')
        if (srcUrl && this.isValidVideoUrl(srcUrl)) {
          videos.push(srcUrl)
        }
      })
    })

    // Check for iframe embeds
    node.find('iframe').each((_, iframe) => {
      const src = $(iframe).attr('src')
      if (src && this.isVideoEmbed(src)) {
        videos.push(src)
      }
    })

    return videos
  }

  /**
   * Extract videos from JSON-LD structured data
   */
  private extractVideosFromStructuredData($: CheerioAPI): string[] {
    const videos: string[] = []

    $('script[type="application/ld+json"]').each((_, el) => {
      try {
        const jsonData = JSON.parse($(el).text())
        const videoUrls = this.findVideosInJsonData(jsonData)
        videos.push(...videoUrls)
      } catch {
        // Invalid JSON, continue
      }
    })

    return videos
  }

  /**
   * Extract embedded videos (YouTube, Vimeo, etc.)
   */
  private extractEmbeddedVideos($: CheerioAPI): string[] {
    const videos: string[] = []

    // YouTube embeds
    $('iframe[src*="youtube.com"], iframe[src*="youtu.be"]').each((_, iframe) => {
      const src = $(iframe).attr('src')
      if (src) videos.push(src)
    })

    // Vimeo embeds
    $('iframe[src*="vimeo.com"]').each((_, iframe) => {
      const src = $(iframe).attr('src')
      if (src) videos.push(src)
    })

    // Dailymotion embeds
    $('iframe[src*="dailymotion.com"]').each((_, iframe) => {
      const src = $(iframe).attr('src')
      if (src) videos.push(src)
    })

    // Twitter video embeds
    $('iframe[src*="twitter.com"]').each((_, iframe) => {
      const src = $(iframe).attr('src')
      if (src) videos.push(src)
    })

    return videos
  }

  /**
   * Find videos in JSON-LD data recursively
   */
  private findVideosInJsonData(data: unknown): string[] {
    const videos: string[] = []

    if (!data || typeof data !== 'object') return videos

    // Type assertion for object access
    const obj = data as Record<string, unknown>

    // Check for video-specific fields
    const videoFields = ['contentUrl', 'embedUrl', 'url', 'video']
    
    for (const field of videoFields) {
      if (Object.prototype.hasOwnProperty.call(obj, field)) {
        const value = obj[field]
        if (typeof value === 'string' && this.isValidVideoUrl(value)) {
          videos.push(value)
        } else if (Array.isArray(value)) {
          value.forEach((item) => {
            if (typeof item === 'string' && this.isValidVideoUrl(item)) {
              videos.push(item)
            }
          })
        }
      }
    }

    // Check for VideoObject schema
    if (obj['@type'] === 'VideoObject') {
      if (typeof obj.contentUrl === 'string') videos.push(obj.contentUrl)
      if (typeof obj.embedUrl === 'string') videos.push(obj.embedUrl)
      if (typeof obj.url === 'string') videos.push(obj.url)
    }

    // Recursive search in nested objects
    for (const key in obj) {
      if (typeof obj[key] === 'object' && obj[key] !== null) {
        const nestedVideos = this.findVideosInJsonData(obj[key])
        videos.push(...nestedVideos)
      }
    }

    return videos
  }

  /**
   * Check if URL is a valid video URL
   */
  private isValidVideoUrl(url: string): boolean {
    if (!url) return false

    // Check file extensions
    const videoExtensions = ['.mp4', '.webm', '.ogg', '.avi', '.mov', '.wmv', '.flv']
    const hasVideoExtension = videoExtensions.some(ext => 
      url.toLowerCase().includes(ext)
    )

    if (hasVideoExtension) return true

    // Check if it's a video embed
    return this.isVideoEmbed(url)
  }

  /**
   * Check if URL is a video embed
   */
  private isVideoEmbed(url: string): boolean {
    if (!url) return false

    const videoHosts = [
      'youtube.com',
      'youtu.be',
      'vimeo.com',
      'dailymotion.com',
      'twitch.tv',
      'facebook.com/video',
      'instagram.com/p',
      'tiktok.com'
    ]

    return videoHosts.some(host => url.toLowerCase().includes(host))
  }
}