import { Elysia, t } from 'elysia'
import { logger } from '../modules/common/logger'
import { NewsSourceManager } from '../services/news-source-manager'
import { HealthChecker } from '../services/health-checker'

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
    })
}

export class AdminAPIServer {
  private isRunning = false
  private app = new Elysia({ prefix: '/admin' })
  private server?: any
  private sourceManager = new NewsSourceManager()
  private healthChecker = new HealthChecker(this.sourceManager)

  async initialize(): Promise<void> {
    await this.sourceManager.initialize()
    this.app.use(adminAuth())

    this.app.get('/health', async () => {
      return await this.healthChecker.getHealthStatus()
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
      const data = body as any
      return await this.sourceManager.createSource(data)
    }, { body: t.Object({
      name: t.String(), slug: t.String(), url: t.String(), sourceType: t.String(),
      language: t.String(), category: t.String(), tags: t.Array(t.String()),
      enabled: t.Boolean(), pollingInterval: t.Number(), reliability: t.Number(),
      priority: t.Number(), metadata: t.Optional(t.Object({}, { additionalProperties: true }))
    }) })

    this.app.put('/sources/:id', async ({ params, body }) => {
      return await this.sourceManager.updateSource(params.id, body as any)
    })

    this.app.delete('/sources/:id', async ({ params }) => {
      await this.sourceManager.deleteSource(params.id)
      return { success: true }
    })

    this.app.post('/sources/bulk-enable', async ({ body }) => {
      await this.sourceManager.bulkEnableSources((body as any).ids)
      return { success: true }
    })

    this.app.post('/sources/bulk-disable', async ({ body }) => {
      await this.sourceManager.bulkDisableSources((body as any).ids)
      return { success: true }
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
    await this.server?.stop()
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
