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

// OpenAI API Compatible Types
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string | null
  name?: string
  tool_calls?: ToolCall[]
  tool_call_id?: string
}

export interface ToolCall {
  id: string
  type: 'function'
  function: {
    name: string
    arguments: string
  }
}

export interface FunctionDefinition {
  name: string
  description?: string
  parameters?: Record<string, unknown>
}

export interface ChatCompletionRequest {
  model: string
  messages: ChatMessage[]
  max_tokens?: number
  temperature?: number
  top_p?: number
  n?: number
  stream?: boolean
  stop?: string | string[]
  presence_penalty?: number
  frequency_penalty?: number
  logit_bias?: Record<string, number>
  user?: string
  response_format?: { type: 'text' | 'json_object' }
  seed?: number
  tools?: { type: 'function'; function: FunctionDefinition }[]
  tool_choice?: 'none' | 'auto' | { type: 'function'; function: { name: string } }
}

export interface ChatCompletionChoice {
  index: number
  message: ChatMessage
  logprobs?: {
    content?: Array<{
      token: string
      logprob: number
      bytes: number[]
      top_logprobs: Array<{
        token: string
        logprob: number
        bytes: number[]
      }>
    }>
  }
  finish_reason: 'stop' | 'length' | 'tool_calls' | 'content_filter' | null
}

export interface ChatCompletionResponse {
  id: string
  object: 'chat.completion'
  created: number
  model: string
  choices: ChatCompletionChoice[]
  usage?: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
  }
  system_fingerprint?: string
}

export interface ChatCompletionStreamChoice {
  index: number
  delta: {
    role?: 'assistant'
    content?: string
    tool_calls?: Partial<ToolCall>[]
  }
  logprobs?: {
    content?: Array<{
      token: string
      logprob: number
      bytes: number[]
      top_logprobs: Array<{
        token: string
        logprob: number
        bytes: number[]
      }>
    }>
  }
  finish_reason: 'stop' | 'length' | 'tool_calls' | 'content_filter' | null
}

export interface ChatCompletionStreamResponse {
  id: string
  object: 'chat.completion.chunk'
  created: number
  model: string
  choices: ChatCompletionStreamChoice[]
  system_fingerprint?: string
}

// Provider-specific types
export interface ProviderAdapter {
  createChatCompletion(request: ChatCompletionRequest): Promise<ChatCompletionResponse>
  streamChatCompletion(request: ChatCompletionRequest): AsyncGenerator<ChatCompletionStreamResponse>
  validateRequest(request: ChatCompletionRequest): void
  transformRequest?(request: ChatCompletionRequest): ChatCompletionRequest
  transformResponse?(response: any): ChatCompletionResponse
}

export interface ProviderConfig {
  name: string
  baseUrl: string
  authHeader?: string
  supportedModels: string[]
  maxTokens?: number
  rateLimits: {
    requestsPerMinute: number
    requestsPerHour: number
    requestsPerDay: number
  }
  features: {
    streaming: boolean
    tools: boolean
    jsonMode: boolean
    logprobs: boolean
  }
}

export interface RequestContext {
  provider: AiProvider
  key: AiProviderKey
  requestId: string
  startTime: number
  retryCount: number
}

export interface LlmError extends Error {
  code: string
  statusCode?: number
  retryable: boolean
  rateLimited?: boolean
  quotaExceeded?: boolean
  provider?: string
  requestId?: string
}
