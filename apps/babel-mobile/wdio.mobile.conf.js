// Note: This is a basic mobile configuration.
// You'll need to configure Appium or a similar service for actual mobile testing.
// This example assumes usage with a local Appium server.

const capabilities = [{
    maxInstances: 1,
    // platformName: 'Android', // or 'iOS'
    // 'appium:deviceName': 'emulator-5554', // or your device UDID for iOS
    // 'appium:platformVersion': '11.0', // or your Android/iOS version
    // 'appium:automationName': 'UiAutomator2', // or 'XCUITest' for iOS
    // 'appium:app': '/path/to/your/app.apk', // or .app / .ipa
    browserName: 'chrome', // For webview testing in a mobile context if applicable
    'tauri:options': {
        application: '../../target/release/babel-mobile' // Adjust to your Tauri app path
    }
}];

if (process.env.CI) {
    // Add CI-specific capabilities if needed
}

export const config = {
    runner: 'local',
    port: 4723, // Default Appium port
    specs: [
        './e2e/specs/mobile/**/*.spec.js'
    ],
    exclude: [
        // './e2e/specs/**/*.spec.js' // Exclude non-mobile tests if necessary
    ],
    maxInstances: 1, // Usually 1 for mobile unless you have multiple devices/emulators
    capabilities: capabilities,
    logLevel: 'info',
    bail: 0,
    baseUrl: 'http://localhost',
    waitforTimeout: 20000, // Mobile can be slower
    connectionRetryTimeout: 120000,
    connectionRetryCount: 3,
    services: ['tauri'], // Potentially 'appium' service here too
    framework: 'mocha',
    reporters: ['spec'],
    mochaOpts: {
        ui: 'bdd',
        timeout: 90000 // Mobile tests can take longer
    },
    async beforeSession(config, capabilities, specs, cid) {
        console.log('Starting mobile session / tauri-driver...');
        // Placeholder for mobile session and tauri-driver start
    },
    async afterSession(config, capabilities, specs) {
        console.log('Stopping mobile session / tauri-driver...');
        // Placeholder for mobile session and tauri-driver stop
    }
};
