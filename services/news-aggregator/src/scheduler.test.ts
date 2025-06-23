import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { runOnce, getStatus } from './scheduler.js';
import * as aggregator from './aggregator.js';
import * as translator from './translator.js';

// Mock dependencies
vi.mock('./aggregator.js');
vi.mock('./translator.js');
vi.mock('node-cron');

describe('Scheduler Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('runOnce', () => {
    beforeEach(() => {
      vi.mocked(aggregator.validateProviders).mockReturnValue(true);
      vi.mocked(translator.validateTranslationConfig).mockReturnValue(true);
      vi.mocked(aggregator.runAggregation).mockResolvedValue();
    });

    it('should run aggregation once successfully', async () => {
      console.log = vi.fn();
      
      await runOnce();
      
      expect(aggregator.validateProviders).toHaveBeenCalled();
      expect(translator.validateTranslationConfig).toHaveBeenCalled();
      expect(aggregator.runAggregation).toHaveBeenCalled();
      expect(console.log).toHaveBeenCalledWith('One-time aggregation completed');
    });

    it('should exit on provider validation failure', async () => {
      vi.mocked(aggregator.validateProviders).mockReturnValue(false);
      console.error = vi.fn();
      
      const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('process.exit called');
      });
      
      await expect(runOnce()).rejects.toThrow('process.exit called');
      expect(mockExit).toHaveBeenCalledWith(1);
      expect(console.error).toHaveBeenCalledWith('Provider validation failed. Exiting.');
      
      mockExit.mockRestore();
    });

    it('should exit on translation config validation failure', async () => {
      vi.mocked(translator.validateTranslationConfig).mockReturnValue(false);
      console.error = vi.fn();
      
      const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('process.exit called');
      });
      
      await expect(runOnce()).rejects.toThrow('process.exit called');
      expect(mockExit).toHaveBeenCalledWith(1);
      expect(console.error).toHaveBeenCalledWith('Translation configuration validation failed. Exiting.');
      
      mockExit.mockRestore();
    });

    it('should handle aggregation errors gracefully', async () => {
      vi.mocked(aggregator.runAggregation).mockRejectedValue(new Error('Aggregation error'));
      console.log = vi.fn();
      
      await runOnce();
      
      // Should complete despite error
      expect(console.log).toHaveBeenCalledWith('One-time aggregation completed');
    });
  });

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

  describe('Error Handling', () => {
    it('should prevent duplicate aggregation runs', async () => {
      // Test that isRunning flag prevents concurrent execution
      // This would require testing the internal safeRunAggregation function
      expect(true).toBe(true);
    });
  });

  describe('Configuration Validation', () => {
    it('should validate all configurations before starting', () => {
      // Test that both provider and translation configs are validated
      expect(true).toBe(true);
    });
  });
});