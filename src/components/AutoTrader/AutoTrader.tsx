import React, { useState, useEffect, useRef, useMemo } from 'react';
import { MarketInfo, MarketSymbol, ActiveContract, Tick } from '../../types/deriv';
import { derivWS, extractDerivLastDigit } from '../../services/derivWebSocket';
import { soundManager } from '../../utils/soundEffects';
import {
  Rocket,
  Shield,
  Target,
  Play,
  Square,
  AlertCircle,
  X,
  Activity,
  ArrowRight,
  RotateCcw
} from 'lucide-react';

export type AutoTraderMarketCategory =
  | 'OVER_UNDER'
  | 'MATCHES_DIFFERS'
  | 'EVEN_ODD'
  | 'RISE_FALL'
  | 'AUTO_LEAST_RISKY';

export type AutoTraderSpeed = 'FAST' | 'SLOW';

interface AutoTraderProps {
  markets: MarketInfo[];
  balanceUsd?: number;
  onUpdateBalance?: (balance: number) => void;
  onNavigateTab?: (tab: string) => void;
}

export const AutoTrader: React.FC<AutoTraderProps> = ({
  markets,
  balanceUsd = 10000.0,
  onUpdateBalance,
  onNavigateTab,
}) => {
  // Config state
  const [selectedCategory, setSelectedCategory] = useState<AutoTraderMarketCategory>('MATCHES_DIFFERS');
  const [speed, setSpeed] = useState<AutoTraderSpeed>('FAST');
  const [targetProfit, setTargetProfit] = useState<number>(50);
  const [isRunning, setIsRunning] = useState<boolean>(false);

  // Insufficient Balance Alert state
  const [insufficientBalanceAlert, setInsufficientBalanceAlert] = useState<string | null>(null);

  // Execution & Live Telemetry state
  const [activeMarketSymbol, setActiveMarketSymbol] = useState<MarketSymbol>('R_100');
  const [totalTicksReceived, setTotalTicksReceived] = useState<number>(156);
  const [selectedMarketLabel, setSelectedMarketLabel] = useState<string>('Differs 1');
  const [selectedMarketCoverage, setSelectedMarketCoverage] = useState<string>('Matches / Differs · 100% coverage');
  const [statusMessage, setStatusMessage] = useState<string>('Matches / Differs → Differs 1 · stake 0.35');
  const [, setStatusState] = useState<'IDLE' | 'ANALYZING' | 'EXECUTING' | 'TARGET_REACHED' | 'ERROR'>('IDLE');

  // Performance Statistics
  const [totalTrades, setTotalTrades] = useState<number>(0);
  const [sessionPnL, setSessionPnL] = useState<number>(0.0);
  const [activeContractId, setActiveContractId] = useState<string | null>(null);
  const [recentLogs, setRecentLogs] = useState<Array<{ id: string; text: string; time: string; type: 'win' | 'loss' | 'info' | 'trade' }>>([]);

  // Calculate dynamic stake: 5% of balance, min $0.35
  const stakePerTrade = useMemo(() => {
    const calculated = Math.round(balanceUsd * 0.05 * 100) / 100;
    return Math.max(0.35, calculated);
  }, [balanceUsd]);

  // Refs for background interval/ticks execution
  const isRunningRef = useRef<boolean>(isRunning);
  const speedRef = useRef<AutoTraderSpeed>(speed);
  const targetProfitRef = useRef<number>(targetProfit);
  const sessionPnLRef = useRef<number>(sessionPnL);
  const balanceUsdRef = useRef<number>(balanceUsd);
  const selectedCategoryRef = useRef<AutoTraderMarketCategory>(selectedCategory);
  const activeContractIdRef = useRef<string | null>(activeContractId);
  const lastExecutionTimeRef = useRef<number>(0);
  const ticksBufferRef = useRef<Record<string, number[]>>({});

  useEffect(() => {
    isRunningRef.current = isRunning;
  }, [isRunning]);
  useEffect(() => {
    speedRef.current = speed;
  }, [speed]);
  useEffect(() => {
    targetProfitRef.current = targetProfit;
  }, [targetProfit]);
  useEffect(() => {
    sessionPnLRef.current = sessionPnL;
  }, [sessionPnL]);
  useEffect(() => {
    balanceUsdRef.current = balanceUsd;
  }, [balanceUsd]);
  useEffect(() => {
    selectedCategoryRef.current = selectedCategory;
  }, [selectedCategory]);
  useEffect(() => {
    activeContractIdRef.current = activeContractId;
  }, [activeContractId]);

  // Update market summary label when category changes
  useEffect(() => {
    switch (selectedCategory) {
      case 'MATCHES_DIFFERS':
        setSelectedMarketLabel('Differs 1');
        setSelectedMarketCoverage('Matches / Differs · 100% coverage');
        break;
      case 'OVER_UNDER':
        setSelectedMarketLabel('Under 7');
        setSelectedMarketCoverage('Over / Under · 80% coverage');
        break;
      case 'EVEN_ODD':
        setSelectedMarketLabel('Even');
        setSelectedMarketCoverage('Even / Odd · 50% coverage');
        break;
      case 'RISE_FALL':
        setSelectedMarketLabel('Rise');
        setSelectedMarketCoverage('Rise / Fall · Momentum Edge');
        break;
      case 'AUTO_LEAST_RISKY':
        setSelectedMarketLabel('Differs 1');
        setSelectedMarketCoverage('Auto Scanner · Least-Risky 90%+ edge');
        break;
    }
  }, [selectedCategory]);

  // Logging helper
  const addLog = (text: string, type: 'win' | 'loss' | 'info' | 'trade' = 'info') => {
    const time = new Date().toLocaleTimeString();
    setRecentLogs((prev) => [{ id: Math.random().toString(), text, time, type }, ...prev.slice(0, 19)]);
  };

  // Subscribe to live contract updates
  useEffect(() => {
    const handleContractUpdate = (contract: ActiveContract) => {
      if (activeContractIdRef.current && activeContractIdRef.current === contract.id) {
        if (contract.status === 'WON' || contract.status === 'LOST') {
          setActiveContractId(null);
          activeContractIdRef.current = null;

          const isWin = contract.status === 'WON';
          const profit = contract.currentProfit || 0;

          setTotalTrades((t) => t + 1);
          if (isWin) {
            soundManager.playWinSound();
            addLog(`✅ WIN on ${contract.symbolName || contract.symbol}: +$${profit.toFixed(2)}`, 'win');
          } else {
            soundManager.playLossSound();
            addLog(`❌ LOSS on ${contract.symbolName || contract.symbol}: -$${Math.abs(profit).toFixed(2)}`, 'loss');
          }

          const updatedPnL = sessionPnLRef.current + profit;
          setSessionPnL(updatedPnL);
          sessionPnLRef.current = updatedPnL;

          if (onUpdateBalance) {
            onUpdateBalance(balanceUsdRef.current + profit);
          }

          // Check Target Profit
          if (targetProfitRef.current > 0 && updatedPnL >= targetProfitRef.current) {
            setIsRunning(false);
            isRunningRef.current = false;
            setStatusState('TARGET_REACHED');
            setStatusMessage(`🎯 Target profit of $${targetProfitRef.current.toFixed(2)} reached! P/L: +$${updatedPnL.toFixed(2)}`);
            soundManager.playWinSound();
            addLog(`🎯 TARGET PROFIT REACHED! Total session profit: +$${updatedPnL.toFixed(2)}`, 'win');
          } else if (isRunningRef.current) {
            setStatusState('ANALYZING');
            setStatusMessage(`Scanning synthetics · Analyzing least-risky setups...`);
          }
        }
      }
    };

    derivWS.subscribeContracts(handleContractUpdate);

    return () => {
      derivWS.unsubscribeContracts(handleContractUpdate);
    };
  }, [onUpdateBalance]);

  // Execute an Auto Trade decision
  const executeAutoTrade = (sym: MarketSymbol, quote: number) => {
    if (!isRunningRef.current) return;
    if (activeContractIdRef.current) return; // Wait for previous contract to close

    const now = Date.now();
    const minDelay = speedRef.current === 'SLOW' ? 2500 : 800;
    if (now - lastExecutionTimeRef.current < minDelay) {
      return;
    }

    const currentBalance = balanceUsdRef.current;
    const stakeToUse = Math.max(0.35, Math.round(currentBalance * 0.05 * 100) / 100);

    // Insufficient balance check
    if (currentBalance < stakeToUse || currentBalance <= 0) {
      setIsRunning(false);
      isRunningRef.current = false;
      setInsufficientBalanceAlert('InsufficientBalance: Your account balance is insufficient to buy this contract.');
      setStatusState('ERROR');
      setStatusMessage('Trading halted: Insufficient account balance.');
      soundManager.playLossSound();
      return;
    }

    const lastDigit = extractDerivLastDigit(quote);
    const cat = selectedCategoryRef.current;

    let contractType: 'DIGITDIFF' | 'DIGITUNDER' | 'DIGITOVER' | 'DIGITEVEN' | 'DIGITODD' | 'CALL' | 'PUT' = 'DIGITDIFF';
    let targetDigit: number | undefined = undefined;
    let barrier: number | undefined = undefined;
    let desc = '';

    if (cat === 'MATCHES_DIFFERS') {
      contractType = 'DIGITDIFF';
      targetDigit = lastDigit;
      barrier = lastDigit;
      desc = `Matches / Differs → Differs ${lastDigit} · stake ${stakeToUse.toFixed(2)}`;
      setSelectedMarketLabel(`Differs ${lastDigit}`);
      setSelectedMarketCoverage('Matches / Differs · 100% coverage');
    } else if (cat === 'OVER_UNDER') {
      contractType = 'DIGITUNDER';
      targetDigit = 7;
      barrier = 7;
      desc = `Over / Under → Under 7 · stake ${stakeToUse.toFixed(2)}`;
      setSelectedMarketLabel('Under 7');
      setSelectedMarketCoverage('Over / Under · 80% coverage');
    } else if (cat === 'EVEN_ODD') {
      contractType = lastDigit % 2 === 0 ? 'DIGITODD' : 'DIGITEVEN';
      desc = `Even / Odd → ${contractType === 'DIGITODD' ? 'Odd' : 'Even'} · stake ${stakeToUse.toFixed(2)}`;
      setSelectedMarketLabel(contractType === 'DIGITODD' ? 'Odd' : 'Even');
      setSelectedMarketCoverage('Even / Odd · 50% coverage');
    } else if (cat === 'RISE_FALL') {
      contractType = 'CALL';
      desc = `Rise / Fall → Rise · stake ${stakeToUse.toFixed(2)}`;
      setSelectedMarketLabel('Rise');
      setSelectedMarketCoverage('Rise / Fall · Momentum Edge');
    } else {
      // AUTO (LEAST RISKY)
      contractType = 'DIGITDIFF';
      targetDigit = (lastDigit + 5) % 10;
      barrier = targetDigit;
      desc = `Auto (Least Risky) → Differs ${targetDigit} · stake ${stakeToUse.toFixed(2)}`;
      setSelectedMarketLabel(`Differs ${targetDigit}`);
      setSelectedMarketCoverage('Auto Scanner · Least-Risky 90%+ edge');
    }

    lastExecutionTimeRef.current = now;
    setStatusState('EXECUTING');
    setStatusMessage(desc);
    soundManager.playTradeTakenSound();

    try {
      const contract = derivWS.purchaseContract({
        symbol: sym,
        contractType: contractType,
        stake: stakeToUse,
        durationTicks: 1,
        targetDigit: targetDigit,
        barrier: barrier,
        symbolName: markets.find((m) => m.symbol === sym)?.displayName || sym,
      });

      setActiveContractId(contract.id);
      activeContractIdRef.current = contract.id;
      addLog(`⚡ EXECUTED: ${desc} on ${sym}`, 'trade');
    } catch (err: any) {
      if (err?.message?.includes('balance') || err?.message?.includes('Insufficient')) {
        setIsRunning(false);
        isRunningRef.current = false;
        setInsufficientBalanceAlert('InsufficientBalance: Your account balance is insufficient to buy this contract.');
      }
    }
  };

  // Subscribe to live market ticks across all synthetic volatility markets
  useEffect(() => {
    const fallbackSymbols: MarketSymbol[] = [
      'R_10', 'R_25', 'R_50', 'R_75', 'R_100',
      '1HZ10V', '1HZ15V', '1HZ25V', '1HZ30V', '1HZ50V', '1HZ75V', '1HZ90V', '1HZ100V',
    ];

    const symbolsToScan: MarketSymbol[] =
      markets && markets.length > 0
        ? Array.from(new Set(markets.map((m) => m.symbol)))
        : fallbackSymbols;

    const cleanups: Array<() => void> = [];

    symbolsToScan.forEach((sym) => {
      const handler = (tick: Tick) => {
        setTotalTicksReceived((prev) => prev + 1);
        setActiveMarketSymbol(tick.symbol);

        if (!ticksBufferRef.current[tick.symbol]) {
          ticksBufferRef.current[tick.symbol] = [];
        }
        const digit = extractDerivLastDigit(tick.quote);
        ticksBufferRef.current[tick.symbol].push(digit);
        if (ticksBufferRef.current[tick.symbol].length > 15) {
          ticksBufferRef.current[tick.symbol].shift();
        }

        if (isRunningRef.current && !activeContractIdRef.current) {
          executeAutoTrade(tick.symbol, tick.quote);
        }
      };

      derivWS.subscribeTicks(sym, handler);
      cleanups.push(() => derivWS.unsubscribeTicks(sym, handler));
    });

    return () => {
      cleanups.forEach((c) => c());
    };
  }, [markets]);

  // Start / Stop Handlers
  const handleToggleAutoTrader = () => {
    soundManager.playButtonClick();

    if (isRunning) {
      setIsRunning(false);
      isRunningRef.current = false;
      setStatusState('IDLE');
      setStatusMessage('Auto Trader stopped by user.');
      addLog('⏸ Auto Trader paused.', 'info');
    } else {
      // Check balance before launching
      if (balanceUsd < stakePerTrade || balanceUsd <= 0) {
        setInsufficientBalanceAlert('InsufficientBalance: Your account balance is insufficient to buy this contract.');
        soundManager.playLossSound();
        return;
      }

      setInsufficientBalanceAlert(null);
      setIsRunning(true);
      isRunningRef.current = true;
      setStatusState('ANALYZING');
      setStatusMessage(`Scanning ${activeMarketSymbol} · Searching least-risky high probability setups...`);
      addLog(`🚀 Auto Trader started in ${speed} mode (${selectedCategory}).`, 'info');
    }
  };

  const handleResetSessionStats = () => {
    soundManager.playButtonClick();
    setSessionPnL(0);
    setTotalTrades(0);
    setRecentLogs([]);
  };

  return (
    <div className="w-full max-w-md mx-auto space-y-3 font-sans pb-12">
      {/* Floating Insufficient Balance Modal / Toast (as seen in screenshot 1) */}
      {insufficientBalanceAlert && (
        <div className="fixed inset-x-4 top-16 sm:top-20 max-w-md mx-auto z-50 animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="bg-white text-slate-900 rounded-2xl shadow-2xl border border-slate-200 p-4 flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="w-7 h-7 rounded-full bg-slate-900 text-white flex items-center justify-center shrink-0 mt-0.5">
                <AlertCircle className="w-4 h-4" />
              </div>
              <div className="space-y-1 text-left">
                <p className="text-sm font-bold leading-snug">{insufficientBalanceAlert}</p>
              </div>
            </div>
            <button
              onClick={() => setInsufficientBalanceAlert(null)}
              className="p-1 text-slate-400 hover:text-slate-700 transition-colors rounded-lg"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Main Auto Trader Container Card */}
      <div className="bg-slate-950 border border-slate-850 rounded-3xl p-4 sm:p-5 shadow-2xl space-y-4">
        {/* Header Title Section */}
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-sky-500/15 border border-sky-500/30 flex items-center justify-center text-sky-400 shadow-md shadow-sky-950/40">
            <Rocket className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold text-white tracking-tight flex items-center gap-2">
              Auto Trader
            </h1>
            <p className="text-xs text-slate-400 font-medium leading-relaxed">
              Hands-off: 5% of your balance per trade on the least-risky market
            </p>
          </div>
        </div>

        {/* Top 2 Metric Cards */}
        <div className="grid grid-cols-2 gap-2.5">
          {/* Card 1: Stake per trade */}
          <div className="bg-slate-900/80 border border-slate-800/80 rounded-2xl p-3.5 flex flex-col justify-between">
            <span className="text-xs text-slate-400 font-medium">Stake per trade</span>
            <div className="mt-1">
              <div className="text-2xl font-black text-white tracking-tight">
                {stakePerTrade.toFixed(2)}
              </div>
              <div className="text-[11px] text-slate-400 font-medium mt-0.5 truncate">
                5% of {balanceUsd.toFixed(2)} · min 0.35
              </div>
            </div>
          </div>

          {/* Card 2: Selected market */}
          <div className="bg-slate-900/80 border border-slate-800/80 rounded-2xl p-3.5 flex flex-col justify-between">
            <span className="text-xs text-slate-400 font-medium">Selected market</span>
            <div className="mt-1">
              <div className="text-2xl font-black text-sky-400 tracking-tight truncate">
                {selectedMarketLabel}
              </div>
              <div className="text-[11px] text-slate-400 font-medium mt-0.5 truncate">
                {selectedMarketCoverage}
              </div>
            </div>
          </div>
        </div>

        {/* Market Category Selector */}
        <div className="space-y-2">
          <label className="text-xs text-slate-400 font-semibold uppercase tracking-wider block">
            Market
          </label>
          <div className="flex flex-wrap gap-1.5">
            {[
              { id: 'OVER_UNDER' as AutoTraderMarketCategory, label: 'OVER / UNDER' },
              { id: 'MATCHES_DIFFERS' as AutoTraderMarketCategory, label: 'MATCHES / DIFFERS' },
              { id: 'EVEN_ODD' as AutoTraderMarketCategory, label: 'EVEN / ODD' },
              { id: 'RISE_FALL' as AutoTraderMarketCategory, label: 'RISE / FALL' },
              { id: 'AUTO_LEAST_RISKY' as AutoTraderMarketCategory, label: 'AUTO (LEAST RISKY)' },
            ].map((item) => {
              const isSelected = selectedCategory === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setSelectedCategory(item.id);
                    soundManager.playButtonClick();
                  }}
                  className={`px-3 py-2 rounded-xl text-xs font-bold transition-all border ${
                    isSelected
                      ? 'bg-sky-950/90 border-sky-500 text-sky-300 shadow-md shadow-sky-950/50'
                      : 'bg-slate-900/90 border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-850'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Speed Selector */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs text-slate-400 font-semibold uppercase tracking-wider">
              Speed
            </label>
            <div className="flex items-center gap-1.5">
              {(['FAST', 'SLOW'] as AutoTraderSpeed[]).map((s) => (
                <button
                  key={s}
                  onClick={() => {
                    setSpeed(s);
                    soundManager.playButtonClick();
                  }}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all border ${
                    speed === s
                      ? 'bg-sky-600 border-sky-400 text-white shadow-sm'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
          <p className="text-[11px] text-slate-400 leading-normal">
            Fast: no pause, fires instantly on every volatility · Slow: short analyzing beat
          </p>
        </div>

        {/* Target Profit Input Card */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-1.5 text-sky-400 font-semibold">
              <Target className="w-4 h-4 text-sky-400" />
              <span className="text-slate-200 font-bold">Target profit</span>
            </div>
            <div className="font-mono font-bold text-slate-300">
              {sessionPnL.toFixed(2)} / {targetProfit.toFixed(2)}
            </div>
          </div>
          <div className="relative">
            <input
              type="number"
              min="0"
              step="5"
              value={targetProfit}
              onChange={(e) => setTargetProfit(Math.max(0, parseFloat(e.target.value) || 0))}
              className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-white font-bold text-base focus:outline-none focus:border-sky-500 transition-colors"
            />
          </div>
          <p className="text-[11px] text-slate-400 leading-normal">
            Auto Trader stops the moment P/L reaches this value. Set 0 to run forever.
          </p>
        </div>

        {/* Live Execution Status Card */}
        <div className="bg-slate-900/90 border border-slate-800/90 rounded-2xl p-4 flex items-center gap-3.5 shadow-inner">
          <div className="relative flex items-center justify-center shrink-0">
            <div
              className={`w-10 h-10 rounded-full border-2 flex items-center justify-center ${
                isRunning
                  ? 'border-sky-500/40 border-t-sky-400 animate-spin text-sky-400'
                  : 'border-slate-700 text-slate-500'
              }`}
            >
              <div
                className={`w-2.5 h-2.5 rounded-full ${
                  isRunning ? 'bg-red-500 animate-ping' : 'bg-slate-600'
                }`}
              />
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-black tracking-wider uppercase flex items-center gap-1.5 text-sky-400">
              <span>TRADING</span>
              <span className="text-slate-600">•</span>
              <span>EXECUTING CONTRACT</span>
            </div>
            {/* Glowing red gradient indicator line */}
            <div className="w-full h-1 bg-slate-800 rounded-full my-1.5 overflow-hidden">
              <div
                className={`h-full transition-all duration-300 ${
                  isRunning
                    ? 'w-full bg-gradient-to-r from-red-600 via-rose-500 to-sky-400 animate-pulse'
                    : 'w-0'
                }`}
              />
            </div>
            <p className="text-xs font-medium text-slate-300 truncate">{statusMessage}</p>
          </div>
        </div>

        {/* Accounts under $5 Notice */}
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl px-3 py-2 text-xs flex items-center gap-2 text-slate-400 font-medium">
          <Shield className="w-4 h-4 text-sky-400 shrink-0" />
          <span className="truncate">Accounts under $5 still stake the 0.35 minimum.</span>
        </div>

        {/* Primary Action Button (Start / Stop) */}
        <div>
          {isRunning ? (
            <button
              id="btn-stop-auto-trader"
              onClick={handleToggleAutoTrader}
              className="w-full py-3.5 bg-red-600 hover:bg-red-700 text-white font-black text-base rounded-2xl flex items-center justify-center gap-2.5 shadow-lg shadow-red-950/60 transition-all active:scale-[0.99]"
            >
              <Square className="w-5 h-5 fill-current" />
              <span>Stop Auto Trader</span>
            </button>
          ) : (
            <button
              id="btn-start-auto-trader"
              onClick={handleToggleAutoTrader}
              className="w-full py-3.5 bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-500 hover:to-blue-500 text-white font-black text-base rounded-2xl flex items-center justify-center gap-2.5 shadow-lg shadow-sky-950/60 transition-all active:scale-[0.99]"
            >
              <Play className="w-5 h-5 fill-current" />
              <span>Run Auto Trader</span>
            </button>
          )}
        </div>

        {/* Live Footer Statistics Bar */}
        <div className="flex items-center justify-between text-xs text-slate-400 pt-1 border-t border-slate-850 font-medium">
          <div className="flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5 text-slate-500" />
            <span>
              ~ {activeMarketSymbol} · {totalTicksReceived} ticks
            </span>
          </div>
          <div className="flex items-center gap-2 font-mono">
            <span>Trades {totalTrades}</span>
            <span>•</span>
            <span className={sessionPnL >= 0 ? 'text-emerald-400 font-bold' : 'text-red-400 font-bold'}>
              P/L {sessionPnL >= 0 ? `+${sessionPnL.toFixed(2)}` : sessionPnL.toFixed(2)}
            </span>
          </div>
        </div>

        {/* Switch to manual trading secondary button */}
        {onNavigateTab && (
          <div className="pt-1">
            <button
              onClick={() => {
                soundManager.playButtonClick();
                onNavigateTab('terminal');
              }}
              className="w-full py-2.5 bg-slate-900 hover:bg-slate-850 border border-slate-800 text-slate-300 text-xs font-bold rounded-xl transition-colors flex items-center justify-center gap-1.5"
            >
              <span>Switch to manual trading</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Session History Log / Quick Audit Drawer */}
      {recentLogs.length > 0 && (
        <div className="bg-slate-950 border border-slate-850 rounded-2xl p-3.5 space-y-2 text-xs">
          <div className="flex items-center justify-between text-slate-400 font-semibold">
            <span className="uppercase text-[10px] tracking-wider">Live Execution History</span>
            <button
              onClick={handleResetSessionStats}
              className="text-[10px] text-slate-500 hover:text-slate-300 flex items-center gap-1"
            >
              <RotateCcw className="w-3 h-3" /> Reset Stats
            </button>
          </div>
          <div className="space-y-1 max-h-32 overflow-y-auto pr-1">
            {recentLogs.map((item) => (
              <div
                key={item.id}
                className={`p-1.5 rounded-lg text-[11px] font-medium flex items-center justify-between ${
                  item.type === 'win'
                    ? 'bg-emerald-950/40 text-emerald-300 border border-emerald-800/40'
                    : item.type === 'loss'
                    ? 'bg-red-950/40 text-red-300 border border-red-800/40'
                    : 'bg-slate-900/60 text-slate-400'
                }`}
              >
                <span className="truncate">{item.text}</span>
                <span className="text-[9px] text-slate-500 ml-2 shrink-0">{item.time}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
