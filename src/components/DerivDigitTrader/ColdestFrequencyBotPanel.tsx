import React, { useState, useEffect } from 'react';
import { MarketSymbol } from '../../types/deriv';
import {
  coldestFrequencyBotEngine,
  ColdestFrequencyStatus,
  ColdestFrequencyConfig,
  ColdestTradeRecord,
  ColdestMarketState,
  COLDEST_BOT_MARKETS,
} from '../../services/coldestFrequencyBotEngine';
import { LowestFrequencyBotView } from './LowestFrequencyBotView';
import {
  Snowflake,
  Play,
  Square,
  Zap,
  TrendingDown,
  TrendingUp,
  Percent,
  Activity,
  Sliders,
  RotateCcw,
  ShieldCheck,
  DollarSign,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Lock,
  Layers,
  ArrowRight,
  Sparkles,
} from 'lucide-react';

interface ColdestFrequencyBotPanelProps {
  balanceUsd: number;
  onUpdateBalance?: (newBalance: number) => void;
  activeMarketSymbol?: MarketSymbol;
}

export const ColdestFrequencyBotPanel: React.FC<ColdestFrequencyBotPanelProps> = ({
  balanceUsd,
  onUpdateBalance,
  activeMarketSymbol,
}) => {
  const [activeSubBot, setActiveSubBot] = useState<'LOWEST_FREQUENCY' | 'COLDEST_6_PERCENT'>('LOWEST_FREQUENCY');
  const [status, setStatus] = useState<ColdestFrequencyStatus>(() =>
    coldestFrequencyBotEngine.getStatus()
  );
  const [config, setConfig] = useState<ColdestFrequencyConfig>(() =>
    coldestFrequencyBotEngine.getConfig()
  );
  const [trades, setTrades] = useState<ColdestTradeRecord[]>(() =>
    coldestFrequencyBotEngine.getTrades()
  );
  const [marketState, setMarketState] = useState<ColdestMarketState | null>(
    () => status.currentMarketState
  );
  const [allMarketStates, setAllMarketStates] = useState<Map<MarketSymbol, ColdestMarketState>>(
    () => coldestFrequencyBotEngine.getAllMarketStates()
  );

  // Sync balance
  useEffect(() => {
    coldestFrequencyBotEngine.setBalance(balanceUsd);
  }, [balanceUsd]);

  useEffect(() => {
    coldestFrequencyBotEngine.setBalanceUpdater((profit, newBal) => {
      if (onUpdateBalance) onUpdateBalance(newBal);
    });
  }, [onUpdateBalance]);

  // Subscribe to engine
  useEffect(() => {
    const unsubStatus = coldestFrequencyBotEngine.subscribeStatus(setStatus);
    const unsubTrades = coldestFrequencyBotEngine.subscribeTrades(setTrades);
    const unsubState = coldestFrequencyBotEngine.subscribeMarketState(setMarketState);
    const unsubAll = coldestFrequencyBotEngine.subscribeAllMarketStates(setAllMarketStates);

    return () => {
      unsubStatus();
      unsubTrades();
      unsubState();
      unsubAll();
    };
  }, []);

  const handleConfigChange = (newValues: Partial<ColdestFrequencyConfig>) => {
    const updated = { ...config, ...newValues, coldThresholdPct: 6.0, ignoreRising: true };
    setConfig(updated);
    coldestFrequencyBotEngine.saveConfig(newValues);
  };

  const isArmed = marketState?.isTriggerArmed ?? false;
  const coldestDigit = marketState?.coldestDigit ?? 0;
  const coldestPct = marketState?.coldestPct ?? 10.0;
  const trendDir = marketState?.trendDirection ?? 'FLAT';
  const digitStats = marketState?.digitStats ?? [];
  const qualStatus = marketState?.qualificationStatus ?? 'NOT_EXACT_6_ABOVE';

  return (
    <div className="space-y-6">
      {/* 🧭 BOT SUB-MODE SELECTOR: LOWEST FREQUENCY vs COLDEST 6.0% */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900 border border-slate-800 rounded-2xl p-2.5 shadow-xl">
        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
          <button
            type="button"
            onClick={() => setActiveSubBot('LOWEST_FREQUENCY')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
              activeSubBot === 'LOWEST_FREQUENCY'
                ? 'bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-500 text-slate-950 shadow-lg shadow-emerald-500/25 ring-2 ring-emerald-300'
                : 'text-slate-400 hover:text-white bg-slate-950/80 hover:bg-slate-850 border border-slate-800'
            }`}
          >
            <TrendingDown className={`w-4 h-4 ${activeSubBot === 'LOWEST_FREQUENCY' ? 'text-slate-950 stroke-[3]' : 'text-emerald-400'}`} />
            <span>Lowest Frequency Bot</span>
            <span
              className={`text-[9px] px-2 py-0.5 rounded-full font-mono font-bold ${
                activeSubBot === 'LOWEST_FREQUENCY'
                  ? 'bg-slate-950 text-emerald-300'
                  : 'bg-emerald-950/60 text-emerald-400 border border-emerald-500/30'
              }`}
            >
              Vol 10➔100 • 500 Ticks
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubBot('COLDEST_6_PERCENT')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
              activeSubBot === 'COLDEST_6_PERCENT'
                ? 'bg-gradient-to-r from-cyan-500 via-sky-400 to-indigo-500 text-slate-950 shadow-lg shadow-cyan-500/25 ring-2 ring-cyan-300'
                : 'text-slate-400 hover:text-white bg-slate-950/80 hover:bg-slate-850 border border-slate-800'
            }`}
          >
            <Snowflake className={`w-4 h-4 ${activeSubBot === 'COLDEST_6_PERCENT' ? 'text-slate-950 animate-spin-slow' : 'text-cyan-400'}`} />
            <span>Coldest 6.0% Drop Sniper</span>
            <span
              className={`text-[9px] px-2 py-0.5 rounded-full font-mono font-bold ${
                activeSubBot === 'COLDEST_6_PERCENT'
                  ? 'bg-slate-950 text-cyan-300'
                  : 'bg-cyan-950/60 text-cyan-400 border border-cyan-500/30'
              }`}
            >
              Exact 6.0% Differ
            </span>
          </button>
        </div>

        <div className="text-[11px] font-mono text-slate-400 pr-2 hidden md:block">
          {activeSubBot === 'LOWEST_FREQUENCY' ? (
            <span className="flex items-center gap-1.5 text-emerald-300 font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Sequential Mode: Vol 10 ➔ 25 ➔ 50 ➔ 75 ➔ 100 (500 Ticks Sample)
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-cyan-300 font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
              Sniper Mode: Waits for unique coldest digit to drop to exactly 6.0%
            </span>
          )}
        </div>
      </div>

      {activeSubBot === 'LOWEST_FREQUENCY' ? (
        <LowestFrequencyBotView balanceUsd={balanceUsd} onUpdateBalance={onUpdateBalance} />
      ) : (
        <>
          {/* ❄️ HERO HEADER CARD */}
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-sky-950/40 to-slate-950 border border-cyan-500/30 p-5 sm:p-6 shadow-2xl shadow-cyan-950/20">
        <div className="absolute top-0 right-0 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-rose-500/10 rounded-full blur-3xl pointer-events-none -ml-20 -mb-20" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-2xl bg-gradient-to-tr from-cyan-500 via-sky-400 to-indigo-500 text-slate-950 shadow-lg shadow-cyan-500/30 font-black">
                <Snowflake className="w-7 h-7 animate-spin-slow text-slate-950" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-2xl font-black tracking-tight text-white flex items-center gap-2">
                    Coldest Frequency Bot
                  </h1>
                  <span className="text-xs px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
                    STRICT 6.0% ONLY • Sole Coldest Differ
                  </span>
                  <span className="text-xs px-2.5 py-0.5 rounded-full font-mono font-bold bg-slate-950 text-slate-300 border border-slate-800">
                    1-Tick Settlement
                  </span>
                </div>
                <p className="text-xs text-slate-300 mt-1 max-w-2xl leading-relaxed">
                  Scans real digit percentage distribution. The bot trades{' '}
                  <strong className="text-cyan-300 font-bold">ONLY when the coldest digit drops to EXACTLY 6.0%</strong>{' '}
                  (no other percentage below or above 6%). Must be strictly the sole coldest digit on that market. If that market has another digit which has 6.0% and is not the coldest, the bot ignores it and scans another market. Rising percentages are strictly ignored.
                </p>
              </div>
            </div>
          </div>

          {/* Action Controls & Bot Status */}
          <div className="flex flex-wrap items-center gap-3">
            {status.isRunning ? (
              <button
                type="button"
                onClick={() => coldestFrequencyBotEngine.stopBot()}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-black bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white shadow-lg shadow-rose-500/30 transition-all cursor-pointer active:scale-95"
              >
                <Square className="w-4 h-4 fill-white" />
                <span>Stop Bot</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => coldestFrequencyBotEngine.startBot()}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-black bg-gradient-to-r from-cyan-500 via-sky-400 to-indigo-500 hover:from-cyan-400 hover:to-indigo-400 text-slate-950 shadow-lg shadow-cyan-500/30 transition-all cursor-pointer active:scale-95"
              >
                <Play className="w-4 h-4 fill-slate-950" />
                <span>Start Coldest Scanner</span>
              </button>
            )}

            {/* Test Differ Sniper Trigger */}
            <button
              type="button"
              disabled={status.isTradeActive || !marketState}
              onClick={() => coldestFrequencyBotEngine.triggerManualDifferTest()}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-mono font-bold bg-slate-900 hover:bg-slate-800 text-cyan-300 border border-cyan-500/30 transition-all disabled:opacity-40"
              title="Execute immediate Differ contract test on the current coldest digit"
            >
              <Zap className="w-3.5 h-3.5 text-cyan-400" />
              <span>Test Differ ≠ [{coldestDigit}]</span>
            </button>

            {/* Reset Stats */}
            <button
              type="button"
              onClick={() => coldestFrequencyBotEngine.resetStats()}
              className="p-2.5 rounded-xl bg-slate-900/80 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 transition-all"
              title="Reset Performance Stats"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Live Engine Status Sub-Banner */}
        <div className="mt-4 pt-3 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
          <div className="flex items-center gap-2">
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                status.isTradeActive
                  ? 'bg-amber-400 animate-ping'
                  : status.isRunning
                  ? 'bg-emerald-400 animate-pulse'
                  : 'bg-slate-500'
              }`}
            />
            <span className="text-slate-300 font-bold">
              {status.isTradeActive
                ? 'CONTRACT ACTIVE • WAITING NEXT TICK SETTLEMENT'
                : status.isRunning
                ? 'SCANNING TICKS & FREQUENCIES'
                : 'ENGINE IDLE'}
            </span>
            <span className="text-slate-600">•</span>
            <span className="text-slate-400">{status.statusMessage}</span>
          </div>

          <div className="flex items-center gap-3 text-slate-400">
            <span>
              Market: <strong className="text-cyan-300">{marketState?.marketName || config.targetMarket}</strong>
            </span>
            <span>•</span>
            <span>
              Sample: <strong className="text-white">{marketState?.sampleCount || config.sampleSize} ticks</strong>
            </span>
          </div>
        </div>
      </div>

      {/* ⚠️ STRICT RULE ALERTS & NOTICES */}
      {qualStatus === 'ANOTHER_DIGIT_6_NOT_COLDEST' && (
        <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/40 text-amber-200 text-xs flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
            <span>
              <strong>Market Ignored:</strong> Another digit on {marketState?.symbol} has 6.0% but is NOT the coldest digit (coldest is [{coldestDigit}] @ {coldestPct.toFixed(1)}%). Bot ignores this market and scans other markets per rule!
            </span>
          </div>
          <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold shrink-0">
            Scanning Another Market
          </span>
        </div>
      )}

      {qualStatus === 'TIED_OR_DUPLICATE_6' && (
        <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/40 text-amber-200 text-xs flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
            <span>
              <strong>Market Ignored (Duplicate 6.0% Tie):</strong> Multiple digits share 6.0% on {marketState?.symbol}. Not strictly unique — bot ignores this market and scans another market!
            </span>
          </div>
          <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold shrink-0">
            Tied ➔ Scanning Another
          </span>
        </div>
      )}

      {qualStatus === 'QUALIFIED' && (
        <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/50 text-emerald-200 text-xs flex items-center justify-between gap-3 shadow-lg shadow-emerald-500/10 animate-pulse">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>
              <strong>🎯 STRICT ENTRY QUALIFIED:</strong> Coldest digit [{coldestDigit}] on {marketState?.symbol} dropped to EXACTLY 6.0% (strictly sole unique coldest digit, no ties, frequency not rising)!
            </span>
          </div>
          <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-emerald-500 text-slate-950 font-black shrink-0">
            1-Tick Differ Armed
          </span>
        </div>
      )}

      {/* 📊 4 KEY METRICS HUD */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1: Active Coldest Digit */}
        <div
          className={`p-4 rounded-2xl border transition-all ${
            isArmed
              ? 'bg-gradient-to-br from-cyan-950/60 to-slate-900 border-cyan-400 shadow-xl shadow-cyan-500/10 ring-1 ring-cyan-400/50'
              : 'bg-slate-900/90 border-slate-800'
          }`}
        >
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
            <span className="uppercase font-bold tracking-wider flex items-center gap-1.5">
              <Snowflake className="w-3.5 h-3.5 text-cyan-400" />
              <span>Coldest Digit</span>
            </span>
            <span
              className={`px-2 py-0.5 rounded-full font-mono text-[10px] font-bold ${
                coldestPct === 6.0 && isArmed
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                  : coldestPct < 6.0
                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                  : 'bg-slate-800 text-slate-400'
              }`}
            >
              EXACT 6.0% TARGET ONLY
            </span>
          </div>
          <div className="flex items-baseline justify-between mt-2">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black font-mono text-cyan-300">
                [{coldestDigit}]
              </span>
              <span
                className={`text-xl font-bold font-mono ${
                  coldestPct === 6.0 ? 'text-emerald-400 font-black' : 'text-slate-300'
                }`}
              >
                {coldestPct.toFixed(1)}%
              </span>
            </div>
            <span className="text-[11px] font-mono text-slate-400">
              {digitStats[coldestDigit]?.count || 0} hits
            </span>
          </div>
          <div className="mt-2 text-[11px] font-mono text-slate-400 flex items-center gap-1">
            {coldestPct === 6.0 ? (
              isArmed ? (
                <span className="text-emerald-400 font-bold flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Exact 6.0% Drop Hit (Unique Coldest)</span>
                </span>
              ) : qualStatus === 'RISING_IGNORED' ? (
                <span className="text-rose-400 font-bold flex items-center gap-1">
                  <XCircle className="w-3.5 h-3.5" />
                  <span>6.0% but Rising (Ignored by rule)</span>
                </span>
              ) : (
                <span className="text-amber-400 font-bold flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>6.0% Tied / Another digit exists</span>
                </span>
              )
            ) : coldestPct < 6.0 ? (
              <span className="text-amber-400 font-semibold">
                Below 6.0% ({coldestPct.toFixed(1)}%) — Strictly Ignored
              </span>
            ) : (
              <span className="text-slate-500">
                Above 6.0% — Needs {(coldestPct - 6.0).toFixed(1)}% drop to trigger
              </span>
            )}
          </div>
        </div>

        {/* Metric 2: Trend Direction (Drops to 6.0% vs Rising Ignored) */}
        <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
            <span className="uppercase font-bold tracking-wider flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-amber-400" />
              <span>Frequency Trend</span>
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 font-mono">
              Rising % Ignored
            </span>
          </div>
          <div className="flex items-center justify-between mt-2">
            <div className="flex items-center gap-2">
              {trendDir === 'DROPPING' ? (
                <>
                  <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
                    <TrendingDown className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-base font-black text-emerald-400 font-mono">
                      DROPPING 🟢
                    </div>
                    <div className="text-[10px] text-slate-400">Valid Entry Drop</div>
                  </div>
                </>
              ) : trendDir === 'RISING' ? (
                <>
                  <div className="p-2 rounded-xl bg-rose-500/20 text-rose-400 border border-rose-500/40">
                    <TrendingUp className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-base font-black text-rose-400 font-mono">
                      RISING 🔴
                    </div>
                    <div className="text-[10px] text-rose-300">Strictly Ignored</div>
                  </div>
                </>
              ) : (
                <>
                  <div className="p-2 rounded-xl bg-slate-800 text-slate-400">
                    <Activity className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-base font-black text-slate-300 font-mono">
                      STEADY / DORMANT
                    </div>
                    <div className="text-[10px] text-slate-400">No Rebound</div>
                  </div>
                </>
              )}
            </div>
          </div>
          <div className="mt-2 text-[11px] font-mono text-slate-400">
            Last Generated Tick: <strong className="text-white">[{marketState?.lastDigit ?? 0}]</strong>
            {marketState?.lastDigit === coldestDigit && (
              <span className="text-rose-400 font-bold ml-1">(Hit Coldest ➔ Rising Ignored)</span>
            )}
          </div>
        </div>

        {/* Metric 3: Differ Target & Settle Rule */}
        <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
            <span className="uppercase font-bold tracking-wider flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-emerald-400" />
              <span>Differ Contract</span>
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-mono font-bold">
              1-TICK SETTLE
            </span>
          </div>
          <div className="mt-2">
            <div className="text-lg font-black font-mono text-emerald-400 flex items-center gap-1.5">
              <span>Differ ≠ [{coldestDigit}]</span>
            </div>
            <div className="text-[11px] text-slate-400 mt-1">
              Next generated tick settles trade immediately. Wins if exit digit ≠ {coldestDigit}.
            </div>
          </div>
          <div className="mt-2 text-[11px] font-mono text-slate-400 flex items-center justify-between">
            <span>Next Stake:</span>
            <strong className="text-white">${status.currentStake.toFixed(2)} USD</strong>
          </div>
        </div>

        {/* Metric 4: P&L & Scorecard */}
        <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
            <span className="uppercase font-bold tracking-wider flex items-center gap-1.5">
              <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
              <span>Net Profit & Win Rate</span>
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-mono">
              {status.totalTrades} Trades
            </span>
          </div>
          <div className="flex items-baseline justify-between mt-2">
            <span
              className={`text-2xl font-black font-mono ${
                status.netProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              {status.netProfit >= 0 ? '+' : ''}
              {status.netProfit.toFixed(2)} USD
            </span>
            <span className="text-sm font-black font-mono text-cyan-300">
              {status.winRate.toFixed(1)}%
            </span>
          </div>
          <div className="mt-2 text-[11px] font-mono text-slate-400 flex items-center justify-between">
            <span>
              Wins: <strong className="text-emerald-400">{status.wins}</strong> / Losses:{' '}
              <strong className="text-rose-400">{status.losses}</strong>
            </span>
            {status.consecutiveLosses > 0 && (
              <span className="text-rose-400 font-bold">Streak: -{status.consecutiveLosses}</span>
            )}
          </div>
        </div>
      </div>

      {/* 📊 REAL DIGIT PERCENTAGE DISTRIBUTION VISUALIZER BARS */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Percent className="w-5 h-5 text-cyan-400" />
              <span>Real Digit Percentage Distribution</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-mono font-normal">
                Sample: {marketState?.sampleCount || config.sampleSize} Ticks
              </span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 font-mono font-bold border border-cyan-500/30">
                Trigger Target: EXACT 6.0% (Sole Coldest Only)
              </span>
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Exact frequency distribution matching Deriv formula. The bot triggers{' '}
              <strong className="text-white">ONLY when the coldest digit drops to exactly 6.0%</strong>. Digits with 6.0% that are not the coldest are strictly ignored.
            </p>
          </div>

          {/* Market Quick Switcher */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 uppercase font-semibold">Market:</span>
            <select
              value={config.targetMarket}
              onChange={(e) => {
                const sym = e.target.value as MarketSymbol | 'ALL';
                handleConfigChange({ targetMarket: sym });
              }}
              className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-1.5 text-xs font-mono font-bold text-cyan-300 focus:outline-none focus:border-cyan-400"
            >
              <option value="ALL">🌐 Multi-Market (Scan All Volatilities)</option>
              {COLDEST_BOT_MARKETS.map((m) => (
                <option key={m.symbol} value={m.symbol}>
                  {m.shortName} (Vol {m.volatility})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* 10 Vertical Percentage Bars with 6.0% Reference Line */}
        <div className="relative pt-6 pb-2">
          {/* Dashed Threshold Line at 6.0% */}
          {(() => {
            const maxPct = Math.max(...digitStats.map((d) => d.percentage), 20);
            const lineBottomPercent = Math.min(100, (6.0 / maxPct) * 100);
            return (
              <div
                style={{ bottom: `calc(${lineBottomPercent}% + 42px)` }}
                className="absolute left-0 right-0 z-20 pointer-events-none flex items-center"
              >
                <div className="w-full border-b-2 border-dashed border-rose-500/80" />
                <span className="shrink-0 ml-2 px-1.5 py-0.5 rounded bg-rose-500 text-white font-mono font-black text-[10px] shadow-sm">
                  EXACT 6.0% TARGET
                </span>
              </div>
            );
          })()}

          <div className="grid grid-cols-10 gap-1.5 sm:gap-3">
            {digitStats.map((item) => {
              const maxPct = Math.max(...digitStats.map((d) => d.percentage), 20);
              const heightPercent = Math.max(12, Math.min(100, (item.percentage / maxPct) * 100));
              const isExactSix = item.percentage === 6.0;
              const isBelowSix = item.percentage < 6.0;

              let barColor = 'bg-slate-700 text-slate-200';
              let ringClass = '';

              if (item.isColdest) {
                if (isExactSix && isArmed) {
                  barColor = 'bg-gradient-to-t from-cyan-600 via-sky-500 to-indigo-500 text-slate-950 font-black';
                  ringClass = 'ring-2 ring-cyan-400 shadow-lg shadow-cyan-500/30';
                } else if (isBelowSix) {
                  barColor = 'bg-gradient-to-t from-rose-700 to-rose-500 text-white';
                  ringClass = 'ring-1 ring-rose-400';
                } else {
                  barColor = 'bg-gradient-to-t from-slate-600 to-slate-500 text-slate-200';
                }
              } else if (isExactSix) {
                // Digit has 6.0% but is NOT the coldest digit!
                barColor = 'bg-amber-600/80 text-white';
                ringClass = 'ring-1 ring-amber-400/80 border-dashed';
              } else if (item.isHottest) {
                barColor = 'bg-gradient-to-t from-emerald-600 to-emerald-400 text-white';
              } else if (item.percentage >= 12) {
                barColor = 'bg-cyan-600/70 text-white';
              }

              return (
                <div
                  key={item.digit}
                  className={`flex flex-col items-center justify-end p-1.5 sm:p-2 rounded-2xl border transition-all ${
                    item.isColdest && isExactSix && isArmed
                      ? 'bg-cyan-950/40 border-cyan-400 ring-2 ring-cyan-400/40'
                      : isExactSix && !item.isColdest
                      ? 'bg-amber-950/30 border-amber-500/40'
                      : item.isCurrent
                      ? 'bg-slate-800/80 border-cyan-500/60'
                      : 'bg-slate-950/60 border-slate-800'
                  }`}
                >
                  {/* Current Indicator Arrow */}
                  <div className="h-4 flex items-center justify-center">
                    {item.isCurrent && (
                      <span className="text-[10px] text-cyan-400 font-bold animate-bounce">▼</span>
                    )}
                  </div>

                  {/* Percentage Label */}
                  <div className="text-[11px] sm:text-xs font-mono font-black mb-1.5">
                    <span
                      className={
                        item.isColdest
                          ? isExactSix
                            ? 'text-cyan-300 font-black'
                            : isBelowSix
                            ? 'text-rose-400'
                            : 'text-slate-300'
                          : isExactSix
                          ? 'text-amber-400 font-bold'
                          : item.isHottest
                          ? 'text-emerald-400'
                          : 'text-slate-300'
                      }
                    >
                      {item.percentage.toFixed(1)}%
                    </span>
                  </div>

                  {/* Vertical Bar Visual */}
                  <div className="w-full h-36 sm:h-44 bg-slate-950 rounded-xl p-1 flex flex-col justify-end overflow-hidden relative">
                    <div
                      style={{ height: `${heightPercent}%` }}
                      className={`w-full rounded-lg transition-all duration-300 flex items-start justify-center pt-1.5 ${barColor} ${ringClass}`}
                    >
                      <span className="text-[10px] font-mono font-bold opacity-90">{item.count}</span>
                    </div>
                  </div>

                  {/* Digit Button */}
                  <div
                    className={`mt-2 w-8 h-8 rounded-xl flex items-center justify-center font-mono font-black text-sm sm:text-base border transition-all ${
                      item.isColdest && isExactSix && isArmed
                        ? 'bg-cyan-500 text-slate-950 border-cyan-400 shadow-md shadow-cyan-500/40'
                        : item.isColdest
                        ? 'bg-rose-500 text-white border-rose-400'
                        : isExactSix
                        ? 'bg-amber-500 text-slate-950 border-amber-400'
                        : item.isCurrent
                        ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/50'
                        : 'bg-slate-900 text-slate-300 border-slate-700'
                    }`}
                  >
                    {item.digit}
                  </div>

                  {/* Tag */}
                  <div className="h-4 flex items-center justify-center mt-1">
                    {item.isColdest ? (
                      <span className="text-[9px] font-mono font-bold text-cyan-400 uppercase">
                        {isExactSix ? 'COLD 6%' : isBelowSix ? '< 6%' : 'COLD'}
                      </span>
                    ) : isExactSix ? (
                      <span className="text-[8px] font-mono font-bold text-amber-400 uppercase" title="6.0% but not coldest - ignored">
                        NOT COLD
                      </span>
                    ) : item.isHottest ? (
                      <span className="text-[9px] font-mono font-bold text-emerald-400 uppercase">HOT</span>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 🌐 MULTI-MARKET COLDEST FREQUENCY SCANNER MATRIX */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider text-white flex items-center gap-2">
              <Layers className="w-4 h-4 text-cyan-400" />
              <span>Multi-Market Coldest Frequency Scanner Matrix</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Live tracking across all 13 volatility indices. The bot auto-scans for markets where the coldest digit drops to 6.0% and is strictly the sole coldest.
            </p>
          </div>
          <span className="text-xs font-mono text-slate-400">
            {allMarketStates.size} Markets Active
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {COLDEST_BOT_MARKETS.map((m) => {
            const st = allMarketStates.get(m.symbol);
            const isCurrentFocus = marketState?.symbol === m.symbol;
            const isMktArmed = st?.isTriggerArmed ?? false;
            const mktColdest = st?.coldestDigit ?? 0;
            const mktColdestPct = st?.coldestPct ?? 10.0;
            const mktQual = st?.qualificationStatus ?? 'NOT_EXACT_6_ABOVE';
            const mktSixDigits = st?.digitStats.filter((d) => d.percentage === 6.0).map((d) => d.digit) ?? [];

            return (
              <div
                key={m.symbol}
                onClick={() => {
                  coldestFrequencyBotEngine.updateMarketState(m.symbol);
                  handleConfigChange({ targetMarket: m.symbol });
                }}
                className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
                  isMktArmed
                    ? 'bg-gradient-to-br from-emerald-950/40 via-cyan-950/40 to-slate-900 border-cyan-400 ring-2 ring-cyan-400/40 shadow-lg shadow-cyan-500/20'
                    : isCurrentFocus
                    ? 'bg-slate-800/90 border-cyan-500/50'
                    : 'bg-slate-950/60 border-slate-800/80 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white flex items-center gap-1.5">
                    <span>{m.shortName}</span>
                    {isCurrentFocus && (
                      <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                    )}
                  </span>
                  <span className="text-[10px] font-mono text-slate-400">
                    Last: [{st?.lastDigit ?? '-'}]
                  </span>
                </div>

                <div className="mt-2 flex items-baseline justify-between">
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-xs text-slate-400">Coldest:</span>
                    <span className="text-sm font-black font-mono text-cyan-300">
                      [{mktColdest}]
                    </span>
                    <span
                      className={`text-xs font-mono font-bold ${
                        mktColdestPct === 6.0 ? 'text-emerald-400 font-black' : 'text-slate-300'
                      }`}
                    >
                      {mktColdestPct.toFixed(1)}%
                    </span>
                  </div>
                  {mktSixDigits.length > 0 && (
                    <span className="text-[10px] font-mono text-amber-300 bg-amber-500/10 px-1.5 py-0.2 rounded border border-amber-500/30">
                      6.0%: [{mktSixDigits.join(',')}]
                    </span>
                  )}
                </div>

                <div className="mt-2.5 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[10px]">
                  {mktQual === 'QUALIFIED' ? (
                    <span className="text-emerald-300 font-black flex items-center gap-1">
                      <Sparkles className="w-3 h-3 text-emerald-400" />
                      <span>EXACT 6.0% ARMED 🎯</span>
                    </span>
                  ) : mktQual === 'ANOTHER_DIGIT_6_NOT_COLDEST' ? (
                    <span className="text-amber-400 font-bold">
                      6.0% NOT COLDEST ➔ IGNORED
                    </span>
                  ) : mktQual === 'TIED_OR_DUPLICATE_6' ? (
                    <span className="text-amber-400 font-bold">
                      DUPLICATE 6.0% TIE ➔ IGNORED
                    </span>
                  ) : mktQual === 'RISING_IGNORED' ? (
                    <span className="text-rose-400 font-bold">
                      6.0% RISING ➔ IGNORED
                    </span>
                  ) : mktQual === 'NOT_EXACT_6_BELOW' ? (
                    <span className="text-slate-500">
                      &lt; 6.0% IGNORED
                    </span>
                  ) : (
                    <span className="text-slate-500">
                      &gt; 6.0% (WAITING DROP)
                    </span>
                  )}

                  <span className="text-slate-400 font-mono text-[9px] hover:text-cyan-300">
                    Focus →
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ⚙️ BOT CONFIGURATION & CONTROLS SECTION */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Stake & Risk Management (7 Cols) */}
        <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xl space-y-5">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="text-sm font-bold uppercase tracking-wider text-white flex items-center gap-2">
              <Sliders className="w-4 h-4 text-cyan-400" />
              <span>Coldest Frequency Settings & Money Management</span>
            </h3>
            <span className="text-xs text-slate-400 font-mono">1-Tick Differ Execution</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Base Stake */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
                <span>Base Stake (USD)</span>
              </label>
              <input
                type="number"
                min="0.35"
                step="0.5"
                disabled={status.isRunning}
                value={config.baseStake}
                onChange={(e) =>
                  handleConfigChange({
                    baseStake: Math.max(0.35, parseFloat(e.target.value) || 0.35),
                  })
                }
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm font-mono text-white focus:outline-none focus:border-cyan-400"
              />
            </div>

            {/* Stake Mode */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">Money Management Mode</label>
              <select
                disabled={status.isRunning}
                value={config.stakeMode}
                onChange={(e) => handleConfigChange({ stakeMode: e.target.value as any })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm font-mono text-cyan-300 focus:outline-none focus:border-cyan-400"
              >
                <option value="FLAT">Flat Fixed Stake</option>
                <option value="MARTINGALE">Martingale (x11 on Loss)</option>
                <option value="COMPOUND">Compounding Reinvestment</option>
                <option value="BALANCE_PERCENT">1% of Balance Staking</option>
              </select>
            </div>

            {/* Coldest Drop Threshold (Locked to 6.0% by user rule) */}
            <div className="space-y-1.5 p-3 rounded-2xl bg-slate-950/80 border border-cyan-500/30 sm:col-span-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                  <Snowflake className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Coldest Trigger Threshold</span>
                  <Lock className="w-3 h-3 text-cyan-400" />
                </label>
                <span className="text-xs px-2 py-0.5 rounded-full font-mono font-black bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
                  EXACT 6.0% ONLY
                </span>
              </div>
              <div className="flex items-center gap-2 mt-1">
                <div className="flex-1 py-2 px-3 text-xs font-mono font-black rounded-xl bg-cyan-500 text-slate-950 border border-cyan-400 flex items-center justify-between shadow-sm">
                  <span>6.0% (STRICT EXACT TARGET — NO BELOW / NO ABOVE)</span>
                  <span className="text-[10px] uppercase font-bold bg-slate-950/20 px-1.5 py-0.5 rounded">
                    LOCKED BY RULE
                  </span>
                </div>
              </div>
              <p className="text-[11px] text-slate-400 mt-1 leading-snug">
                Strict Rule Active: The bot will NOT trade any percentage below 6.0% or above 6.0%. It only waits for the coldest digit % to drop to exactly 6.0%, and ignores markets if another digit has 6.0% or if rising.
              </p>
            </div>

            {/* Sample Window */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Sample Size (Deriv Window)</span>
                </label>
                <span className="text-xs font-mono font-bold text-indigo-300">
                  {config.sampleSize} ticks
                </span>
              </div>
              <div className="grid grid-cols-4 gap-1.5">
                {[50, 100, 200, 500].map((sz) => (
                  <button
                    key={sz}
                    type="button"
                    disabled={status.isRunning}
                    onClick={() => handleConfigChange({ sampleSize: sz })}
                    className={`py-1.5 text-xs font-mono font-bold rounded-lg border transition-all ${
                      config.sampleSize === sz
                        ? 'bg-indigo-600 text-white border-indigo-500 font-black'
                        : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white disabled:opacity-50'
                    }`}
                  >
                    {sz}t{sz === 100 ? ' ★' : ''}
                  </button>
                ))}
              </div>
            </div>

            {/* Auto-Scan Another Market */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-cyan-400" />
                <span>Auto-Scan Other Markets</span>
              </label>
              <div className="py-2 px-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between text-xs">
                <span className="text-slate-300 font-mono">Scan on Tie / Non-Cold 6%</span>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-mono font-bold text-[10px]">
                  ACTIVE (ALWAYS)
                </span>
              </div>
            </div>

            {/* Take Profit */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">Take Profit Limit (USD)</label>
              <input
                type="number"
                min="1"
                step="5"
                disabled={status.isRunning}
                value={config.takeProfit}
                onChange={(e) =>
                  handleConfigChange({ takeProfit: parseFloat(e.target.value) || 10 })
                }
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm font-mono text-emerald-400 focus:outline-none focus:border-emerald-500"
              />
            </div>

            {/* Stop Loss */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">Stop Loss Limit (USD)</label>
              <input
                type="number"
                min="1"
                step="5"
                disabled={status.isRunning}
                value={config.stopLoss}
                onChange={(e) =>
                  handleConfigChange({ stopLoss: parseFloat(e.target.value) || 25 })
                }
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm font-mono text-rose-400 focus:outline-none focus:border-rose-500"
              />
            </div>
          </div>

          {/* Mode Toggles */}
          <div className="pt-2 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-3 text-xs">
            <label className="flex items-center gap-2 cursor-pointer text-slate-300">
              <input
                type="checkbox"
                disabled={status.isRunning}
                checked={config.singleTradeMode}
                onChange={(e) => handleConfigChange({ singleTradeMode: e.target.checked })}
                className="rounded bg-slate-950 border-slate-700 text-cyan-500 focus:ring-0"
              />
              <span>Single Trade Settle (Stop after 1 execution)</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer text-slate-300">
              <input
                type="checkbox"
                disabled={status.isRunning}
                checked={config.forceVirtual}
                onChange={(e) => handleConfigChange({ forceVirtual: e.target.checked })}
                className="rounded bg-slate-950 border-slate-700 text-amber-500 focus:ring-0"
              />
              <span className="text-amber-300 font-semibold">Virtual / Demo Mode</span>
            </label>
          </div>
        </div>

        {/* Right Column: Execution Rules & Strategy Guide (5 Cols) */}
        <div className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="text-sm font-bold uppercase tracking-wider text-white flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Coldest Rule Enforcements</span>
            </h3>
            <span className="text-xs px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 font-mono font-bold">
              STRICT LOGIC
            </span>
          </div>

          <div className="space-y-3 text-xs text-slate-300 leading-relaxed">
            <div className="p-3 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-1">
              <div className="font-bold text-cyan-300 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400" />
                <span>1. Strict Exact 6.0% Target Only</span>
              </div>
              <p className="text-[11px] text-slate-400">
                The bot will not trade any other percentage whether below 6% or above 6%. It waits for the coldest digit % to drop to exactly 6.0%.
              </p>
            </div>

            <div className="p-3 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-1">
              <div className="font-bold text-amber-300 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-amber-400" />
                <span>2. Sole Unique Coldest Digit Rule</span>
              </div>
              <p className="text-[11px] text-slate-400">
                If the market has another digit which has 6.0% and is not the coldest (or multiple digits tie at 6.0%), the bot ignores that market and scans another market.
              </p>
            </div>

            <div className="p-3 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-1">
              <div className="font-bold text-rose-400 flex items-center gap-1.5">
                <XCircle className="w-3.5 h-3.5 text-rose-400" />
                <span>3. Ignore Rising % Rule</span>
              </div>
              <p className="text-[11px] text-slate-400">
                If the coldest digit hits on the latest tick, its percentage is rising. The bot strictly ignores rising ticks to avoid false breakouts.
              </p>
            </div>

            <div className="p-3 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-1">
              <div className="font-bold text-emerald-400 flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-emerald-400" />
                <span>4. Immediate 1-Tick Differ Settle</span>
              </div>
              <p className="text-[11px] text-slate-400">
                Buys contract <strong className="text-white">Differ ≠ [coldestDigit]</strong>. The immediate next tick generated closes and settles the trade.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 📜 RECENT TRADES HISTORY LOG */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <h3 className="text-sm font-bold uppercase tracking-wider text-white flex items-center gap-2">
            <Clock className="w-4 h-4 text-cyan-400" />
            <span>Recent Coldest Differ Trades ({trades.length})</span>
          </h3>
          <span className="text-xs text-slate-400 font-mono">1-Tick Settled Contracts</span>
        </div>

        {trades.length === 0 ? (
          <div className="py-8 text-center text-slate-500 font-mono text-xs">
            No trades recorded yet. Start the bot to begin scanning for exact 6.0% coldest drop triggers.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left font-mono text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 text-[11px] uppercase">
                  <th className="py-2 px-3">Time</th>
                  <th className="py-2 px-3">Market</th>
                  <th className="py-2 px-3">Coldest Digit</th>
                  <th className="py-2 px-3">Trigger %</th>
                  <th className="py-2 px-3">Direction</th>
                  <th className="py-2 px-3">Stake</th>
                  <th className="py-2 px-3">Exit Digit</th>
                  <th className="py-2 px-3">Outcome</th>
                  <th className="py-2 px-3">Profit</th>
                  <th className="py-2 px-3">Trigger Reason</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {trades.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-2.5 px-3 text-slate-400">{t.timeString}</td>
                    <td className="py-2.5 px-3 text-cyan-300 font-bold">{t.marketName}</td>
                    <td className="py-2.5 px-3">
                      <span className="px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 font-black border border-cyan-500/30">
                        Differ ≠ [{t.coldestDigit}]
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-slate-200 font-bold">
                      {t.coldestPct.toFixed(1)}%
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="text-emerald-400 font-bold">DROPPING 🟢</span>
                    </td>
                    <td className="py-2.5 px-3 text-white font-bold">${t.stake.toFixed(2)}</td>
                    <td className="py-2.5 px-3 text-slate-300">
                      {t.exitDigit !== undefined ? (
                        <span className="font-bold text-white">[{t.exitDigit}]</span>
                      ) : (
                        <span className="text-slate-500">Pending</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3">
                      {t.result === 'WIN' ? (
                        <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold">
                          WON
                        </span>
                      ) : t.result === 'LOSS' ? (
                        <span className="px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40 font-bold">
                          LOST
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold animate-pulse">
                          OPEN
                        </span>
                      )}
                    </td>
                    <td
                      className={`py-2.5 px-3 font-bold ${
                        t.profit > 0
                          ? 'text-emerald-400'
                          : t.profit < 0
                          ? 'text-rose-400'
                          : 'text-slate-400'
                      }`}
                    >
                      {t.profit > 0 ? '+' : ''}
                      {t.profit.toFixed(2)} USD
                    </td>
                    <td className="py-2.5 px-3 text-[11px] text-slate-400 max-w-xs truncate" title={t.reason}>
                      {t.reason}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  )}
</div>
);
};
