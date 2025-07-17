/**
 * Circuit breaker implementation for endpoint protection
 */

export interface CircuitBreakerOptions {
  failureThreshold: number
  resetTimeout: number
  timeout: number
  monitoringPeriod: number
}

export enum CircuitState {
  CLOSED = 'CLOSED',     // Normal operation
  OPEN = 'OPEN',         // Circuit is open, failing fast
  HALF_OPEN = 'HALF_OPEN' // Testing if service has recovered
}

export interface CircuitBreakerMetrics {
  state: CircuitState
  failureCount: number
  successCount: number
  lastFailureTime: number | null
  lastSuccessTime: number | null
  totalRequests: number
  totalFailures: number
}

export class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED
  private failureCount = 0
  private successCount = 0
  private lastFailureTime: number | null = null
  private lastSuccessTime: number | null = null
  private totalRequests = 0
  private totalFailures = 0
  private nextAttempt = 0

  constructor(private options: CircuitBreakerOptions) {}

  private maybeResetFailureCount(now: number) {
    if (
      this.lastFailureTime !== null &&
      now - this.lastFailureTime >= this.options.monitoringPeriod
    ) {
      this.failureCount = 0
    }
  }

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    const now = Date.now()
    this.maybeResetFailureCount(now)
    if (!this.canExecute()) {
      throw new Error(`Circuit breaker is ${this.state} - request rejected`)
    }

    this.totalRequests++

    try {
      const startTime = Date.now()
      
      // Set timeout for the operation
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Operation timeout')), this.options.timeout)
      })

      const result = await Promise.race([operation(), timeoutPromise])
      
      const duration = Date.now() - startTime
      this.onSuccess(duration)
      return result
      
    } catch (error) {
      this.onFailure(error)
      throw error
    }
  }

  // For testing: force check/reset failure count
  _forceResetCheck() {
    this.maybeResetFailureCount(Date.now())
  }

  private canExecute(): boolean {
    const now = Date.now()

    switch (this.state) {
      case CircuitState.CLOSED:
        return true
        
      case CircuitState.OPEN:
        if (now >= this.nextAttempt) {
          this.state = CircuitState.HALF_OPEN
          this.failureCount = 0
          return true
        }
        return false
        
      case CircuitState.HALF_OPEN:
        return true
        
      default:
        return false
    }
  }

  private onSuccess(duration: number): void {
    const now = Date.now()
    this.successCount++
    this.lastSuccessTime = now
    // Do not update lastFailureTime on success
    
    if (this.state === CircuitState.HALF_OPEN) {
      this.state = CircuitState.CLOSED
      this.failureCount = 0
    }
  }

  private onFailure(error: unknown): void {
    const now = Date.now()
    this.failureCount++
    this.totalFailures++
    this.lastFailureTime = now
    
    if (this.state === CircuitState.HALF_OPEN) {
      this.state = CircuitState.OPEN
      this.nextAttempt = now + this.options.resetTimeout
    } else if (this.state === CircuitState.CLOSED) {
      if (this.failureCount >= this.options.failureThreshold) {
        this.state = CircuitState.OPEN
        this.nextAttempt = now + this.options.resetTimeout
      }
    }
  }

  getMetrics(): CircuitBreakerMetrics {
    return {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      lastFailureTime: this.lastFailureTime,
      lastSuccessTime: this.lastSuccessTime,
      totalRequests: this.totalRequests,
      totalFailures: this.totalFailures
    }
  }

  reset(): void {
    this.state = CircuitState.CLOSED
    this.failureCount = 0
    this.successCount = 0
    this.lastFailureTime = null
    this.lastSuccessTime = null
    this.nextAttempt = 0
  }

  forceOpen(): void {
    this.state = CircuitState.OPEN
    this.nextAttempt = Date.now() + this.options.resetTimeout
  }

  forceClose(): void {
    this.state = CircuitState.CLOSED
    this.failureCount = 0
  }
}

export class CircuitBreakerRegistry {
  private breakers = new Map<string, CircuitBreaker>()
  
  getCircuitBreaker(key: string, options?: CircuitBreakerOptions): CircuitBreaker {
    if (!this.breakers.has(key)) {
      const defaultOptions: CircuitBreakerOptions = {
        failureThreshold: 5,
        resetTimeout: 60000, // 1 minute
        timeout: 30000,      // 30 seconds
        monitoringPeriod: 300000 // 5 minutes
      }
      
      this.breakers.set(key, new CircuitBreaker({ ...defaultOptions, ...options }))
    }
    
    return this.breakers.get(key)!
  }

  getAllMetrics(): Record<string, CircuitBreakerMetrics> {
    const metrics: Record<string, CircuitBreakerMetrics> = {}
    
    for (const [key, breaker] of this.breakers.entries()) {
      metrics[key] = breaker.getMetrics()
    }
    
    return metrics
  }

  resetAll(): void {
    for (const breaker of this.breakers.values()) {
      breaker.reset()
    }
  }

  removeCircuitBreaker(key: string): boolean {
    return this.breakers.delete(key)
  }
}