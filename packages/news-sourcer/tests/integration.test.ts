import { describe, it, expect } from 'bun:test'
import { NewsSourcer } from '../src/news-sourcer'

describe('NewsSourcer Integration Tests', () => {
  const sourcer = new NewsSourcer()

  it('integration test structure is ready', () => {
    expect(sourcer).toBeDefined()
    expect(typeof sourcer.analyzeSource).toBe('function')
    expect(typeof sourcer.analyzeHtmlSource).toBe('function')
    expect(typeof sourcer.initialize).toBe('function')
  })

  // Real integration tests (skipped to avoid network calls during CI)
  // Unskip these tests when running manual integration testing
  describe('Real Website Feed Discovery', () => {
    it.skip('discovers feeds from BBC News', async () => {
      await sourcer.initialize()
      const analysis = await sourcer.analyzeSource('https://www.bbc.com/news')
      expect(analysis.rssFeeds.length + analysis.atomFeeds.length).toBeGreaterThanOrEqual(0)
      expect(analysis.successRate).toBeGreaterThanOrEqual(0)
    })

    it.skip('discovers feeds from CNN', async () => {
      await sourcer.initialize()
      const analysis = await sourcer.analyzeSource('https://www.cnn.com')
      expect(analysis.rssFeeds.length + analysis.atomFeeds.length).toBeGreaterThanOrEqual(0)
      expect(analysis.successRate).toBeGreaterThanOrEqual(0)
    })

    it.skip('discovers feeds from The Guardian', async () => {
      await sourcer.initialize()
      const analysis = await sourcer.analyzeSource('https://www.theguardian.com')
      expect(analysis.rssFeeds.length + analysis.atomFeeds.length).toBeGreaterThan(0)
      expect(analysis.successRate).toBeGreaterThan(0)
    })
  })

  describe('Real Website HTML Analysis', () => {
    it.skip('analyzes HTML structure for sites without feeds', async () => {
      await sourcer.initialize()
      // Test with a site that doesn't have RSS feeds
      const analysis = await sourcer.analyzeHtmlSource('https://example-news-site.com')
      expect(analysis.endpoints.length).toBeGreaterThanOrEqual(0)
      expect(analysis.analysisMetadata.iterations).toBeGreaterThan(0)
    })
  })
})