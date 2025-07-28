import { describe, it, expect, mock, beforeEach } from 'bun:test'
import { clearTestData } from '@babel-feed/pgdb'
import { AIIntegrationService } from '../modules/aggregator/ai-integration'

class StubProviderManager {
  count = 0
  async initialize() { return }
  async getEnabledProviders() {
    return [{ id: 'p1', name: 'openrouter', baseUrl: 'https://example.com', providerType: 'translation', metadata: { models: ['gpt-3.5-turbo'] } }]
  }
  async executeWithProvider(_id: string, fn: any) {
    this.count++
    return await fn({ baseUrl: 'https://example.com', metadata: {} } as any, { apiKey: 'key', keyValue: 'key' } as any)
  }
}

const mockOpenAI = {
  chat: { completions: { create: mock(async () => ({ choices: [{ message: { content: '你好' } }] })) } }
}

mock.module('openai', () => ({ OpenAI: function(){ return mockOpenAI } }))


describe('AIIntegrationService', () => {
  beforeEach(async () => {
    await clearTestData()
  })

  it('translates using provider manager and caches result', async () => {
    const manager = new StubProviderManager()
    const service = new AIIntegrationService(manager as any)
    await service.initialize()
    const first = await service.translateContent('hello', 'zh')
    const second = await service.translateContent('hello', 'zh')
    expect(first).toBe('你好')
    expect(second).toBe('你好')
    expect(manager.count).toBe(1)
  })
})
