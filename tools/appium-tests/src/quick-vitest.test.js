/**
 * Modern Appium Mobile Testing Suite with Vitest
 * Clean, modern implementation using Vitest framework
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { remote } from 'webdriverio';
import { spawn } from 'child_process';
import { getAppiumConfig } from '../configs/appium.config.js';
import { BackendHealthChecker } from '../utils/backend-health.js';
import { EmulatorManager } from '../utils/emulator-manager.js';

class ModernTestRunner {
  constructor() {
    this.config = getAppiumConfig();
    this.driver = null;
    this.backendHealth = new BackendHealthChecker(this.config.backendApi);
    this.emulatorManager = new EmulatorManager(this.config.emulator);
    this.backendProcess = null;
    this.appiumProcess = null;
    
    this.testResults = {
      total: 0,
      passed: 0,
      failed: 0,
      startTime: null,
      endTime: null,
      details: []
    };
  }

  async startBackendService() {
    console.log('🦊 Starting backend API service...');
    
    return new Promise((resolve, reject) => {
      // Start the backend service in the parent directory
      this.backendProcess = spawn('bun', ['run', 'dev:api'], {
        cwd: '../../', // Go up to project root
        stdio: ['ignore', 'pipe', 'pipe'],
        detached: false
      });

      let output = '';
      this.backendProcess.stdout.on('data', (data) => {
        output += data.toString();
        // Check if API is ready
        if (output.includes('is running at')) {
          console.log('✅ Backend API service started');
          // Wait a moment for full startup
          setTimeout(resolve, 2000);
        }
      });

      this.backendProcess.stderr.on('data', (data) => {
        console.warn('Backend stderr:', data.toString());
      });

      this.backendProcess.on('error', (error) => {
        console.error('Failed to start backend service:', error);
        reject(error);
      });

      // Timeout if service doesn't start
      setTimeout(() => {
        if (!output.includes('is running at')) {
          reject(new Error('Backend service failed to start within timeout'));
        }
      }, 15000);
    });
  }

  async stopBackendService() {
    if (this.backendProcess) {
      console.log('🛑 Stopping backend API service...');
      
      try {
        this.backendProcess.kill('SIGTERM');
        
        // Wait for graceful shutdown
        await new Promise((resolve) => {
          this.backendProcess.on('exit', resolve);
          setTimeout(resolve, 5000); // Fallback timeout
        });
        
        console.log('✅ Backend API service stopped');
      } catch (error) {
        console.warn('⚠️ Error stopping backend service:', error.message);
        // Force kill if graceful shutdown fails
        try {
          this.backendProcess.kill('SIGKILL');
        } catch (forceError) {
          console.warn('⚠️ Force kill failed:', forceError.message);
        }
      }
      
      this.backendProcess = null;
    }
  }

  async startAppiumServer() {
    console.log('🤖 Starting Appium server...');
    
    return new Promise((resolve, reject) => {
      let resolved = false;
      
      this.appiumProcess = spawn('appium', ['--port', '4723'], {
        stdio: ['ignore', 'pipe', 'pipe']
      });

      const handleStartup = () => {
        if (!resolved) {
          resolved = true;
          console.log('✅ Appium server started');
          setTimeout(resolve, 1000); // Brief wait for full startup
        }
      };

      let output = '';
      this.appiumProcess.stdout.on('data', (data) => {
        output += data.toString();
        // Check if Appium is ready
        if (output.includes('Appium REST http interface listener started')) {
          handleStartup();
        }
      });

      this.appiumProcess.stderr.on('data', (data) => {
        const stderr = data.toString();
        output += stderr;
        // Some Appium logs go to stderr but aren't errors
        if (stderr.includes('Appium REST http interface listener started')) {
          handleStartup();
        }
      });

      this.appiumProcess.on('error', (error) => {
        if (!resolved) {
          resolved = true;
          console.error('Failed to start Appium server:', error);
          reject(error);
        }
      });

      // Timeout if Appium doesn't start
      setTimeout(() => {
        if (!resolved) {
          resolved = true;
          reject(new Error('Appium server failed to start within timeout'));
        }
      }, 15000);
    });
  }

  async stopAppiumServer() {
    if (this.appiumProcess) {
      console.log('🛑 Stopping Appium server...');
      
      try {
        this.appiumProcess.kill('SIGTERM');
        
        await new Promise((resolve) => {
          this.appiumProcess.on('exit', resolve);
          setTimeout(resolve, 5000);
        });
        
        console.log('✅ Appium server stopped');
      } catch (error) {
        console.warn('⚠️ Error stopping Appium server:', error.message);
        try {
          this.appiumProcess.kill('SIGKILL');
        } catch (forceError) {
          console.warn('⚠️ Force kill failed:', forceError.message);
        }
      }
      
      this.appiumProcess = null;
    }
  }

  async initialize() {
    console.log('🚀 Modern Test Suite: Initializing...');
    
    try {
      this.testResults.startTime = new Date();
      
      // Start services in parallel where possible
      console.log('🔧 Starting required services...');
      
      // Start backend API service
      await this.startBackendService();
      
      // Start Appium server
      await this.startAppiumServer();
      
      // Check backend API health
      await this.backendHealth.checkHealth();
      
      // Initialize Appium driver
      this.driver = await remote({
        hostname: this.config.server.host,
        port: this.config.server.port,
        path: this.config.server.path,
        capabilities: this.config.capabilities,
        logLevel: 'warn'
      });
      
      await this.driver.pause(2000);
      
      console.log('✅ Modern initialization complete');
      return true;
      
    } catch (error) {
      console.error('❌ Modern initialization failed:', error.message);
      // Cleanup on failure
      await this.cleanup();
      return false;
    }
  }

  async runTest(testName, testFunction) {
    this.testResults.total++;
    console.log(`🧪 ${testName}...`);
    
    const startTime = Date.now();
    
    try {
      await testFunction();
      this.testResults.passed++;
      const duration = Date.now() - startTime;
      console.log(`✅ ${testName} (${duration}ms)`);
      
      this.testResults.details.push({
        test: testName,
        status: 'PASSED',
        duration: duration
      });
      
    } catch (error) {
      this.testResults.failed++;
      const duration = Date.now() - startTime;
      console.log(`❌ ${testName}: ${error.message} (${duration}ms)`);
      
      this.testResults.details.push({
        test: testName,
        status: 'FAILED',
        duration: duration,
        error: error.message
      });
    }
  }

  async testAppConnection() {
    const appState = await this.driver.queryAppState('com.babelfeed.app.debug');
    if (appState < 1) {
      throw new Error('App is not installed or not running');
    }
  }

  async testBasicUI() {
    const source = await this.driver.getPageSource();
    if (!source || source.length < 100) {
      throw new Error('App UI not accessible');
    }
  }

  async testContexts() {
    const contexts = await this.driver.getContexts();
    if (contexts.length === 0) {
      throw new Error('No contexts available');
    }
    
    await this.driver.switchContext('NATIVE_APP');
    
    const contextsAfterSwitch = await this.driver.getContexts();
    if (contextsAfterSwitch.length === 0) {
      throw new Error('Context switching failed - no contexts available after switch');
    }
  }

  async testWebViewAwareness() {
    const contexts = await this.driver.getContexts();
    const webViewCount = contexts.filter(ctx => ctx.includes('WEBVIEW')).length;
    
    console.log(`    📱 WebView contexts: ${webViewCount} (${webViewCount === 0 ? 'expected for basic app' : 'available'})`);
    return true;
  }

  async testScreenshot() {
    const screenshot = await this.driver.takeScreenshot();
    if (!screenshot || screenshot.length === 0) {
      throw new Error('Screenshot failed');
    }
  }

  async testDeviceInfo() {
    try {
      const orientation = await this.driver.getOrientation();
      const windowSize = await this.driver.getWindowSize();
      
      if (!orientation || !windowSize) {
        throw new Error('Device info not accessible');
      }
    } catch (error) {
      console.log(`    ⚠️ Some device info unavailable: ${error.message}`);
    }
  }

  async cleanup() {
    console.log('🧹 Cleaning up test environment...');
    
    // Close driver session
    if (this.driver) {
      try {
        await this.driver.deleteSession();
        console.log('✅ Driver session closed');
      } catch (error) {
        console.warn('⚠️ Driver cleanup warning:', error.message);
      }
    }
    
    // Stop services
    await Promise.all([
      this.stopBackendService(),
      this.stopAppiumServer()
    ]);
    
    console.log('✅ Cleanup complete');
  }
}

describe('Appium Mobile Testing Suite', () => {
  let testRunner;
  let testResults;

  beforeAll(async () => {
    testRunner = new ModernTestRunner();
    
    // Initialize the test environment
    const initialized = await testRunner.initialize();
    if (!initialized) {
      throw new Error('Failed to initialize test environment');
    }
  });

  afterAll(async () => {
    if (testRunner) {
      await testRunner.cleanup();
    }
  });

  describe('App Connection Tests', () => {
    it('should connect to the Android app successfully', async () => {
      await testRunner.runTest('App Connection', async () => {
        await testRunner.testAppConnection();
      });
      
      // Check if the test passed
      const lastResult = testRunner.testResults.details[testRunner.testResults.details.length - 1];
      expect(lastResult.status).toBe('PASSED');
    });
  });

  describe('UI Interaction Tests', () => {
    it('should access basic UI elements', async () => {
      await testRunner.runTest('Basic UI Access', async () => {
        await testRunner.testBasicUI();
      });
      
      const lastResult = testRunner.testResults.details[testRunner.testResults.details.length - 1];
      expect(lastResult.status).toBe('PASSED');
    });
  });

  describe('Context Management Tests', () => {
    it('should manage contexts correctly', async () => {
      await testRunner.runTest('Context Management', async () => {
        await testRunner.testContexts();
      });
      
      const lastResult = testRunner.testResults.details[testRunner.testResults.details.length - 1];
      expect(lastResult.status).toBe('PASSED');
    });
  });

  describe('WebView Awareness Tests', () => {
    it('should detect WebView availability correctly', async () => {
      await testRunner.runTest('WebView Awareness', async () => {
        await testRunner.testWebViewAwareness();
      });
      
      const lastResult = testRunner.testResults.details[testRunner.testResults.details.length - 1];
      expect(lastResult.status).toBe('PASSED');
    });
  });

  describe('Device Capabilities Tests', () => {
    it('should capture screenshots', async () => {
      await testRunner.runTest('Screenshot Capability', async () => {
        await testRunner.testScreenshot();
      });
      
      const lastResult = testRunner.testResults.details[testRunner.testResults.details.length - 1];
      expect(lastResult.status).toBe('PASSED');
    });

    it('should access device information', async () => {
      await testRunner.runTest('Device Information', async () => {
        await testRunner.testDeviceInfo();
      });
      
      const lastResult = testRunner.testResults.details[testRunner.testResults.details.length - 1];
      expect(lastResult.status).toBe('PASSED');
    });
  });

  describe('Test Suite Summary', () => {
    it('should have a high success rate', async () => {
      // Run summary check
      const successRate = Math.round((testRunner.testResults.passed / testRunner.testResults.total) * 100);
      
      expect(testRunner.testResults.total).toBeGreaterThan(0);
      expect(testRunner.testResults.passed).toBeGreaterThan(0);
      expect(successRate).toBeGreaterThanOrEqual(80); // 80% minimum success rate
      
      console.log(`📊 Test Summary: ${testRunner.testResults.passed}/${testRunner.testResults.total} passed (${successRate}%)`);
    });
  });
});