import { describe, it, expect, beforeEach } from 'bun:test'
import { CircuitBreaker } from '../src/circuit-breaker'

describe('CircuitBreaker', () => {
  let breaker: CircuitBreaker

  beforeEach(() => {
    breaker = new CircuitBreaker('test', { threshold: 2, timeout: 50, resetTimeout: 10 })
  })

  it('executes operation when closed', async () => {
    const result = await breaker.execute(async () => 'ok')
    expect(result).toBe('ok')
    expect(breaker.isClosed()).toBe(true)
  })

  it('opens after failures and resets', async () => {
    await expect(breaker.execute(async () => { throw new Error('fail') })).rejects.toThrow('fail')
    await expect(breaker.execute(async () => { throw new Error('fail') })).rejects.toThrow('fail')
    expect(breaker.isOpen()).toBe(true)
    await new Promise(r => setTimeout(r, 60))
    await expect(breaker.execute(async () => 'recovered')).resolves.toBe('recovered')
    expect(breaker.isClosed()).toBe(true)
  })
})
