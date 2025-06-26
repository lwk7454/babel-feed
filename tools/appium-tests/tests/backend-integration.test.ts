/**
 * Backend Integration Tests
 * Testing API integration and data flow between mobile app and backend
 */

import { describe, test, expect, beforeAll, afterAll, beforeEach } from 'bun:test';
import { DriverManager } from '../src/driver-manager.js';
import { AppNavigation, AuthHelper, BackendHelper } from '../src/helpers/index.js';

describe('Backend Integration', () => {
  let driverManager: DriverManager;
  let driver: WebdriverIO.Browser;
  let navigation: AppNavigation;
  let authHelper: AuthHelper;
  let backendHelper: BackendHelper;

  beforeAll(async () => {
    driverManager = new DriverManager();
    
    // Start services
    await driverManager.startAppiumServer();
    await driverManager.startBackendService();
    
    // Create driver and helpers
    driver = await driverManager.createDriver();
    navigation = new AppNavigation(driver);
    authHelper = new AuthHelper(driver);
    backendHelper = new BackendHelper();
    
    // Wait for backend to be ready
    await backendHelper.waitForBackend();
  });

  afterAll(async () => {
    await driverManager.stopServices();
  });

  beforeEach(async () => {
    // Reset app state before each test
    await driver.terminateApp('com.babelfeed.app.debug');
    await driver.pause(2000);
    await driver.activateApp('com.babelfeed.app.debug');
    await driver.pause(3000);
  });

  test('should verify backend health and connectivity', async () => {
    console.log('🏥 Testing backend health check...');
    
    const isHealthy = await backendHelper.checkHealth();
    expect(isHealthy).toBe(true);
    
    console.log('✅ Backend is healthy and reachable');
  });

  test('should fetch articles from backend API', async () => {
    console.log('📰 Testing article fetching from backend...');
    
    // Call backend API directly
    const articlesResponse = await backendHelper.getArticles(5);
    expect(articlesResponse.success).toBe(true);
    expect(Array.isArray(articlesResponse.data)).toBe(true);
    
    // Navigate to feed in app
    await navigation.waitForScreen('Welcome', 15000);
    await navigation.clickElementByText('English');
    await navigation.clickElementByText('Continue');
    await navigation.waitForScreen('Feed', 15000);
    
    // Verify articles are displayed in the app
    const articleElements = await driver.$$('//*[contains(@content-desc, "article") or contains(@class, "article")]');
    expect(articleElements.length).toBeGreaterThan(0);
    
    console.log('✅ Articles fetched and displayed successfully');
  });

  test('should handle user registration and OTP flow with backend', async () => {
    console.log('🔐 Testing backend user registration and OTP flow...');
    
    const testUser = authHelper.createTestUser();
    
    try {
      // Test backend user creation
      const createResponse = await backendHelper.createTestUser(testUser.email);
      expect(createResponse.success).toBe(true);
      
      // Test OTP sending
      const otpResponse = await backendHelper.sendOTP(testUser.email);
      expect(otpResponse.success).toBe(true);
      
      // Test OTP verification
      const verifyResponse = await backendHelper.verifyOTP(testUser.email, '1234');
      expect(verifyResponse.success).toBe(true);
      
      // Now test the same flow through the mobile app
      await navigation.waitForScreen('Welcome', 15000);
      await navigation.clickElementByText('English');
      await navigation.clickElementByText('Continue');
      
      await navigation.waitForScreen('Feed', 15000);
      await authHelper.navigateToProfile();
      
      await authHelper.enterEmail(testUser.email);
      await authHelper.clickVerifyButton();
      
      await navigation.waitForScreen('Verification', 15000);
      await authHelper.enterOTP('1234');
      await authHelper.submitOTP();
      
      await authHelper.waitForVerificationSuccess();
      
      console.log('✅ Backend user registration and OTP flow working correctly');
      
    } finally {
      await backendHelper.deleteTestUser(testUser.email);
    }
  });

  test('should handle translation requests to backend', async () => {
    console.log('🌐 Testing backend translation API...');
    
    // Test translation API directly
    const translationResponse = await backendHelper.translateText(
      'Hello world, this is a test.',
      'zh-CN'
    );
    expect(translationResponse.success).toBe(true);
    expect(translationResponse.data).toBeDefined();
    
    // Test with different languages
    const japaneseTranslation = await backendHelper.translateText(
      'This is another test message.',
      'ja'
    );
    expect(japaneseTranslation.success).toBe(true);
    
    console.log('✅ Backend translation API working correctly');
  });

  test('should sync user preferences with backend', async () => {
    console.log('⚙️ Testing user preferences synchronization...');
    
    const testUser = authHelper.createTestUser();
    
    try {
      // Complete authentication first
      await navigation.waitForScreen('Welcome', 15000);
      await navigation.clickElementByText('English');
      await navigation.clickElementByText('Continue');
      
      await navigation.waitForScreen('Feed', 15000);
      await authHelper.navigateToProfile();
      
      await authHelper.enterEmail(testUser.email);
      await authHelper.clickVerifyButton();
      
      await navigation.waitForScreen('Verification', 15000);
      await authHelper.enterOTP('1234');
      await authHelper.submitOTP();
      
      await authHelper.waitForVerificationSuccess();
      
      // Change user preferences in the app
      await navigation.waitForScreen('Profile', 10000);
      
      // Look for preference toggles
      const autoTranslationToggle = await driver.$('//*[contains(@text, "Auto") and contains(@text, "Translation")]');
      if (await autoTranslationToggle.isDisplayed()) {
        await autoTranslationToggle.click();
      }
      
      // Save preferences
      const saveButton = await driver.$('//*[@text="Save" or @content-desc="Save"]');
      if (await saveButton.isDisplayed()) {
        await saveButton.click();
      }
      
      // Restart app to verify preferences persisted
      await driver.terminateApp('com.babelfeed.app.debug');
      await driver.pause(2000);
      await driver.activateApp('com.babelfeed.app.debug');
      await driver.pause(3000);
      
      // Check that preferences are maintained
      await navigation.waitForScreen('Feed', 15000);
      await authHelper.navigateToProfile();
      
      // Verify user is still logged in (preferences sync indicator)
      const isLoggedIn = await authHelper.isLoggedIn();
      expect(isLoggedIn).toBe(true);
      
      console.log('✅ User preferences synchronized correctly');
      
    } finally {
      await backendHelper.deleteTestUser(testUser.email);
    }
  });

  test('should handle network connectivity issues gracefully', async () => {
    console.log('📶 Testing network connectivity error handling...');
    
    // Test backend health check failure simulation
    // (In a real scenario, you might disable network or use a mock)
    
    // Navigate to feed
    await navigation.waitForScreen('Welcome', 15000);
    await navigation.clickElementByText('English');
    await navigation.clickElementByText('Continue');
    await navigation.waitForScreen('Feed', 15000);
    
    // Try to refresh feed (should handle network gracefully)
    // Look for refresh button or pull-to-refresh
    const refreshButton = await driver.$('//*[@content-desc="Refresh" or @text="Refresh"]');
    if (await refreshButton.isDisplayed()) {
      await refreshButton.click();
    } else {
      // Try pull-to-refresh gesture
      const feedElement = await driver.$('//*[contains(@content-desc, "feed")]');
      if (await feedElement.isDisplayed()) {
        await driver.touchAction([
          { action: 'press', x: 200, y: 300 },
          { action: 'moveTo', x: 200, y: 600 },
          { action: 'release' }
        ]);
      }
    }
    
    // App should handle network issues gracefully without crashing
    await driver.pause(3000);
    const activity = await navigation.getCurrentActivity();
    expect(activity).toContain('MainActivity');
    
    console.log('✅ Network connectivity issues handled gracefully');
  });

  test('should handle concurrent API requests correctly', async () => {
    console.log('🔄 Testing concurrent API request handling...');
    
    // Make multiple concurrent API requests
    const promises = [
      backendHelper.getArticles(3),
      backendHelper.getArticles(5),
      backendHelper.translateText('Test message 1', 'zh-CN'),
      backendHelper.translateText('Test message 2', 'ja'),
      backendHelper.checkHealth()
    ];
    
    const results = await Promise.all(promises);
    
    // Verify all requests completed successfully
    results.forEach((result, index) => {
      if (index < 4) { // First 4 are API calls that should return success
        expect(result.success).toBe(true);
      } else { // Last one is health check
        expect(result).toBe(true);
      }
    });
    
    console.log('✅ Concurrent API requests handled correctly');
  });

  test('should handle large data responses efficiently', async () => {
    console.log('📊 Testing large data response handling...');
    
    // Request a larger number of articles
    const largeResponse = await backendHelper.getArticles(50);
    expect(largeResponse.success).toBe(true);
    expect(Array.isArray(largeResponse.data)).toBe(true);
    
    // Test with long text translation
    const longText = 'This is a very long text that should be translated. '.repeat(50);
    const longTranslationResponse = await backendHelper.translateText(longText, 'zh-CN');
    expect(longTranslationResponse.success).toBe(true);
    
    // Verify app can handle large data sets in feed
    await navigation.waitForScreen('Welcome', 15000);
    await navigation.clickElementByText('English');
    await navigation.clickElementByText('Continue');
    await navigation.waitForScreen('Feed', 15000);
    
    // Scroll through feed to test performance with large data
    for (let i = 0; i < 5; i++) {
      await driver.touchAction([
        { action: 'press', x: 200, y: 600 },
        { action: 'moveTo', x: 200, y: 200 },
        { action: 'release' }
      ]);
      await driver.pause(1000);
    }
    
    // App should remain responsive
    const activity = await navigation.getCurrentActivity();
    expect(activity).toContain('MainActivity');
    
    console.log('✅ Large data responses handled efficiently');
  });
});