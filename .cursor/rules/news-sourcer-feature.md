# @babel-feed/news-sourcer

`news-sourcer` automatically discovers how a news website publishes new articles and stores a repeatable guide for fetching article URLs. It does **not** parse article pages—`news-extractor` handles that part.

## Purpose

- Build a per-site extraction pipeline so `news-aggregator` can fetch article lists without worrying about each site's layout.
- Use an agentic LLM workflow that makes multiple calls and browses pages directly. No heuristics.
- Prefer RSS or Atom feeds when available, otherwise learn how to crawl HTML list pages.
- Persist all knowledge in the database so later runs do not require another LLM call.

## Requirements

- Accept a news website URL and figure out how the site organises its articles.
- If feeds exist, record each feed as an endpoint.
- If only HTML pages exist, ask the LLM to produce CSS selectors or a small script for collecting article links, including pagination hints.
- Support multiple endpoints per site (e.g. separate categories).
- Track reliability metrics and polling intervals for each endpoint.

## Implementation Phases

### Phase 1: Database Schema & RSS Discovery
**Goal:** Implement core database structure and automatic RSS/Atom feed discovery.

#### Database Schema (Drizzle)
```typescript
// Add to existing schema
source_endpoints: {
  id: serial().primaryKey(),
  newsSourceId: integer().references(() => newsSources.id),
  endpointUrl: text().notNull(),
  type: text().notNull(), // 'rss' | 'atom' | 'html'
  category: text(),
  linkSelector: text(), // CSS selector for HTML endpoints
  pollingInterval: integer().default(3600), // seconds
  reliability: real().default(1.0), // 0.0 to 1.0
  priority: integer().default(1),
  metadata: jsonb(), // LLM-produced script/instructions
  successCount: integer().default(0),
  errorCount: integer().default(0),
  lastFetchAt: timestamp(),
  lastSuccessAt: timestamp(),
  createdAt: timestamp().defaultNow(),
  updatedAt: timestamp().defaultNow()
}
```

#### RSS Discovery Implementation
- [x] Parse HTML for `<link rel="alternate" type="application/rss+xml">` tags
- [x] Parse HTML for `<link rel="alternate" type="application/atom+xml">` tags
- [x] Check common RSS paths (`/rss`, `/feed`, `/rss.xml`, `/atom.xml`)
- [x] Validate discovered feeds by fetching and parsing XML structure
- [x] Store validated RSS/Atom endpoints in database

#### Testing Phase 1
- [x] Unit tests for RSS link extraction
- [x] Integration tests with real RSS feeds
- [x] Database schema migration tests

### Phase 2: Endpoint Validation & Storage
**Goal:** Implement robust endpoint validation and database persistence.

#### Endpoint Validation
- [x] Fetch discovered RSS/Atom feeds and validate XML structure
- [x] Extract sample article URLs from feeds
- [x] Check URL patterns and ensure they point to actual articles
- [x] Implement retry logic with exponential backoff
- [x] Track success/failure metrics

#### Database Operations
- [x] CRUD operations for `source_endpoints` table
- [x] Bulk insert/update operations for discovered endpoints
- [x] Cleanup of stale or failing endpoints
- [x] Reliability score calculation based on success/error rates

#### Testing Phase 2
- [x] Mock HTTP responses for various feed formats
- [x] Test endpoint validation with malformed feeds
- [x] Database integration tests

### Phase 3: LLM-Based HTML Analysis
**Goal:** Implement agentic LLM workflow for sites without RSS feeds.

#### Standardized Return Format
```typescript
interface DiscoveredEndpoint {
  // Basic endpoint info
  url: string;
  type: 'rss' | 'atom' | 'html';
  category: string;
  priority: number; // 1-10, higher = more important
  
  // HTML-specific crawling instructions
  crawlingScript: {
    articleSelector: string;           // CSS selector for article links
    titleSelector?: string;            // Optional: extract title
    timestampSelector?: string;        // Optional: extract publish time
    excerptSelector?: string;          // Optional: extract summary
    imageSelector?: string;            // Optional: extract thumbnail
    
    // Pagination handling
    paginationSelector?: string;       // CSS selector for next page link
    maxPages?: number;                 // Limit pages to crawl
    
    // Filtering
    excludeSelectors?: string[];       // CSS selectors to exclude
    includePatterns?: string[];        // URL patterns to include
    excludePatterns?: string[];        // URL patterns to exclude
    
    // Rate limiting
    delayBetweenRequests?: number;     // Milliseconds between requests
    maxConcurrentRequests?: number;    // Max parallel requests
  };
  
  // Reliability metrics
  reliability: {
    confidence: number;                // 0.0-1.0, LLM's confidence in selectors
    testResults: {
      sampleSize: number;              // Number of URLs tested
      successRate: number;             // 0.0-1.0, validation success rate
      avgArticlesPerPage: number;      // Expected articles per page
    };
  };
  
  // Maintenance info
  metadata: {
    discoveredAt: Date;
    lastValidated: Date;
    llmModel: string;                  // Which model generated this
    version: string;                   // Schema version
    notes?: string;                    // Human-readable notes
  };
}

interface SourceAnalysisResult {
  sourceUrl: string;
  endpoints: DiscoveredEndpoint[];
  globalConfig: {
    userAgent: string;
    requestHeaders?: Record<string, string>;
    respectRobotsTxt: boolean;
    baseDelay: number;                 // Base delay between requests
  };
  analysisMetadata: {
    iterations: number;                // How many LLM calls were made
    totalAnalysisTime: number;         // Milliseconds
    finalConfidence: number;           // Overall confidence 0.0-1.0
  };
}
```

#### HTML Crawling Workflow
1. **Initial Page Analysis**
   - Fetch target website HTML
   - Clean and preprocess (remove scripts, styles, limit size to 4KB)
   - Extract navigation structure and article patterns

2. **LLM Analysis Process**
   - Send structured prompt with cleaned HTML
   - Request CSS selectors for article links, titles, timestamps
   - Include category detection and pagination handling
   - Generate confidence scores for each selector

3. **Validation Loop**
   - Test each proposed selector by actual crawling
   - Validate sample article URLs for correctness
   - Calculate success rates and reliability metrics
   - Re-prompt LLM with feedback if validation fails

4. **Convergence Criteria**
   - Minimum 70% validation success rate
   - At least 5 valid article URLs per endpoint
   - Maximum 5 LLM iterations per website
   - Overall confidence score > 0.6

#### LLM Integration
- [x] Use content analysis models (not translation models)
- [x] Implement iterative LLM calls with validation loops
- [x] HTML preprocessing (remove scripts, styles, limit size)
- [x] Structured prompts for CSS selector extraction
- [x] Validation of LLM-proposed selectors by actual crawling
- [x] Implement standardized return format interfaces

#### Agent Loop Implementation
- [x] `NewsSourcer` class with state management
- [x] Multiple LLM providers with failover
- [x] Validation between LLM calls
- [x] Convergence criteria (max iterations, confidence threshold)
- [x] Error handling and recovery
- [x] Support for complex site structures and pagination

#### Testing Phase 3
- [x] Mock LLM responses for different website structures
- [x] End-to-end tests with real websites (BBC, Guardian, CNN)
- [x] Performance tests for agent loops
- [x] Validation engine tests with edge cases

### Phase 4: Advanced Features
**Goal:** Add production-ready features for reliability and maintenance.

#### Reliability & Monitoring
- [ ] Circuit breaker pattern for failing endpoints
- [ ] Exponential backoff for rate limiting
- [ ] Health check endpoints for monitoring
- [ ] Alerting for endpoint failures
- [ ] Performance metrics collection

#### Adaptive Re-analysis
- [ ] Periodic re-analysis of HTML endpoints when layouts change
- [ ] Trigger re-analysis on consecutive failures
- [ ] Version control for endpoint configurations
- [ ] Rollback mechanism for failed updates

#### Testing Phase 4
- [ ] Load testing for high-volume scenarios
- [ ] Chaos engineering tests
- [ ] Long-running reliability tests

### Phase 5: Aggregator Integration
**Goal:** Seamless integration with news-aggregator service.

#### Integration Points
- [ ] API endpoints for querying available source endpoints
- [ ] Webhook notifications for new endpoints
- [ ] Shared types and interfaces
- [ ] Error reporting back to sourcer

#### Production Deployment
- [ ] Docker containerization
- [ ] CI/CD pipeline integration
- [ ] Monitoring and logging setup
- [ ] Documentation and runbooks

## Implementation Tracking

### Current Status
- [x] Phase 1: Database Schema & RSS Discovery
- [x] Phase 2: Endpoint Validation & Storage  
- [x] Phase 3: LLM-Based HTML Analysis
- [ ] Phase 4: Advanced Features
- [ ] Phase 5: Aggregator Integration

### Priority Order
1. **Phase 1** - Foundation (RSS discovery covers 80% of news sites)
2. **Phase 2** - Validation (ensures reliability)
3. **Phase 3** - LLM analysis (handles remaining 20% of sites)
4. **Phase 4** - Production features (reliability & monitoring)
5. **Phase 5** - Integration (connects to broader system)

This phased approach provides immediate value with RSS discovery while building toward the full agentic LLM vision. Each phase can be independently tested and deployed.

---

## Phase 1 Implementation Details (COMPLETED)

### Architecture
- **NewsSourcer Class**: Clean, dependency-free implementation focused on RSS/Atom discovery
- **Core Method**: `analyzeSource(url: string)` returns comprehensive `NewsSourceAnalysis`
- **Dependencies**: axios, cheerio, fast-xml-parser, @babel-feed/utils

### Key Features Implemented
1. **RSS/Atom Feed Discovery**
   - HTML `<link rel="alternate">` tag parsing
   - Common path discovery (`/rss`, `/feed`, `/rss.xml`, `/atom.xml`)
   - Automatic deduplication
   - User-Agent header compliance

2. **Feed Validation**
   - XML parsing with attribute support
   - RSS 2.0 and Atom 1.0 format validation
   - Sample URL extraction for verification
   - Error handling with detailed messages

3. **Database Schema**
   - Updated `sourceEndpoints` table with Phase 1 fields
   - Proper indexing and relationships
   - Support for success/error tracking

### Test Coverage
- **9 tests** covering all major functionality
- RSS/Atom discovery from HTML and common paths
- Feed validation for both RSS and Atom formats
- Error handling and success rate calculations
- Integration test structure for real websites

### Performance
- Configurable timeouts (10s page fetch, 5s head requests)
- Parallel validation of discovered feeds
- Efficient XML parsing with fast-xml-parser
- Proper error recovery and logging

### Usage Example
```typescript
const sourcer = new NewsSourcer()
await sourcer.initialize()

const analysis = await sourcer.analyzeSource('https://example.com')
console.log(`Found ${analysis.rssFeeds.length} RSS feeds`)
console.log(`Found ${analysis.atomFeeds.length} Atom feeds`)
console.log(`Success rate: ${(analysis.successRate * 100).toFixed(1)}%`)

// Access validation results
for (const [url, result] of analysis.validationResults) {
  console.log(`${url}: ${result.valid ? 'Valid' : 'Invalid'}`)
}
```

### Ready for Phase 2
Phase 1 provides the foundation for Phase 2 database persistence and Phase 3 LLM analysis. The clean architecture allows easy extension without breaking existing functionality.

---

## Phase 2 Implementation Details (COMPLETED)

### Architecture
- **Enhanced Endpoint Validation**: Robust validation with retry logic and exponential backoff
- **Database Operations**: Complete CRUD operations for source endpoints management
- **Reliability Tracking**: Comprehensive metrics and scoring system
- **Bulk Operations**: Efficient batch processing for multiple endpoints

### Key Features Implemented

1. **Advanced Endpoint Validation**
   - XML structure validation for RSS/Atom feeds
   - Sample URL extraction and verification
   - Configurable retry logic with exponential backoff
   - Success/failure rate tracking
   - Response time monitoring

2. **Database Operations**
   - Full CRUD operations for `source_endpoints` table
   - Bulk insert/update operations with optional replacement
   - Query interface with filtering and pagination
   - Endpoint metrics management
   - Automatic cleanup of stale endpoints

3. **Reliability System**
   - Dynamic reliability score calculation
   - Success/error count tracking
   - Exponential decay for recent failures
   - Configurable thresholds and cleanup policies

4. **Configuration Management**
   - Flexible validation options (timeouts, retries, URL validation)
   - Database connection management
   - User-agent and request header configuration

### Test Coverage
- **16 comprehensive tests** covering all database and validation functionality
- Enhanced endpoint validation with various scenarios
- Database CRUD operations and bulk processing
- Reliability calculation and metrics tracking
- Error handling and timeout scenarios
- Configuration validation

### Performance Features
- Parallel validation of multiple endpoints
- Configurable timeouts and retry policies
- Efficient database queries with proper indexing
- Bulk operations for high-volume scenarios
- Circuit breaker pattern preparation

### Usage Example
```typescript
const sourcer = new NewsSourcer({
  validation: {
    maxRetries: 3,
    baseDelay: 1000,
    timeout: 10000,
    validateUrls: true
  }
})
await sourcer.initialize()

// Enhanced validation with retry logic
const validation = await sourcer.validateEndpoint('https://example.com/rss')
console.log(`Reliability: ${validation.reliability}`)
console.log(`Response time: ${validation.responseTime}ms`)

// Database operations
const endpoint = await sourcer.createEndpoint({
  sourceId: 'news-site-id',
  endpointUrl: 'https://example.com/rss',
  type: 'rss',
  category: 'technology'
})

// Query with filters
const endpoints = await sourcer.queryEndpoints({
  sourceId: 'news-site-id',
  minReliability: 0.8,
  limit: 10
})

// Bulk operations
await sourcer.bulkCreateEndpoints({
  sourceId: 'news-site-id',
  endpoints: discoveredEndpoints,
  replaceExisting: true
})
```

### Ready for Phase 3
Phase 2 provides robust validation and database persistence, enabling reliable storage and management of discovered endpoints. The system now supports both RSS/Atom feeds and prepares for HTML endpoint management in Phase 3.

---

## Phase 3 Implementation Details (COMPLETED)

### Architecture
- **LLM-Based HTML Analysis**: Agentic workflow for sites without RSS feeds
- **HTML Preprocessing**: Removes scripts, styles, and limits size to 4KB for optimal LLM processing
- **Iterative Analysis Loop**: Maximum 5 iterations with convergence criteria (70% success rate, 60% confidence)
- **Validation Engine**: Tests LLM-proposed selectors against actual web pages
- **Integration with LLM Provider Manager**: Uses the shared `@babel-feed/llm-provider` for provider management

### Key Features Implemented

1. **HTML Content Preprocessing**
   - Removes non-content elements (scripts, styles, ads, navigation)
   - Focuses on main content areas (main, article, .content tags)
   - Limits content to 4KB for efficient LLM processing
   - Preserves essential structure for CSS selector generation

2. **LLM Analysis Pipeline**
   - Structured prompts for CSS selector extraction
   - Support for article links, titles, timestamps, and pagination
   - Iterative improvement with feedback loops
   - Confidence scoring and validation requirements

3. **Validation and Quality Control**
   - Real-time validation of proposed selectors
   - Sample URL testing with success rate calculation
   - Convergence criteria (minimum 70% success rate, 5 sample URLs)
   - Error handling and graceful degradation

4. **Standardized Data Structures**
   - `DiscoveredEndpoint` interface for HTML endpoints
   - `SourceAnalysisResult` for complete analysis results
   - Comprehensive metadata tracking (discovery time, model used, confidence)
   - Database integration for persistent storage

### Test Coverage
- **14 comprehensive tests** covering all major functionality
- HTML preprocessing and content extraction
- LLM prompt generation and response parsing
- Endpoint validation with various scenarios
- End-to-end workflow testing
- Error handling and edge cases
- Database integration and storage

### Performance Features
- Configurable timeouts and retry logic
- Test-specific delay reduction (100ms vs 2s in production)
- Efficient HTML parsing with Cheerio
- Parallel validation of sample URLs
- Circuit breaker integration through LLM provider manager

### Usage Example
```typescript
const sourcer = new NewsSourcer()
await sourcer.initialize()

// For sites without RSS feeds
const htmlAnalysis = await sourcer.analyzeHtmlSource('https://news-site.com')
console.log(`Found ${htmlAnalysis.endpoints.length} HTML endpoints`)
console.log(`Analysis confidence: ${htmlAnalysis.analysisMetadata.finalConfidence}`)

// Store discovered endpoints in database
for (const endpoint of htmlAnalysis.endpoints) {
  await sourcer.createEndpoint({
    sourceId: 'news-site-id',
    endpointUrl: endpoint.url,
    type: 'html',
    category: endpoint.category,
    linkSelector: endpoint.crawlingScript.articleSelector,
    reliability: endpoint.reliability.confidence,
    metadata: {
      crawlingScript: endpoint.crawlingScript,
      llmMetadata: endpoint.metadata
    }
  })
}
```

### Integration Points
- **Phase 1 & 2**: Seamlessly integrates with existing RSS/Atom discovery and database operations
- **LLM Provider**: Uses shared `AiProviderManager` for provider selection and failover
- **Database**: Stores HTML endpoints alongside RSS/Atom feeds using the same schema
- **Future Phases**: Provides foundation for Phase 4 advanced features and Phase 5 aggregator integration

### Ready for Phase 4
Phase 3 completes the core analysis capabilities, providing both RSS/Atom discovery and LLM-based HTML analysis. The system can now handle any news website, making it ready for production features like monitoring, alerting, and adaptive re-analysis in Phase 4.
