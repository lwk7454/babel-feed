#!/usr/bin/env node

/**
 * Translation State Persistence Test
 * Tests that translation settings are maintained across URL navigation
 */

import { remote } from 'webdriverio';
import { readFileSync } from 'fs';
import path from 'path';

const config = JSON.parse(readFileSync(path.join(process.cwd(), 'configs/appium.config.js'), 'utf8'));

async function testTranslationPersistence() {
    console.log('🚀 Starting Translation State Persistence Test...');
    
    let driver;
    
    try {
        // Initialize driver
        console.log('📱 Connecting to device...');
        driver = await remote({
            hostname: config.server.host,
            port: config.server.port,
            path: config.server.path,
            capabilities: config.capabilities.android
        });

        console.log('✅ Connected to device');
        
        // Wait for app to launch
        await driver.pause(3000);
        
        // Navigate to a news article (WebView)
        console.log('🌐 Opening WebView...');
        
        // Look for article cards or links
        const articleElement = await driver.$('//android.widget.TextView[contains(@text, "title") or contains(@text, "article") or contains(@text, "news")]');
        if (await articleElement.isExisting()) {
            await articleElement.click();
            console.log('📰 Opened article in WebView');
        } else {
            // Try to find any clickable element that might open WebView
            const clickableElements = await driver.$$('//android.widget.TextView[@clickable="true"] | //android.view.View[@clickable="true"]');
            if (clickableElements.length > 0) {
                await clickableElements[0].click();
                console.log('🔗 Clicked on first clickable element');
            }
        }
        
        await driver.pause(5000); // Wait for WebView to load
        
        // Check if we're in WebView context
        const contexts = await driver.getContexts();
        console.log('📱 Available contexts:', contexts);
        
        let webViewContext = contexts.find(ctx => ctx.includes('WEBVIEW'));
        if (webViewContext) {
            console.log('🌐 Found WebView context:', webViewContext);
            await driver.switchContext(webViewContext);
            
            // Test translation state persistence
            await testTranslationStatePersistence(driver);
            
        } else {
            console.log('⚠️ No WebView context found, testing native UI for translation menu');
            
            // Look for translation menu in native UI
            const menuButton = await driver.$('//android.widget.ImageButton[@content-desc="Menu"]');
            if (await menuButton.isExisting()) {
                await menuButton.click();
                console.log('📱 Opened translation menu');
                
                // Look for translation toggle
                const translationToggle = await driver.$('//android.widget.TextView[contains(@text, "Translation")]');
                if (await translationToggle.isExisting()) {
                    console.log('✅ Found translation toggle');
                    
                    // Enable translation
                    await translationToggle.click();
                    console.log('🔄 Toggled translation');
                    
                    // Test navigation and state persistence in native UI
                    await testNativeTranslationState(driver);
                } else {
                    console.log('❌ Translation toggle not found');
                }
            }
        }
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        console.error(error.stack);
        return false;
    } finally {
        if (driver) {
            console.log('🧹 Cleaning up...');
            await driver.deleteSession();
        }
    }
    
    console.log('✅ Translation State Persistence Test Completed');
    return true;
}

async function testTranslationStatePersistence(driver) {
    console.log('🔬 Testing WebView translation state persistence...');
    
    try {
        // Check initial page
        const initialUrl = await driver.getUrl();
        console.log('📍 Initial URL:', initialUrl);
        
        // Look for translation controls (this would be in the native layer)
        await driver.switchContext('NATIVE_APP');
        
        // Find and enable translation
        const menuButton = await driver.$('//android.widget.ImageButton[@content-desc="Menu"] | //android.widget.ImageView[@content-desc="Menu"]');
        if (await menuButton.isExisting()) {
            await menuButton.click();
            console.log('📱 Opened menu');
            
            const translationOption = await driver.$('//android.widget.TextView[contains(@text, "Translation")]');
            if (await translationOption.isExisting()) {
                await translationOption.click();
                console.log('🔄 Enabled translation');
                
                // Close menu
                await driver.pressKeyCode(4); // Back button
                
                // Wait for translation to process
                await driver.pause(3000);
                
                // Switch back to WebView and navigate to a new page
                const contexts = await driver.getContexts();
                const webViewContext = contexts.find(ctx => ctx.includes('WEBVIEW'));
                if (webViewContext) {
                    await driver.switchContext(webViewContext);
                    
                    // Try to navigate to a different page
                    console.log('🔗 Attempting navigation...');
                    
                    // Look for links on the page
                    const links = await driver.$$('a[href]');
                    if (links.length > 0) {
                        const firstLink = links[0];
                        const linkHref = await firstLink.getAttribute('href');
                        console.log('🔗 Found link:', linkHref);
                        
                        await firstLink.click();
                        await driver.pause(5000); // Wait for navigation
                        
                        const newUrl = await driver.getUrl();
                        console.log('📍 New URL:', newUrl);
                        
                        if (newUrl !== initialUrl) {
                            console.log('✅ Navigation successful');
                            
                            // Check if translation state is maintained
                            // This would involve checking if the page is auto-translated
                            await driver.switchContext('NATIVE_APP');
                            
                            // Check if translation is still enabled in the menu
                            await menuButton.click();
                            const translationStatus = await driver.$('//android.widget.TextView[contains(@text, "Disable Translation")]');
                            if (await translationStatus.isExisting()) {
                                console.log('✅ Translation state persisted across navigation');
                                return true;
                            } else {
                                console.log('❌ Translation state not persisted');
                                return false;
                            }
                        } else {
                            console.log('⚠️ Navigation did not change URL');
                        }
                    } else {
                        console.log('⚠️ No links found for navigation test');
                    }
                }
            } else {
                console.log('❌ Translation option not found in menu');
            }
        } else {
            console.log('❌ Menu button not found');
        }
        
    } catch (error) {
        console.error('❌ WebView translation test failed:', error.message);
        return false;
    }
}

async function testNativeTranslationState(driver) {
    console.log('🔬 Testing native translation state...');
    
    try {
        // Simulate navigation by going back and opening another article
        await driver.pressKeyCode(4); // Back button
        await driver.pause(2000);
        
        // Try to find another article or content
        const elements = await driver.$$('//android.widget.TextView[@clickable="true"]');
        if (elements.length > 1) {
            await elements[1].click(); // Click on second element
            await driver.pause(3000);
            
            // Check if translation menu is still accessible
            const menuButton = await driver.$('//android.widget.ImageButton[@content-desc="Menu"]');
            if (await menuButton.isExisting()) {
                await menuButton.click();
                
                // Check if translation is still enabled
                const translationStatus = await driver.$('//android.widget.TextView[contains(@text, "Disable Translation")]');
                if (await translationStatus.isExisting()) {
                    console.log('✅ Translation state persisted in native navigation');
                    return true;
                } else {
                    console.log('⚠️ Translation state may not be persisted');
                }
            }
        }
        
    } catch (error) {
        console.error('❌ Native translation test failed:', error.message);
        return false;
    }
}

// Run the test
if (import.meta.url === `file://${process.argv[1]}`) {
    testTranslationPersistence()
        .then(success => {
            process.exit(success ? 0 : 1);
        })
        .catch(error => {
            console.error('💥 Fatal error:', error);
            process.exit(1);
        });
}

export default testTranslationPersistence;