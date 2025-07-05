import { eq, and, desc, asc, gte } from 'drizzle-orm';
import { 
  aiProviders, 
  aiProviderKeys,
  circuitBreakerStates,
  type AiProvider as DbAiProvider,
  type AiProviderKey as DbAiProviderKey,
  type NewAiProvider,
  type NewAiProviderKey,
  getDatabase
} from '../../../../packages/pgdb/src';
import { logger } from '../utils/logger';
import { AiProvider, AiProviderKey, ProviderHealthStatus } from '../types';
import { CircuitBreaker, CircuitBreakerOptions } from './circuit-breaker';
import { AggregatorError, ValidationError } from '../utils/errors';

export class AiProviderManager {
  private db = getDatabase();
  private circuitBreakers = new Map<string, CircuitBreaker>();
  private keyRotationIndex = new Map<string, number>();
  private rateLimitTracking = new Map<string, { count: number; resetTime: number }>();

  async initialize(): Promise<void> {
    logger.info('Initializing AI provider manager...');
    
    // Seed initial providers if none exist
    const existingProviders = await this.getAllProviders();
    if (existingProviders.length === 0) {
      await this.seedInitialProviders();
    }

    // Initialize circuit breakers for all providers and keys
    await this.initializeCircuitBreakers();
    
    // Start periodic cleanup and monitoring
    this.startPeriodicTasks();
    
    logger.info(`AI provider manager initialized with ${existingProviders.length} providers`);
  }

  async getAllProviders(): Promise<AiProvider[]> {
    try {
      const providers = await this.db
        .select()
        .from(aiProviders)
        .orderBy(desc(aiProviders.priority), asc(aiProviders.name));

      return providers.map(this.mapDbProviderToAiProvider);
    } catch (error) {
      logger.error('Failed to fetch AI providers:', error);
      throw new AggregatorError('Failed to fetch AI providers from database', 'DATABASE_ERROR');
    }
  }

  async getEnabledProviders(providerType?: string): Promise<AiProvider[]> {
    try {
      let query = this.db
        .select()
        .from(aiProviders)
        .where(eq(aiProviders.enabled, true));

      if (providerType) {
        query = query.where(and(
          eq(aiProviders.enabled, true),
          eq(aiProviders.providerType, providerType)
        ));
      }

      const providers = await query.orderBy(desc(aiProviders.priority), asc(aiProviders.name));
      return providers.map(this.mapDbProviderToAiProvider);
    } catch (error) {
      logger.error('Failed to fetch enabled AI providers:', error);
      throw new AggregatorError('Failed to fetch enabled AI providers', 'DATABASE_ERROR');
    }
  }

  async getProviderKeys(providerId: string): Promise<AiProviderKey[]> {
    try {
      const keys = await this.db
        .select()
        .from(aiProviderKeys)
        .where(and(
          eq(aiProviderKeys.providerId, providerId),
          eq(aiProviderKeys.enabled, true)
        ))
        .orderBy(desc(aiProviderKeys.priority), asc(aiProviderKeys.keyName));

      return keys.map(this.mapDbKeyToAiProviderKey);
    } catch (error) {
      logger.error(`Failed to fetch keys for provider ${providerId}:`, error);
      throw new AggregatorError('Failed to fetch provider keys', 'DATABASE_ERROR');
    }
  }

  async getAvailableKey(providerId: string): Promise<AiProviderKey | null> {
    const keys = await this.getProviderKeys(providerId);
    if (keys.length === 0) return null;

    // Filter out keys with circuit breakers open
    const availableKeys = keys.filter(key => {
      const circuitBreaker = this.circuitBreakers.get(`${providerId}:${key.id}`);
      return !circuitBreaker || !circuitBreaker.isOpen();
    });

    if (availableKeys.length === 0) return null;

    // Use round-robin rotation
    const currentIndex = this.keyRotationIndex.get(providerId) || 0;
    const selectedKey = availableKeys[currentIndex % availableKeys.length];
    this.keyRotationIndex.set(providerId, (currentIndex + 1) % availableKeys.length);

    // Check rate limits
    if (this.isRateLimited(selectedKey)) {
      // Try next available key
      const nextIndex = (currentIndex + 1) % availableKeys.length;
      if (nextIndex !== currentIndex) {
        this.keyRotationIndex.set(providerId, nextIndex);
        return this.getAvailableKey(providerId);
      }
      return null; // All keys rate limited
    }

    return selectedKey;
  }

  async executeWithProvider<T>(
    providerId: string,
    operation: (provider: AiProvider, key: AiProviderKey) => Promise<T>,
    retries = 3
  ): Promise<T> {
    const provider = await this.getProviderById(providerId);
    if (!provider || !provider.enabled) {
      throw new AggregatorError(`Provider ${providerId} not found or disabled`, 'PROVIDER_UNAVAILABLE');
    }

    let lastError: unknown;

    for (let attempt = 0; attempt < retries; attempt++) {
      const key = await this.getAvailableKey(providerId);
      if (!key) {
        logger.warn(`No available keys for provider ${providerId} on attempt ${attempt + 1}`);
        if (attempt < retries - 1) {
          await this.delay(Math.pow(2, attempt) * 1000); // Exponential backoff
          continue;
        }
        throw new AggregatorError(`No available keys for provider ${providerId}`, 'NO_AVAILABLE_KEYS');
      }

      const circuitBreaker = this.getOrCreateCircuitBreaker(providerId, key.id);

      try {
        const result = await circuitBreaker.execute(async () => {
          this.trackRateLimit(key);
          const startTime = Date.now();
          
          try {
            const result = await operation(provider, key);
            
            // Update success metrics
            await this.updateKeyMetrics(key.id, {
              lastUsed: new Date(),
              successCount: key.successCount + 1,
              currentUsage: key.currentUsage + 1
            });

            logger.debug(`AI operation successful for ${providerId}:${key.keyName} in ${Date.now() - startTime}ms`);
            return result;
          } catch (error) {
            // Handle rate limit errors specially
            if (this.isRateLimitError(error)) {
              await this.handleRateLimit(key);
              throw new AggregatorError('Rate limit exceeded', 'RATE_LIMIT', 429);
            }

            // Update error metrics
            await this.updateKeyMetrics(key.id, {
              errorCount: key.errorCount + 1,
              rateLimitHits: this.isRateLimitError(error) ? key.rateLimitHits + 1 : key.rateLimitHits
            });

            throw error;
          }
        });

        return result;
      } catch (error) {
        lastError = error;
        logger.warn(`AI operation failed for ${providerId}:${key.keyName} on attempt ${attempt + 1}:`, error);
        
        if (attempt < retries - 1) {
          await this.delay(Math.pow(2, attempt) * 1000 + Math.random() * 1000); // Jitter
        }
      }
    }

    throw new AggregatorError(
      `All retries exhausted for provider ${providerId}`,
      'OPERATION_FAILED',
      500,
      { lastError }
    );
  }

  async getProviderHealth(providerId: string): Promise<ProviderHealthStatus> {
    const provider = await this.getProviderById(providerId);
    const keys = await this.getProviderKeys(providerId);
    
    if (!provider) {
      throw new AggregatorError(`Provider ${providerId} not found`, 'NOT_FOUND', 404);
    }

    const availableKeys = keys.filter(key => {
      const circuitBreaker = this.circuitBreakers.get(`${providerId}:${key.id}`);
      return !circuitBreaker || !circuitBreaker.isOpen();
    });

    const totalRequests = keys.reduce((sum, key) => sum + key.successCount + key.errorCount, 0);
    const errorCount = keys.reduce((sum, key) => sum + key.errorCount, 0);
    const errorRate = totalRequests > 0 ? (errorCount / totalRequests) * 100 : 0;

    // Get overall circuit state (worst case)
    let circuitState: 'closed' | 'open' | 'half_open' = 'closed';
    for (const key of keys) {
      const breaker = this.circuitBreakers.get(`${providerId}:${key.id}`);
      if (breaker?.isOpen()) {
        circuitState = 'open';
        break;
      } else if (breaker?.isHalfOpen()) {
        circuitState = 'half_open';
      }
    }

    return {
      providerId,
      healthy: provider.enabled && availableKeys.length > 0 && errorRate < 50,
      circuitState,
      availableKeys: availableKeys.length,
      totalKeys: keys.length,
      errorRate,
      responseTime: 0, // TODO: Calculate from recent operations
      lastCheck: new Date()
    };
  }

  private async getProviderById(id: string): Promise<AiProvider | null> {
    try {
      const providers = await this.db
        .select()
        .from(aiProviders)
        .where(eq(aiProviders.id, id))
        .limit(1);

      return providers.length > 0 ? this.mapDbProviderToAiProvider(providers[0]) : null;
    } catch (error) {
      logger.error(`Failed to fetch provider ${id}:`, error);
      return null;
    }
  }

  private getOrCreateCircuitBreaker(providerId: string, keyId: string): CircuitBreaker {
    const breakerId = `${providerId}:${keyId}`;
    
    if (!this.circuitBreakers.has(breakerId)) {
      // Get provider settings for circuit breaker options
      this.getProviderById(providerId).then(provider => {
        if (provider) {
          const options: CircuitBreakerOptions = {
            failureThreshold: provider.circuitBreakerThreshold,
            timeout: provider.circuitBreakerTimeout,
            monitoringWindow: provider.healthCheckInterval
          };
          
          this.circuitBreakers.set(breakerId, new CircuitBreaker(breakerId, options));
        }
      });
      
      // Create with default options in the meantime
      const defaultOptions: CircuitBreakerOptions = {
        failureThreshold: 5,
        timeout: 60000,
        monitoringWindow: 30000
      };
      
      this.circuitBreakers.set(breakerId, new CircuitBreaker(breakerId, defaultOptions));
    }

    return this.circuitBreakers.get(breakerId)!;
  }

  private isRateLimited(key: AiProviderKey): boolean {
    const trackingKey = key.id;
    const tracking = this.rateLimitTracking.get(trackingKey);
    
    if (!tracking) return false;
    
    const now = Date.now();
    if (now >= tracking.resetTime) {
      this.rateLimitTracking.delete(trackingKey);
      return false;
    }
    
    // Check daily quota
    if (key.dailyQuota && key.currentUsage >= key.dailyQuota) {
      return true;
    }
    
    // Check rate limits (simplified - could be more sophisticated)
    return tracking.count >= 60; // 60 requests per minute
  }

  private trackRateLimit(key: AiProviderKey): void {
    const trackingKey = key.id;
    const now = Date.now();
    const resetTime = now + 60000; // Reset every minute
    
    const tracking = this.rateLimitTracking.get(trackingKey);
    if (!tracking || now >= tracking.resetTime) {
      this.rateLimitTracking.set(trackingKey, { count: 1, resetTime });
    } else {
      tracking.count++;
    }
  }

  private isRateLimitError(error: unknown): boolean {
    if (error instanceof Error) {
      const message = error.message.toLowerCase();
      return message.includes('rate limit') || 
             message.includes('too many requests') ||
             message.includes('quota exceeded');
    }
    return false;
  }

  private async handleRateLimit(key: AiProviderKey): Promise<void> {
    logger.warn(`Rate limit hit for key ${key.keyName}`);
    await this.updateKeyMetrics(key.id, {
      rateLimitHits: key.rateLimitHits + 1
    });
  }

  private async updateKeyMetrics(keyId: string, updates: Partial<AiProviderKey>): Promise<void> {
    try {
      await this.db
        .update(aiProviderKeys)
        .set({
          ...(updates.lastUsed && { lastUsed: updates.lastUsed }),
          ...(updates.successCount !== undefined && { successCount: updates.successCount }),
          ...(updates.errorCount !== undefined && { errorCount: updates.errorCount }),
          ...(updates.rateLimitHits !== undefined && { rateLimitHits: updates.rateLimitHits }),
          ...(updates.currentUsage !== undefined && { currentUsage: updates.currentUsage })
        })
        .where(eq(aiProviderKeys.id, keyId));
    } catch (error) {
      logger.error(`Failed to update key metrics for ${keyId}:`, error);
    }
  }

  private async initializeCircuitBreakers(): Promise<void> {
    const providers = await this.getAllProviders();
    
    for (const provider of providers) {
      const keys = await this.getProviderKeys(provider.id);
      
      for (const key of keys) {
        this.getOrCreateCircuitBreaker(provider.id, key.id);
      }
    }
  }

  private startPeriodicTasks(): void {
    // Reset daily quotas every 24 hours
    setInterval(() => {
      this.resetDailyQuotas();
    }, 24 * 60 * 60 * 1000);

    // Clean up old rate limit tracking
    setInterval(() => {
      this.cleanupRateLimit();
    }, 5 * 60 * 1000);
  }

  private async resetDailyQuotas(): Promise<void> {
    try {
      await this.db
        .update(aiProviderKeys)
        .set({
          currentUsage: 0,
          lastReset: new Date()
        })
        .where(gte(aiProviderKeys.lastReset, new Date(Date.now() - 24 * 60 * 60 * 1000)));
      
      logger.info('Daily quotas reset for all provider keys');
    } catch (error) {
      logger.error('Failed to reset daily quotas:', error);
    }
  }

  private cleanupRateLimit(): void {
    const now = Date.now();
    for (const [key, tracking] of this.rateLimitTracking.entries()) {
      if (now >= tracking.resetTime) {
        this.rateLimitTracking.delete(key);
      }
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private mapDbProviderToAiProvider(dbProvider: DbAiProvider): AiProvider {
    return {
      id: dbProvider.id,
      name: dbProvider.name,
      displayName: dbProvider.displayName,
      providerType: dbProvider.providerType,
      baseUrl: dbProvider.baseUrl,
      enabled: dbProvider.enabled,
      priority: dbProvider.priority,
      maxRequestsPerMinute: dbProvider.maxRequestsPerMinute,
      maxRequestsPerHour: dbProvider.maxRequestsPerHour,
      maxRequestsPerDay: dbProvider.maxRequestsPerDay,
      circuitBreakerThreshold: dbProvider.circuitBreakerThreshold,
      circuitBreakerTimeout: dbProvider.circuitBreakerTimeout,
      healthCheckInterval: dbProvider.healthCheckInterval,
      metadata: (dbProvider.metadata as Record<string, unknown>) || {},
      createdAt: dbProvider.createdAt,
      updatedAt: dbProvider.updatedAt,
    };
  }

  private mapDbKeyToAiProviderKey(dbKey: DbAiProviderKey): AiProviderKey {
    return {
      id: dbKey.id,
      providerId: dbKey.providerId,
      keyName: dbKey.keyName,
      apiKey: dbKey.apiKey,
      enabled: dbKey.enabled,
      priority: dbKey.priority,
      currentUsage: dbKey.currentUsage,
      dailyQuota: dbKey.dailyQuota || undefined,
      monthlyQuota: dbKey.monthlyQuota || undefined,
      lastUsed: dbKey.lastUsed || undefined,
      lastReset: dbKey.lastReset,
      rateLimitHits: dbKey.rateLimitHits,
      errorCount: dbKey.errorCount,
      successCount: dbKey.successCount,
      createdAt: dbKey.createdAt,
      updatedAt: dbKey.updatedAt,
    };
  }

  private async seedInitialProviders(): Promise<void> {
    const initialProviders = [
      {
        name: 'openrouter',
        displayName: 'OpenRouter',
        providerType: 'translation',
        baseUrl: 'https://openrouter.ai/api/v1',
        enabled: true,
        priority: 9,
        maxRequestsPerMinute: 60,
        maxRequestsPerHour: 1000,
        maxRequestsPerDay: 10000,
        circuitBreakerThreshold: 5,
        circuitBreakerTimeout: 60000,
        healthCheckInterval: 30000,
        metadata: { models: ['gpt-3.5-turbo', 'claude-3-haiku'] }
      },
      {
        name: 'huggingface',
        displayName: 'Hugging Face',
        providerType: 'translation',
        baseUrl: 'https://api-inference.huggingface.co',
        enabled: true,
        priority: 7,
        maxRequestsPerMinute: 30,
        maxRequestsPerHour: 500,
        maxRequestsPerDay: 5000,
        circuitBreakerThreshold: 3,
        circuitBreakerTimeout: 120000,
        healthCheckInterval: 60000,
        metadata: { models: ['Helsinki-NLP/opus-mt-en-zh'] }
      }
    ];

    for (const providerData of initialProviders) {
      const [created] = await this.db
        .insert(aiProviders)
        .values(providerData as NewAiProvider)
        .returning();

      logger.info(`Seeded AI provider: ${created.displayName} (${created.id})`);
    }

    logger.info(`Seeded ${initialProviders.length} initial AI providers`);
  }
}