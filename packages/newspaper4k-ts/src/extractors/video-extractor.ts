import * as cheerio from 'cheerio';
import { ArticleConfig, VideoData } from '../types';
import { UrlUtils } from '../utils/url-utils';

/**
 * Extracts video URLs from HTML articles
 */
export class VideoExtractor {
  private config: ArticleConfig;

  constructor(config: ArticleConfig) {
    this.config = config;
  }

  /**
   * Extract video URLs from HTML
   */
  async extract(html: string, baseUrl: string): Promise<string[]> {
    const $ = cheerio.load(html);
    
    const videoCandidates = this.extractVideoCandidates($, baseUrl);
    
    // Score and filter videos
    const scoredVideos = this.scoreVideos(videoCandidates);
    
    // Return top video URLs
    return this.selectBestVideos(scoredVideos);
  }

  /**
   * Extract video candidates from various sources
   */
  private extractVideoCandidates($: cheerio.CheerioAPI, baseUrl: string): VideoData[] {
    const candidates: VideoData[] = [];
    
    // Strategy 1: OpenGraph and Twitter meta videos
    const ogVideo = $('meta[property="og:video"]').attr('content') || 
                   $('meta[property="og:video:url"]').attr('content');
    if (ogVideo) {
      candidates.push(this.createVideoData(ogVideo, 'Open Graph Video', baseUrl, 10));
    }
    
    const twitterPlayer = $('meta[name="twitter:player"]').attr('content');
    if (twitterPlayer) {
      candidates.push(this.createVideoData(twitterPlayer, 'Twitter Player', baseUrl, 9));
    }
    
    // Strategy 2: Video elements
    $('video').each((_, element) => {
      const $video = $(element);
      const src = $video.attr('src');
      const poster = $video.attr('poster');
      
      if (src) {
        candidates.push(this.createVideoData(src, 'HTML5 Video', baseUrl, 8, poster));
      }
      
      // Check source elements within video
      $video.find('source').each((_, sourceEl) => {
        const sourceSrc = $(sourceEl).attr('src');
        if (sourceSrc) {
          candidates.push(this.createVideoData(sourceSrc, 'HTML5 Video Source', baseUrl, 8, poster));
        }
      });
    });
    
    // Strategy 3: YouTube embeds
    $('iframe[src*="youtube.com"], iframe[src*="youtu.be"]').each((_, element) => {
      const src = $(element).attr('src');
      if (src) {
        const videoId = this.extractYouTubeId(src);
        const youtubeUrl = videoId ? `https://www.youtube.com/watch?v=${videoId}` : src;
        candidates.push(this.createVideoData(youtubeUrl, 'YouTube Video', baseUrl, 9));
      }
    });
    
    // Strategy 4: Vimeo embeds
    $('iframe[src*="vimeo.com"]').each((_, element) => {
      const src = $(element).attr('src');
      if (src) {
        const videoId = this.extractVimeoId(src);
        const vimeoUrl = videoId ? `https://vimeo.com/${videoId}` : src;
        candidates.push(this.createVideoData(vimeoUrl, 'Vimeo Video', baseUrl, 8));
      }
    });
    
    // Strategy 5: Other common video platforms
    const videoPlatforms = [
      { pattern: /dailymotion\.com/, name: 'Dailymotion' },
      { pattern: /twitch\.tv/, name: 'Twitch' },
      { pattern: /facebook\.com/, name: 'Facebook Video' },
      { pattern: /instagram\.com/, name: 'Instagram Video' },
      { pattern: /tiktok\.com/, name: 'TikTok' },
      { pattern: /twitter\.com/, name: 'Twitter Video' },
      { pattern: /wistia\.com/, name: 'Wistia' },
      { pattern: /brightcove\.com/, name: 'Brightcove' },
      { pattern: /jwplayer\.com/, name: 'JW Player' }
    ];
    
    videoPlatforms.forEach(platform => {
      $(`iframe[src*="${platform.pattern.source.replace(/[\\.*+?^${}()|[\]]/g, '')}"]`).each((_, element) => {
        const src = $(element).attr('src');
        if (src) {
          candidates.push(this.createVideoData(src, platform.name, baseUrl, 7));
        }
      });
    });
    
    // Strategy 6: Schema.org microdata
    $('[itemprop="video"]').each((_, element) => {
      const videoSrc = $(element).attr('src') || $(element).attr('content');
      if (videoSrc) {
        candidates.push(this.createVideoData(videoSrc, 'Schema.org Video', baseUrl, 8));
      }
    });
    
    // Strategy 7: JSON-LD structured data
    $('script[type="application/ld+json"]').each((_, element) => {
      try {
        const jsonData = JSON.parse($(element).html() || '{}');
        this.extractVideosFromJsonLd(jsonData, candidates, baseUrl);
      } catch (error) {
        // Ignore JSON parsing errors
      }
    });
    
    // Strategy 8: Object and embed elements (legacy)
    $('object[data*=".mp4"], object[data*=".webm"], object[data*=".ogg"]').each((_, element) => {
      const data = $(element).attr('data');
      if (data) {
        candidates.push(this.createVideoData(data, 'Object Video', baseUrl, 6));
      }
    });
    
    $('embed[src*=".mp4"], embed[src*=".webm"], embed[src*=".ogg"]').each((_, element) => {
      const src = $(element).attr('src');
      if (src) {
        candidates.push(this.createVideoData(src, 'Embed Video', baseUrl, 6));
      }
    });
    
    // Strategy 9: Direct video file links
    $('a[href$=".mp4"], a[href$=".webm"], a[href$=".ogg"], a[href$=".mov"], a[href$=".avi"]').each((_, element) => {
      const href = $(element).attr('href');
      if (href) {
        candidates.push(this.createVideoData(href, 'Direct Video Link', baseUrl, 5));
      }
    });
    
    return candidates;
  }

  /**
   * Extract videos from JSON-LD structured data
   */
  private extractVideosFromJsonLd(jsonData: any, candidates: VideoData[], baseUrl: string): void {
    if (!jsonData) return;
    
    // Handle arrays
    if (Array.isArray(jsonData)) {
      jsonData.forEach(item => this.extractVideosFromJsonLd(item, candidates, baseUrl));
      return;
    }
    
    // VideoObject schema
    if (jsonData['@type'] === 'VideoObject') {
      if (jsonData.contentUrl) {
        candidates.push(this.createVideoData(
          jsonData.contentUrl, 
          jsonData.name || 'JSON-LD Video', 
          baseUrl, 
          9,
          jsonData.thumbnailUrl
        ));
      }
      if (jsonData.embedUrl) {
        candidates.push(this.createVideoData(
          jsonData.embedUrl, 
          jsonData.name || 'JSON-LD Embed', 
          baseUrl, 
          8,
          jsonData.thumbnailUrl
        ));
      }
    }
    
    // Common video fields
    if (jsonData.video) {
      if (typeof jsonData.video === 'string') {
        candidates.push(this.createVideoData(jsonData.video, 'JSON-LD Video', baseUrl, 8));
      } else if (Array.isArray(jsonData.video)) {
        jsonData.video.forEach((video: any) => {
          if (typeof video === 'string') {
            candidates.push(this.createVideoData(video, 'JSON-LD Video', baseUrl, 8));
          } else if (video.contentUrl) {
            candidates.push(this.createVideoData(
              video.contentUrl, 
              video.name || 'JSON-LD Video', 
              baseUrl, 
              8,
              video.thumbnailUrl
            ));
          }
        });
      } else if (jsonData.video.contentUrl) {
        candidates.push(this.createVideoData(
          jsonData.video.contentUrl, 
          jsonData.video.name || 'JSON-LD Video', 
          baseUrl, 
          8,
          jsonData.video.thumbnailUrl
        ));
      }
    }
  }

  /**
   * Create VideoData object
   */
  private createVideoData(
    url: string, 
    title: string, 
    baseUrl: string, 
    baseScore: number, 
    thumbnail?: string
  ): VideoData {
    const absoluteUrl = UrlUtils.resolveUrl(url, baseUrl);
    
    return {
      url: absoluteUrl,
      title: title,
      description: '',
      thumbnail: thumbnail ? UrlUtils.resolveUrl(thumbnail, baseUrl) : '',
      duration: 0, // Will be determined later if needed
      provider: this.detectProvider(absoluteUrl),
      score: baseScore
    };
  }

  /**
   * Detect video provider from URL
   */
  private detectProvider(url: string): string {
    const lowerUrl = url.toLowerCase();
    
    if (lowerUrl.includes('youtube.com') || lowerUrl.includes('youtu.be')) {
      return 'YouTube';
    }
    if (lowerUrl.includes('vimeo.com')) {
      return 'Vimeo';
    }
    if (lowerUrl.includes('dailymotion.com')) {
      return 'Dailymotion';
    }
    if (lowerUrl.includes('twitch.tv')) {
      return 'Twitch';
    }
    if (lowerUrl.includes('facebook.com')) {
      return 'Facebook';
    }
    if (lowerUrl.includes('instagram.com')) {
      return 'Instagram';
    }
    if (lowerUrl.includes('tiktok.com')) {
      return 'TikTok';
    }
    if (lowerUrl.includes('twitter.com')) {
      return 'Twitter';
    }
    if (lowerUrl.includes('wistia.com')) {
      return 'Wistia';
    }
    if (lowerUrl.includes('brightcove.com')) {
      return 'Brightcove';
    }
    if (lowerUrl.includes('jwplayer.com')) {
      return 'JW Player';
    }
    
    // Check for direct video files
    if (/\.(mp4|webm|ogg|mov|avi|flv|wmv)(\?|$)/i.test(url)) {
      return 'Direct';
    }
    
    return 'Unknown';
  }

  /**
   * Extract YouTube video ID from URL
   */
  private extractYouTubeId(url: string): string | null {
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
      /youtube\.com\/v\/([^&\n?#]+)/
    ];
    
    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match && match[1]) {
        return match[1];
      }
    }
    
    return null;
  }

  /**
   * Extract Vimeo video ID from URL
   */
  private extractVimeoId(url: string): string | null {
    const pattern = /vimeo\.com\/(?:video\/)?(\d+)/;
    const match = url.match(pattern);
    return match ? match[1] : null;
  }

  /**
   * Score videos based on various criteria
   */
  private scoreVideos(candidates: VideoData[]): VideoData[] {
    return candidates.map(video => {
      let score = video.score;
      
      // Provider-based scoring
      switch (video.provider) {
        case 'YouTube':
          score += 2;
          break;
        case 'Vimeo':
          score += 1.5;
          break;
        case 'Direct':
          score += 1;
          break;
        case 'Facebook':
        case 'Instagram':
        case 'Twitter':
          score += 0.5;
          break;
      }
      
      // URL-based scoring
      const url = video.url.toLowerCase();
      
      // Prefer videos in content areas
      if (url.includes('/content/') || url.includes('/articles/') || url.includes('/posts/')) {
        score += 1;
      }
      
      // Penalize ads and promotional content
      if (url.includes('ad') || url.includes('promo') || url.includes('sponsor')) {
        score -= 3;
      }
      
      // Title-based scoring
      if (video.title) {
        if (video.title.length > 10) {
          score += 0.5;
        }
        
        // Penalize generic titles
        const genericTitles = ['video', 'embed', 'player', 'untitled'];
        if (genericTitles.some(term => video.title.toLowerCase().includes(term))) {
          score -= 1;
        }
      }
      
      return { ...video, score };
    });
  }

  /**
   * Select best videos from candidates
   */
  private selectBestVideos(scoredVideos: VideoData[]): string[] {
    // Remove duplicates
    const uniqueVideos = this.removeDuplicateVideos(scoredVideos);
    
    // Sort by score descending
    uniqueVideos.sort((a, b) => b.score - a.score);
    
    // Filter out very low scoring videos
    const filteredVideos = uniqueVideos.filter(video => video.score > 4);
    
    // Return top video URLs (limit to reasonable number)
    const maxVideos = 5;
    return filteredVideos.slice(0, maxVideos).map(video => video.url);
  }

  /**
   * Remove duplicate videos
   */
  private removeDuplicateVideos(videos: VideoData[]): VideoData[] {
    const seen = new Set<string>();
    const unique: VideoData[] = [];
    
    for (const video of videos) {
      // Normalize URL for comparison
      let normalizedUrl = video.url.toLowerCase();
      
      // Special handling for YouTube URLs
      if (video.provider === 'YouTube') {
        const videoId = this.extractYouTubeId(video.url);
        if (videoId) {
          normalizedUrl = `youtube:${videoId}`;
        }
      }
      
      // Special handling for Vimeo URLs
      if (video.provider === 'Vimeo') {
        const videoId = this.extractVimeoId(video.url);
        if (videoId) {
          normalizedUrl = `vimeo:${videoId}`;
        }
      }
      
      // Remove query parameters for other URLs
      if (!normalizedUrl.includes(':')) {
        normalizedUrl = normalizedUrl.replace(/[?#].*$/, '');
      }
      
      if (!seen.has(normalizedUrl)) {
        seen.add(normalizedUrl);
        unique.push(video);
      }
    }
    
    return unique;
  }
}