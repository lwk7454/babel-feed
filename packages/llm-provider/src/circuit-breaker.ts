import { logger } from '@babel-feed/utils'
import { CircuitBreakerState, CircuitState, CircuitBreakerOptions } from './types'

export class CircuitBreaker {
  private state: CircuitState = 'closed'
  private failureCount = 0
  private nextAttempt?: Date
  private lastFailure?: Date
  constructor(private name: string, private options: CircuitBreakerOptions) {}

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
    if (this.state === 'half-open') {
      this.state = 'closed'
      logger.info(`Circuit breaker ${this.name} reset to closed state`)
    }
  }

  private onFailure(error: unknown): void {
    this.failureCount++
    this.lastFailure = new Date()
    logger.warn(`Circuit breaker ${this.name} failure ${this.failureCount}/${this.options.threshold}:`, error)
    if (this.failureCount >= this.options.threshold) {
      this.state = 'open'
      // Use globalThis.Date to work with fake timers in tests
      const DateConstructor = globalThis.Date || Date
      this.nextAttempt = new DateConstructor(DateConstructor.now() + this.options.timeout)
      logger.error(`Circuit breaker ${this.name} opened due to ${this.failureCount} failures`)
    }
  }

  private shouldAttemptReset(): boolean {
    if (!this.nextAttempt) return false
    // Use globalThis.Date to work with fake timers in tests
    const DateConstructor = globalThis.Date || Date
    return DateConstructor.now() >= this.nextAttempt.getTime()
  }

  getState(): CircuitBreakerState {
    return {
      name: this.name,
      state: this.state,
      failureCount: this.failureCount,
      successCount: 0,
      lastFailureTime: this.lastFailure,
      nextAttemptTime: this.nextAttempt,
      threshold: this.options.threshold,
      timeout: this.options.timeout,
    }
  }

  isOpen(): boolean { return this.state === 'open' && !this.shouldAttemptReset() }
  isClosed(): boolean { return this.state === 'closed' }
  isHalfOpen(): boolean { return this.state === 'half-open' }
  reset(): void {
    this.state = 'closed'
    this.failureCount = 0
    this.nextAttempt = undefined
    logger.info(`Circuit breaker ${this.name} manually reset`)
  }
  forceOpen(): void {
    this.state = 'open'
    // Use globalThis.Date to work with fake timers in tests
    const DateConstructor = globalThis.Date || Date
    this.nextAttempt = new DateConstructor(DateConstructor.now() + this.options.timeout)
    logger.warn(`Circuit breaker ${this.name} manually opened`)
  }
}
