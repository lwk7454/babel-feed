import { config as loadEnv } from 'dotenv';

// Load environment variables
loadEnv();

interface AppConfig {
  environment: string;
  logLevel: string;
  database: {
    url: string;
  };
  aggregator: {
    defaultPollingInterval: number;
    maxConcurrentSources: number;
    contentCacheMaxAge: number;
    translationCacheMaxAge: number;
  };
  ai: {
    huggingFaceApiKey?: string;
    summarizationModel: string;
    translationModel: string;
    maxRetries: number;
    requestTimeout: number;
  };
  sources: {
    configPath: string;
    refreshInterval: number;
  };
}

export const config: AppConfig = {
  environment: process.env.NODE_ENV || 'development',
  logLevel: process.env.LOG_LEVEL || 'info',
  
  database: {
    url: process.env.DATABASE_URL || 'postgresql://localhost:5432/babel_feed_dev',
  },
  
  aggregator: {
    defaultPollingInterval: parseInt(process.env.AGGREGATOR_POLLING_INTERVAL || '300000'), // 5 minutes
    maxConcurrentSources: parseInt(process.env.AGGREGATOR_MAX_CONCURRENT || '10'),
    contentCacheMaxAge: parseInt(process.env.CONTENT_CACHE_MAX_AGE || '86400000'), // 24 hours
    translationCacheMaxAge: parseInt(process.env.TRANSLATION_CACHE_MAX_AGE || '604800000'), // 7 days
  },
  
  ai: {
    huggingFaceApiKey: process.env.HUGGING_FACE_API_KEY,
    summarizationModel: process.env.SUMMARIZATION_MODEL || 'facebook/bart-large-cnn',
    translationModel: process.env.TRANSLATION_MODEL || 'Helsinki-NLP/opus-mt-en-zh',
    maxRetries: parseInt(process.env.AI_MAX_RETRIES || '3'),
    requestTimeout: parseInt(process.env.AI_REQUEST_TIMEOUT || '30000'),
  },
  
  sources: {
    configPath: process.env.SOURCES_CONFIG_PATH || './src/config/sources.json',
    refreshInterval: parseInt(process.env.SOURCES_REFRESH_INTERVAL || '3600000'), // 1 hour
  },
};

// Validate required configuration
function validateConfig() {
  const requiredFields: (keyof AppConfig)[] = [];
  
  for (const field of requiredFields) {
    if (!config[field]) {
      throw new Error(`Missing required configuration: ${field}`);
    }
  }
}

validateConfig();