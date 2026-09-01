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
} from 'lucide-react';
import { strategyShield, StrategyShieldConfig } from '../../services/strategyShield';
import { derivWS } from '../../services/derivWebSocket';

interface StrategyShieldPanelProps {
  currentPingMs?: number;
  consecutiveLosses?: number;
  circuitBreakerSec?: number;
  onResetCircuitBreaker?: () => void;
  className?: string;
  isCompact?: boolean;
}

export const StrategyShieldPanel: React.FC<StrategyShieldPanelProps> = ({
  currentPingMs = 28,
  consecutiveLosses = 0,
  circuitBreakerSec = 0,
  onResetCircuitBreaker,
  className = '',
  isCompact = false,
}) => {
  const [config, setConfig] = useState<StrategyShieldConfig>(() => strategyShield.getConfig());
  const [isExpanded, setIsExpanded] = useState<boolean>(!isCompact);
  const [showTooltip, setShowTooltip] = useState<string | null>(null);

  useEffect(() => {
    const unsub = strategyShield.subscribe((newCfg) => setConfig(newCfg));
    return unsub;
  }, []);

  const handleToggle = (key: keyof StrategyShieldConfig) => {
    strategyShield.updateConfig({ [key]: !config[key] });
  };

  const handleNumberChange = (key: keyof StrategyShieldConfig, value: number) => {
    strategyShield.updateConfig({ [key]: value });
  };

  const activeProtectionsCount = [
    config.enableJitter,
    config.enableLatencyGuard,
    config.enableStakeFuzzing,
    config.enableMarketHopping,
    config.enableEntropyFilter,
    config.enableLossStreakGuard,
    config.enableDailyLossStop,
  ].filter(Boolean).length;

  const pingStatus =
    currentPingMs < 80
      ? { label: 'Optimal', color: 'text-emerald-400', bg: 'bg-emerald-950/60 border-emerald-800' }
      : currentPingMs < 200
      ? { label: 'Good', color: 'text-cyan-400', bg: 'bg-cyan-950/60 border-cyan-800' }
      : currentPingMs < config.maxAllowedPingMs
      ? { label: 'Moderate', color: 'text-amber-400', bg: 'bg-amber-950/60 border-amber-800' }
      : { label: 'High Latency Spike', color: 'text-rose-400', bg: 'bg-rose-950/60 border-rose-800' };

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
              Zero-Footprint Execution • Latency Spike Filter • Anti-Martingale Masking • Trap Suppression
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

      {/* Live Status Telemetry Ribbon */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-3">
        {/* Ping / Latency Guard */}
        <div className={`p-2.5 rounded-xl border ${pingStatus.bg} flex flex-col justify-between`}>
          <div className="flex items-center justify-between text-[10px]">
            <span className="text-slate-400 font-bold uppercase flex items-center gap-1">
              <Radio className="w-3 h-3 text-cyan-400" /> Ping / Latency
            </span>
            <span className={`font-black ${pingStatus.color}`}>{pingStatus.label}</span>
          </div>
          <div className="font-mono font-black text-sm text-white mt-1 flex items-baseline gap-1">
            <span>{currentPingMs} ms</span>
            <span className="text-[9px] text-slate-400 font-medium">(Max: {config.maxAllowedPingMs}ms)</span>
          </div>
        </div>

        {/* Execution Footprint Jitter */}
        <div className="p-2.5 rounded-xl border border-slate-800 bg-slate-950/80 flex flex-col justify-between">
          <div className="flex items-center justify-between text-[10px]">
            <span className="text-slate-400 font-bold uppercase flex items-center gap-1">
              <Clock className="w-3 h-3 text-purple-400" /> Anti-Fingerprint
            </span>
            <span className={`font-black ${config.enableJitter ? 'text-purple-400' : 'text-slate-500'}`}>
              {config.enableJitter ? 'Humanized' : 'Raw WS'}
            </span>
          </div>
          <div className="font-mono font-black text-sm text-purple-300 mt-1 flex items-baseline gap-1">
            <span>
              {config.enableJitter ? `${config.minJitterMs}–${config.maxJitterMs}ms` : 'Disabled'}
            </span>
            <span className="text-[9px] text-slate-500 font-medium">Jitter</span>
          </div>
        </div>

        {/* Stake Fuzzing / Anti-Martingale Mask */}
        <div className="p-2.5 rounded-xl border border-slate-800 bg-slate-950/80 flex flex-col justify-between">
          <div className="flex items-center justify-between text-[10px]">
            <span className="text-slate-400 font-bold uppercase flex items-center gap-1">
              <Shuffle className="w-3 h-3 text-amber-400" /> Stake Fuzzing
            </span>
            <span className={`font-black ${config.enableStakeFuzzing ? 'text-amber-400' : 'text-slate-500'}`}>
              {config.enableStakeFuzzing ? 'Masked' : 'Fixed'}
            </span>
          </div>
          <div className="font-mono font-black text-sm text-amber-300 mt-1 flex items-baseline gap-1">
            <span>
              {config.enableStakeFuzzing ? `±$0.01–$${config.fuzzingMaxCents.toFixed(2)}` : 'Off'}
            </span>
            <span className="text-[9px] text-slate-500 font-medium">Variance</span>
          </div>
        </div>

        {/* Streak Circuit Breaker Status */}
        <div
          className={`p-2.5 rounded-xl border flex flex-col justify-between ${
            circuitBreakerSec > 0
              ? 'bg-rose-950/70 border-rose-700 text-rose-300 animate-pulse'
              : consecutiveLosses > 0
              ? 'bg-amber-950/50 border-amber-800/80'
              : 'bg-slate-950/80 border-slate-800'
          }`}
        >
          <div className="flex items-center justify-between text-[10px]">
            <span className="text-slate-400 font-bold uppercase flex items-center gap-1">
              <AlertTriangle className="w-3 h-3 text-rose-400" /> Circuit Breaker
            </span>
            {circuitBreakerSec > 0 ? (
              <span className="font-black text-rose-400">PAUSED</span>
            ) : (
              <span className="font-mono text-slate-400">{consecutiveLosses}/{config.maxConsecutiveLosses} Losses</span>
            )}
          </div>
          <div className="font-mono font-black text-sm text-white mt-1 flex items-center justify-between">
            {circuitBreakerSec > 0 ? (
              <span className="text-rose-400">Cooling: {circuitBreakerSec}s</span>
            ) : (
              <span className="text-emerald-400">Shield Armed</span>
            )}
            {circuitBreakerSec > 0 && onResetCircuitBreaker && (
              <button
                type="button"
                onClick={onResetCircuitBreaker}
                className="text-[9px] px-1.5 py-0.5 rounded bg-rose-900 text-rose-100 hover:bg-rose-800 border border-rose-600"
              >
                Resume
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Expanded Interactive Shield Parameter Matrix */}
      {isExpanded && (
        <div className="mt-4 pt-4 border-t border-slate-800/80 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {/* Guard 1: Anti-Fingerprint Execution Jitter */}
            <div className="bg-slate-950 border border-slate-800/90 rounded-xl p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-purple-400" />
                  Anti-Fingerprint Jitter
                </span>
                <input
                  type="checkbox"
                  checked={config.enableJitter}
                  onChange={() => handleToggle('enableJitter')}
                  className="rounded text-purple-500 focus:ring-0 w-4 h-4 cursor-pointer accent-purple-500"
                />
              </div>
              <p className="text-[10px] text-slate-400 leading-relaxed">
                Injects humanized micro-delay variance (e.g. 40ms–260ms) before trade placement so broker risk engines cannot fingerprint robotic entry intervals.
              </p>
              <div className="grid grid-cols-2 gap-2 pt-1">
                <div>
                  <span className="text-[9px] text-slate-500 font-bold uppercase">Min Delay (ms)</span>
                  <input
                    type="number"
                    min="0"
                    max="500"
                    value={config.minJitterMs}
                    disabled={!config.enableJitter}
                    onChange={(e) => handleNumberChange('minJitterMs', Number(e.target.value) || 0)}
                    className="w-full mt-0.5 bg-slate-900 border border-slate-800 rounded-lg px-2 py-1 text-xs text-white font-mono outline-none focus:border-purple-500 disabled:opacity-40"
                  />
                </div>
                <div>
                  <span className="text-[9px] text-slate-500 font-bold uppercase">Max Delay (ms)</span>
                  <input
                    type="number"
                    min="10"
                    max="1000"
                    value={config.maxJitterMs}
                    disabled={!config.enableJitter}
                    onChange={(e) => handleNumberChange('maxJitterMs', Number(e.target.value) || 200)}
                    className="w-full mt-0.5 bg-slate-900 border border-slate-800 rounded-lg px-2 py-1 text-xs text-white font-mono outline-none focus:border-purple-500 disabled:opacity-40"
                  />
                </div>
              </div>
            </div>

            {/* Guard 2: Latency Spike & Slippage Guard */}
            <div className="bg-slate-950 border border-slate-800/90 rounded-xl p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white flex items-center gap-1.5">
                  <Radio className="w-3.5 h-3.5 text-cyan-400" />
                  Latency & Slippage Filter
                </span>
                <input
                  type="checkbox"
                  checked={config.enableLatencyGuard}
                  onChange={() => handleToggle('enableLatencyGuard')}
                  className="rounded text-cyan-500 focus:ring-0 w-4 h-4 cursor-pointer accent-cyan-500"
                />
              </div>
              <p className="text-[10px] text-slate-400 leading-relaxed">
                Rejects trade submissions if network latency or tick age exceeds safe limits, preventing outdated-quote slippage and delayed execution losses.
              </p>
              <div className="grid grid-cols-2 gap-2 pt-1">
                <div>
                  <span className="text-[9px] text-slate-500 font-bold uppercase">Max Ping (ms)</span>
                  <input
                    type="number"
                    min="100"
                    max="1000"
                    step="50"
                    value={config.maxAllowedPingMs}
                    disabled={!config.enableLatencyGuard}
                    onChange={(e) => handleNumberChange('maxAllowedPingMs', Number(e.target.value) || 350)}
                    className="w-full mt-0.5 bg-slate-900 border border-slate-800 rounded-lg px-2 py-1 text-xs text-cyan-300 font-mono outline-none focus:border-cyan-500 disabled:opacity-40"
                  />
                </div>
                <div>
                  <span className="text-[9px] text-slate-500 font-bold uppercase">Max Tick Age (ms)</span>
                  <input
                    type="number"
                    min="500"
                    max="5000"
                    step="500"
                    value={config.maxTickAgeMs}
                    disabled={!config.enableLatencyGuard}
                    onChange={(e) => handleNumberChange('maxTickAgeMs', Number(e.target.value) || 2500)}
                    className="w-full mt-0.5 bg-slate-900 border border-slate-800 rounded-lg px-2 py-1 text-xs text-white font-mono outline-none focus:border-cyan-500 disabled:opacity-40"
                  />
                </div>
              </div>
            </div>

            {/* Guard 3: Stake Fuzzing & Anti-Martingale Mask */}
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
                Applies random micro-cent variances ($10.00 → $10.03, $115.00 → $115.05) to mask mechanical Martingale ladders from broker algorithmic risk profiling.
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

            {/* Guard 4: Loss Streak Circuit Breaker */}
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
                Enforces an automated cooling period after consecutive losses to prevent emotional overtrading and broker trap cycles.
              </p>
              <div className="grid grid-cols-2 gap-2 pt-1">
                <div>
                  <span className="text-[9px] text-slate-500 font-bold uppercase">Max Loss Streak</span>
                  <input
                    type="number"
                    min="1"
                    max="5"
                    value={config.maxConsecutiveLosses}
                    disabled={!config.enableLossStreakGuard}
                    onChange={(e) => handleNumberChange('maxConsecutiveLosses', Number(e.target.value) || 2)}
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
                    onChange={(e) => handleNumberChange('cooldownDurationSec', Number(e.target.value) || 45)}
                    className="w-full mt-0.5 bg-slate-900 border border-slate-800 rounded-lg px-2 py-1 text-xs text-white font-mono outline-none focus:border-rose-500 disabled:opacity-40"
                  />
                </div>
              </div>
            </div>

            {/* Guard 5: Digit Stream Entropy & Trap Detector */}
            <div className="bg-slate-950 border border-slate-800/90 rounded-xl p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white flex items-center gap-1.5">
                  <Flame className="w-3.5 h-3.5 text-orange-400" />
                  Entropy & Trap Detector
                </span>
                <input
                  type="checkbox"
                  checked={config.enableEntropyFilter}
                  onChange={() => handleToggle('enableEntropyFilter')}
                  className="rounded text-orange-500 focus:ring-0 w-4 h-4 cursor-pointer accent-orange-500"
                />
              </div>
              <p className="text-[10px] text-slate-400 leading-relaxed">
                Continuously analyzes digit distribution variance and suppresses trade entries when an index is in high-clustering parity runs or anomaly traps.
              </p>
              <div className="pt-1 flex items-center justify-between text-[10px] bg-slate-900 p-2 rounded-lg border border-slate-800">
                <span className="text-slate-400">Trap Suppression:</span>
                <span className="font-bold text-orange-400 font-mono">Auto-Normalized</span>
              </div>
            </div>

            {/* Guard 6: Anti-Targeting Market Hopping */}
            <div className="bg-slate-950 border border-slate-800/90 rounded-xl p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white flex items-center gap-1.5">
                  <Shuffle className="w-3.5 h-3.5 text-emerald-400" />
                  Anti-Targeting Market Hop
                </span>
                <input
                  type="checkbox"
                  checked={config.enableMarketHopping}
                  onChange={() => handleToggle('enableMarketHopping')}
                  className="rounded text-emerald-500 focus:ring-0 w-4 h-4 cursor-pointer accent-emerald-500"
                />
              </div>
              <p className="text-[10px] text-slate-400 leading-relaxed">
                Unpredictably shifts scan priorities across volatility indices so the bot never follows a predictable static linear loop.
              </p>
              <div className="pt-1 flex items-center justify-between text-[10px] bg-slate-900 p-2 rounded-lg border border-slate-800">
                <span className="text-slate-400">Market Rotation:</span>
                <span className="font-bold text-emerald-400 font-mono">Dynamic Weighted Hop</span>
              </div>
            </div>
          </div>

          {/* Quick Safety Summary */}
          <div className="bg-slate-950/90 border border-slate-800 rounded-xl p-3 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 text-slate-300">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>
                <strong>Shield Active:</strong> {activeProtectionsCount} safety protocols armed. All automated orders are humanized, verified against latency spikes, and protected against loss spirals.
              </span>
            </div>
            <button
              type="button"
              onClick={() => strategyShield.resetCircuitBreaker()}
              className="text-[10px] font-bold text-slate-400 hover:text-white underline shrink-0 ml-2"
            >
              Reset All Metrics
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
