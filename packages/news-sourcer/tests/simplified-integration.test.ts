import { describe, it, expect, beforeEach, afterEach } from "bun:test"
import { EventSystem } from '../src/event-system.js'
import { fakeTimers, sleep } from './helpers/fake-timers.js'

const clock = fakeTimers()

describe('Simplified Integration Tests', () => {
  let eventSystem: EventSystem

  beforeEach(async () => {
    eventSystem = new EventSystem()
  })

  afterEach(async () => {
    eventSystem.stopWebhookProcessing()
  })

  describe('Event System', () => {
    it('should emit and handle events', async () => {
      const receivedEvents: any[] = []

      // Subscribe to events
      const subscription = eventSystem.subscribe('endpoint_created', (event) => {
        receivedEvents.push(event)
      })

      expect(subscription.id).toBeDefined()
      expect(subscription.eventType).toBe('endpoint_created')

      // Emit event
      await eventSystem.emit({
        type: 'endpoint_created',
        timestamp: new Date(),
        data: { message: 'test data' }
      })

      // Small delay to allow event processing
      const sleepPromise = sleep(10)
      clock.tick(10)
      await sleepPromise

      expect(receivedEvents).toHaveLength(1)
      expect(receivedEvents[0].type).toBe('endpoint_created')
      expect(receivedEvents[0].data.message).toBe('test data')

      // Unsubscribe
      const unsubscribed = eventSystem.unsubscribe(subscription.id)
      expect(unsubscribed).toBe(true)

      // Get stats
      const stats = eventSystem.getStats()
      expect(stats.subscriptions).toBe(0) // After unsubscribe
      expect(stats.eventBuffer).toBeGreaterThan(0)
    })

    it('should manage webhook registrations', () => {
      // Register webhook
      eventSystem.registerWebhook('test-webhook', {
        url: 'https://webhook.example.com/test',
        events: ['endpoint_created'],
        timeout: 5000,
        retryCount: 3,
        retryDelay: 1000
      })

      // Get stats
      const stats = eventSystem.getStats()
      expect(stats.webhooks).toBe(1)

      // Unregister webhook
      const unregistered = eventSystem.unregisterWebhook('test-webhook')
      expect(unregistered).toBe(true)

      const afterUnregister = eventSystem.getStats()
      expect(afterUnregister.webhooks).toBe(0)
    })

    it('should provide event history', async () => {
      // Emit some events
      await eventSystem.emit({
        type: 'endpoint_created',
        timestamp: new Date(),
        data: { id: 1 }
      })

      await eventSystem.emit({
        type: 'endpoint_updated',
        timestamp: new Date(),
        data: { id: 2 }
      })

      // Get history
      const allHistory = eventSystem.getEventHistory()
      expect(allHistory.length).toBeGreaterThanOrEqual(2)

      // Get filtered history
      const filtered = eventSystem.getEventHistory('endpoint_created')
      expect(filtered).toHaveLength(1)
      expect(filtered[0].type).toBe('endpoint_created')

      // Get limited history
      const limited = eventSystem.getEventHistory(undefined, 1)
      expect(limited).toHaveLength(1)
    })

    it('should handle multiple subscriptions', async () => {
      const events1: any[] = []
      const events2: any[] = []

      // Create multiple subscriptions
      const sub1 = eventSystem.subscribe('endpoint_created', (event) => {
        events1.push(event)
      })

      const sub2 = eventSystem.subscribe('endpoint_created', (event) => {
        events2.push(event)
      })

      // Emit event
      await eventSystem.emit({
        type: 'endpoint_created',
        timestamp: new Date(),
        data: { id: 123 }
      })

      // Small delay to allow event processing
      const sleepPromise = sleep(10)
      clock.tick(10)
      await sleepPromise

      expect(events1).toHaveLength(1)
      expect(events2).toHaveLength(1)
      expect(events1[0].data.id).toBe(123)
      expect(events2[0].data.id).toBe(123)

      // Clean up
      eventSystem.unsubscribe(sub1.id)
      eventSystem.unsubscribe(sub2.id)
    })

    it('should handle wildcard subscriptions', async () => {
      const allEvents: any[] = []

      // Subscribe to all events
      const subscription = eventSystem.subscribe('*', (event) => {
        allEvents.push(event)
      })

      // Emit different types of events
      await eventSystem.emit({
        type: 'endpoint_created',
        timestamp: new Date(),
        data: { type: 'created' }
      })

      await eventSystem.emit({
        type: 'endpoint_updated',
        timestamp: new Date(),
        data: { type: 'updated' }
      })

      await eventSystem.emit({
        type: 'endpoint_deleted',
        timestamp: new Date(),
        data: { type: 'deleted' }
      })

      // Small delay to allow event processing
      const sleepPromise = sleep(10)
      clock.tick(10)
      await sleepPromise

      expect(allEvents).toHaveLength(3)
      expect(allEvents[0].data.type).toBe('created')
      expect(allEvents[1].data.type).toBe('updated')
      expect(allEvents[2].data.type).toBe('deleted')

      // Clean up
      eventSystem.unsubscribe(subscription.id)
    })

    it('should filter events correctly', async () => {
      const filteredEvents: any[] = []

      // Subscribe with a filter
      const subscription = eventSystem.subscribe('endpoint_created', (event) => {
        filteredEvents.push(event)
      }, (event) => (event.data as any).id > 5) // Only events with id > 5

      // Emit events with different IDs
      await eventSystem.emit({
        type: 'endpoint_created',
        timestamp: new Date(),
        data: { id: 3 }
      })

      await eventSystem.emit({
        type: 'endpoint_created',
        timestamp: new Date(),
        data: { id: 7 }
      })

      await eventSystem.emit({
        type: 'endpoint_created',
        timestamp: new Date(),
        data: { id: 10 }
      })

      // Small delay to allow event processing
      const sleepPromise = sleep(10)
      clock.tick(10)
      await sleepPromise

      expect(filteredEvents).toHaveLength(2) // Only events with id > 5
      expect(filteredEvents[0].data.id).toBe(7)
      expect(filteredEvents[1].data.id).toBe(10)

      // Clean up
      eventSystem.unsubscribe(subscription.id)
    })

    it('should handle webhook processing lifecycle', () => {
      // Start webhook processing
      eventSystem.startWebhookProcessing()

      // Register a webhook
      eventSystem.registerWebhook('test-webhook', {
        url: 'https://webhook.example.com/test',
        events: ['endpoint_created'],
        timeout: 5000,
        retryCount: 3,
        retryDelay: 1000
      })

      // Get stats
      const stats = eventSystem.getStats()
      expect(stats.webhooks).toBe(1)

      // Stop webhook processing
      eventSystem.stopWebhookProcessing()

      // Clean up
      eventSystem.unregisterWebhook('test-webhook')
    })

    it('should clear event buffer and delivery queue', async () => {
      // Emit some events
      await eventSystem.emit({
        type: 'endpoint_created',
        timestamp: new Date(),
        data: { id: 1 }
      })

      await eventSystem.emit({
        type: 'endpoint_updated',
        timestamp: new Date(),
        data: { id: 2 }
      })

      // Verify events are in buffer
      const beforeClear = eventSystem.getStats()
      expect(beforeClear.eventBuffer).toBeGreaterThan(0)

      // Clear everything
      eventSystem.clear()

      // Verify buffer is empty
      const afterClear = eventSystem.getStats()
      expect(afterClear.eventBuffer).toBe(0)
      expect(afterClear.deliveryQueue).toBe(0)
    })

    it('should handle event handler errors gracefully', async () => {
      const receivedEvents: any[] = []

      // Subscribe with a handler that throws an error
      const subscription = eventSystem.subscribe('endpoint_created', (event) => {
        throw new Error('Handler error')
      })

      // Subscribe with a normal handler
      const subscription2 = eventSystem.subscribe('endpoint_created', (event) => {
        receivedEvents.push(event)
      })

      // Emit event - should not crash
      await eventSystem.emit({
        type: 'endpoint_created',
        timestamp: new Date(),
        data: { id: 123 }
      })

      // Small delay to allow event processing
      const sleepPromise = sleep(10)
      clock.tick(10)
      await sleepPromise

      // The normal handler should still receive the event
      expect(receivedEvents).toHaveLength(1)
      expect(receivedEvents[0].data.id).toBe(123)

      // Clean up
      eventSystem.unsubscribe(subscription.id)
      eventSystem.unsubscribe(subscription2.id)
    })
  })

  describe('Reliability Calculation', () => {
    it('should calculate reliability scores correctly', () => {
      // Test with success > errors
      const reliability1 = calculateReliability(90, 10)
      expect(reliability1).toBeGreaterThan(0.8)
      expect(reliability1).toBeLessThanOrEqual(1)

      // Test with errors > success
      const reliability2 = calculateReliability(10, 90)
      expect(reliability2).toBeLessThan(0.2)
      expect(reliability2).toBeGreaterThanOrEqual(0)

      // Test with no data
      const reliability3 = calculateReliability(0, 0)
      expect(reliability3).toBe(1) // No data = perfect reliability
    })
  })
})

// Helper function for reliability calculation
function calculateReliability(successCount: number, errorCount: number): number {
  const total = successCount + errorCount
  if (total === 0) return 1
  return successCount / total
}