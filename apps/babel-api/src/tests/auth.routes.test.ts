import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { Elysia, t } from 'elysia';
import { testDb } from './test-database.js';
import { users, userSessions } from '../db/schema.js';
import { UserService } from '../services/user.service.js';
import { authMiddleware } from '../middleware/auth.middleware.js';
import './setup.js';

describe('Auth Routes', () => {
  let app: Elysia;
  let testUserService: UserService;

  beforeEach(() => {
    testUserService = new UserService(testDb);
    
    // Create test version of auth routes
    app = new Elysia({ prefix: '/api/auth' })
      .use(authMiddleware)
      
      .post('/guest', 
        async ({ body, headers }) => {
          try {
            const deviceFingerprint = body.deviceFingerprint;
            const user = await testUserService.createGuestUser(deviceFingerprint);
            
            return {
              success: true,
              data: {
                guestId: user.guestId,
                userId: user.id,
                createdAt: user.createdAt
              },
              message: 'Guest profile created successfully'
            };
          } catch (error) {
            console.error('Guest creation error:', error);
            throw new Error('Failed to create guest profile');
          }
        },
        {
          body: t.Object({
            deviceFingerprint: t.Optional(t.String())
          })
        }
      )
      
      .post('/create-account',
        async ({ body }) => {
          try {
            const { guestId, email } = body;
            const result = await testUserService.createAccountFromGuest(guestId, email);
            
            console.log(`📧 Verification email for ${email}: ${result.verificationToken}`);
            
            return {
              success: true,
              data: {
                userId: result.user.id,
                email: result.user.email,
                verificationSent: true
              },
              message: 'Account created successfully. Please check your email for verification.'
            };
          } catch (error) {
            console.error('Account creation error:', error);
            
            if (error instanceof Error) {
              if (error.message === 'Email already registered') {
                throw new Error('Email address is already registered');
              }
              if (error.message === 'Guest user not found') {
                throw new Error('Invalid guest user');
              }
            }
            
            throw new Error('Failed to create account');
          }
        },
        {
          body: t.Object({
            guestId: t.String(),
            email: t.String({ format: 'email' })
          })
        }
      )
      
      .post('/verify',
        async ({ body }) => {
          try {
            const { verificationToken } = body;
            const result = await testUserService.verifyEmail(verificationToken);
            
            return {
              success: true,
              data: {
                user: {
                  id: result.user.id,
                  email: result.user.email,
                  emailVerified: result.user.emailVerified,
                  createdAt: result.user.createdAt
                },
                accessToken: result.tokens.accessToken,
                refreshToken: result.tokens.refreshToken
              },
              message: 'Email verified successfully'
            };
          } catch (error) {
            console.error('Email verification error:', error);
            
            if (error instanceof Error) {
              if (error.message.includes('Invalid or expired')) {
                throw new Error('Invalid or expired verification token');
              }
              if (error.message.includes('expired')) {
                throw new Error('Verification token has expired');
              }
            }
            
            throw new Error('Email verification failed');
          }
        },
        {
          body: t.Object({
            verificationToken: t.String()
          })
        }
      )
      
      .get('/status',
        async ({ user }) => {
          return {
            success: true,
            data: {
              authenticated: !!user,
              emailVerified: user?.emailVerified || false,
              userId: user?.id || null
            }
          };
        }
      );
  });

  afterEach(async () => {
    // Clean up test data
    await testDb.delete(userSessions);
    await testDb.delete(users);
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

      await app.handle(
        new Request('http://localhost/api/auth/create-account', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            guestId: guestData.data.guestId,
            email: 'verify@example.com'
          })
        })
      );

      // Get verification token from database
      const [user] = await testDb.select().from(users).limit(1);
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
  });
});