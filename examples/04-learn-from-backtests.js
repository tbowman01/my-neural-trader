/**
 * Learn From Backtests - Strategy Optimization
 *
 * This example demonstrates how to use backtesting to:
 * 1. Test multiple strategy parameters
 * 2. Learn which parameters work best
 * 3. Analyze what market conditions favor your strategy
 * 4. Build intuition about trading patterns
 *
 * Strategy: SMA Crossover with Parameter Optimization
 */

require('dotenv').config();
const { calculateSma, calculateRsi } = require('neural-trader');

// Extended AAPL data for better learning (Q1 2023)
const marketData = [
    { date: '2023-01-03', close: 125.07, volume: 112117500 },
    { date: '2023-01-04', close: 126.36, volume: 89113600 },
    { date: '2023-01-05', close: 125.02, volume: 80962700 },
    { date: '2023-01-06', close: 129.62, volume: 87754700 },
    { date: '2023-01-09', close: 130.15, volume: 70790800 },
    { date: '2023-01-10', close: 130.73, volume: 63896200 },
    { date: '2023-01-11', close: 133.49, volume: 69458900 },
    { date: '2023-01-12', close: 133.41, volume: 71379600 },
    { date: '2023-01-13', close: 134.76, volume: 57809700 },
    { date: '2023-01-17', close: 135.94, volume: 63646600 },
    { date: '2023-01-18', close: 135.21, volume: 69672800 },
    { date: '2023-01-19', close: 135.27, volume: 58280400 },
    { date: '2023-01-20', close: 137.87, volume: 60029400 },
    { date: '2023-01-23', close: 141.11, volume: 64277900 },
    { date: '2023-01-24', close: 142.53, volume: 68087000 },
    { date: '2023-01-25', close: 141.86, volume: 65187100 },
    { date: '2023-01-26', close: 143.96, volume: 54105000 },
    { date: '2023-01-27', close: 145.93, volume: 70540600 },
    { date: '2023-01-30', close: 143.00, volume: 64015300 },
    { date: '2023-01-31', close: 144.29, volume: 65874500 },
    { date: '2023-02-01', close: 145.43, volume: 77663600 },
    { date: '2023-02-02', close: 150.82, volume: 118339000 },
    { date: '2023-02-03', close: 154.50, volume: 141147400 },
    { date: '2023-02-06', close: 151.73, volume: 87558000 },
    { date: '2023-02-07', close: 154.65, volume: 82991300 },
    { date: '2023-02-08', close: 151.92, volume: 65470500 },
    { date: '2023-02-09', close: 150.87, volume: 56799200 },
    { date: '2023-02-10', close: 151.01, volume: 57318400 },
    { date: '2023-02-13', close: 153.85, volume: 69672300 },
    { date: '2023-02-14', close: 153.20, volume: 64572500 },
    { date: '2023-02-15', close: 155.33, volume: 65566400 },
    { date: '2023-02-16', close: 153.71, volume: 60029400 },
    { date: '2023-02-17', close: 152.55, volume: 67573800 },
    { date: '2023-02-21', close: 148.48, volume: 69092900 },
    { date: '2023-02-22', close: 148.91, volume: 51011300 },
    { date: '2023-02-23', close: 149.40, volume: 59256200 },
    { date: '2023-02-24', close: 146.71, volume: 55199000 },
    { date: '2023-02-27', close: 147.92, volume: 48597200 },
    { date: '2023-02-28', close: 147.41, volume: 53522000 },
    { date: '2023-03-01', close: 145.31, volume: 55478800 },
    { date: '2023-03-02', close: 145.91, volume: 52279000 },
    { date: '2023-03-03', close: 151.03, volume: 70732300 },
    { date: '2023-03-06', close: 153.83, volume: 87558000 },
    { date: '2023-03-07', close: 151.60, volume: 56182000 },
    { date: '2023-03-08', close: 152.87, volume: 47204800 },
    { date: '2023-03-09', close: 150.59, volume: 68572400 },
    { date: '2023-03-10', close: 148.50, volume: 68713000 },
    { date: '2023-03-13', close: 150.47, volume: 70732300 },
    { date: '2023-03-14', close: 152.59, volume: 69238100 },
    { date: '2023-03-15', close: 152.99, volume: 76259900 },
    { date: '2023-03-16', close: 155.85, volume: 76976300 },
    { date: '2023-03-17', close: 155.00, volume: 98369200 },
    { date: '2023-03-20', close: 157.40, volume: 69667100 },
    { date: '2023-03-21', close: 159.28, volume: 73641400 },
    { date: '2023-03-22', close: 157.83, volume: 75701800 },
    { date: '2023-03-23', close: 158.93, volume: 76300700 },
    { date: '2023-03-24', close: 160.25, volume: 59196500 },
    { date: '2023-03-27', close: 158.28, volume: 53212800 },
    { date: '2023-03-28', close: 157.65, volume: 45992100 },
    { date: '2023-03-29', close: 160.77, volume: 51305700 },
    { date: '2023-03-30', close: 162.36, volume: 49501700 },
    { date: '2023-03-31', close: 164.90, volume: 68572400 },
];

/**
 * Run a backtest with specific parameters
 */
function runBacktest(data, fastPeriod, slowPeriod, initialCapital = 10000, commission = 0.001) {
    const prices = data.map(d => d.close);
    const fastSMA = calculateSma(prices, fastPeriod);
    const slowSMA = calculateSma(prices, slowPeriod);

    let cash = initialCapital;
    let shares = 0;
    let position = null;
    const trades = [];
    const equityCurve = [];

    for (let i = slowPeriod; i < data.length; i++) {
        const date = data[i].date;
        const price = prices[i];
        const prevFast = fastSMA[i - 1];
        const currFast = fastSMA[i];
        const prevSlow = slowSMA[i - 1];
        const currSlow = slowSMA[i];

        if (isNaN(prevFast) || isNaN(currFast) || isNaN(prevSlow) || isNaN(currSlow)) {
            continue;
        }

        // BUY: Fast crosses above Slow
        if (!position && prevFast <= prevSlow && currFast > currSlow) {
            const sharesToBuy = Math.floor(cash / price);
            if (sharesToBuy > 0) {
                const cost = sharesToBuy * price;
                const commissionCost = cost * commission;
                cash -= (cost + commissionCost);
                shares = sharesToBuy;
                position = {
                    entryDate: date,
                    entryPrice: price,
                    shares: sharesToBuy,
                    entryCommission: commissionCost
                };
            }
        }
        // SELL: Fast crosses below Slow
        else if (position && prevFast >= prevSlow && currFast < currSlow) {
            const proceeds = shares * price;
            const commissionCost = proceeds * commission;
            cash += (proceeds - commissionCost);

            const pnl = (proceeds - commissionCost) - (position.shares * position.entryPrice + position.entryCommission);
            const pnlPct = (pnl / (position.shares * position.entryPrice)) * 100;

            trades.push({
                entryDate: position.entryDate,
                exitDate: date,
                entryPrice: position.entryPrice,
                exitPrice: price,
                shares: position.shares,
                pnl: pnl,
                pnlPct: pnlPct,
                holdingDays: i - data.findIndex(d => d.date === position.entryDate)
            });

            shares = 0;
            position = null;
        }

        // Track equity
        const equity = cash + (shares * price);
        equityCurve.push({ date, equity });
    }

    // Close position if still open
    if (position) {
        const exitPrice = prices[prices.length - 1];
        const proceeds = shares * exitPrice;
        const commissionCost = proceeds * commission;
        cash += (proceeds - commissionCost);

        const pnl = (proceeds - commissionCost) - (position.shares * position.entryPrice + position.entryCommission);
        const pnlPct = (pnl / (position.shares * position.entryPrice)) * 100;

        trades.push({
            entryDate: position.entryDate,
            exitDate: data[data.length - 1].date,
            entryPrice: position.entryPrice,
            exitPrice: exitPrice,
            shares: position.shares,
            pnl: pnl,
            pnlPct: pnlPct,
            holdingDays: data.length - 1 - data.findIndex(d => d.date === position.entryDate)
        });

        shares = 0;
    }

    const finalEquity = cash;
    const totalReturn = ((finalEquity - initialCapital) / initialCapital) * 100;

    // Calculate metrics
    const winningTrades = trades.filter(t => t.pnl > 0);
    const losingTrades = trades.filter(t => t.pnl <= 0);
    const winRate = trades.length > 0 ? (winningTrades.length / trades.length) * 100 : 0;

    const totalWins = winningTrades.reduce((sum, t) => sum + t.pnl, 0);
    const totalLosses = Math.abs(losingTrades.reduce((sum, t) => sum + t.pnl, 0));
    const profitFactor = totalLosses > 0 ? totalWins / totalLosses : (totalWins > 0 ? 999 : 0);

    const avgWin = winningTrades.length > 0 ? totalWins / winningTrades.length : 0;
    const avgLoss = losingTrades.length > 0 ? totalLosses / losingTrades.length : 0;

    return {
        fastPeriod,
        slowPeriod,
        initialCapital,
        finalEquity,
        totalReturn,
        totalTrades: trades.length,
        winningTrades: winningTrades.length,
        losingTrades: losingTrades.length,
        winRate,
        profitFactor,
        avgWin,
        avgLoss,
        trades,
        equityCurve
    };
}

/**
 * Main learning function
 */
async function learnFromBacktests() {
    console.log('=== Learning From Backtests: Parameter Optimization ===\n');

    console.log('📊 Market Data Summary:');
    console.log(`  Symbol: AAPL`);
    console.log(`  Period: ${marketData[0].date} to ${marketData[marketData.length - 1].date}`);
    console.log(`  Total days: ${marketData.length}`);
    console.log(`  Price range: $${Math.min(...marketData.map(d => d.close)).toFixed(2)} - $${Math.max(...marketData.map(d => d.close)).toFixed(2)}`);
    console.log();

    // Step 1: Test multiple parameter combinations
    console.log('🔬 Step 1: Testing Multiple Parameter Combinations\n');
    console.log('Running backtests with different SMA periods...\n');

    const parameterCombinations = [
        { fast: 3, slow: 10 },
        { fast: 5, slow: 15 },
        { fast: 5, slow: 20 },
        { fast: 10, slow: 20 },
        { fast: 10, slow: 30 },
        { fast: 15, slow: 30 },
        { fast: 20, slow: 50 }
    ];

    const results = [];

    for (const params of parameterCombinations) {
        const result = runBacktest(marketData, params.fast, params.slow);
        results.push(result);

        console.log(`SMA(${params.fast}/${params.slow}):`);
        console.log(`  Return: ${result.totalReturn.toFixed(2)}%  |  Trades: ${result.totalTrades}  |  Win Rate: ${result.winRate.toFixed(0)}%  |  Profit Factor: ${result.profitFactor.toFixed(2)}`);
    }

    console.log();

    // Step 2: Analyze and rank results
    console.log('📈 Step 2: Analyzing Results\n');

    // Sort by total return
    const sortedByReturn = [...results].sort((a, b) => b.totalReturn - a.totalReturn);

    console.log('🏆 Top 3 by Total Return:');
    sortedByReturn.slice(0, 3).forEach((r, i) => {
        console.log(`\n${i + 1}. SMA(${r.fastPeriod}/${r.slowPeriod})`);
        console.log(`   Total Return:    ${r.totalReturn.toFixed(2)}%`);
        console.log(`   Total Trades:    ${r.totalTrades}`);
        console.log(`   Win Rate:        ${r.winRate.toFixed(1)}%`);
        console.log(`   Profit Factor:   ${r.profitFactor.toFixed(2)}`);
        console.log(`   Avg Win:         $${r.avgWin.toFixed(2)}`);
        console.log(`   Avg Loss:        $${r.avgLoss.toFixed(2)}`);
    });

    console.log('\n');

    // Sort by win rate (for consistency)
    const sortedByWinRate = [...results].filter(r => r.totalTrades >= 3).sort((a, b) => b.winRate - a.winRate);

    if (sortedByWinRate.length > 0) {
        console.log('🎯 Most Consistent (Win Rate, min 3 trades):');
        sortedByWinRate.slice(0, 3).forEach((r, i) => {
            console.log(`\n${i + 1}. SMA(${r.fastPeriod}/${r.slowPeriod})`);
            console.log(`   Win Rate:        ${r.winRate.toFixed(1)}%`);
            console.log(`   Total Trades:    ${r.totalTrades}`);
            console.log(`   Total Return:    ${r.totalReturn.toFixed(2)}%`);
        });
    }

    console.log('\n');

    // Step 3: Learn key insights
    console.log('🧠 Step 3: Key Learnings\n');

    const bestResult = sortedByReturn[0];
    const buyHoldReturn = ((marketData[marketData.length - 1].close - marketData[0].close) / marketData[0].close) * 100;

    console.log('💡 Insights from Backtesting:\n');

    console.log(`1. Market Trend:`);
    console.log(`   Buy & Hold returned: ${buyHoldReturn.toFixed(2)}%`);
    if (buyHoldReturn > 15) {
        console.log(`   ✅ Strong uptrend - Most strategies struggled to beat buy & hold`);
        console.log(`   📚 Learning: In strong trends, minimize trades or use trend-following`);
    } else if (buyHoldReturn > 5) {
        console.log(`   ✅ Moderate uptrend - SMA crossovers can add value with timing`);
    } else {
        console.log(`   ⚠️  Sideways market - Crossover strategies should perform better`);
    }

    console.log();

    console.log(`2. Trade Frequency:`);
    const avgTrades = results.reduce((sum, r) => sum + r.totalTrades, 0) / results.length;
    console.log(`   Average trades across strategies: ${avgTrades.toFixed(1)}`);
    if (avgTrades < 3) {
        console.log(`   ⚠️  Too few trades - Hard to trust results statistically`);
        console.log(`   📚 Learning: Use faster SMAs for more signals, or test longer periods`);
    } else if (avgTrades > 10) {
        console.log(`   ⚠️  Many trades - Watch out for commissions eating profits`);
        console.log(`   📚 Learning: Consider transaction costs carefully`);
    } else {
        console.log(`   ✅ Good balance of trading frequency`);
    }

    console.log();

    console.log(`3. Parameter Sensitivity:`);
    const returnRange = sortedByReturn[0].totalReturn - sortedByReturn[sortedByReturn.length - 1].totalReturn;
    console.log(`   Return range: ${returnRange.toFixed(2)}%`);
    if (returnRange > 15) {
        console.log(`   ⚠️  High sensitivity - Results vary significantly with parameters`);
        console.log(`   📚 Learning: Strategy requires careful optimization, risk of overfitting`);
    } else {
        console.log(`   ✅ Moderate sensitivity - Strategy is relatively robust`);
    }

    console.log();

    console.log(`4. Best Strategy Profile:`);
    console.log(`   SMA(${bestResult.fastPeriod}/${bestResult.slowPeriod})`);
    console.log(`   Total Return: ${bestResult.totalReturn.toFixed(2)}%`);
    console.log(`   Win Rate: ${bestResult.winRate.toFixed(1)}%`);
    console.log(`   Trades: ${bestResult.totalTrades}`);
    if (bestResult.totalReturn > buyHoldReturn) {
        console.log(`   ✅ Beat buy & hold by ${(bestResult.totalReturn - buyHoldReturn).toFixed(2)}%!`);
    } else {
        console.log(`   ❌ Underperformed buy & hold by ${(buyHoldReturn - bestResult.totalReturn).toFixed(2)}%`);
    }

    console.log();

    // Step 4: Recommendations
    console.log('🎯 Step 4: Actionable Recommendations\n');

    console.log('Based on this analysis, here\'s what to do next:\n');

    if (bestResult.totalReturn > buyHoldReturn) {
        console.log('✅ STRATEGY IS WORKING:');
        console.log(`   1. Use SMA(${bestResult.fastPeriod}/${bestResult.slowPeriod}) as your base strategy`);
        console.log(`   2. Test on different time periods to verify robustness`);
        console.log(`   3. Add risk management (stop-loss, position sizing)`);
        console.log(`   4. Consider paper trading to validate in real-time`);
    } else {
        console.log('⚠️  STRATEGY NEEDS IMPROVEMENT:');
        console.log(`   1. Test faster SMAs (3/8, 5/10) for earlier entry`);
        console.log(`   2. Add filters (RSI, volume) to improve signal quality`);
        console.log(`   3. Consider different strategies for strong trends`);
        console.log(`   4. Test on sideways markets where crossovers work better`);
    }

    console.log();

    console.log('📚 Learning Workflow:');
    console.log('   1. ✅ Backtest multiple parameters (DONE)');
    console.log('   2. ⏭️  Test on different time periods (Next step)');
    console.log('   3. ⏭️  Test on different symbols (Next step)');
    console.log('   4. ⏭️  Add risk management rules');
    console.log('   5. ⏭️  Forward test (paper trading)');
    console.log('   6. ⏭️  Analyze live performance');
    console.log('   7. ⏭️  Refine based on results');

    console.log();

    console.log('=== Analysis Complete ===');
    console.log('\nNext steps:');
    console.log('1. Run this script on different date ranges');
    console.log('2. Test the best parameters on other stocks');
    console.log('3. See examples/05-neural-network-training.js for ML approach');
    console.log('4. Try examples/06-strategy-optimization.js for advanced optimization');
}

// Run the analysis
if (require.main === module) {
    learnFromBacktests().catch(error => {
        console.error('Fatal error:', error);
        process.exit(1);
    });
}

module.exports = { learnFromBacktests, runBacktest };
