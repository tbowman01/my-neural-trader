# Free Prediction Markets Resources

## Overview
This guide lists free resources you can use to enhance your portfolio with prediction market data and trading.

## 🆓 Free APIs & Data Sources

### 1. Polymarket (Completely Free)

**GraphQL Subgraph (Recommended)**
- **Endpoint**: `https://api.goldsky.com/api/public/project_cl6mb8i9h0003e201j6li0diw/subgraphs/orderbook-subgraph/0.0.1/gn`
- **Free Tier**: 100,000 queries/month via The Graph Network
- **Data Available**:
  - Market data and prices
  - Trading volume
  - User positions
  - Liquidity data
  - Order books
  - Historical trades
- **Documentation**: https://docs.polymarket.com/developers/subgraph/overview
- **Open Source**: https://github.com/Polymarket/polymarket-subgraph

**REST API**
- **Endpoint**: `https://gamma-api.polymarket.com/`
- **Free Tier**: Up to 1,000 calls/hour for non-trading queries
- **Data Available**: Market information, prices, basic analytics
- **Guide**: https://apidog.com/blog/polymarket-api/

### 2. Kalshi (Free Demo Account)

**Demo Environment**
- **Website**: https://kalshi.com/api
- **Free Demo Account**: Test with mock funds (risk-free)
- **API Access**: Full API testing in demo mode
- **Rate Limits**: Check docs for current limits
- **Support**: Join Discord #dev channel for help
- **Documentation**: https://trading-api.readme.io/

**Getting Started**:
1. Sign up at kalshi.com
2. Create demo account
3. Generate API key in account settings
4. Test integration with mock funds

### 3. The Graph Network

**Polymarket Subgraph Queries**
- **Free Tier**: 100k queries/month
- **Perfect for**: Side projects and portfolio enhancement
- **Query Type**: GraphQL
- **Response Format**: JSON
- **Documentation**: https://thegraph.com/docs/en/subgraphs/guides/polymarket/

### 4. Bitquery

**Blockchain Data Access**
- **Type**: GraphQL API for on-chain prediction market data
- **Data**: Market info, trading activity, token holders, oracle data
- **Check**: https://docs.bitquery.io/docs/examples/polymarket-api/
- **Note**: Verify current free tier offerings

## 📊 Starting Strategy for Free

### Phase 1: Data Collection (Free)
1. Use Polymarket GraphQL endpoint for historical data
2. Set up Kalshi demo account for testing
3. Query basic market information (prices, volumes, events)
4. Build data collection pipeline (100k queries = ~3,300/day)

### Phase 2: Analysis & Backtesting (Free)
1. Use collected data for strategy development
2. Test strategies in Kalshi demo environment
3. Analyze market inefficiencies
4. Build probability calibration models

### Phase 3: Portfolio Integration (Free to Start)
1. Paper trading with real-time data
2. Track predictions vs outcomes
3. Refine strategies based on accuracy
4. Monitor performance metrics

## 💡 Example Use Cases

### Market Data Collection
```javascript
// Query Polymarket markets via GraphQL
const query = `{
  markets(first: 10, orderBy: volume, orderDirection: desc) {
    id
    question
    volume
    outcomes
  }
}`;
```

### Price Monitoring
- Track odds changes across multiple markets
- Identify arbitrage opportunities
- Monitor market sentiment shifts

### Portfolio Enhancement
- Diversification into prediction markets
- Hedging traditional positions
- Event-driven trading strategies

## 🔗 Additional Free Resources

### Documentation
- Polymarket Docs: https://docs.polymarket.com/
- Kalshi Help Center: https://help.kalshi.com/kalshi-api
- The Graph Docs: https://thegraph.com/docs/

### Community & Support
- Kalshi Discord: #dev channel
- GitHub Issues: https://github.com/ruvnet/neural-trader/issues
- Neural Trader Discord: https://discord.gg/neural-trader

### Learning Resources
- Polymarket Analytics: https://polymarketanalytics.com/
- Market comparisons and dashboards (free to view)
- Real-time data visualization

## ⚠️ Important Notes

1. **Rate Limits**: Respect free tier limits to avoid being throttled
2. **API Keys**: Keep your Kalshi API keys secure (use environment variables)
3. **Demo First**: Always test in Kalshi demo before using real funds
4. **Compliance**: Ensure you're eligible to use these platforms (geographic restrictions may apply)

## 🚀 Next Steps

1. ✅ Project initialized
2. ✅ Dependencies installed
3. ⏭️ Test Polymarket GraphQL endpoint
4. ⏭️ Sign up for Kalshi demo account
5. ⏭️ Build your first data collection script
6. ⏭️ Develop prediction strategy
7. ⏭️ Start paper trading

## 📈 Scaling Beyond Free Tier

When ready to scale:
- **Dome**: Unified API for multiple platforms (Y Combinator backed)
- **FinFeedAPI**: High-frequency data (1-second OHLCV)
- **Kalshi Premium Tiers**: Higher rate limits and execution speed

---

*Last Updated: November 2025*
*This project uses Neural Trader v2.3.15*
