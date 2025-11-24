/**
 * Full Universe Trainer
 *
 * Trains on 25+ symbols across:
 * - Tech stocks (AAPL, MSFT, NVDA, AMD, GOOGL, TSLA, PLTR, INTC)
 * - Broad ETFs (SPY, QQQ, VOO, IWM)
 * - Sector ETFs (XLF, XLE, XLV, XLP, XLY)
 * - Defensive stocks (PG, KO, JNJ, MCD, WMT, IBM)
 * - Cross-asset (TLT, IEF, GLD, UUP, DIS, BAH)
 */

const fs = require('fs');
const path = require('path');

console.log('=== Full Universe Neural Trainer ===\n');

// ============================================
// LOAD ALL DATA
// ============================================

const dataDir = path.join(__dirname, '../historical-data');
const allSymbols = [
    // Tech
    'AAPL', 'MSFT', 'NVDA', 'AMD', 'GOOGL', 'TSLA', 'PLTR', 'INTC',
    // Broad ETFs
    'SPY', 'QQQ', 'VOO', 'IWM',
    // Sector ETFs
    'XLF', 'XLE', 'XLV', 'XLP', 'XLY',
    // Defensive
    'PG', 'KO', 'JNJ', 'MCD', 'WMT', 'IBM',
    // Cross-asset
    'TLT', 'IEF', 'GLD', 'UUP', 'DIS', 'BAH'
];

const categories = {
    'Tech': ['AAPL', 'MSFT', 'NVDA', 'AMD', 'GOOGL', 'TSLA', 'PLTR', 'INTC'],
    'Broad ETF': ['SPY', 'QQQ', 'VOO', 'IWM'],
    'Sector ETF': ['XLF', 'XLE', 'XLV', 'XLP', 'XLY'],
    'Defensive': ['PG', 'KO', 'JNJ', 'MCD', 'WMT', 'IBM'],
    'Cross-Asset': ['TLT', 'IEF', 'GLD', 'UUP', 'DIS', 'BAH']
};

const allData = {};
let totalDays = 0;

console.log('Loading data...');
for (const sym of allSymbols) {
    const filePath = path.join(dataDir, `${sym}-5-years.json`);
    if (fs.existsSync(filePath)) {
        allData[sym] = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        totalDays += allData[sym].length;
    }
}

console.log(`Loaded ${Object.keys(allData).length} symbols (${totalDays.toLocaleString()} total days)\n`);

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
        if (i < period - 1) { percentB.push(null); width.push(null); }
        else {
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
// FEATURE CREATION
// ============================================

function createFeatures(data, symbol, horizon = 10, threshold = 1.0) {
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

        features.push([
            // Trend (7)
            (prices[i] - sma10[i]) / sma10[i],
            (prices[i] - sma20[i]) / sma20[i],
            (prices[i] - sma50[i]) / sma50[i],
            (prices[i] - sma200[i]) / sma200[i],
            (sma10[i] - sma20[i]) / sma20[i],
            (sma20[i] - sma50[i]) / sma50[i],
            (sma50[i] - sma200[i]) / sma200[i],

            // Momentum (4)
            rsiValues[i] / 100,
            (rsi7[i] || 50) / 100,
            histogram[i] / prices[i] * 100,
            (stochValues[i] || 50) / 100,

            // Volatility (3)
            percentB[i],
            width[i] * 10,
            atrValues[i] / prices[i] * 100,

            // Returns (4)
            (prices[i] - prices[i-1]) / prices[i-1],
            (prices[i] - prices[i-5]) / prices[i-5],
            (prices[i] - prices[i-10]) / prices[i-10],
            (prices[i] - prices[i-20]) / prices[i-20],
        ]);

        const futureReturn = (prices[i + horizon] - prices[i]) / prices[i] * 100;
        labels.push(futureReturn > threshold ? 1 : 0);
        metadata.push({ symbol, date: data[i].date, price: prices[i], idx: i });
    }

    return { features, labels, metadata };
}

// ============================================
// RANDOM FOREST
// ============================================

class RandomForest {
    constructor(numTrees = 30, maxDepth = 10) {
        this.numTrees = numTrees;
        this.maxDepth = maxDepth;
        this.trees = [];
    }

    buildTree(features, labels, depth = 0) {
        if (depth >= this.maxDepth || labels.length < 30) {
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
            const step = Math.max(1, Math.floor(values.length / 20));

            for (let i = step; i < values.length - step; i += step) {
                const threshold = values[i];
                const leftIdx = [], rightIdx = [];

                for (let j = 0; j < features.length; j++) {
                    if (features[j][featureIdx] <= threshold) leftIdx.push(j);
                    else rightIdx.push(j);
                }

                if (leftIdx.length < 15 || rightIdx.length < 15) continue;

                const leftMean = leftIdx.reduce((s, i) => s + labels[i], 0) / leftIdx.length;
                const rightMean = rightIdx.reduce((s, i) => s + labels[i], 0) / rightIdx.length;
                const gain = Math.abs(leftMean - rightMean) * Math.min(leftIdx.length, rightIdx.length);

                if (gain > bestGain) {
                    bestGain = gain;
                    bestSplit = { featureIdx, threshold,
                        leftFeatures: leftIdx.map(i => features[i]),
                        leftLabels: leftIdx.map(i => labels[i]),
                        rightFeatures: rightIdx.map(i => features[i]),
                        rightLabels: rightIdx.map(i => labels[i]) };
                }
            }
        }

        if (!bestSplit) {
            return { leaf: true, value: labels.reduce((a, b) => a + b, 0) / labels.length };
        }

        return {
            leaf: false, featureIdx: bestSplit.featureIdx, threshold: bestSplit.threshold,
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
            process.stdout.write(`  Training: ${t + 1}/${this.numTrees}\r`);
        }
        console.log(`  Training: ${this.numTrees}/${this.numTrees} ✅`);
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

// ============================================
// BUILD DATASET
// ============================================

console.log('═══════════════════════════════════════════════════════════');
console.log('BUILDING TRAINING DATASET');
console.log('═══════════════════════════════════════════════════════════\n');

const horizon = 10;
const threshold = 1.0;

let allFeatures = [], allLabels = [], allMetadata = [];

for (const [symbol, data] of Object.entries(allData)) {
    const { features, labels, metadata } = createFeatures(data, symbol, horizon, threshold);
    const posRate = (labels.filter(l => l === 1).length / labels.length * 100).toFixed(0);
    console.log(`  ${symbol.padEnd(5)}: ${String(features.length).padStart(5)} samples (${posRate}% positive)`);
    allFeatures = allFeatures.concat(features);
    allLabels = allLabels.concat(labels);
    allMetadata = allMetadata.concat(metadata);
}

console.log(`\nTotal: ${allFeatures.length.toLocaleString()} samples`);
console.log(`Positive rate: ${(allLabels.filter(l => l === 1).length / allLabels.length * 100).toFixed(1)}%\n`);

// ============================================
// TRAIN/TEST SPLIT
// ============================================

console.log('═══════════════════════════════════════════════════════════');
console.log('TRAINING MODEL');
console.log('═══════════════════════════════════════════════════════════\n');

// Time-based split per symbol
const trainData = [], testData = [];
for (const symbol of Object.keys(allData)) {
    const symbolData = allFeatures.map((f, i) => ({ feature: f, label: allLabels[i], meta: allMetadata[i] }))
        .filter(d => d.meta.symbol === symbol);
    const splitIdx = Math.floor(symbolData.length * 0.7);
    trainData.push(...symbolData.slice(0, splitIdx));
    testData.push(...symbolData.slice(splitIdx));
}

// Shuffle training
for (let i = trainData.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [trainData[i], trainData[j]] = [trainData[j], trainData[i]];
}

const trainFeatures = trainData.map(d => d.feature);
const trainLabels = trainData.map(d => d.label);
const testFeatures = testData.map(d => d.feature);
const testLabels = testData.map(d => d.label);
const testMeta = testData.map(d => d.meta);

console.log(`Training: ${trainFeatures.length.toLocaleString()} samples`);
console.log(`Testing:  ${testFeatures.length.toLocaleString()} samples\n`);

// Train
const rf = new RandomForest(30, 10);
rf.train(trainFeatures, trainLabels);

// ============================================
// EVALUATION
// ============================================

console.log('\n═══════════════════════════════════════════════════════════');
console.log('MODEL EVALUATION');
console.log('═══════════════════════════════════════════════════════════\n');

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

console.log('Overall Results:');
console.log(`  Accuracy:  ${(correct / testLabels.length * 100).toFixed(1)}%`);
console.log(`  Precision: ${(tp / (tp + fp) * 100).toFixed(1)}%`);
console.log(`  Recall:    ${(tp / (tp + fn) * 100).toFixed(1)}%`);
console.log(`  F1 Score:  ${(2 * tp / (2 * tp + fp + fn) * 100).toFixed(1)}%\n`);

// By category
console.log('Results by Category:');
console.log('─'.repeat(60));

for (const [cat, syms] of Object.entries(categories)) {
    const catPreds = predictions.filter(p => syms.includes(p.meta.symbol));
    if (catPreds.length === 0) continue;

    let cCorrect = 0, cTp = 0, cFp = 0, cFn = 0;
    for (const p of catPreds) {
        if (p.pred === p.actual) cCorrect++;
        if (p.pred === 1 && p.actual === 1) cTp++;
        if (p.pred === 1 && p.actual === 0) cFp++;
        if (p.pred === 0 && p.actual === 1) cFn++;
    }
    const cAcc = (cCorrect / catPreds.length * 100).toFixed(1);
    const cPrec = (cTp / (cTp + cFp) * 100 || 0).toFixed(1);
    const cF1 = (2 * cTp / (2 * cTp + cFp + cFn) * 100 || 0).toFixed(1);

    console.log(`${cat.padEnd(12)}: Acc ${cAcc}% | Prec ${cPrec}% | F1 ${cF1}%`);
}

// ============================================
// CURRENT PREDICTIONS
// ============================================

console.log('\n═══════════════════════════════════════════════════════════');
console.log('CURRENT PREDICTIONS');
console.log('═══════════════════════════════════════════════════════════\n');

console.log(`Predicting: +${threshold}% in ${horizon} days\n`);

const currentPredictions = [];

for (const symbol of Object.keys(allData)) {
    const data = allData[symbol];
    const { features, metadata } = createFeatures(data, symbol, horizon, threshold);
    if (features.length === 0) continue;

    const lastFeature = features[features.length - 1];
    const lastMeta = metadata[metadata.length - 1];
    const prob = rf.predict(lastFeature);

    currentPredictions.push({ symbol, price: lastMeta.price, prob });
}

// Sort by probability
currentPredictions.sort((a, b) => b.prob - a.prob);

console.log('Symbol | Price     | Prob  | Signal');
console.log('-------|-----------|-------|--------');

for (const p of currentPredictions) {
    const signal = p.prob > 0.6 ? 'BUY' : p.prob > 0.55 ? 'LEAN BUY' :
                   p.prob < 0.4 ? 'AVOID' : p.prob < 0.45 ? 'LEAN AVOID' : 'NEUTRAL';
    const emoji = p.prob > 0.55 ? '🟢' : p.prob < 0.45 ? '🔴' : '🟡';

    console.log(`${emoji} ${p.symbol.padEnd(5)} | $${p.price.toFixed(2).padStart(8)} | ${(p.prob * 100).toFixed(0).padStart(4)}% | ${signal}`);
}

// ============================================
// TRADING RECOMMENDATIONS
// ============================================

console.log('\n═══════════════════════════════════════════════════════════');
console.log('TRADING RECOMMENDATIONS');
console.log('═══════════════════════════════════════════════════════════\n');

const buys = currentPredictions.filter(p => p.prob > 0.55);
const avoids = currentPredictions.filter(p => p.prob < 0.45);

console.log(`🟢 BUY CANDIDATES (${buys.length}):`);
if (buys.length > 0) {
    buys.forEach(p => {
        console.log(`  ${p.symbol}: ${(p.prob * 100).toFixed(0)}% | Entry $${p.price.toFixed(2)} → Target $${(p.price * 1.03).toFixed(2)} → Stop $${(p.price * 0.95).toFixed(2)}`);
    });
} else {
    console.log('  None - market looks weak');
}

console.log(`\n🔴 AVOID (${avoids.length}):`);
if (avoids.length > 0) {
    avoids.forEach(p => {
        console.log(`  ${p.symbol}: ${(p.prob * 100).toFixed(0)}% probability`);
    });
}

// ============================================
// KEY INSIGHTS
// ============================================

console.log('\n═══════════════════════════════════════════════════════════');
console.log('KEY INSIGHTS');
console.log('═══════════════════════════════════════════════════════════\n');

// Market regime
const spyProb = currentPredictions.find(p => p.symbol === 'SPY')?.prob || 0.5;
const qqqProb = currentPredictions.find(p => p.symbol === 'QQQ')?.prob || 0.5;
const tltProb = currentPredictions.find(p => p.symbol === 'TLT')?.prob || 0.5;
const gldProb = currentPredictions.find(p => p.symbol === 'GLD')?.prob || 0.5;

console.log('Market Regime:');
console.log(`  Stocks (SPY): ${spyProb > 0.55 ? 'BULLISH' : spyProb < 0.45 ? 'BEARISH' : 'NEUTRAL'} (${(spyProb * 100).toFixed(0)}%)`);
console.log(`  Tech (QQQ):   ${qqqProb > 0.55 ? 'BULLISH' : qqqProb < 0.45 ? 'BEARISH' : 'NEUTRAL'} (${(qqqProb * 100).toFixed(0)}%)`);
console.log(`  Bonds (TLT):  ${tltProb > 0.55 ? 'BULLISH' : tltProb < 0.45 ? 'BEARISH' : 'NEUTRAL'} (${(tltProb * 100).toFixed(0)}%)`);
console.log(`  Gold (GLD):   ${gldProb > 0.55 ? 'BULLISH' : gldProb < 0.45 ? 'BEARISH' : 'NEUTRAL'} (${(gldProb * 100).toFixed(0)}%)`);

// Risk-on vs Risk-off
const riskOn = ['TSLA', 'NVDA', 'AMD', 'PLTR', 'XLY', 'IWM'].filter(s => allData[s]);
const riskOff = ['TLT', 'GLD', 'XLP', 'XLV', 'KO', 'PG'].filter(s => allData[s]);

const riskOnAvg = riskOn.map(s => currentPredictions.find(p => p.symbol === s)?.prob || 0.5).reduce((a, b) => a + b, 0) / riskOn.length;
const riskOffAvg = riskOff.map(s => currentPredictions.find(p => p.symbol === s)?.prob || 0.5).reduce((a, b) => a + b, 0) / riskOff.length;

console.log('\nRisk Sentiment:');
console.log(`  Risk-On assets:  ${(riskOnAvg * 100).toFixed(0)}% avg probability`);
console.log(`  Risk-Off assets: ${(riskOffAvg * 100).toFixed(0)}% avg probability`);
console.log(`  Recommendation:  ${riskOnAvg > riskOffAvg + 0.05 ? 'RISK ON - favor growth' : riskOffAvg > riskOnAvg + 0.05 ? 'RISK OFF - favor safety' : 'MIXED - stay balanced'}`);

console.log('\n=== Full Universe Training Complete ===');
