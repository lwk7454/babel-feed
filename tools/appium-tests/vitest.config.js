import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Test configuration
    testTimeout: 180000, // 3 minutes for mobile tests
    hookTimeout: 120000, // 2 minutes for setup/teardown (includes service startup)
    
    // Test environment
    environment: 'node',
    
    // Test patterns
    include: [
      'src/**/*.test.js',
      'src/**/*.spec.js'
    ],
    
    // Reporters
    reporters: ['verbose'],
    
    // Retry configuration for flaky mobile tests
    retry: 1,
    
    // Sequential testing for mobile (better than concurrent)
    maxConcurrency: 1,
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: true
      }
    }
  }
});