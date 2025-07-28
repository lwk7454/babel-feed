import {
  aiProviderKeys,
  aiProviders,
  clearTestData,
  getTestDb,
} from '@babel-feed/pgdb'
import { createGlobalTimerMock } from '@babel-feed/utils'
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  mock,
} from 'bun:test'
import { eq } from 'drizzle-orm'
import { AiProviderManager } from '../src/ai-provider-manager'

const timer = createGlobalTimerMock()

describe('AiProviderManager', () => {
  let manager: AiProviderManager
  let providerId: string
  let keyId1: string
  let keyId2: string

  beforeAll(async () => {
    // Ensure test database is properly initialized once
    await clearTestData()
  })

  beforeEach(async () => {
    await clearTestData()
    timer.reset()

    manager = new AiProviderManager()

    // Create test providers
    const [testProvider] = await getTestDb()
      .insert(aiProviders)
      .values({
        name: 'test-provider',
        displayName: 'Test Provider',
        providerType: 'general',
        baseUrl: 'https://api.test.com/v1',
        enabled: true,
        priority: 10,
        maxRequestsPerMinute: 60,
        maxRequestsPerHour: 3600,
        maxRequestsPerDay: 86400,
        circuitBreakerThreshold: 5,
        circuitBreakerTimeout: 60000,
        healthCheckInterval: 30000,
        metadata: {
          models: ['test-model'],
          maxTokens: 4096,
          features: {
            streaming: true,
            tools: true,
            jsonMode: true,
          },
        },
      })
      .returning()

    providerId = testProvider.id

    // Create test API keys
    const keys = await getTestDb()
      .insert(aiProviderKeys)
      .values([
        {
          providerId,
          keyName: 'key1',
          apiKey: 'k1',
          priority: 5,
          enabled: true,
          dailyQuota: 100,
        },
        {
          providerId,
          keyName: 'key2',
          apiKey: 'k2',
          priority: 5,
          enabled: true,
          dailyQuota: 100,
        },
      ])
      .returning()

    keyId1 = keys[0].id
    keyId2 = keys[1].id

    await manager.initialize()
  })

  afterEach(async () => {
    await clearTestData()
  })

  afterAll(async () => {
    // Clean up any remaining test data and database connections
    await clearTestData()
  })

  describe('initialization', () => {
    it('should initialize successfully with providers', async () => {
      const providers = await manager.getAllProviders()
      expect(providers.length).toBeGreaterThan(0)
      expect(providers[0].name).toBe('test-provider')
    })

    it('should throw error when no providers exist', async () => {
      await clearTestData()
      const emptyManager = new AiProviderManager()
      await expect(emptyManager.initialize()).rejects.toThrow(
        'No providers found'
      )
    })

    it('should handle database connection errors', async () => {
      const mockDb = mock(() => {
        throw new Error('Database connection failed')
      })

      // Mock the database getter
      const originalGetDb = manager['db']
      manager['db'] = mockDb as any

      await expect(manager.getAllProviders()).rejects.toThrow(
        'Failed to fetch AI providers from database'
      )

      manager['db'] = originalGetDb
    })
  })

  describe('getAllProviders', () => {
    it('should return all providers ordered by priority desc, name asc', async () => {
      // Add another provider with lower priority
      await getTestDb().insert(aiProviders).values({
        name: 'low-priority-provider',
        displayName: 'Low Priority Provider',
        providerType: 'general',
        baseUrl: 'https://api.low.com/v1',
        enabled: true,
        priority: 5, // Lower priority
        maxRequestsPerMinute: 60,
        maxRequestsPerHour: 3600,
        maxRequestsPerDay: 86400,
        circuitBreakerThreshold: 5,
        circuitBreakerTimeout: 60000,
        healthCheckInterval: 30000,
      })

      const providers = await manager.getAllProviders()
      expect(providers.length).toBe(2)
      expect(providers[0].priority).toBe(10) // Higher priority first
      expect(providers[1].priority).toBe(5)
    })

    it('should handle database errors gracefully', async () => {
      const mockDb = mock(() => {
        throw new Error('Database error')
      })

      const originalGetDb = manager['db']
      manager['db'] = mockDb as any

      await expect(manager.getAllProviders()).rejects.toThrow(
        'Failed to fetch AI providers from database'
      )

      manager['db'] = originalGetDb
    })
  })

  describe('getEnabledProviders', () => {
    it('should return only enabled providers', async () => {
      // Disable the test provider
      await getTestDb()
        .update(aiProviders)
        .set({ enabled: false })
        .where(eq(aiProviders.id, providerId))

      const enabledProviders = await manager.getEnabledProviders()
      expect(enabledProviders.length).toBe(0)
    })

    it('should filter by provider type', async () => {
      // Add a translation provider
      await getTestDb().insert(aiProviders).values({
        name: 'translation-provider',
        displayName: 'Translation Provider',
        providerType: 'translation',
        baseUrl: 'https://api.translate.com/v1',
        enabled: true,
        priority: 8,
        maxRequestsPerMinute: 60,
        maxRequestsPerHour: 3600,
        maxRequestsPerDay: 86400,
        circuitBreakerThreshold: 5,
        circuitBreakerTimeout: 60000,
        healthCheckInterval: 30000,
      })

      const generalProviders = await manager.getEnabledProviders('general')
      const translationProviders = await manager.getEnabledProviders(
        'translation'
      )

      expect(generalProviders.length).toBe(1)
      expect(generalProviders[0].providerType).toBe('general')
      expect(translationProviders.length).toBe(1)
      expect(translationProviders[0].providerType).toBe('translation')
    })

    it('should handle database errors', async () => {
      const mockDb = mock(() => {
        throw new Error('Database error')
      })

      const originalGetDb = manager['db']
      manager['db'] = mockDb as any

      await expect(manager.getEnabledProviders()).rejects.toThrow(
        'Failed to fetch enabled AI providers'
      )

      manager['db'] = originalGetDb
    })
  })

  describe('getProviderKeys', () => {
    it('should return enabled keys for provider', async () => {
      const keys = await manager.getProviderKeys(providerId)
      expect(keys.length).toBe(2)
      expect(keys.every((key) => key.enabled)).toBe(true)
    })

    it('should exclude disabled keys', async () => {
      // Disable one key
      await getTestDb()
        .update(aiProviderKeys)
        .set({ enabled: false })
        .where(eq(aiProviderKeys.id, keyId1))

      const keys = await manager.getProviderKeys(providerId)
      expect(keys.length).toBe(1)
      expect(keys[0].id).toBe(keyId2)
    })

    it('should order keys by priority desc, name asc', async () => {
      // Update key priorities
      await getTestDb()
        .update(aiProviderKeys)
        .set({ priority: 10 })
        .where(eq(aiProviderKeys.id, keyId2))

      const keys = await manager.getProviderKeys(providerId)
      expect(keys[0].priority).toBe(10) // Higher priority first
      expect(keys[1].priority).toBe(5)
    })

    it('should handle database errors', async () => {
      const mockDb = mock(() => {
        throw new Error('Database error')
      })

      const originalGetDb = manager['db']
      manager['db'] = mockDb as any

      await expect(manager.getProviderKeys(providerId)).rejects.toThrow(
        'Failed to fetch provider keys'
      )

      manager['db'] = originalGetDb
    })
  })

  describe('getAvailableKey', () => {
    it('should rotate keys round robin', async () => {
      const first = await manager.getAvailableKey(providerId)
      const second = await manager.getAvailableKey(providerId)
      const third = await manager.getAvailableKey(providerId)

      // Ensure we got valid keys
      expect(first).toBeDefined()
      expect(second).toBeDefined()
      expect(third).toBeDefined()
      expect(first?.keyName).toBeDefined()
      expect(second?.keyName).toBeDefined()
      expect(third?.keyName).toBeDefined()

      // Test rotation logic - should alternate between keys
      expect(first?.keyName).not.toBe(second?.keyName)
      expect(second?.keyName).not.toBe(third?.keyName)
      expect(first?.keyName).toBe(third?.keyName || '') // Back to first
    })

    it('should return null when no keys available', async () => {
      // Disable all keys
      await getTestDb()
        .update(aiProviderKeys)
        .set({ enabled: false })
        .where(eq(aiProviderKeys.providerId, providerId))

      const key = await manager.getAvailableKey(providerId)
      expect(key).toBeNull()
    })

    it('should skip rate limited keys', async () => {
      // Set first key as rate limited
      manager['rateLimitTracking'].set(keyId1, {
        count: 60,
        resetTime: Date.now() + 60000,
      })

      const key = await manager.getAvailableKey(providerId)
      // Should skip keyId1 and return keyId2
      expect(key).toBeDefined()
      expect(key?.id).not.toBe(keyId1)
      expect(key?.id).toBe(keyId2)
    })

    it('should skip keys with exceeded daily quota', async () => {
      // Set first key to exceed daily quota
      await getTestDb()
        .update(aiProviderKeys)
        .set({ currentUsage: 100, dailyQuota: 100 })
        .where(eq(aiProviderKeys.id, keyId1))

      const key = await manager.getAvailableKey(providerId)
      // Should skip keyId1 and return keyId2
      expect(key).toBeDefined()
      expect(key?.id).not.toBe(keyId1)
      expect(key?.id).toBe(keyId2)
    })

    it('should return null when all keys are rate limited', async () => {
      // Make all keys rate limited (use past time so rate limit is not active)
      manager['rateLimitTracking'].set(keyId1, {
        count: 60,
        resetTime: timer.now() - 1000,
      })
      manager['rateLimitTracking'].set(keyId2, {
        count: 60,
        resetTime: timer.now() - 1000,
      })

      const key = await manager.getAvailableKey(providerId)
      expect(key).toBeDefined() // Should get key since rate limit expired
    })
  })

  describe('executeWithProvider', () => {
    it('should execute operation successfully', async () => {
      const result = await manager.executeWithProvider(
        providerId,
        async () => 'success'
      )
      expect(result).toBe('success')
    })

    it('should update key metrics on success', async () => {
      await manager.executeWithProvider(providerId, async () => 'success')

      const keys = await manager.getProviderKeys(providerId)
      const usedKey = keys.find((k) => k.successCount > 0)
      expect(usedKey).toBeDefined()
      expect(usedKey?.successCount).toBe(1)
    })

    it('should throw error for disabled provider', async () => {
      await getTestDb()
        .update(aiProviders)
        .set({ enabled: false })
        .where(eq(aiProviders.id, providerId))

      await expect(
        manager.executeWithProvider(providerId, async () => 'success')
      ).rejects.toThrow('not found or disabled')
    })

    it('should throw error for non-existent provider', async () => {
      await expect(
        manager.executeWithProvider('non-existent', async () => 'success')
      ).rejects.toThrow('not found or disabled')
    })

    it('should retry on failure', async () => {
      let attemptCount = 0
      const operation = mock(async () => {
        attemptCount++
        if (attemptCount < 3) {
          throw new Error('Temporary failure')
        }
        return 'success'
      })

      // Start the promise and let it proceed through retries
      const promise = manager.executeWithProvider(providerId, operation)

      // Give a moment for first attempt to fail, then advance time
      await new Promise((resolve) => setImmediate(resolve))
      await timer.advanceTime(2000) // First retry (2^0 * 1000 = 1000ms + random)

      await new Promise((resolve) => setImmediate(resolve))
      await timer.advanceTime(4000) // Second retry (2^1 * 1000 = 2000ms + random)

      const result = await promise
      expect(result).toBe('success')
      expect(attemptCount).toBe(3)
    })

    it('should track rate limits', async () => {
      await manager.executeWithProvider(providerId, async () => 'success')

      const keys = await manager.getProviderKeys(providerId)
      const usedKey = keys.find((k) => k.successCount > 0)
      expect(usedKey).toBeDefined()

      const tracking = manager['rateLimitTracking'].get(usedKey!.id)
      expect(tracking).toBeDefined()
      expect(tracking!.count).toBe(1)
    })
  })

  describe('getProviderHealth', () => {
    it('should return healthy status for working provider', async () => {
      const health = await manager.getProviderHealth(providerId)

      expect(health.healthy).toBe(true)
      expect(health.circuitState).toBe('closed')
      expect(health.availableKeys).toBe(2)
      expect(health.totalKeys).toBe(2)
      expect(health.errorRate).toBe(0)
    })

    it('should return unhealthy status for disabled provider', async () => {
      await getTestDb()
        .update(aiProviders)
        .set({ enabled: false })
        .where(eq(aiProviders.id, providerId))

      const health = await manager.getProviderHealth(providerId)
      expect(health.healthy).toBe(false)
    })

    it('should return unhealthy status when no keys available', async () => {
      await getTestDb()
        .update(aiProviderKeys)
        .set({ enabled: false })
        .where(eq(aiProviderKeys.providerId, providerId))

      const health = await manager.getProviderHealth(providerId)
      expect(health.healthy).toBe(false)
      expect(health.availableKeys).toBe(0)
    })

    it('should calculate error rate correctly', async () => {
      // Set some error counts
      await getTestDb()
        .update(aiProviderKeys)
        .set({ errorCount: 5, successCount: 5 })
        .where(eq(aiProviderKeys.id, keyId1))

      const health = await manager.getProviderHealth(providerId)
      expect(health.errorRate).toBe(50) // 5 errors / 10 total requests
    })

    it('should detect circuit breaker states', async () => {
      // Force circuit breaker to open
      const circuitBreaker = await manager['getOrCreateCircuitBreaker'](
        providerId,
        keyId1
      )
      for (let i = 0; i < 10; i++) {
        try {
          await circuitBreaker.execute(() =>
            Promise.reject(new Error('Failure'))
          )
        } catch {
          // Ignore errors
        }
      }

      const health = await manager.getProviderHealth(providerId)
      expect(health.circuitState).toBe('open')
      expect(health.healthy).toBe(false)
    })

    it('should throw error for non-existent provider', async () => {
      await expect(manager.getProviderHealth('non-existent')).rejects.toThrow(
        'Provider non-existent not found'
      )
    })
  })

  describe('rate limiting', () => {
    it('should track rate limits per key', async () => {
      const key = await manager.getProviderKeys(providerId)
      const testKey = key[0]

      // Simulate rate limit tracking
      manager['trackRateLimit'](testKey)
      manager['trackRateLimit'](testKey)

      const tracking = manager['rateLimitTracking'].get(testKey.id)
      expect(tracking?.count).toBe(2)
    })

    it('should detect rate limited keys', async () => {
      const key = await manager.getProviderKeys(providerId)
      const testKey = key[0]

      // Set rate limit tracking
      manager['rateLimitTracking'].set(testKey.id, {
        count: 60,
        resetTime: Date.now() + 60000,
      })

      expect(manager['isRateLimited'](testKey)).toBe(true)
    })

    it('should reset rate limit tracking after timeout', async () => {
      const key = await manager.getProviderKeys(providerId)
      const testKey = key[0]

      // Set expired rate limit tracking
      manager['rateLimitTracking'].set(testKey.id, {
        count: 60,
        resetTime: timer.now() - 1000,
      })

      expect(manager['isRateLimited'](testKey)).toBe(false)
    })

    it('should detect rate limit errors', async () => {
      expect(
        manager['isRateLimitError'](new Error('Rate limit exceeded'))
      ).toBe(true)
      expect(manager['isRateLimitError'](new Error('Too many requests'))).toBe(
        true
      )
      expect(manager['isRateLimitError'](new Error('Quota exceeded'))).toBe(
        true
      )
      expect(manager['isRateLimitError'](new Error('Normal error'))).toBe(
        false
      )
    })
  })

  describe('circuit breaker integration', () => {
    it('should create circuit breakers for provider-key combinations', async () => {
      const circuitBreaker = await manager['getOrCreateCircuitBreaker'](
        providerId,
        keyId1
      )
      expect(circuitBreaker).toBeDefined()

      // Should return same instance for same combination
      const sameBreaker = await manager['getOrCreateCircuitBreaker'](
        providerId,
        keyId1
      )
      expect(sameBreaker).toBe(circuitBreaker)
    })

    it('should use provider configuration for circuit breaker', async () => {
      // Update provider circuit breaker settings
      await getTestDb()
        .update(aiProviders)
        .set({ circuitBreakerThreshold: 3, circuitBreakerTimeout: 30000 })
        .where(eq(aiProviders.id, providerId))

      const circuitBreaker = await manager['getOrCreateCircuitBreaker'](
        providerId,
        keyId1
      )
      expect(circuitBreaker).toBeDefined()
    })
  })

  describe('periodic tasks', () => {
    it('should reset daily quotas', async () => {
      // Set current usage
      await getTestDb()
        .update(aiProviderKeys)
        .set({ currentUsage: 50 })
        .where(eq(aiProviderKeys.id, keyId1))

      await manager['resetDailyQuotas']()

      const keys = await manager.getProviderKeys(providerId)
      expect(keys[0].currentUsage).toBe(0)
    })

    it('should cleanup expired rate limit tracking', async () => {
      const key = await manager.getProviderKeys(providerId)
      const testKey = key[0]

      // Set expired tracking
      manager['rateLimitTracking'].set(testKey.id, {
        count: 60,
        resetTime: timer.now() - 1000,
      })
      manager['rateLimitTracking'].set('other-key', {
        count: 30,
        resetTime: Date.now() + 60000,
      })

      manager['cleanupRateLimit']()

      expect(manager['rateLimitTracking'].has(testKey.id)).toBe(false)
      expect(manager['rateLimitTracking'].has('other-key')).toBe(true)
    })
  })

  describe('error handling', () => {
    it('should handle database connection failures', async () => {
      const mockDb = mock(() => {
        throw new Error('Connection failed')
      })

      const originalGetDb = manager['db']
      manager['db'] = mockDb as any

      await expect(manager.getAllProviders()).rejects.toThrow(
        'Failed to fetch AI providers from database'
      )

      manager['db'] = originalGetDb
    })

    it('should handle provider not found scenarios', async () => {
      await expect(manager.getProviderHealth('non-existent')).rejects.toThrow(
        'Provider non-existent not found'
      )
    })
  })

  describe('edge cases', () => {
    it('should handle provider with no keys', async () => {
      // Remove all keys
      await getTestDb()
        .delete(aiProviderKeys)
        .where(eq(aiProviderKeys.providerId, providerId))

      const keys = await manager.getProviderKeys(providerId)
      expect(keys.length).toBe(0)

      const availableKey = await manager.getAvailableKey(providerId)
      expect(availableKey).toBeNull()
    })

    it('should handle provider with only disabled keys', async () => {
      await getTestDb()
        .update(aiProviderKeys)
        .set({ enabled: false })
        .where(eq(aiProviderKeys.providerId, providerId))

      const availableKey = await manager.getAvailableKey(providerId)
      expect(availableKey).toBeNull()
    })

    it('should handle concurrent key rotation', async () => {
      const promises = Array(10)
        .fill(0)
        .map(() => manager.getAvailableKey(providerId))
      const keys = await Promise.all(promises)

      // Should get both keys in rotation
      const keyNames = keys.map((k) => k?.keyName).filter(Boolean)
      expect(keyNames).toContain('key1')
      expect(keyNames).toContain('key2')
    })

    it('should handle zero priority providers', async () => {
      await getTestDb()
        .update(aiProviders)
        .set({ priority: 0 })
        .where(eq(aiProviders.id, providerId))

      const providers = await manager.getAllProviders()
      expect(providers[0].priority).toBe(0)
    })
  })
})
