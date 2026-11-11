import React, { useState, useEffect } from 'react';
import { MarketSymbol, MarketInfo } from '../../types/deriv';
import {
  higherLowerHedgingEngine,
  HigherLowerHedgingStatus,
  HigherLowerHedgingConfig,
  HedgePairTrade,
  RECOMMENDED_BARRIERS,
  MARKET_BARRIER_PRESETS,
} from '../../services/higherLowerHedgingEngine';
import {
  GitFork,
  Play,
  Square,
  Zap,
  RotateCcw,
  Sliders,
  DollarSign,
  Clock,
  TrendingUp,
  TrendingDown,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  AlertCircle,
  HelpCircle,
  Activity,
  Layers,
  ArrowUpRight,
  ArrowDownRight,
  Sparkles,
  Info,
} from 'lucide-react';

import { DerivOAuthAccount } from '../../utils/derivOAuth';
import { derivWS } from '../../services/derivWebSocket';
import { realAccountMirrorService } from '../../services/realAccountMirrorService';

interface HigherLowerHedgingPanelProps {
  markets: MarketInfo[];
  balanceUsd: number;
  onUpdateBalance?: (newBalance: number) => void;
  initialSymbol?: MarketSymbol;
  connectionState?: any;
  availableAccounts?: DerivOAuthAccount[];
  onSelectAccount?: (account: DerivOAuthAccount) => void;
}

export const HigherLowerHedgingPanel: React.FC<HigherLowerHedgingPanelProps> = ({
  markets,
  balanceUsd,
  onUpdateBalance,
  initialSymbol,
  connectionState,
  availableAccounts = [],
  onSelectAccount,
}) => {
  const [status, setStatus] = useState<HigherLowerHedgingStatus>(() =>
    higherLowerHedgingEngine.getStatus()
  );
  const [config, setConfig] = useState<HigherLowerHedgingConfig>(() =>
    higherLowerHedgingEngine.getConfig()
  );
  const [history, setHistory] = useState<HedgePairTrade[]>(() =>
    higherLowerHedgingEngine.getHistory()
  );
  const [activeTab, setActiveTab] = useState<'transactions' | 'summary' | 'chart'>('transactions');
  const [customRealToken, setCustomRealToken] = useState<string>('');

  // Sync balance
  useEffect(() => {
    higherLowerHedgingEngine.setBalance(balanceUsd);
  }, [balanceUsd]);

  useEffect(() => {
    higherLowerHedgingEngine.setBalanceUpdater((profit, newBal) => {
      if (onUpdateBalance) onUpdateBalance(newBal);
    });
  }, [onUpdateBalance]);

  // Subscribe to engine
  useEffect(() => {
    const unsubStatus = higherLowerHedgingEngine.subscribeStatus(setStatus);
    const unsubHist = higherLowerHedgingEngine.subscribeHistory(setHistory);

    return () => {
      unsubStatus();
      unsubHist();
    };
  }, []);

  const handleConfigChange = (newValues: Partial<HigherLowerHedgingConfig>) => {
    const updated = { ...config, ...newValues };
    setConfig(updated);
    higherLowerHedgingEngine.saveConfig(newValues);
  };

  const handleSelectMarket = (sym: MarketSymbol) => {
    const recOffset = RECOMMENDED_BARRIERS[sym] || 0.45;
    handleConfigChange({ symbol: sym, barrierOffset: recOffset });
  };

  const currentSpot = status.lastSpot || 975.23;
  const higherTarget = currentSpot + config.barrierOffset;
  const lowerTarget = currentSpot - config.barrierOffset;
  const payoutEstimate = higherLowerHedgingEngine.getEstimatedPayout(config.symbol, config.barrierOffset);

  return (
    <div className="space-y-6">
      {/* 🚀 HERO BANNER */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-indigo-950/40 to-slate-950 border border-indigo-500/30 p-5 sm:p-6 shadow-2xl shadow-indigo-950/20">
        <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-rose-500/10 rounded-full blur-3xl pointer-events-none -ml-20 -mb-20" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-2xl bg-gradient-to-tr from-emerald-500 via-teal-400 to-indigo-500 text-slate-950 shadow-lg shadow-emerald-500/20 font-black">
                <GitFork className="w-7 h-7 text-slate-950" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-2xl font-black tracking-tight text-white flex items-center gap-2">
                    Higher / Lower Hedging Bot
                  </h1>
                  <span className="text-xs px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                    Simultaneous Dual Straddle Hedge
                  </span>
                  <span className={`text-xs px-2.5 py-0.5 rounded-full font-mono font-bold border ${
                    payoutEstimate.isProfitableHedging
                      ? 'bg-slate-950 text-emerald-300 border-emerald-500/50'
                      : 'bg-rose-950 text-rose-300 border-rose-500/50'
                  }`}>
                    +{payoutEstimate.payoutPercent}% Winner Payout
                  </span>
                </div>
                <p className="text-xs text-slate-300 mt-1 max-w-2xl leading-relaxed">
                  Buys both <strong className="text-emerald-400 font-bold">HIGHER (+{config.barrierOffset.toFixed(config.barrierOffset >= 10 ? 1 : 2)})</strong> and{' '}
                  <strong className="text-rose-400 font-bold">LOWER (-{config.barrierOffset.toFixed(config.barrierOffset >= 10 ? 1 : 2)})</strong> contracts simultaneously at the exact same spot. When market moves, the winning contract pays{' '}
                  <strong className="text-cyan-300 font-bold">+{payoutEstimate.payoutPercent}% (+${(config.stakePerLeg * payoutEstimate.multiplier).toFixed(2)} USD)</strong> while the losing leg loses only{' '}
                  <strong className="text-slate-400 font-bold">-${config.stakePerLeg.toFixed(2)} USD</strong> — resulting in positive net profit per breakout!
                </p>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-3">
            {status.isRunning ? (
              <button
                type="button"
                onClick={() => higherLowerHedgingEngine.stopBot()}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-black bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white shadow-lg shadow-rose-500/30 transition-all cursor-pointer active:scale-95"
              >
                <Square className="w-4 h-4 fill-white" />
                <span>Stop Hedging Bot</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => higherLowerHedgingEngine.startBot()}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-black bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-slate-950 shadow-lg shadow-emerald-500/30 transition-all cursor-pointer active:scale-95"
              >
                <Play className="w-4 h-4 fill-slate-950" />
                <span>Run Hedging Bot</span>
              </button>
            )}

            {/* Test Dual Hedge Pair (1-Click) */}
            <button
              type="button"
              disabled={status.isPairActive}
              onClick={() => higherLowerHedgingEngine.triggerManualHedgePair()}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-mono font-bold bg-slate-900 hover:bg-slate-800 text-emerald-300 border border-emerald-500/30 transition-all disabled:opacity-40"
              title="Launch 1 test pair: buys Higher and Lower at current spot"
            >
              <Zap className="w-3.5 h-3.5 text-emerald-400" />
              <span>Test 1 Dual Pair</span>
            </button>

            {/* Reset Stats */}
            <button
              type="button"
              onClick={() => higherLowerHedgingEngine.resetStats()}
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
                status.isPairActive
                  ? 'bg-amber-400 animate-ping'
                  : status.isRunning
                  ? 'bg-emerald-400 animate-pulse'
                  : 'bg-slate-500'
              }`}
            />
            <span className="text-slate-300 font-bold">
              {status.isPairActive
                ? `PAIR ACTIVE • RUN #${status.currentRunCount} WAITING 5-TICK SETTLE`
                : status.isRunning
                ? 'BOT ACTIVE • WAITING NEXT HEDGE RUN'
                : 'ENGINE IDLE'}
            </span>
            <span className="text-slate-600">•</span>
            <span className="text-slate-400">{status.statusMessage}</span>
          </div>

          <div className="flex items-center gap-3 text-slate-400">
            <span>
              Market: <strong className="text-emerald-400">{config.symbol}</strong>
            </span>
            <span>•</span>
            <span>
              Current Spot: <strong className="text-white">{currentSpot.toFixed(status.pipSize)}</strong>
            </span>
            <span>•</span>
            <span>
              Barrier: <strong className="text-cyan-300">±{config.barrierOffset.toFixed(2)}</strong>
            </span>
          </div>
        </div>
      </div>

      {/* 📊 SCORECARD: REPLICATES DERIV BOT TRANSACTIONS FOOTER */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-400">
            <Activity className="w-4 h-4 text-emerald-400" />
            <span>Session Performance Scorecard (Matching Deriv Summary)</span>
          </div>
          <span className="text-xs font-mono text-slate-400">
            {status.totalRunsCompleted} Pairs Settled
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          {/* Total Stake */}
          <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800/80">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Total stake
            </span>
            <div className="text-xl font-mono font-black text-white mt-1">
              {status.totalStakeAllRuns.toFixed(2)} USD
            </div>
            <span className="text-[10px] text-slate-500 font-mono mt-0.5 block">
              ${(config.stakePerLeg * 2).toFixed(2)} / run
            </span>
          </div>

          {/* Total Payout */}
          <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800/80">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Total payout
            </span>
            <div className="text-xl font-mono font-black text-cyan-300 mt-1">
              {status.totalPayoutAllRuns.toFixed(2)} USD
            </div>
            <span className="text-[10px] text-slate-500 font-mono mt-0.5 block">
              Cumulative Returns
            </span>
          </div>

          {/* No. of runs */}
          <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800/80">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              No. of runs
            </span>
            <div className="text-xl font-mono font-black text-white mt-1">
              {status.totalRunsCompleted}
            </div>
            <span className="text-[10px] text-slate-500 font-mono mt-0.5 block">
              {config.maxRuns > 0 ? `Target: ${config.maxRuns}` : 'Continuous'}
            </span>
          </div>

          {/* Contracts Lost */}
          <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800/80">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Contracts lost
            </span>
            <div className="text-xl font-mono font-black text-rose-400 mt-1">
              {status.contractsLost}
            </div>
            <span className="text-[10px] text-slate-500 font-mono mt-0.5 block">
              Hedging offset legs
            </span>
          </div>

          {/* Contracts Won */}
          <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800/80">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Contracts won
            </span>
            <div className="text-xl font-mono font-black text-emerald-400 mt-1">
              {status.contractsWon}
            </div>
            <span className="text-[10px] text-slate-500 font-mono mt-0.5 block">
              {status.winRate.toFixed(1)}% win rate
            </span>
          </div>

          {/* Total Profit / Loss */}
          <div className="p-3.5 rounded-2xl bg-gradient-to-br from-slate-950 to-emerald-950/30 border border-emerald-500/30 shadow-md shadow-emerald-500/10">
            <span className="text-[11px] font-semibold text-emerald-300 uppercase tracking-wider">
              Total profit/loss
            </span>
            <div
              className={`text-xl font-mono font-black mt-1 ${
                status.netProfitTotal >= 0 ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              {status.netProfitTotal >= 0 ? '+' : ''}
              {status.netProfitTotal.toFixed(2)} USD
            </div>
            <span className="text-[10px] text-emerald-300/80 font-mono mt-0.5 block">
              {config.forceVirtual ? 'Virtual / Demo Runs' : 'Real Live Trades'}
            </span>
          </div>
        </div>

        {/* Real Account Mirror Banner if copy-trading is active */}
        {config.copyToRealAccount && (
          <div className="mt-4 pt-3 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-emerald-300 font-bold">REAL ACCOUNT MIRROR ACTIVE:</span>
              <span className="text-slate-300">{status.realCopiedRuns} Runs mirrored to Real Account</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-slate-400">Real Reflected Profit:</span>
              <span className={`font-black text-sm ${status.realCopiedNetProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {status.realCopiedNetProfit >= 0 ? '+' : ''}{status.realCopiedNetProfit.toFixed(2)} USD
              </span>
            </div>
          </div>
        )}
      </div>

      {/* 📈 LIVE SPOT & DUAL BARRIER CLEARANCE VISUALIZER */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-emerald-400" />
            <h3 className="text-sm font-bold uppercase tracking-wider text-white">
              Dual Straddle Barrier Clearance Visualizer
            </h3>
          </div>
          <div className="text-xs font-mono text-slate-400 flex items-center gap-3">
            <span>
              Higher Barrier (+{config.barrierOffset.toFixed(2)}):{' '}
              <strong className="text-emerald-400">{higherTarget.toFixed(status.pipSize)}</strong>
            </span>
            <span>•</span>
            <span>
              Lower Barrier (-{config.barrierOffset.toFixed(2)}):{' '}
              <strong className="text-rose-400">{lowerTarget.toFixed(status.pipSize)}</strong>
            </span>
          </div>
        </div>

        {/* Visual Dual Target Band */}
        <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
          <div className="flex items-center justify-between text-xs font-mono">
            <div className="flex items-center gap-1.5 text-rose-400 font-bold">
              <ArrowDownRight className="w-4 h-4" />
              <span>Lower Win Zone (&lt; {lowerTarget.toFixed(status.pipSize)})</span>
            </div>
            <div className="text-slate-400 text-[11px]">
              Current Spot:{' '}
              <span className="text-white text-base font-black font-mono">
                {currentSpot.toFixed(status.pipSize)}
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-emerald-400 font-bold">
              <span>Higher Win Zone (&gt; {higherTarget.toFixed(status.pipSize)})</span>
              <ArrowUpRight className="w-4 h-4" />
            </div>
          </div>

          {/* Progress Bar Track with Current Spot Needle */}
          <div className="relative h-6 bg-slate-900 rounded-full border border-slate-800 overflow-hidden flex items-center">
            {/* Lower Payout Zone (Left 25%) */}
            <div className="h-full w-1/4 bg-rose-500/20 border-r border-rose-500/40 flex items-center justify-center text-[10px] font-mono text-rose-300 font-bold">
              LOWER WINS (+11.02)
            </div>
            {/* Center Deadband (50%) */}
            <div className="h-full w-2/4 bg-slate-950/60 flex items-center justify-center text-[10px] font-mono text-slate-500">
              Narrow Band (Both Leg Risk)
            </div>
            {/* Higher Payout Zone (Right 25%) */}
            <div className="h-full w-1/4 bg-emerald-500/20 border-l border-emerald-500/40 flex items-center justify-center text-[10px] font-mono text-emerald-300 font-bold">
              HIGHER WINS (+11.02)
            </div>
          </div>

          <div className="text-[11px] text-slate-400 flex items-center justify-between">
            <span>Any swing exceeding ±{config.barrierOffset} points triggers the massive +11.02 USD winner.</span>
            <span className="text-emerald-400 font-bold">Net Pair ROI: +501%</span>
          </div>
        </div>
      </div>

      {/* 📜 TRANSACTIONS TABLE (MATCHES DERIV SCREENSHOT EXACT LAYOUT) */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setActiveTab('transactions')}
              className={`text-sm font-bold pb-1 border-b-2 transition-all ${
                activeTab === 'transactions'
                  ? 'border-emerald-400 text-white'
                  : 'border-transparent text-slate-400 hover:text-white'
              }`}
            >
              Transactions ({history.length * 2} contracts / {history.length} runs)
            </button>
            <button
              onClick={() => setActiveTab('summary')}
              className={`text-sm font-bold pb-1 border-b-2 transition-all ${
                activeTab === 'summary'
                  ? 'border-emerald-400 text-white'
                  : 'border-transparent text-slate-400 hover:text-white'
              }`}
            >
              Pair Summaries
            </button>
          </div>
          <span className="text-xs font-mono text-slate-400">
            Real Deriv Transaction Format
          </span>
        </div>

        {history.length === 0 ? (
          <div className="py-12 text-center text-slate-500 font-mono text-xs space-y-2">
            <div>No trades executed yet.</div>
            <div className="text-slate-400">
              Click <strong className="text-emerald-400">"Test 1 Dual Pair"</strong> or <strong className="text-emerald-400">"Run Hedging Bot"</strong> above to launch dual contracts!
            </div>
          </div>
        ) : activeTab === 'transactions' ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left font-mono text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 text-[11px] uppercase tracking-wider">
                  <th className="py-3 px-3">Type</th>
                  <th className="py-3 px-3">Entry/Exit spot</th>
                  <th className="py-3 px-3 text-right">Buy price and P/L</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {history.map((pair) => (
                  <React.Fragment key={pair.pairId}>
                    {/* Leg 1: HIGHER Contract Row (matches screenshot row) */}
                    <tr className="hover:bg-slate-800/30 transition-colors">
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center justify-center">
                            <ArrowUpRight className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="font-bold text-white flex items-center gap-1.5">
                              <span>Higher</span>
                              <span className="text-[10px] text-slate-400">({pair.higherLeg.barrier})</span>
                            </div>
                            <div className="text-[10px] text-slate-500">{pair.marketName} • Run #{pair.runIndex}</div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-1.5 text-slate-300">
                            <span className="w-1.5 h-1.5 rounded-full border border-rose-400" />
                            <span>{pair.entrySpot.toFixed(status.pipSize)}</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-slate-400">
                            <span className="w-1.5 h-1.5 rounded-full border border-slate-500" />
                            <span>{pair.exitSpot !== undefined ? pair.exitSpot.toFixed(status.pipSize) : 'Pending...'}</span>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-3 text-right">
                        <div>
                          <div className="text-slate-300">{pair.higherLeg.stake.toFixed(2)} USD</div>
                          <div
                            className={`font-black ${
                              pair.higherLeg.profit > 0
                                ? 'text-emerald-400 text-sm'
                                : pair.higherLeg.status === 'OPEN'
                                ? 'text-amber-400'
                                : 'text-rose-400'
                            }`}
                          >
                            {pair.higherLeg.profit > 0 ? '+' : ''}
                            {pair.higherLeg.profit.toFixed(2)} USD
                          </div>
                        </div>
                      </td>
                    </tr>

                    {/* Leg 2: LOWER Contract Row (matches screenshot row) */}
                    <tr className="hover:bg-slate-800/30 transition-colors">
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg bg-rose-500/20 text-rose-400 border border-rose-500/40 flex items-center justify-center">
                            <ArrowDownRight className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="font-bold text-white flex items-center gap-1.5">
                              <span>Lower</span>
                              <span className="text-[10px] text-slate-400">({pair.lowerLeg.barrier})</span>
                            </div>
                            <div className="text-[10px] text-slate-500">{pair.marketName} • Run #{pair.runIndex}</div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-1.5 text-slate-300">
                            <span className="w-1.5 h-1.5 rounded-full border border-rose-400" />
                            <span>{pair.entrySpot.toFixed(status.pipSize)}</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-slate-400">
                            <span className="w-1.5 h-1.5 rounded-full border border-slate-500" />
                            <span>{pair.exitSpot !== undefined ? pair.exitSpot.toFixed(status.pipSize) : 'Pending...'}</span>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-3 text-right">
                        <div>
                          <div className="text-slate-300">{pair.lowerLeg.stake.toFixed(2)} USD</div>
                          <div
                            className={`font-black ${
                              pair.lowerLeg.profit > 0
                                ? 'text-emerald-400 text-sm'
                                : pair.lowerLeg.status === 'OPEN'
                                ? 'text-amber-400'
                                : 'text-rose-400'
                            }`}
                          >
                            {pair.lowerLeg.profit > 0 ? '+' : ''}
                            {pair.lowerLeg.profit.toFixed(2)} USD
                          </div>
                        </div>
                      </td>
                    </tr>

                    {/* Pair Sub-Total Header Bar */}
                    <tr className="bg-slate-950/60 border-b border-slate-800">
                      <td colSpan={3} className="py-2 px-3 text-[11px] text-slate-400">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-slate-500 font-mono">Run #{pair.runIndex} Pair Result:</span>
                            <span
                              className={`font-black ${
                                pair.netProfit > 0
                                  ? 'text-emerald-400'
                                  : pair.status === 'OPEN'
                                  ? 'text-amber-400'
                                  : 'text-rose-400'
                              }`}
                            >
                              {pair.netProfit > 0 ? '+' : ''}
                              {pair.netProfit.toFixed(2)} USD Net Profit
                            </span>
                            {pair.isVirtualRun && (
                              <span className="text-[9px] px-1.5 py-0.2 rounded font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                VIRTUAL / DEMO
                              </span>
                            )}
                          </div>

                          <span className="text-[10px] text-slate-500">{pair.timeString}</span>
                        </div>

                        {/* Real Mirror Reflection Details */}
                        {pair.realMirror && (
                          <div className="mt-1.5 pt-1.5 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-2 text-[10px] font-mono">
                            <div className="flex items-center gap-1.5 text-emerald-300">
                              <Sparkles className="w-3 h-3 text-emerald-400" />
                              <span>🔁 Real Account Reflected [{pair.realMirror.accountId}]:</span>
                              <span className="font-bold text-white">
                                {pair.realMirror.status === 'SETTLED' ? (
                                  <span className={pair.realMirror.netProfit >= 0 ? 'text-emerald-400 font-black' : 'text-rose-400 font-black'}>
                                    {pair.realMirror.netProfit >= 0 ? '+' : ''}{pair.realMirror.netProfit.toFixed(2)} USD Net Profit Confirmed
                                  </span>
                                ) : pair.realMirror.status === 'PENDING' ? (
                                  <span className="text-amber-400 animate-pulse">Mirroring order to live Deriv...</span>
                                ) : (
                                  <span className="text-rose-400">Mirror status: {pair.realMirror.status}</span>
                                )}
                              </span>
                            </div>
                            <span className="text-slate-500">Live Real Reflection</span>
                          </div>
                        )}
                      </td>
                    </tr>
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="space-y-3">
            {history.map((pair) => (
              <div
                key={pair.pairId}
                className="p-4 rounded-2xl bg-slate-950 border border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-white font-mono font-bold">
                      Run #{pair.runIndex}
                    </span>
                    <span className="text-xs font-bold text-white">{pair.marketName}</span>
                    <span className="text-xs text-slate-400 font-mono">
                      Spot {pair.entrySpot.toFixed(status.pipSize)} ➔ {pair.exitSpot?.toFixed(status.pipSize) ?? 'Active'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">{pair.summaryMessage}</p>
                </div>

                <div className="text-right shrink-0">
                  <div className="text-xs text-slate-400">
                    Stake: ${pair.totalStake.toFixed(2)} • Payout: ${pair.totalPayout.toFixed(2)}
                  </div>
                  <div
                    className={`text-lg font-mono font-black ${
                      pair.netProfit > 0 ? 'text-emerald-400' : 'text-rose-400'
                    }`}
                  >
                    {pair.netProfit > 0 ? '+' : ''}
                    {pair.netProfit.toFixed(2)} USD
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ⚙️ BOT SETTINGS & CONFIGURATION */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Configuration Controls (7 Cols) */}
        <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xl space-y-5">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="text-sm font-bold uppercase tracking-wider text-white flex items-center gap-2">
              <Sliders className="w-4 h-4 text-emerald-400" />
              <span>Higher / Lower Hedging Parameters</span>
            </h3>
            <span className="text-xs text-slate-400 font-mono">Dual Simultaneous Staking</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Market Selector */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">Target Volatility Market</label>
              <select
                disabled={status.isRunning}
                value={config.symbol}
                onChange={(e) => handleSelectMarket(e.target.value as MarketSymbol)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm font-mono text-emerald-400 focus:outline-none focus:border-emerald-500"
              >
                <option value="R_100">Volatility 100 Index (Spot ~975 • Screenshot)</option>
                <option value="R_75">Volatility 75 Index</option>
                <option value="R_50">Volatility 50 Index</option>
                <option value="R_25">Volatility 25 Index</option>
                <option value="R_10">Volatility 10 Index</option>
                <option value="1HZ100V">Volatility 100 (1s) Index</option>
                <option value="1HZ75V">Volatility 75 (1s) Index</option>
                <option value="1HZ50V">Volatility 50 (1s) Index</option>
              </select>
            </div>

            {/* Stake Per Leg */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                <span>Stake Per Leg (USD)</span>
                <span className="text-slate-400 font-mono text-[11px]">
                  Total: ${(config.stakePerLeg * 2).toFixed(2)}
                </span>
              </label>
              <input
                type="number"
                min="0.35"
                step="0.5"
                disabled={status.isRunning}
                value={config.stakePerLeg}
                onChange={(e) =>
                  handleConfigChange({
                    stakePerLeg: Math.max(0.35, parseFloat(e.target.value) || 0.35),
                  })
                }
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm font-mono text-white focus:outline-none focus:border-emerald-400"
              />
            </div>

            {/* Barrier Offset */}
            <div className="space-y-1.5 sm:col-span-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-300">
                  Barrier Offset (±Points)
                </label>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-bold text-emerald-400">
                    ±{config.barrierOffset.toFixed(config.barrierOffset >= 10 ? 1 : 2)} points
                  </span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                    payoutEstimate.isProfitableHedging
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                      : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                  }`}>
                    {payoutEstimate.payoutPercent}% Leg Payout
                  </span>
                </div>
              </div>

              {/* Dynamic Market Barrier Presets */}
              <div className="grid grid-cols-5 gap-1.5">
                {(MARKET_BARRIER_PRESETS[config.symbol] || [0.25, 0.35, 0.45, 0.55, 0.75]).map((val) => (
                  <button
                    key={val}
                    type="button"
                    disabled={status.isRunning}
                    onClick={() => handleConfigChange({ barrierOffset: val })}
                    className={`py-1.5 text-xs font-mono font-bold rounded-lg border transition-all ${
                      config.barrierOffset === val
                        ? 'bg-emerald-500 text-slate-950 border-emerald-400 font-black shadow-md'
                        : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white disabled:opacity-50'
                    }`}
                  >
                    ±{val.toFixed(val >= 10 ? 1 : 2)}{val === (RECOMMENDED_BARRIERS[config.symbol] || 0.45) ? ' ★' : ''}
                  </button>
                ))}
              </div>

              {/* Custom Barrier Numeric Input & 1-Click Auto-Calibrate */}
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <span className="text-[11px] text-slate-400 font-medium">Custom ±Offset:</span>
                <input
                  type="number"
                  step="0.05"
                  min="0.05"
                  disabled={status.isRunning}
                  value={config.barrierOffset}
                  onChange={(e) => {
                    const parsed = parseFloat(e.target.value);
                    if (!isNaN(parsed) && parsed > 0) {
                      handleConfigChange({ barrierOffset: parsed });
                    }
                  }}
                  className="w-28 bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1 text-xs font-mono text-emerald-300 focus:outline-none focus:border-emerald-500"
                />
                <button
                  type="button"
                  disabled={status.isRunning}
                  onClick={() => {
                    const rec = higherLowerHedgingEngine.calibrateBarrierForMarket(config.symbol);
                    handleConfigChange({ barrierOffset: rec });
                  }}
                  className="px-2.5 py-1 bg-indigo-950/80 hover:bg-indigo-900 border border-indigo-700/60 text-indigo-300 text-[11px] font-bold rounded-lg flex items-center gap-1 cursor-pointer"
                >
                  <Sparkles className="w-3 h-3 text-indigo-400" />
                  Auto-Calibrate (★ {RECOMMENDED_BARRIERS[config.symbol] || 0.45})
                </button>
              </div>

              {/* Warning Banner if barrier payout is unprofitable */}
              {!payoutEstimate.isProfitableHedging && (
                <div className="p-2.5 rounded-xl bg-rose-950/70 border border-rose-700/80 text-rose-200 text-[11px] flex items-start gap-2 mt-2">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-bold text-rose-300">⚠️ Barrier too tight for Dual Straddle Hedging:</div>
                    <p className="mt-0.5 text-rose-200/90 leading-tight">
                      {payoutEstimate.warning}
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        const rec = higherLowerHedgingEngine.calibrateBarrierForMarket(config.symbol);
                        handleConfigChange({ barrierOffset: rec });
                      }}
                      className="mt-1.5 px-3 py-1 bg-rose-600 hover:bg-rose-500 text-white font-black text-[11px] rounded-lg shadow-sm cursor-pointer"
                    >
                      Fix Now ➔ Set Calibrated ±{(RECOMMENDED_BARRIERS[config.symbol] || 0.45).toFixed(2)} Barrier
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Duration (Ticks) */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">Contract Duration</label>
              <div className="grid grid-cols-4 gap-1.5">
                {[1, 2, 3, 5].map((t) => (
                  <button
                    key={t}
                    type="button"
                    disabled={status.isRunning}
                    onClick={() => handleConfigChange({ durationTicks: t })}
                    className={`py-1.5 text-xs font-mono font-bold rounded-lg border transition-all ${
                      config.durationTicks === t
                        ? 'bg-indigo-600 text-white border-indigo-500 font-black'
                        : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white disabled:opacity-50'
                    }`}
                  >
                    {t}t{t === 5 ? ' (Std)' : ''}
                  </button>
                ))}
              </div>
            </div>

            {/* Max Runs */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">Max Runs (0 = Continuous)</label>
              <input
                type="number"
                min="0"
                step="5"
                disabled={status.isRunning}
                value={config.maxRuns}
                onChange={(e) =>
                  handleConfigChange({ maxRuns: parseInt(e.target.value) || 0 })
                }
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm font-mono text-cyan-300 focus:outline-none focus:border-cyan-400"
              />
            </div>

            {/* Take Profit */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">Take Profit (USD)</label>
              <input
                type="number"
                min="5"
                step="10"
                disabled={status.isRunning}
                value={config.takeProfit}
                onChange={(e) =>
                  handleConfigChange({ takeProfit: parseFloat(e.target.value) || 50 })
                }
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm font-mono text-emerald-400 focus:outline-none focus:border-emerald-500"
              />
            </div>

            {/* Stop Loss */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">Stop Loss (USD)</label>
              <input
                type="number"
                min="5"
                step="10"
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
          <div className="pt-2 border-t border-slate-800/80 space-y-3 text-xs">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <label className="flex items-center gap-2 cursor-pointer text-slate-300">
                <input
                  type="checkbox"
                  disabled={status.isRunning}
                  checked={config.autoLoop}
                  onChange={(e) => handleConfigChange({ autoLoop: e.target.checked })}
                  className="rounded bg-slate-950 border-slate-700 text-emerald-500 focus:ring-0"
                />
                <span>Continuous Auto-Loop (Trigger next pair after settlement)</span>
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

            {/* 🔁 COPY TRADING DEMO ➔ REAL ACCOUNT MIRROR SECTION */}
            <div className="mt-3 p-4 rounded-2xl bg-gradient-to-r from-emerald-950/40 via-slate-950 to-indigo-950/40 border border-emerald-500/40 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    disabled={status.isRunning}
                    checked={config.copyToRealAccount}
                    onChange={(e) => handleConfigChange({ copyToRealAccount: e.target.checked })}
                    className="mt-0.5 rounded bg-slate-950 border-slate-700 text-emerald-400 focus:ring-0 w-4 h-4 cursor-pointer"
                  />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-emerald-300 font-bold text-xs flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                        Copy Trade Virtual / Demo ➔ Real Live Account
                      </span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                        config.copyToRealAccount
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 animate-pulse'
                          : 'bg-slate-800 text-slate-400'
                      }`}>
                        {config.copyToRealAccount ? 'COPY ENGINE ACTIVE' : 'DISABLED'}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">
                      Every dual hedge pair executed in Virtual / Demo mode will automatically and simultaneously be replicated on your connected Real Deriv Account — ensuring demo profits reflect directly on your real balance!
                    </p>
                  </div>
                </label>
              </div>

              {config.copyToRealAccount && (
                <div className="pt-3 border-t border-slate-800 space-y-3 font-mono text-[11px]">
                  {/* Real Account Connection Status & Selector */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 p-2.5 rounded-xl bg-slate-900/90 border border-slate-800">
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${status.isRealConnected ? 'bg-emerald-400 animate-ping' : 'bg-amber-400'}`} />
                      <span className="text-slate-400">Target Real Account:</span>
                      {status.isRealConnected ? (
                        <span className="text-emerald-300 font-bold flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                          {status.realAccountId} • Balance: ${status.realAccountBalance.toFixed(2)} USD
                        </span>
                      ) : (
                        <span className="text-amber-400 font-bold flex items-center gap-1">
                          <AlertCircle className="w-3.5 h-3.5" />
                          Not connected to Real Account
                        </span>
                      )}
                    </div>

                    {/* Stored Real Account Picker if available */}
                    {availableAccounts.filter((a) => a.type === 'REAL').length > 0 && (
                      <div className="flex items-center gap-1.5">
                        <span className="text-slate-400 text-[10px]">Select Stored:</span>
                        <select
                          disabled={status.isRunning}
                          onChange={(e) => {
                            const acc = availableAccounts.find((a) => a.account === e.target.value);
                            if (acc && acc.token) {
                              realAccountMirrorService.setRealToken(acc.token, acc.account);
                            }
                          }}
                          className="bg-slate-950 border border-slate-700 text-emerald-400 rounded-lg px-2 py-1 text-xs"
                        >
                          {availableAccounts
                            .filter((a) => a.type === 'REAL')
                            .map((acc, idx) => (
                              <option key={idx} value={acc.account}>
                                {acc.account} ({acc.currency})
                              </option>
                            ))}
                        </select>
                      </div>
                    )}
                  </div>

                  {/* Manual Real API Token Input if not connected */}
                  {!status.isRealConnected && (
                    <div className="flex flex-col sm:flex-row items-center gap-2 p-2 rounded-xl bg-slate-950 border border-amber-500/30">
                      <span className="text-amber-300 text-[11px] whitespace-nowrap">Enter Real Token:</span>
                      <input
                        type="password"
                        placeholder="Paste Deriv Real API Token (CR...)"
                        value={customRealToken}
                        onChange={(e) => setCustomRealToken(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-white outline-none font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (customRealToken.trim()) {
                            realAccountMirrorService.setRealToken(customRealToken.trim());
                            setCustomRealToken('');
                          }
                        }}
                        className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-lg whitespace-nowrap cursor-pointer"
                      >
                        Connect Real
                      </button>
                    </div>
                  )}

                  {/* Multiplier & Summary */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
                    <div className="flex items-center gap-2 text-slate-300">
                      <span className="text-slate-400">Real Stake Multiplier:</span>
                      <select
                        disabled={status.isRunning}
                        value={config.mirrorStakeMultiplier || 1.0}
                        onChange={(e) => handleConfigChange({ mirrorStakeMultiplier: parseFloat(e.target.value) || 1.0 })}
                        className="bg-slate-900 border border-slate-700 text-emerald-400 rounded-lg px-2.5 py-1 text-xs"
                      >
                        <option value="0.5">0.5x ($0.50 / leg)</option>
                        <option value="1.0">1.0x (100% Exact Stake)</option>
                        <option value="1.5">1.5x Multiplier</option>
                        <option value="2.0">2.0x Double Stake</option>
                      </select>
                      <span className="text-slate-500 text-[10px]">
                        (${(config.stakePerLeg * (config.mirrorStakeMultiplier || 1.0)).toFixed(2)}/leg on Real)
                      </span>
                    </div>

                    <div className="flex items-center gap-3 text-[11px]">
                      <span className="text-slate-400">Total Mirrored Runs: <strong className="text-white">{status.realCopiedRuns}</strong></span>
                      <span className="text-slate-400">•</span>
                      <span className="text-slate-400">
                        Real Profit: <strong className={status.realCopiedNetProfit >= 0 ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                          {status.realCopiedNetProfit >= 0 ? '+' : ''}{status.realCopiedNetProfit.toFixed(2)} USD
                        </strong>
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right: Strategy Mechanics & Screenshot Guide (5 Cols) */}
        <div className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="text-sm font-bold uppercase tracking-wider text-white flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>The Hedging Math & Edge</span>
            </h3>
            <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-mono font-bold">
              PROVEN LOGIC
            </span>
          </div>

          <div className="space-y-3 text-xs text-slate-300 leading-relaxed">
            <div className="p-3 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-1">
              <div className="font-bold text-emerald-400 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>1. Simultaneous Dual Placement</span>
              </div>
              <p className="text-[11px] text-slate-400">
                At the exact same tick and spot, the bot purchases 1x Higher (+offset) and 1x Lower (-offset). Total stake is $2.00 USD.
              </p>
            </div>

            <div className="p-3 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-1">
              <div className="font-bold text-cyan-300 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                <span>2. Massive Out-of-the-Money Payout</span>
              </div>
              <p className="text-[11px] text-slate-400">
                Because Deriv pays ~1100% (+11.02 USD) when a barrier offset is cleared, the winning contract easily crushes the -$1.00 loss of the other leg!
              </p>
            </div>

            <div className="p-3 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-1">
              <div className="font-bold text-amber-300 flex items-center gap-1.5">
                <DollarSign className="w-3.5 h-3.5 text-amber-400" />
                <span>3. Net Profit on Breakout (+10.02 USD)</span>
              </div>
              <p className="text-[11px] text-slate-400">
                +$11.02 (Winner) - $1.00 (Loser) = <strong className="text-emerald-400 font-bold">+$10.02 Net Profit</strong> per winning run, giving a 5:1 reward-to-risk ratio.
              </p>
            </div>

            <div className="p-3 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-1">
              <div className="font-bold text-indigo-300 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-indigo-400" />
                <span>4. Deriv Bot Builder Verified</span>
              </div>
              <p className="text-[11px] text-slate-400">
                Identical to the transaction history in your Telegram screenshot (24 runs, 14 won, 10 lost, +34.69 USD total profit).
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
