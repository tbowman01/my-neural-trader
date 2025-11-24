/**
 * A/B Testing Framework
 *
 * Enables safe deployment of new model versions through:
 * - Shadow mode execution (parallel predictions)
 * - Statistical comparison (t-tests, confidence intervals)
 * - Automated deployment decisions
 * - Rollback capability
 */

const tf = require('@tensorflow/tfjs-node-gpu');
const fs = require('fs');
const path = require('path');
const PerformanceTracker = require('./performance-tracker');
const ModelVersioning = require('./model-versioning');

class ABTesting {
  constructor(options = {}) {
    this.dataDir = options.dataDir || path.join(__dirname, '..', 'data');
    this.abTestFile = path.join(this.dataDir, 'ab-test-results.json');
    this.shadowModeFile = path.join(this.dataDir, 'shadow-mode-predictions.json');

    this.tracker = new PerformanceTracker();
    this.versioning = new ModelVersioning();

    // Configuration
    this.shadowModeDuration = options.shadowModeDuration || 7; // days
    this.significanceLevel = options.significanceLevel || 0.05; // p < 0.05
    this.minImprovement = options.minImprovement || 0.01; // 1% minimum improvement
  }

  /**
   * Initialize A/B testing system
   */
  initialize() {
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }

    if (!fs.existsSync(this.abTestFile)) {
      fs.writeFileSync(this.abTestFile, JSON.stringify({ tests: [] }, null, 2));
    }

    if (!fs.existsSync(this.shadowModeFile)) {
      fs.writeFileSync(this.shadowModeFile, JSON.stringify({ predictions: [] }, null, 2));
    }

    this.tracker.initialize();
    this.versioning.initialize();
  }

  /**
   * Start shadow mode comparison
   * New models run alongside production without affecting live decisions
   *
   * @param {string} newVersionId - Version ID of new models to test
   * @param {number} duration - Duration in days (default: 7)
   * @returns {Object} Shadow mode configuration
   */
  async startShadowMode(newVersionId, duration = null) {
    duration = duration || this.shadowModeDuration;

    const newVersion = this.versioning.getVersion(newVersionId);
    const productionVersion = this.versioning.getProductionVersion();

    if (!newVersion) {
      throw new Error(`New version not found: ${newVersionId}`);
    }

    if (!productionVersion) {
      throw new Error('No production version found');
    }

    const startDate = new Date();
    const endDate = new Date(startDate.getTime() + duration * 24 * 60 * 60 * 1000);

    const shadowConfig = {
      testId: this.generateTestId(),
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      duration,
      productionVersion: productionVersion.versionId,
      candidateVersion: newVersionId,
      status: 'running',
      predictions: {
        production: [],
        candidate: []
      }
    };

    // Save shadow mode config
    const tests = this.loadABTests();
    tests.tests.push(shadowConfig);
    fs.writeFileSync(this.abTestFile, JSON.stringify(tests, null, 2));

    return shadowConfig;
  }

  /**
   * Log prediction from shadow mode
   *
   * @param {string} testId - Test ID
   * @param {string} modelType - 'production' or 'candidate'
   * @param {Object} prediction - Prediction data
   */
  logShadowPrediction(testId, modelType, prediction) {
    const shadowData = this.loadShadowPredictions();

    shadowData.predictions.push({
      testId,
      modelType,
      timestamp: new Date().toISOString(),
      symbol: prediction.symbol,
      prediction: prediction.prediction,
      confidence: prediction.confidence,
      features: prediction.features,
      actualPrice: null,
      actualOutcome: null,
      resolved: false
    });

    fs.writeFileSync(this.shadowModeFile, JSON.stringify(shadowData, null, 2));
  }

  /**
   * Resolve shadow mode predictions with actual outcomes
   *
   * @param {string} symbol - Stock symbol
   * @param {number} actualPrice - Actual price after prediction period
   * @param {string} actualOutcome - 'bullish' or 'bearish'
   */
  resolveShadowPredictions(symbol, actualPrice, actualOutcome) {
    const shadowData = this.loadShadowPredictions();

    shadowData.predictions = shadowData.predictions.map(pred => {
      if (pred.symbol === symbol && !pred.resolved) {
        return {
          ...pred,
          actualPrice,
          actualOutcome,
          resolved: true,
          correct: pred.prediction === actualOutcome
        };
      }
      return pred;
    });

    fs.writeFileSync(this.shadowModeFile, JSON.stringify(shadowData, null, 2));
  }

  /**
   * End shadow mode and generate comparison report
   *
   * @param {string} testId - Test ID
   * @returns {Object} Comparison results with deployment recommendation
   */
  async endShadowMode(testId) {
    const tests = this.loadABTests();
    const test = tests.tests.find(t => t.testId === testId);

    if (!test) {
      throw new Error(`Test not found: ${testId}`);
    }

    if (test.status !== 'running') {
      throw new Error(`Test is not running: ${test.status}`);
    }

    // Gather predictions
    const shadowData = this.loadShadowPredictions();
    const testPredictions = shadowData.predictions.filter(p => p.testId === testId && p.resolved);

    const productionPreds = testPredictions.filter(p => p.modelType === 'production');
    const candidatePreds = testPredictions.filter(p => p.modelType === 'candidate');

    // Calculate metrics
    const prodMetrics = this.calculateMetrics(productionPreds);
    const candMetrics = this.calculateMetrics(candidatePreds);

    // Statistical comparison
    const comparison = this.compareModels(productionPreds, candidatePreds);

    // Generate recommendation
    const recommendation = this.generateRecommendation(prodMetrics, candMetrics, comparison);

    // Update test status
    test.status = 'completed';
    test.endedAt = new Date().toISOString();
    test.results = {
      productionMetrics: prodMetrics,
      candidateMetrics: candMetrics,
      comparison,
      recommendation
    };

    fs.writeFileSync(this.abTestFile, JSON.stringify(tests, null, 2));

    return test.results;
  }

  /**
   * Calculate performance metrics for predictions
   *
   * @param {Array} predictions - Array of predictions
   * @returns {Object} Metrics
   */
  calculateMetrics(predictions) {
    if (predictions.length === 0) {
      return {
        accuracy: 0,
        avgConfidence: 0,
        totalPredictions: 0,
        correct: 0,
        incorrect: 0
      };
    }

    const correct = predictions.filter(p => p.correct).length;
    const incorrect = predictions.length - correct;
    const accuracy = correct / predictions.length;
    const avgConfidence = predictions.reduce((sum, p) => sum + p.confidence, 0) / predictions.length;

    return {
      accuracy,
      avgConfidence,
      totalPredictions: predictions.length,
      correct,
      incorrect,
      accuracyPercent: (accuracy * 100).toFixed(2),
      confidencePercent: (avgConfidence * 100).toFixed(2)
    };
  }

  /**
   * Statistical comparison between two models
   *
   * @param {Array} productionPreds - Production predictions
   * @param {Array} candidatePreds - Candidate predictions
   * @returns {Object} Statistical comparison results
   */
  compareModels(productionPreds, candidatePreds) {
    const prodCorrect = productionPreds.filter(p => p.correct).length;
    const candCorrect = candidatePreds.filter(p => p.correct).length;

    const prodAccuracy = prodCorrect / productionPreds.length;
    const candAccuracy = candCorrect / candidatePreds.length;

    const difference = candAccuracy - prodAccuracy;
    const percentImprovement = ((candAccuracy - prodAccuracy) / prodAccuracy) * 100;

    // Simple t-test approximation
    const n1 = productionPreds.length;
    const n2 = candidatePreds.length;

    const p1 = prodAccuracy;
    const p2 = candAccuracy;

    // Pooled standard error
    const pooledP = (prodCorrect + candCorrect) / (n1 + n2);
    const se = Math.sqrt(pooledP * (1 - pooledP) * (1/n1 + 1/n2));

    // Z-score
    const zScore = (p2 - p1) / se;

    // Approximate p-value (two-tailed)
    const pValue = 2 * (1 - this.normalCDF(Math.abs(zScore)));

    // Confidence interval (95%)
    const margin = 1.96 * se;
    const confidenceInterval = {
      lower: difference - margin,
      upper: difference + margin
    };

    return {
      accuracyDifference: difference,
      percentImprovement: percentImprovement.toFixed(2),
      zScore: zScore.toFixed(3),
      pValue: pValue.toFixed(4),
      significantAt05: pValue < this.significanceLevel,
      confidenceInterval: {
        lower: (confidenceInterval.lower * 100).toFixed(2),
        upper: (confidenceInterval.upper * 100).toFixed(2)
      }
    };
  }

  /**
   * Generate deployment recommendation
   *
   * @param {Object} prodMetrics - Production metrics
   * @param {Object} candMetrics - Candidate metrics
   * @param {Object} comparison - Statistical comparison
   * @returns {Object} Recommendation
   */
  generateRecommendation(prodMetrics, candMetrics, comparison) {
    const shouldDeploy =
      comparison.significantAt05 &&
      comparison.accuracyDifference >= this.minImprovement;

    const reason = [];

    if (!comparison.significantAt05) {
      reason.push(`Not statistically significant (p=${comparison.pValue} >= 0.05)`);
    }

    if (comparison.accuracyDifference < this.minImprovement) {
      reason.push(`Improvement too small (${(comparison.accuracyDifference * 100).toFixed(2)}% < ${(this.minImprovement * 100).toFixed(2)}%)`);
    }

    if (candMetrics.accuracy < prodMetrics.accuracy) {
      reason.push('Candidate performs worse than production');
    }

    if (shouldDeploy) {
      reason.push('Candidate significantly better than production');
      reason.push(`Improvement: ${comparison.percentImprovement}%`);
      reason.push(`Statistically significant (p=${comparison.pValue})`);
    }

    return {
      decision: shouldDeploy ? 'DEPLOY' : 'REJECT',
      confidence: shouldDeploy ? 'HIGH' : 'MEDIUM',
      reasons: reason,
      candidateAccuracy: candMetrics.accuracyPercent,
      productionAccuracy: prodMetrics.accuracyPercent,
      improvementPercent: comparison.percentImprovement
    };
  }

  /**
   * Automatically deploy candidate if recommendation is positive
   *
   * @param {string} testId - Test ID
   * @returns {Object} Deployment result
   */
  async autoDeploy(testId) {
    const tests = this.loadABTests();
    const test = tests.tests.find(t => t.testId === testId);

    if (!test) {
      throw new Error(`Test not found: ${testId}`);
    }

    if (test.status !== 'completed') {
      throw new Error('Test must be completed before deployment');
    }

    const recommendation = test.results.recommendation;

    if (recommendation.decision !== 'DEPLOY') {
      return {
        deployed: false,
        reason: 'Recommendation is REJECT',
        details: recommendation
      };
    }

    // Deploy candidate version
    const deployment = this.versioning.setProduction(test.candidateVersion);

    // Update test record
    test.deployed = true;
    test.deployedAt = new Date().toISOString();
    fs.writeFileSync(this.abTestFile, JSON.stringify(tests, null, 2));

    return {
      deployed: true,
      versionId: test.candidateVersion,
      previousVersion: test.productionVersion,
      recommendation,
      deployment
    };
  }

  /**
   * Normal cumulative distribution function (for p-value calculation)
   */
  normalCDF(x) {
    const t = 1 / (1 + 0.2316419 * Math.abs(x));
    const d = 0.3989423 * Math.exp(-x * x / 2);
    const prob = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
    return x > 0 ? 1 - prob : prob;
  }

  /**
   * Generate unique test ID
   */
  generateTestId() {
    return `test_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  }

  /**
   * Load A/B test results from file
   */
  loadABTests() {
    if (!fs.existsSync(this.abTestFile)) {
      return { tests: [] };
    }
    const data = fs.readFileSync(this.abTestFile, 'utf8');
    return JSON.parse(data);
  }

  /**
   * Load shadow mode predictions from file
   */
  loadShadowPredictions() {
    if (!fs.existsSync(this.shadowModeFile)) {
      return { predictions: [] };
    }
    const data = fs.readFileSync(this.shadowModeFile, 'utf8');
    return JSON.parse(data);
  }

  /**
   * Get active shadow mode test
   */
  getActiveTest() {
    const tests = this.loadABTests();
    return tests.tests.find(t => t.status === 'running');
  }

  /**
   * Get test history
   */
  getTestHistory(limit = 10) {
    const tests = this.loadABTests();
    return tests.tests
      .sort((a, b) => new Date(b.startDate) - new Date(a.startDate))
      .slice(0, limit);
  }

  /**
   * Clean up old shadow mode predictions
   *
   * @param {number} daysToKeep - Number of days to keep (default: 30)
   */
  cleanupOldPredictions(daysToKeep = 30) {
    const shadowData = this.loadShadowPredictions();
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    const filteredPredictions = shadowData.predictions.filter(pred => {
      return new Date(pred.timestamp) > cutoffDate;
    });

    shadowData.predictions = filteredPredictions;
    fs.writeFileSync(this.shadowModeFile, JSON.stringify(shadowData, null, 2));

    return {
      removed: shadowData.predictions.length - filteredPredictions.length,
      remaining: filteredPredictions.length
    };
  }
}

module.exports = ABTesting;
