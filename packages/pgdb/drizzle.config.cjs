const { defineConfig } = require('drizzle-kit')
const path = require('path')

module.exports = defineConfig({
  dialect: 'postgresql',
  dbCredentials: {
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    ssl: process.env.NODE_ENV === 'production'
  },
  schema: path.relative(process.cwd(), path.resolve(__dirname, 'src/schema.ts')),
  out: path.relative(process.cwd(), path.resolve(__dirname, 'migrations')),
  migrations: { prefix: 'timestamp' },
  verbose: process.env.NODE_ENV !== 'production',
  strict: true
})