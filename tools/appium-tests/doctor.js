#!/usr/bin/env bun
/**
 * Appium Environment Doctor
 * 
 * This script diagnoses the Appium test environment and provides
 * detailed analysis and recommendations for fixing issues.
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

const execAsync = promisify(exec);

class AppiumDoctor {
  constructor() {
    this.checks = [
      { name: 'Node.js Installation', method: 'checkNodejs' },
      { name: 'Java Installation', method: 'checkJava' },
      { name: 'Android SDK', method: 'checkAndroidSDK' },
      { name: 'Appium Installation', method: 'checkAppium' },
      { name: 'Appium Drivers', method: 'checkAppiumDrivers' },
      { name: 'Android Emulator', method: 'checkEmulator' },
      { name: 'ADB Connection', method: 'checkAdbConnection' },
      { name: 'Backend API', method: 'checkBackendAPI' },
      { name: 'Test Environment', method: 'checkTestEnvironment' }
    ];
    
    this.results = [];
    this.issues = [];
    this.recommendations = [];
  }

  async run() {
    console.log('🏥 Babel Feed Appium Environment Doctor\n');
    console.log('Diagnosing test environment...\n');

    for (const check of this.checks) {
      console.log(`🔍 Checking ${check.name}...`);
      
      try {
        const result = await this[check.method]();
        this.results.push({
          check: check.name,
          status: result.status,
          message: result.message,
          details: result.details || {},
          recommendations: result.recommendations || []
        });
        
        const statusIcon = result.status === 'pass' ? '✅' : result.status === 'warn' ? '⚠️' : '❌';
        console.log(`  ${statusIcon} ${result.message}`);
        
        if (result.status !== 'pass') {
          this.issues.push({
            check: check.name,
            severity: result.status,
            message: result.message,
            recommendations: result.recommendations || []
          });
        }
        
      } catch (error) {
        console.log(`  ❌ Error during check: ${error.message}`);
        this.results.push({
          check: check.name,
          status: 'fail',
          message: `Check failed: ${error.message}`,
          error: error.message
        });
        
        this.issues.push({
          check: check.name,
          severity: 'fail',
          message: `Check failed: ${error.message}`
        });
      }
      
      console.log('');
    }

    this.generateReport();
    this.printSummary();
  }

  async checkNodejs() {
    try {
      const { stdout } = await execAsync('node --version');
      const version = stdout.trim();
      const versionNum = parseFloat(version.replace('v', ''));
      
      if (versionNum >= 16) {
        return {
          status: 'pass',
          message: `Node.js ${version} installed (recommended)`,
          details: { version: version }
        };
      } else {
        return {
          status: 'warn',
          message: `Node.js ${version} installed (consider upgrading to v16+)`,
          details: { version: version },
          recommendations: ['Upgrade to Node.js v16 or higher for better compatibility']
        };
      }
    } catch (error) {
      return {
        status: 'fail',
        message: 'Node.js not found',
        recommendations: ['Install Node.js from https://nodejs.org/']
      };
    }
  }

  async checkJava() {
    try {
      const { stdout, stderr } = await execAsync('java -version');
      const output = stderr || stdout; // java -version outputs to stderr
      const versionMatch = output.match(/version "([^"]+)"/);
      
      if (versionMatch) {
        const version = versionMatch[1];
        const majorVersion = parseInt(version.split('.')[0]);
        
        if (majorVersion >= 8) {
          return {
            status: 'pass',
            message: `Java ${version} installed`,
            details: { version: version }
          };
        } else {
          return {
            status: 'warn',
            message: `Java ${version} installed (very old version)`,
            details: { version: version },
            recommendations: ['Upgrade to Java 8 or higher']
          };
        }
      } else {
        return {
          status: 'fail',
          message: 'Could not determine Java version',
          recommendations: ['Reinstall Java and ensure it\'s in PATH']
        };
      }
    } catch (error) {
      return {
        status: 'fail',
        message: 'Java not found',
        recommendations: [
          'Install Java JDK 8 or higher',
          'Ensure Java is added to PATH',
          'Set JAVA_HOME environment variable'
        ]
      };
    }
  }

  async checkAndroidSDK() {
    const issues = [];
    const recommendations = [];
    let status = 'pass';
    
    // Check ANDROID_HOME
    if (!process.env.ANDROID_HOME) {
      issues.push('ANDROID_HOME environment variable not set');
      recommendations.push('Set ANDROID_HOME to Android SDK installation directory');
      status = 'warn';
    } else {
      if (!existsSync(process.env.ANDROID_HOME)) {
        issues.push('ANDROID_HOME points to non-existent directory');
        recommendations.push('Verify ANDROID_HOME path and Android SDK installation');
        status = 'fail';
      }
    }
    
    // Check ADB
    try {
      const { stdout } = await execAsync('adb version');
      const adbInfo = stdout.split('\n')[0];
    } catch (error) {
      issues.push('ADB not found in PATH');
      recommendations.push('Add Android SDK platform-tools to PATH');
      status = 'fail';
    }
    
    // Check emulator command
    try {
      await execAsync('emulator -version');
    } catch (error) {
      issues.push('Android emulator not found');
      recommendations.push('Install Android emulator and add to PATH');
      if (status === 'pass') status = 'warn';
    }
    
    if (status === 'pass') {
      return {
        status: 'pass',
        message: 'Android SDK properly configured',
        details: { androidHome: process.env.ANDROID_HOME }
      };
    } else {
      return {
        status: status,
        message: `Android SDK issues: ${issues.join(', ')}`,
        recommendations: recommendations
      };
    }
  }

  async checkAppium() {
    try {
      const { stdout } = await execAsync('appium --version');
      const version = stdout.trim();
      
      return {
        status: 'pass',
        message: `Appium ${version} installed`,
        details: { version: version }
      };
    } catch (error) {
      return {
        status: 'fail',
        message: 'Appium not found',
        recommendations: [
          'Install Appium: npm install -g appium',
          'Or run: bun run setup'
        ]
      };
    }
  }

  async checkAppiumDrivers() {
    try {
      const { stdout } = await execAsync('appium driver list --installed');
      
      if (stdout.includes('uiautomator2')) {
        return {
          status: 'pass',
          message: 'Required Appium drivers installed',
          details: { drivers: stdout }
        };
      } else {
        return {
          status: 'fail',
          message: 'UiAutomator2 driver not installed',
          recommendations: [
            'Install UiAutomator2 driver: appium driver install uiautomator2',
            'Or run: bun run setup'
          ]
        };
      }
    } catch (error) {
      return {
        status: 'fail',
        message: 'Could not check Appium drivers',
        recommendations: [
          'Ensure Appium is installed and working',
          'Run: appium driver list --installed'
        ]
      };
    }
  }

  async checkEmulator() {
    try {
      // List available AVDs
      const { stdout } = await execAsync('emulator -list-avds');
      const avds = stdout.trim().split('\n').filter(line => line.trim());
      
      if (avds.length === 0) {
        return {
          status: 'warn',
          message: 'No Android Virtual Devices (AVDs) found',
          recommendations: [
            'Create an AVD using Android Studio AVD Manager',
            'Recommended: API level 30 with Google Play services'
          ]
        };
      }
      
      // Check if any emulator is running
      try {
        const { stdout: devicesOutput } = await execAsync('adb devices');
        const runningEmulators = devicesOutput.split('\n')
          .filter(line => line.includes('emulator-') && line.includes('device'))
          .length;
        
        if (runningEmulators > 0) {
          return {
            status: 'pass',
            message: `Android emulator running (${runningEmulators} active)`,
            details: { 
              availableAVDs: avds.length,
              runningEmulators: runningEmulators,
              avds: avds
            }
          };
        } else {
          return {
            status: 'warn',
            message: `${avds.length} AVDs available but none running`,
            details: { avds: avds },
            recommendations: [
              'Start an emulator before running tests',
              `Example: emulator -avd ${avds[0]}`
            ]
          };
        }
      } catch (adbError) {
        return {
          status: 'warn',
          message: `${avds.length} AVDs available (could not check running status)`,
          details: { avds: avds }
        };
      }
      
    } catch (error) {
      return {
        status: 'fail',
        message: 'Could not check Android emulators',
        recommendations: [
          'Ensure Android SDK and emulator are installed',
          'Check if emulator command is in PATH'
        ]
      };
    }
  }

  async checkAdbConnection() {
    try {
      const { stdout } = await execAsync('adb devices');
      const devices = stdout.split('\n')
        .filter(line => line.includes('\tdevice'))
        .map(line => line.split('\t')[0]);
      
      if (devices.length === 0) {
        return {
          status: 'warn',
          message: 'No Android devices connected',
          recommendations: [
            'Start an Android emulator',
            'Or connect a physical device with USB debugging enabled'
          ]
        };
      } else {
        return {
          status: 'pass',
          message: `${devices.length} Android device(s) connected: ${devices.join(', ')}`,
          details: { devices: devices }
        };
      }
    } catch (error) {
      return {
        status: 'fail',
        message: 'ADB connection failed',
        recommendations: [
          'Check if ADB is installed and in PATH',
          'Restart ADB server: adb kill-server && adb start-server'
        ]
      };
    }
  }

  async checkBackendAPI() {
    try {
      // Check if backend API is accessible
      const response = await fetch('http://10.0.2.2:3000/health', {
        signal: AbortSignal.timeout(5000)
      });
      
      if (response.ok) {
        const data = await response.json();
        return {
          status: 'pass',
          message: 'Backend API accessible and healthy',
          details: { apiHealth: data }
        };
      } else {
        return {
          status: 'warn',
          message: `Backend API returned ${response.status}`,
          recommendations: [
            'Check if backend server is running',
            'Verify API endpoint configuration'
          ]
        };
      }
    } catch (error) {
      return {
        status: 'warn',
        message: 'Backend API not accessible',
        details: { error: error.message },
        recommendations: [
          'Start the backend API server: bun run dev:api',
          'Check if port 3000 is available',
          'Verify network configuration'
        ]
      };
    }
  }

  async checkTestEnvironment() {
    const issues = [];
    const recommendations = [];
    
    // Check if test configuration exists
    const configPath = join(process.cwd(), 'configs/appium.config.js');
    if (!existsSync(configPath)) {
      issues.push('Appium configuration file missing');
      recommendations.push('Ensure appium.config.js exists in configs directory');
    }
    
    // Check if test files exist
    const testPath = join(process.cwd(), 'test.js');
    if (!existsSync(testPath)) {
      issues.push('Main test file missing');
      recommendations.push('Ensure test.js exists');
    }
    
    // Check if Babel Feed APK is available
    const apkPath = '../babel-android/app/build/outputs/apk/debug/app-debug.apk';
    if (!existsSync(apkPath)) {
      issues.push('Babel Feed APK not found');
      recommendations.push('Build the Android app: bun run build:android');
    }
    
    if (issues.length === 0) {
      return {
        status: 'pass',
        message: 'Test environment properly configured'
      };
    } else {
      return {
        status: 'warn',
        message: `Test environment issues: ${issues.join(', ')}`,
        recommendations: recommendations
      };
    }
  }

  generateReport() {
    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        total: this.results.length,
        passed: this.results.filter(r => r.status === 'pass').length,
        warnings: this.results.filter(r => r.status === 'warn').length,
        failed: this.results.filter(r => r.status === 'fail').length
      },
      results: this.results,
      issues: this.issues
    };
    
    try {
      const { writeFileSync } = require('fs');
      writeFileSync('doctor-report.json', JSON.stringify(report, null, 2));
      console.log('📄 Detailed report saved to doctor-report.json\n');
    } catch (error) {
      console.warn('⚠️ Could not save report file\n');
    }
  }

  printSummary() {
    const passed = this.results.filter(r => r.status === 'pass').length;
    const warnings = this.results.filter(r => r.status === 'warn').length;
    const failed = this.results.filter(r => r.status === 'fail').length;
    
    console.log('📊 SUMMARY');
    console.log('='.repeat(50));
    console.log(`✅ Passed: ${passed}`);
    console.log(`⚠️  Warnings: ${warnings}`);
    console.log(`❌ Failed: ${failed}`);
    console.log('');
    
    if (this.issues.length > 0) {
      console.log('🔧 ISSUES & RECOMMENDATIONS');
      console.log('='.repeat(50));
      
      this.issues.forEach((issue, index) => {
        const icon = issue.severity === 'fail' ? '❌' : '⚠️';
        console.log(`${icon} ${issue.check}: ${issue.message}`);
        
        if (issue.recommendations && issue.recommendations.length > 0) {
          issue.recommendations.forEach(rec => {
            console.log(`   💡 ${rec}`);
          });
        }
        console.log('');
      });
    }
    
    // Overall status
    if (failed === 0 && warnings === 0) {
      console.log('🎉 Environment is ready for testing!');
      console.log('   Run: bun run test:appium');
    } else if (failed === 0) {
      console.log('✅ Environment is mostly ready with minor issues');
      console.log('   You can proceed with testing, but consider fixing warnings');
    } else {
      console.log('❌ Environment has critical issues that need to be fixed');
      console.log('   Please resolve failed checks before running tests');
    }
  }
}

// Run doctor if this file is executed directly
if (import.meta.main) {
  const doctor = new AppiumDoctor();
  await doctor.run();
}