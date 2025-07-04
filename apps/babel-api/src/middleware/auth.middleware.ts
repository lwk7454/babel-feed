import { Elysia } from 'elysia';
import { userService } from '../services/user.service.js';

/**
 * Lightweight user context - safe to use globally
 * Only extracts token info without validation
 */
export const userContext = new Elysia({ name: 'userContext' })
  .derive(({ headers }) => {
    const authorization = headers.authorization;
    const token = authorization?.startsWith('Bearer ') 
      ? authorization.substring(7) 
      : null;
    
    return { 
      authToken: token,
      // Lazy user loading - only validate when actually needed
      async getUser() {
        if (!token) return null;
        return await userService.validateAccessToken(token);
      }
    };
  })
  .as('scoped');

/**
 * Factory function to create auth guard with custom user service
 */
export function createAuthGuard(customUserService?: any) {
  return new Elysia({ name: 'authGuard' })
    .derive(({ headers }) => {
      const authorization = headers.authorization;
      const token = authorization?.startsWith('Bearer ') 
        ? authorization.substring(7) 
        : null;
      
      return { 
        authToken: token,
        async getUser() {
          if (!token) return null;
          const service = customUserService || userService;
          return await service.validateAccessToken(token);
        }
      };
    })
    .derive(async ({ getUser }) => {
      const user = await getUser();
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
          return {};
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
          return {};
        });
      }
    }))
    .as('scoped');
}

/**
 * Auth guards - apply selectively to routes that need authentication
 */
export const authGuard = createAuthGuard();

/**
 * Backward compatibility - use authGuard for existing code
 * @deprecated Use authGuard instead for better flexibility
 */
export const authMiddleware = authGuard;