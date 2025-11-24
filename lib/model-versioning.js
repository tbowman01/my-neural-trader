const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

/**
 * Model Versioning System for Neural Trader
 *
 * Manages model versions with:
 * - Version directory structure
 * - Metadata tracking
 * - Production symlinks
 * - Rollback capability
 * - Git integration
 */
class ModelVersioning {
  constructor(options = {}) {
    this.modelsDir = options.modelsDir || path.join(__dirname, '..', 'models');
    this.versionsDir = path.join(this.modelsDir, 'versions');
    this.productionLink = path.join(this.modelsDir, 'production');
  }

  /**
   * Initialize versioning system
   */
  initialize() {
    // Create versions directory if it doesn't exist
    if (!fs.existsSync(this.versionsDir)) {
      fs.mkdirSync(this.versionsDir, { recursive: true });
    }

    return true;
  }

  /**
   * Generate version ID from timestamp
   */
  generateVersionId() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hour = String(now.getHours()).padStart(2, '0');
    const minute = String(now.getMinutes()).padStart(2, '0');

    return `v${year}${month}${day}_${hour}${minute}`;
  }

  /**
   * Get Git commit hash (if available)
   */
  async getGitCommit() {
    try {
      const { stdout } = await execAsync('git rev-parse --short HEAD');
      return stdout.trim();
    } catch (error) {
      return null;
    }
  }

  /**
   * Get Git branch name (if available)
   */
  async getGitBranch() {
    try {
      const { stdout } = await execAsync('git rev-parse --abbrev-ref HEAD');
      return stdout.trim();
    } catch (error) {
      return null;
    }
  }

  /**
   * Save model version with metadata
   */
  async saveVersion(models, metadata = {}) {
    const versionId = this.generateVersionId();
    const versionDir = path.join(this.versionsDir, versionId);

    // Create version directory
    fs.mkdirSync(versionDir, { recursive: true });

    // Copy model files
    for (let i = 0; i < models.length; i++) {
      const modelName = `model-${i + 1}`;
      const sourceDir = models[i];
      const targetDir = path.join(versionDir, modelName);

      if (!fs.existsSync(sourceDir)) {
        throw new Error(`Model directory not found: ${sourceDir}`);
      }

      // Copy directory recursively
      this.copyDirSync(sourceDir, targetDir);
    }

    // Gather Git information
    const gitCommit = await this.getGitCommit();
    const gitBranch = await this.getGitBranch();

    // Create metadata
    const versionMetadata = {
      versionId,
      timestamp: new Date().toISOString(),
      numModels: models.length,
      gitCommit,
      gitBranch,
      ...metadata
    };

    // Save metadata
    const metadataPath = path.join(versionDir, 'metadata.json');
    fs.writeFileSync(metadataPath, JSON.stringify(versionMetadata, null, 2));

    return {
      versionId,
      path: versionDir,
      metadata: versionMetadata
    };
  }

  /**
   * Copy directory recursively
   */
  copyDirSync(src, dest) {
    // Create destination directory
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
    }

    // Read source directory
    const entries = fs.readdirSync(src, { withFileTypes: true });

    for (const entry of entries) {
      const srcPath = path.join(src, entry.name);
      const destPath = path.join(dest, entry.name);

      if (entry.isDirectory()) {
        this.copyDirSync(srcPath, destPath);
      } else {
        fs.copyFileSync(srcPath, destPath);
      }
    }
  }

  /**
   * List all versions
   */
  listVersions() {
    if (!fs.existsSync(this.versionsDir)) {
      return [];
    }

    const versions = fs.readdirSync(this.versionsDir)
      .filter(name => name.startsWith('v'))
      .sort()
      .reverse(); // Most recent first

    return versions.map(versionId => {
      const versionDir = path.join(this.versionsDir, versionId);
      const metadataPath = path.join(versionDir, 'metadata.json');

      let metadata = {};
      if (fs.existsSync(metadataPath)) {
        try {
          metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
        } catch (error) {
          console.warn(`Could not read metadata for ${versionId}`);
        }
      }

      return {
        versionId,
        path: versionDir,
        metadata
      };
    });
  }

  /**
   * Get version by ID
   */
  getVersion(versionId) {
    const versionDir = path.join(this.versionsDir, versionId);

    if (!fs.existsSync(versionDir)) {
      return null;
    }

    const metadataPath = path.join(versionDir, 'metadata.json');
    let metadata = {};

    if (fs.existsSync(metadataPath)) {
      try {
        metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
      } catch (error) {
        console.warn(`Could not read metadata for ${versionId}`);
      }
    }

    return {
      versionId,
      path: versionDir,
      metadata
    };
  }

  /**
   * Get latest version
   */
  getLatestVersion() {
    const versions = this.listVersions();
    return versions.length > 0 ? versions[0] : null;
  }

  /**
   * Get current production version
   */
  getProductionVersion() {
    if (!fs.existsSync(this.productionLink)) {
      return null;
    }

    try {
      // Read symlink target
      const target = fs.readlinkSync(this.productionLink);
      const versionId = path.basename(target);
      return this.getVersion(versionId);
    } catch (error) {
      console.warn('Could not read production symlink');
      return null;
    }
  }

  /**
   * Set production version
   */
  setProduction(versionId) {
    const version = this.getVersion(versionId);
    if (!version) {
      throw new Error(`Version not found: ${versionId}`);
    }

    // Remove existing production symlink
    if (fs.existsSync(this.productionLink)) {
      fs.unlinkSync(this.productionLink);
    }

    // Create new symlink
    fs.symlinkSync(version.path, this.productionLink, 'dir');

    return {
      success: true,
      versionId,
      path: version.path
    };
  }

  /**
   * Rollback to previous version
   */
  rollback() {
    const currentProduction = this.getProductionVersion();
    if (!currentProduction) {
      throw new Error('No production version set');
    }

    const versions = this.listVersions();
    const currentIndex = versions.findIndex(v => v.versionId === currentProduction.versionId);

    if (currentIndex < 0 || currentIndex >= versions.length - 1) {
      throw new Error('No previous version available for rollback');
    }

    const previousVersion = versions[currentIndex + 1];
    return this.setProduction(previousVersion.versionId);
  }

  /**
   * Delete old versions (keep last N)
   */
  cleanupOldVersions(keepCount = 10) {
    const versions = this.listVersions();
    const productionVersion = this.getProductionVersion();

    const toDelete = versions.slice(keepCount);
    const deleted = [];

    for (const version of toDelete) {
      // Don't delete production version
      if (productionVersion && version.versionId === productionVersion.versionId) {
        continue;
      }

      try {
        this.deleteDirSync(version.path);
        deleted.push(version.versionId);
      } catch (error) {
        console.warn(`Could not delete ${version.versionId}:`, error.message);
      }
    }

    return {
      deleted: deleted.length,
      kept: versions.length - deleted.length,
      versions: deleted
    };
  }

  /**
   * Delete directory recursively
   */
  deleteDirSync(dirPath) {
    if (!fs.existsSync(dirPath)) {
      return;
    }

    const entries = fs.readdirSync(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);

      if (entry.isDirectory()) {
        this.deleteDirSync(fullPath);
      } else {
        fs.unlinkSync(fullPath);
      }
    }

    fs.rmdirSync(dirPath);
  }

  /**
   * Get model paths from version
   */
  getModelPaths(versionId) {
    const version = this.getVersion(versionId);
    if (!version) {
      throw new Error(`Version not found: ${versionId}`);
    }

    const modelDirs = fs.readdirSync(version.path)
      .filter(name => name.startsWith('model-'))
      .sort();

    return modelDirs.map(dir => path.join(version.path, dir));
  }

  /**
   * Save performance metrics for a version
   */
  savePerformanceMetrics(versionId, metrics) {
    const version = this.getVersion(versionId);
    if (!version) {
      throw new Error(`Version not found: ${versionId}`);
    }

    const perfPath = path.join(version.path, 'performance.json');
    fs.writeFileSync(perfPath, JSON.stringify(metrics, null, 2));

    return true;
  }

  /**
   * Get performance metrics for a version
   */
  getPerformanceMetrics(versionId) {
    const version = this.getVersion(versionId);
    if (!version) {
      throw new Error(`Version not found: ${versionId}`);
    }

    const perfPath = path.join(version.path, 'performance.json');
    if (!fs.existsSync(perfPath)) {
      return null;
    }

    try {
      return JSON.parse(fs.readFileSync(perfPath, 'utf8'));
    } catch (error) {
      console.warn(`Could not read performance metrics for ${versionId}`);
      return null;
    }
  }

  /**
   * Compare two versions
   */
  compareVersions(versionId1, versionId2) {
    const v1 = this.getVersion(versionId1);
    const v2 = this.getVersion(versionId2);

    if (!v1 || !v2) {
      throw new Error('One or both versions not found');
    }

    const perf1 = this.getPerformanceMetrics(versionId1);
    const perf2 = this.getPerformanceMetrics(versionId2);

    return {
      version1: {
        versionId: versionId1,
        metadata: v1.metadata,
        performance: perf1
      },
      version2: {
        versionId: versionId2,
        metadata: v2.metadata,
        performance: perf2
      }
    };
  }
}

module.exports = ModelVersioning;
