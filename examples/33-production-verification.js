/**
 * Production Verification & Gap Analysis
 *
 * Comprehensive audit of the trading system:
 * 1. Data quality checks
 * 2. Model validation (overfitting detection)
 * 3. Out-of-sample testing
 * 4. Probability calibration analysis
 * 5. Risk metrics
 * 6. Gap identification
 * 7. Improvement recommendations
 */

const fs = require('fs');
const path = require('path');

console.log('═══════════════════════════════════════════════════════════');
console.log('       PRODUCTION VERIFICATION & GAP ANALYSIS');
console.log('═══════════════════════════════════════════════════════════\n');

// ============================================
// 1. DATA QUALITY AUDIT
// ============================================

console.log('┌─────────────────────────────────────────────────────────┐');
console.log('│  1. DATA QUALITY AUDIT                                  │');
console.log('└─────────────────────────────────────────────────────────┘\n');

const dataDir = path.join(__dirname, '../historical-data');
const files = fs.readdirSync(dataDir).filter(f => f.endsWith('.json'));

let totalDays = 0;
let minDate = '9999-99-99';
let maxDate = '0000-00-00';
const symbolStats = [];
const dataIssues = [];

files.forEach(file => {
    try {
        const data = JSON.parse(fs.readFileSync(path.join(dataDir, file), 'utf8'));
        if (!Array.isArray(data)) return;
        const symbol = file.replace('-5-years.json', '');

    totalDays += data.length;

    // Check for issues
    let nullCount = 0;
    let gapCount = 0;
    let prevDate = null;

    data.forEach((d, i) => {
        if (!d.close || isNaN(d.close)) nullCount++;
        if (d.date < minDate) minDate = d.date;
        if (d.date > maxDate) maxDate = d.date;

        if (prevDate) {
            const daysDiff = (new Date(d.date) - new Date(prevDate)) / (1000 * 60 * 60 * 24);
            if (daysDiff > 5) gapCount++; // More than 5 days = gap (accounting for weekends)
        }
        prevDate = d.date;
    });

    symbolStats.push({ symbol, days: data.length, nulls: nullCount, gaps: gapCount });

    if (nullCount > 0) dataIssues.push(`${symbol}: ${nullCount} null values`);
    if (gapCount > 5) dataIssues.push(`${symbol}: ${gapCount} data gaps`);
    if (data.length < 1000) dataIssues.push(`${symbol}: Only ${data.length} days (< 1000)`);
    } catch (e) {
        // Skip invalid files
    }
});

console.log(`Total Symbols: ${files.length}`);
console.log(`Total Data Points: ${totalDays.toLocaleString()}`);
console.log(`Date Range: ${minDate} to ${maxDate}`);
console.log(`Average Days per Symbol: ${Math.round(totalDays / files.length)}`);

if (dataIssues.length > 0) {
    console.log('\n⚠️  Data Issues Found:');
    dataIssues.slice(0, 10).forEach(issue => console.log(`   - ${issue}`));
    if (dataIssues.length > 10) console.log(`   ... and ${dataIssues.length - 10} more`);
} else {
    console.log('\n✅ No major data issues found');
}

// ============================================
// 2. OVERFITTING DETECTION
// ============================================

console.log('\n┌─────────────────────────────────────────────────────────┐');
console.log('│  2. OVERFITTING DETECTION                               │');
console.log('└─────────────────────────────────────────────────────────┘\n');

// Load sample data for testing
const sampleSymbols = ['AAPL', 'MSFT', 'SPY', 'QQQ', 'NVDA'].filter(s =>
    fs.existsSync(path.join(dataDir, `${s}-5-years.json`))
);

// Simple indicators
function sma(prices, period) {
    return prices.map((_, i) => i < period - 1 ? null :
        prices.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0) / period);
}

function rsi(prices, period = 14) {
    const result = new Array(prices.length).fill(null);
    for (let i = period; i < prices.length; i++) {
        let gains = 0, losses = 0;
        for (let j = i - period + 1; j <= i; j++) {
            const change = prices[j] - prices[j - 1];
            if (change > 0) gains += change;
            else losses -= change;
        }
        result[i] = 100 - (100 / (1 + (losses === 0 ? 100 : gains / losses)));
    }
    return result;
}

// Simple features for quick test
function createSimpleFeatures(data, horizon = 10) {
    const prices = data.map(d => d.close);
    const sma20 = sma(prices, 20);
    const sma50 = sma(prices, 50);
    const rsiValues = rsi(prices);

    const features = [], labels = [];

    for (let i = 50; i < prices.length - horizon; i++) {
        if (!sma50[i] || !rsiValues[i]) continue;

        features.push([
            (prices[i] - sma20[i]) / sma20[i],
            (prices[i] - sma50[i]) / sma50[i],
            rsiValues[i] / 100,
            (prices[i] - prices[i-5]) / prices[i-5],
            (prices[i] - prices[i-10]) / prices[i-10],
        ]);

        const futureReturn = (prices[i + horizon] - prices[i]) / prices[i] * 100;
        labels.push(futureReturn > 1 ? 1 : 0);
    }

    return { features, labels };
}

// Simple Random Forest for testing
class SimpleRF {
    constructor(numTrees = 20, maxDepth = 8) {
        this.numTrees = numTrees;
        this.maxDepth = maxDepth;
        this.trees = [];
    }

    buildTree(features, labels, depth = 0) {
        if (depth >= this.maxDepth || labels.length < 20) {
            return { leaf: true, value: labels.reduce((a, b) => a + b, 0) / labels.length };
        }

        let bestGain = -Infinity, bestSplit = null;
        const featureIdx = Math.floor(Math.random() * features[0].length);
        const values = features.map(f => f[featureIdx]).sort((a, b) => a - b);

        for (let i = Math.floor(values.length * 0.2); i < values.length * 0.8; i += Math.ceil(values.length / 10)) {
            const threshold = values[i];
            const leftIdx = [], rightIdx = [];

            for (let j = 0; j < features.length; j++) {
                if (features[j][featureIdx] <= threshold) leftIdx.push(j);
                else rightIdx.push(j);
            }

            if (leftIdx.length < 10 || rightIdx.length < 10) continue;

            const leftMean = leftIdx.reduce((s, i) => s + labels[i], 0) / leftIdx.length;
            const rightMean = rightIdx.reduce((s, i) => s + labels[i], 0) / rightIdx.length;
            const gain = Math.abs(leftMean - rightMean);

            if (gain > bestGain) {
                bestGain = gain;
                bestSplit = { featureIdx, threshold,
                    leftFeatures: leftIdx.map(i => features[i]),
                    leftLabels: leftIdx.map(i => labels[i]),
                    rightFeatures: rightIdx.map(i => features[i]),
                    rightLabels: rightIdx.map(i => labels[i]) };
            }
        }

        if (!bestSplit) return { leaf: true, value: labels.reduce((a, b) => a + b, 0) / labels.length };

        return {
            leaf: false, featureIdx: bestSplit.featureIdx, threshold: bestSplit.threshold,
            left: this.buildTree(bestSplit.leftFeatures, bestSplit.leftLabels, depth + 1),
            right: this.buildTree(bestSplit.rightFeatures, bestSplit.rightLabels, depth + 1)
        };
    }

    train(features, labels) {
        this.trees = [];
        for (let t = 0; t < this.numTrees; t++) {
            const indices = Array.from({length: features.length}, () => Math.floor(Math.random() * features.length));
            this.trees.push(this.buildTree(indices.map(i => features[i]), indices.map(i => labels[i])));
        }
    }

    predictTree(tree, feature) {
        if (tree.leaf) return tree.value;
        return feature[tree.featureIdx] <= tree.threshold ?
            this.predictTree(tree.left, feature) : this.predictTree(tree.right, feature);
    }

    predict(feature) {
        return this.trees.reduce((s, t) => s + this.predictTree(t, feature), 0) / this.trees.length;
    }
}

// Test for overfitting
let allFeatures = [], allLabels = [];
sampleSymbols.forEach(sym => {
    const data = JSON.parse(fs.readFileSync(path.join(dataDir, `${sym}-5-years.json`), 'utf8'));
    const { features, labels } = createSimpleFeatures(data);
    allFeatures = allFeatures.concat(features);
    allLabels = allLabels.concat(labels);
});

// Split into train/val/test (60/20/20)
const n = allFeatures.length;
const trainEnd = Math.floor(n * 0.6);
const valEnd = Math.floor(n * 0.8);

const trainF = allFeatures.slice(0, trainEnd);
const trainL = allLabels.slice(0, trainEnd);
const valF = allFeatures.slice(trainEnd, valEnd);
const valL = allLabels.slice(trainEnd, valEnd);
const testF = allFeatures.slice(valEnd);
const testL = allLabels.slice(valEnd);

const rf = new SimpleRF(20, 8);
rf.train(trainF, trainL);

// Evaluate on all sets
function evaluate(model, features, labels) {
    let correct = 0, tp = 0, fp = 0, fn = 0;
    for (let i = 0; i < features.length; i++) {
        const pred = model.predict(features[i]) > 0.5 ? 1 : 0;
        if (pred === labels[i]) correct++;
        if (pred === 1 && labels[i] === 1) tp++;
        if (pred === 1 && labels[i] === 0) fp++;
        if (pred === 0 && labels[i] === 1) fn++;
    }
    return {
        accuracy: (correct / labels.length * 100).toFixed(1),
        precision: (tp / (tp + fp) * 100 || 0).toFixed(1),
        f1: (2 * tp / (2 * tp + fp + fn) * 100 || 0).toFixed(1)
    };
}

const trainResults = evaluate(rf, trainF, trainL);
const valResults = evaluate(rf, valF, valL);
const testResults = evaluate(rf, testF, testL);

console.log('Performance Across Splits:');
console.log('─'.repeat(50));
console.log(`Training (60%):   Acc ${trainResults.accuracy}% | Prec ${trainResults.precision}% | F1 ${trainResults.f1}%`);
console.log(`Validation (20%): Acc ${valResults.accuracy}% | Prec ${valResults.precision}% | F1 ${valResults.f1}%`);
console.log(`Test (20%):       Acc ${testResults.accuracy}% | Prec ${testResults.precision}% | F1 ${testResults.f1}%`);

const overfitGap = parseFloat(trainResults.accuracy) - parseFloat(testResults.accuracy);
if (overfitGap > 10) {
    console.log(`\n⚠️  OVERFITTING DETECTED: ${overfitGap.toFixed(1)}% gap between train and test`);
} else if (overfitGap > 5) {
    console.log(`\n⚠️  Mild overfitting: ${overfitGap.toFixed(1)}% gap`);
} else {
    console.log(`\n✅ No significant overfitting (${overfitGap.toFixed(1)}% gap)`);
}

// ============================================
// 3. PROBABILITY CALIBRATION
// ============================================

console.log('\n┌─────────────────────────────────────────────────────────┐');
console.log('│  3. PROBABILITY CALIBRATION                             │');
console.log('└─────────────────────────────────────────────────────────┘\n');

// Group predictions by probability buckets
const buckets = {};
for (let i = 0; i < testF.length; i++) {
    const prob = rf.predict(testF[i]);
    const bucket = Math.floor(prob * 10) / 10; // 0.0, 0.1, 0.2, etc.
    if (!buckets[bucket]) buckets[bucket] = { total: 0, positive: 0 };
    buckets[bucket].total++;
    buckets[bucket].positive += testL[i];
}

console.log('Probability Calibration (predicted vs actual):');
console.log('─'.repeat(50));
console.log('Predicted | Actual  | Count | Calibration');
console.log('─'.repeat(50));

let calibrationError = 0;
let calibrationCount = 0;

Object.keys(buckets).sort().forEach(bucket => {
    const b = buckets[bucket];
    const actualRate = (b.positive / b.total * 100).toFixed(1);
    const predictedRate = (parseFloat(bucket) * 100 + 5).toFixed(0); // midpoint of bucket
    const diff = Math.abs(parseFloat(actualRate) - parseFloat(predictedRate));

    calibrationError += diff * b.total;
    calibrationCount += b.total;

    const calibStatus = diff < 10 ? '✅' : diff < 20 ? '⚠️' : '❌';
    console.log(`${(parseFloat(bucket)*100).toFixed(0).padStart(5)}-${((parseFloat(bucket)+0.1)*100).toFixed(0).padStart(2)}% | ${actualRate.padStart(5)}% | ${String(b.total).padStart(5)} | ${calibStatus} ${diff < 10 ? 'Good' : diff < 20 ? 'Fair' : 'Poor'}`);
});

const avgCalibError = calibrationError / calibrationCount;
console.log(`\nAverage Calibration Error: ${avgCalibError.toFixed(1)}%`);
if (avgCalibError > 15) {
    console.log('⚠️  Probabilities are NOT well-calibrated');
} else {
    console.log('✅ Probabilities are reasonably calibrated');
}

// ============================================
// 4. RISK METRICS
// ============================================

console.log('\n┌─────────────────────────────────────────────────────────┐');
console.log('│  4. RISK METRICS                                        │');
console.log('└─────────────────────────────────────────────────────────┘\n');

// Simulate trading on test set
let cash = 10000, shares = 0, entryPrice = 0;
const equityCurve = [10000];
let maxDrawdown = 0, peak = 10000;
let trades = 0, wins = 0;
const returns = [];

// Load SPY for test period backtest
const spyData = JSON.parse(fs.readFileSync(path.join(dataDir, 'SPY-5-years.json'), 'utf8'));
const spyPrices = spyData.map(d => d.close).slice(-testF.length - 50);

for (let i = 0; i < Math.min(testF.length, spyPrices.length - 10); i++) {
    const price = spyPrices[i + 50];
    const prob = rf.predict(testF[i]);

    if (shares > 0) {
        const pnlPct = ((price - entryPrice) / entryPrice) * 100;
        if (prob < 0.4 || pnlPct <= -5 || pnlPct >= 10) {
            cash = shares * price;
            trades++;
            if (pnlPct > 0) wins++;
            returns.push(pnlPct);
            shares = 0;
        }
    }

    if (shares === 0 && prob > 0.55) {
        shares = cash / price;
        entryPrice = price;
        cash = 0;
    }

    const equity = shares > 0 ? shares * price : cash;
    equityCurve.push(equity);
    peak = Math.max(peak, equity);
    maxDrawdown = Math.max(maxDrawdown, (peak - equity) / peak * 100);
}

if (shares > 0) cash = shares * spyPrices[spyPrices.length - 1];

const finalReturn = ((cash - 10000) / 10000) * 100;
const avgReturn = returns.length > 0 ? returns.reduce((a, b) => a + b, 0) / returns.length : 0;
const stdReturn = returns.length > 1 ? Math.sqrt(returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length) : 0;
const sharpeRatio = stdReturn > 0 ? (avgReturn / stdReturn) * Math.sqrt(252 / 10) : 0; // Annualized

console.log('Backtest Risk Metrics:');
console.log('─'.repeat(50));
console.log(`Total Return:      ${finalReturn.toFixed(1)}%`);
console.log(`Max Drawdown:      ${maxDrawdown.toFixed(1)}%`);
console.log(`Trades:            ${trades}`);
console.log(`Win Rate:          ${trades > 0 ? (wins/trades*100).toFixed(0) : 'N/A'}%`);
console.log(`Avg Return/Trade:  ${avgReturn.toFixed(2)}%`);
console.log(`Std Dev:           ${stdReturn.toFixed(2)}%`);
console.log(`Sharpe Ratio:      ${sharpeRatio.toFixed(2)}`);

if (maxDrawdown > 25) console.log('\n⚠️  High drawdown risk (>25%)');
if (sharpeRatio < 0.5) console.log('⚠️  Low risk-adjusted returns (Sharpe < 0.5)');
if (trades < 10) console.log('⚠️  Too few trades for reliable statistics');

// ============================================
// 5. GAP ANALYSIS
// ============================================

console.log('\n┌─────────────────────────────────────────────────────────┐');
console.log('│  5. GAP ANALYSIS                                        │');
console.log('└─────────────────────────────────────────────────────────┘\n');

const gaps = [];

// Data gaps
if (files.length < 30) gaps.push({ area: 'Data', issue: `Only ${files.length} symbols`, severity: 'Medium', fix: 'Add more diverse stocks' });
if (totalDays / files.length < 1200) gaps.push({ area: 'Data', issue: 'Less than 5 years history', severity: 'Low', fix: 'Download more historical data' });

// Model gaps
if (overfitGap > 10) gaps.push({ area: 'Model', issue: 'Overfitting detected', severity: 'High', fix: 'Add regularization, reduce depth, more data' });
if (avgCalibError > 15) gaps.push({ area: 'Model', issue: 'Poor probability calibration', severity: 'High', fix: 'Use Platt scaling or isotonic regression' });

// Feature gaps
gaps.push({ area: 'Features', issue: 'No sentiment data', severity: 'Medium', fix: 'Add news sentiment API' });
gaps.push({ area: 'Features', issue: 'No earnings calendar', severity: 'Medium', fix: 'Add earnings dates as feature' });
gaps.push({ area: 'Features', issue: 'No options flow', severity: 'Low', fix: 'Add put/call ratio if available' });

// Risk gaps
if (maxDrawdown > 20) gaps.push({ area: 'Risk', issue: `${maxDrawdown.toFixed(0)}% max drawdown`, severity: 'High', fix: 'Add position sizing rules' });
gaps.push({ area: 'Risk', issue: 'No portfolio diversification', severity: 'Medium', fix: 'Limit sector concentration' });
gaps.push({ area: 'Risk', issue: 'No stop-loss optimization', severity: 'Medium', fix: 'Use ATR-based stops' });

// Infrastructure gaps
gaps.push({ area: 'Infra', issue: 'No real-time data pipeline', severity: 'Medium', fix: 'Add streaming quotes' });
gaps.push({ area: 'Infra', issue: 'No automated retraining', severity: 'Low', fix: 'Schedule weekly model updates' });
gaps.push({ area: 'Infra', issue: 'No prediction logging', severity: 'Low', fix: 'Log all predictions for analysis' });

console.log('Identified Gaps:');
console.log('─'.repeat(70));
console.log('Severity | Area     | Issue                          | Recommended Fix');
console.log('─'.repeat(70));

gaps.sort((a, b) => {
    const sevOrder = { 'High': 0, 'Medium': 1, 'Low': 2 };
    return sevOrder[a.severity] - sevOrder[b.severity];
}).forEach(g => {
    const emoji = g.severity === 'High' ? '🔴' : g.severity === 'Medium' ? '🟡' : '🟢';
    console.log(`${emoji} ${g.severity.padEnd(6)} | ${g.area.padEnd(8)} | ${g.issue.padEnd(30)} | ${g.fix}`);
});

// ============================================
// 6. IMPROVEMENT ROADMAP
// ============================================

console.log('\n┌─────────────────────────────────────────────────────────┐');
console.log('│  6. IMPROVEMENT ROADMAP                                 │');
console.log('└─────────────────────────────────────────────────────────┘\n');

console.log('PHASE 1: Quick Wins (1-2 days)');
console.log('─'.repeat(50));
console.log('  □ Add probability calibration (Platt scaling)');
console.log('  □ Implement ATR-based position sizing');
console.log('  □ Add more diverse stocks (50+ symbols)');
console.log('  □ Tune model hyperparameters (trees, depth)');

console.log('\nPHASE 2: Model Improvements (1 week)');
console.log('─'.repeat(50));
console.log('  □ Implement XGBoost (better than RF)');
console.log('  □ Add cross-validation with purging');
console.log('  □ Ensemble multiple model types');
console.log('  □ Add SHAP for explainability');

console.log('\nPHASE 3: Feature Engineering (1-2 weeks)');
console.log('─'.repeat(50));
console.log('  □ Add earnings calendar feature');
console.log('  □ Add sector relative strength');
console.log('  □ Add intermarket correlations');
console.log('  □ Add options-derived features (if available)');

console.log('\nPHASE 4: Production Hardening (2-4 weeks)');
console.log('─'.repeat(50));
console.log('  □ Implement real-time data pipeline');
console.log('  □ Add automated model retraining');
console.log('  □ Build monitoring dashboard');
console.log('  □ Add prediction logging & analysis');

// ============================================
// 7. SUMMARY SCORECARD
// ============================================

console.log('\n┌─────────────────────────────────────────────────────────┐');
console.log('│  7. PRODUCTION READINESS SCORECARD                      │');
console.log('└─────────────────────────────────────────────────────────┘\n');

const scores = {
    'Data Quality': files.length >= 30 && dataIssues.length < 5 ? 8 : files.length >= 20 ? 6 : 4,
    'Model Performance': parseFloat(testResults.accuracy) > 55 ? 7 : parseFloat(testResults.accuracy) > 50 ? 5 : 3,
    'Overfitting Control': overfitGap < 5 ? 9 : overfitGap < 10 ? 6 : 3,
    'Probability Calibration': avgCalibError < 10 ? 9 : avgCalibError < 15 ? 6 : 3,
    'Risk Management': maxDrawdown < 15 ? 8 : maxDrawdown < 25 ? 5 : 2,
    'Feature Diversity': 6, // Manual assessment
    'Production Readiness': 4, // No real-time pipeline yet
};

console.log('Category               | Score | Status');
console.log('─'.repeat(50));

let totalScore = 0;
Object.entries(scores).forEach(([cat, score]) => {
    totalScore += score;
    const status = score >= 8 ? '✅ Excellent' : score >= 6 ? '🟡 Good' : score >= 4 ? '🟠 Needs Work' : '🔴 Critical';
    console.log(`${cat.padEnd(22)} | ${String(score).padStart(5)}/10 | ${status}`);
});

const avgScore = totalScore / Object.keys(scores).length;
console.log('─'.repeat(50));
console.log(`${'OVERALL'.padEnd(22)} | ${avgScore.toFixed(1).padStart(5)}/10 | ${avgScore >= 7 ? '✅ Production Ready' : avgScore >= 5 ? '🟡 Beta Ready' : '🔴 Not Ready'}`);

console.log('\n═══════════════════════════════════════════════════════════');
console.log('                    VERIFICATION COMPLETE');
console.log('═══════════════════════════════════════════════════════════\n');
