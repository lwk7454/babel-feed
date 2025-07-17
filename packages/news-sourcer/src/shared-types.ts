/**
 * Shared types and interfaces for news-sourcer and news-aggregator integration
 */

// Re-export core types that aggregator needs
export type {
  StoredEndpoint,
  EndpointQuery,
  SourceAnalysisResult,
  DiscoveredEndpoint,
  NewsSourceAnalysis,
  EndpointValidationResult,
  EndpointMetrics,
  HtmlCrawlingConfig,
  LlmAnalysisResult,
  ValidationResult
} from './types.js'

// Re-export health and metrics types
export type {
  HealthCheckResult
} from './health-monitor.js'

export type {
  CollectedMetrics,
  MetricSummary
} from './metrics-collector.js'

export type {
  CircuitBreakerMetrics,
  CircuitState
} from './circuit-breaker.js'

export type {
  RateLimiterMetrics
} from './rate-limiter.js'

export type {
  ReanalysisResult
} from './adaptive-analyzer.js'

// Integration-specific types
export interface AggregatorEndpointRequest {
  sourceId: string
  endpointUrl: string
  type: 'rss' | 'atom' | 'html'
  category?: string
  priority?: number
  pollingInterval?: number
  expectedArticleCount?: number
  tags?: string[]
}

export interface AggregatorEndpointResponse {
  id: string
  sourceId: string
  endpointUrl: string
  type: 'rss' | 'atom' | 'html'
  category?: string
  priority: number
  pollingInterval: number
  reliability: number
  lastFetchAt?: Date
  lastSuccessAt?: Date
  metadata: Record<string, unknown>
  status: 'active' | 'inactive' | 'failed' | 'superseded'
  createdAt: Date
  updatedAt: Date
}

export interface FetchRequest {
  endpointId: string
  priority?: number
  timeout?: number
  retryCount?: number
  metadata?: Record<string, unknown>
}

export interface FetchResponse {
  endpointId: string
  success: boolean
  articles?: ArticleStub[]
  metadata?: Record<string, unknown>
  error?: {
    code: string
    message: string
    retryable: boolean
  }
  timing: {
    requestTime: Date
    responseTime: Date
    duration: number
  }
  pagination?: {
    hasMore: boolean
    nextUrl?: string
    totalCount?: number
  }
}

export interface ArticleStub {
  url: string
  title?: string
  publishedAt?: Date
  author?: string
  excerpt?: string
  imageUrl?: string
  category?: string
  tags?: string[]
  metadata?: Record<string, unknown>
}

export interface FetchBatch {
  batchId: string
  requests: FetchRequest[]
  priority: number
  scheduledAt: Date
  timeout: number
}

export interface FetchBatchResponse {
  batchId: string
  responses: FetchResponse[]
  summary: {
    totalRequests: number
    successfulRequests: number
    failedRequests: number
    totalArticles: number
    averageResponseTime: number
  }
  timing: {
    startTime: Date
    endTime: Date
    totalDuration: number
  }
}

export interface EndpointHealth {
  endpointId: string
  status: 'healthy' | 'degraded' | 'unhealthy'
  reliability: number
  successRate: number
  errorRate: number
  averageResponseTime: number
  lastSuccessAt?: Date
  lastErrorAt?: Date
  consecutiveErrors: number
  issues: string[]
  recommendations: string[]
}

export interface SystemHealth {
  overall: 'healthy' | 'degraded' | 'unhealthy'
  components: {
    database: 'healthy' | 'unhealthy'
    endpoints: 'healthy' | 'degraded' | 'unhealthy'
    circuitBreakers: 'healthy' | 'degraded' | 'unhealthy'
    rateLimiters: 'healthy' | 'degraded' | 'unhealthy'
  }
  metrics: {
    totalEndpoints: number
    activeEndpoints: number
    healthyEndpoints: number
    degradedEndpoints: number
    unhealthyEndpoints: number
    averageReliability: number
  }
  timestamp: Date
}

export interface ErrorReport {
  endpointId: string
  error: {
    code: string
    message: string
    stack?: string
    context?: Record<string, unknown>
  }
  severity: 'low' | 'medium' | 'high' | 'critical'
  timestamp: Date
  retryable: boolean
  metadata?: Record<string, unknown>
}

export interface EndpointUpdateNotification {
  type: 'endpoint_created' | 'endpoint_updated' | 'endpoint_deleted' | 'endpoint_reanalyzed'
  endpointId: string
  sourceId: string
  data: {
    before?: Partial<AggregatorEndpointResponse>
    after?: Partial<AggregatorEndpointResponse>
    changes?: string[]
  }
  timestamp: Date
  metadata?: Record<string, unknown>
}

export interface WebhookPayload {
  event: string
  timestamp: Date
  data: Record<string, unknown>
  metadata?: Record<string, unknown>
}

export interface WebhookConfig {
  url: string
  events: string[]
  secret?: string
  headers?: Record<string, string>
  timeout: number
  retryCount: number
  retryDelay: number
}

export interface WebhookDelivery {
  id: string
  webhookUrl: string
  event: string
  payload: WebhookPayload
  attempts: number
  maxAttempts: number
  status: 'pending' | 'delivered' | 'failed'
  lastAttemptAt?: Date
  nextAttemptAt?: Date
  error?: string
  createdAt: Date
  updatedAt: Date
}

// API request/response types
export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: {
    code: string
    message: string
    details?: unknown
  }
  metadata?: {
    timestamp: Date
    requestId?: string
    version?: string
  }
}

export interface PaginatedResponse<T = unknown> {
  data: T[]
  pagination: {
    page: number
    limit: number
    total: number
    hasMore: boolean
  }
  metadata?: {
    timestamp: Date
    requestId?: string
  }
}

export interface QueryParameters {
  page?: number
  limit?: number
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
  filter?: Record<string, unknown>
  search?: string
}

// Event types for integration
export interface NewsSourcerEvent {
  type: 'endpoint_created' | 'endpoint_updated' | 'endpoint_deleted' | 'endpoint_failed' | 'endpoint_reanalyzed' | 'reanalysis_completed' | 'health_changed'
  timestamp: Date
  data: Record<string, unknown>
  metadata?: Record<string, unknown>
}

export interface EventHandler {
  (event: NewsSourcerEvent): Promise<void> | void
}

export interface EventSubscription {
  id: string
  eventType: string
  handler: EventHandler
  filter?: (event: NewsSourcerEvent) => boolean
  createdAt: Date
}

// Configuration types for integration
export interface IntegrationConfig {
  aggregator: {
    baseUrl: string
    apiKey?: string
    timeout: number
    retryCount: number
    retryDelay: number
  }
  webhooks: {
    enabled: boolean
    baseUrl: string
    secret?: string
    events: string[]
    timeout: number
    retryCount: number
  }
  polling: {
    enabled: boolean
    interval: number
    batchSize: number
    maxConcurrency: number
  }
  health: {
    checkInterval: number
    alertThreshold: number
    recoveryThreshold: number
  }
}

// Import missing types from the main types file
import type { 
  EndpointQuery, 
  NewsSourceAnalysis, 
  SourceAnalysisResult
} from './types.js'
import type { CollectedMetrics } from './metrics-collector.js'
import type { ReanalysisResult } from './adaptive-analyzer.js'

// Client interface for aggregator to use
export interface NewsSourcerClient {
  // Endpoint management
  getEndpoints(query?: EndpointQuery): Promise<AggregatorEndpointResponse[]>
  getEndpoint(id: string): Promise<AggregatorEndpointResponse | null>
  createEndpoint(request: AggregatorEndpointRequest): Promise<AggregatorEndpointResponse>
  updateEndpoint(id: string, updates: Partial<AggregatorEndpointResponse>): Promise<AggregatorEndpointResponse>
  deleteEndpoint(id: string): Promise<boolean>
  
  // Source analysis
  analyzeSource(url: string): Promise<NewsSourceAnalysis>
  analyzeHtmlSource(url: string): Promise<SourceAnalysisResult>
  
  // Health and metrics
  getHealth(): Promise<SystemHealth>
  getMetrics(): Promise<CollectedMetrics>
  
  // Re-analysis
  triggerReanalysis(endpointId: string): Promise<ReanalysisResult>
  getReanalysisStats(): Promise<{
    queueSize: number
    totalReanalyses: number
    successfulReanalyses: number
    failedReanalyses: number
  }>
  
  // Error reporting
  reportError(report: ErrorReport): Promise<void>
  
  // Event subscription
  subscribe(eventType: string, handler: EventHandler): EventSubscription
  unsubscribe(subscriptionId: string): Promise<boolean>
  
  // Lifecycle
  start(): Promise<void>
  stop(): Promise<void>
}

// Constants for integration
export const ENDPOINT_TYPES = ['rss', 'atom', 'html'] as const
export const ENDPOINT_STATUSES = ['active', 'inactive', 'failed', 'superseded'] as const
export const HEALTH_STATUSES = ['healthy', 'degraded', 'unhealthy'] as const
export const ERROR_SEVERITIES = ['low', 'medium', 'high', 'critical'] as const

export const DEFAULT_POLLING_INTERVALS = {
  rss: 1800, // 30 minutes
  atom: 1800, // 30 minutes
  html: 3600 // 1 hour
} as const

export const DEFAULT_PRIORITIES = {
  high: 1,
  medium: 5,
  low: 10
} as const

export const EVENT_TYPES = {
  ENDPOINT_CREATED: 'endpoint_created',
  ENDPOINT_UPDATED: 'endpoint_updated',
  ENDPOINT_DELETED: 'endpoint_deleted',
  ENDPOINT_FAILED: 'endpoint_failed',
  ENDPOINT_REANALYZED: 'endpoint_reanalyzed',
  REANALYSIS_COMPLETED: 'reanalysis_completed',
  HEALTH_CHANGED: 'health_changed'
} as const