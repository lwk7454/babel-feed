/**
 * Backend API Health Monitoring
 * 
 * This class provides health monitoring and verification for the Babel Feed
 * backend API services used during automated testing.
 */

export class BackendHealthChecker {
  constructor(config) {
    this.config = config;
    this.baseUrl = config.baseUrl || 'http://10.0.2.2:3000';
    this.endpoints = config.endpoints || {};
    this.timeout = config.timeout || 30000;
    this.lastHealthCheck = null;
    this.healthHistory = [];
  }

  /**
   * Perform comprehensive health check
   */
  async checkHealth(throwOnFailure = true) {
    console.log('🏥 Checking backend API health...');
    
    try {
      const healthResult = await this.performHealthChecks();
      
      this.lastHealthCheck = {
        timestamp: new Date(),
        result: healthResult,
        success: healthResult.overall.healthy
      };
      
      this.healthHistory.push(this.lastHealthCheck);
      
      // Keep only last 10 health checks
      if (this.healthHistory.length > 10) {
        this.healthHistory = this.healthHistory.slice(-10);
      }
      
      if (healthResult.overall.healthy) {
        console.log('✅ Backend API is healthy');
        return healthResult;
      } else {
        const message = `Backend API health check failed: ${healthResult.overall.issues.join(', ')}`;
        console.error('❌', message);
        
        if (throwOnFailure) {
          throw new Error(message);
        }
        return null;
      }
      
    } catch (error) {
      const message = `Backend API health check error: ${error.message}`;
      console.error('💥', message);
      
      this.lastHealthCheck = {
        timestamp: new Date(),
        result: null,
        success: false,
        error: error.message
      };
      
      this.healthHistory.push(this.lastHealthCheck);
      
      if (throwOnFailure) {
        throw new Error(message);
      }
      return null;
    }
  }

  /**
   * Perform detailed health checks
   */
  async performHealthChecks() {
    const results = {
      overall: { healthy: true, issues: [] },
      endpoints: {},
      performance: {},
      features: {}
    };

    // Check health endpoint (primary check)
    try {
      const healthEndpointResult = await this.checkHealthEndpoint();
      results.endpoints.health = healthEndpointResult;
      if (!healthEndpointResult.success) {
        results.overall.healthy = false;
        results.overall.issues.push('Health endpoint failed');
      }
    } catch (error) {
      results.overall.healthy = false;
      results.overall.issues.push(`Health endpoint error: ${error.message}`);
    }

    // Only perform additional checks if basic health passes
    if (results.overall.healthy) {
      // Check basic connectivity
      try {
        const connectivityResult = await this.checkConnectivity();
        results.endpoints.root = connectivityResult;
        if (!connectivityResult.success) {
          results.overall.issues.push('Basic connectivity warning');
        }
      } catch (error) {
        results.overall.issues.push(`Connectivity warning: ${error.message}`);
      }

      // Quick performance check (fewer endpoints)
      try {
        const performanceResult = await this.checkPerformance();
        results.performance = performanceResult;
        if (performanceResult.averageResponseTime > 10000) { // 10 seconds
          results.overall.issues.push('High response times detected');
        }
      } catch (error) {
        results.overall.issues.push(`Performance check warning: ${error.message}`);
      }
    }

    return results;
  }

  /**
   * Check basic connectivity to API
   */
  async checkConnectivity() {
    const startTime = Date.now();
    
    try {
      const response = await this.makeRequest('/', {
        method: 'GET',
        timeout: 5000 // Short timeout for connectivity check
      });
      
      const duration = Date.now() - startTime;
      
      if (response.status >= 200 && response.status < 400) {
        return {
          success: true,
          status: response.status,
          responseTime: duration,
          data: response.data
        };
      } else {
        return {
          success: false,
          status: response.status,
          responseTime: duration,
          error: `HTTP ${response.status}`
        };
      }
      
    } catch (error) {
      return {
        success: false,
        responseTime: Date.now() - startTime,
        error: error.message
      };
    }
  }

  /**
   * Check health endpoint specifically
   */
  async checkHealthEndpoint() {
    const startTime = Date.now();
    
    try {
      const healthPath = this.endpoints.health || '/health';
      const response = await this.makeRequest(healthPath, {
        method: 'GET',
        timeout: 8000
      });
      
      const duration = Date.now() - startTime;
      
      if (response.status === 200 && response.data) {
        const isHealthy = response.data.status === 'healthy' || response.data.status === 'ok';
        
        return {
          success: isHealthy,
          status: response.status,
          responseTime: duration,
          data: response.data,
          apiVersion: response.data.version,
          serviceStatus: response.data.status
        };
      } else {
        return {
          success: false,
          status: response.status,
          responseTime: duration,
          error: `Health endpoint returned ${response.status}`
        };
      }
      
    } catch (error) {
      return {
        success: false,
        responseTime: Date.now() - startTime,
        error: error.message
      };
    }
  }

  /**
   * Check translation service health
   */
  async checkTranslationService() {
    const startTime = Date.now();
    
    try {
      const translationHealthPath = '/api/translation/health';
      const response = await this.makeRequest(translationHealthPath, {
        method: 'GET',
        timeout: 10000
      });
      
      const duration = Date.now() - startTime;
      
      if (response.status === 200) {
        return {
          success: true,
          status: response.status,
          responseTime: duration,
          data: response.data,
          serviceHealthy: response.data?.status === 'healthy'
        };
      } else {
        return {
          success: false,
          status: response.status,
          responseTime: duration,
          error: `Translation health endpoint returned ${response.status}`
        };
      }
      
    } catch (error) {
      return {
        success: false,
        responseTime: Date.now() - startTime,
        error: error.message
      };
    }
  }

  /**
   * Check API performance
   */
  async checkPerformance() {
    console.log('    ⏱️ Checking API performance...');
    
    const performanceTests = [
      { name: 'health', path: '/health', timeout: 5000 }
    ];
    
    const results = {
      tests: [],
      averageResponseTime: 0,
      slowRequests: [],
      errors: []
    };
    
    let totalTime = 0;
    let successfulRequests = 0;
    
    for (const test of performanceTests) {
      try {
        const startTime = Date.now();
        const response = await this.makeRequest(test.path, {
          method: 'GET',
          timeout: test.timeout
        });
        const duration = Date.now() - startTime;
        
        const testResult = {
          name: test.name,
          path: test.path,
          duration: duration,
          status: response.status,
          success: response.status >= 200 && response.status < 400
        };
        
        results.tests.push(testResult);
        
        if (testResult.success) {
          totalTime += duration;
          successfulRequests++;
          
          if (duration > 5000) { // Slow request threshold
            results.slowRequests.push(testResult);
          }
        }
        
      } catch (error) {
        results.errors.push({
          test: test.name,
          error: error.message
        });
      }
    }
    
    if (successfulRequests > 0) {
      results.averageResponseTime = Math.round(totalTime / successfulRequests);
    }
    
    return results;
  }

  /**
   * Check feature availability
   */
  async checkFeatures() {
    console.log('    🔧 Checking feature availability...');
    
    const features = {
      languages: false,
      models: false,
      translation: false,
      streaming: false,
      cache: false
    };
    
    try {
      // Check languages endpoint
      const languagesResponse = await this.makeRequest('/api/translation/languages', {
        method: 'GET',
        timeout: 5000
      });
      features.languages = languagesResponse.status === 200;
    } catch (error) {
      console.warn('    ⚠️ Languages endpoint check failed:', error.message);
    }
    
    try {
      // Check models endpoint
      const modelsResponse = await this.makeRequest('/api/translation/models', {
        method: 'GET',
        timeout: 5000
      });
      features.models = modelsResponse.status === 200;
    } catch (error) {
      console.warn('    ⚠️ Models endpoint check failed:', error.message);
    }
    
    try {
      // Check basic translation
      const translationResponse = await this.makeRequest('/api/translation/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: 'test',
          fromLanguage: 'en',
          toLanguage: 'es',
          complexity: 'simple',
          contentType: 'raw_text',
          priority: 'normal',
          streaming: false,
          requestId: 'health-check-' + Date.now()
        }),
        timeout: 15000
      });
      features.translation = translationResponse.status === 200;
    } catch (error) {
      console.warn('    ⚠️ Translation endpoint check failed:', error.message);
    }
    
    try {
      // Check cache endpoint
      const cacheResponse = await this.makeRequest('/api/cache/stats', {
        method: 'GET',
        timeout: 5000
      });
      features.cache = cacheResponse.status === 200;
    } catch (error) {
      console.warn('    ⚠️ Cache endpoint check failed:', error.message);
    }
    
    return features;
  }

  /**
   * Make HTTP request with timeout
   */
  async makeRequest(path, options = {}) {
    const url = this.baseUrl + path;
    const timeout = options.timeout || this.timeout;
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    try {
      const response = await fetch(url, {
        method: options.method || 'GET',
        headers: options.headers || {},
        body: options.body,
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      let data = null;
      const contentType = response.headers.get('content-type');
      
      if (contentType && contentType.includes('application/json')) {
        try {
          data = await response.json();
        } catch (jsonError) {
          console.warn('Failed to parse JSON response:', jsonError.message);
          data = await response.text();
        }
      } else {
        data = await response.text();
      }
      
      return {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
        data: data
      };
      
    } catch (error) {
      clearTimeout(timeoutId);
      
      if (error.name === 'AbortError') {
        throw new Error(`Request timeout after ${timeout}ms`);
      }
      
      if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
        throw new Error(`Connection failed: ${error.message}`);
      }
      
      throw error;
    }
  }

  /**
   * Get health status summary
   */
  getHealthSummary() {
    if (!this.lastHealthCheck) {
      return { status: 'unknown', message: 'No health check performed yet' };
    }
    
    const { success, result, timestamp, error } = this.lastHealthCheck;
    
    if (success && result) {
      return {
        status: 'healthy',
        timestamp: timestamp,
        message: 'All systems operational',
        details: result
      };
    } else {
      return {
        status: 'unhealthy',
        timestamp: timestamp,
        message: error || 'Health check failed',
        issues: result?.overall?.issues || []
      };
    }
  }

  /**
   * Get health history
   */
  getHealthHistory() {
    return [...this.healthHistory]; // Return copy
  }

  /**
   * Wait for API to become healthy
   */
  async waitForHealthy(maxWaitTime = 60000, checkInterval = 5000) {
    console.log(`🕐 Waiting for API to become healthy (max ${maxWaitTime}ms)...`);
    
    const startTime = Date.now();
    
    while (Date.now() - startTime < maxWaitTime) {
      try {
        const health = await this.checkHealth(false);
        
        if (health && health.overall.healthy) {
          console.log('✅ API became healthy');
          return true;
        }
        
        console.log(`    ⏳ API not healthy yet, waiting ${checkInterval}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, checkInterval));
        
      } catch (error) {
        console.warn('    ⚠️ Health check error during wait:', error.message);
        await new Promise(resolve => setTimeout(resolve, checkInterval));
      }
    }
    
    console.error('❌ API did not become healthy within timeout');
    return false;
  }

  /**
   * Reset health monitoring state
   */
  reset() {
    this.lastHealthCheck = null;
    this.healthHistory = [];
  }
}