import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Tick, MarketSymbol } from '../../types/deriv';
import { derivWS, extractDerivLastDigit } from '../../services/derivWebSocket';
import { Activity, Flame, Snowflake, ArrowUp, ArrowDown, Crosshair, Sparkles, SlidersHorizontal, Zap, Target } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface DerivLiveCirclesEngineProps {
  symbol: MarketSymbol;
  symbolName?: string;
  selectedTargetDigit?: number;
  onSelectTargetDigit?: (digit: number) => void;
  ticks?: Tick[];
  className?: string;
}

export const DerivLiveCirclesEngine: React.FC<DerivLiveCirclesEngineProps> = ({
  symbol,
  symbolName,
  selectedTargetDigit,
  onSelectTargetDigit,
  ticks: externalTicks,
  className = '',
}) => {
  const [internalTicks, setInternalTicks] = useState<Tick[]>([]);
  const [sampleSize, setSampleSize] = useState<number>(100);
  const [prevQuote, setPrevQuote] = useState<number>(0);
  const [currentQuote, setCurrentQuote] = useState<number>(0);
  const [currentDigit, setCurrentDigit] = useState<number | null>(null);
  const [cursorPositionIndex, setCursorPositionIndex] = useState<number>(0);
  const [repeatStreak, setRepeatStreak] = useState<number>(1);
  const lastDigitRef = useRef<number | null>(null);

  // Subscribe to live ticks if not provided externally or to supplement
  useEffect(() => {
    setInternalTicks([]);
    lastDigitRef.current = null;
    setRepeatStreak(1);

    const handleTick = (tick: Tick) => {
      const quote = Number(tick.quote);
      if (!Number.isFinite(quote)) return;
      const pipSize = Number.isInteger(tick.pipSize) ? tick.pipSize : 2;
      const digit = extractDerivLastDigit(quote, pipSize);

      setPrevQuote((prev) => (prev === 0 ? quote : currentQuote || quote));
      setCurrentQuote(quote);
      setCurrentDigit(digit);
      setCursorPositionIndex(digit);

      if (lastDigitRef.current === digit) {
        setRepeatStreak((s) => s + 1);
      } else {
        setRepeatStreak(1);
        lastDigitRef.current = digit;
      }

      setInternalTicks((prev) => {
        const next = [...prev, tick];
        return next.slice(-1000); // keep up to 1000 ticks in buffer
      });
    };

    derivWS.subscribeTicks(symbol, handleTick);
    return () => {
      derivWS.unsubscribeTicks(symbol, handleTick);
    };
  }, [symbol, currentQuote]);

  // Combine or choose active tick stream
  const activeTicks = useMemo(() => {
    if (internalTicks.length > 0) return internalTicks;
    return externalTicks || [];
  }, [internalTicks, externalTicks]);

  // Active window based on selected sampleSize (50, 100, 200, 500, 1000)
  const windowTicks = useMemo(() => {
    return activeTicks.slice(-sampleSize);
  }, [activeTicks, sampleSize]);

  // Compute 0-9 Digit Distribution & Real Percentages
  const digitStats = useMemo(() => {
    const counts = Array(10).fill(0);
    windowTicks.forEach((t) => {
      const pipSize = Number.isInteger(t.pipSize) ? t.pipSize : 2;
      const d = extractDerivLastDigit(t.quote, pipSize);
      if (d >= 0 && d <= 9) counts[d]++;
    });

    const total = windowTicks.length || 1;
    let maxPct = -1;
    let minPct = 999;
    let maxDigit = 0;
    let minDigit = 0;

    const stats = counts.map((count, digit) => {
      const pct = Number(((count / total) * 100).toFixed(1));
      if (pct > maxPct) {
        maxPct = pct;
        maxDigit = digit;
      }
      if (pct < minPct) {
        minPct = pct;
        minDigit = digit;
      }
      return {
        digit,
        count,
        pct,
      };
    });

    return {
      list: stats,
      maxDigit,
      minDigit,
      totalCount: windowTicks.length,
    };
  }, [windowTicks]);

  // Even / Odd & Over / Under percentages
  const parityStats = useMemo(() => {
    let evenCount = 0;
    let oddCount = 0;
    let overCount = 0; // 5-9
    let underCount = 0; // 0-4

    windowTicks.forEach((t) => {
      const pipSize = Number.isInteger(t.pipSize) ? t.pipSize : 2;
      const d = extractDerivLastDigit(t.quote, pipSize);
      if (d % 2 === 0) evenCount++;
      else oddCount++;

      if (d >= 5) overCount++;
      else underCount++;
    });

    const total = windowTicks.length || 1;
    return {
      evenPct: ((evenCount / total) * 100).toFixed(1),
      oddPct: ((oddCount / total) * 100).toFixed(1),
      overPct: ((overCount / total) * 100).toFixed(1),
      underPct: ((underCount / total) * 100).toFixed(1),
      evenCount,
      oddCount,
      overCount,
      underCount,
    };
  }, [windowTicks]);

  const isUp = currentQuote >= prevQuote;
  const quoteChange = currentQuote - prevQuote;

  // Stream of recent 24 tick circles for the worm / feed
  const recentStream = useMemo(() => {
    return activeTicks.slice(-24).map((t, idx, arr) => {
      const pipSize = Number.isInteger(t.pipSize) ? t.pipSize : 2;
      const d = extractDerivLastDigit(t.quote, pipSize);
      const prev = idx > 0 ? arr[idx - 1].quote : t.quote;
      const dir = t.quote > prev ? 'UP' : t.quote < prev ? 'DOWN' : 'FLAT';
      return {
        digit: d,
        quote: t.quote,
        dir,
        epoch: t.epoch,
      };
    });
  }, [activeTicks]);

  return (
    <div id="deriv-live-circles-engine" className={`bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-2xl space-y-6 ${className}`}>
      
      {/* Header Bar with Symbol Info, Live Spot, Sample Filter */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800/80 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
            <Activity className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-white font-black text-base flex items-center gap-1.5">
                <span>LIVE DERIV CIRCLES FEED ENGINE</span>
              </h2>
              <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                REAL-TIME
              </span>
            </div>
            <p className="text-slate-400 text-xs mt-0.5">
              Live Deriv 0–9 circular digit gauges with dynamic real percentages and live moving cursor tracker.
            </p>
          </div>
        </div>

        {/* Live Spot Quote & Sample Size Tabs */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Current Spot Display */}
          <div className="bg-slate-950 border border-slate-800 rounded-2xl px-4 py-2 flex items-center gap-3 shadow-inner">
            <div className="text-right">
              <span className="text-[10px] uppercase font-bold text-slate-500 block">Spot Quote</span>
              <span className={`font-mono font-black text-base leading-none flex items-center gap-1 ${isUp ? 'text-emerald-400' : 'text-rose-400'}`}>
                {isUp ? <ArrowUp className="w-3.5 h-3.5" /> : <ArrowDown className="w-3.5 h-3.5" />}
                {currentQuote > 0 ? currentQuote.toFixed(2) : 'Loading...'}
              </span>
            </div>
            {currentDigit !== null && (
              <div className="w-8 h-8 rounded-xl bg-red-600 text-white font-mono font-black text-base flex items-center justify-center shadow-lg shadow-red-900/50">
                {currentDigit}
              </div>
            )}
          </div>

          {/* Sample Size Filter Tabs */}
          <div className="bg-slate-950 border border-slate-800 rounded-2xl p-1 flex items-center gap-1">
            <span className="text-[10px] font-bold text-slate-500 pl-2 pr-1 flex items-center gap-1">
              <SlidersHorizontal className="w-3 h-3" /> Samples:
            </span>
            {[50, 100, 200, 500].map((sz) => (
              <button
                key={sz}
                onClick={() => setSampleSize(sz)}
                className={`px-2.5 py-1 rounded-xl text-xs font-bold transition-all ${
                  sampleSize === sz
                    ? 'bg-amber-500 text-slate-950 font-black shadow-md'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {sz}T
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Live Cursor Tracker Banner */}
      <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-3 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-xl bg-red-600/20 border border-red-500/40 flex items-center justify-center text-red-400">
            <Crosshair className="w-4 h-4 animate-spin" />
          </div>
          <div className="text-xs">
            <span className="text-slate-400 font-medium">Live Cursor Focus:</span>{' '}
            <span className="text-white font-black text-sm">
              Digit {currentDigit !== null ? currentDigit : '—'}
            </span>
            {repeatStreak > 1 && (
              <span className="ml-2 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-950 text-amber-300 border border-amber-700">
                🔥 {repeatStreak}x Streak Repeat
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-4 text-xs font-mono">
          <span className="text-slate-400">
            Ticks in Window: <strong className="text-white">{digitStats.totalCount}</strong>
          </span>
          <span className="text-emerald-400 flex items-center gap-1">
            <Flame className="w-3.5 h-3.5 fill-current" /> Hot: <strong>Digit {digitStats.maxDigit} ({digitStats.list[digitStats.maxDigit]?.pct}%)</strong>
          </span>
          <span className="text-sky-400 flex items-center gap-1">
            <Snowflake className="w-3.5 h-3.5" /> Cold: <strong>Digit {digitStats.minDigit} ({digitStats.list[digitStats.minDigit]?.pct}%)</strong>
          </span>
        </div>
      </div>

      {/* 10 DERIV CIRCLES GRID WITH REAL PERCENTAGES & LIVE MOVING CURSOR */}
      <div className="relative">
        {/* The 10 Circles Matrix */}
        <div className="grid grid-cols-2 sm:grid-cols-5 lg:grid-cols-10 gap-3">
          {digitStats.list.map((item) => {
            const isCurrent = currentDigit === item.digit;
            const isTarget = selectedTargetDigit === item.digit;
            const isHot = item.digit === digitStats.maxDigit && item.pct > 10;
            const isCold = item.digit === digitStats.minDigit && item.pct < 10;

            // SVG Circular Ring Math
            // Radius 28, Circumference = 2 * PI * 28 ≈ 175.93
            const radius = 28;
            const circumference = 2 * Math.PI * radius;
            // Expected normal is 10%. Scale pct for progress stroke (e.g. 20% fills full or proportional to 25% max)
            const strokeOffset = circumference - (Math.min(100, item.pct * 3.5) / 100) * circumference;

            return (
              <motion.button
                key={`digit-circle-${item.digit}`}
                id={`deriv-circle-${item.digit}`}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => onSelectTargetDigit?.(item.digit)}
                className={`relative flex flex-col items-center justify-between p-3 rounded-2xl border transition-all cursor-pointer overflow-hidden ${
                  isCurrent
                    ? 'bg-red-950/40 border-red-500 shadow-xl shadow-red-950/60 ring-2 ring-red-400 ring-offset-2 ring-offset-slate-950'
                    : isTarget
                    ? 'bg-amber-950/40 border-amber-500 shadow-lg ring-1 ring-amber-400'
                    : isHot
                    ? 'bg-emerald-950/20 border-emerald-800/80 hover:border-emerald-500'
                    : isCold
                    ? 'bg-sky-950/20 border-sky-900/60 hover:border-sky-500'
                    : 'bg-slate-950/80 border-slate-800 hover:border-slate-700'
                }`}
              >
                {/* Live Cursor Ping Effect when Active */}
                {isCurrent && (
                  <span className="absolute -top-1 -right-1 flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500" />
                  </span>
                )}

                {/* Hot / Cold / Target Floating Badge */}
                <div className="h-4 flex items-center justify-center mb-1">
                  {isCurrent ? (
                    <span className="text-[9px] font-black uppercase text-red-300 bg-red-950 px-1.5 py-0.2 rounded border border-red-700">
                      LIVE
                    </span>
                  ) : isTarget ? (
                    <span className="text-[9px] font-black uppercase text-amber-300 bg-amber-950 px-1.5 py-0.2 rounded border border-amber-700">
                      TARGET
                    </span>
                  ) : isHot ? (
                    <span className="text-[9px] font-extrabold uppercase text-emerald-400 flex items-center gap-0.5">
                      <Flame className="w-2.5 h-2.5 fill-current" /> HOT
                    </span>
                  ) : isCold ? (
                    <span className="text-[9px] font-extrabold uppercase text-sky-400 flex items-center gap-0.5">
                      <Snowflake className="w-2.5 h-2.5" /> COLD
                    </span>
                  ) : (
                    <span className="text-[9px] text-slate-600 font-bold uppercase">
                      {item.digit % 2 === 0 ? 'EVEN' : 'ODD'}
                    </span>
                  )}
                </div>

                {/* DERIV CIRCLE SVG PROGRESS GAUGE */}
                <div className="relative w-16 h-16 flex items-center justify-center my-1">
                  <svg className="w-16 h-16 transform -rotate-90" viewBox="0 0 70 70">
                    {/* Background Track */}
                    <circle
                      cx="35"
                      cy="35"
                      r={radius}
                      className="stroke-slate-800"
                      strokeWidth="5"
                      fill="transparent"
                    />
                    {/* Real Percentage Progress Fill */}
                    <circle
                      cx="35"
                      cy="35"
                      r={radius}
                      stroke={
                        isCurrent
                          ? '#ef4444'
                          : isHot
                          ? '#10b981'
                          : isCold
                          ? '#0284c7'
                          : item.pct >= 10
                          ? '#3b82f6'
                          : '#64748b'
                      }
                      strokeWidth="5"
                      strokeDasharray={circumference}
                      strokeDashoffset={strokeOffset}
                      strokeLinecap="round"
                      fill="transparent"
                      className="transition-all duration-500 ease-out"
                    />
                  </svg>

                  {/* Inner Content: Digit in Center */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span
                      className={`font-mono font-black text-xl leading-none ${
                        isCurrent
                          ? 'text-red-400 scale-110'
                          : isTarget
                          ? 'text-amber-400'
                          : isHot
                          ? 'text-emerald-300'
                          : isCold
                          ? 'text-sky-300'
                          : 'text-white'
                      }`}
                    >
                      {item.digit}
                    </span>
                  </div>
                </div>

                {/* Real Percentage Display */}
                <div className="mt-1 text-center w-full">
                  <div
                    className={`font-mono font-black text-xs ${
                      isCurrent
                        ? 'text-red-400'
                        : isHot
                        ? 'text-emerald-400'
                        : isCold
                        ? 'text-sky-400'
                        : 'text-slate-300'
                    }`}
                  >
                    {item.pct.toFixed(1)}%
                  </div>
                  <div className="text-[9px] text-slate-500 font-mono mt-0.5">
                    {item.count} hits
                  </div>
                </div>
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* Parity & Magnitude Live Metrics (Even/Odd & Over/Under Real Percentages) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Even vs Odd Real-Time Gauge */}
        <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 space-y-3">
          <div className="flex justify-between items-center text-xs">
            <span className="text-slate-300 font-bold flex items-center gap-1.5">
              <Zap className="w-4 h-4 text-amber-400" /> Even vs Odd Distribution
            </span>
            <span className="text-[11px] font-mono text-slate-400">Window: {digitStats.totalCount} Ticks</span>
          </div>

          <div className="flex items-center justify-between text-xs font-mono font-bold">
            <div className="text-emerald-400">
              EVEN: <span className="text-white text-sm">{parityStats.evenPct}%</span> ({parityStats.evenCount})
            </div>
            <div className="text-indigo-400">
              ODD: <span className="text-white text-sm">{parityStats.oddPct}%</span> ({parityStats.oddCount})
            </div>
          </div>

          {/* Split Progress Bar */}
          <div className="w-full h-3 bg-slate-900 rounded-full overflow-hidden flex border border-slate-800">
            <div
              className="bg-emerald-500 h-full transition-all duration-300"
              style={{ width: `${parityStats.evenPct}%` }}
              title={`Even: ${parityStats.evenPct}%`}
            />
            <div
              className="bg-indigo-500 h-full transition-all duration-300"
              style={{ width: `${parityStats.oddPct}%` }}
              title={`Odd: ${parityStats.oddPct}%`}
            />
          </div>
        </div>

        {/* Over (5-9) vs Under (0-4) Real-Time Gauge */}
        <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 space-y-3">
          <div className="flex justify-between items-center text-xs">
            <span className="text-slate-300 font-bold flex items-center gap-1.5">
              <Target className="w-4 h-4 text-red-400" /> Over (5–9) vs Under (0–4)
            </span>
            <span className="text-[11px] font-mono text-slate-400">Threshold: Digit 4.5</span>
          </div>

          <div className="flex items-center justify-between text-xs font-mono font-bold">
            <div className="text-sky-400">
              UNDER (0-4): <span className="text-white text-sm">{parityStats.underPct}%</span> ({parityStats.underCount})
            </div>
            <div className="text-rose-400">
              OVER (5-9): <span className="text-white text-sm">{parityStats.overPct}%</span> ({parityStats.overCount})
            </div>
          </div>

          {/* Split Progress Bar */}
          <div className="w-full h-3 bg-slate-900 rounded-full overflow-hidden flex border border-slate-800">
            <div
              className="bg-sky-500 h-full transition-all duration-300"
              style={{ width: `${parityStats.underPct}%` }}
              title={`Under (0-4): ${parityStats.underPct}%`}
            />
            <div
              className="bg-rose-500 h-full transition-all duration-300"
              style={{ width: `${parityStats.overPct}%` }}
              title={`Over (5-9): ${parityStats.overPct}%`}
            />
          </div>
        </div>
      </div>

      {/* CONTINUOUS LIVE DERIV TICK STREAM CIRCLES & MOVING CURSOR WORM */}
      <div id="deriv-live-tick-worm" className="bg-slate-950 border border-slate-800 rounded-2xl p-4 space-y-3">
        <div className="flex justify-between items-center text-xs">
          <span className="text-slate-300 font-bold flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-400" />
            Live Deriv Worm & Continuous Tick Circle Stream
          </span>
          <span className="text-slate-500 text-[11px] font-mono">
            Latest 24 Ticks (Green: ▲ Up, Red: ▼ Down)
          </span>
        </div>

        {/* Horizontal Tick Stream with Live Cursor Indicator */}
        <div className="flex items-center gap-2 overflow-x-auto py-2 px-1">
          {recentStream.length > 0 ? (
            recentStream.map((t, idx) => {
              const isLatest = idx === recentStream.length - 1;
              const isUpDir = t.dir === 'UP';
              const isDownDir = t.dir === 'DOWN';

              return (
                <div key={`tick-worm-${idx}-${t.epoch}-${t.quote}`} className="relative flex flex-col items-center flex-shrink-0">
                  {/* Live Cursor Pointer above the newest tick */}
                  {isLatest && (
                    <motion.div
                      layoutId="live-cursor-beacon"
                      className="absolute -top-6 flex flex-col items-center pointer-events-none z-10"
                      initial={{ y: -5, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      transition={{ duration: 0.2 }}
                    >
                      <span className="bg-red-600 text-white text-[9px] font-black px-1.5 py-0.5 rounded shadow-lg shadow-red-950/80 animate-pulse">
                        LIVE
                      </span>
                      <span className="w-1.5 h-1.5 bg-red-600 rotate-45 -mt-0.5" />
                    </motion.div>
                  )}

                  {/* Tick Circle Badge */}
                  <div
                    className={`w-9 h-9 rounded-full flex items-center justify-center font-mono font-black text-sm transition-all shadow-md ${
                      isLatest
                        ? isUpDir
                          ? 'bg-emerald-500 text-slate-950 ring-4 ring-emerald-400/40 ring-offset-2 ring-offset-slate-950 scale-110'
                          : isDownDir
                          ? 'bg-rose-500 text-white ring-4 ring-rose-400/40 ring-offset-2 ring-offset-slate-950 scale-110'
                          : 'bg-slate-200 text-slate-950 ring-4 ring-slate-400/40 ring-offset-2 ring-offset-slate-950 scale-110'
                        : isUpDir
                        ? 'bg-emerald-950 text-emerald-300 border border-emerald-700/80'
                        : isDownDir
                        ? 'bg-rose-950 text-rose-300 border border-rose-700/80'
                        : 'bg-slate-900 text-slate-400 border border-slate-800'
                    }`}
                  >
                    {t.digit}
                  </div>

                  {/* Sub-label with direction */}
                  <span className="text-[9px] font-mono mt-1 text-slate-500">
                    {isUpDir ? '▲' : isDownDir ? '▼' : '—'}
                  </span>
                </div>
              );
            })
          ) : (
            <div className="text-slate-600 text-xs py-2">Streaming real Deriv ticks...</div>
          )}
        </div>
      </div>
    </div>
  );
};
