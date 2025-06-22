CREATE TABLE "articles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"summary" text,
	"url" varchar(500) NOT NULL,
	"source" varchar(100) NOT NULL,
	"language" varchar(10) DEFAULT 'en' NOT NULL,
	"published_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "articles_url_unique" UNIQUE("url")
);

-- Insert sample articles
INSERT INTO "articles" ("title", "summary", "url", "source", "language", "published_at") VALUES
('Breaking: Climate Summit Reaches Historic Agreement', 'World leaders at COP29 have reached a groundbreaking agreement on carbon emission reductions, setting ambitious targets for 2030. The deal includes unprecedented financial commitments from developed nations to support green transitions in developing countries.', 'https://example.com/climate-summit-agreement', 'Global News Network', 'en', '2025-06-22 10:00:00'),

('Tech Giant Announces Revolutionary AI Breakthrough', 'A major technology company has unveiled a new artificial intelligence system that achieves human-level performance across multiple cognitive tasks. The breakthrough could revolutionize industries from healthcare to education, though experts urge caution about potential risks.', 'https://example.com/ai-breakthrough', 'TechDaily', 'en', '2025-06-22 08:30:00'),

('Archaeological Discovery Reveals Ancient Civilization', 'Archaeologists in South America have uncovered evidence of a previously unknown civilization dating back 3,000 years. The discovery includes sophisticated urban planning, advanced metallurgy, and unique artistic styles that challenge existing theories about pre-Columbian cultures.', 'https://example.com/archaeological-discovery', 'Science Weekly', 'en', '2025-06-22 06:15:00'),

('Global Economic Markets Show Strong Recovery Signs', 'International markets are displaying robust growth patterns following recent policy changes. Analysts point to increased consumer confidence, stabilizing supply chains, and innovative financial instruments as key drivers of this economic resurgence.', 'https://example.com/economic-recovery', 'Financial Times', 'en', '2025-06-22 09:45:00'),

('Renewable Energy Project Powers Entire City', 'A pioneering renewable energy initiative has successfully powered a city of 200,000 residents entirely through solar and wind power for 30 consecutive days. The project demonstrates the feasibility of large-scale renewable energy adoption and serves as a model for urban sustainability.', 'https://example.com/renewable-energy-city', 'Environmental Report', 'en', '2025-06-22 07:20:00'),

('Medical Breakthrough Offers Hope for Rare Disease', 'Researchers have developed a groundbreaking gene therapy treatment for a rare genetic disorder affecting thousands worldwide. Clinical trials show promising results with minimal side effects, potentially offering hope to patients who previously had no treatment options.', 'https://example.com/medical-breakthrough', 'Health Science Today', 'en', '2025-06-22 11:10:00'),

('Space Mission Discovers Potentially Habitable Exoplanet', 'An international space mission has identified an exoplanet with conditions that could support liquid water and potentially life. Located 40 light-years away, the planet orbits within its star''s habitable zone and shows atmospheric signatures suggesting the presence of water vapor.', 'https://example.com/exoplanet-discovery', 'Space Exploration News', 'en', '2025-06-22 05:30:00'),

('Cultural Festival Celebrates Global Diversity', 'The annual International Cultural Festival drew over 500,000 visitors celebrating traditions from 80 countries. The event featured traditional performances, culinary experiences, and educational exhibits promoting cross-cultural understanding and global unity.', 'https://example.com/cultural-festival', 'Cultural Times', 'en', '2025-06-22 12:00:00');