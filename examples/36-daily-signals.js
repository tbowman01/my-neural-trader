/**
 * Example 36: Daily Trading Signals Generator
 *
 * Production-ready script that:
 * 1. Downloads latest market data
 * 2. Runs the trained model
 * 3. Generates actionable trading signals
 * 4. Outputs position sizing recommendations
 *
 * Run daily before market open: node examples/36-daily-signals.js
 */

const fs = require('fs');
const path = require('path');

// ============================================================================
// CONFIGURATION
// ============================================================================

const CONFIG = {
    // Portfolio settings
    capital: 100000,          // Total capital
    maxPositionPct: 0.10,     // Max 10% per position
    riskPerTrade: 0.02,       // Risk 2% per trade
    atrMultiple: 2,           // Stop loss = 2x ATR

    // Signal thresholds
    strongBuyThreshold: 0.60,   // Strong buy signal
    buyThreshold: 0.55,         // Buy signal
    watchThreshold: 0.50,       // Watch list
    avoidThreshold: 0.40,       // Avoid

    // Model settings
    nTrees: 100,
    maxDepth: 8,
    minSamplesLeaf: 8
};

// ============================================================================
// DATA LOADING
// ============================================================================

function loadAllData() {
    const dataDir = path.join(__dirname, '..', 'historical-data');
    const files = fs.readdirSync(dataDir).filter(f => f.endsWith('.json'));
    const allData = {};

    files.forEach(file => {
        try {
            const symbol = file.replace('.json', '').replace('-5-years', '').toUpperCase();
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
            rsi: rsi,
            macd: macd,
            sma20: sma20,
            sma50: sma50,
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
// RANDOM FOREST MODEL
// ============================================================================

class RandomForest {
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

            if ((t + 1) % 25 === 0) {
                process.stdout.write(`  Training: ${t + 1}/${this.nTrees} trees\r`);
            }
        }
        console.log(`  Training: ${this.nTrees}/${this.nTrees} trees - Done`);
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
        const n = y.length;
        return parentGini - (leftIdx.length / n * gini(leftIdx) + rightIdx.length / n * gini(rightIdx));
    }

    predict(x) {
        const probs = this.trees.map(tree => this.predictTree(tree, x));
        return probs.reduce((a, b) => a + b, 0) / probs.length;
    }

    predictTree(node, x) {
        if (node.leaf) return node.prob;
        if (x[node.fIdx] <= node.thresh) return this.predictTree(node.left, x);
        return this.predictTree(node.right, x);
    }
}

// ============================================================================
// POSITION SIZING
// ============================================================================

function calculatePosition(capital, price, atr, probability) {
    const stopDistance = atr * CONFIG.atrMultiple;
    const dollarRisk = capital * CONFIG.riskPerTrade;
    const baseSize = dollarRisk / stopDistance;
    const confidenceMultiplier = Math.max(0.5, (probability - 0.5) * 4);
    const maxPosition = capital * CONFIG.maxPositionPct / price;
    const shares = Math.min(Math.floor(baseSize * confidenceMultiplier), Math.floor(maxPosition), 500);

    return {
        shares,
        stopLoss: (price - stopDistance).toFixed(2),
        takeProfit: (price + stopDistance * 2).toFixed(2),
        positionValue: (shares * price).toFixed(2),
        riskDollars: (shares * stopDistance).toFixed(2)
    };
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];

    console.log('');
    console.log('╔═══════════════════════════════════════════════════════════════════╗');
    console.log('║              DAILY TRADING SIGNALS - ' + dateStr + '               ║');
    console.log('╚═══════════════════════════════════════════════════════════════════╝');
    console.log('');

    // Load data
    console.log('[1/4] Loading market data...');
    const allData = loadAllData();
    const symbols = Object.keys(allData);
    console.log(`      Loaded ${symbols.length} symbols\n`);

    // Prepare training data
    console.log('[2/4] Preparing training data...');
    const allSamples = [];

    for (const symbol of symbols) {
        const indicators = calculateIndicators(allData[symbol]);
        for (let i = 0; i < indicators.length - 5; i++) {
            const futureReturn = (indicators[i + 5].close - indicators[i].close) / indicators[i].close;
            const label = futureReturn > 0.01 ? 1 : 0;
            allSamples.push({
                features: indicators[i].features,
                label: label
            });
        }
    }

    allSamples.sort((a, b) => Math.random() - 0.5);  // Shuffle
    console.log(`      ${allSamples.length.toLocaleString()} training samples\n`);

    // Train model
    console.log('[3/4] Training model...');
    const X = allSamples.map(s => s.features);
    const y = allSamples.map(s => s.label);

    const model = new RandomForest({
        nTrees: CONFIG.nTrees,
        maxDepth: CONFIG.maxDepth,
        minSamplesLeaf: CONFIG.minSamplesLeaf
    });
    model.train(X, y);
    console.log('');

    // Generate signals
    console.log('[4/4] Generating signals...\n');

    const signals = [];

    for (const symbol of symbols) {
        const indicators = calculateIndicators(allData[symbol]);
        if (indicators.length > 0) {
            const latest = indicators[indicators.length - 1];
            const prob = model.predict(latest.features);
            const position = calculatePosition(CONFIG.capital, latest.close, latest.atr, prob);

            signals.push({
                symbol: symbol.replace('-5-YEARS', ''),
                probability: prob,
                price: latest.close,
                atr: latest.atr,
                rsi: latest.rsi,
                trend: latest.close > latest.sma50 ? 'UP' : 'DOWN',
                ...position
            });
        }
    }

    // Sort by probability
    signals.sort((a, b) => b.probability - a.probability);

    // Display results
    console.log('╔═══════════════════════════════════════════════════════════════════╗');
    console.log('║                      STRONG BUY SIGNALS                           ║');
    console.log('╚═══════════════════════════════════════════════════════════════════╝');

    const strongBuys = signals.filter(s => s.probability >= CONFIG.strongBuyThreshold);
    if (strongBuys.length === 0) {
        console.log('  No strong buy signals today.\n');
    } else {
        console.log('');
        console.log('  Symbol    | Prob  | Price    | Shares | Stop     | Target   | Risk $');
        console.log('  ----------|-------|----------|--------|----------|----------|--------');
        strongBuys.forEach(s => {
            console.log(
                `  ${s.symbol.padEnd(9)} | ${(s.probability * 100).toFixed(1)}% | ` +
                `$${s.price.toFixed(2).padStart(7)} | ${String(s.shares).padStart(6)} | ` +
                `$${s.stopLoss.padStart(7)} | $${s.takeProfit.padStart(7)} | $${s.riskDollars}`
            );
        });
        console.log('');
    }

    console.log('╔═══════════════════════════════════════════════════════════════════╗');
    console.log('║                        BUY SIGNALS                                ║');
    console.log('╚═══════════════════════════════════════════════════════════════════╝');

    const buys = signals.filter(s => s.probability >= CONFIG.buyThreshold && s.probability < CONFIG.strongBuyThreshold);
    if (buys.length === 0) {
        console.log('  No buy signals today.\n');
    } else {
        console.log('');
        console.log('  Symbol    | Prob  | Price    | Trend | RSI  | Shares');
        console.log('  ----------|-------|----------|-------|------|-------');
        buys.slice(0, 10).forEach(s => {
            console.log(
                `  ${s.symbol.padEnd(9)} | ${(s.probability * 100).toFixed(1)}% | ` +
                `$${s.price.toFixed(2).padStart(7)} | ${s.trend.padEnd(5)} | ${s.rsi.toFixed(0).padStart(4)} | ${s.shares}`
            );
        });
        console.log('');
    }

    console.log('╔═══════════════════════════════════════════════════════════════════╗');
    console.log('║                        WATCH LIST                                 ║');
    console.log('╚═══════════════════════════════════════════════════════════════════╝');

    const watchlist = signals.filter(s => s.probability >= CONFIG.watchThreshold && s.probability < CONFIG.buyThreshold);
    if (watchlist.length === 0) {
        console.log('  Empty watch list.\n');
    } else {
        console.log('');
        watchlist.slice(0, 8).forEach(s => {
            console.log(`  ${s.symbol.padEnd(9)} | ${(s.probability * 100).toFixed(1)}% | $${s.price.toFixed(2)} | ${s.trend}`);
        });
        console.log('');
    }

    console.log('╔═══════════════════════════════════════════════════════════════════╗');
    console.log('║                        AVOID (BEARISH)                            ║');
    console.log('╚═══════════════════════════════════════════════════════════════════╝');

    const avoids = signals.filter(s => s.probability < CONFIG.avoidThreshold);
    if (avoids.length === 0) {
        console.log('  No bearish signals.\n');
    } else {
        console.log('');
        avoids.slice(-8).forEach(s => {
            console.log(`  ${s.symbol.padEnd(9)} | ${(s.probability * 100).toFixed(1)}% | $${s.price.toFixed(2)} | ${s.trend}`);
        });
        console.log('');
    }

    // Market summary
    console.log('╔═══════════════════════════════════════════════════════════════════╗');
    console.log('║                      MARKET SUMMARY                               ║');
    console.log('╚═══════════════════════════════════════════════════════════════════╝');
    console.log('');

    const spySignal = signals.find(s => s.symbol === 'SPY');
    const qqqSignal = signals.find(s => s.symbol === 'QQQ');
    const vixSignal = signals.find(s => s.symbol === '^VIX' || s.symbol === 'VIX');

    if (spySignal) {
        const spySentiment = spySignal.probability > 0.55 ? 'BULLISH' :
                            spySignal.probability < 0.45 ? 'BEARISH' : 'NEUTRAL';
        console.log(`  S&P 500 (SPY):  ${spySentiment} (${(spySignal.probability * 100).toFixed(1)}%)`);
    }
    if (qqqSignal) {
        const qqqSentiment = qqqSignal.probability > 0.55 ? 'BULLISH' :
                            qqqSignal.probability < 0.45 ? 'BEARISH' : 'NEUTRAL';
        console.log(`  NASDAQ (QQQ):   ${qqqSentiment} (${(qqqSignal.probability * 100).toFixed(1)}%)`);
    }

    const bullCount = signals.filter(s => s.probability > 0.55).length;
    const bearCount = signals.filter(s => s.probability < 0.45).length;
    const breadth = ((bullCount - bearCount) / signals.length * 100).toFixed(1);

    console.log(`  Market Breadth: ${breadth > 0 ? '+' : ''}${breadth}% (${bullCount} bullish, ${bearCount} bearish)`);
    console.log('');

    console.log('═══════════════════════════════════════════════════════════════════');
    console.log(`  Generated: ${now.toISOString()}`);
    console.log(`  Capital: $${CONFIG.capital.toLocaleString()} | Risk/Trade: ${CONFIG.riskPerTrade * 100}%`);
    console.log('═══════════════════════════════════════════════════════════════════\n');
}

main().catch(console.error);
