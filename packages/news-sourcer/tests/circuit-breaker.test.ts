import { describe, it, expect, beforeEach, mock, beforeAll } from "bun:test"
import { CircuitBreaker, CircuitBreakerRegistry, CircuitState } from '../src/circuit-breaker.js'
import { createTestTimers } from '@babel-feed/utils'
import { setupTestDatabase } from '@babel-feed/pgdb'

const timer = createTestTimers()

beforeAll(async () => {
  await setupTestDatabase()
})

describe('Circuit Breaker (with fake timers)', () => {
  let circuitBreaker: CircuitBreaker
  
  beforeEach(() => {
    circuitBreaker = new CircuitBreaker({
      failureThreshold: 3,
      resetTimeout: 1000,
      timeout: 500,
      monitoringPeriod: 5000
    })
  })

  describe('Normal Operation', () => {
    it('should start in CLOSED state', () => {
      const metrics = circuitBreaker.getMetrics()
      expect(metrics.state).toBe(CircuitState.CLOSED)
      expect(metrics.failureCount).toBe(0)
    })

    it('should execute successful operations', async () => {
      const operation = mock().mockResolvedValue('success')
      
      const result = await circuitBreaker.execute(operation)
      
      expect(result).toBe('success')
      expect(operation).toHaveBeenCalledTimes(1)
      
      const metrics = circuitBreaker.getMetrics()
      expect(metrics.state).toBe(CircuitState.CLOSED)
      expect(metrics.successCount).toBe(1)
      expect(metrics.totalRequests).toBe(1)
    })

    it('should handle operation failures', async () => {
      const operation = mock().mockRejectedValue(new Error('Operation failed'))
      
      await expect(circuitBreaker.execute(operation)).rejects.toThrow('Operation failed')
      
      const metrics = circuitBreaker.getMetrics()
      expect(metrics.state).toBe(CircuitState.CLOSED)
      expect(metrics.failureCount).toBe(1)
      expect(metrics.totalFailures).toBe(1)
    })
  })

  describe('Circuit Opening', () => {
    it('should open circuit after failure threshold', async () => {
      const operation = mock().mockRejectedValue(new Error('Operation failed'))
      
      // Execute operations to reach failure threshold
      for (let i = 0; i < 3; i++) {
        await expect(circuitBreaker.execute(operation)).rejects.toThrow('Operation failed')
      }
      
      const metrics = circuitBreaker.getMetrics()
      expect(metrics.state).toBe(CircuitState.OPEN)
      expect(metrics.failureCount).toBe(3)
    })

    it('should reject operations when circuit is open', async () => {
      const operation = mock().mockRejectedValue(new Error('Operation failed'))
      
      // Open the circuit
      for (let i = 0; i < 3; i++) {
        await expect(circuitBreaker.execute(operation)).rejects.toThrow('Operation failed')
      }
      
      // Should reject without executing
      await expect(circuitBreaker.execute(operation)).rejects.toThrow('Circuit breaker is OPEN')
      expect(operation).toHaveBeenCalledTimes(3) // Not called again
    })
  })

  describe('Circuit Recovery', () => {
    it('should transition to HALF_OPEN after reset timeout', async () => {
      const operation = mock().mockRejectedValue(new Error('Operation failed'))
      
      // Open the circuit
      for (let i = 0; i < 3; i++) {
        await expect(circuitBreaker.execute(operation)).rejects.toThrow('Operation failed')
      }
      
      expect(circuitBreaker.getMetrics().state).toBe(CircuitState.OPEN)
      
      // Advance time past reset timeout
      timer.tick(1100)
      
      // Next operation should transition to HALF_OPEN
      const successOperation = mock().mockResolvedValue('success')
      const result = await circuitBreaker.execute(successOperation)
      
      expect(result).toBe('success')
      expect(circuitBreaker.getMetrics().state).toBe(CircuitState.CLOSED)
    })

    it('should return to OPEN if operation fails in HALF_OPEN state', async () => {
      const operation = mock().mockRejectedValue(new Error('Operation failed'))
      
      // Open the circuit
      for (let i = 0; i < 3; i++) {
        await expect(circuitBreaker.execute(operation)).rejects.toThrow('Operation failed')
      }
      
      // Advance time past reset timeout
      timer.tick(1100)
      
      // Failing operation should return to OPEN
      await expect(circuitBreaker.execute(operation)).rejects.toThrow('Operation failed')
      expect(circuitBreaker.getMetrics().state).toBe(CircuitState.OPEN)
    })
  })

  describe('Timeout Handling', () => {
    it('should timeout long-running operations', async () => {
      const operation = mock(() => timer.tickAsync(1000))
      
      await expect(circuitBreaker.execute(operation)).rejects.toThrow('Operation timeout')
      
      const metrics = circuitBreaker.getMetrics()
      expect(metrics.failureCount).toBe(1)
    })
  })

  describe('Metrics', () => {
    it('should track comprehensive metrics', async () => {
      const successOperation = mock().mockResolvedValue('success')
      const failOperation = mock().mockRejectedValue(new Error('fail'))
      
      await circuitBreaker.execute(successOperation)
      await circuitBreaker.execute(successOperation)
      await expect(circuitBreaker.execute(failOperation)).rejects.toThrow('fail')
      
      const metrics = circuitBreaker.getMetrics()
      expect(metrics.totalRequests).toBe(3)
      expect(metrics.successCount).toBe(2)
      expect(metrics.totalFailures).toBe(1)
      expect(metrics.failureCount).toBe(1)
      expect(metrics.lastSuccessTime).toBeDefined()
      expect(metrics.lastFailureTime).toBeDefined()
    })

    it('should reset failure count after monitoring period', async () => {
      // Create a circuit breaker with a very short monitoring period for testing
      const testCircuitBreaker = new CircuitBreaker({
        failureThreshold: 3,
        resetTimeout: 1000,
        timeout: 500,
        monitoringPeriod: 100 // Very short for testing
      })
      timer.reset()
      
      const failOperation = mock().mockRejectedValue(new Error('fail'))
      
      await expect(testCircuitBreaker.execute(failOperation)).rejects.toThrow('fail')
      expect(testCircuitBreaker.getMetrics().failureCount).toBe(1)
      
      // Advance time past the monitoring period
      timer.tick(200)
      timer.clock.runAll()
      testCircuitBreaker._forceResetCheck()
      expect(testCircuitBreaker.getMetrics().failureCount).toBe(0)
      
      const successOperation = mock().mockResolvedValue('success')
      await testCircuitBreaker.execute(successOperation)
      
      // Failure count should still be 0
      expect(testCircuitBreaker.getMetrics().failureCount).toBe(0)
    })
  })

  describe('Control Methods', () => {
    it('should reset circuit breaker state', async () => {
      const operation = mock().mockRejectedValue(new Error('Operation failed'))
      
      // Open the circuit
      for (let i = 0; i < 3; i++) {
        await expect(circuitBreaker.execute(operation)).rejects.toThrow('Operation failed')
      }
      
      expect(circuitBreaker.getMetrics().state).toBe(CircuitState.OPEN)
      
      circuitBreaker.reset()
      
      const metrics = circuitBreaker.getMetrics()
      expect(metrics.state).toBe(CircuitState.CLOSED)
      expect(metrics.failureCount).toBe(0)
      expect(metrics.successCount).toBe(0)
    })

    it('should force circuit open', () => {
      circuitBreaker.forceOpen()
      expect(circuitBreaker.getMetrics().state).toBe(CircuitState.OPEN)
    })

    it('should force circuit closed', async () => {
      const operation = mock().mockRejectedValue(new Error('Operation failed'))
      
      // Open the circuit
      for (let i = 0; i < 3; i++) {
        await expect(circuitBreaker.execute(operation)).rejects.toThrow('Operation failed')
      }
      
      circuitBreaker.forceClose()
      expect(circuitBreaker.getMetrics().state).toBe(CircuitState.CLOSED)
      expect(circuitBreaker.getMetrics().failureCount).toBe(0)
    })
  })
})

describe('CircuitBreakerRegistry', () => {
  let registry: CircuitBreakerRegistry
  
  beforeEach(() => {
    registry = new CircuitBreakerRegistry()
  })

  describe('Registry Management', () => {
    it('should create and retrieve circuit breakers', () => {
      const breaker1 = registry.getCircuitBreaker('test-service')
      const breaker2 = registry.getCircuitBreaker('test-service')
      
      expect(breaker1).toBe(breaker2) // Same instance
      expect(breaker1).toBeInstanceOf(CircuitBreaker)
    })

    it('should create different breakers for different keys', () => {
      const breaker1 = registry.getCircuitBreaker('service-1')
      const breaker2 = registry.getCircuitBreaker('service-2')
      
      expect(breaker1).not.toBe(breaker2)
    })

    it('should apply custom options', () => {
      const breaker = registry.getCircuitBreaker('test-service', {
        failureThreshold: 10,
        resetTimeout: 5000,
        timeout: 30000,
        monitoringPeriod: 300000
      })
      
      expect(breaker).toBeInstanceOf(CircuitBreaker)
    })
  })

  describe('Bulk Operations', () => {
    it('should get all metrics', async () => {
      const breaker1 = registry.getCircuitBreaker('service-1')
      const breaker2 = registry.getCircuitBreaker('service-2')
      
      const operation = mock().mockResolvedValue('success')
      await breaker1.execute(operation)
      await breaker2.execute(operation)
      
      const allMetrics = registry.getAllMetrics()
      expect(Object.keys(allMetrics)).toHaveLength(2)
      expect(allMetrics['service-1']).toBeDefined()
      expect(allMetrics['service-2']).toBeDefined()
    })

    it('should reset all breakers', async () => {
      const breaker1 = registry.getCircuitBreaker('service-1')
      const breaker2 = registry.getCircuitBreaker('service-2')
      
      const operation = mock().mockResolvedValue('success')
      await breaker1.execute(operation)
      await breaker2.execute(operation)
      
      registry.resetAll()
      
      const allMetrics = registry.getAllMetrics()
      expect(allMetrics['service-1'].successCount).toBe(0)
      expect(allMetrics['service-2'].successCount).toBe(0)
    })

    it('should remove circuit breakers', () => {
      registry.getCircuitBreaker('test-service')
      
      const removed = registry.removeCircuitBreaker('test-service')
      expect(removed).toBe(true)
      
      const allMetrics = registry.getAllMetrics()
      expect(allMetrics['test-service']).toBeUndefined()
    })

    it('should return false when removing non-existent breaker', () => {
      const removed = registry.removeCircuitBreaker('non-existent')
      expect(removed).toBe(false)
    })
  })
})