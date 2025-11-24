/**
 * Options Trading Signals
 *
 * Generates options-specific signals:
 * - When to buy calls vs puts
 * - Strike selection guidance
 * - Expiration timing
 * - Volatility-based sizing
 */

const fs = require('fs');
const path = require('path');

console.log('=== Options Trading Signals ===\n');

// Load data
const allData = {};
['AAPL', 'MSFT', 'GOOGL', 'SPY', 'QQQ'].forEach(sym => {
    const filePath = path.join(__dirname, `../historical-data/${sym}-5-years.json`);
    if (fs.existsSync(filePath)) allData[sym] = JSON.parse(fs.readFileSync(filePath, 'utf8'));
});

// Indicators
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

function historicalVolatility(prices, period = 20) {
    const result = new Array(prices.length).fill(null);
    for (let i = period; i < prices.length; i++) {
        const returns = [];
        for (let j = i - period + 1; j <= i; j++) {
            returns.push(Math.log(prices[j] / prices[j-1]));
        }
        const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
        const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;
        result[i] = Math.sqrt(variance) * Math.sqrt(252) * 100; // Annualized %
    }
    return result;
}

function bollingerBands(prices, period = 20, stdDev = 2) {
    const middle = sma(prices, period);
    const upper = [], lower = [], width = [];
    for (let i = 0; i < prices.length; i++) {
        if (i < period - 1) {
            upper.push(null); lower.push(null); width.push(null);
        } else {
            const slice = prices.slice(i - period + 1, i + 1);
            const variance = slice.reduce((sum, p) => sum + Math.pow(p - middle[i], 2), 0) / period;
            const std = Math.sqrt(variance);
            upper.push(middle[i] + stdDev * std);
            lower.push(middle[i] - stdDev * std);
            width.push((upper[i] - lower[i]) / middle[i] * 100);
        }
    }
    return { upper, middle, lower, width };
}

// ============================================
// OPTIONS SIGNAL GENERATOR
// ============================================

function generateOptionsSignal(data, symbol) {
    const prices = data.map(d => d.close);
    const { histogram } = macd(prices);
    const rsiValues = rsi(prices);
    const sma20 = sma(prices, 20);
    const sma50 = sma(prices, 50);
    const sma200 = sma(prices, 200);
    const hv = historicalVolatility(prices);
    const bb = bollingerBands(prices);

    const i = prices.length - 1;
    const price = prices[i];

    // Current state
    const currentRSI = rsiValues[i];
    const currentHV = hv[i];
    const bbWidth = bb.width[i];
    const macdBullish = histogram[i] > 0;
    const macdCrossUp = histogram[i] > 0 && histogram[i-1] <= 0;
    const macdCrossDown = histogram[i] < 0 && histogram[i-1] >= 0;
    const aboveSma200 = price > sma200[i];
    const trendUp = sma20[i] > sma50[i];

    // Volatility regime
    const lowVol = currentHV < 20;
    const highVol = currentHV > 35;
    const volRegime = lowVol ? 'LOW' : highVol ? 'HIGH' : 'NORMAL';

    // Options strategy selection
    let strategy = 'NONE';
    let direction = 'NEUTRAL';
    let strike = 'ATM';
    let expiration = '30-45 DTE';
    let confidence = 'LOW';
    let reasoning = [];

    // BULLISH SETUPS
    if (aboveSma200 && trendUp && macdBullish) {
        direction = 'BULLISH';

        if (macdCrossUp && currentRSI < 60) {
            // Strong buy signal
            strategy = 'LONG CALL';
            strike = 'Slightly OTM (+2-3%)';
            confidence = 'HIGH';
            reasoning.push('MACD cross up', 'RSI not overbought', 'Strong uptrend');
        } else if (currentRSI < 40 && lowVol) {
            // Oversold in uptrend with low vol - good for calls
            strategy = 'LONG CALL';
            strike = 'ATM or slightly ITM';
            expiration = '45-60 DTE';
            confidence = 'MEDIUM';
            reasoning.push('Oversold bounce setup', 'Low IV (cheaper options)');
        } else if (highVol && currentRSI < 35) {
            // High vol + oversold = sell puts
            strategy = 'SELL PUT (Cash-Secured)';
            strike = 'OTM (-5% from current)';
            expiration = '30-45 DTE';
            confidence = 'MEDIUM';
            reasoning.push('High IV premium', 'Oversold', 'Uptrend support');
        } else {
            strategy = 'BULL CALL SPREAD';
            strike = 'Buy ATM, Sell +5% OTM';
            confidence = 'LOW';
            reasoning.push('Moderate bullish outlook');
        }
    }

    // BEARISH SETUPS
    else if (!aboveSma200 || (currentRSI > 70 && macdCrossDown)) {
        direction = 'BEARISH';

        if (macdCrossDown && currentRSI > 65) {
            strategy = 'LONG PUT';
            strike = 'Slightly OTM (-2-3%)';
            confidence = 'HIGH';
            reasoning.push('MACD cross down', 'Overbought', 'Trend weakening');
        } else if (!aboveSma200) {
            strategy = 'LONG PUT or BEAR PUT SPREAD';
            strike = 'ATM';
            confidence = 'MEDIUM';
            reasoning.push('Below 200 SMA', 'Bear market regime');
        }
    }

    // NEUTRAL SETUPS (Sell premium)
    else if (lowVol && !macdCrossUp && !macdCrossDown) {
        direction = 'NEUTRAL';
        strategy = 'IRON CONDOR or STRANGLE';
        strike = 'Sell 1 std dev OTM both sides';
        expiration = '30-45 DTE';
        confidence = 'MEDIUM';
        reasoning.push('Low volatility', 'No clear direction', 'Range-bound');
    }

    return {
        symbol,
        price: price.toFixed(2),
        direction,
        strategy,
        strike,
        expiration,
        confidence,
        reasoning,
        indicators: {
            rsi: currentRSI?.toFixed(1),
            hv: currentHV?.toFixed(1) + '%',
            volRegime,
            macd: macdBullish ? 'Bullish' : 'Bearish',
            trend: trendUp ? 'UP' : 'DOWN',
            regime: aboveSma200 ? 'Bull' : 'Bear'
        }
    };
}

// ============================================
// GENERATE SIGNALS FOR ALL SYMBOLS
// ============================================

console.log('═══════════════════════════════════════════════════════════');
console.log('OPTIONS SIGNALS');
console.log('═══════════════════════════════════════════════════════════\n');

const signals = [];
Object.keys(allData).forEach(sym => {
    const signal = generateOptionsSignal(allData[sym], sym);
    signals.push(signal);

    const emoji = signal.direction === 'BULLISH' ? '🟢' :
                  signal.direction === 'BEARISH' ? '🔴' : '🟡';

    console.log(`${emoji} ${sym} - ${signal.direction}`);
    console.log(`   Price: $${signal.price}`);
    console.log(`   Strategy: ${signal.strategy}`);
    console.log(`   Strike: ${signal.strike}`);
    console.log(`   Expiration: ${signal.expiration}`);
    console.log(`   Confidence: ${signal.confidence}`);
    console.log(`   Reasoning: ${signal.reasoning.join(', ')}`);
    console.log(`   IV: ${signal.indicators.hv} (${signal.indicators.volRegime})`);
    console.log('');
});

// ============================================
// OPTIONS EDUCATION
// ============================================

console.log('═══════════════════════════════════════════════════════════');
console.log('OPTIONS STRATEGY GUIDE');
console.log('═══════════════════════════════════════════════════════════\n');

console.log('BULLISH STRATEGIES (Expect price to go UP):');
console.log('-------------------------------------------');
console.log('1. LONG CALL - Buy a call option');
console.log('   When: Strong conviction, expecting big move');
console.log('   Risk: Premium paid (limited)');
console.log('   Reward: Unlimited upside');
console.log('');
console.log('2. BULL CALL SPREAD - Buy call + Sell higher call');
console.log('   When: Moderate bullish, want to reduce cost');
console.log('   Risk: Net premium paid');
console.log('   Reward: Capped at spread width minus premium');
console.log('');
console.log('3. SELL PUT (Cash-Secured) - Sell OTM put');
console.log('   When: Want to buy stock cheaper, high IV');
console.log('   Risk: Must buy stock if assigned');
console.log('   Reward: Premium collected');
console.log('');

console.log('BEARISH STRATEGIES (Expect price to go DOWN):');
console.log('---------------------------------------------');
console.log('1. LONG PUT - Buy a put option');
console.log('   When: Expecting decline, want protection');
console.log('   Risk: Premium paid (limited)');
console.log('   Reward: Profits as stock falls');
console.log('');
console.log('2. BEAR PUT SPREAD - Buy put + Sell lower put');
console.log('   When: Moderate bearish, reduce cost');
console.log('   Risk: Net premium paid');
console.log('   Reward: Capped at spread width');
console.log('');

console.log('NEUTRAL STRATEGIES (Expect range-bound):');
console.log('-----------------------------------------');
console.log('1. IRON CONDOR - Sell OTM call + put spreads');
console.log('   When: Low IV, expecting sideways');
console.log('   Risk: Width of spreads minus premium');
console.log('   Reward: Premium collected');
console.log('');

// ============================================
// POSITION SIZING
// ============================================

console.log('═══════════════════════════════════════════════════════════');
console.log('POSITION SIZING FOR OPTIONS');
console.log('═══════════════════════════════════════════════════════════\n');

console.log('Rule: Never risk more than 1-2% of account per trade\n');

console.log('Example ($10,000 account):');
console.log('  Max risk per trade: $100-200');
console.log('');
console.log('  If buying a $3.00 call:');
console.log('    Max contracts = $200 / ($3.00 x 100) = 0.67');
console.log('    So buy 1 contract max (risk = $300)');
console.log('');
console.log('  For spreads (defined risk):');
console.log('    $5 wide spread, $2 credit received');
console.log('    Max loss = ($5 - $2) x 100 = $300 per spread');
console.log('    Max contracts = $200 / $300 = 0.67');
console.log('    So trade 1 spread max');
console.log('');

// ============================================
// BEST SETUPS RIGHT NOW
// ============================================

console.log('═══════════════════════════════════════════════════════════');
console.log('BEST OPTIONS SETUPS (Based on Current Signals)');
console.log('═══════════════════════════════════════════════════════════\n');

const highConfidence = signals.filter(s => s.confidence === 'HIGH');
const mediumConfidence = signals.filter(s => s.confidence === 'MEDIUM' && s.strategy !== 'NONE');

if (highConfidence.length > 0) {
    console.log('HIGH CONFIDENCE:');
    highConfidence.forEach(s => {
        console.log(`  ${s.symbol}: ${s.strategy}`);
        console.log(`    ${s.strike}, ${s.expiration}`);
    });
    console.log('');
}

if (mediumConfidence.length > 0) {
    console.log('MEDIUM CONFIDENCE:');
    mediumConfidence.forEach(s => {
        console.log(`  ${s.symbol}: ${s.strategy}`);
        console.log(`    ${s.strike}, ${s.expiration}`);
    });
}

if (highConfidence.length === 0 && mediumConfidence.length === 0) {
    console.log('No high-confidence setups right now.');
    console.log('Wait for clearer signals or trade smaller size.');
}

console.log('\n=== Options Signals Complete ===');
