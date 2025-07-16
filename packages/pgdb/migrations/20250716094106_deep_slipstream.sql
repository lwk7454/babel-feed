ALTER TABLE "source_endpoints" ALTER COLUMN "link_selector" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "source_endpoints" ALTER COLUMN "polling_interval" SET DEFAULT 3600;--> statement-breakpoint
ALTER TABLE "source_endpoints" ALTER COLUMN "priority" SET DEFAULT 1;--> statement-breakpoint
ALTER TABLE "source_endpoints" ADD COLUMN "success_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "source_endpoints" ADD COLUMN "error_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "source_endpoints" ADD COLUMN "last_fetch_at" timestamp;--> statement-breakpoint
ALTER TABLE "source_endpoints" ADD COLUMN "last_success_at" timestamp;--> statement-breakpoint
CREATE INDEX "source_endpoints_reliability_idx" ON "source_endpoints" USING btree ("reliability");