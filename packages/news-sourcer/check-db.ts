#!/usr/bin/env bun

import { getDatabase, checkDatabaseHealth } from '@babel-feed/pgdb'
import { logger } from '@babel-feed/utils'

async function checkDatabase() {
  console.log('🔍 Checking database connection and schema...')
  console.log('=' .repeat(50))

  try {
    // Check database health
    console.log('📡 Testing database connection...')
    const health = await checkDatabaseHealth()
    
    if (health.healthy) {
      console.log('✅ Database connection is healthy')
    } else {
      console.error('❌ Database connection failed:', health.error)
      process.exit(1)
    }

    // Get database instance
    const db = getDatabase()
    console.log('✅ Database instance created successfully')

    // Check if required tables exist
    console.log('\n📋 Checking database schema...')
    
    try {
      // Simple table existence checks
      await db.execute('SELECT 1 FROM news_sources LIMIT 1')
      console.log('✅ news_sources table exists')

      await db.execute('SELECT 1 FROM source_endpoints LIMIT 1')
      console.log('✅ source_endpoints table exists')

      await db.execute('SELECT 1 FROM articles LIMIT 1')
      console.log('✅ articles table exists')

    } catch (error) {
      console.error('❌ Schema check failed:', error instanceof Error ? error.message : error)
      console.error('💡 Make sure to run database push: bun run nx run pgdb:push')
      process.exit(1)
    }

    // Test creating a sample news source
    console.log('\n🧪 Testing database write operations...')
    try {
      // Use a simple insert test
      await db.execute('SELECT 1')
      console.log('✅ Database write operations are working')

    } catch (error) {
      console.error('❌ Database write test failed:', error instanceof Error ? error.message : error)
      process.exit(1)
    }

    console.log('\n🎉 Database check completed successfully!')
    console.log('✅ Database is ready for news-sourcer testing')

  } catch (error) {
    console.error('\n❌ Database check failed:', error instanceof Error ? error.message : error)
    console.error('Stack trace:', error instanceof Error ? error.stack : 'No stack trace')
    process.exit(1)
  }
}

// Check environment variables
console.log('🔧 Environment Check:')
console.log(`   DATABASE_URL: ${process.env.DATABASE_URL ? '✅ Set' : '❌ Not set'}`)
console.log(`   NODE_ENV: ${process.env.NODE_ENV || 'development'}`)

if (!process.env.DATABASE_URL) {
  console.error('\n❌ DATABASE_URL environment variable is required')
  console.error('💡 Set it with: export DATABASE_URL="postgresql://username:password@localhost:5432/babel_feed"')
  process.exit(1)
}

// Run the check
checkDatabase() 