const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Config
const CONFIG = {
  INITIAL_CAPITAL: 100000,
  MAX_POSITION_SIZE: 0.02,
  STOP_LOSS_PERCENT: 0.02,  // Changed from 5% to 2%
  TAKE_PROFIT_PERCENT: 0.02,  // Changed from 15% to 2%
  MIN_CONFIDENCE: 0.43,
  MAX_POSITIONS: 10
};

// Model thinking log (in-memory, recent decisions)
const modelThinking = [];
const MAX_THINKING_LOG = 50;

function logThinking(type, message, data = {}) {
  const entry = {
    timestamp: new Date().toISOString(),
    type,
    message,
    data
  };
  modelThinking.unshift(entry);
  if (modelThinking.length > MAX_THINKING_LOG) {
    modelThinking.pop();
  }
}

// Helper: Load portfolio
function loadPortfolio() {
  const portfolioPath = path.join(__dirname, 'paper-portfolio.json');
  if (!fs.existsSync(portfolioPath)) {
    return {
      cash: CONFIG.INITIAL_CAPITAL,
      positions: {},
      tradeHistory: [],
      lastUpdated: null
    };
  }
  return JSON.parse(fs.readFileSync(portfolioPath, 'utf8'));
}

// Helper: Save portfolio
function savePortfolio(data) {
  data.lastUpdated = new Date().toISOString();
  fs.writeFileSync(
    path.join(__dirname, 'paper-portfolio.json'),
    JSON.stringify(data, null, 2)
  );
}

// Helper: Get current price for symbol
function getCurrentPrice(symbol) {
  try {
    const dataPath = path.join(__dirname, 'historical-data', `${symbol}-5-years.json`);
    if (!fs.existsSync(dataPath)) return null;
    const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
    if (!Array.isArray(data) || data.length === 0) return null;
    return data[data.length - 1].close;
  } catch {
    return null;
  }
}

// API: Get portfolio data
app.get('/api/portfolio', (req, res) => {
  try {
    const portfolioPath = path.join(__dirname, 'paper-portfolio.json');
    if (!fs.existsSync(portfolioPath)) {
      return res.json({
        cash: 100000,
        positions: {},
        tradeHistory: [],
        lastUpdated: null
      });
    }
    const data = JSON.parse(fs.readFileSync(portfolioPath, 'utf8'));
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// API: Get trading signals
app.get('/api/signals', (req, res) => {
  const signals = [
    { symbol: 'AAPL', score: 0.469, rf: 0.512, nn: 0.405 },
    { symbol: 'NVDA', score: 0.468, rf: 0.511, nn: 0.405 },
    { symbol: 'AMD', score: 0.462, rf: 0.501, nn: 0.405 },
    { symbol: 'ABNB', score: 0.455, rf: 0.488, nn: 0.405 },
    { symbol: 'UBER', score: 0.454, rf: 0.487, nn: 0.405 },
    { symbol: 'BA', score: 0.451, rf: 0.481, nn: 0.405 }
  ];
  res.json(signals);
});

// API: Get historical prices for a symbol
app.get('/api/prices/:symbol', (req, res) => {
  try {
    const symbol = req.params.symbol;
    const dataPath = path.join(__dirname, 'historical-data', `${symbol}-5-years.json`);

    if (!fs.existsSync(dataPath)) {
      return res.status(404).json({ error: 'Symbol not found' });
    }

    const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
    // Return last 90 days for charts
    const recentData = data.slice(-90);
    res.json(recentData);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// API: Get config
app.get('/api/config', (req, res) => {
  res.json({
    initialCapital: CONFIG.INITIAL_CAPITAL,
    maxPositionSize: CONFIG.MAX_POSITION_SIZE,
    stopLossPercent: CONFIG.STOP_LOSS_PERCENT,
    takeProfitPercent: CONFIG.TAKE_PROFIT_PERCENT,
    minConfidence: CONFIG.MIN_CONFIDENCE,
    maxPositions: CONFIG.MAX_POSITIONS
  });
});

// API: Get model thinking log
app.get('/api/thinking', (req, res) => {
  res.json(modelThinking);
});

// API: Manual BUY
app.post('/api/trade/buy', (req, res) => {
  try {
    const { symbol, shares } = req.body;
    if (!symbol || !shares || shares <= 0) {
      return res.status(400).json({ error: 'Invalid symbol or shares' });
    }

    const price = getCurrentPrice(symbol);
    if (!price) {
      logThinking('error', `BUY rejected: No price data for ${symbol}`, { symbol });
      return res.status(400).json({ error: `No price data for ${symbol}` });
    }

    const portfolio = loadPortfolio();
    const cost = shares * price;

    if (cost > portfolio.cash) {
      logThinking('error', `BUY rejected: Insufficient funds`, { symbol, cost, cash: portfolio.cash });
      return res.status(400).json({ error: 'Insufficient funds' });
    }

    if (Object.keys(portfolio.positions).length >= CONFIG.MAX_POSITIONS) {
      logThinking('error', `BUY rejected: Max positions reached`, { symbol });
      return res.status(400).json({ error: 'Maximum positions reached' });
    }

    // Execute buy
    portfolio.cash -= cost;
    const positionKey = `${symbol}-5-years`;

    if (portfolio.positions[positionKey]) {
      // Add to existing position
      const existing = portfolio.positions[positionKey];
      const totalShares = existing.shares + shares;
      const avgPrice = ((existing.shares * existing.entryPrice) + cost) / totalShares;
      portfolio.positions[positionKey] = {
        ...existing,
        shares: totalShares,
        entryPrice: avgPrice,
        stopLoss: avgPrice * (1 - CONFIG.STOP_LOSS_PERCENT),
        takeProfit: avgPrice * (1 + CONFIG.TAKE_PROFIT_PERCENT)
      };
    } else {
      // New position
      portfolio.positions[positionKey] = {
        shares,
        entryPrice: price,
        entryDate: new Date().toISOString(),
        stopLoss: price * (1 - CONFIG.STOP_LOSS_PERCENT),
        takeProfit: price * (1 + CONFIG.TAKE_PROFIT_PERCENT),
        confidence: null // Manual trade
      };
    }

    // Log trade
    const trade = {
      type: 'BUY',
      symbol: positionKey,
      shares,
      price,
      value: cost,
      confidence: null,
      reason: 'MANUAL',
      timestamp: new Date().toISOString()
    };
    portfolio.tradeHistory.push(trade);
    savePortfolio(portfolio);

    logThinking('trade', `MANUAL BUY executed: ${shares} ${symbol} @ $${price.toFixed(2)}`, {
      symbol, shares, price, cost
    });

    res.json({ success: true, trade });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// API: Manual SELL
app.post('/api/trade/sell', (req, res) => {
  try {
    const { symbol, shares } = req.body;
    if (!symbol || !shares || shares <= 0) {
      return res.status(400).json({ error: 'Invalid symbol or shares' });
    }

    const portfolio = loadPortfolio();
    const positionKey = `${symbol}-5-years`;
    const position = portfolio.positions[positionKey];

    if (!position) {
      logThinking('error', `SELL rejected: No position in ${symbol}`, { symbol });
      return res.status(400).json({ error: `No position in ${symbol}` });
    }

    if (shares > position.shares) {
      logThinking('error', `SELL rejected: Not enough shares`, { symbol, requested: shares, held: position.shares });
      return res.status(400).json({ error: `Only holding ${position.shares} shares` });
    }

    const price = getCurrentPrice(symbol);
    if (!price) {
      logThinking('error', `SELL rejected: No price data for ${symbol}`, { symbol });
      return res.status(400).json({ error: `No price data for ${symbol}` });
    }

    // Execute sell
    const proceeds = shares * price;
    const costBasis = shares * position.entryPrice;
    const pnl = proceeds - costBasis;
    const pnlPercent = (pnl / costBasis) * 100;

    portfolio.cash += proceeds;

    if (shares === position.shares) {
      delete portfolio.positions[positionKey];
    } else {
      portfolio.positions[positionKey].shares -= shares;
    }

    // Log trade
    const trade = {
      type: 'SELL',
      symbol: positionKey,
      shares,
      price,
      value: proceeds,
      pnl,
      pnlPercent,
      reason: 'MANUAL',
      timestamp: new Date().toISOString()
    };
    portfolio.tradeHistory.push(trade);
    savePortfolio(portfolio);

    logThinking('trade', `MANUAL SELL executed: ${shares} ${symbol} @ $${price.toFixed(2)} (P&L: $${pnl.toFixed(2)})`, {
      symbol, shares, price, proceeds, pnl, pnlPercent
    });

    res.json({ success: true, trade });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// API: Close position entirely
app.post('/api/trade/close', (req, res) => {
  try {
    const { symbol } = req.body;
    const portfolio = loadPortfolio();
    const positionKey = `${symbol}-5-years`;
    const position = portfolio.positions[positionKey];

    if (!position) {
      return res.status(400).json({ error: `No position in ${symbol}` });
    }

    // Delegate to sell with all shares
    req.body.shares = position.shares;
    return app._router.handle({ ...req, url: '/api/trade/sell', method: 'POST' }, res, () => {});
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// API: Get available symbols
app.get('/api/symbols', (req, res) => {
  try {
    const dataDir = path.join(__dirname, 'historical-data');
    if (!fs.existsSync(dataDir)) {
      return res.json([]);
    }
    const files = fs.readdirSync(dataDir);
    const symbols = files
      .filter(f => f.endsWith('.json'))
      .map(f => f.replace('-5-years.json', '').replace('.json', ''))
      .filter(s => !s.includes('-5-years'));
    res.json([...new Set(symbols)]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Simulate model thinking (runs periodically)
function simulateModelThinking() {
  const signals = [
    { symbol: 'AAPL', score: 0.469, rf: 0.512, nn: 0.405 },
    { symbol: 'NVDA', score: 0.468, rf: 0.511, nn: 0.405 },
    { symbol: 'AMD', score: 0.462, rf: 0.501, nn: 0.405 },
    { symbol: 'ABNB', score: 0.455, rf: 0.488, nn: 0.405 },
    { symbol: 'UBER', score: 0.454, rf: 0.487, nn: 0.405 },
    { symbol: 'BA', score: 0.451, rf: 0.481, nn: 0.405 }
  ];

  const portfolio = loadPortfolio();

  logThinking('analysis', 'Scanning market for trading opportunities...', {
    cash: portfolio.cash,
    openPositions: Object.keys(portfolio.positions).length
  });

  // Analyze each signal
  signals.forEach(signal => {
    const meetsThreshold = signal.score >= CONFIG.MIN_CONFIDENCE;
    const positionKey = `${signal.symbol}-5-years`;
    const hasPosition = !!portfolio.positions[positionKey];

    if (meetsThreshold && !hasPosition) {
      logThinking('signal', `${signal.symbol}: BUY signal (${(signal.score * 100).toFixed(1)}% confidence)`, {
        symbol: signal.symbol,
        ensemble: signal.score,
        randomForest: signal.rf,
        neuralNet: signal.nn,
        threshold: CONFIG.MIN_CONFIDENCE,
        action: 'Would open position'
      });
    } else if (meetsThreshold && hasPosition) {
      logThinking('hold', `${signal.symbol}: Holding position (${(signal.score * 100).toFixed(1)}% confidence still valid)`, {
        symbol: signal.symbol,
        ensemble: signal.score
      });
    } else if (!meetsThreshold) {
      logThinking('skip', `${signal.symbol}: Below threshold (${(signal.score * 100).toFixed(1)}% < ${(CONFIG.MIN_CONFIDENCE * 100).toFixed(1)}%)`, {
        symbol: signal.symbol,
        ensemble: signal.score,
        threshold: CONFIG.MIN_CONFIDENCE
      });
    }
  });

  // Check existing positions for stop loss / take profit
  Object.entries(portfolio.positions).forEach(([positionKey, position]) => {
    const symbol = positionKey.replace('-5-years', '');
    const currentPrice = getCurrentPrice(symbol);
    if (!currentPrice) return;

    const pnlPercent = ((currentPrice - position.entryPrice) / position.entryPrice) * 100;

    if (currentPrice <= position.stopLoss) {
      logThinking('alert', `${symbol}: STOP LOSS triggered! Price $${currentPrice.toFixed(2)} <= $${position.stopLoss.toFixed(2)}`, {
        symbol, currentPrice, stopLoss: position.stopLoss, pnlPercent
      });
    } else if (currentPrice >= position.takeProfit) {
      logThinking('alert', `${symbol}: TAKE PROFIT triggered! Price $${currentPrice.toFixed(2)} >= $${position.takeProfit.toFixed(2)}`, {
        symbol, currentPrice, takeProfit: position.takeProfit, pnlPercent
      });
    } else {
      logThinking('monitor', `${symbol}: Monitoring position (${pnlPercent >= 0 ? '+' : ''}${pnlPercent.toFixed(2)}%)`, {
        symbol, currentPrice, entryPrice: position.entryPrice, pnlPercent
      });
    }
  });
}

// Run model thinking simulation every 30 seconds
setInterval(simulateModelThinking, 30000);
simulateModelThinking(); // Run once on startup

app.listen(PORT, () => {
  console.log(`Neural Trader Dashboard running at http://localhost:${PORT}`);
});
