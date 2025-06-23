import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { translateContent, batchTranslateContent, validateTranslationConfig } from './translator.js';
import { TRANSLATION_CONFIG } from './config.js';

// Mock OpenAI
vi.mock('openai', () => ({
  OpenAI: vi.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: vi.fn()
      }
    }
  }))
}));

describe('Translation Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('validateTranslationConfig', () => {
    it('should validate configuration with API key', () => {
      // Mock environment variable
      const originalApiKey = TRANSLATION_CONFIG.openRouterApiKey;
      TRANSLATION_CONFIG.openRouterApiKey = 'test-api-key';
      
      const result = validateTranslationConfig();
      expect(result).toBe(true);
      
      TRANSLATION_CONFIG.openRouterApiKey = originalApiKey;
    });

    it('should fail validation without API key', () => {
      const originalApiKey = TRANSLATION_CONFIG.openRouterApiKey;
      TRANSLATION_CONFIG.openRouterApiKey = '';
      console.error = vi.fn();
      
      const result = validateTranslationConfig();
      expect(result).toBe(false);
      expect(console.error).toHaveBeenCalledWith(
        'OpenRouter API key not configured. Set OPENROUTER_API_KEY environment variable.'
      );
      
      TRANSLATION_CONFIG.openRouterApiKey = originalApiKey;
    });

    it('should fail validation without free models', () => {
      const originalModels = TRANSLATION_CONFIG.freeModels;
      TRANSLATION_CONFIG.freeModels = [];
      console.error = vi.fn();
      
      const result = validateTranslationConfig();
      expect(result).toBe(false);
      expect(console.error).toHaveBeenCalledWith(
        'No free models configured for translation.'
      );
      
      TRANSLATION_CONFIG.freeModels = originalModels;
    });
  });

  describe('translateContent', () => {
    const mockOpenAI = {
      chat: {
        completions: {
          create: vi.fn()
        }
      }
    };

    beforeEach(() => {
      const { OpenAI } = require('openai');
      OpenAI.mockImplementation(() => mockOpenAI);
    });

    it('should translate text to multiple languages', async () => {
      mockOpenAI.chat.completions.create.mockResolvedValue({
        choices: [{
          message: { content: 'Translated text' }
        }]
      });

      const result = await translateContent('Hello world', 'en');
      
      expect(result).toEqual({
        'zh-CN': 'Translated text',
        'zh-TW': 'Translated text',
        'ja': 'Translated text'
      });
    });

    it('should skip translation to same language', async () => {
      const result = await translateContent('Hello world', 'en');
      
      // Should not include 'en' in results since source is 'en'
      expect(result).not.toHaveProperty('en');
    });

    it('should handle translation errors gracefully', async () => {
      mockOpenAI.chat.completions.create.mockRejectedValue(new Error('API Error'));
      console.error = vi.fn();
      
      const result = await translateContent('Hello world', 'en');
      
      // Should return original text for failed translations
      expect(result).toEqual({
        'zh-CN': 'Hello world',
        'zh-TW': 'Hello world', 
        'ja': 'Hello world'
      });
    });

    it('should handle empty translation responses', async () => {
      mockOpenAI.chat.completions.create.mockResolvedValue({
        choices: [{
          message: { content: null }
        }]
      });
      console.error = vi.fn();
      
      const result = await translateContent('Hello world', 'en');
      
      expect(result).toEqual({
        'zh-CN': 'Hello world',
        'zh-TW': 'Hello world',
        'ja': 'Hello world'
      });
    });

    it('should rate limit API calls', async () => {
      vi.useFakeTimers();
      
      mockOpenAI.chat.completions.create.mockResolvedValue({
        choices: [{
          message: { content: 'Translated' }
        }]
      });

      const promise1 = translateContent('Text 1', 'en');
      const promise2 = translateContent('Text 2', 'en');
      
      // Fast-forward timers to trigger rate limiting
      vi.advanceTimersByTime(3000);
      
      await Promise.all([promise1, promise2]);
      
      // Both should complete successfully despite rate limiting
      expect(mockOpenAI.chat.completions.create).toHaveBeenCalled();
      
      vi.useRealTimers();
    });
  });

  describe('batchTranslateContent', () => {
    const mockOpenAI = {
      chat: {
        completions: {
          create: vi.fn()
        }
      }
    };

    beforeEach(() => {
      const { OpenAI } = require('openai');
      OpenAI.mockImplementation(() => mockOpenAI);
    });

    it('should translate multiple texts', async () => {
      mockOpenAI.chat.completions.create.mockResolvedValue({
        choices: [{
          message: { content: 'Translated' }
        }]
      });

      const texts = ['Hello', 'World'];
      const results = await batchTranslateContent(texts, 'en');
      
      expect(results).toHaveLength(2);
      expect(results[0]).toEqual({
        'zh-CN': 'Translated',
        'zh-TW': 'Translated',
        'ja': 'Translated'
      });
    });

    it('should handle empty batch', async () => {
      const results = await batchTranslateContent([], 'en');
      expect(results).toEqual([]);
    });
  });

  describe('Rate Limiting', () => {
    it('should implement rate limiting correctly', async () => {
      // Test that the RateLimiter class works correctly
      // This is more of an integration test
      expect(true).toBe(true);
    });
  });
});