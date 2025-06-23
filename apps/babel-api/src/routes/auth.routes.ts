import { Elysia, t } from 'elysia';
import { userService } from '../services/user.service.js';
import { authMiddleware } from '../middleware/auth.middleware.js';

/**
 * Authentication routes for user management
 */
export const authRoutes = new Elysia({ prefix: '/api/auth' })
  .use(authMiddleware)
  
  /**
   * Create guest profile
   */
  .post('/guest', 
    async ({ body, headers }) => {
      try {
        const deviceFingerprint = body.deviceFingerprint;
        const user = await userService.createGuestUser(deviceFingerprint);
        
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
      }),
      detail: {
        tags: ['Authentication'],
        summary: 'Create guest profile',
        description: 'Creates a new guest user profile for anonymous usage'
      }
    }
  )
  
  /**
   * Create account from guest
   */
  .post('/create-account',
    async ({ body }) => {
      try {
        const { guestId, email } = body;
        const result = await userService.createAccountFromGuest(guestId, email);
        
        // In a real app, you would send verification email here
        // OTP email is sent automatically by the user service
        
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
      }),
      detail: {
        tags: ['Authentication'],
        summary: 'Create account from guest',
        description: 'Links a guest profile to an email address and sends verification email'
      }
    }
  )
  
  /**
   * Verify email address
   */
  .post('/verify',
    async ({ body }) => {
      try {
        const { verificationToken } = body;
        const result = await userService.verifyEmail(verificationToken);
        
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
      }),
      detail: {
        tags: ['Authentication'],
        summary: 'Verify email address',
        description: 'Verifies email address and returns authentication tokens'
      }
    }
  )
  
  /**
   * Refresh access token
   */
  .post('/refresh',
    async ({ body }) => {
      try {
        const { refreshToken } = body;
        const tokens = await userService.refreshToken(refreshToken);
        
        if (!tokens) {
          throw new Error('Invalid or expired refresh token');
        }
        
        return {
          success: true,
          data: tokens,
          message: 'Tokens refreshed successfully'
        };
      } catch (error) {
        console.error('Token refresh error:', error);
        throw new Error('Failed to refresh tokens');
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
        const authorization = headers.authorization;
        if (authorization && authorization.startsWith('Bearer ')) {
          const accessToken = authorization.substring(7);
          await userService.logout(accessToken);
        }
        
        return {
          success: true,
          message: 'Logged out successfully'
        };
      } catch (error) {
        console.error('Logout error:', error);
        // Don't throw error for logout - always return success
        return {
          success: true,
          message: 'Logged out successfully'
        };
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
      return {
        success: true,
        data: {
          id: user!.id,
          email: user!.email,
          guestId: user!.guestId,
          emailVerified: user!.emailVerified,
          createdAt: user!.createdAt,
          updatedAt: user!.updatedAt
        }
      };
    },
    {
      requireAuth: true,
      detail: {
        tags: ['Authentication'],
        summary: 'Get user profile',
        description: 'Returns current user profile information'
      }
    }
  )
  
  /**
   * Update user preferences
   */
  .put('/preferences',
    async ({ user, body }) => {
      try {
        await userService.updateUserPreferences(user!.id, body);
        const preferences = await userService.getUserPreferences(user!.id);
        
        return {
          success: true,
          data: preferences,
          message: 'Preferences updated successfully'
        };
      } catch (error) {
        console.error('Preferences update error:', error);
        throw new Error('Failed to update preferences');
      }
    },
    {
      requireAuth: true,
      body: t.Object({
        preferredLanguages: t.Optional(t.Array(t.String())),
        feedCategories: t.Optional(t.Array(t.String())),
        translationSettings: t.Optional(t.Object({})),
        themePreference: t.Optional(t.String()),
        notificationSettings: t.Optional(t.Object({})),
        privacySettings: t.Optional(t.Object({}))
      }),
      detail: {
        tags: ['Authentication'],
        summary: 'Update user preferences',
        description: 'Updates user preferences and settings'
      }
    }
  )
  
  /**
   * Get user preferences
   */
  .get('/preferences',
    async ({ user }) => {
      try {
        const preferences = await userService.getUserPreferences(user!.id);
        
        return {
          success: true,
          data: preferences || null
        };
      } catch (error) {
        console.error('Get preferences error:', error);
        throw new Error('Failed to get preferences');
      }
    },
    {
      requireAuth: true,
      detail: {
        tags: ['Authentication'],
        summary: 'Get user preferences',
        description: 'Returns user preferences and settings'
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
      };
    },
    {
      detail: {
        tags: ['Authentication'],
        summary: 'Check authentication status',
        description: 'Returns current authentication status'
      }
    }
  );