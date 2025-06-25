#!/usr/bin/env bun

import { startScheduler, runOnce, getStatus } from './scheduler.js';

/**
 * Babel Feed News Aggregation Service
 * 
 * A service that continuously aggregates news from multiple sources,
 * translates content into supported languages, and stores everything
 * in the database for the Babel Feed mobile app.
 */

function printUsage(): void {
  console.log(`
Babel Feed News Aggregator

Usage:
  bun src/index.ts [command]

Commands:
  start     Start the continuous aggregation service (default)
  once      Run aggregation once and exit
  status    Show service configuration
  help      Show this help message

Environment Variables:
  OPENROUTER_API_KEY      OpenRouter API key for translation (required)
  DB_HOST                 Database host (default: localhost)
  DB_PORT                 Database port (default: 5432)
  DB_NAME                 Database name (default: babel_feed)
  DB_USER                 Database username (default: postgres)
  DB_PASSWORD             Database password (default: password)
  AGGREGATION_INTERVAL    Aggregation interval in minutes (default: 30)
  BATCH_SIZE              Batch size for processing (default: 10)
  MAX_ARTICLES_PER_PROVIDER  Max articles per provider (default: 20)

Examples:
  bun src/index.ts start   # Start continuous service
  bun src/index.ts once    # Run once for testing
  bun src/index.ts status  # Show configuration
`);
}

function printBanner(): void {
  console.log(`
╔══════════════════════════════════════════════════════╗
║              Babel Feed News Aggregator              ║
║                                                      ║
║  Aggregating global news with intelligent            ║
║  translation for breaking down language barriers     ║
╚══════════════════════════════════════════════════════╝
`);
}

async function main(): Promise<void> {
  const command = process.argv[2] || 'start';

  printBanner();

  switch (command) {
    case 'start':
      startScheduler();
      break;
      
    case 'once':
      await runOnce();
      process.exit(0);
      break;
      
    case 'status':
      console.log('Service Configuration:');
      console.log(JSON.stringify(getStatus(), null, 2));
      process.exit(0);
      break;
      
    case 'help':
    case '--help':
    case '-h':
      printUsage();
      process.exit(0);
      break;
      
    default:
      console.error(`Unknown command: ${command}`);
      printUsage();
      process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\nReceived SIGINT. Shutting down gracefully...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\nReceived SIGTERM. Shutting down gracefully...');
  process.exit(0);
});

// Start the service
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});