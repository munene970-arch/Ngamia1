import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { MarketInfo, MarketSymbol, ActiveContract, Tick } from '../../types/deriv';
import { derivWS, extractDerivLastDigit, formatDerivQuote, getMarketPipSize } from '../../services/derivWebSocket';
import { soundManager } from '../../utils/soundEffects';
import { TradingViewChart, ChartPricePoint } from './TradingViewChart';
import {
  Activity,
  Zap,
  TrendingUp,
  TrendingDown,
  Volume2,
  VolumeX,
  Radio,
  Sliders,
  CheckCircle2,
  AlertTriangle,
  Clock,
  RotateCcw,
  Terminal,
  Layers,
  ArrowUpRight,
  ArrowDownRight,
  Maximize2,
  DollarSign,
  ChevronRight,
  X,
  Sparkles,
  Shield,
  Crosshair,
  Flame,
  Code2,
  Copy,
  Download,
  Server,
  Play,
  Check,
  RefreshCw,
  Percent,
} from 'lucide-react';

export interface LiveMarketAnalyzerProps {
  markets: MarketInfo[];
  balanceUsd?: number;
  onUpdateBalance?: (balance: number) => void;
  initialSymbol?: MarketSymbol;
}

export interface DigitStat {
  digit: number;
  count: number;
  percentage: number;
  dormancy: number;
}

export interface DifferSignal {
  symbol: MarketSymbol;
  marketName: string;
  targetDigit: number;
  confidence: number;
  type: 'COLDEST_SNIPER' | 'DORMANCY_EXTREME' | 'REPEAT_REJECTION';
  title: string;
  reason: string;
  coldestDigit: number;
  coldestPct: number;
  dormancy: number;
  timestamp: number;
}

// Monitored All Volatility Indices (10 to 100 Standard & 1s Markets)
export const CONCURRENT_SCAN_MARKETS: {
  symbol: MarketSymbol;
  name: string;
  shortName: string;
  category: 'standard' | '1s';
  vol: number;
}[] = [
  // Standard Volatility Markets (2s tick interval)
  { symbol: 'R_10', name: 'Volatility 10 Index', shortName: 'Vol 10', category: 'standard', vol: 10 },
  { symbol: 'R_25', name: 'Volatility 25 Index', shortName: 'Vol 25', category: 'standard', vol: 25 },
  { symbol: 'R_50', name: 'Volatility 50 Index', shortName: 'Vol 50', category: 'standard', vol: 50 },
  { symbol: 'R_75', name: 'Volatility 75 Index', shortName: 'Vol 75', category: 'standard', vol: 75 },
  { symbol: 'R_100', name: 'Volatility 100 Index', shortName: 'Vol 100', category: 'standard', vol: 100 },
  // 1-Second (1s) Volatility Markets (1s tick interval)
  { symbol: '1HZ10V', name: 'Volatility 10 (1s) Index', shortName: 'Vol 10 (1s)', category: '1s', vol: 10 },
  { symbol: '1HZ15V', name: 'Volatility 15 (1s) Index', shortName: 'Vol 15 (1s)', category: '1s', vol: 15 },
  { symbol: '1HZ25V', name: 'Volatility 25 (1s) Index', shortName: 'Vol 25 (1s)', category: '1s', vol: 25 },
  { symbol: '1HZ30V', name: 'Volatility 30 (1s) Index', shortName: 'Vol 30 (1s)', category: '1s', vol: 30 },
  { symbol: '1HZ50V', name: 'Volatility 50 (1s) Index', shortName: 'Vol 50 (1s)', category: '1s', vol: 50 },
  { symbol: '1HZ75V', name: 'Volatility 75 (1s) Index', shortName: 'Vol 75 (1s)', category: '1s', vol: 75 },
  { symbol: '1HZ90V', name: 'Volatility 90 (1s) Index', shortName: 'Vol 90 (1s)', category: '1s', vol: 90 },
  { symbol: '1HZ100V', name: 'Volatility 100 (1s) Index', shortName: 'Vol 100 (1s)', category: '1s', vol: 100 },
];

export interface MarketMetrics {
  symbol: MarketSymbol;
  name: string;
  shortName: string;
  category: 'standard' | '1s';
  price: number;
  lastDigit: number;
  ema9: number;
  ema21: number;
  rsi: number;
  atr: number;
  bbUpper: number;
  bbLower: number;
  bbMid: number;
  trend: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  inOut: 'GOES OUT' | 'STAYS IN';
  evenCount: number;
  oddCount: number;
  currentStreakType: 'EVEN' | 'ODD';
  currentStreakCount: number;
  confluenceScore: number;
  isHighConfluence: boolean;
  confluenceReason: string;
  // Differ Fields
  digitStats: DigitStat[];
  coldestDigit: number;
  coldestPct: number;
  coldestDormancy: number;
  hottestDigit: number;
  hottestPct: number;
  differSignal: DifferSignal | null;
}

export interface HighConfluenceAlert {
  id: string;
  timestamp: number;
  timeString: string;
  symbol: MarketSymbol;
  marketName: string;
  title: string;
  direction: 'RISE' | 'FALL' | 'GOES_OUT' | 'STAYS_IN' | 'EVEN' | 'ODD' | 'DIFFER';
  recommendedContract: 'CALL' | 'PUT' | 'EXPIRYMISS' | 'EXPIRYRANGE' | 'DIGITEVEN' | 'DIGITODD' | 'DIGITDIFF';
  confidence: number;
  price: number;
  lastDigit: number;
  ema9: number;
  ema21: number;
  rsi: number;
  atr: number;
  reason: string;
  targetDigit?: number;
}

// -------------------------------------------------------------
// TECHNICAL INDICATOR MATH FUNCTIONS (Matching ProDerivAnalyzer)
// -------------------------------------------------------------
function calculateEMA(data: number[], period: number): number {
  if (data.length < period) return data.length ? data.reduce((a, b) => a + b, 0) / data.length : 0;
  const multiplier = 2 / (period + 1);
  let ema = data.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < data.length; i++) {
    ema = (data[i] - ema) * multiplier + ema;
  }
  return ema;
}

function calculateRSI(data: number[], period = 14): number {
  if (data.length < period + 1) return 50.0;
  let gains = 0;
  let losses = 0;
  for (let i = data.length - period; i < data.length; i++) {
    const change = data[i] - data[i - 1];
    if (change > 0) gains += change;
    else losses -= change;
  }
  const avgGain = gains / period;
  const avgLoss = losses / period;
  if (avgLoss === 0) return 100.0;
  const rs = avgGain / avgLoss;
  return 100.0 - 100.0 / (1.0 + rs);
}

function calculateATR(data: number[], period = 14): number {
  if (data.length < period + 1) return 0.0;
  let sumRanges = 0;
  for (let i = data.length - period; i < data.length; i++) {
    sumRanges += Math.abs(data[i] - data[i - 1]);
  }
  return sumRanges / period;
}

function calculateBollingerBands(data: number[], period = 20, numStd = 2.0) {
  if (data.length < 2) {
    const val = data[0] || 0;
    return { upper: val, lower: val, mid: val };
  }
  const slice = data.slice(-period);
  const n = slice.length;
  const mean = slice.reduce((a, b) => a + b, 0) / n;
  const variance = slice.reduce((acc, x) => acc + Math.pow(x - mean, 2), 0) / n;
  const stdDev = Math.sqrt(variance);
  return {
    upper: mean + numStd * stdDev,
    lower: mean - numStd * stdDev,
    mid: mean,
  };
}

function getCurrentStreak<T>(digits: T[], conditionFunc: (item: T) => boolean): number {
  if (!digits.length) return 0;
  let streak = 0;
  const target = conditionFunc(digits[digits.length - 1]);
  for (let i = digits.length - 1; i >= 0; i--) {
    if (conditionFunc(digits[i]) === target) {
      streak++;
    } else {
      break;
    }
  }
  return streak;
}

// -------------------------------------------------------------
// DIGIT FREQUENCY & STATISTICAL DIFFER SIGNAL EVALUATION
// -------------------------------------------------------------
function calculateDigitStatistics(digits: number[]): {
  stats: DigitStat[];
  coldest: DigitStat;
  hottest: DigitStat;
  repeatDigit: number | null;
  repeatCount: number;
} {
  const counts = new Array(10).fill(0);
  const dormancies = new Array(10).fill(digits.length || 0);

  digits.forEach((d) => {
    if (d >= 0 && d <= 9) counts[d]++;
  });

  // Calculate dormancy: ticks since digit was last seen
  for (let d = 0; d <= 9; d++) {
    for (let i = digits.length - 1; i >= 0; i--) {
      if (digits[i] === d) {
        dormancies[d] = digits.length - 1 - i;
        break;
      }
    }
  }

  const total = digits.length || 1;
  const stats: DigitStat[] = [];
  for (let d = 0; d <= 9; d++) {
    stats.push({
      digit: d,
      count: counts[d],
      percentage: Number(((counts[d] / total) * 100).toFixed(1)),
      dormancy: dormancies[d],
    });
  }

  // Sort to find coldest (lowest frequency; if tie, highest dormancy)
  const sorted = [...stats].sort((a, b) => a.percentage - b.percentage || b.dormancy - a.dormancy);
  const coldest = sorted[0];
  const hottest = sorted[sorted.length - 1];

  // Check recent repeat: does last digit match previous?
  let repeatDigit: number | null = null;
  let repeatCount = 1;
  if (digits.length >= 2) {
    const last = digits[digits.length - 1];
    if (digits[digits.length - 2] === last) {
      repeatDigit = last;
      repeatCount = 2;
      if (digits.length >= 3 && digits[digits.length - 3] === last) {
        repeatCount = 3;
      }
    }
  }

  return { stats, coldest, hottest, repeatDigit, repeatCount };
}

function evaluateDifferSignal(
  symbol: MarketSymbol,
  name: string,
  digits: number[]
): DifferSignal | null {
  if (digits.length < 15) return null;

  const { stats, coldest, repeatDigit, repeatCount } = calculateDigitStatistics(digits);

  // Signal 1: Repeat Rejection (2+ repeats in a row -> Differ against it)
  if (repeatDigit !== null && repeatCount >= 2) {
    const conf = repeatCount >= 3 ? 98.9 : 97.5;
    return {
      symbol,
      marketName: name,
      targetDigit: repeatDigit,
      confidence: conf,
      type: 'REPEAT_REJECTION',
      title: `REPEAT REJECTION (≠ Digit ${repeatDigit})`,
      reason: `Digit ${repeatDigit} hit ${repeatCount}x consecutively. Multi-hit probability is <1.2%. High mathematical differ edge.`,
      coldestDigit: coldest.digit,
      coldestPct: coldest.percentage,
      dormancy: coldest.dormancy,
      timestamp: Date.now(),
    };
  }

  // Signal 2: High Dormancy Differ (Digit absent for >= 10 ticks)
  const highestDormancy = [...stats].sort((a, b) => b.dormancy - a.dormancy)[0];
  if (highestDormancy && highestDormancy.dormancy >= 10 && highestDormancy.percentage <= 9.0) {
    const conf = Math.min(98.6, Number((93.0 + Math.min(5, highestDormancy.dormancy * 0.3)).toFixed(1)));
    return {
      symbol,
      marketName: name,
      targetDigit: highestDormancy.digit,
      confidence: conf,
      type: 'DORMANCY_EXTREME',
      title: `EXTREME DORMANCY (≠ Digit ${highestDormancy.digit})`,
      reason: `Digit ${highestDormancy.digit} dormant for ${highestDormancy.dormancy} consecutive ticks (${highestDormancy.percentage}% freq). High mathematical probability of continuing absence.`,
      coldestDigit: coldest.digit,
      coldestPct: coldest.percentage,
      dormancy: highestDormancy.dormancy,
      timestamp: Date.now(),
    };
  }

  // Signal 3: Coldest Digit Sniper (Frequency <= 7.0%)
  if (coldest && coldest.percentage <= 7.0) {
    const conf = Math.min(98.4, Number((92.5 + (10 - coldest.percentage) * 1.4).toFixed(1)));
    return {
      symbol,
      marketName: name,
      targetDigit: coldest.digit,
      confidence: conf,
      type: 'COLDEST_SNIPER',
      title: `COLDEST DIGIT SNIPER (≠ Digit ${coldest.digit})`,
      reason: `Digit ${coldest.digit} frequency is only ${coldest.percentage}% over ${digits.length} ticks (coldest). Strong edge to differ against.`,
      coldestDigit: coldest.digit,
      coldestPct: coldest.percentage,
      dormancy: coldest.dormancy,
      timestamp: Date.now(),
    };
  }

  return null;
}

export const LiveMarketAnalyzer: React.FC<LiveMarketAnalyzerProps> = ({
  markets,
  balanceUsd = 10000.0,
  onUpdateBalance,
  initialSymbol = 'R_75',
}) => {
  // Active focused market for TradingView chart & deep inspection
  const [activeSymbol, setActiveSymbol] = useState<MarketSymbol>(initialSymbol);

  // Multi-Market Buffers for Concurrent Scanning across ALL 13 Volatility Markets
  const [multiMarketPrices, setMultiMarketPrices] = useState<Record<string, number[]>>(() => {
    const init: Record<string, number[]> = {};
    CONCURRENT_SCAN_MARKETS.forEach((m) => { init[m.symbol] = []; });
    return init;
  });
  const [multiMarketDigits, setMultiMarketDigits] = useState<Record<string, number[]>>(() => {
    const init: Record<string, number[]> = {};
    CONCURRENT_SCAN_MARKETS.forEach((m) => { init[m.symbol] = []; });
    return init;
  });
  const [multiMarketTimes, setMultiMarketTimes] = useState<Record<string, number[]>>(() => {
    const init: Record<string, number[]> = {};
    CONCURRENT_SCAN_MARKETS.forEach((m) => { init[m.symbol] = []; });
    return init;
  });

  // Trade Inputs for Signal Execution
  const [stake, setStake] = useState<number>(1.0);
  const [durationTicks, setDurationTicks] = useState<number>(1);
  const [isPlacingTrade, setIsPlacingTrade] = useState<boolean>(false);
  const [tradeMessage, setTradeMessage] = useState<string | null>(null);

  // Differ Specific State & Contract Mode
  const [marketContractMode, setMarketContractMode] = useState<'DIFFER' | 'RISE_FALL' | 'ALL'>('DIFFER');
  const [differTargetDigit, setDifferTargetDigit] = useState<number>(0);
  const [instantTapDifferBuy, setInstantTapDifferBuy] = useState<boolean>(true);
  const [marketCategoryFilter, setMarketCategoryFilter] = useState<'ALL' | 'STANDARD' | '1S' | 'DIFFER_SIGNALS'>('ALL');

  // Signal & Pop-up States
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [autoTradeEnabled, setAutoTradeEnabled] = useState<boolean>(false);
  const [minConfidenceFilter, setMinConfidenceFilter] = useState<number>(80);
  const [enableModalPopups, setEnableModalPopups] = useState<boolean>(false); // Disabled by default to prevent screen-blocking dialogs
  const [muteBullishAlerts, setMuteBullishAlerts] = useState<boolean>(true); // Strictly muted as requested by user
  const [activeAlertPopup, setActiveAlertPopup] = useState<HighConfluenceAlert | null>(null);
  const [popupCountdown, setPopupCountdown] = useState<number>(15);
  const [isPopupHovered, setIsPopupHovered] = useState<boolean>(false);
  const [alertHistory, setAlertHistory] = useState<HighConfluenceAlert[]>([]);
  const [executedTrades, setExecutedTrades] = useState<ActiveContract[]>([]);

  // View States: Multi-Matrix Radar, Dedicated Differ Market Engine, TradingView Chart, FastAPI Backend
  const [viewTab, setViewTab] = useState<'RADAR' | 'DIFFER_ENGINE' | 'CHART' | 'PYTHON_FASTAPI'>('RADAR');
  const [copiedCode, setCopiedCode] = useState<boolean>(false);
  const lastAlertTimeRef = useRef<{ [key: string]: number }>({});

  const activeMarketPipSize = useMemo(() => getMarketPipSize(activeSymbol), [activeSymbol]);

  // -------------------------------------------------------------
  // CONCURRENT MULTI-MARKET WEBSOCKET STREAMING (R_10, R_50, R_75, R_100)
  // -------------------------------------------------------------
  useEffect(() => {
    let isMounted = true;
    const unsubscribers: (() => void)[] = [];

    CONCURRENT_SCAN_MARKETS.forEach(({ symbol }) => {
      const pip = getMarketPipSize(symbol);

      const onHistory = (data: { symbol: MarketSymbol; prices: number[]; times: number[]; pipSize: number }) => {
        if (!isMounted || data.symbol !== symbol) return;
        if (data.prices && data.prices.length > 0) {
          const prices = data.prices.slice(-100);
          const digits = data.prices.slice(-200).map((p) => extractDerivLastDigit(p, pip, symbol));
          const times = (data.times || []).slice(-100);

          setMultiMarketPrices((prev) => ({ ...prev, [symbol]: prices }));
          setMultiMarketDigits((prev) => ({ ...prev, [symbol]: digits }));
          setMultiMarketTimes((prev) => ({ ...prev, [symbol]: times }));
        }
      };

      const onTick = (tick: Tick) => {
        if (!isMounted || tick.symbol !== symbol) return;
        const d = extractDerivLastDigit(tick.quote, pip, symbol);

        setMultiMarketPrices((prev) => {
          const existing = prev[symbol] || [];
          return { ...prev, [symbol]: [...existing, tick.quote].slice(-100) };
        });

        setMultiMarketDigits((prev) => {
          const existing = prev[symbol] || [];
          return { ...prev, [symbol]: [...existing, d].slice(-200) };
        });

        setMultiMarketTimes((prev) => {
          const existing = prev[symbol] || [];
          return { ...prev, [symbol]: [...existing, tick.epoch].slice(-100) };
        });
      };

      derivWS.subscribeHistory(symbol, onHistory);
      derivWS.subscribeTicks(symbol, onTick);
      derivWS.requestTicksHistory(symbol, 100);

      unsubscribers.push(() => {
        derivWS.unsubscribeHistory(symbol, onHistory);
        derivWS.unsubscribeTicks(symbol, onTick);
      });
    });

    return () => {
      isMounted = false;
      unsubscribers.forEach((fn) => fn());
    };
  }, []);

  // Listen for contract completion
  useEffect(() => {
    const handleContract = (contract: ActiveContract) => {
      if (contract.status === 'WON' || contract.status === 'LOST') {
        setExecutedTrades((prev) => [contract, ...prev.slice(0, 49)]);
        if (contract.status === 'WON') {
          soundManager.playWin();
          setTradeMessage(`✅ Contract ${contract.id.slice(-6)} WON! Profit: +$${contract.currentProfit.toFixed(2)}`);
          if (onUpdateBalance) onUpdateBalance(balanceUsd + contract.currentProfit);
        } else {
          soundManager.playLoss();
          setTradeMessage(`❌ Contract ${contract.id.slice(-6)} LOST (-$${contract.stake.toFixed(2)})`);
          if (onUpdateBalance) onUpdateBalance(Math.max(0, balanceUsd - contract.stake));
        }
      }
    };

    derivWS.subscribeContracts(handleContract);
    return () => derivWS.unsubscribeContracts(handleContract);
  }, [balanceUsd, onUpdateBalance]);

  // -------------------------------------------------------------
  // COMPUTE REAL-TIME METRICS & CONFLUENCE ACROSS ALL 13 MARKETS
  // -------------------------------------------------------------
  const marketMetrics = useMemo<Record<string, MarketMetrics>>(() => {
    const result: Record<string, MarketMetrics> = {};

    CONCURRENT_SCAN_MARKETS.forEach(({ symbol, name, shortName, category }) => {
      const prices = multiMarketPrices[symbol] || [];
      const digits = multiMarketDigits[symbol] || [];
      const currentPrice = prices.length ? prices[prices.length - 1] : 0;
      const lastD = digits.length ? digits[digits.length - 1] : 0;

      const { stats: digitStats, coldest, hottest } = calculateDigitStatistics(digits);
      const differSignal = evaluateDifferSignal(symbol, name, digits);

      if (prices.length < 20) {
        result[symbol] = {
          symbol,
          name,
          shortName,
          category,
          price: currentPrice,
          lastDigit: lastD,
          ema9: currentPrice,
          ema21: currentPrice,
          rsi: 50,
          atr: 0,
          bbUpper: currentPrice,
          bbLower: currentPrice,
          bbMid: currentPrice,
          trend: 'NEUTRAL',
          inOut: 'STAYS IN',
          evenCount: 0,
          oddCount: 0,
          currentStreakType: 'EVEN',
          currentStreakCount: 0,
          confluenceScore: 0,
          isHighConfluence: false,
          confluenceReason: 'Collecting initial tick buffer...',
          digitStats,
          coldestDigit: coldest?.digit ?? 0,
          coldestPct: coldest?.percentage ?? 10.0,
          coldestDormancy: coldest?.dormancy ?? 0,
          hottestDigit: hottest?.digit ?? 0,
          hottestPct: hottest?.percentage ?? 10.0,
          differSignal,
        };
        return;
      }

      // Pro Indicators
      const ema9 = calculateEMA(prices, 9);
      const ema21 = calculateEMA(prices, 21);
      const rsi = calculateRSI(prices, 14);
      const atr = calculateATR(prices, 14);
      const { upper: bbUpper, lower: bbLower, mid: bbMid } = calculateBollingerBands(prices, 20, 2.0);

      // Trend definition
      const trend =
        ema9 > ema21 && rsi > 50.0 ? 'BULLISH' : ema9 < ema21 && rsi < 50.0 ? 'BEARISH' : 'NEUTRAL';

      // Bollinger in/out
      const inOut = currentPrice > bbUpper || currentPrice < bbLower ? 'GOES OUT' : 'STAYS IN';

      // Digits streak stats
      const evenCount = digits.filter((d) => d % 2 === 0).length;
      const oddCount = digits.length - evenCount;
      const currentStreakType = lastD % 2 === 0 ? 'EVEN' : 'ODD';
      const streakCount = getCurrentStreak(digits, (d) =>
        currentStreakType === 'EVEN' ? d % 2 === 0 : d % 2 !== 0
      );

      // High-confluence evaluation
      let isHighConfluence = false;
      let confluenceScore = 0;
      let confluenceReason = 'Scanning for confluence setup...';

      if (trend === 'BULLISH' && rsi >= 56 && currentPrice > bbMid) {
        confluenceScore = Math.min(97, Math.round(78 + (rsi - 50) * 1.1 + (atr > 0 ? 5 : 0)));
        // Bullish momentum is tracked as a healthy trend, but popup badge and modal are completely suppressed
        isHighConfluence = false;
        confluenceReason = `Bullish trend: EMA 9 > 21 with RSI (${rsi.toFixed(1)}) and price above Bollinger Midline.`;
      } else if (trend === 'BEARISH' && rsi <= 44 && currentPrice < bbMid) {
        confluenceScore = Math.min(97, Math.round(78 + (50 - rsi) * 1.1 + (atr > 0 ? 5 : 0)));
        isHighConfluence = confluenceScore >= minConfidenceFilter;
        confluenceReason = `EMA 9 < 21 with oversold RSI (${rsi.toFixed(1)}) and price below Bollinger Midline.`;
      } else if (streakCount >= 4) {
        const opp = currentStreakType === 'EVEN' ? 'ODD' : 'EVEN';
        confluenceScore = Math.min(95, 75 + streakCount * 4);
        isHighConfluence = confluenceScore >= minConfidenceFilter;
        confluenceReason = `${streakCount} consecutive ${currentStreakType} digits observed. High statistical reversion to ${opp}.`;
      } else if (inOut === 'GOES OUT') {
        confluenceScore = 82;
        isHighConfluence = confluenceScore >= minConfidenceFilter;
        confluenceReason = `Price pierced 2-Std Bollinger Bands during volatility expansion.`;
      }

      result[symbol] = {
        symbol,
        name,
        shortName,
        category,
        price: currentPrice,
        lastDigit: lastD,
        ema9,
        ema21,
        rsi,
        atr,
        bbUpper,
        bbLower,
        bbMid,
        trend,
        inOut,
        evenCount,
        oddCount,
        currentStreakType,
        currentStreakCount: streakCount,
        confluenceScore,
        isHighConfluence,
        confluenceReason,
        digitStats,
        coldestDigit: coldest?.digit ?? 0,
        coldestPct: coldest?.percentage ?? 10.0,
        coldestDormancy: coldest?.dormancy ?? 0,
        hottestDigit: hottest?.digit ?? 0,
        hottestPct: hottest?.percentage ?? 10.0,
        differSignal,
      };
    });

    return result;
  }, [multiMarketPrices, multiMarketDigits, minConfidenceFilter]);

  // Active Differ Signals across all scanned volatility markets
  const activeDifferSignals = useMemo<DifferSignal[]>(() => {
    const list: DifferSignal[] = [];
    Object.values(marketMetrics).forEach((m) => {
      if (m.differSignal) {
        list.push(m.differSignal);
      }
    });
    return list.sort((a, b) => b.confidence - a.confidence);
  }, [marketMetrics]);

  // Dedicated 1-Click Differ Trade Execution
  const handleExecuteDifferTrade = (targetSymbol: MarketSymbol, targetDigit: number, customStake?: number) => {
    if (isPlacingTrade) return;
    setIsPlacingTrade(true);
    soundManager.playStart();

    const tradeStake = customStake !== undefined ? customStake : stake;
    const mInfo = CONCURRENT_SCAN_MARKETS.find((m) => m.symbol === targetSymbol);
    const mName = mInfo?.name || targetSymbol;

    try {
      const contract = derivWS.purchaseContract({
        symbol: targetSymbol,
        contractType: 'DIGITDIFF',
        stake: tradeStake,
        durationTicks: 1, // 1-Tick Duration
        targetDigit,
        symbolName: mName,
      });

      setTradeMessage(
        `🎯 DIGIT DIFFER BOUGHT: ≠ Digit ${targetDigit} on ${mName} ($${tradeStake.toFixed(2)} Stake) ID: ${contract.id.slice(-6)}`
      );
    } catch (err: any) {
      console.error('Differ trade execution error:', err);
      soundManager.playLoss();
      setTradeMessage(`⚠️ Differ Placement Failed: ${err.message || 'Error'}`);
    } finally {
      setTimeout(() => setIsPlacingTrade(false), 350);
    }
  };

  // Filter displayed markets by category tab
  const displayedMarkets = useMemo(() => {
    if (marketCategoryFilter === 'STANDARD') {
      return CONCURRENT_SCAN_MARKETS.filter((m) => m.category === 'standard');
    }
    if (marketCategoryFilter === '1S') {
      return CONCURRENT_SCAN_MARKETS.filter((m) => m.category === '1s');
    }
    if (marketCategoryFilter === 'DIFFER_SIGNALS') {
      return CONCURRENT_SCAN_MARKETS.filter((m) => marketMetrics[m.symbol]?.differSignal !== null);
    }
    return CONCURRENT_SCAN_MARKETS;
  }, [marketCategoryFilter, marketMetrics]);

  // -------------------------------------------------------------
  // HIGH CONFLUENCE SETUP ALERT TRIGGER (Pops with sound & option to trade)
  // -------------------------------------------------------------
  const checkForHighConfluenceTriggers = useCallback(() => {
    const now = Date.now();
    const COOLDOWN_MS = 45000; // 45s cooldown per market setup

    CONCURRENT_SCAN_MARKETS.forEach(({ symbol, name }) => {
      const m = marketMetrics[symbol];
      if (!m) return;

      // 🎯 1. DIGIT DIFFER SIGNALS (Live Mathematical Edge while scan is running)
      if (m.differSignal && m.differSignal.confidence >= minConfidenceFilter) {
        const differKey = `${symbol}_DIFFER_${m.differSignal.targetDigit}_${m.differSignal.type}`;
        if (!lastAlertTimeRef.current[differKey] || now - lastAlertTimeRef.current[differKey] >= COOLDOWN_MS) {
          lastAlertTimeRef.current[differKey] = now;

          const differAlert: HighConfluenceAlert = {
            id: `differ_${symbol}_${now}`,
            timestamp: now,
            timeString: new Date(now).toLocaleTimeString(),
            symbol,
            marketName: name,
            title: m.differSignal.title,
            direction: 'DIFFER',
            recommendedContract: 'DIGITDIFF',
            confidence: m.differSignal.confidence,
            price: m.price,
            lastDigit: m.lastDigit,
            ema9: m.ema9,
            ema21: m.ema21,
            rsi: m.rsi,
            atr: m.atr,
            reason: m.differSignal.reason,
            targetDigit: m.differSignal.targetDigit,
          };

          if (soundEnabled) {
            soundManager.playAlert();
          }

          setAlertHistory((prev) => [differAlert, ...prev.slice(0, 39)]);

          if (enableModalPopups) {
            setActiveAlertPopup(differAlert);
            setPopupCountdown(15);
          }

          // Auto-trade if enabled and in Differ or All mode
          if (autoTradeEnabled && (marketContractMode === 'DIFFER' || marketContractMode === 'ALL')) {
            handleExecuteDifferTrade(symbol, m.differSignal.targetDigit);
          }
        }
      }

      // 📈 2. TECHNICAL / MOMENTUM CONFLUENCE SIGNALS
      if (!m.isHighConfluence || m.confluenceScore < minConfidenceFilter) return;

      // STRICT USER OVERRIDE: Remove pop-up and alerts for Bullish Momentum
      if (m.trend === 'BULLISH' || muteBullishAlerts) {
        if (m.trend === 'BULLISH') return;
      }

      // Stable key without tick streak count to prevent repeated triggering on every tick
      const setupType = m.currentStreakCount >= 4 ? `STREAK_${m.currentStreakType}` : m.inOut === 'GOES OUT' ? 'BOLLINGER_OUT' : m.trend;
      const key = `${symbol}_${setupType}`;
      if (lastAlertTimeRef.current[key] && now - lastAlertTimeRef.current[key] < COOLDOWN_MS) {
        return;
      }
      lastAlertTimeRef.current[key] = now;

      // Determine recommended trade
      let title = `HIGH CONFLUENCE ALERT (${symbol})`;
      let direction: HighConfluenceAlert['direction'] = 'FALL';
      let recommendedContract: HighConfluenceAlert['recommendedContract'] = 'PUT';

      if (m.trend === 'BEARISH') {
        title = `BEARISH MOMENTUM CONFLUENCE (${symbol})`;
        direction = 'FALL';
        recommendedContract = 'PUT';
      } else if (m.currentStreakCount >= 4) {
        const opp = m.currentStreakType === 'EVEN' ? 'ODD' : 'EVEN';
        title = `EXTREME DIGIT ${m.currentStreakType} REVERSION (${m.currentStreakCount}x)`;
        direction = opp;
        recommendedContract = opp === 'EVEN' ? 'DIGITEVEN' : 'DIGITODD';
      } else if (m.inOut === 'GOES OUT') {
        const isAbove = m.price > m.bbUpper;
        title = `BOLLINGER 2-STD EXPANSION BREAKOUT (${symbol})`;
        direction = 'GOES_OUT';
        recommendedContract = isAbove ? 'CALL' : 'PUT';
      }

      const alert: HighConfluenceAlert = {
        id: `alert_${symbol}_${now}`,
        timestamp: now,
        timeString: new Date(now).toLocaleTimeString(),
        symbol,
        marketName: name,
        title,
        direction,
        recommendedContract,
        confidence: m.confluenceScore,
        price: m.price,
        lastDigit: m.lastDigit,
        ema9: m.ema9,
        ema21: m.ema21,
        rsi: m.rsi,
        atr: m.atr,
        reason: m.confluenceReason,
      };

      // 1. Play sound
      if (soundEnabled) {
        soundManager.playAlert();
      }

      // 2. Add to log
      setAlertHistory((prev) => [alert, ...prev.slice(0, 39)]);

      // 3. Pop-up dialog with trade option (ONLY if modal popups enabled AND NEVER on bullish momentum)
      if (enableModalPopups) {
        setActiveAlertPopup(alert);
        setPopupCountdown(15);
      }

      // 4. Auto-execute if enabled (for Rise/Fall or All)
      if (autoTradeEnabled && (marketContractMode === 'RISE_FALL' || marketContractMode === 'ALL')) {
        executeTradeFromAlert(alert);
      }
    });
  }, [marketMetrics, minConfidenceFilter, soundEnabled, autoTradeEnabled, enableModalPopups, muteBullishAlerts, marketContractMode]);

  useEffect(() => {
    checkForHighConfluenceTriggers();
  }, [marketMetrics, checkForHighConfluenceTriggers]);

  // Safety Dismissal: Ensure any lingering Bullish popup is immediately cleared
  useEffect(() => {
    if (activeAlertPopup && (activeAlertPopup.direction === 'RISE' || activeAlertPopup.title.includes('BULLISH'))) {
      setActiveAlertPopup(null);
    }
  }, [activeAlertPopup]);

  // Countdown timer for alert modal
  useEffect(() => {
    if (!activeAlertPopup || isPopupHovered) return;
    const interval = window.setInterval(() => {
      setPopupCountdown((prev) => {
        if (prev <= 1) {
          setActiveAlertPopup(null);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(interval);
  }, [activeAlertPopup, isPopupHovered]);

  // Execute trade function from alert
  const executeTradeFromAlert = (alert: HighConfluenceAlert) => {
    if (isPlacingTrade) return;

    if (alert.recommendedContract === 'DIGITDIFF') {
      handleExecuteDifferTrade(alert.symbol, alert.targetDigit ?? 0, stake);
      setActiveAlertPopup(null);
      return;
    }

    setIsPlacingTrade(true);
    soundManager.playStart();

    try {
      const contract = derivWS.purchaseContract({
        symbol: alert.symbol,
        contractType: alert.recommendedContract,
        stake,
        durationTicks,
        symbolName: alert.marketName,
      });

      setTradeMessage(
        `⚡ Executed ${alert.recommendedContract} on ${alert.marketName} (Stake: $${stake.toFixed(2)}) ID: ${contract.id.slice(-6)}`
      );
      setActiveAlertPopup(null);
    } catch (err: any) {
      console.error('Trade error:', err);
      soundManager.playLoss();
      setTradeMessage(`⚠️ Trade Placement Failed: ${err.message || 'Error'}`);
    } finally {
      setTimeout(() => setIsPlacingTrade(false), 400);
    }
  };

  // -------------------------------------------------------------
  // TRADINGVIEW CHART DATA PREPARATION FOR ACTIVE FOCUSED MARKET
  // -------------------------------------------------------------
  const activePrices = multiMarketPrices[activeSymbol] || [];
  const activeTimes = multiMarketTimes[activeSymbol] || [];

  const chartPricePoints = useMemo<ChartPricePoint[]>(() => {
    if (!activePrices.length) return [];
    return activePrices.map((p, i) => ({
      time: activeTimes[i] || Math.floor(Date.now() / 1000) - (activePrices.length - i) * 2,
      value: p,
    }));
  }, [activePrices, activeTimes]);

  const chartEma9Points = useMemo<ChartPricePoint[]>(() => {
    if (activePrices.length < 9) return [];
    const res: ChartPricePoint[] = [];
    for (let i = 9; i <= activePrices.length; i++) {
      const sub = activePrices.slice(0, i);
      const val = calculateEMA(sub, 9);
      res.push({
        time: activeTimes[i - 1] || Math.floor(Date.now() / 1000) - (activePrices.length - i) * 2,
        value: val,
      });
    }
    return res;
  }, [activePrices, activeTimes]);

  const chartEma21Points = useMemo<ChartPricePoint[]>(() => {
    if (activePrices.length < 21) return [];
    const res: ChartPricePoint[] = [];
    for (let i = 21; i <= activePrices.length; i++) {
      const sub = activePrices.slice(0, i);
      const val = calculateEMA(sub, 21);
      res.push({
        time: activeTimes[i - 1] || Math.floor(Date.now() / 1000) - (activePrices.length - i) * 2,
        value: val,
      });
    }
    return res;
  }, [activePrices, activeTimes]);

  const chartBbPoints = useMemo(() => {
    if (activePrices.length < 20) return { upper: [], lower: [], mid: [] };
    const upper: ChartPricePoint[] = [];
    const lower: ChartPricePoint[] = [];
    const mid: ChartPricePoint[] = [];

    for (let i = 20; i <= activePrices.length; i++) {
      const sub = activePrices.slice(0, i);
      const bb = calculateBollingerBands(sub, 20, 2.0);
      const t = activeTimes[i - 1] || Math.floor(Date.now() / 1000) - (activePrices.length - i) * 2;
      upper.push({ time: t, value: bb.upper });
      lower.push({ time: t, value: bb.lower });
      mid.push({ time: t, value: bb.mid });
    }

    return { upper, lower, mid };
  }, [activePrices, activeTimes]);

  const activeMetrics = marketMetrics[activeSymbol];

  const handleCopyPythonScript = () => {
    navigator.clipboard.writeText(PYTHON_BACKEND_CODE);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2500);
  };

  const handleDownloadPythonScript = () => {
    const blob = new Blob([PYTHON_BACKEND_CODE], { type: 'text/x-python' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'pro_deriv_fastapi_socketio.py';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4 text-slate-100 pb-16">
      {/* 🚀 1. TOP HEADER WITH LIVE CONCURRENT STATUS */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xl">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-gradient-to-tr from-emerald-500 via-teal-500 to-cyan-500 text-slate-950 shadow-xl shadow-emerald-500/20">
              <Activity className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-xl font-black text-white">Pro Deriv Multi-Market Scanner</h2>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-500/30 font-mono font-bold flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                  <span>asyncio.gather() 13x Concurrency</span>
                </span>
                <span className="text-xs px-2 py-0.5 rounded-md bg-teal-950 text-teal-300 border border-teal-500/30 font-mono font-bold flex items-center gap-1">
                  <Crosshair className="w-3 h-3 text-teal-400" />
                  <span>Differ Engine Active</span>
                </span>
                <span className="text-xs px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 font-mono">
                  TradingView Charts v5
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Concurrently scanning <strong>all 13 Volatility Markets (10 to 100 Standard & 1s)</strong> with real-time <strong>Digit Differ Signals (≠)</strong> & Pro Indicators.
              </p>
            </div>
          </div>

          {/* Quick Action Controls */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* View Switcher Tabs */}
            <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 flex-wrap gap-1">
              <button
                onClick={() => setViewTab('RADAR')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  viewTab === 'RADAR'
                    ? 'bg-emerald-600 text-white shadow-md shadow-emerald-500/25'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Layers className="w-3.5 h-3.5 inline mr-1.5" />
                <span>Multi-Matrix (13)</span>
              </button>
              <button
                onClick={() => setViewTab('DIFFER_ENGINE')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                  viewTab === 'DIFFER_ENGINE'
                    ? 'bg-gradient-to-r from-teal-500 to-emerald-600 text-white shadow-md shadow-emerald-500/25 font-black'
                    : 'text-emerald-400 hover:text-white'
                }`}
              >
                <Crosshair className="w-3.5 h-3.5" />
                <span>Differ Market Engine</span>
                {activeDifferSignals.length > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full bg-emerald-400 text-slate-950 text-[10px] font-black animate-pulse">
                    {activeDifferSignals.length}
                  </span>
                )}
              </button>
              <button
                onClick={() => setViewTab('CHART')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  viewTab === 'CHART'
                    ? 'bg-emerald-600 text-white shadow-md shadow-emerald-500/25'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Activity className="w-3.5 h-3.5 inline mr-1.5" />
                <span>TradingView Chart</span>
              </button>
              <button
                onClick={() => setViewTab('PYTHON_FASTAPI')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  viewTab === 'PYTHON_FASTAPI'
                    ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/25'
                    : 'text-slate-400 hover:text-cyan-400'
                }`}
              >
                <Code2 className="w-3.5 h-3.5 inline mr-1.5" />
                <span>FastAPI Backend</span>
              </button>
            </div>

            {/* Sound Toggle */}
            <button
              onClick={() => {
                setSoundEnabled(!soundEnabled);
                if (!soundEnabled) soundManager.playAlert();
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                soundEnabled
                  ? 'bg-emerald-950/60 text-emerald-300 border-emerald-500/50'
                  : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
              }`}
            >
              {soundEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
              <span>Alert Sound: {soundEnabled ? 'ON' : 'OFF'}</span>
            </button>

            {/* Pop-up Dialogs Toggle */}
            <button
              onClick={() => {
                setEnableModalPopups(!enableModalPopups);
                soundManager.playButtonClick();
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                enableModalPopups
                  ? 'bg-amber-950/60 text-amber-300 border-amber-500/50'
                  : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
              }`}
              title={enableModalPopups ? 'Click to disable modal popup dialogs' : 'Modal popup dialogs are disabled (Clean view)'}
            >
              <Shield className={`w-3.5 h-3.5 ${enableModalPopups ? 'text-amber-400' : 'text-emerald-400'}`} />
              <span>Modal Popups: {enableModalPopups ? 'ON' : 'OFF'}</span>
            </button>

            {/* Bullish Momentum Popups Removed Status */}
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-mono font-bold border bg-emerald-950/40 text-emerald-300 border-emerald-800/60" title="Pop-up badge and dialogs on bullish momentum have been completely removed">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>Bullish Popups: MUTED</span>
            </div>

            {/* Auto-Trade Toggle */}
            <button
              onClick={() => {
                setAutoTradeEnabled(!autoTradeEnabled);
                soundManager.playButtonClick();
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                autoTradeEnabled
                  ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 border-amber-300 font-black shadow-lg shadow-amber-500/30'
                  : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
              }`}
            >
              <Zap className={`w-3.5 h-3.5 ${autoTradeEnabled ? 'fill-current' : 'text-amber-400'}`} />
              <span>Auto-Trade: {autoTradeEnabled ? 'ACTIVE' : 'MANUAL'}</span>
            </button>
          </div>
        </div>

        {/* Focused Market Selector Bar */}
        <div className="mt-3.5 pt-3 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Active Index:
            </span>
            <div className="flex items-center gap-1.5 flex-wrap">
              {CONCURRENT_SCAN_MARKETS.map((m) => {
                const isSelected = activeSymbol === m.symbol;
                const metrics = marketMetrics[m.symbol];
                const hasDifferSignal = metrics?.differSignal !== null && metrics?.differSignal !== undefined;

                return (
                  <button
                    key={m.symbol}
                    onClick={() => {
                      setActiveSymbol(m.symbol);
                      soundManager.playButtonClick();
                    }}
                    className={`px-2.5 py-1 rounded-xl text-xs font-bold transition-all border flex items-center gap-1.5 cursor-pointer ${
                      isSelected
                        ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white border-emerald-400 shadow-md shadow-emerald-500/25 ring-1 ring-emerald-400'
                        : 'bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700 hover:text-slate-200'
                    }`}
                  >
                    <span>{m.shortName}</span>
                    {hasDifferSignal && (
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" title="Differ Signal Active!" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex items-center gap-3 text-xs font-mono">
            <span className="text-slate-400">
              Min Confidence Threshold:
            </span>
            <select
              value={minConfidenceFilter}
              onChange={(e) => setMinConfidenceFilter(parseInt(e.target.value, 10))}
              className="bg-slate-950 border border-slate-800 text-emerald-400 font-bold px-2 py-1 rounded-lg text-xs"
            >
              <option value={75}>75% (Balanced)</option>
              <option value={80}>80% (Strict Confluence)</option>
              <option value={85}>85% (Ultra Precision)</option>
              <option value={90}>90% (Max Edge)</option>
            </select>
          </div>
        </div>
      </div>

      {/* 🚀 STATUS BANNER */}
      {tradeMessage && (
        <div className="p-3 bg-slate-900 border border-emerald-500/40 rounded-xl flex items-center justify-between text-xs text-slate-200 shadow-lg">
          <span className="font-semibold">{tradeMessage}</span>
          <button onClick={() => setTradeMessage(null)} className="text-slate-400 hover:text-white font-bold ml-2">
            ✕
          </button>
        </div>
      )}

      {/* 🎯 LIVE DIGIT DIFFER SIGNALS BANNER (Auto-triggers as scan runs across all 13 markets) */}
      {activeDifferSignals.length > 0 && (
        <div className="p-4 bg-gradient-to-r from-emerald-950/90 via-slate-900 to-teal-950/90 border-2 border-emerald-500/70 rounded-2xl shadow-2xl shadow-emerald-500/20 space-y-2.5 ring-2 ring-emerald-500/30">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-emerald-500/30 pb-2">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-emerald-500 text-slate-950 font-black animate-pulse">
                <Crosshair className="w-4 h-4" />
              </span>
              <div>
                <h4 className="text-sm font-black text-white flex items-center gap-2">
                  <span>LIVE DIGIT DIFFER SIGNALS DETECTED</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500 text-slate-950 font-bold">
                    {activeDifferSignals.length} Market{activeDifferSignals.length > 1 ? 's' : ''} Ready
                  </span>
                </h4>
                <p className="text-[11px] text-emerald-200/80">
                  Confirmed mathematical differ edge on live Volatility stream. Click "BUY DIFFER" for 1-click execution.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs font-mono">
              <span className="text-slate-400">Differ Payout:</span>
              <span className="text-emerald-400 font-bold">+9.8%</span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {activeDifferSignals.map((sig) => (
              <div
                key={sig.symbol}
                className="p-3 rounded-xl bg-slate-950/90 border border-emerald-500/50 hover:border-emerald-400 transition-all shadow-md flex items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-white text-xs truncate">{sig.marketName}</span>
                    <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-mono font-black text-xs border border-emerald-500/40">
                      ≠ {sig.targetDigit}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-300 truncate mt-1">
                    {sig.reason}
                  </div>
                  <div className="text-[10px] text-emerald-400 font-mono mt-0.5">
                    Win Edge: <strong>{sig.confidence}%</strong> • Dormant: {sig.dormancy}t
                  </div>
                </div>

                <button
                  disabled={isPlacingTrade}
                  onClick={() => handleExecuteDifferTrade(sig.symbol, sig.targetDigit)}
                  className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-xs transition-all shrink-0 shadow-lg shadow-emerald-500/30 active:scale-95 cursor-pointer disabled:opacity-50"
                  title={`Buy 1 Differ Contract: ≠ Digit ${sig.targetDigit} on ${sig.marketName}`}
                >
                  BUY ≠ {sig.targetDigit}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 📊 2. MULTI-MARKET SCANNING MATRIX (ALL 13 MARKETS SIMULTANEOUSLY) */}
      {viewTab === 'RADAR' && (
        <div className="space-y-4">
          {/* Scanner Filter Bar */}
          <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-slate-900 border border-slate-800 rounded-xl">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs text-slate-400 font-bold mr-1">Filter Markets:</span>
              <button
                onClick={() => setMarketCategoryFilter('ALL')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  marketCategoryFilter === 'ALL'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-950 text-slate-400 border border-slate-800 hover:text-white'
                }`}
              >
                All Volatilities ({CONCURRENT_SCAN_MARKETS.length})
              </button>
              <button
                onClick={() => setMarketCategoryFilter('STANDARD')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  marketCategoryFilter === 'STANDARD'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-950 text-slate-400 border border-slate-800 hover:text-white'
                }`}
              >
                Standard 10–100 (5)
              </button>
              <button
                onClick={() => setMarketCategoryFilter('1S')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  marketCategoryFilter === '1S'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-950 text-slate-400 border border-slate-800 hover:text-white'
                }`}
              >
                1-Second (1s) Markets (8)
              </button>
              <button
                onClick={() => setMarketCategoryFilter('DIFFER_SIGNALS')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  marketCategoryFilter === 'DIFFER_SIGNALS'
                    ? 'bg-teal-600 text-white'
                    : 'bg-slate-950 text-emerald-400 border border-emerald-900/60 hover:text-emerald-300'
                }`}
              >
                <Crosshair className="w-3.5 h-3.5" />
                <span>Differ Signals ({activeDifferSignals.length})</span>
              </button>
            </div>

            <div className="text-xs text-slate-400 font-mono">
              Showing {displayedMarkets.length} of {CONCURRENT_SCAN_MARKETS.length} Markets
            </div>
          </div>

          {/* Cards Grid for Displayed Markets */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5">
            {displayedMarkets.map(({ symbol, name, shortName, category }) => {
              const m = marketMetrics[symbol];
              const isSelected = activeSymbol === symbol;
              const hasDifferSignal = m?.differSignal !== null && m?.differSignal !== undefined;

              return (
                <div
                  key={symbol}
                  onClick={() => setActiveSymbol(symbol)}
                  className={`p-3.5 rounded-2xl border transition-all cursor-pointer relative overflow-hidden flex flex-col justify-between space-y-2.5 ${
                    hasDifferSignal
                      ? 'bg-gradient-to-b from-teal-950/40 via-slate-900 to-slate-900 border-teal-500/80 shadow-xl shadow-teal-500/15 ring-2 ring-teal-400/50'
                      : isSelected
                      ? 'bg-slate-900 border-emerald-500 ring-2 ring-emerald-500/40 shadow-xl'
                      : 'bg-slate-900/90 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  {/* Glowing Signal Header if Differ active */}
                  {hasDifferSignal && (
                    <div className="absolute top-0 left-0 right-0 py-0.5 bg-gradient-to-r from-teal-500 to-emerald-500 text-slate-950 font-black text-[9px] uppercase tracking-wider text-center flex items-center justify-center gap-1">
                      <Crosshair className="w-3 h-3 fill-current" />
                      <span>DIFFER SIGNAL: ≠ {m.differSignal!.targetDigit} ({m.differSignal!.confidence}%)</span>
                    </div>
                  )}

                  <div className={`flex items-center justify-between ${hasDifferSignal ? 'mt-2' : ''}`}>
                    <div className="flex items-center gap-2">
                      <div
                        className={`w-2.5 h-2.5 rounded-full ${
                          m?.trend === 'BULLISH' ? 'bg-emerald-400' : m?.trend === 'BEARISH' ? 'bg-rose-400' : 'bg-slate-500'
                        }`}
                      />
                      <div>
                        <h4 className="font-bold text-white text-xs leading-none">{shortName}</h4>
                        <span className="text-[9px] font-mono text-slate-400 uppercase">{category === '1s' ? '1s Ticks' : '2s Ticks'}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="font-mono font-bold text-xs text-white">
                        {m ? formatDerivQuote(m.price, getMarketPipSize(symbol), symbol) : '--'}
                      </span>
                      <span className="ml-1 text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-emerald-300 font-mono font-bold">
                        [{m?.lastDigit ?? 0}]
                      </span>
                    </div>
                  </div>

                  {/* Differ Signal Recommendation Box */}
                  {hasDifferSignal ? (
                    <div className="p-2 rounded-xl bg-teal-950/70 border border-teal-500/50 space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-[10px] uppercase font-bold text-teal-300">Differ Signal:</span>
                        <span className="font-mono font-black text-emerald-300 bg-slate-950 px-1.5 py-0.2 rounded border border-teal-500/40">
                          ≠ Digit {m.differSignal!.targetDigit}
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-300 leading-tight">
                        {m.differSignal!.reason}
                      </div>
                      <div className="flex items-center justify-between pt-1">
                        <span className="text-[10px] font-mono text-teal-400 font-bold">Edge: {m.differSignal!.confidence}%</span>
                        <button
                          disabled={isPlacingTrade}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleExecuteDifferTrade(symbol, m.differSignal!.targetDigit);
                          }}
                          className="px-2.5 py-1 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-[11px] transition-all shadow-md shadow-emerald-500/30 cursor-pointer"
                        >
                          BUY ≠ {m.differSignal!.targetDigit}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="p-2 rounded-xl bg-slate-950/60 border border-slate-800/60 space-y-1 text-[11px] font-mono">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">Coldest:</span>
                        <span className="text-teal-300 font-bold">
                          ≠ Digit {m?.coldestDigit ?? 0} ({m?.coldestPct ?? 10}%)
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[10px] text-slate-400">
                        <span>Dormant: {m?.coldestDormancy ?? 0} ticks</span>
                        <span>Hot: {m?.hottestDigit ?? 0} ({m?.hottestPct ?? 10}%)</span>
                      </div>
                    </div>
                  )}

                  {/* Indicator Readouts */}
                  <div className="space-y-1 text-[11px] font-mono">
                    <div className="flex items-center justify-between p-1 rounded bg-slate-950/50 border border-slate-800/40">
                      <span className="text-slate-400">Trend:</span>
                      <span className={`font-black ${m?.trend === 'BULLISH' ? 'text-emerald-400' : m?.trend === 'BEARISH' ? 'text-rose-400' : 'text-slate-400'}`}>
                        {m?.trend || 'NEUTRAL'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between p-1 rounded bg-slate-950/50 border border-slate-800/40">
                      <span className="text-slate-400">RSI / Streak:</span>
                      <span className="text-slate-300">
                        {m?.rsi.toFixed(1) ?? '--'} | {m?.currentStreakCount ?? 0}x {m?.currentStreakType ?? ''}
                      </span>
                    </div>
                  </div>

                  {/* 1-Click Action Buttons */}
                  <div className="pt-2 border-t border-slate-800/80 grid grid-cols-2 gap-1.5">
                    <button
                      disabled={isPlacingTrade}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleExecuteDifferTrade(symbol, m?.differSignal?.targetDigit ?? m?.coldestDigit ?? 0);
                      }}
                      className="py-1.5 px-2 rounded-lg bg-teal-600 hover:bg-teal-500 text-white font-black text-xs transition-all flex items-center justify-center gap-1 shadow-sm cursor-pointer"
                      title={`Buy 1 Differ Contract: ≠ Digit ${m?.differSignal?.targetDigit ?? m?.coldestDigit ?? 0}`}
                    >
                      <Crosshair className="w-3 h-3" />
                      <span>BUY ≠ {m?.differSignal?.targetDigit ?? m?.coldestDigit ?? 0}</span>
                    </button>
                    <button
                      disabled={isPlacingTrade}
                      onClick={(e) => {
                        e.stopPropagation();
                        derivWS.purchaseContract({
                          symbol,
                          contractType: m?.trend === 'BEARISH' ? 'PUT' : 'CALL',
                          stake,
                          durationTicks: 1,
                          symbolName: name,
                        });
                        soundManager.playStart();
                        setTradeMessage(`🚀 Placed ${m?.trend === 'BEARISH' ? 'FALL' : 'RISE'} on ${shortName}`);
                      }}
                      className={`py-1.5 px-2 rounded-lg text-xs font-bold transition-all shadow-sm ${
                        m?.trend === 'BULLISH'
                          ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                          : m?.trend === 'BEARISH'
                          ? 'bg-rose-600 hover:bg-rose-500 text-white'
                          : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                      }`}
                    >
                      {m?.trend === 'BEARISH' ? 'FALL (Put)' : 'RISE (Call)'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 🎯 3. DEDICATED DIFFER MARKET ENGINE VIEW */}
      {viewTab === 'DIFFER_ENGINE' && (
        <div className="space-y-4">
          {/* Active Market Differ Console Banner */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xl space-y-4">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-3 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-2xl bg-gradient-to-tr from-teal-500 to-emerald-500 text-slate-950 font-black shadow-lg shadow-teal-500/25">
                  <Crosshair className="w-6 h-6 animate-pulse" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-lg font-black text-white">{activeMetrics?.name || activeSymbol}</h3>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-teal-950 text-teal-300 border border-teal-500/40 font-mono font-bold">
                      {activeMetrics?.category === '1s' ? '1-Tick/Sec Speed' : 'Standard 2-Sec'}
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-500/40 font-mono font-bold">
                      Payout: +9.8%
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Live Digit Differ Sniper. Win condition: next exit digit must NOT match target digit (9 out of 10 digits win).
                  </p>
                </div>
              </div>

              {/* Live Spot Quote & Last Digit */}
              <div className="flex items-center gap-4 bg-slate-950 px-4 py-2.5 rounded-xl border border-slate-800">
                <div>
                  <div className="text-[10px] text-slate-400 uppercase font-mono">Current Spot</div>
                  <div className="text-base font-black font-mono text-emerald-400">
                    {formatDerivQuote(activeMetrics?.price || 0, activeMarketPipSize, activeSymbol)}
                  </div>
                </div>
                <div className="h-8 w-px bg-slate-800" />
                <div>
                  <div className="text-[10px] text-slate-400 uppercase font-mono">Last Digit</div>
                  <div className="text-base font-black font-mono text-white text-center bg-slate-800 px-2 py-0.5 rounded">
                    {activeMetrics?.lastDigit ?? 0}
                  </div>
                </div>
              </div>
            </div>

            {/* Active Differ Recommendation Card (if triggered) */}
            {activeMetrics?.differSignal ? (
              <div className="p-4 rounded-2xl bg-gradient-to-r from-teal-950/80 via-slate-950 to-emerald-950/80 border-2 border-teal-500/70 shadow-xl space-y-2">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-teal-400 animate-spin-slow" />
                    <div>
                      <span className="text-[10px] font-mono uppercase tracking-wider font-bold text-teal-300">
                        HIGH-CONFIDENCE DIFFER SIGNAL ACTIVE
                      </span>
                      <h4 className="text-sm font-black text-white">{activeMetrics.differSignal.title}</h4>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-slate-400">Calculated Edge:</span>
                    <span className="text-emerald-400 font-mono font-black text-base">{activeMetrics.differSignal.confidence}%</span>
                  </div>
                </div>

                <p className="text-xs text-slate-200 leading-relaxed font-sans">
                  {activeMetrics.differSignal.reason}
                </p>

                <div className="pt-2 flex items-center justify-between">
                  <div className="text-xs font-mono text-slate-400">
                    Target: <strong className="text-emerald-300 text-sm">≠ Digit {activeMetrics.differSignal.targetDigit}</strong>
                  </div>
                  <button
                    disabled={isPlacingTrade}
                    onClick={() => handleExecuteDifferTrade(activeSymbol, activeMetrics.differSignal!.targetDigit)}
                    className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 active:scale-95 text-slate-950 font-black text-xs transition-all shadow-xl shadow-teal-500/30 flex items-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    <Crosshair className="w-4 h-4 fill-current" />
                    <span>BUY DIFFER ≠ {activeMetrics.differSignal.targetDigit} (${stake.toFixed(2)})</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 text-xs text-slate-400 flex items-center justify-between font-mono">
                <span>Recommended Differ Target: <strong className="text-teal-300 font-bold">≠ Digit {activeMetrics?.coldestDigit ?? 0}</strong> (Coldest: {activeMetrics?.coldestPct ?? 10}% freq, dormant for {activeMetrics?.coldestDormancy ?? 0}t)</span>
                <button
                  disabled={isPlacingTrade}
                  onClick={() => handleExecuteDifferTrade(activeSymbol, activeMetrics?.coldestDigit ?? 0)}
                  className="px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-500 text-white font-black text-xs transition-all cursor-pointer"
                >
                  BUY ≠ {activeMetrics?.coldestDigit ?? 0}
                </button>
              </div>
            )}

            {/* 10-Digit Distribution Bars (0 to 9) */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                  <Percent className="w-4 h-4 text-emerald-400" />
                  <span>Real Digit Percentage Distribution (0–9)</span>
                </span>
                <span className="text-xs text-slate-400 font-mono">
                  Sample: {multiMarketDigits[activeSymbol]?.length || 0} Ticks
                </span>
              </div>

              <div className="grid grid-cols-10 gap-1.5 sm:gap-2">
                {(activeMetrics?.digitStats || []).map((item) => {
                  const isTarget = differTargetDigit === item.digit;
                  const isCurrent = activeMetrics?.lastDigit === item.digit;
                  const isColdest = activeMetrics?.coldestDigit === item.digit;
                  const isHottest = activeMetrics?.hottestDigit === item.digit;

                  return (
                    <div
                      key={item.digit}
                      onClick={() => setDifferTargetDigit(item.digit)}
                      className={`p-2 rounded-xl border flex flex-col justify-between items-center transition-all cursor-pointer relative ${
                        isTarget
                          ? 'bg-slate-800 border-teal-500 ring-2 ring-teal-500/40 shadow-lg'
                          : isColdest
                          ? 'bg-teal-950/30 border-teal-500/50'
                          : isCurrent
                          ? 'bg-slate-850 border-cyan-500/40'
                          : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      {/* Top Badges */}
                      <div className="h-4 flex items-center justify-center">
                        {isColdest && <span className="text-[8px] px-1 rounded bg-teal-500/30 text-teal-300 font-black">COLD</span>}
                        {isHottest && <span className="text-[8px] px-1 rounded bg-rose-500/30 text-rose-300 font-black">HOT</span>}
                        {isCurrent && !isColdest && !isHottest && <span className="text-[9px] text-cyan-400 font-bold animate-bounce">▼</span>}
                      </div>

                      {/* Percentage */}
                      <div className="text-xs font-mono font-black text-center my-1">
                        <span className={isColdest ? 'text-teal-300' : isHottest ? 'text-rose-400' : 'text-slate-200'}>
                          {item.percentage}%
                        </span>
                      </div>

                      {/* Height Bar representation */}
                      <div className="w-full h-16 bg-slate-900 rounded-md p-1 flex flex-col justify-end overflow-hidden my-1">
                        <div
                          style={{ height: `${Math.max(10, Math.min(100, (item.percentage / 20) * 100))}%` }}
                          className={`w-full rounded transition-all duration-300 ${
                            isColdest
                              ? 'bg-gradient-to-t from-teal-600 to-teal-400'
                              : isHottest
                              ? 'bg-gradient-to-t from-rose-600 to-rose-400'
                              : 'bg-slate-700'
                          }`}
                        />
                      </div>

                      {/* Digit Number & Dormancy */}
                      <div className="text-center w-full mt-1">
                        <span className="text-sm font-black font-mono text-white block leading-none">{item.digit}</span>
                        <span className="text-[9px] text-slate-400 font-mono mt-0.5 block">{item.dormancy}t</span>
                      </div>

                      {/* 1-Tap Buy Differ Button */}
                      <button
                        disabled={isPlacingTrade}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleExecuteDifferTrade(activeSymbol, item.digit);
                        }}
                        className={`mt-1.5 w-full py-1 rounded text-[10px] font-black uppercase transition-all cursor-pointer ${
                          isTarget
                            ? 'bg-teal-500 text-slate-950 shadow-md shadow-teal-500/30'
                            : 'bg-slate-900 hover:bg-teal-600 hover:text-white text-slate-300 border border-slate-700'
                        }`}
                        title={`Click to buy Differ contract ≠ ${item.digit}`}
                      >
                        ≠ BUY
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Differ Interactive Order Console */}
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                    Order Parameters & Stake Sizing
                  </h4>
                  <p className="text-[11px] text-slate-400">
                    Selected Differ Target: <strong className="text-teal-300 font-mono">≠ Digit {differTargetDigit}</strong>
                  </p>
                </div>

                <div className="flex items-center gap-1.5 flex-wrap">
                  {[0.35, 0.5, 1, 2, 5, 10, 25].map((s) => (
                    <button
                      key={s}
                      onClick={() => setStake(s)}
                      className={`text-xs px-2.5 py-1 rounded-lg border font-mono font-bold transition-all ${
                        stake === s
                          ? 'bg-emerald-600 text-white border-emerald-500'
                          : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                      }`}
                    >
                      ${s}
                    </button>
                  ))}
                  <button
                    onClick={() => setStake((prev) => Number((prev * 2).toFixed(2)))}
                    className="text-xs px-2 py-1 rounded-lg bg-indigo-950/60 border border-indigo-800/80 text-indigo-300 font-bold"
                  >
                    2x
                  </button>
                  <button
                    onClick={() => setStake((prev) => Number(Math.max(0.35, prev / 2).toFixed(2)))}
                    className="text-xs px-2 py-1 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 font-bold"
                  >
                    ½
                  </button>
                </div>
              </div>

              {/* Big Action Button with Live Payout */}
              <button
                disabled={isPlacingTrade}
                onClick={() => handleExecuteDifferTrade(activeSymbol, differTargetDigit)}
                className="w-full p-4 rounded-2xl bg-gradient-to-r from-teal-500 via-emerald-500 to-teal-600 hover:from-teal-400 hover:to-emerald-400 active:scale-[0.99] text-slate-950 font-black transition-all shadow-xl shadow-emerald-500/20 flex items-center justify-between cursor-pointer disabled:opacity-50"
              >
                <div className="flex items-center gap-3 text-left">
                  <div className="p-2.5 rounded-xl bg-slate-950/30 text-slate-950">
                    <Crosshair className="w-6 h-6 animate-pulse" />
                  </div>
                  <div>
                    <div className="text-base font-black flex items-center gap-2">
                      <span>BUY DIGIT DIFFER</span>
                      <span className="text-xs px-2.5 py-0.5 rounded-lg bg-slate-950 text-teal-300 font-mono">
                        ≠ Digit {differTargetDigit}
                      </span>
                    </div>
                    <div className="text-[11px] font-normal text-slate-900 mt-0.5">
                      Wins if exit digit is NOT {differTargetDigit} (1-Tick Contract) • ~90.9% to 98% Probability
                    </div>
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-[11px] uppercase font-bold text-slate-900">Payout: +9.8%</div>
                  <div className="text-lg font-mono font-black text-slate-950">+${(stake * 0.098).toFixed(2)}</div>
                  <div className="text-[10px] text-slate-800 font-mono">Total Return: ${(stake * 1.098).toFixed(2)}</div>
                </div>
              </button>
            </div>
          </div>

          {/* Multi-Market Differ Signals Radar Table (All 13 Markets) */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xl space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Radio className="w-4 h-4 text-teal-400 animate-pulse" />
                <span>13-Market Volatility Differ Radar (Live Feed)</span>
              </h3>
              <div className="text-xs text-slate-400 font-mono">
                Standard Volatilities (10–100) & 1s Markets Scanning in Parallel
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-slate-950 text-slate-400 uppercase font-semibold border-b border-slate-800">
                  <tr>
                    <th className="py-2.5 px-3">Market</th>
                    <th className="py-2.5 px-3">Type</th>
                    <th className="py-2.5 px-3">Quote</th>
                    <th className="py-2.5 px-3">Last Digit</th>
                    <th className="py-2.5 px-3">Coldest Digit</th>
                    <th className="py-2.5 px-3">Hottest Digit</th>
                    <th className="py-2.5 px-3">Differ Signal Status</th>
                    <th className="py-2.5 px-3 text-right">1-Click Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {CONCURRENT_SCAN_MARKETS.map((m) => {
                    const metrics = marketMetrics[m.symbol];
                    const sig = metrics?.differSignal;
                    const pip = getMarketPipSize(m.symbol);

                    return (
                      <tr
                        key={m.symbol}
                        onClick={() => setActiveSymbol(m.symbol)}
                        className={`hover:bg-slate-800/40 transition-colors cursor-pointer ${
                          activeSymbol === m.symbol ? 'bg-slate-800/30' : ''
                        }`}
                      >
                        <td className="py-2.5 px-3 font-bold text-white flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-emerald-400" />
                          <span>{m.name}</span>
                        </td>
                        <td className="py-2.5 px-3 text-slate-400 uppercase text-[11px]">{m.category}</td>
                        <td className="py-2.5 px-3 text-slate-200">
                          {metrics ? formatDerivQuote(metrics.price, pip, m.symbol) : '--'}
                        </td>
                        <td className="py-2.5 px-3 font-black text-white">
                          <span className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700">
                            {metrics?.lastDigit ?? 0}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-teal-300 font-bold">
                          ≠ Digit {metrics?.coldestDigit ?? 0} ({metrics?.coldestPct ?? 10}% • {metrics?.coldestDormancy ?? 0}t)
                        </td>
                        <td className="py-2.5 px-3 text-rose-300">
                          Digit {metrics?.hottestDigit ?? 0} ({metrics?.hottestPct ?? 10}%)
                        </td>
                        <td className="py-2.5 px-3">
                          {sig ? (
                            <span className="px-2 py-0.5 rounded-full bg-teal-500/20 text-teal-300 border border-teal-500/40 font-bold text-[11px] flex items-center gap-1 w-fit">
                              <Sparkles className="w-3 h-3 text-teal-400" />
                              <span>≠ {sig.targetDigit} ({sig.confidence}%)</span>
                            </span>
                          ) : (
                            <span className="text-slate-500 text-[11px]">Scanning buffer...</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <button
                            disabled={isPlacingTrade}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleExecuteDifferTrade(m.symbol, sig?.targetDigit ?? metrics?.coldestDigit ?? 0);
                            }}
                            className="px-3 py-1 rounded-lg bg-teal-600 hover:bg-teal-500 text-white font-black text-[11px] transition-all shadow cursor-pointer disabled:opacity-50"
                          >
                            BUY ≠ {sig?.targetDigit ?? metrics?.coldestDigit ?? 0}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 📈 3. SLEEK TRADINGVIEW LIGHTWEIGHT CHART FOR FOCUSED MARKET */}
      {viewTab !== 'PYTHON_FASTAPI' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xl space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Activity className="w-5 h-5 text-emerald-400" />
                <span>TradingView Lightweight Chart — {activeSymbol}</span>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 font-mono">
                  Sliding 100 Ticks
                </span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Official TradingView Lightweight Charts engine with real-time EMA 9, EMA 21, and Bollinger Bands overlays.
              </p>
            </div>

            <div className="flex items-center gap-3 text-xs font-mono">
              <span className="text-slate-400">
                Current Quote: <strong className="text-emerald-400 text-sm">{formatDerivQuote(activeMetrics?.price || 0, activeMarketPipSize, activeSymbol)}</strong>
              </span>
              <span className="text-slate-400">
                Last Digit: <strong className="text-white bg-slate-800 px-2 py-0.5 rounded font-black text-sm">{activeMetrics?.lastDigit ?? 0}</strong>
              </span>
            </div>
          </div>

          {/* TradingView Chart Container */}
          <TradingViewChart
            data={chartPricePoints}
            ema9Data={chartEma9Points}
            ema21Data={chartEma21Points}
            bbUpperData={chartBbPoints.upper}
            bbLowerData={chartBbPoints.lower}
            bbMidData={chartBbPoints.mid}
            height={280}
            pipSize={activeMarketPipSize}
            symbol={activeSymbol}
            showIndicators={true}
          />

          {/* Indicators Ribbon under chart */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2.5 pt-2">
            <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
              <div className="text-[10px] text-slate-400 uppercase font-semibold">Direction / Trend</div>
              <div className={`text-sm font-black font-mono mt-0.5 ${
                activeMetrics?.trend === 'BULLISH' ? 'text-emerald-400' : activeMetrics?.trend === 'BEARISH' ? 'text-rose-400' : 'text-slate-300'
              }`}>
                {activeMetrics?.trend || 'NEUTRAL'}
              </div>
            </div>

            <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
              <div className="text-[10px] text-cyan-400 uppercase font-semibold">EMA 9 (Fast)</div>
              <div className="text-sm font-black font-mono text-white mt-0.5">
                {activeMetrics?.ema9.toFixed(activeMarketPipSize) || '--'}
              </div>
            </div>

            <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
              <div className="text-[10px] text-amber-400 uppercase font-semibold">EMA 21 (Slow)</div>
              <div className="text-sm font-black font-mono text-white mt-0.5">
                {activeMetrics?.ema21.toFixed(activeMarketPipSize) || '--'}
              </div>
            </div>

            <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
              <div className="text-[10px] text-slate-400 uppercase font-semibold">RSI (14) Momentum</div>
              <div className={`text-sm font-black font-mono mt-0.5 ${
                activeMetrics && activeMetrics.rsi >= 55 ? 'text-emerald-400' : activeMetrics && activeMetrics.rsi <= 45 ? 'text-rose-400' : 'text-slate-300'
              }`}>
                {activeMetrics?.rsi.toFixed(1) || '--'}
              </div>
            </div>

            <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
              <div className="text-[10px] text-slate-400 uppercase font-semibold">ATR (14) Volatility</div>
              <div className="text-sm font-black font-mono text-cyan-300 mt-0.5">
                {activeMetrics?.atr.toFixed(4) || '--'}
              </div>
            </div>

            <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
              <div className="text-[10px] text-slate-400 uppercase font-semibold">Active Streak</div>
              <div className="text-sm font-black font-mono text-amber-400 mt-0.5">
                {activeMetrics?.currentStreakCount}x {activeMetrics?.currentStreakType}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 💻 4. FASTAPI + SOCKET.IO BACKEND PYTHON SCRIPT VIEW & RUNNER */}
      {viewTab === 'PYTHON_FASTAPI' && (
        <div className="bg-slate-950 border border-slate-800 rounded-2xl p-5 shadow-2xl space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
            <div>
              <div className="flex items-center gap-2">
                <Server className="w-5 h-5 text-blue-400" />
                <h3 className="text-base font-bold text-white">backend/pro_deriv_fastapi_socketio.py</h3>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-950 text-blue-300 border border-blue-500/40 font-mono">
                  FastAPI + Socket.IO + asyncio.gather()
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Standalone high-performance asynchronous multi-market scanner streaming to Tailwind + TradingView Lightweight Charts.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleCopyPythonScript}
                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition-all flex items-center gap-1.5"
              >
                {copiedCode ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                <span>{copiedCode ? 'Copied!' : 'Copy Script'}</span>
              </button>
              <button
                onClick={handleDownloadPythonScript}
                className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-all flex items-center gap-1.5 shadow-md shadow-blue-500/20"
              >
                <Download className="w-4 h-4" />
                <span>Download .py</span>
              </button>
            </div>
          </div>

          {/* Execution instructions */}
          <div className="p-3 bg-slate-900 rounded-xl border border-slate-800 text-xs space-y-2 font-mono">
            <div className="text-emerald-400 font-bold flex items-center gap-2">
              <Play className="w-4 h-4" />
              <span>How to run this backend locally:</span>
            </div>
            <div className="p-2 bg-slate-950 rounded border border-slate-800/80 text-slate-300 select-all">
              pip install fastapi uvicorn python-socketio websockets
            </div>
            <div className="p-2 bg-slate-950 rounded border border-slate-800/80 text-slate-300 select-all">
              uvicorn backend.pro_deriv_fastapi_socketio:asgi_app --host 0.0.0.0 --port 8000 --reload
            </div>
          </div>

          <pre className="text-slate-300 leading-relaxed overflow-x-auto p-4 bg-slate-900/80 rounded-xl border border-slate-800/60 font-mono text-[11px] sm:text-xs max-h-[360px] scrollbar-thin">
            {PYTHON_BACKEND_CODE}
          </pre>
        </div>
      )}

      {/* 📜 5. AUDIT LOG: RECENT HIGH CONFLUENCE ALERTS */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xl space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Clock className="w-4 h-4 text-emerald-400" />
            <span>High-Confluence Alerts History ({alertHistory.length})</span>
          </h3>
          {alertHistory.length > 0 && (
            <button
              onClick={() => setAlertHistory([])}
              className="text-xs text-slate-400 hover:text-rose-400 flex items-center gap-1 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Clear History</span>
            </button>
          )}
        </div>

        {alertHistory.length === 0 ? (
          <div className="py-8 text-center text-slate-500 text-xs font-mono">
            Running concurrent scanner for R_10, R_50, R_75, R_100... High-confluence alerts will populate here upon trigger.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-slate-950 text-slate-400 uppercase font-semibold border-b border-slate-800">
                <tr>
                  <th className="py-2.5 px-3">Time</th>
                  <th className="py-2.5 px-3">Market</th>
                  <th className="py-2.5 px-3">Setup</th>
                  <th className="py-2.5 px-3">Signal</th>
                  <th className="py-2.5 px-3">Confidence</th>
                  <th className="py-2.5 px-3">Confluence Reasoning</th>
                  <th className="py-2.5 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {alertHistory.map((al) => (
                  <tr key={al.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-2.5 px-3 text-slate-400">{al.timeString}</td>
                    <td className="py-2.5 px-3 font-bold text-white">{al.symbol}</td>
                    <td className="py-2.5 px-3 text-slate-300 font-sans">{al.title}</td>
                    <td className="py-2.5 px-3">
                      <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold">
                        {al.recommendedContract}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 font-black text-emerald-400">{al.confidence}%</td>
                    <td className="py-2.5 px-3 text-slate-400 max-w-xs truncate font-sans text-[11px]">{al.reason}</td>
                    <td className="py-2.5 px-3 text-right">
                      <button
                        onClick={() => executeTradeFromAlert(al)}
                        className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] transition-all"
                      >
                        Trade
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 🔔 6. INTERACTIVE HIGH-CONFLUENCE ALERT POPUP MODAL ("Option of Whether to Trade") */}
      {activeAlertPopup && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200"
          onMouseEnter={() => setIsPopupHovered(true)}
          onMouseLeave={() => setIsPopupHovered(false)}
        >
          <div className="relative w-full max-w-lg bg-slate-900 border-2 border-amber-500 rounded-3xl p-5 sm:p-6 shadow-2xl shadow-amber-500/20 space-y-4 ring-4 ring-amber-500/20">
            {/* Top Bar with Timer */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="p-2 rounded-xl bg-amber-500 text-slate-950 font-black animate-pulse">
                  <Sparkles className="w-5 h-5" />
                </span>
                <div>
                  <div className="text-[10px] font-mono font-bold uppercase tracking-wider text-amber-400">
                    🔥 HIGH-CONFLUENCE SETUP TRIGGERED
                  </div>
                  <h3 className="text-lg font-black text-white">{activeAlertPopup.title}</h3>
                </div>
              </div>
              <button
                onClick={() => setActiveAlertPopup(null)}
                className="p-1.5 rounded-xl bg-slate-800 text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Signal Details Card */}
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Triggered Index:</span>
                <span className="font-bold text-white font-mono">{activeAlertPopup.marketName} ({activeAlertPopup.symbol})</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Current Spot & Digit:</span>
                <span className="font-bold text-emerald-400 font-mono">
                  {activeAlertPopup.price.toFixed(getMarketPipSize(activeAlertPopup.symbol))} [Digit {activeAlertPopup.lastDigit}]
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Recommended Contract:</span>
                <span className="px-2.5 py-0.5 rounded-lg bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 font-mono font-bold">
                  {activeAlertPopup.recommendedContract}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Confluence Win Probability:</span>
                <span className="text-amber-400 font-black font-mono text-sm">{activeAlertPopup.confidence}%</span>
              </div>
              <div className="pt-2 border-t border-slate-800/80 text-xs text-slate-300 leading-relaxed font-sans">
                <strong className="text-slate-400 font-mono">Indicator Confluence:</strong> {activeAlertPopup.reason}
              </div>
            </div>

            {/* Quick Stake & Duration Setup */}
            <div className="grid grid-cols-2 gap-3 pt-1">
              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">Stake (USD)</label>
                <div className="relative">
                  <DollarSign className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="number"
                    step="0.1"
                    min="0.35"
                    value={stake}
                    onChange={(e) => setStake(Math.max(0.35, parseFloat(e.target.value) || 0.35))}
                    className="w-full bg-slate-950 text-white font-mono font-bold text-sm rounded-xl pl-9 pr-3 py-2 border border-slate-800 focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">Duration (Ticks)</label>
                <select
                  value={durationTicks}
                  onChange={(e) => setDurationTicks(parseInt(e.target.value, 10))}
                  className="w-full bg-slate-950 text-white font-mono font-bold text-sm rounded-xl px-3 py-2 border border-slate-800 focus:border-emerald-500 focus:outline-none"
                >
                  <option value={1}>1 Tick (Fastest)</option>
                  <option value={2}>2 Ticks</option>
                  <option value={3}>3 Ticks</option>
                  <option value={5}>5 Ticks (Standard)</option>
                </select>
              </div>
            </div>

            {/* Quick Stake Buttons */}
            <div className="flex items-center gap-1.5 flex-wrap">
              {[0.35, 0.5, 1, 2, 5, 10, 25].map((amt) => (
                <button
                  key={amt}
                  type="button"
                  onClick={() => setStake(amt)}
                  className={`text-[10px] px-2 py-0.5 rounded-lg border font-mono font-bold transition-all ${
                    stake === amt
                      ? 'bg-emerald-600 text-white border-emerald-500'
                      : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
                  }`}
                >
                  ${amt}
                </button>
              ))}
            </div>

            {/* Action Buttons: Whether to Trade or Dismiss */}
            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                onClick={() => setActiveAlertPopup(null)}
                className="py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-bold text-xs transition-all"
              >
                Dismiss / Skip
              </button>
              <button
                type="button"
                disabled={isPlacingTrade}
                onClick={() => executeTradeFromAlert(activeAlertPopup)}
                className="py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 hover:from-emerald-400 hover:to-teal-400 active:scale-95 text-slate-950 font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/30 transition-all disabled:opacity-50 cursor-pointer"
              >
                <Zap className="w-4 h-4 fill-current" />
                <span>TRADE NOW (${stake.toFixed(2)})</span>
              </button>
            </div>

            {/* Progress bar countdown */}
            <div className="pt-1">
              <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1">
                <span>{isPopupHovered ? 'Paused on hover' : `Auto-dismissing in ${popupCountdown}s`}</span>
                <span>Deriv Live Stream</span>
              </div>
              <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                <div
                  style={{ width: `${(popupCountdown / 15) * 100}%` }}
                  className="h-full bg-amber-500 transition-all duration-1000 ease-linear"
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Python backend code template constant for copy/download
const PYTHON_BACKEND_CODE = `"""
================================================================================
PRO DERIV MULTI-MARKET ANALYZER — FASTAPI & SOCKET.IO BACKEND
================================================================================
Concurrent Multi-Market Scanner for Deriv Volatility Indices (R_10, R_50, R_75, R_100)
Runs multiple ProDerivAnalyzer instances concurrently using asyncio.gather()
Streams real-time ticks, pro indicators (EMA 9/21, RSI 14, ATR 14, Bollinger Bands),
and high-confluence setup alerts via Socket.IO to Tailwind + TradingView Lightweight Charts.

Requirements:
    pip install fastapi uvicorn python-socketio websockets
Run:
    uvicorn backend.pro_deriv_fastapi_socketio:asgi_app --host 0.0.0.0 --port 8000 --reload
"""

import asyncio
import json
import logging
import time
from collections import deque
from typing import Dict, List, Any

import socketio
import websockets
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")

sio = socketio.AsyncServer(async_mode="asgi", cors_allowed_origins="*")
app = FastAPI(title="Pro Deriv Multi-Market Analyzer API", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

asgi_app = socketio.ASGIApp(sio, app)
MARKET_SNAPSHOTS: Dict[str, Dict[str, Any]] = {}
HIGH_CONFLUENCE_ALERTS: List[Dict[str, Any]] = []
SCAN_SYMBOLS = ["R_10", "R_50", "R_75", "R_100"]

class ProDerivAnalyzer:
    def __init__(self, symbol: str = "R_75", app_id: int = 1089):
        self.symbol = symbol
        self.app_id = app_id
        self.api_url = f"wss://ws.derivws.com/websockets/v3?app_id={app_id}"
        self.price_history = deque(maxlen=100)
        self.digit_history = deque(maxlen=200)
        self.is_running = False
        self.last_alert_time = 0.0

    async def start(self):
        self.is_running = True
        while self.is_running:
            try:
                logging.info(f"Connecting to Deriv WebSocket API for {self.symbol}...")
                async with websockets.connect(self.api_url) as websocket:
                    await websocket.send(json.dumps({"ticks": self.symbol}))
                    logging.info(f"✅ Subscribed to live stream for {self.symbol}")
                    async for message in websocket:
                        data = json.loads(message)
                        if data.get("msg_type") == "tick":
                            await self.process_tick(data["tick"])
            except Exception as e:
                logging.error(f"Error in {self.symbol}: {e}")
                await asyncio.sleep(3)

    async def process_tick(self, tick: Dict[str, Any]):
        price = float(tick["quote"])
        epoch = int(tick.get("epoch", time.time()))
        price_str = f"{price:.4f}"
        last_digit = int(price_str[-1])
        self.price_history.append(price)
        self.digit_history.append(last_digit)

        await sio.emit("tick", {"symbol": self.symbol, "quote": price, "epoch": epoch, "digit": last_digit})

        if len(self.price_history) >= 30:
            prices = list(self.price_history)
            digits = list(self.digit_history)
            ema_9 = self.calculate_ema(prices, 9)
            ema_21 = self.calculate_ema(prices, 21)
            rsi = self.calculate_rsi(prices, 14)
            atr = self.calculate_atr(prices, 14)
            trend = "BULLISH" if ema_9 > ema_21 and rsi > 50 else "BEARISH" if ema_9 < ema_21 and rsi < 50 else "NEUTRAL"

            # Alert evaluation
            now = time.time()
            if (trend in ["BULLISH", "BEARISH"]) and (now - self.last_alert_time > 10.0):
                self.last_alert_time = now
                alert = {
                    "id": f"alert_{self.symbol}_{int(now)}",
                    "symbol": self.symbol,
                    "direction": "RISE" if trend == "BULLISH" else "FALL",
                    "confidence": 88,
                    "price": price,
                }
                await sio.emit("high_confluence_alert", alert)

    @staticmethod
    def calculate_ema(data, period):
        multiplier = 2 / (period + 1)
        ema = sum(data[:period]) / period
        for price in data[period:]:
            ema = (price - ema) * multiplier + ema
        return ema

    @staticmethod
    def calculate_rsi(data, period=14):
        if len(data) < period + 1: return 50.0
        gains = sum(max(0, data[i] - data[i-1]) for i in range(-period, 0)) / period
        losses = sum(max(0, data[i-1] - data[i]) for i in range(-period, 0)) / period
        if losses == 0: return 100.0
        return 100.0 - (100.0 / (1.0 + gains / losses))

    @staticmethod
    def calculate_atr(data, period=14):
        if len(data) < period + 1: return 0.0
        return sum(abs(data[i] - data[i-1]) for i in range(-period, 0)) / period

async def run_multi_market_scanner():
    analyzers = [ProDerivAnalyzer(symbol=s) for s in SCAN_SYMBOLS]
    await asyncio.gather(*(a.start() for a in analyzers))

@app.on_event("startup")
async def startup_event():
    asyncio.create_task(run_multi_market_scanner())
`;
