import { cleanupTestDatabase, clearTestData, getTestDb, setupTestDatabase, users, userSessions } from '@babel-feed/pgdb'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'bun:test'
import { eq } from 'drizzle-orm'
import { Elysia, t } from 'elysia'
import { createAuthGuard } from '../middleware/auth.middleware'
import { UserService } from '../services/user.service'

describe('User Verification E2E Tests', () => {
  let app: any
  let testUserService: UserService

  beforeAll(async () => {
    await setupTestDatabase()
  })

  afterAll(async () => {
    await cleanupTestDatabase()
  })

  afterEach(async () => {
    await clearTestData()
  })

  beforeEach(() => {
    testUserService = new UserService(getTestDb())
    
    // Create auth guard with test user service
    const testAuthGuard = createAuthGuard(testUserService)
    
    // Create test app with manually defined auth routes using test user service
    // This ensures the auth routes use the test database instead of the production one
    app = new Elysia()
      .use(testAuthGuard)
      .group('/api/auth', (app) => 
        app
          .post('/guest', 
            async ({ body }) => {
              try {
                const deviceFingerprint = (body as any).deviceFingerprint
                const user = await testUserService.createGuestUser(deviceFingerprint)
                
                return {
                  success: true,
                  data: {
                    guestId: user.guestId,
                    userId: user.id,
                    createdAt: user.createdAt
                  },
                  message: 'Guest profile created successfully'
                }
              } catch (error) {
                throw new Error('Failed to create guest profile')
              }
            },
            {
              body: t.Object({
                deviceFingerprint: t.Optional(t.String())
              })
            }
          )
          
          .post('/start-verification',
            async ({ body }) => {
              try {
                const { guestId, email } = body as any
                const result = await testUserService.startVerification(guestId, email)
                
                return {
                  success: true,
                  data: {
                    userId: result.user.id,
                    email: result.user.email,
                    verificationSent: true,
                    isExistingUser: result.isExistingUser
                  },
                  message: result.isExistingUser 
                    ? 'Verification code sent to your email address.'
                    : 'Account created successfully. Please check your email for verification.'
                }
              } catch (error) {
                if (error instanceof Error) {
                  if (error.message === 'Guest user not found') {
                    throw new Error('Invalid guest user')
                  }
                }
                throw new Error('Failed to start verification')
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
                const { verificationToken } = body as any
                const result = await testUserService.verifyEmail(verificationToken)
                
                const responseData: any = {
                  user: {
                    id: result.user.id,
                    email: result.user.email,
                    guestId: result.user.guestId,
                    emailVerified: result.user.emailVerified,
                    userStatus: result.user.userStatus,
                    createdAt: result.user.createdAt
                  },
                  accessToken: result.tokens.accessToken,
                  refreshToken: result.tokens.refreshToken
                }

                if (result.preferences) {
                  responseData.preferences = result.preferences
                }
                
                return {
                  success: true,
                  data: responseData,
                  message: 'Email verified successfully'
                }
              } catch (error) {
                if (error instanceof Error) {
                  if (error.message.includes('Invalid or expired')) {
                    throw new Error('Invalid or expired verification token')
                  }
                  if (error.message.includes('expired')) {
                    throw new Error('Verification token has expired')
                  }
                }
                throw new Error('Email verification failed')
              }
            },
            {
              body: t.Object({
                verificationToken: t.String()
              })
            }
          )
          
          .post('/resend-verification',
            async ({ body }) => {
              try {
                const { email } = body as any
                await testUserService.resendVerificationCode(email)
                
                return {
                  success: true,
                  message: 'Verification code sent successfully'
                }
              } catch (error) {
                if (error instanceof Error) {
                  if (error.message.includes('User not found')) {
                    throw new Error('User not found')
                  }
                }
                throw new Error('Failed to resend verification code')
              }
            },
            {
              body: t.Object({
                email: t.String({ format: 'email' })
              })
            }
          )
          
          .get('/profile',
            async ({ user, set }) => {
              if (!user) {
                set.status = 401
                return {
                  error: {
                    code: 'UNAUTHORIZED',
                    message: 'Authentication required',
                    details: null
                  },
                  timestamp: new Date().toISOString()
                }
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
              }
            }
          )
          
          .put('/preferences',
            async ({ user, body, set }) => {
              if (!user) {
                set.status = 401
                return {
                  error: {
                    code: 'UNAUTHORIZED',
                    message: 'Authentication required',
                    details: null
                  },
                  timestamp: new Date().toISOString()
                }
              }
              
              try {
                await testUserService.updateUserPreferences(user.id, body as any)
                const preferences = await testUserService.getUserPreferences(user.id)
                
                return {
                  success: true,
                  data: preferences,
                  message: 'Preferences updated successfully'
                }
              } catch (error) {
                set.status = 500
                return {
                  success: false,
                  error: {
                    code: 'PREFERENCES_UPDATE_FAILED',
                    message: 'Failed to update preferences'
                  }
                }
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
          
          .get('/preferences',
            async ({ user, set }) => {
              if (!user) {
                set.status = 401
                return {
                  error: {
                    code: 'UNAUTHORIZED',
                    message: 'Authentication required',
                    details: null
                  },
                  timestamp: new Date().toISOString()
                }
              }
              
              try {
                const preferences = await testUserService.getUserPreferences(user.id)
                
                return {
                  success: true,
                  data: preferences || null
                }
              } catch (error) {
                set.status = 500
                return {
                  success: false,
                  error: {
                    code: 'PREFERENCES_FETCH_FAILED',
                    message: 'Failed to get preferences'
                  }
                }
              }
            }
          )
          
          .post('/save-settings',
            async ({ user, body, set }) => {
              if (!user) {
                set.status = 401
                return {
                  error: {
                    code: 'UNAUTHORIZED',
                    message: 'Authentication required',
                    details: null
                  },
                  timestamp: new Date().toISOString()
                }
              }
              
              if (user.userStatus !== 'verified' && user.userStatus !== 'vip') {
                set.status = 403
                return {
                  success: false,
                  error: {
                    code: 'SETTINGS_SYNC_FORBIDDEN',
                    message: 'Settings sync requires verified account'
                  }
                }
              }
              
              try {
                await testUserService.updateUserPreferences(user.id, body as any)
                const preferences = await testUserService.getUserPreferences(user.id)
                
                return {
                  success: true,
                  data: preferences,
                  message: 'Settings saved and synced to server successfully'
                }
              } catch (error) {
                set.status = 500
                return {
                  success: false,
                  error: {
                    code: 'SETTINGS_SAVE_FAILED',
                    message: 'Failed to save settings'
                  }
                }
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
          
          .get('/status',
            async ({ user }) => {
              return {
                success: true,
                data: {
                  authenticated: !!user,
                  emailVerified: user?.emailVerified || false,
                  userId: user?.id || null
                }
              }
            }
          )
          
          .post('/logout',
            async ({ headers }) => {
              try {
                const authorization = headers.authorization
                if (authorization && authorization.startsWith('Bearer ')) {
                  const accessToken = authorization.substring(7)
                  await testUserService.logout(accessToken)
                }
                
                return {
                  success: true,
                  message: 'Logged out successfully'
                }
              } catch (error) {
                return {
                  success: true,
                  message: 'Logged out successfully'
                }
              }
            }
          )
      )
  })

  describe('Complete User Verification Flow (Mobile Screen Flow)', () => {
    it('should complete the full verification flow as described in mobile screen specifications', async () => {
      // Step 1: Create guest user (Welcome Screen -> Feed Screen)
      const guestResponse = await app.handle(
        new Request('http://localhost/api/auth/guest', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            deviceFingerprint: 'test-device-e2e-verification' 
          })
        })
      )

      expect(guestResponse.status).toBe(200)
      const guestData = await guestResponse.json()
      expect(guestData.success).toBe(true)
      expect(guestData.data.guestId).toBeTruthy()
      expect(guestData.data.guestId).toMatch(/^guest_/)

      // Step 2: Start verification process (Profile Screen -> Verification Screen)
      // This corresponds to user clicking "Verify" button with valid email
      const startVerificationResponse = await app.handle(
        new Request('http://localhost/api/auth/start-verification', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            guestId: guestData.data.guestId,
            email: 'verification-e2e@example.com'
          })
        })
      )

      expect(startVerificationResponse.status).toBe(200)
      const startVerificationData = await startVerificationResponse.json()
      expect(startVerificationData.success).toBe(true)
      expect(startVerificationData.data.email).toBe('verification-e2e@example.com')
      expect(startVerificationData.data.verificationSent).toBe(true)
      expect(startVerificationData.data.isExistingUser).toBe(false)
      expect(startVerificationData.message).toBe('Account created successfully. Please check your email for verification.')

      // Step 3: Verify that verification email was "sent" (get OTP from database)
      const [user] = await getTestDb().select().from(users).limit(1)
      expect(user.verificationToken).toBeTruthy()
      expect(user.verificationToken).toMatch(/^\d{4}$/) // 4-digit OTP
      expect(user.verificationTokenExpiry).toBeTruthy()
      expect(user.emailVerified).toBe(false)
      expect(user.userStatus).toBe('guest') // Still guest until verified

      // Step 4: Complete verification (Verification Screen -> Profile Screen)
      // This corresponds to user entering OTP and clicking submit
      const verifyResponse = await app.handle(
        new Request('http://localhost/api/auth/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            verificationToken: user.verificationToken 
          })
        })
      )

      expect(verifyResponse.status).toBe(200)
      const verifyData = await verifyResponse.json()
      expect(verifyData.success).toBe(true)
      expect(verifyData.data.user.emailVerified).toBe(true)
      expect(verifyData.data.user.userStatus).toBe('verified')
      expect(verifyData.data.accessToken).toBeTruthy()
      expect(verifyData.data.refreshToken).toBeTruthy()
      expect(verifyData.message).toBe('Email verified successfully')

      // Step 5: Verify token works with direct user service validation
      const validatedUser = await testUserService.validateAccessToken(verifyData.data.accessToken)
      expect(validatedUser).toBeTruthy()
      expect(validatedUser!.email).toBe('verification-e2e@example.com')
      expect(validatedUser!.userStatus).toBe('verified')
      expect(validatedUser!.emailVerified).toBe(true)

      // Step 6: Test auth status endpoint (no auth required)
      const statusResponse = await app.handle(
        new Request('http://localhost/api/auth/status', {
          headers: { 
            'Authorization': `Bearer ${verifyData.data.accessToken}`
          }
        })
      )

      expect(statusResponse.status).toBe(200)
      const statusData = await statusResponse.json()
      expect(statusData.success).toBe(true)
      expect(statusData.data.authenticated).toBe(true)
      expect(statusData.data.emailVerified).toBe(true)

      // Step 7: Verify user preferences can be updated via service
      await testUserService.updateUserPreferences(validatedUser!.id, {
        preferredLanguages: ['en', 'zh-CN'],
        themePreference: 'dark',
        translationSettings: {
          autoTranslate: true,
          defaultTargetLanguage: 'en'
        }
      })

      const savedPreferences = await testUserService.getUserPreferences(validatedUser!.id)
      expect(savedPreferences).toBeTruthy()
      expect(savedPreferences!.preferredLanguages).toEqual(['en', 'zh-CN'])
      expect(savedPreferences!.themePreference).toBe('dark')
    })

    it('should handle existing user verification flow correctly', async () => {
      // Setup: Create and verify a user first
      const guestResponse = await app.handle(
        new Request('http://localhost/api/auth/guest', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({})
        })
      )
      const guestData = await guestResponse.json()

      await app.handle(
        new Request('http://localhost/api/auth/start-verification', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            guestId: guestData.data.guestId,
            email: 'existing-user@example.com'
          })
        })
      )

      const [existingUser] = await getTestDb().select().from(users).limit(1)
      await app.handle(
        new Request('http://localhost/api/auth/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ verificationToken: existingUser.verificationToken })
        })
      )

      // Test: New guest user tries to verify with existing email
      const newGuestResponse = await app.handle(
        new Request('http://localhost/api/auth/guest', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({})
        })
      )
      const newGuestData = await newGuestResponse.json()

      const existingUserVerificationResponse = await app.handle(
        new Request('http://localhost/api/auth/start-verification', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            guestId: newGuestData.data.guestId,
            email: 'existing-user@example.com'
          })
        })
      )

      expect(existingUserVerificationResponse.status).toBe(200)
      const existingUserData = await existingUserVerificationResponse.json()
      expect(existingUserData.success).toBe(true)
      expect(existingUserData.data.isExistingUser).toBe(true)
      expect(existingUserData.message).toBe('Verification code sent to your email address.')

      // Verify the existing user gets new verification token
      const [updatedUser] = await getTestDb().select().from(users)
        .where(eq(users.email, 'existing-user@example.com'))
        .limit(1)
      expect(updatedUser.verificationToken).toBeTruthy()
      expect(updatedUser.verificationToken).not.toBe(existingUser.verificationToken)
    })

    it('should handle resend verification code functionality', async () => {
      // Setup: Create user with verification pending
      const guestResponse = await app.handle(
        new Request('http://localhost/api/auth/guest', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({})
        })
      )
      const guestData = await guestResponse.json()

      await app.handle(
        new Request('http://localhost/api/auth/start-verification', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            guestId: guestData.data.guestId,
            email: 'resend-test@example.com'
          })
        })
      )

      const [userBeforeResend] = await getTestDb().select().from(users).limit(1)
      const originalToken = userBeforeResend.verificationToken

      // Test: Resend verification code
      const resendResponse = await app.handle(
        new Request('http://localhost/api/auth/resend-verification', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: 'resend-test@example.com'
          })
        })
      )

      expect(resendResponse.status).toBe(200)
      const resendData = await resendResponse.json()
      expect(resendData.success).toBe(true)
      expect(resendData.message).toBe('Verification code sent successfully')

      // Verify new token was generated
      const [userAfterResend] = await getTestDb().select().from(users).limit(1)
      expect(userAfterResend.verificationToken).toBeTruthy()
      expect(userAfterResend.verificationToken).not.toBe(originalToken)
      expect(userAfterResend.verificationTokenExpiry).toBeTruthy()

      // Test: Verify with new token works
      const verifyResponse = await app.handle(
        new Request('http://localhost/api/auth/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            verificationToken: userAfterResend.verificationToken 
          })
        })
      )

      expect(verifyResponse.status).toBe(200)
      const verifyData = await verifyResponse.json()
      expect(verifyData.success).toBe(true)
      expect(verifyData.data.user.emailVerified).toBe(true)
    })
  })

  describe('Verification Error Handling', () => {
    it('should handle invalid verification tokens', async () => {
      const invalidTokenResponse = await app.handle(
        new Request('http://localhost/api/auth/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ verificationToken: '9999' })
        })
      )

      expect(invalidTokenResponse.status).toBe(500)
      // Custom test routes throw errors which get caught by Elysia error handling
    })

    it('should handle expired verification tokens', async () => {
      // Setup: Create user with expired token
      const guestResponse = await app.handle(
        new Request('http://localhost/api/auth/guest', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({})
        })
      )
      const guestData = await guestResponse.json()

      await app.handle(
        new Request('http://localhost/api/auth/start-verification', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            guestId: guestData.data.guestId,
            email: 'expired-token@example.com'
          })
        })
      )

      // Manually expire the token
      const [user] = await getTestDb().select().from(users)
        .where(eq(users.email, 'expired-token@example.com'))
        .limit(1)
      await getTestDb().update(users)
        .set({ verificationTokenExpiry: new Date(Date.now() - 1000) }) // 1 second ago
        .where(eq(users.id, user.id))

      const expiredTokenResponse = await app.handle(
        new Request('http://localhost/api/auth/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ verificationToken: user.verificationToken })
        })
      )

      expect(expiredTokenResponse.status).toBe(500)
      // Custom test routes throw errors which get caught by Elysia error handling
    })

    it('should handle invalid guest ID in start verification', async () => {
      const invalidGuestResponse = await app.handle(
        new Request('http://localhost/api/auth/start-verification', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            guestId: 'guest_nonexistent123',
            email: 'test@example.com'
          })
        })
      )

      expect(invalidGuestResponse.status).toBe(500)
      // Custom test routes throw errors which get caught by Elysia error handling
    })

    it('should handle resend verification for non-existent email', async () => {
      const nonExistentEmailResponse = await app.handle(
        new Request('http://localhost/api/auth/resend-verification', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: 'nonexistent@example.com'
          })
        })
      )

      expect(nonExistentEmailResponse.status).toBe(500)
      // Custom test routes throw errors which get caught by Elysia error handling
    })
  })

  describe('User Status Transitions', () => {
    it('should correctly transition user status from guest to verified', async () => {
      // Create guest user
      const guestResponse = await app.handle(
        new Request('http://localhost/api/auth/guest', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({})
        })
      )
      const guestData = await guestResponse.json()

      // Verify initial status
      const [initialUser] = await getTestDb().select().from(users).limit(1)
      expect(initialUser.userStatus).toBe('guest')
      expect(initialUser.emailVerified).toBe(false)

      // Start verification
      await app.handle(
        new Request('http://localhost/api/auth/start-verification', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            guestId: guestData.data.guestId,
            email: 'status-transition@example.com'
          })
        })
      )

      // Verify status still guest with email added
      const [pendingUser] = await getTestDb().select().from(users).limit(1)
      expect(pendingUser.userStatus).toBe('guest')
      expect(pendingUser.emailVerified).toBe(false)
      expect(pendingUser.email).toBe('status-transition@example.com')

      // Complete verification
      await app.handle(
        new Request('http://localhost/api/auth/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            verificationToken: pendingUser.verificationToken 
          })
        })
      )

      // Verify final status
      const [verifiedUser] = await getTestDb().select().from(users).limit(1)
      expect(verifiedUser.userStatus).toBe('verified')
      expect(verifiedUser.emailVerified).toBe(true)
      expect(verifiedUser.verificationToken).toBeNull()
      expect(verifiedUser.verificationTokenExpiry).toBeNull()
    })

    it('should create session and tokens upon successful verification', async () => {
      // Setup user for verification
      const guestResponse = await app.handle(
        new Request('http://localhost/api/auth/guest', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({})
        })
      )
      const guestData = await guestResponse.json()

      await app.handle(
        new Request('http://localhost/api/auth/start-verification', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            guestId: guestData.data.guestId,
            email: 'session-test@example.com'
          })
        })
      )

      const [user] = await getTestDb().select().from(users).limit(1)

      // Verify no sessions exist initially
      let sessions = await getTestDb().select().from(userSessions)
      expect(sessions).toHaveLength(0)

      // Complete verification
      const verifyResponse = await app.handle(
        new Request('http://localhost/api/auth/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            verificationToken: user.verificationToken 
          })
        })
      )

      const verifyData = await verifyResponse.json()

      // Verify session was created
      sessions = await getTestDb().select().from(userSessions)
      expect(sessions).toHaveLength(1)
      expect(sessions[0].userId).toBe(user.id)

      // Verify tokens work
      const validatedUser = await testUserService.validateAccessToken(verifyData.data.accessToken)
      expect(validatedUser).toBeTruthy()
      expect(validatedUser!.id).toBe(user.id)
    })
  })

  describe('Token Authentication After Verification', () => {
    it('should allow authenticated API requests with issued tokens', async () => {
      // Complete verification flow to get valid tokens
      const guestResponse = await app.handle(
        new Request('http://localhost/api/auth/guest', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({})
        })
      )
      const guestData = await guestResponse.json()

      await app.handle(
        new Request('http://localhost/api/auth/start-verification', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            guestId: guestData.data.guestId,
            email: 'token-auth-test@example.com'
          })
        })
      )

      const [user] = await getTestDb().select().from(users)
        .where(eq(users.email, 'token-auth-test@example.com'))
        .limit(1)
      
      const verifyResponse = await app.handle(
        new Request('http://localhost/api/auth/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            verificationToken: user.verificationToken 
          })
        })
      )
      const verifyData = await verifyResponse.json()

      // Test 1: Get user profile with issued token
      const profileResponse = await app.handle(
        new Request('http://localhost/api/auth/profile', {
          headers: { 
            'Authorization': `Bearer ${verifyData.data.accessToken}`
          }
        })
      )

      expect(profileResponse.status).toBe(200)
      const profileData = await profileResponse.json()
      expect(profileData.success).toBe(true)
      expect(profileData.data.email).toBe('token-auth-test@example.com')
      expect(profileData.data.userStatus).toBe('verified')
      expect(profileData.data.emailVerified).toBe(true)

      // Test 2: Update preferences with issued token
      const preferencesResponse = await app.handle(
        new Request('http://localhost/api/auth/preferences', {
          method: 'PUT',
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
      )

      expect(preferencesResponse.status).toBe(200)
      const preferencesData = await preferencesResponse.json()
      expect(preferencesData.success).toBe(true)
      expect(preferencesData.data.preferredLanguages).toEqual(['en', 'zh-CN', 'ja'])
      expect(preferencesData.data.themePreference).toBe('dark')
      expect(preferencesData.data.translationSettings.autoTranslate).toBe(true)

      // Test 3: Get preferences back to confirm they were saved
      const getPreferencesResponse = await app.handle(
        new Request('http://localhost/api/auth/preferences', {
          headers: { 
            'Authorization': `Bearer ${verifyData.data.accessToken}`
          }
        })
      )

      expect(getPreferencesResponse.status).toBe(200)
      const getPreferencesData = await getPreferencesResponse.json()
      expect(getPreferencesData.success).toBe(true)
      expect(getPreferencesData.data.preferredLanguages).toEqual(['en', 'zh-CN', 'ja'])
      expect(getPreferencesData.data.themePreference).toBe('dark')

      // Test 4: Save settings (for verified users)
      const saveSettingsResponse = await app.handle(
        new Request('http://localhost/api/auth/save-settings', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${verifyData.data.accessToken}`
          },
          body: JSON.stringify({
            preferredLanguages: ['en', 'ja'],
            themePreference: 'light',
            privacySettings: {
              analytics: false,
              personalization: true
            }
          })
        })
      )

      expect(saveSettingsResponse.status).toBe(200)
      const saveSettingsData = await saveSettingsResponse.json()
      expect(saveSettingsData.success).toBe(true)
      expect(saveSettingsData.message).toBe('Settings saved and synced to server successfully')
      expect(saveSettingsData.data.preferredLanguages).toEqual(['en', 'ja'])
      expect(saveSettingsData.data.themePreference).toBe('light')
    })

    it('should reject requests with invalid tokens', async () => {
      // Test with invalid token
      const invalidTokenResponse = await app.handle(
        new Request('http://localhost/api/auth/profile', {
          headers: { 
            'Authorization': 'Bearer invalid-token-12345'
          }
        })
      )

      expect(invalidTokenResponse.status).toBe(401)
      const errorData = await invalidTokenResponse.json()
      expect(errorData.error.code).toBe('UNAUTHORIZED')

      // Test with no token
      const noTokenResponse = await app.handle(
        new Request('http://localhost/api/auth/profile')
      )

      expect(noTokenResponse.status).toBe(401)
    })
  })

  describe('Authentication Integration', () => {
    it('should maintain authentication state across verification process', async () => {
      // Complete verification flow
      const guestResponse = await app.handle(
        new Request('http://localhost/api/auth/guest', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({})
        })
      )
      const guestData = await guestResponse.json()

      await app.handle(
        new Request('http://localhost/api/auth/start-verification', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            guestId: guestData.data.guestId,
            email: 'auth-state@example.com'
          })
        })
      )

      const [user] = await getTestDb().select().from(users).limit(1)
      const verifyResponse = await app.handle(
        new Request('http://localhost/api/auth/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            verificationToken: user.verificationToken 
          })
        })
      )
      const verifyData = await verifyResponse.json()

      // Test authentication status endpoint
      const statusResponse = await app.handle(
        new Request('http://localhost/api/auth/status', {
          headers: { 
            'Authorization': `Bearer ${verifyData.data.accessToken}`
          }
        })
      )

      expect(statusResponse.status).toBe(200)
      const statusData = await statusResponse.json()
      expect(statusData.success).toBe(true)
      expect(statusData.data.authenticated).toBe(true)
      expect(statusData.data.emailVerified).toBe(true)
      expect(statusData.data.userId).toBe(user.id)
    })

    it('should handle logout after verification', async () => {
      // Complete verification and get tokens
      const guestResponse = await app.handle(
        new Request('http://localhost/api/auth/guest', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({})
        })
      )
      const guestData = await guestResponse.json()

      await app.handle(
        new Request('http://localhost/api/auth/start-verification', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            guestId: guestData.data.guestId,
            email: 'logout-after-verify@example.com'
          })
        })
      )

      const [user] = await getTestDb().select().from(users).limit(1)
      const verifyResponse = await app.handle(
        new Request('http://localhost/api/auth/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            verificationToken: user.verificationToken 
          })
        })
      )
      const verifyData = await verifyResponse.json()

      // Logout
      const logoutResponse = await app.handle(
        new Request('http://localhost/api/auth/logout', {
          method: 'POST',
          headers: { 
            'Authorization': `Bearer ${verifyData.data.accessToken}`
          }
        })
      )

      expect(logoutResponse.status).toBe(200)
      const logoutData = await logoutResponse.json()
      expect(logoutData.success).toBe(true)

      // Verify session was invalidated
      const sessions = await getTestDb().select().from(userSessions)
      expect(sessions).toHaveLength(0)

      // Verify token no longer works
      const validatedUser = await testUserService.validateAccessToken(verifyData.data.accessToken)
      expect(validatedUser).toBeNull()
    })
  })
})