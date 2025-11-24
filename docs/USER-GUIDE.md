# Neural Trader User Guide
## Stage 2: Adaptation Infrastructure

**Complete Guide to A/B Testing, Monitoring, and Automated Model Management**

---

## Table of Contents

1. [Overview](#overview)
2. [Getting Started](#getting-started)
3. [A/B Testing](#ab-testing)
4. [Shadow Mode](#shadow-mode)
5. [Monitoring Dashboard](#monitoring-dashboard)
6. [Alerting System](#alerting-system)
7. [Weekly Workflow](#weekly-workflow)
8. [Best Practices](#best-practices)
9. [Troubleshooting](#troubleshooting)
10. [Configuration Reference](#configuration-reference)

---

## Overview

Stage 2 provides a complete adaptation infrastructure for managing neural trading models in production. It includes:

- **Automated Data Refresh**: Weekly updates from Yahoo Finance
- **Model Versioning**: Complete history with rollback capability
- **Performance Tracking**: Continuous accuracy monitoring
- **Auto-Retraining**: Scheduled weekly model updates
- **A/B Testing**: Statistical validation of new models
- **Shadow Mode**: Risk-free parallel testing
- **Monitoring Dashboard**: Real-time system visibility
- **Alerting System**: Multi-channel notifications

---

## Getting Started

### Prerequisites

Ensure you have completed Stage 2 Phases 1-2:

```bash
# Check if required libraries exist
ls lib/model-versioning.js
ls lib/performance-tracker.js
ls lib/ab-testing.js
ls lib/alerting.js

# Check if data directory exists
ls data/
```

### Initialize Systems

```javascript
const ModelVersioning = require('./lib/model-versioning');
const PerformanceTracker = require('./lib/performance-tracker');
const ABTesting = require('./lib/ab-testing');
const AlertingSystem = require('./lib/alerting');

// Initialize all systems
const versioning = new ModelVersioning();
const tracker = new PerformanceTracker();
const abTesting = new ABTesting();
const alerting = new AlertingSystem();

versioning.initialize();
tracker.initialize();
abTesting.initialize();
alerting.initialize();
```

---

## A/B Testing

### What is A/B Testing?

A/B testing validates new model versions by comparing them statistically against production models before deployment. This prevents deploying worse models that could lose money.

### How It Works

1. **Production Model** - Current live model making real predictions
2. **Candidate Model** - New model being tested
3. **Shadow Mode** - Both models predict in parallel for 7 days
4. **Statistical Comparison** - Accuracy compared using t-tests
5. **Automated Decision** - Deploy only if significantly better

### Statistical Validation

The system uses rigorous statistical tests:

- **Z-Score**: Measures difference magnitude
- **P-Value**: Tests statistical significance (p < 0.05)
- **Confidence Intervals**: 95% CI for accuracy difference
- **Minimum Improvement**: 1% accuracy threshold

### Starting an A/B Test

```bash
# After training new models, start shadow mode
node scripts/run-shadow-mode.js v20251201_0200 7
```

Output:
```
═══════════════════════════════════════════════════════════════════
         SHADOW MODE - Neural Trader A/B Testing
═══════════════════════════════════════════════════════════════════

✓ Shadow mode started successfully

Test Configuration:
  Test ID:           test_1732483200_abc123
  Production:        v20251124_1500
  Candidate:         v20251201_0200
  Start Date:        2025-12-01T02:00:00.000Z
  End Date:          2025-12-08T02:00:00.000Z
  Duration:          7 days
```

### What Happens During Shadow Mode

1. **Parallel Predictions**: Both models generate predictions for all symbols
2. **Production Controls**: Only production predictions affect live decisions
3. **Candidate Shadows**: Candidate predictions logged but not used
4. **Automatic Logging**: All predictions stored for later comparison
5. **No Risk**: Candidate models cannot affect real trading

### Ending Shadow Mode

After 7 days, evaluate the test:

```bash
# Get comparison report
node scripts/end-shadow-mode.js test_1732483200_abc123
```

Output:
```
═══════════════════════════════════════════════════════════════════
                    COMPARISON RESULTS
═══════════════════════════════════════════════════════════════════

PRODUCTION METRICS:
───────────────────────────────────────────────────────────────────
  Accuracy:          70.2%
  Avg Confidence:    68.5%
  Total Predictions: 245
  Correct:           172
  Incorrect:         73

CANDIDATE METRICS:
───────────────────────────────────────────────────────────────────
  Accuracy:          75.1%
  Avg Confidence:    71.3%
  Total Predictions: 245
  Correct:           184
  Incorrect:         61

STATISTICAL COMPARISON:
───────────────────────────────────────────────────────────────────
  Accuracy Difference:   4.90%
  Percent Improvement:   7.0%
  Z-Score:               2.34
  P-Value:               0.019
  Significant (p<0.05):  YES
  95% CI Lower:          0.8%
  95% CI Upper:          9.0%

RECOMMENDATION:
───────────────────────────────────────────────────────────────────
  Decision:    DEPLOY
  Confidence:  HIGH

  Reasons:
    - Statistically significant improvement (p=0.019 < 0.05)
    - Improvement of 7.0% exceeds minimum threshold of 1.0%
    - Candidate accuracy (75.1%) > Production accuracy (70.2%)
```

### Auto-Deploy on Success

If the candidate is significantly better, deploy automatically:

```bash
node scripts/end-shadow-mode.js test_1732483200_abc123 --auto-deploy
```

Output:
```
✓ Candidate version is significantly better

[DEPLOY] Auto-deploying candidate version...

✓ Deployment successful

Deployment Details:
  New Production:    v20251201_0200
  Previous Version:  v20251124_1500
  Deployed At:       2025-12-08T02:15:00.000Z
```

### Understanding Recommendations

**DEPLOY (Success)**
- P-value < 0.05 (statistically significant)
- Improvement ≥ 1% (meets minimum threshold)
- Candidate accuracy > Production accuracy

**REJECT (Failure)**
- Not statistically significant (p ≥ 0.05)
- Improvement < 1% (below threshold)
- Candidate performs worse than production

---

## Shadow Mode

### What is Shadow Mode?

Shadow mode runs new models alongside production without affecting live decisions. It's like a "practice run" in production.

### Benefits

1. **Zero Risk**: Candidate models can't affect real trading
2. **Real Conditions**: Tests in actual production environment
3. **Parallel Comparison**: Direct head-to-head accuracy comparison
4. **Statistical Rigor**: Proper significance testing
5. **Automated Deployment**: Deploy only if statistically proven better

### Duration

Default: 7 days

Why 7 days?
- Includes all weekdays (Monday-Friday trading)
- Covers different market conditions
- Provides ~245 predictions per model (35 symbols × 7 days)
- Enough data for statistical significance

Custom duration:
```bash
# Run for 14 days instead
node scripts/run-shadow-mode.js v20251201_0200 14
```

### Logging Predictions

During shadow mode, both models generate predictions:

```javascript
// This happens automatically in your prediction code
const abTesting = new ABTesting();

// Log production prediction
abTesting.logShadowPrediction(testId, 'production', {
  symbol: 'AAPL',
  prediction: 0.65,
  confidence: 0.72,
  timestamp: new Date().toISOString()
});

// Log candidate prediction
abTesting.logShadowPrediction(testId, 'candidate', {
  symbol: 'AAPL',
  prediction: 0.68,
  confidence: 0.75,
  timestamp: new Date().toISOString()
});
```

### Resolving Predictions

After each trading day, resolve predictions with actual outcomes:

```javascript
// Get actual price movement
const actualPrice = 155.25;
const actualOutcome = actualPrice > previousPrice ? 1 : 0;

// Resolve both predictions
abTesting.resolveShadowPredictions('AAPL', actualPrice, actualOutcome);
```

The system automatically determines which model was correct.

---

## Monitoring Dashboard

### Overview

The monitoring dashboard provides real-time visibility into system health, performance metrics, model versions, alerts, and A/B test results.

### Generating the Dashboard

```bash
node scripts/generate-dashboard.js
```

Or specify output location:
```bash
node scripts/generate-dashboard.js --output /path/to/dashboard.html
```

Output:
```
═══════════════════════════════════════════════════════════════════
         GENERATING MONITORING DASHBOARD
═══════════════════════════════════════════════════════════════════

[1/5] Gathering performance metrics...
[2/5] Gathering version history...
[3/5] Gathering A/B test results...
[4/5] Gathering alerts...
[5/5] Generating HTML dashboard...

✓ Dashboard generated: /path/to/dashboard.html

Open in browser:
  file:///path/to/dashboard.html
```

### Dashboard Sections

#### 1. Performance Metrics

- **Overall Accuracy**: Lifetime prediction accuracy
- **Weekly Accuracy**: Last 7 days accuracy
- **Avg Confidence**: Average prediction confidence
- **Total Predictions**: Cumulative predictions made

Color coding:
- Green (>70%): Good performance
- Yellow (60-70%): Warning
- Red (<60%): Critical

#### 2. System Health

- **Degradation Status**: HEALTHY or DEGRADED
- **Production Version**: Current live model ID
- **Total Versions**: All saved model versions
- **Active Tests**: Running A/B tests

#### 3. Alerts (Last 7 Days)

- **Total Alerts**: Count of all alerts
- **Critical**: System-wide failures
- **Errors**: Operation failures
- **Warnings**: Degradation detected

#### 4. Recent Model Versions

Lists last 10 model versions:
- Version ID with timestamp
- Accuracy metrics
- Production status indicator

#### 5. Recent Alerts

Shows last 10 alerts with:
- Alert title and message
- Timestamp
- Severity color coding

#### 6. A/B Test History

Displays recent A/B tests:
- Production vs Candidate versions
- Test status (running/completed)
- Results and recommendations

### Scheduling Dashboard Generation

Run daily at midnight:

```bash
# Add to crontab
0 0 * * * cd /path/to/my-neural-trader && node scripts/generate-dashboard.js
```

Or use systemd timer for more control.

### Dashboard Design

- **Dark Theme**: Optimized for readability
- **Color-Coded Status**: Quick visual scanning
- **Responsive Grid**: Mobile-friendly layout
- **No Dependencies**: Pure HTML/CSS (no server required)

---

## Alerting System

### Overview

The alerting system sends notifications for critical events via multiple channels: console, email, and Slack.

### Alert Types

#### 1. Performance Degradation

Sent when model accuracy drops significantly.

```javascript
const tracker = new PerformanceTracker();
const degradation = tracker.detectDegradation();

if (degradation.degraded) {
  const alerting = new AlertingSystem();
  await alerting.alertPerformanceDegradation(degradation);
}
```

Alert content:
```
═══════════════════════════════════════════════════════════════════
ALERT: WARNING
═══════════════════════════════════════════════════════════════════

Type:      PERFORMANCE_DEGRADATION
Time:      2025-12-08T14:30:00.000Z
Title:     Model Performance Degradation Detected
Message:   Weekly accuracy dropped by 5.2% (72.1% → 66.9%)

Recommendation: Trigger emergency retraining
═══════════════════════════════════════════════════════════════════
```

#### 2. Data Refresh Failure

Sent when Yahoo Finance data fetch fails.

```javascript
await alerting.alertDataRefreshFailure({
  failedSymbols: 5,
  symbols: ['AAPL', 'GOOGL', 'MSFT', 'TSLA', 'NVDA'],
  error: 'Connection timeout'
});
```

#### 3. Training Failure

Sent when model training encounters errors.

```javascript
await alerting.alertTrainingFailure({
  failedModels: 2,
  models: ['classifier_1', 'classifier_2'],
  error: 'GPU out of memory'
});
```

#### 4. Deployment Failure

Sent when model deployment fails.

```javascript
await alerting.alertDeploymentFailure({
  versionId: 'v20251208_0200',
  message: 'Validation failed: accuracy below threshold'
});
```

#### 5. Validation Failure

Sent when new models fail validation.

```javascript
await alerting.alertValidationFailure({
  reason: 'Accuracy 58.2% below required 60.0%',
  threshold: 0.60,
  actual: 0.582
});
```

#### 6. Info Alerts

Non-critical informational alerts.

```javascript
await alerting.alertInfo(
  'Weekly Retrain Complete',
  'Successfully trained 5 new models',
  { avgAccuracy: 0.725, duration: '45 minutes' }
);
```

### Severity Levels

- **INFO**: Informational (cyan)
- **WARNING**: Degradation detected (yellow)
- **ERROR**: Operation failed (red)
- **CRITICAL**: System-wide issue (magenta)

### Alert Channels

#### 1. Console (Always Enabled)

Default channel, always active.

Color-coded output to terminal:
- INFO: Cyan
- WARNING: Yellow
- ERROR: Red
- CRITICAL: Magenta

#### 2. Email Alerts

Configure email notifications:

```javascript
const alerting = new AlertingSystem({
  alertEmail: 'admin@example.com'
});
```

Requirements:
- Linux/Mac `mail` utility installed
- SMTP configured on system

Email format:
```
Subject: [Neural Trader] WARNING: Model Performance Degradation Detected

Alert Type: PERFORMANCE_DEGRADATION
Severity: WARNING
Time: 2025-12-08T14:30:00.000Z

Weekly accuracy dropped by 5.2% (72.1% → 66.9%)

Recommendation: Trigger emergency retraining

Details:
{
  "overallAccuracy": 0.721,
  "weeklyAccuracy": 0.669,
  "drop": 0.052,
  "degraded": true
}
```

#### 3. Slack Alerts

Configure Slack webhook:

```javascript
const alerting = new AlertingSystem({
  slackWebhook: 'https://hooks.slack.com/services/YOUR/WEBHOOK/URL'
});
```

Slack message features:
- Color-coded attachments
- Severity-based colors
- Formatted fields
- Timestamp footer

### Configuration

```javascript
const alerting = new AlertingSystem({
  // Alert destinations
  alertEmail: 'admin@example.com',
  slackWebhook: 'https://hooks.slack.com/services/...',
  enableConsoleAlerts: true,  // Default: true

  // Thresholds
  degradationThreshold: 0.05,  // 5% drop = WARNING
  criticalThreshold: 0.10      // 10% drop = CRITICAL
});
```

### Alert History

Query recent alerts:

```javascript
// Get last 20 alerts
const recent = alerting.getRecentAlerts(20);

// Get alerts by type
const perfAlerts = alerting.getAlertsByType('PERFORMANCE_DEGRADATION', 10);

// Get summary
const summary = alerting.getAlertSummary(7);  // Last 7 days
console.log(summary);
```

Output:
```javascript
{
  totalAlerts: 15,
  bySeverity: {
    INFO: 8,
    WARNING: 5,
    ERROR: 2,
    CRITICAL: 0
  },
  byType: {
    PERFORMANCE_DEGRADATION: 3,
    DATA_REFRESH_FAILURE: 1,
    TRAINING_FAILURE: 1,
    INFO: 10
  }
}
```

### Alert Cleanup

Automatically keeps last 1000 alerts. Manual cleanup:

```javascript
// Keep last 30 days only
const result = alerting.clearOldAlerts(30);
console.log(`Removed ${result.removed}, kept ${result.remaining}`);
```

---

## Weekly Workflow

### Complete Automated Workflow

Here's the recommended weekly workflow integrating all Stage 2 features:

#### Step 1: Data Refresh (Sunday 11 PM)

```bash
node scripts/refresh-weekly-data.js
```

This:
- Fetches latest data from Yahoo Finance
- Updates all 35 symbols
- Logs refresh results
- Sends alerts on failure

#### Step 2: Model Retraining (Sunday 11:30 PM)

```bash
node scripts/weekly-retrain.js
```

This:
- Trains 5 new models (2 classifiers, 3 regressors)
- Validates accuracy (must be ≥60%)
- Saves new version with metadata
- Does NOT deploy yet

#### Step 3: Start Shadow Mode (Monday 12 AM)

```bash
node scripts/run-shadow-mode.js v20251208_0000 7
```

This:
- Starts 7-day A/B test
- Production model continues live
- Candidate runs in shadow
- Both predictions logged

#### Step 4: Monitor Performance (Daily)

```bash
# Generate dashboard daily
node scripts/generate-dashboard.js

# Check for alerts
# (Automatic via alerting system)
```

This:
- Updates dashboard with latest metrics
- Monitors for degradation
- Sends alerts if issues detected

#### Step 5: End Shadow Mode (Next Sunday 11 PM)

```bash
node scripts/end-shadow-mode.js test_1732483200_abc123 --auto-deploy
```

This:
- Compares production vs candidate
- Runs statistical tests
- Deploys if significantly better
- Keeps production if not

#### Step 6: Repeat Weekly

The cycle repeats every Sunday:
```
Data Refresh → Retrain → Shadow Mode → Monitor → Evaluate → Deploy
```

### Cron Schedule

Automate the workflow:

```bash
# Edit crontab
crontab -e

# Add these lines
0 23 * * 0 cd /path/to/my-neural-trader && node scripts/refresh-weekly-data.js
30 23 * * 0 cd /path/to/my-neural-trader && node scripts/weekly-retrain.js
0 0 * * 1 cd /path/to/my-neural-trader && bash scripts/start-weekly-shadow.sh
0 0 * * * cd /path/to/my-neural-trader && node scripts/generate-dashboard.js
0 23 * * 0 cd /path/to/my-neural-trader && bash scripts/end-weekly-shadow.sh
```

### Automation Script

Create `scripts/start-weekly-shadow.sh`:

```bash
#!/bin/bash

# Get latest version
LATEST_VERSION=$(ls -t data/model-versions/ | head -1)

# Start shadow mode
node scripts/run-shadow-mode.js $LATEST_VERSION 7

# Save test ID for later
echo $LATEST_VERSION > /tmp/current-shadow-test.txt
```

Create `scripts/end-weekly-shadow.sh`:

```bash
#!/bin/bash

# Get test ID
TEST_ID=$(cat /tmp/current-shadow-test.txt)

# End shadow mode with auto-deploy
node scripts/end-shadow-mode.js $TEST_ID --auto-deploy

# Clean up
rm /tmp/current-shadow-test.txt
```

---

## Best Practices

### 1. Always Use Shadow Mode

Never deploy new models directly to production. Always:
1. Train new models
2. Start shadow mode for 7 days
3. Wait for statistical validation
4. Deploy only if significantly better

### 2. Monitor Daily

Check the dashboard daily:
- Review performance metrics
- Check for alerts
- Monitor A/B test progress
- Track system health

### 3. Set Up Multi-Channel Alerts

Configure at least two alert channels:

```javascript
const alerting = new AlertingSystem({
  enableConsoleAlerts: true,
  alertEmail: 'admin@example.com',
  slackWebhook: 'https://hooks.slack.com/...'
});
```

This ensures you get notified even if one channel fails.

### 4. Keep Version History

Never delete old model versions:
- Enables rollback if needed
- Tracks improvement over time
- Provides audit trail

The system automatically keeps all versions.

### 5. Understand Statistical Significance

Don't deploy based on small differences:
- Require p < 0.05 (95% confidence)
- Require ≥1% improvement
- Need sufficient sample size (~245 predictions)

### 6. Handle Degradation Immediately

If you see accuracy drop ≥5%:
1. Check data quality (Yahoo Finance connection)
2. Review recent market events (crashes, volatility)
3. Consider emergency retraining
4. Rollback if necessary

### 7. Test Configuration Changes

When modifying:
- Alerting thresholds
- A/B testing parameters
- Validation criteria

Test in development first.

### 8. Document All Deployments

The system automatically logs:
- Version deployments
- A/B test results
- Alert history

Review these logs monthly.

### 9. Schedule Maintenance Windows

Plan for:
- Data refresh: Sunday 11 PM - 11:15 PM
- Model training: Sunday 11:30 PM - 12:30 AM
- Dashboard generation: Daily midnight

Avoid manual operations during these windows.

### 10. Backup Critical Data

Regularly backup:
- `data/model-versions/` - Model history
- `data/performance-metrics.json` - Performance data
- `data/ab-test-results.json` - A/B test history
- `data/alert-log.json` - Alert history

---

## Troubleshooting

### Shadow Mode Issues

#### Problem: Shadow mode won't start

**Symptoms**: Error "Version not found" or "No production version"

**Solutions**:
1. Check if version exists:
   ```bash
   ls data/model-versions/
   ```

2. Verify production version set:
   ```javascript
   const versioning = new ModelVersioning();
   versioning.initialize();
   const prod = versioning.getProductionVersion();
   console.log(prod);
   ```

3. Set production version manually:
   ```bash
   node scripts/rollback-production.js <version-id>
   ```

#### Problem: Test comparison fails

**Symptoms**: Error "Insufficient data for comparison"

**Solutions**:
1. Ensure test ran for full duration (7 days)
2. Check if predictions were logged:
   ```bash
   cat data/shadow-mode-predictions.json | grep <test-id>
   ```

3. Verify predictions were resolved:
   ```javascript
   const abTesting = new ABTesting();
   const predictions = abTesting.getShadowPredictions(testId);
   console.log(predictions.filter(p => p.actual !== undefined).length);
   ```

### Alerting Issues

#### Problem: Email alerts not sending

**Symptoms**: Console shows "Failed to send email alert"

**Solutions**:
1. Check if `mail` utility installed:
   ```bash
   which mail
   ```

2. Test email manually:
   ```bash
   echo "Test" | mail -s "Test Subject" your@email.com
   ```

3. Configure SMTP:
   ```bash
   # For Ubuntu/Debian
   sudo apt-get install mailutils
   sudo dpkg-reconfigure postfix
   ```

#### Problem: Slack alerts not appearing

**Symptoms**: No errors but no messages in Slack

**Solutions**:
1. Verify webhook URL:
   ```bash
   curl -X POST -H 'Content-type: application/json' \
     --data '{"text":"Test message"}' \
     YOUR_WEBHOOK_URL
   ```

2. Check webhook permissions in Slack
3. Ensure webhook URL is correct in config

### Dashboard Issues

#### Problem: Dashboard shows no data

**Symptoms**: Empty cards or "N/A" values

**Solutions**:
1. Initialize all systems:
   ```javascript
   tracker.initialize();
   versioning.initialize();
   abTesting.initialize();
   alerting.initialize();
   ```

2. Check if data files exist:
   ```bash
   ls data/performance-metrics.json
   ls data/model-versions.json
   ls data/ab-test-results.json
   ls data/alert-log.json
   ```

3. Generate sample data:
   ```bash
   node scripts/weekly-retrain.js
   ```

#### Problem: Dashboard not updating

**Symptoms**: Shows old data

**Solutions**:
1. Regenerate dashboard:
   ```bash
   node scripts/generate-dashboard.js --output dashboard.html
   ```

2. Check file timestamp:
   ```bash
   ls -l dashboard.html
   ```

3. Hard refresh browser (Ctrl+Shift+R)

### Performance Issues

#### Problem: Degradation alert but models seem fine

**Symptoms**: False positive degradation warnings

**Solutions**:
1. Check if market conditions changed (volatility spike)
2. Review actual vs predicted outcomes
3. Adjust degradation threshold:
   ```javascript
   const alerting = new AlertingSystem({
     degradationThreshold: 0.10  // 10% instead of 5%
   });
   ```

4. Increase sample window for weekly accuracy

#### Problem: Models not improving over time

**Symptoms**: A/B tests consistently reject new models

**Solutions**:
1. Review training data quality
2. Check if market regime shifted
3. Experiment with different architectures
4. Add more features (indicators, sentiment)
5. Increase training data quantity

---

## Configuration Reference

### ABTesting Configuration

```javascript
const abTesting = new ABTesting({
  dataDir: './data',                // Data directory
  shadowModeDuration: 7,             // Default duration (days)
  significanceLevel: 0.05,           // P-value threshold
  minImprovement: 0.01,              // Minimum improvement (1%)
  minSampleSize: 100                 // Minimum predictions needed
});
```

### AlertingSystem Configuration

```javascript
const alerting = new AlertingSystem({
  dataDir: './data',                              // Data directory
  alertEmail: 'admin@example.com',                // Email address
  slackWebhook: 'https://hooks.slack.com/...',    // Slack webhook
  enableConsoleAlerts: true,                      // Console output
  degradationThreshold: 0.05,                     // WARNING at 5% drop
  criticalThreshold: 0.10                         // CRITICAL at 10% drop
});
```

### ModelVersioning Configuration

```javascript
const versioning = new ModelVersioning({
  dataDir: './data',                 // Data directory
  modelsDir: './models',             // Models directory
  versionsDir: './data/model-versions'  // Version storage
});
```

### PerformanceTracker Configuration

```javascript
const tracker = new PerformanceTracker({
  dataDir: './data',                 // Data directory
  degradationThreshold: 0.05,        // 5% drop threshold
  windowSize: 7                      // Weekly window (days)
});
```

---

## Summary

You now have a complete adaptation infrastructure that:

1. **Validates** new models statistically before deployment
2. **Monitors** system performance continuously
3. **Alerts** you to issues via multiple channels
4. **Automates** the weekly update cycle
5. **Protects** against deploying worse models

This infrastructure ensures your trading system continuously improves while minimizing risk.

For detailed technical documentation, see:
- `docs/STAGE2-IMPLEMENTATION-PLAN.md` - Full implementation details
- `docs/STAGE2-PHASES-3-4-COMPLETION.md` - Phase 3-4 completion summary
- `docs/DEPLOYMENT-GUIDE.md` - Production deployment guide

---

**Next Steps**:

1. Set up email and Slack alerts
2. Schedule weekly automation (cron)
3. Generate your first dashboard
4. Run your first shadow mode test
5. Monitor daily and refine thresholds

Happy trading!
