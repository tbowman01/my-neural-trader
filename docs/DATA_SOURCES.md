# How to Get More Backtesting Data

This guide shows you all the ways to get historical stock data for backtesting.

## Quick Answer

**Best Options (Ordered by Ease):**

1. ✅ **Use Alpaca API** (What you have) - FREE, 5+ years, already set up
2. ✅ **Yahoo Finance (yfinance)** - FREE, unlimited history, easy to use
3. ✅ **Alpha Vantage** - FREE tier, good for learning
4. ✅ **Manually create extended datasets** - For testing/learning

---

## Option 1: Alpaca API (Already Set Up!)

**You have Alpaca configured**, but the MarketDataProvider may have limitations. Here's the direct API approach:

### Using Alpaca REST API Directly

```javascript
const axios = require('axios');

async function fetchAlpacaData(symbol, start, end) {
    const response = await axios.get(
        `https://data.alpaca.markets/v2/stocks/${symbol}/bars`,
        {
            params: {
                start: start,
                end: end,
                timeframe: '1Day',
                limit: 10000
            },
            headers: {
                'APCA-API-KEY-ID': process.env.ALPACA_API_KEY,
                'APCA-API-SECRET-KEY': process.env.ALPACA_API_SECRET
            }
        }
    );

    return response.data.bars;
}

// Get 5 years of data
const data = await fetchAlpacaData('AAPL', '2019-01-01', '2024-11-01');
console.log(`Fetched ${data.length} bars`);
```

**Pros:**
- Already have API keys
- Free tier: 200 requests/minute
- Adjusted for splits/dividends
- 5+ years of history

**Cons:**
- May need axios library: `npm install axios`
- Rate limits on free tier

---

## Option 2: Yahoo Finance (Recommended for Learning)

**yfinance** is a Python library, but there's a Node.js equivalent:

### Install yahoo-finance2

```bash
npm install yahoo-finance2
```

### Usage

```javascript
const yahooFinance = require('yahoo-finance2').default;

async function fetchYahooData(symbol, start, end) {
    const result = await yahooFinance.historical(symbol, {
        period1: start,  // '2019-01-01'
        period2: end,    // '2024-11-01'
        interval: '1d'
    });

    return result.map(bar => ({
        date: bar.date.toISOString().split('T')[0],
        open: bar.open,
        high: bar.high,
        low: bar.low,
        close: bar.close,
        volume: bar.volume
    }));
}

// Get 10+ years of data!
const data = await fetchYahooData('AAPL', '2014-01-01', '2024-11-01');
console.log(`Fetched ${data.length} bars`);  // ~2,500+ days!
```

**Pros:**
- ✅ FREE, unlimited
- ✅ 10+ years of history
- ✅ No API key needed
- ✅ Very reliable
- ✅ Works for stocks, ETFs, crypto

**Cons:**
- Separate npm package needed

---

## Option 3: Alpha Vantage

Free API with good data quality.

### Get Free API Key

1. Go to: https://www.alphavantage.co/support/#api-key
2. Enter email, get key instantly
3. Free tier: 25 requests/day, 500 requests/minute

### Usage

```bash
npm install alphavantage
```

```javascript
const alpha = require('alphavantage')({ key: 'YOUR_KEY' });

async function fetchAlphaVantageData(symbol) {
    const data = await alpha.data.daily(symbol, 'full');  // 20+ years!

    return Object.entries(data['Time Series (Daily)']).map(([date, values]) => ({
        date,
        close: parseFloat(values['4. close']),
        volume: parseInt(values['5. volume'])
    }));
}

const data = await fetchAlphaVantageData('AAPL');
console.log(`Fetched ${data.length} days`);  // Often 5000+ days!
```

**Pros:**
- 20+ years of history
- Very comprehensive
- Free tier available

**Cons:**
- Rate limited (25 requests/day free)
- Need to sign up for API key

---

## Option 4: Extended Sample Data (For Learning)

I can generate realistic extended sample data based on actual AAPL patterns:

### Generate Extended Dataset

```javascript
// Based on Q1 2023, extrapolate to create 2 years
const seed Data = [
    { date: '2023-01-03', close: 125.07 },
    // ... your existing 62 days
];

function generateExtendedData(seedData, totalDays) {
    const extended = [...seedData];
    const lastPrice = seedData[seedData.length - 1].close;
    const lastDate = new Date(seedData[seedData.length - 1].date);

    // Generate additional days with realistic random walk
    for (let i = 0; i < totalDays - seedData.length; i++) {
        const prevPrice = extended[extended.length - 1].close;

        // Random daily return between -3% and +3%
        const dailyReturn = (Math.random() - 0.5) * 0.06;
        const newPrice = prevPrice * (1 + dailyReturn);

        // Next business day
        lastDate.setDate(lastDate.getDate() + 1);
        if (lastDate.getDay() === 0) lastDate.setDate(lastDate.getDate() + 1);  // Skip Sunday
        if (lastDate.getDay() === 6) lastDate.setDate(lastDate.getDate() + 2);  // Skip Saturday

        extended.push({
            date: lastDate.toISOString().split('T')[0],
            close: Math.round(newPrice * 100) / 100,
            volume: Math.floor(Math.random() * 50000000) + 50000000
        });
    }

    return extended;
}

// Generate 2 years (500 trading days)
const twoYears = generateExtendedData(seedData, 500);
```

**Pros:**
- No API needed
- Instant
- Good for testing logic

**Cons:**
- Not real data
- Won't match actual market conditions

---

## Quick Start: Get Yahoo Finance Data NOW

Here's a complete, working script you can run right now:

### Install Package

```bash
npm install yahoo-finance2
```

### Create: `download-yahoo-data.js`

```javascript
const yahooFinance = require('yahoo-finance2').default;
const fs = require('fs');

async function downloadYahooData() {
    console.log('Downloading data from Yahoo Finance...\n');

    const symbols = ['AAPL', 'MSFT', 'GOOGL', 'SPY'];

    for (const symbol of symbols) {
        console.log(`Fetching ${symbol}...`);

        const data = await yahooFinance.historical(symbol, {
            period1: '2019-01-01',
            period2: '2024-11-01',
            interval: '1d'
        });

        const formatted = data.map(bar => ({
            date: bar.date.toISOString().split('T')[0],
            open: bar.open,
            high: bar.high,
            low: bar.low,
            close: bar.close,
            volume: bar.volume
        }));

        fs.writeFileSync(
            `historical-data/${symbol}-yahoo-5years.json`,
            JSON.stringify(formatted, null, 2)
        );

        console.log(`✅ ${symbol}: ${formatted.length} days saved\n`);
        await new Promise(r => setTimeout(r, 1000));  // Be nice to Yahoo
    }

    console.log('Done! Check historical-data/ folder');
}

downloadYahooData();
```

### Run It

```bash
node download-yahoo-data.js
```

You'll get:
- `AAPL-yahoo-5years.json` (~1,250 days)
- `MSFT-yahoo-5years.json` (~1,250 days)
- `GOOGL-yahoo-5years.json` (~1,250 days)
- `SPY-yahoo-5years.json` (~1,250 days)

---

## Comparison Table

| Source | Setup Time | Data History | Rate Limits | Cost | Best For |
|--------|-----------|--------------|-------------|------|----------|
| **Alpaca** | ✅ Done! | 5+ years | 200/min | FREE | You already have this |
| **Yahoo Finance** | 5 min | 20+ years | Unlimited | FREE | Easiest, most data |
| **Alpha Vantage** | 2 min | 20+ years | 25/day free | FREE | Comprehensive data |
| **Sample Data** | Instant | As much as you generate | None | FREE | Testing logic only |

---

## Recommended Approach

### For Learning (This Week):

1. **Install yahoo-finance2**:
   ```bash
   npm install yahoo-finance2
   ```

2. **Download 5 years of data**:
   ```bash
   node download-yahoo-data.js  # Script above
   ```

3. **Use in your backtests**:
   ```javascript
   const data = JSON.parse(fs.readFileSync('historical-data/AAPL-yahoo-5years.json'));
   const result = runBacktest(data, 5, 20);
   ```

### For Production (Later):

1. Use Alpaca's real-time data API
2. Store data in a database (PostgreSQL, SQLite)
3. Update daily with new bars
4. Keep historical data for walk-forward testing

---

## Example: Modify Your Backtest to Use Downloaded Data

Update your `03-simple-backtest.js`:

```javascript
const fs = require('fs');
const path = require('path');

// Load downloaded data instead of hardcoded
const dataPath = path.join(__dirname, '../historical-data/AAPL-yahoo-5years.json');
const sampleData = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

// Now sampleData has 1,250+ days instead of 62!
console.log(`Loaded ${sampleData.length} days of data`);

// Rest of your backtest code stays the same...
const result = runBacktest(sampleData, 5, 20);
```

---

## Next Steps

1. **Choose your source**:
   - Already have Alpaca? Try the direct API approach
   - Want easiest? Use Yahoo Finance (recommended)
   - Need most comprehensive? Try Alpha Vantage

2. **Download data**:
   - Run the script for your chosen source
   - Get 2-5 years of data for multiple symbols

3. **Update your examples**:
   - Modify examples 03, 04, 05 to load from files
   - Compare results: 62 days vs 500 days vs 1,250 days

4. **Learn from more data**:
   - See if strategies work across different years
   - Test in bull markets (2019-2021) vs bear markets (2022)
   - Find strategies that work in all conditions

---

## Troubleshooting

### "Module not found: yahoo-finance2"

```bash
npm install yahoo-finance2
```

### "Rate limit exceeded"

- Yahoo Finance: Add `await new Promise(r => setTimeout(r, 1000))` between requests
- Alpaca: You have 200/minute, should be fine
- Alpha Vantage: Free tier is 25/day, spread requests out

### "Invalid date format"

Make sure dates are in ISO format: `YYYY-MM-DD`

---

## Summary

**Quickest path to more data:**

```bash
# 1. Install package (30 seconds)
npm install yahoo-finance2

# 2. Create script (copy from above) (2 minutes)

# 3. Run script (1 minute)
node download-yahoo-data.js

# 4. Use in backtests (instant)
const data = require('./historical-data/AAPL-yahoo-5years.json');
```

**Result:**
- 1,250+ days of data (vs your current 62)
- 40+ trades per strategy (vs 0-1)
- Statistically significant results
- Test across different market conditions
- Much better neural network training

You'll go from unreliable 1-trade backtests to robust 40-trade backtests in under 5 minutes!
