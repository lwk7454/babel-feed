// Phase 1 interfaces for RSS/Atom discovery
export interface RssDiscoveryResult {
  type: 'rss' | 'atom'
  url: string
  title?: string
  description?: string
}

export interface FeedValidationResult {
  valid: boolean
  feedType: 'rss' | 'atom' | 'unknown'
  articleCount?: number
  sampleUrls?: string[]
  error?: string
}

export interface NewsSourceAnalysis {
  sourceUrl: string
  rssFeeds: RssDiscoveryResult[]
  atomFeeds: RssDiscoveryResult[]
  validationResults: Map<string, FeedValidationResult>
  totalEndpoints: number
  successRate: number
}

// Phase 2 interfaces for endpoint validation and database operations
export interface EndpointValidationOptions {
  maxRetries?: number
  baseDelay?: number
  maxDelay?: number
  timeout?: number
  validateUrls?: boolean
}

export interface EndpointValidationResult {
  endpointUrl: string
  type: 'rss' | 'atom'
  valid: boolean
  articleCount?: number
  sampleUrls?: string[]
  reliability: number
  responseTime?: number
  error?: string
  retryCount?: number
  category?: string
  title?: string
}

export interface EndpointMetrics {
  successCount: number
  errorCount: number
  lastFetchAt?: Date
  lastSuccessAt?: Date
  reliability: number
  avgResponseTime?: number
}

export interface CircuitBreakerConfig {
  failureThreshold?: number
  resetTimeout?: number
  timeout?: number
  monitoringPeriod?: number
}

export interface RateLimitConfig {
  enabled?: boolean
  requestsPerSecond?: number
  burstSize?: number
  backoffMultiplier?: number
  maxBackoffDelay?: number
}

export interface HealthCheckConfig {
  endpointHealthThreshold?: number
  reliabilityThreshold?: number
  circuitBreakerThreshold?: number
  rateLimitRejectionThreshold?: number
  checkInterval?: number
}

export interface ReanalysisConfig {
  failureThreshold?: number
  maxConsecutiveFailures?: number
  cooldownPeriod?: number
  maxReanalysisAttempts?: number
  stalenessThreshold?: number
  batchSize?: number
  scheduleInterval?: number
}

export interface NewsSourcerConfig {
  database?: {
    connectionString?: string
    maxConnections?: number
  }
  validation?: EndpointValidationOptions
  userAgent?: string
  parallelRequests?: number
  circuitBreaker?: CircuitBreakerConfig
  rateLimit?: RateLimitConfig
  health?: HealthCheckConfig
  reanalysis?: ReanalysisConfig
}

export interface StoredEndpoint {
  id: string
  sourceId: string
  endpointUrl: string
  type: 'rss' | 'atom' | 'html'
  category?: string
  linkSelector?: string
  pollingInterval: number
  reliability: number
  priority: number
  metadata: Record<string, unknown>
  successCount: number
  errorCount: number
  consecutiveFailureCount: number // Track actual consecutive failures
  lastFetchAt?: Date
  lastSuccessAt?: Date
  createdAt: Date
  updatedAt: Date
}

export interface EndpointCreateRequest {
  sourceId: string
  endpointUrl: string
  type: 'rss' | 'atom' | 'html'
  category?: string
  linkSelector?: string
  pollingInterval?: number
  reliability?: number
  priority?: number
  metadata?: Record<string, unknown>
}

export interface EndpointUpdateRequest {
  id: string
  reliability?: number
  successCount?: number
  errorCount?: number
  lastFetchAt?: Date
  lastSuccessAt?: Date
  metadata?: Record<string, unknown>
}

export interface EndpointQuery {
  sourceId?: string
  type?: 'rss' | 'atom' | 'html'
  minReliability?: number
  enabled?: boolean
  limit?: number
  offset?: number
}

export interface BulkEndpointOperation {
  endpoints: EndpointCreateRequest[]
  sourceId: string
  replaceExisting?: boolean
}

// Phase 3 interfaces for LLM-based HTML analysis
export interface DiscoveredEndpoint {
  url: string
  type: 'rss' | 'atom' | 'html'
  category: string
  priority: number // 1-10, higher = more important
  
  crawlingScript: {
    articleSelector: string
    titleSelector?: string
    timestampSelector?: string
    excerptSelector?: string
    imageSelector?: string
    
    paginationSelector?: string
    maxPages?: number
    
    excludeSelectors?: string[]
    includePatterns?: string[]
    excludePatterns?: string[]
    
    delayBetweenRequests?: number
    maxConcurrentRequests?: number
  }
  
  reliability: {
    confidence: number
    testResults: {
      sampleSize: number
      successRate: number
      avgArticlesPerPage: number
    }
  }
  
  metadata: {
    discoveredAt: Date
    lastValidated: Date
    llmModel: string
    version: string
    notes?: string
  }
}

export interface SourceAnalysisResult {
  sourceUrl: string
  endpoints: DiscoveredEndpoint[]
  globalConfig: {
    userAgent: string
    requestHeaders?: Record<string, string>
    respectRobotsTxt: boolean
    baseDelay: number
  }
  analysisMetadata: {
    iterations: number
    totalAnalysisTime: number
    finalConfidence: number
  }
}

export interface HtmlCrawlingConfig {
  maxIterations: number
  minConfidence: number
  minSuccessRate: number
  minSampleUrls: number
  timeout: number
}

export interface LlmAnalysisResult {
  endpoints: DiscoveredEndpoint[]
  confidence: number
  reasoning: string
  suggestedImprovements?: string[]
}

export interface ValidationResult {
  valid: boolean
  urlCount: number
  successRate: number
  sampleUrls: string[]
  errors: string[]
}
