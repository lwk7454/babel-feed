#!/usr/bin/env node

/**
 * Debug Screen State - Check what's actually displayed on the feed screen
 */

import { remote } from 'webdriverio';
import { getAppiumConfig } from './configs/appium.config.js';

const config = getAppiumConfig();

async function debugScreenState() {
    console.log('🔍 Debugging Feed Screen State...');
    
    let driver;

    try {
        // Connect to Appium
        console.log('📱 Connecting to Appium server...');
        driver = await remote({
            hostname: config.server.host,
            port: config.server.port,
            path: config.server.path,
            capabilities: {
                ...config.capabilities,
                'appium:app': '/Users/pooh/dev/tauri-babel-feed/apps/babel-android/app/build/outputs/apk/debug/app-debug.apk'
            }
        });

        console.log('✅ Connected to device');

        // Wait for app to load
        await driver.pause(8000);

        // Get all visible text elements
        console.log('\n🔍 Checking all visible text elements...');
        const textElements = await driver.$$('android=new UiSelector().className("android.widget.TextView")');
        
        let textCount = 0;
        for (const element of textElements) {
            try {
                if (await element.isDisplayed()) {
                    const text = await element.getText();
                    if (text && text.trim().length > 0) {
                        console.log(`📝 Text: "${text}"`);
                        textCount++;
                    }
                }
            } catch (error) {
                // Continue checking other elements
            }
        }
        console.log(`\n📊 Found ${textCount} text elements`);

        // Check for loading indicators
        console.log('\n🔄 Checking for loading indicators...');
        const progressBars = await driver.$$('android=new UiSelector().className("android.widget.ProgressBar")');
        let loadingFound = false;
        for (const progressBar of progressBars) {
            try {
                if (await progressBar.isDisplayed()) {
                    console.log('⏳ Loading indicator found!');
                    loadingFound = true;
                }
            } catch (error) {
                // Continue
            }
        }
        if (!loadingFound) {
            console.log('✅ No loading indicators found');
        }

        // Check for error messages
        console.log('\n❌ Checking for error messages...');
        const allElements = await driver.$$('android=new UiSelector()');
        let errorFound = false;
        for (const element of allElements.slice(0, 20)) { // Check first 20 elements
            try {
                if (await element.isDisplayed()) {
                    const text = await element.getText();
                    if (text && (text.toLowerCase().includes('error') || 
                                text.toLowerCase().includes('failed') || 
                                text.toLowerCase().includes('unable') ||
                                text.toLowerCase().includes('no articles'))) {
                        console.log(`🚨 Potential error message: "${text}"`);
                        errorFound = true;
                    }
                }
            } catch (error) {
                // Continue
            }
        }
        if (!errorFound) {
            console.log('✅ No obvious error messages found');
        }

        // Get screen source for analysis
        console.log('\n📄 Getting page source...');
        const source = await driver.getPageSource();
        
        // Count different UI elements
        const uiElementTypes = [
            'TextView', 'Button', 'ImageView', 'ViewGroup', 
            'ScrollView', 'RecyclerView', 'ListView'
        ];
        
        console.log('\n📊 UI Element Analysis:');
        for (const elementType of uiElementTypes) {
            const count = (source.match(new RegExp(`android\\.widget\\.${elementType}`, 'g')) || []).length;
            if (count > 0) {
                console.log(`  ${elementType}: ${count}`);
            }
        }

        // Check for specific success/error states
        console.log('\n🎯 Checking for specific UI states...');
        if (source.includes('No articles available')) {
            console.log('📋 "No articles available" message found');
        }
        if (source.includes('CircularProgressIndicator') || source.includes('ProgressBar')) {
            console.log('⏳ Loading state detected in UI');
        }
        if (source.includes('Error') || source.includes('Failed')) {
            console.log('❌ Error state detected in UI');
        }

        // Look for clickable elements that might be articles
        console.log('\n🖱️ Checking clickable elements...');
        const clickableElements = await driver.$$('android=new UiSelector().clickable(true)');
        console.log(`Found ${clickableElements.length} clickable elements:`);
        
        for (let i = 0; i < Math.min(5, clickableElements.length); i++) {
            try {
                const element = clickableElements[i];
                if (await element.isDisplayed()) {
                    const text = await element.getText();
                    const className = await element.getAttribute('className');
                    const resourceId = await element.getAttribute('resourceId');
                    console.log(`  ${i + 1}. Class: ${className || 'unknown'}`);
                    console.log(`     Resource: ${resourceId || 'none'}`);
                    console.log(`     Text: "${text || 'no text'}"`);
                    console.log('');
                }
            } catch (error) {
                console.log(`  ${i + 1}. Error reading element: ${error.message}`);
            }
        }

    } catch (error) {
        console.error('❌ Debug failed:', error);
    } finally {
        if (driver) {
            await driver.deleteSession();
        }
    }
}

// Run the debug
debugScreenState().catch(console.error);