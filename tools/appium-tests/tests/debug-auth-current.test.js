/**
 * Debug Current Authentication State Test
 * 
 * This test shows what's currently on screen without navigation.
 */

import { expect } from '@wdio/globals';
import { takeScreenshot } from '../utils/webview-translation-tester.js';

describe('Debug Current Authentication State', () => {
    it('should show current screen content', async () => {
        console.log('🔍 Debugging current screen content...');
        
        // Wait for app to load
        await driver.pause(3000);
        
        // Take screenshot of current screen
        await takeScreenshot('debug-current-screen');
        
        // Get all TextView elements from current screen
        const textElements = await driver.$$('android.widget.TextView');
        console.log(`\n📱 Found ${textElements.length} TextView elements on current screen:`);
        
        for (let i = 0; i < textElements.length; i++) {
            try {
                const text = await textElements[i].getText();
                if (text && text.trim().length > 0) {
                    console.log(`  ${i + 1}. "${text}"`);
                }
            } catch (error) {
                // Skip elements that can't be read
            }
        }
        
        // Check for profile button existence
        try {
            const profileButton = await driver.$('//android.view.View[@content-desc="Profile"]');
            const isDisplayed = await profileButton.isDisplayed();
            console.log(`\n🔘 Profile button found: ${isDisplayed}`);
        } catch (error) {
            console.log('\n🔘 Profile button not found');
        }
        
        // Get page source and look for auth-related content
        const pageSource = await driver.getPageSource();
        
        console.log('\n🔍 Authentication-related text search:');
        
        // Search for common authentication terms
        const authTerms = ['guest', 'Guest', 'verification', 'Verification', 'verify', 'Verify', 'email', 'Email', 'OTP', 'Submit', 'Bind'];
        
        authTerms.forEach(term => {
            const found = pageSource.includes(term);
            if (found) {
                console.log(`  ✅ Found: "${term}"`);
            }
        });
        
        console.log('\n✅ Current screen debug completed');
    });

    it('should try navigation to profile if needed', async () => {
        console.log('🧭 Attempting profile navigation...');
        
        // Try to find and click profile button
        try {
            const profileButton = await driver.$('//android.view.View[@content-desc="Profile"]');
            const isDisplayed = await profileButton.isDisplayed();
            
            if (isDisplayed) {
                console.log('📱 Profile button found, clicking...');
                await profileButton.click();
                await driver.pause(3000);
                
                await takeScreenshot('after-profile-click');
                
                // Show content after navigation
                const textElements = await driver.$$('android.widget.TextView');
                console.log(`\n📱 After navigation - Found ${textElements.length} TextView elements:`);
                
                for (let i = 0; i < Math.min(textElements.length, 8); i++) {
                    try {
                        const text = await textElements[i].getText();
                        if (text && text.trim().length > 0) {
                            console.log(`  ${i + 1}. "${text}"`);
                        }
                    } catch (error) {
                        // Skip elements that can't be read
                    }
                }
            } else {
                console.log('📱 Profile button not displayed');
            }
        } catch (error) {
            console.log(`📱 Profile button not found: ${error.message}`);
        }
        
        console.log('\n✅ Navigation test completed');
    });
});