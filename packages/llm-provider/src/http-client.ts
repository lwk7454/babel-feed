import { logger } from '@babel-feed/utils'
import type {
  ChatCompletionRequest,
  ChatCompletionResponse,
  ChatCompletionStreamResponse,
  AiProvider,
  AiProviderKey,
  LlmError,
  RequestContext
} from './types.js'

export interface HttpClientOptions {
  timeout?: number
  retryAttempts?: number
  retryDelay?: number
  userAgent?: string
}

export class LlmHttpClient {
  private readonly timeout: number
  private readonly retryAttempts: number
  private readonly retryDelay: number
  private readonly userAgent: string

  constructor(options: HttpClientOptions = {}) {
    this.timeout = options.timeout ?? 30000
    this.retryAttempts = options.retryAttempts ?? 3
    this.retryDelay = options.retryDelay ?? 1000
    this.userAgent = options.userAgent ?? 'BabelFeed LLM Provider/1.0'
  }

  async createChatCompletion(
    request: ChatCompletionRequest,
    provider: AiProvider,
    key: AiProviderKey,
    context: RequestContext
  ): Promise<ChatCompletionResponse> {
    const url = `${provider.baseUrl}/chat/completions`
    const headers = this.buildHeaders(provider, key)
    
    logger.debug(`Making chat completion request to ${provider.name}`, {
      requestId: context.requestId,
      model: request.model,
      messageCount: request.messages.length
    })

    try {
      const response = await this.makeRequest(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          ...request,
          stream: false // Ensure non-streaming for this method
        })
      }, context)

      if (!response.ok) {
        throw await this.handleHttpError(response, provider, context)
      }

      const data = await response.json() as ChatCompletionResponse
      this.validateResponse(data)
      
      logger.debug(`Chat completion successful`, {
        requestId: context.requestId,
        provider: provider.name,
        responseId: data.id,
        usage: data.usage
      })

      return data
    } catch (error) {
      logger.error(`Chat completion failed`, {
        requestId: context.requestId,
        provider: provider.name,
        error: error instanceof Error ? error.message : String(error)
      })
      throw this.wrapError(error, provider, context)
    }
  }

  async *streamChatCompletion(
    request: ChatCompletionRequest,
    provider: AiProvider,
    key: AiProviderKey,
    context: RequestContext
  ): AsyncGenerator<ChatCompletionStreamResponse> {
    const url = `${provider.baseUrl}/chat/completions`
    const headers = this.buildHeaders(provider, key)
    
    logger.debug(`Starting streaming chat completion to ${provider.name}`, {
      requestId: context.requestId,
      model: request.model
    })

    try {
      const response = await this.makeRequest(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          ...request,
          stream: true
        })
      }, context)

      if (!response.ok) {
        throw await this.handleHttpError(response, provider, context)
      }

      if (!response.body) {
        throw new Error('No response body for streaming request')
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() || ''

          for (const line of lines) {
            const trimmed = line.trim()
            if (!trimmed || !trimmed.startsWith('data: ')) continue

            const data = trimmed.slice(6)
            if (data === '[DONE]') return

            try {
              const chunk = JSON.parse(data) as ChatCompletionStreamResponse
              yield chunk
            } catch (parseError) {
              logger.warn(`Failed to parse SSE chunk`, {
                requestId: context.requestId,
                line: data,
                error: parseError
              })
            }
          }
        }
      } finally {
        reader.releaseLock()
      }
    } catch (error) {
      logger.error(`Streaming chat completion failed`, {
        requestId: context.requestId,
        provider: provider.name,
        error: error instanceof Error ? error.message : String(error)
      })
      throw this.wrapError(error, provider, context)
    }
  }

  private buildHeaders(provider: AiProvider, key: AiProviderKey): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': this.userAgent,
      'Accept': 'application/json',
      'Authorization': `Bearer ${key.keyValue}` // Default OpenAI-style authentication
    }

    // Add provider-specific headers from metadata
    const authHeaders = provider.metadata?.authHeaders as Record<string, string>
    if (authHeaders) {
      Object.assign(headers, authHeaders)
    }

    return headers
  }

  private async makeRequest(
    url: string,
    options: RequestInit,
    context: RequestContext
  ): Promise<Response> {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), this.timeout)

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal
      })
      clearTimeout(timeoutId)
      return response
    } catch (error) {
      clearTimeout(timeoutId)
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`Request timeout after ${this.timeout}ms`)
      }
      throw error
    }
  }

  private async handleHttpError(
    response: Response,
    provider: AiProvider,
    context: RequestContext
  ): Promise<LlmError> {
    let errorBody: any = {}
    try {
      errorBody = await response.json()
    } catch {
      // Ignore JSON parse errors
    }

    const error: LlmError = new Error(
      errorBody.error?.message || 
      errorBody.message || 
      `HTTP ${response.status}: ${response.statusText}`
    ) as LlmError

    error.code = errorBody.error?.code || errorBody.code || `HTTP_${response.status}`
    error.statusCode = response.status
    error.provider = provider.name
    error.requestId = context.requestId

    // Determine if error is retryable
    error.retryable = response.status >= 500 || response.status === 429
    error.rateLimited = response.status === 429
    error.quotaExceeded = response.status === 429 && 
      (errorBody.error?.type === 'insufficient_quota' || 
       errorBody.error?.code === 'quota_exceeded')

    return error
  }

  private validateResponse(response: ChatCompletionResponse): void {
    if (!response.id || !response.object || !response.choices) {
      throw new Error('Invalid response format: missing required fields')
    }

    if (response.choices.length === 0) {
      throw new Error('Invalid response format: no choices returned')
    }

    for (const choice of response.choices) {
      if (typeof choice.index !== 'number' || !choice.message) {
        throw new Error('Invalid response format: invalid choice structure')
      }
    }
  }

  private wrapError(
    error: unknown,
    provider: AiProvider,
    context: RequestContext
  ): LlmError {
    if (error && typeof error === 'object' && 'code' in error) {
      return error as LlmError
    }

    const wrappedError = new Error(
      error instanceof Error ? error.message : String(error)
    ) as LlmError

    wrappedError.code = 'UNKNOWN_ERROR'
    wrappedError.retryable = false
    wrappedError.provider = provider.name
    wrappedError.requestId = context.requestId

    if (error instanceof Error) {
      if (error.message.includes('timeout')) {
        wrappedError.code = 'TIMEOUT'
        wrappedError.retryable = true
      } else if (error.message.includes('network') || error.message.includes('fetch')) {
        wrappedError.code = 'NETWORK_ERROR'
        wrappedError.retryable = true
      }
    }

    return wrappedError
  }
}