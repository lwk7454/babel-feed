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
ALTER TABLE "articles" ALTER COLUMN "source_language" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "article_translations" ADD CONSTRAINT "article_translations_article_id_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."articles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "unique_article_language" ON "article_translations" USING btree ("article_id","language");--> statement-breakpoint
CREATE INDEX "language_idx" ON "article_translations" USING btree ("language");--> statement-breakpoint
CREATE INDEX "title_text_idx" ON "article_translations" USING gin (to_tsvector('simple', "title"));--> statement-breakpoint
CREATE INDEX "summary_text_idx" ON "article_translations" USING gin (to_tsvector('simple', "summary"));--> statement-breakpoint
CREATE INDEX "article_language_idx" ON "article_translations" USING btree ("article_id","language");--> statement-breakpoint
ALTER TABLE "articles" DROP COLUMN "title";--> statement-breakpoint
ALTER TABLE "articles" DROP COLUMN "title_translations";--> statement-breakpoint
ALTER TABLE "articles" DROP COLUMN "summary";--> statement-breakpoint
ALTER TABLE "articles" DROP COLUMN "summary_translations";--> statement-breakpoint
ALTER TABLE "articles" DROP COLUMN "available_languages";