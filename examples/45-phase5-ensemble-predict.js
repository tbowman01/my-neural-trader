const tf = require('@tensorflow/tfjs-node-gpu');
const fs = require('fs');
const path = require('path');
const EnhancedFeatures = require('../lib/enhanced-features');

// ═══════════════════════════════════════════════════════════════════
//   TRUE ENSEMBLE PREDICTIONS: CONSENSUS VOTING
// ═══════════════════════════════════════════════════════════════════
//
// APPROACH: Load 3 independent models and require consensus
//
// Consensus Strategy:
// 1. Each model makes independent prediction
// 2. Calculate average confidence across all 3 models
// 3. Calculate agreement score (how close predictions are)
// 4. Only trade when:
//    - All 3 models predict above individual threshold (45%)
//    - Average confidence is high (50%+)
//    - Low variance between models (agreement)
//
// Expected Benefits:
// - Individual model: 40-50% confidence
// - Consensus average: 55-70% effective confidence
// - Much fewer false positives
// - Higher quality signals
//
// ═══════════════════════════════════════════════════════════════════

(async () => {

console.log('═══════════════════════════════════════════════════════════════════');
console.log('   TRUE ENSEMBLE: CONSENSUS-BASED PREDICTIONS');
console.log('═══════════════════════════════════════════════════════════════════');
console.log('');

// Configuration
const CONFIG = {
  NUM_MODELS: 5,  // Updated from 3 to 5 for Stage 1
  MIN_INDIVIDUAL_CONFIDENCE: 0.45,  // Each model must predict 45%+
  MIN_AVERAGE_CONFIDENCE: 0.50,      // Average must be 50%+
  MAX_DISAGREEMENT: 0.15,            // Max std dev between models
  TOP_N_SIGNALS: 15                   // Show top 15 signals
};

console.log('Ensemble Configuration:');
console.log(`  Number of models:        ${CONFIG.NUM_MODELS}`);
console.log(`  Min individual:          ${(CONFIG.MIN_INDIVIDUAL_CONFIDENCE * 100).toFixed(0)}%`);
console.log(`  Min average:             ${(CONFIG.MIN_AVERAGE_CONFIDENCE * 100).toFixed(0)}%`);
console.log(`  Max disagreement (σ):    ${(CONFIG.MAX_DISAGREEMENT * 100).toFixed(0)}%`);
console.log('');

// Load all 3 models
console.log('[1] Loading ensemble models...');
const models = [];
const normParams = [];

for (let i = 1; i <= CONFIG.NUM_MODELS; i++) {
  try {
    const model = await tf.loadLayersModel(`file://./models/phase5-ensemble-model${i}/model.json`);
    const params = JSON.parse(fs.readFileSync(`./models/phase5-ensemble-model${i}-params.json`, 'utf8'));
    models.push(model);
    normParams.push(params);
    console.log(`  ✓ Model ${i} loaded (accuracy: ${(params.testAccuracy * 100).toFixed(1)}%, seed: ${params.seed})`);
  } catch (err) {
    console.error(`  ✗ Failed to load model ${i}: ${err.message}`);
    console.error('');
    console.error('Please run the training script first:');
    console.error('  node examples/44-phase5-true-ensemble.js');
    process.exit(1);
  }
}

console.log('');
console.log(`✓ Loaded ${models.length} models successfully`);
console.log(`  Forward days: ${normParams[0].forwardDays}`);
console.log(`  Target: Top ${(normParams[0].topPercentile * 100).toFixed(0)}%`);
console.log('');

// Load cached market data
console.log('[2] Loading cached market data...');

const dataDir = path.join(__dirname, '..', 'historical-data');
const files = fs.readdirSync(dataDir).filter(f => f.endsWith('-5-years.json'));

const marketData = {};
let loadedCount = 0;

for (const file of files) {
  try {
    const symbol = file.replace('-5-years.json', '');
    const bars = JSON.parse(fs.readFileSync(path.join(dataDir, file), 'utf8'));

    if (bars && bars.length >= 250) {
      marketData[symbol] = {
        bars: bars,
        currentPrice: bars[bars.length - 1].close,
        name: symbol
      };
      loadedCount++;
    }
  } catch (err) {
    // Skip symbols with errors
  }
}

console.log(`✓ Loaded ${loadedCount} symbols\n`);

// Generate ensemble predictions
console.log('[3] Generating ensemble predictions...\n');

const predictions = [];

for (const [symbol, data] of Object.entries(marketData)) {
  const features = EnhancedFeatures.generateAllFeatures(data.bars);
  const latest = features[features.length - 1];

  // Check if we have all required features
  const hasAllFeatures = latest &&
    latest.sma200 !== null &&
    latest.rsi !== null &&
    latest.macdLine !== null &&
    latest.bbPosition !== null &&
    latest.atr !== null &&
    latest.mfi !== null;

  if (!hasAllFeatures) continue;

  // Get predictions from all 3 models
  const modelPredictions = [];

  for (let i = 0; i < CONFIG.NUM_MODELS; i++) {
    const params = normParams[i];
    const model = models[i];

    // Extract and normalize features using this model's normalization
    const featureVector = [
      latest.priceVsSma20,
      latest.priceVsSma50,
      latest.priceVsSma200,
      latest.rsi,
      latest.macdHistogram,
      latest.roc,
      latest.stochK,
      latest.stochD,
      latest.williamsR,
      latest.bbPosition,
      latest.atr,
      latest.obvTrend,
      latest.mfi,
      latest.volumeRatio
    ];

    // Normalize using this model's saved parameters
    const normalized = featureVector.map((val, idx) => {
      return (val - params.means[idx]) / params.stds[idx];
    });

    // Make prediction
    const inputTensor = tf.tensor2d([normalized]);
    const predTensor = model.predict(inputTensor);
    const pred = await predTensor.data();

    inputTensor.dispose();
    predTensor.dispose();

    modelPredictions.push(pred[0]);
  }

  // Calculate consensus metrics
  const avgConfidence = modelPredictions.reduce((a, b) => a + b, 0) / modelPredictions.length;
  const variance = modelPredictions.reduce((sum, pred) => sum + Math.pow(pred - avgConfidence, 2), 0) / modelPredictions.length;
  const stdDev = Math.sqrt(variance);

  // Check if all models agree above threshold
  const allAboveThreshold = modelPredictions.every(pred => pred >= CONFIG.MIN_INDIVIDUAL_CONFIDENCE);

  // Determine signal
  let signal = 'HOLD';
  let reason = '';

  if (!allAboveThreshold) {
    reason = 'Not all models agree';
  } else if (avgConfidence < CONFIG.MIN_AVERAGE_CONFIDENCE) {
    reason = 'Average confidence too low';
  } else if (stdDev > CONFIG.MAX_DISAGREEMENT) {
    reason = 'High disagreement between models';
  } else {
    signal = 'BUY';
    reason = 'Strong consensus';
  }

  const predObj = {
    symbol,
    name: data.name,
    price: data.currentPrice,
    avgConfidence: (avgConfidence * 100).toFixed(1),
    stdDev: (stdDev * 100).toFixed(1),
    avgConfidenceNum: avgConfidence * 100,
    signal,
    reason
  };

  // Add all model predictions dynamically
  for (let i = 0; i < CONFIG.NUM_MODELS; i++) {
    predObj[`model${i + 1}`] = (modelPredictions[i] * 100).toFixed(1);
  }

  predictions.push(predObj);
}

// Sort by average confidence
predictions.sort((a, b) => b.avgConfidenceNum - a.avgConfidenceNum);

// Display results
console.log('═══════════════════════════════════════════════════════════════════');
console.log('          TRUE ENSEMBLE CONSENSUS SIGNALS');
console.log('═══════════════════════════════════════════════════════════════════\n');

const buySignals = predictions.filter(p => p.signal === 'BUY');

if (buySignals.length === 0) {
  console.log('⚠️  NO CONSENSUS SIGNALS found');
  console.log(`   All ${CONFIG.NUM_MODELS} models must agree above thresholds for a signal`);
  console.log('   This is expected - ensemble is more selective\n');
} else {
  console.log(`✓ Found ${buySignals.length} consensus BUY signals\n`);
  console.log('TOP CONSENSUS SIGNALS:');
  const lineWidth = CONFIG.NUM_MODELS === 5 ? 115 : 95;
  console.log('─'.repeat(lineWidth));

  // Build header dynamically based on NUM_MODELS
  let modelHeaders = '';
  for (let i = 1; i <= CONFIG.NUM_MODELS; i++) {
    modelHeaders += `M${i}    `;
  }
  console.log(`Symbol       | ${modelHeaders}| Avg   σ    | Price      | Signal | Reason`);
  console.log('─'.repeat(lineWidth));

  for (const pred of buySignals.slice(0, CONFIG.TOP_N_SIGNALS)) {
    let modelsStr = '';
    for (let i = 1; i <= CONFIG.NUM_MODELS; i++) {
      modelsStr += `${pred[`model${i}`]}% `;
    }
    const models = modelsStr.padEnd(CONFIG.NUM_MODELS === 5 ? 30 : 15);
    const stats = `${pred.avgConfidence}% ${pred.stdDev}%`.padEnd(10);
    console.log(
      `${pred.symbol.padEnd(12)} | ${models} | ${stats} | ${('$' + pred.price.toFixed(2)).padStart(10)} | ${pred.signal.padEnd(6)} | ${pred.reason}`
    );
  }
  console.log('─'.repeat(lineWidth));
}

console.log('\n');

// Show near-misses (high confidence but didn't meet all criteria)
console.log('NEAR-MISS SIGNALS (High potential but didn\'t meet all criteria):');
const lineWidth = CONFIG.NUM_MODELS === 5 ? 115 : 95;
console.log('─'.repeat(lineWidth));

let modelHeaders = '';
for (let i = 1; i <= CONFIG.NUM_MODELS; i++) {
  modelHeaders += `M${i}    `;
}
console.log(`Symbol       | ${modelHeaders}| Avg   σ    | Price      | Reason`);
console.log('─'.repeat(lineWidth));

const nearMisses = predictions
  .filter(p => p.signal === 'HOLD' && p.avgConfidenceNum >= 45)
  .slice(0, 10);

if (nearMisses.length === 0) {
  console.log('(No near-miss signals)');
} else {
  for (const pred of nearMisses) {
    let modelsStr = '';
    for (let i = 1; i <= CONFIG.NUM_MODELS; i++) {
      modelsStr += `${pred[`model${i}`]}% `;
    }
    const models = modelsStr.padEnd(CONFIG.NUM_MODELS === 5 ? 30 : 15);
    const stats = `${pred.avgConfidence}% ${pred.stdDev}%`.padEnd(10);
    console.log(
      `${pred.symbol.padEnd(12)} | ${models} | ${stats} | ${('$' + pred.price.toFixed(2)).padStart(10)} | ${pred.reason}`
    );
  }
}
console.log('─'.repeat(lineWidth));

console.log('\n');
console.log('═══════════════════════════════════════════════════════════════════');
console.log('                  COMPARISON TO PHASE 5');
console.log('═══════════════════════════════════════════════════════════════════\n');

const phase5Stats = {
  approach: 'Single model',
  minConfidence: 45,
  avgTopConfidence: 41.6,
  maxConfidence: 56.6,
  typicalSignals: 15
};

const ensembleStats = {
  approach: `${CONFIG.NUM_MODELS}-model consensus`,
  minConfidence: 50,
  signalsFound: buySignals.length,
  avgConfidence: buySignals.length > 0
    ? (buySignals.reduce((sum, p) => sum + p.avgConfidenceNum, 0) / buySignals.length).toFixed(1)
    : 0,
  maxConfidence: predictions.length > 0 ? predictions[0].avgConfidenceNum.toFixed(1) : 0,
  avgStdDev: buySignals.length > 0
    ? (buySignals.reduce((sum, p) => sum + parseFloat(p.stdDev), 0) / buySignals.length).toFixed(1)
    : 0
};

console.log('Phase 5 (Single Model):');
console.log(`  Approach:            ${phase5Stats.approach}`);
console.log(`  Min Confidence:      ${phase5Stats.minConfidence}%`);
console.log(`  Avg Top-15:          ${phase5Stats.avgTopConfidence}%`);
console.log(`  Max:                 ${phase5Stats.maxConfidence}%`);
console.log(`  Typical Signals:     ${phase5Stats.typicalSignals}`);
console.log('');
console.log('True Ensemble (Consensus):');
console.log(`  Approach:            ${ensembleStats.approach}`);
console.log(`  Min Confidence:      ${ensembleStats.minConfidence}%`);
console.log(`  Signals Found:       ${ensembleStats.signalsFound}`);
console.log(`  Avg Confidence:      ${ensembleStats.avgConfidence}%`);
console.log(`  Max:                 ${ensembleStats.maxConfidence}%`);
console.log(`  Avg Disagreement:    ${ensembleStats.avgStdDev}%`);
console.log('');

if (buySignals.length > 0) {
  const improvement = parseFloat(ensembleStats.avgConfidence) - phase5Stats.avgTopConfidence;
  console.log(`Confidence Improvement: +${improvement.toFixed(1)} percentage points`);
  console.log('');
  if (parseFloat(ensembleStats.avgConfidence) >= 55) {
    console.log('✓✓✓ SUCCESS! Achieved 55%+ average confidence through consensus!');
  } else if (parseFloat(ensembleStats.avgConfidence) >= 50) {
    console.log('✓✓ GOOD! Achieved 50%+ average confidence (halfway to goal)');
  }
} else {
  console.log('Note: No signals found. Try adjusting thresholds or adding more data/features.');
}
console.log('');
console.log('═══════════════════════════════════════════════════════════════════\n');

console.log('✓ Ensemble predictions complete!');
console.log('');

// Cleanup
models.forEach(model => model.dispose());

})().catch(console.error);
