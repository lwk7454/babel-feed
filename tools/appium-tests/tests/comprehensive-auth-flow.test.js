/**
 * Comprehensive Authentication Flow Test Suite
 * 
 * This test suite provides complete coverage for authentication persistence
 * scenarios using the AuthenticationHelper utility. It validates the fix
 * implemented for the authentication state logic bug.
 */

import { $, expect } from '@wdio/globals';
import { restartApp, takeScreenshot } from '../utils/webview-translation-tester.js';
import AuthenticationHelper from '../utils/authentication-helper.js';

describe('Comprehensive Authentication Flow Tests', () => {
    let authHelper;

    before(async () => {
        console.log('🧪 Starting Comprehensive Authentication Flow Tests');
        console.log('📋 Testing the fix for authentication persistence bug');
        
        authHelper = new AuthenticationHelper(driver);
    });

    beforeEach(async () => {
        // Start with clean app state for each test
        await authHelper.clearAppDataAndRestart();
    });

    afterEach(async () => {
        await authHelper.takeAuthScreenshot('test-complete');
    });

    describe('Authentication State Persistence Fix Validation', () => {
        it('should validate the SecureTokenManager fix completely', async () => {
            console.log('🔧 Running comprehensive SecureTokenManager fix validation');
            
            const result = await authHelper.testSecureTokenManagerFix();
            
            expect(result.success).to.be.true;
            
            if (result.success) {
                console.log('🎉 AUTHENTICATION PERSISTENCE FIX VALIDATED SUCCESSFULLY');
            } else {
                console.log('❌ Authentication persistence fix validation failed');
                console.log('Detailed results:', result.details);
                throw new Error('SecureTokenManager fix validation failed');
            }
        });

        it('should reproduce and verify the original bug is fixed', async () => {
            console.log('🐛 Reproducing original authentication persistence bug');
            
            const result = await authHelper.reproduceAuthenticationPersistenceBug();
            
            // The bug should NOT be reproducible anymore (it should be fixed)
            expect(result.bugReproduced).to.be.false;
            
            if (!result.bugReproduced) {
                console.log('✅ ORIGINAL BUG IS FIXED: No fallback to Guest state detected');
            } else {
                console.log('❌ ORIGINAL BUG STILL EXISTS: User fell back to Guest state');
                throw new Error('Authentication persistence bug is not fixed');
            }
        });
    });

    describe('State Transition Validation', () => {
        it('should handle all authentication state transitions correctly', async () => {
            console.log('🔄 Testing all authentication state transitions');
            
            // Start with welcome flow
            await authHelper.completeWelcomeFlow();
            await authHelper.createGuestUser();
            
            // Test: None/Welcome -> Guest
            let currentState = await authHelper.getCurrentAuthenticationState();
            expect(currentState).to.equal(authHelper.authStates.GUEST);
            console.log('✅ Transition to Guest state confirmed');
            
            // Test: Guest -> Pending Verification
            const testEmail = authHelper.generateTestEmail('transition');
            await authHelper.initiateEmailVerification(testEmail);
            
            currentState = await authHelper.getCurrentAuthenticationState();
            expect(currentState).to.equal(authHelper.authStates.PENDING_VERIFICATION);
            console.log('✅ Transition to Pending Verification confirmed');
            
            // Test: Persistence across restart
            const persistenceResult = await authHelper.verifyStatePersistence(
                authHelper.authStates.PENDING_VERIFICATION, 
                'after-verification-initiated'
            );
            expect(persistenceResult).to.be.true;
            console.log('✅ State persistence across restart confirmed');
            
            // Test: No fallback to Guest
            currentState = await authHelper.getCurrentAuthenticationState();
            expect(currentState).to.not.equal(authHelper.authStates.GUEST);
            console.log('✅ No fallback to Guest state confirmed');
        });

        it('should maintain state consistency across multiple restart cycles', async () => {
            console.log('🔄 Testing state consistency across multiple restarts');
            
            await authHelper.completeWelcomeFlow();
            await authHelper.createGuestUser();
            
            const testEmail = authHelper.generateTestEmail('multi-restart');
            await authHelper.initiateEmailVerification(testEmail);
            
            // Verify initial pending verification state
            let state = await authHelper.getCurrentAuthenticationState();
            expect(state).to.equal(authHelper.authStates.PENDING_VERIFICATION);
            
            // Test multiple restart cycles
            for (let cycle = 1; cycle <= 5; cycle++) {
                console.log(`🔄 Restart cycle ${cycle}/5`);
                
                await authHelper.restartApp();
                await authHelper.navigateToProfile();
                
                state = await authHelper.getCurrentAuthenticationState();
                
                // Critical assertion: Should never be Guest
                expect(state).to.not.equal(authHelper.authStates.GUEST);
                // Should be Pending Verification
                expect(state).to.equal(authHelper.authStates.PENDING_VERIFICATION);
                
                await authHelper.takeAuthScreenshot(`multi-restart-cycle-${cycle}`);
                console.log(`✅ Cycle ${cycle}: State maintained as ${state}`);
            }
            
            console.log('🎉 Multiple restart consistency test PASSED');
        });
    });

    describe('Edge Cases and Stress Testing', () => {
        it('should handle force app termination gracefully', async () => {
            console.log('💥 Testing force app termination handling');
            
            await authHelper.completeWelcomeFlow();
            await authHelper.createGuestUser();
            
            const testEmail = authHelper.generateTestEmail('force-stop');
            await authHelper.initiateEmailVerification(testEmail);
            
            // Force terminate the app (simulates crash/force close)
            await driver.executeScript('mobile: shell', {
                command: 'am force-stop com.babelfeed.app.debug'
            });
            await driver.pause(3000);
            
            // Restart app
            await driver.executeScript('mobile: shell', {
                command: 'am start -n com.babelfeed.app.debug/com.babelfeed.app.MainActivity'
            });
            await driver.pause(3000);
            
            await authHelper.navigateToProfile();
            
            // Should still maintain verification state
            const state = await authHelper.getCurrentAuthenticationState();
            expect(state).to.equal(authHelper.authStates.PENDING_VERIFICATION);
            
            console.log('✅ Force termination handled gracefully');
        });

        it('should handle rapid state changes without corruption', async () => {
            console.log('⚡ Testing rapid state changes');
            
            await authHelper.completeWelcomeFlow();
            await authHelper.createGuestUser();
            
            // Rapid sequence of email verifications and restarts
            for (let i = 1; i <= 3; i++) {
                console.log(`⚡ Rapid sequence ${i}/3`);
                
                const email = authHelper.generateTestEmail(`rapid-${i}`);
                await authHelper.initiateEmailVerification(email);
                
                // Immediate restart
                await authHelper.restartApp();
                await authHelper.navigateToProfile();
                
                const state = await authHelper.getCurrentAuthenticationState();
                expect(state).to.equal(authHelper.authStates.PENDING_VERIFICATION);
                
                await authHelper.takeAuthScreenshot(`rapid-sequence-${i}`);
            }
            
            console.log('✅ Rapid state changes handled correctly');
        });

        it('should maintain state under memory pressure simulation', async () => {
            console.log('💾 Testing state persistence under memory pressure');
            
            await authHelper.completeWelcomeFlow();
            await authHelper.createGuestUser();
            
            const testEmail = authHelper.generateTestEmail('memory-pressure');
            await authHelper.initiateEmailVerification(testEmail);
            
            // Simulate memory pressure by starting other apps
            const memoryPressureApps = [
                'com.android.settings',
                'com.android.chrome',
                'com.google.android.calculator'
            ];
            
            for (const app of memoryPressureApps) {
                try {
                    await driver.executeScript('mobile: shell', {
                        command: `am start -n ${app}/.MainActivity`
                    });
                    await driver.pause(1000);
                } catch (error) {
                    console.log(`⚠️ Could not start ${app} for memory pressure test`);
                }
            }
            
            // Return to our app
            await driver.executeScript('mobile: shell', {
                command: 'am start -n com.babelfeed.app.debug/com.babelfeed.app.MainActivity'
            });
            await driver.pause(3000);
            
            await authHelper.navigateToProfile();
            
            // State should still be maintained
            const state = await authHelper.getCurrentAuthenticationState();
            expect(state).to.equal(authHelper.authStates.PENDING_VERIFICATION);
            
            console.log('✅ State maintained under memory pressure');
        });
    });

    describe('Authentication Flow Regression Tests', () => {
        it('should prevent regression of the original authentication bug', async () => {
            console.log('🛡️ Running regression prevention test');
            
            // This test specifically validates that the bug described in the issue doesn't return
            const scenarios = [
                { name: 'Standard Flow', forceStop: false, delay: 0 },
                { name: 'With Delay', forceStop: false, delay: 5000 },
                { name: 'With Force Stop', forceStop: true, delay: 0 },
                { name: 'Complex Scenario', forceStop: true, delay: 10000 }
            ];
            
            for (const scenario of scenarios) {
                console.log(`🧪 Testing regression scenario: ${scenario.name}`);
                
                // Reset for each scenario
                await authHelper.clearAppDataAndRestart();
                await authHelper.completeWelcomeFlow();
                await authHelper.createGuestUser();
                
                const email = authHelper.generateTestEmail(`regression-${scenario.name.toLowerCase().replace(/\s+/g, '-')}`);
                await authHelper.initiateEmailVerification(email);
                
                // Apply scenario-specific conditions
                if (scenario.delay > 0) {
                    await driver.pause(scenario.delay);
                }
                
                if (scenario.forceStop) {
                    await driver.executeScript('mobile: shell', {
                        command: 'am force-stop com.babelfeed.app.debug'
                    });
                    await driver.pause(2000);
                    
                    await driver.executeScript('mobile: shell', {
                        command: 'am start -n com.babelfeed.app.debug/com.babelfeed.app.MainActivity'
                    });
                    await driver.pause(3000);
                } else {
                    await authHelper.restartApp();
                }
                
                await authHelper.navigateToProfile();
                
                // Critical regression test: Should NEVER be Guest
                const state = await authHelper.getCurrentAuthenticationState();
                expect(state).to.not.equal(authHelper.authStates.GUEST);
                expect(state).to.equal(authHelper.authStates.PENDING_VERIFICATION);
                
                await authHelper.takeAuthScreenshot(`regression-${scenario.name.toLowerCase().replace(/\s+/g, '-')}`);
                console.log(`✅ ${scenario.name}: No regression detected`);
            }
            
            console.log('🎉 REGRESSION PREVENTION TEST PASSED');
        });
    });

    describe('Performance and Reliability', () => {
        it('should maintain authentication state with acceptable performance', async () => {
            console.log('⚡ Testing authentication state performance');
            
            await authHelper.completeWelcomeFlow();
            await authHelper.createGuestUser();
            
            const testEmail = authHelper.generateTestEmail('performance');
            await authHelper.initiateEmailVerification(testEmail);
            
            // Measure restart and state detection performance
            const startTime = Date.now();
            
            await authHelper.restartApp();
            await authHelper.navigateToProfile();
            
            const state = await authHelper.getCurrentAuthenticationState();
            
            const endTime = Date.now();
            const totalTime = endTime - startTime;
            
            console.log(`⏱️ Total time for restart and state detection: ${totalTime}ms`);
            
            // Verify state is correct
            expect(state).to.equal(authHelper.authStates.PENDING_VERIFICATION);
            
            // Performance expectation: Should complete within 15 seconds
            expect(totalTime).to.be.lessThan(15000);
            
            console.log('✅ Performance requirements met');
        });

        it('should handle authentication state reliably across 10 restart cycles', async () => {
            console.log('🔄 Testing reliability across 10 restart cycles');
            
            await authHelper.completeWelcomeFlow();
            await authHelper.createGuestUser();
            
            const testEmail = authHelper.generateTestEmail('reliability');
            await authHelper.initiateEmailVerification(testEmail);
            
            let successfulCycles = 0;
            
            for (let cycle = 1; cycle <= 10; cycle++) {
                console.log(`🔄 Reliability cycle ${cycle}/10`);
                
                await authHelper.restartApp();
                await authHelper.navigateToProfile();
                
                const state = await authHelper.getCurrentAuthenticationState();
                
                if (state === authHelper.authStates.PENDING_VERIFICATION) {
                    successfulCycles++;
                    console.log(`✅ Cycle ${cycle}: State maintained correctly`);
                } else {
                    console.log(`❌ Cycle ${cycle}: State not maintained (got ${state})`);
                }
                
                if (cycle % 3 === 0) {
                    await authHelper.takeAuthScreenshot(`reliability-cycle-${cycle}`);
                }
            }
            
            // Expect at least 90% success rate (9 out of 10 cycles)
            const successRate = (successfulCycles / 10) * 100;
            console.log(`📊 Success rate: ${successRate}% (${successfulCycles}/10 cycles)`);
            
            expect(successfulCycles).to.be.at.least(9);
            
            console.log('✅ Reliability test passed');
        });
    });
});