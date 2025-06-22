import { beforeAll, afterAll, beforeEach } from 'bun:test';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import * as schema from '../db/schema.js';
import { users, userSessions, userPreferences, contentCache, userActivity, translationCache } from '../db/schema.js';

// Test database configuration
const TEST_DB_NAME = 'babel_feed_test';
const TEST_DB_CONFIG = {
  host: process.env.TEST_DB_HOST || 'localhost',
  port: parseInt(process.env.TEST_DB_PORT || '5432'),
  user: process.env.TEST_DB_USER || 'babel_dev',
  password: process.env.TEST_DB_PASSWORD || 'babel_dev_password',
  database: TEST_DB_NAME,
  max: 1, // Single connection for tests
  idle_timeout: 1,
  connect_timeout: 10,
  prepare: false
};

let testDb: ReturnType<typeof drizzle>;
let sql: ReturnType<typeof postgres>;

export async function setupTestDatabase() {
  // Create connection string
  const connectionString = `postgres://${TEST_DB_CONFIG.user}:${TEST_DB_CONFIG.password}@${TEST_DB_CONFIG.host}:${TEST_DB_CONFIG.port}/${TEST_DB_CONFIG.database}`;
  
  // Create SQL connection
  sql = postgres(connectionString, {
    max: TEST_DB_CONFIG.max,
    idle_timeout: TEST_DB_CONFIG.idle_timeout,
    connect_timeout: TEST_DB_CONFIG.connect_timeout,
    prepare: TEST_DB_CONFIG.prepare,
    onnotice: () => {} // Suppress notices in tests
  });
  
  // Create Drizzle instance
  testDb = drizzle(sql, { schema });
  
  // Run migrations
  await migrate(testDb, { migrationsFolder: './src/db/migrations' });
  
  return testDb;
}

export async function cleanupTestDatabase() {
  if (sql) {
    await sql.end();
  }
}

export async function clearTestData() {
  if (!testDb) return;
  
  // Clear all tables in reverse dependency order
  await testDb.delete(userActivity);
  await testDb.delete(translationCache);
  await testDb.delete(userSessions);
  await testDb.delete(userPreferences);
  await testDb.delete(contentCache);
  await testDb.delete(users);
}

export function getTestDb() {
  if (!testDb) {
    throw new Error('Test database not initialized. Call setupTestDatabase() first.');
  }
  return testDb;
}

// Global test setup
beforeAll(async () => {
  await setupTestDatabase();
});

afterAll(async () => {
  await cleanupTestDatabase();
});

beforeEach(async () => {
  await clearTestData();
});