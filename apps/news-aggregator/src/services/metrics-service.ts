import { articles, articleTranslations, getDatabase, getTestDb, newsSources } from '@babel-feed/pgdb'
import { gte, sql } from 'drizzle-orm'
import { logger } from '@babel-feed/utils'

export interface SystemMetrics {
  timestamp: string
  uptime: number
  sources: {
    total: number
    enabled: number
    healthy: number
    successRate: number
    totalRequests: number
    totalSuccesses: number
    totalErrors: number
  }
  articles: {
    total: number
    last24h: number
    lastWeek: number
    byLanguage: Array<{ language: string; count: number }>
    bySource: Array<{ source: string; count: number }>
  }
  performance: {
    avgResponseTime?: number
    errorRate: number
    memoryUsage: NodeJS.MemoryUsage
  }
}

export interface AlertConfig {
  enabled: boolean
  errorRateThreshold: number
  responseTimeThreshold: number
  healthCheckInterval: number
  emailNotifications: boolean
  slackWebhook?: string
}

export interface Alert {
  severity: 'warning' | 'critical'
  message: string
  threshold: number
}

export class MetricsService {
  private startTime = Date.now()
  private alertConfig: AlertConfig = {
    enabled: false,
    errorRateThreshold: 10, // 10% error rate
    responseTimeThreshold: 5000, // 5 seconds
    healthCheckInterval: 30000, // 30 seconds
    emailNotifications: false
  }
  
  private metrics: SystemMetrics | null = null
  private metricsInterval?: NodeJS.Timeout
  private alertInterval?: NodeJS.Timeout
  
  private async getDb() {
    return process.env.NODE_ENV === 'test' ? getTestDb() : await getDatabase()
  }

  async initialize(): Promise<void> {
    // Collect initial metrics
    await this.collectMetrics()
    
    // Start periodic metrics collection
    this.metricsInterval = setInterval(async () => {
      await this.collectMetrics()
    }, 60000) // Every minute
    
    // Start alert checking if enabled
    if (this.alertConfig.enabled) {
      this.alertInterval = setInterval(async () => {
        await this.checkAlerts()
      }, this.alertConfig.healthCheckInterval)
    }
    
  }

  async collectMetrics(): Promise<SystemMetrics> {
    try {
      const db = await this.getDb()
      const now = new Date()
      const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000)
      const lastWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

      // Source metrics
      const sources = await db.select().from(newsSources)
      const enabledSources = sources.filter(s => s.enabled)
      const healthySources = sources.filter(s => s.reliability > 80)
      const totalSuccesses = sources.reduce((sum, s) => sum + s.successCount, 0)
      const totalErrors = sources.reduce((sum, s) => sum + s.errorCount, 0)
      const totalRequests = totalSuccesses + totalErrors
      const successRate = totalRequests > 0 ? (totalSuccesses / totalRequests * 100) : 0

      // Article metrics
      const [{ count: totalArticles }] = await db
        .select({ count: sql<number>`count(*)` })
        .from(articles)

      const [{ count: articles24h }] = await db
        .select({ count: sql<number>`count(*)` })
        .from(articles)
        .where(gte(articles.publishedAt, last24h))

      const [{ count: articlesWeek }] = await db
        .select({ count: sql<number>`count(*)` })
        .from(articles)
        .where(gte(articles.publishedAt, lastWeek))

      // Articles by language
      const articlesByLanguage = await db
        .select({
          language: articleTranslations.language,
          count: sql<number>`count(*)`
        })
        .from(articleTranslations)
        .groupBy(articleTranslations.language)
        .orderBy(sql`count(*) desc`)
        .limit(10)

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

      // Performance metrics
      const memoryUsage = process.memoryUsage()
      const errorRate = totalRequests > 0 ? (totalErrors / totalRequests * 100) : 0

      this.metrics = {
        timestamp: now.toISOString(),
        uptime: Date.now() - this.startTime,
        sources: {
          total: sources.length,
          enabled: enabledSources.length,
          healthy: healthySources.length,
          successRate,
          totalRequests,
          totalSuccesses,
          totalErrors
        },
        articles: {
          total: totalArticles,
          last24h: articles24h,
          lastWeek: articlesWeek,
          byLanguage: articlesByLanguage,
          bySource: articlesBySource
        },
        performance: {
          errorRate,
          memoryUsage
        }
      }

      return this.metrics
    } catch (error) {
      logger.error('Error collecting metrics:', error)
      throw error
    }
  }

  async getMetrics(): Promise<SystemMetrics | null> {
    return this.metrics
  }

  async getHealthStatus(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy'
    checks: Array<{
      name: string
      status: 'pass' | 'fail' | 'warn'
      message: string
      responseTime?: number
    }>
  }> {
    const checks = []
    let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy'

    try {
      // Database health check
      const dbStart = Date.now()
      await getDatabase()
      const dbTime = Date.now() - dbStart
      
      checks.push({
        name: 'Database Connection',
        status: dbTime < 1000 ? 'pass' : 'warn',
        message: `Database responded in ${dbTime}ms`,
        responseTime: dbTime
      })

      // Source health check
      if (this.metrics) {
        const { sources } = this.metrics
        const healthyRatio = sources.total > 0 ? sources.healthy / sources.total : 0
        
        checks.push({
          name: 'Source Health',
          status: healthyRatio > 0.8 ? 'pass' : healthyRatio > 0.5 ? 'warn' : 'fail',
          message: `${sources.healthy}/${sources.total} sources healthy (${(healthyRatio * 100).toFixed(1)}%)`
        })

        // Error rate check
        const errorRate = this.metrics.performance.errorRate || 0
        checks.push({
          name: 'Error Rate',
          status: errorRate < 5 ? 'pass' : errorRate < 15 ? 'warn' : 'fail',
          message: `${errorRate.toFixed(1)}% error rate`
        })

        // Memory usage check
        const memoryUsage = this.metrics.performance.memoryUsage
        const memoryUsageMB = memoryUsage.heapUsed / 1024 / 1024
        checks.push({
          name: 'Memory Usage',
          status: memoryUsageMB < 500 ? 'pass' : memoryUsageMB < 1000 ? 'warn' : 'fail',
          message: `${memoryUsageMB.toFixed(1)}MB heap used`
        })
      }

      // Determine overall status
      const failedChecks = checks.filter(c => c.status === 'fail')
      const warnChecks = checks.filter(c => c.status === 'warn')
      
      if (failedChecks.length > 0) {
        overallStatus = 'unhealthy'
      } else if (warnChecks.length > 0) {
        overallStatus = 'degraded'
      }

      // Ensure status is always 'pass' | 'fail' | 'warn' for all checks
      return {
        status: overallStatus,
        checks: checks as Array<{
          name: string
          status: 'pass' | 'fail' | 'warn'
          message: string
          responseTime?: number
        }>
      }
    } catch (error) {
      logger.error('Health check failed:', error)
      return {
        status: 'unhealthy',
        checks: [{
          name: 'Health Check',
          status: 'fail',
          message: `Health check failed: ${error}`
        }]
      }
    }
  }

  private async checkAlerts(): Promise<void> {
    if (!this.metrics) return

    const { sources, performance } = this.metrics
    const alerts: Alert[] = []

    // Check error rate
    if (performance.errorRate > this.alertConfig.errorRateThreshold) {
      alerts.push({
        severity: 'warning',
        message: `High error rate: ${performance.errorRate.toFixed(1)}%`,
        threshold: this.alertConfig.errorRateThreshold
      })
    }

    // Check source health
    const healthyRatio = sources.total > 0 ? sources.healthy / sources.total : 0
    if (healthyRatio < 0.5) {
      alerts.push({
        severity: 'critical',
        message: `Low source health: ${(healthyRatio * 100).toFixed(1)}%`,
        threshold: 50
      })
    }

    // Send alerts if any
    if (alerts.length > 0) {
      await this.sendAlerts(alerts)
    }
  }

  private async sendAlerts(alerts: Alert[]): Promise<void> {
    for (const alert of alerts) {
      logger.warn(`ALERT [${alert.severity}]: ${alert.message}`)
      
      // Here you would integrate with external alerting systems
      // For example: email, Slack, PagerDuty, etc.
      if (this.alertConfig.slackWebhook) {
        // Send to Slack webhook
        // await this.sendSlackAlert(alert)
      }
    }
  }

  async updateAlertConfig(config: Partial<AlertConfig>): Promise<void> {
    this.alertConfig = { ...this.alertConfig, ...config }
    
    // Restart alert checking if enabled state changed
    if (this.alertInterval) {
      clearInterval(this.alertInterval)
      this.alertInterval = undefined
    }
    
    if (this.alertConfig.enabled) {
      this.alertInterval = setInterval(async () => {
        await this.checkAlerts()
      }, this.alertConfig.healthCheckInterval)
    }
    
    logger.info('Alert configuration updated', this.alertConfig)
  }

  async stop(): Promise<void> {
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval)
      this.metricsInterval = undefined
    }
    
    if (this.alertInterval) {
      clearInterval(this.alertInterval)
      this.alertInterval = undefined
    }
    
    logger.info('Metrics service stopped')
  }
}