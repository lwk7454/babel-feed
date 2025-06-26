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
    await profileButton.waitForDisplayed({ timeout: 10000 });
    await profileButton.click();
  }

  async enterEmail(email: string): Promise<void> {
    console.log(`📧 Entering email: ${email}`);
    const emailInput = await this.driver.$('//android.widget.EditText[contains(@text, "Email") or contains(@hint, "Email")]');
    await emailInput.waitForDisplayed({ timeout: 10000 });
    await emailInput.clearValue();
    await emailInput.setValue(email);
  }

  async clickVerifyButton(): Promise<void> {
    console.log('✅ Clicking verify button...');
    const verifyButton = await this.driver.$('//*[@text="Verify" or @content-desc="Verify"]');
    await verifyButton.waitForDisplayed({ timeout: 10000 });
    await verifyButton.click();
  }

  async enterOTP(otpCode: string): Promise<void> {
    console.log(`🔐 Entering OTP: ${otpCode}`);
    
    // Handle OTP input - could be individual fields or single field
    const otpFields = await this.driver.$$('//android.widget.EditText[contains(@hint, "OTP") or contains(@text, "OTP")]');
    
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
    const submitButton = await this.driver.$('//*[@text="Submit" or @content-desc="Submit" or @text="Verify"]');
    await submitButton.waitForDisplayed({ timeout: 10000 });
    await submitButton.click();
  }

  async waitForVerificationSuccess(timeout = 10000): Promise<void> {
    console.log('⏳ Waiting for verification success...');
    
    await this.driver.waitUntil(
      async () => {
        // Look for success indicators
        const successElements = await this.driver.$$('//*[contains(@text, "Success") or contains(@text, "Verified") or contains(@content-desc, "Success")]');
        return successElements.length > 0;
      },
      {
        timeout,
        timeoutMsg: `Verification success not detected within ${timeout}ms`
      }
    );
    
    console.log('✅ Verification successful');
  }

  async getUserStatus(): Promise<string> {
    try {
      const statusElement = await this.driver.$('//*[contains(@text, "Status:") or contains(@content-desc, "Status")]');
      await statusElement.waitForDisplayed({ timeout: 5000 });
      const statusText = await statusElement.getText();
      return statusText.replace('Status:', '').trim();
    } catch {
      return 'unknown';
    }
  }

  async isLoggedIn(): Promise<boolean> {
    try {
      // Check for logout button or user email display
      const logoutButton = await this.driver.$('//*[@text="Logout" or @content-desc="Logout"]');
      return await logoutButton.isDisplayed();
    } catch {
      return false;
    }
  }

  async logout(): Promise<void> {
    console.log('🚪 Logging out...');
    const logoutButton = await this.driver.$('//*[@text="Logout" or @content-desc="Logout"]');
    await logoutButton.waitForDisplayed({ timeout: 10000 });
    await logoutButton.click();
    
    // Wait for logout to complete
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
}