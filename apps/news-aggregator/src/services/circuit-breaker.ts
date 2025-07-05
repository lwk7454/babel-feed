import { logger } from '../utils/logger';
import { CircuitBreakerState } from '../types';

export type CircuitState = 'closed' | 'open' | 'half_open';

export interface CircuitBreakerOptions {
  failureThreshold: number;
  timeout: number; // milliseconds
  monitoringWindow: number; // milliseconds
}

export class CircuitBreaker {
  private state: CircuitState = 'closed';
  private failureCount = 0;
  private nextAttempt?: Date;
  private lastFailure?: Date;
  private lastSuccess?: Date;

  constructor(
    private name: string,
    private options: CircuitBreakerOptions
  ) {}

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      if (this.shouldAttemptReset()) {
        this.state = 'half_open';
        logger.info(`Circuit breaker ${this.name} entering half-open state`);
      } else {
        throw new Error(`Circuit breaker ${this.name} is open`);
      }
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure(error);
      throw error;
    }
  }

  private onSuccess(): void {
    this.failureCount = 0;
    this.lastSuccess = new Date();
    
    if (this.state === 'half_open') {
      this.state = 'closed';
      logger.info(`Circuit breaker ${this.name} reset to closed state`);
    }
  }

  private onFailure(error: unknown): void {
    this.failureCount++;
    this.lastFailure = new Date();
    
    logger.warn(`Circuit breaker ${this.name} failure ${this.failureCount}/${this.options.failureThreshold}:`, error);

    if (this.failureCount >= this.options.failureThreshold) {
      this.state = 'open';
      this.nextAttempt = new Date(Date.now() + this.options.timeout);
      logger.error(`Circuit breaker ${this.name} opened due to ${this.failureCount} failures`);
    }
  }

  private shouldAttemptReset(): boolean {
    return this.nextAttempt ? Date.now() >= this.nextAttempt.getTime() : false;
  }

  getState(): CircuitBreakerState {
    return {
      id: this.name,
      providerId: this.name.split(':')[0], // Assuming format "providerId:keyId"
      keyId: this.name.split(':')[1] || undefined,
      state: this.state,
      failureCount: this.failureCount,
      lastFailure: this.lastFailure,
      lastSuccess: this.lastSuccess,
      nextAttempt: this.nextAttempt,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  isOpen(): boolean {
    return this.state === 'open' && !this.shouldAttemptReset();
  }

  isClosed(): boolean {
    return this.state === 'closed';
  }

  isHalfOpen(): boolean {
    return this.state === 'half_open';
  }

  reset(): void {
    this.state = 'closed';
    this.failureCount = 0;
    this.nextAttempt = undefined;
    logger.info(`Circuit breaker ${this.name} manually reset`);
  }

  forceOpen(): void {
    this.state = 'open';
    this.nextAttempt = new Date(Date.now() + this.options.timeout);
    logger.warn(`Circuit breaker ${this.name} manually opened`);
  }
}