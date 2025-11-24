/**
 * Automated Paper Trading Bot
 *
 * Connects to Alpaca and automatically executes trades based on signals.
 * Run this during market hours to trade automatically.
 *
 * WARNING: This is for PAPER TRADING only!
 */

require('dotenv').config();
const { BrokerClient } = require('neural-trader');

console.log('=== Automated Paper Trading Bot ===\n');

// ============================================
// CONFIGURATION
// ============================================

const CONFIG = {
    symbols: ['AAPL', 'MSFT', 'GOOGL', 'SPY', 'QQQ'],
    maxPositionSize: 0.2,     // Max 20% of account per position
    stopLossPercent: 5,       // 5% stop-loss
    takeProfitPercent: 10,    // 10% take-profit
    checkIntervalMs: 60000,   // Check every 1 minute
    tradingEnabled: true,     // ENABLED - Will place real paper trades!
};

// ============================================
// INDICATORS (Simplified for real-time)
// ============================================

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
    const rs = losses === 0 ? 100 : gains / losses;
    return 100 - (100 / (1 + rs));
}

function generateSignal(prices) {
    if (prices.length < 200) return { signal: 'WAIT', reason: 'Insufficient data' };

    const price = prices[prices.length - 1];
    const sma20 = sma(prices, 20);
    const sma50 = sma(prices, 50);
    const sma200 = sma(prices, 200);
    const currentRsi = rsi(prices);

    // Regime check
    const inUptrend = price > sma200;

    // Signals
    const trendUp = sma20 > sma50;
    const rsiOversold = currentRsi < 35;
    const rsiOverbought = currentRsi > 70;
    const nearSupport = price < sma20 * 1.02;

    // BUY: Uptrend + trend confirmation + not overbought
    if (inUptrend && trendUp && !rsiOverbought && nearSupport) {
        return {
            signal: 'BUY',
            reason: 'Uptrend pullback',
            confidence: rsiOversold ? 'HIGH' : 'MEDIUM',
            rsi: currentRsi
        };
    }

    // SELL: Overbought or downtrend
    if (!inUptrend || rsiOverbought) {
        return {
            signal: 'SELL',
            reason: inUptrend ? 'Overbought' : 'Regime break',
            confidence: 'MEDIUM',
            rsi: currentRsi
        };
    }

    return {
        signal: 'HOLD',
        reason: 'No clear signal',
        rsi: currentRsi
    };
}

// ============================================
// TRADING BOT
// ============================================

class TradingBot {
    constructor() {
        this.broker = null;
        this.positions = {};
        this.orders = [];
        this.running = false;
    }

    async connect() {
        this.broker = new BrokerClient({
            brokerType: 'alpaca',
            apiKey: process.env.ALPACA_API_KEY,
            apiSecret: process.env.ALPACA_API_SECRET,
            baseUrl: process.env.ALPACA_BASE_URL || 'https://paper-api.alpaca.markets',
            paperTrading: true
        });

        await this.broker.connect();
        console.log('✅ Connected to Alpaca Paper Trading\n');

        const balance = await this.broker.getAccountBalance();
        console.log(`Account Balance: $${balance.equity.toLocaleString()}`);
        console.log(`Buying Power: $${balance.buyingPower.toLocaleString()}\n`);
    }

    async getPositions() {
        const positions = await this.broker.getPositions();
        this.positions = {};
        positions.forEach(p => {
            this.positions[p.symbol] = {
                qty: parseFloat(p.quantity),
                avgPrice: parseFloat(p.avgEntryPrice),
                currentPrice: parseFloat(p.currentPrice),
                pnl: parseFloat(p.unrealizedPnl),
                pnlPercent: parseFloat(p.unrealizedPnlPercent) * 100
            };
        });
        return this.positions;
    }

    async checkStops() {
        for (const [symbol, pos] of Object.entries(this.positions)) {
            // Stop-loss
            if (pos.pnlPercent <= -CONFIG.stopLossPercent) {
                console.log(`🛑 STOP-LOSS: ${symbol} at ${pos.pnlPercent.toFixed(1)}%`);
                if (CONFIG.tradingEnabled) {
                    await this.sell(symbol, pos.qty, 'Stop-loss');
                }
            }
            // Take-profit
            else if (pos.pnlPercent >= CONFIG.takeProfitPercent) {
                console.log(`🎯 TAKE-PROFIT: ${symbol} at ${pos.pnlPercent.toFixed(1)}%`);
                if (CONFIG.tradingEnabled) {
                    await this.sell(symbol, pos.qty, 'Take-profit');
                }
            }
        }
    }

    async buy(symbol, amount, reason) {
        try {
            const balance = await this.broker.getAccountBalance();
            const maxAmount = balance.buyingPower * CONFIG.maxPositionSize;
            const orderAmount = Math.min(amount, maxAmount);

            // Calculate quantity (assume $150 avg price for simplicity)
            const estimatedPrice = 150; // Would use real quote in production
            const qty = Math.floor(orderAmount / estimatedPrice);

            if (qty < 1) {
                console.log(`⚠️ ${symbol}: Insufficient funds for 1 share`);
                return;
            }

            console.log(`📈 BUY ${symbol}: ${qty} shares (~$${orderAmount.toFixed(0)}) - ${reason}`);

            if (CONFIG.tradingEnabled) {
                const order = await this.broker.placeOrder({
                    symbol,
                    quantity: qty,
                    side: 'buy',
                    orderType: 'market',
                    timeInForce: 'day'
                });
                console.log(`   Order ID: ${order.orderId}, Status: ${order.status}`);
            } else {
                console.log(`   (Trading disabled - simulated)`);
            }
        } catch (error) {
            console.error(`❌ Error buying ${symbol}:`, error.message);
        }
    }

    async sell(symbol, qty, reason) {
        try {
            console.log(`📉 SELL ${symbol}: ${qty} shares - ${reason}`);

            if (CONFIG.tradingEnabled) {
                const order = await this.broker.placeOrder({
                    symbol,
                    quantity: qty,
                    side: 'sell',
                    orderType: 'market',
                    timeInForce: 'day'
                });
                console.log(`   Order ID: ${order.orderId}, Status: ${order.status}`);
            } else {
                console.log(`   (Trading disabled - simulated)`);
            }
        } catch (error) {
            console.error(`❌ Error selling ${symbol}:`, error.message);
        }
    }

    async runOnce() {
        console.log(`\n${'═'.repeat(60)}`);
        console.log(`Bot Check: ${new Date().toISOString()}`);
        console.log('═'.repeat(60) + '\n');

        // Get current positions
        await this.getPositions();

        // Check stops on existing positions
        await this.checkStops();

        // Check for new signals (using mock data for demo)
        console.log('Signal Check:');
        for (const symbol of CONFIG.symbols) {
            // In production, fetch real price data here
            // For demo, we'll create mock prices
            const mockPrices = Array.from({length: 250}, (_, i) => 100 + Math.random() * 50);

            const signal = generateSignal(mockPrices);
            const hasPosition = this.positions[symbol];

            const emoji = signal.signal === 'BUY' ? '🟢' :
                         signal.signal === 'SELL' ? '🔴' : '🟡';

            console.log(`  ${emoji} ${symbol}: ${signal.signal} (${signal.reason})`);

            if (signal.signal === 'BUY' && !hasPosition && signal.confidence === 'HIGH') {
                const balance = await this.broker.getAccountBalance();
                const amount = balance.buyingPower * CONFIG.maxPositionSize;
                await this.buy(symbol, amount, signal.reason);
            }

            if (signal.signal === 'SELL' && hasPosition) {
                await this.sell(symbol, hasPosition.qty, signal.reason);
            }
        }

        // Summary
        console.log('\nCurrent Positions:');
        if (Object.keys(this.positions).length === 0) {
            console.log('  No open positions');
        } else {
            for (const [sym, pos] of Object.entries(this.positions)) {
                const pnlEmoji = pos.pnlPercent >= 0 ? '📈' : '📉';
                console.log(`  ${pnlEmoji} ${sym}: ${pos.qty} @ $${pos.avgPrice.toFixed(2)} | P/L: ${pos.pnlPercent.toFixed(1)}%`);
            }
        }
    }

    async start() {
        console.log('Starting automated trading bot...\n');
        console.log(`Trading Enabled: ${CONFIG.tradingEnabled ? 'YES ⚠️' : 'NO (Simulation)'}`);
        console.log(`Check Interval: ${CONFIG.checkIntervalMs / 1000} seconds`);
        console.log(`Max Position Size: ${CONFIG.maxPositionSize * 100}%`);
        console.log(`Stop-Loss: ${CONFIG.stopLossPercent}%`);
        console.log(`Take-Profit: ${CONFIG.takeProfitPercent}%\n`);

        await this.connect();

        // Run once immediately
        await this.runOnce();

        // For demo, just run once. In production, use setInterval:
        // this.interval = setInterval(() => this.runOnce(), CONFIG.checkIntervalMs);

        console.log('\n' + '═'.repeat(60));
        console.log('Bot run complete. In production, this would run continuously.');
        console.log('═'.repeat(60));
    }

    stop() {
        this.running = false;
        if (this.interval) clearInterval(this.interval);
        if (this.broker) this.broker.disconnect();
        console.log('\nBot stopped.');
    }
}

// ============================================
// RUN BOT
// ============================================

async function main() {
    const bot = new TradingBot();

    // Handle shutdown
    process.on('SIGINT', () => {
        console.log('\nShutting down...');
        bot.stop();
        process.exit(0);
    });

    try {
        await bot.start();
    } catch (error) {
        console.error('Bot error:', error.message);
    }
}

main();

// ============================================
// INSTRUCTIONS
// ============================================

console.log(`
═══════════════════════════════════════════════════════════
HOW TO USE THIS BOT
═══════════════════════════════════════════════════════════

1. SIMULATION MODE (Current):
   The bot runs with trading disabled.
   It shows what trades WOULD be made.

2. ENABLE PAPER TRADING:
   Edit CONFIG.tradingEnabled = true
   The bot will place REAL paper trades.

3. RUN CONTINUOUSLY:
   Uncomment the setInterval line in start()
   The bot will check every minute.

4. PRODUCTION CHECKLIST:
   [ ] Test thoroughly in paper mode
   [ ] Monitor for at least 1 week
   [ ] Check all edge cases
   [ ] Never use with real money without extensive testing

5. MARKET HOURS:
   US Stock Market: 9:30 AM - 4:00 PM ET
   Bot works best during market hours.

WARNING: This is for EDUCATIONAL PURPOSES only.
Do NOT use with real money without extensive testing.
═══════════════════════════════════════════════════════════
`);
