import { cleanupTestDatabase, clearTestData, setupTestDatabase } from '@babel-feed/pgdb'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'bun:test'
import { NewsAggregatorService } from '../services/news-aggregator-service'


describe('News Aggregator Setup', () => {

  beforeAll(async () => {
    await setupTestDatabase()
  })

  beforeEach(async () => {
    await clearTestData()
  })

  afterAll(async () => {
    await cleanupTestDatabase()
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
        // Check that key services are present
        expect(status.modules.sourceManager).toBeDefined()
        expect(status.modules.aiProviderManager).toBeDefined()
        expect(status.modules.contentCache).toBeDefined()
        expect(status.modules.translationCache).toBeDefined()
        expect(status.modules.healthChecker).toBeDefined()
        expect(status.modules.rssProcessor).toBeDefined()
      }
    })

    it('should support legacy service access', async () => {
      const service = new NewsAggregatorService()
      await service.initialize()
      
      // Test service access methods
      const sourceManager = service.getSourceManager()
      expect(sourceManager).toBeDefined()
      
      const aiProviderManager = service.getAiProviderManager()
      expect(aiProviderManager).toBeDefined()
      
      const healthChecker = service.getHealthChecker()
      expect(healthChecker).toBeDefined()
    })

    it('should start and stop successfully', async () => {
      const service = new NewsAggregatorService()
      await service.initialize()
      await service.start()
      
      const runningStatus = await service.getStatus()
      expect(runningStatus.running).toBe(true)
      
      await service.stop()
      
      const stoppedStatus = await service.getStatus()
      expect(stoppedStatus.running).toBe(false)
    })
  })
})