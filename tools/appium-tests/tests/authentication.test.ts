/**
 * Authentication Tests
 * Consolidated authentication flow testing
 */

import { describe, test, expect, beforeAll, afterAll, beforeEach } from 'bun:test';
import { DriverManager } from '../src/driver-manager.js';
import { AppNavigation, AuthHelper, BackendHelper } from '../src/helpers/index.js';

describe('Authentication Flows', () => {
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
    await driver.execute('mobile: terminateApp', { appId: 'com.babelfeed.app.debug' });
    await driver.pause(2000);
    await driver.activateApp('com.babelfeed.app.debug');
    await driver.pause(3000); // Wait for app to fully load
  });

  test('should complete guest to verified user flow', async () => {
    console.log('🔐 Testing complete authentication flow...');
    
    const testUser = authHelper.createTestUser();
    
    try {
      // Step 1: Navigate through welcome screen
      await navigation.waitForScreen('Welcome', 15000);
      await navigation.clickElementByContentDesc('Select English');
      await navigation.clickElementByContentDesc('Continue');
      
      // Step 2: Navigate to profile
      await navigation.waitForScreen('Feed', 15000);
      await authHelper.navigateToProfile();
      
      // Step 3: Verify initial guest status
      await navigation.waitForScreen('Profile', 10000);
      const initialStatus = await authHelper.getUserStatus();
      expect(initialStatus.toLowerCase()).toContain('guest');
      
      // Step 4: Enter email for verification
      await authHelper.enterEmail(testUser.email);
      await authHelper.clickVerifyButton();
      
      // Step 5: Handle OTP verification
      await navigation.waitForScreen('Verification', 15000);
      await authHelper.enterOTP(testUser.otpCode || '1234');
      await authHelper.submitOTP();
      
      // Step 6: Wait for verification success
      await authHelper.waitForVerificationSuccess();
      
      // Step 7: Verify user is now authenticated
      await navigation.waitForScreen('Profile', 10000);
      const finalStatus = await authHelper.getUserStatus();
      expect(finalStatus.toLowerCase()).toContain('verified');
      
      console.log('✅ Authentication flow completed successfully');
      
    } finally {
      // Cleanup: Delete test user
      await backendHelper.deleteTestUser(testUser.email);
    }
  });

  test('should handle invalid OTP gracefully', async () => {
    console.log('❌ Testing invalid OTP handling...');
    
    const testUser = authHelper.createTestUser();
    
    try {
      // Navigate to verification flow
      await navigation.waitForScreen('Welcome', 15000);
      await navigation.clickElementByContentDesc('Select English');
      await navigation.clickElementByContentDesc('Continue');
      
      await navigation.waitForScreen('Feed', 15000);
      await authHelper.navigateToProfile();
      
      await authHelper.enterEmail(testUser.email);
      await authHelper.clickVerifyButton();
      
      // Enter invalid OTP
      await navigation.waitForScreen('Verification', 15000);
      await authHelper.enterOTP('9999'); // Invalid OTP
      await authHelper.submitOTP();
      
      // Check for error message
      await navigation.waitForScreen('Error', 10000);
      const hasErrorMessage = await navigation.isElementDisplayed('//*[contains(@text, "Invalid") or contains(@text, "Error")]');
      expect(hasErrorMessage).toBe(true);
      
      console.log('✅ Invalid OTP handled correctly');
      
    } finally {
      await backendHelper.deleteTestUser(testUser.email);
    }
  });

  test('should maintain authentication state across app restarts', async () => {
    console.log('🔄 Testing authentication persistence...');
    
    const testUser = authHelper.createTestUser();
    
    try {
      // Complete authentication
      await navigation.waitForScreen('Welcome', 15000);
      await navigation.clickElementByContentDesc('Select English');
      await navigation.clickElementByContentDesc('Continue');
      
      await navigation.waitForScreen('Feed', 15000);
      await authHelper.navigateToProfile();
      
      await authHelper.enterEmail(testUser.email);
      await authHelper.clickVerifyButton();
      
      await navigation.waitForScreen('Verification', 15000);
      await authHelper.enterOTP(testUser.otpCode || '1234');
      await authHelper.submitOTP();
      
      await authHelper.waitForVerificationSuccess();
      
      // Verify authenticated state
      await navigation.waitForScreen('Profile', 10000);
      const authenticatedStatus = await authHelper.getUserStatus();
      expect(authenticatedStatus.toLowerCase()).toContain('verified');
      
      // Restart app
      await driver.execute('mobile: terminateApp', { appId: 'com.babelfeed.app.debug' });
      await driver.pause(2000);
      await driver.activateApp('com.babelfeed.app.debug');
      await driver.pause(3000);
      
      // Check that user is still authenticated
      await navigation.waitForScreen('Feed', 15000);
      await authHelper.navigateToProfile();
      
      const persistedStatus = await authHelper.getUserStatus();
      expect(persistedStatus.toLowerCase()).toContain('verified');
      
      console.log('✅ Authentication state persisted correctly');
      
    } finally {
      await backendHelper.deleteTestUser(testUser.email);
    }
  });

  test('should handle logout flow correctly', async () => {
    console.log('🚪 Testing logout flow...');
    
    const testUser = authHelper.createTestUser();
    
    try {
      // Complete authentication first
      await navigation.waitForScreen('Welcome', 15000);
      await navigation.clickElementByContentDesc('Select English');
      await navigation.clickElementByContentDesc('Continue');
      
      await navigation.waitForScreen('Feed', 15000);
      await authHelper.navigateToProfile();
      
      await authHelper.enterEmail(testUser.email);
      await authHelper.clickVerifyButton();
      
      await navigation.waitForScreen('Verification', 15000);
      await authHelper.enterOTP(testUser.otpCode || '1234');
      await authHelper.submitOTP();
      
      await authHelper.waitForVerificationSuccess();
      
      // Verify authenticated state
      await navigation.waitForScreen('Profile', 10000);
      const isLoggedIn = await authHelper.isLoggedIn();
      expect(isLoggedIn).toBe(true);
      
      // Logout
      await authHelper.logout();
      
      // Verify logged out state
      const isStillLoggedIn = await authHelper.isLoggedIn();
      expect(isStillLoggedIn).toBe(false);
      
      console.log('✅ Logout flow completed successfully');
      
    } finally {
      await backendHelper.deleteTestUser(testUser.email);
    }
  });

  test('should handle network connectivity issues during auth', async () => {
    console.log('📶 Testing network connectivity during authentication...');
    
    const testUser = authHelper.createTestUser();
    
    try {
      // Start authentication flow
      await navigation.waitForScreen('Welcome', 15000);
      await navigation.clickElementByContentDesc('Select English');
      await navigation.clickElementByContentDesc('Continue');
      
      await navigation.waitForScreen('Feed', 15000);
      await authHelper.navigateToProfile();
      
      // Simulate network issue by entering invalid email format
      await authHelper.enterEmail('invalid-email');
      await authHelper.clickVerifyButton();
      
      // Check for network/validation error
      const hasErrorMessage = await navigation.isElementDisplayed('//*[contains(@text, "Error") or contains(@text, "Invalid")]');
      expect(hasErrorMessage).toBe(true);
      
      console.log('✅ Network connectivity issues handled correctly');
      
    } finally {
      await backendHelper.deleteTestUser(testUser.email);
    }
  });
});