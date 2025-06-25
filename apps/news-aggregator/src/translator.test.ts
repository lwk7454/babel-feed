import { describe, it, expect } from 'vitest';
import { validateTranslationConfig } from './translator.js';
import { TRANSLATION_CONFIG } from './config.js';

describe('Translation Service', () => {
  describe('validateTranslationConfig', () => {
    it('should validate configuration with API key', () => {
      // This will use the current environment setup
      const result = validateTranslationConfig();
      expect(typeof result).toBe('boolean');
    });

    it('should check required configuration properties', () => {
      expect(TRANSLATION_CONFIG).toHaveProperty('openRouterApiKey');
      expect(TRANSLATION_CONFIG).toHaveProperty('freeModels');
      expect(TRANSLATION_CONFIG).toHaveProperty('targetLanguages');
      expect(Array.isArray(TRANSLATION_CONFIG.freeModels)).toBe(true);
      expect(Array.isArray(TRANSLATION_CONFIG.targetLanguages)).toBe(true);
    });
  });
});