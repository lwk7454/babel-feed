import { Elysia, t } from "elysia"
import { Stream } from "@elysiajs/stream"
import { translationService } from "../services/translation.service.js"
import { 
  TranslationRequest, 
  TranslationError, 
  BatchedTranslationRequest
} from "../types/translation.js"

// Validation schemas
const translationRequestSchema = t.Object({
  content: t.String({ minLength: 1, maxLength: 50000 }),
  fromLanguage: t.String({ minLength: 2, maxLength: 5 }),
  toLanguage: t.String({ minLength: 2, maxLength: 5 }),
  complexity: t.Union([
    t.Literal("simple"),
    t.Literal("contextual"), 
    t.Literal("creative"),
    t.Literal("technical")
  ]),
  contentType: t.Union([
    t.Literal("template_element"),
    t.Literal("article_content"),
    t.Literal("mixed_content"),
    t.Literal("media_captions"),
    t.Literal("interactive_element"),
    t.Literal("raw_text")
  ]),
  priority: t.Union([
    t.Literal("urgent"),
    t.Literal("high"),
    t.Literal("normal"),
    t.Literal("low"),
    t.Literal("background")
  ]),
  context: t.Optional(t.Object({
    sourceUrl: t.Optional(t.String()),
    pageTitle: t.Optional(t.String()),
    articleTopic: t.Optional(t.String()),
    culturalContext: t.Optional(t.String()),
    domainSpecific: t.Optional(t.String())
  })),
  streaming: t.Boolean(),
  requestId: t.String({ minLength: 1 })
})

// Validation schema for batched translation requests
const batchedTranslationRequestSchema = t.Object({
  batchId: t.String({ minLength: 1 }),
  elements: t.Array(t.Object({
    id: t.String({ minLength: 1 }),
    locator: t.String({ minLength: 1 }),
    text: t.String({ minLength: 1, maxLength: 10000 }),
    context: t.Optional(t.Object({
      beforeText: t.Optional(t.String()),
      afterText: t.Optional(t.String()),
      parentText: t.Optional(t.String()),
      semanticRole: t.Optional(t.String())
    }))
  }), { minItems: 1, maxItems: 50 }),
  fromLanguage: t.String({ minLength: 2, maxLength: 5 }),
  toLanguage: t.String({ minLength: 2, maxLength: 5 }),
  complexity: t.Union([
    t.Literal("simple"),
    t.Literal("contextual"), 
    t.Literal("creative"),
    t.Literal("technical")
  ]),
  contentType: t.Union([
    t.Literal("template_element"),
    t.Literal("article_content"),
    t.Literal("mixed_content"),
    t.Literal("media_captions"),
    t.Literal("interactive_element"),
    t.Literal("raw_text")
  ]),
  priority: t.Union([
    t.Literal("urgent"),
    t.Literal("high"),
    t.Literal("normal"),
    t.Literal("low"),
    t.Literal("background")
  ]),
  context: t.Optional(t.Object({
    sourceUrl: t.Optional(t.String()),
    pageTitle: t.Optional(t.String()),
    articleTopic: t.Optional(t.String()),
    culturalContext: t.Optional(t.String()),
    domainSpecific: t.Optional(t.String())
  })),
  requestId: t.String({ minLength: 1 })
})

export const translationRoutes = new Elysia({ prefix: "/api/translation" })
  // Health check endpoint
  .get("/health", async () => {
    const isAvailable = await translationService.isAvailable()
    return {
      status: isAvailable ? "healthy" : "unhealthy",
      timestamp: new Date().toISOString(),
      service: "translation",
      version: "1.0.0"
    }
  })

  /**
   * Stream translation endpoint
   */
  .post("/stream", 
    async ({ body, set }) => {
      const request = body as TranslationRequest
      
      try {
        // Set headers for streaming
        set.headers["Content-Type"] = "text/event-stream"
        set.headers["Cache-Control"] = "no-cache"
        set.headers["Connection"] = "keep-alive"
        set.headers["Access-Control-Allow-Origin"] = "*"
        set.headers["Access-Control-Allow-Headers"] = "Cache-Control"
        
        // Create readable stream
        const stream = new ReadableStream({
          async start(controller) {
            try {
              for await (const result of translationService.streamTranslation(request)) {
                const data = `data: ${JSON.stringify(result)}\n\n`
                controller.enqueue(new TextEncoder().encode(data))
              }
              controller.close()
            } catch (error) {
              console.error("Streaming translation error:", error)
              const errorData = `data: ${JSON.stringify({
                error: {
                  code: "TRANSLATION_ERROR",
                  message: error instanceof Error ? error.message : "Translation failed"
                }
              })}\n\n`
              controller.enqueue(new TextEncoder().encode(errorData))
              controller.close()
            }
          }
        })
        
        return stream
      } catch (error) {
        console.error("Translation request error:", error)
        set.status = 500
        return {
          error: {
            code: "TRANSLATION_ERROR",
            message: error instanceof Error ? error.message : "Translation failed"
          }
        }
      }
    },
    {
      body: t.Object({
        content: t.String({ minLength: 1, maxLength: 50000 }),
        fromLanguage: t.String({ minLength: 2, maxLength: 10 }),
        toLanguage: t.String({ minLength: 2, maxLength: 10 }),
        complexity: t.Optional(t.Union([
          t.Literal("simple"),
          t.Literal("contextual"), 
          t.Literal("creative"),
          t.Literal("technical")
        ])),
        contentType: t.Optional(t.Union([
          t.Literal("template_element"),
          t.Literal("article_content"),
          t.Literal("media_captions")
        ])),
        context: t.Optional(t.Object({
          pageTitle: t.Optional(t.String()),
          articleTopic: t.Optional(t.String()),
          culturalContext: t.Optional(t.String()),
          domainSpecific: t.Optional(t.String())
        }))
      }),
      detail: {
        tags: ['Translation'],
        summary: 'Stream translation',
        description: "Performs translation using LLM providers with Server-Sent Events streaming",
        responses: {
          200: {
            description: 'Translation stream',
            content: {
              'text/event-stream': {
                schema: {
                  type: 'string',
                  format: 'event-stream'
                }
              }
            }
          },
          400: {
            description: 'Invalid request',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    error: {
                      type: 'object',
                      properties: {
                        code: { type: 'string' },
                        message: { type: 'string' }
                      }
                    }
                  }
                }
              }
            }
          },
          500: {
            description: 'Translation error',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    error: {
                      type: 'object',
                      properties: {
                        code: { type: 'string' },
                        message: { type: 'string' }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  )

  // Batched NDJSON streaming translation endpoint
  .post("/batch", async ({ body, set }) => {
    const request = body as BatchedTranslationRequest
    
    try {
      // Validate request
      if (!request.elements || request.elements.length === 0) {
        set.status = 400
        return {
          requestId: request.requestId || "unknown",
          error: {
            code: "CONTENT_TOO_LARGE",
            message: "Elements array cannot be empty",
            details: null
          },
          timestamp: new Date().toISOString()
        } as TranslationError
      }

      if (request.elements.length > 50) {
        set.status = 413
        return {
          requestId: request.requestId,
          error: {
            code: "CONTENT_TOO_LARGE",
            message: `Too many elements: ${request.elements.length} (max: 50)`,
            details: { elementCount: request.elements.length, maxElements: 50 }
          },
          timestamp: new Date().toISOString()
        } as TranslationError
      }

      // Calculate total content length
      const totalContentLength = request.elements.reduce((sum, el) => sum + el.text.length, 0)
      if (totalContentLength > 100000) {
        set.status = 413
        return {
          requestId: request.requestId,
          error: {
            code: "CONTENT_TOO_LARGE",
            message: `Total content too large: ${totalContentLength} characters (max: 100000)`,
            details: { totalContentLength, maxLength: 100000 }
          },
          timestamp: new Date().toISOString()
        } as TranslationError
      }

      if (request.fromLanguage === request.toLanguage) {
        set.status = 400
        return {
          requestId: request.requestId,
          error: {
            code: "UNSUPPORTED_LANGUAGE",
            message: "Source and target languages cannot be the same",
            details: { fromLanguage: request.fromLanguage, toLanguage: request.toLanguage }
          },
          timestamp: new Date().toISOString()
        } as TranslationError
      }

      // Set appropriate headers for NDJSON streaming
      set.headers = {
        "Content-Type": "application/x-ndjson, text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Allow-Methods": "POST, OPTIONS"
      }

      // Return NDJSON streaming response
      return new Stream(async (stream) => {
        try {
          for await (const ndjsonLine of translationService.streamBatchedTranslation(request)) {
            // Send raw NDJSON line (already includes newline)
            stream.send(ndjsonLine)
          }
          stream.close()
        } catch (error) {
          console.error("Batched streaming error:", error)
          
          // Send error as final NDJSON line
          const errorResult: TranslationError = {
            requestId: request.requestId,
            error: {
              code: "INTERNAL_ERROR",
              message: error instanceof Error ? error.message : "Unknown error occurred",
              details: error instanceof Error ? { name: error.name, stack: error.stack } : null
            },
            timestamp: new Date().toISOString()
          }
          
          stream.send(JSON.stringify(errorResult) + '\n')
          stream.close()
        }
      })

    } catch (error) {
      console.error("Batched translation request error:", error)
      set.status = 500
      
      return {
        requestId: request.requestId || "unknown",
        error: {
          code: "INTERNAL_ERROR",
          message: error instanceof Error ? error.message : "Internal server error",
          details: error instanceof Error ? { name: error.name } : null
        },
        timestamp: new Date().toISOString()
      } as TranslationError
    }
  }, {
    body: batchedTranslationRequestSchema,
    detail: {
      summary: "Stream batched translation with NDJSON results",
      description: "Performs batched translation of multiple elements using a single LLM call with NDJSON streaming output",
      tags: ["Translation"]
    }
  })

  // Non-streaming translation endpoint (fallback)
  .post("/translate", async ({ body, set }) => {
    const request = body as TranslationRequest
    
    try {
      // Validate request (same as streaming endpoint)
      if (!request.content || request.content.trim().length === 0) {
        set.status = 400
        return {
          requestId: request.requestId || "unknown",
          error: {
            code: "CONTENT_TOO_LARGE",
            message: "Content cannot be empty",
            details: null
          },
          timestamp: new Date().toISOString()
        } as TranslationError
      }

      if (request.content.length > 50000) {
        set.status = 413
        return {
          requestId: request.requestId,
          error: {
            code: "CONTENT_TOO_LARGE",
            message: `Content too large: ${request.content.length} characters (max: 50000)`,
            details: { contentLength: request.content.length, maxLength: 50000 }
          },
          timestamp: new Date().toISOString()
        } as TranslationError
      }

      if (request.fromLanguage === request.toLanguage) {
        set.status = 400
        return {
          requestId: request.requestId,
          error: {
            code: "UNSUPPORTED_LANGUAGE",
            message: "Source and target languages cannot be the same",
            details: { fromLanguage: request.fromLanguage, toLanguage: request.toLanguage }
          },
          timestamp: new Date().toISOString()
        } as TranslationError
      }
      
      // Convert streaming to single result
      let finalResult = null
      
      for await (const result of translationService.streamTranslation(request)) {
        finalResult = result
        if (result.isComplete) {
          break
        }
      }
      
      if (!finalResult) {
        set.status = 500
        return {
          requestId: request.requestId,
          error: {
            code: "INTERNAL_ERROR",
            message: "No translation result received",
            details: null
          },
          timestamp: new Date().toISOString()
        } as TranslationError
      }
      
      return finalResult
      
    } catch (error) {
      console.error("Translation error:", error)
      set.status = 500
      
      return {
        requestId: request.requestId,
        error: {
          code: "INTERNAL_ERROR",
          message: error instanceof Error ? error.message : "Translation failed",
          details: null
        },
        timestamp: new Date().toISOString()
      } as TranslationError
    }
  }, {
    body: translationRequestSchema,
    detail: {
      summary: "Translate content (non-streaming)",
      description: "Performs translation and returns the final result",
      tags: ["Translation"]
    }
  })

  // Get supported languages
  .get("/languages", () => {
    return {
      languages: [
        { code: "en", name: "English" },
        { code: "zh-CN", name: "Chinese (Simplified)" },
        { code: "zh-TW", name: "Chinese (Traditional)" },
        { code: "ja", name: "Japanese" },
        { code: "ko", name: "Korean" },
        { code: "fr", name: "French" },
        { code: "de", name: "German" },
        { code: "es", name: "Spanish" },
        { code: "pt", name: "Portuguese" },
        { code: "ru", name: "Russian" },
        { code: "ar", name: "Arabic" },
        { code: "hi", name: "Hindi" }
      ],
      supportedPairs: "All combinations except same-language pairs",
      timestamp: new Date().toISOString()
    }
  }, {
    detail: {
      summary: "Get supported languages",
      description: "Returns list of supported source and target languages",
      tags: ["Translation"]
    }
  })

  // Get available models by complexity
  .get("/models", () => {
    return {
      models: {
        simple: ["WizardLM-2-7B", "Qwen2-7B-Instruct"],
        contextual: ["LLaMA-3.1-8B-Instruct", "Mistral-7B-Instruct"],
        creative: ["Claude-3-Haiku", "GPT-4o-mini", "LLaMA-3.1-70B"],
        technical: ["CodeLLaMA-34B-Instruct", "Deepseek-Coder-33B"]
      },
      defaultSelection: "automatic_based_on_complexity",
      timestamp: new Date().toISOString()
    }
  }, {
    detail: {
      summary: "Get available models",
      description: "Returns available models organized by complexity level",
      tags: ["Translation"]
    }
  })