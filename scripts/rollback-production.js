#!/usr/bin/env node

/**
 * Production Rollback Script
 *
 * Rolls back production to the previous model version
 *
 * Usage:
 *   node scripts/rollback-production.js [version-id]
 *
 * If version-id is not specified, rolls back to the previous version.
 * If version-id is specified, rolls back to that specific version.
 */

const ModelVersioning = require('../lib/model-versioning');

async function main() {
  const args = process.argv.slice(2);
  const targetVersion = args[0];

  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('         PRODUCTION ROLLBACK - Neural Trader');
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('');

  try {
    const versioning = new ModelVersioning();
    versioning.initialize();

    // Get current production version
    const currentProduction = versioning.getProductionVersion();

    if (!currentProduction) {
      console.log('✗ No production version currently set');
      console.log('');
      console.log('Available versions:');
      const versions = versioning.listVersions();
      versions.slice(0, 10).forEach(v => {
        console.log(`  - ${v.versionId} (${v.metadata.timestamp || 'unknown time'})`);
      });
      console.log('');
      process.exit(1);
    }

    console.log('Current Production:');
    console.log(`  Version ID:      ${currentProduction.versionId}`);
    console.log(`  Timestamp:       ${currentProduction.metadata.timestamp || 'unknown'}`);
    console.log(`  Avg Accuracy:    ${currentProduction.metadata.avgAccuracy ? (currentProduction.metadata.avgAccuracy * 100).toFixed(1) + '%' : 'N/A'}`);
    console.log('');

    let result;

    if (targetVersion) {
      // Rollback to specific version
      console.log(`Rolling back to specific version: ${targetVersion}`);
      console.log('');

      const version = versioning.getVersion(targetVersion);
      if (!version) {
        console.log(`✗ Version not found: ${targetVersion}`);
        console.log('');
        console.log('Available versions:');
        const versions = versioning.listVersions();
        versions.slice(0, 10).forEach(v => {
          console.log(`  - ${v.versionId} (${v.metadata.timestamp || 'unknown time'})`);
        });
        console.log('');
        process.exit(1);
      }

      result = versioning.setProduction(targetVersion);

    } else {
      // Rollback to previous version
      console.log('Rolling back to previous version...');
      console.log('');

      result = versioning.rollback();
    }

    console.log('✓ Rollback successful:');
    console.log(`  New Production:  ${result.versionId}`);
    console.log(`  Path:            ${result.path}`);
    console.log('');

    // Show new production details
    const newProduction = versioning.getProductionVersion();
    console.log('Production Details:');
    console.log(`  Version ID:      ${newProduction.versionId}`);
    console.log(`  Timestamp:       ${newProduction.metadata.timestamp || 'unknown'}`);
    console.log(`  Avg Accuracy:    ${newProduction.metadata.avgAccuracy ? (newProduction.metadata.avgAccuracy * 100).toFixed(1) + '%' : 'N/A'}`);
    console.log(`  Git Commit:      ${newProduction.metadata.gitCommit || 'N/A'}`);
    console.log('');

    console.log('═══════════════════════════════════════════════════════════════════');
    console.log('                    ROLLBACK COMPLETE');
    console.log('═══════════════════════════════════════════════════════════════════');
    console.log('');
    console.log('Next Steps:');
    console.log('  - Monitor predictions with new version');
    console.log('  - Check performance: node scripts/track-performance.js summary');
    console.log('  - View version history: node scripts/list-versions.js');
    console.log('');

    process.exit(0);

  } catch (error) {
    console.error('');
    console.error('═══════════════════════════════════════════════════════════════════');
    console.error('ERROR: Rollback failed');
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
