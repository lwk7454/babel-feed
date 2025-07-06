import * as cheerio from 'cheerio';
import { ArticleConfig, ImageData } from '../types';
import { UrlUtils } from '../utils/url-utils';

/**
 * Extracts images from HTML articles
 */
export class ImageExtractor {
  private config: ArticleConfig;

  constructor(config: ArticleConfig) {
    this.config = config;
  }

  /**
   * Extract images from HTML
   */
  async extract(html: string, baseUrl: string): Promise<string[]> {
    if (!this.config.fetchImages) {
      return [];
    }

    const $ = cheerio.load(html);
    
    const imageCandidates = this.extractImageCandidates($, baseUrl);
    
    // Score and sort images
    const scoredImages = this.scoreImages(imageCandidates);
    
    // Filter and return top images
    return this.selectBestImages(scoredImages);
  }

  /**
   * Extract image candidates from various sources
   */
  private extractImageCandidates($: cheerio.CheerioAPI, baseUrl: string): ImageData[] {
    const candidates: ImageData[] = [];
    
    // Strategy 1: OpenGraph and Twitter meta images
    const ogImage = $('meta[property="og:image"]').attr('content');
    if (ogImage) {
      candidates.push(this.createImageData(ogImage, 'og:image', baseUrl, 10));
    }
    
    const twitterImage = $('meta[name="twitter:image"]').attr('content');
    if (twitterImage) {
      candidates.push(this.createImageData(twitterImage, 'twitter:image', baseUrl, 9));
    }
    
    // Strategy 2: Schema.org microdata
    $('[itemprop="image"]').each((_, element) => {
      const imgSrc = $(element).attr('src') || $(element).attr('content');
      if (imgSrc) {
        candidates.push(this.createImageData(imgSrc, $(element).attr('alt') || '', baseUrl, 8));
      }
    });
    
    // Strategy 3: JSON-LD structured data
    $('script[type="application/ld+json"]').each((_, element) => {
      try {
        const jsonData = JSON.parse($(element).html() || '{}');
        this.extractImagesFromJsonLd(jsonData, candidates, baseUrl);
      } catch (error) {
        // Ignore JSON parsing errors
      }
    });
    
    // Strategy 4: Article/main content images
    const contentSelectors = [
      'article img',
      'main img',
      '.content img',
      '.post img',
      '.entry img',
      '.story img',
      '.article img'
    ];
    
    contentSelectors.forEach(selector => {
      $(selector).each((_, element) => {
        const imgSrc = $(element).attr('src');
        const imgAlt = $(element).attr('alt') || '';
        if (imgSrc) {
          candidates.push(this.createImageData(imgSrc, imgAlt, baseUrl, 7));
        }
      });
    });
    
    // Strategy 5: Figure and picture elements
    $('figure img, picture img').each((_, element) => {
      const imgSrc = $(element).attr('src');
      const imgAlt = $(element).attr('alt') || '';
      const caption = $(element).closest('figure').find('figcaption').text().trim();
      if (imgSrc) {
        candidates.push(this.createImageData(imgSrc, imgAlt || caption, baseUrl, 6));
      }
    });
    
    // Strategy 6: All other images in content
    $('img').each((_, element) => {
      const $img = $(element);
      const imgSrc = $img.attr('src');
      const imgAlt = $img.attr('alt') || '';
      
      if (imgSrc && !this.isIgnoredImage($img)) {
        candidates.push(this.createImageData(imgSrc, imgAlt, baseUrl, 5));
      }
    });
    
    // Strategy 7: CSS background images
    $('*[style*="background-image"]').each((_, element) => {
      const style = $(element).attr('style') || '';
      const bgMatch = style.match(/background-image:\s*url\((['"]?)([^'")]+)\1\)/);
      if (bgMatch && bgMatch[2]) {
        candidates.push(this.createImageData(bgMatch[2], '', baseUrl, 3));
      }
    });
    
    return candidates;
  }

  /**
   * Extract images from JSON-LD structured data
   */
  private extractImagesFromJsonLd(jsonData: any, candidates: ImageData[], baseUrl: string): void {
    if (!jsonData) return;
    
    // Handle arrays
    if (Array.isArray(jsonData)) {
      jsonData.forEach(item => this.extractImagesFromJsonLd(item, candidates, baseUrl));
      return;
    }
    
    // Common image fields
    if (jsonData.image) {
      if (typeof jsonData.image === 'string') {
        candidates.push(this.createImageData(jsonData.image, '', baseUrl, 8));
      } else if (Array.isArray(jsonData.image)) {
        jsonData.image.forEach((img: any) => {
          if (typeof img === 'string') {
            candidates.push(this.createImageData(img, '', baseUrl, 8));
          } else if (img.url) {
            candidates.push(this.createImageData(img.url, img.caption || '', baseUrl, 8));
          }
        });
      } else if (jsonData.image.url) {
        candidates.push(this.createImageData(jsonData.image.url, jsonData.image.caption || '', baseUrl, 8));
      }
    }
    
    // Thumbnail
    if (jsonData.thumbnailUrl) {
      candidates.push(this.createImageData(jsonData.thumbnailUrl, '', baseUrl, 6));
    }
  }

  /**
   * Create ImageData object
   */
  private createImageData(url: string, alt: string, baseUrl: string, baseScore: number): ImageData {
    const absoluteUrl = UrlUtils.resolveUrl(url, baseUrl);
    
    return {
      url: absoluteUrl,
      alt: alt,
      width: 0,  // Will be determined later if needed
      height: 0, // Will be determined later if needed
      size: 0,   // Will be determined later if needed
      format: this.getImageFormat(absoluteUrl),
      score: baseScore
    };
  }

  /**
   * Get image format from URL
   */
  private getImageFormat(url: string): string {
    const extension = url.split('.').pop()?.toLowerCase();
    
    switch (extension) {
      case 'jpg':
      case 'jpeg':
        return 'jpeg';
      case 'png':
        return 'png';
      case 'gif':
        return 'gif';
      case 'webp':
        return 'webp';
      case 'svg':
        return 'svg';
      case 'bmp':
        return 'bmp';
      default:
        return 'unknown';
    }
  }

  /**
   * Check if image should be ignored
   */
  private isIgnoredImage($img: cheerio.Cheerio<cheerio.Element>): boolean {
    const src = $img.attr('src') || '';
    const alt = $img.attr('alt') || '';
    const className = $img.attr('class') || '';
    const id = $img.attr('id') || '';
    
    // Ignore common non-content images
    const ignoredPatterns = [
      /logo/i,
      /icon/i,
      /avatar/i,
      /profile/i,
      /social/i,
      /share/i,
      /ad/i,
      /advertisement/i,
      /banner/i,
      /sponsor/i,
      /tracking/i,
      /pixel/i,
      /beacon/i,
      /1x1/,
      /spacer/i,
      /placeholder/i,
      /loading/i,
      /spinner/i,
      /button/i,
      /arrow/i,
      /bullet/i,
      /divider/i,
      /separator/i
    ];
    
    const textToCheck = `${src} ${alt} ${className} ${id}`.toLowerCase();
    
    for (const pattern of ignoredPatterns) {
      if (pattern.test(textToCheck)) {
        return true;
      }
    }
    
    // Ignore very small images (likely icons or tracking pixels)
    const width = parseInt($img.attr('width') || '0');
    const height = parseInt($img.attr('height') || '0');
    
    if ((width > 0 && width < 50) || (height > 0 && height < 50)) {
      return true;
    }
    
    // Ignore data URLs for small images
    if (src.startsWith('data:') && src.length < 1000) {
      return true;
    }
    
    return false;
  }

  /**
   * Score images based on various criteria
   */
  private scoreImages(candidates: ImageData[]): ImageData[] {
    return candidates.map(image => {
      let score = image.score;
      
      // URL-based scoring
      const url = image.url.toLowerCase();
      
      // Prefer certain directories
      if (url.includes('/content/') || url.includes('/articles/') || url.includes('/posts/')) {
        score += 2;
      }
      
      // Prefer larger images based on filename patterns
      if (url.includes('large') || url.includes('hero') || url.includes('main') || url.includes('featured')) {
        score += 3;
      }
      
      if (url.includes('thumb') || url.includes('small') || url.includes('mini')) {
        score -= 2;
      }
      
      // Format preferences
      switch (image.format) {
        case 'jpeg':
        case 'webp':
          score += 1;
          break;
        case 'png':
          score += 0.5;
          break;
        case 'gif':
          score -= 1; // Often ads or decorative
          break;
        case 'svg':
          score -= 2; // Often icons
          break;
      }
      
      // Alt text scoring
      if (image.alt) {
        if (image.alt.length > 10) {
          score += 1;
        }
        if (image.alt.length > 30) {
          score += 1;
        }
        
        // Penalize generic alt text
        const genericAltPatterns = [
          /^image$/i,
          /^photo$/i,
          /^picture$/i,
          /^img$/i,
          /^\d+$/,
          /^untitled/i
        ];
        
        for (const pattern of genericAltPatterns) {
          if (pattern.test(image.alt)) {
            score -= 1;
            break;
          }
        }
      } else {
        score -= 0.5; // No alt text
      }
      
      return { ...image, score };
    });
  }

  /**
   * Select best images from candidates
   */
  private selectBestImages(scoredImages: ImageData[]): string[] {
    // Remove duplicates
    const uniqueImages = this.removeDuplicateImages(scoredImages);
    
    // Sort by score descending
    uniqueImages.sort((a, b) => b.score - a.score);
    
    // Filter out very low scoring images
    const filteredImages = uniqueImages.filter(img => img.score > 3);
    
    // Return top images (limit to reasonable number)
    const maxImages = 10;
    return filteredImages.slice(0, maxImages).map(img => img.url);
  }

  /**
   * Remove duplicate images
   */
  private removeDuplicateImages(images: ImageData[]): ImageData[] {
    const seen = new Set<string>();
    const unique: ImageData[] = [];
    
    for (const image of images) {
      // Normalize URL for comparison
      const normalizedUrl = image.url.toLowerCase().replace(/[?#].*$/, '');
      
      if (!seen.has(normalizedUrl)) {
        seen.add(normalizedUrl);
        unique.push(image);
      }
    }
    
    return unique;
  }
}