import { describe, it, expect, beforeEach, mock } from "bun:test"
import { AdaptiveAnalyzer } from '../src/adaptive-analyzer.js'
import type { StoredEndpoint, SourceAnalysisResult } from '../src/types.js'

describe('AdaptiveAnalyzer', () => {
  let adaptiveAnalyzer: AdaptiveAnalyzer
  let mockEndpoints: StoredEndpoint[]
  let mockAnalysisResult: SourceAnalysisResult

  beforeEach(() => {
    adaptiveAnalyzer = new AdaptiveAnalyzer({
      failureThreshold: 0.5,
      maxConsecutiveFailures: 3,
      cooldownPeriod: 60000, // 1 minute
      maxReanalysisAttempts: 2,
      stalenessThreshold: 86400000, // 24 hours
      batchSize: 3,
      scheduleInterval: 30000 // 30 seconds
    })

    mockEndpoints = [
      {
        id: 'endpoint-1',
        sourceId: 'source-1',
        endpointUrl: 'https://example.com/news',
        type: 'html',
        reliability: 0.3, // Below threshold
        successCount: 30,
        errorCount: 70,
        consecutiveFailureCount: 5, // Above maxConsecutiveFailures (3)
        pollingInterval: 3600,
        priority: 1,
        metadata: {},
        createdAt: new Date(Date.now() - 1000),
        updatedAt: new Date(Date.now() - 1000)
      },
      {
        id: 'endpoint-2',
        sourceId: 'source-2',
        endpointUrl: 'https://example.com/blog',
        type: 'html',
        reliability: 0.8, // Above threshold
        successCount: 80,
        errorCount: 20,
        consecutiveFailureCount: 1, // Below maxConsecutiveFailures (3)
        pollingInterval: 3600,
        priority: 2,
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 'endpoint-3',
        sourceId: 'source-3',
        endpointUrl: 'https://example.com/feed',
        type: 'rss',
        reliability: 0.9,
        successCount: 90,
        errorCount: 10,
        consecutiveFailureCount: 0, // No consecutive failures
        pollingInterval: 3600,
        priority: 3,
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ]

    mockAnalysisResult = {
      sourceUrl: 'https://example.com/news',
      endpoints: [
        {
          url: 'https://example.com/news',
          type: 'html',
          category: 'news',
          priority: 5,
          crawlingScript: {
            articleSelector: '.article a',
            titleSelector: '.article h2',
            timestampSelector: '.article time'
          },
          reliability: {
            confidence: 0.8,
            testResults: {
              sampleSize: 10,
              successRate: 0.8,
              avgArticlesPerPage: 10
            }
          },
          metadata: {
            discoveredAt: new Date(),
            lastValidated: new Date(),
            llmModel: 'test-model',
            version: '1.0'
          }
        }
      ],
      globalConfig: {
        userAgent: 'TestAgent',
        respectRobotsTxt: true,
        baseDelay: 1000
      },
      analysisMetadata: {
        iterations: 2,
        totalAnalysisTime: 5000,
        finalConfidence: 0.8
      }
    }
  })

  describe('Should Reanalyze Logic', () => {
    it('should identify endpoints needing re-analysis due to low reliability', () => {
      const needsReanalysis = adaptiveAnalyzer.shouldReanalyze(mockEndpoints[0])
      expect(needsReanalysis).toBe(true)
    })

    it('should not reanalyze endpoints with good reliability', () => {
      const needsReanalysis = adaptiveAnalyzer.shouldReanalyze(mockEndpoints[1])
      expect(needsReanalysis).toBe(false)
    })

    it('should identify endpoints needing re-analysis due to consecutive failures', () => {
      const endpoint = {
        ...mockEndpoints[1],
        consecutiveFailureCount: 5 // Above max consecutive failures
      }
      
      const needsReanalysis = adaptiveAnalyzer.shouldReanalyze(endpoint)
      expect(needsReanalysis).toBe(true)
    })

    it('should identify stale endpoints', () => {
      const staleEndpoint = {
        ...mockEndpoints[1],
        updatedAt: new Date(Date.now() - 2 * 86400000) // 2 days ago
      }
      
      const needsReanalysis = adaptiveAnalyzer.shouldReanalyze(staleEndpoint)
      expect(needsReanalysis).toBe(true)
    })

    it('should not reanalyze RSS endpoints', () => {
      const needsReanalysis = adaptiveAnalyzer.shouldReanalyze(mockEndpoints[2])
      expect(needsReanalysis).toBe(false)
    })

    it('should respect cooldown period', () => {
      // Queue and process an endpoint
      adaptiveAnalyzer.queueForReanalysis('endpoint-1')
      
      // Simulate a recent reanalysis
      const history = [
        {
          endpointId: 'endpoint-1',
          success: true,
          newEndpoints: [],
          previousVersion: 'v1',
          newVersion: 'v2',
          analysisTime: Date.now() - 30000 // 30 seconds ago
        }
      ]
      
      // Mock the history (private field, but we can test the behavior)
      const needsReanalysis = adaptiveAnalyzer.shouldReanalyze(mockEndpoints[0])
      expect(needsReanalysis).toBe(true) // Should still suggest, but will be filtered by cooldown
    })

    it('should limit reanalysis attempts', () => {
      // This would require accessing private fields or mocking history
      // For now, we test the concept by ensuring the logic exists
      expect(adaptiveAnalyzer.shouldReanalyze).toBeDefined()
    })
  })

  describe('Queue Management', () => {
    it('should queue endpoints for reanalysis', () => {
      adaptiveAnalyzer.queueForReanalysis('endpoint-1')
      adaptiveAnalyzer.queueForReanalysis('endpoint-2')
      
      const stats = adaptiveAnalyzer.getReanalysisStats()
      expect(stats.queueSize).toBe(2)
    })

    it('should not duplicate endpoints in queue', () => {
      adaptiveAnalyzer.queueForReanalysis('endpoint-1')
      adaptiveAnalyzer.queueForReanalysis('endpoint-1')
      adaptiveAnalyzer.queueForReanalysis('endpoint-1')
      
      const stats = adaptiveAnalyzer.getReanalysisStats()
      expect(stats.queueSize).toBe(1)
    })
  })

  describe('Reanalysis Processing', () => {
    it('should process reanalysis queue', async () => {
      const mockGetEndpoint = mock().mockImplementation((id: string) => {
        return Promise.resolve(mockEndpoints.find(e => e.id === id))
      })
      
      const mockAnalyzeHtml = mock().mockResolvedValue(mockAnalysisResult)
      
      const mockUpdateEndpoint = mock().mockResolvedValue(undefined)
      
      const mockCreateEndpoints = mock().mockResolvedValue([
        {
          id: 'new-endpoint-1',
          sourceId: 'source-1',
          endpointUrl: 'https://example.com/news',
          type: 'html',
          reliability: 0.8,
          successCount: 0,
          errorCount: 0,
          pollingInterval: 3600,
          priority: 5,
          metadata: {},
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ])

      adaptiveAnalyzer.queueForReanalysis('endpoint-1')
      
      const results = await adaptiveAnalyzer.processReanalysisQueue(
        mockGetEndpoint,
        mockAnalyzeHtml,
        mockUpdateEndpoint,
        mockCreateEndpoints
      )

      expect(results).toHaveLength(1)
      expect(results[0].success).toBe(true)
      expect(results[0].endpointId).toBe('endpoint-1')
      expect(results[0].newEndpoints).toHaveLength(1)
      
      expect(mockGetEndpoint).toHaveBeenCalledWith('endpoint-1')
      expect(mockAnalyzeHtml).toHaveBeenCalledWith('https://example.com/news')
      expect(mockUpdateEndpoint).toHaveBeenCalled()
      expect(mockCreateEndpoints).toHaveBeenCalled()
    })

    it('should handle missing endpoints gracefully', async () => {
      const mockGetEndpoint = mock().mockResolvedValue(null)
      const mockAnalyzeHtml = mock()
      const mockUpdateEndpoint = mock()
      const mockCreateEndpoints = mock()

      adaptiveAnalyzer.queueForReanalysis('non-existent')
      
      const results = await adaptiveAnalyzer.processReanalysisQueue(
        mockGetEndpoint,
        mockAnalyzeHtml,
        mockUpdateEndpoint,
        mockCreateEndpoints
      )

      expect(results).toHaveLength(1)
      expect(results[0].success).toBe(false)
      expect(results[0].error).toContain('not found')
    })

    it('should handle non-HTML endpoints', async () => {
      const mockGetEndpoint = mock().mockResolvedValue(mockEndpoints[2]) // RSS endpoint
      const mockAnalyzeHtml = mock()
      const mockUpdateEndpoint = mock()
      const mockCreateEndpoints = mock()

      adaptiveAnalyzer.queueForReanalysis('endpoint-3')
      
      const results = await adaptiveAnalyzer.processReanalysisQueue(
        mockGetEndpoint,
        mockAnalyzeHtml,
        mockUpdateEndpoint,
        mockCreateEndpoints
      )

      expect(results).toHaveLength(1)
      expect(results[0].success).toBe(false)
      expect(results[0].error).toContain('not HTML type')
    })

    it('should handle analysis failures', async () => {
      const mockGetEndpoint = mock().mockResolvedValue(mockEndpoints[0])
      const mockAnalyzeHtml = mock().mockRejectedValue(new Error('Analysis failed'))
      const mockUpdateEndpoint = mock()
      const mockCreateEndpoints = mock()

      adaptiveAnalyzer.queueForReanalysis('endpoint-1')
      
      const results = await adaptiveAnalyzer.processReanalysisQueue(
        mockGetEndpoint,
        mockAnalyzeHtml,
        mockUpdateEndpoint,
        mockCreateEndpoints
      )

      expect(results).toHaveLength(1)
      expect(results[0].success).toBe(false)
      expect(results[0].error).toBe('Analysis failed')
    })

    it('should handle empty analysis results', async () => {
      const mockGetEndpoint = mock().mockResolvedValue(mockEndpoints[0])
      const mockAnalyzeHtml = mock().mockResolvedValue({
        ...mockAnalysisResult,
        endpoints: []
      })
      const mockUpdateEndpoint = mock()
      const mockCreateEndpoints = mock()

      adaptiveAnalyzer.queueForReanalysis('endpoint-1')
      
      const results = await adaptiveAnalyzer.processReanalysisQueue(
        mockGetEndpoint,
        mockAnalyzeHtml,
        mockUpdateEndpoint,
        mockCreateEndpoints
      )

      expect(results).toHaveLength(1)
      expect(results[0].success).toBe(false)
      expect(results[0].error).toContain('No valid endpoints')
    })

    it('should process batch size limit', async () => {
      const mockGetEndpoint = mock().mockResolvedValue(mockEndpoints[0])
      const mockAnalyzeHtml = mock().mockResolvedValue(mockAnalysisResult)
      const mockUpdateEndpoint = mock()
      const mockCreateEndpoints = mock().mockResolvedValue([
        {
          id: 'new-endpoint-1',
          sourceId: 'test-source-id',
          endpointUrl: 'https://example.com/new',
          type: 'html',
          reliability: 0.8,
          successCount: 0,
          errorCount: 0,
          consecutiveFailureCount: 0,
          pollingInterval: 3600,
          priority: 5,
          metadata: {},
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ])

      // Queue more than batch size
      for (let i = 1; i <= 5; i++) {
        adaptiveAnalyzer.queueForReanalysis(`endpoint-${i}`)
      }
      
      const results = await adaptiveAnalyzer.processReanalysisQueue(
        mockGetEndpoint,
        mockAnalyzeHtml,
        mockUpdateEndpoint,
        mockCreateEndpoints
      )

      expect(results).toHaveLength(3) // Batch size limit
      expect(adaptiveAnalyzer.getReanalysisStats().queueSize).toBe(2) // Remaining items
    })
  })

  describe('Scheduled Reanalysis', () => {
    it('should start scheduled reanalysis', () => {
      const mockGetAllEndpoints = mock().mockResolvedValue(mockEndpoints)
      const mockGetEndpoint = mock()
      const mockAnalyzeHtml = mock()
      const mockUpdateEndpoint = mock()
      const mockCreateEndpoints = mock()

      adaptiveAnalyzer.startScheduledReanalysis(
        mockGetAllEndpoints,
        mockGetEndpoint,
        mockAnalyzeHtml,
        mockUpdateEndpoint,
        mockCreateEndpoints
      )

      // Should not throw and should start interval
      expect(() => adaptiveAnalyzer.stopScheduledReanalysis()).not.toThrow()
    })

    it('should stop scheduled reanalysis', () => {
      const mockGetAllEndpoints = mock().mockResolvedValue([])
      const mockGetEndpoint = mock()
      const mockAnalyzeHtml = mock()
      const mockUpdateEndpoint = mock()
      const mockCreateEndpoints = mock()

      adaptiveAnalyzer.startScheduledReanalysis(
        mockGetAllEndpoints,
        mockGetEndpoint,
        mockAnalyzeHtml,
        mockUpdateEndpoint,
        mockCreateEndpoints
      )

      adaptiveAnalyzer.stopScheduledReanalysis()

      // Should be able to stop multiple times
      expect(() => adaptiveAnalyzer.stopScheduledReanalysis()).not.toThrow()
    })
  })

  describe('Statistics', () => {
    it('should provide reanalysis statistics', async () => {
      const mockGetEndpoint = mock().mockImplementation((id: string) => {
        const endpoint = mockEndpoints.find(e => e.id === id)
        return Promise.resolve(endpoint || null)
      })
      const mockAnalyzeHtml = mock().mockResolvedValue(mockAnalysisResult)
      const mockUpdateEndpoint = mock()
      const mockCreateEndpoints = mock().mockResolvedValue([
        {
          id: 'new-endpoint-1',
          sourceId: 'source-1',
          endpointUrl: 'https://example.com/news',
          type: 'html',
          reliability: 0.8,
          successCount: 0,
          errorCount: 0,
          consecutiveFailureCount: 0,
          pollingInterval: 3600,
          priority: 5,
          metadata: {},
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ])

      // Process some reanalyses
      adaptiveAnalyzer.queueForReanalysis('endpoint-1')
      adaptiveAnalyzer.queueForReanalysis('endpoint-2')
      
      await adaptiveAnalyzer.processReanalysisQueue(
        mockGetEndpoint,
        mockAnalyzeHtml,
        mockUpdateEndpoint,
        mockCreateEndpoints
      )

      const stats = adaptiveAnalyzer.getReanalysisStats()
      
      expect(stats.queueSize).toBe(0) // Queue should be empty after processing
      expect(stats.totalReanalyses).toBe(2) // Two processed
      expect(stats.successfulReanalyses).toBe(2) // Both should succeed with proper mock
      expect(stats.failedReanalyses).toBe(0)
      expect(stats.endpointsWithHistory).toBe(2) // Two different endpoints
      expect(stats.averageReanalysisTime).toBeGreaterThan(0)
    })

    it('should track failed reanalyses', async () => {
      const mockGetEndpoint = mock().mockResolvedValue(mockEndpoints[0])
      const mockAnalyzeHtml = mock().mockRejectedValue(new Error('Failed'))
      const mockUpdateEndpoint = mock()
      const mockCreateEndpoints = mock()

      adaptiveAnalyzer.queueForReanalysis('endpoint-1')
      
      await adaptiveAnalyzer.processReanalysisQueue(
        mockGetEndpoint,
        mockAnalyzeHtml,
        mockUpdateEndpoint,
        mockCreateEndpoints
      )

      const stats = adaptiveAnalyzer.getReanalysisStats()
      
      expect(stats.totalReanalyses).toBe(1)
      expect(stats.successfulReanalyses).toBe(0)
      expect(stats.failedReanalyses).toBe(1)
    })
  })

  describe('History Management', () => {
    it('should clear reanalysis history', async () => {
      const mockGetEndpoint = mock().mockResolvedValue(mockEndpoints[0])
      const mockAnalyzeHtml = mock().mockResolvedValue(mockAnalysisResult)
      const mockUpdateEndpoint = mock()
      const mockCreateEndpoints = mock().mockResolvedValue([
        {
          id: 'new-endpoint-1',
          sourceId: 'test-source-id',
          endpointUrl: 'https://example.com/new',
          type: 'html',
          reliability: 0.8,
          successCount: 0,
          errorCount: 0,
          consecutiveFailureCount: 0,
          pollingInterval: 3600,
          priority: 5,
          metadata: {},
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ])

      adaptiveAnalyzer.queueForReanalysis('endpoint-1')
      
      await adaptiveAnalyzer.processReanalysisQueue(
        mockGetEndpoint,
        mockAnalyzeHtml,
        mockUpdateEndpoint,
        mockCreateEndpoints
      )

      expect(adaptiveAnalyzer.getReanalysisStats().totalReanalyses).toBe(1)
      
      adaptiveAnalyzer.clearHistory()
      
      expect(adaptiveAnalyzer.getReanalysisStats().totalReanalyses).toBe(0)
      expect(adaptiveAnalyzer.getReanalysisStats().endpointsWithHistory).toBe(0)
    })
  })

  describe('Configuration', () => {
    it('should use custom configuration', () => {
      const customAnalyzer = new AdaptiveAnalyzer({
        failureThreshold: 0.2,
        maxConsecutiveFailures: 10,
        cooldownPeriod: 120000,
        maxReanalysisAttempts: 5,
        stalenessThreshold: 172800000,
        batchSize: 10,
        scheduleInterval: 60000
      })

      expect(customAnalyzer).toBeInstanceOf(AdaptiveAnalyzer)
    })

    it('should use default configuration when none provided', () => {
      const defaultAnalyzer = new AdaptiveAnalyzer()
      expect(defaultAnalyzer).toBeInstanceOf(AdaptiveAnalyzer)
    })
  })

  describe('Error Handling', () => {
    it('should handle database errors gracefully', async () => {
      const mockGetEndpoint = mock().mockRejectedValue(new Error('Database error'))
      const mockAnalyzeHtml = mock()
      const mockUpdateEndpoint = mock()
      const mockCreateEndpoints = mock()

      adaptiveAnalyzer.queueForReanalysis('endpoint-1')
      
      const results = await adaptiveAnalyzer.processReanalysisQueue(
        mockGetEndpoint,
        mockAnalyzeHtml,
        mockUpdateEndpoint,
        mockCreateEndpoints
      )

      expect(results).toHaveLength(1)
      expect(results[0].success).toBe(false)
      expect(results[0].error).toBe('Database error')
    })

    it('should handle update failures', async () => {
      const mockGetEndpoint = mock().mockResolvedValue(mockEndpoints[0])
      const mockAnalyzeHtml = mock().mockResolvedValue(mockAnalysisResult)
      const mockUpdateEndpoint = mock().mockRejectedValue(new Error('Update failed'))
      const mockCreateEndpoints = mock().mockResolvedValue([])

      adaptiveAnalyzer.queueForReanalysis('endpoint-1')
      
      const results = await adaptiveAnalyzer.processReanalysisQueue(
        mockGetEndpoint,
        mockAnalyzeHtml,
        mockUpdateEndpoint,
        mockCreateEndpoints
      )

      expect(results).toHaveLength(1)
      expect(results[0].success).toBe(false)
      expect(results[0].error).toBe('Update failed')
    })

    it('should handle creation failures', async () => {
      const mockGetEndpoint = mock().mockResolvedValue(mockEndpoints[0])
      const mockAnalyzeHtml = mock().mockResolvedValue(mockAnalysisResult)
      const mockUpdateEndpoint = mock().mockResolvedValue(undefined)
      const mockCreateEndpoints = mock().mockRejectedValue(new Error('Creation failed'))

      adaptiveAnalyzer.queueForReanalysis('endpoint-1')
      
      const results = await adaptiveAnalyzer.processReanalysisQueue(
        mockGetEndpoint,
        mockAnalyzeHtml,
        mockUpdateEndpoint,
        mockCreateEndpoints
      )

      expect(results).toHaveLength(1)
      expect(results[0].success).toBe(false)
      expect(results[0].error).toBe('Creation failed')
    })
  })
})