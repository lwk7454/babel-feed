/**
 * Authentication Testing Helper Utility
 * 
 * This utility provides common functions for testing authentication flows
 * and state persistence in the Babel Feed mobile application.
 */

import { findElementWithRetry, takeScreenshot } from './webview-translation-tester.js';

export class AuthenticationHelper {
    constructor(driver) {
        this.driver = driver;
        this.currentTestEmail = null;
        this.authStates = {
            NONE: 'none',
            GUEST: 'guest', 
            PENDING_VERIFICATION: 'pending_verification',
            AUTHENTICATED: 'authenticated'
        };
    }

    /**
     * Complete the welcome flow and language selection
     */
    async completeWelcomeFlow() {
        console.log('👋 Completing welcome flow...');
        
        const welcomeText = await findElementWithRetry({
            xpath: '//android.widget.TextView[contains(@text, "Welcome")]',
            uiAutomator: 'new UiSelector().textContains("Welcome")',
            text: 'Welcome'
        }, { timeout: 10000, required: false });
        
        if (welcomeText) {
            console.log('📱 Welcome screen detected, completing language selection');
            
            // Select English language
            const englishOption = await findElementWithRetry({
                xpath: '//android.widget.TextView[contains(@text, "English")]',
                uiAutomator: 'new UiSelector().textContains("English")',
                text: 'English'
            });
            
            await englishOption.click();
            await this.driver.pause(1000);
            
            // Click continue button
            const continueButton = await findElementWithRetry({
                xpath: '//android.widget.Button[contains(@text, "Continue")]',
                uiAutomator: 'new UiSelector().textContains("Continue")',
                text: 'Continue'
            });
            
            await continueButton.click();
            await this.driver.pause(3000);
            console.log('✅ Welcome flow completed');
        } else {
            console.log('📱 No welcome screen detected, proceeding');
        }
    }

    /**
     * Navigate to the profile screen
     */
    async navigateToProfile() {
        console.log('📱 Navigating to profile screen...');
        
        const profileButton = await findElementWithRetry({
            xpath: '//android.view.View[@content-desc="Profile"]',
            uiAutomator: 'new UiSelector().descriptionContains("Profile")',
            accessibilityId: 'Profile'
        });
        
        await profileButton.click();
        await this.driver.pause(2000);
        console.log('✅ Navigated to profile screen');
    }

    /**
     * Create a guest user account
     */
    async createGuestUser() {
        console.log('👤 Creating guest user...');
        
        await this.navigateToProfile();
        
        // Check if guest user already exists by looking for verification UI
        const verifyButton = await findElementWithRetry({
            xpath: '//android.widget.TextView[contains(@text, "Verify")]',
            uiAutomator: 'new UiSelector().textContains("Verify")',
            text: 'Verify'
        }, { timeout: 5000, required: false });
        
        if (verifyButton) {
            console.log('✅ Guest user already exists');
            return 'existing-guest';
        }
        
        // Guest user should be auto-created by the app
        await this.driver.pause(2000);
        console.log('✅ Guest user created');
        return 'new-guest';
    }

    /**
     * Initiate email verification process
     */
    async initiateEmailVerification(email) {
        console.log(`📧 Initiating email verification for: ${email}`);
        this.currentTestEmail = email;
        
        // Find and fill email input
        const emailInput = await findElementWithRetry({
            xpath: '//android.widget.EditText',
            uiAutomator: 'new UiSelector().className("android.widget.EditText")',
            className: 'android.widget.EditText'
        });
        
        await emailInput.click();
        await emailInput.clearValue();
        await emailInput.setValue(email);
        await this.driver.pause(1000);
        
        // Click verify button
        const verifyButton = await findElementWithRetry({
            xpath: '//android.widget.TextView[contains(@text, "Verify")]',
            uiAutomator: 'new UiSelector().textContains("Verify")',
            text: 'Verify'
        });
        
        await verifyButton.click();
        await this.driver.pause(5000); // Wait for API response
        
        console.log('✅ Email verification initiated');
        return email;
    }

    /**
     * Attempt to complete email verification with OTP
     */
    async attemptEmailVerification(otpCode = '1234') {
        console.log(`🔐 Attempting email verification with OTP: ${otpCode}`);
        
        const otpInput = await findElementWithRetry({
            xpath: '//android.widget.EditText',
            uiAutomator: 'new UiSelector().className("android.widget.EditText")',
            className: 'android.widget.EditText'
        }, { timeout: 5000, required: false });
        
        if (otpInput) {
            await otpInput.click();
            await otpInput.clearValue();
            await otpInput.setValue(otpCode);
            await this.driver.pause(1000);
            
            const submitButton = await findElementWithRetry({
                xpath: '//android.widget.TextView[contains(@text, "Submit")]',
                uiAutomator: 'new UiSelector().textContains("Submit")',
                text: 'Submit'
            }, { timeout: 5000, required: false });
            
            if (submitButton) {
                await submitButton.click();
                await this.driver.pause(5000);
                
                console.log('✅ OTP submitted');
                return true;
            }
        }
        
        console.log('⚠️ Could not complete OTP verification');
        return false;
    }

    /**
     * Detect current authentication state
     */
    async getCurrentAuthenticationState() {
        console.log('🔍 Detecting current authentication state...');
        
        // Check for authenticated state
        if (await this.isAuthenticatedState()) {
            console.log('🟢 Current state: AUTHENTICATED');
            return this.authStates.AUTHENTICATED;
        }
        
        // Check for pending verification state
        if (await this.isPendingVerificationState()) {
            console.log('🟡 Current state: PENDING_VERIFICATION');
            return this.authStates.PENDING_VERIFICATION;
        }
        
        // Check for guest state
        if (await this.isGuestState()) {
            console.log('🔵 Current state: GUEST');
            return this.authStates.GUEST;
        }
        
        console.log('🔴 Current state: NONE/UNKNOWN');
        return this.authStates.NONE;
    }

    /**
     * Check if currently in authenticated state
     */
    async isAuthenticatedState() {
        const authenticatedIndicators = [
            '//android.widget.TextView[contains(@text, "Verified")]',
            '//android.widget.TextView[contains(@text, "Authenticated")]',
            '//android.widget.TextView[contains(@text, "Settings")]'
        ];
        
        if (this.currentTestEmail) {
            authenticatedIndicators.push(`//android.widget.TextView[contains(@text, "${this.currentTestEmail}")]`);
        }
        
        for (const xpath of authenticatedIndicators) {
            const element = await findElementWithRetry({
                xpath: xpath,
                uiAutomator: 'new UiSelector().textMatches(".*[Vv]erified.*|.*[Aa]uthenticated.*|.*Settings.*")',
            }, { timeout: 3000, required: false });
            
            if (element && await element.isDisplayed()) {
                return true;
            }
        }
        
        return false;
    }

    /**
     * Check if currently in pending verification state
     */
    async isPendingVerificationState() {
        const verificationIndicators = [
            '//android.widget.TextView[contains(@text, "Verification")]',
            '//android.widget.TextView[contains(@text, "Email sent")]',
            '//android.widget.TextView[contains(@text, "OTP")]',
            '//android.widget.TextView[contains(@text, "4-digit")]',
            '//android.widget.TextView[contains(@text, "Submit")]',
            '//android.widget.TextView[contains(@text, "Resend")]'
        ];
        
        if (this.currentTestEmail) {
            verificationIndicators.push(`//android.widget.TextView[contains(@text, "${this.currentTestEmail}")]`);
        }
        
        for (const xpath of verificationIndicators) {
            const element = await findElementWithRetry({
                xpath: xpath,
                uiAutomator: 'new UiSelector().textMatches(".*[Vv]erification.*|.*OTP.*|.*Submit.*|.*Resend.*")',
            }, { timeout: 3000, required: false });
            
            if (element && await element.isDisplayed()) {
                return true;
            }
        }
        
        return false;
    }

    /**
     * Check if currently in guest state
     */
    async isGuestState() {
        const guestIndicators = [
            '//android.widget.TextView[text()="Guest"]',
            '//android.widget.TextView[contains(@text, "guest account")]',
            '//android.widget.TextView[contains(@text, "Bind your guest")]'
        ];
        
        for (const xpath of guestIndicators) {
            const element = await findElementWithRetry({
                xpath: xpath,
                uiAutomator: 'new UiSelector().textMatches(".*[Gg]uest.*|.*Bind.*")',
            }, { timeout: 3000, required: false });
            
            if (element && await element.isDisplayed()) {
                return true;
            }
        }
        
        return false;
    }

    /**
     * Restart the app and wait for it to load
     */
    async restartApp() {
        console.log('🔄 Restarting app...');
        
        await this.driver.executeScript('mobile: shell', {
            command: 'am force-stop com.babelfeed.app.debug'
        });
        await this.driver.pause(2000);
        
        await this.driver.executeScript('mobile: shell', {
            command: 'am start -n com.babelfeed.app.debug/com.babelfeed.app.MainActivity'
        });
        await this.driver.pause(3000);
        
        console.log('✅ App restarted');
    }

    /**
     * Clear app data and restart
     */
    async clearAppDataAndRestart() {
        console.log('🗑️ Clearing app data and restarting...');
        
        await this.driver.executeScript('mobile: shell', {
            command: 'pm clear com.babelfeed.app.debug'
        });
        await this.driver.pause(2000);
        
        await this.driver.executeScript('mobile: shell', {
            command: 'am start -n com.babelfeed.app.debug/com.babelfeed.app.MainActivity'
        });
        await this.driver.pause(3000);
        
        console.log('✅ App data cleared and app restarted');
    }

    /**
     * Generate a unique test email
     */
    generateTestEmail(prefix = 'test') {
        const timestamp = Date.now();
        const random = Math.floor(Math.random() * 1000);
        return `${prefix}-${timestamp}-${random}@example.com`;
    }

    /**
     * Take screenshot with authentication context
     */
    async takeAuthScreenshot(description) {
        const state = await this.getCurrentAuthenticationState();
        const filename = `auth-${state}-${description}`;
        await takeScreenshot(filename);
        console.log(`📸 Screenshot taken: ${filename}`);
    }

    /**
     * Verify authentication state persistence across app restart
     */
    async verifyStatePersistence(expectedState, description = '') {
        console.log(`🔍 Verifying state persistence: ${expectedState} ${description}`);
        
        const beforeState = await this.getCurrentAuthenticationState();
        
        await this.restartApp();
        await this.navigateToProfile();
        
        const afterState = await this.getCurrentAuthenticationState();
        
        if (beforeState === afterState && afterState === expectedState) {
            console.log(`✅ State persistence verified: ${expectedState}`);
            return true;
        } else {
            console.log(`❌ State persistence failed: expected ${expectedState}, got ${afterState}`);
            await this.takeAuthScreenshot(`persistence-failure-${description}`);
            return false;
        }
    }

    /**
     * Run the authentication persistence bug reproduction test
     */
    async reproduceAuthenticationPersistenceBug() {
        console.log('🐛 Reproducing authentication persistence bug...');
        
        // Step 1: Setup
        await this.clearAppDataAndRestart();
        await this.completeWelcomeFlow();
        await this.createGuestUser();
        
        // Step 2: Initiate verification
        const testEmail = this.generateTestEmail('bug-repro');
        await this.initiateEmailVerification(testEmail);
        
        // Step 3: Verify state before restart
        const stateBeforeRestart = await this.getCurrentAuthenticationState();
        console.log(`State before restart: ${stateBeforeRestart}`);
        
        // Step 4: Restart app
        await this.restartApp();
        await this.navigateToProfile();
        
        // Step 5: Check state after restart
        const stateAfterRestart = await this.getCurrentAuthenticationState();
        console.log(`State after restart: ${stateAfterRestart}`);
        
        // Step 6: Analyze results
        if (stateBeforeRestart === this.authStates.PENDING_VERIFICATION && 
            stateAfterRestart === this.authStates.GUEST) {
            console.log('🐛 BUG REPRODUCED: Verified user fell back to Guest state');
            await this.takeAuthScreenshot('bug-reproduced');
            return { bugReproduced: true, beforeState: stateBeforeRestart, afterState: stateAfterRestart };
        } else if (stateAfterRestart === this.authStates.PENDING_VERIFICATION) {
            console.log('✅ BUG FIXED: State properly maintained as Pending Verification');
            await this.takeAuthScreenshot('bug-fixed');
            return { bugReproduced: false, beforeState: stateBeforeRestart, afterState: stateAfterRestart };
        } else {
            console.log(`⚠️ Unexpected state transition: ${stateBeforeRestart} -> ${stateAfterRestart}`);
            await this.takeAuthScreenshot('unexpected-state');
            return { bugReproduced: null, beforeState: stateBeforeRestart, afterState: stateAfterRestart };
        }
    }

    /**
     * Test the specific fix implemented in SecureTokenManager
     */
    async testSecureTokenManagerFix() {
        console.log('🔧 Testing SecureTokenManager authentication state fix...');
        
        const testResults = {
            guestToPendingTransition: false,
            persistenceAcrossRestart: false,
            noFallbackToGuest: false,
            multipleRestartStability: false
        };
        
        // Test 1: Guest to Pending Verification transition
        await this.clearAppDataAndRestart();
        await this.completeWelcomeFlow();
        await this.createGuestUser();
        
        const initialState = await this.getCurrentAuthenticationState();
        if (initialState === this.authStates.GUEST) {
            const email = this.generateTestEmail('fix-test');
            await this.initiateEmailVerification(email);
            
            const afterVerificationState = await this.getCurrentAuthenticationState();
            if (afterVerificationState === this.authStates.PENDING_VERIFICATION) {
                testResults.guestToPendingTransition = true;
                console.log('✅ Test 1 PASSED: Guest to Pending Verification transition');
            }
        }
        
        // Test 2: Persistence across single restart
        if (testResults.guestToPendingTransition) {
            await this.restartApp();
            await this.navigateToProfile();
            
            const afterRestartState = await this.getCurrentAuthenticationState();
            if (afterRestartState === this.authStates.PENDING_VERIFICATION) {
                testResults.persistenceAcrossRestart = true;
                console.log('✅ Test 2 PASSED: State persisted across restart');
            }
        }
        
        // Test 3: No fallback to Guest
        if (testResults.persistenceAcrossRestart) {
            const currentState = await this.getCurrentAuthenticationState();
            if (currentState !== this.authStates.GUEST) {
                testResults.noFallbackToGuest = true;
                console.log('✅ Test 3 PASSED: No fallback to Guest state');
            }
        }
        
        // Test 4: Multiple restart stability
        if (testResults.noFallbackToGuest) {
            let allRestartsStable = true;
            
            for (let i = 1; i <= 3; i++) {
                await this.restartApp();
                await this.navigateToProfile();
                
                const state = await this.getCurrentAuthenticationState();
                if (state === this.authStates.GUEST) {
                    allRestartsStable = false;
                    break;
                }
            }
            
            testResults.multipleRestartStability = allRestartsStable;
            if (allRestartsStable) {
                console.log('✅ Test 4 PASSED: Multiple restart stability');
            }
        }
        
        // Overall result
        const allTestsPassed = Object.values(testResults).every(result => result === true);
        
        if (allTestsPassed) {
            console.log('🎉 ALL TESTS PASSED: SecureTokenManager fix is working correctly');
        } else {
            console.log('❌ SOME TESTS FAILED: SecureTokenManager fix needs attention');
            console.log('Test results:', testResults);
        }
        
        await this.takeAuthScreenshot('fix-test-complete');
        return { success: allTestsPassed, details: testResults };
    }
}

export default AuthenticationHelper;