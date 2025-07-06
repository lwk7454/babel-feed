import { cleanupTestDatabase, clearTestData, setupTestDatabase } from '@babel-feed/pgdb';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'bun:test';
import { NewsAggregator } from '../services/aggregator';
import { AiProviderManager } from '../services/ai-provider-manager';
import { DatabaseSourceManager } from '../services/db-source-manager';
import { HealthChecker } from '../services/health-checker';


describe('News Aggregator Setup', () => {

  beforeAll(async () => {
    await setupTestDatabase();
  });

  beforeEach(async () => {
    await clearTestData();
  });

  afterAll(async () => {
    await cleanupTestDatabase();
  });

  describe('DatabaseSourceManager', () => {
    it('should initialize with default sources', async () => {
      const sourceManager = new DatabaseSourceManager();
      await sourceManager.initialize();
      
      const sources = await sourceManager.getAllSources();
      expect(sources.length).toBeGreaterThan(0);
      
      const enabledSources = await sourceManager.getEnabledSources();
      expect(enabledSources.length).toBeGreaterThan(0);
    });

    it('should get sources by language', async () => {
      const sourceManager = new DatabaseSourceManager();
      await sourceManager.initialize();
      
      const englishSources = await sourceManager.getSourcesByLanguage('en');
      expect(englishSources.length).toBeGreaterThan(0);
      
      const japaneseSources = await sourceManager.getSourcesByLanguage('ja');
      expect(japaneseSources.length).toBeGreaterThan(0);
    });
  });

  describe('AiProviderManager', () => {
    it('should initialize with default providers', async () => {
      const aiProviderManager = new AiProviderManager();
      await aiProviderManager.initialize();
      
      const providers = await aiProviderManager.getAllProviders();
      expect(providers.length).toBeGreaterThan(0);
      
      const enabledProviders = await aiProviderManager.getEnabledProviders();
      expect(enabledProviders.length).toBeGreaterThan(0);
    });

    it('should get providers by type', async () => {
      const aiProviderManager = new AiProviderManager();
      await aiProviderManager.initialize();
      
      const translationProviders = await aiProviderManager.getEnabledProviders('translation');
      expect(translationProviders.length).toBeGreaterThan(0);
    });
  });

  describe('HealthChecker', () => {
    it('should return health status', async () => {
      const sourceManager = new DatabaseSourceManager();
      const aiProviderManager = new AiProviderManager();
      await sourceManager.initialize();
      await aiProviderManager.initialize();
      
      const healthChecker = new HealthChecker(sourceManager, aiProviderManager);
      const status = await healthChecker.getHealthStatus();
      
      expect(status.status).toBeDefined();
      expect(status.timestamp).toBeInstanceOf(Date);
      expect(status.uptime).toBeGreaterThanOrEqual(0);
      expect(status.services).toBeInstanceOf(Array);
      expect(status.summary).toBeDefined();
    });
  });

  describe('NewsAggregator', () => {
    it('should initialize and start successfully', async () => {
      const aggregator = new NewsAggregator();
      await aggregator.initialize();
      await aggregator.start();
      
      const status = await aggregator.getStatus();
      expect(status.running).toBe(true);
      expect(status.health).toBeDefined();
      expect(status.config).toBeDefined();
      
      await aggregator.stop();
      
      const stoppedStatus = await aggregator.getStatus();
      expect(stoppedStatus.running).toBe(false);
    });
  });
});