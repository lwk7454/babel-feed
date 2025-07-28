# @babel-feed/llm-provider

Production-ready LLM provider management with OpenAI API compatibility, circuit breakers, and failover support.

## Features

- **OpenAI API Compatibility**: Full support for chat completions and streaming
- **Unified Provider Support**: Any OpenAI-compatible provider with configuration-based customization
- **Pre-configured Providers**: OpenRouter and Kimi (Moonshot) with optimized settings
- **Circuit Breaker Pattern**: Automatic failover and recovery with configurable thresholds
- **Rate Limiting**: Intelligent rate limit handling and quota management
- **Key Rotation**: Automatic rotation between multiple API keys per provider
- **Streaming Support**: Server-sent events for real-time responses
- **Configuration-Based**: All provider differences handled through configuration, not code
- **Database Integration**: PostgreSQL-based provider and key management
- **Comprehensive Testing**: Full test coverage with BDD-style tests
- **TypeScript**: Fully typed with comprehensive type definitions

## Quick Start

```typescript
import { LlmClient } from '@babel-feed/llm-provider'

// Initialize client
const client = new LlmClient({
  timeout: 30000,
  retryAttempts: 3,
  retryDelay: 1000
})

await client.initialize()

// Create chat completion
const response = await client.createChatCompletion({
  model: 'gpt-3.5-turbo',
  messages: [
    { role: 'user', content: 'Hello, how are you?' }
  ],
  max_tokens: 100,
  temperature: 0.7
})

console.log(response.choices[0].message.content)
```

## Environment Configuration

```bash
# Global Settings (only these are needed)
LLM_TIMEOUT=30000
LLM_RETRY_ATTEMPTS=3
LLM_RETRY_DELAY=1000
LLM_CB_THRESHOLD=5
LLM_CB_TIMEOUT=60000
```

## Database Configuration

All LLM providers are configured through the database. Use the `add-provider.ts` script to add new providers:

```bash
# Create a .env file with your API key
echo "OPENROUTER_API_KEY=your-api-key-here" > packages/llm-provider/.env

# Run the script to add a provider
cd packages/llm-provider
bun run add-provider.ts
```

Or manually insert providers and keys into the database using the `AiProviderManager`:

```typescript
import { AiProviderManager } from '@babel-feed/llm-provider'

const manager = new AiProviderManager()
await manager.initialize()

// Add providers and keys programmatically
// See add-provider.ts for example implementation
```

## Usage Examples

### Basic Chat Completion

```typescript
import { LlmClient } from '@babel-feed/llm-provider'

const client = new LlmClient()
await client.initialize()

const response = await client.createChatCompletion({
  model: 'gpt-3.5-turbo',
  messages: [
    { role: 'system', content: 'You are a helpful assistant.' },
    { role: 'user', content: 'Explain quantum physics in simple terms' }
  ],
  max_tokens: 500,
  temperature: 0.3
})

console.log(response.choices[0].message.content)
```

### Streaming Chat Completion

```typescript
const request = {
  model: 'gpt-4',
  messages: [
    { role: 'user', content: 'Write a short story about time travel' }
  ],
  stream: true
}

let fullResponse = ''
for await (const chunk of client.streamChatCompletion(request)) {
  const content = chunk.choices[0]?.delta?.content
  if (content) {
    fullResponse += content
    process.stdout.write(content)
  }
  
  if (chunk.choices[0]?.finish_reason === 'stop') {
    break
  }
}
```

### Provider Type Preferences

```typescript
// Use content analysis providers for content processing
const analysisResponse = await client.createChatCompletionWithProviderType({
  model: 'gpt-4',
  messages: [
    { role: 'user', content: 'Analyze the sentiment of this text: "I love this product!"' }
  ]
}, 'content_analysis')

// Use translation providers for language tasks
const translationResponse = await client.createChatCompletionWithProviderType({
  model: 'moonshot-v1-8k',
  messages: [
    { role: 'user', content: 'Translate "Hello world" to Chinese' }
  ]
}, 'translation')
```

### Provider Health Monitoring

```typescript
const health = await client.getProviderHealth()

for (const [providerName, status] of Object.entries(health)) {
  console.log(`${providerName}: ${status.healthy ? 'Healthy' : 'Unhealthy'}`)
  console.log(`  Circuit State: ${status.circuitState}`)
  console.log(`  Available Keys: ${status.availableKeys}/${status.totalKeys}`)
  console.log(`  Error Rate: ${(status.errorRate * 100).toFixed(1)}%`)
}
```

### Direct Provider Manager Usage

```typescript
import { AiProviderManager } from '@babel-feed/llm-provider'

const manager = new AiProviderManager()
await manager.initialize()

// Get providers by type
const contentProviders = await manager.getEnabledProviders('content_analysis')
const translationProviders = await manager.getEnabledProviders('translation')

// Execute with specific provider
const result = await manager.executeWithProvider('openrouter-provider-id', async (provider, key) => {
  // Your custom logic here
  return 'Custom operation result'
})
```

## Architecture

### Core Components

- **LlmClient**: High-level client for easy usage
- **AiProviderManager**: Database-backed provider management
- **OpenAIAdapter**: Unified adapter for all OpenAI-compatible providers
- **LlmHttpClient**: HTTP client with retry and error handling
- **CircuitBreaker**: Automatic failover protection
- **ConfigManager**: Environment-based configuration management

### Provider Configuration

All providers use the same OpenAI-compatible interface. Provider configurations are stored in the database and can be managed through the `AiProviderManager`:

```typescript
import { AiProviderManager } from '@babel-feed/llm-provider'

const manager = new AiProviderManager()
await manager.initialize()

// Get all enabled providers
const providers = await manager.getEnabledProviders()

// Get providers by type
const translationProviders = await manager.getEnabledProviders('translation')
const contentProviders = await manager.getEnabledProviders('content_analysis')
```

### Adding New Providers

To add a new OpenAI-compatible provider, use the database:

```typescript
// Add provider to database
const [provider] = await manager['db']!.insert(aiProviders).values({
  name: 'my-provider',
  displayName: 'My Provider',
  providerType: 'translation',
  baseUrl: 'https://api.myprovider.com/v1',
  enabled: true,
  priority: 5,
  maxRequestsPerMinute: 60,
  maxRequestsPerHour: 3600,
  maxRequestsPerDay: 86400,
  circuitBreakerThreshold: 5,
  circuitBreakerTimeout: 60000,
  metadata: {
    models: ['my-model-1', 'my-model-2'],
    maxTokens: 4096,
    features: {
      streaming: true,
      tools: true,
      jsonMode: true
    }
  }
}).returning()

// Add API keys
await manager['db']!.insert(aiProviderKeys).values({
  providerId: provider.id,
  keyName: 'my-provider-key',
  apiKey: 'your-api-key',
  enabled: true,
  priority: 10
})
```

Or use the `add-provider.ts` script for quick setup.

## Error Handling

The package provides structured error handling with retryable error detection:

```typescript
import { LlmClient, LlmProviderError } from '@babel-feed/llm-provider'

const client = new LlmClient()
await client.initialize()

try {
  const response = await client.createChatCompletion(request)
  // Handle success
} catch (error) {
  if (error instanceof LlmProviderError) {
    console.log('Provider error:', {
      code: error.code,
      statusCode: error.statusCode,
      message: error.message
    })
  } else {
    console.log('Unexpected error:', error.message)
  }
}
```

## Circuit Breaker Pattern

Automatic circuit breaker protection prevents cascade failures:

```typescript
// Circuit breaker states:
// - closed: Normal operation
// - open: Provider is down, requests fail fast
// - half-open: Testing if provider has recovered

const health = await client.getProviderHealth()
console.log(`Provider circuit state: ${health['OpenRouter'].circuitState}`)
```

## Database Integration

The provider manager uses PostgreSQL for persistence:

- **Providers**: Configuration, priorities, rate limits
- **API Keys**: Multiple keys per provider with rotation
- **Circuit Breakers**: State tracking and automatic recovery
- **Usage Metrics**: Success/error counts, rate limit tracking

### Database Schema

The package integrates with `@babel-feed/pgdb` for database operations:

- `aiProviders` table: Provider configuration and metadata
- `aiProviderKeys` table: API keys with usage tracking
- Automatic schema management with push mode

```

### Running Tests

```bash
# Run all tests
bun test

# Run specific test file
bun test llm-client.test.ts

# Run with coverage
bun test --coverage
```

## Production Deployment

1. **Environment Variables**: Set all required environment variables
2. **Database**: Ensure PostgreSQL is available and schema is up to date
3. **Monitoring**: Use provider health endpoints for monitoring
4. **Rate Limits**: Configure appropriate rate limits per provider
5. **Circuit Breakers**: Tune thresholds based on provider reliability

## API Reference

### LlmClient

- `createChatCompletion(request)` - Create chat completion
- `streamChatCompletion(request)` - Stream chat completion  
- `createChatCompletionWithProviderType(request, type)` - Use specific provider type
- `getProviderHealth()` - Get provider health status
- `getProviderManager()` - Get underlying provider manager

### AiProviderManager

- `getAllProviders()` - Get all providers
- `getEnabledProviders(type?)` - Get enabled providers by type
- `getProviderKeys(providerId)` - Get keys for a provider
- `executeWithProvider(id, callback)` - Execute with specific provider
- `getProviderHealth(id)` - Get provider health status
- `bulkEnableProviders(ids)` - Enable multiple providers
- `bulkDisableProviders(ids)` - Disable multiple providers

### OpenAIAdapter

- `createChatCompletion(request, provider, key, context)` - Create completion
- `streamChatCompletion(request, provider, key, context)` - Stream completion
- `validateRequest(request, provider)` - Validate request against provider
- `transformRequest(request, provider)` - Transform request for provider
- `transformResponse(response, provider)` - Normalize response

### Configuration

- `configManager` - Global configuration manager
- `loadLlmProviderConfig()` - Load configuration from environment
- `validateConfig()` - Validate configuration

### Types

- `ChatCompletionRequest` - OpenAI-compatible request
- `ChatCompletionResponse` - OpenAI-compatible response
- `ChatCompletionStreamResponse` - Streaming response
- `AiProvider` - Provider configuration
- `AiProviderKey` - API key configuration
- `LlmProviderError` - Error class with additional context

## Dependencies

- `@babel-feed/pgdb` - Database integration
- `@babel-feed/utils` - Logging utilities
- `drizzle-orm` - Database ORM
- `@sinonjs/fake-timers` - Testing utilities

## Development

### Building

```bash
# Build the package
nx build llm-provider

# Type check
nx type-check llm-provider

# Lint
nx lint llm-provider
```

### Project Structure

```
src/
├── ai-provider-manager.ts    # Provider management and database operations
├── circuit-breaker.ts        # Circuit breaker implementation
├── config.ts                 # Configuration management
├── http-client.ts           # HTTP client with retry logic
├── index.ts                 # Public exports
├── llm-client.ts            # High-level client interface
├── openai-adapter.ts        # Unified OpenAI adapter
└── types.ts                 # TypeScript type definitions

tests/
├── circuit-breaker.test.ts   # Circuit breaker tests
├── http-client.test.ts      # HTTP client tests
├── llm-client.test.ts       # Client integration tests
├── manager.test.ts          # Provider manager tests
├── openai-adapter.test.ts   # Adapter tests
└── helpers/                 # Test utilities
```

## License

MIT License - see LICENSE file for details.