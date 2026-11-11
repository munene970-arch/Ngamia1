import React, { useState, useEffect } from 'react';
import {
  lowestFrequencyBotEngine,
  LowestFrequencyStatus,
  LowestFrequencyConfig,
  LowestFrequencyTradeRecord,
  LowestFrequencyMarketState,
  LOWEST_FREQUENCY_MARKETS,
} from '../../services/lowestFrequencyBotEngine';
import { formatDerivQuote, getMarketPipSize } from '../../services/derivWebSocket';
import { MarketSymbol } from '../../types/deriv';
import {
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
  Repeat,
  ChevronRight,
  BarChart2,
  FlaskConical,
  ToggleLeft,
  ToggleRight,
  Eye,
  Shield,
} from 'lucide-react';

interface LowestFrequencyBotViewProps {
  balanceUsd: number;
  onUpdateBalance?: (newBalance: number) => void;
}

export const LowestFrequencyBotView: React.FC<LowestFrequencyBotViewProps> = ({
  balanceUsd,
  onUpdateBalance,
}) => {
  const [status, setStatus] = useState<LowestFrequencyStatus>(() =>
    lowestFrequencyBotEngine.getStatus()
  );
  const [config, setConfig] = useState<LowestFrequencyConfig>(() =>
    lowestFrequencyBotEngine.getConfig()
  );
  const [trades, setTrades] = useState<LowestFrequencyTradeRecord[]>(() =>
    lowestFrequencyBotEngine.getTrades()
  );
  const [marketStates, setMarketStates] = useState<Map<MarketSymbol, LowestFrequencyMarketState>>(
    () => lowestFrequencyBotEngine.getAllMarketStates()
  );
  const [previewSymbol, setPreviewSymbol] = useState<MarketSymbol>('R_10');
  const [showConfigModal, setShowConfigModal] = useState<boolean>(false);

  // Sync balance
  useEffect(() => {
    lowestFrequencyBotEngine.setBalance(balanceUsd);
  }, [balanceUsd]);

  useEffect(() => {
    lowestFrequencyBotEngine.setBalanceUpdater((profit, newBal) => {
      if (onUpdateBalance) onUpdateBalance(newBal);
    });
  }, [onUpdateBalance]);

  // Subscribe to engine
  useEffect(() => {
    const unsubStatus = lowestFrequencyBotEngine.subscribeStatus((newStatus) => {
      setStatus(newStatus);
      if (newStatus.isRunning) {
        setPreviewSymbol(newStatus.activeMarketSymbol);
      }
    });
    const unsubTrades = lowestFrequencyBotEngine.subscribeTrades(setTrades);
    const unsubStates = lowestFrequencyBotEngine.subscribeMarketStates(setMarketStates);

    return () => {
      unsubStatus();
      unsubTrades();
      unsubStates();
    };
  }, []);

  const handleConfigChange = (newValues: Partial<LowestFrequencyConfig>) => {
    const updated = { ...config, ...newValues, sampleSize: 500 };
    setConfig(updated);
    lowestFrequencyBotEngine.saveConfig(newValues);
  };

  const activeMarketState = marketStates.get(previewSymbol) || marketStates.get(status.activeMarketSymbol);
  const lowestDigit = activeMarketState?.lowestDigit ?? 0;
  const lowestPct = activeMarketState?.lowestPct ?? 10.0;
  const lowestHits = activeMarketState?.lowestCount ?? 0;
  const sampleCount = activeMarketState?.sampleCount ?? 500;
  const digitStats = activeMarketState?.digitStats ?? [];

  return (
    <div className="space-y-6">
      {/* 🚀 MASTER HERO BANNER: LOWEST FREQUENCY BOT */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-emerald-950/40 to-slate-950 border border-emerald-500/40 p-5 sm:p-6 shadow-2xl shadow-emerald-950/30">
        <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none -ml-20 -mb-20" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="p-3.5 rounded-2xl bg-gradient-to-tr from-emerald-500 via-teal-400 to-cyan-500 text-slate-950 shadow-xl shadow-emerald-500/30 font-black">
                <TrendingDown className="w-8 h-8 text-slate-950" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white flex items-center gap-2">
                    Lowest Frequency Bot
                  </h1>
                  <span className="text-xs px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                    500 TICKS SAMPLE • 1 TRADE PER VOLATILITY
                  </span>
                  <span className="text-xs px-2.5 py-0.5 rounded-full font-mono font-bold bg-slate-950 text-slate-300 border border-slate-800">
                    VOL 10 ➔ 100 SEQUENTIAL
                  </span>
                </div>
                <p className="text-xs text-slate-300 mt-1 max-w-2xl leading-relaxed">
                  Scans continuous markets starting from <strong className="text-emerald-300">Volatility 10 Index up to 100 Index</strong> (strictly no 1s markets). On each market, the bot analyzes a sample of <strong className="text-cyan-300 font-mono">500 ticks</strong>, identifies the digit with the lowest frequency, and buys that <strong className="text-emerald-400 font-bold">Digit Differ (≠ Lowest)</strong>. Exactly one trade per volatility; after settlement it moves to Vol 25, then Vol 50, Vol 75, and Vol 100!
                </p>
              </div>
            </div>
          </div>

          {/* Action Controls & Bot Status */}
          <div className="flex flex-wrap items-center gap-3 shrink-0">
            {status.isRunning ? (
              <button
                type="button"
                onClick={() => lowestFrequencyBotEngine.stopBot()}
                className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-black bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white shadow-xl shadow-rose-500/30 transition-all cursor-pointer active:scale-95"
              >
                <Square className="w-4 h-4 fill-white" />
                <span>Stop Bot</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => lowestFrequencyBotEngine.startBot()}
                className="flex items-center gap-2 px-7 py-3 rounded-xl text-sm font-black bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-slate-950 shadow-xl shadow-emerald-500/30 transition-all cursor-pointer active:scale-95"
              >
                <Play className="w-4 h-4 fill-slate-950" />
                <span>START LOWEST FREQUENCY BOT</span>
              </button>
            )}

            {/* Test Differ Sniper Trigger */}
            <button
              type="button"
              disabled={status.isTradeActive}
              onClick={() => {
                const targetIdx = LOWEST_FREQUENCY_MARKETS.findIndex((m) => m.symbol === previewSymbol);
                lowestFrequencyBotEngine.triggerManualDifferTest(targetIdx >= 0 ? targetIdx : 0);
              }}
              className="flex items-center gap-1.5 px-4 py-3 rounded-xl text-xs font-mono font-bold bg-slate-900 hover:bg-slate-800 text-emerald-300 border border-emerald-500/30 transition-all disabled:opacity-40"
              title="Test Differ contract on the lowest frequency digit of the currently selected market"
            >
              <Zap className="w-3.5 h-3.5 text-emerald-400" />
              <span>Test Differ ≠ [{lowestDigit}]</span>
            </button>

            {/* Config & Settings */}
            <button
              type="button"
              onClick={() => setShowConfigModal(!showConfigModal)}
              className="p-3 rounded-xl bg-slate-900/80 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 transition-all cursor-pointer"
              title="Configure Risk & Trade Settings"
            >
              <Sliders className="w-4 h-4" />
            </button>

            {/* Reset Stats */}
            <button
              type="button"
              onClick={() => lowestFrequencyBotEngine.resetStats()}
              className="p-3 rounded-xl bg-slate-900/80 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 transition-all cursor-pointer"
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
                status.isWaitingDelay
                  ? 'bg-amber-400 animate-ping'
                  : status.isTradeActive
                  ? 'bg-cyan-400 animate-pulse'
                  : status.isRunning
                  ? 'bg-emerald-400 animate-pulse'
                  : 'bg-slate-500'
              }`}
            />
            <span className="text-slate-200 font-bold">
              {status.isWaitingDelay
                ? `PAUSED 5s • MOVING TO ${status.nextMarketSymbol || 'NEXT'} IN ${status.delaySecondsRemaining}s`
                : status.isTradeActive
                ? 'CONTRACT ACTIVE • 1-TICK DIFFER IN FLIGHT'
                : status.isRunning
                ? `CYCLE ${status.currentCycle} • STEP ${status.currentStepIndex + 1}/5 (${status.activeMarketSymbol})`
                : 'ENGINE IDLE • READY'}
            </span>
            <span className="text-slate-600">•</span>
            <span className="text-slate-400 truncate max-w-xl">{status.statusMessage}</span>
          </div>

          <div className="flex items-center gap-3 text-slate-400">
            <span>
              Active: <strong className="text-emerald-400">{status.activeMarketSymbol}</strong>
            </span>
            <span>•</span>
            <span>
              Sample:{' '}
              <strong className="text-cyan-300 font-bold">500 ticks</strong>
            </span>
            <span>•</span>
            <span>
              Cycle:{' '}
              <strong className="text-white">#{status.currentCycle}</strong>
            </span>
          </div>
        </div>
      </div>

      {/* 🧪 VIRTUAL TRADE OPTION (RISK-ABSORBING DEMO MODE) */}
      <div className={`rounded-3xl border transition-all p-5 shadow-xl relative overflow-hidden ${
        config.virtualTradeOptionEnabled
          ? 'bg-gradient-to-r from-teal-950/60 via-slate-900 to-emerald-950/40 border-teal-500/40 shadow-teal-950/30'
          : 'bg-slate-900 border-slate-800'
      }`}>
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className={`p-3 rounded-2xl shrink-0 transition-all ${
              config.virtualTradeOptionEnabled
                ? 'bg-gradient-to-tr from-teal-500 to-emerald-400 text-slate-950 shadow-lg shadow-teal-500/30 font-black'
                : 'bg-slate-800 text-slate-400'
            }`}>
              <FlaskConical className="w-6 h-6" />
            </div>

            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-base font-black text-white flex items-center gap-2">
                  <span>Virtual Trade Option</span>
                </h3>
                {config.virtualTradeOptionEnabled ? (
                  <span className="text-[10px] px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider bg-teal-500/20 text-teal-300 border border-teal-500/40 flex items-center gap-1.5 font-mono">
                    <span className="w-2 h-2 rounded-full bg-teal-400 animate-ping" />
                    ENABLED • DEMO UNTIL 1 LOSS ➔ REAL ACCOUNT
                  </span>
                ) : (
                  <span className="text-[10px] px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider bg-slate-800 text-slate-400 border border-slate-700 font-mono">
                    DISABLED • DIRECT REAL TRADING
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-300 max-w-3xl leading-relaxed">
                After obtaining the lowest frequency digit on 500 ticks, the bot trades on{' '}
                <strong className="text-teal-300 font-bold">Virtual Mode until it hits 1 loss</strong> (absorbing the differ failure on demo balance). The{' '}
                <strong className="text-emerald-400 font-bold">next trade is taken on REAL account</strong>, and once closed it waits 5 seconds and moves to the next volatility market!
              </p>
            </div>
          </div>

          {/* Toggle & Quick Stake Controls */}
          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => {
                const nextVal = !config.virtualTradeOptionEnabled;
                handleConfigChange({ virtualTradeOptionEnabled: nextVal });
                lowestFrequencyBotEngine.setVirtualTradeOption(nextVal);
              }}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer shadow-md ${
                config.virtualTradeOptionEnabled
                  ? 'bg-teal-500 hover:bg-teal-400 text-slate-950 shadow-teal-500/25 ring-2 ring-teal-300'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700'
              }`}
            >
              {config.virtualTradeOptionEnabled ? (
                <>
                  <ToggleRight className="w-5 h-5" />
                  <span>Virtual Option: ACTIVE</span>
                </>
              ) : (
                <>
                  <ToggleLeft className="w-5 h-5 text-slate-400" />
                  <span>Virtual Option: OFF</span>
                </>
              )}
            </button>

            {/* Quick Demo Stake Pill */}
            {config.virtualTradeOptionEnabled && (
              <div className="flex items-center gap-1.5 bg-slate-950 px-3 py-1.5 rounded-xl border border-teal-500/30 text-xs font-mono">
                <span className="text-slate-400 text-[11px]">Demo Stake:</span>
                <span className="text-teal-300 font-bold">${config.virtualDemoStake.toFixed(2)}</span>
                <div className="flex items-center gap-1 ml-1">
                  {[0.5, 1.0, 2.0, 5.0].map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => {
                        handleConfigChange({ virtualDemoStake: amt });
                        lowestFrequencyBotEngine.setVirtualDemoStake(amt);
                      }}
                      className={`text-[10px] px-1.5 py-0.5 rounded font-bold transition-all ${
                        config.virtualDemoStake === amt
                          ? 'bg-teal-400 text-slate-950'
                          : 'bg-slate-900 text-slate-400 hover:text-white'
                      }`}
                    >
                      ${amt}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Live Virtual Mode Stage Status */}
        {config.virtualTradeOptionEnabled && (
          <div className="mt-4 pt-3 border-t border-teal-900/40 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs font-mono">
            {/* Step 1: Virtual Hunting */}
            <div className={`p-3 rounded-xl border flex items-center justify-between ${
              status.virtualModeState === 'VIRTUAL_HUNTING' && status.isRunning
                ? 'bg-teal-950/60 border-teal-400 ring-1 ring-teal-400/50 shadow-md shadow-teal-500/20'
                : 'bg-slate-950/60 border-slate-800 text-slate-400'
            }`}>
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${
                  status.virtualModeState === 'VIRTUAL_HUNTING' && status.isRunning ? 'bg-teal-400 animate-ping' : 'bg-slate-600'
                }`} />
                <div>
                  <div className="font-bold text-white text-[11px]">1. Virtual Hunting</div>
                  <div className="text-[10px] text-slate-400">Trades on Demo until 1 loss</div>
                </div>
              </div>
              <div className="text-right">
                <span className="text-teal-300 font-black text-sm">{status.virtualWins} W</span>
                <span className="text-slate-500 mx-1">/</span>
                <span className={`font-black text-sm ${status.virtualLosses > 0 ? 'text-amber-400' : 'text-slate-400'}`}>
                  {status.virtualLosses}/1 L
                </span>
              </div>
            </div>

            {/* Step 2: Real Account Switch */}
            <div className={`p-3 rounded-xl border flex items-center justify-between ${
              status.virtualModeState === 'REAL_ARMED' && status.isRunning
                ? 'bg-amber-950/60 border-amber-400 ring-2 ring-amber-400/50 shadow-lg shadow-amber-500/25 animate-pulse'
                : status.virtualModeState === 'REAL_ACTIVE' && status.isRunning
                ? 'bg-emerald-950/60 border-emerald-400 ring-1 ring-emerald-400/50 shadow-md shadow-emerald-500/20'
                : 'bg-slate-950/60 border-slate-800 text-slate-400'
            }`}>
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${
                  status.virtualModeState === 'REAL_ARMED' && status.isRunning
                    ? 'bg-amber-400 animate-ping'
                    : status.virtualModeState === 'REAL_ACTIVE' && status.isRunning
                    ? 'bg-emerald-400 animate-pulse'
                    : 'bg-slate-600'
                }`} />
                <div>
                  <div className="font-bold text-white text-[11px]">2. Real Account Trade</div>
                  <div className="text-[10px] text-slate-400">
                    {status.virtualModeState === 'REAL_ARMED'
                      ? '🎯 ARMED: Next trade is REAL!'
                      : status.virtualModeState === 'REAL_ACTIVE'
                      ? '💎 REAL TRADE IN FLIGHT'
                      : 'Armed after 1 virtual loss'}
                  </div>
                </div>
              </div>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                status.virtualModeState === 'REAL_ARMED'
                  ? 'bg-amber-400 text-slate-950'
                  : status.virtualModeState === 'REAL_ACTIVE'
                  ? 'bg-emerald-400 text-slate-950'
                  : 'bg-slate-900 text-slate-500'
              }`}>
                {status.virtualModeState === 'REAL_ARMED'
                  ? 'READY'
                  : status.virtualModeState === 'REAL_ACTIVE'
                  ? 'TRADING'
                  : 'WAITING'}
              </span>
            </div>

            {/* Step 3: 5s Pause & Next Volatility */}
            <div className={`p-3 rounded-xl border flex items-center justify-between ${
              status.isWaitingDelay
                ? 'bg-amber-950/60 border-amber-400 ring-1 ring-amber-400/50 shadow-md shadow-amber-500/20'
                : 'bg-slate-950/60 border-slate-800 text-slate-400'
            }`}>
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${
                  status.isWaitingDelay ? 'bg-amber-400 animate-ping' : 'bg-slate-600'
                }`} />
                <div>
                  <div className="font-bold text-white text-[11px]">3. 5s Pause ➔ Next Vol</div>
                  <div className="text-[10px] text-slate-400">
                    {status.isWaitingDelay ? `Moving to ${status.nextMarketSymbol || 'Next'} in ${status.delaySecondsRemaining}s` : 'Next volatility in ladder'}
                  </div>
                </div>
              </div>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-bold ${
                status.isWaitingDelay ? 'bg-amber-400 text-slate-950' : 'bg-slate-900 text-slate-500'
              }`}>
                {status.isWaitingDelay ? `${status.delaySecondsRemaining}s` : '5 SECS'}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* ⏳ 5-SECOND PAUSE & TRANSITION BANNER */}
      {status.isWaitingDelay && (
        <div className="bg-gradient-to-r from-amber-950/70 via-slate-900 to-amber-950/70 border-2 border-amber-500/50 rounded-2xl p-4 shadow-xl shadow-amber-950/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-pulse ring-1 ring-amber-500/40">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-amber-500 to-yellow-400 text-slate-950 flex flex-col items-center justify-center font-mono font-black text-lg shadow-lg shadow-amber-500/30 shrink-0">
              <span className="leading-none">{status.delaySecondsRemaining}s</span>
              <span className="text-[8px] uppercase tracking-wider font-bold">WAIT</span>
            </div>
            <div>
              <div className="text-sm font-black text-amber-300 flex items-center gap-2 flex-wrap">
                <span>Trade Closed • Waiting 5 Seconds Before Moving</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-400 font-mono font-bold">
                  {status.delaySecondsRemaining}s REMAINING
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                Waiting 5 seconds, then immediately moving to{' '}
                <strong className="text-white">
                  {LOWEST_FREQUENCY_MARKETS.find((m) => m.symbol === status.nextMarketSymbol)?.name || status.nextMarketSymbol}
                </strong>{' '}
                and buying its lowest frequency digit on 500 ticks!
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 font-mono text-xs shrink-0 bg-slate-950 px-3.5 py-2 rounded-xl border border-amber-500/30">
            <span className="text-slate-400">Next Volatility:</span>
            <span className="text-emerald-400 font-black text-sm">
              {LOWEST_FREQUENCY_MARKETS.find((m) => m.symbol === status.nextMarketSymbol)?.shortName || status.nextMarketSymbol}
            </span>
          </div>
        </div>
      )}

      {/* 🪜 5-STEP VOLATILITY SEQUENTIAL LADDER PIPELINE */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Layers className="w-5 h-5 text-emerald-400" />
              <span>5-Step Sequential Volatility Ladder (Vol 10 ➔ 100)</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-mono font-bold border border-emerald-500/30">
                1 Trade Per Volatility • 5s Pause Between
              </span>
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Bot begins at Volatility 10 Index. After trade settlement, it waits 5 seconds, steps to the next volatility, and immediately buys the lowest frequency digit!
            </p>
          </div>

          <div className="flex items-center gap-2 font-mono text-xs">
            <span className="text-slate-400">Progress:</span>
            <span className="px-2.5 py-1 rounded-lg bg-slate-950 border border-emerald-500/30 text-emerald-300 font-bold">
              Step {status.isRunning ? status.currentStepIndex + 1 : 1} of 5
            </span>
          </div>
        </div>

        {/* 5 Sequential Market Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {LOWEST_FREQUENCY_MARKETS.map((m, idx) => {
            const mState = marketStates.get(m.symbol);
            const isCurrentActive = status.isRunning && status.currentStepIndex === idx && !status.isWaitingDelay;
            const isNextTarget = status.isWaitingDelay && status.nextMarketSymbol === m.symbol;
            const isCompleted = status.isRunning && idx < status.currentStepIndex && !status.isWaitingDelay;
            const isPreviewSelected = previewSymbol === m.symbol;
            const mLowestDigit = mState?.lowestDigit ?? 0;
            const mLowestPct = mState?.lowestPct ?? 10.0;
            const mSample = mState?.sampleCount ?? 500;
            const mLastPrice = mState?.lastPrice ?? 0;

            return (
              <button
                key={m.symbol}
                type="button"
                onClick={() => setPreviewSymbol(m.symbol)}
                className={`p-4 rounded-2xl border text-left transition-all relative cursor-pointer flex flex-col justify-between ${
                  isNextTarget
                    ? 'bg-amber-950/40 border-amber-400 ring-2 ring-amber-400/50 shadow-xl shadow-amber-500/20 animate-pulse'
                    : isCurrentActive
                    ? 'bg-gradient-to-b from-emerald-950/80 to-slate-900 border-emerald-400 ring-2 ring-emerald-400/50 shadow-xl shadow-emerald-500/20'
                    : isPreviewSelected
                    ? 'bg-slate-850 border-cyan-500/60 ring-1 ring-cyan-500/30'
                    : 'bg-slate-950/80 border-slate-800 hover:border-slate-700'
                }`}
              >
                {/* Step Header */}
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black ${
                        isNextTarget
                          ? 'bg-amber-400 text-slate-950'
                          : isCurrentActive
                          ? 'bg-emerald-400 text-slate-950'
                          : isCompleted
                          ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/40'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {idx + 1}
                    </span>
                    <span className="font-bold text-sm text-white">{m.shortName}</span>
                  </div>

                  {isNextTarget ? (
                    <span className="text-[9px] font-mono px-2 py-0.5 rounded-full bg-amber-500 text-slate-950 font-black animate-pulse flex items-center gap-1">
                      <Clock className="w-2.5 h-2.5" />
                      <span>NEXT IN {status.delaySecondsRemaining}s</span>
                    </span>
                  ) : isCurrentActive ? (
                    config.virtualTradeOptionEnabled ? (
                      status.virtualModeState === 'VIRTUAL_HUNTING' ? (
                        <span className="text-[9px] font-mono px-2 py-0.5 rounded-full bg-teal-400 text-slate-950 font-black animate-pulse flex items-center gap-1">
                          <FlaskConical className="w-2.5 h-2.5" />
                          <span>DEMO ({status.virtualLosses}/1 L)</span>
                        </span>
                      ) : status.virtualModeState === 'REAL_ARMED' ? (
                        <span className="text-[9px] font-mono px-2 py-0.5 rounded-full bg-amber-400 text-slate-950 font-black animate-pulse flex items-center gap-1">
                          <DollarSign className="w-2.5 h-2.5" />
                          <span>REAL ARMED</span>
                        </span>
                      ) : (
                        <span className="text-[9px] font-mono px-2 py-0.5 rounded-full bg-emerald-400 text-slate-950 font-black animate-pulse flex items-center gap-1">
                          <DollarSign className="w-2.5 h-2.5" />
                          <span>REAL ACTIVE</span>
                        </span>
                      )
                    ) : (
                      <span className="text-[9px] font-mono px-2 py-0.5 rounded-full bg-emerald-500 text-slate-950 font-black animate-pulse">
                        ACTIVE
                      </span>
                    )
                  ) : isCompleted ? (
                    <span className="text-[9px] font-mono px-2 py-0.5 rounded-full bg-emerald-950/80 text-emerald-300 border border-emerald-500/40 font-bold flex items-center gap-1">
                      <CheckCircle2 className="w-2.5 h-2.5 text-emerald-400" />
                      <span>DONE</span>
                    </span>
                  ) : (
                    <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-slate-900 text-slate-400">
                      STEP {idx + 1}
                    </span>
                  )}
                </div>

                {/* Lowest Frequency Highlight */}
                <div className="my-2 p-2.5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-1">
                  <div className="text-[10px] uppercase font-bold text-slate-400 flex items-center justify-between">
                    <span>Lowest Freq:</span>
                    <span className="font-mono text-cyan-300 font-bold">{mSample}/500 ticks</span>
                  </div>
                  <div className="flex items-baseline justify-between">
                    <div className="text-xl font-black font-mono text-emerald-400">
                      ≠ Digit [{mLowestDigit}]
                    </div>
                    <div className="text-xs font-mono font-bold text-slate-300">
                      {mLowestPct.toFixed(1)}%
                    </div>
                  </div>
                </div>

                {/* Live Spot & Pip */}
                <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] font-mono text-slate-400">
                  <span>Spot:</span>
                  <span className="text-white font-bold">
                    {mLastPrice > 0 ? formatDerivQuote(mLastPrice, m.pipSize, m.symbol) : '--'}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* 📊 4 KEY METRICS HUD */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1: Current Ladder Step Market */}
        <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
            <span className="uppercase font-bold tracking-wider flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-emerald-400" />
              <span>Current Market</span>
            </span>
            <span className="px-2 py-0.5 rounded-full font-mono text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
              STEP {status.isRunning ? status.currentStepIndex + 1 : 1}/5
            </span>
          </div>
          <div className="mt-2">
            <div className="text-2xl font-black font-mono text-white">
              {activeMarketState?.name || 'Volatility 10 Index'}
            </div>
            <div className="text-xs text-slate-400 mt-1">
              Sample:{' '}
              <strong className="text-cyan-300 font-mono">
                {sampleCount} / 500 Ticks
              </strong>
            </div>
          </div>
          <div className="mt-2 text-[11px] font-mono text-slate-400 flex items-center justify-between">
            <span>Next Target Volatility:</span>
            <span className="text-emerald-400 font-bold">
              {LOWEST_FREQUENCY_MARKETS[(status.currentStepIndex + 1) % 5].shortName}
            </span>
          </div>
        </div>

        {/* Metric 2: Lowest Frequency Differ Target */}
        <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
            <span className="uppercase font-bold tracking-wider flex items-center gap-1.5">
              <TrendingDown className="w-3.5 h-3.5 text-cyan-400" />
              <span>Lowest Freq Digit</span>
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 font-mono font-bold border border-cyan-500/40">
              MIN OCCURRENCE
            </span>
          </div>
          <div className="flex items-baseline justify-between mt-2">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black font-mono text-emerald-400">
                ≠ [{lowestDigit}]
              </span>
              <span className="text-xl font-bold font-mono text-cyan-300">
                {lowestPct.toFixed(1)}%
              </span>
            </div>
            <span className="text-[11px] font-mono text-slate-400">
              {lowestHits} / {sampleCount} hits
            </span>
          </div>
          <div className="mt-2 text-[11px] font-mono text-slate-400 flex items-center justify-between">
            <span>Duration:</span>
            <span className="text-emerald-300 font-bold">1 Tick (Immediate)</span>
          </div>
        </div>

        {/* Metric 3: Active Stake & Money Management */}
        <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
            <span className="uppercase font-bold tracking-wider flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              <span>Stake & Mode</span>
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-mono font-bold">
              {config.stakeMode}
            </span>
          </div>
          <div className="mt-2">
            <div className="text-2xl font-black font-mono text-white">
              ${status.currentStake.toFixed(2)} USD
            </div>
            <div className="text-xs text-slate-400 mt-1">
              Base: ${config.baseStake.toFixed(2)} • Multiplier: {config.martingaleMultiplier}x
            </div>
          </div>
          <div className="mt-2 text-[11px] font-mono text-slate-400 flex items-center justify-between">
            <span>Cycle Setting:</span>
            <span className="text-cyan-300 font-bold">
              {config.continuousCycles ? 'Continuous Repeat' : '1 Cycle (5 Trades)'}
            </span>
          </div>
        </div>

        {/* Metric 4: Scorecard & P&L */}
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

      {/* 📊 500-TICK DIGIT DISTRIBUTION BARS FOR PREVIEWED MARKET */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Percent className="w-5 h-5 text-emerald-400" />
              <span>
                Real Digit Percentage Distribution on {activeMarketState?.name || previewSymbol}
              </span>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 font-mono font-bold border border-cyan-500/40">
                Sample: {sampleCount} / 500 Ticks
              </span>
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Calculated on the last 500 ticks. The bar with the lowest height (marked in green with target badge) is automatically selected for the Differ contract!
            </p>
          </div>

          {/* Quick Market Switcher */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 uppercase font-semibold">Inspect:</span>
            <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
              {LOWEST_FREQUENCY_MARKETS.map((m) => (
                <button
                  key={m.symbol}
                  onClick={() => setPreviewSymbol(m.symbol)}
                  className={`px-2.5 py-1 text-xs font-bold font-mono rounded-lg transition-all ${
                    previewSymbol === m.symbol
                      ? 'bg-emerald-500 text-slate-950 font-black shadow-md shadow-emerald-500/20'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {m.shortName}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* 10 Vertical Percentage Bars */}
        <div className="grid grid-cols-10 gap-1.5 sm:gap-3 pt-4 pb-2">
          {digitStats.map((item) => {
            const maxPct = Math.max(...digitStats.map((d) => d.percentage), 20);
            const heightPercent = Math.max(12, Math.min(100, (item.percentage / maxPct) * 100));

            let barColor = 'bg-slate-700 text-slate-200';
            let borderColor = 'border-slate-800';

            if (item.isLowest) {
              barColor = 'bg-gradient-to-t from-emerald-600 to-emerald-400 text-slate-950 font-black';
              borderColor = 'border-emerald-400 ring-2 ring-emerald-400/50 shadow-lg shadow-emerald-500/30';
            } else if (item.isHighest) {
              barColor = 'bg-gradient-to-t from-rose-600 to-rose-400 text-white';
              borderColor = 'border-rose-500/60';
            } else if (item.percentage <= 8.5) {
              barColor = 'bg-cyan-600 text-white';
            }

            return (
              <div
                key={item.digit}
                className={`flex flex-col items-center justify-end p-2 rounded-2xl border transition-all relative ${borderColor} ${
                  item.isLowest ? 'bg-emerald-950/40 scale-105' : 'bg-slate-950/70'
                }`}
              >
                {/* Lowest / Highest Tag */}
                <div className="h-5 flex items-center justify-center">
                  {item.isLowest && (
                    <span className="text-[9px] uppercase font-black px-1.5 py-0.2 rounded bg-emerald-400 text-slate-950 shadow-sm animate-pulse">
                      LOWEST
                    </span>
                  )}
                  {item.isHighest && (
                    <span className="text-[9px] uppercase font-bold text-rose-400">HIGHEST</span>
                  )}
                </div>

                {/* Percentage Text on Top */}
                <div className="text-[11px] sm:text-xs font-mono font-black mb-1.5 mt-1">
                  <span
                    className={
                      item.isLowest
                        ? 'text-emerald-400 font-black text-sm'
                        : item.isHighest
                        ? 'text-rose-400'
                        : 'text-slate-300'
                    }
                  >
                    {item.percentage.toFixed(1)}%
                  </span>
                </div>

                {/* Vertical Bar Visual */}
                <div className="w-full h-36 bg-slate-950 rounded-xl p-1 flex flex-col justify-end overflow-hidden border border-slate-800/80">
                  <div
                    style={{ height: `${heightPercent}%` }}
                    className={`w-full rounded-lg transition-all duration-300 flex items-start justify-center pt-1 ${barColor}`}
                  >
                    <span className="text-[9px] font-mono font-bold opacity-80">{item.count}</span>
                  </div>
                </div>

                {/* Digit Bottom Label */}
                <div
                  className={`mt-2 w-full py-1.5 rounded-xl flex flex-col items-center justify-center font-mono border ${
                    item.isLowest
                      ? 'bg-emerald-500 text-slate-950 border-emerald-400 font-black shadow-md shadow-emerald-500/30'
                      : 'bg-slate-900 text-slate-300 border-slate-800'
                  }`}
                >
                  <span className="font-black text-base leading-none">{item.digit}</span>
                  <span className="text-[8px] uppercase tracking-wider font-bold mt-0.5 opacity-80">
                    {item.isLowest ? '≠ DIFFER' : `${item.count} hits`}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 📜 SETTLED TRADE HISTORY FOR LOWEST FREQUENCY BOT */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-emerald-400" />
            <h3 className="text-base font-bold text-white">
              Lowest Frequency Trades Log ({trades.length})
            </h3>
          </div>
          {trades.length > 0 && (
            <button
              onClick={() => lowestFrequencyBotEngine.resetStats()}
              className="text-xs text-slate-400 hover:text-rose-400 flex items-center gap-1 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Clear Log</span>
            </button>
          )}
        </div>

        {trades.length === 0 ? (
          <div className="py-12 text-center text-slate-500 text-xs">
            No trades executed yet. Click &quot;START LOWEST FREQUENCY BOT&quot; to begin scanning from Volatility 10 Index!
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950 text-slate-400 uppercase font-semibold border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4">Time</th>
                  <th className="py-3 px-4">Cycle & Step</th>
                  <th className="py-3 px-4">Market</th>
                  <th className="py-3 px-4">Target Differ</th>
                  <th className="py-3 px-4">Account Mode</th>
                  <th className="py-3 px-4 text-center">Lowest Freq %</th>
                  <th className="py-3 px-4 text-center">Exit Digit</th>
                  <th className="py-3 px-4">Stake</th>
                  <th className="py-3 px-4 text-right">Profit / Loss</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {trades.map((item) => {
                  const isWin = item.result === 'WIN' || item.profit > 0;
                  return (
                    <tr key={item.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-3 px-4 text-slate-400 font-sans">{item.timeString}</td>
                      <td className="py-3 px-4 text-slate-300 font-sans font-bold">
                        Cycle {item.cycle} • Step {item.stepNumber}/5
                      </td>
                      <td className="py-3 px-4 font-bold font-sans text-white">{item.marketName}</td>
                      <td className="py-3 px-4 text-emerald-400 font-bold">≠ Digit {item.lowestDigit}</td>
                      <td className="py-3 px-4 font-sans">
                        {item.isVirtual ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-teal-500/20 text-teal-300 border border-teal-500/40 font-mono">
                            <FlaskConical className="w-3 h-3 text-teal-400" />
                            <span>VIRTUAL DEMO</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm shadow-emerald-500/20 font-mono">
                            <DollarSign className="w-3 h-3 text-emerald-400" />
                            <span>REAL ACCOUNT</span>
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center text-cyan-300">
                        {item.lowestPct.toFixed(1)}% (500t)
                      </td>
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
                          {isWin ? '+' : ''}${item.profit.toFixed(2)}
                        </span>
                        {item.isVirtual && (
                          <span className="block text-[9px] font-mono font-normal text-teal-400 opacity-80">
                            (Demo Risk)
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

      {/* ⚙️ CONFIGURATION MODAL */}
      {showConfigModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Sliders className="w-5 h-5 text-emerald-400" />
                <span>Lowest Frequency Bot Settings</span>
              </h3>
              <button
                onClick={() => setShowConfigModal(false)}
                className="text-slate-400 hover:text-white font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 text-xs font-mono">
              <div>
                <label className="text-slate-300 block mb-1 font-bold">Base Stake ($)</label>
                <input
                  type="number"
                  step="0.1"
                  min="0.35"
                  value={config.baseStake}
                  onChange={(e) => handleConfigChange({ baseStake: Math.max(0.35, Number(e.target.value)) })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white"
                />
              </div>

              <div>
                <label className="text-slate-300 block mb-1 font-bold">Stake Money Management Mode</label>
                <select
                  value={config.stakeMode}
                  onChange={(e) => handleConfigChange({ stakeMode: e.target.value as any })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-emerald-300"
                >
                  <option value="FLAT">FLAT (Fixed Stake Every Trade)</option>
                  <option value="MARTINGALE">MARTINGALE (Recovery On Loss)</option>
                  <option value="COMPOUND">COMPOUND (Reinvest Profit On Win)</option>
                  <option value="BALANCE_PERCENT">1% BALANCE SIZING</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-300 block mb-1 font-bold">Take Profit ($)</label>
                  <input
                    type="number"
                    min="1"
                    value={config.takeProfit}
                    onChange={(e) => handleConfigChange({ takeProfit: Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-emerald-400"
                  />
                </div>
                <div>
                  <label className="text-slate-300 block mb-1 font-bold">Stop Loss ($)</label>
                  <input
                    type="number"
                    min="1"
                    value={config.stopLoss}
                    onChange={(e) => handleConfigChange({ stopLoss: Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-rose-400"
                  />
                </div>
              </div>

              {/* Virtual Trade Option Settings */}
              <div className="p-3 rounded-2xl bg-slate-950 border border-teal-500/30 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-teal-300 block font-bold flex items-center gap-1.5">
                      <FlaskConical className="w-4 h-4 text-teal-400" />
                      <span>Virtual Trade Option</span>
                    </label>
                    <span className="text-[10px] text-slate-400">
                      Trades on virtual until 1 loss, then takes next trade on real account!
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const nextVal = !config.virtualTradeOptionEnabled;
                      handleConfigChange({ virtualTradeOptionEnabled: nextVal });
                      lowestFrequencyBotEngine.setVirtualTradeOption(nextVal);
                    }}
                    className={`px-3 py-1.5 rounded-xl font-bold text-xs transition-all ${
                      config.virtualTradeOptionEnabled
                        ? 'bg-teal-500 text-slate-950 shadow-md shadow-teal-500/20'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {config.virtualTradeOptionEnabled ? 'ENABLED' : 'DISABLED'}
                  </button>
                </div>

                {config.virtualTradeOptionEnabled && (
                  <div>
                    <label className="text-slate-300 block mb-1 font-bold">Virtual Demo Stake ($)</label>
                    <input
                      type="number"
                      step="0.1"
                      min="0.35"
                      value={config.virtualDemoStake}
                      onChange={(e) => {
                        const val = Math.max(0.35, Number(e.target.value));
                        handleConfigChange({ virtualDemoStake: val });
                        lowestFrequencyBotEngine.setVirtualDemoStake(val);
                      }}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2.5 text-teal-300"
                    />
                  </div>
                )}
              </div>

              <div>
                <label className="text-slate-300 block mb-1 font-bold">Sequence Cycle Mode</label>
                <div className="grid grid-cols-2 gap-2 mt-1">
                  <button
                    type="button"
                    onClick={() => handleConfigChange({ continuousCycles: true })}
                    className={`p-2.5 rounded-xl border text-center transition-all ${
                      config.continuousCycles
                        ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300 font-bold'
                        : 'bg-slate-950 border-slate-800 text-slate-400'
                    }`}
                  >
                    🔁 Continuous Repeat (Loop to Vol 10)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleConfigChange({ continuousCycles: false })}
                    className={`p-2.5 rounded-xl border text-center transition-all ${
                      !config.continuousCycles
                        ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300 font-bold'
                        : 'bg-slate-950 border-slate-800 text-slate-400'
                    }`}
                  >
                    ⏹️ 1 Single Cycle (Stop after Vol 100)
                  </button>
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-800 flex justify-end">
              <button
                onClick={() => setShowConfigModal(false)}
                className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs font-mono transition-all"
              >
                Save & Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
