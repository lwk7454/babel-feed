/**
 * WebDriver Driver Management
 * Simple, focused driver lifecycle management
 */

import { remote, type RemoteOptions } from 'webdriverio';
import { appiumConfig } from './capabilities.js';
import { spawn, type ChildProcess } from 'child_process';

export class DriverManager {
  private driver: WebdriverIO.Browser | null = null;
  private appiumProcess: ChildProcess | null = null;
  private backendProcess: ChildProcess | null = null;

  async startAppiumServer(): Promise<void> {
    console.log('🚀 Starting Appium server...');
    
    return new Promise((resolve, reject) => {
      this.appiumProcess = spawn('appium', ['server', '--address', appiumConfig.host, '--port', appiumConfig.port.toString()], {
        stdio: ['ignore', 'pipe', 'pipe']
      });

      let output = '';
      this.appiumProcess.stdout?.on('data', (data) => {
        output += data.toString();
        if (output.includes('Appium REST http interface listener started')) {
          console.log('✅ Appium server started');
          setTimeout(resolve, 2000);
        }
      });

      this.appiumProcess.stderr?.on('data', (data) => {
        console.error('Appium server error:', data.toString());
      });

      this.appiumProcess.on('error', reject);
      
      // Timeout after 30 seconds
      setTimeout(() => reject(new Error('Appium server startup timeout')), 30000);
    });
  }

  async startBackendService(): Promise<void> {
    console.log('🦊 Starting backend API service...');
    
    return new Promise((resolve, reject) => {
      this.backendProcess = spawn('bun', ['run', 'dev:api'], {
        cwd: '../../',
        stdio: ['ignore', 'pipe', 'pipe'],
        detached: false
      });

      let output = '';
      this.backendProcess.stdout?.on('data', (data) => {
        output += data.toString();
        if (output.includes('is running at')) {
          console.log('✅ Backend API service started');
          setTimeout(resolve, 2000);
        }
      });

      this.backendProcess.stderr?.on('data', (data) => {
        console.error('Backend service error:', data.toString());
      });

      this.backendProcess.on('error', reject);
      
      // Timeout after 60 seconds
      setTimeout(() => reject(new Error('Backend service startup timeout')), 60000);
    });
  }

  async createDriver(): Promise<WebdriverIO.Browser> {
    if (this.driver) {
      return this.driver;
    }

    console.log('📱 Creating WebDriver session...');
    
    const options: RemoteOptions = {
      protocol: 'http',
      hostname: appiumConfig.host,
      port: appiumConfig.port,
      path: appiumConfig.path,
      capabilities: appiumConfig.capabilities,
      logLevel: appiumConfig.logLevel,
      waitforTimeout: 10000,
      connectionRetryTimeout: 120000,
      connectionRetryCount: 3
    };

    this.driver = await remote(options);
    console.log('✅ WebDriver session created');
    
    return this.driver;
  }

  async quitDriver(): Promise<void> {
    if (this.driver) {
      console.log('🔌 Closing WebDriver session...');
      await this.driver.deleteSession();
      this.driver = null;
    }
  }

  async stopServices(): Promise<void> {
    await this.quitDriver();

    if (this.appiumProcess) {
      console.log('🛑 Stopping Appium server...');
      this.appiumProcess.kill('SIGTERM');
      this.appiumProcess = null;
    }

    if (this.backendProcess) {
      console.log('🛑 Stopping backend service...');
      this.backendProcess.kill('SIGTERM');
      this.backendProcess = null;
    }
  }

  getDriver(): WebdriverIO.Browser {
    if (!this.driver) {
      throw new Error('Driver not initialized. Call createDriver() first.');
    }
    return this.driver;
  }
}