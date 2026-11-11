import React, { useState, useEffect, useMemo, useRef } from 'react';
import { MarketInfo, MarketSymbol, ActiveContract, Tick } from '../../types/deriv';
import { derivWS, extractDerivLastDigit, formatDerivQuote, getMarketPipSize } from '../../services/derivWebSocket';
import { soundManager } from '../../utils/soundEffects';
import { AiScannerBotPanel } from './AiScannerBotPanel';
import { DigitSelectDifferBotPanel } from './DigitSelectDifferBotPanel';
import { ColdestFrequencyBotPanel } from './ColdestFrequencyBotPanel';
import { HigherLowerHedgingPanel } from '../HigherLowerHedging/HigherLowerHedgingPanel';
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
  GitFork,
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
  Crosshair,
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

export const DerivDigitTrader: React.FC<DerivDigitTraderProps> = ({
  markets,
  balanceUsd,
  onUpdateBalance,
  initialSymbol = 'R_100',
}) => {
  const [selectedSymbol, setSelectedSymbol] = useState<MarketSymbol>(initialSymbol);
  const [sampleSize, setSampleSize] = useState<number>(100);
  const [activeTab, setActiveTab] = useState<'trader' | 'ai_scanner' | 'digit_select_differ' | 'coldest_frequency' | 'higher_lower_hedging' | 'history'>('ai_scanner');
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
  // ⚡ 1-Tap Immediate Differ Buy on digit click (tapping becomes start button, 1 contract per tap)
  const [instantTapDifferBuy, setInstantTapDifferBuy] = useState<boolean>(true);

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

  // ⚡ 1-Tap Immediate Differ Buy on digit click (tapping becomes start button, strictly 1 contract per tapping)
  const handleDigitTapDifferBuy = (digit: number) => {
    setTargetDigit(digit);
    setBarrierDigit(digit);

    if (instantTapDifferBuy) {
      if (isPlacingTrade) return; // Strict lock: exactly 1 contract per tapping
      setIsPlacingTrade(true);
      soundManager.playStart();

      try {
        const contract = derivWS.purchaseContract({
          symbol: selectedSymbol,
          contractType: 'DIGITDIFF',
          stake,
          durationTicks: 1, // 1-tick contract
          targetDigit: digit,
          symbolName: currentMarket.displayName,
        });

        setTradeMessage(
          `⚡ 1-Tap Differ Placed! ≠ Digit ${digit} on ${currentMarket.displayName} (Stake: $${stake.toFixed(2)}) ID: ${contract.id.slice(-6)}`
        );
      } catch (err: any) {
        console.error('Instant Differ Buy error:', err);
        soundManager.playLoss();
        setTradeMessage(`⚠️ Differ Buy Failed: ${err.message || 'Network error'}`);
      } finally {
        setTimeout(() => {
          setIsPlacingTrade(false);
        }, 350);
      }
    } else {
      soundManager.playButtonClick();
    }
  };



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
                      <option value="1HZ15V">Volatility 15 (1s) Index</option>
                      <option value="1HZ25V">Volatility 25 (1s) Index</option>
                      <option value="1HZ30V">Volatility 30 (1s) Index</option>
                      <option value="1HZ50V">Volatility 50 (1s) Index</option>
                      <option value="1HZ75V">Volatility 75 (1s) Index</option>
                      <option value="1HZ90V">Volatility 90 (1s) Index</option>
                      <option value="1HZ100V">Volatility 100 (1s) Index</option>
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
                onClick={() => setActiveTab('coldest_frequency')}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                  activeTab === 'coldest_frequency'
                    ? 'bg-gradient-to-r from-cyan-500 via-sky-500 to-indigo-500 text-slate-950 shadow-md shadow-cyan-500/30 font-black ring-1 ring-cyan-300'
                    : 'text-slate-400 hover:text-cyan-400'
                }`}
              >
                <Snowflake className="w-3.5 h-3.5 text-cyan-400" />
                <span>Coldest Frequency</span>
                <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-cyan-950/80 text-cyan-300 border border-cyan-500/40 font-mono">
                  Lowest Freq (500t) & 6%
                </span>
              </button>
              <button
                onClick={() => setActiveTab('higher_lower_hedging')}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                  activeTab === 'higher_lower_hedging'
                    ? 'bg-gradient-to-r from-emerald-500 via-teal-400 to-indigo-500 text-slate-950 shadow-md shadow-emerald-500/30 font-black ring-1 ring-emerald-300'
                    : 'text-slate-400 hover:text-emerald-400'
                }`}
              >
                <GitFork className="w-3.5 h-3.5 text-emerald-400" />
                <span>Higher/Lower Hedging</span>
                <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-emerald-950/80 text-emerald-300 border border-emerald-500/40 font-mono">
                  +1100% Payout
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
                onClick={() => setActiveTab('digit_select_differ')}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                  activeTab === 'digit_select_differ'
                    ? 'bg-gradient-to-r from-rose-500 via-pink-600 to-fuchsia-600 text-white shadow-md shadow-rose-500/25 font-black ring-1 ring-rose-400'
                    : 'text-slate-400 hover:text-rose-400'
                }`}
              >
                <Crosshair className="w-3.5 h-3.5 text-rose-300" />
                <span>Digit Select Differ</span>
                <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-rose-950/80 text-rose-300 border border-rose-500/30 font-mono">
                  ≠ Target • 1t
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

      {/* ❄️ COLDEST FREQUENCY BOT PANEL (≤ 6.0% Drop Differ Sniper • 1-Tick Settle) */}
      {activeTab === 'coldest_frequency' && (
        <ColdestFrequencyBotPanel
          balanceUsd={balanceUsd}
          onUpdateBalance={onUpdateBalance}
          activeMarketSymbol={selectedSymbol}
        />
      )}

      {/* ⚡ HIGHER / LOWER HEDGING BOT PANEL (+1100% Payout Dual Straddle) */}
      {activeTab === 'higher_lower_hedging' && (
        <HigherLowerHedgingPanel
          markets={markets}
          balanceUsd={balanceUsd}
          onUpdateBalance={onUpdateBalance}
          initialSymbol={selectedSymbol}
        />
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

              {/* Hot & Cold Summary Badges & 1-Tap Differ Buy Toggle */}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setInstantTapDifferBuy(!instantTapDifferBuy)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer border ${
                    instantTapDifferBuy
                      ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 border-emerald-300 shadow-md shadow-emerald-500/30 ring-2 ring-emerald-400/50'
                      : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
                  }`}
                  title="When enabled, tapping any digit button immediately acts as a start button to purchase 1 Differ contract ≠ that digit"
                >
                  <Zap className={`w-3.5 h-3.5 ${instantTapDifferBuy ? 'text-slate-950 fill-current' : 'text-emerald-400'}`} />
                  <span>1-Tap Differ Buy: {instantTapDifferBuy ? 'ACTIVE' : 'OFF'}</span>
                  <span className={`text-[9px] px-1.5 py-0.2 rounded font-mono ${instantTapDifferBuy ? 'bg-slate-950 text-emerald-300' : 'bg-slate-900 text-slate-400'}`}>
                    1 Contract / Tap
                  </span>
                </button>
                <div className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-xs font-semibold text-emerald-300">
                  <Flame className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Hottest: <strong className="text-white font-mono">{hotDigitStat?.digit}</strong> ({hotDigitStat?.percentage}%)</span>
                </div>
                <div className="flex items-center gap-1.5 px-2.5 py-1 bg-rose-500/10 border border-rose-500/30 rounded-lg text-xs font-semibold text-rose-300">
                  <Snowflake className="w-3.5 h-3.5 text-rose-400" />
                  <span>Coldest: <strong className="text-white font-mono">{coldDigitStat?.digit}</strong> ({coldDigitStat?.percentage}%)</span>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab('coldest_frequency')}
                  className="flex items-center gap-1.5 px-2.5 py-1 bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/40 rounded-lg text-xs font-bold text-cyan-300 transition-all cursor-pointer"
                  title="Open Coldest Frequency Bot (≤6.0% Differ Sniper)"
                >
                  <Snowflake className="w-3.5 h-3.5 text-cyan-400 animate-spin-slow" />
                  <span>Coldest Frequency Bot</span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-cyan-950 text-cyan-300 font-mono">
                    ≤6.0% Differ
                  </span>
                </button>
              </div>
            </div>

            {/* 10 Vertical Percentage Bars - Tap any digit to immediately BUY Differ */}
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
                    disabled={isPlacingTrade}
                    onClick={() => handleDigitTapDifferBuy(item.digit)}
                    className={`flex flex-col items-center justify-end group transition-all p-1.5 rounded-xl border cursor-pointer relative ${
                      targetDigit === item.digit
                        ? 'bg-slate-800/90 border-emerald-500 ring-2 ring-emerald-500/40 shadow-lg shadow-emerald-500/20'
                        : item.isCurrent
                        ? 'bg-slate-800/60 border-cyan-500/60'
                        : 'bg-slate-950/60 border-slate-800/80 hover:border-emerald-500/60'
                    } ${isPlacingTrade ? 'opacity-70 cursor-wait' : 'active:scale-95'}`}
                    title={
                      instantTapDifferBuy
                        ? `Click to BUY 1 Differ Contract: ≠ Digit ${item.digit} (Stake: $${stake.toFixed(2)})`
                        : `Select Target Digit ${item.digit}`
                    }
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

                    {/* Digit Bottom Button - Tap acts as Start Button to Buy Differ */}
                    <div
                      className={`mt-2 w-full py-1 sm:py-1.5 rounded-lg flex flex-col items-center justify-center font-mono transition-all border ${
                        targetDigit === item.digit
                          ? 'bg-emerald-500 text-white border-emerald-400 shadow-md shadow-emerald-500/40'
                          : item.isCurrent
                          ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/50'
                          : 'bg-slate-900 text-slate-300 border-slate-700 group-hover:border-emerald-500/60 group-hover:bg-slate-850'
                      }`}
                    >
                      <span className="font-black text-sm sm:text-base leading-none">{item.digit}</span>
                      {instantTapDifferBuy && (
                        <span className="text-[8px] uppercase font-black text-emerald-300 leading-none mt-1 flex items-center gap-0.5">
                          <Zap className="w-2 h-2 text-amber-300 fill-current" />
                          <span>≠ BUY</span>
                        </span>
                      )}
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

              {/* Digit Differ Probability for Target Digit */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">Digit Differ Probability (Target: ≠ {targetDigit})</span>
                  <span className="text-xs font-mono text-emerald-400 font-bold">Diff Payout: +9.8%</span>
                </div>
                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between">
                  <div>
                    <div className="text-[10px] text-emerald-400 uppercase font-semibold">Differs (≠ {targetDigit}) [WIN]</div>
                    <div className="text-base font-black font-mono text-emerald-400">{matchDiffStats.diffPct}%</div>
                    <div className="text-[10px] text-slate-400">{matchDiffStats.diffCount} / {sampleDigits.length} Ticks</div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] text-rose-400 uppercase font-semibold">Target Digit ({targetDigit}) [EXCLUDE]</div>
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
                  { id: 'MATCH_DIFF', label: 'Digit Differ (≠)' },
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
                  <label className="text-xs font-semibold text-slate-400 block mb-1">Differ Target Digit (≠ Digit)</label>
                  <select
                    value={targetDigit}
                    onChange={(e) => setTargetDigit(parseInt(e.target.value, 10))}
                    className="w-full bg-slate-950 text-white font-mono font-bold text-sm rounded-xl px-3 py-2 border border-slate-800 focus:border-emerald-500 focus:outline-none"
                  >
                    {new Array(10).fill(0).map((_, d) => (
                      <option key={d} value={d}>
                        ≠ Differ Digit {d} ({digitStats[d]?.percentage || 10}%)
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
                <div>
                  {/* SINGLE OPTION: DIGIT DIFFER BUTTON (MATCHES OPTION DELETED) */}
                  <button
                    disabled={isPlacingTrade}
                    onClick={() => handleExecuteTrade('DIGITDIFF')}
                    className="w-full p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-500 hover:from-emerald-500 hover:to-teal-400 active:scale-[0.99] text-white font-bold transition-all shadow-xl shadow-emerald-500/25 disabled:opacity-50 flex items-center justify-between border border-emerald-400/40 cursor-pointer"
                  >
                    <div className="text-left flex items-center gap-3">
                      <div className="p-3 rounded-xl bg-slate-950/40 text-emerald-300 border border-emerald-400/30">
                        <Crosshair className="w-6 h-6 animate-pulse" />
                      </div>
                      <div>
                        <div className="text-lg font-black flex items-center gap-2">
                          <span>BUY DIGIT DIFFER</span>
                          <span className="text-sm px-2.5 py-0.5 bg-slate-950/90 text-emerald-300 rounded-lg font-mono border border-emerald-400/40">
                            ≠ Digit {targetDigit}
                          </span>
                        </div>
                        <div className="text-xs text-emerald-100/90 mt-1 font-normal">
                          Wins if exit digit is NOT {targetDigit} (1-Tick Contract) • Win Probability ~90.9%
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs uppercase font-bold text-emerald-200">Payout: +9.8%</div>
                      <div className="text-xl font-mono font-black text-white">+${(stake * 0.098).toFixed(2)}</div>
                      <div className="text-[10px] text-emerald-200 font-mono">Total Return: ${(stake * 1.098).toFixed(2)}</div>
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

      {/* 🎯 DIGIT SELECT DIFFER BOT PANEL (SYNCED WITH TOP LIVE FEED & VIRTUAL MODE) */}
      {activeTab === 'digit_select_differ' && (
        <DigitSelectDifferBotPanel
          balanceUsd={balanceUsd}
          onUpdateBalance={onUpdateBalance}
          activeMarketSymbol={selectedSymbol}
          onSelectMarket={(sym) => setSelectedSymbol(sym)}
        />
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
