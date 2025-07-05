import { beforeAll, afterAll, beforeEach } from 'bun:test';
import {
  setupTestDatabase,
  cleanupTestDatabase,
  clearTestData,
  getTestDb,
  createTestDatabaseIfNotExists,
  insertTestUser,
  insertTestArticle,
  insertTestArticleTranslation,
  testDatabaseHealth
} from '@babel-feed/pgdb';

// Re-export test utilities for convenience
export {
  setupTestDatabase,
  cleanupTestDatabase,
  clearTestData,
  getTestDb,
  createTestDatabaseIfNotExists,
  insertTestUser,
  insertTestArticle,
  insertTestArticleTranslation,
  testDatabaseHealth
};

// Global test setup
beforeAll(async () => {
  // Set test environment
  process.env.NODE_ENV = 'test';
  
  await setupTestDatabase();
});

afterAll(async () => {
  await cleanupTestDatabase();
});

beforeEach(async () => {
  await clearTestData();
});