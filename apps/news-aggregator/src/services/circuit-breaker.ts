import { logger } from '../modules/common/logger'
import { CircuitBreakerState, CircuitState, CircuitBreakerOptions } from '../modules/common/types'

export class CircuitBreaker {
  private state: CircuitState = 'closed'
  private failureCount = 0
  private nextAttempt?: Date
  private lastFailure?: Date
  constructor(
    private name: string,
    private options: CircuitBreakerOptions
  ) {}

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      if (this.shouldAttemptReset()) {
        this.state = 'half-open'
        logger.info(`Circuit breaker ${this.name} entering half-open state`)
      } else {
        throw new Error(`Circuit breaker ${this.name} is open`)
      }
    }

    try {
      const result = await operation()
      this.onSuccess()
      return result
    } catch (error) {
      this.onFailure(error)
      throw error
    }
  }

  private onSuccess(): void {
    this.failureCount = 0
    // Track success for potential future use
    
    if (this.state === 'half-open') {
      this.state = 'closed'
      logger.info(`Circuit breaker ${this.name} reset to closed state`)
    }
  }

  private onFailure(error: unknown): void {
    this.failureCount++
    this.lastFailure = new Date()
    
    logger.warn(`Circuit breaker ${this.name} failure ${this.failureCount}/${this.options.failureThreshold}:`, error)

    if (this.failureCount >= (this.options.failureThreshold || this.options.threshold)) {
      this.state = 'open'
      this.nextAttempt = new Date(Date.now() + this.options.timeout)
      logger.error(`Circuit breaker ${this.name} opened due to ${this.failureCount} failures`)
    }
  }

  private shouldAttemptReset(): boolean {
    return this.nextAttempt ? Date.now() >= this.nextAttempt.getTime() : false
  }

  getState(): CircuitBreakerState {
    return {
      name: this.name,
      state: this.state,
      failureCount: this.failureCount,
      successCount: 0, // Add tracking if needed
      lastFailureTime: this.lastFailure,
      nextAttemptTime: this.nextAttempt,
      threshold: this.options.failureThreshold || this.options.threshold,
      timeout: this.options.timeout,
    }
  }

  isOpen(): boolean {
    return this.state === 'open' && !this.shouldAttemptReset()
  }

  isClosed(): boolean {
    return this.state === 'closed'
  }

  isHalfOpen(): boolean {
    return this.state === 'half-open'
  }

  reset(): void {
    this.state = 'closed'
    this.failureCount = 0
    this.nextAttempt = undefined
    logger.info(`Circuit breaker ${this.name} manually reset`)
  }

  forceOpen(): void {
    this.state = 'open'
    this.nextAttempt = new Date(Date.now() + this.options.timeout)
    logger.warn(`Circuit breaker ${this.name} manually opened`)
  }
}