/**
 * Event system for webhook notifications and integration
 */

import axios from 'axios'
import crypto from 'crypto'
import { logger } from '@babel-feed/utils'
import type { 
  NewsSourcerEvent, 
  EventHandler, 
  EventSubscription, 
  WebhookConfig, 
  WebhookPayload, 
  WebhookDelivery,
  EndpointUpdateNotification
} from './shared-types.js'

export interface EventSystemConfig {
  webhooks: {
    enabled: boolean
    maxRetries: number
    retryDelay: number
    timeout: number
    queueSize: number
  }
  events: {
    bufferSize: number
    maxAge: number
  }
}

export class EventSystem {
  private config: EventSystemConfig
  private subscriptions: Map<string, EventSubscription> = new Map()
  private webhooks: Map<string, WebhookConfig> = new Map()
  private eventBuffer: NewsSourcerEvent[] = []
  private deliveryQueue: WebhookDelivery[] = []
  private processingInterval: NodeJS.Timeout | null = null
  private subscriptionCounter = 0
  private deliveryCounter = 0

  constructor(config: Partial<EventSystemConfig> = {}) {
    this.config = {
      webhooks: {
        enabled: true,
        maxRetries: 3,
        retryDelay: 5000,
        timeout: 10000,
        queueSize: 1000
      },
      events: {
        bufferSize: 10000,
        maxAge: 86400000 // 24 hours
      },
      ...config
    }
  }

  /**
   * Emit an event to all subscribers and webhooks
   */
  async emit(event: NewsSourcerEvent): Promise<void> {
    try {
      // Add to event buffer
      this.eventBuffer.push(event)
      
      // Trim buffer if too large
      if (this.eventBuffer.length > this.config.events.bufferSize) {
        this.eventBuffer = this.eventBuffer.slice(-this.config.events.bufferSize)
      }
      
      // Clean old events
      const cutoff = Date.now() - this.config.events.maxAge
      this.eventBuffer = this.eventBuffer.filter(e => e.timestamp.getTime() > cutoff)
      
      // Process local subscriptions
      await this.processSubscriptions(event)
      
      // Process webhooks
      if (this.config.webhooks.enabled) {
        await this.processWebhooks(event)
      }
      
      logger.debug('Event emitted successfully', { type: event.type, timestamp: event.timestamp })
      
    } catch (error) {
      logger.error('Failed to emit event', { event, error })
    }
  }

  /**
   * Subscribe to events with a handler function
   */
  subscribe(eventType: string, handler: EventHandler, filter?: (event: NewsSourcerEvent) => boolean): EventSubscription {
    const subscription: EventSubscription = {
      id: `sub_${++this.subscriptionCounter}`,
      eventType,
      handler,
      filter,
      createdAt: new Date()
    }
    
    this.subscriptions.set(subscription.id, subscription)
    
    logger.info('Event subscription created', { 
      id: subscription.id, 
      eventType, 
      totalSubscriptions: this.subscriptions.size 
    })
    
    return subscription
  }

  /**
   * Unsubscribe from events
   */
  unsubscribe(subscriptionId: string): boolean {
    const deleted = this.subscriptions.delete(subscriptionId)
    
    if (deleted) {
      logger.info('Event subscription removed', { 
        id: subscriptionId, 
        totalSubscriptions: this.subscriptions.size 
      })
    }
    
    return deleted
  }

  /**
   * Register a webhook for event notifications
   */
  registerWebhook(id: string, config: WebhookConfig): void {
    this.webhooks.set(id, config)
    
    logger.info('Webhook registered', { 
      id, 
      url: config.url, 
      events: config.events,
      totalWebhooks: this.webhooks.size 
    })
  }

  /**
   * Unregister a webhook
   */
  unregisterWebhook(id: string): boolean {
    const deleted = this.webhooks.delete(id)
    
    if (deleted) {
      logger.info('Webhook unregistered', { 
        id, 
        totalWebhooks: this.webhooks.size 
      })
    }
    
    return deleted
  }

  /**
   * Get event history from buffer
   */
  getEventHistory(eventType?: string, limit?: number): NewsSourcerEvent[] {
    let events = this.eventBuffer
    
    if (eventType) {
      events = events.filter(e => e.type === eventType)
    }
    
    if (limit) {
      events = events.slice(-limit)
    }
    
    return events.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
  }

  /**
   * Get webhook delivery status
   */
  getWebhookDeliveries(webhookId?: string, limit?: number): WebhookDelivery[] {
    let deliveries = this.deliveryQueue
    
    if (webhookId) {
      deliveries = deliveries.filter(d => d.webhookUrl.includes(webhookId))
    }
    
    if (limit) {
      deliveries = deliveries.slice(-limit)
    }
    
    return deliveries.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
  }

  /**
   * Start processing webhook delivery queue
   */
  startWebhookProcessing(): void {
    if (this.processingInterval) {
      clearInterval(this.processingInterval)
    }
    
    this.processingInterval = setInterval(async () => {
      await this.processWebhookQueue()
    }, 1000) // Process every second
    
    logger.info('Webhook processing started')
  }

  /**
   * Stop processing webhook delivery queue
   */
  stopWebhookProcessing(): void {
    if (this.processingInterval) {
      clearInterval(this.processingInterval)
      this.processingInterval = null
      logger.info('Webhook processing stopped')
    }
  }

  /**
   * Wait for webhook processing to complete (for testing)
   */
  async waitForWebhookProcessing(timeoutMs = 5000): Promise<void> {
    const startTime = Date.now()
    
    while (Date.now() - startTime < timeoutMs) {
      const pendingDeliveries = this.deliveryQueue.filter(d => d.status === 'pending')
      if (pendingDeliveries.length === 0) {
        return
      }
      
      // Wait a bit and check again
      await new Promise(resolve => setTimeout(resolve, 100))
    }
    
    // If we reach here, there are still pending deliveries
    const pendingCount = this.deliveryQueue.filter(d => d.status === 'pending').length
    logger.warn(`Webhook processing timeout: ${pendingCount} deliveries still pending`)
  }

  /**
   * Get system statistics
   */
  getStats(): {
    subscriptions: number
    webhooks: number
    eventBuffer: number
    deliveryQueue: number
    deliveryStats: {
      pending: number
      delivered: number
      failed: number
    }
  } {
    const deliveryStats = {
      pending: 0,
      delivered: 0,
      failed: 0
    }
    
    for (const delivery of this.deliveryQueue) {
      deliveryStats[delivery.status]++
    }
    
    return {
      subscriptions: this.subscriptions.size,
      webhooks: this.webhooks.size,
      eventBuffer: this.eventBuffer.length,
      deliveryQueue: this.deliveryQueue.length,
      deliveryStats
    }
  }

  /**
   * Clear event buffer and delivery queue
   */
  clear(): void {
    this.eventBuffer = []
    this.deliveryQueue = []
    logger.info('Event system cleared')
  }

  private async processSubscriptions(event: NewsSourcerEvent): Promise<void> {
    const promises: Promise<void>[] = []
    
    for (const subscription of this.subscriptions.values()) {
      if (subscription.eventType === event.type || subscription.eventType === '*') {
        if (!subscription.filter || subscription.filter(event)) {
          promises.push(this.executeHandler(subscription, event))
        }
      }
    }
    
    await Promise.allSettled(promises)
  }

  private async executeHandler(subscription: EventSubscription, event: NewsSourcerEvent): Promise<void> {
    try {
      await subscription.handler(event)
    } catch (error) {
      logger.error('Event handler failed', { 
        subscriptionId: subscription.id, 
        eventType: event.type, 
        error 
      })
    }
  }

  private async processWebhooks(event: NewsSourcerEvent): Promise<void> {
    for (const [webhookId, webhook] of this.webhooks) {
      if (webhook.events.includes(event.type) || webhook.events.includes('*')) {
        await this.queueWebhookDelivery(webhookId, webhook, event)
      }
    }
  }

  private async queueWebhookDelivery(webhookId: string, webhook: WebhookConfig, event: NewsSourcerEvent): Promise<void> {
    const payload: WebhookPayload = {
      event: event.type,
      timestamp: event.timestamp,
      data: event.data,
      metadata: event.metadata
    }
    
    const delivery: WebhookDelivery = {
      id: `delivery_${++this.deliveryCounter}`,
      webhookUrl: webhook.url,
      event: event.type,
      payload,
      attempts: 0,
      maxAttempts: webhook.retryCount || this.config.webhooks.maxRetries,
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date()
    }
    
    this.deliveryQueue.push(delivery)
    
    // Trim queue if too large
    if (this.deliveryQueue.length > this.config.webhooks.queueSize) {
      this.deliveryQueue = this.deliveryQueue.slice(-this.config.webhooks.queueSize)
    }
  }

  private async processWebhookQueue(): Promise<void> {
    const now = new Date()
    const pendingDeliveries = this.deliveryQueue.filter(d => 
      d.status === 'pending' && 
      (!d.nextAttemptAt || d.nextAttemptAt <= now)
    )
    
    const promises = pendingDeliveries.map(delivery => this.deliverWebhook(delivery))
    await Promise.allSettled(promises)
  }

  private async deliverWebhook(delivery: WebhookDelivery): Promise<void> {
    delivery.attempts++
    delivery.lastAttemptAt = new Date()
    
    try {
      const webhook = Array.from(this.webhooks.values()).find(w => w.url === delivery.webhookUrl)
      if (!webhook) {
        delivery.status = 'failed'
        delivery.error = 'Webhook configuration not found'
        return
      }
      
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'User-Agent': 'NewsSourcer-Webhook/1.0',
        ...webhook.headers
      }
      
      // Add signature if secret is provided
      if (webhook.secret) {
        const signature = this.generateSignature(delivery.payload, webhook.secret)
        headers['X-Webhook-Signature'] = signature
      }
      
      const response = await axios.post(delivery.webhookUrl, delivery.payload, {
        headers,
        timeout: webhook.timeout || this.config.webhooks.timeout
      })
      
      if (response.status >= 200 && response.status < 300) {
        delivery.status = 'delivered'
        delivery.error = undefined
        
        logger.debug('Webhook delivered successfully', {
          deliveryId: delivery.id,
          webhookUrl: delivery.webhookUrl,
          status: response.status,
          attempts: delivery.attempts
        })
      } else {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }
      
    } catch (error) {
      delivery.error = error instanceof Error ? error.message : 'Unknown error'
      
      if (delivery.attempts >= delivery.maxAttempts) {
        delivery.status = 'failed'
        logger.error('Webhook delivery failed permanently', {
          deliveryId: delivery.id,
          webhookUrl: delivery.webhookUrl,
          attempts: delivery.attempts,
          error: delivery.error
        })
      } else {
        // Schedule retry
        const delay = this.config.webhooks.retryDelay * Math.pow(2, delivery.attempts - 1)
        delivery.nextAttemptAt = new Date(Date.now() + delay)
        
        logger.warn('Webhook delivery failed, will retry', {
          deliveryId: delivery.id,
          webhookUrl: delivery.webhookUrl,
          attempts: delivery.attempts,
          nextAttemptAt: delivery.nextAttemptAt,
          error: delivery.error
        })
      }
    }
    
    delivery.updatedAt = new Date()
  }

  private generateSignature(payload: WebhookPayload, secret: string): string {
    const body = JSON.stringify(payload)
    const signature = crypto.createHmac('sha256', secret).update(body).digest('hex')
    return `sha256=${signature}`
  }

  /**
   * Helper method to emit endpoint update notifications
   */
  async emitEndpointUpdate(notification: EndpointUpdateNotification): Promise<void> {
    const event: NewsSourcerEvent = {
      type: notification.type,
      timestamp: notification.timestamp,
      data: {
        endpointId: notification.endpointId,
        sourceId: notification.sourceId,
        ...notification.data
      },
      metadata: notification.metadata
    }
    
    await this.emit(event)
  }
}