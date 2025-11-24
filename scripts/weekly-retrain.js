#!/usr/bin/env node

/**
 * Weekly Retraining Script
 *
 * Automated weekly workflow:
 * 1. Refresh market data (incremental updates)
 * 2. Retrain all 5 ensemble models
 * 3. Validate new models against baseline
 * 4. Create new model version
 * 5. Deploy to production if validation passes
 * 6. Rollback on failure
 *
 * Usage:
 *   node scripts/weekly-retrain.js [--dry-run] [--force]
 *
 * Options:
 *   --dry-run    Run without deploying to production
 *   --force      Deploy even if validation fails
 *
 * Cron setup (every Sunday at 2 AM):
 *   0 2 * * 0 cd /path/to/my-neural-trader && node scripts/weekly-retrain.js >> logs/weekly-retrain.log 2>&1
 */

const DataRefreshSystem = require('../lib/data-refresh');
const TrainingOrchestrator = require('../lib/training-orchestrator');
const ModelVersioning = require('../lib/model-versioning');
const path = require('path');

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const force = args.includes('--force');

  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('         WEEKLY RETRAINING - Neural Trader Automation');
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('');
  console.log(`Started: ${new Date().toLocaleString()}`);
  console.log(`Mode: ${dryRun ? 'DRY RUN (no deployment)' : 'PRODUCTION'}`);
  console.log(`Force: ${force ? 'YES (ignore validation)' : 'NO'}`);
  console.log('');

  try {
    // ========================================================================
    // STEP 1: REFRESH MARKET DATA
    // ========================================================================
    console.log('═══════════════════════════════════════════════════════════════════');
    console.log('[STEP 1/6] REFRESHING MARKET DATA');
    console.log('═══════════════════════════════════════════════════════════════════');
    console.log('');

    const refreshSystem = new DataRefreshSystem();
    await refreshSystem.initialize();

    const symbols = await refreshSystem.getSymbolList();
    console.log(`Found ${symbols.length} symbols to refresh`);
    console.log('');

    const refreshSummary = await refreshSystem.refreshAll();

    console.log('');
    console.log('Data Refresh Summary:');
    console.log(`  Total Symbols:   ${refreshSummary.totalSymbols}`);
    console.log(`  Successful:      ${refreshSummary.successful}`);
    console.log(`  Failed:          ${refreshSummary.failed}`);
    console.log(`  New Bars Added:  ${refreshSummary.totalNewBars}`);
    console.log('');

    if (refreshSummary.failed > refreshSummary.totalSymbols * 0.1) {
      throw new Error(`Too many data refresh failures: ${refreshSummary.failed}/${refreshSummary.totalSymbols}`);
    }

    // ========================================================================
    // STEP 2: RETRAIN MODELS
    // ========================================================================
    console.log('═══════════════════════════════════════════════════════════════════');
    console.log('[STEP 2/6] RETRAINING ENSEMBLE MODELS');
    console.log('═══════════════════════════════════════════════════════════════════');
    console.log('');

    const orchestrator = new TrainingOrchestrator({
      parallelTraining: false, // Sequential to avoid GPU overload
      minAccuracy: 0.70 // 70% minimum
    });

    orchestrator.initialize();

    const trainingResult = await orchestrator.trainAllModels({
      timeout: 3600000 // 1 hour per model
    });

    console.log('');
    console.log('Training Summary:');
    console.log(`  Successful:      ${trainingResult.summary.successful}/5`);
    console.log(`  Failed:          ${trainingResult.summary.failed}`);
    console.log(`  Avg Accuracy:    ${(trainingResult.summary.avgAccuracy * 100).toFixed(1)}%`);
    console.log(`  Min Accuracy:    ${(trainingResult.summary.minAccuracy * 100).toFixed(1)}%`);
    console.log(`  Max Accuracy:    ${(trainingResult.summary.maxAccuracy * 100).toFixed(1)}%`);
    console.log(`  Total Duration:  ${(trainingResult.totalDuration / 60000).toFixed(1)} minutes`);
    console.log('');

    if (trainingResult.summary.failed > 0) {
      throw new Error(`${trainingResult.summary.failed} models failed to train`);
    }

    // ========================================================================
    // STEP 3: VALIDATE NEW MODELS
    // ========================================================================
    console.log('═══════════════════════════════════════════════════════════════════');
    console.log('[STEP 3/6] VALIDATING NEW MODELS');
    console.log('═══════════════════════════════════════════════════════════════════');
    console.log('');

    const modelPaths = [];
    for (let i = 1; i <= 5; i++) {
      modelPaths.push(path.join(__dirname, '..', 'models', `model-${i}`));
    }

    const validation = await orchestrator.validateModels(
      modelPaths,
      trainingResult.summary
    );

    console.log('Validation Results:');
    console.log(`  Passed:          ${validation.passed ? 'YES' : 'NO'}`);
    console.log(`  Avg Accuracy:    ${(validation.metrics.avgAccuracy * 100).toFixed(1)}%`);
    console.log(`  Issues:          ${validation.issues.length}`);

    if (validation.issues.length > 0) {
      console.log('');
      console.log('Validation Issues:');
      validation.issues.forEach(issue => {
        console.log(`  - ${issue}`);
      });
    }

    console.log('');

    if (!validation.passed && !force) {
      throw new Error('Validation failed. Use --force to deploy anyway.');
    }

    if (!validation.passed && force) {
      console.log('⚠️  WARNING: Validation failed but --force specified. Continuing...');
      console.log('');
    }

    // ========================================================================
    // STEP 4: CREATE MODEL VERSION
    // ========================================================================
    console.log('═══════════════════════════════════════════════════════════════════');
    console.log('[STEP 4/6] CREATING MODEL VERSION');
    console.log('═══════════════════════════════════════════════════════════════════');
    console.log('');

    const versioning = new ModelVersioning();
    versioning.initialize();

    const version = await versioning.saveVersion(modelPaths, {
      trainingDuration: trainingResult.totalDuration,
      avgAccuracy: trainingResult.summary.avgAccuracy,
      minAccuracy: trainingResult.summary.minAccuracy,
      maxAccuracy: trainingResult.summary.maxAccuracy,
      dataRefreshSummary: {
        totalSymbols: refreshSummary.totalSymbols,
        newBars: refreshSummary.totalNewBars
      },
      validationPassed: validation.passed,
      automated: true,
      trainingType: 'weekly-retrain'
    });

    console.log('Version Created:');
    console.log(`  Version ID:      ${version.versionId}`);
    console.log(`  Path:            ${version.path}`);
    console.log(`  Git Commit:      ${version.metadata.gitCommit || 'N/A'}`);
    console.log(`  Git Branch:      ${version.metadata.gitBranch || 'N/A'}`);
    console.log('');

    // Save training summary as performance metrics
    versioning.savePerformanceMetrics(version.versionId, {
      training: trainingResult.summary,
      validation: validation,
      dataRefresh: refreshSummary
    });

    // ========================================================================
    // STEP 5: DEPLOY TO PRODUCTION
    // ========================================================================
    console.log('═══════════════════════════════════════════════════════════════════');
    console.log('[STEP 5/6] DEPLOYING TO PRODUCTION');
    console.log('═══════════════════════════════════════════════════════════════════');
    console.log('');

    if (dryRun) {
      console.log('⚠️  DRY RUN MODE: Skipping production deployment');
      console.log('');
      console.log('Would deploy:');
      console.log(`  Version: ${version.versionId}`);
      console.log(`  Path:    ${version.path}`);
      console.log('');

    } else {
      // Get current production version for rollback reference
      const currentProduction = versioning.getProductionVersion();

      if (currentProduction) {
        console.log('Current Production:');
        console.log(`  Version ID:      ${currentProduction.versionId}`);
        console.log('');
      }

      // Deploy new version
      const deployment = versioning.setProduction(version.versionId);

      console.log('✓ Deployed to production:');
      console.log(`  Version ID:      ${deployment.versionId}`);
      console.log(`  Path:            ${deployment.path}`);
      console.log('');

      if (currentProduction) {
        console.log(`Previous version ${currentProduction.versionId} available for rollback if needed`);
        console.log('');
      }
    }

    // ========================================================================
    // STEP 6: CLEANUP
    // ========================================================================
    console.log('═══════════════════════════════════════════════════════════════════');
    console.log('[STEP 6/6] CLEANUP');
    console.log('═══════════════════════════════════════════════════════════════════');
    console.log('');

    // Clean up old versions (keep last 10)
    const cleanup = versioning.cleanupOldVersions(10);

    console.log('Version Cleanup:');
    console.log(`  Deleted:         ${cleanup.deleted} old versions`);
    console.log(`  Kept:            ${cleanup.kept} recent versions`);
    console.log('');

    // Clean up old training logs (keep last 30 days)
    const logCleanup = orchestrator.cleanupLogs(30);

    console.log('Log Cleanup:');
    console.log(`  Deleted:         ${logCleanup.deleted} old logs`);
    console.log(`  Kept:            ${logCleanup.kept} recent logs`);
    console.log('');

    // ========================================================================
    // COMPLETION
    // ========================================================================
    console.log('═══════════════════════════════════════════════════════════════════');
    console.log('                    WEEKLY RETRAIN COMPLETE');
    console.log('═══════════════════════════════════════════════════════════════════');
    console.log('');
    console.log('Summary:');
    console.log(`  Data Refresh:    ${refreshSummary.totalNewBars} new bars across ${refreshSummary.successful} symbols`);
    console.log(`  Models Trained:  ${trainingResult.summary.successful}/5 successful`);
    console.log(`  Avg Accuracy:    ${(trainingResult.summary.avgAccuracy * 100).toFixed(1)}%`);
    console.log(`  New Version:     ${version.versionId}`);
    console.log(`  Deployed:        ${dryRun ? 'NO (dry run)' : 'YES'}`);
    console.log(`  Total Time:      ${((Date.now() - new Date(refreshSummary.timestamp).getTime()) / 60000).toFixed(1)} minutes`);
    console.log('');
    console.log(`Completed: ${new Date().toLocaleString()}`);
    console.log('');
    console.log('Next Steps:');
    console.log('  - Monitor predictions over the next week');
    console.log('  - Check performance metrics: node scripts/track-performance.js summary');
    console.log('  - Rollback if needed: node scripts/rollback-production.js');
    console.log('');

    process.exit(0);

  } catch (error) {
    console.error('');
    console.error('═══════════════════════════════════════════════════════════════════');
    console.error('ERROR: Weekly retrain failed');
    console.error('═══════════════════════════════════════════════════════════════════');
    console.error('');
    console.error(error.message);
    console.error('');
    console.error(error.stack);
    console.error('');
    console.error('Recovery:');
    console.error('  1. Check logs in ./logs/ directory');
    console.error('  2. Verify data refresh: node scripts/weekly-data-refresh.js');
    console.error('  3. Check production version: ls -la models/production');
    console.error('  4. Rollback if needed: node scripts/rollback-production.js');
    console.error('');
    process.exit(1);
  }
}

// Run
main();
