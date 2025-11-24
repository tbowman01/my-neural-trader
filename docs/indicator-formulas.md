# Technical Indicator Formulas Reference

Quick reference for all 24 technical indicators implemented in enhanced-features.js

## Trend Indicators

### Simple Moving Average (SMA)
```
SMA(n) = (P1 + P2 + ... + Pn) / n
```

### Exponential Moving Average (EMA)
```
Multiplier = 2 / (period + 1)
EMA = (Close - Previous EMA) × Multiplier + Previous EMA
```

### ADX (Average Directional Index)
```
+DM = Current High - Previous High (if > 0 and > -DM)
-DM = Previous Low - Current Low (if > 0 and > +DM)
True Range = max(High - Low, |High - Previous Close|, |Low - Previous Close|)
+DI = (Smoothed +DM / Smoothed TR) × 100
-DI = (Smoothed -DM / Smoothed TR) × 100
DX = (|+DI - -DI| / (+DI + -DI)) × 100
ADX = EMA(DX, period)
```

### Parabolic SAR
```
SAR(today) = SAR(yesterday) + AF × (EP - SAR(yesterday))
Where:
- AF = Acceleration Factor (starts at 0.02, max 0.2)
- EP = Extreme Point (highest high or lowest low in trend)
```

### Ichimoku Cloud (Simplified)
```
Tenkan-sen = (Highest High + Lowest Low) / 2 over 9 periods
Kijun-sen = (Highest High + Lowest Low) / 2 over 26 periods
Signal = Tenkan-sen - Kijun-sen (TK Cross)
```

### Linear Regression Slope
```
Slope = (n×ΣXY - ΣX×ΣY) / (n×ΣX² - (ΣX)²)
Normalized Slope = (Slope / Average Price) × 100
Angle = arctan(Slope) × (180 / π)
```

## Momentum Indicators

### RSI (Relative Strength Index)
```
RS = Average Gain / Average Loss (EMA over period)
RSI = 100 - (100 / (1 + RS))
```

### MACD (Moving Average Convergence Divergence)
```
MACD Line = EMA(12) - EMA(26)
Signal Line = EMA(MACD Line, 9)
Histogram = MACD Line - Signal Line
```

### Stochastic Oscillator
```
%K = ((Close - Lowest Low) / (Highest High - Lowest Low)) × 100
%D = SMA(%K, 3)
```

### Rate of Change (ROC)
```
ROC = ((Current Close - Close n periods ago) / Close n periods ago) × 100
```

### Williams %R
```
Williams %R = ((Highest High - Close) / (Highest High - Lowest Low)) × -100
```

### CCI (Commodity Channel Index)
```
Typical Price = (High + Low + Close) / 3
Mean Deviation = Average(|TP - SMA(TP)|)
CCI = (TP - SMA(TP)) / (0.015 × Mean Deviation)
```

### Ultimate Oscillator
```
BP = Close - min(Low, Previous Close)
TR = max(High, Previous Close) - min(Low, Previous Close)
Average7 = Sum(BP, 7) / Sum(TR, 7)
Average14 = Sum(BP, 14) / Sum(TR, 14)
Average28 = Sum(BP, 28) / Sum(TR, 28)
UO = 100 × ((4 × Average7) + (2 × Average14) + Average28) / 7
```

## Volatility Indicators

### Average True Range (ATR)
```
True Range = max(High - Low, |High - Previous Close|, |Low - Previous Close|)
ATR = EMA(True Range, period)
```

### Bollinger Bands
```
Middle Band = SMA(Close, 20)
Upper Band = Middle Band + (2 × Standard Deviation)
Lower Band = Middle Band - (2 × Standard Deviation)
Position = (Close - Lower Band) / (Upper Band - Lower Band)
```

### Keltner Channels
```
Typical Price = (High + Low + Close) / 3
Middle Line = EMA(Typical Price, 20)
Upper Band = Middle Line + (2 × ATR(20))
Lower Band = Middle Line - (2 × ATR(20))
Position = (Close - Lower Band) / (Upper Band - Lower Band)
```

### Donchian Channels
```
Upper Band = Highest High over n periods
Lower Band = Lowest Low over n periods
Position = (Close - Lower Band) / (Upper Band - Lower Band)
```

## Volume Indicators

### On Balance Volume (OBV)
```
If Close > Previous Close: OBV = Previous OBV + Volume
If Close < Previous Close: OBV = Previous OBV - Volume
If Close = Previous Close: OBV = Previous OBV
```

### Money Flow Index (MFI)
```
Typical Price = (High + Low + Close) / 3
Money Flow = Typical Price × Volume
Positive Flow = Sum of Money Flow when TP increases
Negative Flow = Sum of Money Flow when TP decreases
Money Flow Ratio = Positive Flow / Negative Flow
MFI = 100 - (100 / (1 + Money Flow Ratio))
```

### Chaikin Money Flow (CMF)
```
Money Flow Multiplier = ((Close - Low) - (High - Close)) / (High - Low)
Money Flow Volume = Money Flow Multiplier × Volume
CMF = Sum(Money Flow Volume, n) / Sum(Volume, n)
```

### VWAP (Volume Weighted Average Price)
```
Typical Price = (High + Low + Close) / 3
VWAP = Cumulative(TP × Volume) / Cumulative(Volume)
Position = (Close / VWAP) - 1
```

## Interpretation Guide

### Trend Strength
- **ADX > 25**: Strong trend
- **ADX < 20**: Weak trend or ranging market
- **Linear Reg Slope**: Positive = uptrend, Negative = downtrend

### Overbought/Oversold
- **RSI > 70**: Overbought; **RSI < 30**: Oversold
- **CCI > +100**: Overbought; **CCI < -100**: Oversold
- **Stochastic > 80**: Overbought; **Stochastic < 20**: Oversold
- **Williams %R > -20**: Overbought; **Williams %R < -80**: Oversold
- **MFI > 80**: Overbought; **MFI < 20**: Oversold

### Trend Reversals
- **MACD Histogram**: Zero crossing indicates potential reversal
- **Parabolic SAR**: Price crossing SAR indicates reversal
- **Ichimoku TK Cross**: Tenkan crossing Kijun indicates trend change

### Volume Confirmation
- **CMF > 0**: Buying pressure; **CMF < 0**: Selling pressure
- **OBV rising** with price = healthy uptrend
- **Price above VWAP**: Bullish; **below VWAP**: Bearish

### Volatility Breakouts
- **Bollinger Band Squeeze**: Low volatility, potential breakout
- **Keltner Channel**: Similar to Bollinger but uses ATR
- **Donchian Channel**: Break above upper = bullish, below lower = bearish

### Multi-Timeframe Analysis
- **Ultimate Oscillator**: Combines 7, 14, 28 periods for comprehensive momentum view

## Parameter Optimization

Standard parameters used (industry defaults):
- **Short-term**: 5-14 periods (RSI, ATR, ADX)
- **Medium-term**: 20-26 periods (Bollinger, CCI, Ichimoku Kijun)
- **Long-term**: 50-200 periods (Moving averages)

These can be adjusted based on:
- Asset volatility
- Trading timeframe (intraday vs swing)
- Market conditions (trending vs ranging)
- Backtesting results

## Usage in Neural Network

### Feature Normalization
- Bounded indicators (RSI, Stochastic, MFI): Already 0-100 scale
- Unbounded indicators (CCI, MACD): May need normalization or clipping
- Position indicators: Already 0-1 scale (Bollinger, Keltner, Donchian positions)
- Trend indicators: Use as-is or normalize (ADX, Parabolic SAR trend)

### Feature Engineering Ideas
1. **Rate of change** of indicators (e.g., RSI slope)
2. **Divergences** between price and indicators
3. **Cross-indicator signals** (e.g., RSI + CCI agreement)
4. **Volatility regime** classification (high/low ATR)
5. **Trend regime** classification (strong/weak ADX)
