import { clearTestData, getTestDb, aiProviders, aiProviderKeys } from '@babel-feed/pgdb'
import { createGlobalTimerMock } from '@babel-feed/utils'
import { afterAll, afterEach, beforeEach, describe, expect, it, mock } from 'bun:test'
import { LlmClient } from '../src/llm-client.js'
import type {
  ChatCompletionRequest,
  ChatCompletionResponse,
  ChatCompletionStreamResponse
} from '../src/types.js'

// Mock fetch for HTTP requests
const mockFetch = mock()
;(mockFetch as any).preconnect = mock()
global.fetch = mockFetch as any

describe('LlmClient', () => {
  let client: LlmClient
  let timer: ReturnType<typeof createGlobalTimerMock>
  let testProvider1: any
  let testProvider2: any

  // Test data helpers
  const createTestProvider = (overrides: Partial<any> = {}) => ({
    name: 'test-provider-1',
    displayName: 'Test Provider 1',
    providerType: 'general',
    baseUrl: 'https://api.test1.com/v1',
    enabled: true,
    priority: 10,
    maxRequestsPerMinute: 60,
    maxRequestsPerHour: 3600,
    maxRequestsPerDay: 86400,
    circuitBreakerThreshold: 10, // High threshold to avoid opening during tests
    circuitBreakerTimeout: 1000, // Short timeout for testing
    healthCheckInterval: 30000,
    metadata: {
      models: ['test-model-1'],
      maxTokens: 4096,
      features: {
        streaming: true,
        tools: true,
        jsonMode: true
      }
    },
    ...overrides
  })

  const createTestApiKey = (providerId: string, overrides: Partial<any> = {}) => ({
    providerId,
    keyName: 'test-key',
    apiKey: 'test-api-key',
    priority: 5,
    enabled: true,
    successCount: 0,
    errorCount: 0,
    currentUsage: 0,
    dailyQuota: 1000,
    ...overrides
  })

  const createMockResponse = (overrides: Partial<ChatCompletionResponse> = {}): ChatCompletionResponse => ({
    id: 'chatcmpl-test',
    object: 'chat.completion',
    created: Math.floor(timer.now() / 1000),
    model: 'gpt-3.5-turbo',
    choices: [{
      index: 0,
      message: {
        role: 'assistant',
        content: 'Hello! How can I help you today?',
        tool_calls: undefined
      },
      finish_reason: 'stop'
    }],
    usage: {
      prompt_tokens: 20,
      completion_tokens: 10,
      total_tokens: 30
    },
    ...overrides
  })

  const createMockStreamResponse = (content: string, finishReason: 'stop' | 'length' | 'tool_calls' | 'content_filter' | null = null): ChatCompletionStreamResponse => ({
    id: 'chatcmpl-stream',
    object: 'chat.completion.chunk',
    created: Math.floor(timer.now() / 1000),
    model: 'gpt-3.5-turbo',
    choices: [{
      index: 0,
      delta: {
        role: 'assistant',
        content,
        tool_calls: undefined
      },
      finish_reason: finishReason
    }]
  })

  const createMockFetchResponse = (response: any, ok = true, status = 200) => ({
    ok,
    status,
    json: async () => response,
    body: response instanceof ReadableStream ? response : undefined
  })

  const createMockStream = (chunks: string[]) => {
    return new ReadableStream({
      start(controller) {
        for (const chunk of chunks) {
          controller.enqueue(new TextEncoder().encode(chunk))
        }
        controller.close()
      }
    })
  }

  beforeEach(async () => {
    await clearTestData()
    
    // Create timer mock
    timer = createGlobalTimerMock()
    timer.reset()
    
    // Create test providers - both with same type and priority so they both get selected for failover testing
    const [provider1] = await getTestDb().insert(aiProviders).values(createTestProvider()).returning()
    const [provider2] = await getTestDb().insert(aiProviders).values(createTestProvider({
      name: 'test-provider-2',
      displayName: 'Test Provider 2',
      providerType: 'general', // Same type as provider1 so both get selected
      baseUrl: 'https://api.test2.com/v1',
      priority: 10, // Same priority as provider1
      metadata: {
        models: ['test-model-2'],
        maxTokens: 4096,
        features: {
          streaming: true,
          tools: true,
          jsonMode: true
        }
      }
    })).returning()
    
    testProvider1 = provider1
    testProvider2 = provider2
    
    // Add test API keys
    await getTestDb().insert(aiProviderKeys).values([
      createTestApiKey(provider1.id, { keyName: 'key1', apiKey: 'test-key-1' }),
      createTestApiKey(provider2.id, { keyName: 'key2', apiKey: 'test-key-2' })
    ])
    
    client = new LlmClient({
      timeout: 5000,
      retryAttempts: 1, // Reduce retries for faster test execution
      retryDelay: 100
    })
    await client.initialize()
    
    // Clear all mocks
    mockFetch.mockClear()
  })

  afterEach(async () => {
    mockFetch.mockClear()
    timer.reset()
  })

  afterAll(async () => {
    await clearTestData()
    timer.cleanup()
  })

  describe('Chat Completion', () => {
    it('creates chat completion successfully', async () => {
      const mockResponse = createMockResponse()
      mockFetch.mockResolvedValueOnce(createMockFetchResponse(mockResponse))

      const request: ChatCompletionRequest = {
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: 'Hello' }],
        max_tokens: 100,
        temperature: 0.7
      }

      const response = await client.createChatCompletion(request)

      expect(response).toBeDefined()
      expect(response.id).toBe('chatcmpl-test')
      expect(response.choices).toHaveLength(1)
      expect(response.choices[0].message.content).toBe('Hello! How can I help you today?')
      expect(response.usage?.total_tokens).toBe(30)
    })

    it('handles retryable errors and eventually succeeds', async () => {
      // Test that the client can handle retryable errors and eventually succeed
      let callCount = 0
      mockFetch.mockImplementation(() => {
        callCount++
        // First provider fails (callCount 1), then second provider succeeds (callCount 2)
        if (callCount === 1) {
          return Promise.reject(new Error('Request timeout'))
        } else {
          return Promise.resolve(createMockFetchResponse(createMockResponse({
            id: 'chatcmpl-retry',
            choices: [{
              index: 0,
              message: {
                role: 'assistant',
                content: 'Retry successful',
                tool_calls: undefined
              },
              finish_reason: 'stop'
            }]
          })))
        }
      })

      const request: ChatCompletionRequest = {
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: 'Test retry' }]
      }

      // Start the request
      const promise = client.createChatCompletion(request)
      
      // Advance timer to allow retry logic (3 retries with exponential backoff)
      await timer.advanceTime(6000)
      
      const response = await promise
      expect(response.choices[0].message.content).toBe('Retry successful')
    })



    it('throws error when all providers fail', async () => {
      // Mock multiple failures using mockImplementation
      let callCount = 0
      mockFetch.mockImplementation(() => {
        callCount++
        const errors = [
          new Error('Request timeout'),
          new Error('Network error'),
          new Error('Rate limit exceeded'),
          new Error('Server error 503')
        ]
        if (callCount <= errors.length) {
          return Promise.reject(errors[callCount - 1])
        }
        return Promise.reject(new Error('Unexpected call'))
      })

      const request: ChatCompletionRequest = {
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: 'This should fail' }]
      }

      // Start the request
      const promise = client.createChatCompletion(request)
      
      // Advance timer to allow retry logic (3 retries with exponential backoff)
      await timer.advanceTime(8000)
      
      await expect(promise).rejects.toThrow('All providers failed')
    })
  })

  describe('Streaming Chat Completion', () => {
    it('streams chat completion successfully', async () => {
      const mockChunks = [
        'data: {"id":"chatcmpl-stream","object":"chat.completion.chunk","created":1735689600,"model":"gpt-3.5-turbo","choices":[{"index":0,"delta":{"role":"assistant","content":"Hello"},"finish_reason":null}]}\n\n',
        'data: {"id":"chatcmpl-stream","object":"chat.completion.chunk","created":1735689600,"model":"gpt-3.5-turbo","choices":[{"index":0,"delta":{"content":" there!"},"finish_reason":null}]}\n\n',
        'data: {"id":"chatcmpl-stream","object":"chat.completion.chunk","created":1735689600,"model":"gpt-3.5-turbo","choices":[{"index":0,"delta":{},"finish_reason":"stop"}]}\n\n',
        'data: [DONE]\n\n'
      ]

      const mockStream = createMockStream(mockChunks)
      mockFetch.mockResolvedValueOnce(createMockFetchResponse(mockStream))

      const request: ChatCompletionRequest = {
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: 'Stream test' }],
        stream: true
      }

      const chunks: ChatCompletionStreamResponse[] = []
      for await (const chunk of client.streamChatCompletion(request)) {
        chunks.push(chunk)
      }

      expect(chunks).toHaveLength(3)
      expect(chunks[0].choices[0].delta.content).toBe('Hello')
      expect(chunks[1].choices[0].delta.content).toBe(' there!')
      expect(chunks[2].choices[0].finish_reason).toBe('stop')
    })

    it('handles streaming errors gracefully', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Streaming failed'))

      const request: ChatCompletionRequest = {
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: 'Stream error test' }],
        stream: true
      }

      let error: Error | undefined
      try {
        const stream = client.streamChatCompletion(request)
        for await (const chunk of stream) {
          // Should not reach here
        }
      } catch (e) {
        error = e as Error
      }
      
      expect(error).toBeDefined()
      expect(error?.message).toContain('failed')
    })
  })

  describe('Provider Health', () => {
    it('returns provider health status', async () => {
      const health = await client.getProviderHealth()
      
      expect(health).toBeDefined()
      expect(typeof health).toBe('object')
      
      // Should have health info for each provider
      for (const [providerName, status] of Object.entries(health)) {
        expect(providerName).toBeDefined()
        expect(typeof status).toBe('object')
        expect('healthy' in (status as Record<string, unknown>)).toBe(true)
      }
    })
  })

  describe('Error Handling', () => {
    it('handles authentication errors', async () => {
      const authError = {
        error: {
          message: 'Invalid API key',
          type: 'invalid_request_error',
          code: 'invalid_api_key'
        }
      }
      
      // Mock multiple auth failures using mockImplementation
      let callCount = 0
      mockFetch.mockImplementation(() => {
        callCount++
        if (callCount <= 4) {
          return Promise.resolve(createMockFetchResponse(authError, false, 401))
        }
        return Promise.reject(new Error('Unexpected call'))
      })

      const request: ChatCompletionRequest = {
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: 'Auth error test' }]
      }

      // Start the request
      const promise = client.createChatCompletion(request)
      
      // Advance timer to allow retry logic (3 retries with exponential backoff)
      await timer.advanceTime(8000)
      
      await expect(promise).rejects.toThrow()
    })

    it('handles timeout errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Request timeout'))

      const request: ChatCompletionRequest = {
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: 'Timeout test' }]
      }

      await expect(client.createChatCompletion(request)).rejects.toThrow()
    })

    it('handles network errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'))

      const request: ChatCompletionRequest = {
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: 'Network error test' }]
      }

      await expect(client.createChatCompletion(request)).rejects.toThrow()
    })
  })

  describe('Provider Type Selection', () => {
    it('creates chat completion with specific provider type', async () => {
      const mockResponse = createMockResponse({ id: 'chatcmpl-type-specific' })
      mockFetch.mockResolvedValueOnce(createMockFetchResponse(mockResponse))

      const request: ChatCompletionRequest = {
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: 'Type specific test' }]
      }

      const response = await client.createChatCompletionWithProviderType(request, 'content_analysis')
      
      expect(response).toBeDefined()
      expect(response.id).toBe('chatcmpl-type-specific')
    })

    it('falls back to general providers when type-specific providers fail', async () => {
      // Type-specific provider fails
      mockFetch.mockRejectedValueOnce(new Error('Type-specific provider failed'))
      
      // General provider succeeds
      const mockResponse = createMockResponse({ id: 'chatcmpl-fallback' })
      mockFetch.mockResolvedValueOnce(createMockFetchResponse(mockResponse))

      const request: ChatCompletionRequest = {
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: 'Fallback test' }]
      }

      const response = await client.createChatCompletionWithProviderType(request, 'content_analysis')
      
      expect(response).toBeDefined()
      expect(response.id).toBe('chatcmpl-fallback')
    })
  })
})