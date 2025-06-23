import cron from 'node-cron';
import { runAggregation, validateProviders } from './aggregator.js';
import { validateTranslationConfig } from './translator.js';
import { AGGREGATION_CONFIG } from './config.js';

/**
 * Scheduler for automated news aggregation
 */

let isRunning = false;

/**
 * Run aggregation with error handling and duplicate prevention
 */
async function safeRunAggregation(): Promise<void> {
  if (isRunning) {
    console.log('Aggregation already running, skipping this cycle');
    return;
  }

  isRunning = true;
  try {
    await runAggregation();
  } catch (error) {
    console.error('Error during aggregation:', error);
  } finally {
    isRunning = false;
  }
}

/**
 * Start the scheduled aggregation service
 */
export function startScheduler(): void {
  console.log('Validating configuration...');
  
  if (!validateProviders()) {
    console.error('Provider validation failed. Exiting.');
    process.exit(1);
  }

  if (!validateTranslationConfig()) {
    console.error('Translation configuration validation failed. Exiting.');
    process.exit(1);
  }

  const cronExpression = `*/${AGGREGATION_CONFIG.intervalMinutes} * * * *`;
  console.log(`Starting scheduler with interval: every ${AGGREGATION_CONFIG.intervalMinutes} minutes`);
  console.log(`Cron expression: ${cronExpression}`);

  // Schedule recurring aggregation
  cron.schedule(cronExpression, async () => {
    console.log(`\n[${new Date().toISOString()}] Running scheduled aggregation...`);
    await safeRunAggregation();
  });

  // Run initial aggregation
  console.log('Running initial aggregation...');
  safeRunAggregation();

  console.log('News aggregation scheduler started successfully!');
  console.log('Press Ctrl+C to stop the service');
}

/**
 * Run one-time aggregation (for testing)
 */
export async function runOnce(): Promise<void> {
  console.log('Running one-time aggregation...');
  
  if (!validateProviders()) {
    console.error('Provider validation failed. Exiting.');
    process.exit(1);
  }

  if (!validateTranslationConfig()) {
    console.error('Translation configuration validation failed. Exiting.');
    process.exit(1);
  }

  await safeRunAggregation();
  console.log('One-time aggregation completed');
}

/**
 * Get status information
 */
export function getStatus(): object {
  return {
    isRunning,
    interval: AGGREGATION_CONFIG.intervalMinutes,
    batchSize: AGGREGATION_CONFIG.batchSize,
    maxArticlesPerProvider: AGGREGATION_CONFIG.maxArticlesPerProvider,
    enabledProviders: require('./config.js').NEWS_PROVIDERS.filter((p: any) => p.enabled).length,
    supportedLanguages: require('./config.js').SUPPORTED_LANGUAGES
  };
}