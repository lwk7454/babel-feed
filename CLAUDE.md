# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Babel Feed** is a native Android mobile application that breaks down language barriers by providing seamless access to global news and video content with integrated, on-device translation.

### Core Mission
Create a native mobile app that allows users to discover, consume, and understand global news articles and video content, with integrated client-side translation processing.

### Target Audience
- **Primary**: Mandarin Chinese speakers accessing global content
- **Secondary**: Japanese speakers, English speakers consuming Chinese/Japanese content
- **Demographic**: Tech-savvy users interested in diverse global perspectives

## Architecture

### Monorepo Structure (Nx 21.1.2)
- **apps/babel-android/**: Native Kotlin Android app with Jetpack Compose UI
- **apps/babel-api/**: ElysiaJS backend services with type-safe API
- **tools/nx-executors/**: Custom Nx executors for Android build orchestration
- **Package Manager**: Bun (not npm)
- **Build System**: Nx orchestrating TypeScript backend + Gradle for Android

### Key Technologies
- **Mobile Framework**: Native Kotlin Android with Jetpack Compose
- **UI Framework**: Jetpack Compose with Material Design 3
- **Backend**: ElysiaJS with type-safe API integration
- **State Management**: MVVM pattern with ViewModels and StateFlow
- **Translation**: On-device ML Kit Translation (client-side only)
- **HTTP Client**: Retrofit + OkHttp for API communication
- **Dependency Injection**: Hilt (Dagger-based)

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

### Testing
```bash
# Run Android unit tests
bun run test:android

# Run Android lint checks
bun run lint:android

# Run all tests
bun run test:all
```

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
emulator -avd Pixel_6_API_30 &         # Start emulator (replace with your AVD)

# Or connect a physical device with USB debugging enabled
```

### Hot Reload Features
- ✅ **File Watching**: Gradle monitors Kotlin, XML, and resource files
- ✅ **Incremental Builds**: Only rebuilds changed components
- ✅ **Auto Install**: Pushes updated APK to device automatically
- ✅ **Jetpack Compose**: UI changes reflect immediately
- ✅ **Graceful Shutdown**: Ctrl+C stops development mode cleanly

## Build System Specifications

### Platform Targets
- **Primary**: Android ARM64 (aarch64) only
- **Development**: macOS M4 chip with Android emulator API level 30
- **No x86_64 or other architectures needed**

### Build Environments
- **Dev**: Android emulator with API level 30, debug build
- **Testing**: Unit tests with JUnit, UI tests with Espresso
- **Production**: ARM64 Android release build only

## Core Features

### Native Android App Features
- **News Feed Display**: LazyColumn with Jetpack Compose, aggregated content
- **Content Summary Pages**: Article previews with Material Design components
- **External Website WebView**: Android WebView with JavaScript bridge
- **Translation System**: ML Kit Translation API for on-device processing
- **Dual WebView Architecture**: Main app navigation + external content viewing
- **MVVM Architecture**: ViewModels, StateFlow, and Compose integration

### Backend API Features
- **ElysiaJS Framework**: Type-safe API endpoints
- **Retrofit Integration**: HTTP client for Android app communication
- **Content Aggregation**: News and video content sources

## Translation Architecture

### Client-Side Processing
- **ML Kit Translation**: All translation processing occurs locally on Android device
- **HTML Content Extraction**: Extract text from WebView using JavaScript
- **Content Injection**: Inject translated content back to WebView
- **Legal Compliance**: No server-side content re-hosting

### Supported Languages
- English (en)
- Chinese Simplified (zh-CN)
- Chinese Traditional (zh-TW)  
- Japanese (ja)

## Development Guidelines

### Kotlin Android Best Practices
- **Jetpack Compose**: Use declarative UI patterns, avoid imperative View system
- **MVVM Architecture**: ViewModels for business logic, StateFlow for reactive data
- **Hilt Dependency Injection**: Use @Inject, @HiltViewModel, @AndroidEntryPoint
- **No nullable types**: Use proper Kotlin null safety practices
- **Material Design 3**: Follow latest Material Design guidelines
- **Coroutines**: Use suspend functions for async operations

### Code Quality
- **Clean Architecture**: Separate data, domain, and presentation layers
- **Repository Pattern**: Abstract data sources behind repositories
- **Feature-Complete Components**: Mock API responses for incomplete backends
- **No Hard-Coded Data**: Use dynamic data binding with StateFlow
- **Build Verification**: Run `bun run build:android` to confirm code works

### State Management (MVVM + Compose)
- **ViewModels**: Handle UI-related data and business logic
- **StateFlow**: Reactive state management for UI
- **Compose State**: Use remember, rememberSaveable for local state
- **Navigation**: Jetpack Navigation Compose for screen transitions

## WebView Architecture

### Dual WebView System
- **Main App**: Jetpack Compose UI with navigation and translation controls
- **External Content WebView**: Android WebView for original website content

### Translation Integration
- **Content Extraction**: JavaScript injection to extract HTML from WebView
- **Translation Processing**: ML Kit Translation API on Android device
- **Content Injection**: Modified translated content injected back to WebView
- **Native Integration**: Direct Android API integration, no cross-platform layer

## File Structure

```
apps/babel-android/
├── app/
│   ├── src/main/kotlin/com/babelfeed/app/
│   │   ├── ui/
│   │   │   ├── screens/         # Feature screens (feed, article, webview)
│   │   │   ├── components/      # Reusable Compose components
│   │   │   ├── theme/           # Material Design theme
│   │   │   └── navigation/      # Navigation setup
│   │   ├── data/
│   │   │   ├── models/          # Data models
│   │   │   ├── repository/      # Repository pattern
│   │   │   └── api/             # Retrofit API services
│   │   ├── di/                  # Hilt dependency injection
│   │   ├── MainActivity.kt
│   │   └── BabelFeedApplication.kt
│   ├── src/main/res/            # Android resources (strings, themes)
│   ├── src/test/kotlin/         # Unit tests
│   └── src/androidTest/kotlin/  # Instrumented tests
├── build.gradle.kts             # App module build config
├── proguard-rules.pro
└── project.json                 # Nx project configuration
├── build.gradle.kts             # Project-level build config
├── settings.gradle.kts
├── gradle.properties
├── gradlew                      # Gradle wrapper script
└── gradle/wrapper/              # Gradle wrapper files

tools/nx-executors/
├── android-build/               # Custom Nx build executors
└── android-test/                # Custom Nx test executors
```

## Nx Workspace Guidelines

### Using Nx Tools
- Use `nx_workspace` tool for workspace understanding
- Use `nx_docs` tool for configuration questions
- Use `nx_generators` tool for code generation
- Use `nx_visualize_graph` tool for dependency visualization

### Task Management
- Use `nx run <taskId>` for task execution
- Check `nx_current_running_tasks_details` for task status
- Use `nx_current_running_task_output` for task debugging

## Troubleshooting

### Common Issues
- **Build failures**: Check Android SDK path and Gradle configuration
- **Translation errors**: Verify ML Kit Translation API setup and permissions
- **WebView issues**: Check JavaScript bridge and WebView permissions
- **Dependency injection**: Ensure proper Hilt annotations and modules

### Android Studio Hot Reload Issues
If "Apply Code Changes" fails with "R+ Device should have FULL debugger swap support":

**Workaround Options:**
1. **Use "Apply Changes and Restart Activity" instead of "Apply Code Changes"**
2. **Manual restart**: Stop app and run again instead of hot reload
3. **Check device compatibility**: Some emulators/devices don't support full hot reload
4. **Gradle configuration**: Project has optimized debug build settings:
   - `android.enableR8.fullMode=false` - Disables R8 full mode optimizations
   - `android.useFullClasspathForDexingTransform=true` - Better dexing compatibility
   - Debug build type disables minification and resource shrinking

**Build Settings Applied:**
- R8 optimizations disabled for debug builds
- Resource shrinking disabled
- ProGuard files cleared for debug
- Explicit debug configuration in `gradle.properties`

### Environment Variables
- **ANDROID_HOME**: Path to Android SDK (/Users/pooh/Library/Android/sdk)
- **API_LEVEL=30**: Android API level for emulator/device

## Legal Compliance

### Content Handling
- **No Content Re-hosting**: App only aggregates links/summaries
- **Client-Side Translation**: All processing on user's device
- **Original Source**: Users view content from original publishers
- **UI Compliance**: Design must show content source clearly

## Development References

### Rules and Configuration
- **Source of truth for project overview and rules are in .cursor/rules/**: Key configuration and development guidelines are stored in this directory

## Tauri 2 Configuration Notes
- Make sure you use correct configuration and APIs from Tauri 2, not Tauri 1.