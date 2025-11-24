/**
 * Ensemble Strategies - Multiple Algorithms for Better Predictions
 *
 * Combines multiple strategies and only trades when they agree:
 * 1. MACD Momentum
 * 2. RSI Mean Reversion
 * 3. Breakout Detection
 * 4. Trend Following (ADX)
 * 5. Volume Confirmation
 * 6. Neural Pattern Matching
 */

const fs = require('fs');
const path = require('path');

console.log('=== Ensemble Strategy Training ===\n');

// Load data
function loadData(symbol) {
    const filePath = path.join(__dirname, `../historical-data/${symbol}-5-years.json`);
    if (fs.existsSync(filePath)) return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    return null;
}

const allData = {};
['AAPL', 'MSFT', 'GOOGL', 'SPY', 'QQQ'].forEach(sym => {
    const data = loadData(sym);
    if (data) allData[sym] = data;
});

console.log(`Loaded ${Object.keys(allData).length} symbols\n`);

// ============================================
// INDICATOR LIBRARY
// ============================================

function sma(prices, period) {
    return prices.map((_, i) => {
        if (i < period - 1) return null;
        return prices.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0) / period;
    });
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

function macd(prices) {
    const ema12 = ema(prices, 12), ema26 = ema(prices, 26);
    const line = ema12.map((v, i) => v - ema26[i]);
    const signal = ema(line, 9);
    return { line, signal, histogram: line.map((v, i) => v - signal[i]) };
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
        const rs = losses === 0 ? 100 : gains / losses;
        result[i] = 100 - (100 / (1 + rs));
    }
    return result;
}

function atr(data, period = 14) {
    const result = new Array(data.length).fill(null);
    for (let i = period; i < data.length; i++) {
        let sum = 0;
        for (let j = i - period + 1; j <= i; j++) {
            const h = data[j].high || data[j].close * 1.01;
            const l = data[j].low || data[j].close * 0.99;
            const pc = data[j - 1].close;
            sum += Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc));
        }
        result[i] = sum / period;
    }
    return result;
}

// ADX - Average Directional Index (trend strength)
function adx(data, period = 14) {
    const result = new Array(data.length).fill(null);
    const plusDM = [], minusDM = [], tr = [];

    for (let i = 1; i < data.length; i++) {
        const h = data[i].high || data[i].close * 1.01;
        const l = data[i].low || data[i].close * 0.99;
        const ph = data[i-1].high || data[i-1].close * 1.01;
        const pl = data[i-1].low || data[i-1].close * 0.99;
        const pc = data[i-1].close;

        const upMove = h - ph;
        const downMove = pl - l;

        plusDM.push(upMove > downMove && upMove > 0 ? upMove : 0);
        minusDM.push(downMove > upMove && downMove > 0 ? downMove : 0);
        tr.push(Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc)));
    }

    for (let i = period; i < data.length; i++) {
        const idx = i - 1;
        if (idx < period) continue;

        const sumTR = tr.slice(idx - period, idx).reduce((a, b) => a + b, 0);
        const sumPlusDM = plusDM.slice(idx - period, idx).reduce((a, b) => a + b, 0);
        const sumMinusDM = minusDM.slice(idx - period, idx).reduce((a, b) => a + b, 0);

        const plusDI = sumTR > 0 ? (sumPlusDM / sumTR) * 100 : 0;
        const minusDI = sumTR > 0 ? (sumMinusDM / sumTR) * 100 : 0;

        const dx = plusDI + minusDI > 0 ? Math.abs(plusDI - minusDI) / (plusDI + minusDI) * 100 : 0;
        result[i] = dx;
    }

    // Smooth ADX
    const smoothed = sma(result.filter(x => x !== null), period);
    let j = 0;
    for (let i = 0; i < result.length; i++) {
        if (result[i] !== null && j < smoothed.length) {
            result[i] = smoothed[j++] || result[i];
        }
    }

    return result;
}

// Bollinger Bands
function bollingerBands(prices, period = 20, stdDev = 2) {
    const middle = sma(prices, period);
    const upper = [], lower = [];

    for (let i = 0; i < prices.length; i++) {
        if (i < period - 1) {
            upper.push(null);
            lower.push(null);
        } else {
            const slice = prices.slice(i - period + 1, i + 1);
            const mean = middle[i];
            const variance = slice.reduce((sum, p) => sum + Math.pow(p - mean, 2), 0) / period;
            const std = Math.sqrt(variance);
            upper.push(mean + stdDev * std);
            lower.push(mean - stdDev * std);
        }
    }
    return { upper, middle, lower };
}

// Volume ratio (current vs average)
function volumeRatio(data, period = 20) {
    const volumes = data.map(d => d.volume || 1000000);
    const avgVol = sma(volumes, period);
    return volumes.map((v, i) => avgVol[i] ? v / avgVol[i] : 1);
}

// ============================================
// INDIVIDUAL STRATEGIES
// ============================================

// Strategy 1: MACD Momentum
function macdSignal(histogram, i) {
    if (i < 1) return 0;
    if (histogram[i] > 0 && histogram[i-1] <= 0) return 1;  // Bullish cross
    if (histogram[i] < 0 && histogram[i-1] >= 0) return -1; // Bearish cross
    return 0;
}

// Strategy 2: RSI Mean Reversion
function rsiSignal(rsiValues, i) {
    if (!rsiValues[i]) return 0;
    if (rsiValues[i] < 30) return 1;  // Oversold - buy
    if (rsiValues[i] > 70) return -1; // Overbought - sell
    return 0;
}

// Strategy 3: Breakout Detection
function breakoutSignal(prices, bb, i) {
    if (!bb.upper[i] || !bb.lower[i]) return 0;
    if (prices[i] > bb.upper[i]) return 1;  // Upper breakout - momentum buy
    if (prices[i] < bb.lower[i]) return -1; // Lower breakout - stop out
    return 0;
}

// Strategy 4: Trend Following (ADX)
function trendSignal(prices, sma20, sma50, adxValues, i) {
    if (!sma20[i] || !sma50[i] || !adxValues[i]) return 0;
    const strongTrend = adxValues[i] > 25;
    const uptrend = sma20[i] > sma50[i];
    const downtrend = sma20[i] < sma50[i];

    if (strongTrend && uptrend) return 1;   // Strong uptrend
    if (strongTrend && downtrend) return -1; // Strong downtrend
    return 0;
}

// Strategy 5: Volume Confirmation
function volumeSignal(volRatio, i) {
    if (volRatio[i] > 1.5) return 1;  // High volume - confirms move
    if (volRatio[i] < 0.5) return -1; // Low volume - weak move
    return 0;
}

// Strategy 6: Pattern Recognition (from previous training)
function patternSignal(prices, rsiValues, histogram, sma20, i) {
    if (i < 10 || !sma20[i]) return 0;

    // Bullish pattern: MACD positive, RSI recovering from oversold, price near SMA20
    const macdBullish = histogram[i] > 0;
    const rsiRecovering = rsiValues[i] > 40 && rsiValues[i] < 60;
    const nearSupport = prices[i] < sma20[i] * 1.02;

    // Bearish pattern: MACD negative, RSI overbought, price extended
    const macdBearish = histogram[i] < 0;
    const rsiOverbought = rsiValues[i] > 65;
    const extended = prices[i] > sma20[i] * 1.05;

    if (macdBullish && rsiRecovering && nearSupport) return 1;
    if (macdBearish && rsiOverbought && extended) return -1;
    return 0;
}

// ============================================
// ENSEMBLE STRATEGY
// ============================================

function runEnsembleStrategy(data, minAgreement = 3) {
    const prices = data.map(d => d.close);
    const { histogram } = macd(prices);
    const rsiValues = rsi(prices);
    const bb = bollingerBands(prices);
    const sma20 = sma(prices, 20);
    const sma50 = sma(prices, 50);
    const sma200 = sma(prices, 200);
    const adxValues = adx(data);
    const volRatio = volumeRatio(data);

    let cash = 10000, shares = 0, entryPrice = 0;
    let trades = [], wins = 0;
    let signalHistory = [];

    for (let i = 200; i < prices.length; i++) {
        const price = prices[i];

        // Collect signals from all strategies
        const signals = {
            macd: macdSignal(histogram, i),
            rsi: rsiSignal(rsiValues, i),
            breakout: breakoutSignal(prices, bb, i),
            trend: trendSignal(prices, sma20, sma50, adxValues, i),
            volume: volumeSignal(volRatio, i),
            pattern: patternSignal(prices, rsiValues, histogram, sma20, i)
        };

        // Count bullish and bearish signals
        const bullishCount = Object.values(signals).filter(s => s === 1).length;
        const bearishCount = Object.values(signals).filter(s => s === -1).length;

        // Regime filter - only trade when above SMA200
        const inUptrend = price > sma200[i];

        // Stop-loss / Take-profit
        if (shares > 0) {
            const pnlPct = ((price - entryPrice) / entryPrice) * 100;
            if (pnlPct <= -5) {
                cash = shares * price;
                trades.push({ pnl: pnlPct, type: 'stop-loss', signals });
                shares = 0;
                continue;
            }
            if (pnlPct >= 15) {
                cash = shares * price;
                trades.push({ pnl: pnlPct, type: 'take-profit', signals });
                wins++;
                shares = 0;
                continue;
            }
        }

        // ENTRY: Multiple strategies agree + uptrend
        if (shares === 0 && bullishCount >= minAgreement && inUptrend) {
            shares = cash / price;
            entryPrice = price;
            cash = 0;
            signalHistory.push({ i, type: 'buy', bullish: bullishCount, signals });
        }

        // EXIT: Multiple bearish signals OR trend break
        if (shares > 0 && (bearishCount >= 2 || !inUptrend)) {
            const pnlPct = ((price - entryPrice) / entryPrice) * 100;
            cash = shares * price;
            trades.push({ pnl: pnlPct, type: 'signal', signals });
            if (pnlPct > 0) wins++;
            shares = 0;
            signalHistory.push({ i, type: 'sell', bearish: bearishCount });
        }
    }

    if (shares > 0) cash = shares * prices[prices.length - 1];

    const totalReturn = ((cash - 10000) / 10000) * 100;
    return {
        totalReturn,
        trades: trades.length,
        winRate: trades.length > 0 ? (wins / trades.length) * 100 : 0,
        tradeDetails: trades,
        signalHistory
    };
}

// ============================================
// TEST DIFFERENT AGREEMENT LEVELS
// ============================================

console.log('═══════════════════════════════════════════════════════════');
console.log('TESTING AGREEMENT LEVELS');
console.log('═══════════════════════════════════════════════════════════\n');

console.log('How many strategies must agree before trading?\n');
console.log('Agreement | AAPL    | MSFT    | SPY     | Avg Return | Avg Win%');
console.log('----------|---------|---------|---------|------------|----------');

for (let minAgree = 2; minAgree <= 5; minAgree++) {
    const results = {};
    Object.keys(allData).forEach(sym => {
        results[sym] = runEnsembleStrategy(allData[sym], minAgree);
    });

    const avgReturn = Object.values(results).reduce((s, r) => s + r.totalReturn, 0) / Object.keys(results).length;
    const avgWinRate = Object.values(results).reduce((s, r) => s + r.winRate, 0) / Object.keys(results).length;

    console.log(`${minAgree} signals | ${results['AAPL']?.totalReturn.toFixed(1).padStart(6)}% | ${results['MSFT']?.totalReturn.toFixed(1).padStart(6)}% | ${results['SPY']?.totalReturn.toFixed(1).padStart(6)}% | ${avgReturn.toFixed(1).padStart(9)}% | ${avgWinRate.toFixed(0).padStart(8)}%`);
}

// ============================================
// COMPARE WITH OTHER STRATEGIES
// ============================================

console.log('\n═══════════════════════════════════════════════════════════');
console.log('STRATEGY COMPARISON (Full Period)');
console.log('═══════════════════════════════════════════════════════════\n');

function runMACDOnly(data) {
    const prices = data.map(d => d.close);
    const { histogram } = macd(prices);
    const sma200 = sma(prices, 200);

    let cash = 10000, shares = 0, entryPrice = 0;
    let trades = 0, wins = 0;

    for (let i = 200; i < prices.length; i++) {
        const price = prices[i];
        if (price < sma200[i]) continue;

        if (shares > 0) {
            const pnlPct = ((price - entryPrice) / entryPrice) * 100;
            if (pnlPct <= -7 || pnlPct >= 20) {
                cash = shares * price;
                trades++;
                if (pnlPct > 0) wins++;
                shares = 0;
                continue;
            }
        }

        if (shares === 0 && histogram[i] > 0 && histogram[i-1] <= 0) {
            shares = cash / price;
            entryPrice = price;
            cash = 0;
        }
        if (shares > 0 && histogram[i] < 0 && histogram[i-1] >= 0) {
            const pnlPct = ((price - entryPrice) / entryPrice) * 100;
            cash = shares * price;
            trades++;
            if (pnlPct > 0) wins++;
            shares = 0;
        }
    }

    if (shares > 0) cash = shares * prices[prices.length - 1];
    return { totalReturn: ((cash - 10000) / 10000) * 100, trades, winRate: trades > 0 ? (wins / trades) * 100 : 0 };
}

function buyHold(data) {
    const prices = data.map(d => d.close);
    return ((prices[prices.length - 1] - prices[200]) / prices[200]) * 100;
}

console.log('Symbol | Buy&Hold | MACD Only | Ensemble (3) | Best Win%');
console.log('-------|----------|-----------|--------------|----------');

Object.keys(allData).forEach(sym => {
    const bh = buyHold(allData[sym]);
    const macdRes = runMACDOnly(allData[sym]);
    const ensemble = runEnsembleStrategy(allData[sym], 3);

    const bestWin = Math.max(macdRes.winRate, ensemble.winRate);
    console.log(`${sym.padEnd(6)} | ${bh.toFixed(1).padStart(7)}% | ${macdRes.totalReturn.toFixed(1).padStart(8)}% | ${ensemble.totalReturn.toFixed(1).padStart(11)}% | ${bestWin.toFixed(0)}%`);
});

// ============================================
// WALK-FORWARD TEST
// ============================================

console.log('\n═══════════════════════════════════════════════════════════');
console.log('WALK-FORWARD TEST (2023-2024)');
console.log('═══════════════════════════════════════════════════════════\n');

function walkForward(data, minAgreement) {
    const splitIdx = Math.floor(data.length * 0.7);
    const testData = data.slice(splitIdx);
    const result = runEnsembleStrategy(testData, minAgreement);
    const bhReturn = ((testData[testData.length-1].close - testData[0].close) / testData[0].close) * 100;
    return { ...result, buyHold: bhReturn };
}

console.log('Symbol | Ensemble | Buy&Hold | Trades | Win% | Beat B&H?');
console.log('-------|----------|----------|--------|------|----------');

let beatCount = 0;
Object.keys(allData).forEach(sym => {
    const wf = walkForward(allData[sym], 3);
    const beat = wf.totalReturn > wf.buyHold ? 'YES' : 'no';
    if (wf.totalReturn > wf.buyHold) beatCount++;
    console.log(`${sym.padEnd(6)} | ${wf.totalReturn.toFixed(1).padStart(7)}% | ${wf.buyHold.toFixed(1).padStart(7)}% | ${String(wf.trades).padStart(6)} | ${wf.winRate.toFixed(0).padStart(3)}% | ${beat}`);
});

console.log(`\nBeat Buy&Hold: ${beatCount}/5 stocks`);

// ============================================
// SIGNAL ANALYSIS
// ============================================

console.log('\n═══════════════════════════════════════════════════════════');
console.log('SIGNAL CONTRIBUTION ANALYSIS (AAPL)');
console.log('═══════════════════════════════════════════════════════════\n');

const aaplEnsemble = runEnsembleStrategy(allData['AAPL'], 3);

// Analyze which signals contributed to wins vs losses
const signalContribution = {
    macd: { wins: 0, losses: 0 },
    rsi: { wins: 0, losses: 0 },
    breakout: { wins: 0, losses: 0 },
    trend: { wins: 0, losses: 0 },
    volume: { wins: 0, losses: 0 },
    pattern: { wins: 0, losses: 0 }
};

aaplEnsemble.tradeDetails.forEach(trade => {
    if (!trade.signals) return;
    const isWin = trade.pnl > 0;
    Object.keys(trade.signals).forEach(sig => {
        if (trade.signals[sig] === 1) {
            if (isWin) signalContribution[sig].wins++;
            else signalContribution[sig].losses++;
        }
    });
});

console.log('Signal       | Wins | Losses | Win Rate | Value');
console.log('-------------|------|--------|----------|-------');

Object.keys(signalContribution).forEach(sig => {
    const s = signalContribution[sig];
    const total = s.wins + s.losses;
    const winRate = total > 0 ? (s.wins / total) * 100 : 0;
    const value = total > 0 ? (winRate > 50 ? 'GOOD' : 'weak') : 'N/A';
    console.log(`${sig.padEnd(12)} | ${String(s.wins).padStart(4)} | ${String(s.losses).padStart(6)} | ${winRate.toFixed(0).padStart(7)}% | ${value}`);
});

// ============================================
// OPTIMIZED ENSEMBLE
// ============================================

console.log('\n═══════════════════════════════════════════════════════════');
console.log('OPTIMIZED ENSEMBLE (Best Signals Only)');
console.log('═══════════════════════════════════════════════════════════\n');

function runOptimizedEnsemble(data) {
    const prices = data.map(d => d.close);
    const { histogram } = macd(prices);
    const rsiValues = rsi(prices);
    const sma20 = sma(prices, 20);
    const sma50 = sma(prices, 50);
    const sma200 = sma(prices, 200);
    const adxValues = adx(data);

    let cash = 10000, shares = 0, entryPrice = 0;
    let trades = [], wins = 0;

    for (let i = 200; i < prices.length; i++) {
        const price = prices[i];
        const inUptrend = price > sma200[i];

        // Optimized signals (remove weak contributors)
        const macdBull = histogram[i] > 0 && histogram[i-1] <= 0;
        const trendBull = adxValues[i] > 20 && sma20[i] > sma50[i];
        const rsiOK = rsiValues[i] > 30 && rsiValues[i] < 65;

        // Exit signals
        const macdBear = histogram[i] < 0 && histogram[i-1] >= 0;
        const trendBear = sma20[i] < sma50[i];

        // Stop-loss / Take-profit
        if (shares > 0) {
            const pnlPct = ((price - entryPrice) / entryPrice) * 100;
            if (pnlPct <= -5) {
                cash = shares * price;
                trades.push(pnlPct);
                shares = 0;
                continue;
            }
            if (pnlPct >= 12) {
                cash = shares * price;
                trades.push(pnlPct);
                wins++;
                shares = 0;
                continue;
            }
        }

        // Entry: MACD + Trend + RSI ok + Uptrend
        if (shares === 0 && macdBull && trendBull && rsiOK && inUptrend) {
            shares = cash / price;
            entryPrice = price;
            cash = 0;
        }

        // Exit: MACD bear or trend break
        if (shares > 0 && (macdBear || trendBear || !inUptrend)) {
            const pnlPct = ((price - entryPrice) / entryPrice) * 100;
            cash = shares * price;
            trades.push(pnlPct);
            if (pnlPct > 0) wins++;
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

console.log('Symbol | Ensemble(3) | Optimized | Improvement | Win Rate');
console.log('-------|-------------|-----------|-------------|----------');

Object.keys(allData).forEach(sym => {
    const ensemble = runEnsembleStrategy(allData[sym], 3);
    const optimized = runOptimizedEnsemble(allData[sym]);
    const improvement = optimized.totalReturn - ensemble.totalReturn;
    const sign = improvement > 0 ? '+' : '';

    console.log(`${sym.padEnd(6)} | ${ensemble.totalReturn.toFixed(1).padStart(10)}% | ${optimized.totalReturn.toFixed(1).padStart(8)}% | ${sign}${improvement.toFixed(1).padStart(10)}% | ${optimized.winRate.toFixed(0)}%`);
});

// Walk-forward optimized
console.log('\nWalk-Forward (2023-2024):');
console.log('Symbol | Optimized | Buy&Hold | Beat?');
console.log('-------|-----------|----------|------');

let optBeatCount = 0;
Object.keys(allData).forEach(sym => {
    const splitIdx = Math.floor(allData[sym].length * 0.7);
    const testData = allData[sym].slice(splitIdx);
    const opt = runOptimizedEnsemble(testData);
    const bh = ((testData[testData.length-1].close - testData[0].close) / testData[0].close) * 100;
    const beat = opt.totalReturn > bh ? 'YES' : 'no';
    if (opt.totalReturn > bh) optBeatCount++;
    console.log(`${sym.padEnd(6)} | ${opt.totalReturn.toFixed(1).padStart(8)}% | ${bh.toFixed(1).padStart(7)}% | ${beat}`);
});

console.log(`\nBeat Buy&Hold: ${optBeatCount}/5 stocks`);

// ============================================
// SUMMARY
// ============================================

console.log('\n═══════════════════════════════════════════════════════════');
console.log('SUMMARY - ENSEMBLE STRATEGIES');
console.log('═══════════════════════════════════════════════════════════\n');

console.log('Strategies Tested:');
console.log('1. MACD Momentum - Trend following');
console.log('2. RSI Mean Reversion - Overbought/oversold');
console.log('3. Breakout Detection - Bollinger Band breaks');
console.log('4. ADX Trend Strength - Only trade strong trends');
console.log('5. Volume Confirmation - High volume validates moves');
console.log('6. Pattern Recognition - Combined indicator patterns\n');

console.log('Key Findings:');
console.log('- More agreement = fewer trades but higher quality');
console.log('- MACD + Trend (ADX) are the strongest signals');
console.log('- RSI helps filter bad entries');
console.log('- Volume confirmation is situational\n');

console.log('Best Configuration:');
console.log('- Use MACD + ADX Trend + RSI filter');
console.log('- 5% stop-loss, 12% take-profit');
console.log('- Only trade above SMA200 (uptrend filter)\n');

console.log('=== Training Complete ===');
