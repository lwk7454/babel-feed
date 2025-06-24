import { pgTable, uuid, text, varchar, integer, timestamp, unique, boolean, foreignKey, jsonb } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"



export const translationCache = pgTable("translation_cache", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	sourceText: text("source_text").notNull(),
	sourceLanguage: varchar("source_language", { length: 10 }).notNull(),
	targetLanguage: varchar("target_language", { length: 10 }).notNull(),
	translatedText: text("translated_text").notNull(),
	model: varchar({ length: 100 }),
	quality: integer(),
	contentHash: varchar("content_hash", { length: 64 }).notNull(),
	usageCount: integer("usage_count").default(0),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
});

export const users = pgTable("users", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	email: varchar({ length: 255 }),
	guestId: varchar("guest_id", { length: 100 }),
	emailVerified: boolean("email_verified").default(false),
	verificationToken: varchar("verification_token", { length: 255 }),
	verificationTokenExpiry: timestamp("verification_token_expiry", { mode: 'string' }),
	deviceFingerprint: varchar("device_fingerprint", { length: 255 }),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	unique("users_email_unique").on(table.email),
	unique("users_guest_id_unique").on(table.guestId),
]);

export const userActivity = pgTable("user_activity", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id"),
	sessionId: uuid("session_id"),
	activityType: varchar("activity_type", { length: 50 }).notNull(),
	contentId: uuid("content_id"),
	contentUrl: varchar("content_url", { length: 500 }),
	metadata: jsonb().default({}),
	duration: integer(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "user_activity_user_id_users_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.sessionId],
			foreignColumns: [userSessions.id],
			name: "user_activity_session_id_user_sessions_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.contentId],
			foreignColumns: [contentCache.id],
			name: "user_activity_content_id_content_cache_id_fk"
		}).onDelete("set null"),
]);

export const userSessions = pgTable("user_sessions", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	accessTokenHash: varchar("access_token_hash", { length: 255 }),
	refreshTokenHash: varchar("refresh_token_hash", { length: 255 }).notNull(),
	expiresAt: timestamp("expires_at", { mode: 'string' }).notNull(),
	deviceInfo: jsonb("device_info"),
	ipAddress: varchar("ip_address", { length: 45 }),
	userAgent: text("user_agent"),
	lastAccessedAt: timestamp("last_accessed_at", { mode: 'string' }).defaultNow(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "user_sessions_user_id_users_id_fk"
		}).onDelete("cascade"),
]);

export const contentCache = pgTable("content_cache", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	url: varchar({ length: 500 }).notNull(),
	title: text(),
	description: text(),
	contentType: varchar("content_type", { length: 50 }),
	sourceId: varchar("source_id", { length: 100 }),
	language: varchar({ length: 10 }),
	publishedAt: timestamp("published_at", { mode: 'string' }),
	contentHash: varchar("content_hash", { length: 64 }),
	metadata: jsonb().default({}),
	cachedAt: timestamp("cached_at", { mode: 'string' }).defaultNow().notNull(),
	expiresAt: timestamp("expires_at", { mode: 'string' }),
}, (table) => [
	unique("content_cache_url_unique").on(table.url),
]);

export const userPreferences = pgTable("user_preferences", {
	userId: uuid("user_id").primaryKey().notNull(),
	preferredLanguages: jsonb("preferred_languages").default([]),
	feedCategories: jsonb("feed_categories").default([]),
	translationSettings: jsonb("translation_settings").default({}),
	themePreference: varchar("theme_preference", { length: 20 }).default('system'),
	notificationSettings: jsonb("notification_settings").default({}),
	privacySettings: jsonb("privacy_settings").default({}),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "user_preferences_user_id_users_id_fk"
		}).onDelete("cascade"),
]);

export const articles = pgTable("articles", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	title: text().notNull(),
	summary: text(),
	url: varchar({ length: 500 }).notNull(),
	source: varchar({ length: 100 }).notNull(),
	publishedAt: timestamp("published_at", { mode: 'string' }).defaultNow().notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
	titleTranslations: jsonb("title_translations").default({}),
	summaryTranslations: jsonb("summary_translations").default({}),
	sourceLanguage: varchar("source_language", { length: 10 }).default('en'),
	availableLanguages: jsonb("available_languages").default(["en"]),
	imageUrl: varchar("image_url", { length: 500 }),
}, (table) => [
	unique("articles_url_unique").on(table.url),
]);
