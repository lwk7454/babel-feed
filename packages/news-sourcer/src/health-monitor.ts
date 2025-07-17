/**
 * Health monitoring and endpoint checking system
 */

import { logger } from '@babel-feed/utils'
import type { StoredEndpoint } from './types.js'
import type { CircuitBreakerMetrics } from './circuit-breaker.js'
import type { RateLimiterMetrics } from './rate-limiter.js'

export interface HealthCheckResult {
  status: 'healthy' | 'degraded' | 'unhealthy'
  timestamp: Date
  checks: {
    database: {
      status: 'healthy' | 'unhealthy'
      responseTime: number
      error?: string
    }
    endpoints: {
      status: 'healthy' | 'degraded' | 'unhealthy'
      totalEndpoints: number
      healthyEndpoints: number
      degradedEndpoints: number
      unhealthyEndpoints: number
      averageReliability: number
    }
    circuitBreakers: {
      status: 'healthy' | 'degraded' | 'unhealthy'
      totalBreakers: number
      openBreakers: number
      halfOpenBreakers: number
      metrics: Record<string, CircuitBreakerMetrics>
    }
    rateLimiters: {
      status: 'healthy' | 'degraded' | 'unhealthy'
      totalLimiters: number
      averageTokens: number
      rejectedRequests: number
      metrics: Record<string, RateLimiterMetrics>
    }
  }
  summary: {
    overallHealth: number // 0-1 score
    issues: string[]
    recommendations: string[]
  }
}

export interface HealthCheckConfig {
  endpointHealthThreshold: number
  reliabilityThreshold: number
  circuitBreakerThreshold: number
  rateLimitRejectionThreshold: number
  checkInterval: number
}

export interface EndpointHealthAssessment {
  status: 'healthy' | 'degraded' | 'unhealthy'
  totalEndpoints: number
  healthyEndpoints: number
  degradedEndpoints: number
  unhealthyEndpoints: number
  averageReliability: number
}

export interface CircuitBreakerHealthAssessment {
  status: 'healthy' | 'degraded' | 'unhealthy'
  totalBreakers: number
  openBreakers: number
  halfOpenBreakers: number
  metrics: Record<string, CircuitBreakerMetrics>
}

export interface RateLimiterHealthAssessment {
  status: 'healthy' | 'degraded' | 'unhealthy'
  totalLimiters: number
  averageTokens: number
  rejectedRequests: number
  metrics: Record<string, RateLimiterMetrics>
}

export class HealthMonitor {
  private config: HealthCheckConfig
  private lastHealthCheck: HealthCheckResult | null = null
  private checkInterval: NodeJS.Timeout | null = null

  constructor(config: Partial<HealthCheckConfig> = {}) {
    this.config = {
      endpointHealthThreshold: 0.8,
      reliabilityThreshold: 0.7,
      circuitBreakerThreshold: 0.2, // Max 20% of breakers can be open
      rateLimitRejectionThreshold: 0.1, // Max 10% rejection rate
      checkInterval: 60000, // 1 minute
      ...config
    }
  }

  async performHealthCheck(
    getEndpoints: () => Promise<StoredEndpoint[]>,
    getCircuitBreakerMetrics: () => Record<string, CircuitBreakerMetrics>,
    getRateLimiterMetrics: () => Record<string, RateLimiterMetrics>,
    testDatabaseConnection: () => Promise<{ success: boolean; responseTime: number; error?: string }>
  ): Promise<HealthCheckResult> {
    const startTime = Date.now()
    
    try {
      // Check database health
      const dbCheck = await testDatabaseConnection()
      
      // Check endpoints health
      const endpoints = await getEndpoints()
      const endpointHealth = this.assessEndpointHealth(endpoints)
      
      // Check circuit breakers
      const circuitBreakerMetrics = getCircuitBreakerMetrics()
      const circuitBreakerHealth = this.assessCircuitBreakerHealth(circuitBreakerMetrics)
      
      // Check rate limiters
      const rateLimiterMetrics = getRateLimiterMetrics()
      const rateLimiterHealth = this.assessRateLimiterHealth(rateLimiterMetrics)
      
      // Calculate overall health
      const overallHealth = this.calculateOverallHealth(
        dbCheck.success,
        endpointHealth,
        circuitBreakerHealth,
        rateLimiterHealth
      )
      
      const result: HealthCheckResult = {
        status: this.getHealthStatus(overallHealth.score),
        timestamp: new Date(),
        checks: {
          database: {
            status: dbCheck.success ? 'healthy' : 'unhealthy',
            responseTime: dbCheck.responseTime,
            error: dbCheck.error
          },
          endpoints: endpointHealth,
          circuitBreakers: circuitBreakerHealth,
          rateLimiters: rateLimiterHealth
        },
        summary: {
          overallHealth: overallHealth.score,
          issues: overallHealth.issues,
          recommendations: overallHealth.recommendations
        }
      }
      
      this.lastHealthCheck = result
      
      if (result.status !== 'healthy') {
        logger.warn('Health check detected issues', {
          status: result.status,
          issues: result.summary.issues,
          overallHealth: result.summary.overallHealth
        })
      }
      
      return result
      
    } catch (error) {
      logger.error('Health check failed', error)
      
      const failedResult: HealthCheckResult = {
        status: 'unhealthy',
        timestamp: new Date(),
        checks: {
          database: { status: 'unhealthy', responseTime: 0, error: 'Health check failed' },
          endpoints: { status: 'unhealthy', totalEndpoints: 0, healthyEndpoints: 0, degradedEndpoints: 0, unhealthyEndpoints: 0, averageReliability: 0 },
          circuitBreakers: { status: 'unhealthy', totalBreakers: 0, openBreakers: 0, halfOpenBreakers: 0, metrics: {} },
          rateLimiters: { status: 'unhealthy', totalLimiters: 0, averageTokens: 0, rejectedRequests: 0, metrics: {} }
        },
        summary: {
          overallHealth: 0,
          issues: ['Health check system failure'],
          recommendations: ['Check system logs and restart health monitoring']
        }
      }
      
      this.lastHealthCheck = failedResult
      return failedResult
    }
  }

  private assessEndpointHealth(endpoints: StoredEndpoint[]): EndpointHealthAssessment {
    const totalEndpoints = endpoints.length
    let healthyEndpoints = 0
    let degradedEndpoints = 0
    let unhealthyEndpoints = 0
    let totalReliability = 0

    for (const endpoint of endpoints) {
      totalReliability += endpoint.reliability
      
      if (endpoint.reliability >= this.config.reliabilityThreshold) {
        healthyEndpoints++
      } else if (endpoint.reliability >= this.config.reliabilityThreshold * 0.5) {
        degradedEndpoints++
      } else {
        unhealthyEndpoints++
      }
    }

    const averageReliability = totalEndpoints > 0 ? totalReliability / totalEndpoints : 0
    const healthyRatio = totalEndpoints > 0 ? healthyEndpoints / totalEndpoints : 1

    return {
      status: this.getHealthStatus(healthyRatio) as 'healthy' | 'degraded' | 'unhealthy',
      totalEndpoints,
      healthyEndpoints,
      degradedEndpoints,
      unhealthyEndpoints,
      averageReliability
    }
  }

  private assessCircuitBreakerHealth(metrics: Record<string, CircuitBreakerMetrics>): CircuitBreakerHealthAssessment {
    const totalBreakers = Object.keys(metrics).length
    let openBreakers = 0
    let halfOpenBreakers = 0

    for (const metric of Object.values(metrics)) {
      if (metric.state === 'OPEN') {
        openBreakers++
      } else if (metric.state === 'HALF_OPEN') {
        halfOpenBreakers++
      }
    }

    const openRatio = totalBreakers > 0 ? openBreakers / totalBreakers : 0
    const healthScore = Math.max(0, 1 - openRatio / this.config.circuitBreakerThreshold)

    return {
      status: this.getHealthStatus(healthScore) as 'healthy' | 'degraded' | 'unhealthy',
      totalBreakers,
      openBreakers,
      halfOpenBreakers,
      metrics
    }
  }

  private assessRateLimiterHealth(metrics: Record<string, RateLimiterMetrics>): RateLimiterHealthAssessment {
    const totalLimiters = Object.keys(metrics).length
    let totalTokens = 0
    let totalRejected = 0
    let totalRequests = 0

    for (const metric of Object.values(metrics)) {
      totalTokens += metric.currentTokens
      totalRejected += metric.requestsRejected
      totalRequests += metric.requestsAllowed + metric.requestsRejected
    }

    const averageTokens = totalLimiters > 0 ? totalTokens / totalLimiters : 0
    const rejectionRatio = totalRequests > 0 ? totalRejected / totalRequests : 0
    const healthScore = Math.max(0, 1 - rejectionRatio / this.config.rateLimitRejectionThreshold)

    return {
      status: this.getHealthStatus(healthScore) as 'healthy' | 'degraded' | 'unhealthy',
      totalLimiters,
      averageTokens,
      rejectedRequests: totalRejected,
      metrics
    }
  }

  private calculateOverallHealth(
    dbHealthy: boolean,
    endpointHealth: EndpointHealthAssessment,
    circuitBreakerHealth: CircuitBreakerHealthAssessment,
    rateLimiterHealth: RateLimiterHealthAssessment
  ): { score: number; issues: string[]; recommendations: string[] } {
    const issues: string[] = []
    const recommendations: string[] = []
    
    let score = 0
    const weights = { db: 0.3, endpoints: 0.4, circuitBreakers: 0.2, rateLimiters: 0.1 }
    
    // Database health
    if (dbHealthy) {
      score += weights.db
    } else {
      issues.push('Database connection failed')
      recommendations.push('Check database connectivity and configuration')
    }
    
    // Endpoint health
    const endpointScore = endpointHealth.totalEndpoints > 0 
      ? endpointHealth.healthyEndpoints / endpointHealth.totalEndpoints 
      : 1
    score += weights.endpoints * endpointScore
    
    if (endpointHealth.status === 'unhealthy') {
      issues.push(`${endpointHealth.unhealthyEndpoints} endpoints are unhealthy`)
      recommendations.push('Review failing endpoints and consider re-analysis')
    } else if (endpointHealth.status === 'degraded') {
      issues.push(`${endpointHealth.degradedEndpoints} endpoints are degraded`)
      recommendations.push('Monitor degraded endpoints for potential failures')
    }
    
    // Circuit breaker health
    const breakerScore = circuitBreakerHealth.totalBreakers > 0
      ? Math.max(0, 1 - circuitBreakerHealth.openBreakers / circuitBreakerHealth.totalBreakers)
      : 1
    score += weights.circuitBreakers * breakerScore
    
    if (circuitBreakerHealth.openBreakers > 0) {
      issues.push(`${circuitBreakerHealth.openBreakers} circuit breakers are open`)
      recommendations.push('Investigate failing services and consider manual circuit breaker reset')
    }
    
    // Rate limiter health
    const limiterScore = rateLimiterHealth.totalLimiters > 0
      ? Math.max(0, 1 - (rateLimiterHealth.rejectedRequests / 1000)) // Normalize rejection count
      : 1
    score += weights.rateLimiters * limiterScore
    
    if (rateLimiterHealth.rejectedRequests > 100) {
      issues.push('High rate limiting rejection rate')
      recommendations.push('Consider adjusting rate limiting configuration or scaling')
    }
    
    return { score, issues, recommendations }
  }

  private getHealthStatus(score: number): 'healthy' | 'degraded' | 'unhealthy' {
    if (score >= 0.8) return 'healthy'
    if (score >= 0.5) return 'degraded'
    return 'unhealthy'
  }

  getLastHealthCheck(): HealthCheckResult | null {
    return this.lastHealthCheck
  }

  startPeriodicHealthChecks(
    getEndpoints: () => Promise<StoredEndpoint[]>,
    getCircuitBreakerMetrics: () => Record<string, CircuitBreakerMetrics>,
    getRateLimiterMetrics: () => Record<string, RateLimiterMetrics>,
    testDatabaseConnection: () => Promise<{ success: boolean; responseTime: number; error?: string }>
  ): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval)
    }

    this.checkInterval = setInterval(async () => {
      try {
        await this.performHealthCheck(
          getEndpoints,
          getCircuitBreakerMetrics,
          getRateLimiterMetrics,
          testDatabaseConnection
        )
      } catch (error) {
        logger.error('Periodic health check failed', error)
      }
    }, this.config.checkInterval)

    logger.info('Started periodic health checks', { interval: this.config.checkInterval })
  }

  stopPeriodicHealthChecks(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval)
      this.checkInterval = null
      logger.info('Stopped periodic health checks')
    }
  }
}