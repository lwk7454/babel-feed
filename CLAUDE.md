# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Babel Feed** is a native Android mobile application that breaks down language barriers by providing seamless access to global news and video content with integrated translation.

**For detailed project information, see**: `.cursor/rules/overview.mdc`

## Architecture & Development Principles

### Localization Requirements
- Given a user has a language selected, everything they see in the app should be in their language
- The app's primary purpose is to collect news from all sources and present them in the user's selected language

**For complete architecture details, see**: `.cursor/rules/overview.mdc`
**For development commands and guidelines, see**: `.cursor/rules/development-guidelines.mdc`
**For Android app screen specifications, see**: `.cursor/rules/app-screens.mdc`
**For testing strategy, see**: `.cursor/rules/testing.mdc`

### Product Features Documentation
**For translation system architecture, see**: `.cursor/rules/product-features/translation-architecture.mdc`
**For backend API contracts, see**: `.cursor/rules/product-features/assisted-translation-api.mdc`
**For user profile system, see**: `.cursor/rules/product-features/user-profile.mdc`
**For news aggregation service, see**: `.cursor/rules/product-features/news-aggregation-service.mdc`

## Hot Reload Development

### Android Hot Reload with Gradle Continuous Build
The `bun run dev:android` command provides hot reload functionality:

1. **Automatic Device Detection**: Checks for connected devices/emulators
2. **Initial Build & Install**: Builds and installs debug APK
3. **App Launch**: Automatically starts the app
4. **Continuous Rebuild**: Uses `gradle installDebug --continuous` to watch files
5. **Hot Reload**: Automatically rebuilds and reinstalls on file changes

### Prerequisites
```bash
# Start an emulator first (one-time setup)
emulator -list-avds                    # List available emulators
emulator -avd Pixel_6a_API_33 &         # Start emulator (replace with your AVD)

# Or connect a physical device with USB debugging enabled
```

### Hot Reload Features
- ✅ **File Watching**: Gradle monitors Kotlin, XML, and resource files
- ✅ **Incremental Builds**: Only rebuilds changed components
- ✅ **Auto Install**: Pushes updated APK to device automatically
- ✅ **Jetpack Compose**: UI changes reflect immediately
- ✅ **Graceful Shutdown**: Ctrl+C stops development mode cleanly

## Project Structure

```
apps/
├── babel-android/                   # Native Kotlin Android app
│   ├── app/
│   │   ├── src/main/kotlin/com/babelfeed/app/
│   │   │   ├── ui/
│   │   │   │   ├── screens/         # Feature screens (welcome, feed, article, profile, webview)
│   │   │   │   ├── components/      # Reusable Compose components
│   │   │   │   ├── theme/           # Material Design theme
│   │   │   │   └── navigation/      # Navigation setup
│   │   │   ├── data/
│   │   │   │   ├── models/          # Data models
│   │   │   │   ├── repository/      # Repository pattern
│   │   │   │   └── api/             # Retrofit API services
│   │   │   ├── translation/         # Translation system architecture
│   │   │   ├── webview/             # WebView integration with translation
│   │   │   ├── auth/                # Authentication management
│   │   │   ├── di/                  # Hilt dependency injection
│   │   │   ├── utils/               # Utility classes
│   │   │   ├── MainActivity.kt
│   │   │   └── BabelFeedApplication.kt
│   │   ├── src/main/res/            # Android resources (strings, themes)
│   │   ├── src/test/kotlin/         # Unit tests
│   │   └── src/androidTest/kotlin/  # Instrumented tests
│   ├── build.gradle.kts             # App module build config
│   ├── proguard-rules.pro
│   └── project.json                 # Nx project configuration
├── babel-api/                       # ElysiaJS backend services
│   ├── src/
│   │   ├── routes/                  # API routes (auth, articles, translation)
│   │   ├── services/                # Business logic services
│   │   ├── middleware/              # Auth, rate limiting, caching
│   │   ├── db/                      # Database schema and migrations
│   │   └── types/                   # TypeScript type definitions
│   └── project.json
└── news-aggregator/                 # Standalone news aggregation service
    ├── src/
    │   ├── aggregator.ts            # RSS feed aggregation
    │   ├── translator.ts            # OpenRouter translation integration
    │   ├── scheduler.ts             # Background job scheduling
    │   └── config.ts                # News source configuration
    └── README.md

tools/
├── appium-tests/                    # E2E testing framework
│   ├── configs/appium.config.js     # Appium configuration
│   ├── tests/                       # E2E test suites
│   ├── utils/                       # Test utilities and helpers
│   └── reports/                     # Generated test reports
└── nx-executors/                    # Custom Nx build executors
    ├── android-build/               # Android build orchestration
    └── android-test/                # Android test execution
```

## Development References

### Rules and Configuration
- **Source of truth for project overview and rules are in .cursor/rules/**: Key configuration and development guidelines are stored in this directory. Make sure you read them all before making any changes. When updating those files, make sure you follow the same mindset, that is, keep things short, only state business requirements, architecture decisions and concepts, don't add source code or anything that's implementation specific. These files need to stay true, and resilient to implementation changes.  
- **Always recursively check files and their headers under ./.cursor/rules/**: All files are .mdc with headers to guide when to read their contents. Read contents whenever they are relevant to the current work.
- **Put task result docs in ./outputs**: If your task end up with md files that relate to your work progress, put them into that fixed folder (which is git ignored), so you don't commit temporary docs into git. 
- **Always keep tests up to date**: You use tests to confirm your work. When you make code changes, always check if there are related tests. If necessary add new tests for key features. That would include unit and Appium tests. 
- **Actively use Mobile MCP after major changes**: When working on the mobile app, apart from unit and Appium tests, you should always go through your changes via mobile mcp to confirm your work. 
- **Always git commit your code at key points**: Use git proactively to record your progress when working on big changes. You are free to create branches, but remember to clean them off when done, I don't like dangling branches. You are welcome to squash commits when merging branches, I like clean, readable and relevant git history.

### Key Rule Files
- `.cursor/rules/overview.mdc` - Project mission, architecture, and features
- `.cursor/rules/development-guidelines.mdc` - Development commands and build guidelines
- `.cursor/rules/app-screens.mdc` - Android app screen flow specification (SOURCE OF TRUTH)
- `.cursor/rules/testing.mdc` - Comprehensive testing strategy
- `.cursor/rules/product-features/` - Feature-specific architecture and contracts:
  - `translation-architecture.mdc` - Translation system design
  - `assisted-translation-api.mdc` - Backend API contracts
  - `user-profile.mdc` - User profile system requirements
  - `news-aggregation-service.mdc` - News aggregation service architecture
- `.cursor/rules/infrastructure.mdc` - Infrastructure and deployment guidelines
- `.cursor/rules/nx-rules.mdc` - Complete Nx workspace guidelines

## Database Configuration

- When accessing DB make sure you are using the correct MCP. There are sqlite and postgresql mcps, this project's db is PostgreSQL
- Use the `mcp_dbhub-postgres-npx_execute_sql` tool for database operations
- Database connection details are configured via environment variables in each service