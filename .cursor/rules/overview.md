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



