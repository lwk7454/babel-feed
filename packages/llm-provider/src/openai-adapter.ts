import { LlmHttpClient } from './http-client.js'
import type {
  ChatCompletionRequest,
  ChatCompletionResponse,
  ChatCompletionStreamResponse,
  AiProvider,
  AiProviderKey,
  RequestContext,
  ToolCall
} from './types.js'

export interface OpenAIAdapterConfig {
  validateRequest?: boolean
  transformRequest?: boolean
  transformResponse?: boolean
}

export class OpenAIAdapter {
  private httpClient: LlmHttpClient
  private config: OpenAIAdapterConfig

  constructor(httpClient?: LlmHttpClient, config: OpenAIAdapterConfig = {}) {
    this.httpClient = httpClient || new LlmHttpClient()
    this.config = {
      validateRequest: true,
      transformRequest: true,
      transformResponse: true,
      ...config
    }
  }

  async createChatCompletion(
    request: ChatCompletionRequest,
    provider: AiProvider,
    key: AiProviderKey,
    context: RequestContext
  ): Promise<ChatCompletionResponse> {
    if (this.config.validateRequest) {
      this.validateRequest(request, provider)
    }

    const transformedRequest = this.config.transformRequest 
      ? this.transformRequest(request, provider)
      : request
    
    const response = await this.httpClient.createChatCompletion(
      transformedRequest,
      provider,
      key,
      context
    )

    return this.config.transformResponse 
      ? this.transformResponse(response as unknown as Record<string, unknown>, provider)
      : response
  }

  async *streamChatCompletion(
    request: ChatCompletionRequest,
    provider: AiProvider,
    key: AiProviderKey,
    context: RequestContext
  ): AsyncGenerator<ChatCompletionStreamResponse> {
    if (this.config.validateRequest) {
      this.validateRequest(request, provider)
    }

    const transformedRequest = this.config.transformRequest 
      ? this.transformRequest(request, provider)
      : request
    
    for await (const chunk of this.httpClient.streamChatCompletion(
      transformedRequest,
      provider,
      key,
      context
    )) {
      yield chunk
    }
  }

  private validateRequest(request: ChatCompletionRequest, provider: AiProvider): void {
    if (!request.model) {
      throw new Error('Model is required')
    }

    if (!request.messages || request.messages.length === 0) {
      throw new Error('At least one message is required')
    }

    // Validate model is supported (if provider specifies supported models)
    const supportedModels = provider.metadata?.models as string[] || ['*']
    if (!supportedModels.includes('*') && !supportedModels.includes(request.model)) {
      throw new Error(`Model ${request.model} is not supported by provider ${provider.name}`)
    }

    // Validate max tokens if provider specifies a limit
    const maxTokens = provider.metadata?.maxTokens as number
    if (request.max_tokens && maxTokens && request.max_tokens > maxTokens) {
      throw new Error(`max_tokens ${request.max_tokens} exceeds provider limit of ${maxTokens}`)
    }

    // Validate temperature range if provider specifies constraints
    const tempRange = provider.metadata?.temperatureRange as { min: number; max: number }
    if (request.temperature !== undefined && tempRange) {
      if (request.temperature < tempRange.min || request.temperature > tempRange.max) {
        throw new Error(`temperature must be between ${tempRange.min} and ${tempRange.max} for ${provider.name}`)
      }
    }

    // Validate streaming support
    const features = provider.metadata?.features as Record<string, unknown> | undefined
    const supportsStreaming = features?.streaming !== false
    if (request.stream && !supportsStreaming) {
      throw new Error(`Streaming is not supported by provider ${provider.name}`)
    }

    // Validate tools support
    const supportsTools = features?.tools !== false
    if (request.tools && !supportsTools) {
      throw new Error(`Tools are not supported by provider ${provider.name}`)
    }

    // Validate JSON mode support
    const supportsJsonMode = features?.jsonMode !== false
    if (request.response_format?.type === 'json_object' && !supportsJsonMode) {
      throw new Error(`JSON mode is not supported by provider ${provider.name}`)
    }
  }

  private transformRequest(request: ChatCompletionRequest, provider: AiProvider): ChatCompletionRequest {
    const transformed = { ...request }

    // Provider-specific transformations based on metadata
    const transforms = provider.metadata?.transforms as Record<string, unknown> || {}

    // Remove unsupported parameters
    const unsupportedParams = transforms.removeParams as string[] || []
    unsupportedParams.forEach(param => {
      delete (transformed as Record<string, unknown>)[param]
    })

    // Apply default values
    const defaults = transforms.defaults as Record<string, unknown> || {}
    Object.entries(defaults).forEach(([key, value]) => {
      if (transformed[key as keyof ChatCompletionRequest] === undefined) {
        (transformed as Record<string, unknown>)[key] = value
      }
    })

    // Apply parameter mappings
    const paramMappings = transforms.paramMappings as Record<string, string> || {}
    Object.entries(paramMappings).forEach(([from, to]) => {
      if (from in transformed) {
        (transformed as Record<string, unknown>)[to] = (transformed as Record<string, unknown>)[from]
        delete (transformed as Record<string, unknown>)[from]
      }
    })

    // Apply token limits per model (before model name transformation)
    const tokenLimits = transforms.tokenLimits as Record<string, number> || {}
    if (transformed.max_tokens !== undefined && tokenLimits[transformed.model]) {
      transformed.max_tokens = Math.min(transformed.max_tokens, tokenLimits[transformed.model])
    }

    // Model name transformation (after token limits check)
    const modelPrefix = transforms.modelPrefix as string
    if (modelPrefix && !transformed.model.includes('/')) {
      if (modelPrefix === 'auto') {
        // Auto-detect and add appropriate prefix
        if (transformed.model.startsWith('gpt-')) {
          transformed.model = `openai/${transformed.model}`
        } else if (transformed.model.startsWith('claude-')) {
          transformed.model = `anthropic/${transformed.model}`
        } else if (transformed.model.startsWith('gemini-')) {
          transformed.model = `google/${transformed.model}`
        }
      } else {
        // Use the specified prefix
        transformed.model = `${modelPrefix}/${transformed.model}`
      }
    }

    // Add system message if required and none exists
    const requiresSystemMessage = transforms.requiresSystemMessage as boolean
    if (requiresSystemMessage && 
        transformed.messages.length > 0 && 
        transformed.messages[0].role !== 'system') {
      const defaultSystemMessage = transforms.defaultSystemMessage as string || 
        'You are a helpful AI assistant. Please provide accurate and helpful responses.'
      
      transformed.messages.unshift({
        role: 'system',
        content: defaultSystemMessage
      })
    }

    return transformed
  }

  private transformResponse(response: Record<string, unknown>, provider: AiProvider): ChatCompletionResponse {
    // Most providers return standard OpenAI format, but handle edge cases
    const transformed: ChatCompletionResponse = {
      id: response.id as string || `${provider.name}_${Date.now()}`,
      object: 'chat.completion',
      created: response.created as number || Math.floor(Date.now() / 1000),
      model: response.model as string,
      choices: (response.choices as Array<Record<string, unknown>>)?.map((choice: Record<string, unknown>, index: number) => ({
        index: choice.index as number ?? index,
        message: {
          role: ((choice.message as Record<string, unknown>)?.role as string || 'assistant') as 'system' | 'user' | 'assistant' | 'tool',
          content: (choice.message as Record<string, unknown>)?.content as string || '',
          tool_calls: (choice.message as Record<string, unknown>)?.tool_calls as unknown as ToolCall[] | undefined
        },
        finish_reason: this.normalizeFinishReason(choice.finish_reason as string, provider)
      })) || [],
      usage: response.usage ? {
        prompt_tokens: (response.usage as Record<string, unknown>).prompt_tokens as number || 0,
        completion_tokens: (response.usage as Record<string, unknown>).completion_tokens as number || 0,
        total_tokens: (response.usage as Record<string, unknown>).total_tokens as number || 
          ((response.usage as Record<string, unknown>).prompt_tokens as number || 0) + ((response.usage as Record<string, unknown>).completion_tokens as number || 0)
      } : undefined,
      system_fingerprint: response.system_fingerprint as string | undefined
    }

    return transformed
  }

  private normalizeFinishReason(
    reason: string, 
    provider: AiProvider
  ): 'stop' | 'length' | 'tool_calls' | 'content_filter' | null {
    if (!reason) return null
    
    // Provider-specific finish reason mappings
    const mappings = provider.metadata?.finishReasonMappings as Record<string, string> || {}
    const normalizedReason = mappings[reason.toLowerCase()] || reason.toLowerCase()
    
    switch (normalizedReason) {
      case 'stop':
      case 'end_turn':
        return 'stop'
      case 'length':
      case 'max_tokens':
        return 'length'
      case 'tool_calls':
      case 'function_call':
        return 'tool_calls'
      case 'content_filter':
      case 'filtered':
        return 'content_filter'
      default:
        return 'stop' // Default fallback
    }
  }

  generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }
}