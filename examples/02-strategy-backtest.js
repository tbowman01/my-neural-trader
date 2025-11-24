/**
 * Strategy Backtesting Example
 *
 * This example demonstrates:
 * - Fetching historical market data
 * - Calculating technical indicators (SMA, RSI)
 * - Creating trading signals based on strategy rules
 * - Running a backtest to evaluate performance
 * - Analyzing results (Sharpe ratio, win rate, etc.)
 *
 * Strategy: Simple Moving Average Crossover
 * - Buy when fast SMA crosses above slow SMA
 * - Sell when fast SMA crosses below slow SMA
 */

require('dotenv').config();
const {
    BacktestEngine,
    fetchMarketData,
    calculateSma,
    calculateRsi
} = require('neural-trader');

async function strategyBacktestExample() {
    console.log('=== Neural Trader: Strategy Backtesting Example ===\n');

    // Configuration
    const symbol = 'AAPL';
    const startDate = '2023-01-01T00:00:00Z';
    const endDate = '2023-12-31T23:59:59Z';
    const initialCapital = 10000;

    // Strategy parameters
    const fastPeriod = 20;  // Fast SMA period
    const slowPeriod = 50;  // Slow SMA period
    const rsiPeriod = 14;
    const rsiOverbought = 70;
    const rsiOversold = 30;

    try {
        // Step 1: Fetch historical data
        console.log(`📈 Fetching historical data for ${symbol}...`);
        console.log(`  Period: ${startDate.split('T')[0]} to ${endDate.split('T')[0]}`);

        const result = await fetchMarketData(symbol, startDate, endDate, '1Day');

        if (!result.success || !result.data || !result.data.bars) {
            throw new Error(`Failed to fetch market data: ${result.error || 'Unknown error'}`);
        }

        const bars = result.data.bars.map(bar => ({
            symbol: bar.symbol,
            timestamp: bar.timestamp,
            open: parseFloat(bar.open),
            high: parseFloat(bar.high),
            low: parseFloat(bar.low),
            close: parseFloat(bar.close),
            volume: parseFloat(bar.volume)
        }));

        console.log(`✅ Fetched ${bars.length} daily bars\n`);

        if (bars.length < slowPeriod) {
            throw new Error(`Insufficient data: need at least ${slowPeriod} bars for strategy`);
        }

        // Step 3: Calculate technical indicators
        console.log('🔢 Calculating technical indicators...');
        const prices = bars.map(bar => bar.close);

        const fastSMA = calculateSma(prices, fastPeriod);
        const slowSMA = calculateSma(prices, slowPeriod);
        const rsi = calculateRsi(prices, rsiPeriod);

        console.log(`  Fast SMA (${fastPeriod} periods): ✅`);
        console.log(`  Slow SMA (${slowPeriod} periods): ✅`);
        console.log(`  RSI (${rsiPeriod} periods): ✅\n`);

        // Step 4: Generate trading signals
        console.log('🎯 Generating trading signals...');
        const signals = [];

        for (let i = slowPeriod; i < bars.length; i++) {
            const bar = bars[i];
            const prevFastSMA = fastSMA[i - 1];
            const currFastSMA = fastSMA[i];
            const prevSlowSMA = slowSMA[i - 1];
            const currSlowSMA = slowSMA[i];
            const currRSI = rsi[i];

            // Skip if any values are NaN
            if (isNaN(prevFastSMA) || isNaN(currFastSMA) ||
                isNaN(prevSlowSMA) || isNaN(currSlowSMA) ||
                isNaN(currRSI)) {
                continue;
            }

            // Bullish crossover: fast SMA crosses above slow SMA
            if (prevFastSMA <= prevSlowSMA && currFastSMA > currSlowSMA && currRSI < rsiOverbought) {
                signals.push({
                    id: `signal_${signals.length + 1}`,
                    strategyId: 'sma_crossover',
                    symbol: symbol,
                    direction: 'long',
                    confidence: 0.75,
                    entryPrice: bar.close,
                    stopLoss: bar.close * 0.97,  // 3% stop loss
                    takeProfit: bar.close * 1.05, // 5% take profit
                    reasoning: `Fast SMA (${currFastSMA.toFixed(2)}) crossed above Slow SMA (${currSlowSMA.toFixed(2)})`,
                    timestampNs: Date.parse(bar.timestamp) * 1000000
                });
            }
            // Bearish crossover: fast SMA crosses below slow SMA
            else if (prevFastSMA >= prevSlowSMA && currFastSMA < currSlowSMA && currRSI > rsiOversold) {
                signals.push({
                    id: `signal_${signals.length + 1}`,
                    strategyId: 'sma_crossover',
                    symbol: symbol,
                    direction: 'short',
                    confidence: 0.75,
                    entryPrice: bar.close,
                    stopLoss: bar.close * 1.03,  // 3% stop loss
                    takeProfit: bar.close * 0.95, // 5% take profit
                    reasoning: `Fast SMA (${currFastSMA.toFixed(2)}) crossed below Slow SMA (${currSlowSMA.toFixed(2)})`,
                    timestampNs: Date.parse(bar.timestamp) * 1000000
                });
            }
        }

        console.log(`✅ Generated ${signals.length} trading signals\n`);

        if (signals.length === 0) {
            console.log('⚠️  No signals generated. Try adjusting strategy parameters or date range.');
            await dataProvider.disconnect();
            return;
        }

        // Show first few signals
        console.log('📋 First 3 signals:');
        signals.slice(0, 3).forEach((sig, i) => {
            console.log(`\nSignal ${i + 1}:`);
            console.log(`  Direction:   ${sig.direction.toUpperCase()}`);
            console.log(`  Entry Price: $${sig.entryPrice.toFixed(2)}`);
            console.log(`  Stop Loss:   $${sig.stopLoss.toFixed(2)}`);
            console.log(`  Take Profit: $${sig.takeProfit.toFixed(2)}`);
            console.log(`  Reasoning:   ${sig.reasoning}`);
        });
        console.log();

        // Step 5: Run backtest
        console.log('🔄 Running backtest...');
        const backtestEngine = new BacktestEngine({
            initialCapital: initialCapital,
            startDate: startDate,
            endDate: endDate,
            commission: 0.001,  // 0.1% commission per trade
            slippage: 0.0005,   // 0.05% slippage
            useMarkToMarket: true
        });

        // Convert bars to JSON format for backtest engine
        const marketDataJson = JSON.stringify({
            bars: bars.map(bar => ({
                symbol: bar.symbol,
                timestamp: bar.timestamp,
                open: bar.open.toString(),
                high: bar.high.toString(),
                low: bar.low.toString(),
                close: bar.close.toString(),
                volume: bar.volume.toString()
            }))
        });

        const backtestResult = await backtestEngine.run(signals, marketDataJson);
        console.log('✅ Backtest complete\n');

        // Step 6: Display results
        console.log('=== Backtest Results ===\n');

        const metrics = backtestResult.metrics;
        console.log('📊 Performance Metrics:');
        console.log(`  Initial Capital:   $${initialCapital.toFixed(2)}`);
        console.log(`  Final Equity:      $${metrics.finalEquity.toFixed(2)}`);
        console.log(`  Total Return:      ${(metrics.totalReturn * 100).toFixed(2)}%`);
        console.log(`  Annual Return:     ${(metrics.annualReturn * 100).toFixed(2)}%`);
        console.log(`  Sharpe Ratio:      ${metrics.sharpeRatio.toFixed(2)}`);
        console.log(`  Sortino Ratio:     ${metrics.sortinoRatio.toFixed(2)}`);
        console.log(`  Max Drawdown:      ${(metrics.maxDrawdown * 100).toFixed(2)}%`);
        console.log();

        console.log('📈 Trading Statistics:');
        console.log(`  Total Trades:      ${metrics.totalTrades}`);
        console.log(`  Winning Trades:    ${metrics.winningTrades} (${(metrics.winRate * 100).toFixed(1)}%)`);
        console.log(`  Losing Trades:     ${metrics.losingTrades}`);
        console.log(`  Profit Factor:     ${metrics.profitFactor.toFixed(2)}`);
        console.log(`  Avg Win:           $${metrics.avgWin.toFixed(2)}`);
        console.log(`  Avg Loss:          $${metrics.avgLoss.toFixed(2)}`);
        console.log(`  Largest Win:       $${metrics.largestWin.toFixed(2)}`);
        console.log(`  Largest Loss:      $${metrics.largestLoss.toFixed(2)}`);
        console.log();

        // Step 7: Evaluate strategy
        console.log('🎯 Strategy Evaluation:');

        if (metrics.sharpeRatio > 1.5) {
            console.log('  ✅ EXCELLENT Sharpe Ratio (> 1.5)');
        } else if (metrics.sharpeRatio > 1.0) {
            console.log('  ✅ GOOD Sharpe Ratio (> 1.0)');
        } else if (metrics.sharpeRatio > 0.5) {
            console.log('  ⚠️  FAIR Sharpe Ratio (> 0.5)');
        } else {
            console.log('  ❌ POOR Sharpe Ratio (< 0.5)');
        }

        if (metrics.winRate > 0.55) {
            console.log('  ✅ STRONG Win Rate (> 55%)');
        } else if (metrics.winRate > 0.45) {
            console.log('  ⚠️  AVERAGE Win Rate (45-55%)');
        } else {
            console.log('  ❌ WEAK Win Rate (< 45%)');
        }

        if (metrics.profitFactor > 1.5) {
            console.log('  ✅ STRONG Profit Factor (> 1.5)');
        } else if (metrics.profitFactor > 1.0) {
            console.log('  ⚠️  MARGINAL Profit Factor (> 1.0)');
        } else {
            console.log('  ❌ LOSING Profit Factor (< 1.0)');
        }

        if (metrics.maxDrawdown < 0.15) {
            console.log('  ✅ LOW Drawdown (< 15%)');
        } else if (metrics.maxDrawdown < 0.25) {
            console.log('  ⚠️  MODERATE Drawdown (< 25%)');
        } else {
            console.log('  ❌ HIGH Drawdown (> 25%)');
        }
        console.log();

        // Step 8: Show recent trades
        if (backtestResult.trades.length > 0) {
            console.log('📝 Last 3 Trades:');
            const recentTrades = backtestResult.trades.slice(-3);
            recentTrades.forEach((trade, i) => {
                console.log(`\nTrade ${backtestResult.trades.length - recentTrades.length + i + 1}:`);
                console.log(`  Symbol:       ${trade.symbol}`);
                console.log(`  Entry Date:   ${trade.entryDate.split('T')[0]}`);
                console.log(`  Exit Date:    ${trade.exitDate.split('T')[0]}`);
                console.log(`  Entry Price:  $${trade.entryPrice.toFixed(2)}`);
                console.log(`  Exit Price:   $${trade.exitPrice.toFixed(2)}`);
                console.log(`  Quantity:     ${trade.quantity}`);
                console.log(`  P&L:          $${trade.pnl.toFixed(2)} (${(trade.pnlPercentage * 100).toFixed(2)}%)`);
                console.log(`  Commission:   $${trade.commissionPaid.toFixed(2)}`);
            });
            console.log();
        }

        console.log();

        console.log('=== Example Complete ===');
        console.log('\nNext steps:');
        console.log('1. Experiment with different strategy parameters');
        console.log('2. Try different symbols (MSFT, GOOGL, SPY, etc.)');
        console.log('3. Add more technical indicators (MACD, Bollinger Bands)');
        console.log('4. Implement risk management rules');
        console.log('5. Run on different time periods to test robustness');

    } catch (error) {
        console.error('❌ Error:', error.message);
        console.error(error.stack);

        if (error.message.includes('PKXXXXXXXXXXXXXX')) {
            console.error('\n⚠️  Please update your .env file with real Alpaca API keys!');
            console.error('Get free keys at: https://alpaca.markets\n');
        }

        process.exit(1);
    }
}

// Run the example
if (require.main === module) {
    strategyBacktestExample().catch(error => {
        console.error('Fatal error:', error);
        process.exit(1);
    });
}

module.exports = { strategyBacktestExample };
