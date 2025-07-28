/**
 * Global timer mocking that replaces all timing functions at once
 * Handles fetch timeouts, AbortController, and async callbacks comprehensively
 */

import { setSystemTime } from "bun:test"

// Type for globalThis with timer mock
type GlobalThisWithTimerMock = typeof globalThis & {
  __timerMock: GlobalTimerMock | undefined
}

export interface GlobalTimerMock {
  /** Set current time */
  setTime: (time: number | Date) => void;
  /** Advance time and flush all pending operations */
  advanceTime: (ms: number) => Promise<void>;
  /** Reset to starting time */
  reset: () => void;
  /** Get current mocked time */
  now: () => number;
  /** Cleanup and restore real timers */
  cleanup: () => void;
}

/**
 * Creates a comprehensive global timer mock that handles all timing scenarios
 * - Mocks Date, setTimeout, setInterval, performance.now
 * - Handles fetch AbortController timeouts  
 * - Works with async callbacks and Promise chains
 * - Single source of truth for all timing
 */
export function createGlobalTimerMock(startTime: number | Date = new Date('2025-01-01T00:00:00.000Z')): GlobalTimerMock {
  const baseTime = typeof startTime === 'number' ? startTime : startTime.getTime()
  let currentTime = baseTime
  
  // Store original functions
  const originalSetTimeout = globalThis.setTimeout
  const originalSetInterval = globalThis.setInterval
  const originalClearTimeout = globalThis.clearTimeout
  const originalClearInterval = globalThis.clearInterval
  const originalDateNow = Date.now
  const originalPerformanceNow = globalThis.performance.now
  
  // Pending timers
  let timerId = 1
  const pendingTimers = new Map<number, { callback: () => void; time: number; interval?: number }>()
  
  // Set system time for Bun
  setSystemTime(new Date(currentTime))

  // Mock setTimeout
  const mockSetTimeout = (callback: () => void, delay = 0): number => {
    const id = timerId++
    pendingTimers.set(id, { callback, time: currentTime + delay })
    return id
  }

  // Mock setInterval  
  const mockSetInterval = (callback: () => void, delay = 0): number => {
    const id = timerId++
    pendingTimers.set(id, { callback, time: currentTime + delay, interval: delay })
    return id
  }

  // Mock clearTimeout/clearInterval
  const mockClearTimeout = (id?: number | NodeJS.Timeout): void => {
    if (typeof id === 'number') {
      pendingTimers.delete(id)
    }
  }

  // Replace global timing functions
  globalThis.setTimeout = mockSetTimeout as typeof globalThis.setTimeout
  globalThis.setInterval = mockSetInterval as typeof globalThis.setInterval
  globalThis.clearTimeout = mockClearTimeout as typeof globalThis.clearTimeout
  globalThis.clearInterval = mockClearTimeout as typeof globalThis.clearInterval
  
  // Override all timing access points
  const mockNow = () => currentTime
  globalThis.Date.now = mockNow
  globalThis.performance.now = mockNow
  
  const globalTimerMock: GlobalTimerMock = {
    setTime: (time: number | Date) => {
      currentTime = typeof time === 'number' ? time : time.getTime()
      setSystemTime(new Date(currentTime))
    },
    
    advanceTime: async (ms: number) => {
      const targetTime = currentTime + ms
      
      // Execute all timers that should fire
      while (currentTime < targetTime) {
        // Find next timer to fire
        let nextTimer: { id: number; timer: { callback: () => void; time: number; interval?: number } } | null = null
        
        for (const [id, timer] of pendingTimers.entries()) {
          if (timer.time <= targetTime && (!nextTimer || timer.time < nextTimer.timer.time)) {
            nextTimer = { id, timer }
          }
        }
        
        if (!nextTimer) {
          // No more timers, jump to target time
          currentTime = targetTime
          break
        }
        
        // Advance to timer time and execute
        currentTime = nextTimer.timer.time
        setSystemTime(new Date(currentTime))
        
        // Execute callback
        const callback = nextTimer.timer.callback
        pendingTimers.delete(nextTimer.id)
        
        // Handle intervals
        if (nextTimer.timer.interval) {
          pendingTimers.set(nextTimer.id, {
            callback,
            time: currentTime + nextTimer.timer.interval,
            interval: nextTimer.timer.interval
          })
        }
        
        // Execute callback (might be async)
        try {
          callback()
        } catch (error) {
          console.error('Timer callback error:', error)
        }
        
        // Allow promises to resolve
        await new Promise(resolve => setImmediate(resolve))
      }
      
      // Ensure we reach target time
      currentTime = targetTime
      setSystemTime(new Date(currentTime))
    },
    
    reset: () => {
      currentTime = baseTime
      setSystemTime(new Date(currentTime))
    },
    
    now: () => currentTime,
    
    cleanup: () => {
      // Restore original functions
      globalThis.setTimeout = originalSetTimeout
      globalThis.setInterval = originalSetInterval
      globalThis.clearTimeout = originalClearTimeout
      globalThis.clearInterval = originalClearInterval
      globalThis.Date.now = originalDateNow
      globalThis.performance.now = originalPerformanceNow
      setSystemTime() // Reset to real time
      pendingTimers.clear()
    }
  }

  ;(globalThis as GlobalThisWithTimerMock).__timerMock = globalTimerMock
  process.on('exit', () => globalTimerMock.cleanup())
  return globalTimerMock
}

/**
 * Get the global timer mock instance from tests
 */
export function getGlobalTimerMock(): GlobalTimerMock {
  if (!(globalThis as GlobalThisWithTimerMock).__timerMock) {
    createGlobalTimerMock()
  }
  return (globalThis as GlobalThisWithTimerMock).__timerMock!
}