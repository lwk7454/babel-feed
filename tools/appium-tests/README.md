# 🧪 Babel Feed Automated Testing with Appium

This directory contains comprehensive automated testing for the Babel Feed Android WebView translation functionality using Appium.

## 🎯 Overview

The automated testing system provides:

- **WebView Translation Testing**: Comprehensive testing of translation functionality within Android WebViews
- **Self-Healing Mechanisms**: Intelligent error detection and automated recovery
- **Backend Integration**: Full API integration testing with the ElysiaJS backend
- **Continuous Testing**: Integration with development workflow for automated troubleshooting
- **Detailed Reporting**: Comprehensive test reports with analysis and recommendations

## 🚀 Quick Start

### Prerequisites

1. **Node.js 16+** and **Bun** installed
2. **Java 8+** installed and in PATH
3. **Android SDK** with ANDROID_HOME environment variable set
4. **Android emulator** or physical device available

### Setup

```bash
# 1. Install dependencies
bun install

# 2. Set up Appium environment
bun run setup

# 3. Verify environment
bun run doctor

# 4. Start Android emulator (if not already running)
emulator -avd Pixel_6_API_30 &

# 5. Build and install Babel Feed app
cd ../..
bun run build:android
bun run install:android

# 6. Start backend API
bun run dev:api &

# 7. Run automated tests
bun run test:appium
```

## 📋 Available Commands

```bash
# Core testing
bun run test:appium                 # Run all automated tests
bun run test:e2e                   # Build app, install, and test
bun run test:e2e:dev               # Start dev mode and test

# Environment management
bun run setup                      # Setup Appium environment
bun run doctor                     # Diagnose environment issues

# From project root
bun run test:appium                # Run Appium tests
bun run test:e2e                   # Full end-to-end testing
bun run test:e2e:dev               # Development mode testing
```

## 🏗️ Architecture

### Test Framework Structure

```
tools/appium-tests/
├── configs/
│   └── appium.config.js          # Appium configuration
├── tests/
│   └── webview-tester.js         # WebView testing framework
├── utils/
│   ├── self-healing.js           # Self-healing mechanisms
│   ├── emulator-manager.js       # Android emulator management
│   ├── backend-health.js         # Backend API health monitoring
│   └── reporter.js               # Test result reporting
├── reports/                      # Generated test reports
├── test.js                       # Main test runner
├── setup.js                      # Environment setup
├── doctor.js                     # Environment diagnostics
└── README.md                     # This file
```

### Key Components

#### 1. **WebView Tester** (`tests/webview-tester.js`)
- WebView context switching and detection
- Translation functionality testing
- Content extraction and injection verification
- Backend API integration testing

#### 2. **Self-Healing Manager** (`utils/self-healing.js`)
- Intelligent error classification
- Automated recovery strategies
- Context restoration and app restart
- Failure pattern analysis

#### 3. **Emulator Manager** (`utils/emulator-manager.js`)
- Automated emulator startup and management
- Health monitoring and diagnostics
- Screenshot and log collection
- APK installation and app data management

#### 4. **Backend Health Checker** (`utils/backend-health.js`)
- API endpoint health monitoring
- Performance testing and analysis
- Feature availability verification
- Connection diagnostics

#### 5. **Test Reporter** (`utils/reporter.js`)
- Comprehensive test result analysis
- Multiple report formats (HTML, JSON, Markdown)
- Failure pattern identification
- Performance insights and recommendations

## 🧪 Test Suites

### 1. WebView Context Tests
- `testWebViewContextSwitching`: Verify context switching between native app and WebView
- `testWebViewDetection`: Test WebView availability detection
- `testWebViewLoadTimeout`: Verify timeout handling for WebView loads

### 2. Translation Functionality Tests
- `testSimpleTranslation`: Basic translation functionality
- `testContextualTranslation`: Context-aware translation testing
- `testTechnicalTranslation`: Technical content translation
- `testBatchTranslation`: Multiple element translation

### 3. Backend Integration Tests
- `testBackendApiConnection`: API connectivity verification
- `testEmulatorModeDetection`: Emulator detection functionality
- `testStreamingTranslation`: Streaming translation testing
- `testErrorHandling`: Error condition handling

### 4. Self-Healing Tests
- `testFailureRecovery`: Recovery from common failures
- `testContextRecovery`: WebView context recovery
- `testApiRecovery`: API connection recovery

## 🔧 Configuration

### Appium Configuration (`configs/appium.config.js`)

Key configuration options:

```javascript
{
  capabilities: {
    'appium:platformName': 'Android',
    'appium:deviceName': 'Pixel_6_API_30',
    'appium:appPackage': 'com.babelfeed.app.debug',
    'appium:autoWebview': false,        // Manual WebView control
    'appium:newCommandTimeout': 600000  // 10 minute timeout
  },
  
  testConfig: {
    translationTimeout: 45000,          // 45 second translation timeout
    retryAttempts: 3,                   // Test retry attempts
    webviewDetectionTimeout: 15000      // WebView detection timeout
  },
  
  selfHealing: {
    enabled: true,
    maxHealingAttempts: 5,
    strategies: [
      'restart_app',
      'reset_webview_context',
      'restart_backend_api',
      'force_emulator_restart'
    ]
  }
}
```

### Backend Configuration

The tests connect to the backend API at `http://10.0.2.2:3000` (Android emulator localhost). Ensure the backend is running:

```bash
cd apps/babel-api
bun src/index.ts
```

## 📊 Test Reports

The system generates comprehensive reports in multiple formats:

### Report Types

1. **JSON Report** (`test-results-{timestamp}.json`)
   - Detailed test data for programmatic analysis
   - Complete test metadata and timing information

2. **HTML Report** (`test-results-{timestamp}.html`)
   - Interactive visual report with charts and tables
   - Easy-to-read test results and metrics

3. **Markdown Report** (`test-results-{timestamp}.md`)
   - Human-readable summary for documentation
   - Perfect for GitHub issues and documentation

4. **Analysis Report** (`test-analysis-{timestamp}.md`)
   - Detailed failure analysis and recommendations
   - Performance insights and optimization suggestions

### Report Location

All reports are saved to `tools/appium-tests/reports/` directory.

## 🔄 Self-Healing Mechanisms

The automated testing system includes intelligent self-healing capabilities:

### Error Classification

The system automatically classifies errors into categories:
- `webview_context_not_found`: WebView context issues
- `translation_timeout`: Translation operation timeouts
- `backend_api_unreachable`: API connectivity problems
- `dom_extraction_failed`: Content extraction failures
- `app_crash`: Application crashes

### Healing Strategies

Based on error classification, appropriate healing strategies are applied:

1. **Restart App**: Terminate and restart the Android application
2. **Reset WebView Context**: Force WebView context refresh
3. **Restart Backend API**: Attempt backend service recovery
4. **Clear App Data**: Reset application state completely
5. **Force Emulator Restart**: Full emulator restart (last resort)

### Healing Success Metrics

- **Healing Rate**: Percentage of failures successfully recovered
- **Strategy Effectiveness**: Success rate per healing strategy
- **Recovery Time**: Time taken for healing operations

## 🔍 Troubleshooting

### Common Issues

#### 1. Appium Connection Failures
```bash
# Check Appium server status
bun run doctor

# Restart Appium server
pkill -f appium
appium --port 4723 &
```

#### 2. Android Emulator Issues
```bash
# List available emulators
emulator -list-avds

# Start specific emulator
emulator -avd Pixel_6_API_30 &

# Check connected devices
adb devices
```

#### 3. WebView Context Problems
```bash
# Enable WebView debugging
adb shell am start -n com.babelfeed.app.debug/com.babelfeed.app.MainActivity
adb shell settings put global webview_multiprocess 0
```

#### 4. Backend API Connectivity
```bash
# Test API directly
curl http://localhost:3000/health

# Check from Android emulator perspective
curl http://10.0.2.2:3000/health
```

### Diagnostic Tools

1. **Environment Doctor**: `bun run doctor`
   - Comprehensive environment diagnostics
   - Detailed issue identification and recommendations

2. **Setup Verification**: `bun run setup`
   - Automated environment setup and verification
   - Appium server and driver installation

3. **Test Reports**: Check `reports/` directory
   - Detailed failure analysis and patterns
   - Performance metrics and recommendations

## 📈 Performance Benchmarks

### Expected Performance

- **Simple translations**: < 5 seconds
- **Contextual translations**: < 15 seconds
- **Technical translations**: < 25 seconds
- **WebView context switching**: < 3 seconds
- **Self-healing operations**: < 30 seconds

### Success Criteria

- **Overall success rate**: ≥ 80%
- **Self-healing effectiveness**: ≥ 70%
- **API response time**: < 30 seconds
- **Test execution time**: < 10 minutes total

## 🚀 Integration with CI/CD

### GitHub Actions Integration

The automated tests can be integrated with GitHub Actions for continuous testing:

```yaml
# .github/workflows/android-tests.yml
name: Android Automated Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: oven-sh/setup-bun@v1
      - name: Setup Android Emulator
        uses: reactivecircus/android-emulator-runner@v2
        with:
          api-level: 30
          script: bun run test:e2e
```

### Development Workflow Integration

For continuous development testing:

```bash
# Start development mode with automated testing
bun run test:e2e:dev

# This will:
# 1. Start the Android app in development mode
# 2. Monitor for changes
# 3. Run automated tests on updates
# 4. Generate reports and recommendations
```

## 🤝 Contributing

### Adding New Tests

1. Create test methods in `tests/webview-tester.js`
2. Follow the naming convention: `test{Feature}{Scenario}`
3. Return result objects with `success`, `duration`, and error details
4. Add appropriate error handling and timeouts

### Extending Self-Healing

1. Add new error patterns to `utils/self-healing.js`
2. Implement healing strategies for new failure modes
3. Update error classification logic
4. Test healing effectiveness

### Improving Reports

1. Extend `utils/reporter.js` with new analysis
2. Add performance metrics and insights
3. Create custom report formats as needed
4. Include actionable recommendations

## 📚 Further Reading

- [Appium Documentation](http://appium.io/docs/en/2.1/)
- [WebDriverIO Guide](https://webdriver.io/docs/gettingstarted)
- [Android Testing Best Practices](https://developer.android.com/training/testing)
- [Babel Feed Translation Architecture](../../.cursor/rules/babel-android/translation-implementation-plan.md)

---

**This automated testing system enables Claude Code to continuously test and fix WebView translation functionality without human intervention, providing a robust foundation for maintaining application quality.**