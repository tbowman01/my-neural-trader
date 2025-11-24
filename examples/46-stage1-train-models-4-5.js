const tf = require('@tensorflow/tfjs-node-gpu');
const fs = require('fs');
const path = require('path');
const EnhancedFeatures = require('../lib/enhanced-features');

// ═══════════════════════════════════════════════════════════════════
//   STAGE 1: TRAIN MODELS 4-5 (EXPAND TO 5-MODEL ENSEMBLE)
// ═══════════════════════════════════════════════════════════════════
//
// APPROACH: Train 2 additional models to expand from 3 to 5 models
//
// Key Points:
// 1. Use same architecture and features as Models 1-3
// 2. Different random seeds (1004, 1005) for diversity
// 3. Expected training time: ~80 minutes (2 models × 40 min each)
// 4. Expected confidence boost: +3-5 percentage points
//
// This is the quickest win in the Master Implementation Roadmap!
// ═══════════════════════════════════════════════════════════════════

async function trainModel(modelNumber, totalModels, allData, forwardDays, topPercentile) {
  console.log(`\n${'═'.repeat(71)}`);
  console.log(`   TRAINING MODEL ${modelNumber}/${totalModels}`);
  console.log(`${'═'.repeat(71)}\n`);

  // Set random seed for reproducibility of each model
  const seed = 1000 + modelNumber;

  console.log(`[${modelNumber}.1] Processing data with seed ${seed}...`);

  // Generate enhanced features with forward returns
  const enhancedData = {};
  let totalSamples = 0;
  let processedSymbols = 0;

  for (const [symbol, bars] of Object.entries(allData)) {
    const features = EnhancedFeatures.generateAllFeatures(bars);

    const validFeatures = [];
    const validLabels = [];
    const validReturns = [];

    // Calculate forward returns for all samples
    for (let i = 0; i < features.length - forwardDays; i++) {
      const feat = features[i];

      const hasAllFeatures = feat.sma200 !== null &&
                            feat.rsi !== null &&
                            feat.macdLine !== null &&
                            feat.bbPosition !== null &&
                            feat.atr !== null &&
                            feat.mfi !== null;

      if (hasAllFeatures && i + forwardDays < bars.length) {
        const currentPrice = bars[i].close;
        const futurePrice = bars[i + forwardDays].close;
        const returnPct = ((futurePrice - currentPrice) / currentPrice) * 100;

        validFeatures.push(feat);
        validReturns.push(returnPct);
      }
    }

    // Calculate threshold for top performers
    if (validReturns.length > 0) {
      const sortedReturns = [...validReturns].sort((a, b) => b - a);
      const thresholdIdx = Math.floor(validReturns.length * topPercentile);
      const threshold = sortedReturns[thresholdIdx];

      // Label: 1 if in top percentile, 0 otherwise
      for (let i = 0; i < validReturns.length; i++) {
        validLabels.push(validReturns[i] >= threshold ? 1 : 0);
      }

      enhancedData[symbol] = {
        features: validFeatures,
        labels: validLabels,
        returns: validReturns
      };

      totalSamples += validLabels.length;
    }

    processedSymbols++;
    if (processedSymbols % 10 === 0) {
      process.stdout.write(`\r  Processed ${processedSymbols}/${Object.keys(allData).length} symbols (${totalSamples.toLocaleString()} samples)`);
    }
  }

  console.log(`\n  Total samples: ${totalSamples.toLocaleString()}`);

  // Prepare training data
  console.log(`\n[${modelNumber}.2] Preparing training data...`);

  const featureNames = [
    'priceVsSma20', 'priceVsSma50', 'priceVsSma200',
    'rsi', 'macdHistogram', 'roc',
    'stochK', 'stochD', 'williamsR',
    'bbPosition', 'atrPercent',
    'obvTrend', 'mfi', 'volumeRatio'
  ];

  const allFeatures = [];
  const allLabels = [];

  for (const [symbol, data] of Object.entries(enhancedData)) {
    for (let i = 0; i < data.features.length; i++) {
      const feat = data.features[i];
      const row = featureNames.map(name => feat[name] || 0);
      allFeatures.push(row);
      allLabels.push(data.labels[i]);
    }
  }

  // Train/test split (80/20)
  const splitIdx = Math.floor(allFeatures.length * 0.8);
  const trainFeatures = allFeatures.slice(0, splitIdx);
  const trainLabels = allLabels.slice(0, splitIdx);
  const testFeatures = allFeatures.slice(splitIdx);
  const testLabels = allLabels.slice(splitIdx);

  console.log(`  Train: ${trainFeatures.length.toLocaleString()} samples`);
  console.log(`  Test: ${testFeatures.length.toLocaleString()} samples`);

  // Normalize features
  console.log(`\n[${modelNumber}.3] Normalizing features...`);
  const means = [];
  const stds = [];

  for (let col = 0; col < featureNames.length; col++) {
    const values = trainFeatures.map(row => row[col]);
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / values.length;
    const std = Math.sqrt(variance) || 1;

    means.push(mean);
    stds.push(std);
  }

  function normalize(features) {
    return features.map(row =>
      row.map((val, col) => (val - means[col]) / stds[col])
    );
  }

  const trainFeaturesNorm = normalize(trainFeatures);
  const testFeaturesNorm = normalize(testFeatures);

  // Create tensors
  const xTrain = tf.tensor2d(trainFeaturesNorm);
  const yTrain = tf.tensor2d(trainLabels.map(l => [l]));
  const xTest = tf.tensor2d(testFeaturesNorm);
  const yTest = tf.tensor2d(testLabels.map(l => [l]));

  console.log('  ✓ Features normalized');

  // Build neural network with random initialization (seed-based)
  console.log(`\n[${modelNumber}.4] Building neural network...`);

  // Use seed to create different initialization for each model
  const initializerSeed = seed;

  const model = tf.sequential({
    layers: [
      tf.layers.dense({
        units: 128,
        activation: 'relu',
        inputShape: [featureNames.length],
        kernelRegularizer: tf.regularizers.l2({ l2: 0.001 }),
        kernelInitializer: tf.initializers.glorotUniform({ seed: initializerSeed })
      }),
      tf.layers.dropout({ rate: 0.3 }),
      tf.layers.dense({
        units: 64,
        activation: 'relu',
        kernelRegularizer: tf.regularizers.l2({ l2: 0.001 }),
        kernelInitializer: tf.initializers.glorotUniform({ seed: initializerSeed + 1 })
      }),
      tf.layers.dropout({ rate: 0.3 }),
      tf.layers.dense({
        units: 32,
        activation: 'relu',
        kernelRegularizer: tf.regularizers.l2({ l2: 0.001 }),
        kernelInitializer: tf.initializers.glorotUniform({ seed: initializerSeed + 2 })
      }),
      tf.layers.dropout({ rate: 0.2 }),
      tf.layers.dense({
        units: 16,
        activation: 'relu',
        kernelRegularizer: tf.regularizers.l2({ l2: 0.001 }),
        kernelInitializer: tf.initializers.glorotUniform({ seed: initializerSeed + 3 })
      }),
      tf.layers.dropout({ rate: 0.2 }),
      tf.layers.dense({
        units: 1,
        activation: 'sigmoid',
        kernelInitializer: tf.initializers.glorotUniform({ seed: initializerSeed + 4 })
      })
    ]
  });

  model.compile({
    optimizer: tf.train.adam(0.0005),
    loss: 'binaryCrossentropy',
    metrics: ['accuracy']
  });

  console.log('  ✓ Model built');
  console.log(`    Seed: ${initializerSeed}`);
  console.log(`    Layers: 128→64→32→16→1`);
  console.log(`    Parameters: ${model.countParams().toLocaleString()}`);

  // Train model
  console.log(`\n[${modelNumber}.5] Training model ${modelNumber}/${totalModels}...`);

  const startTime = Date.now();

  await model.fit(xTrain, yTrain, {
    epochs: 20,  // Reduced from 50 (models converge by epoch 10-15)
    batchSize: 128,  // Reduced from 256 (60% GPU reduction for concurrent usage)
    validationData: [xTest, yTest],
    callbacks: {
      onEpochEnd: (epoch, logs) => {
        if ((epoch + 1) % 5 === 0 || epoch === 0) {
          const elapsed = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
          process.stdout.write(`\r  Epoch ${(epoch + 1).toString().padStart(2)}/50: loss=${logs.loss.toFixed(4)}, acc=${(logs.acc * 100).toFixed(1)}%, val_acc=${(logs.val_acc * 100).toFixed(1)}% [${elapsed}m]     `);
          if ((epoch + 1) % 10 === 0) console.log('');
        }
      }
    },
    verbose: 0
  });

  const trainingTime = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
  console.log(`\n\n  ✓ Training complete in ${trainingTime} minutes`);

  // Evaluate model
  console.log(`\n[${modelNumber}.6] Evaluating model ${modelNumber}...`);

  const testPredsTensor = model.predict(xTest);
  const testPreds = await testPredsTensor.array();
  testPredsTensor.dispose();

  // Calculate metrics
  function calculateMetrics(preds, labels, threshold = 0.5) {
    let tp = 0, fp = 0, tn = 0, fn = 0;

    for (let i = 0; i < preds.length; i++) {
      const pred = preds[i][0] >= threshold ? 1 : 0;
      const actual = labels[i];

      if (pred === 1 && actual === 1) tp++;
      else if (pred === 1 && actual === 0) fp++;
      else if (pred === 0 && actual === 0) tn++;
      else if (pred === 0 && actual === 1) fn++;
    }

    const accuracy = (tp + tn) / (tp + fp + tn + fn);
    const precision = tp / (tp + fp) || 0;
    const recall = tp / (tp + fn) || 0;
    const f1 = 2 * (precision * recall) / (precision + recall) || 0;

    return { accuracy, precision, recall, f1, tp, fp, tn, fn };
  }

  const testMetrics = calculateMetrics(testPreds, testLabels);

  console.log('  Test Metrics:');
  console.log(`    Accuracy:  ${(testMetrics.accuracy * 100).toFixed(1)}%`);
  console.log(`    Precision: ${(testMetrics.precision * 100).toFixed(1)}%`);
  console.log(`    Recall:    ${(testMetrics.recall * 100).toFixed(1)}%`);

  // Save model
  console.log(`\n[${modelNumber}.7] Saving model ${modelNumber}...`);
  const modelDir = `./models/phase5-ensemble-model${modelNumber}`;
  await model.save(`file://${modelDir}`);
  fs.writeFileSync(`./models/phase5-ensemble-model${modelNumber}-params.json`, JSON.stringify({
    means,
    stds,
    featureNames,
    totalSamples,
    testAccuracy: testMetrics.accuracy,
    seed: initializerSeed,
    forwardDays,
    topPercentile
  }, null, 2));
  console.log(`  ✓ Model saved to ${modelDir}`);

  // Cleanup
  xTrain.dispose();
  yTrain.dispose();
  xTest.dispose();
  yTest.dispose();
  model.dispose();

  console.log(`  ✓ Model ${modelNumber}/${totalModels} complete!\n`);

  return {
    modelNumber,
    testAccuracy: testMetrics.accuracy,
    trainingTime: parseFloat(trainingTime),
    seed: initializerSeed
  };
}

(async () => {

console.log('═'.repeat(71));
console.log('   STAGE 1: EXPAND TO 5-MODEL ENSEMBLE (TRAIN MODELS 4-5)');
console.log('═'.repeat(71));
console.log('');
console.log(`Backend: ${tf.getBackend().toUpperCase()}`);
console.log('');
console.log('Strategy: Train 2 additional models (4 and 5) with different seeds');
console.log('          → Expand from 3-model to 5-model ensemble');
console.log('          → Expected confidence boost: +3-5 percentage points');
console.log('          → Target: 62-65% average confidence');
console.log('');
console.log('Expected time: ~80 minutes (2 models × 40 min each)');
console.log('');

// Load market data
console.log('[1] Loading market data...');
const dataDir = path.join(__dirname, '..', 'historical-data');
const files = fs.readdirSync(dataDir).filter(f => f.endsWith('-5-years.json'));

const allData = {};
let totalBars = 0;

for (const file of files) {
  const symbol = file.replace('-5-years.json', '');
  const data = JSON.parse(fs.readFileSync(path.join(dataDir, file), 'utf8'));
  if (data.length > 300) {
    allData[symbol] = data;
    totalBars += data.length;
  }
}

console.log(`  Loaded ${Object.keys(allData).length} symbols`);
console.log(`  Total bars: ${totalBars.toLocaleString()}`);

const firstSymbol = Object.keys(allData)[0];
const firstData = allData[firstSymbol];
console.log(`  Date range: ${firstData[0].date} to ${firstData[firstData.length - 1].date}`);

// Configuration (same as Models 1-3)
const NUM_MODELS = 2;  // Training models 4 and 5
const FORWARD_DAYS = 5;
const TOP_PERCENTILE = 0.30;

console.log('');
console.log('Configuration:');
console.log(`  Models to train:  4 and 5 (seeds 1004, 1005)`);
console.log(`  Forward days:     ${FORWARD_DAYS}`);
console.log(`  Target:           Top ${(TOP_PERCENTILE * 100).toFixed(0)}%`);

// Train models 4 and 5
const modelResults = [];
const overallStartTime = Date.now();

// Model 4
const result4 = await trainModel(4, 5, allData, FORWARD_DAYS, TOP_PERCENTILE);
modelResults.push(result4);

// Model 5
const result5 = await trainModel(5, 5, allData, FORWARD_DAYS, TOP_PERCENTILE);
modelResults.push(result5);

const totalTrainingTime = ((Date.now() - overallStartTime) / 1000 / 60).toFixed(1);

// Summary
console.log('═'.repeat(71));
console.log('   STAGE 1 COMPLETE: MODELS 4-5 TRAINED');
console.log('═'.repeat(71));
console.log('');
console.log(`Total training time: ${totalTrainingTime} minutes`);
console.log('');
console.log('New Model Summary:');
console.log('─'.repeat(71));
console.log('Model | Seed | Test Acc | Training Time');
console.log('─'.repeat(71));

for (const result of modelResults) {
  console.log(
    `  ${result.modelNumber}   | ${result.seed} | ${(result.testAccuracy * 100).toFixed(1)}%      | ${result.trainingTime.toFixed(1)} min`
  );
}

console.log('─'.repeat(71));
console.log('');
console.log('✓ You now have 5 trained models (1, 2, 3, 4, 5)');
console.log('');
console.log('Next step: Update ensemble predictor to use all 5 models');
console.log('          → Modify examples/45-phase5-ensemble-predict.js');
console.log('          → Change NUM_MODELS from 3 to 5');
console.log('          → Run predictions to measure confidence improvement');
console.log('');
console.log('═'.repeat(71));
console.log('');

})().catch(console.error);
