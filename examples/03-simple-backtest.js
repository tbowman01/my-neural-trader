/**
 * Simple Backtesting Example
 *
 * This example demonstrates a simplified backtesting workflow:
 * - Uses sample historical data
 * - Implements a basic SMA crossover strategy
 * - Calculates performance metrics manually
 * - Shows how backtesting logic works
 */

require('dotenv').config();
const { calculateSma, calculateRsi } = require('neural-trader');

// Sample AAPL historical data (simplified for demonstration)
const sampleData = [
    { date: '2023-01-03', close: 125.07 },
    { date: '2023-01-04', close: 126.36 },
    { date: '2023-01-05', close: 125.02 },
    { date: '2023-01-06', close: 129.62 },
    { date: '2023-01-09', close: 130.15 },
    { date: '2023-01-10', close: 130.73 },
    { date: '2023-01-11', close: 133.49 },
    { date: '2023-01-12', close: 133.41 },
    { date: '2023-01-13', close: 134.76 },
    { date: '2023-01-17', close: 135.94 },
    { date: '2023-01-18', close: 135.21 },
    { date: '2023-01-19', close: 135.27 },
    { date: '2023-01-20', close: 137.87 },
    { date: '2023-01-23', close: 141.11 },
    { date: '2023-01-24', close: 142.53 },
    { date: '2023-01-25', close: 141.86 },
    { date: '2023-01-26', close: 143.96 },
    { date: '2023-01-27', close: 145.93 },
    { date: '2023-01-30', close: 143.00 },
    { date: '2023-01-31', close: 144.29 },
    { date: '2023-02-01', close: 145.43 },
    { date: '2023-02-02', close: 150.82 },
    { date: '2023-02-03', close: 154.50 },
    { date: '2023-02-06', close: 151.73 },
    { date: '2023-02-07', close: 154.65 },
    { date: '2023-02-08', close: 151.92 },
    { date: '2023-02-09', close: 150.87 },
    { date: '2023-02-10', close: 151.01 },
    { date: '2023-02-13', close: 153.85 },
    { date: '2023-02-14', close: 153.20 },
    { date: '2023-02-15', close: 155.33 },
    { date: '2023-02-16', close: 153.71 },
    { date: '2023-02-17', close: 152.55 },
    { date: '2023-02-21', close: 148.48 },
    { date: '2023-02-22', close: 148.91 },
    { date: '2023-02-23', close: 149.40 },
    { date: '2023-02-24', close: 146.71 },
    { date: '2023-02-27', close: 147.92 },
    { date: '2023-02-28', close: 147.41 },
    { date: '2023-03-01', close: 145.31 },
    { date: '2023-03-02', close: 145.91 },
    { date: '2023-03-03', close: 151.03 },
    { date: '2023-03-06', close: 153.83 },
    { date: '2023-03-07', close: 151.60 },
    { date: '2023-03-08', close: 152.87 },
    { date: '2023-03-09', close: 150.59 },
    { date: '2023-03-10', close: 148.50 },
    { date: '2023-03-13', close: 150.47 },
    { date: '2023-03-14', close: 152.59 },
    { date: '2023-03-15', close: 152.99 },
    { date: '2023-03-16', close: 155.85 },
    { date: '2023-03-17', close: 155.00 },
    { date: '2023-03-20', close: 157.40 },
    { date: '2023-03-21', close: 159.28 },
    { date: '2023-03-22', close: 157.83 },
    { date: '2023-03-23', close: 158.93 },
    { date: '2023-03-24', close: 160.25 },
    { date: '2023-03-27', close: 158.28 },
    { date: '2023-03-28', close: 157.65 },
    { date: '2023-03-29', close: 160.77 },
    { date: '2023-03-30', close: 162.36 },
    { date: '2023-03-31', close: 164.90 },
];

async function simpleBacktestExample() {
    console.log('=== Simple Backtesting Example ===\n');

    // Strategy parameters
    const fastPeriod = 5;   // 5-day fast SMA
    const slowPeriod = 20;  // 20-day slow SMA
    const initialCapital = 10000;
    const commission = 0.001; // 0.1% per trade

    // Step 1: Extract prices
    console.log('📊 Data Summary:');
    console.log(`  Symbol: AAPL`);
    console.log(`  Period: ${sampleData[0].date} to ${sampleData[sampleData.length - 1].date}`);
    console.log(`  Total days: ${sampleData.length}`);
    console.log(`  Starting price: $${sampleData[0].close.toFixed(2)}`);
    console.log(`  Ending price: $${sampleData[sampleData.length - 1].close.toFixed(2)}`);
    console.log();

    // Step 2: Calculate technical indicators
    console.log('🔢 Calculating technical indicators...');
    const prices = sampleData.map(d => d.close);

    const fastSMA = calculateSma(prices, fastPeriod);
    const slowSMA = calculateSma(prices, slowPeriod);
    const rsi = calculateRsi(prices, 14);

    console.log(`  Fast SMA (${fastPeriod}-day): ✅`);
    console.log(`  Slow SMA (${slowPeriod}-day): ✅`);
    console.log(`  RSI (14-day): ✅`);
    console.log();

    // Step 3: Generate signals and simulate trades
    console.log('🎯 Generating trading signals...\n');

    let cash = initialCapital;
    let shares = 0;
    let position = null; // null = no position, 'long' = holding shares
    const trades = [];

    for (let i = slowPeriod; i < sampleData.length; i++) {
        const date = sampleData[i].date;
        const price = prices[i];
        const prevFast = fastSMA[i - 1];
        const currFast = fastSMA[i];
        const prevSlow = slowSMA[i - 1];
        const currSlow = slowSMA[i];

        // Skip if indicators not ready
        if (isNaN(prevFast) || isNaN(currFast) || isNaN(prevSlow) || isNaN(currSlow)) {
            continue;
        }

        // BUY SIGNAL: Fast SMA crosses above Slow SMA
        if (!position && prevFast <= prevSlow && currFast > currSlow) {
            const sharesToBuy = Math.floor(cash / price);
            if (sharesToBuy > 0) {
                const cost = sharesToBuy * price;
                const commissionCost = cost * commission;
                const totalCost = cost + commissionCost;

                cash -= totalCost;
                shares = sharesToBuy;
                position = {
                    type: 'long',
                    entryDate: date,
                    entryPrice: price,
                    shares: sharesToBuy,
                    commission: commissionCost
                };

                console.log(`🟢 BUY Signal - ${date}`);
                console.log(`   Fast SMA: $${currFast.toFixed(2)} crossed above Slow SMA: $${currSlow.toFixed(2)}`);
                console.log(`   Entry Price: $${price.toFixed(2)}`);
                console.log(`   Shares: ${sharesToBuy}`);
                console.log(`   Cost: $${totalCost.toFixed(2)} (includes $${commissionCost.toFixed(2)} commission)`);
                console.log(`   Remaining Cash: $${cash.toFixed(2)}`);
                console.log();
            }
        }
        // SELL SIGNAL: Fast SMA crosses below Slow SMA
        else if (position && prevFast >= prevSlow && currFast < currSlow) {
            const proceeds = shares * price;
            const commissionCost = proceeds * commission;
            const netProceeds = proceeds - commissionCost;

            cash += netProceeds;

            const pnl = netProceeds - (position.shares * position.entryPrice + position.commission);
            const pnlPct = (pnl / (position.shares * position.entryPrice)) * 100;

            const trade = {
                entryDate: position.entryDate,
                exitDate: date,
                entryPrice: position.entryPrice,
                exitPrice: price,
                shares: position.shares,
                pnl: pnl,
                pnlPct: pnlPct,
                commission: position.commission + commissionCost
            };

            trades.push(trade);

            console.log(`🔴 SELL Signal - ${date}`);
            console.log(`   Fast SMA: $${currFast.toFixed(2)} crossed below Slow SMA: $${currSlow.toFixed(2)}`);
            console.log(`   Exit Price: $${price.toFixed(2)}`);
            console.log(`   Shares: ${shares}`);
            console.log(`   Proceeds: $${netProceeds.toFixed(2)} (after $${commissionCost.toFixed(2)} commission)`);
            console.log(`   P&L: $${pnl.toFixed(2)} (${pnlPct.toFixed(2)}%)`);
            console.log(`   Total Cash: $${cash.toFixed(2)}`);
            console.log();

            shares = 0;
            position = null;
        }
    }

    // Close any open position at the end
    if (position) {
        const exitPrice = prices[prices.length - 1];
        const proceeds = shares * exitPrice;
        const commissionCost = proceeds * commission;
        const netProceeds = proceeds - commissionCost;
        cash += netProceeds;

        const pnl = netProceeds - (position.shares * position.entryPrice + position.commission);
        const pnlPct = (pnl / (position.shares * position.entryPrice)) * 100;

        trades.push({
            entryDate: position.entryDate,
            exitDate: sampleData[sampleData.length - 1].date,
            entryPrice: position.entryPrice,
            exitPrice: exitPrice,
            shares: position.shares,
            pnl: pnl,
            pnlPct: pnlPct,
            commission: position.commission + commissionCost
        });

        console.log(`🔴 CLOSE Position at end - ${sampleData[sampleData.length - 1].date}`);
        console.log(`   Exit Price: $${exitPrice.toFixed(2)}`);
        console.log(`   P&L: $${pnl.toFixed(2)} (${pnlPct.toFixed(2)}%)`);
        console.log();

        shares = 0;
        position = null;
    }

    // Step 4: Calculate performance metrics
    console.log('=== Backtest Results ===\n');

    const finalEquity = cash;
    const totalReturn = ((finalEquity - initialCapital) / initialCapital) * 100;

    console.log('📊 Performance Metrics:');
    console.log(`  Initial Capital:  $${initialCapital.toFixed(2)}`);
    console.log(`  Final Equity:     $${finalEquity.toFixed(2)}`);
    console.log(`  Total Return:     ${totalReturn.toFixed(2)}%`);
    console.log(`  Total Trades:     ${trades.length}`);
    console.log();

    if (trades.length > 0) {
        const winningTrades = trades.filter(t => t.pnl > 0);
        const losingTrades = trades.filter(t => t.pnl <= 0);
        const winRate = (winningTrades.length / trades.length) * 100;

        const totalWins = winningTrades.reduce((sum, t) => sum + t.pnl, 0);
        const totalLosses = Math.abs(losingTrades.reduce((sum, t) => sum + t.pnl, 0));
        const profitFactor = totalLosses > 0 ? totalWins / totalLosses : 0;

        const avgWin = winningTrades.length > 0 ? totalWins / winningTrades.length : 0;
        const avgLoss = losingTrades.length > 0 ? totalLosses / losingTrades.length : 0;

        console.log('📈 Trading Statistics:');
        console.log(`  Winning Trades:   ${winningTrades.length} (${winRate.toFixed(1)}%)`);
        console.log(`  Losing Trades:    ${losingTrades.length}`);
        console.log(`  Profit Factor:    ${profitFactor.toFixed(2)}`);
        console.log(`  Avg Win:          $${avgWin.toFixed(2)}`);
        console.log(`  Avg Loss:         $${avgLoss.toFixed(2)}`);
        console.log();

        // Show all trades
        console.log('📝 All Trades:');
        trades.forEach((trade, i) => {
            const status = trade.pnl > 0 ? '✅ WIN' : '❌ LOSS';
            console.log(`\nTrade ${i + 1}: ${status}`);
            console.log(`  Entry: ${trade.entryDate} @ $${trade.entryPrice.toFixed(2)}`);
            console.log(`  Exit:  ${trade.exitDate} @ $${trade.exitPrice.toFixed(2)}`);
            console.log(`  Shares: ${trade.shares}`);
            console.log(`  P&L: $${trade.pnl.toFixed(2)} (${trade.pnlPct.toFixed(2)}%)`);
        });
        console.log();

        // Compare to buy-and-hold
        const buyHoldReturn = ((prices[prices.length - 1] - prices[0]) / prices[0]) * 100;
        console.log('📊 Strategy vs Buy & Hold:');
        console.log(`  Strategy Return:     ${totalReturn.toFixed(2)}%`);
        console.log(`  Buy & Hold Return:   ${buyHoldReturn.toFixed(2)}%`);
        console.log(`  Difference:          ${(totalReturn - buyHoldReturn).toFixed(2)}%`);

        if (totalReturn > buyHoldReturn) {
            console.log(`  ✅ Strategy outperformed buy & hold!`);
        } else {
            console.log(`  ❌ Strategy underperformed buy & hold`);
        }
    }

    console.log('\n=== Example Complete ===');
    console.log('\nNext steps:');
    console.log('1. Try different SMA periods (e.g., 10/30, 5/15)');
    console.log('2. Add stop-loss and take-profit rules');
    console.log('3. Experiment with position sizing');
    console.log('4. Test with real market data when API is working');
}

// Run the example
if (require.main === module) {
    simpleBacktestExample().catch(error => {
        console.error('Fatal error:', error);
        process.exit(1);
    });
}

module.exports = { simpleBacktestExample };
