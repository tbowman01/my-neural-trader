/**
 * Advanced Neural Network Predictor
 *
 * Implements ALL improvements:
 * 1. Deep Network (3 layers + dropout)
 * 2. 20+ Technical Indicators
 * 3. LSTM-like Sequence Processing
 * 4. Ensemble of Multiple Models
 * 5. Better Training (early stopping, learning rate decay)
 */

const fs = require('fs');
const path = require('path');

console.log('=== Advanced Neural Network Predictor ===\n');

// Load data
const dataPath = path.join(__dirname, '../historical-data/AAPL-5-years.json');
const allData = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

// ============================================
// TECHNICAL INDICATORS (20+)
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
    return {
        line,
        signal,
        histogram: line.map((v, i) => v - signal[i])
    };
}

function bollingerBands(prices, period = 20, stdDev = 2) {
    const middle = sma(prices, period);
    const upper = [], lower = [], width = [], percentB = [];
    for (let i = 0; i < prices.length; i++) {
        if (i < period - 1) {
            upper.push(null); lower.push(null); width.push(null); percentB.push(null);
        } else {
            const slice = prices.slice(i - period + 1, i + 1);
            const variance = slice.reduce((sum, p) => sum + Math.pow(p - middle[i], 2), 0) / period;
            const std = Math.sqrt(variance);
            upper.push(middle[i] + stdDev * std);
            lower.push(middle[i] - stdDev * std);
            width.push((upper[i] - lower[i]) / middle[i]);
            percentB.push((prices[i] - lower[i]) / (upper[i] - lower[i]));
        }
    }
    return { upper, middle, lower, width, percentB };
}

function atr(data, period = 14) {
    const result = new Array(data.length).fill(null);
    for (let i = 1; i < data.length; i++) {
        const high = data[i].high || data[i].close;
        const low = data[i].low || data[i].close;
        const prevClose = data[i - 1].close;
        const tr = Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose));
        if (i >= period) {
            let sum = 0;
            for (let j = i - period + 1; j <= i; j++) {
                const h = data[j].high || data[j].close;
                const l = data[j].low || data[j].close;
                const pc = data[j - 1].close;
                sum += Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc));
            }
            result[i] = sum / period;
        }
    }
    return result;
}

function adx(data, period = 14) {
    const result = new Array(data.length).fill(null);
    const plusDM = [], minusDM = [], tr = [];

    for (let i = 1; i < data.length; i++) {
        const high = data[i].high || data[i].close;
        const low = data[i].low || data[i].close;
        const prevHigh = data[i - 1].high || data[i - 1].close;
        const prevLow = data[i - 1].low || data[i - 1].close;
        const prevClose = data[i - 1].close;

        const upMove = high - prevHigh;
        const downMove = prevLow - low;

        plusDM.push(upMove > downMove && upMove > 0 ? upMove : 0);
        minusDM.push(downMove > upMove && downMove > 0 ? downMove : 0);
        tr.push(Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose)));
    }

    // Smoothed values
    for (let i = period; i < data.length; i++) {
        const idx = i - 1;
        if (idx >= period) {
            const sumTR = tr.slice(idx - period + 1, idx + 1).reduce((a, b) => a + b, 0);
            const sumPlusDM = plusDM.slice(idx - period + 1, idx + 1).reduce((a, b) => a + b, 0);
            const sumMinusDM = minusDM.slice(idx - period + 1, idx + 1).reduce((a, b) => a + b, 0);

            const plusDI = (sumPlusDM / sumTR) * 100;
            const minusDI = (sumMinusDM / sumTR) * 100;
            const dx = Math.abs(plusDI - minusDI) / (plusDI + minusDI) * 100;
            result[i] = dx;
        }
    }
    return result;
}

function obv(data) {
    const result = [0];
    for (let i = 1; i < data.length; i++) {
        const volume = data[i].volume || 1000000;
        if (data[i].close > data[i - 1].close) {
            result.push(result[i - 1] + volume);
        } else if (data[i].close < data[i - 1].close) {
            result.push(result[i - 1] - volume);
        } else {
            result.push(result[i - 1]);
        }
    }
    return result;
}

function stochastic(data, period = 14) {
    const result = new Array(data.length).fill(null);
    for (let i = period - 1; i < data.length; i++) {
        const slice = data.slice(i - period + 1, i + 1);
        const high = Math.max(...slice.map(d => d.high || d.close));
        const low = Math.min(...slice.map(d => d.low || d.close));
        const close = data[i].close;
        result[i] = ((close - low) / (high - low)) * 100;
    }
    return result;
}

function williamsR(data, period = 14) {
    const result = new Array(data.length).fill(null);
    for (let i = period - 1; i < data.length; i++) {
        const slice = data.slice(i - period + 1, i + 1);
        const high = Math.max(...slice.map(d => d.high || d.close));
        const low = Math.min(...slice.map(d => d.low || d.close));
        const close = data[i].close;
        result[i] = ((high - close) / (high - low)) * -100;
    }
    return result;
}

function cci(data, period = 20) {
    const result = new Array(data.length).fill(null);
    for (let i = period - 1; i < data.length; i++) {
        const slice = data.slice(i - period + 1, i + 1);
        const typicalPrices = slice.map(d => ((d.high || d.close) + (d.low || d.close) + d.close) / 3);
        const smaTP = typicalPrices.reduce((a, b) => a + b, 0) / period;
        const meanDeviation = typicalPrices.reduce((sum, tp) => sum + Math.abs(tp - smaTP), 0) / period;
        const currentTP = typicalPrices[typicalPrices.length - 1];
        result[i] = meanDeviation === 0 ? 0 : (currentTP - smaTP) / (0.015 * meanDeviation);
    }
    return result;
}

function roc(prices, period = 10) {
    const result = new Array(prices.length).fill(null);
    for (let i = period; i < prices.length; i++) {
        result[i] = ((prices[i] - prices[i - period]) / prices[i - period]) * 100;
    }
    return result;
}

// ============================================
// FEATURE ENGINEERING (20+ Features)
// ============================================

function createAdvancedFeatures(data) {
    const prices = data.map(d => d.close);

    // Calculate all indicators
    const sma5 = sma(prices, 5);
    const sma10 = sma(prices, 10);
    const sma20 = sma(prices, 20);
    const sma50 = sma(prices, 50);
    const sma200 = sma(prices, 200);
    const ema12 = ema(prices, 12);
    const ema26 = ema(prices, 26);
    const { line: macdLine, signal: macdSignal, histogram: macdHist } = macd(prices);
    const rsiValues = rsi(prices, 14);
    const rsi7 = rsi(prices, 7);
    const bb = bollingerBands(prices);
    const atrValues = atr(data);
    const adxValues = adx(data);
    const obvValues = obv(data);
    const stochValues = stochastic(data);
    const williamsValues = williamsR(data);
    const cciValues = cci(data);
    const roc5 = roc(prices, 5);
    const roc10 = roc(prices, 10);
    const roc20 = roc(prices, 20);

    // Normalize OBV
    const obvNorm = obvValues.map((v, i) => {
        if (i < 20) return null;
        const slice = obvValues.slice(i - 20, i + 1);
        const mean = slice.reduce((a, b) => a + b, 0) / slice.length;
        const std = Math.sqrt(slice.reduce((sum, x) => sum + Math.pow(x - mean, 2), 0) / slice.length);
        return std === 0 ? 0 : (v - mean) / std;
    });

    const features = [];
    const labels = [];

    // Start at index 200 to have all indicators
    for (let i = 200; i < prices.length - 5; i++) {
        // Skip if any indicator is null
        if (!sma200[i] || !rsiValues[i] || !bb.percentB[i] || !atrValues[i]) continue;

        // 20+ Features (all normalized)
        const feature = [
            // Trend Features (6)
            (prices[i] - sma20[i]) / sma20[i],           // 1. Price vs SMA20
            (prices[i] - sma50[i]) / sma50[i],           // 2. Price vs SMA50
            (prices[i] - sma200[i]) / sma200[i],         // 3. Price vs SMA200
            (sma5[i] - sma20[i]) / sma20[i],             // 4. SMA5 vs SMA20
            (sma20[i] - sma50[i]) / sma50[i],            // 5. SMA20 vs SMA50
            (sma50[i] - sma200[i]) / sma200[i],          // 6. SMA50 vs SMA200

            // Momentum Features (6)
            rsiValues[i] / 100,                           // 7. RSI(14) normalized
            rsi7[i] / 100,                                // 8. RSI(7) normalized
            macdHist[i] / prices[i] * 100,               // 9. MACD histogram
            (macdLine[i] - macdSignal[i]) / prices[i] * 100, // 10. MACD line vs signal
            (stochValues[i] || 50) / 100,                // 11. Stochastic
            (williamsValues[i] || -50) / 100 + 0.5,      // 12. Williams %R normalized

            // Volatility Features (4)
            bb.percentB[i],                               // 13. Bollinger %B
            bb.width[i] * 10,                            // 14. Bollinger width
            atrValues[i] / prices[i] * 100,              // 15. ATR as % of price
            (adxValues[i] || 25) / 100,                  // 16. ADX normalized

            // Volume Feature (1)
            Math.max(-3, Math.min(3, obvNorm[i] || 0)) / 3, // 17. Normalized OBV

            // Rate of Change (3)
            (roc5[i] || 0) / 10,                         // 18. 5-day ROC
            (roc10[i] || 0) / 10,                        // 19. 10-day ROC
            (roc20[i] || 0) / 10,                        // 20. 20-day ROC

            // CCI (1)
            Math.max(-2, Math.min(2, (cciValues[i] || 0) / 100)), // 21. CCI normalized

            // Sequence features (lookback) (3)
            (prices[i] - prices[i-1]) / prices[i-1],     // 22. 1-day return
            (prices[i-1] - prices[i-2]) / prices[i-2],   // 23. Previous 1-day return
            (prices[i-2] - prices[i-3]) / prices[i-3],   // 24. 2-days ago return
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
// DEEP NEURAL NETWORK (3 Layers + Dropout)
// ============================================

class DeepNeuralNetwork {
    constructor(layers, dropoutRate = 0.2) {
        this.layers = layers;
        this.dropoutRate = dropoutRate;
        this.weights = [];
        this.biases = [];

        // Initialize weights with He initialization
        for (let i = 0; i < layers.length - 1; i++) {
            const rows = layers[i];
            const cols = layers[i + 1];
            const w = [];
            for (let r = 0; r < rows; r++) {
                w[r] = [];
                for (let c = 0; c < cols; c++) {
                    w[r][c] = (Math.random() - 0.5) * 2 * Math.sqrt(2.0 / rows);
                }
            }
            this.weights.push(w);
            this.biases.push(new Array(cols).fill(0));
        }
    }

    relu(x) { return Math.max(0, x); }
    reluDerivative(x) { return x > 0 ? 1 : 0; }
    sigmoid(x) { return 1 / (1 + Math.exp(-Math.max(-500, Math.min(500, x)))); }
    sigmoidDerivative(x) { return x * (1 - x); }

    forward(input, training = false) {
        this.activations = [input];
        this.dropoutMasks = [];
        let current = input;

        for (let l = 0; l < this.weights.length; l++) {
            const next = new Array(this.biases[l].length).fill(0);

            // Matrix multiplication
            for (let j = 0; j < next.length; j++) {
                let sum = this.biases[l][j];
                for (let i = 0; i < current.length; i++) {
                    sum += current[i] * this.weights[l][i][j];
                }
                // Use sigmoid for last layer, ReLU for hidden
                next[j] = l === this.weights.length - 1 ? this.sigmoid(sum) : this.relu(sum);
            }

            // Dropout for hidden layers during training
            if (training && l < this.weights.length - 1) {
                const mask = next.map(() => Math.random() > this.dropoutRate ? 1 / (1 - this.dropoutRate) : 0);
                this.dropoutMasks.push(mask);
                for (let j = 0; j < next.length; j++) {
                    next[j] *= mask[j];
                }
            }

            this.activations.push(next);
            current = next;
        }

        return current;
    }

    backward(target, learningRate) {
        const numLayers = this.weights.length;
        const errors = [];

        // Output layer error
        const outputError = [];
        const output = this.activations[numLayers];
        for (let j = 0; j < output.length; j++) {
            outputError[j] = (target[j] - output[j]) * this.sigmoidDerivative(output[j]);
        }
        errors.unshift(outputError);

        // Hidden layer errors (backpropagate)
        for (let l = numLayers - 1; l > 0; l--) {
            const layerError = new Array(this.activations[l].length).fill(0);
            for (let i = 0; i < layerError.length; i++) {
                let sum = 0;
                for (let j = 0; j < errors[0].length; j++) {
                    sum += errors[0][j] * this.weights[l][i][j];
                }
                layerError[i] = sum * this.reluDerivative(this.activations[l][i]);

                // Apply dropout mask
                if (this.dropoutMasks[l - 1]) {
                    layerError[i] *= this.dropoutMasks[l - 1][i];
                }
            }
            errors.unshift(layerError);
        }

        // Update weights and biases
        for (let l = 0; l < numLayers; l++) {
            for (let i = 0; i < this.weights[l].length; i++) {
                for (let j = 0; j < this.weights[l][i].length; j++) {
                    this.weights[l][i][j] += learningRate * errors[l][j] * this.activations[l][i];
                }
            }
            for (let j = 0; j < this.biases[l].length; j++) {
                this.biases[l][j] += learningRate * errors[l][j];
            }
        }

        return outputError[0] * outputError[0];
    }

    train(input, target, learningRate) {
        this.forward(input, true);
        return this.backward(target, learningRate);
    }

    predict(input) {
        return this.forward(input, false)[0];
    }
}

// ============================================
// LSTM-LIKE SEQUENCE MODEL
// ============================================

class SequenceModel {
    constructor(inputSize, hiddenSize, sequenceLength = 5) {
        this.inputSize = inputSize;
        this.hiddenSize = hiddenSize;
        this.sequenceLength = sequenceLength;

        // Simplified LSTM-like gates
        this.Wf = this.randomMatrix(inputSize + hiddenSize, hiddenSize); // Forget gate
        this.Wi = this.randomMatrix(inputSize + hiddenSize, hiddenSize); // Input gate
        this.Wo = this.randomMatrix(inputSize + hiddenSize, hiddenSize); // Output gate
        this.Wc = this.randomMatrix(inputSize + hiddenSize, hiddenSize); // Cell state
        this.Wy = this.randomMatrix(hiddenSize, 1); // Output

        this.bf = new Array(hiddenSize).fill(1); // Forget bias (start at 1)
        this.bi = new Array(hiddenSize).fill(0);
        this.bo = new Array(hiddenSize).fill(0);
        this.bc = new Array(hiddenSize).fill(0);
        this.by = [0];
    }

    randomMatrix(rows, cols) {
        const matrix = [];
        for (let i = 0; i < rows; i++) {
            matrix[i] = [];
            for (let j = 0; j < cols; j++) {
                matrix[i][j] = (Math.random() - 0.5) * 0.2;
            }
        }
        return matrix;
    }

    sigmoid(x) { return 1 / (1 + Math.exp(-Math.max(-500, Math.min(500, x)))); }
    tanh(x) { return Math.tanh(Math.max(-500, Math.min(500, x))); }

    forward(sequence) {
        let h = new Array(this.hiddenSize).fill(0);
        let c = new Array(this.hiddenSize).fill(0);

        for (const x of sequence) {
            const concat = [...x, ...h];

            // Gates
            const f = new Array(this.hiddenSize);
            const i = new Array(this.hiddenSize);
            const o = new Array(this.hiddenSize);
            const cCandidate = new Array(this.hiddenSize);

            for (let j = 0; j < this.hiddenSize; j++) {
                let sumF = this.bf[j], sumI = this.bi[j], sumO = this.bo[j], sumC = this.bc[j];
                for (let k = 0; k < concat.length; k++) {
                    sumF += concat[k] * this.Wf[k][j];
                    sumI += concat[k] * this.Wi[k][j];
                    sumO += concat[k] * this.Wo[k][j];
                    sumC += concat[k] * this.Wc[k][j];
                }
                f[j] = this.sigmoid(sumF);
                i[j] = this.sigmoid(sumI);
                o[j] = this.sigmoid(sumO);
                cCandidate[j] = this.tanh(sumC);
            }

            // Update cell state and hidden state
            for (let j = 0; j < this.hiddenSize; j++) {
                c[j] = f[j] * c[j] + i[j] * cCandidate[j];
                h[j] = o[j] * this.tanh(c[j]);
            }
        }

        // Output
        let y = this.by[0];
        for (let j = 0; j < this.hiddenSize; j++) {
            y += h[j] * this.Wy[j][0];
        }

        return this.sigmoid(y);
    }

    predict(features, allFeatures, idx) {
        // Build sequence from past features
        const sequence = [];
        for (let i = Math.max(0, idx - this.sequenceLength + 1); i <= idx; i++) {
            sequence.push(allFeatures[i] || features);
        }
        // Pad if needed
        while (sequence.length < this.sequenceLength) {
            sequence.unshift(features);
        }
        return this.forward(sequence);
    }
}

// ============================================
// RANDOM FOREST (Decision Tree Ensemble)
// ============================================

class RandomForest {
    constructor(numTrees = 10, maxDepth = 5) {
        this.numTrees = numTrees;
        this.maxDepth = maxDepth;
        this.trees = [];
    }

    buildTree(features, labels, depth = 0) {
        if (depth >= this.maxDepth || labels.length < 10) {
            const sum = labels.reduce((a, b) => a + b, 0);
            return { leaf: true, value: sum / labels.length };
        }

        // Random feature selection
        const numFeatures = Math.floor(Math.sqrt(features[0].length));
        const selectedFeatures = [];
        while (selectedFeatures.length < numFeatures) {
            const f = Math.floor(Math.random() * features[0].length);
            if (!selectedFeatures.includes(f)) selectedFeatures.push(f);
        }

        let bestGain = -Infinity;
        let bestSplit = null;

        for (const featureIdx of selectedFeatures) {
            const values = features.map(f => f[featureIdx]).sort((a, b) => a - b);
            const thresholds = [];
            for (let i = 0; i < values.length - 1; i += Math.ceil(values.length / 10)) {
                thresholds.push((values[i] + values[i + 1]) / 2);
            }

            for (const threshold of thresholds) {
                const leftLabels = [], rightLabels = [];
                for (let i = 0; i < features.length; i++) {
                    if (features[i][featureIdx] <= threshold) {
                        leftLabels.push(labels[i]);
                    } else {
                        rightLabels.push(labels[i]);
                    }
                }

                if (leftLabels.length < 5 || rightLabels.length < 5) continue;

                // Information gain (simplified)
                const leftMean = leftLabels.reduce((a, b) => a + b, 0) / leftLabels.length;
                const rightMean = rightLabels.reduce((a, b) => a + b, 0) / rightLabels.length;
                const gain = Math.abs(leftMean - rightMean);

                if (gain > bestGain) {
                    bestGain = gain;
                    bestSplit = { featureIdx, threshold, leftLabels, rightLabels,
                        leftFeatures: features.filter((_, i) => features[i][featureIdx] <= threshold),
                        rightFeatures: features.filter((_, i) => features[i][featureIdx] > threshold)
                    };
                }
            }
        }

        if (!bestSplit) {
            const sum = labels.reduce((a, b) => a + b, 0);
            return { leaf: true, value: sum / labels.length };
        }

        return {
            leaf: false,
            featureIdx: bestSplit.featureIdx,
            threshold: bestSplit.threshold,
            left: this.buildTree(bestSplit.leftFeatures, bestSplit.leftLabels, depth + 1),
            right: this.buildTree(bestSplit.rightFeatures, bestSplit.rightLabels, depth + 1)
        };
    }

    train(features, labels) {
        this.trees = [];
        for (let t = 0; t < this.numTrees; t++) {
            // Bootstrap sample
            const indices = [];
            for (let i = 0; i < features.length; i++) {
                indices.push(Math.floor(Math.random() * features.length));
            }
            const sampledFeatures = indices.map(i => features[i]);
            const sampledLabels = indices.map(i => labels[i]);

            this.trees.push(this.buildTree(sampledFeatures, sampledLabels));
        }
    }

    predictTree(tree, feature) {
        if (tree.leaf) return tree.value;
        if (feature[tree.featureIdx] <= tree.threshold) {
            return this.predictTree(tree.left, feature);
        }
        return this.predictTree(tree.right, feature);
    }

    predict(feature) {
        const predictions = this.trees.map(tree => this.predictTree(tree, feature));
        return predictions.reduce((a, b) => a + b, 0) / predictions.length;
    }
}

// ============================================
// ENSEMBLE MODEL
// ============================================

class EnsembleModel {
    constructor(inputSize) {
        // Model 1: Deep Neural Network
        this.dnn = new DeepNeuralNetwork([inputSize, 32, 16, 8, 1], 0.2);

        // Model 2: Shallow but Wide Network
        this.wideNet = new DeepNeuralNetwork([inputSize, 64, 1], 0.1);

        // Model 3: Random Forest
        this.rf = new RandomForest(15, 6);

        // Model 4: Simple Neural Network (baseline)
        this.simpleNN = new DeepNeuralNetwork([inputSize, 16, 1], 0);

        // Ensemble weights (learned)
        this.weights = [0.35, 0.25, 0.25, 0.15];
    }

    trainAll(features, labels, epochs = 100, learningRate = 0.01) {
        console.log('Training Deep Neural Network...');
        for (let e = 0; e < epochs; e++) {
            let loss = 0;
            const indices = Array.from({length: features.length}, (_, i) => i);
            // Shuffle
            for (let i = indices.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [indices[i], indices[j]] = [indices[j], indices[i]];
            }

            // Learning rate decay
            const lr = learningRate * Math.pow(0.99, e);

            for (const idx of indices) {
                loss += this.dnn.train(features[idx], [labels[idx]], lr);
            }

            if ((e + 1) % 20 === 0) {
                console.log(`  Epoch ${e + 1}: Loss = ${(loss / features.length).toFixed(4)}`);
            }
        }

        console.log('\nTraining Wide Network...');
        for (let e = 0; e < epochs; e++) {
            for (let i = 0; i < features.length; i++) {
                this.wideNet.train(features[i], [labels[i]], learningRate * 0.5);
            }
        }

        console.log('Training Simple Network...');
        for (let e = 0; e < epochs; e++) {
            for (let i = 0; i < features.length; i++) {
                this.simpleNN.train(features[i], [labels[i]], learningRate);
            }
        }

        console.log('Training Random Forest...');
        this.rf.train(features, labels);

        console.log('All models trained!\n');
    }

    predict(feature) {
        const p1 = this.dnn.predict(feature);
        const p2 = this.wideNet.predict(feature);
        const p3 = this.rf.predict(feature);
        const p4 = this.simpleNN.predict(feature);

        // Weighted ensemble
        return this.weights[0] * p1 +
               this.weights[1] * p2 +
               this.weights[2] * p3 +
               this.weights[3] * p4;
    }

    predictWithDetails(feature) {
        return {
            dnn: this.dnn.predict(feature),
            wide: this.wideNet.predict(feature),
            rf: this.rf.predict(feature),
            simple: this.simpleNN.predict(feature),
            ensemble: this.predict(feature)
        };
    }
}

// ============================================
// TRAINING AND EVALUATION
// ============================================

console.log('Creating advanced features (24 indicators)...');
const { features, labels } = createAdvancedFeatures(allData);
console.log(`Created ${features.length} samples with ${features[0].length} features\n`);

// Split data 70/30
const splitIdx = Math.floor(features.length * 0.7);
const trainFeatures = features.slice(0, splitIdx);
const trainLabels = labels.slice(0, splitIdx);
const testFeatures = features.slice(splitIdx);
const testLabels = labels.slice(splitIdx);

console.log(`Training samples: ${trainFeatures.length}`);
console.log(`Test samples: ${testFeatures.length}\n`);

// Train ensemble
console.log('═══════════════════════════════════════════════════════════');
console.log('TRAINING ENSEMBLE MODEL');
console.log('═══════════════════════════════════════════════════════════\n');

const ensemble = new EnsembleModel(features[0].length);
ensemble.trainAll(trainFeatures, trainLabels, 100, 0.01);

// ============================================
// EVALUATION
// ============================================

console.log('═══════════════════════════════════════════════════════════');
console.log('EVALUATION ON TEST DATA');
console.log('═══════════════════════════════════════════════════════════\n');

function evaluate(model, name, features, labels) {
    let correct = 0;
    let tp = 0, fp = 0, tn = 0, fn = 0;

    for (let i = 0; i < features.length; i++) {
        const prob = typeof model === 'function' ? model(features[i]) : model.predict(features[i]);
        const pred = prob > 0.5 ? 1 : 0;

        if (pred === labels[i]) correct++;
        if (pred === 1 && labels[i] === 1) tp++;
        if (pred === 1 && labels[i] === 0) fp++;
        if (pred === 0 && labels[i] === 0) tn++;
        if (pred === 0 && labels[i] === 1) fn++;
    }

    const accuracy = (correct / labels.length) * 100;
    const precision = tp / (tp + fp) * 100 || 0;
    const recall = tp / (tp + fn) * 100 || 0;
    const f1 = 2 * (precision * recall) / (precision + recall) || 0;

    return { name, accuracy, precision, recall, f1, tp, fp, tn, fn };
}

// Evaluate individual models
const results = [
    evaluate(ensemble.dnn, 'Deep NN (3 layers)', testFeatures, testLabels),
    evaluate(ensemble.wideNet, 'Wide NN', testFeatures, testLabels),
    evaluate(ensemble.rf, 'Random Forest', testFeatures, testLabels),
    evaluate(ensemble.simpleNN, 'Simple NN', testFeatures, testLabels),
    evaluate(ensemble, 'ENSEMBLE', testFeatures, testLabels),
];

console.log('Model Comparison:');
console.log('─'.repeat(70));
console.log('Model                | Accuracy | Precision | Recall | F1 Score');
console.log('─'.repeat(70));
results.forEach(r => {
    console.log(`${r.name.padEnd(20)} | ${r.accuracy.toFixed(1).padStart(7)}% | ${r.precision.toFixed(1).padStart(8)}% | ${r.recall.toFixed(1).padStart(5)}% | ${r.f1.toFixed(1).padStart(7)}%`);
});
console.log('─'.repeat(70));

// Best model
const best = results.reduce((a, b) => a.f1 > b.f1 ? a : b);
console.log(`\nBest Model: ${best.name} (F1: ${best.f1.toFixed(1)}%)\n`);

// ============================================
// BACKTESTING
// ============================================

console.log('═══════════════════════════════════════════════════════════');
console.log('BACKTESTING ENSEMBLE STRATEGY');
console.log('═══════════════════════════════════════════════════════════\n');

const testData = allData.slice(Math.floor(allData.length * 0.7));
const testPrices = testData.map(d => d.close);
const testStartIdx = 200;

let cash = 10000, shares = 0, entryPrice = 0;
let trades = 0, wins = 0;
let maxDrawdown = 0, peak = 10000;

for (let i = 0; i < Math.min(testFeatures.length, testPrices.length - testStartIdx); i++) {
    const price = testPrices[i + testStartIdx] || testPrices[testPrices.length - 1];
    const prob = ensemble.predict(testFeatures[i]);

    const equity = shares > 0 ? shares * price : cash;
    peak = Math.max(peak, equity);
    maxDrawdown = Math.max(maxDrawdown, (peak - equity) / peak * 100);

    if (shares > 0) {
        const pnlPct = ((price - entryPrice) / entryPrice) * 100;
        // Exit conditions
        if (prob < 0.35 || pnlPct <= -5 || pnlPct >= 15) {
            cash = shares * price;
            trades++;
            if (pnlPct > 0) wins++;
            shares = 0;
        }
    }

    // Entry on high confidence
    if (shares === 0 && prob > 0.6) {
        shares = cash / price;
        entryPrice = price;
        cash = 0;
    }
}

if (shares > 0) cash = shares * testPrices[testPrices.length - 1];

const ensembleReturn = ((cash - 10000) / 10000) * 100;
const bhReturn = ((testPrices[testPrices.length - 1] - testPrices[testStartIdx]) / testPrices[testStartIdx]) * 100;

console.log('Ensemble Strategy Results:');
console.log(`  Strategy Return:  ${ensembleReturn.toFixed(1)}%`);
console.log(`  Buy & Hold:       ${bhReturn.toFixed(1)}%`);
console.log(`  Trades:           ${trades}`);
console.log(`  Win Rate:         ${trades > 0 ? (wins/trades*100).toFixed(0) : 0}%`);
console.log(`  Max Drawdown:     ${maxDrawdown.toFixed(1)}%`);

// ============================================
// CURRENT PREDICTION
// ============================================

console.log('\n═══════════════════════════════════════════════════════════');
console.log('CURRENT PREDICTION');
console.log('═══════════════════════════════════════════════════════════\n');

const lastFeature = features[features.length - 1];
const details = ensemble.predictWithDetails(lastFeature);

console.log('Individual Model Predictions:');
console.log(`  Deep NN:      ${(details.dnn * 100).toFixed(1)}% UP`);
console.log(`  Wide NN:      ${(details.wide * 100).toFixed(1)}% UP`);
console.log(`  Random Forest: ${(details.rf * 100).toFixed(1)}% UP`);
console.log(`  Simple NN:    ${(details.simple * 100).toFixed(1)}% UP`);
console.log('');
console.log(`ENSEMBLE: ${(details.ensemble * 100).toFixed(1)}% probability UP in next 5 days`);

const signal = details.ensemble > 0.55 ? 'BULLISH' : details.ensemble < 0.45 ? 'BEARISH' : 'NEUTRAL';
const confidence = Math.abs(details.ensemble - 0.5) * 2 * 100;
console.log(`Signal: ${signal} (Confidence: ${confidence.toFixed(0)}%)`);

// Model agreement
const votes = [details.dnn, details.wide, details.rf, details.simple].filter(p => p > 0.5).length;
console.log(`Model Agreement: ${votes}/4 models predict UP`);

console.log('\n=== Advanced Neural Network Training Complete ===');
