---
description: Translation system architecture and component design
alwaysApply: true
---

# Translation System Architecture

## Core System Design

```
TranslationOrchestrator
├── ContentAnalyzer (Smart HTML parsing & classification)
├── ModelSelector (Choose optimal strategy per content type)
├── TranslationStrategies
│   ├── LocalTranslationChannel
│   │   ├── MLKitTranslator (simple content, fast)
│   │   ├── GeminiNanoTranslator (complex content with context)
│   │   └── CustomModelTranslator (future fine-tuned models)
│   └── AssistedTranslationChannel
│       └── AssistedTranslationStrategy (backend ElysiaJS API)
├── QualityAssessor (Auto-fallback logic)
├── CacheManager (Multi-tier caching)
└── ContextEnhancer (Background research, related content)
```

## Content Classification System

**Content Types:**
- `TEMPLATE_ELEMENT` - Headers, nav, footer, buttons
- `ARTICLE_CONTENT` - Main text requiring context
- `MIXED_CONTENT` - Lists, cards with mixed elements
- `MEDIA_CAPTIONS` - Image captions, video descriptions
- `INTERACTIVE_ELEMENT` - Forms, dynamic content

**Complexity Levels:**
- `SIMPLE` - Direct word-to-word translation
- `CONTEXTUAL` - Requires understanding context
- `CREATIVE` - Requires cultural adaptation
- `TECHNICAL` - Domain-specific terminology

## Smart Content Distribution

**Model Selection Logic:**
- Template elements → ML Kit (fast, efficient)
- Article content (contextual) → Gemini Nano (context-aware)
- Article content (simple) → ML Kit if supported
- Complex/unsupported content → Cloud models (OpenRouter)

## Translation Strategies

**Core Interface:**
```kotlin
interface TranslationStrategy {
    suspend fun translate(request: TranslationRequest): Flow<TranslationResult>
    fun canHandle(request: TranslationRequest): Boolean
    val priority: Int
    val modelType: ModelType
}
```

**Strategy Priorities:**
1. On-device models (privacy, speed, offline)
2. Cloud-assisted models (quality, complex content)
3. Fallback mechanisms (reliability)

## Quality Assessment & Auto-Fallback

**Quality Metrics:**
- Model confidence scores
- Translation consistency
- Cultural appropriateness
- Technical accuracy

**Fallback Chain:**
1. Primary strategy fails → Next capable strategy
2. Quality below threshold → More powerful model
3. All strategies fail → Error with user notification

## Context Enhancement

**Context Analysis:**
- Topic extraction from content
- Sentiment analysis
- Entity recognition
- Cultural context detection
- Domain identification

**Enhanced Translation Features:**
- Context-aware prompts
- Cultural adaptation
- Domain-specific terminology
- Consistency across content segments

## Performance & Extensibility

**Plugin Architecture:** Model registration system for easy addition of new translation strategies

**Feature Flags:** Gradual rollout system for new capabilities

**Performance Monitoring:** Track latency, quality scores, resource usage, and fallback events

**Configuration Management:** Flexible configuration for quality thresholds, fallback chains, and cache settings

# Android App Screen Flow Specification

**SOURCE OF TRUTH**: This section defines the exact behavior for all Android app screens. When code conflicts with these specifications, update code to match this document.

**IMPLEMENTATION SCOPE**: Business requirements only - no technical implementation details specified.

## Global Requirements

- **Language Display**: All UI text displays in user's selected language
- **Navigation**: Use explicit navigation patterns as specified per screen
- **State Management**: Maintain user state across screen transitions

## Screen Navigation Flow

```
Welcome → Feed (has profile) OR Feed ← Welcome (no profile)
Feed → Profile → Verification → Profile
Feed → Article Summary → Full Article (WebView)
```

## 1. Welcome Screen
**Entry Condition**: App opens AND no existing user profile
**Exit Condition**: User confirms language selection

### Required Elements
- Animated Language Carousel
- Language Selector
- Confirmation Button

### Business Logic
- IF user has existing profile → Skip this screen, go directly to Feed
- ON confirmation button press → Save language + create profile + navigate to Feed

## 2. News Feed Screen
**Entry Condition**: App opens AND user has profile, OR navigation from Welcome screen
**Language Rule**: ALL content displays in user's selected language

### Required Elements
- Navigation Bar
- Article Feed (Lazy-loading infinite scroll)
- Loading Indicator

### Feed Behavior
- Pagination, Scroll Behavior, Performance

### Article Card Specification
- Image, Text, Language Badge, Click Action

### Navigation Actions
- Profile button → Profile screen
- Article card → Article Summary screen

## 3. Profile Screen
**Entry Condition**: User clicks Profile button from Feed

### User Status Types
- guest, verified, vip, future

### Required Elements
- Navigation Bar
- Account Card (status-dependent)
- Preferences Section

### Account Card - Guest User
- User status display, Email verification prompt, Email input, Verify button

### Account Card - Authenticated User
- User status display, Email, Logout button

### Preferences Section
- Data Sync, Auto-fill, Immediate Apply
- Options: Auto translation, Language selector, Theme, Notifications, Privacy

### Navigation Actions
- Back button → Feed screen
- Verify button → Verification screen
- Logout → Welcome screen

## 4. Verification Screen
**Entry Condition**: User clicks Verify button from Profile with valid email
**API Trigger**: Opening screen automatically calls "send verification email" API

### Required Elements
- Navigation Bar, Instruction Message, OTP Input, Submit Button, Resend Button, Error Banner

### Resend Button Behavior
- Initial cooldown, New cooldown after resend, Disabled during cooldown, Countdown timer

### Success Flow
1. Valid OTP submission
2. Hide all UI elements
3. Show large success icon + text
4. Auto-navigate to Profile screen after delay
5. IF user was already verified: Load preferences from server + overwrite local

### Navigation Actions
- Back button → Profile screen
- Success completion → Profile screen

## 5. Article Summary Screen
**Entry Condition**: User clicks article card from Feed
**API Trigger**: Opening screen calls "Get article" API with article ID

### Required Elements
- Navigation Bar, Article Content, Language Badge, Source Information, Read Full Article Button

### Navigation Actions
- Back button → Feed screen
- Read Full Article button → Full Article (WebView) screen

## 6. Full Article Screen (WebView)
**Entry Condition**: User clicks "Read Full Article" from Article Summary
**Purpose**: Real-time translation of external web content

### Required Elements
- Navigation Bar, WebView, Translation Status Overlay

### Menu Button Actions
- Translation toggle, Ad blocker toggle, Close drawer

### WebView Translation Behavior
- Universal Translation, Real-time Processing, Dynamic Content, URL Changes, Persistent Translation

### Translation Status Indicators
- Loading animation, Error state, Success confirmation

### Navigation Actions
- Back button → Article Summary screen
- Menu drawer → Toggle options

# Testing Strategy

## Three-Tier Testing Approach

### 1. Unit Tests (Android Kotlin)
- Test individual component behaviors in isolation
- Location: `apps/babel-android/app/src/test/kotlin/`
- Coverage: Business logic, data transformations, edge cases

### 2. Backend API Tests (ElysiaJS + Bun Test)
- Test API endpoints and business logic with comprehensive database scenarios
- Location: `apps/babel-api/src/tests/`
- Framework: Bun test with BDD structure (describe/it blocks)

#### 2.1 Unit Tests (Mock Data)
- Coverage: All API endpoints with mocked dependencies
- Approach: Isolate endpoint logic from database and external services

#### 2.2 Integration Tests (Test Database)
- Coverage: Multi-endpoint workflows with real database operations
- Database Management: Dedicated test database with full lifecycle control

#### Database Lifecycle
- Per Test Run: Initialize and migrate fresh database schema
- Per Test: Truncate all tables to ensure test isolation
- Cleanup: Automatic database teardown after test completion

#### Key Integration Flows
- User registration → Email verification → Profile setup
- Authentication → Article fetching → Translation requests
- User preferences → Content personalization → Feed generation
- OTP verification → User status upgrade → Premium features
- Article aggregation → Translation pipeline → Content delivery

#### Test Database Requirements
- Isolated test database instance (separate from development/production)
- Automated schema migration before each test run
- Table truncation between individual tests
- Seed data management for consistent test scenarios
- Transaction rollback support for complex test scenarios

### 3. Mobile E2E Tests (Bun + Appium + WebdriverIO v9)
- Test complete mobile app functionality with modern test framework
- Architecture: Self-contained test environment with automated service management

#### Key Test Areas
- Mobile app connectivity and UI interaction
- WebView context detection and management
- Backend API integration and health monitoring
- Device capabilities and screenshot functionality
- Service lifecycle management (automated startup/shutdown)

## Modern Testing Architecture

**Self-Contained Environment:**
- Automated service startup (Backend API, Appium Server)
- Health monitoring and verification
- Graceful service shutdown and cleanup
- Zero manual dependency management

**Quality Gates:**
- Service Management: 100% automated lifecycle
- Developer Experience: Modern tooling with watch/UI modes
- Test Structure: Proper BDD organization

## Testing Workflow Integration

**Continuous Development:**
```bash
bun run test:api            # Backend API tests (unit + integration)
bun run test:api:unit       # Backend unit tests only
bun run test:api:integration # Backend integration tests only
bun run test:appium         # Full mobile test suite
bun run test:appium:watch   # Watch mode for development
bun run test:appium:ui      # Visual test interface
```

**Pre-Commit Verification:**
```bash
bun run test:api        # Backend API tests
bun run test:appium     # Mobile E2E tests
bun run test:android    # Android unit tests
bun run lint:android    # Code quality
```

**CI/CD Integration:**
- Automated tests must pass before merge
- Unit tests and linting required
- Self-contained environment ensures consistent CI results
- Database isolation prevents test interference

## Success Metrics

**Android Unit Tests:**
- Coverage: 100% of business logic components
- Success Rate: 100% (deterministic)
- Performance: <30 seconds total execution
- Isolation: No external dependencies

**Backend API Tests:**
- Unit Test Coverage: 100% of API endpoints
- Integration Test Coverage: All critical user flows
- Success Rate: 100% (controlled test environment)
- Performance: <45 seconds total execution (including DB setup)
- Database Isolation: Complete test isolation with fresh DB per run

**Mobile E2E Tests:**
- Success Rate: 100%
- Performance: Full suite <60 seconds (including service startup)
- Coverage: Core mobile app functionality and service integration
- Automation: Zero manual service management required

**Quality Gates:**
1. All unit tests must pass (Android + Backend)
2. All backend integration tests must pass
3. Mobile E2E tests 100% success rate
4. Service management 100% automated
5. Modern test framework standards maintained

## Testing Principles

**Modern Framework Standards:**
- Use Bun tests for BDD structure (describe/it blocks)
- Proper assertions with meaningful error messages
- Graceful handling of service dependencies
- Self-contained test environments

**Database Testing Standards:**
- Fresh database instance per test run
- Table truncation between individual tests
- No shared state between tests
- Automated schema migration and seeding
- Transaction-based cleanup where applicable

**Robust Test Design:**
- Focus on behavioral verification over implementation details
- Reasonable timeouts accounting for service startup
- Threshold-based success criteria (≥80% pass rate for E2E)
- Automated service lifecycle management

**Developer Experience:**
- Watch mode for continuous development
- Visual test interface for debugging
- Clear test organization and reporting
- Zero manual setup requirements

# User Profile System

## User Status Types
- **guest**: Not logged in, no authentication token
- **verified**: Logged in with valid authentication token  
- **vip**: Logged in with premium status
- **Future**: Additional status types may be added

## Profile Creation & Management
- When user first opens the app, the app creates a guest profile that's saved on device
- Guest profile includes language preference and basic settings
- Profile persists across app sessions until user chooses to logout

## Authentication Flow
- User can bind their guest account to an email address through verification
- Upon requesting verification, backend creates an account and sends OTP email
- Upon successful OTP verification, account status updates to "verified" in backend
- Once verified, all app requests include authentication header
- Session persists indefinitely - no frequent re-authentication required

## Profile Screen Requirements

### Navigation
- Accessible via Profile button from Feed screen
- Back button returns to Feed screen
- Screen title: "Profile"

### Account Card - Guest User
- Display user status: "Guest"
- Email verification prompt message
- Email input field with validation
- Verify button → Navigate to Verification screen (requires valid email)

### Account Card - Verified User  
- Display user status: "Verified" or "VIP"
- Display user email address
- Logout button → Clear profile + clear auth token + navigate to Welcome screen

### Preferences Section
- **Data Sync**: Save to both local storage AND server via "Save settings" API
- **Auto-fill**: Pre-populate all settings with current user values
- **Immediate Apply**: Changes take effect instantly upon modification

#### Required Preference Options
- Auto translation toggle
- User language selector (show options in their native language)
- Light/dark theme toggle  
- Notification settings
- Privacy settings

## Verification Screen Requirements

### Entry Conditions
- User clicks Verify button from Profile screen with valid email
- Screen automatically calls "send verification email" API on load

### Required Elements
- Navigation bar with back button and screen title
- Instruction message: "Verification email with OTP sent"
- 4-digit OTP input field
- Submit button for OTP validation
- Resend button with cooldown timer functionality
- Error banner for API/validation errors

### Resend Button Behavior
- Initial cooldown period on screen load
- New cooldown starts after each resend attempt
- Button disabled during cooldown periods
- Display countdown timer

### Success Flow
1. Valid OTP submission
2. Hide all UI elements  
3. Show large success icon + text
4. Auto-navigate to Profile screen after delay
5. **IF user was already verified**: Load user preferences from server + overwrite local settings

## Language & Localization
- All profile UI text displays in user's selected language
- Language selector shows options in their native language
- Profile settings persist across language changes

## Data Persistence
- Guest profile: Local device storage only
- Verified profile: Local storage + server synchronization
- Authentication token: Secure local storage
- Settings changes: Immediate local save + server sync for verified users