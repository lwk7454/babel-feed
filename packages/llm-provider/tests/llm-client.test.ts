import { clearTestData } from '@babel-feed/pgdb'
import { createTestTimers } from '@babel-feed/utils'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, mock } from 'bun:test'
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

const timer = createTestTimers({ now: 0, shouldAdvanceTime: true, advanceTimeDelta: 20 })

describe('LlmClient', () => {
  let client: LlmClient
  beforeEach(async () => {
    await clearTestData()
    client = new LlmClient({
      timeout: 5000,
      retryAttempts: 2,
      retryDelay: 100
    })
    await client.initialize()
    mockFetch.mockClear()
    timer.reset()
    
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
  })

  afterEach(async () => {
    mockFetch.mockClear()
    // Restore original setTimeout
    global.setTimeout = setTimeout
  })

  describe('Chat Completion', () => {
    it('creates chat completion successfully', async () => {
      const mockResponse: ChatCompletionResponse = {
        id: 'chatcmpl-test',
        object: 'chat.completion',
        created: Math.floor(Date.now() / 1000),
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

      const response = await client.createChatCompletion(request)

      expect(response).toBeDefined()
      expect(response.id).toBe('chatcmpl-test')
      expect(response.choices).toHaveLength(1)
      expect(response.choices[0].message.content).toBe('Hello! How can I help you today?')
      expect(response.usage?.total_tokens).toBe(30)
    })

    it('handles provider failover correctly', async () => {
      // First provider fails
      mockFetch.mockRejectedValueOnce(new Error('Provider 1 failed'))
      
      // Second provider succeeds
      const mockResponse: ChatCompletionResponse = {
        id: 'chatcmpl-failover',
        object: 'chat.completion',
        created: Math.floor(Date.now() / 1000),
        model: 'gpt-3.5-turbo',
        choices: [{
          index: 0,
          message: {
            role: 'assistant',
            content: 'Failover successful',
            tool_calls: undefined
          },
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
        messages: [{ role: 'user', content: 'Test failover' }]
      }

      const response = await client.createChatCompletion(request)
      expect(response.choices[0].message.content).toBe('Failover successful')
    })

    it('handles rate limiting with retry', async () => {
      // First call gets rate limited
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        json: async () => ({
          error: {
            message: 'Rate limit exceeded',
            type: 'rate_limit_exceeded',
            code: 'rate_limit_exceeded'
          }
        })
      })

      // Second call succeeds
      const mockResponse: ChatCompletionResponse = {
        id: 'chatcmpl-retry',
        object: 'chat.completion',
        created: Math.floor(Date.now() / 1000),
        model: 'gpt-3.5-turbo',
        choices: [{
          index: 0,
          message: {
            role: 'assistant',
            content: 'Retry successful',
            tool_calls: undefined
          },
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
        messages: [{ role: 'user', content: 'Test retry' }]
      }

      const response = await client.createChatCompletion(request)
      expect(response.choices[0].message.content).toBe('Retry successful')
    })

    it('throws error when all providers fail', async () => {
      mockFetch.mockRejectedValue(new Error('All providers failed'))

      const request: ChatCompletionRequest = {
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: 'This should fail' }]
      }

      await expect(client.createChatCompletion(request)).rejects.toThrow('All retries exhausted')
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
            delta: { content: ' there!' },
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

      const stream = client.streamChatCompletion(request)
      await expect(stream.next()).rejects.toThrow('Streaming failed')
    })
  })

  describe('Provider Type Preferences', () => {
    it('uses content analysis providers for content analysis', async () => {
      const mockResponse: ChatCompletionResponse = {
        id: 'chatcmpl-content',
        object: 'chat.completion',
        created: Math.floor(Date.now() / 1000),
        model: 'gpt-4',
        choices: [{
          index: 0,
          message: {
            role: 'assistant',
            content: 'Content analysis result',
            tool_calls: undefined
          },
          finish_reason: 'stop'
        }]
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockResponse
      })

      const request: ChatCompletionRequest = {
        model: 'gpt-4',
        messages: [{ role: 'user', content: 'Analyze this content' }]
      }

      const response = await client.createChatCompletionWithProviderType(request, 'content_analysis')
      expect(response.choices[0].message.content).toBe('Content analysis result')
    })

    it('falls back to general providers when type-specific providers fail', async () => {
      // First call to content_analysis provider fails
      mockFetch.mockRejectedValueOnce(new Error('Content analysis provider failed'))
      
      // Fallback to general provider succeeds
      const mockResponse: ChatCompletionResponse = {
        id: 'chatcmpl-fallback',
        object: 'chat.completion',
        created: Math.floor(Date.now() / 1000),
        model: 'gpt-3.5-turbo',
        choices: [{
          index: 0,
          message: {
            role: 'assistant',
            content: 'Fallback result',
            tool_calls: undefined
          },
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
        messages: [{ role: 'user', content: 'Test fallback' }]
      }

      const response = await client.createChatCompletionWithProviderType(request, 'content_analysis')
      expect(response.choices[0].message.content).toBe('Fallback result')
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
    it('handles network timeouts', async () => {
      mockFetch.mockImplementation(() => 
        new Promise((_, reject) => {
          // Use fake timer instead of real setTimeout
          timer.clock.setTimeout(() => reject(new Error('Request timeout')), 100)
        })
      )

      const request: ChatCompletionRequest = {
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: 'Timeout test' }]
      }

      await expect(client.createChatCompletion(request)).rejects.toThrow()
    })

    it('handles malformed responses', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ invalid: 'response' })
      })

      const request: ChatCompletionRequest = {
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: 'Malformed response test' }]
      }

      await expect(client.createChatCompletion(request)).rejects.toThrow()
    })

    it('handles authentication errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({
          error: {
            message: 'Invalid API key',
            type: 'invalid_request_error',
            code: 'invalid_api_key'
          }
        })
      })

      const request: ChatCompletionRequest = {
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: 'Auth error test' }]
      }

      await expect(client.createChatCompletion(request)).rejects.toThrow('All retries exhausted')
    })
  })
})