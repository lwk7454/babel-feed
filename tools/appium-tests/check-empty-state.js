#!/usr/bin/env node

/**
 * Check for "No articles available" text
 */

import { remote } from 'webdriverio';
import { getAppiumConfig } from './configs/appium.config.js';

const config = getAppiumConfig();

async function checkEmptyState() {
    console.log('🔍 Checking for "No articles available" state...');
    
    let driver;

    try {
        driver = await remote({
            hostname: config.server.host,
            port: config.server.port,
            path: config.server.path,
            capabilities: {
                ...config.capabilities,
                'appium:app': '/Users/pooh/dev/tauri-babel-feed/apps/babel-android/app/build/outputs/apk/debug/app-debug.apk'
            }
        });

        await driver.pause(6000);

        // Look specifically for "No articles available" text
        try {
            const noArticlesElement = await driver.$('android=new UiSelector().textContains("No articles available")');
            const isDisplayed = await noArticlesElement.isDisplayed();
            
            if (isDisplayed) {
                console.log('✅ Found "No articles available" message');
                console.log('🔍 This means the API call succeeded but returned empty results');
            } else {
                console.log('❌ "No articles available" message not found');
            }
        } catch (error) {
            console.log('❌ "No articles available" message not found');
        }

        // Try to find any text containing "articles"
        try {
            const articlesText = await driver.$('android=new UiSelector().textContains("articles")');
            const isDisplayed = await articlesText.isDisplayed();
            
            if (isDisplayed) {
                const text = await articlesText.getText();
                console.log(`📝 Found text with "articles": "${text}"`);
            }
        } catch (error) {
            console.log('❌ No text containing "articles" found');
        }

        // Get all text elements one more time
        const allTexts = await driver.$$('android=new UiSelector().className("android.widget.TextView")');
        console.log(`\n📊 All TextView elements (${allTexts.length}):`);
        
        for (let i = 0; i < allTexts.length; i++) {
            try {
                if (await allTexts[i].isDisplayed()) {
                    const text = await allTexts[i].getText();
                    console.log(`  ${i + 1}: "${text}"`);
                }
            } catch (error) {
                console.log(`  ${i + 1}: Error reading text`);
            }
        }

    } catch (error) {
        console.error('❌ Check failed:', error);
    } finally {
        if (driver) {
            await driver.deleteSession();
        }
    }
}

checkEmptyState().catch(console.error);