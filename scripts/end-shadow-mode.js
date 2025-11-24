#!/usr/bin/env node

/**
 * End Shadow Mode Script
 *
 * Ends shadow mode testing, generates comparison report,
 * and optionally deploys candidate version if recommended
 *
 * Usage:
 *   node scripts/end-shadow-mode.js <test-id> [--auto-deploy]
 *
 * Example:
 *   node scripts/end-shadow-mode.js test_1732483200_abc123
 *   node scripts/end-shadow-mode.js test_1732483200_abc123 --auto-deploy
 */

const ABTesting = require('../lib/ab-testing');

async function main() {
  const args = process.argv.slice(2);

  if (args.length < 1) {
    console.error('Usage: node scripts/end-shadow-mode.js <test-id> [--auto-deploy]');
    process.exit(1);
  }

  const testId = args[0];
  const autoDeploy = args.includes('--auto-deploy');

  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('         END SHADOW MODE - Neural Trader A/B Testing');
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('');

  try {
    const abTesting = new ABTesting();
    abTesting.initialize();

    console.log(`[ANALYZE] Ending shadow mode: ${testId}`);
    console.log('');

    const results = await abTesting.endShadowMode(testId);

    console.log('═══════════════════════════════════════════════════════════════════');
    console.log('                    COMPARISON RESULTS');
    console.log('═══════════════════════════════════════════════════════════════════');
    console.log('');

    console.log('PRODUCTION METRICS:');
    console.log('───────────────────────────────────────────────────────────────────');
    console.log(`  Accuracy:          ${results.productionMetrics.accuracyPercent}%`);
    console.log(`  Avg Confidence:    ${results.productionMetrics.confidencePercent}%`);
    console.log(`  Total Predictions: ${results.productionMetrics.totalPredictions}`);
    console.log(`  Correct:           ${results.productionMetrics.correct}`);
    console.log(`  Incorrect:         ${results.productionMetrics.incorrect}`);
    console.log('');

    console.log('CANDIDATE METRICS:');
    console.log('───────────────────────────────────────────────────────────────────');
    console.log(`  Accuracy:          ${results.candidateMetrics.accuracyPercent}%`);
    console.log(`  Avg Confidence:    ${results.candidateMetrics.confidencePercent}%`);
    console.log(`  Total Predictions: ${results.candidateMetrics.totalPredictions}`);
    console.log(`  Correct:           ${results.candidateMetrics.correct}`);
    console.log(`  Incorrect:         ${results.candidateMetrics.incorrect}`);
    console.log('');

    console.log('STATISTICAL COMPARISON:');
    console.log('───────────────────────────────────────────────────────────────────');
    console.log(`  Accuracy Difference:   ${(results.comparison.accuracyDifference * 100).toFixed(2)}%`);
    console.log(`  Percent Improvement:   ${results.comparison.percentImprovement}%`);
    console.log(`  Z-Score:               ${results.comparison.zScore}`);
    console.log(`  P-Value:               ${results.comparison.pValue}`);
    console.log(`  Significant (p<0.05):  ${results.comparison.significantAt05 ? 'YES' : 'NO'}`);
    console.log(`  95% CI Lower:          ${results.comparison.confidenceInterval.lower}%`);
    console.log(`  95% CI Upper:          ${results.comparison.confidenceInterval.upper}%`);
    console.log('');

    console.log('RECOMMENDATION:');
    console.log('───────────────────────────────────────────────────────────────────');
    console.log(`  Decision:    ${results.recommendation.decision}`);
    console.log(`  Confidence:  ${results.recommendation.confidence}`);
    console.log('');
    console.log('  Reasons:');
    results.recommendation.reasons.forEach(reason => {
      console.log(`    - ${reason}`);
    });
    console.log('');

    if (results.recommendation.decision === 'DEPLOY') {
      console.log('✓ Candidate version is significantly better');
      console.log('');

      if (autoDeploy) {
        console.log('[DEPLOY] Auto-deploying candidate version...');
        console.log('');

        const deployment = await abTesting.autoDeploy(testId);

        if (deployment.deployed) {
          console.log('✓ Deployment successful');
          console.log('');
          console.log('Deployment Details:');
          console.log(`  New Production:    ${deployment.versionId}`);
          console.log(`  Previous Version:  ${deployment.previousVersion}`);
          console.log(`  Deployed At:       ${new Date().toISOString()}`);
          console.log('');
        } else {
          console.log('✗ Deployment skipped');
          console.log(`  Reason: ${deployment.reason}`);
          console.log('');
        }
      } else {
        console.log('Manual Deployment Instructions:');
        console.log('');
        console.log('  To deploy candidate version:');
        console.log('    node scripts/end-shadow-mode.js ' + testId + ' --auto-deploy');
        console.log('');
        console.log('  Or manually:');
        console.log('    node scripts/rollback-production.js <candidate-version-id>');
        console.log('');
      }
    } else {
      console.log('✗ Candidate version NOT recommended for deployment');
      console.log('');
      console.log('Next Steps:');
      console.log('  - Investigate why candidate underperformed');
      console.log('  - Adjust training hyperparameters');
      console.log('  - Collect more training data');
      console.log('  - Try different model architecture');
      console.log('');
    }

    console.log('═══════════════════════════════════════════════════════════════════');
    console.log('                    SHADOW MODE ENDED');
    console.log('═══════════════════════════════════════════════════════════════════');
    console.log('');

    process.exit(0);

  } catch (error) {
    console.error('');
    console.error('═══════════════════════════════════════════════════════════════════');
    console.error('ERROR: Failed to end shadow mode');
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
