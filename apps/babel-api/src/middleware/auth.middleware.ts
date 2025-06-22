import { Elysia } from 'elysia';
import { userService } from '../services/user.service.js';

/**
 * Authentication middleware for protecting routes
 */
export const authMiddleware = new Elysia({ name: 'auth' })
  .derive(async ({ headers, set }) => {
    const authorization = headers.authorization;
    
    if (!authorization || !authorization.startsWith('Bearer ')) {
      return { user: null };
    }
    
    const token = authorization.substring(7); // Remove 'Bearer ' prefix
    const user = await userService.validateAccessToken(token);
    
    return { user };
  })
  .macro(({ onBeforeHandle }) => ({
    /**
     * Require authentication for this route
     */
    requireAuth(enabled: boolean = true) {
      if (!enabled) return;
      
      onBeforeHandle(({ user, set }) => {
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
      });
    },
    
    /**
     * Require verified email for this route
     */
    requireVerifiedEmail(enabled: boolean = true) {
      if (!enabled) return;
      
      onBeforeHandle(({ user, set }) => {
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
        
        if (!user.emailVerified) {
          set.status = 403;
          return {
            error: {
              code: 'EMAIL_NOT_VERIFIED',
              message: 'Email verification required',
              details: 'Please verify your email address to access this resource'
            },
            timestamp: new Date().toISOString()
          };
        }
      });
    }
  }));