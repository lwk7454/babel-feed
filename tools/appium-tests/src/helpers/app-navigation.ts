/**
 * App Navigation Helper
 * Simple navigation utilities for app screens
 */

export class AppNavigation {
  constructor(private driver: WebdriverIO.Browser) {}

  async waitForScreen(screenIdentifier: string, timeout = 10000): Promise<void> {
    await this.driver.waitUntil(
      async () => {
        const elements = await this.driver.$$(`//*[contains(@content-desc, "${screenIdentifier}") or contains(@text, "${screenIdentifier}")]`);
        return elements.length > 0;
      },
      {
        timeout,
        timeoutMsg: `Screen with identifier "${screenIdentifier}" not found within ${timeout}ms`
      }
    );
  }

  async clickElement(selector: string, timeout = 10000): Promise<void> {
    const element = await this.driver.$(selector);
    await element.waitForDisplayed({ timeout });
    await element.click();
  }

  async clickElementByText(text: string, timeout = 10000): Promise<void> {
    const element = await this.driver.$(`//*[@text="${text}"]`);
    await element.waitForDisplayed({ timeout });
    await element.click();
  }

  async clickElementByContentDesc(contentDesc: string, timeout = 10000): Promise<void> {
    const element = await this.driver.$(`//*[@content-desc="${contentDesc}"]`);
    await element.waitForDisplayed({ timeout });
    await element.click();
  }

  async enterText(selector: string, text: string, timeout = 10000): Promise<void> {
    const element = await this.driver.$(selector);
    await element.waitForDisplayed({ timeout });
    await element.clearValue();
    await element.setValue(text);
  }

  async getCurrentActivity(): Promise<string> {
    return await this.driver.getCurrentActivity();
  }

  async takeScreenshot(name: string): Promise<void> {
    const screenshot = await this.driver.takeScreenshot();
    await Bun.write(`./reports/screenshots/${name}-${Date.now()}.png`, Buffer.from(screenshot, 'base64'));
  }

  async isElementDisplayed(selector: string): Promise<boolean> {
    try {
      const element = await this.driver.$(selector);
      return await element.isDisplayed();
    } catch {
      return false;
    }
  }

  async getElementText(selector: string): Promise<string> {
    const element = await this.driver.$(selector);
    await element.waitForDisplayed();
    return await element.getText();
  }
}