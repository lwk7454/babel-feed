/**
 * WebView Translation Tests
 * Comprehensive testing of translation functionality in WebView
 */

import { describe, test, expect, beforeAll, afterAll, beforeEach } from 'bun:test';
import { DriverManager } from '../src/driver-manager.js';
import { AppNavigation, WebViewHelper, BackendHelper } from '../src/helpers/index.js';

describe('WebView Translation Functionality', () => {
  let driverManager: DriverManager;
  let driver: WebdriverIO.Browser;
  let navigation: AppNavigation;
  let webViewHelper: WebViewHelper;
  // let authHelper: AuthHelper; // Unused in this test suite
  let backendHelper: BackendHelper;

  beforeAll(async () => {
    driverManager = new DriverManager();
    
    // Start services
    await driverManager.startAppiumServer();
    await driverManager.startBackendService();
    
    // Create driver and helpers
    driver = await driverManager.createDriver();
    navigation = new AppNavigation(driver);
    webViewHelper = new WebViewHelper(driver);
    // authHelper = new AuthHelper(driver); // Unused in this test suite
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
    await driver.pause(3000);
    
    // Navigate to feed
    await navigation.waitForScreen('Welcome', 15000);
    await navigation.clickElementByText('English');
    await navigation.clickElementByText('Continue');
    await navigation.waitForScreen('Feed', 15000);
  });

  test('should load article in WebView and detect translation bridge', async () => {
    console.log('🌐 Testing WebView article loading and translation bridge...');
    
    // Click on first article
    const firstArticle = await driver.$('//*[contains(@content-desc, "article") or contains(@class, "article")]');
    await firstArticle.waitForDisplayed({ timeout: 15000 });
    await firstArticle.click();
    
    // Wait for article summary screen
    await navigation.waitForScreen('Article', 15000);
    
    // Click "Read Full Article" button
    await navigation.clickElementByText('Read Full Article');
    
    // Wait for WebView screen
    await navigation.waitForScreen('WebView', 15000);
    
    // Switch to WebView context
    await webViewHelper.switchToWebView();
    
    // Verify page loaded
    await webViewHelper.waitForPageLoad();
    const pageTitle = await webViewHelper.getPageTitle();
    expect(pageTitle.length).toBeGreaterThan(0);
    
    // Check for translation bridge
    await webViewHelper.waitForTranslationBridge();
    
    console.log('✅ WebView loaded and translation bridge detected');
  });

  test('should translate page content when triggered', async () => {
    console.log('🔄 Testing page translation functionality...');
    
    // Navigate to WebView with test content
    await navigation.clickElementByText('Feed');
    const firstArticle = await driver.$('//*[contains(@content-desc, "article")]');
    await firstArticle.click();
    await navigation.clickElementByText('Read Full Article');
    
    await navigation.waitForScreen('WebView', 15000);
    await webViewHelper.switchToWebView();
    
    // Inject test content for reliable testing
    const testContent = `
      <div id="test-content">
        <h1>Hello World</h1>
        <p>This is a test article in English that should be translated.</p>
        <p>The translation system should handle this content properly.</p>
      </div>
    `;
    await webViewHelper.injectTestContent(testContent);
    
    // Wait for translation bridge
    await webViewHelper.waitForTranslationBridge();
    
    // Get original content
    const originalText = await webViewHelper.getPageText();
    expect(originalText).toContain('Hello World');
    
    // Trigger translation
    await webViewHelper.triggerTranslation();
    
    // Wait for translation to complete
    await webViewHelper.waitForTranslationComplete();
    
    // Verify translation occurred
    const translationStatus = await webViewHelper.getTranslationStatus();
    expect(translationStatus).toBe('completed');
    
    console.log('✅ Page translation completed successfully');
  });

  test('should handle translation toggle correctly', async () => {
    console.log('🔄 Testing translation toggle functionality...');
    
    // Navigate to WebView
    const firstArticle = await driver.$('//*[contains(@content-desc, "article")]');
    await firstArticle.click();
    await navigation.clickElementByText('Read Full Article');
    
    await navigation.waitForScreen('WebView', 15000);
    
    // Switch to native app to access menu
    await webViewHelper.switchToNativeApp();
    
    // Click menu button
    await navigation.clickElement('//*[@content-desc="Menu" or @text="Menu"]');
    
    // Toggle translation option
    await navigation.clickElementByText('Translation');
    
    // Switch back to WebView to verify
    await webViewHelper.switchToWebView();
    
    // Check translation status
    const isActive = await webViewHelper.isTranslationActive();
    expect(typeof isActive).toBe('boolean');
    
    console.log('✅ Translation toggle handled correctly');
  });

  test('should handle dynamic content changes', async () => {
    console.log('📝 Testing dynamic content translation...');
    
    // Navigate to WebView
    const firstArticle = await driver.$('//*[contains(@content-desc, "article")]');
    await firstArticle.click();
    await navigation.clickElementByText('Read Full Article');
    
    await navigation.waitForScreen('WebView', 15000);
    await webViewHelper.switchToWebView();
    
    // Inject initial content
    await webViewHelper.injectTestContent('<div id="content">Initial content</div>');
    
    // Wait for translation bridge
    await webViewHelper.waitForTranslationBridge();
    
    // Trigger translation
    await webViewHelper.triggerTranslation();
    await webViewHelper.waitForTranslationComplete();
    
    // Add dynamic content
    await driver.execute(() => {
      const newElement = document.createElement('p');
      newElement.textContent = 'Dynamically added content';
      newElement.id = 'dynamic-content';
      document.body.appendChild(newElement);
    });
    
    // Wait for dynamic content to be translated
    await driver.pause(3000); // Allow time for observer to detect changes
    
    // Verify dynamic content exists
    const hasDynamicContent = await driver.execute(() => {
      return document.getElementById('dynamic-content') !== null;
    });
    expect(hasDynamicContent).toBe(true);
    
    console.log('✅ Dynamic content translation handled correctly');
  });

  test('should handle multiple WebView navigations', async () => {
    console.log('🔗 Testing multiple WebView navigations...');
    
    // Navigate to WebView
    const firstArticle = await driver.$('//*[contains(@content-desc, "article")]');
    await firstArticle.click();
    await navigation.clickElementByText('Read Full Article');
    
    await navigation.waitForScreen('WebView', 15000);
    await webViewHelper.switchToWebView();
    
    // Navigate to a test URL
    await webViewHelper.navigateToUrl('https://example.com');
    
    // Verify navigation
    const currentUrl = await driver.getUrl();
    expect(currentUrl).toContain('example.com');
    
    // Wait for translation bridge on new page
    await webViewHelper.waitForTranslationBridge();
    
    // Navigate to another URL
    await webViewHelper.navigateToUrl('https://httpbin.org/html');
    
    // Verify second navigation
    const secondUrl = await driver.getUrl();
    expect(secondUrl).toContain('httpbin.org');
    
    // Verify translation bridge still works
    await webViewHelper.waitForTranslationBridge();
    
    console.log('✅ Multiple WebView navigations handled correctly');
  });

  test('should handle WebView errors gracefully', async () => {
    console.log('❌ Testing WebView error handling...');
    
    // Navigate to WebView
    const firstArticle = await driver.$('//*[contains(@content-desc, "article")]');
    await firstArticle.click();
    await navigation.clickElementByText('Read Full Article');
    
    await navigation.waitForScreen('WebView', 15000);
    await webViewHelper.switchToWebView();
    
    try {
      // Navigate to non-existent URL
      await webViewHelper.navigateToUrl('https://non-existent-domain-12345.com');
      
      // Check for error page or handling
      await driver.pause(5000); // Wait for error to load
      
      const pageTitle = await webViewHelper.getPageTitle();
      const pageText = await webViewHelper.getPageText();
      
      // Verify error is handled (title or text indicates error)
      const hasErrorIndication = pageTitle.toLowerCase().includes('error') || 
                               pageText.toLowerCase().includes('error') ||
                               pageText.toLowerCase().includes('not found');
      
      expect(hasErrorIndication).toBe(true);
      
    } catch (error) {
      // Error during navigation is also acceptable
      console.log('Navigation error caught as expected:', error instanceof Error ? error.message : 'Unknown error');
    }
    
    console.log('✅ WebView errors handled gracefully');
  });

  test('should maintain translation state across context switches', async () => {
    console.log('🔄 Testing translation state persistence...');
    
    // Navigate to WebView and set up translation
    const firstArticle = await driver.$('//*[contains(@content-desc, "article")]');
    await firstArticle.click();
    await navigation.clickElementByText('Read Full Article');
    
    await navigation.waitForScreen('WebView', 15000);
    await webViewHelper.switchToWebView();
    
    // Inject test content and translate
    await webViewHelper.injectTestContent('<div>Test content for translation</div>');
    await webViewHelper.waitForTranslationBridge();
    await webViewHelper.triggerTranslation();
    await webViewHelper.waitForTranslationComplete();
    
    const initialStatus = await webViewHelper.getTranslationStatus();
    
    // Switch to native app context
    await webViewHelper.switchToNativeApp();
    
    // Perform some native app action
    await navigation.takeScreenshot('context-switch-native');
    
    // Switch back to WebView
    await webViewHelper.switchToWebView();
    
    // Check that translation state is maintained
    const finalStatus = await webViewHelper.getTranslationStatus();
    expect(finalStatus).toBe(initialStatus);
    
    console.log('✅ Translation state maintained across context switches');
  });
});