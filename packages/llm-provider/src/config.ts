import { logger } from '@babel-feed/utils'
import type { AiProvider, AiProviderKey } from './types.js'

export interface ProviderConfiguration {
  enabled: boolean
  apiKeys: string[]
  baseUrl: string
  models?: string[]
  maxTokens?: number
  temperatureRange?: { min: number; max: number }
  rateLimits: {
    requestsPerMinute: number
    requestsPerHour: number
    requestsPerDay: number
  }
  features: {
    streaming: boolean
    tools: boolean
    jsonMode: boolean
    logprobs: boolean
  }
  transforms?: {
    removeParams?: string[]
    defaults?: Record<string, unknown>
    paramMappings?: Record<string, string>
    modelPrefix?: string
    requiresSystemMessage?: boolean
    defaultSystemMessage?: string
    tokenLimits?: Record<string, number>
    finishReasonMappings?: Record<string, string>
  }
  authHeaders?: Record<string, string>
}

export interface LlmProviderConfig {
  providers: {
    openrouter?: ProviderConfiguration
    kimi?: ProviderConfiguration
    [key: string]: ProviderConfiguration | undefined
  }
  defaults: {
    timeout: number
    retryAttempts: number
    retryDelay: number
    circuitBreakerThreshold: number
    circuitBreakerTimeout: number
  }
}

export class ConfigManager {
  private static instance: ConfigManager
  private config: LlmProviderConfig

  private constructor() {
    this.config = this.loadConfig()
  }

  static getInstance(): ConfigManager {
    if (!ConfigManager.instance) {
      ConfigManager.instance = new ConfigManager()
    }
    return ConfigManager.instance
  }

  private loadConfig(): LlmProviderConfig {
    // Load from environment variables with sensible defaults
    const config: LlmProviderConfig = {
      providers: {
        openrouter: {
          enabled: process.env.OPENROUTER_ENABLED === 'true' || !!process.env.OPENROUTER_API_KEY,
          apiKeys: this.parseApiKeys(process.env.OPENROUTER_API_KEY),
          baseUrl: process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1',
          models: this.parseModels(process.env.OPENROUTER_MODELS),
          maxTokens: parseInt(process.env.OPENROUTER_MAX_TOKENS || '200000', 10),
          temperatureRange: { min: 0, max: 2 },
          rateLimits: {
            requestsPerMinute: parseInt(process.env.OPENROUTER_RPM || '60', 10),
            requestsPerHour: parseInt(process.env.OPENROUTER_RPH || '3600', 10),
            requestsPerDay: parseInt(process.env.OPENROUTER_RPD || '86400', 10)
          },
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
            modelPrefix: 'auto' // Auto-detect and add provider prefix
          },
          authHeaders: {
            'HTTP-Referer': 'https://babel-feed.app',
            'X-Title': 'Babel Feed'
          }
        },
        kimi: {
          enabled: process.env.KIMI_ENABLED === 'true' || !!process.env.KIMI_API_KEY,
          apiKeys: this.parseApiKeys(process.env.KIMI_API_KEY),
          baseUrl: process.env.KIMI_BASE_URL || 'https://api.moonshot.cn/v1',
          models: this.parseModels(process.env.KIMI_MODELS) || ['moonshot-v1-8k', 'moonshot-v1-32k', 'moonshot-v1-128k'],
          maxTokens: parseInt(process.env.KIMI_MAX_TOKENS || '4096', 10),
          temperatureRange: { min: 0, max: 1 },
          rateLimits: {
            requestsPerMinute: parseInt(process.env.KIMI_RPM || '30', 10),
            requestsPerHour: parseInt(process.env.KIMI_RPH || '1800', 10),
            requestsPerDay: parseInt(process.env.KIMI_RPD || '43200', 10)
          },
          features: {
            streaming: true,
            tools: true,
            jsonMode: false, // Kimi doesn't explicitly support JSON mode
            logprobs: false
          },
          transforms: {
            removeParams: ['logit_bias', 'seed', 'response_format', 'user'],
            defaults: {
              temperature: 0.3,
              max_tokens: 1024
            },
            requiresSystemMessage: true,
            defaultSystemMessage: 'You are a helpful AI assistant. Please provide accurate and helpful responses.',
            tokenLimits: {
              'moonshot-v1-8k': 4096,
              'moonshot-v1-32k': 4096,
              'moonshot-v1-128k': 4096
            },
            finishReasonMappings: {
              'end_turn': 'stop',
              'max_tokens': 'length',
              'function_call': 'tool_calls',
              'filtered': 'content_filter'
            }
          }
        }
      },
      defaults: {
        timeout: parseInt(process.env.LLM_TIMEOUT || '30000', 10),
        retryAttempts: parseInt(process.env.LLM_RETRY_ATTEMPTS || '3', 10),
        retryDelay: parseInt(process.env.LLM_RETRY_DELAY || '1000', 10),
        circuitBreakerThreshold: parseInt(process.env.LLM_CB_THRESHOLD || '5', 10),
        circuitBreakerTimeout: parseInt(process.env.LLM_CB_TIMEOUT || '60000', 10)
      }
    }

    logger.debug('LLM provider configuration loaded', {
      openrouterEnabled: config.providers.openrouter?.enabled,
      kimiEnabled: config.providers.kimi?.enabled,
      openrouterKeyCount: config.providers.openrouter?.apiKeys.length || 0,
      kimiKeyCount: config.providers.kimi?.apiKeys.length || 0
    })

    return config
  }

  private parseApiKeys(envVar?: string): string[] {
    if (!envVar) return []
    
    // Support comma-separated or newline-separated API keys
    return envVar
      .split(/[,\n]/)
      .map(key => key.trim())
      .filter(key => key.length > 0)
  }

  private parseModels(envVar?: string): string[] | undefined {
    if (!envVar) return undefined
    
    return envVar
      .split(',')
      .map(model => model.trim())
      .filter(model => model.length > 0)
  }

  getConfig(): LlmProviderConfig {
    return this.config
  }

  getProviderConfig(providerName: string): ProviderConfiguration | undefined {
    const normalizedName = providerName.toLowerCase()
    
    if (normalizedName.includes('openrouter')) {
      return this.config.providers.openrouter
    }
    
    if (normalizedName.includes('kimi') || normalizedName.includes('moonshot')) {
      return this.config.providers.kimi
    }
    
    return undefined
  }

  isProviderEnabled(providerName: string): boolean {
    const config = this.getProviderConfig(providerName)
    return config?.enabled === true && config?.apiKeys?.length > 0
  }

  getProviderApiKeys(providerName: string): string[] {
    const config = this.getProviderConfig(providerName)
    return config?.apiKeys || []
  }

  /**
   * Generate provider configurations for database seeding
   */
  generateProviderConfigs(): Array<{
    provider: Omit<AiProvider, 'id' | 'createdAt' | 'updatedAt'>
    keys: Array<Omit<AiProviderKey, 'id' | 'providerId' | 'createdAt' | 'updatedAt'>>
  }> {
    const configs: Array<{
      provider: Omit<AiProvider, 'id' | 'createdAt' | 'updatedAt'>
      keys: Array<Omit<AiProviderKey, 'id' | 'providerId' | 'createdAt' | 'updatedAt'>>
    }> = []

    // Generate configs for all enabled providers
    Object.entries(this.config.providers).forEach(([providerName, providerConfig]) => {
      if (!providerConfig?.enabled) return

      configs.push({
        provider: {
          name: providerName,
          displayName: this.getDisplayName(providerName),
          providerType: this.getProviderType(providerName),
          baseUrl: providerConfig.baseUrl,
          enabled: true,
          priority: this.getDefaultPriority(providerName),
          maxRequestsPerMinute: providerConfig.rateLimits.requestsPerMinute,
          maxRequestsPerHour: providerConfig.rateLimits.requestsPerHour,
          maxRequestsPerDay: providerConfig.rateLimits.requestsPerDay,
          circuitBreakerThreshold: this.config.defaults.circuitBreakerThreshold,
          circuitBreakerTimeout: this.config.defaults.circuitBreakerTimeout,
          metadata: {
            models: providerConfig.models || ['*'],
            maxTokens: providerConfig.maxTokens,
            temperatureRange: providerConfig.temperatureRange,
            features: providerConfig.features,
            transforms: providerConfig.transforms,
            authHeaders: providerConfig.authHeaders
          }
        },
        keys: providerConfig.apiKeys.map((apiKey, index) => ({
          keyName: `${providerName}-key-${index + 1}`,
          keyValue: apiKey,
          apiKey: apiKey,
          enabled: true,
          successCount: 0,
          errorCount: 0,
          rateLimitHits: 0
        }))
      })
    })

    return configs
  }

  private getDisplayName(providerName: string): string {
    const displayNames: Record<string, string> = {
      openrouter: 'OpenRouter',
      kimi: 'Kimi (Moonshot)',
    }
    return displayNames[providerName] || providerName.charAt(0).toUpperCase() + providerName.slice(1)
  }

  private getProviderType(providerName: string): string {
    const types: Record<string, string> = {
      openrouter: 'content_analysis',
      kimi: 'translation',
    }
    return types[providerName] || 'general'
  }

  private getDefaultPriority(providerName: string): number {
    const priorities: Record<string, number> = {
      openrouter: 10,
      kimi: 8,
    }
    return priorities[providerName] || 5
  }

  /**
   * Validate configuration and log issues
   */
  validateConfig(): { valid: boolean; issues: string[] } {
    const issues: string[] = []
    let valid = true

    // Check if at least one provider is enabled
    const enabledProviders = Object.values(this.config.providers).filter(p => p?.enabled)
    if (enabledProviders.length === 0) {
      issues.push('No providers are enabled. Please configure at least one provider.')
      valid = false
    }

    // Validate each enabled provider
    for (const [name, config] of Object.entries(this.config.providers)) {
      if (config?.enabled) {
        if (!config.apiKeys || config.apiKeys.length === 0) {
          issues.push(`${name} is enabled but has no API keys configured`)
          valid = false
        }
        
        if (!config.baseUrl) {
          issues.push(`${name} is enabled but has no base URL configured`)
          valid = false
        }
      }
    }

    // Validate defaults
    if (this.config.defaults.timeout < 1000) {
      issues.push('Timeout should be at least 1000ms')
    }

    if (this.config.defaults.retryAttempts < 0 || this.config.defaults.retryAttempts > 10) {
      issues.push('Retry attempts should be between 0 and 10')
    }

    return { valid, issues }
  }
}

// Export singleton instance
export const configManager = ConfigManager.getInstance()

// Export configuration loading function
export function loadLlmProviderConfig(): LlmProviderConfig {
  return configManager.getConfig()
}