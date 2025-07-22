import { describe, it, expect, beforeEach, mock } from 'bun:test'
import { OpenAIAdapter } from '../src/openai-adapter.js'
import { LlmHttpClient } from '../src/http-client.js'
import { clearTestData } from '@babel-feed/pgdb'
import type { ChatCompletionRequest, ChatCompletionResponse, AiProvider, AiProviderKey, RequestContext } from '../src/types.js'

describe('OpenAIAdapter', () => {
  let adapter: OpenAIAdapter
  let mockHttpClient: LlmHttpClient
  let mockProvider: AiProvider
  let mockKey: AiProviderKey
  let mockContext: RequestContext

  beforeEach(async () => {
    await clearTestData()
    mockHttpClient = {
      createChatCompletion: mock(),
      streamChatCompletion: mock()
    } as any

    adapter = new OpenAIAdapter(mockHttpClient)

    mockProvider = {
      id: 'test-provider-id',
      name: 'openrouter',
      displayName: 'OpenRouter',
      providerType: 'content_analysis',
      baseUrl: 'https://openrouter.ai/api/v1',
      enabled: true,
      priority: 10,
      maxRequestsPerMinute: 60,
      maxRequestsPerHour: 3600,
      maxRequestsPerDay: 86400,
      circuitBreakerThreshold: 5,
      circuitBreakerTimeout: 60000,
      metadata: {
        models: ['gpt-3.5-turbo', 'gpt-4'],
        maxTokens: 200000,
        temperatureRange: { min: 0, max: 2 },
        features: {
          streaming: true,
          tools: true,
          jsonMode: true,
          logprobs: false
        },
        transforms: {
          removeParams: ['logit_bias', 'seed'],
          defaults: {
            temperature: 0.7,
            max_tokens: 2048
          },
          modelPrefix: 'auto'
        },
        authHeaders: {
          'HTTP-Referer': 'https://babel-feed.app',
          'X-Title': 'Babel Feed'
        }
      },
      createdAt: new Date(),
      updatedAt: new Date()
    }

    mockKey = {
      id: 'test-key-id',
      providerId: 'test-provider-id',
      keyName: 'test-key',
      keyValue: 'test-api-key',
      enabled: true,
      successCount: 0,
      errorCount: 0,
      createdAt: new Date(),
      updatedAt: new Date()
    }

    mockContext = {
      provider: mockProvider,
      key: mockKey,
      requestId: 'test-request-id',
      startTime: Date.now(),
      retryCount: 0
    }
  })

  describe('Request Validation', () => {
    it('validates basic request requirements', () => {
      const validRequest: ChatCompletionRequest = {
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: 'Hello' }]
      }

      expect(() => adapter['validateRequest'](validRequest, mockProvider)).not.toThrow()
    })

    it('rejects requests without model', () => {
      const invalidRequest = {
        messages: [{ role: 'user', content: 'Hello' }]
      } as ChatCompletionRequest

      expect(() => adapter['validateRequest'](invalidRequest, mockProvider))
        .toThrow('Model is required')
    })

    it('rejects requests without messages', () => {
      const invalidRequest: ChatCompletionRequest = {
        model: 'gpt-3.5-turbo',
        messages: []
      }

      expect(() => adapter['validateRequest'](invalidRequest, mockProvider))
        .toThrow('At least one message is required')
    })

    it('validates supported models when specified', () => {
      const unsupportedRequest: ChatCompletionRequest = {
        model: 'unsupported-model',
        messages: [{ role: 'user', content: 'Hello' }]
      }

      expect(() => adapter['validateRequest'](unsupportedRequest, mockProvider))
        .toThrow('Model unsupported-model is not supported')
    })

    it('allows any model when provider supports "*"', () => {
      const anyModelProvider = {
        ...mockProvider,
        metadata: { ...mockProvider.metadata, models: ['*'] }
      }

      const request: ChatCompletionRequest = {
        model: 'any-model',
        messages: [{ role: 'user', content: 'Hello' }]
      }

      expect(() => adapter['validateRequest'](request, anyModelProvider)).not.toThrow()
    })

    it('validates max tokens limit', () => {
      const invalidRequest: ChatCompletionRequest = {
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: 'Hello' }],
        max_tokens: 300000 // Exceeds provider limit
      }

      expect(() => adapter['validateRequest'](invalidRequest, mockProvider))
        .toThrow('max_tokens 300000 exceeds provider limit of 200000')
    })

    it('validates temperature range', () => {
      const invalidRequest: ChatCompletionRequest = {
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: 'Hello' }],
        temperature: 3.0 // Exceeds range
      }

      expect(() => adapter['validateRequest'](invalidRequest, mockProvider))
        .toThrow('temperature must be between 0 and 2')
    })

    it('validates streaming support', () => {
      const noStreamProvider = {
        ...mockProvider,
        metadata: {
          ...mockProvider.metadata,
          features: { ...(mockProvider.metadata!.features as Record<string, unknown>), streaming: false }
        }
      }

      const streamRequest: ChatCompletionRequest = {
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: 'Hello' }],
        stream: true
      }

      expect(() => adapter['validateRequest'](streamRequest, noStreamProvider))
        .toThrow('Streaming is not supported')
    })
  })

  describe('Request Transformation', () => {
    it('removes unsupported parameters', () => {
      const request: ChatCompletionRequest = {
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: 'Hello' }],
        logit_bias: { 'test': 1 },
        seed: 12345
      }

      const transformed = adapter['transformRequest'](request, mockProvider)

      expect('logit_bias' in transformed).toBe(false)
      expect('seed' in transformed).toBe(false)
    })

    it('applies default values', () => {
      const request: ChatCompletionRequest = {
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: 'Hello' }]
      }

      const transformed = adapter['transformRequest'](request, mockProvider)

      expect(transformed.temperature).toBe(0.7)
      expect(transformed.max_tokens).toBe(2048)
    })

    it('does not override existing values with defaults', () => {
      const request: ChatCompletionRequest = {
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: 'Hello' }],
        temperature: 0.5,
        max_tokens: 1000
      }

      const transformed = adapter['transformRequest'](request, mockProvider)

      expect(transformed.temperature).toBe(0.5)
      expect(transformed.max_tokens).toBe(1000)
    })

    it('auto-detects and adds model prefixes', () => {
      const testCases = [
        { input: 'gpt-3.5-turbo', expected: 'openai/gpt-3.5-turbo' },
        { input: 'claude-3-haiku', expected: 'anthropic/claude-3-haiku' },
        { input: 'gemini-pro', expected: 'google/gemini-pro' },
        { input: 'openai/gpt-4', expected: 'openai/gpt-4' } // Already has prefix
      ]

      testCases.forEach(({ input, expected }) => {
        const request: ChatCompletionRequest = {
          model: input,
          messages: [{ role: 'user', content: 'Hello' }]
        }

        const transformed = adapter['transformRequest'](request, mockProvider)
        expect(transformed.model).toBe(expected)
      })
    })

    it('adds system message when required', () => {
      const systemMessageProvider = {
        ...mockProvider,
        metadata: {
          ...mockProvider.metadata,
          transforms: {
            ...(mockProvider.metadata!.transforms as Record<string, unknown>),
            requiresSystemMessage: true,
            defaultSystemMessage: 'You are a helpful assistant.'
          }
        }
      }

      const request: ChatCompletionRequest = {
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: 'Hello' }]
      }

      const transformed = adapter['transformRequest'](request, systemMessageProvider)

      expect(transformed.messages).toHaveLength(2)
      expect(transformed.messages[0].role).toBe('system')
      expect(transformed.messages[0].content).toBe('You are a helpful assistant.')
      expect(transformed.messages[1].role).toBe('user')
    })

    it('does not add system message if one already exists', () => {
      const systemMessageProvider = {
        ...mockProvider,
        metadata: {
          ...mockProvider.metadata,
          transforms: {
            ...(mockProvider.metadata!.transforms as Record<string, unknown>),
            requiresSystemMessage: true
          }
        }
      }

      const request: ChatCompletionRequest = {
        model: 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: 'Custom system message' },
          { role: 'user', content: 'Hello' }
        ]
      }

      const transformed = adapter['transformRequest'](request, systemMessageProvider)

      expect(transformed.messages).toHaveLength(2)
      expect(transformed.messages[0].content).toBe('Custom system message')
    })

    it('applies token limits per model', () => {
      const tokenLimitProvider = {
        ...mockProvider,
        metadata: {
          ...mockProvider.metadata,
          transforms: {
            ...(mockProvider.metadata!.transforms as Record<string, unknown>),
            tokenLimits: {
              'gpt-3.5-turbo': 1000
            }
          }
        }
      }

      const request: ChatCompletionRequest = {
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: 'Hello' }],
        max_tokens: 2000 // Will be clamped
      }

      const transformed = adapter['transformRequest'](request, tokenLimitProvider)
      expect(transformed.max_tokens).toBe(1000)
    })
  })

  describe('Response Transformation', () => {
    it('transforms basic response correctly', () => {
      const mockResponse = {
        id: 'test-id',
        model: 'gpt-3.5-turbo',
        choices: [{
          index: 0,
          message: {
            role: 'assistant',
            content: 'Hello response'
          },
          finish_reason: 'stop'
        }],
        usage: {
          prompt_tokens: 10,
          completion_tokens: 5,
          total_tokens: 15
        }
      }

      const transformed = adapter['transformResponse'](mockResponse, mockProvider)

      expect(transformed.object).toBe('chat.completion')
      expect(transformed.choices[0].message.content).toBe('Hello response')
      expect(transformed.usage?.total_tokens).toBe(15)
    })

    it('fills missing fields with defaults', () => {
      const incompleteResponse = {
        choices: [{
          message: { content: 'response' }
        }]
      }

      const transformed = adapter['transformResponse'](incompleteResponse, mockProvider)

      expect(transformed.id).toContain('openrouter_')
      expect(transformed.created).toBeTypeOf('number')
      expect(transformed.choices[0].index).toBe(0)
      expect(transformed.choices[0].message.role).toBe('assistant')
    })

    it('normalizes finish reasons', () => {
      const providerWithMappings = {
        ...mockProvider,
        metadata: {
          ...mockProvider.metadata,
          finishReasonMappings: {
            'end_turn': 'stop',
            'max_tokens': 'length'
          }
        }
      }

      const testCases = [
        { input: 'end_turn', expected: 'stop' as const },
        { input: 'max_tokens', expected: 'length' as const },
        { input: 'unknown', expected: 'stop' as const }
      ]

      testCases.forEach(({ input, expected }) => {
        const result = adapter['normalizeFinishReason'](input, providerWithMappings)
        expect(result).toBe(expected)
      })
    })
  })

  describe('Integration', () => {
    it('calls HTTP client for chat completion', async () => {
      const mockResponse: ChatCompletionResponse = {
        id: 'test',
        object: 'chat.completion',
        created: Date.now(),
        model: 'gpt-3.5-turbo',
        choices: [{ index: 0, message: { role: 'assistant', content: 'response' }, finish_reason: 'stop' }]
      }

      mockHttpClient.createChatCompletion = mock().mockResolvedValue(mockResponse)

      const request: ChatCompletionRequest = {
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: 'Hello' }]
      }

      const result = await adapter.createChatCompletion(request, mockProvider, mockKey, mockContext)

      expect(mockHttpClient.createChatCompletion).toHaveBeenCalledTimes(1)
      expect(result).toEqual(mockResponse)
    })

    it('calls HTTP client for streaming', async () => {
      const mockGenerator = async function* () {
        yield { id: 'test', object: 'chat.completion.chunk', created: Date.now(), model: 'gpt-3.5-turbo', choices: [] }
      }

      mockHttpClient.streamChatCompletion = mock().mockReturnValue(mockGenerator())

      const request: ChatCompletionRequest = {
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: 'Hello' }],
        stream: true
      }

      const chunks = []
      for await (const chunk of adapter.streamChatCompletion(request, mockProvider, mockKey, mockContext)) {
        chunks.push(chunk)
      }

      expect(mockHttpClient.streamChatCompletion).toHaveBeenCalledTimes(1)
      expect(chunks).toHaveLength(1)
    })

    it('can disable validation and transformation', async () => {
      const customAdapter = new OpenAIAdapter(mockHttpClient, {
        validateRequest: false,
        transformRequest: false,
        transformResponse: false
      })

      mockHttpClient.createChatCompletion = mock().mockResolvedValue({ test: 'response' } as any)

      // This request would normally fail validation
      const invalidRequest = {
        model: 'unsupported-model',
        messages: [{ role: 'user', content: 'Hello' }],
        temperature: 10 // Invalid range
      } as ChatCompletionRequest

      const result = await customAdapter.createChatCompletion(invalidRequest, mockProvider, mockKey, mockContext)

      expect(result).toEqual({ test: 'response' } as any)
      expect(mockHttpClient.createChatCompletion).toHaveBeenCalledWith(
        invalidRequest, // Should be passed unchanged
        mockProvider,
        mockKey,
        mockContext
      )
    })
  })

  describe('Utility Methods', () => {
    it('generates unique request IDs', () => {
      const id1 = adapter.generateRequestId()
      const id2 = adapter.generateRequestId()
      
      expect(id1).not.toBe(id2)
      expect(id1).toMatch(/^req_\d+_[a-z0-9]+$/)
    })
  })
})