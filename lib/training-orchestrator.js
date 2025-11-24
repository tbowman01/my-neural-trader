const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

/**
 * Training Orchestrator for Neural Trader
 *
 * Manages automated model training and retraining:
 * - Orchestrates training of all 5 ensemble models
 * - Validates new models against baseline performance
 * - Integrates with versioning system
 * - Handles training failures and rollback
 * - Parallel or sequential training modes
 */
class TrainingOrchestrator {
  constructor(options = {}) {
    this.modelsDir = options.modelsDir || path.join(__dirname, '..', 'models');
    this.trainingScript = options.trainingScript || path.join(__dirname, '..', 'examples', '46-stage1-train-models-4-5.js');
    this.dataDir = options.dataDir || path.join(__dirname, '..', 'historical-data');
    this.logDir = options.logDir || path.join(__dirname, '..', 'logs');
    this.numModels = options.numModels || 5;
    this.parallelTraining = options.parallelTraining || false;
    this.minAccuracy = options.minAccuracy || 0.70; // 70% minimum accuracy
    this.minEnsembleConfidence = options.minEnsembleConfidence || 0.55; // 55% minimum ensemble confidence
  }

  /**
   * Initialize orchestrator
   */
  initialize() {
    // Create log directory if it doesn't exist
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }

    return true;
  }

  /**
   * Get list of symbols for training
   */
  getSymbolList() {
    const files = fs.readdirSync(this.dataDir)
      .filter(f => f.endsWith('-5-years.json'));

    return files.map(f => f.replace('-5-years.json', ''));
  }

  /**
   * Train a single model
   */
  async trainModel(modelNumber, options = {}) {
    const startTime = Date.now();
    const logFile = path.join(this.logDir, `model-${modelNumber}-training.log`);

    console.log(`[Model ${modelNumber}] Starting training...`);

    const result = {
      modelNumber,
      startTime: new Date().toISOString(),
      success: false,
      metrics: null,
      duration: null,
      logFile: logFile,
      error: null
    };

    try {
      // Build training command
      const command = this.buildTrainingCommand(modelNumber, options);

      // Execute training
      console.log(`[Model ${modelNumber}] Executing: ${command}`);

      const { stdout, stderr } = await execAsync(command, {
        maxBuffer: 10 * 1024 * 1024, // 10MB buffer
        timeout: options.timeout || 3600000 // 1 hour default timeout
      });

      // Save training log
      fs.writeFileSync(logFile, stdout + '\n\n' + stderr);

      // Parse training output
      const metrics = this.parseTrainingOutput(stdout);

      result.success = true;
      result.metrics = metrics;
      result.duration = Date.now() - startTime;
      result.endTime = new Date().toISOString();

      console.log(`[Model ${modelNumber}] ✓ Training complete in ${(result.duration / 60000).toFixed(1)} minutes`);
      console.log(`[Model ${modelNumber}]   Accuracy: ${(metrics.accuracy * 100).toFixed(1)}%`);

      return result;

    } catch (error) {
      result.success = false;
      result.error = error.message;
      result.duration = Date.now() - startTime;
      result.endTime = new Date().toISOString();

      console.error(`[Model ${modelNumber}] ✗ Training failed: ${error.message}`);

      return result;
    }
  }

  /**
   * Build training command for a specific model
   */
  buildTrainingCommand(modelNumber, options = {}) {
    // Use the existing Stage 1 training script
    // This trains models with 14 features using the proven architecture
    const script = options.trainingScript || this.trainingScript;

    // Set environment variables for model-specific training
    const env = {
      MODEL_NUMBER: modelNumber,
      SAVE_PATH: path.join(this.modelsDir, `model-${modelNumber}`),
      ...process.env
    };

    const envStr = Object.entries(env)
      .map(([key, value]) => `${key}="${value}"`)
      .join(' ');

    return `${envStr} node ${script} 2>&1`;
  }

  /**
   * Parse training output to extract metrics
   */
  parseTrainingOutput(output) {
    const metrics = {
      accuracy: null,
      valAccuracy: null,
      loss: null,
      precision: null,
      recall: null,
      f1Score: null
    };

    try {
      // Parse test accuracy
      const accMatch = output.match(/Test Accuracy:\s+([\d.]+)%/i) ||
                       output.match(/val_acc[=:]\s*([\d.]+)/i);
      if (accMatch) {
        metrics.accuracy = parseFloat(accMatch[1]) / (accMatch[1] > 1 ? 100 : 1);
      }

      // Parse validation accuracy
      const valAccMatch = output.match(/val_acc[=:]\s*([\d.]+)/);
      if (valAccMatch) {
        metrics.valAccuracy = parseFloat(valAccMatch[1]);
      }

      // Parse loss
      const lossMatch = output.match(/loss[=:]\s*([\d.]+)/);
      if (lossMatch) {
        metrics.loss = parseFloat(lossMatch[1]);
      }

      // Parse precision
      const precMatch = output.match(/Precision:\s+([\d.]+)%/i);
      if (precMatch) {
        metrics.precision = parseFloat(precMatch[1]) / 100;
      }

      // Parse recall
      const recallMatch = output.match(/Recall:\s+([\d.]+)%/i);
      if (recallMatch) {
        metrics.recall = parseFloat(recallMatch[1]) / 100;
      }

      // Parse F1 score
      const f1Match = output.match(/F1 Score:\s+([\d.]+)%/i);
      if (f1Match) {
        metrics.f1Score = parseFloat(f1Match[1]) / 100;
      }

    } catch (error) {
      console.warn('Error parsing training output:', error.message);
    }

    return metrics;
  }

  /**
   * Train all models in the ensemble
   */
  async trainAllModels(options = {}) {
    console.log('═══════════════════════════════════════════════════════════════════');
    console.log('         TRAINING ORCHESTRATOR - Neural Trader Ensemble');
    console.log('═══════════════════════════════════════════════════════════════════');
    console.log('');
    console.log(`Training ${this.numModels} models...`);
    console.log(`Mode: ${this.parallelTraining ? 'Parallel' : 'Sequential'}`);
    console.log('');

    const results = [];
    const startTime = Date.now();

    if (this.parallelTraining) {
      // Train all models in parallel
      console.log('Starting parallel training...');
      const promises = [];
      for (let i = 1; i <= this.numModels; i++) {
        promises.push(this.trainModel(i, options));
      }
      const parallelResults = await Promise.all(promises);
      results.push(...parallelResults);

    } else {
      // Train models sequentially
      console.log('Starting sequential training...');
      for (let i = 1; i <= this.numModels; i++) {
        const result = await this.trainModel(i, options);
        results.push(result);
        console.log('');
      }
    }

    const totalDuration = Date.now() - startTime;

    // Generate summary
    const summary = this.generateTrainingSummary(results, totalDuration);

    console.log('');
    console.log('═══════════════════════════════════════════════════════════════════');
    console.log('                    TRAINING COMPLETE');
    console.log('═══════════════════════════════════════════════════════════════════');
    console.log('');
    console.log(`Total Duration: ${(totalDuration / 60000).toFixed(1)} minutes`);
    console.log(`Successful: ${summary.successful}/${this.numModels}`);
    console.log(`Failed: ${summary.failed}`);
    console.log(`Average Accuracy: ${(summary.avgAccuracy * 100).toFixed(1)}%`);
    console.log('');

    if (summary.failed > 0) {
      console.log('Failed Models:');
      results.filter(r => !r.success).forEach(r => {
        console.log(`  Model ${r.modelNumber}: ${r.error}`);
      });
      console.log('');
    }

    return {
      results,
      summary,
      totalDuration
    };
  }

  /**
   * Generate training summary
   */
  generateTrainingSummary(results, totalDuration) {
    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    const accuracies = results
      .filter(r => r.success && r.metrics && r.metrics.accuracy !== null)
      .map(r => r.metrics.accuracy);

    const avgAccuracy = accuracies.length > 0
      ? accuracies.reduce((a, b) => a + b, 0) / accuracies.length
      : 0;

    const minAccuracy = accuracies.length > 0 ? Math.min(...accuracies) : 0;
    const maxAccuracy = accuracies.length > 0 ? Math.max(...accuracies) : 0;

    return {
      successful,
      failed,
      avgAccuracy,
      minAccuracy,
      maxAccuracy,
      totalDuration,
      timestamp: new Date().toISOString(),
      results: results
    };
  }

  /**
   * Validate trained models against baseline
   */
  async validateModels(modelPaths, baseline = {}) {
    console.log('Validating trained models...');

    const validation = {
      passed: true,
      issues: [],
      metrics: {}
    };

    // Check if all models exist
    for (const modelPath of modelPaths) {
      if (!fs.existsSync(modelPath)) {
        validation.passed = false;
        validation.issues.push(`Model not found: ${modelPath}`);
      }
    }

    // Validate against minimum accuracy threshold
    if (baseline.avgAccuracy) {
      if (baseline.avgAccuracy < this.minAccuracy) {
        validation.passed = false;
        validation.issues.push(
          `Average accuracy ${(baseline.avgAccuracy * 100).toFixed(1)}% below minimum ${(this.minAccuracy * 100).toFixed(1)}%`
        );
      }
    }

    // Check for training failures
    if (baseline.failed > 0) {
      validation.passed = false;
      validation.issues.push(`${baseline.failed} models failed to train`);
    }

    validation.metrics = {
      avgAccuracy: baseline.avgAccuracy,
      minAccuracy: baseline.minAccuracy,
      maxAccuracy: baseline.maxAccuracy,
      numModels: modelPaths.length
    };

    return validation;
  }

  /**
   * Test ensemble performance with new models
   */
  async testEnsemble(modelPaths) {
    console.log('Testing ensemble performance...');

    // This would run the ensemble predictor with the new models
    // For now, return a placeholder
    return {
      averageConfidence: null,
      topPredictions: [],
      tested: false,
      message: 'Ensemble testing not yet implemented'
    };
  }

  /**
   * Clean up old training logs
   */
  cleanupLogs(keepDays = 30) {
    if (!fs.existsSync(this.logDir)) {
      return { deleted: 0 };
    }

    const cutoffTime = Date.now() - (keepDays * 24 * 60 * 60 * 1000);
    const files = fs.readdirSync(this.logDir);
    let deleted = 0;

    for (const file of files) {
      const filePath = path.join(this.logDir, file);
      const stats = fs.statSync(filePath);

      if (stats.mtimeMs < cutoffTime) {
        fs.unlinkSync(filePath);
        deleted++;
      }
    }

    return { deleted, kept: files.length - deleted };
  }
}

module.exports = TrainingOrchestrator;
