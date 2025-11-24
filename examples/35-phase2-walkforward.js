/**
 * Example 35: Phase 2 - Walk-Forward Optimization with TensorFlow.js
 *
 * Implements:
 * 1. Walk-forward validation (rolling window training)
 * 2. TensorFlow.js neural network (GPU-accelerated when available)
 * 3. Ensemble of RF + NN models
 * 4. 93 symbols training universe
 */

const fs = require('fs');
const path = require('path');

// Try to load TensorFlow.js with GPU, fall back to CPU
let tf;
let gpuEnabled = false;
try {
    tf = require('@tensorflow/tfjs-node-gpu');
    gpuEnabled = true;
    console.log('[GPU] TensorFlow.js GPU backend enabled');
} catch (e) {
    try {
        tf = require('@tensorflow/tfjs-node');
        console.log('[CPU] TensorFlow.js Node backend enabled');
    } catch (e2) {
        tf = require('@tensorflow/tfjs');
        console.log('[CPU] TensorFlow.js pure JS backend (slower)');
    }
}

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
// TECHNICAL INDICATORS (Same as Phase 1)
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

        const sma20 = avg(slice.slice(-20));
        const sma50 = avg(slice.slice(-50));
        const ema12 = ema(slice, 12);
        const ema26 = ema(slice, 26);
        const rsi = calculateRSI(slice, 14);
        const macd = ema12 - ema26;
        const macdSignal = ema(slice.slice(-9).map(() => macd), 9);
        const atr = calculateATR(highSlice, lowSlice, slice, 14);
        const bbWidth = calculateBBWidth(slice, 20);
        const volumeRatio = volSlice[volSlice.length - 1] / avg(volSlice.slice(-20));
        const adx = calculateADX(highSlice, lowSlice, slice, 14);
        const ret1d = (closes[i] - closes[i - 1]) / closes[i - 1];
        const ret5d = (closes[i] - closes[i - 5]) / closes[i - 5];
        const ret20d = (closes[i] - closes[i - 20]) / closes[i - 20];

        result.push({
            date: data[i].date,
            close: closes[i],
            atr: atr,
            features: [
                closes[i] / sma20 - 1,
                closes[i] / sma50 - 1,
                sma20 / sma50 - 1,
                rsi / 100,
                macd / closes[i],
                (macd - macdSignal) / closes[i],
                atr / closes[i],
                bbWidth,
                Math.min(volumeRatio, 3) / 3,
                adx / 100,
                ret1d,
                ret5d,
                ret20d
            ]
        });
    }

    return result;
}

function avg(arr) { return arr.reduce((a, b) => a + b, 0) / arr.length; }

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
    return 100 - (100 / (1 + gains / losses));
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
// REGULARIZED RANDOM FOREST
// ============================================================================

class RegularizedRandomForest {
    constructor(options = {}) {
        this.nTrees = options.nTrees || 100;
        this.maxDepth = options.maxDepth || 8;
        this.minSamplesLeaf = options.minSamplesLeaf || 8;
        this.trees = [];
    }

    train(X, y) {
        this.trees = [];
        for (let t = 0; t < this.nTrees; t++) {
            const indices = [];
            for (let i = 0; i < X.length; i++) {
                indices.push(Math.floor(Math.random() * X.length));
            }
            const Xb = indices.map(i => X[i]);
            const yb = indices.map(i => y[i]);
            const tree = this.buildTree(Xb, yb, 0);
            this.trees.push(tree);
        }
    }

    buildTree(X, y, depth) {
        if (depth >= this.maxDepth || X.length < this.minSamplesLeaf * 2 || new Set(y).size === 1) {
            return { leaf: true, prob: y.filter(v => v === 1).length / y.length };
        }

        const nFeatures = X[0].length;
        const maxF = Math.ceil(Math.sqrt(nFeatures));
        const featureIndices = [];
        while (featureIndices.length < maxF) {
            const idx = Math.floor(Math.random() * nFeatures);
            if (!featureIndices.includes(idx)) featureIndices.push(idx);
        }

        let bestGain = -Infinity, bestSplit = null;

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

                if (leftIdx.length < this.minSamplesLeaf || rightIdx.length < this.minSamplesLeaf) continue;

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
            left: this.buildTree(bestSplit.leftIdx.map(i => X[i]), bestSplit.leftIdx.map(i => y[i]), depth + 1),
            right: this.buildTree(bestSplit.rightIdx.map(i => X[i]), bestSplit.rightIdx.map(i => y[i]), depth + 1)
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
// TENSORFLOW.JS NEURAL NETWORK
// ============================================================================

class TFNeuralNetwork {
    constructor(inputDim) {
        this.inputDim = inputDim;
        this.model = null;
    }

    async build() {
        this.model = tf.sequential();

        // Input layer + hidden layers with dropout (regularization)
        this.model.add(tf.layers.dense({
            inputShape: [this.inputDim],
            units: 64,
            activation: 'relu',
            kernelRegularizer: tf.regularizers.l2({ l2: 0.01 })
        }));
        this.model.add(tf.layers.dropout({ rate: 0.3 }));

        this.model.add(tf.layers.dense({
            units: 32,
            activation: 'relu',
            kernelRegularizer: tf.regularizers.l2({ l2: 0.01 })
        }));
        this.model.add(tf.layers.dropout({ rate: 0.2 }));

        this.model.add(tf.layers.dense({
            units: 16,
            activation: 'relu'
        }));

        // Output layer
        this.model.add(tf.layers.dense({
            units: 1,
            activation: 'sigmoid'
        }));

        this.model.compile({
            optimizer: tf.train.adam(0.001),
            loss: 'binaryCrossentropy',
            metrics: ['accuracy']
        });
    }

    async train(X, y, epochs = 30, batchSize = 64) {
        // Normalize features to prevent NaN
        const normalizedX = X.map(row => row.map(v => {
            if (!isFinite(v)) return 0;
            return Math.max(-10, Math.min(10, v));  // Clip extreme values
        }));

        const xs = tf.tensor2d(normalizedX);
        const ys = tf.tensor2d(y.map(v => [v]));

        await this.model.fit(xs, ys, {
            epochs: epochs,
            batchSize: batchSize,
            validationSplit: 0.2,
            verbose: 0,
            callbacks: {
                onEpochEnd: (epoch, logs) => {
                    if ((epoch + 1) % 10 === 0) {
                        process.stdout.write(`  Epoch ${epoch + 1}: loss=${logs.loss.toFixed(4)}, acc=${logs.acc.toFixed(4)}\r`);
                    }
                }
            }
        });
        console.log();

        xs.dispose();
        ys.dispose();
    }

    predict(X) {
        // Normalize features same as training
        const normalizedX = X.map(row => row.map(v => {
            if (!isFinite(v)) return 0;
            return Math.max(-10, Math.min(10, v));
        }));

        const xs = tf.tensor2d(normalizedX);
        const predictions = this.model.predict(xs);
        const result = Array.from(predictions.dataSync()).map(v => isFinite(v) ? v : 0.5);
        xs.dispose();
        predictions.dispose();
        return result;
    }

    dispose() {
        if (this.model) {
            this.model.dispose();
        }
    }
}

// ============================================================================
// WALK-FORWARD VALIDATION
// ============================================================================

async function walkForwardValidation(samples, windowSize = 252 * 2, stepSize = 63) {
    console.log('\nWalk-Forward Validation:');
    console.log(`  Window size: ${windowSize} days (~2 years)`);
    console.log(`  Step size: ${stepSize} days (~1 quarter)`);
    console.log(`  Total samples: ${samples.length}\n`);

    const results = [];
    let step = 0;

    for (let start = 0; start + windowSize + stepSize < samples.length; start += stepSize) {
        const trainEnd = start + windowSize;
        const testEnd = Math.min(trainEnd + stepSize, samples.length);

        const trainData = samples.slice(start, trainEnd);
        const testData = samples.slice(trainEnd, testEnd);

        const X_train = trainData.map(s => s.features);
        const y_train = trainData.map(s => s.label);
        const X_test = testData.map(s => s.features);
        const y_test = testData.map(s => s.label);

        // Train Random Forest
        const rf = new RegularizedRandomForest({ nTrees: 80, maxDepth: 8 });
        rf.train(X_train, y_train);

        // Train Neural Network
        const nn = new TFNeuralNetwork(X_train[0].length);
        await nn.build();
        await nn.train(X_train, y_train, 20, 64);

        // Ensemble predictions (use RF only if NN produces NaN)
        const rfProbs = rf.predictProba(X_test);
        const nnProbs = nn.predict(X_test);
        const ensembleProbs = rfProbs.map((p, i) => {
            const nnP = nnProbs[i];
            if (!isFinite(nnP)) return p;  // Use RF only if NN fails
            return 0.6 * p + 0.4 * nnP;
        });

        // Evaluate
        const preds = ensembleProbs.map(p => p > 0.5 ? 1 : 0);
        const correct = preds.filter((p, i) => p === y_test[i]).length;
        const accuracy = correct / y_test.length;

        const startDate = trainData[0].date;
        const endDate = testData[testData.length - 1].date;

        results.push({
            step: step++,
            startDate,
            endDate,
            trainSize: trainData.length,
            testSize: testData.length,
            accuracy
        });

        console.log(`  Step ${step}: ${startDate.substring(0, 10)} → ${endDate.substring(0, 10)} | Acc: ${(accuracy * 100).toFixed(1)}%`);

        nn.dispose();

        // Limit to 8 steps for demo
        if (step >= 8) break;
    }

    const avgAccuracy = results.reduce((a, r) => a + r.accuracy, 0) / results.length;
    console.log(`\n  Average Walk-Forward Accuracy: ${(avgAccuracy * 100).toFixed(1)}%`);

    return { results, avgAccuracy };
}

// ============================================================================
// ATR POSITION SIZER
// ============================================================================

class ATRPositionSizer {
    constructor(riskPerTrade = 0.02, atrMultiple = 2) {
        this.riskPerTrade = riskPerTrade;
        this.atrMultiple = atrMultiple;
    }

    calculateSize(capital, entryPrice, atr, probability) {
        const stopDistance = atr * this.atrMultiple;
        const dollarRisk = capital * this.riskPerTrade;
        const baseSize = dollarRisk / stopDistance;
        const confidenceMultiplier = Math.max(0.5, (probability - 0.5) * 4);
        const maxPosition = capital * 0.10 / entryPrice;
        const finalSize = Math.min(baseSize * confidenceMultiplier, maxPosition);

        return {
            shares: Math.floor(Math.min(finalSize, 1000)),
            stopLoss: entryPrice - stopDistance,
            takeProfit: entryPrice + stopDistance * 2,
            riskPercent: ((stopDistance / entryPrice) * 100).toFixed(2) + '%'
        };
    }
}

// ============================================================================
// BACKTEST
// ============================================================================

function backtest(predictions, sizer) {
    let capital = 100000;
    const initialCapital = capital;
    let position = null;
    const trades = [];
    let peakCapital = capital;
    let maxDrawdown = 0;

    for (let i = 0; i < predictions.length; i++) {
        const { prob, close, atr } = predictions[i];

        if (capital > peakCapital) peakCapital = capital;
        const dd = (peakCapital - capital) / peakCapital;
        if (dd > maxDrawdown) maxDrawdown = dd;

        if (position === null) {
            if (prob > 0.52) {
                const sizing = sizer.calculateSize(capital, close, atr, prob);
                if (sizing.shares > 0) {
                    position = {
                        shares: sizing.shares,
                        entry: close,
                        stopLoss: sizing.stopLoss,
                        takeProfit: sizing.takeProfit
                    };
                }
            }
        } else {
            if (close <= position.stopLoss) {
                const pnl = (close - position.entry) * position.shares;
                capital += pnl;
                trades.push({ pnl, type: 'stop' });
                position = null;
            } else if (close >= position.takeProfit) {
                const pnl = (close - position.entry) * position.shares;
                capital += pnl;
                trades.push({ pnl, type: 'target' });
                position = null;
            } else if (prob < 0.45) {
                const pnl = (close - position.entry) * position.shares;
                capital += pnl;
                trades.push({ pnl, type: 'signal' });
                position = null;
            }
        }
    }

    if (position) {
        const lastClose = predictions[predictions.length - 1].close;
        const pnl = (lastClose - position.entry) * position.shares;
        capital += pnl;
        trades.push({ pnl, type: 'final' });
    }

    const winning = trades.filter(t => t.pnl > 0);
    const losing = trades.filter(t => t.pnl < 0);

    return {
        totalReturn: ((capital - initialCapital) / initialCapital * 100).toFixed(2),
        maxDrawdown: (maxDrawdown * 100).toFixed(2),
        trades: trades.length,
        winRate: trades.length > 0 ? (winning.length / trades.length * 100).toFixed(1) : 'N/A',
        profitFactor: losing.length > 0 ?
            (winning.reduce((a, t) => a + t.pnl, 0) / Math.abs(losing.reduce((a, t) => a + t.pnl, 0))).toFixed(2) : 'Inf',
        finalCapital: capital.toFixed(2)
    };
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
    console.log('═══════════════════════════════════════════════════════════════════');
    console.log('     PHASE 2: WALK-FORWARD OPTIMIZATION + TENSORFLOW.JS');
    console.log('═══════════════════════════════════════════════════════════════════\n');
    console.log(`Backend: ${gpuEnabled ? 'GPU' : 'CPU'}\n`);

    // Load data
    console.log('[1] Loading market data...');
    const allData = loadAllData();
    const symbols = Object.keys(allData);
    console.log(`Loaded ${symbols.length} symbols\n`);

    // Calculate features
    console.log('[2] Calculating features...');
    const allSamples = [];

    for (const symbol of symbols) {
        const indicators = calculateIndicators(allData[symbol]);
        for (let i = 0; i < indicators.length - 5; i++) {
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

    // Sort by date
    allSamples.sort((a, b) => new Date(a.date) - new Date(b.date));
    console.log(`Total samples: ${allSamples.length.toLocaleString()}\n`);

    // Walk-forward validation
    console.log('[3] Running walk-forward validation...');
    const walkForward = await walkForwardValidation(allSamples, 252 * 2, 63);

    // Final model training on recent data
    console.log('\n[4] Training final ensemble model...');
    const trainEnd = Math.floor(allSamples.length * 0.8);
    const trainData = allSamples.slice(0, trainEnd);
    const testData = allSamples.slice(trainEnd);

    console.log(`   Train: ${trainData.length.toLocaleString()} samples`);
    console.log(`   Test: ${testData.length.toLocaleString()} samples\n`);

    const X_train = trainData.map(s => s.features);
    const y_train = trainData.map(s => s.label);
    const X_test = testData.map(s => s.features);
    const y_test = testData.map(s => s.label);

    // Random Forest
    console.log('   Training Random Forest...');
    const rf = new RegularizedRandomForest({ nTrees: 150, maxDepth: 8 });
    rf.train(X_train, y_train);

    // Neural Network
    console.log('   Training Neural Network...');
    const nn = new TFNeuralNetwork(X_train[0].length);
    await nn.build();
    await nn.train(X_train, y_train, 30, 64);

    // Ensemble
    console.log('\n[5] Generating ensemble predictions...');
    const rfProbs = rf.predictProba(X_test);
    const nnProbs = nn.predict(X_test);
    const ensembleProbs = rfProbs.map((p, i) => {
        const nnP = nnProbs[i];
        if (!isFinite(nnP)) return p;  // Use RF only if NN fails
        return 0.6 * p + 0.4 * nnP;
    });

    // Evaluate
    const preds = ensembleProbs.map(p => p > 0.5 ? 1 : 0);
    let correct = 0, tp = 0, fp = 0, fn = 0;
    for (let i = 0; i < y_test.length; i++) {
        if (preds[i] === y_test[i]) correct++;
        if (preds[i] === 1 && y_test[i] === 1) tp++;
        if (preds[i] === 1 && y_test[i] === 0) fp++;
        if (preds[i] === 0 && y_test[i] === 1) fn++;
    }

    const accuracy = correct / y_test.length;
    const precision = tp / (tp + fp) || 0;
    const recall = tp / (tp + fn) || 0;
    const f1 = 2 * precision * recall / (precision + recall) || 0;

    console.log('\nFINAL MODEL METRICS:');
    console.log('─────────────────────────────────────────');
    console.log(`  Test Accuracy:  ${(accuracy * 100).toFixed(1)}%`);
    console.log(`  Precision:      ${(precision * 100).toFixed(1)}%`);
    console.log(`  Recall:         ${(recall * 100).toFixed(1)}%`);
    console.log(`  F1 Score:       ${(f1 * 100).toFixed(1)}%`);
    console.log(`  Walk-Forward:   ${(walkForward.avgAccuracy * 100).toFixed(1)}%`);

    // Backtest
    console.log('\n[6] Backtesting...');
    const sizer = new ATRPositionSizer(0.02, 2);
    const testPredictions = testData.map((s, i) => ({
        prob: ensembleProbs[i],
        close: s.close,
        atr: s.atr
    }));

    const results = backtest(testPredictions, sizer);

    console.log('\nBACKTEST RESULTS:');
    console.log('─────────────────────────────────────────');
    console.log(`  Total Return:   ${results.totalReturn}%`);
    console.log(`  Max Drawdown:   ${results.maxDrawdown}%`);
    console.log(`  Total Trades:   ${results.trades}`);
    console.log(`  Win Rate:       ${results.winRate}%`);
    console.log(`  Profit Factor:  ${results.profitFactor}`);

    // Current signals
    console.log('\n═══════════════════════════════════════════════════════════════════');
    console.log('                      CURRENT TRADING SIGNALS');
    console.log('═══════════════════════════════════════════════════════════════════\n');

    const signals = [];
    for (const symbol of symbols) {
        const indicators = calculateIndicators(allData[symbol]);
        if (indicators.length > 0) {
            const latest = indicators[indicators.length - 1];
            const rfProb = rf.predictProba([latest.features])[0];
            const nnProb = nn.predict([latest.features])[0];
            const prob = isFinite(nnProb) ? 0.6 * rfProb + 0.4 * nnProb : rfProb;

            signals.push({
                symbol,
                prob,
                rfProb,
                nnProb,
                close: latest.close,
                atr: latest.atr
            });
        }
    }

    signals.sort((a, b) => b.prob - a.prob);

    console.log('TOP BUY CANDIDATES:');
    console.log('─────────────────────────────────────────────────────────────────────');
    console.log('Symbol          | Ensemble | RF     | NN     | Price');
    console.log('----------------|----------|--------|--------|--------');

    signals.slice(0, 12).forEach(s => {
        const action = s.prob > 0.55 ? 'BUY' : s.prob > 0.50 ? 'watch' : '';
        console.log(
            `${s.symbol.padEnd(15)} | ${(s.prob * 100).toFixed(1).padStart(6)}% | ` +
            `${(s.rfProb * 100).toFixed(1).padStart(5)}% | ${(s.nnProb * 100).toFixed(1).padStart(5)}% | ` +
            `$${s.close.toFixed(2).padStart(7)} ${action}`
        );
    });

    console.log('\nAVOID (Bearish):');
    console.log('─────────────────────────────────────────────────────────────────────');
    signals.slice(-5).forEach(s => {
        console.log(`${s.symbol.padEnd(15)} | ${(s.prob * 100).toFixed(1)}%`);
    });

    // Comparison
    console.log('\n═══════════════════════════════════════════════════════════════════');
    console.log('                    PHASE 2 vs PHASE 1 COMPARISON');
    console.log('═══════════════════════════════════════════════════════════════════\n');

    console.log('PHASE 1 (34-phase1-fixes.js):');
    console.log('  Symbols:        46');
    console.log('  Test Accuracy:  58.3%');
    console.log('  Overfit Gap:    5.1%');
    console.log('  Max Drawdown:   20.66%');
    console.log();

    console.log('PHASE 2 (This run):');
    console.log(`  Symbols:        ${symbols.length}`);
    console.log(`  Test Accuracy:  ${(accuracy * 100).toFixed(1)}%`);
    console.log(`  Walk-Forward:   ${(walkForward.avgAccuracy * 100).toFixed(1)}%`);
    console.log(`  Max Drawdown:   ${results.maxDrawdown}%`);
    console.log(`  Backend:        ${gpuEnabled ? 'GPU' : 'CPU'}`);

    nn.dispose();
    console.log('\n═══════════════════════════════════════════════════════════════════\n');
}

main().catch(console.error);
