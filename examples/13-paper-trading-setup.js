/**
 * Paper Trading Setup - Alpaca + thinkorswim
 *
 * This script demonstrates paper trading with your Alpaca account
 * and provides a guide for setting up thinkorswim.
 */

require('dotenv').config();
const { BrokerClient } = require('neural-trader');

async function setupPaperTrading() {
    console.log('=== Paper Trading Setup Guide ===\n');

    // ============================================
    // PART 1: ALPACA PAPER TRADING (You have this!)
    // ============================================

    console.log('📊 PART 1: ALPACA PAPER TRADING\n');
    console.log('You already have Alpaca paper trading configured!\n');

    try {
        const broker = new BrokerClient({
            broker: 'alpaca',
            apiKey: process.env.ALPACA_API_KEY,
            apiSecret: process.env.ALPACA_API_SECRET,
            paper: true
        });

        await broker.connect();
        const account = await broker.getAccount();

        console.log('✅ Connected to Alpaca Paper Trading!\n');
        console.log('Account Summary:');
        console.log(`  Cash:           $${parseFloat(account.cash).toLocaleString()}`);
        console.log(`  Buying Power:   $${parseFloat(account.buying_power).toLocaleString()}`);
        console.log(`  Portfolio:      $${parseFloat(account.portfolio_value).toLocaleString()}`);
        console.log(`  Day Trades:     ${account.daytrade_count || 0}/3 this week`);
        console.log('');

        // Check current positions
        const positions = await broker.getPositions();
        if (positions && positions.length > 0) {
            console.log('Current Positions:');
            positions.forEach(p => {
                const pl = parseFloat(p.unrealized_pl);
                const plPercent = parseFloat(p.unrealized_plpc) * 100;
                console.log(`  ${p.symbol}: ${p.qty} shares @ $${parseFloat(p.avg_entry_price).toFixed(2)} (${pl >= 0 ? '+' : ''}$${pl.toFixed(2)} / ${plPercent.toFixed(2)}%)`);
            });
        } else {
            console.log('No current positions - ready to trade!\n');
        }

        await broker.disconnect();

    } catch (error) {
        console.log(`Connection issue: ${error.message}`);
        console.log('Make sure your .env file has valid Alpaca API keys\n');
    }

    // ============================================
    // PART 2: THINKORSWIM SETUP
    // ============================================

    console.log('\n📈 PART 2: THINKORSWIM PAPER TRADING SETUP\n');

    console.log('Step 1: Create TD Ameritrade Account (FREE)');
    console.log('-------------------------------------------');
    console.log('1. Go to: tdameritrade.com');
    console.log('2. Click "Open New Account"');
    console.log('3. Select "Individual Brokerage Account"');
    console.log('4. Complete application (no deposit required for paper trading!)');
    console.log('5. Wait for approval (usually same day)\n');

    console.log('Step 2: Download thinkorswim');
    console.log('---------------------------');
    console.log('1. Go to: tdameritrade.com/tools-and-platforms/thinkorswim.html');
    console.log('2. Download for your OS (Windows/Mac)');
    console.log('3. Install the application\n');

    console.log('Step 3: Login to Paper Trading');
    console.log('------------------------------');
    console.log('1. Open thinkorswim');
    console.log('2. At login screen, click "paperMoney" (not "Live Trading")');
    console.log('3. Login with your TD Ameritrade credentials');
    console.log('4. You start with $100,000 virtual cash!\n');

    console.log('Step 4: Enable Options Trading');
    console.log('------------------------------');
    console.log('1. In thinkorswim, go to: Setup > Application Settings');
    console.log('2. Enable options trading features');
    console.log('3. Paper account has full options capabilities\n');

    // ============================================
    // PART 3: YOUR FIRST PAPER TRADES
    // ============================================

    console.log('\n🎯 PART 3: YOUR FIRST PAPER TRADES\n');

    console.log('ALPACA - Stock Trade Example:');
    console.log('-----------------------------');
    console.log('Run this command to place your first paper trade:\n');
    console.log('  node examples/14-first-paper-trade.js\n');

    console.log('THINKORSWIM - Options Trade Example:');
    console.log('------------------------------------');
    console.log('1. In thinkorswim, type AAPL in the symbol box');
    console.log('2. Click "Trade" tab at top');
    console.log('3. Click "All Products" -> "Option Chain"');
    console.log('4. Find a call option 30 days out, slightly OTM');
    console.log('5. Right-click -> "Buy" -> "Single"');
    console.log('6. Set quantity to 1, click "Confirm and Send"');
    console.log('7. Review the order, click "Send"\n');

    // ============================================
    // PART 4: PRACTICE PLAN
    // ============================================

    console.log('\n📅 PART 4: 4-WEEK PRACTICE PLAN\n');

    console.log('WEEK 1: Basic Stock Trades (Alpaca)');
    console.log('-----------------------------------');
    console.log('Day 1-2: Place 3-5 market orders (buy AAPL, MSFT, SPY)');
    console.log('Day 3-4: Place limit orders (set price below market)');
    console.log('Day 5-7: Set stop-loss orders, monitor positions');
    console.log('Goal: Understand order types and execution\n');

    console.log('WEEK 2: Trend Following (Alpaca)');
    console.log('--------------------------------');
    console.log('Day 1-2: Identify stocks in uptrends (use TradingView)');
    console.log('Day 3-4: Buy 2-3 stocks in uptrends');
    console.log('Day 5-7: Set trailing stops, let winners run');
    console.log('Goal: Practice "buy the dip in uptrend" strategy\n');

    console.log('WEEK 3: Options Basics (thinkorswim)');
    console.log('------------------------------------');
    console.log('Day 1-2: Buy 1 call on AAPL (30 days out, ATM)');
    console.log('Day 3-4: Buy 1 put on SPY as "insurance"');
    console.log('Day 5-7: Watch how options move vs stock');
    console.log('Goal: Understand calls, puts, and time decay\n');

    console.log('WEEK 4: Options Strategies (thinkorswim)');
    console.log('----------------------------------------');
    console.log('Day 1-2: Try a bull call spread');
    console.log('Day 3-4: Try a covered call (if you own shares)');
    console.log('Day 5-7: Review all trades, calculate P&L');
    console.log('Goal: Experience defined-risk option strategies\n');

    // ============================================
    // PART 5: TRACKING YOUR PROGRESS
    // ============================================

    console.log('\n📊 PART 5: TRACK YOUR TRADES\n');

    console.log('Create a simple trading journal:');
    console.log('');
    console.log('| Date | Symbol | Type | Entry | Exit | P/L | Notes |');
    console.log('|------|--------|------|-------|------|-----|-------|');
    console.log('| 11/20| AAPL   | Long | $180  | $185 | +5% | Uptrend buy |');
    console.log('| 11/21| SPY Call| Long| $3.00 | $4.50|+50% | Bull signal |');
    console.log('');
    console.log('Track these metrics weekly:');
    console.log('  - Win Rate (aim for >50%)');
    console.log('  - Average Win vs Average Loss (aim for 2:1)');
    console.log('  - Biggest Winner / Biggest Loser');
    console.log('  - Lessons learned\n');

    console.log('=== Setup Complete ===\n');
    console.log('Next Steps:');
    console.log('1. Run: node examples/14-first-paper-trade.js');
    console.log('2. Download thinkorswim from tdameritrade.com');
    console.log('3. Start Week 1 of your practice plan!');
}

setupPaperTrading().catch(console.error);
