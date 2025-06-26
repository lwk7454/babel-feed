/**
 * Appium Capabilities Configuration
 * Clean, focused configuration for Android testing
 */

export interface AppiumCapabilities {
  'appium:platformName': string;
  'appium:platformVersion': string;
  'appium:deviceName': string;
  'appium:automationName': string;
  'appium:appPackage': string;
  'appium:appActivity': string;
  'appium:autoGrantPermissions': boolean;
  'appium:noReset': boolean;
  'appium:fullReset': boolean;
  'appium:newCommandTimeout': number;
  'appium:androidInstallTimeout': number;
  'appium:autoWebview': boolean;
  'appium:webviewConnectTimeout': number;
  'appium:ensureWebviewsHavePages': boolean;
  'appium:systemPort': number;
  'appium:skipServerInstallation': boolean;
  'appium:skipDeviceInitialization': boolean;
  'appium:ignoreUnimportantViews': boolean;
}

export const getCapabilities = (): AppiumCapabilities => ({
  'appium:platformName': 'Android',
  'appium:platformVersion': '16',
  'appium:deviceName': 'emulator-5554',
  'appium:automationName': 'UiAutomator2',
  'appium:appPackage': 'com.babelfeed.app.debug',
  'appium:appActivity': 'com.babelfeed.app.MainActivity',
  'appium:autoGrantPermissions': true,
  'appium:noReset': false,
  'appium:fullReset': false,
  'appium:newCommandTimeout': 600000, // 10 minutes
  'appium:androidInstallTimeout': 120000, // 2 minutes
  
  // WebView specific capabilities
  'appium:autoWebview': false,
  'appium:webviewConnectTimeout': 30000,
  'appium:ensureWebviewsHavePages': true,
  
  // Debug and troubleshooting
  'appium:systemPort': 8200,
  'appium:skipServerInstallation': false,
  'appium:skipDeviceInitialization': false,
  'appium:ignoreUnimportantViews': false
});

export const appiumConfig = {
  host: 'localhost',
  port: 4723,
  path: '/',
  logLevel: 'info' as const,
  capabilities: getCapabilities()
};