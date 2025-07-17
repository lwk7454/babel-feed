CREATE TABLE "ai_provider_keys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider_id" uuid NOT NULL,
	"key_name" varchar(100) NOT NULL,
	"api_key" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"priority" integer DEFAULT 5 NOT NULL,
	"current_usage" integer DEFAULT 0 NOT NULL,
	"daily_quota" integer,
	"monthly_quota" integer,
	"last_used" timestamp,
	"last_reset" timestamp DEFAULT now() NOT NULL,
	"rate_limit_hits" integer DEFAULT 0 NOT NULL,
	"error_count" integer DEFAULT 0 NOT NULL,
	"success_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_providers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"display_name" varchar(255) NOT NULL,
	"provider_type" varchar(50) NOT NULL,
	"base_url" varchar(500) NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"priority" integer DEFAULT 5 NOT NULL,
	"max_requests_per_minute" integer DEFAULT 60 NOT NULL,
	"max_requests_per_hour" integer DEFAULT 1000 NOT NULL,
	"max_requests_per_day" integer DEFAULT 10000 NOT NULL,
	"circuit_breaker_threshold" integer DEFAULT 5 NOT NULL,
	"circuit_breaker_timeout" integer DEFAULT 60000 NOT NULL,
	"health_check_interval" integer DEFAULT 30000 NOT NULL,
	"metadata" jsonb DEFAULT '{}',
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "article_translations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"article_id" uuid NOT NULL,
	"language" varchar(10) NOT NULL,
	"title" text NOT NULL,
	"summary" text,
	"content" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "articles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"url" varchar(500) NOT NULL,
	"source_id" uuid,
	"source" varchar(100) NOT NULL,
	"source_language" varchar(10) NOT NULL,
	"image_url" varchar(500),
	"published_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "articles_url_unique" UNIQUE("url")
);
--> statement-breakpoint
CREATE TABLE "circuit_breaker_states" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider_id" uuid NOT NULL,
	"key_id" uuid,
	"state" varchar(20) NOT NULL,
	"failure_count" integer DEFAULT 0 NOT NULL,
	"last_failure" timestamp,
	"last_success" timestamp,
	"next_attempt" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "content_cache" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"url" varchar(500) NOT NULL,
	"title" text,
	"description" text,
	"content_type" varchar(50),
	"source_id" varchar(100),
	"language" varchar(10),
	"published_at" timestamp,
	"content_hash" varchar(64),
	"metadata" jsonb DEFAULT '{}',
	"cached_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp,
	CONSTRAINT "content_cache_url_unique" UNIQUE("url")
);
--> statement-breakpoint
CREATE TABLE "news_sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"slug" varchar(100) NOT NULL,
	"url" varchar(500) NOT NULL,
	"source_type" varchar(50) NOT NULL,
	"language" varchar(10) NOT NULL,
	"category" varchar(100) NOT NULL,
	"tags" jsonb DEFAULT '[]',
	"enabled" boolean DEFAULT true NOT NULL,
	"polling_interval" integer DEFAULT 300000 NOT NULL,
	"reliability" integer DEFAULT 100 NOT NULL,
	"priority" integer DEFAULT 5 NOT NULL,
	"metadata" jsonb DEFAULT '{}',
	"last_fetched" timestamp,
	"last_success" timestamp,
	"last_error" text,
	"error_count" integer DEFAULT 0 NOT NULL,
	"success_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "news_sources_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "source_endpoints" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_id" uuid NOT NULL,
	"endpoint_url" varchar(500) NOT NULL,
	"type" varchar(50) NOT NULL,
	"category" varchar(100),
	"link_selector" text,
	"polling_interval" integer DEFAULT 3600 NOT NULL,
	"reliability" integer DEFAULT 100 NOT NULL,
	"priority" integer DEFAULT 1 NOT NULL,
	"metadata" jsonb DEFAULT '{}',
	"success_count" integer DEFAULT 0 NOT NULL,
	"error_count" integer DEFAULT 0 NOT NULL,
	"last_fetch_at" timestamp,
	"last_success_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "translation_cache" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_text" text NOT NULL,
	"source_language" varchar(10) NOT NULL,
	"target_language" varchar(10) NOT NULL,
	"translated_text" text NOT NULL,
	"model" varchar(100),
	"quality" integer,
	"content_hash" varchar(64) NOT NULL,
	"usage_count" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_activity" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"session_id" uuid,
	"activity_type" varchar(50) NOT NULL,
	"content_id" uuid,
	"content_url" varchar(500),
	"metadata" jsonb DEFAULT '{}',
	"duration" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_preferences" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"preferred_languages" jsonb DEFAULT '[]',
	"feed_categories" jsonb DEFAULT '[]',
	"translation_settings" jsonb DEFAULT '{}',
	"theme_preference" varchar(20) DEFAULT 'system',
	"notification_settings" jsonb DEFAULT '{}',
	"privacy_settings" jsonb DEFAULT '{}',
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"access_token_hash" varchar(255),
	"refresh_token_hash" varchar(255) NOT NULL,
	"expires_at" timestamp NOT NULL,
	"device_info" jsonb,
	"ip_address" varchar(45),
	"user_agent" text,
	"last_accessed_at" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(255),
	"guest_id" varchar(100),
	"email_verified" boolean DEFAULT false,
	"user_status" varchar(20) DEFAULT 'guest' NOT NULL,
	"verification_token" varchar(255),
	"verification_token_expiry" timestamp,
	"device_fingerprint" varchar(255),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_guest_id_unique" UNIQUE("guest_id")
);
--> statement-breakpoint
ALTER TABLE "ai_provider_keys" ADD CONSTRAINT "ai_provider_keys_provider_id_ai_providers_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."ai_providers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "article_translations" ADD CONSTRAINT "article_translations_article_id_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."articles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "articles" ADD CONSTRAINT "articles_source_id_news_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."news_sources"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "circuit_breaker_states" ADD CONSTRAINT "circuit_breaker_states_provider_id_ai_providers_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."ai_providers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "circuit_breaker_states" ADD CONSTRAINT "circuit_breaker_states_key_id_ai_provider_keys_id_fk" FOREIGN KEY ("key_id") REFERENCES "public"."ai_provider_keys"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source_endpoints" ADD CONSTRAINT "source_endpoints_source_id_news_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."news_sources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_activity" ADD CONSTRAINT "user_activity_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_activity" ADD CONSTRAINT "user_activity_session_id_user_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."user_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_activity" ADD CONSTRAINT "user_activity_content_id_content_cache_id_fk" FOREIGN KEY ("content_id") REFERENCES "public"."content_cache"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_preferences" ADD CONSTRAINT "user_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_sessions" ADD CONSTRAINT "user_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ai_provider_keys_provider_idx" ON "ai_provider_keys" USING btree ("provider_id");--> statement-breakpoint
CREATE INDEX "ai_provider_keys_enabled_idx" ON "ai_provider_keys" USING btree ("enabled");--> statement-breakpoint
CREATE INDEX "ai_provider_keys_priority_idx" ON "ai_provider_keys" USING btree ("priority");--> statement-breakpoint
CREATE INDEX "ai_provider_keys_provider_enabled_idx" ON "ai_provider_keys" USING btree ("provider_id","enabled");--> statement-breakpoint
CREATE UNIQUE INDEX "unique_provider_key_name" ON "ai_provider_keys" USING btree ("provider_id","key_name");--> statement-breakpoint
CREATE INDEX "ai_providers_enabled_idx" ON "ai_providers" USING btree ("enabled");--> statement-breakpoint
CREATE INDEX "ai_providers_type_idx" ON "ai_providers" USING btree ("provider_type");--> statement-breakpoint
CREATE INDEX "ai_providers_priority_idx" ON "ai_providers" USING btree ("priority");--> statement-breakpoint
CREATE INDEX "ai_providers_enabled_type_idx" ON "ai_providers" USING btree ("enabled","provider_type");--> statement-breakpoint
CREATE UNIQUE INDEX "unique_article_language" ON "article_translations" USING btree ("article_id","language");--> statement-breakpoint
CREATE INDEX "language_idx" ON "article_translations" USING btree ("language");--> statement-breakpoint
CREATE INDEX "title_text_idx" ON "article_translations" USING gin (to_tsvector('simple', "title"));--> statement-breakpoint
CREATE INDEX "summary_text_idx" ON "article_translations" USING gin (to_tsvector('simple', "summary"));--> statement-breakpoint
CREATE INDEX "article_language_idx" ON "article_translations" USING btree ("article_id","language");--> statement-breakpoint
CREATE INDEX "articles_source_id_idx" ON "articles" USING btree ("source_id");--> statement-breakpoint
CREATE INDEX "articles_published_idx" ON "articles" USING btree ("published_at");--> statement-breakpoint
CREATE INDEX "articles_source_published_idx" ON "articles" USING btree ("source_id","published_at");--> statement-breakpoint
CREATE INDEX "circuit_breaker_provider_idx" ON "circuit_breaker_states" USING btree ("provider_id");--> statement-breakpoint
CREATE INDEX "circuit_breaker_key_idx" ON "circuit_breaker_states" USING btree ("key_id");--> statement-breakpoint
CREATE INDEX "circuit_breaker_state_idx" ON "circuit_breaker_states" USING btree ("state");--> statement-breakpoint
CREATE UNIQUE INDEX "unique_circuit_breaker_provider_key" ON "circuit_breaker_states" USING btree ("provider_id","key_id");--> statement-breakpoint
CREATE INDEX "news_sources_enabled_idx" ON "news_sources" USING btree ("enabled");--> statement-breakpoint
CREATE INDEX "news_sources_language_idx" ON "news_sources" USING btree ("language");--> statement-breakpoint
CREATE INDEX "news_sources_category_idx" ON "news_sources" USING btree ("category");--> statement-breakpoint
CREATE INDEX "news_sources_priority_idx" ON "news_sources" USING btree ("priority");--> statement-breakpoint
CREATE INDEX "news_sources_enabled_language_idx" ON "news_sources" USING btree ("enabled","language");--> statement-breakpoint
CREATE INDEX "news_sources_enabled_category_idx" ON "news_sources" USING btree ("enabled","category");--> statement-breakpoint
CREATE INDEX "source_endpoints_source_idx" ON "source_endpoints" USING btree ("source_id");--> statement-breakpoint
CREATE INDEX "source_endpoints_type_idx" ON "source_endpoints" USING btree ("type");--> statement-breakpoint
CREATE INDEX "source_endpoints_priority_idx" ON "source_endpoints" USING btree ("priority");--> statement-breakpoint
CREATE INDEX "source_endpoints_reliability_idx" ON "source_endpoints" USING btree ("reliability");