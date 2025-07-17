/**
 * Performance metrics collection and aggregation
 */

import { logger } from '@babel-feed/utils'

export interface MetricDataPoint {
  timestamp: number
  value: number
  tags?: Record<string, string>
}

export interface MetricSummary {
  count: number
  sum: number
  min: number
  max: number
  avg: number
  p50: number
  p95: number
  p99: number
}

export interface CollectedMetrics {
  counters: Record<string, number>
  gauges: Record<string, number>
  histograms: Record<string, MetricSummary>
  timers: Record<string, MetricSummary>
  rates: Record<string, { count: number; rate: number }>
}

export class MetricsCollector {
  private counters = new Map<string, number>()
  private gauges = new Map<string, number>()
  private histograms = new Map<string, MetricDataPoint[]>()
  private timers = new Map<string, MetricDataPoint[]>()
  private rates = new Map<string, { count: number; lastTimestamp: number }>()
  private readonly maxHistorySize = 10000
  private readonly rateWindowMs = 60000 // 1 minute

  /**
   * Increment a counter metric
   */
  incrementCounter(name: string, value = 1, tags?: Record<string, string>): void {
    const key = this.getMetricKey(name, tags)
    this.counters.set(key, (this.counters.get(key) || 0) + value)
  }

  /**
   * Set a gauge metric value
   */
  setGauge(name: string, value: number, tags?: Record<string, string>): void {
    const key = this.getMetricKey(name, tags)
    this.gauges.set(key, value)
  }

  /**
   * Record a histogram value
   */
  recordHistogram(name: string, value: number, tags?: Record<string, string>): void {
    const key = this.getMetricKey(name, tags)
    const dataPoints = this.histograms.get(key) || []
    
    dataPoints.push({
      timestamp: Date.now(),
      value,
      tags
    })
    
    // Keep only recent data points
    if (dataPoints.length > this.maxHistorySize) {
      dataPoints.splice(0, dataPoints.length - this.maxHistorySize)
    }
    
    this.histograms.set(key, dataPoints)
  }

  /**
   * Record a timer value (duration in milliseconds)
   */
  recordTimer(name: string, duration: number, tags?: Record<string, string>): void {
    const key = this.getMetricKey(name, tags)
    const dataPoints = this.timers.get(key) || []
    
    dataPoints.push({
      timestamp: Date.now(),
      value: duration,
      tags
    })
    
    // Keep only recent data points
    if (dataPoints.length > this.maxHistorySize) {
      dataPoints.splice(0, dataPoints.length - this.maxHistorySize)
    }
    
    this.timers.set(key, dataPoints)
  }

  /**
   * Record a rate metric (events per minute)
   */
  recordRate(name: string, tags?: Record<string, string>): void {
    const key = this.getMetricKey(name, tags)
    const now = Date.now()
    const existing = this.rates.get(key)
    
    if (existing) {
      // Reset counter if more than rate window has passed
      if (now - existing.lastTimestamp > this.rateWindowMs) {
        existing.count = 1
        existing.lastTimestamp = now
      } else {
        existing.count++
      }
    } else {
      this.rates.set(key, { count: 1, lastTimestamp: now })
    }
  }

  /**
   * Time a function execution
   */
  async time<T>(name: string, fn: () => Promise<T>, tags?: Record<string, string>): Promise<T> {
    const startTime = Date.now()
    try {
      const result = await fn()
      this.recordTimer(name, Date.now() - startTime, tags)
      return result
    } catch (error) {
      this.recordTimer(name, Date.now() - startTime, { ...tags, error: 'true' })
      throw error
    }
  }

  /**
   * Get all collected metrics
   */
  getMetrics(): CollectedMetrics {
    const result: CollectedMetrics = {
      counters: Object.fromEntries(this.counters),
      gauges: Object.fromEntries(this.gauges),
      histograms: {},
      timers: {},
      rates: {}
    }

    // Process histograms
    for (const [key, dataPoints] of this.histograms) {
      result.histograms[key] = this.calculateSummary(dataPoints)
    }

    // Process timers
    for (const [key, dataPoints] of this.timers) {
      result.timers[key] = this.calculateSummary(dataPoints)
    }

    // Process rates
    const now = Date.now()
    for (const [key, rateData] of this.rates) {
      const timeDiff = now - rateData.lastTimestamp
      const rate = timeDiff > 0 ? (rateData.count / timeDiff) * 60000 : 0 // events per minute
      result.rates[key] = {
        count: rateData.count,
        rate: Math.round(rate * 100) / 100
      }
    }

    return result
  }

  /**
   * Reset all metrics
   */
  reset(): void {
    this.counters.clear()
    this.gauges.clear()
    this.histograms.clear()
    this.timers.clear()
    this.rates.clear()
  }

  /**
   * Get metrics for a specific time window
   */
  getMetricsForWindow(windowMs: number): CollectedMetrics {
    const cutoffTime = Date.now() - windowMs
    const result: CollectedMetrics = {
      counters: Object.fromEntries(this.counters),
      gauges: Object.fromEntries(this.gauges),
      histograms: {},
      timers: {},
      rates: {}
    }

    // Filter histograms by time window
    for (const [key, dataPoints] of this.histograms) {
      const filtered = dataPoints.filter(dp => dp.timestamp >= cutoffTime)
      result.histograms[key] = this.calculateSummary(filtered)
    }

    // Filter timers by time window
    for (const [key, dataPoints] of this.timers) {
      const filtered = dataPoints.filter(dp => dp.timestamp >= cutoffTime)
      result.timers[key] = this.calculateSummary(filtered)
    }

    // Rates are already time-window based
    const now = Date.now()
    for (const [key, rateData] of this.rates) {
      const timeDiff = Math.min(now - rateData.lastTimestamp, windowMs)
      const rate = timeDiff > 0 ? (rateData.count / timeDiff) * 60000 : 0
      result.rates[key] = {
        count: rateData.count,
        rate: Math.round(rate * 100) / 100
      }
    }

    return result
  }

  /**
   * Export metrics in Prometheus format
   */
  exportPrometheusMetrics(): string {
    const metrics = this.getMetrics()
    const lines: string[] = []

    // Export counters
    for (const [key, value] of Object.entries(metrics.counters)) {
      lines.push(`# TYPE ${key} counter`)
      lines.push(`${key} ${value}`)
    }

    // Export gauges
    for (const [key, value] of Object.entries(metrics.gauges)) {
      lines.push(`# TYPE ${key} gauge`)
      lines.push(`${key} ${value}`)
    }

    // Export histograms
    for (const [key, summary] of Object.entries(metrics.histograms)) {
      lines.push(`# TYPE ${key} histogram`)
      lines.push(`${key}_count ${summary.count}`)
      lines.push(`${key}_sum ${summary.sum}`)
      lines.push(`${key}_avg ${summary.avg}`)
      lines.push(`${key}_min ${summary.min}`)
      lines.push(`${key}_max ${summary.max}`)
      lines.push(`${key}_p50 ${summary.p50}`)
      lines.push(`${key}_p95 ${summary.p95}`)
      lines.push(`${key}_p99 ${summary.p99}`)
    }

    // Export timers
    for (const [key, summary] of Object.entries(metrics.timers)) {
      lines.push(`# TYPE ${key}_duration_ms histogram`)
      lines.push(`${key}_duration_ms_count ${summary.count}`)
      lines.push(`${key}_duration_ms_sum ${summary.sum}`)
      lines.push(`${key}_duration_ms_avg ${summary.avg}`)
      lines.push(`${key}_duration_ms_min ${summary.min}`)
      lines.push(`${key}_duration_ms_max ${summary.max}`)
      lines.push(`${key}_duration_ms_p50 ${summary.p50}`)
      lines.push(`${key}_duration_ms_p95 ${summary.p95}`)
      lines.push(`${key}_duration_ms_p99 ${summary.p99}`)
    }

    // Export rates
    for (const [key, rateData] of Object.entries(metrics.rates)) {
      lines.push(`# TYPE ${key}_rate gauge`)
      lines.push(`${key}_rate ${rateData.rate}`)
      lines.push(`${key}_count ${rateData.count}`)
    }

    return lines.join('\n')
  }

  /**
   * Log metrics summary
   */
  logMetricsSummary(windowMs = 300000): void { // 5 minutes default
    const metrics = this.getMetricsForWindow(windowMs)
    
    logger.info('Metrics Summary', {
      counters: Object.keys(metrics.counters).length,
      gauges: Object.keys(metrics.gauges).length,
      histograms: Object.keys(metrics.histograms).length,
      timers: Object.keys(metrics.timers).length,
      rates: Object.keys(metrics.rates).length,
      topCounters: Object.entries(metrics.counters)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 5),
      topRates: Object.entries(metrics.rates)
        .sort(([,a], [,b]) => b.rate - a.rate)
        .slice(0, 5)
        .map(([key, data]) => ({ key, rate: data.rate }))
    })
  }

  private getMetricKey(name: string, tags?: Record<string, string>): string {
    if (!tags || Object.keys(tags).length === 0) {
      return name
    }
    
    const tagString = Object.entries(tags)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}=${value}`)
      .join(',')
    
    return `${name}{${tagString}}`
  }

  private calculateSummary(dataPoints: MetricDataPoint[]): MetricSummary {
    if (dataPoints.length === 0) {
      return { count: 0, sum: 0, min: 0, max: 0, avg: 0, p50: 0, p95: 0, p99: 0 }
    }

    const values = dataPoints.map(dp => dp.value).sort((a, b) => a - b)
    const sum = values.reduce((acc, val) => acc + val, 0)
    const count = values.length

    return {
      count,
      sum,
      min: values[0],
      max: values[count - 1],
      avg: sum / count,
      p50: this.percentile(values, 0.5),
      p95: this.percentile(values, 0.95),
      p99: this.percentile(values, 0.99)
    }
  }

  private percentile(sortedValues: number[], p: number): number {
    if (sortedValues.length === 0) return 0
    
    const index = Math.ceil(sortedValues.length * p) - 1
    return sortedValues[Math.max(0, Math.min(index, sortedValues.length - 1))]
  }
}