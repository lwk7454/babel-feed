import { defineConfig } from 'drizzle-kit'
import path from 'path'

export default defineConfig({
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL || 'postgresql://babel_dev:babel_dev_password@localhost:5432/babel_feed_dev'
  },
  schema: path.relative(process.cwd(), path.resolve(__dirname, 'src/schema.ts')),
  // Remove migrations configuration to use push mode
  // out: path.relative(process.cwd(), path.resolve(__dirname, 'migrations')),
  // migrations: { prefix: 'timestamp' },
  verbose: process.env.NODE_ENV !== 'production',
  strict: true
})