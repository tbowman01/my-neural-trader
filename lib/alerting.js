/**
 * Alerting System
 *
 * Sends alerts for critical events:
 * - Performance degradation
 * - Data refresh failures
 * - Training failures
 * - Deployment issues
 */

const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const util = require('util');
const execAsync = util.promisify(exec);

class AlertingSystem {
  constructor(options = {}) {
    this.dataDir = options.dataDir || path.join(__dirname, '..', 'data');
    this.alertLogFile = path.join(this.dataDir, 'alert-log.json');

    // Configuration
    this.alertEmail = options.alertEmail || null;
    this.slackWebhook = options.slackWebhook || null;
    this.enableConsoleAlerts = options.enableConsoleAlerts !== false; // Default true

    // Alert thresholds
    this.degradationThreshold = options.degradationThreshold || 0.05; // 5%
    this.criticalThreshold = options.criticalThreshold || 0.10; // 10%
  }

  /**
   * Initialize alerting system
   */
  initialize() {
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }

    if (!fs.existsSync(this.alertLogFile)) {
      fs.writeFileSync(this.alertLogFile, JSON.stringify({ alerts: [] }, null, 2));
    }
  }

  /**
   * Send alert
   *
   * @param {Object} alert - Alert data
   */
  async sendAlert(alert) {
    const timestamp = new Date().toISOString();

    const alertRecord = {
      id: this.generateAlertId(),
      timestamp,
      ...alert
    };

    // Log alert
    this.logAlert(alertRecord);

    // Send via configured channels
    const promises = [];

    if (this.enableConsoleAlerts) {
      this.sendConsoleAlert(alertRecord);
    }

    if (this.alertEmail) {
      promises.push(this.sendEmailAlert(alertRecord));
    }

    if (this.slackWebhook) {
      promises.push(this.sendSlackAlert(alertRecord));
    }

    await Promise.all(promises);

    return alertRecord;
  }

  /**
   * Send performance degradation alert
   *
   * @param {Object} degradation - Degradation details
   */
  async alertPerformanceDegradation(degradation) {
    const severity = degradation.drop > this.criticalThreshold ? 'CRITICAL' : 'WARNING';

    return this.sendAlert({
      type: 'PERFORMANCE_DEGRADATION',
      severity,
      title: `Model Performance Degradation Detected`,
      message: `Weekly accuracy dropped by ${(degradation.drop * 100).toFixed(1)}% (${(degradation.overallAccuracy * 100).toFixed(1)}% → ${(degradation.weeklyAccuracy * 100).toFixed(1)}%)`,
      details: degradation,
      recommendation: degradation.recommendation
    });
  }

  /**
   * Send data refresh failure alert
   *
   * @param {Object} failure - Failure details
   */
  async alertDataRefreshFailure(failure) {
    return this.sendAlert({
      type: 'DATA_REFRESH_FAILURE',
      severity: 'ERROR',
      title: 'Data Refresh Failed',
      message: `Failed to refresh data for ${failure.failedSymbols} symbols`,
      details: failure,
      recommendation: 'Check network connectivity and Yahoo Finance API status'
    });
  }

  /**
   * Send training failure alert
   *
   * @param {Object} failure - Failure details
   */
  async alertTrainingFailure(failure) {
    return this.sendAlert({
      type: 'TRAINING_FAILURE',
      severity: 'CRITICAL',
      title: 'Model Training Failed',
      message: `Failed to train ${failure.failedModels} models`,
      details: failure,
      recommendation: 'Check training logs and GPU availability'
    });
  }

  /**
   * Send deployment failure alert
   *
   * @param {Object} failure - Failure details
   */
  async alertDeploymentFailure(failure) {
    return this.sendAlert({
      type: 'DEPLOYMENT_FAILURE',
      severity: 'CRITICAL',
      title: 'Model Deployment Failed',
      message: failure.message,
      details: failure,
      recommendation: 'Check model validation results and rollback if necessary'
    });
  }

  /**
   * Send validation failure alert
   *
   * @param {Object} failure - Failure details
   */
  async alertValidationFailure(failure) {
    return this.sendAlert({
      type: 'VALIDATION_FAILURE',
      severity: 'WARNING',
      title: 'Model Validation Failed',
      message: `New models failed validation (${failure.reason})`,
      details: failure,
      recommendation: 'Models not deployed. Review training data and hyperparameters'
    });
  }

  /**
   * Send info alert (non-critical)
   *
   * @param {string} title - Alert title
   * @param {string} message - Alert message
   * @param {Object} details - Additional details
   */
  async alertInfo(title, message, details = {}) {
    return this.sendAlert({
      type: 'INFO',
      severity: 'INFO',
      title,
      message,
      details
    });
  }

  /**
   * Send console alert
   *
   * @param {Object} alert - Alert record
   */
  sendConsoleAlert(alert) {
    const severityColors = {
      INFO: '\x1b[36m',      // Cyan
      WARNING: '\x1b[33m',   // Yellow
      ERROR: '\x1b[31m',     // Red
      CRITICAL: '\x1b[35m'   // Magenta
    };

    const color = severityColors[alert.severity] || '\x1b[0m';
    const reset = '\x1b[0m';

    console.log('');
    console.log('═══════════════════════════════════════════════════════════════════');
    console.log(`${color}ALERT: ${alert.severity}${reset}`);
    console.log('═══════════════════════════════════════════════════════════════════');
    console.log('');
    console.log(`Type:      ${alert.type}`);
    console.log(`Time:      ${alert.timestamp}`);
    console.log(`Title:     ${alert.title}`);
    console.log(`Message:   ${alert.message}`);

    if (alert.recommendation) {
      console.log('');
      console.log(`Recommendation: ${alert.recommendation}`);
    }

    console.log('');
    console.log('═══════════════════════════════════════════════════════════════════');
    console.log('');
  }

  /**
   * Send email alert (requires configured mail command)
   *
   * @param {Object} alert - Alert record
   */
  async sendEmailAlert(alert) {
    if (!this.alertEmail) {
      return;
    }

    try {
      const subject = `[Neural Trader] ${alert.severity}: ${alert.title}`;
      const body = `
Alert Type: ${alert.type}
Severity: ${alert.severity}
Time: ${alert.timestamp}

${alert.message}

${alert.recommendation ? 'Recommendation: ' + alert.recommendation : ''}

Details:
${JSON.stringify(alert.details, null, 2)}
`;

      // Use mail command (Linux/Mac)
      // Note: Requires mail utility to be installed and configured
      const command = `echo "${body.replace(/"/g, '\\"')}" | mail -s "${subject}" ${this.alertEmail}`;

      await execAsync(command);
    } catch (error) {
      console.error(`Failed to send email alert: ${error.message}`);
    }
  }

  /**
   * Send Slack alert
   *
   * @param {Object} alert - Alert record
   */
  async sendSlackAlert(alert) {
    if (!this.slackWebhook) {
      return;
    }

    try {
      const color = {
        INFO: '#36a64f',      // Green
        WARNING: '#ffcc00',   // Yellow
        ERROR: '#ff0000',     // Red
        CRITICAL: '#9900ff'   // Purple
      }[alert.severity] || '#cccccc';

      const payload = {
        attachments: [
          {
            color,
            title: `${alert.severity}: ${alert.title}`,
            text: alert.message,
            fields: [
              {
                title: 'Type',
                value: alert.type,
                short: true
              },
              {
                title: 'Time',
                value: new Date(alert.timestamp).toLocaleString(),
                short: true
              }
            ],
            footer: 'Neural Trader',
            ts: Math.floor(new Date(alert.timestamp).getTime() / 1000)
          }
        ]
      };

      if (alert.recommendation) {
        payload.attachments[0].fields.push({
          title: 'Recommendation',
          value: alert.recommendation,
          short: false
        });
      }

      // Send to Slack webhook
      const command = `curl -X POST -H 'Content-type: application/json' --data '${JSON.stringify(payload)}' ${this.slackWebhook}`;

      await execAsync(command);
    } catch (error) {
      console.error(`Failed to send Slack alert: ${error.message}`);
    }
  }

  /**
   * Log alert to file
   *
   * @param {Object} alert - Alert record
   */
  logAlert(alert) {
    const alertLog = this.loadAlertLog();
    alertLog.alerts.push(alert);

    // Keep last 1000 alerts
    if (alertLog.alerts.length > 1000) {
      alertLog.alerts = alertLog.alerts.slice(-1000);
    }

    fs.writeFileSync(this.alertLogFile, JSON.stringify(alertLog, null, 2));
  }

  /**
   * Get recent alerts
   *
   * @param {number} limit - Number of alerts to retrieve
   * @returns {Array} Recent alerts
   */
  getRecentAlerts(limit = 20) {
    const alertLog = this.loadAlertLog();
    return alertLog.alerts
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, limit);
  }

  /**
   * Get alerts by type
   *
   * @param {string} type - Alert type
   * @param {number} limit - Number of alerts to retrieve
   * @returns {Array} Alerts of specified type
   */
  getAlertsByType(type, limit = 20) {
    const alertLog = this.loadAlertLog();
    return alertLog.alerts
      .filter(alert => alert.type === type)
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, limit);
  }

  /**
   * Get alert summary
   *
   * @param {number} days - Number of days to summarize
   * @returns {Object} Alert summary
   */
  getAlertSummary(days = 7) {
    const alertLog = this.loadAlertLog();
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const recentAlerts = alertLog.alerts.filter(alert =>
      new Date(alert.timestamp) > cutoffDate
    );

    const summary = {
      totalAlerts: recentAlerts.length,
      bySeverity: {
        INFO: 0,
        WARNING: 0,
        ERROR: 0,
        CRITICAL: 0
      },
      byType: {}
    };

    recentAlerts.forEach(alert => {
      summary.bySeverity[alert.severity] = (summary.bySeverity[alert.severity] || 0) + 1;
      summary.byType[alert.type] = (summary.byType[alert.type] || 0) + 1;
    });

    return summary;
  }

  /**
   * Clear old alerts
   *
   * @param {number} daysToKeep - Number of days to keep
   */
  clearOldAlerts(daysToKeep = 30) {
    const alertLog = this.loadAlertLog();
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    const filteredAlerts = alertLog.alerts.filter(alert =>
      new Date(alert.timestamp) > cutoffDate
    );

    alertLog.alerts = filteredAlerts;
    fs.writeFileSync(this.alertLogFile, JSON.stringify(alertLog, null, 2));

    return {
      removed: alertLog.alerts.length - filteredAlerts.length,
      remaining: filteredAlerts.length
    };
  }

  /**
   * Generate unique alert ID
   */
  generateAlertId() {
    return `alert_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  }

  /**
   * Load alert log from file
   */
  loadAlertLog() {
    if (!fs.existsSync(this.alertLogFile)) {
      return { alerts: [] };
    }
    const data = fs.readFileSync(this.alertLogFile, 'utf8');
    return JSON.parse(data);
  }
}

module.exports = AlertingSystem;
