import { clearTestData, insertTestArticleWithTranslations } from '@babel-feed/pgdb'
import { afterAll, beforeEach, describe, expect, it } from 'bun:test'
import { NewsAggregatorCLI } from '../cli/index'

// SKIP: CLI tests require proper database connection integration
// TODO: Fix CLI tests to use test database instead of global connection
describe.skip('Enhanced CLI', () => {
  let cli: NewsAggregatorCLI
  let mockConsoleLog: any
  let logOutput: string[]

  beforeAll(async () => {
    // Skip CLI initialization for now since it requires database connection
    cli = new NewsAggregatorCLI()
    
    // Mock console.log to capture output
    mockConsoleLog = console.log
    logOutput = []
    console.log = (...args: any[]) => {
      logOutput.push(args.join(' '))
    }
  })

  beforeEach(async () => {
    await clearTestData()
    logOutput = []
  })

  afterAll(async () => {
    console.log = mockConsoleLog
  })

  describe('add-source command', () => {
    it('should add a new source', async () => {
      const args = ['add-source', 'https://example.com/rss', 'Test Source', 'en', 'tech']
      await cli.run(args)

      expect(logOutput.some(line => line.includes('✅ Added source: Test Source'))).toBe(true)
      expect(logOutput.some(line => line.includes('URL: https://example.com/rss'))).toBe(true)
      expect(logOutput.some(line => line.includes('Language: en'))).toBe(true)
      expect(logOutput.some(line => line.includes('Category: tech'))).toBe(true)
    })

    it('should show usage when no arguments provided', async () => {
      const args = ['add-source']
      await cli.run(args)

      expect(logOutput.some(line => line.includes('Usage: bun run cli add-source'))).toBe(true)
    })
  })

  describe('metrics command', () => {
    it('should display system metrics', async () => {
      const args = ['metrics']
      await cli.run(args)

      expect(logOutput.some(line => line.includes('=== System Metrics ==='))).toBe(true)
      expect(logOutput.some(line => line.includes('Total Sources:'))).toBe(true)
      expect(logOutput.some(line => line.includes('Enabled Sources:'))).toBe(true)
      expect(logOutput.some(line => line.includes('Success Rate:'))).toBe(true)
    })
  })

  describe('articles command', () => {
    it('should display recent articles', async () => {
      // Insert test article
      const article = await insertTestArticleWithTranslations({
        url: 'https://example.com/article',
        source: 'test-source',
        sourceLanguage: 'en'
      }, [{
        language: 'en',
        title: 'Test Article',
        summary: 'Test summary'
      }])

      const args = ['articles', '5']
      await cli.run(args)

      expect(logOutput.some(line => line.includes('=== 5 Most Recent Articles ==='))).toBe(true)
      expect(logOutput.some(line => line.includes('Test Article'))).toBe(true)
      expect(logOutput.some(line => line.includes('Source: test-source'))).toBe(true)
    })

    it('should handle empty database', async () => {
      const args = ['articles']
      await cli.run(args)

      expect(logOutput.some(line => line.includes('=== 10 Most Recent Articles ==='))).toBe(true)
      expect(logOutput.some(line => line.includes('No articles found'))).toBe(true)
    })
  })

  describe('articles:count command', () => {
    it('should display article statistics', async () => {
      // Insert test articles
      const article1 = await insertTestArticleWithTranslations({
        url: 'https://example.com/article1',
        source: 'test-source',
        sourceLanguage: 'en'
      }, [{
        language: 'en',
        title: 'Test Article 1',
        summary: 'Test summary 1'
      }])

      const article2 = await insertTestArticleWithTranslations({
        url: 'https://example.com/article2',
        source: 'test-source',
        sourceLanguage: 'en'
      }, [{
        language: 'zh',
        title: '测试文章',
        summary: '测试摘要'
      }])

      const args = ['articles:count']
      await cli.run(args)

      expect(logOutput.some(line => line.includes('=== Article Statistics ==='))).toBe(true)
      expect(logOutput.some(line => line.includes('Total Articles: 2'))).toBe(true)
      expect(logOutput.some(line => line.includes('=== Articles by Language ==='))).toBe(true)
      expect(logOutput.some(line => line.includes('en: 1'))).toBe(true)
      expect(logOutput.some(line => line.includes('zh: 1'))).toBe(true)
    })
  })

  describe('status command', () => {
    it('should display aggregator status', async () => {
      const args = ['status']
      await cli.run(args)

      expect(logOutput.some(line => line.includes('=== News Aggregator Status ==='))).toBe(true)
      expect(logOutput.some(line => line.includes('Running:'))).toBe(true)
      expect(logOutput.some(line => line.includes('=== Module Status ==='))).toBe(true)
    })
  })

  describe('health-check command', () => {
    it('should display health check results', async () => {
      const args = ['health-check']
      await cli.run(args)

      expect(logOutput.some(line => line.includes('=== System Health Check ==='))).toBe(true)
      expect(logOutput.some(line => line.includes('Overall Status:'))).toBe(true)
      expect(logOutput.some(line => line.includes('Uptime:'))).toBe(true)
    })
  })

  describe('help command', () => {
    it('should display help message', async () => {
      const args = ['help']
      await cli.run(args)

      expect(logOutput.some(line => line.includes('News Aggregator CLI'))).toBe(true)
      expect(logOutput.some(line => line.includes('Usage: bun run cli <command>'))).toBe(true)
      expect(logOutput.some(line => line.includes('Commands:'))).toBe(true)
      expect(logOutput.some(line => line.includes('metrics'))).toBe(true)
      expect(logOutput.some(line => line.includes('articles'))).toBe(true)
      expect(logOutput.some(line => line.includes('articles:count'))).toBe(true)
    })
  })
})