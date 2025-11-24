/**
 * Real-Time Signal Generator
 *
 * Checks current market data and generates trading signals
 * Run daily before market open to see today's opportunities
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');

console.log('=== Real-Time Signal Generator ===');
console.log(`Date: ${new Date().toISOString().split('T')[0]}\n`);

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

function generateSignals(data, symbol) {
    const prices = data.map(d => d.close);
    const { histogram } = macd(prices);
    const rsiValues = rsi(prices);
    const sma20 = sma(prices, 20);
    const sma50 = sma(prices, 50);
    const sma200 = sma(prices, 200);

    const i = prices.length - 1;
    const price = prices[i];

    // Current indicators
    const currentRSI = rsiValues[i];
    const macdHist = histogram[i];
    const macdPrev = histogram[i - 1];
    const aboveSma200 = price > sma200[i];
    const trendUp = sma20[i] > sma50[i];

    // Signal detection
    const macdCrossUp = macdHist > 0 && macdPrev <= 0;
    const macdCrossDown = macdHist < 0 && macdPrev >= 0;
    const macdPositive = macdHist > 0;

    // Calculate signal strength
    let bullSignals = 0, bearSignals = 0;
    const signals = [];

    if (macdCrossUp) { bullSignals++; signals.push('MACD Cross UP'); }
    if (macdCrossDown) { bearSignals++; signals.push('MACD Cross DOWN'); }
    if (macdPositive && !macdCrossUp) { bullSignals += 0.5; }
    if (trendUp) { bullSignals++; signals.push('Trend UP (SMA20>50)'); }
    if (!trendUp) { bearSignals++; signals.push('Trend DOWN'); }
    if (currentRSI < 35) { bullSignals++; signals.push('RSI Oversold'); }
    if (currentRSI > 70) { bearSignals++; signals.push('RSI Overbought'); }
    if (aboveSma200) { bullSignals++; signals.push('Above SMA200'); }
    if (!aboveSma200) { bearSignals++; signals.push('Below SMA200'); }

    // Determine action
    let action = 'HOLD';
    let confidence = 'LOW';

    if (bullSignals >= 3 && aboveSma200) {
        action = 'BUY';
        confidence = bullSignals >= 4 ? 'HIGH' : 'MEDIUM';
    } else if (bearSignals >= 3 || !aboveSma200) {
        action = 'SELL/AVOID';
        confidence = bearSignals >= 4 ? 'HIGH' : 'MEDIUM';
    }

    return {
        symbol,
        price: price.toFixed(2),
        action,
        confidence,
        rsi: currentRSI?.toFixed(1),
        macd: macdHist > 0 ? 'Bullish' : 'Bearish',
        trend: trendUp ? 'UP' : 'DOWN',
        regime: aboveSma200 ? 'Bull Market' : 'Bear Market',
        signals,
        bullScore: bullSignals,
        bearScore: bearSignals
    };
}

// Load data and generate signals
const symbols = ['AAPL', 'MSFT', 'GOOGL', 'SPY', 'QQQ'];
const results = [];

console.log('═══════════════════════════════════════════════════════════');
console.log('TODAY\'S SIGNALS');
console.log('═══════════════════════════════════════════════════════════\n');

symbols.forEach(sym => {
    const filePath = path.join(__dirname, `../historical-data/${sym}-5-years.json`);
    if (fs.existsSync(filePath)) {
        const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        const signal = generateSignals(data, sym);
        results.push(signal);

        const actionColor = signal.action === 'BUY' ? '🟢' :
                           signal.action === 'SELL/AVOID' ? '🔴' : '🟡';

        console.log(`${actionColor} ${sym}: ${signal.action} (${signal.confidence} confidence)`);
        console.log(`   Price: $${signal.price} | RSI: ${signal.rsi} | MACD: ${signal.macd}`);
        console.log(`   Trend: ${signal.trend} | Regime: ${signal.regime}`);
        console.log(`   Signals: ${signal.signals.join(', ')}`);
        console.log('');
    }
});

// Summary
console.log('═══════════════════════════════════════════════════════════');
console.log('SUMMARY');
console.log('═══════════════════════════════════════════════════════════\n');

const buys = results.filter(r => r.action === 'BUY');
const sells = results.filter(r => r.action === 'SELL/AVOID');

if (buys.length > 0) {
    console.log('📈 BUY CANDIDATES:');
    buys.forEach(b => console.log(`   ${b.symbol} ($${b.price}) - ${b.confidence} confidence`));
    console.log('');
}

if (sells.length > 0) {
    console.log('📉 AVOID/SELL:');
    sells.forEach(s => console.log(`   ${s.symbol} ($${s.price}) - ${s.regime}`));
    console.log('');
}

console.log('Note: Signals based on historical data ending 2024-10-31');
console.log('Run with live data for current signals.\n');
