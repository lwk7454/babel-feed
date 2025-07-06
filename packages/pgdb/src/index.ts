/**
 * Database module exports
 * Centralized exports for database functionality
 */

// Export database connection
export { 
  db, 
  getDatabase, 
  checkDatabaseHealth, 
  closeDatabaseConnection, 
} from './connection.js'

// Export schema and types
export * from './schema.js'

// Export migration utilities
export * from './migrations.js'

// Export test utilities
export * from './test-utils.js'