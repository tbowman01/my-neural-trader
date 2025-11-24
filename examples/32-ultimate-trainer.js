/**
 * Ultimate Neural Trainer
 *
 * Implements ALL improvements:
 * 1. 40+ stocks across all sectors
 * 2. VIX as market fear feature
 * 3. Cross-asset correlations (bonds, gold, dollar)
 * 4. Walk-forward validation
 * 5. Transaction costs & slippage
 * 6. Risk management rules
 * 7. Baseline strategy comparison
 * 8. Feature importance analysis
 */

const fs = require('fs');
const path = require('path');

console.log('=== Ultimate Neural Trainer ===\n');

// ============================================
// LOAD ALL DATA
// ============================================

const dataDir = path.join(__dirname, '../historical-data');

// All symbols to train on
const stockSymbols = [
    // Tech
    'AAPL', 'MSFT', 'NVDA', 'AMD', 'GOOGL', 'TSLA', 'PLTR', 'INTC',
    'META', 'AMZN', 'NFLX', 'CRM', 'ORCL', 'CSCO', 'AVGO',
    // Finance
    'JPM', 'BAC', 'V', 'MA',
    // Consumer
    'COST', 'HD', 'WMT', 'MCD', 'KO', 'PG',
    // Healthcare
    'JNJ',
    // Energy
    'XOM', 'CVX',
    // Other
    'IBM', 'DIS', 'BAH',
];

const etfSymbols = ['SPY', 'QQQ', 'VOO', 'IWM', 'XLF', 'XLE', 'XLV', 'XLP', 'XLY'];
const crossAssetSymbols = ['TLT', 'IEF', 'GLD', 'UUP'];
const marketIndicators = ['VIX', 'TNX'];

const allData = {};
let loadedCount = 0;

// Load all data
[...stockSymbols, ...etfSymbols, ...crossAssetSymbols, ...marketIndicators].forEach(sym => {
    const filePath = path.join(dataDir, `${sym}-5-years.json`);
    if (fs.existsSync(filePath)) {
        allData[sym] = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        loadedCount++;
    }
});

console.log(`Loaded ${loadedCount} symbols\n`);

// ============================================
// MARKET CONTEXT (VIX, SPY, etc.)
// ============================================

function getMarketContext() {
    const spyData = allData['SPY'] || [];
    const vixData = allData['VIX'] || [];
    const tltData = allData['TLT'] || [];
    const gldData = allData['GLD'] || [];

    // Create date-indexed lookup
    const context = {};

    spyData.forEach(d => {
        context[d.date] = { spyClose: d.close };
    });

    vixData.forEach(d => {
        if (context[d.date]) context[d.date].vix = d.close;
    });

    tltData.forEach(d => {
        if (context[d.date]) context[d.date].tltClose = d.close;
    });

    gldData.forEach(d => {
        if (context[d.date]) context[d.date].gldClose = d.close;
    });

    // Calculate SPY moving averages
    const spyPrices = spyData.map(d => d.close);
    const spySma50 = sma(spyPrices, 50);
    const spySma200 = sma(spyPrices, 200);

    spyData.forEach((d, i) => {
        if (context[d.date]) {
            context[d.date].spySma50 = spySma50[i];
            context[d.date].spySma200 = spySma200[i];
            context[d.date].spyReturn5 = i >= 5 ? (spyPrices[i] - spyPrices[i-5]) / spyPrices[i-5] : 0;
        }
    });

    return context;
}

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
    return { line, signal, histogram: line.map((v, i) => v - signal[i]) };
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
            percentB.push((prices[i] - (middle[i] - 2*std)) / (4*std));
            width.push((4*std) / middle[i]);
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

function volumeRatio(data, period = 20) {
    const result = new Array(data.length).fill(null);
    for (let i = period; i < data.length; i++) {
        const avgVol = data.slice(i - period, i).reduce((s, d) => s + (d.volume || 1), 0) / period;
        result[i] = (data[i].volume || 1) / avgVol;
    }
    return result;
}

// ============================================
// ENHANCED FEATURE CREATION (30+ features)
// ============================================

function createEnhancedFeatures(data, symbol, marketContext, horizon = 10, threshold = 1.0) {
    const prices = data.map(d => d.close);
    const sma10 = sma(prices, 10);
    const sma20 = sma(prices, 20);
    const sma50 = sma(prices, 50);
    const sma200 = sma(prices, 200);
    const { line: macdLine, histogram } = macd(prices);
    const rsi14 = rsi(prices, 14);
    const { percentB, width } = bollingerBands(prices);
    const atrValues = atr(data);
    const volRatio = volumeRatio(data);

    const features = [], labels = [], metadata = [];

    for (let i = 200; i < prices.length - horizon; i++) {
        if (!sma200[i] || !rsi14[i] || !percentB[i]) continue;

        const date = data[i].date;
        const ctx = marketContext[date] || {};

        // Stock-specific features (18)
        const stockFeatures = [
            (prices[i] - sma10[i]) / sma10[i],
            (prices[i] - sma20[i]) / sma20[i],
            (prices[i] - sma50[i]) / sma50[i],
            (prices[i] - sma200[i]) / sma200[i],
            (sma10[i] - sma20[i]) / sma20[i],
            (sma20[i] - sma50[i]) / sma50[i],
            (sma50[i] - sma200[i]) / sma200[i],
            rsi14[i] / 100,
            histogram[i] / prices[i] * 100,
            macdLine[i] / prices[i] * 100,
            percentB[i],
            width[i] * 10,
            atrValues[i] / prices[i] * 100,
            volRatio[i] ? Math.min(3, volRatio[i]) / 3 : 0.33,
            (prices[i] - prices[i-1]) / prices[i-1],
            (prices[i] - prices[i-5]) / prices[i-5],
            (prices[i] - prices[i-10]) / prices[i-10],
            (prices[i] - prices[i-20]) / prices[i-20],
        ];

        // Market context features (8)
        const marketFeatures = [
            // VIX (fear index)
            ctx.vix ? Math.min(ctx.vix / 50, 1) : 0.3,
            // SPY trend
            ctx.spyClose && ctx.spySma50 ? (ctx.spyClose - ctx.spySma50) / ctx.spySma50 : 0,
            ctx.spyClose && ctx.spySma200 ? (ctx.spyClose - ctx.spySma200) / ctx.spySma200 : 0,
            // SPY momentum
            ctx.spyReturn5 || 0,
            // Bonds (flight to safety)
            ctx.tltClose && i > 20 ?
                (ctx.tltClose - (marketContext[data[i-20]?.date]?.tltClose || ctx.tltClose)) / ctx.tltClose : 0,
            // Gold
            ctx.gldClose && i > 20 ?
                (ctx.gldClose - (marketContext[data[i-20]?.date]?.gldClose || ctx.gldClose)) / ctx.gldClose : 0,
            // Market regime (1 = bull, 0 = bear)
            ctx.spyClose && ctx.spySma200 ? (ctx.spyClose > ctx.spySma200 ? 1 : 0) : 0.5,
            // VIX regime (1 = low vol, 0 = high vol)
            ctx.vix ? (ctx.vix < 20 ? 1 : ctx.vix < 30 ? 0.5 : 0) : 0.5,
        ];

        const feature = [...stockFeatures, ...marketFeatures];

        const futureReturn = (prices[i + horizon] - prices[i]) / prices[i] * 100;
        labels.push(futureReturn > threshold ? 1 : 0);
        metadata.push({ symbol, date, price: prices[i], idx: i, futureReturn });
        features.push(feature);
    }

    return { features, labels, metadata };
}

// ============================================
// RANDOM FOREST WITH FEATURE IMPORTANCE
// ============================================

class RandomForest {
    constructor(numTrees = 40, maxDepth = 12) {
        this.numTrees = numTrees;
        this.maxDepth = maxDepth;
        this.trees = [];
        this.featureImportance = null;
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
                    bestSplit = { featureIdx, threshold, gain,
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
            importance: bestSplit.gain,
            left: this.buildTree(bestSplit.leftFeatures, bestSplit.leftLabels, depth + 1),
            right: this.buildTree(bestSplit.rightFeatures, bestSplit.rightLabels, depth + 1)
        };
    }

    train(features, labels) {
        this.trees = [];
        this.featureImportance = new Array(features[0].length).fill(0);

        for (let t = 0; t < this.numTrees; t++) {
            const indices = Array.from({length: features.length}, () =>
                Math.floor(Math.random() * features.length));
            const tree = this.buildTree(
                indices.map(i => features[i]),
                indices.map(i => labels[i])
            );
            this.trees.push(tree);
            this.collectImportance(tree);
        }

        // Normalize importance
        const total = this.featureImportance.reduce((a, b) => a + b, 0) || 1;
        this.featureImportance = this.featureImportance.map(v => v / total);
    }

    collectImportance(tree) {
        if (tree.leaf) return;
        this.featureImportance[tree.featureIdx] += tree.importance || 0;
        this.collectImportance(tree.left);
        this.collectImportance(tree.right);
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
// WALK-FORWARD VALIDATION
// ============================================

function walkForwardValidation(allFeatures, allLabels, allMetadata, windowSize = 500, stepSize = 100) {
    console.log('Running walk-forward validation...');

    let totalCorrect = 0, totalSamples = 0;
    let totalTp = 0, totalFp = 0, totalFn = 0;

    const numFolds = Math.floor((allFeatures.length - windowSize) / stepSize);

    for (let fold = 0; fold < Math.min(numFolds, 10); fold++) {
        const trainStart = fold * stepSize;
        const trainEnd = trainStart + windowSize;
        const testEnd = Math.min(trainEnd + stepSize, allFeatures.length);

        const trainFeatures = allFeatures.slice(trainStart, trainEnd);
        const trainLabels = allLabels.slice(trainStart, trainEnd);
        const testFeatures = allFeatures.slice(trainEnd, testEnd);
        const testLabels = allLabels.slice(trainEnd, testEnd);

        if (testFeatures.length === 0) break;

        const rf = new RandomForest(20, 8);
        rf.train(trainFeatures, trainLabels);

        for (let i = 0; i < testFeatures.length; i++) {
            const pred = rf.predict(testFeatures[i]) > 0.5 ? 1 : 0;
            if (pred === testLabels[i]) totalCorrect++;
            if (pred === 1 && testLabels[i] === 1) totalTp++;
            if (pred === 1 && testLabels[i] === 0) totalFp++;
            if (pred === 0 && testLabels[i] === 1) totalFn++;
            totalSamples++;
        }
    }

    return {
        accuracy: (totalCorrect / totalSamples * 100).toFixed(1),
        precision: (totalTp / (totalTp + totalFp) * 100 || 0).toFixed(1),
        f1: (2 * totalTp / (2 * totalTp + totalFp + totalFn) * 100 || 0).toFixed(1)
    };
}

// ============================================
// BACKTEST WITH COSTS
// ============================================

function backtestWithCosts(predictions, testMeta, commissionPct = 0.001, slippagePct = 0.0005) {
    let cash = 10000, shares = 0, entryPrice = 0;
    let trades = 0, wins = 0, totalCommission = 0;

    for (let i = 0; i < predictions.length; i++) {
        const price = testMeta[i].price;
        const prob = predictions[i];

        if (shares > 0) {
            const pnlPct = ((price - entryPrice) / entryPrice) * 100;
            if (prob < 0.4 || pnlPct <= -5 || pnlPct >= 8) {
                // Sell with costs
                const grossValue = shares * price;
                const commission = grossValue * commissionPct;
                const slippage = grossValue * slippagePct;
                cash = grossValue - commission - slippage;
                totalCommission += commission + slippage;

                trades++;
                if (cash > shares * entryPrice) wins++;
                shares = 0;
            }
        }

        if (shares === 0 && prob > 0.55) {
            // Buy with costs
            const commission = cash * commissionPct;
            const slippage = cash * slippagePct;
            const investable = cash - commission - slippage;
            totalCommission += commission + slippage;

            shares = investable / price;
            entryPrice = price;
            cash = 0;
        }
    }

    if (shares > 0) cash = shares * testMeta[testMeta.length - 1].price;

    const finalReturn = ((cash - 10000) / 10000) * 100;
    const bhReturn = ((testMeta[testMeta.length - 1].price - testMeta[0].price) / testMeta[0].price) * 100;

    return {
        strategyReturn: finalReturn.toFixed(1),
        buyHoldReturn: bhReturn.toFixed(1),
        trades,
        winRate: trades > 0 ? (wins / trades * 100).toFixed(0) : 'N/A',
        totalCosts: totalCommission.toFixed(2)
    };
}

// ============================================
// MAIN TRAINING
// ============================================

console.log('═══════════════════════════════════════════════════════════');
console.log('BUILDING ENHANCED DATASET');
console.log('═══════════════════════════════════════════════════════════\n');

const marketContext = getMarketContext();
const horizon = 10;
const threshold = 1.0;

let allFeatures = [], allLabels = [], allMetadata = [];

const trainableSymbols = [...stockSymbols, ...etfSymbols].filter(s => allData[s]);

for (const symbol of trainableSymbols) {
    const { features, labels, metadata } = createEnhancedFeatures(
        allData[symbol], symbol, marketContext, horizon, threshold
    );
    if (features.length > 0) {
        console.log(`  ${symbol.padEnd(5)}: ${String(features.length).padStart(5)} samples`);
        allFeatures = allFeatures.concat(features);
        allLabels = allLabels.concat(labels);
        allMetadata = allMetadata.concat(metadata);
    }
}

console.log(`\nTotal: ${allFeatures.length.toLocaleString()} samples`);
console.log(`Features: ${allFeatures[0].length} (18 stock + 8 market)`);
console.log(`Positive rate: ${(allLabels.filter(l => l === 1).length / allLabels.length * 100).toFixed(1)}%\n`);

// ============================================
// WALK-FORWARD VALIDATION
// ============================================

console.log('═══════════════════════════════════════════════════════════');
console.log('WALK-FORWARD VALIDATION');
console.log('═══════════════════════════════════════════════════════════\n');

const wfResults = walkForwardValidation(allFeatures, allLabels, allMetadata);
console.log(`Walk-Forward Results (10 folds):`);
console.log(`  Accuracy:  ${wfResults.accuracy}%`);
console.log(`  Precision: ${wfResults.precision}%`);
console.log(`  F1 Score:  ${wfResults.f1}%\n`);

// ============================================
// TRAIN FINAL MODEL
// ============================================

console.log('═══════════════════════════════════════════════════════════');
console.log('TRAINING FINAL MODEL');
console.log('═══════════════════════════════════════════════════════════\n');

// Split 80/20 for final test
const splitIdx = Math.floor(allFeatures.length * 0.8);
const trainFeatures = allFeatures.slice(0, splitIdx);
const trainLabels = allLabels.slice(0, splitIdx);
const testFeatures = allFeatures.slice(splitIdx);
const testLabels = allLabels.slice(splitIdx);
const testMeta = allMetadata.slice(splitIdx);

console.log(`Training: ${trainFeatures.length.toLocaleString()} samples`);
console.log(`Testing:  ${testFeatures.length.toLocaleString()} samples\n`);

const rf = new RandomForest(40, 12);
console.log('Training Random Forest (40 trees, depth 12)...');
rf.train(trainFeatures, trainLabels);
console.log('Done!\n');

// ============================================
// EVALUATION
// ============================================

console.log('═══════════════════════════════════════════════════════════');
console.log('MODEL EVALUATION');
console.log('═══════════════════════════════════════════════════════════\n');

let correct = 0, tp = 0, fp = 0, fn = 0;
const predictions = [];

for (let i = 0; i < testFeatures.length; i++) {
    const prob = rf.predict(testFeatures[i]);
    predictions.push(prob);
    const pred = prob > 0.5 ? 1 : 0;
    if (pred === testLabels[i]) correct++;
    if (pred === 1 && testLabels[i] === 1) tp++;
    if (pred === 1 && testLabels[i] === 0) fp++;
    if (pred === 0 && testLabels[i] === 1) fn++;
}

console.log('Test Results:');
console.log(`  Accuracy:  ${(correct / testLabels.length * 100).toFixed(1)}%`);
console.log(`  Precision: ${(tp / (tp + fp) * 100).toFixed(1)}%`);
console.log(`  Recall:    ${(tp / (tp + fn) * 100).toFixed(1)}%`);
console.log(`  F1 Score:  ${(2 * tp / (2 * tp + fp + fn) * 100).toFixed(1)}%\n`);

// Backtest with costs
const btResults = backtestWithCosts(predictions, testMeta);
console.log('Backtest with Transaction Costs (0.1% + 0.05% slippage):');
console.log(`  Strategy Return: ${btResults.strategyReturn}%`);
console.log(`  Buy & Hold:      ${btResults.buyHoldReturn}%`);
console.log(`  Trades: ${btResults.trades}, Win Rate: ${btResults.winRate}%`);
console.log(`  Total Costs: $${btResults.totalCosts}\n`);

// ============================================
// FEATURE IMPORTANCE
// ============================================

console.log('═══════════════════════════════════════════════════════════');
console.log('FEATURE IMPORTANCE');
console.log('═══════════════════════════════════════════════════════════\n');

const featureNames = [
    // Stock features
    'Price/SMA10', 'Price/SMA20', 'Price/SMA50', 'Price/SMA200',
    'SMA10/SMA20', 'SMA20/SMA50', 'SMA50/SMA200',
    'RSI(14)', 'MACD Hist', 'MACD Line', 'BB %B', 'BB Width', 'ATR %', 'Vol Ratio',
    '1d Return', '5d Return', '10d Return', '20d Return',
    // Market features
    'VIX', 'SPY/SMA50', 'SPY/SMA200', 'SPY 5d Ret', 'TLT 20d', 'GLD 20d', 'Mkt Regime', 'Vol Regime'
];

const importance = featureNames.map((name, i) => ({
    name,
    importance: (rf.featureImportance[i] || 0) * 100
})).sort((a, b) => b.importance - a.importance);

console.log('Top 10 Most Important Features:');
importance.slice(0, 10).forEach((f, i) => {
    const bar = '█'.repeat(Math.round(f.importance * 2));
    console.log(`  ${(i+1).toString().padStart(2)}. ${f.name.padEnd(14)} ${bar} ${f.importance.toFixed(1)}%`);
});

// ============================================
// CURRENT PREDICTIONS
// ============================================

console.log('\n═══════════════════════════════════════════════════════════');
console.log('CURRENT PREDICTIONS');
console.log('═══════════════════════════════════════════════════════════\n');

const currentPredictions = [];

for (const symbol of trainableSymbols) {
    const { features, metadata } = createEnhancedFeatures(
        allData[symbol], symbol, marketContext, horizon, threshold
    );
    if (features.length === 0) continue;

    const lastFeature = features[features.length - 1];
    const lastMeta = metadata[metadata.length - 1];
    const prob = rf.predict(lastFeature);

    currentPredictions.push({ symbol, price: lastMeta.price, prob });
}

currentPredictions.sort((a, b) => b.prob - a.prob);

console.log('Symbol | Price     | Prob  | Signal');
console.log('-------|-----------|-------|--------');

for (const p of currentPredictions.slice(0, 15)) {
    const signal = p.prob > 0.6 ? 'STRONG BUY' : p.prob > 0.55 ? 'BUY' :
                   p.prob < 0.35 ? 'STRONG AVOID' : p.prob < 0.45 ? 'AVOID' : 'NEUTRAL';
    const emoji = p.prob > 0.55 ? '🟢' : p.prob < 0.45 ? '🔴' : '🟡';
    console.log(`${emoji} ${p.symbol.padEnd(5)} | $${p.price.toFixed(2).padStart(8)} | ${(p.prob*100).toFixed(0).padStart(4)}% | ${signal}`);
}

console.log('\n... and ' + (currentPredictions.length - 15) + ' more\n');

// Top picks
const buys = currentPredictions.filter(p => p.prob > 0.55);
const avoids = currentPredictions.filter(p => p.prob < 0.45);

console.log('═══════════════════════════════════════════════════════════');
console.log('TRADING RECOMMENDATIONS');
console.log('═══════════════════════════════════════════════════════════\n');

console.log(`🟢 BUY CANDIDATES (${buys.length}):`);
buys.slice(0, 5).forEach(p => {
    console.log(`  ${p.symbol}: ${(p.prob*100).toFixed(0)}% | Entry $${p.price.toFixed(2)} → Target $${(p.price*1.03).toFixed(2)} → Stop $${(p.price*0.95).toFixed(2)}`);
});

console.log(`\n🔴 TOP AVOID (${avoids.length}):`);
avoids.slice(-5).reverse().forEach(p => {
    console.log(`  ${p.symbol}: ${(p.prob*100).toFixed(0)}%`);
});

// Market summary
const vixLatest = allData['VIX']?.[allData['VIX'].length - 1]?.close;
const spyProb = currentPredictions.find(p => p.symbol === 'SPY')?.prob || 0.5;

console.log('\n═══════════════════════════════════════════════════════════');
console.log('MARKET SUMMARY');
console.log('═══════════════════════════════════════════════════════════\n');

console.log(`VIX: ${vixLatest?.toFixed(2) || 'N/A'} (${vixLatest < 15 ? 'Low Fear' : vixLatest < 25 ? 'Normal' : 'High Fear'})`);
console.log(`SPY Outlook: ${spyProb > 0.55 ? 'BULLISH' : spyProb < 0.45 ? 'BEARISH' : 'NEUTRAL'} (${(spyProb*100).toFixed(0)}%)`);
console.log(`Buy Signals: ${buys.length} stocks`);
console.log(`Avoid Signals: ${avoids.length} stocks`);

console.log('\n=== Ultimate Training Complete ===');
