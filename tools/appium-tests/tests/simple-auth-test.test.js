/**
 * Simple Authentication Test
 * 
 * This test validates basic authentication navigation and profile access.
 */

import { expect } from '@wdio/globals';
import { findElementWithRetry, takeScreenshot } from '../utils/webview-translation-tester.js';

describe('Simple Authentication Test', () => {
    it('should navigate to profile screen', async () => {
        console.log('🧪 Testing profile navigation...');
        
        // Wait for app to load
        await driver.pause(3000);
        
        // Take initial screenshot
        await takeScreenshot('before-profile-navigation');
        
        // Find profile button using the same selector as the basic test showed
        const profileButton = await findElementWithRetry({
            xpath: '//android.view.View[@content-desc="Profile"]',
            uiAutomator: 'new UiSelector().descriptionContains("Profile")',
            accessibilityId: 'Profile'
        });
        
        expect(profileButton).toBeTruthy();
        console.log('✅ Found profile button');
        
        // Click on profile
        await profileButton.click();
        await driver.pause(2000);
        
        // Take screenshot after navigation
        await takeScreenshot('after-profile-navigation');
        
        // Check if we're on profile screen by looking for common profile elements
        const pageSource = await driver.getPageSource();
        
        // Look for email-related elements or guest account indicators
        const hasEmailInput = pageSource.includes('EditText');
        const hasProfileContent = pageSource.includes('guest') || pageSource.includes('Guest') || hasEmailInput;
        
        expect(hasProfileContent).toBe(true);
        console.log('✅ Successfully navigated to profile screen');
    });

    it('should handle profile interactions', async () => {
        console.log('🔍 Testing profile interactions...');
        
        // Navigate to profile first
        const profileButton = await findElementWithRetry({
            xpath: '//android.view.View[@content-desc="Profile"]',
            uiAutomator: 'new UiSelector().descriptionContains("Profile")',
            accessibilityId: 'Profile'
        }, { timeout: 5000, required: false });

        if (profileButton) {
            await profileButton.click();
            await driver.pause(2000);
        }
        
        // Take screenshot of profile screen
        await takeScreenshot('profile-screen-interaction');
        
        // Look for email input field
        const emailInput = await findElementWithRetry({
            xpath: '//android.widget.EditText',
            uiAutomator: 'new UiSelector().className("android.widget.EditText")',
            className: 'android.widget.EditText'
        }, { timeout: 5000, required: false });
        
        if (emailInput) {
            console.log('✅ Found email input field');
            
            // Try entering test email
            await emailInput.click();
            await emailInput.setValue('test@example.com');
            await driver.pause(1000);
            
            console.log('✅ Successfully entered email');
            await takeScreenshot('email-entered');
        } else {
            console.log('⚠️ No email input found - may already be in different state');
        }
        
        console.log('✅ Profile interaction test completed');
    });
});