# @babel-feed/llm-provider

Production-ready LLM provider management with OpenAI API compatibility, circuit breakers, and failover support.

## Features

- **OpenAI API Compatibility**: Full support for chat completions and streaming
- **Unified Provider Support**: Any OpenAI-compatible provider with configuration-based customization
- **Pre-configured Providers**: OpenRouter and Kimi (Moonshot) with optimized settings
- **Circuit Breaker Pattern**: Automatic failover and recovery
- **Rate Limiting**: Intelligent rate limit handling and quota management
- **Key Rotation**: Automatic rotation between multiple API keys per provider
- **Streaming Support**: Server-sent events for real-time responses
- **Configuration-Based**: All provider differences handled through configuration, not code
- **Extensible**: Easy to add new OpenAI-compatible providers via configuration
- **Comprehensive Testing**: Full test coverage with unified adapter testing

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
# OpenRouter Configuration
OPENROUTER_ENABLED=true
OPENROUTER_API_KEY=your-openrouter-key-1,your-openrouter-key-2
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
OPENROUTER_MODELS=openai/gpt-4o-mini,anthropic/claude-3-haiku
OPENROUTER_RPM=60
OPENROUTER_RPH=3600
OPENROUTER_RPD=86400

# Kimi/Moonshot Configuration  
KIMI_ENABLED=true
KIMI_API_KEY=your-kimi-key-1,your-kimi-key-2
KIMI_BASE_URL=https://api.moonshot.cn/v1
KIMI_MODELS=moonshot-v1-8k,moonshot-v1-32k,moonshot-v1-128k
KIMI_RPM=30
KIMI_RPH=1800
KIMI_RPD=43200

# General Settings
LLM_TIMEOUT=30000
LLM_RETRY_ATTEMPTS=3
LLM_RETRY_DELAY=1000
LLM_CB_THRESHOLD=5
LLM_CB_TIMEOUT=60000
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

## Unified OpenAI Adapter

All providers use the same OpenAI-compatible interface with configuration-based customization:

```typescript
import { OpenAIAdapter } from '@babel-feed/llm-provider'

const adapter = new OpenAIAdapter(httpClient, {
  validateRequest: true,    // Validate requests against provider capabilities
  transformRequest: true,   // Apply provider-specific transformations
  transformResponse: true   // Normalize responses to OpenAI format
})

// All providers work the same way - differences are in configuration
const response = await adapter.createChatCompletion(request, provider, key, context)
```

### Provider Configuration Examples

**OpenRouter Configuration** (from environment):
```bash
OPENROUTER_ENABLED=true
OPENROUTER_API_KEY=your-key-1,your-key-2
OPENROUTER_MODELS=openai/gpt-4o-mini,anthropic/claude-3-haiku
```

**Kimi Configuration** (from environment):
```bash
KIMI_ENABLED=true
KIMI_API_KEY=your-kimi-key
KIMI_MODELS=moonshot-v1-8k,moonshot-v1-32k
```

### Adding New Providers

To add a new OpenAI-compatible provider, simply add its configuration:

```bash
# New provider configuration
MY_PROVIDER_ENABLED=true
MY_PROVIDER_API_KEY=your-api-key
MY_PROVIDER_BASE_URL=https://api.myprovider.com/v1
MY_PROVIDER_MODELS=my-model-1,my-model-2
MY_PROVIDER_MAX_TOKENS=4096
```

The system will automatically detect and configure the new provider.

## Error Handling

The package provides structured error handling with retryable error detection:

```typescript
import { LlmClient } from '@babel-feed/llm-provider'

const client = new LlmClient()
await client.initialize()

try {
  const response = await client.createChatCompletion(request)
  // Handle success
} catch (error) {
  if (error.retryable) {
    console.log('Temporary error, can retry:', error.message)
  } else {
    console.log('Permanent error:', error.message)
  }
  
  console.log('Error details:', {
    code: error.code,
    statusCode: error.statusCode,
    provider: error.provider,
    requestId: error.requestId,
    rateLimited: error.rateLimited,
    quotaExceeded: error.quotaExceeded
  })
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

## Advanced Configuration

### Custom HTTP Client

```typescript
import { LlmClient, LlmHttpClient } from '@babel-feed/llm-provider'

const customHttpClient = new LlmHttpClient({
  timeout: 60000,
  retryAttempts: 5,
  retryDelay: 2000,
  userAgent: 'MyApp/1.0'
})

const client = new LlmClient({}, customHttpClient)
```

### Provider Configuration Validation

```typescript
import { configManager } from '@babel-feed/llm-provider'

const validation = configManager.validateConfig()
if (!validation.valid) {
  console.error('Configuration issues:', validation.issues)
}
```

## Testing

The package includes comprehensive test utilities:

```typescript
import { setupTestDatabase, cleanupTestDatabase } from '@babel-feed/pgdb'

// In your tests
beforeEach(async () => {
  await setupTestDatabase()
  // Mock fetch for HTTP requests
  global.fetch = mockFetch
})

afterEach(async () => {
  await cleanupTestDatabase()
})
```

## Database Integration

The provider manager uses PostgreSQL for persistence:

- **Providers**: Configuration, priorities, rate limits
- **API Keys**: Multiple keys per provider with rotation
- **Circuit Breakers**: State tracking and automatic recovery
- **Usage Metrics**: Success/error counts, rate limit tracking

## Production Deployment

1. **Environment Variables**: Set all required environment variables
2. **Database**: Ensure PostgreSQL is available and migrated
3. **Monitoring**: Use provider health endpoints for monitoring
4. **Rate Limits**: Configure appropriate rate limits per provider
5. **Circuit Breakers**: Tune thresholds based on provider reliability

## API Reference

### LlmClient

- `createChatCompletion(request)` - Create chat completion
- `streamChatCompletion(request)` - Stream chat completion  
- `createChatCompletionWithProviderType(request, type)` - Use specific provider type
- `getProviderHealth()` - Get provider health status

### AiProviderManager

- `getAllProviders()` - Get all providers
- `getEnabledProviders(type?)` - Get enabled providers by type
- `executeWithProvider(id, callback)` - Execute with specific provider
- `getProviderHealth(id)` - Get provider health status

### Provider Adapters

- `OpenRouterAdapter` - OpenRouter API adapter
- `KimiAdapter` - Kimi/Moonshot API adapter  
- `createProviderAdapter(name, config?)` - Provider factory

### Configuration

- `configManager` - Global configuration manager
- `loadLlmProviderConfig()` - Load configuration from environment

## License

MIT License - see LICENSE file for details.