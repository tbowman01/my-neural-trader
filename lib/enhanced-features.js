// ═══════════════════════════════════════════════════════════════════
//                   ENHANCED FEATURE ENGINEERING
// ═══════════════════════════════════════════════════════════════════
//
// Advanced technical indicators and features to improve model confidence
//
// Features include (24 indicators total):
// - Momentum indicators (RSI, MACD, Stochastic, ROC, Williams %R,
//   Ultimate Oscillator, CCI)
// - Volatility indicators (ATR, Bollinger Bands, Keltner Channels,
//   Donchian Channels)
// - Trend indicators (Moving averages, ADX, Parabolic SAR, Ichimoku Cloud,
//   Linear Regression Slope)
// - Volume indicators (OBV, Volume MA, MFI, CMF, VWAP)
//
// ═══════════════════════════════════════════════════════════════════

class EnhancedFeatures {

  // Calculate Simple Moving Average
  static sma(data, period) {
    const result = [];
    for (let i = 0; i < data.length; i++) {
      if (i < period - 1) {
        result.push(null);
      } else {
        const sum = data.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
        result.push(sum / period);
      }
    }
    return result;
  }

  // Calculate Exponential Moving Average
  static ema(data, period) {
    const result = [];
    const multiplier = 2 / (period + 1);

    // Start with SMA for first value
    let ema = data.slice(0, period).reduce((a, b) => a + b, 0) / period;

    for (let i = 0; i < data.length; i++) {
      if (i < period - 1) {
        result.push(null);
      } else if (i === period - 1) {
        result.push(ema);
      } else {
        ema = (data[i] - ema) * multiplier + ema;
        result.push(ema);
      }
    }
    return result;
  }

  // Relative Strength Index (RSI)
  static rsi(closes, period = 14) {
    const changes = [];
    for (let i = 1; i < closes.length; i++) {
      changes.push(closes[i] - closes[i - 1]);
    }

    const gains = changes.map(c => c > 0 ? c : 0);
    const losses = changes.map(c => c < 0 ? Math.abs(c) : 0);

    const avgGains = this.ema(gains, period);
    const avgLosses = this.ema(losses, period);

    const rsi = [];
    rsi.push(null); // First value is null (no change yet)

    for (let i = 0; i < avgGains.length; i++) {
      if (avgGains[i] === null || avgLosses[i] === null) {
        rsi.push(null);
      } else if (avgLosses[i] === 0) {
        rsi.push(100);
      } else {
        const rs = avgGains[i] / avgLosses[i];
        rsi.push(100 - (100 / (1 + rs)));
      }
    }

    return rsi;
  }

  // Moving Average Convergence Divergence (MACD)
  static macd(closes, fastPeriod = 12, slowPeriod = 26, signalPeriod = 9) {
    const fastEMA = this.ema(closes, fastPeriod);
    const slowEMA = this.ema(closes, slowPeriod);

    const macdLine = [];
    for (let i = 0; i < closes.length; i++) {
      if (fastEMA[i] === null || slowEMA[i] === null) {
        macdLine.push(null);
      } else {
        macdLine.push(fastEMA[i] - slowEMA[i]);
      }
    }

    // Signal line is EMA of MACD line
    const signalLine = this.ema(macdLine.filter(v => v !== null), signalPeriod);

    // Histogram
    const histogram = [];
    let signalIdx = 0;
    for (let i = 0; i < macdLine.length; i++) {
      if (macdLine[i] === null) {
        histogram.push(null);
      } else {
        if (signalLine[signalIdx] === null) {
          histogram.push(null);
        } else {
          histogram.push(macdLine[i] - signalLine[signalIdx]);
        }
        signalIdx++;
      }
    }

    return { macdLine, signalLine: this.alignSignal(signalLine, macdLine), histogram };
  }

  static alignSignal(signal, macd) {
    const aligned = [];
    let signalIdx = 0;
    for (let i = 0; i < macd.length; i++) {
      if (macd[i] === null) {
        aligned.push(null);
      } else {
        aligned.push(signal[signalIdx] || null);
        signalIdx++;
      }
    }
    return aligned;
  }

  // Bollinger Bands
  static bollingerBands(closes, period = 20, stdDev = 2) {
    const sma = this.sma(closes, period);
    const upper = [];
    const lower = [];

    for (let i = 0; i < closes.length; i++) {
      if (sma[i] === null) {
        upper.push(null);
        lower.push(null);
      } else {
        const slice = closes.slice(Math.max(0, i - period + 1), i + 1);
        const std = this.standardDeviation(slice);
        upper.push(sma[i] + (std * stdDev));
        lower.push(sma[i] - (std * stdDev));
      }
    }

    // Calculate position within bands (0 = lower band, 1 = upper band)
    const position = [];
    for (let i = 0; i < closes.length; i++) {
      if (upper[i] === null || lower[i] === null) {
        position.push(null);
      } else {
        const range = upper[i] - lower[i];
        if (range === 0) {
          position.push(0.5);
        } else {
          position.push((closes[i] - lower[i]) / range);
        }
      }
    }

    return { upper, middle: sma, lower, position };
  }

  // Average True Range (ATR) - volatility indicator
  static atr(highs, lows, closes, period = 14) {
    const tr = [highs[0] - lows[0]];

    for (let i = 1; i < closes.length; i++) {
      const trueRange = Math.max(
        highs[i] - lows[i],
        Math.abs(highs[i] - closes[i - 1]),
        Math.abs(lows[i] - closes[i - 1])
      );
      tr.push(trueRange);
    }

    return this.ema(tr, period);
  }

  // On Balance Volume (OBV)
  static obv(closes, volumes) {
    const obv = [volumes[0]];

    for (let i = 1; i < closes.length; i++) {
      if (closes[i] > closes[i - 1]) {
        obv.push(obv[i - 1] + volumes[i]);
      } else if (closes[i] < closes[i - 1]) {
        obv.push(obv[i - 1] - volumes[i]);
      } else {
        obv.push(obv[i - 1]);
      }
    }

    return obv;
  }

  // Stochastic Oscillator
  static stochastic(highs, lows, closes, period = 14, smoothK = 3, smoothD = 3) {
    const k = [];

    for (let i = 0; i < closes.length; i++) {
      if (i < period - 1) {
        k.push(null);
      } else {
        const slice = closes.slice(i - period + 1, i + 1);
        const highSlice = highs.slice(i - period + 1, i + 1);
        const lowSlice = lows.slice(i - period + 1, i + 1);

        const highestHigh = Math.max(...highSlice);
        const lowestLow = Math.min(...lowSlice);

        if (highestHigh === lowestLow) {
          k.push(50);
        } else {
          k.push(((closes[i] - lowestLow) / (highestHigh - lowestLow)) * 100);
        }
      }
    }

    const smoothedK = this.sma(k.filter(v => v !== null), smoothK);
    const d = this.sma(smoothedK.filter(v => v !== null), smoothD);

    return { k: this.alignToOriginal(smoothedK, k), d: this.alignToOriginal(d, k) };
  }

  static alignToOriginal(smoothed, original) {
    const aligned = [];
    let smoothIdx = 0;
    for (let i = 0; i < original.length; i++) {
      if (original[i] === null) {
        aligned.push(null);
      } else {
        aligned.push(smoothed[smoothIdx] || null);
        smoothIdx++;
      }
    }
    return aligned;
  }

  // Money Flow Index (MFI) - volume-weighted RSI
  static mfi(highs, lows, closes, volumes, period = 14) {
    const typicalPrices = [];
    const moneyFlows = [];

    for (let i = 0; i < closes.length; i++) {
      const tp = (highs[i] + lows[i] + closes[i]) / 3;
      typicalPrices.push(tp);
      moneyFlows.push(tp * volumes[i]);
    }

    const mfi = [null];
    for (let i = 1; i < closes.length; i++) {
      if (i < period) {
        mfi.push(null);
      } else {
        let positiveFlow = 0;
        let negativeFlow = 0;

        for (let j = i - period + 1; j <= i; j++) {
          if (typicalPrices[j] > typicalPrices[j - 1]) {
            positiveFlow += moneyFlows[j];
          } else {
            negativeFlow += moneyFlows[j];
          }
        }

        if (negativeFlow === 0) {
          mfi.push(100);
        } else {
          const mfRatio = positiveFlow / negativeFlow;
          mfi.push(100 - (100 / (1 + mfRatio)));
        }
      }
    }

    return mfi;
  }

  // Rate of Change (ROC)
  static roc(closes, period = 12) {
    const roc = [];
    for (let i = 0; i < closes.length; i++) {
      if (i < period) {
        roc.push(null);
      } else {
        roc.push(((closes[i] - closes[i - period]) / closes[i - period]) * 100);
      }
    }
    return roc;
  }

  // Williams %R
  static williamsR(highs, lows, closes, period = 14) {
    const wr = [];

    for (let i = 0; i < closes.length; i++) {
      if (i < period - 1) {
        wr.push(null);
      } else {
        const highSlice = highs.slice(i - period + 1, i + 1);
        const lowSlice = lows.slice(i - period + 1, i + 1);

        const highestHigh = Math.max(...highSlice);
        const lowestLow = Math.min(...lowSlice);

        if (highestHigh === lowestLow) {
          wr.push(-50);
        } else {
          wr.push(((highestHigh - closes[i]) / (highestHigh - lowestLow)) * -100);
        }
      }
    }

    return wr;
  }

  // Standard Deviation helper
  static standardDeviation(values) {
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const squaredDiffs = values.map(v => Math.pow(v - mean, 2));
    const avgSquaredDiff = squaredDiffs.reduce((a, b) => a + b, 0) / values.length;
    return Math.sqrt(avgSquaredDiff);
  }

  // ═══════════════════════════════════════════════════════════════════
  //                     ADVANCED INDICATORS (10 NEW)
  // ═══════════════════════════════════════════════════════════════════

  // Average Directional Index (ADX) - Trend strength indicator
  // Returns values 0-100, >25 indicates strong trend
  static adx(highs, lows, closes, period = 14) {
    const tr = [];
    const plusDM = [];
    const minusDM = [];

    // Calculate True Range and Directional Movement
    for (let i = 0; i < closes.length; i++) {
      if (i === 0) {
        tr.push(highs[i] - lows[i]);
        plusDM.push(0);
        minusDM.push(0);
      } else {
        // True Range
        const trueRange = Math.max(
          highs[i] - lows[i],
          Math.abs(highs[i] - closes[i - 1]),
          Math.abs(lows[i] - closes[i - 1])
        );
        tr.push(trueRange);

        // Directional Movement
        const upMove = highs[i] - highs[i - 1];
        const downMove = lows[i - 1] - lows[i];

        if (upMove > downMove && upMove > 0) {
          plusDM.push(upMove);
        } else {
          plusDM.push(0);
        }

        if (downMove > upMove && downMove > 0) {
          minusDM.push(downMove);
        } else {
          minusDM.push(0);
        }
      }
    }

    // Smooth the values
    const smoothedTR = this.ema(tr, period);
    const smoothedPlusDM = this.ema(plusDM, period);
    const smoothedMinusDM = this.ema(minusDM, period);

    // Calculate DI+ and DI-
    const plusDI = [];
    const minusDI = [];
    for (let i = 0; i < closes.length; i++) {
      if (smoothedTR[i] === null || smoothedTR[i] === 0) {
        plusDI.push(null);
        minusDI.push(null);
      } else {
        plusDI.push((smoothedPlusDM[i] / smoothedTR[i]) * 100);
        minusDI.push((smoothedMinusDM[i] / smoothedTR[i]) * 100);
      }
    }

    // Calculate DX and ADX
    const dx = [];
    for (let i = 0; i < closes.length; i++) {
      if (plusDI[i] === null || minusDI[i] === null) {
        dx.push(null);
      } else {
        const sum = plusDI[i] + minusDI[i];
        if (sum === 0) {
          dx.push(0);
        } else {
          dx.push((Math.abs(plusDI[i] - minusDI[i]) / sum) * 100);
        }
      }
    }

    // ADX is smoothed DX
    return this.ema(dx.filter(v => v !== null), period);
  }

  // Commodity Channel Index (CCI) - Overbought/Oversold indicator
  // Typical range: -200 to +200, >+100 overbought, <-100 oversold
  static cci(highs, lows, closes, period = 20) {
    const typicalPrices = [];
    for (let i = 0; i < closes.length; i++) {
      typicalPrices.push((highs[i] + lows[i] + closes[i]) / 3);
    }

    const sma = this.sma(typicalPrices, period);
    const cci = [];

    for (let i = 0; i < closes.length; i++) {
      if (i < period - 1 || sma[i] === null) {
        cci.push(null);
      } else {
        const slice = typicalPrices.slice(i - period + 1, i + 1);
        const meanDev = slice.reduce((sum, tp) => sum + Math.abs(tp - sma[i]), 0) / period;

        if (meanDev === 0) {
          cci.push(0);
        } else {
          cci.push((typicalPrices[i] - sma[i]) / (0.015 * meanDev));
        }
      }
    }

    return cci;
  }

  // Ultimate Oscillator - Multi-timeframe momentum indicator
  // Combines 3 timeframes (7, 14, 28 periods)
  static ultimateOscillator(highs, lows, closes, period1 = 7, period2 = 14, period3 = 28) {
    const buyingPressure = [];
    const trueRange = [];

    for (let i = 0; i < closes.length; i++) {
      if (i === 0) {
        buyingPressure.push(closes[i] - lows[i]);
        trueRange.push(highs[i] - lows[i]);
      } else {
        const trueLow = Math.min(lows[i], closes[i - 1]);
        const trueHigh = Math.max(highs[i], closes[i - 1]);

        buyingPressure.push(closes[i] - trueLow);
        trueRange.push(trueHigh - trueLow);
      }
    }

    const uo = [];
    const maxPeriod = Math.max(period1, period2, period3);

    for (let i = 0; i < closes.length; i++) {
      if (i < maxPeriod - 1) {
        uo.push(null);
      } else {
        const bp1 = buyingPressure.slice(i - period1 + 1, i + 1).reduce((a, b) => a + b, 0);
        const tr1 = trueRange.slice(i - period1 + 1, i + 1).reduce((a, b) => a + b, 0);

        const bp2 = buyingPressure.slice(i - period2 + 1, i + 1).reduce((a, b) => a + b, 0);
        const tr2 = trueRange.slice(i - period2 + 1, i + 1).reduce((a, b) => a + b, 0);

        const bp3 = buyingPressure.slice(i - period3 + 1, i + 1).reduce((a, b) => a + b, 0);
        const tr3 = trueRange.slice(i - period3 + 1, i + 1).reduce((a, b) => a + b, 0);

        if (tr1 === 0 || tr2 === 0 || tr3 === 0) {
          uo.push(50);
        } else {
          const avg1 = bp1 / tr1;
          const avg2 = bp2 / tr2;
          const avg3 = bp3 / tr3;

          uo.push(100 * ((4 * avg1) + (2 * avg2) + avg3) / 7);
        }
      }
    }

    return uo;
  }

  // Keltner Channels - ATR-based volatility bands
  // Returns upper band, lower band, and position within bands
  static keltnerChannels(highs, lows, closes, period = 20, multiplier = 2) {
    const typicalPrices = [];
    for (let i = 0; i < closes.length; i++) {
      typicalPrices.push((highs[i] + lows[i] + closes[i]) / 3);
    }

    const middle = this.ema(typicalPrices, period);
    const atr = this.atr(highs, lows, closes, period);

    const upper = [];
    const lower = [];
    const position = [];

    for (let i = 0; i < closes.length; i++) {
      if (middle[i] === null || atr[i] === null) {
        upper.push(null);
        lower.push(null);
        position.push(null);
      } else {
        const upperBand = middle[i] + (atr[i] * multiplier);
        const lowerBand = middle[i] - (atr[i] * multiplier);

        upper.push(upperBand);
        lower.push(lowerBand);

        // Position within bands (0 = lower, 1 = upper)
        const range = upperBand - lowerBand;
        if (range === 0) {
          position.push(0.5);
        } else {
          position.push((closes[i] - lowerBand) / range);
        }
      }
    }

    return { upper, middle, lower, position };
  }

  // Donchian Channels - Price breakout indicator
  // Tracks highest high and lowest low over period
  static donchianChannels(highs, lows, closes, period = 20) {
    const upper = [];
    const lower = [];
    const position = [];

    for (let i = 0; i < closes.length; i++) {
      if (i < period - 1) {
        upper.push(null);
        lower.push(null);
        position.push(null);
      } else {
        const highSlice = highs.slice(i - period + 1, i + 1);
        const lowSlice = lows.slice(i - period + 1, i + 1);

        const upperBand = Math.max(...highSlice);
        const lowerBand = Math.min(...lowSlice);

        upper.push(upperBand);
        lower.push(lowerBand);

        // Position within channel
        const range = upperBand - lowerBand;
        if (range === 0) {
          position.push(0.5);
        } else {
          position.push((closes[i] - lowerBand) / range);
        }
      }
    }

    return { upper, lower, position };
  }

  // Chaikin Money Flow (CMF) - Volume-weighted accumulation/distribution
  // Range: -1 to +1, positive = buying pressure, negative = selling pressure
  static cmf(highs, lows, closes, volumes, period = 20) {
    const moneyFlowMultiplier = [];
    const moneyFlowVolume = [];

    for (let i = 0; i < closes.length; i++) {
      const range = highs[i] - lows[i];
      if (range === 0) {
        moneyFlowMultiplier.push(0);
      } else {
        moneyFlowMultiplier.push(((closes[i] - lows[i]) - (highs[i] - closes[i])) / range);
      }
      moneyFlowVolume.push(moneyFlowMultiplier[i] * volumes[i]);
    }

    const cmf = [];
    for (let i = 0; i < closes.length; i++) {
      if (i < period - 1) {
        cmf.push(null);
      } else {
        const mfvSum = moneyFlowVolume.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
        const volSum = volumes.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);

        if (volSum === 0) {
          cmf.push(0);
        } else {
          cmf.push(mfvSum / volSum);
        }
      }
    }

    return cmf;
  }

  // Volume Weighted Average Price (VWAP) - Intraday benchmark
  // Cumulative average price weighted by volume
  static vwap(highs, lows, closes, volumes) {
    const typicalPrices = [];
    for (let i = 0; i < closes.length; i++) {
      typicalPrices.push((highs[i] + lows[i] + closes[i]) / 3);
    }

    const vwap = [];
    let cumulativeTPV = 0;
    let cumulativeVolume = 0;

    for (let i = 0; i < closes.length; i++) {
      cumulativeTPV += typicalPrices[i] * volumes[i];
      cumulativeVolume += volumes[i];

      if (cumulativeVolume === 0) {
        vwap.push(closes[i]);
      } else {
        vwap.push(cumulativeTPV / cumulativeVolume);
      }
    }

    // Calculate position relative to VWAP
    const position = [];
    for (let i = 0; i < closes.length; i++) {
      position.push((closes[i] / vwap[i]) - 1);
    }

    return { vwap, position };
  }

  // Parabolic SAR - Trend reversal indicator
  // Returns SAR values and trend direction (1 = uptrend, -1 = downtrend)
  static parabolicSAR(highs, lows, closes, acceleration = 0.02, maximum = 0.2) {
    const sar = [];
    const trend = [];

    if (closes.length < 2) {
      return { sar: [null], trend: [0] };
    }

    // Initialize
    let isUptrend = closes[1] > closes[0];
    let currentSAR = isUptrend ? lows[0] : highs[0];
    let extremePoint = isUptrend ? highs[1] : lows[1];
    let accelerationFactor = acceleration;

    sar.push(currentSAR);
    trend.push(isUptrend ? 1 : -1);

    for (let i = 1; i < closes.length; i++) {
      // Calculate new SAR
      currentSAR = currentSAR + accelerationFactor * (extremePoint - currentSAR);

      // Check for reversal
      let reversed = false;
      if (isUptrend) {
        if (lows[i] < currentSAR) {
          reversed = true;
          isUptrend = false;
          currentSAR = extremePoint;
          extremePoint = lows[i];
          accelerationFactor = acceleration;
        }
      } else {
        if (highs[i] > currentSAR) {
          reversed = true;
          isUptrend = true;
          currentSAR = extremePoint;
          extremePoint = highs[i];
          accelerationFactor = acceleration;
        }
      }

      // Update extreme point and acceleration if not reversed
      if (!reversed) {
        if (isUptrend) {
          if (highs[i] > extremePoint) {
            extremePoint = highs[i];
            accelerationFactor = Math.min(accelerationFactor + acceleration, maximum);
          }
        } else {
          if (lows[i] < extremePoint) {
            extremePoint = lows[i];
            accelerationFactor = Math.min(accelerationFactor + acceleration, maximum);
          }
        }
      }

      sar.push(currentSAR);
      trend.push(isUptrend ? 1 : -1);
    }

    return { sar, trend };
  }

  // Ichimoku Cloud (Simplified) - Japanese trend indicator
  // Returns Tenkan-sen (conversion line) and Kijun-sen (base line)
  static ichimoku(highs, lows, closes, tenkanPeriod = 9, kijunPeriod = 26) {
    const tenkan = [];
    const kijun = [];

    // Calculate Tenkan-sen (conversion line)
    for (let i = 0; i < closes.length; i++) {
      if (i < tenkanPeriod - 1) {
        tenkan.push(null);
      } else {
        const highSlice = highs.slice(i - tenkanPeriod + 1, i + 1);
        const lowSlice = lows.slice(i - tenkanPeriod + 1, i + 1);
        const highest = Math.max(...highSlice);
        const lowest = Math.min(...lowSlice);
        tenkan.push((highest + lowest) / 2);
      }
    }

    // Calculate Kijun-sen (base line)
    for (let i = 0; i < closes.length; i++) {
      if (i < kijunPeriod - 1) {
        kijun.push(null);
      } else {
        const highSlice = highs.slice(i - kijunPeriod + 1, i + 1);
        const lowSlice = lows.slice(i - kijunPeriod + 1, i + 1);
        const highest = Math.max(...highSlice);
        const lowest = Math.min(...lowSlice);
        kijun.push((highest + lowest) / 2);
      }
    }

    // Calculate signal (TK cross)
    const signal = [];
    for (let i = 0; i < closes.length; i++) {
      if (tenkan[i] === null || kijun[i] === null) {
        signal.push(null);
      } else {
        signal.push(tenkan[i] - kijun[i]);
      }
    }

    return { tenkan, kijun, signal };
  }

  // Linear Regression Slope - Trend direction and strength
  // Returns slope and angle in degrees
  static linearRegressionSlope(closes, period = 14) {
    const slopes = [];
    const angles = [];

    for (let i = 0; i < closes.length; i++) {
      if (i < period - 1) {
        slopes.push(null);
        angles.push(null);
      } else {
        const slice = closes.slice(i - period + 1, i + 1);

        // Calculate linear regression
        let sumX = 0;
        let sumY = 0;
        let sumXY = 0;
        let sumX2 = 0;

        for (let j = 0; j < period; j++) {
          sumX += j;
          sumY += slice[j];
          sumXY += j * slice[j];
          sumX2 += j * j;
        }

        const n = period;
        const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);

        // Normalize slope to percentage
        const avgPrice = sumY / n;
        const normalizedSlope = avgPrice !== 0 ? (slope / avgPrice) * 100 : 0;

        // Convert to angle (in degrees)
        const angle = Math.atan(slope) * (180 / Math.PI);

        slopes.push(normalizedSlope);
        angles.push(angle);
      }
    }

    return { slope: slopes, angle: angles };
  }

  // Generate all features for a symbol
  static generateAllFeatures(bars) {
    const closes = bars.map(b => b.close);
    const highs = bars.map(b => b.high);
    const lows = bars.map(b => b.low);
    const opens = bars.map(b => b.open);
    const volumes = bars.map(b => b.volume);

    console.log(`  Generating technical indicators...`);

    // Trend indicators
    const sma5 = this.sma(closes, 5);
    const sma10 = this.sma(closes, 10);
    const sma20 = this.sma(closes, 20);
    const sma50 = this.sma(closes, 50);
    const sma200 = this.sma(closes, 200);
    const ema12 = this.ema(closes, 12);
    const ema26 = this.ema(closes, 26);

    // Momentum indicators
    const rsi = this.rsi(closes, 14);
    const macd = this.macd(closes);
    const roc = this.roc(closes, 12);
    const stoch = this.stochastic(highs, lows, closes);
    const williamsR = this.williamsR(highs, lows, closes);

    // Volatility indicators
    const bb = this.bollingerBands(closes);
    const atr = this.atr(highs, lows, closes);

    // Volume indicators
    const obv = this.obv(closes, volumes);
    const obvEma = this.ema(obv, 20);
    const mfi = this.mfi(highs, lows, closes, volumes);
    const volumeSma = this.sma(volumes, 20);

    // Advanced indicators (10 new)
    const adxValues = this.adx(highs, lows, closes, 14);
    const cciValues = this.cci(highs, lows, closes, 20);
    const ultimateOsc = this.ultimateOscillator(highs, lows, closes);
    const keltner = this.keltnerChannels(highs, lows, closes, 20, 2);
    const donchian = this.donchianChannels(highs, lows, closes, 20);
    const cmfValues = this.cmf(highs, lows, closes, volumes, 20);
    const vwapData = this.vwap(highs, lows, closes, volumes);
    const psar = this.parabolicSAR(highs, lows, closes);
    const ichimokuData = this.ichimoku(highs, lows, closes);
    const linReg = this.linearRegressionSlope(closes, 14);

    console.log(`  ✓ Generated 24 technical indicators`);

    // Align ADX values (since it filters nulls)
    const adxAligned = this.alignToOriginal(adxValues, closes.map((_, i) => i >= 13 ? i : null));

    // Combine all features
    const features = [];
    for (let i = 0; i < bars.length; i++) {
      features.push({
        // Price features
        close: closes[i],
        high: highs[i],
        low: lows[i],
        open: opens[i],
        volume: volumes[i],

        // Trend
        sma5: sma5[i],
        sma10: sma10[i],
        sma20: sma20[i],
        sma50: sma50[i],
        sma200: sma200[i],
        ema12: ema12[i],
        ema26: ema26[i],

        // Price vs moving averages
        priceVsSma20: sma20[i] ? (closes[i] / sma20[i]) - 1 : null,
        priceVsSma50: sma50[i] ? (closes[i] / sma50[i]) - 1 : null,
        priceVsSma200: sma200[i] ? (closes[i] / sma200[i]) - 1 : null,

        // Momentum
        rsi: rsi[i],
        macdLine: macd.macdLine[i],
        macdSignal: macd.signalLine[i],
        macdHistogram: macd.histogram[i],
        roc: roc[i],
        stochK: stoch.k[i],
        stochD: stoch.d[i],
        williamsR: williamsR[i],

        // Volatility
        bbUpper: bb.upper[i],
        bbMiddle: bb.middle[i],
        bbLower: bb.lower[i],
        bbPosition: bb.position[i],
        atr: atr[i],
        atrPercent: atr[i] && closes[i] ? (atr[i] / closes[i]) * 100 : null,

        // Volume
        obv: obv[i],
        obvEma: obvEma[i],
        obvTrend: obvEma[i] && obv[i] ? obv[i] / obvEma[i] : null,
        mfi: mfi[i],
        volumeRatio: volumeSma[i] ? volumes[i] / volumeSma[i] : null,

        // Advanced Indicators (10 new)
        // 1. ADX - Trend strength
        adx: adxAligned[i],

        // 2. CCI - Commodity Channel Index
        cci: cciValues[i],

        // 3. Ultimate Oscillator - Multi-timeframe momentum
        ultimateOsc: ultimateOsc[i],

        // 4. Keltner Channels - ATR-based bands
        keltnerUpper: keltner.upper[i],
        keltnerLower: keltner.lower[i],
        keltnerPosition: keltner.position[i],

        // 5. Donchian Channels - Breakout indicator
        donchianUpper: donchian.upper[i],
        donchianLower: donchian.lower[i],
        donchianPosition: donchian.position[i],

        // 6. Chaikin Money Flow - Volume-weighted
        cmf: cmfValues[i],

        // 7. VWAP - Volume weighted average price
        vwap: vwapData.vwap[i],
        vwapPosition: vwapData.position[i],

        // 8. Parabolic SAR - Trend reversal
        psar: psar.sar[i],
        psarTrend: psar.trend[i],

        // 9. Ichimoku Cloud - Tenkan and Kijun lines
        ichimokuTenkan: ichimokuData.tenkan[i],
        ichimokuKijun: ichimokuData.kijun[i],
        ichimokuSignal: ichimokuData.signal[i],

        // 10. Linear Regression - Trend slope
        linearRegSlope: linReg.slope[i],
        linearRegAngle: linReg.angle[i]
      });
    }

    return features;
  }
}

module.exports = EnhancedFeatures;
