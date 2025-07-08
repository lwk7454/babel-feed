/**
 * URL processing utilities
 * Ported from Python newspaper4k urls.py
 */

import { URL } from 'url'
// Using require for tldjs to avoid type issues
const tldjs = require('tldjs')

const log = console // TODO: Replace with proper logging

/**
 * Valid news URL patterns
 */
const NEWS_URL_PATTERNS = [
  /\/\d{4}\/\d{1,2}\/\d{1,2}\//,  // Date patterns like /2024/01/15/
  /\/article[s]?\//,               // /articles/ or /article/
  /\/news\//,                      // /news/
  /\/story\//,                     // /story/
  /\/post[s]?\//,                  // /posts/ or /post/
  /\/blog\//,                      // /blog/
  /\/\d{4}-\d{2}-\d{2}/,          // Date patterns like /2024-01-15/
  /\/p\/[\w-]+/,                   // Medium-style /p/article-title
  /\/@[\w-]+\/[\w-]+/,            // Medium-style /@author/article-title
]

/**
 * Check if URL is valid
 */
export function isValidUrl(url: string): boolean {
  try {
    new URL(url)
    return true
  } catch {
    return false
  }
}

/**
 * Normalize URL by removing fragments and cleaning parameters
 */
export function normalizeUrl(url: string): string {
  try {
    const parsed = new URL(url)
    
    // Remove fragment
    parsed.hash = ''
    
    // Remove common tracking parameters
    const trackingParams = [
      'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
      'gclid', 'fbclid', 'msclkid', '_ga', 'mc_cid', 'mc_eid'
    ]
    
    trackingParams.forEach(param => {
      parsed.searchParams.delete(param)
    })
    
    return parsed.toString()
  } catch {
    return url
  }
}

/**
 * Check if URL looks like a news article
 */
export function isNewsUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    const pathname = parsed.pathname.toLowerCase()
    
    // Check against news URL patterns
    return NEWS_URL_PATTERNS.some(pattern => pattern.test(pathname))
  } catch {
    return false
  }
}

/**
 * Extract domain from URL
 */
export function getDomain(url: string): string | null {
  try {
    const parsed = new URL(url)
    return parsed.hostname
  } catch {
    return null
  }
}

/**
 * Get top-level domain info
 */
export function getTldInfo(url: string): { domain: string; tld: string; subdomain: string } | null {
  try {
    const result = tldjs.parse(url)
    return {
      domain: result.domain || '',
      tld: result.tld || '',
      subdomain: result.subdomain || ''
    }
  } catch {
    return null
  }
}

/**
 * Extract date from URL path
 */
export function extractDateFromUrl(url: string): Date | null {
  try {
    const parsed = new URL(url)
    const pathname = parsed.pathname
    
    // Try different date patterns
    const patterns = [
      /\/(\d{4})\/(\d{1,2})\/(\d{1,2})\//,     // /2024/01/15/
      /\/(\d{4})-(\d{2})-(\d{2})/,             // /2024-01-15/
      /\/(\d{4})(\d{2})(\d{2})/,               // /20240115/
      /\/(\d{2})\/(\d{2})\/(\d{4})/,           // /01/15/2024/
    ]
    
    for (const pattern of patterns) {
      const match = pathname.match(pattern)
      if (match) {
        let year: number, month: number, day: number
        
        if (pattern === patterns[3]) {
          // MM/DD/YYYY format
          [, month, day, year] = match.map(Number)
        } else {
          // YYYY/MM/DD or YYYY-MM-DD formats
          [, year, month, day] = match.map(Number)
        }
        
        // Validate date
        if (year >= 1990 && year <= new Date().getFullYear() + 1 &&
            month >= 1 && month <= 12 &&
            day >= 1 && day <= 31) {
          return new Date(year, month - 1, day)
        }
      }
    }
    
    return null
  } catch {
    return null
  }
}

/**
 * Check if URL is from a major news source
 */
export function isMajorNewsSource(url: string): boolean {
  const majorNewsDomains = [
    'cnn.com', 'bbc.co.uk', 'bbc.com', 'reuters.com', 'ap.org',
    'nytimes.com', 'washingtonpost.com', 'wsj.com', 'usatoday.com',
    'abcnews.go.com', 'cbsnews.com', 'nbcnews.com', 'foxnews.com',
    'theguardian.com', 'telegraph.co.uk', 'independent.co.uk',
    'time.com', 'newsweek.com', 'bloomberg.com', 'forbes.com',
    'politico.com', 'huffpost.com', 'axios.com', 'vox.com',
    'buzzfeednews.com', 'npr.org', 'pbs.org'
  ]
  
  try {
    const domain = getDomain(url)
    if (!domain) return false
    
    return majorNewsDomains.some(newsDomain => 
      domain === newsDomain || domain.endsWith('.' + newsDomain)
    )
  } catch {
    return false
  }
}

/**
 * Generate canonical URL for article
 */
export function getCanonicalUrl(url: string, canonicalLink?: string): string {
  if (canonicalLink && isValidUrl(canonicalLink)) {
    return normalizeUrl(canonicalLink)
  }
  
  return normalizeUrl(url)
}

/**
 * Check if URL has suspicious characteristics
 */
export function isSuspiciousUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    const pathname = parsed.pathname.toLowerCase()
    const hostname = parsed.hostname.toLowerCase()
    
    // Check for suspicious patterns
    const suspiciousPatterns = [
      /\.(jpg|jpeg|png|gif|pdf|doc|docx|zip|rar)$/i,  // File extensions
      /\/wp-content\//,                                 // WordPress media
      /\/wp-admin\//,                                   // WordPress admin
      /\/admin\//,                                      // Admin pages
      /\/api\//,                                        // API endpoints
      /\/search\?/,                                     // Search pages
      /\/tag\//,                                        // Tag pages
      /\/category\//,                                   // Category pages
      /\/author\//,                                     // Author pages
      /\/login/,                                        // Login pages
      /\/register/,                                     // Registration pages
    ]
    
    if (suspiciousPatterns.some(pattern => pattern.test(pathname))) {
      return true
    }
    
    // Check for suspicious domains
    const suspiciousDomains = [
      'facebook.com', 'twitter.com', 'instagram.com', 'linkedin.com',
      'youtube.com', 'tiktok.com', 'pinterest.com'
    ]
    
    if (suspiciousDomains.some(domain => hostname.includes(domain))) {
      return true
    }
    
    return false
  } catch {
    return true // If URL is malformed, consider it suspicious
  }
}

/**
 * Resolve relative URL against base URL
 */
export function resolveUrl(baseUrl: string, relativeUrl: string): string {
  try {
    return new URL(relativeUrl, baseUrl).toString()
  } catch {
    return relativeUrl
  }
}

/**
 * Extract all URLs from text
 */
export function extractUrls(text: string): string[] {
  const urlRegex = /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/g
  const matches = text.match(urlRegex)
  return matches ? matches.filter(isValidUrl) : []
}