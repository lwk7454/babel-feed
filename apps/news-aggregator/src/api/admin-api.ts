import { articles, articleTranslations, getDatabase, getTestDb } from '@babel-feed/pgdb'
import { and, desc, eq, like, or, sql, type SQL } from 'drizzle-orm'
import { Elysia, t } from 'elysia'
import { logger } from '@babel-feed/utils'
import { HealthChecker } from '../services/health-checker'
import { MetricsService } from '../services/metrics-service'
import { NewsSourceManager } from '../services/news-source-manager'
import { RecommendationEngine, type RecommendationContext, type RecommendationConfig } from '../modules/recommendation'

interface CreateSourceRequest {
  name: string
  slug: string
  url: string
  sourceType: 'rss' | 'json' | 'html' | 'api' | 'scraper'
  language: string
  category: string
  tags: string[]
  enabled: boolean
  pollingInterval: number
  reliability: number
  priority: number
  metadata: Record<string, unknown>
}

type UpdateSourceRequest = Partial<CreateSourceRequest>

interface BulkOperationRequest {
  ids: string[]
}

interface AlertConfig {
  [key: string]: unknown
}

function adminAuth() {
  return new Elysia()
    .derive(({ headers }) => {
      const key = headers['x-api-key']
      const expected = process.env.ADMIN_API_KEY
      const devBypass = !expected && process.env.NODE_ENV !== 'production'
      const authorized = devBypass || key === expected
      return { authorized }
    })
    .onBeforeHandle(({ authorized, set }) => {
      if (!authorized) {
        set.status = 401
        return { error: 'Unauthorized' }
      }
      return undefined
    })
}

export class AdminAPIServer {
  private isRunning = false
  private app = new Elysia({ prefix: '/admin' })
  private server?: unknown
  private sourceManager = new NewsSourceManager()
  private healthChecker = new HealthChecker(this.sourceManager)
  private metricsService = new MetricsService()
  private recommendationEngine = new RecommendationEngine()
  
  private async getDb() {
    return process.env.NODE_ENV === 'test' ? getTestDb() : await getDatabase()
  }

  async initialize(): Promise<void> {
    await this.sourceManager.initialize()
    await this.metricsService.initialize()
    await this.recommendationEngine.initialize()
    this.app.use(adminAuth())

    this.app.get('/health', async () => {
      return await this.healthChecker.getHealthStatus()
    })

    // Content Delivery API Endpoints
    this.app.get('/articles', async ({ query }) => {
      const { page = '1', limit = '20', language, source: _source, category: _category, search } = query as {
        page?: string
        limit?: string
        language?: string
        source?: string
        category?: string
        search?: string
      }
      
      const pageNum = parseInt(page) || 1
      const limitNum = Math.min(parseInt(limit) || 20, 100)
      const offset = (pageNum - 1) * limitNum
      
      const db = await this.getDb()
      
      const whereConditions: SQL[] = []
      
      if (language) {
        whereConditions.push(eq(articleTranslations.language, language))
      }
      
      if (search) {
        whereConditions.push(
          or(
            like(articleTranslations.title, `%${search}%`),
            like(articleTranslations.summary, `%${search}%`)
          )!
        )
      }
      
      const whereClause = whereConditions.length > 0 ? and(...whereConditions)! : sql`1=1`

      const query_builder = db
        .select({
          id: articles.id,
          url: articles.url,
          source: articles.source,
          sourceLanguage: articles.sourceLanguage,
          imageUrl: articles.imageUrl,
          publishedAt: articles.publishedAt,
          title: articleTranslations.title,
          summary: articleTranslations.summary,
          language: articleTranslations.language
        })
        .from(articles)
        .leftJoin(articleTranslations, eq(articles.id, articleTranslations.articleId))
        .where(whereClause)
        .orderBy(desc(articles.publishedAt))
        .limit(limitNum)
        .offset(offset)

      const results = await query_builder
      
      // Get total count for pagination
      const countQuery = db
        .select({ count: sql<number>`count(*)` })
        .from(articles)
        .leftJoin(articleTranslations, eq(articles.id, articleTranslations.articleId))
        .where(whereClause)
      const [{ count }] = await countQuery
      
      return {
        articles: results,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total: count,
          totalPages: Math.ceil(count / limitNum)
        }
      }
    })

    this.app.get('/articles/:id', async ({ params }) => {
      const db = await this.getDb()
      
      const article = await db
        .select()
        .from(articles)
        .where(eq(articles.id, params.id))
        .limit(1)
      
      if (!article.length) {
        return new Response('Article not found', { status: 404 })
      }
      
      const translations = await db
        .select()
        .from(articleTranslations)
        .where(eq(articleTranslations.articleId, params.id))
      
      return {
        ...article[0],
        translations
      }
    })

    this.app.get('/articles/search', async ({ query }) => {
      const { q, language = 'en', page = '1', limit = '20' } = query as {
        q?: string
        language?: string
        page?: string
        limit?: string
      }
      
      if (!q) {
        return new Response('Search query required', { status: 400 })
      }
      
      const pageNum = parseInt(page) || 1
      const limitNum = Math.min(parseInt(limit) || 20, 100)
      const offset = (pageNum - 1) * limitNum
      
      const db = await this.getDb()
      
      const results = await db
        .select({
          id: articles.id,
          url: articles.url,
          source: articles.source,
          sourceLanguage: articles.sourceLanguage,
          imageUrl: articles.imageUrl,
          publishedAt: articles.publishedAt,
          title: articleTranslations.title,
          summary: articleTranslations.summary,
          language: articleTranslations.language,
          relevance: sql<number>`
            ts_rank(
              to_tsvector('simple', ${articleTranslations.title} || ' ' || ${articleTranslations.summary}),
              plainto_tsquery('simple', ${q})
            )
          `.as('relevance')
        })
        .from(articles)
        .leftJoin(articleTranslations, eq(articles.id, articleTranslations.articleId))
        .where(
          and(
            eq(articleTranslations.language, language),
            sql`to_tsvector('simple', ${articleTranslations.title} || ' ' || ${articleTranslations.summary}) @@ plainto_tsquery('simple', ${q})`
          )
        )
        .orderBy(desc(sql`ts_rank(
          to_tsvector('simple', ${articleTranslations.title} || ' ' || ${articleTranslations.summary}),
          plainto_tsquery('simple', ${q})
        )`))
        .limit(limitNum)
        .offset(offset)
      
      return {
        articles: results,
        query: q,
        pagination: {
          page: pageNum,
          limit: limitNum
        }
      }
    })

    this.app.get('/feed', async ({ query }) => {
      const { language = 'en', categories, limit = '20' } = query as {
        language?: string
        categories?: string
        limit?: string
      }
      
      const limitNum = Math.min(parseInt(limit) || 20, 50)
      const db = await this.getDb()
      
      const whereConditions: SQL[] = [eq(articleTranslations.language, language)]
      
      if (categories) {
        // const _categoryList = categories.split(',').map(c => c.trim())
        // Note: This would need to be extended with actual category filtering
        // For now, we'll use a simple approach
      }
      
      const feedWhereClause = whereConditions.length > 0 ? and(...whereConditions) : sql`1=1`
      const results = await db
        .select({
          id: articles.id,
          url: articles.url,
          source: articles.source,
          sourceLanguage: articles.sourceLanguage,
          imageUrl: articles.imageUrl,
          publishedAt: articles.publishedAt,
          title: articleTranslations.title,
          summary: articleTranslations.summary,
          language: articleTranslations.language
        })
        .from(articles)
        .leftJoin(articleTranslations, eq(articles.id, articleTranslations.articleId))
        .where(feedWhereClause)
        .orderBy(desc(articles.publishedAt))
        .limit(limitNum)
      
      return {
        feed: results,
        language,
        timestamp: new Date().toISOString()
      }
    })

    this.app.get('/sources', async () => {
      return await this.sourceManager.getAllSources()
    })

    this.app.get('/sources/:id', async ({ params }) => {
      const source = await this.sourceManager.getSourceById(params.id)
      if (!source) return new Response('Not Found', { status: 404 })
      return source
    })

    this.app.post('/sources', async ({ body }) => {
      const data = body as CreateSourceRequest
      return await this.sourceManager.createSource(data)
    }, { body: t.Object({
      name: t.String(), slug: t.String(), url: t.String(), sourceType: t.String(),
      language: t.String(), category: t.String(), tags: t.Array(t.String()),
      enabled: t.Boolean(), pollingInterval: t.Number(), reliability: t.Number(),
      priority: t.Number(), metadata: t.Optional(t.Object({}, { additionalProperties: true }))
    }) })

    this.app.put('/sources/:id', async ({ params, body }) => {
      return await this.sourceManager.updateSource(params.id, body as UpdateSourceRequest)
    })

    this.app.delete('/sources/:id', async ({ params }) => {
      await this.sourceManager.deleteSource(params.id)
      return { success: true }
    })

    this.app.post('/sources/bulk-enable', async ({ body }) => {
      await this.sourceManager.bulkEnableSources((body as BulkOperationRequest).ids)
      return { success: true }
    })

    this.app.post('/sources/bulk-disable', async ({ body }) => {
      await this.sourceManager.bulkDisableSources((body as BulkOperationRequest).ids)
      return { success: true }
    })

    // Recommendation System Endpoints
    this.app.post('/recommendations/generate', async ({ body }) => {
      const bodyData = body as { currentTime: string; [key: string]: unknown }
      const context = {
        ...bodyData,
        currentTime: new Date(bodyData.currentTime)
      } as RecommendationContext
      return await this.recommendationEngine.generateRecommendations(context)
    }, { 
      body: t.Object({
        userId: t.String(),
        sessionId: t.Optional(t.String()),
        currentTime: t.String(),
        deviceType: t.Union([t.Literal('mobile'), t.Literal('tablet'), t.Literal('desktop')]),
        feedType: t.Union([t.Literal('home'), t.Literal('trending'), t.Literal('category'), t.Literal('search')]),
        limit: t.Number({ minimum: 1, maximum: 100 }),
        offset: t.Number({ minimum: 0 }),
        location: t.Optional(t.Object({
          country: t.String(),
          timezone: t.String()
        })),
        filters: t.Optional(t.Object({
          languages: t.Optional(t.Array(t.String())),
          categories: t.Optional(t.Array(t.String())),
          sources: t.Optional(t.Array(t.String())),
          timeRange: t.Optional(t.Object({
            start: t.String(),
            end: t.String()
          })),
          minQuality: t.Optional(t.Number()),
          excludeSeen: t.Optional(t.Boolean())
        }))
      })
    })

    this.app.get('/recommendations/trending', async ({ query }) => {
      const { timeWindow = '24', limit = '10' } = query as {
        timeWindow?: string
        limit?: string
      }
      
      const topics = await this.recommendationEngine.getTrendingTopics(
        parseInt(timeWindow),
        parseInt(limit)
      )
      
      return { trending: topics }
    })

    this.app.post('/recommendations/feedback', async ({ body }) => {
      const { userId, articleId, sessionId, type, action, rating, context: feedbackContext } = body as {
        userId: string
        articleId: string
        sessionId?: string
        type: 'implicit' | 'explicit'
        action: 'click' | 'read' | 'share' | 'save' | 'like' | 'dislike' | 'skip' | 'hide'
        rating?: number
        context: {
          position: number
          totalShown: number
          algorithm: string
          reasonCodes: string[]
        }
      }
      
      await this.recommendationEngine['behaviorAnalyzer'].recordFeedback({
        userId,
        articleId,
        sessionId,
        type,
        action,
        rating,
        timestamp: new Date(),
        context: feedbackContext
      })
      
      return { success: true }
    })

    this.app.get('/recommendations/user-insights/:userId', async ({ params }) => {
      const insights = await this.recommendationEngine['behaviorAnalyzer'].analyzeUserBehavior(params.userId)
      return { insights }
    })

    this.app.post('/recommendations/track-interaction', async ({ body }) => {
      const interaction = body as {
        userId: string
        articleId: string
        sessionId?: string
        type: 'view' | 'translate' | 'share' | 'save' | 'like' | 'dislike'
        duration?: number
        metadata?: Record<string, unknown>
      }
      
      await this.recommendationEngine['behaviorAnalyzer'].trackUserInteraction({
        ...interaction,
        timestamp: new Date()
      })
      
      return { success: true }
    })

    this.app.get('/recommendations/config', async () => {
      return { config: 'Configuration endpoint - to be implemented' }
    })

    this.app.put('/recommendations/config', async ({ body }) => {
      await this.recommendationEngine.updateConfig(body as Partial<RecommendationConfig>)
      return { success: true }
    })

    // Monitoring & Observability Endpoints
    this.app.get('/metrics', async () => {
      const metrics = await this.metricsService.getMetrics()
      if (!metrics) {
        return new Response('Metrics not available', { status: 503 })
      }
      return metrics
    })

    this.app.get('/health/detailed', async () => {
      return await this.metricsService.getHealthStatus()
    })

    this.app.get('/status', async () => {
      const metrics = await this.metricsService.getMetrics()
      const healthStatus = await this.metricsService.getHealthStatus()
      
      return {
        status: healthStatus.status,
        uptime: metrics?.uptime || 0,
        timestamp: new Date().toISOString(),
        version: process.env.npm_package_version || '1.0.0',
        environment: process.env.NODE_ENV || 'development',
        services: {
          database: healthStatus.checks.find(c => c.name === 'Database Connection')?.status || 'unknown',
          sources: healthStatus.checks.find(c => c.name === 'Source Health')?.status || 'unknown',
          metrics: 'pass'
        }
      }
    })

    this.app.put('/alerts/config', async ({ body }) => {
      await this.metricsService.updateAlertConfig(body as AlertConfig)
      return { success: true }
    })

    this.app.get('/logs', async ({ query }) => {
      const { level = 'info', limit = '100', offset = '0' } = query as {
        level?: string
        limit?: string
        offset?: string
      }
      
      // This would need to be implemented with a proper log aggregation system
      // For now, return a placeholder
      return {
        logs: [],
        message: 'Log aggregation not implemented yet',
        params: { level, limit, offset }
      }
    })

    logger.info('Admin API server initialized')
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('Admin API server is already running')
      return
    }

    this.isRunning = true
    const port = process.env.ADMIN_PORT ? Number(process.env.ADMIN_PORT) : 4000
    this.server = await this.app.listen({ port })
    logger.info(`Admin API server listening on ${port}`)
  }

  async stop(): Promise<void> {
    if (!this.isRunning) {
      logger.warn('Admin API server is not running')
      return
    }

    this.isRunning = false
    await this.metricsService.stop()
    await (this.server as Elysia)?.stop()
    logger.info('Admin API server stopped')
  }

  // TODO: Implement API endpoints
  // POST /admin/sources - Create new source
  // GET /admin/sources - List all sources
  // GET /admin/sources/:id - Get source by ID
  // PUT /admin/sources/:id - Update source
  // DELETE /admin/sources/:id - Delete source
  // POST /admin/sources/bulk - Bulk operations
  // GET /admin/health - System health status
  // GET /admin/status - System status
  // GET /admin/metrics - System metrics

  getStatus(): { running: boolean } {
    return { running: this.isRunning }
  }
  handle(req: Request) {
    return this.app.handle(req)
  }
}
