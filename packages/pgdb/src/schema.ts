import { pgTable, uuid, varchar, boolean, timestamp, jsonb, text, integer, index, uniqueIndex } from 'drizzle-orm/pg-core'
import { relations, sql } from 'drizzle-orm'

/**
 * Users table - stores both guest and verified users
 */
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: varchar('email', { length: 255 }).unique(),
  guestId: varchar('guest_id', { length: 100 }).unique(),
  emailVerified: boolean('email_verified').default(false),
  userStatus: varchar('user_status', { length: 20 }).default('guest').notNull(), // guest, verified, vip
  verificationToken: varchar('verification_token', { length: 255 }),
  verificationTokenExpiry: timestamp('verification_token_expiry'),
  deviceFingerprint: varchar('device_fingerprint', { length: 255 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
})

/**
 * User sessions table - manages JWT tokens and session persistence
 */
export const userSessions = pgTable('user_sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  accessTokenHash: varchar('access_token_hash', { length: 255 }),
  refreshTokenHash: varchar('refresh_token_hash', { length: 255 }).notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  deviceInfo: jsonb('device_info'), // Store device information for security
  ipAddress: varchar('ip_address', { length: 45 }), // IPv4 or IPv6
  userAgent: text('user_agent'),
  lastAccessedAt: timestamp('last_accessed_at').defaultNow(),
  createdAt: timestamp('created_at').defaultNow().notNull()
})

/**
 * User preferences table - stores app settings and customization
 */
export const userPreferences = pgTable('user_preferences', {
  userId: uuid('user_id').primaryKey().references(() => users.id, { onDelete: 'cascade' }),
  preferredLanguages: jsonb('preferred_languages').default('[]'), // Array of language codes
  feedCategories: jsonb('feed_categories').default('[]'), // Array of news categories
  translationSettings: jsonb('translation_settings').default('{}'), // Translation preferences
  themePreference: varchar('theme_preference', { length: 20 }).default('system'), // light, dark, system
  notificationSettings: jsonb('notification_settings').default('{}'),
  privacySettings: jsonb('privacy_settings').default('{}'),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
})

/**
 * Content cache table - cache news articles and video metadata
 * Future-proofing for content aggregation features
 */
export const contentCache = pgTable('content_cache', {
  id: uuid('id').primaryKey().defaultRandom(),
  url: varchar('url', { length: 500 }).unique().notNull(),
  title: text('title'),
  description: text('description'),
  contentType: varchar('content_type', { length: 50 }), // article, video, etc.
  sourceId: varchar('source_id', { length: 100 }), // Publisher identifier
  language: varchar('language', { length: 10 }), // Language code
  publishedAt: timestamp('published_at'),
  contentHash: varchar('content_hash', { length: 64 }), // For change detection
  metadata: jsonb('metadata').default('{}'), // Flexible metadata storage
  cachedAt: timestamp('cached_at').defaultNow().notNull(),
  expiresAt: timestamp('expires_at')
})

/**
 * User activity table - track user interactions for analytics
 * Future-proofing for recommendation system
 */
export const userActivity = pgTable('user_activity', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
  sessionId: uuid('session_id').references(() => userSessions.id, { onDelete: 'cascade' }),
  activityType: varchar('activity_type', { length: 50 }).notNull(), // view, translate, share, etc.
  contentId: uuid('content_id').references(() => contentCache.id, { onDelete: 'set null' }),
  contentUrl: varchar('content_url', { length: 500 }),
  metadata: jsonb('metadata').default('{}'), // Activity-specific data
  duration: integer('duration'), // Time spent (in seconds)
  createdAt: timestamp('created_at').defaultNow().notNull()
})

/**
 * Translation cache table - cache translation results
 * Future-proofing for translation optimization
 */
export const translationCache = pgTable('translation_cache', {
  id: uuid('id').primaryKey().defaultRandom(),
  sourceText: text('source_text').notNull(),
  sourceLanguage: varchar('source_language', { length: 10 }).notNull(),
  targetLanguage: varchar('target_language', { length: 10 }).notNull(),
  translatedText: text('translated_text').notNull(),
  model: varchar('model', { length: 100 }), // Translation model used
  quality: integer('quality'), // Translation quality score (1-100)
  contentHash: varchar('content_hash', { length: 64 }).notNull(), // Hash of source + languages
  usageCount: integer('usage_count').default(0),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
})

/**
 * News sources table - stores RSS feeds and news source configurations
 */
export const newsSources = pgTable('news_sources', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  slug: varchar('slug', { length: 100 }).unique().notNull(), // URL-friendly identifier
  url: varchar('url', { length: 500 }).notNull(),
  sourceType: varchar('source_type', { length: 50 }).notNull(), // rss, api, scraper
  language: varchar('language', { length: 10 }).notNull(),
  category: varchar('category', { length: 100 }).notNull(),
  tags: jsonb('tags').default('[]'), // Array of tags
  enabled: boolean('enabled').default(true).notNull(),
  pollingInterval: integer('polling_interval').default(300000).notNull(), // milliseconds
  reliability: integer('reliability').default(100).notNull(), // 0-100 score
  priority: integer('priority').default(5).notNull(), // 1-10, higher = more important
  metadata: jsonb('metadata').default('{}'), // Flexible metadata storage
  lastFetched: timestamp('last_fetched'),
  lastSuccess: timestamp('last_success'),
  lastError: text('last_error'),
  errorCount: integer('error_count').default(0).notNull(),
  successCount: integer('success_count').default(0).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
}, (table) => ({
  // Indexes for common query patterns
  enabledIndex: index('news_sources_enabled_idx').on(table.enabled),
  languageIndex: index('news_sources_language_idx').on(table.language),
  categoryIndex: index('news_sources_category_idx').on(table.category),
  priorityIndex: index('news_sources_priority_idx').on(table.priority),
  enabledLanguageIndex: index('news_sources_enabled_language_idx').on(table.enabled, table.language),
  enabledCategoryIndex: index('news_sources_enabled_category_idx').on(table.enabled, table.category)
}))

/**
 * Source endpoints table - stores per-source extraction endpoints
 */
export const sourceEndpoints = pgTable('source_endpoints', {
  id: uuid('id').primaryKey().defaultRandom(),
  sourceId: uuid('source_id').references(() => newsSources.id, { onDelete: 'cascade' }).notNull(),
  endpointUrl: varchar('endpoint_url', { length: 500 }).notNull(),
  type: varchar('type', { length: 50 }).notNull(), // 'rss' | 'atom' | 'html'
  category: varchar('category', { length: 100 }),
  linkSelector: text('link_selector'), // CSS selector for HTML endpoints
  pollingInterval: integer('polling_interval').default(3600).notNull(), // seconds
  reliability: integer('reliability').default(100).notNull(), // 0-100 score (convert from 0.0-1.0)
  priority: integer('priority').default(1).notNull(), // 1-10, higher = more important
  metadata: jsonb('metadata').default('{}'), // LLM-produced script/instructions
  successCount: integer('success_count').default(0).notNull(),
  errorCount: integer('error_count').default(0).notNull(),
  consecutiveFailureCount: integer('consecutive_failure_count').default(0).notNull(),
  lastFetchAt: timestamp('last_fetch_at'),
  lastSuccessAt: timestamp('last_success_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
}, (table) => ({
  sourceIndex: index('source_endpoints_source_idx').on(table.sourceId),
  typeIndex: index('source_endpoints_type_idx').on(table.type),
  priorityIndex: index('source_endpoints_priority_idx').on(table.priority),
  reliabilityIndex: index('source_endpoints_reliability_idx').on(table.reliability)
}))

/**
 * AI providers table - stores LLM provider configurations and API keys
 */
export const aiProviders = pgTable('ai_providers', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 100 }).notNull(), // openrouter, huggingface, openai, etc.
  displayName: varchar('display_name', { length: 255 }).notNull(),
  providerType: varchar('provider_type', { length: 50 }).notNull(), // translation, summarization, chat, etc.
  baseUrl: varchar('base_url', { length: 500 }).notNull(),
  enabled: boolean('enabled').default(true).notNull(),
  priority: integer('priority').default(5).notNull(), // 1-10, higher = preferred
  maxRequestsPerMinute: integer('max_requests_per_minute').default(60).notNull(),
  maxRequestsPerHour: integer('max_requests_per_hour').default(1000).notNull(),
  maxRequestsPerDay: integer('max_requests_per_day').default(10000).notNull(),
  circuitBreakerThreshold: integer('circuit_breaker_threshold').default(5).notNull(), // failures to trip
  circuitBreakerTimeout: integer('circuit_breaker_timeout').default(60000).notNull(), // ms
  healthCheckInterval: integer('health_check_interval').default(30000).notNull(), // ms
  metadata: jsonb('metadata').default('{}'), // Provider-specific config
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
}, (table) => ({
  enabledIndex: index('ai_providers_enabled_idx').on(table.enabled),
  typeIndex: index('ai_providers_type_idx').on(table.providerType),
  priorityIndex: index('ai_providers_priority_idx').on(table.priority),
  enabledTypeIndex: index('ai_providers_enabled_type_idx').on(table.enabled, table.providerType)
}))

/**
 * AI provider API keys - stores multiple API keys per provider for rotation
 */
export const aiProviderKeys = pgTable('ai_provider_keys', {
  id: uuid('id').primaryKey().defaultRandom(),
  providerId: uuid('provider_id').references(() => aiProviders.id, { onDelete: 'cascade' }).notNull(),
  keyName: varchar('key_name', { length: 100 }).notNull(), // Human-readable name
  apiKey: text('api_key').notNull(), // Encrypted API key
  enabled: boolean('enabled').default(true).notNull(),
  priority: integer('priority').default(5).notNull(), // 1-10, higher = preferred
  currentUsage: integer('current_usage').default(0).notNull(), // Current period usage
  dailyQuota: integer('daily_quota'), // Daily quota limit (null = unlimited)
  monthlyQuota: integer('monthly_quota'), // Monthly quota limit (null = unlimited)
  lastUsed: timestamp('last_used'),
  lastReset: timestamp('last_reset').defaultNow().notNull(),
  rateLimitHits: integer('rate_limit_hits').default(0).notNull(),
  errorCount: integer('error_count').default(0).notNull(),
  successCount: integer('success_count').default(0).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
}, (table) => ({
  providerIndex: index('ai_provider_keys_provider_idx').on(table.providerId),
  enabledIndex: index('ai_provider_keys_enabled_idx').on(table.enabled),
  priorityIndex: index('ai_provider_keys_priority_idx').on(table.priority),
  providerEnabledIndex: index('ai_provider_keys_provider_enabled_idx').on(table.providerId, table.enabled),
  uniqueProviderKeyName: uniqueIndex('unique_provider_key_name').on(table.providerId, table.keyName)
}))

/**
 * Circuit breaker states - tracks circuit breaker status for AI providers
 */
export const circuitBreakerStates = pgTable('circuit_breaker_states', {
  id: uuid('id').primaryKey().defaultRandom(),
  providerId: uuid('provider_id').references(() => aiProviders.id, { onDelete: 'cascade' }).notNull(),
  keyId: uuid('key_id').references(() => aiProviderKeys.id, { onDelete: 'cascade' }),
  state: varchar('state', { length: 20 }).notNull(), // closed, open, half_open
  failureCount: integer('failure_count').default(0).notNull(),
  lastFailure: timestamp('last_failure'),
  lastSuccess: timestamp('last_success'),
  nextAttempt: timestamp('next_attempt'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
}, (table) => ({
  providerIndex: index('circuit_breaker_provider_idx').on(table.providerId),
  keyIndex: index('circuit_breaker_key_idx').on(table.keyId),
  stateIndex: index('circuit_breaker_state_idx').on(table.state),
  uniqueProviderKey: uniqueIndex('unique_circuit_breaker_provider_key').on(table.providerId, table.keyId)
}))

/**
 * Articles table - stores news articles metadata
 */
export const articles = pgTable('articles', {
  id: uuid('id').primaryKey().defaultRandom(),
  url: varchar('url', { length: 500 }).unique().notNull(),
  sourceId: uuid('source_id').references(() => newsSources.id, { onDelete: 'set null' }), // Reference to news source
  source: varchar('source', { length: 100 }).notNull(), // Legacy field, kept for backward compatibility
  sourceLanguage: varchar('source_language', { length: 10 }).notNull(),
  imageUrl: varchar('image_url', { length: 500 }),
  publishedAt: timestamp('published_at').defaultNow().notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
}, (table) => ({
  sourceIndex: index('articles_source_id_idx').on(table.sourceId),
  publishedIndex: index('articles_published_idx').on(table.publishedAt),
  sourcePublishedIndex: index('articles_source_published_idx').on(table.sourceId, table.publishedAt)
}))

/**
 * Article translations table - stores translated content for search optimization
 */
export const articleTranslations = pgTable('article_translations', {
  id: uuid('id').primaryKey().defaultRandom(),
  articleId: uuid('article_id').references(() => articles.id, { onDelete: 'cascade' }).notNull(),
  language: varchar('language', { length: 10 }).notNull(),
  title: text('title').notNull(),
  summary: text('summary'),
  content: text('content'), // For full article text if needed
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
}, (table) => ({
  // Unique constraint: one translation per article per language
  uniqueArticleLanguage: uniqueIndex('unique_article_language').on(table.articleId, table.language),
  // Index for language-based queries
  languageIndex: index('language_idx').on(table.language),
  // Full-text search indexes for title and summary
  titleTextIndex: index('title_text_idx').using('gin', sql`to_tsvector('simple', ${table.title})`),
  summaryTextIndex: index('summary_text_idx').using('gin', sql`to_tsvector('simple', ${table.summary})`),
  // Combined index for common query patterns
  articleLanguageIndex: index('article_language_idx').on(table.articleId, table.language)
}))

// Define relationships for better query performance and type safety
export const usersRelations = relations(users, ({ many, one }) => ({
  sessions: many(userSessions),
  preferences: one(userPreferences),
  activities: many(userActivity)
}))

export const userSessionsRelations = relations(userSessions, ({ one, many }) => ({
  user: one(users, {
    fields: [userSessions.userId],
    references: [users.id]
  }),
  activities: many(userActivity)
}))

export const userPreferencesRelations = relations(userPreferences, ({ one }) => ({
  user: one(users, {
    fields: [userPreferences.userId],
    references: [users.id]
  })
}))

export const contentCacheRelations = relations(contentCache, ({ many }) => ({
  activities: many(userActivity)
}))

export const userActivityRelations = relations(userActivity, ({ one }) => ({
  user: one(users, {
    fields: [userActivity.userId],
    references: [users.id]
  }),
  session: one(userSessions, {
    fields: [userActivity.sessionId],
    references: [userSessions.id]
  }),
  content: one(contentCache, {
    fields: [userActivity.contentId],
    references: [contentCache.id]
  })
}))

// News Sources Relations
export const newsSourcesRelations = relations(newsSources, ({ many }) => ({
  articles: many(articles),
  endpoints: many(sourceEndpoints)
}))

export const sourceEndpointsRelations = relations(sourceEndpoints, ({ one }) => ({
  source: one(newsSources, {
    fields: [sourceEndpoints.sourceId],
    references: [newsSources.id]
  })
}))

// AI Providers Relations
export const aiProvidersRelations = relations(aiProviders, ({ many }) => ({
  keys: many(aiProviderKeys),
  circuitBreakers: many(circuitBreakerStates)
}))

export const aiProviderKeysRelations = relations(aiProviderKeys, ({ one, many }) => ({
  provider: one(aiProviders, {
    fields: [aiProviderKeys.providerId],
    references: [aiProviders.id]
  }),
  circuitBreakers: many(circuitBreakerStates)
}))

export const circuitBreakerStatesRelations = relations(circuitBreakerStates, ({ one }) => ({
  provider: one(aiProviders, {
    fields: [circuitBreakerStates.providerId],
    references: [aiProviders.id]
  }),
  key: one(aiProviderKeys, {
    fields: [circuitBreakerStates.keyId],
    references: [aiProviderKeys.id]
  })
}))

// Updated Articles Relations
export const articlesRelations = relations(articles, ({ many, one }) => ({
  translations: many(articleTranslations),
  source: one(newsSources, {
    fields: [articles.sourceId],
    references: [newsSources.id]
  })
}))

export const articleTranslationsRelations = relations(articleTranslations, ({ one }) => ({
  article: one(articles, {
    fields: [articleTranslations.articleId],
    references: [articles.id]
  })
}))

/**
 * Job scheduler tables - stores job configurations and execution history
 */
export const jobConfigs = pgTable('job_configs', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 100 }).unique().notNull(),
  interval: integer('interval').notNull(), // milliseconds
  enabled: boolean('enabled').default(true).notNull(),
  maxConcurrency: integer('max_concurrency').default(1),
  retryAttempts: integer('retry_attempts').default(3),
  timeout: integer('timeout').default(60000), // milliseconds
  description: text('description'),
  metadata: jsonb('metadata').default('{}'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
}, (table) => ({
  nameIndex: index('job_configs_name_idx').on(table.name),
  enabledIndex: index('job_configs_enabled_idx').on(table.enabled)
}))

export const jobStatus = pgTable('job_status', {
  id: uuid('id').primaryKey().defaultRandom(),
  jobConfigId: uuid('job_config_id').references(() => jobConfigs.id, { onDelete: 'cascade' }).notNull(),
  running: boolean('running').default(false).notNull(),
  lastRun: timestamp('last_run'),
  lastSuccess: timestamp('last_success'),
  lastError: text('last_error'),
  nextRun: timestamp('next_run'),
  totalRuns: integer('total_runs').default(0).notNull(),
  totalErrors: integer('total_errors').default(0).notNull(),
  consecutiveFailures: integer('consecutive_failures').default(0).notNull(),
  averageProcessingTime: integer('average_processing_time').default(0).notNull(), // milliseconds
  metadata: jsonb('metadata').default('{}'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
}, (table) => ({
  jobConfigIndex: index('job_status_config_idx').on(table.jobConfigId),
  runningIndex: index('job_status_running_idx').on(table.running),
  nextRunIndex: index('job_status_next_run_idx').on(table.nextRun),
  uniqueJobConfig: uniqueIndex('unique_job_status_config').on(table.jobConfigId)
}))

export const jobExecutions = pgTable('job_executions', {
  id: uuid('id').primaryKey().defaultRandom(),
  jobConfigId: uuid('job_config_id').references(() => jobConfigs.id, { onDelete: 'cascade' }).notNull(),
  executionId: varchar('execution_id', { length: 100 }).notNull(), // unique per execution attempt
  status: varchar('status', { length: 20 }).notNull(), // running, success, failed, timeout
  startedAt: timestamp('started_at').notNull(),
  completedAt: timestamp('completed_at'),
  processingTime: integer('processing_time'), // milliseconds
  processed: integer('processed').default(0).notNull(),
  errors: integer('errors').default(0).notNull(),
  skipped: integer('skipped').default(0).notNull(),
  errorMessage: text('error_message'),
  result: jsonb('result').default('{}'), // execution results and metadata
  triggeredBy: varchar('triggered_by', { length: 50 }).default('schedule').notNull(), // schedule, manual, restart
  createdAt: timestamp('created_at').defaultNow().notNull()
}, (table) => ({
  jobConfigIndex: index('job_executions_config_idx').on(table.jobConfigId),
  statusIndex: index('job_executions_status_idx').on(table.status),
  startedAtIndex: index('job_executions_started_idx').on(table.startedAt),
  configStartedIndex: index('job_executions_config_started_idx').on(table.jobConfigId, table.startedAt),
  executionIdIndex: index('job_executions_execution_id_idx').on(table.executionId)
}))

// Job scheduler relations
export const jobConfigsRelations = relations(jobConfigs, ({ one, many }) => ({
  status: one(jobStatus),
  executions: many(jobExecutions)
}))

export const jobStatusRelations = relations(jobStatus, ({ one }) => ({
  jobConfig: one(jobConfigs, {
    fields: [jobStatus.jobConfigId],
    references: [jobConfigs.id]
  })
}))

export const jobExecutionsRelations = relations(jobExecutions, ({ one }) => ({
  jobConfig: one(jobConfigs, {
    fields: [jobExecutions.jobConfigId],
    references: [jobConfigs.id]
  })
}))

// Export types for use in the application
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type UserSession = typeof userSessions.$inferSelect;
export type NewUserSession = typeof userSessions.$inferInsert;
export type UserPreferences = typeof userPreferences.$inferSelect;
export type NewUserPreferences = typeof userPreferences.$inferInsert;
export type ContentCache = typeof contentCache.$inferSelect;
export type NewContentCache = typeof contentCache.$inferInsert;
export type UserActivity = typeof userActivity.$inferSelect;
export type NewUserActivity = typeof userActivity.$inferInsert;
export type TranslationCache = typeof translationCache.$inferSelect;
export type NewTranslationCache = typeof translationCache.$inferInsert;
export type Article = typeof articles.$inferSelect;
export type NewArticle = typeof articles.$inferInsert;
export type ArticleTranslation = typeof articleTranslations.$inferSelect;
export type NewArticleTranslation = typeof articleTranslations.$inferInsert;

// News Sources Types
export type NewsSource = typeof newsSources.$inferSelect;
export type NewNewsSource = typeof newsSources.$inferInsert;
export type SourceEndpoint = typeof sourceEndpoints.$inferSelect;
export type NewSourceEndpoint = typeof sourceEndpoints.$inferInsert;

// AI Providers Types
export type AiProvider = typeof aiProviders.$inferSelect;
export type NewAiProvider = typeof aiProviders.$inferInsert;
export type AiProviderKey = typeof aiProviderKeys.$inferSelect;
export type NewAiProviderKey = typeof aiProviderKeys.$inferInsert;
export type CircuitBreakerState = typeof circuitBreakerStates.$inferSelect;
export type NewCircuitBreakerState = typeof circuitBreakerStates.$inferInsert;

// Job Scheduler Types
export type JobConfig = typeof jobConfigs.$inferSelect;
export type NewJobConfig = typeof jobConfigs.$inferInsert;
export type JobStatus = typeof jobStatus.$inferSelect;
export type NewJobStatus = typeof jobStatus.$inferInsert;
export type JobExecution = typeof jobExecutions.$inferSelect;
export type NewJobExecution = typeof jobExecutions.$inferInsert;
