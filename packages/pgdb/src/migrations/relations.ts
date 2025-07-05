import { relations } from "drizzle-orm/relations";
import { users, userActivity, userSessions, contentCache, userPreferences } from "./schema";

export const userActivityRelations = relations(userActivity, ({one}) => ({
	user: one(users, {
		fields: [userActivity.userId],
		references: [users.id]
	}),
	userSession: one(userSessions, {
		fields: [userActivity.sessionId],
		references: [userSessions.id]
	}),
	contentCache: one(contentCache, {
		fields: [userActivity.contentId],
		references: [contentCache.id]
	}),
}));

export const usersRelations = relations(users, ({many}) => ({
	userActivities: many(userActivity),
	userSessions: many(userSessions),
	userPreferences: many(userPreferences),
}));

export const userSessionsRelations = relations(userSessions, ({one, many}) => ({
	userActivities: many(userActivity),
	user: one(users, {
		fields: [userSessions.userId],
		references: [users.id]
	}),
}));

export const contentCacheRelations = relations(contentCache, ({many}) => ({
	userActivities: many(userActivity),
}));

export const userPreferencesRelations = relations(userPreferences, ({one}) => ({
	user: one(users, {
		fields: [userPreferences.userId],
		references: [users.id]
	}),
}));