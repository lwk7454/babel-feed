import { describe, it, expect, beforeEach, mock } from 'bun:test'
import { NewsSourcer } from '../src/news-sourcer'

// Mock axios to avoid real HTTP calls in tests
const mockAxiosGet = mock()
const mockAxiosHead = mock()
mock.module('axios', () => ({
  default: {
    get: mockAxiosGet,
    head: mockAxiosHead
  }
}))

describe('NewsSourcer', () => {
  let sourcer: NewsSourcer

  beforeEach(() => {
    sourcer = new NewsSourcer()
    mockAxiosGet.mockClear()
    mockAxiosHead.mockClear()
  })

  describe('Initialization', () => {
    it('initializes without error', async () => {
      await expect(sourcer.initialize()).resolves.toBeUndefined()
    })

    it('has the correct interface', () => {
      expect(typeof sourcer.analyzeSource).toBe('function')
      expect(typeof sourcer.initialize).toBe('function')
    })
  })

  describe('RSS/Atom Feed Discovery', () => {
    it('discovers RSS feeds from HTML link tags', async () => {
      const htmlWithRssLink = `
        <html>
          <head>
            <link rel="alternate" type="application/rss+xml" href="/rss.xml" title="RSS Feed">
            <link rel="alternate" type="application/atom+xml" href="/atom.xml" title="Atom Feed">
          </head>
          <body>Content</body>
        </html>
      `
      
      mockAxiosGet.mockResolvedValueOnce({ data: htmlWithRssLink })
      
      // Mock feed validation responses
      mockAxiosGet.mockResolvedValueOnce({ 
        data: '<rss><channel><item><title>Test</title><link>https://example.com/article1</link></item></channel></rss>' 
      })
      mockAxiosGet.mockResolvedValueOnce({ 
        data: '<feed><entry><title>Test</title><link href="https://example.com/article2" /></entry></feed>' 
      })
      
      const analysis = await sourcer.analyzeSource('https://example.com')
      
      expect(analysis.rssFeeds).toHaveLength(1)
      expect(analysis.atomFeeds).toHaveLength(1)
      expect(analysis.rssFeeds[0].url).toBe('https://example.com/rss.xml')
      expect(analysis.atomFeeds[0].url).toBe('https://example.com/atom.xml')
    })

    it('discovers feeds from common paths', async () => {
      mockAxiosGet.mockResolvedValueOnce({ data: '<html><body>No RSS links</body></html>' })
      
      // Mock successful HEAD request for /rss path
      mockAxiosHead.mockResolvedValueOnce({ 
        status: 200, 
        headers: { 'content-type': 'application/rss+xml' }
      })
      
      // Mock other paths failing
      mockAxiosHead.mockRejectedValue(new Error('Not found'))
      
      // Mock feed validation
      mockAxiosGet.mockResolvedValueOnce({ 
        data: '<rss><channel><item><title>Test</title><link>https://example.com/article1</link></item></channel></rss>' 
      })
      
      const analysis = await sourcer.analyzeSource('https://example.com')
      
      expect(analysis.rssFeeds).toHaveLength(1)
      expect(analysis.rssFeeds[0].url).toBe('https://example.com/rss')
    })

    it('validates RSS feeds correctly', async () => {
      const rssXml = `
        <rss version="2.0">
          <channel>
            <title>Test RSS</title>
            <item>
              <title>Article 1</title>
              <link>https://example.com/article1</link>
            </item>
            <item>
              <title>Article 2</title>
              <link>https://example.com/article2</link>
            </item>
          </channel>
        </rss>
      `
      
      mockAxiosGet.mockResolvedValueOnce({ data: '<html><body>No RSS links</body></html>' })
      mockAxiosHead.mockResolvedValueOnce({ 
        status: 200, 
        headers: { 'content-type': 'application/rss+xml' }
      })
      mockAxiosGet.mockResolvedValueOnce({ data: rssXml })
      
      const analysis = await sourcer.analyzeSource('https://example.com')
      
      const validationResult = analysis.validationResults.get('https://example.com/rss')
      expect(validationResult?.valid).toBe(true)
      expect(validationResult?.feedType).toBe('rss')
      expect(validationResult?.articleCount).toBe(2)
      expect(validationResult?.sampleUrls).toContain('https://example.com/article1')
    })

    it('validates Atom feeds correctly', async () => {
      const atomXml = `
        <feed xmlns="http://www.w3.org/2005/Atom">
          <title>Test Atom</title>
          <entry>
            <title>Article 1</title>
            <link href="https://example.com/article1"/>
          </entry>
          <entry>
            <title>Article 2</title>
            <link href="https://example.com/article2"/>
          </entry>
        </feed>
      `
      
      mockAxiosGet.mockResolvedValueOnce({ data: '<html><body>No RSS links</body></html>' })
      mockAxiosHead.mockResolvedValueOnce({ 
        status: 200, 
        headers: { 'content-type': 'application/atom+xml' }
      })
      mockAxiosGet.mockResolvedValueOnce({ data: atomXml })
      
      const analysis = await sourcer.analyzeSource('https://example.com')
      
      const validationResult = analysis.validationResults.get('https://example.com/rss')
      expect(validationResult?.valid).toBe(true)
      expect(validationResult?.feedType).toBe('atom')
      expect(validationResult?.articleCount).toBe(2)
      expect(validationResult?.sampleUrls).toHaveLength(2)
    })

    it('handles invalid feeds gracefully', async () => {
      mockAxiosGet.mockResolvedValueOnce({ data: '<html><body>No RSS links</body></html>' })
      mockAxiosHead.mockResolvedValueOnce({ 
        status: 200, 
        headers: { 'content-type': 'application/rss+xml' }
      })
      mockAxiosGet.mockResolvedValueOnce({ data: 'Invalid XML content' })
      
      const analysis = await sourcer.analyzeSource('https://example.com')
      
      const validationResult = analysis.validationResults.get('https://example.com/rss')
      expect(validationResult?.valid).toBe(false)
      expect(validationResult?.feedType).toBe('unknown')
      expect(validationResult?.error).toBeDefined()
    })

    it('calculates success rate correctly', async () => {
      const htmlWithRssLink = `
        <html>
          <head>
            <link rel="alternate" type="application/rss+xml" href="/rss.xml" title="RSS Feed">
          </head>
          <body>Content</body>
        </html>
      `
      
      mockAxiosGet.mockResolvedValueOnce({ data: htmlWithRssLink })
      mockAxiosGet.mockResolvedValueOnce({ 
        data: '<rss><channel><item><title>Test</title><link>https://example.com/article1</link></item></channel></rss>' 
      })
      
      const analysis = await sourcer.analyzeSource('https://example.com')
      
      expect(analysis.totalEndpoints).toBe(1)
      expect(analysis.successRate).toBe(1.0)
    })
  })
})