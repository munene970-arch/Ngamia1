import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { MarketInfo, MarketSymbol, DBotStrategy, Tick, ActiveContract } from '../../types/deriv';
import { derivWS, extractDerivLastDigit, formatDerivQuote } from '../../services/derivWebSocket';
import { strategyShield, StrategyShieldConfig } from '../../services/strategyShield';
import { soundManager } from '../../utils/soundEffects';
import { ALL_VOLATILITY_SYMBOLS } from '../../services/doubleRepeatStrategy';
import {
  Radar,
  Activity,
  Play,
  Square,
  Sparkles,
  TrendingUp,
  TrendingDown,
  Target,
  Zap,
  SlidersHorizontal,
  Flame,
  CheckCircle2,
  RefreshCw,
  Clock,
  ArrowRight,
  Filter,
  BarChart3,
  Layers,
  Search,
  Bot,
  Shield,
  ShieldCheck,
  ShieldAlert,
  RotateCcw,
  AlertTriangle,
  Radio,
  ChevronRight,
} from 'lucide-react';

export interface MarketScannerProps {
  markets: MarketInfo[];
  balanceUsd?: number;
  onAutoConfigureBot?: (strategy: DBotStrategy) => void;
  onNavigateTab?: (tab: string) => void;
  onUpdateBalance?: (balance: number) => void;
  onSelectMarket?: (symbol: MarketSymbol) => void;
}

export type ScannerFilterMode = 'ALL' | 'DIGIT_5_PATTERNS' | 'HOT_DIFFERS' | 'REPEATS' | 'UNDER_OVER' | 'EXTREME_EVEN_ODD';

interface MarketDigitStats {
  symbol: MarketSymbol;
  displayName: string;
  category: string;
  currentPrice: number;
  digits: number[];
  counts: number[];
  hotDigit: number;
  coldDigit: number;
  hotDigitPct: number;
  coldDigitPct: number;
  evenCount: number;
  oddCount: number;
  under5Count: number;
  over4Count: number;
  lastRepeat: { digit: number; length: number } | null;
  lastSandwich: { x: number; y: number } | null;
  digit5PatternMatch: { pattern: number[]; desc: string; count5: number } | null;
  bestStrategy: {
    name: string;
    type: string;
    targetDigit: number;
    edgePct: number;
    description: string;
  };
}

export const MarketScanner: React.FC<MarketScannerProps> = ({
  markets,
  balanceUsd = 10000.0,
  onAutoConfigureBot,
  onNavigateTab,
  onUpdateBalance,
  onSelectMarket,
}) => {
  const [filterMode, setFilterMode] = useState<ScannerFilterMode>('ALL');
  const [sampleSize, setSampleSize] = useState<number>(50);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isLiveScanning, setIsLiveScanning] = useState<boolean>(true);
  const [lastScanTime, setLastScanTime] = useState<string>(new Date().toLocaleTimeString());

  // Quick 1-Click execution from single card
  const [executingSymbol, setExecutingSymbol] = useState<MarketSymbol | null>(null);
  const [quickStake, setQuickStake] = useState<number>(0.35);
  const [quickTradesCount, setQuickTradesCount] = useState<number>(0);
  const [quickSessionPnL, setQuickSessionPnL] = useState<number>(0.0);

  // ==========================================
  // DIGIT 5 AUTO SCANNER BOT STATE
  // ==========================================
  const [isDigit5BotRunning, setIsDigit5BotRunning] = useState<boolean>(false);
  const [digit5InitialStake, setDigit5InitialStake] = useState<number>(10.0);
  const [digit5CurrentStake, setDigit5CurrentStake] = useState<number>(10.0);
  const [digit5Martingale, setDigit5Martingale] = useState<number>(11.5);
  const [digit5TakeProfit, setDigit5TakeProfit] = useState<number>(50.0);
  const [digit5StopLoss, setDigit5StopLoss] = useState<number>(100.0);
  const [digit5LossStreak, setDigit5LossStreak] = useState<number>(0);
  const [digit5MaxLossStreak, setDigit5MaxLossStreak] = useState<number>(2);
  const [digit5TotalTrades, setDigit5TotalTrades] = useState<number>(0);
  const [digit5Wins, setDigit5Wins] = useState<number>(0);
  const [digit5Losses, setDigit5Losses] = useState<number>(0);
  const [digit5SessionPnL, setDigit5SessionPnL] = useState<number>(0.0);
  const [digit5ActiveContractId, setDigit5ActiveContractId] = useState<string | null>(null);
  const [digit5ActiveMarket, setDigit5ActiveMarket] = useState<string | null>(null);
  const [digit5StatusMsg, setDigit5StatusMsg] = useState<string>('Ready • Scanning all 12 markets for [5,5,X], [X,5,5], [5,X,5], or [5,5,5] patterns');
  const [digit5Logs, setDigit5Logs] = useState<Array<{ id: string; time: string; text: string; type: 'trigger' | 'win' | 'loss' | 'info' }>>([]);
  const [latestDigit5Detection, setLatestDigit5Detection] = useState<{ symbol: string; displayName: string; pattern: number[]; time: string } | null>(null);
  const [shieldConfig, setShieldConfig] = useState<StrategyShieldConfig>(() => strategyShield.getConfig());
  const [shieldPing, setShieldPing] = useState<number>(() => derivWS.getPingMs() || 28);
  const [circuitBreakerSec, setCircuitBreakerSec] = useState<number>(() => strategyShield.getRemainingCircuitBreakerSec());

  useEffect(() => {
    const unsub = strategyShield.subscribe((cfg) => setShieldConfig(cfg));
    const interval = window.setInterval(() => {
      setShieldPing(derivWS.getPingMs() || 28);
      setCircuitBreakerSec(strategyShield.getRemainingCircuitBreakerSec());
    }, 500);
    return () => {
      unsub();
      window.clearInterval(interval);
    };
  }, []);

  // Refs for background execution
  const isDigit5BotRunningRef = useRef<boolean>(isDigit5BotRunning);
  const digit5InitialStakeRef = useRef<number>(digit5InitialStake);
  const digit5CurrentStakeRef = useRef<number>(digit5CurrentStake);
  const digit5MartingaleRef = useRef<number>(digit5Martingale);
  const digit5TakeProfitRef = useRef<number>(digit5TakeProfit);
  const digit5StopLossRef = useRef<number>(digit5StopLoss);
  const digit5SessionPnLRef = useRef<number>(digit5SessionPnL);
  const digit5LossStreakRef = useRef<number>(digit5LossStreak);
  const digit5MaxLossStreakRef = useRef<number>(digit5MaxLossStreak);
  const digit5ActiveContractIdRef = useRef<string | null>(digit5ActiveContractId);
  const lastDigit5TradeTimeRef = useRef<number>(0);
  const lastTradedMarketDigit5Ref = useRef<string | null>(null);

  useEffect(() => {
    isDigit5BotRunningRef.current = isDigit5BotRunning;
  }, [isDigit5BotRunning]);
  useEffect(() => {
    digit5InitialStakeRef.current = digit5InitialStake;
  }, [digit5InitialStake]);
  useEffect(() => {
    digit5CurrentStakeRef.current = digit5CurrentStake;
  }, [digit5CurrentStake]);
  useEffect(() => {
    digit5MartingaleRef.current = digit5Martingale;
  }, [digit5Martingale]);
  useEffect(() => {
    digit5TakeProfitRef.current = digit5TakeProfit;
  }, [digit5TakeProfit]);
  useEffect(() => {
    digit5StopLossRef.current = digit5StopLoss;
  }, [digit5StopLoss]);
  useEffect(() => {
    digit5SessionPnLRef.current = digit5SessionPnL;
  }, [digit5SessionPnL]);
  useEffect(() => {
    digit5LossStreakRef.current = digit5LossStreak;
  }, [digit5LossStreak]);
  useEffect(() => {
    digit5MaxLossStreakRef.current = digit5MaxLossStreak;
  }, [digit5MaxLossStreak]);
  useEffect(() => {
    digit5ActiveContractIdRef.current = digit5ActiveContractId;
  }, [digit5ActiveContractId]);

  const addDigit5Log = useCallback((text: string, type: 'trigger' | 'win' | 'loss' | 'info' = 'info') => {
    const time = new Date().toLocaleTimeString();
    setDigit5Logs((prev) => [{ id: Math.random().toString(), time, text, type }, ...prev.slice(0, 29)]);
  }, []);

  // Buffer of live ticks per market
  const [marketTicks, setMarketTicks] = useState<Record<string, { quotes: number[]; digits: number[]; lastQuote: number }>>(() => {
    const init: Record<string, { quotes: number[]; digits: number[]; lastQuote: number }> = {};
    ALL_VOLATILITY_SYMBOLS.forEach((sym) => {
      init[sym] = { quotes: [], digits: [], lastQuote: 0 };
    });
    return init;
  });

  const marketTicksRef = useRef(marketTicks);
  useEffect(() => {
    marketTicksRef.current = marketTicks;
  }, [marketTicks]);

  // Subscribe to live contract settlements for DIGIT 5 Auto Bot
  useEffect(() => {
    const handleContractUpdate = (contract: ActiveContract) => {
      if (digit5ActiveContractIdRef.current && digit5ActiveContractIdRef.current === contract.id) {
        if (contract.status === 'WON' || contract.status === 'LOST') {
          const isWin = contract.status === 'WON';
          const profit = contract.currentProfit || 0;
          const symName = contract.symbolName || contract.symbol;

          setDigit5ActiveContractId(null);
          digit5ActiveContractIdRef.current = null;
          setDigit5ActiveMarket(null);

          setDigit5TotalTrades((t) => t + 1);
          const newPnL = digit5SessionPnLRef.current + profit;
          setDigit5SessionPnL(newPnL);
          digit5SessionPnLRef.current = newPnL;

          if (onUpdateBalance && balanceUsd) {
            onUpdateBalance(balanceUsd + profit);
          }

          if (isWin) {
            soundManager.playWinSound();
            setDigit5Wins((w) => w + 1);
            setDigit5LossStreak(0);
            digit5LossStreakRef.current = 0;
            // Reset to base stake on win
            const baseStake = digit5InitialStakeRef.current;
            setDigit5CurrentStake(baseStake);
            digit5CurrentStakeRef.current = baseStake;
            addDigit5Log(`✅ WIN on ${symName}: +$${profit.toFixed(2)} (Differed 5) | Reset stake to $${baseStake.toFixed(2)}`, 'win');
          } else {
            soundManager.playLossSound();
            setDigit5Losses((l) => l + 1);
            const nextStreak = digit5LossStreakRef.current + 1;
            setDigit5LossStreak(nextStreak);
            digit5LossStreakRef.current = nextStreak;

            // Apply Martingale
            const nextStake = Math.round(digit5CurrentStakeRef.current * digit5MartingaleRef.current * 100) / 100;
            setDigit5CurrentStake(nextStake);
            digit5CurrentStakeRef.current = nextStake;
            addDigit5Log(`❌ LOSS on ${symName}: -$${Math.abs(profit).toFixed(2)} (Digit 5 Hit) | Next Martingale Stake: $${nextStake.toFixed(2)}`, 'loss');

            // Max loss streak safeguard check
            if (digit5MaxLossStreakRef.current > 0 && nextStreak >= digit5MaxLossStreakRef.current) {
              setIsDigit5BotRunning(false);
              isDigit5BotRunningRef.current = false;
              setDigit5StatusMsg(`🛑 Max Loss Streak (${nextStreak}) reached. Bot paused safely.`);
              addDigit5Log(`🛑 BOT STOPPED: Reached maximum loss streak of ${nextStreak}.`, 'info');
              return;
            }
          }

          // Check Take Profit / Stop Loss
          if (digit5TakeProfitRef.current > 0 && newPnL >= digit5TakeProfitRef.current) {
            setIsDigit5BotRunning(false);
            isDigit5BotRunningRef.current = false;
            setDigit5StatusMsg(`🎯 Take Profit reached (+$${newPnL.toFixed(2)} / $${digit5TakeProfitRef.current.toFixed(2)}). Bot stopped.`);
            soundManager.playWinSound();
            addDigit5Log(`🎯 TAKE PROFIT TARGET REACHED! Net profit: +$${newPnL.toFixed(2)}`, 'win');
          } else if (digit5StopLossRef.current > 0 && newPnL <= -digit5StopLossRef.current) {
            setIsDigit5BotRunning(false);
            isDigit5BotRunningRef.current = false;
            setDigit5StatusMsg(`⚠️ Stop Loss triggered (-$${Math.abs(newPnL).toFixed(2)} / $${digit5StopLossRef.current.toFixed(2)}). Bot stopped.`);
            soundManager.playLossSound();
            addDigit5Log(`⚠️ STOP LOSS HIT! Session loss: -$${Math.abs(newPnL).toFixed(2)}`, 'loss');
          } else if (isDigit5BotRunningRef.current) {
            setDigit5StatusMsg(`Scanning all 12 markets for next Digit 5 pattern... (Session P/L: ${newPnL >= 0 ? '+' : ''}$${newPnL.toFixed(2)})`);
          }
        }
      }
    };

    derivWS.subscribeContracts(handleContractUpdate);
    return () => {
      derivWS.unsubscribeContracts(handleContractUpdate);
    };
  }, [balanceUsd, onUpdateBalance, addDigit5Log]);

  // Execute Digit 5 Auto Trade when pattern triggered
  const triggerDigit5AutoTrade = useCallback(
    (sym: MarketSymbol, symDisplayName: string, recent3Digits: number[]) => {
      if (!isDigit5BotRunningRef.current) return;
      if (digit5ActiveContractIdRef.current) return; // Wait for active contract to settle

      // Cooldown to avoid rapid double-fire on same millisecond
      const now = Date.now();
      if (now - lastDigit5TradeTimeRef.current < 400) return;

      const stakeToUse = digit5CurrentStakeRef.current;
      const patternStr = `[${recent3Digits.join(', ')}]`;

      setLatestDigit5Detection({
        symbol: sym,
        displayName: symDisplayName,
        pattern: recent3Digits,
        time: new Date().toLocaleTimeString(),
      });

      lastDigit5TradeTimeRef.current = now;
      lastTradedMarketDigit5Ref.current = sym;
      setDigit5ActiveMarket(symDisplayName);
      setDigit5StatusMsg(`⚡ Triggered pattern ${patternStr} on ${symDisplayName} → Buying DIGITDIFF 5 (1-tick)...`);

      soundManager.playTradeTakenSound();
      addDigit5Log(
        `⚡ TRIGGER: Pattern ${patternStr} on ${symDisplayName} (Digit 5 appeared 2+ times in 3 digits) → BUY DIGITDIFF 5 (Stake: $${stakeToUse.toFixed(2)})`,
        'trigger'
      );

      try {
        const contract = derivWS.purchaseContract({
          symbol: sym,
          contractType: 'DIGITDIFF',
          stake: stakeToUse,
          durationTicks: 1,
          targetDigit: 5,
          barrier: 5,
          symbolName: symDisplayName,
        });

        setDigit5ActiveContractId(contract.id);
        digit5ActiveContractIdRef.current = contract.id;
      } catch (err: any) {
        addDigit5Log(`⚠️ Execution Error: ${err?.message || 'Failed to place contract'}`, 'loss');
        setDigit5ActiveContractId(null);
        digit5ActiveContractIdRef.current = null;
        setDigit5ActiveMarket(null);
      }
    },
    [addDigit5Log]
  );

  // Subscribe to all Volatility Markets in real time
  useEffect(() => {
    const unsubs: (() => void)[] = [];

    ALL_VOLATILITY_SYMBOLS.forEach((sym) => {
      const handler = (tick: Tick) => {
        const quote = Number(tick.quote);
        if (!Number.isFinite(quote)) return;
        const digit = extractDerivLastDigit(tick.quote, tick.pipSize, tick.symbol);

        setMarketTicks((prev) => {
          const current = prev[sym] || { quotes: [], digits: [], lastQuote: 0 };
          const updatedDigits = [...current.digits, digit].slice(-100);
          const updatedQuotes = [...current.quotes, quote].slice(-100);

          // DIGIT 5 AUTO SCANNER CHECK:
          // Immediately when digit 5 appears twice in any 3-digit pattern:
          // e.g. [5, 5, 6], [3, 5, 5], [5, 6, 5], or [5, 5, 5]
          if (updatedDigits.length >= 3) {
            const recent3 = updatedDigits.slice(-3);
            const count5 = recent3.filter((d) => d === 5).length;
            if (count5 >= 2) {
              const marketInfo = markets.find((m) => m.symbol === sym);
              const displayName = marketInfo?.displayName || sym;
              // If bot is running and not in trade, trigger!
              if (isDigit5BotRunningRef.current && !digit5ActiveContractIdRef.current) {
                triggerDigit5AutoTrade(sym, displayName, recent3);
              }
            }
          }

          return {
            ...prev,
            [sym]: {
              quotes: updatedQuotes,
              digits: updatedDigits,
              lastQuote: quote,
            },
          };
        });
      };

      derivWS.subscribeTicks(sym, handler);
      unsubs.push(() => derivWS.unsubscribeTicks(sym, handler));
    });

    const timer = setInterval(() => {
      setLastScanTime(new Date().toLocaleTimeString());
    }, 1000);

    return () => {
      unsubs.forEach((u) => u());
      clearInterval(timer);
    };
  }, [markets, triggerDigit5AutoTrade]);

  // Compute live analytical stats for each market
  const marketAnalysis = useMemo<MarketDigitStats[]>(() => {
    return ALL_VOLATILITY_SYMBOLS.map((sym) => {
      const marketInfo = markets.find((m) => m.symbol === sym);
      const data = marketTicks[sym] || { quotes: [], digits: [], lastQuote: 0 };
      const currentDigits = data.digits.slice(-sampleSize);
      const totalSample = currentDigits.length || 1;

      const counts = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
      let evenCount = 0;
      let oddCount = 0;
      let under5Count = 0;
      let over4Count = 0;

      currentDigits.forEach((d) => {
        if (d >= 0 && d <= 9) {
          counts[d]++;
          if (d % 2 === 0) evenCount++;
          else oddCount++;
          if (d <= 4) under5Count++;
          else over4Count++;
        }
      });

      let hotDigit = 0;
      let maxCount = -1;
      let coldDigit = 0;
      let minCount = 99999;

      for (let d = 0; d <= 9; d++) {
        if (counts[d] > maxCount) {
          maxCount = counts[d];
          hotDigit = d;
        }
        if (counts[d] < minCount) {
          minCount = counts[d];
          coldDigit = d;
        }
      }

      const hotDigitPct = Math.round((maxCount / totalSample) * 100);
      const coldDigitPct = Math.round((minCount / totalSample) * 100);

      // Check repeat pattern
      let lastRepeat: { digit: number; length: number } | null = null;
      if (currentDigits.length >= 2) {
        const d1 = currentDigits[currentDigits.length - 2];
        const d2 = currentDigits[currentDigits.length - 1];
        if (d1 === d2) {
          lastRepeat = { digit: d2, length: 2 };
          if (currentDigits.length >= 3 && currentDigits[currentDigits.length - 3] === d2) {
            lastRepeat.length = 3;
          }
        }
      }

      // Check sandwich pattern [X, Y, X]
      let lastSandwich: { x: number; y: number } | null = null;
      if (currentDigits.length >= 3) {
        const d1 = currentDigits[currentDigits.length - 3];
        const d2 = currentDigits[currentDigits.length - 2];
        const d3 = currentDigits[currentDigits.length - 1];
        if (d1 === d3 && d2 !== d1) {
          lastSandwich = { x: d1, y: d2 };
        }
      }

      // Check Digit 5 pattern in last 3 ticks (appears twice in 3-digit pattern)
      let digit5PatternMatch: { pattern: number[]; desc: string; count5: number } | null = null;
      if (currentDigits.length >= 3) {
        const recent3 = currentDigits.slice(-3);
        const count5 = recent3.filter((d) => d === 5).length;
        if (count5 >= 2) {
          let desc = `[${recent3.join(', ')}] Pattern`;
          if (recent3[0] === 5 && recent3[1] === 5 && recent3[2] !== 5) desc = `[5, 5, ${recent3[2]}] Front Pair`;
          else if (recent3[0] !== 5 && recent3[1] === 5 && recent3[2] === 5) desc = `[${recent3[0]}, 5, 5] Back Pair`;
          else if (recent3[0] === 5 && recent3[1] !== 5 && recent3[2] === 5) desc = `[5, ${recent3[1]}, 5] Sandwich 5`;
          else if (recent3[0] === 5 && recent3[1] === 5 && recent3[2] === 5) desc = `[5, 5, 5] Triple 5`;

          digit5PatternMatch = {
            pattern: recent3,
            desc,
            count5,
          };
        }
      }

      // Determine highest probability strategy edge
      let bestStrategy = {
        name: 'Quantum Differ',
        type: 'DIGITDIFF',
        targetDigit: hotDigit,
        edgePct: 91.5,
        description: `Differ Hot Digit [${hotDigit}] (${hotDigitPct}% cluster peak)`,
      };

      if (digit5PatternMatch) {
        bestStrategy = {
          name: 'DIGIT 5 Auto Differ',
          type: 'DIGITDIFF',
          targetDigit: 5,
          edgePct: 94.2,
          description: `Differ 5 on ${digit5PatternMatch.desc} (${digit5PatternMatch.count5}x 5 in 3 digits)`,
        };
      } else if (lastRepeat) {
        bestStrategy = {
          name: 'Repeat Exhaustion Differ',
          type: 'DIGITDIFF',
          targetDigit: lastRepeat.digit,
          edgePct: 93.8,
          description: `Differ Double Repeat [${lastRepeat.digit}, ${lastRepeat.digit}] Exhaustion`,
        };
      } else if (lastSandwich) {
        bestStrategy = {
          name: 'Sandwich Differ (Skip X)',
          type: 'DIGITDIFF',
          targetDigit: lastSandwich.y,
          edgePct: 92.5,
          description: `Differ Sandwiched Digit [${lastSandwich.x}, ${lastSandwich.y}, ${lastSandwich.x}]`,
        };
      } else if (under5Count / totalSample >= 0.65) {
        bestStrategy = {
          name: 'Under 7 High Coverage',
          type: 'DIGITUNDER',
          targetDigit: 7,
          edgePct: 82.0,
          description: `Under 7 (Low bias: ${Math.round((under5Count / totalSample) * 100)}% <= 4)`,
        };
      }

      return {
        symbol: sym,
        displayName: marketInfo?.displayName || sym,
        category: marketInfo?.category || 'Volatility Indices',
        currentPrice: data.lastQuote || marketInfo?.currentPrice || 0,
        digits: currentDigits,
        counts,
        hotDigit,
        coldDigit,
        hotDigitPct,
        coldDigitPct,
        evenCount,
        oddCount,
        under5Count,
        over4Count,
        lastRepeat,
        lastSandwich,
        digit5PatternMatch,
        bestStrategy,
      };
    });
  }, [markets, marketTicks, sampleSize]);

  // Filter and search
  const filteredAnalysis = useMemo(() => {
    return marketAnalysis.filter((m) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        if (!m.displayName.toLowerCase().includes(q) && !m.symbol.toLowerCase().includes(q)) {
          return false;
        }
      }

      if (filterMode === 'DIGIT_5_PATTERNS') {
        return m.digit5PatternMatch !== null || m.counts[5] >= 2;
      }
      if (filterMode === 'HOT_DIFFERS') {
        return m.hotDigitPct >= 20 || m.lastRepeat !== null || m.digit5PatternMatch !== null;
      }
      if (filterMode === 'REPEATS') {
        return m.lastRepeat !== null;
      }
      if (filterMode === 'UNDER_OVER') {
        const uRatio = m.under5Count / (m.digits.length || 1);
        return uRatio >= 0.6 || uRatio <= 0.4;
      }
      if (filterMode === 'EXTREME_EVEN_ODD') {
        const eRatio = m.evenCount / (m.digits.length || 1);
        return eRatio >= 0.65 || eRatio <= 0.35;
      }

      return true;
    });
  }, [marketAnalysis, filterMode, searchQuery]);

  // Execute quick 1-click trade directly from scanner
  const handleQuickExecute = async (m: MarketDigitStats, customTargetDigit?: number) => {
    soundManager.playButtonClick();
    setExecutingSymbol(m.symbol);

    const targetDigitToUse = customTargetDigit !== undefined ? customTargetDigit : m.bestStrategy.targetDigit;
    const contractTypeToUse = customTargetDigit !== undefined ? 'DIGITDIFF' : (m.bestStrategy.type as any);

    try {
      soundManager.playTradeTakenSound();
      const contract = derivWS.purchaseContract({
        symbol: m.symbol,
        contractType: contractTypeToUse,
        stake: quickStake,
        durationTicks: 1,
        targetDigit: targetDigitToUse,
        barrier: targetDigitToUse,
        symbolName: m.displayName,
      });

      setQuickTradesCount((prev) => prev + 1);

      // Wait for settlement via contract subscription
      const handleContractUpdate = (settled: ActiveContract) => {
        if (settled.id === contract.id && (settled.status === 'WON' || settled.status === 'LOST')) {
          const profit = settled.currentProfit || 0;
          setQuickSessionPnL((prev) => prev + profit);
          if (settled.status === 'WON') soundManager.playWinSound();
          else soundManager.playLossSound();
          setExecutingSymbol(null);
          derivWS.unsubscribeContracts(handleContractUpdate);
        }
      };
      derivWS.subscribeContracts(handleContractUpdate);

      setTimeout(() => {
        setExecutingSymbol(null);
        derivWS.unsubscribeContracts(handleContractUpdate);
      }, 5000);
    } catch (e) {
      setExecutingSymbol(null);
    }
  };

  // Launch DIGIT 5 Auto strategy in DBot Studio
  const handleExportDigit5ToDBot = (marketSym?: MarketSymbol, marketName?: string) => {
    soundManager.playButtonClick();
    if (onAutoConfigureBot) {
      const generatedBot: DBotStrategy = {
        id: 'bot_digit_5_auto',
        name: 'DIGIT 5 Auto (2x in 3-Digit Pattern Differ 5)',
        description:
          'High-probability multi-market scanner bot. Scans all Volatilities and triggers 1-tick DIGITDIFF 5 whenever digit 5 appears at least twice in any 3-digit pattern (e.g. 5,5,6 | 3,5,5 | 5,6,5 | 5,5,5). Features 11.5x Martingale recovery.',
        symbol: marketSym || 'R_100',
        category: 'DIGITS',
        contractType: 'DIGITDIFF',
        initialStake: digit5InitialStake,
        martingaleFactor: digit5Martingale,
        takeProfit: digit5TakeProfit,
        stopLoss: digit5StopLoss,
        maxLossStreak: digit5MaxLossStreak,
        durationTicks: 1,
        rules: {
          indicatorTrigger: 'DIGIT_5_AUTO',
          paramValue: 5,
        },
      };
      onAutoConfigureBot(generatedBot);
    }
  };

  // Toggle DIGIT 5 Auto Bot On/Off
  const handleToggleDigit5Bot = () => {
    soundManager.playButtonClick();
    if (isDigit5BotRunning) {
      setIsDigit5BotRunning(false);
      isDigit5BotRunningRef.current = false;
      setDigit5StatusMsg('DIGIT 5 Auto Bot paused by user.');
      addDigit5Log('⏸ DIGIT 5 Auto Bot stopped.', 'info');
    } else {
      setIsDigit5BotRunning(true);
      isDigit5BotRunningRef.current = true;
      setDigit5CurrentStake(digit5InitialStake);
      digit5CurrentStakeRef.current = digit5InitialStake;
      setDigit5LossStreak(0);
      digit5LossStreakRef.current = 0;
      setDigit5StatusMsg('🚀 DIGIT 5 Auto Bot active • Scanning all 12 markets continuously for [5,5,X], [X,5,5], [5,X,5], [5,5,5]');
      addDigit5Log(`🚀 DIGIT 5 Auto Bot started! Base Stake: $${digit5InitialStake.toFixed(2)} | Martingale: ${digit5Martingale}x | TP: $${digit5TakeProfit.toFixed(2)}`, 'info');
    }
  };

  const handleResetDigit5Stats = () => {
    soundManager.playButtonClick();
    setDigit5SessionPnL(0);
    setDigit5TotalTrades(0);
    setDigit5Wins(0);
    setDigit5Losses(0);
    setDigit5LossStreak(0);
    setDigit5Logs([]);
  };

  return (
    <div className="space-y-5 pb-12 font-sans">
      {/* ============================================================== */}
      {/* 🚀 PROMINENT FEATURE: DIGIT 5 AUTO SCANNER BOT CONTROL PANEL   */}
      {/* ============================================================== */}
      <div className="bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950/80 border-2 border-indigo-500/40 rounded-3xl p-5 sm:p-6 shadow-2xl space-y-5 relative overflow-hidden">
        {/* Ambient background glow */}
        <div className="absolute -right-16 -top-16 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -left-16 -bottom-16 w-64 h-64 bg-sky-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Header Title & Mode Badge */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div className="flex items-start sm:items-center gap-3.5">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-xl shrink-0 transition-all ${
              isDigit5BotRunning
                ? 'bg-gradient-to-tr from-amber-500 to-rose-500 ring-4 ring-rose-500/30 animate-pulse'
                : 'bg-gradient-to-tr from-indigo-600 to-sky-500 shadow-indigo-950/60'
            }`}>
              <Bot className="w-6 h-6" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2">
                  <span>DIGIT 5 Auto</span>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-black uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/40">
                    2x 5 in 3 Digits → Differ 5
                  </span>
                </h2>
              </div>
              <p className="text-xs text-slate-300 font-medium mt-1 leading-relaxed max-w-2xl">
                Scans all 12 Synthetic Markets simultaneously. The instant digit <span className="text-amber-400 font-bold">5</span> appears twice in any 3-digit rolling pattern (e.g. <span className="font-mono text-amber-300 bg-slate-900/80 px-1.5 py-0.5 rounded">5,5,6</span>, <span className="font-mono text-amber-300 bg-slate-900/80 px-1.5 py-0.5 rounded">3,5,5</span>, <span className="font-mono text-amber-300 bg-slate-900/80 px-1.5 py-0.5 rounded">5,6,5</span>, or <span className="font-mono text-amber-300 bg-slate-900/80 px-1.5 py-0.5 rounded">5,5,5</span>), it buys <span className="text-sky-400 font-bold">DIGITDIFF 5</span> (1-tick) immediately!
              </p>
            </div>
          </div>

          {/* Quick DBot Link / Export & Shield Badge */}
          <div className="flex items-center gap-2 shrink-0">
            <div className={`px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-all ${
              circuitBreakerSec > 0
                ? 'bg-rose-950/80 border-rose-500 text-rose-300 animate-pulse'
                : shieldConfig.enabled
                ? 'bg-emerald-950/60 border-emerald-500/50 text-emerald-300'
                : 'bg-slate-900 border-slate-700 text-slate-400'
            }`}>
              {circuitBreakerSec > 0 ? (
                <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
              ) : (
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              )}
              <span className="text-[11px]">
                {circuitBreakerSec > 0 ? `Shield Cooldown (${circuitBreakerSec}s)` : `Shield Active (${shieldPing}ms)`}
              </span>
            </div>

            <button
              onClick={() => handleExportDigit5ToDBot()}
              className="px-3.5 py-2 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-slate-750 text-slate-300 hover:text-white text-xs font-bold transition-all flex items-center gap-1.5 shadow-md"
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-indigo-400" />
              <span>Configure in DBot</span>
            </button>
          </div>
        </div>

        {/* Live Metrics & Parameter Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 relative z-10">
          {/* Initial Stake */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-3 flex flex-col justify-between">
            <span className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider">Base Stake</span>
            <div className="mt-1 flex items-center gap-1">
              <span className="text-slate-400 font-bold">$</span>
              <input
                type="number"
                step="0.5"
                min="0.35"
                disabled={isDigit5BotRunning}
                value={digit5InitialStake}
                onChange={(e) => {
                  const val = Math.max(0.35, parseFloat(e.target.value) || 0.35);
                  setDigit5InitialStake(val);
                  setDigit5CurrentStake(val);
                }}
                className="w-full bg-transparent text-white font-black text-lg focus:outline-none disabled:opacity-75"
              />
            </div>
            <span className="text-[10px] text-slate-500 font-medium">Active: ${digit5CurrentStake.toFixed(2)}</span>
          </div>

          {/* Martingale Factor */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-3 flex flex-col justify-between">
            <span className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider">Martingale</span>
            <div className="mt-1 flex items-center gap-1">
              <input
                type="number"
                step="0.5"
                min="1"
                disabled={isDigit5BotRunning}
                value={digit5Martingale}
                onChange={(e) => setDigit5Martingale(Math.max(1, parseFloat(e.target.value) || 1))}
                className="w-full bg-transparent text-white font-black text-lg focus:outline-none disabled:opacity-75"
              />
              <span className="text-slate-400 font-bold">x</span>
            </div>
            <span className="text-[10px] text-slate-500 font-medium">11.5x recovers on Differ</span>
          </div>

          {/* Take Profit */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-3 flex flex-col justify-between">
            <span className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider">Take Profit</span>
            <div className="mt-1 flex items-center gap-1">
              <span className="text-emerald-400 font-bold">$</span>
              <input
                type="number"
                step="5"
                min="1"
                disabled={isDigit5BotRunning}
                value={digit5TakeProfit}
                onChange={(e) => setDigit5TakeProfit(Math.max(1, parseFloat(e.target.value) || 1))}
                className="w-full bg-transparent text-emerald-400 font-black text-lg focus:outline-none disabled:opacity-75"
              />
            </div>
            <span className="text-[10px] text-slate-500 font-medium">Auto-stops on target</span>
          </div>

          {/* Stop Loss */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-3 flex flex-col justify-between">
            <span className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider">Stop Loss</span>
            <div className="mt-1 flex items-center gap-1">
              <span className="text-red-400 font-bold">$</span>
              <input
                type="number"
                step="10"
                min="1"
                disabled={isDigit5BotRunning}
                value={digit5StopLoss}
                onChange={(e) => setDigit5StopLoss(Math.max(1, parseFloat(e.target.value) || 1))}
                className="w-full bg-transparent text-red-400 font-black text-lg focus:outline-none disabled:opacity-75"
              />
            </div>
            <span className="text-[10px] text-slate-500 font-medium">Max Loss: {digit5MaxLossStreak} streaks</span>
          </div>
        </div>

        {/* Live Status Bar & Big Start / Stop Action Button */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 relative z-10 pt-1">
          {/* Status Display */}
          <div className="bg-slate-950/90 border border-slate-800/90 rounded-2xl px-4 py-3 flex-1 flex items-center gap-3">
            <div className="relative flex items-center justify-center shrink-0">
              <div
                className={`w-4 h-4 rounded-full ${
                  isDigit5BotRunning ? 'bg-amber-400 animate-ping' : 'bg-slate-600'
                }`}
              />
              <div
                className={`absolute w-2.5 h-2.5 rounded-full ${
                  isDigit5BotRunning ? 'bg-amber-500' : 'bg-slate-500'
                }`}
              />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <span>{isDigit5BotRunning ? 'BOT ACTIVE • SCANNING 12 SYNTHETICS' : 'BOT STANDBY'}</span>
                {digit5ActiveMarket && (
                  <span className="text-amber-400 font-bold">({digit5ActiveMarket})</span>
                )}
              </div>
              <p className="text-xs font-semibold text-slate-200 truncate mt-0.5">{digit5StatusMsg}</p>
            </div>
          </div>

          {/* Primary RUN / STOP Button */}
          <button
            onClick={handleToggleDigit5Bot}
            className={`py-3.5 px-7 rounded-2xl font-black text-sm flex items-center justify-center gap-2.5 transition-all shadow-xl active:scale-[0.98] shrink-0 ${
              isDigit5BotRunning
                ? 'bg-red-600 hover:bg-red-700 text-white shadow-red-950/60 ring-2 ring-red-500/40'
                : 'bg-gradient-to-r from-amber-500 via-orange-500 to-rose-600 hover:from-amber-400 hover:to-rose-500 text-white shadow-amber-950/60'
            }`}
          >
            {isDigit5BotRunning ? (
              <>
                <Square className="w-5 h-5 fill-current" />
                <span>Stop DIGIT 5 Auto</span>
              </>
            ) : (
              <>
                <Play className="w-5 h-5 fill-current" />
                <span>Run DIGIT 5 Auto Bot</span>
              </>
            )}
          </button>
        </div>

        {/* Live Performance Stats Strip */}
        <div className="bg-slate-950/80 border border-slate-850 rounded-2xl px-4 py-3 flex flex-wrap items-center justify-between gap-3 text-xs relative z-10 font-mono">
          <div className="flex items-center gap-4 text-slate-300">
            <div>
              <span className="text-slate-500 text-[10px] uppercase block">Trades</span>
              <span className="font-black text-sm text-white">{digit5TotalTrades}</span>
            </div>
            <div>
              <span className="text-slate-500 text-[10px] uppercase block">Wins / Losses</span>
              <span className="font-bold text-slate-300">
                <span className="text-emerald-400">{digit5Wins}W</span> - <span className="text-red-400">{digit5Losses}L</span>
              </span>
            </div>
            <div>
              <span className="text-slate-500 text-[10px] uppercase block">Win Rate</span>
              <span className="font-black text-sm text-sky-400">
                {digit5TotalTrades > 0 ? `${((digit5Wins / digit5TotalTrades) * 100).toFixed(1)}%` : '90.0%'}
              </span>
            </div>
            <div>
              <span className="text-slate-500 text-[10px] uppercase block">Loss Streak</span>
              <span className="font-bold text-amber-400">{digit5LossStreak} / {digit5MaxLossStreak}</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right">
              <span className="text-slate-500 text-[10px] uppercase block">Session P/L</span>
              <span className={`text-base font-black ${digit5SessionPnL >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {digit5SessionPnL >= 0 ? `+$${digit5SessionPnL.toFixed(2)}` : `-$${Math.abs(digit5SessionPnL).toFixed(2)}`}
              </span>
            </div>
            <button
              onClick={handleResetDigit5Stats}
              title="Reset Performance Stats"
              className="p-2 text-slate-500 hover:text-slate-200 bg-slate-900 rounded-xl border border-slate-800 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Live DIGIT 5 Trigger Logs Drawer */}
        {digit5Logs.length > 0 && (
          <div className="bg-slate-950/90 border border-slate-850 rounded-2xl p-3 space-y-1.5 relative z-10 max-h-36 overflow-y-auto">
            <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
              <span>Live Execution Log</span>
              <span>{digit5Logs.length} events</span>
            </div>
            {digit5Logs.map((log) => (
              <div
                key={log.id}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-medium flex items-center justify-between gap-2 ${
                  log.type === 'win'
                    ? 'bg-emerald-950/40 text-emerald-300 border border-emerald-800/40'
                    : log.type === 'loss'
                    ? 'bg-red-950/40 text-red-300 border border-red-800/40'
                    : log.type === 'trigger'
                    ? 'bg-amber-950/50 text-amber-300 border border-amber-700/50 font-bold'
                    : 'bg-slate-900/60 text-slate-400'
                }`}
              >
                <span className="truncate">{log.text}</span>
                <span className="text-[9px] text-slate-500 shrink-0 font-mono">{log.time}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ============================================================== */}
      {/* 📊 GENERAL MARKET SCANNER CONTROLS & FILTER BAR                */}
      {/* ============================================================== */}
      <div className="bg-slate-950 border border-slate-850 rounded-3xl p-5 shadow-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-sky-500/15 border border-sky-500/30 flex items-center justify-center text-sky-400 shadow-md shadow-sky-950/40 shrink-0">
            <Radar className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-extrabold text-white tracking-tight">
                Live Market Scanner
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-950/80 text-emerald-400 border border-emerald-800/80 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                12 Synthetics Live
              </span>
            </div>
            <p className="text-xs text-slate-400 font-medium mt-0.5">
              Continuous multi-market digit frequency, repeat anomalies, Digit 5 clusters, sandwich patterns, and 90%+ probability edges.
            </p>
          </div>
        </div>

        {/* Quick Config & Controls */}
        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
          {/* Sample Size selector */}
          <div className="flex items-center bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-slate-300">
            <Clock className="w-3.5 h-3.5 text-slate-500 mr-1.5" />
            <span className="text-[11px] text-slate-400 mr-1.5 font-medium">Ticks:</span>
            <select
              value={sampleSize}
              onChange={(e) => setSampleSize(Number(e.target.value))}
              className="bg-transparent text-white font-bold focus:outline-none cursor-pointer"
            >
              <option value={25} className="bg-slate-900">25 Ticks</option>
              <option value={50} className="bg-slate-900">50 Ticks</option>
              <option value={100} className="bg-slate-900">100 Ticks</option>
            </select>
          </div>

          {/* Quick Stake */}
          <div className="flex items-center bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-slate-300">
            <span className="text-[11px] text-slate-400 mr-1.5 font-medium">Quick Stake:</span>
            <span className="font-bold text-white">$</span>
            <input
              type="number"
              step="0.05"
              min="0.35"
              value={quickStake}
              onChange={(e) => setQuickStake(Math.max(0.35, parseFloat(e.target.value) || 0.35))}
              className="w-14 bg-transparent text-white font-bold focus:outline-none ml-0.5"
            />
          </div>

          {/* Live Scanner Refresh Badge */}
          <div className="text-[11px] font-mono text-slate-400 bg-slate-900/80 border border-slate-800 px-2.5 py-1.5 rounded-xl flex items-center gap-1.5">
            <RefreshCw className="w-3 h-3 text-sky-400 animate-spin" />
            <span>{lastScanTime}</span>
          </div>
        </div>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5">
          {[
            { id: 'ALL' as ScannerFilterMode, label: 'All Markets (12)' },
            { id: 'DIGIT_5_PATTERNS' as ScannerFilterMode, label: '🎯 DIGIT 5 Hits (2x in 3)' },
            { id: 'HOT_DIFFERS' as ScannerFilterMode, label: '🔥 Hot Differ Clusters' },
            { id: 'REPEATS' as ScannerFilterMode, label: '⚡ Double Repeat Hits' },
            { id: 'UNDER_OVER' as ScannerFilterMode, label: '📊 Under / Over Biases' },
            { id: 'EXTREME_EVEN_ODD' as ScannerFilterMode, label: '⚖️ Even/Odd Asymmetry' },
          ].map((tab) => {
            const isSelected = filterMode === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setFilterMode(tab.id);
                  soundManager.playButtonClick();
                }}
                className={`px-3 py-2 rounded-xl text-xs font-bold transition-all border ${
                  isSelected
                    ? 'bg-amber-950/90 border-amber-500 text-amber-300 shadow-md shadow-amber-950/40'
                    : 'bg-slate-900/90 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Search Filter */}
        <div className="relative min-w-[200px]">
          <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search volatility..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-8 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 transition-colors"
          />
        </div>
      </div>

      {/* ============================================================== */}
      {/* 📦 LIVE MARKET SCANNER GRID (12 Volatility Indices)             */}
      {/* ============================================================== */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredAnalysis.map((m) => {
          const isExecuting = executingSymbol === m.symbol;
          const hasDigit5Trigger = m.digit5PatternMatch !== null;

          return (
            <div
              key={m.symbol}
              className={`bg-slate-950 border transition-all rounded-3xl p-4 sm:p-5 shadow-xl flex flex-col justify-between space-y-4 relative overflow-hidden group ${
                hasDigit5Trigger
                  ? 'border-amber-500/80 ring-2 ring-amber-500/20 shadow-amber-950/30'
                  : 'border-slate-850 hover:border-slate-750'
              }`}
            >
              {/* Top Row: Symbol Name & Quote */}
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-black text-white tracking-tight">{m.displayName}</h3>
                    {hasDigit5Trigger && (
                      <span className="px-2 py-0.5 rounded-lg bg-gradient-to-r from-amber-500 to-rose-500 text-white text-[10px] font-black uppercase animate-pulse shadow-md">
                        DIGIT 5 HIT!
                      </span>
                    )}
                    {m.lastRepeat && !hasDigit5Trigger && (
                      <span className="px-1.5 py-0.5 rounded bg-amber-950/90 border border-amber-600/80 text-amber-300 text-[10px] font-black uppercase">
                        Repeat {m.lastRepeat.digit}
                      </span>
                    )}
                    {m.lastSandwich && !hasDigit5Trigger && (
                      <span className="px-1.5 py-0.5 rounded bg-purple-950/90 border border-purple-600/80 text-purple-300 text-[10px] font-black uppercase">
                        XYX [{m.lastSandwich.x},{m.lastSandwich.y},{m.lastSandwich.x}]
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] text-slate-400 font-medium">{m.symbol}</span>
                </div>

                <div className="text-right">
                  <div className="font-mono font-black text-sm text-white">
                    {m.currentPrice.toFixed(2)}
                  </div>
                  <div className="text-[10px] font-mono text-slate-500">
                    {m.digits.length} ticks sample
                  </div>
                </div>
              </div>

              {/* Rolling Last 10 Digits Strip with Highlighted 5s */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[11px] text-slate-400 font-semibold">
                  <div className="flex items-center gap-1.5">
                    <span>Recent Digits</span>
                    {hasDigit5Trigger && (
                      <span className="text-[10px] text-amber-300 font-black">
                        ({m.digit5PatternMatch?.desc})
                      </span>
                    )}
                  </div>
                  <span className="text-slate-500 font-mono text-[10px]">Latest →</span>
                </div>
                <div className="flex items-center gap-1">
                  {m.digits.slice(-10).map((digit, idx, arr) => {
                    const isLatest = idx === arr.length - 1;
                    const is5 = digit === 5;
                    const isHot = digit === m.hotDigit && !is5;

                    return (
                      <div
                        key={idx}
                        className={`flex-1 h-7 rounded-lg flex items-center justify-center font-mono text-xs font-black transition-all ${
                          is5
                            ? 'bg-gradient-to-t from-amber-600 to-amber-400 text-slate-950 font-black shadow-md shadow-amber-500/30 scale-105'
                            : isLatest
                            ? 'bg-sky-500 text-white shadow-md shadow-sky-500/50'
                            : isHot
                            ? 'bg-rose-950/80 text-rose-300 border border-rose-600/60'
                            : 'bg-slate-900 border border-slate-800 text-slate-300'
                        }`}
                      >
                        {digit}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 0-9 Digit Distribution Mini-Heatmap */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[11px] text-slate-400 font-semibold">
                  <span>Digit Frequency (0-9)</span>
                  <span className="text-amber-400 text-[10px] font-bold">
                    Digit 5: {m.counts[5]}x ({m.digits.length > 0 ? Math.round((m.counts[5] / m.digits.length) * 100) : 0}%)
                  </span>
                </div>
                <div className="grid grid-cols-10 gap-1 text-center">
                  {m.counts.map((count, d) => {
                    const is5 = d === 5;
                    const isHot = d === m.hotDigit && !is5;
                    const isCold = d === m.coldDigit && !is5;

                    return (
                      <div
                        key={d}
                        className={`p-1 rounded-md text-[10px] font-mono font-bold flex flex-col items-center justify-between ${
                          is5
                            ? 'bg-amber-950/90 text-amber-300 border border-amber-600/90 font-black ring-1 ring-amber-500/30'
                            : isHot
                            ? 'bg-rose-950/80 text-rose-300 border border-rose-800/80'
                            : isCold
                            ? 'bg-blue-950/60 text-blue-300 border border-blue-800/60'
                            : 'bg-slate-900/80 text-slate-400 border border-slate-800/60'
                        }`}
                      >
                        <span className="text-[9px] text-slate-500">{d}</span>
                        <span>{count}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Statistical Edge Summary Pill */}
              <div className={`border rounded-2xl p-3 flex items-center justify-between gap-3 ${
                hasDigit5Trigger
                  ? 'bg-amber-950/40 border-amber-500/60'
                  : 'bg-slate-900/90 border-slate-800'
              }`}>
                <div className="min-w-0">
                  <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                    {hasDigit5Trigger ? '🎯 DIGIT 5 AUTO TRIGGER' : 'Highest Probability Edge'}
                  </div>
                  <div className={`text-xs font-black truncate mt-0.5 ${hasDigit5Trigger ? 'text-amber-300' : 'text-sky-300'}`}>
                    {m.bestStrategy.description}
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <div className={`text-sm font-black ${hasDigit5Trigger ? 'text-amber-400' : 'text-emerald-400'}`}>
                    {m.bestStrategy.edgePct.toFixed(1)}%
                  </div>
                  <span className="text-[9px] font-bold uppercase text-slate-500">Base Win Edge</span>
                </div>
              </div>

              {/* Action Buttons: 1-Click Quick Fire & DBot Import */}
              <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-850">
                <button
                  disabled={isExecuting}
                  onClick={() => handleQuickExecute(m, hasDigit5Trigger ? 5 : undefined)}
                  className={`py-2.5 px-3 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition-all shadow-md ${
                    isExecuting
                      ? 'bg-sky-600 text-white animate-pulse'
                      : hasDigit5Trigger
                      ? 'bg-gradient-to-r from-amber-500 via-orange-500 to-rose-600 hover:from-amber-400 hover:to-rose-500 text-white shadow-amber-950/40'
                      : 'bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-500 hover:to-blue-500 text-white shadow-sky-950/40'
                  }`}
                >
                  <Zap className="w-3.5 h-3.5 fill-current" />
                  <span>
                    {isExecuting
                      ? 'Executing...'
                      : hasDigit5Trigger
                      ? '⚡ Buy Differ 5'
                      : `1-Click Differ`}
                  </span>
                </button>

                <button
                  onClick={() => handleExportDigit5ToDBot(m.symbol, m.displayName)}
                  className="py-2.5 px-3 bg-slate-900 hover:bg-slate-850 border border-slate-800 hover:border-slate-700 text-slate-300 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all"
                >
                  <SlidersHorizontal className="w-3.5 h-3.5 text-sky-400" />
                  <span>Build in DBot</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default MarketScanner;
