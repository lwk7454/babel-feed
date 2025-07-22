---
description: Project Overview
alwaysApply: true
---
# Overview
**Project Name:** Babel Feed

**Core Mission:**
Create a mobile application that enables users to discover, consume, and understand global news and video content, breaking language barriers through integrated, on-device translation.

**Target Audience:**
- Primary: Mandarin Chinese speakers accessing global news/video content
- Secondary: Japanese and English speakers (future expansion)
- Focus: Tech-savvy, younger users interested in diverse perspectives

**Key Features:**
- Aggregated content feed (news & video)
- In-app browser for content consumption
- On-device, client-side translation (LLM-powered)
- Personalization (languages, topics, sources)
- Modern, intuitive UI

**Design Philosophy:**
- Modern, minimalist, and performance-minded
- Intuitive navigation and clear translation controls
- Legal compliance: reinforce that content is from original sources, translation is client-side

# Module Responsibilities & Guidance

## Android App (apps/babel-android/)
- Native Kotlin Android app using Jetpack Compose
- Implements feed, article summary, profile, verification, and in-app browser screens
- **See `babel-android-features.md` for detailed architecture, translation system, and user profile flows.**

## Backend API (apps/babel-api/)
- ElysiaJS backend for content aggregation, user management, and assisted translation
- Type-safe API endpoints for mobile app
- **See backend documentation for API and integration details.**

## News Aggregation Service (apps/news-aggregator/)
- Aggregates news and video sources for the feed
- Integrates with backend API
- **See service documentation for aggregation logic.**

## Translation System
- On-device translation (ML Kit, Gemini Nano, etc.) with cloud-assisted fallback
- Real-time translation in WebView, pre-translated content elsewhere
- **See `babel-android-features.md` for translation system architecture and model selection logic.**

## User Profile & Authentication
- Guest and verified user flows, persistent profile, email verification
- Preferences: language, theme, notifications, privacy
- **See `babel-android-features.md` for user profile and authentication flows.**

## Testing Strategy
- Three-tier: Android unit tests, backend API tests, mobile E2E (Appium)
- Automated, self-contained test environments
- **See `babel-android-features.md` for detailed testing strategy and requirements.**

### Test Database Architecture
The project uses a sophisticated test database setup that ensures tests run in isolation with fresh, consistent data:

#### Key Principles
- **All tests must be run from project root** to leverage `bunfig.toml` preload configuration
- **Test migrations are generated fresh** for each test run and never committed to git
- **Individual test files never handle DB connections** - all abstraction is in `@babel-feed/pgdb/test-utils.ts`
- **Development/production environments use `drizzle-kit push`** - only tests use migrations

#### Test Database Flow
1. **Preload Setup** (`bunfig.toml`):
   - `test-setup.ts` sets `NODE_ENV=test` and disables DB debugging
   - `generate-test-migrations.ts` creates fresh migrations from current schema

2. **Migration Generation** (`packages/pgdb/scripts/generate-test-migrations.ts`):
   - Cleans existing test migrations from `packages/pgdb/test-migrations/`
   - Uses `drizzle-test.config.ts` to generate new migrations against empty DB
   - Migrations are timestamped and gitignored

3. **Test Database Connection** (`packages/pgdb/src/connection.ts`):
   - Detects `NODE_ENV=test` and uses PGlite (in-memory PostgreSQL WASM)
   - Production/development uses real PostgreSQL connections
   - Connection is singleton and environment-aware

4. **Test Utilities** (`packages/pgdb/src/test-utils.ts`):
   - `clearTestData()`: Truncates all tables between tests
   - Helper functions for inserting test data

#### Test File Pattern
```typescript
import { clearTestData } from '@babel-feed/pgdb'
import { createTestTimers } from '@babel-feed/utils'

describe('My Test Suite', () => {
  const timer = createTestTimers()

  beforeEach(async () => {
    await clearTestData()
    timer.reset()
  })

  // Tests here...
})
```

#### Fake Timer Requirements
**All tests must use fake timers from `@babel-feed/utils` - never use real timings:**

- **Import**: `import { createTestTimers } from '@babel-feed/utils'`
- **Setup**: `const timer = createTestTimers()` at describe level
- **Reset**: `timer.reset()` in beforeEach for clean state
- **Time Control**: Use `timer.tick()`, `timer.tickAsync()`, `timer.setTime()` for deterministic timing
- **Performance Testing**: Use `createPerformanceTestHelpers(timer)` for timing assertions

**Why Fake Timers:**
- **Deterministic**: Tests run consistently regardless of system load
- **Fast**: No real waiting during timeouts, delays, or intervals
- **Controllable**: Precise control over time progression for edge cases
- **Reliable**: Eliminates flaky tests caused by timing variations

#### Environment Separation
- **Test**: PGlite in-memory DB with fresh migrations
- **Development**: PostgreSQL with `drizzle-kit push` schema updates
- **Production**: PostgreSQL with `drizzle-kit push` schema updates

# Development & Infrastructure
- Monorepo managed by Nx (21.1.2), Bun as package manager. DO NOT use NPM. 
- Android ARM64 primary target, macOS M4 dev environment
- Local-first infrastructure, AWS-compatible design for future scale
- Backend DB is PostgreSQL, with Drizzle as ORM. Schema is always managed by Drizzle migrations. All tests use in-memory PGLite connector instead. 
- **See project root README and module docs for build, test, and deployment commands.**

# Legal & Compliance
- No content re-hosting; all translation is client-side
- UI must clearly indicate original source and translation status

# For Detailed Module Specifications
- **Translation System, User Profile, and Testing:** See [`babel-android-features.md`](./babel-android-features.md)
- **Other modules:** See respective documentation in each app/service directory

# Git
- When commiting, always add all changed files (use `git add .`) unless otherwise specified, make sure you have read all git changes to have a good idea of what's been changed. 
- When writting commit messages, always be concise, only include major changes, don't go into to much details. 

