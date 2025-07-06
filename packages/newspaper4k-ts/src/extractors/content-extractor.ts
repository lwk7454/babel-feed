import * as cheerio from 'cheerio';
import { ArticleConfig, ContentNode } from '../types';
import { HTML_CONFIG, SCORING_CONFIG } from '../config';
import { TextUtils } from '../utils/text-utils';

/**
 * Extracts main article content from HTML using scoring algorithm
 */
export class ContentExtractor {
  private config: ArticleConfig;

  constructor(config: ArticleConfig) {
    this.config = config;
  }

  /**
   * Extract main content from HTML
   */
  async extract(html: string): Promise<{ text: string; html: string }> {
    const $ = cheerio.load(html);
    
    // Remove unwanted elements
    this.removeUnwantedElements($);
    
    // Find content candidates
    const candidates = this.findContentCandidates($);
    
    // Score candidates
    const scoredCandidates = this.scoreCandidates(candidates, $);
    
    // Select best candidate
    const bestCandidate = this.selectBestCandidate(scoredCandidates);
    
    if (!bestCandidate) {
      return { text: '', html: '' };
    }
    
    // Extract and clean content
    const contentHtml = this.extractContent(bestCandidate.element, $);
    const cleanText = this.cleanText(contentHtml);
    
    return {
      text: cleanText,
      html: contentHtml
    };
  }

  /**
   * Remove unwanted elements from DOM
   */
  private removeUnwantedElements($: cheerio.CheerioAPI): void {
    // Remove script, style, and other unwanted tags
    HTML_CONFIG.removeTags.forEach(tag => {
      $(tag).remove();
    });
    
    // Remove elements with negative class names
    HTML_CONFIG.negativeTags.forEach(tag => {
      $(`[class*="${tag}"], [id*="${tag}"]`).remove();
    });
    
    // Remove common unwanted elements
    $(
      'nav, aside, footer, header, .nav, .navigation, .sidebar, .menu, ' +
      '.ad, .ads, .advertisement, .social, .share, .related, .comments, ' +
      '.comment, .meta, .tags, .category, .breadcrumb'
    ).remove();
  }

  /**
   * Find potential content candidates
   */
  private findContentCandidates($: cheerio.CheerioAPI): cheerio.Cheerio<any>[] {
    const candidates: cheerio.Cheerio<any>[] = [];
    
    // Look for semantic content elements
    const semanticSelectors = [
      'article',
      'main',
      '[role="main"]',
      '.content',
      '.post',
      '.entry',
      '.story',
      '.article',
      '.text'
    ];
    
    semanticSelectors.forEach(selector => {
      const elements = $(selector);
      if (elements.length > 0) {
        elements.each((_, element) => {
          candidates.push($(element));
        });
      }
    });
    
    // If no semantic elements found, look for divs with significant content
    if (candidates.length === 0) {
      $('div').each((_, element) => {
        const $element = $(element);
        const text = $element.text().trim();
        
        if (text.length > 100 && this.hasSignificantContent($element)) {
          candidates.push($element);
        }
      });
    }
    
    return candidates;
  }

  /**
   * Check if element has significant content
   */
  private hasSignificantContent($element: cheerio.Cheerio<cheerio.Element>): boolean {
    const text = $element.text().trim();
    const paragraphs = $element.find('p').length;
    const links = $element.find('a').length;
    const images = $element.find('img').length;
    
    // Basic content indicators
    return (
      text.length > 200 ||
      paragraphs > 2 ||
      (paragraphs > 0 && text.length > 100) ||
      (images > 0 && text.length > 50)
    ) && (links < text.length / 25); // Not too many links
  }

  /**
   * Score content candidates using newspaper4k algorithm
   */
  private scoreCandidates(
    candidates: cheerio.Cheerio<any>[],
    $: cheerio.CheerioAPI
  ): ContentNode[] {
    return candidates.map(candidate => {
      const text = candidate.text().trim();
      const score = this.calculateScore(candidate);
      
      return {
        element: candidate,
        score,
        text,
        linkDensity: this.calculateLinkDensity(candidate),
        paragraphCount: candidate.find('p').length
      };
    });
  }

  /**
   * Calculate content score for element
   */
  private calculateScore($element: cheerio.Cheerio<any>): number {
    let score = 0;
    const text = $element.text().trim();
    const textLength = text.length;
    
    if (textLength === 0) return 0;
    
    // Base score from text length
    score += Math.min(textLength / 100, 50) * SCORING_CONFIG.textLengthWeight;
    
    // Paragraph count bonus
    const paragraphCount = $element.find('p').length;
    score += paragraphCount * SCORING_CONFIG.paragraphCountWeight;
    
    // Stopword ratio (indicates natural language)
    const stopwordRatio = TextUtils.calculateStopwordRatio(text, this.config.language || 'en');
    score += stopwordRatio * SCORING_CONFIG.stopwordRatioWeight;
    
    // Link density penalty
    const linkDensity = this.calculateLinkDensity($element);
    if (linkDensity > SCORING_CONFIG.maxLinkDensity) {
      score += SCORING_CONFIG.linkDensityPenalty;
    }
    
    // Tag-based scoring
    const tagName = $element.prop('tagName')?.toLowerCase();
    const className = $element.attr('class') || '';
    const id = $element.attr('id') || '';
    
    // Positive tag multipliers
    if (tagName === 'article') score *= SCORING_CONFIG.articleTag;
    else if (tagName === 'main') score *= SCORING_CONFIG.mainTag;
    else if (className.includes('content')) score *= SCORING_CONFIG.contentTag;
    else if (className.includes('entry')) score *= SCORING_CONFIG.entryTag;
    else if (className.includes('post')) score *= SCORING_CONFIG.postTag;
    else if (className.includes('story')) score *= SCORING_CONFIG.storyTag;
    
    // Negative tag multipliers
    if (className.includes('nav') || id.includes('nav')) score *= SCORING_CONFIG.navTag;
    else if (className.includes('aside') || id.includes('aside')) score *= SCORING_CONFIG.asideTag;
    else if (className.includes('footer') || id.includes('footer')) score *= SCORING_CONFIG.footerTag;
    else if (className.includes('header') || id.includes('header')) score *= SCORING_CONFIG.headerTag;
    else if (className.includes('menu') || id.includes('menu')) score *= SCORING_CONFIG.menuTag;
    else if (className.includes('sidebar') || id.includes('sidebar')) score *= SCORING_CONFIG.sidebarTag;
    else if (className.includes('ad') || id.includes('ad')) score *= SCORING_CONFIG.adTag;
    
    // Minimum thresholds
    if (textLength < SCORING_CONFIG.minTextLength) score = 0;
    if (paragraphCount < SCORING_CONFIG.minParagraphCount) score *= 0.5;
    if (stopwordRatio < SCORING_CONFIG.minStopwordRatio) score *= 0.5;
    
    return Math.max(0, score);
  }

  /**
   * Calculate link density for element
   */
  private calculateLinkDensity($element: cheerio.Cheerio<cheerio.Element>): number {
    const text = $element.text().trim();
    const linkText = $element.find('a').text().trim();
    
    if (text.length === 0) return 0;
    return linkText.length / text.length;
  }

  /**
   * Select best content candidate
   */
  private selectBestCandidate(candidates: ContentNode[]): ContentNode | null {
    if (candidates.length === 0) return null;
    
    // Sort by score descending
    candidates.sort((a, b) => b.score - a.score);
    
    // Return candidate with highest score
    return candidates[0];
  }

  /**
   * Extract content from selected element
   */
  private extractContent($element: cheerio.Cheerio<cheerio.Element>, $: cheerio.CheerioAPI): string {
    // Clone element to avoid modifying original
    const $content = $element.clone();
    
    // Remove remaining unwanted elements
    $content.find('script, style, nav, aside, footer, header, .nav, .sidebar, .menu, .ad, .ads, .advertisement, .social, .share, .related, .comments, .comment').remove();
    
    // Clean up attributes
    $content.find('*').each((_, element) => {
      const $el = $(element);
      
      // Remove most attributes except essential ones
      const attrs = element.attribs || {};
      Object.keys(attrs).forEach(attr => {
        if (!['href', 'src', 'alt', 'title'].includes(attr)) {
          $el.removeAttr(attr);
        }
      });
    });
    
    return $content.html() || '';
  }

  /**
   * Clean extracted text
   */
  private cleanText(html: string): string {
    const $ = cheerio.load(html);
    
    // Get text content
    let text = $.text();
    
    // Clean up whitespace
    text = text.replace(/\s+/g, ' ').trim();
    
    // Remove control characters
    text = text.replace(/[\u0000-\u001F\u007F-\u009F]/g, '');
    
    // Normalize quotes
    text = text.replace(/[""]/g, '"').replace(/['']/g, "'");
    
    return text;
  }
}