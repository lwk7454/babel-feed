// Set test environment before any imports
process.env.NODE_ENV = 'test'
process.env.DB_DEBUG = 'false'
process.env.DB_POOL_SIZE = '5'

import { beforeAll } from 'bun:test'
import { setupTestDatabase } from '../src/test-utils.js'

beforeAll(async () => {
  await setupTestDatabase()
})
