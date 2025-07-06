import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { startTestServer, stopTestServer } from './test-server';
import { cleanupTestDatabase, setupTestDatabase } from '@babel-feed/pgdb';

let testServerUrl: string;

describe('Backend Integration Tests', () => {
  beforeAll(async () => {
    // Set test environment first
    process.env.NODE_ENV = 'test';
    
    // Initialize test database
    await setupTestDatabase();
    
    // Start test server
    const { url } = await startTestServer();
    testServerUrl = url;
  });

  afterAll(async () => {
    await stopTestServer();
    await cleanupTestDatabase();
  });

  it('should respond to health check', async () => {
    const response = await fetch(`${testServerUrl}/health`);
    const data = await response.json();
    
    expect(response.status).toBe(200);
    expect(data.status).toBe('healthy');
    expect(data.version).toBe('1.0.0');
  });

  it('should handle guest user creation', async () => {
    const testData = { deviceFingerprint: 'test-integration' };
    
    const response = await fetch(`${testServerUrl}/api/auth/guest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testData)
    });
    
    const data = await response.json();
    
    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.guestId).toMatch(/^guest_/);
    expect(data.data.userId).toBeDefined();
  });

  it('should provide stats endpoint', async () => {
    const response = await fetch(`${testServerUrl}/api/debug/stats`);
    const data = await response.json();
    
    expect(response.status).toBe(200);
    expect(data.totalRequests).toBeGreaterThan(0);
    expect(data.requestsByMethod).toBeDefined();
  });
}); 