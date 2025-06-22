import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '../db/schema.js';

/**
 * Test database connection that uses a separate test database
 */
const TEST_DB_NAME = 'babel_feed_test';

function getTestDatabaseUrl(): string {
  const host = process.env.TEST_DB_HOST || 'localhost';
  const port = process.env.TEST_DB_PORT || '5432';
  const database = TEST_DB_NAME;
  const username = process.env.TEST_DB_USER || 'babel_dev';
  const password = process.env.TEST_DB_PASSWORD || 'babel_dev_password';
  
  return `postgres://${username}:${password}@${host}:${port}/${database}`;
}

function createTestDatabaseConnection() {
  const connectionString = getTestDatabaseUrl();
  
  const sql = postgres(connectionString, {
    max: 1, // Single connection for tests
    idle_timeout: 1,
    connect_timeout: 10,
    prepare: false,
    onnotice: () => {}, // Suppress notices in tests
    debug: false
  });
  
  return drizzle(sql, { schema });
}

// Export test database instance
export const testDb = createTestDatabaseConnection();
export default testDb;