import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { getDatabase } from './connection.js';
import { resolve } from 'path';

/**
 * Run database migrations
 */
export async function runMigrations(): Promise<void> {
  try {
    console.log('🔄 Running database migrations...');
    
    const db = getDatabase();
    const migrationsFolder = resolve(import.meta.url, 'migrations');
    
    await migrate(db, { migrationsFolder });
    
    console.log('✅ Database migrations completed successfully');
  } catch (error) {
    console.error('❌ Database migration failed:', error);
    throw error;
  }
}

/**
 * Run database migrations with custom migration folder
 */
export async function runMigrationsWithFolder(migrationsFolder: string): Promise<void> {
  try {
    console.log('🔄 Running database migrations...');
    
    const db = getDatabase();
    const resolvedFolder = resolve(migrationsFolder);
    
    await migrate(db, { migrationsFolder: resolvedFolder });
    
    console.log('✅ Database migrations completed successfully');
  } catch (error) {
    console.error('❌ Database migration failed:', error);
    throw error;
  }
}

/**
 * Check if database needs migration
 */
export async function checkMigrationStatus(): Promise<{ needsMigration: boolean; error?: string }> {
  try {
    const db = getDatabase();
    
    // Check if migration table exists
    const result = await db.execute(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = '__drizzle_migrations'
      );
    `);
    
    const tableExists = result[0]?.exists;
    
    if (!tableExists) {
      return { needsMigration: true };
    }
    
    // For now, assume no migration needed if table exists
    // In a real implementation, you'd compare applied migrations with available ones
    return { needsMigration: false };
  } catch (error) {
    return { 
      needsMigration: false, 
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Initialize database with schema (for development)
 */
export async function initializeDatabase(): Promise<void> {
  try {
    console.log('🚀 Initializing database...');
    
    // Run migrations to create tables
    await runMigrations();
    
    console.log('✅ Database initialization completed');
  } catch (error) {
    console.error('❌ Database initialization failed:', error);
    throw error;
  }
}

/**
 * Initialize database with custom migration folder
 */
export async function initializeDatabaseWithFolder(migrationsFolder: string): Promise<void> {
  try {
    console.log('🚀 Initializing database...');
    
    // Run migrations to create tables
    await runMigrationsWithFolder(migrationsFolder);
    
    console.log('✅ Database initialization completed');
  } catch (error) {
    console.error('❌ Database initialization failed:', error);
    throw error;
  }
}