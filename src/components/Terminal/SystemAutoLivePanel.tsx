import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Zap,
  Play,
  Square,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Clock,
  CheckCircle2,
  Target,
  Crosshair,
  XCircle,
  AlertTriangle,
  Sliders,
  DollarSign,
  Percent,
  Radio,
  Layers,
  Sparkles,
  Download,
  Info,
  ChevronRight,
  ShieldCheck,
  Activity,
  Cpu,
  Wifi,
  BarChart2,
  Flame,
  Key,
  Check,
  Trash2,
  EyeOff,
  Gauge,
  ExternalLink,
  Bookmark,
} from 'lucide-react';
import { MarketInfo, MarketSymbol } from '../../types/deriv';
import { soundManager } from '../../utils/soundEffects';
import { strategyShield } from '../../services/strategyShield';
import { REGISTERED_DERIV_APP_ID } from '../../config/deriv';

export type MarketListType = 'STANDARD_10_TO_100' | 'ONESECOND_10_TO_100' | 'ALL_10_TO_100';

export type BotStrategyMode =
  | 'MULTI_STRATEGY_MATRIX'
  | 'TRIPLE_THREAT'
  | 'DOUBLE_BOT'
  | 'DIFFER_5'
  | 'DIFFER_SINGLE_NUMBER'
  | 'LAST_DIGIT_DIFFER'
  | 'ENTRY_POINT_DIFFER'
  | 'DIGIT_MARKER_DIFFER'
  | 'TWIN_CLASSIC';

export interface ActiveMarketStrategyState {
  botMode: BotStrategyMode;
  marketName: string;
  volatility: number;
  label: string;
  patternFormula: string;
  differTargetFormula: string;
  durationTicks: number;
  description: string;
  isMatched: boolean;
  matchedPatternDisplay: string;
  targetDigit: number | null;
  statusDetails: string;
}

export interface MarketStrategyDefinition {
  volatility: number;
  label: string;
  patternFormula: string;
  differTargetFormula: string;
  durationTicks: number;
  description: string;
}

interface AscendingMarketInfo {
  symbol: string;
  name: string;
  shortName: string;
  volatility: number;
  pipSize: number;
}

interface LiveTradeItem {
  id: string;
  timestamp: number;
  timeString: string;
  symbol: string;
  marketName: string;
  strategyLabel?: string;
  differDigit: number;
  triggerReason: string;
  twinPattern: string;
  intermediateDigit: number | null;
  exitDigit: number | null;
  stake: number;
  profit: number;
  result: 'WIN' | 'LOSS' | 'OPEN';
  durationTicks: number;
  entryPrice: number;
  exitPrice?: number;
  cycleNumber: number;
  marketStep: number;
}

interface ServerLiveStatus {
  isRunning: boolean;
  phase: 'IDLE' | 'CONNECTING' | 'SCANNING' | 'IN_TRADE' | 'WAITING_COOLDOWN' | 'STOPPED';
  statusMessage: string;
  botStrategyMode?: BotStrategyMode;
  currentMarketIndex: number;
  currentMarket: AscendingMarketInfo;
  nextMarket: AscendingMarketInfo;
  ladder: Array<{
    symbol: string;
    name: string;
    shortName: string;
    volatility?: number;
    isCurrent: boolean;
    isTraded: boolean;
  }>;
  cycleNumber: number;
  tradedInCurrentCycle: string[];
  currentStake: number;
  netProfit: number;
  totalTrades: number;
  totalWins: number;
  totalLosses: number;
  winRate: number;
  consecutiveWins: number;
  consecutiveLosses: number;
  currentMartingaleStep?: number;
  cooldownSecondsRemaining: number;
  cooldownTotalSeconds: number;
  cooldownEndTime: number | null;
  activeContract: {
    id: string;
    symbol: string;
    marketName: string;
    differDigit: number;
    stake: number;
    durationTicks: number;
    entryPrice: number;
    ticksCount: number;
    spots: number[];
  } | null;
  recentDigits: number[];
  hasTwinDigit: boolean;
  twinDigit: number | null;
  activeMarketStrategy?: ActiveMarketStrategyState;
  availableStrategies?: MarketStrategyDefinition[];
  lastTradeResult: 'WIN' | 'LOSS' | null;
  lastTradeProfit: number | null;
  lastTradeMarket: string | null;
  startedAt: number | null;
  balanceUsd: number;
  loginid: string;
  currency: string;
  config: {
    appId: string;
    token: string;
    accountType: 'REAL' | 'DEMO';
    botStrategyMode?: BotStrategyMode;
    differSingleTargetDigit?: number;
    differSingleDurationTicks?: number;
    waitMinutesBetweenMarkets: number;
    stakeMode: 'FIXED' | 'COMPOUNDING' | 'MARTINGALE';
    baseStake: number;
    compoundingPercent: number;
    martingaleMultiplier?: number;
    maxMartingaleSteps?: number;
    durationTicks: number;
    takeProfit: number;
    stopLoss: number;
    maxConsecutiveLosses: number;
    marketListType: 'STANDARD_10_TO_100' | 'ONESECOND_10_TO_100' | 'ALL_10_TO_100';
  };
  multiMarketLiveDigits?: Array<{
    symbol: string;
    shortName: string;
    volatility: number;
    digits: number[];
    lastDigit: number | null;
    hasTwin: boolean;
    hasTriple: boolean;
    tripleDigit: number | null;
  }>;
}

interface SystemAutoLivePanelProps {
  markets: MarketInfo[];
  selectedSymbol: MarketSymbol;
  onSelectSymbol: (symbol: MarketSymbol) => void;
  balanceUsd: number;
  onUpdateBalance: (newBalance: number) => void;
  apiToken?: string;
  appId?: string;
  accountType?: 'REAL' | 'DEMO';
}

const DEFAULT_SERVER_STATUS: ServerLiveStatus = {
  isRunning: false,
  phase: 'IDLE',
  statusMessage: 'System Auto Live ready. Direct 24/7 background differ bot.',
  botStrategyMode: 'MULTI_STRATEGY_MATRIX',
  currentMarketIndex: 0,
  currentMarket: { symbol: 'R_10', name: 'Volatility 10 Index', shortName: 'Vol 10', volatility: 10, pipSize: 3 },
  nextMarket: { symbol: 'R_25', name: 'Volatility 25 Index', shortName: 'Vol 25', volatility: 25, pipSize: 3 },
  ladder: [
    { symbol: 'R_10', name: 'Volatility 10 Index', shortName: 'Vol 10', isCurrent: true, isTraded: false },
    { symbol: 'R_25', name: 'Volatility 25 Index', shortName: 'Vol 25', isCurrent: false, isTraded: false },
    { symbol: 'R_50', name: 'Volatility 50 Index', shortName: 'Vol 50', isCurrent: false, isTraded: false },
    { symbol: 'R_75', name: 'Volatility 75 Index', shortName: 'Vol 75', isCurrent: false, isTraded: false },
    { symbol: 'R_100', name: 'Volatility 100 Index', shortName: 'Vol 100', isCurrent: false, isTraded: false },
  ],
  cycleNumber: 1,
  tradedInCurrentCycle: [],
  currentStake: 0.50,
  netProfit: 0,
  totalTrades: 0,
  totalWins: 0,
  totalLosses: 0,
  winRate: 0,
  consecutiveWins: 0,
  consecutiveLosses: 0,
  currentMartingaleStep: 0,
  cooldownSecondsRemaining: 0,
  cooldownTotalSeconds: 300,
  cooldownEndTime: null,
  activeContract: null,
  recentDigits: [3, 7, 2, 9, 4, 1, 8, 5, 0, 6],
  hasTwinDigit: false,
  twinDigit: null,
  lastTradeResult: null,
  lastTradeProfit: null,
  lastTradeMarket: null,
  startedAt: null,
  balanceUsd: 10000,
  loginid: '',
  currency: 'USD',
  config: {
    appId: REGISTERED_DERIV_APP_ID,
    token: '',
    accountType: 'DEMO',
    botStrategyMode: 'MULTI_STRATEGY_MATRIX',
    differSingleTargetDigit: 5,
    differSingleDurationTicks: 1,
    waitMinutesBetweenMarkets: 5,
    stakeMode: 'FIXED',
    baseStake: 0.50,
    compoundingPercent: 50,
    martingaleMultiplier: 11.2,
    maxMartingaleSteps: 4,
    durationTicks: 1,
    takeProfit: 50,
    stopLoss: 50,
    maxConsecutiveLosses: 3,
    marketListType: 'STANDARD_10_TO_100',
  },
};

export const DEFAULT_STRATEGY_DEFINITIONS: MarketStrategyDefinition[] = [
  {
    volatility: 10,
    label: 'Twin Differ (x,x ➔ ≠x)',
    patternFormula: '[x, x]',
    differTargetFormula: 'Differ ≠ x',
    durationTicks: 2,
    description: 'Waits for twin identical digits [x, x], trades Differ ≠ x. 2 ticks to close market.',
  },
  {
    volatility: 25,
    label: 'Pivot Differ (x,x,y ➔ ≠y)',
    patternFormula: '[x, x, y]',
    differTargetFormula: 'Differ ≠ y',
    durationTicks: 1,
    description: 'Waits for twin followed by pivot [x, x, y], trades Differ ≠ y. 1 tick to close trade.',
  },
  {
    volatility: 50,
    label: 'Twin Rebound (x,x,y ➔ ≠x)',
    patternFormula: '[x, x, y]',
    differTargetFormula: 'Differ ≠ x',
    durationTicks: 1,
    description: 'Waits for twin followed by third digit [x, x, y], trades Differ ≠ x. 1 tick to close trade.',
  },
  {
    volatility: 75,
    label: 'Bookend Differ (x,y,x,x ➔ ≠x)',
    patternFormula: '[x, y, x, x]',
    differTargetFormula: 'Differ ≠ x',
    durationTicks: 1,
    description: 'Waits for sequence [x, y, x, x], trades Differ ≠ x. 1 tick settles trade.',
  },
  {
    volatility: 100,
    label: 'Pulse Differ (x,x,y,x ➔ ≠x)',
    patternFormula: '[x, x, y, x]',
    differTargetFormula: 'Differ ≠ x',
    durationTicks: 1,
    description: 'Waits for sequence [x, x, y, x], trades Differ ≠ x. 1 tick settles trade.',
  },
];

export const SystemAutoLivePanel: React.FC<SystemAutoLivePanelProps> = ({
  markets,
  selectedSymbol,
  onSelectSymbol,
  balanceUsd,
  onUpdateBalance,
  apiToken = '',
  appId = '1089',
  accountType = 'DEMO',
}) => {
  const [serverStatus, setServerStatus] = useState<ServerLiveStatus>(DEFAULT_SERVER_STATUS);
  const [tradeHistory, setTradeHistory] = useState<LiveTradeItem[]>([]);
  const [historyFilter, setHistoryFilter] = useState<'ALL' | 'WINS' | 'LOSSES'>('ALL');
  const [activeTab, setActiveTab] = useState<'MONITOR' | 'SETTINGS' | 'LOGS'>('MONITOR');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Bot Strategy Mode: Multi-Strategy Matrix, Differ Single Number, Last Digit Differ, or Twin Classic
  const [localBotStrategyMode, setLocalBotStrategyMode] = useState<BotStrategyMode>('MULTI_STRATEGY_MATRIX');
  const [localDifferSingleTargetDigit, setLocalDifferSingleTargetDigit] = useState<number>(5);
  const [localDifferSingleDurationTicks, setLocalDifferSingleDurationTicks] = useState<number>(1);

  // Local editable settings draft before saving
  const [localWaitMins, setLocalWaitMins] = useState<number>(5);
  const [localStakeMode, setLocalStakeMode] = useState<'FIXED' | 'COMPOUNDING' | 'MARTINGALE'>('FIXED');
  const [localBaseStake, setLocalBaseStake] = useState<number>(0.50);
  const [localCompoundingPercent, setLocalCompoundingPercent] = useState<number>(50);
  const [localMartingaleMultiplier, setLocalMartingaleMultiplier] = useState<number>(11.2);
  const [localMaxMartingaleSteps, setLocalMaxMartingaleSteps] = useState<number>(4);
  const [localDurationTicks, setLocalDurationTicks] = useState<number>(1);
  const [localTakeProfit, setLocalTakeProfit] = useState<number>(50);
  const [localStopLoss, setLocalStopLoss] = useState<number>(50);
  const [localMaxLosses, setLocalMaxLosses] = useState<number>(3);
  const [localMarketListType, setLocalMarketListType] = useState<'STANDARD_10_TO_100' | 'ONESECOND_10_TO_100' | 'ALL_10_TO_100'>('STANDARD_10_TO_100');

  // Multi-source Deriv token auto-discovery
  const resolveInitialToken = (): string => {
    if (apiToken && apiToken.trim()) return apiToken.trim();
    const s = sessionStorage.getItem('deriv_token');
    if (s && s.trim()) return s.trim();
    const l = localStorage.getItem('deriv_token');
    if (l && l.trim()) return l.trim();
    const legacy = localStorage.getItem('deriv_api_token');
    if (legacy && legacy.trim()) return legacy.trim();
    try {
      const rawAccs = localStorage.getItem('deriv_accounts');
      if (rawAccs) {
        const accs = JSON.parse(rawAccs);
        if (Array.isArray(accs) && accs.length > 0) {
          const found = accs.find((a: any) => a.token && (accountType ? a.type === accountType : true)) || accs.find((a: any) => a.token);
          if (found?.token) return found.token.trim();
        }
      }
    } catch {}
    return '';
  };

  const [directToken, setDirectToken] = useState<string>(() => resolveInitialToken());
  const [showTokenDrawer, setShowTokenDrawer] = useState<boolean>(false);

  const getStrategyModeLabel = (mode?: BotStrategyMode) => {
    switch (mode) {
      case 'TRIPLE_THREAT':
        return 'Tripple Threat [x,x,x] (2t)';
      case 'DOUBLE_BOT':
        return 'Double Bot [x,x,y] (1t)';
      case 'DIFFER_5':
        return 'Differ 5 (Detect ➔ Buy)';
      case 'DIFFER_SINGLE_NUMBER':
        return 'Differ Single (≠5)';
      case 'LAST_DIGIT_DIFFER':
        return 'Last Digit Differ (1t)';
      case 'ENTRY_POINT_DIFFER':
        return 'Entry Point Bot (Scan ➔ 1t)';
      case 'DIGIT_MARKER_DIFFER':
        return 'Digit Marker Bot (Scan ➔ 1t)';
      case 'TWIN_CLASSIC':
        return 'Twin Classic';
      case 'MULTI_STRATEGY_MATRIX':
      default:
        return 'Multi-Strategy Matrix';
    }
  };
  const [tokenSavedFeedback, setTokenSavedFeedback] = useState<boolean>(false);

  // Sync directToken when prop apiToken changes
  useEffect(() => {
    if (apiToken && apiToken.trim()) {
      setDirectToken(apiToken.trim());
    }
  }, [apiToken]);

  // Cooldown local tick countdown
  const [displayCooldownSec, setDisplayCooldownSec] = useState<number>(0);
  const [configSavedToast, setConfigSavedToast] = useState<string | null>(null);

  const prevIsRunningRef = useRef<boolean>(false);
  const initialConfigLoadedRef = useRef<boolean>(false);

  // Poll server status periodically
  const fetchStatus = async () => {
    try {
      const res = await fetch('/api/system-auto-live/status');
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          setServerStatus(json.data);

          // If sound notifications are needed
          if (json.data.isRunning && !prevIsRunningRef.current) {
            soundManager.playStart();
          }
          prevIsRunningRef.current = json.data.isRunning;

          // Only sync from server config on initial load so active user edits are never overwritten
          if (!initialConfigLoadedRef.current && json.data.config) {
            initialConfigLoadedRef.current = true;
            setLocalBotStrategyMode(json.data.config.botStrategyMode ?? 'MULTI_STRATEGY_MATRIX');
            if (json.data.config.differSingleTargetDigit !== undefined) {
              setLocalDifferSingleTargetDigit(json.data.config.differSingleTargetDigit);
            }
            if (json.data.config.differSingleDurationTicks !== undefined) {
              setLocalDifferSingleDurationTicks(json.data.config.differSingleDurationTicks);
            }
            setLocalWaitMins(json.data.config.waitMinutesBetweenMarkets ?? 5);
            setLocalStakeMode(json.data.config.stakeMode ?? 'FIXED');
            setLocalBaseStake(json.data.config.baseStake ?? 0.50);
            setLocalCompoundingPercent(json.data.config.compoundingPercent ?? 50);
            if (json.data.config.martingaleMultiplier !== undefined) {
              setLocalMartingaleMultiplier(json.data.config.martingaleMultiplier);
            }
            if (json.data.config.maxMartingaleSteps !== undefined) {
              setLocalMaxMartingaleSteps(json.data.config.maxMartingaleSteps);
            }
            if (json.data.config.durationTicks !== undefined) {
              setLocalDurationTicks(json.data.config.durationTicks);
            }
            setLocalTakeProfit(json.data.config.takeProfit ?? 50);
            setLocalStopLoss(json.data.config.stopLoss ?? 50);
            setLocalMaxLosses(json.data.config.maxConsecutiveLosses ?? 3);
            setLocalMarketListType(json.data.config.marketListType ?? 'STANDARD_10_TO_100');
          }
        }
      }
    } catch (e) {
      // Background network poll fail - benign
    }
  };

  const fetchHistory = async () => {
    try {
      const res = await fetch('/api/system-auto-live/history');
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          setTradeHistory(json.data);
        }
      }
    } catch {}
  };

  useEffect(() => {
    fetchStatus();
    fetchHistory();

    const statusInterval = setInterval(() => {
      fetchStatus();
    }, 1500);

    const historyInterval = setInterval(() => {
      fetchHistory();
    }, 4000);

    const unsubPurge = strategyShield.onPurgeHistory(() => {
      setTradeHistory([]);
    });

    return () => {
      clearInterval(statusInterval);
      clearInterval(historyInterval);
      unsubPurge();
    };
  }, []);

  // Update cooldown clock smoothly every second
  useEffect(() => {
    if (serverStatus.phase === 'WAITING_COOLDOWN' && serverStatus.cooldownEndTime) {
      const updateClock = () => {
        const remaining = Math.max(0, Math.ceil((serverStatus.cooldownEndTime! - Date.now()) / 1000));
        setDisplayCooldownSec(remaining);
      };
      updateClock();
      const t = setInterval(updateClock, 1000);
      return () => clearInterval(t);
    } else {
      setDisplayCooldownSec(0);
    }
  }, [serverStatus.phase, serverStatus.cooldownEndTime]);

  // Save direct token
  const handleSaveDirectToken = () => {
    const clean = directToken.trim().replace(/^bearer\s+/i, '').replace(/[\s'"\r\n\t]/g, '');
    if (clean) {
      setDirectToken(clean);
      localStorage.setItem('deriv_token', clean);
      sessionStorage.setItem('deriv_token', clean);
      localStorage.setItem('deriv_api_token', clean);
      setTokenSavedFeedback(true);
      setTimeout(() => setTokenSavedFeedback(false), 2500);
      setActionError(null);
    }
  };

  // Handle Start Bot
  const handleStartBot = async () => {
    setIsLoading(true);
    setActionError(null);
    try {
      const candidate = directToken.trim() || resolveInitialToken() || apiToken || '';
      const cleanToken = candidate.trim().replace(/^bearer\s+/i, '').replace(/[\s'"\r\n\t]/g, '');

      if (!cleanToken) {
        setActionError('Deriv API token is required. Please paste your token in the "Deriv Token Settings" box below.');
        setShowTokenDrawer(true);
        setIsLoading(false);
        return;
      }

      // Sync across all browser storages so other bots and background runner stay connected
      localStorage.setItem('deriv_token', cleanToken);
      sessionStorage.setItem('deriv_token', cleanToken);
      localStorage.setItem('deriv_api_token', cleanToken);

      const effectiveAppId = (appId || localStorage.getItem('deriv_app_id') || REGISTERED_DERIV_APP_ID).trim();

      const payload = {
        token: cleanToken,
        appId: effectiveAppId,
        accountType: accountType || 'REAL',
        botStrategyMode: localBotStrategyMode,
        differSingleTargetDigit: localDifferSingleTargetDigit,
        differSingleDurationTicks: localDifferSingleDurationTicks,
        waitMinutesBetweenMarkets: localWaitMins,
        stakeMode: localStakeMode,
        baseStake: localBaseStake,
        compoundingPercent: localCompoundingPercent,
        martingaleMultiplier: localMartingaleMultiplier,
        maxMartingaleSteps: localMaxMartingaleSteps,
        durationTicks: localDurationTicks,
        takeProfit: localTakeProfit,
        stopLoss: localStopLoss,
        maxConsecutiveLosses: localMaxLosses,
        marketListType: localMarketListType,
      };

      const res = await fetch('/api/system-auto-live/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Failed to start System Auto Live');
      }

      soundManager.playStart();
      setServerStatus(json.data);
      fetchHistory();
    } catch (err: any) {
      setActionError(err?.message || 'Error starting bot');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle Stop Bot
  const handleStopBot = async () => {
    setIsLoading(true);
    setActionError(null);
    try {
      const res = await fetch('/api/system-auto-live/stop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'Stopped by user from panel' }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Failed to stop bot');
      }
      soundManager.playStop();
      setServerStatus(json.data);
      fetchHistory();
    } catch (err: any) {
      setActionError(err?.message || 'Error stopping bot');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle Reset Stats
  const handleResetStats = async () => {
    try {
      const res = await fetch('/api/system-auto-live/reset', { method: 'POST' });
      const json = await res.json();
      if (json.success) {
        soundManager.playButtonClick();
        setServerStatus(json.data);
        setTradeHistory([]);
      }
    } catch {}
  };

  // Instant Apply Quick Config (usable anytime, running or idle)
  const handleApplyQuickConfig = async (overrides: {
    baseStake?: number;
    stakeMode?: 'FIXED' | 'COMPOUNDING' | 'MARTINGALE';
    martingaleMultiplier?: number;
    maxMartingaleSteps?: number;
    durationTicks?: number;
    marketListType?: MarketListType;
    waitMinutesBetweenMarkets?: number;
    botStrategyMode?: BotStrategyMode;
    differSingleTargetDigit?: number;
    differSingleDurationTicks?: number;
  }) => {
    setIsLoading(true);
    setActionError(null);
    try {
      const newStake = overrides.baseStake !== undefined ? overrides.baseStake : localBaseStake;
      const newMode = overrides.stakeMode !== undefined ? overrides.stakeMode : localStakeMode;
      const newMultiplier = overrides.martingaleMultiplier !== undefined ? overrides.martingaleMultiplier : localMartingaleMultiplier;
      const newMaxSteps = overrides.maxMartingaleSteps !== undefined ? overrides.maxMartingaleSteps : localMaxMartingaleSteps;
      const newDurationTicks = overrides.durationTicks !== undefined
        ? overrides.durationTicks
        : (overrides.differSingleDurationTicks !== undefined ? overrides.differSingleDurationTicks : localDurationTicks);
      const newMarketType = overrides.marketListType !== undefined ? overrides.marketListType : localMarketListType;
      const newWait = overrides.waitMinutesBetweenMarkets !== undefined ? overrides.waitMinutesBetweenMarkets : localWaitMins;
      const newBotMode = overrides.botStrategyMode !== undefined ? overrides.botStrategyMode : localBotStrategyMode;
      const newTargetDigit = overrides.differSingleTargetDigit !== undefined ? overrides.differSingleTargetDigit : localDifferSingleTargetDigit;

      if (overrides.baseStake !== undefined) setLocalBaseStake(overrides.baseStake);
      if (overrides.stakeMode !== undefined) setLocalStakeMode(overrides.stakeMode);
      if (overrides.martingaleMultiplier !== undefined) setLocalMartingaleMultiplier(overrides.martingaleMultiplier);
      if (overrides.maxMartingaleSteps !== undefined) setLocalMaxMartingaleSteps(overrides.maxMartingaleSteps);
      if (overrides.durationTicks !== undefined) {
        setLocalDurationTicks(overrides.durationTicks);
        setLocalDifferSingleDurationTicks(overrides.durationTicks);
      }
      if (overrides.differSingleDurationTicks !== undefined) {
        setLocalDifferSingleDurationTicks(overrides.differSingleDurationTicks);
        setLocalDurationTicks(overrides.differSingleDurationTicks);
      }
      if (overrides.marketListType !== undefined) setLocalMarketListType(overrides.marketListType);
      if (overrides.waitMinutesBetweenMarkets !== undefined) setLocalWaitMins(overrides.waitMinutesBetweenMarkets);
      if (overrides.botStrategyMode !== undefined) setLocalBotStrategyMode(overrides.botStrategyMode);
      if (overrides.differSingleTargetDigit !== undefined) setLocalDifferSingleTargetDigit(overrides.differSingleTargetDigit);

      const payload = {
        botStrategyMode: newBotMode,
        differSingleTargetDigit: newTargetDigit,
        differSingleDurationTicks: newDurationTicks,
        durationTicks: newDurationTicks,
        waitMinutesBetweenMarkets: newWait,
        stakeMode: newMode,
        baseStake: newStake,
        compoundingPercent: localCompoundingPercent,
        martingaleMultiplier: newMultiplier,
        maxMartingaleSteps: newMaxSteps,
        takeProfit: localTakeProfit,
        stopLoss: localStopLoss,
        maxConsecutiveLosses: localMaxLosses,
        marketListType: newMarketType,
      };

      const res = await fetch('/api/system-auto-live/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (json.success && json.data) {
        soundManager.playButtonClick();
        setServerStatus(json.data);
        const modeLabel = newMode === 'MARTINGALE' ? `Martingale (${newMultiplier}x)` : newMode;
        setConfigSavedToast(
          `✓ Settings Applied: ${getStrategyModeLabel(newBotMode)} | ${modeLabel} | ${newDurationTicks} Tick(s) | Stake $${newStake.toFixed(2)}`
        );
        setTimeout(() => setConfigSavedToast(null), 3500);
      }
    } catch (err: any) {
      setActionError(err?.message || 'Failed to apply configuration');
    } finally {
      setIsLoading(false);
    }
  };

  // Save Config update while running or idle
  const handleSaveConfig = async () => {
    setIsLoading(true);
    setActionError(null);
    try {
      const payload = {
        botStrategyMode: localBotStrategyMode,
        differSingleTargetDigit: localDifferSingleTargetDigit,
        differSingleDurationTicks: localDifferSingleDurationTicks,
        durationTicks: localDurationTicks,
        waitMinutesBetweenMarkets: localWaitMins,
        stakeMode: localStakeMode,
        baseStake: localBaseStake,
        compoundingPercent: localCompoundingPercent,
        martingaleMultiplier: localMartingaleMultiplier,
        maxMartingaleSteps: localMaxMartingaleSteps,
        takeProfit: localTakeProfit,
        stopLoss: localStopLoss,
        maxConsecutiveLosses: localMaxLosses,
        marketListType: localMarketListType,
      };
      const res = await fetch('/api/system-auto-live/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (json.success) {
        soundManager.playButtonClick();
        setServerStatus(json.data);
        const modeLabel = localStakeMode === 'MARTINGALE' ? `Martingale (${localMartingaleMultiplier}x)` : localStakeMode;
        setConfigSavedToast(
          `✓ Configuration saved & applied! Mode: ${getStrategyModeLabel(localBotStrategyMode)} | ${modeLabel} | ${localDurationTicks} Tick(s) | Stake: $${localBaseStake.toFixed(2)}`
        );
        setTimeout(() => setConfigSavedToast(null), 3500);
        setActiveTab('MONITOR');
      }
    } catch (err: any) {
      setActionError(err?.message || 'Failed to save configuration');
    } finally {
      setIsLoading(false);
    }
  };

  // Export CSV
  const handleExportCSV = () => {
    if (tradeHistory.length === 0) return;
    const headers = ['ID', 'Time', 'Market', 'Strategy', 'Trigger', 'DifferDigit', 'DurationTicks', 'IntermediateT1', 'ExitDigit', 'Result', 'Stake', 'Profit', 'Cycle'];
    const rows = tradeHistory.map((t) => [
      t.id,
      t.timeString,
      t.marketName,
      t.strategyLabel || (t.durationTicks === 1 ? '1-Tick Differ' : 'Twin Differ (2t)'),
      t.twinPattern || t.triggerReason,
      t.differDigit,
      t.durationTicks || (t.marketName?.includes('10 ') ? 2 : 1),
      t.intermediateDigit ?? 'N/A',
      t.exitDigit ?? 'N/A',
      t.result,
      t.stake,
      t.profit,
      t.cycleNumber,
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const link = document.createElement('a');
    link.setAttribute('href', encodeURI(csvContent));
    link.setAttribute('download', `system_auto_live_trades_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredHistory = useMemo(() => {
    if (historyFilter === 'WINS') return tradeHistory.filter((t) => t.result === 'WIN');
    if (historyFilter === 'LOSSES') return tradeHistory.filter((t) => t.result === 'LOSS');
    return tradeHistory;
  }, [tradeHistory, historyFilter]);

  // Format MM:SS for cooldown
  const formatTimeRemaining = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  // Progress percentage of cooldown
  const cooldownPercent = useMemo(() => {
    if (serverStatus.phase !== 'WAITING_COOLDOWN' || !serverStatus.cooldownTotalSeconds) return 0;
    const elapsed = serverStatus.cooldownTotalSeconds - displayCooldownSec;
    return Math.min(100, Math.max(0, (elapsed / serverStatus.cooldownTotalSeconds) * 100));
  }, [serverStatus.phase, serverStatus.cooldownTotalSeconds, displayCooldownSec]);

  return (
    <div className="space-y-6" id="system-auto-live-panel-root">
      {/* 🚀 TOP LIVE STATUS & ACTIVE VOLATILITY CONTROLLER BAR */}
      <div
        id="system-auto-live-top-banner"
        className={`relative overflow-hidden rounded-2xl sm:rounded-3xl border transition-all duration-300 p-5 sm:p-6 shadow-2xl ${
          serverStatus.isRunning
            ? 'bg-gradient-to-r from-emerald-950/90 via-slate-900 to-slate-950 border-emerald-500/80 shadow-emerald-950/40 ring-2 ring-emerald-500/30'
            : 'bg-gradient-to-r from-slate-900 via-slate-950 to-slate-900 border-slate-800 shadow-slate-950/40'
        }`}
      >
        {/* Glow acccents */}
        {serverStatus.isRunning && (
          <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-500/15 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
        )}

        <div className="relative z-10 flex flex-col xl:flex-row xl:items-center justify-between gap-5">
          {/* Left Column: Running Beacon, Current Volatility & Phase */}
          <div className="flex flex-wrap items-center gap-4">
            {/* Live Engine Status Badge */}
            <div
              id="live-engine-status-indicator"
              className={`flex items-center gap-2.5 px-4 py-2.5 rounded-2xl border font-black text-xs tracking-wider uppercase shadow-inner transition-all ${
                serverStatus.isRunning
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/60 shadow-emerald-900/40'
                  : 'bg-slate-800/80 text-slate-400 border-slate-700'
              }`}
            >
              <span className="relative flex h-3.5 w-3.5">
                {serverStatus.isRunning && (
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                )}
                <span
                  className={`relative inline-flex rounded-full h-3.5 w-3.5 ${
                    serverStatus.isRunning ? 'bg-emerald-400 shadow-sm shadow-emerald-300' : 'bg-slate-500'
                  }`}
                />
              </span>
              <span>
                {serverStatus.isRunning ? '24/7 LIVE BOT: RUNNING' : 'LIVE BOT: STOPPED (OFFLINE)'}
              </span>
            </div>

            {/* Active Volatility Badge */}
            <div
              id="live-current-volatility-display"
              className="flex items-center gap-3 px-4 py-2.5 rounded-2xl bg-slate-950/90 border border-slate-800 shadow-md"
            >
              <div className="p-2 rounded-xl bg-cyan-950/80 border border-cyan-800/50 text-cyan-400">
                <Layers className="w-5 h-5" />
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] uppercase font-black text-slate-400 leading-none">
                  Current Volatility
                </span>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-base sm:text-lg font-black font-mono text-cyan-300 leading-none">
                    {serverStatus.currentMarket?.name || 'Volatility 10 Index'}
                  </span>
                  <span className="text-xs px-2 py-0.5 rounded-md bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 font-extrabold font-mono">
                    {serverStatus.currentMarket?.symbol || 'R_10'}
                  </span>
                </div>
              </div>
            </div>

            {/* Step in Sequence */}
            <div className="hidden sm:flex items-center gap-2 px-3.5 py-2.5 rounded-2xl bg-slate-950/70 border border-slate-800 text-xs">
              <span className="text-slate-400 font-mono">
                Step <strong className="text-white font-bold">{serverStatus.currentMarketIndex + 1}</strong> of <strong className="text-white font-bold">{serverStatus.ladder.length}</strong>
              </span>
              <span className="text-slate-600">•</span>
              <span className="text-slate-400 font-mono">
                Next: <strong className="text-cyan-400 font-bold">{serverStatus.nextMarket?.shortName || 'Vol 25'}</strong>
              </span>
            </div>

            {/* Current Phase Pill */}
            <div
              className={`flex items-center gap-2 px-3.5 py-2.5 rounded-2xl border text-xs font-bold font-mono transition-all ${
                serverStatus.phase === 'SCANNING'
                  ? 'bg-emerald-950/60 border-emerald-500/50 text-emerald-300'
                  : serverStatus.phase === 'WAITING_COOLDOWN'
                  ? 'bg-amber-950/60 border-amber-500/50 text-amber-300'
                  : serverStatus.phase === 'IN_TRADE'
                  ? 'bg-purple-950/60 border-purple-500/50 text-purple-300 animate-pulse'
                  : 'bg-slate-950/60 border-slate-800 text-slate-400'
              }`}
            >
              <Activity className={`w-3.5 h-3.5 ${serverStatus.isRunning ? 'animate-spin' : ''}`} />
              <span>
                Phase: {serverStatus.phase}
                {serverStatus.phase === 'WAITING_COOLDOWN' && (
                  <span className="ml-1 text-amber-300 font-black">
                    ({formatTimeRemaining(displayCooldownSec)})
                  </span>
                )}
              </span>
            </div>

            {/* Strategy Engine Mode Badge */}
            <div
              id="live-strategy-engine-badge"
              className="flex items-center gap-2 px-3.5 py-2.5 rounded-2xl bg-slate-950/90 border border-slate-800 text-xs shadow-md"
            >
              <div className="p-1.5 rounded-xl bg-emerald-950/80 border border-emerald-800/60 text-emerald-400">
                <Zap className="w-3.5 h-3.5" />
              </div>
              <div className="flex flex-col">
                <span className="text-[9px] uppercase font-black text-slate-400 leading-none">
                  Bot Strategy Engine
                </span>
                <span className="text-xs font-bold font-mono text-emerald-300 mt-0.5">
                  {serverStatus.activeMarketStrategy?.label || getStrategyModeLabel(serverStatus.botStrategyMode || localBotStrategyMode)}
                </span>
              </div>
            </div>
          </div>

          {/* Right Column: Net Profit & Manual STOP / START Button */}
          <div className="flex items-center gap-3 shrink-0">
            {/* Quick Net Profit */}
            <div className="flex flex-col items-end px-3.5 py-2 rounded-2xl bg-slate-950/80 border border-slate-800">
              <span className="text-[9px] uppercase font-bold text-slate-400">Net Profit</span>
              <span
                className={`text-sm font-black font-mono ${
                  serverStatus.netProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                {serverStatus.netProfit >= 0 ? '+' : ''}${serverStatus.netProfit.toFixed(2)} USD
              </span>
            </div>

            {/* Prominent Manual STOP Button */}
            {serverStatus.isRunning ? (
              <button
                id="btn-top-manual-stop-bot"
                onClick={handleStopBot}
                disabled={isLoading}
                className="flex items-center justify-center gap-2.5 px-6 sm:px-8 py-3.5 rounded-2xl font-black text-sm text-white bg-gradient-to-r from-red-600 via-rose-600 to-red-700 hover:from-red-500 hover:to-rose-500 shadow-xl shadow-red-950/60 border border-red-500 active:scale-95 transition-all cursor-pointer ring-2 ring-red-500/40"
                title="Stop the 24/7 background trading bot immediately"
              >
                <Square className="w-5 h-5 fill-current" />
                <span>STOP BOT</span>
              </button>
            ) : (
              <button
                id="btn-top-manual-start-bot"
                onClick={handleStartBot}
                disabled={isLoading}
                className="flex items-center justify-center gap-2.5 px-6 sm:px-8 py-3.5 rounded-2xl font-black text-sm text-slate-950 bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400 hover:from-emerald-300 hover:to-cyan-300 shadow-xl shadow-emerald-950/50 border border-emerald-300 active:scale-95 transition-all cursor-pointer ring-2 ring-emerald-400/40"
                title="Start 24/7 background bot in ascending order from Vol 10 to 100"
              >
                <Play className="w-5 h-5 fill-current" />
                <span>START 24/7 LIVE BOT</span>
              </button>
            )}

            {/* Token Drawer Toggle Button */}
            <button
              id="btn-toggle-token-drawer"
              onClick={() => setShowTokenDrawer(!showTokenDrawer)}
              className={`p-3 rounded-2xl border text-xs font-bold transition-all ${
                showTokenDrawer
                  ? 'bg-amber-950/80 border-amber-500 text-amber-300'
                  : 'bg-slate-950/80 hover:bg-slate-800 border-slate-800 text-slate-400 hover:text-white'
              }`}
              title="View or update Deriv API token"
            >
              <Key className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Inline Ascending Volatility Ladder Ribbon */}
        <div className="mt-4 pt-3.5 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2 overflow-x-auto py-1">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider shrink-0">
              Ladder Path:
            </span>
            {serverStatus.ladder.map((step, idx) => {
              const isCurrent = step.isCurrent;
              const isTraded = step.isTraded;
              return (
                <React.Fragment key={step.symbol}>
                  <div
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition-all ${
                      isCurrent
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500 ring-1 ring-emerald-500/40 font-black'
                        : isTraded
                        ? 'bg-slate-800/60 text-slate-400 border border-slate-700'
                        : 'bg-slate-950/40 text-slate-600 border border-slate-900'
                    }`}
                  >
                    <span>{step.shortName}</span>
                    {isTraded && <Check className="w-3 h-3 text-emerald-400" />}
                    {isCurrent && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />}
                  </div>
                  {idx < serverStatus.ladder.length - 1 && (
                    <ChevronRight className="w-3.5 h-3.5 text-slate-700 shrink-0" />
                  )}
                </React.Fragment>
              );
            })}
          </div>

          <div className="flex items-center gap-3 text-[11px] text-slate-400 font-mono">
            {serverStatus.loginid && (
              <span className="text-emerald-400 font-bold">
                Account: {serverStatus.loginid} (${serverStatus.balanceUsd.toFixed(2)} {serverStatus.currency})
              </span>
            )}
            <span>Cycle #{serverStatus.cycleNumber}</span>
          </div>
        </div>

        {/* Direct Token Settings Drawer */}
        {showTokenDrawer && (
          <div className="mt-4 p-4 rounded-2xl bg-slate-950 border border-amber-500/40 shadow-xl space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Key className="w-4 h-4 text-amber-400" />
                <span className="text-xs font-bold text-white uppercase tracking-wider">
                  Deriv API Token Settings
                </span>
              </div>
              <span className="text-[11px] text-slate-400">
                Shared with all terminal trading bots
              </span>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <input
                type="password"
                value={directToken}
                onChange={(e) => setDirectToken(e.target.value)}
                placeholder="Paste your Deriv API Token (pat_... or legacy token)"
                className="flex-1 px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-xs font-mono text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
              />
              <button
                type="button"
                onClick={handleSaveDirectToken}
                className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 font-bold text-xs text-slate-950 flex items-center justify-center gap-1.5 transition-all cursor-pointer"
              >
                <Check className="w-4 h-4" />
                <span>Save Token</span>
              </button>
            </div>

            {tokenSavedFeedback && (
              <p className="text-xs text-emerald-400 font-medium flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                API token saved and synchronized across storage!
              </p>
            )}

            <p className="text-[11px] text-slate-400 leading-relaxed">
              Ensure your Deriv token has <strong>Read</strong> and <strong>Trade</strong> scopes enabled in your Deriv Account Settings.
            </p>
          </div>
        )}
      </div>

      {/* 🌟 Top Hero Card: 24/7 Cloud Architecture & Master Controls */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 border border-slate-800 p-6 sm:p-8 shadow-2xl">
        <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none -ml-20 -mb-20" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <div className="p-3.5 rounded-2xl bg-gradient-to-tr from-emerald-500 via-teal-500 to-cyan-500 text-slate-950 shadow-xl shadow-emerald-500/20 font-black">
                <Radio className={`w-7 h-7 ${serverStatus.isRunning ? 'animate-pulse text-slate-950' : ''}`} />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white flex items-center gap-2">
                    System Auto Live
                  </h1>
                  <span className="text-[11px] px-3 py-1 rounded-full font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1.5 shadow-sm">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                    24/7 Server Autonomous
                  </span>
                  <span className="text-[11px] px-3 py-1 rounded-full font-mono font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                    Ascending Vol 10 ➔ 100
                  </span>
                  <span className="text-[11px] px-3 py-1 rounded-full font-mono font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">
                    {localBotStrategyMode === 'MULTI_STRATEGY_MATRIX' ? '⚡ Multi-Strategy Matrix' : '🔁 Twin Differ Classic'}
                  </span>
                  <span className="text-[11px] px-3 py-1 rounded-full font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    {localWaitMins}m Wait Interval
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-3xl leading-relaxed">
                  {localBotStrategyMode === 'MULTI_STRATEGY_MATRIX' ? (
                    <>
                      Executes a <strong className="text-emerald-400">dedicated differing strategy for each volatility market</strong> in ascending order (Vol 10: <span className="font-mono text-amber-300">[x,x]≠x</span> 2 ticks, Vol 25: <span className="font-mono text-amber-300">[x,x,y]≠y</span> 1 tick, Vol 50: <span className="font-mono text-amber-300">[x,x,y]≠x</span> 1 tick, Vol 75: <span className="font-mono text-amber-300">[x,y,x,x]≠x</span> 1 tick, Vol 100: <span className="font-mono text-amber-300">[x,x,y,x]≠x</span> 1 tick). When a market trade closes, it pauses for <strong className="text-amber-300 font-bold">{localWaitMins} minutes</strong> and moves to the next market, <strong className="text-cyan-400">running continuously throughout until you stop</strong>.
                    </>
                  ) : (
                    <>
                      Trades in strictly <strong className="text-cyan-400">ascending order from Vol 10 to Vol 100 Index</strong>. Takes a <strong className="text-amber-400">single Differ trade per market</strong> upon detecting consecutive identical digits (<strong className="text-emerald-400 font-mono">[d, d]</strong>). When the market closes, it waits <strong className="text-amber-300 font-bold">{localWaitMins} minutes</strong> before scanning the next ascending market.
                    </>
                  )}
                </p>
              </div>
            </div>

            {/* Cloud Persistence Notice Pill */}
            <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-900/90 border border-emerald-500/30 text-xs text-emerald-300 max-w-2xl">
              <Cpu className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>
                <strong>Persistent Cloud Execution:</strong> This bot continues trading on the background server even if your app is closed, tab is closed, or your mobile data is disconnected. Reopen anytime to monitor or stop.
              </span>
            </div>
          </div>

          {/* Master Start / Stop Action Buttons */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0">
            {serverStatus.isRunning ? (
              <button
                id="btn-live-stop-bot"
                onClick={handleStopBot}
                disabled={isLoading}
                className="flex items-center justify-center gap-2 px-7 py-4 rounded-2xl font-black text-sm text-white bg-gradient-to-r from-red-600 via-rose-600 to-red-700 hover:from-red-500 hover:to-rose-500 shadow-xl shadow-red-950/50 border border-red-500/50 active:scale-95 transition-all"
              >
                <Square className="w-5 h-5 fill-current" />
                <span>STOP LIVE BOT</span>
              </button>
            ) : (
              <button
                id="btn-live-start-bot"
                onClick={handleStartBot}
                disabled={isLoading}
                className="flex items-center justify-center gap-2 px-8 py-4 rounded-2xl font-black text-sm text-slate-950 bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400 hover:from-emerald-300 hover:to-cyan-300 shadow-xl shadow-emerald-950/60 border border-emerald-300/60 active:scale-95 transition-all"
              >
                <Play className="w-5 h-5 fill-current" />
                <span>START 24/7 LIVE BOT</span>
              </button>
            )}

            <button
              onClick={handleResetStats}
              disabled={serverStatus.isRunning || isLoading}
              className="flex items-center justify-center gap-1.5 px-4 py-3.5 rounded-2xl text-xs font-bold text-slate-400 bg-slate-900/80 hover:bg-slate-800 hover:text-white border border-slate-800 transition-all disabled:opacity-40"
              title="Reset metrics and trade history"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Reset</span>
            </button>
          </div>
        </div>

        {actionError && (
          <div className="mt-4 p-3 bg-rose-950/80 border border-rose-800 text-rose-300 rounded-xl text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{actionError}</span>
          </div>
        )}

        {configSavedToast && (
          <div className="mt-4 p-3 bg-emerald-950/90 border border-emerald-500/60 text-emerald-300 rounded-xl text-xs font-bold flex items-center justify-between shadow-lg animate-in fade-in slide-in-from-top-1 duration-200">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{configSavedToast}</span>
            </div>
            <button onClick={() => setConfigSavedToast(null)} className="text-emerald-400 hover:text-white text-xs ml-3">✕</button>
          </div>
        )}
      </div>

      {/* ⚙️ Live Quick Settings Control Bar: Immediate Stake & Market Scope Tuning */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-xl space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-emerald-400" />
            <span className="text-xs font-bold uppercase tracking-wider text-white">
              Instant Bot Tuning (Takes Effect Immediately)
            </span>
          </div>
          <div className="flex items-center gap-2 text-[11px] text-slate-400">
            <span>Active on Engine:</span>
            <span className="font-mono font-bold text-amber-400">${serverStatus.currentStake.toFixed(2)}</span>
            <span>•</span>
            <span className="font-bold text-emerald-400">{serverStatus.ladder.length} Markets</span>
            <span>•</span>
            <span className="font-bold text-purple-400">{getStrategyModeLabel(localBotStrategyMode)}</span>
            <span>•</span>
            <span className="font-bold text-slate-300">{serverStatus.config?.waitMinutesBetweenMarkets ?? localWaitMins}m Wait</span>
          </div>
        </div>

        {/* ⚡ Bot Strategy Mode Switcher Strip */}
        <div className="flex flex-col gap-3 bg-slate-950/90 border border-emerald-500/30 rounded-xl p-3 shadow-inner">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 shrink-0">
                <Zap className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black text-white">
                    Strategy Execution Engine
                  </span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-bold uppercase border ${
                    localBotStrategyMode === 'TRIPLE_THREAT'
                      ? 'bg-fuchsia-500/20 text-fuchsia-300 border-fuchsia-500/40'
                      : localBotStrategyMode === 'MULTI_STRATEGY_MATRIX'
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                      : localBotStrategyMode === 'DIFFER_5'
                      ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                      : localBotStrategyMode === 'DIFFER_SINGLE_NUMBER'
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                      : localBotStrategyMode === 'LAST_DIGIT_DIFFER'
                      ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40'
                      : 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                  }`}>
                    {getStrategyModeLabel(localBotStrategyMode)}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  {localBotStrategyMode === 'TRIPLE_THREAT'
                    ? 'Scans ALL markets simultaneously. Once a digit appears thrice consecutively [x, x, x] (e.g. 4,4,4), immediately buys Differ ≠ that digit with 2-tick duration. When the trade closes, it resumes scanning all markets again.'
                    : localBotStrategyMode === 'MULTI_STRATEGY_MATRIX'
                    ? 'Vol 10: [x,x]≠x (2t) • Vol 25: [x,x,y]≠y (1t) • Vol 50: [x,x,y]≠x (1t) • Vol 75: [x,y,x,x]≠x (1t) • Vol 100: [x,x,y,x]≠x (1t). Runs throughout until stopped.'
                    : localBotStrategyMode === 'DIFFER_5'
                    ? 'Ascending volatility ladder scanning for digit 5. Once digit 5 appears on the tick stream, immediately buys Differ ≠ 5 with 1-tick settlement using 24/7 settings.'
                    : localBotStrategyMode === 'DIFFER_SINGLE_NUMBER'
                    ? `Ascending volatility ladder trading Digit Differ ≠ ${localDifferSingleTargetDigit} on every volatility index with ${localDifferSingleDurationTicks} tick settlement.`
                    : localBotStrategyMode === 'LAST_DIGIT_DIFFER'
                    ? 'Ascending volatility ladder trading Digit Differ of the previous tick digit on each market with 1-tick settlement.'
                    : 'Uniform [x, x] Differ ≠ x with 2 ticks duration across all ascending volatility markets.'}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setLocalBotStrategyMode('DOUBLE_BOT');
                  handleApplyQuickConfig({ botStrategyMode: 'DOUBLE_BOT', durationTicks: 1 });
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  localBotStrategyMode === 'DOUBLE_BOT'
                    ? 'bg-gradient-to-r from-amber-500 via-yellow-500 to-orange-500 text-slate-950 font-black shadow-lg shadow-amber-500/30 ring-2 ring-amber-400/40'
                    : 'bg-slate-900 border border-slate-700 text-slate-400 hover:text-white hover:border-slate-600'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                <span>Double Bot [x,x,y] (1t)</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setLocalBotStrategyMode('TRIPLE_THREAT');
                  handleApplyQuickConfig({ botStrategyMode: 'TRIPLE_THREAT' });
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  localBotStrategyMode === 'TRIPLE_THREAT'
                    ? 'bg-gradient-to-r from-violet-600 via-fuchsia-600 to-pink-600 text-white font-black shadow-lg shadow-fuchsia-500/30 ring-2 ring-fuchsia-400/40'
                    : 'bg-slate-900 border border-slate-700 text-slate-400 hover:text-white hover:border-slate-600'
                }`}
              >
                <Flame className="w-3.5 h-3.5 text-fuchsia-300" />
                <span>Tripple Threat [x,x,x] (2t)</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setLocalBotStrategyMode('MULTI_STRATEGY_MATRIX');
                  handleApplyQuickConfig({ botStrategyMode: 'MULTI_STRATEGY_MATRIX' });
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  localBotStrategyMode === 'MULTI_STRATEGY_MATRIX'
                    ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-black shadow-lg shadow-emerald-500/30 ring-2 ring-emerald-400/40'
                    : 'bg-slate-900 border border-slate-700 text-slate-400 hover:text-white hover:border-slate-600'
                }`}
              >
                <Zap className="w-3.5 h-3.5" />
                <span>Multi-Strategy Matrix</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setLocalBotStrategyMode('DIFFER_5');
                  handleApplyQuickConfig({ botStrategyMode: 'DIFFER_5' });
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  localBotStrategyMode === 'DIFFER_5'
                    ? 'bg-gradient-to-r from-rose-500 to-pink-500 text-slate-950 font-black shadow-lg shadow-rose-500/30 ring-2 ring-rose-400/40'
                    : 'bg-slate-900 border border-slate-700 text-slate-400 hover:text-white hover:border-slate-600'
                }`}
              >
                <Target className="w-3.5 h-3.5" />
                <span>Differ 5 (Detect ➔ Buy)</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setLocalBotStrategyMode('DIFFER_SINGLE_NUMBER');
                  handleApplyQuickConfig({ botStrategyMode: 'DIFFER_SINGLE_NUMBER' });
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  localBotStrategyMode === 'DIFFER_SINGLE_NUMBER'
                    ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 font-black shadow-lg shadow-amber-500/30 ring-2 ring-amber-400/40'
                    : 'bg-slate-900 border border-slate-700 text-slate-400 hover:text-white hover:border-slate-600'
                }`}
              >
                <Target className="w-3.5 h-3.5" />
                <span>Differ Single (≠5)</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setLocalBotStrategyMode('ENTRY_POINT_DIFFER');
                  handleApplyQuickConfig({ botStrategyMode: 'ENTRY_POINT_DIFFER' });
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  localBotStrategyMode === 'ENTRY_POINT_DIFFER'
                    ? 'bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-500 text-white font-black shadow-lg shadow-cyan-500/30 ring-2 ring-cyan-400/40'
                    : 'bg-slate-900 border border-slate-700 text-slate-400 hover:text-white hover:border-slate-600'
                }`}
              >
                <Crosshair className="w-3.5 h-3.5 text-cyan-300" />
                <span>Entry Point Bot (1t)</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setLocalBotStrategyMode('DIGIT_MARKER_DIFFER');
                  handleApplyQuickConfig({ botStrategyMode: 'DIGIT_MARKER_DIFFER' });
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  localBotStrategyMode === 'DIGIT_MARKER_DIFFER'
                    ? 'bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 text-slate-950 font-black shadow-lg shadow-orange-500/30 ring-2 ring-amber-400/40'
                    : 'bg-slate-900 border border-slate-700 text-slate-400 hover:text-white hover:border-slate-600'
                }`}
              >
                <Bookmark className="w-3.5 h-3.5 text-amber-400" />
                <span>Digit Marker Bot (1t)</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setLocalBotStrategyMode('LAST_DIGIT_DIFFER');
                  handleApplyQuickConfig({ botStrategyMode: 'LAST_DIGIT_DIFFER' });
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  localBotStrategyMode === 'LAST_DIGIT_DIFFER'
                    ? 'bg-gradient-to-r from-indigo-500 to-purple-500 text-slate-950 font-black shadow-lg shadow-indigo-500/30 ring-2 ring-indigo-400/40'
                    : 'bg-slate-900 border border-slate-700 text-slate-400 hover:text-white hover:border-slate-600'
                }`}
              >
                <Clock className="w-3.5 h-3.5" />
                <span>Last Digit Differ (1t)</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setLocalBotStrategyMode('TWIN_CLASSIC');
                  handleApplyQuickConfig({ botStrategyMode: 'TWIN_CLASSIC' });
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  localBotStrategyMode === 'TWIN_CLASSIC'
                    ? 'bg-gradient-to-r from-cyan-500 to-blue-500 text-slate-950 font-black shadow-lg shadow-cyan-500/30 ring-2 ring-cyan-400/40'
                    : 'bg-slate-900 border border-slate-700 text-slate-400 hover:text-white hover:border-slate-600'
                }`}
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Twin Classic</span>
              </button>
            </div>
          </div>

          {/* Quick Notice for Double Bot */}
          {localBotStrategyMode === 'DOUBLE_BOT' && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-gradient-to-r from-amber-950/70 via-yellow-950/40 to-slate-900 border border-amber-500/40 rounded-xl p-3 text-xs text-amber-200">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/40 shrink-0">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-bold text-white flex items-center gap-2">
                    <span>Auto Double Bot Active</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-mono border border-amber-500/30">
                      [x, x, y] ➔ Differ ≠ y (1t)
                    </span>
                  </div>
                  <p className="text-[11px] text-amber-200/90 mt-0.5">
                    Trades Digit Differ after pattern <span className="font-mono font-bold text-amber-300">[x, x, y]</span> (e.g. <span className="font-mono font-bold text-amber-300">3, 3, 4</span> buys <span className="font-mono font-bold text-amber-300">Differ ≠ 4</span> | <span className="font-mono font-bold text-amber-300">5, 5, 6</span> buys <span className="font-mono font-bold text-amber-300">Differ ≠ 6</span>), and the <span className="font-bold text-white">next digit settles the trade</span> (1 tick settlement).
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                <span className="text-[11px] text-slate-300 font-bold">Duration:</span>
                <span className="px-2.5 py-1 rounded bg-amber-500/20 border border-amber-500/40 text-amber-300 font-mono font-black text-xs">
                  {localDurationTicks} {localDurationTicks === 1 ? 'Tick' : 'Ticks'}
                </span>
              </div>
            </div>
          )}

          {/* Quick Notice for Tripple Threat Bot */}
          {localBotStrategyMode === 'TRIPLE_THREAT' && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-gradient-to-r from-violet-950/70 via-fuchsia-950/40 to-slate-900 border border-fuchsia-500/40 rounded-xl p-3 text-xs text-fuchsia-200">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 rounded-lg bg-fuchsia-500/20 text-fuchsia-300 border border-fuchsia-500/40 shrink-0">
                  <Flame className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-bold text-white flex items-center gap-2">
                    <span>Tripple Threat Bot Active</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-fuchsia-500/20 text-fuchsia-300 font-mono border border-fuchsia-500/30">
                      All-Markets Parallel Radar
                    </span>
                  </div>
                  <p className="text-[11px] text-fuchsia-200/90 mt-0.5">
                    Scanning all Volatility markets at once! As soon as any digit appears 3 times consecutively (e.g. <span className="font-mono font-bold text-amber-300">4, 4, 4</span>), it immediately buys <span className="font-mono font-bold text-amber-300">Differ ≠ that digit</span> with <span className="font-bold text-white">2 ticks duration</span>. After the trade closes, it resumes scanning all markets for the next triple appearance.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                <span className="text-[11px] text-slate-300 font-bold">Duration:</span>
                <span className="px-2.5 py-1 rounded bg-fuchsia-500/20 border border-fuchsia-500/40 text-fuchsia-300 font-mono font-black text-xs">
                  {localDurationTicks} {localDurationTicks === 1 ? 'Tick' : 'Ticks'}
                </span>
              </div>
            </div>
          )}

          {/* Quick Notice for Differ 5 Bot */}
          {localBotStrategyMode === 'DIFFER_5' && (
            <div className="flex items-center gap-2 bg-rose-950/40 border border-rose-500/30 rounded-lg p-2.5 text-xs text-rose-200 font-mono">
              <Target className="w-4 h-4 text-rose-400 shrink-0" />
              <span>
                <strong>Differ 5 Bot Active:</strong> Scans all markets in ascending sequence (<span className="text-white font-bold">Vol 10 ➔ 25 ➔ 50 ➔ 75 ➔ 100</span>). Once it detects digit <strong className="text-rose-400 text-sm">5</strong> on the tick stream, it immediately buys <strong className="text-white">Differ ≠ 5</strong> with 1-tick settlement using 24/7 settings!
              </span>
            </div>
          )}

          {/* Quick Digit & Duration Bar for Differ Single Number */}
          {localBotStrategyMode === 'DIFFER_SINGLE_NUMBER' && (
            <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900/90 border border-amber-500/30 rounded-lg p-2.5 text-xs text-amber-200">
              <div className="flex items-center gap-2">
                <Target className="w-4 h-4 text-amber-400 shrink-0" />
                <span className="font-bold text-amber-300">Differ Number:</span>
                <div className="flex items-center gap-1">
                  {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => {
                        setLocalDifferSingleTargetDigit(d);
                        handleApplyQuickConfig({ differSingleTargetDigit: d });
                      }}
                      className={`w-6 h-6 rounded-md text-xs font-mono font-black transition-all cursor-pointer ${
                        localDifferSingleTargetDigit === d
                          ? 'bg-amber-400 text-slate-950 shadow-md font-black scale-110'
                          : 'bg-slate-800 text-slate-400 hover:text-white border border-slate-700'
                      }`}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-300">Duration:</span>
                {[1, 2, 3].map((ticks) => (
                  <button
                    key={ticks}
                    type="button"
                    onClick={() => {
                      setLocalDifferSingleDurationTicks(ticks);
                      handleApplyQuickConfig({ differSingleDurationTicks: ticks });
                    }}
                    className={`px-2.5 py-0.5 rounded-md text-xs font-mono font-bold transition-all cursor-pointer ${
                      localDifferSingleDurationTicks === ticks
                        ? 'bg-amber-500 text-slate-950 font-black'
                        : 'bg-slate-800 text-slate-400 border border-slate-700 hover:text-white'
                    }`}
                  >
                    {ticks} {ticks === 1 ? 'Tick' : 'Ticks'}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Quick Notice for Last Digit Differ */}
          {localBotStrategyMode === 'LAST_DIGIT_DIFFER' && (
            <div className="flex items-center gap-2 bg-indigo-950/40 border border-indigo-500/30 rounded-lg p-2.5 text-xs text-indigo-200 font-mono">
              <Clock className="w-4 h-4 text-indigo-400 shrink-0" />
              <span>
                <strong>Last Digit Differ Bot:</strong> Dynamically reads the previous market tick digit (d) and trades Differ ≠ d with strict 1-tick settlement across all ascending volatilities.
              </span>
            </div>
          )}

          {/* Quick Notice for Entry Point Bot */}
          {localBotStrategyMode === 'ENTRY_POINT_DIFFER' && (
            <div className="flex items-center gap-2 bg-cyan-950/40 border border-cyan-500/30 rounded-lg p-2.5 text-xs text-cyan-200 font-mono">
              <Crosshair className="w-4 h-4 text-cyan-400 shrink-0" />
              <span>
                <strong>Entry Point Bot:</strong> Scans the selected market in real-time. Once the selected digit appears (Entry Point), it buys Differ ≠ digit and the next digit closes the trade in 1 tick.
              </span>
            </div>
          )}

          {/* Quick Notice for Digit Marker Bot */}
          {localBotStrategyMode === 'DIGIT_MARKER_DIFFER' && (
            <div className="flex items-center gap-2 bg-amber-950/40 border border-amber-500/30 rounded-lg p-2.5 text-xs text-amber-200 font-mono">
              <Bookmark className="w-4 h-4 text-amber-400 shrink-0" />
              <span>
                <strong>Digit Marker Bot:</strong> Scans the selected market in real-time. Once your marked digit appears, it immediately buys Differ ≠ digit and the next digit closes the trade in 1 tick.
              </span>
            </div>
          )}
        </div>

        <div className="space-y-3">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-start">
            {/* Stake & Martingale Recovery Settings (7 cols) */}
            <div className="lg:col-span-7 bg-slate-950/90 border border-slate-800/90 p-3 rounded-xl flex flex-col gap-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-[10px] font-extrabold uppercase text-slate-400 flex items-center gap-1">
                  <DollarSign className="w-3.5 h-3.5 text-amber-400" /> Stake & Recovery Mode
                </span>
                <div className="flex items-center gap-1 bg-slate-900 p-0.5 rounded-lg border border-slate-800">
                  <button
                    type="button"
                    onClick={() => handleApplyQuickConfig({ stakeMode: 'FIXED' })}
                    className={`px-2.5 py-1 rounded text-[11px] font-bold transition-all cursor-pointer ${
                      localStakeMode === 'FIXED'
                        ? 'bg-amber-500 text-slate-950 font-black shadow'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Fixed
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApplyQuickConfig({ stakeMode: 'COMPOUNDING' })}
                    className={`px-2.5 py-1 rounded text-[11px] font-bold transition-all cursor-pointer ${
                      localStakeMode === 'COMPOUNDING'
                        ? 'bg-emerald-500 text-slate-950 font-black shadow'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Compound 50%
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApplyQuickConfig({ stakeMode: 'MARTINGALE' })}
                    className={`px-2.5 py-1 rounded text-[11px] font-bold transition-all flex items-center gap-1 cursor-pointer ${
                      localStakeMode === 'MARTINGALE'
                        ? 'bg-rose-500 text-white font-black shadow ring-1 ring-rose-300'
                        : 'text-rose-400 hover:text-white'
                    }`}
                  >
                    <Zap className="w-3 h-3 text-amber-300 fill-amber-300" />
                    Martingale ⚡
                  </button>
                </div>
              </div>

              {/* Base Stake Presets & Custom Input */}
              <div className="flex flex-wrap sm:flex-nowrap items-center gap-2">
                <span className="text-[10px] font-bold uppercase text-slate-500 shrink-0">Base Stake:</span>
                <div className="flex items-center gap-1">
                  {[0.5, 1.0, 2.0, 5.0].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => handleApplyQuickConfig({ baseStake: preset })}
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${
                        Math.abs(localBaseStake - preset) < 0.01
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/50'
                          : 'bg-slate-900 text-slate-400 border border-slate-800 hover:border-slate-700 hover:text-white'
                      }`}
                    >
                      ${preset.toFixed(2)}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-1 flex-1 min-w-[140px]">
                  <input
                    type="number"
                    min="0.35"
                    max="1000"
                    step="0.10"
                    value={localBaseStake}
                    onChange={(e) => setLocalBaseStake(Number(e.target.value) || 0.50)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-amber-300 font-mono outline-none focus:border-amber-400"
                    placeholder="Custom"
                  />
                  <button
                    type="button"
                    onClick={() => handleApplyQuickConfig({ baseStake: localBaseStake })}
                    disabled={isLoading}
                    className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs shrink-0 transition-all cursor-pointer"
                  >
                    Apply
                  </button>
                </div>
              </div>

              {/* Instant Martingale Settings Box */}
              <div className={`p-2.5 rounded-lg border transition-all ${
                localStakeMode === 'MARTINGALE'
                  ? 'bg-rose-950/30 border-rose-500/40 shadow-inner'
                  : 'bg-slate-900/40 border-slate-800/80'
              }`}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-black uppercase tracking-wider flex items-center gap-1 text-rose-400">
                    <Zap className="w-3.5 h-3.5 fill-rose-400" /> Martingale Loss Recovery Settings
                    {localStakeMode === 'MARTINGALE' ? (
                      <span className="text-[9px] px-1.5 py-0.2 rounded bg-rose-500/20 text-rose-300 font-mono font-bold border border-rose-500/40">
                        ACTIVE ON LIVE BOT
                      </span>
                    ) : (
                      <span className="text-[9px] text-slate-500 font-mono">
                        (Switch mode to Martingale to enable)
                      </span>
                    )}
                  </span>
                  {serverStatus.isRunning && localStakeMode === 'MARTINGALE' && (
                    <span className="text-[10px] font-mono text-amber-300 font-bold">
                      Step {serverStatus.currentMartingaleStep ?? 0}/{localMaxMartingaleSteps} • Next: ${serverStatus.currentStake.toFixed(2)}
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {/* Multiplier setting */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="text-slate-400 font-medium">Multiplier:</span>
                      <span className="font-mono text-rose-300 font-bold">{localMartingaleMultiplier}x</span>
                    </div>
                    <div className="flex items-center gap-1">
                      {[1.5, 2.0, 2.5, 11.2].map((m) => (
                        <button
                          key={m}
                          type="button"
                          onClick={() => handleApplyQuickConfig({ martingaleMultiplier: m, stakeMode: 'MARTINGALE' })}
                          className={`px-1.5 py-1 rounded text-[10px] font-mono font-bold transition-all cursor-pointer ${
                            Math.abs(localMartingaleMultiplier - m) < 0.05
                              ? 'bg-rose-500 text-white font-black shadow'
                              : 'bg-slate-800 text-slate-400 hover:text-white border border-slate-700'
                          }`}
                          title={m === 11.2 ? '11.2x recovers full loss on Differ contracts (~9.5% payout)' : `${m}x multiplier`}
                        >
                          {m === 11.2 ? '11.2x⚡' : `${m}x`}
                        </button>
                      ))}
                      <input
                        type="number"
                        step="0.1"
                        min="1.1"
                        max="25"
                        value={localMartingaleMultiplier}
                        onChange={(e) => setLocalMartingaleMultiplier(Number(e.target.value) || 11.2)}
                        className="w-14 bg-slate-900 border border-slate-700 rounded px-1.5 py-1 text-[10px] text-rose-300 font-mono text-center outline-none focus:border-rose-400"
                      />
                      <button
                        type="button"
                        onClick={() => handleApplyQuickConfig({ martingaleMultiplier: localMartingaleMultiplier, stakeMode: 'MARTINGALE' })}
                        disabled={isLoading}
                        className="px-2 py-1 rounded bg-rose-500 hover:bg-rose-400 text-white font-black text-[10px] cursor-pointer"
                      >
                        Set
                      </button>
                    </div>
                    <p className="text-[9px] text-slate-400 font-mono pt-0.5">
                      💡 <strong>11.2x:</strong> Math-optimized for Differ contracts to fully recover 100% loss + yield profit on 1 win.
                    </p>
                  </div>

                  {/* Max Steps setting */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="text-slate-400 font-medium">Max Loss Steps:</span>
                      <span className="font-mono text-rose-300 font-bold">{localMaxMartingaleSteps} Steps</span>
                    </div>
                    <div className="flex items-center gap-1">
                      {[2, 3, 4, 6].map((steps) => (
                        <button
                          key={steps}
                          type="button"
                          onClick={() => handleApplyQuickConfig({ maxMartingaleSteps: steps, stakeMode: 'MARTINGALE' })}
                          className={`px-2 py-1 rounded text-[10px] font-mono font-bold transition-all cursor-pointer ${
                            localMaxMartingaleSteps === steps
                              ? 'bg-rose-500 text-white font-black shadow'
                              : 'bg-slate-800 text-slate-400 hover:text-white border border-slate-700'
                          }`}
                        >
                          {steps}
                        </button>
                      ))}
                      <input
                        type="number"
                        min="1"
                        max="10"
                        value={localMaxMartingaleSteps}
                        onChange={(e) => setLocalMaxMartingaleSteps(Number(e.target.value) || 4)}
                        className="w-12 bg-slate-900 border border-slate-700 rounded px-1.5 py-1 text-[10px] text-rose-300 font-mono text-center outline-none focus:border-rose-400"
                      />
                      <button
                        type="button"
                        onClick={() => handleApplyQuickConfig({ maxMartingaleSteps: localMaxMartingaleSteps, stakeMode: 'MARTINGALE' })}
                        disabled={isLoading}
                        className="px-2 py-1 rounded bg-rose-500 hover:bg-rose-400 text-white font-black text-[10px] cursor-pointer"
                      >
                        Set
                      </button>
                    </div>
                    <p className="text-[9px] text-slate-400 font-mono pt-0.5">
                      🛡️ <strong>Safety Limit:</strong> Resets to base stake (${localBaseStake.toFixed(2)}) if {localMaxMartingaleSteps} consecutive losses occur.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Tick Duration & Market Scan Settings (5 cols) */}
            <div className="lg:col-span-5 bg-slate-950/90 border border-slate-800/90 p-3 rounded-xl flex flex-col gap-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-extrabold uppercase text-slate-400 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-cyan-400" /> Tick Settings (Duration)
                </span>
                <span className="text-[10px] font-mono font-bold text-cyan-300 px-2 py-0.5 rounded bg-cyan-950/60 border border-cyan-500/30 flex items-center gap-1">
                  <Zap className="w-2.5 h-2.5 text-cyan-400" />
                  {localDurationTicks} {localDurationTicks === 1 ? 'Tick (Instant)' : 'Ticks'}
                </span>
              </div>

              {/* Tick Presets and Custom Input */}
              <div className="flex flex-wrap items-center gap-1.5">
                {[1, 2, 3, 5, 10].map((ticks) => (
                  <button
                    key={ticks}
                    type="button"
                    onClick={() => handleApplyQuickConfig({ durationTicks: ticks, differSingleDurationTicks: ticks })}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${
                      localDurationTicks === ticks
                        ? 'bg-cyan-500 text-slate-950 font-black shadow-lg shadow-cyan-500/30 ring-1 ring-cyan-300'
                        : 'bg-slate-900 text-slate-400 border border-slate-800 hover:border-slate-700 hover:text-white'
                    }`}
                  >
                    {ticks === 1 ? '1 Tick ⚡' : `${ticks} Ticks`}
                  </button>
                ))}

                <div className="flex items-center gap-1 ml-auto">
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={localDurationTicks}
                    onChange={(e) => setLocalDurationTicks(Number(e.target.value) || 1)}
                    className="w-14 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-cyan-300 font-mono text-center outline-none focus:border-cyan-400"
                    placeholder="t"
                  />
                  <button
                    type="button"
                    onClick={() => handleApplyQuickConfig({ durationTicks: localDurationTicks, differSingleDurationTicks: localDurationTicks })}
                    disabled={isLoading}
                    className="px-2.5 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black text-xs transition-all cursor-pointer"
                  >
                    Apply
                  </button>
                </div>
              </div>

              <div className="bg-slate-900/70 border border-slate-800/90 rounded-lg p-2 text-[10px] text-slate-300 leading-relaxed font-mono">
                <span className="text-cyan-300 font-bold">⚡ 1 Tick Execution:</span> Bot settles instantly on the next price tick. Modifying this immediately updates contract duration for all bots ({getStrategyModeLabel(localBotStrategyMode)}) without restarting.
              </div>

              {/* Secondary Sub-panel: Market Ladder & Cooldown */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 border-t border-slate-900">
                <div>
                  <span className="text-[10px] font-extrabold uppercase text-slate-400 flex items-center gap-1 mb-1">
                    <Layers className="w-3 h-3 text-emerald-400" /> Market Ladder Scan
                  </span>
                  <select
                    value={localMarketListType}
                    onChange={(e) => {
                      const val = e.target.value as MarketListType;
                      setLocalMarketListType(val);
                      handleApplyQuickConfig({ marketListType: val });
                    }}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-[11px] text-emerald-300 font-mono outline-none focus:border-emerald-400"
                  >
                    <option value="STANDARD_10_TO_100">Standard Vol 10 ➔ 100</option>
                    <option value="ONESECOND_10_TO_100">Vol (1s) 10 ➔ 100</option>
                    <option value="ALL_10_TO_100">Full Combined (10 Mkts)</option>
                  </select>
                </div>

                <div>
                  <span className="text-[10px] font-extrabold uppercase text-slate-400 flex items-center gap-1 mb-1">
                    <Clock className="w-3 h-3 text-cyan-400" /> Wait Between Mkts
                  </span>
                  <div className="flex items-center gap-1">
                    {[1, 2, 5, 10].map((mins) => (
                      <button
                        key={mins}
                        type="button"
                        onClick={() => handleApplyQuickConfig({ waitMinutesBetweenMarkets: mins })}
                        className={`flex-1 py-1.5 rounded text-[10px] font-bold transition-all cursor-pointer ${
                          localWaitMins === mins
                            ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/50'
                            : 'bg-slate-900 text-slate-400 border border-slate-800 hover:text-white'
                        }`}
                      >
                        {mins}m
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 📊 High-Level Metrics Summary Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Net Profit Card */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between">
          <span className="text-[10px] uppercase font-bold text-slate-400 flex items-center justify-between">
            Net Profit
            {serverStatus.netProfit >= 0 ? (
              <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <TrendingDown className="w-3.5 h-3.5 text-rose-400" />
            )}
          </span>
          <div className="mt-2">
            <span
              className={`text-xl font-mono font-black ${
                serverStatus.netProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              {serverStatus.netProfit >= 0 ? '+' : ''}
              {serverStatus.netProfit.toFixed(2)} USD
            </span>
          </div>
          <span className="text-[10px] text-slate-500 mt-1">TP: +${localTakeProfit} | SL: -${localStopLoss}</span>
        </div>

        {/* Win Rate Card */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between">
          <span className="text-[10px] uppercase font-bold text-slate-400 flex items-center justify-between">
            Win Rate
            <Percent className="w-3.5 h-3.5 text-cyan-400" />
          </span>
          <div className="mt-2">
            <span className="text-xl font-mono font-black text-white">
              {serverStatus.winRate}%
            </span>
          </div>
          <span className="text-[10px] text-slate-500 mt-1">
            {serverStatus.totalWins}W / {serverStatus.totalLosses}L ({serverStatus.totalTrades} total)
          </span>
        </div>

        {/* Current Stake & Mode Card */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between">
          <span className="text-[10px] uppercase font-bold text-slate-400 flex items-center justify-between">
            Current Stake
            <DollarSign className="w-3.5 h-3.5 text-amber-400" />
          </span>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-xl font-mono font-black text-amber-400">
              ${serverStatus.currentStake.toFixed(2)}
            </span>
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-800 font-bold text-slate-300">
              {serverStatus.config?.stakeMode || localStakeMode}
            </span>
          </div>
          <span className="text-[10px] text-slate-500 mt-1">Base: ${localBaseStake.toFixed(2)}</span>
        </div>

        {/* Active Market In Ascending Ladder */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between">
          <span className="text-[10px] uppercase font-bold text-slate-400 flex items-center justify-between">
            Current Market
            <Layers className="w-3.5 h-3.5 text-emerald-400" />
          </span>
          <div className="mt-2">
            <span className="text-xl font-mono font-black text-emerald-400">
              {serverStatus.currentMarket?.shortName || 'Vol 10'}
            </span>
          </div>
          <span className="text-[10px] text-slate-500 mt-1">
            Step {serverStatus.currentMarketIndex + 1}/{serverStatus.ladder.length} • Next: {serverStatus.nextMarket?.shortName || 'Vol 25'}
          </span>
        </div>

        {/* Ladder Cycle */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between">
          <span className="text-[10px] uppercase font-bold text-slate-400 flex items-center justify-between">
            Ladder Cycle
            <Activity className="w-3.5 h-3.5 text-purple-400" />
          </span>
          <div className="mt-2">
            <span className="text-xl font-mono font-black text-purple-400">
              Cycle #{serverStatus.cycleNumber}
            </span>
          </div>
          <span className="text-[10px] text-slate-500 mt-1">
            {serverStatus.tradedInCurrentCycle.length}/{serverStatus.ladder.length} markets traded
          </span>
        </div>

        {/* 5-Min Cooldown Status Card */}
        <div className={`border rounded-2xl p-4 flex flex-col justify-between transition-all ${
          serverStatus.phase === 'WAITING_COOLDOWN'
            ? 'bg-amber-950/40 border-amber-500/50 text-amber-300'
            : 'bg-slate-900/80 border-slate-800 text-slate-400'
        }`}>
          <span className="text-[10px] uppercase font-bold flex items-center justify-between">
            Market Wait Cooldown
            <Clock className={`w-3.5 h-3.5 ${serverStatus.phase === 'WAITING_COOLDOWN' ? 'text-amber-400 animate-spin' : 'text-slate-500'}`} />
          </span>
          <div className="mt-2">
            {serverStatus.phase === 'WAITING_COOLDOWN' ? (
              <span className="text-xl font-mono font-black text-amber-300 flex items-center gap-1">
                {formatTimeRemaining(displayCooldownSec)}
              </span>
            ) : (
              <span className="text-sm font-bold text-slate-400">
                {serverStatus.phase === 'SCANNING' ? '🟢 Live Scanning' : serverStatus.phase === 'IN_TRADE' ? '⚡ In Trade' : 'Idle / Stopped'}
              </span>
            )}
          </div>
          <span className="text-[10px] text-slate-500 mt-1">
            {serverStatus.phase === 'WAITING_COOLDOWN' ? `Waiting ${localWaitMins}m for next market` : `Configured: ${localWaitMins}m`}
          </span>
        </div>
      </div>

      {/* 🪜 Ascending Ladder Stepper Strip: Vol 10 ➔ Vol 25 ➔ Vol 50 ➔ Vol 75 ➔ Vol 100 */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xl">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="text-xs uppercase font-extrabold text-slate-400 flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-cyan-400" />
              Ascending Market Progression (Cycle #{serverStatus.cycleNumber})
            </span>
          </div>
          <span className="text-[11px] text-slate-400 font-mono">
            {serverStatus.tradedInCurrentCycle.length} of {serverStatus.ladder.length} Completed
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 sm:gap-3">
          {serverStatus.ladder.map((step, idx) => {
            const isTraded = step.isTraded;
            const isCurrent = step.isCurrent;
            return (
              <div
                key={step.symbol}
                className={`relative rounded-xl p-3 border transition-all flex flex-col justify-between ${
                  isCurrent
                    ? 'bg-emerald-950/60 border-emerald-500 ring-2 ring-emerald-500/30 text-white shadow-lg shadow-emerald-950/30'
                    : isTraded
                    ? 'bg-slate-950/80 border-slate-800 text-slate-400'
                    : 'bg-slate-900/50 border-slate-800/80 text-slate-500'
                }`}
              >
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-mono font-bold text-slate-400">Step {idx + 1}</span>
                  {isTraded ? (
                    <span className="flex items-center gap-0.5 text-emerald-400 font-bold text-[10px]">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      TRADED
                    </span>
                  ) : isCurrent ? (
                    <span className="flex items-center gap-1 text-emerald-400 font-black text-[10px] uppercase animate-pulse">
                      ACTIVE
                    </span>
                  ) : (
                    <span className="text-slate-600 font-mono text-[10px]">PENDING</span>
                  )}
                </div>

                <div className="mt-1">
                  <div className="text-sm font-black text-white">{step.shortName}</div>
                  <div className="text-[10px] text-slate-400 truncate">{step.name}</div>
                </div>

                {/* Per-Market Strategy Pill */}
                <div className="mt-2 pt-1.5 border-t border-slate-800/80 flex items-center justify-between text-[10px] font-mono">
                  <span className="text-amber-300 font-bold">
                    {localBotStrategyMode === 'MULTI_STRATEGY_MATRIX'
                      ? (step.volatility === 10 ? '[x,x] ≠ x'
                        : step.volatility === 25 ? '[x,x,y] ≠ y'
                        : step.volatility === 50 ? '[x,x,y] ≠ x'
                        : step.volatility === 75 ? '[x,y,x,x] ≠ x'
                        : '[x,x,y,x] ≠ x')
                      : localBotStrategyMode === 'DIFFER_5'
                      ? 'Detect 5 ➔ ≠ 5'
                      : localBotStrategyMode === 'DIFFER_SINGLE_NUMBER'
                      ? `Differ ≠ ${serverStatus.config?.differSingleTargetDigit ?? localDifferSingleTargetDigit ?? 5}`
                      : localBotStrategyMode === 'LAST_DIGIT_DIFFER'
                      ? '≠ Prev Digit'
                      : '[x,x] ≠ x'}
                  </span>
                  <span className="text-cyan-400 font-extrabold px-1.5 py-0.2 rounded bg-cyan-950/80 border border-cyan-800/60">
                    {localBotStrategyMode === 'LAST_DIGIT_DIFFER' || localBotStrategyMode === 'DIFFER_5'
                      ? '1 Tick'
                      : localBotStrategyMode === 'DIFFER_SINGLE_NUMBER'
                      ? `${serverStatus.config?.differSingleDurationTicks ?? localDifferSingleDurationTicks ?? 1} Tick`
                      : localBotStrategyMode === 'MULTI_STRATEGY_MATRIX' && step.volatility !== 10
                      ? '1 Tick'
                      : '2 Ticks'}
                  </span>
                </div>

                {isCurrent && serverStatus.phase === 'WAITING_COOLDOWN' && (
                  <div className="mt-2 pt-2 border-t border-emerald-500/30 text-[10px] text-amber-300 font-mono flex items-center justify-between">
                    <span>Cooldown:</span>
                    <span className="font-bold">{formatTimeRemaining(displayCooldownSec)}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ⏳ Cooldown Progress Bar when waiting for 5 minutes */}
      {serverStatus.phase === 'WAITING_COOLDOWN' && (
        <div className="p-4 rounded-2xl bg-amber-950/50 border border-amber-500/40 text-amber-200 shadow-xl space-y-2 animate-fadeIn">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-400 animate-spin" />
              <span>
                <strong>Trade Closed on {serverStatus.lastTradeMarket || 'Market'}</strong> ({serverStatus.lastTradeResult === 'WIN' ? '✅ WON' : '❌ LOST'}).
                Waiting <strong>{localWaitMins} minutes</strong> before scanning next market: <strong>{serverStatus.nextMarket?.shortName}</strong>.
              </span>
            </div>
            <div className="font-mono font-black text-amber-300 text-sm">
              Time Remaining: {formatTimeRemaining(displayCooldownSec)}
            </div>
          </div>
          <div className="w-full h-2 bg-slate-900 rounded-full overflow-hidden border border-amber-500/30">
            <div
              className="h-full bg-gradient-to-r from-amber-500 to-emerald-400 transition-all duration-1000"
              style={{ width: `${cooldownPercent}%` }}
            />
          </div>
        </div>
      )}

      {/* Sub-Tabs Selector: MONITOR & RADAR, LIVE CONFIGURATION, TRADE LOGS */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
        <button
          onClick={() => setActiveTab('MONITOR')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'MONITOR'
              ? 'bg-emerald-600 text-white shadow-md'
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          <Activity className="w-4 h-4" />
          <span>Live Monitor & Radar</span>
        </button>
        <button
          onClick={() => setActiveTab('SETTINGS')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'SETTINGS'
              ? 'bg-emerald-600 text-white shadow-md'
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          <Sliders className="w-4 h-4" />
          <span>Bot Settings ({localStakeMode}, {localWaitMins}m Wait)</span>
        </button>
        <button
          onClick={() => setActiveTab('LOGS')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'LOGS'
              ? 'bg-emerald-600 text-white shadow-md'
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>Trade History ({tradeHistory.length})</span>
        </button>
      </div>

      {/* TAB 1: MONITOR & RADAR */}
      {activeTab === 'MONITOR' && (
        <div className="space-y-6">
          {/* Live Status Message & Active Trade Hero */}
          <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-slate-800 text-emerald-400 shrink-0">
                <Radio className="w-5 h-5 animate-pulse" />
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Engine Status</span>
                <p className="text-xs sm:text-sm font-semibold text-slate-200 mt-0.5">
                  {serverStatus.statusMessage}
                </p>
              </div>
            </div>

            {serverStatus.activeContract && (
              <div className="flex items-center gap-3 bg-emerald-950/70 border border-emerald-500/50 p-3 rounded-xl">
                <div className="text-right">
                  <div className="text-[10px] text-emerald-300 font-bold uppercase">Active Differ Trade</div>
                  <div className="text-xs font-mono font-black text-white">
                    {serverStatus.activeContract.marketName} ≠ {serverStatus.activeContract.differDigit} (Stake: ${serverStatus.activeContract.stake})
                  </div>
                </div>
                <div className="px-2.5 py-1 rounded bg-emerald-500 text-slate-950 font-black text-xs font-mono animate-pulse">
                  TICK {serverStatus.activeContract.ticksCount}/2
                </div>
              </div>
            )}
          </div>

          {/* ⚡ Dynamic Strategy Matrix Live Grid */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xl">
            {(() => {
              const activeStratList = (serverStatus.availableStrategies && serverStatus.availableStrategies.length > 0)
                ? serverStatus.availableStrategies
                : localBotStrategyMode === 'TRIPLE_THREAT'
                ? [10, 25, 50, 75, 100].map((vol) => ({
                    volatility: vol,
                    label: `Vol ${vol} Tripple Threat`,
                    patternFormula: `[x, x, x] Triple Appearance`,
                    differTargetFormula: `Immediately Buy Differ ≠ x`,
                    durationTicks: 2,
                    description: `Scans all volatility markets simultaneously in parallel. Once any digit appears 3 times in a row (e.g. 4,4,4), immediately buys Differ ≠ that digit with 2-tick duration in that market.`,
                  }))
                : localBotStrategyMode === 'DIFFER_5'
                ? [10, 25, 50, 75, 100].map((vol) => ({
                    volatility: vol,
                    label: `Vol ${vol} Differ 5`,
                    patternFormula: `Detect [5] on Tick Stream`,
                    differTargetFormula: `Immediately Buy Differ ≠ 5`,
                    durationTicks: 1,
                    description: `Scans ticks on Vol ${vol} in ascending ladder until digit 5 appears, then immediately buys Differ ≠ 5 with 1-tick settlement using 24/7 settings.`,
                  }))
                : localBotStrategyMode === 'DIFFER_SINGLE_NUMBER'
                ? [10, 25, 50, 75, 100].map((vol) => ({
                    volatility: vol,
                    label: `Vol ${vol} Differ Single (≠${localDifferSingleTargetDigit})`,
                    patternFormula: `Differ ≠ ${localDifferSingleTargetDigit}`,
                    differTargetFormula: `Predict ≠ ${localDifferSingleTargetDigit}`,
                    durationTicks: localDifferSingleDurationTicks,
                    description: `Trades Digit Differ ${localDifferSingleTargetDigit} on every volatility index with ${localDifferSingleDurationTicks} tick settlement.`,
                  }))
                : localBotStrategyMode === 'LAST_DIGIT_DIFFER'
                ? [10, 25, 50, 75, 100].map((vol) => ({
                    volatility: vol,
                    label: `Vol ${vol} Last Digit Differ`,
                    patternFormula: `[prev_d] ➔ Differ ≠ prev_d`,
                    differTargetFormula: `Predict ≠ Previous Digit`,
                    durationTicks: 1,
                    description: `Trades Digit Differ of the previous tick digit with 1-tick settlement.`,
                  }))
                : localBotStrategyMode === 'TWIN_CLASSIC'
                ? [10, 25, 50, 75, 100].map((vol) => ({
                    volatility: vol,
                    label: `Vol ${vol} Twin Differ`,
                    patternFormula: `[x, x]`,
                    differTargetFormula: `Differ ≠ x`,
                    durationTicks: 2,
                    description: `Scans for twin digits [x, x] and trades Differ ≠ x with 2 ticks settlement.`,
                  }))
                : DEFAULT_STRATEGY_DEFINITIONS;

              const engineTitle =
                localBotStrategyMode === 'MULTI_STRATEGY_MATRIX'
                  ? 'Multi-Strategy Matrix Board'
                  : localBotStrategyMode === 'TRIPLE_THREAT'
                  ? 'Tripple Threat Engine ([x,x,x] ➔ Differ ≠ x, 2 Ticks)'
                  : localBotStrategyMode === 'DIFFER_5'
                  ? 'Differ 5 Engine (Detect Digit 5 ➔ Buy Differ ≠ 5)'
                  : localBotStrategyMode === 'DIFFER_SINGLE_NUMBER'
                  ? `Differ Single Number Engine (≠${localDifferSingleTargetDigit})`
                  : localBotStrategyMode === 'LAST_DIGIT_DIFFER'
                  ? 'Last Digit Differ Engine (1 Tick Settle)'
                  : 'Twin Differ Classic Board';

              const engineSubtitle =
                localBotStrategyMode === 'MULTI_STRATEGY_MATRIX'
                  ? 'Each market executes its dedicated mathematical differing pattern and settle duration. Runs continuously through all markets until you stop.'
                  : localBotStrategyMode === 'TRIPLE_THREAT'
                  ? 'Monitors all volatility markets simultaneously in parallel. As soon as any digit appears thrice (e.g. 4,4,4), it buys Differ ≠ that digit with 2 ticks settlement in that market. After closing, resumes scanning all markets.'
                  : localBotStrategyMode === 'DIFFER_5'
                  ? 'Scans each market in ascending order until digit 5 is detected on the live tick stream, then immediately executes a Differ ≠ 5 trade with 1-tick settlement using 24/7 settings.'
                  : localBotStrategyMode === 'DIFFER_SINGLE_NUMBER'
                  ? `Trades Digit Differ ${localDifferSingleTargetDigit} across all volatility indices in ascending sequence using 24/7 live settings with ${localDifferSingleDurationTicks} tick duration.`
                  : localBotStrategyMode === 'LAST_DIGIT_DIFFER'
                  ? 'Trades Digit Differ of the previous digit on that market with strictly 1 tick to settle the trade using 24/7 live settings.'
                  : 'Uniform [x, x] Differ ≠ x with 2 ticks duration across all ascending volatility markets.';

              return (
                <div className="space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                        <Zap className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-xs font-black uppercase tracking-wider text-white flex items-center gap-2">
                          {engineTitle}
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-mono font-bold border border-emerald-500/40">
                            {activeStratList.length} Markets In Ladder
                          </span>
                        </h4>
                        <p className="text-[11px] text-slate-400">
                          {engineSubtitle}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-slate-400 font-mono">
                        Engine: <strong className="text-emerald-400">{getStrategyModeLabel(localBotStrategyMode)} Active</strong>
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 pt-1">
                    {activeStratList.map((strat) => {
                      const isTripleThreat = localBotStrategyMode === 'TRIPLE_THREAT';
                      const multiMarketData = isTripleThreat
                        ? serverStatus.multiMarketLiveDigits?.find((m) => m.volatility === strat.volatility)
                        : null;
                      const isTripleDetected = multiMarketData?.hasTriple;
                      const isTwinDetected = multiMarketData?.hasTwin;
                      const isCurrent = isTripleThreat
                        ? (serverStatus.isRunning || serverStatus.currentMarket?.volatility === strat.volatility)
                        : serverStatus.currentMarket?.volatility === strat.volatility;
                      const isTraded = serverStatus.tradedInCurrentCycle.some((t) => t.includes(String(strat.volatility)));
                      const activeData = isCurrent ? serverStatus.activeMarketStrategy : null;

                      return (
                        <div
                          key={strat.volatility}
                          className={`relative rounded-xl p-3.5 border transition-all flex flex-col justify-between gap-2.5 ${
                            isTripleDetected
                              ? 'bg-gradient-to-b from-fuchsia-950/90 via-pink-950/70 to-slate-950 border-fuchsia-400 ring-2 ring-fuchsia-500/50 shadow-xl shadow-fuchsia-950/60'
                              : isCurrent
                              ? 'bg-gradient-to-b from-emerald-950/80 via-slate-900 to-slate-950 border-emerald-500 ring-2 ring-emerald-500/40 shadow-lg shadow-emerald-950/40'
                              : isTraded
                              ? 'bg-slate-950/70 border-slate-800/80 text-slate-400'
                              : 'bg-slate-900/60 border-slate-800 text-slate-400'
                          }`}
                        >
                          <div>
                            <div className="flex items-center justify-between text-[11px]">
                              <span className="font-mono font-black text-white">Vol {strat.volatility} Index</span>
                              <span className={`px-2 py-0.5 rounded text-[9px] font-extrabold font-mono uppercase border ${
                                isTripleDetected
                                  ? 'bg-fuchsia-500 text-white border-fuchsia-300 animate-bounce'
                                  : isTwinDetected
                                  ? 'bg-amber-500/30 text-amber-300 border-amber-500/50'
                                  : isCurrent
                                  ? 'bg-emerald-500 text-slate-950 border-emerald-400 animate-pulse'
                                  : isTraded
                                  ? 'bg-slate-800 text-emerald-400 border-slate-700'
                                  : 'bg-slate-950 text-slate-500 border-slate-800'
                              }`}>
                                {isTripleDetected
                                  ? '🔥 TRIPLE!'
                                  : isTwinDetected
                                  ? '⚡ TWIN'
                                  : isCurrent
                                  ? (isTripleThreat ? 'SCANNING' : 'SCANNING')
                                  : isTraded
                                  ? 'TRADED'
                                  : 'PENDING'}
                              </span>
                            </div>

                            <div className="mt-2 space-y-1">
                              <div className="text-xs font-black text-emerald-300 truncate">{strat.label}</div>
                              <div className="flex items-center gap-1.5 text-[11px] font-mono">
                                <span className="text-slate-400">Pattern:</span>
                                <span className="font-bold text-amber-400 px-1.5 py-0.2 rounded bg-amber-950/80 border border-amber-800/60">
                                  {strat.patternFormula}
                                </span>
                              </div>
                              <div className="flex items-center gap-1.5 text-[11px] font-mono">
                                <span className="text-slate-400">Action:</span>
                                <span className="font-black text-cyan-300">
                                  {strat.differTargetFormula}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Multi-Market live ticks preview for Triple Threat mode */}
                          {isTripleThreat && multiMarketData && multiMarketData.digits.length > 0 && (
                            <div className="pt-2 border-t border-slate-800/80 space-y-1">
                              <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono">
                                <span>Live Ticks:</span>
                                {isTripleDetected ? (
                                  <span className="text-fuchsia-300 font-bold flex items-center gap-1">
                                    <Flame className="w-3 h-3 text-fuchsia-400" />
                                    [#{multiMarketData.tripleDigit} x3]
                                  </span>
                                ) : (
                                  <span className="text-slate-500">Last: {multiMarketData.lastDigit ?? '-'}</span>
                                )}
                              </div>
                              <div className="flex items-center gap-1 justify-end overflow-x-hidden">
                                {multiMarketData.digits.slice(-6).map((d, dIdx, arr) => {
                                  const isLast3 = arr.length >= 3 && dIdx >= arr.length - 3 && arr[arr.length - 1] === arr[arr.length - 2] && arr[arr.length - 2] === arr[arr.length - 3];
                                  const isLast2 = arr.length >= 2 && dIdx >= arr.length - 2 && arr[arr.length - 1] === arr[arr.length - 2];
                                  return (
                                    <span
                                      key={dIdx}
                                      className={`w-5 h-5 rounded flex items-center justify-center font-mono font-black text-[10px] ${
                                        isLast3
                                          ? 'bg-fuchsia-500 text-white font-black scale-110 shadow-md shadow-fuchsia-500/50'
                                          : isLast2
                                          ? 'bg-amber-400 text-slate-950 font-black'
                                          : 'bg-slate-800 text-slate-300'
                                      }`}
                                    >
                                      {d}
                                    </span>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[10px]">
                            <span className="text-slate-400">Settle Duration:</span>
                            <span className="font-mono font-black px-1.5 py-0.5 rounded bg-cyan-950/80 border border-cyan-800/60 text-cyan-300">
                              {strat.durationTicks} Tick{strat.durationTicks > 1 ? 's' : ''}
                            </span>
                          </div>

                          {!isTripleThreat && isCurrent && activeData && (
                            <div className={`text-[10px] font-mono px-2 py-1 rounded border text-center ${
                              activeData.isMatched
                                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50 font-bold animate-pulse'
                                : 'bg-slate-950/90 text-amber-300 border-amber-500/30'
                            }`}>
                              {activeData.isMatched
                                ? `MATCHED! ${activeData.matchedPatternDisplay} ➔ ≠ ${activeData.targetDigit}`
                                : 'Watching live tick stream...'}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}
          </div>

          {/* Current Market Scanner & Digit Circles */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left: Digit Radar */}
            <div className="lg:col-span-8 bg-slate-900/80 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-xl">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                    <Radio className="w-4 h-4 text-cyan-400 animate-pulse" />
                    Current Market Digit Stream:
                  </span>
                  <span className="text-sm font-black text-emerald-400 font-mono">
                    {serverStatus.currentMarket?.name || 'Volatility 10 Index'}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-slate-400">Differ Target Trigger:</span>
                  <span className="font-mono font-bold text-amber-400 px-2 py-0.5 rounded bg-amber-950/60 border border-amber-800">
                    {localBotStrategyMode === 'TRIPLE_THREAT'
                      ? 'Parallel Radar [x, x, x] ➔ Differ ≠ x (2t)'
                      : localBotStrategyMode === 'MULTI_STRATEGY_MATRIX'
                      ? `${serverStatus.activeMarketStrategy?.patternFormula || '[d, d]'} ➔ ${serverStatus.activeMarketStrategy?.differTargetFormula || '≠ target'} (${serverStatus.activeMarketStrategy?.durationTicks || 2}t)`
                      : localBotStrategyMode === 'DIFFER_5'
                      ? 'Detect [5] ➔ Buy Differ ≠ 5 (1t)'
                      : localBotStrategyMode === 'DIFFER_SINGLE_NUMBER'
                      ? `Differ ≠ ${localDifferSingleTargetDigit} (${localDifferSingleDurationTicks}t)`
                      : localBotStrategyMode === 'LAST_DIGIT_DIFFER'
                      ? 'Previous Digit ➔ Differ ≠ prev_d (1t)'
                      : 'Twin Digits [d, d] ➔ Differ ≠ d (2t)'}
                  </span>
                </div>
              </div>

              {/* Recent Digits Worm */}
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                  Live Tick Digits Stream (Last 30)
                </span>
                <div className="flex items-center gap-1.5 overflow-x-auto py-2.5 no-scrollbar">
                  {serverStatus.recentDigits && serverStatus.recentDigits.length > 0 ? (
                    serverStatus.recentDigits.map((d, i) => {
                      const len = serverStatus.recentDigits.length;
                      const isLatest = i === len - 1;
                      const isPrev = i === len - 2;
                      const isPrevPrev = i === len - 3;
                      const isTripleMatch =
                        len >= 3 &&
                        (isLatest || isPrev || isPrevPrev) &&
                        serverStatus.recentDigits[len - 1] === serverStatus.recentDigits[len - 2] &&
                        serverStatus.recentDigits[len - 2] === serverStatus.recentDigits[len - 3];
                      const isTwinPair =
                        serverStatus.hasTwinDigit &&
                        (isLatest || isPrev) &&
                        serverStatus.recentDigits[len - 1] === serverStatus.recentDigits[len - 2];

                      return (
                        <div
                          key={i}
                          className={`w-8 h-8 rounded-lg flex items-center justify-center font-mono text-xs font-black shrink-0 transition-all ${
                            isTripleMatch
                              ? 'bg-gradient-to-tr from-fuchsia-600 to-pink-500 text-white scale-115 shadow-lg shadow-fuchsia-500/60 ring-2 ring-fuchsia-300 animate-pulse'
                              : isTwinPair
                              ? 'bg-amber-500 text-slate-950 scale-110 shadow-md shadow-amber-500/50 ring-2 ring-amber-300'
                              : isLatest
                              ? 'bg-emerald-500 text-slate-950 ring-2 ring-emerald-300'
                              : 'bg-slate-800 text-slate-300 border border-slate-700/60'
                          }`}
                        >
                          {d}
                        </div>
                      );
                    })
                  ) : (
                    <div className="text-xs text-slate-500 font-mono py-2">
                      Awaiting live ticks from Deriv WebSocket...
                    </div>
                  )}
                </div>
              </div>

              {/* 10 Digit Circular Gauge Array (0-9) */}
              <div className="pt-2">
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                  0–9 Digits Matrix for {serverStatus.currentMarket?.shortName}
                </span>
                <div className="grid grid-cols-5 sm:grid-cols-10 gap-2 mt-2">
                  {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((digit) => {
                    const isLatest = serverStatus.recentDigits[serverStatus.recentDigits.length - 1] === digit;
                    const isTarget = serverStatus.activeMarketStrategy?.isMatched && serverStatus.activeMarketStrategy?.targetDigit === digit;
                    const isTwin = serverStatus.hasTwinDigit && serverStatus.twinDigit === digit;

                    return (
                      <div
                        key={digit}
                        className={`rounded-xl p-2 text-center border transition-all ${
                          isTarget
                            ? 'bg-purple-600 text-white font-black border-purple-400 scale-105 shadow-lg shadow-purple-500/50 ring-2 ring-purple-300 animate-pulse'
                            : isTwin
                            ? 'bg-amber-500 text-slate-950 font-black border-amber-400 scale-105 shadow-lg shadow-amber-500/40'
                            : isLatest
                            ? 'bg-emerald-500 text-slate-950 font-black border-emerald-400 scale-105'
                            : 'bg-slate-950/70 border-slate-800 text-slate-300'
                        }`}
                      >
                        <div className="text-lg font-mono font-black">{digit}</div>
                        <div className="text-[9px] uppercase font-bold opacity-80 mt-0.5">
                          {isTarget ? 'TARGET ≠' : isTwin ? 'TWIN!' : isLatest ? 'LAST' : `≠${digit}`}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Right: Bot Execution Info & Rule Card */}
            <div className="lg:col-span-4 bg-slate-900/80 border border-slate-800 rounded-2xl p-5 space-y-4 flex flex-col justify-between shadow-xl">
              <div>
                <span className="text-xs uppercase font-extrabold text-slate-300 flex items-center gap-1.5 border-b border-slate-800 pb-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  Differbot Strategy Specifications
                </span>

                <div className="space-y-3 mt-3 text-xs text-slate-300">
                  <div className="flex items-start justify-between">
                    <span className="text-slate-400">Ladder Mode:</span>
                    <span className="font-bold text-white text-right">Ascending 10 ➔ 100</span>
                  </div>
                  <div className="flex items-start justify-between">
                    <span className="text-slate-400">Strategy Engine:</span>
                    <span className="font-bold text-emerald-400 text-right">
                      {localBotStrategyMode === 'MULTI_STRATEGY_MATRIX' ? 'Multi-Strategy Matrix' : 'Twin Differ Classic'}
                    </span>
                  </div>
                  <div className="flex items-start justify-between">
                    <span className="text-slate-400">Market Strategy:</span>
                    <span className="font-bold text-white text-right">
                      {serverStatus.activeMarketStrategy?.label || 'Twin Differ Classic'}
                    </span>
                  </div>
                  <div className="flex items-start justify-between">
                    <span className="text-slate-400">Trigger Pattern:</span>
                    <span className="font-bold text-amber-300 text-right font-mono">
                      {localBotStrategyMode === 'MULTI_STRATEGY_MATRIX'
                        ? (serverStatus.activeMarketStrategy?.patternFormula || '[d, d]')
                        : 'Double Identical [d, d]'}
                    </span>
                  </div>
                  <div className="flex items-start justify-between">
                    <span className="text-slate-400">Contract Type:</span>
                    <span className="font-bold text-cyan-400 text-right">DIGITDIFF (≠ prediction)</span>
                  </div>
                  <div className="flex items-start justify-between">
                    <span className="text-slate-400">Duration:</span>
                    <span className="font-bold text-white text-right font-mono">
                      {serverStatus.activeMarketStrategy?.durationTicks || 2} Tick{(serverStatus.activeMarketStrategy?.durationTicks || 2) > 1 ? 's' : ''} (Settle)
                    </span>
                  </div>
                  <div className="flex items-start justify-between">
                    <span className="text-slate-400">Trades per Market:</span>
                    <span className="font-bold text-emerald-400 text-right">1 Single Trade</span>
                  </div>
                  <div className="flex items-start justify-between">
                    <span className="text-slate-400">Post-Trade Wait:</span>
                    <span className="font-bold text-amber-400 text-right">{localWaitMins} Minutes</span>
                  </div>
                  <div className="flex items-start justify-between">
                    <span className="text-slate-400">Execution Mode:</span>
                    <span className="font-bold text-cyan-300 text-right">Continuous Unbroken Cycles</span>
                  </div>
                  <div className="flex items-start justify-between">
                    <span className="text-slate-400">Stake Mode:</span>
                    <span className="font-bold text-purple-400 text-right">
                      {localStakeMode === 'FIXED' ? 'Fixed Base Stake' : `Compounding (${localCompoundingPercent}%)`}
                    </span>
                  </div>
                </div>
              </div>

              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-[11px] text-slate-400 leading-relaxed">
                💡 <strong>How it works:</strong> The bot watches {serverStatus.currentMarket?.shortName}. When the designated pattern appears, it enters a Differ trade settling in {serverStatus.activeMarketStrategy?.durationTicks || 2} tick(s). After settlement, it starts the {localWaitMins}-minute wait timer, then smoothly shifts to {serverStatus.nextMarket?.shortName}, repeating throughout all cycles.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: SETTINGS & CONFIGURATION */}
      {activeTab === 'SETTINGS' && (
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 space-y-6 shadow-xl max-w-4xl">
          <div className="border-b border-slate-800 pb-4">
            <h3 className="text-lg font-black text-white flex items-center gap-2">
              <Sliders className="w-5 h-5 text-emerald-400" />
              System Auto Live Bot Settings
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Configure market wait times, fixed vs compounding stake modes, and session risk guards.
            </p>
          </div>

          {/* Bot Strategy Architecture Selector */}
          <div className="space-y-4 bg-slate-950 p-5 rounded-2xl border border-slate-800">
            <div className="flex items-center justify-between">
              <label className="text-xs uppercase font-extrabold text-slate-300 flex items-center gap-1.5">
                <Zap className="w-4 h-4 text-emerald-400" />
                Strategy Execution Engine
              </label>
              <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-mono font-bold uppercase border ${
                localBotStrategyMode === 'TRIPLE_THREAT'
                  ? 'bg-fuchsia-500/20 text-fuchsia-300 border-fuchsia-500/40'
                  : localBotStrategyMode === 'MULTI_STRATEGY_MATRIX'
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                  : localBotStrategyMode === 'DIFFER_5'
                  ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                  : localBotStrategyMode === 'DIFFER_SINGLE_NUMBER'
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                  : localBotStrategyMode === 'LAST_DIGIT_DIFFER'
                  ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40'
                  : 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
              }`}>
                {getStrategyModeLabel(localBotStrategyMode)} Active
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Select which automated algorithm runs across the volatility markets using the 24/7 live settings.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
              {/* Option 1: Tripple Threat Bot */}
              <button
                type="button"
                onClick={() => setLocalBotStrategyMode('TRIPLE_THREAT')}
                className={`p-4 rounded-xl text-left border transition-all flex flex-col justify-between gap-2 cursor-pointer ${
                  localBotStrategyMode === 'TRIPLE_THREAT'
                    ? 'bg-gradient-to-br from-violet-950/80 via-fuchsia-950/60 to-slate-900 border-fuchsia-500 text-white shadow-lg ring-1 ring-fuchsia-500/40'
                    : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-fuchsia-300 flex items-center gap-1.5">
                      <Flame className="w-3.5 h-3.5" /> Tripple Threat Bot
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-fuchsia-500/20 text-fuchsia-300 font-mono font-bold">
                      All-Markets [x,x,x]
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-300 leading-relaxed mt-1">
                    Scans <strong>ALL markets at once in parallel</strong>. Once it detects a digit that appears thrice consecutively (<span className="font-mono text-amber-300">e.g. 4, 4, 4</span>), it buys <span className="font-mono text-amber-300">Differ ≠ that digit</span> using <span className="text-white font-bold">2 ticks duration</span>. When trade closes, restarts scanning all markets.
                  </p>
                </div>
                <div className="text-[10px] text-fuchsia-400 font-mono flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Simultaneous multi-market radar + 2t Differ ≠ x
                </div>
              </button>

              {/* Option 2: Multi-Strategy Matrix */}
              <button
                type="button"
                onClick={() => setLocalBotStrategyMode('MULTI_STRATEGY_MATRIX')}
                className={`p-4 rounded-xl text-left border transition-all flex flex-col justify-between gap-2 cursor-pointer ${
                  localBotStrategyMode === 'MULTI_STRATEGY_MATRIX'
                    ? 'bg-emerald-950/70 border-emerald-500 text-white shadow-lg ring-1 ring-emerald-500/40'
                    : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-emerald-300 flex items-center gap-1.5">
                      <Zap className="w-3.5 h-3.5" /> Multi-Strategy Matrix
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-mono font-bold">
                      Per-Market Rules
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-300 leading-relaxed mt-1">
                    Vol 10: <span className="font-mono text-amber-300">[x,x]≠x (2t)</span> • Vol 25: <span className="font-mono text-amber-300">[x,x,y]≠y (1t)</span> • Vol 50: <span className="font-mono text-amber-300">[x,x,y]≠x (1t)</span> • Vol 75: <span className="font-mono text-amber-300">[x,y,x,x]≠x (1t)</span> • Vol 100: <span className="font-mono text-amber-300">[x,x,y,x]≠x (1t)</span>.
                  </p>
                </div>
                <div className="text-[10px] text-emerald-400 font-mono flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Continuous 24/7 cycles with dedicated math
                </div>
              </button>

              {/* Option 2: Differ 5 Bot (Detect 5 ➔ Buy Differ ≠ 5) */}
              <button
                type="button"
                onClick={() => setLocalBotStrategyMode('DIFFER_5')}
                className={`p-4 rounded-xl text-left border transition-all flex flex-col justify-between gap-2 cursor-pointer ${
                  localBotStrategyMode === 'DIFFER_5'
                    ? 'bg-rose-950/70 border-rose-500 text-white shadow-lg ring-1 ring-rose-500/40'
                    : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-rose-300 flex items-center gap-1.5">
                      <Target className="w-3.5 h-3.5" /> Differ 5 (Detect 5 ➔ Buy)
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 font-mono font-bold">
                      [5] Detected
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-300 leading-relaxed mt-1">
                    Scans all markets in ascending sequence (<span className="text-white font-semibold">Vol 10 ➔ 25 ➔ 50 ➔ 75 ➔ 100</span>). Once it detects digit <span className="font-mono font-black text-rose-300">5</span>, it immediately buys <span className="font-mono font-black text-amber-300">Differ ≠ 5</span> with 1-tick settlement using 24/7 settings.
                  </p>
                </div>
                <div className="text-[10px] text-rose-400 font-mono flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Immediate buy upon digit 5 detection + 1t settle
                </div>
              </button>

              {/* Option 2: Differ Single Number (Differ 5) */}
              <button
                type="button"
                onClick={() => setLocalBotStrategyMode('DIFFER_SINGLE_NUMBER')}
                className={`p-4 rounded-xl text-left border transition-all flex flex-col justify-between gap-2 cursor-pointer ${
                  localBotStrategyMode === 'DIFFER_SINGLE_NUMBER'
                    ? 'bg-amber-950/70 border-amber-500 text-white shadow-lg ring-1 ring-amber-500/40'
                    : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-amber-300 flex items-center gap-1.5">
                      <Target className="w-3.5 h-3.5" /> Differ Single Number (Differ 5)
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-mono font-bold">
                      ≠ {localDifferSingleTargetDigit} Bot
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-300 leading-relaxed mt-1">
                    Trades Digit Differ <span className="font-mono font-black text-amber-300">≠ {localDifferSingleTargetDigit}</span> on every volatility index in ascending sequence with <span className="font-mono text-cyan-300">{localDifferSingleDurationTicks} tick</span> duration using 24/7 settings.
                  </p>
                </div>
                <div className="text-[10px] text-amber-400 font-mono flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Fixed differ digit across all ascending markets
                </div>
              </button>

              {/* Option 3: Last Digit Differ */}
              <button
                type="button"
                onClick={() => setLocalBotStrategyMode('LAST_DIGIT_DIFFER')}
                className={`p-4 rounded-xl text-left border transition-all flex flex-col justify-between gap-2 cursor-pointer ${
                  localBotStrategyMode === 'LAST_DIGIT_DIFFER'
                    ? 'bg-indigo-950/70 border-indigo-500 text-white shadow-lg ring-1 ring-indigo-500/40'
                    : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-indigo-300 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5" /> Last Digit Differ (1 Tick)
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 font-mono font-bold">
                      1-Tick Fast
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-300 leading-relaxed mt-1">
                    Trades Digit Differ of the previous digit on that market (<span className="font-mono text-amber-300">Differ ≠ Previous Tick</span>) with strictly <span className="font-mono font-black text-cyan-300">1 tick</span> to settle the trade using 24/7 settings.
                  </p>
                </div>
                <div className="text-[10px] text-indigo-400 font-mono flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Previous digit tracking + ultra-fast 1-tick settlement
                </div>
              </button>

              {/* Option 4: Twin Differ Classic */}
              <button
                type="button"
                onClick={() => setLocalBotStrategyMode('TWIN_CLASSIC')}
                className={`p-4 rounded-xl text-left border transition-all flex flex-col justify-between gap-2 cursor-pointer ${
                  localBotStrategyMode === 'TWIN_CLASSIC'
                    ? 'bg-cyan-950/70 border-cyan-500 text-white shadow-lg ring-1 ring-cyan-500/40'
                    : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-cyan-300 flex items-center gap-1.5">
                      <RefreshCw className="w-3.5 h-3.5" /> Twin Differ Classic
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 font-mono font-bold">
                      Uniform Rule
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-300 leading-relaxed mt-1">
                    Identical <span className="font-mono text-amber-300">[d, d]</span> twin digit trigger on all markets with Differ ≠ d prediction and 2 ticks duration.
                  </p>
                </div>
                <div className="text-[10px] text-cyan-400 font-mono flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Standard twin differ logic
                </div>
              </button>
            </div>

            {/* In-Depth Customization for Differ Single Number Bot */}
            {localBotStrategyMode === 'DIFFER_SINGLE_NUMBER' && (
              <div className="bg-slate-900/90 border border-amber-500/30 rounded-xl p-4 space-y-3">
                <div className="flex items-center gap-2 text-amber-300 text-xs font-bold">
                  <Target className="w-4 h-4" />
                  <span>Differ Single Number Bot Configuration</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div>
                    <label className="block text-slate-400 text-[11px] mb-1 font-mono">
                      Target Differ Digit (0-9):
                    </label>
                    <div className="flex items-center gap-1.5">
                      {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => (
                        <button
                          key={d}
                          type="button"
                          onClick={() => setLocalDifferSingleTargetDigit(d)}
                          className={`w-7 h-7 rounded-lg text-xs font-mono font-black transition-all cursor-pointer ${
                            localDifferSingleTargetDigit === d
                              ? 'bg-amber-400 text-slate-950 font-black shadow-md scale-105 ring-2 ring-amber-300'
                              : 'bg-slate-800 text-slate-400 hover:text-white border border-slate-700'
                          }`}
                        >
                          {d}
                        </button>
                      ))}
                    </div>
                    <span className="text-[10px] text-slate-400 mt-1 block">
                      Default is <strong>Digit 5</strong> as specified. Bot executes contract Differ ≠ {localDifferSingleTargetDigit}.
                    </span>
                  </div>

                  <div>
                    <label className="block text-slate-400 text-[11px] mb-1 font-mono">
                      Settlement Duration (Ticks):
                    </label>
                    <div className="flex items-center gap-2">
                      {[1, 2, 3, 5].map((ticks) => (
                        <button
                          key={ticks}
                          type="button"
                          onClick={() => setLocalDifferSingleDurationTicks(ticks)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${
                            localDifferSingleDurationTicks === ticks
                              ? 'bg-amber-500 text-slate-950 font-black shadow-md ring-2 ring-amber-300'
                              : 'bg-slate-800 text-slate-400 hover:text-white border border-slate-700'
                          }`}
                        >
                          {ticks} {ticks === 1 ? 'Tick' : 'Ticks'}
                        </button>
                      ))}
                    </div>
                    <span className="text-[10px] text-slate-400 mt-1 block">
                      Contract lifetime from entry spot to settlement.
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Stake Mode Choice */}
            <div className="space-y-3 bg-slate-950 p-4 rounded-xl border border-slate-800">
              <label className="text-xs uppercase font-extrabold text-slate-300 flex items-center gap-1.5">
                <DollarSign className="w-4 h-4 text-emerald-400" />
                Stake Management Option
              </label>
              <p className="text-[11px] text-slate-400">
                Choose whether each trade maintains a fixed stake or compounds on winning streaks.
              </p>

              <div className="grid grid-cols-3 gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setLocalStakeMode('FIXED')}
                  className={`py-2 px-2 rounded-xl text-xs font-bold border transition-all flex flex-col items-center gap-0.5 cursor-pointer ${
                    localStakeMode === 'FIXED'
                      ? 'bg-emerald-600 text-white border-emerald-500 shadow-md'
                      : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                  }`}
                >
                  <span className="font-black">FIXED</span>
                  <span className="text-[9px] font-normal opacity-80">Constant stake</span>
                </button>

                <button
                  type="button"
                  onClick={() => setLocalStakeMode('COMPOUNDING')}
                  className={`py-2 px-2 rounded-xl text-xs font-bold border transition-all flex flex-col items-center gap-0.5 cursor-pointer ${
                    localStakeMode === 'COMPOUNDING'
                      ? 'bg-emerald-600 text-white border-emerald-500 shadow-md'
                      : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                  }`}
                >
                  <span className="font-black">COMPOUND</span>
                  <span className="text-[9px] font-normal opacity-80">Reinvest wins</span>
                </button>

                <button
                  type="button"
                  onClick={() => setLocalStakeMode('MARTINGALE')}
                  className={`py-2 px-2 rounded-xl text-xs font-bold border transition-all flex flex-col items-center gap-0.5 cursor-pointer ${
                    localStakeMode === 'MARTINGALE'
                      ? 'bg-rose-600 text-white border-rose-500 shadow-md ring-1 ring-rose-300'
                      : 'bg-slate-900 text-rose-400 border-slate-800 hover:text-white'
                  }`}
                >
                  <span className="font-black flex items-center gap-1">
                    <Zap className="w-3 h-3 fill-amber-300 text-amber-300" />
                    MARTINGALE
                  </span>
                  <span className="text-[9px] font-normal opacity-80">Loss recovery</span>
                </button>
              </div>

              {/* Base Stake input */}
              <div className="pt-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Base Stake (USD)</span>
                <input
                  type="number"
                  step="0.1"
                  min="0.35"
                  max="1000"
                  value={localBaseStake}
                  onChange={(e) => setLocalBaseStake(Number(e.target.value) || 0.50)}
                  className="w-full mt-1 bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white font-mono outline-none focus:border-emerald-500"
                />
              </div>

              {/* Martingale settings if selected */}
              {localStakeMode === 'MARTINGALE' && (
                <div className="p-3 bg-rose-950/30 border border-rose-500/30 rounded-xl space-y-2.5">
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-rose-300 uppercase">Martingale Multiplier</span>
                      <span className="text-xs font-mono font-bold text-rose-400">{localMartingaleMultiplier}x</span>
                    </div>
                    <div className="flex items-center gap-1.5 mt-1">
                      {[1.5, 2.0, 2.5, 11.2].map((m) => (
                        <button
                          key={m}
                          type="button"
                          onClick={() => setLocalMartingaleMultiplier(m)}
                          className={`px-2 py-1 rounded-lg text-xs font-mono font-bold border transition-all cursor-pointer ${
                            Math.abs(localMartingaleMultiplier - m) < 0.05
                              ? 'bg-rose-500 text-white border-rose-400 shadow'
                              : 'bg-slate-900 text-slate-400 border-slate-700 hover:text-white'
                          }`}
                        >
                          {m === 11.2 ? '11.2x (Differ⚡)' : `${m}x`}
                        </button>
                      ))}
                      <input
                        type="number"
                        step="0.1"
                        min="1.1"
                        max="25"
                        value={localMartingaleMultiplier}
                        onChange={(e) => setLocalMartingaleMultiplier(Number(e.target.value) || 11.2)}
                        className="w-20 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-xs text-rose-300 font-mono text-center outline-none focus:border-rose-400"
                      />
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1">
                      Multiplies stake on loss. 11.2x recovers loss + secures net profit on 1-tick Differ contracts (~9.5% payout).
                    </p>
                  </div>

                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-rose-300 uppercase">Max Martingale Steps</span>
                      <span className="text-xs font-mono font-bold text-rose-400">{localMaxMartingaleSteps} Steps</span>
                    </div>
                    <div className="flex items-center gap-1.5 mt-1">
                      {[2, 3, 4, 6].map((steps) => (
                        <button
                          key={steps}
                          type="button"
                          onClick={() => setLocalMaxMartingaleSteps(steps)}
                          className={`px-3 py-1 rounded-lg text-xs font-mono font-bold border transition-all cursor-pointer ${
                            localMaxMartingaleSteps === steps
                              ? 'bg-rose-500 text-white border-rose-400 shadow'
                              : 'bg-slate-900 text-slate-400 border-slate-700 hover:text-white'
                          }`}
                        >
                          {steps} Steps
                        </button>
                      ))}
                      <input
                        type="number"
                        min="1"
                        max="10"
                        value={localMaxMartingaleSteps}
                        onChange={(e) => setLocalMaxMartingaleSteps(Number(e.target.value) || 4)}
                        className="w-16 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-xs text-rose-300 font-mono text-center outline-none focus:border-rose-400"
                      />
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1">
                      Safety limit: resets back to base stake after {localMaxMartingaleSteps} consecutive losses to prevent runaway drawdowns.
                    </p>
                  </div>
                </div>
              )}

              {/* Settlement Duration (Ticks) Setting */}
              <div className="pt-2 border-t border-slate-900">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-cyan-300 uppercase flex items-center gap-1">
                    <Clock className="w-3 h-3 text-cyan-400" /> Contract Settlement Duration (Ticks)
                  </span>
                  <span className="text-xs font-mono font-bold text-cyan-300">
                    {localDurationTicks} {localDurationTicks === 1 ? 'Tick (⚡ Instant)' : 'Ticks'}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 mt-1.5">
                  {[1, 2, 3, 5, 10].map((ticks) => (
                    <button
                      key={ticks}
                      type="button"
                      onClick={() => {
                        setLocalDurationTicks(ticks);
                        setLocalDifferSingleDurationTicks(ticks);
                      }}
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-mono font-bold border transition-all cursor-pointer ${
                        localDurationTicks === ticks
                          ? 'bg-cyan-500 text-slate-950 border-cyan-400 font-black shadow-md'
                          : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                      }`}
                    >
                      {ticks === 1 ? '1 Tick ⚡' : `${ticks} Ticks`}
                    </button>
                  ))}
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={localDurationTicks}
                    onChange={(e) => {
                      const v = Number(e.target.value) || 1;
                      setLocalDurationTicks(v);
                      setLocalDifferSingleDurationTicks(v);
                    }}
                    className="w-16 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-cyan-300 font-mono text-center outline-none focus:border-cyan-400"
                  />
                </div>
                <p className="text-[10px] text-slate-500 mt-1">
                  1-tick contract settles on the next spot tick. Dynamic across all strategies.
                </p>
              </div>

              {/* Compounding % if selected */}
              {localStakeMode === 'COMPOUNDING' && (
                <div className="pt-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Compounding Reinvestment %</span>
                  <input
                    type="number"
                    min="10"
                    max="100"
                    value={localCompoundingPercent}
                    onChange={(e) => setLocalCompoundingPercent(Number(e.target.value) || 50)}
                    className="w-full mt-1 bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-emerald-400 font-mono outline-none focus:border-emerald-500"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">Reinvests {localCompoundingPercent}% of accumulated win profit into subsequent stakes.</p>
                </div>
              )}
            </div>

            {/* Wait Minutes Between Markets */}
            <div className="space-y-3 bg-slate-950 p-4 rounded-xl border border-slate-800">
              <label className="text-xs uppercase font-extrabold text-slate-300 flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-amber-400" />
                Wait Minutes Between Markets
              </label>
              <p className="text-[11px] text-slate-400">
                When the trade closes, the bot pauses for this duration before scanning the next market in ascending ladder.
              </p>

              <div className="grid grid-cols-4 gap-2 pt-1">
                {[1, 2, 5, 10].map((mins) => (
                  <button
                    key={mins}
                    type="button"
                    onClick={() => setLocalWaitMins(mins)}
                    className={`py-2 rounded-xl text-xs font-bold border transition-all ${
                      localWaitMins === mins
                        ? 'bg-amber-500 text-slate-950 font-black border-amber-400 shadow-md'
                        : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                    }`}
                  >
                    {mins} Min{mins > 1 ? 's' : ''}
                  </button>
                ))}
              </div>

              <div className="pt-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Custom Wait Minutes</span>
                <input
                  type="number"
                  min="0.5"
                  max="120"
                  step="0.5"
                  value={localWaitMins}
                  onChange={(e) => setLocalWaitMins(Math.max(0.1, Number(e.target.value) || 5))}
                  className="w-full mt-1 bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-amber-300 font-mono outline-none focus:border-amber-500"
                />
              </div>

              {/* Market Scope */}
              <div className="pt-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Ascending Market Selection</span>
                <select
                  value={localMarketListType}
                  onChange={(e) => setLocalMarketListType(e.target.value as any)}
                  className="w-full mt-1 bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono outline-none focus:border-emerald-500"
                >
                  <option value="STANDARD_10_TO_100">Standard Vol 10 ➔ 25 ➔ 50 ➔ 75 ➔ 100 Index</option>
                  <option value="ONESECOND_10_TO_100">Vol (1s) 10 ➔ 25 ➔ 50 ➔ 75 ➔ 100 (1s) Index</option>
                  <option value="ALL_10_TO_100">Full Combined Ascending List (10 markets)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Risk Management Section */}
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
            <span className="text-xs uppercase font-extrabold text-slate-300 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-cyan-400" />
              Take Profit & Stop Loss Risk Guards
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase">Take Profit (USD)</span>
                <input
                  type="number"
                  min="1"
                  max="10000"
                  value={localTakeProfit}
                  onChange={(e) => setLocalTakeProfit(Number(e.target.value) || 50)}
                  className="w-full mt-1 bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-emerald-400 font-mono outline-none focus:border-emerald-500"
                />
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase">Stop Loss (USD)</span>
                <input
                  type="number"
                  min="1"
                  max="10000"
                  value={localStopLoss}
                  onChange={(e) => setLocalStopLoss(Number(e.target.value) || 50)}
                  className="w-full mt-1 bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-rose-400 font-mono outline-none focus:border-rose-500"
                />
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase">Max Consecutive Losses</span>
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={localMaxLosses}
                  onChange={(e) => setLocalMaxLosses(Number(e.target.value) || 3)}
                  className="w-full mt-1 bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-amber-400 font-mono outline-none focus:border-amber-500"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              onClick={() => setActiveTab('MONITOR')}
              className="px-5 py-2.5 rounded-xl text-xs font-bold text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 transition-all"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveConfig}
              disabled={isLoading}
              className="px-6 py-2.5 rounded-xl text-xs font-black text-slate-950 bg-gradient-to-r from-emerald-400 to-cyan-400 hover:from-emerald-300 hover:to-cyan-300 shadow-md transition-all"
            >
              Save Configuration
            </button>
          </div>
        </div>
      )}

      {/* TAB 3: TRADE HISTORY LOGS */}
      {activeTab === 'LOGS' && (
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-emerald-400" />
              <span className="text-xs font-bold uppercase tracking-wider text-white">
                Live Background Trades ({filteredHistory.length})
              </span>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex rounded-lg bg-slate-950 p-1 border border-slate-800">
                {(['ALL', 'WINS', 'LOSSES'] as const).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setHistoryFilter(mode)}
                    className={`px-3 py-1 rounded text-[10px] font-bold transition-all ${
                      historyFilter === mode ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {mode}
                  </button>
                ))}
              </div>

              <button
                onClick={handleExportCSV}
                disabled={tradeHistory.length === 0}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-all disabled:opacity-40"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export CSV</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  strategyShield.purgeAllTradeHistoryAndFootprint();
                  setTradeHistory([]);
                }}
                title="Purge all trade history logs to eliminate strategy tracking footprints"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-950/70 hover:bg-rose-900 border border-rose-800 text-rose-300 text-xs font-bold transition-all"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Purge History</span>
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-[10px] uppercase font-bold text-slate-400 bg-slate-950/60">
                  <th className="py-2.5 px-3">Time</th>
                  <th className="py-2.5 px-3">Market</th>
                  <th className="py-2.5 px-3">Trigger Pattern</th>
                  <th className="py-2.5 px-3">Differ Prediction</th>
                  <th className="py-2.5 px-3">Duration</th>
                  <th className="py-2.5 px-3">Intermediate (T1)</th>
                  <th className="py-2.5 px-3">Settle Tick</th>
                  <th className="py-2.5 px-3">Stake</th>
                  <th className="py-2.5 px-3">Profit</th>
                  <th className="py-2.5 px-3">Cycle</th>
                  <th className="py-2.5 px-3">Result</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {filteredHistory.length > 0 ? (
                  filteredHistory.map((trade) => {
                    const isWin = trade.result === 'WIN';
                    const dur = trade.durationTicks ?? (trade.marketName?.includes('10 ') ? 2 : 1);
                    return (
                      <tr key={trade.id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="py-2.5 px-3 text-slate-400 text-[11px] whitespace-nowrap">{trade.timeString}</td>
                        <td className="py-2.5 px-3 font-bold text-white whitespace-nowrap">
                          <div>{trade.marketName}</div>
                          {trade.strategyLabel && (
                            <div className="text-[9px] text-emerald-400 font-sans">{trade.strategyLabel}</div>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-amber-400 whitespace-nowrap font-bold">{trade.twinPattern}</td>
                        <td className="py-2.5 px-3 text-cyan-300 whitespace-nowrap font-black">≠ {trade.differDigit}</td>
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            dur === 1
                              ? 'bg-cyan-950/80 text-cyan-300 border border-cyan-800/60'
                              : 'bg-indigo-950/80 text-indigo-300 border border-indigo-800/60'
                          }`}>
                            {dur} Tick{dur > 1 ? 's' : ''}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-slate-400">
                          {dur === 1 ? (
                            <span className="text-slate-500 italic text-[10px]">Instant (1-Tick)</span>
                          ) : trade.intermediateDigit !== null ? (
                            `[${trade.intermediateDigit}]`
                          ) : (
                            '—'
                          )}
                        </td>
                        <td className="py-2.5 px-3 font-bold text-white">
                          {trade.exitDigit !== null ? `[${trade.exitDigit}]` : '—'}
                        </td>
                        <td className="py-2.5 px-3 text-slate-300">${trade.stake.toFixed(2)}</td>
                        <td className={`py-2.5 px-3 font-bold ${isWin ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {trade.profit >= 0 ? '+' : ''}${trade.profit.toFixed(2)}
                        </td>
                        <td className="py-2.5 px-3 text-purple-400">#{trade.cycleNumber}</td>
                        <td className="py-2.5 px-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              isWin
                                ? 'bg-emerald-950/80 border border-emerald-500/60 text-emerald-300'
                                : 'bg-rose-950/80 border border-rose-500/60 text-rose-300'
                            }`}
                          >
                            {trade.result}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={11} className="py-8 text-center text-slate-500 text-xs font-sans">
                      No live background trades recorded yet. Start the 24/7 Live Bot to begin trading the ascending ladder.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
