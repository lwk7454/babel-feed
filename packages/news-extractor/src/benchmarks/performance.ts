/**
 * Performance benchmarking utilities for news-extractor
 * Measures extraction speed, memory usage, and throughput
 */

import { Article } from '../article'
import { Configuration } from '../configuration'
import { logger } from '../logger'

export interface BenchmarkResult {
  name: string
  url: string
  extractionTimeMs: number
  downloadTimeMs: number
  parseTimeMs: number
  memoryUsageMB: number
  success: boolean
  error?: string
  metadata: {
    titleLength: number
    textLength: number
    imageCount: number
    authorCount: number
  }
}

export interface BenchmarkSuite {
  name: string
  results: BenchmarkResult[]
  totalTimeMs: number
  averageTimeMs: number
  successRate: number
  memoryStats: {
    min: number
    max: number
    average: number
  }
}

export class PerformanceBenchmark {
  private config: Configuration

  constructor(config?: Configuration) {
    this.config = config || new Configuration()
  }

  /**
   * Benchmark single article extraction
   */
  async benchmarkArticle(url: string): Promise<BenchmarkResult> {
    const startTime = performance.now()
    const startMemory = this.getMemoryUsage()

    let downloadTime = 0
    let parseTime = 0
    let success = false
    let error: string | undefined
    let metadata = {
      titleLength: 0,
      textLength: 0,
      imageCount: 0,
      authorCount: 0
    }

    try {
      const article = new Article(url, this.config)

      // Benchmark download phase
      const downloadStart = performance.now()
      await article.download()
      downloadTime = performance.now() - downloadStart

      // Benchmark parse phase
      const parseStart = performance.now()
      await article.parse()
      parseTime = performance.now() - parseStart

      // Collect metadata
      metadata = {
        titleLength: article.title?.length || 0,
        textLength: article.text?.length || 0,
        imageCount: article.images?.length || 0,
        authorCount: article.authors?.length || 0
      }

      success = true
    } catch (err) {
      error = err instanceof Error ? err.message : 'Unknown error'
      logger.warn('PerformanceBenchmark', `Benchmark failed for ${url}`, { error })
    }

    const totalTime = performance.now() - startTime
    const endMemory = this.getMemoryUsage()

    return {
      name: 'single_article',
      url,
      extractionTimeMs: totalTime,
      downloadTimeMs: downloadTime,
      parseTimeMs: parseTime,
      memoryUsageMB: endMemory - startMemory,
      success,
      error,
      metadata
    }
  }

  /**
   * Benchmark multiple articles
   */
  async benchmarkArticles(urls: string[], concurrency = 1): Promise<BenchmarkSuite> {
    const suiteStart = performance.now()
    const results: BenchmarkResult[] = []

    logger.info('PerformanceBenchmark', `Starting benchmark suite with ${urls.length} URLs, concurrency: ${concurrency}`)

    if (concurrency === 1) {
      // Sequential processing
      for (const url of urls) {
        const result = await this.benchmarkArticle(url)
        results.push(result)
      }
    } else {
      // Concurrent processing
      const chunks = this.chunkArray(urls, concurrency)
      for (const chunk of chunks) {
        const chunkResults = await Promise.all(
          chunk.map(url => this.benchmarkArticle(url))
        )
        results.push(...chunkResults)
      }
    }

    const totalTime = performance.now() - suiteStart
    const successfulResults = results.filter(r => r.success)
    const memoryUsages = results.map(r => r.memoryUsageMB)

    const suite: BenchmarkSuite = {
      name: `benchmark_${urls.length}_articles_concurrency_${concurrency}`,
      results,
      totalTimeMs: totalTime,
      averageTimeMs: successfulResults.length > 0 
        ? successfulResults.reduce((sum, r) => sum + r.extractionTimeMs, 0) / successfulResults.length 
        : 0,
      successRate: results.length > 0 ? successfulResults.length / results.length : 0,
      memoryStats: {
        min: Math.min(...memoryUsages),
        max: Math.max(...memoryUsages),
        average: memoryUsages.reduce((sum, m) => sum + m, 0) / memoryUsages.length
      }
    }

    logger.info('PerformanceBenchmark', `Completed benchmark suite`, {
      totalUrls: urls.length,
      successful: successfulResults.length,
      totalTimeMs: totalTime,
      averageTimeMs: suite.averageTimeMs,
      successRate: suite.successRate
    })

    return suite
  }

  /**
   * Memory stress test
   */
  async stressTestMemory(urls: string[], iterations = 100): Promise<{
    memoryLeakDetected: boolean
    memoryGrowthMB: number
    peakMemoryMB: number
    iterations: number
  }> {
    logger.info('PerformanceBenchmark', `Starting memory stress test with ${iterations} iterations`)

    const initialMemory = this.getMemoryUsage()
    let peakMemory = initialMemory
    const memoryReadings: number[] = []

    for (let i = 0; i < iterations; i++) {
      const url = urls[i % urls.length]
      
      try {
        const article = new Article(url, this.config)
        await article.download()
        await article.parse()
      } catch (error) {
        // Continue with stress test even if individual articles fail
      }

      // Force garbage collection if available
      if (global.gc) {
        global.gc()
      }

      const currentMemory = this.getMemoryUsage()
      memoryReadings.push(currentMemory)
      peakMemory = Math.max(peakMemory, currentMemory)

      if (i % 10 === 0) {
        logger.debug('PerformanceBenchmark', `Stress test iteration ${i}`, {
          currentMemoryMB: currentMemory,
          peakMemoryMB: peakMemory
        })
      }
    }

    const finalMemory = this.getMemoryUsage()
    const memoryGrowth = finalMemory - initialMemory
    
    // Simple leak detection: if memory grew by more than 50MB, consider it a potential leak
    const memoryLeakDetected = memoryGrowth > 50

    logger.info('PerformanceBenchmark', `Completed memory stress test`, {
      iterations,
      initialMemoryMB: initialMemory,
      finalMemoryMB: finalMemory,
      memoryGrowthMB: memoryGrowth,
      peakMemoryMB: peakMemory,
      memoryLeakDetected
    })

    return {
      memoryLeakDetected,
      memoryGrowthMB: memoryGrowth,
      peakMemoryMB: peakMemory,
      iterations
    }
  }

  /**
   * Get current memory usage in MB
   */
  private getMemoryUsage(): number {
    const usage = process.memoryUsage()
    return usage.heapUsed / 1024 / 1024 // Convert to MB
  }

  /**
   * Split array into chunks for concurrent processing
   */
  private chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = []
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize))
    }
    return chunks
  }

  /**
   * Generate performance report
   */
  generateReport(suite: BenchmarkSuite): string {
    const report = [
      `Performance Benchmark Report: ${suite.name}`,
      '='.repeat(50),
      `Total URLs: ${suite.results.length}`,
      `Successful: ${suite.results.filter(r => r.success).length}`,
      `Success Rate: ${(suite.successRate * 100).toFixed(1)}%`,
      `Total Time: ${suite.totalTimeMs.toFixed(2)}ms`,
      `Average Time: ${suite.averageTimeMs.toFixed(2)}ms`,
      '',
      'Memory Statistics:',
      `  Min: ${suite.memoryStats.min.toFixed(2)}MB`,
      `  Max: ${suite.memoryStats.max.toFixed(2)}MB`,
      `  Average: ${suite.memoryStats.average.toFixed(2)}MB`,
      '',
      'Detailed Results:',
      ...suite.results.map(r => 
        `  ${r.url}: ${r.success ? `${r.extractionTimeMs.toFixed(2)}ms` : `FAILED: ${r.error}`}`
      )
    ]

    return report.join('\n')
  }
}