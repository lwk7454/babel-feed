# Babel Mobile - WebDriverIO Testing Setup

This guide covers how to set up and run WebDriverIO tests for the Babel Mobile app on Android emulator.

## Prerequisites

### 1. Android Development Environment
- **Android Studio** installed with Android SDK
- **Android emulator** set up and running
- **Java 8 or 11** installed
- **ANDROID_HOME** environment variable set

### 2. Node.js Dependencies
All required dependencies are already installed in the project:
- `@wdio/cli`
- `@wdio/appium-service`
- `appium` with `uiautomator2` driver

### 3. Tauri Development
- **Rust** installed
- **tauri-driver** installed: `cargo install tauri-driver`
- Android development initialized: `bun tauri android init` ✅

## Setup Instructions

### 1. Start Android Emulator
```bash
# List available AVDs
emulator -list-avds

# Start your preferred emulator (replace with your AVD name)
emulator -avd Pixel_7_API_30 &
```

### 2. Verify Emulator Connection
```bash
adb devices
```
You should see your emulator listed (usually as `emulator-5554`).

### 3. Build the Android APK
```bash
# From the project root
bun run build:mobile

# Or directly in babel-mobile directory
cd apps/babel-mobile
bun tauri android build
```

## Running Tests

### Option 1: Using npm scripts (Recommended)
```bash
# Run all e2e tests on Android
bun run test:e2e:


### Option 2: Using nx directly
```bash
# Run mobile e2e tests
nx run babel-mobile:e2e:

# Run specific test file
nx run babel-mobile:e2e --spec="**/webview-translation.spec.js"
```

### Option 3: Using WebDriverIO directly
```bash
cd apps/babel-mobile
bunx wdio run wdio.conf.js
```

## Test Configuration

### Mobile Configuration (`wdio.conf.js`)
- **Platform**: Android
- **Automation**: UiAutomator2
- **App Path**: `./src-tauri/target/release/bundle/android/babel-mobile.apk`
- **Emulator**: `emulator-5554` (default)
- **Appium Port**: 4723
- **Tauri Driver Port**: 4444

### Test Files
- **Location**: `apps/babel-mobile/e2e/specs/`
- **Main Test**: `webview-translation.spec.js`

## Troubleshooting

### Common Issues

1. **Emulator not detected**
   ```bash
   adb kill-server
   adb start-server
   adb devices
   ```

2. **APK build fails**
   - Ensure Android SDK is properly installed
   - Check ANDROID_HOME environment variable
   - Verify Java version (8 or 11)

3. **Appium connection issues**
   - Check if port 4723 is available
   - Restart Appium service
   - Verify UiAutomator2 driver is installed: `bunx appium driver list`

4. **Tauri driver issues**
   - Verify tauri-driver is installed: `tauri-driver --version`
   - Check if port 4444 is available

### Debug Mode
To run tests with more verbose logging:
```bash
WDIO_LOG_LEVEL=debug bun run test:e2e
```

## Test Development

### Adding New Tests
1. Create test files in `apps/babel-mobile/e2e/specs/`
2. Use mobile-specific selectors and timeouts
3. Handle webview context switching for web content testing

### Mobile-Specific Considerations
- Longer timeouts for mobile operations
- Context switching between NATIVE_APP and WEBVIEW
- Touch interactions instead of mouse clicks
- Screen size and orientation handling

## Architecture

The testing setup combines:
- **WebDriverIO** for test framework
- **Appium** for mobile automation
- **UiAutomator2** for Android element interaction
- **tauri-driver** for Tauri-specific webview testing

## CI/CD & Headless Testing

### Running Tests in CI
The project supports headless Android testing for CI pipelines:

```bash
# Set up headless Android environment
./scripts/setup-android-ci.sh

# Run tests in CI mode (headless)
CI=true bun run test:e2e:ci
```

### GitHub Actions
A complete GitHub Actions workflow is provided in `.github/workflows/android-e2e.yml` that:
- Sets up Android SDK and emulator
- Creates headless AVD
- Builds the APK  
- Runs tests in headless mode
- Uploads artifacts on failure

### Environment Variables for CI
- `CI=true` - Enables headless mode and CI-optimized timeouts
- `AVD_NAME` - Android Virtual Device name (default: `CI_Android_API_30`)
- `API_LEVEL` - Android API level (default: `30`)
- `ARCH` - Emulator architecture (default: `x86_64`)

### Docker Support
For containerized CI (like GitLab CI):
```dockerfile
FROM cimg/android:2023.12.1
# Android SDK and emulator already installed
RUN curl -fsSL https://bun.sh/install | bash
# ... rest of your setup
```

## Scripts Reference

| Script | Description |
|--------|-------------|
| `bun run test:e2e` | Run all mobile e2e tests |
| `bun run test:e2e:ci` | Run mobile tests in CI mode (headless) |
| `bun run build:mobile` | Build Android APK |
| `nx run babel-mobile:e2e` | Run mobile tests via nx |
| `./scripts/setup-android-ci.sh` | Set up headless Android environment for CI |

## Setup

### Android Development Setup

For Android builds, you need to configure Cargo with your system-specific NDK paths:

1. Copy the template file:
   ```bash
   cp .cargo/config.toml.template .cargo/config.toml
   ```

2. Update the paths in `.cargo/config.toml`:
   - Replace `$ANDROID_NDK_ROOT` with your actual NDK path
   - For macOS: usually `~/Library/Android/sdk/ndk/[VERSION]` 
   - For Linux: usually `~/Android/Sdk/ndk/[VERSION]`
   - Update `darwin-x86_64` to `linux-x86_64` on Linux systems

3. Example for macOS:
   ```toml
   [target.aarch64-linux-android]
   linker = "/Users/yourname/Library/Android/sdk/ndk/29.0.13113456/toolchains/llvm/prebuilt/darwin-x86_64/bin/aarch64-linux-android21-clang"
   ```

## Build

```bash
# Smart incremental build (default)
./scripts/build.sh

# Clean build
./scripts/build.sh --clean

# Release build  
./scripts/build.sh --release
```
