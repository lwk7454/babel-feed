import { config } from 'dotenv'
import { aiProviders, aiProviderKeys } from "@babel-feed/pgdb"
import { AiProviderManager } from "./src"
import { join } from 'path'

// You shoud create a .env file in the same directory as this file and add the OPENROUTER_API_KEY
config({ path: join(__dirname, '.env') })

const manager = new AiProviderManager()
await manager.initialize()

// Insert the provider
const [newProvider] = await manager['db']!.insert(aiProviders).values({
  name: 'openrouter-kimi-k2',
  displayName: 'OpenRouter - Kimi K2',
  providerType: 'content_analysis',
  baseUrl: 'https://openrouter.ai/api/v1',
  enabled: true,
  priority: 8,
  maxRequestsPerMinute: 60,
  maxRequestsPerHour: 1000,
  maxRequestsPerDay: 10000,
  circuitBreakerThreshold: 5,
  circuitBreakerTimeout: 60000,
  healthCheckInterval: 30000,
  metadata: {
    models: ['moonshot/kimi-k2'],
    maxTokens: 32768,
    features: {
      streaming: true,
      tools: true,
      jsonMode: true
    },
    authHeaders: {
      'HTTP-Referer': 'https://babel-feed.app',
      'X-Title': 'Babel Feed'
    }
  }
}).returning()

// Insert the API key for the provider
await manager['db']!.insert(aiProviderKeys).values({
  providerId: newProvider.id,
  keyName: 'openrouter-api-key',
  apiKey: process.env.OPENROUTER_API_KEY || 'your-openrouter-api-key-here',
  enabled: true,
  priority: 10,
  currentUsage: 0,
  dailyQuota: 1000,
  monthlyQuota: 10000,
  successCount: 0,
  errorCount: 0,
  rateLimitHits: 0
})

console.log(`✅ Added provider: ${newProvider.displayName} (${newProvider.id})`)
console.log(`✅ Added API key for provider: ${newProvider.id}`)