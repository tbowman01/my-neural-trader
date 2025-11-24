const fs = require('fs');
const path = require('path');

/**
 * Performance Tracking System for Neural Trader
 *
 * Tracks model predictions and actual outcomes to measure performance:
 * - Logs predictions with timestamps
 * - Records actual outcomes when available
 * - Calculates running accuracy metrics
 * - Detects performance degradation
 * - Stores prediction history
 */
class PerformanceTracker {
  constructor(options = {}) {
    this.dataDir = options.dataDir || path.join(__dirname, '..', 'data');
    this.predictionsFile = path.join(this.dataDir, 'predictions.json');
    this.metricsFile = path.join(this.dataDir, 'performance-metrics.json');
    this.maxHistorySize = options.maxHistorySize || 10000;
  }

  /**
   * Initialize tracking system
   */
  initialize() {
    // Create data directory if it doesn't exist
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }

    // Initialize empty files if they don't exist
    if (!fs.existsSync(this.predictionsFile)) {
      fs.writeFileSync(this.predictionsFile, JSON.stringify([], null, 2));
    }

    if (!fs.existsSync(this.metricsFile)) {
      const initialMetrics = {
        lastUpdated: new Date().toISOString(),
        totalPredictions: 0,
        resolvedPredictions: 0,
        accuracy: null,
        weeklyAccuracy: [],
        monthlyAccuracy: []
      };
      fs.writeFileSync(this.metricsFile, JSON.stringify(initialMetrics, null, 2));
    }

    return true;
  }

  /**
   * Load predictions history
   */
  loadPredictions() {
    try {
      if (!fs.existsSync(this.predictionsFile)) {
        return [];
      }
      const data = fs.readFileSync(this.predictionsFile, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      console.error('Error loading predictions:', error.message);
      return [];
    }
  }

  /**
   * Save predictions history
   */
  savePredictions(predictions) {
    // Keep only most recent predictions
    const trimmed = predictions.slice(-this.maxHistorySize);
    fs.writeFileSync(this.predictionsFile, JSON.stringify(trimmed, null, 2));
  }

  /**
   * Load performance metrics
   */
  loadMetrics() {
    try {
      if (!fs.existsSync(this.metricsFile)) {
        return null;
      }
      const data = fs.readFileSync(this.metricsFile, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      console.error('Error loading metrics:', error.message);
      return null;
    }
  }

  /**
   * Save performance metrics
   */
  saveMetrics(metrics) {
    fs.writeFileSync(this.metricsFile, JSON.stringify(metrics, null, 2));
  }

  /**
   * Log a prediction
   */
  logPrediction(prediction) {
    const predictions = this.loadPredictions();

    const entry = {
      id: this.generatePredictionId(),
      timestamp: new Date().toISOString(),
      symbol: prediction.symbol,
      prediction: prediction.prediction, // 'bullish' or 'bearish'
      confidence: prediction.confidence,
      currentPrice: prediction.currentPrice,
      modelVersion: prediction.modelVersion || 'unknown',
      resolved: false,
      outcome: null,
      actualReturn: null,
      resolvedAt: null
    };

    predictions.push(entry);
    this.savePredictions(predictions);

    return entry;
  }

  /**
   * Generate unique prediction ID
   */
  generatePredictionId() {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    return `pred_${timestamp}_${random}`;
  }

  /**
   * Resolve a prediction with actual outcome
   */
  resolvePrediction(predictionId, outcome) {
    const predictions = this.loadPredictions();
    const prediction = predictions.find(p => p.id === predictionId);

    if (!prediction) {
      throw new Error(`Prediction not found: ${predictionId}`);
    }

    if (prediction.resolved) {
      console.warn(`Prediction ${predictionId} already resolved`);
      return prediction;
    }

    prediction.resolved = true;
    prediction.outcome = outcome.outcome; // 'correct' or 'incorrect'
    prediction.actualReturn = outcome.actualReturn;
    prediction.actualPrice = outcome.actualPrice;
    prediction.resolvedAt = new Date().toISOString();

    this.savePredictions(predictions);
    this.updateMetrics();

    return prediction;
  }

  /**
   * Resolve predictions based on actual market data
   */
  async resolveFromMarketData(marketData) {
    const predictions = this.loadPredictions();
    const unresolved = predictions.filter(p => !p.resolved);

    let resolvedCount = 0;

    for (const prediction of unresolved) {
      // Check if we have market data for this symbol
      const symbolData = marketData[prediction.symbol];
      if (!symbolData) {
        continue;
      }

      // Calculate days since prediction
      const predictionDate = new Date(prediction.timestamp);
      const daysSince = (Date.now() - predictionDate.getTime()) / (1000 * 60 * 60 * 24);

      // Resolve predictions that are at least 7 days old
      if (daysSince >= 7) {
        const currentPrice = symbolData.currentPrice;
        const actualReturn = (currentPrice - prediction.currentPrice) / prediction.currentPrice;

        // Determine if prediction was correct
        const actualDirection = actualReturn > 0 ? 'bullish' : 'bearish';
        const correct = actualDirection === prediction.prediction;

        this.resolvePrediction(prediction.id, {
          outcome: correct ? 'correct' : 'incorrect',
          actualReturn: actualReturn,
          actualPrice: currentPrice
        });

        resolvedCount++;
      }
    }

    return {
      processed: unresolved.length,
      resolved: resolvedCount,
      remaining: unresolved.length - resolvedCount
    };
  }

  /**
   * Update performance metrics
   */
  updateMetrics() {
    const predictions = this.loadPredictions();
    const resolved = predictions.filter(p => p.resolved);

    if (resolved.length === 0) {
      return null;
    }

    // Calculate overall accuracy
    const correct = resolved.filter(p => p.outcome === 'correct').length;
    const accuracy = correct / resolved.length;

    // Calculate weekly accuracy (last 7 days)
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const weekResolved = resolved.filter(p => new Date(p.resolvedAt) >= weekAgo);
    const weekCorrect = weekResolved.filter(p => p.outcome === 'correct').length;
    const weekAccuracy = weekResolved.length > 0 ? weekCorrect / weekResolved.length : null;

    // Calculate monthly accuracy (last 30 days)
    const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const monthResolved = resolved.filter(p => new Date(p.resolvedAt) >= monthAgo);
    const monthCorrect = monthResolved.filter(p => p.outcome === 'correct').length;
    const monthAccuracy = monthResolved.length > 0 ? monthCorrect / monthResolved.length : null;

    // Calculate accuracy by confidence bucket
    const confidenceBuckets = this.calculateConfidenceBuckets(resolved);

    // Calculate metrics by model version
    const versionMetrics = this.calculateVersionMetrics(resolved);

    const metrics = {
      lastUpdated: new Date().toISOString(),
      totalPredictions: predictions.length,
      resolvedPredictions: resolved.length,
      unresolvedPredictions: predictions.length - resolved.length,
      accuracy: accuracy,
      weeklyAccuracy: weekAccuracy,
      monthlyAccuracy: monthAccuracy,
      confidenceBuckets: confidenceBuckets,
      versionMetrics: versionMetrics,
      stats: {
        correct: correct,
        incorrect: resolved.length - correct,
        averageConfidence: this.average(resolved.map(p => p.confidence)),
        averageReturn: this.average(resolved.map(p => p.actualReturn))
      }
    };

    this.saveMetrics(metrics);

    return metrics;
  }

  /**
   * Calculate accuracy by confidence bucket
   */
  calculateConfidenceBuckets(resolved) {
    const buckets = {
      '0-20%': [],
      '20-40%': [],
      '40-60%': [],
      '60-80%': [],
      '80-100%': []
    };

    for (const prediction of resolved) {
      const conf = prediction.confidence * 100;

      if (conf < 20) {
        buckets['0-20%'].push(prediction);
      } else if (conf < 40) {
        buckets['20-40%'].push(prediction);
      } else if (conf < 60) {
        buckets['40-60%'].push(prediction);
      } else if (conf < 80) {
        buckets['60-80%'].push(prediction);
      } else {
        buckets['80-100%'].push(prediction);
      }
    }

    const result = {};
    for (const [bucket, predictions] of Object.entries(buckets)) {
      if (predictions.length > 0) {
        const correct = predictions.filter(p => p.outcome === 'correct').length;
        result[bucket] = {
          count: predictions.length,
          accuracy: correct / predictions.length,
          avgConfidence: this.average(predictions.map(p => p.confidence))
        };
      }
    }

    return result;
  }

  /**
   * Calculate metrics by model version
   */
  calculateVersionMetrics(resolved) {
    const byVersion = {};

    for (const prediction of resolved) {
      const version = prediction.modelVersion || 'unknown';

      if (!byVersion[version]) {
        byVersion[version] = [];
      }

      byVersion[version].push(prediction);
    }

    const result = {};
    for (const [version, predictions] of Object.entries(byVersion)) {
      const correct = predictions.filter(p => p.outcome === 'correct').length;
      result[version] = {
        count: predictions.length,
        accuracy: correct / predictions.length,
        avgConfidence: this.average(predictions.map(p => p.confidence)),
        avgReturn: this.average(predictions.map(p => p.actualReturn))
      };
    }

    return result;
  }

  /**
   * Calculate average of array
   */
  average(arr) {
    if (arr.length === 0) return 0;
    return arr.reduce((a, b) => a + b, 0) / arr.length;
  }

  /**
   * Get performance summary
   */
  getSummary() {
    const metrics = this.loadMetrics();
    if (!metrics) {
      return null;
    }

    return {
      totalPredictions: metrics.totalPredictions,
      resolved: metrics.resolvedPredictions,
      unresolved: metrics.unresolvedPredictions,
      overallAccuracy: metrics.accuracy ? (metrics.accuracy * 100).toFixed(1) + '%' : 'N/A',
      weeklyAccuracy: metrics.weeklyAccuracy ? (metrics.weeklyAccuracy * 100).toFixed(1) + '%' : 'N/A',
      monthlyAccuracy: metrics.monthlyAccuracy ? (metrics.monthlyAccuracy * 100).toFixed(1) + '%' : 'N/A',
      lastUpdated: metrics.lastUpdated
    };
  }

  /**
   * Get unresolved predictions
   */
  getUnresolvedPredictions(limit = 50) {
    const predictions = this.loadPredictions();
    return predictions
      .filter(p => !p.resolved)
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, limit);
  }

  /**
   * Get recent predictions
   */
  getRecentPredictions(limit = 50) {
    const predictions = this.loadPredictions();
    return predictions
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, limit);
  }

  /**
   * Detect performance degradation
   */
  detectDegradation(threshold = 0.05) {
    const metrics = this.loadMetrics();
    if (!metrics || !metrics.accuracy || !metrics.weeklyAccuracy) {
      return {
        degraded: false,
        reason: 'Insufficient data for comparison'
      };
    }

    // Compare weekly accuracy to overall accuracy
    const drop = metrics.accuracy - metrics.weeklyAccuracy;

    if (drop > threshold) {
      return {
        degraded: true,
        severity: drop > 0.1 ? 'high' : 'medium',
        overallAccuracy: (metrics.accuracy * 100).toFixed(1) + '%',
        weeklyAccuracy: (metrics.weeklyAccuracy * 100).toFixed(1) + '%',
        drop: (drop * 100).toFixed(1) + '%',
        recommendation: 'Consider retraining models with latest data'
      };
    }

    return {
      degraded: false,
      overallAccuracy: (metrics.accuracy * 100).toFixed(1) + '%',
      weeklyAccuracy: (metrics.weeklyAccuracy * 100).toFixed(1) + '%'
    };
  }

  /**
   * Export metrics to CSV
   */
  exportToCSV(outputPath) {
    const predictions = this.loadPredictions();
    const resolved = predictions.filter(p => p.resolved);

    const headers = [
      'ID',
      'Timestamp',
      'Symbol',
      'Prediction',
      'Confidence',
      'Current Price',
      'Model Version',
      'Outcome',
      'Actual Return',
      'Actual Price',
      'Resolved At'
    ];

    const rows = resolved.map(p => [
      p.id,
      p.timestamp,
      p.symbol,
      p.prediction,
      p.confidence.toFixed(4),
      p.currentPrice.toFixed(2),
      p.modelVersion,
      p.outcome,
      p.actualReturn ? p.actualReturn.toFixed(4) : '',
      p.actualPrice ? p.actualPrice.toFixed(2) : '',
      p.resolvedAt
    ]);

    const csv = [headers, ...rows]
      .map(row => row.join(','))
      .join('\n');

    fs.writeFileSync(outputPath, csv);

    return {
      success: true,
      path: outputPath,
      rows: rows.length
    };
  }

  /**
   * Clean old predictions (keep last N)
   */
  cleanOldPredictions(keepCount = 5000) {
    const predictions = this.loadPredictions();

    if (predictions.length <= keepCount) {
      return {
        deleted: 0,
        kept: predictions.length
      };
    }

    // Sort by timestamp and keep most recent
    const sorted = predictions.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    const toKeep = sorted.slice(0, keepCount);

    this.savePredictions(toKeep);

    return {
      deleted: predictions.length - keepCount,
      kept: keepCount
    };
  }
}

module.exports = PerformanceTracker;
