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
- [ ] Fetch discovered RSS/Atom feeds and validate XML structure
- [ ] Extract sample article URLs from feeds
- [ ] Check URL patterns and ensure they point to actual articles
- [ ] Implement retry logic with exponential backoff
- [ ] Track success/failure metrics

#### Database Operations
- [ ] CRUD operations for `source_endpoints` table
- [ ] Bulk insert/update operations for discovered endpoints
- [ ] Cleanup of stale or failing endpoints
- [ ] Reliability score calculation based on success/error rates

#### Testing Phase 2
- [ ] Mock HTTP responses for various feed formats
- [ ] Test endpoint validation with malformed feeds
- [ ] Database integration tests

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
- [ ] Use content analysis models (not translation models)
- [ ] Implement iterative LLM calls with validation loops
- [ ] HTML preprocessing (remove scripts, styles, limit size)
- [ ] Structured prompts for CSS selector extraction
- [ ] Validation of LLM-proposed selectors by actual crawling
- [ ] Implement standardized return format interfaces

#### Agent Loop Implementation
- [ ] `NewsSourcer` class with state management
- [ ] Multiple LLM providers with failover
- [ ] Validation between LLM calls
- [ ] Convergence criteria (max iterations, confidence threshold)
- [ ] Error handling and recovery
- [ ] Support for complex site structures and pagination

#### Testing Phase 3
- [ ] Mock LLM responses for different website structures
- [ ] End-to-end tests with real websites (BBC, Guardian, CNN)
- [ ] Performance tests for agent loops
- [ ] Validation engine tests with edge cases

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
- [ ] Phase 2: Endpoint Validation & Storage  
- [ ] Phase 3: LLM-Based HTML Analysis
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
