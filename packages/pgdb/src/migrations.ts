import { migrate as migratePostgres } from 'drizzle-orm/postgres-js/migrator'
import { migrate as migratePglite } from 'drizzle-orm/pglite/migrator'
import { getDatabase } from './connection.js'
import { resolve } from 'path'
import { fileURLToPath } from 'url'
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import type { PgliteDatabase } from 'drizzle-orm/pglite'

/**
 * Type guard to check if database is PgliteDatabase
 */
function isPgliteDatabase(db: unknown): db is PgliteDatabase<Record<string, unknown>> {
  return process.env.NODE_ENV === 'test' && 
         typeof db === 'object' && 
         db !== null && 
         '$client' in db && 
         typeof (db as Record<string, unknown>).$client === 'object'
}

/**
 * Type guard to check if database is PostgresJsDatabase
 */
function isPostgresJsDatabase(db: unknown): db is PostgresJsDatabase<Record<string, unknown>> {
  return process.env.NODE_ENV !== 'test' && 
         typeof db === 'object' && 
         db !== null && 
         '$client' in db && 
         typeof (db as Record<string, unknown>).$client === 'function'
}

/**
 * Run database migrations using Drizzle's built-in migration support
 */
export async function runMigrations(): Promise<void> {
  try {
    const __dirname = fileURLToPath(new URL('.', import.meta.url))
    const migrationsPath = resolve(__dirname, '../migrations')
    
    console.log(`🔄 Running migrations from: ${migrationsPath}`)
    
    const db = await getDatabase()
    
    // Use the appropriate migrator based on database type
    if (isPgliteDatabase(db)) {
      // For PGLite, use the PGLite migrator
      await migratePglite(db, { migrationsFolder: migrationsPath })
    } else if (isPostgresJsDatabase(db)) {
      // For postgres-js, use the postgres-js migrator
      await migratePostgres(db, { migrationsFolder: migrationsPath })
    } else {
      throw new Error('Unknown database type for migration')
    }
    
    console.log('✅ Migrations completed successfully')
  } catch (error) {
    console.error('❌ Database migration failed:', error)
    throw error
  }
}

/**
 * Check if database needs migration
 */
export async function checkMigrationStatus(): Promise<{ needsMigration: boolean; error?: string }> {
  try {
    const db = await getDatabase()
    
    // Check if migration table exists
    const result = await db.execute(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = '__drizzle_migrations'
      );
    `)
    
    // Handle different result types for different database implementations
    let tableExists = false
    if (isPgliteDatabase(db)) {
      // PGLite returns Results with rows property
      const pgliteResult = result as unknown as { rows: Array<{ exists: boolean }> }
      tableExists = pgliteResult.rows[0]?.exists || false
    } else {
      // PostgresJS returns an array directly
      const postgresResult = result as unknown as Array<{ exists: boolean }>
      tableExists = postgresResult[0]?.exists || false
    }
    
    if (!tableExists) {
      return { needsMigration: true }
    }
    
    // For now, assume no migration needed if table exists
    // In a real implementation, you'd compare applied migrations with available ones
    return { needsMigration: false }
  } catch (error) {
    return { 
      needsMigration: false, 
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

/**
 * Initialize database with schema (for development)
 */
export async function initializeDatabase(): Promise<void> {
  try {
    console.log('🚀 Initializing database...')
    
    // Run migrations to create tables
    await runMigrations()
    
    console.log('✅ Database initialization completed')
  } catch (error) {
    console.error('❌ Database initialization failed:', error)
    throw error
  }
}
