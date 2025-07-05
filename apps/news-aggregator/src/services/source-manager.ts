import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import { logger } from '../utils/logger';
import { config } from '../config/config';
import { NewsSource, SourceHealth } from '../types';

export class SourceManager {
  private sources: Map<string, NewsSource> = new Map();
  private sourceHealth: Map<string, SourceHealth> = new Map();
  private configPath: string;
  private refreshTimer?: NodeJS.Timeout;

  constructor() {
    this.configPath = join(process.cwd(), config.sources.configPath);
  }

  async initialize(): Promise<void> {
    await this.loadSources();
    this.startRefreshTimer();
    logger.info(`Source manager initialized with ${this.sources.size} sources`);
  }

  async loadSources(): Promise<void> {
    try {
      const configData = await readFile(this.configPath, 'utf-8');
      const config = JSON.parse(configData);
      
      this.sources.clear();
      for (const sourceData of config.sources) {
        const source: NewsSource = {
          ...sourceData,
          lastFetched: sourceData.lastFetched ? new Date(sourceData.lastFetched) : undefined,
          lastSuccess: sourceData.lastSuccess ? new Date(sourceData.lastSuccess) : undefined,
        };
        this.sources.set(source.id, source);
      }
      
      logger.info(`Loaded ${this.sources.size} news sources from configuration`);
    } catch (error) {
      logger.error('Failed to load sources configuration:', error);
      throw error;
    }
  }

  async saveSources(): Promise<void> {
    try {
      const sourcesArray = Array.from(this.sources.values());
      const config = { sources: sourcesArray };
      await writeFile(this.configPath, JSON.stringify(config, null, 2));
      logger.debug('Sources configuration saved');
    } catch (error) {
      logger.error('Failed to save sources configuration:', error);
      throw error;
    }
  }

  getAllSources(): NewsSource[] {
    return Array.from(this.sources.values());
  }

  getEnabledSources(): NewsSource[] {
    return this.getAllSources().filter(source => source.enabled);
  }

  getSourceById(id: string): NewsSource | undefined {
    return this.sources.get(id);
  }

  getSourcesByLanguage(language: string): NewsSource[] {
    return this.getAllSources().filter(source => source.language === language);
  }

  getSourcesByCategory(category: string): NewsSource[] {
    return this.getAllSources().filter(source => source.category === category);
  }

  async addSource(source: NewsSource): Promise<void> {
    if (this.sources.has(source.id)) {
      throw new Error(`Source with id ${source.id} already exists`);
    }

    this.sources.set(source.id, source);
    await this.saveSources();
    logger.info(`Added new source: ${source.name} (${source.id})`);
  }

  async updateSource(id: string, updates: Partial<NewsSource>): Promise<void> {
    const source = this.sources.get(id);
    if (!source) {
      throw new Error(`Source with id ${id} not found`);
    }

    const updatedSource = { ...source, ...updates };
    this.sources.set(id, updatedSource);
    await this.saveSources();
    logger.info(`Updated source: ${source.name} (${id})`);
  }

  async removeSource(id: string): Promise<void> {
    const source = this.sources.get(id);
    if (!source) {
      throw new Error(`Source with id ${id} not found`);
    }

    this.sources.delete(id);
    this.sourceHealth.delete(id);
    await this.saveSources();
    logger.info(`Removed source: ${source.name} (${id})`);
  }

  async enableSource(id: string): Promise<void> {
    await this.updateSource(id, { enabled: true });
  }

  async disableSource(id: string): Promise<void> {
    await this.updateSource(id, { enabled: false });
  }

  updateSourceHealth(id: string, health: Partial<SourceHealth>): void {
    const currentHealth = this.sourceHealth.get(id) || {
      sourceId: id,
      lastCheck: new Date(),
      isHealthy: true,
      responseTime: 0,
      errorCount: 0,
      successCount: 0,
      uptime: 100,
    };

    const updatedHealth = { ...currentHealth, ...health, lastCheck: new Date() };
    this.sourceHealth.set(id, updatedHealth);
  }

  getSourceHealth(id: string): SourceHealth | undefined {
    return this.sourceHealth.get(id);
  }

  getAllSourcesHealth(): SourceHealth[] {
    return Array.from(this.sourceHealth.values());
  }

  getUnhealthySources(): SourceHealth[] {
    return this.getAllSourcesHealth().filter(health => !health.isHealthy);
  }

  async updateSourceFetchStatus(id: string, success: boolean, error?: string): Promise<void> {
    const source = this.sources.get(id);
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
    } else {
      updates.lastError = error;
    }

    await this.updateSource(id, updates);

    // Update health metrics
    const currentHealth = this.sourceHealth.get(id) || {
      sourceId: id,
      lastCheck: new Date(),
      isHealthy: true,
      responseTime: 0,
      errorCount: 0,
      successCount: 0,
      uptime: 100,
    };

    if (success) {
      currentHealth.successCount++;
      currentHealth.isHealthy = true;
    } else {
      currentHealth.errorCount++;
      currentHealth.lastError = error;
      currentHealth.isHealthy = false;
    }

    // Calculate uptime percentage
    const totalChecks = currentHealth.successCount + currentHealth.errorCount;
    currentHealth.uptime = totalChecks > 0 ? (currentHealth.successCount / totalChecks) * 100 : 100;

    this.sourceHealth.set(id, currentHealth);
  }

  private startRefreshTimer(): void {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
    }

    this.refreshTimer = setInterval(() => {
      this.loadSources().catch(error => {
        logger.error('Failed to refresh sources configuration:', error);
      });
    }, config.sources.refreshInterval);
  }

  destroy(): void {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
    }
  }
}