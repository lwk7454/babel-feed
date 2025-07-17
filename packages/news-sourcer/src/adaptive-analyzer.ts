/**
 * Adaptive re-analysis system for HTML endpoints
 */

import { logger } from '@babel-feed/utils'
import type { StoredEndpoint, SourceAnalysisResult, DiscoveredEndpoint } from './types.js'

export interface ReanalysisConfig {
  failureThreshold: number
  maxConsecutiveFailures: number
  cooldownPeriod: number
  maxReanalysisAttempts: number
  stalenessThreshold: number
  batchSize: number
  scheduleInterval: number
}

export interface ReanalysisResult {
  endpointId: string
  success: boolean
  newEndpoints: StoredEndpoint[]
  previousVersion: string
  newVersion: string
  analysisTime: number
  error?: string
}

export interface EndpointVersion {
  version: string
  createdAt: Date
  configuration: Record<string, unknown>
  metadata: Record<string, unknown>
  performance: {
    successRate: number
    avgResponseTime: number
    lastTestedAt: Date
  }
}

export interface TransformedEndpoint {
  endpointUrl: string
  type: 'rss' | 'atom' | 'html'
  category: string
  linkSelector: string
  reliability: number
  priority: number
  metadata: {
    crawlingScript: DiscoveredEndpoint['crawlingScript']
    llmMetadata: DiscoveredEndpoint['metadata']
    reanalysisFrom: string
    reanalysisTime: Date
  }
}

export class AdaptiveAnalyzer {
  private config: ReanalysisConfig
  private reanalysisQueue: Set<string> = new Set()
  private reanalysisHistory: Map<string, ReanalysisResult[]> = new Map()
  private scheduledReanalysis: NodeJS.Timeout | null = null
  private versions: Map<string, EndpointVersion[]> = new Map()

  constructor(config: Partial<ReanalysisConfig> = {}) {
    this.config = {
      failureThreshold: 0.3, // Re-analyze if success rate drops below 30%
      maxConsecutiveFailures: 5,
      cooldownPeriod: 3600000, // 1 hour
      maxReanalysisAttempts: 3,
      stalenessThreshold: 2592000000, // 30 days
      batchSize: 5,
      scheduleInterval: 1800000, // 30 minutes
      ...config
    }
  }

  /**
   * Check if an endpoint needs re-analysis
   */
  shouldReanalyze(endpoint: StoredEndpoint): boolean {
    const now = Date.now()
    
    // Check failure threshold
    const totalAttempts = endpoint.successCount + endpoint.errorCount
    if (totalAttempts > 0) {
      const successRate = endpoint.successCount / totalAttempts
      if (successRate < this.config.failureThreshold) {
        logger.debug(`Endpoint ${endpoint.id} below failure threshold`, {
          successRate,
          threshold: this.config.failureThreshold
        })
        return true
      }
    }

    // Check consecutive failures
    if (endpoint.consecutiveFailureCount >= this.config.maxConsecutiveFailures) {
      logger.debug(`Endpoint ${endpoint.id} exceeded consecutive failures`, {
        consecutiveFailureCount: endpoint.consecutiveFailureCount,
        maxConsecutiveFailures: this.config.maxConsecutiveFailures
      })
      return true
    }

    // Check staleness
    const lastUpdate = endpoint.updatedAt.getTime()
    if (now - lastUpdate > this.config.stalenessThreshold) {
      logger.debug(`Endpoint ${endpoint.id} is stale`, {
        lastUpdate: endpoint.updatedAt,
        stalenessThreshold: this.config.stalenessThreshold
      })
      return true
    }

    // Check if in cooldown period
    const history = this.reanalysisHistory.get(endpoint.id) || []
    if (history.length > 0) {
      const lastReanalysis = history[history.length - 1]
      const timeSinceLastReanalysis = now - lastReanalysis.analysisTime
      if (timeSinceLastReanalysis < this.config.cooldownPeriod) {
        logger.debug(`Endpoint ${endpoint.id} in cooldown period`, {
          timeSinceLastReanalysis,
          cooldownPeriod: this.config.cooldownPeriod
        })
        return false
      }
    }

    // Check maximum re-analysis attempts
    const recentAttempts = history.filter(h => 
      now - h.analysisTime < this.config.cooldownPeriod * 24 // 24 cooldown periods
    ).length
    
    if (recentAttempts >= this.config.maxReanalysisAttempts) {
      logger.debug(`Endpoint ${endpoint.id} exceeded max reanalysis attempts`, {
        recentAttempts,
        maxReanalysisAttempts: this.config.maxReanalysisAttempts
      })
      return false
    }

    // If none of the conditions are met, endpoint doesn't need reanalysis
    return false
  }

  /**
   * Queue an endpoint for re-analysis
   */
  queueForReanalysis(endpointId: string): void {
    if (!this.reanalysisQueue.has(endpointId)) {
      this.reanalysisQueue.add(endpointId)
      logger.info(`Queued endpoint ${endpointId} for re-analysis`)
    }
  }

  /**
   * Process the re-analysis queue
   */
  async processReanalysisQueue(
    getEndpoint: (id: string) => Promise<StoredEndpoint | null>,
    analyzeHtmlSource: (url: string) => Promise<SourceAnalysisResult>,
    updateEndpoint: (id: string, updates: Partial<StoredEndpoint>) => Promise<void>,
    createEndpoints: (sourceId: string, endpoints: TransformedEndpoint[]) => Promise<StoredEndpoint[]>
  ): Promise<ReanalysisResult[]> {
    const results: ReanalysisResult[] = []
    const batch = Array.from(this.reanalysisQueue).slice(0, this.config.batchSize)
    
    for (const endpointId of batch) {
      this.reanalysisQueue.delete(endpointId)
      
      try {
        const result = await this.reanalyzeEndpoint(
          endpointId,
          getEndpoint,
          analyzeHtmlSource,
          updateEndpoint,
          createEndpoints
        )
        results.push(result)
        
        // Store result in history
        const history = this.reanalysisHistory.get(endpointId) || []
        history.push(result)
        
        // Keep only recent history
        const cutoff = Date.now() - (this.config.cooldownPeriod * 24)
        const recentHistory = history.filter(h => h.analysisTime > cutoff)
        this.reanalysisHistory.set(endpointId, recentHistory)
        
      } catch (error) {
        logger.error(`Re-analysis failed for endpoint ${endpointId}`, error)
        const failedResult = {
          endpointId,
          success: false,
          newEndpoints: [],
          previousVersion: 'unknown',
          newVersion: 'unknown',
          analysisTime: Date.now(),
          error: error instanceof Error ? error.message : 'Unknown error'
        }
        results.push(failedResult)
        
        // Store failed result in history
        const history = this.reanalysisHistory.get(endpointId) || []
        history.push(failedResult)
        
        // Keep only recent history
        const cutoff = Date.now() - (this.config.cooldownPeriod * 24)
        const recentHistory = history.filter(h => h.analysisTime > cutoff)
        this.reanalysisHistory.set(endpointId, recentHistory)
      }
    }
    
    return results
  }

  /**
   * Re-analyze a single endpoint
   */
  private async reanalyzeEndpoint(
    endpointId: string,
    getEndpoint: (id: string) => Promise<StoredEndpoint | null>,
    analyzeHtmlSource: (url: string) => Promise<SourceAnalysisResult>,
    updateEndpoint: (id: string, updates: Partial<StoredEndpoint>) => Promise<void>,
    createEndpoints: (sourceId: string, endpoints: TransformedEndpoint[]) => Promise<StoredEndpoint[]>
  ): Promise<ReanalysisResult> {
    const startTime = Date.now()
    
    logger.info(`Starting re-analysis for endpoint ${endpointId}`)
    
    const endpoint = await getEndpoint(endpointId)
    if (!endpoint) {
      throw new Error(`Endpoint ${endpointId} not found`)
    }

    if (endpoint.type !== 'html') {
      throw new Error(`Endpoint ${endpointId} is not HTML type, skipping re-analysis`)
    }

    // Store current version
    const previousVersion = this.generateVersionId(endpoint)
    this.storeEndpointVersion(endpointId, previousVersion, endpoint)

    // Perform new analysis
    const analysis = await analyzeHtmlSource(endpoint.endpointUrl)
    
    if (analysis.endpoints.length === 0) {
      throw new Error('No valid endpoints found in re-analysis')
    }

    // Create new endpoints from analysis
    const newEndpoints = await createEndpoints(
      endpoint.sourceId,
      analysis.endpoints.map(ep => ({
        endpointUrl: ep.url,
        type: ep.type,
        category: ep.category,
        linkSelector: ep.crawlingScript.articleSelector,
        reliability: ep.reliability.confidence,
        priority: ep.priority,
        metadata: {
          crawlingScript: ep.crawlingScript,
          llmMetadata: ep.metadata,
          reanalysisFrom: endpointId,
          reanalysisTime: new Date()
        }
      }))
    )

    // Update original endpoint to mark as superseded
    await updateEndpoint(endpointId, {
      reliability: 0.1, // Mark as low reliability
      metadata: {
        ...endpoint.metadata,
        supersededBy: newEndpoints.map(e => e.id),
        supersededAt: new Date()
      }
    })

    const newVersion = this.generateVersionId(newEndpoints[0])
    
    logger.info(`Re-analysis completed for endpoint ${endpointId}`, {
      newEndpoints: newEndpoints.length,
      analysisTime: Date.now() - startTime,
      previousVersion,
      newVersion
    })

    return {
      endpointId,
      success: true,
      newEndpoints,
      previousVersion,
      newVersion,
      analysisTime: Date.now()
    }
  }

  /**
   * Start scheduled re-analysis
   */
  startScheduledReanalysis(
    getAllEndpoints: () => Promise<StoredEndpoint[]>,
    getEndpoint: (id: string) => Promise<StoredEndpoint | null>,
    analyzeHtmlSource: (url: string) => Promise<SourceAnalysisResult>,
    updateEndpoint: (id: string, updates: Partial<StoredEndpoint>) => Promise<void>,
    createEndpoints: (sourceId: string, endpoints: TransformedEndpoint[]) => Promise<StoredEndpoint[]>
  ): void {
    if (this.scheduledReanalysis) {
      clearInterval(this.scheduledReanalysis)
    }

    this.scheduledReanalysis = setInterval(async () => {
      try {
        // Check all endpoints for re-analysis needs
        const allEndpoints = await getAllEndpoints()
        const htmlEndpoints = allEndpoints.filter(ep => ep.type === 'html')
        
        let queuedCount = 0
        for (const endpoint of htmlEndpoints) {
          if (this.shouldReanalyze(endpoint)) {
            this.queueForReanalysis(endpoint.id)
            queuedCount++
          }
        }

        if (queuedCount > 0) {
          logger.info(`Queued ${queuedCount} endpoints for scheduled re-analysis`)
        }

        // Process the queue
        if (this.reanalysisQueue.size > 0) {
          const results = await this.processReanalysisQueue(
            getEndpoint,
            analyzeHtmlSource,
            updateEndpoint,
            createEndpoints
          )
          
          const successful = results.filter(r => r.success).length
          const failed = results.filter(r => !r.success).length
          
          logger.info(`Processed ${results.length} re-analysis requests`, {
            successful,
            failed,
            remaining: this.reanalysisQueue.size
          })
        }
        
      } catch (error) {
        logger.error('Scheduled re-analysis failed', error)
      }
    }, this.config.scheduleInterval)

    logger.info('Started scheduled re-analysis', {
      interval: this.config.scheduleInterval,
      batchSize: this.config.batchSize
    })
  }

  /**
   * Stop scheduled re-analysis
   */
  stopScheduledReanalysis(): void {
    if (this.scheduledReanalysis) {
      clearInterval(this.scheduledReanalysis)
      this.scheduledReanalysis = null
      logger.info('Stopped scheduled re-analysis')
    }
  }

  /**
   * Get re-analysis statistics
   */
  getReanalysisStats(): {
    queueSize: number
    totalReanalyses: number
    successfulReanalyses: number
    failedReanalyses: number
    endpointsWithHistory: number
    averageReanalysisTime: number
  } {
    let totalReanalyses = 0
    let successfulReanalyses = 0
    let failedReanalyses = 0
    let totalTime = 0

    for (const history of this.reanalysisHistory.values()) {
      totalReanalyses += history.length
      for (const result of history) {
        if (result.success) {
          successfulReanalyses++
        } else {
          failedReanalyses++
        }
        totalTime += result.analysisTime
      }
    }

    return {
      queueSize: this.reanalysisQueue.size,
      totalReanalyses,
      successfulReanalyses,
      failedReanalyses,
      endpointsWithHistory: this.reanalysisHistory.size,
      averageReanalysisTime: totalReanalyses > 0 ? totalTime / totalReanalyses : 0
    }
  }

  /**
   * Clear re-analysis history
   */
  clearHistory(): void {
    this.reanalysisHistory.clear()
    this.versions.clear()
    logger.info('Cleared re-analysis history')
  }

  private generateVersionId(endpoint: StoredEndpoint): string {
    const config = {
      linkSelector: endpoint.linkSelector,
      metadata: endpoint.metadata,
      reliability: endpoint.reliability
    }
    
    return `v${Date.now()}-${JSON.stringify(config).slice(0, 8)}`
  }

  private storeEndpointVersion(endpointId: string, version: string, endpoint: StoredEndpoint): void {
    const versions = this.versions.get(endpointId) || []
    
    versions.push({
      version,
      createdAt: new Date(),
      configuration: {
        linkSelector: endpoint.linkSelector,
        metadata: endpoint.metadata
      },
      metadata: endpoint.metadata,
      performance: {
        successRate: endpoint.successCount / (endpoint.successCount + endpoint.errorCount),
        avgResponseTime: 0, // Would be calculated from metrics
        lastTestedAt: endpoint.lastFetchAt || new Date()
      }
    })
    
    // Keep only recent versions
    const recentVersions = versions.slice(-10)
    this.versions.set(endpointId, recentVersions)
  }
}