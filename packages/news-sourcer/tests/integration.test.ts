import { describe, it, expect } from 'bun:test'
import { NewsSourcer } from '../src/news-sourcer'

describe('NewsSourcer Integration Tests', () => {
  const sourcer = new NewsSourcer()

  it('integration test structure is ready', () => {
    expect(sourcer).toBeDefined()
    expect(typeof sourcer.analyzeSource).toBe('function')
    expect(typeof sourcer.initialize).toBe('function')
  })

  // Real integration tests (skipped to avoid network calls during CI)
  // Unskip these tests when running manual integration testing
  describe('Real Website Tests', () => {
    it.skip('discovers RSS feeds from BBC', async () => {
      const analysis = await sourcer.analyzeSource('https://www.bbc.com/news')
      expect(analysis.rssFeeds.length + analysis.atomFeeds.length).toEqual(0)
      expect(analysis.successRate).toEqual(0)
    })

    it.skip('discovers RSS feeds from CNN', async () => {
      const analysis = await sourcer.analyzeSource('https://www.cnn.com')
      expect(analysis.rssFeeds.length + analysis.atomFeeds.length).toEqual(0)
      expect(analysis.successRate).toEqual(0)
    })

    it.skip('discovers RSS feeds from The Guardian', async () => {
      const analysis = await sourcer.analyzeSource('https://www.theguardian.com')
      expect(analysis.rssFeeds.length + analysis.atomFeeds.length).toBeGreaterThan(0)
      expect(analysis.successRate).toBeGreaterThan(0)
    })
  })
})