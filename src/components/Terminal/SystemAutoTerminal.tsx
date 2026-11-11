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
  Shield,
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
  Radio,
  Crosshair,
  AlertTriangle,
  Repeat,
  Target,
  Shuffle,
  Check,
  Plus,
  FlaskConical,
  Eye,
  EyeOff,
  Gauge,
  Lock,
  Bookmark,
} from 'lucide-react';
import { strategyShield } from '../../services/strategyShield';
import { derivWS } from '../../services/derivWebSocket';

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
  const [shieldConfig, setShieldConfig] = useState(() => strategyShield.getConfig());
  const [shieldEvents, setShieldEvents] = useState(() => strategyShield.getShieldEventLogs());
  const [isShieldPanelOpen, setIsShieldPanelOpen] = useState(false);
  const [isPrivacyGuideOpen, setIsPrivacyGuideOpen] = useState(false);

  useEffect(() => {
    const unsubConfig = systemAutoEngine.subscribeConfig(setConfig);
    const unsubStatus = systemAutoEngine.subscribeStatus(setStatus);
    const unsubHistory = systemAutoEngine.subscribeHistory(setTrades);
    const unsubStates = systemAutoEngine.subscribeMarketStates(setMarketStates);
    const unsubShield = strategyShield.subscribe((cfg) => {
      setShieldConfig(cfg);
      setShieldEvents(strategyShield.getShieldEventLogs());
    });

    return () => {
      unsubConfig();
      unsubStatus();
      unsubHistory();
      unsubStates();
      unsubShield();
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

  const currentActiveMarketSymbol: MarketSymbol = useMemo(() => {
    if (config.strategyMode === 'COMBINER_BOT') {
      const stage = status.combinerCurrentStage || 1;
      if (stage === 1) return config.combinerStage1Market || 'R_10';
      if (stage === 2) return config.combinerStage2Market || 'R_25';
      if (stage === 3) return config.combinerStage3Market || 'R_50';
      if (stage === 4) return config.combinerStage4Market || 'R_100';
    }
    if (config.strategyMode === 'RANGE_LONG_DIFFERS') {
      return config.rangeLongDiffersMarketSymbol || 'R_100';
    }
    if (config.strategyMode === 'DIGIT_MARKER_DIFFER') {
      return config.digitMarkerMarketSymbol || 'R_100';
    }
    if (config.strategyMode === 'ENTRY_POINT_DIFFER') {
      return config.entryPointMarketSymbol || 'R_100';
    }
    if (config.strategyMode === 'DOUBLE_1_SELECT') {
      return config.double1SelectMarketSymbol || 'R_100';
    }
    if (config.strategyMode === 'DOUBLE_END_BOT') {
      return config.doubleEndMarketSymbol || 'R_100';
    }
    if (config.strategyMode === 'FAST_LAST_DIFFER') {
      return status.fastLastDifferTriggeredMarket || config.specificMarketSymbol || 'R_100';
    }
    if (config.strategyMode === 'LAST_DIGIT_DIFFER') {
      return config.lastDigitDifferMarketSymbol || 'R_25';
    }
    if (config.strategyMode === 'DIGIT_SELECT_DIFFER') {
      return config.digitSelectVolatilitySymbol || 'R_100';
    }
    return config.specificMarketSymbol || 'R_100';
  }, [config, status.combinerCurrentStage]);

  const handleSelectActiveMarket = (symbol: MarketSymbol) => {
    if (config.strategyMode === 'COMBINER_BOT') {
      const stage = status.combinerCurrentStage || 1;
      systemAutoEngine.setCombinerStageMarket(stage, symbol);
      if (stage === 1) handleConfigChange({ combinerStage1Market: symbol });
      else if (stage === 2) handleConfigChange({ combinerStage2Market: symbol });
      else if (stage === 3) handleConfigChange({ combinerStage3Market: symbol });
      else if (stage === 4) handleConfigChange({ combinerStage4Market: symbol });
    } else if (config.strategyMode === 'RANGE_LONG_DIFFERS') {
      systemAutoEngine.selectRangeLongDiffersMarket(symbol);
      handleConfigChange({ rangeLongDiffersMarketSymbol: symbol });
    } else if (config.strategyMode === 'DIGIT_MARKER_DIFFER') {
      systemAutoEngine.selectDigitMarkerMarket(symbol);
      handleConfigChange({ digitMarkerMarketSymbol: symbol });
    } else if (config.strategyMode === 'ENTRY_POINT_DIFFER') {
      systemAutoEngine.selectEntryPointMarket(symbol);
      handleConfigChange({ entryPointMarketSymbol: symbol });
    } else if (config.strategyMode === 'DOUBLE_1_SELECT') {
      systemAutoEngine.selectDouble1SelectMarket(symbol);
      handleConfigChange({ double1SelectMarketSymbol: symbol });
    } else if (config.strategyMode === 'DOUBLE_END_BOT') {
      systemAutoEngine.selectDoubleEndMarket(symbol);
      handleConfigChange({ doubleEndMarketSymbol: symbol });
    } else if (config.strategyMode === 'LAST_DIGIT_DIFFER') {
      systemAutoEngine.selectLastDigitDifferMarket(symbol);
      handleConfigChange({ lastDigitDifferMarketSymbol: symbol });
    } else if (config.strategyMode === 'DIGIT_SELECT_DIFFER') {
      systemAutoEngine.selectDigitSelectVolatility(symbol);
      handleConfigChange({ digitSelectVolatilitySymbol: symbol });
    } else {
      systemAutoEngine.selectSpecificMarket(symbol);
      handleConfigChange({ specificMarketSymbol: symbol, marketScope: 'SINGLE_SPECIFIC' });
    }
    if (onSelectSymbol) {
      onSelectSymbol(symbol);
    }
  };

  const currentActiveTargetDigit = useMemo(() => {
    if (config.strategyMode === 'COMBINER_BOT') {
      const stage = status.combinerCurrentStage || 1;
      if (stage === 3 && status.combinerStage3LockedDigit !== null) {
        return status.combinerStage3LockedDigit;
      }
      const live = marketStates.get(currentActiveMarketSymbol);
      return live ? live.lastDigit : null;
    }
    if (config.strategyMode === 'RANGE_LONG_DIFFERS') {
      return status.rangeLongMostAppearingDigit ?? null;
    }
    if (config.strategyMode === 'DIGIT_MARKER_DIFFER') {
      return config.digitMarkerTargetDigit !== undefined ? config.digitMarkerTargetDigit : 6;
    }
    if (config.strategyMode === 'ENTRY_POINT_DIFFER') {
      return config.entryPointTargetDigit !== undefined ? config.entryPointTargetDigit : 5;
    }
    if (config.strategyMode === 'DOUBLE_1_SELECT') {
      return status.double1SelectLockedDigit;
    }
    if (config.strategyMode === 'DOUBLE_END_BOT') {
      const live = marketStates.get(currentActiveMarketSymbol);
      return live?.doubleEndDifferTarget ?? status.doubleEndDifferTarget ?? null;
    }
    if (config.strategyMode === 'FAST_LAST_DIFFER') {
      return config.fastLastDifferChosenDigit !== undefined ? config.fastLastDifferChosenDigit : 5;
    }
    if (config.strategyMode === 'DIGIT_SELECT_DIFFER') {
      return config.digitSelectTargetDigit !== undefined ? config.digitSelectTargetDigit : 5;
    }
    const live = marketStates.get(currentActiveMarketSymbol);
    return live ? live.lastDigit : null;
  }, [config, status.rangeLongMostAppearingDigit, status.double1SelectLockedDigit, status.doubleEndDifferTarget, status.combinerCurrentStage, status.combinerStage3LockedDigit, currentActiveMarketSymbol, marketStates]);

  const handleTriggerActiveDifferTest = () => {
    const market = ASCENDING_VOLATILITY_MARKETS.find((m) => m.symbol === currentActiveMarketSymbol) || ASCENDING_VOLATILITY_MARKETS[0];
    const live = marketStates.get(currentActiveMarketSymbol);
    const lastD = live ? live.lastDigit : 0;
    const differDigit = currentActiveTargetDigit !== null ? currentActiveTargetDigit : lastD;

    if (config.strategyMode === 'COMBINER_BOT') {
      const stage = status.combinerCurrentStage || 1;
      systemAutoEngine.triggerManualCombinerDiffer(stage, market.symbol, differDigit);
    } else if (config.strategyMode === 'RANGE_LONG_DIFFERS') {
      const analysis = systemAutoEngine.getRangeLongAnalysis();
      const targetDigit = analysis.mostAppearingDigit ?? differDigit;
      systemAutoEngine.executeRangeLongDiffersTrade(
        market,
        targetDigit,
        analysis.windowDigits.length > 0 ? analysis.windowDigits : [differDigit],
        analysis.mostAppearingCount || 1
      );
    } else if (config.strategyMode === 'DIGIT_MARKER_DIFFER') {
      systemAutoEngine.triggerManualDigitMarkerDiffer(market.symbol, differDigit);
    } else if (config.strategyMode === 'ENTRY_POINT_DIFFER') {
      systemAutoEngine.triggerManualEntryPointDiffer(market.symbol, differDigit);
    } else if (config.strategyMode === 'DOUBLE_1_SELECT') {
      systemAutoEngine.executeDouble1SelectTrade(market, differDigit);
    } else if (config.strategyMode === 'DOUBLE_END_BOT') {
      systemAutoEngine.triggerManualDoubleEndDiffer(market.symbol, differDigit);
    } else if (config.strategyMode === 'FAST_LAST_DIFFER') {
      systemAutoEngine.triggerManualFastLastDiffer(differDigit, market.symbol);
    } else {
      systemAutoEngine.triggerManualDoubleDiffer(market.symbol, differDigit);
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
    if (config.strategyMode === 'COMBINER_BOT') {
      const m1 = config.combinerStage1Market || 'R_10';
      const m2 = config.combinerStage2Market || 'R_25';
      const m3 = config.combinerStage3Market || 'R_50';
      const m4 = config.combinerStage4Market || 'R_100';
      const symbols = [m1, m2, m3, m4];
      const uniqueSymbols = Array.from(new Set(symbols));
      const found = ASCENDING_VOLATILITY_MARKETS.filter((m) => uniqueSymbols.includes(m.symbol));
      return found.length > 0 ? found : [ASCENDING_VOLATILITY_MARKETS[0]];
    }
    if (config.strategyMode === 'RANGE_LONG_DIFFERS') {
      const target = config.rangeLongDiffersMarketSymbol || 'R_100';
      const found = ASCENDING_VOLATILITY_MARKETS.filter((m) => m.symbol === target);
      return found.length > 0 ? found : [ASCENDING_VOLATILITY_MARKETS.find((m) => m.symbol === 'R_100') || ASCENDING_VOLATILITY_MARKETS[0]];
    }
    if (config.strategyMode === 'DOUBLE_1_SELECT') {
      const target = config.double1SelectMarketSymbol || 'R_100';
      const found = ASCENDING_VOLATILITY_MARKETS.filter((m) => m.symbol === target);
      return found.length > 0 ? found : [ASCENDING_VOLATILITY_MARKETS.find((m) => m.symbol === 'R_100') || ASCENDING_VOLATILITY_MARKETS[0]];
    }
    if (config.strategyMode === 'LAST_DIGIT_DIFFER') {
      const target = config.lastDigitDifferMarketSymbol || 'R_25';
      const found = ASCENDING_VOLATILITY_MARKETS.filter((m) => m.symbol === target);
      return found.length > 0 ? found : [ASCENDING_VOLATILITY_MARKETS.find((m) => m.symbol === 'R_25') || ASCENDING_VOLATILITY_MARKETS[0]];
    }
    if (config.strategyMode === 'ENTRY_POINT_DIFFER') {
      const target = config.entryPointMarketSymbol || 'R_100';
      const found = ASCENDING_VOLATILITY_MARKETS.filter((m) => m.symbol === target);
      return found.length > 0 ? found : [ASCENDING_VOLATILITY_MARKETS.find((m) => m.symbol === 'R_100') || ASCENDING_VOLATILITY_MARKETS[0]];
    }
    if (config.strategyMode === 'DIGIT_MARKER_DIFFER') {
      const target = config.digitMarkerMarketSymbol || 'R_100';
      const found = ASCENDING_VOLATILITY_MARKETS.filter((m) => m.symbol === target);
      return found.length > 0 ? found : [ASCENDING_VOLATILITY_MARKETS.find((m) => m.symbol === 'R_100') || ASCENDING_VOLATILITY_MARKETS[0]];
    }
    if (config.strategyMode === 'DOUBLE_END_BOT') {
      const target = config.doubleEndMarketSymbol || 'R_100';
      const found = ASCENDING_VOLATILITY_MARKETS.filter((m) => m.symbol === target);
      return found.length > 0 ? found : [ASCENDING_VOLATILITY_MARKETS.find((m) => m.symbol === 'R_100') || ASCENDING_VOLATILITY_MARKETS[0]];
    }
    if (config.strategyMode === 'FAST_LAST_DIFFER') {
      return ASCENDING_VOLATILITY_MARKETS;
    }
    if (config.strategyMode === 'DIGIT_SELECT_DIFFER') {
      const target = config.digitSelectVolatilitySymbol || 'R_100';
      const found = ASCENDING_VOLATILITY_MARKETS.filter((m) => m.symbol === target);
      return found.length > 0 ? found : [ASCENDING_VOLATILITY_MARKETS[0]];
    }
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
  }, [config.marketScope, config.specificMarketSymbol, config.selectedSymbols, config.strategyMode, config.doubleEndMarketSymbol, config.lastDigitDifferMarketSymbol, config.digitSelectVolatilitySymbol, config.double1SelectMarketSymbol, config.combinerStage1Market, config.combinerStage2Market, config.combinerStage3Market, config.combinerStage4Market]);

  // Count active Double End Bot patterns across all pool markets
  const activeDoubleEndCount = useMemo(() => {
    let count = 0;
    activeMarketPool.forEach((m) => {
      const state = marketStates.get(m.symbol);
      if (state?.hasDoubleEndPattern) count++;
    });
    return count;
  }, [activeMarketPool, marketStates]);

  // Count active twin digit patterns across all pool markets
  const activeTwinCount = useMemo(() => {
    let count = 0;
    activeMarketPool.forEach((m) => {
      const state = marketStates.get(m.symbol);
      if (state?.hasTwinDigit) count++;
    });
    return count;
  }, [activeMarketPool, marketStates]);

  // Count active alternating odd/even patterns across all pool markets
  const activeAlternatingCount = useMemo(() => {
    let count = 0;
    activeMarketPool.forEach((m) => {
      const state = marketStates.get(m.symbol);
      if (state?.hasAlternatingPattern) count++;
    });
    return count;
  }, [activeMarketPool, marketStates]);

  // Count active polar twin (0,0 or 9,9) patterns across all pool markets
  const activePolarTwinCount = useMemo(() => {
    let count = 0;
    activeMarketPool.forEach((m) => {
      const state = marketStates.get(m.symbol);
      if (state?.hasTwin0or9) count++;
    });
    return count;
  }, [activeMarketPool, marketStates]);

  // Count active Double Bot [x, x, y] patterns across all pool markets
  const activeDoubleBotCount = useMemo(() => {
    let count = 0;
    activeMarketPool.forEach((m) => {
      const state = marketStates.get(m.symbol);
      if (state?.hasDoubleBotPattern) count++;
    });
    return count;
  }, [activeMarketPool, marketStates]);

  // Count active Master Double [d, d] patterns across all pool markets
  const activeMasterDoubleCount = useMemo(() => {
    let count = 0;
    activeMarketPool.forEach((m) => {
      const state = marketStates.get(m.symbol);
      if (state?.hasMasterDoublePattern) count++;
    });
    return count;
  }, [activeMarketPool, marketStates]);

  // Count active Master Double [2] selected patterns across all pool markets
  const activeMasterDouble2Count = useMemo(() => {
    let count = 0;
    const allowed = config.masterDouble2SelectedPatterns || [0, 1, 2, 3, 4, 5, 6, 7, 8];
    activeMarketPool.forEach((m) => {
      const state = marketStates.get(m.symbol);
      if (state?.hasMasterDoublePattern && state.masterDoubleTwinDigit !== null && allowed.includes(state.masterDoubleTwinDigit)) {
        count++;
      }
    });
    return count;
  }, [activeMarketPool, marketStates, config.masterDouble2SelectedPatterns]);

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
                {config.strategyMode === 'DOUBLE_END_BOT' ? (
                  <Zap className="w-6 h-6 animate-pulse text-slate-950" />
                ) : config.strategyMode === 'COMBINER_BOT' ? (
                  <Layers className="w-6 h-6 animate-pulse text-slate-950" />
                ) : config.strategyMode === 'MASTER_DOUBLE_2' ? (
                  <Sparkles className="w-6 h-6 animate-pulse text-pink-900" />
                ) : config.strategyMode === 'MASTER_DOUBLE' ? (
                  <Sparkles className="w-6 h-6 animate-pulse text-purple-900" />
                ) : config.strategyMode === 'DIGIT_SELECT_DIFFER' ? (
                  <Crosshair className="w-6 h-6 animate-pulse text-slate-950" />
                ) : config.strategyMode === 'TWIN_0_AND_9_DIFFER' ? (
                  <Zap className="w-6 h-6 animate-pulse text-slate-950" />
                ) : config.strategyMode === 'DOUBLE_BOT_1TICK' ? (
                  <Sparkles className="w-6 h-6 animate-pulse text-amber-900" />
                ) : config.strategyMode === 'ALTERNATING_DIGITS' ? (
                  <Shuffle className="w-6 h-6 animate-pulse" />
                ) : (
                  <Target className="w-6 h-6 animate-pulse" />
                )}
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-2xl font-black tracking-tight text-white flex items-center gap-2">
                    System Auto Terminal
                  </h1>
                  {config.strategyMode === 'DOUBLE_END_BOT' ? (
                    <>
                      <span className="text-xs px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider bg-gradient-to-r from-amber-500/20 via-orange-500/20 to-emerald-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                        ⚡ Double End Bot
                      </span>
                      <span className="text-xs px-2.5 py-0.5 rounded-full font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                        {config.doubleEndPatternMode === 'PAIR_ONLY' ? 'Pair Only [x, x, y]' : config.doubleEndPatternMode === 'THRICE_ONLY' ? 'Thrice Only [x, x, x, y]' : 'Pair / Thrice [x,x,y] & [x,x,x,y]'}
                      </span>
                      <span className="text-xs px-2.5 py-0.5 rounded-full font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                        Next Digit Settles (1t Differ)
                      </span>
                      <span className="text-xs px-2.5 py-0.5 rounded-full font-mono font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                        {ASCENDING_VOLATILITY_MARKETS.find((m) => m.symbol === (config.doubleEndMarketSymbol || 'R_100'))?.shortName || 'Vol 100'}
                      </span>
                    </>
                  ) : config.strategyMode === 'COMBINER_BOT' ? (
                    <>
                      <span className="text-xs px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider bg-gradient-to-r from-amber-500/20 via-cyan-500/20 to-emerald-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                        🧩 Combiner Bot
                      </span>
                      <span className="text-xs px-2.5 py-0.5 rounded-full font-mono font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                        Stage {status.combinerCurrentStage || 1}/4 Active (Cycle #{status.combinerCycleCount || 1})
                      </span>
                      <span className="text-xs px-2.5 py-0.5 rounded-full font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                        4 Ascending Markets
                      </span>
                      <span className="text-xs px-2.5 py-0.5 rounded-full font-mono font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">
                        [x,x,y➔≠y] ➔ [x,y,x,x➔≠x] ➔ [Lock [x,x]➔≠x] ➔ [Differ Last]
                      </span>
                    </>
                  ) : config.strategyMode === 'MASTER_DOUBLE_2' ? (
                    <>
                      <span className="text-xs px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider bg-pink-500/20 text-pink-300 border border-pink-500/40 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-pink-400 animate-ping" />
                        Auto...Master Double [2]
                      </span>
                      <span className="text-xs px-2.5 py-0.5 rounded-full font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                        {config.masterDouble2SelectedPatterns?.length ?? 9} Patterns Selected
                      </span>
                      <span className="text-xs px-2.5 py-0.5 rounded-full font-mono font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                        Immediate 1-Tick Settle
                      </span>
                      <span className="text-xs px-2.5 py-0.5 rounded-full font-mono font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">
                        [d, d] ➔ Differ ≠ (d+1)
                      </span>
                    </>
                  ) : config.strategyMode === 'DIGIT_MARKER_DIFFER' ? (
                    <>
                      <span className="text-xs px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                        🎯 Digit Marker Bot
                      </span>
                      <span className="text-xs px-2.5 py-0.5 rounded-full font-mono font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                        Marked Differ Target: ≠ {config.digitMarkerTargetDigit ?? 6}
                      </span>
                      <span className="text-xs px-2.5 py-0.5 rounded-full font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                        1-Tick Settle
                      </span>
                      <span className="text-xs px-2.5 py-0.5 rounded-full font-mono font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                        {ASCENDING_VOLATILITY_MARKETS.find((m) => m.symbol === (config.digitMarkerMarketSymbol || 'R_100'))?.shortName || 'Vol 100'}
                      </span>
                    </>
                  ) : config.strategyMode === 'RANGE_LONG_DIFFERS' ? (
                    <>
                      <span className="text-xs px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                        📊 Range long Differs
                      </span>
                      <span className="text-xs px-2.5 py-0.5 rounded-full font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                        7-Digit Window ➔ Most Frequent Differ
                      </span>
                      <span className="text-xs px-2.5 py-0.5 rounded-full font-mono font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                        Buys on 7th Digit ➔ Settles on 8th Digit
                      </span>
                      <span className="text-xs px-2.5 py-0.5 rounded-full font-mono font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                        {ASCENDING_VOLATILITY_MARKETS.find((m) => m.symbol === (config.rangeLongDiffersMarketSymbol || 'R_100'))?.shortName || 'Vol 100'}
                      </span>
                    </>
                  ) : config.strategyMode === 'ENTRY_POINT_DIFFER' ? (
                    <>
                      <span className="text-xs px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
                        Auto...Entry Point Bot
                      </span>
                      <span className="text-xs px-2.5 py-0.5 rounded-full font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                        Scan for Digit [{config.entryPointTargetDigit ?? 5}] ➔ Differ ≠ {config.entryPointTargetDigit ?? 5}
                      </span>
                      <span className="text-xs px-2.5 py-0.5 rounded-full font-mono font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                        1-Tick Close
                      </span>
                      <span className="text-xs px-2.5 py-0.5 rounded-full font-mono font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                        {ASCENDING_VOLATILITY_MARKETS.find((m) => m.symbol === (config.entryPointMarketSymbol || 'R_100'))?.shortName || 'Vol 100'}
                      </span>
                    </>
                  ) : config.strategyMode === 'LAST_DIGIT_DIFFER' ? (
                    <>
                      <span className="text-xs px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                        Auto...Last Digit Differ
                      </span>
                      <span className="text-xs px-2.5 py-0.5 rounded-full font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                        Differ ≠ Last Digit [d]
                      </span>
                      <span className="text-xs px-2.5 py-0.5 rounded-full font-mono font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                        Immediate 1-Tick Settle
                      </span>
                      <span className="text-xs px-2.5 py-0.5 rounded-full font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                        {ASCENDING_VOLATILITY_MARKETS.find((m) => m.symbol === (config.lastDigitDifferMarketSymbol || 'R_25'))?.shortName || 'Vol 25'}
                      </span>
                    </>
                  ) : config.strategyMode === 'MASTER_DOUBLE' ? (
                    <>
                      <span className="text-xs px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider bg-purple-500/20 text-purple-300 border border-purple-500/40 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-purple-400 animate-ping" />
                        Auto...Master Double [1]
                      </span>
                      <span className="text-xs px-2.5 py-0.5 rounded-full font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                        [d, d] ➔ Differ ≠ (d + 1)
                      </span>
                      <span className="text-xs px-2.5 py-0.5 rounded-full font-mono font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                        Immediate 1-Tick Settle
                      </span>
                      <span className="text-xs px-2.5 py-0.5 rounded-full font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                        0,0➔≠1 ... 8,8➔≠9
                      </span>
                    </>
                  ) : config.strategyMode === 'DIGIT_SELECT_DIFFER' ? (
                    <>
                      <span className="text-xs px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider bg-rose-500/20 text-rose-300 border border-rose-500/40 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-rose-400 animate-ping" />
                        Auto...Digit Select Differ
                      </span>
                      <span className="text-xs px-2.5 py-0.5 rounded-full font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                        Differ ≠ {config.digitSelectTargetDigit ?? 5}
                      </span>
                      <span className="text-xs px-2.5 py-0.5 rounded-full font-mono font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                        Immediate 1-Tick Settle
                      </span>
                      <span className="text-xs px-2.5 py-0.5 rounded-full font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                        {ASCENDING_VOLATILITY_MARKETS.find((m) => m.symbol === (config.digitSelectVolatilitySymbol || 'R_100'))?.shortName || 'Vol 100'}
                      </span>
                    </>
                  ) : config.strategyMode === 'DOUBLE_BOT_1TICK' ? (
                    <>
                      <span className="text-xs px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                        Auto...Double Bot [x, x, y] ➔ Differ ≠ y
                      </span>
                      <span className="text-xs px-2.5 py-0.5 rounded-full font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                        3,3,4 ➔ ≠4 | 5,5,6 ➔ ≠6
                      </span>
                      <span className="text-xs px-2.5 py-0.5 rounded-full font-mono font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                        Next Digit Settles (1t)
                      </span>
                      <span className="text-xs px-2.5 py-0.5 rounded-full font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                        All-Markets Radar
                      </span>
                    </>
                  ) : config.strategyMode === 'TWIN_0_AND_9_DIFFER' ? (
                    <>
                      <span className="text-xs px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
                        Polar Twin [0,0 & 9,9] Differ
                      </span>
                      <span className="text-xs px-2.5 py-0.5 rounded-full font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                        [0,0] ➔ ≠0 | [9,9] ➔ ≠9
                      </span>
                      <span className="text-xs px-2.5 py-0.5 rounded-full font-mono font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                        {config.durationTicks} Tick{config.durationTicks > 1 ? 's' : ''} Settle
                      </span>
                      <span className="text-xs px-2.5 py-0.5 rounded-full font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                        Simultaneous All-Markets
                      </span>
                    </>
                  ) : config.strategyMode === 'ALTERNATING_DIGITS' ? (
                    <>
                      <span className="text-xs px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider bg-fuchsia-500/20 text-fuchsia-300 border border-fuchsia-500/40 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-fuchsia-400 animate-ping" />
                        Alternating Digits Bot
                      </span>
                      <span className="text-xs px-2.5 py-0.5 rounded-full font-mono font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                        {config.durationTicks} Tick{config.durationTicks > 1 ? 's' : ''} Settle
                      </span>
                      <span className="text-xs px-2.5 py-0.5 rounded-full font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                        Target Differ ≠ {config.alternatingTargetDigit ?? 5}
                      </span>
                      <span className="text-xs px-2.5 py-0.5 rounded-full font-mono font-bold bg-violet-500/20 text-violet-300 border border-violet-500/30">
                        {config.alternatingCooldownSec ?? 5}s Cooldown
                      </span>
                    </>
                  ) : config.strategyMode === 'ASCENDING_SEQUENTIAL_1TICK' ? (
                    <>
                      <span className="text-xs px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                        Ascending Volatility Rotation (10➔100)
                      </span>
                      <span className="text-xs px-2.5 py-0.5 rounded-full font-mono font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                        1 Tick Settle
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="text-xs px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                        Double Identical Digit Sniper
                      </span>
                      <span className="text-xs px-2.5 py-0.5 rounded-full font-mono font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                        2 Ticks Settle
                      </span>
                    </>
                  )}
                </div>
                <p className="text-xs text-slate-300 mt-1 max-w-3xl leading-relaxed">
                  {config.strategyMode === 'DIGIT_MARKER_DIFFER' ? (
                    <>
                      Digit Marker Bot: Mark which digit you want to Differ (<strong className="text-amber-300 font-mono">Digit {config.digitMarkerTargetDigit ?? 6}</strong>) on your selected volatility market (<strong className="text-cyan-400 font-mono">{ASCENDING_VOLATILITY_MARKETS.find((m) => m.symbol === (config.digitMarkerMarketSymbol || 'R_100'))?.name || 'Volatility 100 Index'}</strong>). The bot scans live incoming ticks (e.g. 3, 7, 8, 6, 9). The instant your marked digit appears, it immediately buys <strong className="text-cyan-300 font-mono">Differ ≠ {config.digitMarkerTargetDigit ?? 6}</strong>, and the <strong className="text-emerald-300">immediate next digit settles and closes the trade in 1 tick</strong> (90.9% win rate)!
                    </>
                  ) : config.strategyMode === 'RANGE_LONG_DIFFERS' ? (
                    <>
                      Range long Differs: Observes the live 7 digits generated on your chosen volatility market (<strong className="text-cyan-400 font-mono">{ASCENDING_VOLATILITY_MARKETS.find((m) => m.symbol === (config.rangeLongDiffersMarketSymbol || 'R_100'))?.name || 'Volatility 100 Index'}</strong>). The bot counts digit occurrences in the 7-digit sequence [d1..d7] and finds the <strong className="text-amber-300 font-mono">most appearing digit</strong>. Exactly on reaching the 7th digit, it buys <strong className="text-emerald-400 font-mono">Differ ≠ [most appearing digit]</strong>, and the trade <strong className="text-cyan-300 font-bold">settles on the 8th digit</strong> in 1 tick!
                    </>
                  ) : config.strategyMode === 'ENTRY_POINT_DIFFER' ? (
                    <>
                      Entry Point Differ Scanner: Scans the selected market (<strong className="text-cyan-400 font-mono">{ASCENDING_VOLATILITY_MARKETS.find((m) => m.symbol === (config.entryPointMarketSymbol || 'R_100'))?.name || 'Volatility 100 Index'}</strong>) in real-time. You select which digit to trade differ (<strong className="text-amber-300 font-mono">Digit {config.entryPointTargetDigit ?? 5}</strong>) from the digit select panel. The exact moment digit <strong className="text-amber-300 font-mono">[{config.entryPointTargetDigit ?? 5}]</strong> appears in the market, the bot immediately buys <strong className="text-cyan-300 font-mono">Differ ≠ {config.entryPointTargetDigit ?? 5}</strong>, and the <strong className="text-emerald-300">immediate next digit settles and closes the trade</strong> (1-Tick Settle, 90.9% win probability)!
                    </>
                  ) : config.strategyMode === 'LAST_DIGIT_DIFFER' ? (
                    <>
                      Last Digit Differ Sniper: Trades Differ of the immediate last digit of the market selected (e.g. <strong className="text-emerald-400 font-mono">{ASCENDING_VOLATILITY_MARKETS.find((m) => m.symbol === (config.lastDigitDifferMarketSymbol || 'R_25'))?.name || 'Volatility 25 Index'}</strong>). Once you click <strong className="text-emerald-400">RUN BOT</strong>, the bot selects the immediate current digit, buys <strong className="text-emerald-400 font-mono">Differ ≠ [immediate digit]</strong> with <strong className="text-cyan-300">1-Tick Duration</strong>, and the <strong className="text-cyan-300">next digit generated settles the trade</strong> — trade wins if the next digit does not equal the trigger digit (90.9% win rate)!
                    </>
                  ) : config.strategyMode === 'MASTER_DOUBLE' ? (
                    <>
                      Master Double Twin-Sequence Sniper: When two identical digits appear (<strong className="text-purple-300 font-mono">[d, d]</strong>), the bot immediately buys <strong className="text-emerald-400 font-mono">Differ ≠ (d + 1)</strong> with <strong className="text-cyan-300">1-Tick Immediate Settle</strong>. The immediate next digit after the twin must not equal the next numerical digit (e.g. <span className="text-amber-300 font-mono">0,0 ➔ Differ ≠ 1</span>, <span className="text-amber-300 font-mono">1,1 ➔ Differ ≠ 2</span> ... <span className="text-amber-300 font-mono">8,8 ➔ Differ ≠ 9</span>). Trades strictly using those patterns and digits only!
                    </>
                  ) : config.strategyMode === 'DIGIT_SELECT_DIFFER' ? (
                    <>
                      Custom Digit Differ Sniper: Select your target digit to differ (<strong className="text-amber-300 font-mono">≠ {config.digitSelectTargetDigit ?? 5}</strong>) and volatility market (<strong className="text-emerald-400 font-mono">{ASCENDING_VOLATILITY_MARKETS.find((m) => m.symbol === (config.digitSelectVolatilitySymbol || 'R_100'))?.name || 'Volatility 100 Index'}</strong>). Clicking <strong className="text-rose-400">RUN BOT</strong> buys the immediate Differ contract (<strong className="text-emerald-400 font-mono">Differ ≠ {config.digitSelectTargetDigit ?? 5}</strong>). The <strong className="text-cyan-300">immediate next digit settles the trade</strong> — trade wins if the immediate next digit is <strong className="text-emerald-300">not {config.digitSelectTargetDigit ?? 5}</strong>!
                    </>
                  ) : config.strategyMode === 'DOUBLE_BOT_1TICK' ? (
                    <>
                      Scans markets for pattern <strong className="text-amber-300 font-mono">[x, x, y]</strong> (two identical digits followed by a differing digit, e.g. <strong className="text-amber-400 font-mono">3, 3, 4</strong> buys <strong className="text-emerald-400 font-mono">Differ ≠ 4</strong> | <strong className="text-amber-400 font-mono">5, 5, 6</strong> buys <strong className="text-emerald-400 font-mono">Differ ≠ 6</strong>). The <strong className="text-cyan-300">very next digit settles the trade</strong> ({config.durationTicks} Tick Settle).
                    </>
                  ) : config.strategyMode === 'TWIN_0_AND_9_DIFFER' ? (
                    <>
                      Scans all markets simultaneously in parallel. Once consecutive identical digits <strong className="text-cyan-400 font-mono">[9, 9]</strong> occur, it immediately buys <strong className="text-emerald-400">Differ ≠ 9</strong>. Once consecutive <strong className="text-amber-400 font-mono">[0, 0]</strong> occur, it immediately buys <strong className="text-emerald-400">Differ ≠ 0</strong>. Fast <strong className="text-cyan-300">{config.durationTicks} Tick</strong> settle with continuous 24/7 scanning.
                    </>
                  ) : config.strategyMode === 'ALTERNATING_DIGITS' ? (
                    <>
                      Trades <strong className="text-fuchsia-400 font-semibold">DIGITDIFF</strong> when consecutive digits are different and the last 3 digits follow an <strong className="text-cyan-400">Alternating Odd/Even pattern</strong> (e.g. <span className="font-mono text-amber-300">[7, 4, 1]</span> Odd-Even-Odd). Buys Differ <strong className="text-emerald-400">≠ {config.alternatingTargetDigit ?? 5}</strong> with strict <strong className="text-cyan-300">{config.durationTicks} Tick</strong> duration and <strong className="text-violet-300">{config.alternatingCooldownSec ?? 5}s cooldown</strong>.
                    </>
                  ) : config.strategyMode === 'ASCENDING_SEQUENTIAL_1TICK' ? (
                    <>
                      Sequentially rotates through the ascending ladder of Volatility indices from Vol 10 up to Vol 100 Index. Buys Differ contracts using 1-tick duration step-by-step.
                    </>
                  ) : (
                    <>
                      Scans all markets in real-time. Once consecutive identical digits occur (e.g. <strong className="text-amber-400 font-mono">[3, 3]</strong>), it immediately buys a <strong className="text-emerald-400">Differ ≠ 3</strong> contract using <strong className="text-cyan-400">2 Ticks duration</strong> where the 2nd tick settles the trade (e.g. 3,3 ➔ tick 1: 6, tick 2: 8 ➔ WIN!).
                    </>
                  )}
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
                {status.isRunning ? (
                  status.isTradeActive ? (
                    <span className="text-amber-300 flex items-center gap-1.5">
                      <Crosshair className="w-3.5 h-3.5 text-amber-400 animate-spin" />
                      1 TRADE IN-FLIGHT
                    </span>
                  ) : status.scanPhase === 'POST_TRADE_COOLDOWN' || status.scanPhase === 'TRADE_SETTLING' ? (
                    <span className="text-cyan-300 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
                      TRADE CLOSED • SCAN IN {status.postTradeCountdownSec ?? 1}S
                    </span>
                  ) : status.isSettling ? (
                    'SETTLING TRADE...'
                  ) : (
                    <span className="text-emerald-300 flex items-center gap-1.5">
                      <Radar className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
                      SCANNING MARKETS
                    </span>
                  )
                ) : (
                  'IDLE / READY'
                )}
              </span>
            </div>

            {/* Virtual-to-Real Mode Toggle Button */}
            <button
              id="btn-toggle-virtual-trade"
              onClick={() => {
                systemAutoEngine.setVirtualLossFilter(!config.virtualLossFilterEnabled);
              }}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-xs shadow-lg transition-all border ${
                config.virtualLossFilterEnabled
                  ? status.virtualModeState === 'REAL_ARMED' || status.virtualModeState === 'REAL_ACTIVE'
                    ? 'bg-gradient-to-r from-red-600 via-orange-600 to-amber-600 text-white border-amber-400 shadow-orange-500/30 ring-2 ring-amber-400 animate-pulse'
                    : 'bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 text-white border-purple-400 shadow-purple-500/25 ring-2 ring-purple-400/60'
                  : 'bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border-slate-700'
              }`}
              title="Virtual Trade: Scan and trade in Demo until 1 loss occurs, then automatically switch to Real account for the next trade!"
            >
              <FlaskConical className={`w-4 h-4 ${config.virtualLossFilterEnabled ? 'text-amber-300' : 'text-slate-400'}`} />
              <div className="flex flex-col text-left">
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] font-black uppercase tracking-wider">Virtual Trade</span>
                  <span className={`text-[9px] px-1.5 py-0.2 rounded font-black ${
                    config.virtualLossFilterEnabled
                      ? status.virtualModeState === 'REAL_ARMED'
                        ? 'bg-amber-400 text-slate-950 font-black animate-bounce'
                        : status.virtualModeState === 'REAL_ACTIVE'
                        ? 'bg-red-400 text-slate-950 font-black'
                        : 'bg-emerald-400 text-slate-950 font-black'
                      : 'bg-slate-800 text-slate-400'
                  }`}>
                    {config.virtualLossFilterEnabled
                      ? status.virtualModeState === 'REAL_ARMED'
                        ? 'REAL ARMED'
                        : status.virtualModeState === 'REAL_ACTIVE'
                        ? 'REAL ACTIVE'
                        : 'DEMO'
                      : 'OFF'}
                  </span>
                </div>
                <span className="text-[9px] text-slate-300">
                  {config.virtualLossFilterEnabled
                    ? status.virtualModeState === 'REAL_ARMED'
                      ? '1 Loss! Next = REAL'
                      : status.virtualModeState === 'REAL_ACTIVE'
                      ? 'Live on Real'
                      : 'Demo ➔ 1 Loss ➔ Real'
                    : 'Click to Activate'}
                </span>
              </div>
            </button>

            {/* 🛡️ Anti-Broker Tracking & Stealth Shield Console Button */}
            <button
              id="btn-toggle-stealth-shield"
              onClick={() => {
                setIsShieldPanelOpen(!isShieldPanelOpen);
              }}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-xs shadow-lg transition-all border ${
                shieldConfig.enableAntiTrackingShield
                  ? 'bg-gradient-to-r from-emerald-950 via-teal-950 to-slate-900 text-emerald-300 border-emerald-500/60 shadow-emerald-950/40 ring-1 ring-emerald-500/40 hover:border-emerald-400'
                  : 'bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border-slate-700'
              }`}
              title="Anti-Broker Tracking Shield: Prevents Deriv dealing desk from profiling your moves, entries, machine cadence, or Martingale patterns"
            >
              <div className="relative">
                <ShieldCheck className={`w-4 h-4 ${shieldConfig.enableAntiTrackingShield ? 'text-emerald-400' : 'text-slate-500'}`} />
                {shieldConfig.enableAntiTrackingShield && (
                  <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                )}
              </div>
              <div className="flex flex-col text-left">
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] font-black uppercase tracking-wider">Stealth Shield</span>
                  <span className={`text-[9px] px-1.5 py-0.2 rounded font-black ${
                    shieldConfig.enableAntiTrackingShield
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                      : 'bg-slate-800 text-slate-400'
                  }`}>
                    {shieldConfig.enableAntiTrackingShield ? 'GHOST ACTIVE' : 'STANDBY'}
                  </span>
                </div>
                <span className="text-[9px] text-slate-300">
                  {shieldConfig.enableAntiTrackingShield
                    ? `Jitter: +${status.lastShieldJitterMs > 0 ? status.lastShieldJitterMs : 110}ms • Fuzz: ON`
                    : 'Click to configure'}
                </span>
              </div>
            </button>

            <button
              id="btn-master-toggle-bot"
              onClick={handleToggleBot}
              className={`flex items-center gap-2.5 px-6 py-3 rounded-xl font-bold text-sm shadow-xl transition-all active:scale-95 ${
                status.isRunning
                  ? 'bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white shadow-red-500/25 ring-2 ring-red-500/50'
                  : config.strategyMode === 'ALTERNATING_DIGITS'
                  ? 'bg-gradient-to-r from-fuchsia-500 via-violet-500 to-cyan-500 hover:from-fuchsia-400 hover:to-violet-400 text-white shadow-fuchsia-500/25 ring-2 ring-fuchsia-500/50 font-black'
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

        {/* Post-Profit Capital Shield Notice */}
        {status.isProfitLocked && (
          <div className="mt-4 p-3.5 rounded-2xl bg-amber-950/80 border border-amber-500 text-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-lg shadow-amber-950/30">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-amber-500 text-slate-950 font-black">
                <DollarSign className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-black text-sm text-white flex items-center gap-2">
                  Session Profit Secured • Protection Active
                </h4>
                <p className="text-xs text-amber-300 mt-0.5">
                  {status.profitLockReason || 'Profit target reached. Live bot halted to protect earnings from broker dealing-desk adaptation.'} <strong>Please withdraw your profit before trading again!</strong>
                </p>
              </div>
            </div>

            <button
              onClick={() => {
                strategyShield.unlockProfitSessionManually();
              }}
              className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs shrink-0 transition-colors"
            >
              Acknowledge & Unlock
            </button>
          </div>
        )}

        {/* 🛡️ Anti-Broker Tracking & Stealth Shield Console (Ghost Mode) */}
        {isShieldPanelOpen && (
          <div className="mt-4 p-5 rounded-2xl bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 border border-emerald-500/60 shadow-2xl relative overflow-hidden">
            {/* Ambient background glow */}
            <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-80 h-80 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />

            <div className="relative z-10 space-y-4">
              {/* Header & Master Shield Toggle */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400">
                    <ShieldCheck className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-black uppercase tracking-wider text-white">
                        Deriv Anti-Tracking & Stealth Shield (Ghost Mode)
                      </h3>
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 animate-pulse">
                        PROTECTION ENGINE
                      </span>
                    </div>
                    <p className="text-xs text-slate-300 mt-0.5">
                      Camouflages bot signatures, randomizes execution millisecond timestamps, fuzzes stakes, and injects decoy manual traffic.
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => setIsPrivacyGuideOpen(!isPrivacyGuideOpen)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-cyan-300 border border-cyan-800/60 text-xs font-bold transition-all"
                  >
                    <Info className="w-3.5 h-3.5" />
                    <span>{isPrivacyGuideOpen ? 'Hide Privacy Verification' : 'Can Deriv Track My Settings?'}</span>
                  </button>

                  <button
                    onClick={() => {
                      const next = !shieldConfig.enableAntiTrackingShield;
                      strategyShield.updateConfig({ enableAntiTrackingShield: next });
                    }}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black shadow-md transition-all ${
                      shieldConfig.enableAntiTrackingShield
                        ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 ring-2 ring-emerald-400/50'
                        : 'bg-slate-800 text-slate-400 hover:text-white border border-slate-700'
                    }`}
                  >
                    <Zap className="w-3.5 h-3.5 fill-current" />
                    <span>{shieldConfig.enableAntiTrackingShield ? 'SHIELD ARMED' : 'SHIELD DISABLED'}</span>
                  </button>

                  <button
                    onClick={() => setIsShieldPanelOpen(false)}
                    className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
                  >
                    <XCircle className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Technical Privacy & Broker Insulation Breakdown */}
              {isPrivacyGuideOpen && (
                <div className="p-4 rounded-xl bg-slate-900/90 border border-cyan-500/40 space-y-3">
                  <div className="flex items-center gap-2 text-cyan-300 font-bold text-xs">
                    <Lock className="w-4 h-4 text-cyan-400" />
                    <span>Technical Architecture: Why Deriv CANNOT Track Your Bot Settings</span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs text-slate-300">
                    <div className="p-3 rounded-lg bg-slate-950/80 border border-slate-800">
                      <div className="font-bold text-white flex items-center gap-1.5 text-xs mb-1">
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        100% Client-Side Isolation
                      </div>
                      <p className="text-[11px] text-slate-400 leading-relaxed">
                        Your bot algorithms, 7-digit window scanner, frequency calculations, and custom rules execute entirely in your local browser memory. Zero bytes of bot settings or strategy source code are ever sent over WebSocket.
                      </p>
                    </div>

                    <div className="p-3 rounded-lg bg-slate-950/80 border border-slate-800">
                      <div className="font-bold text-white flex items-center gap-1.5 text-xs mb-1">
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        Broker Sees Only Raw Buy
                      </div>
                      <p className="text-[11px] text-slate-400 leading-relaxed">
                        Deriv's API only receives standard isolated order payloads: <code className="text-amber-300 text-[10px]">&#123; buy: 1, price: 1.02, contract_type: 'DIGITDIFF' &#125;</code>. Deriv has zero visibility into why you chose that digit or when your window triggered.
                      </p>
                    </div>

                    <div className="p-3 rounded-lg bg-slate-950/80 border border-slate-800">
                      <div className="font-bold text-white flex items-center gap-1.5 text-xs mb-1">
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        Anti-Profiling Countermeasures
                      </div>
                      <p className="text-[11px] text-slate-400 leading-relaxed">
                        To prevent dealing desks from profiling your account via robotic 0ms timestamps, flat stakes, or rigid Martingales, our shield injects human reaction jitter, stake fuzzing, and authentic decoy traffic.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Defensive Modules Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                {/* Module 1: Sub-Tick Timing Jitter */}
                <div className={`p-3.5 rounded-xl border transition-all ${
                  shieldConfig.enableTimingObfuscation
                    ? 'bg-slate-950/90 border-emerald-500/40 text-slate-200'
                    : 'bg-slate-950/40 border-slate-800 text-slate-500'
                }`}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-emerald-400" />
                      <span className="font-bold text-xs text-white">Timing Jitter</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={shieldConfig.enableTimingObfuscation}
                      onChange={(e) => strategyShield.updateConfig({ enableTimingObfuscation: e.target.checked, enableJitter: e.target.checked })}
                      className="rounded accent-emerald-500 cursor-pointer"
                    />
                  </div>
                  <p className="text-[11px] text-slate-400 mb-2">
                    Randomizes micro-delay before buying (+{shieldConfig.minJitterMs}ms to +{shieldConfig.maxJitterMs}ms) to break machine entry cadence.
                  </p>
                  <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono bg-slate-900 px-2 py-1 rounded">
                    <span>Range:</span>
                    <span className="text-emerald-400 font-bold">{shieldConfig.minJitterMs}ms – {shieldConfig.maxJitterMs}ms</span>
                  </div>
                </div>

                {/* Module 2: Stake Fuzzing & Martingale Obfuscation */}
                <div className={`p-3.5 rounded-xl border transition-all ${
                  shieldConfig.enableStakeFuzzing
                    ? 'bg-slate-950/90 border-amber-500/40 text-slate-200'
                    : 'bg-slate-950/40 border-slate-800 text-slate-500'
                }`}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <DollarSign className="w-4 h-4 text-amber-400" />
                      <span className="font-bold text-xs text-white">Stake Obfuscation</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={shieldConfig.enableStakeFuzzing}
                      onChange={(e) => strategyShield.updateConfig({ enableStakeFuzzing: e.target.checked })}
                      className="rounded accent-amber-500 cursor-pointer"
                    />
                  </div>
                  <p className="text-[11px] text-slate-400 mb-2">
                    Injects ±${(shieldConfig.fuzzingMaxCents || 0.03).toFixed(2)} noise into stakes to break broker Martingale curve calculations.
                  </p>
                  <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono bg-slate-900 px-2 py-1 rounded">
                    <span>Micro-Variance:</span>
                    <span className="text-amber-400 font-bold">±${(shieldConfig.fuzzingMaxCents || 0.03).toFixed(2)} cents</span>
                  </div>
                </div>

                {/* Module 3: Decoy Human Traffic Interleaving */}
                <div className={`p-3.5 rounded-xl border transition-all ${
                  shieldConfig.enableDecoyTraffic
                    ? 'bg-slate-950/90 border-cyan-500/40 text-slate-200'
                    : 'bg-slate-950/40 border-slate-800 text-slate-500'
                }`}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Radio className="w-4 h-4 text-cyan-400" />
                      <span className="font-bold text-xs text-white">Decoy Traffic</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={shieldConfig.enableDecoyTraffic}
                      onChange={(e) => strategyShield.updateConfig({ enableDecoyTraffic: e.target.checked })}
                      className="rounded accent-cyan-500 cursor-pointer"
                    />
                  </div>
                  <p className="text-[11px] text-slate-400 mb-2">
                    Intersperse human balance queries and secondary market chart pings every {shieldConfig.decoyIntervalSec || 15}s.
                  </p>
                  <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono bg-slate-900 px-2 py-1 rounded">
                    <span>Simulated Activity:</span>
                    <span className="text-cyan-400 font-bold">Multi-Asset Browsing</span>
                  </div>
                </div>

                {/* Module 4: Phantom Market Hopping */}
                <div className={`p-3.5 rounded-xl border transition-all ${
                  shieldConfig.enableDynamicMarketHopping
                    ? 'bg-slate-950/90 border-purple-500/40 text-slate-200'
                    : 'bg-slate-950/40 border-slate-800 text-slate-500'
                }`}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Shuffle className="w-4 h-4 text-purple-400" />
                      <span className="font-bold text-xs text-white">Phantom Hopping</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={shieldConfig.enableDynamicMarketHopping}
                      onChange={(e) => strategyShield.updateConfig({ enableDynamicMarketHopping: e.target.checked })}
                      className="rounded accent-purple-500 cursor-pointer"
                    />
                  </div>
                  <p className="text-[11px] text-slate-400 mb-2">
                    Automatically rotates volatility assets after trades to prevent dealing-desk single-index trapping.
                  </p>
                  <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono bg-slate-900 px-2 py-1 rounded">
                    <span>Rotation Pool:</span>
                    <span className="text-purple-400 font-bold">Vol 10 ➔ 100</span>
                  </div>
                </div>
              </div>

              {/* Bottom Row: Threat Radar, Zero-Trace Purge, and Live Event Stream */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 pt-2">
                {/* Dealing-Desk Threat Radar */}
                <div className="p-3.5 rounded-xl bg-slate-950/90 border border-slate-800 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Radar className="w-4 h-4 text-teal-400" />
                        <span className="font-bold text-xs text-white">Broker Manipulation Radar</span>
                      </div>
                      <span className={`text-[10px] px-2 py-0.5 rounded font-black ${
                        status.manipulationThreatScore < 30
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                          : status.manipulationThreatScore < 60
                          ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                          : 'bg-red-500/20 text-red-400 border border-red-500/40 animate-pulse'
                      }`}>
                        {status.manipulationThreatLevel || 'CLEAN'}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400">
                      Monitors tick delivery delays, quote withholding, and artificial digit clustering. Engages Evasive Hold if score spikes.
                    </p>
                  </div>

                  <div className="mt-3 flex items-center justify-between text-xs font-mono">
                    <span className="text-slate-400">Threat Score:</span>
                    <span className="font-bold text-emerald-400">{status.manipulationThreatScore}/100</span>
                  </div>
                </div>

                {/* Live Evasion Stream */}
                <div className="lg:col-span-2 p-3.5 rounded-xl bg-slate-950/90 border border-slate-800 flex flex-col justify-between">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Activity className="w-4 h-4 text-emerald-400" />
                      <span className="font-bold text-xs text-white">Real-Time Evasion Stream</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          strategyShield.triggerDecoyIfEligible((req) => {
                            derivWS.sendDecoyInquiry();
                          });
                        }}
                        className="px-2 py-1 rounded bg-slate-900 hover:bg-slate-800 border border-slate-700 text-[10px] text-cyan-300 font-bold"
                        title="Send an immediate decoy request to simulate active manual trader"
                      >
                        Send Decoy Ping
                      </button>
                      <button
                        onClick={() => {
                          strategyShield.purgeAllTradeHistoryAndFootprint();
                          systemAutoEngine.purgeAllTradeHistory();
                        }}
                        className="px-2 py-1 rounded bg-rose-950/80 hover:bg-rose-900 border border-rose-800 text-[10px] text-rose-300 font-bold"
                        title="Purge all local session logs and memory footprint immediately"
                      >
                        Flush Footprint
                      </button>
                    </div>
                  </div>

                  <div className="bg-slate-900/90 rounded-lg p-2.5 font-mono text-[10px] space-y-1 max-h-24 overflow-y-auto divide-y divide-slate-800/50">
                    {shieldEvents.length === 0 ? (
                      <div className="text-slate-500 py-2 text-center">No stealth actions logged yet. Start bot to generate live events.</div>
                    ) : (
                      shieldEvents.slice(0, 5).map((evt) => (
                        <div key={evt.id} className="pt-1 first:pt-0 flex items-start gap-2 text-slate-300">
                          <span className="text-slate-500 shrink-0">{new Date(evt.time).toLocaleTimeString()}</span>
                          <span className="leading-tight">{evt.text}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Live Strategy Mode Switcher Pills */}
        <div className="mt-5 pt-4 border-t border-slate-800/80 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider flex items-center gap-1.5">
              <Crosshair className="w-3.5 h-3.5 text-rose-400" />
              <span>Strategy Engine:</span>
            </span>

            <button
              disabled={status.isRunning}
              onClick={() => handleConfigChange({
                strategyMode: 'COMBINER_BOT',
                durationTicks: 1,
                combinerStage1Market: config.combinerStage1Market || 'R_10',
                combinerStage2Market: config.combinerStage2Market || 'R_25',
                combinerStage3Market: config.combinerStage3Market || 'R_50',
                combinerStage4Market: config.combinerStage4Market || 'R_100',
              })}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                config.strategyMode === 'COMBINER_BOT'
                  ? 'bg-gradient-to-r from-amber-500 via-emerald-500 to-cyan-500 text-slate-950 font-black shadow-lg shadow-amber-500/30 ring-2 ring-amber-300'
                  : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800 disabled:opacity-50'
              }`}
            >
              <Layers className={`w-3.5 h-3.5 ${config.strategyMode === 'COMBINER_BOT' ? 'text-slate-950' : 'text-amber-400'}`} />
              <span>🧩 Combiner Bot (4-Stage Ascending)</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-900/80 text-amber-300 border border-amber-500/40 font-mono">
                [x,x,y] ➔ [x,y,x,x] ➔ Lock [x,x] ➔ Differ Last
              </span>
            </button>

            <button
              id="btn-strategy-double-end-bot"
              disabled={status.isRunning}
              onClick={() => handleConfigChange({
                strategyMode: 'DOUBLE_END_BOT',
                durationTicks: 1,
                doubleEndMarketSymbol: config.doubleEndMarketSymbol || 'R_100',
                doubleEndPatternMode: config.doubleEndPatternMode || 'PAIR_OR_THRICE',
              })}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                config.strategyMode === 'DOUBLE_END_BOT'
                  ? 'bg-gradient-to-r from-amber-500 via-orange-500 to-emerald-500 text-slate-950 font-black shadow-lg shadow-amber-500/30 ring-2 ring-amber-300'
                  : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800 disabled:opacity-50'
              }`}
            >
              <Zap className={`w-3.5 h-3.5 ${config.strategyMode === 'DOUBLE_END_BOT' ? 'text-slate-950' : 'text-amber-400'}`} />
              <span>Double End Bot</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-900/80 text-amber-300 border border-amber-500/40 font-mono">
                Pair/Thrice [x,x,y] ➔ Differ ≠ y • 1t
              </span>
            </button>

            <button
              id="btn-strategy-fast-last-differ"
              disabled={status.isRunning}
              onClick={() => handleConfigChange({
                strategyMode: 'FAST_LAST_DIFFER',
                durationTicks: 1,
                fastLastDifferChosenDigit: config.fastLastDifferChosenDigit !== undefined ? config.fastLastDifferChosenDigit : 5,
              })}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                config.strategyMode === 'FAST_LAST_DIFFER'
                  ? 'bg-gradient-to-r from-cyan-400 via-teal-500 to-emerald-400 text-slate-950 font-black shadow-lg shadow-cyan-500/30 ring-2 ring-cyan-300'
                  : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800 disabled:opacity-50'
              }`}
            >
              <Zap className={`w-3.5 h-3.5 ${config.strategyMode === 'FAST_LAST_DIFFER' ? 'text-slate-950' : 'text-cyan-400'}`} />
              <span>⚡ Fast Last Differ</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-900/80 text-cyan-300 border border-cyan-500/40 font-mono">
                All-Markets Radar • First to [{config.fastLastDifferChosenDigit ?? 5}] ➔ Differ ≠ {config.fastLastDifferChosenDigit ?? 5} • 1t
              </span>
            </button>

            <button
              disabled={status.isRunning}
              onClick={() => handleConfigChange({
                strategyMode: 'DOUBLE_1_SELECT',
                durationTicks: 1,
                double1SelectMarketSymbol: config.double1SelectMarketSymbol || 'R_100',
                double1SelectMaxDigitsRange: config.double1SelectMaxDigitsRange ?? 6,
              })}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                config.strategyMode === 'DOUBLE_1_SELECT'
                  ? 'bg-gradient-to-r from-amber-500 via-orange-500 to-cyan-500 text-slate-950 font-black shadow-md shadow-amber-500/30 ring-1 ring-amber-300'
                  : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800 disabled:opacity-50'
              }`}
            >
              <Lock className={`w-3.5 h-3.5 ${config.strategyMode === 'DOUBLE_1_SELECT' ? 'text-slate-950' : 'text-amber-400'}`} />
              <span>[Double 1 Select]</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-900/80 text-amber-300 border border-amber-500/40 font-mono">
                Lock [d,d] ➔ Wait ≤{config.double1SelectMaxDigitsRange ?? 6}t ➔ Differ ≠ d
              </span>
            </button>

            <button
              disabled={status.isRunning}
              onClick={() => handleConfigChange({
                strategyMode: 'DIGIT_MARKER_DIFFER',
                durationTicks: 1,
                digitMarkerMarketSymbol: config.digitMarkerMarketSymbol || 'R_100',
                digitMarkerTargetDigit: config.digitMarkerTargetDigit !== undefined ? config.digitMarkerTargetDigit : 6,
              })}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                config.strategyMode === 'DIGIT_MARKER_DIFFER'
                  ? 'bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 text-slate-950 font-black shadow-md shadow-orange-500/30 ring-1 ring-amber-300'
                  : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800 disabled:opacity-50'
              }`}
            >
              <Bookmark className={`w-3.5 h-3.5 ${config.strategyMode === 'DIGIT_MARKER_DIFFER' ? 'text-slate-950' : 'text-amber-400'}`} />
              <span>Digit Marker Bot</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-900/80 text-amber-300 border border-amber-500/40 font-mono">
                ≠ Digit {config.digitMarkerTargetDigit ?? 6} • Scan ➔ 1t
              </span>
            </button>

            <button
              disabled={status.isRunning}
              onClick={() => handleConfigChange({
                strategyMode: 'RANGE_LONG_DIFFERS',
                durationTicks: 1,
                rangeLongDiffersMarketSymbol: config.rangeLongDiffersMarketSymbol || 'R_100',
              })}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                config.strategyMode === 'RANGE_LONG_DIFFERS'
                  ? 'bg-gradient-to-r from-emerald-500 via-teal-500 to-indigo-500 text-slate-950 font-black shadow-md shadow-emerald-500/30 ring-1 ring-emerald-300'
                  : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800 disabled:opacity-50'
              }`}
            >
              <BarChart2 className={`w-3.5 h-3.5 ${config.strategyMode === 'RANGE_LONG_DIFFERS' ? 'text-slate-950' : 'text-emerald-400'}`} />
              <span>Range long Differs</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-900/80 text-emerald-300 border border-emerald-500/40 font-mono">
                7-Digit Window ➔ Most Frequent Differ ➔ 8th Settle
              </span>
            </button>

            <button
              disabled={status.isRunning}
              onClick={() => handleConfigChange({
                strategyMode: 'ENTRY_POINT_DIFFER',
                durationTicks: 1,
                entryPointMarketSymbol: config.entryPointMarketSymbol || 'R_100',
                entryPointTargetDigit: config.entryPointTargetDigit !== undefined ? config.entryPointTargetDigit : 5,
              })}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                config.strategyMode === 'ENTRY_POINT_DIFFER'
                  ? 'bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-500 text-white font-black shadow-md shadow-cyan-500/30 ring-1 ring-cyan-300'
                  : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800 disabled:opacity-50'
              }`}
            >
              <Target className="w-3.5 h-3.5 text-cyan-300" />
              <span>Entry Point Bot</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-900/80 text-cyan-300 border border-cyan-500/40 font-mono">
                ≠ Digit {config.entryPointTargetDigit ?? 5} • Scan ➔ 1t
              </span>
            </button>

            <button
              disabled={status.isRunning}
              onClick={() => handleConfigChange({
                strategyMode: 'LAST_DIGIT_DIFFER',
                durationTicks: 1,
                lastDigitDifferMarketSymbol: config.lastDigitDifferMarketSymbol || 'R_25',
              })}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                config.strategyMode === 'LAST_DIGIT_DIFFER'
                  ? 'bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 text-slate-950 font-black shadow-md shadow-emerald-500/30 ring-1 ring-emerald-300'
                  : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800 disabled:opacity-50'
              }`}
            >
              <Zap className="w-3.5 h-3.5 text-slate-950" />
              <span>Last Digit Differ</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-900/80 text-emerald-300 border border-emerald-500/40 font-mono">
                ≠ Immediate Digit • 1t
              </span>
            </button>

            <button
              disabled={status.isRunning}
              onClick={() => handleConfigChange({
                strategyMode: 'MASTER_DOUBLE',
                durationTicks: 1,
              })}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                config.strategyMode === 'MASTER_DOUBLE'
                  ? 'bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-600 text-white font-black shadow-md shadow-purple-500/25 ring-1 ring-purple-400'
                  : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800 disabled:opacity-50'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-purple-300" />
              <span>Auto..Master Double [1]</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-900/80 text-purple-300 border border-purple-500/40 font-mono">
                [0..8] • 1t
              </span>
            </button>

            <button
              disabled={status.isRunning}
              onClick={() => handleConfigChange({
                strategyMode: 'MASTER_DOUBLE_2',
                durationTicks: 1,
                masterDouble2SelectedPatterns: config.masterDouble2SelectedPatterns || [0, 1, 2, 3, 4, 5, 6, 7, 8],
              })}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                config.strategyMode === 'MASTER_DOUBLE_2'
                  ? 'bg-gradient-to-r from-pink-600 via-rose-600 to-purple-600 text-white font-black shadow-md shadow-pink-500/25 ring-1 ring-pink-400'
                  : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800 disabled:opacity-50'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-pink-300" />
              <span>Auto..Master Double [2]</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-900/80 text-pink-300 border border-pink-500/40 font-mono">
                Pattern Picker • 1t
              </span>
            </button>

            <button
              disabled={status.isRunning}
              onClick={() => handleConfigChange({
                strategyMode: 'DIGIT_SELECT_DIFFER',
                durationTicks: 1,
                digitSelectTargetDigit: config.digitSelectTargetDigit ?? 5,
                digitSelectVolatilitySymbol: config.digitSelectVolatilitySymbol || 'R_100',
              })}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                config.strategyMode === 'DIGIT_SELECT_DIFFER'
                  ? 'bg-gradient-to-r from-rose-500 via-pink-600 to-fuchsia-600 text-white font-black shadow-md shadow-rose-500/25 ring-1 ring-rose-400'
                  : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800 disabled:opacity-50'
              }`}
            >
              <Crosshair className="w-3.5 h-3.5 text-rose-200" />
              <span>Digit Select Differ</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-900/80 text-rose-300 border border-rose-500/40 font-mono">
                ≠ {config.digitSelectTargetDigit ?? 5} • 1t Immediate
              </span>
            </button>

            <button
              disabled={status.isRunning}
              onClick={() => handleConfigChange({
                strategyMode: 'DOUBLE_BOT_1TICK',
                durationTicks: 1,
              })}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                config.strategyMode === 'DOUBLE_BOT_1TICK'
                  ? 'bg-gradient-to-r from-amber-500 via-yellow-500 to-orange-500 text-slate-950 font-black shadow-md shadow-amber-500/25 ring-1 ring-amber-400'
                  : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800 disabled:opacity-50'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-900" />
              <span>Auto Double Bot (3,3,4 ➔ ≠4 | 5,5,6 ➔ ≠6)</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-900/80 text-amber-300 border border-amber-500/40 font-mono">
                1-Tick Settle
              </span>
            </button>

            <button
              disabled={status.isRunning}
              onClick={() => handleConfigChange({
                strategyMode: 'TWIN_0_AND_9_DIFFER',
                durationTicks: 1,
              })}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                config.strategyMode === 'TWIN_0_AND_9_DIFFER'
                  ? 'bg-gradient-to-r from-cyan-500 via-blue-600 to-indigo-600 text-white font-black shadow-md shadow-cyan-500/25 ring-1 ring-cyan-400'
                  : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800 disabled:opacity-50'
              }`}
            >
              <Zap className="w-3.5 h-3.5 text-cyan-300" />
              <span>Polar Twin (0,0 ➔ ≠0 | 9,9 ➔ ≠9)</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-900/80 text-cyan-300 border border-cyan-500/40 font-mono">
                All-Markets
              </span>
            </button>

            <button
              disabled={status.isRunning}
              onClick={() => handleConfigChange({
                strategyMode: 'ALTERNATING_DIGITS',
                durationTicks: 1,
                alternatingTargetDigit: 5,
                alternatingCooldownSec: 5,
                alternatingPatternLength: 3,
              })}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                config.strategyMode === 'ALTERNATING_DIGITS'
                  ? 'bg-gradient-to-r from-fuchsia-600 via-violet-600 to-purple-600 text-white font-black shadow-md shadow-fuchsia-500/25 ring-1 ring-fuchsia-400'
                  : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800 disabled:opacity-50'
              }`}
            >
              <Shuffle className="w-3.5 h-3.5 text-fuchsia-400" />
              <span>Alternating Digits (1t ≠ 5, 5s Cooldown)</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-900/80 text-fuchsia-300 border border-fuchsia-500/40 font-mono">
                Pattern L=3
              </span>
            </button>

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
                2-Tick
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
            {config.strategyMode === 'COMBINER_BOT' ? (
              <span className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                <span>
                  <strong className="text-amber-300">Combiner Cycle #{status.combinerCycleCount || 1}</strong> • Stage <strong className="text-cyan-300">{status.combinerCurrentStage || 1}/4</strong>: {
                    (status.combinerCurrentStage || 1) === 1 ? (
                      <>Pattern <strong className="text-emerald-400 font-mono">[x, x, y] ➔ Differ ≠ y</strong> on <strong className="text-cyan-300">{ASCENDING_VOLATILITY_MARKETS.find((m) => m.symbol === (config.combinerStage1Market || 'R_10'))?.shortName || 'Vol 10'}</strong></>
                    ) : status.combinerCurrentStage === 2 ? (
                      <>Pattern <strong className="text-emerald-400 font-mono">[x, y, x, x] ➔ Differ ≠ x</strong> on <strong className="text-cyan-300">{ASCENDING_VOLATILITY_MARKETS.find((m) => m.symbol === (config.combinerStage2Market || 'R_25'))?.shortName || 'Vol 25'}</strong></>
                    ) : status.combinerCurrentStage === 3 ? (
                      <>Double <strong className="text-amber-400 font-mono">[x, x]</strong> Lock ➔ Reappearance Differ ≠ x on <strong className="text-cyan-300">{ASCENDING_VOLATILITY_MARKETS.find((m) => m.symbol === (config.combinerStage3Market || 'R_50'))?.shortName || 'Vol 50'}</strong> ({status.combinerStage3State === 'LOCKED_WAITING_FOR_REAPPEARANCE' ? `Locked [${status.combinerStage3LockedDigit}]` : 'Hunting [x,x]'})</>
                    ) : (
                      <>Differ Last Digit on <strong className="text-cyan-300">{ASCENDING_VOLATILITY_MARKETS.find((m) => m.symbol === (config.combinerStage4Market || 'R_100'))?.shortName || 'Vol 100'}</strong></>
                    )
                  }
                </span>
              </span>
            ) : config.strategyMode === 'DOUBLE_END_BOT' ? (
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                <span>
                  Double End: <strong className="text-cyan-300">{ASCENDING_VOLATILITY_MARKETS.find((m) => m.symbol === (config.doubleEndMarketSymbol || 'R_100'))?.shortName || 'Vol 100'}</strong> • Mode: <strong className="text-amber-300 font-bold">{config.doubleEndPatternMode === 'PAIR_ONLY' ? 'Pair [x,x,y]' : config.doubleEndPatternMode === 'THRICE_ONLY' ? 'Thrice [x,x,x,y]' : 'Pair / Thrice'}</strong>
                  {status.doubleEndDifferTarget !== null ? (
                    <> • Trigger: <strong className="text-amber-300 font-bold">{status.doubleEndDetectedPattern} [{status.doubleEndDigits.join(', ')}]</strong> ➔ <strong className="text-emerald-400 font-bold">Differ ≠ {status.doubleEndDifferTarget} (1t)</strong></>
                  ) : (
                    <> • Status: <strong className="text-emerald-300">Live Scanning</strong></>
                  )}
                </span>
              </span>
            ) : config.strategyMode === 'FAST_LAST_DIFFER' ? (
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
                <span>
                  Fast Last Differ: Chosen Digit <strong className="text-cyan-300 font-bold">[{config.fastLastDifferChosenDigit ?? 5}]</strong> • Scanning <strong className="text-amber-300 font-bold">All 13 Markets Simultaneously</strong> • Target: <strong className="text-emerald-400 font-bold">Differ ≠ {config.fastLastDifferChosenDigit ?? 5} (1t)</strong>
                  {status.fastLastDifferTriggeredMarket ? (
                    <> • Triggered on: <strong className="text-cyan-300 font-mono font-bold">{ASCENDING_VOLATILITY_MARKETS.find((m) => m.symbol === status.fastLastDifferTriggeredMarket)?.shortName || status.fastLastDifferTriggeredMarket}</strong></>
                  ) : (
                    <> • Status: <strong className="text-emerald-300 font-bold">Radar Active (First Market to hit [{config.fastLastDifferChosenDigit ?? 5}] trades)</strong></>
                  )}
                </span>
              </span>
            ) : config.strategyMode === 'DOUBLE_1_SELECT' ? (
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                <span>
                  [Double 1 Select] Market: <strong className="text-cyan-300">{ASCENDING_VOLATILITY_MARKETS.find((m) => m.symbol === (config.double1SelectMarketSymbol || 'R_100'))?.shortName || 'Vol 100'}</strong>
                  {status.double1SelectLockedDigit !== null ? (
                    <> • Locked Digit: <strong className="text-amber-300 font-bold">[{status.double1SelectLockedDigit}]</strong> ➔ Digits: <strong className="text-cyan-300">[{status.double1SelectInterveningDigits.join(', ') || '0'}]</strong> ({status.double1SelectInterveningDigits.length}/{config.double1SelectMaxDigitsRange ?? 6} ticks) ➔ Next: <strong className="text-emerald-400">Differ ≠ {status.double1SelectLockedDigit} (1t)</strong></>
                  ) : (
                    <> • Status: <strong className="text-emerald-300">Scanning for [d, d] or [d, d, d]</strong> (Range: {config.double1SelectMaxDigitsRange ?? 6}t)</>
                  )}
                </span>
              </span>
            ) : config.strategyMode === 'LAST_DIGIT_DIFFER' ? (
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>Market: <strong className="text-emerald-300">{ASCENDING_VOLATILITY_MARKETS.find((m) => m.symbol === (config.lastDigitDifferMarketSymbol || 'R_25'))?.shortName || 'Vol 25'}</strong> • Immediate Digit: <strong className="text-amber-300 font-bold">[{marketStates.get(config.lastDigitDifferMarketSymbol || 'R_25')?.lastDigit ?? 0}]</strong> ➔ <strong className="text-emerald-400">Differ ≠ {marketStates.get(config.lastDigitDifferMarketSymbol || 'R_25')?.lastDigit ?? 0}</strong> (1t)</span>
              </span>
            ) : config.strategyMode === 'MASTER_DOUBLE_2' ? (
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-pink-400 animate-pulse" />
                <span>Selected Patterns in Pool: <strong className="text-pink-300">{activeMasterDouble2Count}</strong> ({config.masterDouble2SelectedPatterns?.length ?? 9}/9 armed)</span>
              </span>
            ) : config.strategyMode === 'MASTER_DOUBLE' ? (
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-purple-400 animate-pulse" />
                <span>Master Double [d, d] in Pool: <strong className="text-purple-300">{activeMasterDoubleCount}</strong></span>
              </span>
            ) : config.strategyMode === 'DIGIT_SELECT_DIFFER' ? (
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-rose-400 animate-pulse" />
                <span>Target: <strong className="text-rose-300">Differ ≠ {config.digitSelectTargetDigit ?? 5}</strong> on <strong className="text-emerald-300">{ASCENDING_VOLATILITY_MARKETS.find((m) => m.symbol === (config.digitSelectVolatilitySymbol || 'R_100'))?.shortName || 'Vol 100'}</strong> (Immediate)</span>
              </span>
            ) : config.strategyMode === 'DOUBLE_BOT_1TICK' ? (
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                <span>Double Bot [x,x,y] in Pool: <strong className="text-amber-300">{activeDoubleBotCount}</strong></span>
              </span>
            ) : config.strategyMode === 'TWIN_0_AND_9_DIFFER' ? (
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
                <span>Polar Twins [0,0 / 9,9] in Pool: <strong className="text-cyan-300">{activePolarTwinCount}</strong></span>
              </span>
            ) : config.strategyMode === 'ALTERNATING_DIGITS' ? (
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-fuchsia-400" />
                <span>Alternating Patterns in Pool: <strong className="text-fuchsia-300">{activeAlternatingCount}</strong></span>
              </span>
            ) : (
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                <span>Twin Digits in Pool: <strong className="text-amber-400">{activeTwinCount}</strong></span>
              </span>
            )}
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

            <span className="text-slate-600">•</span>
            <button
              type="button"
              disabled={status.isRunning}
              onClick={() => handleConfigChange({ singleTradeSequentialMode: !config.singleTradeSequentialMode })}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-bold transition-all ${
                config.singleTradeSequentialMode !== false
                  ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/50 shadow-sm'
                  : 'bg-slate-950 text-slate-500 border-slate-800 hover:text-slate-300'
              }`}
              title="1 Trade at a Time: Takes 1 trade, waits for contract to close and settle, then scans again"
            >
              <Crosshair className="w-3.5 h-3.5 text-cyan-400" />
              <span>1-Trade Sequential Mode:</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded font-black ${
                config.singleTradeSequentialMode !== false
                  ? 'bg-cyan-400 text-slate-950'
                  : 'bg-slate-800 text-slate-400'
              }`}>
                {config.singleTradeSequentialMode !== false ? 'ON' : 'OFF'}
              </span>
            </button>
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

      {/* 🧪 Virtual-to-Real Trading Control & Live Status Banner */}
      <div className={`rounded-2xl border p-4 sm:p-5 transition-all shadow-xl ${
        config.virtualLossFilterEnabled
          ? status.virtualModeState === 'REAL_ARMED' || status.virtualModeState === 'REAL_ACTIVE'
            ? 'bg-gradient-to-r from-amber-950/90 via-slate-900 to-rose-950/90 border-amber-500/70 shadow-amber-500/15 ring-1 ring-amber-500/50'
            : 'bg-gradient-to-r from-purple-950/80 via-slate-900 to-indigo-950/80 border-purple-500/60 shadow-purple-500/15'
          : 'bg-slate-900/80 border-slate-800'
      }`}>
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center gap-3.5">
            <div className={`p-3 rounded-2xl border shrink-0 ${
              config.virtualLossFilterEnabled
                ? status.virtualModeState === 'REAL_ARMED'
                  ? 'bg-amber-500/20 text-amber-300 border-amber-400 animate-bounce'
                  : status.virtualModeState === 'REAL_ACTIVE'
                  ? 'bg-rose-500/20 text-rose-300 border-rose-400 animate-pulse'
                  : 'bg-purple-500/20 text-purple-300 border-purple-400/60'
                : 'bg-slate-800 text-slate-400 border-slate-700'
            }`}>
              <FlaskConical className="w-6 h-6" />
            </div>

            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-sm font-black uppercase tracking-wider text-white flex items-center gap-2">
                  <span>Virtual Trade (Demo ➔ 1 Loss ➔ Real Account)</span>
                </h3>

                <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-black uppercase tracking-wider font-mono ${
                  config.virtualLossFilterEnabled
                    ? status.virtualModeState === 'REAL_ARMED'
                      ? 'bg-amber-400 text-slate-950 animate-pulse'
                      : status.virtualModeState === 'REAL_ACTIVE'
                      ? 'bg-rose-500 text-white animate-pulse'
                      : 'bg-purple-500 text-white'
                    : 'bg-slate-800 text-slate-400'
                }`}>
                  {config.virtualLossFilterEnabled
                    ? status.virtualModeState === 'REAL_ARMED'
                      ? '🔥 REAL ACCOUNT ARMED'
                      : status.virtualModeState === 'REAL_ACTIVE'
                      ? '⚡ REAL TRADE LIVE'
                      : '🧪 DEMO SCANNING (STAGE 1)'
                    : 'INACTIVE / DIRECT REAL'}
                </span>
              </div>

              <p className="text-xs text-slate-300 mt-1 max-w-2xl">
                {config.virtualLossFilterEnabled ? (
                  status.virtualModeState === 'REAL_ARMED' ? (
                    <span className="text-amber-300 font-bold">
                      🚨 1 Virtual loss detected on Demo! The NEXT trade is now ARMED and will execute on your REAL ACCOUNT with Real Stake ($<strong>{status.currentStake.toFixed(2)}</strong>).
                    </span>
                  ) : status.virtualModeState === 'REAL_ACTIVE' ? (
                    <span className="text-rose-300 font-bold">
                      ⚡ REAL ACCOUNT TRADE IN-FLIGHT! Contract is active on Real Account. Once this trade WINS, bot will automatically cycle back to Demo mode.
                    </span>
                  ) : (
                    <span>
                      Bot is scanning and trading on <strong className="text-purple-300">DEMO</strong> mode with Demo stake ($<strong className="text-white">{(config.virtualDemoStake || 1.00).toFixed(2)}</strong>). It will automatically switch to your <strong className="text-amber-300">REAL ACCOUNT</strong> immediately when a single demo loss occurs!
                    </span>
                  )
                ) : (
                  <span>
                    When activated, all bot strategies start trading safely on Demo. As soon as a demo trade experiences <strong className="text-amber-300">1 single loss</strong>, the next trade is taken on your <strong className="text-emerald-400">Real Account</strong>. After a real win, it reverts back to Demo mode!
                  </span>
                )}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            {config.virtualLossFilterEnabled && (
              <div className="flex items-center gap-3 bg-slate-950/90 px-3 py-1.5 rounded-xl border border-purple-500/30">
                <div className="text-left">
                  <div className="text-[10px] uppercase font-bold text-slate-400">Demo Stake</div>
                  <div className="flex items-center gap-1">
                    <span className="text-xs font-bold text-purple-400">$</span>
                    <input
                      type="number"
                      min="0.35"
                      step="0.5"
                      disabled={status.isRunning}
                      value={config.virtualDemoStake || 1.00}
                      onChange={(e) => systemAutoEngine.setVirtualDemoStake(Number(e.target.value))}
                      className="w-16 bg-slate-900 border border-purple-500/50 rounded px-1.5 py-0.5 text-xs font-mono font-black text-purple-200 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="h-7 w-[1px] bg-slate-800" />

                <div className="text-left font-mono text-xs">
                  <div className="text-[10px] uppercase font-bold text-slate-400 font-sans">Demo Stats</div>
                  <div className="flex items-center gap-1 text-[11px]">
                    <span className="text-emerald-400 font-bold">{status.virtualWins}W</span>
                    <span className="text-slate-600">/</span>
                    <span className="text-rose-400 font-bold">{status.virtualLosses}L</span>
                    <span className="text-slate-500">({status.virtualNetProfit >= 0 ? '+' : ''}${status.virtualNetProfit.toFixed(2)})</span>
                  </div>
                </div>
              </div>
            )}

            <button
              id="btn-banner-toggle-virtual"
              onClick={() => systemAutoEngine.setVirtualLossFilter(!config.virtualLossFilterEnabled)}
              className={`px-4 py-2 rounded-xl text-xs font-extrabold transition-all border shadow-md ${
                config.virtualLossFilterEnabled
                  ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
                  : 'bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 hover:from-purple-500 hover:to-indigo-500 text-white border-purple-400 shadow-purple-500/25 ring-1 ring-purple-400'
              }`}
            >
              {config.virtualLossFilterEnabled ? 'Deactivate Virtual Mode' : 'Activate Virtual Mode'}
            </button>
          </div>
        </div>

        {/* Visual 4-Step Pipeline Bar when active */}
        {config.virtualLossFilterEnabled && (
          <div className="mt-4 pt-3.5 border-t border-purple-500/20 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
            <div className={`p-2.5 rounded-xl border transition-all ${
              status.virtualModeState === 'VIRTUAL'
                ? 'bg-purple-950/60 border-purple-400 text-purple-200 shadow-md ring-1 ring-purple-400/50'
                : 'bg-slate-950/60 border-slate-800 text-slate-400'
            }`}>
              <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-wider">
                <span>Step 1: Demo Scanner</span>
                {status.virtualModeState === 'VIRTUAL' ? (
                  <span className="w-2 h-2 rounded-full bg-purple-400 animate-ping" />
                ) : (
                  <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                )}
              </div>
              <p className="text-[11px] mt-1 text-slate-300">
                Bot trades in Demo with ${((config.virtualDemoStake || 1.00)).toFixed(2)} stake. Waiting for 1 single loss.
              </p>
            </div>

            <div className={`p-2.5 rounded-xl border transition-all ${
              status.virtualModeState === 'REAL_ARMED'
                ? 'bg-amber-950/60 border-amber-400 text-amber-200 shadow-md ring-2 ring-amber-400 animate-pulse'
                : status.virtualModeState === 'REAL_ACTIVE'
                ? 'bg-slate-950/60 border-slate-800 text-slate-400'
                : 'bg-slate-950/60 border-slate-800 text-slate-400'
            }`}>
              <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-wider">
                <span>Step 2: 1 Demo Loss</span>
                {status.virtualModeState === 'REAL_ARMED' ? (
                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                ) : null}
              </div>
              <p className="text-[11px] mt-1 text-slate-300">
                1st demo loss triggers immediate alert sound and arms next trade on Real Account.
              </p>
            </div>

            <div className={`p-2.5 rounded-xl border transition-all ${
              status.virtualModeState === 'REAL_ACTIVE'
                ? 'bg-rose-950/60 border-rose-400 text-rose-200 shadow-md ring-2 ring-rose-400 animate-pulse'
                : 'bg-slate-950/60 border-slate-800 text-slate-400'
            }`}>
              <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-wider">
                <span>Step 3: Real Account Trade</span>
                {status.virtualModeState === 'REAL_ACTIVE' ? (
                  <span className="w-2 h-2 rounded-full bg-rose-400 animate-ping" />
                ) : null}
              </div>
              <p className="text-[11px] mt-1 text-slate-300">
                Contract sent to Real Account with Real Stake (${status.currentStake.toFixed(2)}).
              </p>
            </div>

            <div className="p-2.5 rounded-xl border bg-slate-950/60 border-slate-800 text-slate-400">
              <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-wider">
                <span>Step 4: Cycle Loop</span>
                <RotateCcw className="w-3 h-3 text-cyan-400" />
              </div>
              <p className="text-[11px] mt-1 text-slate-300">
                After Win on Real Account, bot automatically reverts back to Demo mode and repeats!
              </p>
            </div>
          </div>
        )}
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

        {/* Target Volatility Market */}
        <div className="rounded-xl bg-slate-900/90 border border-slate-800 p-4">
          <div className="text-[11px] font-medium text-slate-400 uppercase tracking-wider mb-1 flex items-center justify-between">
            <span>Target Volatility Market</span>
            <Target className="w-3.5 h-3.5 text-amber-400" />
          </div>
          <div className="text-base sm:text-lg font-black text-cyan-300 truncate">
            {ASCENDING_VOLATILITY_MARKETS.find((m) => m.symbol === currentActiveMarketSymbol)?.name || 'Volatility 100 Index'} ({ASCENDING_VOLATILITY_MARKETS.find((m) => m.symbol === currentActiveMarketSymbol)?.shortName})
          </div>
          <div className="text-[10px] text-slate-400 mt-1 flex items-center gap-1">
            <span className="text-emerald-400 font-bold">● Active in Live Panel Below</span>
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

      {/* 🎯 Single Unified Live Markets & Scanner Feed Panel */}
      {(() => {
        const activeMarket = ASCENDING_VOLATILITY_MARKETS.find((m) => m.symbol === currentActiveMarketSymbol) || ASCENDING_VOLATILITY_MARKETS[0];
        const liveState = marketStates.get(currentActiveMarketSymbol);
        const activeLastDigit = liveState ? liveState.lastDigit : 0;
        const activeRecentDigits = liveState?.recentDigits || [];
        const isMatchActive = currentActiveTargetDigit !== null && activeLastDigit === currentActiveTargetDigit;

        return (
          <div className="rounded-2xl bg-gradient-to-br from-slate-900 via-slate-900/95 to-slate-950 border border-slate-800 p-5 shadow-2xl space-y-5">
            {/* Panel Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-3.5">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-gradient-to-tr from-cyan-500 to-blue-600 text-slate-950 shadow-md shadow-cyan-500/20">
                  <Activity className="w-5 h-5 fill-current" />
                </div>
                <div>
                  <h3 className="text-sm font-black uppercase tracking-wider text-white flex items-center gap-2">
                    Live Volatility Market & Scanner Feed
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 font-mono font-bold">
                      {activeMarket.name} ({activeMarket.shortName})
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400">
                    Select which volatility market you want to trade. The real-time scanner feed and match detector instantly tracks your chosen market.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-mono font-bold px-3 py-1 rounded-xl bg-slate-950 border border-cyan-500/40 text-cyan-300 shadow-inner flex items-center gap-1.5">
                  <span>Market:</span>
                  <strong className="text-white">{activeMarket.shortName}</strong>
                </span>
                <span className={`text-xs font-mono font-bold px-3 py-1 rounded-xl border shadow-inner flex items-center gap-1.5 ${
                  isMatchActive
                    ? "bg-emerald-500/20 text-emerald-300 border-emerald-400 animate-pulse"
                    : "bg-slate-950 text-amber-300 border-amber-500/30"
                }`}>
                  <span>Last Digit:</span>
                  <strong className="text-sm">[{activeLastDigit}]</strong>
                </span>
                <span className="text-xs font-mono font-bold px-3 py-1 rounded-xl bg-slate-950 border border-emerald-500/40 text-emerald-300 shadow-inner">
                  1-TICK SETTLE
                </span>
              </div>
            </div>

            {/* SECTION 1: CHOOSE VOLATILITY MARKET */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                  <span className="flex items-center justify-center w-5 h-5 rounded-full bg-cyan-500 text-slate-950 font-black text-[11px]">
                    1
                  </span>
                  <span>Choose Volatility Market</span>
                </label>
                <span className="text-[11px] font-mono text-slate-400">
                  Active Market: <strong className="text-cyan-300">{activeMarket.name} ({activeMarket.shortName})</strong>
                </span>
              </div>

              {/* Clean, intuitive grid of Volatility Markets */}
              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-10 gap-2">
                {ASCENDING_VOLATILITY_MARKETS.map((market) => {
                  const isSelected = market.symbol === currentActiveMarketSymbol;
                  const live = marketStates.get(market.symbol);
                  const lastDigit = live ? live.lastDigit : 0;
                  const price = live?.price ? live.price.toFixed(market.pipSize || 2) : "---";

                  return (
                    <button
                      key={market.symbol}
                      type="button"
                      disabled={status.isRunning}
                      onClick={() => handleSelectActiveMarket(market.symbol)}
                      className={`p-2.5 rounded-xl border text-left transition-all relative cursor-pointer ${
                        isSelected
                          ? "bg-gradient-to-br from-cyan-950/80 via-slate-900 to-slate-950 border-cyan-400 ring-2 ring-cyan-400/80 shadow-lg shadow-cyan-500/20 scale-[1.03] z-10"
                          : "bg-slate-950/80 hover:bg-slate-900 border-slate-800 hover:border-cyan-500/40 text-slate-300 disabled:opacity-50"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className={`text-xs font-black truncate ${isSelected ? "text-cyan-300" : "text-slate-200"}`}>
                          {market.shortName}
                        </span>
                        <span className={`text-[9px] font-mono font-black px-1.5 py-0.2 rounded ${
                          isSelected
                            ? "bg-cyan-500 text-slate-950"
                            : "bg-slate-800 text-slate-400"
                        }`}>
                          {isSelected ? "✓ ACTIVE" : `${market.volatility}%`}
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-400 truncate mb-1">{market.name}</div>
                      <div className="flex items-center justify-between text-[11px] font-mono pt-1 border-t border-slate-800/80">
                        <span className="text-slate-500 truncate max-w-[60%] text-[10px]">{price}</span>
                        <span className={`px-1.5 py-0.5 rounded font-black text-xs ${
                          isSelected
                            ? "bg-cyan-500/30 text-cyan-200 ring-1 ring-cyan-400"
                            : "bg-slate-800 text-slate-300"
                        }`}>
                          d: {lastDigit}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* SECTION 2: LIVE SCANNER FEED & MATCH DETECTOR */}
            <div className="space-y-3 pt-3 border-t border-slate-800/80">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                  <span className="flex items-center justify-center w-5 h-5 rounded-full bg-emerald-500 text-slate-950 font-black text-[11px]">
                    2
                  </span>
                  <span>Live Scanner Feed & Match Detector</span>
                </label>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-mono text-slate-400">
                    Scanning: <strong className="text-cyan-300">{activeMarket.shortName}</strong>
                  </span>
                  {currentActiveTargetDigit !== null && (
                    <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-950 border border-amber-500/40 text-amber-300">
                      Target Differ Digit: <strong>≠ {currentActiveTargetDigit}</strong>
                    </span>
                  )}
                </div>
              </div>

              {/* Live Digit Tape */}
              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex flex-col gap-2">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                    <span>Real-time Ticks for <strong>{activeMarket.name} ({activeMarket.shortName})</strong></span>
                  </span>
                  <span className="font-mono text-[11px] text-slate-500">Recent 16 Ticks (Incoming Stream)</span>
                </div>

                <div className="flex items-center gap-1.5 overflow-x-auto py-1">
                  {activeRecentDigits.slice(-16).map((d, idx, arr) => {
                    const isTargetMatch = currentActiveTargetDigit !== null && d === currentActiveTargetDigit;
                    const isLatest = idx === arr.length - 1;

                    return (
                      <div
                        key={idx}
                        className={`flex flex-col items-center justify-center min-w-[2.25rem] h-10 rounded-lg font-mono text-xs font-black transition-all ${
                          isTargetMatch
                            ? "bg-gradient-to-b from-amber-400 to-orange-500 text-slate-950 shadow-md shadow-orange-500/40 ring-2 ring-amber-300 scale-105"
                            : isLatest
                            ? "bg-slate-700 text-white ring-1 ring-slate-400"
                            : "bg-slate-900 text-slate-300 border border-slate-800"
                        }`}
                      >
                        <span className="text-sm">{d}</span>
                        {isTargetMatch && (
                          <span className="text-[8px] font-black uppercase text-slate-950 -mt-0.5">
                            MATCH
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Match Detector Status & Quick Test Trigger */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* Condition Status */}
                <div className={`p-3.5 rounded-xl border flex flex-col justify-center transition-all ${
                  isMatchActive
                    ? "bg-emerald-950/80 border-emerald-400 ring-1 ring-emerald-300"
                    : "bg-slate-900/90 border-slate-800"
                }`}>
                  {config.strategyMode === 'RANGE_LONG_DIFFERS' ? (
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] uppercase text-slate-400 font-bold tracking-wider">
                          Range Long 7-Digit Scanner
                        </span>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold">
                          {status.rangeLongWindowDigits?.length || 0}/7 Digits
                        </span>
                      </div>
                      <div className="text-xl font-black font-mono text-white mt-1 flex items-center gap-2">
                        <span>Most Appearing: Digit [{status.rangeLongMostAppearingDigit !== null && status.rangeLongMostAppearingDigit !== undefined ? status.rangeLongMostAppearingDigit : '?'}]</span>
                        <span className="text-xs font-sans text-amber-300 font-normal">
                          ({status.rangeLongMostAppearingCount || 0}x) ➔ Differ ≠ {status.rangeLongMostAppearingDigit !== null && status.rangeLongMostAppearingDigit !== undefined ? status.rangeLongMostAppearingDigit : '?'}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-1 leading-tight">
                        Range: [{(status.rangeLongWindowDigits || []).join(', ') || '---'}] • Exactly on 7th digit, buys Differ ≠ {status.rangeLongMostAppearingDigit ?? 'leader'} ➔ Settles on 8th digit!
                      </p>
                    </div>
                  ) : (
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] uppercase text-slate-400 font-bold tracking-wider">
                          Live Scanner Match Condition
                        </span>
                        {isMatchActive && (
                          <span className="text-[10px] font-sans font-bold px-2 py-0.5 rounded-full bg-emerald-500 text-slate-950 animate-pulse">
                            TRIGGER READY ⚡
                          </span>
                        )}
                      </div>
                      <div className="text-xl font-black font-mono text-white mt-1 flex items-center gap-2">
                        {currentActiveTargetDigit !== null ? (
                          <>
                            <span>Target Digit [{currentActiveTargetDigit}]</span>
                            <span className="text-xs font-sans text-amber-300 font-normal">➔ Differ ≠ {currentActiveTargetDigit}</span>
                          </>
                        ) : (
                          <span>Scanning Market Feed...</span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-400 mt-1 leading-tight">
                        {isMatchActive ? (
                          <strong className="text-emerald-400">Target digit [{currentActiveTargetDigit}] detected on {activeMarket.shortName}! Bot triggers Differ ≠ {currentActiveTargetDigit} contract.</strong>
                        ) : (
                          <span>Monitoring {activeMarket.shortName}... Waiting for target digit <strong className="text-amber-300 font-mono">[{currentActiveTargetDigit ?? "?"}]</strong> to appear (Current Last Digit: <strong className="text-white font-mono">[{activeLastDigit}]</strong>).</span>
                        )}
                      </p>
                    </div>
                  )}
                </div>

                {/* Settlement Preview & Quick Test */}
                <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 flex flex-col justify-between gap-2">
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] uppercase text-slate-400 font-bold tracking-wider">
                        Settlement Rule
                      </span>
                      <span className="text-[10px] font-mono text-cyan-300">1-Tick Fast Settle</span>
                    </div>
                    <div className="text-sm font-black text-emerald-400 mt-1 flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>Next Digit ≠ {currentActiveTargetDigit ?? activeLastDigit} ➔ WIN</span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-0.5 leading-tight">
                      The immediate next tick digit generated closes and settles the contract. Wins if exit digit ≠ {currentActiveTargetDigit ?? activeLastDigit}.
                    </p>
                  </div>

                  <div className="pt-2 border-t border-slate-800 flex items-center justify-between gap-2">
                    <span className="text-[11px] text-slate-400">
                      Immediate Test:
                    </span>
                    <button
                      type="button"
                      disabled={status.isRunning || status.isTradeActive}
                      onClick={handleTriggerActiveDifferTest}
                      className="px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 disabled:opacity-50 transition-colors flex items-center gap-1.5"
                    >
                      <Zap className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Test 1-Tick Differ</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })()}


      {/* ⚙️ Configuration & Live HUD Section */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Stake, Money Management & Sniper Settings (7 Cols) */}
        <div className="lg:col-span-7 space-y-6">
          {/* 🧩 Combiner Bot (Multi-Stage Ascending Engine) Strategy Card */}
          {config.strategyMode === 'COMBINER_BOT' && (
            <div className="rounded-2xl bg-gradient-to-br from-slate-900 via-amber-950/25 to-slate-950 border border-amber-500/40 p-5 shadow-2xl shadow-amber-500/10 space-y-6">
              {/* Strategy Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-amber-500/20 pb-4">
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-2xl bg-gradient-to-tr from-amber-500 via-emerald-500 to-cyan-500 text-slate-950 shadow-lg shadow-amber-500/30">
                    <Layers className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-base font-black uppercase tracking-wider text-white flex flex-wrap items-center gap-2">
                      Terminal Auto • Combiner Bot
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-gradient-to-r from-amber-500/20 to-cyan-500/20 text-amber-300 border border-amber-500/40 font-mono font-bold">
                        4-STAGE ASCENDING ROTATION • MULTI-MARKET HUNT • 1-TICK DURATION
                      </span>
                    </h3>
                    <p className="text-xs text-slate-300 mt-1 max-w-2xl leading-relaxed">
                      Combines 4 distinct strategies across ascending volatility markets in sequence. Each stage runs on its own designated market. Once Stage 4 completes, the bot increments the cycle counter and loops back to Stage 1.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-mono font-bold px-3 py-1.5 rounded-xl bg-amber-500/20 border border-amber-400 text-amber-300 shadow-inner flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                    <span>CYCLE #{status.combinerCycleCount || 1}</span>
                  </span>
                  <span className="text-xs font-mono font-bold px-3 py-1.5 rounded-xl bg-cyan-500/20 border border-cyan-400 text-cyan-300 shadow-inner">
                    ACTIVE: STAGE {status.combinerCurrentStage || 1}/4
                  </span>
                  <button
                    type="button"
                    disabled={status.isRunning}
                    onClick={() => systemAutoEngine.resetCombinerStats()}
                    className="p-1.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-400 hover:text-rose-400 hover:border-rose-500/40 transition-colors disabled:opacity-50"
                    title="Reset Combiner Statistics"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* 4-Stage Ascending Pipeline Visualizer Grid */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold uppercase tracking-wider text-amber-300 flex items-center gap-1.5">
                    <Activity className="w-4 h-4 text-amber-400" />
                    <span>4-Stage Execution Pipeline (Ascending Markets)</span>
                  </label>
                  <span className="text-[11px] font-mono text-slate-400">
                    Rule: <strong className="text-emerald-400">{config.combinerAdvanceOn === 'WIN_ONLY' ? 'Advance on Win Only' : 'Advance on Every Trade (Win or Loss)'}</strong>
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                  {/* STAGE 1 */}
                  {(() => {
                    const isCurrent = (status.combinerCurrentStage || 1) === 1;
                    const stageSym = config.combinerStage1Market || 'R_10';
                    const mInfo = ASCENDING_VOLATILITY_MARKETS.find((m) => m.symbol === stageSym) || ASCENDING_VOLATILITY_MARKETS[0];
                    const live = marketStates.get(stageSym);
                    const recent = live?.recentDigits || [];
                    const d3 = recent.length >= 3 ? recent[recent.length - 3] : null;
                    const d2 = recent.length >= 2 ? recent[recent.length - 2] : null;
                    const d1 = recent.length >= 1 ? recent[recent.length - 1] : null;
                    const isPattern = d3 !== null && d2 !== null && d1 !== null && d3 === d2 && d1 !== d2;
                    const wins = status.combinerStageWins?.[0] || 0;
                    const losses = status.combinerStageLosses?.[0] || 0;

                    return (
                      <div className={`p-3.5 rounded-xl border flex flex-col justify-between transition-all ${
                        isCurrent
                          ? 'bg-amber-500/10 border-amber-400 shadow-lg shadow-amber-500/15 ring-1 ring-amber-400/50'
                          : 'bg-slate-950/80 border-slate-800 opacity-90'
                      }`}>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                              isCurrent ? 'bg-amber-400 text-slate-950 font-black' : 'bg-slate-800 text-slate-400'
                            }`}>
                              Stage 1 {isCurrent ? '• Active' : ''}
                            </span>
                            <span className="text-[10px] font-mono font-bold text-slate-400">
                              W:{wins} / L:{losses}
                            </span>
                          </div>

                          <div>
                            <div className="text-xs font-bold text-white flex items-center gap-1">
                              <span>Pattern: [x, x, y]</span>
                            </div>
                            <div className="text-[11px] font-mono font-bold text-emerald-400">
                              Differ ≠ Digit y (1t)
                            </div>
                          </div>

                          {/* Market Selector for Stage 1 */}
                          <div className="space-y-1">
                            <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                              Assigned Market:
                            </label>
                            <select
                              disabled={status.isRunning}
                              value={stageSym}
                              onChange={(e) => {
                                const sym = e.target.value as MarketSymbol;
                                systemAutoEngine.setCombinerStageMarket(1, sym);
                                handleConfigChange({ combinerStage1Market: sym });
                              }}
                              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-xs font-mono font-bold text-amber-300 focus:outline-none focus:border-amber-400"
                            >
                              {ASCENDING_VOLATILITY_MARKETS.map((m) => (
                                <option key={m.symbol} value={m.symbol}>
                                  {m.shortName} (Vol {m.volatility})
                                </option>
                              ))}
                            </select>
                          </div>

                          {/* Live Recent Digits Preview */}
                          <div className="p-2 rounded-lg bg-slate-900/90 border border-slate-800">
                            <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1">
                              <span>Recent Digits:</span>
                              {isPattern && (
                                <span className="text-emerald-400 font-bold animate-pulse">
                                  MATCH! ≠ {d1}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-1 font-mono text-xs">
                              {recent.slice(-5).map((d, i, arr) => {
                                const isLastThree = i >= arr.length - 3;
                                return (
                                  <span
                                    key={i}
                                    className={`w-5 h-5 flex items-center justify-center rounded text-[11px] font-bold ${
                                      isPattern && isLastThree
                                        ? 'bg-amber-400 text-slate-950 font-black'
                                        : i === arr.length - 1
                                        ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                                        : 'bg-slate-800 text-slate-300'
                                    }`}
                                  >
                                    {d}
                                  </span>
                                );
                              })}
                            </div>
                          </div>
                        </div>

                        {!status.isRunning && (
                          <button
                            type="button"
                            onClick={() => systemAutoEngine.setCombinerStage(1)}
                            className="mt-2 text-[10px] font-bold uppercase tracking-wider py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                          >
                            Jump to Stage 1
                          </button>
                        )}
                      </div>
                    );
                  })()}

                  {/* STAGE 2 */}
                  {(() => {
                    const isCurrent = (status.combinerCurrentStage || 1) === 2;
                    const stageSym = config.combinerStage2Market || 'R_25';
                    const mInfo = ASCENDING_VOLATILITY_MARKETS.find((m) => m.symbol === stageSym) || ASCENDING_VOLATILITY_MARKETS[1];
                    const live = marketStates.get(stageSym);
                    const recent = live?.recentDigits || [];
                    const d4 = recent.length >= 4 ? recent[recent.length - 4] : null;
                    const d3 = recent.length >= 3 ? recent[recent.length - 3] : null;
                    const d2 = recent.length >= 2 ? recent[recent.length - 2] : null;
                    const d1 = recent.length >= 1 ? recent[recent.length - 1] : null;
                    const isPattern = d4 !== null && d3 !== null && d2 !== null && d1 !== null && d4 === d2 && d2 === d1 && d3 !== d4;
                    const wins = status.combinerStageWins?.[1] || 0;
                    const losses = status.combinerStageLosses?.[1] || 0;

                    return (
                      <div className={`p-3.5 rounded-xl border flex flex-col justify-between transition-all ${
                        isCurrent
                          ? 'bg-cyan-500/10 border-cyan-400 shadow-lg shadow-cyan-500/15 ring-1 ring-cyan-400/50'
                          : 'bg-slate-950/80 border-slate-800 opacity-90'
                      }`}>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                              isCurrent ? 'bg-cyan-400 text-slate-950 font-black' : 'bg-slate-800 text-slate-400'
                            }`}>
                              Stage 2 {isCurrent ? '• Active' : ''}
                            </span>
                            <span className="text-[10px] font-mono font-bold text-slate-400">
                              W:{wins} / L:{losses}
                            </span>
                          </div>

                          <div>
                            <div className="text-xs font-bold text-white flex items-center gap-1">
                              <span>Pattern: [x, y, x, x]</span>
                            </div>
                            <div className="text-[11px] font-mono font-bold text-emerald-400">
                              Differ ≠ Digit x (1t)
                            </div>
                          </div>

                          {/* Market Selector for Stage 2 */}
                          <div className="space-y-1">
                            <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                              Assigned Market:
                            </label>
                            <select
                              disabled={status.isRunning}
                              value={stageSym}
                              onChange={(e) => {
                                const sym = e.target.value as MarketSymbol;
                                systemAutoEngine.setCombinerStageMarket(2, sym);
                                handleConfigChange({ combinerStage2Market: sym });
                              }}
                              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-xs font-mono font-bold text-cyan-300 focus:outline-none focus:border-cyan-400"
                            >
                              {ASCENDING_VOLATILITY_MARKETS.map((m) => (
                                <option key={m.symbol} value={m.symbol}>
                                  {m.shortName} (Vol {m.volatility})
                                </option>
                              ))}
                            </select>
                          </div>

                          {/* Live Recent Digits Preview */}
                          <div className="p-2 rounded-lg bg-slate-900/90 border border-slate-800">
                            <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1">
                              <span>Recent Digits:</span>
                              {isPattern && (
                                <span className="text-emerald-400 font-bold animate-pulse">
                                  MATCH! ≠ {d1}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-1 font-mono text-xs">
                              {recent.slice(-5).map((d, i, arr) => {
                                const isLastFour = i >= arr.length - 4;
                                return (
                                  <span
                                    key={i}
                                    className={`w-5 h-5 flex items-center justify-center rounded text-[11px] font-bold ${
                                      isPattern && isLastFour
                                        ? 'bg-cyan-400 text-slate-950 font-black'
                                        : i === arr.length - 1
                                        ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                                        : 'bg-slate-800 text-slate-300'
                                    }`}
                                  >
                                    {d}
                                  </span>
                                );
                              })}
                            </div>
                          </div>
                        </div>

                        {!status.isRunning && (
                          <button
                            type="button"
                            onClick={() => systemAutoEngine.setCombinerStage(2)}
                            className="mt-2 text-[10px] font-bold uppercase tracking-wider py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                          >
                            Jump to Stage 2
                          </button>
                        )}
                      </div>
                    );
                  })()}

                  {/* STAGE 3 */}
                  {(() => {
                    const isCurrent = (status.combinerCurrentStage || 1) === 3;
                    const stageSym = config.combinerStage3Market || 'R_50';
                    const mInfo = ASCENDING_VOLATILITY_MARKETS.find((m) => m.symbol === stageSym) || ASCENDING_VOLATILITY_MARKETS[2];
                    const isLocked = status.combinerStage3State === 'LOCKED_WAITING_FOR_REAPPEARANCE';
                    const lockedDigit = status.combinerStage3LockedDigit;
                    const intervening = status.combinerStage3InterveningDigits || [];
                    const maxWait = config.combinerStage3MaxWaitTicks ?? 20;
                    const wins = status.combinerStageWins?.[2] || 0;
                    const losses = status.combinerStageLosses?.[2] || 0;

                    return (
                      <div className={`p-3.5 rounded-xl border flex flex-col justify-between transition-all ${
                        isCurrent
                          ? 'bg-purple-500/10 border-purple-400 shadow-lg shadow-purple-500/15 ring-1 ring-purple-400/50'
                          : 'bg-slate-950/80 border-slate-800 opacity-90'
                      }`}>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                              isCurrent ? 'bg-purple-400 text-slate-950 font-black' : 'bg-slate-800 text-slate-400'
                            }`}>
                              Stage 3 {isCurrent ? '• Active' : ''}
                            </span>
                            <span className="text-[10px] font-mono font-bold text-slate-400">
                              W:{wins} / L:{losses}
                            </span>
                          </div>

                          <div>
                            <div className="text-xs font-bold text-white flex items-center gap-1">
                              <span>Double [x, x] ➔ Reappear Differ</span>
                            </div>
                            <div className="text-[11px] font-mono font-bold text-emerald-400">
                              {isLocked ? `Locked [${lockedDigit}] ➔ Differ ≠ ${lockedDigit}` : 'Hunting Double [x,x]'}
                            </div>
                          </div>

                          {/* Market Selector for Stage 3 */}
                          <div className="space-y-1">
                            <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                              Assigned Market:
                            </label>
                            <select
                              disabled={status.isRunning}
                              value={stageSym}
                              onChange={(e) => {
                                const sym = e.target.value as MarketSymbol;
                                systemAutoEngine.setCombinerStageMarket(3, sym);
                                handleConfigChange({ combinerStage3Market: sym });
                              }}
                              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-xs font-mono font-bold text-purple-300 focus:outline-none focus:border-purple-400"
                            >
                              {ASCENDING_VOLATILITY_MARKETS.map((m) => (
                                <option key={m.symbol} value={m.symbol}>
                                  {m.shortName} (Vol {m.volatility})
                                </option>
                              ))}
                            </select>
                          </div>

                          {/* Live Lock State Display */}
                          <div className="p-2 rounded-lg bg-slate-900/90 border border-slate-800 space-y-1">
                            <div className="flex items-center justify-between text-[10px] text-slate-400">
                              <span>Lock State:</span>
                              <span className={`font-mono font-bold ${isLocked ? 'text-amber-300 animate-pulse' : 'text-slate-400'}`}>
                                {isLocked ? `LOCKED [${lockedDigit}]` : 'Scanning [d,d]'}
                              </span>
                            </div>
                            {isLocked ? (
                              <div className="text-[10px] font-mono text-slate-300 truncate">
                                Trail: [{intervening.join(', ') || 'none'}] ({intervening.length}/{maxWait}t)
                              </div>
                            ) : (
                              <div className="text-[10px] font-mono text-slate-400">
                                Waiting for twin digit to arm lock
                              </div>
                            )}
                          </div>
                        </div>

                        {!status.isRunning && (
                          <button
                            type="button"
                            onClick={() => systemAutoEngine.setCombinerStage(3)}
                            className="mt-2 text-[10px] font-bold uppercase tracking-wider py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                          >
                            Jump to Stage 3
                          </button>
                        )}
                      </div>
                    );
                  })()}

                  {/* STAGE 4 */}
                  {(() => {
                    const isCurrent = (status.combinerCurrentStage || 1) === 4;
                    const stageSym = config.combinerStage4Market || 'R_100';
                    const mInfo = ASCENDING_VOLATILITY_MARKETS.find((m) => m.symbol === stageSym) || ASCENDING_VOLATILITY_MARKETS[3];
                    const live = marketStates.get(stageSym);
                    const lastD = live ? live.lastDigit : 0;
                    const wins = status.combinerStageWins?.[3] || 0;
                    const losses = status.combinerStageLosses?.[3] || 0;

                    return (
                      <div className={`p-3.5 rounded-xl border flex flex-col justify-between transition-all ${
                        isCurrent
                          ? 'bg-emerald-500/10 border-emerald-400 shadow-lg shadow-emerald-500/15 ring-1 ring-emerald-400/50'
                          : 'bg-slate-950/80 border-slate-800 opacity-90'
                      }`}>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                              isCurrent ? 'bg-emerald-400 text-slate-950 font-black' : 'bg-slate-800 text-slate-400'
                            }`}>
                              Stage 4 {isCurrent ? '• Active' : ''}
                            </span>
                            <span className="text-[10px] font-mono font-bold text-slate-400">
                              W:{wins} / L:{losses}
                            </span>
                          </div>

                          <div>
                            <div className="text-xs font-bold text-white flex items-center gap-1">
                              <span>Differ Last Digit</span>
                            </div>
                            <div className="text-[11px] font-mono font-bold text-emerald-400">
                              Differ ≠ Last [{lastD}] (1t)
                            </div>
                          </div>

                          {/* Market Selector for Stage 4 */}
                          <div className="space-y-1">
                            <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                              Assigned Market:
                            </label>
                            <select
                              disabled={status.isRunning}
                              value={stageSym}
                              onChange={(e) => {
                                const sym = e.target.value as MarketSymbol;
                                systemAutoEngine.setCombinerStageMarket(4, sym);
                                handleConfigChange({ combinerStage4Market: sym });
                              }}
                              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-xs font-mono font-bold text-emerald-300 focus:outline-none focus:border-emerald-400"
                            >
                              {ASCENDING_VOLATILITY_MARKETS.map((m) => (
                                <option key={m.symbol} value={m.symbol}>
                                  {m.shortName} (Vol {m.volatility})
                                </option>
                              ))}
                            </select>
                          </div>

                          {/* Live Last Digit Display */}
                          <div className="p-2 rounded-lg bg-slate-900/90 border border-slate-800">
                            <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1">
                              <span>Live Peak Last Digit:</span>
                              <span className="text-emerald-400 font-bold">1t Differ</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-lg font-mono font-black text-amber-300">
                                [{lastD}]
                              </span>
                              <span className="text-xs font-mono font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                                Buy ≠ {lastD}
                              </span>
                            </div>
                          </div>
                        </div>

                        {!status.isRunning && (
                          <button
                            type="button"
                            onClick={() => systemAutoEngine.setCombinerStage(4)}
                            className="mt-2 text-[10px] font-bold uppercase tracking-wider py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                          >
                            Jump to Stage 4
                          </button>
                        )}
                      </div>
                    );
                  })()}
                </div>
              </div>

              {/* Combiner Advanced Controls Bar */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-2 border-t border-amber-500/20">
                {/* Market Order Presets */}
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                    <Repeat className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Volatility Presets (Ascending)</span>
                  </label>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={status.isRunning}
                      onClick={() => {
                        systemAutoEngine.setCombinerStageMarket(1, 'R_10');
                        systemAutoEngine.setCombinerStageMarket(2, 'R_25');
                        systemAutoEngine.setCombinerStageMarket(3, 'R_50');
                        systemAutoEngine.setCombinerStageMarket(4, 'R_100');
                        handleConfigChange({
                          combinerStage1Market: 'R_10',
                          combinerStage2Market: 'R_25',
                          combinerStage3Market: 'R_50',
                          combinerStage4Market: 'R_100',
                        });
                      }}
                      className="px-2.5 py-1.5 rounded-lg text-xs font-bold bg-slate-950 border border-slate-800 hover:border-amber-400/50 text-slate-300 hover:text-white transition-colors disabled:opacity-50"
                    >
                      Vol 10 ➔ 25 ➔ 50 ➔ 100
                    </button>

                    <button
                      type="button"
                      disabled={status.isRunning}
                      onClick={() => {
                        systemAutoEngine.setCombinerStageMarket(1, '1HZ10V');
                        systemAutoEngine.setCombinerStageMarket(2, '1HZ25V');
                        systemAutoEngine.setCombinerStageMarket(3, '1HZ50V');
                        systemAutoEngine.setCombinerStageMarket(4, '1HZ100V');
                        handleConfigChange({
                          combinerStage1Market: '1HZ10V',
                          combinerStage2Market: '1HZ25V',
                          combinerStage3Market: '1HZ50V',
                          combinerStage4Market: '1HZ100V',
                        });
                      }}
                      className="px-2.5 py-1.5 rounded-lg text-xs font-bold bg-slate-950 border border-slate-800 hover:border-cyan-400/50 text-slate-300 hover:text-white transition-colors disabled:opacity-50"
                    >
                      1-Sec: 10 ➔ 25 ➔ 50 ➔ 100(1s)
                    </button>

                    <button
                      type="button"
                      disabled={status.isRunning}
                      onClick={() => systemAutoEngine.sortCombinerMarketsAscending()}
                      className="px-2.5 py-1.5 rounded-lg text-xs font-bold bg-slate-950 border border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/10 transition-colors disabled:opacity-50 flex items-center gap-1"
                    >
                      <ArrowRight className="w-3 h-3 text-emerald-400" />
                      <span>Auto-Sort Ascending</span>
                    </button>
                  </div>
                </div>

                {/* Stage 3 Max Wait Ticks Setting */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-purple-400" />
                      <span>Stage 3 Max Reappearance Wait</span>
                    </label>
                    <span className="text-xs font-mono font-bold text-purple-300">
                      {config.combinerStage3MaxWaitTicks ?? 20} ticks
                    </span>
                  </div>
                  <div className="grid grid-cols-6 gap-1.5">
                    {[5, 10, 15, 20, 25, 30].map((ticks) => (
                      <button
                        key={ticks}
                        type="button"
                        disabled={status.isRunning}
                        onClick={() => handleConfigChange({ combinerStage3MaxWaitTicks: ticks })}
                        className={`py-1 text-xs font-mono font-bold rounded-lg border transition-all ${
                          (config.combinerStage3MaxWaitTicks ?? 20) === ticks
                            ? 'bg-purple-500 text-white border-purple-400 shadow-md shadow-purple-500/30'
                            : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white disabled:opacity-50'
                        }`}
                      >
                        {ticks}t
                      </button>
                    ))}
                  </div>
                </div>

                {/* Progression Advance Logic */}
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Stage Advance Rule</span>
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      disabled={status.isRunning}
                      onClick={() => handleConfigChange({ combinerAdvanceOn: 'ALWAYS' })}
                      className={`p-2 rounded-xl text-left border transition-all ${
                        (config.combinerAdvanceOn || 'ALWAYS') === 'ALWAYS'
                          ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300 font-bold'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white disabled:opacity-50'
                      }`}
                    >
                      <div className="text-xs font-bold">Advance Every Trade</div>
                      <div className="text-[10px] text-slate-400 leading-tight">Cycles on Win or Loss</div>
                    </button>

                    <button
                      type="button"
                      disabled={status.isRunning}
                      onClick={() => handleConfigChange({ combinerAdvanceOn: 'WIN_ONLY' })}
                      className={`p-2 rounded-xl text-left border transition-all ${
                        config.combinerAdvanceOn === 'WIN_ONLY'
                          ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300 font-bold'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white disabled:opacity-50'
                      }`}
                    >
                      <div className="text-xs font-bold">Advance on WIN Only</div>
                      <div className="text-[10px] text-slate-400 leading-tight">Retries on Loss</div>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 🎯 Auto...[Double 1 Select] Strategy Card */}
          {config.strategyMode === 'DOUBLE_1_SELECT' && (
            <div className="rounded-2xl bg-gradient-to-br from-slate-900 via-amber-950/25 to-slate-950 border border-amber-500/40 p-5 shadow-2xl shadow-amber-500/10 space-y-5">
              {/* Strategy Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-amber-500/20 pb-3">
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-2xl bg-gradient-to-tr from-amber-500 via-orange-500 to-yellow-500 text-slate-950 shadow-lg shadow-amber-500/30">
                    <Lock className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-base font-black uppercase tracking-wider text-white flex items-center gap-2">
                      Terminal Auto • [Double 1 Select] Bot
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 font-mono">
                        IDENTICAL DIGITS LOCK ➔ REAPPEARANCE SNIPER • 1-TICK SETTLE
                      </span>
                    </h3>
                    <p className="text-xs text-slate-300">
                      Scans only your selected market. Once two identical digits (or three identical digits) appear (e.g. <strong className="text-amber-400 font-mono">[4, 4]</strong> or <strong className="text-amber-400 font-mono">[6, 6]</strong>), it locks that digit. Then it waits for that same locked digit to appear again within the next <strong className="text-amber-400">{config.double1SelectMaxDigitsRange ?? 6} digits</strong>. The moment it reappears, it immediately buys <strong className="text-emerald-400 font-mono">Differ ≠ locked digit</strong> (1-tick duration), and the next digit settles the trade! (e.g. <span className="font-mono text-amber-300">4, 4, 638248</span> ➔ buy Differ 4 on 4, digit 8 settles; <span className="font-mono text-amber-300">6, 6, 12365</span> ➔ buy Differ 6 on 6, digit 5 settles). If the locked digit does not appear within the range, the bot resets and looks for another pattern.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-xs font-mono font-bold px-3 py-1 rounded-xl border shadow-inner ${
                    status.double1SelectState === 'WAITING_FOR_REAPPEARANCE'
                      ? 'bg-amber-500/20 border-amber-400 text-amber-300 animate-pulse'
                      : 'bg-slate-950 border-emerald-500/40 text-emerald-300'
                  }`}>
                    {status.double1SelectState === 'WAITING_FOR_REAPPEARANCE'
                      ? `LOCKED: [${status.double1SelectLockedDigit}]`
                      : 'HUNTING [d, d]'}
                  </span>
                  <span className="text-xs font-mono font-bold px-3 py-1 rounded-xl bg-slate-950 border border-amber-500/40 text-amber-300 shadow-inner">
                    RANGE: ≤{config.double1SelectMaxDigitsRange ?? 6} TICKS
                  </span>
                  <span className="text-xs font-mono font-bold px-3 py-1 rounded-xl bg-slate-950 border border-cyan-500/40 text-cyan-300 shadow-inner">
                    DURATION: 1 TICK
                  </span>
                </div>
              </div>

              {/* MAX DIGITS RANGE AFTER TWIN PATTERN */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold uppercase tracking-wider text-amber-300 flex items-center gap-1.5">
                    <Sliders className="w-4 h-4 text-amber-400" />
                    <span>Max Digits Range Limit (After Twin Pattern)</span>
                  </label>
                  <span className="text-[11px] font-mono text-slate-400">
                    Active Range Limit: <strong className="text-amber-400 font-bold">{config.double1SelectMaxDigitsRange ?? 6} Digits</strong>
                  </span>
                </div>

                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                  {[3, 4, 5, 6, 7, 8].map((rangeVal) => {
                    const isCurrent = (config.double1SelectMaxDigitsRange ?? 6) === rangeVal;
                    return (
                      <button
                        key={rangeVal}
                        type="button"
                        disabled={status.isRunning}
                        onClick={() => {
                          systemAutoEngine.selectDouble1SelectRange(rangeVal);
                          handleConfigChange({ double1SelectMaxDigitsRange: rangeVal });
                        }}
                        className={`flex flex-col items-center justify-center p-2.5 rounded-xl border font-mono transition-all ${
                          isCurrent
                            ? 'bg-gradient-to-br from-amber-500 to-orange-500 text-slate-950 font-black border-amber-300 ring-2 ring-amber-400 shadow-md shadow-amber-500/30 scale-[1.03]'
                            : 'bg-slate-950/80 hover:bg-slate-900 border-slate-800 text-slate-300 hover:border-amber-500/40 disabled:opacity-50'
                        }`}
                      >
                        <span className="text-sm font-black">{rangeVal} Digits</span>
                        <span className="text-[9px] uppercase tracking-wider opacity-80">
                          {rangeVal === 6 ? 'Standard' : `Max ${rangeVal}t`}
                        </span>
                      </button>
                    );
                  })}
                </div>
                <p className="text-[11px] text-slate-400">
                  💡 If the locked digit appears within the next <strong>{config.double1SelectMaxDigitsRange ?? 6} digits</strong>, the bot buys Differ ≠ locked digit on that exact tick (1-tick duration). If <strong>{config.double1SelectMaxDigitsRange ?? 6} digits</strong> elapse without the locked digit appearing, the pattern expires and the bot looks for a fresh twin pattern.
                </p>
              </div>

              {/* PART 3: REAL-TIME TRACKER & LIVE STATUS HUD */}
              <div className="p-4 rounded-xl bg-slate-950 border border-amber-500/30 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-2.5">
                  <div className="flex items-center gap-2">
                    <span className={`w-2.5 h-2.5 rounded-full ${
                      status.double1SelectState === 'WAITING_FOR_REAPPEARANCE'
                        ? 'bg-amber-400 animate-ping'
                        : 'bg-emerald-400 animate-pulse'
                    }`} />
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-200">
                      Live State:
                    </span>
                    <span className={`text-xs font-mono font-black px-2 py-0.5 rounded ${
                      status.double1SelectState === 'WAITING_FOR_REAPPEARANCE'
                        ? 'bg-amber-400 text-slate-950'
                        : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                    }`}>
                      {status.double1SelectState === 'WAITING_FOR_REAPPEARANCE'
                        ? `WAITING FOR LOCKED DIGIT [${status.double1SelectLockedDigit}]`
                        : 'HUNTING IDENTICAL DIGITS [d, d] or [d, d, d]'}
                    </span>
                  </div>

                  <span className="text-xs font-mono text-slate-400">
                    Market:{' '}
                    <strong className="text-cyan-300">
                      {ASCENDING_VOLATILITY_MARKETS.find((m) => m.symbol === (config.double1SelectMarketSymbol || 'R_100'))?.shortName || 'Vol 100'}
                    </strong>
                  </span>
                </div>

                {status.double1SelectState === 'WAITING_FOR_REAPPEARANCE' ? (
                  <div className="space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-lg bg-amber-950/40 border border-amber-500/40">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-xl bg-amber-400 text-slate-950 flex flex-col items-center justify-center font-black shadow-md shadow-amber-500/30 ring-2 ring-amber-300">
                          <span className="text-[9px] uppercase leading-none font-bold">Locked</span>
                          <span className="text-2xl font-black leading-none">{status.double1SelectLockedDigit}</span>
                        </div>
                        <div>
                          <h4 className="text-xs font-black text-white flex items-center gap-2">
                            Twin Pattern Locked on Digit [{status.double1SelectLockedDigit}]!
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-400/20 text-amber-300 border border-amber-400/40 font-mono">
                              Armed
                            </span>
                          </h4>
                          <p className="text-[11px] text-amber-200/90 mt-0.5">
                            Waiting for digit <strong className="text-white font-mono">[{status.double1SelectLockedDigit}]</strong> to reappear! The instant it appears ➔ <strong className="text-emerald-300 font-bold">BUY DIFFER ≠ {status.double1SelectLockedDigit} (1-Tick settle)</strong>.
                          </p>
                        </div>
                      </div>

                      <div className="text-right font-mono shrink-0">
                        <div className="text-xs font-bold text-amber-300">
                          {status.double1SelectInterveningDigits.length} / {config.double1SelectMaxDigitsRange ?? 6} Digits Elapsed
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {Math.max(0, (config.double1SelectMaxDigitsRange ?? 6) - status.double1SelectInterveningDigits.length)} ticks remaining before reset
                        </div>
                      </div>
                    </div>

                    {/* Digits Trail Visualizer */}
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                        Digits After Pattern:
                      </span>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {status.double1SelectInterveningDigits.length === 0 ? (
                          <span className="text-xs font-mono text-slate-500 italic">
                            (Waiting for 1st tick after pattern...)
                          </span>
                        ) : (
                          status.double1SelectInterveningDigits.map((d, dIdx) => (
                            <span
                              key={dIdx}
                              className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-slate-900 border border-slate-700 font-mono text-xs font-black text-slate-200"
                            >
                              {d}
                            </span>
                          ))
                        )}
                        <span className="inline-flex items-center justify-center px-2 h-7 rounded-lg bg-amber-500/20 border border-amber-400/60 font-mono text-xs font-black text-amber-300 animate-pulse">
                          Wait [{status.double1SelectLockedDigit}] ➔ Differ ≠ {status.double1SelectLockedDigit}
                        </span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <p className="text-xs text-slate-300">
                      Monitoring incoming ticks on <strong className="text-amber-300">{ASCENDING_VOLATILITY_MARKETS.find((m) => m.symbol === (config.double1SelectMarketSymbol || 'R_100'))?.name || 'Volatility 100 Index'}</strong>. When identical digits <strong className="text-amber-400 font-mono">[d, d]</strong> or <strong className="text-amber-400 font-mono">[d, d, d]</strong> form, the bot locks that digit automatically!
                    </p>
                    {/* Live Stream of Last Digits on Target Market */}
                    {(() => {
                      const live = marketStates.get(config.double1SelectMarketSymbol || 'R_100');
                      const recent = live?.recentDigits || [];
                      return (
                        <div className="flex items-center gap-1.5 overflow-x-auto py-1">
                          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mr-1">
                            Recent Digits:
                          </span>
                          {recent.slice(-10).map((d, idx, arr) => {
                            const isLast = idx === arr.length - 1;
                            const isTwinWithPrev = idx > 0 && d === arr[idx - 1];
                            const isTwinWithNext = idx < arr.length - 1 && d === arr[idx + 1];
                            const isTwinPart = isTwinWithPrev || isTwinWithNext;

                            return (
                              <span
                                key={idx}
                                className={`inline-flex items-center justify-center w-7 h-7 rounded-lg font-mono text-xs font-black transition-all ${
                                  isTwinPart
                                    ? 'bg-amber-400 text-slate-950 shadow-md shadow-amber-500/40 ring-2 ring-amber-300 scale-105'
                                    : isLast
                                    ? 'bg-slate-700 text-white'
                                    : 'bg-slate-900 text-slate-400 border border-slate-800'
                                }`}
                              >
                                {d}
                              </span>
                            );
                          })}
                        </div>
                      );
                    })()}
                  </div>
                )}

                {/* One-Click Immediate Test Differ Trigger */}
                {(() => {
                  const targetSym = config.double1SelectMarketSymbol || 'R_100';
                  const targetMarket = ASCENDING_VOLATILITY_MARKETS.find((m) => m.symbol === targetSym) || ASCENDING_VOLATILITY_MARKETS[0];
                  const live = marketStates.get(targetSym);
                  const lastDigit = live ? live.lastDigit : 0;
                  const targetDigit = status.double1SelectLockedDigit !== null ? status.double1SelectLockedDigit : lastDigit;

                  return (
                    <div className="pt-2 border-t border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <span className="text-[11px] text-slate-400">
                        ⚡ Quick Differ Trigger on {targetMarket.shortName}:{' '}
                        <strong className="text-amber-300">Differ ≠ {targetDigit}</strong> (1-Tick Settle)
                      </span>
                      <button
                        type="button"
                        disabled={status.isRunning}
                        onClick={() => {
                          systemAutoEngine.executeDouble1SelectTrade(targetMarket, targetDigit);
                        }}
                        className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 via-orange-500 to-yellow-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black text-xs shadow-md shadow-amber-500/20 disabled:opacity-50 transition-all flex items-center justify-center gap-1.5"
                      >
                        <Lock className="w-3.5 h-3.5 fill-current" />
                        <span>TEST BUY DIFFER ≠ {targetDigit} (1t)</span>
                      </button>
                    </div>
                  );
                })()}
              </div>
            </div>
          )}

          {/* ⚡ Auto Double End Bot Strategy Card */}
          {config.strategyMode === 'DOUBLE_END_BOT' && (
            <div className="rounded-2xl bg-gradient-to-br from-slate-900 via-amber-950/20 to-slate-950 border border-amber-500/40 p-5 shadow-2xl shadow-amber-500/10 space-y-5">
              {/* Strategy Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-amber-500/20 pb-3">
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-2xl bg-gradient-to-tr from-amber-500 via-orange-500 to-yellow-500 text-slate-950 shadow-lg shadow-amber-500/30 font-black">
                    <Zap className="w-6 h-6 fill-current" />
                  </div>
                  <div>
                    <h3 className="text-base font-black uppercase tracking-wider text-white flex items-center gap-2">
                      Terminal Auto • Double End Bot
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 font-mono">
                        PAIR / THRICE DIGITS ➔ BUY NEXT DIFFERENT DIGIT AS DIFFER • 1-TICK SETTLE
                      </span>
                    </h3>
                    <p className="text-xs text-slate-300">
                      Scans your selected given market. After a <strong className="text-amber-400 font-mono">pair</strong> (e.g. <span className="font-mono text-amber-300">5, 5</span>) or <strong className="text-amber-400 font-mono">thrice</strong> (e.g. <span className="font-mono text-amber-300">5, 5, 5</span>) digits appear, the very next different digit <strong className="text-emerald-400 font-mono">Y</strong> is bought as a Differ (<strong className="text-emerald-400 font-mono">Differ ≠ Y</strong>). Examples: <span className="font-mono text-amber-300">5, 5, 7</span> ➔ buy Digit 7 Differ; <span className="font-mono text-amber-300">9, 9, 4</span> ➔ buy Digit 4 Differ; <span className="font-mono text-amber-300">5, 5, 5, 7</span> ➔ buy Digit 7 Differ. The very next digit settles the trade (1-tick duration)!
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  {status.doubleEndDifferTarget !== null ? (
                    <span className="text-xs font-mono font-bold px-3 py-1 rounded-xl bg-amber-500/20 border border-amber-400 text-amber-300 shadow-inner animate-pulse">
                      TARGET: ≠ {status.doubleEndDifferTarget} ({status.doubleEndDetectedPattern})
                    </span>
                  ) : (
                    <span className="text-xs font-mono font-bold px-3 py-1 rounded-xl bg-slate-950 border border-amber-500/40 text-amber-300 shadow-inner">
                      HUNTING PAIR / THRICE
                    </span>
                  )}
                  <span className="text-xs font-mono font-bold px-3 py-1 rounded-xl bg-slate-950 border border-cyan-500/40 text-cyan-300 shadow-inner">
                    DURATION: 1 TICK
                  </span>
                  <span className="text-xs font-mono font-bold px-3 py-1 rounded-xl bg-slate-950 border border-emerald-500/40 text-emerald-300 shadow-inner">
                    {ASCENDING_VOLATILITY_MARKETS.find((m) => m.symbol === (config.doubleEndMarketSymbol || 'R_100'))?.shortName || 'Vol 100'}
                  </span>
                </div>
              </div>

              {/* 🎯 GIVEN MARKET SELECTION PANEL */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold uppercase tracking-wider text-amber-300 flex items-center gap-1.5">
                    <Target className="w-4 h-4 text-amber-400" />
                    <span>Given Market To Scan: Select Continuous Volatility Index</span>
                  </label>
                  <span className="text-[11px] font-mono text-slate-400">
                    Active Market:{' '}
                    <strong className="text-amber-400 font-bold">
                      {ASCENDING_VOLATILITY_MARKETS.find((m) => m.symbol === (config.doubleEndMarketSymbol || 'R_100'))?.name || 'Volatility 100 Index'}
                    </strong>
                  </span>
                </div>

                {/* Preset quick pills */}
                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-9 gap-2">
                  {ASCENDING_VOLATILITY_MARKETS.map((m) => {
                    const isSelected = (config.doubleEndMarketSymbol || 'R_100') === m.symbol;
                    const live = marketStates.get(m.symbol);
                    const currentDigit = live ? live.lastDigit : '-';
                    const hasPattern = live?.hasDoubleEndPattern;

                    return (
                      <button
                        key={m.symbol}
                        type="button"
                        disabled={status.isRunning}
                        onClick={() => {
                          systemAutoEngine.selectDoubleEndMarket(m.symbol);
                          handleConfigChange({ doubleEndMarketSymbol: m.symbol });
                        }}
                        className={`flex flex-col items-center justify-center p-2.5 rounded-xl border transition-all ${
                          isSelected
                            ? 'bg-gradient-to-br from-amber-500 via-orange-500 to-yellow-500 text-slate-950 font-black border-amber-300 ring-2 ring-amber-400 shadow-lg shadow-amber-500/30 scale-[1.03]'
                            : hasPattern
                            ? 'bg-amber-950/40 border-amber-500/60 text-amber-300 hover:bg-amber-900/40'
                            : 'bg-slate-950/80 hover:bg-slate-900 border-slate-800 text-slate-300 hover:border-amber-500/40 disabled:opacity-50'
                        }`}
                      >
                        <span className="text-xs font-bold font-mono">{m.shortName}</span>
                        <div className="flex items-center gap-1 mt-0.5">
                          <span className={`text-[10px] font-mono font-bold ${isSelected ? 'text-slate-900' : 'text-slate-400'}`}>
                            Digit:
                          </span>
                          <span
                            className={`text-xs font-mono font-black px-1.5 py-0.2 rounded ${
                              isSelected
                                ? 'bg-slate-950 text-amber-300'
                                : 'bg-slate-800 text-cyan-300'
                            }`}
                          >
                            {currentDigit}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 🎯 PATTERN MODE SELECTION */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold uppercase tracking-wider text-amber-300 flex items-center gap-1.5">
                    <Sliders className="w-4 h-4 text-amber-400" />
                    <span>Pattern Scan Mode</span>
                  </label>
                  <span className="text-[11px] font-mono text-slate-400">
                    Active Mode:{' '}
                    <strong className="text-amber-400 font-bold">
                      {config.doubleEndPatternMode === 'PAIR_ONLY'
                        ? 'Pair Only [x, x, y]'
                        : config.doubleEndPatternMode === 'THRICE_ONLY'
                        ? 'Thrice Only [x, x, x, y]'
                        : 'Pair or Thrice [x, x, y] / [x, x, x, y]'}
                    </strong>
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <button
                    type="button"
                    disabled={status.isRunning}
                    onClick={() => {
                      systemAutoEngine.selectDoubleEndPatternMode('PAIR_OR_THRICE');
                      handleConfigChange({ doubleEndPatternMode: 'PAIR_OR_THRICE' });
                    }}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      (config.doubleEndPatternMode || 'PAIR_OR_THRICE') === 'PAIR_OR_THRICE'
                        ? 'bg-amber-500/20 border-amber-400 text-amber-200 ring-1 ring-amber-400/60 shadow-md'
                        : 'bg-slate-950/80 border-slate-800 text-slate-400 hover:text-white disabled:opacity-50'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-white">Pair or Thrice (Recommended)</span>
                      <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-amber-500/30 text-amber-300 font-bold">
                        2x or 3x
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-300 leading-tight">
                      Triggers on both <span className="text-amber-300 font-mono">[x, x, y]</span> and <span className="text-amber-300 font-mono">[x, x, x, y]</span> ➔ Buys Differ ≠ y
                    </p>
                  </button>

                  <button
                    type="button"
                    disabled={status.isRunning}
                    onClick={() => {
                      systemAutoEngine.selectDoubleEndPatternMode('PAIR_ONLY');
                      handleConfigChange({ doubleEndPatternMode: 'PAIR_ONLY' });
                    }}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      config.doubleEndPatternMode === 'PAIR_ONLY'
                        ? 'bg-amber-500/20 border-amber-400 text-amber-200 ring-1 ring-amber-400/60 shadow-md'
                        : 'bg-slate-950/80 border-slate-800 text-slate-400 hover:text-white disabled:opacity-50'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-white">Pair Only</span>
                      <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-cyan-500/30 text-cyan-300 font-bold">
                        [x, x, y]
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-300 leading-tight">
                      Strictly scans for exactly 2 identical digits followed by a differing digit (e.g. <span className="text-cyan-300 font-mono">5, 5, 7</span> ➔ Differ ≠ 7)
                    </p>
                  </button>

                  <button
                    type="button"
                    disabled={status.isRunning}
                    onClick={() => {
                      systemAutoEngine.selectDoubleEndPatternMode('THRICE_ONLY');
                      handleConfigChange({ doubleEndPatternMode: 'THRICE_ONLY' });
                    }}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      config.doubleEndPatternMode === 'THRICE_ONLY'
                        ? 'bg-amber-500/20 border-amber-400 text-amber-200 ring-1 ring-amber-400/60 shadow-md'
                        : 'bg-slate-950/80 border-slate-800 text-slate-400 hover:text-white disabled:opacity-50'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-white">Thrice Only</span>
                      <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-purple-500/30 text-purple-300 font-bold">
                        [x, x, x, y]
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-300 leading-tight">
                      Strictly scans for 3 identical digits followed by a differing digit (e.g. <span className="text-purple-300 font-mono">5, 5, 5, 7</span> ➔ Differ ≠ 7)
                    </p>
                  </button>
                </div>
              </div>

              {/* 📊 REAL-TIME PATTERN MONITOR & LIVE DIGIT STREAM */}
              <div className="p-4 rounded-xl bg-slate-950/90 border border-amber-500/30 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Activity className="w-4 h-4 text-amber-400 animate-pulse" />
                    <span className="text-xs font-bold text-white uppercase tracking-wider">
                      Live Digit Stream & Pattern Detector on {ASCENDING_VOLATILITY_MARKETS.find((m) => m.symbol === (config.doubleEndMarketSymbol || 'R_100'))?.shortName || 'Vol 100'}
                    </span>
                  </div>

                  {(() => {
                    const targetSym = config.doubleEndMarketSymbol || 'R_100';
                    const live = marketStates.get(targetSym);
                    const hasMatch = live?.hasDoubleEndPattern;
                    const pType = live?.doubleEndType;
                    const diffTarget = live?.doubleEndDifferTarget;

                    return hasMatch && diffTarget !== null ? (
                      <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5 animate-pulse">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        <span>MATCH DETECTED: {pType} ➔ Buy Differ ≠ {diffTarget}!</span>
                      </span>
                    ) : (
                      <span className="text-xs text-slate-400 font-mono">
                        Scanning incoming ticks for pair/thrice sequence...
                      </span>
                    );
                  })()}
                </div>

                {/* Animated Digit Pills */}
                {(() => {
                  const targetSym = config.doubleEndMarketSymbol || 'R_100';
                  const live = marketStates.get(targetSym);
                  const recent = live?.recentDigits || [];
                  const len = recent.length;

                  // Determine pattern match on recent stream
                  const isThrice = len >= 4 && recent[len - 4] === recent[len - 3] && recent[len - 3] === recent[len - 2] && recent[len - 1] !== recent[len - 2];
                  const isPair = !isThrice && len >= 3 && recent[len - 3] === recent[len - 2] && recent[len - 1] !== recent[len - 2];

                  return (
                    <div className="space-y-2">
                      <div className="flex items-center gap-1.5 overflow-x-auto py-2">
                        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mr-1">
                          Recent Digits:
                        </span>
                        {recent.slice(-14).map((d, idx, arr) => {
                          const isLast = idx === arr.length - 1;
                          const isSecondLast = idx === arr.length - 2;
                          const isThirdLast = idx === arr.length - 3;
                          const isFourthLast = idx === arr.length - 4;

                          const isThriceBase = isThrice && (isSecondLast || isThirdLast || isFourthLast);
                          const isPairBase = isPair && (isSecondLast || isThirdLast);
                          const isDifferTrigger = (isThrice || isPair) && isLast;

                          return (
                            <div key={idx} className="flex flex-col items-center">
                              <span
                                className={`inline-flex items-center justify-center w-8 h-8 rounded-lg font-mono text-sm font-black transition-all ${
                                  isDifferTrigger
                                    ? 'bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/50 ring-2 ring-emerald-300 scale-110 animate-bounce'
                                    : isThriceBase
                                    ? 'bg-purple-500 text-white shadow-md shadow-purple-500/40 ring-2 ring-purple-300 scale-105'
                                    : isPairBase
                                    ? 'bg-amber-400 text-slate-950 shadow-md shadow-amber-500/40 ring-2 ring-amber-300 scale-105'
                                    : isLast
                                    ? 'bg-slate-700 text-white ring-1 ring-slate-500'
                                    : 'bg-slate-900 text-slate-300 border border-slate-800'
                                }`}
                              >
                                {d}
                              </span>
                              {isDifferTrigger && (
                                <span className="text-[9px] font-black text-emerald-400 mt-1 uppercase">
                                  ≠{d}
                                </span>
                              )}
                              {isPairBase && idx === arr.length - 2 && (
                                <span className="text-[9px] font-black text-amber-400 mt-1 uppercase">
                                  Pair
                                </span>
                              )}
                              {isThriceBase && idx === arr.length - 2 && (
                                <span className="text-[9px] font-black text-purple-400 mt-1 uppercase">
                                  Thrice
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      {/* Rule Explanation Banner inside stream */}
                      <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-300 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="text-amber-400 font-bold">Rule:</span>
                          <span>
                            Identical digits <span className="font-mono text-amber-300 font-bold">[X, X]</span> or <span className="font-mono text-amber-300 font-bold">[X, X, X]</span> ➔ Next different digit <span className="font-mono text-emerald-400 font-bold">[Y]</span> is bought as Differ (<span className="font-mono text-emerald-400 font-bold">Differ ≠ Y</span>, 1t duration)
                          </span>
                        </div>
                        <div className="flex items-center gap-1 font-mono text-[11px] text-slate-400">
                          <span>Next tick settles:</span>
                          <span className="text-emerald-400 font-bold">≠ Y = WIN</span>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* Quick Immediate Test Trigger */}
                {(() => {
                  const targetSym = config.doubleEndMarketSymbol || 'R_100';
                  const targetMarket = ASCENDING_VOLATILITY_MARKETS.find((m) => m.symbol === targetSym) || ASCENDING_VOLATILITY_MARKETS[0];
                  const live = marketStates.get(targetSym);
                  const lastDigit = live ? live.lastDigit : 0;
                  const targetDifferDigit = live?.doubleEndDifferTarget !== null && live?.doubleEndDifferTarget !== undefined ? live.doubleEndDifferTarget : lastDigit;

                  return (
                    <div className="pt-2 border-t border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <span className="text-[11px] text-slate-400">
                        ⚡ Quick Differ Test on {targetMarket.shortName}:{' '}
                        <strong className="text-amber-300">Differ ≠ {targetDifferDigit}</strong> (Immediate 1-Tick Settle)
                      </span>
                      <button
                        type="button"
                        disabled={status.isRunning}
                        onClick={() => {
                          systemAutoEngine.triggerManualDoubleEndDiffer(targetMarket.symbol, targetDifferDigit);
                        }}
                        className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 via-orange-500 to-emerald-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black text-xs shadow-md shadow-amber-500/20 disabled:opacity-50 transition-all flex items-center justify-center gap-1.5"
                      >
                        <Zap className="w-3.5 h-3.5 fill-current" />
                        <span>TEST BUY DIFFER ≠ {targetDifferDigit} (1t)</span>
                      </button>
                    </div>
                  );
                })()}
              </div>
            </div>
          )}

          {/* ⚡ Fast Last Differ Strategy Card */}
          {config.strategyMode === 'FAST_LAST_DIFFER' && (
            <div className="rounded-2xl bg-gradient-to-br from-slate-900 via-cyan-950/25 to-slate-950 border border-cyan-500/40 p-5 shadow-2xl shadow-cyan-500/10 space-y-5">
              {/* Strategy Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-cyan-500/20 pb-3">
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-2xl bg-gradient-to-tr from-cyan-400 via-teal-500 to-emerald-400 text-slate-950 shadow-lg shadow-cyan-500/30 font-black">
                    <Zap className="w-6 h-6 fill-current" />
                  </div>
                  <div>
                    <h3 className="text-base font-black uppercase tracking-wider text-white flex items-center gap-2">
                      Terminal Auto • Fast Last Differ
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-mono">
                        ALL-MARKETS SIMULTANEOUS RADAR • FIRST MATCH BUYS DIFFER • 1-TICK SETTLE
                      </span>
                    </h3>
                    <p className="text-xs text-slate-300">
                      When started, this bot <strong className="text-cyan-300">scans all 13 volatility markets at once simultaneously</strong>. When your chosen digit <strong className="text-amber-300 font-mono">[{config.fastLastDifferChosenDigit ?? 5}]</strong> appears in <strong className="text-amber-300">any</strong> of the markets, the bot <strong className="text-emerald-400">buys that digit Differ (Differ ≠ {config.fastLastDifferChosenDigit ?? 5})</strong> immediately on that market as it appears. The first market to produce that selected digit triggers the buy, and the very next digit settles the trade (1-tick duration)!
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-mono font-bold px-3 py-1 rounded-xl bg-cyan-500/20 border border-cyan-400 text-cyan-300 shadow-inner">
                    CHOSEN DIGIT: <strong className="text-white font-black text-sm">[{config.fastLastDifferChosenDigit ?? 5}]</strong>
                  </span>
                  <span className="text-xs font-mono font-bold px-3 py-1 rounded-xl bg-slate-950 border border-amber-500/40 text-amber-300 shadow-inner">
                    SCOPE: ALL 13 MARKETS AT ONCE
                  </span>
                  <span className="text-xs font-mono font-bold px-3 py-1 rounded-xl bg-slate-950 border border-emerald-500/40 text-emerald-300 shadow-inner">
                    DURATION: 1 TICK
                  </span>
                </div>
              </div>

              {/* 🎯 SECTION 1: CHOOSE TARGET DIGIT (0..9) */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold uppercase tracking-wider text-cyan-300 flex items-center gap-1.5">
                    <Target className="w-4 h-4 text-cyan-400" />
                    <span>Step 1: Choose Target Digit (0 to 9) to Differ When It Appears</span>
                  </label>
                  <span className="text-[11px] font-mono text-slate-400">
                    Target: <strong className="text-emerald-400 font-bold">Differ ≠ {config.fastLastDifferChosenDigit ?? 5}</strong>
                  </span>
                </div>

                {/* 10 Digit Buttons (0-9) */}
                <div className="grid grid-cols-5 sm:grid-cols-10 gap-2">
                  {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((digit) => {
                    const isSelected = (config.fastLastDifferChosenDigit ?? 5) === digit;
                    const matchingMarketsCount = ASCENDING_VOLATILITY_MARKETS.filter(
                      (m) => marketStates.get(m.symbol)?.lastDigit === digit
                    ).length;

                    return (
                      <button
                        key={digit}
                        type="button"
                        disabled={status.isRunning}
                        onClick={() => {
                          systemAutoEngine.selectFastLastDifferChosenDigit(digit);
                          handleConfigChange({ fastLastDifferChosenDigit: digit });
                        }}
                        className={`flex flex-col items-center justify-center p-3 rounded-2xl border transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-gradient-to-br from-cyan-400 via-teal-500 to-emerald-400 text-slate-950 font-black border-cyan-200 ring-4 ring-cyan-400/50 shadow-xl shadow-cyan-500/30 scale-105 z-10'
                            : 'bg-slate-950/80 hover:bg-slate-900 border-slate-800 text-slate-200 hover:border-cyan-500/50 hover:text-white disabled:opacity-50'
                        }`}
                      >
                        <span className={`text-2xl font-black font-mono leading-none ${isSelected ? 'text-slate-950' : 'text-white'}`}>
                          {digit}
                        </span>
                        <span className={`text-[10px] font-bold mt-1.5 uppercase tracking-wider ${
                          isSelected ? 'text-slate-950 font-black' : 'text-slate-400'
                        }`}>
                          {isSelected ? '✓ CHOSEN' : `Differ ≠ ${digit}`}
                        </span>
                        <div className={`mt-1 text-[9px] font-mono px-1.5 py-0.2 rounded-full font-bold ${
                          isSelected
                            ? 'bg-slate-950/20 text-slate-950'
                            : matchingMarketsCount > 0
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                            : 'text-slate-500'
                        }`}>
                          {matchingMarketsCount} on radar
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 🎯 SECTION 2: ALL-MARKETS SIMULTANEOUS RADAR GRID */}
              <div className="space-y-3 pt-3 border-t border-cyan-500/20">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-cyan-300 flex items-center gap-1.5">
                    <Crosshair className="w-4 h-4 text-cyan-400 animate-pulse" />
                    <span>Step 2: Live All-Markets Radar (All 13 Continuous Markets Monitored Simultaneously)</span>
                  </label>
                  <div className="flex items-center gap-2 text-[11px] font-mono">
                    <span className="flex items-center gap-1.5 text-slate-400">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                      <span>Radar Active: <strong>13/13 Markets</strong></span>
                    </span>
                    <span className="text-slate-600">•</span>
                    <span className="text-amber-300 font-bold">
                      First to hit [{config.fastLastDifferChosenDigit ?? 5}] triggers trade
                    </span>
                  </div>
                </div>

                {/* 13 Markets Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2.5">
                  {ASCENDING_VOLATILITY_MARKETS.map((market) => {
                    const live = marketStates.get(market.symbol);
                    const currentDigit = live ? live.lastDigit : 0;
                    const price = live?.price ? live.price.toFixed(market.pipSize || 2) : '---';
                    const recent = live?.recentDigits || [];
                    const chosen = config.fastLastDifferChosenDigit ?? 5;
                    const isMatch = currentDigit === chosen;
                    const isTriggered = status.fastLastDifferTriggeredMarket === market.symbol;

                    return (
                      <div
                        key={market.symbol}
                        className={`p-3 rounded-2xl border transition-all flex flex-col justify-between ${
                          isTriggered
                            ? 'bg-gradient-to-br from-amber-500/25 via-emerald-500/20 to-slate-950 border-amber-400 ring-2 ring-amber-400 shadow-xl shadow-amber-500/20 scale-[1.02]'
                            : isMatch
                            ? 'bg-gradient-to-br from-emerald-950/60 via-slate-900 to-slate-950 border-emerald-400 ring-1 ring-emerald-400/80 shadow-lg shadow-emerald-500/20'
                            : 'bg-slate-950/80 border-slate-800/80 hover:border-slate-700'
                        }`}
                      >
                        <div>
                          {/* Market Title and Status */}
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-xs font-black text-white font-mono flex items-center gap-1.5">
                              <span>{market.shortName}</span>
                              {market.isOneSecond && (
                                <span className="text-[9px] px-1 py-0.2 rounded bg-cyan-950 border border-cyan-800 text-cyan-300 font-bold">
                                  1s
                                </span>
                              )}
                            </span>
                            <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-full uppercase ${
                              isTriggered
                                ? 'bg-amber-400 text-slate-950 font-black animate-pulse'
                                : isMatch
                                ? 'bg-emerald-500 text-slate-950 font-black animate-pulse'
                                : 'bg-slate-800 text-slate-400'
                            }`}>
                              {isTriggered ? '🔥 BOUGHT' : isMatch ? `MATCH: [${chosen}]` : `${market.volatility}%`}
                            </span>
                          </div>

                          {/* Digits Display */}
                          <div className="flex items-center justify-between my-2 p-2 rounded-xl bg-slate-900/90 border border-slate-800/80">
                            <div>
                              <div className="text-[10px] text-slate-400 uppercase tracking-wider">Last Digit</div>
                              <div className="text-xs font-mono text-slate-400 truncate max-w-[80px]">{price}</div>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <span
                                className={`text-2xl font-black font-mono w-10 h-10 flex items-center justify-center rounded-xl transition-all ${
                                  isMatch
                                    ? 'bg-gradient-to-br from-amber-400 to-emerald-400 text-slate-950 shadow-md shadow-emerald-500/40 ring-2 ring-emerald-300 scale-110'
                                    : 'bg-slate-800 text-white border border-slate-700'
                                }`}
                              >
                                {currentDigit}
                              </span>
                            </div>
                          </div>

                          {/* Recent Digits Ribbon */}
                          <div className="space-y-1 mb-2">
                            <div className="text-[9px] font-mono text-slate-500 flex items-center justify-between">
                              <span>Stream:</span>
                              <span className="text-slate-400">{isMatch ? 'Match active now' : `Waiting for [${chosen}]`}</span>
                            </div>
                            <div className="flex items-center gap-1 font-mono text-xs overflow-x-hidden">
                              {recent.slice(-5).map((d, i, arr) => {
                                const isCurrent = i === arr.length - 1;
                                const isDigitMatch = d === chosen;
                                return (
                                  <span
                                    key={i}
                                    className={`flex-1 h-5 flex items-center justify-center rounded text-[10px] font-bold ${
                                      isDigitMatch
                                        ? 'bg-amber-400 text-slate-950 font-black ring-1 ring-amber-300'
                                        : isCurrent
                                        ? 'bg-slate-700 text-slate-200'
                                        : 'bg-slate-900 text-slate-400 border border-slate-800'
                                    }`}
                                  >
                                    {d}
                                  </span>
                                );
                              })}
                            </div>
                          </div>
                        </div>

                        {/* Quick Trigger Button for this market */}
                        <button
                          type="button"
                          disabled={status.isRunning}
                          onClick={() => {
                            systemAutoEngine.triggerManualFastLastDiffer(chosen, market.symbol);
                          }}
                          className={`w-full py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1 ${
                            isMatch
                              ? 'bg-gradient-to-r from-emerald-500 to-teal-400 text-slate-950 shadow-md shadow-emerald-500/30 ring-1 ring-emerald-300 hover:brightness-110 cursor-pointer'
                              : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 hover:border-cyan-500/40 disabled:opacity-50'
                          }`}
                        >
                          <Zap className="w-3 h-3 fill-current" />
                          <span>Buy Differ ≠ {chosen} (1t)</span>
                        </button>
                      </div>
                    );
                  })}
                </div>

                {/* 🎯 SECTION 3: RADAR TELEMETRY & 1-CLICK MASTER TRIGGER */}
                {(() => {
                  const chosen = config.fastLastDifferChosenDigit ?? 5;
                  const matchingMarkets = ASCENDING_VOLATILITY_MARKETS.filter(
                    (m) => marketStates.get(m.symbol)?.lastDigit === chosen
                  );
                  const firstMatch = matchingMarkets[0] || ASCENDING_VOLATILITY_MARKETS[0];

                  return (
                    <div className="pt-3 border-t border-cyan-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2 text-xs text-white">
                          <Activity className="w-4 h-4 text-cyan-400" />
                          <span>
                            Radar Status:{' '}
                            <strong className="text-cyan-300">
                              {matchingMarkets.length > 0
                                ? `${matchingMarkets.length} market${matchingMarkets.length > 1 ? 's' : ''} currently displaying digit [${chosen}] (${matchingMarkets.map((m) => m.shortName).join(', ')})`
                                : `Scanning all 13 markets... Waiting for digit [${chosen}] to appear`}
                            </strong>
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400">
                          Mode: <strong>1-Trade Sequential</strong> • Duration: <strong>1 Tick</strong> • Next tick closes trade cleanly (≠ {chosen} = WIN)!
                        </p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          disabled={status.isRunning}
                          onClick={() => {
                            systemAutoEngine.triggerManualFastLastDiffer(chosen, firstMatch.symbol);
                          }}
                          className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-cyan-400 via-teal-500 to-emerald-400 hover:from-cyan-300 hover:to-emerald-300 text-slate-950 font-black text-xs shadow-lg shadow-cyan-500/25 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                        >
                          <Zap className="w-4 h-4 fill-current" />
                          <span>TEST BUY DIFFER ≠ {chosen} on {firstMatch.shortName} (1t)</span>
                        </button>
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>
          )}

          {/* 🎯 Auto...Entry Point Bot Strategy Card */}
          {config.strategyMode === 'ENTRY_POINT_DIFFER' && (
            <div className="rounded-2xl bg-gradient-to-br from-slate-900 via-cyan-950/25 to-slate-950 border border-cyan-500/40 p-5 shadow-2xl shadow-cyan-500/10 space-y-5">
              {/* Strategy Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-cyan-500/20 pb-3">
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-2xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-cyan-500 text-white shadow-lg shadow-cyan-500/30">
                    <Target className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-base font-black uppercase tracking-wider text-white flex items-center gap-2">
                      Auto..Entry Point Bot
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-mono">
                        SCAN ➔ DETECT ➔ BUY DIFFER • 1-TICK CLOSE
                      </span>
                    </h3>
                    <p className="text-xs text-slate-300">
                      Select your target market (e.g. <strong className="text-cyan-400">Volatility 100 Index</strong>) and choose which digit to trade differ from the panel below. Once you click <strong className="text-cyan-400">RUN BOT</strong>, the bot scans the market. The moment your selected digit appears, it immediately buys that digit differ (<strong className="text-cyan-400 font-mono">Differ ≠ {config.entryPointTargetDigit ?? 5}</strong>), and the next digit closes the trade!
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-bold px-3 py-1 rounded-xl bg-slate-950 border border-cyan-500/40 text-cyan-300 shadow-inner">
                    ENTRY: DIGIT {config.entryPointTargetDigit ?? 5}
                  </span>
                  <span className="text-xs font-mono font-bold px-3 py-1 rounded-xl bg-slate-950 border border-emerald-500/40 text-emerald-300 shadow-inner">
                    DURATION: 1 TICK
                  </span>
                </div>
              </div>

              {/* DIGIT SELECT PANEL */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold uppercase tracking-wider text-cyan-300 flex items-center gap-1.5">
                    <Crosshair className="w-4 h-4 text-cyan-400" />
                    <span>Digit Select Panel: Choose Which Digit To Trade Differ (≠ Digit)</span>
                  </label>
                  <span className="text-[11px] font-mono text-slate-400">
                    Selected Entry Differ Digit: <strong className="text-amber-300 text-xs font-bold">≠ {config.entryPointTargetDigit ?? 5}</strong>
                  </span>
                </div>

                {/* Digit Buttons 0 through 9 */}
                <div className="grid grid-cols-5 sm:grid-cols-10 gap-2">
                  {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((digit) => {
                    const isSelected = (config.entryPointTargetDigit ?? 5) === digit;
                    return (
                      <button
                        key={digit}
                        type="button"
                        disabled={status.isRunning}
                        onClick={() => {
                          systemAutoEngine.selectEntryPointTargetDigit(digit);
                          handleConfigChange({ entryPointTargetDigit: digit });
                        }}
                        className={`group relative flex flex-col items-center justify-center py-2.5 px-2 rounded-xl transition-all font-mono ${
                          isSelected
                            ? 'bg-gradient-to-b from-blue-600 via-indigo-600 to-cyan-500 text-white font-black shadow-lg shadow-cyan-500/40 ring-2 ring-cyan-300 scale-105'
                            : 'bg-slate-950 hover:bg-slate-800 text-slate-300 border border-slate-800 hover:border-cyan-500/50 disabled:opacity-50'
                        }`}
                      >
                        <span className="text-lg font-black">{digit}</span>
                        <span className={`text-[9px] uppercase tracking-wider ${isSelected ? 'text-cyan-100 font-bold' : 'text-slate-500 group-hover:text-cyan-300'}`}>
                          {isSelected ? '✓ TARGET' : `DIFF ≠${digit}`}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Win / Loss Probability Helper */}
                <div className="p-3 rounded-xl bg-slate-950/90 border border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span className="text-slate-300">
                      <strong>Entry Condition:</strong> When selected digit <strong className="text-amber-300 font-mono">[{config.entryPointTargetDigit ?? 5}]</strong> appears on market ticks, bot immediately buys <strong className="text-cyan-300 font-mono">Differ ≠ {config.entryPointTargetDigit ?? 5}</strong>.
                    </span>
                  </div>
                  <div className="flex items-center gap-3 shrink-0 font-mono text-[11px]">
                    <span className="text-emerald-400 font-bold">Win Rate: 90.9% (9 of 10 digits win)</span>
                    <span className="text-slate-500">|</span>
                    <span className="text-cyan-300 font-bold">Duration: 1 Tick</span>
                  </div>
                </div>
              </div>

              {/* PART 3: LIVE MARKET SCANNER & ENTRY POINT RADAR */}
              {(() => {
                const targetSym = config.entryPointMarketSymbol || 'R_100';
                const targetMkt = ASCENDING_VOLATILITY_MARKETS.find((m) => m.symbol === targetSym) || ASCENDING_VOLATILITY_MARKETS[0];
                const live = marketStates.get(targetSym);
                const currentDigit = live ? live.lastDigit : 0;
                const price = live ? live.displayPrice : '---';
                const targetDigit = config.entryPointTargetDigit ?? 5;
                const isMatched = currentDigit === targetDigit;

                return (
                  <div className="space-y-4">
                    {/* Real-time Status Card */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className={`p-3 rounded-xl border flex flex-col justify-center transition-all ${
                        isMatched
                          ? 'bg-cyan-950/80 border-cyan-400 ring-1 ring-cyan-300'
                          : 'bg-slate-900/90 border-cyan-500/30'
                      }`}>
                        <span className="text-[10px] uppercase text-slate-400 font-bold tracking-wider">Target Entry Point Digit</span>
                        <div className="text-2xl font-black font-mono text-amber-300 mt-1 flex items-center gap-2">
                          <span>Digit [{targetDigit}]</span>
                          {isMatched && (
                            <span className="text-[10px] font-sans font-bold px-2 py-0.5 rounded-full bg-emerald-500 text-slate-950 animate-pulse">
                              TRIGGER READY ⚡
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-400 mt-1 leading-tight">
                          {isMatched ? (
                            <strong className="text-emerald-400">Digit [{targetDigit}] appeared on {targetMkt.shortName}! Bot triggers Differ ≠ {targetDigit} contract.</strong>
                          ) : (
                            <span>Scanning live ticks... Waiting for digit <strong className="text-amber-400">[{targetDigit}]</strong> to appear (Current: [{currentDigit}]).</span>
                          )}
                        </p>
                      </div>

                      {/* Settlement Rule */}
                      <div className="p-3 rounded-xl bg-slate-900/90 border border-cyan-500/30 flex flex-col justify-center">
                        <span className="text-[10px] uppercase text-slate-400 font-bold tracking-wider">Immediate 1-Tick Settlement</span>
                        <div className="text-sm font-black text-emerald-300 mt-1 flex items-center gap-1.5">
                          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                          <span>Next Digit ≠ {targetDigit} ➔ WIN</span>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-1 leading-tight">
                          Once triggered, the very next digit generated closes the trade. Contract wins if the next digit is not {targetDigit}!
                        </p>
                      </div>
                    </div>

                    {/* How It Operates Explainer */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2 border-t border-slate-800/80 text-[11px] text-slate-400">
                      <div className="flex items-start gap-2">
                        <span className="w-4 h-4 rounded-full bg-cyan-500/20 text-cyan-300 font-bold font-mono flex items-center justify-center shrink-0 text-[10px]">A</span>
                        <span>Select market & choose digit to Differ from panel (<strong className="text-amber-300 font-mono">Digit {targetDigit}</strong>)</span>
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="w-4 h-4 rounded-full bg-cyan-500/20 text-cyan-300 font-bold font-mono flex items-center justify-center shrink-0 text-[10px]">B</span>
                        <span>Bot scans the market in real-time until digit <strong className="text-amber-300 font-mono">[{targetDigit}]</strong> appears</span>
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="w-4 h-4 rounded-full bg-cyan-500/20 text-cyan-300 font-bold font-mono flex items-center justify-center shrink-0 text-[10px]">C</span>
                        <span>Immediately buys <strong className="text-cyan-300 font-mono">Differ ≠ {targetDigit}</strong>; the next digit closes and settles the trade in <strong className="text-emerald-300 font-bold">1 tick</strong>!</span>
                      </div>
                    </div>

                    {/* Strategy Shield & Anti-Manipulation Protection Status for Entry Point Bot */}
                    <div className="p-3 rounded-xl bg-slate-950 border border-emerald-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                      <div className="flex items-center gap-2.5">
                        <div className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
                          <ShieldCheck className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-white">Entry Point Shield: ARMED</span>
                            <span className="text-[10px] px-2 py-0.2 rounded-full bg-cyan-950 text-cyan-300 border border-cyan-800 font-mono">
                              Timing Jitter: {status.lastShieldJitterMs || 220}ms
                            </span>
                            <span className="text-[10px] px-2 py-0.2 rounded-full bg-indigo-950 text-indigo-300 border border-indigo-800 font-mono">
                              {status.isZeroTraceMode ? 'Zero-Trace Mode ON' : 'Standard'}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-400">
                            Request payloads scrambled with random entropy nonces to prevent broker dealing-desk algorithm counter-measures.
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className={`text-[10px] font-mono font-black px-2.5 py-1 rounded-lg border ${
                          status.manipulationThreatLevel === 'CLEAN'
                            ? 'bg-emerald-950/80 text-emerald-300 border-emerald-700'
                            : status.manipulationThreatLevel === 'LOW'
                            ? 'bg-cyan-950/80 text-cyan-300 border-cyan-700'
                            : status.manipulationThreatLevel === 'ELEVATED'
                            ? 'bg-amber-950/80 text-amber-300 border-amber-700'
                            : 'bg-rose-950/80 text-rose-300 border-rose-700 animate-pulse'
                        }`}>
                          THREAT: {status.manipulationThreatScore}% ({status.manipulationThreatLevel})
                        </span>
                      </div>
                    </div>

                    {/* Action Bar */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
                      <div className="text-xs text-slate-300">
                        Stake: <strong className="text-emerald-400 font-mono">${config.baseStake.toFixed(2)}</strong> | Differ Target:{' '}
                        <strong className="text-amber-300 font-mono">≠ {targetDigit}</strong> | Market:{' '}
                        <strong className="text-cyan-300 font-mono">{targetMkt.shortName}</strong>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          disabled={status.isRunning || status.isTradeActive}
                          onClick={() => {
                            systemAutoEngine.selectEntryPointMarket(targetSym);
                            systemAutoEngine.triggerManualEntryPointDiffer(targetSym, targetDigit);
                          }}
                          className="px-3.5 py-2 rounded-xl text-xs font-bold uppercase tracking-wider bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 disabled:opacity-50 transition-colors flex items-center gap-1.5"
                        >
                          <Zap className="w-3.5 h-3.5 text-cyan-400" />
                          <span>Fire 1-Tick Differ Test</span>
                        </button>

                        <button
                          onClick={() => {
                            if (status.isRunning) {
                              systemAutoEngine.stopBot('User stopped bot');
                            } else {
                              systemAutoEngine.startBot();
                            }
                          }}
                          className={`flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider transition-all shadow-lg ${
                            status.isRunning
                              ? 'bg-red-600 hover:bg-red-500 text-white shadow-red-600/30 ring-2 ring-red-400 animate-pulse'
                              : 'bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white shadow-cyan-500/30 ring-2 ring-cyan-300'
                          }`}
                        >
                          {status.isRunning ? (
                            <>
                              <Square className="w-4 h-4 fill-current" />
                              <span>Stop Bot</span>
                            </>
                          ) : (
                            <>
                              <Play className="w-4 h-4 fill-current" />
                              <span>Run Entry Point Bot</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          {/* 🎯 Auto...Digit Marker Bot Strategy Card */}
          {config.strategyMode === 'DIGIT_MARKER_DIFFER' && (
            <div className="rounded-2xl bg-gradient-to-br from-slate-900 via-amber-950/25 to-slate-950 border border-amber-500/40 p-5 shadow-2xl shadow-amber-500/10 space-y-5">
              {/* Strategy Header */}
              {(() => {
                const targetSym = config.digitMarkerMarketSymbol || 'R_100';
                const targetMkt = ASCENDING_VOLATILITY_MARKETS.find((m) => m.symbol === targetSym) || ASCENDING_VOLATILITY_MARKETS[0];
                const liveMktState = marketStates.get(targetSym);
                const curDigit = liveMktState ? liveMktState.lastDigit : 0;
                const targetDigit = config.digitMarkerTargetDigit !== undefined ? config.digitMarkerTargetDigit : 6;
                const isMatched = curDigit === targetDigit;
                const recentDigits = liveMktState?.recentDigits || [];

                return (
                  <div className="space-y-5">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-amber-500/20 pb-3">
                      <div className="flex items-center gap-3">
                        <div className="p-3 rounded-2xl bg-gradient-to-tr from-amber-500 via-orange-500 to-rose-500 text-slate-950 shadow-lg shadow-orange-500/30">
                          <Bookmark className="w-6 h-6 fill-current" />
                        </div>
                        <div>
                          <h3 className="text-base font-black uppercase tracking-wider text-white flex items-center gap-2">
                            Digit Marker Bot
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 font-mono">
                              DIGIT MARKER DIFFER • SCAN TARGET DIGIT ➔ IMMEDIATE 1-TICK DIFFER SETTLE
                            </span>
                          </h3>
                          <p className="text-xs text-slate-300">
                            Select which digit you want to Differ (0–9) and choose a volatility market. The bot continuously scans that market's live ticks in real time. The instant your chosen marked digit appears (e.g. scanning <span className="font-mono text-amber-300">3, 7, 8, 6, 9</span> — once <strong className="text-amber-400 font-mono">6</strong> appears), the bot immediately purchases <strong className="text-emerald-400 font-mono">Differ ≠ 6</strong>, and the next digit (<span className="font-mono text-cyan-300">9</span>) settles the trade in <strong className="text-emerald-300 font-bold">1 tick</strong>!
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-mono font-bold px-3 py-1 rounded-xl bg-slate-950 border border-amber-500/40 text-amber-300 shadow-inner flex items-center gap-1.5">
                          <Bookmark className="w-3.5 h-3.5 text-amber-400 fill-current" />
                          <span>MARKED: ≠ {targetDigit}</span>
                        </span>
                        <span className="text-xs font-mono font-bold px-3 py-1 rounded-xl bg-slate-950 border border-cyan-500/40 text-cyan-300 shadow-inner">
                          {targetMkt.shortName}
                        </span>
                        <span className="text-xs font-mono font-bold px-3 py-1 rounded-xl bg-slate-950 border border-emerald-500/40 text-emerald-300 shadow-inner">
                          DURATION: 1 TICK
                        </span>
                      </div>
                    </div>

                    {/* DIGIT MARKER PANEL */}
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold uppercase tracking-wider text-amber-300 flex items-center gap-1.5">
                          <Bookmark className="w-4 h-4 text-amber-400 fill-current" />
                          <span>Digit Marker Panel: Choose Which Digit You Want To Differ (≠ Digit)</span>
                        </label>
                        <span className="text-[11px] font-mono text-slate-400">
                          Selected Differ Target: <strong className="text-amber-300 text-xs font-bold">≠ {targetDigit}</strong>
                        </span>
                      </div>

                      {/* Digit Buttons 0 through 9 */}
                      <div className="grid grid-cols-5 sm:grid-cols-10 gap-2">
                        {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((digit) => {
                          const isSelected = targetDigit === digit;
                          return (
                            <button
                              key={digit}
                              type="button"
                              disabled={status.isRunning}
                              onClick={() => {
                                systemAutoEngine.selectDigitMarkerTargetDigit(digit);
                                handleConfigChange({ digitMarkerTargetDigit: digit });
                              }}
                              className={`group relative flex flex-col items-center justify-center py-2.5 px-2 rounded-xl transition-all font-mono ${
                                isSelected
                                  ? 'bg-gradient-to-b from-amber-500 via-orange-500 to-rose-500 text-slate-950 font-black shadow-lg shadow-orange-500/40 ring-2 ring-amber-300 scale-105'
                                  : 'bg-slate-950 hover:bg-slate-800 text-slate-300 border border-slate-800 hover:border-amber-500/50 disabled:opacity-50'
                              }`}
                            >
                              <span className="text-lg font-black">{digit}</span>
                              <span className={`text-[9px] uppercase tracking-wider ${isSelected ? 'text-slate-950 font-bold' : 'text-slate-500 group-hover:text-amber-300'}`}>
                                {isSelected ? 'MARKED' : `≠ ${digit}`}
                              </span>
                              {isSelected && (
                                <span className="absolute -top-1.5 -right-1.5 flex h-3.5 w-3.5">
                                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                                  <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-amber-400 border border-slate-950"></span>
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>

                      <p className="text-[11px] text-slate-400">
                        💡 <strong>Marker active:</strong> You marked digit <strong className="text-amber-300 font-mono">[{targetDigit}]</strong>. When digit <strong className="text-amber-300 font-mono">[{targetDigit}]</strong> prints in {targetMkt.shortName}'s stream, the bot immediately triggers a <strong className="text-emerald-400 font-mono">Differ ≠ {targetDigit}</strong> contract.
                      </p>
                    </div>

                    {/* Real-time Status Card */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-800/80">
                      <div className={`p-3 rounded-xl border flex flex-col justify-center transition-all ${
                        isMatched
                          ? 'bg-amber-950/80 border-amber-400 ring-1 ring-amber-300'
                          : 'bg-slate-900/90 border-amber-500/30'
                      }`}>
                        <span className="text-[10px] uppercase text-slate-400 font-bold tracking-wider">Target Marker Condition</span>
                        <div className="text-2xl font-black font-mono text-amber-300 mt-1 flex items-center gap-2">
                          <span>Digit [{targetDigit}]</span>
                          {isMatched && (
                            <span className="text-[10px] font-sans font-bold px-2 py-0.5 rounded-full bg-emerald-500 text-slate-950 animate-pulse">
                              TRIGGER ACTIVE
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-400 mt-1 leading-tight">
                          {isMatched ? (
                            <strong className="text-emerald-400">Digit [{targetDigit}] appeared! Bot buys Differ ≠ {targetDigit}.</strong>
                          ) : (
                            <span>Scanning live feed... Waiting for digit <strong className="text-amber-400">[{targetDigit}]</strong> to appear (Current: [{curDigit}]).</span>
                          )}
                        </p>
                      </div>

                      {/* Settlement Rule */}
                      <div className="p-3 rounded-xl bg-slate-900/90 border border-amber-500/30 flex flex-col justify-center">
                        <span className="text-[10px] uppercase text-slate-400 font-bold tracking-wider">Immediate 1-Tick Settlement</span>
                        <div className="text-sm font-black text-emerald-300 mt-1 flex items-center gap-1.5">
                          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                          <span>Next Digit ≠ {targetDigit} ➔ WIN</span>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-1 leading-tight">
                          Once triggered, the very next digit generated settles the trade. Contract wins if the next digit is not {targetDigit}!
                        </p>
                      </div>
                    </div>

                      {/* How It Operates Explainer */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2 border-t border-slate-800/80 text-[11px] text-slate-400">
                        <div className="flex items-start gap-2">
                          <span className="w-4 h-4 rounded-full bg-amber-500/20 text-amber-300 font-bold font-mono flex items-center justify-center shrink-0 text-[10px]">A</span>
                          <span>Select market & choose digit to Differ from panel (<strong className="text-amber-300 font-mono">Digit {targetDigit}</strong>)</span>
                        </div>
                        <div className="flex items-start gap-2">
                          <span className="w-4 h-4 rounded-full bg-amber-500/20 text-amber-300 font-bold font-mono flex items-center justify-center shrink-0 text-[10px]">B</span>
                          <span>Bot scans the market in real-time until marked digit <strong className="text-amber-300 font-mono">[{targetDigit}]</strong> appears</span>
                        </div>
                        <div className="flex items-start gap-2">
                          <span className="w-4 h-4 rounded-full bg-amber-500/20 text-amber-300 font-bold font-mono flex items-center justify-center shrink-0 text-[10px]">C</span>
                          <span>Immediately buys <strong className="text-emerald-300 font-mono">Differ ≠ {targetDigit}</strong>; the next digit closes and settles the trade in <strong className="text-emerald-300 font-bold">1 tick</strong>!</span>
                        </div>
                      </div>

                      {/* Strategy Shield & Anti-Manipulation Protection Status */}
                      <div className="p-3 rounded-xl bg-slate-950 border border-emerald-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                        <div className="flex items-center gap-2.5">
                          <div className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
                            <ShieldCheck className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-white">Digit Marker Shield: ARMED</span>
                              <span className="text-[10px] px-2 py-0.2 rounded-full bg-amber-950 text-amber-300 border border-amber-800 font-mono">
                                Timing Jitter: {status.lastShieldJitterMs || 180}ms
                              </span>
                              <span className="text-[10px] px-2 py-0.2 rounded-full bg-indigo-950 text-indigo-300 border border-indigo-800 font-mono">
                                {status.isZeroTraceMode ? 'Zero-Trace Mode ON' : 'Standard'}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-400">
                              Order payloads randomized with entropy tokens to maintain stealth and prevent broker dealing-desk counter-measures.
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <span className={`text-[10px] font-mono font-black px-2.5 py-1 rounded-lg border ${
                            status.manipulationThreatLevel === 'CLEAN'
                              ? 'bg-emerald-950/80 text-emerald-300 border-emerald-700'
                              : status.manipulationThreatLevel === 'LOW'
                              ? 'bg-cyan-950/80 text-cyan-300 border-cyan-700'
                              : status.manipulationThreatLevel === 'ELEVATED'
                              ? 'bg-amber-950/80 text-amber-300 border-amber-700'
                              : 'bg-rose-950/80 text-rose-300 border-rose-700 animate-pulse'
                          }`}>
                            THREAT: {status.manipulationThreatScore}% ({status.manipulationThreatLevel})
                          </span>
                        </div>
                      </div>

                      {/* Action Bar */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
                        <div className="text-xs text-slate-300">
                          Stake: <strong className="text-emerald-400 font-mono">${config.baseStake.toFixed(2)}</strong> | Differ Target:{' '}
                          <strong className="text-amber-300 font-mono">≠ {targetDigit}</strong> | Market:{' '}
                          <strong className="text-cyan-300 font-mono">{targetMkt.shortName}</strong>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            disabled={status.isRunning || status.isTradeActive}
                            onClick={() => {
                              systemAutoEngine.selectDigitMarkerMarket(targetSym);
                              systemAutoEngine.triggerManualDigitMarkerDiffer(targetSym, targetDigit);
                            }}
                            className="px-3.5 py-2 rounded-xl text-xs font-bold uppercase tracking-wider bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 disabled:opacity-50 transition-colors flex items-center gap-1.5"
                          >
                            <Zap className="w-3.5 h-3.5 text-amber-400" />
                            <span>Fire 1-Tick Differ Test</span>
                          </button>

                          <button
                            onClick={() => {
                              if (status.isRunning) {
                                systemAutoEngine.stopBot('User stopped bot');
                              } else {
                                systemAutoEngine.startBot();
                              }
                            }}
                            className={`flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider transition-all shadow-lg ${
                              status.isRunning
                                ? 'bg-red-600 hover:bg-red-500 text-white shadow-red-600/30 ring-2 ring-red-400 animate-pulse'
                                : 'bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 hover:from-amber-400 hover:to-rose-400 text-slate-950 shadow-orange-500/30 ring-2 ring-amber-300'
                            }`}
                          >
                            {status.isRunning ? (
                              <>
                                <Square className="w-4 h-4 fill-current" />
                                <span>Stop Bot</span>
                              </>
                            ) : (
                              <>
                                <Play className="w-4 h-4 fill-current" />
                                <span>Run Digit Marker Bot</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })()}
            </div>
          )}

          {/* 📊 Auto...Range long Differs Strategy Card */}
          {config.strategyMode === 'RANGE_LONG_DIFFERS' && (
            <div className="rounded-2xl bg-gradient-to-br from-slate-900 via-teal-950/25 to-slate-950 border border-emerald-500/40 p-5 shadow-2xl shadow-emerald-500/10 space-y-5">
              {(() => {
                const targetSym = config.rangeLongDiffersMarketSymbol || 'R_100';
                const targetMkt = ASCENDING_VOLATILITY_MARKETS.find((m) => m.symbol === targetSym) || ASCENDING_VOLATILITY_MARKETS[0];
                const liveMktState = marketStates.get(targetSym);
                const curDigit = liveMktState ? liveMktState.lastDigit : 0;
                const windowDigits = status.rangeLongWindowDigits || [];
                const currentCount = windowDigits.length;
                const mostAppearing = status.rangeLongMostAppearingDigit;
                const mostAppearingCount = status.rangeLongMostAppearingCount || 0;
                const frequencies = status.rangeLongDigitFrequencies || {};

                return (
                  <div className="space-y-5">
                    {/* Strategy Header */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-emerald-500/20 pb-3">
                      <div className="flex items-center gap-3">
                        <div className="p-3 rounded-2xl bg-gradient-to-tr from-emerald-500 via-teal-500 to-indigo-500 text-slate-950 shadow-lg shadow-emerald-500/30">
                          <BarChart2 className="w-6 h-6 fill-current" />
                        </div>
                        <div>
                          <h3 className="text-base font-black uppercase tracking-wider text-white flex items-center gap-2">
                            Range long Differs
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-mono">
                              7-DIGIT WINDOW • MOST FREQUENT DIFFER • 8TH DIGIT SETTLEMENT
                            </span>
                          </h3>
                          <p className="text-xs text-slate-300">
                            Observes the live sequence of 7 digits generated on <strong className="text-cyan-400 font-mono">{targetMkt.name}</strong>. Counts digit frequencies within the 7-digit window to find the most appearing digit. On reaching the <strong className="text-amber-300">7th digit</strong>, the bot buys <strong className="text-emerald-400 font-mono">Differ ≠ [most appearing digit]</strong>, and the trade settles immediately on the <strong className="text-cyan-300 font-bold">8th digit</strong>!
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-mono font-bold px-3 py-1 rounded-xl bg-slate-950 border border-emerald-500/40 text-emerald-300 shadow-inner flex items-center gap-1.5">
                          <BarChart2 className="w-3.5 h-3.5 text-emerald-400" />
                          <span>WINDOW: 7 DIGITS</span>
                        </span>
                        <span className="text-xs font-mono font-bold px-3 py-1 rounded-xl bg-slate-950 border border-cyan-500/40 text-cyan-300 shadow-inner">
                          {targetMkt.shortName}
                        </span>
                        <span className="text-xs font-mono font-bold px-3 py-1 rounded-xl bg-slate-950 border border-indigo-500/40 text-indigo-300 shadow-inner">
                          SETTLE: 8TH DIGIT
                        </span>
                      </div>
                    </div>

                    {/* LIVE 7-DIGIT WINDOW PROGRESS & VISUALIZER */}
                    <div className="p-4 rounded-xl bg-slate-950/90 border border-emerald-500/30 space-y-3">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
                          <label className="text-xs font-bold uppercase tracking-wider text-emerald-300">
                            Live 7-Digit Generated Window
                          </label>
                          <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-slate-900 border border-emerald-500/40 text-emerald-300">
                            {currentCount} / 7 Digits Generated
                          </span>
                        </div>

                        <div className="text-[11px] font-mono text-slate-400">
                          {currentCount === 7 ? (
                            <span className="text-amber-300 font-bold">
                              ⚡ 7th Digit Reached! Buying Differ ≠ {mostAppearing} (Settles on 8th digit)
                            </span>
                          ) : (
                            <span>
                              Awaiting {7 - currentCount} more digit{7 - currentCount > 1 ? 's' : ''} to reach 7th digit trigger
                            </span>
                          )}
                        </div>
                      </div>

                      {/* 7 Slots Display */}
                      <div className="grid grid-cols-7 gap-2 sm:gap-3">
                        {[0, 1, 2, 3, 4, 5, 6].map((slotIdx) => {
                          const hasDigit = slotIdx < windowDigits.length;
                          const digitValue = hasDigit ? windowDigits[slotIdx] : null;
                          const isMostFrequent = hasDigit && digitValue === mostAppearing && (mostAppearingCount > 1 || currentCount >= 4);
                          const isLatestFilled = hasDigit && slotIdx === windowDigits.length - 1;
                          const is7thSlot = slotIdx === 6;

                          return (
                            <div
                              key={slotIdx}
                              className={`relative flex flex-col items-center justify-center py-3 px-1 rounded-xl border transition-all ${
                                isMostFrequent
                                  ? 'bg-gradient-to-b from-amber-500/30 via-emerald-950 to-slate-950 border-amber-400 ring-2 ring-amber-400/80 shadow-lg shadow-amber-500/20 scale-[1.03]'
                                  : isLatestFilled
                                  ? 'bg-slate-900 border-emerald-400/80 ring-1 ring-emerald-400/50 shadow-md shadow-emerald-500/20'
                                  : hasDigit
                                  ? 'bg-slate-900/80 border-slate-700 text-slate-200'
                                  : 'bg-slate-950/60 border-dashed border-slate-800 text-slate-600'
                              }`}
                            >
                              <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 -mt-0.5">
                                #{slotIdx + 1}
                              </span>
                              <span className={`text-xl sm:text-2xl font-black font-mono my-0.5 ${
                                isMostFrequent
                                  ? 'text-amber-300'
                                  : hasDigit
                                  ? 'text-white'
                                  : 'text-slate-600'
                              }`}>
                                {hasDigit ? digitValue : '•'}
                              </span>
                              <span className={`text-[8px] font-bold uppercase tracking-wider text-center ${
                                isMostFrequent
                                  ? 'text-amber-300 font-black'
                                  : is7thSlot
                                  ? 'text-cyan-400'
                                  : hasDigit
                                  ? 'text-slate-400'
                                  : 'text-slate-600'
                              }`}>
                                {isMostFrequent
                                  ? 'LEADER'
                                  : is7thSlot && hasDigit
                                  ? 'BUY ➔'
                                  : is7thSlot
                                  ? 'TRIGGER'
                                  : hasDigit
                                  ? 'TICK'
                                  : 'WAIT'}
                              </span>

                              {isMostFrequent && (
                                <span className="absolute -top-1.5 -right-1.5 flex h-3 w-3">
                                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                                  <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-400 border border-slate-950"></span>
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      {/* Progress bar */}
                      <div className="w-full bg-slate-900 rounded-full h-2 overflow-hidden border border-slate-800">
                        <div
                          className="h-full bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-400 transition-all duration-300"
                          style={{ width: `${Math.min(100, Math.round((currentCount / 7) * 100))}%` }}
                        />
                      </div>

                      {/* Digit Frequencies Breakdown */}
                      <div className="pt-2 border-t border-slate-800/80 flex flex-wrap items-center gap-2">
                        <span className="text-[11px] font-bold text-slate-400">
                          Digit Occurrences in Range:
                        </span>
                        {Object.entries(frequencies)
                          .filter(([_, count]) => count > 0)
                          .sort((a, b) => b[1] - a[1])
                          .map(([digitStr, count]) => {
                            const dNum = Number(digitStr);
                            const isLeader = dNum === mostAppearing;
                            return (
                              <span
                                key={digitStr}
                                className={`text-[10px] font-mono px-2 py-0.5 rounded-lg border flex items-center gap-1 ${
                                  isLeader
                                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 font-bold shadow-sm'
                                    : 'bg-slate-900 text-slate-300 border-slate-800'
                                }`}
                              >
                                <span>Digit [{dNum}]:</span>
                                <strong className={isLeader ? 'text-amber-300' : 'text-emerald-400'}>
                                  {count}x {isLeader ? '★' : ''}
                                </strong>
                              </span>
                            );
                          })}
                        {currentCount === 0 && (
                          <span className="text-[11px] text-slate-500 italic">
                            No digits in current range yet. Waiting for incoming ticks...
                          </span>
                        )}
                      </div>
                    </div>

                    {/* TARGET & SETTLEMENT SUMMARY */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {/* Condition Status */}
                      <div className="p-3 rounded-xl bg-slate-900/90 border border-emerald-500/30 flex flex-col justify-center">
                        <span className="text-[10px] uppercase text-slate-400 font-bold tracking-wider">
                          Most Appearing Digit Target
                        </span>
                        <div className="text-xl font-black font-mono text-emerald-300 mt-1 flex items-center gap-2">
                          <span>
                            {mostAppearing !== null ? `Digit [${mostAppearing}]` : 'Analyzing...'}
                          </span>
                          {mostAppearing !== null && (
                            <span className="text-xs font-sans font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40">
                              Appeared {mostAppearingCount}x in 7 digits
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-400 mt-1 leading-tight">
                          {currentCount === 7 ? (
                            <strong className="text-emerald-400">
                              7th digit reached! Bot purchases Differ ≠ {mostAppearing}.
                            </strong>
                          ) : (
                            <span>
                              {currentCount}/7 digits generated. Current leader to differ is Digit [{mostAppearing ?? '?'}].
                            </span>
                          )}
                        </p>
                      </div>

                      {/* Settlement Rule */}
                      <div className="p-3 rounded-xl bg-slate-900/90 border border-emerald-500/30 flex flex-col justify-center">
                        <span className="text-[10px] uppercase text-slate-400 font-bold tracking-wider">
                          8th Digit Settlement Rule
                        </span>
                        <div className="text-sm font-black text-emerald-300 mt-1 flex items-center gap-1.5">
                          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                          <span>8th Digit ≠ {mostAppearing ?? 'Target'} ➔ WIN</span>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-1 leading-tight">
                          The contract is purchased on the 7th digit. The immediate next digit (the 8th digit) closes and settles the trade in 1 tick (90.9% win rate)!
                        </p>
                      </div>
                    </div>

                    {/* How It Operates Step Guide */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2 border-t border-slate-800/80 text-[11px] text-slate-400">
                      <div className="flex items-start gap-2">
                        <span className="w-4 h-4 rounded-full bg-emerald-500/20 text-emerald-300 font-bold font-mono flex items-center justify-center shrink-0 text-[10px]">1</span>
                        <span>Observes 7 live ticks generated on {targetMkt.shortName} (<strong className="text-emerald-300 font-mono">0..7 digits</strong>)</span>
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="w-4 h-4 rounded-full bg-emerald-500/20 text-emerald-300 font-bold font-mono flex items-center justify-center shrink-0 text-[10px]">2</span>
                        <span>Identifies most appearing digit in the 7 digits (e.g. <strong className="text-amber-300 font-mono">Digit {mostAppearing ?? 3}</strong>)</span>
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="w-4 h-4 rounded-full bg-emerald-500/20 text-emerald-300 font-bold font-mono flex items-center justify-center shrink-0 text-[10px]">3</span>
                        <span>Buys <strong className="text-cyan-300 font-mono">Differ ≠ {mostAppearing ?? 'Target'}</strong> on 7th digit ➔ settles on <strong className="text-emerald-300 font-bold">8th digit</strong>!</span>
                      </div>
                    </div>

                    {/* Action Bar */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-slate-800/80">
                      <div className="text-xs text-slate-300">
                        Stake: <strong className="text-emerald-400 font-mono">${config.baseStake.toFixed(2)}</strong> | Most Appearing:{' '}
                        <strong className="text-amber-300 font-mono">≠ {mostAppearing ?? 'None yet'}</strong> | Market:{' '}
                        <strong className="text-cyan-300 font-mono">{targetMkt.shortName}</strong>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          disabled={status.isRunning || status.isTradeActive}
                          onClick={() => {
                            systemAutoEngine.resetRangeLongWindow();
                          }}
                          className="px-3.5 py-2 rounded-xl text-xs font-bold uppercase tracking-wider bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 disabled:opacity-50 transition-colors flex items-center gap-1.5"
                        >
                          <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
                          <span>Reset 7-Digit Range</span>
                        </button>

                        <button
                          type="button"
                          disabled={status.isRunning || status.isTradeActive}
                          onClick={() => {
                            const analysis = systemAutoEngine.getRangeLongAnalysis();
                            const targetDigit = analysis.mostAppearingDigit ?? curDigit;
                            systemAutoEngine.executeRangeLongDiffersTrade(
                              targetMkt,
                              targetDigit,
                              analysis.windowDigits.length > 0 ? analysis.windowDigits : [targetDigit],
                              analysis.mostAppearingCount || 1
                            );
                          }}
                          className="px-3.5 py-2 rounded-xl text-xs font-bold uppercase tracking-wider bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 disabled:opacity-50 transition-colors flex items-center gap-1.5"
                        >
                          <Zap className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Fire 1-Tick Differ Test</span>
                        </button>

                        <button
                          onClick={() => {
                            if (status.isRunning) {
                              systemAutoEngine.stopBot('User stopped bot');
                            } else {
                              systemAutoEngine.startBot();
                            }
                          }}
                          className={`flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider transition-all shadow-lg ${
                            status.isRunning
                              ? 'bg-red-600 hover:bg-red-500 text-white shadow-red-600/30 ring-2 ring-red-400 animate-pulse'
                              : 'bg-gradient-to-r from-emerald-500 via-teal-500 to-indigo-500 hover:from-emerald-400 hover:to-indigo-400 text-slate-950 shadow-emerald-500/30 ring-2 ring-emerald-300'
                          }`}
                        >
                          {status.isRunning ? (
                            <>
                              <Square className="w-4 h-4 fill-current" />
                              <span>Stop Bot</span>
                            </>
                          ) : (
                            <>
                              <Play className="w-4 h-4 fill-current" />
                              <span>Run Range Long Differs Bot</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          {/* ⚡ Auto...Last Digit Differ Strategy Card */}
          {config.strategyMode === 'LAST_DIGIT_DIFFER' && (
            <div className="rounded-2xl bg-gradient-to-br from-slate-900 via-emerald-950/25 to-slate-950 border border-emerald-500/40 p-5 shadow-2xl shadow-emerald-500/10 space-y-5">
              {/* Strategy Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-emerald-500/20 pb-3">
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-2xl bg-gradient-to-tr from-emerald-500 via-teal-500 to-cyan-500 text-slate-950 shadow-lg shadow-emerald-500/30">
                    <Zap className="w-6 h-6 fill-current" />
                  </div>
                  <div>
                    <h3 className="text-base font-black uppercase tracking-wider text-white flex items-center gap-2">
                      Auto..Last Digit Differ Bot
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-mono">
                        IMMEDIATE LAST DIGIT SNIPER • 1-TICK DURATION
                      </span>
                    </h3>
                    <p className="text-xs text-slate-300">
                      Select your target market (e.g. <strong className="text-emerald-400">Volatility 25 Index</strong>). Once you click <strong className="text-emerald-400">RUN BOT</strong>, the bot selects the immediate digit of the market and trades Differ ≠ [immediate digit]. The next digit generated settles the trade!
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-bold px-3 py-1 rounded-xl bg-slate-950 border border-emerald-500/40 text-emerald-300 shadow-inner">
                    DURATION: 1 TICK
                  </span>
                  <span className="text-xs font-mono font-bold px-3 py-1 rounded-xl bg-slate-950 border border-cyan-500/40 text-cyan-300 shadow-inner">
                    WIN RATE: 90.9%
                  </span>
                </div>
              </div>

              {(() => {
                const targetSym = config.lastDigitDifferMarketSymbol || 'R_25';
                const targetMkt = ASCENDING_VOLATILITY_MARKETS.find((m) => m.symbol === targetSym) || ASCENDING_VOLATILITY_MARKETS[0];
                const live = marketStates.get(targetSym);
                const immediateDigit = live ? live.lastDigit : 0;

                return (
                  <div className="space-y-4">
                    {/* Contract Details */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="p-3.5 rounded-xl bg-slate-900/90 border border-emerald-500/30 flex flex-col justify-center">
                        <span className="text-[10px] uppercase text-slate-400 font-bold tracking-wider">Immediate Differ Contract</span>
                        <div className="text-xl font-black font-mono text-emerald-300 mt-1">
                          Buy Differ ≠ [{immediateDigit}] on {targetMkt.shortName}
                        </div>
                        <p className="text-[11px] text-slate-400 mt-1 leading-tight">
                          Once RUN is clicked, bot purchases <strong className="text-emerald-400 font-mono">Differ ≠ {immediateDigit}</strong> on {targetMkt.shortName} with 1-tick settlement.
                        </p>
                      </div>

                      <div className="p-3.5 rounded-xl bg-slate-900/90 border border-emerald-500/30 flex flex-col justify-center">
                        <span className="text-[10px] uppercase text-slate-400 font-bold tracking-wider">1-Tick Settlement Rule</span>
                        <div className="text-sm font-black text-cyan-300 mt-1 flex items-center gap-1.5">
                          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                          <span>Next Digit ≠ {immediateDigit} ➔ WIN</span>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-1 leading-tight">
                          The next generated digit settles the trade immediately. Trade wins if next digit is not {immediateDigit}!
                        </p>
                      </div>
                    </div>

                    {/* How It Operates Explainer */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2 border-t border-slate-800/80 text-[11px] text-slate-400">
                      <div className="flex items-start gap-2">
                        <span className="w-4 h-4 rounded-full bg-emerald-500/20 text-emerald-300 font-bold font-mono flex items-center justify-center shrink-0 text-[10px]">A</span>
                        <span>Select market like <strong className="text-emerald-300 font-mono">Volatility 25 Index</strong></span>
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="w-4 h-4 rounded-full bg-emerald-500/20 text-emerald-300 font-bold font-mono flex items-center justify-center shrink-0 text-[10px]">B</span>
                        <span>Click <strong className="text-emerald-400 font-bold">RUN</strong> ➔ Bot captures current digit and trades <strong className="text-emerald-300 font-mono">Differ ≠ [current digit]</strong></span>
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="w-4 h-4 rounded-full bg-emerald-500/20 text-emerald-300 font-bold font-mono flex items-center justify-center shrink-0 text-[10px]">C</span>
                        <span>The next digit generated settles the trade with <strong className="text-cyan-300 font-bold">1-tick duration</strong> (wins 90.9% of time)</span>
                      </div>
                    </div>

                    {/* Action Bar */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
                      <div className="text-xs text-slate-300">
                        Stake: <strong className="text-emerald-400 font-mono">${config.baseStake.toFixed(2)}</strong> | Duration:{' '}
                        <strong className="text-cyan-300 font-mono">1 Tick</strong> | Market:{' '}
                        <strong className="text-emerald-300 font-mono">{targetMkt.shortName}</strong>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          disabled={status.isRunning || status.isTradeActive}
                          onClick={() => {
                            systemAutoEngine.selectLastDigitDifferMarket(targetSym);
                            systemAutoEngine.triggerManualDoubleDiffer(targetSym, immediateDigit);
                          }}
                          className="px-3.5 py-2 rounded-xl text-xs font-bold uppercase tracking-wider bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 disabled:opacity-50 transition-colors flex items-center gap-1.5"
                        >
                          <Zap className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Fire 1-Tick Differ Test</span>
                        </button>

                        <button
                          onClick={() => {
                            if (status.isRunning) {
                              systemAutoEngine.stopBot('User stopped bot');
                            } else {
                              systemAutoEngine.startBot();
                            }
                          }}
                          className={`flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider transition-all shadow-lg ${
                            status.isRunning
                              ? 'bg-red-600 hover:bg-red-500 text-white shadow-red-600/30 ring-2 ring-red-400 animate-pulse'
                              : 'bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-slate-950 shadow-emerald-500/30 ring-2 ring-emerald-300'
                          }`}
                        >
                          {status.isRunning ? (
                            <>
                              <Square className="w-4 h-4 fill-current" />
                              <span>Stop Bot</span>
                            </>
                          ) : (
                            <>
                              <Play className="w-4 h-4 fill-current" />
                              <span>Run Last Digit Differ Bot</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          {/* 🎯 Auto...Digit Select Differ Strategy Card */}
          {config.strategyMode === 'DIGIT_SELECT_DIFFER' && (
            <div className="rounded-2xl bg-gradient-to-br from-slate-900 via-rose-950/25 to-slate-950 border border-rose-500/40 p-5 shadow-2xl shadow-rose-500/10 space-y-5">
              {/* Strategy Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-rose-500/20 pb-3">
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-2xl bg-gradient-to-tr from-rose-500 via-pink-600 to-fuchsia-600 text-white shadow-lg shadow-rose-500/30">
                    <Crosshair className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-base font-black uppercase tracking-wider text-white flex items-center gap-2">
                      Auto...Digit Select Differ
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40 font-mono">
                        IMMEDIATE 1-TICK EXECUTION
                      </span>
                    </h3>
                    <p className="text-xs text-slate-300">
                      Select which digit you want to differ, select which volatility to trade, then click <strong className="text-rose-400">RUN BOT</strong> for immediate contract execution.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-bold px-3 py-1 rounded-xl bg-slate-950 border border-rose-500/40 text-rose-300 shadow-inner">
                    DIFFER ≠ {config.digitSelectTargetDigit ?? 5}
                  </span>
                  <span className="text-xs font-mono font-bold px-3 py-1 rounded-xl bg-slate-950 border border-emerald-500/40 text-emerald-300 shadow-inner">
                    {ASCENDING_VOLATILITY_MARKETS.find((m) => m.symbol === (config.digitSelectVolatilitySymbol || 'R_100'))?.shortName || 'Vol 100'}
                  </span>
                </div>
              </div>

              {/* PART 1: SELECT WHICH DIGIT YOU WANT TO DIFFER */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold uppercase tracking-wider text-rose-300 flex items-center gap-1.5">
                    <span className="flex items-center justify-center w-5 h-5 rounded-full bg-rose-500 text-slate-950 font-black text-[11px]">
                      1
                    </span>
                    <span>Select Which Digit You Want To Differ (≠ Digit)</span>
                  </label>
                  <span className="text-[11px] font-mono text-slate-400">
                    Active Differ Target: <strong className="text-rose-400 text-xs">≠ {config.digitSelectTargetDigit ?? 5}</strong>
                  </span>
                </div>

                {/* Digit Buttons 0 through 9 */}
                <div className="grid grid-cols-5 sm:grid-cols-10 gap-2">
                  {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((digit) => {
                    const isSelected = (config.digitSelectTargetDigit ?? 5) === digit;
                    return (
                      <button
                        key={digit}
                        type="button"
                        disabled={status.isRunning}
                        onClick={() => {
                          systemAutoEngine.selectDigitSelectTargetDigit(digit);
                          handleConfigChange({ digitSelectTargetDigit: digit });
                        }}
                        className={`group relative flex flex-col items-center justify-center py-2.5 px-2 rounded-xl transition-all font-mono ${
                          isSelected
                            ? 'bg-gradient-to-b from-rose-500 to-pink-600 text-white font-black shadow-lg shadow-rose-500/40 ring-2 ring-rose-300 scale-105'
                            : 'bg-slate-950 hover:bg-slate-800 text-slate-300 border border-slate-800 hover:border-rose-500/50 disabled:opacity-50'
                        }`}
                      >
                        <span className="text-lg font-black">{digit}</span>
                        <span className={`text-[9px] uppercase tracking-wider ${isSelected ? 'text-rose-100 font-bold' : 'text-slate-500 group-hover:text-rose-400'}`}>
                          {isSelected ? '≠ SELECTED' : `DIFF ≠${digit}`}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Win / Loss Probability Helper */}
                <div className="p-3 rounded-xl bg-slate-950/90 border border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span className="text-slate-300">
                      <strong className="text-emerald-400 font-bold">Winning Digits (90.9%):</strong>{' '}
                      <span className="font-mono text-emerald-300">
                        [{[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].filter((d) => d !== (config.digitSelectTargetDigit ?? 5)).join(', ')}]
                      </span>
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                    <span className="text-slate-300">
                      <strong className="text-rose-400 font-bold">Losing Digit:</strong>{' '}
                      <span className="font-mono text-rose-400 font-bold">[{config.digitSelectTargetDigit ?? 5}]</span>
                    </span>
                  </div>
                </div>
              </div>



              {/* PART 3: IMMEDIATE EXECUTION & WIN RULE SUMMARY */}
              <div className="p-4 rounded-xl bg-gradient-to-r from-slate-950 via-rose-950/30 to-slate-950 border border-rose-500/40 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-rose-500/20 pb-2.5">
                  <div className="flex items-center gap-2">
                    <Zap className="w-4 h-4 text-rose-400 animate-pulse" />
                    <span className="text-xs font-bold uppercase tracking-wider text-white">
                      Immediate Execution & Win Rule Confirmation
                    </span>
                  </div>
                  <span className="text-[11px] font-mono text-emerald-300 font-bold bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/30">
                    Duration: 1 Tick (Immediate Settlement)
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                  <div className="p-2.5 rounded-lg bg-slate-900/90 border border-slate-800">
                    <span className="text-[10px] uppercase text-slate-500 block font-semibold">1. Differ Selection</span>
                    <p className="font-bold text-slate-200 mt-0.5">
                      Target Digit: <span className="font-mono text-rose-400 text-sm">≠ {config.digitSelectTargetDigit ?? 5}</span>
                    </p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      You selected digit <strong className="text-rose-300">{config.digitSelectTargetDigit ?? 5}</strong> to differ.
                    </p>
                  </div>

                  <div className="p-2.5 rounded-lg bg-slate-900/90 border border-slate-800">
                    <span className="text-[10px] uppercase text-slate-500 block font-semibold">2. Market Target</span>
                    <p className="font-bold text-slate-200 mt-0.5">
                      Trading: <span className="font-mono text-emerald-400">{ASCENDING_VOLATILITY_MARKETS.find((m) => m.symbol === (config.digitSelectVolatilitySymbol || 'R_100'))?.name || 'Volatility 100 Index'}</span>
                    </p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Contract purchased on this exact volatility index.
                    </p>
                  </div>

                  <div className="p-2.5 rounded-lg bg-slate-900/90 border border-slate-800">
                    <span className="text-[10px] uppercase text-slate-500 block font-semibold">3. Win Condition</span>
                    <p className="font-bold text-emerald-300 mt-0.5 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      Immediate Next Digit ≠ {config.digitSelectTargetDigit ?? 5}
                    </p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Trade wins if the immediate digit in the volatility is not {config.digitSelectTargetDigit ?? 5}!
                    </p>
                  </div>
                </div>

                {/* Instant Action CTA */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
                  <div className="text-xs text-slate-300">
                    Stake: <strong className="text-emerald-400 font-mono">${config.baseStake.toFixed(2)}</strong> | Duration:{' '}
                    <strong className="text-cyan-300 font-mono">1 Tick</strong> | Status:{' '}
                    <strong className={status.isRunning ? 'text-amber-400' : 'text-slate-400'}>
                      {status.isRunning ? 'RUNNING ⚡' : 'READY TO RUN'}
                    </strong>
                  </div>

                  <button
                    onClick={() => {
                      if (status.isRunning) {
                        systemAutoEngine.stopBot('User stopped bot');
                      } else {
                        systemAutoEngine.startBot();
                      }
                    }}
                    className={`flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider transition-all shadow-lg ${
                      status.isRunning
                        ? 'bg-red-600 hover:bg-red-500 text-white shadow-red-600/30 ring-2 ring-red-400 animate-pulse'
                        : 'bg-gradient-to-r from-rose-500 via-pink-600 to-fuchsia-600 hover:from-rose-400 hover:to-pink-500 text-white shadow-rose-500/30 ring-2 ring-rose-400'
                    }`}
                  >
                    {status.isRunning ? (
                      <>
                        <Square className="w-4 h-4 fill-current" />
                        <span>Stop Bot</span>
                      </>
                    ) : (
                      <>
                        <Play className="w-4 h-4 fill-current" />
                        <span>Run Bot (Immediate Differ ≠ {config.digitSelectTargetDigit ?? 5})</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 👑 Auto... Master Double [1] Strategy Card */}
          {config.strategyMode === 'MASTER_DOUBLE' && (
            <div className="rounded-2xl bg-gradient-to-br from-slate-900 via-purple-950/25 to-slate-950 border border-purple-500/40 p-5 shadow-2xl shadow-purple-500/10 space-y-5">
              {/* Strategy Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-purple-500/20 pb-3">
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-2xl bg-gradient-to-tr from-purple-600 via-violet-600 to-indigo-600 text-white shadow-lg shadow-purple-500/30">
                    <Sparkles className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-base font-black uppercase tracking-wider text-white flex items-center gap-2">
                      Auto..Master Double [1]
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/40 font-mono">
                        ALL TWINS [0..8] ➔ NEXT DIFFER ≠ (d+1)
                      </span>
                    </h3>
                    <p className="text-xs text-slate-300">
                      When two identical digits appear, immediately buy digit differ of the next sequential digit (<span className="font-mono text-purple-300 font-bold">0,0➔≠1 | 1,1➔≠2 | 2,2➔≠3 ... 8,8➔≠9</span>). Automatically trades all twin patterns across all pool markets!
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-bold px-3 py-1 rounded-xl bg-slate-950 border border-purple-500/40 text-purple-300 shadow-inner">
                    DURATION: 1 TICK
                  </span>
                  <span className="text-xs font-mono font-bold px-3 py-1 rounded-xl bg-slate-950 border border-emerald-500/40 text-emerald-300 shadow-inner">
                    WIN RATE: 90.9%
                  </span>
                </div>
              </div>

              {/* Master Double Pattern Matrix */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold uppercase tracking-wider text-purple-300 flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-purple-400" />
                    <span>Master Double [1] Active Pattern Rules (0 to 8 Only)</span>
                  </label>
                  <span className="text-[11px] font-mono text-slate-400">
                    Active detected in pool: <strong className="text-purple-400 font-bold">{activeMasterDoubleCount}</strong>
                  </span>
                </div>

                <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-9 gap-2">
                  {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((twin) => {
                    const target = twin + 1;
                    const matchingMarkets = Array.from(marketStates.entries())
                      .filter(([symbol, state]) => state.hasMasterDoublePattern && state.masterDoubleTwinDigit === twin)
                      .map(([symbol]) => ASCENDING_VOLATILITY_MARKETS.find((m) => m.symbol === symbol)?.shortName || symbol);

                    const isTriggered = matchingMarkets.length > 0;

                    return (
                      <div
                        key={twin}
                        className={`p-2 rounded-xl border text-center transition-all ${
                          isTriggered
                            ? 'bg-gradient-to-b from-purple-600 to-indigo-700 text-white border-purple-300 shadow-lg shadow-purple-500/40 scale-105 ring-2 ring-purple-300'
                            : 'bg-slate-950/90 border-slate-800 text-slate-300 hover:border-purple-500/50'
                        }`}
                      >
                        <div className="text-xs font-mono font-extrabold text-purple-300">
                          [{twin}, {twin}]
                        </div>
                        <div className="text-[10px] font-mono mt-0.5 text-slate-400">➔ Buy Differ</div>
                        <div className={`text-sm font-black font-mono mt-0.5 ${isTriggered ? 'text-white' : 'text-emerald-400'}`}>
                          ≠ {target}
                        </div>
                        {isTriggered && (
                          <div className="mt-1 text-[9px] font-bold text-amber-200 truncate">
                            {matchingMarkets.join(', ')}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Execution Explainer Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 space-y-1">
                  <span className="text-[10px] uppercase text-purple-400 font-bold block">1. Twin Scanner</span>
                  <p className="text-xs font-bold text-slate-200">
                    Dual Last Digits [d, d]
                  </p>
                  <p className="text-[11px] text-slate-400">
                    Bot checks last 2 digits across all volatility markets. Only triggers on twins from 0,0 up to 8,8.
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 space-y-1">
                  <span className="text-[10px] uppercase text-purple-400 font-bold block">2. Immediate Execution</span>
                  <p className="text-xs font-bold text-purple-300">
                    Buy Differ ≠ (d + 1)
                  </p>
                  <p className="text-[11px] text-slate-400">
                    e.g., 0,0 buys Differ 1; 1,1 buys Differ 2; ... 8,8 buys Differ 9. Instant order with 1-tick duration.
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 space-y-1">
                  <span className="text-[10px] uppercase text-purple-400 font-bold block">3. Win Criteria</span>
                  <p className="text-xs font-bold text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Next Digit ≠ (d + 1)
                  </p>
                  <p className="text-[11px] text-slate-400">
                    Trade wins if the immediate next digit is anything other than the forbidden alphabetical successor!
                  </p>
                </div>
              </div>

              {/* Action Bar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
                <div className="text-xs text-slate-300">
                  Stake: <strong className="text-emerald-400 font-mono">${config.baseStake.toFixed(2)}</strong> | Duration:{' '}
                  <strong className="text-cyan-300 font-mono">1 Tick</strong> | Scanning:{' '}
                  <strong className="text-purple-300 font-mono">{activeMarketPool.length} Markets</strong>
                </div>

                <button
                  onClick={() => {
                    if (status.isRunning) {
                      systemAutoEngine.stopBot('User stopped bot');
                    } else {
                      systemAutoEngine.startBot();
                    }
                  }}
                  className={`flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider transition-all shadow-lg ${
                    status.isRunning
                      ? 'bg-red-600 hover:bg-red-500 text-white shadow-red-600/30 ring-2 ring-red-400 animate-pulse'
                      : 'bg-gradient-to-r from-purple-600 via-violet-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white shadow-purple-500/30 ring-2 ring-purple-400'
                  }`}
                >
                  {status.isRunning ? (
                    <>
                      <Square className="w-4 h-4 fill-current" />
                      <span>Stop Bot</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4 fill-current" />
                      <span>Run Master Double [1] Bot</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* 👑 Auto..Master Double [2] Strategy Card (Interactive Pattern Selector) */}
          {config.strategyMode === 'MASTER_DOUBLE_2' && (
            <div className="rounded-2xl bg-gradient-to-br from-slate-900 via-pink-950/25 to-slate-950 border border-pink-500/40 p-5 shadow-2xl shadow-pink-500/10 space-y-5">
              {/* Strategy Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-pink-500/20 pb-3">
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-2xl bg-gradient-to-tr from-pink-600 via-rose-600 to-purple-600 text-white shadow-lg shadow-pink-500/30">
                    <Sparkles className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-base font-black uppercase tracking-wider text-white flex items-center gap-2">
                      Auto..Master Double [2]
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-pink-500/20 text-pink-300 border border-pink-500/40 font-mono">
                        PATTERN SELECTOR • TWIN [d, d] ➔ NEXT DIFFER ≠ (d+1)
                      </span>
                    </h3>
                    <p className="text-xs text-slate-300">
                      Trades the same twin rules as Master Double 1 (<span className="font-mono text-pink-300 font-bold">0,0➔≠1 | 1,1➔≠2 ... 8,8➔≠9</span>), but with <strong className="text-white">Pattern Selection</strong>: selectively choose which pattern(s) to trade!
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-bold px-3 py-1 rounded-xl bg-slate-950 border border-pink-500/40 text-pink-300 shadow-inner">
                    DURATION: 1 TICK
                  </span>
                  <span className="text-xs font-mono font-bold px-3 py-1 rounded-xl bg-slate-950 border border-emerald-500/40 text-emerald-300 shadow-inner">
                    WIN RATE: 90.9%
                  </span>
                </div>
              </div>

              {/* Master Double 2 Pattern Selector Controls */}
              <div className="space-y-3 bg-slate-950/60 p-4 rounded-xl border border-pink-500/30">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <label className="text-xs font-bold uppercase tracking-wider text-pink-300 flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-pink-400" />
                      <span>Select Which Pattern(s) To Trade (0 to 8 Only)</span>
                    </label>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Click any card to toggle ON/OFF. Currently enabled:{' '}
                      <strong className="text-pink-300 font-mono font-bold">
                        {(config.masterDouble2SelectedPatterns ?? [0, 1, 2, 3, 4, 5, 6, 7, 8]).length} of 9 patterns
                      </strong>
                    </p>
                  </div>

                  {/* Preset Buttons */}
                  <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-mono">
                    <button
                      type="button"
                      onClick={() => systemAutoEngine.setMasterDouble2AllPatterns(true)}
                      className="px-2.5 py-1 rounded-lg bg-pink-500/20 hover:bg-pink-500/30 text-pink-300 border border-pink-500/40 transition-colors font-bold"
                    >
                      Select All (0..8)
                    </button>
                    <button
                      type="button"
                      onClick={() => systemAutoEngine.setMasterDouble2AllPatterns(false)}
                      className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
                    >
                      Clear All
                    </button>
                    <button
                      type="button"
                      onClick={() => handleConfigChange({ masterDouble2SelectedPatterns: [0, 2, 4, 6, 8] })}
                      className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
                    >
                      Evens [0,2,4,6,8]
                    </button>
                    <button
                      type="button"
                      onClick={() => handleConfigChange({ masterDouble2SelectedPatterns: [1, 3, 5, 7] })}
                      className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
                    >
                      Odds [1,3,5,7]
                    </button>
                    <button
                      type="button"
                      onClick={() => handleConfigChange({ masterDouble2SelectedPatterns: [0, 1, 2, 3] })}
                      className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
                    >
                      Low [0..3]
                    </button>
                    <button
                      type="button"
                      onClick={() => handleConfigChange({ masterDouble2SelectedPatterns: [5, 6, 7, 8] })}
                      className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
                    >
                      High [5..8]
                    </button>
                  </div>
                </div>

                {/* Pattern Grid Cards with Toggle Switch and Live Detection */}
                <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-9 gap-2 pt-1">
                  {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((twin) => {
                    const target = twin + 1;
                    const selectedPatterns = config.masterDouble2SelectedPatterns ?? [0, 1, 2, 3, 4, 5, 6, 7, 8];
                    const isSelected = selectedPatterns.includes(twin);

                    const matchingMarkets = Array.from(marketStates.entries())
                      .filter(([symbol, state]) => state.hasMasterDoublePattern && state.masterDoubleTwinDigit === twin)
                      .map(([symbol]) => ASCENDING_VOLATILITY_MARKETS.find((m) => m.symbol === symbol)?.shortName || symbol);

                    const isTriggered = matchingMarkets.length > 0;

                    return (
                      <button
                        type="button"
                        key={twin}
                        onClick={() => systemAutoEngine.toggleMasterDouble2Pattern(twin)}
                        className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer flex flex-col items-center justify-between min-h-[110px] select-none ${
                          isSelected && isTriggered
                            ? 'bg-gradient-to-b from-pink-600 to-purple-700 text-white border-pink-300 shadow-lg shadow-pink-500/40 scale-105 ring-2 ring-pink-300'
                            : isSelected
                            ? 'bg-gradient-to-b from-pink-950/40 via-slate-900 to-slate-950 border-pink-500/60 text-slate-200 hover:border-pink-400 ring-1 ring-pink-500/30'
                            : 'bg-slate-950/60 border-slate-800/80 text-slate-500 hover:border-slate-700 opacity-60'
                        }`}
                      >
                        <div className="w-full flex items-center justify-between gap-1 mb-1">
                          <span className={`w-2 h-2 rounded-full ${isSelected ? 'bg-pink-400 ring-2 ring-pink-400/40' : 'bg-slate-700'}`} />
                          <span className={`text-[9px] font-mono font-black uppercase px-1 py-0.2 rounded ${
                            isSelected ? 'bg-pink-500/30 text-pink-300 border border-pink-500/40' : 'bg-slate-800 text-slate-500'
                          }`}>
                            {isSelected ? 'ARMED' : 'OFF'}
                          </span>
                        </div>

                        <div className={`text-sm font-mono font-black ${isSelected ? 'text-pink-300' : 'text-slate-500'}`}>
                          [{twin}, {twin}]
                        </div>

                        <div className="text-[10px] font-mono text-slate-400">
                          ➔ Differ
                        </div>

                        <div className={`text-base font-black font-mono ${
                          isSelected && isTriggered ? 'text-white' : isSelected ? 'text-emerald-400' : 'text-slate-600'
                        }`}>
                          ≠ {target}
                        </div>

                        {isTriggered && (
                          <div className={`mt-1 text-[9px] font-bold truncate max-w-full px-1 py-0.5 rounded ${
                            isSelected ? 'bg-pink-500 text-white animate-pulse' : 'bg-slate-800 text-slate-400'
                          }`}>
                            {isSelected ? `🔥 ${matchingMarkets.join(',')}` : `Skipped (${matchingMarkets.join(',')})`}
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Execution Explainer Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 space-y-1">
                  <span className="text-[10px] uppercase text-pink-400 font-bold block">1. Pattern Filter Scanner</span>
                  <p className="text-xs font-bold text-slate-200">
                    Dual Last Digits [d, d] (Only Selected)
                  </p>
                  <p className="text-[11px] text-slate-400">
                    Bot checks last 2 digits across all volatility markets. Only triggers if twin digit <strong className="text-pink-300 font-mono">d</strong> is in your selected patterns list!
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 space-y-1">
                  <span className="text-[10px] uppercase text-pink-400 font-bold block">2. Immediate Execution</span>
                  <p className="text-xs font-bold text-pink-300">
                    Buy Differ ≠ (d + 1)
                  </p>
                  <p className="text-[11px] text-slate-400">
                    e.g., 0,0 buys Differ 1; 1,1 buys Differ 2; ... 8,8 buys Differ 9. Instant order execution with 1-tick duration.
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 space-y-1">
                  <span className="text-[10px] uppercase text-pink-400 font-bold block">3. Win Criteria</span>
                  <p className="text-xs font-bold text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Next Digit ≠ (d + 1)
                  </p>
                  <p className="text-[11px] text-slate-400">
                    Trade wins if the immediate next digit is anything other than the forbidden alphabetical successor!
                  </p>
                </div>
              </div>

              {/* Action Bar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
                <div className="text-xs text-slate-300">
                  Stake: <strong className="text-emerald-400 font-mono">${config.baseStake.toFixed(2)}</strong> | Duration:{' '}
                  <strong className="text-cyan-300 font-mono">1 Tick</strong> | Selected Patterns:{' '}
                  <strong className="text-pink-300 font-mono">
                    {(config.masterDouble2SelectedPatterns ?? [0, 1, 2, 3, 4, 5, 6, 7, 8]).length} of 9 Enabled
                  </strong>
                </div>

                <button
                  onClick={() => {
                    if (status.isRunning) {
                      systemAutoEngine.stopBot('User stopped bot');
                    } else {
                      systemAutoEngine.startBot();
                    }
                  }}
                  className={`flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider transition-all shadow-lg ${
                    status.isRunning
                      ? 'bg-red-600 hover:bg-red-500 text-white shadow-red-600/30 ring-2 ring-red-400 animate-pulse'
                      : 'bg-gradient-to-r from-pink-600 via-rose-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 text-white shadow-pink-500/30 ring-2 ring-pink-400'
                  }`}
                >
                  {status.isRunning ? (
                    <>
                      <Square className="w-4 h-4 fill-current" />
                      <span>Stop Bot</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4 fill-current" />
                      <span>Run Master Double [2] Bot</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* ✨ Auto Double Bot [x, x, y] Strategy Card */}
          {config.strategyMode === 'DOUBLE_BOT_1TICK' && (
            <div className="rounded-2xl bg-gradient-to-br from-slate-900 via-amber-950/20 to-slate-950 border border-amber-500/40 p-5 shadow-2xl shadow-amber-500/10 space-y-4">
              {/* Strategy Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-amber-500/20 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-2.5 rounded-xl bg-gradient-to-tr from-amber-500 via-yellow-500 to-orange-500 text-slate-950 shadow-lg shadow-amber-500/30">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black uppercase tracking-wider text-white flex items-center gap-2">
                      Auto Double Bot [x, x, y] Scanner
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 font-mono">
                        DIGITDIFF • 1-Tick Settle • Multi-Market
                      </span>
                    </h3>
                    <p className="text-xs text-slate-300">
                      Scans all markets simultaneously. When pattern <strong className="text-amber-400 font-mono">[x, x, y]</strong> is detected, buys <strong className="text-emerald-400 font-mono">Differ ≠ y</strong> and the very next tick settles.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-lg bg-slate-950 border border-amber-500/40 text-amber-300">
                    ALL-MARKETS PARALLEL
                  </span>
                </div>
              </div>

              {/* Strategy Configuration Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="p-3 rounded-xl bg-slate-950/90 border border-slate-800">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Contract</span>
                  <span className="font-mono text-xs font-black text-amber-400">DIGITDIFF</span>
                </div>
                <div className="p-3 rounded-xl bg-slate-950/90 border border-slate-800">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Pattern</span>
                  <span className="font-mono text-xs font-black text-yellow-400">[x, x, y] (Twin + Differ)</span>
                </div>
                <div className="p-3 rounded-xl bg-slate-950/90 border border-slate-800">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Action</span>
                  <span className="font-mono text-xs font-black text-emerald-400">Buy Differ ≠ y</span>
                </div>
                <div className="p-3 rounded-xl bg-slate-950/90 border border-slate-800">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Settlement</span>
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono text-xs font-black text-cyan-400">{config.durationTicks} Tick (Next Digit)</span>
                    <div className="flex gap-1">
                      {[1, 2].map((t) => (
                        <button
                          key={t}
                          disabled={status.isRunning}
                          onClick={() => handleConfigChange({ durationTicks: t })}
                          className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold ${
                            config.durationTicks === t ? 'bg-amber-500 text-slate-950' : 'bg-slate-900 text-slate-400'
                          }`}
                        >
                          {t}t
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Practical Scenarios */}
              <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-slate-300 uppercase tracking-wider">
                  <span className="flex items-center gap-1.5 text-amber-300">
                    <Info className="w-3.5 h-3.5" />
                    <span>How Auto Double Bot Operates</span>
                  </span>
                  <span className="text-[10px] font-mono text-emerald-400 font-bold bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-500/30">
                    ~90.9% Theoretical Win Probability
                  </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 text-xs">
                  <div className="p-2.5 rounded-lg bg-slate-900/90 border border-slate-800">
                    <div className="text-[10px] text-amber-400 uppercase font-bold mb-1 flex items-center gap-1">
                      <span>Example 1: Pattern 3, 3, 4</span>
                    </div>
                    <div className="text-slate-300 leading-relaxed">
                      Market stream ends with <span className="font-mono font-bold text-yellow-300">...3, 3, 4</span>. Bot instantly purchases <strong className="text-emerald-400 font-mono">DIGITDIFF ≠ 4</strong>. The very next digit settles the trade: if exit is 0, 1, 2, 3, 5, 6, 7, 8, or 9 ➔ <span className="text-emerald-400 font-bold">WIN (+9.8%)</span>.
                    </div>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-900/90 border border-slate-800">
                    <div className="text-[10px] text-orange-400 uppercase font-bold mb-1 flex items-center gap-1">
                      <span>Example 2: Pattern 5, 5, 6</span>
                    </div>
                    <div className="text-slate-300 leading-relaxed">
                      Market stream ends with <span className="font-mono font-bold text-orange-300">...5, 5, 6</span>. Bot instantly purchases <strong className="text-emerald-400 font-mono">DIGITDIFF ≠ 6</strong>. The very next digit settles the trade: if exit is 0, 1, 2, 3, 4, 5, 7, 8, or 9 ➔ <span className="text-emerald-400 font-bold">WIN (+9.8%)</span>.
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ⚡ Polar Twin [0,0 & 9,9] Strategy Card */}
          {config.strategyMode === 'TWIN_0_AND_9_DIFFER' && (
            <div className="rounded-2xl bg-gradient-to-br from-slate-900 via-cyan-950/20 to-slate-950 border border-cyan-500/40 p-5 shadow-2xl shadow-cyan-500/10 space-y-4">
              {/* Strategy Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-cyan-500/20 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-2.5 rounded-xl bg-gradient-to-tr from-cyan-500 to-blue-600 text-white shadow-lg shadow-cyan-500/30">
                    <Zap className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black uppercase tracking-wider text-white flex items-center gap-2">
                      Polar Twin [0,0 & 9,9] Scanner
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-mono">
                        DIGITDIFF • All Markets
                      </span>
                    </h3>
                    <p className="text-xs text-slate-300">
                      Scans all markets simultaneously. When it detects <strong className="text-cyan-400 font-mono">[9, 9]</strong> buys <strong className="text-emerald-400 font-mono">Differ ≠ 9</strong>. When it detects <strong className="text-amber-400 font-mono">[0, 0]</strong> buys <strong className="text-emerald-400 font-mono">Differ ≠ 0</strong>.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-lg bg-slate-950 border border-cyan-500/40 text-cyan-300">
                    SIMULTANEOUS SCANNER
                  </span>
                </div>
              </div>

              {/* Strategy Configuration Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="p-3 rounded-xl bg-slate-950/90 border border-slate-800">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Contract</span>
                  <span className="font-mono text-xs font-black text-cyan-400">DIGITDIFF</span>
                </div>
                <div className="p-3 rounded-xl bg-slate-950/90 border border-slate-800">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Trigger A</span>
                  <span className="font-mono text-xs font-black text-amber-400">[0, 0] ➔ Buy Differ ≠ 0</span>
                </div>
                <div className="p-3 rounded-xl bg-slate-950/90 border border-slate-800">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Trigger B</span>
                  <span className="font-mono text-xs font-black text-cyan-400">[9, 9] ➔ Buy Differ ≠ 9</span>
                </div>
                <div className="p-3 rounded-xl bg-slate-950/90 border border-slate-800">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Duration</span>
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono text-xs font-black text-emerald-400">{config.durationTicks} Tick{config.durationTicks > 1 ? 's' : ''}</span>
                    <div className="flex gap-1">
                      {[1, 2].map((t) => (
                        <button
                          key={t}
                          disabled={status.isRunning}
                          onClick={() => handleConfigChange({ durationTicks: t })}
                          className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold ${
                            config.durationTicks === t ? 'bg-cyan-500 text-slate-950' : 'bg-slate-900 text-slate-400'
                          }`}
                        >
                          {t}t
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Practical Scenarios */}
              <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-slate-300 uppercase tracking-wider">
                  <span className="flex items-center gap-1.5 text-cyan-300">
                    <Info className="w-3.5 h-3.5" />
                    <span>How Polar Twin Differ Operates</span>
                  </span>
                  <span className="text-[10px] font-mono text-emerald-400 font-bold bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-500/30">
                    90% Theoretical Probability Per Trade
                  </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 text-xs">
                  <div className="p-2.5 rounded-lg bg-slate-900/90 border border-slate-800">
                    <div className="text-[10px] text-cyan-400 uppercase font-bold mb-1 flex items-center gap-1">
                      <span>Pattern 1: Twin 9,9 Detected</span>
                    </div>
                    <div className="text-slate-300 leading-relaxed">
                      Market streams <span className="font-mono font-bold text-cyan-300">...9, 9</span>. System immediately buys <strong className="text-emerald-400 font-mono">DIGITDIFF ≠ 9</strong>. If exit digit is 0, 1, 2, 3, 4, 5, 6, 7, or 8 ➔ <span className="text-emerald-400 font-bold">WIN (+9.8%)</span>.
                    </div>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-900/90 border border-slate-800">
                    <div className="text-[10px] text-amber-400 uppercase font-bold mb-1 flex items-center gap-1">
                      <span>Pattern 2: Twin 0,0 Detected</span>
                    </div>
                    <div className="text-slate-300 leading-relaxed">
                      Market streams <span className="font-mono font-bold text-amber-300">...0, 0</span>. System immediately buys <strong className="text-emerald-400 font-mono">DIGITDIFF ≠ 0</strong>. If exit digit is 1, 2, 3, 4, 5, 6, 7, 8, or 9 ➔ <span className="text-emerald-400 font-bold">WIN (+9.8%)</span>.
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 🔀 Alternating Digits Strategy & Rule Conditions Specifications */}
          {config.strategyMode === 'ALTERNATING_DIGITS' && (
            <div className="rounded-2xl bg-gradient-to-br from-slate-900 via-fuchsia-950/20 to-slate-950 border border-fuchsia-500/40 p-5 shadow-2xl shadow-fuchsia-500/10 space-y-4">
              {/* Strategy Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-fuchsia-500/20 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-2.5 rounded-xl bg-gradient-to-tr from-fuchsia-600 to-violet-600 text-white shadow-lg shadow-fuchsia-500/30">
                    <Shuffle className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black uppercase tracking-wider text-white flex items-center gap-2">
                      Alternating Digits Strategy
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-fuchsia-500/20 text-fuchsia-300 border border-fuchsia-500/40 font-mono">
                        DIGITDIFF • 1 Tick
                      </span>
                    </h3>
                    <p className="text-xs text-slate-300">
                      Trades <strong className="text-fuchsia-400">DIGITDIFF</strong> when two consecutive digits are different and the pattern matches Alternating Odd/Even.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-lg bg-slate-950 border border-fuchsia-500/40 text-fuchsia-300">
                    Rule 1: ACTIVE
                  </span>
                </div>
              </div>

              {/* Strategy Configuration Grid (Overview, Contract, Duration, Indicator, Cooldown, Target) */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                <div className="p-3 rounded-xl bg-slate-950/90 border border-slate-800">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Contract</span>
                  <span className="font-mono text-xs font-black text-fuchsia-400">DIGITDIFF</span>
                </div>
                <div className="p-3 rounded-xl bg-slate-950/90 border border-slate-800">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Duration</span>
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono text-xs font-black text-cyan-400">{config.durationTicks} Tick{config.durationTicks > 1 ? 's' : ''}</span>
                    <div className="flex gap-1">
                      {[1, 2].map((t) => (
                        <button
                          key={t}
                          disabled={status.isRunning}
                          onClick={() => handleConfigChange({ durationTicks: t })}
                          className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold ${
                            config.durationTicks === t ? 'bg-cyan-500 text-slate-950' : 'bg-slate-900 text-slate-400'
                          }`}
                        >
                          {t}t
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-slate-950/90 border border-slate-800">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Indicator</span>
                  <span className="font-mono text-xs font-bold text-slate-300">N/A (Tick Stream)</span>
                </div>
                <div className="p-3 rounded-xl bg-slate-950/90 border border-slate-800">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Cooldown</span>
                  <div className="flex items-center gap-1">
                    <span className="font-mono text-xs font-black text-violet-400">{config.alternatingCooldownSec ?? 5}s</span>
                    <div className="flex gap-0.5">
                      {[3, 5, 10].map((s) => (
                        <button
                          key={s}
                          disabled={status.isRunning}
                          onClick={() => handleConfigChange({ alternatingCooldownSec: s })}
                          className={`px-1 py-0.5 rounded text-[9px] font-mono font-bold ${
                            (config.alternatingCooldownSec ?? 5) === s ? 'bg-violet-500 text-white' : 'bg-slate-900 text-slate-400'
                          }`}
                        >
                          {s}s
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-slate-950/90 border border-slate-800 col-span-2 sm:col-span-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Target Digit</span>
                  <div className="flex items-center gap-1">
                    <span className="font-mono text-xs font-black text-amber-400">≠ {config.alternatingTargetDigit ?? 5}</span>
                    <select
                      disabled={status.isRunning}
                      value={config.alternatingTargetDigit ?? 5}
                      onChange={(e) => handleConfigChange({ alternatingTargetDigit: Number(e.target.value) })}
                      className="bg-slate-900 border border-slate-700 text-amber-400 font-mono font-bold text-xs rounded px-1.5 py-0.5 focus:outline-none"
                    >
                      {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => (
                        <option key={d} value={d}>
                          ≠ {d}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Practical Example */}
              <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-slate-300 uppercase tracking-wider">
                  <span className="flex items-center gap-1.5 text-fuchsia-300">
                    <Info className="w-3.5 h-3.5" />
                    <span>Practical Example</span>
                  </span>
                  <span className="text-[10px] font-mono text-emerald-400 font-bold bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-500/30">
                    [✓ CHECK] Trade Digit Differs (1 tick) Target Digit {config.alternatingTargetDigit ?? 5}
                  </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 text-xs">
                  <div className="p-2.5 rounded-lg bg-slate-900/90 border border-slate-800">
                    <div className="text-[10px] text-slate-400 uppercase font-semibold mb-1">Scenario</div>
                    <div className="text-slate-200 font-mono">
                      Last 3 digits: <span className="text-amber-300 font-bold">Odd-Even-Odd</span> (e.g. 7, 4, 1) or <span className="text-cyan-300 font-bold">Even-Odd-Even</span> (e.g. 8, 3, 2).
                    </div>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-900/90 border border-slate-800">
                    <div className="text-[10px] text-slate-400 uppercase font-semibold mb-1">Analysis</div>
                    <div className="text-slate-200">
                      Alternating pattern detected — next tick likely to continue or break pattern.
                    </div>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-900/90 border border-slate-800">
                    <div className="text-[10px] text-slate-400 uppercase font-semibold mb-1">Result</div>
                    <div className="text-emerald-400 font-semibold">
                      Buys <strong className="font-mono">DIGITDIFF ≠ {config.alternatingTargetDigit ?? 5}</strong> on 1st tick. 5s cooldown starts immediately upon settlement.
                    </div>
                  </div>
                </div>
              </div>

              {/* Rule Conditions Matrix */}
              <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-fuchsia-400" />
                    <span>Rule Conditions Matrix</span>
                  </div>
                  <button
                    disabled
                    className="text-[10px] font-bold px-2 py-1 rounded bg-slate-900 text-slate-500 border border-slate-800 flex items-center gap-1 cursor-not-allowed"
                    title="Rule condition slot active"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Add Condition</span>
                  </button>
                </div>

                {/* Condition 1 */}
                <div className="p-3 rounded-lg bg-slate-900/90 border border-fuchsia-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded-full bg-fuchsia-500/20 text-fuchsia-400 flex items-center justify-center text-[10px] font-mono font-bold border border-fuchsia-500/40">
                      1
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-400 uppercase font-semibold">Condition 1 Type</div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <select
                          disabled={status.isRunning}
                          value="Alternating Odd/Even"
                          onChange={() => {}}
                          className="bg-slate-950 border border-fuchsia-500/50 rounded-lg px-2 py-1 text-xs font-bold text-fuchsia-300 focus:outline-none"
                        >
                          <option value="Alternating Odd/Even">Alternating Odd/Even (Active)</option>
                          <option value="Consecutive Digits (e.g., 7,7,7)">Consecutive Digits (e.g., 7,7,7)</option>
                          <option value="Consecutive Odd/Even">Consecutive Odd/Even</option>
                          <option value="Digit Over (greater than)">Digit Over (greater than)</option>
                          <option value="Digit Under (less than)">Digit Under (less than)</option>
                          <option value="Digit Equals">Digit Equals</option>
                          <option value="Digit Sum">Digit Sum</option>
                          <option value="Digit Frequency">Digit Frequency</option>
                          <option value="Fibonacci Sequence">Fibonacci Sequence</option>
                          <option value="Prime Number">Prime Number</option>
                          <option value="Extreme High/Low">Extreme High/Low</option>
                          <option value="Tick Direction">Tick Direction</option>
                          <option value="Price Spike">Price Spike</option>
                          <option value="Tick Movement Pattern (UP/DOWN)">Tick Movement Pattern (UP/DOWN)</option>
                          <option value="Moving Average (MA)">Moving Average (MA)</option>
                          <option value="Exponential MA (EMA)">Exponential MA (EMA)</option>
                          <option value="RSI (Relative Strength Index)">RSI (Relative Strength Index)</option>
                          <option value="Bollinger Bands">Bollinger Bands</option>
                          <option value="MACD Crossover">MACD Crossover</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 text-xs">
                    <div>
                      <span className="text-[10px] text-slate-400 block">Pattern Length</span>
                      <div className="flex items-center gap-1 mt-0.5">
                        {[2, 3, 4].map((len) => (
                          <button
                            key={len}
                            disabled={status.isRunning}
                            onClick={() => handleConfigChange({ alternatingPatternLength: len })}
                            className={`px-2 py-0.5 rounded text-[11px] font-mono font-bold transition-all ${
                              (config.alternatingPatternLength ?? 3) === len
                                ? 'bg-fuchsia-500 text-white shadow-sm'
                                : 'bg-slate-950 text-slate-400 border border-slate-800'
                            }`}
                          >
                            {len}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="p-2 rounded bg-slate-950 border border-slate-800 text-[11px] font-mono">
                      <span className="text-slate-400">Consecutive Differs: </span>
                      <strong className="text-emerald-400">d[n] ≠ d[n-1]</strong>
                    </div>

                    <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-bold bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/30">
                      <Check className="w-3.5 h-3.5" />
                      <span>Rule Verified</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

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

              {/* 🎯 Target Volatility Market Note */}
              <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2.5 text-slate-300">
                  <div className="p-2 rounded-lg bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
                    <Target className="w-4 h-4 shrink-0" />
                  </div>
                  <div>
                    <span className="text-white font-bold block">Live Volatility Market</span>
                    <span className="text-slate-400 text-[11px]">
                      Selected directly in the <strong>Live Volatility Market, Scanner Feed & Match Detector</strong> panel above.
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-cyan-300 font-bold px-3 py-1 rounded-lg bg-cyan-950/80 border border-cyan-500/40 text-xs">
                    {ASCENDING_VOLATILITY_MARKETS.find((m) => m.symbol === currentActiveMarketSymbol)?.name || 'Volatility 100 Index'} ({ASCENDING_VOLATILITY_MARKETS.find((m) => m.symbol === currentActiveMarketSymbol)?.shortName})
                  </span>
                </div>
              </div>
            </div>

            {/* 🎯 Single Trade Sequential Mode ("1 Trade ➔ Wait for Close ➔ Scan Again") */}
            <div className="rounded-2xl bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 border-2 border-amber-500/30 p-4 shadow-lg space-y-3.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
                    <Crosshair className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-xs font-black uppercase tracking-wider text-white">
                        Single Trade Mode (1 Trade & Wait for Close)
                      </h4>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wide border ${
                        config.singleTradeSequentialMode
                          ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                          : 'bg-slate-800 text-slate-400 border-slate-700'
                      }`}>
                        {config.singleTradeSequentialMode ? 'Active (1-at-a-time)' : 'Continuous Scan'}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Bot takes exactly 1 trade, pauses scanning during execution, waits for contract to close & settle cleanly, then starts scanning the market again.
                    </p>
                  </div>
                </div>
              </div>

              {/* Mode Selection Buttons */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  type="button"
                  disabled={status.isRunning}
                  onClick={() => handleConfigChange({ singleTradeSequentialMode: true })}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    config.singleTradeSequentialMode
                      ? 'bg-amber-500/15 border-amber-400/80 shadow-md shadow-amber-500/10 text-white'
                      : 'bg-slate-950/80 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-300 disabled:opacity-50'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-amber-400" />
                      <span>1 Trade ➔ Wait Close ➔ Scan</span>
                    </span>
                    <span className="text-[10px] font-mono font-bold bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded">
                      Requested
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400 leading-relaxed">
                    Takes 1 trade when pattern appears. Pauses all market scanning while contract is running. Once closed, resets triggers and starts scanning again.
                  </p>
                </button>

                <button
                  type="button"
                  disabled={status.isRunning}
                  onClick={() => handleConfigChange({ singleTradeSequentialMode: false })}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    !config.singleTradeSequentialMode
                      ? 'bg-cyan-500/15 border-cyan-400/80 shadow-md shadow-cyan-500/10 text-white'
                      : 'bg-slate-950/80 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-300 disabled:opacity-50'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-cyan-300 flex items-center gap-1.5">
                      <Zap className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Continuous Fast Scan</span>
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400 leading-relaxed">
                    Immediate continuous trading across markets without waiting for post-close cooldown buffer.
                  </p>
                </button>
              </div>

              {/* Sub-controls when Single Trade Sequential Mode is ON */}
              {config.singleTradeSequentialMode && (
                <div className="pt-2.5 border-t border-slate-800/80 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-amber-400" />
                        <span>Post-Close Scan Delay (Resume Buffer)</span>
                      </label>
                      <span className="text-[10px] text-slate-500 block">
                        Wait period after contract closes before re-enabling live tick scanning
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {[
                        { label: '⚡ 0s (Instant)', val: 0 },
                        { label: '⏳ 1s', val: 1 },
                        { label: '⏳ 2s', val: 2 },
                        { label: '⏳ 3s', val: 3 },
                        { label: '⏳ 5s', val: 5 },
                      ].map((item) => (
                        <button
                          key={item.val}
                          type="button"
                          disabled={status.isRunning}
                          onClick={() => handleConfigChange({ postTradeScanDelaySec: item.val })}
                          className={`px-2 py-1 rounded-lg text-xs font-mono font-bold transition-all border ${
                            (config.postTradeScanDelaySec ?? 1) === item.val
                              ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-sm font-black'
                              : 'bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700 disabled:opacity-50'
                          }`}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80">
                    <div className="flex items-center gap-2">
                      <RefreshCw className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-xs text-slate-300 font-semibold">
                        Require Fresh Patterns After Trade Close
                      </span>
                    </div>
                    <button
                      type="button"
                      disabled={status.isRunning}
                      onClick={() =>
                        handleConfigChange({
                          requireFreshPatternAfterClose: !config.requireFreshPatternAfterClose,
                        })
                      }
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition-all border ${
                        config.requireFreshPatternAfterClose !== false
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 font-bold'
                          : 'bg-slate-900 text-slate-500 border-slate-800'
                      }`}
                    >
                      {config.requireFreshPatternAfterClose !== false ? '✓ Enabled (Fresh Ticks Only)' : 'Off (Accept Prior)'}
                    </button>
                  </div>
                </div>
              )}
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

                {/* Post-Trade Scan Delay Notice */}
                {status.scanPhase === 'POST_TRADE_COOLDOWN' && (
                  <div className="p-3.5 rounded-xl bg-gradient-to-r from-cyan-950/80 via-slate-900 to-amber-950/80 border border-cyan-500/50 shadow-lg shadow-cyan-500/10">
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="flex items-center gap-1.5 font-bold text-cyan-400">
                        <Clock className="w-4 h-4 text-cyan-400 animate-spin" />
                        <span>1 Trade Settled ➔ Scanner Cooldown</span>
                      </span>
                      <span className="font-mono text-xs font-bold text-amber-300">
                        Resuming scan in {status.postTradeCountdownSec ?? 1}s
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-300">
                      Previous trade closed cleanly. Waiting {status.postTradeCountdownSec ?? 1}s before scanning the market again for fresh pattern triggers (1-trade mode).
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

            {/* Stealth Zero-Trace Mode Toggle */}
            <button
              onClick={() => {
                const nextVal = !status.isZeroTraceMode;
                strategyShield.updateConfig({ enableZeroTraceMode: nextVal });
                if (nextVal) {
                  systemAutoEngine.purgeAllTradeHistory();
                }
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold transition-all ${
                status.isZeroTraceMode
                  ? 'bg-indigo-950/80 border-indigo-600 text-indigo-300 shadow-sm'
                  : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
              }`}
              title="When enabled, trade history is never kept in memory or storage so broker dealing desks cannot track your strategy"
            >
              <EyeOff className="w-3.5 h-3.5" />
              <span>{status.isZeroTraceMode ? 'Zero-Trace: ON' : 'Zero-Trace: OFF'}</span>
            </button>

            {/* Instant Purge Strategy Footprint Button */}
            <button
              onClick={() => {
                strategyShield.purgeAllTradeHistoryAndFootprint();
                systemAutoEngine.purgeAllTradeHistory();
              }}
              title="Immediately wipe all local trade history, logs, and strategy footprint across the entire terminal"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-950/70 hover:bg-rose-900 border border-rose-800 text-rose-300 text-xs font-bold transition-all"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Purge Footprint</span>
            </button>
          </div>
        </div>

        {/* Trade Stream Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
                <th className="py-2.5 px-3">Time</th>
                <th className="py-2.5 px-3">Account</th>
                <th className="py-2.5 px-3">Market</th>
                <th className="py-2.5 px-3">Trigger Pattern</th>
                <th className="py-2.5 px-3">Differ Target</th>
                <th className="py-2.5 px-3">Trigger / Entry</th>
                <th className="py-2.5 px-3">Immediate Settle (Next Digit)</th>
                <th className="py-2.5 px-3">Result</th>
                <th className="py-2.5 px-3">Stake</th>
                <th className="py-2.5 px-3 text-right">Profit / Loss</th>
                <th className="py-2.5 px-3 text-right">Cycle</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {filteredTrades.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-8 text-center text-slate-400 font-sans">
                    {status.isZeroTraceMode ? (
                      <div className="flex flex-col items-center justify-center gap-2">
                        <div className="w-10 h-10 rounded-2xl bg-indigo-950 border border-indigo-700/60 flex items-center justify-center text-indigo-400 shadow-md">
                          <EyeOff className="w-5 h-5" />
                        </div>
                        <span className="font-bold text-white text-xs">
                          Stealth Zero-Trace Mode Active
                        </span>
                        <p className="text-[11px] text-slate-400 max-w-md">
                          Trade records are automatically wiped upon settlement to prevent broker dealing-desk profiling. No persistent footprint of your strategies is saved.
                        </p>
                      </div>
                    ) : (
                      'No trades executed in this session yet. Start the bot to begin scanning.'
                    )}
                  </td>
                </tr>
              ) : (
                filteredTrades.map((trade) => {
                  const isWin = trade.result === 'WIN';
                  const isOpen = trade.result === 'OPEN';
                  return (
                    <tr key={trade.id} className="hover:bg-slate-950/40 transition-colors">
                      <td className="py-2.5 px-3 text-slate-400 font-sans text-[11px]">{trade.timeString}</td>
                      <td className="py-2.5 px-3 font-sans">
                        {trade.isVirtual || trade.accountType === 'DEMO' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/40 text-[10px] font-black font-mono">
                            <FlaskConical className="w-3 h-3 text-purple-300" />
                            <span>DEMO</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] font-black font-mono">
                            <Flame className="w-3 h-3 text-amber-400" />
                            <span>REAL</span>
                          </span>
                        )}
                      </td>
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
                          <span className="text-cyan-400 animate-pulse font-sans">
                            Target [{trade.differDigit}] detected
                          </span>
                        ) : trade.intermediateDigit !== null && trade.intermediateDigit !== undefined ? (
                          <span className="font-bold text-amber-300">Digit [{trade.intermediateDigit}]</span>
                        ) : (
                          <span className="font-bold text-amber-300">Digit [{trade.differDigit}]</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-slate-300">
                        {isOpen ? (
                          <span className="text-amber-400 animate-pulse font-sans">
                            {trade.durationTicks === 1 ? 'Immediate next digit settling...' : 'Tick 2 settling...'}
                          </span>
                        ) : (
                          <span className={`font-bold ${isWin ? 'text-emerald-400' : 'text-red-400'}`}>
                            Digit [{trade.exitDigit ?? '---'}]
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 font-sans">
                        {isOpen ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-cyan-500/20 text-cyan-400">
                            {trade.durationTicks === 1 ? 'OPEN (1T)' : 'OPEN (2T)'}
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
                      <td className="py-2.5 px-3 text-slate-300 font-mono">
                        <div>${trade.stake.toFixed(2)}</div>
                        {trade.appliedJitterMs ? (
                          <div className="text-[9px] text-teal-400 font-sans font-semibold">
                            +{trade.appliedJitterMs}ms jitter
                          </div>
                        ) : null}
                        {trade.fuzzedStakeDiff && trade.fuzzedStakeDiff !== 0 ? (
                          <div className="text-[9px] text-amber-400 font-sans">
                            fuzzed {trade.fuzzedStakeDiff > 0 ? '+' : ''}{trade.fuzzedStakeDiff.toFixed(2)}
                          </div>
                        ) : null}
                      </td>
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
