import * as cheerio from 'cheerio';
import { ArticleConfig } from '../types';
import { TextUtils } from '../utils/text-utils';

/**
 * Extracts article title from HTML using multiple strategies
 */
export class TitleExtractor {
  private config: ArticleConfig;

  constructor(config: ArticleConfig) {
    this.config = config;
  }

  /**
   * Extract title from HTML
   */
  async extract(html: string, articleText: string = ''): Promise<string> {
    const $ = cheerio.load(html);
    
    const titleCandidates = this.extractTitleCandidates($, articleText);
    
    if (titleCandidates.length === 0) {
      return '';
    }
    
    // Select best title
    const bestTitle = this.selectBestTitle(titleCandidates);
    
    return this.cleanTitle(bestTitle);
  }

  /**
   * Extract title candidates from various sources
   */
  private extractTitleCandidates($: cheerio.CheerioAPI, articleText: string): string[] {
    const candidates: string[] = [];
    
    // Strategy 1: OpenGraph title
    const ogTitle = $('meta[property="og:title"]').attr('content');
    if (ogTitle) candidates.push(ogTitle);
    
    // Strategy 2: Twitter title
    const twitterTitle = $('meta[name="twitter:title"]').attr('content');
    if (twitterTitle) candidates.push(twitterTitle);
    
    // Strategy 3: HTML title tag
    const htmlTitle = $('title').text().trim();
    if (htmlTitle) candidates.push(htmlTitle);
    
    // Strategy 4: H1 tags
    $('h1').each((_, element) => {
      const h1Text = $(element).text().trim();
      if (h1Text) candidates.push(h1Text);
    });
    
    // Strategy 5: Article title selectors
    const articleTitleSelectors = [
      'h1.title',
      'h1.headline',
      'h1.entry-title',
      'h1.post-title',
      'h1.article-title',
      '.title h1',
      '.headline h1',
      '.entry-title h1',
      '.post-title h1',
      '.article-title h1',
      '[class*="title"]:first-child',
      '[class*="headline"]:first-child',
      'header h1',
      'article h1:first-child'
    ];
    
    articleTitleSelectors.forEach(selector => {
      const titleElement = $(selector).first();
      if (titleElement.length > 0) {
        const titleText = titleElement.text().trim();
        if (titleText) candidates.push(titleText);
      }
    });
    
    // Strategy 6: Largest text in first part of article
    if (articleText) {
      const firstParagraph = articleText.split('\n')[0];
      if (firstParagraph && firstParagraph.length > 20 && firstParagraph.length < 200) {
        candidates.push(firstParagraph);
      }
    }
    
    return candidates.filter(title => title.length > 0);
  }

  /**
   * Select best title from candidates
   */
  private selectBestTitle(candidates: string[]): string {
    if (candidates.length === 0) return '';
    if (candidates.length === 1) return candidates[0];
    
    // Score each candidate
    const scoredCandidates = candidates.map(title => ({
      title,
      score: this.scoreTitle(title)
    }));
    
    // Sort by score descending
    scoredCandidates.sort((a, b) => b.score - a.score);
    
    return scoredCandidates[0].title;
  }

  /**
   * Score title candidate
   */
  private scoreTitle(title: string): number {
    let score = 0;
    
    // Length scoring (prefer moderate length)
    const length = title.length;
    if (length >= 30 && length <= 100) {
      score += 10;
    } else if (length >= 20 && length <= 150) {
      score += 5;
    } else if (length < 10 || length > 200) {
      score -= 5;
    }
    
    // Word count scoring
    const wordCount = TextUtils.countWords(title);
    if (wordCount >= 5 && wordCount <= 15) {
      score += 5;
    } else if (wordCount >= 3 && wordCount <= 20) {
      score += 2;
    }
    
    // Penalty for site names and common patterns
    const lowerTitle = title.toLowerCase();
    const sitePenaltyPatterns = [
      /home\s*[\|\-]/,
      /welcome\s*[\|\-]/,
      /[\|\-]\s*home$/,
      /[\|\-]\s*welcome$/,
      /news\s*[\|\-]/,
      /[\|\-]\s*news$/,
      /breaking\s*[\|\-]/,
      /[\|\-]\s*breaking$/
    ];
    
    sitePenaltyPatterns.forEach(pattern => {
      if (pattern.test(lowerTitle)) {
        score -= 3;
      }
    });
    
    // Bonus for title-like patterns
    const titleBonusPatterns = [
      /^[A-Z]/, // Starts with capital
      /[.!?]$/, // Ends with punctuation
      /\w+:\s*\w+/ // Contains colon (often in headlines)
    ];
    
    titleBonusPatterns.forEach(pattern => {
      if (pattern.test(title)) {
        score += 2;
      }
    });
    
    // Penalty for excessive punctuation
    const punctuationRatio = (title.match(/[^\w\s]/g) || []).length / title.length;
    if (punctuationRatio > 0.2) {
      score -= 5;
    }
    
    // Penalty for all caps
    if (title === title.toUpperCase() && title.length > 10) {
      score -= 5;
    }
    
    // Penalty for excessive repetition
    const words = title.split(/\s+/);
    const uniqueWords = new Set(words.map(w => w.toLowerCase()));
    if (words.length > 3 && uniqueWords.size / words.length < 0.6) {
      score -= 3;
    }
    
    return score;
  }

  /**
   * Clean and normalize title
   */
  private cleanTitle(title: string): string {
    if (!title) return '';
    
    // Remove extra whitespace
    let cleaned = title.replace(/\s+/g, ' ').trim();
    
    // Remove site name patterns
    cleaned = this.removeSiteName(cleaned);
    
    // Remove common prefixes/suffixes
    cleaned = this.removeCommonPrefixes(cleaned);
    
    // Normalize punctuation
    cleaned = cleaned.replace(/[""]/g, '"').replace(/['']/g, "'");
    
    // Remove control characters
    cleaned = cleaned.replace(/[\u0000-\u001F\u007F-\u009F]/g, '');
    
    // Truncate if too long
    const maxLength = this.config.maxTitle || 200;
    if (cleaned.length > maxLength) {
      cleaned = cleaned.substring(0, maxLength).trim();
      
      // Try to end at word boundary
      const lastSpace = cleaned.lastIndexOf(' ');
      if (lastSpace > maxLength * 0.8) {
        cleaned = cleaned.substring(0, lastSpace);
      }
    }
    
    return cleaned;
  }

  /**
   * Remove site name from title
   */
  private removeSiteName(title: string): string {
    // Common patterns for site names
    const patterns = [
      /\s*[\|\-\u2013\u2014]\s*[^|\-\u2013\u2014]*$/,  // Remove " - Site Name" or " | Site Name"
      /^[^|\-\u2013\u2014]*\s*[\|\-\u2013\u2014]\s*/,   // Remove "Site Name - " or "Site Name | "
      /\s*\u00bb\s*[^»]*$/,                             // Remove " » Site Name"
      /^[^«]*\s*\u00ab\s*/,                             // Remove "Site Name « "
      /\s*::\s*[^:]*$/,                                 // Remove " :: Site Name"
      /^[^:]*\s*::\s*/                                  // Remove "Site Name :: "
    ];
    
    let cleaned = title;
    for (const pattern of patterns) {
      const newTitle = cleaned.replace(pattern, '').trim();
      if (newTitle.length > 10 && newTitle.length < cleaned.length) {
        cleaned = newTitle;
      }
    }
    
    return cleaned;
  }

  /**
   * Remove common prefixes and suffixes
   */
  private removeCommonPrefixes(title: string): string {
    const prefixes = [
      /^Breaking:\s*/i,
      /^News:\s*/i,
      /^Update:\s*/i,
      /^Latest:\s*/i,
      /^Exclusive:\s*/i,
      /^WATCH:\s*/i,
      /^VIDEO:\s*/i,
      /^LIVE:\s*/i
    ];
    
    const suffixes = [
      /\s*\[VIDEO\]$/i,
      /\s*\[PHOTOS\]$/i,
      /\s*\[GALLERY\]$/i,
      /\s*\[LIVE\]$/i,
      /\s*\[UPDATE\]$/i,
      /\s*\[BREAKING\]$/i
    ];
    
    let cleaned = title;
    
    prefixes.forEach(pattern => {
      cleaned = cleaned.replace(pattern, '');
    });
    
    suffixes.forEach(pattern => {
      cleaned = cleaned.replace(pattern, '');
    });
    
    return cleaned.trim();
  }
}