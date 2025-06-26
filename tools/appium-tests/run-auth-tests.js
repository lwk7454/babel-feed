#!/usr/bin/env node

/**
 * Authentication Tests Runner
 * 
 * This script runs the authentication persistence tests to validate
 * the fix for the authentication state logic bug.
 */

import { execSync } from 'child_process';
import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';

const COLORS = {
    RED: '\x1b[31m',
    GREEN: '\x1b[32m',
    YELLOW: '\x1b[33m',
    BLUE: '\x1b[34m',
    MAGENTA: '\x1b[35m',
    CYAN: '\x1b[36m',
    WHITE: '\x1b[37m',
    RESET: '\x1b[0m'
};

function log(color, message) {
    console.log(`${color}${message}${COLORS.RESET}`);
}

function header(message) {
    log(COLORS.CYAN, `\n${'='.repeat(60)}`);
    log(COLORS.CYAN, message.toUpperCase().padStart(message.length + 15).padEnd(60));
    log(COLORS.CYAN, `${'='.repeat(60)}\n`);
}

function step(stepNumber, message) {
    log(COLORS.BLUE, `📋 Step ${stepNumber}: ${message}`);
}

function success(message) {
    log(COLORS.GREEN, `✅ ${message}`);
}

function error(message) {
    log(COLORS.RED, `❌ ${message}`);
}

function warning(message) {
    log(COLORS.YELLOW, `⚠️ ${message}`);
}

async function checkPrerequisites() {
    step(1, 'Checking prerequisites');
    
    try {
        // Check if emulator is running
        const devices = execSync('adb devices', { encoding: 'utf-8' });
        if (!devices.includes('emulator-') && !devices.includes('device')) {
            throw new Error('No Android device/emulator detected');
        }
        success('Android device/emulator detected');
        
        // Check if app is installed
        const packages = execSync('adb shell pm list packages | grep com.babelfeed.app.debug', { encoding: 'utf-8' });
        if (!packages.includes('com.babelfeed.app.debug')) {
            throw new Error('Babel Feed app not installed');
        }
        success('Babel Feed app is installed');
        
        // Check if backend is running
        try {
            execSync('curl -s http://localhost:3000/health', { encoding: 'utf-8' });
            success('Backend API is running');
        } catch (e) {
            warning('Backend API not running - some tests may fail');
        }
        
        // Create reports directory
        const reportsDir = join(process.cwd(), 'reports');
        if (!existsSync(reportsDir)) {
            mkdirSync(reportsDir, { recursive: true });
        }
        
        const screenshotsDir = join(reportsDir, 'screenshots');
        if (!existsSync(screenshotsDir)) {
            mkdirSync(screenshotsDir, { recursive: true });
        }
        success('Reports directory ready');
        
        return true;
    } catch (err) {
        error(`Prerequisites check failed: ${err.message}`);
        return false;
    }
}

async function runTestSuite(suiteName, testFile) {
    log(COLORS.MAGENTA, `\n🧪 Running ${suiteName}...`);
    
    try {
        const command = `npx wdio run --spec tests/${testFile}`;
        log(COLORS.WHITE, `Executing: ${command}`);
        
        const output = execSync(command, { 
            encoding: 'utf-8',
            stdio: 'inherit',
            cwd: process.cwd()
        });
        
        success(`${suiteName} completed successfully`);
        return true;
    } catch (err) {
        error(`${suiteName} failed: ${err.message}`);
        return false;
    }
}

async function main() {
    header('Authentication Persistence Tests');
    
    log(COLORS.WHITE, 'This test suite validates the authentication state persistence fix');
    log(COLORS.WHITE, 'implemented in SecureTokenManager.getAuthState().\n');
    
    // Check prerequisites
    const prerequisitesOk = await checkPrerequisites();
    if (!prerequisitesOk) {
        error('Prerequisites not met. Please ensure:');
        console.log('  1. Android emulator is running');
        console.log('  2. Babel Feed app is installed');
        console.log('  3. Backend API is running (optional but recommended)');
        process.exit(1);
    }
    
    const testSuites = [
        {
            name: 'Core Authentication State Logic Verification',
            file: 'auth-state-logic-verification.test.js',
            description: 'Tests the specific fix for authentication state logic'
        },
        {
            name: 'Authentication Persistence Tests',
            file: 'authentication-persistence.test.js',
            description: 'Comprehensive persistence testing across app restarts'
        },
        {
            name: 'Comprehensive Authentication Flow',
            file: 'comprehensive-auth-flow.test.js',
            description: 'End-to-end authentication flow validation'
        }
    ];
    
    let passed = 0;
    let failed = 0;
    
    for (const suite of testSuites) {
        header(suite.name);
        log(COLORS.WHITE, suite.description);
        
        const success = await runTestSuite(suite.name, suite.file);
        if (success) {
            passed++;
        } else {
            failed++;
        }
    }
    
    // Summary
    header('Test Results Summary');
    
    if (failed === 0) {
        success(`All ${passed} test suites passed!`);
        log(COLORS.GREEN, '\n🎉 AUTHENTICATION PERSISTENCE FIX VALIDATED SUCCESSFULLY');
        log(COLORS.WHITE, 'The authentication state logic bug has been fixed.');
        process.exit(0);
    } else {
        error(`${failed} test suite(s) failed, ${passed} passed`);
        log(COLORS.RED, '\n❌ AUTHENTICATION PERSISTENCE FIX NEEDS ATTENTION');
        log(COLORS.WHITE, 'Please review the test results and fix any issues.');
        process.exit(1);
    }
}

// Handle script arguments
const args = process.argv.slice(2);

if (args.includes('--help') || args.includes('-h')) {
    console.log(`
Authentication Tests Runner

Usage: node run-auth-tests.js [options]

Options:
  --help, -h     Show this help message
  --quick        Run only the core authentication state logic tests
  --full         Run all authentication test suites (default)

Prerequisites:
  1. Android emulator running
  2. Babel Feed app installed (com.babelfeed.app.debug)
  3. Backend API running at localhost:3000 (recommended)

Examples:
  node run-auth-tests.js                 # Run all tests
  node run-auth-tests.js --quick         # Run core tests only
`);
    process.exit(0);
}

if (args.includes('--quick')) {
    // Run only the core authentication state logic tests
    header('Quick Authentication Tests');
    
    checkPrerequisites().then(ok => {
        if (!ok) process.exit(1);
        
        return runTestSuite(
            'Core Authentication State Logic', 
            'auth-state-logic-verification.test.js'
        );
    }).then(success => {
        if (success) {
            log(COLORS.GREEN, '\n🎉 QUICK TESTS PASSED');
            process.exit(0);
        } else {
            log(COLORS.RED, '\n❌ QUICK TESTS FAILED');
            process.exit(1);
        }
    });
} else {
    // Run full test suite
    main().catch(err => {
        error(`Test runner failed: ${err.message}`);
        process.exit(1);
    });
}