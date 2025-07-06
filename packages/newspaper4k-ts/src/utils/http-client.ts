import axios, { AxiosInstance, AxiosResponse, AxiosRequestConfig } from 'axios';
import { ArticleConfig, NetworkConfig } from '../types';
import { DEFAULT_NETWORK_CONFIG } from '../config';

/**
 * HTTP client with retry logic and proper headers
 */
export class HttpClient {
  private client: AxiosInstance;
  private config: NetworkConfig;

  constructor(articleConfig: ArticleConfig) {
    this.config = {
      ...DEFAULT_NETWORK_CONFIG,
      timeout: articleConfig.timeout || DEFAULT_NETWORK_CONFIG.timeout,
      maxRetries: articleConfig.maxRetries || DEFAULT_NETWORK_CONFIG.maxRetries,
      userAgent: articleConfig.userAgent || DEFAULT_NETWORK_CONFIG.userAgent,
      headers: { ...DEFAULT_NETWORK_CONFIG.headers, ...(articleConfig.headers || {}) }
    };

    this.client = axios.create({
      timeout: this.config.timeout,
      maxRedirects: this.config.maxRedirects,
      headers: {
        'User-Agent': this.config.userAgent,
        ...this.config.headers
      },
      validateStatus: (status) => {
        // Accept 2xx and 3xx status codes
        return status < 400;
      }
    });

    // Add request interceptor for additional headers
    this.client.interceptors.request.use((config) => {
      // Add timestamp to prevent caching
      if (config.params) {
        config.params._t = Date.now();
      } else {
        config.params = { _t: Date.now() };
      }
      
      return config;
    });

    // Add response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      async (error) => {
        if (this.shouldRetry(error)) {
          return this.retryRequest(error.config);
        }
        throw error;
      }
    );
  }

  /**
   * GET request with retry logic
   */
  async get(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse> {
    try {
      const response = await this.client.get(url, config);
      return response;
    } catch (error) {
      throw this.enhanceError(error, url);
    }
  }

  /**
   * POST request with retry logic
   */
  async post(url: string, data?: any, config?: AxiosRequestConfig): Promise<AxiosResponse> {
    try {
      const response = await this.client.post(url, data, config);
      return response;
    } catch (error) {
      throw this.enhanceError(error, url);
    }
  }

  /**
   * Check if request should be retried
   */
  private shouldRetry(error: any): boolean {
    // Don't retry if we've already exceeded max retries
    if (error.config && (error.config as any)._retryCount >= this.config.maxRetries) {
      return false;
    }

    // Retry on network errors
    if (error.code === 'ECONNRESET' || error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
      return true;
    }

    // Retry on timeout
    if (error.code === 'ECONNABORTED' && error.message.includes('timeout')) {
      return true;
    }

    // Retry on 5xx server errors
    if (error.response && error.response.status >= 500) {
      return true;
    }

    // Retry on 429 (rate limit)
    if (error.response && error.response.status === 429) {
      return true;
    }

    return false;
  }

  /**
   * Retry request with exponential backoff
   */
  private async retryRequest(config: AxiosRequestConfig): Promise<AxiosResponse> {
    const configWithRetry = config as any;
    if (!configWithRetry._retryCount) {
      configWithRetry._retryCount = 0;
    }
    
    configWithRetry._retryCount++;
    
    // Calculate delay with exponential backoff and jitter
    const baseDelay = this.config.retryDelay;
    const delay = baseDelay * Math.pow(2, configWithRetry._retryCount - 1) + Math.random() * 1000;
    
    // Wait before retrying
    await new Promise(resolve => setTimeout(resolve, delay));
    
    return this.client.request(config);
  }

  /**
   * Enhance error with additional context
   */
  private enhanceError(error: any, url: string): Error {
    let message = `HTTP request failed for URL: ${url}`;
    
    if (error.response) {
      message += ` (Status: ${error.response.status})`;
    } else if (error.code) {
      message += ` (${error.code})`;
    }
    
    if (error.message) {
      message += ` - ${error.message}`;
    }
    
    const enhancedError = new Error(message);
    enhancedError.name = 'HttpClientError';
    
    // Preserve original error properties
    if (error.response) {
      (enhancedError as any).response = error.response;
      (enhancedError as any).status = error.response.status;
    }
    
    if (error.code) {
      (enhancedError as any).code = error.code;
    }
    
    return enhancedError;
  }

  /**
   * Set custom headers for all requests
   */
  setHeaders(headers: Record<string, string>): void {
    Object.assign(this.client.defaults.headers, headers);
  }

  /**
   * Set custom timeout
   */
  setTimeout(timeout: number): void {
    this.client.defaults.timeout = timeout;
  }

  /**
   * Get effective configuration
   */
  getConfig(): NetworkConfig {
    return { ...this.config };
  }
}