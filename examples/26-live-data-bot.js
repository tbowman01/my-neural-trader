/**
 * Live Data Trading Bot
 *
 * Uses Yahoo Finance for real-time quotes (free, no API key)
 */

require('dotenv').config();
const { BrokerClient } = require('neural-trader');

// Try to load Yahoo Finance
let yahooFinance;
try {
    const YahooFinance = require('yahoo-finance2').default;
    yahooFinance = new YahooFinance();
} catch (e) {
    console.error('Install yahoo-finance2: npm install yahoo-finance2');
    process.exit(1);
}

const CONFIG = {
    symbols: ['AAPL', 'MSFT', 'NVDA', 'SPY', 'QQQ'],
    maxPositionPct: 0.15,
    stopLossPct: 5,
    takeProfitPct: 10,
    tradingEnabled: true,
};

console.log('=== Live Data Trading Bot ===\n');

// Fetch live quote
async function getLiveQuote(symbol) {
    try {
        const quote = await yahooFinance.quote(symbol);
        return {
            symbol,
            price: quote.regularMarketPrice,
            change: quote.regularMarketChangePercent,
            volume: quote.regularMarketVolume,
            high: quote.regularMarketDayHigh,
            low: quote.regularMarketDayLow,
            open: quote.regularMarketOpen,
            prevClose: quote.regularMarketPreviousClose
        };
    } catch (e) {
        console.error(`Error fetching ${symbol}:`, e.message);
        return null;
    }
}

// Fetch historical for indicators
async function getHistorical(symbol, days = 60) {
    try {
        const end = new Date();
        const start = new Date();
        start.setDate(start.getDate() - days);

        const data = await yahooFinance.historical(symbol, {
            period1: start.toISOString().split('T')[0],
            period2: end.toISOString().split('T')[0],
            interval: '1d'
        });

        return data.map(d => ({
            date: d.date.toISOString().split('T')[0],
            close: d.close,
            high: d.high,
            low: d.low,
            volume: d.volume
        }));
    } catch (e) {
        console.error(`Error fetching history for ${symbol}:`, e.message);
        return null;
    }
}

// Simple indicators
function sma(prices, period) {
    if (prices.length < period) return null;
    return prices.slice(-period).reduce((a, b) => a + b, 0) / period;
}

function rsi(prices, period = 14) {
    if (prices.length < period + 1) return null;
    let gains = 0, losses = 0;
    for (let i = prices.length - period; i < prices.length; i++) {
        const change = prices[i] - prices[i - 1];
        if (change > 0) gains += change;
        else losses -= change;
    }
    return 100 - (100 / (1 + (losses === 0 ? 100 : gains / losses)));
}

// Generate signal from live + historical data
function generateSignal(quote, history) {
    if (!history || history.length < 50) return { signal: 'WAIT', reason: 'Insufficient data' };

    const prices = history.map(d => d.close);
    prices.push(quote.price); // Add current price

    const sma20 = sma(prices, 20);
    const sma50 = sma(prices, 50);
    const currentRsi = rsi(prices);

    const trendUp = sma20 > sma50;
    const aboveAvg = quote.price > sma20;
    const oversold = currentRsi < 35;
    const overbought = currentRsi > 70;

    // Today's momentum
    const dayChange = quote.change;
    const nearLow = (quote.price - quote.low) < (quote.high - quote.low) * 0.3;

    // BUY: Uptrend + pullback + oversold
    if (trendUp && aboveAvg && (oversold || (nearLow && dayChange < -1))) {
        return {
            signal: 'BUY',
            confidence: oversold ? 'HIGH' : 'MEDIUM',
            reason: `Pullback in uptrend, RSI: ${currentRsi?.toFixed(0)}`,
            rsi: currentRsi
        };
    }

    // SELL: Downtrend or overbought
    if (!trendUp || overbought) {
        return {
            signal: 'SELL',
            confidence: overbought ? 'HIGH' : 'MEDIUM',
            reason: overbought ? 'Overbought' : 'Downtrend',
            rsi: currentRsi
        };
    }

    return { signal: 'HOLD', reason: 'No setup', rsi: currentRsi };
}

// Main bot
async function runBot() {
    console.log('Fetching live market data...\n');

    // Get live quotes
    console.log('═══════════════════════════════════════════════════════════');
    console.log('LIVE MARKET DATA');
    console.log('═══════════════════════════════════════════════════════════\n');

    console.log('Symbol | Price    | Change  | RSI  | Signal');
    console.log('-------|----------|---------|------|--------');

    const signals = [];

    for (const symbol of CONFIG.symbols) {
        const quote = await getLiveQuote(symbol);
        if (!quote) continue;

        const history = await getHistorical(symbol, 60);
        const signal = generateSignal(quote, history);

        const emoji = signal.signal === 'BUY' ? '🟢' :
                     signal.signal === 'SELL' ? '🔴' : '🟡';

        const changeStr = quote.change >= 0 ? `+${quote.change.toFixed(2)}%` : `${quote.change.toFixed(2)}%`;

        console.log(`${emoji} ${symbol.padEnd(5)} | $${quote.price.toFixed(2).padStart(7)} | ${changeStr.padStart(7)} | ${(signal.rsi?.toFixed(0) || 'N/A').padStart(4)} | ${signal.signal}`);

        signals.push({ symbol, quote, signal });

        // Small delay to be nice to Yahoo
        await new Promise(r => setTimeout(r, 500));
    }

    // Trading logic
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('TRADING DECISIONS');
    console.log('═══════════════════════════════════════════════════════════\n');

    const broker = new BrokerClient({
        brokerType: 'alpaca',
        apiKey: process.env.ALPACA_API_KEY,
        apiSecret: process.env.ALPACA_API_SECRET,
        baseUrl: process.env.ALPACA_BASE_URL || 'https://paper-api.alpaca.markets',
        paperTrading: true
    });

    await broker.connect();
    const balance = await broker.getAccountBalance();
    const positions = await broker.getPositions();

    console.log(`Account: $${balance.equity.toLocaleString()} | Buying Power: $${balance.buyingPower.toLocaleString()}\n`);

    // Check for trades
    for (const { symbol, quote, signal } of signals) {
        const hasPosition = positions.find(p => p.symbol === symbol);

        if (signal.signal === 'BUY' && signal.confidence === 'HIGH' && !hasPosition) {
            const amount = balance.buyingPower * CONFIG.maxPositionPct;
            const qty = Math.floor(amount / quote.price);

            if (qty > 0 && CONFIG.tradingEnabled) {
                console.log(`📈 BUYING ${symbol}: ${qty} shares @ $${quote.price.toFixed(2)}`);
                console.log(`   Reason: ${signal.reason}`);

                try {
                    const order = await broker.placeOrder({
                        symbol,
                        quantity: qty,
                        side: 'buy',
                        orderType: 'market',
                        timeInForce: 'day'
                    });
                    console.log(`   ✅ Order placed: ${order.orderId}\n`);
                } catch (e) {
                    console.log(`   ❌ Order failed: ${e.message}\n`);
                }
            }
        }

        if (signal.signal === 'SELL' && hasPosition) {
            console.log(`📉 SELLING ${symbol}: ${hasPosition.quantity} shares`);
            console.log(`   Reason: ${signal.reason}`);

            if (CONFIG.tradingEnabled) {
                try {
                    const order = await broker.placeOrder({
                        symbol,
                        quantity: parseInt(hasPosition.quantity),
                        side: 'sell',
                        orderType: 'market',
                        timeInForce: 'day'
                    });
                    console.log(`   ✅ Order placed: ${order.orderId}\n`);
                } catch (e) {
                    console.log(`   ❌ Order failed: ${e.message}\n`);
                }
            }
        }
    }

    // Show positions
    const updatedPositions = await broker.getPositions();
    console.log('Current Positions:');
    if (updatedPositions.length === 0) {
        console.log('  No open positions');
    } else {
        updatedPositions.forEach(p => {
            console.log(`  ${p.symbol}: ${p.quantity} @ $${p.avgEntryPrice} | P/L: $${p.unrealizedPnl}`);
        });
    }

    await broker.disconnect();
    console.log('\n=== Bot Complete ===');
}

runBot().catch(console.error);
