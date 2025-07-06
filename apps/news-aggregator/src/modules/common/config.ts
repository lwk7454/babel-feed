// Simple configuration implementation
interface Config {
  environment: string;
  logLevel: string;
  aggregator: {
    defaultPollingInterval: number;
    maxConcurrentSources: number;
    contentCacheMaxAge: number;
    translationCacheMaxAge: number;
  };
}

const config: Config = {
  environment: process.env.NODE_ENV || 'development',
  logLevel: process.env.LOG_LEVEL || 'info',
  aggregator: {
    defaultPollingInterval: parseInt(process.env.POLLING_INTERVAL || '60000'),
    maxConcurrentSources: parseInt(process.env.MAX_CONCURRENT_SOURCES || '10'),
    contentCacheMaxAge: parseInt(process.env.CONTENT_CACHE_MAX_AGE || '3600000'), // 1 hour
    translationCacheMaxAge: parseInt(process.env.TRANSLATION_CACHE_MAX_AGE || '86400000'), // 24 hours
  },
}

export { config }

// TODO: Enhanced configuration management can be added here
// - Environment-specific configuration validation
// - Dynamic configuration updates
// - Configuration change events