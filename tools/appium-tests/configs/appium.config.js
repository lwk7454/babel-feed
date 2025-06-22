/**
 * Appium Configuration for Babel Feed Translation System Testing
 * 
 * This configuration file sets up automated testing for the Android app
 * with focus on WebView translation functionality and self-healing mechanisms.
 */

export const appiumConfig = {
  // Server Configuration
  server: {
    host: 'localhost',
    port: 4723,
    path: '/',
    logLevel: 'info'
  },

  // Environment Detection
  environment: {
    isCI: process.env.CI === 'true' || process.env.GITHUB_ACTIONS === 'true',
    isLocal: !process.env.CI,
    headless: process.env.HEADLESS !== 'false', // Default to headless, set HEADLESS=false for headed mode
    verboseLogging: process.env.VERBOSE === 'true'
  },

  // Android Capabilities
  capabilities: {
    'appium:platformName': 'Android',
    'appium:platformVersion': '16',
    'appium:deviceName': 'emulator-5554',
    'appium:automationName': 'UiAutomator2',
    'appium:appPackage': 'com.babelfeed.app.debug',
    'appium:appActivity': 'com.babelfeed.app.MainActivity',
    'appium:autoGrantPermissions': true,
    'appium:noReset': false,
    'appium:fullReset': false,
    'appium:newCommandTimeout': 600, // 10 minutes for longer operations
    'appium:androidInstallTimeout': 120000, // 2 minutes for app installation
    
    // WebView specific capabilities
    'appium:chromedriverExecutable': '/usr/local/bin/chromedriver',
    'appium:autoWebview': false, // Manual webview switching for better control
    'appium:webviewConnectTimeout': 30000,
    'appium:ensureWebviewsHavePages': true,
    
    // Debug and troubleshooting
    'appium:systemPort': 8200,
    'appium:skipServerInstallation': false,
    'appium:skipDeviceInitialization': false,
    'appium:ignoreUnimportantViews': false // Needed for webview debugging
  },

  // Test Configuration
  testConfig: {
    // Maximum time to wait for translation to complete
    translationTimeout: 45000, // 45 seconds
    
    // Retry configuration for flaky tests
    retryAttempts: 3,
    retryDelay: 2000, // 2 seconds between retries
    
    // WebView detection timeout
    webviewDetectionTimeout: 15000, // 15 seconds
    
    // Backend API health check timeout  
    apiHealthTimeout: 10000, // 10 seconds
    
    // Screenshots and debugging
    screenshotOnFailure: true,
    savePageSource: true,
    logLevel: 'debug'
  },

  // Self-healing configuration
  selfHealing: {
    enabled: true,
    maxHealingAttempts: 5,
    
    // Common healing strategies
    strategies: [
      'restart_app',
      'clear_app_data', 
      'reset_webview_context',
      'restart_backend_api',
      'force_emulator_restart'
    ],
    
    // Error patterns that trigger healing
    healingTriggers: [
      'webview_context_not_found',
      'translation_timeout',
      'backend_api_unreachable',
      'dom_extraction_failed',
      'injection_failed'
    ]
  },

  // Backend API configuration
  backendApi: {
    baseUrl: 'http://localhost:3000', // Use localhost for development
    endpoints: {
      health: '/health',
      translate: '/api/translation/translate',
      stream: '/api/translation/stream'
    },
    timeout: 10000 // 10 seconds
  },

  // Emulator management
  emulator: {
    name: 'Pixel_6a_API_33',
    port: 5554,
    autoStart: true,
    bootTimeout: 120000, // 2 minutes boot time
    
    // Commands for emulator management
    commands: {
      start: 'emulator -avd Pixel_6a_API_33 -port 5554 -no-snapshot-save &',
      stop: 'adb -s emulator-5554 emu kill',
      isRunning: 'adb devices | grep emulator-5554'
    }
  },

  // Test data
  testData: {
    translations: {
      simple: {
        en: 'Settings',
        'zh-cn': '设置'
      },
      contextual: {
        en: 'Welcome to our global news platform providing real-time updates',
        'zh-cn': '欢迎来到我们的全球新闻平台，提供实时更新'
      },
      technical: {
        en: 'Initialize database connection pool with timeout configuration',
        'zh-cn': '初始化数据库连接池并配置超时设置'
      }
    },

    // Test URLs for webview testing
    testUrls: [
      'https://example.com',
      'https://news.ycombinator.com',
      'https://www.bbc.com/news'
    ]
  }
};

/**
 * Get configuration based on environment
 */
export function getAppiumConfig() {
  const config = { ...appiumConfig };
  
  // Adjust configuration based on environment
  if (config.environment.isCI) {
    // CI environment optimizations
    config.testConfig.retryAttempts = 2; // Fewer retries in CI
    config.testConfig.translationTimeout = 30000; // Shorter timeouts
    config.emulator.autoStart = false; // Assume emulator is already running in CI
    config.selfHealing.maxHealingAttempts = 3; // Fewer healing attempts
    config.server.logLevel = 'warn'; // Less verbose logging
  }
  
  if (config.environment.headless) {
    // Headless mode settings
    config.testConfig.screenshotOnFailure = true;
    config.testConfig.savePageSource = true;
  } else {
    // Headed mode for local development
    config.testConfig.screenshotOnFailure = false; // User can see the screen
  }
  
  if (config.environment.verboseLogging) {
    config.server.logLevel = 'debug';
    config.testConfig.logLevel = 'debug';
  }
  
  return config;
}

export default appiumConfig;