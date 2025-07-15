import { describe, it, expect } from 'bun:test'
import { NewsSourcer } from '../src/news-sourcer'
import type { LlmProviderClient } from '../src/types'

const mockClient: LlmProviderClient = {
  async initialize() {},
  async getEnabledProviders() {
    return [{
      id: 'p1', name: 'mock', providerType: 'translation', baseUrl: '', enabled: true,
      priority: 1, maxRequestsPerMinute: 60, maxRequestsPerHour: 1000, maxRequestsPerDay: 10000,
      circuitBreakerThreshold: 5, circuitBreakerTimeout: 60000, createdAt: new Date(), updatedAt: new Date(),
      metadata: {}
    }]
  },
  async executeWithProvider() {
    return '[{"url":"https://example.com/rss","type":"rss"}]'
  }
}

const sourcer = new NewsSourcer(mockClient)

describe('NewsSourcer', () => {
  it('parses endpoints from LLM output', async () => {
    const res = await sourcer.analyzeSource('https://example.com')
    expect(res.length).toBe(1)
    expect(res[0].type).toBe('rss')
  })
})
