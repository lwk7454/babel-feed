/**
 * API server for news-sourcer integration with aggregator
 */

import { logger } from '@babel-feed/utils'
import { cors } from '@elysiajs/cors'
import { swagger } from '@elysiajs/swagger'
import { Elysia, t } from 'elysia'
import type { NewsSourcer } from './news-sourcer.js'
import type { EndpointCreateRequest, EndpointQuery, EndpointUpdateRequest } from './types.js'

export interface ApiServerConfig {
  port: number
  host: string
  cors: {
    origin: string | string[]
    credentials: boolean
  }
  swagger: {
    enabled: boolean
    documentation: {
      info: {
        title: string
        version: string
        description: string
      }
    }
  }
  auth: {
    enabled: boolean
    apiKey?: string
  }
}

export class NewsSourcerApiServer {
  private app: Elysia
  private config: ApiServerConfig
  private newsSourcer: NewsSourcer

  constructor(newsSourcer: NewsSourcer, config: Partial<ApiServerConfig> = {}) {
    this.newsSourcer = newsSourcer
    this.config = {
      port: 3001,
      host: '0.0.0.0',
      cors: {
        origin: '*',
        credentials: true
      },
      swagger: {
        enabled: true,
        documentation: {
          info: {
            title: 'News Sourcer API',
            version: '1.0.0',
            description: 'API for managing news source endpoints and analysis'
          }
        }
      },
      auth: {
        enabled: false
      },
      ...config
    }

    this.app = new Elysia()
    this.setupMiddleware()
    this.setupRoutes()
  }

  private setupMiddleware(): void {
    // CORS
    this.app.use(cors(this.config.cors))

    // Swagger documentation
    if (this.config.swagger.enabled) {
      this.app.use(swagger(this.config.swagger))
    }

    // Authentication middleware
    if (this.config.auth.enabled && this.config.auth.apiKey) {
      this.app.derive({ as: 'scoped' }, ({ headers }) => {
        const apiKey = headers['x-api-key'] || headers['authorization']?.replace('Bearer ', '')
        
        if (!apiKey || apiKey !== this.config.auth.apiKey) {
          throw new Error('Unauthorized')
        }
        
        return { authenticated: true }
      })
    }

    // Request logging
    this.app.onRequest(({ request }) => {
      logger.info(`API request: ${request.method} ${request.url}`)
    })

    // Error handling
    this.app.onError(({ error, code }) => {
      const errorMessage = error instanceof Error ? error.message : String(error)
      logger.error('API error', { error: errorMessage, code })
      
      if (code === 'VALIDATION') {
        return { error: 'Invalid request parameters', details: errorMessage }
      }
      
      if (errorMessage === 'Unauthorized') {
        return { error: 'Unauthorized' }
      }
      
      return { error: 'Internal server error' }
    })
  }

  private setupRoutes(): void {
    // Health check
    this.app.get('/health', () => {
      return { status: 'healthy', timestamp: new Date().toISOString() }
    })

    // System health check
    this.app.get('/health/detailed', async () => {
      const health = await this.newsSourcer.performHealthCheck()
      return health
    })

    // Get all endpoints
    this.app.get('/endpoints', async ({ query }) => {
      const queryParams: EndpointQuery = {}
      
      if (query.sourceId) queryParams.sourceId = query.sourceId
      if (query.type) queryParams.type = query.type as 'rss' | 'atom' | 'html'
      if (query.minReliability) queryParams.minReliability = parseFloat(query.minReliability)
      if (query.limit) queryParams.limit = parseInt(query.limit)
      if (query.offset) queryParams.offset = parseInt(query.offset)

      const endpoints = await this.newsSourcer.queryEndpoints(queryParams)
      return {
        endpoints,
        count: endpoints.length,
        query: queryParams
      }
    }, {
      query: t.Optional(t.Object({
        sourceId: t.Optional(t.String()),
        type: t.Optional(t.String()),
        minReliability: t.Optional(t.String()),
        limit: t.Optional(t.String()),
        offset: t.Optional(t.String())
      }))
    })

    // Get specific endpoint
    this.app.get('/endpoints/:id', async ({ params }) => {
      const endpoint = await this.newsSourcer.getEndpoint(params.id)
      
      if (!endpoint) {
        throw new Error('Endpoint not found')
      }
      
      return endpoint
    }, {
      params: t.Object({
        id: t.String()
      })
    })

    // Analyze a new source
    this.app.post('/sources/analyze', async ({ body }) => {
      const analysis = await this.newsSourcer.analyzeSource(body.url)
      return analysis
    }, {
      body: t.Object({
        url: t.String({ format: 'uri' })
      })
    })

    // Analyze HTML source
    this.app.post('/sources/analyze-html', async ({ body }) => {
      const analysis = await this.newsSourcer.analyzeHtmlSource(body.url)
      return analysis
    }, {
      body: t.Object({
        url: t.String({ format: 'uri' })
      })
    })

    // Create new endpoint
    this.app.post('/endpoints', async ({ body }) => {
      const endpoint = await this.newsSourcer.createEndpoint(body)
      return endpoint
    }, {
      body: t.Object({
        sourceId: t.String(),
        endpointUrl: t.String({ format: 'uri' }),
        type: t.Union([t.Literal('rss'), t.Literal('atom'), t.Literal('html')]),
        category: t.Optional(t.String()),
        linkSelector: t.Optional(t.String()),
        pollingInterval: t.Optional(t.Number()),
        reliability: t.Optional(t.Number()),
        priority: t.Optional(t.Number()),
        metadata: t.Optional(t.Record(t.String(), t.Any()))
      })
    })

    // Update endpoint
    this.app.put('/endpoints/:id', async ({ params, body }) => {
      const updateData: EndpointUpdateRequest = {
        id: params.id,
        reliability: body.reliability,
        successCount: body.successCount,
        errorCount: body.errorCount,
        lastFetchAt: body.lastFetchAt ? new Date(body.lastFetchAt) : undefined,
        lastSuccessAt: body.lastSuccessAt ? new Date(body.lastSuccessAt) : undefined,
        metadata: body.metadata
      }
      
      const endpoint = await this.newsSourcer.updateEndpoint(updateData)
      
      if (!endpoint) {
        throw new Error('Endpoint not found')
      }
      
      return endpoint
    }, {
      params: t.Object({
        id: t.String()
      }),
      body: t.Object({
        reliability: t.Optional(t.Number()),
        successCount: t.Optional(t.Number()),
        errorCount: t.Optional(t.Number()),
        lastFetchAt: t.Optional(t.String()),
        lastSuccessAt: t.Optional(t.String()),
        metadata: t.Optional(t.Record(t.String(), t.Any()))
      })
    })

    // Delete endpoint
    this.app.delete('/endpoints/:id', async ({ params }) => {
      const deleted = await this.newsSourcer.deleteEndpoint(params.id)
      
      if (!deleted) {
        throw new Error('Endpoint not found')
      }
      
      return { success: true }
    }, {
      params: t.Object({
        id: t.String()
      })
    })

    // Bulk create endpoints
    this.app.post('/endpoints/bulk', async ({ body }) => {
      const bulkOperation = {
        sourceId: body.sourceId,
        replaceExisting: body.replaceExisting,
        endpoints: body.endpoints.map((ep: Record<string, unknown>) => ({
          ...ep,
          sourceId: body.sourceId
        })) as EndpointCreateRequest[]
      }
      
      const endpoints = await this.newsSourcer.bulkCreateEndpoints(bulkOperation)
      return {
        endpoints,
        count: endpoints.length
      }
    }, {
      body: t.Object({
        sourceId: t.String(),
        replaceExisting: t.Optional(t.Boolean()),
        endpoints: t.Array(t.Object({
          endpointUrl: t.String({ format: 'uri' }),
          type: t.Union([t.Literal('rss'), t.Literal('atom'), t.Literal('html')]),
          category: t.Optional(t.String()),
          linkSelector: t.Optional(t.String()),
          pollingInterval: t.Optional(t.Number()),
          reliability: t.Optional(t.Number()),
          priority: t.Optional(t.Number()),
          metadata: t.Optional(t.Record(t.String(), t.Any()))
        }))
      })
    })

    // Get metrics
    this.app.get('/metrics', () => {
      return this.newsSourcer.getMetrics()
    })

    // Get performance metrics
    this.app.get('/metrics/performance', ({ query }) => {
      if (query.window) {
        const windowMs = parseInt(query.window)
        return this.newsSourcer.getPerformanceMetricsForWindow(windowMs)
      }
      return this.newsSourcer.getPerformanceMetrics()
    }, {
      query: t.Optional(t.Object({
        window: t.Optional(t.String())
      }))
    })

    // Get Prometheus metrics
    this.app.get('/metrics/prometheus', () => {
      return this.newsSourcer.exportPrometheusMetrics()
    })

    // Trigger re-analysis
    this.app.post('/endpoints/:id/reanalyze', async ({ params }) => {
      const result = await this.newsSourcer.triggerReanalysis(params.id)
      return result
    }, {
      params: t.Object({
        id: t.String()
      })
    })

    // Get re-analysis stats
    this.app.get('/reanalysis/stats', () => {
      return this.newsSourcer.getReanalysisStats()
    })

    // Validate endpoint
    this.app.post('/endpoints/validate', async ({ body }) => {
      const result = await this.newsSourcer.validateEndpoint(body.url, body.options)
      return result
    }, {
      body: t.Object({
        url: t.String({ format: 'uri' }),
        options: t.Optional(t.Object({
          maxRetries: t.Optional(t.Number()),
          baseDelay: t.Optional(t.Number()),
          maxDelay: t.Optional(t.Number()),
          timeout: t.Optional(t.Number()),
          validateUrls: t.Optional(t.Boolean())
        }))
      })
    })

    // Reset metrics
    this.app.post('/metrics/reset', () => {
      this.newsSourcer.resetMetrics()
      return { success: true }
    })

    // Reset protection (circuit breakers and rate limiters)
    this.app.post('/protection/reset', () => {
      this.newsSourcer.resetProtection()
      return { success: true }
    })

    // Clear re-analysis history
    this.app.post('/reanalysis/clear', () => {
      this.newsSourcer.clearReanalysisHistory()
      return { success: true }
    })
  }

  async start(): Promise<void> {
    try {
      await this.newsSourcer.initialize()
      
      this.app.listen({
        port: this.config.port,
        hostname: this.config.host
      })
      
      logger.info(`News Sourcer API server started`, {
        port: this.config.port,
        host: this.config.host,
        swagger: this.config.swagger.enabled ? `http://${this.config.host}:${this.config.port}/swagger` : 'disabled'
      })
    } catch (error) {
      logger.error('Failed to start API server', error)
      throw error
    }
  }

  async stop(): Promise<void> {
    try {
      await this.app.stop()
      logger.info('News Sourcer API server stopped')
    } catch (error) {
      logger.error('Failed to stop API server', error)
      throw error
    }
  }
}