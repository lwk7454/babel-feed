import { describe, it, expect } from 'bun:test';
import { NEWS_PROVIDERS, TRANSLATION_CONFIG, AGGREGATION_CONFIG, SUPPORTED_LANGUAGES } from './config.js';

describe('Configuration', () => {
  describe('NEWS_PROVIDERS', () => {
    it('should have valid provider structure', () => {
      expect(NEWS_PROVIDERS).toBeInstanceOf(Array);
      expect(NEWS_PROVIDERS.length).toBeGreaterThan(0);
      
      NEWS_PROVIDERS.forEach(provider => {
        expect(provider).toHaveProperty('id');
        expect(provider).toHaveProperty('name');
        expect(provider).toHaveProperty('url');
        expect(provider).toHaveProperty('language');
        expect(provider).toHaveProperty('enabled');
        
        expect(typeof provider.id).toBe('string');
        expect(typeof provider.name).toBe('string');
        expect(typeof provider.url).toBe('string');
        expect(typeof provider.language).toBe('string');
        expect(typeof provider.enabled).toBe('boolean');
      });
    });

    it('should have unique provider IDs', () => {
      const ids = NEWS_PROVIDERS.map(p => p.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });

    it('should have valid URLs', () => {
      NEWS_PROVIDERS.forEach(provider => {
        expect(() => new URL(provider.url)).not.toThrow();
      });
    });

    it('should have supported languages', () => {
      NEWS_PROVIDERS.forEach(provider => {
        expect(SUPPORTED_LANGUAGES).toContain(provider.language as any);
      });
    });

    it('should have at least one enabled provider', () => {
      const enabledCount = NEWS_PROVIDERS.filter(p => p.enabled).length;
      expect(enabledCount).toBeGreaterThan(0);
    });
  });

  describe('TRANSLATION_CONFIG', () => {
    it('should have required structure', () => {
      expect(TRANSLATION_CONFIG).toHaveProperty('baseUrl');
      expect(TRANSLATION_CONFIG).toHaveProperty('freeModels');
      expect(TRANSLATION_CONFIG).toHaveProperty('targetLanguages');
      
      expect(typeof TRANSLATION_CONFIG.baseUrl).toBe('string');
      expect(TRANSLATION_CONFIG.freeModels).toBeInstanceOf(Array);
      expect(TRANSLATION_CONFIG.targetLanguages).toBeInstanceOf(Array);
    });

    it('should have valid base URL', () => {
      expect(() => new URL(TRANSLATION_CONFIG.baseUrl)).not.toThrow();
    });

    it('should have free models configured', () => {
      expect(TRANSLATION_CONFIG.freeModels.length).toBeGreaterThan(0);
      TRANSLATION_CONFIG.freeModels.forEach(model => {
        expect(typeof model).toBe('string');
        expect(model.length).toBeGreaterThan(0);
      });
    });

    it('should target supported languages', () => {
      TRANSLATION_CONFIG.targetLanguages.forEach(lang => {
        expect(SUPPORTED_LANGUAGES).toContain(lang as any);
      });
    });
  });

  describe('AGGREGATION_CONFIG', () => {
    it('should have valid configuration values', () => {
      expect(AGGREGATION_CONFIG).toHaveProperty('intervalMinutes');
      expect(AGGREGATION_CONFIG).toHaveProperty('batchSize');
      expect(AGGREGATION_CONFIG).toHaveProperty('maxArticlesPerProvider');
      expect(AGGREGATION_CONFIG).toHaveProperty('retryAttempts');
      expect(AGGREGATION_CONFIG).toHaveProperty('requestTimeout');
      
      expect(AGGREGATION_CONFIG.intervalMinutes).toBeGreaterThan(0);
      expect(AGGREGATION_CONFIG.batchSize).toBeGreaterThan(0);
      expect(AGGREGATION_CONFIG.maxArticlesPerProvider).toBeGreaterThan(0);
      expect(AGGREGATION_CONFIG.retryAttempts).toBeGreaterThan(0);
      expect(AGGREGATION_CONFIG.requestTimeout).toBeGreaterThan(0);
    });

    it('should have reasonable default values', () => {
      expect(AGGREGATION_CONFIG.intervalMinutes).toBeGreaterThanOrEqual(1);
      expect(AGGREGATION_CONFIG.intervalMinutes).toBeLessThanOrEqual(1440); // Max 24 hours
      
      expect(AGGREGATION_CONFIG.batchSize).toBeGreaterThanOrEqual(1);
      expect(AGGREGATION_CONFIG.batchSize).toBeLessThanOrEqual(100);
      
      expect(AGGREGATION_CONFIG.maxArticlesPerProvider).toBeGreaterThanOrEqual(1);
      expect(AGGREGATION_CONFIG.maxArticlesPerProvider).toBeLessThanOrEqual(100);
      
      expect(AGGREGATION_CONFIG.retryAttempts).toBeGreaterThanOrEqual(1);
      expect(AGGREGATION_CONFIG.retryAttempts).toBeLessThanOrEqual(10);
      
      expect(AGGREGATION_CONFIG.requestTimeout).toBeGreaterThanOrEqual(5000); // At least 5 seconds
      expect(AGGREGATION_CONFIG.requestTimeout).toBeLessThanOrEqual(120000); // Max 2 minutes
    });
  });

  describe('SUPPORTED_LANGUAGES', () => {
    it('should contain expected languages', () => {
      expect(SUPPORTED_LANGUAGES).toContain('en');
      expect(SUPPORTED_LANGUAGES).toContain('zh-CN');
      expect(SUPPORTED_LANGUAGES).toContain('zh-TW');
      expect(SUPPORTED_LANGUAGES).toContain('ja');
    });

    it('should have unique language codes', () => {
      const uniqueLanguages = new Set(SUPPORTED_LANGUAGES);
      expect(uniqueLanguages.size).toBe(SUPPORTED_LANGUAGES.length);
    });

    it('should have valid language code format', () => {
      SUPPORTED_LANGUAGES.forEach(lang => {
        expect(typeof lang).toBe('string');
        expect(lang.length).toBeGreaterThanOrEqual(2);
        // Should be either 'xx' or 'xx-XX' format
        expect(lang).toMatch(/^[a-z]{2}(-[A-Z]{2})?$/);
      });
    });
  });

  describe('Environment Variables', () => {
    it('should handle missing environment variables gracefully', () => {
      // The config should provide defaults when env vars are missing
      expect(() => require('./config.js')).not.toThrow();
    });
  });
});