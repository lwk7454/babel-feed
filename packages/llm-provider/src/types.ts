export class LlmProviderError extends Error {
  constructor(message: string, public code?: string, public statusCode?: number) {
    super(message)
    this.name = 'LlmProviderError'
  }
}

export interface CircuitBreakerState {
  name: string
  state: 'closed' | 'open' | 'half-open'
  failureCount: number
  successCount: number
  lastFailureTime?: Date
  nextAttemptTime?: Date
  threshold: number
  timeout: number
}

export type CircuitState = 'closed' | 'open' | 'half-open'

export interface CircuitBreakerOptions {
  threshold: number
  timeout: number
  resetTimeout: number
  failureThreshold?: number
  monitoringWindow?: number
}

export interface AiProvider {
  id: string
  name: string
  displayName: string
  providerType: string
  baseUrl: string
  enabled: boolean
  priority: number
  maxRequestsPerMinute: number
  maxRequestsPerHour: number
  maxRequestsPerDay: number
  circuitBreakerThreshold: number
  circuitBreakerTimeout: number
  healthCheckInterval?: number
  metadata?: { models?: string[]; [key: string]: unknown }
  createdAt: Date
  updatedAt: Date
}

export interface AiProviderKey {
  id: string
  providerId: string
  keyName: string
  keyValue: string
  apiKey?: string
  enabled: boolean
  successCount: number
  errorCount: number
  currentUsage?: number
  dailyQuota?: number
  rateLimitHits?: number
  lastUsed?: Date
  rateLimitRemaining?: number
  rateLimitReset?: Date
  createdAt: Date
  updatedAt: Date
}

export interface ProviderHealthStatus {
  healthy: boolean
  circuitState: 'closed' | 'open' | 'half-open'
  availableKeys: number
  totalKeys: number
  errorRate: number
  lastCheck: Date
  lastError?: string
}
