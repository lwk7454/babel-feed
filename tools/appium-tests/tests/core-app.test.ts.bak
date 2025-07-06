/**
 * Core App Tests
 * Basic connectivity and app startup functionality
 */

import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { DriverManager } from '../src/driver-manager.js';
import { AppNavigation } from '../src/helpers/index.js';

describe('Core App Functionality', () => {
  let driverManager: DriverManager;
  let driver: WebdriverIO.Browser;
  let navigation: AppNavigation;

  beforeAll(async () => {
    driverManager = new DriverManager();
    
    // Start services
    await driverManager.startAppiumServer();
    await driverManager.startBackendService();
    
    // Create driver
    driver = await driverManager.createDriver();
    navigation = new AppNavigation(driver);
  });

  afterAll(async () => {
    await driverManager.stopServices();
  });

  test('should launch app successfully', async () => {
    console.log('🚀 Testing app launch...');
    
    // Check that app is running
    const activity = await navigation.getCurrentActivity();
    expect(activity).toContain('MainActivity');
    
    // Take screenshot for verification
    await navigation.takeScreenshot('app-launch-success');
    
    console.log('✅ App launched successfully');
  });

  test('should display welcome screen for new users', async () => {
    console.log('👋 Testing welcome screen...');
    
    // Wait for welcome screen elements
    await navigation.waitForScreen('Welcome', 15000);
    
    // Check for language carousel
    const hasLanguageSelector = await navigation.isElementDisplayed('//*[contains(@text, "Language") or contains(@content-desc, "Language")]');
    expect(hasLanguageSelector).toBe(true);
    
    console.log('✅ Welcome screen displayed correctly');
  });

  test('should handle app background and foreground', async () => {
    console.log('🔄 Testing app lifecycle...');
    
    // Background the app
    await driver.background(2000); // 2 seconds
    
    // Bring app back to foreground
    await driver.activateApp('com.babelfeed.app.debug');
    
    // Verify app is still functional
    const activity = await navigation.getCurrentActivity();
    expect(activity).toContain('MainActivity');
    
    console.log('✅ App lifecycle handled correctly');
  });

  test('should handle device rotation', async () => {
    console.log('🔄 Testing device rotation...');
    
    // Get initial orientation
    const initialOrientation = await driver.getOrientation();
    console.log(`Initial orientation: ${initialOrientation}`);
    
    // Rotate device
    const newOrientation = initialOrientation === 'PORTRAIT' ? 'LANDSCAPE' : 'PORTRAIT';
    await driver.setOrientation(newOrientation);
    
    // Wait for rotation to complete
    await driver.pause(2000);
    
    // Verify orientation changed
    const currentOrientation = await driver.getOrientation();
    expect(currentOrientation).toBe(newOrientation);
    
    // Rotate back
    await driver.setOrientation(initialOrientation);
    
    console.log('✅ Device rotation handled correctly');
  });

  test('should handle memory pressure gracefully', async () => {
    console.log('💾 Testing memory pressure...');
    
    // Simulate memory pressure by opening other apps
    await driver.startActivity('com.android.settings', '.Settings');
    await driver.pause(1000);
    
    // Return to our app
    await driver.activateApp('com.babelfeed.app.debug');
    
    // Verify app recovered correctly
    const activity = await navigation.getCurrentActivity();
    expect(activity).toContain('MainActivity');
    
    console.log('✅ Memory pressure handled correctly');
  });
});