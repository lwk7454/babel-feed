#!/usr/bin/env bun
/**
 * Appium Test Environment Setup
 * 
 * This script sets up the automated testing environment, installs Appium server,
 * configures drivers, and verifies the setup.
 */

import { spawn, exec } from 'child_process';
import { promisify } from 'util';
import { existsSync } from 'fs';

const execAsync = promisify(exec);

class AppiumSetup {
  constructor() {
    this.appiumVersion = '2.11.1';
    this.requiredDrivers = [
      'uiautomator2'
    ];
    this.setupSteps = [
      'checkPrerequisites',
      'installAppiumServer', 
      'installDrivers',
      'verifySetup',
      'generateReport'
    ];
  }

  async run() {
    console.log('🚀 Setting up Appium test environment...\n');

    try {
      for (const step of this.setupSteps) {
        console.log(`📋 ${step}...`);
        const success = await this[step]();
        
        if (!success) {
          console.error(`❌ Setup failed at step: ${step}`);
          process.exit(1);
        }
        
        console.log(`✅ ${step} completed\n`);
      }

      console.log('🎉 Appium test environment setup completed successfully!');
      console.log('\n📋 Next steps:');
      console.log('  1. Start an Android emulator');
      console.log('  2. Run: bun run test:appium');
      
    } catch (error) {
      console.error('💥 Setup failed:', error.message);
      process.exit(1);
    }
  }

  async checkPrerequisites() {
    console.log('  🔍 Checking prerequisites...');

    // Check if Node.js is installed
    try {
      const { stdout } = await execAsync('node --version');
      console.log(`    ✅ Node.js: ${stdout.trim()}`);
    } catch (error) {
      console.error('    ❌ Node.js not found. Please install Node.js');
      return false;
    }

    // Check if Java is installed
    try {
      const { stdout } = await execAsync('java -version');
      console.log('    ✅ Java installed');
    } catch (error) {
      console.error('    ❌ Java not found. Please install Java 8 or higher');
      return false;
    }

    // Check if Android SDK is installed
    try {
      const { stdout } = await execAsync('adb version');
      console.log('    ✅ Android SDK (adb) available');
    } catch (error) {
      console.error('    ❌ Android SDK not found. Please install Android SDK');
      return false;
    }

    // Check if ANDROID_HOME is set
    if (process.env.ANDROID_HOME) {
      console.log(`    ✅ ANDROID_HOME: ${process.env.ANDROID_HOME}`);
    } else {
      console.warn('    ⚠️ ANDROID_HOME not set. This may cause issues');
    }

    return true;
  }

  async installAppiumServer() {
    console.log('  📦 Installing Appium server...');

    try {
      // Check if Appium is already installed globally
      try {
        const { stdout } = await execAsync('appium --version');
        console.log(`    ✅ Appium already installed: ${stdout.trim()}`);
        return true;
      } catch (error) {
        console.log('    📥 Installing Appium globally...');
      }

      // Install Appium globally
      await execAsync('npm install -g appium@latest');
      
      // Verify installation
      const { stdout } = await execAsync('appium --version');
      console.log(`    ✅ Appium installed: ${stdout.trim()}`);

      return true;

    } catch (error) {
      console.error('    ❌ Failed to install Appium:', error.message);
      return false;
    }
  }

  async installDrivers() {
    console.log('  🔌 Installing Appium drivers...');

    for (const driver of this.requiredDrivers) {
      try {
        console.log(`    📥 Installing ${driver} driver...`);
        
        // Install driver
        await execAsync(`appium driver install ${driver}`);
        console.log(`    ✅ ${driver} driver installed`);

      } catch (error) {
        // Driver might already be installed
        console.log(`    ℹ️ ${driver} driver install result: ${error.message}`);
      }
    }

    // List installed drivers
    try {
      const { stdout } = await execAsync('appium driver list --installed');
      console.log('    📋 Installed drivers:');
      console.log(stdout);
    } catch (error) {
      console.warn('    ⚠️ Could not list drivers:', error.message);
    }

    return true;
  }

  async verifySetup() {
    console.log('  🔍 Verifying setup...');

    // Check Appium server can start
    try {
      console.log('    🧪 Testing Appium server startup...');
      
      const appiumProcess = spawn('appium', ['--port', '4724'], {
        stdio: 'pipe'
      });

      let serverStarted = false;
      
      return new Promise((resolve) => {
        const timeout = setTimeout(() => {
          appiumProcess.kill();
          if (!serverStarted) {
            console.error('    ❌ Appium server failed to start within timeout');
            resolve(false);
          }
        }, 10000); // 10 second timeout

        appiumProcess.stdout.on('data', (data) => {
          const output = data.toString();
          if (output.includes('Appium REST http interface listener started')) {
            serverStarted = true;
            console.log('    ✅ Appium server started successfully');
            clearTimeout(timeout);
            appiumProcess.kill();
            resolve(true);
          }
        });

        appiumProcess.stderr.on('data', (data) => {
          const output = data.toString();
          if (output.includes('Error') || output.includes('EADDRINUSE')) {
            console.warn('    ⚠️ Appium server warning:', output.trim());
          }
        });

        appiumProcess.on('error', (error) => {
          console.error('    ❌ Failed to start Appium server:', error.message);
          clearTimeout(timeout);
          resolve(false);
        });
      });

    } catch (error) {
      console.error('    ❌ Verification failed:', error.message);
      return false;
    }
  }

  async generateReport() {
    console.log('  📄 Generating setup report...');

    try {
      const report = {
        timestamp: new Date().toISOString(),
        node: process.version,
        platform: process.platform,
        arch: process.arch,
        environment: {
          ANDROID_HOME: process.env.ANDROID_HOME || 'Not set',
          JAVA_HOME: process.env.JAVA_HOME || 'Not set'
        },
        tools: {}
      };

      // Get tool versions
      try {
        const { stdout: appiumVersion } = await execAsync('appium --version');
        report.tools.appium = appiumVersion.trim();
      } catch (error) {
        report.tools.appium = 'Not installed';
      }

      try {
        const { stdout: adbVersion } = await execAsync('adb version');
        report.tools.adb = adbVersion.split('\n')[0];
      } catch (error) {
        report.tools.adb = 'Not available';
      }

      try {
        const { stdout: javaVersion } = await execAsync('java -version');
        report.tools.java = javaVersion.split('\n')[0];
      } catch (error) {
        report.tools.java = 'Not available';
      }

      // Write report
      const { writeFileSync } = await import('fs');
      writeFileSync('setup-report.json', JSON.stringify(report, null, 2));
      
      console.log('    ✅ Setup report saved to setup-report.json');
      console.log('    📋 Environment summary:');
      console.log(`        Node.js: ${report.node}`);
      console.log(`        Appium: ${report.tools.appium}`);
      console.log(`        ADB: ${report.tools.adb}`);
      console.log(`        ANDROID_HOME: ${report.environment.ANDROID_HOME}`);

      return true;

    } catch (error) {
      console.warn('    ⚠️ Could not generate report:', error.message);
      return true; // Don't fail setup for this
    }
  }
}

// Run setup if this file is executed directly
if (import.meta.main) {
  const setup = new AppiumSetup();
  await setup.run();
}