/**
 * Debug Authentication State Test
 * 
 * This test shows exactly what's on the profile screen to help debug authentication states.
 */

import { expect } from '@wdio/globals';
import { findElementWithRetry, takeScreenshot } from '../utils/webview-translation-tester.js';

describe('Debug Authentication State', () => {
    it('should show all text elements on profile screen', async () => {
        console.log('🔍 Debugging profile screen content...');
        
        // Wait for app to load
        await driver.pause(3000);
        
        // Navigate to profile
        const profileButton = await findElementWithRetry({
            xpath: '//android.view.View[@content-desc="Profile"]',
            uiAutomator: 'new UiSelector().descriptionContains("Profile")',
            accessibilityId: 'Profile'
        });
        
        await profileButton.click();
        await driver.pause(3000);
        
        // Take screenshot
        await takeScreenshot('debug-profile-screen');
        
        // Get all TextView elements
        const textElements = await driver.$$('android.widget.TextView');
        console.log(`\n📱 Found ${textElements.length} TextView elements on profile screen:`);
        
        for (let i = 0; i < textElements.length && i < 10; i++) {  // Limit to first 10 elements
            try {
                const text = await textElements[i].getText();
                console.log(`  ${i + 1}. "${text}"`);
            } catch (error) {
                console.log(`  ${i + 1}. [Error reading text: ${error.message}]`);
            }
        }
        
        // Get all Button elements
        const buttonElements = await driver.$$('android.widget.Button');
        console.log(`\n🔘 Found ${buttonElements.length} Button elements on profile screen:`);
        
        for (let i = 0; i < buttonElements.length && i < 5; i++) {
            try {
                const text = await buttonElements[i].getText();
                console.log(`  ${i + 1}. Button: "${text}"`);
            } catch (error) {
                console.log(`  ${i + 1}. Button: [Error reading text: ${error.message}]`);
            }
        }
        
        // Get all EditText elements  
        const editElements = await driver.$$('android.widget.EditText');
        console.log(`\n📝 Found ${editElements.length} EditText elements on profile screen:`);
        
        for (let i = 0; i < editElements.length; i++) {
            try {
                const text = await editElements[i].getText();
                const hint = await editElements[i].getAttribute('hint');
                console.log(`  ${i + 1}. EditText: "${text}" (hint: "${hint}")`);
            } catch (error) {
                console.log(`  ${i + 1}. EditText: [Error reading: ${error.message}]`);
            }
        }
        
        console.log('\n✅ Profile screen debug completed');
    });

    it('should show page source structure', async () => {
        console.log('📄 Getting page source for analysis...');
        
        // Navigate to profile if not already there
        const profileButton = await findElementWithRetry({
            xpath: '//android.view.View[@content-desc="Profile"]',
            uiAutomator: 'new UiSelector().descriptionContains("Profile")',
            accessibilityId: 'Profile'
        }, { timeout: 5000, required: false });
        
        if (profileButton) {
            await profileButton.click();
            await driver.pause(2000);
        }
        
        const pageSource = await driver.getPageSource();
        
        // Extract key information about authentication-related elements
        const hasGuest = pageSource.toLowerCase().includes('guest');
        const hasVerification = pageSource.toLowerCase().includes('verification') || pageSource.toLowerCase().includes('verify');
        const hasOTP = pageSource.toLowerCase().includes('otp') || pageSource.toLowerCase().includes('code');
        const hasEmail = pageSource.toLowerCase().includes('email');
        const hasSubmit = pageSource.toLowerCase().includes('submit');
        
        console.log('\n🔍 Authentication-related content analysis:');
        console.log(`  - Contains "guest": ${hasGuest}`);
        console.log(`  - Contains "verification/verify": ${hasVerification}`);
        console.log(`  - Contains "otp/code": ${hasOTP}`);
        console.log(`  - Contains "email": ${hasEmail}`);
        console.log(`  - Contains "submit": ${hasSubmit}`);
        
        // Look for specific authentication state indicators
        if (pageSource.includes('guest') || pageSource.includes('Guest')) {
            console.log('🎭 Likely in GUEST state');
        }
        if (pageSource.includes('verification') || pageSource.includes('Verification') || pageSource.includes('OTP')) {
            console.log('📧 Likely in VERIFICATION state');
        }
        if (pageSource.includes('authenticated') || pageSource.includes('verified')) {
            console.log('✅ Likely in AUTHENTICATED state');
        }
        
        console.log('\n✅ Page source analysis completed');
    });
});