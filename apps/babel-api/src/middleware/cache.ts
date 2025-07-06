import { Elysia } from "elysia"
import { TranslationRequest, StreamingTranslationResult } from "../types/translation.js"

// Simple in-memory cache implementation
// In production, you'd want to use Redis or a distributed cache
class InMemoryTranslationCache {
  private cache: Map<string, { result: StreamingTranslationResult; expiresAt: number }> = new Map()
  
  constructor() {
    // Clean up expired entries every hour
    setInterval(() => this.cleanup(), 3600000)
  }

  private cleanup() {
    const now = Date.now()
    for (const [key, data] of Array.from(this.cache.entries())) {
      if (now > data.expiresAt) {
        this.cache.delete(key)
      }
    }
  }

  private generateCacheKey(request: TranslationRequest): string {
    // Create cache key from content hash + languages + complexity
    const keyData = {
      content: request.content.trim().toLowerCase(),
      fromLanguage: request.fromLanguage,
      toLanguage: request.toLanguage,
      complexity: request.complexity
    }
    
    // Simple hash function (in production, use a proper crypto hash)
    const keyString = JSON.stringify(keyData)
    let hash = 0
    for (let i = 0; i < keyString.length; i++) {
      const char = keyString.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // Convert to 32bit integer
    }
    
    return `translation:${Math.abs(hash).toString(36)}`
  }

  private getCacheDuration(complexity: string): number {
    // Cache duration based on complexity (in milliseconds)
    switch (complexity) {
      case "simple":
        return 4 * 60 * 60 * 1000 // 4 hours
      case "contextual":
        return 2 * 60 * 60 * 1000 // 2 hours
      case "creative":
        return 1 * 60 * 60 * 1000 // 1 hour
      case "technical":
        return 6 * 60 * 60 * 1000 // 6 hours
      default:
        return 1 * 60 * 60 * 1000 // 1 hour default
    }
  }

  get(request: TranslationRequest): StreamingTranslationResult | null {
    if (process.env.ENABLE_CACHING !== "true") {
      return null
    }

    const key = this.generateCacheKey(request)
    const cached = this.cache.get(key)
    
    if (!cached) {
      return null
    }

    if (Date.now() > cached.expiresAt) {
      this.cache.delete(key)
      return null
    }

    // Update cache hit information and request ID
    const result = { 
      ...cached.result, 
      requestId: request.requestId,
      cacheHit: true,
      backendProcessingTime: 0 // Cached response has no processing time
    }
    
    return result
  }

  set(request: TranslationRequest, result: StreamingTranslationResult): void {
    if (process.env.ENABLE_CACHING !== "true") {
      return
    }

    // Only cache completed, high-quality translations
    if (!result.isComplete || (result.confidence || 0) < 0.7) {
      return
    }

    // Don't cache very short or very long content
    if (request.content.length < 3 || request.content.length > 10000) {
      return
    }

    const key = this.generateCacheKey(request)
    const duration = this.getCacheDuration(request.complexity)
    const expiresAt = Date.now() + duration
    
    // Store the result with cache metadata
    const cacheResult = {
      ...result,
      cacheHit: false // Original result wasn't from cache
    }
    
    this.cache.set(key, {
      result: cacheResult,
      expiresAt
    })
  }

  getStats(): { size: number; hitRate?: number } {
    return {
      size: this.cache.size
    }
  }

  clear(): void {
    this.cache.clear()
  }
}

// Create cache instance
const translationCache = new InMemoryTranslationCache()

// Cache middleware for translation requests
export const cacheMiddleware = new Elysia({ name: "cache" })
  .derive(() => ({
    cache: translationCache
  }))
  .onBeforeHandle(({ body, set, cache }) => {
    // Only apply caching to translation requests
    if (typeof body === 'object' && body && 'content' in body) {
      const request = body as TranslationRequest
      const cachedResult = cache.get(request)
      
      if (cachedResult) {
        console.log(`Cache hit for request ${request.requestId}`)
        Object.assign(set.headers, {
          ...set.headers,
          "X-Cache-Status": "HIT",
          "Content-Type": "application/json"
        })
        
        return cachedResult
      } else {
        Object.assign(set.headers, {
          ...set.headers,
          "X-Cache-Status": "MISS"
        })
      }
    }
    // Don't return anything to avoid overriding the actual response
    return
  })
  .as('scoped')

// Helper function to cache translation results
export function cacheTranslationResult(request: TranslationRequest, result: StreamingTranslationResult): void {
  translationCache.set(request, result)
}

// Cache statistics endpoint
export const cacheStatsRoute = new Elysia()
  .get("/api/cache/stats", () => {
    const stats = translationCache.getStats()
    return {
      ...stats,
      enabled: process.env.ENABLE_CACHING === "true",
      timestamp: new Date().toISOString()
    }
  })
  .delete("/api/cache", () => {
    translationCache.clear()
    return {
      message: "Cache cleared successfully",
      timestamp: new Date().toISOString()
    }
  })