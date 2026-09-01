import { Candle } from '../../types/deriv';

export interface IndicatorResult {
  ema9: number[];
  ema21: number[];
  ema50: number[];
  rsi14: number[];
  macd: {
    macdLine: number[];
    signalLine: number[];
    histogram: number[];
  };
  bollingerBands: {
    upper: number[];
    middle: number[];
    lower: number[];
  };
  superTrend: {
    trend: ('UP' | 'DOWN')[];
    superTrendLine: number[];
  };
  patterns: RecognizedPattern[];
  confluence: MarketConfluenceSignal;
}

export interface RecognizedPattern {
  name: string;
  type: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  reliability: 'HIGH' | 'MEDIUM' | 'LOW';
  candleIndex: number;
  description: string;
}

export type ConfluenceDirection = 'STRONG_RISE' | 'RISE' | 'NEUTRAL' | 'FALL' | 'STRONG_FALL';

export interface MarketConfluenceSignal {
  direction: ConfluenceDirection;
  tradeAction: 'RISE' | 'FALL' | 'WAIT';
  score: number; // -100 to +100
  confidence: number; // 0 to 100%
  reasons: string[];
  recommendedDuration: string;
  lastCalculated: number;
}

// -------------------------------------------------------------
// EMA Calculation
// -------------------------------------------------------------
export function calculateEMA(prices: number[], period: number): number[] {
  if (prices.length === 0) return [];
  const k = 2 / (period + 1);
  const emaArray: number[] = new Array(prices.length);

  // Initialize with SMA for first 'period' items
  let initialSum = 0;
  const initialCount = Math.min(period, prices.length);
  for (let i = 0; i < initialCount; i++) {
    initialSum += prices[i];
  }
  let currentEma = initialSum / initialCount;
  emaArray[initialCount - 1] = currentEma;

  for (let i = 0; i < initialCount - 1; i++) {
    emaArray[i] = prices[i];
  }

  for (let i = initialCount; i < prices.length; i++) {
    currentEma = prices[i] * k + currentEma * (1 - k);
    emaArray[i] = currentEma;
  }

  return emaArray;
}

// -------------------------------------------------------------
// RSI Calculation (Wilder's Smoothing)
// -------------------------------------------------------------
export function calculateRSI(prices: number[], period = 14): number[] {
  if (prices.length < 2) return new Array(prices.length).fill(50);
  const rsi: number[] = new Array(prices.length).fill(50);
  const gains: number[] = [];
  const losses: number[] = [];

  for (let i = 1; i < prices.length; i++) {
    const diff = prices[i] - prices[i - 1];
    gains.push(diff > 0 ? diff : 0);
    losses.push(diff < 0 ? Math.abs(diff) : 0);
  }

  if (gains.length < period) return rsi;

  let avgGain = gains.slice(0, period).reduce((a, b) => a + b, 0) / period;
  let avgLoss = losses.slice(0, period).reduce((a, b) => a + b, 0) / period;

  let rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
  rsi[period] = 100 - 100 / (1 + rs);

  for (let i = period + 1; i < prices.length; i++) {
    const gain = gains[i - 1];
    const loss = losses[i - 1];

    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;

    rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    rsi[i] = Number((100 - 100 / (1 + rs)).toFixed(2));
  }

  return rsi;
}

// -------------------------------------------------------------
// MACD (12, 26, 9)
// -------------------------------------------------------------
export function calculateMACD(
  prices: number[],
  fastPeriod = 12,
  slowPeriod = 26,
  signalPeriod = 9
) {
  const emaFast = calculateEMA(prices, fastPeriod);
  const emaSlow = calculateEMA(prices, slowPeriod);
  const macdLine: number[] = [];

  for (let i = 0; i < prices.length; i++) {
    macdLine.push(emaFast[i] - emaSlow[i]);
  }

  const signalLine = calculateEMA(macdLine, signalPeriod);
  const histogram: number[] = [];

  for (let i = 0; i < prices.length; i++) {
    histogram.push(macdLine[i] - signalLine[i]);
  }

  return { macdLine, signalLine, histogram };
}

// -------------------------------------------------------------
// Bollinger Bands (20, 2)
// -------------------------------------------------------------
export function calculateBollingerBands(prices: number[], period = 20, multiplier = 2) {
  const upper: number[] = [];
  const middle: number[] = [];
  const lower: number[] = [];

  for (let i = 0; i < prices.length; i++) {
    if (i < period - 1) {
      middle.push(prices[i]);
      upper.push(prices[i] * 1.01);
      lower.push(prices[i] * 0.99);
      continue;
    }

    const slice = prices.slice(i - period + 1, i + 1);
    const mean = slice.reduce((a, b) => a + b, 0) / period;
    const variance = slice.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / period;
    const stdDev = Math.sqrt(variance);

    middle.push(mean);
    upper.push(mean + multiplier * stdDev);
    lower.push(mean - multiplier * stdDev);
  }

  return { upper, middle, lower };
}

// -------------------------------------------------------------
// SuperTrend Indicator (ATR 10, Multiplier 3)
// -------------------------------------------------------------
export function calculateSuperTrend(candles: Candle[], period = 10, multiplier = 3) {
  const len = candles.length;
  if (len === 0) return { trend: [], superTrendLine: [] };

  const atr: number[] = [];
  const tr: number[] = [candles[0].high - candles[0].low];

  for (let i = 1; i < len; i++) {
    const high = candles[i].high;
    const low = candles[i].low;
    const prevClose = candles[i - 1].close;

    const trVal = Math.max(
      high - low,
      Math.abs(high - prevClose),
      Math.abs(low - prevClose)
    );
    tr.push(trVal);
  }

  // Smooth ATR
  let atrVal = tr.slice(0, Math.min(period, len)).reduce((a, b) => a + b, 0) / Math.min(period, len);
  atr.push(atrVal);

  for (let i = 1; i < len; i++) {
    atrVal = (atrVal * (period - 1) + tr[i]) / period;
    atr.push(atrVal);
  }

  const superTrendLine: number[] = new Array(len);
  const trend: ('UP' | 'DOWN')[] = new Array(len);

  let prevTrend: 'UP' | 'DOWN' = 'UP';
  let prevBand = candles[0].close;

  for (let i = 0; i < len; i++) {
    const hl2 = (candles[i].high + candles[i].low) / 2;
    const upperBand = hl2 + multiplier * atr[i];
    const lowerBand = hl2 - multiplier * atr[i];
    const close = candles[i].close;

    if (i === 0) {
      trend[0] = 'UP';
      superTrendLine[0] = lowerBand;
      continue;
    }

    if (prevTrend === 'UP') {
      if (close < lowerBand) {
        trend[i] = 'DOWN';
        superTrendLine[i] = upperBand;
      } else {
        trend[i] = 'UP';
        superTrendLine[i] = Math.max(lowerBand, prevBand);
      }
    } else {
      if (close > upperBand) {
        trend[i] = 'UP';
        superTrendLine[i] = lowerBand;
      } else {
        trend[i] = 'DOWN';
        superTrendLine[i] = Math.min(upperBand, prevBand);
      }
    }

    prevTrend = trend[i];
    prevBand = superTrendLine[i];
  }

  return { trend, superTrendLine };
}

// -------------------------------------------------------------
// Candlestick Pattern Recognition
// -------------------------------------------------------------
export function detectCandlePatterns(candles: Candle[]): RecognizedPattern[] {
  const patterns: RecognizedPattern[] = [];
  const len = candles.length;
  if (len < 3) return patterns;

  for (let i = 2; i < len; i++) {
    const c0 = candles[i - 2];
    const c1 = candles[i - 1];
    const c2 = candles[i];

    const body0 = Math.abs(c0.close - c0.open);
    const body1 = Math.abs(c1.close - c1.open);
    const body2 = Math.abs(c2.close - c2.open);

    const isGreen2 = c2.close > c2.open;
    const isRed2 = c2.close < c2.open;
    const isGreen1 = c1.close > c1.open;
    const isRed1 = c1.close < c1.open;

    const lowerWick2 = isGreen2 ? c2.open - c2.low : c2.close - c2.low;
    const upperWick2 = isGreen2 ? c2.high - c2.close : c2.high - c2.open;

    // 1. Bullish Engulfing
    if (isRed1 && isGreen2 && c2.open <= c1.close && c2.close >= c1.open && body2 > body1 * 1.1) {
      patterns.push({
        name: 'Bullish Engulfing',
        type: 'BULLISH',
        reliability: 'HIGH',
        candleIndex: i,
        description: 'Green candle completely engulfed previous red candle body (Strong Rise)',
      });
    }

    // 2. Bearish Engulfing
    if (isGreen1 && isRed2 && c2.open >= c1.close && c2.close <= c1.open && body2 > body1 * 1.1) {
      patterns.push({
        name: 'Bearish Engulfing',
        type: 'BEARISH',
        reliability: 'HIGH',
        candleIndex: i,
        description: 'Red candle completely engulfed previous green candle body (Strong Fall)',
      });
    }

    // 3. Hammer (Bullish Pin Bar)
    if (lowerWick2 >= body2 * 2 && upperWick2 <= body2 * 0.4 && body2 > 0) {
      patterns.push({
        name: 'Hammer / Pin Bar',
        type: 'BULLISH',
        reliability: 'HIGH',
        candleIndex: i,
        description: 'Long lower shadow rejection indicating buyers rejecting lower prices (Rise)',
      });
    }

    // 4. Shooting Star (Bearish Inverted Pin Bar)
    if (upperWick2 >= body2 * 2 && lowerWick2 <= body2 * 0.4 && body2 > 0) {
      patterns.push({
        name: 'Shooting Star',
        type: 'BEARISH',
        reliability: 'HIGH',
        candleIndex: i,
        description: 'Long upper shadow rejection indicating sellers rejecting higher prices (Fall)',
      });
    }

    // 5. Morning Star (3 candle Bullish reversal)
    if (c0.close < c0.open && body1 < body0 * 0.5 && isGreen2 && c2.close > (c0.open + c0.close) / 2) {
      patterns.push({
        name: 'Morning Star',
        type: 'BULLISH',
        reliability: 'HIGH',
        candleIndex: i,
        description: '3-candle bottom reversal pattern indicating bullish trend continuation',
      });
    }

    // 6. Evening Star (3 candle Bearish reversal)
    if (c0.close > c0.open && body1 < body0 * 0.5 && isRed2 && c2.close < (c0.open + c0.close) / 2) {
      patterns.push({
        name: 'Evening Star',
        type: 'BEARISH',
        reliability: 'HIGH',
        candleIndex: i,
        description: '3-candle top reversal pattern indicating bearish drop continuation',
      });
    }
  }

  return patterns;
}

// -------------------------------------------------------------
// Multi-Indicator Confluence Evaluation Engine
// -------------------------------------------------------------
export function evaluateConfluence(candles: Candle[]): IndicatorResult {
  const closes = candles.map((c) => c.close);
  const ema9 = calculateEMA(closes, 9);
  const ema21 = calculateEMA(closes, 21);
  const ema50 = calculateEMA(closes, 50);
  const rsi14 = calculateRSI(closes, 14);
  const macd = calculateMACD(closes, 12, 26, 9);
  const bollingerBands = calculateBollingerBands(closes, 20, 2);
  const superTrend = calculateSuperTrend(candles, 10, 3);
  const patterns = detectCandlePatterns(candles);

  const len = candles.length;
  if (len < 5) {
    return {
      ema9,
      ema21,
      ema50,
      rsi14,
      macd,
      bollingerBands,
      superTrend,
      patterns,
      confluence: {
        direction: 'NEUTRAL',
        tradeAction: 'WAIT',
        score: 0,
        confidence: 50,
        reasons: ['Gathering market tick and candle data...'],
        recommendedDuration: '1m',
        lastCalculated: Date.now(),
      },
    };
  }

  const lastIdx = len - 1;
  const currentClose = closes[lastIdx];
  const lastEma9 = ema9[lastIdx];
  const lastEma21 = ema21[lastIdx];
  const lastEma50 = ema50[lastIdx];
  const lastRsi = rsi14[lastIdx];
  const lastMacdHist = macd.histogram[lastIdx];
  const prevMacdHist = macd.histogram[lastIdx - 1] || 0;
  const lastMacdLine = macd.macdLine[lastIdx];
  const lastMacdSignal = macd.signalLine[lastIdx];
  const lastBbUpper = bollingerBands.upper[lastIdx];
  const lastBbLower = bollingerBands.lower[lastIdx];
  const lastSuperTrend = superTrend.trend[lastIdx];

  let score = 0; // -100 to +100
  const reasons: string[] = [];

  // 1. EMA Ribbon Trend Alignment (up to +25 / -25)
  if (lastEma9 > lastEma21 && lastEma21 > lastEma50) {
    score += 25;
    reasons.push('EMA Ribbon Bullish Stack (EMA 9 > 21 > 50)');
  } else if (lastEma9 < lastEma21 && lastEma21 < lastEma50) {
    score -= 25;
    reasons.push('EMA Ribbon Bearish Stack (EMA 9 < 21 < 50)');
  } else if (lastEma9 > lastEma21) {
    score += 12;
    reasons.push('Short-term EMA 9 > 21 Golden Cross');
  } else if (lastEma9 < lastEma21) {
    score -= 12;
    reasons.push('Short-term EMA 9 < 21 Death Cross');
  }

  // 2. RSI Momentum & Overbought/Oversold Reversals (up to +25 / -25)
  if (lastRsi < 30) {
    score += 25;
    reasons.push(`RSI Oversold (${lastRsi.toFixed(1)}) → High Probability Bullish Reversal`);
  } else if (lastRsi > 70) {
    score -= 25;
    reasons.push(`RSI Overbought (${lastRsi.toFixed(1)}) → High Probability Bearish Reversal`);
  } else if (lastRsi > 52 && lastRsi <= 68) {
    score += 15;
    reasons.push(`RSI Bullish Momentum (${lastRsi.toFixed(1)})`);
  } else if (lastRsi < 48 && lastRsi >= 32) {
    score -= 15;
    reasons.push(`RSI Bearish Momentum (${lastRsi.toFixed(1)})`);
  }

  // 3. MACD Cross & Histogram Acceleration (up to +20 / -20)
  if (lastMacdLine > lastMacdSignal && lastMacdHist > 0 && lastMacdHist > prevMacdHist) {
    score += 20;
    reasons.push('MACD Bullish Expansion & Expanding Green Histogram');
  } else if (lastMacdLine < lastMacdSignal && lastMacdHist < 0 && lastMacdHist < prevMacdHist) {
    score -= 20;
    reasons.push('MACD Bearish Acceleration & Expanding Red Histogram');
  } else if (lastMacdLine > lastMacdSignal) {
    score += 10;
    reasons.push('MACD above Signal line');
  } else if (lastMacdLine < lastMacdSignal) {
    score -= 10;
    reasons.push('MACD below Signal line');
  }

  // 4. Bollinger Bands Touch & Mean Reversion (up to +15 / -15)
  if (currentClose <= lastBbLower) {
    score += 15;
    reasons.push('Price touching Lower Bollinger Band (Oversold Bounce Zone)');
  } else if (currentClose >= lastBbUpper) {
    score -= 15;
    reasons.push('Price touching Upper Bollinger Band (Overbought Rejection Zone)');
  }

  // 5. SuperTrend Trend Filter (+15 / -15)
  if (lastSuperTrend === 'UP') {
    score += 15;
    reasons.push('SuperTrend indicates Active Green Uptrend');
  } else if (lastSuperTrend === 'DOWN') {
    score -= 15;
    reasons.push('SuperTrend indicates Active Red Downtrend');
  }

  // 6. Recent Candlestick Patterns (+20 / -20)
  const recentPatterns = patterns.filter((p) => p.candleIndex >= lastIdx - 2);
  if (recentPatterns.length > 0) {
    const latest = recentPatterns[recentPatterns.length - 1];
    if (latest.type === 'BULLISH') {
      score += 20;
      reasons.push(`Pattern: ${latest.name} (${latest.description})`);
    } else if (latest.type === 'BEARISH') {
      score -= 20;
      reasons.push(`Pattern: ${latest.name} (${latest.description})`);
    }
  }

  // Bound score between -100 and +100
  score = Math.max(-100, Math.min(100, score));

  // Determine categorical direction and confidence
  let direction: ConfluenceDirection = 'NEUTRAL';
  let tradeAction: 'RISE' | 'FALL' | 'WAIT' = 'WAIT';
  let confidence = 50;

  if (score >= 50) {
    direction = 'STRONG_RISE';
    tradeAction = 'RISE';
    confidence = Math.min(98, 50 + Math.round(score * 0.48));
  } else if (score >= 20) {
    direction = 'RISE';
    tradeAction = 'RISE';
    confidence = Math.min(85, 50 + Math.round(score * 0.45));
  } else if (score <= -50) {
    direction = 'STRONG_FALL';
    tradeAction = 'FALL';
    confidence = Math.min(98, 50 + Math.round(Math.abs(score) * 0.48));
  } else if (score <= -20) {
    direction = 'FALL';
    tradeAction = 'FALL';
    confidence = Math.min(85, 50 + Math.round(Math.abs(score) * 0.45));
  } else {
    direction = 'NEUTRAL';
    tradeAction = 'WAIT';
    confidence = 50;
  }

  return {
    ema9,
    ema21,
    ema50,
    rsi14,
    macd,
    bollingerBands,
    superTrend,
    patterns,
    confluence: {
      direction,
      tradeAction,
      score,
      confidence,
      reasons: reasons.slice(0, 4),
      recommendedDuration: '1m',
      lastCalculated: Date.now(),
    },
  };
}
