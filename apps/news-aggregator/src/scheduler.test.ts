import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { getStatus } from './scheduler.js';

describe('Scheduler Service', () => {
  describe('getStatus', () => {
    it('should return status information', () => {
      const status = getStatus();
      
      expect(status).toHaveProperty('isRunning');
      expect(status).toHaveProperty('interval');
      expect(status).toHaveProperty('batchSize');
      expect(status).toHaveProperty('maxArticlesPerProvider');
      expect(status).toHaveProperty('enabledProviders');
      expect(status).toHaveProperty('supportedLanguages');
      
      expect(typeof status.isRunning).toBe('boolean');
      expect(typeof status.interval).toBe('number');
      expect(typeof status.batchSize).toBe('number');
      expect(typeof status.maxArticlesPerProvider).toBe('number');
    });

    it('should return correct configuration values', () => {
      const status = getStatus();
      
      expect(status.interval).toBeGreaterThan(0);
      expect(status.batchSize).toBeGreaterThan(0);
      expect(status.maxArticlesPerProvider).toBeGreaterThan(0);
    });
  });
});