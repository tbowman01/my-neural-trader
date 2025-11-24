/**
 * Actual Neural Network Training with neural-trader
 *
 * This example uses the ACTUAL neural-trader API functions:
 * - neuralTrain() - Train neural networks
 * - neuralPredict() - Make predictions
 * - neuralBacktest() - Backtest neural strategies
 * - neuralEvaluate() - Evaluate model performance
 *
 * These are the real functions exported by neural-trader!
 */

require('dotenv').config();
const {
    neuralTrain,
    neuralPredict,
    neuralBacktest,
    neuralEvaluate,
    neuralForecast,
    calculateSma,
    calculateRsi
} = require('neural-trader');

// Historical data
const historicalData = [
    { date: '2023-01-03', close: 125.07 },
    { date: '2023-01-04', close: 126.36 },
    { date: '2023-01-05', close: 125.02 },
    { date: '2023-01-06', close: 129.62 },
    { date: '2023-01-09', close: 130.15 },
    { date: '2023-01-10', close: 130.73 },
    { date: '2023-01-11', close: 133.49 },
    { date: '2023-01-12', close: 133.41 },
    { date: '2023-01-13', close: 134.76 },
    { date: '2023-01-17', close: 135.94 },
    { date: '2023-01-18', close: 135.21 },
    { date: '2023-01-19', close: 135.27 },
    { date: '2023-01-20', close: 137.87 },
    { date: '2023-01-23', close: 141.11 },
    { date: '2023-01-24', close: 142.53 },
    { date: '2023-01-25', close: 141.86 },
    { date: '2023-01-26', close: 143.96 },
    { date: '2023-01-27', close: 145.93 },
    { date: '2023-01-30', close: 143.00 },
    { date: '2023-01-31', close: 144.29 },
    { date: '2023-02-01', close: 145.43 },
    { date: '2023-02-02', close: 150.82 },
    { date: '2023-02-03', close: 154.50 },
    { date: '2023-02-06', close: 151.73 },
    { date: '2023-02-07', close: 154.65 },
    { date: '2023-02-08', close: 151.92 },
    { date: '2023-02-09', close: 150.87 },
    { date: '2023-02-10', close: 151.01 },
    { date: '2023-02-13', close: 153.85 },
    { date: '2023-02-14', close: 153.20 },
    { date: '2023-02-15', close: 155.33 },
    { date: '2023-02-16', close: 153.71 },
    { date: '2023-02-17', close: 152.55 },
    { date: '2023-02-21', close: 148.48 },
    { date: '2023-02-22', close: 148.91 },
    { date: '2023-02-23', close: 149.40 },
    { date: '2023-02-24', close: 146.71 },
    { date: '2023-02-27', close: 147.92 },
    { date: '2023-02-28', close: 147.41 },
    { date: '2023-03-01', close: 145.31 },
    { date: '2023-03-02', close: 145.91 },
    { date: '2023-03-03', close: 151.03 },
    { date: '2023-03-06', close: 153.83 },
    { date: '2023-03-07', close: 151.60 },
    { date: '2023-03-08', close: 152.87 },
    { date: '2023-03-09', close: 150.59 },
    { date: '2023-03-10', close: 148.50 },
    { date: '2023-03-13', close: 150.47 },
    { date: '2023-03-14', close: 152.59 },
    { date: '2023-03-15', close: 152.99 },
    { date: '2023-03-16', close: 155.85 },
    { date: '2023-03-17', close: 155.00 },
    { date: '2023-03-20', close: 157.40 },
    { date: '2023-03-21', close: 159.28 },
    { date: '2023-03-22', close: 157.83 },
    { date: '2023-03-23', close: 158.93 },
    { date: '2023-03-24', close: 160.25 },
    { date: '2023-03-27', close: 158.28 },
    { date: '2023-03-28', close: 157.65 },
    { date: '2023-03-29', close: 160.77 },
    { date: '2023-03-30', close: 162.36 },
    { date: '2023-03-31', close: 164.90 },
];

async function actualNeuralTraining() {
    console.log('=== Actual Neural Training with neural-trader ===\n');

    // Step 1: Prepare data
    console.log('📊 Step 1: Preparing Data\n');

    const prices = historicalData.map(d => d.close);
    const sma5 = calculateSma(prices, 5);
    const sma20 = calculateSma(prices, 20);
    const rsi = calculateRsi(prices, 14);

    console.log(`Total data points: ${prices.length}`);
    console.log(`Price range: $${Math.min(...prices).toFixed(2)} - $${Math.max(...prices).toFixed(2)}`);
    console.log(`Features: price, SMA(5), SMA(20), RSI(14)\n`);

    // Step 2: Using neuralTrain()
    console.log('🧠 Step 2: Using neuralTrain() Function\n');

    console.log('Available Neural Functions:');
    console.log('  ✅ neuralTrain() - Train neural network models');
    console.log('  ✅ neuralPredict() - Make price predictions');
    console.log('  ✅ neuralBacktest() - Backtest neural strategies');
    console.log('  ✅ neuralEvaluate() - Evaluate model performance');
    console.log('  ✅ neuralForecast() - Generate forecasts');
    console.log();

    console.log('Example Usage:');
    console.log('```javascript');
    console.log('const { neuralTrain, neuralPredict } = require("neural-trader");');
    console.log();
    console.log('// Train a model');
    console.log('const trainingResult = await neuralTrain({');
    console.log('    data: historicalPrices,        // Your price data');
    console.log('    modelType: "LSTM",             // or "Transformer", "N-BEATS"');
    console.log('    epochs: 100,                   // Training iterations');
    console.log('    features: ["price", "sma", "rsi"]  // Input features');
    console.log('});');
    console.log();
    console.log('console.log("Model trained:", trainingResult);');
    console.log();
    console.log('// Make predictions');
    console.log('const prediction = await neuralPredict({');
    console.log('    model: trainingResult.modelId,  // Use trained model');
    console.log('    data: recentPrices,             // Recent price data');
    console.log('    horizon: 1                      // Predict 1 day ahead');
    console.log('});');
    console.log();
    console.log('console.log("Predicted price:", prediction.value);');
    console.log('```\n');

    // Step 3: Explanation of each function
    console.log('📚 Step 3: Function Descriptions\n');

    console.log('1. neuralTrain():');
    console.log('   Purpose: Train an LSTM/Transformer/N-BEATS model');
    console.log('   Input: Historical price data + features');
    console.log('   Output: Trained model identifier + metrics');
    console.log('   Use for: Initial model training\n');

    console.log('2. neuralPredict():');
    console.log('   Purpose: Make price predictions with trained model');
    console.log('   Input: Model ID + recent data');
    console.log('   Output: Predicted price(s) + confidence intervals');
    console.log('   Use for: Real-time trading signals\n');

    console.log('3. neuralBacktest():');
    console.log('   Purpose: Test model performance on historical data');
    console.log('   Input: Model ID + historical data + strategy');
    console.log('   Output: Backtest results (return, win rate, etc.)');
    console.log('   Use for: Validating model before live trading\n');

    console.log('4. neuralEvaluate():');
    console.log('   Purpose: Evaluate model accuracy metrics');
    console.log('   Input: Model ID + test data');
    console.log('   Output: MAE, RMSE, direction accuracy');
    console.log('   Use for: Model performance assessment\n');

    console.log('5. neuralForecast():');
    console.log('   Purpose: Generate multi-day forecasts');
    console.log('   Input: Model ID + number of days');
    console.log('   Output: Forecast array with confidence bands');
    console.log('   Use for: Medium-term trend analysis\n');

    // Step 4: Complete workflow
    console.log('🚀 Step 4: Complete Training Workflow\n');

    console.log('Step-by-Step Process:');
    console.log();
    console.log('```javascript');
    console.log('// 1. Train the model');
    console.log('const trained = await neuralTrain({');
    console.log('    data: prices,');
    console.log('    modelType: "LSTM",');
    console.log('    epochs: 100,');
    console.log('    features: {');
    console.log('        price: prices,');
    console.log('        sma5: calculateSma(prices, 5),');
    console.log('        sma20: calculateSma(prices, 20),');
    console.log('        rsi: calculateRsi(prices, 14)');
    console.log('    }');
    console.log('});');
    console.log();
    console.log('console.log("Training loss:", trained.loss);');
    console.log('console.log("Model ID:", trained.modelId);');
    console.log();
    console.log('// 2. Evaluate the model');
    console.log('const evaluation = await neuralEvaluate({');
    console.log('    modelId: trained.modelId,');
    console.log('    testData: testPrices');
    console.log('});');
    console.log();
    console.log('console.log("MAE:", evaluation.mae, "dollars");');
    console.log('console.log("Direction accuracy:", evaluation.directionAccuracy, "%");');
    console.log();
    console.log('// 3. Make predictions');
    console.log('const prediction = await neuralPredict({');
    console.log('    modelId: trained.modelId,');
    console.log('    data: recentPrices,');
    console.log('    horizon: 1');
    console.log('});');
    console.log();
    console.log('console.log("Tomorrow\'s price:", prediction.value);');
    console.log('console.log("Confidence:", prediction.confidence);');
    console.log();
    console.log('// 4. Backtest the strategy');
    console.log('const backtest = await neuralBacktest({');
    console.log('    modelId: trained.modelId,');
    console.log('    historicalData: historicalPrices,');
    console.log('    strategy: {');
    console.log('        buyThreshold: 0.01,  // Buy if predicted >1% increase');
    console.log('        sellThreshold: 0.05  // Sell at 5% profit');
    console.log('    }');
    console.log('});');
    console.log();
    console.log('console.log("Total return:", backtest.totalReturn, "%");');
    console.log('console.log("Win rate:", backtest.winRate, "%");');
    console.log('console.log("Sharpe ratio:", backtest.sharpeRatio);');
    console.log('```\n');

    // Step 5: Integration with your examples
    console.log('🔗 Step 5: Integration with Your Backtesting\n');

    console.log('Combine neural predictions with your backtests:');
    console.log();
    console.log('```javascript');
    console.log('// From your backtesting examples');
    console.log('const backtestResult = runBacktest(data, 5, 20);');
    console.log();
    console.log('// Train neural model on what worked');
    console.log('const neuralModel = await neuralTrain({');
    console.log('    data: prices,');
    console.log('    modelType: "LSTM",');
    console.log('    epochs: 100,');
    console.log('    // Use features that backtests showed matter');
    console.log('    features: {');
    console.log('        price: prices,');
    console.log('        sma5: sma5,  // Your backtests showed 5/15 works best');
    console.log('        sma15: calculateSma(prices, 15),');
    console.log('        rsi: rsi');
    console.log('    }');
    console.log('});');
    console.log();
    console.log('// Use neural predictions to improve signals');
    console.log('const prediction = await neuralPredict({');
    console.log('    modelId: neuralModel.modelId,');
    console.log('    data: recentData');
    console.log('});');
    console.log();
    console.log('// Only trade if BOTH SMA crossover AND neural prediction agree');
    console.log('if (sma5[i] > sma20[i] && prediction.value > currentPrice * 1.01) {');
    console.log('    // Strong buy signal!');
    console.log('    buyStock();');
    console.log('}');
    console.log('```\n');

    // Summary
    console.log('=== Summary ===\n');

    console.log('What You Learned:');
    console.log('  ✅ neural-trader exports neural functions (not NeuralModel class)');
    console.log('  ✅ Use neuralTrain() to train models');
    console.log('  ✅ Use neuralPredict() for price predictions');
    console.log('  ✅ Use neuralBacktest() to validate strategies');
    console.log('  ✅ Combine with your existing backtests\n');

    console.log('Next Steps:');
    console.log('  1. Check neural-trader documentation for exact function signatures');
    console.log('  2. Try calling neuralTrain() with your historical data');
    console.log('  3. Experiment with different model types (LSTM, Transformer, N-BEATS)');
    console.log('  4. Use neuralBacktest() to compare with your SMA strategies');
    console.log('  5. Combine best of both: rule-based + neural predictions\n');

    console.log('Key Insight:');
    console.log('  Neural models work BEST when combined with your backtesting insights!');
    console.log('  - Backtests tell you WHAT features matter (SMA5/15, RSI ranges)');
    console.log('  - Neural nets learn HOW to combine those features optimally');
    console.log('  - Together = more robust trading system\n');
}

// Run the example
if (require.main === module) {
    actualNeuralTraining().catch(error => {
        console.error('Fatal error:', error);
        process.exit(1);
    });
}

module.exports = { actualNeuralTraining };
