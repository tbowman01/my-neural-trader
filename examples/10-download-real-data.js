/**
 * Download Real Historical Data
 *
 * This script actually downloads years of historical data from Alpaca
 * and saves it for use in your backtests.
 *
 * Run this once, then use the saved data in all your backtesting examples!
 */

require('dotenv').config();
const { MarketDataProvider } = require('neural-trader');
const fs = require('fs');
const path = require('path');

async function downloadHistoricalData() {
    console.log('=== Downloading Historical Data from Alpaca ===\n');

    // Create data provider
    const dataProvider = new MarketDataProvider({
        provider: 'alpaca',
        apiKey: process.env.ALPACA_API_KEY,
        apiSecret: process.env.ALPACA_API_SECRET,
        websocketEnabled: false
    });

    try {
        await dataProvider.connect();
        console.log('✅ Connected to Alpaca\n');

        // Define what to download
        const downloads = [
            {
                symbol: 'AAPL',
                years: 5,
                filename: 'AAPL-5-years.json'
            },
            {
                symbol: 'AAPL',
                years: 2,
                filename: 'AAPL-2-years.json'
            },
            {
                symbol: 'MSFT',
                years: 2,
                filename: 'MSFT-2-years.json'
            },
            {
                symbol: 'GOOGL',
                years: 2,
                filename: 'GOOGL-2-years.json'
            },
            {
                symbol: 'SPY',
                years: 5,
                filename: 'SPY-5-years.json'
            }
        ];

        const dataDir = path.join(__dirname, '../historical-data');
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
        }

        // Download each dataset
        for (const config of downloads) {
            console.log(`📊 Downloading ${config.symbol} (${config.years} years)...`);

            // Calculate dates
            const endDate = new Date('2024-11-01'); // Use a recent past date
            const startDate = new Date(endDate);
            startDate.setFullYear(endDate.getFullYear() - config.years);

            const start = `${startDate.toISOString().split('T')[0]}T00:00:00Z`;
            const end = `${endDate.toISOString().split('T')[0]}T23:59:59Z`;

            console.log(`   Period: ${start.split('T')[0]} to ${end.split('T')[0]}`);

            try {
                const bars = await dataProvider.fetchBars(
                    config.symbol,
                    start,
                    end,
                    '1Day'
                );

                if (bars && bars.length > 0) {
                    // Convert to simpler format
                    const data = bars.map(bar => ({
                        date: bar.timestamp.split('T')[0],
                        open: bar.open,
                        high: bar.high,
                        low: bar.low,
                        close: bar.close,
                        volume: bar.volume
                    }));

                    // Save to file
                    const filePath = path.join(dataDir, config.filename);
                    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));

                    // Calculate stats
                    const prices = data.map(d => d.close);
                    const totalReturn = ((prices[prices.length - 1] - prices[0]) / prices[0]) * 100;

                    console.log(`   ✅ Downloaded ${bars.length} bars`);
                    console.log(`   💾 Saved to: ${config.filename}`);
                    console.log(`   📈 Buy & Hold Return: ${totalReturn.toFixed(2)}%\n`);

                } else {
                    console.log(`   ⚠️  No data received\n`);
                }

                // Small delay to avoid rate limits
                await new Promise(resolve => setTimeout(resolve, 500));

            } catch (error) {
                console.error(`   ❌ Error: ${error.message}\n`);
            }
        }

        await dataProvider.disconnect();
        console.log('👋 Disconnected from Alpaca\n');

        // Summary
        console.log('=== Download Complete ===\n');

        console.log('📁 Files saved in: historical-data/\n');

        console.log('Now you can use this data in your backtests:');
        console.log('```javascript');
        console.log('const fs = require("fs");');
        console.log('const data = JSON.parse(fs.readFileSync("historical-data/AAPL-5-years.json"));');
        console.log();
        console.log('// data is an array of {date, close, volume} objects');
        console.log('console.log(`Loaded ${data.length} days of data`);');
        console.log();
        console.log('// Use in your backtest');
        console.log('const result = runBacktest(data, 5, 20);');
        console.log('```\n');

    } catch (error) {
        console.error('❌ Fatal error:', error.message);
        console.error('\nMake sure your .env file has valid Alpaca API keys!');
    }
}

// Run the download
if (require.main === module) {
    downloadHistoricalData().catch(error => {
        console.error('Error:', error);
        process.exit(1);
    });
}

module.exports = { downloadHistoricalData };
