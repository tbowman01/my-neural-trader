#!/usr/bin/env node

/**
 * Shadow Mode Execution Script
 *
 * Runs new model versions in shadow mode alongside production
 * for safe A/B testing without affecting live decisions
 *
 * Usage:
 *   node scripts/run-shadow-mode.js <new-version-id> [duration-days]
 *
 * Example:
 *   node scripts/run-shadow-mode.js v20251201_0200 7
 */

const ABTesting = require('../lib/ab-testing');

async function main() {
  const args = process.argv.slice(2);

  if (args.length < 1) {
    console.error('Usage: node scripts/run-shadow-mode.js <new-version-id> [duration-days]');
    process.exit(1);
  }

  const newVersionId = args[0];
  const duration = args[1] ? parseInt(args[1]) : 7;

  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('         SHADOW MODE - Neural Trader A/B Testing');
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('');

  try {
    const abTesting = new ABTesting();
    abTesting.initialize();

    console.log(`[START] Starting shadow mode for: ${newVersionId}`);
    console.log(`Duration: ${duration} days`);
    console.log('');

    const shadowConfig = await abTesting.startShadowMode(newVersionId, duration);

    console.log('✓ Shadow mode started successfully');
    console.log('');
    console.log('Test Configuration:');
    console.log(`  Test ID:           ${shadowConfig.testId}`);
    console.log(`  Production:        ${shadowConfig.productionVersion}`);
    console.log(`  Candidate:         ${shadowConfig.candidateVersion}`);
    console.log(`  Start Date:        ${shadowConfig.startDate}`);
    console.log(`  End Date:          ${shadowConfig.endDate}`);
    console.log(`  Duration:          ${shadowConfig.duration} days`);
    console.log('');
    console.log('Shadow Mode Instructions:');
    console.log('');
    console.log('1. Both model versions will generate predictions');
    console.log('2. Production models control live decisions');
    console.log('3. Candidate models run in shadow (no live impact)');
    console.log('4. All predictions are logged for comparison');
    console.log('');
    console.log(`5. After ${duration} days, end shadow mode:`);
    console.log(`   node scripts/end-shadow-mode.js ${shadowConfig.testId}`);
    console.log('');
    console.log('═══════════════════════════════════════════════════════════════════');
    console.log('                    SHADOW MODE ACTIVE');
    console.log('═══════════════════════════════════════════════════════════════════');
    console.log('');

    process.exit(0);

  } catch (error) {
    console.error('');
    console.error('═══════════════════════════════════════════════════════════════════');
    console.error('ERROR: Failed to start shadow mode');
    console.error('═══════════════════════════════════════════════════════════════════');
    console.error('');
    console.error(error.message);
    console.error('');
    console.error(error.stack);
    console.error('');
    process.exit(1);
  }
}

// Run
main();
