#!/usr/bin/env node

/**
 * Weekly Data Refresh Script
 *
 * Usage:
 *   node scripts/weekly-data-refresh.js
 *
 * Or add to crontab for weekly execution:
 *   0 0 * * 0 cd /path/to/my-neural-trader && node scripts/weekly-data-refresh.js
 */

const DataRefreshSystem = require('../lib/data-refresh');

async function main() {
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('           WEEKLY DATA REFRESH - Neural Trader');
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('');
  console.log(`Started: ${new Date().toLocaleString()}`);
  console.log('');

  try {
    // Initialize data refresh system
    const refreshSystem = new DataRefreshSystem();

    console.log('[1] Initializing Yahoo Finance connection...');
    await refreshSystem.initialize();
    console.log('✓ Connected to Yahoo Finance');
    console.log('');

    // Get list of symbols
    console.log('[2] Loading symbol list...');
    const symbols = await refreshSystem.getSymbolList();
    console.log(`✓ Found ${symbols.length} symbols to refresh`);
    console.log('');

    // Refresh all symbols
    console.log('[3] Refreshing historical data...');
    console.log('─────────────────────────────────────────────────────────────────────');
    const summary = await refreshSystem.refreshAll();
    console.log('─────────────────────────────────────────────────────────────────────');
    console.log('');

    // Print summary
    console.log('[4] Refresh Summary:');
    console.log(`    Total Symbols:   ${summary.totalSymbols}`);
    console.log(`    Successful:      ${summary.successful} (${(summary.successful / summary.totalSymbols * 100).toFixed(1)}%)`);
    console.log(`    Failed:          ${summary.failed}`);
    console.log(`    New Bars Added:  ${summary.totalNewBars}`);
    console.log('');

    if (summary.failed > 0) {
      console.log('Failed Symbols:');
      summary.results
        .filter(r => !r.success)
        .forEach(r => {
          console.log(`  - ${r.symbol}: ${r.errors.join(', ')}`);
        });
      console.log('');
    }

    console.log('═══════════════════════════════════════════════════════════════════');
    console.log(`Completed: ${new Date().toLocaleString()}`);
    console.log('═══════════════════════════════════════════════════════════════════');
    console.log('');

    // Exit with appropriate code
    process.exit(summary.failed > 0 ? 1 : 0);

  } catch (error) {
    console.error('');
    console.error('═══════════════════════════════════════════════════════════════════');
    console.error('ERROR: Data refresh failed');
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
