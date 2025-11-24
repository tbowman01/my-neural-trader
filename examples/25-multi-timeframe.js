/**
 * Multi-Timeframe Analysis
 *
 * Combines Daily + Weekly + Monthly signals for better entries.
 * Higher timeframe = overall direction
 * Lower timeframe = entry timing
 */

const fs = require('fs');
const path = require('path');

console.log('=== Multi-Timeframe Analysis ===\n');

// Load daily data
const dataPath = path.join(__dirname, '../historical-data/AAPL-5-years.json');
const dailyData = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

// ============================================
// CREATE DIFFERENT TIMEFRAMES
// ============================================

function aggregateToWeekly(dailyData) {
    const weekly = [];
    let week = null;

    dailyData.forEach(d => {
        const date = new Date(d.date);
        const weekNum = getWeekNumber(date);
        const key = `${date.getFullYear()}-W${weekNum}`;

        if (!week || week.key !== key) {
            if (week) weekly.push(week);
            week = {
                key,
                date: d.date,
                open: d.close, // Simplified
                high: d.close,
                low: d.close,
                close: d.close
            };
        } else {
            week.high = Math.max(week.high, d.close);
            week.low = Math.min(week.low, d.close);
            week.close = d.close;
        }
    });
    if (week) weekly.push(week);
    return weekly;
}

function aggregateToMonthly(dailyData) {
    const monthly = [];
    let month = null;

    dailyData.forEach(d => {
        const date = new Date(d.date);
        const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

        if (!month || month.key !== key) {
            if (month) monthly.push(month);
            month = {
                key,
                date: d.date,
                open: d.close,
                high: d.close,
                low: d.close,
                close: d.close
            };
        } else {
            month.high = Math.max(month.high, d.close);
            month.low = Math.min(month.low, d.close);
            month.close = d.close;
        }
    });
    if (month) monthly.push(month);
    return monthly;
}

function getWeekNumber(date) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

// ============================================
// INDICATORS
// ============================================

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

// ============================================
// TIMEFRAME ANALYSIS
// ============================================

function analyzeTimeframe(data, name) {
    const prices = data.map(d => d.close);
    const { histogram } = macd(prices);
    const rsiValues = rsi(prices);
    const sma20 = sma(prices, 20);
    const sma50 = sma(prices, Math.min(50, Math.floor(prices.length / 4)));

    const i = prices.length - 1;
    const price = prices[i];

    const trend = sma20[i] && sma50[i] ? (sma20[i] > sma50[i] ? 'UP' : 'DOWN') : 'NEUTRAL';
    const macdSignal = histogram[i] > 0 ? 'BULLISH' : 'BEARISH';
    const rsiSignal = rsiValues[i] < 30 ? 'OVERSOLD' : rsiValues[i] > 70 ? 'OVERBOUGHT' : 'NEUTRAL';

    return {
        name,
        price,
        trend,
        macd: macdSignal,
        rsi: rsiValues[i]?.toFixed(1),
        rsiSignal
    };
}

// Create timeframes
const weeklyData = aggregateToWeekly(dailyData);
const monthlyData = aggregateToMonthly(dailyData);

console.log(`Data Points:`);
console.log(`  Daily:   ${dailyData.length} bars`);
console.log(`  Weekly:  ${weeklyData.length} bars`);
console.log(`  Monthly: ${monthlyData.length} bars\n`);

// Analyze each timeframe
const daily = analyzeTimeframe(dailyData, 'Daily');
const weekly = analyzeTimeframe(weeklyData, 'Weekly');
const monthly = analyzeTimeframe(monthlyData, 'Monthly');

console.log('═══════════════════════════════════════════════════════════');
console.log('TIMEFRAME ANALYSIS');
console.log('═══════════════════════════════════════════════════════════\n');

console.log('Timeframe | Trend  | MACD    | RSI    | Signal');
console.log('----------|--------|---------|--------|--------');
[monthly, weekly, daily].forEach(tf => {
    console.log(`${tf.name.padEnd(9)} | ${tf.trend.padEnd(6)} | ${tf.macd.padEnd(7)} | ${(tf.rsi || 'N/A').padStart(5)} | ${tf.rsiSignal}`);
});

// ============================================
// MULTI-TIMEFRAME STRATEGY
// ============================================

console.log('\n═══════════════════════════════════════════════════════════');
console.log('MULTI-TIMEFRAME TRADING RULES');
console.log('═══════════════════════════════════════════════════════════\n');

console.log('The "Top-Down" Approach:');
console.log('------------------------');
console.log('1. MONTHLY: Sets the major trend (Bull/Bear market)');
console.log('2. WEEKLY:  Confirms direction (Buy dips in uptrend)');
console.log('3. DAILY:   Entry timing (Use MACD/RSI for entries)\n');

// Generate combined signal
function getMTFSignal(monthly, weekly, daily) {
    const signals = [];
    let bullScore = 0, bearScore = 0;

    // Monthly (weight: 3)
    if (monthly.trend === 'UP') { bullScore += 3; signals.push('Monthly UP'); }
    else { bearScore += 3; signals.push('Monthly DOWN'); }

    // Weekly (weight: 2)
    if (weekly.trend === 'UP') { bullScore += 2; signals.push('Weekly UP'); }
    else { bearScore += 2; signals.push('Weekly DOWN'); }
    if (weekly.macd === 'BULLISH') bullScore += 1;
    else bearScore += 1;

    // Daily (weight: 1)
    if (daily.trend === 'UP') { bullScore += 1; signals.push('Daily UP'); }
    else { bearScore += 1; signals.push('Daily DOWN'); }
    if (daily.macd === 'BULLISH') bullScore += 1;
    else bearScore += 1;
    if (daily.rsiSignal === 'OVERSOLD') { bullScore += 1; signals.push('Daily Oversold'); }
    if (daily.rsiSignal === 'OVERBOUGHT') { bearScore += 1; signals.push('Daily Overbought'); }

    const totalScore = bullScore - bearScore;
    let action, confidence;

    if (totalScore >= 5) { action = 'STRONG BUY'; confidence = 'HIGH'; }
    else if (totalScore >= 2) { action = 'BUY'; confidence = 'MEDIUM'; }
    else if (totalScore <= -5) { action = 'STRONG SELL'; confidence = 'HIGH'; }
    else if (totalScore <= -2) { action = 'SELL'; confidence = 'MEDIUM'; }
    else { action = 'HOLD'; confidence = 'LOW'; }

    return { action, confidence, bullScore, bearScore, signals };
}

const mtfSignal = getMTFSignal(monthly, weekly, daily);

console.log('Current Multi-Timeframe Signal:');
console.log('-------------------------------');
console.log(`  Action:     ${mtfSignal.action}`);
console.log(`  Confidence: ${mtfSignal.confidence}`);
console.log(`  Bull Score: ${mtfSignal.bullScore}`);
console.log(`  Bear Score: ${mtfSignal.bearScore}`);
console.log(`  Reasons:    ${mtfSignal.signals.join(', ')}`);

// ============================================
// BACKTEST MTF STRATEGY
// ============================================

console.log('\n═══════════════════════════════════════════════════════════');
console.log('BACKTESTING MULTI-TIMEFRAME STRATEGY');
console.log('═══════════════════════════════════════════════════════════\n');

function backtestMTF(dailyData) {
    const prices = dailyData.map(d => d.close);
    const { histogram } = macd(prices);
    const rsiValues = rsi(prices);
    const sma20 = sma(prices, 20);
    const sma50 = sma(prices, 50);

    // Weekly indicators (using 5-day averages as proxy)
    const weeklySma5 = sma(prices, 25); // ~5 weeks
    const weeklySma10 = sma(prices, 50); // ~10 weeks

    // Monthly indicators (using 20-day averages as proxy)
    const monthlySma2 = sma(prices, 40); // ~2 months
    const monthlySma5 = sma(prices, 100); // ~5 months

    let cash = 10000, shares = 0, entryPrice = 0;
    let trades = 0, wins = 0;
    let signalHistory = [];

    for (let i = 100; i < prices.length; i++) {
        const price = prices[i];

        // Calculate MTF score
        let bullScore = 0, bearScore = 0;

        // Monthly proxy
        if (monthlySma2[i] && monthlySma5[i]) {
            if (monthlySma2[i] > monthlySma5[i]) bullScore += 3;
            else bearScore += 3;
        }

        // Weekly proxy
        if (weeklySma5[i] && weeklySma10[i]) {
            if (weeklySma5[i] > weeklySma10[i]) bullScore += 2;
            else bearScore += 2;
        }

        // Daily
        if (sma20[i] && sma50[i]) {
            if (sma20[i] > sma50[i]) bullScore += 1;
            else bearScore += 1;
        }
        if (histogram[i] > 0) bullScore += 1;
        else bearScore += 1;

        const score = bullScore - bearScore;

        // Trading logic
        if (shares > 0) {
            const pnlPct = ((price - entryPrice) / entryPrice) * 100;
            // Exit on score flip or stops
            if (score <= -2 || pnlPct <= -5 || pnlPct >= 15) {
                cash = shares * price;
                trades++;
                if (pnlPct > 0) wins++;
                shares = 0;
            }
        }

        // Entry on strong MTF alignment
        if (shares === 0 && score >= 4 && rsiValues[i] < 65) {
            shares = cash / price;
            entryPrice = price;
            cash = 0;
            signalHistory.push({ date: dailyData[i].date, score, action: 'BUY' });
        }
    }

    if (shares > 0) cash = shares * prices[prices.length - 1];

    const totalReturn = ((cash - 10000) / 10000) * 100;
    const bhReturn = ((prices[prices.length - 1] - prices[100]) / prices[100]) * 100;

    return { totalReturn, buyHold: bhReturn, trades, winRate: trades > 0 ? (wins/trades*100) : 0, signalHistory };
}

const mtfBacktest = backtestMTF(dailyData);

console.log('Multi-Timeframe Strategy Results:');
console.log(`  MTF Return:     ${mtfBacktest.totalReturn.toFixed(1)}%`);
console.log(`  Buy & Hold:     ${mtfBacktest.buyHold.toFixed(1)}%`);
console.log(`  Trades:         ${mtfBacktest.trades}`);
console.log(`  Win Rate:       ${mtfBacktest.winRate.toFixed(0)}%`);

// Compare with single timeframe
function backtestSingleTF(dailyData) {
    const prices = dailyData.map(d => d.close);
    const { histogram } = macd(prices);
    const sma50 = sma(prices, 50);

    let cash = 10000, shares = 0, entryPrice = 0;
    let trades = 0, wins = 0;

    for (let i = 50; i < prices.length; i++) {
        const price = prices[i];

        if (shares > 0) {
            const pnlPct = ((price - entryPrice) / entryPrice) * 100;
            if (histogram[i] < 0 || pnlPct <= -5 || pnlPct >= 15) {
                cash = shares * price;
                trades++;
                if (pnlPct > 0) wins++;
                shares = 0;
            }
        }

        if (shares === 0 && histogram[i] > 0 && histogram[i-1] <= 0 && price > sma50[i]) {
            shares = cash / price;
            entryPrice = price;
            cash = 0;
        }
    }

    if (shares > 0) cash = shares * prices[prices.length - 1];
    return { totalReturn: ((cash - 10000) / 10000) * 100, trades, winRate: trades > 0 ? (wins/trades*100) : 0 };
}

const singleTFBacktest = backtestSingleTF(dailyData);

console.log('\nComparison:');
console.log(`  Single TF (Daily Only): ${singleTFBacktest.totalReturn.toFixed(1)}% (${singleTFBacktest.trades} trades, ${singleTFBacktest.winRate.toFixed(0)}% win)`);
console.log(`  Multi-TF (D+W+M):       ${mtfBacktest.totalReturn.toFixed(1)}% (${mtfBacktest.trades} trades, ${mtfBacktest.winRate.toFixed(0)}% win)`);

// ============================================
// MTF ENTRY EXAMPLES
// ============================================

console.log('\n═══════════════════════════════════════════════════════════');
console.log('MULTI-TIMEFRAME ENTRY EXAMPLES');
console.log('═══════════════════════════════════════════════════════════\n');

console.log('IDEAL BUY SETUP:');
console.log('  Monthly: Uptrend (SMA10 > SMA20)');
console.log('  Weekly:  Uptrend + MACD bullish');
console.log('  Daily:   Pullback to support, RSI < 40, MACD cross up');
console.log('  → Enter with 80% position, stop below daily swing low\n');

console.log('IDEAL SELL SETUP:');
console.log('  Monthly: Downtrend or topping');
console.log('  Weekly:  Breaking down, MACD bearish');
console.log('  Daily:   Failed rally, RSI > 70');
console.log('  → Exit all positions, go to cash\n');

console.log('HOLD/WAIT SETUP:');
console.log('  Mixed signals across timeframes');
console.log('  Monthly says up, Weekly says down');
console.log('  → Reduce position size, wait for alignment\n');

// Recent signals
console.log('Recent MTF Buy Signals:');
if (mtfBacktest.signalHistory.length > 0) {
    mtfBacktest.signalHistory.slice(-5).forEach(s => {
        console.log(`  ${s.date}: Score=${s.score}, Action=${s.action}`);
    });
} else {
    console.log('  No recent signals');
}

// ============================================
// SUMMARY
// ============================================

console.log('\n═══════════════════════════════════════════════════════════');
console.log('SUMMARY');
console.log('═══════════════════════════════════════════════════════════\n');

console.log('Multi-Timeframe Analysis Benefits:');
console.log('1. Higher probability trades (all timeframes agree)');
console.log('2. Better entry timing (daily signals in weekly trend)');
console.log('3. Fewer false signals (filter noise)');
console.log('4. Clear stop-loss levels (weekly/monthly support)\n');

console.log('Implementation:');
console.log('1. Check Monthly first - Is this a bull or bear market?');
console.log('2. Check Weekly - Is the trend strong? Any divergences?');
console.log('3. Check Daily - Is there a good entry point now?');
console.log('4. Only trade when 2+ timeframes agree\n');

console.log('=== Multi-Timeframe Analysis Complete ===');
