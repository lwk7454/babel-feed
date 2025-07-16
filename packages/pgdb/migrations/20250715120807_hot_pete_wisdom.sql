CREATE TABLE "source_endpoints" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_id" uuid NOT NULL,
	"endpoint_url" varchar(500) NOT NULL,
	"type" varchar(50) NOT NULL,
	"category" varchar(100),
	"link_selector" varchar(255),
	"polling_interval" integer DEFAULT 300000 NOT NULL,
	"reliability" integer DEFAULT 100 NOT NULL,
	"priority" integer DEFAULT 5 NOT NULL,
	"metadata" jsonb DEFAULT '{}',
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "source_endpoints" ADD CONSTRAINT "source_endpoints_source_id_news_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."news_sources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "source_endpoints_source_idx" ON "source_endpoints" USING btree ("source_id");--> statement-breakpoint
CREATE INDEX "source_endpoints_type_idx" ON "source_endpoints" USING btree ("type");--> statement-breakpoint
CREATE INDEX "source_endpoints_priority_idx" ON "source_endpoints" USING btree ("priority");