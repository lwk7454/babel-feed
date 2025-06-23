/**
 * Configuration for the news aggregation service
 */

export interface NewsProvider {
  id: string;
  name: string;
  url: string;
  language: string;
  category?: string;
  enabled: boolean;
}

export interface TranslationConfig {
  openRouterApiKey: string;
  baseUrl: string;
  freeModels: string[];
  targetLanguages: string[];
}

export interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
}

export const SUPPORTED_LANGUAGES = ['en', 'zh-CN', 'zh-TW', 'ja'] as const;

export const NEWS_PROVIDERS: NewsProvider[] = [
  // English Sources
  {
    id: 'bbc-world',
    name: 'BBC World News',
    url: 'http://feeds.bbci.co.uk/news/world/rss.xml',
    language: 'en',
    category: 'world',
    enabled: true
  },
  {
    id: 'reuters-world',
    name: 'Reuters World News',
    url: 'https://feeds.reuters.com/reuters/worldNews',
    language: 'en',
    category: 'world', 
    enabled: true
  },
  {
    id: 'techcrunch',
    name: 'TechCrunch',
    url: 'https://feeds.feedburner.com/TechCrunch/',
    language: 'en',
    category: 'technology',
    enabled: true
  },
  
  // Chinese Sources
  {
    id: 'xinhua-cn',
    name: 'Xinhua News',
    url: 'http://www.xinhuanet.com/english/rss/worldrss.xml',
    language: 'zh-CN',
    category: 'world',
    enabled: true
  },
  
  // Japanese Sources
  {
    id: 'nhk-world',
    name: 'NHK World',
    url: 'https://www3.nhk.or.jp/rss/news/cat0.xml',
    language: 'ja',
    category: 'world',
    enabled: true
  }
];

export const TRANSLATION_CONFIG: TranslationConfig = {
  openRouterApiKey: process.env.OPENROUTER_API_KEY || '',
  baseUrl: 'https://openrouter.ai/api/v1',
  freeModels: [
    'meta-llama/llama-3.2-3b-instruct:free',
    'microsoft/phi-3-mini-128k-instruct:free',
    'google/gemma-2-9b-it:free'
  ],
  targetLanguages: SUPPORTED_LANGUAGES.slice()
};

export const DATABASE_CONFIG: DatabaseConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'babel_feed',
  username: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'password'
};

export const AGGREGATION_CONFIG = {
  intervalMinutes: parseInt(process.env.AGGREGATION_INTERVAL || '30'),
  batchSize: parseInt(process.env.BATCH_SIZE || '10'),
  maxArticlesPerProvider: parseInt(process.env.MAX_ARTICLES_PER_PROVIDER || '20'),
  retryAttempts: 3,
  requestTimeout: 30000
};