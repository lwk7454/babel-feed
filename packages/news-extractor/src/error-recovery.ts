/**
 * Error recovery system for news-extractor
 * Provides retry logic, fallback strategies, and error handling
 */

import { logger } from './logger'

export interface RetryConfig {
  maxAttempts: number
  backoffMs: number
  backoffMultiplier: number
  maxBackoffMs: number
}

export interface FallbackStrategy<T> {
  name: string
  execute: () => Promise<T>
}

export class ErrorRecovery {
  private static defaultRetryConfig: RetryConfig = {
    maxAttempts: 3,
    backoffMs: 1000,
    backoffMultiplier: 2,
    maxBackoffMs: 10000
  }

  /**
   * Execute function with retry logic
   */
  static async withRetry<T>(
    operation: () => Promise<T>,
    config: Partial<RetryConfig> = {},
    context?: string
  ): Promise<T> {
    const finalConfig = { ...this.defaultRetryConfig, ...config }
    let lastError: Error | null = null
    let backoffMs = finalConfig.backoffMs

    for (let attempt = 1; attempt <= finalConfig.maxAttempts; attempt++) {
      try {
        const result = await operation()
        
        if (attempt > 1) {
          logger.info('ErrorRecovery', `Operation succeeded on attempt ${attempt}`, {
            context,
            attempt,
            totalAttempts: finalConfig.maxAttempts
          })
        }
        
        return result
      } catch (error) {
        lastError = error as Error
        
        logger.warn('ErrorRecovery', `Operation failed on attempt ${attempt}`, {
          context,
          attempt,
          totalAttempts: finalConfig.maxAttempts,
          error: lastError.message
        })

        if (attempt < finalConfig.maxAttempts) {
          await this.delay(backoffMs)
          backoffMs = Math.min(backoffMs * finalConfig.backoffMultiplier, finalConfig.maxBackoffMs)
        }
      }
    }

    logger.error('ErrorRecovery', `All retry attempts failed`, lastError || new Error('Unknown error'), {
      context,
      totalAttempts: finalConfig.maxAttempts
    })
    
    throw lastError
  }

  /**
   * Execute with fallback strategies
   */
  static async withFallbacks<T>(
    strategies: FallbackStrategy<T>[],
    context?: string
  ): Promise<T> {
    const errors: Error[] = []

    for (const strategy of strategies) {
      try {
        logger.debug('ErrorRecovery', `Trying strategy: ${strategy.name}`, { context })
        const result = await strategy.execute()
        
        if (errors.length > 0) {
          logger.info('ErrorRecovery', `Strategy ${strategy.name} succeeded after ${errors.length} failures`, {
            context,
            strategy: strategy.name
          })
        }
        
        return result
      } catch (error) {
        const err = error as Error
        errors.push(err)
        
        logger.warn('ErrorRecovery', `Strategy ${strategy.name} failed`, {
          context,
          strategy: strategy.name,
          error: err.message
        })
      }
    }

    const finalError = new Error(`All fallback strategies failed: ${errors.map(e => e.message).join('; ')}`)
    logger.error('ErrorRecovery', 'All fallback strategies failed', finalError, {
      context,
      strategiesAttempted: strategies.length,
      errors: errors.map(e => e.message)
    })
    
    throw finalError
  }

  /**
   * Safe execution with error containment
   */
  static async safeExecute<T>(
    operation: () => Promise<T>,
    defaultValue: T,
    context?: string
  ): Promise<T> {
    try {
      return await operation()
    } catch (error) {
      logger.error('ErrorRecovery', `Safe execution failed, returning default value`, error as Error, {
        context,
        defaultValue
      })
      return defaultValue
    }
  }

  /**
   * Execute with timeout
   */
  static async withTimeout<T>(
    operation: () => Promise<T>,
    timeoutMs: number,
    context?: string
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        const error = new Error(`Operation timed out after ${timeoutMs}ms`)
        logger.error('ErrorRecovery', 'Operation timeout', error, {
          context,
          timeoutMs
        })
        reject(error)
      }, timeoutMs)

      operation()
        .then(result => {
          clearTimeout(timer)
          resolve(result)
        })
        .catch(error => {
          clearTimeout(timer)
          reject(error)
        })
    })
  }

  /**
   * Circuit breaker pattern
   */
  static createCircuitBreaker<T>(
    operation: () => Promise<T>,
    failureThreshold = 5,
    resetTimeoutMs = 60000
  ) {
    let failures = 0
    let lastFailureTime = 0
    let state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED'

    return async (context?: string): Promise<T> => {
      const now = Date.now()

      if (state === 'OPEN') {
        if (now - lastFailureTime >= resetTimeoutMs) {
          state = 'HALF_OPEN'
          logger.info('ErrorRecovery', 'Circuit breaker moving to HALF_OPEN', { context })
        } else {
          const error = new Error('Circuit breaker is OPEN')
          logger.warn('ErrorRecovery', 'Circuit breaker preventing execution', { context, state })
          throw error
        }
      }

      try {
        const result = await operation()
        
        if (state === 'HALF_OPEN') {
          state = 'CLOSED'
          failures = 0
          logger.info('ErrorRecovery', 'Circuit breaker reset to CLOSED', { context })
        }
        
        return result
      } catch (error) {
        failures++
        lastFailureTime = now

        if (failures >= failureThreshold) {
          state = 'OPEN'
          logger.error('ErrorRecovery', 'Circuit breaker tripped to OPEN', error as Error, {
            context,
            failures,
            threshold: failureThreshold
          })
        }

        throw error
      }
    }
  }

  private static delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}

/**
 * Decorator for automatic error recovery
 */
export function withErrorRecovery(config?: Partial<RetryConfig>) {
  return function <T extends (...args: any[]) => Promise<any>>(
    target: any,
    propertyKey: string,
    descriptor: TypedPropertyDescriptor<T>
  ) {
    const originalMethod = descriptor.value!

    descriptor.value = async function (this: any, ...args: any[]) {
      return ErrorRecovery.withRetry(
        () => originalMethod.apply(this, args),
        config,
        `${target.constructor.name}.${propertyKey}`
      )
    } as T

    return descriptor
  }
}