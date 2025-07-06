import * as cheerio from 'cheerio';
import { ArticleConfig } from '../types';

/**
 * Extracts metadata from HTML articles
 */
export class MetadataExtractor {
  private config: ArticleConfig;

  constructor(config: ArticleConfig) {
    this.config = config;
  }

  /**
   * Extract metadata from HTML
   */
  async extract(html: string): Promise<{
    description: string;
    keywords: string[];
    language: string;
    siteName: string;
    canonicalUrl: string;
  }> {
    const $ = cheerio.load(html);
    
    return {
      description: this.extractDescription($),
      keywords: this.extractKeywords($),
      language: this.extractLanguage($),
      siteName: this.extractSiteName($),
      canonicalUrl: this.extractCanonicalUrl($)
    };
  }

  /**
   * Extract meta description
   */
  private extractDescription($: cheerio.CheerioAPI): string {
    // Strategy 1: OpenGraph description
    let description = $('meta[property="og:description"]').attr('content');
    if (description) return this.cleanDescription(description);
    
    // Strategy 2: Twitter description
    description = $('meta[name="twitter:description"]').attr('content');
    if (description) return this.cleanDescription(description);
    
    // Strategy 3: Standard meta description
    description = $('meta[name="description"]').attr('content');
    if (description) return this.cleanDescription(description);
    
    // Strategy 4: Schema.org microdata
    description = $('[itemprop="description"]').first().text().trim();
    if (description) return this.cleanDescription(description);
    
    // Strategy 5: JSON-LD structured data
    $('script[type="application/ld+json"]').each((_, element) => {
      try {
        const jsonData = JSON.parse($(element).html() || '{}');
        const jsonDescription = this.extractDescriptionFromJsonLd(jsonData);
        if (jsonDescription) {
          description = jsonDescription;
        }
      } catch (error) {
        // Ignore JSON parsing errors
      }
    });
    
    if (description) return this.cleanDescription(description);
    
    // Strategy 6: First paragraph of article content
    const firstParagraph = $('article p, main p, .content p, .post p, .entry p').first().text().trim();
    if (firstParagraph && firstParagraph.length > 50 && firstParagraph.length < 500) {
      return this.cleanDescription(firstParagraph);
    }
    
    return '';
  }

  /**
   * Extract keywords from meta tags
   */
  private extractKeywords($: cheerio.CheerioAPI): string[] {
    const keywords: string[] = [];
    
    // Strategy 1: Meta keywords tag
    const metaKeywords = $('meta[name="keywords"]').attr('content');
    if (metaKeywords) {
      keywords.push(...this.parseKeywords(metaKeywords));
    }
    
    // Strategy 2: OpenGraph article tags
    $('meta[property="article:tag"]').each((_, element) => {
      const tag = $(element).attr('content');
      if (tag) keywords.push(tag.trim());
    });
    
    // Strategy 3: Schema.org keywords
    $('[itemprop="keywords"]').each((_, element) => {
      const keywordText = $(element).attr('content') || $(element).text().trim();
      if (keywordText) {
        keywords.push(...this.parseKeywords(keywordText));
      }
    });
    
    // Strategy 4: JSON-LD structured data
    $('script[type="application/ld+json"]').each((_, element) => {
      try {
        const jsonData = JSON.parse($(element).html() || '{}');
        const jsonKeywords = this.extractKeywordsFromJsonLd(jsonData);
        keywords.push(...jsonKeywords);
      } catch (error) {
        // Ignore JSON parsing errors
      }
    });
    
    // Strategy 5: Category and tag elements
    $('.tags a, .categories a, .tag a, .category a').each((_, element) => {
      const tagText = $(element).text().trim();
      if (tagText && tagText.length < 50) {
        keywords.push(tagText);
      }
    });
    
    // Clean and deduplicate keywords
    return this.cleanKeywords(keywords);
  }

  /**
   * Extract language information
   */
  private extractLanguage($: cheerio.CheerioAPI): string {
    // Strategy 1: HTML lang attribute
    let language = $('html').attr('lang');
    if (language) return this.normalizeLanguage(language);
    
    // Strategy 2: Meta content-language
    language = $('meta[http-equiv="content-language"]').attr('content');
    if (language) return this.normalizeLanguage(language);
    
    // Strategy 3: OpenGraph locale
    language = $('meta[property="og:locale"]').attr('content');
    if (language) return this.normalizeLanguage(language);
    
    // Strategy 4: Content language meta tag
    language = $('meta[name="language"]').attr('content');
    if (language) return this.normalizeLanguage(language);
    
    // Strategy 5: XML lang attribute
    language = $('html').attr('xml:lang');
    if (language) return this.normalizeLanguage(language);
    
    // Default to config language or 'en'
    return this.config.language || 'en';
  }

  /**
   * Extract site name
   */
  private extractSiteName($: cheerio.CheerioAPI): string {
    // Strategy 1: OpenGraph site name
    let siteName = $('meta[property="og:site_name"]').attr('content');
    if (siteName) return this.cleanSiteName(siteName);
    
    // Strategy 2: Twitter site
    siteName = $('meta[name="twitter:site"]').attr('content');
    if (siteName) return this.cleanSiteName(siteName);
    
    // Strategy 3: Application name
    siteName = $('meta[name="application-name"]').attr('content');
    if (siteName) return this.cleanSiteName(siteName);
    
    // Strategy 4: Schema.org publisher
    siteName = $('[itemprop="publisher"] [itemprop="name"]').text().trim();
    if (siteName) return this.cleanSiteName(siteName);
    
    // Strategy 5: JSON-LD structured data
    $('script[type="application/ld+json"]').each((_, element) => {
      try {
        const jsonData = JSON.parse($(element).html() || '{}');
        const jsonSiteName = this.extractSiteNameFromJsonLd(jsonData);
        if (jsonSiteName) {
          siteName = jsonSiteName;
        }
      } catch (error) {
        // Ignore JSON parsing errors
      }
    });
    
    if (siteName) return this.cleanSiteName(siteName);
    
    // Strategy 6: Extract from title tag
    const title = $('title').text().trim();
    if (title) {
      const titleParts = title.split(/[\|\-\u2013\u2014]/);
      if (titleParts.length > 1) {
        const lastPart = titleParts[titleParts.length - 1].trim();
        if (lastPart.length > 0 && lastPart.length < 50) {
          return this.cleanSiteName(lastPart);
        }
      }
    }
    
    return '';
  }

  /**
   * Extract canonical URL
   */
  private extractCanonicalUrl($: cheerio.CheerioAPI): string {
    // Strategy 1: Link rel="canonical"
    let canonicalUrl = $('link[rel="canonical"]').attr('href');
    if (canonicalUrl) return canonicalUrl.trim();
    
    // Strategy 2: OpenGraph URL
    canonicalUrl = $('meta[property="og:url"]').attr('content');
    if (canonicalUrl) return canonicalUrl.trim();
    
    // Strategy 3: Twitter URL
    canonicalUrl = $('meta[name="twitter:url"]').attr('content');
    if (canonicalUrl) return canonicalUrl.trim();
    
    // Strategy 4: Schema.org URL
    canonicalUrl = $('[itemprop="url"]').attr('href') || $('[itemprop="url"]').attr('content');
    if (canonicalUrl) return canonicalUrl.trim();
    
    return '';
  }

  /**
   * Extract description from JSON-LD data
   */
  private extractDescriptionFromJsonLd(jsonData: any): string | null {
    if (!jsonData) return null;
    
    // Handle arrays
    if (Array.isArray(jsonData)) {
      for (const item of jsonData) {
        const description = this.extractDescriptionFromJsonLd(item);
        if (description) return description;
      }
      return null;
    }
    
    // Common description fields
    const descriptionFields = ['description', 'abstract', 'summary'];
    
    for (const field of descriptionFields) {
      if (jsonData[field] && typeof jsonData[field] === 'string') {
        return jsonData[field];
      }
    }
    
    return null;
  }

  /**
   * Extract keywords from JSON-LD data
   */
  private extractKeywordsFromJsonLd(jsonData: any): string[] {
    const keywords: string[] = [];
    
    if (!jsonData) return keywords;
    
    // Handle arrays
    if (Array.isArray(jsonData)) {
      jsonData.forEach(item => {
        keywords.push(...this.extractKeywordsFromJsonLd(item));
      });
      return keywords;
    }
    
    // Common keyword fields
    if (jsonData.keywords) {
      if (typeof jsonData.keywords === 'string') {
        keywords.push(...this.parseKeywords(jsonData.keywords));
      } else if (Array.isArray(jsonData.keywords)) {
        jsonData.keywords.forEach((keyword: any) => {
          if (typeof keyword === 'string') {
            keywords.push(keyword);
          } else if (keyword.name) {
            keywords.push(keyword.name);
          }
        });
      }
    }
    
    // Article tags
    if (jsonData.about && Array.isArray(jsonData.about)) {
      jsonData.about.forEach((item: any) => {
        if (item.name) keywords.push(item.name);
      });
    }
    
    return keywords;
  }

  /**
   * Extract site name from JSON-LD data
   */
  private extractSiteNameFromJsonLd(jsonData: any): string | null {
    if (!jsonData) return null;
    
    // Handle arrays
    if (Array.isArray(jsonData)) {
      for (const item of jsonData) {
        const siteName = this.extractSiteNameFromJsonLd(item);
        if (siteName) return siteName;
      }
      return null;
    }
    
    // Publisher name
    if (jsonData.publisher) {
      if (typeof jsonData.publisher === 'string') {
        return jsonData.publisher;
      } else if (jsonData.publisher.name) {
        return jsonData.publisher.name;
      }
    }
    
    // Organization name
    if (jsonData['@type'] === 'Organization' && jsonData.name) {
      return jsonData.name;
    }
    
    return null;
  }

  /**
   * Parse comma/semicolon separated keywords
   */
  private parseKeywords(keywordString: string): string[] {
    return keywordString
      .split(/[,;]/)
      .map(keyword => keyword.trim())
      .filter(keyword => keyword.length > 0 && keyword.length < 100);
  }

  /**
   * Clean and validate description
   */
  private cleanDescription(description: string): string {
    if (!description) return '';
    
    // Remove extra whitespace
    let cleaned = description.replace(/\s+/g, ' ').trim();
    
    // Remove control characters
    cleaned = cleaned.replace(/[\u0000-\u001F\u007F-\u009F]/g, '');
    
    // Normalize quotes
    cleaned = cleaned.replace(/[""]/g, '"').replace(/['']/g, "'");
    
    // Truncate if too long
    const maxLength = this.config.maxText || 2000;
    if (cleaned.length > maxLength) {
      cleaned = cleaned.substring(0, maxLength).trim();
      
      // Try to end at sentence boundary
      const lastPeriod = cleaned.lastIndexOf('.');
      if (lastPeriod > maxLength * 0.8) {
        cleaned = cleaned.substring(0, lastPeriod + 1);
      }
    }
    
    return cleaned;
  }

  /**
   * Clean and deduplicate keywords
   */
  private cleanKeywords(keywords: string[]): string[] {
    const cleaned = keywords
      .map(keyword => keyword.trim())
      .filter(keyword => keyword.length > 1 && keyword.length < 100)
      .filter(keyword => !/^\d+$/.test(keyword)) // Remove pure numbers
      .map(keyword => keyword.toLowerCase());
    
    // Remove duplicates
    const unique = [...new Set(cleaned)];
    
    // Limit number of keywords
    const maxKeywords = this.config.maxKeywords || 35;
    return unique.slice(0, maxKeywords);
  }

  /**
   * Normalize language code
   */
  private normalizeLanguage(language: string): string {
    if (!language) return 'en';
    
    // Extract primary language code
    const primary = language.toLowerCase().split(/[-_]/)[0];
    
    // Map common language codes
    const languageMap: Record<string, string> = {
      'en': 'en',
      'english': 'en',
      'zh': 'zh',
      'chinese': 'zh',
      'ja': 'ja',
      'japanese': 'ja',
      'es': 'es',
      'spanish': 'es',
      'fr': 'fr',
      'french': 'fr',
      'de': 'de',
      'german': 'de',
      'it': 'it',
      'italian': 'it',
      'pt': 'pt',
      'portuguese': 'pt',
      'ru': 'ru',
      'russian': 'ru',
      'ar': 'ar',
      'arabic': 'ar',
      'ko': 'ko',
      'korean': 'ko'
    };
    
    return languageMap[primary] || primary;
  }

  /**
   * Clean site name
   */
  private cleanSiteName(siteName: string): string {
    if (!siteName) return '';
    
    // Remove extra whitespace
    let cleaned = siteName.replace(/\s+/g, ' ').trim();
    
    // Remove common prefixes/suffixes
    cleaned = cleaned.replace(/^@/, ''); // Remove @ from Twitter handles
    
    // Remove control characters
    cleaned = cleaned.replace(/[\u0000-\u001F\u007F-\u009F]/g, '');
    
    // Normalize quotes
    cleaned = cleaned.replace(/[""]/g, '"').replace(/['']/g, "'");
    
    return cleaned;
  }
}