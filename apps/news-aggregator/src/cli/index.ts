#!/usr/bin/env bun
import { logger } from '../modules/common/logger'
import { ensureDbConnection } from '../modules/common/db'
import { NewsAggregatorService } from '../services/news-aggregator-service'

const COMMANDS = {
  'status': 'Show aggregator status',
  'sources': 'List all configured sources',
  'sources:enabled': 'List enabled sources',
  'sources:health': 'Show source health status',
  'ai-providers': 'List all AI providers',
  'ai-providers:health': 'Show AI provider health status',
  'add-source': 'Add a new news source',
  'remove-source': 'Remove a source by ID',
  'discover-sources': 'Run source discovery',
  'health-check': 'Check system health',
  'metrics': 'Show system metrics',
  'articles': 'Show recent articles',
  'articles:count': 'Show article count statistics',
  'help': 'Show this help message',
}

export class NewsAggregatorCLI {
  private service?: NewsAggregatorService

  async initialize(): Promise<void> {
    await ensureDbConnection()
    this.service = new NewsAggregatorService()
    await this.service.initialize()
  }

  async run(args: string[]): Promise<void> {
    if (args.length === 0 || args[0] === 'help') {
      this.showHelp()
      return
    }

    const command = args[0]
    const commandArgs = args.slice(1)

    try {
      await this.initialize()

      switch (command) {
        case 'status':
          await this.showStatus(commandArgs)
          break
        case 'sources':
          await this.listSources(commandArgs)
          break
        case 'sources:enabled':
          await this.showEnabledSources(commandArgs)
          break
        case 'sources:health':
          await this.showSourceHealth(commandArgs)
          break
        case 'ai-providers':
          await this.showAiProviders(commandArgs)
          break
        case 'ai-providers:health':
          await this.showAiProviderHealth(commandArgs)
          break
        case 'add-source':
          await this.addSource(commandArgs)
          break
        case 'remove-source':
          await this.removeSource(commandArgs)
          break
        case 'discover-sources':
          await this.discoverSources(commandArgs)
          break
        case 'health-check':
          await this.healthCheck(commandArgs)
          break
        case 'metrics':
          await this.showMetrics(commandArgs)
          break
        case 'articles':
          await this.showRecentArticles(commandArgs)
          break
        case 'articles:count':
          await this.showArticleCount(commandArgs)
          break
        case 'help':
          this.showHelp()
          break
        default:
          console.log(`Unknown command: ${command}`)
          this.showHelp()
          process.exit(1)
      }
    } catch (error) {
      logger.error('CLI command failed:', error)
      process.exit(1)
    }
  }

  private showHelp(): void {
    console.log('\nNews Aggregator CLI')
    console.log('Usage: bun run cli <command> [options]')
    console.log('\nCommands:')
    for (const [cmd, description] of Object.entries(COMMANDS)) {
      console.log(`  ${cmd.padEnd(20)} ${description}`)
    }
    console.log('\nExamples:')
    console.log('  bun run cli status')
    console.log('  bun run cli sources')
    console.log('  bun run cli health-check')
    console.log('  bun run cli add-source https://example.com/rss')
  }

  private async showStatus(_args: string[]): Promise<void> {
    if (!this.service) throw new Error('Service not initialized')
    
    const status = await this.service.getStatus()
    
    console.log('\n=== News Aggregator Status ===')
    console.log(`Running: ${status.running ? '✅' : '❌'}`)
    
    if (status.modules) {
      console.log('\n=== Module Status ===')
      for (const [name, moduleStatus] of Object.entries(status.modules)) {
        const icon = moduleStatus.running ? '✅' : '❌'
        console.log(`${name}: ${icon} ${moduleStatus.running ? 'Running' : 'Stopped'}`)
      }
    }
  }

  private async listSources(_args: string[]): Promise<void> {
    if (!this.service) throw new Error('Service not initialized')
    
    try {
      // Use legacy method for now since database CRUD is not implemented
      const sourceManager = this.service.getSourceManager()
      const sources = await sourceManager.getAllSources()
      
      console.log('\n=== All News Sources ===')
      if (sources.length === 0) {
        console.log('No sources configured')
        return
      }
      
      for (const source of sources) {
        console.log(`\n${source.name} (${source.id})`)
        console.log(`  URL: ${source.url}`)
        console.log(`  Language: ${source.language}`)
        console.log(`  Category: ${source.category}`)
        console.log(`  Type: ${source.sourceType}`)
        console.log(`  Enabled: ${source.enabled ? '✅' : '❌'}`)
        console.log(`  Polling: ${source.pollingInterval}ms`)
        console.log(`  Reliability: ${source.reliability}%`)
        console.log(`  Priority: ${source.priority}`)
        console.log(`  Success Count: ${source.successCount}`)
        console.log(`  Error Count: ${source.errorCount}`)
        if (source.lastFetched) {
          console.log(`  Last Fetched: ${source.lastFetched.toISOString()}`)
        }
        if (source.lastError) {
          console.log(`  Last Error: ${source.lastError}`)
        }
      }
    } catch (error) {
      console.log('Error listing sources:', error)
    }
  }

  private async showEnabledSources(_args: string[]): Promise<void> {
    if (!this.service) throw new Error('Service not initialized')
    
    try {
      const sourceManager = this.service.getSourceManager()
      const sources = await sourceManager.getEnabledSources()
      
      console.log('\n=== Enabled News Sources ===')
      if (sources.length === 0) {
        console.log('No enabled sources')
        return
      }
      
      for (const source of sources) {
        console.log(`✅ ${source.name} (${source.language}) - ${source.url}`)
      }
    } catch (error) {
      console.log('Error listing enabled sources:', error)
    }
  }

  private async showSourceHealth(_args: string[]): Promise<void> {
    if (!this.service) throw new Error('Service not initialized')
    
    try {
      const healthChecker = this.service.getHealthChecker()
      const health = await healthChecker.getHealthStatus()
      
      console.log('\n=== Source Health Status ===')
      console.log(`Overall Status: ${this.getHealthIcon(health.status)} ${health.status}`)
      console.log(`Total Sources: ${health.summary.totalSources}`)
      console.log(`Healthy Sources: ${health.summary.healthySources}`)
      console.log(`Unhealthy Sources: ${health.summary.unhealthySources}`)
      console.log(`Uptime: ${Math.round(health.uptime / 1000)}s`)
    } catch (error) {
      console.log('Error getting source health:', error)
    }
  }

  private async showAiProviders(_args: string[]): Promise<void> {
    if (!this.service) throw new Error('Service not initialized')
    
    try {
      const aiProviderManager = this.service.getAiProviderManager()
      const providers = await aiProviderManager.getAllProviders()
      
      console.log('\n=== AI Providers ===')
      if (providers.length === 0) {
        console.log('No AI providers configured')
        return
      }
      
      for (const provider of providers) {
        console.log(`\n${provider.displayName} (${provider.name})`)
        console.log(`  Type: ${provider.providerType}`)
        console.log(`  Base URL: ${provider.baseUrl}`)
        console.log(`  Enabled: ${provider.enabled ? '✅' : '❌'}`)
        console.log(`  Priority: ${provider.priority}`)
      }
    } catch (error) {
      console.log('Error listing AI providers:', error)
    }
  }

  private async showAiProviderHealth(_args: string[]): Promise<void> {
    if (!this.service) throw new Error('Service not initialized')
    
    try {
      const aiProviderManager = this.service.getAiProviderManager()
      const providers = await aiProviderManager.getEnabledProviders()
      
      console.log('\n=== AI Provider Health Status ===')
      if (providers.length === 0) {
        console.log('No enabled AI providers')
        return
      }
      
      for (const provider of providers) {
        const health = await aiProviderManager.getProviderHealth(provider.id)
        console.log(`\n${provider.displayName}: ${this.getHealthIcon(health.healthy ? 'healthy' : 'unhealthy')}`)
        console.log(`  Status: ${health.healthy ? 'Healthy' : 'Unhealthy'}`)
        console.log(`  Circuit State: ${health.circuitState}`)
        console.log(`  Available Keys: ${health.availableKeys}/${health.totalKeys}`)
        console.log(`  Error Rate: ${health.errorRate.toFixed(1)}%`)
        console.log(`  Last Check: ${health.lastCheck.toISOString()}`)
      }
    } catch (error) {
      console.log('Error getting AI provider health:', error)
    }
  }

  private async addSource(args: string[]): Promise<void> {
    if (args.length === 0) {
      console.log('Usage: bun run cli add-source <url> [name] [language] [category]')
      console.log('Example: bun run cli add-source https://example.com/rss "Example News" en tech')
      return
    }
    
    const url = args[0]
    const name = args[1] || `Source for ${url}`
    const language = args[2] || 'en'
    const category = args[3] || 'general'
    
    if (!this.service) throw new Error('Service not initialized')
    
    try {
      const sourceCRUD = this.service.getSourceCRUD()
      
      const newSource = {
        name,
        slug: name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        url,
        sourceType: 'rss',
        language,
        category,
        tags: [],
        enabled: true,
        pollingInterval: 300000, // 5 minutes
        reliability: 100,
        priority: 5,
        metadata: {}
      }
      
      const source = await sourceCRUD.createSource(newSource)
      console.log(`✅ Added source: ${source.name} (${source.id})`)
      console.log(`   URL: ${source.url}`)
      console.log(`   Language: ${source.language}`)
      console.log(`   Category: ${source.category}`)
    } catch (error) {
      console.log(`❌ Error adding source: ${error}`)
    }
  }

  private async removeSource(args: string[]): Promise<void> {
    if (args.length === 0) {
      console.log('Usage: bun run cli remove-source <id>')
      console.log('Example: bun run cli remove-source 123e4567-e89b-12d3-a456-426614174000')
      return
    }
    
    const id = args[0]
    
    if (!this.service) throw new Error('Service not initialized')
    
    try {
      const sourceCRUD = this.service.getSourceCRUD()
      const source = await sourceCRUD.getSourceById(id)
      
      if (!source) {
        console.log(`❌ Source not found: ${id}`)
        return
      }
      
      await sourceCRUD.deleteSource(id)
      console.log(`✅ Removed source: ${source.name} (${id})`)
    } catch (error) {
      console.log(`❌ Error removing source: ${error}`)
    }
  }

  private async discoverSources(_args: string[]): Promise<void> {
    if (!this.service) throw new Error('Service not initialized')
    
    try {
      const discovery = this.service.getSourceDiscovery()
      const status = discovery.getStatus()
      
      if (status.running) {
        console.log('Source discovery is already running')
      } else {
        console.log('Starting source discovery...')
        await discovery.startDiscovery()
        console.log('Source discovery started')
      }
    } catch (error) {
      console.log('Error with source discovery:', error)
    }
  }

  private async healthCheck(_args: string[]): Promise<void> {
    if (!this.service) throw new Error('Service not initialized')
    
    try {
      const healthMonitor = this.service.getHealthMonitor()
      const health = await healthMonitor.getHealthStatus()
      
      console.log('\n=== System Health Check ===')
      console.log(`Overall Status: ${this.getHealthIcon(health.status)} ${health.status}`)
      console.log(`Uptime: ${Math.round(health.uptime / 1000)}s`)
      
      console.log('\n=== Services Status ===')
      for (const service of health.services || []) {
        console.log(`${service.name}: ${this.getHealthIcon(service.status)} ${service.status}`)
        if (service.responseTime) {
          console.log(`  Response Time: ${service.responseTime}ms`)
        }
      }
    } catch (error) {
      console.log('Error during health check:', error)
    }
  }

  private async showMetrics(_args: string[]): Promise<void> {
    if (!this.service) throw new Error('Service not initialized')
    
    try {
      const sourceManager = this.service.getSourceManager()
      const sources = await sourceManager.getAllSources()
      
      const enabledSources = sources.filter(s => s.enabled)
      const healthySources = sources.filter(s => s.reliability > 80)
      const totalSuccesses = sources.reduce((sum, s) => sum + s.successCount, 0)
      const totalErrors = sources.reduce((sum, s) => sum + s.errorCount, 0)
      const totalRequests = totalSuccesses + totalErrors
      const successRate = totalRequests > 0 ? (totalSuccesses / totalRequests * 100).toFixed(1) : '0.0'
      
      console.log('\n=== System Metrics ===')
      console.log(`Total Sources: ${sources.length}`)
      console.log(`Enabled Sources: ${enabledSources.length}`)
      console.log(`Healthy Sources: ${healthySources.length}`)
      console.log(`Success Rate: ${successRate}%`)
      console.log(`Total Requests: ${totalRequests}`)
      console.log(`Total Successes: ${totalSuccesses}`)
      console.log(`Total Errors: ${totalErrors}`)
      
      // Show top performing sources
      const topSources = sources
        .filter(s => s.successCount > 0)
        .sort((a, b) => b.successCount - a.successCount)
        .slice(0, 5)
      
      if (topSources.length > 0) {
        console.log('\n=== Top Performing Sources ===')
        topSources.forEach(source => {
          console.log(`${source.name}: ${source.successCount} successes, ${source.errorCount} errors`)
        })
      }
    } catch (error) {
      console.log('Error getting metrics:', error)
    }
  }

  private async showRecentArticles(args: string[]): Promise<void> {
    if (!this.service) throw new Error('Service not initialized')
    
    const limit = parseInt(args[0]) || 10
    
    try {
      const { getDatabase } = await import('@babel-feed/pgdb')
      const { articles, articleTranslations } = await import('@babel-feed/pgdb')
      const { eq, desc } = await import('drizzle-orm')
      
      const db = await getDatabase()
      
      const recentArticles = await db
        .select({
          id: articles.id,
          url: articles.url,
          source: articles.source,
          publishedAt: articles.publishedAt,
          title: articleTranslations.title,
          language: articleTranslations.language
        })
        .from(articles)
        .leftJoin(articleTranslations, eq(articles.id, articleTranslations.articleId))
        .orderBy(desc(articles.publishedAt))
        .limit(limit)
      
      console.log(`\n=== ${limit} Most Recent Articles ===`)
      if (recentArticles.length === 0) {
        console.log('No articles found')
        return
      }
      
      recentArticles.forEach(article => {
        console.log(`\n${article.title || 'Untitled'} (${article.language || 'unknown'})`)
        console.log(`  Source: ${article.source}`)
        console.log(`  Published: ${article.publishedAt ? article.publishedAt.toISOString() : 'Unknown'}`)
        console.log(`  URL: ${article.url}`)
      })
    } catch (error) {
      console.log('Error getting recent articles:', error)
    }
  }

  private async showArticleCount(_args: string[]): Promise<void> {
    if (!this.service) throw new Error('Service not initialized')
    
    try {
      const { getDatabase } = await import('@babel-feed/pgdb')
      const { articles, articleTranslations } = await import('@babel-feed/pgdb')
      const { sql, eq } = await import('drizzle-orm')
      
      const db = await getDatabase()
      
      // Total articles
      const [{ count: totalArticles }] = await db
        .select({ count: sql<number>`count(*)` })
        .from(articles)
      
      // Articles by language
      const articlesByLanguage = await db
        .select({
          language: articleTranslations.language,
          count: sql<number>`count(*)`
        })
        .from(articleTranslations)
        .groupBy(articleTranslations.language)
        .orderBy(sql`count(*) desc`)
      
      // Articles by source
      const articlesBySource = await db
        .select({
          source: articles.source,
          count: sql<number>`count(*)`
        })
        .from(articles)
        .groupBy(articles.source)
        .orderBy(sql`count(*) desc`)
        .limit(10)
      
      console.log('\n=== Article Statistics ===')
      console.log(`Total Articles: ${totalArticles}`)
      
      if (articlesByLanguage.length > 0) {
        console.log('\n=== Articles by Language ===')
        articlesByLanguage.forEach(item => {
          console.log(`${item.language}: ${item.count}`)
        })
      }
      
      if (articlesBySource.length > 0) {
        console.log('\n=== Top 10 Sources by Article Count ===')
        articlesBySource.forEach(item => {
          console.log(`${item.source}: ${item.count}`)
        })
      }
    } catch (error) {
      console.log('Error getting article count:', error)
    }
  }

  private getHealthIcon(status: string): string {
    switch (status) {
      case 'healthy': return '✅'
      case 'degraded': return '⚠️'
      case 'unhealthy': return '❌'
      default: return '❓'
    }
  }
}

// CLI entry point
if (import.meta.main) {
  const cli = new NewsAggregatorCLI()
  const args = process.argv.slice(2)
  
  cli.run(args).catch((error) => {
    logger.error('CLI error:', error)
    process.exit(1)
  })
}