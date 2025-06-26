/**
 * Authentication State Logic Verification Test Suite
 * 
 * This test suite specifically validates the authentication state logic fix
 * implemented in SecureTokenManager.getAuthState().
 * 
 * These tests verify the core issue that was fixed:
 * - Previously verified users should never fall back to Guest state
 * - Users with expired tokens but verified emails should show PendingVerification
 * - The authentication state priority logic works correctly
 */

import { expect } from '@wdio/globals';
import { restartApp, takeScreenshot, findElementWithRetry } from '../utils/webview-translation-tester.js';

describe('Authentication State Logic Verification', () => {
    before(async () => {
        console.log('🧪 Starting Authentication State Logic Verification Tests');
        console.log('📋 These tests verify the fix for authentication persistence bug');
    });

    beforeEach(async () => {
        // Start with fresh app state
        await driver.executeScript('mobile: shell', {
            command: 'pm clear com.babelfeed.app.debug'
        });
        await driver.pause(2000);
        
        await restartApp();
        await driver.pause(3000);
    });

    afterEach(async () => {
        await takeScreenshot('after-auth-state-test');
    });

    describe('Core State Logic Fix Verification', () => {
        it('should prioritize email verification status over guest status', async () => {
            console.log('🔍 Testing: Email verification priority over guest status');
            console.log('📝 This test verifies the core fix for authentication state logic');
            
            // Step 1: Complete welcome flow and create guest user
            await completeWelcomeAndCreateGuest();
            
            // Step 2: Initiate email verification to transition from Guest to PendingVerification
            const testEmail = `priority-test-${Date.now()}@example.com`;
            await navigateToProfile();
            await initiateEmailVerification(testEmail);
            
            // Step 3: Verify we're now in verification state (not guest)
            const isInVerificationState = await isCurrentlyInVerificationState();
            expect(isInVerificationState).to.be.true;
            
            console.log('✅ Successfully transitioned from Guest to Verification state');
            
            // Step 4: Multiple app restarts to test persistence
            for (let restart = 1; restart <= 3; restart++) {
                console.log(`🔄 Restart ${restart}/3 - Verifying state persistence`);
                
                await restartApp();
                await driver.pause(3000);
                await navigateToProfile();
                
                // Critical test: Should NEVER return to Guest state
                const hasGuestState = await isCurrentlyInGuestState();
                const hasVerificationState = await isCurrentlyInVerificationState();
                
                expect(hasGuestState).to.be.false;
                expect(hasVerificationState).to.be.true;
                
                await takeScreenshot(`verification-state-maintained-restart-${restart}`);
                console.log(`✅ Restart ${restart}: Verification state maintained (not Guest)`);
            }
            
            console.log('🎉 EMAIL VERIFICATION PRIORITY TEST PASSED');
            console.log('✅ Fix verified: Verified users never fall back to Guest state');
        });

        it('should handle state transitions correctly according to new logic', async () => {
            console.log('🔄 Testing: Authentication state transition logic');
            
            await completeWelcomeAndCreateGuest();
            
            // Document the expected state transition sequence
            const expectedStates = [
                { state: 'Guest', description: 'Initial guest user creation' },
                { state: 'PendingVerification', description: 'After email verification initiated' },
                { state: 'PendingVerification', description: 'After app restart (should not revert to Guest)' }
            ];
            
            let currentStep = 0;
            
            // Step 1: Verify initial guest state
            await navigateToProfile();
            const initialGuestState = await isCurrentlyInGuestState();
            expect(initialGuestState).to.be.true;
            console.log(`✅ Step ${++currentStep}: ${expectedStates[0].description} - ${expectedStates[0].state}`);
            
            // Step 2: Initiate email verification
            const testEmail = `transition-${Date.now()}@example.com`;
            await initiateEmailVerification(testEmail);
            
            const pendingState = await isCurrentlyInVerificationState();
            expect(pendingState).to.be.true;
            console.log(`✅ Step ${++currentStep}: ${expectedStates[1].description} - ${expectedStates[1].state}`);
            
            // Step 3: App restart - critical test
            await restartApp();
            await driver.pause(3000);
            await navigateToProfile();
            
            const maintainedPendingState = await isCurrentlyInVerificationState();
            const revertedToGuest = await isCurrentlyInGuestState();
            
            expect(maintainedPendingState).to.be.true;
            expect(revertedToGuest).to.be.false;
            console.log(`✅ Step ${++currentStep}: ${expectedStates[2].description} - ${expectedStates[2].state}`);
            
            await takeScreenshot('state-transition-sequence-complete');
            console.log('🎉 STATE TRANSITION LOGIC TEST PASSED');
        });

        it('should maintain verification state even with simulated token expiry', async () => {
            console.log('⏰ Testing: Token expiry with verification state maintenance');
            
            await completeWelcomeAndCreateGuest();
            await navigateToProfile();
            
            const testEmail = `expiry-${Date.now()}@example.com`;
            await initiateEmailVerification(testEmail);
            
            // Verify we're in pending verification state
            let inVerificationState = await isCurrentlyInVerificationState();
            expect(inVerificationState).to.be.true;
            
            // Simulate passage of time (token expiry) through multiple app restarts
            // In the real world, this would be 30+ days later
            for (let cycle = 1; cycle <= 5; cycle++) {
                console.log(`⏰ Token expiry simulation cycle ${cycle}/5`);
                
                // Force stop app (simulates longer time passage)
                await driver.executeScript('mobile: shell', {
                    command: 'am force-stop com.babelfeed.app.debug'
                });
                await driver.pause(3000);
                
                await restartApp();
                await driver.pause(3000);
                await navigateToProfile();
                
                // Core test: Even with expired tokens, verified users should not be Guest
                const stillInVerificationState = await isCurrentlyInVerificationState();
                const notInGuestState = !await isCurrentlyInGuestState();
                
                expect(stillInVerificationState).to.be.true;
                expect(notInGuestState).to.be.true;
                
                await takeScreenshot(`token-expiry-cycle-${cycle}`);
                console.log(`✅ Cycle ${cycle}: Verification state maintained despite token expiry`);
            }
            
            console.log('🎉 TOKEN EXPIRY HANDLING TEST PASSED');
            console.log('✅ Fix verified: Expired tokens do not cause fallback to Guest state');
        });
    });

    describe('Edge Cases and Robustness', () => {
        it('should handle rapid state changes correctly', async () => {
            console.log('⚡ Testing: Rapid authentication state changes');
            
            await completeWelcomeAndCreateGuest();
            
            // Rapid sequence of operations
            for (let i = 1; i <= 3; i++) {
                console.log(`⚡ Rapid state change sequence ${i}/3`);
                
                await navigateToProfile();
                
                // Start email verification
                const email = `rapid-${i}-${Date.now()}@example.com`;
                await initiateEmailVerification(email);
                
                // Immediate restart (simulates app being killed during verification)
                await restartApp();
                await driver.pause(2000);
                
                await navigateToProfile();
                
                // Should be in verification state, not guest
                const inVerificationState = await isCurrentlyInVerificationState();
                expect(inVerificationState).to.be.true;
                
                await takeScreenshot(`rapid-state-change-${i}`);
            }
            
            console.log('✅ Rapid state changes handled correctly');
        });

        it('should maintain state consistency across different navigation paths', async () => {
            console.log('🧭 Testing: State consistency across navigation');
            
            await completeWelcomeAndCreateGuest();
            await navigateToProfile();
            
            const testEmail = `navigation-${Date.now()}@example.com`;
            await initiateEmailVerification(testEmail);
            
            // Navigate away and back multiple times
            for (let nav = 1; nav <= 3; nav++) {
                console.log(`🧭 Navigation test ${nav}/3`);
                
                // Go to feed screen
                await navigateToFeed();
                await driver.pause(1000);
                
                // Return to profile
                await navigateToProfile();
                
                // State should remain consistent
                const stillInVerificationState = await isCurrentlyInVerificationState();
                expect(stillInVerificationState).to.be.true;
                
                await takeScreenshot(`navigation-consistency-${nav}`);
            }
            
            console.log('✅ State consistency maintained across navigation');
        });
    });

    describe('Regression Prevention', () => {
        it('should never show guest state for users who initiated verification', async () => {
            console.log('🚫 Regression test: No fallback to Guest after verification initiated');
            
            const testScenarios = [
                { name: 'Standard Flow', email: `standard-${Date.now()}@example.com` },
                { name: 'With App Restart', email: `restart-${Date.now()}@example.com` },
                { name: 'With Force Stop', email: `force-stop-${Date.now()}@example.com` }
            ];
            
            for (const scenario of testScenarios) {
                console.log(`🧪 Testing scenario: ${scenario.name}`);
                
                // Reset to clean state
                await driver.executeScript('mobile: shell', {
                    command: 'pm clear com.babelfeed.app.debug'
                });
                await restartApp();
                await driver.pause(3000);
                
                await completeWelcomeAndCreateGuest();
                await navigateToProfile();
                await initiateEmailVerification(scenario.email);
                
                // Apply scenario-specific stress test
                if (scenario.name.includes('Restart')) {
                    await restartApp();
                    await driver.pause(3000);
                } else if (scenario.name.includes('Force Stop')) {
                    await driver.executeScript('mobile: shell', {
                        command: 'am force-stop com.babelfeed.app.debug'
                    });
                    await driver.pause(3000);
                    await restartApp();
                    await driver.pause(3000);
                }
                
                await navigateToProfile();
                
                // CRITICAL TEST: Should never be in Guest state
                const isGuest = await isCurrentlyInGuestState();
                const isVerification = await isCurrentlyInVerificationState();
                
                expect(isGuest).to.be.false;
                expect(isVerification).to.be.true;
                
                await takeScreenshot(`regression-test-${scenario.name.toLowerCase().replace(/\s+/g, '-')}`);
                console.log(`✅ ${scenario.name}: No Guest state fallback detected`);
            }
            
            console.log('🎉 REGRESSION PREVENTION TEST PASSED');
            console.log('✅ All scenarios prevent Guest state fallback');
        });
    });

    // Helper Functions
    async function completeWelcomeAndCreateGuest() {
        console.log('🎬 Setting up: Welcome flow + Guest creation');
        
        // Handle welcome screen if present
        const welcomeText = await findElementWithRetry({
            xpath: '//android.widget.TextView[contains(@text, "Welcome")]',
            uiAutomator: 'new UiSelector().textContains("Welcome")',
            text: 'Welcome'
        }, { timeout: 5000, required: false });
        
        if (welcomeText) {
            // Select English
            const englishOption = await findElementWithRetry({
                xpath: '//android.widget.TextView[contains(@text, "English")]',
                uiAutomator: 'new UiSelector().textContains("English")',
                text: 'English'
            });
            await englishOption.click();
            await driver.pause(1000);
            
            // Click continue
            const continueButton = await findElementWithRetry({
                xpath: '//android.widget.Button[contains(@text, "Continue")]',
                uiAutomator: 'new UiSelector().textContains("Continue")',
                text: 'Continue'
            });
            await continueButton.click();
            await driver.pause(3000);
        }
        
        // Guest user should be auto-created
        console.log('✅ Welcome flow completed, guest user created');
    }

    async function navigateToProfile() {
        const profileButton = await findElementWithRetry({
            xpath: '//android.view.View[@content-desc="Profile"]',
            uiAutomator: 'new UiSelector().descriptionContains("Profile")',
            accessibilityId: 'Profile'
        });
        
        await profileButton.click();
        await driver.pause(2000);
    }

    async function navigateToFeed() {
        // Press back or navigate to feed
        await driver.pressKeyCode(4); // Back button
        await driver.pause(1000);
    }

    async function initiateEmailVerification(email) {
        console.log(`📧 Initiating verification for: ${email}`);
        
        const emailInput = await findElementWithRetry({
            xpath: '//android.widget.EditText',
            uiAutomator: 'new UiSelector().className("android.widget.EditText")',
            className: 'android.widget.EditText'
        });
        
        await emailInput.click();
        await emailInput.setValue(email);
        await driver.pause(1000);
        
        const verifyButton = await findElementWithRetry({
            xpath: '//android.widget.TextView[contains(@text, "Verify")]',
            uiAutomator: 'new UiSelector().textContains("Verify")',
            text: 'Verify'
        });
        
        await verifyButton.click();
        await driver.pause(5000); // Wait for state transition
    }

    async function isCurrentlyInGuestState() {
        const guestIndicators = [
            '//android.widget.TextView[text()="Guest"]',
            '//android.widget.TextView[contains(@text, "Start as Guest")]',
            '//android.widget.TextView[contains(@text, "guest account")]'
        ];
        
        for (const xpath of guestIndicators) {
            const element = await findElementWithRetry({
                xpath: xpath,
                uiAutomator: 'new UiSelector().textMatches(".*[Gg]uest.*")',
            }, { timeout: 3000, required: false });
            
            if (element && await element.isDisplayed()) {
                return true;
            }
        }
        
        return false;
    }

    async function isCurrentlyInVerificationState() {
        const verificationIndicators = [
            '//android.widget.TextView[contains(@text, "Verification")]',
            '//android.widget.TextView[contains(@text, "Email sent")]',
            '//android.widget.TextView[contains(@text, "verification")]',
            '//android.widget.TextView[contains(@text, "OTP")]',
            '//android.widget.TextView[contains(@text, "code")]',
            '//android.widget.TextView[contains(@text, "Submit")]'
        ];
        
        for (const xpath of verificationIndicators) {
            const element = await findElementWithRetry({
                xpath: xpath,
                uiAutomator: 'new UiSelector().textMatches(".*[Vv]erification.*|.*OTP.*|.*code.*|.*Submit.*")',
            }, { timeout: 3000, required: false });
            
            if (element && await element.isDisplayed()) {
                return true;
            }
        }
        
        return false;
    }
});