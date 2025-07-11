// Simple logger implementation
class Logger {
  private getTimestamp(): string {
    return new Date().toISOString()
  }

  private formatMessage(level: string, message: string, ...args: unknown[]): string {
    const timestamp = this.getTimestamp()
    const formattedArgs = args.length > 0
      ? ' ' + args.map(arg => {
          if (typeof arg === 'object') {
            try {
              return JSON.stringify(arg)
            } catch (e) {
              return arg instanceof Error ? arg.message : '[Object]'
            }
          }
          return String(arg)
        }).join(' ')
      : ''
    return `[${timestamp}] ${level.toUpperCase()}: ${message}${formattedArgs}`
  }

  info(message: string, ...args: unknown[]): void {
    console.log(this.formatMessage('info', message, ...args))
  }

  error(message: string, ...args: unknown[]): void {
    console.error(this.formatMessage('error', message, ...args))
  }

  warn(message: string, ...args: unknown[]): void {
    console.warn(this.formatMessage('warn', message, ...args))
  }

  debug(message: string, ...args: unknown[]): void {
    console.debug(this.formatMessage('debug', message, ...args))
  }
}

export const logger = new Logger()

// TODO: Enhanced logging utilities can be added here
// - Structured logging with additional context
// - Performance metrics logging
// - Error tracking with context
