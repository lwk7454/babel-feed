/**
 * Structured logging system for news-extractor
 * Provides comprehensive logging with error recovery
 */

export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3
}

export interface LogEntry {
  timestamp: string
  level: LogLevel
  component: string
  message: string
  metadata?: Record<string, any>
  error?: Error
}

export interface LoggerConfig {
  level: LogLevel
  enableConsole: boolean
  enableFile?: boolean
  filePath?: string
  maxEntries?: number
}

export class Logger {
  private config: LoggerConfig
  private entries: LogEntry[] = []

  constructor(config: Partial<LoggerConfig> = {}) {
    this.config = {
      level: LogLevel.INFO,
      enableConsole: true,
      enableFile: false,
      maxEntries: 1000,
      ...config
    }
  }

  error(component: string, message: string, error?: Error, metadata?: Record<string, any>): void {
    this.log(LogLevel.ERROR, component, message, metadata, error)
  }

  warn(component: string, message: string, metadata?: Record<string, any>): void {
    this.log(LogLevel.WARN, component, message, metadata)
  }

  info(component: string, message: string, metadata?: Record<string, any>): void {
    this.log(LogLevel.INFO, component, message, metadata)
  }

  debug(component: string, message: string, metadata?: Record<string, any>): void {
    this.log(LogLevel.DEBUG, component, message, metadata)
  }

  private log(level: LogLevel, component: string, message: string, metadata?: Record<string, any>, error?: Error): void {
    if (level > this.config.level) return

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      component,
      message,
      metadata,
      error
    }

    this.entries.push(entry)

    // Limit memory usage
    if (this.entries.length > (this.config.maxEntries || 1000)) {
      this.entries = this.entries.slice(-500) // Keep last 500 entries
    }

    if (this.config.enableConsole) {
      this.logToConsole(entry)
    }
  }

  private logToConsole(entry: LogEntry): void {
    const levelNames = ['ERROR', 'WARN', 'INFO', 'DEBUG']
    const levelName = levelNames[entry.level]
    
    const baseMessage = `[${entry.timestamp}] ${levelName} [${entry.component}] ${entry.message}`
    
    const consoleMethod = entry.level === LogLevel.ERROR ? 'error' 
                        : entry.level === LogLevel.WARN ? 'warn'
                        : 'log'

    if (entry.metadata || entry.error) {
      console[consoleMethod](baseMessage, {
        ...(entry.metadata || {}),
        ...(entry.error ? { error: entry.error.message, stack: entry.error.stack } : {})
      })
    } else {
      console[consoleMethod](baseMessage)
    }
  }

  getEntries(level?: LogLevel): LogEntry[] {
    if (level === undefined) return [...this.entries]
    return this.entries.filter(entry => entry.level <= level)
  }

  clearEntries(): void {
    this.entries = []
  }

  setLevel(level: LogLevel): void {
    this.config.level = level
  }
}

// Global logger instance
export const logger = new Logger()