-- Add translation fields to articles table
ALTER TABLE "articles" ADD COLUMN "title_translations" jsonb DEFAULT '{}'::jsonb;
ALTER TABLE "articles" ADD COLUMN "summary_translations" jsonb DEFAULT '{}'::jsonb;
ALTER TABLE "articles" ADD COLUMN "available_languages" jsonb DEFAULT '["en"]'::jsonb;
ALTER TABLE "articles" ADD COLUMN "image_url" varchar(500);

-- Rename language column to source_language
ALTER TABLE "articles" RENAME COLUMN "language" TO "source_language";

-- Set default value for source_language if not already set
UPDATE "articles" SET "source_language" = 'en' WHERE "source_language" IS NULL;
ALTER TABLE "articles" ALTER COLUMN "source_language" SET NOT NULL;