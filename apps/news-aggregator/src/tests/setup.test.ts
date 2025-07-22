import { clearTestData } from '@babel-feed/pgdb'
import { createTestTimers } from '@babel-feed/utils'
import { beforeAll, beforeEach, describe, expect, it, mock } from 'bun:test'
import { NewsAggregatorService } from '../services/news-aggregator-service'

// Mock fetch for HTTP requests
const mockFetch = mock()
global.fetch = mockFetch as any

describe('News Aggregator Setup', () => {
  const timer = createTestTimers()
  beforeEach(async () => {
    await clearTestData()
    timer.reset()
    // Mock fetch to return empty RSS feed to prevent real network calls
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => '<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>Test Feed</title></channel></rss>',
      headers: new Headers(),
      json: async () => ({}),
    } as Response)
  })

  describe('NewsAggregatorService', () => {
    it('should initialize successfully', async () => {
      const service = new NewsAggregatorService()
      await service.initialize()
      
      const status = await service.getStatus()
      expect(status.running).toBe(true)
      expect(status.modules).toBeDefined()
    })

    it('should have all modules initialized', async () => {
      const service = new NewsAggregatorService()
      await service.initialize()
      
      const status = await service.getStatus()
      expect(status.modules).toBeDefined()
      
      if (status.modules) {
        // Check that key modules are present
        expect(status.modules.sourceCRUD).toBeDefined()
        expect(status.modules.healthMonitor).toBeDefined()
        expect(status.modules.sourceDiscovery).toBeDefined()
        expect(status.modules.fetcher).toBeDefined()
        expect(status.modules.processor).toBeDefined()
        expect(status.modules.aiIntegration).toBeDefined()
        expect(status.modules.deduplication).toBeDefined()
      }
    })

    it('should support legacy service access', async () => {
      const service = new NewsAggregatorService()
      await service.initialize()
      
      // Test new module access
      const sourceCRUD = service.getSourceCRUD()
      expect(sourceCRUD).toBeDefined()
      
      const fetcher = service.getFetcher()
      expect(fetcher).toBeDefined()
      
      const healthChecker = service.getHealthChecker()
      expect(healthChecker).toBeDefined()
    })

    it('should start and stop successfully', async () => {
      const service = new NewsAggregatorService()
      await service.initialize()
      
      // Disable the source-discovery job to prevent slow analyzeSource operations
      const jobScheduler = service.getJobScheduler()
      jobScheduler.updateJobConfig('source-discovery', { enabled: false })
      
      await service.start()
      await timer.tickAsync(100)
      
      const runningStatus = await service.getStatus()
      expect(runningStatus.running).toBe(true)
      
      await service.stop()
      await timer.tickAsync(100)
      
      const stoppedStatus = await service.getStatus()
      expect(stoppedStatus.running).toBe(false)
    })
  })
})