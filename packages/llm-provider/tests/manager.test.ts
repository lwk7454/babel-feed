import { describe, it, expect, beforeAll, afterAll } from 'bun:test'
import { AiProviderManager } from '../src/ai-provider-manager'
import { setupTestDatabase, cleanupTestDatabase, getTestDb, aiProviderKeys } from '@babel-feed/pgdb'

const manager = new AiProviderManager()
let providerId: string

beforeAll(async () => {
  await setupTestDatabase()
  await manager.initialize()
  const [provider] = await manager.getAllProviders()
  providerId = provider.id
  await getTestDb()
  await getTestDb().insert(aiProviderKeys).values([
    { providerId, keyName: 'key1', apiKey: 'k1', priority: 5 },
    { providerId, keyName: 'key2', apiKey: 'k2', priority: 5 }
  ])
})

afterAll(async () => {
  await cleanupTestDatabase()
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
