/**
 * Database module exports
 * Centralized exports for database functionality
 */

// Export database connection
export { db, getDatabase, checkDatabaseHealth, closeDatabaseConnection, getDatabaseInfo } from './connection.js';

// Export schema and types
export * from './schema.js';

// Export migration utilities (will be added)
export * from './migrations.js';