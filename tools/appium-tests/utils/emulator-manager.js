/**
 * Android Emulator Management Utilities
 * 
 * This class provides automated management of Android emulators for testing,
 * including startup, health monitoring, and recovery operations.
 */

import { spawn, exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export class EmulatorManager {
  constructor(config) {
    this.config = config;
    this.emulatorName = config.name || 'Pixel_6_API_30';
    this.emulatorPort = config.port || 5554;
    this.bootTimeout = config.bootTimeout || 120000; // 2 minutes
    this.emulatorProcess = null;
    this.isManaged = false; // Whether we started the emulator
  }

  /**
   * Ensure emulator is running, start if necessary
   */
  async ensureEmulatorRunning() {
    console.log('📱 Checking emulator status...');
    
    try {
      // Check if emulator is already running
      const isRunning = await this.isEmulatorRunning();
      
      if (isRunning) {
        console.log('✅ Emulator is already running');
        return true;
      }
      
      // Check if auto-start is enabled
      if (!this.config.autoStart) {
        throw new Error('Emulator is not running and auto-start is disabled');
      }
      
      // Start the emulator
      console.log(`🚀 Starting emulator: ${this.emulatorName}...`);
      const started = await this.startEmulator();
      
      if (started) {
        console.log('✅ Emulator started successfully');
        return true;
      } else {
        throw new Error('Failed to start emulator');
      }
      
    } catch (error) {
      console.error('❌ Emulator management failed:', error.message);
      return false;
    }
  }

  /**
   * Check if the target emulator is running
   */
  async isEmulatorRunning() {
    try {
      const { stdout } = await execAsync('adb devices');
      const deviceId = `emulator-${this.emulatorPort}`;
      
      const lines = stdout.split('\n');
      for (const line of lines) {
        if (line.includes(deviceId) && line.includes('device')) {
          // Double-check that it's actually responsive
          return await this.isEmulatorResponsive(deviceId);
        }
      }
      
      return false;
      
    } catch (error) {
      console.warn('⚠️ Error checking emulator status:', error.message);
      return false;
    }
  }

  /**
   * Check if emulator is responsive
   */
  async isEmulatorResponsive(deviceId) {
    try {
      const { stdout } = await execAsync(`adb -s ${deviceId} shell echo "test"`);
      return stdout.trim() === 'test';
    } catch (error) {
      return false;
    }
  }

  /**
   * Start the Android emulator
   */
  async startEmulator() {
    return new Promise((resolve, reject) => {
      try {
        // Build emulator command
        const emulatorCmd = 'emulator';
        const emulatorArgs = [
          '-avd', this.emulatorName,
          '-port', this.emulatorPort.toString(),
          '-no-snapshot-save',
          '-no-audio',
          '-no-window', // Run headless
          '-gpu', 'swiftshader_indirect',
          '-memory', '2048',
          '-partition-size', '2048'
        ];
        
        console.log(`    🔧 Command: ${emulatorCmd} ${emulatorArgs.join(' ')}`);
        
        // Start emulator process
        this.emulatorProcess = spawn(emulatorCmd, emulatorArgs, {
          stdio: 'pipe',
          detached: false
        });
        
        this.isManaged = true;
        
        // Handle process events
        this.emulatorProcess.on('error', (error) => {
          console.error('💥 Emulator process error:', error.message);
          reject(new Error(`Failed to start emulator: ${error.message}`));
        });
        
        this.emulatorProcess.on('exit', (code, signal) => {
          console.log(`📱 Emulator process exited with code ${code}, signal ${signal}`);
          this.emulatorProcess = null;
          this.isManaged = false;
        });
        
        // Capture emulator output for debugging
        this.emulatorProcess.stdout.on('data', (data) => {
          const output = data.toString();
          if (output.includes('boot completed') || output.includes('Android ready')) {
            console.log('✅ Emulator boot completed');
          }
        });
        
        this.emulatorProcess.stderr.on('data', (data) => {
          const output = data.toString();
          // Log important error messages
          if (output.includes('ERROR') || output.includes('FATAL')) {
            console.warn('⚠️ Emulator warning:', output.trim());
          }
        });
        
        // Wait for emulator to be ready
        setTimeout(async () => {
          try {
            const ready = await this.waitForEmulatorReady();
            resolve(ready);
          } catch (waitError) {
            reject(waitError);
          }
        }, 5000); // Give emulator 5 seconds to start before checking
        
      } catch (error) {
        reject(new Error(`Failed to start emulator process: ${error.message}`));
      }
    });
  }

  /**
   * Wait for emulator to be fully ready
   */
  async waitForEmulatorReady() {
    const startTime = Date.now();
    const deviceId = `emulator-${this.emulatorPort}`;
    
    console.log(`    ⏳ Waiting for emulator to be ready (timeout: ${this.bootTimeout}ms)...`);
    
    while (Date.now() - startTime < this.bootTimeout) {
      try {
        // Check if device appears in adb devices
        const isVisible = await this.isEmulatorRunning();
        
        if (isVisible) {
          // Check if boot is completed
          const bootCompleted = await this.isBootCompleted(deviceId);
          
          if (bootCompleted) {
            // Final verification - check if we can run a simple command
            const responsive = await this.isEmulatorResponsive(deviceId);
            
            if (responsive) {
              console.log('    ✅ Emulator is ready and responsive');
              return true;
            }
          }
        }
        
        // Wait before next check
        await new Promise(resolve => setTimeout(resolve, 5000));
        
      } catch (error) {
        console.warn('    ⚠️ Error checking emulator readiness:', error.message);
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
    
    throw new Error(`Emulator failed to become ready within ${this.bootTimeout}ms`);
  }

  /**
   * Check if emulator boot is completed
   */
  async isBootCompleted(deviceId) {
    try {
      const { stdout } = await execAsync(`adb -s ${deviceId} shell getprop sys.boot_completed`);
      return stdout.trim() === '1';
    } catch (error) {
      return false;
    }
  }

  /**
   * Stop the emulator
   */
  async stopEmulator() {
    console.log('🛑 Stopping emulator...');
    
    try {
      const deviceId = `emulator-${this.emulatorPort}`;
      
      // Try graceful shutdown first
      await execAsync(`adb -s ${deviceId} emu kill`);
      
      // Wait a moment
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Force kill the process if it's still running
      if (this.emulatorProcess && !this.emulatorProcess.killed) {
        this.emulatorProcess.kill('SIGTERM');
        
        // Give it time to terminate gracefully
        setTimeout(() => {
          if (this.emulatorProcess && !this.emulatorProcess.killed) {
            this.emulatorProcess.kill('SIGKILL');
          }
        }, 5000);
      }
      
      console.log('✅ Emulator stop command sent');
      return true;
      
    } catch (error) {
      console.warn('⚠️ Error stopping emulator:', error.message);
      return false;
    }
  }

  /**
   * Restart the emulator
   */
  async restartEmulator() {
    console.log('🔄 Restarting emulator...');
    
    try {
      // Stop current emulator
      await this.stopEmulator();
      
      // Wait for shutdown
      await this.waitForEmulatorShutdown();
      
      // Start emulator again
      const started = await this.startEmulator();
      
      if (started) {
        console.log('✅ Emulator restarted successfully');
        return true;
      } else {
        throw new Error('Failed to restart emulator');
      }
      
    } catch (error) {
      console.error('❌ Emulator restart failed:', error.message);
      return false;
    }
  }

  /**
   * Wait for emulator to fully shutdown
   */
  async waitForEmulatorShutdown() {
    const maxWait = 30000; // 30 seconds
    const startTime = Date.now();
    
    console.log('    ⏳ Waiting for emulator shutdown...');
    
    while (Date.now() - startTime < maxWait) {
      const isRunning = await this.isEmulatorRunning();
      
      if (!isRunning) {
        console.log('    ✅ Emulator shutdown completed');
        return true;
      }
      
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    console.warn('    ⚠️ Emulator shutdown timeout, proceeding anyway');
    return false;
  }

  /**
   * Get emulator information
   */
  async getEmulatorInfo() {
    try {
      const deviceId = `emulator-${this.emulatorPort}`;
      
      if (!await this.isEmulatorRunning()) {
        return { status: 'not_running' };
      }
      
      // Get device properties
      const { stdout: androidVersion } = await execAsync(`adb -s ${deviceId} shell getprop ro.build.version.release`);
      const { stdout: apiLevel } = await execAsync(`adb -s ${deviceId} shell getprop ro.build.version.sdk`);
      const { stdout: deviceModel } = await execAsync(`adb -s ${deviceId} shell getprop ro.product.model`);
      const { stdout: deviceBrand } = await execAsync(`adb -s ${deviceId} shell getprop ro.product.brand`);
      
      return {
        status: 'running',
        deviceId: deviceId,
        androidVersion: androidVersion.trim(),
        apiLevel: parseInt(apiLevel.trim()),
        model: deviceModel.trim(),
        brand: deviceBrand.trim(),
        avdName: this.emulatorName,
        port: this.emulatorPort,
        managed: this.isManaged
      };
      
    } catch (error) {
      return {
        status: 'error',
        error: error.message
      };
    }
  }

  /**
   * Install APK on emulator
   */
  async installApk(apkPath) {
    console.log(`📦 Installing APK: ${apkPath}...`);
    
    try {
      const deviceId = `emulator-${this.emulatorPort}`;
      
      if (!await this.isEmulatorRunning()) {
        throw new Error('Emulator is not running');
      }
      
      const { stdout, stderr } = await execAsync(`adb -s ${deviceId} install -r "${apkPath}"`);
      
      if (stderr && stderr.includes('INSTALL_FAILED')) {
        throw new Error(`APK installation failed: ${stderr}`);
      }
      
      console.log('✅ APK installed successfully');
      return true;
      
    } catch (error) {
      console.error('❌ APK installation failed:', error.message);
      return false;
    }
  }

  /**
   * Clear app data
   */
  async clearAppData(packageName) {
    console.log(`🧹 Clearing app data for: ${packageName}...`);
    
    try {
      const deviceId = `emulator-${this.emulatorPort}`;
      
      if (!await this.isEmulatorRunning()) {
        throw new Error('Emulator is not running');
      }
      
      await execAsync(`adb -s ${deviceId} shell pm clear ${packageName}`);
      
      console.log('✅ App data cleared successfully');
      return true;
      
    } catch (error) {
      console.warn('⚠️ Failed to clear app data:', error.message);
      return false;
    }
  }

  /**
   * Take screenshot
   */
  async takeScreenshot(outputPath) {
    try {
      const deviceId = `emulator-${this.emulatorPort}`;
      
      if (!await this.isEmulatorRunning()) {
        throw new Error('Emulator is not running');
      }
      
      const tempPath = '/sdcard/screenshot.png';
      await execAsync(`adb -s ${deviceId} shell screencap -p ${tempPath}`);
      await execAsync(`adb -s ${deviceId} pull ${tempPath} "${outputPath}"`);
      await execAsync(`adb -s ${deviceId} shell rm ${tempPath}`);
      
      console.log(`📸 Screenshot saved to: ${outputPath}`);
      return true;
      
    } catch (error) {
      console.warn('⚠️ Failed to take screenshot:', error.message);
      return false;
    }
  }

  /**
   * Get emulator logs
   */
  async getEmulatorLogs(outputPath, maxLines = 1000) {
    try {
      const deviceId = `emulator-${this.emulatorPort}`;
      
      if (!await this.isEmulatorRunning()) {
        throw new Error('Emulator is not running');
      }
      
      const { stdout } = await execAsync(`adb -s ${deviceId} logcat -d -t ${maxLines}`);
      
      if (outputPath) {
        const fs = await import('fs');
        fs.writeFileSync(outputPath, stdout);
        console.log(`📝 Emulator logs saved to: ${outputPath}`);
      }
      
      return stdout;
      
    } catch (error) {
      console.warn('⚠️ Failed to get emulator logs:', error.message);
      return null;
    }
  }

  /**
   * Cleanup managed resources
   */
  async cleanup() {
    console.log('🧹 Cleaning up emulator manager...');
    
    if (this.isManaged && this.emulatorProcess) {
      await this.stopEmulator();
    }
    
    this.emulatorProcess = null;
    this.isManaged = false;
    
    console.log('✅ Emulator manager cleanup completed');
  }
}