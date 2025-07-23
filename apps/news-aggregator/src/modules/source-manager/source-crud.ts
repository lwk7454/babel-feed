import { logger } from '@babel-feed/utils'
import { getDatabase, newsSources, type NewsSource as DbNewsSource, type NewNewsSource } from '@babel-feed/pgdb'
import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm'
import { NewsSource, AggregatorError, ValidationError } from '../common/types'

export interface SourceQueryOptions {
  language?: string
  category?: string
  enabled?: boolean
  sourceType?: string
  limit?: number
  offset?: number
  sortBy?: 'name' | 'priority' | 'reliability' | 'createdAt' | 'updatedAt'
  sortOrder?: 'asc' | 'desc'
  search?: string
}

export interface BulkSourceOperation {
  ids: string[]
  updates: Partial<Omit<NewsSource, 'id' | 'createdAt' | 'updatedAt'>>
}

export class SourceCRUDService {
  private db = getDatabase()

  async initialize(): Promise<void> {
    logger.info('Source CRUD service initialized with database operations')
  }

  async createSource(sourceData: Omit<NewsSource, 'id' | 'createdAt' | 'updatedAt' | 'errorCount' | 'successCount'>): Promise<NewsSource> {
    try {
      this.validateSourceData(sourceData)

      // Check for duplicate slug
      const existingSlugSources = await this.db!
        .select({ id: newsSources.id })
        .from(newsSources)
        .where(eq(newsSources.slug, sourceData.slug))

      if (existingSlugSources.length > 0) {
        throw new ValidationError(`Source with slug '${sourceData.slug}' already exists`, 'slug')
      }

      // Check for duplicate URL
      const existingUrlSources = await this.db!
        .select({ id: newsSources.id })
        .from(newsSources)
        .where(eq(newsSources.url, sourceData.url))

      if (existingUrlSources.length > 0) {
        throw new ValidationError(`Source with URL '${sourceData.url}' already exists`, 'url')
      }

      const newSource: NewNewsSource = {
        name: sourceData.name,
        slug: sourceData.slug,
        url: sourceData.url,
        sourceType: sourceData.sourceType as 'rss' | 'api' | 'scraper',
        language: sourceData.language,
        category: sourceData.category,
        tags: sourceData.tags,
        enabled: sourceData.enabled,
        pollingInterval: sourceData.pollingInterval,
        reliability: sourceData.reliability,
        priority: sourceData.priority,
        metadata: sourceData.metadata,
        lastFetched: sourceData.lastFetched,
        lastSuccess: sourceData.lastSuccess,
        lastError: sourceData.lastError,
      }

      const [created] = await this.db!
        .insert(newsSources)
        .values(newSource)
        .returning()

      logger.info(`Created source: ${created.name} (${created.id})`)
      return this.mapDbSourceToNewsSource(created)
    } catch (error) {
      logger.error('Failed to create source:', error)
      if (error instanceof ValidationError) {
        throw error
      }
      throw new AggregatorError('Failed to create source in database', 'DATABASE_ERROR')
    }
  }

  async updateSource(id: string, sourceData: Partial<Omit<NewsSource, 'id' | 'createdAt'>>): Promise<NewsSource> {
    try {
      // Basic UUID validation
      if (!this.isValidUuid(id)) {
        throw new AggregatorError(`Source with id ${id} not found`, 'NOT_FOUND', 404)
      }

      // Validate partial update data
      if (sourceData.slug || sourceData.name || sourceData.url) {
        this.validateSourceData(sourceData as Partial<NewsSource>)
      }

      // Check if slug conflicts with other sources
      if (sourceData.slug) {
        const conflictingSlugSources = await this.db!
          .select({ id: newsSources.id })
          .from(newsSources)
          .where(
            and(
              sql`${newsSources.id} != ${id}`,
              eq(newsSources.slug, sourceData.slug)
            )
          )

        if (conflictingSlugSources.length > 0) {
          throw new ValidationError('Source with this slug already exists', 'slug')
        }
      }

      // Check if URL conflicts with other sources
      if (sourceData.url) {
        const conflictingUrlSources = await this.db!
          .select({ id: newsSources.id })
          .from(newsSources)
          .where(
            and(
              sql`${newsSources.id} != ${id}`,
              eq(newsSources.url, sourceData.url)
            )
          )

        if (conflictingUrlSources.length > 0) {
          throw new ValidationError('Source with this URL already exists', 'url')
        }
      }

      // Prepare update data
      const updateData: Partial<NewNewsSource> & { updatedAt: Date } = {
        updatedAt: new Date()
      }

      if (sourceData.name !== undefined) updateData.name = sourceData.name
      if (sourceData.slug !== undefined) updateData.slug = sourceData.slug
      if (sourceData.url !== undefined) updateData.url = sourceData.url
      if (sourceData.sourceType !== undefined) updateData.sourceType = sourceData.sourceType as 'rss' | 'api' | 'scraper'
      if (sourceData.language !== undefined) updateData.language = sourceData.language
      if (sourceData.category !== undefined) updateData.category = sourceData.category
      if (sourceData.tags !== undefined) updateData.tags = sourceData.tags
      if (sourceData.enabled !== undefined) updateData.enabled = sourceData.enabled
      if (sourceData.pollingInterval !== undefined) updateData.pollingInterval = sourceData.pollingInterval
      if (sourceData.reliability !== undefined) updateData.reliability = sourceData.reliability
      if (sourceData.priority !== undefined) updateData.priority = sourceData.priority
      if (sourceData.metadata !== undefined) updateData.metadata = sourceData.metadata
      if (sourceData.lastFetched !== undefined) updateData.lastFetched = sourceData.lastFetched
      if (sourceData.lastSuccess !== undefined) updateData.lastSuccess = sourceData.lastSuccess
      if (sourceData.lastError !== undefined) updateData.lastError = sourceData.lastError
      if (sourceData.errorCount !== undefined) updateData.errorCount = sourceData.errorCount
      if (sourceData.successCount !== undefined) updateData.successCount = sourceData.successCount

      const [updated] = await this.db!
        .update(newsSources)
        .set(updateData)
        .where(eq(newsSources.id, id))
        .returning()

      if (!updated) {
        throw new AggregatorError(`Source with id ${id} not found`, 'NOT_FOUND', 404)
      }

      logger.info(`Updated source: ${updated.name} (${id})`)
      return this.mapDbSourceToNewsSource(updated)
    } catch (error) {
      logger.error(`Failed to update source ${id}:`, error)
      if (error instanceof AggregatorError || error instanceof ValidationError) {
        throw error
      }
      throw new AggregatorError('Failed to update source in database', 'DATABASE_ERROR')
    }
  }

  async deleteSource(id: string): Promise<void> {
    try {
      // Basic UUID validation
      if (!this.isValidUuid(id)) {
        throw new AggregatorError(`Source with id ${id} not found`, 'NOT_FOUND', 404)
      }

      const deleted = await this.db!
        .delete(newsSources)
        .where(eq(newsSources.id, id))
        .returning()

      if (deleted.length === 0) {
        throw new AggregatorError(`Source with id ${id} not found`, 'NOT_FOUND', 404)
      }

      logger.info(`Deleted source: ${deleted[0].name} (${id})`)
    } catch (error) {
      logger.error(`Failed to delete source ${id}:`, error)
      if (error instanceof AggregatorError) {
        throw error
      }
      throw new AggregatorError('Failed to delete source from database', 'DATABASE_ERROR')
    }
  }

  async getAllSources(): Promise<NewsSource[]> {
    try {
      const sources = await this.db!
        .select()
        .from(newsSources)
        .orderBy(desc(newsSources.priority), asc(newsSources.name))

      return sources.map(this.mapDbSourceToNewsSource)
    } catch (error) {
      logger.error('Failed to fetch all sources:', error)
      throw new AggregatorError('Failed to fetch sources from database', 'DATABASE_ERROR')
    }
  }

  async getSourceById(id: string): Promise<NewsSource | null> {
    try {
      // Basic UUID validation to avoid PostgreSQL errors
      if (!this.isValidUuid(id)) {
        return null
      }

      const sources = await this.db!
        .select()
        .from(newsSources)
        .where(eq(newsSources.id, id))
        .limit(1)

      return sources.length > 0 ? this.mapDbSourceToNewsSource(sources[0]) : null
    } catch (error) {
      logger.error(`Failed to fetch source ${id}:`, error)
      throw new AggregatorError('Failed to fetch source from database', 'DATABASE_ERROR')
    }
  }

  async getSourceBySlug(slug: string): Promise<NewsSource | null> {
    try {
      const sources = await this.db!
        .select()
        .from(newsSources)
        .where(eq(newsSources.slug, slug))
        .limit(1)

      return sources.length > 0 ? this.mapDbSourceToNewsSource(sources[0]) : null
    } catch (error) {
      logger.error(`Failed to fetch source by slug ${slug}:`, error)
      throw new AggregatorError('Failed to fetch source from database', 'DATABASE_ERROR')
    }
  }

  async querySources(options: SourceQueryOptions = {}): Promise<{ sources: NewsSource[]; total: number }> {
    try {
      const {
        language,
        category,
        enabled,
        sourceType,
        limit = 50,
        offset = 0,
        sortBy = 'priority',
        sortOrder = 'desc',
        search
      } = options

      // Build where conditions
      const whereConditions = []
      if (language) whereConditions.push(eq(newsSources.language, language))
      if (category) whereConditions.push(eq(newsSources.category, category))
      if (enabled !== undefined) whereConditions.push(eq(newsSources.enabled, enabled))
      if (sourceType) whereConditions.push(eq(newsSources.sourceType, sourceType))
      if (search) {
        whereConditions.push(
          sql`(${newsSources.name} ILIKE ${'%' + search + '%'} OR ${newsSources.url} ILIKE ${'%' + search + '%'})`
        )
      }

      const whereClause = whereConditions.length > 0 ? and(...whereConditions) : undefined

      // Build order by
      const sortColumns = {
        name: newsSources.name,
        priority: newsSources.priority,
        reliability: newsSources.reliability,
        createdAt: newsSources.createdAt,
        updatedAt: newsSources.updatedAt
      }
      const sortColumn = sortColumns[sortBy as keyof typeof sortColumns] || newsSources.priority
      const orderBy = sortOrder === 'desc' ? desc(sortColumn) : asc(sortColumn)

      // Get total count
      const [{ count: total }] = await this.db!
        .select({ count: sql<number>`count(*)` })
        .from(newsSources)
        .where(whereClause)

      // Get paginated results
      const sources = await this.db!
        .select()
        .from(newsSources)
        .where(whereClause)
        .orderBy(orderBy)
        .limit(limit)
        .offset(offset)

      return {
        sources: sources.map(this.mapDbSourceToNewsSource),
        total
      }
    } catch (error) {
      logger.error('Failed to query sources:', error)
      throw new AggregatorError('Failed to query sources from database', 'DATABASE_ERROR')
    }
  }

  async getSourcesByLanguage(language: string): Promise<NewsSource[]> {
    const { sources } = await this.querySources({ language, enabled: true })
    return sources
  }

  async getSourcesByCategory(category: string): Promise<NewsSource[]> {
    const { sources } = await this.querySources({ category, enabled: true })
    return sources
  }

  async getEnabledSources(): Promise<NewsSource[]> {
    const { sources } = await this.querySources({ enabled: true })
    return sources
  }

  async bulkUpdateSources(operation: BulkSourceOperation): Promise<number> {
    try {
      if (operation.ids.length === 0) {
        return 0
      }

      const updateData: Partial<NewNewsSource> & { updatedAt: Date } = {
        updatedAt: new Date(),
        ...operation.updates
      }

      await this.db!
        .update(newsSources)
        .set(updateData)
        .where(inArray(newsSources.id, operation.ids))

      logger.info(`Bulk updated ${operation.ids.length} sources`)
      return operation.ids.length
    } catch (error) {
      logger.error('Failed to bulk update sources:', error)
      throw new AggregatorError('Failed to bulk update sources', 'DATABASE_ERROR')
    }
  }

  async bulkDeleteSources(ids: string[]): Promise<number> {
    try {
      if (ids.length === 0) {
        return 0
      }

      const deleted = await this.db!
        .delete(newsSources)
        .where(inArray(newsSources.id, ids))
        .returning()

      logger.info(`Bulk deleted ${deleted.length} sources`)
      return deleted.length
    } catch (error) {
      logger.error('Failed to bulk delete sources:', error)
      throw new AggregatorError('Failed to bulk delete sources', 'DATABASE_ERROR')
    }
  }

  async getSourceStats(): Promise<{
    total: number
    enabled: number
    disabled: number
    byLanguage: Record<string, number>
    byCategory: Record<string, number>
    bySourceType: Record<string, number>
  }> {
    try {
      const [totalResult] = await this.db!
        .select({ count: sql<number>`count(*)` })
        .from(newsSources)

      const [enabledResult] = await this.db!
        .select({ count: sql<number>`count(*)` })
        .from(newsSources)
        .where(eq(newsSources.enabled, true))

      const byLanguage = await this.db!
        .select({
          language: newsSources.language,
          count: sql<number>`count(*)`
        })
        .from(newsSources)
        .groupBy(newsSources.language)

      const byCategory = await this.db!
        .select({
          category: newsSources.category,
          count: sql<number>`count(*)`
        })
        .from(newsSources)
        .groupBy(newsSources.category)

      const bySourceType = await this.db!
        .select({
          sourceType: newsSources.sourceType,
          count: sql<number>`count(*)`
        })
        .from(newsSources)
        .groupBy(newsSources.sourceType)

      return {
        total: totalResult.count,
        enabled: enabledResult.count,
        disabled: totalResult.count - enabledResult.count,
        byLanguage: Object.fromEntries(byLanguage.map(r => [r.language, r.count])),
        byCategory: Object.fromEntries(byCategory.map(r => [r.category, r.count])),
        bySourceType: Object.fromEntries(bySourceType.map(r => [r.sourceType, r.count]))
      }
    } catch (error) {
      logger.error('Failed to get source stats:', error)
      throw new AggregatorError('Failed to get source statistics', 'DATABASE_ERROR')
    }
  }

  private validateSourceData(data: Partial<NewsSource>): void {
    if (data.slug && !/^[a-z0-9-]+$/.test(data.slug)) {
      throw new ValidationError('Slug must contain only lowercase letters, numbers, and hyphens', 'slug')
    }

    if (data.url && !this.isValidUrl(data.url)) {
      throw new ValidationError('Invalid URL format', 'url')
    }

    if (data.sourceType && !['rss', 'api', 'scraper', 'json', 'html'].includes(data.sourceType)) {
      throw new ValidationError('Source type must be rss, api, scraper, json, or html', 'sourceType')
    }

    if (data.priority !== undefined && (data.priority < 1 || data.priority > 10)) {
      throw new ValidationError('Priority must be between 1 and 10', 'priority')
    }

    if (data.reliability !== undefined && (data.reliability < 0 || data.reliability > 100)) {
      throw new ValidationError('Reliability must be between 0 and 100', 'reliability')
    }

    if (data.pollingInterval && data.pollingInterval < 60000) {
      throw new ValidationError('Polling interval must be at least 60 seconds (60000ms)', 'pollingInterval')
    }

    if (data.name && data.name.trim().length === 0) {
      throw new ValidationError('Source name cannot be empty', 'name')
    }

    if (data.language && !/^[a-z]{2}(-[A-Z]{2})?$/.test(data.language)) {
      throw new ValidationError('Language must be in format "en" or "zh-CN"', 'language')
    }
  }

  private isValidUrl(url: string): boolean {
    try {
      const urlObj = new URL(url)
      return ['http:', 'https:'].includes(urlObj.protocol)
    } catch {
      return false
    }
  }

  private isValidUuid(uuid: string): boolean {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    return uuidRegex.test(uuid)
  }

  private mapDbSourceToNewsSource(dbSource: DbNewsSource): NewsSource {
    return {
      id: dbSource.id,
      name: dbSource.name,
      slug: dbSource.slug,
      url: dbSource.url,
      sourceType: dbSource.sourceType as 'rss' | 'json' | 'html' | 'api' | 'scraper',
      language: dbSource.language,
      category: dbSource.category,
      tags: Array.isArray(dbSource.tags) ? dbSource.tags as string[] : [],
      enabled: dbSource.enabled,
      pollingInterval: dbSource.pollingInterval,
      reliability: dbSource.reliability,
      priority: dbSource.priority,
      metadata: (dbSource.metadata as Record<string, unknown>) || {},
      lastFetched: dbSource.lastFetched || undefined,
      lastSuccess: dbSource.lastSuccess || undefined,
      lastError: dbSource.lastError || undefined,
      errorCount: dbSource.errorCount,
      successCount: dbSource.successCount,
      createdAt: dbSource.createdAt,
      updatedAt: dbSource.updatedAt,
    }
  }

  // Legacy compatibility method - will be removed after full migration
  getSourceManager(): null {
    logger.warn('Using deprecated getSourceManager - migrate to CRUD methods')
    return null
  }
}