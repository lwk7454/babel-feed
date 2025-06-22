# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Babel Feed** is a native Android mobile application that breaks down language barriers by providing seamless access to global news and video content with integrated translation.

**For detailed project information, see**: `.cursor/rules/overview.mdc`

## Architecture & Development

**For complete architecture details, see**: `.cursor/rules/overview.mdc`
**For development commands and guidelines, see**: `.cursor/rules/development.mdc`
**For translation system architecture, see**: `.cursor/rules/babel-android/translation-architecture.mdc`
**For backend API contracts, see**: `.cursor/rules/babel-android/assisted-translation-api.mdc`
**For testing strategy, see**: `.cursor/rules/testing.mdc`

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

tools/appium-tests/              # E2E testing framework
├── configs/appium.config.js     # Appium configuration
├── tests/webview-tester.js      # WebView translation tests
├── utils/                       # Self-healing and state inspection
├── test.js                      # Main test runner
└── reports/                     # Generated test reports

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

## Development References

### Rules and Configuration
- **Source of truth for project overview and rules are in .cursor/rules/**: Key configuration and development guidelines are stored in this directory. Make sure you read them all before making any changes. When updating those files, make sure you follow the same mindset, that is, keep things short, only state business requirements, architecture decisions and concepts, don't add source code or anything that's implementation specific. These files need to be stay true, and resilient to implementation changes.  
- **The year is 2025**: Keep that in mind when doing web search.
- **Always recursively check files and their headers under ./.cursor/rules/**: All files are .mdc with headers to guide when to read their contents. Read contents whenever they are relevant to the current work.
- **Put task result docs in ./outputs**: If your task results in md files that conclude what you've done, put them into that fixed folder (which is git ignored), so you don't commit temporary docs into git. 

### Key Rule Files
- `.cursor/rules/overview.mdc` - Project mission, architecture, and features
- `.cursor/rules/development.mdc` - Development commands and guidelines
- `.cursor/rules/testing.mdc` - Comprehensive testing strategy
- `.cursor/rules/babel-android/` - Android-specific architecture and API contracts
- `.cursor/rules/nx-rules.mdc` - Complete Nx workspace guidelines
