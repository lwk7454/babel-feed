#!/usr/bin/env bun
import { logger } from '../modules/common/logger';
import { ensureDbConnection } from '../modules/common/db';
import { NewsAggregatorService } from '../services/news-aggregator-service';

const COMMANDS = {
  'status': 'Show aggregator status',
  'sources': 'List all configured sources',
  'sources:enabled': 'List enabled sources',
  'sources:health': 'Show source health status',
  'ai-providers': 'List all AI providers',
  'ai-providers:health': 'Show AI provider health status',
  'add-source': 'Add a new news source',
  'remove-source': 'Remove a source by ID',
  'discover-sources': 'Run source discovery',
  'health-check': 'Check system health',
  'help': 'Show this help message',
};

export class NewsAggregatorCLI {
  private service?: NewsAggregatorService;

  async initialize(): Promise<void> {
    await ensureDbConnection();
    this.service = new NewsAggregatorService();
    await this.service.initialize();
  }

  async run(args: string[]): Promise<void> {
    if (args.length === 0 || args[0] === 'help') {
      this.showHelp();
      return;
    }

    const command = args[0];
    const commandArgs = args.slice(1);

    try {
      await this.initialize();

      switch (command) {
        case 'status':
          await this.showStatus(commandArgs);
          break;
        case 'sources':
          await this.listSources(commandArgs);
          break;
        case 'sources:enabled':
          await this.showEnabledSources(commandArgs);
          break;
        case 'sources:health':
          await this.showSourceHealth(commandArgs);
          break;
        case 'ai-providers':
          await this.showAiProviders(commandArgs);
          break;
        case 'ai-providers:health':
          await this.showAiProviderHealth(commandArgs);
          break;
        case 'add-source':
          await this.addSource(commandArgs);
          break;
        case 'remove-source':
          await this.removeSource(commandArgs);
          break;
        case 'discover-sources':
          await this.discoverSources(commandArgs);
          break;
        case 'health-check':
          await this.healthCheck(commandArgs);
          break;
        case 'help':
          this.showHelp();
          break;
        default:
          console.log(`Unknown command: ${command}`);
          this.showHelp();
          process.exit(1);
      }
    } catch (error) {
      logger.error('CLI command failed:', error);
      process.exit(1);
    }
  }

  private showHelp(): void {
    console.log('\nNews Aggregator CLI');
    console.log('Usage: bun run cli <command> [options]');
    console.log('\nCommands:');
    for (const [cmd, description] of Object.entries(COMMANDS)) {
      console.log(`  ${cmd.padEnd(20)} ${description}`);
    }
    console.log('\nExamples:');
    console.log('  bun run cli status');
    console.log('  bun run cli sources');
    console.log('  bun run cli health-check');
    console.log('  bun run cli add-source https://example.com/rss');
  }

  private async showStatus(_args: string[]): Promise<void> {
    if (!this.service) throw new Error('Service not initialized');
    
    const status = await this.service.getStatus();
    
    console.log('\n=== News Aggregator Status ===');
    console.log(`Running: ${status.running ? '✅' : '❌'}`);
    
    if (status.modules) {
      console.log('\n=== Module Status ===');
      for (const [name, moduleStatus] of Object.entries(status.modules)) {
        const icon = moduleStatus.running ? '✅' : '❌';
        console.log(`${name}: ${icon} ${moduleStatus.running ? 'Running' : 'Stopped'}`);
      }
    }
  }

  private async listSources(_args: string[]): Promise<void> {
    if (!this.service) throw new Error('Service not initialized');
    
    try {
      // Use legacy method for now since database CRUD is not implemented
      const sourceManager = this.service.getSourceManager();
      const sources = await sourceManager.getAllSources();
      
      console.log('\n=== All News Sources ===');
      if (sources.length === 0) {
        console.log('No sources configured');
        return;
      }
      
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
    } catch (error) {
      console.log('Error listing sources:', error);
    }
  }

  private async showEnabledSources(_args: string[]): Promise<void> {
    if (!this.service) throw new Error('Service not initialized');
    
    try {
      const sourceManager = this.service.getSourceManager();
      const sources = await sourceManager.getEnabledSources();
      
      console.log('\n=== Enabled News Sources ===');
      if (sources.length === 0) {
        console.log('No enabled sources');
        return;
      }
      
      for (const source of sources) {
        console.log(`✅ ${source.name} (${source.language}) - ${source.url}`);
      }
    } catch (error) {
      console.log('Error listing enabled sources:', error);
    }
  }

  private async showSourceHealth(_args: string[]): Promise<void> {
    if (!this.service) throw new Error('Service not initialized');
    
    try {
      const healthChecker = this.service.getHealthChecker();
      const health = await healthChecker.getHealthStatus();
      
      console.log('\n=== Source Health Status ===');
      console.log(`Overall Status: ${this.getHealthIcon(health.status)} ${health.status}`);
      console.log(`Total Sources: ${health.summary.totalSources}`);
      console.log(`Healthy Sources: ${health.summary.healthySources}`);
      console.log(`Unhealthy Sources: ${health.summary.unhealthySources}`);
      console.log(`Uptime: ${Math.round(health.uptime / 1000)}s`);
    } catch (error) {
      console.log('Error getting source health:', error);
    }
  }

  private async showAiProviders(_args: string[]): Promise<void> {
    if (!this.service) throw new Error('Service not initialized');
    
    try {
      const aiProviderManager = this.service.getAiProviderManager();
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
      }
    } catch (error) {
      console.log('Error listing AI providers:', error);
    }
  }

  private async showAiProviderHealth(_args: string[]): Promise<void> {
    if (!this.service) throw new Error('Service not initialized');
    
    try {
      const aiProviderManager = this.service.getAiProviderManager();
      const providers = await aiProviderManager.getEnabledProviders();
      
      console.log('\n=== AI Provider Health Status ===');
      if (providers.length === 0) {
        console.log('No enabled AI providers');
        return;
      }
      
      for (const provider of providers) {
        const health = await aiProviderManager.getProviderHealth(provider.id);
        console.log(`\n${provider.displayName}: ${this.getHealthIcon(health.healthy ? 'healthy' : 'unhealthy')}`);
        console.log(`  Status: ${health.healthy ? 'Healthy' : 'Unhealthy'}`);
        console.log(`  Circuit State: ${health.circuitState}`);
        console.log(`  Available Keys: ${health.availableKeys}/${health.totalKeys}`);
        console.log(`  Error Rate: ${health.errorRate.toFixed(1)}%`);
        console.log(`  Last Check: ${health.lastCheck.toISOString()}`);
      }
    } catch (error) {
      console.log('Error getting AI provider health:', error);
    }
  }

  private async addSource(args: string[]): Promise<void> {
    // TODO: Implement when database CRUD is ready
    console.log('Adding source (not implemented yet - needs database CRUD):', args);
  }

  private async removeSource(args: string[]): Promise<void> {
    // TODO: Implement when database CRUD is ready
    console.log('Removing source (not implemented yet - needs database CRUD):', args);
  }

  private async discoverSources(_args: string[]): Promise<void> {
    if (!this.service) throw new Error('Service not initialized');
    
    try {
      const discovery = this.service.getSourceDiscovery();
      const status = discovery.getStatus();
      
      if (status.running) {
        console.log('Source discovery is already running');
      } else {
        console.log('Starting source discovery...');
        await discovery.startDiscovery();
        console.log('Source discovery started');
      }
    } catch (error) {
      console.log('Error with source discovery:', error);
    }
  }

  private async healthCheck(_args: string[]): Promise<void> {
    if (!this.service) throw new Error('Service not initialized');
    
    try {
      const healthMonitor = this.service.getHealthMonitor();
      const health = await healthMonitor.getHealthStatus();
      
      console.log('\n=== System Health Check ===');
      console.log(`Overall Status: ${this.getHealthIcon(health.status)} ${health.status}`);
      console.log(`Uptime: ${Math.round(health.uptime / 1000)}s`);
      
      console.log('\n=== Services Status ===');
      for (const service of health.services || []) {
        console.log(`${service.name}: ${this.getHealthIcon(service.status)} ${service.status}`);
        if (service.responseTime) {
          console.log(`  Response Time: ${service.responseTime}ms`);
        }
      }
    } catch (error) {
      console.log('Error during health check:', error);
    }
  }

  private getHealthIcon(status: string): string {
    switch (status) {
      case 'healthy': return '✅';
      case 'degraded': return '⚠️';
      case 'unhealthy': return '❌';
      default: return '❓';
    }
  }
}

// CLI entry point
if (import.meta.main) {
  const cli = new NewsAggregatorCLI();
  const args = process.argv.slice(2);
  
  cli.run(args).catch((error) => {
    logger.error('CLI error:', error);
    process.exit(1);
  });
}