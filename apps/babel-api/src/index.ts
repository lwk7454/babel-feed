import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";
import { swagger } from "@elysiajs/swagger";
import { translationRoutes } from "./routes/translation.js";
import { rateLimitMiddleware, contentValidationMiddleware, securityMiddleware } from "./middleware/rateLimit.js";
import { cacheMiddleware, cacheStatsRoute } from "./middleware/cache.js";

const app = new Elysia()
  // Add CORS support
  .use(cors({
    origin: true, // Allow all origins in development
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true
  }))

  // Add security middleware
  .use(securityMiddleware)
  
  // Add content validation
  .use(contentValidationMiddleware)
  
  // Add rate limiting
  .use(rateLimitMiddleware)
  
  // Add caching
  .use(cacheMiddleware)
  
  // Add Swagger documentation
  .use(swagger({
    documentation: {
      info: {
        title: "Babel Feed Translation API",
        description: "Backend API for assisted translation using OpenRouter models",
        version: "1.0.0",
        contact: {
          name: "Babel Feed",
          url: "https://babel-feed.com"
        }
      },
      tags: [
        { name: "Translation", description: "Translation endpoints" },
        { name: "Health", description: "Health check endpoints" },
        { name: "Cache", description: "Cache management endpoints" }
      ],
      servers: [
        {
          url: "http://localhost:3000",
          description: "Development server"
        },
        {
          url: "https://api.babelfeed.com",
          description: "Production server"
        }
      ]
    }
  }))

  // Health check endpoint
  .get("/", () => ({
    message: "Babel Feed Translation API",
    version: "1.0.0",
    status: "healthy",
    timestamp: new Date().toISOString(),
    endpoints: {
      docs: "/swagger",
      health: "/api/translation/health",
      translate: "/api/translation/stream",
      languages: "/api/translation/languages",
      models: "/api/translation/models"
    }
  }))

  // Health check with detailed info
  .get("/health", () => ({
    status: "healthy",
    version: "1.0.0",
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    environment: {
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch
    },
    config: {
      openrouterConfigured: !!process.env.OPENROUTER_API_KEY,
      cachingEnabled: process.env.ENABLE_CACHING === "true",
      streamingEnabled: process.env.ENABLE_STREAMING !== "false",
      rateLimitEnabled: process.env.RATE_LIMIT_ENABLED !== "false"
    },
    timestamp: new Date().toISOString()
  }))

  // Add translation routes
  .use(translationRoutes)
  
  // Add cache management routes
  .use(cacheStatsRoute)

  // Error handling
  .onError(({ code, error, set }) => {
    console.error(`Error [${code}]:`, error);
    
    switch (code) {
      case "VALIDATION":
        set.status = 400;
        return {
          error: {
            code: "VALIDATION_ERROR",
            message: "Request validation failed",
            details: error.message
          },
          timestamp: new Date().toISOString()
        };
      
      case "NOT_FOUND":
        set.status = 404;
        return {
          error: {
            code: "NOT_FOUND",
            message: "Endpoint not found",
            details: null
          },
          timestamp: new Date().toISOString()
        };
      
      default:
        set.status = 500;
        return {
          error: {
            code: "INTERNAL_ERROR",
            message: "Internal server error",
            details: process.env.NODE_ENV === "development" ? error.message : null
          },
          timestamp: new Date().toISOString()
        };
    }
  })

  .listen({
    port: process.env.PORT || 3000,
    hostname: process.env.HOST || "0.0.0.0"
  });

console.log(
  `🦊 Babel Feed Translation API is running at ${app.server?.hostname}:${app.server?.port}`
);

console.log(
  `📚 API Documentation available at http://${app.server?.hostname}:${app.server?.port}/swagger`
);

console.log(
  `🏥 Health check available at http://${app.server?.hostname}:${app.server?.port}/health`
);

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("🛑 SIGTERM received, shutting down gracefully...");
  app.stop();
  process.exit(0);
});

process.on("SIGINT", () => {
  console.log("🛑 SIGINT received, shutting down gracefully...");
  app.stop();
  process.exit(0);
});

export { app };
