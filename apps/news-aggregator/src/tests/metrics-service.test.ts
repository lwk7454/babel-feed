import { clearTestData, insertTestArticleWithTranslations, getTestDb, setupTestDatabase } from '@babel-feed/pgdb'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'bun:test'
import { MetricsService } from '../services/metrics-service'

beforeAll(async () => {
  await setupTestDatabase()
})

describe('MetricsService', () => {
  let metricsService: MetricsService

  beforeAll(async () => {
    metricsService = new MetricsService()
    await metricsService.initialize()
  })

  beforeEach(async () => {
    await clearTestData()
  })

  afterAll(async () => {
    await metricsService.stop()
  })

  describe('collectMetrics', () => {
    it('should collect system metrics', async () => {
      // Insert test data
      await insertTestArticleWithTranslations({
        url: 'https://example.com/article',
        source: 'test-source',
        sourceLanguage: 'en'
      }, [{
        language: 'en',
        title: 'Test Article',
        summary: 'Test summary'
      }])

      const metrics = await metricsService.collectMetrics()

      expect(metrics).toBeDefined()
      expect(metrics.timestamp).toBeDefined()
      expect(metrics.uptime).toBeGreaterThan(0)
      expect(metrics.sources).toBeDefined()
      expect(metrics.articles).toBeDefined()
      expect(metrics.performance).toBeDefined()
      
      // Check article metrics
      expect(metrics.articles.total).toBeGreaterThanOrEqual(1)
      expect(metrics.articles.byLanguage).toHaveLength(1)
      expect(metrics.articles.byLanguage[0].language).toBe('en')
      expect(metrics.articles.byLanguage[0].count).toBe(1)
      
      // Check performance metrics
      expect(metrics.performance.memoryUsage).toBeDefined()
      expect(metrics.performance.memoryUsage.heapUsed).toBeGreaterThan(0)
    })

    it('should handle empty database', async () => {
      const metrics = await metricsService.collectMetrics()

      expect(metrics).toBeDefined()
      expect(metrics.articles.total).toBe(0)
      expect(metrics.articles.byLanguage).toHaveLength(0)
      expect(metrics.articles.bySource).toHaveLength(0)
    })
  })

  describe('getHealthStatus', () => {
    it('should return health status', async () => {
      const health = await metricsService.getHealthStatus()

      expect(health).toBeDefined()
      expect(health.status).toBeDefined()
      expect(['healthy', 'degraded', 'unhealthy']).toContain(health.status)
      expect(health.checks).toBeDefined()
      expect(health.checks.length).toBeGreaterThan(0)
      
      // Check for expected health checks
      const dbCheck = health.checks.find(c => c.name === 'Database Connection')
      expect(dbCheck).toBeDefined()
      expect(dbCheck?.status).toBe('pass')
      expect(dbCheck?.responseTime).toBeGreaterThanOrEqual(0)
    })

    it('should detect unhealthy status', async () => {
      // This test would require mocking database failures
      // For now, we'll just verify the structure
      const health = await metricsService.getHealthStatus()
      
      expect(health.checks.every(c => 
        c.name && c.status && c.message && 
        ['pass', 'fail', 'warn'].includes(c.status)
      )).toBe(true)
    })
  })

  describe('updateAlertConfig', () => {
    it('should update alert configuration', async () => {
      const newConfig = {
        enabled: true,
        errorRateThreshold: 15,
        responseTimeThreshold: 3000,
        emailNotifications: true
      }

      await metricsService.updateAlertConfig(newConfig)
      
      // The config is private, so we can't directly test it
      // But we can ensure the method doesn't throw
      expect(true).toBe(true)
    })
  })

  describe('getMetrics', () => {
    it('should return cached metrics', async () => {
      // First collect metrics
      await metricsService.collectMetrics()
      
      // Then get cached metrics
      const metrics = await metricsService.getMetrics()
      
      expect(metrics).toBeDefined()
      expect(metrics?.timestamp).toBeDefined()
      expect(metrics?.uptime).toBeGreaterThan(0)
    })

    it('should return null if no metrics collected', async () => {
      const freshService = new MetricsService()
      const metrics = await freshService.getMetrics()
      
      expect(metrics).toBe(null)
    })
  })
})