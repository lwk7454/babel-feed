import { describe, it, expect } from 'bun:test';
import { validateProviders } from './aggregator.js';

describe('News Aggregator', () => {
  describe('validateProviders', () => {
    it('should validate provider configuration successfully', () => {
      const result = validateProviders();
      expect(result).toBe(true);
    });
  });
});