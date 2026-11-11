import fs from 'fs';
import path from 'path';

export interface AscendingMarketDef {
  symbol: string;
  name: string;
  shortName: string;
  volatility: number;
  pipSize: number;
  isOneSecond?: boolean;
}

export const ASCENDING_MARKETS_STANDARD: AscendingMarketDef[] = [
  { symbol: 'R_10', name: 'Volatility 10 Index', shortName: 'Vol 10', volatility: 10, pipSize: 3 },
  { symbol: 'R_25', name: 'Volatility 25 Index', shortName: 'Vol 25', volatility: 25, pipSize: 3 },
  { symbol: 'R_50', name: 'Volatility 50 Index', shortName: 'Vol 50', volatility: 50, pipSize: 4 },
  { symbol: 'R_75', name: 'Volatility 75 Index', shortName: 'Vol 75', volatility: 75, pipSize: 4 },
  { symbol: 'R_100', name: 'Volatility 100 Index', shortName: 'Vol 100', volatility: 100, pipSize: 2 },
];

export const ASCENDING_MARKETS_ONESECOND: AscendingMarketDef[] = [
  { symbol: '1HZ10V', name: 'Volatility 10 (1s) Index', shortName: 'Vol 10 (1s)', volatility: 10, pipSize: 2, isOneSecond: true },
  { symbol: '1HZ15V', name: 'Volatility 15 (1s) Index', shortName: 'Vol 15 (1s)', volatility: 15, pipSize: 2, isOneSecond: true },
  { symbol: '1HZ25V', name: 'Volatility 25 (1s) Index', shortName: 'Vol 25 (1s)', volatility: 25, pipSize: 2, isOneSecond: true },
  { symbol: '1HZ30V', name: 'Volatility 30 (1s) Index', shortName: 'Vol 30 (1s)', volatility: 30, pipSize: 2, isOneSecond: true },
  { symbol: '1HZ50V', name: 'Volatility 50 (1s) Index', shortName: 'Vol 50 (1s)', volatility: 50, pipSize: 2, isOneSecond: true },
  { symbol: '1HZ75V', name: 'Volatility 75 (1s) Index', shortName: 'Vol 75 (1s)', volatility: 75, pipSize: 2, isOneSecond: true },
  { symbol: '1HZ90V', name: 'Volatility 90 (1s) Index', shortName: 'Vol 90 (1s)', volatility: 90, pipSize: 2, isOneSecond: true },
  { symbol: '1HZ100V', name: 'Volatility 100 (1s) Index', shortName: 'Vol 100 (1s)', volatility: 100, pipSize: 2, isOneSecond: true },
];

export type BotStrategyMode =
  | 'MULTI_STRATEGY_MATRIX'
  | 'TRIPLE_THREAT'
  | 'DOUBLE_BOT'
  | 'DIFFER_5'
  | 'DIFFER_SINGLE_NUMBER'
  | 'LAST_DIGIT_DIFFER'
  | 'TWIN_CLASSIC'
  | 'ALTERNATING_DIGITS'
  | 'TWIN_0_AND_9_DIFFER';

export interface MarketStrategyRule {
  volatility: number;
  label: string;
  patternFormula: string;
  differTargetFormula: string;
  durationTicks: number;
  description: string;
  checkMatch: (digits: number[]) => {
    isMatched: boolean;
    targetDigit: number | null;
    patternDisplay: string;
    details: string;
  };
}

export const MULTI_STRATEGY_RULES: Record<number, MarketStrategyRule> = {
  10: {
    volatility: 10,
    label: 'Vol 10 Twin Differ [x, x] ➔ ≠x (2t)',
    patternFormula: '[x, x]',
    differTargetFormula: 'Differ ≠ x',
    durationTicks: 2,
    description: 'Scans for twin identical digits [x, x] ➔ executes Differ ≠ x with 2 ticks settlement.',
    checkMatch: (digits: number[]) => {
      if (digits.length < 2) return { isMatched: false, targetDigit: null, patternDisplay: '', details: 'Awaiting digits...' };
      const d2 = digits[digits.length - 2];
      const d1 = digits[digits.length - 1];
      if (d2 === d1) {
        return {
          isMatched: true,
          targetDigit: d1,
          patternDisplay: `[${d2}, ${d1}]`,
          details: `Twin [${d2}, ${d1}] matched ➔ Target Differ ≠ ${d1} (2 Ticks)`,
        };
      }
      return { isMatched: false, targetDigit: null, patternDisplay: '', details: `Current: [${d2}, ${d1}] (Awaiting twin [x, x])` };
    },
  },
  15: {
    volatility: 15,
    label: 'Vol 15 Twin Differ [x, x] ➔ ≠x (1t)',
    patternFormula: '[x, x]',
    differTargetFormula: 'Differ ≠ x',
    durationTicks: 1,
    description: 'Scans for twin identical digits [x, x] ➔ executes Differ ≠ x with 1 tick settlement.',
    checkMatch: (digits: number[]) => {
      if (digits.length < 2) return { isMatched: false, targetDigit: null, patternDisplay: '', details: 'Awaiting digits...' };
      const d2 = digits[digits.length - 2];
      const d1 = digits[digits.length - 1];
      if (d2 === d1) {
        return {
          isMatched: true,
          targetDigit: d1,
          patternDisplay: `[${d2}, ${d1}]`,
          details: `Twin [${d2}, ${d1}] matched ➔ Target Differ ≠ ${d1} (1 Tick)`,
        };
      }
      return { isMatched: false, targetDigit: null, patternDisplay: '', details: `Current: [${d2}, ${d1}] (Awaiting twin [x, x])` };
    },
  },
  25: {
    volatility: 25,
    label: 'Vol 25 Pivot Differ [x, x, y] ➔ ≠y (1t)',
    patternFormula: '[x, x, y]',
    differTargetFormula: 'Differ ≠ y',
    durationTicks: 1,
    description: 'Scans for [x, x, y] pattern (twin x followed by pivot y) ➔ executes Differ ≠ y with 1 tick settlement.',
    checkMatch: (digits: number[]) => {
      if (digits.length < 3) return { isMatched: false, targetDigit: null, patternDisplay: '', details: 'Awaiting digits...' };
      const d3 = digits[digits.length - 3];
      const d2 = digits[digits.length - 2];
      const d1 = digits[digits.length - 1];
      if (d3 === d2 && d1 !== d3) {
        return {
          isMatched: true,
          targetDigit: d1,
          patternDisplay: `[${d3}, ${d2}, ${d1}]`,
          details: `Pattern [${d3}, ${d2}, ${d1}] matched ➔ Target Differ ≠ ${d1} (1 Tick)`,
        };
      }
      return { isMatched: false, targetDigit: null, patternDisplay: '', details: `Current: [${d3}, ${d2}, ${d1}] (Awaiting [x, x, y])` };
    },
  },
  30: {
    volatility: 30,
    label: 'Vol 30 Pivot Differ [x, x, y] ➔ ≠y (1t)',
    patternFormula: '[x, x, y]',
    differTargetFormula: 'Differ ≠ y',
    durationTicks: 1,
    description: 'Scans for [x, x, y] pattern (twin x followed by pivot y) ➔ executes Differ ≠ y with 1 tick settlement.',
    checkMatch: (digits: number[]) => {
      if (digits.length < 3) return { isMatched: false, targetDigit: null, patternDisplay: '', details: 'Awaiting digits...' };
      const d3 = digits[digits.length - 3];
      const d2 = digits[digits.length - 2];
      const d1 = digits[digits.length - 1];
      if (d3 === d2 && d1 !== d3) {
        return {
          isMatched: true,
          targetDigit: d1,
          patternDisplay: `[${d3}, ${d2}, ${d1}]`,
          details: `Pattern [${d3}, ${d2}, ${d1}] matched ➔ Target Differ ≠ ${d1} (1 Tick)`,
        };
      }
      return { isMatched: false, targetDigit: null, patternDisplay: '', details: `Current: [${d3}, ${d2}, ${d1}] (Awaiting [x, x, y])` };
    },
  },
  50: {
    volatility: 50,
    label: 'Vol 50 Twin Rebound [x, x, y] ➔ ≠x (1t)',
    patternFormula: '[x, x, y]',
    differTargetFormula: 'Differ ≠ x',
    durationTicks: 1,
    description: 'Scans for [x, x, y] pattern (twin x followed by y) ➔ executes Differ ≠ x with 1 tick settlement.',
    checkMatch: (digits: number[]) => {
      if (digits.length < 3) return { isMatched: false, targetDigit: null, patternDisplay: '', details: 'Awaiting digits...' };
      const d3 = digits[digits.length - 3];
      const d2 = digits[digits.length - 2];
      const d1 = digits[digits.length - 1];
      if (d3 === d2 && d1 !== d3) {
        return {
          isMatched: true,
          targetDigit: d3,
          patternDisplay: `[${d3}, ${d2}, ${d1}]`,
          details: `Pattern [${d3}, ${d2}, ${d1}] matched ➔ Target Differ ≠ ${d3} (1 Tick)`,
        };
      }
      return { isMatched: false, targetDigit: null, patternDisplay: '', details: `Current: [${d3}, ${d2}, ${d1}] (Awaiting [x, x, y])` };
    },
  },
  75: {
    volatility: 75,
    label: 'Vol 75 Bookend Differ [x, y, x, x] ➔ ≠x (1t)',
    patternFormula: '[x, y, x, x]',
    differTargetFormula: 'Differ ≠ x',
    durationTicks: 1,
    description: 'Scans for [x, y, x, x] pattern (isolated y bookended by x) ➔ executes Differ ≠ x with 1 tick settlement.',
    checkMatch: (digits: number[]) => {
      if (digits.length < 4) return { isMatched: false, targetDigit: null, patternDisplay: '', details: 'Awaiting digits...' };
      const d4 = digits[digits.length - 4];
      const d3 = digits[digits.length - 3];
      const d2 = digits[digits.length - 2];
      const d1 = digits[digits.length - 1];
      if (d4 === d2 && d2 === d1 && d3 !== d4) {
        return {
          isMatched: true,
          targetDigit: d1,
          patternDisplay: `[${d4}, ${d3}, ${d2}, ${d1}]`,
          details: `Pattern [${d4}, ${d3}, ${d2}, ${d1}] matched ➔ Target Differ ≠ ${d1} (1 Tick)`,
        };
      }
      return { isMatched: false, targetDigit: null, patternDisplay: '', details: `Current: [${d4}, ${d3}, ${d2}, ${d1}] (Awaiting [x, y, x, x])` };
    },
  },
  90: {
    volatility: 90,
    label: 'Vol 90 Bookend Differ [x, y, x, x] ➔ ≠x (1t)',
    patternFormula: '[x, y, x, x]',
    differTargetFormula: 'Differ ≠ x',
    durationTicks: 1,
    description: 'Scans for [x, y, x, x] pattern (isolated y bookended by x) ➔ executes Differ ≠ x with 1 tick settlement.',
    checkMatch: (digits: number[]) => {
      if (digits.length < 4) return { isMatched: false, targetDigit: null, patternDisplay: '', details: 'Awaiting digits...' };
      const d4 = digits[digits.length - 4];
      const d3 = digits[digits.length - 3];
      const d2 = digits[digits.length - 2];
      const d1 = digits[digits.length - 1];
      if (d4 === d2 && d2 === d1 && d3 !== d4) {
        return {
          isMatched: true,
          targetDigit: d1,
          patternDisplay: `[${d4}, ${d3}, ${d2}, ${d1}]`,
          details: `Pattern [${d4}, ${d3}, ${d2}, ${d1}] matched ➔ Target Differ ≠ ${d1} (1 Tick)`,
        };
      }
      return { isMatched: false, targetDigit: null, patternDisplay: '', details: `Current: [${d4}, ${d3}, ${d2}, ${d1}] (Awaiting [x, y, x, x])` };
    },
  },
  100: {
    volatility: 100,
    label: 'Vol 100 Bridge Differ [x, x, y, x] ➔ ≠x (1t)',
    patternFormula: '[x, x, y, x]',
    differTargetFormula: 'Differ ≠ x',
    durationTicks: 1,
    description: 'Scans for [x, x, y, x] pattern (twin bridge across y to x) ➔ executes Differ ≠ x with 1 tick settlement.',
    checkMatch: (digits: number[]) => {
      if (digits.length < 4) return { isMatched: false, targetDigit: null, patternDisplay: '', details: 'Awaiting digits...' };
      const d4 = digits[digits.length - 4];
      const d3 = digits[digits.length - 3];
      const d2 = digits[digits.length - 2];
      const d1 = digits[digits.length - 1];
      if (d4 === d3 && d4 === d1 && d2 !== d4) {
        return {
          isMatched: true,
          targetDigit: d1,
          patternDisplay: `[${d4}, ${d3}, ${d2}, ${d1}]`,
          details: `Pattern [${d4}, ${d3}, ${d2}, ${d1}] matched ➔ Target Differ ≠ ${d1} (1 Tick)`,
        };
      }
      return { isMatched: false, targetDigit: null, patternDisplay: '', details: `Current: [${d4}, ${d3}, ${d2}, ${d1}] (Awaiting [x, x, y, x])` };
    },
  },
};

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

export interface SystemAutoLiveConfig {
  appId: string;
  token: string;
  accountType: 'REAL' | 'DEMO';
  botStrategyMode: BotStrategyMode;
  differSingleTargetDigit?: number; // default 5
  differSingleDurationTicks?: number; // default 1
  waitMinutesBetweenMarkets: number; // e.g. 5 minutes or 1 minute
  stakeMode: 'FIXED' | 'COMPOUNDING' | 'MARTINGALE';
  baseStake: number;
  compoundingPercent: number; // percentage of accumulated win profit to reinvest
  martingaleMultiplier?: number;
  maxMartingaleSteps?: number;
  durationTicks: number; // default 2 ticks
  takeProfit: number;
  stopLoss: number;
  maxConsecutiveLosses: number;
  marketListType: 'STANDARD_10_TO_100' | 'ONESECOND_10_TO_100' | 'ALL_10_TO_100';
}

export interface LiveTradeRecord {
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

export type LiveBotPhase = 'IDLE' | 'CONNECTING' | 'SCANNING' | 'IN_TRADE' | 'WAITING_COOLDOWN' | 'STOPPED';

export interface SystemAutoLiveStatus {
  isRunning: boolean;
  phase: LiveBotPhase;
  statusMessage: string;
  botStrategyMode: BotStrategyMode;
  currentMarketIndex: number;
  currentMarket: AscendingMarketDef;
  nextMarket: AscendingMarketDef;
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
  currentMartingaleStep: number;
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
  activeMarketStrategy: ActiveMarketStrategyState;
  availableStrategies: Array<{
    volatility: number;
    label: string;
    patternFormula: string;
    differTargetFormula: string;
    durationTicks: number;
    description: string;
  }>;
  lastTradeResult: 'WIN' | 'LOSS' | null;
  lastTradeProfit: number | null;
  lastTradeMarket: string | null;
  startedAt: number | null;
  balanceUsd: number;
  loginid: string;
  currency: string;
  config: SystemAutoLiveConfig;
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

function extractLastDigit(quote: number | string, pipSize: number = 2): number {
  const numeric = typeof quote === 'number' ? quote : parseFloat(String(quote));
  if (!Number.isFinite(numeric)) return 0;
  const formatted = numeric.toFixed(pipSize);
  const lastChar = formatted.slice(-1);
  const parsed = parseInt(lastChar, 10);
  return !isNaN(parsed) && parsed >= 0 && parsed <= 9 ? parsed : 0;
}

export class SystemAutoLiveRunner {
  private config: SystemAutoLiveConfig = {
    appId: '1089',
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
    durationTicks: 2,
    takeProfit: 50,
    stopLoss: 50,
    maxConsecutiveLosses: 3,
    marketListType: 'STANDARD_10_TO_100',
  };

  private isRunning: boolean = false;
  private phase: LiveBotPhase = 'IDLE';
  private statusMessage: string = 'System Auto Live background bot ready.';
  private currentMarketIndex: number = 0;
  private cycleNumber: number = 1;
  private tradedSymbolsInCycle: Set<string> = new Set();
  private currentStake: number = 0.50;
  private consecutiveWinProfitAccumulator: number = 0;
  private currentMartingaleStep: number = 0;

  private totalWins: number = 0;
  private totalLosses: number = 0;
  private consecutiveWins: number = 0;
  private consecutiveLosses: number = 0;
  private netProfit: number = 0;
  private balanceUsd: number = 0;
  private loginid: string = '';
  private currency: string = 'USD';
  private startedAt: number | null = null;
  private activeWsUrl: string = '';

  private isOptionsEndpoint(): boolean {
    const ep = (this.activeWsUrl || '').toLowerCase();
    return ep.includes('api.derivws.com') || ep.includes('/options/');
  }

  private recentDigits: number[] = [];
  private hasTwinDigit: boolean = false;
  private twinDigit: number | null = null;

  private pendingTradeDetails: {
    differDigit: number;
    durationTicks: number;
    patternText: string;
    strategyLabel: string;
  } | null = null;

  private cooldownEndTime: number | null = null;
  private cooldownTotalSeconds: number = 300; // 5 mins
  private cooldownTimer: any = null;
  private tradeWatchdogTimer: any = null;

  private activeContract: {
    id: string;
    symbol: string;
    marketName: string;
    differDigit: number;
    stake: number;
    durationTicks: number;
    entryPrice: number;
    ticksCount: number;
    spots: number[];
  } | null = null;

  private lastTradeResult: 'WIN' | 'LOSS' | null = null;
  private lastTradeProfit: number | null = null;
  private lastTradeMarket: string | null = null;

  private tradeHistory: LiveTradeRecord[] = [];
  private ws: any = null;
  private activeTickSubscriptionId: string | null = null;
  private pingInterval: any = null;
  private marketDigitsMap: Record<string, number[]> = {};

  private persistenceFilePath: string = path.join(process.cwd(), 'data', 'system_auto_live_state.json');

  constructor() {
    this.ensureDataDir();
    this.loadPersistedState();
  }

  private ensureDataDir() {
    try {
      const dir = path.dirname(this.persistenceFilePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    } catch (e) {
      console.warn('[System Auto Live] Could not create data dir:', e);
    }
  }

  private loadPersistedState() {
    try {
      if (fs.existsSync(this.persistenceFilePath)) {
        const raw = fs.readFileSync(this.persistenceFilePath, 'utf-8');
        const data = JSON.parse(raw);
        if (data.config) this.config = { ...this.config, ...data.config };
        if (typeof data.netProfit === 'number') this.netProfit = data.netProfit;
        if (typeof data.totalWins === 'number') this.totalWins = data.totalWins;
        if (typeof data.totalLosses === 'number') this.totalLosses = data.totalLosses;
        if (typeof data.currentMarketIndex === 'number') this.currentMarketIndex = data.currentMarketIndex;
        if (typeof data.cycleNumber === 'number') this.cycleNumber = data.cycleNumber;
        if (Array.isArray(data.tradeHistory)) this.tradeHistory = data.tradeHistory.slice(0, 100);
        console.log(`[System Auto Live] Loaded state: ${this.totalWins} wins, ${this.totalLosses} losses, Net: $${this.netProfit.toFixed(2)}`);
      }
    } catch (e) {
      console.warn('[System Auto Live] Failed to load persisted state:', e);
    }
  }

  private persistState() {
    try {
      this.ensureDataDir();
      const payload = {
        config: this.config,
        netProfit: this.netProfit,
        totalWins: this.totalWins,
        totalLosses: this.totalLosses,
        currentMarketIndex: this.currentMarketIndex,
        cycleNumber: this.cycleNumber,
        tradeHistory: this.tradeHistory.slice(0, 100),
        lastUpdated: Date.now(),
      };
      fs.writeFileSync(this.persistenceFilePath, JSON.stringify(payload, null, 2));
    } catch (e) {
      console.warn('[System Auto Live] Failed to persist state:', e);
    }
  }

  public getMarketPool(): AscendingMarketDef[] {
    if (this.config.marketListType === 'ONESECOND_10_TO_100') {
      return ASCENDING_MARKETS_ONESECOND;
    }
    if (this.config.marketListType === 'ALL_10_TO_100') {
      return [...ASCENDING_MARKETS_STANDARD, ...ASCENDING_MARKETS_ONESECOND].sort(
        (a, b) => a.volatility - b.volatility || (a.isOneSecond ? 1 : -1)
      );
    }
    return ASCENDING_MARKETS_STANDARD;
  }

  public getActiveStrategyForMarket(market: AscendingMarketDef): MarketStrategyRule {
    const customDur = (this.config.durationTicks && this.config.durationTicks >= 1) ? this.config.durationTicks : undefined;

    if (this.config.botStrategyMode === 'MULTI_STRATEGY_MATRIX') {
      const baseRule = MULTI_STRATEGY_RULES[market.volatility];
      if (baseRule) {
        const dur = customDur ?? baseRule.durationTicks;
        return {
          ...baseRule,
          durationTicks: dur,
          label: dur !== baseRule.durationTicks ? baseRule.label.replace(/\(\d+t\)/, `(${dur}t)`) : baseRule.label,
        };
      }
    }

    if (this.config.botStrategyMode === 'TRIPLE_THREAT') {
      const dur = customDur ?? (this.config.durationTicks && this.config.durationTicks >= 1 ? this.config.durationTicks : 2);
      return {
        volatility: market.volatility,
        label: `Vol ${market.volatility} Tripple Threat [x, x, x] ➔ Differ ≠ x (${dur}t)`,
        patternFormula: '[x, x, x] Triple Appearance',
        differTargetFormula: 'Differ ≠ x',
        durationTicks: dur,
        description: `Scans all markets simultaneously in parallel. Once a digit appears thrice consecutively (e.g. 4, 4, 4), immediately buys that digit differ (Differ ≠ 4) using ${dur} ticks settlement in that market.`,
        checkMatch: (digits: number[]) => {
          if (digits.length < 3) {
            return { isMatched: false, targetDigit: null, patternDisplay: '', details: 'Awaiting 3 market ticks...' };
          }
          const d3 = digits[digits.length - 3];
          const d2 = digits[digits.length - 2];
          const d1 = digits[digits.length - 1];
          if (d3 === d2 && d2 === d1) {
            return {
              isMatched: true,
              targetDigit: d1,
              patternDisplay: `[${d3}, ${d2}, ${d1}] TRIPLE THREAT ➔ Differ ≠ ${d1}`,
              details: `Triple digit appearance [${d3}, ${d2}, ${d1}] matched on ${market.shortName}! Target Differ ≠ ${d1} (${dur} Ticks)`,
            };
          }
          return {
            isMatched: false,
            targetDigit: null,
            patternDisplay: `[${d3}, ${d2}, ${d1}] (Scanning for [x, x, x])`,
            details: `Current: [${d3}, ${d2}, ${d1}]. Scanning all markets for triple digit appearance...`,
          };
        },
      };
    }

    if (this.config.botStrategyMode === 'DOUBLE_BOT') {
      const dur = customDur ?? (this.config.durationTicks && this.config.durationTicks >= 1 ? this.config.durationTicks : 1);
      return {
        volatility: market.volatility,
        label: `Vol ${market.volatility} Double Bot [x, x, y] ➔ Differ ≠ y (${dur}t)`,
        patternFormula: '[x, x, y] (e.g. 3,3,4 ➔ ≠4 | 5,5,6 ➔ ≠6)',
        differTargetFormula: 'Differ ≠ y',
        durationTicks: dur,
        description: `Scans all markets simultaneously for pattern [x, x, y] (two identical digits followed by a differing digit). Immediately buys Digit Differ ≠ y with 1 tick settlement (the next digit settles the trade).`,
        checkMatch: (digits: number[]) => {
          if (digits.length < 3) {
            return { isMatched: false, targetDigit: null, patternDisplay: '', details: 'Awaiting 3 market ticks...' };
          }
          const d3 = digits[digits.length - 3];
          const d2 = digits[digits.length - 2];
          const d1 = digits[digits.length - 1];
          if (d3 === d2 && d1 !== d2) {
            return {
              isMatched: true,
              targetDigit: d1,
              patternDisplay: `[${d3}, ${d2}, ${d1}] DOUBLE BOT ➔ Differ ≠ ${d1}`,
              details: `Double Bot pattern [${d3}, ${d2}, ${d1}] matched on ${market.shortName}! Target Differ ≠ ${d1} (1 Tick Settle, Next digit settles)`,
            };
          }
          return {
            isMatched: false,
            targetDigit: null,
            patternDisplay: digits.length >= 3 ? `[${d3}, ${d2}, ${d1}]` : '',
            details: digits.length >= 3 ? `Current: [${d3}, ${d2}, ${d1}] (Waiting for [x, x, y])` : 'Awaiting ticks...',
          };
        },
      };
    }

    if (this.config.botStrategyMode === 'DIFFER_5') {
      const dur = customDur ?? (this.config.differSingleDurationTicks && this.config.differSingleDurationTicks >= 1
        ? this.config.differSingleDurationTicks
        : 1);

      return {
        volatility: market.volatility,
        label: `Vol ${market.volatility} Differ 5 (Detect 5 ➔ Buy Differ ≠ 5) (${dur}t)`,
        patternFormula: '[5] Detected',
        differTargetFormula: 'Buy Differ ≠ 5',
        durationTicks: dur,
        description: `Scans ticks on ${market.shortName} in ascending order until digit 5 appears, then immediately buys Differ ≠ 5 with ${dur} tick settlement using 24/7 settings.`,
        checkMatch: (digits: number[]) => {
          if (digits.length < 1) {
            return { isMatched: false, targetDigit: null, patternDisplay: '', details: 'Awaiting market ticks...' };
          }
          const currentTickDigit = digits[digits.length - 1];
          if (currentTickDigit === 5) {
            return {
              isMatched: true,
              targetDigit: 5,
              patternDisplay: `[5] DETECTED! ➔ Differ ≠ 5`,
              details: `Digit 5 detected on live tick stream! Immediately buying Differ ≠ 5 (${dur} Tick${dur > 1 ? 's' : ''})`,
            };
          }
          return {
            isMatched: false,
            targetDigit: null,
            patternDisplay: `[${currentTickDigit}] (Scanning for 5...)`,
            details: `Current tick digit: ${currentTickDigit}. Scanning for digit 5...`,
          };
        },
      };
    }

    if (this.config.botStrategyMode === 'DIFFER_SINGLE_NUMBER') {
      const targetDigit = Number.isInteger(this.config.differSingleTargetDigit) &&
        this.config.differSingleTargetDigit! >= 0 &&
        this.config.differSingleTargetDigit! <= 9
          ? this.config.differSingleTargetDigit!
          : 5;
      const dur = customDur ?? (this.config.differSingleDurationTicks && this.config.differSingleDurationTicks >= 1
        ? this.config.differSingleDurationTicks
        : 1);

      return {
        volatility: market.volatility,
        label: `Vol ${market.volatility} Differ Single Digit ≠ ${targetDigit} (${dur}t)`,
        patternFormula: `Differ ≠ ${targetDigit}`,
        differTargetFormula: `≠ ${targetDigit}`,
        durationTicks: dur,
        description: `Trades Digit Differ ${targetDigit} of every volatility market in ascending order with ${dur} tick settlement using 24/7 live settings.`,
        checkMatch: (digits: number[]) => {
          if (digits.length < 1) {
            return { isMatched: false, targetDigit: null, patternDisplay: '', details: 'Awaiting market tick...' };
          }
          const currentTickDigit = digits[digits.length - 1];
          return {
            isMatched: true,
            targetDigit,
            patternDisplay: `[${currentTickDigit}] ➔ Differ ≠ ${targetDigit}`,
            details: `Single Number Differ Trigger ➔ Target Differ ≠ ${targetDigit} (${dur} Tick${dur > 1 ? 's' : ''})`,
          };
        },
      };
    }

    if (this.config.botStrategyMode === 'LAST_DIGIT_DIFFER') {
      const dur = customDur ?? 1;
      return {
        volatility: market.volatility,
        label: `Vol ${market.volatility} Last Digit Differ ➔ ≠ Prev Digit (${dur}t)`,
        patternFormula: `[prev_d] ➔ Differ ≠ prev_d`,
        differTargetFormula: '≠ Prev Digit',
        durationTicks: dur,
        description: `Trades digit differ of the previous digit on that market and uses ${dur} tick(s) to settle the trade using 24/7 live settings.`,
        checkMatch: (digits: number[]) => {
          if (digits.length < 1) {
            return { isMatched: false, targetDigit: null, patternDisplay: '', details: 'Awaiting previous tick digit...' };
          }
          const prevDigit = digits[digits.length - 1];
          return {
            isMatched: true,
            targetDigit: prevDigit,
            patternDisplay: `[${prevDigit}] ➔ Differ ≠ ${prevDigit}`,
            details: `Previous tick digit [${prevDigit}] detected ➔ Target Differ ≠ ${prevDigit} (${dur} Tick Settle)`,
          };
        },
      };
    }

    if (this.config.botStrategyMode === 'ALTERNATING_DIGITS') {
      const targetDigit = Number.isInteger(this.config.differSingleTargetDigit) &&
        this.config.differSingleTargetDigit! >= 0 &&
        this.config.differSingleTargetDigit! <= 9
          ? this.config.differSingleTargetDigit!
          : 5;
      const dur = customDur ?? (this.config.durationTicks && this.config.durationTicks >= 1 ? this.config.durationTicks : 1);

      return {
        volatility: market.volatility,
        label: `Vol ${market.volatility} Alternating Digits [O, E, O / E, O, E] ➔ ≠ ${targetDigit} (${dur}t)`,
        patternFormula: '[Odd, Even, Odd] or [Even, Odd, Even]',
        differTargetFormula: `≠ ${targetDigit}`,
        durationTicks: dur,
        description: `Trades DIGITDIFF ≠ ${targetDigit} when consecutive digits are different and follow alternating odd/even parity with ${dur} tick settlement.`,
        checkMatch: (digits: number[]) => {
          if (digits.length < 3) {
            return { isMatched: false, targetDigit: null, patternDisplay: '', details: 'Awaiting at least 3 digits...' };
          }
          const d1 = digits[digits.length - 3];
          const d2 = digits[digits.length - 2];
          const d3 = digits[digits.length - 1];

          // Enforce consecutive digits differ
          if (d1 === d2 || d2 === d3) {
            return { isMatched: false, targetDigit: null, patternDisplay: `[${d1}, ${d2}, ${d3}]`, details: 'Consecutive digits are identical' };
          }

          const p1 = d1 % 2 !== 0 ? 'Odd' : 'Even';
          const p2 = d2 % 2 !== 0 ? 'Odd' : 'Even';
          const p3 = d3 % 2 !== 0 ? 'Odd' : 'Even';

          const isAlternating = (p1 !== p2) && (p2 !== p3);
          if (isAlternating) {
            return {
              isMatched: true,
              targetDigit,
              patternDisplay: `[${d1}, ${d2}, ${d3}] (${p1}-${p2}-${p3}) ➔ ≠ ${targetDigit}`,
              details: `Alternating ${p1}-${p2}-${p3} pattern matched! Executing Differ ≠ ${targetDigit} (${dur}t)`,
            };
          }

          return {
            isMatched: false,
            targetDigit: null,
            patternDisplay: `[${d1}, ${d2}, ${d3}] (${p1}-${p2}-${p3})`,
            details: `Awaiting alternating odd/even sequence`,
          };
        },
      };
    }

    if (this.config.botStrategyMode === 'TWIN_0_AND_9_DIFFER') {
      const dur = customDur ?? (this.config.durationTicks && this.config.durationTicks >= 1 ? this.config.durationTicks : 1);
      return {
        volatility: market.volatility,
        label: `Vol ${market.volatility} Polar Twin [0,0 ➔ ≠0 | 9,9 ➔ ≠9] (${dur}t)`,
        patternFormula: '[9, 9] or [0, 0]',
        differTargetFormula: '[9,9] ➔ ≠9 | [0,0] ➔ ≠0',
        durationTicks: dur,
        description: `Trades DIGITDIFF when either [9, 9] occurs (buys Differ ≠ 9) or [0, 0] occurs (buys Differ ≠ 0) with ${dur} tick settlement.`,
        checkMatch: (digits: number[]) => {
          if (digits.length < 2) {
            return { isMatched: false, targetDigit: null, patternDisplay: '', details: 'Awaiting at least 2 digits...' };
          }
          const d1 = digits[digits.length - 2];
          const d2 = digits[digits.length - 1];

          if (d1 === 9 && d2 === 9) {
            return {
              isMatched: true,
              targetDigit: 9,
              patternDisplay: '[9, 9] ➔ Differ ≠ 9',
              details: `Polar Twin [9, 9] detected! Executing Differ ≠ 9 (${dur}t Settle)`,
            };
          }

          if (d1 === 0 && d2 === 0) {
            return {
              isMatched: true,
              targetDigit: 0,
              patternDisplay: '[0, 0] ➔ Differ ≠ 0',
              details: `Polar Twin [0, 0] detected! Executing Differ ≠ 0 (${dur}t Settle)`,
            };
          }

          return {
            isMatched: false,
            targetDigit: null,
            patternDisplay: `[${d1}, ${d2}]`,
            details: 'Awaiting [0, 0] or [9, 9] polar twins...',
          };
        },
      };
    }

    // Fallback: Classic Twin Differ (Instant 1-Tick Settlement: e.g. 2,2,5 -> Differ 2, digit 5 settles)
    const dur = customDur ?? (this.config.durationTicks && this.config.durationTicks >= 1 ? this.config.durationTicks : 1);
    return {
      volatility: market.volatility,
      label: `Vol ${market.volatility} Twin Differ [x, x] ➔ ≠x (${dur}t)`,
      patternFormula: '[x, x]',
      differTargetFormula: 'Differ ≠ x',
      durationTicks: dur,
      description: `Scans for twin identical digits [x, x] ➔ executes Differ ≠ x with ${dur} tick${dur > 1 ? 's' : ' instant'} settlement.`,
      checkMatch: (digits: number[]) => {
        if (digits.length < 2) return { isMatched: false, targetDigit: null, patternDisplay: '', details: 'Awaiting digits...' };
        const d2 = digits[digits.length - 2];
        const d1 = digits[digits.length - 1];
        if (d2 === d1) {
          return {
            isMatched: true,
            targetDigit: d1,
            patternDisplay: `[${d2}, ${d1}]`,
            details: `Twin [${d2}, ${d1}] matched ➔ Target Differ ≠ ${d1} (${dur} Ticks)`,
          };
        }
        return { isMatched: false, targetDigit: null, patternDisplay: '', details: `Current: [${d2}, ${d1}] (Awaiting twin [x, x])` };
      },
    };
  }

  public getStatus(): SystemAutoLiveStatus {
    const pool = this.getMarketPool();
    const safeIdx = this.currentMarketIndex % pool.length;
    const currentMarket = pool[safeIdx] || pool[0];
    const nextIdx = (safeIdx + 1) % pool.length;
    const nextMarket = pool[nextIdx] || pool[0];

    const ladder = pool.map((m, idx) => ({
      symbol: m.symbol,
      name: m.name,
      shortName: m.shortName,
      volatility: m.volatility,
      isCurrent: idx === safeIdx,
      isTraded: this.tradedSymbolsInCycle.has(m.symbol),
    }));

    const totalTrades = this.totalWins + this.totalLosses;
    const winRate = totalTrades > 0 ? Number(((this.totalWins / totalTrades) * 100).toFixed(1)) : 0;

    let cooldownSecondsRemaining = 0;
    if (this.phase === 'WAITING_COOLDOWN' && this.cooldownEndTime) {
      cooldownSecondsRemaining = Math.max(0, Math.ceil((this.cooldownEndTime - Date.now()) / 1000));
    }

    const currentStrategyRule = this.getActiveStrategyForMarket(currentMarket);
    const strategyMatch = currentStrategyRule.checkMatch(this.recentDigits);

    const activeMarketStrategy: ActiveMarketStrategyState = {
      botMode: this.config.botStrategyMode,
      marketName: currentMarket.shortName,
      volatility: currentMarket.volatility,
      label: currentStrategyRule.label,
      patternFormula: currentStrategyRule.patternFormula,
      differTargetFormula: currentStrategyRule.differTargetFormula,
      durationTicks: currentStrategyRule.durationTicks,
      description: currentStrategyRule.description,
      isMatched: strategyMatch.isMatched,
      matchedPatternDisplay: strategyMatch.patternDisplay,
      targetDigit: strategyMatch.targetDigit,
      statusDetails: strategyMatch.details,
    };

    const availableStrategies = pool.map((m) => {
      const strat = this.getActiveStrategyForMarket(m);
      return {
        volatility: m.volatility,
        label: strat.label,
        patternFormula: strat.patternFormula,
        differTargetFormula: strat.differTargetFormula,
        durationTicks: strat.durationTicks,
        description: strat.description,
      };
    });

    const multiMarketLiveDigits = pool.map((m) => {
      const digits = this.marketDigitsMap[m.symbol] || [];
      const lastDigit = digits.length > 0 ? digits[digits.length - 1] : null;
      const hasTwin = digits.length >= 2 && digits[digits.length - 1] === digits[digits.length - 2];
      const hasTriple =
        digits.length >= 3 &&
        digits[digits.length - 1] === digits[digits.length - 2] &&
        digits[digits.length - 2] === digits[digits.length - 3];
      const tripleDigit = hasTriple ? digits[digits.length - 1] : null;
      return {
        symbol: m.symbol,
        shortName: m.shortName,
        volatility: m.volatility,
        digits: digits.slice(-15),
        lastDigit,
        hasTwin,
        hasTriple,
        tripleDigit,
      };
    });

    return {
      isRunning: this.isRunning,
      phase: this.phase,
      statusMessage: this.statusMessage,
      botStrategyMode: this.config.botStrategyMode,
      currentMarketIndex: safeIdx,
      currentMarket,
      nextMarket,
      ladder,
      cycleNumber: this.cycleNumber,
      tradedInCurrentCycle: Array.from(this.tradedSymbolsInCycle),
      currentStake: Number(this.currentStake.toFixed(2)),
      netProfit: Number(this.netProfit.toFixed(2)),
      totalTrades,
      totalWins: this.totalWins,
      totalLosses: this.totalLosses,
      winRate,
      consecutiveWins: this.consecutiveWins,
      consecutiveLosses: this.consecutiveLosses,
      currentMartingaleStep: this.currentMartingaleStep,
      cooldownSecondsRemaining,
      cooldownTotalSeconds: this.cooldownTotalSeconds,
      cooldownEndTime: this.cooldownEndTime,
      activeContract: this.activeContract,
      recentDigits: [...this.recentDigits],
      hasTwinDigit: this.hasTwinDigit,
      twinDigit: this.twinDigit,
      activeMarketStrategy,
      availableStrategies,
      lastTradeResult: this.lastTradeResult,
      lastTradeProfit: this.lastTradeProfit,
      lastTradeMarket: this.lastTradeMarket,
      startedAt: this.startedAt,
      balanceUsd: this.balanceUsd,
      loginid: this.loginid,
      currency: this.currency,
      config: { ...this.config },
      multiMarketLiveDigits,
    };
  }

  public getHistory(): LiveTradeRecord[] {
    return [...this.tradeHistory];
  }

  public updateConfig(newConfig: Partial<SystemAutoLiveConfig>) {
    const prevMarketType = this.config.marketListType;
    const prevBotMode = this.config.botStrategyMode;
    this.config = { ...this.config, ...newConfig };

    // Update stake immediately if in FIXED mode or if baseStake changed or if MARTINGALE reset
    if (newConfig.baseStake !== undefined || newConfig.stakeMode !== undefined) {
      if (this.config.stakeMode === 'FIXED' || !this.isRunning) {
        this.currentStake = Number(this.config.baseStake);
      } else if (this.config.stakeMode === 'MARTINGALE') {
        if (this.currentMartingaleStep === 0 || !this.isRunning) {
          this.currentStake = Number(this.config.baseStake);
        }
      }
    }

    // If bot strategy mode changed while running, restart scan to refresh pattern parameters
    if (newConfig.botStrategyMode && newConfig.botStrategyMode !== prevBotMode) {
      console.log(`[System Auto Live] Strategy switched to ${newConfig.botStrategyMode}`);
      if (this.isRunning && this.phase === 'SCANNING') {
        this.beginMarketScan();
      }
    }

    // If market ladder changed while running, adjust ladder index and switch scan
    if (newConfig.marketListType && newConfig.marketListType !== prevMarketType) {
      const newPool = this.getMarketPool();
      this.currentMarketIndex = this.currentMarketIndex % newPool.length;
      if (this.isRunning && this.phase === 'SCANNING') {
        console.log(`[System Auto Live] Market pool switched to ${newConfig.marketListType}. Re-scanning market...`);
        this.beginMarketScan();
      }
    }

    this.persistState();
    console.log(`[System Auto Live] Configuration updated: Stake=$${this.currentStake.toFixed(2)}, Mode=${this.config.stakeMode}, Ladder=${this.config.marketListType}, Wait=${this.config.waitMinutesBetweenMarkets}m`);
  }

  public start(configOverride?: Partial<SystemAutoLiveConfig>) {
    if (configOverride) {
      this.updateConfig(configOverride);
    }

    if (this.isRunning) {
      console.log('[System Auto Live] Bot already running, applied updated configuration');
      return;
    }

    const token = this.config.token.trim();
    if (!token) {
      throw new Error('Deriv API token is required to run System Auto Live.');
    }

    this.isRunning = true;
    this.startedAt = Date.now();
    this.phase = 'CONNECTING';
    this.currentStake = this.config.baseStake;
    this.currentMartingaleStep = 0;
    this.consecutiveWinProfitAccumulator = 0;
    this.statusMessage = 'Connecting to Deriv 24/7 background trade engine...';
    console.log(`[System Auto Live] Starting background runner. App ID: ${this.config.appId}, Mode: ${this.config.stakeMode}, Wait: ${this.config.waitMinutesBetweenMarkets}m`);

    this.connectWebSocket();
  }

  public stop(reason: string = 'Stopped by user') {
    this.isRunning = false;
    this.phase = 'STOPPED';
    this.statusMessage = `🛑 Live Bot stopped: ${reason}`;
    console.log(`[System Auto Live] ${this.statusMessage}`);

    if (this.cooldownTimer) {
      clearTimeout(this.cooldownTimer);
      this.cooldownTimer = null;
    }
    if (this.tradeWatchdogTimer) {
      clearTimeout(this.tradeWatchdogTimer);
      this.tradeWatchdogTimer = null;
    }
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }

    this.cooldownEndTime = null;
    this.activeContract = null;

    if (this.ws) {
      try {
        if (this.activeTickSubscriptionId) {
          this.ws.send(JSON.stringify({ forget: this.activeTickSubscriptionId }));
        }
        this.ws.close();
      } catch {}
      this.ws = null;
    }

    this.persistState();
  }

  public resetStats() {
    this.totalWins = 0;
    this.totalLosses = 0;
    this.consecutiveWins = 0;
    this.consecutiveLosses = 0;
    this.netProfit = 0;
    this.cycleNumber = 1;
    this.currentMarketIndex = 0;
    this.tradedSymbolsInCycle.clear();
    this.tradeHistory = [];
    this.currentStake = this.config.baseStake;
    this.currentMartingaleStep = 0;
    this.consecutiveWinProfitAccumulator = 0;
    this.lastTradeResult = null;
    this.lastTradeProfit = null;
    this.lastTradeMarket = null;
    this.statusMessage = 'System Auto Live stats and trade logs cleared.';
    this.persistState();
  }

  private cleanToken(rawToken?: string | null): string {
    if (!rawToken) return '';
    return rawToken.trim().replace(/^bearer\s+/i, '').replace(/[\s'"\r\n\t]/g, '');
  }

  private findAccountIdInObj(value: unknown): string | null {
    if (!value || typeof value !== 'object') return null;
    if (Array.isArray(value)) {
      for (const item of value) {
        const found = this.findAccountIdInObj(item);
        if (found) return found;
      }
      return null;
    }
    const obj = value as Record<string, unknown>;
    for (const key of ['account_id', 'accountId', 'account_id_value', 'loginid', 'login_id']) {
      const candidate = obj[key];
      if (typeof candidate === 'string' && candidate.trim()) return candidate.trim();
    }
    for (const key of ['account', 'wallet', 'wallets', 'accounts', 'data', 'result']) {
      const found = this.findAccountIdInObj(obj[key]);
      if (found) return found;
    }
    return null;
  }

  private findWsUrlInObj(value: unknown): string | null {
    if (typeof value === 'string') return value.startsWith('wss://') ? value : null;
    if (!value || typeof value !== 'object') return null;
    if (Array.isArray(value)) {
      for (const item of value) {
        const found = this.findWsUrlInObj(item);
        if (found) return found;
      }
      return null;
    }
    for (const item of Object.values(value as Record<string, unknown>)) {
      const found = this.findWsUrlInObj(item);
      if (found) return found;
    }
    return null;
  }

  private async resolveWebSocketUrl(token: string, rawAppId: string): Promise<{ url: string; accountId?: string }> {
    const appId = (rawAppId || '34O00AdC2O6jw2JRyd0WG').trim();
    const socketAppId = /^\d+$/.test(appId) ? appId : '1089';

    // 1. Attempt OTP discovery via Deriv options trading endpoints
    try {
      let accountId = '';
      const discoveryEndpoints = [
        'https://api.derivws.com/wallet/v1/wallets',
        'https://api.derivws.com/trading/v1/options/accounts',
        'https://api.derivws.com/account/v1/accounts',
      ];

      for (const endpoint of discoveryEndpoints) {
        try {
          const resp = await fetch(endpoint, {
            method: 'GET',
            headers: {
              'Deriv-App-ID': appId,
              Authorization: `Bearer ${token}`,
              Accept: 'application/json',
            },
          });
          if (resp.ok) {
            const data = await resp.json();
            const found = this.findAccountIdInObj(data);
            if (found) {
              accountId = found;
              break;
            }
          }
        } catch {}
      }

      if (accountId) {
        const otpResp = await fetch(
          `https://api.derivws.com/trading/v1/options/accounts/${encodeURIComponent(accountId)}/otp`,
          {
            method: 'POST',
            headers: {
              'Deriv-App-ID': appId,
              Authorization: `Bearer ${token}`,
              Accept: 'application/json',
            },
          }
        );
        if (otpResp.ok) {
          const otpData = await otpResp.json();
          const wsUrl = this.findWsUrlInObj(otpData);
          if (wsUrl) {
            console.log(`[System Auto Live] Successfully acquired authenticated OTP WebSocket URL for account ${accountId}`);
            return { url: wsUrl, accountId };
          }
        }
      }
    } catch (otpErr) {
      console.warn('[System Auto Live] OTP endpoint discovery bypassed:', otpErr);
    }

    // 2. Fallback to standard Deriv WebSocket
    return {
      url: `wss://ws.derivws.com/websockets/v3?app_id=${encodeURIComponent(socketAppId)}`,
    };
  }

  private async connectWebSocket() {
    if (!this.isRunning) return;

    const token = this.cleanToken(this.config.token);
    if (!token) {
      this.stop('Deriv API token is missing or empty.');
      return;
    }

    this.statusMessage = 'Resolving Deriv 24/7 background connection...';

    try {
      const { url: wsUrl, accountId } = await this.resolveWebSocketUrl(token, this.config.appId);
      if (!this.isRunning) return;

      this.activeWsUrl = wsUrl;

      if (accountId && !this.loginid) {
        this.loginid = accountId;
      }

      console.log(`[System Auto Live] Connecting to WebSocket: ${wsUrl.replace(/otp=[^&]+/, 'otp=***')}`);
      this.statusMessage = `Connecting to Deriv WebSocket (${this.config.appId || '1089'})...`;

      const wsClass = (globalThis as any).WebSocket;
      this.ws = new wsClass(wsUrl);

      this.ws.onopen = () => {
        if (!this.isRunning || !this.ws) return;
        console.log('[System Auto Live] WebSocket connected. Authorizing token...');
        this.statusMessage = 'Deriv connected. Authorizing account...';
        try {
          this.ws.send(JSON.stringify({ authorize: token }));
        } catch (err) {
          console.error('[System Auto Live] Failed to send authorize:', err);
        }

        // Start ping keepalive (every 25 seconds)
        if (this.pingInterval) clearInterval(this.pingInterval);
        this.pingInterval = setInterval(() => {
          if (this.ws && this.ws.readyState === 1) {
            this.ws.send(JSON.stringify({ ping: 1 }));
          }
        }, 25000);
      };

      this.ws.onmessage = (event: any) => {
        try {
          const data = JSON.parse(event.data);
          this.handleWebSocketMessage(data);
        } catch (err) {
          console.error('[System Auto Live] Error parsing WS message:', err);
        }
      };

      this.ws.onerror = (err: any) => {
        console.error('[System Auto Live] WS Error:', err?.message || err);
      };

      this.ws.onclose = (event: any) => {
        console.log(`[System Auto Live] WS Closed (code: ${event.code})`);
        if (this.isRunning) {
          this.statusMessage = 'Reconnecting 24/7 background connection in 3s...';
          setTimeout(() => {
            if (this.isRunning) this.connectWebSocket();
          }, 3000);
        }
      };
    } catch (err: any) {
      console.error('[System Auto Live] Connection creation error:', err);
      if (this.isRunning) {
        this.statusMessage = `Connection failed: ${err?.message || 'Network error'}. Retrying in 5s...`;
        setTimeout(() => {
          if (this.isRunning) this.connectWebSocket();
        }, 5000);
      }
    }
  }

  private handleWebSocketMessage(data: any) {
    if (data.msg_type === 'authorize') {
      if (data.error) {
        this.stop(`Authorization error: ${data.error.message}`);
        return;
      }
      this.loginid = data.authorize.loginid || '';
      this.balanceUsd = Number(data.authorize.balance) || 0;
      this.currency = data.authorize.currency || 'USD';
      console.log(`[System Auto Live] Authorized account ${this.loginid}, Balance: $${this.balanceUsd} ${this.currency}`);
      this.beginMarketScan();
    } else if (data.msg_type === 'tick') {
      this.handleTick(data.tick);
    } else if (data.msg_type === 'buy') {
      this.handleBuyResponse(data);
    } else if (data.msg_type === 'proposal') {
      this.handleProposalResponse(data);
    } else if (data.msg_type === 'proposal_open_contract') {
      this.handleContractUpdate(data.proposal_open_contract);
    } else if (data.error) {
      console.warn(`[System Auto Live] Received broker error on ${data.msg_type || 'request'}:`, data.error);
      if (data.echo_req?.buy || data.echo_req?.proposal) {
        this.handleBuyResponse(data);
      }
    }
  }

  private beginMarketScan() {
    if (!this.isRunning) return;

    const pool = this.getMarketPool();

    if (this.config.botStrategyMode === 'TRIPLE_THREAT') {
      this.phase = 'SCANNING';
      this.recentDigits = [];
      this.hasTwinDigit = false;
      this.twinDigit = null;
      const dur = this.config.durationTicks || 2;
      this.statusMessage = `🎯 Tripple Threat Bot scanning ALL ${pool.length} markets simultaneously for [x, x, x] triple digit appearance (Differ ≠ x, ${dur}t settle)...`;
      console.log(`[System Auto Live] ${this.statusMessage}`);
      this.subscribeAllMarketsInPool();
      return;
    }

    if (this.config.botStrategyMode === 'DOUBLE_BOT') {
      this.phase = 'SCANNING';
      this.recentDigits = [];
      this.hasTwinDigit = false;
      this.twinDigit = null;
      const dur = this.config.durationTicks || 1;
      this.statusMessage = `🎯 Double Bot scanning ALL ${pool.length} markets simultaneously for [x, x, y] pattern (Differ ≠ y, ${dur}t settle, next digit settles)...`;
      console.log(`[System Auto Live] ${this.statusMessage}`);
      this.subscribeAllMarketsInPool();
      return;
    }

    const currentMarket = pool[this.currentMarketIndex % pool.length];

    this.phase = 'SCANNING';
    this.recentDigits = [];
    this.hasTwinDigit = false;
    this.twinDigit = null;

    const stratRule = this.getActiveStrategyForMarket(currentMarket);
    this.statusMessage = `🔍 [${currentMarket.shortName}] Active (${this.currentMarketIndex + 1}/${pool.length}, Cycle #${this.cycleNumber}) ➔ Strategy: ${stratRule.label} (Differ ≠ ${stratRule.differTargetFormula}, ${stratRule.durationTicks}t settle)...`;
    console.log(`[System Auto Live] ${this.statusMessage}`);

    // Subscribe to ticks of current ascending market
    this.subscribeTicks(currentMarket.symbol);
  }

  private subscribeAllMarketsInPool() {
    if (!this.ws || this.ws.readyState !== 1) return;
    try {
      this.ws.send(JSON.stringify({ forget_all: 'ticks' }));
      const pool = this.getMarketPool();
      for (const m of pool) {
        this.ws.send(JSON.stringify({ ticks: m.symbol, subscribe: 1 }));
      }
      console.log(`[System Auto Live] Parallel scanner subscribed simultaneously to: ${pool.map((m) => m.shortName).join(', ')}`);
    } catch (e) {
      console.error('[System Auto Live] Failed to subscribe all markets for parallel scan:', e);
    }
  }

  private subscribeTicks(symbol: string) {
    if (!this.ws || this.ws.readyState !== 1) return;
    try {
      // Forget old ticks if any
      this.ws.send(JSON.stringify({ forget_all: 'ticks' }));
      this.ws.send(JSON.stringify({ ticks: symbol, subscribe: 1 }));
    } catch (e) {
      console.error('[System Auto Live] Failed to subscribe ticks:', e);
    }
  }

  private handleTick(tick: any) {
    if (!this.isRunning) return;
    const pool = this.getMarketPool();

    // Multi-market parallel scanning for TRIPLE_THREAT
    if (this.config.botStrategyMode === 'TRIPLE_THREAT') {
      const matchedMarket = pool.find((m) => m.symbol === tick.symbol);
      if (!matchedMarket) return;

      const pipSize = tick.pip_size ?? matchedMarket.pipSize ?? 2;
      const lastDigit = extractLastDigit(tick.quote, pipSize);

      // Update per-market digit buffer
      const currentStream = this.marketDigitsMap[matchedMarket.symbol] || [];
      const updatedStream = [...currentStream.slice(-29), lastDigit];
      this.marketDigitsMap[matchedMarket.symbol] = updatedStream;

      // Also mirror the active tick's stream into recentDigits for live display
      this.recentDigits = updatedStream;
      const streamLen = updatedStream.length;
      const isTwin = streamLen >= 2 && updatedStream[streamLen - 1] === updatedStream[streamLen - 2];
      this.hasTwinDigit = isTwin;
      this.twinDigit = isTwin ? lastDigit : null;

      // If active contract is open on this symbol, append spot
      if (this.activeContract && this.activeContract.symbol === tick.symbol) {
        this.activeContract.spots.push(tick.quote);
        this.activeContract.ticksCount = this.activeContract.spots.length;
      }

      // Check entry condition if scanning and no contract is open
      if (this.phase === 'SCANNING' && !this.activeContract) {
        if (streamLen >= 3) {
          const d1 = updatedStream[streamLen - 1];
          const d2 = updatedStream[streamLen - 2];
          const d3 = updatedStream[streamLen - 3];
          if (d1 === d2 && d2 === d3) {
            // Triple identical digit appearance detected! (e.g. 4, 4, 4)
            const stratRule = this.getActiveStrategyForMarket(matchedMarket);
            const dur = stratRule.durationTicks || 2;
            const marketIdx = pool.findIndex((m) => m.symbol === matchedMarket.symbol);
            if (marketIdx !== -1) {
              this.currentMarketIndex = marketIdx;
            }

            console.log(
              `[System Auto Live] 💥 TRIPPLE THREAT detected [${d3}, ${d2}, ${d1}] on ${matchedMarket.shortName}! Immediately buying Differ ≠ ${d1} (${dur} Ticks)...`
            );

            this.executeDifferTrade(
              matchedMarket,
              d1,
              dur,
              `[${d3}, ${d2}, ${d1}]`,
              `Tripple Threat [${d1},${d1},${d1}] ➔ Differ ≠ ${d1} (${dur}t)`,
              tick.quote
            );
          }
        }
      }
      return;
    }

    // Multi-market parallel scanning for DOUBLE_BOT
    if (this.config.botStrategyMode === 'DOUBLE_BOT') {
      const matchedMarket = pool.find((m) => m.symbol === tick.symbol);
      if (!matchedMarket) return;

      const pipSize = tick.pip_size ?? matchedMarket.pipSize ?? 2;
      const lastDigit = extractLastDigit(tick.quote, pipSize);

      // Update per-market digit buffer
      const currentStream = this.marketDigitsMap[matchedMarket.symbol] || [];
      const updatedStream = [...currentStream.slice(-29), lastDigit];
      this.marketDigitsMap[matchedMarket.symbol] = updatedStream;

      // Also mirror the active tick's stream into recentDigits for live display
      this.recentDigits = updatedStream;
      const streamLen = updatedStream.length;
      const isTwin = streamLen >= 2 && updatedStream[streamLen - 1] === updatedStream[streamLen - 2];
      this.hasTwinDigit = isTwin;
      this.twinDigit = isTwin ? lastDigit : null;

      // If active contract is open on this symbol, append spot
      if (this.activeContract && this.activeContract.symbol === tick.symbol) {
        this.activeContract.spots.push(tick.quote);
        this.activeContract.ticksCount = this.activeContract.spots.length;
      }

      // Check entry condition if scanning and no contract is open
      // Pattern: [x, x, y] where d3 === d2 and d1 !== d2 (e.g. 3,3,4 ➔ Differ ≠ 4 | 5,5,6 ➔ Differ ≠ 6)
      if (this.phase === 'SCANNING' && !this.activeContract) {
        if (streamLen >= 3) {
          const d1 = updatedStream[streamLen - 1]; // y (target digit)
          const d2 = updatedStream[streamLen - 2]; // x
          const d3 = updatedStream[streamLen - 3]; // x
          if (d3 === d2 && d1 !== d2) {
            const stratRule = this.getActiveStrategyForMarket(matchedMarket);
            const dur = stratRule.durationTicks || 1;
            const marketIdx = pool.findIndex((m) => m.symbol === matchedMarket.symbol);
            if (marketIdx !== -1) {
              this.currentMarketIndex = marketIdx;
            }

            console.log(
              `[System Auto Live] 💥 DOUBLE BOT detected pattern [${d3}, ${d2}, ${d1}] on ${matchedMarket.shortName}! Buying Differ ≠ ${d1} (${dur} Tick Settle, Next digit settles)...`
            );

            this.executeDifferTrade(
              matchedMarket,
              d1,
              dur,
              `[${d3}, ${d2}, ${d1}]`,
              `Double Bot [${d3},${d2},${d1}] ➔ Differ ≠ ${d1} (${dur}t)`,
              tick.quote
            );
          }
        }
      }
      return;
    }

    // Standard sequential ladder mode
    const currentMarket = pool[this.currentMarketIndex % pool.length];
    if (tick.symbol !== currentMarket.symbol) return;

    const pipSize = tick.pip_size ?? currentMarket.pipSize ?? 2;
    const lastDigit = extractLastDigit(tick.quote, pipSize);

    this.recentDigits = [...this.recentDigits.slice(-29), lastDigit];
    const len = this.recentDigits.length;
    const isTwin = len >= 2 && this.recentDigits[len - 1] === this.recentDigits[len - 2];
    this.hasTwinDigit = isTwin;
    this.twinDigit = isTwin ? lastDigit : null;

    // Keep marketDigitsMap updated for standard mode
    this.marketDigitsMap[currentMarket.symbol] = this.recentDigits;

    // If active contract is open, append spot
    if (this.activeContract && this.activeContract.symbol === tick.symbol) {
      this.activeContract.spots.push(tick.quote);
      this.activeContract.ticksCount = this.activeContract.spots.length;
    }

    // Check entry condition if scanning
    if (this.phase === 'SCANNING' && !this.activeContract) {
      const stratRule = this.getActiveStrategyForMarket(currentMarket);
      const match = stratRule.checkMatch(this.recentDigits);
      if (match.isMatched && match.targetDigit !== null) {
        this.executeDifferTrade(currentMarket, match.targetDigit, stratRule.durationTicks, match.patternDisplay, stratRule.label, tick.quote);
      }
    }
  }

  private executeDifferTrade(
    market: AscendingMarketDef,
    targetDigit: number,
    durationTicks: number,
    patternDisplay: string,
    strategyLabel: string,
    currentQuote: number
  ) {
    if (!this.isRunning || this.phase !== 'SCANNING' || this.activeContract) return;

    // Check risk rules
    if (this.netProfit >= this.config.takeProfit) {
      this.stop(`🎯 Take Profit reached (+${this.netProfit.toFixed(2)} USD >= +${this.config.takeProfit} USD)`);
      return;
    }
    if (this.netProfit <= -Math.abs(this.config.stopLoss)) {
      this.stop(`⚠️ Stop Loss reached (${this.netProfit.toFixed(2)} USD <= -${this.config.stopLoss} USD)`);
      return;
    }
    if (this.consecutiveLosses >= this.config.maxConsecutiveLosses) {
      this.stop(`🛑 Max consecutive losses limit reached (${this.consecutiveLosses} consecutive losses)`);
      return;
    }

    this.phase = 'IN_TRADE';
    let stake = Math.max(0.35, Number(this.currentStake.toFixed(2)));

    // Guard against balance shortfall if balance is known
    if (this.balanceUsd > 0 && this.balanceUsd < stake) {
      if (this.balanceUsd >= 0.35) {
        const adjustedStake = Math.max(0.35, Math.floor(this.balanceUsd * 100) / 100);
        console.warn(`[System Auto Live] Balance ($${this.balanceUsd.toFixed(2)}) < target stake ($${stake.toFixed(2)}). Dynamically scaling to $${adjustedStake.toFixed(2)}.`);
        stake = adjustedStake;
      } else {
        this.stop(`Insufficient balance: Account balance ($${this.balanceUsd.toFixed(2)}) is below Deriv minimum stake ($0.35).`);
        return;
      }
    }

    const safeDuration = Math.max(1, Math.min(10, Math.floor(Number(durationTicks) || 1)));
    const safeTargetDigit = Math.max(0, Math.min(9, Math.floor(Number(targetDigit) || 0)));

    this.pendingTradeDetails = {
      differDigit: safeTargetDigit,
      durationTicks: safeDuration,
      patternText: patternDisplay,
      strategyLabel,
    };

    this.statusMessage = `⚡ [${market.shortName}] Pattern ${patternDisplay} matched ➔ Executing Differ ≠ ${safeTargetDigit} (${safeDuration} Ticks, Stake: $${stake.toFixed(2)})`;
    console.log(`[System Auto Live] ${this.statusMessage}`);

    // Request proposal directly via Deriv WS API for instant execution
    const isOptionsApi = this.isOptionsEndpoint();
    const proposalPayload: Record<string, any> = {
      proposal: 1,
      amount: stake,
      basis: 'stake',
      contract_type: 'DIGITDIFF',
      currency: this.currency || 'USD',
      duration: safeDuration,
      duration_unit: 't',
      barrier: String(safeTargetDigit),
      passthrough: {
        server_trade: true,
        market: market.symbol,
        stake: stake,
        target_digit: safeTargetDigit,
        duration: safeDuration,
      },
    };
    if (isOptionsApi) {
      proposalPayload.underlying_symbol = market.symbol;
    } else {
      proposalPayload.symbol = market.symbol;
    }

    try {
      this.ws.send(JSON.stringify(proposalPayload));

      // Watchdog in case Deriv WS takes too long
      if (this.tradeWatchdogTimer) clearTimeout(this.tradeWatchdogTimer);
      this.tradeWatchdogTimer = setTimeout(() => {
        if (this.phase === 'IN_TRADE' && this.activeContract) {
          console.warn('[System Auto Live] Watchdog timeout on active trade. Forcing simulated settlement check...');
          this.resolveHangingTrade(market, safeTargetDigit, currentQuote);
        }
      }, 10000);
    } catch (err: any) {
      console.error('[System Auto Live] Proposal request failed:', err);
      this.phase = 'SCANNING';
      this.statusMessage = `Order execution failed: ${err?.message || err}. Retrying scan...`;
    }
  }

  private handleProposalResponse(data: any) {
    if (data.error) {
      console.error('[System Auto Live] Deriv Proposal Error:', JSON.stringify(data.error));
      if (this.tradeWatchdogTimer) {
        clearTimeout(this.tradeWatchdogTimer);
        this.tradeWatchdogTimer = null;
      }
      this.pendingTradeDetails = null;
      this.phase = 'SCANNING';
      this.statusMessage = `⚠️ Proposal rejected by broker: ${data.error.message || data.error.code}. Continuing scan...`;
      return;
    }

    if (data.proposal?.id && this.ws && this.ws.readyState === 1 && this.phase === 'IN_TRADE') {
      const askPrice = Number(data.proposal.ask_price) || this.currentStake;
      const buyPrice = Math.max(Number(askPrice.toFixed(2)), askPrice, this.currentStake);
      console.log(`[System Auto Live] Proposal received (${data.proposal.id}), executing instant buy at $${buyPrice} (stake: $${this.currentStake})...`);
      this.ws.send(JSON.stringify({
        buy: data.proposal.id,
        price: buyPrice,
      }));
    }
  }

  private handleBuyResponse(data: any) {
    if (data.error) {
      console.error('[System Auto Live] Deriv Buy Error:', JSON.stringify(data.error));

      if (this.tradeWatchdogTimer) {
        clearTimeout(this.tradeWatchdogTimer);
        this.tradeWatchdogTimer = null;
      }

      const errorCode = data.error?.code || 'BUY_ERROR';
      const errorMsg = data.error?.message || 'Buy order rejected by broker';

      // If token/auth is bad or balance is insufficient, stop cleanly
      if (errorCode === 'InsufficientBalance' || errorMsg.toLowerCase().includes('balance')) {
        this.stop(`Insufficient balance to place stake: ${errorMsg}`);
        return;
      }
      if (errorCode === 'AuthorizationRequired' || errorCode === 'InvalidToken') {
        this.stop(`Deriv authentication error: ${errorMsg}`);
        return;
      }

      // Attempt instant proposal fallback if parameters exist
      const fallback = data.echo_req?.parameters;
      const targetDigit = this.pendingTradeDetails?.differDigit ?? (this.twinDigit ?? 0);
      const pool = this.getMarketPool();
      const market = pool[this.currentMarketIndex % pool.length];
      const fallbackSymbol = fallback?.symbol || fallback?.underlying_symbol || market?.symbol || 'R_100';

      if (fallback && this.ws && this.ws.readyState === 1 && this.phase === 'IN_TRADE') {
        console.warn(`[System Auto Live] Direct buy rejected (${errorCode}: ${errorMsg}), attempting proposal fallback...`);
        this.statusMessage = `Direct buy returned ${errorCode}. Requesting broker proposal fallback...`;
        try {
          const isOptionsApi = this.isOptionsEndpoint();
          const fallbackReq: Record<string, any> = {
            proposal: 1,
            amount: Number(fallback.amount) || this.currentStake,
            basis: 'stake',
            contract_type: fallback.contract_type || 'DIGITDIFF',
            currency: fallback.currency || this.currency || 'USD',
            duration: Number(fallback.duration) || 1,
            duration_unit: fallback.duration_unit || 't',
            barrier: String(fallback.barrier ?? targetDigit),
          };
          if (isOptionsApi) {
            fallbackReq.underlying_symbol = fallbackSymbol;
          } else {
            fallbackReq.symbol = fallbackSymbol;
          }
          this.ws.send(JSON.stringify(fallbackReq));
          return;
        } catch (_) {}
      }

      this.pendingTradeDetails = null;
      this.phase = 'SCANNING';
      this.statusMessage = `⚠️ Buy order rejected (${errorCode}): ${errorMsg}. Continuing scan...`;
      return;
    }

    const buy = data.buy;
    if (!buy || !buy.contract_id) {
      this.phase = 'SCANNING';
      this.statusMessage = '⚠️ No contract ID in buy response. Continuing scan...';
      return;
    }
    const pool = this.getMarketPool();
    const market = pool[this.currentMarketIndex % pool.length];
    const dur = this.pendingTradeDetails?.durationTicks ?? (this.config.durationTicks || 2);
    const targetDigit = this.pendingTradeDetails?.differDigit ?? (this.twinDigit ?? 0);

    this.activeContract = {
      id: String(buy.contract_id),
      symbol: market.symbol,
      marketName: market.shortName,
      differDigit: targetDigit,
      stake: Number(buy.buy_price) || this.currentStake,
      durationTicks: dur,
      entryPrice: 0,
      ticksCount: 0,
      spots: [],
    };

    this.statusMessage = `📋 In-Trade on ${market.shortName} (Contract ID: ${buy.contract_id}) ≠ ${targetDigit} (${dur}t). Waiting for settlement...`;
    console.log(`[System Auto Live] ${this.statusMessage}`);

    // Subscribe to proposal_open_contract for live tick progression and settlement
    try {
      this.ws.send(JSON.stringify({
        proposal_open_contract: 1,
        contract_id: buy.contract_id,
        subscribe: 1,
      }));
    } catch (e) {
      console.error('[System Auto Live] Failed to subscribe open contract:', e);
    }
  }

  private handleContractUpdate(poc: any) {
    if (!this.activeContract || String(poc.contract_id) !== this.activeContract.id) return;

    if (poc.entry_spot) {
      this.activeContract.entryPrice = Number(poc.entry_spot);
    }

    const isSettled = Boolean(poc.is_sold || poc.is_expired || poc.is_settled || ['won', 'lost', 'sold'].includes(String(poc.status || '').toLowerCase()));

    if (isSettled) {
      if (this.tradeWatchdogTimer) {
        clearTimeout(this.tradeWatchdogTimer);
        this.tradeWatchdogTimer = null;
      }

      const isWin = Number(poc.profit) > 0 || String(poc.status).toLowerCase() === 'won';
      const profit = Number(poc.profit) || (isWin ? this.activeContract.stake * 0.098 : -this.activeContract.stake);
      const exitSpot = Number(poc.exit_tick || poc.current_spot || 0);
      const pool = this.getMarketPool();
      const market = pool[this.currentMarketIndex % pool.length];
      const exitDigit = extractLastDigit(exitSpot, market.pipSize);

      let intermediateDigit: number | null = null;
      if (Array.isArray(poc.tick_stream) && poc.tick_stream.length > 1) {
        const spot1 = poc.tick_stream[0]?.tick;
        if (spot1) intermediateDigit = extractLastDigit(spot1, market.pipSize);
      }

      this.settleTrade({
        contractId: this.activeContract.id,
        market,
        targetDigit: this.activeContract.differDigit,
        stake: this.activeContract.stake,
        profit,
        isWin,
        entryPrice: this.activeContract.entryPrice,
        exitPrice: exitSpot,
        intermediateDigit,
        exitDigit,
      });
    }
  }

  private resolveHangingTrade(market: AscendingMarketDef, targetDigit: number, quote: number) {
    if (!this.activeContract) return;
    const exitDigit = extractLastDigit(quote, market.pipSize);
    const isWin = exitDigit !== targetDigit;
    const profit = isWin ? Number((this.activeContract.stake * 0.098).toFixed(2)) : -this.activeContract.stake;

    this.settleTrade({
      contractId: this.activeContract.id,
      market,
      targetDigit,
      stake: this.activeContract.stake,
      profit,
      isWin,
      entryPrice: quote,
      exitPrice: quote,
      intermediateDigit: null,
      exitDigit,
    });
  }

  private settleTrade(params: {
    contractId: string;
    market: AscendingMarketDef;
    targetDigit: number;
    stake: number;
    profit: number;
    isWin: boolean;
    entryPrice: number;
    exitPrice: number;
    intermediateDigit: number | null;
    exitDigit: number | null;
  }) {
    const { contractId, market, targetDigit, stake, profit, isWin, entryPrice, exitPrice, intermediateDigit, exitDigit } = params;

    // Update stats
    if (isWin) {
      this.totalWins++;
      this.consecutiveWins++;
      this.consecutiveLosses = 0;
      this.currentMartingaleStep = 0;
      this.consecutiveWinProfitAccumulator += profit;
    } else {
      this.totalLosses++;
      this.consecutiveLosses++;
      this.consecutiveWins = 0;
      this.consecutiveWinProfitAccumulator = 0;
      this.currentMartingaleStep++;
    }

    this.netProfit += profit;
    this.balanceUsd += profit;
    this.lastTradeResult = isWin ? 'WIN' : 'LOSS';
    this.lastTradeProfit = profit;
    this.lastTradeMarket = market.shortName;

    const durationTicks = this.activeContract?.durationTicks ?? (this.pendingTradeDetails?.durationTicks ?? (this.config.durationTicks || 2));
    const patternText = this.pendingTradeDetails?.patternText ?? `[${targetDigit}, ${targetDigit}]`;
    const stratLabel = this.pendingTradeDetails?.strategyLabel ?? `${market.shortName} Rule`;

    // Record trade
    const record: LiveTradeRecord = {
      id: contractId,
      timestamp: Date.now(),
      timeString: new Date().toLocaleTimeString(),
      symbol: market.symbol,
      marketName: market.shortName,
      strategyLabel: stratLabel,
      differDigit: targetDigit,
      triggerReason: `${stratLabel} (Ladder #${this.currentMarketIndex + 1})`,
      twinPattern: patternText,
      intermediateDigit,
      exitDigit,
      stake,
      profit: Number(profit.toFixed(2)),
      result: isWin ? 'WIN' : 'LOSS',
      durationTicks,
      entryPrice,
      exitPrice,
      cycleNumber: this.cycleNumber,
      marketStep: this.currentMarketIndex + 1,
    };

    this.pendingTradeDetails = null;
    this.tradeHistory.unshift(record);
    if (this.tradeHistory.length > 100) this.tradeHistory.pop();

    // Mark current market as traded in this cycle
    this.tradedSymbolsInCycle.add(market.symbol);
    this.activeContract = null;

    // Calculate next stake according to user's setting: FIXED or COMPOUNDING
    this.calculateNextStake(isWin);

    // Unsubscribe ticks for current market
    if (this.ws && this.ws.readyState === 1) {
      try {
        this.ws.send(JSON.stringify({ forget_all: 'ticks' }));
      } catch {}
    }

    const outcomeText = isWin ? `✅ WON (+$${profit.toFixed(2)})` : `❌ LOST (-$${Math.abs(profit).toFixed(2)})`;
    console.log(`[System Auto Live] Trade Settled: ${outcomeText} on ${market.shortName} ≠ ${targetDigit}. Settle: [${exitDigit}]. Net: $${this.netProfit.toFixed(2)}`);

    this.persistState();

    if (!this.isRunning) return;

    // Check risk limits
    if (this.netProfit >= this.config.takeProfit) {
      this.stop(`🎯 Take Profit reached (+${this.netProfit.toFixed(2)} USD >= +${this.config.takeProfit} USD)`);
      return;
    }
    if (this.netProfit <= -Math.abs(this.config.stopLoss)) {
      this.stop(`⚠️ Stop Loss reached (${this.netProfit.toFixed(2)} USD <= -${this.config.stopLoss} USD)`);
      return;
    }
    if (this.consecutiveLosses >= this.config.maxConsecutiveLosses) {
      this.stop(`🛑 Max consecutive losses reached (${this.consecutiveLosses})`);
      return;
    }

    // Enter 5-minute cooldown wait!
    this.enterCooldownWait(market, outcomeText);
  }

  private calculateNextStake(wasWin: boolean) {
    const { stakeMode, baseStake, compoundingPercent, martingaleMultiplier = 11.2, maxMartingaleSteps = 4 } = this.config;

    if (stakeMode === 'MARTINGALE') {
      if (wasWin) {
        // Reset to base stake upon win
        this.currentMartingaleStep = 0;
        this.currentStake = Number(baseStake.toFixed(2));
      } else {
        const mult = (martingaleMultiplier && martingaleMultiplier > 1) ? martingaleMultiplier : 11.2;
        const maxSteps = (maxMartingaleSteps && maxMartingaleSteps > 0) ? maxMartingaleSteps : 4;

        if (this.currentMartingaleStep <= maxSteps) {
          // Calculate compound martingale stake for recovery
          const nextStake = Number((baseStake * Math.pow(mult, this.currentMartingaleStep)).toFixed(2));
          this.currentStake = nextStake;
          console.log(`[System Auto Live] Martingale step ${this.currentMartingaleStep}/${maxSteps}: Next stake $${this.currentStake} (Multiplier ${mult}x)`);
        } else {
          console.warn(`[System Auto Live] Max Martingale steps (${maxSteps}) reached. Safety reset to base stake $${baseStake}.`);
          this.currentMartingaleStep = 0;
          this.currentStake = Number(baseStake.toFixed(2));
        }
      }
    } else if (stakeMode === 'COMPOUNDING') {
      if (wasWin) {
        // Reinvest profit into stake
        const compoundBoost = this.consecutiveWinProfitAccumulator * (compoundingPercent / 100);
        this.currentStake = Number((baseStake + compoundBoost).toFixed(2));
      } else {
        // Reset to base stake on loss
        this.currentStake = baseStake;
      }
    } else {
      // FIXED STAKE
      this.currentStake = baseStake;
    }

    if (this.currentStake < 0.35) this.currentStake = 0.35;
    if (this.currentStake > 5000) this.currentStake = 5000;
  }

  private enterCooldownWait(closedMarket: AscendingMarketDef, outcomeText: string) {
    if (this.config.botStrategyMode === 'TRIPLE_THREAT') {
      const waitMins = Math.max(0, this.config.waitMinutesBetweenMarkets ?? 0);
      if (waitMins <= 0.05) {
        // Immediate resume of multi-market parallel scan
        this.statusMessage = `${outcomeText} on ${closedMarket.shortName} ➔ ⚡ Trade completed. Instantly resuming Tripple Threat multi-market scan...`;
        console.log(`[System Auto Live] ${this.statusMessage}`);
        this.beginMarketScan();
        return;
      }

      this.cooldownTotalSeconds = Math.round(waitMins * 60);
      this.cooldownEndTime = Date.now() + this.cooldownTotalSeconds * 1000;
      this.phase = 'WAITING_COOLDOWN';
      this.statusMessage = `${outcomeText} on ${closedMarket.shortName} ➔ ⏳ Waiting ${waitMins} minute${waitMins > 1 ? 's' : ''} before resuming Tripple Threat multi-market scan...`;
      console.log(`[System Auto Live] ${this.statusMessage}`);

      if (this.cooldownTimer) clearTimeout(this.cooldownTimer);
      this.cooldownTimer = setTimeout(() => {
        this.cooldownTimer = null;
        this.cooldownEndTime = null;
        if (!this.isRunning) return;
        this.beginMarketScan();
      }, this.cooldownTotalSeconds * 1000);
      return;
    }

    if (this.config.botStrategyMode === 'DOUBLE_BOT') {
      const waitMins = Math.max(0, this.config.waitMinutesBetweenMarkets ?? 0);
      if (waitMins <= 0.05) {
        // Immediate resume of multi-market parallel scan
        this.statusMessage = `${outcomeText} on ${closedMarket.shortName} ➔ ⚡ Trade completed (Next digit settled). Instantly resuming Double Bot multi-market scan...`;
        console.log(`[System Auto Live] ${this.statusMessage}`);
        this.beginMarketScan();
        return;
      }

      this.cooldownTotalSeconds = Math.round(waitMins * 60);
      this.cooldownEndTime = Date.now() + this.cooldownTotalSeconds * 1000;
      this.phase = 'WAITING_COOLDOWN';
      this.statusMessage = `${outcomeText} on ${closedMarket.shortName} ➔ ⏳ Waiting ${waitMins} minute${waitMins > 1 ? 's' : ''} before resuming Double Bot multi-market scan...`;
      console.log(`[System Auto Live] ${this.statusMessage}`);

      if (this.cooldownTimer) clearTimeout(this.cooldownTimer);
      this.cooldownTimer = setTimeout(() => {
        this.cooldownTimer = null;
        this.cooldownEndTime = null;
        if (!this.isRunning) return;
        this.beginMarketScan();
      }, this.cooldownTotalSeconds * 1000);
      return;
    }

    const pool = this.getMarketPool();
    const nextMarketIdx = (this.currentMarketIndex + 1) % pool.length;
    const nextMarket = pool[nextMarketIdx];

    const waitMins = Math.max(0.1, this.config.waitMinutesBetweenMarkets || 5);
    this.cooldownTotalSeconds = Math.round(waitMins * 60);
    this.cooldownEndTime = Date.now() + this.cooldownTotalSeconds * 1000;
    this.phase = 'WAITING_COOLDOWN';

    this.statusMessage = `${outcomeText} on ${closedMarket.shortName} ➔ ⏳ Waiting ${waitMins} minute${waitMins > 1 ? 's' : ''} before scanning next market: ${nextMarket.shortName}...`;
    console.log(`[System Auto Live] ${this.statusMessage}`);

    if (this.cooldownTimer) clearTimeout(this.cooldownTimer);

    this.cooldownTimer = setTimeout(() => {
      this.cooldownTimer = null;
      this.cooldownEndTime = null;

      if (!this.isRunning) return;

      // Advance ascending market index
      this.currentMarketIndex = nextMarketIdx;
      if (this.currentMarketIndex === 0) {
        this.cycleNumber++;
        this.tradedSymbolsInCycle.clear();
        console.log(`[System Auto Live] 🔄 Cycle #${this.cycleNumber} started at ${nextMarket.shortName}`);
      }

      this.beginMarketScan();
    }, this.cooldownTotalSeconds * 1000);
  }
}

export const systemAutoLiveRunner = new SystemAutoLiveRunner();
