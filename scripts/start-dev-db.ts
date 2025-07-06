#!/usr/bin/env bun

/**
 * Development Database Startup Script
 * Automatically starts PostgreSQL development database using Docker Compose
 */

import { $ } from "bun"

const CONTAINER_NAME = 'babel-feed-db-dev'
const COMPOSE_FILE = 'docker-compose.dev.yml'
const MAX_WAIT_TIME = 30000 // 30 seconds
const HEALTH_CHECK_INTERVAL = 1000 // 1 second

async function checkDockerRunning(): Promise<boolean> {
  try {
    await $`docker info`.quiet()
    return true
  } catch (error) {
    return false
  }
}

async function isContainerRunning(containerName: string): Promise<boolean> {
  try {
    const result = await $`docker ps --filter name=${containerName} --format "{{.Names}}"`.quiet()
    return result.stdout.toString().trim() === containerName
  } catch (error) {
    return false
  }
}

async function isContainerHealthy(containerName: string): Promise<boolean> {
  try {
    const result = await $`docker inspect ${containerName} --format "{{.State.Health.Status}}"`.quiet()
    return result.stdout.toString().trim() === 'healthy'
  } catch (error) {
    return false
  }
}

async function startDatabase(): Promise<void> {
  console.log('🚀 Starting development database...')
  
  try {
    // Start the database using docker compose
    await $`docker compose -f ${COMPOSE_FILE} up -d postgres`
    console.log('📦 Database container started')
    
    // Wait for database to be healthy
    console.log('⏳ Waiting for database to be ready...')
    const startTime = Date.now()
    
    while (Date.now() - startTime < MAX_WAIT_TIME) {
      if (await isContainerHealthy(CONTAINER_NAME)) {
        console.log('✅ Database is ready!')
        return
      }
      
      await new Promise(resolve => setTimeout(resolve, HEALTH_CHECK_INTERVAL))
      process.stdout.write('.')
    }
    
    throw new Error('Database failed to become healthy within timeout')
  } catch (error) {
    console.error('❌ Failed to start database:', error)
    throw error
  }
}

async function stopDatabase(): Promise<void> {
  console.log('🛑 Stopping development database...')
  
  try {
    await $`docker compose -f ${COMPOSE_FILE} down`
    console.log('✅ Database stopped')
  } catch (error) {
    console.error('❌ Failed to stop database:', error)
    throw error
  }
}

async function resetDatabase(): Promise<void> {
  console.log('🔄 Resetting development database...')
  
  try {
    // Stop and remove containers and volumes
    await $`docker compose -f ${COMPOSE_FILE} down -v`
    console.log('🗑️  Database data cleared')
    
    // Start fresh database
    await startDatabase()
    console.log('✅ Database reset complete')
  } catch (error) {
    console.error('❌ Failed to reset database:', error)
    throw error
  }
}

async function showDatabaseStatus(): Promise<void> {
  console.log('📊 Database Status:')
  
  const isRunning = await isContainerRunning(CONTAINER_NAME)
  const isHealthy = isRunning ? await isContainerHealthy(CONTAINER_NAME) : false
  
  console.log(`   Container: ${isRunning ? '🟢 Running' : '🔴 Not running'}`)
  if (isRunning) {
    console.log(`   Health: ${isHealthy ? '🟢 Healthy' : '🟡 Starting...'}`)
  }
  
  if (isRunning && isHealthy) {
    console.log('   Connection: postgres://babel_dev:babel_dev_password@localhost:5432/babel_feed_dev')
    console.log('   pgAdmin: http://localhost:5050 (optional, use --profile tools)')
  }
}

async function main() {
  const command = process.argv[2]
  
  try {
    // Check if Docker is running
    if (!(await checkDockerRunning())) {
      console.error('❌ Docker is not running. Please start Docker Desktop and try again.')
      process.exit(1)
    }
    
    switch (command) {
      case 'start':
        const isRunning = await isContainerRunning(CONTAINER_NAME)
        if (isRunning) {
          console.log('ℹ️  Database container is already running')
          await showDatabaseStatus()
        } else {
          await startDatabase()
        }
        break
        
      case 'stop':
        await stopDatabase()
        break
        
      case 'reset':
        await resetDatabase()
        break
        
      case 'status':
        await showDatabaseStatus()
        break
        
      default:
        // Default behavior: start database if not running
        const isRunning2 = await isContainerRunning(CONTAINER_NAME)
        if (isRunning2) {
          const isHealthy = await isContainerHealthy(CONTAINER_NAME)
          if (isHealthy) {
            console.log('✅ Database is already running and healthy')
          } else {
            console.log('⏳ Database is starting...')
            // Wait for it to become healthy
            await startDatabase()
          }
        } else {
          await startDatabase()
        }
        break
    }
  } catch (error) {
    console.error('💥 Script failed:', error)
    process.exit(1)
  }
}

// Handle cleanup on script termination
process.on('SIGINT', () => {
  console.log('\n👋 Script interrupted')
  process.exit(0)
})

process.on('SIGTERM', () => {
  console.log('\n👋 Script terminated')
  process.exit(0)
})

if (import.meta.main) {
  main()
}

export { checkDockerRunning, isContainerRunning, isContainerHealthy, startDatabase, stopDatabase, resetDatabase }