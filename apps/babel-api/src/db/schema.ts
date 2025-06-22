import { pgTable, uuid, varchar, boolean, timestamp, jsonb, text, integer } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

/**
 * Users table - stores both guest and verified users
 */
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: varchar('email', { length: 255 }).unique(),
  guestId: varchar('guest_id', { length: 100 }).unique(),
  emailVerified: boolean('email_verified').default(false),
  verificationToken: varchar('verification_token', { length: 255 }),
  verificationTokenExpiry: timestamp('verification_token_expiry'),
  deviceFingerprint: varchar('device_fingerprint', { length: 255 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
});

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
});

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
});

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
});

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
});

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
});

/**
 * Articles table - stores news articles and content
 */
export const articles = pgTable('articles', {
  id: uuid('id').primaryKey().defaultRandom(),
  title: text('title').notNull(),
  summary: text('summary'),
  url: varchar('url', { length: 500 }).unique().notNull(),
  source: varchar('source', { length: 100 }).notNull(),
  language: varchar('language', { length: 10 }).default('en').notNull(),
  publishedAt: timestamp('published_at').defaultNow().notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
});

// Define relationships for better query performance and type safety
export const usersRelations = relations(users, ({ many, one }) => ({
  sessions: many(userSessions),
  preferences: one(userPreferences),
  activities: many(userActivity)
}));

export const userSessionsRelations = relations(userSessions, ({ one, many }) => ({
  user: one(users, {
    fields: [userSessions.userId],
    references: [users.id]
  }),
  activities: many(userActivity)
}));

export const userPreferencesRelations = relations(userPreferences, ({ one }) => ({
  user: one(users, {
    fields: [userPreferences.userId],
    references: [users.id]
  })
}));

export const contentCacheRelations = relations(contentCache, ({ many }) => ({
  activities: many(userActivity)
}));

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
}));

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