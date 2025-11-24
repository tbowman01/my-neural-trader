/**
 * Basic Alpaca Paper Trading Example
 *
 * This example demonstrates:
 * - Connecting to Alpaca paper trading account
 * - Checking account balance
 * - Getting current positions
 * - Placing a simple market order
 * - Checking order status
 *
 * Prerequisites:
 * 1. Sign up at https://alpaca.markets (free)
 * 2. Get paper trading API keys
 * 3. Update .env file with your keys
 */

require('dotenv').config();
const { BrokerClient } = require('neural-trader');

async function basicTradingExample() {
    console.log('=== Neural Trader: Basic Alpaca Trading Example ===\n');

    // Step 1: Configure broker client
    const broker = new BrokerClient({
        brokerType: 'alpaca',
        apiKey: process.env.ALPACA_API_KEY,
        apiSecret: process.env.ALPACA_API_SECRET,
        baseUrl: process.env.ALPACA_BASE_URL || 'https://paper-api.alpaca.markets',
        paperTrading: true
    });

    try {
        // Step 2: Connect to broker
        console.log('📡 Connecting to Alpaca paper trading...');
        const connected = await broker.connect();

        if (!connected) {
            throw new Error('Failed to connect to Alpaca');
        }
        console.log('✅ Connected to Alpaca\n');

        // Step 3: Get account balance
        console.log('💰 Fetching account balance...');
        const balance = await broker.getAccountBalance();
        console.log('Account Balance:');
        console.log(`  Cash:         $${balance.cash.toFixed(2)}`);
        console.log(`  Equity:       $${balance.equity.toFixed(2)}`);
        console.log(`  Buying Power: $${balance.buyingPower.toFixed(2)}`);
        console.log(`  Currency:     ${balance.currency}\n`);

        // Step 4: Check current positions
        console.log('📊 Checking current positions...');
        const positions = await broker.getPositions();

        if (positions.length === 0) {
            console.log('No open positions\n');
        } else {
            console.log(`You have ${positions.length} open position(s):\n`);
            positions.forEach((pos, i) => {
                console.log(`Position ${i + 1}:`);
                console.log(`  Symbol:         ${pos.symbol}`);
                console.log(`  Quantity:       ${pos.quantity}`);
                console.log(`  Avg Entry:      $${pos.avgEntryPrice}`);
                console.log(`  Current Price:  $${pos.currentPrice}`);
                console.log(`  Market Value:   $${pos.marketValue}`);
                console.log(`  Unrealized P&L: $${pos.unrealizedPnl}`);
                console.log(`  Side:           ${pos.side}\n`);
            });
        }

        // Step 5: Check open orders
        console.log('📋 Checking open orders...');
        const orders = await broker.listOrders();

        if (orders.length === 0) {
            console.log('No open orders\n');
        } else {
            console.log(`You have ${orders.length} open order(s):\n`);
            orders.forEach((order, i) => {
                console.log(`Order ${i + 1}:`);
                console.log(`  Order ID: ${order.orderId}`);
                console.log(`  Status:   ${order.status}`);
                console.log(`  Filled:   ${order.filledQuantity} shares\n`);
            });
        }

        // Step 6: Place a small market order (example - commented out by default)
        console.log('📝 Example: Place a market order (COMMENTED OUT)');
        console.log('To actually place an order, uncomment the code below:\n');
        console.log('const order = {');
        console.log('  symbol: "AAPL",');
        console.log('  side: "buy",');
        console.log('  orderType: "market",');
        console.log('  quantity: 1,');
        console.log('  timeInForce: "day"');
        console.log('};\n');
        console.log('const result = await broker.placeOrder(order);');
        console.log('console.log("Order placed:", result.orderId);\n');

        /*
        // UNCOMMENT TO PLACE ACTUAL ORDER
        console.log('🛒 Placing market order for 1 share of AAPL...');
        const order = {
            symbol: 'AAPL',
            side: 'buy',
            orderType: 'market',
            quantity: 1,
            timeInForce: 'day'
        };

        const result = await broker.placeOrder(order);
        console.log('✅ Order placed successfully!');
        console.log(`  Order ID:        ${result.orderId}`);
        console.log(`  Broker Order ID: ${result.brokerOrderId}`);
        console.log(`  Status:          ${result.status}`);
        console.log(`  Timestamp:       ${result.timestamp}\n`);

        // Wait a moment then check order status
        console.log('⏳ Waiting 2 seconds to check order status...');
        await new Promise(resolve => setTimeout(resolve, 2000));

        const orderStatus = await broker.getOrderStatus(result.orderId);
        console.log('📊 Order Status:');
        console.log(`  Status:          ${orderStatus.status}`);
        console.log(`  Filled Quantity: ${orderStatus.filledQuantity}`);
        if (orderStatus.filledPrice) {
            console.log(`  Filled Price:    $${orderStatus.filledPrice.toFixed(2)}`);
        }
        console.log();
        */

        // Step 7: Disconnect
        console.log('👋 Disconnecting from Alpaca...');
        await broker.disconnect();
        console.log('✅ Disconnected\n');

        console.log('=== Example Complete ===');
        console.log('Next steps:');
        console.log('1. Review the code and understand each step');
        console.log('2. Uncomment the order placement code to try trading');
        console.log('3. Check your Alpaca dashboard to see the results');
        console.log('4. Try examples/02-strategy-backtest.js for backtesting');

    } catch (error) {
        console.error('❌ Error:', error.message);

        if (error.message.includes('PKXXXXXXXXXXXXXX')) {
            console.error('\n⚠️  Please update your .env file with real Alpaca API keys!');
            console.error('Get free keys at: https://alpaca.markets\n');
        }

        process.exit(1);
    }
}

// Run the example
if (require.main === module) {
    basicTradingExample().catch(error => {
        console.error('Fatal error:', error);
        process.exit(1);
    });
}

module.exports = { basicTradingExample };
