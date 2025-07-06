import * as cheerio from 'cheerio';
import { parse, isValid } from 'date-fns';
import { ArticleConfig } from '../types';

/**
 * Extracts article publication date from HTML using multiple strategies
 */
export class DateExtractor {
  private config: ArticleConfig;

  constructor(config: ArticleConfig) {
    this.config = config;
  }

  /**
   * Extract publication date from HTML
   */
  async extract(html: string, url: string): Promise<Date | null> {
    const $ = cheerio.load(html);
    
    const dateCandidates = this.extractDateCandidates($, url);
    
    // Parse and validate dates
    const validDates = this.parseDates(dateCandidates);
    
    if (validDates.length === 0) {
      return null;
    }
    
    // Select best date
    return this.selectBestDate(validDates);
  }

  /**
   * Extract date candidates from various sources
   */
  private extractDateCandidates($: cheerio.CheerioAPI, url: string): string[] {
    const candidates: string[] = [];
    
    // Strategy 1: HTML time elements
    $('time[datetime]').each((_, element) => {
      const datetime = $(element).attr('datetime');
      if (datetime) candidates.push(datetime);
    });
    
    $('time').each((_, element) => {
      const timeText = $(element).text().trim();
      if (timeText) candidates.push(timeText);
    });
    
    // Strategy 2: Meta tags
    const metaDateSelectors = [
      'meta[property="article:published_time"]',
      'meta[property="article:created_time"]',
      'meta[property="og:updated_time"]',
      'meta[property="og:published_time"]',
      'meta[name="publication_date"]',
      'meta[name="publishdate"]',
      'meta[name="date"]',
      'meta[name="DC.date.issued"]',
      'meta[name="dc.date.issued"]',
      'meta[name="dcterms.date"]',
      'meta[name="dcterms.created"]',
      'meta[name="dcterms.modified"]'
    ];
    
    metaDateSelectors.forEach(selector => {
      const content = $(selector).attr('content');
      if (content) candidates.push(content);
    });
    
    // Strategy 3: Schema.org microdata
    $('[itemprop="datePublished"]').each((_, element) => {
      const dateText = $(element).attr('datetime') || $(element).text().trim();
      if (dateText) candidates.push(dateText);
    });
    
    $('[itemprop="dateCreated"]').each((_, element) => {
      const dateText = $(element).attr('datetime') || $(element).text().trim();
      if (dateText) candidates.push(dateText);
    });
    
    $('[itemprop="dateModified"]').each((_, element) => {
      const dateText = $(element).attr('datetime') || $(element).text().trim();
      if (dateText) candidates.push(dateText);
    });
    
    // Strategy 4: JSON-LD structured data
    $('script[type="application/ld+json"]').each((_, element) => {
      try {
        const jsonData = JSON.parse($(element).html() || '{}');
        this.extractDatesFromJsonLd(jsonData, candidates);
      } catch (error) {
        // Ignore JSON parsing errors
      }
    });
    
    // Strategy 5: Common date selectors
    const dateSelectors = [
      '.date',
      '.publish-date',
      '.published-date',
      '.publication-date',
      '.post-date',
      '.entry-date',
      '.article-date',
      '.story-date',
      '.timestamp',
      '.time',
      '.created',
      '.updated',
      '.byline-date',
      '.meta-date',
      '.date-published',
      '.date-created'
    ];
    
    dateSelectors.forEach(selector => {
      $(selector).each((_, element) => {
        const dateText = $(element).attr('datetime') || $(element).text().trim();
        if (dateText) candidates.push(dateText);
      });
    });
    
    // Strategy 6: URL date extraction
    const urlDate = this.extractDateFromUrl(url);
    if (urlDate) candidates.push(urlDate);
    
    // Strategy 7: Text pattern matching
    const bodyText = $('body').text();
    const datePatterns = this.extractDatePatterns(bodyText);
    candidates.push(...datePatterns);
    
    return candidates.filter(date => date.length > 0);
  }

  /**
   * Extract dates from JSON-LD structured data
   */
  private extractDatesFromJsonLd(jsonData: any, candidates: string[]): void {
    if (!jsonData) return;
    
    // Handle arrays
    if (Array.isArray(jsonData)) {
      jsonData.forEach(item => this.extractDatesFromJsonLd(item, candidates));
      return;
    }
    
    // Common date fields
    const dateFields = [
      'datePublished',
      'dateCreated',
      'dateModified',
      'publishedDate',
      'createdDate',
      'modifiedDate',
      'uploadDate',
      'releaseDate'
    ];
    
    dateFields.forEach(field => {
      if (jsonData[field]) {
        candidates.push(jsonData[field]);
      }
    });
  }

  /**
   * Extract date from URL patterns
   */
  private extractDateFromUrl(url: string): string | null {
    // Common URL date patterns
    const patterns = [
      /\/(\d{4})\/(\d{1,2})\/(\d{1,2})\//,  // /2023/12/25/
      /\/(\d{4})-(\d{1,2})-(\d{1,2})\//,    // /2023-12-25/
      /\/(\d{4})(\d{2})(\d{2})\//,          // /20231225/
      /\/(\d{4})\/(\d{1,2})\//,             // /2023/12/
      /\/(\d{4})-(\d{1,2})\//,              // /2023-12/
      /\/(\d{4})(\d{2})\//,                 // /202312/
      /\/(\d{4})\//,                        // /2023/
      /\?date=(\d{4}-\d{1,2}-\d{1,2})/,     // ?date=2023-12-25
      /\&date=(\d{4}-\d{1,2}-\d{1,2})/      // &date=2023-12-25
    ];
    
    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) {
        if (match.length === 4) {
          // Year, month, day
          return `${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}`;
        } else if (match.length === 3) {
          // Year, month
          return `${match[1]}-${match[2].padStart(2, '0')}-01`;
        } else if (match.length === 2) {
          // Year only or full date
          return match[1];
        }
      }
    }
    
    return null;
  }

  /**
   * Extract date patterns from text
   */
  private extractDatePatterns(text: string): string[] {
    const patterns: string[] = [];
    
    // Common date patterns
    const dateRegexes = [
      /\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4}\b/gi,
      /\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\.?\s+\d{1,2},?\s+\d{4}\b/gi,
      /\b\d{1,2}\/\d{1,2}\/\d{4}\b/g,
      /\b\d{1,2}-\d{1,2}-\d{4}\b/g,
      /\b\d{4}-\d{1,2}-\d{1,2}\b/g,
      /\b\d{1,2}\.\d{1,2}\.\d{4}\b/g,
      /\b\d{4}\/\d{1,2}\/\d{1,2}\b/g
    ];
    
    dateRegexes.forEach(regex => {
      let match;
      while ((match = regex.exec(text)) !== null) {
        patterns.push(match[0]);
      }
    });
    
    return patterns;
  }

  /**
   * Parse date strings into Date objects
   */
  private parseDates(candidates: string[]): Date[] {
    const validDates: Date[] = [];
    
    for (const candidate of candidates) {
      const date = this.parseDate(candidate);
      if (date && isValid(date)) {
        validDates.push(date);
      }
    }
    
    return validDates;
  }

  /**
   * Parse individual date string
   */
  private parseDate(dateString: string): Date | null {
    if (!dateString || dateString.length < 4) return null;
    
    // Clean the date string
    const cleaned = dateString.trim().replace(/\s+/g, ' ');
    
    // Try different parsing strategies
    const strategies = [
      // ISO 8601 formats
      () => new Date(cleaned),
      
      // RFC 2822 format
      () => new Date(cleaned),
      
      // Common formats with date-fns
      () => parse(cleaned, 'yyyy-MM-dd', new Date()),
      () => parse(cleaned, 'yyyy/MM/dd', new Date()),
      () => parse(cleaned, 'MM/dd/yyyy', new Date()),
      () => parse(cleaned, 'dd/MM/yyyy', new Date()),
      () => parse(cleaned, 'MM-dd-yyyy', new Date()),
      () => parse(cleaned, 'dd-MM-yyyy', new Date()),
      () => parse(cleaned, 'yyyy.MM.dd', new Date()),
      () => parse(cleaned, 'dd.MM.yyyy', new Date()),
      () => parse(cleaned, 'MMMM d, yyyy', new Date()),
      () => parse(cleaned, 'MMM d, yyyy', new Date()),
      () => parse(cleaned, 'MMMM dd, yyyy', new Date()),
      () => parse(cleaned, 'MMM dd, yyyy', new Date()),
      () => parse(cleaned, 'd MMMM yyyy', new Date()),
      () => parse(cleaned, 'dd MMMM yyyy', new Date()),
      () => parse(cleaned, 'd MMM yyyy', new Date()),
      () => parse(cleaned, 'dd MMM yyyy', new Date()),
      
      // With time
      () => parse(cleaned, 'yyyy-MM-dd HH:mm:ss', new Date()),
      () => parse(cleaned, 'yyyy-MM-dd HH:mm', new Date()),
      () => parse(cleaned, 'MM/dd/yyyy HH:mm:ss', new Date()),
      () => parse(cleaned, 'MM/dd/yyyy HH:mm', new Date()),
      () => parse(cleaned, 'dd/MM/yyyy HH:mm:ss', new Date()),
      () => parse(cleaned, 'dd/MM/yyyy HH:mm', new Date()),
      
      // Time zones
      () => parse(cleaned.replace(/\s+[A-Z]{3,4}$/, ''), 'yyyy-MM-dd HH:mm:ss', new Date()),
      () => parse(cleaned.replace(/\s+[+-]\d{4}$/, ''), 'yyyy-MM-dd HH:mm:ss', new Date()),
      
      // Relative dates (limited support)
      () => this.parseRelativeDate(cleaned)
    ];
    
    for (const strategy of strategies) {
      try {
        const result = strategy();
        if (result && isValid(result)) {
          return result;
        }
      } catch (error) {
        // Continue to next strategy
      }
    }
    
    return null;
  }

  /**
   * Parse relative date strings
   */
  private parseRelativeDate(dateString: string): Date | null {
    const now = new Date();
    const lowerCase = dateString.toLowerCase();
    
    // Today/yesterday/tomorrow
    if (lowerCase.includes('today')) {
      return now;
    }
    if (lowerCase.includes('yesterday')) {
      return new Date(now.getTime() - 24 * 60 * 60 * 1000);
    }
    if (lowerCase.includes('tomorrow')) {
      return new Date(now.getTime() + 24 * 60 * 60 * 1000);
    }
    
    // Hours/minutes ago
    const hoursAgoMatch = lowerCase.match(/(\d+)\s*hours?\s*ago/);
    if (hoursAgoMatch) {
      const hours = parseInt(hoursAgoMatch[1]);
      return new Date(now.getTime() - hours * 60 * 60 * 1000);
    }
    
    const minutesAgoMatch = lowerCase.match(/(\d+)\s*minutes?\s*ago/);
    if (minutesAgoMatch) {
      const minutes = parseInt(minutesAgoMatch[1]);
      return new Date(now.getTime() - minutes * 60 * 1000);
    }
    
    // Days ago
    const daysAgoMatch = lowerCase.match(/(\d+)\s*days?\s*ago/);
    if (daysAgoMatch) {
      const days = parseInt(daysAgoMatch[1]);
      return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    }
    
    return null;
  }

  /**
   * Select best date from valid candidates
   */
  private selectBestDate(dates: Date[]): Date {
    if (dates.length === 1) return dates[0];
    
    const now = new Date();
    const twoYearsAgo = new Date(now.getFullYear() - 2, now.getMonth(), now.getDate());
    const oneWeekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    
    // Filter dates to reasonable range
    const reasonableDates = dates.filter(date => 
      date >= twoYearsAgo && date <= oneWeekFromNow
    );
    
    if (reasonableDates.length === 0) {
      // If no reasonable dates, return the most recent one
      return dates.reduce((latest, current) => 
        current > latest ? current : latest
      );
    }
    
    if (reasonableDates.length === 1) {
      return reasonableDates[0];
    }
    
    // Prefer publication dates over modification dates
    // For now, just return the most recent reasonable date
    return reasonableDates.reduce((latest, current) => 
      current > latest ? current : latest
    );
  }
}