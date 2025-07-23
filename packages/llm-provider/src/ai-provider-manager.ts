import {
  aiProviderKeys,
  aiProviders,
  getDatabase,
  getTestDb,
  type AiProvider as DbAiProvider,
  type AiProviderKey as DbAiProviderKey,
  type NewAiProvider
} from '@babel-feed/pgdb'
import { and, asc, desc, eq, gte, inArray } from 'drizzle-orm'
import { AiProvider, AiProviderKey, ProviderHealthStatus, LlmProviderError, CircuitBreakerOptions } from './types'
import { logger } from '@babel-feed/utils'
import { CircuitBreaker } from './circuit-breaker'

export class AiProviderManager {
  private db: Awaited<ReturnType<typeof getDatabase | typeof getTestDb>> | undefined
  private circuitBreakers = new Map<string, CircuitBreaker>()
  private keyRotationIndex = new Map<string, number>()
  private rateLimitTracking = new Map<string, { count: number; resetTime: number }>()

  async initialize(): Promise<void> {
    this.db = getDatabase()

    const existingProviders = await this.getAllProviders()

    await this.initializeCircuitBreakers()
    this.startPeriodicTasks()
  }

  async getAllProviders(): Promise<AiProvider[]> {
    try {
      const providers = await this.db!
        .select()
        .from(aiProviders)
        .orderBy(desc(aiProviders.priority), asc(aiProviders.name))
      
      if (providers.length === 0) {
        throw new Error('No providers found, please seed initial providers')
      }

      return providers.map(this.mapDbProviderToAiProvider)
    } catch (error) {
      logger.error('Failed to fetch AI providers:', error)
      throw new LlmProviderError('Failed to fetch AI providers from database', 'DATABASE_ERROR')
    }
  }

  async getEnabledProviders(providerType?: string): Promise<AiProvider[]> {
    try {
      let whereCondition = eq(aiProviders.enabled, true)
      if (providerType) {
        whereCondition = and(whereCondition, eq(aiProviders.providerType, providerType))!
      }
      const providers = await this.db!
        .select()
        .from(aiProviders)
        .where(whereCondition)
        .orderBy(desc(aiProviders.priority), asc(aiProviders.name))
      return providers.map(this.mapDbProviderToAiProvider)
    } catch (error) {
      logger.error('Failed to fetch enabled AI providers:', error)
      throw new LlmProviderError('Failed to fetch enabled AI providers', 'DATABASE_ERROR')
    }
  }

  async getProviderKeys(providerId: string): Promise<AiProviderKey[]> {
    try {
      const keys = await this.db!
        .select()
        .from(aiProviderKeys)
        .where(and(eq(aiProviderKeys.providerId, providerId), eq(aiProviderKeys.enabled, true)))
        .orderBy(desc(aiProviderKeys.priority), asc(aiProviderKeys.keyName))
      return keys.map(this.mapDbKeyToAiProviderKey)
    } catch (error) {
      logger.error(`Failed to fetch keys for provider ${providerId}:`, error)
      throw new LlmProviderError('Failed to fetch provider keys', 'DATABASE_ERROR')
    }
  }

  async getAvailableKey(providerId: string): Promise<AiProviderKey | null> {
    const keys = await this.getProviderKeys(providerId)
    if (keys.length === 0) return null
    const availableKeys = keys.filter(key => {
      const circuitBreaker = this.circuitBreakers.get(`${providerId}:${key.id}`)
      return !circuitBreaker || !circuitBreaker.isOpen()
    })
    if (availableKeys.length === 0) return null
    const currentIndex = this.keyRotationIndex.get(providerId) || 0
    const selectedKey = availableKeys[currentIndex % availableKeys.length]
    this.keyRotationIndex.set(providerId, (currentIndex + 1) % availableKeys.length)
    if (this.isRateLimited(selectedKey)) {
      const nextIndex = (currentIndex + 1) % availableKeys.length
      if (nextIndex !== currentIndex) {
        this.keyRotationIndex.set(providerId, nextIndex)
        return this.getAvailableKey(providerId)
      }
      return null
    }
    return selectedKey
  }

  async executeWithProvider<T>(providerId: string, operation: (provider: AiProvider, key: AiProviderKey) => Promise<T>, retries = 3): Promise<T> {
    const provider = await this.getProviderById(providerId)
    if (!provider || !provider.enabled) throw new LlmProviderError(`Provider ${providerId} not found or disabled`, 'PROVIDER_UNAVAILABLE')
    for (let attempt = 0; attempt < retries; attempt++) {
      const key = await this.getAvailableKey(providerId)
      if (!key) {
        logger.warn(`No available keys for provider ${providerId} on attempt ${attempt + 1}`)
        if (attempt < retries - 1) {
          await this.delay(Math.pow(2, attempt) * 1000)
          continue
        }
        throw new LlmProviderError(`No available keys for provider ${providerId}`, 'NO_AVAILABLE_KEYS')
      }
      const circuitBreaker = this.getOrCreateCircuitBreaker(providerId, key.id)
      try {
        const result = await circuitBreaker.execute(async () => {
          this.trackRateLimit(key)
          const startTime = Date.now()
          try {
            const result = await operation(provider, key)
            await this.updateKeyMetrics(key.id, {
              lastUsed: new Date(),
              successCount: key.successCount + 1,
              currentUsage: (key.currentUsage || 0) + 1
            })
            logger.debug(`AI operation successful for ${providerId}:${key.keyName} in ${Date.now() - startTime}ms`)
            return result
          } catch (error) {
            if (this.isRateLimitError(error)) {
              await this.handleRateLimit(key)
              throw new LlmProviderError('Rate limit exceeded', 'RATE_LIMIT', 429)
            }
            await this.updateKeyMetrics(key.id, {
              errorCount: key.errorCount + 1,
              rateLimitHits: this.isRateLimitError(error) ? (key.rateLimitHits || 0) + 1 : (key.rateLimitHits || 0)
            })
            throw error
          }
        })
        return result
      } catch (error) {
        logger.warn(`AI operation failed for ${providerId}:${key.keyName} on attempt ${attempt + 1}:`, error)
        if (attempt < retries - 1) {
          await this.delay(Math.pow(2, attempt) * 1000 + Math.random() * 1000)
        }
      }
    }
    throw new LlmProviderError(`All retries exhausted for provider ${providerId}`, 'OPERATION_FAILED', 500)
  }

  async getProviderHealth(providerId: string): Promise<ProviderHealthStatus> {
    const provider = await this.getProviderById(providerId)
    const keys = await this.getProviderKeys(providerId)
    if (!provider) throw new LlmProviderError(`Provider ${providerId} not found`, 'NOT_FOUND', 404)
    const availableKeys = keys.filter(key => {
      const circuitBreaker = this.circuitBreakers.get(`${providerId}:${key.id}`)
      return !circuitBreaker || !circuitBreaker.isOpen()
    })
    const totalRequests = keys.reduce((sum, key) => sum + key.successCount + key.errorCount, 0)
    const errorCount = keys.reduce((sum, key) => sum + key.errorCount, 0)
    const errorRate = totalRequests > 0 ? (errorCount / totalRequests) * 100 : 0
    let circuitState: 'closed' | 'open' | 'half-open' = 'closed'
    for (const key of keys) {
      const breaker = this.circuitBreakers.get(`${providerId}:${key.id}`)
      if (breaker?.isOpen()) { circuitState = 'open'; break }
      else if (breaker?.isHalfOpen()) circuitState = 'half-open'
    }
    return {
      healthy: provider.enabled && availableKeys.length > 0 && errorRate < 50,
      circuitState,
      availableKeys: availableKeys.length,
      totalKeys: keys.length,
      errorRate,
      lastCheck: new Date()
    }
  }

  private async getProviderById(id: string): Promise<AiProvider | null> {
    try {
      const providers = await this.db!
        .select()
        .from(aiProviders)
        .where(eq(aiProviders.id, id))
        .limit(1)
      return providers.length > 0 ? this.mapDbProviderToAiProvider(providers[0]) : null
    } catch (error) {
      logger.error(`Failed to fetch provider ${id}:`, error)
      return null
    }
  }

  private getOrCreateCircuitBreaker(providerId: string, keyId: string): CircuitBreaker {
    const breakerId = `${providerId}:${keyId}`
    if (!this.circuitBreakers.has(breakerId)) {
      this.getProviderById(providerId).then(provider => {
        if (provider) {
          const options: CircuitBreakerOptions = {
            threshold: provider.circuitBreakerThreshold,
            timeout: provider.circuitBreakerTimeout,
            resetTimeout: provider.healthCheckInterval || 30000
          }
          this.circuitBreakers.set(breakerId, new CircuitBreaker(breakerId, options))
        }
      })
      const defaultOptions: CircuitBreakerOptions = { threshold: 5, timeout: 60000, resetTimeout: 30000 }
      this.circuitBreakers.set(breakerId, new CircuitBreaker(breakerId, defaultOptions))
    }
    return this.circuitBreakers.get(breakerId)!
  }

  private isRateLimited(key: AiProviderKey): boolean {
    const trackingKey = key.id
    const tracking = this.rateLimitTracking.get(trackingKey)
    if (!tracking) return false
    const now = Date.now()
    if (now >= tracking.resetTime) { this.rateLimitTracking.delete(trackingKey); return false }
    if (key.dailyQuota && (key.currentUsage || 0) >= key.dailyQuota) return true
    return tracking.count >= 60
  }

  private trackRateLimit(key: AiProviderKey): void {
    const trackingKey = key.id
    const now = Date.now()
    const resetTime = now + 60000
    const tracking = this.rateLimitTracking.get(trackingKey)
    if (!tracking || now >= tracking.resetTime) {
      this.rateLimitTracking.set(trackingKey, { count: 1, resetTime })
    } else {
      tracking.count++
    }
  }

  private isRateLimitError(error: unknown): boolean {
    if (error instanceof Error) {
      const message = error.message.toLowerCase()
      return message.includes('rate limit') || message.includes('too many requests') || message.includes('quota exceeded')
    }
    return false
  }

  private async handleRateLimit(key: AiProviderKey): Promise<void> {
    logger.warn(`Rate limit hit for key ${key.keyName}`)
    await this.updateKeyMetrics(key.id, { rateLimitHits: (key.rateLimitHits || 0) + 1 })
  }

  private async updateKeyMetrics(keyId: string, updates: Partial<AiProviderKey>): Promise<void> {
    try {
      await this.db!
        .update(aiProviderKeys)
        .set({
          ...(updates.lastUsed && { lastUsed: updates.lastUsed }),
          ...(updates.successCount !== undefined && { successCount: updates.successCount }),
          ...(updates.errorCount !== undefined && { errorCount: updates.errorCount }),
          ...(updates.rateLimitHits !== undefined && { rateLimitHits: updates.rateLimitHits }),
          ...(updates.currentUsage !== undefined && { currentUsage: updates.currentUsage }),
        })
        .where(eq(aiProviderKeys.id, keyId))
    } catch (error) {
      logger.error(`Failed to update key metrics for ${keyId}:`, error)
    }
  }

  private async initializeCircuitBreakers(): Promise<void> {
    const providers = await this.getAllProviders()
    for (const provider of providers) {
      const keys = await this.getProviderKeys(provider.id)
      for (const key of keys) {
        this.getOrCreateCircuitBreaker(provider.id, key.id)
      }
    }
  }

  private startPeriodicTasks(): void {
    setInterval(() => { this.resetDailyQuotas() }, 24 * 60 * 60 * 1000)
    setInterval(() => { this.cleanupRateLimit() }, 5 * 60 * 1000)
  }

  private async resetDailyQuotas(): Promise<void> {
    try {
      await this.db!
        .update(aiProviderKeys)
        .set({ currentUsage: 0, updatedAt: new Date() })
        .where(gte(aiProviderKeys.lastReset, new Date(Date.now() - 24 * 60 * 60 * 1000)))
      logger.info('Daily quotas reset for all provider keys')
    } catch (error) {
      logger.error('Failed to reset daily quotas:', error)
    }
  }

  private cleanupRateLimit(): void {
    const now = Date.now()
    for (const [key, tracking] of this.rateLimitTracking.entries()) {
      if (now >= tracking.resetTime) this.rateLimitTracking.delete(key)
    }
  }

  private delay(ms: number): Promise<void> { return new Promise(resolve => setTimeout(resolve, ms)) }

  private mapDbProviderToAiProvider(dbProvider: DbAiProvider): AiProvider {
    return {
      id: dbProvider.id,
      name: dbProvider.name,
      displayName: dbProvider.displayName,
      providerType: dbProvider.providerType,
      baseUrl: dbProvider.baseUrl,
      enabled: dbProvider.enabled,
      priority: dbProvider.priority,
      maxRequestsPerMinute: dbProvider.maxRequestsPerMinute,
      maxRequestsPerHour: dbProvider.maxRequestsPerHour,
      maxRequestsPerDay: dbProvider.maxRequestsPerDay,
      circuitBreakerThreshold: dbProvider.circuitBreakerThreshold,
      circuitBreakerTimeout: dbProvider.circuitBreakerTimeout,
      healthCheckInterval: dbProvider.healthCheckInterval,
      createdAt: dbProvider.createdAt,
      updatedAt: dbProvider.updatedAt,
    }
  }

  private mapDbKeyToAiProviderKey(dbKey: DbAiProviderKey): AiProviderKey {
    return {
      id: dbKey.id,
      providerId: dbKey.providerId,
      keyName: dbKey.keyName,
      keyValue: dbKey.apiKey,
      apiKey: dbKey.apiKey,
      enabled: dbKey.enabled,
      currentUsage: dbKey.currentUsage,
      dailyQuota: dbKey.dailyQuota || undefined,
      lastUsed: dbKey.lastUsed || undefined,
      rateLimitHits: dbKey.rateLimitHits,
      errorCount: dbKey.errorCount,
      successCount: dbKey.successCount,
      createdAt: dbKey.createdAt,
      updatedAt: dbKey.updatedAt,
    }
  }

  async bulkEnableProviders(providerIds: string[]): Promise<void> {
    try {
      if (providerIds.length === 0) return
      await this.db!
        .update(aiProviders)
        .set({ enabled: true })
        .where(inArray(aiProviders.id, providerIds))
      logger.info(`Bulk enabled ${providerIds.length} AI providers`)
    } catch (error) {
      logger.error('Failed to bulk enable AI providers:', error)
      throw new LlmProviderError('Failed to bulk enable AI providers', 'DATABASE_ERROR')
    }
  }

  async bulkDisableProviders(providerIds: string[]): Promise<void> {
    try {
      if (providerIds.length === 0) return
      await this.db!
        .update(aiProviders)
        .set({ enabled: false })
        .where(inArray(aiProviders.id, providerIds))
      logger.info(`Bulk disabled ${providerIds.length} AI providers`)
    } catch (error) {
      logger.error('Failed to bulk disable AI providers:', error)
      throw new LlmProviderError('Failed to bulk disable AI providers', 'DATABASE_ERROR')
    }
  }

  async bulkEnableKeys(keyIds: string[]): Promise<void> {
    try {
      if (keyIds.length === 0) return
      await this.db!
        .update(aiProviderKeys)
        .set({ enabled: true })
        .where(inArray(aiProviderKeys.id, keyIds))
      logger.info(`Bulk enabled ${keyIds.length} AI provider keys`)
    } catch (error) {
      logger.error('Failed to bulk enable AI provider keys:', error)
      throw new LlmProviderError('Failed to bulk enable AI provider keys', 'DATABASE_ERROR')
    }
  }

  async bulkDisableKeys(keyIds: string[]): Promise<void> {
    try {
      if (keyIds.length === 0) return
      await this.db!
        .update(aiProviderKeys)
        .set({ enabled: false })
        .where(inArray(aiProviderKeys.id, keyIds))
      logger.info(`Bulk disabled ${keyIds.length} AI provider keys`)
    } catch (error) {
      logger.error('Failed to bulk disable AI provider keys:', error)
      throw new LlmProviderError('Failed to bulk disable AI provider keys', 'DATABASE_ERROR')
    }
  }
}
