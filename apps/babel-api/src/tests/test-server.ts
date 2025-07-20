import { cors } from "@elysiajs/cors"
import { swagger } from "@elysiajs/swagger"
import { Elysia, t } from "elysia"
import { authGuard } from '../middleware/auth.middleware.js'
import { cacheStatsRoute } from "../middleware/cache.js"
import { statsMiddleware, statsRoute } from "../middleware/logging.js"
import { translationRoutes } from "../routes/translation.js"
import { getTestDb } from '@babel-feed/pgdb'
import { UserService } from '../services/user.service.js'
import { ArticleService } from '../services/article.service.js'

/**
 * Test server setup that uses test database
 */
export function createTestServer() {
  // Set test environment
  process.env.NODE_ENV = 'test'
  
  // Get test database instance
  const testDb = getTestDb()
  
  // Create services with test database
  const testUserService = new UserService(testDb)
  const testArticleService = new ArticleService()
  
  const app = new Elysia()
    // Add CORS support
    .use(cors({
      origin: true,
      methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization"],
      credentials: true
    }))

    // Create auth guard with test user service
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
          llmProvidersConfigured: false, // Test environment doesn't have providers
          cachingEnabled: false,
          streamingEnabled: false,
          rateLimitEnabled: false,
          databaseConfigured: true
        },
        timestamp: new Date().toISOString()
      }
    })

    // Create custom auth routes with test user service
    .group('/api/auth', (app) => 
      app
        .post('/guest', 
          async ({ body, set }) => {
            try {
              const deviceFingerprint = (body as { deviceFingerprint?: string }).deviceFingerprint
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
            })
          }
        )
    )
    
    // Add translation routes
    .use(translationRoutes)
    
    // Create custom article routes with test article service
    .group('/api/articles', (app) => 
      app
        .get("/", async ({ query, set }) => {
          try {
            const { limit, offset, language, search } = query
            
            let result
            if (search) {
              result = await testArticleService.searchArticles(search, {
                limit: limit ? Number(limit) : undefined,
                offset: offset ? Number(offset) : undefined,
                language: language
              })
            } else {
              result = await testArticleService.getArticles({
                limit: limit ? Number(limit) : undefined,
                offset: offset ? Number(offset) : undefined,
                language: language
              })
            }

            return {
              success: true,
              data: result.articles,
              pagination: {
                total: result.total,
                limit: limit ? Number(limit) : 20,
                offset: offset ? Number(offset) : 0,
                hasMore: result.total > (Number(offset) || 0) + (Number(limit) || 20)
              }
            }
          } catch (error) {
            console.error('GET /articles error:', error)
            set.status = 500
            return {
              success: false,
              error: 'Failed to fetch articles'
            }
          }
        })
    )
    
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