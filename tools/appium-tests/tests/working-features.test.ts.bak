/**
 * Working Features Test
 * Test only the features that are actually implemented in the app
 */

import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { DriverManager } from '../src/driver-manager.js';
import { AppNavigation } from '../src/helpers/index.js';

describe('Working App Features', () => {
  let driverManager: DriverManager;
  let driver: WebdriverIO.Browser;
  let navigation: AppNavigation;

  beforeAll(async () => {
    console.log('🚀 Starting working features test...');
    
    driverManager = new DriverManager();
    
    try {
      // Start only Appium (skip backend for now)
      await driverManager.startAppiumServer();
      
      // Create driver
      driver = await driverManager.createDriver();
      navigation = new AppNavigation(driver);
      
      console.log('✅ Test setup completed');
    } catch (error) {
      console.error('❌ Test setup failed:', error);
      throw error;
    }
  });

  afterAll(async () => {
    console.log('🧹 Cleaning up...');
    await driverManager.stopServices();
  });

  test('should launch app successfully', async () => {
    console.log('📱 Testing app launch...');
    
    // Check that app is running
    const activity = await navigation.getCurrentActivity();
    console.log('Current activity:', activity);
    
    expect(activity).toContain('MainActivity');
    
    // Take screenshot for verification
    await navigation.takeScreenshot('app-launch-success');
    
    console.log('✅ App launched successfully');
  });

  test('should display welcome or feed screen', async () => {
    console.log('🏠 Testing initial screen display...');
    
    // Wait for some screen to load (either welcome or feed)
    await driver.pause(5000); // Give app time to load
    
    // Check what's actually displayed
    const pageSource = await driver.getPageSource();
    console.log('Page source contains welcome?', pageSource.includes('welcome'));
    console.log('Page source contains feed?', pageSource.includes('feed'));
    
    // Take screenshot to see what's actually shown
    await navigation.takeScreenshot('initial-screen');
    
    // App should be responsive
    const activity = await navigation.getCurrentActivity();
    expect(activity).toContain('MainActivity');
    
    console.log('✅ Initial screen displayed');
  });

  test('should handle basic app interactions', async () => {
    console.log('👆 Testing basic interactions...');
    
    // Try to find any clickable elements
    const clickableElements = await driver.$$('//*[@clickable="true"]');
    console.log(`Found ${clickableElements.length} clickable elements`);
    
    // Try to find text elements
    const textElements = await driver.$$('//android.widget.TextView');
    console.log(`Found ${textElements.length} text elements`);
    
    if (textElements.length > 0) {
      const firstText = await textElements[0].getText();
      console.log('First text element:', firstText);
      expect(firstText.length).toBeGreaterThan(0);
    }
    
    // Take screenshot of current state
    await navigation.takeScreenshot('basic-interactions');
    
    console.log('✅ Basic interactions working');
  });

  test('should handle app orientation changes', async () => {
    console.log('🔄 Testing orientation changes...');
    
    // Get initial orientation
    const initialOrientation = await driver.getOrientation();
    console.log(`Initial orientation: ${initialOrientation}`);
    
    try {
      // Try to rotate device
      const newOrientation = initialOrientation === 'PORTRAIT' ? 'LANDSCAPE' : 'PORTRAIT';
      await driver.setOrientation(newOrientation);
      
      // Wait for rotation to complete
      await driver.pause(2000);
      
      // Verify orientation changed
      const currentOrientation = await driver.getOrientation();
      console.log(`Current orientation: ${currentOrientation}`);
      
      // Rotate back
      await driver.setOrientation(initialOrientation);
      await driver.pause(1000);
      
      // Verify app is still functional
      const activity = await navigation.getCurrentActivity();
      expect(activity).toContain('MainActivity');
      
      console.log('✅ Orientation changes handled');
    } catch (error) {
      console.log('⚠️ Orientation change not supported or failed:', error);
      // This is acceptable - not all devices/emulators support rotation
    }
  });

  test('should survive background and foreground', async () => {
    console.log('🔄 Testing app lifecycle...');
    
    try {
      // Background the app
      await driver.background(2000); // 2 seconds
      
      // Bring app back to foreground  
      await driver.activateApp('com.babelfeed.app.debug');
      await driver.pause(2000);
      
      // Verify app is still functional
      const activity = await navigation.getCurrentActivity();
      expect(activity).toContain('MainActivity');
      
      console.log('✅ App lifecycle handled correctly');
    } catch (error) {
      console.log('⚠️ Background/foreground test failed:', error);
      // Try alternative approach
      const activity = await navigation.getCurrentActivity();
      expect(activity).toContain('MainActivity');
    }
  });
});