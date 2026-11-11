import React, { useState, useEffect, useMemo } from 'react';
import { MarketSymbol, ActiveContract } from '../../types/deriv';
import {
  systemAutoEngine,
  SystemAutoStatus,
  SystemAutoConfig,
  TradeRecord,
  MarketLiveState,
  ASCENDING_VOLATILITY_MARKETS,
  AscendingMarket,
} from '../../services/systemAutoDifferEngine';
import { derivWS, extractDerivLastDigit, formatDerivQuote, getMarketPipSize } from '../../services/derivWebSocket';
import { soundManager } from '../../utils/soundEffects';
import {
  Play,
  Square,
  Crosshair,
  Zap,
  TrendingUp,
  DollarSign,
  Sliders,
  RotateCcw,
  Activity,
  Flame,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Sparkles,
  ShieldCheck,
  ShieldAlert,
  Percent,
  Coins,
  Repeat,
  RefreshCw,
  Eye,
  Radar,
  ArrowRight,
  FlaskConical,
  ArrowRightLeft,
  Lock,
} from 'lucide-react';

interface DigitSelectDifferBotPanelProps {
  balanceUsd: number;
  onUpdateBalance?: (newBalance: number) => void;
  activeMarketSymbol?: MarketSymbol;
  onSelectMarket?: (symbol: MarketSymbol) => void;
}

export const DigitSelectDifferBotPanel: React.FC<DigitSelectDifferBotPanelProps> = ({
  balanceUsd,
  onUpdateBalance,
  activeMarketSymbol,
  onSelectMarket,
}) => {
  const [status, setStatus] = useState<SystemAutoStatus>(() => systemAutoEngine.getStatus());
  const [config, setConfig] = useState<SystemAutoConfig>(() => systemAutoEngine.getConfig());
  const [trades, setTrades] = useState<TradeRecord[]>(() => systemAutoEngine.getTradeHistory());
  const [marketStates, setMarketStates] = useState<Map<MarketSymbol, MarketLiveState>>(() =>
    systemAutoEngine.getMarketStates()
  );
  const [activeTab, setActiveTab] = useState<'RADAR' | 'CONFIG' | 'LOGS'>('RADAR');
  const [manualTradeMessage, setManualTradeMessage] = useState<string | null>(null);
  // 🔒 1-Tap Differ Buy is PERMANENTLY OFF (Safety lock: tapping digits only selects target digit)
  const instantTapBuyDiffer = false;

  // 🔄 Sync with Top Live Feed: Once market volatility is detected from the top live feed, automatically select the same market on select volatility market to trade
  useEffect(() => {
    if (activeMarketSymbol && !status.isRunning) {
      systemAutoEngine.selectDigitSelectVolatility(activeMarketSymbol);
      handleConfigChange({ digitSelectVolatilitySymbol: activeMarketSymbol });
    }
  }, [activeMarketSymbol, status.isRunning]);

  // Sync balance
  useEffect(() => {
    systemAutoEngine.setBalance(balanceUsd);
  }, [balanceUsd]);

  useEffect(() => {
    systemAutoEngine.setBalanceUpdater((profit, newBal) => {
      if (onUpdateBalance) onUpdateBalance(newBal);
    });
  }, [onUpdateBalance]);

  // Subscribe to systemAutoEngine
  useEffect(() => {
    const unsubStatus = systemAutoEngine.subscribeStatus(setStatus);
    const unsubConfig = systemAutoEngine.subscribeConfig(setConfig);
    const unsubHistory = systemAutoEngine.subscribeHistory(setTrades);
    const unsubStates = systemAutoEngine.subscribeMarketStates(setMarketStates);

    return () => {
      unsubStatus();
      unsubConfig();
      unsubHistory();
      unsubStates();
    };
  }, []);

  const handleConfigChange = (newValues: Partial<SystemAutoConfig>) => {
    const updated = { ...config, ...newValues };
    setConfig(updated);
    systemAutoEngine.saveConfig(newValues);
  };

  const selectedTargetDigit = config.digitSelectTargetDigit ?? 5;
  const selectedVolatilitySymbol = config.digitSelectVolatilitySymbol || activeMarketSymbol || 'R_100';
  const selectedMarket =
    ASCENDING_VOLATILITY_MARKETS.find((m) => m.symbol === selectedVolatilitySymbol) ||
    ASCENDING_VOLATILITY_MARKETS.find((m) => m.symbol === 'R_100') ||
    ASCENDING_VOLATILITY_MARKETS[0];

  const currentMarketState = marketStates.get(selectedMarket.symbol);
  const currentLastDigit = currentMarketState?.lastDigit ?? 0;
  const currentPrice = currentMarketState?.price ?? 0;

  // Filter trades for Digit Select Differ
  const differTrades = useMemo(() => {
    return trades.filter((t) => t.triggerReason.includes('Digit Select Differ') || t.differDigit === selectedTargetDigit);
  }, [trades, selectedTargetDigit]);

  const handleToggleBot = () => {
    if (status.isRunning) {
      systemAutoEngine.stopBot('User stopped Digit Select Differ Bot');
    } else {
      // Ensure strategyMode is set to DIGIT_SELECT_DIFFER
      handleConfigChange({
        strategyMode: 'DIGIT_SELECT_DIFFER',
        durationTicks: 1,
        digitSelectTargetDigit: selectedTargetDigit,
        digitSelectVolatilitySymbol: selectedMarket.symbol,
      });
      systemAutoEngine.startBot();
    }
  };

  const handleResetStats = () => {
    systemAutoEngine.resetStats();
  };

  const handleSelectMarket = (symbol: MarketSymbol) => {
    if (status.isRunning) return;
    systemAutoEngine.selectDigitSelectVolatility(symbol);
    handleConfigChange({ digitSelectVolatilitySymbol: symbol });
    if (onSelectMarket) {
      onSelectMarket(symbol);
    }
  };

  // Instant Manual 1-Click Differ Snipe on the selected market
  const handleManualSnipe = (targetDigitToDiffer: number) => {
    soundManager.playStart();
    try {
      const contract = derivWS.purchaseContract({
        symbol: selectedMarket.symbol,
        contractType: 'DIGITDIFF',
        stake: status.currentStake || config.baseStake,
        durationTicks: 1,
        targetDigit: targetDigitToDiffer,
        symbolName: selectedMarket.name,
      });
      setManualTradeMessage(
        `⚡ Instant Differ ≠ ${targetDigitToDiffer} placed on ${selectedMarket.shortName} (Stake: $${(
          status.currentStake || config.baseStake
        ).toFixed(2)}) ID: ${contract.id.slice(-6)}`
      );
      setTimeout(() => setManualTradeMessage(null), 4000);
    } catch (err: any) {
      console.error('Manual Differ snipe failed:', err);
      soundManager.playLoss();
      setManualTradeMessage(`⚠️ Trade Error: ${err.message || 'Execution error'}`);
      setTimeout(() => setManualTradeMessage(null), 4000);
    }
  };

  // 🎯 Select target digit to differ (1-Tap Differ Buy is PERMANENTLY OFF for safety)
  const handleSelectDigit = (digit: number) => {
    if (status.isRunning) return;
    systemAutoEngine.selectDigitSelectTargetDigit(digit);
    handleConfigChange({ digitSelectTargetDigit: digit });
    soundManager.playButtonClick();
  };

  return (
    <div className="space-y-6">
      {/* 🚀 MASTER HERO BANNER: AUTO DIGIT SELECT DIFFER */}
      <div className="bg-gradient-to-r from-slate-900 via-rose-950/40 to-slate-900 border border-rose-500/40 rounded-3xl p-5 sm:p-6 shadow-2xl shadow-rose-950/30">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="p-3.5 rounded-2xl bg-gradient-to-tr from-rose-500 via-pink-600 to-fuchsia-600 text-white shadow-xl shadow-rose-500/30">
              <Crosshair className="w-8 h-8" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white flex items-center gap-2">
                  <span>Auto...Digit Select Differ Bot</span>
                </h2>
                <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-rose-500/20 text-rose-300 font-mono font-bold border border-rose-500/40">
                  IMMEDIATE 1-TICK SNIPER
                </span>
                <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-mono font-bold border border-emerald-500/40">
                  90.9% WIN PROBABILITY
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-1">
                Select which digit you want to differ (0–9), choose your volatility market, and let the bot execute high-probability 1-tick Differ contracts automatically with Martingale recovery and Virtual Loss Filter.
              </p>
            </div>
          </div>

          {/* Master Start / Stop & Reset Controls */}
          <div className="flex items-center gap-3 shrink-0 flex-wrap sm:flex-nowrap">
            {/* Virtual Mode Switcher Button */}
            <button
              onClick={() => {
                const nextVal = !config.virtualLossFilterEnabled;
                handleConfigChange({ virtualLossFilterEnabled: nextVal });
                systemAutoEngine.setVirtualLossFilter(nextVal);
              }}
              className={`flex items-center gap-2.5 px-4 py-3 rounded-xl font-bold text-xs tracking-wide transition-all shadow-lg cursor-pointer border ${
                config.virtualLossFilterEnabled
                  ? 'bg-gradient-to-r from-cyan-950 via-teal-950 to-slate-900 border-cyan-400 text-cyan-300 ring-2 ring-cyan-400/50 shadow-cyan-500/25'
                  : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
              }`}
              title={
                config.virtualLossFilterEnabled
                  ? 'Virtual Mode Active: Starts trading on Virtual (Demo) mode. On 1 loss, switches next trade to Real Account. On real win, gets back to Virtual mode.'
                  : 'Click to turn ON Virtual Mode (1 Virtual Loss ➔ Real Account switch)'
              }
            >
              <FlaskConical className={`w-4 h-4 ${config.virtualLossFilterEnabled ? 'text-cyan-400 animate-pulse' : 'text-slate-500'}`} />
              <div className="text-left">
                <div className="text-[9px] uppercase font-mono tracking-wider text-slate-400 leading-none">Account Mode</div>
                <div className={`font-black text-xs leading-tight ${config.virtualLossFilterEnabled ? 'text-cyan-300' : 'text-slate-300'}`}>
                  {config.virtualLossFilterEnabled ? '🧪 VIRTUAL (Demo ➔ Real)' : '💎 REAL DIRECT'}
                </div>
              </div>
            </button>

            <button
              onClick={handleResetStats}
              disabled={status.isRunning}
              title="Reset trade stats & history"
              className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-white transition-all disabled:opacity-50"
            >
              <RotateCcw className="w-5 h-5" />
            </button>

            <button
              onClick={handleToggleBot}
              className={`flex items-center gap-2.5 px-7 py-3.5 rounded-xl font-black text-sm tracking-wide transition-all shadow-xl active:scale-95 ${
                status.isRunning && config.strategyMode === 'DIGIT_SELECT_DIFFER'
                  ? 'bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white shadow-red-600/30 ring-2 ring-red-400 animate-pulse'
                  : 'bg-gradient-to-r from-rose-500 via-pink-600 to-fuchsia-600 hover:from-rose-400 hover:to-pink-500 text-white shadow-rose-500/30 ring-2 ring-rose-400'
              }`}
            >
              {status.isRunning && config.strategyMode === 'DIGIT_SELECT_DIFFER' ? (
                <>
                  <Square className="w-5 h-5 fill-current" />
                  <span>STOP BOT</span>
                </>
              ) : (
                <>
                  <Play className="w-5 h-5 fill-current" />
                  <span>RUN BOT (DIFFER ≠ {selectedTargetDigit})</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Status Line */}
        <div className="mt-4 pt-3 border-t border-rose-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span
                className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                  status.isRunning && config.strategyMode === 'DIGIT_SELECT_DIFFER' ? 'bg-emerald-400' : 'bg-slate-500'
                }`}
              ></span>
              <span
                className={`relative inline-flex rounded-full h-2.5 w-2.5 ${
                  status.isRunning && config.strategyMode === 'DIGIT_SELECT_DIFFER' ? 'bg-emerald-500' : 'bg-slate-600'
                }`}
              ></span>
            </span>
            <span className="font-mono text-slate-200">{status.statusMessage}</span>
          </div>

          <div className="flex items-center gap-2 font-mono text-[11px] flex-wrap">
            <span className="px-2.5 py-0.5 rounded-lg bg-slate-950 border border-rose-500/40 text-rose-300 font-bold">
              Target: ≠ {selectedTargetDigit}
            </span>
            <span className="px-2.5 py-0.5 rounded-lg bg-slate-950 border border-emerald-500/40 text-emerald-300 font-bold">
              Market: {selectedMarket.shortName}
            </span>
            <span className="px-2.5 py-0.5 rounded-lg bg-slate-950 border border-cyan-500/40 text-cyan-300 font-bold">
              Live Digit: [{currentLastDigit}]
            </span>
            <span className={`px-2.5 py-0.5 rounded-lg border font-bold ${
              config.virtualLossFilterEnabled
                ? status.virtualModeState === 'REAL_ARMED'
                  ? 'bg-amber-950 border-amber-400 text-amber-300 animate-pulse'
                  : 'bg-cyan-950 border-cyan-500 text-cyan-300'
                : 'bg-slate-950 border-slate-700 text-slate-300'
            }`}>
              {config.virtualLossFilterEnabled
                ? status.virtualModeState === 'REAL_ARMED'
                  ? '🔥 REAL ARMED (1 Loss Hit)'
                  : status.virtualModeState === 'REAL_ACTIVE'
                  ? '💎 REAL TRADE RUNNING'
                  : '🧪 VIRTUAL HUNTING (Demo)'
                : '💎 REAL ACCOUNT'}
            </span>
          </div>
        </div>
      </div>

      {/* 🧪 VIRTUAL MODE (DEMO ➔ REAL ➔ DEMO) PIPELINE MONITOR */}
      {config.virtualLossFilterEnabled && (
        <div className="bg-gradient-to-br from-cyan-950/60 via-slate-900 to-slate-950 border-2 border-cyan-500/50 rounded-2xl p-4 sm:p-5 shadow-xl shadow-cyan-950/30 space-y-3.5 ring-1 ring-cyan-500/30">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-cyan-500/20">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-cyan-500 text-slate-950 font-black shadow-lg shadow-cyan-500/30">
                <FlaskConical className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-sm font-black text-white flex items-center gap-1.5">
                    <span>Virtual Mode Active: 1-Loss Demo ➔ Real Account Switch</span>
                  </h3>
                  <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-mono font-black border ${
                    status.virtualModeState === 'REAL_ARMED'
                      ? 'bg-amber-500/20 text-amber-300 border-amber-400 animate-pulse'
                      : status.virtualModeState === 'REAL_ACTIVE'
                      ? 'bg-rose-500/20 text-rose-300 border-rose-400'
                      : 'bg-cyan-500/20 text-cyan-300 border-cyan-400'
                  }`}>
                    {status.virtualModeState === 'REAL_ARMED'
                      ? '🔥 1 LOSS HIT! NEXT TRADE ON REAL ACCOUNT'
                      : status.virtualModeState === 'REAL_ACTIVE'
                      ? '💎 REAL TRADE IN PROGRESS'
                      : '🧪 VIRTUAL MODE (DEMO HUNTING)'}
                  </span>
                </div>
                <p className="text-xs text-slate-300 mt-0.5">
                  Bot starts trading on <strong>Virtual Mode (Demo)</strong>. When 1 loss occurs, it automatically switches the next trade to your <strong>Real Account</strong>. Once it wins on the Real Account, it gets back to Virtual Mode again.
                </p>
              </div>
            </div>

            {/* Quick Demo Stake Sizing */}
            <div className="flex items-center gap-2 font-mono text-xs bg-slate-950 p-2 rounded-xl border border-slate-800 shrink-0">
              <span className="text-slate-400 text-[11px]">Demo Stake:</span>
              <div className="flex items-center gap-1">
                {[0.35, 0.50, 1.00, 2.00, 5.00].map((stk) => (
                  <button
                    key={stk}
                    disabled={status.isRunning}
                    onClick={() => {
                      systemAutoEngine.setVirtualDemoStake(stk);
                      handleConfigChange({ virtualDemoStake: stk });
                    }}
                    className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all cursor-pointer ${
                      (config.virtualDemoStake || 1.00) === stk
                        ? 'bg-cyan-500 text-slate-950 font-black shadow'
                        : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                    }`}
                  >
                    ${stk}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* 4-Step Visual Cycle Diagram */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 text-xs font-sans">
            {/* Step 1 */}
            <div className={`p-3 rounded-xl border transition-all ${
              status.virtualModeState === 'VIRTUAL'
                ? 'bg-cyan-950/70 border-cyan-400 text-white shadow-lg shadow-cyan-500/20 ring-1 ring-cyan-400'
                : 'bg-slate-950/80 border-slate-800/80 text-slate-400'
            }`}>
              <div className="flex items-center justify-between text-[10px] font-mono font-bold mb-1">
                <span className={status.virtualModeState === 'VIRTUAL' ? 'text-cyan-300' : 'text-slate-400'}>STEP 1</span>
                {status.virtualModeState === 'VIRTUAL' && (
                  <span className="px-1.5 py-0.2 rounded bg-cyan-400 text-slate-950 font-black text-[9px] animate-pulse">ACTIVE</span>
                )}
              </div>
              <div className="font-bold text-white text-xs">🧪 Virtual Mode (Demo)</div>
              <div className="text-[11px] text-slate-300 mt-1 leading-snug">
                Bot starts trading on Virtual Mode using Demo stake (${(config.virtualDemoStake || 1.00).toFixed(2)}). Real capital is 100% protected.
              </div>
            </div>

            {/* Step 2 */}
            <div className={`p-3 rounded-xl border transition-all ${
              status.virtualModeState === 'REAL_ARMED'
                ? 'bg-amber-950/70 border-amber-400 text-white shadow-lg shadow-amber-500/20 ring-1 ring-amber-400 animate-pulse'
                : 'bg-slate-950/80 border-slate-800/80 text-slate-400'
            }`}>
              <div className="flex items-center justify-between text-[10px] font-mono font-bold mb-1">
                <span className={status.virtualModeState === 'REAL_ARMED' ? 'text-amber-300' : 'text-slate-400'}>STEP 2</span>
                {status.virtualModeState === 'REAL_ARMED' && (
                  <span className="px-1.5 py-0.2 rounded bg-amber-400 text-slate-950 font-black text-[9px]">TRIGGERED</span>
                )}
              </div>
              <div className="font-bold text-white text-xs">❌ 1 Virtual Loss Occurs</div>
              <div className="text-[11px] text-slate-300 mt-1 leading-snug">
                Exit digit matches ≠ {selectedTargetDigit}. 1 demo loss is absorbed risk-free and arms the switch to Real Account!
              </div>
            </div>

            {/* Step 3 */}
            <div className={`p-3 rounded-xl border transition-all ${
              status.virtualModeState === 'REAL_ACTIVE' || status.virtualModeState === 'REAL_ARMED'
                ? 'bg-rose-950/70 border-rose-400 text-white shadow-lg shadow-rose-500/20 ring-1 ring-rose-400'
                : 'bg-slate-950/80 border-slate-800/80 text-slate-400'
            }`}>
              <div className="flex items-center justify-between text-[10px] font-mono font-bold mb-1">
                <span className={status.virtualModeState === 'REAL_ACTIVE' ? 'text-rose-300' : 'text-slate-400'}>STEP 3</span>
                {status.virtualModeState === 'REAL_ACTIVE' && (
                  <span className="px-1.5 py-0.2 rounded bg-rose-400 text-slate-950 font-black text-[9px]">IN-FLIGHT</span>
                )}
              </div>
              <div className="font-bold text-white text-xs">🔥 Switch to Real Account</div>
              <div className="text-[11px] text-slate-300 mt-1 leading-snug">
                Bot places next contract on Real Account with Real Stake (${(status.currentStake || config.baseStake).toFixed(2)}) on {selectedMarket.shortName}.
              </div>
            </div>

            {/* Step 4 */}
            <div className="p-3 rounded-xl border bg-slate-950/80 border-slate-800/80 text-slate-400">
              <div className="flex items-center justify-between text-[10px] font-mono font-bold mb-1">
                <span className="text-emerald-400">STEP 4</span>
                <span className="px-1.5 py-0.2 rounded bg-emerald-950 text-emerald-300 border border-emerald-500/30 text-[9px]">RESET</span>
              </div>
              <div className="font-bold text-white text-xs">💎 Real Win ➔ Back to Virtual</div>
              <div className="text-[11px] text-slate-300 mt-1 leading-snug">
                Once real trade wins, profit is banked, and bot immediately returns back to Virtual Mode to hunt for the next loss!
              </div>
            </div>
          </div>

          {/* Virtual vs Real Tally Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-cyan-500/20 text-xs font-mono">
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-1.5">
                <span className="text-slate-400">Virtual (Demo) Score:</span>
                <span className="text-cyan-300 font-bold">{status.virtualWins} Wins</span>
                <span className="text-slate-500">/</span>
                <span className="text-rose-400 font-bold">{status.virtualLosses} Losses</span>
              </div>
              <div className="h-3 w-px bg-slate-800" />
              <div className="flex items-center gap-1.5">
                <span className="text-slate-400">Real Account Score:</span>
                <span className="text-emerald-400 font-bold">{status.totalWins} Wins</span>
                <span className="text-slate-500">/</span>
                <span className="text-rose-400 font-bold">{status.totalLosses} Losses</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-slate-400">Real Account Net Profit:</span>
              <span className={`font-black font-mono ${status.netProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {status.netProfit >= 0 ? '+' : ''}${status.netProfit.toFixed(2)}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* 🚀 MANUAL TRADE NOTIFICATION */}
      {manualTradeMessage && (
        <div className="p-3 bg-slate-900 border border-emerald-500/50 rounded-xl flex items-center justify-between text-xs text-emerald-300 animate-fadeIn">
          <span className="font-semibold">{manualTradeMessage}</span>
          <button onClick={() => setManualTradeMessage(null)} className="text-slate-400 hover:text-white font-bold">
            ✕
          </button>
        </div>
      )}

      {/* 📊 LIVE METRICS STRIP */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
        {/* Account State Card */}
        <div className={`border rounded-2xl p-3.5 shadow-lg transition-all ${
          config.virtualLossFilterEnabled
            ? status.virtualModeState === 'REAL_ARMED'
              ? 'bg-amber-950/40 border-amber-400/80 ring-1 ring-amber-400 shadow-amber-500/20'
              : status.virtualModeState === 'REAL_ACTIVE'
              ? 'bg-rose-950/40 border-rose-400/80 ring-1 ring-rose-400'
              : 'bg-cyan-950/40 border-cyan-500/60 ring-1 ring-cyan-500/20'
            : 'bg-slate-900 border-slate-800'
        }`}>
          <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider flex items-center justify-between">
            <span>Account State</span>
            <FlaskConical className={`w-3.5 h-3.5 ${config.virtualLossFilterEnabled ? 'text-cyan-400' : 'text-slate-500'}`} />
          </div>
          <div className={`text-sm sm:text-base font-black font-mono mt-1 ${
            !config.virtualLossFilterEnabled
              ? 'text-slate-200'
              : status.virtualModeState === 'REAL_ARMED'
              ? 'text-amber-300 animate-pulse'
              : status.virtualModeState === 'REAL_ACTIVE'
              ? 'text-rose-300'
              : 'text-cyan-300'
          }`}>
            {!config.virtualLossFilterEnabled
              ? '💎 REAL DIRECT'
              : status.virtualModeState === 'REAL_ARMED'
              ? '🔥 REAL ARMED'
              : status.virtualModeState === 'REAL_ACTIVE'
              ? '💎 REAL TRADE'
              : '🧪 VIRTUAL'}
          </div>
          <div className="text-[10px] text-slate-400 font-mono mt-0.5 truncate">
            {config.virtualLossFilterEnabled
              ? status.virtualModeState === 'REAL_ARMED'
                ? '1st loss hit! Real order'
                : `Demo: ${status.virtualWins}W/${status.virtualLosses}L`
              : 'Direct execution'}
          </div>
        </div>

        {/* Net Profit */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3.5 shadow-lg">
          <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider flex items-center justify-between">
            <span>Real Profit</span>
            <Coins className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div
            className={`text-lg sm:text-xl font-black font-mono mt-1 ${
              status.netProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'
            }`}
          >
            {status.netProfit >= 0 ? '+' : ''}${status.netProfit.toFixed(2)}
          </div>
          <div className="text-[10px] text-slate-500 font-mono mt-0.5">Realized Balance</div>
        </div>

        {/* Win Rate */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3.5 shadow-lg">
          <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider flex items-center justify-between">
            <span>Win Rate</span>
            <Percent className="w-3.5 h-3.5 text-cyan-400" />
          </div>
          <div className="text-lg sm:text-xl font-black font-mono text-cyan-400 mt-1">
            {status.winRate.toFixed(1)}%
          </div>
          <div className="text-[10px] text-slate-500 font-mono mt-0.5">
            {status.totalWins}W / {status.totalLosses}L ({status.totalTrades})
          </div>
        </div>

        {/* Current Stake */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3.5 shadow-lg">
          <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider flex items-center justify-between">
            <span>Current Stake</span>
            <DollarSign className="w-3.5 h-3.5 text-amber-400" />
          </div>
          <div className="text-lg sm:text-xl font-black font-mono text-white mt-1">
            ${(status.currentStake || config.baseStake).toFixed(2)}
          </div>
          <div className="text-[10px] text-slate-500 font-mono mt-0.5">
            Base: ${config.baseStake.toFixed(2)}
          </div>
        </div>

        {/* Consecutive Streak */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3.5 shadow-lg">
          <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider flex items-center justify-between">
            <span>Win Streak</span>
            <Flame className="w-3.5 h-3.5 text-orange-400" />
          </div>
          <div className="text-lg sm:text-xl font-black font-mono text-orange-400 mt-1">
            {status.consecutiveWins} Wins
          </div>
          <div className="text-[10px] text-slate-500 font-mono mt-0.5">
            Max: {status.maxConsecutiveWins}
          </div>
        </div>

        {/* Active Differ Target */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3.5 shadow-lg">
          <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider flex items-center justify-between">
            <span>Differ Target</span>
            <Crosshair className="w-3.5 h-3.5 text-rose-400" />
          </div>
          <div className="text-lg sm:text-xl font-black font-mono text-rose-400 mt-1">
            ≠ {selectedTargetDigit}
          </div>
          <div className="text-[10px] text-slate-500 font-mono mt-0.5 truncate">
            {selectedMarket.shortName}
          </div>
        </div>

        {/* Deriv Account Balance */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3.5 shadow-lg">
          <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider flex items-center justify-between">
            <span>Account Balance</span>
            <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div className="text-lg sm:text-xl font-black font-mono text-emerald-300 mt-1">
            ${balanceUsd.toFixed(2)}
          </div>
          <div className="text-[10px] text-slate-500 font-mono mt-0.5">Available Funds</div>
        </div>
      </div>

      {/* 🧭 NAVIGATION TABS */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-2">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('RADAR')}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'RADAR'
                ? 'bg-rose-600 text-white shadow-lg shadow-rose-600/30'
                : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            <Crosshair className="w-4 h-4" />
            <span>Target & Execution Radar</span>
          </button>
          <button
            onClick={() => setActiveTab('CONFIG')}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'CONFIG'
                ? 'bg-rose-600 text-white shadow-lg shadow-rose-600/30'
                : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            <Sliders className="w-4 h-4" />
            <span>Stakes, Martingale & Risk Settings</span>
          </button>
          <button
            onClick={() => setActiveTab('LOGS')}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'LOGS'
                ? 'bg-rose-600 text-white shadow-lg shadow-rose-600/30'
                : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>Trade Logs ({differTrades.length})</span>
          </button>
        </div>
      </div>

      {/* 🎯 TAB 1: RADAR (DIGIT SELECTION + VOLATILITY MARKET + WIN RULE) */}
      {activeTab === 'RADAR' && (
        <div className="rounded-2xl bg-gradient-to-br from-slate-900 via-rose-950/20 to-slate-950 border border-rose-500/40 p-5 shadow-2xl space-y-6">
          {/* PART 1: SELECT WHICH DIGIT YOU WANT TO DIFFER */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-rose-300 flex items-center gap-2">
                <span className="flex items-center justify-center w-5 h-5 rounded-full bg-rose-500 text-slate-950 font-black text-[11px]">
                  1
                </span>
                <span>Select Which Digit You Want To Differ (≠ Digit)</span>
              </label>
              <div className="flex items-center gap-2.5">
                <div
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black border bg-slate-950 text-slate-400 border-slate-800 shadow-sm"
                  title="1-Tap Differ Buy is permanently turned off for safety. Clicking digits only selects the target differ digit."
                >
                  <Lock className="w-3.5 h-3.5 text-slate-500" />
                  <span>1-Tap Differ Buy: <strong className="text-rose-400 font-mono">PERMANENT OFF</strong></span>
                  <span className="text-[9px] px-1.5 py-0.2 rounded font-mono bg-slate-900 text-slate-400 border border-slate-800">
                    Safe
                  </span>
                </div>
                <span className="text-[11px] font-mono text-slate-400">
                  Target: <strong className="text-rose-400 text-xs">≠ {selectedTargetDigit}</strong>
                </span>
              </div>
            </div>

            {/* Digit Buttons 0 through 9 - Click safely selects Differ Target */}
            <div className="grid grid-cols-5 sm:grid-cols-10 gap-2.5">
              {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((digit) => {
                const isSelected = selectedTargetDigit === digit;
                return (
                  <button
                    key={digit}
                    type="button"
                    disabled={status.isRunning}
                    onClick={() => handleSelectDigit(digit)}
                    className={`group relative flex flex-col items-center justify-center py-3 px-2 rounded-2xl transition-all font-mono cursor-pointer ${
                      isSelected
                        ? 'bg-gradient-to-b from-rose-500 via-pink-600 to-fuchsia-600 text-white font-black shadow-xl shadow-rose-500/40 ring-2 ring-rose-300 scale-105'
                        : 'bg-slate-950 hover:bg-slate-850 text-slate-300 border border-slate-800 hover:border-rose-500/50'
                    } active:scale-95`}
                    title={`Select Differ Target: ≠ Digit ${digit}`}
                  >
                    <span className="text-2xl font-black">{digit}</span>
                    <span
                      className={`text-[9px] uppercase tracking-wider mt-1 font-bold flex items-center gap-0.5 ${
                        isSelected ? 'text-rose-100' : 'text-slate-500 group-hover:text-rose-400'
                      }`}
                    >
                      {isSelected ? '≠ SELECTED' : `DIFF ≠${digit}`}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Win / Loss Probability Helper */}
            <div className="p-3.5 rounded-xl bg-slate-950/90 border border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span className="text-slate-300">
                  <strong className="text-emerald-400 font-bold">Winning Digits (90.9% Win Rate):</strong>{' '}
                  <span className="font-mono text-emerald-300">
                    [{[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].filter((d) => d !== selectedTargetDigit).join(', ')}]
                  </span>
                </span>
              </div>
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                <span className="text-slate-300">
                  <strong className="text-rose-400 font-bold">Losing Digit:</strong>{' '}
                  <span className="font-mono text-rose-400 font-bold">[{selectedTargetDigit}]</span>
                </span>
              </div>
            </div>
          </div>

          {/* PART 2: SELECT VOLATILITY MARKET TO TRADE (SYNCED WITH TOP LIVE FEED) */}
          <div className="space-y-3 pt-4 border-t border-rose-500/20">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <label className="text-xs font-bold uppercase tracking-wider text-emerald-300 flex items-center gap-2">
                <span className="flex items-center justify-center w-5 h-5 rounded-full bg-emerald-500 text-slate-950 font-black text-[11px]">
                  2
                </span>
                <span>Select Volatility Market To Trade</span>
              </label>
              <div className="flex items-center gap-2 flex-wrap">
                {activeMarketSymbol && (
                  <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-mono font-bold border border-emerald-500/40 flex items-center gap-1.5 shadow-sm">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span>Top Live Feed Detected: <strong className="text-white">{selectedMarket.shortName}</strong></span>
                  </span>
                )}
                <span className="text-[11px] font-mono text-slate-400">
                  Trading Market: <strong className="text-emerald-400 text-xs">{selectedMarket.name}</strong>
                </span>
              </div>
            </div>

            {/* Market Selection Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
              {ASCENDING_VOLATILITY_MARKETS.map((market) => {
                const isSelected = selectedMarket.symbol === market.symbol;
                const isFeedMatch = activeMarketSymbol === market.symbol;
                const mState = marketStates.get(market.symbol);
                const lastD = mState?.lastDigit ?? 0;
                const price = mState?.price ?? 0;

                return (
                  <button
                    key={market.symbol}
                    disabled={status.isRunning}
                    onClick={() => handleSelectMarket(market.symbol)}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-emerald-950/40 border-emerald-400 ring-2 ring-emerald-400/50 shadow-lg shadow-emerald-500/20'
                        : 'bg-slate-950 border-slate-800 hover:border-slate-700 text-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-white">{market.shortName}</span>
                        {isFeedMatch && (
                          <span className="text-[8px] font-mono px-1 py-0.2 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold">
                            FEED
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-900 border border-slate-700 text-cyan-300">
                        [{lastD}]
                      </span>
                    </div>
                    <div className="text-[11px] font-mono text-slate-400 mt-1 truncate">
                      {price > 0 ? formatDerivQuote(price, getMarketPipSize(market.symbol), market.symbol) : '--'}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* PART 3: IMMEDIATE EXECUTION & RULE SUMMARY */}
          <div className="p-4 rounded-xl bg-gradient-to-r from-slate-950 via-rose-950/30 to-slate-950 border border-rose-500/40 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-rose-500/20 pb-2.5">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-rose-400 animate-pulse" />
                <span className="text-xs font-bold uppercase tracking-wider text-white">
                  Immediate 1-Tick Execution & Win Rule Confirmation
                </span>
              </div>
              <span className="text-[11px] font-mono text-emerald-300 font-bold bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/30">
                Duration: 1 Tick (Immediate Settlement)
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
              <div className="p-3 rounded-lg bg-slate-900/90 border border-slate-800">
                <span className="text-[10px] uppercase text-slate-500 block font-semibold">1. Differ Target</span>
                <p className="font-bold text-slate-200 mt-0.5">
                  Target Digit: <span className="font-mono text-rose-400 text-sm">≠ {selectedTargetDigit}</span>
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Bot executes contract predicting the next digit will NOT be {selectedTargetDigit}.
                </p>
              </div>

              <div className="p-3 rounded-lg bg-slate-900/90 border border-slate-800">
                <span className="text-[10px] uppercase text-slate-500 block font-semibold">2. Market Target</span>
                <p className="font-bold text-slate-200 mt-0.5">
                  Trading: <span className="font-mono text-emerald-400">{selectedMarket.name}</span>
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Continuous high-speed 1-tick pricing streamed via Deriv WebSocket.
                </p>
              </div>

              <div className="p-3 rounded-lg bg-slate-900/90 border border-slate-800">
                <span className="text-[10px] uppercase text-slate-500 block font-semibold">3. Win Condition</span>
                <p className="font-bold text-emerald-300 mt-0.5 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  Next Digit ≠ {selectedTargetDigit}
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Wins 9 out of 10 outcomes (~90.9% statistical win rate).
                </p>
              </div>
            </div>

            {/* Quick 1-Click Manual Differ Snipe Bar */}
            <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-rose-500/20">
              <div className="text-xs text-slate-300">
                Manual Snipe: <span className="text-slate-400">Want to fire an instant 1-tick Differ on {selectedMarket.shortName} right now?</span>
              </div>
              <button
                onClick={() => handleManualSnipe(selectedTargetDigit)}
                className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-rose-600 text-rose-300 hover:text-white font-bold text-xs border border-rose-500/40 transition-all flex items-center gap-1.5 shadow-md"
              >
                <Zap className="w-3.5 h-3.5" />
                <span>Instant 1-Click Differ ≠ {selectedTargetDigit} (${config.baseStake.toFixed(2)})</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ⚙️ TAB 2: CONFIGURATION & ADVANCED RISK CONTROLS */}
      {activeTab === 'CONFIG' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-5">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Sliders className="w-5 h-5 text-rose-400" />
              <span>Stakes, Martingale & Risk Management Controls</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Configure stake sizing, Martingale multiplier, Stop Loss, Take Profit, and Virtual Loss Filter.
            </p>
          </div>

          {/* Quick Stake Buttons */}
          <div>
            <label className="text-xs font-semibold text-slate-300 mb-2 block">Quick Base Stake Selection</label>
            <div className="flex flex-wrap items-center gap-2">
              {[0.35, 0.5, 1.0, 2.0, 5.0, 10.0, 25.0, 50.0].map((amt) => (
                <button
                  key={amt}
                  disabled={status.isRunning}
                  onClick={() => handleConfigChange({ baseStake: amt })}
                  className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold transition-all ${
                    config.baseStake === amt
                      ? 'bg-rose-600 text-white shadow-md shadow-rose-600/30'
                      : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
                  }`}
                >
                  ${amt.toFixed(2)}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-2 border-t border-slate-800">
            {/* Base Stake Input */}
            <div>
              <label className="text-xs font-semibold text-slate-300 mb-1 block">Base Stake (USD)</label>
              <div className="relative">
                <DollarSign className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="number"
                  step="0.1"
                  min="0.35"
                  value={config.baseStake}
                  disabled={status.isRunning}
                  onChange={(e) => handleConfigChange({ baseStake: Math.max(0.35, parseFloat(e.target.value) || 0.35) })}
                  className="w-full bg-slate-950 text-white font-mono font-bold text-sm rounded-xl pl-9 pr-3 py-2 border border-slate-800 focus:border-rose-500 focus:outline-none"
                />
              </div>
            </div>

            {/* Martingale Multiplier */}
            <div>
              <label className="text-xs font-semibold text-slate-300 mb-1 block">Martingale Multiplier (x)</label>
              <input
                type="number"
                step="0.5"
                min="2"
                max="25"
                value={config.martingaleMultiplier}
                disabled={status.isRunning}
                onChange={(e) =>
                  handleConfigChange({ martingaleMultiplier: Math.max(2, parseFloat(e.target.value) || 11.0) })
                }
                className="w-full bg-slate-950 text-white font-mono font-bold text-sm rounded-xl px-3 py-2 border border-slate-800 focus:border-rose-500 focus:outline-none"
              />
            </div>

            {/* Max Martingale Steps */}
            <div>
              <label className="text-xs font-semibold text-slate-300 mb-1 block">Max Martingale Steps</label>
              <input
                type="number"
                min="0"
                max="5"
                value={config.maxMartingaleSteps}
                disabled={status.isRunning}
                onChange={(e) => handleConfigChange({ maxMartingaleSteps: Math.max(0, parseInt(e.target.value) || 2) })}
                className="w-full bg-slate-950 text-white font-mono font-bold text-sm rounded-xl px-3 py-2 border border-slate-800 focus:border-rose-500 focus:outline-none"
              />
            </div>

            {/* Max Consecutive Losses Breaker */}
            <div>
              <label className="text-xs font-semibold text-slate-300 mb-1 block">Max Consecutive Losses Stop</label>
              <input
                type="number"
                min="1"
                max="10"
                value={config.maxConsecutiveLosses}
                disabled={status.isRunning}
                onChange={(e) =>
                  handleConfigChange({ maxConsecutiveLosses: Math.max(1, parseInt(e.target.value) || 3) })
                }
                className="w-full bg-slate-950 text-white font-mono font-bold text-sm rounded-xl px-3 py-2 border border-slate-800 focus:border-rose-500 focus:outline-none"
              />
            </div>

            {/* Take Profit */}
            <div>
              <label className="text-xs font-semibold text-slate-300 mb-1 block">Take Profit Limit ($)</label>
              <input
                type="number"
                min="1"
                step="1"
                value={config.takeProfit}
                disabled={status.isRunning}
                onChange={(e) => handleConfigChange({ takeProfit: Math.max(1, parseFloat(e.target.value) || 10) })}
                className="w-full bg-slate-950 text-white font-mono font-bold text-sm rounded-xl px-3 py-2 border border-slate-800 focus:border-rose-500 focus:outline-none"
              />
            </div>

            {/* Stop Loss */}
            <div>
              <label className="text-xs font-semibold text-slate-300 mb-1 block">Stop Loss Ceiling ($)</label>
              <input
                type="number"
                min="1"
                step="1"
                value={config.stopLoss}
                disabled={status.isRunning}
                onChange={(e) => handleConfigChange({ stopLoss: Math.max(1, parseFloat(e.target.value) || 50) })}
                className="w-full bg-slate-950 text-white font-mono font-bold text-sm rounded-xl px-3 py-2 border border-slate-800 focus:border-rose-500 focus:outline-none"
              />
            </div>

            {/* Inter-Trade Cooldown Delay */}
            <div>
              <label className="text-xs font-semibold text-slate-300 mb-1 block">Market Cooldown (Seconds)</label>
              <input
                type="number"
                min="0"
                max="60"
                value={config.marketCooldownSec ?? 0}
                disabled={status.isRunning}
                onChange={(e) =>
                  handleConfigChange({ marketCooldownSec: Math.max(0, parseInt(e.target.value) || 0) })
                }
                className="w-full bg-slate-950 text-white font-mono font-bold text-sm rounded-xl px-3 py-2 border border-slate-800 focus:border-rose-500 focus:outline-none"
              />
            </div>

            {/* Virtual Loss Filter (Demo-to-Real Protection) */}
            <div className="flex flex-col justify-center space-y-2 col-span-1 sm:col-span-2">
              <label className="text-xs font-semibold text-slate-300 block flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <FlaskConical className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Virtual Mode (1-Loss Demo ➔ Real Switch)</span>
                </span>
                <span className="text-[10px] text-cyan-400 font-mono">Demo ➔ Real ➔ Demo</span>
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  disabled={status.isRunning}
                  onClick={() => {
                    const nextVal = !config.virtualLossFilterEnabled;
                    handleConfigChange({ virtualLossFilterEnabled: nextVal });
                    systemAutoEngine.setVirtualLossFilter(nextVal);
                  }}
                  className={`flex items-center justify-between p-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                    config.virtualLossFilterEnabled
                      ? 'bg-cyan-950/50 border-cyan-400 text-cyan-300 ring-1 ring-cyan-400/50'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  <span className="flex items-center gap-1.5">
                    <FlaskConical className="w-4 h-4" />
                    <span>{config.virtualLossFilterEnabled ? '🛡️ Virtual Mode ACTIVE' : '⚪ Virtual Mode OFF (Direct Real)'}</span>
                  </span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-900 border border-slate-800">
                    {config.virtualLossFilterEnabled ? 'Active' : 'Off'}
                  </span>
                </button>

                {/* Demo Stake setting */}
                <div className="flex items-center gap-2 bg-slate-950 p-1.5 rounded-xl border border-slate-800">
                  <span className="text-xs text-slate-400 font-semibold px-1 shrink-0">Demo Stake:</span>
                  <div className="flex items-center gap-1 flex-1">
                    {[0.35, 0.50, 1.00, 2.00].map((stk) => (
                      <button
                        key={stk}
                        type="button"
                        disabled={status.isRunning}
                        onClick={() => {
                          systemAutoEngine.setVirtualDemoStake(stk);
                          handleConfigChange({ virtualDemoStake: stk });
                        }}
                        className={`px-2 py-1 rounded-lg text-xs font-bold transition-all ${
                          (config.virtualDemoStake || 1.00) === stk
                            ? 'bg-cyan-500 text-slate-950 font-black'
                            : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                        }`}
                      >
                        ${stk}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <p className="text-[11px] text-slate-400">
                When Virtual Mode is active, the bot starts trading in Demo mode. Once 1 loss occurs, it absorbs the loss risk-free and switches the next contract to your Real Account. Upon winning on the Real Account, it automatically returns back to Virtual Mode.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 📜 TAB 3: TRADE AUDIT LOGS */}
      {activeTab === 'LOGS' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Clock className="w-5 h-5 text-rose-400" />
              <span>Digit Select Differ Trade Execution Stream ({differTrades.length})</span>
            </h3>
            {differTrades.length > 0 && (
              <button
                onClick={handleResetStats}
                className="text-xs text-slate-400 hover:text-rose-400 flex items-center gap-1 transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Clear Logs</span>
              </button>
            )}
          </div>

          {differTrades.length === 0 ? (
            <div className="py-12 text-center text-slate-500 text-xs">
              No Digit Select Differ trades placed yet. Click RUN BOT above to begin execution.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950 text-slate-400 uppercase font-semibold border-b border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Time</th>
                    <th className="py-3 px-4">Account Mode</th>
                    <th className="py-3 px-4">Market</th>
                    <th className="py-3 px-4 text-center">Target Differ</th>
                    <th className="py-3 px-4 text-center">Exit Digit</th>
                    <th className="py-3 px-4">Stake</th>
                    <th className="py-3 px-4 text-right">Profit / Loss</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono">
                  {differTrades.map((t) => {
                    const isWin = t.result === 'WIN';
                    const isOpen = t.result === 'OPEN';

                    return (
                      <tr key={t.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="py-3 px-4 text-slate-400 font-sans">{t.timeString}</td>
                        <td className="py-3 px-4 font-sans">
                          {t.isVirtual ? (
                            <div className="flex flex-col">
                              <span className="px-2 py-0.5 rounded text-[10px] font-black font-mono bg-cyan-950 text-cyan-300 border border-cyan-500/40 w-fit">
                                🧪 VIRTUAL (DEMO)
                              </span>
                              {!isWin && !isOpen && (
                                <span className="text-[9px] text-amber-400 font-bold mt-0.5 flex items-center gap-1 font-sans">
                                  <ArrowRight className="w-2.5 h-2.5" /> 1st Loss! Switched to Real
                                </span>
                              )}
                            </div>
                          ) : (
                            <div className="flex flex-col">
                              <span className="px-2 py-0.5 rounded text-[10px] font-black font-mono bg-amber-950 text-amber-300 border border-amber-500/40 w-fit">
                                🔥 REAL ACCOUNT
                              </span>
                              {isWin && !isOpen && config.virtualLossFilterEnabled && (
                                <span className="text-[9px] text-emerald-400 font-bold mt-0.5 flex items-center gap-1 font-sans">
                                  <ArrowRight className="w-2.5 h-2.5" /> Won! Back to Virtual
                                </span>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-4 font-bold font-sans text-white">{t.marketName}</td>
                        <td className="py-3 px-4 text-center">
                          <span className="inline-block px-2.5 py-0.5 rounded font-black bg-rose-500/20 text-rose-300 border border-rose-500/40">
                            ≠ {t.differDigit !== undefined ? t.differDigit : selectedTargetDigit}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          {isOpen ? (
                            <span className="text-amber-400 animate-pulse font-sans">Running...</span>
                          ) : (
                            <span
                              className={`inline-block px-2.5 py-0.5 rounded font-black ${
                                isWin
                                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                                  : 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
                              }`}
                            >
                              Digit {t.exitDigit ?? '--'}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-slate-300">${t.stake.toFixed(2)}</td>
                        <td
                          className={`py-3 px-4 text-right font-black ${
                            isOpen ? 'text-amber-400' : isWin ? 'text-emerald-400' : 'text-rose-400'
                          }`}
                        >
                          {isOpen ? 'Pending' : `${t.profit >= 0 ? '+' : ''}$${t.profit.toFixed(2)}`}
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
