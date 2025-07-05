import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  // Database connection
  dialect: 'postgresql',
  dbCredentials: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    user: process.env.DB_USER || 'babel_dev', 
    password: process.env.DB_PASSWORD || 'babel_dev_password',
    database: process.env.NODE_ENV === 'test' ? 'babel_feed_test' : (process.env.DB_NAME || 'babel_feed_dev'),
    ssl: process.env.NODE_ENV === 'production'
  },
  
  // Schema files
  schema: './src/schema.ts',
  
  // Migration output directory
  out: './src/migrations',
  
  // Migration settings
  migrations: {
    prefix: 'timestamp'
  },
  
  // Verbose logging for development
  verbose: process.env.NODE_ENV !== 'production',
  strict: true
});