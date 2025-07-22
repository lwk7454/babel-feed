import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'bun:test'
import { AiProviderManager } from '../src/ai-provider-manager'
import { getTestDb, aiProviderKeys, clearTestData } from '@babel-feed/pgdb'
import { createTestTimers } from '@babel-feed/utils'

const timer = createTestTimers({ now: 0, shouldAdvanceTime: true, advanceTimeDelta: 20 })

const manager = new AiProviderManager()
let providerId: string

beforeEach(async () => {
  await clearTestData()
  timer.reset()
  
  // Initialize manager and get provider ID for each test
  await manager.initialize()
  const [provider] = await manager.getAllProviders()
  providerId = provider.id
  await getTestDb().insert(aiProviderKeys).values([
    { providerId, keyName: 'key1', apiKey: 'k1', priority: 5 },
    { providerId, keyName: 'key2', apiKey: 'k2', priority: 5 }
  ])
  
  // Mock the delay function to be instant for tests
  const originalDelay = global.setTimeout
  global.setTimeout = ((fn: (...args: unknown[]) => void, delay: number) => {
    if (delay > 0) {
      // For retry delays, execute immediately
      fn()
      return {} as any
    }
    return originalDelay(fn, delay)
  }) as any
})

afterEach(() => {
  // Restore original setTimeout
  global.setTimeout = setTimeout
})

describe('AiProviderManager', () => {
  it('loads providers', async () => {
    const providers = await manager.getAllProviders()
    expect(providers.length).toBeGreaterThan(0)
  })

  it('rotates keys round robin', async () => {
    const first = await manager.getAvailableKey(providerId)
    const second = await manager.getAvailableKey(providerId)
    expect(first?.keyName).not.toBe(second?.keyName)
  })

  it('executes with provider and updates metrics', async () => {
    const result = await manager.executeWithProvider(providerId, async () => 'done')
    expect(result).toBe('done')
    const keys = await manager.getProviderKeys(providerId)
    const used = keys.find(k => k.successCount > 0)
    expect(used).toBeDefined()
  })

  it('handles rate limits', async () => {
    await expect(manager.executeWithProvider(providerId, async () => {
      const err = new Error('Rate limit exceeded')
      throw err
    })).rejects.toThrow('All retries exhausted')
    
    const keys = await manager.getProviderKeys(providerId)
    const limited = keys.find(k => (k.rateLimitHits || 0) > 0)
    expect(limited).toBeDefined()
  })
})
