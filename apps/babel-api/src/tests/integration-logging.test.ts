import { describe, it, expect } from 'bun:test';

describe('Backend Integration Tests', () => {
  it('should respond to health check', async () => {
    const response = await fetch('http://localhost:3000/health');
    const data = await response.json();
    
    expect(response.status).toBe(200);
    expect(data.status).toBe('healthy');
    expect(data.version).toBe('1.0.0');
  });

  it('should handle guest user creation', async () => {
    const testData = { deviceFingerprint: 'test-integration' };
    
    const response = await fetch('http://localhost:3000/api/auth/guest', {
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
    const response = await fetch('http://localhost:3000/api/debug/stats');
    const data = await response.json();
    
    expect(response.status).toBe(200);
    expect(data.totalRequests).toBeGreaterThan(0);
    expect(data.requestsByMethod).toBeDefined();
  });
}); 