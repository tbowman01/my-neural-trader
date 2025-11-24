const fs = require('fs');
const path = require('path');

/**
 * Data Refresh System for Neural Trader
 *
 * Handles incremental updates of historical market data:
 * - Loads existing data files
 * - Fetches only new bars since last update
 * - Validates data quality
 * - Merges and saves updated files
 * - Logs all refresh operations
 */
class DataRefreshSystem {
  constructor(options = {}) {
    this.dataDir = options.dataDir || path.join(__dirname, '..', 'historical-data');
    this.logFile = options.logFile || path.join(__dirname, '..', 'data', 'refresh-log.json');
    this.yahooFinance = null;
    this.maxBarsPerFetch = options.maxBarsPerFetch || 100;
    this.rateLimitDelay = options.rateLimitDelay || 1000; // ms between requests
  }

  /**
   * Initialize Yahoo Finance connection
   */
  async initialize() {
    try {
      const YahooFinance = require('yahoo-finance2').default;
      this.yahooFinance = new YahooFinance();
      return true;
    } catch (error) {
      throw new Error('yahoo-finance2 package not installed. Run: npm install yahoo-finance2');
    }
  }

  /**
   * Get list of all symbols from existing data files
   */
  async getSymbolList() {
    const files = fs.readdirSync(this.dataDir)
      .filter(f => f.endsWith('-5-years.json'));

    return files.map(f => f.replace('-5-years.json', ''));
  }

  /**
   * Load existing data for a symbol
   */
  loadExistingData(symbol) {
    try {
      const filePath = path.join(this.dataDir, `${symbol}-5-years.json`);
      if (!fs.existsSync(filePath)) {
        return null;
      }

      const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      return data;
    } catch (error) {
      console.error(`Error loading existing data for ${symbol}:`, error.message);
      return null;
    }
  }

  /**
   * Get the last date in existing data
   */
  getLastDate(data) {
    if (!data || data.length === 0) {
      return null;
    }

    // Data should be sorted by date, get last entry
    const lastBar = data[data.length - 1];
    return new Date(lastBar.date);
  }

  /**
   * Fetch new bars since last date
   */
  async fetchNewBars(symbol, lastDate) {
    if (!this.yahooFinance) {
      throw new Error('Yahoo Finance not initialized. Call initialize() first.');
    }

    // Calculate start date (day after last bar)
    const startDate = new Date(lastDate);
    startDate.setDate(startDate.getDate() + 1);

    // End date is today
    const endDate = new Date();

    // If no new data needed, return empty
    if (startDate >= endDate) {
      return [];
    }

    try {
      const data = await this.yahooFinance.historical(symbol, {
        period1: startDate.toISOString().split('T')[0],
        period2: endDate.toISOString().split('T')[0],
        interval: '1d'
      });

      // Format data
      const formatted = data.map(bar => ({
        date: bar.date.toISOString().split('T')[0],
        open: Math.round(bar.open * 100) / 100,
        high: Math.round(bar.high * 100) / 100,
        low: Math.round(bar.low * 100) / 100,
        close: Math.round(bar.close * 100) / 100,
        volume: bar.volume
      }));

      return formatted;
    } catch (error) {
      throw new Error(`Failed to fetch ${symbol}: ${error.message}`);
    }
  }

  /**
   * Validate data quality
   */
  validateData(symbol, bars) {
    const issues = [];

    if (!bars || bars.length === 0) {
      return { valid: true, issues: [] };
    }

    // Check for null/undefined values
    for (let i = 0; i < bars.length; i++) {
      const bar = bars[i];
      if (!bar.date || !bar.open || !bar.high || !bar.low || !bar.close) {
        issues.push(`Bar ${i}: Missing required fields`);
      }

      // Check for invalid prices
      if (bar.high < bar.low) {
        issues.push(`Bar ${i} (${bar.date}): High < Low`);
      }
      if (bar.close > bar.high || bar.close < bar.low) {
        issues.push(`Bar ${i} (${bar.date}): Close outside High/Low range`);
      }
      if (bar.open > bar.high || bar.open < bar.low) {
        issues.push(`Bar ${i} (${bar.date}): Open outside High/Low range`);
      }

      // Check for suspicious price movements (>50% in one day)
      if (i > 0) {
        const prevClose = bars[i - 1].close;
        const change = Math.abs((bar.close - prevClose) / prevClose);
        if (change > 0.5) {
          issues.push(`Bar ${i} (${bar.date}): Suspicious ${(change * 100).toFixed(1)}% move`);
        }
      }

      // Check for zero volume
      if (bar.volume === 0) {
        issues.push(`Bar ${i} (${bar.date}): Zero volume`);
      }
    }

    // Check for date gaps (missing trading days are OK, but large gaps are suspicious)
    for (let i = 1; i < bars.length; i++) {
      const prevDate = new Date(bars[i - 1].date);
      const currDate = new Date(bars[i].date);
      const daysDiff = (currDate - prevDate) / (1000 * 60 * 60 * 24);

      if (daysDiff > 10) {
        issues.push(`Gap of ${daysDiff.toFixed(0)} days between ${bars[i - 1].date} and ${bars[i].date}`);
      }
    }

    return {
      valid: issues.length === 0,
      issues: issues
    };
  }

  /**
   * Merge new bars with existing data
   */
  mergeData(existingData, newBars) {
    if (!existingData || existingData.length === 0) {
      return newBars;
    }

    if (!newBars || newBars.length === 0) {
      return existingData;
    }

    // Create a map of existing dates for quick lookup
    const existingDates = new Set(existingData.map(bar => bar.date));

    // Filter new bars to only include dates not in existing data
    const uniqueNewBars = newBars.filter(bar => !existingDates.has(bar.date));

    // Concatenate and sort by date
    const merged = [...existingData, ...uniqueNewBars];
    merged.sort((a, b) => new Date(a.date) - new Date(b.date));

    return merged;
  }

  /**
   * Save updated data to file
   */
  saveData(symbol, data) {
    const filePath = path.join(this.dataDir, `${symbol}-5-years.json`);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  }

  /**
   * Log refresh operation
   */
  logRefresh(refreshLog) {
    // Ensure data directory exists
    const dataDir = path.dirname(this.logFile);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    // Load existing log
    let log = [];
    if (fs.existsSync(this.logFile)) {
      try {
        log = JSON.parse(fs.readFileSync(this.logFile, 'utf8'));
      } catch (error) {
        console.warn('Could not load existing log, starting fresh');
      }
    }

    // Add new entry
    log.push(refreshLog);

    // Keep only last 100 entries
    if (log.length > 100) {
      log = log.slice(-100);
    }

    // Save log
    fs.writeFileSync(this.logFile, JSON.stringify(log, null, 2));
  }

  /**
   * Refresh data for a single symbol
   */
  async refreshSymbol(symbol) {
    const startTime = Date.now();
    const result = {
      symbol,
      timestamp: new Date().toISOString(),
      success: false,
      newBars: 0,
      totalBars: 0,
      errors: []
    };

    try {
      // Load existing data
      const existingData = this.loadExistingData(symbol);
      if (!existingData) {
        result.errors.push('No existing data file found');
        return result;
      }

      result.totalBars = existingData.length;

      // Get last date
      const lastDate = this.getLastDate(existingData);
      if (!lastDate) {
        result.errors.push('Could not determine last date');
        return result;
      }

      // Fetch new bars
      const newBars = await this.fetchNewBars(symbol, lastDate);
      result.newBars = newBars.length;

      if (newBars.length === 0) {
        result.success = true;
        result.message = 'Already up to date';
        return result;
      }

      // Validate new bars
      const validation = this.validateData(symbol, newBars);
      if (!validation.valid) {
        result.errors.push(...validation.issues);
        result.message = 'Data validation failed';
        return result;
      }

      // Merge data
      const merged = this.mergeData(existingData, newBars);
      result.totalBars = merged.length;

      // Save updated data
      this.saveData(symbol, merged);

      result.success = true;
      result.message = `Added ${newBars.length} new bars`;
      result.duration = Date.now() - startTime;

    } catch (error) {
      result.errors.push(error.message);
      result.message = 'Refresh failed';
    }

    return result;
  }

  /**
   * Refresh data for all symbols
   */
  async refreshAll(options = {}) {
    const symbols = options.symbols || await this.getSymbolList();
    const results = [];

    console.log(`Starting data refresh for ${symbols.length} symbols...`);
    console.log('');

    for (let i = 0; i < symbols.length; i++) {
      const symbol = symbols[i];
      console.log(`[${i + 1}/${symbols.length}] Refreshing ${symbol}...`);

      try {
        const result = await this.refreshSymbol(symbol);
        results.push(result);

        if (result.success) {
          console.log(`  ✓ ${result.message} (${result.totalBars} total bars)`);
        } else {
          console.log(`  ✗ ${result.message}`);
          if (result.errors.length > 0) {
            result.errors.forEach(err => console.log(`    - ${err}`));
          }
        }

        // Rate limiting
        if (i < symbols.length - 1) {
          await new Promise(resolve => setTimeout(resolve, this.rateLimitDelay));
        }

      } catch (error) {
        console.log(`  ✗ Error: ${error.message}`);
        results.push({
          symbol,
          timestamp: new Date().toISOString(),
          success: false,
          errors: [error.message]
        });
      }

      console.log('');
    }

    // Generate summary
    const summary = {
      timestamp: new Date().toISOString(),
      totalSymbols: symbols.length,
      successful: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      totalNewBars: results.reduce((sum, r) => sum + (r.newBars || 0), 0),
      results: results
    };

    // Log refresh
    this.logRefresh(summary);

    return summary;
  }

  /**
   * Get refresh history
   */
  getRefreshHistory(limit = 10) {
    if (!fs.existsSync(this.logFile)) {
      return [];
    }

    try {
      const log = JSON.parse(fs.readFileSync(this.logFile, 'utf8'));
      return log.slice(-limit);
    } catch (error) {
      console.error('Error reading refresh log:', error.message);
      return [];
    }
  }
}

module.exports = DataRefreshSystem;
