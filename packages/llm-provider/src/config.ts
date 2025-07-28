import { logger } from '@babel-feed/utils'

export interface LlmProviderConfig {
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
    // Only load global defaults from environment variables
    // All provider-specific config should come from database
    const config: LlmProviderConfig = {
      defaults: {
        timeout: parseInt(process.env.LLM_TIMEOUT || '30000', 10),
        retryAttempts: parseInt(process.env.LLM_RETRY_ATTEMPTS || '3', 10),
        retryDelay: parseInt(process.env.LLM_RETRY_DELAY || '1000', 10),
        circuitBreakerThreshold: parseInt(process.env.LLM_CB_THRESHOLD || '5', 10),
        circuitBreakerTimeout: parseInt(process.env.LLM_CB_TIMEOUT || '60000', 10)
      }
    }

    logger.debug('LLM provider configuration loaded', {
      timeout: config.defaults.timeout,
      retryAttempts: config.defaults.retryAttempts,
      circuitBreakerThreshold: config.defaults.circuitBreakerThreshold
    })

    return config
  }

  getConfig(): LlmProviderConfig {
    return this.config
  }

  /**
   * Validate global configuration
   */
  validateConfig(): { valid: boolean; issues: string[] } {
    const issues: string[] = []

    // Validate defaults
    if (this.config.defaults.timeout < 1000) {
      issues.push('Timeout should be at least 1000ms')
    }

    if (this.config.defaults.retryAttempts < 0 || this.config.defaults.retryAttempts > 10) {
      issues.push('Retry attempts should be between 0 and 10')
    }

    if (this.config.defaults.circuitBreakerThreshold < 1) {
      issues.push('Circuit breaker threshold should be at least 1')
    }

    if (this.config.defaults.circuitBreakerTimeout < 1000) {
      issues.push('Circuit breaker timeout should be at least 1000ms')
    }

    const valid = issues.length === 0
    return { valid, issues }
  }
}

// Export singleton instance
export const configManager = ConfigManager.getInstance()

// Export configuration loading function
export function loadLlmProviderConfig(): LlmProviderConfig {
  return configManager.getConfig()
}