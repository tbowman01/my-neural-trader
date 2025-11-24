# My Neural Trader

A learning and analysis platform for stock trading using neural-trader, with AI-powered strategy development, backtesting, paper trading, and automated ML pipeline with self-updating models.

## Features

- **Paper Trading**: Learn trading with Alpaca's free $100k virtual capital
- **Strategy Backtesting**: Test strategies on historical data before risking real money
- **Technical Indicators**: Built-in SMA, RSI, MACD, Bollinger Bands, and 150+ more
- **Neural Networks**: LSTM, Transformer, and N-BEATS models for price prediction
- **Risk Management**: VaR, CVaR, Kelly Criterion, drawdown analysis
- **High Performance**: Rust core with 8-19x faster execution than Python

### Stage 2: Adaptation Infrastructure (NEW)

- **A/B Testing**: Statistical validation of new models before deployment
- **Shadow Mode**: Risk-free parallel testing of candidate models
- **Model Versioning**: Complete version history with rollback capability
- **Performance Tracking**: Continuous accuracy monitoring and degradation detection
- **Auto-Retraining**: Scheduled weekly model updates
- **Monitoring Dashboard**: Real-time HTML dashboard with system health metrics
- **Multi-Channel Alerting**: Email, Slack, and console notifications for critical events
- **Automated Deployment**: Deploy only statistically-proven better models

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Get FREE Alpaca API Keys

1. Go to [alpaca.markets](https://alpaca.markets)
2. Sign up for a free account
3. Navigate to "Paper Trading" section
4. Generate API keys

### 3. Configure Environment

Update `.env` file with your Alpaca keys:

```bash
ALPACA_API_KEY=your_key_here
ALPACA_API_SECRET=your_secret_here
```

### 4. Run Examples

**Basic Trading Example** - Connect to Alpaca, check balance, view positions:
```bash
node examples/01-basic-trading.js
```

**Strategy Backtesting** - Test SMA crossover strategy on historical data:
```bash
node examples/02-strategy-backtest.js
```

## Project Structure

```
my-neural-trader/
├── .env                          # Environment variables (API keys)
├── config.json                   # Configuration (prediction markets)
├── package.json                  # Project dependencies
├── examples/
│   ├── 01-basic-trading.js      # Basic Alpaca trading example
│   └── 02-strategy-backtest.js  # Strategy backtesting example
├── src/
│   └── main.js                  # Main application entry point
└── node_modules/
    └── neural-trader/           # Neural trader package
```

## Example Usage

### Basic Trading

```javascript
const { BrokerClient } = require('neural-trader');

// Connect to Alpaca paper trading
const broker = new BrokerClient({
    brokerType: 'alpaca',
    apiKey: process.env.ALPACA_API_KEY,
    apiSecret: process.env.ALPACA_API_SECRET,
    paperTrading: true
});

await broker.connect();

// Check account balance
const balance = await broker.getAccountBalance();
console.log(`Cash: $${balance.cash}`);

// Get current positions
const positions = await broker.getPositions();
console.log(`Positions: ${positions.length}`);

// Place a market order
const order = {
    symbol: 'AAPL',
    side: 'buy',
    orderType: 'market',
    quantity: 1,
    timeInForce: 'day'
};

const result = await broker.placeOrder(order);
console.log(`Order placed: ${result.orderId}`);
```

### Strategy Backtesting

```javascript
const { BacktestEngine, MarketDataProvider, calculateSma } = require('neural-trader');

// Fetch historical data
const dataProvider = new MarketDataProvider({
    provider: 'alpaca',
    apiKey: process.env.ALPACA_API_KEY,
    apiSecret: process.env.ALPACA_API_SECRET
});

await dataProvider.connect();
const bars = await dataProvider.fetchBars('AAPL', '2024-01-01', '2024-12-31', '1Day');

// Calculate indicators
const prices = bars.map(b => b.close);
const sma20 = calculateSma(prices, 20);
const sma50 = calculateSma(prices, 50);

// Generate signals (buy when SMA20 crosses above SMA50)
const signals = [];
for (let i = 50; i < bars.length; i++) {
    if (sma20[i-1] <= sma50[i-1] && sma20[i] > sma50[i]) {
        signals.push({
            symbol: 'AAPL',
            direction: 'long',
            entryPrice: bars[i].close,
            // ... more signal data
        });
    }
}

// Run backtest
const engine = new BacktestEngine({
    initialCapital: 10000,
    commission: 0.001,
    slippage: 0.0005
});

const result = await engine.run(signals, JSON.stringify({ bars }));
console.log(`Total Return: ${(result.metrics.totalReturn * 100).toFixed(2)}%`);
console.log(`Sharpe Ratio: ${result.metrics.sharpeRatio.toFixed(2)}`);
console.log(`Win Rate: ${(result.metrics.winRate * 100).toFixed(1)}%`);
```

### A/B Testing and Model Management

Stage 2 provides production-ready infrastructure for safely deploying improved models:

```bash
# 1. Train new models weekly
node scripts/weekly-retrain.js

# 2. Start shadow mode (7-day A/B test)
node scripts/run-shadow-mode.js v20251208_0000 7

# 3. Generate monitoring dashboard
node scripts/generate-dashboard.js

# 4. End shadow mode and auto-deploy if better
node scripts/end-shadow-mode.js test_1732483200_abc123 --auto-deploy
```

**Shadow Mode Example:**

```javascript
const ABTesting = require('./lib/ab-testing');
const abTesting = new ABTesting();

// Start 7-day A/B test
const shadowConfig = await abTesting.startShadowMode('v20251208_0000', 7);

// Both models make predictions in parallel
// Production model controls live decisions
// Candidate model runs in shadow (no impact)

// After 7 days, evaluate results
const results = await abTesting.endShadowMode(shadowConfig.testId);

console.log(`Production Accuracy: ${results.productionMetrics.accuracyPercent}%`);
console.log(`Candidate Accuracy: ${results.candidateMetrics.accuracyPercent}%`);
console.log(`P-Value: ${results.comparison.pValue}`);
console.log(`Recommendation: ${results.recommendation.decision}`);

// Auto-deploy if statistically better
if (results.recommendation.decision === 'DEPLOY') {
  await abTesting.autoDeploy(shadowConfig.testId);
}
```

**Monitoring Dashboard:**

```bash
# Generate real-time dashboard
node scripts/generate-dashboard.js --output dashboard.html

# Open in browser
open dashboard.html
```

Dashboard includes:
- Performance metrics (accuracy, confidence, predictions)
- System health (degradation status, production version)
- Alert summary (last 7 days by severity)
- Model version history
- A/B test results

**Alerting Example:**

```javascript
const AlertingSystem = require('./lib/alerting');
const alerting = new AlertingSystem({
  alertEmail: 'admin@example.com',
  slackWebhook: 'https://hooks.slack.com/services/...',
  degradationThreshold: 0.05  // 5% accuracy drop
});

// Monitor performance
const tracker = new PerformanceTracker();
const degradation = tracker.detectDegradation();

if (degradation.degraded) {
  // Send multi-channel alert
  await alerting.alertPerformanceDegradation(degradation);
}
```

## Available Brokers

neural-trader supports multiple brokers:

- **Alpaca** - Commission-free stocks/crypto (recommended for learning)
- **Interactive Brokers** - Professional trading platform
- **Binance** - Cryptocurrency exchange
- **Coinbase** - Cryptocurrency exchange
- **Kraken** - Cryptocurrency exchange

## Learning Workflow: How to Use Backtesting to Train Models

This project teaches you a systematic approach to learning trading through backtesting:

### Phase 1: Simple Backtesting (Start Here)
**Example**: `03-simple-backtest.js`

Learn the fundamentals:
- How technical indicators generate signals
- How to calculate P&L with commissions
- Why comparing to buy-and-hold matters
- Understanding basic performance metrics

### Phase 2: Parameter Optimization
**Example**: `04-learn-from-backtests.js`

Discover what works:
- Test multiple strategy parameters systematically
- Learn which parameters work in different market conditions
- Understand parameter sensitivity and overfitting risk
- Compare strategies objectively with data

**Key Insight**: Run the same strategy with 7 different parameter combinations and learn which performs best. This teaches you what the market responds to.

### Phase 3: Neural Network Training
**Example**: `05-neural-network-training.js`

Let models discover patterns:
- Train predictive models on historical data
- Learn which features matter (SMA, RSI, volume)
- Understand prediction accuracy vs. profitability
- See what patterns neural networks discover

**Key Insight**: The model learns that trend + volume confirmation + RSI levels combine to predict price movements with 53% direction accuracy and 75% predictions within 2% of actual.

### Complete Learning Cycle

```
1. Backtest Strategy → 2. Analyze Results → 3. Learn Patterns → 4. Improve Strategy → (repeat)
```

**The 7-Step Learning Process:**

1. ✅ **Backtest**: Test strategy on historical data
2. ✅ **Compare**: Compare to buy-and-hold and other strategies
3. ✅ **Analyze**: Study which market conditions favored your strategy
4. ✅ **Optimize**: Test multiple parameters to find what works
5. ✅ **Validate**: Test on different time periods and symbols
6. ⏭️  **Paper Trade**: Test in real-time with virtual money
7. ⏭️  **Refine**: Adjust based on live performance

### What You Learn From Backtesting

**From 03-simple-backtest.js**, you learn:
- SMA crossover made 7.61% vs buy-and-hold's 31.85%
- Strategy had only 1 trade - not statistically significant
- In strong uptrends, staying invested often beats trading
- **Lesson**: Match strategy to market conditions

**From 04-learn-from-backtests.js**, you learn:
- Tested 7 parameter combinations
- Best: SMA(5/15) = 7.61% return
- All strategies underperformed buy-and-hold
- Average only 0.9 trades (too few)
- **Lesson**: Need faster SMAs or different strategy for trends

**From 05-neural-network-training.js**, you learn:
- Advanced model achieved 75% accuracy (within 2%)
- Direction accuracy: 53.1% (better than random)
- Learned: SMA trends + RSI + volume = better predictions
- Improvement over baseline: model learned useful patterns
- **Lesson**: Combining multiple indicators improves predictions

### Next Steps

1. **Experiment with Examples**: Modify the scripts to try:
   - Different stocks (MSFT, GOOGL, SPY, QQQ)
   - Different time periods (bull markets, bear markets, sideways)
   - Different strategy parameters (faster/slower SMAs)

2. **Build Your Own Strategy**:
   - Combine indicators (SMA + RSI + MACD + Bollinger Bands)
   - Add risk management (stop loss, take profit, position sizing)
   - Test on multiple market conditions

3. **Use Real Neural Networks**:
   - neural-trader includes LSTM, Transformer, N-BEATS models
   - Train on years of data (not just months)
   - Add more features (news sentiment, options flow, macro data)
   - Use GPU acceleration for faster training

4. **Portfolio Management**:
   - Trade multiple symbols simultaneously
   - Use Markowitz optimization for allocation
   - Implement risk parity strategies

### Strategy Ideas to Test

- **Mean Reversion**: Buy oversold, sell overbought (RSI-based)
- **Momentum**: Follow strong trends (moving average ribbons)
- **Breakout**: Trade price breakouts above resistance
- **Pairs Trading**: Trade correlated stocks against each other
- **VWAP Reversion**: Trade deviations from VWAP

### Key Metrics to Understand

- **Sharpe Ratio**: Risk-adjusted returns (>1.0 is good, >2.0 is excellent)
- **Win Rate**: Percentage of winning trades (>50% is good)
- **Profit Factor**: Gross profit / gross loss (>1.5 is good)
- **Max Drawdown**: Largest peak-to-trough decline (<20% is good)
- **Sortino Ratio**: Like Sharpe but only penalizes downside volatility

## Configuration

### Environment Variables (.env)

```bash
# Alpaca Paper Trading (Free $100k virtual capital)
ALPACA_API_KEY=your_key_here
ALPACA_API_SECRET=your_secret_here
ALPACA_PAPER_TRADING=true

# Optional: Crypto trading
BINANCE_API_KEY=your_key_here
BINANCE_API_SECRET=your_secret_here
```

### Config File (config.json)

The `config.json` file is pre-configured for prediction markets (Polymarket, Kalshi). This is separate from stock trading via Alpaca.

## Documentation

### Neural Trader Core

- [Neural Trader Documentation](https://neural-trader.ruv.io)
- [GitHub Repository](https://github.com/ruvnet/neural-trader)
- [API Reference](https://www.npmjs.com/package/neural-trader)
- [Alpaca Documentation](https://alpaca.markets/docs/)

### Stage 2: Adaptation Infrastructure

- [User Guide](docs/USER-GUIDE.md) - Complete guide to A/B testing, monitoring, and alerting
- [Implementation Plan](docs/STAGE2-IMPLEMENTATION-PLAN.md) - Technical implementation details
- [Phases 3-4 Completion](docs/STAGE2-PHASES-3-4-COMPLETION.md) - A/B testing and monitoring implementation summary
- [Deployment Guide](docs/DEPLOYMENT-GUIDE.md) - Production deployment instructions

## Support

- **Neural Trader Issues**: https://github.com/ruvnet/neural-trader/issues
- **Alpaca Support**: https://alpaca.markets/support
- **Discord Community**: https://discord.gg/neural-trader

## Safety & Best Practices

1. **Always start with paper trading** - Never use real money until you're consistently profitable
2. **Test thoroughly** - Backtest strategies across multiple time periods and market conditions
3. **Manage risk** - Use stop losses, position sizing, and diversification
4. **Keep learning** - Markets change, strategies need adaptation
5. **Never commit API keys** - The `.env` file is gitignored for security

## License

This project uses neural-trader which is licensed under MIT OR Apache-2.0.

## Acknowledgments

Built with [neural-trader](https://github.com/ruvnet/neural-trader) - The first self-learning AI trading platform built for Claude Code, Cursor, and GitHub Copilot.
