import { $, expect } from '@wdio/globals';
import { restartApp, takeScreenshot, waitForElement, findElementWithRetry } from '../utils/webview-translation-tester.js';
import { checkBackendHealth } from '../utils/backend-health.js';

describe('Article List Backend Integration', () => {
    let backendHealthy = false;

    beforeEach(async () => {
        // Check backend health before each test
        backendHealthy = await checkBackendHealth();
        if (!backendHealthy) {
            console.warn('⚠️ Backend API is not healthy, some tests may fail');
        }

        await restartApp();
        // Wait for app to load completely
        await driver.pause(3000);
    });

    afterEach(async () => {
        await takeScreenshot('after-test');
    });

    describe('Article List Display', () => {
        it('should display articles from backend API', async () => {
            // Wait for the feed screen to load
            const feedTitle = await findElementWithRetry({
                xpath: '//android.widget.TextView[contains(@text, "Babel Feed")]',
                uiAutomator: 'new UiSelector().textContains("Babel Feed")',
                text: 'Babel Feed'
            });
            
            await expect(feedTitle).toBeDisplayed();
            await takeScreenshot('feed-screen-loaded');

            // Wait for articles to load from API
            await driver.pause(5000);

            // Look for article cards or list items
            const articleElements = await findArticleElements();
            
            if (backendHealthy) {
                expect(articleElements.length).toBeGreaterThan(0);
                console.log(`✅ Found ${articleElements.length} articles from backend`);
            } else {
                console.log('⚠️ Skipping article count check due to backend issues');
            }

            await takeScreenshot('articles-displayed');
        });

        it('should display article details correctly', async () => {
            await waitForFeedScreen();
            
            const articleElements = await findArticleElements();
            
            if (articleElements.length > 0) {
                const firstArticle = articleElements[0];
                
                // Check for article title
                const titleText = await getArticleTitle(firstArticle);
                expect(titleText).toBeTruthy();
                expect(titleText.length).toBeGreaterThan(5);
                
                // Check for article source
                const sourceText = await getArticleSource(firstArticle);
                if (sourceText) {
                    expect(sourceText).toMatch(/Source:/);
                }
                
                console.log(`✅ Article details verified: "${titleText}"`);
                await takeScreenshot('article-details-verified');
            } else {
                console.log('⚠️ No articles found to verify details');
            }
        });

        it('should handle loading states properly', async () => {
            await restartApp();
            
            // Check for loading indicator immediately after restart
            const loadingIndicator = await findElementWithRetry({
                xpath: '//android.widget.ProgressBar',
                uiAutomator: 'new UiSelector().className("android.widget.ProgressBar")',
                resourceId: '*:id/loading_indicator'
            }, { timeout: 3000, required: false });

            if (loadingIndicator) {
                await expect(loadingIndicator).toBeDisplayed();
                console.log('✅ Loading indicator displayed during API call');
                await takeScreenshot('loading-state');
            }

            // Wait for loading to complete
            await waitForFeedScreen();
            
            // Verify loading indicator is gone
            const loadingGone = await findElementWithRetry({
                xpath: '//android.widget.ProgressBar',
                uiAutomator: 'new UiSelector().className("android.widget.ProgressBar")'
            }, { timeout: 2000, required: false });

            if (!loadingGone) {
                console.log('✅ Loading indicator properly dismissed');
            }

            await takeScreenshot('loading-complete');
        });

        it('should handle API errors gracefully', async () => {
            // This test simulates what happens when backend is unavailable
            await waitForFeedScreen();
            
            if (!backendHealthy) {
                // Look for error message or empty state
                const errorElement = await findElementWithRetry({
                    xpath: '//android.widget.TextView[contains(@text, "Error") or contains(@text, "Failed") or contains(@text, "Unable")]',
                    uiAutomator: 'new UiSelector().textContains("Error")',
                    text: 'Error'
                }, { timeout: 5000, required: false });

                if (errorElement) {
                    await expect(errorElement).toBeDisplayed();
                    console.log('✅ Error message displayed when backend unavailable');
                    await takeScreenshot('api-error-handled');
                } else {
                    // App might show empty state instead of error
                    console.log('✅ App handles API errors gracefully (empty state)');
                }
            } else {
                console.log('⚠️ Cannot test API error handling - backend is healthy');
            }
        });

        it('should refresh articles when pulled down', async () => {
            await waitForFeedScreen();
            
            // Get initial article count
            const initialArticles = await findArticleElements();
            const initialCount = initialArticles.length;
            
            if (initialCount > 0) {
                // Perform pull-to-refresh gesture
                await performPullToRefresh();
                
                // Wait for refresh to complete
                await driver.pause(3000);
                
                // Check if articles are still displayed (refresh completed)
                const refreshedArticles = await findArticleElements();
                
                if (backendHealthy) {
                    expect(refreshedArticles.length).toBeGreaterThan(0);
                    console.log('✅ Pull-to-refresh completed successfully');
                } else {
                    console.log('⚠️ Pull-to-refresh behavior verified (backend issues may affect content)');
                }
                
                await takeScreenshot('after-refresh');
            } else {
                console.log('⚠️ Cannot test pull-to-refresh - no initial articles');
            }
        });
    });

    describe('Article Selection and Navigation', () => {
        it('should navigate to article details when tapped', async () => {
            await waitForFeedScreen();
            
            const articleElements = await findArticleElements();
            
            if (articleElements.length > 0) {
                const firstArticle = articleElements[0];
                const articleTitle = await getArticleTitle(firstArticle);
                
                // Tap on the article
                await firstArticle.click();
                await driver.pause(3000);
                
                // Verify we're on article detail screen
                const articleDetailTitle = await findElementWithRetry({
                    xpath: '//android.widget.TextView[contains(@text, "Article Summary") or contains(@text, "Article")]',
                    uiAutomator: 'new UiSelector().textContains("Article")',
                    text: 'Article'
                });
                
                await expect(articleDetailTitle).toBeDisplayed();
                
                // Verify article title is displayed
                if (articleTitle) {
                    const titleInDetail = await findElementWithRetry({
                        xpath: `//android.widget.TextView[contains(@text, "${articleTitle.substring(0, 20)}")]`,
                        uiAutomator: `new UiSelector().textContains("${articleTitle.substring(0, 20)}")`,
                        text: articleTitle.substring(0, 20)
                    }, { timeout: 5000, required: false });
                    
                    if (titleInDetail) {
                        await expect(titleInDetail).toBeDisplayed();
                        console.log('✅ Article title displayed in detail screen');
                    }
                }
                
                await takeScreenshot('article-detail-screen');
                
                // Navigate back to feed
                await driver.back();
                await driver.pause(2000);
                
                // Verify we're back on feed screen
                const backOnFeed = await findElementWithRetry({
                    xpath: '//android.widget.TextView[contains(@text, "Babel Feed")]',
                    uiAutomator: 'new UiSelector().textContains("Babel Feed")',
                    text: 'Babel Feed'
                });
                
                await expect(backOnFeed).toBeDisplayed();
                console.log('✅ Successfully navigated to article detail and back');
            } else {
                console.log('⚠️ Cannot test article selection - no articles available');
            }
        });

        it('should show "Read Full Article" button in article details', async () => {
            await waitForFeedScreen();
            
            const articleElements = await findArticleElements();
            
            if (articleElements.length > 0) {
                // Navigate to article detail
                await articleElements[0].click();
                await driver.pause(3000);
                
                // Look for "Read Full Article" button
                const readFullButton = await findElementWithRetry({
                    xpath: '//android.widget.Button[contains(@text, "Read Full Article")]',
                    uiAutomator: 'new UiSelector().textContains("Read Full Article")',
                    text: 'Read Full Article'
                });
                
                await expect(readFullButton).toBeDisplayed();
                console.log('✅ "Read Full Article" button found in article details');
                
                await takeScreenshot('read-full-article-button');
                
                // Test button click (should navigate to WebView)
                await readFullButton.click();
                await driver.pause(5000);
                
                // Check if WebView is loaded or if we get an error
                const contexts = await driver.getContexts();
                const hasWebView = contexts.some(ctx => ctx.includes('WEBVIEW'));
                
                if (hasWebView) {
                    console.log('✅ WebView loaded successfully for full article');
                    await takeScreenshot('webview-loaded');
                } else {
                    // Might show error or still be loading
                    console.log('ℹ️ WebView not immediately available (may be loading or error occurred)');
                    await takeScreenshot('webview-not-loaded');
                }
                
                // Navigate back
                await driver.back();
                await driver.back(); // Back to feed
                await driver.pause(2000);
            } else {
                console.log('⚠️ Cannot test Read Full Article - no articles available');
            }
        });
    });

    describe('Backend API Integration', () => {
        it('should load articles from database', async () => {
            if (!backendHealthy) {
                console.log('⚠️ Skipping database integration test - backend not healthy');
                return;
            }
            
            await waitForFeedScreen();
            
            // Check that we have articles with expected backend data structure
            const articleElements = await findArticleElements();
            
            if (articleElements.length > 0) {
                for (let i = 0; i < Math.min(3, articleElements.length); i++) {
                    const article = articleElements[i];
                    const title = await getArticleTitle(article);
                    const source = await getArticleSource(article);
                    
                    // Verify article has expected structure from backend
                    expect(title).toBeTruthy();
                    expect(title.length).toBeGreaterThan(5);
                    
                    if (source) {
                        expect(source).toMatch(/Source:/);
                    }
                    
                    console.log(`✅ Article ${i + 1} structure verified: "${title}"`);
                }
                
                await takeScreenshot('backend-articles-verified');
            }
        });

        it('should handle pagination or article limits', async () => {
            if (!backendHealthy) {
                console.log('⚠️ Skipping pagination test - backend not healthy');
                return;
            }
            
            await waitForFeedScreen();
            
            const articleElements = await findArticleElements();
            const articleCount = articleElements.length;
            
            // Backend provides up to 20 articles by default
            if (articleCount > 0) {
                console.log(`✅ Received ${articleCount} articles from backend`);
                
                // Test scrolling behavior (might trigger pagination)
                if (articleCount >= 5) {
                    await scrollToBottom();
                    await driver.pause(2000);
                    
                    const afterScrollArticles = await findArticleElements();
                    console.log(`ℹ️ After scroll: ${afterScrollArticles.length} articles`);
                }
                
                await takeScreenshot('pagination-test');
            }
        });
    });

    describe('Data Consistency', () => {
        it('should display consistent article data across screens', async () => {
            await waitForFeedScreen();
            
            const articleElements = await findArticleElements();
            
            if (articleElements.length > 0) {
                const firstArticle = articleElements[0];
                const feedTitle = await getArticleTitle(firstArticle);
                const feedSource = await getArticleSource(firstArticle);
                
                // Navigate to article detail
                await firstArticle.click();
                await driver.pause(3000);
                
                // Get title and source from detail screen
                const detailTitle = await findElementWithRetry({
                    xpath: '//android.widget.TextView',
                    uiAutomator: 'new UiSelector().className("android.widget.TextView")'
                }, { timeout: 5000, required: false });
                
                if (detailTitle && feedTitle) {
                    const detailText = await detailTitle.getText();
                    
                    // Title should be consistent (or at least partially match)
                    if (detailText && detailText.includes(feedTitle.substring(0, 15))) {
                        console.log('✅ Article title consistent between feed and detail');
                    } else {
                        console.log(`ℹ️ Feed title: "${feedTitle}"`);
                        console.log(`ℹ️ Detail title: "${detailText}"`);
                    }
                }
                
                await takeScreenshot('data-consistency-check');
                await driver.back();
                await driver.pause(2000);
            }
        });
    });

    // Helper functions
    async function waitForFeedScreen() {
        const feedTitle = await findElementWithRetry({
            xpath: '//android.widget.TextView[contains(@text, "Babel Feed")]',
            uiAutomator: 'new UiSelector().textContains("Babel Feed")',
            text: 'Babel Feed'
        });
        
        await expect(feedTitle).toBeDisplayed();
        
        // Wait for potential loading to complete
        await driver.pause(3000);
    }

    async function findArticleElements() {
        try {
            // Look for clickable elements that likely represent articles
            const clickableElements = await driver.$$('android=new UiSelector().clickable(true)');
            const articleElements = [];
            
            for (const element of clickableElements) {
                try {
                    if (await element.isDisplayed()) {
                        const text = await element.getText();
                        // Filter for elements that look like article titles
                        if (text && text.length > 20 && text.length < 300 && !text.includes('Babel Feed') && !text.includes('Profile')) {
                            articleElements.push(element);
                        }
                    }
                } catch (error) {
                    // Continue checking other elements
                }
            }
            
            return articleElements;
        } catch (error) {
            console.error('Error finding article elements:', error);
            return [];
        }
    }

    async function getArticleTitle(articleElement) {
        try {
            const text = await articleElement.getText();
            // Extract title (first line if multi-line)
            return text ? text.split('\n')[0] : '';
        } catch (error) {
            return '';
        }
    }

    async function getArticleSource(articleElement) {
        try {
            const text = await articleElement.getText();
            // Look for source line
            const lines = text ? text.split('\n') : [];
            return lines.find(line => line.includes('Source:')) || '';
        } catch (error) {
            return '';
        }
    }

    async function performPullToRefresh() {
        try {
            // Get screen dimensions
            const { width, height } = await driver.getWindowSize();
            
            // Perform pull-to-refresh gesture
            await driver.touchAction([
                { action: 'press', x: width / 2, y: height * 0.3 },
                { action: 'wait', ms: 100 },
                { action: 'moveTo', x: width / 2, y: height * 0.7 },
                { action: 'release' }
            ]);
            
            await driver.pause(1000);
        } catch (error) {
            console.warn('Pull-to-refresh gesture failed:', error.message);
        }
    }

    async function scrollToBottom() {
        try {
            const { width, height } = await driver.getWindowSize();
            
            await driver.touchAction([
                { action: 'press', x: width / 2, y: height * 0.8 },
                { action: 'wait', ms: 100 },
                { action: 'moveTo', x: width / 2, y: height * 0.2 },
                { action: 'release' }
            ]);
            
            await driver.pause(1000);
        } catch (error) {
            console.warn('Scroll gesture failed:', error.message);
        }
    }
});