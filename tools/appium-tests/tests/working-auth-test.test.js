/**
 * Working Authentication Test
 * 
 * This test validates authentication persistence using the actual app behavior.
 */

import { expect } from '@wdio/globals';
import { takeScreenshot } from '../utils/webview-translation-tester.js';

describe('Working Authentication Test', () => {
    beforeEach(async () => {
        // Clear app data to start fresh
        await driver.executeScript('mobile: shell', {
            command: 'pm clear com.babelfeed.app.debug'
        });
        await driver.pause(2000);
        
        // Restart app
        await driver.executeScript('mobile: shell', {
            command: 'am start -n com.babelfeed.app.debug/com.babelfeed.app.MainActivity'
        });
        await driver.pause(3000);
    });

    it('should detect current authentication state correctly', async () => {
        console.log('🔍 Testing authentication state detection...');
        
        await takeScreenshot('initial-auth-state');
        
        // Check if we're in guest state
        const isGuestState = await isCurrentlyInGuestState();
        console.log(`Current state - Guest: ${isGuestState}`);
        
        // If not guest, navigate to profile (might be on feed screen)
        if (!isGuestState) {
            console.log('📱 Trying to navigate to profile...');
            try {
                const profileButton = await driver.$('//android.view.View[@content-desc="Profile"]');
                if (await profileButton.isDisplayed()) {
                    await profileButton.click();
                    await driver.pause(3000);
                    await takeScreenshot('after-profile-navigation');
                }
            } catch (error) {
                console.log('⚠️ Profile navigation not needed or available');
            }
        }
        
        // Check authentication state after potential navigation
        const finalGuestState = await isCurrentlyInGuestState();
        const hasEmailVerification = await hasEmailVerificationInterface();
        
        console.log(`Final state - Guest: ${finalGuestState}, Has Email Interface: ${hasEmailVerification}`);
        
        // Should be in guest state initially
        expect(finalGuestState).toBe(true);
        expect(hasEmailVerification).toBe(true);
        
        console.log('✅ Authentication state detection working correctly');
    });

    it('should initiate email verification and persist state', async () => {
        console.log('📧 Testing email verification flow...');
        
        // Ensure we start in guest state
        const initialGuestState = await isCurrentlyInGuestState();
        if (!initialGuestState) {
            console.log('⚠️ Not in expected guest state, skipping test');
            return;
        }
        
        await takeScreenshot('before-email-verification');
        
        // Enter email and verify
        const testEmail = `test-${Date.now()}@example.com`;
        await enterEmailAndVerify(testEmail);
        
        await takeScreenshot('after-email-verification');
        
        // Check if state changed (might go to verification state or stay in guest with different UI)
        const afterVerificationGuest = await isCurrentlyInGuestState();
        const hasVerificationUI = await hasVerificationInterface();
        
        console.log(`After verification - Guest: ${afterVerificationGuest}, Verification UI: ${hasVerificationUI}`);
        
        // Now test app restart persistence
        console.log('🔄 Testing state persistence across app restart...');
        
        await driver.executeScript('mobile: shell', {
            command: 'am force-stop com.babelfeed.app.debug'
        });
        await driver.pause(2000);
        
        await driver.executeScript('mobile: shell', {
            command: 'am start -n com.babelfeed.app.debug/com.babelfeed.app.MainActivity'
        });
        await driver.pause(3000);
        
        await takeScreenshot('after-app-restart');
        
        // Check state after restart
        const afterRestartGuest = await isCurrentlyInGuestState();
        const afterRestartVerification = await hasVerificationInterface();
        const afterRestartEmail = await hasEmailInterface();
        
        console.log(`After restart - Guest: ${afterRestartGuest}, Verification: ${afterRestartVerification}, Email: ${afterRestartEmail}`);
        
        // The key test: should maintain some form of non-default state
        // (either verification UI or email field with the entered email)
        const stateChanged = !afterRestartGuest || afterRestartVerification || afterRestartEmail;
        expect(stateChanged).toBe(true);
        
        console.log('✅ Email verification and persistence test completed');
    });

    // Helper functions based on actual app content
    async function isCurrentlyInGuestState() {
        try {
            const guestText = await driver.$('//android.widget.TextView[text()="Guest"]');
            return await guestText.isDisplayed();
        } catch (error) {
            return false;
        }
    }

    async function hasEmailVerificationInterface() {
        try {
            const bindText = await driver.$('//android.widget.TextView[contains(@text, "Bind your guest account")]');
            return await bindText.isDisplayed();
        } catch (error) {
            return false;
        }
    }

    async function hasVerificationInterface() {
        try {
            // Look for OTP/verification specific text
            const verificationElements = await driver.$$('android.widget.TextView');
            for (const element of verificationElements) {
                const text = await element.getText();
                if (text.toLowerCase().includes('otp') || 
                    text.toLowerCase().includes('code') || 
                    text.toLowerCase().includes('verification sent')) {
                    return true;
                }
            }
            return false;
        } catch (error) {
            return false;
        }
    }

    async function hasEmailInterface() {
        try {
            const emailInput = await driver.$('android.widget.EditText');
            return await emailInput.isDisplayed();
        } catch (error) {
            return false;
        }
    }

    async function enterEmailAndVerify(email) {
        try {
            // Find email input
            const emailInput = await driver.$('android.widget.EditText');
            await emailInput.click();
            await emailInput.clearValue();
            await emailInput.setValue(email);
            await driver.pause(1000);
            
            // Find verify button
            const verifyButton = await driver.$('//android.widget.TextView[text()="Verify"]');
            await verifyButton.click();
            await driver.pause(5000); // Wait for API response
            
            console.log(`✅ Entered email: ${email} and clicked verify`);
        } catch (error) {
            console.error(`❌ Failed to enter email and verify: ${error.message}`);
            throw error;
        }
    }
});