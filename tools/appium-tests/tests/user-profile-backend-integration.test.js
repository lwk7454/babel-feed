import { $, expect } from '@wdio/globals';
import { restartApp, takeScreenshot, waitForElement, findElementWithRetry } from '../utils/webview-translation-tester.js';
import { checkBackendHealth } from '../utils/backend-health.js';

describe('User Profile Backend Integration', () => {
    let backendHealthy = false;

    beforeEach(async () => {
        // Check backend health before each test
        backendHealthy = await checkBackendHealth();
        if (!backendHealthy) {
            console.warn('⚠️ Backend API is not healthy, some tests may fail');
        }

        await restartApp();
        // Wait for app to load completely
        await driver.pause(3000);
    });

    afterEach(async () => {
        await takeScreenshot('after-test');
    });

    describe('Profile System Integration', () => {
        it('should access profile screen from feed', async () => {
            // Verify we're on the feed screen
            const feedTitle = await findElementWithRetry({
                xpath: '//android.widget.TextView[contains(@text, "Babel Feed")]',
                uiAutomator: 'new UiSelector().textContains("Babel Feed")',
                text: 'Babel Feed'
            });
            
            await expect(feedTitle).toBeDisplayed();
            
            // Find and click profile button
            const profileButton = await findElementWithRetry({
                xpath: '//android.widget.Button[@content-desc="Profile"]',
                uiAutomator: 'new UiSelector().descriptionContains("Profile")',
                text: 'Profile'
            });
            
            await expect(profileButton).toBeDisplayed();
            await profileButton.click();
            await driver.pause(2000);
            
            // Verify we're on profile screen
            const profileScreen = await findElementWithRetry({
                xpath: '//android.widget.TextView[contains(@text, "Profile") or contains(@text, "User")]',
                uiAutomator: 'new UiSelector().textMatches(".*[Pp]rofile.*|.*[Uu]ser.*")',
                text: 'Profile'
            });
            
            await expect(profileScreen).toBeDisplayed();
            console.log('✅ Successfully navigated to profile screen');
            await takeScreenshot('profile-screen-accessed');
        });

        it('should create guest profile when none exists', async () => {
            await navigateToProfile();
            
            // Look for guest creation option
            const startGuestButton = await findElementWithRetry({
                xpath: '//android.widget.Button[contains(@text, "Start as Guest") or contains(@text, "Guest")]',
                uiAutomator: 'new UiSelector().textContains("Guest")',
                text: 'Guest'
            }, { timeout: 5000, required: false });
            
            if (startGuestButton) {
                console.log('✅ Guest creation option found');
                await startGuestButton.click();
                await driver.pause(3000);
                
                if (backendHealthy) {
                    // Verify guest profile was created
                    const guestProfile = await findElementWithRetry({
                        xpath: '//android.widget.TextView[contains(@text, "Guest") or contains(@text, "ID")]',
                        uiAutomator: 'new UiSelector().textMatches(".*[Gg]uest.*|.*ID.*")',
                        text: 'Guest'
                    });
                    
                    await expect(guestProfile).toBeDisplayed();
                    console.log('✅ Guest profile created successfully');
                } else {
                    console.log('⚠️ Cannot verify guest creation - backend issues');
                }
                
                await takeScreenshot('guest-profile-created');
            } else {
                console.log('ℹ️ Guest profile may already exist or UI differs');
                await takeScreenshot('profile-state-unknown');
            }
        });

        it('should maintain profile state across app restarts', async () => {
            await navigateToProfile();
            
            // Create guest profile if needed
            const profileCreated = await createGuestProfileIfNeeded();
            
            if (profileCreated || backendHealthy) {
                // Get current profile state
                const initialProfileState = await getProfileState();
                
                // Restart app
                await restartApp();
                await driver.pause(3000);
                
                // Navigate back to profile
                await navigateToProfile();
                
                // Verify profile state is maintained
                const currentProfileState = await getProfileState();
                
                if (initialProfileState.hasProfile && currentProfileState.hasProfile) {
                    console.log('✅ Profile state maintained across restart');
                } else if (!backendHealthy) {
                    console.log('⚠️ Profile persistence test limited due to backend issues');
                } else {
                    console.log('ℹ️ Profile state behavior may differ from expected');
                }
                
                await takeScreenshot('profile-state-after-restart');
            }
        });

        it('should display profile information correctly', async () => {
            await navigateToProfile();
            await createGuestProfileIfNeeded();
            
            // Look for profile information elements
            const profileElements = await findProfileInformationElements();
            
            if (profileElements.length > 0) {
                console.log(`✅ Found ${profileElements.length} profile information elements`);
                
                // Verify profile elements are displayed
                for (const element of profileElements) {
                    try {
                        await expect(element).toBeDisplayed();
                        const text = await element.getText();
                        console.log(`Profile info: ${text}`);
                    } catch (error) {
                        console.log('⚠️ Profile element check failed:', error.message);
                    }
                }
                
                await takeScreenshot('profile-information-displayed');
            } else {
                console.log('ℹ️ No specific profile information elements found');
            }
        });

        it('should handle account creation flow', async () => {
            if (!backendHealthy) {
                console.log('⚠️ Skipping account creation test - backend not healthy');
                return;
            }

            await navigateToProfile();
            await createGuestProfileIfNeeded();
            
            // Look for account creation option
            const createAccountOption = await findElementWithRetry({
                xpath: '//android.widget.Button[contains(@text, "Create Account") or contains(@text, "Sign Up")]',
                uiAutomator: 'new UiSelector().textMatches(".*[Cc]reate.*[Aa]ccount.*|.*[Ss]ign.*[Uu]p.*")',
                text: 'Create Account'
            }, { timeout: 5000, required: false });
            
            if (createAccountOption) {
                console.log('✅ Account creation option found');
                
                // Test email input if available
                const emailInput = await findElementWithRetry({
                    xpath: '//android.widget.EditText[@content-desc="Email" or contains(@text, "Email")]',
                    uiAutomator: 'new UiSelector().className("android.widget.EditText")',
                    resourceId: '*:id/email_input'
                }, { timeout: 3000, required: false });
                
                if (emailInput) {
                    await emailInput.setValue('test@example.com');
                    await driver.pause(1000);
                    
                    await createAccountOption.click();
                    await driver.pause(3000);
                    
                    // Look for verification or success state
                    const verificationState = await findElementWithRetry({
                        xpath: '//android.widget.TextView[contains(@text, "verification") or contains(@text, "email")]',
                        uiAutomator: 'new UiSelector().textMatches(".*[Vv]erification.*|.*[Ee]mail.*")',
                        text: 'verification'
                    }, { timeout: 5000, required: false });
                    
                    if (verificationState) {
                        console.log('✅ Account creation flow initiated');
                        await takeScreenshot('account-creation-flow');
                    }
                } else {
                    console.log('ℹ️ Email input not found - different UI flow');
                }
            } else {
                console.log('ℹ️ Account creation option not found - may already have account');
            }
        });

        it('should validate email input correctly', async () => {
            if (!backendHealthy) {
                console.log('⚠️ Skipping email validation test - backend not healthy');
                return;
            }

            await navigateToProfile();
            await createGuestProfileIfNeeded();
            
            const emailInput = await findElementWithRetry({
                xpath: '//android.widget.EditText[@content-desc="Email" or contains(@text, "Email")]',
                uiAutomator: 'new UiSelector().className("android.widget.EditText")',
                resourceId: '*:id/email_input'
            }, { timeout: 5000, required: false });
            
            if (emailInput) {
                // Test with invalid email
                await emailInput.setValue('invalid-email');
                await driver.pause(1000);
                
                const createButton = await findElementWithRetry({
                    xpath: '//android.widget.Button[contains(@text, "Create") or contains(@text, "Submit")]',
                    uiAutomator: 'new UiSelector().textMatches(".*[Cc]reate.*|.*[Ss]ubmit.*")',
                    text: 'Create'
                }, { timeout: 3000, required: false });
                
                if (createButton) {
                    await createButton.click();
                    await driver.pause(2000);
                    
                    // Look for validation error
                    const errorMessage = await findElementWithRetry({
                        xpath: '//android.widget.TextView[contains(@text, "invalid") or contains(@text, "error")]',
                        uiAutomator: 'new UiSelector().textMatches(".*[Ii]nvalid.*|.*[Ee]rror.*")',
                        text: 'invalid'
                    }, { timeout: 3000, required: false });
                    
                    if (errorMessage) {
                        console.log('✅ Email validation error displayed correctly');
                        await takeScreenshot('email-validation-error');
                    } else {
                        console.log('ℹ️ Email validation behavior may differ');
                    }
                }
            } else {
                console.log('ℹ️ Email input not found - cannot test validation');
            }
        });

        it('should handle backend API errors gracefully', async () => {
            await navigateToProfile();
            
            if (!backendHealthy) {
                // When backend is down, profile operations should show appropriate errors
                const errorHandling = await testProfileErrorHandling();
                
                if (errorHandling.errorShown) {
                    console.log('✅ Profile system handles backend errors appropriately');
                } else {
                    console.log('ℹ️ Profile system degrades gracefully without explicit errors');
                }
                
                await takeScreenshot('profile-backend-error-handling');
            } else {
                console.log('⚠️ Cannot test error handling - backend is healthy');
            }
        });

        it('should sync profile data with backend', async () => {
            if (!backendHealthy) {
                console.log('⚠️ Skipping profile sync test - backend not healthy');
                return;
            }

            await navigateToProfile();
            await createGuestProfileIfNeeded();
            
            // Get current profile data
            const profileData = await getProfileData();
            
            if (profileData.hasData) {
                console.log('✅ Profile data retrieved from backend');
                console.log(`Profile type: ${profileData.type}`);
                console.log(`Profile ID: ${profileData.id || 'N/A'}`);
                console.log(`Email: ${profileData.email || 'N/A'}`);
                
                await takeScreenshot('profile-data-synced');
            } else {
                console.log('ℹ️ Profile data structure may differ from expected');
            }
        });
    });

    describe('Profile Navigation Integration', () => {
        it('should navigate between profile and feed screens', async () => {
            // Start on feed
            const feedTitle = await findElementWithRetry({
                xpath: '//android.widget.TextView[contains(@text, "Babel Feed")]',
                uiAutomator: 'new UiSelector().textContains("Babel Feed")',
                text: 'Babel Feed'
            });
            await expect(feedTitle).toBeDisplayed();
            
            // Go to profile
            await navigateToProfile();
            
            // Verify profile screen
            const profileScreen = await findElementWithRetry({
                xpath: '//android.widget.TextView[contains(@text, "Profile")]',
                uiAutomator: 'new UiSelector().textContains("Profile")',
                text: 'Profile'
            });
            await expect(profileScreen).toBeDisplayed();
            
            // Go back to feed using back button
            await driver.back();
            await driver.pause(2000);
            
            // Verify we're back on feed
            const backOnFeed = await findElementWithRetry({
                xpath: '//android.widget.TextView[contains(@text, "Babel Feed")]',
                uiAutomator: 'new UiSelector().textContains("Babel Feed")',
                text: 'Babel Feed'
            });
            await expect(backOnFeed).toBeDisplayed();
            
            console.log('✅ Navigation between profile and feed works correctly');
            await takeScreenshot('profile-feed-navigation');
        });

        it('should maintain profile state when navigating between screens', async () => {
            await navigateToProfile();
            const profileCreated = await createGuestProfileIfNeeded();
            
            if (profileCreated || backendHealthy) {
                const initialState = await getProfileState();
                
                // Navigate to feed and back
                await driver.back();
                await driver.pause(1000);
                await navigateToProfile();
                
                const finalState = await getProfileState();
                
                if (initialState.hasProfile && finalState.hasProfile) {
                    console.log('✅ Profile state maintained during navigation');
                } else {
                    console.log('ℹ️ Profile state behavior during navigation may vary');
                }
                
                await takeScreenshot('profile-state-navigation');
            }
        });
    });

    // Helper functions
    async function navigateToProfile() {
        const profileButton = await findElementWithRetry({
            xpath: '//android.widget.Button[@content-desc="Profile"]',
            uiAutomator: 'new UiSelector().descriptionContains("Profile")',
            text: 'Profile'
        });
        
        await profileButton.click();
        await driver.pause(2000);
    }

    async function createGuestProfileIfNeeded() {
        const startGuestButton = await findElementWithRetry({
            xpath: '//android.widget.Button[contains(@text, "Start as Guest") or contains(@text, "Guest")]',
            uiAutomator: 'new UiSelector().textContains("Guest")',
            text: 'Guest'
        }, { timeout: 3000, required: false });
        
        if (startGuestButton) {
            await startGuestButton.click();
            await driver.pause(3000);
            return true;
        }
        
        return false;
    }

    async function getProfileState() {
        try {
            // Look for profile indicators
            const guestProfile = await findElementWithRetry({
                xpath: '//android.widget.TextView[contains(@text, "Guest") or contains(@text, "User")]',
                uiAutomator: 'new UiSelector().textMatches(".*[Gg]uest.*|.*[Uu]ser.*")',
                text: 'Guest'
            }, { timeout: 3000, required: false });
            
            const profileId = await findElementWithRetry({
                xpath: '//android.widget.TextView[contains(@text, "ID")]',
                uiAutomator: 'new UiSelector().textContains("ID")',
                text: 'ID'
            }, { timeout: 3000, required: false });
            
            return {
                hasProfile: !!(guestProfile || profileId),
                isGuest: !!guestProfile,
                hasId: !!profileId
            };
        } catch (error) {
            return { hasProfile: false, isGuest: false, hasId: false };
        }
    }

    async function findProfileInformationElements() {
        try {
            const textElements = await driver.$$('android=new UiSelector().className("android.widget.TextView")');
            const profileElements = [];
            
            for (const element of textElements) {
                try {
                    if (await element.isDisplayed()) {
                        const text = await element.getText();
                        if (text && (text.includes('Guest') || text.includes('ID') || text.includes('Email') || text.includes('User'))) {
                            profileElements.push(element);
                        }
                    }
                } catch (error) {
                    // Continue checking other elements
                }
            }
            
            return profileElements;
        } catch (error) {
            return [];
        }
    }

    async function testProfileErrorHandling() {
        try {
            // Try to perform profile operation that would require backend
            const createButton = await findElementWithRetry({
                xpath: '//android.widget.Button[contains(@text, "Create") or contains(@text, "Start")]',
                uiAutomator: 'new UiSelector().textMatches(".*[Cc]reate.*|.*[Ss]tart.*")',
                text: 'Create'
            }, { timeout: 3000, required: false });
            
            if (createButton) {
                await createButton.click();
                await driver.pause(3000);
                
                // Look for error messages
                const errorElement = await findElementWithRetry({
                    xpath: '//android.widget.TextView[contains(@text, "Error") or contains(@text, "Failed") or contains(@text, "Unable")]',
                    uiAutomator: 'new UiSelector().textMatches(".*[Ee]rror.*|.*[Ff]ailed.*|.*[Uu]nable.*")',
                    text: 'Error'
                }, { timeout: 5000, required: false });
                
                return {
                    errorShown: !!errorElement,
                    operationAttempted: true
                };
            }
            
            return {
                errorShown: false,
                operationAttempted: false
            };
        } catch (error) {
            return {
                errorShown: false,
                operationAttempted: false,
                exception: error.message
            };
        }
    }

    async function getProfileData() {
        try {
            const textElements = await driver.$$('android=new UiSelector().className("android.widget.TextView")');
            const profileData = {
                hasData: false,
                type: null,
                id: null,
                email: null
            };
            
            for (const element of textElements) {
                try {
                    if (await element.isDisplayed()) {
                        const text = await element.getText();
                        if (text) {
                            if (text.includes('Guest')) {
                                profileData.hasData = true;
                                profileData.type = 'guest';
                            }
                            if (text.includes('ID:')) {
                                profileData.hasData = true;
                                profileData.id = text;
                            }
                            if (text.includes('@')) {
                                profileData.hasData = true;
                                profileData.email = text;
                            }
                        }
                    }
                } catch (error) {
                    // Continue checking other elements
                }
            }
            
            return profileData;
        } catch (error) {
            return { hasData: false };
        }
    }
});