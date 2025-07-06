import * as cheerio from 'cheerio';
import { ArticleConfig } from '../types';

/**
 * Extracts article authors from HTML using multiple strategies
 */
export class AuthorExtractor {
  private config: ArticleConfig;

  constructor(config: ArticleConfig) {
    this.config = config;
  }

  /**
   * Extract authors from HTML
   */
  async extract(html: string): Promise<string[]> {
    const $ = cheerio.load(html);
    
    const authorCandidates = this.extractAuthorCandidates($);
    
    // Clean and deduplicate authors
    const cleanedAuthors = this.cleanAuthors(authorCandidates);
    
    // Limit number of authors
    const maxAuthors = this.config.maxAuthors || 10;
    return cleanedAuthors.slice(0, maxAuthors);
  }

  /**
   * Extract author candidates from various sources
   */
  private extractAuthorCandidates($: cheerio.CheerioAPI): string[] {
    const candidates: string[] = [];
    
    // Strategy 1: Meta tags
    const metaAuthor = $('meta[name="author"]').attr('content');
    if (metaAuthor) candidates.push(metaAuthor);
    
    const metaByline = $('meta[name="byline"]').attr('content');
    if (metaByline) candidates.push(metaByline);
    
    // Strategy 2: OpenGraph/Twitter meta
    const ogAuthor = $('meta[property="og:author"]').attr('content');
    if (ogAuthor) candidates.push(ogAuthor);
    
    const articleAuthor = $('meta[property="article:author"]').attr('content');
    if (articleAuthor) candidates.push(articleAuthor);
    
    const twitterCreator = $('meta[name="twitter:creator"]').attr('content');
    if (twitterCreator) candidates.push(twitterCreator);
    
    // Strategy 3: Schema.org microdata
    $('[itemprop="author"]').each((_, element) => {
      const authorText = $(element).text().trim();
      if (authorText) candidates.push(authorText);
    });
    
    $('[itemtype*="Person"]').each((_, element) => {
      const personName = $(element).find('[itemprop="name"]').text().trim();
      if (personName) candidates.push(personName);
    });
    
    // Strategy 4: JSON-LD structured data
    $('script[type="application/ld+json"]').each((_, element) => {
      try {
        const jsonData = JSON.parse($(element).html() || '{}');
        this.extractAuthorsFromJsonLd(jsonData, candidates);
      } catch (error) {
        // Ignore JSON parsing errors
      }
    });
    
    // Strategy 5: Rel="author" links
    $('a[rel="author"]').each((_, element) => {
      const authorText = $(element).text().trim();
      if (authorText) candidates.push(authorText);
    });
    
    // Strategy 6: Common author selectors
    const authorSelectors = [
      '.author',
      '.by-author',
      '.byline',
      '.writer',
      '.journalist',
      '.correspondent',
      '.reporter',
      '.author-name',
      '.byline-name',
      '.writer-name',
      '.post-author',
      '.entry-author',
      '.article-author',
      '.story-author',
      '.content-author',
      '.vcard .fn',
      '.hcard .fn',
      '.p-author',
      '.h-card .p-name'
    ];
    
    authorSelectors.forEach(selector => {
      $(selector).each((_, element) => {
        const authorText = $(element).text().trim();
        if (authorText) candidates.push(authorText);
      });
    });
    
    // Strategy 7: Pattern matching in text
    const bodyText = $('body').text();
    const bylinePatterns = [
      /By\s+([A-Z][a-z]+ [A-Z][a-z]+)/g,
      /Written by\s+([A-Z][a-z]+ [A-Z][a-z]+)/g,
      /Author:\s*([A-Z][a-z]+ [A-Z][a-z]+)/g,
      /Reporter:\s*([A-Z][a-z]+ [A-Z][a-z]+)/g
    ];
    
    bylinePatterns.forEach(pattern => {
      let match;
      while ((match = pattern.exec(bodyText)) !== null) {
        candidates.push(match[1]);
      }
    });
    
    return candidates.filter(author => author.length > 0);
  }

  /**
   * Extract authors from JSON-LD structured data
   */
  private extractAuthorsFromJsonLd(jsonData: any, candidates: string[]): void {
    if (!jsonData) return;
    
    // Handle arrays
    if (Array.isArray(jsonData)) {
      jsonData.forEach(item => this.extractAuthorsFromJsonLd(item, candidates));
      return;
    }
    
    // Extract author from various schema types
    if (jsonData.author) {
      if (typeof jsonData.author === 'string') {
        candidates.push(jsonData.author);
      } else if (Array.isArray(jsonData.author)) {
        jsonData.author.forEach((author: any) => {
          if (typeof author === 'string') {
            candidates.push(author);
          } else if (author.name) {
            candidates.push(author.name);
          }
        });
      } else if (jsonData.author.name) {
        candidates.push(jsonData.author.name);
      }
    }
    
    // Check for Person schema
    if (jsonData['@type'] === 'Person' && jsonData.name) {
      candidates.push(jsonData.name);
    }
    
    // Check for byline
    if (jsonData.byline) {
      if (typeof jsonData.byline === 'string') {
        candidates.push(jsonData.byline);
      } else if (jsonData.byline.name) {
        candidates.push(jsonData.byline.name);
      }
    }
  }

  /**
   * Clean and validate author names
   */
  private cleanAuthors(candidates: string[]): string[] {
    const cleaned = candidates
      .map(author => this.cleanAuthorName(author))
      .filter(author => this.isValidAuthor(author));
    
    // Remove duplicates (case-insensitive)
    const unique = [];
    const seen = new Set();
    
    for (const author of cleaned) {
      const key = author.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(author);
      }
    }
    
    return unique;
  }

  /**
   * Clean individual author name
   */
  private cleanAuthorName(author: string): string {
    if (!author) return '';
    
    // Remove extra whitespace
    let cleaned = author.replace(/\s+/g, ' ').trim();
    
    // Remove common prefixes
    cleaned = cleaned.replace(/^(By|Written by|Author|Reporter|Correspondent):\s*/i, '');
    
    // Remove email addresses
    cleaned = cleaned.replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '');
    
    // Remove URLs
    cleaned = cleaned.replace(/https?:\/\/[^\s]+/g, '');
    
    // Remove social media handles
    cleaned = cleaned.replace(/@\w+/g, '');
    
    // Remove parenthetical information
    cleaned = cleaned.replace(/\([^)]*\)/g, '');
    
    // Remove job titles and affiliations
    const jobTitlePatterns = [
      /,\s*(Staff\s+)?(Writer|Reporter|Correspondent|Editor|Journalist)/gi,
      /\s*(Staff\s+)?(Writer|Reporter|Correspondent|Editor|Journalist)$/gi
    ];
    
    jobTitlePatterns.forEach(pattern => {
      cleaned = cleaned.replace(pattern, '');
    });
    
    // Normalize punctuation
    cleaned = cleaned.replace(/[""]/g, '"').replace(/['']/g, "'");
    
    // Remove control characters
    cleaned = cleaned.replace(/[\u0000-\u001F\u007F-\u009F]/g, '');
    
    return cleaned.trim();
  }

  /**
   * Validate author name
   */
  private isValidAuthor(author: string): boolean {
    if (!author || author.length < 2) return false;
    
    // Check minimum and maximum length
    if (author.length < 2 || author.length > 100) return false;
    
    // Must contain at least one letter
    if (!/[a-zA-Z]/.test(author)) return false;
    
    // Reject if mostly numbers
    const numberRatio = (author.match(/\d/g) || []).length / author.length;
    if (numberRatio > 0.5) return false;
    
    // Reject common non-author strings
    const invalidPatterns = [
      /^(staff|admin|user|guest|anonymous|unknown|none|null|undefined)$/i,
      /^(news|breaking|update|latest|exclusive)$/i,
      /^(copyright|all rights reserved|privacy policy|terms of service)$/i,
      /^(subscribe|follow|share|comment|like)$/i,
      /^(\d+|\w{1,2}|\s+)$/,
      /^(the|a|an|and|or|but|in|on|at|to|for|of|with|by)$/i
    ];
    
    for (const pattern of invalidPatterns) {
      if (pattern.test(author)) return false;
    }
    
    // Check for reasonable name structure
    const words = author.split(/\s+/);
    
    // Names should have 1-4 words
    if (words.length > 4) return false;
    
    // Each word should be reasonable length
    const hasReasonableWords = words.every(word => 
      word.length >= 1 && word.length <= 20 && /^[a-zA-Z.\-']+$/.test(word)
    );
    
    if (!hasReasonableWords) return false;
    
    // At least one word should be capitalized (likely a proper noun)
    const hasCapitalizedWord = words.some(word => /^[A-Z]/.test(word));
    if (!hasCapitalizedWord) return false;
    
    return true;
  }
}