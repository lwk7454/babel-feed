import { describe, it, expect, beforeEach, beforeAll, afterAll } from 'bun:test'
import { CircuitBreaker } from '../src/circuit-breaker.js'
import { install } from '@sinonjs/fake-timers'

let clock: ReturnType<typeof install> | undefined

describe('CircuitBreaker', () => {
  beforeAll(() => {
    clock = install({ now: 0, shouldAdvanceTime: true, advanceTimeDelta: 20 })
  })

  afterAll(() => {
    clock?.uninstall()
    clock = undefined
  })

  beforeEach(() => {
    clock?.reset()
  })

  it('executes operation when closed', async () => {
    const breaker = new CircuitBreaker('test', { threshold: 2, timeout: 1000, resetTimeout: 1000 })
    const operation = () => Promise.resolve('success')
    
    const result = await breaker.execute(operation)
    expect(result).toBe('success')
  })

  it('opens after failures and resets', async () => {
    const breaker = new CircuitBreaker('test', { threshold: 2, timeout: 1000, resetTimeout: 1000 })
    const operation = () => Promise.reject(new Error('fail'))
    
    // First two failures
    await expect(breaker.execute(operation)).rejects.toThrow('fail')
    await expect(breaker.execute(operation)).rejects.toThrow('fail')
    
    // Circuit should be open
    await expect(breaker.execute(operation)).rejects.toThrow('Circuit breaker test is open')
    
    // Advance time past timeout
    clock!.tick(1100)
    
    // Should be half-open and succeed
    const successOp = () => Promise.resolve('success')
    const result = await breaker.execute(successOp)
    expect(result).toBe('success')
  })
})
