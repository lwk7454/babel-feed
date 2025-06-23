/**
 * Comprehensive WebView Translation Test Suite
 * 
 * This test suite covers all aspects of the webview translation feature including:
 * - Core translation functionality
 * - Dynamic content translation
 * - Cross-page navigation
 * - Error handling and recovery
 * - Performance validation
 * - End-to-end user experience
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { remote } from 'webdriverio';
import { getAppiumConfig } from '../configs/appium.config.js';
import { BackendHealthChecker } from '../utils/backend-health.js';
import { EmulatorManager } from '../utils/emulator-manager.js';
import { WebViewTranslationTester } from '../utils/webview-translation-tester.js';

describe('WebView Translation Test Suite', () => {
  let driver;
  let config;
  let backendHealth;
  let emulatorManager;
  let translationTester;
  let testResults = {
    total: 0,
    passed: 0,
    failed: 0,
    startTime: null,
    endTime: null,
    details: []
  };

  beforeAll(async () => {
    console.log('🚀 Initializing WebView Translation Test Suite...');
    
    config = getAppiumConfig();
    backendHealth = new BackendHealthChecker(config.backendApi);
    emulatorManager = new EmulatorManager(config.emulator);
    
    testResults.startTime = new Date();
    
    // Ensure backend API is healthy
    await backendHealth.checkHealth();
    
    // Ensure emulator is running
    await emulatorManager.ensureEmulatorRunning();
    
    // Initialize Appium driver
    driver = await remote({
      hostname: config.server.host,
      port: config.server.port,
      path: config.server.path,
      capabilities: config.capabilities,
      logLevel: 'warn'
    });
    
    // Initialize translation tester
    translationTester = new WebViewTranslationTester(driver, config);
    await translationTester.initialize();
    
    console.log('✅ WebView Translation Test Suite initialized');
  });

  afterAll(async () => {
    console.log('🧹 Cleaning up WebView Translation Test Suite...');
    
    testResults.endTime = new Date();
    const duration = testResults.endTime - testResults.startTime;
    const successRate = Math.round((testResults.passed / testResults.total) * 100);
    
    console.log(`\n📊 Test Suite Summary:`);
    console.log(`   Total Tests: ${testResults.total}`);
    console.log(`   Passed: ${testResults.passed}`);
    console.log(`   Failed: ${testResults.failed}`);
    console.log(`   Success Rate: ${successRate}%`);
    console.log(`   Duration: ${Math.round(duration / 1000)}s`);
    
    // Cleanup resources
    if (translationTester) {
      await translationTester.cleanup();
    }
    
    if (driver) {
      await driver.deleteSession();
    }
    
    console.log('✅ Cleanup completed');
  });

  beforeEach(async () => {
    // Reset to native app context before each test
    await driver.switchContext('NATIVE_APP');
    await driver.pause(1000);
  });

  afterEach(async () => {
    // Take screenshot on test failure
    const lastResult = testResults.details[testResults.details.length - 1];
    if (lastResult && lastResult.status === 'FAILED' && config.testConfig.screenshotOnFailure) {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const screenshotPath = `reports/screenshots/failed-${lastResult.test.replace(/\s+/g, '-')}-${timestamp}.png`;
      try {
        await driver.saveScreenshot(screenshotPath);
        console.log(`📸 Screenshot saved: ${screenshotPath}`);
      } catch (error) {
        console.warn('⚠️ Failed to save screenshot:', error.message);
      }
    }
  });

  // Helper function to navigate to WebView article
  async function navigateToWebViewArticle() {
    await translationTester.navigateToNewsList();
    await translationTester.selectFirstArticle();
    
    // Check if we're already in a WebView (some apps open articles directly in WebView)
    try {
      await translationTester.waitForWebViewLoad();
      console.log('  ✅ Already in WebView, skipping "Read Full Article" button');
      return;
    } catch (error) {
      console.log('  🔍 Not in WebView yet, trying to click "Read Full Article" button');
      try {
        await translationTester.clickReadFullArticle();
        await translationTester.waitForWebViewLoad();
      } catch (buttonError) {
        console.log('  ⚠️ Could not find "Read Full Article" button, checking if WebView is available...');
        // Try one more time to detect WebView
        await translationTester.waitForWebViewLoad();
      }
    }
  }

  // Helper function to run tests with comprehensive error handling and metrics
  async function runTranslationTest(testName, testFunction) {
    testResults.total++;
    console.log(`🧪 ${testName}...`);
    
    const startTime = Date.now();
    
    try {
      await testFunction();
      testResults.passed++;
      const duration = Date.now() - startTime;
      console.log(`✅ ${testName} (${duration}ms)`);
      
      testResults.details.push({
        test: testName,
        status: 'PASSED',
        duration: duration
      });
      
      return true;
      
    } catch (error) {
      testResults.failed++;
      const duration = Date.now() - startTime;
      console.log(`❌ ${testName}: ${error.message} (${duration}ms)`);
      
      testResults.details.push({
        test: testName,
        status: 'FAILED',
        duration: duration,
        error: error.message
      });
      
      throw error; // Re-throw for Vitest
    }
  }

  describe('Core Translation Functionality', () => {
    it('should enable translation and translate content successfully', async () => {
      await runTranslationTest('Basic Translation Enable', async () => {
        // Navigate to WebView article
        await navigateToWebViewArticle();
        
        // Enable translation
        await translationTester.enableTranslation();
        
        // Verify translation occurs
        const translationResult = await translationTester.waitForTranslationComplete();
        expect(translationResult.success).toBe(true);
        expect(translationResult.translatedContent.length).toBeGreaterThan(0);
        
        // Verify original content is preserved
        const originalContent = await translationTester.getOriginalContent();
        expect(originalContent.length).toBeGreaterThan(0);
      });
    });

    it('should show translation loading indicators', async () => {
      await runTranslationTest('Translation Loading Indicators', async () => {
        await navigateToWebViewArticle();
        
        // Start translation and immediately check for loading state
        const loadingPromise = translationTester.enableTranslation();
        
        // Verify loading indicator appears
        const loadingVisible = await translationTester.isTranslationLoadingVisible();
        expect(loadingVisible).toBe(true);
        
        // Wait for completion
        await loadingPromise;
        
        // Verify loading indicator disappears
        const loadingGone = await translationTester.waitForLoadingComplete();
        expect(loadingGone).toBe(true);
      });
    });

    it('should toggle translation on and off correctly', async () => {
      await runTranslationTest('Translation Toggle Functionality', async () => {
        await navigateToWebViewArticle();
        
        // Get original content
        const originalContent = await translationTester.getWebViewContent();
        
        // Enable translation
        await translationTester.enableTranslation();
        const translatedContent = await translationTester.getWebViewContent();
        
        // Verify content changed
        expect(translatedContent).not.toBe(originalContent);
        
        // Disable translation
        await translationTester.disableTranslation();
        const restoredContent = await translationTester.getWebViewContent();
        
        // Verify original content restored
        expect(restoredContent).toBe(originalContent);
        
        // Re-enable translation
        await translationTester.enableTranslation();
        const retranslatedContent = await translationTester.getWebViewContent();
        
        // Verify translation persists
        expect(retranslatedContent).toBe(translatedContent);
      });
    });
  });

  describe('Dynamic Content Translation', () => {
    it('should translate dynamically loaded content', async () => {
      await runTranslationTest('Dynamic Content Translation', async () => {
        await navigateToWebViewArticle();
        
        // Enable dynamic translation mode
        await translationTester.enableDynamicTranslation();
        
        // Simulate dynamic content loading (e.g., comments, related articles)
        await translationTester.triggerDynamicContentLoad();
        
        // Wait for new content to appear and be translated
        const dynamicTranslationResult = await translationTester.waitForDynamicTranslation();
        expect(dynamicTranslationResult.success).toBe(true);
        expect(dynamicTranslationResult.newContentTranslated).toBe(true);
      });
    });

    it('should handle DOM mutations and translate new elements', async () => {
      await runTranslationTest('DOM Mutation Translation', async () => {
        await navigateToWebViewArticle();
        
        await translationTester.enableDynamicTranslation();
        
        // Get initial content count
        const initialContentCount = await translationTester.getTranslatableElementCount();
        
        // Trigger DOM mutations (e.g., expand comments, load more content)
        await translationTester.simulateDOMChanges();
        
        // Wait for mutation detection and translation
        await translationTester.waitForMutationTranslation();
        
        // Verify new elements were detected and translated
        const finalContentCount = await translationTester.getTranslatableElementCount();
        expect(finalContentCount).toBeGreaterThan(initialContentCount);
        
        const newElementsTranslated = await translationTester.verifyNewElementsTranslated();
        expect(newElementsTranslated).toBe(true);
      });
    });

    it('should handle progressive loading and infinite scroll', async () => {
      await runTranslationTest('Progressive Loading Translation', async () => {
        await translationTester.navigateToNewsList();
        await translationTester.selectArticleWithInfiniteScroll();
        await translationTester.clickReadFullArticle();
        await translationTester.waitForWebViewLoad();
        
        await translationTester.enableDynamicTranslation();
        
        // Simulate infinite scroll
        const scrollIterations = 3;
        for (let i = 0; i < scrollIterations; i++) {
          await translationTester.scrollToTriggerLoading();
          await translationTester.waitForNewContentLoad();
        }
        
        // Verify all loaded content is translated
        const allContentTranslated = await translationTester.verifyAllContentTranslated();
        expect(allContentTranslated).toBe(true);
        
        // Verify performance remains acceptable 
        const performanceMetrics = await translationTester.getPerformanceMetrics();
        expect(performanceMetrics.averageTranslationTime).toBeLessThan(5000); // 5 seconds max
      });
    });
  });

  describe('Navigation and State Persistence', () => {
    it('should maintain translation state across page navigation', async () => {
      await runTranslationTest('Cross-Page Translation Persistence', async () => {
        await navigateToWebViewArticle();
        
        // Enable translation on first page
        await translationTester.enableTranslation();
        await translationTester.waitForTranslationComplete();
        
        // Navigate to another page within webview
        await translationTester.navigateToLinkedPage();
        await translationTester.waitForPageLoad();
        
        // Verify translation is still enabled
        const translationEnabled = await translationTester.isTranslationEnabled();
        expect(translationEnabled).toBe(true);
        
        // Verify new page content is translated
        const newPageTranslated = await translationTester.isCurrentPageTranslated();
        expect(newPageTranslated).toBe(true);
        
        // Navigate back and verify consistency
        await translationTester.navigateBack();
        const backPageTranslated = await translationTester.isCurrentPageTranslated();
        expect(backPageTranslated).toBe(true);
      });
    });

    it('should handle URL navigation and maintain translation', async () => {
      await runTranslationTest('URL Navigation Translation', async () => {
        await navigateToWebViewArticle();
        
        await translationTester.enableTranslation();
        
        // Click links that cause URL changes
        const linkUrls = await translationTester.getNavigationLinks();
        expect(linkUrls.length).toBeGreaterThan(0);
        
        // Test navigation to different URLs
        for (const url of linkUrls.slice(0, 2)) { // Test first 2 links
          await translationTester.navigateToUrl(url);
          await translationTester.waitForPageLoad();
          
          const isTranslated = await translationTester.isCurrentPageTranslated();
          expect(isTranslated).toBe(true);
        }
        
        // Test browser back/forward
        await translationTester.navigateBack();
        const backTranslated = await translationTester.isCurrentPageTranslated();
        expect(backTranslated).toBe(true);
        
        await translationTester.navigateForward();
        const forwardTranslated = await translationTester.isCurrentPageTranslated();
        expect(forwardTranslated).toBe(true);
      });
    });

    it('should translate embedded content and iframes', async () => {
      await runTranslationTest('Embedded Content Translation', async () => {
        await translationTester.navigateToNewsList();
        await translationTester.selectArticleWithEmbeds();
        await translationTester.clickReadFullArticle();
        await translationTester.waitForWebViewLoad();
        
        await translationTester.enableTranslation();
        
        // Wait for main content translation
        await translationTester.waitForTranslationComplete();
        
        // Check for embedded content
        const embeddedElements = await translationTester.getEmbeddedElements();
        if (embeddedElements.length > 0) {
          // Verify embedded content is handled appropriately
          const embeddedTranslated = await translationTester.verifyEmbeddedContentTranslation();
          expect(embeddedTranslated).toBe(true);
        }
        
        // Verify main content is still translated
        const mainContentTranslated = await translationTester.isCurrentPageTranslated();
        expect(mainContentTranslated).toBe(true);
      });
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should handle network failures gracefully', async () => {
      await runTranslationTest('Network Failure Recovery', async () => {
        await navigateToWebViewArticle();
        
        // Simulate network disconnection
        await translationTester.simulateNetworkDisconnection();
        
        // Attempt translation during network failure
        await translationTester.enableTranslation();
        
        // Verify error handling
        const errorHandled = await translationTester.verifyErrorHandling();
        expect(errorHandled.errorShown).toBe(true);
        expect(errorHandled.appStable).toBe(true);
        
        // Restore network
        await translationTester.restoreNetworkConnection();
        
        // Verify recovery
        const recoveryResult = await translationTester.verifyNetworkRecovery();
        expect(recoveryResult.translationWorking).toBe(true);
      });
    });

    it('should handle API timeouts appropriately', async () => {
      await runTranslationTest('API Timeout Handling', async () => {
        await translationTester.navigateToNewsList();
        await translationTester.selectLargeArticle(); // Article that might cause timeout
        await translationTester.clickReadFullArticle();
        await translationTester.waitForWebViewLoad();
        
        // Set shorter timeout for testing
        await translationTester.setTranslationTimeout(5000); // 5 seconds
        
        await translationTester.enableTranslation();
        
        // Wait for timeout or completion
        const result = await translationTester.waitForTranslationOrTimeout();
        
        if (result.timedOut) {
          // Verify timeout is handled gracefully
          expect(result.errorShown).toBe(true);
          expect(result.retryAvailable).toBe(true);
          
          // Test retry functionality
          const retryResult = await translationTester.retryTranslation();
          expect(retryResult.attempted).toBe(true);
        } else {
          // If no timeout, verify translation succeeded
          expect(result.success).toBe(true);
        }
      });
    });

    it('should handle invalid or edge-case content', async () => {
      await runTranslationTest('Invalid Content Handling', async () => {
        // Test various edge cases
        const edgeCases = [
          { type: 'empty', description: 'Empty article' },
          { type: 'large', description: 'Very large article' },
          { type: 'special-chars', description: 'Article with special characters' },
          { type: 'mixed-languages', description: 'Article with mixed languages' }
        ];
        
        for (const testCase of edgeCases) {
          console.log(`  Testing ${testCase.description}...`);
          
          await translationTester.navigateToNewsList();
          await translationTester.selectArticleByType(testCase.type);
          await translationTester.clickReadFullArticle();
          await translationTester.waitForWebViewLoad();
          
          await translationTester.enableTranslation();
          
          // Verify graceful handling
          const result = await translationTester.waitForTranslationResult();
          expect(result.appStable).toBe(true);
          expect(result.errorHandled).toBe(true);
          
          // Check for memory leaks or crashes
          const healthCheck = await translationTester.performHealthCheck();
          expect(healthCheck.healthy).toBe(true);
        }
      });
    });
  });

  describe('Performance and Quality', () => {
    it('should maintain acceptable performance with large content', async () => {
      await runTranslationTest('Large Content Performance', async () => {
        await translationTester.navigateToNewsList();
        await translationTester.selectLargeArticle();
        await translationTester.clickReadFullArticle();
        await translationTester.waitForWebViewLoad();
        
        const startMemory = await translationTester.getMemoryUsage();
        const startTime = Date.now();
        
        await translationTester.enableTranslation();
        await translationTester.waitForTranslationComplete();
        
        const endTime = Date.now();
        const endMemory = await translationTester.getMemoryUsage();
        
        const translationTime = endTime - startTime;
        const memoryIncrease = endMemory - startMemory;
        
        // Performance assertions
        expect(translationTime).toBeLessThan(30000); // 30 seconds max
        expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024); // 50MB max increase
        
        // Verify UI responsiveness
        const uiResponsive = await translationTester.verifyUIResponsiveness();
        expect(uiResponsive).toBe(true);
      });
    });

    it('should support multiple language pairs', async () => {
      await runTranslationTest('Multiple Language Support', async () => {
        const languagePairs = [
          { from: 'en', to: 'zh-cn', name: 'English to Chinese' },
          { from: 'en', to: 'es', name: 'English to Spanish' },
          { from: 'en', to: 'fr', name: 'English to French' }
        ];
        
        await navigateToWebViewArticle();
        
        for (const pair of languagePairs) {
          console.log(`  Testing ${pair.name}...`);
          
          // Set target language
          await translationTester.setTargetLanguage(pair.to);
          
          // Enable translation
          await translationTester.enableTranslation();
          await translationTester.waitForTranslationComplete();
          
          // Verify translation quality
          const quality = await translationTester.assessTranslationQuality();
          expect(quality.score).toBeGreaterThan(0.7); // 70% quality threshold
          
          // Disable for next iteration
          await translationTester.disableTranslation();
        }
      });
    });

    it('should utilize caching for improved performance', async () => {
      await runTranslationTest('Translation Caching Performance', async () => {
        await navigateToWebViewArticle();
        
        // First translation (uncached)
        const firstStart = Date.now();
        await translationTester.enableTranslation();
        await translationTester.waitForTranslationComplete();
        const firstDuration = Date.now() - firstStart;
        
        // Disable and re-enable (should use cache)
        await translationTester.disableTranslation();
        await driver.pause(1000);
        
        const secondStart = Date.now();
        await translationTester.enableTranslation();
        await translationTester.waitForTranslationComplete();
        const secondDuration = Date.now() - secondStart;
        
        // Cached version should be significantly faster
        const speedImprovement = firstDuration / secondDuration;
        expect(speedImprovement).toBeGreaterThan(2); // At least 2x faster
        
        // Verify content consistency
        const contentConsistent = await translationTester.verifyCachedContentConsistency();
        expect(contentConsistent).toBe(true);
      });
    });
  });

  describe('End-to-End User Experience', () => {
    it('should provide complete news article translation flow', async () => {
      await runTranslationTest('Complete News Translation Flow', async () => {
        // Start from news list
        await translationTester.navigateToNewsList();
        
        // Verify news list is accessible
        const newsItems = await translationTester.getNewsItems();
        expect(newsItems.length).toBeGreaterThan(0);
        
        // Select article
        await translationTester.selectFirstArticle();
        await translationTester.waitForWebViewLoad();
        
        // Verify article content is loaded
        const articleContent = await translationTester.getWebViewContent();
        expect(articleContent.length).toBeGreaterThan(100); // Substantial content
        
        // Enable translation
        await translationTester.enableTranslation();
        
        // Verify translation controls are accessible
        const controlsAccessible = await translationTester.verifyTranslationControlsAccessible();
        expect(controlsAccessible).toBe(true);
        
        // Wait for translation
        const translationResult = await translationTester.waitForTranslationComplete();
        expect(translationResult.success).toBe(true);
        
        // Navigate within article
        await translationTester.scrollThroughArticle();
        
        // Verify translation persists during navigation
        const stillTranslated = await translationTester.isCurrentPageTranslated();
        expect(stillTranslated).toBe(true);
        
        // Return to news list
        await translationTester.returnToNewsList();
        
        // Verify app state is consistent
        const appStateConsistent = await translationTester.verifyAppStateConsistent();
        expect(appStateConsistent).toBe(true);
      });
    });

    it('should handle multiple articles in sequence', async () => {
      await runTranslationTest('Multiple Articles Translation', async () => {
        const articlesToTest = 3;
        
        for (let i = 0; i < articlesToTest; i++) {
          console.log(`  Testing article ${i + 1}/${articlesToTest}...`);
          
          await translationTester.navigateToNewsList();
          await translationTester.selectArticleByIndex(i);
          await translationTester.clickReadFullArticle();
          await translationTester.waitForWebViewLoad();
          
          await translationTester.enableTranslation();
          const result = await translationTester.waitForTranslationComplete();
          expect(result.success).toBe(true);
          
          // Brief interaction with translated content
          await translationTester.scrollThroughArticle();
          
          // Verify translation quality
          const quality = await translationTester.quickQualityCheck();
          expect(quality.acceptable).toBe(true);
          
          await translationTester.returnToNewsList();
        }
        
        // Verify overall app stability
        const finalStability = await translationTester.performHealthCheck();
        expect(finalStability.healthy).toBe(true);
      });
    });

    it('should support accessibility features', async () => {
      await runTranslationTest('Translation Accessibility', async () => {
        await navigateToWebViewArticle();
        
        // Enable accessibility testing mode
        await translationTester.enableAccessibilityMode();
        
        // Test screen reader compatibility
        const screenReaderCompatible = await translationTester.verifyScreenReaderCompatibility();
        expect(screenReaderCompatible).toBe(true);
        
        // Test keyboard navigation
        const keyboardNavigable = await translationTester.verifyKeyboardNavigation();
        expect(keyboardNavigable).toBe(true);
        
        // Test high contrast mode
        await translationTester.enableHighContrastMode();
        await translationTester.enableTranslation();
        
        const highContrastWorking = await translationTester.verifyHighContrastTranslation();
        expect(highContrastWorking).toBe(true);
        
        // Test touch target sizes
        const touchTargetsAccessible = await translationTester.verifyTouchTargetSizes();
        expect(touchTargetsAccessible).toBe(true);
      });
    });
  });

  describe('Translation Navigation Fixes Validation', () => {
    it('should persist translation state across URL navigation', async () => {
      await runTranslationTest('Translation State Persistence Across URLs', async () => {
        await navigateToWebViewArticle();
        
        // Use navigation test URLs from config
        const testUrls = config.testData.navigationTestUrls.slice(0, 3);
        
        // Test translation persistence across multiple URLs
        const persistenceResult = await translationTester.testNavigationPersistence(testUrls);
        
        // Validate persistence results
        expect(persistenceResult.overallSuccess).toBe(true);
        expect(persistenceResult.persistenceRate).toBeGreaterThanOrEqual(
          config.testData.performanceThresholds.translationStatePersistence
        );
        expect(persistenceResult.successfulUrls).toBeGreaterThan(0);
        
        console.log(`  📊 Navigation persistence: ${persistenceResult.persistenceRate}% success rate`);
        console.log(`  📊 Successful URLs: ${persistenceResult.successfulUrls}/${persistenceResult.totalUrls}`);
      });
    });

    it('should activate auto-translation when navigating to new pages', async () => {
      await runTranslationTest('Auto-Translation Activation on Navigation', async () => {
        await navigateToWebViewArticle();
        
        // Enable translation on initial page
        await translationTester.enableTranslation();
        await translationTester.waitForTranslationComplete();
        
        // Test auto-translation activation on navigation
        const activationResult = await translationTester.testAutoTranslationOnNavigation();
        
        // Validate auto-translation results
        expect(activationResult.overallSuccess).toBe(true);
        expect(activationResult.activationRate).toBeGreaterThanOrEqual(
          config.testData.performanceThresholds.autoTranslationActivation
        );
        
        console.log(`  📊 Auto-translation activation: ${activationResult.activationRate}% success rate`);
        console.log(`  📊 Successful activations: ${activationResult.successfulActivations}/${activationResult.totalLinks}`);
      });
    });

    it('should maintain dynamic translation across page transitions', async () => {
      await runTranslationTest('Dynamic Translation Across Page Transitions', async () => {
        await navigateToWebViewArticle();
        
        // Test dynamic translation across navigation
        const dynamicResult = await translationTester.testDynamicTranslationAcrossNavigation();
        
        // Validate dynamic translation results
        expect(dynamicResult.overallSuccess).toBe(true);
        expect(dynamicResult.dynamicSuccessRate).toBeGreaterThanOrEqual(
          config.testData.performanceThresholds.dynamicTranslationAcrossNavigation
        );
        
        console.log(`  📊 Dynamic translation across navigation: ${dynamicResult.dynamicSuccessRate}% success rate`);
        console.log(`  📊 Successful pages: ${dynamicResult.successfulPages}/${dynamicResult.totalPages}`);
      });
    });

    it('should preserve MutationObserver functionality across page transitions', async () => {
      await runTranslationTest('MutationObserver Across Page Transitions', async () => {
        await navigateToWebViewArticle();
        
        // Test mutation observer across navigation
        const observerResult = await translationTester.testMutationObserverAcrossNavigation();
        
        // Validate mutation observer results
        expect(observerResult.overallSuccess).toBe(true);
        expect(observerResult.observerSuccessRate).toBeGreaterThanOrEqual(
          config.testData.performanceThresholds.mutationObserverAcrossNavigation
        );
        
        console.log(`  📊 MutationObserver across navigation: ${observerResult.observerSuccessRate}% success rate`);
        console.log(`  📊 Successful pages: ${observerResult.successfulPages}/${observerResult.totalPages}`);
      });
    });

    it('should restore translation state after app restart', async () => {
      await runTranslationTest('Translation State Restoration After Restart', async () => {
        await navigateToWebViewArticle();
        
        // Enable translation
        await translationTester.enableTranslation();
        await translationTester.waitForTranslationComplete();
        
        // Test state restoration after restart
        const restartResult = await translationTester.testTranslationStateAfterRestart();
        
        // Validate restart recovery
        expect(restartResult.restartRecoverySuccessful).toBe(true);
        expect(restartResult.stateRestored).toBe(true);
        expect(restartResult.translationWorking).toBe(true);
        
        console.log(`  📊 Restart recovery: ${restartResult.restartRecoverySuccessful ? 'SUCCESS' : 'FAILED'}`);
      });
    });

    it('should handle mixed navigation scenarios (back/forward with translation)', async () => {
      await runTranslationTest('Mixed Navigation Back/Forward with Translation', async () => {
        await navigateToWebViewArticle();
        
        // Enable translation
        await translationTester.enableTranslation();
        await translationTester.waitForTranslationComplete();
        
        // Store initial state
        const initialState = await translationTester.saveTranslationState();
        
        // Navigate to a linked page
        await translationTester.navigateToLinkedPage();
        await translationTester.waitForPageLoad();
        
        // Verify translation works on new page
        const newPageTranslated = await translationTester.isCurrentPageTranslated();
        expect(newPageTranslated).toBe(true);
        
        // Navigate back
        await translationTester.navigateBack();
        await translationTester.waitForPageLoad();
        
        // Verify translation still works after back navigation
        const backPageTranslated = await translationTester.isCurrentPageTranslated();
        expect(backPageTranslated).toBe(true);
        
        // Navigate forward
        await translationTester.navigateForward();
        await translationTester.waitForPageLoad();
        
        // Verify translation works after forward navigation
        const forwardPageTranslated = await translationTester.isCurrentPageTranslated();
        expect(forwardPageTranslated).toBe(true);
        
        // Verify translation state persistence
        const finalPersistence = await translationTester.verifyTranslationStatePersistence();
        expect(finalPersistence.persistent).toBe(true);
        
        console.log(`  📊 Back/Forward navigation: Translation ${finalPersistence.persistent ? 'persisted' : 'lost'}`);
      });
    });
  });

  describe('Navigation Performance and Error Handling', () => {
    it('should maintain acceptable performance during navigation with translation', async () => {
      await runTranslationTest('Navigation Performance with Translation', async () => {
        await navigateToWebViewArticle();
        
        // Test navigation performance
        const performanceResult = await translationTester.testNavigationPerformance();
        
        // Validate performance results
        expect(performanceResult.overallSuccess).toBe(true);
        expect(performanceResult.performanceRate).toBeGreaterThanOrEqual(
          config.testData.performanceThresholds.navigationPerformance
        );
        
        // Verify acceptable performance metrics
        expect(performanceResult.avgNavigationTime).toBeLessThan(config.testConfig.maxNavigationTime);
        expect(performanceResult.avgMemoryIncrease).toBeLessThan(
          Math.round(config.testConfig.maxMemoryIncrease / 1024 / 1024)
        );
        
        console.log(`  📊 Navigation performance: ${performanceResult.performanceRate}% success rate`);
        console.log(`  📊 Average navigation time: ${performanceResult.avgNavigationTime}ms`);
        console.log(`  📊 Average memory increase: ${performanceResult.avgMemoryIncrease}MB`);
      });
    });

    it('should recover translation after failed navigation', async () => {
      await runTranslationTest('Translation Recovery After Failed Navigation', async () => {
        await navigateToWebViewArticle();
        
        // Enable translation
        await translationTester.enableTranslation();
        await translationTester.waitForTranslationComplete();
        
        // Test recovery after failed navigation
        const recoveryResult = await translationTester.testTranslationRecoveryAfterFailedNavigation();
        
        // Validate recovery results
        expect(recoveryResult.overallSuccess).toBe(true);
        expect(recoveryResult.recoveryRate).toBeGreaterThanOrEqual(
          config.testData.performanceThresholds.recoveryAfterFailedNavigation
        );
        
        console.log(`  📊 Recovery after failed navigation: ${recoveryResult.recoveryRate}% success rate`);
        console.log(`  📊 Successful recoveries: ${recoveryResult.successfulRecoveries}/${recoveryResult.totalScenarios}`);
        
        // Verify specific recovery scenarios
        const successfulRecoveries = recoveryResult.recoveryResults.filter(r => r.success);
        expect(successfulRecoveries.length).toBeGreaterThan(0);
      });
    });

    it('should manage memory effectively during extended navigation', async () => {
      await runTranslationTest('Memory Management During Extended Navigation', async () => {
        await navigateToWebViewArticle();
        
        // Test memory management during navigation
        const memoryResult = await translationTester.testMemoryManagementDuringNavigation();
        
        // Validate memory management results
        expect(memoryResult.overallSuccess).toBe(true);
        expect(memoryResult.memoryManagementRate).toBeGreaterThanOrEqual(
          config.testData.performanceThresholds.memoryManagementDuringNavigation
        );
        expect(memoryResult.memoryLeakDetected).toBe(false);
        
        // Verify memory increase is within acceptable bounds
        const maxAllowedIncrease = Math.round(config.testConfig.maxMemoryIncrease / 1024 / 1024);
        expect(memoryResult.totalMemoryIncrease).toBeLessThan(maxAllowedIncrease);
        
        console.log(`  📊 Memory management: ${memoryResult.memoryManagementRate}% success rate`);
        console.log(`  📊 Total memory increase: ${memoryResult.totalMemoryIncrease}MB`);
        console.log(`  📊 Peak memory: ${memoryResult.peakMemory}MB`);
        console.log(`  📊 Memory leak detected: ${memoryResult.memoryLeakDetected ? 'YES' : 'NO'}`);
      });
    });

    it('should handle translation service unavailability during navigation', async () => {
      await runTranslationTest('Translation Service Unavailability During Navigation', async () => {
        await navigateToWebViewArticle();
        
        // Enable translation
        await translationTester.enableTranslation();
        await translationTester.waitForTranslationComplete();
        
        // Simulate service unavailability
        await translationTester.simulateNetworkDisconnection();
        
        // Try to navigate during service unavailability
        const links = await translationTester.getNavigationLinks();
        if (links.length > 0) {
          await translationTester.navigateToUrl(links[0]);
          await translationTester.waitForPageLoad();
          
          // Verify graceful handling
          const errorHandled = await translationTester.verifyErrorHandling();
          expect(errorHandled.appStable).toBe(true);
        }
        
        // Restore service
        await translationTester.restoreNetworkConnection();
        
        // Verify recovery
        const recoveryResult = await translationTester.verifyNetworkRecovery();
        expect(recoveryResult.translationWorking).toBe(true);
        
        console.log(`  📊 Service unavailability handling: ${errorHandled.appStable ? 'STABLE' : 'UNSTABLE'}`);
        console.log(`  📊 Recovery after service restoration: ${recoveryResult.translationWorking ? 'SUCCESS' : 'FAILED'}`);
      });
    });

    it('should provide graceful fallback when translation state cannot be restored', async () => {
      await runTranslationTest('Graceful Fallback for Unrestorable Translation State', async () => {
        await navigateToWebViewArticle();
        
        // Enable translation and store state
        await translationTester.enableTranslation();
        await translationTester.waitForTranslationComplete();
        const originalState = await translationTester.saveTranslationState();
        
        // Navigate to multiple pages to test state corruption scenarios
        const testUrls = config.testData.navigationTestUrls.slice(0, 2);
        
        for (const url of testUrls) {
          await translationTester.navigateToUrl(url);
          await translationTester.waitForPageLoad();
          
          // Verify app remains stable even if state restoration fails
          const appStable = await translationTester.verifyAppStateConsistent();
          expect(appStable).toBe(true);
          
          // Verify translation can be re-enabled if needed
          if (!await translationTester.isCurrentPageTranslated()) {
            await translationTester.enableTranslation();
            const reactivationSuccess = await translationTester.waitForTranslationComplete();
            expect(reactivationSuccess.success).toBe(true);
          }
        }
        
        console.log(`  📊 Graceful fallback: App remained stable throughout navigation`);
      });
    });
  });

  describe('Test Suite Quality Assurance', () => {
    it('should achieve high overall success rate', async () => {
      // This test runs after all others to validate overall success
      const successRate = Math.round((testResults.passed / testResults.total) * 100);
      
      console.log(`\n📈 Test Suite Quality Metrics:`);
      console.log(`   Success Rate: ${successRate}%`);
      console.log(`   Total Tests: ${testResults.total}`);
      console.log(`   Passed: ${testResults.passed}`);
      console.log(`   Failed: ${testResults.failed}`);
      
      // Quality assertions - Updated for expanded test suite
      expect(testResults.total).toBeGreaterThan(25); // Ensure comprehensive testing with navigation tests
      expect(testResults.passed).toBeGreaterThan(0); // Ensure some tests pass
      expect(successRate).toBeGreaterThanOrEqual(80); // 80% minimum success rate
      
      // Generate detailed report
      const reportPath = await translationTester.generateTestReport(testResults);
      console.log(`📄 Detailed test report: ${reportPath}`);
    });
  });
});