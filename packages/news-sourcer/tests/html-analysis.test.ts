import { describe, it, expect, beforeEach, afterEach, mock } from 'bun:test'
import { NewsSourcer } from '../src/news-sourcer'
import type { SourceAnalysisResult, DiscoveredEndpoint, ValidationResult } from '../src/types'

// Mock axios
const mockAxiosGet = mock()
const mockAxiosHead = mock()
mock.module('axios', () => ({
  default: {
    get: mockAxiosGet,
    head: mockAxiosHead
  }
}))

// Mock pgdb
const mockDb = {
  select: mock().mockReturnThis(),
  from: mock().mockReturnThis(),
  where: mock().mockReturnThis(),
  orderBy: mock().mockReturnThis(),
  limit: mock().mockReturnThis(),
  offset: mock().mockReturnThis(),
  insert: mock().mockReturnThis(),
  values: mock().mockReturnThis(),
  returning: mock().mockResolvedValue([{
    id: 'test-endpoint-id',
    sourceId: 'test-source-id',
    endpointUrl: 'https://example.com',
    type: 'html',
    category: 'news',
    linkSelector: 'a.article-link',
    pollingInterval: 3600,
    reliability: 80,
    priority: 5,
    metadata: {},
    successCount: 0,
    errorCount: 0,
    createdAt: new Date(),
    updatedAt: new Date()
  }]),
  update: mock().mockReturnThis(),
  set: mock().mockReturnThis(),
  delete: mock().mockReturnThis()
}

mock.module('@babel-feed/pgdb', () => ({
  getDatabase: mock().mockResolvedValue(mockDb),
  sourceEndpoints: {},
}))

// Mock LLM provider
const mockAiManager = {
  initialize: mock().mockResolvedValue(undefined),
  getEnabledProviders: mock().mockResolvedValue([{
    id: 'test-provider',
    name: 'test',
    displayName: 'Test Provider'
  }]),
  executeWithProvider: mock()
}

mock.module('@babel-feed/llm-provider', () => ({
  AiProviderManager: mock().mockImplementation(() => mockAiManager)
}))

describe('NewsSourcer HTML Analysis & LLM Integration', () => {
  let sourcer: NewsSourcer

  beforeEach(async () => {
    sourcer = new NewsSourcer()
    await sourcer.initialize()
    
    // Clear mocks
    mockAxiosGet.mockClear()
    mockAxiosHead.mockClear()
    mockAiManager.initialize.mockClear()
    mockAiManager.getEnabledProviders.mockClear()
    mockAiManager.executeWithProvider.mockClear()
  })

  describe('HTML Content Preprocessing', () => {
    it('removes scripts and styles from HTML', async () => {
      const htmlContent = `
        <html>
          <head>
            <script>alert('test')</script>
            <style>body { color: red; }</style>
          </head>
          <body>
            <main>
              <h1>News Article</h1>
              <a href="/article/1">First Article</a>
              <a href="/article/2">Second Article</a>
            </main>
            <script>analytics.track()</script>
          </body>
        </html>
      `

      mockAxiosGet.mockResolvedValueOnce({
        data: htmlContent
      })

      // Access private method for testing
      const preprocessedHtml = await (sourcer as any).fetchAndPreprocessHtml('https://example.com')
      
      expect(preprocessedHtml).not.toContain('<script>')
      expect(preprocessedHtml).not.toContain('<style>')
      expect(preprocessedHtml).toContain('<h1>News Article</h1>')
      expect(preprocessedHtml).toContain('href="/article/1"')
    })

    it('limits HTML content size to 4KB', async () => {
      const largeContent = '<div>' + 'x'.repeat(10000) + '</div>'
      
      mockAxiosGet.mockResolvedValueOnce({
        data: `<html><body><main>${largeContent}</main></body></html>`
      })

      const preprocessedHtml = await (sourcer as any).fetchAndPreprocessHtml('https://example.com')
      
      expect(preprocessedHtml.length).toBeLessThanOrEqual(4096 + 15) // +15 for "[truncated]"
      expect(preprocessedHtml).toContain('[truncated]')
    })

    it('focuses on main content areas', async () => {
      const htmlContent = `
        <html>
          <body>
            <nav>Navigation</nav>
            <aside>Sidebar</aside>
            <main>
              <h1>Main Content</h1>
              <a href="/article/1">Article Link</a>
            </main>
            <footer>Footer</footer>
          </body>
        </html>
      `

      mockAxiosGet.mockResolvedValueOnce({
        data: htmlContent
      })

      const preprocessedHtml = await (sourcer as any).fetchAndPreprocessHtml('https://example.com')
      
      expect(preprocessedHtml).toContain('Main Content')
      expect(preprocessedHtml).toContain('Article Link')
      expect(preprocessedHtml).not.toContain('Navigation')
      expect(preprocessedHtml).not.toContain('Sidebar')
      expect(preprocessedHtml).not.toContain('Footer')
    })
  })

  describe('LLM Integration & Prompt Generation', () => {
    it('generates structured LLM prompts', () => {
      const htmlContent = '<div><a href="/news/1">Article</a></div>'
      const sourceUrl = 'https://example.com'
      
      const prompt = (sourcer as any).buildLlmPrompt(htmlContent, sourceUrl)
      
      expect(prompt).toContain(sourceUrl)
      expect(prompt).toContain(htmlContent)
      expect(prompt).toContain('CSS selectors')
      expect(prompt).toContain('articleSelector')
      expect(prompt).toContain('confidence')
    })

    it('includes previous results in iterative prompts', () => {
      const htmlContent = '<div><a href="/news/1">Article</a></div>'
      const sourceUrl = 'https://example.com'
      const previousResult = {
        endpoints: [],
        confidence: 0.5,
        reasoning: 'Previous attempt'
      }
      
      const prompt = (sourcer as any).buildLlmPrompt(htmlContent, sourceUrl, previousResult)
      
      expect(prompt).toContain('Previous analysis result')
      expect(prompt).toContain('Previous attempt')
    })

    it('parses valid LLM responses', () => {
      const mockResponse = JSON.stringify({
        endpoints: [{
          url: 'https://example.com',
          type: 'html',
          category: 'news',
          priority: 5,
          crawlingScript: {
            articleSelector: 'a[href*="/article/"]',
            titleSelector: 'h2',
            timestampSelector: 'time'
          },
          reliability: {
            confidence: 0.8
          }
        }],
        confidence: 0.8,
        reasoning: 'Found article patterns'
      })

      const result = (sourcer as any).parseLlmResponse(mockResponse, 'https://example.com')
      
      expect(result.confidence).toBe(0.8)
      expect(result.reasoning).toBe('Found article patterns')
      expect(result.endpoints).toHaveLength(1)
      expect(result.endpoints[0].crawlingScript.articleSelector).toBe('a[href*="/article/"]')
      expect(result.endpoints[0].metadata.discoveredAt).toBeInstanceOf(Date)
    })

    it('handles invalid LLM responses', () => {
      const invalidResponse = 'invalid json'
      
      expect(() => {
        (sourcer as any).parseLlmResponse(invalidResponse, 'https://example.com')
      }).toThrow('Invalid LLM response format')
    })
  })

  describe('HTML Endpoint Validation', () => {
    it('validates HTML endpoints with working selectors', async () => {
      const endpoint: DiscoveredEndpoint = {
        url: 'https://example.com',
        type: 'html',
        category: 'news',
        priority: 5,
        crawlingScript: {
          articleSelector: 'a.article-link'
        },
        reliability: {
          confidence: 0.8,
          testResults: {
            sampleSize: 0,
            successRate: 0,
            avgArticlesPerPage: 0
          }
        },
        metadata: {
          discoveredAt: new Date(),
          lastValidated: new Date(),
          llmModel: 'test',
          version: '1.0'
        }
      }

      const htmlContent = `
        <div>
          <a class="article-link" href="/article/1">Article 1</a>
          <a class="article-link" href="/article/2">Article 2</a>
          <a class="article-link" href="/article/3">Article 3</a>
          <a class="article-link" href="/article/4">Article 4</a>
          <a class="article-link" href="/article/5">Article 5</a>
        </div>
      `

      mockAxiosGet.mockResolvedValueOnce({
        data: htmlContent
      })

      // Mock successful HEAD requests for URL validation
      mockAxiosHead.mockResolvedValue({ status: 200 })

      const result = await (sourcer as any).validateHtmlEndpoint(endpoint)
      
      expect(result.valid).toBe(true)
      expect(result.urlCount).toBe(5)
      expect(result.successRate).toBe(1.0)
      expect(result.sampleUrls).toHaveLength(5)
      expect(result.errors).toHaveLength(0)
    })

    it('rejects endpoints with no matching selectors', async () => {
      const endpoint: DiscoveredEndpoint = {
        url: 'https://example.com',
        type: 'html',
        category: 'news',
        priority: 5,
        crawlingScript: {
          articleSelector: 'a.nonexistent-selector'
        },
        reliability: {
          confidence: 0.8,
          testResults: {
            sampleSize: 0,
            successRate: 0,
            avgArticlesPerPage: 0
          }
        },
        metadata: {
          discoveredAt: new Date(),
          lastValidated: new Date(),
          llmModel: 'test',
          version: '1.0'
        }
      }

      mockAxiosGet.mockResolvedValueOnce({
        data: '<div><p>No article links here</p></div>'
      })

      const result = await (sourcer as any).validateHtmlEndpoint(endpoint)
      
      expect(result.valid).toBe(false)
      expect(result.urlCount).toBe(0)
      expect(result.errors).toContain('No article links found with provided selector')
    })

    it('handles URLs with low success rates', async () => {
      const endpoint: DiscoveredEndpoint = {
        url: 'https://example.com',
        type: 'html',
        category: 'news',
        priority: 5,
        crawlingScript: {
          articleSelector: 'a.article-link'
        },
        reliability: {
          confidence: 0.8,
          testResults: {
            sampleSize: 0,
            successRate: 0,
            avgArticlesPerPage: 0
          }
        },
        metadata: {
          discoveredAt: new Date(),
          lastValidated: new Date(),
          llmModel: 'test',
          version: '1.0'
        }
      }

      const htmlContent = `
        <div>
          <a class="article-link" href="/article/1">Article 1</a>
          <a class="article-link" href="/article/2">Article 2</a>
          <a class="article-link" href="/article/3">Article 3</a>
          <a class="article-link" href="/article/4">Article 4</a>
          <a class="article-link" href="/article/5">Article 5</a>
        </div>
      `

      mockAxiosGet.mockResolvedValueOnce({
        data: htmlContent
      })

      // Mock mostly failing HEAD requests
      mockAxiosHead
        .mockResolvedValueOnce({ status: 200 })  // 1 success
        .mockRejectedValueOnce(new Error('Not found'))  // 4 failures
        .mockRejectedValueOnce(new Error('Not found'))
        .mockRejectedValueOnce(new Error('Not found'))
        .mockRejectedValueOnce(new Error('Not found'))

      const result = await (sourcer as any).validateHtmlEndpoint(endpoint)
      
      expect(result.valid).toBe(false)  // Success rate 0.2 < 0.7 threshold
      expect(result.urlCount).toBe(5)
      expect(result.successRate).toBe(0.2)
    })
  })

  describe('Complete HTML Analysis Workflow', () => {
    it('completes end-to-end HTML analysis successfully', async () => {
      // Mock HTML content
      const htmlContent = `
        <html>
          <body>
            <main>
              <div>
                <a href="/news/article-1">First Article</a>
                <a href="/news/article-2">Second Article</a>
                <a href="/news/article-3">Third Article</a>
                <a href="/news/article-4">Fourth Article</a>
                <a href="/news/article-5">Fifth Article</a>
              </div>
            </main>
          </body>
        </html>
      `

      mockAxiosGet.mockResolvedValueOnce({
        data: htmlContent
      })

      // Mock successful URL validation
      mockAxiosHead.mockResolvedValue({ status: 200 })
      
      // Mock validation with enough URLs for actual page
      mockAxiosGet.mockResolvedValueOnce({
        data: htmlContent
      })

      // Mock LLM provider execution
      mockAiManager.executeWithProvider.mockImplementation(async (providerId: string, callback: Function) => {
        const mockProvider = { name: 'test-provider' }
        const mockKey = { keyName: 'test-key' }
        return await callback(mockProvider, mockKey)
      })

      // Mock the LLM request to return valid response
      const mockLlmResponse = JSON.stringify({
        endpoints: [{
          url: 'https://example.com',
          type: 'html',
          category: 'news',
          priority: 5,
          crawlingScript: {
            articleSelector: 'a[href*="/news/"]',
            titleSelector: 'h2',
            timestampSelector: 'time'
          },
          reliability: {
            confidence: 0.9
          }
        }],
        confidence: 0.9,
        reasoning: 'Found clear article link patterns'
      })

      const mockMakeLlmRequest = mock().mockResolvedValue(mockLlmResponse)
      ;(sourcer as any).makeLlmRequest = mockMakeLlmRequest

      // Also need to mock the validation to pass for the HTML endpoint
      mockAxiosGet.mockResolvedValueOnce({
        data: htmlContent  // For validation request
      })

      const result = await sourcer.analyzeHtmlSource('https://example.com')
      
      expect(result.sourceUrl).toBe('https://example.com')
      expect(result.endpoints).toHaveLength(1)
      expect(result.endpoints[0].type).toBe('html')
      expect(result.endpoints[0].crawlingScript.articleSelector).toBe('a[href*="/news/"]')
      expect(result.analysisMetadata.iterations).toBeGreaterThan(0)
      expect(result.analysisMetadata.finalConfidence).toBe(0.9)
      expect(result.analysisMetadata.totalAnalysisTime).toBeGreaterThan(0)
    })

    it('handles maximum iterations without convergence', async () => {
      const htmlContent = '<div>No clear structure</div>'

      mockAxiosGet.mockResolvedValue({
        data: htmlContent
      })

      mockAiManager.executeWithProvider.mockImplementation(async (providerId: string, callback: Function) => {
        const mockProvider = { name: 'test-provider' }
        const mockKey = { keyName: 'test-key' }
        return await callback(mockProvider, mockKey)
      })

      // Mock LLM to return low confidence responses
      const mockLlmResponse = JSON.stringify({
        endpoints: [],
        confidence: 0.3,  // Below threshold
        reasoning: 'Unable to identify clear patterns'
      })

      const mockMakeLlmRequest = mock().mockResolvedValue(mockLlmResponse)
      ;(sourcer as any).makeLlmRequest = mockMakeLlmRequest

      const result = await sourcer.analyzeHtmlSource('https://example.com')
      
      expect(result.endpoints).toHaveLength(0)
      expect(result.analysisMetadata.iterations).toBe(5) // Max iterations
      expect(result.analysisMetadata.finalConfidence).toBe(0.3)
    })

    it('handles LLM provider unavailability', async () => {
      mockAxiosGet.mockResolvedValue({
        data: '<div>Content</div>'
      })

      mockAiManager.getEnabledProviders.mockResolvedValue([]) // No providers

      await expect(sourcer.analyzeHtmlSource('https://example.com'))
        .rejects.toThrow('No AI providers available for HTML analysis')
    })
  })

  describe('Database Storage Integration', () => {
    it('stores discovered HTML endpoints correctly', async () => {
      const discoveredEndpoint: DiscoveredEndpoint = {
        url: 'https://example.com',
        type: 'html',
        category: 'news',
        priority: 5,
        crawlingScript: {
          articleSelector: 'a.article-link',
          titleSelector: 'h2',
          timestampSelector: 'time'
        },
        reliability: {
          confidence: 0.8,
          testResults: {
            sampleSize: 10,
            successRate: 0.9,
            avgArticlesPerPage: 15
          }
        },
        metadata: {
          discoveredAt: new Date(),
          lastValidated: new Date(),
          llmModel: 'content-analysis-model',
          version: '1.0'
        }
      }

      const createRequest = {
        sourceId: 'test-source-id',
        endpointUrl: discoveredEndpoint.url,
        type: 'html' as const,
        category: discoveredEndpoint.category,
        linkSelector: discoveredEndpoint.crawlingScript.articleSelector,
        reliability: discoveredEndpoint.reliability.confidence,
        priority: discoveredEndpoint.priority,
        metadata: {
          crawlingScript: discoveredEndpoint.crawlingScript,
          llmMetadata: discoveredEndpoint.metadata,
          reliability: discoveredEndpoint.reliability
        }
      }

      const storedEndpoint = await sourcer.createEndpoint(createRequest)
      
      expect(storedEndpoint.type).toBe('html')
      expect(storedEndpoint.endpointUrl).toBe('https://example.com')
      expect(storedEndpoint.category).toBe('news')
      expect(storedEndpoint.linkSelector).toBe('a.article-link')
    })
  })
})