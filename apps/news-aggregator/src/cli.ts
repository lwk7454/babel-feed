#!/usr/bin/env bun

import { NewsAggregator } from './services/aggregator';
import { logger } from './utils/logger';

const COMMANDS = {
  'status': 'Show aggregator status',
  'sources': 'List all configured sources',
  'sources:enabled': 'List enabled sources',
  'sources:health': 'Show source health status',
  'ai-providers': 'List all AI providers',
  'ai-providers:health': 'Show AI provider health status',
  'help': 'Show this help message',
};

async function main() {
  const command = process.argv[2];
  
  if (!command || command === 'help') {
    console.log('News Aggregator CLI');
    console.log('Usage: bun run cli.ts <command>');
    console.log('\nCommands:');
    for (const [cmd, description] of Object.entries(COMMANDS)) {
      console.log(`  ${cmd.padEnd(20)} ${description}`);
    }
    return;
  }

  try {
    const aggregator = new NewsAggregator();
    await aggregator.initialize();

    switch (command) {
      case 'status':
        await showStatus(aggregator);
        break;
      case 'sources':
        await showSources(aggregator);
        break;
      case 'sources:enabled':
        await showEnabledSources(aggregator);
        break;
      case 'sources:health':
        await showSourceHealth(aggregator);
        break;
      case 'ai-providers':
        await showAiProviders(aggregator);
        break;
      case 'ai-providers:health':
        await showAiProviderHealth(aggregator);
        break;
      default:
        console.log(`Unknown command: ${command}`);
        console.log('Run "bun run cli.ts help" for available commands');
    }
  } catch (error) {
    logger.error('CLI command failed:', error);
    process.exit(1);
  }
}

async function showStatus(aggregator: NewsAggregator) {
  const status = await aggregator.getStatus();
  
  console.log('\n=== News Aggregator Status ===');
  console.log(`Running: ${status.running ? '✅' : '❌'}`);
  console.log(`Health: ${getHealthIcon(status.health.status)} ${status.health.status}`);
  console.log(`Uptime: ${Math.round(status.health.uptime / 1000)}s`);
  console.log(`Environment: ${status.config.environment}`);
  console.log(`Log Level: ${status.config.logLevel}`);
  console.log(`Polling Interval: ${status.config.pollingInterval}ms`);
  console.log(`Max Concurrent: ${status.config.maxConcurrentSources}`);
  
  console.log('\n=== Sources Summary ===');
  console.log(`Total Sources: ${status.health.summary.totalSources}`);
  console.log(`Healthy Sources: ${status.health.summary.healthySources}`);
  console.log(`Unhealthy Sources: ${status.health.summary.unhealthySources}`);
  
  console.log('\n=== Services Status ===');
  for (const service of status.health.services) {
    console.log(`${service.name}: ${getHealthIcon(service.status)} ${service.status}`);
    if (service.responseTime) {
      console.log(`  Response Time: ${service.responseTime}ms`);
    }
  }
}

async function showSources(aggregator: NewsAggregator) {
  const sourceManager = aggregator.getSourceManager();
  const sources = await sourceManager.getAllSources();
  
  console.log('\n=== All News Sources ===');
  for (const source of sources) {
    console.log(`\n${source.name} (${source.id})`);
    console.log(`  URL: ${source.url}`);
    console.log(`  Language: ${source.language}`);
    console.log(`  Category: ${source.category}`);
    console.log(`  Type: ${source.sourceType}`);
    console.log(`  Enabled: ${source.enabled ? '✅' : '❌'}`);
    console.log(`  Polling: ${source.pollingInterval}ms`);
    console.log(`  Reliability: ${source.reliability}%`);
    console.log(`  Priority: ${source.priority}`);
    console.log(`  Success Count: ${source.successCount}`);
    console.log(`  Error Count: ${source.errorCount}`);
    if (source.lastFetched) {
      console.log(`  Last Fetched: ${source.lastFetched.toISOString()}`);
    }
    if (source.lastError) {
      console.log(`  Last Error: ${source.lastError}`);
    }
  }
}

async function showEnabledSources(aggregator: NewsAggregator) {
  const sourceManager = aggregator.getSourceManager();
  const sources = await sourceManager.getEnabledSources();
  
  console.log('\n=== Enabled News Sources ===');
  for (const source of sources) {
    console.log(`✅ ${source.name} (${source.language}) - ${source.url}`);
  }
}

async function showSourceHealth(aggregator: NewsAggregator) {
  const sourceManager = aggregator.getSourceManager();
  const sources = await sourceManager.getAllSources();
  
  console.log('\n=== Source Health Status ===');
  
  if (sources.length === 0) {
    console.log('No sources configured');
    return;
  }
  
  for (const source of sources) {
    const isHealthy = source.successCount > source.errorCount;
    const uptime = source.successCount + source.errorCount > 0 
      ? (source.successCount / (source.successCount + source.errorCount)) * 100 
      : 100;
    
    console.log(`\n${source.name}: ${getHealthIcon(isHealthy ? 'healthy' : 'unhealthy')}`);
    console.log(`  Status: ${isHealthy ? 'Healthy' : 'Unhealthy'}`);
    console.log(`  Uptime: ${uptime.toFixed(1)}%`);
    console.log(`  Success: ${source.successCount}`);
    console.log(`  Errors: ${source.errorCount}`);
    console.log(`  Reliability: ${source.reliability}%`);
    if (source.lastFetched) {
      console.log(`  Last Fetched: ${source.lastFetched.toISOString()}`);
    }
    if (source.lastError) {
      console.log(`  Last Error: ${source.lastError}`);
    }
  }
}

async function showAiProviders(aggregator: NewsAggregator) {
  const aiProviderManager = aggregator.getAiProviderManager();
  const providers = await aiProviderManager.getAllProviders();
  
  console.log('\n=== AI Providers ===');
  
  if (providers.length === 0) {
    console.log('No AI providers configured');
    return;
  }
  
  for (const provider of providers) {
    console.log(`\n${provider.displayName} (${provider.name})`);
    console.log(`  Type: ${provider.providerType}`);
    console.log(`  Base URL: ${provider.baseUrl}`);
    console.log(`  Enabled: ${provider.enabled ? '✅' : '❌'}`);
    console.log(`  Priority: ${provider.priority}`);
    console.log(`  Rate Limits: ${provider.maxRequestsPerMinute}/min, ${provider.maxRequestsPerHour}/hr, ${provider.maxRequestsPerDay}/day`);
    console.log(`  Circuit Breaker: ${provider.circuitBreakerThreshold} failures, ${provider.circuitBreakerTimeout}ms timeout`);
    
    // Show keys for this provider
    const keys = await aiProviderManager.getProviderKeys(provider.id);
    console.log(`  API Keys: ${keys.length} configured`);
    for (const key of keys) {
      console.log(`    - ${key.keyName}: ${key.enabled ? '✅' : '❌'} (Success: ${key.successCount}, Errors: ${key.errorCount})`);
    }
  }
}

async function showAiProviderHealth(aggregator: NewsAggregator) {
  const aiProviderManager = aggregator.getAiProviderManager();
  const providers = await aiProviderManager.getEnabledProviders();
  
  console.log('\n=== AI Provider Health Status ===');
  
  if (providers.length === 0) {
    console.log('No enabled AI providers');
    return;
  }
  
  for (const provider of providers) {
    const health = await aiProviderManager.getProviderHealth(provider.id);
    
    console.log(`\n${provider.displayName}: ${getHealthIcon(health.healthy ? 'healthy' : 'unhealthy')}`);
    console.log(`  Status: ${health.healthy ? 'Healthy' : 'Unhealthy'}`);
    console.log(`  Circuit State: ${health.circuitState}`);
    console.log(`  Available Keys: ${health.availableKeys}/${health.totalKeys}`);
    console.log(`  Error Rate: ${health.errorRate.toFixed(1)}%`);
    console.log(`  Last Check: ${health.lastCheck.toISOString()}`);
  }
}

function getHealthIcon(status: string): string {
  switch (status) {
    case 'healthy': return '✅';
    case 'degraded': return '⚠️';
    case 'unhealthy': return '❌';
    default: return '❓';
  }
}

main().catch(console.error);