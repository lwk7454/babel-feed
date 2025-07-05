import { createTestDatabase } from '@babel-feed/pgdb';

// Export test database instance
export const testDb = createTestDatabase();
export default testDb;