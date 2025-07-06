/**
 * URL utility functions
 */
export class UrlUtils {
  /**
   * Check if URL is valid
   */
  static isValidUrl(url: string): boolean {
    try {
      const urlObj = new URL(url);
      return urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
    } catch {
      return false;
    }
  }

  /**
   * Resolve relative URL against base URL
   */
  static resolveUrl(url: string, baseUrl: string): string {
    try {
      // If URL is already absolute, return it
      if (this.isValidUrl(url)) {
        return url;
      }

      // If URL starts with //, add protocol
      if (url.startsWith('//')) {
        const baseUrlObj = new URL(baseUrl);
        return `${baseUrlObj.protocol}${url}`;
      }

      // Resolve relative URL
      const resolvedUrl = new URL(url, baseUrl);
      return resolvedUrl.toString();
    } catch {
      // If resolution fails, try simple concatenation
      if (url.startsWith('/')) {
        try {
          const baseUrlObj = new URL(baseUrl);
          return `${baseUrlObj.protocol}//${baseUrlObj.host}${url}`;
        } catch {
          return url;
        }
      }
      return url;
    }
  }

  /**
   * Get domain from URL
   */
  static getDomain(url: string): string {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname;
    } catch {
      return '';
    }
  }

  /**
   * Get base URL (protocol + hostname + port)
   */
  static getBaseUrl(url: string): string {
    try {
      const urlObj = new URL(url);
      return `${urlObj.protocol}//${urlObj.host}`;
    } catch {
      return '';
    }
  }

  /**
   * Normalize URL by removing query parameters and fragments
   */
  static normalizeUrl(url: string): string {
    try {
      const urlObj = new URL(url);
      return `${urlObj.protocol}//${urlObj.host}${urlObj.pathname}`;
    } catch {
      return url;
    }
  }

  /**
   * Extract file extension from URL
   */
  static getFileExtension(url: string): string {
    try {
      const urlObj = new URL(url);
      const pathname = urlObj.pathname;
      const lastDot = pathname.lastIndexOf('.');
      
      if (lastDot === -1 || lastDot === pathname.length - 1) {
        return '';
      }
      
      return pathname.substring(lastDot + 1).toLowerCase();
    } catch {
      return '';
    }
  }

  /**
   * Check if URL points to an image
   */
  static isImageUrl(url: string): boolean {
    const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'tiff', 'ico'];
    const extension = this.getFileExtension(url);
    return imageExtensions.includes(extension);
  }

  /**
   * Check if URL points to a video
   */
  static isVideoUrl(url: string): boolean {
    const videoExtensions = ['mp4', 'avi', 'mov', 'wmv', 'flv', 'webm', 'mkv', 'm4v', '3gp'];
    const extension = this.getFileExtension(url);
    return videoExtensions.includes(extension);
  }

  /**
   * Clean URL by removing tracking parameters
   */
  static cleanUrl(url: string): string {
    try {
      const urlObj = new URL(url);
      
      // Common tracking parameters to remove
      const trackingParams = [
        'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term',
        'fbclid', 'gclid', 'dclid', 'twclid', 'ref', 'referrer', '_ga', 'mc_cid', 'mc_eid'
      ];
      
      trackingParams.forEach(param => {
        urlObj.searchParams.delete(param);
      });
      
      return urlObj.toString();
    } catch {
      return url;
    }
  }

  /**
   * Check if two URLs are essentially the same
   */
  static areUrlsSimilar(url1: string, url2: string): boolean {
    try {
      const clean1 = this.cleanUrl(this.normalizeUrl(url1));
      const clean2 = this.cleanUrl(this.normalizeUrl(url2));
      return clean1 === clean2;
    } catch {
      return url1 === url2;
    }
  }

  /**
   * Get URL without protocol
   */
  static withoutProtocol(url: string): string {
    try {
      const urlObj = new URL(url);
      return url.substring(urlObj.protocol.length + 2); // Remove protocol://
    } catch {
      return url;
    }
  }

  /**
   * Check if URL is from the same domain
   */
  static isSameDomain(url1: string, url2: string): boolean {
    try {
      const domain1 = this.getDomain(url1);
      const domain2 = this.getDomain(url2);
      return domain1 === domain2;
    } catch {
      return false;
    }
  }

  /**
   * Get URL path segments
   */
  static getPathSegments(url: string): string[] {
    try {
      const urlObj = new URL(url);
      return urlObj.pathname.split('/').filter(segment => segment.length > 0);
    } catch {
      return [];
    }
  }

  /**
   * Build URL from components
   */
  static buildUrl(
    protocol: string,
    hostname: string,
    pathname?: string,
    searchParams?: Record<string, string>,
    port?: number
  ): string {
    try {
      const url = new URL(`${protocol}://${hostname}`);
      
      if (port) {
        url.port = port.toString();
      }
      
      if (pathname) {
        url.pathname = pathname;
      }
      
      if (searchParams) {
        Object.entries(searchParams).forEach(([key, value]) => {
          url.searchParams.set(key, value);
        });
      }
      
      return url.toString();
    } catch {
      return `${protocol}://${hostname}${pathname || ''}`;
    }
  }

  /**
   * Encode URL component safely
   */
  static encodeComponent(component: string): string {
    try {
      return encodeURIComponent(component);
    } catch {
      return component;
    }
  }

  /**
   * Decode URL component safely
   */
  static decodeComponent(component: string): string {
    try {
      return decodeURIComponent(component);
    } catch {
      return component;
    }
  }

  /**
   * Check if URL uses HTTPS
   */
  static isHttps(url: string): boolean {
    try {
      const urlObj = new URL(url);
      return urlObj.protocol === 'https:';
    } catch {
      return false;
    }
  }

  /**
   * Convert HTTP URL to HTTPS
   */
  static toHttps(url: string): string {
    try {
      const urlObj = new URL(url);
      if (urlObj.protocol === 'http:') {
        urlObj.protocol = 'https:';
      }
      return urlObj.toString();
    } catch {
      return url.replace(/^http:/, 'https:');
    }
  }

  /**
   * Get query parameter value
   */
  static getQueryParam(url: string, paramName: string): string | null {
    try {
      const urlObj = new URL(url);
      return urlObj.searchParams.get(paramName);
    } catch {
      return null;
    }
  }

  /**
   * Add or update query parameter
   */
  static setQueryParam(url: string, paramName: string, paramValue: string): string {
    try {
      const urlObj = new URL(url);
      urlObj.searchParams.set(paramName, paramValue);
      return urlObj.toString();
    } catch {
      return url;
    }
  }

  /**
   * Remove query parameter
   */
  static removeQueryParam(url: string, paramName: string): string {
    try {
      const urlObj = new URL(url);
      urlObj.searchParams.delete(paramName);
      return urlObj.toString();
    } catch {
      return url;
    }
  }
}