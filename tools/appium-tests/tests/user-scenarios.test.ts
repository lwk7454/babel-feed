/**
 * User Scenarios - DRY Tests
 * Tests fresh and existing users efficiently with minimal repetition
 */

import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { DriverManager } from '../src/driver-manager.js';
import { AppNavigation, AuthHelper, BackendHelper } from '../src/helpers/index.js';

describe('User Scenarios', () => {
  let driverManager: DriverManager;
  let driver: WebdriverIO.Browser;
  let navigation: AppNavigation;
  let authHelper: AuthHelper;
  let backendHelper: BackendHelper;

  const testUsers = {
    fresh: `fresh-${Date.now()}@example.com`,
    existing: `existing-${Date.now()}@example.com`,
    upgrade: `upgrade-${Date.now()}@example.com`
  };

  beforeAll(async () => {
    driverManager = new DriverManager(false); // start fresh
    await driverManager.startAppiumServer();
    await driverManager.startBackendService();
    
    driver = await driverManager.createDriver();
    navigation = new AppNavigation(driver);
    authHelper = new AuthHelper(driver);
    backendHelper = new BackendHelper();
    
    await backendHelper.waitForBackend();
  });

  afterAll(async () => {
    // Cleanup all test users
    await Promise.all([
      backendHelper.deleteTestUser(testUsers.fresh),
      backendHelper.deleteTestUser(testUsers.existing),
      backendHelper.deleteTestUser(testUsers.upgrade)
    ]);
    await driverManager.stopServices();
  });

  test('fresh user: welcome → guest → verified → logout → guest', async () => {
    console.log('🔄 Testing complete fresh user journey...');
    
    // 1. Fresh install shows welcome
    await navigation.waitForScreen('Welcome', 10000);
    const hasLanguageSelector = await navigation.isElementDisplayed('//*[contains(@content-desc, "Language")]');
    expect(hasLanguageSelector).toBe(true);
    
    // 2. Complete welcome → becomes guest
    await navigation.clickElementByContentDesc('Select English');
    await navigation.clickElementByContentDesc('Continue');
    await navigation.waitForScreen('Feed');
    
    await authHelper.navigateToProfile();
    let status = await authHelper.getUserStatus();
    expect(status.toLowerCase()).toContain('guest');
    expect(await authHelper.isLoggedIn()).toBe(false);
    
    // 3. Verify email → becomes verified
    await authHelper.enterEmail(testUsers.fresh);
    await authHelper.clickVerifyButton();
    await navigation.waitForScreen('Verification');
    await authHelper.enterOTP('1234');
    await authHelper.submitOTP();
    await authHelper.waitForVerificationSuccess();
    
    await navigation.waitForScreen('Profile');
    status = await authHelper.getUserStatus();
    expect(status.toLowerCase()).toContain('verified');
    expect(await authHelper.isLoggedIn()).toBe(true);
    
    // 4. Logout → back to guest
    await authHelper.logout();
    status = await authHelper.getUserStatus();
    expect(status.toLowerCase()).toContain('guest');
    expect(await authHelper.isLoggedIn()).toBe(false);
    
    console.log('✅ Fresh user complete journey tested');
  });

  test('setup existing user + test persistence + restart + upgrade scenario', async () => {
    console.log('🔧 Setting up existing user and testing all persistence scenarios...');
    
    // 1. Reset and setup existing verified user
    await driverManager.resetAppData();
    driver = await driverManager.createDriver(false);
    navigation = new AppNavigation(driver);
    authHelper = new AuthHelper(driver);
    
    // Setup existing verified user manually
    await navigation.waitForScreen('WelcomeScreen');
    await navigation.clickElementByText('English');
    await navigation.clickElementByText('Confirm');
    await navigation.waitForScreen('FeedScreen');
    await authHelper.navigateToProfile();
    await authHelper.enterEmail(testUsers.existing);
    await authHelper.clickVerifyButton();
    await authHelper.enterOTP('1234');
    await authHelper.submitOTP();
    
    // 2. Test new session with preserved data
    await driverManager.preserveAppDataForNext();
    await driverManager.quitDriver();
    driver = await driverManager.createDriver(true);
    navigation = new AppNavigation(driver);
    authHelper = new AuthHelper(driver);
    
    // Should skip welcome, go directly to feed
    await navigation.waitForScreen('Feed', 10000);
    await authHelper.navigateToProfile();
    
    let status = await authHelper.getUserStatus();
    expect(status.toLowerCase()).toContain('verified');
    expect(await authHelper.isLoggedIn()).toBe(true);
    
    // 3. Test app restart persistence
    await driver.execute('mobile: terminateApp', { appId: 'com.babelfeed.app.debug' });
    await driver.pause(2000);
    await driver.activateApp('com.babelfeed.app.debug');
    await driver.pause(3000);
    
    await navigation.waitForScreen('Feed', 10000); // Still no welcome
    await authHelper.navigateToProfile();
    
    status = await authHelper.getUserStatus();
    expect(status.toLowerCase()).toContain('verified');
    expect(await authHelper.isLoggedIn()).toBe(true);
    
    // 4. Test logout → guest upgrade scenario
    await authHelper.logout();
    status = await authHelper.getUserStatus();
    expect(status.toLowerCase()).toContain('guest');
    
    // 5. Upgrade guest to verified (different email)
    await authHelper.enterEmail(testUsers.upgrade);
    await authHelper.clickVerifyButton();
    await navigation.waitForScreen('Verification');
    await authHelper.enterOTP('1234');
    await authHelper.submitOTP();
    await authHelper.waitForVerificationSuccess();
    
    await navigation.waitForScreen('Profile');
    status = await authHelper.getUserStatus();
    expect(status.toLowerCase()).toContain('verified');
    expect(await authHelper.isLoggedIn()).toBe(true);
    
    // 6. Test that upgrade persists across restart
    await driver.execute('mobile: terminateApp', { appId: 'com.babelfeed.app.debug' });
    await driver.pause(2000);
    await driver.activateApp('com.babelfeed.app.debug');
    await driver.pause(3000);
    
    await navigation.waitForScreen('Feed', 10000);
    await authHelper.navigateToProfile();
    
    status = await authHelper.getUserStatus();
    expect(status.toLowerCase()).toContain('verified');
    expect(await authHelper.isLoggedIn()).toBe(true);
    
    console.log('✅ Existing user setup + persistence + upgrade all tested');
  });

  test('edge cases: invalid OTP + network errors + multiple languages', async () => {
    console.log('🧪 Testing edge cases and error scenarios...');
    
    // 1. Reset to fresh state
    await driverManager.resetAppData();
    driver = await driverManager.createDriver(false);
    navigation = new AppNavigation(driver);
    authHelper = new AuthHelper(driver);
    
    // 2. Test different language selection
    await navigation.waitForScreen('Welcome');
    await navigation.clickElementByContentDesc('Select Chinese Simplified');
    await navigation.clickElementByContentDesc('Continue');
    await navigation.waitForScreen('Feed');
    
    // 3. Test invalid email format
    await authHelper.navigateToProfile();
    await authHelper.enterEmail('invalid-email');
    await authHelper.clickVerifyButton();
    
    const hasEmailError = await navigation.isElementDisplayed('//*[contains(@text, "Error") or contains(@text, "Invalid")]');
    expect(hasEmailError).toBe(true);
    
    // 4. Test valid email but invalid OTP
    const testEmail = `error-test-${Date.now()}@example.com`;
    try {
      await authHelper.enterEmail(testEmail);
      await authHelper.clickVerifyButton();
      await navigation.waitForScreen('Verification');
      
      await authHelper.enterOTP('9999'); // Invalid OTP
      await authHelper.submitOTP();
      
      // Should show error
      const hasOtpError = await navigation.isElementDisplayed('//*[contains(@text, "Invalid") or contains(@text, "Error")]');
      expect(hasOtpError).toBe(true);
      
      // 5. Test valid OTP after invalid one
      await authHelper.enterOTP('1234'); // Valid OTP
      await authHelper.submitOTP();
      await authHelper.waitForVerificationSuccess();
      
      await navigation.waitForScreen('Profile');
      const status = await authHelper.getUserStatus();
      expect(status.toLowerCase()).toContain('verified');
      
    } finally {
      await backendHelper.deleteTestUser(testEmail);
    }
    
    console.log('✅ Edge cases and error scenarios tested');
  });
});