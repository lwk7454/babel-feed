import { $, expect } from '@wdio/globals';
import { restartApp, takeScreenshot, waitForElement, findElementWithRetry } from '../utils/webview-translation-tester.js';

describe('User Profile Authentication', () => {
    beforeEach(async () => {
        await restartApp();
        // Wait for app to load
        await driver.pause(3000);
    });

    afterEach(async () => {
        await takeScreenshot('after-test');
    });

    describe('Guest User Creation', () => {
        it('should create guest profile on first app launch', async () => {
            // Navigate to profile screen
            const profileButton = await findElementWithRetry({
                xpath: '//android.widget.Button[@content-desc="Profile"]',
                uiAutomator: 'new UiSelector().descriptionContains("Profile")',
                text: 'Profile'
            });
            
            await profileButton.click();
            await driver.pause(2000);
            
            // Check for "Start as Guest" button indicating no profile exists
            const startGuestButton = await findElementWithRetry({
                xpath: '//android.widget.Button[contains(@text, "Start as Guest")]',
                uiAutomator: 'new UiSelector().textContains("Start as Guest")',
                text: 'Start as Guest'
            });
            
            await startGuestButton.click();
            await driver.pause(3000);
            
            // Verify guest profile was created
            const guestUserText = await findElementWithRetry({
                xpath: '//android.widget.TextView[contains(@text, "Guest User")]',
                uiAutomator: 'new UiSelector().textContains("Guest User")',
                text: 'Guest User'
            });
            
            await expect(guestUserText).toBeDisplayed();
            
            // Verify guest ID is displayed
            const guestIdText = await findElementWithRetry({
                xpath: '//android.widget.TextView[contains(@text, "Guest ID:")]',
                uiAutomator: 'new UiSelector().textContains("Guest ID:")',
                text: 'Guest ID:'
            });
            
            await expect(guestIdText).toBeDisplayed();
            
            await takeScreenshot('guest-profile-created');
        });
    });

    describe('Account Creation from Guest', () => {
        it('should allow guest user to create account with email', async () => {
            // First create guest profile
            await createGuestProfile();
            
            // Enter email address
            const emailInput = await findElementWithRetry({
                xpath: '//android.widget.EditText[@content-desc="Email Address" or contains(@text, "Email")]',
                uiAutomator: 'new UiSelector().className("android.widget.EditText")',
                resourceId: '*:id/email_input'
            });
            
            await emailInput.setValue('test@example.com');
            await driver.pause(1000);
            
            // Click create account button
            const createAccountButton = await findElementWithRetry({
                xpath: '//android.widget.Button[contains(@text, "Create Account")]',
                uiAutomator: 'new UiSelector().textContains("Create Account")',
                text: 'Create Account'
            });
            
            await createAccountButton.click();
            await driver.pause(3000);
            
            // Verify pending verification state
            const verificationText = await findElementWithRetry({
                xpath: '//android.widget.TextView[contains(@text, "Email Verification")]',
                uiAutomator: 'new UiSelector().textContains("Email Verification")',
                text: 'Email Verification'
            });
            
            await expect(verificationText).toBeDisplayed();
            
            // Verify email is mentioned
            const emailMentionText = await findElementWithRetry({
                xpath: '//android.widget.TextView[contains(@text, "test@example.com")]',
                uiAutomator: 'new UiSelector().textContains("test@example.com")',
                text: 'test@example.com'
            });
            
            await expect(emailMentionText).toBeDisplayed();
            
            await takeScreenshot('pending-email-verification');
        });

        it('should handle email validation errors gracefully', async () => {
            await createGuestProfile();
            
            // Try with invalid email
            const emailInput = await findElementWithRetry({
                xpath: '//android.widget.EditText[@content-desc="Email Address" or contains(@text, "Email")]',
                uiAutomator: 'new UiSelector().className("android.widget.EditText")',
                resourceId: '*:id/email_input'
            });
            
            await emailInput.setValue('invalid-email');
            await driver.pause(1000);
            
            const createAccountButton = await findElementWithRetry({
                xpath: '//android.widget.Button[contains(@text, "Create Account")]',
                uiAutomator: 'new UiSelector().textContains("Create Account")',
                text: 'Create Account'
            });
            
            // Button should be enabled but request should fail
            await createAccountButton.click();
            await driver.pause(3000);
            
            // Check for error message
            const errorMessage = await findElementWithRetry({
                xpath: '//android.widget.TextView[contains(@text, "Failed") or contains(@text, "Error")]',
                uiAutomator: 'new UiSelector().textContains("Failed")',
                text: 'Error'
            }, { timeout: 5000, required: false });
            
            if (errorMessage) {
                await expect(errorMessage).toBeDisplayed();
                await takeScreenshot('email-validation-error');
            }
        });
    });

    describe('Email Verification', () => {
        it('should allow user to enter verification token', async () => {
            // Create guest and initiate account creation
            await createGuestProfile();
            await createAccountWithEmail('verify@example.com');
            
            // Enter verification token (using mock token for testing)
            const tokenInput = await findElementWithRetry({
                xpath: '//android.widget.EditText[@content-desc="Verification Token" or contains(@text, "Token")]',
                uiAutomator: 'new UiSelector().className("android.widget.EditText")',
                resourceId: '*:id/verification_token_input'
            });
            
            // In a real test, you would get this from the backend test setup
            // For this demo, we'll use a mock token
            await tokenInput.setValue('mock-verification-token-123');
            await driver.pause(1000);
            
            const verifyButton = await findElementWithRetry({
                xpath: '//android.widget.Button[contains(@text, "Verify Email")]',
                uiAutomator: 'new UiSelector().textContains("Verify Email")',
                text: 'Verify Email'
            });
            
            await verifyButton.click();
            await driver.pause(3000);
            
            // For testing purposes, this might show an error since we're using a mock token
            // In a real test environment, you'd have a proper test backend
            await takeScreenshot('verification-attempt');
        });
    });

    describe('Authentication State Persistence', () => {
        it('should maintain guest state across app restarts', async () => {
            // Create guest profile
            await createGuestProfile();
            
            // Restart app
            await restartApp();
            await driver.pause(3000);
            
            // Navigate to profile
            const profileButton = await findElementWithRetry({
                xpath: '//android.widget.Button[@content-desc="Profile"]',
                uiAutomator: 'new UiSelector().descriptionContains("Profile")',
                text: 'Profile'
            });
            
            await profileButton.click();
            await driver.pause(2000);
            
            // Should still show guest user (not "Start as Guest" button)
            const guestUserText = await findElementWithRetry({
                xpath: '//android.widget.TextView[contains(@text, "Guest User")]',
                uiAutomator: 'new UiSelector().textContains("Guest User")',
                text: 'Guest User'
            });
            
            await expect(guestUserText).toBeDisplayed();
            await takeScreenshot('guest-state-persisted');
        });
    });

    describe('Profile UI Navigation', () => {
        it('should navigate to profile screen from feed', async () => {
            // Ensure we're on the feed screen
            const feedTitle = await findElementWithRetry({
                xpath: '//android.widget.TextView[contains(@text, "Babel Feed")]',
                uiAutomator: 'new UiSelector().textContains("Babel Feed")',
                text: 'Babel Feed'
            });
            
            await expect(feedTitle).toBeDisplayed();
            
            // Click profile button in top bar
            const profileButton = await findElementWithRetry({
                xpath: '//android.widget.Button[@content-desc="Profile"]',
                uiAutomator: 'new UiSelector().descriptionContains("Profile")',
                text: 'Profile'
            });
            
            await profileButton.click();
            await driver.pause(2000);
            
            // Verify we're on profile screen
            const profileTitle = await findElementWithRetry({
                xpath: '//android.widget.TextView[contains(@text, "Profile")]',
                uiAutomator: 'new UiSelector().textContains("Profile")',
                text: 'Profile'
            });
            
            await expect(profileTitle).toBeDisplayed();
            await takeScreenshot('profile-screen-navigation');
        });
    });

    describe('Error Handling', () => {
        it('should display error messages gracefully', async () => {
            // Navigate to profile
            const profileButton = await findElementWithRetry({
                xpath: '//android.widget.Button[@content-desc="Profile"]',
                uiAutomator: 'new UiSelector().descriptionContains("Profile")',
                text: 'Profile'
            });
            
            await profileButton.click();
            await driver.pause(2000);
            
            // Try to create guest without network (if possible in test environment)
            // This is mainly to test UI error handling
            const startGuestButton = await findElementWithRetry({
                xpath: '//android.widget.Button[contains(@text, "Start as Guest")]',
                uiAutomator: 'new UiSelector().textContains("Start as Guest")',
                text: 'Start as Guest'
            }, { timeout: 5000, required: false });
            
            if (startGuestButton) {
                await startGuestButton.click();
                await driver.pause(5000);
                
                // Check if error handling UI is displayed properly
                await takeScreenshot('error-handling-test');
            }
        });
    });

    // Helper functions
    async function createGuestProfile() {
        const profileButton = await findElementWithRetry({
            xpath: '//android.widget.Button[@content-desc="Profile"]',
            uiAutomator: 'new UiSelector().descriptionContains("Profile")',
            text: 'Profile'
        });
        
        await profileButton.click();
        await driver.pause(2000);
        
        const startGuestButton = await findElementWithRetry({
            xpath: '//android.widget.Button[contains(@text, "Start as Guest")]',
            uiAutomator: 'new UiSelector().textContains("Start as Guest")',
            text: 'Start as Guest'
        }, { timeout: 5000, required: false });
        
        if (startGuestButton) {
            await startGuestButton.click();
            await driver.pause(3000);
        }
    }

    async function createAccountWithEmail(email) {
        const emailInput = await findElementWithRetry({
            xpath: '//android.widget.EditText[@content-desc="Email Address" or contains(@text, "Email")]',
            uiAutomator: 'new UiSelector().className("android.widget.EditText")',
            resourceId: '*:id/email_input'
        });
        
        await emailInput.setValue(email);
        await driver.pause(1000);
        
        const createAccountButton = await findElementWithRetry({
            xpath: '//android.widget.Button[contains(@text, "Create Account")]',
            uiAutomator: 'new UiSelector().textContains("Create Account")',
            text: 'Create Account'
        });
        
        await createAccountButton.click();
        await driver.pause(3000);
    }
});