import React, { useState, useEffect, useMemo } from 'react';
import {
  derivDigitScannerBot,
  ScannerBotStatus,
  ScannerTradeRecord,
  ScannerBotConfig,
  ScannerStakeMode,
  ScannerExecutionMode,
  StreakRepeatMode,
  MarketDigitAnalysis,
  VolatilityScannerMarket,
  ScannerMarketScope,
  ALL_SCANNER_MARKETS,
} from '../../services/derivDigitScannerBot';
import { derivWS, extractDerivLastDigit, formatDerivQuote, getMarketPipSize } from '../../services/derivWebSocket';
import {
  Activity,
  Play,
  Square,
  RefreshCw,
  RotateCcw,
  Flame,
  Snowflake,
  ShieldCheck,
  ShieldAlert,
  Zap,
  TrendingUp,
  TrendingDown,
  Percent,
  Layers,
  ArrowRight,
  Sliders,
  DollarSign,
  Clock,
  CheckCircle2,
  XCircle,
  BarChart2,
  ChevronRight,
  AlertCircle,
  Cpu,
  Radar,
  Sparkles,
  ArrowUpRight,
  Repeat,
  Coins,
  Crosshair,
  Filter,
  Eye,
  Lock,
  Compass,
} from 'lucide-react';
import { soundManager } from '../../utils/soundEffects';

interface AiScannerBotPanelProps {
  balanceUsd: number;
  onUpdateBalance?: (newBalance: number) => void;
}

export const AiScannerBotPanel: React.FC<AiScannerBotPanelProps> = ({
  balanceUsd,
  onUpdateBalance,
}) => {
  const [status, setStatus] = useState<ScannerBotStatus>(() => derivDigitScannerBot.getStatus());
  const [trades, setTrades] = useState<ScannerTradeRecord[]>(() => derivDigitScannerBot.getTrades());
  const [analyses, setAnalyses] = useState<Record<string, MarketDigitAnalysis>>(() =>
    derivDigitScannerBot.getAllAnalyses()
  );
  const [config, setConfig] = useState<ScannerBotConfig>(() => derivDigitScannerBot.getConfig());
  const [selectedInspectionSymbol, setSelectedInspectionSymbol] = useState<string>('R_100');
  const [activeTab, setActiveTab] = useState<'RADAR' | 'INSPECTOR' | 'CONFIG' | 'LOGS'>('RADAR');

  // Sync balance
  useEffect(() => {
    derivDigitScannerBot.setBalance(balanceUsd);
  }, [balanceUsd]);

  useEffect(() => {
    derivDigitScannerBot.setBalanceUpdater((profit, newBalance) => {
      if (onUpdateBalance) onUpdateBalance(newBalance);
    });
  }, [onUpdateBalance]);

  // Subscribe to engine updates
  useEffect(() => {
    const unsubStatus = derivDigitScannerBot.subscribeStatus(setStatus);
    const unsubTrades = derivDigitScannerBot.subscribeTrades(setTrades);
    const unsubAnalysis = derivDigitScannerBot.subscribeAnalysis(setAnalyses);

    return () => {
      unsubStatus();
      unsubTrades();
      unsubAnalysis();
    };
  }, []);

  const handleConfigChange = (newValues: Partial<ScannerBotConfig>) => {
    const updated = { ...config, ...newValues };
    setConfig(updated);
    derivDigitScannerBot.setConfig(newValues);
  };

  const handleToggleStart = () => {
    if (status.isRunning) {
      derivDigitScannerBot.stop('Manually stopped by user');
    } else {
      derivDigitScannerBot.start();
    }
  };

  const handleReset = () => {
    derivDigitScannerBot.resetStats();
  };

  // Quick Manual Snipe on any analyzed market
  const handleManualSnipe = (market: VolatilityScannerMarket, targetDigit: number) => {
    soundManager.playStart();
    try {
      derivWS.purchaseContract({
        symbol: market.symbol,
        contractType: 'DIGITDIFF',
        stake: status.currentStake || config.baseStake,
        durationTicks: config.durationTicks,
        targetDigit,
        symbolName: market.name,
      });
    } catch (e) {
      console.error('Manual snipe error:', e);
    }
  };

  // Compounding Quick Presets
  const applyPreset = (
    preset: 'FULL_MARGIN' | 'COMPOUND_100' | 'COMPOUND_STEPS_3' | 'COMPOUND_50' | 'BALANCE_2PCT' | 'MARTINGALE' | 'FLAT'
  ) => {
    if (status.isRunning) return;
    soundManager.playButtonClick();

    if (preset === 'FULL_MARGIN') {
      const fullBal = balanceUsd > 0 ? Number(balanceUsd.toFixed(2)) : 10.0;
      handleConfigChange({
        baseStake: fullBal,
        stakeMode: 'COMPOUND',
        compoundReinvestPct: 100,
        compoundMaxSteps: 0,
        maxStakeCap: 0, // Uncapped
        takeProfit: 0,
        stopLoss: 0,
        continuousTrading: true,
      });
    } else if (preset === 'COMPOUND_100') {
      handleConfigChange({
        stakeMode: 'COMPOUND',
        compoundReinvestPct: 100,
        compoundMaxSteps: 0,
        maxStakeCap: 0,
        continuousTrading: true,
      });
    } else if (preset === 'COMPOUND_STEPS_3') {
      handleConfigChange({
        stakeMode: 'COMPOUND_STEPS',
        compoundReinvestPct: 100,
        compoundMaxSteps: 3,
        maxStakeCap: 0,
        continuousTrading: true,
      });
    } else if (preset === 'COMPOUND_50') {
      handleConfigChange({
        stakeMode: 'COMPOUND',
        compoundReinvestPct: 50,
        compoundMaxSteps: 0,
        maxStakeCap: 0,
        continuousTrading: true,
      });
    } else if (preset === 'BALANCE_2PCT') {
      handleConfigChange({
        stakeMode: 'BALANCE_PERCENT',
        compoundBalancePct: 2.0,
        maxStakeCap: 0,
        continuousTrading: true,
      });
    } else if (preset === 'MARTINGALE') {
      handleConfigChange({
        stakeMode: 'MARTINGALE',
        martingaleMultiplier: 11.0,
        maxMartingaleSteps: 2,
        continuousTrading: true,
      });
    } else if (preset === 'FLAT') {
      handleConfigChange({
        stakeMode: 'FLAT',
        continuousTrading: true,
      });
    }
  };

  const activeMarketList = useMemo(() => {
    return derivDigitScannerBot.getActiveMarketList();
  }, [config.marketScope]);

  const selectedAnalysis = analyses[selectedInspectionSymbol] || null;

  return (
    <div className="space-y-4 text-slate-100">
      {/* 🚀 TOP HERO HUD: 3x/4x Digit Repeat Streak Break Differ Scanner Bot */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-900 to-slate-950 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-2xl relative overflow-hidden">
        {status.isRunning && (
          <div className="absolute -right-20 -top-20 w-60 h-60 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none animate-pulse" />
        )}

        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          {/* Title & Core Controls */}
          <div>
            <div className="flex items-center gap-2.5">
              <div className={`p-2.5 rounded-xl border ${
                status.isRunning
                  ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400 animate-pulse'
                  : 'bg-indigo-500/10 border-indigo-500/30 text-indigo-400'
              }`}>
                <Crosshair className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg sm:text-xl font-black tracking-tight text-white flex items-center gap-2">
                    <span>Deriv 3x / 4x Repeat Streak Differ Scanner Bot</span>
                  </h2>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/40">
                    Live Breakout Strategy
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  Scans all markets for 3x or 4x digit repeat streaks (e.g. <strong className="text-amber-300">4,4,4</strong> or <strong className="text-amber-300">6,6,6,6</strong>), then buys <strong className="text-rose-400">Digit Differ</strong> on the immediate breaker digit (e.g. <strong className="text-emerald-400">Differ 5</strong> or <strong className="text-emerald-400">Differ 4</strong>).
                </p>
              </div>
            </div>
          </div>

          {/* Master Start / Stop & Reset */}
          <div className="flex items-center gap-3">
            <button
              onClick={handleReset}
              disabled={status.isRunning}
              title="Reset trade stats & history"
              className="p-3 rounded-xl bg-slate-950 border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-white transition-all disabled:opacity-50"
            >
              <RotateCcw className="w-5 h-5" />
            </button>

            <button
              onClick={handleToggleStart}
              className={`flex items-center gap-2 px-6 py-3 rounded-xl font-black text-sm tracking-wide transition-all shadow-xl active:scale-95 ${
                status.isRunning
                  ? 'bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white shadow-rose-600/30'
                  : 'bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 hover:from-emerald-400 hover:to-teal-400 text-slate-950 shadow-emerald-500/30'
              }`}
            >
              {status.isRunning ? (
                <>
                  <Square className="w-5 h-5 fill-current" />
                  <span>STOP SCANNER BOT</span>
                </>
              ) : (
                <>
                  <Play className="w-5 h-5 fill-current" />
                  <span>START 3x/4x STREAK BOT</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* 🧭 Strategy Settings & Execution Mode Switchers */}
        <div className="mt-4 pt-3 border-t border-slate-800/80 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {/* 1. Streak Trigger Criteria */}
          <div className="bg-slate-950 p-2 rounded-xl border border-slate-800 flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-400 px-1 flex items-center gap-1.5">
              <Repeat className="w-3.5 h-3.5 text-amber-400" />
              <span>Streak Criteria:</span>
            </span>
            <select
              value={config.streakRepeatMode}
              onChange={(e) => handleConfigChange({ streakRepeatMode: e.target.value as StreakRepeatMode })}
              className="bg-slate-900 text-amber-300 font-bold text-xs rounded-lg px-2.5 py-1 border border-slate-700 focus:outline-none"
            >
              <option value="3_OR_4_REPEATS">3x or 4x Repeats (e.g. 4,4,4,5 / 6,6,6,6,4)</option>
              <option value="3_REPEATS_ONLY">3x Repeats Only (e.g. 4,4,4 ➔ 5)</option>
              <option value="4_REPEATS_ONLY">4x Repeats Only (e.g. 6,6,6,6 ➔ 4)</option>
              <option value="3_OR_MORE_REPEATS">3x or More (3x, 4x, 5x+)</option>
            </select>
          </div>

          {/* 2. Execution Mode */}
          <div className="bg-slate-950 p-2 rounded-xl border border-slate-800 flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-400 px-1 flex items-center gap-1.5">
              <Compass className="w-3.5 h-3.5 text-indigo-400" />
              <span>Execution Mode:</span>
            </span>
            <select
              value={config.executionMode}
              onChange={(e) => handleConfigChange({ executionMode: e.target.value as ScannerExecutionMode })}
              className="bg-slate-900 text-emerald-400 font-bold text-xs rounded-lg px-2.5 py-1 border border-slate-700 focus:outline-none"
            >
              <option value="STREAK_BREAK_SNIPER">🎯 All-Market Sniper (Fastest)</option>
              <option value="STREAK_BREAK_WITH_AI_FILTER">🛡️ Streak + AI Safety Gate</option>
              <option value="SEQUENTIAL_STREAK_SCANNER">🔄 Sequential 10➔100 Step</option>
            </select>
          </div>

          {/* 3. Market Scope */}
          <div className="bg-slate-950 p-2 rounded-xl border border-slate-800 flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-400 px-1 flex items-center gap-1.5">
              <Radar className="w-3.5 h-3.5 text-cyan-400" />
              <span>Market Scope:</span>
            </span>
            <select
              value={config.marketScope}
              onChange={(e) => handleConfigChange({ marketScope: e.target.value as ScannerMarketScope })}
              className="bg-slate-900 text-cyan-300 font-bold text-xs rounded-lg px-2.5 py-1 border border-slate-700 focus:outline-none"
            >
              <option value="COMBINED_ALL">Combined (10 to 100 + 1s)</option>
              <option value="STANDARD_10_TO_100">Standard Vol 10 to 100</option>
              <option value="ONESECOND_10_TO_100">1-Second Vol 10 to 100</option>
              <option value="ALL_PLUS_HIGH_VOL">All + High Vol (150/250 1s)</option>
            </select>
          </div>
        </div>

        {/* 📡 Live Status Banner */}
        <div className="mt-3.5 p-3 rounded-xl bg-slate-950/80 border border-slate-800/90 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              {status.isRunning && (
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              )}
              <span
                className={`relative inline-flex rounded-full h-2.5 w-2.5 ${
                  status.isRunning ? (status.isWaitingForSetup ? 'bg-amber-400' : 'bg-emerald-500') : 'bg-slate-600'
                }`}
              ></span>
            </span>
            <span className="font-mono text-slate-300">
              {status.statusMessage}
            </span>
          </div>

          <div className="flex items-center gap-3 text-slate-400 font-mono text-[11px]">
            {status.readyStreakMarketsCount > 0 ? (
              <span className="text-emerald-400 font-bold flex items-center gap-1">
                <Flame className="w-3.5 h-3.5" />
                <span>{status.readyStreakMarketsCount} Market(s) Ready to Differ</span>
              </span>
            ) : (
              <span className="text-slate-500">Scanning {activeMarketList.length} markets for 3x/4x repeats...</span>
            )}
          </div>
        </div>
      </div>

      {/* 📊 CORE STATS STRIP */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
        {/* Net Profit */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 shadow-lg">
          <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider flex items-center justify-between">
            <span>Net Profit</span>
            <Coins className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div className={`text-lg sm:text-xl font-black font-mono mt-1 ${
            status.netProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'
          }`}>
            {status.netProfit >= 0 ? '+' : ''}${status.netProfit.toFixed(2)}
          </div>
        </div>

        {/* Win Rate */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 shadow-lg">
          <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider flex items-center justify-between">
            <span>Win Rate</span>
            <Percent className="w-3.5 h-3.5 text-cyan-400" />
          </div>
          <div className="text-lg sm:text-xl font-black font-mono text-cyan-400 mt-1">
            {status.winRate}%
          </div>
          <div className="text-[10px] text-slate-500 font-mono mt-0.5">
            {status.totalWins}W / {status.totalLosses}L ({status.totalTrades})
          </div>
        </div>

        {/* Current Stake */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 shadow-lg">
          <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider flex items-center justify-between">
            <span>Current Stake</span>
            <DollarSign className="w-3.5 h-3.5 text-amber-400" />
          </div>
          <div className="text-lg sm:text-xl font-black font-mono text-white mt-1">
            ${status.currentStake.toFixed(2)}
          </div>
          <div className="text-[10px] text-slate-500 font-mono mt-0.5">
            Mode: {config.stakeMode}
          </div>
        </div>

        {/* Win Streak */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 shadow-lg">
          <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider flex items-center justify-between">
            <span>Streak</span>
            <Flame className="w-3.5 h-3.5 text-orange-400" />
          </div>
          <div className="text-lg sm:text-xl font-black font-mono text-orange-400 mt-1">
            {status.consecutiveWins} Wins
          </div>
          <div className="text-[10px] text-slate-500 font-mono mt-0.5">
            Max Streak: {status.maxConsecutiveWins}
          </div>
        </div>

        {/* Target Differ Digit */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 shadow-lg">
          <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider flex items-center justify-between">
            <span>Target Differ Digit</span>
            <Snowflake className="w-3.5 h-3.5 text-rose-400" />
          </div>
          <div className="text-lg sm:text-xl font-black font-mono text-rose-400 mt-1">
            {status.activeRedBarDigit !== null ? `Digit ${status.activeRedBarDigit}` : '--'}
          </div>
          <div className="text-[10px] text-slate-500 font-mono mt-0.5 truncate">
            {status.activePatternLabel || 'Awaiting breakout'}
          </div>
        </div>

        {/* Current / Active Market */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 shadow-lg">
          <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider flex items-center justify-between">
            <span>Active Market</span>
            <Activity className="w-3.5 h-3.5 text-indigo-400" />
          </div>
          <div className="text-sm font-black text-indigo-300 truncate mt-1">
            {status.currentMarket?.shortName || 'Vol 10'}
          </div>
          <div className="text-[10px] text-slate-500 font-mono mt-0.5">
            Cycle #{status.currentCycle}
          </div>
        </div>

        {/* Account Balance */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 shadow-lg">
          <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider flex items-center justify-between">
            <span>Deriv Balance</span>
            <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div className="text-lg sm:text-xl font-black font-mono text-emerald-300 mt-1">
            ${balanceUsd.toFixed(2)}
          </div>
          <div className="text-[10px] text-slate-500 font-mono mt-0.5">
            Available margin
          </div>
        </div>
      </div>

      {/* 🧭 NAVIGATION TABS */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-2">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('RADAR')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'RADAR'
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
                : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            <Radar className="w-4 h-4" />
            <span>Streak Break Radar ({activeMarketList.length} Markets)</span>
          </button>

          <button
            onClick={() => setActiveTab('INSPECTOR')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'INSPECTOR'
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
                : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            <Eye className="w-4 h-4" />
            <span>Digit Diagnostics Matrix</span>
          </button>

          <button
            onClick={() => setActiveTab('CONFIG')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'CONFIG'
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
                : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            <Sliders className="w-4 h-4" />
            <span>Compounding & Loss Protection</span>
          </button>

          <button
            onClick={() => setActiveTab('LOGS')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'LOGS'
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
                : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>Trade Logs ({trades.length})</span>
          </button>
        </div>
      </div>

      {/* 📡 TAB 1: LIVE MULTI-MARKET 3x/4x STREAK BREAK RADAR */}
      {activeTab === 'RADAR' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Radar className="w-5 h-5 text-emerald-400" />
                <span>Live Multi-Market Digit Streak & Differ Matrix</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Monitoring digit streams in real-time. When any market repeats 3 or 4 times (e.g. 4,4,4 or 6,6,6,6) and breaks into a new digit, it triggers an immediate Differ contract on that breaker digit.
              </p>
            </div>
          </div>

          {/* Grid of Analyzed Markets */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {activeMarketList.map((m) => {
              const analysis = analyses[m.symbol];
              const isCurrent = status.currentMarket?.symbol === m.symbol;
              const pip = getMarketPipSize(m.symbol);

              const streakSetup = analysis?.streakSetup;
              const isTriggerReady = streakSetup?.isTriggerReady || false;
              const targetDifferDigit = isTriggerReady ? streakSetup!.breakerDigit : (analysis?.safestDigit ?? 0);
              const recentDigits = analysis?.recentDigits || [];

              return (
                <div
                  key={m.symbol}
                  className={`bg-slate-900/90 border rounded-2xl p-4 shadow-xl flex flex-col justify-between transition-all hover:border-slate-700 ${
                    isTriggerReady
                      ? 'border-emerald-500 ring-2 ring-emerald-500/50 bg-emerald-950/20'
                      : isCurrent
                      ? 'border-indigo-500 ring-2 ring-indigo-500/30'
                      : 'border-slate-800'
                  }`}
                >
                  {/* Top Market Header */}
                  <div>
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-black text-white text-sm sm:text-base">{m.name}</span>
                          {isTriggerReady && (
                            <span className="text-[9px] px-2 py-0.5 rounded-full bg-emerald-500 text-slate-950 font-mono font-black animate-pulse">
                              STREAK TRIGGER READY
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-400 font-mono mt-0.5 flex items-center gap-2">
                          <span>Spot: {analysis ? formatDerivQuote(analysis.lastPrice, pip, m.symbol) : '--'}</span>
                          <span>•</span>
                          <span>Last: <strong className="text-cyan-400">{analysis?.lastDigit ?? '--'}</strong></span>
                        </div>
                      </div>

                      {/* Streak Status Badge */}
                      <div className={`px-2.5 py-1 rounded-xl text-[10px] font-mono font-black border ${
                        isTriggerReady
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50 animate-bounce'
                          : streakSetup && streakSetup.activeStreakCount >= 3
                          ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 animate-pulse'
                          : streakSetup && streakSetup.activeStreakCount === 2
                          ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40'
                          : 'bg-slate-800/80 text-slate-400 border-slate-700'
                      }`}>
                        {isTriggerReady
                          ? `🔥 ${streakSetup?.streakCount}x BROKE ➔ ${streakSetup?.breakerDigit}`
                          : streakSetup && streakSetup.activeStreakCount >= 3
                          ? `⚡ ${streakSetup.activeStreakCount}x STREAK (${streakSetup.activeStreakDigit})`
                          : streakSetup && streakSetup.activeStreakCount === 2
                          ? `2x Repeat (${streakSetup.activeStreakDigit})`
                          : 'Scanning'}
                      </div>
                    </div>

                    {/* Recent Digit Stream Tape */}
                    <div className="mt-2.5 p-2 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between">
                      <span className="text-[10px] uppercase font-bold text-slate-400">Stream:</span>
                      <div className="flex items-center gap-1.5 font-mono text-xs">
                        {recentDigits.length > 0 ? (
                          recentDigits.slice(-7).map((d, idx, arr) => {
                            const isLast = idx === arr.length - 1;
                            const isPrecedingStreak =
                              isTriggerReady &&
                              streakSetup &&
                              idx >= arr.length - 1 - streakSetup.streakCount &&
                              idx < arr.length - 1;

                            return (
                              <span
                                key={idx}
                                className={`w-6 h-6 rounded flex items-center justify-center font-bold text-[11px] ${
                                  isLast && isTriggerReady
                                    ? 'bg-emerald-500 text-slate-950 font-black ring-2 ring-emerald-400 animate-pulse'
                                    : isLast
                                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                                    : isPrecedingStreak
                                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/50'
                                    : 'bg-slate-800 text-slate-400'
                                }`}
                              >
                                {d}
                              </span>
                            );
                          })
                        ) : (
                          <span className="text-slate-500 text-[10px]">Loading ticks...</span>
                        )}
                      </div>
                    </div>

                    {/* Strategy Differ Prediction Box */}
                    <div className="mt-3 p-3 rounded-xl bg-slate-950 border border-slate-800/90 flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className={`w-10 h-10 rounded-xl flex flex-col items-center justify-center border ${
                          isTriggerReady
                            ? 'bg-gradient-to-br from-emerald-500/30 to-teal-500/30 border-emerald-400 text-emerald-300 shadow-md shadow-emerald-500/20'
                            : 'bg-gradient-to-br from-rose-500/20 to-orange-500/20 border-rose-500/40 text-rose-300'
                        }`}>
                          <span className="text-[8px] uppercase font-black">DIFFER</span>
                          <span className="text-lg font-black font-mono">{targetDifferDigit}</span>
                        </div>
                        <div>
                          <div className="text-xs font-bold text-white flex items-center gap-1.5">
                            <span>Target: Differ Digit {targetDifferDigit}</span>
                          </div>
                          <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                            {isTriggerReady ? (
                              <span className="text-emerald-400 font-bold">
                                {streakSetup?.patternLabel}
                              </span>
                            ) : (
                              <span>{streakSetup?.activeStreakLabel || 'Waiting for 3x/4x streak'}</span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Status Action Indicator */}
                      <div className="text-right">
                        <div className={`text-sm font-black font-mono ${isTriggerReady ? 'text-emerald-400' : 'text-slate-400'}`}>
                          {isTriggerReady ? 'READY' : 'STANDBY'}
                        </div>
                        <div className="text-[9px] uppercase text-slate-500 font-semibold">
                          Strategy Trigger
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Actions Bar */}
                  <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between">
                    <button
                      onClick={() => {
                        setSelectedInspectionSymbol(m.symbol);
                        setActiveTab('INSPECTOR');
                      }}
                      className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold flex items-center gap-1 transition-colors"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Inspect Matrix</span>
                    </button>

                    <button
                      onClick={() => handleManualSnipe(m, targetDifferDigit)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all shadow-sm flex items-center gap-1.5 ${
                        isTriggerReady
                          ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-emerald-500/30'
                          : 'bg-slate-800 hover:bg-emerald-600 text-slate-300 hover:text-white border border-slate-700'
                      }`}
                    >
                      <Crosshair className="w-3.5 h-3.5" />
                      <span>Differ {targetDifferDigit}</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 🔬 TAB 2: DEEP AI DIGIT BEHAVIOR & MARKOV DIAGNOSTICS */}
      {activeTab === 'INSPECTOR' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xl space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <BarChart2 className="w-5 h-5 text-emerald-400" />
                <span>Digit Matrix & Streak Diagnostics Inspector</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Full empirical breakdown of digit repeat streaks, conditional Markov jump probabilities, and multi-horizon frequency metrics.
              </p>
            </div>

            {/* Market selector */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400">Inspecting:</span>
              <select
                value={selectedInspectionSymbol}
                onChange={(e) => setSelectedInspectionSymbol(e.target.value)}
                className="bg-slate-950 text-white font-bold text-xs sm:text-sm rounded-xl px-3 py-1.5 border border-slate-700 focus:outline-none"
              >
                {ALL_SCANNER_MARKETS.map((m) => (
                  <option key={m.symbol} value={m.symbol}>
                    {m.name} ({m.shortName})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {selectedAnalysis ? (
            <div className="space-y-4">
              {/* Summary Bar */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-950 p-3.5 rounded-xl border border-slate-800 font-mono text-xs">
                <div>
                  <span className="text-slate-400">Current Spot:</span>
                  <div className="text-sm font-bold text-white mt-0.5">
                    {formatDerivQuote(selectedAnalysis.lastPrice, getMarketPipSize(selectedAnalysis.symbol), selectedAnalysis.symbol)}
                  </div>
                </div>
                <div>
                  <span className="text-slate-400">Current Last Digit:</span>
                  <div className="text-sm font-bold text-cyan-400 mt-0.5">
                    Digit {selectedAnalysis.lastDigit}
                  </div>
                </div>
                <div>
                  <span className="text-slate-400">Streak Setup:</span>
                  <div className="text-sm font-bold text-emerald-400 mt-0.5 truncate">
                    {selectedAnalysis.streakSetup?.isTriggerReady
                      ? selectedAnalysis.streakSetup.patternLabel
                      : selectedAnalysis.streakSetup?.activeStreakLabel || 'No active streak'}
                  </div>
                </div>
                <div>
                  <span className="text-slate-400">Distribution Entropy:</span>
                  <div className="text-sm font-bold text-indigo-300 mt-0.5">
                    {selectedAnalysis.shannonEntropy}% (Stable)
                  </div>
                </div>
              </div>

              {/* 10 Digits Analysis Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950 text-slate-400 uppercase font-semibold border-b border-slate-800">
                    <tr>
                      <th className="py-3 px-3 text-center">Digit</th>
                      <th className="py-3 px-3">AI Safety Score</th>
                      <th className="py-3 px-3">Markov Jump Risk</th>
                      <th className="py-3 px-3">Micro (25t)</th>
                      <th className="py-3 px-3">Mid (100t)</th>
                      <th className="py-3 px-3">Macro (300t)</th>
                      <th className="py-3 px-3">Dormancy</th>
                      <th className="py-3 px-3">Streak / Reason</th>
                      <th className="py-3 px-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-mono">
                    {selectedAnalysis.digitMetrics.map((dm) => {
                      const isBreaker = selectedAnalysis.streakSetup?.isTriggerReady && dm.digit === selectedAnalysis.streakSetup.breakerDigit;
                      const isSafest = dm.digit === selectedAnalysis.safestDigit;
                      const isCurrent = dm.digit === selectedAnalysis.lastDigit;

                      return (
                        <tr
                          key={dm.digit}
                          className={`transition-colors ${
                            isBreaker
                              ? 'bg-emerald-500/20 hover:bg-emerald-500/30'
                              : isSafest
                              ? 'bg-emerald-500/10 hover:bg-emerald-500/20'
                              : isCurrent
                              ? 'bg-cyan-500/5 hover:bg-slate-800/40'
                              : 'hover:bg-slate-800/40'
                          }`}
                        >
                          <td className="py-2.5 px-3 text-center">
                            <span
                              className={`inline-flex items-center justify-center w-7 h-7 rounded-lg font-black text-sm border ${
                                isBreaker
                                  ? 'bg-emerald-500 text-slate-950 border-emerald-400 shadow-md shadow-emerald-500/30'
                                  : isSafest
                                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50'
                                  : isCurrent
                                  ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                                  : 'bg-slate-800 text-slate-300 border-slate-700'
                              }`}
                            >
                              {dm.digit}
                            </span>
                          </td>

                          <td className="py-2.5 px-3">
                            <div className="flex items-center gap-2">
                              <span className={`font-black ${dm.safetyScore >= 90 ? 'text-emerald-400' : dm.safetyScore >= 80 ? 'text-cyan-400' : 'text-slate-400'}`}>
                                {dm.safetyScore}%
                              </span>
                              <div className="w-16 bg-slate-950 rounded-full h-1.5 overflow-hidden">
                                <div
                                  className={`h-full rounded-full ${
                                    dm.safetyScore >= 90 ? 'bg-emerald-400' : dm.safetyScore >= 80 ? 'bg-cyan-400' : 'bg-slate-600'
                                  }`}
                                  style={{ width: `${dm.safetyScore}%` }}
                                />
                              </div>
                            </div>
                          </td>

                          <td className="py-2.5 px-3">
                            <span className={dm.markovRiskPct <= 5 ? 'text-emerald-400 font-bold' : dm.markovRiskPct >= 15 ? 'text-rose-400 font-bold' : 'text-slate-300'}>
                              {dm.markovRiskPct}%
                            </span>
                          </td>

                          <td className="py-2.5 px-3 text-slate-300">{dm.microFreqPct}%</td>
                          <td className="py-2.5 px-3 text-slate-300">{dm.midFreqPct}%</td>
                          <td className="py-2.5 px-3 text-slate-400">{dm.macroFreqPct}%</td>

                          <td className="py-2.5 px-3">
                            <span className={dm.ticksSinceLastSeen >= 15 ? 'text-cyan-400 font-bold' : dm.ticksSinceLastSeen === 0 ? 'text-amber-400 font-bold' : 'text-slate-300'}>
                              {dm.ticksSinceLastSeen} ticks
                            </span>
                          </td>

                          <td className="py-2.5 px-3 font-sans text-xs">
                            <span className={isBreaker ? 'text-emerald-300 font-black' : dm.ratingTier === 'ULTRA_SAFE' ? 'text-emerald-300 font-bold' : dm.ratingTier === 'HAZARD' ? 'text-rose-400' : 'text-slate-300'}>
                              {dm.safetyReason}
                            </span>
                          </td>

                          <td className="py-2.5 px-3 text-right">
                            <button
                              onClick={() => {
                                const m = ALL_SCANNER_MARKETS.find((x) => x.symbol === selectedAnalysis.symbol);
                                if (m) handleManualSnipe(m, dm.digit);
                              }}
                              className="px-2.5 py-1 rounded bg-slate-800 hover:bg-emerald-600 text-slate-300 hover:text-white font-sans text-[11px] font-bold transition-all shadow-sm"
                            >
                              Differ
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="py-12 text-center text-slate-500 text-xs">
              Loading market ticks history from Deriv WebSocket...
            </div>
          )}
        </div>
      )}

      {/* ⚙️ TAB 3: COMPOUNDING & LOSS PROTECTION SETTINGS */}
      {activeTab === 'CONFIG' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xl space-y-5">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Sliders className="w-5 h-5 text-emerald-400" />
              <span>Compounding, Stakes & Safety Controls</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Configure profit reinvestment, balance percentage staking, loss cooldown buffers, and take profit ceilings.
            </p>
          </div>

          {/* Quick Preset Buttons */}
          <div>
            <label className="text-xs font-semibold text-slate-300 mb-2 block">Quick Money Management Presets</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
              {[
                { id: 'FULL_MARGIN', label: '⚡ Full Margin (100%)', desc: 'All-in balance compound' },
                { id: 'COMPOUND_100', label: '🔄 100% Compound', desc: 'Reinvest all profit' },
                { id: 'COMPOUND_STEPS_3', label: '🎯 3-Step Compound', desc: 'Compound 3 wins & bank' },
                { id: 'COMPOUND_50', label: '⚖️ 50% Compound', desc: 'Reinvest half profit' },
                { id: 'BALANCE_2PCT', label: '📊 2% Balance Stake', desc: 'Dynamic portfolio risk' },
                { id: 'MARTINGALE', label: '🛡️ 11x Martingale', desc: 'Differ loss recovery' },
                { id: 'FLAT', label: '⏹️ Flat Stake', desc: 'Constant base stake' },
              ].map((p) => (
                <button
                  key={p.id}
                  onClick={() => applyPreset(p.id as any)}
                  className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 hover:border-emerald-500/50 text-left transition-all group"
                >
                  <div className="text-xs font-bold text-white group-hover:text-emerald-400 transition-colors">{p.label}</div>
                  <div className="text-[10px] text-slate-500 mt-0.5">{p.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Detailed Inputs */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-slate-800/80">
            {/* Base Stake */}
            <div>
              <label className="text-xs font-semibold text-slate-300 mb-1 block">Base Stake (USD)</label>
              <div className="relative">
                <DollarSign className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="number"
                  step="0.1"
                  min="0.35"
                  value={config.baseStake}
                  onChange={(e) => handleConfigChange({ baseStake: Math.max(0.35, parseFloat(e.target.value) || 0.35) })}
                  className="w-full bg-slate-950 text-white font-mono font-bold text-sm rounded-xl pl-9 pr-3 py-2 border border-slate-800 focus:border-emerald-500 focus:outline-none"
                />
              </div>
            </div>

            {/* Compounding Reinvest % */}
            <div>
              <label className="text-xs font-semibold text-slate-300 mb-1 block">Profit Reinvestment (%)</label>
              <input
                type="number"
                min="0"
                max="100"
                value={config.compoundReinvestPct}
                onChange={(e) => handleConfigChange({ compoundReinvestPct: Math.min(100, Math.max(0, parseInt(e.target.value) || 0)) })}
                className="w-full bg-slate-950 text-white font-mono font-bold text-sm rounded-xl px-3 py-2 border border-slate-800 focus:border-emerald-500 focus:outline-none"
              />
            </div>

            {/* Max Stake Safety Cap */}
            <div>
              <label className="text-xs font-semibold text-slate-300 mb-1 block">Max Stake Cap (0 = Uncapped)</label>
              <input
                type="number"
                min="0"
                value={config.maxStakeCap}
                onChange={(e) => handleConfigChange({ maxStakeCap: Math.max(0, parseFloat(e.target.value) || 0) })}
                className="w-full bg-slate-950 text-white font-mono font-bold text-sm rounded-xl px-3 py-2 border border-slate-800 focus:border-emerald-500 focus:outline-none"
              />
            </div>

            {/* Loss Cooldown Buffer */}
            <div>
              <label className="text-xs font-semibold text-slate-300 mb-1 block">Loss Cooldown Pause (Seconds)</label>
              <input
                type="number"
                min="0"
                max="60"
                value={config.lossCooldownSeconds}
                onChange={(e) => handleConfigChange({ lossCooldownSeconds: Math.max(0, parseInt(e.target.value) || 0) })}
                className="w-full bg-slate-950 text-white font-mono font-bold text-sm rounded-xl px-3 py-2 border border-slate-800 focus:border-emerald-500 focus:outline-none"
              />
            </div>

            {/* Max Consecutive Losses Breaker */}
            <div>
              <label className="text-xs font-semibold text-slate-300 mb-1 block">Streak Safety Stop (Consecutive Losses)</label>
              <input
                type="number"
                min="0"
                max="10"
                value={config.maxConsecutiveLosses}
                onChange={(e) => handleConfigChange({ maxConsecutiveLosses: Math.max(0, parseInt(e.target.value) || 0) })}
                className="w-full bg-slate-950 text-white font-mono font-bold text-sm rounded-xl px-3 py-2 border border-slate-800 focus:border-emerald-500 focus:outline-none"
              />
            </div>

            {/* Inter-Trade Delay */}
            <div>
              <label className="text-xs font-semibold text-slate-300 mb-1 block">Inter-Trade Settlement Delay (ms)</label>
              <input
                type="number"
                min="200"
                step="100"
                value={config.delayBetweenTradesMs}
                onChange={(e) => handleConfigChange({ delayBetweenTradesMs: Math.max(200, parseInt(e.target.value) || 400) })}
                className="w-full bg-slate-950 text-white font-mono font-bold text-sm rounded-xl px-3 py-2 border border-slate-800 focus:border-emerald-500 focus:outline-none"
              />
            </div>
          </div>
        </div>
      )}

      {/* 📜 TAB 4: TRADE LOGS & VERIFICATION STREAM */}
      {activeTab === 'LOGS' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Clock className="w-5 h-5 text-emerald-400" />
              <span>Streak Break Trade Execution Logs ({trades.length})</span>
            </h3>
            {trades.length > 0 && (
              <button
                onClick={handleReset}
                className="text-xs text-slate-400 hover:text-rose-400 flex items-center gap-1 transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Clear Logs</span>
              </button>
            )}
          </div>

          {trades.length === 0 ? (
            <div className="py-12 text-center text-slate-500 text-xs">
              No trades executed yet. Launch the bot above to begin scanning for 3x/4x streak breaks.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950 text-slate-400 uppercase font-semibold border-b border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Time</th>
                    <th className="py-3 px-4">Market</th>
                    <th className="py-3 px-4 text-center">Differ Target</th>
                    <th className="py-3 px-4 text-center">Exit Digit</th>
                    <th className="py-3 px-4">Streak Pattern Trigger</th>
                    <th className="py-3 px-4">Stake</th>
                    <th className="py-3 px-4 text-right">Profit / Loss</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono">
                  {trades.map((t) => {
                    const isWin = t.result === 'WIN';
                    const isOpen = t.result === 'OPEN';

                    return (
                      <tr key={t.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="py-3 px-4 text-slate-400 font-sans">{t.timeString}</td>
                        <td className="py-3 px-4 font-bold font-sans text-white">{t.marketName}</td>
                        <td className="py-3 px-4 text-center">
                          <span className="inline-block px-2.5 py-0.5 rounded font-black bg-rose-500/20 text-rose-300 border border-rose-500/40">
                            ≠ {t.redBarDigit}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          {isOpen ? (
                            <span className="text-amber-400 animate-pulse font-sans">Running...</span>
                          ) : (
                            <span className={`inline-block px-2.5 py-0.5 rounded font-black ${
                              isWin
                                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                                : 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
                            }`}>
                              {t.exitDigit ?? '--'}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 font-sans text-xs text-emerald-300 font-semibold max-w-xs truncate">
                          {t.patternString || t.reason}
                        </td>
                        <td className="py-3 px-4 text-slate-300">${t.stake.toFixed(2)}</td>
                        <td className="py-3 px-4 text-right font-black">
                          {isOpen ? (
                            <span className="text-slate-400 font-sans">--</span>
                          ) : (
                            <span className={isWin ? 'text-emerald-400' : 'text-rose-400'}>
                              {isWin ? '+' : ''}${t.profit.toFixed(2)}
                            </span>
                          )}
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
