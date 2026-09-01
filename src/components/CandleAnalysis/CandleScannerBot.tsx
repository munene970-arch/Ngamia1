import React, { useState, useEffect, useRef, useMemo } from 'react';
import { MarketInfo, MarketSymbol, ActiveContract, Candle, Tick } from '../../types/deriv';
import { evaluateConfluence, MarketConfluenceSignal } from './indicatorCalculations';
import { derivWS } from '../../services/derivWebSocket';
import { soundManager } from '../../utils/soundEffects';
import {
  Bot,
  Play,
  Square,
  Radar,
  ArrowUpRight,
  ArrowDownRight,
  ShieldAlert,
  DollarSign,
  Award,
  Flame,
  RefreshCw,
  Layers,
  Lock,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle
} from 'lucide-react';

interface CandleScannerBotProps {
  markets: MarketInfo[];
  selectedSymbol: MarketSymbol;
  onSelectSymbol: (symbol: MarketSymbol) => void;
  balanceUsd: number;
  onUpdateBalance?: (bal: number) => void;
  activeContracts: ActiveContract[];
  allMarketCandles: Record<string, Candle[]>;
}

export interface BotTradeLog {
  id: string;
  time: string;
  symbol: MarketSymbol;
  symbolName: string;
  tradeType: 'RISE' | 'FALL';
  stake: number;
  entrySpot: number;
  exitSpot?: number;
  pnl: number;
  isWin: boolean;
  signalConfidence: number;
  signalReason: string;
}

export const CandleScannerBot: React.FC<CandleScannerBotProps> = ({
  markets,
  selectedSymbol,
  onSelectSymbol,
  balanceUsd,
  onUpdateBalance,
  activeContracts,
  allMarketCandles,
}) => {
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [baseStake, setBaseStake] = useState<number>(1);
  const [currentStake, setCurrentStake] = useState<number>(1);
  const [martingaleMultiplier, setMartingaleMultiplier] = useState<number>(2.1);
  const [takeProfit, setTakeProfit] = useState<number>(20);
  const [stopLoss, setStopLoss] = useState<number>(30);
  const [minConfidence, setMinConfidence] = useState<number>(75);
  const [tradeInterval, setTradeInterval] = useState<number>(60); // 1 minute interval (60s)
  const [tradeLogs, setTradeLogs] = useState<BotTradeLog[]>([]);

  // 1-Trade-at-a-time Lock State
  const [activeBotContractId, setActiveBotContractId] = useState<string | null>(null);
  const [activeBotContract, setActiveBotContract] = useState<ActiveContract | null>(null);
  const [activeCountdown, setActiveCountdown] = useState<number>(60);
  const activeBotContractIdRef = useRef<string | null>(null);
  const processedContractIdsRef = useRef<Set<string>>(new Set());

  // Real-time market confluence signals cache
  const [marketSignals, setMarketSignals] = useState<Record<string, MarketConfluenceSignal>>({});
  const lastTradeTimeRef = useRef<number>(0);
  const isExecutingTradeRef = useRef<boolean>(false);

  // Bot Statistics
  const totalTrades = tradeLogs.length;
  const wins = tradeLogs.filter((t) => t.isWin).length;
  const losses = totalTrades - wins;
  const winRate = totalTrades > 0 ? Number(((wins / totalTrades) * 100).toFixed(1)) : 0;
  const netProfit = Number(tradeLogs.reduce((acc, t) => acc + t.pnl, 0).toFixed(2));

  const safeMarkets = markets && markets.length > 0 ? markets : [];
  const candlesRef = useRef(allMarketCandles);
  candlesRef.current = allMarketCandles;

  // Compute Confluence for markets on a controlled interval to preserve CPU/memory
  useEffect(() => {
    if (safeMarkets.length === 0) return;

    const runScan = () => {
      const updatedSignals: Record<string, MarketConfluenceSignal> = {};
      const currentCandles = candlesRef.current;
      // Scan top synthetic markets to keep mobile CPU ultra-responsive
      const marketsToScan = safeMarkets.slice(0, 10);
      marketsToScan.forEach((m) => {
        if (!m || !m.symbol) return;
        const candles = currentCandles[m.symbol] || [];
        if (candles.length > 3) {
          try {
            const result = evaluateConfluence(candles);
            updatedSignals[m.symbol] = result.confluence;
          } catch (err) {
            console.error('Error in evaluateConfluence for symbol', m.symbol, err);
          }
        }
      });
      setMarketSignals((prev) => ({ ...prev, ...updatedSignals }));
    };

    runScan();
    const interval = window.setInterval(runScan, 4000);
    return () => window.clearInterval(interval);
  }, [safeMarkets]);

  // Rank markets by highest confluence confidence & absolute score
  const rankedMarkets = useMemo(() => {
    return safeMarkets
      .filter((m) => Boolean(m && m.symbol))
      .map((m) => {
        const signal = marketSignals[m.symbol] || {
          direction: 'NEUTRAL' as const,
          tradeAction: 'WAIT' as const,
          score: 0,
          confidence: 50,
          reasons: ['Analyzing candle momentum...'],
          recommendedDuration: '1m',
          lastCalculated: Date.now(),
        };
        return {
          market: m,
          signal,
          priorityScore: Math.abs(signal.score || 0),
        };
      })
      .sort((a, b) => b.priorityScore - a.priorityScore);
  }, [safeMarkets, marketSignals]);

  const bestMarket = rankedMarkets[0];

  // Synchronize active bot contract from WebSocket active contracts
  useEffect(() => {
    if (!activeBotContractIdRef.current) return;

    const currentId = activeBotContractIdRef.current;
    const match = (activeContracts || []).find((c) => c.id === currentId);
    if (match) {
      setActiveBotContract(match);
      if (match.expiryTime) {
        const remaining = Math.max(0, Math.ceil((match.expiryTime - Date.now()) / 1000));
        setActiveCountdown(remaining);
      }
    }
  }, [activeContracts]);

  // Active contract 1-second countdown ticker
  useEffect(() => {
    if (!activeBotContractId) return;

    const timer = window.setInterval(() => {
      if (activeBotContract?.expiryTime) {
        const remaining = Math.max(0, Math.ceil((activeBotContract.expiryTime - Date.now()) / 1000));
        setActiveCountdown(remaining);
      } else {
        setActiveCountdown((prev) => Math.max(0, prev - 1));
      }
    }, 1000);

    return () => window.clearInterval(timer);
  }, [activeBotContractId, activeBotContract?.expiryTime]);

  // Listen to contract settlements to release Single-Trade Lock, apply Martingale & log
  useEffect(() => {
    (activeContracts || []).forEach((contract) => {
      if (!contract) return;
      const isSettled = ['WON', 'LOST', 'SOLD', 'CANCELLED'].includes(contract.status);

      // Check if this is our active bot contract settling
      if (isSettled && (contract.id === activeBotContractIdRef.current || contract.id === activeBotContractId)) {
        if (!processedContractIdsRef.current.has(contract.id)) {
          processedContractIdsRef.current.add(contract.id);

          const isWin = contract.status === 'WON' || Boolean(contract.isWin);
          const stakeVal = contract.stake || 1;
          const pnl = isWin ? Number((stakeVal * 0.92).toFixed(2)) : -stakeVal;

          const newLog: BotTradeLog = {
            id: contract.id,
            time: new Date().toLocaleTimeString(),
            symbol: contract.symbol,
            symbolName: contract.symbolName || contract.symbol,
            tradeType: contract.contractType === 'CALL' ? 'RISE' : 'FALL',
            stake: stakeVal,
            entrySpot: contract.entrySpot,
            exitSpot: contract.exitSpot,
            pnl,
            isWin,
            signalConfidence: 85,
            signalReason: '1m Technical Confluence Single-Trade',
          };

          setTradeLogs((prev) => [newLog, ...prev].slice(0, 30));

          // Manage Stake according to Martingale
          if (isWin) {
            setCurrentStake(baseStake);
          } else {
            setCurrentStake((prev) => Number((prev * martingaleMultiplier).toFixed(2)));
          }

          // Check Stop Loss / Take Profit
          const newTotalProfit = netProfit + pnl;
          if (newTotalProfit >= takeProfit) {
            setIsRunning(false);
            soundManager.playWinSound();
          } else if (newTotalProfit <= -stopLoss) {
            setIsRunning(false);
            soundManager.playLossSound();
          }

          // RELEASE SINGLE TRADE LOCK
          activeBotContractIdRef.current = null;
          setActiveBotContractId(null);
          setActiveBotContract(null);
          lastTradeTimeRef.current = Date.now();
        }
      }
    });
  }, [activeContracts, activeBotContractId, baseStake, martingaleMultiplier, netProfit, takeProfit, stopLoss]);

  // Main Bot Scan & Trade Execution Loop (Strict 1 Trade at a time)
  useEffect(() => {
    if (!isRunning) return;

    const intervalTimer = window.setInterval(() => {
      const now = Date.now();

      // RULE 1: If there is an active trade locked, DO NOT TAKE ANY NEW TRADE
      if (activeBotContractIdRef.current || activeBotContractId) {
        return;
      }

      // RULE 2: Check if any contract is currently OPEN
      const hasAnyOpenContract = activeContracts.some((c) => c.status === 'OPEN');
      if (hasAnyOpenContract || isExecutingTradeRef.current) {
        return;
      }

      // RULE 3: Cooldown buffer between trades
      if (now - lastTradeTimeRef.current < 2000) {
        return;
      }

      // Pick top market with highest confidence >= minConfidence
      const targetOpportunity = rankedMarkets.find(
        (item) => item.signal.tradeAction !== 'WAIT' && item.signal.confidence >= minConfidence
      );

      if (targetOpportunity) {
        const { market, signal } = targetOpportunity;
        isExecutingTradeRef.current = true;
        lastTradeTimeRef.current = now;

        // Auto select market on chart
        onSelectSymbol(market.symbol);

        const contractType = signal.tradeAction === 'RISE' ? 'CALL' : 'PUT';

        // Execute 1-Minute Single Trade
        const newContract = derivWS.purchaseContract({
          symbol: market.symbol,
          symbolName: market.displayName,
          contractType,
          stake: currentStake,
          durationValue: 1,
          durationUnit: 'm',
          durationTicks: 60,
        });

        // ACQUIRE 1-TRADE-AT-A-TIME LOCK
        activeBotContractIdRef.current = newContract.id;
        setActiveBotContractId(newContract.id);
        setActiveBotContract(newContract);
        setActiveCountdown(60);

        if (onUpdateBalance && balanceUsd >= currentStake) {
          onUpdateBalance(balanceUsd - currentStake);
        }

        soundManager.playTickSound();

        setTimeout(() => {
          isExecutingTradeRef.current = false;
        }, 1500);
      }
    }, 1000);

    return () => window.clearInterval(intervalTimer);
  }, [
    isRunning,
    activeBotContractId,
    rankedMarkets,
    minConfidence,
    currentStake,
    activeContracts,
    balanceUsd,
    onSelectSymbol,
    onUpdateBalance,
  ]);

  const handleStartBot = () => {
    setCurrentStake(baseStake);
    setIsRunning(true);
    soundManager.playTickSound();
  };

  const handleStopBot = () => {
    setIsRunning(false);
  };

  const handleForceReleaseLock = () => {
    activeBotContractIdRef.current = null;
    setActiveBotContractId(null);
    setActiveBotContract(null);
  };

  const isTradeLocked = Boolean(activeBotContractId || activeBotContractIdRef.current);

  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col space-y-4 p-4">
      {/* Bot Header & Status */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
        <div className="flex items-center space-x-2.5">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-rose-500 flex items-center justify-center text-white shadow-md">
            <Bot className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h3 className="font-extrabold text-sm text-slate-900">
                1-Min Candle Confluence AI Bot
              </h3>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                  isRunning
                    ? isTradeLocked
                      ? 'bg-amber-100 text-amber-800 animate-pulse'
                      : 'bg-emerald-100 text-emerald-700 animate-pulse'
                    : 'bg-slate-100 text-slate-500'
                }`}
              >
                {isRunning
                  ? isTradeLocked
                    ? 'TRADE IN PROGRESS (LOCKED)'
                    : 'SCANNING FOR 1-MIN SIGNAL'
                  : 'IDLE'}
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              Strict 1 trade at a time • Next trade executes only after current trade closes
            </p>
          </div>
        </div>

        {/* Start / Stop Toggle Button */}
        <div>
          {!isRunning ? (
            <button
              id="btn-start-candle-bot"
              onClick={handleStartBot}
              className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black shadow-md flex items-center gap-1.5 transition-all active:scale-95"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>Start 1-Min Auto Bot</span>
            </button>
          ) : (
            <button
              id="btn-stop-candle-bot"
              onClick={handleStopBot}
              className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-black shadow-md flex items-center gap-1.5 transition-all active:scale-95"
            >
              <Square className="w-4 h-4 fill-current" />
              <span>Stop Bot</span>
            </button>
          )}
        </div>
      </div>

      {/* ACTIVE TRADE IN PROGRESS (1 TRADE AT A TIME LOCKED STATUS CARD) */}
      {isTradeLocked && activeBotContract && (
        <div className="p-3.5 bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-slate-900/5 border-2 border-amber-400 rounded-2xl shadow-sm space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <span className="p-1 rounded-lg bg-amber-500 text-slate-950 font-black text-[10px] flex items-center gap-1">
                <Lock className="w-3 h-3" /> 1-TRADE LOCK ACTIVE
              </span>
              <span className="font-extrabold text-xs text-slate-900">
                {activeBotContract.symbolName || activeBotContract.symbol}
              </span>
            </div>
            <div className="flex items-center space-x-1.5 font-mono text-xs font-black">
              <Clock className="w-3.5 h-3.5 text-amber-600 animate-spin" />
              <span className="text-amber-700">{activeCountdown}s remaining</span>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono">
            <div className="bg-white/80 p-2 rounded-xl border border-amber-200">
              <span className="text-[10px] text-slate-400 block font-sans uppercase">Direction</span>
              <span className={`font-black flex items-center gap-1 ${activeBotContract.contractType === 'CALL' ? 'text-emerald-600' : 'text-rose-600'}`}>
                {activeBotContract.contractType === 'CALL' ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
                {activeBotContract.contractType === 'CALL' ? 'RISE (BUY)' : 'FALL (SELL)'}
              </span>
            </div>
            <div className="bg-white/80 p-2 rounded-xl border border-amber-200">
              <span className="text-[10px] text-slate-400 block font-sans uppercase">Stake / Payout</span>
              <span className="font-bold text-slate-900">${activeBotContract.stake} / ${(activeBotContract.stake * 1.92).toFixed(2)}</span>
            </div>
            <div className="bg-white/80 p-2 rounded-xl border border-amber-200">
              <span className="text-[10px] text-slate-400 block font-sans uppercase">Entry Spot</span>
              <span className="font-bold text-slate-800">{activeBotContract.entrySpot || '--'}</span>
            </div>
            <div className="bg-white/80 p-2 rounded-xl border border-amber-200">
              <span className="text-[10px] text-slate-400 block font-sans uppercase">Live Spot</span>
              <span className="font-bold text-blue-600">{activeBotContract.currentSpot || activeBotContract.entrySpot || '--'}</span>
            </div>
          </div>

          {/* Progress Bar & Status explanation */}
          <div className="space-y-1">
            <div className="w-full bg-amber-200 rounded-full h-2 overflow-hidden">
              <div
                className="bg-amber-500 h-2 transition-all duration-1000 ease-linear rounded-full"
                style={{ width: `${Math.max(5, ((60 - activeCountdown) / 60) * 100)}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-[10px] text-slate-500 font-medium">
              <span>Next trade locked until this trade completes & settles.</span>
              <button
                onClick={handleForceReleaseLock}
                className="text-amber-700 hover:text-amber-900 font-bold underline ml-2"
              >
                Release Lock
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bot P&L and Risk Counters */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs font-mono font-bold">
        <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl">
          <span className="text-[10px] text-slate-400 font-sans block uppercase">Total Trades</span>
          <span className="text-slate-900">{totalTrades} (W: {wins} / L: {losses})</span>
        </div>
        <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl">
          <span className="text-[10px] text-slate-400 font-sans block uppercase">Win Rate</span>
          <span className={winRate >= 60 ? 'text-emerald-600' : 'text-slate-700'}>{winRate}%</span>
        </div>
        <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl">
          <span className="text-[10px] text-slate-400 font-sans block uppercase">Net Profit</span>
          <span className={netProfit >= 0 ? 'text-emerald-600' : 'text-rose-600'}>
            {netProfit >= 0 ? `+$${netProfit}` : `-$${Math.abs(netProfit)}`}
          </span>
        </div>
        <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl">
          <span className="text-[10px] text-slate-400 font-sans block uppercase">Next Stake</span>
          <span className="text-amber-600">${currentStake}</span>
        </div>
      </div>

      {/* Bot Configuration Parameters */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
        <div>
          <label className="text-[10px] font-bold text-slate-400 uppercase">Base Stake ($)</label>
          <input
            type="number"
            min="0.35"
            step="0.5"
            disabled={isRunning}
            value={baseStake}
            onChange={(e) => setBaseStake(Math.max(0.35, Number(e.target.value)))}
            className="w-full mt-1 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl font-mono font-bold text-slate-900 outline-none"
          />
        </div>
        <div>
          <label className="text-[10px] font-bold text-slate-400 uppercase">Martingale Mult</label>
          <input
            type="number"
            min="1"
            max="4"
            step="0.1"
            disabled={isRunning}
            value={martingaleMultiplier}
            onChange={(e) => setMartingaleMultiplier(Number(e.target.value))}
            className="w-full mt-1 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl font-mono font-bold text-slate-900 outline-none"
          />
        </div>
        <div>
          <label className="text-[10px] font-bold text-slate-400 uppercase">Min Confidence</label>
          <select
            value={minConfidence}
            disabled={isRunning}
            onChange={(e) => setMinConfidence(Number(e.target.value))}
            className="w-full mt-1 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 outline-none"
          >
            <option value="70">70% (Aggressive)</option>
            <option value="75">75% (Balanced)</option>
            <option value="80">80% (High Precision)</option>
            <option value="85">85% (Ultra Selective)</option>
          </select>
        </div>
        <div>
          <label className="text-[10px] font-bold text-slate-400 uppercase">Take Profit ($)</label>
          <input
            type="number"
            min="5"
            disabled={isRunning}
            value={takeProfit}
            onChange={(e) => setTakeProfit(Number(e.target.value))}
            className="w-full mt-1 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl font-mono font-bold text-slate-900 outline-none"
          />
        </div>
      </div>

      {/* Best Opportunity Banner */}
      {bestMarket && (
        <div
          onClick={() => onSelectSymbol(bestMarket.market.symbol)}
          className={`p-3.5 rounded-2xl border cursor-pointer transition-all ${
            bestMarket.signal.tradeAction === 'RISE'
              ? 'bg-emerald-50 border-emerald-300 text-emerald-950 hover:bg-emerald-100/70'
              : bestMarket.signal.tradeAction === 'FALL'
              ? 'bg-rose-50 border-rose-300 text-rose-950 hover:bg-rose-100/70'
              : 'bg-slate-50 border-slate-200 text-slate-900'
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <span className="px-2 py-0.5 rounded-md bg-slate-900 text-white text-[10px] font-black uppercase">
                TOP 1-MIN SIGNAL
              </span>
              <span className="font-black text-xs">{bestMarket.market.displayName}</span>
            </div>
            <div className="flex items-center space-x-1.5 text-xs font-black">
              {bestMarket.signal.tradeAction === 'RISE' ? (
                <span className="text-emerald-700 flex items-center gap-1">
                  <ArrowUpRight className="w-4 h-4" /> STRONG RISE ({bestMarket.signal.confidence}%)
                </span>
              ) : bestMarket.signal.tradeAction === 'FALL' ? (
                <span className="text-rose-700 flex items-center gap-1">
                  <ArrowDownRight className="w-4 h-4" /> STRONG FALL ({bestMarket.signal.confidence}%)
                </span>
              ) : (
                <span className="text-slate-500">NEUTRAL ({bestMarket.signal.confidence}%)</span>
              )}
            </div>
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {bestMarket.signal.reasons.map((r, i) => (
              <span
                key={i}
                className="px-2 py-0.5 rounded-md bg-white/80 border border-slate-200 text-[10px] font-semibold text-slate-700"
              >
                {r}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Multi-Market Real-Time Confluence Radar Matrix */}
      <div>
        <div className="text-[11px] font-bold uppercase text-slate-400 mb-2 flex items-center justify-between">
          <span className="flex items-center gap-1">
            <Radar className="w-3.5 h-3.5 text-amber-500" /> Multi-Market Scanner Confluence Matrix
          </span>
          <span>Click market to load chart</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
          {rankedMarkets.slice(0, 10).map(({ market, signal }) => {
            const isSelected = selectedSymbol === market.symbol;
            const isRise = signal.tradeAction === 'RISE';
            const isFall = signal.tradeAction === 'FALL';

            return (
              <button
                key={market.symbol}
                onClick={() => onSelectSymbol(market.symbol)}
                className={`p-2.5 rounded-xl border text-left transition-all ${
                  isSelected
                    ? 'ring-2 ring-slate-900 bg-slate-900 text-white border-slate-900 shadow-sm'
                    : isRise
                    ? 'bg-emerald-50/60 border-emerald-200 text-slate-800 hover:border-emerald-400'
                    : isFall
                    ? 'bg-rose-50/60 border-rose-200 text-slate-800 hover:border-rose-400'
                    : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between text-[10px] font-black opacity-75">
                  <span className="truncate">{market.displayName.replace(' Index', '')}</span>
                  <span>{signal.confidence}%</span>
                </div>
                <div className="mt-1 flex items-center justify-between text-xs font-black">
                  <span
                    className={
                      isSelected
                        ? 'text-white'
                        : isRise
                        ? 'text-emerald-600'
                        : isFall
                        ? 'text-rose-600'
                        : 'text-slate-400'
                    }
                  >
                    {signal.tradeAction}
                  </span>
                  <span className="text-[10px] font-mono opacity-80">
                    {signal.score > 0 ? `+${signal.score}` : signal.score}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Bot Trade Logs */}
      {tradeLogs.length > 0 && (
        <div className="border-t border-slate-100 pt-3">
          <div className="text-[11px] font-bold uppercase text-slate-400 mb-2">
            Recent 1-Min Bot Trades ({tradeLogs.length})
          </div>
          <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
            {tradeLogs.map((log) => (
              <div
                key={log.id}
                className={`px-3 py-2 rounded-xl text-xs flex items-center justify-between font-mono ${
                  log.isWin ? 'bg-emerald-50 text-emerald-900 border border-emerald-200' : 'bg-rose-50 text-rose-900 border border-rose-200'
                }`}
              >
                <div className="flex items-center space-x-2">
                  <span className={`px-1.5 py-0.5 rounded font-black text-[10px] ${log.isWin ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'}`}>
                    {log.isWin ? 'WON' : 'LOST'}
                  </span>
                  <span className="font-sans font-bold">{log.symbolName.replace(' Index', '')}</span>
                  <span className="text-slate-500 font-sans text-[11px]">{log.tradeType}</span>
                </div>
                <div className="flex items-center space-x-3 font-bold">
                  <span>Stake: ${log.stake}</span>
                  <span className={log.isWin ? 'text-emerald-700' : 'text-rose-700'}>
                    {log.isWin ? `+$${log.pnl}` : `-$${Math.abs(log.pnl)}`}
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
