import { createHash } from 'crypto';
import { NewsSource, RawArticle } from '../types';
import { AggregatorError } from '../utils/errors';
import { logger } from '../utils/logger';
import { DatabaseSourceManager } from './db-source-manager';

export class RssProcessor {
  private sourceManager: DatabaseSourceManager;
  private processingQueue = new Map<string, Promise<RawArticle[]>>();

  constructor(sourceManager: DatabaseSourceManager) {
    this.sourceManager = sourceManager;
  }

  async processAllSources(): Promise<{
    processed: number;
    errors: number;
    articles: RawArticle[];
  }> {
    const enabledSources = await this.sourceManager.getEnabledSources();
    const results = await Promise.allSettled(
      enabledSources.map(source => this.processSource(source))
    );

    let totalArticles: RawArticle[] = [];
    let processed = 0;
    let errors = 0;

    for (const result of results) {
      if (result.status === 'fulfilled') {
        processed++;
        totalArticles = totalArticles.concat(result.value);
      } else {
        errors++;
        logger.error('Source processing failed:', result.reason);
      }
    }

    logger.info(`RSS processing complete: ${processed} sources processed, ${errors} errors, ${totalArticles.length} articles`);
    return { processed, errors, articles: totalArticles };
  }

  async processSource(source: NewsSource): Promise<RawArticle[]> {
    // Prevent duplicate processing
    const existingProcess = this.processingQueue.get(source.id);
    if (existingProcess) {
      logger.debug(`Source ${source.name} already being processed, waiting...`);
      return existingProcess;
    }

    const processingPromise = this.doProcessSource(source);
    this.processingQueue.set(source.id, processingPromise);

    try {
      const result = await processingPromise;
      return result;
    } finally {
      this.processingQueue.delete(source.id);
    }
  }

  private async doProcessSource(source: NewsSource): Promise<RawArticle[]> {
    logger.debug(`Processing RSS source: ${source.name}`);
    const startTime = Date.now();

    try {
      const articles = await this.fetchAndParseRss(source);
      const processingTime = Date.now() - startTime;

      // Update source success metrics
      await this.sourceManager.updateSourceFetchStatus(source.id, true);

      logger.info(`Successfully processed ${articles.length} articles from ${source.name} in ${processingTime}ms`);
      return articles;
    } catch (error) {
      const processingTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      // Update source error metrics
      await this.sourceManager.updateSourceFetchStatus(source.id, false, errorMessage);

      logger.error(`Failed to process RSS source ${source.name} after ${processingTime}ms:`, error);
      throw new AggregatorError(`RSS processing failed for ${source.name}`, 'RSS_PROCESSING_ERROR');
    }
  }

  private async fetchAndParseRss(source: NewsSource): Promise<RawArticle[]> {
    // Basic RSS fetch implementation - should be expanded with proper RSS parsing library
    const response = await fetch(source.url, {
      method: 'GET',
      headers: {
        'User-Agent': 'BabelFeed-NewsAggregator/1.0',
        'Accept': 'application/rss+xml, application/xml, text/xml',
      },
      // Add timeout
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const xmlText = await response.text();
    
    // TODO: Implement proper RSS/Atom parsing
    // For now, return mock data structure
    const articles: RawArticle[] = this.parseRssXml(xmlText, source);
    
    return this.deduplicateArticles(articles);
  }

  private parseRssXml(_xmlText: string, source: NewsSource): RawArticle[] {
    // TODO: Implement proper XML/RSS parsing using a library like 'fast-xml-parser' or 'rss-parser'
    // This is a placeholder implementation
    
    // For now, return empty array - real implementation needed
    logger.warn(`RSS parsing not implemented yet for ${source.name}. Implement proper XML parsing.`);
    return [];
  }

  private deduplicateArticles(articles: RawArticle[]): RawArticle[] {
    const seen = new Set<string>();
    const deduped: RawArticle[] = [];

    for (const article of articles) {
      const contentHash = this.generateContentHash(article);
      if (!seen.has(contentHash)) {
        seen.add(contentHash);
        deduped.push(article);
      }
    }

    const duplicatesFiltered = articles.length - deduped.length;
    if (duplicatesFiltered > 0) {
      logger.debug(`Filtered ${duplicatesFiltered} duplicate articles`);
    }

    return deduped;
  }

  private generateContentHash(article: RawArticle): string {
    // Create hash based on URL and title for deduplication
    const content = `${article.url}|${article.title}`;
    return createHash('sha256').update(content).digest('hex');
  }

  async getProcessingStats(): Promise<{
    activeSources: number;
    queueLength: number;
    totalSources: number;
    enabledSources: number;
  }> {
    const allSources = await this.sourceManager.getAllSources();
    const enabledSources = await this.sourceManager.getEnabledSources();

    return {
      activeSources: this.processingQueue.size,
      queueLength: this.processingQueue.size,
      totalSources: allSources.length,
      enabledSources: enabledSources.length,
    };
  }
}