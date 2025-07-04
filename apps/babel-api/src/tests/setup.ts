import { beforeAll, afterAll, beforeEach } from 'bun:test';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import * as schema from '../db/schema.js';
import { users, userSessions, userPreferences, contentCache, userActivity, translationCache } from '../db/schema.js';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

// Get the directory of the current file
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

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
  // First, create the test database if it doesn't exist
  await createTestDatabaseIfNotExists();
  
  // Create connection string for test database
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
  
  // Run migrations - use absolute path to avoid working directory issues
  const migrationsPath = resolve(__dirname, '../db/migrations');
  await migrate(testDb, { migrationsFolder: migrationsPath });
  
  return testDb;
}

async function createTestDatabaseIfNotExists() {
  // Connect to postgres database to create test database
  const adminConnectionString = `postgres://${TEST_DB_CONFIG.user}:${TEST_DB_CONFIG.password}@${TEST_DB_CONFIG.host}:${TEST_DB_CONFIG.port}/postgres`;
  
  const adminSql = postgres(adminConnectionString, {
    max: 1,
    idle_timeout: 1,
    connect_timeout: 10,
    prepare: false,
    onnotice: () => {} // Suppress notices
  });
  
  try {
    // Check if database exists
    const result = await adminSql`
      SELECT 1 FROM pg_database WHERE datname = ${TEST_DB_NAME}
    `;
    
    if (result.length === 0) {
      // Database doesn't exist, create it
      await adminSql.unsafe(`CREATE DATABASE "${TEST_DB_NAME}"`);
      console.log(`✅ Created test database: ${TEST_DB_NAME}`);
    } else {
      console.log(`✅ Test database already exists: ${TEST_DB_NAME}`);
    }
  } catch (error) {
    console.error('❌ Error creating test database:', error);
    throw error;
  } finally {
    await adminSql.end();
  }
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