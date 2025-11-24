#!/usr/bin/env node

/**
 * Production Setup Script
 *
 * Initializes the production environment:
 * 1. Creates initial model version from current ensemble
 * 2. Sets it as production
 * 3. Initializes performance tracking
 * 4. Creates necessary directories
 *
 * Usage:
 *   node scripts/setup-production.js
 */

const ModelVersioning = require('../lib/model-versioning');
const PerformanceTracker = require('../lib/performance-tracker');
const DataRefreshSystem = require('../lib/data-refresh');
const path = require('path');
const fs = require('fs');

async function main() {
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('         PRODUCTION SETUP - Neural Trader');
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('');
  console.log(`Started: ${new Date().toLocaleString()}`);
  console.log('');

  try {
    // ========================================================================
    // STEP 1: VERIFY CURRENT MODELS EXIST
    // ========================================================================
    console.log('[STEP 1/5] Verifying current ensemble models...');
    console.log('');

    const modelPaths = [];
    const modelsDir = path.join(__dirname, '..', 'models');
    let foundModels = 0;

    for (let i = 1; i <= 5; i++) {
      const modelPath = path.join(modelsDir, `model-${i}`);
      const modelJsonPath = path.join(modelPath, 'model.json');

      if (fs.existsSync(modelJsonPath)) {
        console.log(`  ✓ Model ${i} found: ${modelPath}`);
        modelPaths.push(modelPath);
        foundModels++;
      } else {
        console.log(`  ✗ Model ${i} NOT found: ${modelPath}`);
      }
    }

    console.log('');
    console.log(`Found ${foundModels}/5 models`);
    console.log('');

    if (foundModels === 0) {
      throw new Error('No models found. Please train models first.');
    }

    if (foundModels < 5) {
      console.log('⚠️  WARNING: Not all 5 models found. Proceeding with available models.');
      console.log('');
    }

    // ========================================================================
    // STEP 2: INITIALIZE VERSIONING SYSTEM
    // ========================================================================
    console.log('[STEP 2/5] Initializing model versioning...');
    console.log('');

    const versioning = new ModelVersioning();
    versioning.initialize();

    console.log('  ✓ Versions directory created');
    console.log('');

    // ========================================================================
    // STEP 3: CREATE INITIAL VERSION
    // ========================================================================
    console.log('[STEP 3/5] Creating initial production version...');
    console.log('');

    const version = await versioning.saveVersion(modelPaths, {
      description: 'Initial production version',
      numModels: foundModels,
      source: 'manual-setup',
      baselineEnsembleConfidence: 0.594, // 59.4% from Stage 1
      notes: 'Created via setup-production.js'
    });

    console.log('  ✓ Version created:');
    console.log(`    Version ID:      ${version.versionId}`);
    console.log(`    Path:            ${version.path}`);
    console.log(`    Models:          ${foundModels}`);
    console.log(`    Git Commit:      ${version.metadata.gitCommit || 'N/A'}`);
    console.log(`    Git Branch:      ${version.metadata.gitBranch || 'N/A'}`);
    console.log('');

    // ========================================================================
    // STEP 4: SET AS PRODUCTION
    // ========================================================================
    console.log('[STEP 4/5] Setting as production version...');
    console.log('');

    const deployment = versioning.setProduction(version.versionId);

    console.log('  ✓ Production symlink created:');
    console.log(`    Symlink:         ${path.join(modelsDir, 'production')}`);
    console.log(`    Points to:       ${deployment.path}`);
    console.log('');

    // ========================================================================
    // STEP 5: INITIALIZE TRACKING SYSTEMS
    // ========================================================================
    console.log('[STEP 5/5] Initializing tracking systems...');
    console.log('');

    // Initialize performance tracker
    const tracker = new PerformanceTracker();
    tracker.initialize();
    console.log('  ✓ Performance tracking initialized');

    // Initialize data refresh
    const refreshSystem = new DataRefreshSystem();
    refreshSystem.initialize();
    console.log('  ✓ Data refresh system initialized');

    // Create logs directory
    const logsDir = path.join(__dirname, '..', 'logs');
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }
    console.log('  ✓ Logs directory created');

    console.log('');

    // ========================================================================
    // COMPLETION
    // ========================================================================
    console.log('═══════════════════════════════════════════════════════════════════');
    console.log('                    SETUP COMPLETE');
    console.log('═══════════════════════════════════════════════════════════════════');
    console.log('');
    console.log('Production Environment Summary:');
    console.log(`  Production Version:  ${version.versionId}`);
    console.log(`  Models:              ${foundModels}/5`);
    console.log(`  Ensemble Confidence: 59.4% (baseline)`);
    console.log('');
    console.log('Next Steps:');
    console.log('');
    console.log('  1. Test with dry run:');
    console.log('     node scripts/weekly-retrain.js --dry-run');
    console.log('');
    console.log('  2. Check production version:');
    console.log('     node scripts/list-versions.js --production');
    console.log('');
    console.log('  3. Set up cron for weekly retraining:');
    console.log('     0 2 * * 0 cd /path/to/my-neural-trader && node scripts/weekly-retrain.js');
    console.log('');
    console.log('  4. Monitor performance:');
    console.log('     node scripts/track-performance.js summary');
    console.log('');
    console.log(`Completed: ${new Date().toLocaleString()}`);
    console.log('');

    process.exit(0);

  } catch (error) {
    console.error('');
    console.error('═══════════════════════════════════════════════════════════════════');
    console.error('ERROR: Setup failed');
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
