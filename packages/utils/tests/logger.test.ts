import { describe, it, expect } from 'bun:test'
import { logger } from '../src/logger'

describe('logger', () => {
  it('logs info messages', () => {
    const original = console.log
    let called = false
    console.log = () => { called = true }
    logger.info('hello', { a: 1 })
    expect(called).toBe(true)
    console.log = original
  })
})
