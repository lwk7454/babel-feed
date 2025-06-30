/**
 * Authentication Helper
 * Focused utilities for authentication flows
 */

export interface TestUser {
  email: string;
  otpCode?: string;
}

export class AuthHelper {
  constructor(private driver: WebdriverIO.Browser) {}

  async navigateToProfile(): Promise<void> {
    console.log('👤 Navigating to profile...');
    const profileButton = await this.driver.$('//*[@content-desc="Profile"]');
    await profileButton.waitForDisplayed({ timeout: 2000 });
    await profileButton.click();
    
    // Verify profile screen is actually displayed
    await this.waitForProfileScreenLoaded();
  }

  /**
   * Wait for profile screen to be fully loaded by checking for key elements
   */
  async waitForProfileScreenLoaded(timeout = 15000): Promise<void> {
    console.log('🔍 Waiting for profile screen to be fully loaded...');
    
    await this.driver.waitUntil(
      async () => {
        // Check for profile header
        const profileTitle = await this.driver.$('//*[contains(@text, "Profile")]');
        const titleVisible = await profileTitle.isDisplayed().catch(() => false);
        
        // Check for any account card (NoAuth, Guest, or Authenticated)
        const accountCardVisible = await this.isAccountCardVisible();
        
        return titleVisible && accountCardVisible;
      },
      {
        timeout,
        timeoutMsg: `Profile screen not fully loaded within ${timeout}ms`
      }
    );
    
    console.log('✅ Profile screen fully loaded');
  }

  /**
   * Check if any account card is visible on the profile screen
   */
  async isAccountCardVisible(): Promise<boolean> {
    try {
      // Check for different types of account cards
      const noAuthCard = await this.isNoAuthCardVisible();
      const guestCard = await this.isGuestCardVisible();
      const authenticatedCard = await this.isAuthenticatedCardVisible();
      
      return noAuthCard || guestCard || authenticatedCard;
    } catch {
      return false;
    }
  }

  /**
   * Check if the "No Auth" card is visible (welcome state)
   */
  async isNoAuthCardVisible(): Promise<boolean> {
    try {
      const welcomeText = await this.driver.$('//*[contains(@text, "Welcome to Babel Feed")]');
      const startGuestButton = await this.driver.$('//*[@content-desc="Start as Guest"]');
      
      const welcomeVisible = await welcomeText.isDisplayed().catch(() => false);
      const buttonVisible = await startGuestButton.isDisplayed().catch(() => false);
      
      return welcomeVisible && buttonVisible;
    } catch {
      return false;
    }
  }

  /**
   * Check if the guest user card is visible
   */
  async isGuestCardVisible(): Promise<boolean> {
    try {
      // Look for guest status indicator
      const guestStatus = await this.driver.$('//*[@content-desc="Status: Guest"]');
      const emailField = await this.driver.$('//android.widget.EditText[@content-desc="Email"]');
      const verifyButton = await this.driver.$('//*[@content-desc="Verify"]');
      
      const statusVisible = await guestStatus.isDisplayed().catch(() => false);
      const emailVisible = await emailField.isDisplayed().catch(() => false);
      const verifyVisible = await verifyButton.isDisplayed().catch(() => false);
      
      return statusVisible && emailVisible && verifyVisible;
    } catch {
      return false;
    }
  }

  /**
   * Check if the authenticated user card is visible
   */
  async isAuthenticatedCardVisible(): Promise<boolean> {
    try {
      // Look for authenticated status (Verified or VIP)
      const statusElements = await this.driver.$$('//*[@content-desc[contains(., "Status:") and (contains(., "Verified") or contains(., "VIP"))]]');
      const logoutButton = await this.driver.$('//*[@content-desc="Logout"]');
      
      const statusVisible = statusElements.length > 0;
      const logoutVisible = await logoutButton.isDisplayed().catch(() => false);
      
      return statusVisible && logoutVisible;
    } catch {
      return false;
    }
  }

  /**
   * Check if the preferences section is visible
   */
  async isPreferencesSectionVisible(): Promise<boolean> {
    try {
      const preferencesTitle = await this.driver.$('//*[contains(@text, "Preferences")]');
      const translationSettings = await this.driver.$('//*[contains(@text, "Translation Settings")]');
      const themeSettings = await this.driver.$('//*[contains(@text, "Theme")]');
      
      const titleVisible = await preferencesTitle.isDisplayed().catch(() => false);
      const translationVisible = await translationSettings.isDisplayed().catch(() => false);
      const themeVisible = await themeSettings.isDisplayed().catch(() => false);
      
      return titleVisible && (translationVisible || themeVisible);
    } catch {
      return false;
    }
  }

  /**
   * Wait for preferences section to be visible
   */
  async waitForPreferencesSection(timeout = 10000): Promise<void> {
    console.log('⏳ Waiting for preferences section to be visible...');
    
    await this.driver.waitUntil(
      async () => await this.isPreferencesSectionVisible(),
      {
        timeout,
        timeoutMsg: `Preferences section not visible within ${timeout}ms`
      }
    );
    
    console.log('✅ Preferences section is visible');
  }

  async enterEmail(email: string): Promise<void> {
    console.log(`📧 Entering email: ${email}`);
    
    // Wait for guest card to be visible first
    await this.driver.waitUntil(
      async () => await this.isGuestCardVisible(),
      {
        timeout: 15000,
        timeoutMsg: 'Guest card not visible within 15 seconds'
      }
    );
    
    const emailInput = await this.driver.$('//android.widget.EditText[@content-desc="Email"]');
    await emailInput.clearValue();
    await emailInput.setValue(email);
  }

  async clickVerifyButton(): Promise<void> {
    console.log('✅ Clicking verify button...');
    const verifyButton = await this.driver.$('//*[@content-desc="Verify"]');
    await verifyButton.waitForDisplayed({ timeout: 10000 });
    await verifyButton.click();
  }

  async enterOTP(otpCode: string): Promise<void> {
    console.log(`🔐 Entering OTP: ${otpCode}`);
    
    // Handle OTP input - could be individual fields or single field
    const otpFields = await this.driver.$$('//android.widget.EditText[contains(@hint, "OTP")]');
    
    if (otpFields.length === 1) {
      // Single OTP field
      await otpFields[0].clearValue();
      await otpFields[0].setValue(otpCode);
    } else if (otpFields.length === 4) {
      // Individual OTP fields
      for (let i = 0; i < 4; i++) {
        await otpFields[i].clearValue();
        await otpFields[i].setValue(otpCode[i]);
      }
    } else {
      throw new Error(`Unexpected number of OTP fields: ${otpFields.length}`);
    }
  }

  async submitOTP(): Promise<void> {
    console.log('📤 Submitting OTP...');
    const submitButton = await this.driver.$('//*[@content-desc="Submit"]');
    await submitButton.waitForDisplayed({ timeout: 2000 });
    await submitButton.click();
  }

  async waitForVerificationSuccess(timeout = 10000): Promise<void> {
    console.log('⏳ Waiting for verification success...');
    
    await this.driver.waitUntil(
      async () => {
        // Look for success indicators
        const successElements = await this.driver.$$('//*[contains(@text, "Success") or contains(@text, "Verified")]');
        return successElements.length > 0;
      },
      {
        timeout,
        timeoutMsg: `Verification success not detected within ${timeout}ms`
      }
    );
    
    console.log('✅ Verification successful');
  }

  /**
   * Get user status with improved reliability by checking multiple indicators
   */
  async getUserStatus(): Promise<string> {
    try {
      // Check for different types of status indicators
      
      // Check for authenticated status first (Verified/VIP)
      const authenticatedStatus = await this.driver.$('//*[@content-desc[contains(., "Status:") and (contains(., "Verified") or contains(., "VIP"))]]');
      try {
        await authenticatedStatus.waitForDisplayed({ timeout: 3000 });
        const statusText = await authenticatedStatus.getAttribute('content-desc');
        return statusText.replace('Status:', '').trim();
      } catch {
        // Continue to check guest status
      }
      
      // Check for guest status
      const guestStatus = await this.driver.$('//*[@content-desc="Status: Guest"]');
      try {
        await guestStatus.waitForDisplayed({ timeout: 3000 });
        const statusText = await guestStatus.getAttribute('content-desc');
        return statusText.replace('Status:', '').trim();
      } catch {
        // Continue to check other indicators
      }
      
      // Fallback: Check by card visibility
      if (await this.isAuthenticatedCardVisible()) {
        return 'Verified'; // Default for authenticated users
      } else if (await this.isGuestCardVisible()) {
        return 'Guest';
      } else if (await this.isNoAuthCardVisible()) {
        return 'Not authenticated';
      }
      
      return 'unknown';
    } catch {
      return 'unknown';
    }
  }

  /**
   * Enhanced login check that verifies multiple indicators
   */
  async isLoggedIn(): Promise<boolean> {
    try {
      // Check for authenticated card visibility
      const authenticatedCard = await this.isAuthenticatedCardVisible();
      
      // Also check for user email display (additional confirmation)
      const emailElements = await this.driver.$$('//*[contains(@text, "@") and contains(@text, ".")]');
      const hasEmailDisplay = emailElements.length > 0;
      
      return authenticatedCard && hasEmailDisplay;
    } catch {
      return false;
    }
  }

  async logout(): Promise<void> {
    console.log('🚪 Logging out...');
    
    // First verify we're actually logged in and can see the logout button
    await this.driver.waitUntil(
      async () => await this.isAuthenticatedCardVisible(),
      {
        timeout: 10000,
        timeoutMsg: 'Cannot logout - not in authenticated state'
      }
    );
    
    const logoutButton = await this.driver.$('//*[@content-desc="Logout"]');
    await logoutButton.waitForDisplayed({ timeout: 10000 });
    await logoutButton.click();
    
    // Wait for logout to complete by checking that we're no longer authenticated
    await this.driver.waitUntil(
      async () => {
        const isStillLoggedIn = await this.isLoggedIn();
        return !isStillLoggedIn;
      },
      {
        timeout: 10000,
        timeoutMsg: 'Logout did not complete within 10 seconds'
      }
    );
    
    console.log('✅ Logout completed');
  }

  createTestUser(): TestUser {
    const timestamp = Date.now();
    return {
      email: `test+${timestamp}@example.com`,
      otpCode: '1234' // Test OTP code
    };
  }

  /**
   * Scroll to find an element if it's not immediately visible
   */
  async scrollToElement(selector: string, maxScrolls = 3): Promise<boolean> {
    for (let i = 0; i < maxScrolls; i++) {
      try {
        const element = await this.driver.$(selector);
        if (await element.isDisplayed()) {
          return true;
        }
      } catch {
        // Element not found, continue scrolling
      }
      
      // Scroll down
      await this.driver.performActions([{
        type: 'pointer',
        id: 'finger1',
        parameters: { pointerType: 'touch' },
        actions: [
          { type: 'pointerMove', duration: 0, x: 500, y: 800 },
          { type: 'pointerDown' },
          { type: 'pointerMove', duration: 1000, x: 500, y: 200 },
          { type: 'pointerUp' }
        ]
      }]);
      
      await this.driver.pause(1000);
    }
    
    return false;
  }
}