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
ALTER TABLE "articles" ADD COLUMN "source_id" uuid;--> statement-breakpoint
ALTER TABLE "ai_provider_keys" ADD CONSTRAINT "ai_provider_keys_provider_id_ai_providers_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."ai_providers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "circuit_breaker_states" ADD CONSTRAINT "circuit_breaker_states_provider_id_ai_providers_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."ai_providers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "circuit_breaker_states" ADD CONSTRAINT "circuit_breaker_states_key_id_ai_provider_keys_id_fk" FOREIGN KEY ("key_id") REFERENCES "public"."ai_provider_keys"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ai_provider_keys_provider_idx" ON "ai_provider_keys" USING btree ("provider_id");--> statement-breakpoint
CREATE INDEX "ai_provider_keys_enabled_idx" ON "ai_provider_keys" USING btree ("enabled");--> statement-breakpoint
CREATE INDEX "ai_provider_keys_priority_idx" ON "ai_provider_keys" USING btree ("priority");--> statement-breakpoint
CREATE INDEX "ai_provider_keys_provider_enabled_idx" ON "ai_provider_keys" USING btree ("provider_id","enabled");--> statement-breakpoint
CREATE UNIQUE INDEX "unique_provider_key_name" ON "ai_provider_keys" USING btree ("provider_id","key_name");--> statement-breakpoint
CREATE INDEX "ai_providers_enabled_idx" ON "ai_providers" USING btree ("enabled");--> statement-breakpoint
CREATE INDEX "ai_providers_type_idx" ON "ai_providers" USING btree ("provider_type");--> statement-breakpoint
CREATE INDEX "ai_providers_priority_idx" ON "ai_providers" USING btree ("priority");--> statement-breakpoint
CREATE INDEX "ai_providers_enabled_type_idx" ON "ai_providers" USING btree ("enabled","provider_type");--> statement-breakpoint
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
ALTER TABLE "articles" ADD CONSTRAINT "articles_source_id_news_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."news_sources"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "articles_source_id_idx" ON "articles" USING btree ("source_id");--> statement-breakpoint
CREATE INDEX "articles_published_idx" ON "articles" USING btree ("published_at");--> statement-breakpoint
CREATE INDEX "articles_source_published_idx" ON "articles" USING btree ("source_id","published_at");