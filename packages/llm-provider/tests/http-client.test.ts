import { describe, it, expect, beforeEach, afterEach, mock } from 'bun:test'
import { LlmHttpClient } from '../src/http-client.js'
import { clearTestData } from '@babel-feed/pgdb'
import type {
  ChatCompletionRequest,
  ChatCompletionResponse,
  ChatCompletionStreamResponse,
  AiProvider,
  AiProviderKey,
  RequestContext
} from '../src/types.js'

// Mock fetch for HTTP requests
const mockFetch = mock()
global.fetch = mockFetch as any

describe('LlmHttpClient', () => {
  let httpClient: LlmHttpClient
  let mockProvider: AiProvider
  let mockKey: AiProviderKey
  let mockContext: RequestContext

  beforeEach(async () => {
    await clearTestData()
    httpClient = new LlmHttpClient({
      timeout: 5000,
      retryAttempts: 3,
      retryDelay: 100
    })

    // Mock the delay function to be instant for tests
    const originalDelay = global.setTimeout
    global.setTimeout = ((fn: (...args: unknown[]) => void, delay: number) => {
      if (delay > 0) {
        // For retry delays, execute immediately
        fn()
        return {} as any
      }
      return originalDelay(fn, delay)
    }) as any

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
      requestId: 'test-request-123',
      startTime: Date.now(),
      retryCount: 0
    }

    mockFetch.mockClear()
  })

  afterEach(() => {
    mockFetch.mockClear()
    // Restore original setTimeout
    global.setTimeout = setTimeout
  })

  describe('Chat Completion', () => {
    it('makes successful chat completion request', async () => {
      const mockResponse: ChatCompletionResponse = {
        id: 'chatcmpl-test',
        object: 'chat.completion',
        created: Math.floor(Date.now() / 1000),
        model: 'gpt-3.5-turbo',
        choices: [{
          index: 0,
          message: {
            role: 'assistant',
            content: 'Hello! How can I help you?',
            tool_calls: undefined
          },
          finish_reason: 'stop'
        }],
        usage: {
          prompt_tokens: 15,
          completion_tokens: 8,
          total_tokens: 23
        }
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockResponse
      })

      const request: ChatCompletionRequest = {
        model: 'gpt-3.5-turbo',
        messages: [
          { role: 'user', content: 'Hello' }
        ],
        max_tokens: 100,
        temperature: 0.7
      }

      const response = await httpClient.createChatCompletion(request, mockProvider, mockKey, mockContext)

      expect(response).toEqual(mockResponse)
      expect(mockFetch).toHaveBeenCalledTimes(1)

      // Verify request parameters
      const callArgs = mockFetch.mock.calls[0]
      expect(callArgs[0]).toBe('https://openrouter.ai/api/v1/chat/completions')
      expect(callArgs[1].method).toBe('POST')
      expect(callArgs[1].headers['Authorization']).toBe('Bearer test-api-key')
      expect(callArgs[1].headers['Content-Type']).toBe('application/json')
      
      const body = JSON.parse(callArgs[1].body)
      expect(body.stream).toBe(false)
      expect(body.model).toBe('gpt-3.5-turbo')
      expect(body.messages).toHaveLength(1)
    })

    it('sets provider-specific headers from metadata', async () => {
      const openrouterProvider = {
        ...mockProvider,
        name: 'openrouter',
        metadata: {
          authHeaders: {
            'HTTP-Referer': 'https://babel-feed.app',
            'X-Title': 'Babel Feed'
          }
        }
      }
      
      const mockResponse: ChatCompletionResponse = {
        id: 'test-id',
        object: 'chat.completion',
        created: Math.floor(Date.now() / 1000),
        model: 'gpt-3.5-turbo',
        choices: [{ 
          index: 0,
          message: { role: 'assistant', content: 'test', tool_calls: undefined },
          finish_reason: 'stop'
        }]
      }
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockResponse
      })

      const request: ChatCompletionRequest = {
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: 'Hello' }]
      }

      await httpClient.createChatCompletion(request, openrouterProvider, mockKey, mockContext)

      const headers = mockFetch.mock.calls[0][1].headers
      expect(headers['HTTP-Referer']).toBe('https://babel-feed.app')
      expect(headers['X-Title']).toBe('Babel Feed')
    })

    it('uses default headers when no provider-specific headers are configured', async () => {
      const basicProvider = { 
        ...mockProvider, 
        name: 'basic-provider',
        metadata: {} // No auth headers
      }
      
      const mockResponse: ChatCompletionResponse = {
        id: 'test-id',
        object: 'chat.completion',
        created: Math.floor(Date.now() / 1000),
        model: 'gpt-3.5-turbo',
        choices: [{ 
          index: 0,
          message: { role: 'assistant', content: 'test', tool_calls: undefined },
          finish_reason: 'stop'
        }]
      }
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockResponse
      })

      const request: ChatCompletionRequest = {
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: 'Hello' }]
      }

      await httpClient.createChatCompletion(request, basicProvider, mockKey, mockContext)

      const headers = mockFetch.mock.calls[0][1].headers
      expect(headers['Authorization']).toBe('Bearer test-api-key')
      expect(headers['Content-Type']).toBe('application/json')
      expect(headers['HTTP-Referer']).toBeUndefined()
    })

    it('handles HTTP errors correctly', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        statusText: 'Too Many Requests',
        json: async () => ({
          error: {
            message: 'Rate limit exceeded',
            type: 'rate_limit_exceeded',
            code: 'rate_limit'
          }
        })
      })

      const request: ChatCompletionRequest = {
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: 'Hello' }]
      }

      await expect(httpClient.createChatCompletion(request, mockProvider, mockKey, mockContext))
        .rejects.toThrow('Rate limit exceeded')
    })

    it('handles network timeouts', async () => {
      mockFetch.mockImplementation(() => 
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('TimeoutError')), 100)
        )
      )

      const request: ChatCompletionRequest = {
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: 'Hello' }]
      }

      await expect(httpClient.createChatCompletion(request, mockProvider, mockKey, mockContext))
        .rejects.toThrow()
    })

    it('validates response format', async () => {
      const invalidResponses = [
        {}, // Missing required fields
        { id: 'test' }, // Missing choices
        { id: 'test', choices: [] }, // Empty choices
        { id: 'test', choices: [{}] }, // Invalid choice structure
      ]

      for (const invalidResponse of invalidResponses) {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => invalidResponse
        })

        const request: ChatCompletionRequest = {
          model: 'gpt-3.5-turbo',
          messages: [{ role: 'user', content: 'Hello' }]
        }

        await expect(httpClient.createChatCompletion(request, mockProvider, mockKey, mockContext))
          .rejects.toThrow('Invalid response format')
      }
    })
  })

  describe('Streaming Chat Completion', () => {
    it('streams chat completion successfully', async () => {
      const streamChunks: ChatCompletionStreamResponse[] = [
        {
          id: 'chatcmpl-stream',
          object: 'chat.completion.chunk',
          created: Math.floor(Date.now() / 1000),
          model: 'gpt-3.5-turbo',
          choices: [{
            index: 0,
            delta: { role: 'assistant', content: 'Hello' },
            finish_reason: null
          }]
        },
        {
          id: 'chatcmpl-stream',
          object: 'chat.completion.chunk',
          created: Math.floor(Date.now() / 1000),
          model: 'gpt-3.5-turbo',
          choices: [{
            index: 0,
            delta: { content: ' world!' },
            finish_reason: null
          }]
        },
        {
          id: 'chatcmpl-stream',
          object: 'chat.completion.chunk',
          created: Math.floor(Date.now() / 1000),
          model: 'gpt-3.5-turbo',
          choices: [{
            index: 0,
            delta: {},
            finish_reason: 'stop'
          }]
        }
      ]

      const streamData = streamChunks
        .map(chunk => `data: ${JSON.stringify(chunk)}\n\n`)
        .join('') + 'data: [DONE]\n\n'

      const mockStream = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode(streamData))
          controller.close()
        }
      })

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        body: mockStream
      })

      const request: ChatCompletionRequest = {
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: 'Hello' }],
        stream: true
      }

      const chunks: ChatCompletionStreamResponse[] = []
      for await (const chunk of httpClient.streamChatCompletion(request, mockProvider, mockKey, mockContext)) {
        chunks.push(chunk)
      }

      expect(chunks).toHaveLength(3)
      expect(chunks[0].choices[0].delta.content).toBe('Hello')
      expect(chunks[1].choices[0].delta.content).toBe(' world!')
      expect(chunks[2].choices[0].finish_reason).toBe('stop')

      // Verify stream=true was set in request
      const body = JSON.parse(mockFetch.mock.calls[0][1].body)
      expect(body.stream).toBe(true)
    })

    it('handles malformed SSE chunks gracefully', async () => {
      const streamData = 
        'data: {"id":"test","object":"chat.completion.chunk","choices":[{"delta":{"content":"good"}}]}\n\n' +
        'data: invalid json\n\n' + // This should be skipped
        'data: {"id":"test","object":"chat.completion.chunk","choices":[{"delta":{"content":"chunk"}}]}\n\n' +
        'data: [DONE]\n\n'

      const mockStream = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode(streamData))
          controller.close()
        }
      })

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        body: mockStream
      })

      const request: ChatCompletionRequest = {
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: 'Hello' }],
        stream: true
      }

      const chunks: ChatCompletionStreamResponse[] = []
      for await (const chunk of httpClient.streamChatCompletion(request, mockProvider, mockKey, mockContext)) {
        chunks.push(chunk)
      }

      // Should only get valid chunks, invalid one should be skipped
      expect(chunks).toHaveLength(2)
      expect(chunks[0].choices[0].delta.content).toBe('good')
      expect(chunks[1].choices[0].delta.content).toBe('chunk')
    })

    it('handles streaming errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({
          error: {
            message: 'Internal server error',
            type: 'server_error'
          }
        })
      })

      const request: ChatCompletionRequest = {
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: 'Hello' }],
        stream: true
      }

      await expect((async () => {
        for await (const _chunk of httpClient.streamChatCompletion(request, mockProvider, mockKey, mockContext)) {
          // Should not reach here
        }
      })()).rejects.toThrow('Internal server error')
    })

    it('handles missing response body for streaming', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        body: null
      })

      const request: ChatCompletionRequest = {
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: 'Hello' }],
        stream: true
      }

      await expect((async () => {
        for await (const _chunk of httpClient.streamChatCompletion(request, mockProvider, mockKey, mockContext)) {
          // Should not reach here
        }
      })()).rejects.toThrow('No response body for streaming request')
    })
  })

  describe('Error Handling', () => {
    it('wraps unknown errors correctly', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network connection failed'))

      const request: ChatCompletionRequest = {
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: 'Hello' }]
      }

      try {
        await httpClient.createChatCompletion(request, mockProvider, mockKey, mockContext)
      } catch (error: any) {
        expect(error.code).toBeDefined()
        expect(error.retryable).toBeDefined()
        expect(error.provider).toBe('openrouter')
        expect(error.requestId).toBe('test-request-123')
      }
    })

    it('identifies retryable errors correctly', async () => {
      const retryableCases = [
        { status: 500, expected: true },
        { status: 502, expected: true },
        { status: 503, expected: true },
        { status: 429, expected: true },
        { status: 400, expected: false },
        { status: 401, expected: false },
        { status: 403, expected: false }
      ]

      for (const { status, expected } of retryableCases) {
        mockFetch.mockResolvedValueOnce({
          ok: false,
          status,
          statusText: 'Error',
          json: async () => ({ error: { message: 'Test error' } })
        })

        try {
          await httpClient.createChatCompletion({
            model: 'gpt-3.5-turbo',
            messages: [{ role: 'user', content: 'Hello' }]
          }, mockProvider, mockKey, mockContext)
        } catch (error: any) {
          expect(error.retryable).toBe(expected)
        }
      }
    })

    it('identifies rate limit and quota errors', async () => {
      const testCases = [
        {
          status: 429,
          body: { error: { type: 'insufficient_quota' } },
          expectedQuotaExceeded: true,
          expectedRateLimited: true
        },
        {
          status: 429,
          body: { error: { code: 'quota_exceeded' } },
          expectedQuotaExceeded: true,
          expectedRateLimited: true
        },
        {
          status: 429,
          body: { error: { message: 'Rate limit exceeded' } },
          expectedQuotaExceeded: false,
          expectedRateLimited: true
        }
      ]

      for (const { status, body, expectedQuotaExceeded, expectedRateLimited } of testCases) {
        mockFetch.mockResolvedValueOnce({
          ok: false,
          status,
          statusText: 'Too Many Requests',
          json: async () => body
        })

        try {
          await httpClient.createChatCompletion({
            model: 'gpt-3.5-turbo',
            messages: [{ role: 'user', content: 'Hello' }]
          }, mockProvider, mockKey, mockContext)
        } catch (error: any) {
          expect(error.rateLimited).toBe(expectedRateLimited)
          expect(error.quotaExceeded).toBe(expectedQuotaExceeded)
        }
      }
    })
  })

  describe('Configuration', () => {
    it('respects timeout configuration', () => {
      const customClient = new LlmHttpClient({ timeout: 10000 })
      expect(customClient['timeout']).toBe(10000)
    })

    it('respects retry configuration', () => {
      const customClient = new LlmHttpClient({ 
        timeout: 5000,
        userAgent: 'Test-Agent/1.0'
      })
      expect(customClient['timeout']).toBe(5000)
      expect(customClient['userAgent']).toBe('Test-Agent/1.0')
    })

    it('respects user agent configuration', () => {
      const customClient = new LlmHttpClient({ userAgent: 'Custom-Agent/2.0' })
      expect(customClient['userAgent']).toBe('Custom-Agent/2.0')
    })
  })
})