import { logger } from '@babel-feed/utils'
import { AiProviderManager } from './ai-provider-manager.js'
import { LlmHttpClient } from './http-client.js'
import { OpenAIAdapter } from './openai-adapter.js'
import type {
  ChatCompletionRequest,
  ChatCompletionResponse,
  ChatCompletionStreamResponse,
  AiProvider,
  AiProviderKey,
  RequestContext,
  LlmError
} from './types.js'

export interface LlmClientOptions {
  timeout?: number
  retryAttempts?: number
  retryDelay?: number
  userAgent?: string
}

export class LlmClient {
  private providerManager: AiProviderManager
  private httpClient: LlmHttpClient
  private adapter: OpenAIAdapter

  constructor(options: LlmClientOptions = {}) {
    this.providerManager = new AiProviderManager()
    this.httpClient = new LlmHttpClient(options)
    this.adapter = new OpenAIAdapter(this.httpClient)
  }

  async initialize(): Promise<void> {
    await this.providerManager.initialize()
    logger.info('LLM client initialized')
  }

  /**
   * Create a chat completion using the best available provider
   */
  async createChatCompletion(request: ChatCompletionRequest): Promise<ChatCompletionResponse> {
    const context = this.createRequestContext()
    
    logger.debug('Creating chat completion', {
      requestId: context.requestId,
      model: request.model,
      messageCount: request.messages.length,
      stream: request.stream
    })

    const providers = await this.selectProviders(request)
    
    for (const { provider, key } of providers) {
      try {
        context.provider = provider
        context.key = key
        context.retryCount++

        const response = await this.providerManager.executeWithProvider(
          provider.id,
          async () => {
            return await this.adapter.createChatCompletion(request, provider, key, context)
          }
        )

        logger.debug('Chat completion successful', {
          requestId: context.requestId,
          provider: provider.name,
          responseId: response.id
        })

        return response
      } catch (error) {
        logger.warn(`Provider ${provider.name} failed`, {
          requestId: context.requestId,
          error: error instanceof Error ? error.message : String(error)
        })

        if (this.isRetryableError(error)) {
          continue // Try next provider
        } else {
          throw error // Non-retryable error, stop trying
        }
      }
    }

    throw new Error('All providers failed for chat completion request')
  }

  /**
   * Create a streaming chat completion using the best available provider
   */
  async *streamChatCompletion(request: ChatCompletionRequest): AsyncGenerator<ChatCompletionStreamResponse> {
    const context = this.createRequestContext()
    
    logger.debug('Starting streaming chat completion', {
      requestId: context.requestId,
      model: request.model,
      messageCount: request.messages.length
    })

    const providers = await this.selectProviders(request)
    
    for (const { provider, key } of providers) {
      try {
        context.provider = provider
        context.key = key
        context.retryCount++

        // Ensure streaming is enabled for this request
        const streamingRequest = { ...request, stream: true }
        
        yield* await this.providerManager.executeWithProvider(
          provider.id,
          async () => {
            return this.adapter.streamChatCompletion(streamingRequest, provider, key, context)
          }
        )

        logger.debug('Streaming chat completion successful', {
          requestId: context.requestId,
          provider: provider.name
        })

        return // Successfully completed stream
      } catch (error) {
        logger.warn(`Provider ${provider.name} failed for streaming`, {
          requestId: context.requestId,
          error: error instanceof Error ? error.message : String(error)
        })

        if (this.isRetryableError(error)) {
          continue // Try next provider
        } else {
          throw error // Non-retryable error, stop trying
        }
      }
    }

    throw new Error('All providers failed for streaming chat completion request')
  }

  /**
   * Create chat completion with specific provider type preference
   */
  async createChatCompletionWithProviderType(
    request: ChatCompletionRequest,
    preferredType: string
  ): Promise<ChatCompletionResponse> {
    const providers = await this.providerManager.getEnabledProviders(preferredType)
    
    if (providers.length === 0) {
      logger.warn(`No providers found for type: ${preferredType}, falling back to any available`)
      return this.createChatCompletion(request)
    }

    // Use the type-specific providers
    const specificRequest = { ...request }
    const context = this.createRequestContext()
    
    for (const provider of providers) {
      try {
        const keys = await this.providerManager.getProviderKeys(provider.id)
        if (keys.length === 0) continue

        const key = keys[0] // Use first available key
        context.provider = provider
        context.key = key
        context.retryCount++

        const response = await this.providerManager.executeWithProvider(
          provider.id,
          async () => {
            return await this.adapter.createChatCompletion(specificRequest, provider, key, context)
          }
        )

        return response
      } catch (error) {
        logger.warn(`Provider ${provider.name} failed for type ${preferredType}`, {
          requestId: context.requestId,
          error: error instanceof Error ? error.message : String(error)
        })
        continue
      }
    }

    // If all type-specific providers fail, fall back to general request
    logger.info(`All ${preferredType} providers failed, falling back to general providers`)
    return this.createChatCompletion(request)
  }

  /**
   * Get provider health status
   */
  async getProviderHealth(): Promise<Record<string, any>> {
    const providers = await this.providerManager.getAllProviders()
    const health: Record<string, any> = {}

    for (const provider of providers) {
      try {
        const status = await this.providerManager.getProviderHealth(provider.id)
        health[provider.name] = {
          healthy: status.healthy,
          circuitState: status.circuitState,
          availableKeys: status.availableKeys,
          totalKeys: status.totalKeys,
          errorRate: status.errorRate,
          lastCheck: status.lastCheck,
          lastError: status.lastError
        }
      } catch (error) {
        health[provider.name] = {
          healthy: false,
          error: error instanceof Error ? error.message : String(error)
        }
      }
    }

    return health
  }

  /**
   * Select best providers for a request
   */
  private async selectProviders(request: ChatCompletionRequest): Promise<Array<{ provider: AiProvider; key: AiProviderKey }>> {
    // Try content analysis providers first, then translation, then any
    const providerTypes = ['content_analysis', 'translation', undefined]
    const selectedProviders: Array<{ provider: AiProvider; key: AiProviderKey }> = []

    for (const type of providerTypes) {
      const providers = type 
        ? await this.providerManager.getEnabledProviders(type)
        : await this.providerManager.getEnabledProviders()

      for (const provider of providers) {
        const keys = await this.providerManager.getProviderKeys(provider.id)
        if (keys.length === 0) continue

        // Check if provider supports the requested model
        if (provider.metadata?.models && 
            !provider.metadata.models.includes('*') && 
            !provider.metadata.models.includes(request.model)) {
          continue
        }

        // Use first available key (round-robin is handled in provider manager)
        selectedProviders.push({ provider, key: keys[0] })
      }

      if (selectedProviders.length > 0) break // Found providers for this type
    }

    if (selectedProviders.length === 0) {
      throw new Error('No available providers found')
    }

    return selectedProviders
  }


  /**
   * Create request context for tracking
   */
  private createRequestContext(): RequestContext {
    return {
      provider: {} as AiProvider,
      key: {} as AiProviderKey,
      requestId: `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      startTime: Date.now(),
      retryCount: 0
    }
  }

  /**
   * Check if error is retryable
   */
  private isRetryableError(error: unknown): boolean {
    if (error && typeof error === 'object' && 'retryable' in error) {
      return Boolean((error as LlmError).retryable)
    }

    if (error instanceof Error) {
      const message = error.message.toLowerCase()
      return message.includes('timeout') || 
             message.includes('network') || 
             message.includes('rate limit') ||
             message.includes('503') ||
             message.includes('502') ||
             message.includes('500')
    }

    return false
  }

  // Expose the underlying provider manager for advanced use cases
  getProviderManager(): AiProviderManager {
    return this.providerManager
  }
}