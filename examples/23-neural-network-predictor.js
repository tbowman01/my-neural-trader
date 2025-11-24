/**
 * Neural Network Price Predictor
 *
 * Implements a simple neural network from scratch to predict
 * price direction based on technical indicators.
 *
 * Architecture: Input -> Hidden Layer -> Output (Binary Classification)
 */

const fs = require('fs');
const path = require('path');

console.log('=== Neural Network Price Predictor ===\n');

// Load data
const dataPath = path.join(__dirname, '../historical-data/AAPL-5-years.json');
const allData = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

// ============================================
// FEATURE ENGINEERING
// ============================================

function sma(prices, period) {
    return prices.map((_, i) => i < period - 1 ? null :
        prices.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0) / period);
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

function ema(prices, period) {
    const result = [], mult = 2 / (period + 1);
    let e = prices[0];
    for (let i = 0; i < prices.length; i++) {
        e = i === 0 ? prices[0] : (prices[i] - e) * mult + e;
        result.push(e);
    }
    return result;
}

function macd(prices) {
    const ema12 = ema(prices, 12), ema26 = ema(prices, 26);
    const line = ema12.map((v, i) => v - ema26[i]);
    const signal = ema(line, 9);
    return { histogram: line.map((v, i) => v - signal[i]) };
}

function createFeatures(data) {
    const prices = data.map(d => d.close);
    const { histogram } = macd(prices);
    const rsiValues = rsi(prices);
    const sma20 = sma(prices, 20);
    const sma50 = sma(prices, 50);
    const sma200 = sma(prices, 200);

    const features = [];
    const labels = [];

    // Start at index 200 to have all indicators
    for (let i = 200; i < prices.length - 5; i++) {
        // Skip if any indicator is null
        if (!sma20[i] || !sma50[i] || !sma200[i] || !rsiValues[i]) continue;

        // Features (normalized)
        const feature = [
            (prices[i] - sma20[i]) / sma20[i],           // Price vs SMA20
            (prices[i] - sma50[i]) / sma50[i],           // Price vs SMA50
            (prices[i] - sma200[i]) / sma200[i],         // Price vs SMA200
            (sma20[i] - sma50[i]) / sma50[i],            // SMA20 vs SMA50
            rsiValues[i] / 100,                           // RSI normalized
            histogram[i] / prices[i] * 10,               // MACD histogram
            (prices[i] - prices[i-5]) / prices[i-5],     // 5-day momentum
            (prices[i] - prices[i-10]) / prices[i-10],   // 10-day momentum
            (prices[i] - prices[i-20]) / prices[i-20],   // 20-day momentum
        ];

        // Label: 1 if price goes up 1%+ in 5 days, 0 otherwise
        const futureReturn = (prices[i + 5] - prices[i]) / prices[i];
        const label = futureReturn > 0.01 ? 1 : 0;

        features.push(feature);
        labels.push(label);
    }

    return { features, labels };
}

// ============================================
// NEURAL NETWORK FROM SCRATCH
// ============================================

class NeuralNetwork {
    constructor(inputSize, hiddenSize, outputSize) {
        this.inputSize = inputSize;
        this.hiddenSize = hiddenSize;
        this.outputSize = outputSize;

        // Initialize weights randomly
        this.weightsIH = this.randomMatrix(inputSize, hiddenSize);
        this.biasH = new Array(hiddenSize).fill(0);
        this.weightsHO = this.randomMatrix(hiddenSize, outputSize);
        this.biasO = new Array(outputSize).fill(0);
    }

    randomMatrix(rows, cols) {
        const matrix = [];
        for (let i = 0; i < rows; i++) {
            matrix[i] = [];
            for (let j = 0; j < cols; j++) {
                // Xavier initialization
                matrix[i][j] = (Math.random() - 0.5) * 2 / Math.sqrt(rows);
            }
        }
        return matrix;
    }

    sigmoid(x) {
        return 1 / (1 + Math.exp(-Math.max(-500, Math.min(500, x))));
    }

    sigmoidDerivative(x) {
        return x * (1 - x);
    }

    relu(x) {
        return Math.max(0, x);
    }

    reluDerivative(x) {
        return x > 0 ? 1 : 0;
    }

    forward(input) {
        // Input to Hidden
        this.hidden = new Array(this.hiddenSize).fill(0);
        for (let j = 0; j < this.hiddenSize; j++) {
            let sum = this.biasH[j];
            for (let i = 0; i < this.inputSize; i++) {
                sum += input[i] * this.weightsIH[i][j];
            }
            this.hidden[j] = this.relu(sum);
        }

        // Hidden to Output
        this.output = new Array(this.outputSize).fill(0);
        for (let k = 0; k < this.outputSize; k++) {
            let sum = this.biasO[k];
            for (let j = 0; j < this.hiddenSize; j++) {
                sum += this.hidden[j] * this.weightsHO[j][k];
            }
            this.output[k] = this.sigmoid(sum);
        }

        return this.output;
    }

    train(input, target, learningRate = 0.01) {
        // Forward pass
        this.forward(input);

        // Calculate output error
        const outputErrors = new Array(this.outputSize);
        for (let k = 0; k < this.outputSize; k++) {
            outputErrors[k] = target[k] - this.output[k];
        }

        // Calculate hidden errors
        const hiddenErrors = new Array(this.hiddenSize).fill(0);
        for (let j = 0; j < this.hiddenSize; j++) {
            for (let k = 0; k < this.outputSize; k++) {
                hiddenErrors[j] += outputErrors[k] * this.weightsHO[j][k];
            }
        }

        // Update weights HO
        for (let j = 0; j < this.hiddenSize; j++) {
            for (let k = 0; k < this.outputSize; k++) {
                const gradient = outputErrors[k] * this.sigmoidDerivative(this.output[k]);
                this.weightsHO[j][k] += learningRate * gradient * this.hidden[j];
            }
        }

        // Update bias O
        for (let k = 0; k < this.outputSize; k++) {
            const gradient = outputErrors[k] * this.sigmoidDerivative(this.output[k]);
            this.biasO[k] += learningRate * gradient;
        }

        // Update weights IH
        for (let i = 0; i < this.inputSize; i++) {
            for (let j = 0; j < this.hiddenSize; j++) {
                const gradient = hiddenErrors[j] * this.reluDerivative(this.hidden[j]);
                this.weightsIH[i][j] += learningRate * gradient * input[i];
            }
        }

        // Update bias H
        for (let j = 0; j < this.hiddenSize; j++) {
            const gradient = hiddenErrors[j] * this.reluDerivative(this.hidden[j]);
            this.biasH[j] += learningRate * gradient;
        }

        return outputErrors[0] * outputErrors[0]; // MSE
    }

    predict(input) {
        return this.forward(input)[0];
    }
}

// ============================================
// TRAINING
// ============================================

console.log('Creating features...');
const { features, labels } = createFeatures(allData);
console.log(`Created ${features.length} samples\n`);

// Split data 70/30
const splitIdx = Math.floor(features.length * 0.7);
const trainFeatures = features.slice(0, splitIdx);
const trainLabels = labels.slice(0, splitIdx);
const testFeatures = features.slice(splitIdx);
const testLabels = labels.slice(splitIdx);

console.log(`Training samples: ${trainFeatures.length}`);
console.log(`Test samples: ${testFeatures.length}\n`);

// Create network
const nn = new NeuralNetwork(9, 16, 1);

console.log('Training neural network...');
console.log('═══════════════════════════════════════════════════════════\n');

const epochs = 100;
const learningRate = 0.01;

for (let epoch = 0; epoch < epochs; epoch++) {
    let totalLoss = 0;
    let correct = 0;

    // Shuffle training data
    const indices = Array.from({length: trainFeatures.length}, (_, i) => i);
    for (let i = indices.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [indices[i], indices[j]] = [indices[j], indices[i]];
    }

    // Train on each sample
    for (const idx of indices) {
        const loss = nn.train(trainFeatures[idx], [trainLabels[idx]], learningRate);
        totalLoss += loss;

        // Check accuracy
        const prediction = nn.predict(trainFeatures[idx]) > 0.5 ? 1 : 0;
        if (prediction === trainLabels[idx]) correct++;
    }

    const accuracy = (correct / trainFeatures.length) * 100;

    if ((epoch + 1) % 10 === 0 || epoch === 0) {
        console.log(`Epoch ${epoch + 1}/${epochs}: Loss = ${(totalLoss / trainFeatures.length).toFixed(4)}, Accuracy = ${accuracy.toFixed(1)}%`);
    }
}

// ============================================
// EVALUATION
// ============================================

console.log('\n═══════════════════════════════════════════════════════════');
console.log('EVALUATION ON TEST DATA');
console.log('═══════════════════════════════════════════════════════════\n');

let testCorrect = 0;
let truePositives = 0, falsePositives = 0, trueNegatives = 0, falseNegatives = 0;

const predictions = [];
for (let i = 0; i < testFeatures.length; i++) {
    const prob = nn.predict(testFeatures[i]);
    const prediction = prob > 0.5 ? 1 : 0;
    predictions.push({ prob, prediction, actual: testLabels[i] });

    if (prediction === testLabels[i]) testCorrect++;

    if (prediction === 1 && testLabels[i] === 1) truePositives++;
    if (prediction === 1 && testLabels[i] === 0) falsePositives++;
    if (prediction === 0 && testLabels[i] === 0) trueNegatives++;
    if (prediction === 0 && testLabels[i] === 1) falseNegatives++;
}

const accuracy = (testCorrect / testFeatures.length) * 100;
const precision = truePositives / (truePositives + falsePositives) * 100 || 0;
const recall = truePositives / (truePositives + falseNegatives) * 100 || 0;
const f1 = 2 * (precision * recall) / (precision + recall) || 0;

console.log('Confusion Matrix:');
console.log(`                  Predicted`);
console.log(`                  Down  | Up`);
console.log(`           Down | ${String(trueNegatives).padStart(4)} | ${String(falsePositives).padStart(4)}`);
console.log(`  Actual   Up   | ${String(falseNegatives).padStart(4)} | ${String(truePositives).padStart(4)}`);
console.log('');

console.log(`Accuracy:  ${accuracy.toFixed(1)}%`);
console.log(`Precision: ${precision.toFixed(1)}% (when we predict UP, how often correct)`);
console.log(`Recall:    ${recall.toFixed(1)}% (of actual UPs, how many we caught)`);
console.log(`F1 Score:  ${f1.toFixed(1)}%`);

// ============================================
// BACKTESTING THE NEURAL NETWORK
// ============================================

console.log('\n═══════════════════════════════════════════════════════════');
console.log('BACKTESTING NEURAL NETWORK SIGNALS');
console.log('═══════════════════════════════════════════════════════════\n');

// Backtest on test period
const testData = allData.slice(Math.floor(allData.length * 0.7));
const testPrices = testData.map(d => d.close);

let cash = 10000, shares = 0, entryPrice = 0;
let trades = 0, wins = 0;

// We need to realign features with test data
const testStartIdx = 200; // Skip first 200 for indicators

for (let i = 0; i < Math.min(testFeatures.length, testPrices.length - testStartIdx); i++) {
    const price = testPrices[i + testStartIdx] || testPrices[testPrices.length - 1];
    const prob = nn.predict(testFeatures[i]);

    // Trading logic
    if (shares > 0) {
        const pnlPct = ((price - entryPrice) / entryPrice) * 100;
        // Exit on NN bearish or stops
        if (prob < 0.4 || pnlPct <= -5 || pnlPct >= 10) {
            cash = shares * price;
            trades++;
            if (pnlPct > 0) wins++;
            shares = 0;
        }
    }

    // Enter on NN bullish
    if (shares === 0 && prob > 0.6) {
        shares = cash / price;
        entryPrice = price;
        cash = 0;
    }
}

// Close final position
if (shares > 0) {
    cash = shares * testPrices[testPrices.length - 1];
}

const nnReturn = ((cash - 10000) / 10000) * 100;
const bhReturn = ((testPrices[testPrices.length - 1] - testPrices[testStartIdx]) / testPrices[testStartIdx]) * 100;

console.log('Neural Network Trading Results:');
console.log(`  NN Strategy Return: ${nnReturn.toFixed(1)}%`);
console.log(`  Buy & Hold Return:  ${bhReturn.toFixed(1)}%`);
console.log(`  Trades:             ${trades}`);
console.log(`  Win Rate:           ${trades > 0 ? (wins/trades*100).toFixed(0) : 0}%`);

// ============================================
// FEATURE IMPORTANCE
// ============================================

console.log('\n═══════════════════════════════════════════════════════════');
console.log('FEATURE IMPORTANCE (Weight Analysis)');
console.log('═══════════════════════════════════════════════════════════\n');

const featureNames = [
    'Price vs SMA20',
    'Price vs SMA50',
    'Price vs SMA200',
    'SMA20 vs SMA50',
    'RSI',
    'MACD Histogram',
    '5-day Momentum',
    '10-day Momentum',
    '20-day Momentum'
];

// Calculate average absolute weight for each input feature
const importance = featureNames.map((name, i) => {
    let totalWeight = 0;
    for (let j = 0; j < nn.hiddenSize; j++) {
        totalWeight += Math.abs(nn.weightsIH[i][j]);
    }
    return { name, importance: totalWeight / nn.hiddenSize };
});

importance.sort((a, b) => b.importance - a.importance);

console.log('Feature           | Importance');
console.log('------------------|------------');
importance.forEach(f => {
    const bar = '█'.repeat(Math.round(f.importance * 20));
    console.log(`${f.name.padEnd(17)} | ${bar} ${f.importance.toFixed(3)}`);
});

// ============================================
// CURRENT PREDICTION
// ============================================

console.log('\n═══════════════════════════════════════════════════════════');
console.log('CURRENT PREDICTION');
console.log('═══════════════════════════════════════════════════════════\n');

// Get latest feature
const lastFeature = features[features.length - 1];
const currentProb = nn.predict(lastFeature);
const currentSignal = currentProb > 0.5 ? 'BULLISH' : 'BEARISH';
const confidence = Math.abs(currentProb - 0.5) * 2 * 100;

console.log(`AAPL Next 5 Days:`);
console.log(`  Probability UP: ${(currentProb * 100).toFixed(1)}%`);
console.log(`  Signal: ${currentSignal}`);
console.log(`  Confidence: ${confidence.toFixed(0)}%`);

console.log('\n=== Neural Network Training Complete ===');
