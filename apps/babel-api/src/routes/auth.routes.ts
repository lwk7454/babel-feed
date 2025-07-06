import { Elysia, t } from 'elysia'
import { userService } from '../services/user.service.js'
import { authMiddleware } from '../middleware/auth.middleware.js'
import { User } from '@babel-feed/pgdb'

/**
 * Authentication routes for user management
 */
export const authRoutes = new Elysia({ prefix: '/api/auth' })
  .use(authMiddleware)
  
  /**
   * Create guest profile
   */
  .post('/guest', 
    async ({ body, set }) => {
      try {
        const deviceFingerprint = (body as any).deviceFingerprint
        const user = await userService.createGuestUser(deviceFingerprint)
        
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
        set.status = 500
        return {
          success: false,
          error: {
            code: 'GUEST_CREATION_FAILED',
            message: 'Failed to create guest profile',
            details: error instanceof Error ? error.message : 'Unknown error'
          }
        }
      }
    },
    {
      body: t.Object({
        deviceFingerprint: t.Optional(t.String())
      }),
      detail: {
        tags: ['Authentication'],
        summary: 'Create guest profile',
        description: 'Creates a new guest user profile for anonymous usage'
      }
    }
  )
  
  /**
   * Start verification (unified endpoint for new and existing users)
   */
  .post('/start-verification',
    async ({ body, set }) => {
      try {
        const { guestId, email } = body as any
        const result = await userService.startVerification(guestId, email)
        
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
            set.status = 404 // Not found
            return {
              success: false,
              error: {
                code: 'GUEST_USER_NOT_FOUND',
                message: 'Invalid guest user',
                details: 'The guest user ID provided was not found.'
              }
            }
          }
        }
        
        set.status = 500
        return {
          success: false,
          error: {
            code: 'VERIFICATION_START_FAILED',
            message: 'Failed to start verification',
            details: error instanceof Error ? error.message : 'Unknown error'
          }
        }
      }
    },
    {
      body: t.Object({
        guestId: t.String(),
        email: t.String({ format: 'email' })
      }),
      detail: {
        tags: ['Authentication'],
        summary: 'Start verification (unified)',
        description: 'Handles both new account creation and existing user verification with single endpoint'
      }
    }
  )
  
  /**
   * Resend verification code
   */
  .post('/resend-verification',
    async ({ body, set }) => {
      try {
        const { email } = body as any
        await userService.resendVerificationCode(email)
        
        return {
          success: true,
          message: 'Verification code sent successfully'
        }
      } catch (error) {
        console.error('Resend verification error:', error)
        
        if (error instanceof Error) {
          if (error.message.includes('User not found')) {
            set.status = 404
            return {
              success: false,
              error: {
                code: 'USER_NOT_FOUND',
                message: 'User not found',
                details: 'No account found with this email address.'
              }
            }
          }
          if (error.message.includes('already verified')) {
            set.status = 400
            return {
              success: false,
              error: {
                code: 'ALREADY_VERIFIED',
                message: 'Email already verified',
                details: 'This email address is already verified. You can log in directly.'
              }
            }
          }
        }
        
        set.status = 500
        return {
          success: false,
          error: {
            code: 'RESEND_FAILED',
            message: 'Failed to resend verification code',
            details: error instanceof Error ? error.message : 'Unknown error'
          }
        }
      }
    },
    {
      body: t.Object({
        email: t.String({ format: 'email' })
      }),
      detail: {
        tags: ['Authentication'],
        summary: 'Resend verification code',
        description: 'Resends verification code to the email address'
      }
    }
  )
  
  /**
   * Verify email address
   */
  .post('/verify',
    async ({ body, set }) => {
      try {
        const { verificationToken } = body as any
        const result = await userService.verifyEmail(verificationToken)
        
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
            set.status = 400 // Bad request
            return {
              success: false,
              error: {
                code: 'INVALID_VERIFICATION_TOKEN',
                message: 'Invalid or expired verification token',
                details: 'Please request a new verification code.'
              }
            }
          }
          if (error.message.includes('expired')) {
            set.status = 410 // Gone
            return {
              success: false,
              error: {
                code: 'VERIFICATION_TOKEN_EXPIRED',
                message: 'Verification token has expired',
                details: 'Please request a new verification code.'
              }
            }
          }
        }
        
        set.status = 500
        return {
          success: false,
          error: {
            code: 'EMAIL_VERIFICATION_FAILED',
            message: 'Email verification failed',
            details: error instanceof Error ? error.message : 'Unknown error'
          }
        }
      }
    },
    {
      body: t.Object({
        verificationToken: t.String()
      }),
      detail: {
        tags: ['Authentication'],
        summary: 'Verify email address',
        description: 'Verifies email address and returns authentication tokens, includes preferences for existing users'
      }
    }
  )
  
  /**
   * Refresh access token
   */
  .post('/refresh',
    async ({ body, set }) => {
      try {
        const { refreshToken } = body as any
        const tokens = await userService.refreshToken(refreshToken)
        
        if (!tokens) {
          set.status = 401
          return {
            success: false,
            error: {
              code: 'INVALID_REFRESH_TOKEN',
              message: 'Invalid or expired refresh token',
              details: 'Please log in again.'
            }
          }
        }
        
        return {
          success: true,
          data: tokens,
          message: 'Tokens refreshed successfully'
        }
      } catch (error) {
        console.error('Token refresh error:', error)
        set.status = 500
        return {
          success: false,
          error: {
            code: 'TOKEN_REFRESH_FAILED',
            message: 'Failed to refresh tokens',
            details: error instanceof Error ? error.message : 'Unknown error'
          }
        }
      }
    },
    {
      body: t.Object({
        refreshToken: t.String()
      }),
      detail: {
        tags: ['Authentication'],
        summary: 'Refresh access token',
        description: 'Refreshes access token using refresh token'
      }
    }
  )
  
  /**
   * Logout user
   */
  .post('/logout',
    async ({ headers }) => {
      try {
        const authorization = headers.authorization
        if (authorization && authorization.startsWith('Bearer ')) {
          const accessToken = authorization.substring(7)
          await userService.logout(accessToken)
        }
        
        return {
          success: true,
          message: 'Logged out successfully'
        }
      } catch (error) {
        console.error('Logout error:', error)
        // Don't throw error for logout - always return success
        return {
          success: true,
          message: 'Logged out successfully'
        }
      }
    },
    {
      detail: {
        tags: ['Authentication'],
        summary: 'Logout user',
        description: 'Invalidates current session and logs out user'
      }
    }
  )
  
  /**
   * Get current user profile
   */
  .get('/profile',
    async ({ user }) => {
      const validatedUser = user as User
      return {
        success: true,
        data: {
          id: validatedUser.id,
          email: validatedUser.email,
          guestId: validatedUser.guestId,
          emailVerified: validatedUser.emailVerified,
          userStatus: validatedUser.userStatus,
          createdAt: validatedUser.createdAt,
          updatedAt: validatedUser.updatedAt
        }
      }
    },
    {
      requireAuth: true,
      detail: {
        tags: ['Authentication'],
        summary: 'Get user profile',
        description: 'Returns current user profile information (requires authentication)'
      }
    }
  )
  
  /**
   * Update user preferences
   */
  .put('/preferences',
    async ({ user, body, set }) => {
      try {
        const validatedUser = user as User
        await userService.updateUserPreferences(validatedUser.id, body as any)
        const preferences = await userService.getUserPreferences(validatedUser.id)
        
        return {
          success: true,
          data: preferences,
          message: 'Preferences updated successfully'
        }
      } catch (error) {
        console.error('Preferences update error:', error)
        set.status = 500
        return {
          success: false,
          error: {
            code: 'PREFERENCES_UPDATE_FAILED',
            message: 'Failed to update preferences',
            details: error instanceof Error ? error.message : 'Unknown error'
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
      }),
      requireAuth: true,
      detail: {
        tags: ['Authentication'],
        summary: 'Update user preferences',
        description: 'Updates user preferences and settings (requires authentication)'
      }
    }
  )

  /**
   * Save settings (sync to server) - for verified users only
   */
  .post('/save-settings',
    async ({ user, body, set }) => {
      try {
        const validatedUser = user as User
        await userService.updateUserPreferences(validatedUser.id, body as any)
        const preferences = await userService.getUserPreferences(validatedUser.id)
        
        return {
          success: true,
          data: preferences,
          message: 'Settings saved and synced to server successfully'
        }
      } catch (error) {
        console.error('Settings save error:', error)
        set.status = 500
        return {
          success: false,
          error: {
            code: 'SETTINGS_SAVE_FAILED',
            message: 'Failed to save settings',
            details: error instanceof Error ? error.message : 'Unknown error'
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
      }),
      requireVerifiedEmail: true,
      detail: {
        tags: ['Authentication'],
        summary: 'Save settings (verified users only)',
        description: 'Saves and syncs user settings to server for verified users'
      }
    }
  )
  
  /**
   * Get user preferences
   */
  .get('/preferences',
    async ({ user, set }) => {
      try {
        const validatedUser = user as User
        const preferences = await userService.getUserPreferences(validatedUser.id)
        
        return {
          success: true,
          data: preferences || null
        }
      } catch (error) {
        console.error('Get preferences error:', error)
        set.status = 500
        return {
          success: false,
          error: {
            code: 'PREFERENCES_FETCH_FAILED',
            message: 'Failed to get preferences',
            details: error instanceof Error ? error.message : 'Unknown error'
          }
        }
      }
    },
    {
      requireAuth: true,
      detail: {
        tags: ['Authentication'],
        summary: 'Get user preferences',
        description: 'Returns user preferences and settings (requires authentication)'
      }
    }
  )
  
  /**
   * Check authentication status
   */
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
    },
    {
      detail: {
        tags: ['Authentication'],
        summary: 'Check authentication status',
        description: 'Returns current authentication status (no auth required - shows current status)'
      }
    }
  )