import React, { useState, useEffect, useMemo } from 'react';
import { MarketSymbol, MarketInfo, ActiveContract } from '../../types/deriv';
import {
  systemAutoEngine,
  SystemAutoStatus,
  SystemAutoConfig,
  TradeRecord,
  MarketLiveState,
  ASCENDING_VOLATILITY_MARKETS,
  MoneyManagementMode,
  MarketScopeMode,
  AutoTerminalStrategy,
} from '../../services/systemAutoDifferEngine';
import { soundManager } from '../../utils/soundEffects';
import {
  Play,
  Square,
  Zap,
  TrendingUp,
  TrendingDown,
  Activity,
  ShieldCheck,
  ShieldAlert,
  RotateCcw,
  Sliders,
  DollarSign,
  Clock,
  Flame,
  CheckCircle2,
  XCircle,
  ArrowRight,
  Sparkles,
  Info,
  ChevronRight,
  Layers,
  Percent,
  Download,
  Trash2,
  RefreshCw,
  Cpu,
  BarChart2,
  Volume2,
  VolumeX,
  Radar,
  Crosshair,
  Repeat,
  Target,
} from 'lucide-react';

interface SystemAutoTerminalProps {
  markets: MarketInfo[];
  selectedSymbol: MarketSymbol;
  onSelectSymbol: (symbol: MarketSymbol) => void;
  balanceUsd: number;
  onUpdateBalance: (newBalance: number) => void;
  activeContracts: ActiveContract[];
}

export const SystemAutoTerminal: React.FC<SystemAutoTerminalProps> = ({
  markets,
  selectedSymbol,
  onSelectSymbol,
  balanceUsd,
  onUpdateBalance,
  activeContracts,
}) => {
  const [status, setStatus] = useState<SystemAutoStatus>(() => systemAutoEngine.getStatus());
  const [config, setConfig] = useState<SystemAutoConfig>(() => systemAutoEngine.getConfig());
  const [trades, setTrades] = useState<TradeRecord[]>(() => systemAutoEngine.getTradeHistory());
  const [marketStates, setMarketStates] = useState<Map<MarketSymbol, MarketLiveState>>(() => systemAutoEngine.getMarketStates());
  const [historyFilter, setHistoryFilter] = useState<'ALL' | 'WINS' | 'LOSSES'>('ALL');
  const [activeTab, setActiveTab] = useState<'RADAR' | 'PIPELINE' | 'SETTINGS' | 'LOGS'>('RADAR');

  useEffect(() => {
    const unsubConfig = systemAutoEngine.subscribeConfig(setConfig);
    const unsubStatus = systemAutoEngine.subscribeStatus(setStatus);
    const unsubHistory = systemAutoEngine.subscribeHistory(setTrades);
    const unsubStates = systemAutoEngine.subscribeMarketStates(setMarketStates);

    return () => {
      unsubConfig();
      unsubStatus();
      unsubHistory();
      unsubStates();
    };
  }, []);

  useEffect(() => {
    systemAutoEngine.setBalance(balanceUsd);
  }, [balanceUsd]);

  useEffect(() => {
    systemAutoEngine.setBalanceUpdater((profit, newBalance) => {
      onUpdateBalance(newBalance);
    });
  }, [onUpdateBalance]);

  const handleConfigChange = (newValues: Partial<SystemAutoConfig>) => {
    systemAutoEngine.saveConfig(newValues);
  };

  const handleSelectSpecificMarket = (symbol: MarketSymbol) => {
    systemAutoEngine.selectSpecificMarket(symbol);
    if (onSelectSymbol) {
      onSelectSymbol(symbol);
    }
  };

  const handleToggleBot = () => {
    if (status.isRunning) {
      systemAutoEngine.stopBot('Stopped by user');
    } else {
      systemAutoEngine.startBot(0);
    }
  };

  const handleResetStats = () => {
    systemAutoEngine.resetStats();
    soundManager.playButtonClick();
  };

  const filteredTrades = useMemo(() => {
    if (historyFilter === 'WINS') return trades.filter((t) => t.result === 'WIN');
    if (historyFilter === 'LOSSES') return trades.filter((t) => t.result === 'LOSS');
    return trades;
  }, [trades, historyFilter]);

  const activeMarketPool = useMemo(() => {
    if (config.marketScope === 'SINGLE_SPECIFIC') {
      const target = config.specificMarketSymbol || 'R_10';
      const found = ASCENDING_VOLATILITY_MARKETS.filter((m) => m.symbol === target);
      return found.length > 0 ? found : [ASCENDING_VOLATILITY_MARKETS[0]];
    }
    if (config.marketScope === 'CUSTOM_SELECTED') {
      const selected = config.selectedSymbols || [];
      if (selected.length === 0) return ASCENDING_VOLATILITY_MARKETS;
      const filtered = ASCENDING_VOLATILITY_MARKETS.filter((m) => selected.includes(m.symbol));
      return filtered.length > 0 ? filtered : ASCENDING_VOLATILITY_MARKETS;
    }
    if (config.marketScope === 'STANDARD_10_TO_100') {
      return ASCENDING_VOLATILITY_MARKETS.filter((m) => !m.isOneSecond);
    }
    if (config.marketScope === 'ONESECOND_10_TO_100') {
      return ASCENDING_VOLATILITY_MARKETS.filter((m) => m.isOneSecond);
    }
    return ASCENDING_VOLATILITY_MARKETS;
  }, [config.marketScope, config.specificMarketSymbol, config.selectedSymbols]);

  // Count active twin digit patterns across all pool markets
  const activeTwinCount = useMemo(() => {
    let count = 0;
    activeMarketPool.forEach((m) => {
      const state = marketStates.get(m.symbol);
      if (state?.hasTwinDigit) count++;
    });
    return count;
  }, [activeMarketPool, marketStates]);

  const exportCSV = () => {
    if (trades.length === 0) return;
    const headers = ['ID', 'Time', 'Market', 'Pattern_Trigger', 'Differ_Digit', 'Tick_1_Intermediate', 'Tick_2_Exit_Digit', 'Result', 'Stake', 'Profit', 'Cycle'];
    const rows = trades.map((t) => [
      t.id,
      t.timeString,
      t.marketName,
      t.triggerReason || 'N/A',
      t.differDigit,
      t.intermediateDigit ?? 'N/A',
      t.exitDigit ?? 'N/A',
      t.result,
      t.stake,
      t.profit,
      t.cycleNumber,
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `double_digit_differ_trades_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6" id="system-auto-terminal-root">
      {/* 🚀 Top Banner & Strategy Summary */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-slate-900/95 to-slate-950 border border-slate-800 p-6 shadow-2xl">
        <div className="absolute top-0 right-0 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none -ml-20 -mb-20" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-2xl bg-gradient-to-tr from-amber-500 via-emerald-500 to-teal-500 text-slate-950 shadow-lg shadow-amber-500/20 font-black">
                <Target className="w-6 h-6 animate-pulse" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-2xl font-black tracking-tight text-white flex items-center gap-2">
                    System Auto Terminal
                  </h1>
                  <span className="text-xs px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                    Double Identical Digit Sniper
                  </span>
                  <span className="text-xs px-2.5 py-0.5 rounded-full font-mono font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                    2 Ticks Settle
                  </span>
                </div>
                <p className="text-xs text-slate-300 mt-1 max-w-3xl leading-relaxed">
                  Scans all markets in real-time. Once consecutive identical digits occur (e.g. <strong className="text-amber-400 font-mono">[3, 3]</strong>), it immediately buys a <strong className="text-emerald-400">Differ ≠ 3</strong> contract using <strong className="text-cyan-400">2 Ticks duration</strong> where the 2nd tick settles the trade (e.g. 3,3 ➔ tick 1: 6, tick 2: 8 ➔ WIN!).
                </p>
              </div>
            </div>
          </div>

          {/* Status Indicator & Master Start/Stop */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 bg-slate-950/80 px-3.5 py-2 rounded-xl border border-slate-800">
              <span className="relative flex h-3 w-3">
                {status.isRunning && (
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                )}
                <span className={`relative inline-flex rounded-full h-3 w-3 ${status.isRunning ? 'bg-emerald-500' : 'bg-slate-600'}`} />
              </span>
              <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                {status.isRunning ? (status.isSettling ? 'SETTLING TRADE...' : 'SCANNING MARKETS') : 'IDLE / READY'}
              </span>
            </div>

            <button
              id="btn-master-toggle-bot"
              onClick={handleToggleBot}
              className={`flex items-center gap-2.5 px-6 py-3 rounded-xl font-bold text-sm shadow-xl transition-all active:scale-95 ${
                status.isRunning
                  ? 'bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white shadow-red-500/25 ring-2 ring-red-500/50'
                  : 'bg-gradient-to-r from-amber-500 via-emerald-500 to-teal-500 hover:from-amber-400 hover:to-emerald-400 text-slate-950 shadow-amber-500/25 ring-2 ring-amber-500/50 font-black'
              }`}
            >
              {status.isRunning ? (
                <>
                  <Square className="w-5 h-5 fill-current" />
                  <span>STOP AUTO BOT</span>
                </>
              ) : (
                <>
                  <Play className="w-5 h-5 fill-current" />
                  <span>START AUTO BOT</span>
                </>
              )}
            </button>

            <button
              onClick={handleResetStats}
              title="Reset Statistics"
              className="p-3 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Live Strategy Mode Switcher Pills */}
        <div className="mt-5 pt-4 border-t border-slate-800/80 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider flex items-center gap-1.5">
              <Crosshair className="w-3.5 h-3.5 text-amber-400" />
              <span>Strategy Engine:</span>
            </span>

            <button
              disabled={status.isRunning}
              onClick={() => handleConfigChange({ strategyMode: 'DOUBLE_IDENTICAL_2TICK', durationTicks: 2 })}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                config.strategyMode === 'DOUBLE_IDENTICAL_2TICK'
                  ? 'bg-gradient-to-r from-amber-500 to-emerald-500 text-slate-950 font-black shadow-md shadow-amber-500/20 ring-1 ring-amber-400'
                  : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800 disabled:opacity-50'
              }`}
            >
              <Target className="w-3.5 h-3.5" />
              <span>Double Identical Digit Sniper (2-Tick Settle)</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-900/80 text-amber-300 border border-amber-500/40">
                Active
              </span>
            </button>

            <button
              disabled={status.isRunning}
              onClick={() => handleConfigChange({ strategyMode: 'ASCENDING_SEQUENTIAL_1TICK', durationTicks: 1 })}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                config.strategyMode === 'ASCENDING_SEQUENTIAL_1TICK'
                  ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-black shadow-md shadow-emerald-500/20 ring-1 ring-emerald-400'
                  : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800 disabled:opacity-50'
              }`}
            >
              <Repeat className="w-3.5 h-3.5" />
              <span>Ascending Volatility Rotation (10➔100)</span>
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400 font-mono">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              <span>Twin Digits in Pool: <strong className="text-amber-400">{activeTwinCount}</strong></span>
            </span>
            <span className="text-slate-600">•</span>
            <div className="flex items-center gap-1">
              <Clock className="w-3 h-3 text-cyan-400" />
              <span className="text-slate-400">Duration:</span>
              <div className="inline-flex items-center gap-1 bg-slate-950 px-1.5 py-0.5 rounded-md border border-slate-800">
                {[1, 2, 3, 5, 10].map((t) => (
                  <button
                    key={t}
                    disabled={status.isRunning}
                    onClick={() => handleConfigChange({ durationTicks: t })}
                    className={`px-1.5 py-0.5 text-[10px] font-bold font-mono rounded transition-all ${
                      config.durationTicks === t
                        ? 'bg-cyan-500 text-slate-950 font-black shadow-sm'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {t}t
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* 🎛️ Market Volatility Scope & Direct Volatility Selector Bar */}
        <div className="mt-4 pt-3.5 border-t border-slate-800/80 space-y-3">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-cyan-400" />
                <span>Market Volatility Scope:</span>
              </span>

              <button
                disabled={status.isRunning}
                onClick={() => handleConfigChange({ marketScope: 'ALL_10_TO_100' })}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                  config.marketScope === 'ALL_10_TO_100'
                    ? 'bg-cyan-500 text-slate-950 font-black shadow-md shadow-cyan-500/20'
                    : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800 disabled:opacity-50'
                }`}
              >
                All 10 Volatilities (10➔100)
              </button>

              <button
                disabled={status.isRunning}
                onClick={() => handleConfigChange({ marketScope: 'STANDARD_10_TO_100' })}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                  config.marketScope === 'STANDARD_10_TO_100'
                    ? 'bg-cyan-500 text-slate-950 font-black shadow-md shadow-cyan-500/20'
                    : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800 disabled:opacity-50'
                }`}
              >
                Standard (5)
              </button>

              <button
                disabled={status.isRunning}
                onClick={() => handleConfigChange({ marketScope: 'ONESECOND_10_TO_100' })}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                  config.marketScope === 'ONESECOND_10_TO_100'
                    ? 'bg-cyan-500 text-slate-950 font-black shadow-md shadow-cyan-500/20'
                    : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800 disabled:opacity-50'
                }`}
              >
                1-Second (5)
              </button>

              <button
                disabled={status.isRunning}
                onClick={() => handleSelectSpecificMarket(config.specificMarketSymbol || selectedSymbol || 'R_10')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                  config.marketScope === 'SINGLE_SPECIFIC'
                    ? 'bg-gradient-to-r from-amber-500 to-amber-400 text-slate-950 font-black shadow-md shadow-amber-500/20 ring-1 ring-amber-300'
                    : 'bg-slate-950 text-amber-400 hover:text-amber-300 border border-amber-500/40 disabled:opacity-50'
                }`}
              >
                <Target className="w-3 h-3" />
                <span>Single Specific Volatility</span>
              </button>

              <button
                disabled={status.isRunning}
                onClick={() => handleConfigChange({ marketScope: 'CUSTOM_SELECTED' })}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                  config.marketScope === 'CUSTOM_SELECTED'
                    ? 'bg-indigo-600 text-white font-black shadow-md shadow-indigo-500/20'
                    : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800 disabled:opacity-50'
                }`}
              >
                Custom Multi-Select
              </button>
            </div>

            {config.marketScope === 'SINGLE_SPECIFIC' && (
              <div className="flex items-center gap-2 bg-slate-950/80 px-3 py-1 rounded-xl border border-amber-500/30">
                <span className="text-xs text-amber-300 font-semibold">Target Volatility:</span>
                <select
                  disabled={status.isRunning}
                  value={config.specificMarketSymbol || 'R_10'}
                  onChange={(e) => handleSelectSpecificMarket(e.target.value as MarketSymbol)}
                  className="bg-slate-900 border border-amber-500/50 rounded-lg px-2 py-0.5 text-xs text-white font-bold font-mono focus:outline-none"
                >
                  {ASCENDING_VOLATILITY_MARKETS.map((m) => (
                    <option key={m.symbol} value={m.symbol}>
                      {m.name} ({m.shortName})
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Quick Clickable Volatility Market Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
            <span className="text-[11px] text-slate-500 font-semibold shrink-0 mr-1">Choose Market:</span>
            {ASCENDING_VOLATILITY_MARKETS.map((m) => {
              const isSelectedTarget = config.marketScope === 'SINGLE_SPECIFIC' && (config.specificMarketSymbol || 'R_10') === m.symbol;
              const isCustomIncluded = config.marketScope === 'CUSTOM_SELECTED' && (config.selectedSymbols?.includes(m.symbol) ?? true);
              const isPoolIncluded = activeMarketPool.some((p) => p.symbol === m.symbol);
              const liveState = marketStates.get(m.symbol);

              return (
                <button
                  key={m.symbol}
                  disabled={status.isRunning}
                  onClick={() => {
                    if (config.marketScope === 'CUSTOM_SELECTED') {
                      systemAutoEngine.toggleCustomMarketSymbol(m.symbol);
                    } else {
                      handleSelectSpecificMarket(m.symbol);
                    }
                  }}
                  title={config.marketScope === 'CUSTOM_SELECTED' ? `Toggle ${m.name}` : `Trade exclusively on ${m.name}`}
                  className={`shrink-0 flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition-all ${
                    isSelectedTarget
                      ? 'bg-amber-400 text-slate-950 font-black shadow-md shadow-amber-400/30 ring-2 ring-amber-300 scale-105'
                      : isCustomIncluded && config.marketScope === 'CUSTOM_SELECTED'
                      ? 'bg-indigo-600 text-white font-bold border border-indigo-400'
                      : isPoolIncluded && config.marketScope !== 'SINGLE_SPECIFIC'
                      ? 'bg-slate-900 text-slate-200 border border-slate-700 hover:border-amber-400'
                      : 'bg-slate-950 text-slate-500 border border-slate-900 hover:border-slate-700 hover:text-slate-300 disabled:opacity-50'
                  }`}
                >
                  {isSelectedTarget ? (
                    <Target className="w-3 h-3 text-slate-950" />
                  ) : isCustomIncluded && config.marketScope === 'CUSTOM_SELECTED' ? (
                    <CheckCircle2 className="w-3 h-3 text-emerald-300" />
                  ) : null}
                  <span>{m.shortName}</span>
                  {liveState?.hasTwinDigit && (
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Live Status Bar Notification & Speed Telemetry */}
        <div className="mt-3 pt-3 border-t border-slate-800/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 text-slate-300 truncate">
            <Activity className={`w-4 h-4 shrink-0 ${status.isRunning ? 'text-amber-400 animate-spin' : 'text-slate-500'}`} />
            <span className="font-mono truncate">{status.statusMessage}</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <div className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/30 text-amber-300 font-mono text-[11px]">
              <Zap className="w-3 h-3 text-amber-400" />
              <span>Direct Buy: <strong>Instant (0ms)</strong></span>
            </div>
            {status.lastExecutionMs > 0 && (
              <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-slate-950 border border-slate-800 text-slate-400 font-mono text-[11px]">
                <Clock className="w-3 h-3 text-cyan-400" />
                <span>Roundtrip: <strong className="text-cyan-300">{status.lastExecutionMs}ms</strong></span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 📊 Primary Telemetry Dashboard */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Net Profit */}
        <div className="rounded-xl bg-slate-900/90 border border-slate-800 p-4 relative overflow-hidden">
          <div className="text-[11px] font-medium text-slate-400 uppercase tracking-wider mb-1 flex items-center justify-between">
            <span>Net Profit</span>
            {status.netProfit >= 0 ? (
              <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <TrendingDown className="w-3.5 h-3.5 text-red-400" />
            )}
          </div>
          <div className={`text-xl sm:text-2xl font-black font-mono ${status.netProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {status.netProfit >= 0 ? `+$${status.netProfit.toFixed(2)}` : `-$${Math.abs(status.netProfit).toFixed(2)}`}
          </div>
          <div className="text-[10px] text-slate-500 mt-1 flex items-center gap-1">
            <span>TP:</span>
            <span className="text-emerald-400 font-mono">+${config.takeProfit}</span>
            <span className="mx-1">•</span>
            <span>SL:</span>
            <span className="text-red-400 font-mono">-${config.stopLoss}</span>
          </div>
        </div>

        {/* Win Rate */}
        <div className="rounded-xl bg-slate-900/90 border border-slate-800 p-4">
          <div className="text-[11px] font-medium text-slate-400 uppercase tracking-wider mb-1 flex items-center justify-between">
            <span>Win Rate</span>
            <Percent className="w-3.5 h-3.5 text-cyan-400" />
          </div>
          <div className="text-xl sm:text-2xl font-black font-mono text-white">
            {status.winRate}%
          </div>
          <div className="text-[10px] text-slate-400 mt-1 flex items-center gap-1.5 font-mono">
            <span className="text-emerald-400">{status.totalWins}W</span>
            <span className="text-slate-600">/</span>
            <span className="text-red-400">{status.totalLosses}L</span>
            <span className="text-slate-500">({status.totalTrades}T)</span>
          </div>
        </div>

        {/* Current Stake */}
        <div className="rounded-xl bg-slate-900/90 border border-slate-800 p-4">
          <div className="text-[11px] font-medium text-slate-400 uppercase tracking-wider mb-1 flex items-center justify-between">
            <span>Current Stake</span>
            <DollarSign className="w-3.5 h-3.5 text-amber-400" />
          </div>
          <div className="text-xl sm:text-2xl font-black font-mono text-amber-400">
            ${status.currentStake.toFixed(2)}
          </div>
          <div className="text-[10px] text-slate-400 mt-1 truncate">
            Mode: <span className="text-slate-200 font-semibold">{config.stakeMode}</span>
          </div>
        </div>

        {/* Strategy Mode */}
        <div className="rounded-xl bg-slate-900/90 border border-slate-800 p-4">
          <div className="text-[11px] font-medium text-slate-400 uppercase tracking-wider mb-1 flex items-center justify-between">
            <span>Strategy Pattern</span>
            <Target className="w-3.5 h-3.5 text-amber-400" />
          </div>
          <div className="text-base sm:text-lg font-black text-amber-300 truncate">
            {config.strategyMode === 'DOUBLE_IDENTICAL_2TICK' ? 'Twin Digit Differ' : 'Ascending Seq'}
          </div>
          <div className="text-[10px] text-slate-400 mt-1 flex items-center gap-1">
            <span>Duration:</span>
            <span className="px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 font-bold font-mono">
              {config.durationTicks} Ticks
            </span>
          </div>
        </div>

        {/* Market Scope / Target */}
        <div className="rounded-xl bg-slate-900/90 border border-slate-800 p-4">
          <div className="text-[11px] font-medium text-slate-400 uppercase tracking-wider mb-1 flex items-center justify-between">
            <span>{config.marketScope === 'SINGLE_SPECIFIC' ? 'Target Market' : 'Ascending Cycle'}</span>
            {config.marketScope === 'SINGLE_SPECIFIC' ? (
              <Target className="w-3.5 h-3.5 text-amber-400" />
            ) : (
              <Repeat className="w-3.5 h-3.5 text-indigo-400" />
            )}
          </div>
          <div className="text-base sm:text-lg font-black text-indigo-300 truncate">
            {config.marketScope === 'SINGLE_SPECIFIC'
              ? (ASCENDING_VOLATILITY_MARKETS.find((m) => m.symbol === (config.specificMarketSymbol || 'R_10'))?.shortName || 'Vol 10')
              : `Cycle #${status.currentCycle} (${status.cycleCompletedCount || 0}/${status.cycleTotalCount || activeMarketPool.length})`}
          </div>
          <div className="text-[10px] text-slate-400 mt-1 flex items-center gap-1">
            {config.marketScope === 'SINGLE_SPECIFIC' ? (
              <span className="text-amber-400 font-bold">🎯 Single Target Locked</span>
            ) : (
              <>
                <span>Next:</span>
                <span className="text-amber-400 font-bold">{status.currentMarket?.shortName || 'Vol 10'}</span>
              </>
            )}
          </div>
        </div>

        {/* Streak & Cycles */}
        <div className="rounded-xl bg-slate-900/90 border border-slate-800 p-4">
          <div className="text-[11px] font-medium text-slate-400 uppercase tracking-wider mb-1 flex items-center justify-between">
            <span>Deriv Balance</span>
            <Layers className="w-3.5 h-3.5 text-purple-400" />
          </div>
          <div className="text-xl sm:text-2xl font-black font-mono text-emerald-400">
            ${balanceUsd.toFixed(2)}
          </div>
          <div className="text-[10px] text-slate-400 mt-1 flex items-center gap-1.5">
            <span>Streak:</span>
            {status.consecutiveWins > 0 ? (
              <span className="text-emerald-400 font-bold font-mono">+{status.consecutiveWins} Wins</span>
            ) : status.consecutiveLosses > 0 ? (
              <span className="text-red-400 font-bold font-mono">-{status.consecutiveLosses} Losses</span>
            ) : (
              <span className="text-slate-500">0</span>
            )}
          </div>
        </div>
      </div>

      {/* 🚀 Ascending Volatility Ladder (10 ➔ 100) or Single Volatility Target Card */}
      <div className="rounded-2xl bg-gradient-to-r from-slate-900 via-slate-900/90 to-slate-950 border border-slate-800 p-5 shadow-xl">
        {config.marketScope === 'SINGLE_SPECIFIC' ? (
          /* Single Market Dedicated Sniper Target View */
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
                <Target className="w-6 h-6 animate-pulse" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-white">
                    Single Volatility Target Locked
                  </h3>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500 text-slate-950 font-black font-mono">
                    EXCLUSIVE MARKET MODE
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  Bot will continuously scan and execute Differ trades <strong className="text-amber-400">exclusively on {activeMarketPool[0]?.name}</strong> ({activeMarketPool[0]?.shortName}) whenever twin identical digits trigger.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-950 border border-amber-500/40">
                <span className="text-xs text-slate-400 font-semibold">Change Target:</span>
                <select
                  disabled={status.isRunning}
                  value={config.specificMarketSymbol || 'R_10'}
                  onChange={(e) => systemAutoEngine.selectSpecificMarket(e.target.value as MarketSymbol)}
                  className="bg-slate-900 border border-amber-500/60 rounded-lg px-2.5 py-1 text-xs text-amber-300 font-bold font-mono focus:outline-none"
                >
                  {ASCENDING_VOLATILITY_MARKETS.map((m) => (
                    <option key={m.symbol} value={m.symbol}>
                      {m.name} ({m.shortName}) - Vol {m.volatility}%
                    </option>
                  ))}
                </select>
              </div>

              <button
                disabled={status.isRunning}
                onClick={() => handleConfigChange({ marketScope: 'ALL_10_TO_100' })}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold border border-slate-700 transition-all disabled:opacity-50"
              >
                <Repeat className="w-3.5 h-3.5 text-cyan-400" />
                <span>Switch to Ascending Ladder (10➔100)</span>
              </button>
            </div>
          </div>
        ) : (
          /* Multi-Market Ascending Ladder Progression View */
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3 border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 rounded-lg bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
                  <Repeat className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-white flex items-center gap-2">
                    {config.marketScope === 'CUSTOM_SELECTED' ? 'Custom Volatility Pool Ladder' : 'Ascending Volatility Ladder (10 ➔ 100 • 1 Trade Per Market)'}
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 font-mono font-bold">
                      Step {status.activeMarketIndex + 1} of {activeMarketPool.length} (Cycle #{status.currentCycle})
                    </span>
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Scans sequentially through pool ({activeMarketPool.length} markets). Executes exactly <strong className="text-white">1 trade per market</strong>, settles with 2 ticks, updates the Deriv balance, and rotates to the next volatility market.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  disabled={!status.isRunning || status.isSettling || status.activeContractId !== null}
                  onClick={() => systemAutoEngine.skipToNextMarket()}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold border border-slate-700 transition-all disabled:opacity-50"
                >
                  <span>Skip Market</span>
                  <ChevronRight className="w-3.5 h-3.5 text-amber-400" />
                </button>
              </div>
            </div>

            {/* Interactive Step Track */}
            <div className="grid grid-cols-2 sm:grid-cols-5 lg:grid-cols-10 gap-2 pt-1">
              {activeMarketPool.map((market, idx) => {
                const isCurrentTarget = activeMarketPool[status.activeMarketIndex % activeMarketPool.length]?.symbol === market.symbol;
                const hasTraded = status.tradedSymbolsInCycle?.includes(market.symbol);
                const isQueued = !hasTraded && !isCurrentTarget;

                return (
                  <div
                    key={market.symbol}
                    className={`relative rounded-xl p-2.5 border text-center transition-all ${
                      isCurrentTarget
                        ? 'bg-gradient-to-b from-amber-500/20 via-slate-900 to-slate-950 border-amber-400 shadow-lg shadow-amber-500/20 ring-2 ring-amber-400/60 scale-105 z-10'
                        : hasTraded
                        ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-400'
                        : 'bg-slate-950/60 border-slate-800/80 text-slate-500'
                    }`}
                  >
                    <div className="text-[10px] font-mono font-bold text-slate-500 mb-0.5">#{idx + 1}</div>
                    <div className={`text-xs font-black truncate ${isCurrentTarget ? 'text-amber-300 font-mono' : hasTraded ? 'text-emerald-400 font-bold' : 'text-slate-400'}`}>
                      {market.shortName}
                    </div>
                    <div className="mt-1">
                      {isCurrentTarget ? (
                        <span className="inline-flex items-center gap-1 text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-amber-500 text-slate-950 animate-pulse">
                          Target 🎯
                        </span>
                      ) : hasTraded ? (
                        <span className="inline-flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400">
                          <CheckCircle2 className="w-2.5 h-2.5" /> Traded
                        </span>
                      ) : (
                        <span className="text-[9px] font-medium text-slate-600">
                          Queued
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* 🎯 LIVE DOUBLE IDENTICAL DIGIT RADAR & SCANNER GRID */}
      <div className="rounded-2xl bg-slate-900/80 border border-slate-800 p-5 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
              <Radar className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wider text-white flex items-center gap-2">
                Live Double Identical Digit Scanner Radar
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 font-mono">
                  {activeTwinCount} TWINS DETECTED
                </span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Continuously inspecting last digits on all markets. When <strong className="text-amber-400 font-mono">[d, d]</strong> twins form (e.g. 3, 3), bot automatically buys Differ ≠ d with 2 Ticks duration.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span className="inline-block w-2 h-2 rounded-full bg-amber-400 animate-ping" />
            <span>Example: [3, 3] ➔ Buy DIFF 3 ➔ Tick 1: 6, Tick 2: 8 ➔ Settle</span>
          </div>
        </div>

        {/* Market Tiles with Digit Stream & Twin Highlighting */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {(config.marketScope === 'SINGLE_SPECIFIC' || config.marketScope === 'ALL_10_TO_100' ? ASCENDING_VOLATILITY_MARKETS : activeMarketPool).map((market, idx) => {
            const live = marketStates.get(market.symbol);
            const digits = live ? live.recentDigits : [];
            const lastDigit = live ? live.lastDigit : 0;
            const displayPrice = live ? live.displayPrice : '---';
            const hasTwin = live?.hasTwinDigit ?? false;
            const twinDigit = live?.twinDigit ?? null;
            const isTradingThisMarket = status.activeContractId !== null && status.statusMessage.includes(market.shortName);
            const isCurrentTarget = activeMarketPool[status.activeMarketIndex % (activeMarketPool.length || 1)]?.symbol === market.symbol;
            const isSingleLocked = config.marketScope === 'SINGLE_SPECIFIC' && (config.specificMarketSymbol || 'R_10') === market.symbol;
            const hasTraded = status.tradedSymbolsInCycle?.includes(market.symbol);

            return (
              <div
                key={market.symbol}
                onClick={() => {
                  if (!status.isRunning) {
                    if (config.marketScope === 'CUSTOM_SELECTED') {
                      systemAutoEngine.toggleCustomMarketSymbol(market.symbol);
                    } else {
                      handleSelectSpecificMarket(market.symbol);
                    }
                  }
                }}
                title={status.isRunning ? undefined : `Click to lock ${market.name} as target`}
                className={`relative rounded-xl p-3.5 border transition-all ${!status.isRunning ? 'cursor-pointer' : ''} ${
                  isTradingThisMarket
                    ? 'bg-gradient-to-b from-amber-950/80 via-slate-900 to-slate-950 border-amber-500 shadow-xl shadow-amber-500/20 ring-2 ring-amber-500/50 scale-[1.02]'
                    : isSingleLocked
                    ? 'bg-gradient-to-b from-amber-950/60 via-slate-900 to-slate-950 border-amber-400 shadow-xl shadow-amber-500/10 ring-2 ring-amber-400/50'
                    : isCurrentTarget && config.marketScope !== 'SINGLE_SPECIFIC'
                    ? 'bg-gradient-to-b from-amber-950/50 via-slate-900 to-slate-950 border-amber-400/80 shadow-lg shadow-amber-500/10 ring-1 ring-amber-400/40'
                    : hasTwin
                    ? 'bg-gradient-to-b from-amber-950/30 via-slate-900 to-slate-950 border-amber-500/50'
                    : hasTraded
                    ? 'bg-emerald-950/10 border-slate-800 opacity-80'
                    : 'bg-slate-950/80 border-slate-800/80 hover:border-slate-700'
                }`}
              >
                {/* Active Trading Pin */}
                {isTradingThisMarket && (
                  <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 px-2.5 py-0.5 rounded-full bg-amber-500 text-slate-950 font-black text-[9px] uppercase tracking-wider shadow-md animate-pulse">
                    ⚡ 2-TICK TRADE ACTIVE
                  </div>
                )}

                {!isTradingThisMarket && isSingleLocked && (
                  <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 px-2.5 py-0.5 rounded-full bg-amber-400 text-slate-950 font-black text-[9px] uppercase tracking-wider shadow-md flex items-center gap-1">
                    <Target className="w-3 h-3" />
                    <span>LOCKED TARGET</span>
                  </div>
                )}

                {!isTradingThisMarket && !isSingleLocked && isCurrentTarget && (
                  <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 px-2.5 py-0.5 rounded-full bg-amber-500 text-slate-950 font-black text-[9px] uppercase tracking-wider shadow-md">
                    🎯 CURRENT ASCENDING TARGET
                  </div>
                )}

                {hasTwin && !isTradingThisMarket && !isCurrentTarget && !isSingleLocked && (
                  <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 px-2.5 py-0.5 rounded-full bg-gradient-to-r from-amber-500 to-emerald-500 text-slate-950 font-black text-[9px] uppercase tracking-wider shadow-md">
                    🎯 TWIN [{twinDigit}, {twinDigit}] DETECTED
                  </div>
                )}

                {/* Market Header */}
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-mono font-bold text-slate-500">#{idx + 1}</span>
                    <span className="text-xs font-bold text-slate-200 truncate">{market.shortName}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                      market.volatility >= 75 ? 'bg-red-500/20 text-red-400' :
                      market.volatility >= 50 ? 'bg-amber-500/20 text-amber-400' :
                      'bg-cyan-500/20 text-cyan-400'
                    }`}>
                      {market.volatility}%
                    </span>
                  </div>
                </div>

                {/* Live Price */}
                <div className="flex items-baseline justify-between mb-2 font-mono text-xs">
                  <span className="text-slate-400 truncate max-w-[60%]">{displayPrice}</span>
                  <span className="text-[10px] text-slate-500">Vol {market.volatility}</span>
                </div>

                {/* Live Recent Digits Visual Stream with Twin Highlights */}
                <div className="p-2 rounded-lg bg-slate-950 border border-slate-800/80 mb-2">
                  <div className="text-[9px] text-slate-500 uppercase font-semibold mb-1 flex items-center justify-between">
                    <span>Recent Digits</span>
                    <span className="font-mono">Last: [{lastDigit}]</span>
                  </div>

                  <div className="flex items-center justify-end gap-1 overflow-x-auto py-0.5">
                    {digits.slice(-6).map((d, dIdx, arr) => {
                      const isLast = dIdx === arr.length - 1;
                      const isSecondLast = dIdx === arr.length - 2;
                      const isPartOfTwin = hasTwin && (isLast || isSecondLast) && d === twinDigit;

                      return (
                        <span
                          key={dIdx}
                          className={`inline-flex items-center justify-center w-6 h-6 rounded-md font-mono text-xs font-bold transition-all ${
                            isPartOfTwin
                              ? 'bg-amber-500 text-slate-950 font-black shadow-md shadow-amber-500/40 ring-2 ring-amber-300 scale-110'
                              : isLast
                              ? 'bg-slate-700 text-white font-bold'
                              : 'bg-slate-900 text-slate-400'
                          }`}
                        >
                          {d}
                        </span>
                      );
                    })}
                  </div>
                </div>

                {/* Differ Trigger Action Preview & Target Switcher Button */}
                <div className="flex items-center justify-between pt-1 border-t border-slate-800/60 text-[10px] gap-1">
                  <button
                    disabled={status.isRunning}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSelectSpecificMarket(market.symbol);
                    }}
                    title={`Lock bot to trade exclusively on ${market.name}`}
                    className={`font-mono text-[10px] font-bold px-2 py-0.5 rounded transition-all flex items-center gap-1 ${
                      isSingleLocked
                        ? 'bg-amber-400 text-slate-950 font-black ring-1 ring-amber-300'
                        : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 hover:border-amber-400'
                    }`}
                  >
                    <Target className="w-2.5 h-2.5" />
                    <span>{isSingleLocked ? 'Target' : 'Select'}</span>
                  </button>

                  <button
                    disabled={status.isRunning}
                    onClick={() => systemAutoEngine.triggerManualDoubleDiffer(market.symbol, hasTwin && twinDigit !== null ? twinDigit : lastDigit)}
                    className="font-mono font-bold px-2 py-0.5 rounded bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/30 transition-all disabled:opacity-50 truncate"
                  >
                    DIFF ≠ {hasTwin && twinDigit !== null ? twinDigit : lastDigit} ({config.durationTicks}t)
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ⚙️ Configuration & Live HUD Section */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Stake, Money Management & Sniper Settings (7 Cols) */}
        <div className="lg:col-span-7 space-y-6">
          <div className="rounded-2xl bg-slate-900/90 border border-slate-800 p-5 shadow-xl space-y-5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Sliders className="w-5 h-5 text-amber-400" />
                <h3 className="text-sm font-bold uppercase tracking-wider text-white">
                  Stake & Strategy Configuration
                </h3>
              </div>
              <span className="text-xs text-slate-400 font-mono">
                Balance: <strong className="text-emerald-400">${balanceUsd.toFixed(2)}</strong>
              </span>
            </div>

            {/* Base Stake & Quick Presets */}
            <div>
              <label className="text-xs font-semibold text-slate-300 mb-2 flex items-center justify-between">
                <span>Base Stake (USD)</span>
                <span className="text-slate-500 text-[11px]">Min $0.35</span>
              </label>
              <div className="grid grid-cols-6 gap-2 mb-2">
                {[0.35, 0.50, 1.00, 2.00, 5.00, 10.00].map((preset) => (
                  <button
                    key={preset}
                    disabled={status.isRunning}
                    onClick={() => handleConfigChange({ baseStake: preset })}
                    className={`py-1.5 rounded-lg text-xs font-mono font-bold border transition-all ${
                      config.baseStake === preset
                        ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md shadow-amber-500/20 font-black'
                        : 'bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700 hover:text-white disabled:opacity-50'
                    }`}
                  >
                    ${preset.toFixed(2)}
                  </button>
                ))}
              </div>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 font-mono font-bold">$</span>
                <input
                  type="number"
                  step="0.05"
                  min="0.35"
                  max="5000"
                  disabled={status.isRunning}
                  value={config.baseStake}
                  onChange={(e) => handleConfigChange({ baseStake: Math.max(0.35, Number(e.target.value)) })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 pl-8 pr-4 text-white font-mono text-sm font-bold focus:outline-none focus:border-amber-500 disabled:opacity-50"
                />
              </div>
            </div>

            {/* Money Management Strategy Selector */}
            <div>
              <label className="text-xs font-semibold text-slate-300 mb-2 block">
                Money Management Strategy
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { id: 'MARTINGALE', label: 'Martingale', desc: '11.2x on loss' },
                  { id: 'COMPOUNDING', label: 'Compounding', desc: 'Reinvest wins' },
                  { id: 'HYBRID', label: 'Hybrid', desc: 'Compound + Mart' },
                  { id: 'FLAT', label: 'Flat Stake', desc: 'Fixed stake' },
                ].map((mode) => (
                  <button
                    key={mode.id}
                    disabled={status.isRunning}
                    onClick={() => handleConfigChange({ stakeMode: mode.id as MoneyManagementMode })}
                    className={`p-3 rounded-xl text-left border transition-all ${
                      config.stakeMode === mode.id
                        ? 'bg-gradient-to-b from-amber-950/60 to-slate-950 border-amber-500 shadow-md ring-1 ring-amber-500/30'
                        : 'bg-slate-950 border-slate-800 hover:border-slate-700 text-slate-400 disabled:opacity-50'
                    }`}
                  >
                    <div className={`text-xs font-bold ${config.stakeMode === mode.id ? 'text-amber-400' : 'text-slate-300'}`}>
                      {mode.label}
                    </div>
                    <div className="text-[10px] text-slate-500 mt-0.5">{mode.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Specific Parameters for Selected Money Management */}
            {config.stakeMode === 'MARTINGALE' && (
              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">Martingale Multiplier</label>
                  <input
                    type="number"
                    step="0.1"
                    min="1.1"
                    max="20"
                    disabled={status.isRunning}
                    value={config.martingaleMultiplier}
                    onChange={(e) => handleConfigChange({ martingaleMultiplier: Number(e.target.value) })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white font-mono text-xs font-bold"
                  />
                  <span className="text-[10px] text-slate-500 mt-1 block">Default: 11.2x (recovers 9.8% Differ payout)</span>
                </div>
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">Max Recovery Steps</label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    disabled={status.isRunning}
                    value={config.maxMartingaleSteps}
                    onChange={(e) => handleConfigChange({ maxMartingaleSteps: Number(e.target.value) })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white font-mono text-xs font-bold"
                  />
                  <span className="text-[10px] text-slate-500 mt-1 block">Resets to Base Stake after N losses</span>
                </div>
              </div>
            )}

            {config.stakeMode === 'COMPOUNDING' && (
              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800">
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] text-slate-400">Win Compounding Reinvestment Rate</label>
                  <span className="font-mono text-xs font-bold text-emerald-400">{config.compoundingPercent}%</span>
                </div>
                <input
                  type="range"
                  min="10"
                  max="100"
                  step="5"
                  disabled={status.isRunning}
                  value={config.compoundingPercent}
                  onChange={(e) => handleConfigChange({ compoundingPercent: Number(e.target.value) })}
                  className="w-full accent-emerald-500 cursor-pointer"
                />
              </div>
            )}

            {/* ⏱️ Trade Duration (Ticks) & 🎯 Volatility Market Target Settings */}
            <div className="space-y-4 pt-1">
              {/* ⏱️ Contract Duration in Ticks */}
              <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800/80 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/60 pb-2.5">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-cyan-400" />
                    <div>
                      <span className="text-xs font-bold text-white uppercase tracking-wider">Contract Duration (Ticks to Settle)</span>
                      <p className="text-[11px] text-slate-400">Choose how many ticks each Differ trade runs before settling</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-slate-400">Current:</span>
                    <span className="px-2.5 py-1 rounded-md bg-cyan-500/20 text-cyan-300 font-mono font-black text-xs border border-cyan-500/40 shadow-sm">
                      {config.durationTicks} Tick{config.durationTicks > 1 ? 's' : ''}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-7 gap-1.5">
                  {[
                    { ticks: 1, label: '1 Tick ⚡', desc: 'Instant 1t' },
                    { ticks: 2, label: '2 Ticks 🎯', desc: 'Standard 2t' },
                    { ticks: 3, label: '3 Ticks', desc: 'Extended 3t' },
                    { ticks: 4, label: '4 Ticks', desc: '4t Settle' },
                    { ticks: 5, label: '5 Ticks', desc: '5t Settle' },
                    { ticks: 7, label: '7 Ticks', desc: '7t Settle' },
                    { ticks: 10, label: '10 Ticks', desc: '10t Settle' },
                  ].map((item) => (
                    <button
                      key={item.ticks}
                      type="button"
                      disabled={status.isRunning}
                      onClick={() => handleConfigChange({ durationTicks: item.ticks })}
                      className={`py-2 px-1.5 rounded-xl text-xs font-bold border transition-all text-center ${
                        config.durationTicks === item.ticks
                          ? 'bg-gradient-to-r from-cyan-600 to-cyan-500 text-white border-cyan-400 shadow-md shadow-cyan-500/25 font-black scale-[1.02]'
                          : 'bg-slate-900/90 text-slate-300 border-slate-800 hover:border-slate-700 hover:text-white disabled:opacity-50'
                      }`}
                    >
                      <div className="font-mono text-xs">{item.label}</div>
                      <div className="text-[9px] opacity-75 font-normal">{item.desc}</div>
                    </button>
                  ))}
                </div>

                <div className="flex items-center justify-between gap-3 pt-1">
                  <div className="text-[11px] text-cyan-300/90 bg-cyan-950/30 border border-cyan-800/40 rounded-lg px-3 py-1.5 flex-1 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                    <span>
                      {config.durationTicks === 1 && (
                        <><strong>1-Tick Instant Mode:</strong> Contract settles on the very next tick. Exit digit is compared immediately against the prediction.</>
                      )}
                      {config.durationTicks === 2 && (
                        <><strong>2-Tick Standard Mode:</strong> Contract progresses through tick 1 and settles on tick 2 (double-tick Differ sniper).</>
                      )}
                      {config.durationTicks > 2 && (
                        <><strong>{config.durationTicks}-Tick Duration:</strong> Contract progresses across {config.durationTicks} ticks and settles on tick #{config.durationTicks}.</>
                      )}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-[11px] text-slate-400 font-mono">Custom:</span>
                    <input
                      type="number"
                      min="1"
                      max="10"
                      step="1"
                      disabled={status.isRunning}
                      value={config.durationTicks}
                      onChange={(e) => handleConfigChange({ durationTicks: Math.min(10, Math.max(1, Number(e.target.value) || 1)) })}
                      className="w-16 bg-slate-900 border border-cyan-500/50 rounded-lg py-1 px-2 text-cyan-300 font-mono text-xs font-bold text-center focus:outline-none focus:border-cyan-400"
                    />
                  </div>
                </div>
              </div>

              {/* 🎯 Target Volatility Market Selection & Strategy Scope */}
              <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800/80 space-y-3.5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/60 pb-2.5">
                  <div className="flex items-center gap-2">
                    <Target className="w-4 h-4 text-amber-400" />
                    <div>
                      <span className="text-xs font-bold text-white uppercase tracking-wider">Target Volatility Market Selection</span>
                      <p className="text-[11px] text-slate-400">Select a specific volatility market to trade exclusively, or use rotation ladders</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {config.marketScope === 'SINGLE_SPECIFIC' ? (
                      <span className="px-2.5 py-1 rounded-md bg-amber-500/20 text-amber-300 font-mono font-bold text-xs border border-amber-500/40">
                        🎯 Specific: {ASCENDING_VOLATILITY_MARKETS.find((m) => m.symbol === (config.specificMarketSymbol || 'R_10'))?.shortName}
                      </span>
                    ) : (
                      <span className="px-2.5 py-1 rounded-md bg-slate-800 text-slate-300 font-mono font-bold text-xs">
                        {activeMarketPool.length} Markets in Pool
                      </span>
                    )}
                  </div>
                </div>

                {/* Mode Selector Tabs */}
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5">
                  <button
                    type="button"
                    disabled={status.isRunning}
                    onClick={() => handleSelectSpecificMarket(config.specificMarketSymbol || selectedSymbol || 'R_10')}
                    className={`p-2 rounded-xl text-xs font-bold border transition-all text-left flex flex-col gap-0.5 ${
                      config.marketScope === 'SINGLE_SPECIFIC'
                        ? 'bg-gradient-to-r from-amber-500 to-amber-400 text-slate-950 border-amber-300 shadow-md shadow-amber-500/25 font-black ring-1 ring-amber-300'
                        : 'bg-slate-900/90 text-amber-400/90 border-amber-500/30 hover:border-amber-400 hover:text-amber-300 disabled:opacity-50'
                    }`}
                  >
                    <div className="flex items-center gap-1">
                      <Target className="w-3 h-3 shrink-0" />
                      <span className="truncate">Single Specific</span>
                    </div>
                    <span className={`text-[9px] ${config.marketScope === 'SINGLE_SPECIFIC' ? 'text-slate-900 font-bold' : 'text-slate-500'}`}>
                      Trade 1 Market Only
                    </span>
                  </button>

                  <button
                    type="button"
                    disabled={status.isRunning}
                    onClick={() => handleConfigChange({ marketScope: 'ALL_10_TO_100' })}
                    className={`p-2 rounded-xl text-xs font-bold border transition-all text-left flex flex-col gap-0.5 ${
                      config.marketScope === 'ALL_10_TO_100'
                        ? 'bg-cyan-500 text-slate-950 border-cyan-400 shadow-md shadow-cyan-500/25 font-black'
                        : 'bg-slate-900/90 text-slate-300 border-slate-800 hover:border-slate-700 hover:text-white disabled:opacity-50'
                    }`}
                  >
                    <div className="flex items-center gap-1">
                      <Repeat className="w-3 h-3 shrink-0" />
                      <span className="truncate">All 10 Ladder</span>
                    </div>
                    <span className={`text-[9px] ${config.marketScope === 'ALL_10_TO_100' ? 'text-slate-900 font-bold' : 'text-slate-500'}`}>
                      10 ➔ 100 Ascending
                    </span>
                  </button>

                  <button
                    type="button"
                    disabled={status.isRunning}
                    onClick={() => handleConfigChange({ marketScope: 'STANDARD_10_TO_100' })}
                    className={`p-2 rounded-xl text-xs font-bold border transition-all text-left flex flex-col gap-0.5 ${
                      config.marketScope === 'STANDARD_10_TO_100'
                        ? 'bg-cyan-500 text-slate-950 border-cyan-400 shadow-md shadow-cyan-500/25 font-black'
                        : 'bg-slate-900/90 text-slate-300 border-slate-800 hover:border-slate-700 hover:text-white disabled:opacity-50'
                    }`}
                  >
                    <div className="flex items-center gap-1">
                      <Layers className="w-3 h-3 shrink-0" />
                      <span className="truncate">Standard (5)</span>
                    </div>
                    <span className={`text-[9px] ${config.marketScope === 'STANDARD_10_TO_100' ? 'text-slate-900 font-bold' : 'text-slate-500'}`}>
                      10, 25, 50, 75, 100
                    </span>
                  </button>

                  <button
                    type="button"
                    disabled={status.isRunning}
                    onClick={() => handleConfigChange({ marketScope: 'ONESECOND_10_TO_100' })}
                    className={`p-2 rounded-xl text-xs font-bold border transition-all text-left flex flex-col gap-0.5 ${
                      config.marketScope === 'ONESECOND_10_TO_100'
                        ? 'bg-cyan-500 text-slate-950 border-cyan-400 shadow-md shadow-cyan-500/25 font-black'
                        : 'bg-slate-900/90 text-slate-300 border-slate-800 hover:border-slate-700 hover:text-white disabled:opacity-50'
                    }`}
                  >
                    <div className="flex items-center gap-1">
                      <Zap className="w-3 h-3 shrink-0" />
                      <span className="truncate">1-Second (5)</span>
                    </div>
                    <span className={`text-[9px] ${config.marketScope === 'ONESECOND_10_TO_100' ? 'text-slate-900 font-bold' : 'text-slate-500'}`}>
                      10 1s, 25 1s.. 100 1s
                    </span>
                  </button>

                  <button
                    type="button"
                    disabled={status.isRunning}
                    onClick={() => handleConfigChange({ marketScope: 'CUSTOM_SELECTED' })}
                    className={`p-2 rounded-xl text-xs font-bold border transition-all text-left flex flex-col gap-0.5 ${
                      config.marketScope === 'CUSTOM_SELECTED'
                        ? 'bg-indigo-600 text-white border-indigo-400 shadow-md shadow-indigo-500/25 font-black'
                        : 'bg-slate-900/90 text-slate-300 border-slate-800 hover:border-slate-700 hover:text-white disabled:opacity-50'
                    }`}
                  >
                    <div className="flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3 shrink-0" />
                      <span className="truncate">Custom Select</span>
                    </div>
                    <span className={`text-[9px] ${config.marketScope === 'CUSTOM_SELECTED' ? 'text-indigo-200' : 'text-slate-500'}`}>
                      Pick Your Markets
                    </span>
                  </button>
                </div>

                {/* 10-Market Direct Selection Grid */}
                <div className="space-y-2 pt-1">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-400 font-semibold">
                      {config.marketScope === 'SINGLE_SPECIFIC'
                        ? 'Click any market below to set as exclusive target:'
                        : config.marketScope === 'CUSTOM_SELECTED'
                        ? 'Toggle markets to include/exclude:'
                        : 'Active Volatility Pool Markets:'}
                    </span>
                    <span className="text-[10px] text-amber-400/90 font-mono font-bold">
                      10 Volatilities Available
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                    {ASCENDING_VOLATILITY_MARKETS.map((m) => {
                      const isSingleTarget = config.marketScope === 'SINGLE_SPECIFIC' && (config.specificMarketSymbol || 'R_10') === m.symbol;
                      const isCustomActive = config.marketScope === 'CUSTOM_SELECTED' && (config.selectedSymbols?.includes(m.symbol) ?? true);
                      const isPoolIncluded = activeMarketPool.some((p) => p.symbol === m.symbol);
                      const liveState = marketStates.get(m.symbol);

                      return (
                        <button
                          key={m.symbol}
                          type="button"
                          disabled={status.isRunning}
                          onClick={() => {
                            if (config.marketScope === 'CUSTOM_SELECTED') {
                              systemAutoEngine.toggleCustomMarketSymbol(m.symbol);
                            } else {
                              handleSelectSpecificMarket(m.symbol);
                            }
                          }}
                          className={`p-2.5 rounded-xl text-left border transition-all relative overflow-hidden ${
                            isSingleTarget
                              ? 'bg-amber-400 text-slate-950 font-bold border-amber-300 shadow-lg shadow-amber-400/20 ring-2 ring-amber-300 scale-[1.02]'
                              : isCustomActive && config.marketScope === 'CUSTOM_SELECTED'
                              ? 'bg-indigo-600/30 border-indigo-500 text-indigo-100'
                              : isPoolIncluded && config.marketScope !== 'SINGLE_SPECIFIC'
                              ? 'bg-slate-900 border-slate-700 text-slate-200 hover:border-amber-400'
                              : 'bg-slate-950 border-slate-800 text-slate-500 hover:border-slate-700 hover:text-slate-300 disabled:opacity-50'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-mono text-xs font-black truncate">{m.shortName}</span>
                            {isSingleTarget ? (
                              <span className="px-1.5 py-0.2 rounded bg-slate-950 text-amber-400 text-[9px] font-black uppercase">TARGET</span>
                            ) : isCustomActive && config.marketScope === 'CUSTOM_SELECTED' ? (
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                            ) : (
                              <span className="text-[9px] font-mono opacity-60">{m.volatility}%</span>
                            )}
                          </div>
                          <div className="text-[10px] truncate opacity-75">{m.name}</div>
                          {liveState && (
                            <div className="mt-1 flex items-center justify-between text-[9px] font-mono">
                              <span className="opacity-70">Digit:</span>
                              <span className={`font-black ${isSingleTarget ? 'text-slate-950' : 'text-amber-400'}`}>
                                [{liveState.lastDigit}]
                              </span>
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Dropdown Selector for Single Market */}
                {config.marketScope === 'SINGLE_SPECIFIC' && (
                  <div className="pt-2 border-t border-slate-800/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <label className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                      <Target className="w-3.5 h-3.5 text-amber-400" />
                      <span>Direct Dropdown Selector:</span>
                    </label>
                    <select
                      disabled={status.isRunning}
                      value={config.specificMarketSymbol || 'R_10'}
                      onChange={(e) => handleSelectSpecificMarket(e.target.value as MarketSymbol)}
                      className="bg-slate-900 border border-amber-500/60 rounded-xl px-3 py-2 text-amber-300 font-bold text-xs focus:outline-none focus:border-amber-400"
                    >
                      {ASCENDING_VOLATILITY_MARKETS.map((m) => (
                        <option key={m.symbol} value={m.symbol}>
                          {m.name} ({m.shortName}) — Volatility: {m.volatility}% — Decimal: {m.pipSize}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            </div>

            {/* Inter-Trade Pause & Risk Controls */}
            <div>
              <label className="text-xs font-semibold text-slate-300 mb-2 block flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5 text-amber-400" />
                  <span>Execution & Settlement Speed (Inter-Trade Pause)</span>
                </span>
                <span className={`font-mono text-xs font-bold ${config.delayBetweenTradesMs === 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                  {config.delayBetweenTradesMs === 0 ? '⚡ 0ms (Instant Direct Buy)' : `${config.delayBetweenTradesMs}ms`}
                </span>
              </label>
              <div className="grid grid-cols-4 gap-2 mb-2">
                {[
                  { label: '⚡ Instant (0ms)', value: 0, desc: 'Zero Lag' },
                  { label: '⚡ Ultra (150ms)', value: 150, desc: 'Fast' },
                  { label: 'Standard (500ms)', value: 500, desc: 'Normal' },
                  { label: 'Safe (1000ms)', value: 1000, desc: 'Relaxed' },
                ].map((item) => (
                  <button
                    key={item.value}
                    disabled={status.isRunning}
                    onClick={() => handleConfigChange({ delayBetweenTradesMs: item.value })}
                    className={`py-2 px-1 rounded-lg text-xs font-bold border transition-all text-center ${
                      config.delayBetweenTradesMs === item.value
                        ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md shadow-amber-500/25 font-black'
                        : 'bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700 disabled:opacity-50'
                    }`}
                  >
                    <div>{item.label}</div>
                    <div className="text-[9px] opacity-75 font-normal">{item.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Risk Controls: Take Profit & Stop Loss */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
              <div>
                <label className="text-[11px] font-semibold text-slate-400 mb-1 flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Take Profit (USD)</span>
                </label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  disabled={status.isRunning}
                  value={config.takeProfit}
                  onChange={(e) => handleConfigChange({ takeProfit: Math.max(1, Number(e.target.value)) })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-emerald-400 font-mono text-xs font-bold"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-400 mb-1 flex items-center gap-1">
                  <ShieldAlert className="w-3.5 h-3.5 text-red-400" />
                  <span>Stop Loss (USD)</span>
                </label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  disabled={status.isRunning}
                  value={config.stopLoss}
                  onChange={(e) => handleConfigChange({ stopLoss: Math.max(1, Number(e.target.value)) })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-red-400 font-mono text-xs font-bold"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-400 mb-1">Max Consec. Losses</label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  disabled={status.isRunning}
                  value={config.maxConsecutiveLosses}
                  onChange={(e) => handleConfigChange({ maxConsecutiveLosses: Math.max(1, Number(e.target.value)) })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-amber-400 font-mono text-xs font-bold"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Live Dynamic-Tick Contract Resolution HUD & Pipeline (5 Cols) */}
        <div className="lg:col-span-5 space-y-6">
          <div className="rounded-2xl bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 border border-slate-800 p-5 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-amber-400" />
                <h3 className="text-sm font-bold uppercase tracking-wider text-white">
                  Live {config.durationTicks}-Tick Settlement HUD
                </h3>
              </div>
              <span className="text-[11px] px-2 py-0.5 rounded bg-slate-800 text-amber-300 font-mono font-bold">
                {config.durationTicks}-Tick Differ Contract
              </span>
            </div>

            {status.isRunning ? (
              <div className="space-y-4">
                {/* Settling Notice */}
                {status.isSettling && (
                  <div className="p-3.5 rounded-xl bg-gradient-to-r from-emerald-950/80 via-slate-900 to-cyan-950/80 border border-emerald-500/50 shadow-lg shadow-emerald-500/10 animate-pulse">
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="flex items-center gap-1.5 font-bold text-emerald-400">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        <span>Trade Settled & Balance Synced</span>
                      </span>
                      <span className="font-mono text-xs font-bold text-cyan-300">
                        ${status.lastSettledBalance?.toFixed(2) || balanceUsd.toFixed(2)}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-300">
                      {status.lastSettledMarketName || 'Market'} closed ({status.lastSettledProfit !== null && status.lastSettledProfit >= 0 ? '+' : ''}${status.lastSettledProfit?.toFixed(2) || '0.00'}) ➔ Balance updated ➔ Resuming live radar scan...
                    </p>
                  </div>
                )}

                {/* Active Trading Target Card */}
                <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800/80 flex items-center justify-between">
                  <div>
                    <div className="text-xs text-slate-400 font-medium">Trigger Condition</div>
                    <div className="text-base font-black text-amber-400">
                      {status.activeTriggerReason || 'Scanning for [d, d] twin digits...'}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-slate-400 font-medium">Differing Target</div>
                    <div className="text-2xl font-black font-mono text-rose-500 animate-pulse">
                      ≠ {status.activeDifferDigit !== null ? status.activeDifferDigit : '?'}
                    </div>
                  </div>
                </div>

                {/* Dynamic Resolution Pipeline Visualizer */}
                <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                  <div className="text-[11px] font-bold text-slate-300 uppercase tracking-wider flex items-center justify-between">
                    <span>{config.durationTicks}-Tick Contract Progression</span>
                    <span className="text-[10px] text-cyan-400 font-mono">
                      Duration: {config.durationTicks} Tick{config.durationTicks > 1 ? 's' : ''}
                    </span>
                  </div>

                  <div className={`grid gap-2 pt-1 ${
                    config.durationTicks === 1
                      ? 'grid-cols-1'
                      : config.durationTicks === 2
                      ? 'grid-cols-2'
                      : config.durationTicks === 3
                      ? 'grid-cols-3'
                      : 'grid-cols-2 sm:grid-cols-4'
                  }`}>
                    {Array.from({ length: config.durationTicks }).map((_, i) => {
                      const isFinal = i === config.durationTicks - 1;
                      const tickData = status.activeContractTicks[i];
                      const isDone = Boolean(tickData);

                      return (
                        <div
                          key={i}
                          className={`p-2.5 rounded-lg border text-center transition-all ${
                            isFinal
                              ? isDone
                                ? 'bg-emerald-950/40 border-emerald-500/60'
                                : 'bg-slate-900 border-amber-500/40'
                              : isDone
                              ? 'bg-slate-900 border-cyan-500/40'
                              : 'bg-slate-900 border-slate-800'
                          }`}
                        >
                          <div className={`text-[10px] font-bold uppercase ${isFinal ? 'text-amber-400' : 'text-slate-400'}`}>
                            Tick {i + 1} {isFinal ? '(Settles)' : ''}
                          </div>
                          <div className="text-xs font-mono font-bold mt-1">
                            {isDone ? (
                              <span className={isFinal ? 'text-emerald-400 font-black' : 'text-cyan-400 font-bold'}>
                                Digit [{tickData.digit}] {isFinal ? '➔ END' : ''}
                              </span>
                            ) : (
                              <span className="text-slate-600 animate-pulse text-[11px]">
                                {status.activeContractTicks.length === i ? 'Reading...' : `Wait ${i + 1}...`}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Financial Overview */}
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
                    <div className="text-slate-500">Current Stake</div>
                    <div className="text-base font-bold font-mono text-amber-400">${status.currentStake.toFixed(2)}</div>
                  </div>
                  <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
                    <div className="text-slate-500">Expected Payout</div>
                    <div className="text-base font-bold font-mono text-emerald-400">
                      +${(status.currentStake * 0.098).toFixed(2)} (~9.8%)
                    </div>
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-emerald-950/30 border border-emerald-800/40 text-[11px] text-emerald-300 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>
                    <strong className="text-white font-semibold">Execution Mode:</strong> 1 Differ trade per trigger ➔ {config.durationTicks} tick{config.durationTicks > 1 ? 's' : ''} to settle ➔ Balance updated ➔ Resume scanning.
                  </span>
                </div>
              </div>
            ) : (
              <div className="py-8 text-center space-y-3">
                <div className="inline-flex p-3 rounded-full bg-slate-800/60 text-slate-400">
                  <Target className="w-8 h-8 text-amber-400" />
                </div>
                <div className="text-sm font-bold text-slate-300">Double Identical Differ Sniper is Standby</div>
                <p className="text-xs text-slate-500 max-w-xs mx-auto">
                  Click the amber/green <strong className="text-amber-400">START AUTO BOT</strong> button above to begin real-time scanning ({config.marketScope === 'SINGLE_SPECIFIC' ? 'Specific Market' : 'Multi-Market'}) with {config.durationTicks}-tick Differ execution.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 📜 Real-time Execution Log & Performance History */}
      <div className="rounded-2xl bg-slate-900/90 border border-slate-800 p-5 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4 border-b border-slate-800 pb-3">
          <div className="flex items-center gap-3">
            <BarChart2 className="w-5 h-5 text-emerald-400" />
            <h3 className="text-sm font-bold uppercase tracking-wider text-white">
              Real-Time Execution Log ({trades.length} Trades)
            </h3>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center bg-slate-950 rounded-lg p-0.5 border border-slate-800 text-xs">
              {(['ALL', 'WINS', 'LOSSES'] as const).map((filter) => (
                <button
                  key={filter}
                  onClick={() => setHistoryFilter(filter)}
                  className={`px-3 py-1 rounded-md font-bold transition-all ${
                    historyFilter === filter
                      ? 'bg-slate-800 text-white shadow'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {filter}
                </button>
              ))}
            </div>

            <button
              onClick={exportCSV}
              disabled={trades.length === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold disabled:opacity-50 transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </button>
          </div>
        </div>

        {/* Trade Stream Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
                <th className="py-2.5 px-3">Time</th>
                <th className="py-2.5 px-3">Market</th>
                <th className="py-2.5 px-3">Trigger Pattern</th>
                <th className="py-2.5 px-3">Differ Target</th>
                <th className="py-2.5 px-3">Tick 1 Spot</th>
                <th className="py-2.5 px-3">Tick 2 (Settle)</th>
                <th className="py-2.5 px-3">Result</th>
                <th className="py-2.5 px-3">Stake</th>
                <th className="py-2.5 px-3 text-right">Profit / Loss</th>
                <th className="py-2.5 px-3 text-right">Cycle</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {filteredTrades.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-8 text-center text-slate-500 font-sans">
                    No trades executed in this session yet. Start the bot to begin 2-tick Double Identical Differ scanning.
                  </td>
                </tr>
              ) : (
                filteredTrades.map((trade) => {
                  const isWin = trade.result === 'WIN';
                  const isOpen = trade.result === 'OPEN';
                  return (
                    <tr key={trade.id} className="hover:bg-slate-950/40 transition-colors">
                      <td className="py-2.5 px-3 text-slate-400 font-sans text-[11px]">{trade.timeString}</td>
                      <td className="py-2.5 px-3 font-sans font-bold text-slate-200">{trade.marketName}</td>
                      <td className="py-2.5 px-3 font-sans">
                        <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold text-[11px]">
                          {trade.twinPattern || trade.triggerReason || 'Double Identical'}
                        </span>
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="px-2 py-0.5 rounded bg-rose-500/20 text-rose-400 font-bold">
                          ≠ {trade.differDigit}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-slate-400">
                        {isOpen ? (
                          <span className="text-cyan-400 animate-pulse font-sans">In flight...</span>
                        ) : trade.intermediateDigit !== null && trade.intermediateDigit !== undefined ? (
                          <span>Digit [{trade.intermediateDigit}]</span>
                        ) : (
                          <span>---</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-slate-300">
                        {isOpen ? (
                          <span className="text-cyan-400 animate-pulse font-sans">Tick 2 settling...</span>
                        ) : (
                          <span className={`font-bold ${isWin ? 'text-emerald-400' : 'text-red-400'}`}>
                            Digit [{trade.exitDigit ?? '---'}]
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 font-sans">
                        {isOpen ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-cyan-500/20 text-cyan-400">
                            OPEN (2T)
                          </span>
                        ) : isWin ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>WIN</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-500/20 text-red-400">
                            <XCircle className="w-3 h-3" />
                            <span>LOSS</span>
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-slate-300">${trade.stake.toFixed(2)}</td>
                      <td className={`py-2.5 px-3 text-right font-bold ${
                        isOpen ? 'text-slate-500' : isWin ? 'text-emerald-400' : 'text-red-400'
                      }`}>
                        {isOpen ? '---' : trade.profit >= 0 ? `+$${trade.profit.toFixed(2)}` : `-$${Math.abs(trade.profit).toFixed(2)}`}
                      </td>
                      <td className="py-2.5 px-3 text-right text-slate-500 font-sans text-[11px]">
                        #{trade.cycleNumber}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
