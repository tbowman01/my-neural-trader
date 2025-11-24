#!/usr/bin/env node

/**
 * List Model Versions Script
 *
 * Lists all model versions with metadata and performance metrics
 *
 * Usage:
 *   node scripts/list-versions.js [--limit N] [--production]
 *
 * Options:
 *   --limit N      Show only N most recent versions (default: 10)
 *   --production   Show only production version details
 */

const ModelVersioning = require('../lib/model-versioning');

async function main() {
  const args = process.argv.slice(2);
  const showProduction = args.includes('--production');
  const limitIndex = args.indexOf('--limit');
  const limit = limitIndex >= 0 ? parseInt(args[limitIndex + 1]) || 10 : 10;

  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('         MODEL VERSIONS - Neural Trader');
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('');

  try {
    const versioning = new ModelVersioning();
    versioning.initialize();

    if (showProduction) {
      // Show production version only
      const production = versioning.getProductionVersion();

      if (!production) {
        console.log('No production version set');
        console.log('');
        process.exit(0);
      }

      console.log('PRODUCTION VERSION:');
      console.log('─────────────────────────────────────────────────────────────────────');
      console.log(`  Version ID:      ${production.versionId}`);
      console.log(`  Path:            ${production.path}`);
      console.log(`  Timestamp:       ${production.metadata.timestamp || 'unknown'}`);
      console.log(`  Git Commit:      ${production.metadata.gitCommit || 'N/A'}`);
      console.log(`  Git Branch:      ${production.metadata.gitBranch || 'N/A'}`);
      console.log(`  Num Models:      ${production.metadata.numModels || 'N/A'}`);

      if (production.metadata.avgAccuracy) {
        console.log(`  Avg Accuracy:    ${(production.metadata.avgAccuracy * 100).toFixed(1)}%`);
      }

      if (production.metadata.minAccuracy) {
        console.log(`  Min Accuracy:    ${(production.metadata.minAccuracy * 100).toFixed(1)}%`);
      }

      if (production.metadata.maxAccuracy) {
        console.log(`  Max Accuracy:    ${(production.metadata.maxAccuracy * 100).toFixed(1)}%`);
      }

      console.log('');

      // Show performance metrics if available
      const perf = versioning.getPerformanceMetrics(production.versionId);
      if (perf) {
        console.log('PERFORMANCE METRICS:');
        console.log('─────────────────────────────────────────────────────────────────────');

        if (perf.training) {
          console.log(`  Training Time:   ${(perf.training.totalDuration / 60000).toFixed(1)} minutes`);
          console.log(`  Models Trained:  ${perf.training.successful}/${perf.training.successful + perf.training.failed}`);
        }

        if (perf.dataRefresh) {
          console.log(`  Data Refreshed:  ${perf.dataRefresh.totalSymbols} symbols`);
          console.log(`  New Bars Added:  ${perf.dataRefresh.totalNewBars}`);
        }

        if (perf.validation) {
          console.log(`  Validation:      ${perf.validation.passed ? 'PASSED' : 'FAILED'}`);
        }

        console.log('');
      }

    } else {
      // Show all versions
      const versions = versioning.listVersions();
      const production = versioning.getProductionVersion();
      const productionId = production ? production.versionId : null;

      if (versions.length === 0) {
        console.log('No versions found');
        console.log('');
        process.exit(0);
      }

      console.log(`Showing ${Math.min(limit, versions.length)} of ${versions.length} versions:`);
      console.log('');

      const toShow = versions.slice(0, limit);

      toShow.forEach((version, index) => {
        const isProd = version.versionId === productionId;
        const marker = isProd ? ' [PRODUCTION]' : '';

        console.log(`${index + 1}. ${version.versionId}${marker}`);
        console.log(`   Timestamp:    ${version.metadata.timestamp || 'unknown'}`);

        if (version.metadata.avgAccuracy) {
          console.log(`   Avg Accuracy: ${(version.metadata.avgAccuracy * 100).toFixed(1)}%`);
        }

        if (version.metadata.gitCommit) {
          console.log(`   Git Commit:   ${version.metadata.gitCommit}`);
        }

        if (version.metadata.automated) {
          console.log(`   Type:         Automated (${version.metadata.trainingType || 'unknown'})`);
        }

        console.log('');
      });

      if (versions.length > limit) {
        console.log(`... and ${versions.length - limit} more versions`);
        console.log(`Use --limit ${versions.length} to see all versions`);
        console.log('');
      }
    }

    console.log('═══════════════════════════════════════════════════════════════════');
    console.log('');

    process.exit(0);

  } catch (error) {
    console.error('');
    console.error('═══════════════════════════════════════════════════════════════════');
    console.error('ERROR: Failed to list versions');
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
