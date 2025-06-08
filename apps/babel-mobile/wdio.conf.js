const capabilities = [{
    maxInstances: 1,
    browserName: 'chrome',
    'goog:chromeOptions': {
        binary: '/opt/google/chrome/chrome' // Adjust if necessary
    },
    'tauri:options': {
        application: '../../target/release/babel-mobile' // Adjust to your Tauri app path
    }
}];

if (process.env.CI) {
    capabilities[0]['goog:chromeOptions'].args = ['headless', 'disable-gpu'];
}


export const config = {
    runner: 'local',
    specs: [
        './e2e/specs/**/*.spec.js'
    ],
    exclude: [
        './e2e/specs/mobile/**/*.spec.js'
    ],
    maxInstances: 10,
    capabilities: capabilities,
    logLevel: 'info',
    bail: 0,
    baseUrl: 'http://localhost',
    waitforTimeout: 10000,
    connectionRetryTimeout: 120000,
    connectionRetryCount: 3,
    services: ['tauri'],
    framework: 'mocha',
    reporters: ['spec'],
    mochaOpts: {
        ui: 'bdd',
        timeout: 60000
    },
    async beforeSession(config, capabilities, specs, cid) {
        // Start tauri-driver
        // You might need to adjust the path to tauri-driver and your Tauri app
        // Ensure tauri-driver is in your PATH or provide the full path
        // Ensure your Tauri app is built in release mode for testing
        console.log('Starting tauri-driver...');
        // This is a placeholder, actual tauri-driver start might be handled by the service
    },
    async afterSession(config, capabilities, specs) {
        // Stop tauri-driver
        console.log('Stopping tauri-driver...');
        // This is a placeholder, actual tauri-driver stop might be handled by the service
    }
};
