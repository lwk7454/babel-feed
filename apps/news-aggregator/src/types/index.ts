export interface NewsSource {
  id: string;
  name: string;
  slug: string;
  url: string;
  sourceType: 'rss' | 'api' | 'scraper';
  language: string;
  category: string;
  tags: string[];
  enabled: boolean;
  pollingInterval: number;
  reliability: number; // 0-100 score
  priority: number; // 1-10
  metadata: Record<string, unknown>;
  lastFetched?: Date;
  lastSuccess?: Date;
  lastError?: string;
  errorCount: number;
  successCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface RawArticle {
  url: string;
  title: string;
  description?: string;
  content?: string;
  imageUrl?: string;
  publishedAt: Date;
  author?: string;
  source: string;
  sourceLanguage: string;
  tags?: string[];
  metadata?: Record<string, unknown>;
}

export interface ProcessedArticle extends RawArticle {
  id: string;
  contentHash: string;
  summary?: string;
  translations?: Record<string, ArticleTranslation>;
  qualityScore: number;
  categories: string[];
  sentiment?: number;
  readingTime?: number;
  processed: boolean;
}

export interface ArticleTranslation {
  title: string;
  summary?: string;
  content?: string;
  language: string;
  quality?: number;
  model?: string;
  translatedAt: Date;
}

export interface SourceHealth {
  sourceId: string;
  lastCheck: Date;
  isHealthy: boolean;
  responseTime: number;
  errorCount: number;
  successCount: number;
  lastError?: string;
  uptime: number; // percentage
}

export interface ProcessingStats {
  articlesProcessed: number;
  translationsGenerated: number;
  duplicatesFiltered: number;
  errorsEncountered: number;
  averageProcessingTime: number;
  cacheHitRate: number;
}

export interface AIProcessingResult {
  summary?: string;
  translation?: string;
  categories?: string[];
  sentiment?: number;
  qualityScore?: number;
  confidence?: number;
  model?: string;
  processingTime?: number;
}

export interface CacheEntry<T = unknown> {
  key: string;
  value: T;
  createdAt: Date;
  expiresAt: Date;
  hitCount: number;
  lastAccessed: Date;
}

export type SupportedLanguage = 'en' | 'zh-CN' | 'zh-TW' | 'ja';

export interface TranslationRequest {
  text: string;
  sourceLanguage: SupportedLanguage;
  targetLanguage: SupportedLanguage;
  model?: string;
  useCache?: boolean;
}

export interface TranslationResponse {
  translatedText: string;
  confidence: number;
  model: string;
  cached: boolean;
  processingTime: number;
}

export interface AiProvider {
  id: string;
  name: string;
  displayName: string;
  providerType: string;
  baseUrl: string;
  enabled: boolean;
  priority: number;
  maxRequestsPerMinute: number;
  maxRequestsPerHour: number;
  maxRequestsPerDay: number;
  circuitBreakerThreshold: number;
  circuitBreakerTimeout: number;
  healthCheckInterval: number;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface AiProviderKey {
  id: string;
  providerId: string;
  keyName: string;
  apiKey: string;
  enabled: boolean;
  priority: number;
  currentUsage: number;
  dailyQuota?: number;
  monthlyQuota?: number;
  lastUsed?: Date;
  lastReset: Date;
  rateLimitHits: number;
  errorCount: number;
  successCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CircuitBreakerState {
  id: string;
  providerId: string;
  keyId?: string;
  state: 'closed' | 'open' | 'half_open';
  failureCount: number;
  lastFailure?: Date;
  lastSuccess?: Date;
  nextAttempt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProviderHealthStatus {
  providerId: string;
  healthy: boolean;
  circuitState: 'closed' | 'open' | 'half_open';
  availableKeys: number;
  totalKeys: number;
  errorRate: number;
  responseTime: number;
  lastCheck: Date;
}