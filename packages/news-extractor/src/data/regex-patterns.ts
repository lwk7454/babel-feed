/**
 * Common regex patterns for content extraction
 */

// Title extraction patterns
export const TITLE_PATTERNS = {
  // OpenGraph title
  OG_TITLE: /property=["\']og:title["\'][^>]*content=["\']([^"\']+)["\']|content=["\']([^"\']+)["\'][^>]*property=["\']og:title["\']]/i,
  
  // Twitter title
  TWITTER_TITLE: /name=["\']twitter:title["\'][^>]*content=["\']([^"\']+)["\']|content=["\']([^"\']+)["\'][^>]*name=["\']twitter:title["\']]/i,
  
  // Article title patterns
  ARTICLE_TITLE: /class=["\'][^"\']*title[^"\']*["\']|id=["\'][^"\']*title[^"\']*["\']|class=["\'][^"\']*headline[^"\']*["\']|id=["\'][^"\']*headline[^"\']*["\']]/i
}

// Author extraction patterns
export const AUTHOR_PATTERNS = {
  // Common author attributes
  AUTHOR_ATTR: /author|byline|writer|reporter|columnist/i,
  
  // Author rel attributes
  AUTHOR_REL: /author/i,
  
  // Byline patterns
  BYLINE: /by\s+([^,\n]+)/i
}

// Date extraction patterns
export const DATE_PATTERNS = {
  // ISO date format
  ISO_DATE: /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/,
  
  // Common date formats
  DATE_FORMATS: [
    /\d{4}-\d{2}-\d{2}/,           // YYYY-MM-DD
    /\d{2}\/\d{2}\/\d{4}/,         // MM/DD/YYYY
    /\d{2}-\d{2}-\d{4}/,           // MM-DD-YYYY
    /\d{1,2}\s+\w+\s+\d{4}/,       // D Month YYYY
    /\w+\s+\d{1,2},?\s+\d{4}/      // Month D, YYYY
  ],
  
  // URL date patterns
  URL_DATE: /\/(\d{4})\/(\d{1,2})\/(\d{1,2})\//
}

// Content cleaning patterns
export const CLEANING_PATTERNS = {
  // Navigation elements
  NAV_SELECTORS: [
    'nav', 'navigation', 'menu', 'sidebar', 'aside',
    '.nav', '.navigation', '.menu', '.sidebar', '.aside',
    '#nav', '#navigation', '#menu', '#sidebar', '#aside'
  ],
  
  // Advertisement patterns
  AD_PATTERNS: /ad|advertisement|sponsor|promo|banner|popup/i,
  
  // Social media patterns
  SOCIAL_PATTERNS: /share|social|tweet|facebook|twitter|instagram|linkedin/i,
  
  // Comment patterns
  COMMENT_PATTERNS: /comment|discussion|reply|response/i
}

// Image extraction patterns
export const IMAGE_PATTERNS = {
  // Image file extensions
  IMAGE_EXTENSIONS: /\.(jpg|jpeg|png|gif|webp|svg)$/i,
  
  // Image quality indicators
  QUALITY_INDICATORS: /large|big|main|hero|featured|primary/i,
  
  // Low quality indicators
  LOW_QUALITY: /thumb|small|icon|logo|avatar|profile/i
}

// Video extraction patterns
export const VIDEO_PATTERNS = {
  // Video file extensions
  VIDEO_EXTENSIONS: /\.(mp4|webm|ogg|avi|mov|wmv|flv)$/i,
  
  // Embedded video patterns
  YOUTUBE: /(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\s]+)/,
  VIMEO: /vimeo\.com\/(\d+)/,
  DAILYMOTION: /dailymotion\.com\/video\/([^_]+)/
}

// Language detection patterns
export const LANGUAGE_PATTERNS = {
  // Chinese characters
  CHINESE: /[\u4e00-\u9fff]+/,
  
  // Japanese characters
  JAPANESE: /[\u3040-\u309f\u30a0-\u30ff\u4e00-\u9fff]+/,
  
  // Korean characters
  KOREAN: /[\uac00-\ud7af]+/,
  
  // Arabic characters
  ARABIC: /[\u0600-\u06ff]+/,
  
  // Cyrillic characters
  CYRILLIC: /[\u0400-\u04ff]+/
}

// Content validation patterns
export const VALIDATION_PATTERNS = {
  // Minimum content length
  MIN_CONTENT: /\S{100,}/,
  
  // Paragraph structure
  PARAGRAPH: /<p[^>]*>.*?<\/p>/gi,
  
  // Sentence structure
  SENTENCE: /[.!?]+\s/g,
  
  // Word boundaries
  WORD: /\b\w+\b/g
}