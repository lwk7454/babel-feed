import { initializeDatabase } from '@babel-feed/pgdb';
import { logger } from './logger';

export { initializeDatabase } from '@babel-feed/pgdb';
export * from '@babel-feed/pgdb';

export async function ensureDbConnection(): Promise<void> {
  try {
    await initializeDatabase();
    logger.info('Database connection established');
  } catch (error) {
    logger.error('Database connection failed:', error);
    throw error;
  }
}