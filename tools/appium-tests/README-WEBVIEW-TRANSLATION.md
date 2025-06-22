# WebView Translation Test Suite

This comprehensive test suite validates the end-to-end WebView translation functionality in the Babel Feed Android application, ensuring robust translation features work correctly across various scenarios.

## Overview

The WebView Translation Test Suite provides thorough testing of:

- **Core Translation Functionality**: Basic enable/disable, content translation verification
- **Dynamic Content Translation**: Real-time translation of dynamically loaded content
- **Navigation Translation**: Translation persistence across page navigation
- **Error Handling**: Network failures, timeouts, invalid content scenarios
- **Performance**: Large content translation, caching, multiple language pairs
- **User Experience**: Complete news article flows, accessibility features

## Test Architecture

### Key Components

1. **`webview-translation.test.js`** - Main test suite with comprehensive scenarios
2. **`webview-translation-tester.js`** - Utility class providing translation testing methods
3. **`run-webview-translation-tests.sh`** - Automated test runner with environment setup
4. **Configuration** - Extended Appium configuration for WebView testing

### Test Coverage

#### Core Translation Tests (5 tests)
- ✅ Basic translation enable/disable functionality
- ✅ Translation loading indicators and status feedback
- ✅ Translation toggle state management
- ✅ Content verification and preservation
- ✅ Error state handling

#### Dynamic Translation Tests (3 tests)
- ✅ Real-time content translation
- ✅ DOM mutation detection and translation
- ✅ Progressive loading and infinite scroll translation

#### Navigation Tests (3 tests)
- ✅ Cross-page translation persistence
- ✅ URL navigation translation maintenance
- ✅ Embedded content and iframe translation

#### Error Handling Tests (3 tests)
- ✅ Network failure recovery
- ✅ API timeout handling
- ✅ Invalid/edge-case content processing

#### Performance Tests (3 tests)
- ✅ Large content translation performance
- ✅ Multiple language pair support
- ✅ Translation caching efficiency

#### End-to-End Tests (3 tests)
- ✅ Complete news article translation flow
- ✅ Multiple articles in sequence
- ✅ Accessibility features support

## Quick Start

### Prerequisites

1. **Android Development Environment**
   ```bash
   # Ensure Android SDK and emulator are installed
   echo $ANDROID_HOME  # Should be set
   adb --version       # Should work
   emulator -list-avds # Should show available AVDs
   ```

2. **Node.js and Dependencies**
   ```bash
   cd tools/appium-tests
   bun install
   # or npm install
   ```

3. **Appium Setup**
   ```bash
   # Install Appium globally
   npm install -g appium@latest
   
   # Install required drivers
   appium driver install uiautomator2
   
   # Verify installation
   appium driver list --installed
   ```

### Running Tests

#### Method 1: Automated Script (Recommended)
```bash
# Run complete test suite with automatic setup
cd tools/appium-tests
./scripts/run-webview-translation-tests.sh

# With options
HEADLESS=false VERBOSE=true ./scripts/run-webview-translation-tests.sh
```

#### Method 2: Manual Test Execution
```bash
# 1. Start emulator
emulator -avd Pixel_6a_API_33 &

# 2. Start backend API (from project root)
cd ../../
bun run dev:api &

# 3. Start Appium server
cd tools/appium-tests
appium --port 4723 &

# 4. Run tests
bun run test:webview-translation

# 5. Watch mode for development
bun run test:webview-translation:watch
```

#### Method 3: Individual Test Scenarios
```bash
# Run specific test groups
bun run test:webview-translation --grep "Core Translation"
bun run test:webview-translation --grep "Dynamic Content"
bun run test:webview-translation --grep "Navigation"
bun run test:webview-translation --grep "Error Handling"
```

## Test Configuration

### Environment Variables

```bash
# Test behavior
export HEADLESS=true           # Run emulator headless (default: true)
export VERBOSE=true            # Verbose logging (default: false)
export TEST_TIMEOUT=600        # Test timeout in seconds (default: 600)

# Emulator settings
export EMULATOR_NAME=Pixel_6a_API_33  # AVD name (default: Pixel_6a_API_33)

# API settings
export BACKEND_URL=http://localhost:3000  # Backend API URL
```

### Appium Configuration

The test suite extends the base Appium configuration with WebView-specific settings:

```javascript
// WebView specific capabilities
'appium:autoWebview': false,
'appium:webviewConnectTimeout': 30000,
'appium:ensureWebviewsHavePages': true,

// Test timeouts
translationTimeout: 45000,      // Max time for translation
webviewDetectionTimeout: 15000, // Max time to detect WebView
apiHealthTimeout: 10000,        // Backend health check timeout
```

## Test Scenarios

### Core Translation Functionality

**Basic Translation Enable**
- Navigate to news article
- Enable translation toggle
- Verify content is translated
- Verify original content preserved
- Validate translation status indicators

**Translation Toggle States**
- Test enable → disable → re-enable cycle
- Verify content restoration consistency
- Validate state persistence

### Dynamic Content Translation

**Real-time Translation**
- Enable dynamic translation mode
- Trigger dynamic content loading
- Verify new content auto-translation
- Check translation consistency

**DOM Mutation Handling**
- Monitor DOM changes via MutationObserver
- Verify new elements are detected
- Validate automatic translation triggers

### Navigation Translation

**Cross-page Persistence**
- Enable translation on page A
- Navigate to page B
- Verify translation state maintained
- Check content translation on new page

**URL Navigation**
- Test link clicks with URL changes
- Verify browser back/forward behavior
- Validate translation across navigation

### Error Handling

**Network Failures**
- Simulate network disconnection
- Verify graceful error handling
- Test automatic recovery

**API Timeouts**
- Test with large content triggering timeouts
- Verify timeout handling
- Validate retry mechanisms

### Performance Validation

**Large Content**
- Test translation on very long articles
- Monitor memory usage and response times
- Verify UI remains responsive

**Caching Efficiency**
- Measure first-time vs cached translation speed
- Verify cache consistency
- Test cache invalidation

## Test Reports and Debugging

### Generated Reports

The test suite generates comprehensive reports in `tools/appium-tests/reports/`:

```
reports/
├── webview-translation-report-{timestamp}.json  # Detailed test results
├── test-summary-{timestamp}.md                  # Human-readable summary
├── screenshots/                                 # Failure screenshots
│   ├── failed-{test-name}-{timestamp}.png
│   └── ...
├── test.log                                     # Complete test log
├── backend.log                                  # Backend API log
├── appium.log                                   # Appium server log
└── emulator.log                                 # Emulator output
```

### Report Structure

**JSON Report Example:**
```json
{
  "summary": {
    "total": 20,
    "passed": 18,
    "failed": 2,
    "successRate": 90,
    "duration": 300000
  },
  "details": [
    {
      "test": "Basic Translation Enable",
      "status": "PASSED",
      "duration": 15000
    }
  ],
  "performance": {
    "averageTranslationTime": 8500,
    "memoryUsage": [100, 120, 110],
    "uiResponseTimes": [200, 150, 180]
  }
}
```

### Debugging Failed Tests

1. **Check Screenshots**: Look in `reports/screenshots/` for visual debugging
2. **Review Logs**: Examine `test.log` for detailed execution logs
3. **Backend Issues**: Check `backend.log` for API-related problems
4. **Appium Issues**: Review `appium.log` for driver/connection problems

## Development and Customization

### Adding New Test Scenarios

1. **Extend the main test file:**
   ```javascript
   // In webview-translation.test.js
   describe('New Test Category', () => {
     it('should test new functionality', async () => {
       await runTranslationTest('New Test', async () => {
         // Test implementation
       });
     });
   });
   ```

2. **Add helper methods:**
   ```javascript
   // In webview-translation-tester.js
   async newTestMethod() {
     // Helper implementation
   }
   ```

### Custom Test Configuration

Create a custom configuration file:

```javascript
// custom-config.js
import { getAppiumConfig } from './configs/appium.config.js';

const config = getAppiumConfig();
config.testConfig.translationTimeout = 60000; // Custom timeout
config.capabilities['appium:deviceName'] = 'custom-device';

export default config;
```

### Continuous Integration

The test suite is designed for CI environments:

```yaml
# GitHub Actions example
- name: Run WebView Translation Tests
  run: |
    cd tools/appium-tests
    HEADLESS=true CI=true ./scripts/run-webview-translation-tests.sh
  timeout-minutes: 15
```

## Troubleshooting

### Common Issues

**Emulator Won't Start**
```bash
# Check available AVDs
emulator -list-avds

# Verify ANDROID_HOME
echo $ANDROID_HOME

# Check disk space
df -h
```

**WebView Context Not Found**
- Ensure app is using WebView (not custom browser)
- Check if chromedriver is installed and compatible
- Verify WebView debugging is enabled in app

**Translation Not Working**
- Check backend API health: `curl http://localhost:3000/health`
- Verify app translation toggle is accessible
- Check network connectivity between app and API

**Tests Timing Out**
- Increase timeout values in configuration
- Check system performance and resource usage
- Verify emulator performance settings

### Performance Optimization

**For Faster Test Execution:**
- Use SSD storage for emulator AVD
- Allocate more RAM to emulator (4GB+)
- Use hardware acceleration (Intel HAXM/AMD)
- Run tests on powerful hardware

**For CI Environments:**
- Use headless mode (`HEADLESS=true`)
- Reduce timeout values
- Parallel test execution where possible

## Contributing

When contributing to the test suite:

1. **Follow Test Structure**: Use `runTranslationTest()` wrapper for consistency
2. **Add Documentation**: Update this README for new test scenarios
3. **Include Error Handling**: All tests should handle failures gracefully
4. **Performance Consideration**: Monitor test execution time and resource usage
5. **Cross-platform Testing**: Ensure tests work on different Android versions

## Support

For issues with the WebView Translation Test Suite:

1. Check existing test reports in `reports/` directory
2. Review troubleshooting section above
3. Examine logs for specific error patterns
4. Create detailed issue reports with logs and screenshots

The test suite is designed to be robust and self-healing, but may require adjustment for different Android versions, devices, or application changes.