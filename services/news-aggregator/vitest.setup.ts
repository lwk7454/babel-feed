import { vi, beforeEach, afterEach } from 'vitest';

// Mock global fetch for RSS parsing tests
global.fetch = vi.fn();

// Setup global test environment
beforeEach(() => {
  // Reset all mocks before each test
  vi.clearAllMocks();
  
  // Reset environment variables to defaults
  process.env.OPENROUTER_API_KEY = 'test-api-key';
  process.env.DB_HOST = 'localhost';
  process.env.DB_PORT = '5432';
  process.env.DB_NAME = 'babel_feed_test';
  process.env.DB_USER = 'postgres';
  process.env.DB_PASSWORD = 'password';
  process.env.AGGREGATION_INTERVAL = '30';
  process.env.BATCH_SIZE = '10';
  process.env.MAX_ARTICLES_PER_PROVIDER = '20';
});

afterEach(() => {
  // Cleanup after each test
  vi.restoreAllMocks();
});