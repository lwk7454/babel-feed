import { cleanupTestDatabase, clearTestData, getTestDb, setupTestDatabase, userPreferences, users, userSessions } from '@babel-feed/pgdb';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'bun:test';
import { Elysia, t } from 'elysia';
import { createAuthGuard } from '../middleware/auth.middleware';
import { UserService } from '../services/user.service';

describe('User Flow Integration Tests', () => {
  let app: any; // Allow any type to avoid Elysia macro type conflicts
  let testUserService: UserService;

  beforeAll(async () => {
    await setupTestDatabase();
  });

  afterAll(async () => {
    await cleanupTestDatabase();
  });

  afterEach(async () => {
    await clearTestData();
  });

  beforeEach(() => {
    testUserService = new UserService(getTestDb());
    
    // Create auth guard with test user service
    const testAuthGuard = createAuthGuard(testUserService);

    app = new Elysia()
      
      .post('/guest', 
        async ({ body }) => {
          try {
            const deviceFingerprint = (body as any).deviceFingerprint;
            const user = await testUserService.createGuestUser(deviceFingerprint);
            
            return {
              success: true,
              data: {
                guestId: user.guestId,
                userId: user.id,
                userStatus: user.userStatus,
                createdAt: user.createdAt
              },
              message: 'Guest profile created successfully'
            };
          } catch (error) {
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
            const { guestId, email } = body as any;
            const result = await testUserService.createAccountFromGuest(guestId, email);
            
            return {
              success: true,
              data: {
                userId: result.user.id,
                email: result.user.email,
                userStatus: result.user.userStatus,
                verificationSent: true
              },
              message: 'Account created successfully. Please check your email for verification.'
            };
          } catch (error) {
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
            const { verificationToken } = body as any;
            const result = await testUserService.verifyEmail(verificationToken);
            
            return {
              success: true,
              data: {
                user: {
                  id: result.user.id,
                  email: result.user.email,
                  emailVerified: result.user.emailVerified,
                  userStatus: result.user.userStatus,
                  createdAt: result.user.createdAt
                },
                accessToken: result.tokens.accessToken,
                refreshToken: result.tokens.refreshToken
              },
              message: 'Email verified successfully'
            };
          } catch (error) {
            if (error instanceof Error) {
              if (error.message.includes('Invalid or expired')) {
                throw new Error('Invalid or expired verification token');
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
      
      .use(testAuthGuard)
      .get('/auth-protected/profile',
        async ({ user, set }) => {
          // Auth check since we're using testAuthGuard
          if (!user) {
            set.status = 401;
            return {
              error: {
                code: 'UNAUTHORIZED',
                message: 'Authentication required',
                details: null
              },
              timestamp: new Date().toISOString()
            };
          }
          
          return {
            success: true,
            data: {
              id: user.id,
              email: user.email,
              guestId: user.guestId,
              emailVerified: user.emailVerified,
              userStatus: user.userStatus,
              createdAt: user.createdAt,
              updatedAt: user.updatedAt
            }
          };
        }
      )
          
      .post('/auth-protected/save-settings',
        async ({ user, body, set }) => {
          // Auth check since we're using testAuthGuard
          if (!user) {
            set.status = 401;
            return {
              error: {
                code: 'UNAUTHORIZED',
                message: 'Authentication required',
                details: null
              },
              timestamp: new Date().toISOString()
            };
          }
          
          try {
            if (user.userStatus !== 'verified' && user.userStatus !== 'vip') {
              set.status = 403;
              return {
                success: false,
                error: {
                  code: 'SETTINGS_SYNC_FORBIDDEN',
                  message: 'Settings sync requires verified account'
                }
              };
            }

            await testUserService.updateUserPreferences(user.id, body as any);
            const preferences = await testUserService.getUserPreferences(user.id);
            
            return {
              success: true,
              data: preferences,
              message: 'Settings saved and synced to server successfully'
            };
          } catch (error) {
            set.status = 500;
            return {
              success: false,
              error: {
                code: 'SETTINGS_SAVE_FAILED',
                message: 'Failed to save settings'
              }
            };
          }
        },
        {
          body: t.Object({
            preferredLanguages: t.Optional(t.Array(t.String())),
            feedCategories: t.Optional(t.Array(t.String())),
            translationSettings: t.Optional(t.Object({
              autoTranslate: t.Optional(t.Boolean()),
              defaultTargetLanguage: t.Optional(t.String())
            })),
            themePreference: t.Optional(t.String()),
            notificationSettings: t.Optional(t.Object({
              emailNotifications: t.Optional(t.Boolean()),
              pushNotifications: t.Optional(t.Boolean())
            })),
            privacySettings: t.Optional(t.Object({
              analytics: t.Optional(t.Boolean()),
              personalization: t.Optional(t.Boolean())
            }))
          })
        }
      )
      
      .post('/logout',
        async ({ headers }) => {
          try {
            const authorization = headers.authorization;
            if (authorization && authorization.startsWith('Bearer ')) {
              const accessToken = authorization.substring(7);
              await testUserService.logout(accessToken);
            }
            
            return {
              success: true,
              message: 'Logged out successfully'
            };
          } catch (error) {
            return {
              success: true,
              message: 'Logged out successfully'
            };
          }
        }
      );
  });

  afterEach(async () => {
    // Clean up test data in correct order
    await getTestDb().delete(userPreferences);
    await getTestDb().delete(userSessions);
    await getTestDb().delete(users);
  });

  describe('Complete User Onboarding Flow', () => {
    it('should complete full user registration and verification flow', async () => {
      // Step 1: Create guest user
      const guestResponse = await app.handle(
        new Request('http://localhost/guest', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ deviceFingerprint: 'integration-test-device' })
        })
      );

      expect(guestResponse.status).toBe(200);
      const guestData = await guestResponse.json();
      expect(guestData.success).toBe(true);
      expect(guestData.data.guestId).toBeTruthy();
      expect(guestData.data.userStatus).toBe('guest');

      // Step 2: Create account from guest
      const createAccountResponse = await app.handle(
        new Request('http://localhost/create-account', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            guestId: guestData.data.guestId,
            email: 'integration-flow@example.com'
          })
        })
      );

      expect(createAccountResponse.status).toBe(200);
      const accountData = await createAccountResponse.json();
      expect(accountData.success).toBe(true);
      expect(accountData.data.email).toBe('integration-flow@example.com');
      expect(accountData.data.userStatus).toBe('guest'); // Still guest until verified

      // Step 3: Get verification token from database
      const [user] = await getTestDb().select().from(users).limit(1);
      expect(user.verificationToken).toBeTruthy();
      expect(user.emailVerified).toBe(false);

      // Step 4: Verify email
      const verifyResponse = await app.handle(
        new Request('http://localhost/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ verificationToken: user.verificationToken })
        })
      );

      expect(verifyResponse.status).toBe(200);
      const verifyData = await verifyResponse.json();
      expect(verifyData.success).toBe(true);
      expect(verifyData.data.user.emailVerified).toBe(true);
      expect(verifyData.data.user.userStatus).toBe('verified');
      expect(verifyData.data.accessToken).toBeTruthy();
      expect(verifyData.data.refreshToken).toBeTruthy();

      // Step 5: Access protected profile endpoint
      const profileResponse = await app.handle(
        new Request('http://localhost/auth-protected/profile', {
          headers: { 
            'Authorization': `Bearer ${verifyData.data.accessToken}`
          }
        })
      );

      expect(profileResponse.status).toBe(200);
      const profileData = await profileResponse.json();
      expect(profileData.success).toBe(true);
      expect(profileData.data.email).toBe('integration-flow@example.com');
      expect(profileData.data.userStatus).toBe('verified');
      expect(profileData.data.emailVerified).toBe(true);
    });

    it('should handle settings management for verified users', async () => {
      // Setup: Create and verify user
      const guestResponse = await app.handle(
        new Request('http://localhost/guest', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({})
        })
      );
      const guestData = await guestResponse.json();

      await app.handle(
        new Request('http://localhost/create-account', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            guestId: guestData.data.guestId,
            email: 'settings-flow@example.com'
          })
        })
      );

      const [user] = await getTestDb().select().from(users).limit(1);
      const verifyResponse = await app.handle(
        new Request('http://localhost/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ verificationToken: user.verificationToken })
        })
      );
      const verifyData = await verifyResponse.json();

      // Test: Save settings as verified user
      const settingsResponse = await app.handle(
        new Request('http://localhost/auth-protected/save-settings', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${verifyData.data.accessToken}`
          },
          body: JSON.stringify({
            preferredLanguages: ['en', 'zh-CN', 'ja'],
            themePreference: 'dark',
            translationSettings: {
              autoTranslate: true,
              defaultTargetLanguage: 'en'
            },
            notificationSettings: {
              emailNotifications: true,
              pushNotifications: false
            }
          })
        })
      );

      expect(settingsResponse.status).toBe(200);
      const settingsData = await settingsResponse.json();
      expect(settingsData.success).toBe(true);
      expect(settingsData.message).toBe('Settings saved and synced to server successfully');
      expect(settingsData.data.preferredLanguages).toEqual(['en', 'zh-CN', 'ja']);
      expect(settingsData.data.themePreference).toBe('dark');
      expect(settingsData.data.translationSettings).toEqual({
        autoTranslate: true,
        defaultTargetLanguage: 'en'
      });
      expect(settingsData.data.notificationSettings).toEqual({
        emailNotifications: true,
        pushNotifications: false
      });

      // Verify settings persist in database
      const storedPreferences = await testUserService.getUserPreferences(verifyData.data.user.id);
      expect(storedPreferences!.preferredLanguages).toEqual(['en', 'zh-CN', 'ja']);
      expect(storedPreferences!.themePreference).toBe('dark');
    });

    it('should handle session management and logout', async () => {
      // Setup: Create and verify user
      const guestResponse = await app.handle(
        new Request('http://localhost/guest', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({})
        })
      );
      const guestData = await guestResponse.json();

      await app.handle(
        new Request('http://localhost/create-account', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            guestId: guestData.data.guestId,
            email: 'logout-flow@example.com'
          })
        })
      );

      const [user] = await getTestDb().select().from(users).limit(1);
      const verifyResponse = await app.handle(
        new Request('http://localhost/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ verificationToken: user.verificationToken })
        })
      );
      const verifyData = await verifyResponse.json();

      // Verify session exists
      let sessions = await getTestDb().select().from(userSessions);
      expect(sessions).toHaveLength(1);

      // Test: Access profile with valid token
      const profileResponse = await app.handle(
        new Request('http://localhost/auth-protected/profile', {
          headers: { 
            'Authorization': `Bearer ${verifyData.data.accessToken}`
          }
        })
      );
      expect(profileResponse.status).toBe(200);

      // Test: Logout
      const logoutResponse = await app.handle(
        new Request('http://localhost/logout', {
          method: 'POST',
          headers: { 
            'Authorization': `Bearer ${verifyData.data.accessToken}`
          }
        })
      );

      expect(logoutResponse.status).toBe(200);
      const logoutData = await logoutResponse.json();
      expect(logoutData.success).toBe(true);

      // Verify session was deleted
      sessions = await getTestDb().select().from(userSessions);
      expect(sessions).toHaveLength(0);

      // Test: Access profile with invalidated token should fail
      const validatedUser = await testUserService.validateAccessToken(verifyData.data.accessToken);
      expect(validatedUser).toBeNull(); // Token should be invalid after logout
    });

    it('should prevent settings sync for guest users', async () => {
      // Create guest user only (no verification)
      await app.handle(
        new Request('http://localhost/guest', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({})
        })
      );

      // Attempt to save settings without verification should fail (no auth token)
      const settingsResponse = await app.handle(
        new Request('http://localhost/auth-protected/save-settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            themePreference: 'dark'
          })
        })
      );

      expect(settingsResponse.status).toBe(401); // Unauthorized - no auth token
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle duplicate email registration attempts', async () => {
      const email = 'duplicate-integration@example.com';

      // Create first user
      const guest1Response = await app.handle(
        new Request('http://localhost/guest', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({})
        })
      );
      const guest1Data = await guest1Response.json();

      await app.handle(
        new Request('http://localhost/create-account', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            guestId: guest1Data.data.guestId,
            email
          })
        })
      );

      // Attempt to create second user with same email
      const guest2Response = await app.handle(
        new Request('http://localhost/guest', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({})
        })
      );
      const guest2Data = await guest2Response.json();

      const duplicateResponse = await app.handle(
        new Request('http://localhost/create-account', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            guestId: guest2Data.data.guestId,
            email
          })
        })
      );

      expect(duplicateResponse.status).toBe(500);
    });

    it('should handle invalid verification tokens', async () => {
      const invalidResponse = await app.handle(
        new Request('http://localhost/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ verificationToken: '9999' })
        })
      );

      expect(invalidResponse.status).toBe(500);
    });

    it('should handle non-existent guest ID in account creation', async () => {
      const invalidResponse = await app.handle(
        new Request('http://localhost/create-account', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            guestId: 'guest_nonexistent123',
            email: 'test@example.com'
          })
        })
      );

      expect(invalidResponse.status).toBe(500);
    });
  });
});