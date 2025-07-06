---
description: Comprehensive News Aggregator Product Requirements & Implementation Plan
alwaysApply: true
---

# News Aggregator Service - Product Requirements & Implementation Plan

## Product Overview

**Mission**: Build a cost-effective, scalable news aggregation service that continuously monitors global news sources, processes content with AI-powered summarization and translation, and feeds a PostgreSQL database to support personalized news recommendations for the Babel Feed mobile application.

**Core Value Proposition**: Break down language barriers by providing real-time, multi-language news content with intelligent categorization and personalization capabilities, while maintaining minimal operational costs and maximum deployment flexibility.

## Functional Requirements

This comprehensive plan provides a roadmap for building a world-class news aggregation service that balances cost-effectiveness with scalability and feature richness. The phased approach ensures steady progress while maintaining system stability and allowing for iterative improvements based on real-world usage and feedback.

The architecture is designed to start simple and cost-effective while providing a clear path to enterprise-scale deployment. By focusing on core functionality first and building advanced features incrementally, the service can begin providing value quickly while continuously improving and expanding its capabilities.

### 1. Content Aggregation & Processing

#### 1.1 News Source Management
- **Database-Driven Source Management**: PostgreSQL-based source configuration with real-time updates and admin API
- **Dynamic Source CRUD**: Full create, read, update, delete operations via admin interface and API endpoints
- **Automated Source Discovery**: Multi-stage pipeline for discovering new news sources and feeds, starting from public lists (Wikipedia, GitHub, open datasets), automated search engine queries, and homepage crawling for RSS/Atom/JSON feeds. Recursively expands by following links from known news sites and aggregators. Allows user/admin suggestions for new sources. Periodically re-checks for new/hidden feeds.
- **Hybrid Ingestion (2025 best practice)**: Prioritize RSS/Atom feeds for efficiency, but automatically fall back to HTML crawling and content extraction when feeds are missing, incomplete, or insufficient (expected for ~30-40% of sources in 2025). Supports JSON APIs and other custom formats as needed.
- **Source Health Monitoring**: Real-time tracking of source reliability, response times, error rates, and content quality metrics. Periodically prunes inactive, low-quality, or duplicate sources.
- **Configurable Refresh Intervals**: Per-source customizable polling intervals (1-60 minutes) with dynamic updates
- **Source Categories & Tags**: Hierarchical categorization and tagging system for better content organization. Uses NLP to auto-categorize sources by topic, region, and language.
- **Content Deduplication**: Hash-based duplicate detection across sources and time windows
- **Source Cap & Diversity Management**: Enforces caps on the number of active sources per category/region/language to ensure diversity and avoid overload. Prioritizes high-quality, unique, and diverse sources over sheer quantity. Maintains blacklist/whitelist for known spam or low-value sources.

#### 1.2 Content Extraction & Processing
- **Multi-format Support**: RSS feeds, JSON APIs, HTML scraping with fallback mechanisms. For each source, attempts RSS/Atom first, then falls back to crawling and extraction if needed. Periodically re-checks for new or improved feeds.
- **Content Extraction**: Title, hero image, article summary, publication date, author, source metadata
- **Content Quality Scoring**: Automated filtering of low-quality articles using length, readability, and source reputation
- **Image Processing**: Thumbnail generation, format standardization, and CDN optimization
- **Content Validation**: Spam detection, content policy compliance, and factual accuracy indicators

#### 1.3 AI-Powered Enhancement with Resilient Architecture
- **Multi-Provider LLM System**: Flexible architecture supporting multiple LLM providers (OpenRouter, Hugging Face, OpenAI, etc.)
- **API Key Rotation**: Automatic rotation between multiple API keys to handle rate limits and quotas
- **Circuit Breaker Pattern**: Implement circuit breakers to handle provider failures and prevent cascade failures
- **Graceful Degradation**: Fallback strategies when AI services are unavailable (hold processing, ensure translation quality, stop service, etc.)
- **Rate Limit Management**: Intelligent rate limiting with exponential backoff and jitter
- **Provider Health Monitoring**: Real-time monitoring of provider availability, response times, and error rates
- **Translation Services**: Multi-language translation (EN, ZH-CN, ZH-TW, JA) with provider failover
- **Summarization Services**: Article summarization with quality thresholds and multiple model options
- **Tagging & Categorization**: Automated content tagging for topics, sentiment, geographic regions, and industries
- **Trending Detection**: Identify emerging topics and trending stories across sources
- **Content Enrichment**: Add metadata for readability scores, estimated reading time, and content complexity

### 2. Database & Storage

#### 2.1 Data Architecture
- **PostgreSQL Backend**: Robust relational database with JSON support for flexible metadata
- **Multi-language Storage**: Separate fields for original content and translations in all supported languages
- **Full-text Search**: Optimized indexing for content discovery and recommendation systems
- **Efficient Querying**: Proper indexing strategy for high-performance article retrieval
- **Data Archival**: Long-term storage strategy for historical content and analytics

#### 2.2 Caching & Performance
- **Translation Cache**: Aggressive caching of translation results to minimize API costs
- **Content Cache**: Redis-backed caching for frequently accessed articles and metadata
- **Database Optimization**: Query optimization, connection pooling, and read replica support
- **CDN Integration**: Image and static content delivery optimization

### 3. Recommendation System Support

#### 3.1 Content Classification
- **Hierarchical Tagging**: Multi-level categorization (Topic � Subtopic � Specific Tags)
- **Sentiment Analysis**: Article sentiment scoring for personalization
- **Geographic Tagging**: Location-based content classification
- **Industry Classification**: Business, technology, politics, sports, entertainment categorization
- **Content Similarity**: Vector-based similarity scoring for related article recommendations

#### 3.2 User Interaction Tracking
- **Reading Behavior**: Track reading time, scroll depth, and engagement metrics
- **User Preferences**: Language preferences, topic interests, and source preferences
- **Interaction History**: Click-through rates, shares, saves, and feedback
- **Recommendation Feedback**: User rating and feedback collection for algorithm improvement

#### 3.3 Personalization Features
- **User Profiling**: Dynamic user interest profiling based on behavior
- **Content Scoring**: Personalized relevance scoring for articles
- **Diversity Optimization**: Ensure recommendation diversity across topics and sources
- **Trending Personalization**: Balance trending content with personal interests
- **Time-based Preferences**: Adjust recommendations based on reading patterns

### 4. Admin Management & Monitoring

#### 4.1 Administrative Interface
- **CLI Tools**: Command-line interface for source management, system status, and maintenance
- **Health Dashboard**: Web-based dashboard for system health, performance metrics, and alerts
- **Source Management**: Add/remove/configure news sources with validation
- **Content Moderation**: Tools for content review, flagging, and removal
- **User Management**: Admin tools for user analytics and system usage

#### 4.2 Observability & Monitoring
- **Performance Metrics**: API response times, processing throughput, error rates
- **Content Metrics**: Articles processed, translation success rates, source reliability
- **System Health**: Database performance, memory usage, disk space, network connectivity
- **Alert System**: Email/SMS notifications for system failures and performance degradation
- **Logging**: Structured logging with log levels, rotation, and searchability

## Architectural Improvements & Design Decisions

### Database-First Source Management

**Rationale**: Static JSON configuration files are not suitable for production systems requiring real-time updates and admin management.

**New Architecture**:
- **PostgreSQL Sources Table**: Store all source configurations in database with full CRUD operations
- **Admin API Endpoints**: RESTful API for source management (create, update, delete, enable/disable)
- **Real-time Updates**: Changes take effect immediately without service restart
- **Source Versioning**: Track configuration changes with timestamps and change logs
- **Bulk Operations**: Support bulk enable/disable, category updates, and batch imports
- **Configuration Validation**: Database constraints and API validation for source integrity

**Benefits**:
- Hot configuration updates without service downtime
- Admin dashboard integration capabilities
- Audit trail for all source changes
- Scalable to thousands of sources
- Multi-user admin access with proper authorization

### Resilient AI Provider Architecture

**Rationale**: Single-provider AI integration creates single points of failure and rate limit bottlenecks.

**New Architecture**:
- **Multi-Provider Support**: OpenRouter, Hugging Face, OpenAI, Anthropic, etc.
- **API Key Pools**: Multiple keys per provider with automatic rotation
- **Circuit Breaker Pattern**: Fail-fast and recovery mechanisms for each provider
- **Provider Health Monitoring**: Real-time status tracking and automatic failover
- **Intelligent Rate Limiting**: Per-provider, per-key rate limit management
- **Graceful Degradation**: Fallback strategies when AI services are unavailable

**Circuit Breaker States**:
- **Closed**: Normal operation, requests flow through
- **Open**: Provider is down, requests immediately fail to fallback
- **Half-Open**: Testing if provider has recovered

**Fallback Strategies**:
1. Try next available provider in rotation
2. Use cached translation results if available
3. Return original content with processing flag
4. Queue for later processing when services recover

**Rate Limit Management**:
- **Exponential Backoff**: Increase delays on rate limit hits
- **Jitter**: Random delays to prevent thundering herd
- **Key Rotation**: Automatically switch to next available key
- **Usage Tracking**: Monitor quota consumption across all keys

## Monorepo Integration Guidelines

### Key System Components
When working on news aggregator implementation, be aware of existing monorepo architecture:

- **`packages/pgdb`**: Handles all PostgreSQL table definitions and database operations
  - Use this package for all database schema and migrations
  - Contains shared database models and query utilities
  - Centralized database connection management

- **`apps/babel-api`**: Mobile app backend service
  - Handles mobile app endpoints (search, feed, user management)
  - User authentication and profile management
  - Content delivery for mobile clients
  - Do NOT duplicate these functionalities in news aggregator

- **`apps/news-aggregator`**: This service (separate admin management)
  - Should have its own admin management APIs separate from babel-api
  - Focus on content ingestion, processing, and admin tools
  - Administrative interfaces for source management and monitoring
  - Should NOT handle mobile user management or authentication

### Service Separation
- News aggregator provides admin APIs for content management
- Babel API consumes processed content for mobile app delivery  
- Clear separation of concerns between admin/content management vs mobile user experience

## Technical Requirements

### 1. Architecture & Technology Stack

#### 1.1 Core Technologies
- **Runtime**: Bun (JavaScript runtime optimized for server-side applications)
- **Language**: TypeScript for type safety and developer experience
- **Database**: PostgreSQL with JSON support via packages/pgdb
- **Message Queue**: Optional RabbitMQ for horizontal scaling and async processing
- **Caching**: Redis for high-performance caching of frequently accessed data

#### 1.2 Service Architecture
- **Modular Monolith Structure**: The news aggregator is implemented as a modular monolith for optimal development and operational simplicity. All core modules (source manager, aggregator/worker, admin API, CLI) reside in a single codebase and deployment artifact, with clear separation of concerns and interfaces. Multiple entrypoints/processes (API, worker, CLI) can be run together or separately, sharing the same database and models. This structure enables easy local development (single command for all-in-one), simple production deployment (single image, flexible process management), and future-proofing (easy to split into microservices if needed).
- **Ingestion Service**: Combined RSS fetching, content extraction, and AI processing, as described above.
- **API Service**: RESTful API for content delivery and admin functions.
- **CLI Tools**: Command-line interface for source management, discovery, and maintenance.
- **Optional Workers**: Separate processing workers for high-volume scaling.
- **Database Service**: PostgreSQL with optimized schema and indexing.

#### 1.3 Development Commands

**News Aggregator Service - Multiple Deployment Modes:**
```bash
# Development (with auto-restart)
nx run news-aggregator:dev:all      # Run all services (API + worker)
nx run news-aggregator:dev:server   # Run API server only
nx run news-aggregator:dev:worker   # Run worker only

# Production
nx run news-aggregator:start        # Run all services
nx run news-aggregator:serve        # Run API server only  
nx run news-aggregator:worker       # Run worker only
nx run news-aggregator:cli          # Run CLI commands

# CLI Examples (when implemented):
nx run news-aggregator:cli add-source https://example.com/rss
nx run news-aggregator:cli health-check
nx run news-aggregator:cli list-sources
nx run news-aggregator:cli discover-sources
```

#### 1.4 External Dependencies
- **LLM Provider**: Hugging Face (free tier) for summarization and translation
- **Image Processing**: Sharp.js for image optimization and thumbnail generation
- **HTTP Client**: Axios with retry logic and timeout handling
- **Monitoring**: Winston for logging, custom metrics collection

### 2. Performance & Scalability

#### 2.1 Performance Targets
- **Response Time**: API responses under 200ms for cached content
- **Processing Throughput**: 100+ articles per minute during peak processing
- **Database Performance**: Query response times under 50ms for standard operations
- **Uptime**: 99.5% uptime with graceful degradation during maintenance

#### 2.2 Scalability Design
- **Horizontal Scaling**: Support for multiple ingestion and processing instances
- **Database Scaling**: Read replicas and connection pooling for high-load scenarios
- **Caching Strategy**: Multi-layer caching for optimal performance
- **Load Balancing**: Application-level load balancing with health checks

### 3. Security & Compliance

#### 3.1 Data Security
- **Database Security**: Encrypted connections, proper authentication, and access controls
- **API Security**: Rate limiting, input validation, and authentication
- **Content Security**: Malware scanning and content policy enforcement
- **Privacy Compliance**: GDPR-compliant data handling and user consent management

#### 3.2 Operational Security
- **Secrets Management**: Secure handling of API keys and database credentials
- **Network Security**: Firewalls, VPN access, and secure communication protocols
- **Audit Logging**: Complete audit trail of admin actions and system changes
- **Backup Strategy**: Regular database backups with tested recovery procedures

### 4. Deployment & Operations

#### 4.1 Deployment Options
- **On-premise**: Docker Compose for single-machine deployment
- **Cloud**: AWS ECS/EKS for production scaling
- **Hybrid**: Support for on-premise development with cloud production
- **CI/CD**: Automated testing, building, and deployment pipelines

#### 4.2 Operational Requirements
- **Monitoring**: Health checks, metrics collection, and alerting
- **Maintenance**: Rolling updates, database migrations, and system maintenance
- **Documentation**: Comprehensive deployment and operational documentation
- **Support**: Error handling, troubleshooting guides, and support procedures

## Implementation Plan

### Phase 1: Foundation & Core Infrastructure (Weeks 1-2)

#### 1.1 Project Setup & Architecture ✅ COMPLETED
- [x] **Project Structure**: Set up monorepo structure with proper TypeScript configuration
- [x] **Database Schema**: Design and implement comprehensive PostgreSQL schema
- [x] **Database Migration System**: Implement migration system for schema changes
- [x] **Environment Configuration**: Set up environment variables and configuration management
- [x] **Development Environment**: Docker Compose setup for local development
- [x] **Modular Monolith Refactor**: ✅ **COMPLETED** - Refactored codebase into modular monolith structure with clear separation of concerns:
  - **modules/common/**: Shared utilities (db, logger, config, types)
  - **modules/source-manager/**: Source CRUD, health monitoring, discovery
  - **modules/aggregator/**: Content fetching, processing, AI integration, deduplication
  - **api/**: Admin API server with source management endpoints
  - **cli/**: Command-line interface for system management
  - **Multiple Entrypoints**: index.ts (all-in-one), server.ts (API-only), worker.ts (worker-only), cli/index.ts (CLI)
  - **Nx Targets**: serve, worker, cli, dev:server, dev:worker, dev:all for flexible development

#### 1.2 Core Services Foundation ✅ COMPLETED
- [x] **Database Connection**: Implement connection pooling and query optimization
- [x] **Basic Logging**: Set up structured logging with Winston
- [x] **Error Handling**: Implement comprehensive error handling and reporting
- [x] **Health Checks**: Basic health check endpoints for monitoring
- [x] **Configuration Management**: JSON-based source configuration system

### Phase 2: Content Ingestion & Processing (Weeks 3-4)

#### 2.1 RSS Feed Processing ✅ COMPLETED
- [x] **RSS Parser**: Implement robust RSS feed parsing with error handling
- [x] **Content Extraction**: Extract title, description, link, publication date, and images
- [x] **Content Validation**: Validate content quality and completeness
- [x] **Deduplication**: Implement hash-based duplicate detection
- [x] **Scheduling System**: Implement configurable polling intervals per source
- [x] **Hybrid Ingestion Pipeline**: Implement logic to attempt RSS/Atom ingestion first, then fall back to HTML crawling and extraction if feeds are missing or insufficient. Periodically re-check for new/hidden feeds.

#### 2.2 AI Integration 🚧 **PLACEHOLDER STRUCTURE CREATED**
**Current Status**: Modular structure created with placeholders, needs implementation

**TODO - High Priority Implementation Needed**:
- [ ] **Database-Driven Source Management**: Replace JSON configuration with PostgreSQL-based source CRUD operations
- [ ] **AI Translation Pipeline**: Implement multi-provider translation with failover and caching
- [ ] **AI Summarization Pipeline**: Implement article summarization with quality thresholds
- [ ] **AI Content Tagging**: Implement automated tagging and categorization
- [ ] **Admin API Endpoints**: Implement Express/Fastify server with source management endpoints
- [ ] **CLI Commands**: Implement functional CLI commands for source management and system control
- [ ] **Source Discovery Pipeline**: Implement automated source discovery with validation and scoring
- [ ] **Content Processing Pipeline**: Implement article processing, validation, and normalization
- [ ] **Deduplication Logic**: Implement sophisticated content deduplication with fuzzy matching
- [ ] **Database Storage**: Implement article storage with translations and metadata
- [ ] **Health Monitoring**: Implement real-time health checks and alerting
- [ ] **Content Extraction**: Implement HTML content extraction for non-RSS sources

**Placeholder Modules Created**:
- ✅ **Source Manager**: CRUD, health monitoring, discovery services (structure only)
- ✅ **Aggregator**: Fetcher, processor, AI integration, deduplication services (structure only)
- ✅ **API Layer**: Admin API server with route placeholders
- ✅ **CLI Layer**: Command-line interface with command placeholders
- ✅ **Multiple Entrypoints**: All-in-one, API-only, worker-only, CLI modes

**Legacy Services**: Maintained for backward compatibility during transition

#### 2.3 Database Operations
- [ ] **Article Storage**: Implement article insertion with conflict resolution
- [ ] **Translation Storage**: Store translations in appropriate database fields
- [ ] **Metadata Management**: Store and manage article metadata and tags
- [ ] **Query Optimization**: Implement efficient database queries for content retrieval
- [ ] **Indexing Strategy**: Create appropriate indexes for performance

### Phase 3: API & Admin Interface (Weeks 5-6)

#### 3.1 REST API Development
- [ ] **Article Endpoints**: GET /articles with pagination, filtering, and search
- [ ] **Content Endpoints**: GET /articles/:id with full content and translations
- [ ] **Search Endpoints**: Full-text search with relevance scoring
- [ ] **Admin Endpoints**: Source management, system status, and configuration
- [ ] **API Documentation**: Comprehensive API documentation and examples

#### 3.2 Admin Management Tools
- [ ] **CLI Interface**: Command-line tools for source management and system control
- [ ] **Source Management**: Add/remove/configure news sources with validation
- [ ] **System Status**: Health dashboard and performance metrics
- [ ] **Content Moderation**: Tools for content review and management
- [ ] **User Analytics**: Basic user interaction tracking and reporting

#### 3.3 Monitoring & Observability
- [ ] **Metrics Collection**: Performance metrics and system health indicators
- [ ] **Alert System**: Email/SMS notifications for critical issues
- [ ] **Log Management**: Log aggregation, rotation, and searchability
- [ ] **Dashboard**: Web-based admin dashboard for system monitoring
- [ ] **Performance Monitoring**: Database performance and API response time tracking

### Phase 4: Recommendation System Foundation (Weeks 7-8)

#### 4.1 Content Classification
- [ ] **Tagging System**: Implement hierarchical content tagging
- [ ] **Sentiment Analysis**: Article sentiment scoring and classification
- [ ] **Geographic Tagging**: Location-based content classification
- [ ] **Industry Classification**: Business sector and topic categorization
- [ ] **Content Similarity**: Vector-based similarity scoring implementation

#### 4.2 User Interaction Tracking
- [ ] **Reading Behavior**: Track user engagement and reading patterns
- [ ] **Preference Management**: User preference storage and management
- [ ] **Interaction History**: Comprehensive user interaction logging
- [ ] **Recommendation Feedback**: User rating and feedback collection
- [ ] **Analytics Foundation**: Basic analytics for recommendation algorithm tuning

#### 4.3 Personalization Features
- [ ] **User Profiling**: Dynamic user interest profiling based on behavior
- [ ] **Content Scoring**: Personalized relevance scoring for articles
- [ ] **Diversity Optimization**: Ensure recommendation diversity across topics
- [ ] **Trending Integration**: Balance trending content with personal interests
- [ ] **Time-based Preferences**: Adjust recommendations based on reading patterns

### Phase 5: Advanced Features & Optimization (Weeks 9-10)

#### 5.1 Advanced Content Processing
- [ ] **Source Discovery Pipeline**: Implement multi-stage automated source discovery (public lists, search engine queries, homepage crawling, recursive expansion, user/admin suggestions), with validation, deduplication, quality scoring, and diversity/cap management. Integrate with source manager for real-time updates and pruning.
- [ ] **Content Quality Scoring**: Advanced filtering of low-quality articles
- [ ] **Image Processing**: Thumbnail generation and image optimization
- [ ] **Content Enrichment**: Additional metadata and content enhancement
- [ ] **Trend Detection**: Identify emerging topics and trending stories

#### 5.2 Performance Optimization
- [ ] **Caching Strategy**: Multi-layer caching for optimal performance
- [ ] **Database Optimization**: Query optimization and performance tuning
- [ ] **CDN Integration**: Image and static content delivery optimization
- [ ] **Load Testing**: Performance testing and bottleneck identification
- [ ] **Scalability Testing**: Test horizontal scaling capabilities

#### 5.3 Security & Compliance
- [ ] **Security Audit**: Comprehensive security review and testing
- [ ] **Data Privacy**: GDPR compliance and user consent management
- [ ] **Content Security**: Malware scanning and content policy enforcement
- [ ] **Audit Logging**: Complete audit trail implementation
- [ ] **Backup Strategy**: Database backup and recovery procedures

### Phase 6: Production Deployment & Scaling (Weeks 11-12)

#### 6.1 Production Deployment
- [ ] **AWS Setup**: ECS/EKS deployment configuration
- [ ] **Database Migration**: Production database setup and migration
- [ ] **Monitoring Setup**: Production monitoring and alerting
- [ ] **Load Balancing**: Application load balancer configuration
- [ ] **SSL/TLS**: HTTPS configuration and certificate management

#### 6.2 Operational Excellence
- [ ] **CI/CD Pipeline**: Automated testing, building, and deployment
- [ ] **Documentation**: Comprehensive deployment and operational documentation
- [ ] **Troubleshooting Guides**: Error handling and troubleshooting procedures
- [ ] **Performance Monitoring**: Production performance monitoring and optimization
- [ ] **Maintenance Procedures**: Rolling updates and system maintenance

#### 6.3 Scaling & Optimization
- [ ] **Horizontal Scaling**: Multi-instance deployment and load balancing
- [ ] **Database Scaling**: Read replicas and connection pooling
- [ ] **Queue Integration**: RabbitMQ integration for high-volume processing
- [ ] **Cost Optimization**: Monitor and optimize cloud costs
- [ ] **Performance Tuning**: Continuous performance monitoring and optimization

## Risk Management

### Technical Risks
- **LLM Rate Limits**: Mitigate with aggressive caching and fallback strategies
- **Source Reliability**: Implement source health monitoring and automatic failover
- **Database Performance**: Regular performance monitoring and optimization
- **Scaling Challenges**: Gradual scaling approach with performance testing

### Business Risks
- **Cost Overruns**: Continuous cost monitoring and optimization
- **Content Quality**: Implement quality scoring and moderation tools
- **Legal Compliance**: Ensure proper content attribution and copyright compliance
- **User Privacy**: Implement GDPR-compliant data handling procedures

### Operational Risks
- **System Failures**: Implement comprehensive monitoring and alerting
- **Data Loss**: Regular backups and tested recovery procedures
- **Security Breaches**: Regular security audits and vulnerability assessments
- **Team Knowledge**: Comprehensive documentation and knowledge sharing
