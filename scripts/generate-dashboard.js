#!/usr/bin/env node

/**
 * Monitoring Dashboard Generator
 *
 * Generates an HTML dashboard with:
 * - Performance metrics over time
 * - Model version history
 * - Alert summary
 * - A/B test results
 * - System health indicators
 *
 * Usage:
 *   node scripts/generate-dashboard.js [--output dashboard.html]
 */

const fs = require('fs');
const path = require('path');
const PerformanceTracker = require('../lib/performance-tracker');
const ModelVersioning = require('../lib/model-versioning');
const ABTesting = require('../lib/ab-testing');
const AlertingSystem = require('../lib/alerting');

async function main() {
  const args = process.argv.slice(2);
  const outputIndex = args.indexOf('--output');
  const outputFile = outputIndex >= 0 ? args[outputIndex + 1] : 'dashboard.html';

  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('         GENERATING MONITORING DASHBOARD');
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('');

  try {
    // Initialize systems
    const tracker = new PerformanceTracker();
    const versioning = new ModelVersioning();
    const abTesting = new ABTesting();
    const alerting = new AlertingSystem();

    tracker.initialize();
    versioning.initialize();
    abTesting.initialize();
    alerting.initialize();

    // Gather data
    console.log('[1/5] Gathering performance metrics...');
    const perfMetrics = tracker.getMetrics();
    const degradation = tracker.detectDegradation();

    console.log('[2/5] Gathering version history...');
    const versions = versioning.listVersions();
    const production = versioning.getProductionVersion();

    console.log('[3/5] Gathering A/B test results...');
    const tests = abTesting.getTestHistory(10);

    console.log('[4/5] Gathering alerts...');
    const alerts = alerting.getRecentAlerts(20);
    const alertSummary = alerting.getAlertSummary(7);

    console.log('[5/5] Generating HTML dashboard...');

    const html = generateHTML({
      perfMetrics,
      degradation,
      versions: versions.slice(0, 10),
      production,
      tests,
      alerts: alerts.slice(0, 10),
      alertSummary,
      timestamp: new Date().toISOString()
    });

    const outputPath = path.join(__dirname, '..', outputFile);
    fs.writeFileSync(outputPath, html);

    console.log('');
    console.log(`✓ Dashboard generated: ${outputPath}`);
    console.log('');
    console.log('Open in browser:');
    console.log(`  file://${outputPath}`);
    console.log('');

    process.exit(0);

  } catch (error) {
    console.error('');
    console.error('═══════════════════════════════════════════════════════════════════');
    console.error('ERROR: Failed to generate dashboard');
    console.error('═══════════════════════════════════════════════════════════════════');
    console.error('');
    console.error(error.message);
    console.error('');
    process.exit(1);
  }
}

function generateHTML(data) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Neural Trader - Monitoring Dashboard</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0a0e27; color: #e1e8ed; padding: 20px; }
    .container { max-width: 1400px; margin: 0 auto; }
    h1 { font-size: 32px; margin-bottom: 10px; color: #fff; }
    .timestamp { color: #8899a6; font-size: 14px; margin-bottom: 30px; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; margin-bottom: 30px; }
    .card { background: #15202b; border-radius: 12px; padding: 20px; border: 1px solid #38444d; }
    .card h2 { font-size: 18px; margin-bottom: 15px; color: #fff; }
    .metric { display: flex; justify-content: space-between; align-items: center; padding: 12px 0; border-bottom: 1px solid #38444d; }
    .metric:last-child { border-bottom: none; }
    .metric-label { color: #8899a6; font-size: 14px; }
    .metric-value { font-size: 20px; font-weight: 600; }
    .metric-value.good { color: #17bf63; }
    .metric-value.warning { color: #ffad1f; }
    .metric-value.error { color: #e0245e; }
    .status { display: inline-block; padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: 600; }
    .status.active { background: #17bf63; color: #fff; }
    .status.warning { background: #ffad1f; color: #fff; }
    .status.error { background: #e0245e; color: #fff; }
    .version-list, .alert-list { list-style: none; }
    .version-item, .alert-item { padding: 12px; background: #192734; border-radius: 8px; margin-bottom: 10px; }
    .version-item.production { border-left: 4px solid #17bf63; }
    .alert-item { border-left: 4px solid #8899a6; }
    .alert-item.warning { border-left-color: #ffad1f; }
    .alert-item.error { border-left-color: #e0245e; }
    .alert-item.critical { border-left-color: #e02478; }
    .version-id { font-family: 'Courier New', monospace; color: #1da1f2; }
    small { color: #8899a6; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Neural Trader Monitoring Dashboard</h1>
    <div class="timestamp">Generated: ${new Date(data.timestamp).toLocaleString()}</div>

    <div class="grid">
      <div class="card">
        <h2>Performance Metrics</h2>
        <div class="metric">
          <span class="metric-label">Overall Accuracy</span>
          <span class="metric-value ${data.perfMetrics.accuracy > 0.7 ? 'good' : data.perfMetrics.accuracy > 0.6 ? 'warning' : 'error'}">
            ${(data.perfMetrics.accuracy * 100).toFixed(1)}%
          </span>
        </div>
        <div class="metric">
          <span class="metric-label">Weekly Accuracy</span>
          <span class="metric-value ${data.perfMetrics.weeklyAccuracy > 0.7 ? 'good' : 'warning'}">
            ${(data.perfMetrics.weeklyAccuracy * 100).toFixed(1)}%
          </span>
        </div>
        <div class="metric">
          <span class="metric-label">Avg Confidence</span>
          <span class="metric-value">${(data.perfMetrics.averageConfidence * 100).toFixed(1)}%</span>
        </div>
        <div class="metric">
          <span class="metric-label">Total Predictions</span>
          <span class="metric-value">${data.perfMetrics.totalPredictions}</span>
        </div>
      </div>

      <div class="card">
        <h2>System Health</h2>
        <div class="metric">
          <span class="metric-label">Degradation Status</span>
          <span class="status ${data.degradation.degraded ? 'error' : 'active'}">
            ${data.degradation.degraded ? 'DEGRADED' : 'HEALTHY'}
          </span>
        </div>
        <div class="metric">
          <span class="metric-label">Production Version</span>
          <span class="version-id">${data.production ? data.production.versionId : 'N/A'}</span>
        </div>
        <div class="metric">
          <span class="metric-label">Total Versions</span>
          <span class="metric-value">${data.versions.length}</span>
        </div>
        <div class="metric">
          <span class="metric-label">Active Tests</span>
          <span class="metric-value">${data.tests.filter(t => t.status === 'running').length}</span>
        </div>
      </div>

      <div class="card">
        <h2>Alerts (Last 7 Days)</h2>
        <div class="metric">
          <span class="metric-label">Total Alerts</span>
          <span class="metric-value">${data.alertSummary.totalAlerts}</span>
        </div>
        <div class="metric">
          <span class="metric-label">Critical</span>
          <span class="metric-value error">${data.alertSummary.bySeverity.CRITICAL}</span>
        </div>
        <div class="metric">
          <span class="metric-label">Errors</span>
          <span class="metric-value error">${data.alertSummary.bySeverity.ERROR}</span>
        </div>
        <div class="metric">
          <span class="metric-label">Warnings</span>
          <span class="metric-value warning">${data.alertSummary.bySeverity.WARNING}</span>
        </div>
      </div>
    </div>

    <div class="grid">
      <div class="card">
        <h2>Recent Model Versions</h2>
        <ul class="version-list">
          ${data.versions.map(v => `
            <li class="version-item ${v.versionId === data.production?.versionId ? 'production' : ''}">
              <div><strong class="version-id">${v.versionId}</strong> ${v.versionId === data.production?.versionId ? '<span class="status active">PRODUCTION</span>' : ''}</div>
              <small>${new Date(v.metadata.timestamp).toLocaleString()}</small>
              ${v.metadata.avgAccuracy ? `<br><small>Accuracy: ${(v.metadata.avgAccuracy * 100).toFixed(1)}%</small>` : ''}
            </li>
          `).join('')}
        </ul>
      </div>

      <div class="card">
        <h2>Recent Alerts</h2>
        <ul class="alert-list">
          ${data.alerts.map(a => `
            <li class="alert-item ${a.severity.toLowerCase()}">
              <div><strong>${a.title}</strong></div>
              <small>${new Date(a.timestamp).toLocaleString()}</small>
              <br><small>${a.message}</small>
            </li>
          `).join('')}
        </ul>
      </div>
    </div>

    ${data.tests.length > 0 ? `
    <div class="card">
      <h2>A/B Test History</h2>
      <ul class="version-list">
        ${data.tests.map(t => `
          <li class="version-item">
            <div>
              <strong>${t.candidateVersion}</strong> vs <strong>${t.productionVersion}</strong>
              <span class="status ${t.status === 'running' ? 'warning' : 'active'}">${t.status.toUpperCase()}</span>
            </div>
            <small>Started: ${new Date(t.startDate).toLocaleString()}</small>
            ${t.results ? `<br><small>Result: ${t.results.recommendation.decision} (${t.results.recommendation.improvementPercent}% improvement)</small>` : ''}
          </li>
        `).join('')}
      </ul>
    </div>
    ` : ''}

  </div>
</body>
</html>`;
}

// Run
main();
