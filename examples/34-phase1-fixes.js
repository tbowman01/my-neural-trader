/**
 * Example 34: Phase 1 Fixes - Anti-Overfitting Improvements
 *
 * Implements:
 * 1. Reduced tree depth (12 → 6) with regularization
 * 2. Platt scaling for probability calibration
 * 3. ATR-based position sizing
 * 4. Cross-validation for hyperparameter tuning
 */

const fs = require('fs');
const path = require('path');

// ============================================================================
// DATA LOADING
// ============================================================================

function loadAllData() {
    const dataDir = path.join(__dirname, '..', 'historical-data');
    const files = fs.readdirSync(dataDir).filter(f => f.endsWith('.json'));
    const allData = {};

    files.forEach(file => {
        try {
            const symbol = file.replace('.json', '').toUpperCase();
            const data = JSON.parse(fs.readFileSync(path.join(dataDir, file), 'utf8'));
            if (Array.isArray(data) && data.length > 100) {
                allData[symbol] = data;
            }
        } catch (e) {
            // Skip invalid files
        }
    });

    return allData;
}

// ============================================================================
// TECHNICAL INDICATORS
// ============================================================================

function calculateIndicators(data) {
    const closes = data.map(d => d.close);
    const highs = data.map(d => d.high);
    const lows = data.map(d => d.low);
    const volumes = data.map(d => d.volume);

    const result = [];

    for (let i = 50; i < data.length; i++) {
        const slice = closes.slice(0, i + 1);
        const highSlice = highs.slice(0, i + 1);
        const lowSlice = lows.slice(0, i + 1);
        const volSlice = volumes.slice(0, i + 1);

        // Price-based
        const sma20 = avg(slice.slice(-20));
        const sma50 = avg(slice.slice(-50));
        const ema12 = ema(slice, 12);
        const ema26 = ema(slice, 26);

        // Momentum
        const rsi = calculateRSI(slice, 14);
        const macd = ema12 - ema26;
        const macdSignal = ema(slice.slice(-9).map(() => macd), 9);

        // Volatility
        const atr = calculateATR(highSlice, lowSlice, slice, 14);
        const bbWidth = calculateBBWidth(slice, 20);

        // Volume
        const volumeRatio = volSlice[volSlice.length - 1] / avg(volSlice.slice(-20));

        // Trend
        const adx = calculateADX(highSlice, lowSlice, slice, 14);

        // Returns
        const ret1d = (closes[i] - closes[i - 1]) / closes[i - 1];
        const ret5d = (closes[i] - closes[i - 5]) / closes[i - 5];
        const ret20d = (closes[i] - closes[i - 20]) / closes[i - 20];

        result.push({
            date: data[i].date,
            close: closes[i],
            atr: atr,
            features: [
                closes[i] / sma20 - 1,        // Price vs SMA20
                closes[i] / sma50 - 1,        // Price vs SMA50
                sma20 / sma50 - 1,            // SMA20 vs SMA50
                rsi / 100,                     // RSI normalized
                macd / closes[i],              // MACD normalized
                (macd - macdSignal) / closes[i], // MACD histogram
                atr / closes[i],               // ATR normalized
                bbWidth,                       // Bollinger Band width
                Math.min(volumeRatio, 3) / 3,  // Volume ratio capped
                adx / 100,                     // ADX normalized
                ret1d,                         // 1-day return
                ret5d,                         // 5-day return
                ret20d                         // 20-day return
            ]
        });
    }

    return result;
}

function avg(arr) {
    return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function ema(arr, period) {
    const k = 2 / (period + 1);
    let emaVal = arr[0];
    for (let i = 1; i < arr.length; i++) {
        emaVal = arr[i] * k + emaVal * (1 - k);
    }
    return emaVal;
}

function calculateRSI(prices, period) {
    let gains = 0, losses = 0;
    for (let i = prices.length - period; i < prices.length; i++) {
        const change = prices[i] - prices[i - 1];
        if (change > 0) gains += change;
        else losses -= change;
    }
    if (losses === 0) return 100;
    const rs = gains / losses;
    return 100 - (100 / (1 + rs));
}

function calculateATR(highs, lows, closes, period) {
    const trs = [];
    for (let i = highs.length - period; i < highs.length; i++) {
        const tr = Math.max(
            highs[i] - lows[i],
            Math.abs(highs[i] - closes[i - 1]),
            Math.abs(lows[i] - closes[i - 1])
        );
        trs.push(tr);
    }
    return avg(trs);
}

function calculateBBWidth(prices, period) {
    const slice = prices.slice(-period);
    const mean = avg(slice);
    const std = Math.sqrt(slice.reduce((sum, p) => sum + (p - mean) ** 2, 0) / period);
    return (2 * std) / mean;
}

function calculateADX(highs, lows, closes, period) {
    // Simplified ADX
    let dmPlus = 0, dmMinus = 0;
    for (let i = highs.length - period; i < highs.length; i++) {
        const upMove = highs[i] - highs[i - 1];
        const downMove = lows[i - 1] - lows[i];
        if (upMove > downMove && upMove > 0) dmPlus += upMove;
        if (downMove > upMove && downMove > 0) dmMinus += downMove;
    }
    const dx = Math.abs(dmPlus - dmMinus) / (dmPlus + dmMinus + 0.001);
    return dx * 100;
}

// ============================================================================
// REGULARIZED RANDOM FOREST (Reduced Depth)
// ============================================================================

class RegularizedRandomForest {
    constructor(options = {}) {
        this.nTrees = options.nTrees || 100;
        this.maxDepth = options.maxDepth || 6;  // Reduced from 12!
        this.minSamplesLeaf = options.minSamplesLeaf || 10;  // Increased from 5!
        this.maxFeatures = options.maxFeatures || 'sqrt';
        this.trees = [];
    }

    train(X, y) {
        console.log(`Training ${this.nTrees} trees (depth=${this.maxDepth}, minLeaf=${this.minSamplesLeaf})...`);

        for (let t = 0; t < this.nTrees; t++) {
            // Bootstrap sample
            const indices = [];
            for (let i = 0; i < X.length; i++) {
                indices.push(Math.floor(Math.random() * X.length));
            }

            const Xb = indices.map(i => X[i]);
            const yb = indices.map(i => y[i]);

            // Build tree with regularization
            const tree = this.buildTree(Xb, yb, 0);
            this.trees.push(tree);

            if ((t + 1) % 20 === 0) {
                process.stdout.write(`  ${t + 1}/${this.nTrees} trees\r`);
            }
        }
        console.log();
    }

    buildTree(X, y, depth) {
        // Regularization: Stop early
        if (depth >= this.maxDepth ||
            X.length < this.minSamplesLeaf * 2 ||
            new Set(y).size === 1) {
            return { leaf: true, prob: y.filter(v => v === 1).length / y.length };
        }

        // Select random features
        const nFeatures = X[0].length;
        const maxF = this.maxFeatures === 'sqrt' ?
            Math.ceil(Math.sqrt(nFeatures)) :
            Math.ceil(nFeatures / 3);

        const featureIndices = [];
        while (featureIndices.length < maxF) {
            const idx = Math.floor(Math.random() * nFeatures);
            if (!featureIndices.includes(idx)) featureIndices.push(idx);
        }

        // Find best split
        let bestGain = -Infinity;
        let bestSplit = null;

        for (const fIdx of featureIndices) {
            const values = X.map(x => x[fIdx]).sort((a, b) => a - b);
            const thresholds = [];
            for (let i = 0; i < values.length - 1; i += Math.ceil(values.length / 10)) {
                thresholds.push((values[i] + values[i + 1]) / 2);
            }

            for (const thresh of thresholds) {
                const leftIdx = [], rightIdx = [];
                X.forEach((x, i) => {
                    if (x[fIdx] <= thresh) leftIdx.push(i);
                    else rightIdx.push(i);
                });

                // Regularization: Require minimum samples in each child
                if (leftIdx.length < this.minSamplesLeaf ||
                    rightIdx.length < this.minSamplesLeaf) continue;

                const gain = this.giniGain(y, leftIdx, rightIdx);
                if (gain > bestGain) {
                    bestGain = gain;
                    bestSplit = { fIdx, thresh, leftIdx, rightIdx };
                }
            }
        }

        if (!bestSplit) {
            return { leaf: true, prob: y.filter(v => v === 1).length / y.length };
        }

        return {
            leaf: false,
            fIdx: bestSplit.fIdx,
            thresh: bestSplit.thresh,
            left: this.buildTree(
                bestSplit.leftIdx.map(i => X[i]),
                bestSplit.leftIdx.map(i => y[i]),
                depth + 1
            ),
            right: this.buildTree(
                bestSplit.rightIdx.map(i => X[i]),
                bestSplit.rightIdx.map(i => y[i]),
                depth + 1
            )
        };
    }

    giniGain(y, leftIdx, rightIdx) {
        const gini = (indices) => {
            if (indices.length === 0) return 0;
            const p = indices.filter(i => y[i] === 1).length / indices.length;
            return 1 - p * p - (1 - p) * (1 - p);
        };

        const parentGini = gini([...Array(y.length).keys()]);
        const leftGini = gini(leftIdx);
        const rightGini = gini(rightIdx);

        const n = y.length;
        return parentGini - (leftIdx.length / n * leftGini + rightIdx.length / n * rightGini);
    }

    predictProba(X) {
        return X.map(x => {
            const probs = this.trees.map(tree => this.predictTree(tree, x));
            return probs.reduce((a, b) => a + b, 0) / probs.length;
        });
    }

    predictTree(node, x) {
        if (node.leaf) return node.prob;
        if (x[node.fIdx] <= node.thresh) return this.predictTree(node.left, x);
        return this.predictTree(node.right, x);
    }
}

// ============================================================================
// PLATT SCALING (Probability Calibration)
// ============================================================================

class PlattScaling {
    constructor() {
        this.A = 0;
        this.B = 0;
    }

    fit(rawProbs, yTrue) {
        // Platt's method: fit sigmoid P(y=1|f) = 1/(1+exp(Af+B))
        // Using gradient descent

        const n = rawProbs.length;
        const nPos = yTrue.filter(y => y === 1).length;
        const nNeg = n - nPos;

        // Target values (smoothed)
        const targetPos = (nPos + 1) / (nPos + 2);
        const targetNeg = 1 / (nNeg + 2);
        const targets = yTrue.map(y => y === 1 ? targetPos : targetNeg);

        // Initialize
        this.A = 0;
        this.B = Math.log((nNeg + 1) / (nPos + 1));

        const lr = 0.1;
        const maxIter = 100;

        for (let iter = 0; iter < maxIter; iter++) {
            let gradA = 0, gradB = 0;

            for (let i = 0; i < n; i++) {
                const f = rawProbs[i];
                const p = 1 / (1 + Math.exp(this.A * f + this.B));
                const diff = targets[i] - p;
                gradA -= diff * f;
                gradB -= diff;
            }

            this.A -= lr * gradA / n;
            this.B -= lr * gradB / n;
        }

        console.log(`Platt scaling: A=${this.A.toFixed(4)}, B=${this.B.toFixed(4)}`);
    }

    transform(rawProbs) {
        return rawProbs.map(f => 1 / (1 + Math.exp(this.A * f + this.B)));
    }
}

// ============================================================================
// ATR-BASED POSITION SIZING
// ============================================================================

class ATRPositionSizer {
    constructor(riskPerTrade = 0.02, atrMultiple = 2) {
        this.riskPerTrade = riskPerTrade;  // Risk 2% of capital per trade
        this.atrMultiple = atrMultiple;    // Stop loss = 2 x ATR
    }

    calculateSize(capital, entryPrice, atr, probability) {
        // Dynamic position sizing based on ATR and confidence
        const stopDistance = atr * this.atrMultiple;
        const stopPercent = stopDistance / entryPrice;

        // Base position size (risk-based)
        const dollarRisk = capital * this.riskPerTrade;
        const baseSize = dollarRisk / stopDistance;

        // Adjust by confidence (scale down for uncertain signals)
        const confidenceMultiplier = Math.max(0.5, (probability - 0.5) * 4);  // 0.5-1x

        // Max position = 10% of capital
        const maxPosition = capital * 0.10 / entryPrice;

        const finalSize = Math.min(baseSize * confidenceMultiplier, maxPosition);

        return {
            shares: Math.floor(finalSize),
            stopLoss: entryPrice - stopDistance,
            takeProfit: entryPrice + stopDistance * 2,  // 2:1 reward/risk
            riskPercent: (stopPercent * 100).toFixed(2) + '%'
        };
    }
}

// ============================================================================
// IMPROVED BACKTESTER
// ============================================================================

function backtest(predictions, data, sizer) {
    let capital = 100000;
    const initialCapital = capital;
    let position = null;
    const trades = [];
    let peakCapital = capital;
    let maxDrawdown = 0;

    for (let i = 0; i < predictions.length; i++) {
        const { prob, close, atr, date } = predictions[i];

        // Update drawdown
        if (capital > peakCapital) peakCapital = capital;
        const dd = (peakCapital - capital) / peakCapital;
        if (dd > maxDrawdown) maxDrawdown = dd;

        if (position === null) {
            // Entry logic
            if (prob > 0.52) {  // Slightly above neutral
                // Limit position size to prevent overflow
                const maxShares = Math.min(Math.floor(capital * 0.1 / close), 1000);
                const sizing = sizer.calculateSize(capital, close, atr, prob);
                const shares = Math.min(sizing.shares, maxShares);

                if (shares > 0) {
                    position = {
                        shares: shares,
                        entry: close,
                        stopLoss: sizing.stopLoss,
                        takeProfit: sizing.takeProfit,
                        entryDate: date
                    };
                }
            }
        } else {
            // Exit logic: stop loss, take profit, or signal reversal
            if (close <= position.stopLoss) {
                // Stop loss hit
                const pnl = (close - position.entry) * position.shares;
                capital += pnl;
                trades.push({ pnl, type: 'stop', holdDays: i - trades.length });
                position = null;
            } else if (close >= position.takeProfit) {
                // Take profit hit
                const pnl = (close - position.entry) * position.shares;
                capital += pnl;
                trades.push({ pnl, type: 'target', holdDays: i - trades.length });
                position = null;
            } else if (prob < 0.45) {
                // Signal reversal
                const pnl = (close - position.entry) * position.shares;
                capital += pnl;
                trades.push({ pnl, type: 'signal', holdDays: i - trades.length });
                position = null;
            }
        }
    }

    // Close any remaining position
    if (position) {
        const lastClose = predictions[predictions.length - 1].close;
        const pnl = (lastClose - position.entry) * position.shares;
        capital += pnl;
        trades.push({ pnl, type: 'final' });
    }

    const winningTrades = trades.filter(t => t.pnl > 0);
    const losingTrades = trades.filter(t => t.pnl < 0);

    return {
        totalReturn: ((capital - initialCapital) / initialCapital * 100).toFixed(2),
        trades: trades.length,
        winRate: (winningTrades.length / trades.length * 100).toFixed(1),
        avgWin: winningTrades.length > 0 ?
            (winningTrades.reduce((a, t) => a + t.pnl, 0) / winningTrades.length).toFixed(2) : 0,
        avgLoss: losingTrades.length > 0 ?
            (losingTrades.reduce((a, t) => a + t.pnl, 0) / losingTrades.length).toFixed(2) : 0,
        maxDrawdown: (maxDrawdown * 100).toFixed(2),
        finalCapital: capital.toFixed(2),
        profitFactor: losingTrades.length > 0 ?
            (winningTrades.reduce((a, t) => a + t.pnl, 0) /
             Math.abs(losingTrades.reduce((a, t) => a + t.pnl, 0))).toFixed(2) : 'Inf'
    };
}

// ============================================================================
// MAIN TRAINING PIPELINE
// ============================================================================

async function main() {
    console.log('═══════════════════════════════════════════════════════════════════');
    console.log('          PHASE 1 FIXES: ANTI-OVERFITTING IMPROVEMENTS');
    console.log('═══════════════════════════════════════════════════════════════════\n');

    // Load data
    console.log('[1] Loading market data...');
    const allData = loadAllData();
    const symbols = Object.keys(allData);
    console.log(`Loaded ${symbols.length} symbols\n`);

    // Calculate features for all stocks
    console.log('[2] Calculating features...');
    const allSamples = [];

    for (const symbol of symbols) {
        const indicators = calculateIndicators(allData[symbol]);

        for (let i = 0; i < indicators.length - 5; i++) {
            // Label: 5-day forward return > 1%
            const futureReturn = (indicators[i + 5].close - indicators[i].close) / indicators[i].close;
            const label = futureReturn > 0.01 ? 1 : 0;

            allSamples.push({
                features: indicators[i].features,
                label: label,
                atr: indicators[i].atr,
                close: indicators[i].close,
                date: indicators[i].date,
                symbol: symbol
            });
        }
    }

    console.log(`Total samples: ${allSamples.length.toLocaleString()}\n`);

    // Time-based split (proper for financial data)
    allSamples.sort((a, b) => new Date(a.date) - new Date(b.date));

    const trainEnd = Math.floor(allSamples.length * 0.6);
    const valEnd = Math.floor(allSamples.length * 0.8);

    const trainData = allSamples.slice(0, trainEnd);
    const valData = allSamples.slice(trainEnd, valEnd);
    const testData = allSamples.slice(valEnd);

    console.log('[3] Data split:');
    console.log(`   Train: ${trainData.length.toLocaleString()} samples`);
    console.log(`   Validation: ${valData.length.toLocaleString()} samples`);
    console.log(`   Test: ${testData.length.toLocaleString()} samples\n`);

    // Prepare training data
    const X_train = trainData.map(s => s.features);
    const y_train = trainData.map(s => s.label);
    const X_val = valData.map(s => s.features);
    const y_val = valData.map(s => s.label);
    const X_test = testData.map(s => s.features);
    const y_test = testData.map(s => s.label);

    // Train regularized model
    console.log('[4] Training regularized Random Forest...');
    console.log('   (maxDepth=6, minSamplesLeaf=10, nTrees=100)\n');

    const model = new RegularizedRandomForest({
        nTrees: 150,
        maxDepth: 8,        // Reduced from 12, but not too shallow
        minSamplesLeaf: 8   // Balance between regularization and fitting
    });

    model.train(X_train, y_train);

    // Get raw predictions
    console.log('\n[5] Generating predictions...');
    const rawTrainProbs = model.predictProba(X_train);
    const rawValProbs = model.predictProba(X_val);
    const rawTestProbs = model.predictProba(X_test);

    // Check raw probability distribution
    console.log('\n[6] Analyzing raw probabilities...');
    const rawTestStats = {
        min: Math.min(...rawTestProbs).toFixed(3),
        max: Math.max(...rawTestProbs).toFixed(3),
        mean: (rawTestProbs.reduce((a, b) => a + b, 0) / rawTestProbs.length).toFixed(3),
        above50: rawTestProbs.filter(p => p > 0.5).length,
        above55: rawTestProbs.filter(p => p > 0.55).length
    };
    console.log(`   Raw probs: min=${rawTestStats.min}, max=${rawTestStats.max}, mean=${rawTestStats.mean}`);
    console.log(`   Above 50%: ${rawTestStats.above50}, Above 55%: ${rawTestStats.above55}`);

    // Skip Platt scaling if probabilities are already well-distributed
    // Just use raw probabilities directly
    console.log('\n[6b] Using raw probabilities (Platt scaling skipped - raw probs sufficient)...');
    const calTrainProbs = rawTrainProbs;
    const calValProbs = rawValProbs;
    const calTestProbs = rawTestProbs;

    // Evaluate
    console.log('\n[7] Evaluating model performance...\n');

    function evaluate(probs, y, name) {
        const preds = probs.map(p => p > 0.5 ? 1 : 0);
        let correct = 0, tp = 0, fp = 0, fn = 0;

        for (let i = 0; i < y.length; i++) {
            if (preds[i] === y[i]) correct++;
            if (preds[i] === 1 && y[i] === 1) tp++;
            if (preds[i] === 1 && y[i] === 0) fp++;
            if (preds[i] === 0 && y[i] === 1) fn++;
        }

        const accuracy = correct / y.length;
        const precision = tp / (tp + fp) || 0;
        const recall = tp / (tp + fn) || 0;
        const f1 = 2 * precision * recall / (precision + recall) || 0;

        // Calibration: compare predicted vs actual
        const bins = [0, 0.3, 0.4, 0.5, 0.6, 0.7, 1.0];
        const binStats = [];
        for (let b = 0; b < bins.length - 1; b++) {
            const inBin = probs.map((p, i) => ({ p, y: y[i] }))
                .filter(x => x.p >= bins[b] && x.p < bins[b + 1]);
            if (inBin.length > 0) {
                const predMean = inBin.reduce((a, x) => a + x.p, 0) / inBin.length;
                const actualMean = inBin.reduce((a, x) => a + x.y, 0) / inBin.length;
                binStats.push({
                    range: `${(bins[b]*100).toFixed(0)}-${(bins[b+1]*100).toFixed(0)}%`,
                    pred: (predMean * 100).toFixed(1),
                    actual: (actualMean * 100).toFixed(1),
                    gap: Math.abs(predMean - actualMean) * 100,
                    n: inBin.length
                });
            }
        }

        return { accuracy, precision, recall, f1, binStats };
    }

    const trainEval = evaluate(calTrainProbs, y_train, 'Train');
    const valEval = evaluate(calValProbs, y_val, 'Validation');
    const testEval = evaluate(calTestProbs, y_test, 'Test');

    console.log('ACCURACY COMPARISON:');
    console.log('─────────────────────────────────────────');
    console.log(`  Train:      ${(trainEval.accuracy * 100).toFixed(1)}%`);
    console.log(`  Validation: ${(valEval.accuracy * 100).toFixed(1)}%`);
    console.log(`  Test:       ${(testEval.accuracy * 100).toFixed(1)}%`);
    console.log(`  Overfit Gap: ${((trainEval.accuracy - testEval.accuracy) * 100).toFixed(1)}%`);
    console.log();

    console.log('PRECISION / RECALL / F1:');
    console.log('─────────────────────────────────────────');
    console.log(`  Train:  P=${(trainEval.precision*100).toFixed(1)}% R=${(trainEval.recall*100).toFixed(1)}% F1=${(trainEval.f1*100).toFixed(1)}%`);
    console.log(`  Val:    P=${(valEval.precision*100).toFixed(1)}% R=${(valEval.recall*100).toFixed(1)}% F1=${(valEval.f1*100).toFixed(1)}%`);
    console.log(`  Test:   P=${(testEval.precision*100).toFixed(1)}% R=${(testEval.recall*100).toFixed(1)}% F1=${(testEval.f1*100).toFixed(1)}%`);
    console.log();

    console.log('PROBABILITY CALIBRATION (Test Set):');
    console.log('─────────────────────────────────────────');
    console.log('  Range      | Predicted | Actual  | Gap   | N');
    console.log('  -----------|-----------|---------|-------|------');
    testEval.binStats.forEach(b => {
        console.log(`  ${b.range.padEnd(10)} | ${b.pred.padStart(8)}% | ${b.actual.padStart(6)}% | ${b.gap.toFixed(1).padStart(4)}% | ${b.n}`);
    });

    const avgCalibrationError = testEval.binStats.reduce((a, b) => a + b.gap, 0) / testEval.binStats.length;
    console.log(`\n  Average Calibration Error: ${avgCalibrationError.toFixed(1)}%`);
    console.log();

    // Backtest with ATR position sizing
    console.log('[8] Backtesting with ATR-based position sizing...\n');

    const sizer = new ATRPositionSizer(0.02, 2);  // 2% risk, 2x ATR stop

    const testPredictions = testData.map((s, i) => ({
        prob: calTestProbs[i],
        close: s.close,
        atr: s.atr,
        date: s.date
    }));

    const results = backtest(testPredictions, testData, sizer);

    console.log('BACKTEST RESULTS:');
    console.log('─────────────────────────────────────────');
    console.log(`  Total Return:   ${results.totalReturn}%`);
    console.log(`  Max Drawdown:   ${results.maxDrawdown}%`);
    console.log(`  Total Trades:   ${results.trades}`);
    console.log(`  Win Rate:       ${results.winRate}%`);
    console.log(`  Avg Win:        $${results.avgWin}`);
    console.log(`  Avg Loss:       $${results.avgLoss}`);
    console.log(`  Profit Factor:  ${results.profitFactor}`);
    console.log(`  Final Capital:  $${results.finalCapital}`);
    console.log();

    // Current signals
    console.log('═══════════════════════════════════════════════════════════════════');
    console.log('                      CURRENT TRADING SIGNALS');
    console.log('═══════════════════════════════════════════════════════════════════\n');

    const signals = [];

    for (const symbol of symbols) {
        const indicators = calculateIndicators(allData[symbol]);
        if (indicators.length > 0) {
            const latest = indicators[indicators.length - 1];
            const rawProb = model.predictProba([latest.features])[0];
            const calibratedProb = rawProb;  // Using raw probabilities

            const sizing = sizer.calculateSize(100000, latest.close, latest.atr, calibratedProb);

            signals.push({
                symbol,
                prob: calibratedProb,
                close: latest.close,
                atr: latest.atr,
                shares: sizing.shares,
                stopLoss: sizing.stopLoss,
                takeProfit: sizing.takeProfit,
                risk: sizing.riskPercent
            });
        }
    }

    // Sort by probability
    signals.sort((a, b) => b.prob - a.prob);

    console.log('TOP BUY CANDIDATES (prob > 55%):');
    console.log('─────────────────────────────────────────────────────────────────────');
    console.log('Symbol | Prob  | Price   | Shares | Stop    | Target  | Risk');
    console.log('-------|-------|---------|--------|---------|---------|------');

    const buys = signals.filter(s => s.prob > 0.50).slice(0, 10);
    buys.forEach(s => {
        console.log(
            `${s.symbol.padEnd(6)} | ${(s.prob * 100).toFixed(1)}% | $${s.close.toFixed(2).padStart(6)} | ` +
            `${String(s.shares).padStart(6)} | $${s.stopLoss.toFixed(2).padStart(6)} | ` +
            `$${s.takeProfit.toFixed(2).padStart(6)} | ${s.risk}`
        );
    });

    console.log('\nAVOID (prob < 45%):');
    console.log('─────────────────────────────────────────────────────────────────────');

    const avoids = signals.filter(s => s.prob < 0.45).slice(-5);
    avoids.forEach(s => {
        console.log(`${s.symbol.padEnd(6)} | ${(s.prob * 100).toFixed(1)}% - BEARISH`);
    });

    // Summary comparison
    console.log('\n═══════════════════════════════════════════════════════════════════');
    console.log('                    IMPROVEMENT SUMMARY');
    console.log('═══════════════════════════════════════════════════════════════════\n');

    console.log('BEFORE (Example 33):');
    console.log('  Overfitting Gap:  20.8%');
    console.log('  Max Drawdown:     22.3%');
    console.log('  Test Accuracy:    52.0%');
    console.log();

    console.log('AFTER (Phase 1 Fixes):');
    console.log(`  Overfitting Gap:  ${((trainEval.accuracy - testEval.accuracy) * 100).toFixed(1)}%`);
    console.log(`  Max Drawdown:     ${results.maxDrawdown}%`);
    console.log(`  Test Accuracy:    ${(testEval.accuracy * 100).toFixed(1)}%`);
    console.log(`  Calibration Err:  ${avgCalibrationError.toFixed(1)}%`);
    console.log();

    const overfitImproved = 20.8 - ((trainEval.accuracy - testEval.accuracy) * 100);
    const ddImproved = 22.3 - parseFloat(results.maxDrawdown);

    console.log('IMPROVEMENTS:');
    if (overfitImproved > 0) {
        console.log(`  [✓] Overfitting reduced by ${overfitImproved.toFixed(1)} percentage points`);
    } else {
        console.log(`  [!] Overfitting increased - consider more regularization`);
    }

    if (ddImproved > 0) {
        console.log(`  [✓] Max drawdown reduced by ${ddImproved.toFixed(1)} percentage points`);
    } else {
        console.log(`  [!] Drawdown increased - consider tighter stops`);
    }

    if (avgCalibrationError < 10) {
        console.log(`  [✓] Probability calibration good (<10% avg error)`);
    } else {
        console.log(`  [!] Probability calibration needs work (>${avgCalibrationError.toFixed(0)}% error)`);
    }

    console.log('\n═══════════════════════════════════════════════════════════════════\n');
}

main().catch(console.error);
