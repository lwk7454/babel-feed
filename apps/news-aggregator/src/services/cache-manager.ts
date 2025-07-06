import { logger } from '../modules/common/logger';
import { CacheEntry } from '../modules/common/types';
import { config } from '../modules/common/config';

export class CacheManager<T = unknown> {
  private cache = new Map<string, CacheEntry<T>>();
  private cleanupInterval?: NodeJS.Timeout;

  constructor(
    private name: string,
    private defaultMaxAge: number = config.aggregator.contentCacheMaxAge
  ) {
    this.startCleanupTimer();
  }

  async get(key: string): Promise<T | null> {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return null;
    }

    // Check if expired
    if (entry.expiresAt && Date.now() > entry.expiresAt.getTime()) {
      this.cache.delete(key);
      logger.debug(`Cache entry expired and removed: ${key}`, { cache: this.name });
      return null;
    }

    // Update access statistics
    if (entry.hitCount !== undefined) {
      entry.hitCount++;
    } else {
      entry.hitCount = 1;
    }
    entry.lastAccessed = new Date();

    logger.debug(`Cache hit: ${key}`, { 
      cache: this.name, 
      hitCount: entry.hitCount,
      age: Date.now() - entry.createdAt.getTime()
    });

    return entry.value;
  }

  async set(key: string, value: T, maxAge?: number): Promise<void> {
    const effectiveMaxAge = maxAge || this.defaultMaxAge;
    const now = new Date();

    const entry: CacheEntry<T> = {
      key,
      value,
      createdAt: now,
      expiresAt: new Date(now.getTime() + effectiveMaxAge),
      hitCount: 0,
      lastAccessed: now,
    };

    this.cache.set(key, entry);

    logger.debug(`Cache set: ${key}`, { 
      cache: this.name, 
      maxAge: effectiveMaxAge,
      expiresAt: entry.expiresAt
    });
  }

  async delete(key: string): Promise<boolean> {
    const deleted = this.cache.delete(key);
    
    if (deleted) {
      logger.debug(`Cache entry deleted: ${key}`, { cache: this.name });
    }

    return deleted;
  }

  async clear(): Promise<void> {
    const size = this.cache.size;
    this.cache.clear();
    
    logger.info(`Cache cleared: ${size} entries removed`, { cache: this.name });
  }

  async has(key: string): Promise<boolean> {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return false;
    }

    // Check if expired
    if (entry.expiresAt && Date.now() > entry.expiresAt.getTime()) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  async keys(): Promise<string[]> {
    // Clean expired entries first
    await this.cleanup();
    return Array.from(this.cache.keys());
  }

  async size(): Promise<number> {
    // Clean expired entries first
    await this.cleanup();
    return this.cache.size;
  }

  async getStats(): Promise<{
    name: string;
    size: number;
    totalHits: number;
    oldestEntry?: Date;
    newestEntry?: Date;
    hitRate: number;
  }> {
    await this.cleanup();

    let totalHits = 0;
    let oldestEntry: Date | undefined;
    let newestEntry: Date | undefined;

    for (const entry of this.cache.values()) {
      totalHits += entry.hitCount ?? 0;
      
      if (!oldestEntry || entry.createdAt < oldestEntry) {
        oldestEntry = entry.createdAt;
      }
      
      if (!newestEntry || entry.createdAt > newestEntry) {
        newestEntry = entry.createdAt;
      }
    }

    const size = this.cache.size;
    const hitRate = size > 0 ? totalHits / size : 0;

    return {
      name: this.name,
      size,
      totalHits,
      oldestEntry,
      newestEntry,
      hitRate,
    };
  }

  private async cleanup(): Promise<number> {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.expiresAt && now > entry.expiresAt.getTime()) {
        this.cache.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      logger.debug(`Cache cleanup: ${cleaned} expired entries removed`, { cache: this.name });
    }

    return cleaned;
  }

  private startCleanupTimer(): void {
    // Run cleanup every 5 minutes
    this.cleanupInterval = setInterval(() => {
      this.cleanup().catch((error) => {
        logger.error(`Cache cleanup failed for ${this.name}:`, error);
      });
    }, 5 * 60 * 1000);

    logger.debug(`Cache cleanup timer started for ${this.name}`);
  }

  async destroy(): Promise<void> {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = undefined;
    }

    await this.clear();
    logger.info(`Cache manager destroyed: ${this.name}`);
  }

  // Utility methods for specific cache types
  async getOrSet(
    key: string, 
    factory: () => Promise<T>, 
    maxAge?: number
  ): Promise<T> {
    let value = await this.get(key);
    
    if (value === null) {
      logger.debug(`Cache miss, generating value: ${key}`, { cache: this.name });
      value = await factory();
      await this.set(key, value, maxAge);
    }

    return value;
  }

  // Translation-specific cache methods
  static createTranslationCache(): CacheManager<string> {
    return new CacheManager<string>('translation-cache', config.aggregator.translationCacheMaxAge);
  }

  static createContentCache(): CacheManager<unknown> {
    return new CacheManager<unknown>('content-cache', config.aggregator.contentCacheMaxAge);
  }
}