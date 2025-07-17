import { install } from '@sinonjs/fake-timers'
import { afterAll, beforeEach } from 'bun:test'

export function fakeTimers() {
  const clock = install({
    now: 0,
    shouldAdvanceTime: true,
    advanceTimeDelta: 20
  })

  beforeEach(() => {
    clock.reset()
  })

  afterAll(() => {
    clock.uninstall()
  })

  return clock
}

// Custom sleep function that works with fake timers
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
