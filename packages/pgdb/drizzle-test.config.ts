import { defineConfig } from 'drizzle-kit'
import path from 'path'

export default defineConfig({
  dialect: 'postgresql',
  schema: path.relative(process.cwd(), path.resolve(__dirname, 'src/schema.ts')),
  out: path.relative(process.cwd(), path.resolve(__dirname, 'test-migrations')),
  migrations: { prefix: 'timestamp' },
  verbose: false, // Keep quiet during test runs
  strict: true
})