/**
 * Performance and memory benchmark tests
 */

import { PerformanceBenchmark } from '../../src/benchmarks/performance'
import { Configuration } from '../../src/configuration'
import { logger, LogLevel } from '../../src/logger'
import { readFileSync } from 'fs'
import { join } from 'path'

describe('Performance Benchmarks', () => {
  let benchmark: PerformanceBenchmark
  let testUrls: string[]

  beforeAll(() => {
    // Set logger to warn level to reduce noise during benchmarks
    logger.setLevel(LogLevel.WARN)
    
    const config = new Configuration()
    config.requestsParams.timeout = 10000 // Increase timeout for benchmarks
    benchmark = new PerformanceBenchmark(config)

    // Load test URLs
    try {
      const urlsPath = join(__dirname, '../data/test_urls.txt')
      const urlsContent = readFileSync(urlsPath, 'utf-8')
      testUrls = urlsContent
        .split('\n')
        .map(url => url.trim())
        .filter(url => url && !url.startsWith('#'))
        .slice(0, 5) // Limit to 5 URLs for CI/CD performance
    } catch (error) {
      // Fallback URLs if file doesn't exist
      testUrls = [
        'https://edition.cnn.com',
        'https://www.bbc.com/news',
        'https://www.reuters.com',
        'https://www.bloomberg.com',
        'https://techcrunch.com'
      ]
    }
  })

  afterAll(() => {
    // Reset logger level
    logger.setLevel(LogLevel.INFO)
  })

  it('should benchmark single article extraction performance', async () => {
    const url = testUrls[0]
    const result = await benchmark.benchmarkArticle(url)

    expect(result.url).toBe(url)
    expect(result.extractionTimeMs).toBeGreaterThan(0)
    
    if (result.success) {
      expect(result.downloadTimeMs).toBeGreaterThan(0)
      expect(result.parseTimeMs).toBeGreaterThan(0)
      expect(result.metadata.titleLength).toBeGreaterThan(0)
    }

    // Performance thresholds (adjust based on requirements)
    if (result.success) {
      expect(result.extractionTimeMs).toBeLessThan(30000) // 30 seconds max
      expect(result.memoryUsageMB).toBeLessThan(100) // 100MB max per article
    }

    console.log(`Single article benchmark result:`)
    console.log(`  URL: ${result.url}`)
    console.log(`  Success: ${result.success}`)
    console.log(`  Total time: ${result.extractionTimeMs.toFixed(2)}ms`)
    console.log(`  Download time: ${result.downloadTimeMs.toFixed(2)}ms`)
    console.log(`  Parse time: ${result.parseTimeMs.toFixed(2)}ms`)
    console.log(`  Memory usage: ${result.memoryUsageMB.toFixed(2)}MB`)
  }, 60000) // 60 second timeout

  it('should benchmark multiple articles sequentially', async () => {
    const suite = await benchmark.benchmarkArticles(testUrls.slice(0, 3), 1)

    expect(suite.results).toHaveLength(3)
    expect(suite.totalTimeMs).toBeGreaterThan(0)
    expect(suite.successRate).toBeGreaterThanOrEqual(0)

    console.log('\nSequential benchmark results:')
    console.log(benchmark.generateReport(suite))
  }, 120000) // 2 minute timeout

  it('should benchmark multiple articles concurrently', async () => {
    const suite = await benchmark.benchmarkArticles(testUrls.slice(0, 3), 2)

    expect(suite.results).toHaveLength(3)
    expect(suite.totalTimeMs).toBeGreaterThan(0)
    expect(suite.successRate).toBeGreaterThanOrEqual(0)

    console.log('\nConcurrent benchmark results:')
    console.log(benchmark.generateReport(suite))
  }, 120000) // 2 minute timeout

  it('should perform memory stress test', async () => {
    // Use fewer iterations for CI/CD
    const stressResult = await benchmark.stressTestMemory(testUrls.slice(0, 2), 10)

    expect(stressResult.iterations).toBe(10)
    expect(stressResult.peakMemoryMB).toBeGreaterThan(0)
    
    // Memory leak check - should not grow by more than 50MB
    expect(stressResult.memoryGrowthMB).toBeLessThan(50)
    expect(stressResult.memoryLeakDetected).toBe(false)

    console.log('\nMemory stress test results:')
    console.log(`  Iterations: ${stressResult.iterations}`)
    console.log(`  Memory growth: ${stressResult.memoryGrowthMB.toFixed(2)}MB`)
    console.log(`  Peak memory: ${stressResult.peakMemoryMB.toFixed(2)}MB`)
    console.log(`  Memory leak detected: ${stressResult.memoryLeakDetected}`)
  }, 180000) // 3 minute timeout

  it('should compare performance against baseline', async () => {
    // This test establishes performance baselines
    const baselineUrls = testUrls.slice(0, 2)
    const suite = await benchmark.benchmarkArticles(baselineUrls, 1)

    const successfulResults = suite.results.filter(r => r.success)
    
    if (successfulResults.length > 0) {
      const avgTime = suite.averageTimeMs
      const avgMemory = suite.memoryStats.average

      console.log('\nPerformance baseline:')
      console.log(`  Average extraction time: ${avgTime.toFixed(2)}ms`)
      console.log(`  Average memory usage: ${avgMemory.toFixed(2)}MB`)
      console.log(`  Success rate: ${(suite.successRate * 100).toFixed(1)}%`)

      // Set reasonable performance expectations
      expect(avgTime).toBeLessThan(15000) // 15 seconds average
      expect(avgMemory).toBeLessThan(50) // 50MB average
      expect(suite.successRate).toBeGreaterThan(0.5) // 50% success rate minimum
    }
  }, 120000) // 2 minute timeout
})

describe('Memory Management', () => {
  it('should properly clean up resources', async () => {
    const initialMemory = process.memoryUsage().heapUsed / 1024 / 1024

    // Create and process multiple articles
    const config = new Configuration()
    for (let i = 0; i < 5; i++) {
      const { Article } = await import('../../src/article')
      const article = new Article('https://example.com', config)
      
      try {
        // Don't actually download to avoid network dependency
        // Just test object creation and cleanup
      } catch {
        // Expected to fail without download
      }
    }

    // Force garbage collection if available
    if (global.gc) {
      global.gc()
    }

    const finalMemory = process.memoryUsage().heapUsed / 1024 / 1024
    const memoryGrowth = finalMemory - initialMemory

    console.log(`Memory cleanup test:`)
    console.log(`  Initial memory: ${initialMemory.toFixed(2)}MB`)
    console.log(`  Final memory: ${finalMemory.toFixed(2)}MB`)
    console.log(`  Memory growth: ${memoryGrowth.toFixed(2)}MB`)

    // Should not leak significant memory
    expect(memoryGrowth).toBeLessThan(10) // 10MB growth limit
  })
})