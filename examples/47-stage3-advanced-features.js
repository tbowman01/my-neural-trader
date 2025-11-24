const tf = require('@tensorflow/tfjs-node-gpu');
const fs = require('fs');
const path = require('path');
const EnhancedFeatures = require('../lib/enhanced-features');

// ═══════════════════════════════════════════════════════════════════
//         STAGE 3: ADVANCED TECHNICAL FEATURES (24 indicators)
// ═══════════════════════════════════════════════════════════════════
//
// Improvements over baseline (14 features):
// - Expanded to 24 technical indicators (+10 new)
// - New indicators: ADX, CCI, Ultimate Osc, Keltner, Donchian,
//   CMF, VWAP, Parabolic SAR, Ichimoku, Linear Regression
// - Same neural architecture: 128→64→32→16→1
// - GPU optimized: 20 epochs, batch 128
//
// Expected improvements:
// - Test accuracy: 73.4% → 74-75% (+0.6-1%)
// - Prediction confidence: 59.4% → 60-61% (+0.6-1.6%)
//
// ═══════════════════════════════════════════════════════════════════

(async () => {

console.log('═══════════════════════════════════════════════════════════════════');
console.log('         STAGE 3: ADVANCED FEATURES (24 INDICATORS)');
console.log('═══════════════════════════════════════════════════════════════════');
console.log('');
console.log(`Backend: ${tf.getBackend().toUpperCase()}`);
console.log('');

// Load market data
console.log('[1] Loading market data...');
const dataDir = path.join(__dirname, '..', 'historical-data');
const files = fs.readdirSync(dataDir).filter(f => f.endsWith('-5-years.json'));

const allData = {};
for (const file of files) {
  const symbol = file.replace('.json', '');
  const data = JSON.parse(fs.readFileSync(path.join(dataDir, file), 'utf8'));
  if (data.length > 300) { // Need enough data for all indicators
    allData[symbol] = data;
  }
}

console.log(`Loaded ${Object.keys(allData).length} symbols`);

// Generate enhanced features
console.log('\n[2] Generating enhanced features (24 indicators)...');
const enhancedData = {};
let totalSamples = 0;

for (const [symbol, bars] of Object.entries(allData)) {
  console.log(`\nProcessing ${symbol}...`);
  const features = EnhancedFeatures.generateAllFeatures(bars);

  // Filter out rows with null values
  const validFeatures = [];
  const validLabels = [];

  for (let i = 0; i < features.length - 1; i++) {
    const feat = features[i];

    // Check if all required features are present (including new ones)
    const hasAllFeatures = feat.sma200 !== null &&
                          feat.rsi !== null &&
                          feat.macdLine !== null &&
                          feat.bbPosition !== null &&
                          feat.atr !== null &&
                          feat.mfi !== null &&
                          feat.adx !== null &&  // New Stage 3
                          feat.cci !== null &&  // New Stage 3
                          feat.ultimateOsc !== null &&  // New Stage 3
                          feat.vwap !== null;  // New Stage 3

    if (hasAllFeatures) {
      validFeatures.push(feat);
      // Label: 1 if next day closes higher, 0 otherwise
      validLabels.push(bars[i + 1].close > bars[i].close ? 1 : 0);
    }
  }

  enhancedData[symbol] = { features: validFeatures, labels: validLabels };
  totalSamples += validLabels.length;
  console.log(`  ✓ ${validLabels.length} valid samples`);
}

console.log(`\nTotal samples: ${totalSamples.toLocaleString()}`);

// Prepare training data with 24 features
console.log('\n[3] Preparing training data (24 features)...');

const featureNames = [
  // Original 14 features
  'priceVsSma20', 'priceVsSma50', 'priceVsSma200',
  'rsi', 'macdHistogram', 'roc',
  'stochK', 'stochD', 'williamsR',
  'bbPosition', 'atrPercent',
  'obvTrend', 'mfi', 'volumeRatio',

  // New 10 Stage 3 features
  'adx', 'cci', 'ultimateOsc',
  'keltnerPosition', 'donchianPosition',
  'cmf', 'vwapPosition',
  'psarTrend', 'ichimokuSignal',
  'linearRegSlope'
];

console.log(`Using ${featureNames.length} features:`);
console.log('\nORIGINAL 14:');
featureNames.slice(0, 14).forEach((f, i) => console.log(`  ${i + 1}. ${f}`));
console.log('\nNEW 10 (STAGE 3):');
featureNames.slice(14).forEach((f, i) => console.log(`  ${i + 15}. ${f}`));

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

console.log(`\nTrain: ${trainFeatures.length.toLocaleString()} samples`);
console.log(`Test: ${testFeatures.length.toLocaleString()} samples`);

// Normalize features
console.log('\n[4] Normalizing features...');
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

console.log('✓ Features normalized');

// Build neural network (same architecture, expanded input)
console.log('\n[5] Building neural network...');

const model = tf.sequential({
  layers: [
    tf.layers.dense({ units: 128, activation: 'relu', inputShape: [24], kernelRegularizer: tf.regularizers.l2({ l2: 0.001 }) }),
    tf.layers.dropout({ rate: 0.3 }),
    tf.layers.dense({ units: 64, activation: 'relu', kernelRegularizer: tf.regularizers.l2({ l2: 0.001 }) }),
    tf.layers.dropout({ rate: 0.3 }),
    tf.layers.dense({ units: 32, activation: 'relu', kernelRegularizer: tf.regularizers.l2({ l2: 0.001 }) }),
    tf.layers.dropout({ rate: 0.2 }),
    tf.layers.dense({ units: 16, activation: 'relu', kernelRegularizer: tf.regularizers.l2({ l2: 0.001 }) }),
    tf.layers.dropout({ rate: 0.2 }),
    tf.layers.dense({ units: 1, activation: 'sigmoid' })
  ]
});

model.compile({
  optimizer: tf.train.adam(0.0005),
  loss: 'binaryCrossentropy',
  metrics: ['accuracy']
});

console.log('✓ Model built');
console.log(`  Architecture: 128→64→32→16→1`);
console.log(`  Input features: 24 (14 original + 10 new)`);
console.log(`  Total parameters: ${model.countParams().toLocaleString()}`);
console.log(`  Regularization: L2 (0.001) + Dropout (0.2-0.3)`);

// Train model with GPU-optimized settings
console.log('\n[6] Training model (GPU optimized)...');
console.log('Settings: 20 epochs, batch 128 (60% GPU reduction)');

const startTime = Date.now();

await model.fit(xTrain, yTrain, {
  epochs: 20,  // GPU optimized (down from 50)
  batchSize: 128,  // GPU optimized (down from 256)
  validationData: [xTest, yTest],
  callbacks: {
    onEpochEnd: (epoch, logs) => {
      if ((epoch + 1) % 5 === 0) {
        console.log(`  Epoch ${epoch + 1}: loss=${logs.loss.toFixed(4)}, acc=${logs.acc.toFixed(4)}, val_acc=${logs.val_acc.toFixed(4)}`);
      }
    }
  },
  verbose: 0
});

const trainingTime = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
console.log(`\n✓ Training complete in ${trainingTime} minutes`);

// Evaluate model
console.log('\n[7] Evaluating model...');

const trainPredsTensor = model.predict(xTrain);
const testPredsTensor = model.predict(xTest);

const trainPreds = await trainPredsTensor.array();
const testPreds = await testPredsTensor.array();

trainPredsTensor.dispose();
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

const trainMetrics = calculateMetrics(trainPreds, trainLabels);
const testMetrics = calculateMetrics(testPreds, testLabels);

console.log('\nTRAIN METRICS:');
console.log(`  Accuracy:  ${(trainMetrics.accuracy * 100).toFixed(1)}%`);
console.log(`  Precision: ${(trainMetrics.precision * 100).toFixed(1)}%`);
console.log(`  Recall:    ${(trainMetrics.recall * 100).toFixed(1)}%`);
console.log(`  F1 Score:  ${(trainMetrics.f1 * 100).toFixed(1)}%`);

console.log('\nTEST METRICS:');
console.log(`  Accuracy:  ${(testMetrics.accuracy * 100).toFixed(1)}%`);
console.log(`  Precision: ${(testMetrics.precision * 100).toFixed(1)}%`);
console.log(`  Recall:    ${(testMetrics.recall * 100).toFixed(1)}%`);
console.log(`  F1 Score:  ${(testMetrics.f1 * 100).toFixed(1)}%`);

const overfitGap = (trainMetrics.accuracy - testMetrics.accuracy) * 100;
console.log(`\nOverfit Gap: ${overfitGap.toFixed(1)}%`);

// Generate predictions for all symbols
console.log('\n[8] Generating predictions with confidence scores...');

const predictions = {};

for (const [symbol, data] of Object.entries(enhancedData)) {
  if (data.features.length === 0) continue;

  const lastFeature = data.features[data.features.length - 1];
  const row = featureNames.map(name => lastFeature[name] || 0);
  const normalized = row.map((val, col) => (val - means[col]) / stds[col]);

  const inputTensor = tf.tensor2d([normalized]);
  const predTensor = model.predict(inputTensor);
  const predArray = await predTensor.array();

  predictions[symbol] = {
    confidence: predArray[0][0],
    lastPrice: data.features[data.features.length - 1].close
  };

  inputTensor.dispose();
  predTensor.dispose();
}

// Sort by confidence
const sorted = Object.entries(predictions)
  .sort((a, b) => b[1].confidence - a[1].confidence);

console.log('\n═══════════════════════════════════════════════════════════════════');
console.log('              STAGE 3 TRADING SIGNALS (24 FEATURES)');
console.log('═══════════════════════════════════════════════════════════════════');
console.log('\nTOP 15 BUY CANDIDATES:');
console.log('─────────────────────────────────────────────────────────────────────');
console.log('Symbol              | Confidence | Price');
console.log('--------------------|------------|--------');

sorted.slice(0, 15).forEach(([symbol, data]) => {
  const displaySymbol = symbol.padEnd(19);
  const conf = `${(data.confidence * 100).toFixed(1)}%`.padStart(10);
  const price = `$ ${data.lastPrice.toFixed(2)}`.padStart(8);
  console.log(`${displaySymbol} | ${conf} | ${price}`);
});

console.log('\nLOWEST 10 (AVOID):');
console.log('─────────────────────────────────────────────────────────────────────');

sorted.slice(-10).reverse().forEach(([symbol, data]) => {
  console.log(`${symbol.padEnd(19)} | ${(data.confidence * 100).toFixed(1)}%`);
});

// Compare with baseline
console.log('\n═══════════════════════════════════════════════════════════════════');
console.log('                 STAGE 3 vs BASELINE COMPARISON');
console.log('═══════════════════════════════════════════════════════════════════');
console.log('\nBASELINE (14 features):');
console.log('  Features:       14 technical indicators');
console.log('  Test Accuracy:  73.4%');
console.log('  Confidence:     59.4% (5-model ensemble)');
console.log('  Neural Net:     128→64→32→16→1');
console.log('');
console.log('STAGE 3 (24 features):');
console.log(`  Features:       ${featureNames.length} technical indicators (+10 new)`);
console.log(`  Test Accuracy:  ${(testMetrics.accuracy * 100).toFixed(1)}%`);
console.log(`  Top Confidence: ${(sorted[0][1].confidence * 100).toFixed(1)}%`);
console.log('  Neural Net:     128→64→32→16→1');
console.log('  Overfit Gap:    ' + overfitGap.toFixed(1) + '%');
console.log('');

// Calculate confidence improvement
const avgTopConfidence = sorted.slice(0, 15).reduce((sum, [_, data]) => sum + data.confidence, 0) / 15;
const baselineAccuracy = 73.4;
const baselineConfidence = 59.4;

console.log('IMPROVEMENTS:');
console.log(`  Accuracy:    ${(testMetrics.accuracy * 100).toFixed(1)}% vs ${baselineAccuracy}% = ${((testMetrics.accuracy * 100 - baselineAccuracy) > 0 ? '+' : '')}${(testMetrics.accuracy * 100 - baselineAccuracy).toFixed(1)}%`);
console.log(`  Top-15 Conf: ${(avgTopConfidence * 100).toFixed(1)}% vs ${baselineConfidence}% = ${((avgTopConfidence * 100 - baselineConfidence) > 0 ? '+' : '')}${(avgTopConfidence * 100 - baselineConfidence).toFixed(1)}%`);
console.log(`  Training:    ${trainingTime} min (GPU optimized)`);

console.log('\n═══════════════════════════════════════════════════════════════════');
console.log('');

// Save model and normalization parameters
console.log('Saving model and parameters...');
const modelDir = './models/stage3-advanced-features';
await model.save(`file://${modelDir}`);
fs.writeFileSync('./models/stage3-normalization.json', JSON.stringify({ means, stds, featureNames }, null, 2));
console.log(`✓ Model saved to ${modelDir}`);

// Cleanup
xTrain.dispose();
yTrain.dispose();
xTest.dispose();
yTest.dispose();
model.dispose();

console.log('✓ Stage 3 training complete!');
console.log('');

})().catch(console.error);
