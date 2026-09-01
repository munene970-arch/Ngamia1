import React, { useState, useEffect, useMemo, useRef } from 'react';
import { MarketInfo, MarketSymbol, ActiveContract, Tick } from '../../types/deriv';
import { derivWS, extractDerivLastDigit, formatDerivQuote, getMarketPipSize } from '../../services/derivWebSocket';
import { soundManager } from '../../utils/soundEffects';
import { AiScannerBotPanel } from './AiScannerBotPanel';
import { MatrixColdestDormancyBotPanel } from './MatrixColdestDormancyBotPanel';
import {
  Activity,
  TrendingUp,
  TrendingDown,
  Percent,
  Hash,
  Flame,
  Snowflake,
  Play,
  CheckCircle2,
  XCircle,
  Clock,
  RotateCcw,
  Zap,
  BarChart2,
  Table,
  Sliders,
  DollarSign,
  ShieldCheck,
  ChevronRight,
  ArrowUpRight,
  ArrowDownRight,
  Sparkles,
  Layers,
  Radio,
  Eye,
  RefreshCw,
  Bot,
  Radar,
} from 'lucide-react';

interface DerivDigitTraderProps {
  markets: MarketInfo[];
  balanceUsd: number;
  onUpdateBalance?: (newBalance: number) => void;
  initialSymbol?: MarketSymbol;
}

export type DerivTradeType = 'MATCH_DIFF' | 'EVEN_ODD' | 'OVER_UNDER' | 'RISE_FALL';

interface DigitStat {
  digit: number;
  count: number;
  percentage: number;
  isMax: boolean;
  isMin: boolean;
  isCurrent: boolean;
}

interface MarketMatrixRow {
  symbol: MarketSymbol;
  name: string;
  shortName: string;
  price: number;
  pipSize: number;
  lastDigit: number;
  change: number;
  hotDigit: number;
  hotPct: number;
  coldDigit: number;
  coldPct: number;
  coldCount: number;
  coldDormancy: number; // ticks since cold digit was last seen
  recentDigits: number[]; // last 7-8 digits for visual flow
  digitPercentages: number[];
  evenPct: number;
  oddPct: number;
  isSuperCold: boolean;
  isOneSecond: boolean;
}

export const DerivDigitTrader: React.FC<DerivDigitTraderProps> = ({
  markets,
  balanceUsd,
  onUpdateBalance,
  initialSymbol = 'R_100',
}) => {
  const [selectedSymbol, setSelectedSymbol] = useState<MarketSymbol>(initialSymbol);
  const [sampleSize, setSampleSize] = useState<number>(100);
  const [activeTab, setActiveTab] = useState<'trader' | 'ai_scanner' | 'matrix' | 'history'>('ai_scanner');
  const [tradeType, setTradeType] = useState<DerivTradeType>('MATCH_DIFF');

  // Trade inputs
  const [stake, setStake] = useState<number>(1.0);
  const [baseStakeManual, setBaseStakeManual] = useState<number>(1.0);
  const [autoCompoundOnWin, setAutoCompoundOnWin] = useState<boolean>(false);
  const [compoundReinvestPctManual, setCompoundReinvestPctManual] = useState<number>(100);
  const [maxStakeCapManual, setMaxStakeCapManual] = useState<number>(50.0);
  const [durationTicks, setDurationTicks] = useState<number>(1);
  const [targetDigit, setTargetDigit] = useState<number>(5);
  const [barrierDigit, setBarrierDigit] = useState<number>(4);

  // Matrix 1-Click Coldest Differ specific controls
  const [matrixStake, setMatrixStake] = useState<number>(1.0);
  const [matrixDurationTicks, setMatrixDurationTicks] = useState<number>(1);
  const [matrixScope, setMatrixScope] = useState<'ALL' | 'STANDARD' | '1S'>('ALL');
  const [matrixViewMode, setMatrixViewMode] = useState<'table' | 'cards'>('table');
  const [executingMatrixSymbol, setExecutingMatrixSymbol] = useState<string | null>(null);
  const [lastMatrixAction, setLastMatrixAction] = useState<{
    symbol: string;
    digit: number;
    time: number;
    label: string;
  } | null>(null);

  // Live state
  const [tickHistory, setTickHistory] = useState<number[]>([]);
  const [timeHistory, setTimeHistory] = useState<number[]>([]);
  const [currentQuote, setCurrentQuote] = useState<number>(0);
  const [priceChange, setPriceChange] = useState<number>(0);
  const [lastTickEpoch, setLastTickEpoch] = useState<number>(0);
  const [pingMs, setPingMs] = useState<number>(() => derivWS.getPingMs() || 25);
  const [activeContracts, setActiveContracts] = useState<ActiveContract[]>([]);
  const [tradeHistory, setTradeHistory] = useState<ActiveContract[]>([]);
  const [isPlacingTrade, setIsPlacingTrade] = useState<boolean>(false);
  const [tradeMessage, setTradeMessage] = useState<string | null>(null);

  // Multi-market matrix storage
  const [matrixData, setMatrixData] = useState<Record<string, number[]>>({});

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Market metadata
  const currentMarket = useMemo(() => {
    return (
      markets.find((m) => m.symbol === selectedSymbol) || {
        symbol: selectedSymbol,
        displayName: selectedSymbol,
        category: 'Volatility Indices',
        description: 'Synthetic Volatility Index',
        currentPrice: currentQuote,
        change24h: 0,
        isHighVolatility: false,
        minStake: 0.35,
        maxStake: 50000,
      }
    );
  }, [markets, selectedSymbol, currentQuote]);

  const pipSize = useMemo(() => getMarketPipSize(selectedSymbol), [selectedSymbol]);

  // Current Last Digit
  const currentLastDigit = useMemo(() => {
    if (tickHistory.length === 0 && currentQuote === 0) return 0;
    const latestPrice = tickHistory.length > 0 ? tickHistory[tickHistory.length - 1] : currentQuote;
    return extractDerivLastDigit(latestPrice, pipSize, selectedSymbol);
  }, [tickHistory, currentQuote, pipSize, selectedSymbol]);

  // Ping timer
  useEffect(() => {
    const timer = window.setInterval(() => {
      setPingMs(derivWS.getPingMs() || 25);
    }, 2000);
    return () => window.clearInterval(timer);
  }, []);

  // Subscribe to real ticks and ticks_history from Deriv WebSocket
  useEffect(() => {
    let isSubscribed = true;

    // Reset local state on market switch
    setTickHistory([]);
    setTimeHistory([]);
    setTradeMessage(null);

    const onHistory = (data: { symbol: MarketSymbol; prices: number[]; times: number[]; pipSize: number }) => {
      if (!isSubscribed || data.symbol !== selectedSymbol) return;
      if (data.prices && data.prices.length > 0) {
        const prices = data.prices;
        setTickHistory(prices);
        setTimeHistory(data.times || []);
        const last = prices[prices.length - 1];
        setCurrentQuote(last);
        if (prices.length > 1) {
          setPriceChange(last - prices[prices.length - 2]);
        }
      }
    };

    const onTick = (tick: Tick) => {
      if (!isSubscribed || tick.symbol !== selectedSymbol) return;
      setCurrentQuote(tick.quote);
      setPriceChange(tick.change ?? 0);
      setLastTickEpoch(tick.epoch);

      setTickHistory((prev) => {
        const updated = [...prev, tick.quote];
        return updated.slice(-1000);
      });

      setTimeHistory((prev) => {
        const updated = [...prev, tick.epoch];
        return updated.slice(-1000);
      });
    };

    derivWS.subscribeHistory(selectedSymbol, onHistory);
    derivWS.subscribeTicks(selectedSymbol, onTick);
    derivWS.requestTicksHistory(selectedSymbol, 1000);

    return () => {
      isSubscribed = false;
      derivWS.unsubscribeHistory(selectedSymbol, onHistory);
      derivWS.unsubscribeTicks(selectedSymbol, onTick);
    };
  }, [selectedSymbol]);

  // Track matrix market ticks for the multi-market overview
  useEffect(() => {
    const targetMarkets: MarketSymbol[] = [
      'R_10', 'R_25', 'R_50', 'R_75', 'R_100',
      '1HZ10V', '1HZ25V', '1HZ50V', '1HZ75V', '1HZ100V',
      '1HZ150V', '1HZ250V',
    ];

    const unsubscribers = targetMarkets.map((sym) => {
      const onHist = (data: { symbol: MarketSymbol; prices: number[] }) => {
        if (data.prices && data.prices.length > 0) {
          setMatrixData((prev) => ({ ...prev, [sym]: data.prices.slice(-100) }));
        }
      };
      const onTk = (tick: Tick) => {
        setMatrixData((prev) => {
          const existing = prev[sym] || [];
          return { ...prev, [sym]: [...existing, tick.quote].slice(-100) };
        });
      };

      derivWS.subscribeHistory(sym, onHist);
      derivWS.subscribeTicks(sym, onTk);
      derivWS.requestTicksHistory(sym, 100);

      return () => {
        derivWS.unsubscribeHistory(sym, onHist);
        derivWS.unsubscribeTicks(sym, onTk);
      };
    });

    return () => {
      unsubscribers.forEach((unsub) => unsub());
    };
  }, []);

  // Listen for contract completion
  useEffect(() => {
    const handleContract = (contract: ActiveContract) => {
      setActiveContracts((prev) => {
        const index = prev.findIndex((c) => c.id === contract.id);
        if (index >= 0) {
          const updated = [...prev];
          updated[index] = contract;
          return updated.filter((c) => c.status === 'OPEN');
        }
        if (contract.status === 'OPEN') {
          return [contract, ...prev];
        }
        return prev;
      });

      if (contract.status === 'WON' || contract.status === 'LOST') {
        setTradeHistory((prev) => {
          if (prev.some((c) => c.id === contract.id)) return prev;
          return [contract, ...prev.slice(0, 49)];
        });

        if (contract.status === 'WON') {
          soundManager.playWin();
          setTradeMessage(`✅ Contract ${contract.id.slice(-6)} WON! Profit: +$${contract.currentProfit.toFixed(2)}`);
          if (onUpdateBalance) onUpdateBalance(balanceUsd + contract.currentProfit);

          // Auto-Compound on win
          if (autoCompoundOnWin) {
            const reinvest = contract.currentProfit * (compoundReinvestPctManual / 100);
            setStake((prev) => {
              const next = Math.min(maxStakeCapManual > 0 ? maxStakeCapManual : 9999, prev + reinvest);
              return Number(Math.max(0.35, next).toFixed(2));
            });
          }
        } else {
          soundManager.playLoss();
          setTradeMessage(`❌ Contract ${contract.id.slice(-6)} LOST (-$${contract.stake.toFixed(2)})`);
          if (onUpdateBalance) onUpdateBalance(Math.max(0, balanceUsd - contract.stake));

          // Reset to base stake on loss to protect capital
          if (autoCompoundOnWin) {
            setStake(baseStakeManual);
          }
        }
      }
    };

    derivWS.subscribeContracts(handleContract);
    return () => derivWS.unsubscribeContracts(handleContract);
  }, [balanceUsd, onUpdateBalance, autoCompoundOnWin, compoundReinvestPctManual, maxStakeCapManual, baseStakeManual]);

  // Extract digits for active sample
  const samplePrices = useMemo(() => {
    if (tickHistory.length === 0) return [];
    return tickHistory.slice(-sampleSize);
  }, [tickHistory, sampleSize]);

  const sampleDigits = useMemo(() => {
    return samplePrices.map((price) => extractDerivLastDigit(price, pipSize, selectedSymbol));
  }, [samplePrices, pipSize, selectedSymbol]);

  // Exact Deriv Digit Percentages (0 - 9)
  const digitStats: DigitStat[] = useMemo(() => {
    const counts = new Array(10).fill(0);
    const total = sampleDigits.length;

    for (const d of sampleDigits) {
      if (d >= 0 && d <= 9) {
        counts[d]++;
      }
    }

    let maxCount = -1;
    let minCount = Infinity;

    if (total > 0) {
      for (let i = 0; i < 10; i++) {
        if (counts[i] > maxCount) maxCount = counts[i];
        if (counts[i] < minCount) minCount = counts[i];
      }
    }

    return counts.map((count, digit) => {
      const percentage = total > 0 ? Number(((count / total) * 100).toFixed(1)) : 10.0;
      return {
        digit,
        count,
        percentage,
        isMax: total > 0 && count === maxCount && maxCount > minCount,
        isMin: total > 0 && count === minCount && minCount < maxCount,
        isCurrent: digit === currentLastDigit,
      };
    });
  }, [sampleDigits, currentLastDigit]);

  // Highest and Lowest percentage digit
  const hotDigitStat = useMemo(() => {
    return [...digitStats].sort((a, b) => b.percentage - a.percentage)[0];
  }, [digitStats]);

  const coldDigitStat = useMemo(() => {
    return [...digitStats].sort((a, b) => a.percentage - b.percentage)[0];
  }, [digitStats]);

  // Even / Odd percentages
  const evenOddStats = useMemo(() => {
    const total = sampleDigits.length;
    if (total === 0) return { evenCount: 0, oddCount: 0, evenPct: 50.0, oddPct: 50.0 };

    let evenCount = 0;
    let oddCount = 0;
    for (const d of sampleDigits) {
      if (d % 2 === 0) evenCount++;
      else oddCount++;
    }

    const evenPct = Number(((evenCount / total) * 100).toFixed(1));
    const oddPct = Number(((oddCount / total) * 100).toFixed(1));
    return { evenCount, oddCount, evenPct, oddPct };
  }, [sampleDigits]);

  // Over / Under percentages based on barrier
  const overUnderStats = useMemo(() => {
    const total = sampleDigits.length;
    if (total === 0) return { overCount: 0, underCount: 0, overPct: 50.0, underPct: 50.0, equalCount: 0, equalPct: 0 };

    let overCount = 0;
    let underCount = 0;
    let equalCount = 0;

    for (const d of sampleDigits) {
      if (d > barrierDigit) overCount++;
      else if (d < barrierDigit) underCount++;
      else equalCount++;
    }

    const overPct = Number(((overCount / total) * 100).toFixed(1));
    const underPct = Number(((underCount / total) * 100).toFixed(1));
    const equalPct = Number(((equalCount / total) * 100).toFixed(1));
    return { overCount, underCount, overPct, underPct, equalCount, equalPct };
  }, [sampleDigits, barrierDigit]);

  // Match / Differ stats for chosen target digit
  const matchDiffStats = useMemo(() => {
    const total = sampleDigits.length;
    if (total === 0) return { matchCount: 0, diffCount: 0, matchPct: 10.0, diffPct: 90.0 };

    let matchCount = 0;
    for (const d of sampleDigits) {
      if (d === targetDigit) matchCount++;
    }
    const diffCount = total - matchCount;
    const matchPct = Number(((matchCount / total) * 100).toFixed(1));
    const diffPct = Number(((diffCount / total) * 100).toFixed(1));
    return { matchCount, diffCount, matchPct, diffPct };
  }, [sampleDigits, targetDigit]);

  // Recent 30 digits stream (Deriv Worm tape)
  const recentTapeDigits = useMemo(() => {
    const slice = samplePrices.slice(-25);
    return slice.map((price, idx) => {
      const digit = extractDerivLastDigit(price, pipSize, selectedSymbol);
      const prevPrice = idx > 0 ? slice[idx - 1] : price;
      const isUp = price >= prevPrice;
      return { digit, price, isUp, isEven: digit % 2 === 0 };
    });
  }, [samplePrices, pipSize, selectedSymbol]);

  // Draw real-time canvas chart
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.parentElement?.clientWidth || 600;
    const height = 180;
    canvas.width = width * window.devicePixelRatio;
    canvas.height = height * window.devicePixelRatio;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

    ctx.clearRect(0, 0, width, height);

    const prices = samplePrices.slice(-50);
    if (prices.length < 2) {
      ctx.fillStyle = '#64748b';
      ctx.font = '12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Awaiting real-time tick stream from Deriv WebSocket...', width / 2, height / 2);
      return;
    }

    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const range = maxPrice - minPrice || 1;
    const paddingY = 24;
    const chartHeight = height - paddingY * 2;

    const getX = (index: number) => (index / (prices.length - 1)) * (width - 60) + 20;
    const getY = (price: number) => height - paddingY - ((price - minPrice) / range) * chartHeight;

    // Background grid
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = paddingY + (i / 4) * chartHeight;
      ctx.beginPath();
      ctx.moveTo(20, y);
      ctx.lineTo(width - 40, y);
      ctx.stroke();

      const priceVal = maxPrice - (i / 4) * range;
      ctx.fillStyle = '#64748b';
      ctx.font = '10px monospace';
      ctx.textAlign = 'left';
      ctx.fillText(priceVal.toFixed(pipSize), width - 36, y + 3);
    }

    // Gradient fill
    const gradient = ctx.createLinearGradient(0, paddingY, 0, height);
    gradient.addColorStop(0, 'rgba(16, 185, 129, 0.25)');
    gradient.addColorStop(1, 'rgba(16, 185, 129, 0.0)');

    ctx.beginPath();
    ctx.moveTo(getX(0), height - paddingY);
    for (let i = 0; i < prices.length; i++) {
      ctx.lineTo(getX(i), getY(prices[i]));
    }
    ctx.lineTo(getX(prices.length - 1), height - paddingY);
    ctx.closePath();
    ctx.fillStyle = gradient;
    ctx.fill();

    // Price line
    ctx.beginPath();
    for (let i = 0; i < prices.length; i++) {
      const x = getX(i);
      const y = getY(prices[i]);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = '#10b981';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Last point pulse & digit marker
    const lastX = getX(prices.length - 1);
    const lastY = getY(prices[prices.length - 1]);

    ctx.beginPath();
    ctx.arc(lastX, lastY, 6, 0, Math.PI * 2);
    ctx.fillStyle = '#10b981';
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Last price badge
    const badgeText = `${prices[prices.length - 1].toFixed(pipSize)} [${currentLastDigit}]`;
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(lastX - 45, lastY - 26, 90, 18);
    ctx.strokeStyle = '#10b981';
    ctx.lineWidth = 1;
    ctx.strokeRect(lastX - 45, lastY - 26, 90, 18);

    ctx.fillStyle = '#34d399';
    ctx.font = 'bold 10px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(badgeText, lastX, lastY - 14);
  }, [samplePrices, pipSize, currentLastDigit]);

  // Execute trade function
  const handleExecuteTrade = async (contractType: string, customTargetDigit?: number, customBarrier?: number) => {
    if (isPlacingTrade) return;
    setIsPlacingTrade(true);
    soundManager.playStart();

    const selectedTarget = customTargetDigit !== undefined ? customTargetDigit : targetDigit;
    const selectedBar = customBarrier !== undefined ? customBarrier : barrierDigit;

    try {
      const contract = derivWS.purchaseContract({
        symbol: selectedSymbol,
        contractType,
        stake,
        durationTicks,
        targetDigit: ['DIGITMATCH', 'DIGITDIFF'].includes(contractType) ? selectedTarget : undefined,
        barrier: ['DIGITOVER', 'DIGITUNDER'].includes(contractType) ? selectedBar : undefined,
        symbolName: currentMarket.displayName,
      });

      setTradeMessage(`🚀 Contract placed on ${currentMarket.displayName} (${contractType}) ID: ${contract.id.slice(-6)}`);
    } catch (err: any) {
      console.error('Trade placement error:', err);
      soundManager.playLoss();
      setTradeMessage(`⚠️ Trade Failed: ${err.message || 'Network error'}`);
    } finally {
      setIsPlacingTrade(false);
    }
  };

  // ⚡ 1-Click Coldest Digit Differ Matrix Execution
  const handleMatrixTradeColdestDiffer = (row: MarketMatrixRow) => {
    if (isPlacingTrade) return;
    setIsPlacingTrade(true);
    setExecutingMatrixSymbol(row.symbol);
    soundManager.playStart();

    const targetColdDigit = row.coldDigit;
    setLastMatrixAction({
      symbol: row.symbol,
      digit: targetColdDigit,
      time: Date.now(),
      label: `Differ ≠ ${targetColdDigit} on ${row.shortName}`,
    });

    try {
      const contract = derivWS.purchaseContract({
        symbol: row.symbol,
        contractType: 'DIGITDIFF',
        stake: matrixStake,
        durationTicks: matrixDurationTicks,
        targetDigit: targetColdDigit,
        symbolName: row.name,
      });

      setTradeMessage(`🎯 [Matrix Trade] Differed Coldest Digit ${targetColdDigit} on ${row.name} (${row.coldPct}% freq, dormant ${row.coldDormancy}t, stake: $${matrixStake.toFixed(2)}) - ID: ${contract.id.slice(-6)}`);
    } catch (err: any) {
      console.error('Matrix trade placement error:', err);
      soundManager.playLoss();
      setTradeMessage(`⚠️ Matrix Trade Failed: ${err.message || 'Network error'}`);
    } finally {
      setTimeout(() => {
        setIsPlacingTrade(false);
        setExecutingMatrixSymbol(null);
      }, 400);
    }
  };

  // Multi-market matrix calculation
  const matrixRows: MarketMatrixRow[] = useMemo(() => {
    const list: MarketSymbol[] = [
      'R_10', 'R_25', 'R_50', 'R_75', 'R_100',
      '1HZ10V', '1HZ25V', '1HZ50V', '1HZ75V', '1HZ100V',
      '1HZ150V', '1HZ250V',
    ];

    const shortNames: Record<string, string> = {
      'R_10': 'Vol 10',
      'R_25': 'Vol 25',
      'R_50': 'Vol 50',
      'R_75': 'Vol 75',
      'R_100': 'Vol 100',
      '1HZ10V': 'Vol 10 (1s)',
      '1HZ25V': 'Vol 25 (1s)',
      '1HZ50V': 'Vol 50 (1s)',
      '1HZ75V': 'Vol 75 (1s)',
      '1HZ100V': 'Vol 100 (1s)',
      '1HZ150V': 'Vol 150 (1s)',
      '1HZ250V': 'Vol 250 (1s)',
    };

    return list.map((sym) => {
      const prices = matrixData[sym] || [];
      const mPip = getMarketPipSize(sym);
      const mName = markets.find((m) => m.symbol === sym)?.displayName || shortNames[sym] || sym;
      const sName = shortNames[sym] || sym;
      const isOneSecond = sym.startsWith('1HZ');
      const lastPrice = prices.length > 0 ? prices[prices.length - 1] : 0;
      const prevPrice = prices.length > 1 ? prices[prices.length - 2] : lastPrice;
      const change = lastPrice - prevPrice;
      const lastDigit = extractDerivLastDigit(lastPrice, mPip, sym);

      const digits = prices.map((p) => extractDerivLastDigit(p, mPip, sym));
      const total = digits.length || 1;
      const counts = new Array(10).fill(0);
      let evenCount = 0;
      let oddCount = 0;

      for (const d of digits) {
        if (d >= 0 && d <= 9) {
          counts[d]++;
          if (d % 2 === 0) evenCount++;
          else oddCount++;
        }
      }

      // Calculate dormancy (ticks since each digit was last seen)
      const dormancy = new Array(10).fill(0);
      for (let i = 0; i < 10; i++) {
        const lastIdx = digits.lastIndexOf(i);
        dormancy[i] = lastIdx >= 0 ? digits.length - 1 - lastIdx : (digits.length > 0 ? digits.length : 0);
      }

      // Calculate recent 25-tick counts to identify what is coldest RECENTLY
      const recent25 = digits.slice(-25);
      const counts25 = new Array(10).fill(0);
      for (const d of recent25) {
        if (d >= 0 && d <= 9) counts25[d]++;
      }

      // Find hottest digit
      let hotDigit = 0;
      let hotCount = -1;
      for (let i = 0; i < 10; i++) {
        if (counts[i] > hotCount) {
          hotCount = counts[i];
          hotDigit = i;
        }
      }

      // Identify the digit that has become the COLDEST RECENTLY
      // Multi-factor ranking:
      // 1. Lowest frequency in rolling sample (count in 100t)
      // 2. Lowest frequency in micro recent sample (count in 25t)
      // 3. Highest dormancy (number of ticks since last appearance)
      let coldDigit = 0;
      let minColdScore = Infinity;

      for (let i = 0; i < 10; i++) {
        // Lower coldScore = colder recently
        const coldScore = counts[i] * 2.0 + counts25[i] * 3.0 - (dormancy[i] * 0.15);
        if (coldScore < minColdScore) {
          minColdScore = coldScore;
          coldDigit = i;
        }
      }

      const coldCount = counts[coldDigit];
      const coldDormancy = dormancy[coldDigit];
      const hotPct = Number(((hotCount / total) * 100).toFixed(1));
      const coldPct = Number(((coldCount / total) * 100).toFixed(1));
      const evenPct = Number(((evenCount / total) * 100).toFixed(1));
      const oddPct = Number(((oddCount / total) * 100).toFixed(1));
      const digitPercentages = counts.map((c) => Number(((c / total) * 100).toFixed(1)));
      const isSuperCold = coldPct <= 5.0 || coldDormancy >= 15;
      const recentDigits = digits.slice(-8);

      return {
        symbol: sym,
        name: mName,
        shortName: sName,
        price: lastPrice,
        pipSize: mPip,
        lastDigit,
        change,
        hotDigit,
        hotPct,
        coldDigit,
        coldPct,
        coldCount,
        coldDormancy,
        recentDigits,
        digitPercentages,
        evenPct,
        oddPct,
        isSuperCold,
        isOneSecond,
      };
    });
  }, [matrixData, markets]);

  const filteredMatrixRows = useMemo(() => {
    if (matrixScope === 'STANDARD') {
      return matrixRows.filter((r) => !r.isOneSecond);
    }
    if (matrixScope === '1S') {
      return matrixRows.filter((r) => r.isOneSecond);
    }
    return matrixRows;
  }, [matrixRows, matrixScope]);

  return (
    <div className="space-y-4 text-slate-100 pb-12">
      {/* 🚀 TOP HEADER BAR: Real Deriv Tick & Market Status */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-xl backdrop-blur-md">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          {/* Market selector & Live Quote */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
                <Activity className="w-5 h-5 animate-pulse" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <select
                    id="select-deriv-digit-market"
                    value={selectedSymbol}
                    onChange={(e) => setSelectedSymbol(e.target.value as MarketSymbol)}
                    className="bg-slate-950 text-white font-bold text-base sm:text-lg rounded-xl px-3 py-1.5 border border-slate-700 hover:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 cursor-pointer"
                  >
                    <optgroup label="Continuous Volatility Indices">
                      <option value="R_10">Volatility 10 Index</option>
                      <option value="R_25">Volatility 25 Index</option>
                      <option value="R_50">Volatility 50 Index</option>
                      <option value="R_75">Volatility 75 Index</option>
                      <option value="R_100">Volatility 100 Index</option>
                    </optgroup>
                    <optgroup label="1-Second (1s) Volatility Indices">
                      <option value="1HZ10V">Volatility 10 (1s) Index</option>
                      <option value="1HZ25V">Volatility 25 (1s) Index</option>
                      <option value="1HZ50V">Volatility 50 (1s) Index</option>
                      <option value="1HZ75V">Volatility 75 (1s) Index</option>
                      <option value="1HZ100V">Volatility 100 (1s) Index</option>
                      <option value="1HZ150V">Volatility 150 (1s) Index</option>
                      <option value="1HZ250V">Volatility 250 (1s) Index</option>
                    </optgroup>
                  </select>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-mono border border-emerald-500/40">
                    Live Feed
                  </span>
                </div>
                <div className="text-xs text-slate-400 flex items-center gap-2 mt-0.5">
                  <span>Pip: {pipSize} decimals</span>
                  <span>•</span>
                  <span>Ping: <strong className="text-emerald-400">{pingMs}ms</strong></span>
                  <span>•</span>
                  <span>Ticks Cached: <strong className="text-cyan-400">{sampleDigits.length}</strong></span>
                </div>
              </div>
            </div>

            {/* Live Spot Quote Box */}
            <div className="flex items-center gap-2.5 px-4 py-2 bg-slate-950 rounded-xl border border-slate-800">
              <div>
                <div className="text-[10px] uppercase font-semibold text-slate-400">Current Spot</div>
                <div className="text-lg sm:text-xl font-mono font-black text-white flex items-center gap-1.5">
                  <span>{formatDerivQuote(currentQuote, pipSize, selectedSymbol)}</span>
                  {priceChange >= 0 ? (
                    <TrendingUp className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <TrendingDown className="w-4 h-4 text-rose-400" />
                  )}
                </div>
              </div>
              {/* Last Digit Hero Badge */}
              <div className="flex flex-col items-center justify-center px-3 py-1 bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 border border-emerald-500/50 rounded-lg">
                <span className="text-[9px] uppercase font-bold text-emerald-300">Last Digit</span>
                <span className="text-2xl font-black font-mono text-emerald-400 animate-pulse">{currentLastDigit}</span>
              </div>
            </div>
          </div>

          {/* Right Controls: Sample Size & Mode Tabs */}
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex items-center bg-slate-950 rounded-xl p-1 border border-slate-800">
              <span className="text-xs text-slate-400 font-semibold px-2">Sample:</span>
              {[
                { label: '100 Ticks', val: 100 },
                { label: '200 Ticks', val: 200 },
                { label: '500 Ticks', val: 500 },
                { label: '1000 Ticks', val: 1000 },
              ].map((s) => (
                <button
                  key={s.val}
                  onClick={() => setSampleSize(s.val)}
                  className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all ${
                    sampleSize === s.val
                      ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>

            {/* Sub-Tab Navigation */}
            <div className="flex items-center bg-slate-950 rounded-xl p-1 border border-slate-800">
              <button
                onClick={() => setActiveTab('ai_scanner')}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                  activeTab === 'ai_scanner'
                    ? 'bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 text-slate-950 shadow-md shadow-emerald-500/20 font-black'
                    : 'text-slate-400 hover:text-emerald-400'
                }`}
              >
                <Radar className="w-3.5 h-3.5" />
                <span>AI Scanner Bot</span>
                <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-emerald-950/80 text-emerald-300 border border-emerald-500/30">
                  Vol 10➔100
                </span>
              </button>
              <button
                onClick={() => setActiveTab('trader')}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                  activeTab === 'trader'
                    ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md shadow-emerald-500/20'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Percent className="w-3.5 h-3.5" />
                <span>Digit Trader</span>
              </button>
              <button
                onClick={() => setActiveTab('matrix')}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                  activeTab === 'matrix'
                    ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md shadow-emerald-500/20'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Table className="w-3.5 h-3.5" />
                <span>Market Matrix & 4T Bot</span>
                <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-emerald-500/20 text-emerald-300 font-mono border border-emerald-500/40">
                  4T BOT
                </span>
              </button>
              <button
                onClick={() => setActiveTab('history')}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                  activeTab === 'history'
                    ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md shadow-emerald-500/20'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Clock className="w-3.5 h-3.5" />
                <span>History ({tradeHistory.length})</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 🚀 STATUS BANNER / MESSAGES */}
      {tradeMessage && (
        <div className="p-3 bg-slate-900 border border-emerald-500/40 rounded-xl flex items-center justify-between text-xs text-slate-200">
          <span className="font-semibold">{tradeMessage}</span>
          <button onClick={() => setTradeMessage(null)} className="text-slate-400 hover:text-white font-bold">
            ✕
          </button>
        </div>
      )}

      {/* 🤖 AI SCANNER BOT PANEL (Vol 10 ➔ 100 Ascending with Red Bar Differ) */}
      {activeTab === 'ai_scanner' && (
        <AiScannerBotPanel balanceUsd={balanceUsd} onUpdateBalance={onUpdateBalance} />
      )}

      {activeTab === 'trader' && (
        <>
          {/* 📊 DERIV OFFICIAL DIGIT PERCENTAGES (0 - 9) DISTRIBUTION BARS */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Percent className="w-5 h-5 text-emerald-400" />
                  <span>Real Digit Percentage Distribution</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-mono font-normal">
                    Sample: {sampleDigits.length} Ticks
                  </span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Calculated precisely matching Deriv's official last digit frequency formula. Click any digit to set as target.
                </p>
              </div>

              {/* Hot & Cold Summary Badges */}
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-xs font-semibold text-emerald-300">
                  <Flame className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Hottest: <strong className="text-white font-mono">{hotDigitStat?.digit}</strong> ({hotDigitStat?.percentage}%)</span>
                </div>
                <div className="flex items-center gap-1.5 px-2.5 py-1 bg-rose-500/10 border border-rose-500/30 rounded-lg text-xs font-semibold text-rose-300">
                  <Snowflake className="w-3.5 h-3.5 text-rose-400" />
                  <span>Coldest: <strong className="text-white font-mono">{coldDigitStat?.digit}</strong> ({coldDigitStat?.percentage}%)</span>
                </div>
              </div>
            </div>

            {/* 10 Vertical Percentage Bars */}
            <div className="grid grid-cols-10 gap-1.5 sm:gap-2.5 pt-4 pb-2">
              {digitStats.map((item) => {
                const maxPct = Math.max(...digitStats.map((d) => d.percentage), 20);
                const heightPercent = Math.max(12, Math.min(100, (item.percentage / maxPct) * 100));

                let barColor = 'bg-slate-700 text-slate-200';
                let borderColor = 'border-slate-700';

                if (item.isMax) {
                  barColor = 'bg-gradient-to-t from-emerald-600 to-emerald-400 text-white';
                  borderColor = 'border-emerald-500 shadow-md shadow-emerald-500/20';
                } else if (item.isMin) {
                  barColor = 'bg-gradient-to-t from-rose-600 to-rose-400 text-white';
                  borderColor = 'border-rose-500 shadow-md shadow-rose-500/20';
                } else if (item.percentage >= 12) {
                  barColor = 'bg-cyan-600 text-white';
                }

                return (
                  <button
                    key={item.digit}
                    onClick={() => {
                      setTargetDigit(item.digit);
                      setBarrierDigit(item.digit);
                      soundManager.playButtonClick();
                    }}
                    className={`flex flex-col items-center justify-end group transition-all p-1.5 rounded-xl border ${
                      targetDigit === item.digit
                        ? 'bg-slate-800/90 border-emerald-500 ring-2 ring-emerald-500/40'
                        : item.isCurrent
                        ? 'bg-slate-800/60 border-cyan-500/60'
                        : 'bg-slate-950/60 border-slate-800/80 hover:border-slate-600'
                    }`}
                  >
                    {/* Current Indicator arrow */}
                    <div className="h-4 flex items-center justify-center">
                      {item.isCurrent && (
                        <span className="text-[10px] text-cyan-400 font-bold animate-bounce">▼</span>
                      )}
                    </div>

                    {/* Percentage Text on Top */}
                    <div className="text-[11px] sm:text-xs font-mono font-black mb-1.5">
                      <span className={item.isMax ? 'text-emerald-400' : item.isMin ? 'text-rose-400' : 'text-slate-200'}>
                        {item.percentage.toFixed(1)}%
                      </span>
                    </div>

                    {/* Vertical Bar Visual */}
                    <div className="w-full h-32 sm:h-36 bg-slate-950 rounded-lg p-1 flex flex-col justify-end overflow-hidden">
                      <div
                        style={{ height: `${heightPercent}%` }}
                        className={`w-full rounded-md transition-all duration-300 flex items-start justify-center pt-1 ${barColor}`}
                      >
                        <span className="text-[9px] font-mono font-bold opacity-80">{item.count}</span>
                      </div>
                    </div>

                    {/* Digit Bottom Button */}
                    <div
                      className={`mt-2 w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center font-mono font-black text-sm sm:text-base border transition-all ${
                        targetDigit === item.digit
                          ? 'bg-emerald-500 text-white border-emerald-400 shadow-md shadow-emerald-500/40'
                          : item.isCurrent
                          ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/50'
                          : 'bg-slate-900 text-slate-300 border-slate-700 group-hover:border-slate-500'
                      }`}
                    >
                      {item.digit}
                    </div>

                    {/* Max / Min Tag */}
                    <div className="h-4 flex items-center justify-center mt-1">
                      {item.isMax && <span className="text-[8px] uppercase font-bold text-emerald-400">MAX</span>}
                      {item.isMin && <span className="text-[8px] uppercase font-bold text-rose-400">MIN</span>}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 📈 REAL TICK CHART & LIVE TAPE STREAM */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Real Tick Canvas Chart (2 Columns) */}
            <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xl flex flex-col justify-between">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <BarChart2 className="w-4 h-4 text-emerald-400" />
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                    Real Tick Feed Movement
                  </span>
                </div>
                <div className="text-xs text-slate-400 font-mono">
                  Current: <strong className="text-white">{formatDerivQuote(currentQuote, pipSize, selectedSymbol)}</strong>
                </div>
              </div>

              <div className="w-full relative h-[180px] bg-slate-950/80 rounded-xl overflow-hidden border border-slate-800/80 flex items-center justify-center">
                <canvas ref={canvasRef} className="w-full h-full block" />
              </div>

              {/* Tape of recent 25 digits (Deriv Worm) */}
              <div className="mt-3">
                <div className="text-[11px] font-semibold text-slate-400 mb-1.5 flex items-center justify-between">
                  <span>Recent Digits Tape (Last {recentTapeDigits.length} Ticks)</span>
                  <span className="text-[10px] text-slate-500">Left = Older ➔ Right = Latest</span>
                </div>
                <div className="flex items-center gap-1 overflow-x-auto py-1 scrollbar-thin">
                  {recentTapeDigits.map((item, idx) => {
                    const isLatest = idx === recentTapeDigits.length - 1;
                    return (
                      <div
                        key={idx}
                        className={`shrink-0 w-7 h-7 rounded-lg flex items-center justify-center font-mono font-bold text-xs border transition-all ${
                          isLatest
                            ? 'bg-emerald-500 text-white border-emerald-400 ring-2 ring-emerald-400/50 scale-110'
                            : item.isEven
                            ? 'bg-blue-950/80 text-blue-300 border-blue-800/60'
                            : 'bg-amber-950/80 text-amber-300 border-amber-800/60'
                        }`}
                        title={`Quote: ${item.price.toFixed(pipSize)} (${item.isUp ? 'UP' : 'DOWN'})`}
                      >
                        {item.digit}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Even / Odd & Over / Under Stats Panel (1 Column) */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xl flex flex-col justify-between space-y-4">
              {/* Even vs Odd Meter */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">Even vs Odd Ratio</span>
                  <span className="text-xs text-slate-400 font-mono">Sample: {sampleDigits.length}</span>
                </div>
                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold">
                    <span className="text-blue-400">EVEN ({evenOddStats.evenCount})</span>
                    <span className="text-amber-400">ODD ({evenOddStats.oddCount})</span>
                  </div>
                  <div className="h-3 w-full bg-slate-800 rounded-full overflow-hidden flex">
                    <div style={{ width: `${evenOddStats.evenPct}%` }} className="bg-blue-500 transition-all" />
                    <div style={{ width: `${evenOddStats.oddPct}%` }} className="bg-amber-500 transition-all" />
                  </div>
                  <div className="flex items-center justify-between text-xs font-mono font-black">
                    <span className="text-blue-300">{evenOddStats.evenPct}%</span>
                    <span className="text-amber-300">{evenOddStats.oddPct}%</span>
                  </div>
                </div>
              </div>

              {/* Over vs Under Barrier Meter */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">Over vs Under (Barrier: {barrierDigit})</span>
                  <div className="flex items-center gap-1">
                    {[2, 4, 5, 7].map((b) => (
                      <button
                        key={b}
                        onClick={() => setBarrierDigit(b)}
                        className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${
                          barrierDigit === b ? 'bg-emerald-600 text-white border-emerald-500' : 'bg-slate-950 text-slate-400 border-slate-800'
                        }`}
                      >
                        {b}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold">
                    <span className="text-emerald-400">OVER &gt; {barrierDigit} ({overUnderStats.overCount})</span>
                    <span className="text-rose-400">UNDER &lt; {barrierDigit} ({overUnderStats.underCount})</span>
                  </div>
                  <div className="h-3 w-full bg-slate-800 rounded-full overflow-hidden flex">
                    <div style={{ width: `${overUnderStats.overPct}%` }} className="bg-emerald-500 transition-all" />
                    <div style={{ width: `${overUnderStats.equalPct}%` }} className="bg-slate-600 transition-all" />
                    <div style={{ width: `${overUnderStats.underPct}%` }} className="bg-rose-500 transition-all" />
                  </div>
                  <div className="flex items-center justify-between text-xs font-mono font-black">
                    <span className="text-emerald-300">{overUnderStats.overPct}%</span>
                    <span className="text-slate-400 text-[10px]">Eq: {overUnderStats.equalPct}%</span>
                    <span className="text-rose-300">{overUnderStats.underPct}%</span>
                  </div>
                </div>
              </div>

              {/* Match vs Differ for Target Digit */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">Matches / Differs (Target: {targetDigit})</span>
                  <span className="text-xs font-mono text-emerald-400 font-bold">Diff Payout: +9.8%</span>
                </div>
                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between">
                  <div>
                    <div className="text-[10px] text-slate-400 uppercase font-semibold">Differs (≠ {targetDigit})</div>
                    <div className="text-base font-black font-mono text-emerald-400">{matchDiffStats.diffPct}%</div>
                    <div className="text-[10px] text-slate-500">{matchDiffStats.diffCount} / {sampleDigits.length} Ticks</div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] text-slate-400 uppercase font-semibold">Matches (= {targetDigit})</div>
                    <div className="text-base font-black font-mono text-rose-400">{matchDiffStats.matchPct}%</div>
                    <div className="text-[10px] text-slate-500">{matchDiffStats.matchCount} / {sampleDigits.length} Ticks</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 🎮 DERIV INTERACTIVE TRADE EXECUTION CONSOLE */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-3 border-b border-slate-800">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Zap className="w-5 h-5 text-amber-400" />
                  <span>Deriv Trade Execution Console</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Place real trades on {currentMarket.displayName} directly via Deriv WebSocket.
                </p>
              </div>

              {/* Trade Type Switcher */}
              <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 overflow-x-auto">
                {[
                  { id: 'MATCH_DIFF', label: 'Matches / Differs' },
                  { id: 'EVEN_ODD', label: 'Even / Odd' },
                  { id: 'OVER_UNDER', label: 'Over / Under' },
                  { id: 'RISE_FALL', label: 'Rise / Fall' },
                ].map((t) => (
                  <button
                    key={t.id}
                    onClick={() => {
                      setTradeType(t.id as DerivTradeType);
                      soundManager.playButtonClick();
                    }}
                    className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all shrink-0 ${
                      tradeType === t.id
                        ? 'bg-emerald-600 text-white shadow-md shadow-emerald-500/20'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Input Controls & Parameters */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 mb-4">
              {/* Stake input */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-400">Stake (USD)</label>
                  <button
                    type="button"
                    onClick={() => setAutoCompoundOnWin(!autoCompoundOnWin)}
                    className={`text-[10px] px-2 py-0.5 rounded-md font-bold transition-all ${
                      autoCompoundOnWin
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                        : 'bg-slate-900 text-slate-400 border border-slate-800 hover:text-slate-200'
                    }`}
                  >
                    {autoCompoundOnWin ? '🔄 Auto-Compound ON' : 'Compound: OFF'}
                  </button>
                </div>
                <div className="relative">
                  <DollarSign className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="number"
                    step="0.1"
                    min="0.35"
                    value={stake}
                    onChange={(e) => {
                      const val = Math.max(0.35, parseFloat(e.target.value) || 0.35);
                      setStake(val);
                      setBaseStakeManual(val);
                    }}
                    className="w-full bg-slate-950 text-white font-mono font-bold text-sm rounded-xl pl-9 pr-3 py-2 border border-slate-800 focus:border-emerald-500 focus:outline-none"
                  />
                </div>
                <div className="flex items-center gap-1 mt-1.5 flex-wrap">
                  {[0.5, 1, 2, 5, 10].map((s) => (
                    <button
                      key={s}
                      onClick={() => {
                        setStake(s);
                        setBaseStakeManual(s);
                      }}
                      className="text-[10px] px-1.5 py-0.5 rounded bg-slate-950 border border-slate-800 text-slate-400 hover:text-white"
                    >
                      ${s}
                    </button>
                  ))}
                  <button
                    onClick={() => setStake((prev) => Number((prev * 2).toFixed(2)))}
                    title="Double stake"
                    className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-950/60 border border-indigo-800/80 text-indigo-300 hover:text-white font-bold"
                  >
                    2x
                  </button>
                  <button
                    onClick={() => setStake((prev) => Number(Math.max(0.35, prev / 2).toFixed(2)))}
                    title="Half stake"
                    className="text-[10px] px-1.5 py-0.5 rounded bg-slate-950 border border-slate-800 text-slate-400 hover:text-white font-bold"
                  >
                    ½
                  </button>
                  <button
                    onClick={() => setStake(baseStakeManual)}
                    title="Reset to base stake"
                    className="text-[10px] px-1.5 py-0.5 rounded bg-rose-950/40 border border-rose-800/60 text-rose-300 hover:text-white font-bold"
                  >
                    Reset
                  </button>
                </div>

                {autoCompoundOnWin && (
                  <div className="mt-2 p-2 rounded-lg bg-emerald-950/40 border border-emerald-900/60 text-[11px] space-y-1">
                    <div className="flex items-center justify-between text-emerald-300">
                      <span>Reinvest Profit:</span>
                      <select
                        value={compoundReinvestPctManual}
                        onChange={(e) => setCompoundReinvestPctManual(parseInt(e.target.value, 10))}
                        className="bg-slate-950 border border-emerald-800/60 rounded px-1.5 py-0.5 text-xs text-emerald-300 font-bold"
                      >
                        <option value={100}>100% (Full Compound)</option>
                        <option value={75}>75%</option>
                        <option value={50}>50% (Half Compound)</option>
                        <option value={30}>30%</option>
                      </select>
                    </div>
                    <div className="flex items-center justify-between text-slate-400">
                      <span>Max Cap:</span>
                      <input
                        type="number"
                        min="1"
                        value={maxStakeCapManual}
                        onChange={(e) => setMaxStakeCapManual(parseFloat(e.target.value) || 50)}
                        className="w-16 bg-slate-950 border border-slate-800 rounded px-1 text-xs text-white text-right font-mono"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Duration Ticks */}
              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">Duration (Ticks)</label>
                <select
                  value={durationTicks}
                  onChange={(e) => setDurationTicks(parseInt(e.target.value, 10))}
                  className="w-full bg-slate-950 text-white font-mono font-bold text-sm rounded-xl px-3 py-2 border border-slate-800 focus:border-emerald-500 focus:outline-none"
                >
                  {[1, 2, 3, 5, 7, 10].map((t) => (
                    <option key={t} value={t}>
                      {t} Tick{t > 1 ? 's' : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Target / Barrier Digit */}
              {['MATCH_DIFF'].includes(tradeType) && (
                <div>
                  <label className="text-xs font-semibold text-slate-400 block mb-1">Prediction Digit (0 - 9)</label>
                  <select
                    value={targetDigit}
                    onChange={(e) => setTargetDigit(parseInt(e.target.value, 10))}
                    className="w-full bg-slate-950 text-white font-mono font-bold text-sm rounded-xl px-3 py-2 border border-slate-800 focus:border-emerald-500 focus:outline-none"
                  >
                    {new Array(10).fill(0).map((_, d) => (
                      <option key={d} value={d}>
                        Digit {d} ({digitStats[d]?.percentage || 10}%)
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {['OVER_UNDER'].includes(tradeType) && (
                <div>
                  <label className="text-xs font-semibold text-slate-400 block mb-1">Barrier Digit (0 - 9)</label>
                  <select
                    value={barrierDigit}
                    onChange={(e) => setBarrierDigit(parseInt(e.target.value, 10))}
                    className="w-full bg-slate-950 text-white font-mono font-bold text-sm rounded-xl px-3 py-2 border border-slate-800 focus:border-emerald-500 focus:outline-none"
                  >
                    {new Array(10).fill(0).map((_, d) => (
                      <option key={d} value={d}>
                        Barrier {d}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Account Balance */}
              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">Available Balance</label>
                <div className="w-full bg-slate-950/80 rounded-xl px-3 py-2 border border-slate-800/80 flex items-center justify-between">
                  <span className="text-xs text-slate-400">USD</span>
                  <span className="font-mono font-black text-sm text-emerald-400">${balanceUsd.toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* Purchase Action Buttons per Contract Type */}
            <div className="pt-2">
              {tradeType === 'MATCH_DIFF' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* DIFFERS BUTTON (Higher Win Probability) */}
                  <button
                    disabled={isPlacingTrade}
                    onClick={() => handleExecuteTrade('DIGITDIFF')}
                    className="p-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 active:scale-[0.99] text-white font-bold transition-all shadow-lg shadow-emerald-500/20 disabled:opacity-50 flex items-center justify-between"
                  >
                    <div className="text-left">
                      <div className="text-base font-black flex items-center gap-1.5">
                        <span>DIFFERS</span>
                        <span className="text-xs px-2 py-0.5 bg-emerald-950/80 text-emerald-300 rounded-md font-mono">
                          ≠ {targetDigit}
                        </span>
                      </div>
                      <div className="text-xs text-emerald-100/80 mt-0.5">
                        Wins if exit digit is not {targetDigit} (Win rate ~90%)
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs uppercase font-semibold text-emerald-200">Payout: +9.8%</div>
                      <div className="text-base font-mono font-black text-white">+${(stake * 0.098).toFixed(2)}</div>
                    </div>
                  </button>

                  {/* MATCHES BUTTON (High Payout) */}
                  <button
                    disabled={isPlacingTrade}
                    onClick={() => handleExecuteTrade('DIGITMATCH')}
                    className="p-4 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 active:scale-[0.99] text-white font-bold transition-all shadow-lg shadow-cyan-500/20 disabled:opacity-50 flex items-center justify-between"
                  >
                    <div className="text-left">
                      <div className="text-base font-black flex items-center gap-1.5">
                        <span>MATCHES</span>
                        <span className="text-xs px-2 py-0.5 bg-cyan-950/80 text-cyan-300 rounded-md font-mono">
                          = {targetDigit}
                        </span>
                      </div>
                      <div className="text-xs text-cyan-100/80 mt-0.5">
                        Wins if exit digit equals {targetDigit} (Payout ~809%)
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs uppercase font-semibold text-cyan-200">Payout: ~809%</div>
                      <div className="text-base font-mono font-black text-white">+${(stake * 8.09).toFixed(2)}</div>
                    </div>
                  </button>
                </div>
              )}

              {tradeType === 'EVEN_ODD' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* EVEN BUTTON */}
                  <button
                    disabled={isPlacingTrade}
                    onClick={() => handleExecuteTrade('DIGITEVEN')}
                    className="p-4 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 active:scale-[0.99] text-white font-bold transition-all shadow-lg shadow-blue-500/20 disabled:opacity-50 flex items-center justify-between"
                  >
                    <div className="text-left">
                      <div className="text-base font-black">EVEN DIGIT</div>
                      <div className="text-xs text-blue-100/80 mt-0.5">Wins on 0, 2, 4, 6, 8 ({evenOddStats.evenPct}%)</div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs uppercase font-semibold text-blue-200">Payout: +96%</div>
                      <div className="text-base font-mono font-black text-white">+${(stake * 0.96).toFixed(2)}</div>
                    </div>
                  </button>

                  {/* ODD BUTTON */}
                  <button
                    disabled={isPlacingTrade}
                    onClick={() => handleExecuteTrade('DIGITODD')}
                    className="p-4 rounded-xl bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 active:scale-[0.99] text-white font-bold transition-all shadow-lg shadow-amber-500/20 disabled:opacity-50 flex items-center justify-between"
                  >
                    <div className="text-left">
                      <div className="text-base font-black">ODD DIGIT</div>
                      <div className="text-xs text-amber-100/80 mt-0.5">Wins on 1, 3, 5, 7, 9 ({evenOddStats.oddPct}%)</div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs uppercase font-semibold text-amber-200">Payout: +96%</div>
                      <div className="text-base font-mono font-black text-white">+${(stake * 0.96).toFixed(2)}</div>
                    </div>
                  </button>
                </div>
              )}

              {tradeType === 'OVER_UNDER' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* OVER BUTTON */}
                  <button
                    disabled={isPlacingTrade}
                    onClick={() => handleExecuteTrade('DIGITOVER')}
                    className="p-4 rounded-xl bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 active:scale-[0.99] text-white font-bold transition-all shadow-lg shadow-emerald-500/20 disabled:opacity-50 flex items-center justify-between"
                  >
                    <div className="text-left">
                      <div className="text-base font-black">OVER {barrierDigit}</div>
                      <div className="text-xs text-emerald-100/80 mt-0.5">Wins on digits &gt; {barrierDigit} ({overUnderStats.overPct}%)</div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs uppercase font-semibold text-emerald-200">Payout</div>
                      <div className="text-base font-mono font-black text-white">Dynamic</div>
                    </div>
                  </button>

                  {/* UNDER BUTTON */}
                  <button
                    disabled={isPlacingTrade}
                    onClick={() => handleExecuteTrade('DIGITUNDER')}
                    className="p-4 rounded-xl bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 active:scale-[0.99] text-white font-bold transition-all shadow-lg shadow-rose-500/20 disabled:opacity-50 flex items-center justify-between"
                  >
                    <div className="text-left">
                      <div className="text-base font-black">UNDER {barrierDigit}</div>
                      <div className="text-xs text-rose-100/80 mt-0.5">Wins on digits &lt; {barrierDigit} ({overUnderStats.underPct}%)</div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs uppercase font-semibold text-rose-200">Payout</div>
                      <div className="text-base font-mono font-black text-white">Dynamic</div>
                    </div>
                  </button>
                </div>
              )}

              {tradeType === 'RISE_FALL' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* RISE BUTTON */}
                  <button
                    disabled={isPlacingTrade}
                    onClick={() => handleExecuteTrade('CALL')}
                    className="p-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 active:scale-[0.99] text-white font-bold transition-all shadow-lg shadow-emerald-500/20 disabled:opacity-50 flex items-center justify-between"
                  >
                    <div className="text-left">
                      <div className="text-base font-black flex items-center gap-1.5">
                        <ArrowUpRight className="w-5 h-5" />
                        <span>RISE / HIGHER</span>
                      </div>
                      <div className="text-xs text-emerald-100/80 mt-0.5">Wins if exit spot &gt; entry spot</div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs uppercase font-semibold text-emerald-200">Payout: +95%</div>
                      <div className="text-base font-mono font-black text-white">+${(stake * 0.95).toFixed(2)}</div>
                    </div>
                  </button>

                  {/* FALL BUTTON */}
                  <button
                    disabled={isPlacingTrade}
                    onClick={() => handleExecuteTrade('PUT')}
                    className="p-4 rounded-xl bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 active:scale-[0.99] text-white font-bold transition-all shadow-lg shadow-rose-500/20 disabled:opacity-50 flex items-center justify-between"
                  >
                    <div className="text-left">
                      <div className="text-base font-black flex items-center gap-1.5">
                        <ArrowDownRight className="w-5 h-5" />
                        <span>FALL / LOWER</span>
                      </div>
                      <div className="text-xs text-rose-100/80 mt-0.5">Wins if exit spot &lt; entry spot</div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs uppercase font-semibold text-rose-200">Payout: +95%</div>
                      <div className="text-base font-mono font-black text-white">+${(stake * 0.95).toFixed(2)}</div>
                    </div>
                  </button>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* 📊 MULTI-MARKET MATRIX SCANNER TAB */}
      {activeTab === 'matrix' && (
        <div className="space-y-4">
          {/* 🤖 Automated 4-Tick Cold Dormancy Matrix Bot */}
          <MatrixColdestDormancyBotPanel
            matrixRows={matrixRows}
            matrixData={matrixData}
            balanceUsd={balanceUsd}
            onUpdateBalance={onUpdateBalance}
            onManualTradeDiffer={handleMatrixTradeColdestDiffer}
          />

          {/* ⚡ 1-Click Multi-Market Scanner Table / Cards */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xl space-y-4">
            {/* Header & Quick Controls */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-3 border-b border-slate-800">
            <div>
              <div className="flex items-center gap-2">
                <Table className="w-5 h-5 text-emerald-400" />
                <h3 className="text-base font-bold text-white">
                  Multi-Market Real Digit Matrix (1-Click Coldest Differ Sniper)
                </h3>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-mono font-bold border border-emerald-500/40">
                  LIVE 1-CLICK DIFFER
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Real-time frequency & dormancy scanner. Click ANY market row or coldest badge to instantly execute a <strong className="text-emerald-400">Differ</strong> contract on the digit that is currently the coldest recently.
              </p>
            </div>

            {/* Quick Stake & Duration Bar */}
            <div className="flex flex-wrap items-center gap-2.5 bg-slate-950 p-2.5 rounded-xl border border-slate-800">
              {/* Stake input */}
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-semibold text-slate-400">Stake:</span>
                <div className="relative">
                  <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-500 text-xs font-mono font-bold">$</span>
                  <input
                    type="number"
                    min="0.35"
                    step="0.5"
                    value={matrixStake}
                    onChange={(e) => setMatrixStake(Math.max(0.35, parseFloat(e.target.value) || 0.35))}
                    className="w-20 bg-slate-900 text-white font-mono font-bold text-xs rounded-lg pl-5 pr-1.5 py-1 border border-slate-700 focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Stake Presets */}
              <div className="flex items-center gap-1">
                {[0.35, 1, 2, 5, 10, 50].map((amt) => (
                  <button
                    key={amt}
                    onClick={() => setMatrixStake(amt)}
                    className={`px-1.5 py-1 rounded text-[10px] font-mono font-bold transition-all ${
                      matrixStake === amt
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                    }`}
                  >
                    ${amt}
                  </button>
                ))}
              </div>

              {/* Duration selector */}
              <div className="flex items-center gap-1.5 border-l border-slate-800 pl-2">
                <span className="text-xs font-semibold text-slate-400">Duration:</span>
                <select
                  value={matrixDurationTicks}
                  onChange={(e) => setMatrixDurationTicks(parseInt(e.target.value, 10))}
                  className="bg-slate-900 text-white font-mono font-bold text-xs rounded-lg px-2 py-1 border border-slate-700 focus:outline-none"
                >
                  <option value={1}>1 Tick</option>
                  <option value={2}>2 Ticks</option>
                  <option value={3}>3 Ticks</option>
                  <option value={5}>5 Ticks</option>
                </select>
              </div>

              {/* Refresh button */}
              <button
                onClick={() => {
                  matrixRows.forEach((r) => derivWS.requestTicksHistory(r.symbol, 100));
                }}
                title="Refresh ticks history"
                className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* 🎯 1-Click Action & Filter Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 p-3 rounded-xl bg-gradient-to-r from-emerald-950/40 via-teal-950/30 to-slate-950 border border-emerald-500/30">
            <div className="flex items-center gap-2">
              <span className="flex h-2.5 w-2.5 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
              </span>
              <span className="text-xs font-bold text-emerald-300">
                ⚡ 1-Click Sniper Active:
              </span>
              <span className="text-xs text-slate-300">
                Click any market row or "Differ Coldest" to instantly place a <strong className="text-white">Differ {matrixDurationTicks}T</strong> contract (Win Rate ~90%, Payout +9.8%).
              </span>
            </div>

            {/* Scope Filter & View Mode */}
            <div className="flex items-center gap-2 self-end sm:self-auto">
              <div className="flex items-center bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs font-semibold">
                <button
                  onClick={() => setMatrixScope('ALL')}
                  className={`px-2 py-0.5 rounded ${
                    matrixScope === 'ALL' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  All ({matrixRows.length})
                </button>
                <button
                  onClick={() => setMatrixScope('STANDARD')}
                  className={`px-2 py-0.5 rounded ${
                    matrixScope === 'STANDARD' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Standard 10-100
                </button>
                <button
                  onClick={() => setMatrixScope('1S')}
                  className={`px-2 py-0.5 rounded ${
                    matrixScope === '1S' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  1-Second
                </button>
              </div>

              <div className="flex items-center bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs font-semibold">
                <button
                  onClick={() => setMatrixViewMode('table')}
                  className={`px-2 py-0.5 rounded ${
                    matrixViewMode === 'table' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Table
                </button>
                <button
                  onClick={() => setMatrixViewMode('cards')}
                  className={`px-2 py-0.5 rounded ${
                    matrixViewMode === 'cards' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Cards
                </button>
              </div>
            </div>
          </div>

          {/* TABLE VIEW */}
          {matrixViewMode === 'table' && (
            <div className="overflow-x-auto rounded-xl border border-slate-800">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950 text-slate-400 uppercase font-semibold border-b border-slate-800">
                  <tr>
                    <th className="py-3 px-3.5">Market</th>
                    <th className="py-3 px-3.5">Live Spot</th>
                    <th className="py-3 px-3 text-center">Last Digit</th>
                    <th className="py-3 px-3.5">Recent Stream (Tape)</th>
                    <th className="py-3 px-3.5">Hottest Digit</th>
                    <th className="py-3 px-3.5">
                      <div className="flex items-center gap-1 text-rose-400">
                        <Snowflake className="w-3.5 h-3.5" />
                        <span>Coldest Digit Recently</span>
                      </div>
                    </th>
                    <th className="py-3 px-3.5">Even vs Odd</th>
                    <th className="py-3 px-3.5 text-right">1-Click Differ Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono">
                  {filteredMatrixRows.map((row) => {
                    const isExecuting = executingMatrixSymbol === row.symbol;
                    const isLastAction = lastMatrixAction?.symbol === row.symbol && Date.now() - lastMatrixAction.time < 3000;

                    return (
                      <tr
                        key={row.symbol}
                        onClick={() => handleMatrixTradeColdestDiffer(row)}
                        title={`Click to execute DIGITDIFF on coldest digit ${row.coldDigit} for ${row.name}`}
                        className={`cursor-pointer transition-all duration-200 group select-none ${
                          isExecuting
                            ? 'bg-emerald-950/60 ring-2 ring-emerald-400 animate-pulse'
                            : isLastAction
                            ? 'bg-emerald-950/40 border-l-4 border-l-emerald-400'
                            : 'hover:bg-slate-800/60 active:bg-emerald-950/30'
                        }`}
                      >
                        {/* Market Name */}
                        <td className="py-3 px-3.5 font-bold font-sans text-white">
                          <div className="flex items-center gap-2">
                            <span>{row.name}</span>
                            {row.isOneSecond && (
                              <span className="text-[9px] px-1.5 py-0.2 rounded bg-indigo-500/20 text-indigo-300 font-mono">
                                1s
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Current Price */}
                        <td className="py-3 px-3.5 font-mono">
                          <div className="flex items-center gap-1.5">
                            <span className={row.change >= 0 ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                              {formatDerivQuote(row.price, row.pipSize, row.symbol)}
                            </span>
                            {row.change >= 0 ? (
                              <ArrowUpRight className="w-3 h-3 text-emerald-400" />
                            ) : (
                              <ArrowDownRight className="w-3 h-3 text-rose-400" />
                            )}
                          </div>
                        </td>

                        {/* Last Digit */}
                        <td className="py-3 px-3 text-center">
                          <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 font-black text-sm">
                            {row.lastDigit}
                          </span>
                        </td>

                        {/* Recent Digits Tape */}
                        <td className="py-3 px-3.5">
                          <div className="flex items-center gap-1 font-mono text-[11px]">
                            {row.recentDigits.length > 0 ? (
                              row.recentDigits.map((d, idx, arr) => {
                                const isLast = idx === arr.length - 1;
                                const isCold = d === row.coldDigit;
                                return (
                                  <span
                                    key={idx}
                                    className={`w-5 h-5 rounded flex items-center justify-center font-bold text-[10px] ${
                                      isLast
                                        ? 'bg-cyan-500/30 text-cyan-300 border border-cyan-400/50'
                                        : isCold
                                        ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                                        : 'bg-slate-800 text-slate-400'
                                    }`}
                                  >
                                    {d}
                                  </span>
                                );
                              })
                            ) : (
                              <span className="text-slate-500 text-[10px]">Loading...</span>
                            )}
                          </div>
                        </td>

                        {/* Hottest Digit */}
                        <td className="py-3 px-3.5">
                          <span className="inline-flex items-center gap-1 text-emerald-400 font-bold">
                            <Flame className="w-3.5 h-3.5 text-orange-400" />
                            <span>Digit {row.hotDigit} ({row.hotPct}%)</span>
                          </span>
                        </td>

                        {/* Coldest Digit Recently (The Primary Sniper Target) */}
                        <td className="py-3 px-3.5">
                          <div className="flex items-center gap-2">
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-rose-500/20 border border-rose-500/50 text-rose-300 font-black text-xs shadow-sm">
                              <Snowflake className="w-3.5 h-3.5 text-cyan-300" />
                              <span>Digit {row.coldDigit}</span>
                              <span className="text-[10px] text-rose-200 font-normal">({row.coldPct}%)</span>
                            </span>

                            <div className="flex flex-col text-[10px] font-sans">
                              <span className="text-slate-400 font-mono">
                                {row.coldDormancy}t dormant
                              </span>
                              {row.isSuperCold && (
                                <span className="text-[9px] text-amber-300 font-bold uppercase">
                                  ★ Super Cold
                                </span>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Even vs Odd */}
                        <td className="py-3 px-3.5">
                          <div className="flex items-center gap-1.5 text-[11px]">
                            <span className="text-blue-400 font-bold">E:{row.evenPct}%</span>
                            <span className="text-slate-600">/</span>
                            <span className="text-amber-400 font-bold">O:{row.oddPct}%</span>
                          </div>
                        </td>

                        {/* Action Column */}
                        <td className="py-3 px-3.5 text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-2">
                            <button
                              disabled={isPlacingTrade}
                              onClick={() => handleMatrixTradeColdestDiffer(row)}
                              className={`px-3 py-1.5 rounded-xl font-sans text-xs font-black transition-all flex items-center gap-1.5 shadow-md ${
                                isExecuting
                                  ? 'bg-emerald-400 text-slate-950 animate-bounce'
                                  : 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-emerald-600/20 active:scale-95'
                              }`}
                            >
                              <Zap className="w-3.5 h-3.5" />
                              <span>Differ {row.coldDigit}</span>
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-950/60 text-emerald-300 font-mono">
                                +${(matrixStake * 0.098).toFixed(2)}
                              </span>
                            </button>

                            <button
                              onClick={() => {
                                setSelectedSymbol(row.symbol);
                                setActiveTab('trader');
                                soundManager.playButtonClick();
                              }}
                              title="Inspect chart in Manual Trader"
                              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* CARDS / GRID VIEW */}
          {matrixViewMode === 'cards' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {filteredMatrixRows.map((row) => {
                const isExecuting = executingMatrixSymbol === row.symbol;
                const isLastAction = lastMatrixAction?.symbol === row.symbol && Date.now() - lastMatrixAction.time < 3000;

                return (
                  <div
                    key={row.symbol}
                    onClick={() => handleMatrixTradeColdestDiffer(row)}
                    className={`p-4 rounded-2xl border bg-slate-900/90 shadow-xl flex flex-col justify-between transition-all cursor-pointer select-none ${
                      isExecuting
                        ? 'border-emerald-400 ring-2 ring-emerald-400 bg-emerald-950/30 animate-pulse'
                        : isLastAction
                        ? 'border-emerald-500 bg-emerald-950/20'
                        : 'border-slate-800 hover:border-emerald-500/50 hover:bg-slate-850'
                    }`}
                  >
                    <div>
                      {/* Top Header */}
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-white text-sm">{row.name}</span>
                            {row.isOneSecond && (
                              <span className="text-[9px] px-1.5 py-0.2 rounded bg-indigo-500/20 text-indigo-300 font-mono">
                                1s
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-slate-400 font-mono mt-0.5 flex items-center gap-2">
                            <span>Spot: {formatDerivQuote(row.price, row.pipSize, row.symbol)}</span>
                            <span>•</span>
                            <span>Last: <strong className="text-cyan-400">{row.lastDigit}</strong></span>
                          </div>
                        </div>

                        {/* Coldest Badge */}
                        <div className="px-2.5 py-1 rounded-xl bg-rose-500/20 border border-rose-500/40 text-rose-300 font-mono text-xs font-black flex items-center gap-1">
                          <Snowflake className="w-3.5 h-3.5 text-cyan-300" />
                          <span>Cold: {row.coldDigit} ({row.coldPct}%)</span>
                        </div>
                      </div>

                      {/* Mini Digit Stream Tape */}
                      <div className="mt-3 p-2 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between">
                        <span className="text-[10px] text-slate-400 font-bold uppercase">Stream:</span>
                        <div className="flex items-center gap-1 font-mono text-xs">
                          {row.recentDigits.map((d, idx, arr) => (
                            <span
                              key={idx}
                              className={`w-6 h-6 rounded flex items-center justify-center font-bold text-[11px] ${
                                idx === arr.length - 1
                                  ? 'bg-cyan-500/30 text-cyan-300 border border-cyan-400'
                                  : d === row.coldDigit
                                  ? 'bg-rose-500/30 text-rose-300 border border-rose-500'
                                  : 'bg-slate-800 text-slate-400'
                              }`}
                            >
                              {d}
                            </span>
                          ))}
                        </div>
                      </div>

                      {/* Coldness metrics */}
                      <div className="mt-2.5 grid grid-cols-3 gap-2 bg-slate-950/80 p-2 rounded-xl border border-slate-800/80 text-[11px] font-mono">
                        <div>
                          <span className="text-slate-500 text-[10px]">Coldest Digit:</span>
                          <div className="font-bold text-rose-300">Digit {row.coldDigit}</div>
                        </div>
                        <div>
                          <span className="text-slate-500 text-[10px]">Frequency:</span>
                          <div className="font-bold text-slate-300">{row.coldPct}% ({row.coldCount}t)</div>
                        </div>
                        <div>
                          <span className="text-slate-500 text-[10px]">Dormancy:</span>
                          <div className="font-bold text-amber-300">{row.coldDormancy} ticks</div>
                        </div>
                      </div>
                    </div>

                    {/* Big Action Button */}
                    <div className="mt-3 pt-2.5 border-t border-slate-800" onClick={(e) => e.stopPropagation()}>
                      <button
                        disabled={isPlacingTrade}
                        onClick={() => handleMatrixTradeColdestDiffer(row)}
                        className="w-full py-2.5 px-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-xs transition-all shadow-lg shadow-emerald-600/20 flex items-center justify-between active:scale-[0.99]"
                      >
                        <div className="flex items-center gap-1.5">
                          <Zap className="w-4 h-4" />
                          <span>DIFFER COLDEST (≠ {row.coldDigit})</span>
                        </div>
                        <span className="font-mono text-xs px-2 py-0.5 rounded-lg bg-emerald-950/80 text-emerald-300 border border-emerald-800">
                          Stake ${matrixStake.toFixed(2)} ➔ +${(matrixStake * 0.098).toFixed(2)}
                        </span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
      )}

      {/* 📜 SETTLED TRADE HISTORY TAB */}
      {activeTab === 'history' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Clock className="w-5 h-5 text-emerald-400" />
              <span>Settled Trades History ({tradeHistory.length})</span>
            </h3>
            {tradeHistory.length > 0 && (
              <button
                onClick={() => setTradeHistory([])}
                className="text-xs text-slate-400 hover:text-rose-400 flex items-center gap-1 transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Clear History</span>
              </button>
            )}
          </div>

          {tradeHistory.length === 0 ? (
            <div className="py-12 text-center text-slate-500 text-xs">
              No trades executed in this session yet. Place a trade using the Digit Trader console above.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950 text-slate-400 uppercase font-semibold border-b border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Time</th>
                    <th className="py-3 px-4">Market</th>
                    <th className="py-3 px-4">Type</th>
                    <th className="py-3 px-4">Target / Barrier</th>
                    <th className="py-3 px-4">Entry Spot</th>
                    <th className="py-3 px-4">Exit Spot</th>
                    <th className="py-3 px-4 text-center">Exit Digit</th>
                    <th className="py-3 px-4">Stake</th>
                    <th className="py-3 px-4 text-right">Profit / Loss</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono">
                  {tradeHistory.map((item) => {
                    const isWin = item.status === 'WON' || (item.currentProfit && item.currentProfit > 0);
                    return (
                      <tr key={item.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="py-3 px-4 text-slate-400 font-sans">
                          {new Date(item.startTime || Date.now()).toLocaleTimeString()}
                        </td>
                        <td className="py-3 px-4 font-bold font-sans text-white">{item.symbolName || item.symbol}</td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-sans font-semibold">
                            {item.contractType}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-300">
                          {item.targetDigit !== undefined
                            ? `Digit ${item.targetDigit}`
                            : item.barrier !== undefined
                            ? `Barrier ${item.barrier}`
                            : '--'}
                        </td>
                        <td className="py-3 px-4 text-slate-300">{item.entrySpot?.toFixed(item.pipSize || 2) || '--'}</td>
                        <td className="py-3 px-4 text-slate-300">{item.exitSpot?.toFixed(item.pipSize || 2) || '--'}</td>
                        <td className="py-3 px-4 text-center">
                          <span
                            className={`inline-block px-2 py-0.5 rounded font-black ${
                              isWin
                                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                                : 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
                            }`}
                          >
                            {item.exitDigit ?? '--'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-300">${item.stake.toFixed(2)}</td>
                        <td className="py-3 px-4 text-right font-black">
                          <span className={isWin ? 'text-emerald-400' : 'text-rose-400'}>
                            {isWin ? '+' : ''}${item.currentProfit?.toFixed(2) || '0.00'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
