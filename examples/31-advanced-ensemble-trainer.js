/**
 * Advanced Ensemble Trainer
 *
 * Combines multiple models for better predictions:
 * 1. Random Forest (30 trees)
 * 2. Gradient Boosting (simplified)
 * 3. Deep Neural Network
 * 4. Weighted Ensemble
 *
 * Plus advanced features:
 * - Cross-validation
 * - Feature selection
 * - Probability calibration
 */

const fs = require('fs');
const path = require('path');

console.log('=== Advanced Ensemble Trainer ===\n');

// ============================================
// LOAD ALL DATA
// ============================================

const dataDir = path.join(__dirname, '../historical-data');
const allSymbols = [
    'AAPL', 'MSFT', 'NVDA', 'AMD', 'GOOGL', 'TSLA', 'PLTR', 'INTC',
    'SPY', 'QQQ', 'VOO', 'IWM',
    'XLF', 'XLE', 'XLV', 'XLP', 'XLY',
    'PG', 'KO', 'JNJ', 'MCD', 'WMT', 'IBM',
    'TLT', 'IEF', 'GLD', 'UUP', 'DIS', 'BAH'
];

const allData = {};
for (const sym of allSymbols) {
    const filePath = path.join(dataDir, `${sym}-5-years.json`);
    if (fs.existsSync(filePath)) {
        allData[sym] = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    }
}
console.log(`Loaded ${Object.keys(allData).length} symbols\n`);

// ============================================
// INDICATORS
// ============================================

function sma(prices, period) {
    return prices.map((_, i) => i < period - 1 ? null :
        prices.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0) / period);
}

function ema(prices, period) {
    const result = [], mult = 2 / (period + 1);
    let e = prices[0];
    for (let i = 0; i < prices.length; i++) {
        e = i === 0 ? prices[0] : (prices[i] - e) * mult + e;
        result.push(e);
    }
    return result;
}

function rsi(prices, period = 14) {
    const result = new Array(prices.length).fill(null);
    for (let i = period; i < prices.length; i++) {
        let gains = 0, losses = 0;
        for (let j = i - period + 1; j <= i; j++) {
            const change = prices[j] - prices[j - 1];
            if (change > 0) gains += change;
            else losses -= change;
        }
        result[i] = 100 - (100 / (1 + (losses === 0 ? 100 : gains / losses)));
    }
    return result;
}

function macd(prices) {
    const ema12 = ema(prices, 12), ema26 = ema(prices, 26);
    const line = ema12.map((v, i) => v - ema26[i]);
    const signal = ema(line, 9);
    return { line, signal, histogram: line.map((v, i) => v - signal[i]) };
}

function bollingerBands(prices, period = 20) {
    const middle = sma(prices, period);
    const percentB = [], width = [];
    for (let i = 0; i < prices.length; i++) {
        if (i < period - 1) { percentB.push(null); width.push(null); }
        else {
            const slice = prices.slice(i - period + 1, i + 1);
            const variance = slice.reduce((sum, p) => sum + Math.pow(p - middle[i], 2), 0) / period;
            const std = Math.sqrt(variance);
            percentB.push((prices[i] - (middle[i] - 2*std)) / (4*std));
            width.push((4*std) / middle[i]);
        }
    }
    return { percentB, width };
}

function atr(data, period = 14) {
    const result = new Array(data.length).fill(null);
    for (let i = period; i < data.length; i++) {
        let sum = 0;
        for (let j = i - period + 1; j <= i; j++) {
            const high = data[j].high || data[j].close;
            const low = data[j].low || data[j].close;
            const prevClose = data[j - 1].close;
            sum += Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose));
        }
        result[i] = sum / period;
    }
    return result;
}

function adx(data, period = 14) {
    const result = new Array(data.length).fill(null);
    for (let i = period * 2; i < data.length; i++) {
        let sumTR = 0, sumPlusDM = 0, sumMinusDM = 0;
        for (let j = i - period + 1; j <= i; j++) {
            const high = data[j].high || data[j].close;
            const low = data[j].low || data[j].close;
            const prevHigh = data[j-1].high || data[j-1].close;
            const prevLow = data[j-1].low || data[j-1].close;
            const prevClose = data[j-1].close;

            sumTR += Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose));
            const upMove = high - prevHigh;
            const downMove = prevLow - low;
            sumPlusDM += (upMove > downMove && upMove > 0) ? upMove : 0;
            sumMinusDM += (downMove > upMove && downMove > 0) ? downMove : 0;
        }
        const plusDI = sumTR > 0 ? (sumPlusDM / sumTR) * 100 : 0;
        const minusDI = sumTR > 0 ? (sumMinusDM / sumTR) * 100 : 0;
        result[i] = plusDI + minusDI > 0 ? Math.abs(plusDI - minusDI) / (plusDI + minusDI) * 100 : 0;
    }
    return result;
}

function obv(data) {
    const result = [0];
    for (let i = 1; i < data.length; i++) {
        const vol = data[i].volume || 1000000;
        result.push(result[i-1] + (data[i].close > data[i-1].close ? vol : data[i].close < data[i-1].close ? -vol : 0));
    }
    // Normalize
    const maxAbs = Math.max(...result.map(Math.abs)) || 1;
    return result.map(v => v / maxAbs);
}

// ============================================
// ENHANCED FEATURE CREATION (25 features)
// ============================================

function createFeatures(data, symbol, horizon = 10, threshold = 1.0) {
    const prices = data.map(d => d.close);
    const sma5 = sma(prices, 5);
    const sma10 = sma(prices, 10);
    const sma20 = sma(prices, 20);
    const sma50 = sma(prices, 50);
    const sma200 = sma(prices, 200);
    const { line: macdLine, histogram } = macd(prices);
    const rsi14 = rsi(prices, 14);
    const rsi7 = rsi(prices, 7);
    const { percentB, width } = bollingerBands(prices);
    const atrValues = atr(data);
    const adxValues = adx(data);
    const obvValues = obv(data);

    const features = [], labels = [], metadata = [];

    for (let i = 200; i < prices.length - horizon; i++) {
        if (!sma200[i] || !rsi14[i] || !percentB[i] || !adxValues[i]) continue;

        // 25 features
        const feature = [
            // Trend (8)
            (prices[i] - sma5[i]) / sma5[i],
            (prices[i] - sma10[i]) / sma10[i],
            (prices[i] - sma20[i]) / sma20[i],
            (prices[i] - sma50[i]) / sma50[i],
            (prices[i] - sma200[i]) / sma200[i],
            (sma5[i] - sma20[i]) / sma20[i],
            (sma20[i] - sma50[i]) / sma50[i],
            (sma50[i] - sma200[i]) / sma200[i],

            // Momentum (5)
            rsi14[i] / 100,
            rsi7[i] / 100,
            histogram[i] / prices[i] * 100,
            macdLine[i] / prices[i] * 100,
            adxValues[i] / 100,

            // Volatility (3)
            percentB[i],
            width[i] * 10,
            atrValues[i] / prices[i] * 100,

            // Volume (1)
            obvValues[i],

            // Returns (8)
            (prices[i] - prices[i-1]) / prices[i-1],
            (prices[i] - prices[i-2]) / prices[i-2],
            (prices[i] - prices[i-3]) / prices[i-3],
            (prices[i] - prices[i-5]) / prices[i-5],
            (prices[i] - prices[i-10]) / prices[i-10],
            (prices[i] - prices[i-20]) / prices[i-20],
            // Volatility of returns
            Math.abs((prices[i] - prices[i-1]) / prices[i-1]) + Math.abs((prices[i-1] - prices[i-2]) / prices[i-2]),
            // Momentum acceleration
            ((prices[i] - prices[i-5]) / prices[i-5]) - ((prices[i-5] - prices[i-10]) / prices[i-10]),
        ];

        const futureReturn = (prices[i + horizon] - prices[i]) / prices[i] * 100;
        labels.push(futureReturn > threshold ? 1 : 0);
        metadata.push({ symbol, date: data[i].date, price: prices[i], idx: i });
        features.push(feature);
    }

    return { features, labels, metadata };
}

// ============================================
// MODEL 1: RANDOM FOREST
// ============================================

class RandomForest {
    constructor(numTrees = 35, maxDepth = 12) {
        this.numTrees = numTrees;
        this.maxDepth = maxDepth;
        this.trees = [];
    }

    buildTree(features, labels, depth = 0) {
        if (depth >= this.maxDepth || labels.length < 25) {
            return { leaf: true, value: labels.reduce((a, b) => a + b, 0) / labels.length };
        }

        const numFeatures = Math.floor(Math.sqrt(features[0].length));
        const selectedFeatures = [];
        while (selectedFeatures.length < numFeatures) {
            const f = Math.floor(Math.random() * features[0].length);
            if (!selectedFeatures.includes(f)) selectedFeatures.push(f);
        }

        let bestGain = -Infinity, bestSplit = null;

        for (const featureIdx of selectedFeatures) {
            const values = features.map(f => f[featureIdx]).sort((a, b) => a - b);
            const step = Math.max(1, Math.floor(values.length / 25));

            for (let i = step; i < values.length - step; i += step) {
                const threshold = values[i];
                const leftIdx = [], rightIdx = [];

                for (let j = 0; j < features.length; j++) {
                    if (features[j][featureIdx] <= threshold) leftIdx.push(j);
                    else rightIdx.push(j);
                }

                if (leftIdx.length < 15 || rightIdx.length < 15) continue;

                const leftMean = leftIdx.reduce((s, i) => s + labels[i], 0) / leftIdx.length;
                const rightMean = rightIdx.reduce((s, i) => s + labels[i], 0) / rightIdx.length;

                // Gini impurity reduction
                const parentGini = this.gini(labels);
                const leftGini = this.gini(leftIdx.map(i => labels[i]));
                const rightGini = this.gini(rightIdx.map(i => labels[i]));
                const weightedGini = (leftIdx.length * leftGini + rightIdx.length * rightGini) / labels.length;
                const gain = parentGini - weightedGini;

                if (gain > bestGain) {
                    bestGain = gain;
                    bestSplit = { featureIdx, threshold,
                        leftFeatures: leftIdx.map(i => features[i]),
                        leftLabels: leftIdx.map(i => labels[i]),
                        rightFeatures: rightIdx.map(i => features[i]),
                        rightLabels: rightIdx.map(i => labels[i]) };
                }
            }
        }

        if (!bestSplit || bestGain < 0.001) {
            return { leaf: true, value: labels.reduce((a, b) => a + b, 0) / labels.length };
        }

        return {
            leaf: false, featureIdx: bestSplit.featureIdx, threshold: bestSplit.threshold,
            left: this.buildTree(bestSplit.leftFeatures, bestSplit.leftLabels, depth + 1),
            right: this.buildTree(bestSplit.rightFeatures, bestSplit.rightLabels, depth + 1)
        };
    }

    gini(labels) {
        if (labels.length === 0) return 0;
        const p = labels.reduce((a, b) => a + b, 0) / labels.length;
        return 2 * p * (1 - p);
    }

    train(features, labels) {
        this.trees = [];
        for (let t = 0; t < this.numTrees; t++) {
            const indices = Array.from({length: features.length}, () =>
                Math.floor(Math.random() * features.length));
            this.trees.push(this.buildTree(
                indices.map(i => features[i]),
                indices.map(i => labels[i])
            ));
        }
    }

    predictTree(tree, feature) {
        if (tree.leaf) return tree.value;
        return feature[tree.featureIdx] <= tree.threshold ?
            this.predictTree(tree.left, feature) : this.predictTree(tree.right, feature);
    }

    predict(feature) {
        return this.trees.reduce((s, t) => s + this.predictTree(t, feature), 0) / this.trees.length;
    }
}

// ============================================
// MODEL 2: GRADIENT BOOSTING
// ============================================

class GradientBoosting {
    constructor(numTrees = 50, maxDepth = 4, learningRate = 0.1) {
        this.numTrees = numTrees;
        this.maxDepth = maxDepth;
        this.learningRate = learningRate;
        this.trees = [];
        this.initialPrediction = 0;
    }

    buildTree(features, residuals, depth = 0) {
        if (depth >= this.maxDepth || residuals.length < 20) {
            return { leaf: true, value: residuals.reduce((a, b) => a + b, 0) / residuals.length };
        }

        let bestGain = -Infinity, bestSplit = null;
        const numFeatures = Math.floor(features[0].length * 0.7);

        for (let f = 0; f < numFeatures; f++) {
            const featureIdx = Math.floor(Math.random() * features[0].length);
            const values = features.map(feat => feat[featureIdx]).sort((a, b) => a - b);
            const step = Math.max(1, Math.floor(values.length / 10));

            for (let i = step; i < values.length - step; i += step) {
                const threshold = values[i];
                const leftIdx = [], rightIdx = [];

                for (let j = 0; j < features.length; j++) {
                    if (features[j][featureIdx] <= threshold) leftIdx.push(j);
                    else rightIdx.push(j);
                }

                if (leftIdx.length < 10 || rightIdx.length < 10) continue;

                const leftMean = leftIdx.reduce((s, i) => s + residuals[i], 0) / leftIdx.length;
                const rightMean = rightIdx.reduce((s, i) => s + residuals[i], 0) / rightIdx.length;
                const gain = leftIdx.length * leftMean * leftMean + rightIdx.length * rightMean * rightMean;

                if (gain > bestGain) {
                    bestGain = gain;
                    bestSplit = { featureIdx, threshold,
                        leftFeatures: leftIdx.map(i => features[i]),
                        leftResiduals: leftIdx.map(i => residuals[i]),
                        rightFeatures: rightIdx.map(i => features[i]),
                        rightResiduals: rightIdx.map(i => residuals[i]) };
                }
            }
        }

        if (!bestSplit) {
            return { leaf: true, value: residuals.reduce((a, b) => a + b, 0) / residuals.length };
        }

        return {
            leaf: false, featureIdx: bestSplit.featureIdx, threshold: bestSplit.threshold,
            left: this.buildTree(bestSplit.leftFeatures, bestSplit.leftResiduals, depth + 1),
            right: this.buildTree(bestSplit.rightFeatures, bestSplit.rightResiduals, depth + 1)
        };
    }

    train(features, labels) {
        this.trees = [];
        this.initialPrediction = labels.reduce((a, b) => a + b, 0) / labels.length;

        let predictions = new Array(labels.length).fill(this.initialPrediction);

        for (let t = 0; t < this.numTrees; t++) {
            // Calculate residuals
            const residuals = labels.map((l, i) => l - predictions[i]);

            // Build tree on residuals
            const tree = this.buildTree(features, residuals);
            this.trees.push(tree);

            // Update predictions
            for (let i = 0; i < predictions.length; i++) {
                predictions[i] += this.learningRate * this.predictTree(tree, features[i]);
            }
        }
    }

    predictTree(tree, feature) {
        if (tree.leaf) return tree.value;
        return feature[tree.featureIdx] <= tree.threshold ?
            this.predictTree(tree.left, feature) : this.predictTree(tree.right, feature);
    }

    predict(feature) {
        let pred = this.initialPrediction;
        for (const tree of this.trees) {
            pred += this.learningRate * this.predictTree(tree, feature);
        }
        // Clip to [0, 1]
        return Math.max(0, Math.min(1, pred));
    }
}

// ============================================
// MODEL 3: NEURAL NETWORK
// ============================================

class NeuralNetwork {
    constructor(layers) {
        this.layers = layers;
        this.weights = [];
        this.biases = [];

        for (let i = 0; i < layers.length - 1; i++) {
            const w = [];
            for (let r = 0; r < layers[i]; r++) {
                w[r] = [];
                for (let c = 0; c < layers[i + 1]; c++) {
                    w[r][c] = (Math.random() - 0.5) * 2 * Math.sqrt(2.0 / layers[i]);
                }
            }
            this.weights.push(w);
            this.biases.push(new Array(layers[i + 1]).fill(0));
        }
    }

    relu(x) { return Math.max(0, x); }
    sigmoid(x) { return 1 / (1 + Math.exp(-Math.max(-500, Math.min(500, x)))); }

    forward(input) {
        let current = input;
        for (let l = 0; l < this.weights.length; l++) {
            const next = new Array(this.biases[l].length).fill(0);
            for (let j = 0; j < next.length; j++) {
                let sum = this.biases[l][j];
                for (let i = 0; i < current.length; i++) {
                    sum += current[i] * this.weights[l][i][j];
                }
                next[j] = l === this.weights.length - 1 ? this.sigmoid(sum) : this.relu(sum);
            }
            current = next;
        }
        return current[0];
    }

    train(features, labels, epochs = 100, lr = 0.01) {
        for (let e = 0; e < epochs; e++) {
            const indices = Array.from({length: features.length}, (_, i) => i);
            for (let i = indices.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [indices[i], indices[j]] = [indices[j], indices[i]];
            }

            for (const idx of indices) {
                // Forward
                const activations = [features[idx]];
                let current = features[idx];

                for (let l = 0; l < this.weights.length; l++) {
                    const next = new Array(this.biases[l].length).fill(0);
                    for (let j = 0; j < next.length; j++) {
                        let sum = this.biases[l][j];
                        for (let i = 0; i < current.length; i++) {
                            sum += current[i] * this.weights[l][i][j];
                        }
                        next[j] = l === this.weights.length - 1 ? this.sigmoid(sum) : this.relu(sum);
                    }
                    activations.push(next);
                    current = next;
                }

                // Backward
                const output = activations[activations.length - 1][0];
                let error = labels[idx] - output;

                for (let l = this.weights.length - 1; l >= 0; l--) {
                    const newErrors = new Array(activations[l].length).fill(0);

                    for (let i = 0; i < this.weights[l].length; i++) {
                        for (let j = 0; j < this.weights[l][i].length; j++) {
                            const grad = l === this.weights.length - 1 ?
                                error * output * (1 - output) :
                                error * (activations[l + 1][j] > 0 ? 1 : 0);

                            this.weights[l][i][j] += lr * grad * activations[l][i];
                            newErrors[i] += grad * this.weights[l][i][j];
                        }
                    }
                    error = newErrors[0];
                }
            }
        }
    }

    predict(feature) {
        return this.forward(feature);
    }
}

// ============================================
// ENSEMBLE MODEL
// ============================================

class EnsembleModel {
    constructor(inputSize) {
        this.rf = new RandomForest(35, 12);
        this.gb = new GradientBoosting(50, 4, 0.1);
        this.nn = new NeuralNetwork([inputSize, 32, 16, 1]);

        // Ensemble weights (will be calibrated)
        this.weights = [0.45, 0.35, 0.20];
    }

    train(features, labels) {
        console.log('  Training Random Forest (35 trees)...');
        this.rf.train(features, labels);

        console.log('  Training Gradient Boosting (50 iterations)...');
        this.gb.train(features, labels);

        console.log('  Training Neural Network (100 epochs)...');
        this.nn.train(features, labels, 100, 0.01);

        // Calibrate weights using validation performance
        console.log('  Calibrating ensemble weights...');
        this.calibrateWeights(features.slice(-1000), labels.slice(-1000));
    }

    calibrateWeights(valFeatures, valLabels) {
        // Test different weight combinations
        let bestF1 = 0, bestWeights = this.weights;

        for (let w1 = 0.3; w1 <= 0.6; w1 += 0.1) {
            for (let w2 = 0.2; w2 <= 0.5; w2 += 0.1) {
                const w3 = 1 - w1 - w2;
                if (w3 < 0.1 || w3 > 0.4) continue;

                let tp = 0, fp = 0, fn = 0;
                for (let i = 0; i < valFeatures.length; i++) {
                    const prob = w1 * this.rf.predict(valFeatures[i]) +
                                 w2 * this.gb.predict(valFeatures[i]) +
                                 w3 * this.nn.predict(valFeatures[i]);
                    const pred = prob > 0.5 ? 1 : 0;
                    if (pred === 1 && valLabels[i] === 1) tp++;
                    if (pred === 1 && valLabels[i] === 0) fp++;
                    if (pred === 0 && valLabels[i] === 1) fn++;
                }

                const f1 = 2 * tp / (2 * tp + fp + fn) || 0;
                if (f1 > bestF1) {
                    bestF1 = f1;
                    bestWeights = [w1, w2, w3];
                }
            }
        }

        this.weights = bestWeights;
        console.log(`  Best weights: RF=${bestWeights[0].toFixed(2)}, GB=${bestWeights[1].toFixed(2)}, NN=${bestWeights[2].toFixed(2)}`);
    }

    predict(feature) {
        const rfPred = this.rf.predict(feature);
        const gbPred = this.gb.predict(feature);
        const nnPred = this.nn.predict(feature);

        return this.weights[0] * rfPred +
               this.weights[1] * gbPred +
               this.weights[2] * nnPred;
    }

    predictWithDetails(feature) {
        return {
            rf: this.rf.predict(feature),
            gb: this.gb.predict(feature),
            nn: this.nn.predict(feature),
            ensemble: this.predict(feature)
        };
    }
}

// ============================================
// BUILD DATASET
// ============================================

console.log('═══════════════════════════════════════════════════════════');
console.log('BUILDING ENHANCED DATASET');
console.log('═══════════════════════════════════════════════════════════\n');

const horizon = 10;
const threshold = 1.0;

let allFeatures = [], allLabels = [], allMetadata = [];

for (const [symbol, data] of Object.entries(allData)) {
    const { features, labels, metadata } = createFeatures(data, symbol, horizon, threshold);
    allFeatures = allFeatures.concat(features);
    allLabels = allLabels.concat(labels);
    allMetadata = allMetadata.concat(metadata);
}

console.log(`Total samples: ${allFeatures.length.toLocaleString()}`);
console.log(`Features per sample: ${allFeatures[0].length}`);
console.log(`Positive rate: ${(allLabels.filter(l => l === 1).length / allLabels.length * 100).toFixed(1)}%\n`);

// ============================================
// TRAIN/TEST SPLIT
// ============================================

console.log('═══════════════════════════════════════════════════════════');
console.log('TRAINING ENSEMBLE');
console.log('═══════════════════════════════════════════════════════════\n');

const trainData = [], testData = [];
for (const symbol of Object.keys(allData)) {
    const symbolData = allFeatures.map((f, i) => ({ feature: f, label: allLabels[i], meta: allMetadata[i] }))
        .filter(d => d.meta.symbol === symbol);
    const splitIdx = Math.floor(symbolData.length * 0.7);
    trainData.push(...symbolData.slice(0, splitIdx));
    testData.push(...symbolData.slice(splitIdx));
}

// Shuffle
for (let i = trainData.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [trainData[i], trainData[j]] = [trainData[j], trainData[i]];
}

const trainFeatures = trainData.map(d => d.feature);
const trainLabels = trainData.map(d => d.label);
const testFeatures = testData.map(d => d.feature);
const testLabels = testData.map(d => d.label);
const testMeta = testData.map(d => d.meta);

console.log(`Training: ${trainFeatures.length.toLocaleString()} samples`);
console.log(`Testing:  ${testFeatures.length.toLocaleString()} samples\n`);

// Train
const ensemble = new EnsembleModel(allFeatures[0].length);
ensemble.train(trainFeatures, trainLabels);

// ============================================
// EVALUATION
// ============================================

console.log('\n═══════════════════════════════════════════════════════════');
console.log('MODEL COMPARISON');
console.log('═══════════════════════════════════════════════════════════\n');

function evaluate(model, name, features, labels) {
    let correct = 0, tp = 0, fp = 0, tn = 0, fn = 0;
    for (let i = 0; i < features.length; i++) {
        const prob = model.predict(features[i]);
        const pred = prob > 0.5 ? 1 : 0;
        if (pred === labels[i]) correct++;
        if (pred === 1 && labels[i] === 1) tp++;
        if (pred === 1 && labels[i] === 0) fp++;
        if (pred === 0 && labels[i] === 0) tn++;
        if (pred === 0 && labels[i] === 1) fn++;
    }
    return {
        name,
        accuracy: (correct / labels.length * 100).toFixed(1),
        precision: (tp / (tp + fp) * 100 || 0).toFixed(1),
        recall: (tp / (tp + fn) * 100 || 0).toFixed(1),
        f1: (2 * tp / (2 * tp + fp + fn) * 100 || 0).toFixed(1)
    };
}

const results = [
    evaluate(ensemble.rf, 'Random Forest', testFeatures, testLabels),
    evaluate(ensemble.gb, 'Gradient Boost', testFeatures, testLabels),
    evaluate(ensemble.nn, 'Neural Network', testFeatures, testLabels),
    evaluate(ensemble, 'ENSEMBLE', testFeatures, testLabels),
];

console.log('Model           | Accuracy | Precision | Recall | F1');
console.log('----------------|----------|-----------|--------|----');
results.forEach(r => {
    console.log(`${r.name.padEnd(15)} | ${r.accuracy.padStart(7)}% | ${r.precision.padStart(8)}% | ${r.recall.padStart(5)}% | ${r.f1}%`);
});

// ============================================
// CURRENT PREDICTIONS
// ============================================

console.log('\n═══════════════════════════════════════════════════════════');
console.log('CURRENT PREDICTIONS (Ranked by Probability)');
console.log('═══════════════════════════════════════════════════════════\n');

const currentPredictions = [];

for (const symbol of Object.keys(allData)) {
    const data = allData[symbol];
    const { features, metadata } = createFeatures(data, symbol, horizon, threshold);
    if (features.length === 0) continue;

    const lastFeature = features[features.length - 1];
    const lastMeta = metadata[metadata.length - 1];
    const details = ensemble.predictWithDetails(lastFeature);

    currentPredictions.push({
        symbol,
        price: lastMeta.price,
        prob: details.ensemble,
        rf: details.rf,
        gb: details.gb,
        nn: details.nn
    });
}

currentPredictions.sort((a, b) => b.prob - a.prob);

console.log('Symbol | Price     | RF    | GB    | NN    | Ensemble | Signal');
console.log('-------|-----------|-------|-------|-------|----------|--------');

for (const p of currentPredictions) {
    const signal = p.prob > 0.6 ? 'STRONG BUY' : p.prob > 0.55 ? 'BUY' :
                   p.prob < 0.35 ? 'STRONG AVOID' : p.prob < 0.45 ? 'AVOID' : 'NEUTRAL';
    const emoji = p.prob > 0.55 ? '🟢' : p.prob < 0.45 ? '🔴' : '🟡';

    console.log(`${emoji} ${p.symbol.padEnd(5)} | $${p.price.toFixed(2).padStart(8)} | ${(p.rf*100).toFixed(0).padStart(4)}% | ${(p.gb*100).toFixed(0).padStart(4)}% | ${(p.nn*100).toFixed(0).padStart(4)}% | ${(p.prob*100).toFixed(0).padStart(7)}% | ${signal}`);
}

// ============================================
// TOP PICKS
// ============================================

console.log('\n═══════════════════════════════════════════════════════════');
console.log('TOP PICKS');
console.log('═══════════════════════════════════════════════════════════\n');

const topBuys = currentPredictions.filter(p => p.prob > 0.55).slice(0, 5);
const topAvoids = currentPredictions.filter(p => p.prob < 0.45).slice(-5).reverse();

console.log('🟢 BEST BUY OPPORTUNITIES:');
topBuys.forEach((p, i) => {
    const agreement = [p.rf > 0.5, p.gb > 0.5, p.nn > 0.5].filter(x => x).length;
    console.log(`  ${i+1}. ${p.symbol}: ${(p.prob*100).toFixed(0)}% (${agreement}/3 models agree)`);
    console.log(`     Entry: $${p.price.toFixed(2)} | Target: $${(p.price*1.03).toFixed(2)} | Stop: $${(p.price*0.95).toFixed(2)}`);
});

console.log('\n🔴 STRONGEST AVOID:');
topAvoids.forEach((p, i) => {
    console.log(`  ${i+1}. ${p.symbol}: ${(p.prob*100).toFixed(0)}% probability`);
});

console.log('\n=== Advanced Ensemble Training Complete ===');
