/**
 * Fetching Historical Data for Backtesting
 *
 * This example shows you multiple ways to get historical stock data:
 * 1. Using Alpaca API (with your existing keys) - FREE, 5+ years
 * 2. Using neural-trader's fetchMarketData - Built-in
 * 3. Manual CSV files - For any custom data
 * 4. Multiple symbols at once - Portfolio testing
 *
 * More data = Better backtests = More reliable models!
 */

require('dotenv').config();
const { MarketDataProvider, fetchMarketData } = require('neural-trader');
const fs = require('fs');
const path = require('path');

/**
 * Method 1: Use Alpaca to get 5+ years of data (FREE!)
 */
async function fetchAlpacaHistoricalData(symbol, startDate, endDate) {
    console.log(`📊 Fetching ${symbol} data from Alpaca...`);
    console.log(`   Period: ${startDate} to ${endDate}\n`);

    try {
        // Create market data provider
        const dataProvider = new MarketDataProvider({
            provider: 'alpaca',
            apiKey: process.env.ALPACA_API_KEY,
            apiSecret: process.env.ALPACA_API_SECRET,
            websocketEnabled: false
        });

        await dataProvider.connect();
        console.log('✅ Connected to Alpaca\n');

        // Fetch historical bars
        const bars = await dataProvider.fetchBars(
            symbol,
            startDate,
            endDate,
            '1Day'  // Daily bars (can also use: 1Min, 5Min, 15Min, 1Hour)
        );

        await dataProvider.disconnect();

        console.log(`✅ Fetched ${bars.length} daily bars\n`);

        return bars;

    } catch (error) {
        console.error('❌ Error fetching from Alpaca:', error.message);
        return null;
    }
}

/**
 * Method 2: Fetch multiple years at once
 */
async function fetchMultiYearData(symbol, years = 5) {
    console.log(`📈 Fetching ${years} years of ${symbol} data...\n`);

    const endDate = new Date();
    const startDate = new Date();
    startDate.setFullYear(endDate.getFullYear() - years);

    const start = startDate.toISOString().split('T')[0];
    const end = endDate.toISOString().split('T')[0];

    return await fetchAlpacaHistoricalData(
        symbol,
        `${start}T00:00:00Z`,
        `${end}T23:59:59Z`
    );
}

/**
 * Method 3: Fetch multiple symbols (portfolio backtesting)
 */
async function fetchMultipleSymbols(symbols, years = 2) {
    console.log(`📊 Fetching data for ${symbols.length} symbols...\n`);

    const endDate = new Date();
    const startDate = new Date();
    startDate.setFullYear(endDate.getFullYear() - years);

    const start = `${startDate.toISOString().split('T')[0]}T00:00:00Z`;
    const end = `${endDate.toISOString().split('T')[0]}T23:59:59Z`;

    const allData = {};

    for (const symbol of symbols) {
        console.log(`   Fetching ${symbol}...`);
        const bars = await fetchAlpacaHistoricalData(symbol, start, end);

        if (bars && bars.length > 0) {
            allData[symbol] = bars;
            console.log(`   ✅ ${symbol}: ${bars.length} bars\n`);
        } else {
            console.log(`   ⚠️  ${symbol}: No data\n`);
        }

        // Small delay to avoid rate limits
        await new Promise(resolve => setTimeout(resolve, 100));
    }

    return allData;
}

/**
 * Save data to file for later use
 */
function saveDataToFile(data, filename) {
    const dataDir = path.join(__dirname, '../historical-data');

    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
    }

    const filePath = path.join(dataDir, filename);

    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));

    console.log(`💾 Data saved to: ${filePath}\n`);
    return filePath;
}

/**
 * Load data from file
 */
function loadDataFromFile(filename) {
    const filePath = path.join(__dirname, '../historical-data', filename);

    if (!fs.existsSync(filePath)) {
        console.log(`⚠️  File not found: ${filePath}`);
        return null;
    }

    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    console.log(`📂 Loaded data from: ${filePath}`);
    console.log(`   Records: ${Array.isArray(data) ? data.length : Object.keys(data).length}\n`);

    return data;
}

/**
 * Main example
 */
async function fetchHistoricalDataExample() {
    console.log('=== Fetching Historical Data for Backtesting ===\n');

    console.log('Why more data matters:');
    console.log('  ✅ 3 months (62 days) → 0-1 trades per strategy (not reliable)');
    console.log('  ✅ 1 year (252 days) → 10-30 trades per strategy (better)');
    console.log('  ✅ 5 years (1260 days) → 100+ trades per strategy (statistical significance!)');
    console.log('  ✅ Multiple symbols → Test portfolio strategies\n');

    // Example 1: Fetch 2 years of AAPL data
    console.log('━━━ Example 1: Fetch 2 Years of Data ━━━\n');

    const aaplData = await fetchMultiYearData('AAPL', 2);

    if (aaplData) {
        // Save for later use
        saveDataToFile(aaplData, 'AAPL-2-years.json');

        // Show some stats
        const prices = aaplData.map(b => b.close);
        const minPrice = Math.min(...prices);
        const maxPrice = Math.max(...prices);
        const startPrice = prices[0];
        const endPrice = prices[prices.length - 1];
        const totalReturn = ((endPrice - startPrice) / startPrice) * 100;

        console.log('📊 Data Summary:');
        console.log(`   Total bars: ${aaplData.length}`);
        console.log(`   Date range: ${aaplData[0].timestamp.split('T')[0]} to ${aaplData[aaplData.length-1].timestamp.split('T')[0]}`);
        console.log(`   Price range: $${minPrice.toFixed(2)} - $${maxPrice.toFixed(2)}`);
        console.log(`   Buy & hold return: ${totalReturn.toFixed(2)}%\n`);
    }

    // Example 2: Fetch multiple tech stocks
    console.log('━━━ Example 2: Fetch Multiple Symbols ━━━\n');

    const symbols = ['AAPL', 'MSFT', 'GOOGL'];
    console.log(`Fetching ${symbols.join(', ')}...\n`);

    const multiData = await fetchMultipleSymbols(symbols, 1);

    if (Object.keys(multiData).length > 0) {
        saveDataToFile(multiData, 'tech-stocks-1-year.json');

        console.log('📊 Multi-Symbol Summary:');
        for (const [symbol, bars] of Object.entries(multiData)) {
            const prices = bars.map(b => b.close);
            const ret = ((prices[prices.length-1] - prices[0]) / prices[0]) * 100;
            console.log(`   ${symbol}: ${bars.length} bars, ${ret.toFixed(2)}% return`);
        }
        console.log();
    }

    // Example 3: Different timeframes
    console.log('━━━ Example 3: Different Timeframes ━━━\n');

    console.log('Available timeframes:');
    console.log('  • 1Min  - Minute bars (day trading, max ~1 week of data)');
    console.log('  • 5Min  - 5-minute bars (intraday trading)');
    console.log('  • 15Min - 15-minute bars (swing trading)');
    console.log('  • 1Hour - Hourly bars (position trading)');
    console.log('  • 1Day  - Daily bars (long-term backtesting) ✅ Best for learning\n');

    console.log('To fetch intraday data:');
    console.log('```javascript');
    console.log('const bars = await dataProvider.fetchBars(');
    console.log('    "AAPL",');
    console.log('    "2024-01-01T09:30:00Z",  // Market open');
    console.log('    "2024-01-01T16:00:00Z",  // Market close');
    console.log('    "5Min"                    // 5-minute bars');
    console.log(');');
    console.log('```\n');

    // Example 4: Using the data in backtests
    console.log('━━━ Example 4: Using Downloaded Data ━━━\n');

    console.log('Load and use in your backtests:');
    console.log('```javascript');
    console.log('// Load previously downloaded data');
    console.log('const historicalData = loadDataFromFile("AAPL-2-years.json");');
    console.log();
    console.log('// Convert to format your backtests expect');
    console.log('const prices = historicalData.map(bar => ({');
    console.log('    date: bar.timestamp.split("T")[0],');
    console.log('    close: bar.close,');
    console.log('    volume: bar.volume');
    console.log('}));');
    console.log();
    console.log('// Run backtest with 2 years of data!');
    console.log('const result = runBacktest(prices, 5, 20);');
    console.log('console.log("Trades:", result.totalTrades);  // Much more reliable!');
    console.log('```\n');

    // Tips
    console.log('━━━ Pro Tips ━━━\n');

    console.log('1. Start Date Strategies:');
    console.log('   • 2019-01-01: 5+ years (best for long-term patterns)');
    console.log('   • 2020-03-01: Post-COVID (different market regime)');
    console.log('   • 2022-01-01: Recent 2 years (most relevant to current market)');
    console.log();

    console.log('2. Data Quality:');
    console.log('   • Alpaca provides adjusted prices (accounts for splits/dividends)');
    console.log('   • Daily bars are most reliable');
    console.log('   • Minute data limited to recent periods');
    console.log();

    console.log('3. Storage:');
    console.log('   • Save fetched data to avoid repeated API calls');
    console.log('   • Update weekly/monthly for new bars');
    console.log('   • 1 year of daily data ≈ 50KB per symbol');
    console.log();

    console.log('4. Rate Limits:');
    console.log('   • Alpaca free tier: 200 requests/minute');
    console.log('   • Add small delays between symbols');
    console.log('   • Fetching 5 years takes ~5-10 seconds per symbol');
    console.log();

    // Ready-to-use commands
    console.log('━━━ Ready-to-Use Commands ━━━\n');

    console.log('Copy these into your code:\n');

    console.log('// Get 5 years of AAPL');
    console.log('const data = await fetchMultiYearData("AAPL", 5);');
    console.log('saveDataToFile(data, "AAPL-5-years.json");\n');

    console.log('// Get multiple stocks for portfolio testing');
    console.log('const portfolio = await fetchMultipleSymbols(');
    console.log('    ["AAPL", "MSFT", "GOOGL", "AMZN", "TSLA"],');
    console.log('    3  // 3 years');
    console.log(');');
    console.log('saveDataToFile(portfolio, "portfolio-3-years.json");\n');

    console.log('// Load and use');
    console.log('const historicalData = loadDataFromFile("AAPL-5-years.json");');
    console.log('const result = runBacktest(historicalData, 5, 20);\n');

    console.log('=== Complete ===\n');

    console.log('Next steps:');
    console.log('1. Run: node examples/09-fetch-historical-data.js');
    console.log('2. Check: historical-data/ folder for saved files');
    console.log('3. Modify: your backtest examples to use the saved data');
    console.log('4. Compare: results on 3 months vs 2 years vs 5 years');
    console.log('5. Learn: which strategies work across different time periods\n');
}

// Alternative: Manual CSV import (if you have your own data)
function importFromCSV(csvPath) {
    console.log('📁 Importing from CSV...\n');

    console.log('CSV format expected:');
    console.log('date,open,high,low,close,volume');
    console.log('2023-01-03,130.28,130.90,124.17,125.07,112117500');
    console.log('2023-01-04,126.89,128.66,125.08,126.36,89113600');
    console.log('...\n');

    console.log('```javascript');
    console.log('const fs = require("fs");');
    console.log('const csv = fs.readFileSync("data.csv", "utf8");');
    console.log('const lines = csv.split("\\n").slice(1); // Skip header');
    console.log();
    console.log('const data = lines.map(line => {');
    console.log('    const [date, open, high, low, close, volume] = line.split(",");');
    console.log('    return {');
    console.log('        date,');
    console.log('        close: parseFloat(close),');
    console.log('        volume: parseInt(volume)');
    console.log('    };');
    console.log('});');
    console.log('```\n');
}

// Run the example
if (require.main === module) {
    fetchHistoricalDataExample().catch(error => {
        console.error('Fatal error:', error);
        process.exit(1);
    });
}

module.exports = {
    fetchAlpacaHistoricalData,
    fetchMultiYearData,
    fetchMultipleSymbols,
    saveDataToFile,
    loadDataFromFile
};
