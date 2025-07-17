/**
 * Token bucket rate limiter implementation
 */

export interface RateLimiterOptions {
  requestsPerSecond: number
  burstSize: number
  backoffMultiplier: number
  maxBackoffDelay: number
}

export interface RateLimiterMetrics {
  requestsAllowed: number
  requestsRejected: number
  currentTokens: number
  lastRefill: number
  averageWaitTime: number
}

export class TokenBucketRateLimiter {
  private tokens: number
  private lastRefill: number
  private requestsAllowed = 0
  private requestsRejected = 0
  private totalWaitTime = 0
  private waitRequests = 0

  constructor(private options: RateLimiterOptions) {
    this.tokens = options.burstSize
    this.lastRefill = Date.now()
  }

  async acquire(tokens = 1): Promise<void> {
    const now = Date.now()
    this.refillTokens(now)

    if (this.tokens >= tokens) {
      this.tokens -= tokens
      this.requestsAllowed++
      return
    }

    // Calculate wait time
    const tokensNeeded = tokens - this.tokens
    const waitTime = Math.min(
      (tokensNeeded / this.options.requestsPerSecond) * 1000,
      this.options.maxBackoffDelay
    )

    this.requestsRejected++
    this.totalWaitTime += waitTime
    this.waitRequests++

    // Apply exponential backoff
    const backoffTime = waitTime * this.options.backoffMultiplier
    const finalWaitTime = Math.min(backoffTime, this.options.maxBackoffDelay)

    await new Promise(resolve => setTimeout(resolve, finalWaitTime))
    
    // Try again after waiting
    await this.acquire(tokens)
  }

  tryAcquire(tokens = 1): boolean {
    const now = Date.now()
    this.refillTokens(now)

    if (this.tokens >= tokens) {
      this.tokens -= tokens
      this.requestsAllowed++
      return true
    }

    this.requestsRejected++
    return false
  }

  private refillTokens(now: number): void {
    const timeSinceRefill = now - this.lastRefill
    const tokensToAdd = (timeSinceRefill / 1000) * this.options.requestsPerSecond
    
    this.tokens = Math.min(this.options.burstSize, this.tokens + tokensToAdd)
    this.lastRefill = now
  }

  getMetrics(): RateLimiterMetrics {
    // Update tokens before returning metrics
    const now = Date.now()
    this.refillTokens(now)
    
    return {
      requestsAllowed: this.requestsAllowed,
      requestsRejected: this.requestsRejected,
      currentTokens: Math.floor(this.tokens),
      lastRefill: this.lastRefill,
      averageWaitTime: this.waitRequests > 0 ? this.totalWaitTime / this.waitRequests : 0
    }
  }

  reset(): void {
    this.tokens = this.options.burstSize
    this.lastRefill = Date.now()
    this.requestsAllowed = 0
    this.requestsRejected = 0
    this.totalWaitTime = 0
    this.waitRequests = 0
  }

  getAvailableTokens(): number {
    this.refillTokens(Date.now())
    return Math.floor(this.tokens)
  }

  getWaitTimeForTokens(tokens: number): number {
    const now = Date.now()
    this.refillTokens(now)
    
    if (this.tokens >= tokens) {
      return 0
    }
    
    const tokensNeeded = tokens - this.tokens
    return Math.min(
      (tokensNeeded / this.options.requestsPerSecond) * 1000,
      this.options.maxBackoffDelay
    )
  }
}

export class RateLimiterRegistry {
  private limiters = new Map<string, TokenBucketRateLimiter>()
  
  getRateLimiter(key: string, options?: RateLimiterOptions): TokenBucketRateLimiter {
    if (!this.limiters.has(key)) {
      const defaultOptions: RateLimiterOptions = {
        requestsPerSecond: 2,  // Conservative default
        burstSize: 5,
        backoffMultiplier: 1.5,
        maxBackoffDelay: 30000 // 30 seconds max
      }
      
      this.limiters.set(key, new TokenBucketRateLimiter({ ...defaultOptions, ...options }))
    }
    
    return this.limiters.get(key)!
  }

  getAllMetrics(): Record<string, RateLimiterMetrics> {
    const metrics: Record<string, RateLimiterMetrics> = {}
    
    for (const [key, limiter] of this.limiters.entries()) {
      metrics[key] = limiter.getMetrics()
    }
    
    return metrics
  }

  resetAll(): void {
    for (const limiter of this.limiters.values()) {
      limiter.reset()
    }
  }

  removeLimiter(key: string): boolean {
    return this.limiters.delete(key)
  }
}