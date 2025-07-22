#!/usr/bin/env bun

/**
 * Shared fake timer utilities for test environments
 * Provides deterministic time control for tests that depend on timing
 */

import { install, type InstalledClock, type FakeMethod } from '@sinonjs/fake-timers'
import { afterAll, beforeEach } from 'bun:test'

export interface TestTimerOptions {
  /** Starting time for the fake clock (default: 0) */
  now?: number | Date
  /** Whether time should advance automatically (default: true) */
  shouldAdvanceTime?: boolean
  /** How much time advances per tick in ms (default: 20) */
  advanceTimeDelta?: number
  /** Whether to fake Date constructor (default: true) */
  fakeDate?: boolean
  /** Whether to fake setTimeout/setInterval (default: true) */
  fakeTimers?: boolean
  /** Whether to fake performance.now (default: true) */
  fakePerformance?: boolean
}

export interface TestTimer {
  /** The SinonJS fake timer clock instance */
  clock: InstalledClock
  /** Get current fake time */
  now: () => number
  /** Set the fake time to a specific timestamp */
  setTime: (time: number | Date) => void
  /** Advance time by specified milliseconds */
  tick: (ms: number) => void
  /** Advance time and run pending async operations */
  tickAsync: (ms: number) => Promise<void>
  /** Reset the clock to initial state */
  reset: () => void
  /** Create a deterministic date relative to fake time */
  createDate: (offsetMs?: number) => Date
  /** Create a performance timer for deterministic timing tests */
  createPerformanceTimer: () => PerformanceTimer
}

export interface PerformanceTimer {
  /** Start timing */
  start: () => void
  /** End timing and return duration in milliseconds */
  end: () => number
  /** Get current duration without ending */
  duration: () => number
}

/**
 * Create and configure fake timers for testing
 * Automatically sets up beforeEach reset and afterAll cleanup
 */
export function createTestTimers(options: TestTimerOptions = {}): TestTimer {
  const config = {
    now: 0,
    shouldAdvanceTime: true,
    advanceTimeDelta: 20,
    fakeDate: true,
    fakeTimers: true,
    fakePerformance: true,
    ...options
  }

  const toFake: FakeMethod[] = []
  if (config.fakeDate) toFake.push('Date')
  if (config.fakeTimers) toFake.push('setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'setImmediate', 'clearImmediate')
  if (config.fakePerformance) toFake.push('performance')

  const clock = install({
    now: config.now,
    shouldAdvanceTime: config.shouldAdvanceTime,
    advanceTimeDelta: config.advanceTimeDelta,
    toFake: toFake.length > 0 ? toFake : undefined
  })

  beforeEach(() => {
    clock.reset()
  })

  afterAll(() => {
    clock.uninstall()
  })

  return {
    clock,
    now: () => clock.now,
    setTime: (time: number | Date) => clock.setSystemTime(time),
    tick: (ms: number) => clock.tick(ms),
    tickAsync: async (ms: number) => {
      clock.tick(ms)
      // Allow pending promises and timers to resolve
      await new Promise(resolve => setImmediate(resolve))
    },
    reset: () => clock.reset(),
    createDate: (offsetMs = 0) => new Date(clock.now + offsetMs),
    createPerformanceTimer: () => createPerformanceTimer(clock)
  }
}

/**
 * Create a deterministic performance timer using fake clock
 */
function createPerformanceTimer(clock: InstalledClock): PerformanceTimer {
  let startTime: number | null = null

  return {
    start: () => {
      startTime = clock.now
    },
    end: () => {
      if (startTime === null) {
        throw new Error('Performance timer not started')
      }
      const duration = clock.now - startTime
      startTime = null
      return duration
    },
    duration: () => {
      if (startTime === null) {
        throw new Error('Performance timer not started')
      }
      return clock.now - startTime
    }
  }
}

/**
 * Custom sleep function that works with fake timers
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Helper to advance timers during async operations
 * @deprecated Use testTimer.tickAsync() instead
 */
export async function advanceTimersAndRun(clock: InstalledClock, ms: number): Promise<void> {
  clock.tick(ms)
  // Run any pending timers
  await new Promise(resolve => setImmediate(resolve))
}

/**
 * Quick setup for basic fake timers (backward compatibility)
 * @deprecated Use createTestTimers() instead for better control
 */
export function fakeTimers() {
  return createTestTimers().clock
}

/**
 * Common time constants for testing
 */
export const TIME_CONSTANTS = {
  SECOND: 1000,
  MINUTE: 60 * 1000,
  HOUR: 60 * 60 * 1000,
  DAY: 24 * 60 * 60 * 1000,
  WEEK: 7 * 24 * 60 * 60 * 1000
} as const

/**
 * Helper to create test dates relative to a base time
 */
export function createTestDates(baseTime = 0) {
  return {
    now: () => new Date(baseTime),
    ago: (ms: number) => new Date(baseTime - ms),
    future: (ms: number) => new Date(baseTime + ms),
    daysAgo: (days: number) => new Date(baseTime - days * TIME_CONSTANTS.DAY),
    daysFuture: (days: number) => new Date(baseTime + days * TIME_CONSTANTS.DAY),
    hoursAgo: (hours: number) => new Date(baseTime - hours * TIME_CONSTANTS.HOUR),
    hoursFuture: (hours: number) => new Date(baseTime + hours * TIME_CONSTANTS.HOUR)
  }
}

/**
 * Performance test helpers for deterministic timing assertions
 */
export interface PerformanceTestHelpers {
  /** Assert that an operation completes within expected time */
  assertPerformance: <T>(
    operation: () => Promise<T>, 
    maxMs: number, 
    label?: string
  ) => Promise<T>
  /** Measure operation time deterministically */
  measureTime: <T>(operation: () => Promise<T>) => Promise<{ result: T; duration: number }>
}

/**
 * Create performance test helpers with fake timers
 */
export function createPerformanceTestHelpers(timer: TestTimer): PerformanceTestHelpers {
  return {
    assertPerformance: async <T>(
      operation: () => Promise<T>, 
      maxMs: number, 
      label = 'operation'
    ): Promise<T> => {
      const perfTimer = timer.createPerformanceTimer()
      perfTimer.start()
      
      const result = await operation()
      const duration = perfTimer.end()
      
      if (duration > maxMs) {
        throw new Error(`${label} took ${duration}ms, expected ≤${maxMs}ms`)
      }
      
      return result
    },
    
    measureTime: async <T>(operation: () => Promise<T>): Promise<{ result: T; duration: number }> => {
      const perfTimer = timer.createPerformanceTimer()
      perfTimer.start()
      
      const result = await operation()
      const duration = perfTimer.end()
      
      return { result, duration }
    }
  }
}