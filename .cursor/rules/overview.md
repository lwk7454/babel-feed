---
description: Project Overview
alwaysApply: true
---
# Overview
**1. Project Name:** Babel Feed

**2. Core Mission:** To create a mobile application that allows users to seamlessly discover, consume, and understand global news articles and video content, breaking down language barriers through integrated, on-device translation.

**3. Target Audience:**
    *   **Primary (Initial Launch):** Mandarin Chinese speakers who want to access and understand news and video content from global sources published in other languages.
    *   **Secondary (Future Expansion):** Japanese speakers, and subsequently, English speakers wishing to consume content from Chinese/Japanese sources.
    *   **Demographic Focus:** Tech-savvy users, likely younger generations interested in diverse global perspectives, news, and online video content (including potentially niche interests like anime culture, as per previous branding discussions).

**4. Core User Experience & Key Features:**
    *   **Aggregated Content Feed:**
        *   The app will present a personalized, scrollable feed of news articles (displaying headlines and legally permissible short snippets/summaries) and video content (thumbnails, titles, source).
        *   Content will be aggregated from a variety of online sources.
    *   **In-App Browser for Content Consumption:**
        *   When a user selects an item, the app will open the original source URL (news article web page or video platform page) within a dedicated in-app browser.
        *   **Crucially, the app does NOT re-host or re-publish the full content on its own servers.**
    *   **On-Device, Client-Side Translation:**
        *   The core differentiating feature: While viewing content in the in-app browser, the user can activate an **on-device LLM-powered translation** feature.
        *   This functions like a sophisticated browser plugin, translating the currently displayed web page text (for articles) or providing real-time translated captions (for videos, where feasible) into the user's chosen language.
        *   **All translation processing must occur locally on the user's mobile device.** This is critical for legal compliance regarding copyrighted content.
    *   **Personalization:** Users should be able to select preferred languages, topics, and potentially sources to customize their feed.
    *   **User Interface (UI):**
        *   Text-based news and video content should be clearly differentiated yet cohesively presented in the feed.
        *   Seamless navigation between the feed, the in-app browser, and translation controls.

**5. Design Philosophy & Aesthetic:**
    *   **Modern & Cutting-Edge:** The design should feel fresh, contemporary, and technologically advanced.
    *   **Playful & Engaging (Optional):** While clean, it can incorporate subtle playful elements or a tone that resonates with a younger, digitally native audience, potentially drawing inspiration from modern app design trends or even a slight nod to tech-savvy/anime-adjacent cultures (without being overly niche or cluttered).
    *   **Intuitive & User-Friendly:** Easy to navigate, with clear calls to action. The translation feature should be easily discoverable and simple to activate/deactivate.
    *   **Developer-Friendly & Minimalist:** Prioritize designs that are achievable with standard UI components and frameworks (e.g., for Tauri). Avoid overly complex artistic elements requiring specialized design skills to implement. Focus on clean lines, good typography, and effective use of space. Consider neumorphism, glassmorphism, or refined minimalism.
    *   **Performance-Minded:** UI should be lightweight and responsive, especially considering on-device processing.

**6. Key Design Challenges/Considerations:**
    *   **Integrating Translation Seamlessly:** How to present the translation option within the in-app browser without being intrusive, yet making it obvious and easy to use. Visual feedback for translation status.
    *   **Legal Compliance in UI:** The design must reinforce that the user is viewing original content from the source and that translation is a client-side tool they are activating. Avoid any UI that implies the app itself is the publisher of the translated content.
    *   **Content Diversity:** Effectively displaying both text-heavy news items and visual video items in a unified feed.
    *   **Cross-Platform Consistency (Tauri Implication):** Design elements should translate well to a cross-platform mobile environment.

**7. What to Avoid in Design:**
    *   Designs that imply the app is hosting or republishing full, translated versions of articles server-side.
    *   Cluttered interfaces.
    *   Over-reliance on custom artistic assets that are hard to create/maintain.

# Technology Stack

## Monorepo Architecture (Nx 21.1.2)
- **apps/babel-android/**: Native Kotlin Android app with Jetpack Compose UI
- **apps/babel-api/**: ElysiaJS backend services with type-safe API
- **tools/nx-executors/**: Custom Nx executors for Android build orchestration
- **Package Manager**: Bun (not npm)
- **Build System**: Nx orchestrating TypeScript backend + Gradle for Android

## Key Technologies
- **Mobile Framework**: Native Kotlin Android with Jetpack Compose
- **UI Framework**: Jetpack Compose with Material Design 3
- **Backend**: ElysiaJS with type-safe API integration
- **State Management**: MVVM pattern with ViewModels and StateFlow
- **Translation**: On-device ML Kit + Cloud-assisted via OpenRouter free models
- **HTTP Client**: Retrofit + OkHttp for API communication
- **Dependency Injection**: Hilt (Dagger-based)

## Core Features

### Native Android App
- News feed display using LazyColumn with Jetpack Compose
- Content summary pages with Material Design components
- External website WebView with JavaScript bridge
- Dual translation system: on-device + cloud-assisted
- Dual WebView architecture: main app navigation + external content viewing
- MVVM architecture with ViewModels, StateFlow, and Compose integration

### Backend API
- ElysiaJS framework with type-safe API endpoints
- Retrofit integration for Android app communication
- Content aggregation from news and video sources
- Assisted translation using OpenRouter free models

### News Aggregation Service

### Supported Languages
- English (en)
- Chinese Simplified (zh-CN)
- Chinese Traditional (zh-TW)
- Japanese (ja)

## Translation Requirements

### App-Wide Translation Policy
- **Default State**: User sees translated content throughout entire app based on their language preference
- **WebView Real-time Translation**: Only full article view (WebView) supports real-time toggle translation
- **Translation Toggle Scope**: WebView translation toggle only affects current WebView session lifetime
- **All Other Content**: Pre-translated content displayed according to user's language setting

### Content Translation Categories
- **App Interface Text**: Hard-coded UI text with full i18n support for all supported languages
- **News Feed & Summary**: Pre-translated content served in user's preferred language
- **Article Content**: Real-time translation available in WebView with toggle functionality

### Article Data Model
- **Multi-language Storage**: Articles stored with translations in all supported languages
- **Source Language Tracking**: Original source language preserved and indicated to users


# Android App Screen Flow Specification

**SOURCE OF TRUTH**: This document defines the exact behavior for all Android app screens. When code conflicts with these specifications, update code to match this document.

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
**Path**: `apps/babel-android/app/src/main/kotlin/com/babelfeed/app/ui/screens/welcome/`
**Entry Condition**: App opens AND no existing user profile
**Exit Condition**: User confirms language selection

### Required Elements
- **Animated Language Carousel**: Rotating greeting messages in all supported languages asking user to select language
- **Language Selector**: Dropdown/picker for user's preferred language
- **Confirmation Button**: Saves language to new profile AND navigates to Feed screen

### Business Logic
- IF user has existing profile → Skip this screen, go directly to Feed
- ON confirmation button press → Save language + create profile + navigate to Feed

## 2. News Feed Screen  
**Path**: `apps/babel-android/app/src/main/kotlin/com/babelfeed/app/ui/screens/feed/`
**Entry Condition**: App opens AND user has profile, OR navigation from Welcome screen
**Language Rule**: ALL content displays in user's selected language

### Required Elements
- **Navigation Bar**: App title + Profile button (right side)
- **Article Feed**: Lazy-loading infinite scroll with pagination
- **Loading Indicator**: Shows at bottom when loading additional articles

### Feed Behavior
- **Pagination**: Load articles in predictable chunks
- **Scroll Behavior**: Trigger new loads when user scrolls down
- **Performance**: Show loading indicator if user scrolls faster than loading

### Article Card Specification
- **Image**: Thumbnail with lazy loading + placeholder animation
- **Text**: Article title
- **Language Badge**: Shows original article language code (en, ja, cn, etc.) on thumbnail corner
- **Click Action**: Navigate to Article Summary screen

### Navigation Actions
- Profile button → Profile screen
- Article card → Article Summary screen

## 3. Profile Screen
**Path**: `apps/babel-android/app/src/main/kotlin/com/babelfeed/app/ui/screens/profile/`
**Entry Condition**: User clicks Profile button from Feed

### User Status Types
- **guest**: Not logged in, no authentication token
- **verified**: Logged in with valid authentication token  
- **vip**: Logged in with premium status
- **Future**: Additional status types may be added

### Required Elements
- **Navigation Bar**: Back button + screen title
- **Account Card**: User status-dependent content
- **Preferences Section**: Settings with immediate save functionality

### Account Card - Guest User
- User status display
- Email verification prompt message
- Email input field
- Verify button → Navigate to Verification screen (requires valid email)

### Account Card - Authenticated User  
- User status display
- User email address display
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

### Navigation Actions
- Back button → Feed screen
- Verify button → Verification screen
- Logout → Welcome screen

## 4. Verification Screen
**Path**: `apps/babel-android/app/src/main/kotlin/com/babelfeed/app/ui/screens/verify/`
**Entry Condition**: User clicks Verify button from Profile screen with valid email
**API Trigger**: Opening screen automatically calls "send verification email" API

### Required Elements
- **Navigation Bar**: Back button + screen title
- **Instruction Message**: "Verification email with OTP sent" notification
- **OTP Input**: 4-digit code entry field
- **Submit Button**: Validates and submits OTP
- **Resend Button**: With cooldown timer, disabled during cooldown
- **Error Banner**: Shows API/validation errors

### Resend Button Behavior
- Initial cooldown on screen load
- New cooldown starts after each resend attempt
- Button disabled during cooldown periods
- Shows countdown timer

### Success Flow
1. Valid OTP submission
2. Hide all UI elements  
3. Show large success icon + text
4. Auto-navigate to Profile screen after delay
5. **IF user was already verified**: Load user preferences from server + overwrite local settings

### Navigation Actions
- Back button → Profile screen
- Success completion → Profile screen

## 5. Article Summary Screen
**Path**: `apps/babel-android/app/src/main/kotlin/com/babelfeed/app/ui/screens/article/`
**Entry Condition**: User clicks article card from Feed
**API Trigger**: Opening screen calls "Get article" API with article ID

### Required Elements
- **Navigation Bar**: Back button + screen title
- **Article Content**: Title + summary in user's language
- **Language Badge**: Indicates article's original source language
- **Source Information**: Publisher + metadata
- **Read Full Article Button**: Navigate to Full Article screen

### Navigation Actions  
- Back button → Feed screen
- Read Full Article button → Full Article (WebView) screen

## 6. Full Article Screen (WebView)
**Path**: `apps/babel-android/app/src/main/kotlin/com/babelfeed/app/ui/screens/webview/`
**Entry Condition**: User clicks "Read Full Article" from Article Summary
**Purpose**: Real-time translation of external web content

### Required Elements
- **Navigation Bar**: Back button + screen title + menu button
- **WebView**: Displays article's source URL
- **Translation Status Overlay**: Fixed corner position with status animations

### Menu Button Actions
Opens popup drawer with:
- Translation toggle option
- Ad blocker toggle option  
- Close drawer button

### WebView Translation Behavior
- **Universal Translation**: Translate ANY URL content to user's language
- **Real-time Processing**: Translate during page loading + monitor content changes
- **Dynamic Content**: Handle content added after initial page load
- **URL Changes**: Continue translation when user navigates within WebView
- **Persistent Translation**: Maintain translation through all content changes

### Translation Status Indicators
- Loading animation during translation
- Error state for translation failures
- Success confirmation when complete

### Navigation Actions
- Back button → Article Summary screen
- Menu drawer → Toggle options

# Testing Strategy

## Three-Tier Testing Approach

### 1. Unit Tests (Android Kotlin)
**Purpose**: Test individual component behaviors in isolation
**Location**: `apps/babel-android/app/src/test/kotlin/`
**Coverage**: Business logic, data transformations, edge cases

**Key Test Areas:**
- ChannelSelector: Priority-based channel selection logic
- AssistedTranslationStrategy: Backend communication and fallbacks
- TranslationCoordinator: Integration of multiple components
- ModelSelector: Model selection based on complexity

### 2. Backend API Tests (ElysiaJS + Bun Test)
**Purpose**: Test API endpoints and business logic with comprehensive database scenarios
**Location**: `apps/babel-api/src/tests/`
**Framework**: Bun test with BDD structure (describe/it blocks)

#### 2.1 Unit Tests (Mock Data)
**Coverage**: All API endpoints with mocked dependencies
**Approach**: Isolate endpoint logic from database and external services

**Key Test Areas:**
- Authentication endpoints (login, register, OTP verification)
- Article endpoints (fetch, search, pagination)
- Translation endpoints (assisted translation requests)
- User profile endpoints (preferences, settings)
- Request validation and error handling
- Response formatting and status codes

#### 2.2 Integration Tests (Test Database)
**Coverage**: Multi-endpoint workflows with real database operations
**Database Management**: Dedicated test database with full lifecycle control

**Database Lifecycle:**
- **Per Test Run**: Initialize and migrate fresh database schema
- **Per Test**: Truncate all tables to ensure test isolation
- **Cleanup**: Automatic database teardown after test completion

**Key Integration Flows:**
- User registration → Email verification → Profile setup
- Authentication → Article fetching → Translation requests
- User preferences → Content personalization → Feed generation
- OTP verification → User status upgrade → Premium features
- Article aggregation → Translation pipeline → Content delivery

**Test Database Requirements:**
- Isolated test database instance (separate from development/production)
- Automated schema migration before each test run
- Table truncation between individual tests
- Seed data management for consistent test scenarios
- Transaction rollback support for complex test scenarios

### 3. Mobile E2E Tests (Bun + Appium + WebdriverIO v9)
**Purpose**: Test complete mobile app functionality with modern test framework
**Architecture**: Self-contained test environment with automated service management

**Key Test Areas:**
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

This comprehensive testing strategy ensures robust, maintainable tests across all system tiers using modern frameworks while providing a seamless developer experience through automated service management and industry-standard tooling.

# Infrastructure

Backend service is deployed to AWS. 

## Design Philosophy
- Keep cost at minimum, this is a startup project without funding. Try to use free resources whenever possible (without much architecture compromise).
- By default, non-prod environment should not incur cost, so pick services carefully. Look for workaround when fit. For example if we use RDS in production, local dev should always run a DB locally instead of using cloud. 
- When introducing new services, take extra effort in considering what future features we are adding, and keep the number of services at minimum. For example we should use the same RDS instance for all our needs if it could do the job, don't introduce unnecessary new services. Any new service introduced should be extensible to future features. 



# Development Guidelines

## Rules and Configuration
- **Put task result docs in ./outputs**: If your task end up with md files that relate to your work progress, put them into that fixed folder (which is git ignored), so you don't commit temporary docs into git. 
- **Always keep tests up to date**: After code changes you always use tests to confirm your work. You make following tests in order: unit tests, Appium tests, real time mobile mcp tests. Each type of tests must pass in order to make subsequent tests.
- **Actively use Mobile MCP after major changes**: When working on the mobile app, always make unit and Appium tests, then go through your changes via mobile mcp to confirm your work. 
- **Always git commit your code at key points**: Use git proactively to record your progress when working on big changes. You are free to create branches, but remember to clean them off when done, I don't like dangling branches. You are welcome to squash commits when merging branches, I like clean, readable and relevant git history.
- **Expect a running backend api at localhost:3000**: When doing android mobile mcp tests, expect there's an avaialable localhost backend API. 

### Mobile MCP usage guideline
- When working on a mobile app, use mobile MCP to debug features that you are working on.
- When using mobile mcp for debugging, remember to check logs in various places for better awareness, including corresponding backend service logs.
- **Don't overly rely on screenshots for feedback. First check element list, then logs and other sources, only use screenshots when other methods aren't enough**.
- When taking mobile screenshot, always directly use ADB and scale down 50% with imagemagick, **don't use mobile mcp take screenshot tool**. 
- Before executing tap or click on elements, always confirm position with data from list element, don't use screenshot pixel position.

### Android Testing Commands
- **Run individual instrumented test**: `./gradlew connectedAndroidTest -Pandroid.testInstrumentationRunnerArguments.class=FULL_CLASS_NAME#TEST_METHOD_NAME`
- **Example**: `./gradlew connectedAndroidTest -Pandroid.testInstrumentationRunnerArguments.class=com.babelfeed.app.ui.screens.feed.FeedScreenInstrumentedTest#feedScreen_articleCards_showCorrectContent`
- **Run all tests in a class**: `./gradlew connectedAndroidTest -Pandroid.testInstrumentationRunnerArguments.class=FULL_CLASS_NAME`
- **Command location**: Must be run from Android app directory (apps/babel-android)

## Database Configuration

- When accessing DB make sure you are using the correct MCP. There are sqlite and postgresql mcps, this project's db is PostgreSQL
- Use the `mcp_dbhub-postgres-npx_execute_sql` tool for database operations
- Database connection details are configured via environment variables in each service

## Development Commands

### Primary Development
```bash
# Install dependencies (ALWAYS use Bun, never npm)
bun install

# Run both API backend and Android with hot reload in parallel
bun run dev

# Android development with hot reload (requires device/emulator)
bun run dev:android

# API development only
bun run dev:api
```

### Build Commands
```bash
# Build both API and Android app
bun run build

# Android builds (ARM64 only - macOS M4 development)
bun run build:android              # Debug build
bun run build:android:release      # Production release
bun run assemble:android           # Assemble APK only

# API build
bun run build:api

# Install APK to device
bun run install:android
```

### Testing Commands
```bash
# Run Android unit tests
bun run test:android

# Run E2E tests with Appium
bun run test:e2e
bun run test:e2e:dev

# Run Android lint checks
bun run lint:android

# Run all tests
bun run test:all
```

## Platform Specifications

### Build Targets
- **Primary**: Android ARM64 (aarch64) only
- **Development**: macOS M4 chip with Android emulator API level 30
- **No x86_64 or other architectures needed**

### Build Environments
- **Dev**: Android emulator with API level 30, debug build
- **Testing**: Unit tests with JUnit, E2E tests with Appium
- **Production**: ARM64 Android release build only

## Kotlin Android Best Practices

- **Jetpack Compose**: Use declarative UI patterns, avoid imperative View system
- **MVVM Architecture**: ViewModels for business logic, StateFlow for reactive data
- **Hilt Dependency Injection**: Use @Inject, @HiltViewModel, @AndroidEntryPoint
- **No nullable types**: Use proper Kotlin null safety practices
- **Material Design 3**: Follow latest Material Design guidelines
- **Coroutines**: Use suspend functions for async operations

## Code Quality Guidelines

- **Clean Architecture**: Separate data, domain, and presentation layers
- **Repository Pattern**: Abstract data sources behind repositories
- **Feature-Complete Components**: Mock API responses for incomplete backends
- **No Hard-Coded Data**: Use dynamic data binding with StateFlow
- **Build Verification**: Run `bun run build:android` to confirm code works

## State Management (MVVM + Compose)

- **ViewModels**: Handle UI-related data and business logic
- **StateFlow**: Reactive state management for UI
- **Compose State**: Use remember, rememberSaveable for local state
- **Navigation**: Jetpack Navigation Compose for screen transitions

## Environment Variables

- **ANDROID_HOME**: Path to Android SDK (/Users/pooh/Library/Android/sdk)
- **API_LEVEL=30**: Android API level for emulator/device

## Troubleshooting

### Common Issues
- **Build failures**: Check Android SDK path and Gradle configuration
- **Translation errors**: Check ML Kit Translation API setup and permissions
- **WebView issues**: Check JavaScript bridge and WebView permissions
- **Dependency injection**: Ensure proper Hilt annotations and modules

## Legal Compliance

### Content Handling
- **No Content Re-hosting**: App only aggregates links/summaries
- **Client-Side Translation**: All processing on user's device
- **Original Source**: Users view content from original publishers
- **UI Compliance**: Design must show content source clearly



