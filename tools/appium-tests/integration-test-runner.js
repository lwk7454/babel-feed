#!/usr/bin/env node

/**
 * Integration Test Runner for Babel Feed
 * Tests the full backend-supported article list and user profile system
 */

import { remote } from 'webdriverio';
import { checkBackendHealth } from './utils/backend-health.js';
import { getAppiumConfig } from './configs/appium.config.js';

const config = getAppiumConfig();

async function runIntegrationTests() {
    console.log('🚀 Starting Babel Feed Integration Tests...');
    
    let driver;
    let testResults = {
        total: 0,
        passed: 0,
        failed: 0,
        tests: []
    };

    try {
        // Check backend health first
        console.log('🏥 Checking backend health...');
        const backendHealthy = await checkBackendHealth();
        console.log(`Backend status: ${backendHealthy ? '✅ Healthy' : '❌ Not healthy'}`);

        // Connect to Appium
        console.log('📱 Connecting to Appium server...');
        driver = await remote({
            hostname: config.server.host,
            port: config.server.port,
            path: config.server.path,
            capabilities: {
                ...config.capabilities,
                'appium:app': '/Users/pooh/dev/tauri-babel-feed/apps/babel-android/app/build/outputs/apk/debug/app-debug.apk'
            }
        });

        console.log('✅ Connected to device');

        // Wait for app to load
        await driver.pause(5000);

        // Test 1: Verify feed screen loads
        await runTest(testResults, 'Feed Screen Loads', async () => {
            const feedTitle = await driver.$('android=new UiSelector().textContains("Babel Feed")');
            const isDisplayed = await feedTitle.isDisplayed();
            if (!isDisplayed) {
                throw new Error('Feed title not found');
            }
            console.log('✅ Feed screen displayed');
        });

        // Test 2: Verify articles are loaded from backend
        await runTest(testResults, 'Articles Loaded from Backend', async () => {
            // Wait for articles to load
            await driver.pause(3000);
            
            // Look for clickable article elements
            const clickableElements = await driver.$$('android=new UiSelector().clickable(true)');
            let articleCount = 0;
            
            for (const element of clickableElements) {
                try {
                    if (await element.isDisplayed()) {
                        const text = await element.getText();
                        if (text && text.length > 20 && text.length < 300 && 
                            !text.includes('Babel Feed') && !text.includes('Profile')) {
                            articleCount++;
                        }
                    }
                } catch (error) {
                    // Continue checking other elements
                }
            }
            
            if (backendHealthy && articleCount === 0) {
                throw new Error('No articles found despite healthy backend');
            }
            
            console.log(`✅ Found ${articleCount} articles`);
        });

        // Test 3: Verify profile navigation
        await runTest(testResults, 'Profile Navigation', async () => {
            const profileButton = await driver.$('android=new UiSelector().descriptionContains("Profile")');
            const isDisplayed = await profileButton.isDisplayed();
            
            if (isDisplayed) {
                await profileButton.click();
                await driver.pause(2000);
                
                // Look for profile screen indicators
                const profileElements = await driver.$$('android=new UiSelector().textMatches(".*[Pp]rofile.*|.*[Uu]ser.*|.*[Gg]uest.*")');
                let profileScreenFound = false;
                
                for (const element of profileElements) {
                    try {
                        if (await element.isDisplayed()) {
                            profileScreenFound = true;
                            break;
                        }
                    } catch (error) {
                        // Continue checking
                    }
                }
                
                if (!profileScreenFound) {
                    throw new Error('Profile screen not found after navigation');
                }
                
                console.log('✅ Profile navigation successful');
                
                // Navigate back to feed
                await driver.back();
                await driver.pause(2000);
            } else {
                throw new Error('Profile button not found');
            }
        });

        // Test 4: Test article selection and detail navigation
        await runTest(testResults, 'Article Detail Navigation', async () => {
            // Find and click first article
            const clickableElements = await driver.$$('android=new UiSelector().clickable(true)');
            let articleClicked = false;
            
            for (const element of clickableElements) {
                try {
                    if (await element.isDisplayed()) {
                        const text = await element.getText();
                        if (text && text.length > 20 && text.length < 300 && 
                            !text.includes('Babel Feed') && !text.includes('Profile')) {
                            await element.click();
                            await driver.pause(3000);
                            articleClicked = true;
                            break;
                        }
                    }
                } catch (error) {
                    // Continue trying other elements
                }
            }
            
            if (!articleClicked) {
                throw new Error('No article available to click');
            }
            
            // Look for article detail indicators
            const detailElements = await driver.$$('android=new UiSelector().textMatches(".*[Aa]rticle.*|.*[Ss]ummary.*|.*Read.*Full.*")');
            let detailScreenFound = false;
            
            for (const element of detailElements) {
                try {
                    if (await element.isDisplayed()) {
                        detailScreenFound = true;
                        break;
                    }
                } catch (error) {
                    // Continue checking
                }
            }
            
            if (!detailScreenFound) {
                throw new Error('Article detail screen not found');
            }
            
            console.log('✅ Article detail navigation successful');
            
            // Navigate back to feed
            await driver.back();
            await driver.pause(2000);
        });

        // Test 5: Test "Read Full Article" functionality
        await runTest(testResults, 'Read Full Article Button', async () => {
            // Navigate to an article detail first
            const clickableElements = await driver.$$('android=new UiSelector().clickable(true)');
            let articleClicked = false;
            
            for (const element of clickableElements) {
                try {
                    if (await element.isDisplayed()) {
                        const text = await element.getText();
                        if (text && text.length > 20 && text.length < 300 && 
                            !text.includes('Babel Feed') && !text.includes('Profile')) {
                            await element.click();
                            await driver.pause(3000);
                            articleClicked = true;
                            break;
                        }
                    }
                } catch (error) {
                    // Continue trying other elements
                }
            }
            
            if (!articleClicked) {
                throw new Error('No article available for Read Full Article test');
            }
            
            // Look for "Read Full Article" button
            const readFullButton = await driver.$('android=new UiSelector().textContains("Read Full Article")');
            const isDisplayed = await readFullButton.isDisplayed();
            
            if (!isDisplayed) {
                throw new Error('Read Full Article button not found');
            }
            
            console.log('✅ Read Full Article button found');
            
            // Navigate back to feed
            await driver.back();
            await driver.pause(2000);
        });

    } catch (error) {
        console.error('❌ Integration test setup failed:', error);
        testResults.failed++;
    } finally {
        if (driver) {
            await driver.deleteSession();
        }
    }

    // Print results
    console.log('\n📊 Integration Test Results:');
    console.log('================================');
    console.log(`Total Tests: ${testResults.total}`);
    console.log(`Passed: ${testResults.passed} ✅`);
    console.log(`Failed: ${testResults.failed} ❌`);
    console.log(`Success Rate: ${Math.round((testResults.passed / testResults.total) * 100)}%`);
    
    console.log('\nDetailed Results:');
    testResults.tests.forEach(test => {
        console.log(`${test.status === 'passed' ? '✅' : '❌'} ${test.name}: ${test.status}`);
        if (test.error) {
            console.log(`   Error: ${test.error}`);
        }
    });

    if (testResults.failed > 0) {
        process.exit(1);
    }

    console.log('\n🎉 All integration tests completed successfully!');
}

async function runTest(testResults, testName, testFunction) {
    testResults.total++;
    console.log(`\n🧪 Running test: ${testName}`);
    
    try {
        await testFunction();
        testResults.passed++;
        testResults.tests.push({ name: testName, status: 'passed' });
        console.log(`✅ ${testName} passed`);
    } catch (error) {
        testResults.failed++;
        testResults.tests.push({ name: testName, status: 'failed', error: error.message });
        console.log(`❌ ${testName} failed: ${error.message}`);
    }
}

// Run the tests
runIntegrationTests().catch(console.error);