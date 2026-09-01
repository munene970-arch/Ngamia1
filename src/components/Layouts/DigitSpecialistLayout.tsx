import React, { useState, useEffect, useMemo } from 'react';
import { MarketSymbol, MarketInfo, Tick, ActiveContract } from '../../types/deriv';
import { derivWS, extractDerivLastDigit } from '../../services/derivWebSocket';
import { DerivLiveCirclesEngine } from '../Terminal/DerivLiveCirclesEngine';
import { soundManager } from '../../utils/soundEffects';
import {
  Flame,
  Snowflake,
  Activity,
  Zap,
  Target,
  ShieldCheck,
  TrendingUp,
  TrendingDown,
  ArrowRight,
  SlidersHorizontal,
  CircleDot,
  CheckCircle2
} from 'lucide-react';

interface DigitSpecialistLayoutProps {
  markets: MarketInfo[];
  selectedSymbol: MarketSymbol;
  onSelectSymbol: (symbol: MarketSymbol) => void;
  balanceUsd: number;
  onUpdateBalance: (newBalance: number) => void;
  activeContracts: ActiveContract[];
}

export const DigitSpecialistLayout: React.FC<DigitSpecialistLayoutProps> = ({
  markets,
  selectedSymbol,
  onSelectSymbol,
  balanceUsd,
  onUpdateBalance,
  activeContracts,
}) => {
  const [stake, setStake] = useState<number>(10);
  const [selectedTargetDigit, setSelectedTargetDigit] = useState<number>(2);
  const [ticks, setTicks] = useState<Tick[]>([]);
  const [currentQuote, setCurrentQuote] = useState<number>(0);
  const [quickTradeStatus, setQuickTradeStatus] = useState<string | null>(null);

  const currentMarket = useMemo(() => {
    return markets.find((m) => m.symbol === selectedSymbol) || markets[0];
  }, [markets, selectedSymbol]);

  useEffect(() => {
    setTicks([]);
    const handleTick = (tick: Tick) => {
      const q = Number(tick.quote);
      if (!Number.isFinite(q)) return;
      setCurrentQuote(q);
      setTicks((prev) => [...prev.slice(-499), tick]);
    };

    derivWS.subscribeTicks(selectedSymbol, handleTick);
    return () => {
      derivWS.unsubscribeTicks(selectedSymbol, handleTick);
    };
  }, [selectedSymbol]);

  // Compute digit statistics for fast scalp decision
  const stats = useMemo(() => {
    const counts = Array(10).fill(0);
    const windowTicks = ticks.slice(-100);
    windowTicks.forEach((t) => {
      const pip = Number.isInteger(t.pipSize) ? t.pipSize : 2;
      const d = extractDerivLastDigit(t.quote, pip);
      if (d >= 0 && d <= 9) counts[d]++;
    });
    const total = windowTicks.length || 1;
    let maxDigit = 0;
    let maxPct = -1;
    let minDigit = 0;
    let minPct = 999;

    counts.forEach((c, d) => {
      const pct = (c / total) * 100;
      if (pct > maxPct) {
        maxPct = pct;
        maxDigit = d;
      }
      if (pct < minPct) {
        minPct = pct;
        minDigit = d;
      }
    });

    return {
      maxDigit,
      maxPct: maxPct.toFixed(1),
      minDigit,
      minPct: minPct.toFixed(1),
      total,
    };
  }, [ticks]);

  const handleExecuteScalp = (contractType: string, targetDigit: number) => {
    if (balanceUsd < stake) {
      setQuickTradeStatus('Insufficient balance');
      return;
    }

    setQuickTradeStatus(`Purchasing ${contractType} ${targetDigit}...`);
    soundManager.playButtonClick();

    const contract = derivWS.purchaseContract({
      symbol: selectedSymbol,
      contractType,
      stake,
      durationTicks: 1,
      targetDigit,
      barrier: targetDigit,
      symbolName: currentMarket.displayName,
    });

    setTimeout(() => {
      setQuickTradeStatus(`Ordered ${contractType} ${targetDigit} (${contract.id.slice(0, 8)})`);
      setTimeout(() => setQuickTradeStatus(null), 3000);
    }, 400);
  };

  return (
    <div id="digit-specialist-layout" className="space-y-6">
      {/* Top Market Selector Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-red-600/10 border border-red-500/30 flex items-center justify-center text-red-500">
            <CircleDot className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <div className="text-[10px] font-black text-amber-400 uppercase tracking-widest flex items-center gap-1.5">
              <span>DERIV SPECIALIST MODE • HIGH PRECISION CIRCLES</span>
            </div>
            <h1 className="text-xl font-black text-white flex items-center gap-2">
              {currentMarket.displayName}
              <span className="text-xs font-mono text-slate-400 font-normal">({selectedSymbol})</span>
            </h1>
          </div>
        </div>

        {/* Quick Market Switcher Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full">
          {markets.slice(0, 7).map((m) => (
            <button
              key={m.symbol}
              onClick={() => onSelectSymbol(m.symbol)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                selectedSymbol === m.symbol
                  ? 'bg-red-600 text-white font-black shadow-lg shadow-red-950/40'
                  : 'bg-slate-950 border border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
              }`}
            >
              {m.displayName.replace('Index', '').replace('Volatility', 'Vol').trim()}
            </button>
          ))}
        </div>
      </div>

      {/* Main Feature: Live Deriv Circles Engine */}
      <DerivLiveCirclesEngine
        symbol={selectedSymbol}
        symbolName={currentMarket.displayName}
        selectedTargetDigit={selectedTargetDigit}
        onSelectTargetDigit={(d) => setSelectedTargetDigit(d)}
        ticks={ticks}
      />

      {/* Instant 1-Click Fast Scalp Dock */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-amber-400" />
            <h2 className="text-base font-black text-white">Instant 1-Click Fast Digit Scalp Dock</h2>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs font-bold text-slate-400">Stake Amount:</span>
            <div className="flex items-center gap-1.5">
              {[5, 10, 25, 50, 100].map((amt) => (
                <button
                  key={amt}
                  onClick={() => setStake(amt)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition-all ${
                    stake === amt
                      ? 'bg-amber-500 text-slate-950 font-black'
                      : 'bg-slate-950 border border-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  ${amt}
                </button>
              ))}
              <input
                type="number"
                min="0.35"
                step="1"
                value={stake}
                onChange={(e) => setStake(Math.max(0.35, Number(e.target.value) || 1))}
                className="w-20 bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-xs font-mono text-white text-right outline-none focus:border-amber-500"
              />
            </div>
          </div>
        </div>

        {quickTradeStatus && (
          <div className="p-3 bg-amber-950/40 border border-amber-600/50 rounded-2xl text-amber-300 text-xs font-mono flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-amber-400 animate-spin" />
              <span>{quickTradeStatus}</span>
            </div>
          </div>
        )}

        {/* 1-Click Execution Action Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Differ Selected Target */}
          <button
            onClick={() => handleExecuteScalp('DIGITDIFF', selectedTargetDigit)}
            className="p-4 rounded-2xl bg-gradient-to-br from-emerald-950/80 to-slate-900 border border-emerald-600/80 hover:border-emerald-400 text-left transition-all hover:scale-[1.02] active:scale-[0.98] shadow-lg group"
          >
            <div className="flex justify-between items-center text-xs text-emerald-400 font-black">
              <span>DIFFERS TARGET</span>
              <span className="bg-emerald-900/60 px-2 py-0.5 rounded text-[10px] text-emerald-200">~9.9% Return</span>
            </div>
            <div className="mt-2 text-2xl font-black font-mono text-white">
              DIFFERS {selectedTargetDigit}
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              Wins if the next 1-tick ends on any digit other than <strong className="text-emerald-300">{selectedTargetDigit}</strong>.
            </p>
          </button>

          {/* Differ Cold Digit (Highest probability setup) */}
          <button
            onClick={() => handleExecuteScalp('DIGITDIFF', stats.minDigit)}
            className="p-4 rounded-2xl bg-gradient-to-br from-sky-950/80 to-slate-900 border border-sky-600/80 hover:border-sky-400 text-left transition-all hover:scale-[1.02] active:scale-[0.98] shadow-lg group"
          >
            <div className="flex justify-between items-center text-xs text-sky-400 font-black">
              <span className="flex items-center gap-1"><Snowflake className="w-3.5 h-3.5" /> COLD DIFF SCALP</span>
              <span className="bg-sky-900/60 px-2 py-0.5 rounded text-[10px] text-sky-200">{stats.minPct}% Freq</span>
            </div>
            <div className="mt-2 text-2xl font-black font-mono text-white">
              DIFFERS {stats.minDigit}
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              Target lowest frequency digit in current {stats.total}-tick stream.
            </p>
          </button>

          {/* Matches Hot Digit (High multiplier 10x) */}
          <button
            onClick={() => handleExecuteScalp('DIGITMATCH', stats.maxDigit)}
            className="p-4 rounded-2xl bg-gradient-to-br from-amber-950/80 to-slate-900 border border-amber-600/80 hover:border-amber-400 text-left transition-all hover:scale-[1.02] active:scale-[0.98] shadow-lg group"
          >
            <div className="flex justify-between items-center text-xs text-amber-400 font-black">
              <span className="flex items-center gap-1"><Flame className="w-3.5 h-3.5" /> HOT MATCH SCALP</span>
              <span className="bg-amber-900/60 px-2 py-0.5 rounded text-[10px] text-amber-200">~800% Payout</span>
            </div>
            <div className="mt-2 text-2xl font-black font-mono text-white">
              MATCHES {stats.maxDigit}
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              Target highest frequency digit (<strong className="text-amber-300">{stats.maxDigit}</strong> at {stats.maxPct}%).
            </p>
          </button>

          {/* Even / Odd Quick Scalp */}
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => handleExecuteScalp('DIGITEVEN', 0)}
              className="p-3 rounded-2xl bg-slate-950 border border-slate-800 hover:border-emerald-500 text-center flex flex-col justify-center items-center transition-all hover:bg-emerald-950/20"
            >
              <span className="text-[10px] uppercase font-bold text-slate-400">Parity</span>
              <span className="text-base font-black font-mono text-emerald-400 mt-0.5">EVEN</span>
              <span className="text-[9px] text-slate-500">0, 2, 4, 6, 8</span>
            </button>
            <button
              onClick={() => handleExecuteScalp('DIGITODD', 0)}
              className="p-3 rounded-2xl bg-slate-950 border border-slate-800 hover:border-indigo-500 text-center flex flex-col justify-center items-center transition-all hover:bg-indigo-950/20"
            >
              <span className="text-[10px] uppercase font-bold text-slate-400">Parity</span>
              <span className="text-base font-black font-mono text-indigo-400 mt-0.5">ODD</span>
              <span className="text-[9px] text-slate-500">1, 3, 5, 7, 9</span>
            </button>
          </div>
        </div>
      </div>

      {/* Live Recent Contracts Feed */}
      {activeContracts.length > 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl">
          <div className="flex justify-between items-center text-xs font-bold text-slate-400 mb-3">
            <span>RECENT CONTRACTS & SETTLEMENTS</span>
            <span className="text-emerald-400">{activeContracts.length} logged</span>
          </div>
          <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
            {activeContracts.map((c) => (
              <div
                key={c.id}
                className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-800/80 text-xs font-mono"
              >
                <div className="flex items-center gap-2.5">
                  <span className={`w-2 h-2 rounded-full ${c.status === 'WON' ? 'bg-emerald-400' : c.status === 'LOST' ? 'bg-rose-500' : 'bg-amber-400 animate-pulse'}`} />
                  <span className="font-bold text-white">{c.contractType}</span>
                  <span className="text-slate-500">{c.symbol}</span>
                  {c.targetDigit !== undefined && <span className="text-amber-400 font-bold">Target: {c.targetDigit}</span>}
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-slate-400">Stake: ${c.stake.toFixed(2)}</span>
                  <span className={`font-black ${c.currentProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {c.currentProfit >= 0 ? '+' : ''}${c.currentProfit?.toFixed(2) || '0.00'}
                  </span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${c.status === 'WON' ? 'bg-emerald-950 text-emerald-300' : c.status === 'LOST' ? 'bg-rose-950 text-rose-300' : 'bg-amber-950 text-amber-300'}`}>
                    {c.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
