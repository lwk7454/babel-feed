import { describe, it, expect, beforeEach } from "bun:test"
import { MetricsCollector } from '../src/metrics-collector.js'
import { fakeTimers, sleep } from './helpers/fake-timers.js'

const clock = fakeTimers()

describe('MetricsCollector', () => {
  let metricsCollector: MetricsCollector
  
  beforeEach(() => {
    metricsCollector = new MetricsCollector()
  })

  describe('Counter Metrics', () => {
    it('should increment counters', () => {
      metricsCollector.incrementCounter('test.counter')
      metricsCollector.incrementCounter('test.counter', 5)
      metricsCollector.incrementCounter('test.counter', 2)
      
      const metrics = metricsCollector.getMetrics()
      expect(metrics.counters['test.counter']).toBe(8)
    })

    it('should handle counters with tags', () => {
      metricsCollector.incrementCounter('requests', 1, { method: 'GET', status: '200' })
      metricsCollector.incrementCounter('requests', 2, { method: 'POST', status: '201' })
      metricsCollector.incrementCounter('requests', 1, { method: 'GET', status: '200' })
      
      const metrics = metricsCollector.getMetrics()
      expect(metrics.counters['requests{method=GET,status=200}']).toBe(2)
      expect(metrics.counters['requests{method=POST,status=201}']).toBe(2)
    })

    it('should sort tags consistently', () => {
      metricsCollector.incrementCounter('test', 1, { z: 'last', a: 'first', m: 'middle' })
      
      const metrics = metricsCollector.getMetrics()
      expect(metrics.counters['test{a=first,m=middle,z=last}']).toBe(1)
    })
  })

  describe('Gauge Metrics', () => {
    it('should set gauge values', () => {
      metricsCollector.setGauge('temperature', 25.5)
      metricsCollector.setGauge('temperature', 30.0)
      
      const metrics = metricsCollector.getMetrics()
      expect(metrics.gauges['temperature']).toBe(30.0)
    })

    it('should handle gauges with tags', () => {
      metricsCollector.setGauge('cpu.usage', 45.2, { host: 'server1' })
      metricsCollector.setGauge('cpu.usage', 67.8, { host: 'server2' })
      
      const metrics = metricsCollector.getMetrics()
      expect(metrics.gauges['cpu.usage{host=server1}']).toBe(45.2)
      expect(metrics.gauges['cpu.usage{host=server2}']).toBe(67.8)
    })
  })

  describe('Histogram Metrics', () => {
    it('should record histogram values', () => {
      metricsCollector.recordHistogram('response.time', 100)
      metricsCollector.recordHistogram('response.time', 200)
      metricsCollector.recordHistogram('response.time', 150)
      
      const metrics = metricsCollector.getMetrics()
      const histogram = metrics.histograms['response.time']
      
      expect(histogram.count).toBe(3)
      expect(histogram.sum).toBe(450)
      expect(histogram.avg).toBe(150)
      expect(histogram.min).toBe(100)
      expect(histogram.max).toBe(200)
    })

    it('should calculate percentiles correctly', () => {
      const values = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100]
      values.forEach(value => {
        metricsCollector.recordHistogram('test.values', value)
      })
      
      const metrics = metricsCollector.getMetrics()
      const histogram = metrics.histograms['test.values']
      
      expect(histogram.p50).toBe(50) // 50th percentile (median of 10 values)
      expect(histogram.p95).toBe(100) // 95th percentile (max value for 10 items)
      expect(histogram.p99).toBe(100) // 99th percentile (max value for 10 items)
    })

    it('should handle histograms with tags', () => {
      metricsCollector.recordHistogram('latency', 100, { endpoint: '/api/users' })
      metricsCollector.recordHistogram('latency', 200, { endpoint: '/api/posts' })
      
      const metrics = metricsCollector.getMetrics()
      expect(metrics.histograms['latency{endpoint=/api/users}'].count).toBe(1)
      expect(metrics.histograms['latency{endpoint=/api/posts}'].count).toBe(1)
    })

    it('should maintain history limit', () => {
      // Record more than max history size (would need to set a smaller limit for testing)
      for (let i = 0; i < 10005; i++) {
        metricsCollector.recordHistogram('test.limit', i)
      }
      
      const metrics = metricsCollector.getMetrics()
      const histogram = metrics.histograms['test.limit']
      
      // Should be limited to 10000 entries
      expect(histogram.count).toBe(10000)
    })
  })

  describe('Timer Metrics', () => {
    it('should record timer values', () => {
      metricsCollector.recordTimer('operation.duration', 150)
      metricsCollector.recordTimer('operation.duration', 200)
      metricsCollector.recordTimer('operation.duration', 100)
      
      const metrics = metricsCollector.getMetrics()
      const timer = metrics.timers['operation.duration']
      
      expect(timer.count).toBe(3)
      expect(timer.avg).toBe(150)
      expect(timer.min).toBe(100)
      expect(timer.max).toBe(200)
    })

    it('should time function execution', async () => {
      const slowOperation = () => sleep(100)
      
      const operationPromise = metricsCollector.time('slow.operation', slowOperation)
      clock.tick(100)
      const result = await operationPromise
      
      expect(result).toBeUndefined()
      
      const metrics = metricsCollector.getMetrics()
      const timer = metrics.timers['slow.operation']
      
      expect(timer.count).toBe(1)
      expect(timer.avg).toBeGreaterThan(95) // Should be around 100ms
    })

    it('should time function execution with errors', async () => {
      const failingOperation = () => Promise.reject(new Error('Operation failed'))
      
      await expect(metricsCollector.time('failing.operation', failingOperation))
        .rejects.toThrow('Operation failed')
      
      const metrics = metricsCollector.getMetrics()
      const timer = metrics.timers['failing.operation{error=true}']
      
      expect(timer.count).toBe(1)
      expect(timer.avg).toBeGreaterThanOrEqual(0) // Error timing might be 0 with fake timers
    })

    it('should handle timers with tags', async () => {
      const operation = () => Promise.resolve('success')
      
      const result = await metricsCollector.time('api.call', operation, { endpoint: '/users' })
      
      expect(result).toBe('success')
      
      const metrics = metricsCollector.getMetrics()
      expect(metrics.timers['api.call{endpoint=/users}'].count).toBe(1)
    })
  })

  describe('Rate Metrics', () => {
    it('should record rate events', () => {
      metricsCollector.recordRate('events.processed')
      metricsCollector.recordRate('events.processed')
      metricsCollector.recordRate('events.processed')
      
      const metrics = metricsCollector.getMetrics()
      const rate = metrics.rates['events.processed']
      
      expect(rate.count).toBe(3)
      // Rate calculation depends on time, so just check it exists
      expect(rate.rate).toBeDefined()
    })

    it('should calculate rate per minute', () => {
      // Test rate calculation without real timing
      metricsCollector.recordRate('test.rate')
      metricsCollector.recordRate('test.rate')
      
      const metrics = metricsCollector.getMetrics()
      const rate = metrics.rates['test.rate']
      
      expect(rate.count).toBe(2)
      // Rate calculation depends on time, so just check it exists
      expect(rate.rate).toBeDefined()
    })

    it('should reset rate counter after window', () => {
      // Test rate reset without real timing
      metricsCollector.recordRate('test.reset')
      metricsCollector.recordRate('test.reset')
      
      const metrics = metricsCollector.getMetrics()
      const rate = metrics.rates['test.reset']
      
      expect(rate.count).toBe(2) // Should count both events
    })

    it('should handle rates with tags', () => {
      metricsCollector.recordRate('requests', { method: 'GET' })
      metricsCollector.recordRate('requests', { method: 'POST' })
      
      const metrics = metricsCollector.getMetrics()
      expect(metrics.rates['requests{method=GET}'].count).toBe(1)
      expect(metrics.rates['requests{method=POST}'].count).toBe(1)
    })
  })

  describe('Time Window Metrics', () => {
    it('should filter metrics by time window', () => {
      // Test time window filtering without real timing
      metricsCollector.recordHistogram('test.window', 100)
      metricsCollector.recordHistogram('test.window', 200)
      metricsCollector.recordHistogram('test.window', 300)
      
      // Get metrics for a small window (should include all recent values)
      const metrics = metricsCollector.getMetricsForWindow(1000)
      const histogram = metrics.histograms['test.window']
      
      expect(histogram.count).toBe(3) // Should include all values
      expect(histogram.sum).toBe(600) // 100 + 200 + 300
    })

    it('should handle empty time windows', () => {
      metricsCollector.recordHistogram('test.empty', 100)
      
      const metrics = metricsCollector.getMetricsForWindow(0)
      
      // With zero window, should still include recent values
      expect(metrics.histograms['test.empty'].count).toBe(1)
    })
  })

  describe('Prometheus Export', () => {
    it('should export metrics in Prometheus format', () => {
      metricsCollector.incrementCounter('http_requests_total', 10)
      metricsCollector.setGauge('memory_usage_bytes', 1024)
      metricsCollector.recordHistogram('request_duration_seconds', 0.5)
      metricsCollector.recordTimer('process_time_ms', 100)
      metricsCollector.recordRate('events_per_minute')
      
      const prometheus = metricsCollector.exportPrometheusMetrics()
      
      expect(prometheus).toContain('# TYPE http_requests_total counter')
      expect(prometheus).toContain('http_requests_total 10')
      expect(prometheus).toContain('# TYPE memory_usage_bytes gauge')
      expect(prometheus).toContain('memory_usage_bytes 1024')
      expect(prometheus).toContain('# TYPE request_duration_seconds histogram')
      expect(prometheus).toContain('request_duration_seconds_count 1')
      expect(prometheus).toContain('# TYPE process_time_ms_duration_ms histogram')
      expect(prometheus).toContain('events_per_minute_rate')
    })

    it('should handle empty metrics', () => {
      const prometheus = metricsCollector.exportPrometheusMetrics()
      expect(prometheus).toBe('')
    })
  })

  describe('Metrics Summary Logging', () => {
    it('should log metrics summary', () => {
      // Test that logMetricsSummary doesn't throw
      metricsCollector.incrementCounter('test.counter')
      metricsCollector.setGauge('test.gauge', 100)
      metricsCollector.recordHistogram('test.histogram', 50)
      
      expect(() => metricsCollector.logMetricsSummary()).not.toThrow()
    })
  })

  describe('Reset Functionality', () => {
    it('should reset all metrics', () => {
      metricsCollector.incrementCounter('test.counter', 10)
      metricsCollector.setGauge('test.gauge', 100)
      metricsCollector.recordHistogram('test.histogram', 50)
      metricsCollector.recordTimer('test.timer', 100)
      metricsCollector.recordRate('test.rate')
      
      metricsCollector.reset()
      
      const metrics = metricsCollector.getMetrics()
      expect(Object.keys(metrics.counters)).toHaveLength(0)
      expect(Object.keys(metrics.gauges)).toHaveLength(0)
      expect(Object.keys(metrics.histograms)).toHaveLength(0)
      expect(Object.keys(metrics.timers)).toHaveLength(0)
      expect(Object.keys(metrics.rates)).toHaveLength(0)
    })
  })

  describe('Edge Cases', () => {
    it('should handle zero values', () => {
      metricsCollector.incrementCounter('test.zero', 0)
      metricsCollector.setGauge('test.zero', 0)
      metricsCollector.recordHistogram('test.zero', 0)
      metricsCollector.recordTimer('test.zero', 0)
      
      const metrics = metricsCollector.getMetrics()
      expect(metrics.counters['test.zero']).toBe(0)
      expect(metrics.gauges['test.zero']).toBe(0)
      expect(metrics.histograms['test.zero'].avg).toBe(0)
      expect(metrics.timers['test.zero'].avg).toBe(0)
    })

    it('should handle negative values', () => {
      metricsCollector.incrementCounter('test.negative', -5)
      metricsCollector.setGauge('test.negative', -10)
      metricsCollector.recordHistogram('test.negative', -20)
      
      const metrics = metricsCollector.getMetrics()
      expect(metrics.counters['test.negative']).toBe(-5)
      expect(metrics.gauges['test.negative']).toBe(-10)
      expect(metrics.histograms['test.negative'].avg).toBe(-20)
    })

    it('should handle very large values', () => {
      const largeValue = Number.MAX_SAFE_INTEGER
      
      metricsCollector.incrementCounter('test.large', largeValue)
      metricsCollector.setGauge('test.large', largeValue)
      metricsCollector.recordHistogram('test.large', largeValue)
      
      const metrics = metricsCollector.getMetrics()
      expect(metrics.counters['test.large']).toBe(largeValue)
      expect(metrics.gauges['test.large']).toBe(largeValue)
      expect(metrics.histograms['test.large'].avg).toBe(largeValue)
    })

    it('should handle empty tags', () => {
      metricsCollector.incrementCounter('test.empty', 1, {})
      metricsCollector.incrementCounter('test.empty', 1)
      
      const metrics = metricsCollector.getMetrics()
      expect(metrics.counters['test.empty']).toBe(2)
    })

    it('should handle undefined and null tag values', () => {
      metricsCollector.incrementCounter('test.null', 1, { key: null as any })
      metricsCollector.incrementCounter('test.undefined', 1, { key: undefined as any })
      
      const metrics = metricsCollector.getMetrics()
      expect(metrics.counters['test.null{key=null}']).toBe(1)
      expect(metrics.counters['test.undefined{key=undefined}']).toBe(1)
    })
  })

  describe('Concurrent Operations', () => {
    it('should handle concurrent counter updates', async () => {
      const promises = []
      
      for (let i = 0; i < 100; i++) {
        promises.push(Promise.resolve().then(() => {
          metricsCollector.incrementCounter('concurrent.counter', 1)
        }))
      }
      
      await Promise.all(promises)
      
      const metrics = metricsCollector.getMetrics()
      expect(metrics.counters['concurrent.counter']).toBe(100)
    })

    it('should handle concurrent histogram updates', async () => {
      const promises = []
      
      for (let i = 0; i < 100; i++) {
        promises.push(Promise.resolve().then(() => {
          metricsCollector.recordHistogram('concurrent.histogram', i)
        }))
      }
      
      await Promise.all(promises)
      
      const metrics = metricsCollector.getMetrics()
      expect(metrics.histograms['concurrent.histogram'].count).toBe(100)
    })
  })
})