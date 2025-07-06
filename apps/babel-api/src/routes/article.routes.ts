import { Elysia, t } from 'elysia'
import { ArticleService } from '../services/article.service.js'

const articleService = new ArticleService()

// Validation schemas
const getArticlesSchema = t.Object({
  limit: t.Optional(t.Numeric({ minimum: 1, maximum: 100 })),
  offset: t.Optional(t.Numeric({ minimum: 0 })),
  language: t.Optional(t.String({ minLength: 2, maxLength: 2 })),
  search: t.Optional(t.String())
})

const createArticleSchema = t.Object({
  title: t.String({ minLength: 1, maxLength: 500 }),
  summary: t.Optional(t.String()),
  url: t.String({ format: 'uri' }),
  source: t.String({ minLength: 1, maxLength: 100 }),
  language: t.String({ minLength: 2, maxLength: 2, default: 'en' }),
  publishedAt: t.Optional(t.String({ format: 'date-time' }))
})

const updateArticleSchema = t.Object({
  title: t.Optional(t.String({ minLength: 1, maxLength: 500 })),
  summary: t.Optional(t.String()),
  url: t.Optional(t.String({ format: 'uri' })),
  source: t.Optional(t.String({ minLength: 1, maxLength: 100 })),
  language: t.Optional(t.String({ minLength: 2, maxLength: 2 })),
  publishedAt: t.Optional(t.String({ format: 'date-time' }))
})

const articleParamsSchema = t.Object({
  id: t.String({ format: 'uuid' })
})

export const articleRoutes = new Elysia({ prefix: "/api/articles" })
  /**
   * GET /api/articles
   * Get articles with optional filtering and pagination
   */
  .get("/", async ({ query, set }) => {
    try {
      const { limit, offset, language, search } = query
      
      let result
      if (search) {
        result = await articleService.searchArticles(search, {
          limit: limit ? Number(limit) : undefined,
          offset: offset ? Number(offset) : undefined,
          language: language
        })
      } else {
        result = await articleService.getArticles({
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
  }, {
    query: getArticlesSchema,
    detail: {
      summary: "Get articles with optional filtering and pagination",
      description: "Retrieve articles with support for pagination, language filtering, and search",
      tags: ["Articles"]
    }
  })

  /**
   * GET /api/articles/:id
   * Get a specific article by ID
   */
  .get("/:id", async ({ params, set }) => {
    try {
      const { id } = params
      const article = await articleService.getArticleById(id)

      if (!article) {
        set.status = 404
        return {
          success: false,
          error: 'Article not found'
        }
      }

      return {
        success: true,
        data: article
      }
    } catch (error) {
      console.error('GET /articles/:id error:', error)
      set.status = 500
      return {
        success: false,
        error: 'Failed to fetch article'
      }
    }
  }, {
    params: articleParamsSchema,
    detail: {
      summary: "Get a specific article by ID",
      description: "Retrieve a single article using its unique identifier",
      tags: ["Articles"]
    }
  })

  /**
   * POST /api/articles
   * Create a new article
   */
  .post("/", async ({ body, set }) => {
    try {
      const articleData = body
      
      // Convert publishedAt string to Date if provided
      const processedData = {
        ...articleData,
        publishedAt: articleData.publishedAt ? new Date(articleData.publishedAt) : undefined
      }

      const article = await articleService.createArticle(processedData)

      set.status = 201
      return {
        success: true,
        data: article
      }
    } catch (error) {
      console.error('POST /articles error:', error)
      
      // Handle unique constraint violations
      if (error instanceof Error && error.message.includes('unique')) {
        set.status = 409
        return {
          success: false,
          error: 'Article with this URL already exists'
        }
      }

      set.status = 500
      return {
        success: false,
        error: 'Failed to create article'
      }
    }
  }, {
    body: createArticleSchema,
    detail: {
      summary: "Create a new article",
      description: "Add a new article to the database",
      tags: ["Articles"]
    }
  })

  /**
   * PUT /api/articles/:id
   * Update an existing article
   */
  .put("/:id", async ({ params, body, set }) => {
    try {
      const { id } = params
      const updates = body

      // Convert publishedAt string to Date if provided
      const processedUpdates = {
        ...updates,
        publishedAt: updates.publishedAt ? new Date(updates.publishedAt) : undefined
      }

      const article = await articleService.updateArticle(id, processedUpdates)

      if (!article) {
        set.status = 404
        return {
          success: false,
          error: 'Article not found'
        }
      }

      return {
        success: true,
        data: article
      }
    } catch (error) {
      console.error('PUT /articles/:id error:', error)
      set.status = 500
      return {
        success: false,
        error: 'Failed to update article'
      }
    }
  }, {
    params: articleParamsSchema,
    body: updateArticleSchema,
    detail: {
      summary: "Update an existing article",
      description: "Modify an existing article's properties",
      tags: ["Articles"]
    }
  })

  /**
   * DELETE /api/articles/:id
   * Delete an article
   */
  .delete("/:id", async ({ params, set }) => {
    try {
      const { id } = params
      const deleted = await articleService.deleteArticle(id)

      if (!deleted) {
        set.status = 404
        return {
          success: false,
          error: 'Article not found'
        }
      }

      return {
        success: true,
        message: 'Article deleted successfully'
      }
    } catch (error) {
      console.error('DELETE /articles/:id error:', error)
      set.status = 500
      return {
        success: false,
        error: 'Failed to delete article'
      }
    }
  }, {
    params: articleParamsSchema,
    detail: {
      summary: "Delete an article",
      description: "Remove an article from the database",
      tags: ["Articles"]
    }
  })