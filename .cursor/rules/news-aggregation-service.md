---
description: News Aggregator Service - Essential Developer Guide
alwaysApply: true
---

# News Aggregator Service - Developer Guide

## Overview

News aggregation service that monitors global sources, processes content with AI (translation/summarization), and feeds PostgreSQL for Babel Feed mobile app. Built as modular monolith with Bun/TypeScript.

## Architecture

### Service Structure
- **Modular Monolith**: Single codebase, multiple entrypoints
- **Entrypoints**: `index.ts` (all-in-one), `server.ts` (API-only), `worker.ts` (worker-only), `cli/index.ts` (CLI)
- **Modules**: `common/`, `source-manager/`, `aggregator/`, `recommendation/`

### Key Dependencies
- **Database**: PostgreSQL via `packages/pgdb`
- **AI**: Multi-provider LLM system (OpenRouter, Hugging Face, OpenAI) via `packages/llm-provider`
- **Content Extraction**: `packages/news-extractor` for HTML parsing
- **Source Analysis**: `packages/news-sourcer` for AI-powered feed discovery and HTML extraction rules

## Development Commands

```bash
# Development
nx run news-aggregator:dev:all      # API + worker
nx run news-aggregator:dev:server   # API only
nx run news-aggregator:dev:worker   # Worker only

# Production
nx run news-aggregator:start        # All services
nx run news-aggregator:serve        # API server
nx run news-aggregator:worker       # Worker only
nx run news-aggregator:cli          # CLI tools

# CLI Examples
nx run news-aggregator:cli add-source https://example.com/rss
nx run news-aggregator:cli health-check
nx run news-aggregator:cli list-sources
nx run news-aggregator:cli discover-sources
```

## Core Features

### Content Processing Pipeline
1. **Source Discovery**: NewsSourcer analyzes `news_sources` to generate `source_endpoints`
2. **Content Fetching**: Use `source_endpoints` (RSS/Atom feeds or HTML extraction rules)
3. **AI Enhancement**: Translation (EN/ZH-CN/ZH-TW/JA), summarization, tagging
4. **Quality Filtering**: Length, readability, source reputation scoring
5. **Deduplication**: Hash-based duplicate detection

### Source Management
- **Two-Tier Architecture**: `news_sources` (homepages) → `source_endpoints` (feeds/extraction rules)
- **NewsSourcer Integration**: AI-powered analysis to discover RSS feeds and HTML extraction rules
- **Auto Discovery**: Public lists, homepage crawling, periodic re-checks
- **Health Monitoring**: Reliability tracking, response times, error rates

### Recommendation System
- **Content Classification**: 3-level taxonomy, sentiment, geographic tagging
- **User Analytics**: Reading patterns, engagement metrics, preferences
- **Hybrid Algorithm**: Content-based + collaborative + trending scoring
- **Diversity Management**: Category caps, source balance

## Database Schema

### Key Tables
- `news_sources`: News website homepages for discovery and analysis
- `source_endpoints`: RSS feeds, HTML endpoints, and extraction rules (generated from news_sources)
- `articles`: Content, translations, metadata, quality scores
- `user_interactions`: Reading behavior, preferences, feedback
- `recommendations`: Personalized content scoring

### Important Fields
- Articles store original + translated content in separate fields
- Full-text search enabled on content fields
- JSON metadata for flexible tagging and categorization

## AI Integration

### Multi-Provider System
- **Circuit Breaker**: Fail-fast with provider health monitoring
- **Rate Limiting**: Per-provider, per-key with exponential backoff
- **Fallback Strategy**: Provider rotation → cached results → original content
- **Caching**: Aggressive translation caching to minimize API costs

### Supported Providers
- OpenRouter (primary)
- Hugging Face (fallback)
- OpenAI (fallback)
- Custom OpenAI-compatible APIs

## API Endpoints

### Admin API (`/admin`)
- `GET/POST/PUT/DELETE /sources` - Source management
- `GET /health` - System status
- `GET /metrics` - Performance metrics

### Content API
- `GET /articles` - Paginated article list with filtering
- `GET /articles/:id` - Full article with translations
- `GET /search` - Full-text search with relevance scoring
- `GET /feed` - Personalized recommendations

## Configuration

### Source Configuration
- Refresh intervals: 1-60 minutes per source
- Category caps: news (50), tech (20), etc.
- Quality thresholds: minimum content length, readability scores

## Testing

### Test Coverage
- Unit tests for core functionality
- Integration tests for API endpoints
- Mock AI providers for reliable testing

### Test Commands
```bash
nx test news-aggregator
nx test news-aggregator --watch
```

## Deployment

### Production
- Single container with multiple processes
- Health checks and graceful shutdown
- Database migrations via `drizzle push`
- No manual migration files (schema drift prevention)

## Monitoring

### Metrics
- API response times
- Processing throughput (articles/minute)
- AI provider health and rate limits
- Database query performance

### Logging
- Structured JSON logging with Winston
- Log levels: error, warn, info, debug
- Rotation and archival policies

## Common Issues

### AI Rate Limits
- Check provider health in admin dashboard
- Verify API key rotation is working
- Monitor cache hit rates

### Source Failures
- Health monitoring shows unreliable sources
- Auto-discovery may find replacements
- Manual source addition via CLI

### Database Performance
- Check query execution plans
- Verify indexes on frequently queried fields
- Monitor connection pool usage

## Development Guidelines

### Code Style
- TypeScript strict mode
- ESLint rules enforced
- BDD-style tests with bun:test
- Mock all external dependencies

### Architecture Principles
- Database operations only in `packages/pgdb`
- No `any` types - use explicit typing
- Modular design with clear interfaces
- Circuit breaker pattern for external APIs

