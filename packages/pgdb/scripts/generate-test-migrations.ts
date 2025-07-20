#!/usr/bin/env bun

/**
 * Generate fresh migrations for test environment
 * This script:
 * 1. Cleans up any existing test migrations
 * 2. Generates new migrations from current schema against empty DB
 * 3. These migrations will be applied during test setup
 */

import { execSync } from 'child_process'
import { rmSync, existsSync } from 'fs'
import path from 'path'

const MIGRATIONS_DIR = path.resolve(__dirname, '../test-migrations')
const CONFIG_PATH = path.resolve(__dirname, '../drizzle-test.config.ts')

/**
 * Clean up existing test migrations
 */
function cleanupExistingMigrations() {
  if (existsSync(MIGRATIONS_DIR)) {
    console.log('🧹 Cleaning up existing test migrations...')
    rmSync(MIGRATIONS_DIR, { recursive: true, force: true })
  }
}

/**
 * Generate fresh migrations from current schema
 */
function generateMigrations() {
  console.log('🏗️  Generating fresh migrations from schema...')
  
  try {
    // Generate migrations using the test config
    execSync(`bunx drizzle-kit generate --config=${CONFIG_PATH}`, {
      stdio: 'inherit',
      cwd: path.resolve(__dirname, '..')
    })
    console.log('✅ Test migrations generated successfully')
  } catch (error) {
    console.error('❌ Failed to generate migrations:', error)
    process.exit(1)
  }
}

/**
 * Main execution
 */
function main() {
  console.log('🚀 Generating test migrations...')
  
  cleanupExistingMigrations()
  generateMigrations()
  
  console.log('✨ Test migration generation complete!')
}

// Run if called directly
if (require.main === module) {
  main()
}

export { cleanupExistingMigrations, generateMigrations }