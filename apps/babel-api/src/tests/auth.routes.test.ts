import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { Elysia } from 'elysia';
import { authRoutes } from '../routes/auth.routes.js';
import { db } from '../db/connection.js';
import { users, userSessions } from '../db/schema.js';

describe('Auth Routes', () => {
  let app: Elysia;

  beforeEach(() => {
    app = new Elysia().use(authRoutes);
  });

  afterEach(async () => {
    // Clean up test data
    await db.delete(userSessions);
    await db.delete(users);
  });

  describe('POST /api/auth/guest', () => {
    it('should create guest user successfully', async () => {
      const response = await app.handle(
        new Request('http://localhost/api/auth/guest', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ deviceFingerprint: 'test-device' })
        })
      );

      expect(response.status).toBe(200);
      
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data.guestId).toBeTruthy();
      expect(data.data.userId).toBeTruthy();
      expect(data.message).toBe('Guest profile created successfully');
    });

    it('should create guest user without device fingerprint', async () => {
      const response = await app.handle(
        new Request('http://localhost/api/auth/guest', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({})
        })
      );

      expect(response.status).toBe(200);
      
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data.guestId).toBeTruthy();
    });
  });

  describe('POST /api/auth/create-account', () => {
    it('should create account from guest successfully', async () => {
      // First create a guest user
      const guestResponse = await app.handle(
        new Request('http://localhost/api/auth/guest', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({})
        })
      );

      const guestData = await guestResponse.json();
      const guestId = guestData.data.guestId;

      // Create account from guest
      const response = await app.handle(
        new Request('http://localhost/api/auth/create-account', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            guestId,
            email: 'test@example.com'
          })
        })
      );

      expect(response.status).toBe(200);
      
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data.email).toBe('test@example.com');
      expect(data.data.verificationSent).toBe(true);
    });

    it('should return error for duplicate email', async () => {
      // Create first guest and account
      const guestResponse1 = await app.handle(
        new Request('http://localhost/api/auth/guest', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({})
        })
      );
      const guestData1 = await guestResponse1.json();

      await app.handle(
        new Request('http://localhost/api/auth/create-account', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            guestId: guestData1.data.guestId,
            email: 'duplicate@example.com'
          })
        })
      );

      // Try to create second account with same email
      const guestResponse2 = await app.handle(
        new Request('http://localhost/api/auth/guest', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({})
        })
      );
      const guestData2 = await guestResponse2.json();

      const response = await app.handle(
        new Request('http://localhost/api/auth/create-account', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            guestId: guestData2.data.guestId,
            email: 'duplicate@example.com'
          })
        })
      );

      expect(response.status).toBe(500);
    });

    it('should return error for invalid guest ID', async () => {
      const response = await app.handle(
        new Request('http://localhost/api/auth/create-account', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            guestId: 'invalid-guest-id',
            email: 'test@example.com'
          })
        })
      );

      expect(response.status).toBe(500);
    });
  });

  describe('POST /api/auth/verify', () => {
    it('should verify email and return tokens', async () => {
      // Create guest and account
      const guestResponse = await app.handle(
        new Request('http://localhost/api/auth/guest', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({})
        })
      );
      const guestData = await guestResponse.json();

      const accountResponse = await app.handle(
        new Request('http://localhost/api/auth/create-account', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            guestId: guestData.data.guestId,
            email: 'verify@example.com'
          })
        })
      );

      // Get verification token from database (in real app, this would come from email)
      const [user] = await db.select().from(users).limit(1);
      const verificationToken = user.verificationToken!;

      const response = await app.handle(
        new Request('http://localhost/api/auth/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ verificationToken })
        })
      );

      expect(response.status).toBe(200);
      
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data.user.emailVerified).toBe(true);
      expect(data.data.accessToken).toBeTruthy();
      expect(data.data.refreshToken).toBeTruthy();
    });

    it('should return error for invalid verification token', async () => {
      const response = await app.handle(
        new Request('http://localhost/api/auth/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ verificationToken: 'invalid-token' })
        })
      );

      expect(response.status).toBe(500);
    });
  });

  describe('GET /api/auth/status', () => {
    it('should return authentication status for unauthenticated user', async () => {
      const response = await app.handle(
        new Request('http://localhost/api/auth/status')
      );

      expect(response.status).toBe(200);
      
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data.authenticated).toBe(false);
      expect(data.data.emailVerified).toBe(false);
      expect(data.data.userId).toBeNull();
    });

    it('should return authentication status for authenticated user', async () => {
      // Create verified user and get tokens
      const guestResponse = await app.handle(
        new Request('http://localhost/api/auth/guest', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({})
        })
      );
      const guestData = await guestResponse.json();

      await app.handle(
        new Request('http://localhost/api/auth/create-account', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            guestId: guestData.data.guestId,
            email: 'status@example.com'
          })
        })
      );

      const [user] = await db.select().from(users).limit(1);
      const verificationToken = user.verificationToken!;

      const verifyResponse = await app.handle(
        new Request('http://localhost/api/auth/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ verificationToken })
        })
      );

      const verifyData = await verifyResponse.json();
      const accessToken = verifyData.data.accessToken;

      const response = await app.handle(
        new Request('http://localhost/api/auth/status', {
          headers: { 'Authorization': `Bearer ${accessToken}` }
        })
      );

      expect(response.status).toBe(200);
      
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data.authenticated).toBe(true);
      expect(data.data.emailVerified).toBe(true);
      expect(data.data.userId).toBeTruthy();
    });
  });

  describe('GET /api/auth/profile', () => {
    it('should return user profile for authenticated user', async () => {
      // Create verified user and get tokens
      const guestResponse = await app.handle(
        new Request('http://localhost/api/auth/guest', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({})
        })
      );
      const guestData = await guestResponse.json();

      await app.handle(
        new Request('http://localhost/api/auth/create-account', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            guestId: guestData.data.guestId,
            email: 'profile@example.com'
          })
        })
      );

      const [user] = await db.select().from(users).limit(1);
      const verificationToken = user.verificationToken!;

      const verifyResponse = await app.handle(
        new Request('http://localhost/api/auth/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ verificationToken })
        })
      );

      const verifyData = await verifyResponse.json();
      const accessToken = verifyData.data.accessToken;

      const response = await app.handle(
        new Request('http://localhost/api/auth/profile', {
          headers: { 'Authorization': `Bearer ${accessToken}` }
        })
      );

      expect(response.status).toBe(200);
      
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data.email).toBe('profile@example.com');
      expect(data.data.emailVerified).toBe(true);
    });

    it('should return 401 for unauthenticated request', async () => {
      const response = await app.handle(
        new Request('http://localhost/api/auth/profile')
      );

      expect(response.status).toBe(401);
    });
  });

  describe('POST /api/auth/logout', () => {
    it('should logout authenticated user', async () => {
      // Create verified user and get tokens
      const guestResponse = await app.handle(
        new Request('http://localhost/api/auth/guest', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({})
        })
      );
      const guestData = await guestResponse.json();

      await app.handle(
        new Request('http://localhost/api/auth/create-account', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            guestId: guestData.data.guestId,
            email: 'logout@example.com'
          })
        })
      );

      const [user] = await db.select().from(users).limit(1);
      const verificationToken = user.verificationToken!;

      const verifyResponse = await app.handle(
        new Request('http://localhost/api/auth/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ verificationToken })
        })
      );

      const verifyData = await verifyResponse.json();
      const accessToken = verifyData.data.accessToken;

      const response = await app.handle(
        new Request('http://localhost/api/auth/logout', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${accessToken}` }
        })
      );

      expect(response.status).toBe(200);
      
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.message).toBe('Logged out successfully');
    });

    it('should logout unauthenticated user gracefully', async () => {
      const response = await app.handle(
        new Request('http://localhost/api/auth/logout', {
          method: 'POST'
        })
      );

      expect(response.status).toBe(200);
      
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.message).toBe('Logged out successfully');
    });
  });
});