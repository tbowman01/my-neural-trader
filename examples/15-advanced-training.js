/**
 * Advanced Neural Training
 *
 * Implements all 4 improvements:
 * 1. Stop-losses to lock in gains
 * 2. Regime detection (bull/bear market switching)
 * 3. MACD and Bollinger Bands signals
 * 4. Momentum strategies for strong uptrends
 */

const fs = require('fs');
const path = require('path');

// Load data
const dataPath = path.join(__dirname, '../historical-data/AAPL-5-years.json');
const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
const prices = data.map(d => d.close);

console.log('=== Advanced Neural Training ===\n');
console.log(`Loaded ${data.length} days of AAPL data\n`);

// ============================================
// HELPER FUNCTIONS
// ============================================

function calculateSMA(prices, period) {
    const result = [];
    for (let i = 0; i < prices.length; i++) {
        if (i < period - 1) result.push(null);
        else {
            const slice = prices.slice(i - period + 1, i + 1);
            result.push(slice.reduce((a, b) => a + b, 0) / period);
        }
    }
    return result;
}

function calculateEMA(prices, period) {
    const result = [];
    const multiplier = 2 / (period + 1);
    let ema = prices[0];

    for (let i = 0; i < prices.length; i++) {
        if (i === 0) {
            result.push(prices[0]);
        } else {
            ema = (prices[i] - ema) * multiplier + ema;
            result.push(ema);
        }
    }
    return result;
}

function calculateMACD(prices) {
    const ema12 = calculateEMA(prices, 12);
    const ema26 = calculateEMA(prices, 26);
    const macdLine = ema12.map((v, i) => v - ema26[i]);
    const signalLine = calculateEMA(macdLine, 9);
    const histogram = macdLine.map((v, i) => v - signalLine[i]);
    return { macdLine, signalLine, histogram };
}

function calculateBollingerBands(prices, period = 20, stdDev = 2) {
    const sma = calculateSMA(prices, period);
    const upper = [], lower = [];

    for (let i = 0; i < prices.length; i++) {
        if (i < period - 1) {
            upper.push(null);
            lower.push(null);
        } else {
            const slice = prices.slice(i - period + 1, i + 1);
            const mean = sma[i];
            const variance = slice.reduce((sum, p) => sum + Math.pow(p - mean, 2), 0) / period;
            const std = Math.sqrt(variance);
            upper.push(mean + stdDev * std);
            lower.push(mean - stdDev * std);
        }
    }
    return { upper, middle: sma, lower };
}

function calculateRSI(prices, period = 14) {
    const rsi = new Array(prices.length).fill(null);
    for (let i = period; i < prices.length; i++) {
        let gains = 0, losses = 0;
        for (let j = i - period + 1; j <= i; j++) {
            const change = prices[j] - prices[j - 1];
            if (change > 0) gains += change;
            else losses -= change;
        }
        const rs = losses === 0 ? 100 : gains / losses;
        rsi[i] = 100 - (100 / (1 + rs));
    }
    return rsi;
}

function calculateMomentum(prices, period = 10) {
    const momentum = [];
    for (let i = 0; i < prices.length; i++) {
        if (i < period) momentum.push(null);
        else momentum.push(((prices[i] - prices[i - period]) / prices[i - period]) * 100);
    }
    return momentum;
}

// ============================================
// 1. STRATEGY WITH STOP-LOSSES
// ============================================

console.log('═══════════════════════════════════════════════════════════');
console.log('1. SMA STRATEGY WITH STOP-LOSSES');
console.log('═══════════════════════════════════════════════════════════\n');

function runWithStopLoss(prices, fastPeriod, slowPeriod, stopLossPct, takeProfitPct) {
    const smaFast = calculateSMA(prices, fastPeriod);
    const smaSlow = calculateSMA(prices, slowPeriod);

    let cash = 10000, shares = 0, entryPrice = 0;
    let trades = [], wins = 0;

    for (let i = slowPeriod; i < prices.length; i++) {
        const price = prices[i];

        // Check stop-loss and take-profit if in position
        if (shares > 0) {
            const pnlPct = ((price - entryPrice) / entryPrice) * 100;

            // Stop-loss hit
            if (pnlPct <= -stopLossPct) {
                cash = shares * price;
                trades.push({ type: 'stop-loss', pnl: pnlPct });
                shares = 0;
                continue;
            }

            // Take-profit hit
            if (pnlPct >= takeProfitPct) {
                cash = shares * price;
                trades.push({ type: 'take-profit', pnl: pnlPct });
                if (pnlPct > 0) wins++;
                shares = 0;
                continue;
            }
        }

        // Entry signal: fast crosses above slow
        if (shares === 0 && smaFast[i] > smaSlow[i] && smaFast[i-1] <= smaSlow[i-1]) {
            shares = cash / price;
            entryPrice = price;
            cash = 0;
        }

        // Exit signal: fast crosses below slow
        if (shares > 0 && smaFast[i] < smaSlow[i] && smaFast[i-1] >= smaSlow[i-1]) {
            const pnlPct = ((price - entryPrice) / entryPrice) * 100;
            cash = shares * price;
            trades.push({ type: 'signal', pnl: pnlPct });
            if (pnlPct > 0) wins++;
            shares = 0;
        }
    }

    // Close any open position
    if (shares > 0) {
        cash = shares * prices[prices.length - 1];
    }

    const totalReturn = ((cash - 10000) / 10000) * 100;
    const winRate = trades.length > 0 ? (wins / trades.length) * 100 : 0;

    return { totalReturn, trades: trades.length, winRate, tradeDetails: trades };
}

// Test different stop-loss levels
console.log('Testing SMA(5/20) with different stop-loss/take-profit levels:\n');
console.log('Stop-Loss | Take-Profit | Return  | Trades | Win Rate');
console.log('----------|-------------|---------|--------|----------');

const stopLossTests = [
    { sl: 0, tp: 100 },   // No stop-loss (baseline)
    { sl: 3, tp: 10 },
    { sl: 5, tp: 15 },
    { sl: 5, tp: 20 },
    { sl: 7, tp: 20 },
    { sl: 10, tp: 30 },
];

let bestStopLoss = null;
let bestReturn = -Infinity;

stopLossTests.forEach(({ sl, tp }) => {
    const result = runWithStopLoss(prices, 5, 20, sl, tp);
    const slLabel = sl === 0 ? 'None' : `${sl}%`;
    const tpLabel = tp === 100 ? 'None' : `${tp}%`;
    console.log(`${slLabel.padEnd(9)} | ${tpLabel.padEnd(11)} | ${result.totalReturn.toFixed(1).padStart(6)}% | ${String(result.trades).padStart(6)} | ${result.winRate.toFixed(1)}%`);

    if (result.totalReturn > bestReturn) {
        bestReturn = result.totalReturn;
        bestStopLoss = { sl, tp };
    }
});

console.log(`\n🏆 Best: Stop-Loss ${bestStopLoss.sl}%, Take-Profit ${bestStopLoss.tp}% = ${bestReturn.toFixed(1)}%`);

// ============================================
// 2. REGIME DETECTION
// ============================================

console.log('\n═══════════════════════════════════════════════════════════');
console.log('2. REGIME DETECTION (BULL/BEAR MARKET SWITCHING)');
console.log('═══════════════════════════════════════════════════════════\n');

function detectRegime(prices, index, sma50, sma200) {
    if (index < 200) return 'unknown';

    const price = prices[index];
    const slope200 = (sma200[index] - sma200[index - 50]) / sma200[index - 50] * 100;

    if (price > sma200[index] && slope200 > 0) return 'bull';
    if (price < sma200[index] && slope200 < 0) return 'bear';
    return 'transition';
}

function runRegimeAdaptive(prices) {
    const sma5 = calculateSMA(prices, 5);
    const sma20 = calculateSMA(prices, 20);
    const sma50 = calculateSMA(prices, 50);
    const sma200 = calculateSMA(prices, 200);

    let cash = 10000, shares = 0;
    let trades = [], regimeHistory = { bull: 0, bear: 0, transition: 0 };

    for (let i = 200; i < prices.length; i++) {
        const price = prices[i];
        const regime = detectRegime(prices, i, sma50, sma200);
        regimeHistory[regime]++;

        if (regime === 'bull') {
            // Aggressive: Use fast SMA crossover
            if (shares === 0 && sma5[i] > sma20[i] && sma5[i-1] <= sma20[i-1]) {
                shares = cash / price;
                cash = 0;
                trades.push({ regime: 'bull', action: 'buy' });
            }
            if (shares > 0 && sma5[i] < sma20[i]) {
                cash = shares * price;
                shares = 0;
                trades.push({ regime: 'bull', action: 'sell' });
            }
        } else if (regime === 'bear') {
            // Defensive: Stay in cash, only buy at extreme oversold
            if (shares > 0) {
                cash = shares * price;
                shares = 0;
                trades.push({ regime: 'bear', action: 'exit-to-cash' });
            }
        } else {
            // Transition: Use slower signals
            if (shares === 0 && sma20[i] > sma50[i] && sma20[i-1] <= sma50[i-1]) {
                shares = cash / price;
                cash = 0;
                trades.push({ regime: 'transition', action: 'buy' });
            }
            if (shares > 0 && sma20[i] < sma50[i]) {
                cash = shares * price;
                shares = 0;
                trades.push({ regime: 'transition', action: 'sell' });
            }
        }
    }

    if (shares > 0) cash = shares * prices[prices.length - 1];

    return {
        totalReturn: ((cash - 10000) / 10000) * 100,
        trades: trades.length,
        regimeHistory
    };
}

// Compare static vs regime-adaptive
const staticResult = runWithStopLoss(prices, 5, 20, 0, 100);
const adaptiveResult = runRegimeAdaptive(prices);
const buyHold = ((prices[prices.length - 1] - prices[0]) / prices[0]) * 100;

console.log('Strategy Comparison:');
console.log('--------------------');
console.log(`Static SMA(5/20):     ${staticResult.totalReturn.toFixed(1)}% (${staticResult.trades} trades)`);
console.log(`Regime-Adaptive:      ${adaptiveResult.totalReturn.toFixed(1)}% (${adaptiveResult.trades} trades)`);
console.log(`Buy & Hold:           ${buyHold.toFixed(1)}%`);

console.log('\nRegime Distribution:');
const total = Object.values(adaptiveResult.regimeHistory).reduce((a, b) => a + b, 0);
console.log(`  Bull:       ${(adaptiveResult.regimeHistory.bull / total * 100).toFixed(1)}% of days`);
console.log(`  Bear:       ${(adaptiveResult.regimeHistory.bear / total * 100).toFixed(1)}% of days`);
console.log(`  Transition: ${(adaptiveResult.regimeHistory.transition / total * 100).toFixed(1)}% of days`);

// ============================================
// 3. MACD AND BOLLINGER BANDS
// ============================================

console.log('\n═══════════════════════════════════════════════════════════');
console.log('3. MACD AND BOLLINGER BANDS SIGNALS');
console.log('═══════════════════════════════════════════════════════════\n');

function runMACDStrategy(prices) {
    const { macdLine, signalLine, histogram } = calculateMACD(prices);

    let cash = 10000, shares = 0;
    let trades = [], wins = 0;
    let entryPrice = 0;

    for (let i = 30; i < prices.length; i++) {
        // MACD crossover
        const macdCrossUp = histogram[i] > 0 && histogram[i-1] <= 0;
        const macdCrossDown = histogram[i] < 0 && histogram[i-1] >= 0;

        if (shares === 0 && macdCrossUp) {
            shares = cash / prices[i];
            entryPrice = prices[i];
            cash = 0;
        }

        if (shares > 0 && macdCrossDown) {
            cash = shares * prices[i];
            if (prices[i] > entryPrice) wins++;
            trades.push((prices[i] - entryPrice) / entryPrice * 100);
            shares = 0;
        }
    }

    if (shares > 0) cash = shares * prices[prices.length - 1];

    return {
        totalReturn: ((cash - 10000) / 10000) * 100,
        trades: trades.length,
        winRate: trades.length > 0 ? (wins / trades.length) * 100 : 0
    };
}

function runBollingerStrategy(prices) {
    const bb = calculateBollingerBands(prices, 20, 2);

    let cash = 10000, shares = 0;
    let trades = [], wins = 0;
    let entryPrice = 0;

    for (let i = 25; i < prices.length; i++) {
        const price = prices[i];

        // Buy when price touches lower band (oversold)
        if (shares === 0 && price <= bb.lower[i] && bb.lower[i]) {
            shares = cash / price;
            entryPrice = price;
            cash = 0;
        }

        // Sell when price touches upper band (overbought) or middle band
        if (shares > 0 && price >= bb.middle[i]) {
            cash = shares * price;
            if (price > entryPrice) wins++;
            trades.push((price - entryPrice) / entryPrice * 100);
            shares = 0;
        }
    }

    if (shares > 0) cash = shares * prices[prices.length - 1];

    return {
        totalReturn: ((cash - 10000) / 10000) * 100,
        trades: trades.length,
        winRate: trades.length > 0 ? (wins / trades.length) * 100 : 0
    };
}

function runCombinedIndicators(prices) {
    const { histogram } = calculateMACD(prices);
    const bb = calculateBollingerBands(prices, 20, 2);
    const rsi = calculateRSI(prices, 14);

    let cash = 10000, shares = 0;
    let trades = [], wins = 0;
    let entryPrice = 0;

    for (let i = 30; i < prices.length; i++) {
        const price = prices[i];

        // Combined buy signal: MACD bullish + price near lower BB + RSI oversold
        const macdBullish = histogram[i] > 0;
        const nearLowerBB = bb.lower[i] && price < bb.middle[i];
        const rsiOversold = rsi[i] && rsi[i] < 40;

        if (shares === 0 && macdBullish && nearLowerBB && rsiOversold) {
            shares = cash / price;
            entryPrice = price;
            cash = 0;
        }

        // Sell: MACD bearish OR RSI overbought OR price at upper BB
        const macdBearish = histogram[i] < 0 && histogram[i-1] >= 0;
        const rsiOverbought = rsi[i] && rsi[i] > 70;
        const atUpperBB = bb.upper[i] && price >= bb.upper[i];

        if (shares > 0 && (macdBearish || rsiOverbought || atUpperBB)) {
            cash = shares * price;
            if (price > entryPrice) wins++;
            trades.push((price - entryPrice) / entryPrice * 100);
            shares = 0;
        }
    }

    if (shares > 0) cash = shares * prices[prices.length - 1];

    return {
        totalReturn: ((cash - 10000) / 10000) * 100,
        trades: trades.length,
        winRate: trades.length > 0 ? (wins / trades.length) * 100 : 0
    };
}

const macdResult = runMACDStrategy(prices);
const bbResult = runBollingerStrategy(prices);
const combinedResult = runCombinedIndicators(prices);

console.log('Indicator Strategy Comparison:');
console.log('------------------------------');
console.log(`Strategy          | Return  | Trades | Win Rate`);
console.log(`------------------|---------|--------|----------`);
console.log(`MACD Crossover    | ${macdResult.totalReturn.toFixed(1).padStart(6)}% | ${String(macdResult.trades).padStart(6)} | ${macdResult.winRate.toFixed(1)}%`);
console.log(`Bollinger Bands   | ${bbResult.totalReturn.toFixed(1).padStart(6)}% | ${String(bbResult.trades).padStart(6)} | ${bbResult.winRate.toFixed(1)}%`);
console.log(`Combined (MACD+BB+RSI) | ${combinedResult.totalReturn.toFixed(1).padStart(6)}% | ${String(combinedResult.trades).padStart(6)} | ${combinedResult.winRate.toFixed(1)}%`);
console.log(`Buy & Hold        | ${buyHold.toFixed(1).padStart(6)}% |      1 | N/A`);

// ============================================
// 4. MOMENTUM STRATEGY
// ============================================

console.log('\n═══════════════════════════════════════════════════════════');
console.log('4. MOMENTUM STRATEGY FOR STRONG UPTRENDS');
console.log('═══════════════════════════════════════════════════════════\n');

function runMomentumStrategy(prices, momentumPeriod = 20, threshold = 5) {
    const momentum = calculateMomentum(prices, momentumPeriod);
    const sma200 = calculateSMA(prices, 200);

    let cash = 10000, shares = 0;
    let trades = [], wins = 0;
    let entryPrice = 0;

    for (let i = 200; i < prices.length; i++) {
        const price = prices[i];
        const mom = momentum[i];
        const inUptrend = price > sma200[i];

        // Buy: Strong momentum in uptrend
        if (shares === 0 && inUptrend && mom > threshold) {
            shares = cash / price;
            entryPrice = price;
            cash = 0;
        }

        // Sell: Momentum weakens or trend breaks
        if (shares > 0 && (mom < 0 || !inUptrend)) {
            cash = shares * price;
            if (price > entryPrice) wins++;
            trades.push((price - entryPrice) / entryPrice * 100);
            shares = 0;
        }
    }

    if (shares > 0) cash = shares * prices[prices.length - 1];

    return {
        totalReturn: ((cash - 10000) / 10000) * 100,
        trades: trades.length,
        winRate: trades.length > 0 ? (wins / trades.length) * 100 : 0,
        avgTrade: trades.length > 0 ? trades.reduce((a, b) => a + b, 0) / trades.length : 0
    };
}

console.log('Testing Momentum Strategy with different thresholds:\n');
console.log('Period | Threshold | Return  | Trades | Win Rate | Avg Trade');
console.log('-------|-----------|---------|--------|----------|----------');

const momentumTests = [
    { period: 10, threshold: 3 },
    { period: 10, threshold: 5 },
    { period: 20, threshold: 5 },
    { period: 20, threshold: 10 },
    { period: 30, threshold: 10 },
];

let bestMomentum = null;
let bestMomReturn = -Infinity;

momentumTests.forEach(({ period, threshold }) => {
    const result = runMomentumStrategy(prices, period, threshold);
    console.log(`${String(period).padStart(6)} | ${String(threshold + '%').padStart(9)} | ${result.totalReturn.toFixed(1).padStart(6)}% | ${String(result.trades).padStart(6)} | ${result.winRate.toFixed(1).padStart(7)}% | ${result.avgTrade.toFixed(1)}%`);

    if (result.totalReturn > bestMomReturn) {
        bestMomReturn = result.totalReturn;
        bestMomentum = { period, threshold };
    }
});

console.log(`\n🏆 Best Momentum: ${bestMomentum.period}-day period, ${bestMomentum.threshold}% threshold = ${bestMomReturn.toFixed(1)}%`);

// ============================================
// FINAL SUMMARY
// ============================================

console.log('\n═══════════════════════════════════════════════════════════');
console.log('FINAL SUMMARY - ALL STRATEGIES COMPARED');
console.log('═══════════════════════════════════════════════════════════\n');

const allResults = [
    { name: 'Buy & Hold', return: buyHold, trades: 1 },
    { name: 'SMA(5/20) Basic', return: staticResult.totalReturn, trades: staticResult.trades },
    { name: `SMA + Stop-Loss(${bestStopLoss.sl}%/${bestStopLoss.tp}%)`, return: bestReturn, trades: '-' },
    { name: 'Regime-Adaptive', return: adaptiveResult.totalReturn, trades: adaptiveResult.trades },
    { name: 'MACD Crossover', return: macdResult.totalReturn, trades: macdResult.trades },
    { name: 'Bollinger Bands', return: bbResult.totalReturn, trades: bbResult.trades },
    { name: 'Combined Indicators', return: combinedResult.totalReturn, trades: combinedResult.trades },
    { name: `Momentum(${bestMomentum.period}d/${bestMomentum.threshold}%)`, return: bestMomReturn, trades: '-' },
];

allResults.sort((a, b) => b.return - a.return);

console.log('Rank | Strategy                        | Return');
console.log('-----|--------------------------------|--------');
allResults.forEach((r, i) => {
    const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '  ';
    console.log(`${medal} ${i + 1}  | ${r.name.padEnd(30)} | ${r.return.toFixed(1)}%`);
});

console.log('\n═══════════════════════════════════════════════════════════');
console.log('KEY INSIGHTS');
console.log('═══════════════════════════════════════════════════════════\n');

console.log('1. STOP-LOSSES:');
console.log('   - Can improve returns by cutting losers early');
console.log('   - Best combo found: ' + bestStopLoss.sl + '% stop, ' + bestStopLoss.tp + '% take-profit\n');

console.log('2. REGIME DETECTION:');
console.log('   - Staying in cash during bear markets protects capital');
console.log('   - ' + (adaptiveResult.regimeHistory.bear / total * 100).toFixed(1) + '% of days were bearish\n');

console.log('3. INDICATORS:');
console.log('   - MACD good for trend following');
console.log('   - Bollinger Bands good for mean reversion');
console.log('   - Combined approach filters noise but may miss moves\n');

console.log('4. MOMENTUM:');
console.log('   - Works well in strong uptrends');
console.log('   - Best when combined with trend filter (price > SMA200)\n');

console.log('=== Training Complete ===');
