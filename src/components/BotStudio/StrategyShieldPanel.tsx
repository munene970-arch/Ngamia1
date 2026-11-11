import React, { useEffect, useState } from 'react';
import {
  Shield,
  ShieldCheck,
  ShieldAlert,
  Zap,
  Activity,
  Sliders,
  Clock,
  Shuffle,
  AlertTriangle,
  Lock,
  RotateCcw,
  CheckCircle2,
  XCircle,
  HelpCircle,
  TrendingDown,
  Gauge,
  Flame,
  Radio,
  Target,
  History,
  Sparkles,
  Eye,
  EyeOff,
  Check,
  Trash2,
  DollarSign,
  Wallet,
  AlertCircle,
  RefreshCw,
  ArrowUpRight,
  Award,
} from 'lucide-react';
import {
  strategyShield,
  StrategyShieldConfig,
  ManipulationMetrics,
  ManipulationAnomalyItem,
} from '../../services/strategyShield';
import { derivWS } from '../../services/derivWebSocket';

interface StrategyShieldPanelProps {
  currentPingMs?: number;
  consecutiveLosses?: number;
  circuitBreakerSec?: number;
  onResetCircuitBreaker?: () => void;
  className?: string;
  isCompact?: boolean;
}

export type ShieldTab = 'PROTECTIONS' | 'MANIPULATION_RADAR' | 'PROFIT_SHIELD' | 'ZERO_TRACE';

export const StrategyShieldPanel: React.FC<StrategyShieldPanelProps> = ({
  currentPingMs = 28,
  consecutiveLosses = 0,
  circuitBreakerSec = 0,
  onResetCircuitBreaker,
  className = '',
  isCompact = false,
}) => {
  const [config, setConfig] = useState<StrategyShieldConfig>(() => strategyShield.getConfig());
  const [activeTab, setActiveTab] = useState<ShieldTab>('PROTECTIONS');
  const [isExpanded, setIsExpanded] = useState<boolean>(!isCompact);
  const [lastJitterMs, setLastJitterMs] = useState<number>(() => strategyShield.getLastAppliedJitterMs());
  const [manipulationMetrics, setManipulationMetrics] = useState<ManipulationMetrics>(() =>
    strategyShield.getManipulationMetrics()
  );
  const [profitLockStatus, setProfitLockStatus] = useState(() => strategyShield.isProfitLockActive());
  const [purgeSuccess, setPurgeSuccess] = useState<boolean>(false);

  useEffect(() => {
    const updateMetrics = () => {
      setLastJitterMs(strategyShield.getLastAppliedJitterMs());
      setManipulationMetrics(strategyShield.getManipulationMetrics());
      setProfitLockStatus(strategyShield.isProfitLockActive());
    };

    const unsub = strategyShield.subscribe((newCfg) => {
      setConfig(newCfg);
      updateMetrics();
    });

    const interval = window.setInterval(updateMetrics, 800);
    return () => {
      unsub();
      window.clearInterval(interval);
    };
  }, []);

  const handleToggle = (key: keyof StrategyShieldConfig) => {
    strategyShield.updateConfig({ [key]: !config[key] });
  };

  const handleNumberChange = (key: keyof StrategyShieldConfig, value: number) => {
    strategyShield.updateConfig({ [key]: value });
  };

  const handlePurgeAll = () => {
    strategyShield.purgeAllTradeHistoryAndFootprint();
    setPurgeSuccess(true);
    setTimeout(() => setPurgeSuccess(false), 3000);
  };

  const activeProtectionsCount = [
    config.enableTimingObfuscation,
    config.enableManipulationMonitor,
    config.enableTickDelayDefense,
    config.enableDigitSkewDefense,
    config.enableTargetDigitProtection,
    config.enableProfitTargetLock,
    config.enableBankedProfitProtection,
    config.enableZeroTraceMode,
    config.enableLatencyGuard,
    config.enableStakeFuzzing,
    config.enableLossStreakGuard,
    config.enableEntropyFilter,
  ].filter(Boolean).length;

  const pingStatus =
    currentPingMs < 80
      ? { label: 'Optimal', color: 'text-emerald-400', bg: 'bg-emerald-950/60 border-emerald-800' }
      : currentPingMs < 200
      ? { label: 'Good', color: 'text-cyan-400', bg: 'bg-cyan-950/60 border-cyan-800' }
      : currentPingMs < config.maxAllowedPingMs
      ? { label: 'Moderate', color: 'text-amber-400', bg: 'bg-amber-950/60 border-amber-800' }
      : { label: 'High Latency Spike', color: 'text-rose-400', bg: 'bg-rose-950/60 border-rose-800' };

  const threatColor =
    manipulationMetrics.threatLevel === 'CLEAN'
      ? 'text-emerald-400 border-emerald-700 bg-emerald-950/80'
      : manipulationMetrics.threatLevel === 'LOW'
      ? 'text-cyan-400 border-cyan-700 bg-cyan-950/80'
      : manipulationMetrics.threatLevel === 'ELEVATED'
      ? 'text-amber-400 border-amber-700 bg-amber-950/80'
      : 'text-rose-400 border-rose-700 bg-rose-950/80 animate-pulse';

  return (
    <div
      id="strategy-shield-module"
      className={`bg-slate-900 border rounded-2xl p-4 shadow-xl transition-all ${
        config.enabled
          ? 'border-emerald-500/40 shadow-emerald-950/20'
          : 'border-slate-800 opacity-90'
      } ${className}`}
    >
      {/* Top Header & Master Toggle */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2.5">
          <div
            className={`w-9 h-9 rounded-xl flex items-center justify-center border transition-all ${
              config.enabled
                ? 'bg-gradient-to-tr from-emerald-600 to-teal-500 text-slate-950 border-emerald-400 shadow-md shadow-emerald-900/30'
                : 'bg-slate-800 text-slate-400 border-slate-700'
            }`}
          >
            {config.enabled ? <ShieldCheck className="w-5 h-5" /> : <Shield className="w-5 h-5" />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-white font-extrabold text-sm tracking-tight flex items-center gap-1.5">
                Strategy Shield & Anti-Manipulation Engine
              </h3>
              <span
                className={`text-[9px] font-black px-2 py-0.5 rounded-full border uppercase tracking-wider ${
                  config.enabled
                    ? 'bg-emerald-950 text-emerald-300 border-emerald-700 font-mono animate-pulse'
                    : 'bg-slate-950 text-slate-500 border-slate-800'
                }`}
              >
                {config.enabled ? 'ACTIVE (PROTECTED)' : 'STANDBY'}
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              Anti-Manipulation Radar • Entry Point Cloaking • Post-Profit Lock • Zero-Trace Stealth
            </p>
          </div>
        </div>

        {/* Action Controls & Master Switch */}
        <div className="flex items-center gap-2 self-end sm:self-center">
          <button
            id="btn-toggle-shield-master"
            type="button"
            onClick={() => handleToggle('enabled')}
            className={`px-3.5 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 border transition-all ${
              config.enabled
                ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 border-emerald-400 shadow-md font-black'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
            }`}
          >
            {config.enabled ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
            {config.enabled ? 'Shield Armed' : 'Arm Shield'}
          </button>

          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-400 hover:text-white hover:border-slate-700 text-xs"
            title={isExpanded ? 'Collapse parameters' : 'Expand parameters'}
          >
            <Sliders className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ⚡ DIRECT LIVE EXECUTION CARD */}
      <div
        id="direct-trading-shield-banner"
        className="mt-3 p-3.5 rounded-xl border border-emerald-500/40 bg-gradient-to-r from-emerald-950/60 via-slate-950 to-slate-900 shadow-md shadow-emerald-950/20"
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center border shrink-0 mt-0.5 bg-emerald-600 text-slate-950 border-emerald-400 shadow-sm">
              <Zap className="w-5 h-5 fill-current" />
            </div>

            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-white font-extrabold text-xs sm:text-sm tracking-tight flex items-center gap-1.5">
                  Direct Live Account Execution with Anti-Manipulation Protection
                </span>
                <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-500 text-slate-950 border border-emerald-300 font-mono shadow-sm">
                  ⚡ 100% DIRECT DERIV API
                </span>
                {config.enableZeroTraceMode && (
                  <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-indigo-950 text-indigo-300 border border-indigo-700 font-mono flex items-center gap-1">
                    <EyeOff className="w-3 h-3" /> ZERO-TRACE ON
                  </span>
                )}
              </div>

              <p className="text-[11px] text-slate-300 mt-1 leading-relaxed">
                Trades execute directly on your connected Deriv account while Strategy Shield monitors broker tick anomalies, obfuscates request timestamps, locks in profits, and erases local trade history to prevent strategy tracking.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end md:self-center shrink-0">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 border border-emerald-800/60 text-emerald-300 text-xs font-mono font-bold">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Direct Deriv API Active
            </div>
          </div>
        </div>
      </div>

      {/* Live Status Telemetry Ribbon */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-3">
        {/* Dealing-Desk Threat Sensor */}
        <div className={`p-2.5 rounded-xl border flex flex-col justify-between ${threatColor}`}>
          <div className="flex items-center justify-between text-[10px]">
            <span className="font-bold uppercase flex items-center gap-1">
              <Gauge className="w-3 h-3" /> Manipulation Threat
            </span>
            <span className="font-mono font-black">{manipulationMetrics.threatScore}%</span>
          </div>
          <div className="font-mono font-black text-sm mt-1 flex items-baseline justify-between">
            <span>{manipulationMetrics.threatLevel.replace('_', ' ')}</span>
            <span className="text-[9px] opacity-80">
              {manipulationMetrics.isEvasiveActionActive
                ? `Hold: ${manipulationMetrics.evasiveHoldRemainingSec}s`
                : 'Sensor Active'}
            </span>
          </div>
        </div>

        {/* Anti-Manipulation Timing Shield */}
        <div className="p-2.5 rounded-xl border border-slate-800 bg-slate-950/80 flex flex-col justify-between">
          <div className="flex items-center justify-between text-[10px]">
            <span className="text-slate-400 font-bold uppercase flex items-center gap-1">
              <Clock className="w-3 h-3 text-cyan-400" /> Timing Obfuscation
            </span>
            <span className={`font-black ${config.enableTimingObfuscation ? 'text-cyan-400' : 'text-slate-500'}`}>
              {config.enableTimingObfuscation ? 'Active' : 'Off'}
            </span>
          </div>
          <div className="font-mono font-black text-sm text-cyan-300 mt-1 flex items-baseline gap-1">
            <span>
              {config.enableTimingObfuscation ? `${config.minJitterMs}–${config.maxJitterMs}ms` : 'Disabled'}
            </span>
            <span className="text-[9px] text-slate-500 font-medium">Jitter</span>
          </div>
        </div>

        {/* Stake Fuzzing / Anti-Martingale Mask */}
        <div className="p-2.5 rounded-xl border border-slate-800 bg-slate-950/80 flex flex-col justify-between">
          <div className="flex items-center justify-between text-[10px]">
            <span className="text-slate-400 font-bold uppercase flex items-center gap-1">
              <Shuffle className="w-3 h-3 text-amber-400" /> Stake Variance
            </span>
            <span className={`font-black ${config.enableStakeFuzzing ? 'text-amber-400' : 'text-slate-500'}`}>
              {config.enableStakeFuzzing ? 'Masked' : 'Fixed'}
            </span>
          </div>
          <div className="font-mono font-black text-sm text-amber-300 mt-1 flex items-baseline gap-1">
            <span>
              {config.enableStakeFuzzing ? `±$0.01–$${config.fuzzingMaxCents.toFixed(2)}` : 'Off'}
            </span>
            <span className="text-[9px] text-slate-500 font-medium">Anti-Profiling</span>
          </div>
        </div>

        {/* Circuit Breaker & Profit Lock Status */}
        <div
          className={`p-2.5 rounded-xl border flex flex-col justify-between ${
            profitLockStatus.locked
              ? 'bg-amber-950/70 border-amber-500 text-amber-200 animate-pulse'
              : circuitBreakerSec > 0
              ? 'bg-rose-950/70 border-rose-700 text-rose-300 animate-pulse'
              : consecutiveLosses > 0
              ? 'bg-amber-950/50 border-amber-800/80'
              : 'bg-slate-950/80 border-slate-800'
          }`}
        >
          <div className="flex items-center justify-between text-[10px]">
            <span className="text-slate-400 font-bold uppercase flex items-center gap-1">
              <Lock className="w-3 h-3 text-rose-400" /> Safety Lock
            </span>
            {profitLockStatus.locked ? (
              <span className="font-black text-amber-400">PROFIT SECURED</span>
            ) : circuitBreakerSec > 0 ? (
              <span className="font-black text-rose-400">PAUSED</span>
            ) : (
              <span className="font-mono text-slate-400">{consecutiveLosses}/{config.maxConsecutiveLosses} Losses</span>
            )}
          </div>
          <div className="font-mono font-black text-sm text-white mt-1 flex items-center justify-between">
            {profitLockStatus.locked ? (
              <span className="text-amber-400 text-xs">Target Met (+${profitLockStatus.profit.toFixed(2)})</span>
            ) : circuitBreakerSec > 0 ? (
              <span className="text-rose-400">Cooling: {circuitBreakerSec}s</span>
            ) : (
              <span className="text-emerald-400">Shield Armed</span>
            )}
            {(profitLockStatus.locked || circuitBreakerSec > 0) && (
              <button
                type="button"
                onClick={() => {
                  strategyShield.resetCircuitBreaker();
                  if (onResetCircuitBreaker) onResetCircuitBreaker();
                }}
                className="text-[9px] px-1.5 py-0.5 rounded bg-slate-800 text-white hover:bg-slate-700 border border-slate-600"
              >
                Reset
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Tabs Row for Advanced Shield Configurations */}
      {isExpanded && (
        <div className="mt-4 pt-3 border-t border-slate-800/80">
          <div className="flex flex-wrap items-center gap-1.5 pb-3">
            <button
              type="button"
              onClick={() => setActiveTab('PROTECTIONS')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
                activeTab === 'PROTECTIONS'
                  ? 'bg-emerald-500 text-slate-950 font-black shadow-md'
                  : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" /> Core Protections
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('MANIPULATION_RADAR')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
                activeTab === 'MANIPULATION_RADAR'
                  ? 'bg-cyan-500 text-slate-950 font-black shadow-md'
                  : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              <Gauge className="w-3.5 h-3.5" /> Manipulation Radar ({manipulationMetrics.threatScore}%)
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('PROFIT_SHIELD')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
                activeTab === 'PROFIT_SHIELD'
                  ? 'bg-amber-500 text-slate-950 font-black shadow-md'
                  : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              <DollarSign className="w-3.5 h-3.5" /> Post-Profit Lock
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('ZERO_TRACE')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
                activeTab === 'ZERO_TRACE'
                  ? 'bg-indigo-500 text-white font-black shadow-md'
                  : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              <EyeOff className="w-3.5 h-3.5" /> Stealth Zero-Trace (No History)
            </button>
          </div>

          {/* TAB 1: CORE PROTECTIONS */}
          {activeTab === 'PROTECTIONS' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {/* Timing Obfuscation */}
              <div className="bg-slate-950 border border-cyan-500/40 rounded-xl p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-cyan-400" />
                    Anti-Fingerprint Jitter
                  </span>
                  <input
                    type="checkbox"
                    checked={config.enableTimingObfuscation}
                    onChange={() => handleToggle('enableTimingObfuscation')}
                    className="rounded text-cyan-500 focus:ring-0 w-4 h-4 cursor-pointer accent-cyan-500"
                  />
                </div>
                <p className="text-[10px] text-slate-400 leading-relaxed">
                  Injects randomized millisecond delays and sub-tick phase drift to break robotic timestamp recognition by broker dealing-desks.
                </p>
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <div>
                    <span className="text-[9px] text-slate-500 font-bold uppercase">Min Delay (ms)</span>
                    <input
                      type="number"
                      min="50"
                      max="500"
                      value={config.minJitterMs}
                      disabled={!config.enableTimingObfuscation}
                      onChange={(e) => handleNumberChange('minJitterMs', Number(e.target.value) || 180)}
                      className="w-full mt-0.5 bg-slate-900 border border-slate-800 rounded-lg px-2 py-1 text-xs text-cyan-300 font-mono outline-none focus:border-cyan-500 disabled:opacity-40"
                    />
                  </div>
                  <div>
                    <span className="text-[9px] text-slate-500 font-bold uppercase">Max Delay (ms)</span>
                    <input
                      type="number"
                      min="100"
                      max="1200"
                      value={config.maxJitterMs}
                      disabled={!config.enableTimingObfuscation}
                      onChange={(e) => handleNumberChange('maxJitterMs', Number(e.target.value) || 650)}
                      className="w-full mt-0.5 bg-slate-900 border border-slate-800 rounded-lg px-2 py-1 text-xs text-white font-mono outline-none focus:border-cyan-500 disabled:opacity-40"
                    />
                  </div>
                </div>
              </div>

              {/* Stake Fuzzing */}
              <div className="bg-slate-950 border border-slate-800/90 rounded-xl p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white flex items-center gap-1.5">
                    <Shuffle className="w-3.5 h-3.5 text-amber-400" />
                    Anti-Martingale Masking
                  </span>
                  <input
                    type="checkbox"
                    checked={config.enableStakeFuzzing}
                    onChange={() => handleToggle('enableStakeFuzzing')}
                    className="rounded text-amber-500 focus:ring-0 w-4 h-4 cursor-pointer accent-amber-500"
                  />
                </div>
                <p className="text-[10px] text-slate-400 leading-relaxed">
                  Applies random micro-cent variances ($10.00 → $10.03) to disguise mechanical Martingale progressions from risk management servers.
                </p>
                <div className="pt-1">
                  <span className="text-[9px] text-slate-500 font-bold uppercase">Max Micro-Cent Variance ($)</span>
                  <input
                    type="number"
                    min="0.01"
                    max="0.25"
                    step="0.01"
                    value={config.fuzzingMaxCents}
                    disabled={!config.enableStakeFuzzing}
                    onChange={(e) => handleNumberChange('fuzzingMaxCents', Number(e.target.value) || 0.05)}
                    className="w-full mt-0.5 bg-slate-900 border border-slate-800 rounded-lg px-2 py-1 text-xs text-amber-300 font-mono outline-none focus:border-amber-500 disabled:opacity-40"
                  />
                </div>
              </div>

              {/* Latency & Slippage Guard */}
              <div className="bg-slate-950 border border-slate-800/90 rounded-xl p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white flex items-center gap-1.5">
                    <Radio className="w-3.5 h-3.5 text-emerald-400" />
                    Latency & Slippage Filter
                  </span>
                  <input
                    type="checkbox"
                    checked={config.enableLatencyGuard}
                    onChange={() => handleToggle('enableLatencyGuard')}
                    className="rounded text-emerald-500 focus:ring-0 w-4 h-4 cursor-pointer accent-emerald-500"
                  />
                </div>
                <p className="text-[10px] text-slate-400 leading-relaxed">
                  Rejects orders when broker WebSocket connection latency or tick delay exceeds safe boundaries.
                </p>
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <div>
                    <span className="text-[9px] text-slate-500 font-bold uppercase">Max Ping (ms)</span>
                    <input
                      type="number"
                      min="100"
                      max="2000"
                      step="50"
                      value={config.maxAllowedPingMs}
                      disabled={!config.enableLatencyGuard}
                      onChange={(e) => handleNumberChange('maxAllowedPingMs', Number(e.target.value) || 1500)}
                      className="w-full mt-0.5 bg-slate-900 border border-slate-800 rounded-lg px-2 py-1 text-xs text-emerald-300 font-mono outline-none focus:border-emerald-500 disabled:opacity-40"
                    />
                  </div>
                  <div>
                    <span className="text-[9px] text-slate-500 font-bold uppercase">Max Tick Age (ms)</span>
                    <input
                      type="number"
                      min="1000"
                      max="30000"
                      step="1000"
                      value={config.maxTickAgeMs}
                      disabled={!config.enableLatencyGuard}
                      onChange={(e) => handleNumberChange('maxTickAgeMs', Number(e.target.value) || 25000)}
                      className="w-full mt-0.5 bg-slate-900 border border-slate-800 rounded-lg px-2 py-1 text-xs text-white font-mono outline-none focus:border-emerald-500 disabled:opacity-40"
                    />
                  </div>
                </div>
              </div>

              {/* Loss Streak Circuit Breaker */}
              <div className="bg-slate-950 border border-slate-800/90 rounded-xl p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                    Streak Circuit Breaker
                  </span>
                  <input
                    type="checkbox"
                    checked={config.enableLossStreakGuard}
                    onChange={() => handleToggle('enableLossStreakGuard')}
                    className="rounded text-rose-500 focus:ring-0 w-4 h-4 cursor-pointer accent-rose-500"
                  />
                </div>
                <p className="text-[10px] text-slate-400 leading-relaxed">
                  Enforces an automated cooling period after consecutive losses to prevent emotional re-entry and dealer traps.
                </p>
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <div>
                    <span className="text-[9px] text-slate-500 font-bold uppercase">Max Losses</span>
                    <input
                      type="number"
                      min="1"
                      max="5"
                      value={config.maxConsecutiveLosses}
                      disabled={!config.enableLossStreakGuard}
                      onChange={(e) => handleNumberChange('maxConsecutiveLosses', Number(e.target.value) || 3)}
                      className="w-full mt-0.5 bg-slate-900 border border-slate-800 rounded-lg px-2 py-1 text-xs text-rose-400 font-mono outline-none focus:border-rose-500 disabled:opacity-40"
                    />
                  </div>
                  <div>
                    <span className="text-[9px] text-slate-500 font-bold uppercase">Cooling Pause (s)</span>
                    <input
                      type="number"
                      min="10"
                      max="300"
                      step="10"
                      value={config.cooldownDurationSec}
                      disabled={!config.enableLossStreakGuard}
                      onChange={(e) => handleNumberChange('cooldownDurationSec', Number(e.target.value) || 30)}
                      className="w-full mt-0.5 bg-slate-900 border border-slate-800 rounded-lg px-2 py-1 text-xs text-white font-mono outline-none focus:border-rose-500 disabled:opacity-40"
                    />
                  </div>
                </div>
              </div>

              {/* Entropy & Trap Detector */}
              <div className="bg-slate-950 border border-slate-800/90 rounded-xl p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white flex items-center gap-1.5">
                    <Flame className="w-3.5 h-3.5 text-orange-400" />
                    Digit Stream Entropy
                  </span>
                  <input
                    type="checkbox"
                    checked={config.enableEntropyFilter}
                    onChange={() => handleToggle('enableEntropyFilter')}
                    className="rounded text-orange-500 focus:ring-0 w-4 h-4 cursor-pointer accent-orange-500"
                  />
                </div>
                <p className="text-[10px] text-slate-400 leading-relaxed">
                  Filters trade entries when rolling tick distributions exhibit unnatural parity streaks or excessive identical digit clusters.
                </p>
                <div className="pt-1 flex items-center justify-between text-[10px] bg-slate-900 p-2 rounded-lg border border-slate-800">
                  <span className="text-slate-400">Entropy Filter:</span>
                  <span className="font-bold text-orange-400 font-mono">
                    {config.enableEntropyFilter ? 'Auto-Normalized' : 'Bypassed'}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: REAL-TIME MANIPULATION RADAR */}
          {activeTab === 'MANIPULATION_RADAR' && (
            <div className="space-y-3">
              {/* Radar Overview Banner */}
              <div className="p-3.5 rounded-xl border border-cyan-500/40 bg-gradient-to-r from-cyan-950/60 via-slate-950 to-slate-900 flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center border shrink-0 mt-0.5 bg-cyan-600 text-slate-950 border-cyan-400 shadow-sm">
                    <Gauge className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-white font-extrabold text-sm tracking-tight">
                        Broker Dealing-Desk Anomaly & Manipulation Sensor
                      </span>
                      <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border font-mono ${threatColor}`}>
                        {manipulationMetrics.threatLevel} ({manipulationMetrics.threatScore}%)
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-300 mt-0.5">
                      Continuously inspects incoming tick deltas, quote starvation intervals, and artificial digit clustering designed to defeat user strategies.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleToggle('enableManipulationMonitor')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                      config.enableManipulationMonitor
                        ? 'bg-cyan-500 hover:bg-cyan-400 text-slate-950 border-cyan-400 font-black'
                        : 'bg-slate-800 text-slate-400 border-slate-700'
                    }`}
                  >
                    {config.enableManipulationMonitor ? 'Monitor Active' : 'Enable Monitor'}
                  </button>
                </div>
              </div>

              {/* Threat Gauge & Telemetry Columns */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {/* Metric 1: Tick Interval Delay */}
                <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-white">
                    <span className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-cyan-400" /> Tick Delivery Delta
                    </span>
                    <span
                      className={`text-[10px] font-mono font-black ${
                        manipulationMetrics.tickIntervalAnomaly ? 'text-rose-400' : 'text-emerald-400'
                      }`}
                    >
                      {manipulationMetrics.tickIntervalAnomaly ? 'DELAYED' : 'NORMAL'}
                    </span>
                  </div>
                  <div className="flex items-baseline justify-between font-mono">
                    <span className="text-lg font-black text-white">{manipulationMetrics.lastTickDeltaMs} ms</span>
                    <span className="text-[10px] text-slate-400">Avg: {manipulationMetrics.averageTickDeltaMs} ms</span>
                  </div>
                  <p className="text-[10px] text-slate-400">
                    Normal Volatility synthetic ticks arrive every ~1000ms. An interval &gt; 2200ms triggers evasive quote pause.
                  </p>
                </div>

                {/* Metric 2: Digit Distribution Skewness */}
                <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-white">
                    <span className="flex items-center gap-1.5">
                      <Flame className="w-3.5 h-3.5 text-amber-400" /> Digit Skew Variance
                    </span>
                    <span className="text-[10px] font-mono font-black text-amber-400">
                      ±{manipulationMetrics.digitFrequencySkew}% DEV
                    </span>
                  </div>
                  <div className="flex items-baseline justify-between font-mono">
                    <span className="text-lg font-black text-white">
                      {manipulationMetrics.digitFrequencySkew < 8 ? 'Balanced' : 'Biased Stream'}
                    </span>
                    <span className="text-[10px] text-slate-400">Expect: 10% / digit</span>
                  </div>
                  <p className="text-[10px] text-slate-400">
                    Calculates statistical deviation against 10% baseline to detect artificial clustering against target digits.
                  </p>
                </div>

                {/* Metric 3: Evasive Defense */}
                <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-white">
                    <span className="flex items-center gap-1.5">
                      <ShieldAlert className="w-3.5 h-3.5 text-rose-400" /> Evasive Action
                    </span>
                    <span
                      className={`text-[10px] font-mono font-black ${
                        manipulationMetrics.isEvasiveActionActive ? 'text-rose-400 animate-pulse' : 'text-emerald-400'
                      }`}
                    >
                      {manipulationMetrics.isEvasiveActionActive ? 'HOLD ACTIVE' : 'CLEAR'}
                    </span>
                  </div>
                  <div className="flex items-baseline justify-between font-mono">
                    <span className="text-lg font-black text-white">
                      {manipulationMetrics.isEvasiveActionActive
                        ? `${manipulationMetrics.evasiveHoldRemainingSec}s Hold`
                        : 'Clean Flow'}
                    </span>
                    {manipulationMetrics.isEvasiveActionActive && (
                      <button
                        type="button"
                        onClick={() => strategyShield.resetCircuitBreaker()}
                        className="text-[9px] px-2 py-0.5 rounded bg-rose-900 text-rose-100 hover:bg-rose-800"
                      >
                        Override
                      </button>
                    )}
                  </div>
                  <p className="text-[10px] text-slate-400">
                    Automatically halts submission when threat score exceeds {config.manipulationThresholdScore}% to prevent unfair slippage.
                  </p>
                </div>
              </div>

              {/* Recent Manipulation Anomalies Feed */}
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white flex items-center gap-1.5">
                    <Activity className="w-3.5 h-3.5 text-cyan-400" />
                    Live Broker Feed Anomaly Log ({manipulationMetrics.recentAnomalies.length})
                  </span>
                  {manipulationMetrics.recentAnomalies.length > 0 && (
                    <button
                      type="button"
                      onClick={() => strategyShield.clearAnomalies()}
                      className="text-[10px] text-slate-400 hover:text-white underline"
                    >
                      Clear Log
                    </button>
                  )}
                </div>

                {manipulationMetrics.recentAnomalies.length === 0 ? (
                  <div className="p-3 rounded-lg bg-slate-900/60 border border-slate-800 text-center text-xs text-slate-400 font-mono">
                    ✅ No broker anomalies detected. Feed intervals and digit entropy are healthy.
                  </div>
                ) : (
                  <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                    {manipulationMetrics.recentAnomalies.map((item) => (
                      <div
                        key={item.id}
                        className={`p-2 rounded-lg border text-xs flex items-start justify-between gap-2 ${
                          item.severity === 'high'
                            ? 'bg-rose-950/50 border-rose-800 text-rose-200'
                            : 'bg-amber-950/50 border-amber-800 text-amber-200'
                        }`}
                      >
                        <div className="flex items-start gap-2">
                          <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-amber-400" />
                          <div>
                            <span className="font-bold text-[11px] block">{item.type}</span>
                            <span className="text-[10px] opacity-90">{item.message}</span>
                          </div>
                        </div>
                        <span className="text-[9px] font-mono text-slate-400 shrink-0">
                          {new Date(item.time).toLocaleTimeString()}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: POST-PROFIT CAPITAL SHIELD */}
          {activeTab === 'PROFIT_SHIELD' && (
            <div className="space-y-3">
              <div className="p-3.5 rounded-xl border border-amber-500/40 bg-gradient-to-r from-amber-950/60 via-slate-950 to-slate-900 flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center border shrink-0 mt-0.5 bg-amber-600 text-slate-950 border-amber-400 shadow-sm">
                    <DollarSign className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-white font-extrabold text-sm tracking-tight">
                        Post-Profit Protection & Auto-Withdrawal Lock
                      </span>
                      <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-amber-950 border border-amber-700 text-amber-300 font-mono">
                        CAPITAL PRESERVATION
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-300 mt-0.5">
                      Prevents the dealing-desk from taking back your profit. When you trade and win, continuing with the same strategy invites adaptive counter-measures. This shield enforces discipline and protects your bag!
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleToggle('enableProfitTargetLock')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                      config.enableProfitTargetLock
                        ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 border-amber-400 font-black'
                        : 'bg-slate-800 text-slate-400 border-slate-700'
                    }`}
                  >
                    {config.enableProfitTargetLock ? 'Profit Lock ON' : 'Enable Lock'}
                  </button>
                </div>
              </div>

              {/* Profit Status Alert if Locked */}
              {profitLockStatus.locked && (
                <div className="p-3.5 rounded-xl border border-amber-500 bg-amber-950/80 text-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-lg shadow-amber-950/40">
                  <div className="flex items-start gap-2.5">
                    <Award className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-black text-sm text-white">Session Profit Secured! (+$${profitLockStatus.profit.toFixed(2)})</h4>
                      <p className="text-xs text-amber-300 mt-0.5">
                        Trading is halted to prevent algorithm giveback. <strong>Withdraw your profits now</strong> before opening a new session!
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => strategyShield.unlockProfitSessionManually()}
                    className="px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs shrink-0"
                  >
                    Unlock Session Manually
                  </button>
                </div>
              )}

              {/* Controls Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* Setting 1: Session Target Lock */}
                <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white flex items-center gap-1.5">
                      <Target className="w-3.5 h-3.5 text-amber-400" />
                      Session Profit Target Lock ($)
                    </span>
                    <input
                      type="checkbox"
                      checked={config.enableProfitTargetLock}
                      onChange={() => handleToggle('enableProfitTargetLock')}
                      className="rounded text-amber-500 focus:ring-0 w-4 h-4 cursor-pointer accent-amber-500"
                    />
                  </div>
                  <p className="text-[10px] text-slate-400 leading-relaxed">
                    Once session net profit reaches this dollar amount, all bots automatically stop and refuse further entries until acknowledged.
                  </p>
                  <div className="pt-1">
                    <span className="text-[9px] text-slate-500 font-bold uppercase">Target Profit Amount ($)</span>
                    <input
                      type="number"
                      min="5"
                      max="1000"
                      step="5"
                      value={config.profitTargetAmount}
                      disabled={!config.enableProfitTargetLock}
                      onChange={(e) => handleNumberChange('profitTargetAmount', Number(e.target.value) || 25)}
                      className="w-full mt-0.5 bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-amber-300 font-mono outline-none focus:border-amber-500 disabled:opacity-40"
                    />
                  </div>
                </div>

                {/* Setting 2: Trailing Banked Profit Guard */}
                <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white flex items-center gap-1.5">
                      <Wallet className="w-3.5 h-3.5 text-emerald-400" />
                      Trailing Banked Profit Guard (%)
                    </span>
                    <input
                      type="checkbox"
                      checked={config.enableBankedProfitProtection}
                      onChange={() => handleToggle('enableBankedProfitProtection')}
                      className="rounded text-emerald-500 focus:ring-0 w-4 h-4 cursor-pointer accent-emerald-500"
                    />
                  </div>
                  <p className="text-[10px] text-slate-400 leading-relaxed">
                    Protects accrued peak profits. If you make $50 and draw down past the retention floor, trading halts immediately to prevent giving it all back.
                  </p>
                  <div className="pt-1">
                    <span className="text-[9px] text-slate-500 font-bold uppercase">Retain Minimum (% of Peak Gains)</span>
                    <input
                      type="number"
                      min="50"
                      max="90"
                      step="5"
                      value={config.bankedProfitRetentionPercent}
                      disabled={!config.enableBankedProfitProtection}
                      onChange={(e) => handleNumberChange('bankedProfitRetentionPercent', Number(e.target.value) || 75)}
                      className="w-full mt-0.5 bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-emerald-300 font-mono outline-none focus:border-emerald-500 disabled:opacity-40"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: STEALTH ZERO-TRACE MODE */}
          {activeTab === 'ZERO_TRACE' && (
            <div className="space-y-3">
              <div className="p-3.5 rounded-xl border border-indigo-500/40 bg-gradient-to-r from-indigo-950/60 via-slate-950 to-slate-900 flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center border shrink-0 mt-0.5 bg-indigo-600 text-white border-indigo-400 shadow-sm">
                    <EyeOff className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-white font-extrabold text-sm tracking-tight">
                        Stealth Zero-Trace Mode (Anti-Forensics & No Strategy Footprint)
                      </span>
                      <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-indigo-950 border border-indigo-700 text-indigo-300 font-mono">
                        INCOGNITO
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-300 mt-0.5">
                      Prevents brokers, tracking extensions, and device monitors from profiling your entry points and winning patterns. No trade history is saved to disk or persistent memory.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleToggle('enableZeroTraceMode')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                      config.enableZeroTraceMode
                        ? 'bg-indigo-500 hover:bg-indigo-400 text-white border-indigo-300 font-black'
                        : 'bg-slate-800 text-slate-400 border-slate-700'
                    }`}
                  >
                    {config.enableZeroTraceMode ? 'Zero-Trace ON' : 'Enable Zero-Trace'}
                  </button>
                </div>
              </div>

              {/* Zero-Trace Features List */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white flex items-center gap-1.5">
                      <Trash2 className="w-3.5 h-3.5 text-indigo-400" />
                      Auto-Purge History on Settlement
                    </span>
                    <input
                      type="checkbox"
                      checked={config.autoPurgeHistoryOnSettlement}
                      onChange={() => handleToggle('autoPurgeHistoryOnSettlement')}
                      className="rounded text-indigo-500 focus:ring-0 w-4 h-4 cursor-pointer accent-indigo-500"
                    />
                  </div>
                  <p className="text-[10px] text-slate-400 leading-relaxed">
                    Instantly wipes trade logs from application memory the moment a contract settles. No persistent record of your entry digits, symbols, or stake sizes is kept.
                  </p>
                </div>

                <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white flex items-center gap-1.5">
                      <EyeOff className="w-3.5 h-3.5 text-indigo-400" />
                      Redact Strategy Parameters in UI
                    </span>
                    <input
                      type="checkbox"
                      checked={config.maskStrategyParametersInLogs}
                      onChange={() => handleToggle('maskStrategyParametersInLogs')}
                      className="rounded text-indigo-500 focus:ring-0 w-4 h-4 cursor-pointer accent-indigo-500"
                    />
                  </div>
                  <p className="text-[10px] text-slate-400 leading-relaxed">
                    Masks entry target digits (e.g. &#8800; *) and stake multipliers from screen-recording tools or external session replay scripts.
                  </p>
                </div>
              </div>

              {/* Instant Nuke Button */}
              <div className="bg-slate-950 border border-rose-900/60 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h4 className="text-xs font-black text-rose-300 flex items-center gap-1.5">
                    <Trash2 className="w-4 h-4 text-rose-400" />
                    Instant Footprint Purge (Zero History)
                  </h4>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Click to immediately wipe all in-memory trades, contract logs, anomaly histories, and strategy footprints across the entire application.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handlePurgeAll}
                  className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 shrink-0 ${
                    purgeSuccess
                      ? 'bg-emerald-500 text-slate-950 border border-emerald-400'
                      : 'bg-rose-600 hover:bg-rose-500 text-white border border-rose-500 shadow-md shadow-rose-950/40'
                  }`}
                >
                  {purgeSuccess ? (
                    <>
                      <Check className="w-4 h-4" /> Strategy Footprint Purged!
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4" /> Purge Strategy Footprint Now
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Quick Safety Summary */}
          <div className="bg-slate-950/90 border border-slate-800 rounded-xl p-3 flex items-center justify-between text-xs mt-3">
            <div className="flex items-center gap-2 text-slate-300">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>
                <strong>Shield Active:</strong> {activeProtectionsCount} safety protocols armed. Anti-manipulation sensor score: <strong className="text-cyan-400 font-mono">{manipulationMetrics.threatScore}%</strong>. Zero-trace mode is <strong className="text-indigo-400 font-mono">{config.enableZeroTraceMode ? 'ENABLED' : 'OFF'}</strong>.
              </span>
            </div>
            <button
              type="button"
              onClick={() => {
                strategyShield.resetCircuitBreaker();
              }}
              className="text-[10px] font-bold text-slate-400 hover:text-white underline shrink-0 ml-2"
            >
              Reset Circuit Breaker
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
