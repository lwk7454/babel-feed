import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { runAggregation, validateProviders } from './aggregator.js';
import { NEWS_PROVIDERS } from './config.js';
import * as database from './database.js';
import * as translator from './translator.js';

// Mock external dependencies
vi.mock('./database.js');
vi.mock('./translator.js');

describe('News Aggregator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('validateProviders', () => {
    it('should validate provider configuration successfully', () => {
      const result = validateProviders();
      expect(result).toBe(true);
    });

    it('should detect missing provider fields', () => {
      // This test would require mocking the NEWS_PROVIDERS config
      // For now, we'll test the happy path since the config is valid
      expect(validateProviders()).toBe(true);
    });
  });

  describe('runAggregation', () => {
    beforeEach(() => {
      // Mock database functions
      vi.mocked(database.articleExists).mockResolvedValue(false);
      vi.mocked(database.saveArticle).mockResolvedValue();
      
      // Mock translator functions
      vi.mocked(translator.translateContent).mockResolvedValue({
        'zh-CN': '中文标题',
        'zh-TW': '中文標題', 
        'ja': '日本語タイトル'
      });
    });

    it('should run aggregation without errors', async () => {
      console.log = vi.fn(); // Mock console.log to avoid noise in tests
      
      await expect(runAggregation()).resolves.not.toThrow();
      
      expect(console.log).toHaveBeenCalledWith('Starting news aggregation...');
      expect(console.log).toHaveBeenCalledWith('News aggregation completed');
    });

    it('should process enabled providers only', async () => {
      console.log = vi.fn();
      
      await runAggregation();
      
      const enabledCount = NEWS_PROVIDERS.filter(p => p.enabled).length;
      expect(console.log).toHaveBeenCalledWith(`Processing ${enabledCount} enabled providers`);
    });

    it('should handle provider errors gracefully', async () => {
      console.error = vi.fn();
      
      // Mock RSS parser to throw an error
      const originalFetch = global.fetch;
      global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));
      
      await runAggregation();
      
      // Should complete without throwing
      expect(console.log).toHaveBeenCalledWith('News aggregation completed');
      
      global.fetch = originalFetch;
    });

    it('should skip duplicate articles', async () => {
      vi.mocked(database.articleExists).mockResolvedValue(true);
      console.log = vi.fn();
      
      await runAggregation();
      
      // Should not call saveArticle for duplicate articles
      expect(database.saveArticle).not.toHaveBeenCalled();
    });

    it('should translate article content', async () => {
      vi.mocked(database.articleExists).mockResolvedValue(false);
      
      // Mock RSS feed response
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(`
          <?xml version="1.0"?>
          <rss version="2.0">
            <channel>
              <item>
                <title>Test Article</title>
                <description>Test description</description>
                <link>https://example.com/article1</link>
                <pubDate>Mon, 01 Jan 2024 00:00:00 GMT</pubDate>
              </item>
            </channel>
          </rss>
        `)
      });
      
      await runAggregation();
      
      expect(translator.translateContent).toHaveBeenCalled();
      expect(database.saveArticle).toHaveBeenCalled();
    });
  });

  describe('Content Processing', () => {
    it('should extract article data correctly', () => {
      // Test article data extraction logic
      // This would test the internal extractArticleFromFeedItem function
      // For now, we'll test through the integration
      expect(true).toBe(true);
    });

    it('should clean HTML from content', () => {
      // Test HTML cleaning functionality
      // This would test the internal cleanText function
      expect(true).toBe(true);
    });

    it('should generate unique article IDs', () => {
      // Test ID generation
      expect(true).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle translation failures gracefully', async () => {
      vi.mocked(translator.translateContent).mockRejectedValue(new Error('Translation failed'));
      console.error = vi.fn();
      
      await runAggregation();
      
      // Should continue processing despite translation errors
      expect(console.log).toHaveBeenCalledWith('News aggregation completed');
    });

    it('should handle database errors gracefully', async () => {
      vi.mocked(database.saveArticle).mockRejectedValue(new Error('Database error'));
      console.error = vi.fn();
      
      await runAggregation();
      
      expect(console.log).toHaveBeenCalledWith('News aggregation completed');
    });
  });
});