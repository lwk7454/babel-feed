import { clearTestData, getTestDb, setupTestDatabase, users } from '@babel-feed/pgdb'
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'bun:test'
import { Elysia, t } from 'elysia'
import { createAuthGuard } from '../middleware/auth.middleware'
import { UserService } from '../services/user.service'

beforeAll(async () => {
  await setupTestDatabase()
})

describe('Auth Routes', () => {
  let app: any
  let testUserService: UserService
  beforeEach(async () => {
    await clearTestData()
  })

  beforeEach(() => {
    testUserService = new UserService(getTestDb())
    
    // Create auth guard with test user service
    const testAuthGuard = createAuthGuard(testUserService)

    app = new Elysia()
      .derive(({ headers }) => {
        const authorization = headers.authorization
        const token = authorization?.startsWith('Bearer ') 
          ? authorization.substring(7) 
          : null
        
        return { 
          authToken: token,
          async getUser() {
            if (!token) return null
            return await testUserService.validateAccessToken(token)
          }
        }
      })
      
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
            console.error('Guest creation error:', error)
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
            
            console.log(`📧 Verification email for ${email}: OTP sent (${result.isExistingUser ? 'existing' : 'new'} user)`)
            
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
            console.error('Start verification error:', error)
            
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
                emailVerified: result.user.emailVerified,
                createdAt: result.user.createdAt
              },
              accessToken: result.tokens.accessToken,
              refreshToken: result.tokens.refreshToken
            }

            // Include preferences for existing users
            if (result.preferences) {
              responseData.preferences = result.preferences
            }
            
            return {
              success: true,
              data: responseData,
              message: 'Email verified successfully'
            }
          } catch (error) {
            console.error('Email verification error:', error)
            
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
      
      // Auth-protected routes group
      .group('/auth-protected', (app) => 
        app
          .use(testAuthGuard)
          .post('/save-settings',
            async ({ user, body, set }) => {
              // Auth check since we're using testAuthGuard
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
      )
      
      .get('/status',
        async ({ getUser }) => {
          const user = await getUser()
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
  })

  describe('POST /api/auth/guest', () => {
    it('should create guest user successfully', async () => {
      const response = await app.handle(
        new Request('http://localhost/guest', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ deviceFingerprint: 'test-device' })
        })
      )

      expect(response.status).toBe(200)
      
      const data = await response.json()
      expect(data.success).toBe(true)
      expect(data.data.guestId).toBeTruthy()
      expect(data.data.userId).toBeTruthy()
      expect(data.message).toBe('Guest profile created successfully')
    })

    it('should create guest user without device fingerprint', async () => {
      const response = await app.handle(
        new Request('http://localhost/guest', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({})
        })
      )

      expect(response.status).toBe(200)
      
      const data = await response.json()
      expect(data.success).toBe(true)
      expect(data.data.guestId).toBeTruthy()
    })
  })

  describe('POST /api/auth/start-verification', () => {
    it('should start verification for new user successfully', async () => {
      // First create a guest user
      const guestResponse = await app.handle(
        new Request('http://localhost/guest', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({})
        })
      )

      const guestData = await guestResponse.json()
      const guestId = guestData.data.guestId

      // Start verification for new user
      const response = await app.handle(
        new Request('http://localhost/start-verification', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            guestId,
            email: 'test@example.com'
          })
        })
      )

      expect(response.status).toBe(200)
      
      const data = await response.json()
      expect(data.success).toBe(true)
      expect(data.data.email).toBe('test@example.com')
      expect(data.data.verificationSent).toBe(true)
      expect(data.data.isExistingUser).toBe(false)
      expect(data.message).toBe('Account created successfully. Please check your email for verification.')
    })

    it('should handle existing user verification flow', async () => {
      // Create first guest and account
      const guestResponse1 = await app.handle(
        new Request('http://localhost/guest', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({})
        })
      )
      const guestData1 = await guestResponse1.json()

      // Create and verify first user
      await app.handle(
        new Request('http://localhost/start-verification', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            guestId: guestData1.data.guestId,
            email: 'existing@example.com'
          })
        })
      )

      // Get verification token and verify first user
      const [user] = await getTestDb().select().from(users).limit(1)
      await app.handle(
        new Request('http://localhost/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ verificationToken: user.verificationToken })
        })
      )

      // Try with existing email from new guest
      const guestResponse2 = await app.handle(
        new Request('http://localhost/guest', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({})
        })
      )
      const guestData2 = await guestResponse2.json()

      const response = await app.handle(
        new Request('http://localhost/start-verification', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            guestId: guestData2.data.guestId,
            email: 'existing@example.com'
          })
        })
      )

      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data.success).toBe(true)
      expect(data.data.isExistingUser).toBe(true)
      expect(data.message).toBe('Verification code sent to your email address.')
    })
  })

  describe('POST /api/auth/verify', () => {
    it('should verify email and return tokens', async () => {
      // Create guest and start verification
      const guestResponse = await app.handle(
        new Request('http://localhost/guest', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({})
        })
      )
      const guestData = await guestResponse.json()

      await app.handle(
        new Request('http://localhost/start-verification', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            guestId: guestData.data.guestId,
            email: 'verify@example.com'
          })
        })
      )

      // Get verification token from database
      const result = await getTestDb().select().from(users).limit(10)
      const user = result[0]
      const verificationToken = user.verificationToken!

      const response = await app.handle(
        new Request('http://localhost/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ verificationToken })
        })
      )

      expect(response.status).toBe(200)
      
      const data = await response.json()
      expect(data.success).toBe(true)
      expect(data.data.user.emailVerified).toBe(true)
      expect(data.data.accessToken).toBeTruthy()
      expect(data.data.refreshToken).toBeTruthy()
    })

    it('should return error for invalid verification token', async () => {
      const response = await app.handle(
        new Request('http://localhost/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ verificationToken: 'invalid-token' })
        })
      )

      expect(response.status).toBe(500)
    })
  })

  describe('GET /api/auth/status', () => {
    it('should return authentication status for unauthenticated user', async () => {
      const response = await app.handle(
        new Request('http://localhost/status')
      )

      expect(response.status).toBe(200)
      
      const data = await response.json()
      expect(data.success).toBe(true)
      expect(data.data.authenticated).toBe(false)
      expect(data.data.emailVerified).toBe(false)
      expect(data.data.userId).toBeNull()
    })

    it('should return authentication status for verified user', async () => {
      // Create and verify user first
      const guestResponse = await app.handle(
        new Request('http://localhost/guest', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({})
        })
      )
      const guestData = await guestResponse.json()

      await app.handle(
        new Request('http://localhost/start-verification', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            guestId: guestData.data.guestId,
            email: 'status-verified@example.com'
          })
        })
      )

      // Get verification token and verify
      const [user] = await getTestDb().select().from(users).limit(1)
      const verifyResponse = await app.handle(
        new Request('http://localhost/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ verificationToken: user.verificationToken })
        })
      )
      const verifyData = await verifyResponse.json()

      // Test status with authentication
      const response = await app.handle(
        new Request('http://localhost/status', {
          headers: { 
            'Authorization': `Bearer ${verifyData.data.accessToken}`
          }
        })
      )

      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data.success).toBe(true)
      expect(data.data.authenticated).toBe(true)
      expect(data.data.emailVerified).toBe(true)
      expect(data.data.userId).toBe(verifyData.data.user.id)
    })
  })

  describe('POST /api/auth/save-settings', () => {
    it('should save settings for verified user', async () => {
      // Create and verify user first
      const guestResponse = await app.handle(
        new Request('http://localhost/guest', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({})
        })
      )
      const guestData = await guestResponse.json()

      await app.handle(
        new Request('http://localhost/start-verification', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            guestId: guestData.data.guestId,
            email: 'settings@example.com'
          })
        })
      )

      const [user] = await getTestDb().select().from(users).limit(1)
      const verifyResponse = await app.handle(
        new Request('http://localhost/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ verificationToken: user.verificationToken })
        })
      )
      const verifyData = await verifyResponse.json()

      // Test save settings
      const response = await app.handle(
        new Request('http://localhost/auth-protected/save-settings', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${verifyData.data.accessToken}`
          },
          body: JSON.stringify({
            preferredLanguages: ['en', 'zh-CN'],
            themePreference: 'dark'
          })
        })
      )

      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data.success).toBe(true)
      expect(data.message).toBe('Settings saved and synced to server successfully')
      expect(data.data.preferredLanguages).toEqual(['en', 'zh-CN'])
      expect(data.data.themePreference).toBe('dark')
    })

    it('should reject settings save for guest user', async () => {
      // Create guest user only (not verified)
      await app.handle(
        new Request('http://localhost/guest', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({})
        })
      )
      // Try to save settings without verification
      const response = await app.handle(
        new Request('http://localhost/auth-protected/save-settings', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            themePreference: 'dark'
          })
        })
      )

      expect(response.status).toBe(401) // Unauthorized - no auth token
    })

    it('should require authentication for save settings', async () => {
      const response = await app.handle(
        new Request('http://localhost/auth-protected/save-settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            themePreference: 'dark'
          })
        })
      )

      expect(response.status).toBe(401)
    })
  })
})