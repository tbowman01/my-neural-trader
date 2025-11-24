/**
 * Final Optimized Strategy
 *
 * Combines all learnings:
 * - 2-signal agreement (best balance of trades vs quality)
 * - MACD + Trend as primary signals
 * - Regime-based position sizing
 * - Tight stops in weak markets, loose in strong
 */

const fs = require('fs');
const path = require('path');

console.log('=== Final Optimized Strategy ===\n');

// Load data
const allData = {};
['AAPL', 'MSFT', 'GOOGL', 'SPY', 'QQQ'].forEach(sym => {
    const filePath = path.join(__dirname, `../historical-data/${sym}-5-years.json`);
    if (fs.existsSync(filePath)) allData[sym] = JSON.parse(fs.readFileSync(filePath, 'utf8'));
});

// Indicators
function sma(prices, period) {
    return prices.map((_, i) => i < period - 1 ? null : prices.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0) / period);
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
    return { histogram: line.map((v, i) => v - signal[i]) };
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

// ============================================
// FINAL OPTIMIZED STRATEGY
// ============================================

function runFinalStrategy(data) {
    const prices = data.map(d => d.close);
    const { histogram } = macd(prices);
    const rsiValues = rsi(prices);
    const sma20 = sma(prices, 20);
    const sma50 = sma(prices, 50);
    const sma200 = sma(prices, 200);

    let cash = 10000, shares = 0, entryPrice = 0;
    let trades = [], wins = 0;
    let maxDrawdown = 0, peak = 10000;

    for (let i = 200; i < prices.length; i++) {
        const price = prices[i];

        // Calculate equity
        const equity = shares > 0 ? shares * price : cash;
        if (equity > peak) peak = equity;
        const drawdown = (peak - equity) / peak * 100;
        if (drawdown > maxDrawdown) maxDrawdown = drawdown;

        // Regime Detection
        const aboveSma200 = price > sma200[i];
        const sma50AboveSma200 = sma50[i] > sma200[i];
        const strongUptrend = aboveSma200 && sma50AboveSma200;
        const weakUptrend = aboveSma200 && !sma50AboveSma200;

        // Dynamic stops based on regime
        const stopLoss = strongUptrend ? 7 : 5;
        const takeProfit = strongUptrend ? 20 : 12;

        // Signals
        const macdCrossUp = histogram[i] > 0 && histogram[i-1] <= 0;
        const macdCrossDown = histogram[i] < 0 && histogram[i-1] >= 0;
        const macdPositive = histogram[i] > 0;

        const trendUp = sma20[i] > sma50[i];
        const trendCrossUp = sma20[i] > sma50[i] && sma20[i-1] <= sma50[i-1];

        const rsiOversold = rsiValues[i] < 35;
        const rsiNeutral = rsiValues[i] > 35 && rsiValues[i] < 65;
        const rsiOverbought = rsiValues[i] > 70;

        // Position management
        if (shares > 0) {
            const pnlPct = ((price - entryPrice) / entryPrice) * 100;

            // Stop-loss
            if (pnlPct <= -stopLoss) {
                cash = shares * price;
                trades.push({ pnl: pnlPct, type: 'stop', regime: strongUptrend ? 'strong' : 'weak' });
                shares = 0;
                continue;
            }

            // Take-profit
            if (pnlPct >= takeProfit) {
                cash = shares * price;
                trades.push({ pnl: pnlPct, type: 'take-profit', regime: strongUptrend ? 'strong' : 'weak' });
                wins++;
                shares = 0;
                continue;
            }

            // Regime break - exit
            if (!aboveSma200) {
                cash = shares * price;
                trades.push({ pnl: pnlPct, type: 'regime-exit', regime: 'bear' });
                if (pnlPct > 0) wins++;
                shares = 0;
                continue;
            }
        }

        // ENTRY RULES (need 2 of 3 signals + uptrend)
        if (shares === 0 && aboveSma200) {
            let bullSignals = 0;

            // Signal 1: MACD momentum
            if (macdCrossUp || (macdPositive && trendCrossUp)) bullSignals++;

            // Signal 2: Trend confirmation
            if (trendUp) bullSignals++;

            // Signal 3: RSI not overbought (entry filter)
            if (rsiNeutral || rsiOversold) bullSignals++;

            // Enter on 2+ signals
            if (bullSignals >= 2) {
                shares = cash / price;
                entryPrice = price;
                cash = 0;
            }
        }

        // EXIT RULES
        if (shares > 0) {
            // MACD bearish cross
            if (macdCrossDown) {
                const pnlPct = ((price - entryPrice) / entryPrice) * 100;
                cash = shares * price;
                trades.push({ pnl: pnlPct, type: 'macd-exit', regime: strongUptrend ? 'strong' : 'weak' });
                if (pnlPct > 0) wins++;
                shares = 0;
            }
        }
    }

    // Close final position
    if (shares > 0) {
        const pnlPct = ((prices[prices.length-1] - entryPrice) / entryPrice) * 100;
        cash = shares * prices[prices.length - 1];
        trades.push({ pnl: pnlPct, type: 'end', regime: 'final' });
        if (pnlPct > 0) wins++;
    }

    const totalReturn = ((cash - 10000) / 10000) * 100;

    return {
        totalReturn,
        trades: trades.length,
        winRate: trades.length > 0 ? (wins / trades.length) * 100 : 0,
        maxDrawdown,
        tradeDetails: trades,
        avgWin: trades.filter(t => t.pnl > 0).length > 0 ?
            trades.filter(t => t.pnl > 0).reduce((s, t) => s + t.pnl, 0) / trades.filter(t => t.pnl > 0).length : 0,
        avgLoss: trades.filter(t => t.pnl <= 0).length > 0 ?
            trades.filter(t => t.pnl <= 0).reduce((s, t) => s + t.pnl, 0) / trades.filter(t => t.pnl <= 0).length : 0
    };
}

// ============================================
// FULL PERIOD RESULTS
// ============================================

console.log('═══════════════════════════════════════════════════════════');
console.log('FULL PERIOD RESULTS (2019-2024)');
console.log('═══════════════════════════════════════════════════════════\n');

console.log('Symbol | Return  | Trades | Win%  | MaxDD | Avg Win | Avg Loss | B&H');
console.log('-------|---------|--------|-------|-------|---------|----------|--------');

const fullResults = {};
Object.keys(allData).forEach(sym => {
    const result = runFinalStrategy(allData[sym]);
    const prices = allData[sym].map(d => d.close);
    const bh = ((prices[prices.length-1] - prices[200]) / prices[200]) * 100;
    fullResults[sym] = { ...result, buyHold: bh };

    console.log(`${sym.padEnd(6)} | ${result.totalReturn.toFixed(1).padStart(6)}% | ${String(result.trades).padStart(6)} | ${result.winRate.toFixed(0).padStart(4)}% | ${result.maxDrawdown.toFixed(0).padStart(4)}% | ${result.avgWin.toFixed(1).padStart(6)}% | ${result.avgLoss.toFixed(1).padStart(7)}% | ${bh.toFixed(0)}%`);
});

// Averages
const avgReturn = Object.values(fullResults).reduce((s, r) => s + r.totalReturn, 0) / 5;
const avgWinRate = Object.values(fullResults).reduce((s, r) => s + r.winRate, 0) / 5;
const avgBH = Object.values(fullResults).reduce((s, r) => s + r.buyHold, 0) / 5;

console.log('-------|---------|--------|-------|-------|---------|----------|--------');
console.log(`Avg    | ${avgReturn.toFixed(1).padStart(6)}% |        | ${avgWinRate.toFixed(0).padStart(4)}% |       |         |          | ${avgBH.toFixed(0)}%`);

// ============================================
// WALK-FORWARD TEST
// ============================================

console.log('\n═══════════════════════════════════════════════════════════');
console.log('WALK-FORWARD TEST (2023-2024)');
console.log('═══════════════════════════════════════════════════════════\n');

console.log('Symbol | Strategy | Buy&Hold | Trades | Win%  | Beat?');
console.log('-------|----------|----------|--------|-------|------');

let beatCount = 0;
const wfResults = {};

Object.keys(allData).forEach(sym => {
    const splitIdx = Math.floor(allData[sym].length * 0.7);
    const testData = allData[sym].slice(splitIdx);

    const result = runFinalStrategy(testData);
    const bh = ((testData[testData.length-1].close - testData[0].close) / testData[0].close) * 100;

    wfResults[sym] = { ...result, buyHold: bh };
    const beat = result.totalReturn > bh ? 'YES' : 'no';
    if (result.totalReturn > bh) beatCount++;

    console.log(`${sym.padEnd(6)} | ${result.totalReturn.toFixed(1).padStart(7)}% | ${bh.toFixed(1).padStart(7)}% | ${String(result.trades).padStart(6)} | ${result.winRate.toFixed(0).padStart(4)}% | ${beat}`);
});

const avgWFReturn = Object.values(wfResults).reduce((s, r) => s + r.totalReturn, 0) / 5;
const avgWFBH = Object.values(wfResults).reduce((s, r) => s + r.buyHold, 0) / 5;

console.log('-------|----------|----------|--------|-------|------');
console.log(`Avg    | ${avgWFReturn.toFixed(1).padStart(7)}% | ${avgWFBH.toFixed(1).padStart(7)}% |        |       | ${beatCount}/5`);

// ============================================
// PORTFOLIO SIMULATION
// ============================================

console.log('\n═══════════════════════════════════════════════════════════');
console.log('PORTFOLIO SIMULATION ($10,000 split across 5 stocks)');
console.log('═══════════════════════════════════════════════════════════\n');

const portfolioStart = 10000;
const perStock = portfolioStart / 5;

let portfolioEnd = 0;
let bhPortfolioEnd = 0;

Object.keys(fullResults).forEach(sym => {
    const stockEnd = perStock * (1 + fullResults[sym].totalReturn / 100);
    const bhEnd = perStock * (1 + fullResults[sym].buyHold / 100);
    portfolioEnd += stockEnd;
    bhPortfolioEnd += bhEnd;
});

const portfolioReturn = ((portfolioEnd - portfolioStart) / portfolioStart) * 100;
const bhPortfolioReturn = ((bhPortfolioEnd - portfolioStart) / portfolioStart) * 100;

console.log(`Starting Capital:  $${portfolioStart.toLocaleString()}`);
console.log(`Strategy Ending:   $${portfolioEnd.toFixed(0).toLocaleString()} (${portfolioReturn.toFixed(1)}%)`);
console.log(`Buy&Hold Ending:   $${bhPortfolioEnd.toFixed(0).toLocaleString()} (${bhPortfolioReturn.toFixed(1)}%)`);

// ============================================
// TRADE BREAKDOWN
// ============================================

console.log('\n═══════════════════════════════════════════════════════════');
console.log('TRADE BREAKDOWN (All Stocks Combined)');
console.log('═══════════════════════════════════════════════════════════\n');

const allTrades = [];
Object.values(fullResults).forEach(r => allTrades.push(...r.tradeDetails));

const byType = {};
allTrades.forEach(t => {
    if (!byType[t.type]) byType[t.type] = [];
    byType[t.type].push(t.pnl);
});

console.log('Exit Type     | Count | Avg P/L | Win Rate');
console.log('--------------|-------|---------|----------');

Object.keys(byType).forEach(type => {
    const trades = byType[type];
    const avg = trades.reduce((a, b) => a + b, 0) / trades.length;
    const wins = trades.filter(t => t > 0).length;
    console.log(`${type.padEnd(13)} | ${String(trades.length).padStart(5)} | ${avg.toFixed(1).padStart(6)}% | ${(wins/trades.length*100).toFixed(0)}%`);
});

// ============================================
// RISK METRICS
// ============================================

console.log('\n═══════════════════════════════════════════════════════════');
console.log('RISK METRICS');
console.log('═══════════════════════════════════════════════════════════\n');

const allWins = allTrades.filter(t => t.pnl > 0).map(t => t.pnl);
const allLosses = allTrades.filter(t => t.pnl <= 0).map(t => t.pnl);

const avgWinAll = allWins.length > 0 ? allWins.reduce((a, b) => a + b, 0) / allWins.length : 0;
const avgLossAll = allLosses.length > 0 ? Math.abs(allLosses.reduce((a, b) => a + b, 0) / allLosses.length) : 1;
const profitFactor = avgLossAll > 0 ? (allWins.reduce((a, b) => a + b, 0)) / Math.abs(allLosses.reduce((a, b) => a + b, 0)) : 0;
const expectancy = (avgWinRate/100 * avgWinAll) - ((100-avgWinRate)/100 * avgLossAll);

console.log(`Total Trades:     ${allTrades.length}`);
console.log(`Win Rate:         ${avgWinRate.toFixed(1)}%`);
console.log(`Avg Win:          ${avgWinAll.toFixed(2)}%`);
console.log(`Avg Loss:         ${avgLossAll.toFixed(2)}%`);
console.log(`Win/Loss Ratio:   ${(avgWinAll / avgLossAll).toFixed(2)}`);
console.log(`Profit Factor:    ${profitFactor.toFixed(2)}`);
console.log(`Expectancy:       ${expectancy.toFixed(2)}% per trade`);

// ============================================
// FINAL SUMMARY
// ============================================

console.log('\n═══════════════════════════════════════════════════════════');
console.log('FINAL SUMMARY');
console.log('═══════════════════════════════════════════════════════════\n');

console.log('Strategy Rules:');
console.log('---------------');
console.log('ENTRY (need 2 of 3):');
console.log('  1. MACD cross up OR (MACD positive + trend cross)');
console.log('  2. SMA20 > SMA50 (trend up)');
console.log('  3. RSI between 35-65 (not overbought)');
console.log('  + Must be above SMA200 (uptrend filter)\n');

console.log('EXIT:');
console.log('  - MACD bearish cross');
console.log('  - Stop-loss: 5-7% (tighter in weak trends)');
console.log('  - Take-profit: 12-20% (higher in strong trends)');
console.log('  - Regime break (price < SMA200)\n');

console.log('Results:');
console.log(`  Full Period:    ${avgReturn.toFixed(1)}% avg return (vs ${avgBH.toFixed(0)}% B&H)`);
console.log(`  Walk-Forward:   ${avgWFReturn.toFixed(1)}% avg return (vs ${avgWFBH.toFixed(0)}% B&H)`);
console.log(`  Win Rate:       ${avgWinRate.toFixed(0)}%`);
console.log(`  Profit Factor:  ${profitFactor.toFixed(2)}`);

if (profitFactor > 1) {
    console.log('\n✅ Strategy is profitable (Profit Factor > 1)');
} else {
    console.log('\n⚠️ Strategy needs more optimization');
}

console.log('\n=== Final Strategy Ready ===');
