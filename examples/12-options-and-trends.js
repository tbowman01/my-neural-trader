/**
 * Understanding Options & Uptrend Trading
 *
 * This example teaches:
 * 1. How to identify and trade uptrends
 * 2. Options basics and strategies
 * 3. How to combine both for smarter trading
 */

const fs = require('fs');
const path = require('path');

// Load real data
const dataPath = path.join(__dirname, '../historical-data/AAPL-5-years.json');
const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

console.log('=== Options & Uptrend Trading Education ===\n');

// ============================================
// PART 1: UNDERSTANDING UPTRENDS
// ============================================

console.log('📈 PART 1: IDENTIFYING UPTRENDS\n');

/**
 * An uptrend is defined by:
 * - Higher highs and higher lows
 * - Price above key moving averages (20, 50, 200 SMA)
 * - Positive slope of moving averages
 */

function calculateSMA(prices, period) {
    const result = [];
    for (let i = 0; i < prices.length; i++) {
        if (i < period - 1) {
            result.push(null);
        } else {
            const slice = prices.slice(i - period + 1, i + 1);
            result.push(slice.reduce((a, b) => a + b, 0) / period);
        }
    }
    return result;
}

function identifyTrend(prices, index, sma20, sma50, sma200) {
    if (index < 200) return 'insufficient_data';

    const price = prices[index];
    const s20 = sma20[index];
    const s50 = sma50[index];
    const s200 = sma200[index];

    // Strong uptrend: Price > SMA20 > SMA50 > SMA200
    if (price > s20 && s20 > s50 && s50 > s200) {
        return 'strong_uptrend';
    }
    // Weak uptrend: Price > SMA50 > SMA200
    else if (price > s50 && s50 > s200) {
        return 'weak_uptrend';
    }
    // Strong downtrend: Price < SMA20 < SMA50 < SMA200
    else if (price < s20 && s20 < s50 && s50 < s200) {
        return 'strong_downtrend';
    }
    // Weak downtrend
    else if (price < s50 && s50 < s200) {
        return 'weak_downtrend';
    }
    return 'sideways';
}

// Calculate indicators
const prices = data.map(d => d.close);
const sma20 = calculateSMA(prices, 20);
const sma50 = calculateSMA(prices, 50);
const sma200 = calculateSMA(prices, 200);

// Analyze trend distribution
const trendCounts = {
    strong_uptrend: 0,
    weak_uptrend: 0,
    sideways: 0,
    weak_downtrend: 0,
    strong_downtrend: 0
};

for (let i = 200; i < prices.length; i++) {
    const trend = identifyTrend(prices, i, sma20, sma50, sma200);
    trendCounts[trend]++;
}

const totalDays = prices.length - 200;
console.log('AAPL Trend Distribution (5 years):');
console.log(`  Strong Uptrend:   ${(trendCounts.strong_uptrend / totalDays * 100).toFixed(1)}% (${trendCounts.strong_uptrend} days)`);
console.log(`  Weak Uptrend:     ${(trendCounts.weak_uptrend / totalDays * 100).toFixed(1)}% (${trendCounts.weak_uptrend} days)`);
console.log(`  Sideways:         ${(trendCounts.sideways / totalDays * 100).toFixed(1)}% (${trendCounts.sideways} days)`);
console.log(`  Weak Downtrend:   ${(trendCounts.weak_downtrend / totalDays * 100).toFixed(1)}% (${trendCounts.weak_downtrend} days)`);
console.log(`  Strong Downtrend: ${(trendCounts.strong_downtrend / totalDays * 100).toFixed(1)}% (${trendCounts.strong_downtrend} days)`);

// ============================================
// PART 2: UPTREND TRADING STRATEGIES
// ============================================

console.log('\n📊 PART 2: UPTREND TRADING STRATEGIES\n');

console.log('Strategy 1: "Buy the Dip in Uptrends"');
console.log('--------------------------------------');
console.log('Rule: Only buy when:');
console.log('  1. Overall trend is UP (price > SMA200)');
console.log('  2. Price pulls back to SMA20 or SMA50');
console.log('  3. RSI is oversold (< 40)');
console.log('');

function calculateRSI(prices, period = 14) {
    const rsi = new Array(prices.length).fill(null);

    for (let i = period; i < prices.length; i++) {
        let gains = 0, losses = 0;
        for (let j = i - period + 1; j <= i; j++) {
            const change = prices[j] - prices[j - 1];
            if (change > 0) gains += change;
            else losses -= change;
        }
        const avgGain = gains / period;
        const avgLoss = losses / period;
        const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
        rsi[i] = 100 - (100 / (1 + rs));
    }
    return rsi;
}

const rsi = calculateRSI(prices);

// Test "Buy the Dip" strategy
let buyTheDipTrades = [];
let inPosition = false;
let entryPrice = 0;
let entryDate = '';

for (let i = 200; i < prices.length; i++) {
    const price = prices[i];
    const trend = identifyTrend(prices, i, sma20, sma50, sma200);
    const currentRsi = rsi[i];

    // Entry: Uptrend + pullback to SMA20 + oversold RSI
    if (!inPosition &&
        (trend === 'strong_uptrend' || trend === 'weak_uptrend') &&
        price <= sma20[i] * 1.02 && // Within 2% of SMA20
        currentRsi < 40) {
        inPosition = true;
        entryPrice = price;
        entryDate = data[i].date;
    }

    // Exit: Price rises 5% OR RSI > 70 OR trend breaks
    if (inPosition) {
        const gain = (price - entryPrice) / entryPrice;
        if (gain >= 0.05 || currentRsi > 70 || trend.includes('downtrend')) {
            buyTheDipTrades.push({
                entry: entryDate,
                exit: data[i].date,
                entryPrice: entryPrice.toFixed(2),
                exitPrice: price.toFixed(2),
                return: (gain * 100).toFixed(2) + '%'
            });
            inPosition = false;
        }
    }
}

console.log(`"Buy the Dip" Results: ${buyTheDipTrades.length} trades\n`);
if (buyTheDipTrades.length > 0) {
    const returns = buyTheDipTrades.map(t => parseFloat(t.return));
    const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
    const winners = returns.filter(r => r > 0).length;
    console.log(`  Avg Return: ${avgReturn.toFixed(2)}%`);
    console.log(`  Win Rate: ${(winners / buyTheDipTrades.length * 100).toFixed(1)}%`);
    console.log(`  Sample trades:`);
    buyTheDipTrades.slice(0, 3).forEach(t => {
        console.log(`    ${t.entry}: Buy $${t.entryPrice} -> ${t.exit}: Sell $${t.exitPrice} (${t.return})`);
    });
}

// ============================================
// PART 3: OPTIONS BASICS
// ============================================

console.log('\n\n📚 PART 3: OPTIONS BASICS\n');

console.log('What are Options?');
console.log('-----------------');
console.log('Options give you the RIGHT (not obligation) to buy/sell stock at a set price.\n');

console.log('Two Types:');
console.log('  CALL: Right to BUY at strike price (bullish bet)');
console.log('  PUT:  Right to SELL at strike price (bearish bet/insurance)\n');

console.log('Key Terms:');
console.log('  Strike Price: The price you can buy/sell at');
console.log('  Premium: What you pay for the option');
console.log('  Expiration: When the option expires');
console.log('  ITM (In The Money): Option has value');
console.log('  OTM (Out of The Money): Option has no intrinsic value');
console.log('  ATM (At The Money): Strike = current price\n');

// ============================================
// PART 4: OPTIONS STRATEGIES FOR UPTRENDS
// ============================================

console.log('📈 PART 4: OPTIONS STRATEGIES FOR UPTRENDS\n');

console.log('Strategy 1: LONG CALLS (Bullish)');
console.log('--------------------------------');
console.log('When to use: You expect the stock to go UP');
console.log('Max Loss: Premium paid (limited)');
console.log('Max Gain: Unlimited');
console.log('');
console.log('Example:');
console.log('  AAPL at $180, buy $185 call for $3.00');
console.log('  If AAPL rises to $200:');
console.log('    Profit = ($200 - $185 - $3) x 100 = $1,200');
console.log('    Return on investment: 400%!');
console.log('  If AAPL stays below $185:');
console.log('    Loss = $3 x 100 = $300 (max loss)');
console.log('');

console.log('Strategy 2: BULL CALL SPREAD (Moderate Bullish)');
console.log('-----------------------------------------------');
console.log('When to use: Expect moderate upside, lower cost');
console.log('How: Buy lower strike call, sell higher strike call');
console.log('');
console.log('Example:');
console.log('  AAPL at $180');
console.log('  Buy $180 call for $5.00');
console.log('  Sell $190 call for $2.00');
console.log('  Net cost: $3.00');
console.log('  Max profit: ($190 - $180 - $3) x 100 = $700');
console.log('  Max loss: $300 (net premium)');
console.log('');

console.log('Strategy 3: COVERED CALLS (Own Stock + Sell Calls)');
console.log('--------------------------------------------------');
console.log('When to use: Own stock, expect sideways/slight up');
console.log('How: Own 100 shares, sell 1 call above current price');
console.log('');
console.log('Example:');
console.log('  Own 100 AAPL at $180');
console.log('  Sell $190 call for $2.00');
console.log('  Collect $200 premium immediately');
console.log('  If AAPL > $190: Shares called away, profit = $10 + $2 = $12/share');
console.log('  If AAPL < $190: Keep shares + $200 premium');
console.log('');

console.log('Strategy 4: CASH-SECURED PUTS (Want to Buy Stock Cheaper)');
console.log('---------------------------------------------------------');
console.log('When to use: Want to buy stock at lower price');
console.log('How: Sell put below current price, keep cash to buy');
console.log('');
console.log('Example:');
console.log('  AAPL at $180, you want to buy at $170');
console.log('  Sell $170 put for $2.00');
console.log('  If AAPL stays > $170: Keep $200 premium, no shares');
console.log('  If AAPL drops < $170: Buy 100 shares at $170 (effective cost $168)');
console.log('');

// ============================================
// PART 5: COMBINING TRENDS + OPTIONS
// ============================================

console.log('\n🎯 PART 5: SMART OPTIONS IN UPTRENDS\n');

console.log('THE KEY INSIGHT:');
console.log('================');
console.log('In UPTRENDS: Options amplify gains (leverage)');
console.log('In DOWNTRENDS: Options provide protection (insurance)');
console.log('');

console.log('Uptrend Options Playbook:');
console.log('');
console.log('1. STRONG UPTREND (Price > SMA20 > SMA50 > SMA200):');
console.log('   - Buy slightly OTM calls (2-3% above price)');
console.log('   - 30-45 days to expiration');
console.log('   - Example: Stock at $100, buy $103 call');
console.log('');
console.log('2. PULLBACK IN UPTREND (Price dips to SMA50):');
console.log('   - Buy ATM calls (at current price)');
console.log('   - 45-60 days to expiration');
console.log('   - This is often the best entry!');
console.log('');
console.log('3. SIDEWAYS IN UPTREND (Consolidating):');
console.log('   - Sell covered calls if you own shares');
console.log('   - Or sell cash-secured puts to buy cheaper');
console.log('');

// ============================================
// PART 6: SIMULATED OPTIONS BACKTEST
// ============================================

console.log('\n📊 PART 6: OPTIONS VS STOCK COMPARISON\n');

// Simple simulation: Compare buying stock vs buying calls in uptrends
let stockTrades = [];
let optionsTrades = [];

for (let i = 220; i < prices.length - 30; i++) {
    const trend = identifyTrend(prices, i, sma20, sma50, sma200);
    const currentRsi = rsi[i];

    // Entry signal: Pullback in uptrend
    if ((trend === 'strong_uptrend' || trend === 'weak_uptrend') &&
        prices[i] <= sma20[i] * 1.01 &&
        currentRsi < 45) {

        const entryPrice = prices[i];
        const exitPrice = prices[i + 20]; // Exit after 20 days
        const stockReturn = ((exitPrice - entryPrice) / entryPrice) * 100;

        // Simulate call option (simplified)
        // Assume: Buy ATM call for 5% of stock price, 30 days expiration
        const callCost = entryPrice * 0.05;
        const intrinsicValue = Math.max(0, exitPrice - entryPrice);
        const callReturn = ((intrinsicValue - callCost) / callCost) * 100;

        stockTrades.push(stockReturn);
        optionsTrades.push(callReturn);

        i += 25; // Skip ahead to avoid overlapping trades
    }
}

if (stockTrades.length > 0) {
    const avgStock = stockTrades.reduce((a, b) => a + b, 0) / stockTrades.length;
    const avgOptions = optionsTrades.reduce((a, b) => a + b, 0) / optionsTrades.length;
    const stockWins = stockTrades.filter(r => r > 0).length;
    const optionsWins = optionsTrades.filter(r => r > 0).length;

    console.log(`"Buy Pullback in Uptrend" - ${stockTrades.length} trades:\n`);
    console.log('                    Stock      Options (ATM Call)');
    console.log('                    -----      -----------------');
    console.log(`  Avg Return:       ${avgStock.toFixed(1)}%       ${avgOptions.toFixed(1)}%`);
    console.log(`  Win Rate:         ${(stockWins/stockTrades.length*100).toFixed(0)}%         ${(optionsWins/optionsTrades.length*100).toFixed(0)}%`);
    console.log(`  Best Trade:       ${Math.max(...stockTrades).toFixed(1)}%       ${Math.max(...optionsTrades).toFixed(1)}%`);
    console.log(`  Worst Trade:      ${Math.min(...stockTrades).toFixed(1)}%      ${Math.min(...optionsTrades).toFixed(1)}%`);
    console.log('');
    console.log('Key Takeaway:');
    console.log('  - Options amplify gains AND losses');
    console.log('  - Higher win rate needed to be profitable with options');
    console.log('  - Best used when you have high conviction');
}

// ============================================
// PART 7: LEARNING RESOURCES
// ============================================

console.log('\n\n📖 PART 7: HOW TO GET SMARTER\n');

console.log('FREE Resources:');
console.log('---------------');
console.log('1. Options Basics:');
console.log('   - tastytrade.com/learn (best free options education)');
console.log('   - optionseducation.org (OIC official site)');
console.log('   - YouTube: "Options Alpha" channel');
console.log('');
console.log('2. Technical Analysis:');
console.log('   - stockcharts.com/school (ChartSchool)');
console.log('   - investopedia.com/technical-analysis');
console.log('');
console.log('3. Paper Trading (Practice FREE):');
console.log('   - thinkorswim by TD Ameritrade (best paper trading)');
console.log('   - tradingview.com (charting + paper trading)');
console.log('   - Your Alpaca paper account!');
console.log('');

console.log('Books (Highly Recommended):');
console.log('---------------------------');
console.log('1. "Options as a Strategic Investment" - McMillan (bible of options)');
console.log('2. "Trading in the Zone" - Mark Douglas (psychology)');
console.log('3. "Technical Analysis of the Financial Markets" - Murphy');
console.log('');

console.log('Practice Path:');
console.log('--------------');
console.log('Week 1-2: Learn call/put basics, practice on paper');
console.log('Week 3-4: Study spreads (bull call, bear put)');
console.log('Week 5-6: Learn Greeks (delta, theta, vega)');
console.log('Week 7-8: Practice covered calls on paper');
console.log('Month 3+: Small real trades ($100-500 max risk)');
console.log('');

console.log('Golden Rules:');
console.log('-------------');
console.log('1. NEVER risk more than 1-2% of account on one trade');
console.log('2. Start with defined-risk strategies (spreads)');
console.log('3. Trade WITH the trend, not against it');
console.log('4. Paper trade for 3+ months before real money');
console.log('5. Options decay over time - be aware of theta');
console.log('');

console.log('=== Education Complete ===\n');
console.log('Next: Run this script and study the output!');
console.log('Then: Practice identifying trends on TradingView');
console.log('Then: Paper trade options on thinkorswim');
