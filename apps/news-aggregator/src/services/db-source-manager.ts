import {
  getDatabase,
  getTestDb,
  newsSources,
  type NewsSource as DbNewsSource,
  type NewNewsSource
} from '@babel-feed/pgdb';
import { asc, desc, eq, inArray } from 'drizzle-orm';
import { NewsSource } from '../types';
import { AggregatorError, ValidationError } from '../utils/errors';
import { logger } from '../utils/logger';

export class DatabaseSourceManager {
  private db = process.env.NODE_ENV === 'test' ? getTestDb() : getDatabase();

  async initialize(): Promise<void> {
    logger.info('Initializing database-based source manager...');
    
    // Seed initial sources if none exist
    const existingSources = await this.getAllSources();
    if (existingSources.length === 0) {
      await this.seedInitialSources();
    }
    
    logger.info(`Database source manager initialized with ${existingSources.length} sources`);
  }

  async getAllSources(): Promise<NewsSource[]> {
    try {
      const sources = await this.db
        .select()
        .from(newsSources)
        .orderBy(asc(newsSources.priority), asc(newsSources.name));

      return sources.map(this.mapDbSourceToNewsSource);
    } catch (error) {
      logger.error('Failed to fetch all sources:', error);
      throw new AggregatorError('Failed to fetch sources from database', 'DATABASE_ERROR');
    }
  }

  async getEnabledSources(): Promise<NewsSource[]> {
    try {
      const sources = await this.db
        .select()
        .from(newsSources)
        .where(eq(newsSources.enabled, true))
        .orderBy(desc(newsSources.priority), asc(newsSources.name));

      return sources.map(this.mapDbSourceToNewsSource);
    } catch (error) {
      logger.error('Failed to fetch enabled sources:', error);
      throw new AggregatorError('Failed to fetch enabled sources from database', 'DATABASE_ERROR');
    }
  }

  async getSourceById(id: string): Promise<NewsSource | null> {
    try {
      const sources = await this.db
        .select()
        .from(newsSources)
        .where(eq(newsSources.id, id))
        .limit(1);

      return sources.length > 0 ? this.mapDbSourceToNewsSource(sources[0]) : null;
    } catch (error) {
      logger.error(`Failed to fetch source ${id}:`, error);
      throw new AggregatorError('Failed to fetch source from database', 'DATABASE_ERROR');
    }
  }

  async getSourceBySlug(slug: string): Promise<NewsSource | null> {
    try {
      const sources = await this.db
        .select()
        .from(newsSources)
        .where(eq(newsSources.slug, slug))
        .limit(1);

      return sources.length > 0 ? this.mapDbSourceToNewsSource(sources[0]) : null;
    } catch (error) {
      logger.error(`Failed to fetch source by slug ${slug}:`, error);
      throw new AggregatorError('Failed to fetch source from database', 'DATABASE_ERROR');
    }
  }

  async getSourcesByLanguage(language: string): Promise<NewsSource[]> {
    try {
      const sources = await this.db
        .select()
        .from(newsSources)
        .where(eq(newsSources.language, language))
        .orderBy(desc(newsSources.priority), asc(newsSources.name));

      return sources.map(this.mapDbSourceToNewsSource);
    } catch (error) {
      logger.error(`Failed to fetch sources for language ${language}:`, error);
      throw new AggregatorError('Failed to fetch sources by language from database', 'DATABASE_ERROR');
    }
  }

  async getSourcesByCategory(category: string): Promise<NewsSource[]> {
    try {
      const sources = await this.db
        .select()
        .from(newsSources)
        .where(eq(newsSources.category, category))
        .orderBy(desc(newsSources.priority), asc(newsSources.name));

      return sources.map(this.mapDbSourceToNewsSource);
    } catch (error) {
      logger.error(`Failed to fetch sources for category ${category}:`, error);
      throw new AggregatorError('Failed to fetch sources by category from database', 'DATABASE_ERROR');
    }
  }

  async createSource(sourceData: Omit<NewsSource, 'id' | 'createdAt' | 'updatedAt' | 'errorCount' | 'successCount'>): Promise<NewsSource> {
    try {
      this.validateSourceData(sourceData);

      const newSource: NewNewsSource = {
        name: sourceData.name,
        slug: sourceData.slug,
        url: sourceData.url,
        sourceType: sourceData.sourceType,
        language: sourceData.language,
        category: sourceData.category,
        tags: sourceData.tags,
        enabled: sourceData.enabled,
        pollingInterval: sourceData.pollingInterval,
        reliability: sourceData.reliability,
        priority: sourceData.priority,
        metadata: sourceData.metadata,
        lastFetched: sourceData.lastFetched,
        lastSuccess: sourceData.lastSuccess,
        lastError: sourceData.lastError,
      };

      const [created] = await this.db
        .insert(newsSources)
        .values(newSource)
        .returning();

      logger.info(`Created new source: ${created.name} (${created.id})`);
      return this.mapDbSourceToNewsSource(created);
    } catch (error) {
      logger.error('Failed to create source:', error);
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new AggregatorError('Failed to create source in database', 'DATABASE_ERROR');
    }
  }

  async updateSource(id: string, updates: Partial<Omit<NewsSource, 'id' | 'createdAt' | 'updatedAt'>>): Promise<NewsSource> {
    try {
      if (updates.slug || updates.name) {
        this.validateSourceData(updates as any);
      }

      const updateData: Partial<NewNewsSource> = {
        ...(updates.name && { name: updates.name }),
        ...(updates.slug && { slug: updates.slug }),
        ...(updates.url && { url: updates.url }),
        ...(updates.sourceType && { sourceType: updates.sourceType }),
        ...(updates.language && { language: updates.language }),
        ...(updates.category && { category: updates.category }),
        ...(updates.tags && { tags: updates.tags }),
        ...(updates.enabled !== undefined && { enabled: updates.enabled }),
        ...(updates.pollingInterval && { pollingInterval: updates.pollingInterval }),
        ...(updates.reliability !== undefined && { reliability: updates.reliability }),
        ...(updates.priority !== undefined && { priority: updates.priority }),
        ...(updates.metadata && { metadata: updates.metadata }),
        ...(updates.lastFetched && { lastFetched: updates.lastFetched }),
        ...(updates.lastSuccess && { lastSuccess: updates.lastSuccess }),
        ...(updates.lastError !== undefined && { lastError: updates.lastError }),
        ...(updates.errorCount !== undefined && { errorCount: updates.errorCount }),
        ...(updates.successCount !== undefined && { successCount: updates.successCount }),
      };

      const [updated] = await this.db
        .update(newsSources)
        .set(updateData)
        .where(eq(newsSources.id, id))
        .returning();

      if (!updated) {
        throw new AggregatorError(`Source with id ${id} not found`, 'NOT_FOUND', 404);
      }

      logger.info(`Updated source: ${updated.name} (${id})`);
      return this.mapDbSourceToNewsSource(updated);
    } catch (error) {
      logger.error(`Failed to update source ${id}:`, error);
      if (error instanceof AggregatorError || error instanceof ValidationError) {
        throw error;
      }
      throw new AggregatorError('Failed to update source in database', 'DATABASE_ERROR');
    }
  }

  async deleteSource(id: string): Promise<void> {
    try {
      const deleted = await this.db
        .delete(newsSources)
        .where(eq(newsSources.id, id))
        .returning({ name: newsSources.name });

      if (deleted.length === 0) {
        throw new AggregatorError(`Source with id ${id} not found`, 'NOT_FOUND', 404);
      }

      logger.info(`Deleted source: ${deleted[0].name} (${id})`);
    } catch (error) {
      logger.error(`Failed to delete source ${id}:`, error);
      if (error instanceof AggregatorError) {
        throw error;
      }
      throw new AggregatorError('Failed to delete source from database', 'DATABASE_ERROR');
    }
  }

  async enableSource(id: string): Promise<NewsSource> {
    return this.updateSource(id, { enabled: true });
  }

  async disableSource(id: string): Promise<NewsSource> {
    return this.updateSource(id, { enabled: false });
  }

  async updateSourceFetchStatus(id: string, success: boolean, error?: string): Promise<void> {
    try {
      const source = await this.getSourceById(id);
      if (!source) {
        logger.warn(`Attempted to update status for unknown source: ${id}`);
        return;
      }

      const updates: Partial<NewsSource> = {
        lastFetched: new Date(),
      };

      if (success) {
        updates.lastSuccess = new Date();
        updates.lastError = undefined;
        updates.successCount = source.successCount + 1;
        
        // Improve reliability on success
        updates.reliability = Math.min(100, source.reliability + 1);
      } else {
        updates.lastError = error;
        updates.errorCount = source.errorCount + 1;
        
        // Decrease reliability on failure
        updates.reliability = Math.max(0, source.reliability - 5);
      }

      await this.updateSource(id, updates);
    } catch (error) {
      logger.error(`Failed to update source fetch status for ${id}:`, error);
      // Don't throw here as this shouldn't break the main flow
    }
  }

  async bulkEnableSources(ids: string[]): Promise<void> {
    try {
      if (ids.length === 0) return;

      await this.db
        .update(newsSources)
        .set({ enabled: true })
        .where(inArray(newsSources.id, ids));

      logger.info(`Bulk enabled ${ids.length} sources`);
    } catch (error) {
      logger.error('Failed to bulk enable sources:', error);
      throw new AggregatorError('Failed to bulk enable sources', 'DATABASE_ERROR');
    }
  }

  async bulkDisableSources(ids: string[]): Promise<void> {
    try {
      if (ids.length === 0) return;

      await this.db
        .update(newsSources)
        .set({ enabled: false })
        .where(inArray(newsSources.id, ids));

      logger.info(`Bulk disabled ${ids.length} sources`);
    } catch (error) {
      logger.error('Failed to bulk disable sources:', error);
      throw new AggregatorError('Failed to bulk disable sources', 'DATABASE_ERROR');
    }
  }

  private validateSourceData(data: Partial<NewsSource>): void {
    if (data.slug && !/^[a-z0-9-]+$/.test(data.slug)) {
      throw new ValidationError('Slug must contain only lowercase letters, numbers, and hyphens', 'slug');
    }

    if (data.url && !this.isValidUrl(data.url)) {
      throw new ValidationError('Invalid URL format', 'url');
    }

    if (data.sourceType && !['rss', 'api', 'scraper'].includes(data.sourceType)) {
      throw new ValidationError('Source type must be rss, api, or scraper', 'sourceType');
    }

    if (data.priority !== undefined && (data.priority < 1 || data.priority > 10)) {
      throw new ValidationError('Priority must be between 1 and 10', 'priority');
    }

    if (data.reliability !== undefined && (data.reliability < 0 || data.reliability > 100)) {
      throw new ValidationError('Reliability must be between 0 and 100', 'reliability');
    }

    if (data.pollingInterval && data.pollingInterval < 60000) {
      throw new ValidationError('Polling interval must be at least 60 seconds', 'pollingInterval');
    }
  }

  private isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  private mapDbSourceToNewsSource(dbSource: DbNewsSource): NewsSource {
    return {
      id: dbSource.id,
      name: dbSource.name,
      slug: dbSource.slug,
      url: dbSource.url,
      sourceType: dbSource.sourceType as 'rss' | 'api' | 'scraper',
      language: dbSource.language,
      category: dbSource.category,
      tags: Array.isArray(dbSource.tags) ? dbSource.tags as string[] : [],
      enabled: dbSource.enabled,
      pollingInterval: dbSource.pollingInterval,
      reliability: dbSource.reliability,
      priority: dbSource.priority,
      metadata: (dbSource.metadata as Record<string, unknown>) || {},
      lastFetched: dbSource.lastFetched || undefined,
      lastSuccess: dbSource.lastSuccess || undefined,
      lastError: dbSource.lastError || undefined,
      errorCount: dbSource.errorCount,
      successCount: dbSource.successCount,
      createdAt: dbSource.createdAt,
      updatedAt: dbSource.updatedAt,
    };
  }

  private async seedInitialSources(): Promise<void> {
    const initialSources = [
      {
        name: 'BBC World News',
        slug: 'bbc-world',
        url: 'http://feeds.bbci.co.uk/news/world/rss.xml',
        sourceType: 'rss' as const,
        language: 'en',
        category: 'world',
        tags: ['news', 'international'],
        enabled: true,
        pollingInterval: 300000,
        reliability: 95,
        priority: 9,
        metadata: { region: 'global', credibility: 'high' }
      },
      {
        name: 'Reuters World News',
        slug: 'reuters-world',
        url: 'https://feeds.reuters.com/reuters/worldNews',
        sourceType: 'rss' as const,
        language: 'en',
        category: 'world',
        tags: ['news', 'international'],
        enabled: true,
        pollingInterval: 300000,
        reliability: 93,
        priority: 9,
        metadata: { region: 'global', credibility: 'high' }
      },
      {
        name: 'CNN World News',
        slug: 'cnn-world',
        url: 'http://rss.cnn.com/rss/edition.rss',
        sourceType: 'rss' as const,
        language: 'en',
        category: 'world',
        tags: ['news', 'international'],
        enabled: true,
        pollingInterval: 600000,
        reliability: 87,
        priority: 7,
        metadata: { region: 'global', credibility: 'medium' }
      },
      {
        name: 'Associated Press World News',
        slug: 'ap-world',
        url: 'https://feeds.apnews.com/RSS-world',
        sourceType: 'rss' as const,
        language: 'en',
        category: 'world',
        tags: ['news', 'international'],
        enabled: true,
        pollingInterval: 300000,
        reliability: 92,
        priority: 8,
        metadata: { region: 'global', credibility: 'high' }
      },
      {
        name: 'NHK World Japan',
        slug: 'nhk-world',
        url: 'https://www3.nhk.or.jp/rss/news/cat0.xml',
        sourceType: 'rss' as const,
        language: 'ja',
        category: 'world',
        tags: ['news', 'international', 'japan'],
        enabled: true,
        pollingInterval: 600000,
        reliability: 90,
        priority: 8,
        metadata: { region: 'japan', credibility: 'high' }
      },
      {
        name: 'China Daily',
        slug: 'china-daily',
        url: 'https://www.chinadaily.com.cn/rss/world_rss.xml',
        sourceType: 'rss' as const,
        language: 'zh-CN',
        category: 'world',
        tags: ['news', 'international', 'china'],
        enabled: true,
        pollingInterval: 600000,
        reliability: 85,
        priority: 7,
        metadata: { region: 'china', credibility: 'medium' }
      }
    ];

    for (const sourceData of initialSources) {
      await this.createSource(sourceData);
    }

    logger.info(`Seeded ${initialSources.length} initial sources`);
  }
}