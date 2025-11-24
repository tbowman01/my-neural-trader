const tf = require('@tensorflow/tfjs-node-gpu');
const fs = require('fs');
const path = require('path');
const EnhancedFeatures = require('../lib/enhanced-features');

// ═══════════════════════════════════════════════════════════════════
//   PHASE 5 BACKTEST: HISTORICAL PERFORMANCE WITH RISK MANAGEMENT
// ═══════════════════════════════════════════════════════════════════
//
// This backtest shows how the Phase 5 model would have performed
// historically using proper risk management rules:
//
// - Only trade signals with 45%+ confidence
// - Position size: 3% of capital per trade
// - Stop loss: 4% below entry
// - Take profit: 2.5% gain (conservative, above 1.80% target)
// - Max positions: 10 concurrent trades
// - Hold period: 5 days (model's prediction window)
//
// ═══════════════════════════════════════════════════════════════════

(async () => {

console.log('═══════════════════════════════════════════════════════════════════');
console.log('   PHASE 5 BACKTEST: HISTORICAL PERFORMANCE ANALYSIS');
console.log('═══════════════════════════════════════════════════════════════════');
console.log('');

// Configuration
const CONFIG = {
  INITIAL_CAPITAL: 100000,
  MIN_CONFIDENCE: 0.45,        // Only trade 45%+ confidence
  POSITION_SIZE_PCT: 0.03,     // 3% per trade
  STOP_LOSS_PCT: 0.04,         // 4% stop loss
  TAKE_PROFIT_PCT: 0.025,      // 2.5% take profit
  MAX_POSITIONS: 10,
  HOLD_DAYS: 5,                // 5-day prediction window
  COMMISSION_PCT: 0.001        // 0.1% commission per trade
};

console.log('Backtest Configuration:');
console.log(`  Initial Capital:     $${CONFIG.INITIAL_CAPITAL.toLocaleString()}`);
console.log(`  Min Confidence:      ${(CONFIG.MIN_CONFIDENCE * 100).toFixed(0)}%`);
console.log(`  Position Size:       ${(CONFIG.POSITION_SIZE_PCT * 100).toFixed(1)}% per trade`);
console.log(`  Stop Loss:           ${(CONFIG.STOP_LOSS_PCT * 100).toFixed(1)}%`);
console.log(`  Take Profit:         ${(CONFIG.TAKE_PROFIT_PCT * 100).toFixed(1)}%`);
console.log(`  Max Positions:       ${CONFIG.MAX_POSITIONS}`);
console.log(`  Hold Period:         ${CONFIG.HOLD_DAYS} days`);
console.log('');

// Load Phase 5 model and parameters
console.log('[1] Loading Phase 5 model...');
const model = await tf.loadLayersModel('file://./models/phase5-multiday/model.json');
const normParams = JSON.parse(fs.readFileSync('./models/phase5-normalization.json', 'utf8'));
const { means, stds, featureNames } = normParams;
console.log('✓ Model loaded');

// Load market data
console.log('\n[2] Loading market data...');
const dataDir = path.join(__dirname, '..', 'historical-data');
const files = fs.readdirSync(dataDir).filter(f => f.endsWith('-5-years.json'));

const allData = {};
for (const file of files) {
  const symbol = file.replace('.json', '');
  const data = JSON.parse(fs.readFileSync(path.join(dataDir, file), 'utf8'));
  if (data.length > 300) {
    allData[symbol] = data;
  }
}

console.log(`Loaded ${Object.keys(allData).length} symbols`);

// Use last 2 years for backtesting (2022-2024)
// This is out-of-sample data not used in training
const testStartDate = new Date('2022-01-01');
const testEndDate = new Date('2024-11-01');

console.log(`\nBacktest Period: ${testStartDate.toISOString().split('T')[0]} to ${testEndDate.toISOString().split('T')[0]}`);

// Portfolio tracking
let capital = CONFIG.INITIAL_CAPITAL;
let positions = []; // { symbol, shares, entryPrice, entryDate, confidence, stopLoss, takeProfit }
const trades = [];
const dailyCapital = [];

// Get all unique dates across all symbols
const allDates = new Set();
for (const [symbol, bars] of Object.entries(allData)) {
  bars.forEach(bar => {
    const date = new Date(bar.date);
    if (date >= testStartDate && date <= testEndDate) {
      allDates.add(bar.date);
    }
  });
}

const sortedDates = Array.from(allDates).sort();

console.log(`\n[3] Running backtest over ${sortedDates.length} trading days...`);

// Backtest loop
for (let dateIdx = 0; dateIdx < sortedDates.length; dateIdx++) {
  const currentDate = sortedDates[dateIdx];

  // Progress indicator
  if (dateIdx % 50 === 0) {
    const progress = ((dateIdx / sortedDates.length) * 100).toFixed(1);
    process.stdout.write(`\r  Progress: ${progress}% (${dateIdx}/${sortedDates.length} days)`);
  }

  // Check and close positions
  for (let i = positions.length - 1; i >= 0; i--) {
    const pos = positions[i];

    // Get current price
    const symbolData = allData[pos.symbol];
    if (!symbolData) continue;

    const barIdx = symbolData.findIndex(b => b.date === currentDate);
    if (barIdx === -1) continue;

    const currentPrice = symbolData[barIdx].close;
    const daysHeld = Math.floor((new Date(currentDate) - new Date(pos.entryDate)) / (1000 * 60 * 60 * 24));

    let shouldClose = false;
    let closeReason = '';

    // Check stop loss
    if (currentPrice <= pos.stopLoss) {
      shouldClose = true;
      closeReason = 'STOP_LOSS';
    }
    // Check take profit
    else if (currentPrice >= pos.takeProfit) {
      shouldClose = true;
      closeReason = 'TAKE_PROFIT';
    }
    // Check hold period
    else if (daysHeld >= CONFIG.HOLD_DAYS) {
      shouldClose = true;
      closeReason = 'HOLD_PERIOD';
    }

    if (shouldClose) {
      const positionValue = pos.shares * currentPrice;
      const commission = positionValue * CONFIG.COMMISSION_PCT;
      const netValue = positionValue - commission;
      const pnl = netValue - pos.costBasis;
      const pnlPct = (pnl / pos.costBasis) * 100;

      capital += netValue;

      trades.push({
        symbol: pos.symbol,
        entryDate: pos.entryDate,
        exitDate: currentDate,
        entryPrice: pos.entryPrice,
        exitPrice: currentPrice,
        shares: pos.shares,
        confidence: pos.confidence,
        pnl: pnl,
        pnlPct: pnlPct,
        reason: closeReason,
        daysHeld: daysHeld
      });

      positions.splice(i, 1);
    }
  }

  // Generate signals for current date
  if (positions.length < CONFIG.MAX_POSITIONS) {
    const signals = [];

    for (const [symbol, bars] of Object.entries(allData)) {
      // Find today's bar
      const barIdx = bars.findIndex(b => b.date === currentDate);
      if (barIdx === -1 || barIdx < 250) continue; // Need history for indicators

      // Check if we already have a position
      if (positions.some(p => p.symbol === symbol)) continue;

      // Generate features
      const features = EnhancedFeatures.generateAllFeatures(bars.slice(0, barIdx + 1));
      if (features.length === 0) continue;

      const lastFeature = features[features.length - 1];

      // Check all features present
      const hasAllFeatures = lastFeature.sma200 !== null &&
                            lastFeature.rsi !== null &&
                            lastFeature.macdLine !== null &&
                            lastFeature.bbPosition !== null &&
                            lastFeature.atr !== null &&
                            lastFeature.mfi !== null;

      if (!hasAllFeatures) continue;

      // Get prediction
      const row = featureNames.map(name => lastFeature[name] || 0);
      const normalized = row.map((val, col) => (val - means[col]) / stds[col]);

      const inputTensor = tf.tensor2d([normalized]);
      const predTensor = model.predict(inputTensor);
      const predArray = await predTensor.array();
      const confidence = predArray[0][0];

      inputTensor.dispose();
      predTensor.dispose();

      // Only consider high-confidence signals
      if (confidence >= CONFIG.MIN_CONFIDENCE) {
        signals.push({
          symbol: symbol,
          confidence: confidence,
          price: bars[barIdx].close,
          date: currentDate
        });
      }
    }

    // Sort by confidence and take top signals
    signals.sort((a, b) => b.confidence - a.confidence);
    const positionsToOpen = Math.min(signals.length, CONFIG.MAX_POSITIONS - positions.length);

    for (let i = 0; i < positionsToOpen; i++) {
      const signal = signals[i];
      const positionValue = capital * CONFIG.POSITION_SIZE_PCT;
      const shares = Math.floor(positionValue / signal.price);

      if (shares > 0) {
        const costBasis = shares * signal.price;
        const commission = costBasis * CONFIG.COMMISSION_PCT;
        const totalCost = costBasis + commission;

        if (totalCost <= capital) {
          capital -= totalCost;

          positions.push({
            symbol: signal.symbol,
            shares: shares,
            entryPrice: signal.price,
            entryDate: signal.date,
            confidence: signal.confidence,
            stopLoss: signal.price * (1 - CONFIG.STOP_LOSS_PCT),
            takeProfit: signal.price * (1 + CONFIG.TAKE_PROFIT_PCT),
            costBasis: costBasis + commission
          });
        }
      }
    }
  }

  // Track daily capital
  let portfolioValue = capital;
  for (const pos of positions) {
    const symbolData = allData[pos.symbol];
    const barIdx = symbolData.findIndex(b => b.date === currentDate);
    if (barIdx !== -1) {
      portfolioValue += pos.shares * symbolData[barIdx].close;
    }
  }

  dailyCapital.push({
    date: currentDate,
    capital: portfolioValue
  });
}

console.log('\n\n[4] Calculating performance metrics...');

// Close any remaining positions at end
for (const pos of positions) {
  const symbolData = allData[pos.symbol];
  const lastBar = symbolData[symbolData.length - 1];
  const exitPrice = lastBar.close;

  const positionValue = pos.shares * exitPrice;
  const commission = positionValue * CONFIG.COMMISSION_PCT;
  const netValue = positionValue - commission;
  const pnl = netValue - pos.costBasis;
  const pnlPct = (pnl / pos.costBasis) * 100;

  capital += netValue;

  trades.push({
    symbol: pos.symbol,
    entryDate: pos.entryDate,
    exitDate: lastBar.date,
    entryPrice: pos.entryPrice,
    exitPrice: exitPrice,
    shares: pos.shares,
    confidence: pos.confidence,
    pnl: pnl,
    pnlPct: pnlPct,
    reason: 'END_OF_BACKTEST',
    daysHeld: Math.floor((new Date(lastBar.date) - new Date(pos.entryDate)) / (1000 * 60 * 60 * 24))
  });
}

// Calculate metrics
const finalCapital = capital;
const totalReturn = ((finalCapital - CONFIG.INITIAL_CAPITAL) / CONFIG.INITIAL_CAPITAL) * 100;
const winningTrades = trades.filter(t => t.pnl > 0);
const losingTrades = trades.filter(t => t.pnl <= 0);
const winRate = (winningTrades.length / trades.length) * 100;

const avgWin = winningTrades.length > 0
  ? winningTrades.reduce((sum, t) => sum + t.pnlPct, 0) / winningTrades.length
  : 0;
const avgLoss = losingTrades.length > 0
  ? losingTrades.reduce((sum, t) => sum + t.pnlPct, 0) / losingTrades.length
  : 0;

// Calculate max drawdown
let peak = CONFIG.INITIAL_CAPITAL;
let maxDrawdown = 0;
for (const day of dailyCapital) {
  if (day.capital > peak) peak = day.capital;
  const drawdown = ((peak - day.capital) / peak) * 100;
  if (drawdown > maxDrawdown) maxDrawdown = drawdown;
}

// Sharpe ratio (simplified)
const returns = [];
for (let i = 1; i < dailyCapital.length; i++) {
  const ret = ((dailyCapital[i].capital - dailyCapital[i-1].capital) / dailyCapital[i-1].capital) * 100;
  returns.push(ret);
}
const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
const stdDev = Math.sqrt(returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length);
const sharpeRatio = (avgReturn / stdDev) * Math.sqrt(252); // Annualized

// Print results
console.log('\n═══════════════════════════════════════════════════════════════════');
console.log('                    BACKTEST RESULTS');
console.log('═══════════════════════════════════════════════════════════════════');
console.log('\nOVERALL PERFORMANCE:');
console.log(`  Initial Capital:    $${CONFIG.INITIAL_CAPITAL.toLocaleString()}`);
console.log(`  Final Capital:      $${finalCapital.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`);
console.log(`  Total Return:       ${totalReturn >= 0 ? '+' : ''}${totalReturn.toFixed(2)}%`);
console.log(`  Max Drawdown:       ${maxDrawdown.toFixed(2)}%`);
console.log(`  Sharpe Ratio:       ${sharpeRatio.toFixed(2)}`);

console.log('\nTRADING STATISTICS:');
console.log(`  Total Trades:       ${trades.length}`);
console.log(`  Winning Trades:     ${winningTrades.length} (${winRate.toFixed(1)}%)`);
console.log(`  Losing Trades:      ${losingTrades.length}`);
console.log(`  Average Win:        +${avgWin.toFixed(2)}%`);
console.log(`  Average Loss:       ${avgLoss.toFixed(2)}%`);
console.log(`  Profit Factor:      ${(Math.abs(avgWin * winningTrades.length) / Math.abs(avgLoss * losingTrades.length)).toFixed(2)}`);

// Break down by close reason
const byReason = {
  TAKE_PROFIT: trades.filter(t => t.reason === 'TAKE_PROFIT'),
  STOP_LOSS: trades.filter(t => t.reason === 'STOP_LOSS'),
  HOLD_PERIOD: trades.filter(t => t.reason === 'HOLD_PERIOD'),
  END_OF_BACKTEST: trades.filter(t => t.reason === 'END_OF_BACKTEST')
};

console.log('\nEXIT REASONS:');
console.log(`  Take Profit:        ${byReason.TAKE_PROFIT.length} trades`);
console.log(`  Stop Loss:          ${byReason.STOP_LOSS.length} trades`);
console.log(`  Hold Period:        ${byReason.HOLD_PERIOD.length} trades`);
console.log(`  End of Test:        ${byReason.END_OF_BACKTEST.length} trades`);

// Show top 10 best and worst trades
console.log('\n═══════════════════════════════════════════════════════════════════');
console.log('                    TOP 10 BEST TRADES');
console.log('═══════════════════════════════════════════════════════════════════');
const sortedTrades = [...trades].sort((a, b) => b.pnlPct - a.pnlPct);
sortedTrades.slice(0, 10).forEach((trade, idx) => {
  console.log(`${(idx + 1).toString().padStart(2)}. ${trade.symbol.padEnd(15)} | ${trade.entryDate} → ${trade.exitDate} | ${(trade.confidence * 100).toFixed(1)}% conf | ${trade.pnlPct >= 0 ? '+' : ''}${trade.pnlPct.toFixed(2)}% | ${trade.reason}`);
});

console.log('\n═══════════════════════════════════════════════════════════════════');
console.log('                    TOP 10 WORST TRADES');
console.log('═══════════════════════════════════════════════════════════════════');
sortedTrades.slice(-10).reverse().forEach((trade, idx) => {
  console.log(`${(idx + 1).toString().padStart(2)}. ${trade.symbol.padEnd(15)} | ${trade.entryDate} → ${trade.exitDate} | ${(trade.confidence * 100).toFixed(1)}% conf | ${trade.pnlPct >= 0 ? '+' : ''}${trade.pnlPct.toFixed(2)}% | ${trade.reason}`);
});

// Compare with buy & hold SPY
const spyData = allData['SPY-5-years'];
const spyStart = spyData.find(b => b.date >= testStartDate.toISOString().split('T')[0]);
const spyEnd = spyData[spyData.length - 1];
const spyReturn = ((spyEnd.close - spyStart.close) / spyStart.close) * 100;

console.log('\n═══════════════════════════════════════════════════════════════════');
console.log('                    BENCHMARK COMPARISON');
console.log('═══════════════════════════════════════════════════════════════════');
console.log('\nPhase 5 Strategy:');
console.log(`  Return:             ${totalReturn >= 0 ? '+' : ''}${totalReturn.toFixed(2)}%`);
console.log(`  Max Drawdown:       ${maxDrawdown.toFixed(2)}%`);
console.log(`  Sharpe Ratio:       ${sharpeRatio.toFixed(2)}`);
console.log(`  Win Rate:           ${winRate.toFixed(1)}%`);
console.log('');
console.log('SPY Buy & Hold:');
console.log(`  Return:             ${spyReturn >= 0 ? '+' : ''}${spyReturn.toFixed(2)}%`);
console.log('');
if (totalReturn > spyReturn) {
  console.log(`✓ Outperformed SPY by ${(totalReturn - spyReturn).toFixed(2)} percentage points!`);
} else {
  console.log(`  Underperformed SPY by ${(spyReturn - totalReturn).toFixed(2)} percentage points`);
}

console.log('\n═══════════════════════════════════════════════════════════════════');
console.log('');

// Cleanup
model.dispose();

console.log('✓ Backtest complete!');
console.log('');

})().catch(console.error);
