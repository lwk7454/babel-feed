/**
 * WebDriverIO Configuration for Authentication Testing
 * 
 * This configuration is specifically set up for running authentication
 * persistence tests using Appium and Android devices.
 */

import { getAppiumConfig } from './configs/appium.config.js';

const appiumConfig = getAppiumConfig();

export const config = {
    // Test runner
    runner: 'local',

    // Appium server configuration
    hostname: appiumConfig.server.host,
    port: appiumConfig.server.port,
    path: appiumConfig.server.path,

    // Test specs
    specs: [
        './tests/**/*.test.js'
    ],

    // Exclude patterns
    exclude: [],

    // Capabilities
    capabilities: [{
        ...appiumConfig.capabilities,
        'appium:appPackage': 'com.babelfeed.app.debug', // Use debug package for tests
    }],

    // Test configuration
    maxInstances: 1, // Only run one test at a time for mobile
    
    // Timeouts
    connectionRetryTimeout: 120000,
    connectionRetryCount: 3,
    
    // Framework
    framework: 'mocha',
    mochaOpts: {
        ui: 'bdd',
        timeout: appiumConfig.testConfig.translationTimeout * 2, // 90 seconds per test
        retries: appiumConfig.testConfig.retryAttempts
    },

    // Logging
    logLevel: appiumConfig.server.logLevel,
    outputDir: './reports',
    
    // Services
    services: [
        ['appium', {
            logPath: './reports',
            args: {
                address: appiumConfig.server.host,
                port: appiumConfig.server.port,
                basePath: appiumConfig.server.path,
                relaxedSecurity: true,
                logLevel: appiumConfig.server.logLevel
            }
        }]
    ],

    // Screenshots
    screenshotPath: './reports/screenshots',
    
    // Hooks
    beforeSession: function (config, capabilities, specs) {
        console.log('🚀 Starting WebDriverIO session...');
    },

    before: function (capabilities, specs, browser) {
        // Set only implicit timeout (other timeouts not supported by this Appium version)
        browser.setTimeout({
            implicit: 10000
        });
    },

    afterTest: function (test, context, { error, result, duration, passed, retries }) {
        if (!passed && appiumConfig.testConfig.screenshotOnFailure) {
            const timestamp = Date.now();
            const screenshotPath = `./reports/screenshots/test-failure-${timestamp}.png`;
            browser.saveScreenshot(screenshotPath);
            console.log(`📸 Screenshot saved: ${screenshotPath}`);
        }
    },

    after: function (result, capabilities, specs) {
        console.log('🏁 WebDriverIO session completed');
    }
};