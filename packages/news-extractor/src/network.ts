/**
 * Network layer for HTTP requests and remote data fetching.
 * This module provides session management, request handling, and response processing
 * with cloudflare protection and retry logic.
 */

import axios, { AxiosInstance, AxiosResponse } from 'axios'
import iconv from 'iconv-lite'
import { URL } from 'url'
import { Configuration } from './configuration.js'
import { ArticleException, ArticleBinaryDataException } from './types.js'
import { USER_AGENTS } from './data/user-agents.js'
import { logger } from './logger.js'
import { ErrorRecovery } from './error-recovery.js'

export const FAIL_ENCODING = 'ISO-8859-1'

/**
 * Create an HTTP session with cloudflare protection if available
 */
export function createSession(): AxiosInstance {
  const session = axios.create({
    timeout: 7000,
    headers: {
      'Accept-Encoding': 'gzip, deflate',
      'User-Agent': USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)]
    },
    maxRedirects: 5,
    validateStatus: (status) => status < 500 // Accept 4xx errors but not 5xx
  })

  // Add request interceptor for logging
  session.interceptors.request.use(
    (config) => {
      logger.debug('NetworkClient', `Making request to: ${config.url}`)
      return config
    },
    (error) => {
      logger.error('NetworkClient', 'Request error', error)
      return Promise.reject(error)
    }
  )

  // Add response interceptor for logging
  session.interceptors.response.use(
    (response) => {
      logger.debug('NetworkClient', `Response ${response.status} from: ${response.config.url}`)
      return response
    },
    (error) => {
      if (error.response) {
        logger.warn('NetworkClient', `HTTP error ${error.response.status} from: ${error.config.url}`)
      } else {
        logger.error('NetworkClient', 'Network error', error)
      }
      return Promise.reject(error)
    }
  )

  return session
}

// Global session instance
let globalSession = createSession()

/**
 * Reset the global session to a new instance
 */
export function resetSession(): AxiosInstance {
  globalSession = createSession()
  return globalSession
}

/**
 * Get the global session instance
 */
export function getSession(): AxiosInstance {
  return globalSession
}

/**
 * Cache decorator for functions that take a URL parameter
 */
export function doCache<T extends (...args: any[]) => any>(func: T): T {
  const cache = new Map<string, ReturnType<T>>()
  
  return ((...args: Parameters<T>) => {
    const url = args[0] as string
    if (!url) {
      return func(...args)
    }

    try {
      const parsedUrl = new URL(url)
      const domain = parsedUrl.hostname
      
      if (!cache.has(domain)) {
        cache.set(domain, func(...args))
      }
      return cache.get(domain)
    } catch {
      return func(...args)
    }
  }) as T
}

/**
 * Check if a URL supports HTTP Range requests
 */
export const hasGetRanges = doCache(async (url: string): Promise<boolean> => {
  try {
    const session = getSession()
    
    // Try HEAD request first
    let response = await session.head(url, { timeout: 3000 })
    
    // Handle redirects manually if needed
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.location
      if (location) {
        response = await session.head(location, { timeout: 3000 })
      }
    }

    // Check for Accept-Ranges header
    if (response.headers['accept-ranges']) {
      return true
    }

    // Try range request
    const rangeResponse = await session.get(url, {
      headers: { Range: 'bytes=0-100' },
      timeout: 3000,
      responseType: 'stream'
    })

    return rangeResponse.status === 206
  } catch (error) {
    logger.debug('NetworkClient', `hasGetRanges() error on URL: ${url}`, { error })
    return false
  }
})

/**
 * Check if a URL points to binary content
 */
export async function isBinaryUrl(url: string): Promise<boolean> {
  try {
    const session = getSession()
    
    // Try HEAD request first
    const headResponse = await session.head(url, { timeout: 3000 })
    const contentType = headResponse.headers['content-type']
    
    if (contentType) {
      // Check for binary content types
      if (contentType.startsWith('application')) {
        if (!contentType.includes('json') && !contentType.includes('xml')) {
          return true
        }
      }
      if (contentType.startsWith('image') || 
          contentType.startsWith('video') || 
          contentType.startsWith('audio') || 
          contentType.startsWith('font')) {
        return true
      }
    }

    // Check for Content-Disposition header
    if (headResponse.headers['content-disposition']) {
      return true
    }

    // Get sample content to analyze
    let content: string
    const supportsRanges = await hasGetRanges(url)
    
    if (supportsRanges) {
      const rangeResponse = await session.get(url, {
        headers: { Range: 'bytes=0-1000' },
        timeout: 3000,
        responseType: 'arraybuffer'
      })
      content = Buffer.from(rangeResponse.data).toString('utf-8', 0, 1000)
    } else {
      const response = await session.get(url, {
        timeout: 3000,
        responseType: 'stream'
      })
      
      // Read first 1000 bytes
      const chunks: Buffer[] = []
      let totalLength = 0
      
      for await (const chunk of response.data) {
        chunks.push(chunk)
        totalLength += chunk.length
        if (totalLength >= 1000) break
      }
      
      const buffer = Buffer.concat(chunks as any[])
      content = buffer.toString('utf-8', 0, Math.min(1000, totalLength))
    }

    if (content.length === 0) {
      return false
    }

    // Check if content looks like HTML
    if (content.includes('<html')) {
      return false
    }

    // Calculate ratio of printable characters
    const printableChars = content.split('').filter(char => {
      const code = char.charCodeAt(0)
      return (code > 31 && code < 128) || code === 9 || code === 10 || code === 13
    }).length

    const printableRatio = printableChars / content.length
    return printableRatio < 0.6 // 40% or more binary content
    
  } catch (error) {
    logger.debug('NetworkClient', `isBinaryUrl() error on URL: ${url}`, { error })
    return false
  }
}

/**
 * Perform HTTP GET request with configuration
 */
export async function doRequest(url: string, config: Configuration): Promise<AxiosResponse> {
  const session = getSession()
  
  // Update session headers with config
  session.defaults.headers.common = {
    ...session.defaults.headers.common,
    ...config.requestsParams.headers
  }

  // Check for binary content if not allowed
  if (!config.allowBinaryContent) {
    if (await isBinaryUrl(url)) {
      throw new ArticleBinaryDataException(`Article is binary data: ${url}`)
    }
  }

  try {
    const response = await session.get(url, {
      ...config.requestsParams,
      timeout: config.requestsParams.timeout || 7000
    })

    return response
  } catch (error) {
    if (axios.isAxiosError(error)) {
      throw new ArticleException(`HTTP error when downloading ${url}: ${error.message}`)
    }
    throw error
  }
}

/**
 * Extract and decode HTML from response
 */
export function getHtmlFromResponse(response: AxiosResponse, config: Configuration): string {
  const contentType = response.headers['content-type']
  
  // Check for ignored content types
  if (contentType && config.ignoredContentTypesDefaults[contentType]) {
    return config.ignoredContentTypesDefaults[contentType]
  }

  let html: string
  
  // Handle encoding
  if (response.headers['content-encoding'] !== FAIL_ENCODING) {
    html = response.data
  } else {
    // Try to decode with UTF-8 first
    if (typeof response.data === 'string') {
      html = response.data
    } else {
      html = Buffer.from(response.data).toString('utf-8')
    }
    
    // If charset is not specified, try to detect it
    if (!contentType?.includes('charset')) {
      try {
        // Try to detect encoding from content
        const detected = iconv.decode(Buffer.from(response.data), 'utf-8')
        if (detected && detected.length > 0) {
          html = detected
        }
      } catch {
        // Fallback to current html
      }
    }
  }

  return html || ''
}

/**
 * Get HTML content from URL
 */
export async function getHtml(
  url: string,
  config?: Configuration,
  response?: AxiosResponse
): Promise<string> {
  const cfg = config || new Configuration()
  
  try {
    const [html, statusCode] = await getHtmlStatus(url, cfg, response)
    
    if (statusCode >= 400) {
      logger.warn('NetworkClient', `getHtml() bad status code ${statusCode} on URL: ${url}`)
      if (cfg.httpSuccessOnly) {
        throw new ArticleException(`HTTP error when downloading ${url}. Status code: ${statusCode}`)
      }
      return ''
    }
    
    return html
  } catch (error) {
    logger.debug('NetworkClient', `getHtml() error on URL: ${url}`, { error })
    return ''
  }
}

/**
 * Get HTML content with status code and redirect history
 */
export async function getHtmlStatus(
  url: string,
  config?: Configuration,
  response?: AxiosResponse
): Promise<[string, number, AxiosResponse[]]> {
  const cfg = config || new Configuration()
  
  if (response) {
    return [
      getHtmlFromResponse(response, cfg),
      response.status,
      [] // Axios doesn't expose redirect history the same way
    ]
  }

  const resp = await doRequest(url, cfg)
  
  if (resp.status !== 200) {
    logger.warn('NetworkClient', `getHtmlStatus(): bad status code ${resp.status} on URL: ${url}`)
  }
  
  const html = getHtmlFromResponse(resp, cfg)
  
  return [html, resp.status, []]
}

/**
 * Make multiple HTTP requests concurrently
 */
export async function multithreadRequest(
  urls: string[],
  config?: Configuration
): Promise<(AxiosResponse | null)[]> {
  const cfg = config || new Configuration()
  const timeout = cfg.threadTimeoutSeconds * 1000
  const requestTimeout = cfg.requestsParams.timeout || 7000

  if (timeout < requestTimeout) {
    logger.warn('NetworkClient',
      `multithreadRequest(): Thread timeout ${timeout}ms < Request timeout ${requestTimeout}ms, ` +
      'could cause requests to be cancelled before completion.'
    )
  }

  const results: (AxiosResponse | null)[] = []
  const promises = urls.map(async (url, index) => {
    try {
      const response = await doRequest(url, cfg)
      results[index] = response
    } catch (error) {
      results[index] = null
      if (error instanceof Error) {
        logger.warn('NetworkClient', `multithreadRequest(): Error ${error.message} on URL: ${url}`)
      }
    }
  })

  await Promise.all(promises)
  return results
}

/**
 * NetworkClient class with error recovery and structured logging
 */
export class NetworkClient {
  private config: Configuration

  constructor(config: Configuration) {
    this.config = config
  }

  /**
   * Get HTTP response with error recovery
   */
  async get(url: string, options?: any): Promise<AxiosResponse> {
    return ErrorRecovery.withRetry(
      async () => {
        logger.debug('NetworkClient', `Fetching: ${url}`)
        const response = await doRequest(url, this.config)
        logger.info('NetworkClient', `Successfully fetched: ${url}`, {
          status: response.status,
          contentLength: response.headers['content-length']
        })
        return response
      },
      { maxAttempts: 3, backoffMs: 1000 },
      `NetworkClient.get(${url})`
    )
  }

  /**
   * Get HTML content with error recovery
   */
  async getHtml(url: string): Promise<string> {
    return ErrorRecovery.safeExecute(
      async () => {
        const html = await getHtml(url, this.config)
        logger.debug('NetworkClient', `Retrieved HTML from: ${url}`, {
          htmlLength: html.length
        })
        return html
      },
      '',
      `NetworkClient.getHtml(${url})`
    )
  }

  /**
   * Check if URL contains binary content with error recovery
   */
  async isBinary(url: string): Promise<boolean> {
    return ErrorRecovery.safeExecute(
      async () => {
        const result = await isBinaryUrl(url)
        logger.debug('NetworkClient', `Binary check for: ${url}`, { isBinary: result })
        return result
      },
      false,
      `NetworkClient.isBinary(${url})`
    )
  }

  /**
   * Make multiple requests with error recovery
   */
  async multithreadRequest(urls: string[]): Promise<(AxiosResponse | null)[]> {
    return ErrorRecovery.withRetry(
      async () => {
        logger.info('NetworkClient', `Starting multithread request for ${urls.length} URLs`)
        const results = await multithreadRequest(urls, this.config)
        const successCount = results.filter(r => r !== null).length
        logger.info('NetworkClient', `Completed multithread request`, {
          total: urls.length,
          successful: successCount,
          failed: urls.length - successCount
        })
        return results
      },
      { maxAttempts: 2, backoffMs: 500 },
      `NetworkClient.multithreadRequest(${urls.length} URLs)`
    )
  }
}