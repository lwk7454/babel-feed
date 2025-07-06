import { cors } from "@elysiajs/cors"
import { swagger } from "@elysiajs/swagger"
import { Elysia } from "elysia"
import { authGuard } from '../middleware/auth.middleware.js'
import { cacheStatsRoute } from "../middleware/cache.js"
import { statsMiddleware, statsRoute } from "../middleware/logging.js"
import { articleRoutes } from "../routes/article.routes.js"
import { authRoutes } from "../routes/auth.routes.js"
import { translationRoutes } from "../routes/translation.js"
import { getTestDb } from '@babel-feed/pgdb'

/**
 * Test server setup that uses test database
 */
export function createTestServer() {
  // Set test environment
  process.env.NODE_ENV = 'test'
  
  const app = new Elysia()
    // Add CORS support
    .use(cors({
      origin: true,
      methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization"],
      credentials: true
    }))

    .use(authGuard)
    
    // Add minimal middleware for tests
    .use(statsMiddleware)
    
    // Add Swagger documentation
    .use(swagger({
      documentation: {
        info: {
          title: "Babel Feed Translation API - Test",
          description: "Test server for API testing",
          version: "1.0.0-test"
        }
      }
    }))

    // Health check endpoint
    .get("/", () => ({
      message: "Babel Feed Translation API - Test Server",
      version: "1.0.0",
      status: "healthy",
      timestamp: new Date().toISOString(),
      environment: "test"
    }))

    // Test health check with simple response
    .get("/health", () => {
      return {
        status: "healthy",
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
            status: "healthy",
            error: null
          }
        },
        config: {
          openrouterConfigured: false,
          cachingEnabled: false,
          streamingEnabled: false,
          rateLimitEnabled: false,
          databaseConfigured: true
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

    // Error handling
    .onError(({ code, error, set }) => {
      console.error(`Test Server Error [${code}]:`, error)
      
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
              details: error instanceof Error ? error.message : null
            },
            timestamp: new Date().toISOString()
          }
      }
    })

  return app
}

/**
 * Test server instance management
 */
let testServerInstance: ReturnType<typeof createTestServer> | null = null

export async function startTestServer(port = 3010): Promise<{ server: ReturnType<typeof createTestServer>; url: string }> {
  if (testServerInstance) {
    await stopTestServer()
  }

  // Ensure test database is available
  try {
    getTestDb()
  } catch (error) {
    console.error('Test database not available:', error)
    throw error
  }

  testServerInstance = createTestServer()
  
  await new Promise<void>((resolve, reject) => {
    try {
      testServerInstance!.listen({
        port,
        hostname: "localhost"
      }, () => {
        console.log(`🧪 Test server started at http://localhost:${port}`)
        resolve()
      })
    } catch (error) {
      reject(error)
    }
  })

  const url = `http://localhost:${port}`
  
  // Wait a bit more for server to be ready
  await new Promise(resolve => setTimeout(resolve, 500))
  
  return { server: testServerInstance, url }
}

export async function stopTestServer(): Promise<void> {
  if (testServerInstance) {
    testServerInstance.stop()
    testServerInstance = null
    console.log('🧪 Test server stopped')
  }
}

export function getTestServerUrl(port = 3010): string {
  return `http://localhost:${port}`
}