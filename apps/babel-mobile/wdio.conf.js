import { execSync, spawn, spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// keep track of the emulator child process
let emulatorProcess;

function getApkPath() {
    if (process.env.CI) {
        // CI always uses release builds
        return './src-tauri/gen/android/app/build/outputs/apk/universal/release/app-universal-release-unsigned.apk';
    }
    
    // Local development - debug builds
    // Check both possible debug APK locations (to match the simplified build script)
    const debugPath = './src-tauri/gen/android/app/build/outputs/apk/debug/app-debug.apk';
    const universalDebugPath = './src-tauri/gen/android/app/build/outputs/apk/universal/debug/app-universal-debug.apk';
    
    if (fs.existsSync(debugPath)) {
        return debugPath;
    }
    return universalDebugPath;
}

function getBuildCommand() {
    if (process.env.CI) {
        // CI builds - clean release
        return './scripts/build.sh --clean --release';
    }
    
    // Local development - debug builds  
    return './scripts/build.sh --debug';
}

const capabilities = [{
    maxInstances: 1,
    platformName: 'Android',
    // Don't specify platformVersion to let Appium auto-detect and use any available device
    'appium:automationName': 'UiAutomator2',
    'appium:app': getApkPath(),
    'appium:autoGrantPermissions': true,
    'appium:fullReset': true,
    'appium:newCommandTimeout': 60000,
    'appium:androidInstallTimeout': 90000,
    'appium:systemPort': 8201,
    // Enable automatic Chromedriver management for WebView support
    'appium:chromedriverAutodownload': true,
    'appium:ensureWebviewsHavePages': true,
    'appium:nativeWebScreenshot': true,
    'appium:recreateChromeDriverSessions': true
}];

// Simplified configuration - let Appium connect to running emulator

export const config = {
    runner: 'local',
    port: 4723, // Default Appium port
    specs: [
        './e2e/specs/**/*.spec.js' // Run all specs for mobile testing
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
    onPrepare: async function () {
        console.log('🚀 Starting Tauri build process...');
        
        try {
            const buildCmd = getBuildCommand();
            console.log(`📦 Build command: ${buildCmd}`);
            console.log(`🎯 Target APK: ${getApkPath()}`);
            
            // Build the APK
            console.log('🔨 Building APK...');
            execSync(buildCmd, { 
                stdio: 'inherit',
                env: { 
                    ...process.env
                }
            });

            // Verify APK exists
            if (!fs.existsSync(getApkPath())) {
                throw new Error(`APK not found at ${getApkPath()}`);
            }

            // Ensure emulator is running for local development
            if (!process.env.CI) {
                const runningEmulators = spawnSync('adb', ['devices'], { encoding: 'utf8' });
                console.log('🔍 Checking for running emulators...');
                
                // Check if there's an actual device connected (not just the header)
                const deviceLines = runningEmulators.stdout?.split('\n').filter(line => 
                    line.includes('\tdevice') || line.includes('\temulator')
                );
                
                if (!deviceLines || deviceLines.length === 0) {
                    console.log('🔧 Starting Android emulator for local development...');
                    try {
                        // Use the simplified emulator setup script
                        execSync('HEADED_MODE=true ./scripts/setup-android.sh', { stdio: 'inherit' });
                        console.log('✅ Android emulator is ready');
                    } catch (error) {
                        console.warn('⚠️ Could not start emulator automatically:', error.message);
                        console.log('💡 Please start an Android emulator manually and run the test again');
                    }
                } else {
                    console.log('✅ Android emulator is already running');
                }
            }
            
            console.log('✅ APK ready for testing');
        } catch (error) {
            console.error('❌ Build failed:', error);
            process.exit(1);
        }
    },

    // Simplified session setup - assume emulator is already running
    beforeSession: () => {
        console.log('🔍 Checking Android emulator availability...');
        
        // Check if emulator is already running
        const runningEmulators = spawnSync('adb', ['devices'], { encoding: 'utf8' });
        if (runningEmulators.stdout && runningEmulators.stdout.includes('emulator-')) {
            console.log('✅ Android emulator is already running');
            return Promise.resolve();
        } else {
            console.log('⚠️ No Android emulator detected. Please start an emulator manually.');
            return Promise.resolve();
        }
    },

    afterSession: () => {
        if (process.env.CI) {
            // In CI, Appium manages the emulator lifecycle
            console.log('CI environment - letting Appium handle emulator cleanup');
        } else if (emulatorProcess) {
            // In local development, keep emulator running for manual inspection
            console.log('Keeping emulator running for manual inspection (local development)');
            console.log('To stop the emulator manually, run: adb emu kill');
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
