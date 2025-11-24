/**
 * Multi-Stock Neural Trainer
 *
 * Trains on ALL available stocks for more robust predictions.
 * More data = better generalization = less overfitting
 */

const fs = require('fs');
const path = require('path');

console.log('=== Multi-Stock Neural Trainer ===\n');

// ============================================
// LOAD ALL STOCK DATA
// ============================================

const dataDir = path.join(__dirname, '../historical-data');
const symbols = ['AAPL', 'MSFT', 'GOOGL', 'SPY', 'QQQ'];
const allStockData = {};

console.log('Loading stock data...');
for (const sym of symbols) {
    const filePath = path.join(dataDir, `${sym}-5-years.json`);
    if (fs.existsSync(filePath)) {
        allStockData[sym] = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        console.log(`  ${sym}: ${allStockData[sym].length} days`);
    }
}
console.log(`\nLoaded ${Object.keys(allStockData).length} stocks\n`);

// ============================================
// INDICATORS
// ============================================

function sma(prices, period) {
    return prices.map((_, i) => i < period - 1 ? null :
        prices.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0) / period);
}

function ema(prices, period) {
    const result = [], mult = 2 / (period + 1);
    let e = prices[0];
    for (let i = 0; i < prices.length; i++) {
        e = i === 0 ? prices[0] : (prices[i] - e) * mult + e;
        result.push(e);
    }
    return result;
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

function macd(prices) {
    const ema12 = ema(prices, 12), ema26 = ema(prices, 26);
    const line = ema12.map((v, i) => v - ema26[i]);
    const signal = ema(line, 9);
    return { histogram: line.map((v, i) => v - signal[i]) };
}

function bollingerBands(prices, period = 20) {
    const middle = sma(prices, period);
    const percentB = [], width = [];
    for (let i = 0; i < prices.length; i++) {
        if (i < period - 1) {
            percentB.push(null);
            width.push(null);
        } else {
            const slice = prices.slice(i - period + 1, i + 1);
            const variance = slice.reduce((sum, p) => sum + Math.pow(p - middle[i], 2), 0) / period;
            const std = Math.sqrt(variance);
            const upper = middle[i] + 2 * std;
            const lower = middle[i] - 2 * std;
            percentB.push((prices[i] - lower) / (upper - lower));
            width.push((upper - lower) / middle[i]);
        }
    }
    return { percentB, width };
}

function atr(data, period = 14) {
    const result = new Array(data.length).fill(null);
    for (let i = period; i < data.length; i++) {
        let sum = 0;
        for (let j = i - period + 1; j <= i; j++) {
            const high = data[j].high || data[j].close;
            const low = data[j].low || data[j].close;
            const prevClose = data[j - 1].close;
            sum += Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose));
        }
        result[i] = sum / period;
    }
    return result;
}

function stochastic(data, period = 14) {
    const result = new Array(data.length).fill(null);
    for (let i = period - 1; i < data.length; i++) {
        const slice = data.slice(i - period + 1, i + 1);
        const high = Math.max(...slice.map(d => d.high || d.close));
        const low = Math.min(...slice.map(d => d.low || d.close));
        result[i] = ((data[i].close - low) / (high - low)) * 100;
    }
    return result;
}

// ============================================
// CREATE FEATURES FOR ALL STOCKS
// ============================================

function createFeaturesForStock(data, symbol, horizon = 10, threshold = 1.0) {
    const prices = data.map(d => d.close);
    const sma10 = sma(prices, 10);
    const sma20 = sma(prices, 20);
    const sma50 = sma(prices, 50);
    const sma200 = sma(prices, 200);
    const { histogram } = macd(prices);
    const rsiValues = rsi(prices);
    const rsi7 = rsi(prices, 7);
    const { percentB, width } = bollingerBands(prices);
    const atrValues = atr(data);
    const stochValues = stochastic(data);

    const features = [];
    const labels = [];
    const metadata = [];

    for (let i = 200; i < prices.length - horizon; i++) {
        if (!sma200[i] || !rsiValues[i] || !percentB[i]) continue;

        // 15 features (normalized, stock-agnostic)
        features.push([
            // Trend (relative, not absolute prices)
            (prices[i] - sma10[i]) / sma10[i],
            (prices[i] - sma20[i]) / sma20[i],
            (prices[i] - sma50[i]) / sma50[i],
            (prices[i] - sma200[i]) / sma200[i],
            (sma10[i] - sma20[i]) / sma20[i],
            (sma20[i] - sma50[i]) / sma50[i],
            (sma50[i] - sma200[i]) / sma200[i],

            // Momentum
            rsiValues[i] / 100,
            (rsi7[i] || 50) / 100,
            histogram[i] / prices[i] * 100,
            (stochValues[i] || 50) / 100,

            // Volatility
            percentB[i],
            width[i] * 10,
            atrValues[i] / prices[i] * 100,

            // Recent returns
            (prices[i] - prices[i-5]) / prices[i-5],
        ]);

        // Label
        const futureReturn = (prices[i + horizon] - prices[i]) / prices[i] * 100;
        labels.push(futureReturn > threshold ? 1 : 0);

        metadata.push({ symbol, date: data[i].date, price: prices[i], idx: i });
    }

    return { features, labels, metadata };
}

// ============================================
// COMBINE ALL STOCK DATA
// ============================================

console.log('═══════════════════════════════════════════════════════════');
console.log('CREATING COMBINED DATASET');
console.log('═══════════════════════════════════════════════════════════\n');

const horizon = 10;
const threshold = 1.0;

let allFeatures = [];
let allLabels = [];
let allMetadata = [];

for (const [symbol, data] of Object.entries(allStockData)) {
    const { features, labels, metadata } = createFeaturesForStock(data, symbol, horizon, threshold);
    console.log(`  ${symbol}: ${features.length} samples (${(labels.filter(l => l === 1).length / labels.length * 100).toFixed(0)}% positive)`);
    allFeatures = allFeatures.concat(features);
    allLabels = allLabels.concat(labels);
    allMetadata = allMetadata.concat(metadata);
}

console.log(`\nTotal samples: ${allFeatures.length}`);
console.log(`Positive rate: ${(allLabels.filter(l => l === 1).length / allLabels.length * 100).toFixed(1)}%\n`);

// ============================================
// RANDOM FOREST (Multi-Stock)
// ============================================

class RandomForest {
    constructor(numTrees = 20, maxDepth = 8) {
        this.numTrees = numTrees;
        this.maxDepth = maxDepth;
        this.trees = [];
    }

    buildTree(features, labels, depth = 0) {
        if (depth >= this.maxDepth || labels.length < 20) {
            return { leaf: true, value: labels.reduce((a, b) => a + b, 0) / labels.length };
        }

        const numFeatures = Math.floor(Math.sqrt(features[0].length));
        const selectedFeatures = [];
        while (selectedFeatures.length < numFeatures) {
            const f = Math.floor(Math.random() * features[0].length);
            if (!selectedFeatures.includes(f)) selectedFeatures.push(f);
        }

        let bestGain = -Infinity, bestSplit = null;

        for (const featureIdx of selectedFeatures) {
            const values = features.map(f => f[featureIdx]).sort((a, b) => a - b);
            const step = Math.max(1, Math.floor(values.length / 15));

            for (let i = step; i < values.length - step; i += step) {
                const threshold = values[i];
                const leftIdx = [], rightIdx = [];

                for (let j = 0; j < features.length; j++) {
                    if (features[j][featureIdx] <= threshold) leftIdx.push(j);
                    else rightIdx.push(j);
                }

                if (leftIdx.length < 10 || rightIdx.length < 10) continue;

                const leftMean = leftIdx.reduce((s, i) => s + labels[i], 0) / leftIdx.length;
                const rightMean = rightIdx.reduce((s, i) => s + labels[i], 0) / rightIdx.length;
                const gain = Math.abs(leftMean - rightMean) * Math.min(leftIdx.length, rightIdx.length);

                if (gain > bestGain) {
                    bestGain = gain;
                    bestSplit = {
                        featureIdx, threshold,
                        leftFeatures: leftIdx.map(i => features[i]),
                        leftLabels: leftIdx.map(i => labels[i]),
                        rightFeatures: rightIdx.map(i => features[i]),
                        rightLabels: rightIdx.map(i => labels[i])
                    };
                }
            }
        }

        if (!bestSplit) {
            return { leaf: true, value: labels.reduce((a, b) => a + b, 0) / labels.length };
        }

        return {
            leaf: false,
            featureIdx: bestSplit.featureIdx,
            threshold: bestSplit.threshold,
            left: this.buildTree(bestSplit.leftFeatures, bestSplit.leftLabels, depth + 1),
            right: this.buildTree(bestSplit.rightFeatures, bestSplit.rightLabels, depth + 1)
        };
    }

    train(features, labels) {
        this.trees = [];
        for (let t = 0; t < this.numTrees; t++) {
            const indices = Array.from({length: features.length}, () =>
                Math.floor(Math.random() * features.length));
            this.trees.push(this.buildTree(
                indices.map(i => features[i]),
                indices.map(i => labels[i])
            ));
            if ((t + 1) % 5 === 0) process.stdout.write(`  Trees: ${t + 1}/${this.numTrees}\r`);
        }
        console.log(`  Trees: ${this.numTrees}/${this.numTrees} - Done!`);
    }

    predictTree(tree, feature) {
        if (tree.leaf) return tree.value;
        return feature[tree.featureIdx] <= tree.threshold ?
            this.predictTree(tree.left, feature) :
            this.predictTree(tree.right, feature);
    }

    predict(feature) {
        return this.trees.reduce((s, t) => s + this.predictTree(t, feature), 0) / this.trees.length;
    }
}

// ============================================
// TRAIN/TEST SPLIT (Time-based)
// ============================================

console.log('═══════════════════════════════════════════════════════════');
console.log('TRAINING MULTI-STOCK MODEL');
console.log('═══════════════════════════════════════════════════════════\n');

// Sort by date to ensure proper time-based split
const combined = allFeatures.map((f, i) => ({
    feature: f,
    label: allLabels[i],
    meta: allMetadata[i]
}));

// Group by symbol, then split each 70/30
const trainData = [], testData = [];

for (const symbol of symbols) {
    const symbolData = combined.filter(d => d.meta.symbol === symbol);
    const splitIdx = Math.floor(symbolData.length * 0.7);
    trainData.push(...symbolData.slice(0, splitIdx));
    testData.push(...symbolData.slice(splitIdx));
}

// Shuffle training data
for (let i = trainData.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [trainData[i], trainData[j]] = [trainData[j], trainData[i]];
}

const trainFeatures = trainData.map(d => d.feature);
const trainLabels = trainData.map(d => d.label);
const testFeatures = testData.map(d => d.feature);
const testLabels = testData.map(d => d.label);
const testMeta = testData.map(d => d.meta);

console.log(`Training samples: ${trainFeatures.length}`);
console.log(`Test samples: ${testFeatures.length}\n`);

// Train
console.log('Training Random Forest (25 trees, depth 8)...');
const rf = new RandomForest(25, 8);
rf.train(trainFeatures, trainLabels);

// ============================================
// EVALUATION
// ============================================

console.log('\n═══════════════════════════════════════════════════════════');
console.log('EVALUATION');
console.log('═══════════════════════════════════════════════════════════\n');

// Overall metrics
let correct = 0, tp = 0, fp = 0, tn = 0, fn = 0;
const predictions = [];

for (let i = 0; i < testFeatures.length; i++) {
    const prob = rf.predict(testFeatures[i]);
    const pred = prob > 0.5 ? 1 : 0;
    predictions.push({ prob, pred, actual: testLabels[i], meta: testMeta[i] });

    if (pred === testLabels[i]) correct++;
    if (pred === 1 && testLabels[i] === 1) tp++;
    if (pred === 1 && testLabels[i] === 0) fp++;
    if (pred === 0 && testLabels[i] === 0) tn++;
    if (pred === 0 && testLabels[i] === 1) fn++;
}

const accuracy = (correct / testLabels.length) * 100;
const precision = tp / (tp + fp) * 100 || 0;
const recall = tp / (tp + fn) * 100 || 0;
const f1 = 2 * (precision * recall) / (precision + recall) || 0;

console.log('Overall Results:');
console.log(`  Accuracy:  ${accuracy.toFixed(1)}%`);
console.log(`  Precision: ${precision.toFixed(1)}%`);
console.log(`  Recall:    ${recall.toFixed(1)}%`);
console.log(`  F1 Score:  ${f1.toFixed(1)}%\n`);

// Per-stock results
console.log('Per-Stock Results:');
console.log('Symbol | Accuracy | Precision | Recall | F1');
console.log('-------|----------|-----------|--------|----');

for (const symbol of symbols) {
    const stockPreds = predictions.filter(p => p.meta.symbol === symbol);
    if (stockPreds.length === 0) continue;

    let sCorrect = 0, sTp = 0, sFp = 0, sFn = 0;
    for (const p of stockPreds) {
        if (p.pred === p.actual) sCorrect++;
        if (p.pred === 1 && p.actual === 1) sTp++;
        if (p.pred === 1 && p.actual === 0) sFp++;
        if (p.pred === 0 && p.actual === 1) sFn++;
    }

    const sAcc = (sCorrect / stockPreds.length) * 100;
    const sPrec = sTp / (sTp + sFp) * 100 || 0;
    const sRec = sTp / (sTp + sFn) * 100 || 0;
    const sF1 = 2 * (sPrec * sRec) / (sPrec + sRec) || 0;

    console.log(`${symbol.padEnd(6)} | ${sAcc.toFixed(1).padStart(7)}% | ${sPrec.toFixed(1).padStart(8)}% | ${sRec.toFixed(1).padStart(5)}% | ${sF1.toFixed(1).padStart(4)}`);
}

// ============================================
// BACKTEST ALL STOCKS
// ============================================

console.log('\n═══════════════════════════════════════════════════════════');
console.log('BACKTESTING MULTI-STOCK STRATEGY');
console.log('═══════════════════════════════════════════════════════════\n');

let totalReturn = 0;
let totalBH = 0;

for (const symbol of symbols) {
    const stockData = allStockData[symbol];
    if (!stockData) continue;

    const prices = stockData.map(d => d.close);
    const { features, metadata } = createFeaturesForStock(stockData, symbol, horizon, threshold);

    // Use last 30% for backtest
    const startIdx = Math.floor(features.length * 0.7);

    let cash = 10000, shares = 0, entryPrice = 0, entryIdx = 0;
    let trades = 0, wins = 0;

    for (let i = startIdx; i < features.length; i++) {
        const price = metadata[i].price;
        const prob = rf.predict(features[i]);

        if (shares > 0) {
            const daysHeld = metadata[i].idx - entryIdx;
            const pnlPct = ((price - entryPrice) / entryPrice) * 100;

            if (daysHeld >= horizon || pnlPct <= -5 || pnlPct >= threshold * 3) {
                cash = shares * price;
                trades++;
                if (pnlPct > 0) wins++;
                shares = 0;
            }
        }

        if (shares === 0 && prob > 0.55) {
            shares = cash / price;
            entryPrice = price;
            entryIdx = metadata[i].idx;
            cash = 0;
        }
    }

    if (shares > 0) cash = shares * metadata[metadata.length - 1].price;

    const stratReturn = ((cash - 10000) / 10000) * 100;
    const bhReturn = ((metadata[metadata.length - 1].price - metadata[startIdx].price) / metadata[startIdx].price) * 100;

    totalReturn += stratReturn;
    totalBH += bhReturn;

    const winRate = trades > 0 ? (wins / trades * 100).toFixed(0) : 'N/A';
    console.log(`${symbol}: Strategy ${stratReturn.toFixed(1).padStart(6)}% | B&H ${bhReturn.toFixed(1).padStart(6)}% | Trades: ${trades}, Win: ${winRate}%`);
}

console.log('─'.repeat(60));
console.log(`AVG:  Strategy ${(totalReturn / symbols.length).toFixed(1).padStart(6)}% | B&H ${(totalBH / symbols.length).toFixed(1).padStart(6)}%`);

// ============================================
// CURRENT PREDICTIONS FOR ALL STOCKS
// ============================================

console.log('\n═══════════════════════════════════════════════════════════');
console.log('CURRENT PREDICTIONS');
console.log('═══════════════════════════════════════════════════════════\n');

console.log(`Prediction: +${threshold}% in ${horizon} days\n`);
console.log('Symbol | Price    | Probability | Signal     | Confidence');
console.log('-------|----------|-------------|------------|----------');

const currentPredictions = [];

for (const symbol of symbols) {
    const stockData = allStockData[symbol];
    if (!stockData) continue;

    const { features, metadata } = createFeaturesForStock(stockData, symbol, horizon, threshold);
    const lastFeature = features[features.length - 1];
    const lastMeta = metadata[metadata.length - 1];
    const prob = rf.predict(lastFeature);

    const signal = prob > 0.6 ? 'BUY' : prob > 0.55 ? 'LEAN BUY' : prob < 0.4 ? 'AVOID' : prob < 0.45 ? 'LEAN AVOID' : 'NEUTRAL';
    const confidence = Math.abs(prob - 0.5) * 200;

    currentPredictions.push({ symbol, price: lastMeta.price, prob, signal, confidence });

    const emoji = prob > 0.55 ? '🟢' : prob < 0.45 ? '🔴' : '🟡';
    console.log(`${emoji} ${symbol.padEnd(5)} | $${lastMeta.price.toFixed(2).padStart(7)} | ${(prob * 100).toFixed(1).padStart(10)}% | ${signal.padEnd(10)} | ${confidence.toFixed(0)}%`);
}

// ============================================
// TRADING RECOMMENDATIONS
// ============================================

console.log('\n═══════════════════════════════════════════════════════════');
console.log('TRADING RECOMMENDATIONS');
console.log('═══════════════════════════════════════════════════════════\n');

const buySignals = currentPredictions.filter(p => p.prob > 0.55).sort((a, b) => b.prob - a.prob);
const avoidSignals = currentPredictions.filter(p => p.prob < 0.45).sort((a, b) => a.prob - b.prob);

if (buySignals.length > 0) {
    console.log('BUY CANDIDATES:');
    buySignals.forEach(s => {
        console.log(`  ${s.symbol}: ${(s.prob * 100).toFixed(1)}% probability of +${threshold}% in ${horizon} days`);
        console.log(`    Entry: $${s.price.toFixed(2)}, Target: $${(s.price * (1 + threshold/100)).toFixed(2)}, Stop: $${(s.price * 0.95).toFixed(2)}`);
    });
} else {
    console.log('NO BUY SIGNALS - Market looks weak');
}

console.log('');

if (avoidSignals.length > 0) {
    console.log('AVOID/BEARISH:');
    avoidSignals.forEach(s => {
        console.log(`  ${s.symbol}: Only ${(s.prob * 100).toFixed(1)}% probability of gain`);
    });
}

// ============================================
// MODEL INSIGHTS
// ============================================

console.log('\n═══════════════════════════════════════════════════════════');
console.log('MODEL INSIGHTS');
console.log('═══════════════════════════════════════════════════════════\n');

console.log('Training on multiple stocks provides:');
console.log('  1. More data: 5x the samples for better learning');
console.log('  2. Generalization: Model learns patterns, not stock-specific quirks');
console.log('  3. Cross-validation: Test on stocks model has seen in training');
console.log('  4. Robustness: Less likely to overfit to one stock\n');

console.log('Feature Importance (by split frequency):');
const featureNames = [
    'Price vs SMA10', 'Price vs SMA20', 'Price vs SMA50', 'Price vs SMA200',
    'SMA10 vs SMA20', 'SMA20 vs SMA50', 'SMA50 vs SMA200',
    'RSI(14)', 'RSI(7)', 'MACD Hist', 'Stochastic',
    'BB %B', 'BB Width', 'ATR %', '5d Return'
];

// Count feature usage across trees
const featureUsage = new Array(15).fill(0);
function countFeatureUsage(tree) {
    if (tree.leaf) return;
    featureUsage[tree.featureIdx]++;
    countFeatureUsage(tree.left);
    countFeatureUsage(tree.right);
}
rf.trees.forEach(t => countFeatureUsage(t));

const totalSplits = featureUsage.reduce((a, b) => a + b, 0);
const importance = featureNames.map((name, i) => ({
    name,
    importance: (featureUsage[i] / totalSplits * 100)
})).sort((a, b) => b.importance - a.importance);

importance.slice(0, 8).forEach(f => {
    const bar = '█'.repeat(Math.round(f.importance));
    console.log(`  ${f.name.padEnd(15)} ${bar} ${f.importance.toFixed(1)}%`);
});

console.log('\n=== Multi-Stock Training Complete ===');
