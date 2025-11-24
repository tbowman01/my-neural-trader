const tf = require('@tensorflow/tfjs-node-gpu');
const fs = require('fs');
const path = require('path');
const EnhancedFeatures = require('../lib/enhanced-features');

// ═══════════════════════════════════════════════════════════════════
//   PHASE 5: MULTI-DAY RETURNS FOR HIGH-CONFIDENCE PREDICTIONS
// ═══════════════════════════════════════════════════════════════════
//
// KEY INSIGHT from Phase 4:
// Next-day price movements are nearly random (50/50 coin flip).
// The model was RIGHT to have low confidence - 1-day moves are unpredictable!
//
// NEW APPROACH:
// - Predict 5-day forward returns instead of 1-day moves
// - Target: Top 30% performers (strong upward momentum)
// - This gives clearer signals and more confident predictions
//
// Expected improvements:
// - Much higher confidence scores (40-70% range)
// - Better separation between strong and weak signals
// - More actionable trading signals
// - Same or better accuracy on meaningful moves
//
// ═══════════════════════════════════════════════════════════════════

(async () => {

console.log('═══════════════════════════════════════════════════════════════════');
console.log('   PHASE 5: MULTI-DAY RETURNS + HIGH-CONFIDENCE SIGNALS');
console.log('═══════════════════════════════════════════════════════════════════');
console.log('');
console.log(`Backend: ${tf.getBackend().toUpperCase()}`);
console.log('');

// Load market data
console.log('[1] Loading extended market data (10 years)...');
const dataDir = path.join(__dirname, '..', 'historical-data');
const files = fs.readdirSync(dataDir).filter(f => f.endsWith('-5-years.json'));

const allData = {};
let totalBars = 0;

for (const file of files) {
  const symbol = file.replace('.json', '');
  const data = JSON.parse(fs.readFileSync(path.join(dataDir, file), 'utf8'));
  if (data.length > 300) {
    allData[symbol] = data;
    totalBars += data.length;
  }
}

console.log(`Loaded ${Object.keys(allData).length} symbols`);
console.log(`Total bars: ${totalBars.toLocaleString()}`);

const firstSymbol = Object.keys(allData)[0];
const firstData = allData[firstSymbol];
console.log(`\nDate range: ${firstData[0].date} to ${firstData[firstData.length - 1].date}`);

// Generate enhanced features with 5-day forward returns
console.log('\n[2] Generating enhanced features with 5-day returns...');
const enhancedData = {};
let totalSamples = 0;
let processedSymbols = 0;

const FORWARD_DAYS = 5;  // Predict 5 days ahead
const TOP_PERCENTILE = 0.30;  // Top 30% performers

for (const [symbol, bars] of Object.entries(allData)) {
  const features = EnhancedFeatures.generateAllFeatures(bars);

  const validFeatures = [];
  const validLabels = [];
  const validReturns = [];

  // Calculate 5-day forward returns for all samples
  for (let i = 0; i < features.length - FORWARD_DAYS; i++) {
    const feat = features[i];

    const hasAllFeatures = feat.sma200 !== null &&
                          feat.rsi !== null &&
                          feat.macdLine !== null &&
                          feat.bbPosition !== null &&
                          feat.atr !== null &&
                          feat.mfi !== null;

    if (hasAllFeatures && i + FORWARD_DAYS < bars.length) {
      const currentPrice = bars[i].close;
      const futurePrice = bars[i + FORWARD_DAYS].close;
      const returnPct = ((futurePrice - currentPrice) / currentPrice) * 100;

      validFeatures.push(feat);
      validReturns.push(returnPct);
    }
  }

  // Calculate threshold for top 30% returns
  if (validReturns.length > 0) {
    const sortedReturns = [...validReturns].sort((a, b) => b - a);
    const thresholdIdx = Math.floor(validReturns.length * TOP_PERCENTILE);
    const threshold = sortedReturns[thresholdIdx];

    // Label: 1 if in top 30% of returns, 0 otherwise
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

console.log(`\n\nTotal samples: ${totalSamples.toLocaleString()}`);

// Calculate statistics
let positiveCount = 0;
let allReturns = [];
for (const [symbol, data] of Object.entries(enhancedData)) {
  positiveCount += data.labels.filter(l => l === 1).length;
  allReturns = allReturns.concat(data.returns);
}

console.log(`\nLabel distribution:`);
console.log(`  Top 30%: ${positiveCount.toLocaleString()} samples (${((positiveCount / totalSamples) * 100).toFixed(1)}%)`);
console.log(`  Others:  ${(totalSamples - positiveCount).toLocaleString()} samples (${(((totalSamples - positiveCount) / totalSamples) * 100).toFixed(1)}%)`);

const avgReturn = allReturns.reduce((a, b) => a + b, 0) / allReturns.length;
const sortedReturns = [...allReturns].sort((a, b) => b - a);
const top30Threshold = sortedReturns[Math.floor(allReturns.length * 0.30)];
console.log(`\n5-day return statistics:`);
console.log(`  Average return: ${avgReturn.toFixed(2)}%`);
console.log(`  Top 30% threshold: ${top30Threshold.toFixed(2)}%`);

// Prepare training data
console.log('\n[3] Preparing training data...');

const featureNames = [
  'priceVsSma20', 'priceVsSma50', 'priceVsSma200',
  'rsi', 'macdHistogram', 'roc',
  'stochK', 'stochD', 'williamsR',
  'bbPosition', 'atrPercent',
  'obvTrend', 'mfi', 'volumeRatio'
];

console.log(`Using ${featureNames.length} features`);

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

// Build enhanced neural network
console.log('\n[5] Building enhanced neural network...');

const model = tf.sequential({
  layers: [
    tf.layers.dense({ units: 128, activation: 'relu', inputShape: [featureNames.length], kernelRegularizer: tf.regularizers.l2({ l2: 0.001 }) }),
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
console.log(`  Layers: 128→64→32→16→1`);
console.log(`  Total parameters: ${model.countParams().toLocaleString()}`);
console.log(`  Target: Top 30% of 5-day returns`);

// Train model
console.log('\n[6] Training for high-confidence predictions...');

const startTime = Date.now();

await model.fit(xTrain, yTrain, {
  epochs: 50,
  batchSize: 256,
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
console.log(`\n\n✓ Training complete in ${trainingTime} minutes`);

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

// Analyze confidence distribution
console.log('\n[8] Analyzing confidence distribution...');

function analyzeConfidence(preds, labels) {
  const bins = [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0];
  const distribution = bins.map(() => ({ count: 0, positive: 0 }));

  for (let i = 0; i < preds.length; i++) {
    const pred = preds[i][0];
    const binIdx = Math.min(Math.floor(pred * 10), 9);
    distribution[binIdx].count++;
    if (labels[i] === 1) {
      distribution[binIdx].positive++;
    }
  }

  return distribution;
}

const testDist = analyzeConfidence(testPreds, testLabels);

console.log('\nTest Set Confidence Distribution:');
console.log('Range     | Count     | Accuracy');
console.log('----------|-----------|----------');
for (let i = 0; i < testDist.length; i++) {
  if (testDist[i].count > 0) {
    const range = `${(i * 10).toString().padStart(2)}%-${((i + 1) * 10).toString().padStart(2)}%`;
    const count = testDist[i].count.toString().padStart(9);
    const acc = ((testDist[i].positive / testDist[i].count) * 100).toFixed(1).padStart(6);
    console.log(`${range} | ${count} | ${acc}%`);
  }
}

// Generate predictions for all symbols
console.log('\n[9] Generating predictions with confidence scores...');

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
console.log('          HIGH-CONFIDENCE TRADING SIGNALS (PHASE 5)');
console.log('═══════════════════════════════════════════════════════════════════');
console.log('\nTOP 15 BUY CANDIDATES (5-Day Strong Upside):');
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

// Compare with previous phases
console.log('\n═══════════════════════════════════════════════════════════════════');
console.log('               PHASE 5 vs PREVIOUS PHASES COMPARISON');
console.log('═══════════════════════════════════════════════════════════════════');

const avgTopConfidence = sorted.slice(0, 15).reduce((sum, [_, data]) => sum + data.confidence, 0) / 15;
const maxConfidence = sorted[0][1].confidence;
const minConfidence = sorted[sorted.length - 1][1].confidence;

console.log('\nPHASE 3 (1-day next price):');
console.log('  Test Accuracy:    83.9%');
console.log('  Confidence Range: 0-28.7%');
console.log('  Top-15 Avg:       4.7%');
console.log('');
console.log('PHASE 4 (1-day, more data):');
console.log('  Test Accuracy:    83.7%');
console.log('  Confidence Range: 0-14.3%');
console.log('  Top-15 Avg:       1.7%');
console.log('');
console.log('PHASE 5 (5-day top 30%):');
console.log(`  Test Accuracy:    ${(testMetrics.accuracy * 100).toFixed(1)}%`);
console.log(`  Confidence Range: ${(minConfidence * 100).toFixed(1)}-${(maxConfidence * 100).toFixed(1)}%`);
console.log(`  Top-15 Avg:       ${(avgTopConfidence * 100).toFixed(1)}%`);
console.log('');

if (avgTopConfidence > 0.40) {
  console.log(`✓✓✓ SUCCESS! Confidence improved to ${(avgTopConfidence * 100).toFixed(1)}%!`);
  console.log(`    Achieved target range of 40-70% confidence!`);
} else {
  console.log(`  Improvement: +${((avgTopConfidence - 0.017) * 100).toFixed(1)} percentage points`);
}

console.log('\n═══════════════════════════════════════════════════════════════════');
console.log('');

// Save model and normalization parameters
console.log('Saving model and parameters...');
await model.save('file://./models/phase5-multiday');
fs.writeFileSync('./models/phase5-normalization.json', JSON.stringify({
  means,
  stds,
  featureNames,
  totalSamples,
  testAccuracy: testMetrics.accuracy,
  avgTopConfidence: avgTopConfidence,
  forwardDays: FORWARD_DAYS,
  topPercentile: TOP_PERCENTILE
}, null, 2));
console.log('✓ Model saved to ./models/phase5-multiday');

// Cleanup
xTrain.dispose();
yTrain.dispose();
xTest.dispose();
yTest.dispose();
model.dispose();

console.log('✓ Phase 5 training complete!');
console.log('');

})().catch(console.error);
