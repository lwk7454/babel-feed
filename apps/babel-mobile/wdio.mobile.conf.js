// Note: This is a basic mobile configuration.
// You'll need to configure Appium or a similar service for actual mobile testing.
// This example assumes usage with a local Appium server.

import path from 'path';
import os from 'os';
import { spawn, spawnSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// keep track of the `tauri-driver` child process
let tauriDriver;

const capabilities = [{
    maxInstances: 1,
    platformName: 'Android',
    'appium:deviceName': 'emulator-5554', // Default Android emulator name
    'appium:platformVersion': '11.0', // Adjust to your Android version
    'appium:automationName': 'UiAutomator2',
    'appium:app': path.resolve(__dirname, './src-tauri/gen/android/app/build/outputs/apk/universal/release/app-universal-release-unsigned.apk'),
    'appium:autoGrantPermissions': true,
    'appium:noReset': false,
    'appium:fullReset': true,
    'appium:newCommandTimeout': 300000, // 5 minutes for CI
    'appium:androidInstallTimeout': 120000 // 2 minutes for app installation
}];

// CI-specific configuration
if (process.env.CI) {
    capabilities[0]['appium:avd'] = process.env.AVD_NAME || 'CI_Android_ARM64';
    capabilities[0]['appium:avdLaunchTimeout'] = 300000; // 5 minutes for CI
    capabilities[0]['appium:avdReadyTimeout'] = 300000;
    capabilities[0]['appium:systemPort'] = 8201; // Use specific port for CI
    // Headless mode for CI
    capabilities[0]['appium:isHeadless'] = true;
    capabilities[0]['appium:avdArgs'] = ['-no-window', '-no-audio', '-no-snapshot'];
}

export const config = {
    runner: 'local',
    port: 4723, // Default Appium port
    specs: [
        './e2e/specs/**/*.spec.js' // Run all specs for mobile testing
    ],
    exclude: [
        // Add any desktop-specific tests to exclude
    ],
    maxInstances: 1,
    capabilities: capabilities,
    logLevel: process.env.CI ? 'warn' : 'info', // Less verbose in CI
    bail: process.env.CI ? 1 : 0, // Fail fast in CI
    waitforTimeout: process.env.CI ? 60000 : 30000, // Longer timeout for CI
    connectionRetryTimeout: process.env.CI ? 300000 : 180000,
    connectionRetryCount: 3,
    services: ['appium'], // Use Appium service for mobile testing
    framework: 'mocha',
    reporters: process.env.CI ? [['spec', { addConsoleLogs: true }]] : ['spec'],
    mochaOpts: {
        ui: 'bdd',
        timeout: process.env.CI ? 300000 : 120000 // Much longer timeout for CI
    },

    // Build the Android APK before testing
    onPrepare: () => {
        console.log('Building Tauri Android application...');
        spawnSync('tauri', ['android', 'build'], { 
            cwd: path.resolve(__dirname), 
            stdio: 'inherit' 
        });
    },

    // Appium service handles the mobile session, but we still need tauri-driver for webview interaction
    beforeSession: () => {
        console.log('Starting tauri-driver for mobile testing...');
        tauriDriver = spawn(
            path.resolve(os.homedir(), '.cargo', 'bin', 'tauri-driver'),
            ['--port', '4444'], // Use different port for tauri-driver
            { stdio: [null, process.stdout, process.stderr] }
        );
        
        // Wait a moment for tauri-driver to start
        return new Promise(resolve => setTimeout(resolve, 3000));
    },

    afterSession: () => {
        if (tauriDriver) {
            console.log('Stopping tauri-driver...');
            tauriDriver.kill();
        }
    },

    // Configure Appium service
    'appium:options': {
        command: 'appium',
        args: {
            address: '127.0.0.1',
            port: 4723,
            relaxedSecurity: true,
            ...(process.env.CI && {
                // CI-specific Appium options
                sessionOverride: true,
                log: './appium.log',
                logLevel: 'warn'
            })
        }
    }
};
