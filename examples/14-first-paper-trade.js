/**
 * Your First Paper Trade with Alpaca
 *
 * This script places a real paper trade using your Alpaca account.
 * It demonstrates buying stock based on trend analysis.
 */

require('dotenv').config();
const { BrokerClient } = require('neural-trader');

async function placeFirstPaperTrade() {
    console.log('=== Your First Paper Trade ===\n');

    const broker = new BrokerClient({
        brokerType: 'alpaca',
        apiKey: process.env.ALPACA_API_KEY,
        apiSecret: process.env.ALPACA_API_SECRET,
        baseUrl: process.env.ALPACA_BASE_URL || 'https://paper-api.alpaca.markets',
        paperTrading: true
    });

    try {
        await broker.connect();
        console.log('✅ Connected to Alpaca Paper Trading\n');

        // Get account info
        const balance = await broker.getAccountBalance();
        console.log(`Available Buying Power: $${balance.buyingPower.toLocaleString()}\n`);

        // Choose a symbol to trade
        const symbol = 'AAPL';
        console.log(`📊 Analyzing ${symbol}...\n`);

        console.log('Trade Setup:');
        console.log('------------');
        console.log(`Symbol: ${symbol}`);
        console.log('Strategy: Buy small position to learn the platform');
        console.log('Position Size: 1 share (~$180 at current prices)');
        console.log('Risk: Paper money only - no real risk!\n');

        // Check if we already have a position
        const positions = await broker.getPositions();
        const existingPosition = positions?.find(p => p.symbol === symbol);

        if (existingPosition) {
            console.log(`⚠️  You already have ${existingPosition.quantity} shares of ${symbol}`);
            console.log(`   Entry: $${existingPosition.avgEntryPrice}`);
            console.log(`   P/L: $${existingPosition.unrealizedPnl}\n`);

            console.log('Would you like to:');
            console.log('1. Add to position (run with --add)');
            console.log('2. Close position (run with --close)');
            console.log('3. Do nothing (default)\n');

            const args = process.argv.slice(2);

            if (args.includes('--close')) {
                console.log('Closing position...\n');
                const closeOrder = await broker.placeOrder({
                    symbol: symbol,
                    quantity: parseInt(existingPosition.quantity),
                    side: 'sell',
                    orderType: 'market',
                    timeInForce: 'day'
                });
                console.log('✅ Sell order submitted!');
                console.log(`   Order ID: ${closeOrder.orderId}`);
                console.log(`   Status: ${closeOrder.status}`);
            } else if (args.includes('--add')) {
                console.log('Adding to position...');
            } else {
                console.log('No action taken. Use --close or --add flags to modify position.');
                await broker.disconnect();
                return;
            }
        }

        // Place a buy order (if no position or --add flag)
        if (!existingPosition || process.argv.includes('--add')) {
            console.log('📈 Placing BUY order for 1 share...\n');

            const order = await broker.placeOrder({
                symbol: symbol,
                quantity: 1,
                side: 'buy',
                orderType: 'market',
                timeInForce: 'day'
            });

            console.log('✅ Order Submitted Successfully!\n');
            console.log('Order Details:');
            console.log(`  Order ID:     ${order.orderId}`);
            console.log(`  Status:       ${order.status}`);
            console.log(`  Timestamp:    ${order.timestamp}`);
            console.log('');

            // Wait a moment for fill
            console.log('Waiting for fill...');
            await new Promise(r => setTimeout(r, 2000));

            // Check order status
            const orderStatus = await broker.getOrderStatus(order.orderId);
            console.log(`\nOrder Status: ${orderStatus.status}`);
            console.log(`Filled Quantity: ${orderStatus.filledQuantity}`);
            if (orderStatus.filledPrice) {
                console.log(`Filled Price: $${orderStatus.filledPrice.toFixed(2)}`);
            }
        }

        // Show updated positions
        console.log('\n--- Current Portfolio ---\n');

        const updatedPositions = await broker.getPositions();
        if (updatedPositions && updatedPositions.length > 0) {
            console.log('Positions:');
            updatedPositions.forEach(p => {
                console.log(`  ${p.symbol}:`);
                console.log(`    Shares: ${p.quantity}`);
                console.log(`    Avg Cost: $${p.avgEntryPrice}`);
                console.log(`    Current: $${p.currentPrice}`);
                console.log(`    Market Value: $${p.marketValue}`);
                console.log(`    P/L: $${p.unrealizedPnl}`);
                console.log('');
            });
        } else {
            console.log('No positions.\n');
        }

        // Updated account
        const updatedBalance = await broker.getAccountBalance();
        console.log('Account Summary:');
        console.log(`  Cash: $${updatedBalance.cash.toLocaleString()}`);
        console.log(`  Equity: $${updatedBalance.equity.toLocaleString()}`);

        await broker.disconnect();

        console.log('\n=== Trade Complete ===\n');
        console.log('What you learned:');
        console.log('1. How to connect to Alpaca');
        console.log('2. How to submit a market order');
        console.log('3. How to check positions and P/L');
        console.log('');
        console.log('Next steps:');
        console.log('1. Monitor your position throughout the day');
        console.log('2. Try: node examples/14-first-paper-trade.js --close');
        console.log('3. Try limit orders with examples/15-limit-orders.js');

    } catch (error) {
        console.error('Error:', error.message);

        if (error.message.includes('market is closed')) {
            console.log('\n💡 Market is currently closed!');
            console.log('   US Stock Market Hours: 9:30 AM - 4:00 PM ET');
            console.log('   Try again during market hours, or use a limit order.');
        }
    }
}

placeFirstPaperTrade().catch(console.error);
