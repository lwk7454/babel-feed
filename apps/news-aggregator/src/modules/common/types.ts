// Error classes
export class AggregatorError extends Error {
  constructor(message: string, public code?: string, public statusCode?: number) {
    super(message)
    this.name = 'AggregatorError'
  }
}

export class ValidationError extends AggregatorError {
  constructor(message: string, public field?: string) {
    super(message, 'VALIDATION_ERROR', 400)
    this.name = 'ValidationError'
  }
}

// Common interfaces used across modules
export interface ModuleStatus {
  running: boolean;
  initialized: boolean;
  lastActivity?: Date;
  errors?: Error[];
}

export interface SystemHealth {
  overall: 'healthy' | 'degraded' | 'unhealthy';
  modules: Record<string, ModuleStatus>;
  timestamp: Date;
}

// Legacy types for backward compatibility
export interface NewsSource {
  id?: string;
  name: string;
  slug: string;
  url: string;
  sourceType: 'rss' | 'json' | 'html' | 'api' | 'scraper';
  language: string;
  category: string;
  tags: string[];
  enabled: boolean;
  pollingInterval: number;
  reliability: number;
  priority: number;
  successCount: number;
  errorCount: number;
  lastFetched?: Date;
  lastSuccess?: Date;
  lastError?: string;
  metadata: Record<string, unknown>;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface RawArticle {
  url: string;
  title: string;
  description?: string;
  publishedAt: Date;
  author?: string;
  imageUrl?: string;
  source: string;
  sourceLanguage: string;
  tags?: string[];
  metadata?: Record<string, unknown>;
}

export interface CacheEntry<T = unknown> {
  key: string;
  value: T;
  createdAt: Date;
  expiresAt?: Date;
  hitCount?: number;
  lastAccessed?: Date;
  metadata?: Record<string, unknown>;
}

export interface CircuitBreakerState {
  name: string;
  state: 'closed' | 'open' | 'half-open';
  failureCount: number;
  successCount: number;
  lastFailureTime?: Date;
  nextAttemptTime?: Date;
  threshold: number;
  timeout: number;
}

export type CircuitState = 'closed' | 'open' | 'half-open';

// API response types
export interface ProcessingResult {
  processed: number;
  skipped: number;
  articles: RawArticle[];
  errors: number;
  processingTime: number;
}

// Service configuration types
export interface ServiceConfig {
  environment: string;
  logLevel: string;
  database: {
    url: string;
    maxConnections: number;
  };
  aggregator: {
    defaultPollingInterval: number;
    maxConcurrentSources: number;
    contentCacheMaxAge?: number;
    translationCacheMaxAge?: number;
  };
}

export interface ProviderConfig {
  id: string;
  name: string;
  displayName: string;
  providerType: string;
  baseUrl: string;
  enabled: boolean;
  priority: number;
  maxRequestsPerMinute: number;
  maxRequestsPerHour: number;
  maxRequestsPerDay: number;
  circuitBreakerThreshold: number;
  circuitBreakerTimeout: number;
}

// Health monitoring types
export interface ProviderHealth {
  healthy: boolean;
  circuitState: string;
  availableKeys: number;
  totalKeys: number;
  errorRate: number;
  lastCheck: Date;
}

// AI Provider types
export interface AiProvider {
  id: string;
  name: string;
  displayName: string;
  providerType: string;
  baseUrl: string;
  enabled: boolean;
  priority: number;
  maxRequestsPerMinute: number;
  maxRequestsPerHour: number;
  maxRequestsPerDay: number;
  circuitBreakerThreshold: number;
  circuitBreakerTimeout: number;
  healthCheckInterval?: number;
  metadata?: {
    models?: string[];
    [key: string]: unknown;
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface AiProviderKey {
  id: string;
  providerId: string;
  keyName: string;
  keyValue: string;
  apiKey?: string;
  enabled: boolean;
  successCount: number;
  errorCount: number;
  currentUsage?: number;
  dailyQuota?: number;
  rateLimitHits?: number;
  lastUsed?: Date;
  rateLimitRemaining?: number;
  rateLimitReset?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProviderHealthStatus {
  healthy: boolean;
  circuitState: 'closed' | 'open' | 'half-open';
  availableKeys: number;
  totalKeys: number;
  errorRate: number;
  lastCheck: Date;
  lastError?: string;
}

// Circuit breaker types
export interface CircuitBreakerOptions {
  threshold: number;
  timeout: number;
  resetTimeout: number;
  failureThreshold?: number;
  monitoringWindow?: number;
}

// RSS/XML parsing types
export interface RSSItem {
  title?: string;
  link?: string;
  description?: string;
  pubDate?: string;
  isoDate?: string;
  content?: string;
  contentEncoded?: string;
  author?: string;
  'dc:creator'?: string;
  creator?: string;
  guid?: string;
  categories?: string[];
  enclosure?: {
    url: string;
    type: string;
    length?: number;
  };
  mediaContent?: {
    url: string;
    type?: string;
    medium?: string;
  };
  mediaThumbnail?: {
    url: string;
    width?: number;
    height?: number;
  };
  summary?: string;
  [key: string]: unknown;
}

// Health status response type
export interface HealthStatusResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: Date;
  uptime: number;
  services: Array<{
    name: string;
    status: 'healthy' | 'degraded' | 'unhealthy';
    lastCheck?: Date;
    error?: string;
  }>;
  summary: {
    totalSources: number;
    healthySources: number;
    unhealthySources: number;
  };
}

// Source discovery types
export interface DiscoveredSource {
  url: string;
  name: string;
  sourceType: 'rss' | 'json' | 'html' | 'api' | 'scraper';
  language?: string;
  category?: string;
  quality?: number;
  metadata?: Record<string, unknown>;
}
