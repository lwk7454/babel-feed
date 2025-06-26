/**
 * Basic Connection Test
 * 
 * This test validates that we can connect to the app and perform basic operations.
 */

import { expect } from '@wdio/globals';

describe('Basic Connection Test', () => {
    it('should connect to the app and take a screenshot', async () => {
        console.log('🧪 Testing basic app connection...');
        
        // Wait for app to load
        await driver.pause(3000);
        
        // Take a screenshot to verify connection
        const screenshotPath = `./reports/screenshots/basic-test-${Date.now()}.png`;
        await driver.saveScreenshot(screenshotPath);
        console.log(`📸 Screenshot saved: ${screenshotPath}`);
        
        // Check if we can get page source
        const pageSource = await driver.getPageSource();
        expect(pageSource).toContain('android');
        
        console.log('✅ Basic connection test passed');
    });

    it('should be able to find elements on screen', async () => {
        console.log('🔍 Testing element finding...');
        
        await driver.pause(2000);
        
        try {
            // Try to find any button or text element
            const elements = await driver.$$('android.widget.TextView');
            console.log(`Found ${elements.length} TextView elements`);
            
            if (elements.length > 0) {
                const firstElement = elements[0];
                const text = await firstElement.getText();
                console.log(`First element text: "${text}"`);
            }
            
            console.log('✅ Element finding test passed');
        } catch (error) {
            console.error('❌ Element finding failed:', error.message);
            throw error;
        }
    });
});