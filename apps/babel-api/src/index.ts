// Load environment variables FIRST before any other imports
import { config } from 'dotenv'
import { resolve } from 'path'

// Load environment variables from .env file
config({ path: resolve(process.cwd(), '.env') })

import { cors } from "@elysiajs/cors"
import { swagger } from "@elysiajs/swagger"
import { Elysia } from "elysia"
import { checkDatabaseHealth, runMigrationsWithFolder } from "@babel-feed/pgdb"
import { authGuard } from './middleware/auth.middleware.js'
import { cacheMiddleware, cacheStatsRoute } from "./middleware/cache.js"
import { statsMiddleware, statsRoute } from "./middleware/logging.js"
import { contentValidationMiddleware, rateLimitMiddleware, securityMiddleware } from "./middleware/rateLimit.js"
import { articleRoutes } from "./routes/article.routes.js"
import { authRoutes } from "./routes/auth.routes.js"
import { translationRoutes } from "./routes/translation.js"

const app = new Elysia()
  // Add stats middleware
  .use(statsMiddleware)

  // Add CORS support
  .use(cors({
    origin: true, // Allow all origins in development
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true
  }))

  .use(authGuard)
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
        { name: "Authentication", description: "User authentication and profile management" },
        { name: "Articles", description: "News articles and content management" },
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
      health: "/health",
      auth: "/api/auth",
      translate: "/api/translation/stream",
      languages: "/api/translation/languages",
      models: "/api/translation/models",
      articles: "/api/articles"
    }
  }))

  // Health check with detailed info
  .get("/health", async () => {
    const dbHealth = await checkDatabaseHealth()
    
    return {
      status: dbHealth.healthy ? "healthy" : "degraded",
      version: "1.0.0",
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      environment: {
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch
      },
      services: {
        database: {
          status: dbHealth.healthy ? "healthy" : "unhealthy",
          error: dbHealth.error || null
        }
      },
      config: {
        openrouterConfigured: !!process.env.OPENROUTER_API_KEY,
        cachingEnabled: process.env.ENABLE_CACHING === "true",
        streamingEnabled: process.env.ENABLE_STREAMING !== "false",
        rateLimitEnabled: process.env.RATE_LIMIT_ENABLED !== "false",
        databaseConfigured: dbHealth.healthy
      },
      timestamp: new Date().toISOString()
    }
  })

  // Add authentication routes
  .use(authRoutes)
  
  // Add translation routes
  .use(translationRoutes)
  
  // Add article routes
  .use(articleRoutes)
  
  // Add cache management routes
  .use(cacheStatsRoute)
  
  // Add logging stats routes
  .use(statsRoute)

  // Add detailed logging hooks directly to main app
  .onRequest(({ request }) => {
    const timestamp = new Date().toISOString()
    const method = request.method
    const url = request.url
    const path = new URL(url).pathname
    
    console.log(`\n🔵 [${timestamp}] ${method} ${path}`)
    console.log(`   URL: ${url}`)
    
    // Log headers (excluding sensitive ones)
    const headers = Object.fromEntries(
      Object.entries(request.headers).filter(([key]) => 
        !key.toLowerCase().includes('authorization') && 
        !key.toLowerCase().includes('cookie')
      )
    )
    if (Object.keys(headers).length > 0) {
      console.log(`   Headers:`, headers)
    }
  })
  
  .onBeforeHandle(({ body }) => {
    // Log request body for non-GET requests (truncate if too long)
    if (body && typeof body === 'object') {
      const bodyStr = JSON.stringify(body, null, 2)
      const truncatedBody = bodyStr.length > 1000 
        ? bodyStr.substring(0, 1000) + '...\n  [TRUNCATED]'
        : bodyStr
      console.log(`   📄 Request Body:\n${truncatedBody}`)
    } else if (body && typeof body === 'string' && body.length > 0) {
      const truncatedBody = body.length > 500 
        ? body.substring(0, 500) + '...[TRUNCATED]'
        : body
      console.log(`   📄 Request Body: ${truncatedBody}`)
    }
  })
  
  .onAfterHandle(({ response, request, set }) => {
    const timestamp = new Date().toISOString()
    const method = request.method
    const url = request.url
    const path = new URL(url).pathname
    const status = typeof set.status === 'number' ? set.status : 200
    
    // Determine status color
    const statusColor = status >= 500 ? '🔴' : 
                       status >= 400 ? '🟡' : 
                       status >= 300 ? '🟠' : '🟢'
    
    console.log(`${statusColor} [${timestamp}] ${method} ${path} - ${status}`)
    
    // Log response body (truncate if too long)
    if (response && typeof response === 'object') {
      try {
        const responseStr = JSON.stringify(response, null, 2)
        const truncatedResponse = responseStr.length > 1000 
          ? responseStr.substring(0, 1000) + '...\n  [TRUNCATED]'
          : responseStr
        console.log(`   📤 Response Body:\n${truncatedResponse}`)
      } catch (error) {
        console.log(`   📤 Response Body: [Unable to stringify response]`)
      }
    }
    
    console.log(`   ⏱️  Complete\n`)
  })

  // Error handling
  .onError(({ code, error, set }) => {
    console.error(`Error [${code}]:`, error)
    
    switch (code) {
      case "VALIDATION":
        set.status = 400
        return {
          error: {
            code: "VALIDATION_ERROR",
            message: "Request validation failed",
            details: error.message
          },
          timestamp: new Date().toISOString()
        }
      
      case "NOT_FOUND":
        set.status = 404
        return {
          error: {
            code: "NOT_FOUND",
            message: "Endpoint not found",
            details: null
          },
          timestamp: new Date().toISOString()
        }
      
      default:
        set.status = 500
        return {
          error: {
            code: "INTERNAL_ERROR",
            message: "Internal server error",
            details: process.env.NODE_ENV === "development" ? (error as Error).message : null
          },
          timestamp: new Date().toISOString()
        }
    }
  })
  .listen({
    port: process.env.PORT || 3000,
    hostname: process.env.HOST || "0.0.0.0"
  })

// Initialize database on startup
async function initializeApp() {
  try {
    console.log('🗄️  Initializing database...')
    await runMigrationsWithFolder('../../packages/pgdb/src/migrations')
    console.log('✅ Database initialized successfully')
  } catch (error) {
    console.error('❌ Database initialization failed:', error)
    console.log('⚠️  API will continue without database functionality')
  }
}

// Run initialization
initializeApp()

console.log(
  `🦊 Babel Feed Translation API is running at ${app.server?.hostname}:${app.server?.port}`
)

console.log(
  `📚 API Documentation available at http://${app.server?.hostname}:${app.server?.port}/swagger`
)

console.log(
  `🏥 Health check available at http://${app.server?.hostname}:${app.server?.port}/health`
)

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("🛑 SIGTERM received, shutting down gracefully...")
  app.stop()
  process.exit(0)
})

process.on("SIGINT", () => {
  console.log("🛑 SIGINT received, shutting down gracefully...")
  app.stop()
  process.exit(0)
})

export { app }
