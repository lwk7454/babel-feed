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

export interface NewsSourcerConfig {
  database?: {
    connectionString?: string
    maxConnections?: number
  }
  validation?: EndpointValidationOptions
  userAgent?: string
  parallelRequests?: number
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
