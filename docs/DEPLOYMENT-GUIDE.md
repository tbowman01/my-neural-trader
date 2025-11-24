# Neural Trader Deployment Guide

## Overview

This guide covers the complete deployment and operation of the Neural Trader automated ML pipeline.

**Status**: Production Ready
**Version**: v20251124_1657
**Ensemble Confidence**: 59.4%

---

## Architecture

### System Components

```
my-neural-trader/
├── models/
│   ├── model-1 → phase5-ensemble-model1  # Symlinks to actual models
│   ├── model-2 → phase5-ensemble-model2
│   ├── model-3 → phase5-ensemble-model3
│   ├── model-4 → phase5-ensemble-model4
│   ├── model-5 → phase5-ensemble-model5
│   ├── production → versions/v20251124_1657  # Production symlink
│   └── versions/
│       └── v20251124_1657/  # Versioned snapshots
├── historical-data/          # Market data files
├── data/                     # Performance tracking
├── logs/                     # Training logs
├── lib/                      # Core systems
│   ├── data-refresh.js       # Incremental data updates
│   ├── model-versioning.js   # Git-style version control
│   ├── performance-tracker.js # Prediction tracking
│   └── training-orchestrator.js # Model training
└── scripts/                  # Automation scripts
    ├── setup-production.js   # Initial setup
    ├── weekly-retrain.js     # Main automation
    ├── weekly-data-refresh.js
    ├── track-performance.js
    ├── rollback-production.js
    └── list-versions.js
```

### Data Flow

```
Weekly Schedule (Sunday 2 AM)
│
├─> 1. Data Refresh (5-10 min)
│   └─> Fetch new bars from Yahoo Finance
│
├─> 2. Model Training (70-80 min)
│   └─> Retrain all 5 models sequentially
│
├─> 3. Validation (1 min)
│   └─> Check accuracy threshold (>70%)
│
├─> 4. Versioning (1 min)
│   └─> Create snapshot with metadata
│
├─> 5. Deployment (<1 min)
│   └─> Update production symlink
│
└─> 6. Cleanup (<1 min)
    └─> Remove old versions/logs
```

---

## Initial Setup

### Prerequisites

- Node.js 20.19.5 or higher
- NVIDIA GPU with CUDA 12.x
- TensorFlow.js with GPU support
- 142 stock symbols with 5-year historical data
- Git repository initialized

### 1. Install Dependencies

```bash
npm install
```

Required packages:
- `@tensorflow/tfjs-node-gpu` - GPU-accelerated training
- `yahoo-finance2` - Market data fetching
- `technicalindicators` - Feature engineering

### 2. Initialize Production

```bash
node scripts/setup-production.js
```

This will:
- ✅ Verify all 5 models exist
- ✅ Create initial version snapshot
- ✅ Set as production version
- ✅ Initialize tracking systems
- ✅ Create necessary directories

Expected output:
```
Production Environment Summary:
  Production Version:  v20251124_1657
  Models:              5/5
  Ensemble Confidence: 59.4% (baseline)
```

### 3. Verify Setup

```bash
# Check production version
node scripts/list-versions.js --production

# Check performance tracking
node scripts/track-performance.js summary

# Test data refresh
node scripts/weekly-data-refresh.js
```

---

## Weekly Automation

### Setup Cron Job

Add to your crontab (every Sunday at 2 AM):

```bash
crontab -e
```

Add this line:
```
0 2 * * 0 cd /mnt/c/Users/bowma/Projects/my-neural-trader && node scripts/weekly-retrain.js >> logs/weekly-retrain.log 2>&1
```

### Manual Execution

```bash
# Full production run
node scripts/weekly-retrain.js

# Dry run (no deployment)
node scripts/weekly-retrain.js --dry-run

# Force deployment (ignore validation)
node scripts/weekly-retrain.js --force
```

### What Happens Automatically

**Step 1: Data Refresh**
- Loads existing historical data
- Fetches new bars since last update
- Validates data quality
- Merges and saves updated files

**Step 2: Model Training**
- Trains all 5 models sequentially
- GPU-optimized (20 epochs, batch 128)
- ~14-16 minutes per model
- Validates minimum 70% accuracy

**Step 3: Versioning**
- Creates timestamped snapshot
- Includes Git commit/branch
- Stores metadata and metrics
- Keeps last 10 versions

**Step 4: Deployment**
- Updates production symlink
- Zero-downtime switch
- Previous version available for rollback

---

## Operations

### Monitoring

**Check Performance:**
```bash
node scripts/track-performance.js summary
```

**Check for Degradation:**
```bash
node scripts/track-performance.js degradation
```

**View Version History:**
```bash
node scripts/list-versions.js
node scripts/list-versions.js --limit 20
```

**Export Metrics:**
```bash
node scripts/track-performance.js export
# Creates data/predictions-export.csv
```

### Rollback

**Rollback to Previous Version:**
```bash
node scripts/rollback-production.js
```

**Rollback to Specific Version:**
```bash
node scripts/rollback-production.js v20251124_1657
```

### Cleanup

**Clean Old Predictions:**
```bash
node scripts/track-performance.js cleanup
# Keeps last 5000 predictions
```

**Clean Old Logs:**
```bash
# Automatically done by weekly-retrain.js
# Keeps last 30 days
```

---

## Model Details

### Ensemble Architecture

**5-Model Consensus:**
- Each model: 128→64→32→16→1 dense layers
- Dropout: 0.2-0.3 for regularization
- L2 regularization: 0.001
- Activation: ReLU (hidden), Sigmoid (output)

**Features (14 total):**
1. Price vs SMA (20, 50, 200)
2. RSI (14 period)
3. MACD histogram
4. Rate of Change
5. Stochastic (K, D)
6. Williams %R
7. Bollinger Band position
8. ATR percentage
9. OBV trend
10. Money Flow Index
11. Volume ratio

**Training:**
- GPU-optimized: 20 epochs, batch 128
- ~14-16 minutes per model
- ~70-80 minutes total (5 models)

**Performance:**
- Individual model accuracy: ~73.4%
- Ensemble confidence: 59.4%
- Test set: 142 stocks, 60,250 samples

### Version Metadata

Each version includes:
- `versionId`: Timestamp-based (vYYYYMMDD_HHMM)
- `timestamp`: ISO 8601 creation time
- `numModels`: Number of models (5)
- `gitCommit`: Git commit hash
- `gitBranch`: Git branch name
- `avgAccuracy`: Average model accuracy
- `minAccuracy`: Minimum model accuracy
- `maxAccuracy`: Maximum model accuracy
- `trainingDuration`: Total training time (ms)
- `dataRefreshSummary`: New bars added

---

## Performance Tracking

### Prediction Logging

```javascript
const tracker = new PerformanceTracker();
tracker.initialize();

// Log prediction
const entry = tracker.logPrediction({
  symbol: 'AAPL',
  prediction: 'bullish',
  confidence: 0.65,
  currentPrice: 150.00,
  modelVersion: 'v20251124_1657'
});

// Resolve after 7 days
tracker.resolvePrediction(entry.id, {
  outcome: 'correct',
  actualReturn: 0.05,
  actualPrice: 157.50
});
```

### Metrics Calculated

- Overall accuracy (all time)
- Weekly accuracy (last 7 days)
- Monthly accuracy (last 30 days)
- Accuracy by confidence bucket (0-20%, 20-40%, etc.)
- Accuracy by model version
- Average confidence
- Average return

### Degradation Detection

Automatically detects when weekly accuracy drops >5% below baseline:

```bash
node scripts/track-performance.js degradation
```

Output if degraded:
```
⚠️  MODEL DEGRADATION DETECTED

Severity:          HIGH
Overall Accuracy:  73.4%
Weekly Accuracy:   68.1%
Performance Drop:  5.3%

Recommendation:
  Consider retraining models with latest data
```

---

## Troubleshooting

### Training Failures

**Issue**: Model fails to train

**Diagnosis:**
```bash
tail -100 logs/model-1-training.log
```

**Common causes:**
- GPU memory exhausted → Reduce batch size
- Data quality issues → Check data validation
- Network timeout → Increase timeout in orchestrator

**Fix:**
```bash
# Retrain specific model
node scripts/weekly-retrain.js --dry-run
# Check logs, fix issue, then:
node scripts/weekly-retrain.js
```

### Validation Failures

**Issue**: New models fail validation

**Diagnosis:**
```bash
node scripts/list-versions.js
# Check latest version metrics
```

**Common causes:**
- Accuracy below 70% threshold
- Training failure
- Data quality regression

**Fix:**
```bash
# Rollback to previous version
node scripts/rollback-production.js

# Investigate and fix
# Then retrain
node scripts/weekly-retrain.js
```

### Data Refresh Failures

**Issue**: Yahoo Finance fetch fails

**Diagnosis:**
```bash
node scripts/weekly-data-refresh.js
# Check error messages
```

**Common causes:**
- Network connectivity
- Yahoo Finance API changes
- Rate limiting

**Fix:**
- Wait and retry
- Check yahoo-finance2 package updates
- Adjust rate limiting delay

---

## Backup and Recovery

### Backup Strategy

**What to backup:**
1. `/models/versions/` - All model versions
2. `/historical-data/` - Market data
3. `/data/` - Performance tracking data
4. `.git/` - Git repository

**Backup frequency:**
- Daily: Git commits
- Weekly: Full backup after successful retrain
- Monthly: Archive to external storage

### Recovery

**Restore from backup:**
```bash
# 1. Restore files
cp -r backup/models/versions/* models/versions/
cp -r backup/historical-data/* historical-data/
cp -r backup/data/* data/

# 2. List available versions
node scripts/list-versions.js

# 3. Set production version
node scripts/rollback-production.js v20251201_0200
```

---

## Security Considerations

### API Keys

- Yahoo Finance: No API key required (free tier)
- Store any future API keys in `.env` file
- Add `.env` to `.gitignore`

### Model Access

- Production models are read-only
- Only automation scripts modify `/models/versions/`
- Use file permissions to restrict access

### Data Privacy

- Historical market data is public
- Performance tracking data is local
- No PII or sensitive data stored

---

## Performance Optimization

### GPU Utilization

Current settings (60% GPU reduction):
- Epochs: 20 (vs 50 baseline)
- Batch size: 128 (vs 256 baseline)
- Training time: ~14-16 min per model

**To adjust:**
Edit `examples/46-stage1-train-models-4-5.js`:
```javascript
await model.fit(xTrain, yTrain, {
  epochs: 20,        // Increase for better accuracy
  batchSize: 128,    // Increase for faster training
  validationData: [xTest, yTest]
});
```

### Parallel Training

Enable parallel training (requires more GPU memory):

Edit `lib/training-orchestrator.js`:
```javascript
this.parallelTraining = true;  // Train all 5 models at once
```

**Trade-offs:**
- Sequential: 70-80 min, lower GPU usage
- Parallel: 15-20 min, higher GPU usage

---

## Maintenance

### Weekly Tasks

✅ **Automated** (via cron):
- Data refresh
- Model retraining
- Version creation
- Deployment
- Cleanup

### Monthly Tasks

🔧 **Manual**:
- Review performance metrics
- Check disk usage
- Archive old logs
- Update dependencies

### Quarterly Tasks

🔍 **Review**:
- Ensemble accuracy trends
- Data quality
- Feature importance
- Architecture improvements

---

## Support

### Logs

- Training logs: `/logs/model-*-training.log`
- Weekly retrain: `/logs/weekly-retrain.log`
- Data refresh: `/data/refresh-log.json`
- Performance: `/data/predictions.json`

### Diagnostics

```bash
# System health check
ls -la models/production  # Check production symlink
node scripts/list-versions.js --production
node scripts/track-performance.js summary

# Recent activity
tail -100 logs/weekly-retrain.log
```

---

## Changelog

### v20251124_1657 (Initial Production)

- 5-model ensemble
- 14 technical indicators
- 59.4% ensemble confidence
- 73.4% individual model accuracy
- GPU-optimized training
- Automated weekly retraining
- Model versioning with rollback
- Performance tracking
- Data refresh system

---

## Future Enhancements

### Planned (Stage 2 Phases 3-4)

- **A/B Testing**: Shadow mode execution, statistical validation
- **Monitoring**: Real-time dashboards, alerting system
- **Advanced Metrics**: Sharpe ratio, win rate, profitability

### Under Consideration

- **Live Trading Integration**: Broker APIs, order execution
- **Position Sizing**: Kelly criterion, risk management
- **Additional Features**: Explore Stage 3 indicators selectively
- **Multi-timeframe**: Add intraday predictions

---

## References

- TensorFlow.js Docs: https://js.tensorflow.org/
- Yahoo Finance API: https://github.com/gadicc/node-yahoo-finance2
- Technical Indicators: https://github.com/anandanand84/technicalindicators
- Git Documentation: https://git-scm.com/doc

---

**Last Updated**: 2025-11-24
**Production Version**: v20251124_1657
**Maintainer**: Neural Trader Team
