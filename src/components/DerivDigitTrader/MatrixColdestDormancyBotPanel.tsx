import React, { useState, useEffect, useRef, useMemo } from 'react';
import { MarketSymbol, ActiveContract } from '../../types/deriv';
import { derivWS, extractDerivLastDigit, formatDerivQuote, getMarketPipSize } from '../../services/derivWebSocket';
import { soundManager } from '../../utils/soundEffects';
import {
  Bot,
  Play,
  Square,
  Zap,
  Snowflake,
  Flame,
  ShieldCheck,
  ShieldAlert,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Sliders,
  RotateCcw,
  CheckCircle2,
  XCircle,
  Clock,
  Activity,
  Radar,
  Target,
  ChevronDown,
  ChevronUp,
  Trash2,
  Sparkles,
  Info,
  Layers,
  ArrowRight,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw,
} from 'lucide-react';

export interface MarketMatrixRow {
  symbol: MarketSymbol;
  name: string;
  shortName: string;
  price: number;
  pipSize: number;
  lastDigit: number;
  change: number;
  hotDigit: number;
  hotPct: number;
  coldDigit: number;
  coldPct: number;
  coldCount: number;
  coldDormancy: number;
  recentDigits: number[];
  digitPercentages: number[];
  evenPct: number;
  oddPct: number;
  isSuperCold: boolean;
  isOneSecond: boolean;
}

interface ColdShiftEvent {
  symbol: MarketSymbol;
  marketName: string;
  fromDigit: number;
  fromPct: number;
  toDigit: number;
  toPct: number;
  timestamp: number;
}

interface BotTradeLog {
  id: string;
  time: number;
  symbol: MarketSymbol;
  marketName: string;
  coldDigit: number;
  coldPct: number;
  coldDormancy: number;
  prevColdDigit?: number;
  prevColdPct?: number;
  triggerReason: string;
  stake: number;
  status: 'OPEN' | 'WON' | 'LOST' | 'CANCELLED';
  profit: number;
  exitSpot?: number;
  exitDigit?: number;
}

interface MatrixColdestDormancyBotPanelProps {
  matrixRows: MarketMatrixRow[];
  matrixData: Record<string, number[]>;
  balanceUsd: number;
  onUpdateBalance?: (newBalance: number) => void;
  onManualTradeDiffer?: (row: MarketMatrixRow) => void;
}

export const MatrixColdestDormancyBotPanel: React.FC<MatrixColdestDormancyBotPanelProps> = ({
  matrixRows,
  matrixData,
  balanceUsd,
  onUpdateBalance,
  onManualTradeDiffer,
}) => {
  // 🤖 Bot Execution State
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string>(
    'Bot Standby - Ready to scan all markets for immediate Coldest Digit Changes & Differ execution'
  );

  // ⚙️ Strategy Configuration
  const [strategyMode, setStrategyMode] = useState<'COLD_SHIFT' | 'COLD_SHIFT_DORMANT' | 'DORMANCY_STRIKE'>('COLD_SHIFT');
  const [baseStake, setBaseStake] = useState<number>(1.0);
  const [currentStake, setCurrentStake] = useState<number>(1.0);
  const [durationTicks, setDurationTicks] = useState<number>(1);
  const [minDormancyForShift, setMinDormancyForShift] = useState<number>(2); // If mode is COLD_SHIFT_DORMANT
  const [dormancyThreshold, setDormancyThreshold] = useState<number>(4); // If mode is DORMANCY_STRIKE
  const [maxFreqFilter, setMaxFreqFilter] = useState<number>(10.0); // Only if new coldest digit freq <= 10.0%
  const [enableFreqFilter, setEnableFreqFilter] = useState<boolean>(false); // Allow any new shift by default or filtered
  const [marketScope, setMarketScope] = useState<'ALL' | 'STANDARD' | '1S'>('ALL');

  // 💰 Money Management & Risk Guard
  const [moneyManagement, setMoneyManagement] = useState<'FIXED' | 'AUTO_COMPOUND' | 'MARTINGALE'>('FIXED');
  const [martingaleMultiplier, setMartingaleMultiplier] = useState<number>(10.5); // Recovery for Differ ~9.8% payout
  const [compoundReinvestPct, setCompoundReinvestPct] = useState<number>(100);
  const [takeProfit, setTakeProfit] = useState<number>(10.0);
  const [stopLoss, setStopLoss] = useState<number>(20.0);
  const [maxConsecutiveLosses, setMaxConsecutiveLosses] = useState<number>(2);
  const [maxConcurrentTrades, setMaxConcurrentTrades] = useState<number>(2);
  const [marketCooldownSec, setMarketCooldownSec] = useState<number>(1); // Seconds to wait before re-triggering same market

  // 📊 Live Statistics
  const [totalTrades, setTotalTrades] = useState<number>(0);
  const [totalWins, setTotalWins] = useState<number>(0);
  const [totalLosses, setTotalLosses] = useState<number>(0);
  const [totalProfit, setTotalProfit] = useState<number>(0);
  const [consecutiveLosses, setConsecutiveLosses] = useState<number>(0);
  const [peakProfit, setPeakProfit] = useState<number>(0);
  const [tradeLogs, setTradeLogs] = useState<BotTradeLog[]>([]);
  const [activeBotContracts, setActiveBotContracts] = useState<ActiveContract[]>([]);
  const [recentShifts, setRecentShifts] = useState<ColdShiftEvent[]>([]);

  // UI state
  const [showSettings, setShowSettings] = useState<boolean>(false);
  const [activeViewTab, setActiveViewTab] = useState<'radar' | 'logs' | 'shifts'>('radar');

  // Tracking maps for previous cold digits per symbol
  const lastKnownColdMap = useRef<Map<string, { digit: number; pct: number; timestamp: number }>>(new Map());
  const lastTradeTimeMap = useRef<Map<string, number>>(new Map());
  const lastProcessedPriceMap = useRef<Map<string, number>>(new Map());
  const marketTradedColdDigitMap = useRef<Map<string, number>>(new Map()); // 1 trade per cold digit shift per market

  // Strict Sequential Trade Lock (Waits for previous trade to finish & balance to update)
  const isTradeInProgressRef = useRef<boolean>(false);
  const activeTradeContractIdRef = useRef<string | null>(null);
  const balanceUsdRef = useRef<number>(balanceUsd);

  // Tracking refs to avoid stale closures in tick loops
  const isRunningRef = useRef(isRunning);
  const currentStakeRef = useRef(currentStake);
  const baseStakeRef = useRef(baseStake);
  const strategyModeRef = useRef(strategyMode);
  const moneyManagementRef = useRef(moneyManagement);
  const martingaleMultiplierRef = useRef(martingaleMultiplier);
  const compoundReinvestPctRef = useRef(compoundReinvestPct);
  const takeProfitRef = useRef(takeProfit);
  const stopLossRef = useRef(stopLoss);
  const maxConsecutiveLossesRef = useRef(maxConsecutiveLosses);
  const consecutiveLossesRef = useRef(consecutiveLosses);
  const totalProfitRef = useRef(totalProfit);
  const activeContractsRef = useRef(activeBotContracts);
  const maxConcurrentTradesRef = useRef(maxConcurrentTrades);
  const minDormancyForShiftRef = useRef(minDormancyForShift);
  const dormancyThresholdRef = useRef(dormancyThreshold);
  const enableFreqFilterRef = useRef(enableFreqFilter);
  const maxFreqFilterRef = useRef(maxFreqFilter);
  const durationTicksRef = useRef(durationTicks);
  const marketScopeRef = useRef(marketScope);
  const marketCooldownSecRef = useRef(marketCooldownSec);

  // Keep refs synchronized
  useEffect(() => { balanceUsdRef.current = balanceUsd; }, [balanceUsd]);
  useEffect(() => { isRunningRef.current = isRunning; }, [isRunning]);
  useEffect(() => { currentStakeRef.current = currentStake; }, [currentStake]);
  useEffect(() => { baseStakeRef.current = baseStake; }, [baseStake]);
  useEffect(() => { strategyModeRef.current = strategyMode; }, [strategyMode]);
  useEffect(() => { moneyManagementRef.current = moneyManagement; }, [moneyManagement]);
  useEffect(() => { martingaleMultiplierRef.current = martingaleMultiplier; }, [martingaleMultiplier]);
  useEffect(() => { compoundReinvestPctRef.current = compoundReinvestPct; }, [compoundReinvestPct]);
  useEffect(() => { takeProfitRef.current = takeProfit; }, [takeProfit]);
  useEffect(() => { stopLossRef.current = stopLoss; }, [stopLoss]);
  useEffect(() => { maxConsecutiveLossesRef.current = maxConsecutiveLosses; }, [maxConsecutiveLosses]);
  useEffect(() => { consecutiveLossesRef.current = consecutiveLosses; }, [consecutiveLosses]);
  useEffect(() => { totalProfitRef.current = totalProfit; }, [totalProfit]);
  useEffect(() => { activeContractsRef.current = activeBotContracts; }, [activeBotContracts]);
  useEffect(() => { maxConcurrentTradesRef.current = maxConcurrentTrades; }, [maxConcurrentTrades]);
  useEffect(() => { minDormancyForShiftRef.current = minDormancyForShift; }, [minDormancyForShift]);
  useEffect(() => { dormancyThresholdRef.current = dormancyThreshold; }, [dormancyThreshold]);
  useEffect(() => { enableFreqFilterRef.current = enableFreqFilter; }, [enableFreqFilter]);
  useEffect(() => { maxFreqFilterRef.current = maxFreqFilter; }, [maxFreqFilter]);
  useEffect(() => { durationTicksRef.current = durationTicks; }, [durationTicks]);
  useEffect(() => { marketScopeRef.current = marketScope; }, [marketScope]);
  useEffect(() => { marketCooldownSecRef.current = marketCooldownSec; }, [marketCooldownSec]);

  // Helper to extract numeric volatility rating for strict ascending order (10 -> 100)
  const getVolatilityRating = (symbol: string): number => {
    if (symbol.includes('10V') || symbol.endsWith('_10') || symbol === 'R_10') return 10;
    if (symbol.includes('25V') || symbol.endsWith('_25') || symbol === 'R_25') return 25;
    if (symbol.includes('50V') || symbol.endsWith('_50') || symbol === 'R_50') return 50;
    if (symbol.includes('75V') || symbol.endsWith('_75') || symbol === 'R_75') return 75;
    if (symbol.includes('100V') || symbol.endsWith('_100') || symbol === 'R_100') return 100;
    if (symbol.includes('150V') || symbol.endsWith('_150') || symbol === 'R_150') return 150;
    if (symbol.includes('250V') || symbol.endsWith('_250') || symbol === 'R_250') return 250;
    return 999;
  };

  // 🎯 Listen for contract settlements from Deriv WS & synchronously unlock after balance update
  useEffect(() => {
    const handleContractUpdate = (contract: ActiveContract) => {
      setTradeLogs((prevLogs) => {
        const logIndex = prevLogs.findIndex((l) => l.id === contract.id);
        if (logIndex === -1) return prevLogs;

        const existing = prevLogs[logIndex];
        if (contract.status === 'WON' || contract.status === 'LOST') {
          const isWin = contract.status === 'WON';
          const pnl = isWin ? contract.currentProfit : -existing.stake;

          const updatedLog: BotTradeLog = {
            ...existing,
            status: contract.status,
            profit: pnl,
            exitSpot: contract.currentSpot,
            exitDigit: contract.currentSpot !== undefined
              ? extractDerivLastDigit(contract.currentSpot, getMarketPipSize(contract.symbol), contract.symbol)
              : undefined,
          };

          const newLogs = [...prevLogs];
          newLogs[logIndex] = updatedLog;

          // Update statistics
          setTotalTrades((t) => t + 1);
          if (isWin) {
            setTotalWins((w) => w + 1);
            setConsecutiveLosses(0);
            consecutiveLossesRef.current = 0;
            soundManager.playWin();
          } else {
            setTotalLosses((l) => l + 1);
            setConsecutiveLosses((c) => c + 1);
            consecutiveLossesRef.current += 1;
            soundManager.playLoss();
          }

          setTotalProfit((p) => {
            const nextP = Number((p + pnl).toFixed(2));
            totalProfitRef.current = nextP;
            setPeakProfit((pk) => Math.max(pk, nextP));

            // Check Risk Bounds
            if (takeProfitRef.current > 0 && nextP >= takeProfitRef.current) {
              setIsRunning(false);
              setStatusMessage(`🏆 Take Profit reached! Target +$${takeProfitRef.current.toFixed(2)} achieved.`);
              soundManager.playWin();
            } else if (stopLossRef.current > 0 && nextP <= -stopLossRef.current) {
              setIsRunning(false);
              setStatusMessage(`🛑 Stop Loss triggered! Loss limit -$${stopLossRef.current.toFixed(2)} reached.`);
              soundManager.playLoss();
            }

            return nextP;
          });

          // Check consecutive losses guard
          if (consecutiveLossesRef.current >= maxConsecutiveLossesRef.current && maxConsecutiveLossesRef.current > 0) {
            setIsRunning(false);
            setStatusMessage(`🛑 Max consecutive losses (${maxConsecutiveLossesRef.current}) reached. Bot stopped for safety.`);
          }

          // Adjust next stake according to Money Management
          if (isWin) {
            if (moneyManagementRef.current === 'AUTO_COMPOUND') {
              const reinvest = pnl * (compoundReinvestPctRef.current / 100);
              setCurrentStake((s) => Number(Math.max(0.35, s + reinvest).toFixed(2)));
            } else if (moneyManagementRef.current === 'MARTINGALE') {
              setCurrentStake(baseStakeRef.current);
            }
          } else {
            if (moneyManagementRef.current === 'MARTINGALE') {
              setCurrentStake((s) => Number(Math.max(0.35, s * martingaleMultiplierRef.current).toFixed(2)));
            } else if (moneyManagementRef.current === 'AUTO_COMPOUND') {
              setCurrentStake(baseStakeRef.current);
            }
          }

          // 💳 Update Account Balance
          const nextBalance = Number((balanceUsdRef.current + pnl).toFixed(2));
          if (onUpdateBalance) {
            onUpdateBalance(nextBalance);
          }

          // 🔓 Unlock Trade Lock after balance has updated and contract is closed
          setTimeout(() => {
            if (activeTradeContractIdRef.current === contract.id) {
              isTradeInProgressRef.current = false;
              activeTradeContractIdRef.current = null;
              if (isRunningRef.current) {
                setStatusMessage(
                  `✅ Trade ${isWin ? `WON (+$${pnl.toFixed(2)})` : `LOST (-$${Math.abs(pnl).toFixed(2)})`} on ${existing.marketName} | Balance updated ($${nextBalance.toFixed(2)}). Scanning 10➔100 Vol in ascending order...`
                );
              }
            }
          }, 600);

          return newLogs;
        }

        return prevLogs;
      });

      // Update active contracts list
      setActiveBotContracts((prev) => {
        const idx = prev.findIndex((c) => c.id === contract.id);
        if (contract.status === 'OPEN') {
          if (idx >= 0) {
            const upd = [...prev];
            upd[idx] = contract;
            return upd;
          }
          return [contract, ...prev];
        }
        return prev.filter((c) => c.id !== contract.id);
      });
    };

    derivWS.subscribeContracts(handleContractUpdate);
    return () => derivWS.unsubscribeContracts(handleContractUpdate);
  }, [onUpdateBalance]);

  // 🚀 CORE SCANNER ENGINE: Ascending Scan (10 ➔ 100 Volatility), 1 Trade Per Market, Sequential Balance Settlement
  useEffect(() => {
    const now = Date.now();
    const scope = marketScopeRef.current;
    const checkFreq = enableFreqFilterRef.current;
    const maxFreq = maxFreqFilterRef.current;
    const cooldownMs = marketCooldownSecRef.current * 1000;
    const strat = strategyModeRef.current;

    // 1. Filter rows based on market scope
    const eligibleRows = matrixRows.filter((r) => {
      if (scope === 'STANDARD') return !r.isOneSecond;
      if (scope === '1S') return r.isOneSecond;
      return true;
    });

    // 2. Sort strictly in ASCENDING order of Volatility (10 ➔ 25 ➔ 50 ➔ 75 ➔ 100)
    const sortedAscendingRows = [...eligibleRows].sort((a, b) => {
      const volA = getVolatilityRating(a.symbol);
      const volB = getVolatilityRating(b.symbol);
      if (volA !== volB) return volA - volB;
      // Secondary sort: standard markets first, then 1s markets
      return (a.isOneSecond ? 1 : 0) - (b.isOneSecond ? 1 : 0);
    });

    for (const row of sortedAscendingRows) {
      const prices = matrixData[row.symbol] || [];
      if (prices.length < 15) continue;

      // Skip duplicate processing on the exact same price quote
      const lastPriceSeen = lastProcessedPriceMap.current.get(row.symbol);
      if (lastPriceSeen === row.price) {
        continue; // Price has not updated since last scan
      }
      lastProcessedPriceMap.current.set(row.symbol, row.price);

      // Previous cold digit known for this market
      const prevCold = lastKnownColdMap.current.get(row.symbol);
      const currentColdDigit = row.coldDigit;
      const currentColdPct = row.coldPct;
      const volRating = getVolatilityRating(row.symbol);

      // 1. Initial record baseline if first time seeing this market
      if (!prevCold) {
        lastKnownColdMap.current.set(row.symbol, {
          digit: currentColdDigit,
          pct: currentColdPct,
          timestamp: now,
        });
        continue;
      }

      // Check if Coldest Digit has CHANGED
      const isColdShift = prevCold.digit !== currentColdDigit;

      if (isColdShift) {
        // Record shift event for UI radar / shifts stream
        const shiftEvent: ColdShiftEvent = {
          symbol: row.symbol,
          marketName: row.shortName,
          fromDigit: prevCold.digit,
          fromPct: prevCold.pct,
          toDigit: currentColdDigit,
          toPct: currentColdPct,
          timestamp: now,
        };

        setRecentShifts((prev) => [shiftEvent, ...prev.slice(0, 29)]);

        // Update the known cold digit map immediately so it registers the shift
        lastKnownColdMap.current.set(row.symbol, {
          digit: currentColdDigit,
          pct: currentColdPct,
          timestamp: now,
        });

        // If the bot is NOT running, keep tracking shifts for UI, but don't trade
        if (!isRunningRef.current) {
          continue;
        }

        // 🛑 STRICT EXECUTION GUARD 1: Wait for previous trade to close & update balance
        if (isTradeInProgressRef.current || activeContractsRef.current.length > 0) {
          continue;
        }

        // 🛑 STRICT EXECUTION GUARD 2: Only 1 trade per market per cold digit shift
        const lastTradedDigitForMarket = marketTradedColdDigitMap.current.get(row.symbol);
        if (lastTradedDigitForMarket === currentColdDigit) {
          continue; // Already executed 1 trade on this market for this cold digit shift
        }

        // Check cooldown for this market
        const lastTradeTime = lastTradeTimeMap.current.get(row.symbol) || 0;
        if (now - lastTradeTime < cooldownMs) {
          continue;
        }

        // Check Frequency Filter if enabled
        if (checkFreq && currentColdPct > maxFreq) {
          continue;
        }

        // Check Strategy Specific Criteria
        let shouldTrigger = false;
        let triggerLabel = '';

        if (strat === 'COLD_SHIFT') {
          // IMMEDIATE TRIGGER: Coldest digit changed!
          shouldTrigger = true;
          triggerLabel = `Cold Shift (Vol ${volRating}): Digit ${prevCold.digit} (${prevCold.pct}%) ➔ Digit ${currentColdDigit} (${currentColdPct}%)`;
        } else if (strat === 'COLD_SHIFT_DORMANT') {
          // Coldest digit changed AND has min dormancy
          if (row.coldDormancy >= minDormancyForShiftRef.current) {
            shouldTrigger = true;
            triggerLabel = `Cold Shift + ${row.coldDormancy}t Dormant (Vol ${volRating}): ${prevCold.digit} (${prevCold.pct}%) ➔ ${currentColdDigit} (${currentColdPct}%)`;
          }
        }

        if (shouldTrigger) {
          const stakeToUse = currentStakeRef.current;
          const dur = durationTicksRef.current;

          // Lock trading state synchronously BEFORE dispatching order
          isTradeInProgressRef.current = true;
          lastTradeTimeMap.current.set(row.symbol, now);
          marketTradedColdDigitMap.current.set(row.symbol, currentColdDigit); // Mark 1 trade on this market
          soundManager.playLaser();

          try {
            const contract = derivWS.purchaseContract({
              symbol: row.symbol,
              contractType: 'DIGITDIFF',
              stake: stakeToUse,
              durationTicks: dur,
              targetDigit: currentColdDigit,
              symbolName: row.name,
            });

            if (contract.status === 'CANCELLED') {
              isTradeInProgressRef.current = false;
              setStatusMessage(`⚠️ Order blocked on ${row.shortName}: Protected by Strategy Shield`);
              console.warn('[Matrix Bot] Contract purchase was cancelled by StrategyShield:', contract);
              continue;
            }

            activeTradeContractIdRef.current = contract.id;

            const newLog: BotTradeLog = {
              id: contract.id,
              time: now,
              symbol: row.symbol,
              marketName: row.name,
              coldDigit: currentColdDigit,
              coldPct: currentColdPct,
              coldDormancy: row.coldDormancy,
              prevColdDigit: prevCold.digit,
              prevColdPct: prevCold.pct,
              triggerReason: triggerLabel,
              stake: stakeToUse,
              status: 'OPEN',
              profit: 0,
            };

            setTradeLogs((prev) => [newLog, ...prev.slice(0, 49)]);
            setStatusMessage(
              `⚡ [Vol ${volRating}] Trade Placed on ${row.shortName}: Differ New Cold Digit ${currentColdDigit} ($${stakeToUse.toFixed(2)}) ➔ Waiting for closure & balance update...`
            );

            // Break out of market loop so only this 1 trade is active
            break;
          } catch (err: any) {
            isTradeInProgressRef.current = false;
            console.error('Matrix Bot Execution Error:', err);
            setStatusMessage(`⚠️ Order failed: ${err?.message || 'Network error'}`);
          }
        }
      } else {
        // Cold digit stayed the same; keep percentage fresh
        prevCold.pct = currentColdPct;

        // If strategy is DORMANCY_STRIKE, check dormancy threshold
        if (isRunningRef.current && strat === 'DORMANCY_STRIKE') {
          if (row.coldDormancy === dormancyThresholdRef.current) {
            if (!isTradeInProgressRef.current && activeContractsRef.current.length === 0) {
              const lastTradedDigitForMarket = marketTradedColdDigitMap.current.get(row.symbol);
              if (lastTradedDigitForMarket !== currentColdDigit) {
                const lastTradeTime = lastTradeTimeMap.current.get(row.symbol) || 0;
                if (now - lastTradeTime >= cooldownMs) {
                  if (!checkFreq || currentColdPct <= maxFreq) {
                    const stakeToUse = currentStakeRef.current;
                    const dur = durationTicksRef.current;

                    isTradeInProgressRef.current = true;
                    lastTradeTimeMap.current.set(row.symbol, now);
                    marketTradedColdDigitMap.current.set(row.symbol, currentColdDigit);
                    soundManager.playLaser();

                    try {
                      const contract = derivWS.purchaseContract({
                        symbol: row.symbol,
                        contractType: 'DIGITDIFF',
                        stake: stakeToUse,
                        durationTicks: dur,
                        targetDigit: currentColdDigit,
                        symbolName: row.name,
                      });

                      if (contract.status === 'CANCELLED') {
                        isTradeInProgressRef.current = false;
                        setStatusMessage(`⚠️ Order blocked on ${row.shortName}: Protected by Strategy Shield`);
                        continue;
                      }

                      activeTradeContractIdRef.current = contract.id;

                      const newLog: BotTradeLog = {
                        id: contract.id,
                        time: now,
                        symbol: row.symbol,
                        marketName: row.name,
                        coldDigit: currentColdDigit,
                        coldPct: currentColdPct,
                        coldDormancy: row.coldDormancy,
                        triggerReason: `${row.coldDormancy}-Tick Dormant Strike (Vol ${volRating}) on Digit ${currentColdDigit}`,
                        stake: stakeToUse,
                        status: 'OPEN',
                        profit: 0,
                      };

                      setTradeLogs((prev) => [newLog, ...prev.slice(0, 49)]);
                      setStatusMessage(
                        `🎯 [Vol ${volRating}] Trade Placed on ${row.shortName}: Differ Cold Digit ${currentColdDigit} ($${stakeToUse.toFixed(2)}) ➔ Waiting for closure & balance update...`
                      );
                      break;
                    } catch (err: any) {
                      isTradeInProgressRef.current = false;
                      console.error('Matrix Bot Execution Error:', err);
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }, [matrixData, matrixRows]);

  // Start / Stop Bot Handler
  const toggleBot = () => {
    if (isRunning) {
      setIsRunning(false);
      setStatusMessage('Bot Stopped by user.');
      soundManager.playButtonClick();
    } else {
      if (balanceUsd < currentStake) {
        setStatusMessage('⚠️ Insufficient balance for initial stake.');
        soundManager.playLoss();
        return;
      }
      setIsRunning(true);
      setCurrentStake(baseStake);
      setConsecutiveLosses(0);
      isTradeInProgressRef.current = false;
      activeTradeContractIdRef.current = null;
      marketTradedColdDigitMap.current.clear();
      setStatusMessage(`🚀 Bot Active! Scanning 10➔100 Volatility in ascending order for Coldest Digit Shifts...`);
      soundManager.playStart();
    }
  };

  // Reset Session Stats
  const resetStats = () => {
    setTotalTrades(0);
    setTotalWins(0);
    setTotalLosses(0);
    setTotalProfit(0);
    setConsecutiveLosses(0);
    setPeakProfit(0);
    setTradeLogs([]);
    setRecentShifts([]);
    setCurrentStake(baseStake);
    isTradeInProgressRef.current = false;
    activeTradeContractIdRef.current = null;
    marketTradedColdDigitMap.current.clear();
    setStatusMessage('Session statistics reset.');
    soundManager.playButtonClick();
  };

  const winRate = totalTrades > 0 ? ((totalWins / totalTrades) * 100).toFixed(1) : '0.0';

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-2xl space-y-4 font-sans text-slate-100">
      {/* 🚀 BOT HEADER & MASTER CONTROLS */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className={`p-3 rounded-2xl flex items-center justify-center transition-all ${
            isRunning
              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 shadow-lg shadow-emerald-500/20 animate-pulse'
              : 'bg-slate-800 text-slate-400 border border-slate-700'
          }`}>
            <Bot className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-lg font-black text-white tracking-tight flex items-center gap-2">
                Matrix Coldest Shift Differ Sniper Bot
              </h3>
              <span className={`text-[10px] font-mono font-black px-2.5 py-0.5 rounded-full border ${
                isRunning
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50 animate-pulse'
                  : 'bg-slate-800 text-slate-400 border-slate-700'
              }`}>
                {isRunning ? '● LIVE 10➔100 VOL ASCENDING SCANNER' : '○ STANDBY'}
              </span>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                {strategyMode === 'COLD_SHIFT' ? '⚡ IMMEDIATE COLD SHIFT TRIGGER' : strategyMode === 'COLD_SHIFT_DORMANT' ? '⚡ SHIFT + DORMANT TRIGGER' : '🎯 4-TICK DORMANT TRIGGER'}
              </span>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/30">
                1 Trade Per Market • Sequential Balance Settlement
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Scans markets from <strong className="text-cyan-400">10 Volatility to 100 Volatility in ascending order</strong>. Executes 1 Differ trade per market on coldest digit shifts, and strictly waits for the trade to close and update the balance before evaluating the next trade.
            </p>
          </div>
        </div>

        {/* Master Start / Stop Button & Config */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => setShowSettings(!showSettings)}
            className={`px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border ${
              showSettings
                ? 'bg-slate-700 text-white border-slate-600'
                : 'bg-slate-800/80 text-slate-300 hover:text-white border-slate-700 hover:bg-slate-750'
            }`}
          >
            <Sliders className="w-3.5 h-3.5 text-emerald-400" />
            <span>Settings</span>
            {showSettings ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>

          <button
            onClick={resetStats}
            title="Reset Session Stats"
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white border border-slate-700 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={toggleBot}
            className={`px-5 py-2.5 rounded-xl font-black text-xs transition-all flex items-center gap-2 shadow-xl select-none ${
              isRunning
                ? 'bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white shadow-rose-600/30 ring-2 ring-rose-500/50 active:scale-95'
                : 'bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-emerald-600/30 ring-2 ring-emerald-500/40 active:scale-95'
            }`}
          >
            {isRunning ? (
              <>
                <Square className="w-4 h-4 fill-white" />
                <span>STOP SHIFT BOT</span>
              </>
            ) : (
              <>
                <Play className="w-4 h-4 fill-white" />
                <span>START SHIFT BOT</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* 📊 LIVE METRICS STRIP */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 font-mono">
        {/* Total PnL */}
        <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800/80">
          <div className="text-[10px] text-slate-400 font-sans uppercase font-bold flex items-center justify-between">
            <span>Net Profit</span>
            <DollarSign className="w-3 h-3 text-slate-500" />
          </div>
          <div className={`text-base font-black mt-1 ${
            totalProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'
          }`}>
            {totalProfit >= 0 ? `+$${totalProfit.toFixed(2)}` : `-$${Math.abs(totalProfit).toFixed(2)}`}
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">
            Peak: +${peakProfit.toFixed(2)}
          </div>
        </div>

        {/* Win Rate */}
        <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800/80">
          <div className="text-[10px] text-slate-400 font-sans uppercase font-bold flex items-center justify-between">
            <span>Win Rate</span>
            <TrendingUp className="w-3 h-3 text-emerald-400" />
          </div>
          <div className="text-base font-black text-emerald-400 mt-1">
            {winRate}%
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">
            {totalWins}W / {totalLosses}L ({totalTrades} total)
          </div>
        </div>

        {/* Next Stake */}
        <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800/80">
          <div className="text-[10px] text-slate-400 font-sans uppercase font-bold flex items-center justify-between">
            <span>Next Stake</span>
            <Zap className="w-3 h-3 text-amber-400" />
          </div>
          <div className="text-base font-black text-amber-400 mt-1">
            ${currentStake.toFixed(2)}
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">
            Base: ${baseStake.toFixed(2)}
          </div>
        </div>

        {/* Strategy Mode */}
        <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800/80">
          <div className="text-[10px] text-slate-400 font-sans uppercase font-bold flex items-center justify-between">
            <span>Trigger Event</span>
            <Sparkles className="w-3 h-3 text-cyan-400" />
          </div>
          <div className="text-xs font-black text-cyan-300 mt-1 truncate">
            {strategyMode === 'COLD_SHIFT' ? 'Immediate Shift' : strategyMode === 'COLD_SHIFT_DORMANT' ? 'Shift + Dormant' : 'Dormant Strike'}
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">
            Differ {durationTicks}T Contract
          </div>
        </div>

        {/* Active Contracts */}
        <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800/80">
          <div className="text-[10px] text-slate-400 font-sans uppercase font-bold flex items-center justify-between">
            <span>Active Orders</span>
            <Activity className="w-3 h-3 text-indigo-400" />
          </div>
          <div className="text-base font-black text-indigo-300 mt-1">
            {activeBotContracts.length} / {maxConcurrentTrades}
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">
            Payout ~+9.8%
          </div>
        </div>

        {/* Consec Losses */}
        <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800/80">
          <div className="text-[10px] text-slate-400 font-sans uppercase font-bold flex items-center justify-between">
            <span>Loss Streak</span>
            <ShieldCheck className="w-3 h-3 text-rose-400" />
          </div>
          <div className={`text-base font-black mt-1 ${
            consecutiveLosses > 0 ? 'text-rose-400' : 'text-slate-300'
          }`}>
            {consecutiveLosses} / {maxConsecutiveLosses}
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">
            Safety Guard
          </div>
        </div>
      </div>

      {/* 🔔 LIVE STATUS STRIP */}
      <div className="flex items-center justify-between gap-3 px-3.5 py-2.5 bg-slate-950 rounded-xl border border-slate-800 text-xs">
        <div className="flex items-center gap-2 overflow-hidden">
          <span className="flex h-2 w-2 relative flex-shrink-0">
            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
              isRunning ? 'bg-emerald-400' : 'bg-slate-500'
            }`}></span>
            <span className={`relative inline-flex rounded-full h-2 w-2 ${
              isRunning ? 'bg-emerald-500' : 'bg-slate-600'
            }`}></span>
          </span>
          <span className="text-slate-300 truncate font-mono">
            {statusMessage}
          </span>
        </div>

        {/* Quick Strategy Mode Selector */}
        <div className="flex items-center gap-1 flex-shrink-0 font-mono text-[11px]">
          <button
            onClick={() => {
              setStrategyMode('COLD_SHIFT');
              soundManager.playButtonClick();
            }}
            className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
              strategyMode === 'COLD_SHIFT'
                ? 'bg-emerald-600 text-white shadow-sm ring-1 ring-emerald-400'
                : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            ⚡ Cold Shift (Immediate)
          </button>
          <button
            onClick={() => {
              setStrategyMode('COLD_SHIFT_DORMANT');
              soundManager.playButtonClick();
            }}
            className={`px-2 py-1 rounded-lg font-bold transition-all hidden sm:inline ${
              strategyMode === 'COLD_SHIFT_DORMANT'
                ? 'bg-indigo-600 text-white shadow-sm ring-1 ring-indigo-400'
                : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            Shift + Dormant
          </button>
        </div>
      </div>

      {/* ⚙️ ADVANCED SETTINGS PANEL (EXPANDABLE) */}
      {showSettings && (
        <div className="p-4 bg-slate-950/90 rounded-2xl border border-slate-800 space-y-4 animate-in fade-in duration-200">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
            <div className="flex items-center gap-2">
              <Sliders className="w-4 h-4 text-emerald-400" />
              <h4 className="text-sm font-bold text-white">Bot Strategy & Risk Controls</h4>
            </div>
            <span className="text-[11px] text-slate-400 font-mono">
              Differ Win Probability: ~90% (Differ ≠ New Coldest Digit)
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
            {/* Primary Strategy Mode */}
            <div className="space-y-1.5">
              <label className="text-slate-400 font-semibold block">Strategy Trigger Mode:</label>
              <select
                value={strategyMode}
                onChange={(e) => setStrategyMode(e.target.value as any)}
                className="w-full bg-slate-900 text-emerald-400 font-mono font-bold rounded-xl px-3 py-2 border border-slate-700 focus:outline-none"
              >
                <option value="COLD_SHIFT">Immediate Cold Shift (New Cold Differ)</option>
                <option value="COLD_SHIFT_DORMANT">Cold Shift + Min Dormancy</option>
                <option value="DORMANCY_STRIKE">4-Tick Dormancy Strike</option>
              </select>
              <p className="text-[10px] text-slate-500">
                {strategyMode === 'COLD_SHIFT' && 'Triggers Differ immediately on new cold digit when coldest digit changes.'}
                {strategyMode === 'COLD_SHIFT_DORMANT' && 'Triggers only when coldest digit changes and has min dormancy.'}
                {strategyMode === 'DORMANCY_STRIKE' && 'Triggers when a cold digit reaches 4 ticks dormant.'}
              </p>
            </div>

            {/* Base Stake */}
            <div className="space-y-1.5">
              <label className="text-slate-400 font-semibold block">Base Stake ($):</label>
              <div className="relative">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500 font-mono font-bold">$</span>
                <input
                  type="number"
                  min="0.35"
                  step="0.5"
                  value={baseStake}
                  onChange={(e) => {
                    const val = Math.max(0.35, parseFloat(e.target.value) || 0.35);
                    setBaseStake(val);
                    if (!isRunning) setCurrentStake(val);
                  }}
                  className="w-full bg-slate-900 text-white font-mono font-bold rounded-xl pl-6 pr-2 py-2 border border-slate-700 focus:border-emerald-500 focus:outline-none"
                />
              </div>
              <div className="flex items-center gap-1 pt-1">
                {[0.35, 1, 2, 5, 10, 25].map((amt) => (
                  <button
                    key={amt}
                    onClick={() => {
                      setBaseStake(amt);
                      if (!isRunning) setCurrentStake(amt);
                    }}
                    className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold ${
                      baseStake === amt
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                    }`}
                  >
                    ${amt}
                  </button>
                ))}
              </div>
            </div>

            {/* Money Management */}
            <div className="space-y-1.5">
              <label className="text-slate-400 font-semibold block">Money Management:</label>
              <select
                value={moneyManagement}
                onChange={(e) => setMoneyManagement(e.target.value as any)}
                className="w-full bg-slate-900 text-white font-mono font-bold rounded-xl px-3 py-2 border border-slate-700 focus:outline-none"
              >
                <option value="FIXED">Fixed Base Stake</option>
                <option value="AUTO_COMPOUND">Auto-Compound (Reinvest Win Profit)</option>
                <option value="MARTINGALE">Martingale Recovery on Loss (10.5x)</option>
              </select>
            </div>

            {/* Trade Duration Ticks */}
            <div className="space-y-1.5">
              <label className="text-slate-400 font-semibold block">Contract Duration & Cooldown:</label>
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={durationTicks}
                  onChange={(e) => setDurationTicks(parseInt(e.target.value, 10))}
                  className="bg-slate-900 text-white font-mono text-[11px] rounded-xl px-2 py-2 border border-slate-700 focus:outline-none"
                >
                  <option value={1}>1 Tick</option>
                  <option value={2}>2 Ticks</option>
                  <option value={3}>3 Ticks</option>
                  <option value={5}>5 Ticks</option>
                </select>

                <select
                  value={marketCooldownSec}
                  onChange={(e) => setMarketCooldownSec(parseInt(e.target.value, 10))}
                  className="bg-slate-900 text-white font-mono text-[11px] rounded-xl px-2 py-2 border border-slate-700 focus:outline-none"
                >
                  <option value={2}>2s Cooldown</option>
                  <option value={3}>3s Cooldown</option>
                  <option value={5}>5s Cooldown</option>
                  <option value={10}>10s Cooldown</option>
                </select>
              </div>
            </div>

            {/* Take Profit Target */}
            <div className="space-y-1.5">
              <label className="text-slate-400 font-semibold block">Take Profit Target ($):</label>
              <input
                type="number"
                min="0"
                step="1"
                value={takeProfit}
                onChange={(e) => setTakeProfit(parseFloat(e.target.value) || 0)}
                className="w-full bg-slate-900 text-emerald-400 font-mono font-bold rounded-xl px-3 py-2 border border-slate-700 focus:outline-none"
                placeholder="0 = No limit"
              />
            </div>

            {/* Stop Loss Limit */}
            <div className="space-y-1.5">
              <label className="text-slate-400 font-semibold block">Stop Loss Limit ($):</label>
              <input
                type="number"
                min="0"
                step="1"
                value={stopLoss}
                onChange={(e) => setStopLoss(parseFloat(e.target.value) || 0)}
                className="w-full bg-slate-900 text-rose-400 font-mono font-bold rounded-xl px-3 py-2 border border-slate-700 focus:outline-none"
                placeholder="0 = No limit"
              />
            </div>

            {/* Max Consecutive Losses */}
            <div className="space-y-1.5">
              <label className="text-slate-400 font-semibold block">Max Consecutive Losses:</label>
              <input
                type="number"
                min="1"
                max="5"
                value={maxConsecutiveLosses}
                onChange={(e) => setMaxConsecutiveLosses(parseInt(e.target.value, 10) || 1)}
                className="w-full bg-slate-900 text-white font-mono font-bold rounded-xl px-3 py-2 border border-slate-700 focus:outline-none"
              />
            </div>

            {/* Max Concurrent Orders */}
            <div className="space-y-1.5">
              <label className="text-slate-400 font-semibold block">Max Concurrent Orders:</label>
              <select
                value={maxConcurrentTrades}
                onChange={(e) => setMaxConcurrentTrades(parseInt(e.target.value, 10))}
                className="w-full bg-slate-900 text-white font-mono font-bold rounded-xl px-3 py-2 border border-slate-700 focus:outline-none"
              >
                <option value={1}>1 Trade At a Time (Safe)</option>
                <option value={2}>2 Parallel Trades</option>
                <option value={3}>3 Parallel Trades</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* 🎯 RADAR, SHIFT TRACKER & EXECUTION LOG VIEWS */}
      <div className="space-y-3">
        <div className="flex items-center justify-between border-b border-slate-800 pb-2">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveViewTab('radar')}
              className={`px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all ${
                activeViewTab === 'radar'
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              <Radar className="w-3.5 h-3.5" />
              <span>Cross-Market Cold Radar ({matrixRows.length})</span>
            </button>
            <button
              onClick={() => setActiveViewTab('shifts')}
              className={`px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all ${
                activeViewTab === 'shifts'
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              <RefreshCw className="w-3.5 h-3.5 text-cyan-400" />
              <span>Live Shift Stream ({recentShifts.length})</span>
            </button>
            <button
              onClick={() => setActiveViewTab('logs')}
              className={`px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all ${
                activeViewTab === 'logs'
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              <Activity className="w-3.5 h-3.5" />
              <span>Bot Execution Log ({tradeLogs.length})</span>
            </button>
          </div>

          <span className="text-[11px] text-slate-500 font-mono hidden sm:inline">
            Real-Time Tick Shift Synchronization
          </span>
        </div>

        {/* 1. CROSS-MARKET COLD RADAR */}
        {activeViewTab === 'radar' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {matrixRows.map((row) => {
              const prevCold = lastKnownColdMap.current.get(row.symbol);
              const hasShifted = prevCold && prevCold.digit !== row.coldDigit;
              const isRecentShift = recentShifts.length > 0 && recentShifts[0].symbol === row.symbol && Date.now() - recentShifts[0].timestamp < 3000;

              return (
                <div
                  key={row.symbol}
                  onClick={() => onManualTradeDiffer && onManualTradeDiffer(row)}
                  className={`p-3.5 rounded-xl border bg-slate-950/70 transition-all cursor-pointer select-none relative overflow-hidden group ${
                    isRecentShift
                      ? 'border-emerald-400 bg-emerald-950/40 ring-2 ring-emerald-400/80 shadow-lg shadow-emerald-500/20'
                      : 'border-slate-800/80 hover:border-slate-700 hover:bg-slate-900/80'
                  }`}
                >
                  {/* Top Bar: Market name & Shift Status */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-white text-xs">{row.shortName}</span>
                      {row.isOneSecond && (
                        <span className="text-[9px] px-1 py-0.1 rounded bg-indigo-500/20 text-indigo-300 font-mono">
                          1s
                        </span>
                      )}
                    </div>

                    {isRecentShift && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-mono font-black border border-emerald-500/50 animate-pulse">
                        ⚡ SHIFT DETECTED
                      </span>
                    )}
                  </div>

                  {/* Coldest Digit Transition View */}
                  <div className="mt-2.5 p-2 rounded-lg bg-slate-900/90 border border-slate-800/80 flex items-center justify-between font-mono text-xs">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] text-slate-500 uppercase font-sans font-semibold">Cold:</span>
                      <span className="px-2 py-0.5 rounded bg-rose-500/20 border border-rose-500/40 text-rose-300 font-black">
                        Digit {row.coldDigit} ({row.coldPct}%)
                      </span>
                    </div>

                    <div className="flex items-center gap-1 text-[11px] text-slate-400">
                      <Snowflake className="w-3 h-3 text-cyan-400" />
                      <span>{row.coldDormancy}t dormant</span>
                    </div>
                  </div>

                  {/* Bottom Strip: Recent Tape & Quick Differ Action */}
                  <div className="mt-2.5 pt-2 border-t border-slate-800/80 flex items-center justify-between">
                    <div className="flex items-center gap-0.5 font-mono text-[10px]">
                      {row.recentDigits.slice(-5).map((d, idx) => (
                        <span
                          key={idx}
                          className={`w-4 h-4 rounded flex items-center justify-center font-bold text-[9px] ${
                            d === row.coldDigit
                              ? 'bg-rose-500/30 text-rose-300 border border-rose-500/50'
                              : 'bg-slate-800 text-slate-400'
                          }`}
                        >
                          {d}
                        </span>
                      ))}
                    </div>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (onManualTradeDiffer) onManualTradeDiffer(row);
                      }}
                      className="text-[10px] font-bold text-emerald-400 hover:text-white font-mono bg-emerald-950/60 hover:bg-emerald-600 px-2 py-0.5 rounded border border-emerald-500/40 transition-colors"
                    >
                      Differ ≠ {row.coldDigit}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* 2. LIVE SHIFT STREAM */}
        {activeViewTab === 'shifts' && (
          <div className="bg-slate-950 rounded-xl border border-slate-800 overflow-hidden">
            {recentShifts.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-xs font-mono">
                No coldest digit shifts recorded yet. The stream will record the moment any market's coldest digit transitions (e.g. Digit 8 ➔ Digit 5).
              </div>
            ) : (
              <div className="overflow-x-auto max-h-96">
                <table className="w-full text-left text-xs font-mono">
                  <thead className="bg-slate-900/90 text-slate-400 uppercase text-[10px] font-semibold border-b border-slate-800 sticky top-0">
                    <tr>
                      <th className="py-2.5 px-3">Time</th>
                      <th className="py-2.5 px-3">Market</th>
                      <th className="py-2.5 px-3">Previous Coldest</th>
                      <th className="py-2.5 px-3 text-center">Transition</th>
                      <th className="py-2.5 px-3">New Coldest Digit</th>
                      <th className="py-2.5 px-3 text-right">Differ Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {recentShifts.map((shift, idx) => (
                      <tr key={idx} className="hover:bg-slate-850/50 transition-colors">
                        <td className="py-2 px-3 text-slate-400">
                          {new Date(shift.timestamp).toLocaleTimeString()}
                        </td>
                        <td className="py-2 px-3 font-sans font-bold text-white">
                          {shift.marketName}
                        </td>
                        <td className="py-2 px-3 text-slate-400">
                          <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">
                            Digit {shift.fromDigit} ({shift.fromPct}%)
                          </span>
                        </td>
                        <td className="py-2 px-3 text-center">
                          <ArrowRight className="w-3.5 h-3.5 text-emerald-400 inline-block" />
                        </td>
                        <td className="py-2 px-3">
                          <span className="px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 font-bold border border-rose-500/40">
                            Digit {shift.toDigit} ({shift.toPct}%)
                          </span>
                        </td>
                        <td className="py-2 px-3 text-right">
                          <span className="text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/30">
                            Differed ≠ {shift.toDigit}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* 3. BOT EXECUTION LOGS */}
        {activeViewTab === 'logs' && (
          <div className="bg-slate-950 rounded-xl border border-slate-800 overflow-hidden">
            {tradeLogs.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-xs font-mono">
                No automated bot trades placed yet in this session. Start the bot to begin scanning for immediate cold digit shifts.
              </div>
            ) : (
              <div className="overflow-x-auto max-h-96">
                <table className="w-full text-left text-xs font-mono">
                  <thead className="bg-slate-900/90 text-slate-400 uppercase text-[10px] font-semibold border-b border-slate-800 sticky top-0">
                    <tr>
                      <th className="py-2.5 px-3">Time</th>
                      <th className="py-2.5 px-3">Market</th>
                      <th className="py-2.5 px-3">Trigger Reason (Cold Shift)</th>
                      <th className="py-2.5 px-3">Differ Contract</th>
                      <th className="py-2.5 px-3">Stake</th>
                      <th className="py-2.5 px-3">Exit Spot / Digit</th>
                      <th className="py-2.5 px-3 text-right">Result</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {tradeLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-850/50 transition-colors">
                        <td className="py-2 px-3 text-slate-400">
                          {new Date(log.time).toLocaleTimeString()}
                        </td>
                        <td className="py-2 px-3 font-sans font-bold text-white">
                          {log.marketName}
                        </td>
                        <td className="py-2 px-3 text-cyan-300">
                          {log.triggerReason}
                        </td>
                        <td className="py-2 px-3">
                          <span className="px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 font-bold border border-rose-500/40">
                            Differ ≠ {log.coldDigit} ({log.coldPct}%)
                          </span>
                        </td>
                        <td className="py-2 px-3 font-bold text-white">
                          ${log.stake.toFixed(2)}
                        </td>
                        <td className="py-2 px-3 text-slate-300">
                          {log.exitSpot !== undefined ? (
                            <span>
                              {log.exitSpot} (Last: <strong className="text-cyan-400">{log.exitDigit}</strong>)
                            </span>
                          ) : (
                            <span className="text-amber-400 animate-pulse">Waiting exit...</span>
                          )}
                        </td>
                        <td className="py-2 px-3 text-right font-black">
                          {log.status === 'WON' && (
                            <span className="text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/30">
                              WON +${log.profit.toFixed(2)}
                            </span>
                          )}
                          {log.status === 'LOST' && (
                            <span className="text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/30">
                              LOST -${Math.abs(log.profit).toFixed(2)}
                            </span>
                          )}
                          {log.status === 'OPEN' && (
                            <span className="text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/30 animate-pulse">
                              OPEN
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
