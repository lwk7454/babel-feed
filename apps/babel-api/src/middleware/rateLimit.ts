import { Elysia } from "elysia";

// Simple in-memory rate limiter (for development)
// In production, you'd want to use Redis or a proper rate limiting service
class InMemoryRateLimiter {
  private requests: Map<string, { count: number; resetTime: number }> = new Map();
  public maxRequests: number;
  private windowMs: number;

  constructor(maxRequests: number = 1000, windowMs: number = 86400000) { // 24 hours
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
    
    // Clean up expired entries every hour
    setInterval(() => this.cleanup(), 3600000);
  }

  private cleanup() {
    const now = Date.now();
    for (const [key, data] of this.requests.entries()) {
      if (now > data.resetTime) {
        this.requests.delete(key);
      }
    }
  }

  isAllowed(identifier: string): { allowed: boolean; remaining: number; resetTime: number } {
    const now = Date.now();
    const data = this.requests.get(identifier);

    if (!data || now > data.resetTime) {
      // First request or window expired
      const resetTime = now + this.windowMs;
      this.requests.set(identifier, { count: 1, resetTime });
      return { allowed: true, remaining: this.maxRequests - 1, resetTime };
    }

    if (data.count >= this.maxRequests) {
      return { allowed: false, remaining: 0, resetTime: data.resetTime };
    }

    data.count++;
    return { allowed: true, remaining: this.maxRequests - data.count, resetTime: data.resetTime };
  }
}

// Create rate limiter instance
const rateLimiter = new InMemoryRateLimiter(
  parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || "1000"),
  parseInt(process.env.RATE_LIMIT_WINDOW_MS || "86400000")
);

// Rate limiting middleware  
export const rateLimitMiddleware = new Elysia({ name: "rateLimit" })
  .derive(() => ({ rateLimiter }))
  .onBeforeHandle(({ headers, set }) => {
    // Skip rate limiting if disabled
    if (process.env.RATE_LIMIT_ENABLED === "false") {
      // Still add headers for testing
      set.headers = {
        ...set.headers,
        "X-RateLimit-Limit": "1000",
        "X-RateLimit-Remaining": "999", 
        "X-RateLimit-Reset": Math.ceil(Date.now() / 1000 + 86400).toString(),
      };
      return;
    }

    // Get client identifier (IP address or API key)
    const clientIp = headers["x-forwarded-for"] || 
                    headers["x-real-ip"] || 
                    "127.0.0.1";
    
    const identifier = Array.isArray(clientIp) ? clientIp[0] : clientIp;
    
    const result = rateLimiter.isAllowed(identifier);
    
    // Always add rate limit headers
    set.headers = {
      ...set.headers,
      "X-RateLimit-Limit": rateLimiter.maxRequests.toString(),
      "X-RateLimit-Remaining": result.remaining.toString(),
      "X-RateLimit-Reset": Math.ceil(result.resetTime / 1000).toString(),
    };

    if (!result.allowed) {
      set.status = 429;
      return {
        error: {
          code: "RATE_LIMIT_EXCEEDED",
          message: "Too many requests. Please try again later.",
          details: {
            limit: rateLimiter.maxRequests,
            remaining: result.remaining,
            resetTime: new Date(result.resetTime).toISOString()
          }
        },
        timestamp: new Date().toISOString()
      };
    }
  });

// Content length validation middleware
export const contentValidationMiddleware = new Elysia({ name: "contentValidation" })
  .onBeforeHandle(({ request, set, headers }) => {
    const contentLength = headers["content-length"];
    
    if (contentLength) {
      const length = parseInt(contentLength);
      const maxLength = 100000; // 100KB max request size
      
      if (length > maxLength) {
        set.status = 413;
        return {
          error: {
            code: "CONTENT_TOO_LARGE",
            message: `Request body too large: ${length} bytes (max: ${maxLength})`,
            details: { contentLength: length, maxLength }
          },
          timestamp: new Date().toISOString()
        };
      }
    }
  });

// Security headers middleware
export const securityMiddleware = new Elysia({ name: "security" })
  .onAfterHandle(({ set }) => {
    set.headers = {
      ...set.headers,
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
      "X-XSS-Protection": "1; mode=block",
      "Referrer-Policy": "strict-origin-when-cross-origin",
      "Content-Security-Policy": "default-src 'self'",
    };
  });