#!/usr/bin/env node

/**
 * Performance Tracking Script
 *
 * Usage:
 *   node scripts/track-performance.js [command]
 *
 * Commands:
 *   summary     - Show performance summary
 *   degradation - Check for model degradation
 *   export      - Export predictions to CSV
 *   cleanup     - Clean old predictions
 */

const PerformanceTracker = require('../lib/performance-tracker');

async function showSummary() {
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('           PERFORMANCE SUMMARY - Neural Trader');
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('');

  const tracker = new PerformanceTracker();
  tracker.initialize();

  const summary = tracker.getSummary();

  if (!summary) {
    console.log('No performance data available yet.');
    console.log('');
    console.log('To start tracking:');
    console.log('1. Run predictions with the ensemble predictor');
    console.log('2. Log predictions using tracker.logPrediction()');
    console.log('3. Resolve predictions after 7 days using tracker.resolvePrediction()');
    console.log('');
    return;
  }

  console.log('Overall Statistics:');
  console.log(`  Total Predictions:    ${summary.totalPredictions}`);
  console.log(`  Resolved:             ${summary.resolved}`);
  console.log(`  Unresolved:           ${summary.unresolved}`);
  console.log('');

  console.log('Accuracy Metrics:');
  console.log(`  Overall Accuracy:     ${summary.overallAccuracy}`);
  console.log(`  Weekly Accuracy:      ${summary.weeklyAccuracy}`);
  console.log(`  Monthly Accuracy:     ${summary.monthlyAccuracy}`);
  console.log('');

  console.log(`Last Updated: ${new Date(summary.lastUpdated).toLocaleString()}`);
  console.log('');

  // Show recent predictions
  console.log('Recent Predictions (Last 10):');
  console.log('─────────────────────────────────────────────────────────────────────');
  const recent = tracker.getRecentPredictions(10);

  if (recent.length === 0) {
    console.log('No predictions yet.');
  } else {
    recent.forEach(p => {
      const status = p.resolved ? `✓ ${p.outcome}` : '⏳ pending';
      const conf = (p.confidence * 100).toFixed(1);
      const date = new Date(p.timestamp).toLocaleDateString();
      console.log(`  ${date} | ${p.symbol.padEnd(6)} | ${p.prediction.padEnd(8)} | ${conf}% | ${status}`);
    });
  }
  console.log('');
}

async function checkDegradation() {
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('           DEGRADATION CHECK - Neural Trader');
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('');

  const tracker = new PerformanceTracker();
  tracker.initialize();

  const check = tracker.detectDegradation(0.05); // 5% threshold

  if (check.degraded) {
    console.log('⚠️  MODEL DEGRADATION DETECTED');
    console.log('');
    console.log(`Severity:          ${check.severity.toUpperCase()}`);
    console.log(`Overall Accuracy:  ${check.overallAccuracy}`);
    console.log(`Weekly Accuracy:   ${check.weeklyAccuracy}`);
    console.log(`Performance Drop:  ${check.drop}`);
    console.log('');
    console.log('Recommendation:');
    console.log(`  ${check.recommendation}`);
    console.log('');
    process.exit(1);
  } else {
    console.log('✓ No degradation detected');
    console.log('');
    if (check.overallAccuracy) {
      console.log(`Overall Accuracy:  ${check.overallAccuracy}`);
      console.log(`Weekly Accuracy:   ${check.weeklyAccuracy}`);
    } else {
      console.log(check.reason);
    }
    console.log('');
    process.exit(0);
  }
}

async function exportData() {
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('           EXPORT PREDICTIONS - Neural Trader');
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('');

  const tracker = new PerformanceTracker();
  tracker.initialize();

  const outputPath = 'data/predictions-export.csv';
  const result = tracker.exportToCSV(outputPath);

  if (result.success) {
    console.log(`✓ Exported ${result.rows} predictions to ${result.path}`);
    console.log('');
  } else {
    console.log('✗ Export failed');
    console.log('');
  }
}

async function cleanup() {
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('           CLEANUP OLD PREDICTIONS - Neural Trader');
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('');

  const tracker = new PerformanceTracker();
  tracker.initialize();

  const result = tracker.cleanOldPredictions(5000);

  console.log(`Deleted:  ${result.deleted} old predictions`);
  console.log(`Kept:     ${result.kept} recent predictions`);
  console.log('');
}

// Main
async function main() {
  const command = process.argv[2] || 'summary';

  try {
    switch (command) {
      case 'summary':
        await showSummary();
        break;
      case 'degradation':
        await checkDegradation();
        break;
      case 'export':
        await exportData();
        break;
      case 'cleanup':
        await cleanup();
        break;
      default:
        console.log('Unknown command:', command);
        console.log('');
        console.log('Available commands:');
        console.log('  summary     - Show performance summary');
        console.log('  degradation - Check for model degradation');
        console.log('  export      - Export predictions to CSV');
        console.log('  cleanup     - Clean old predictions');
        console.log('');
        process.exit(1);
    }
  } catch (error) {
    console.error('');
    console.error('═══════════════════════════════════════════════════════════════════');
    console.error('ERROR: Performance tracking failed');
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
