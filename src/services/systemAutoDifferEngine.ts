import { MarketSymbol, Tick, ActiveContract } from '../types/deriv';
import { derivWS, extractDerivLastDigit, formatDerivQuote } from './derivWebSocket';
import { soundManager } from '../utils/soundEffects';
import { strategyShield } from './strategyShield';

export interface AscendingMarket {
  symbol: MarketSymbol;
  name: string;
  shortName: string;
  volatility: number;
  isOneSecond: boolean;
  pipSize: number;
}

export const ASCENDING_VOLATILITY_MARKETS: AscendingMarket[] = [
  { symbol: 'R_10', name: 'Volatility 10 Index', shortName: 'Vol 10', volatility: 10, isOneSecond: false, pipSize: 3 },
  { symbol: '1HZ10V', name: 'Volatility 10 (1s) Index', shortName: 'Vol 10 (1s)', volatility: 10, isOneSecond: true, pipSize: 2 },
  { symbol: '1HZ15V', name: 'Volatility 15 (1s) Index', shortName: 'Vol 15 (1s)', volatility: 15, isOneSecond: true, pipSize: 2 },
  { symbol: 'R_25', name: 'Volatility 25 Index', shortName: 'Vol 25', volatility: 25, isOneSecond: false, pipSize: 3 },
  { symbol: '1HZ25V', name: 'Volatility 25 (1s) Index', shortName: 'Vol 25 (1s)', volatility: 25, isOneSecond: true, pipSize: 2 },
  { symbol: '1HZ30V', name: 'Volatility 30 (1s) Index', shortName: 'Vol 30 (1s)', volatility: 30, isOneSecond: true, pipSize: 2 },
  { symbol: 'R_50', name: 'Volatility 50 Index', shortName: 'Vol 50', volatility: 50, isOneSecond: false, pipSize: 4 },
  { symbol: '1HZ50V', name: 'Volatility 50 (1s) Index', shortName: 'Vol 50 (1s)', volatility: 50, isOneSecond: true, pipSize: 2 },
  { symbol: 'R_75', name: 'Volatility 75 Index', shortName: 'Vol 75', volatility: 75, isOneSecond: false, pipSize: 4 },
  { symbol: '1HZ75V', name: 'Volatility 75 (1s) Index', shortName: 'Vol 75 (1s)', volatility: 75, isOneSecond: true, pipSize: 2 },
  { symbol: '1HZ90V', name: 'Volatility 90 (1s) Index', shortName: 'Vol 90 (1s)', volatility: 90, isOneSecond: true, pipSize: 2 },
  { symbol: 'R_100', name: 'Volatility 100 Index', shortName: 'Vol 100', volatility: 100, isOneSecond: false, pipSize: 2 },
  { symbol: '1HZ100V', name: 'Volatility 100 (1s) Index', shortName: 'Vol 100 (1s)', volatility: 100, isOneSecond: true, pipSize: 2 },
];

export const STANDARD_ASCENDING_MARKETS = ASCENDING_VOLATILITY_MARKETS.filter((m) => !m.isOneSecond);
export const ONESECOND_ASCENDING_MARKETS = ASCENDING_VOLATILITY_MARKETS.filter((m) => m.isOneSecond);

export type MoneyManagementMode = 'MARTINGALE' | 'COMPOUNDING' | 'HYBRID' | 'FLAT';
export type MarketScopeMode =
  | 'ALL_10_TO_100'
  | 'STANDARD_10_TO_100'
  | 'ONESECOND_10_TO_100'
  | 'SINGLE_SPECIFIC'
  | 'CUSTOM_SELECTED';
export type AutoTerminalStrategy =
  | 'TWIN_0_AND_9_DIFFER'
  | 'ALTERNATING_DIGITS'
  | 'DOUBLE_BOT_1TICK'
  | 'DOUBLE_IDENTICAL_2TICK'
  | 'ASCENDING_SEQUENTIAL_1TICK'
  | 'DIGIT_SELECT_DIFFER'
  | 'MASTER_DOUBLE'
  | 'MASTER_DOUBLE_2'
  | 'LAST_DIGIT_DIFFER'
  | 'ENTRY_POINT_DIFFER'
  | 'DOUBLE_1_SELECT'
  | 'DIGIT_MARKER_DIFFER'
  | 'RANGE_LONG_DIFFERS'
  | 'COMBINER_BOT'
  | 'DOUBLE_END_BOT'
  | 'FAST_LAST_DIFFER';

export interface SystemAutoConfig {
  strategyMode: AutoTerminalStrategy;
  baseStake: number;
  stakeMode: MoneyManagementMode;
  martingaleMultiplier: number;
  maxMartingaleSteps: number;
  compoundingPercent: number;
  durationTicks: number; // Defaults to 1 tick for Double Identical Differ, 1 tick for Alternating Digits
  marketScope: MarketScopeMode;
  specificMarketSymbol?: MarketSymbol; // For SINGLE_SPECIFIC mode
  selectedSymbols?: MarketSymbol[]; // For CUSTOM_SELECTED mode
  takeProfit: number;
  stopLoss: number;
  maxConsecutiveLosses: number;
  delayBetweenTradesMs: number;
  marketCooldownSec: number;
  alternatingTargetDigit?: number; // Defaults to 5
  alternatingCooldownSec?: number; // Defaults to 5s
  alternatingPatternLength?: number; // Defaults to 3
  digitSelectTargetDigit?: number; // Digit selected to differ (0..9, defaults to 5)
  digitSelectVolatilitySymbol?: MarketSymbol; // Volatility selected for Digit Select Differ (defaults to R_100)
  masterDouble2SelectedPatterns?: number[]; // Selected twin digits to trade (0..8). e.g. [0, 1, 2, 3, 4, 5, 6, 7, 8]
  lastDigitDifferMarketSymbol?: MarketSymbol; // Volatility market selected for Last Digit Differ (defaults to R_25)
  entryPointMarketSymbol?: MarketSymbol; // Volatility market selected for Entry Point Bot (defaults to R_100)
  entryPointTargetDigit?: number; // Target digit selected to trade Differ when it appears (0..9, defaults to 5)
  double1SelectMarketSymbol?: MarketSymbol; // Volatility market selected for Double 1 Select (defaults to R_100)
  double1SelectMaxDigitsRange?: number; // Max digits range after twin pattern to wait for locked digit (defaults to 6)
  digitMarkerMarketSymbol?: MarketSymbol; // Volatility market selected for Digit Marker Bot (defaults to R_100)
  digitMarkerTargetDigit?: number; // Marked digit to scan and Differ when it appears (0..9, defaults to 6)
  rangeLongDiffersMarketSymbol?: MarketSymbol; // Volatility market selected for Range Long Differs (defaults to R_100)
  // ⚡ Double End Bot Configuration (Scans a market for pair [x, x] or thrice [x, x, x] ➔ Differ ≠ y)
  doubleEndMarketSymbol?: MarketSymbol; // Volatility market selected for Double End Bot (defaults to R_100)
  doubleEndPatternMode?: 'PAIR_OR_THRICE' | 'PAIR_ONLY' | 'THRICE_ONLY'; // Pattern type to scan (default: PAIR_OR_THRICE)
  // ⚡ Fast Last Differ Configuration (Scans all markets at once ➔ First market to produce chosen digit buys Differ ≠ chosen digit • 1t settle)
  fastLastDifferChosenDigit?: number; // Chosen digit (0..9, default: 5)
  // 🧩 Combiner Bot Configuration (Combines 4 strategies in ascending volatility markets)
  combinerStage1Market?: MarketSymbol; // Stage 1: [x, x, y] ➔ differ digit y (default: R_10)
  combinerStage2Market?: MarketSymbol; // Stage 2: [x, y, x, x] ➔ differ digit x (default: R_25)
  combinerStage3Market?: MarketSymbol; // Stage 3: Double [x, x] lock ➔ Reappearance differ digit x (default: R_50)
  combinerStage4Market?: MarketSymbol; // Stage 4: Differ last digit (default: R_100)
  combinerExecutionMode?: 'ASCENDING_SEQUENTIAL' | 'PARALLEL_MULTI_MARKET'; // Default: ASCENDING_SEQUENTIAL
  combinerAdvanceOn?: 'ALWAYS' | 'WIN_ONLY'; // Default: ALWAYS
  combinerStage3MaxWaitTicks?: number; // Default: 20
  singleTradeSequentialMode: boolean; // 1 Trade at a Time: takes 1 trade, pauses scanning, waits for close, then scans again
  postTradeScanDelaySec: number; // Delay in seconds after trade close before scanning resumes (0s = instant, 1s, 2s, 3s, 5s)
  requireFreshPatternAfterClose: boolean; // Reset prior triggers upon trade close; strictly scan incoming ticks after close
  virtualLossFilterEnabled: boolean; // Virtual Loss Hook: trades in demo until 1 loss occurs, then takes next trade on real account! After win on real, reverts to demo mode.
  virtualDemoStake: number; // Virtual demo trade stake (default $1.00)
}

export interface TradeContractTick {
  tickNum: number;
  spot: number;
  digit: number;
  epoch: number;
  isExit: boolean;
}

export interface TradeRecord {
  id: string;
  timestamp: number;
  timeString: string;
  symbol: MarketSymbol;
  marketName: string;
  differDigit: number;
  triggerReason: string;
  twinPattern?: string;
  intermediateDigit?: number | null;
  intermediateSpot?: number | null;
  exitDigit: number | null;
  stake: number;
  profit: number;
  result: 'WIN' | 'LOSS' | 'OPEN';
  durationTicks: number;
  entryPrice: number;
  exitPrice?: number;
  cycleNumber: number;
  ticksCaptured?: TradeContractTick[];
  accountType?: 'DEMO' | 'REAL';
  isVirtual?: boolean;
  appliedJitterMs?: number;
  fuzzedStakeDiff?: number;
}

export interface MarketLiveState {
  symbol: MarketSymbol;
  price: number;
  displayPrice: string;
  lastDigit: number;
  lastTickTime: number;
  recentDigits: number[];
  hasTwinDigit: boolean;
  twinDigit: number | null;
  hasTwin0or9?: boolean;
  twin0or9Digit?: number | null;
  lastTwinTime: number | null;
  twinOccurrencesCount: number;
  hasAlternatingPattern?: boolean;
  alternatingPatternText?: string;
  alternatingDigits?: number[];
  hasDoubleBotPattern?: boolean;
  doubleBotTargetDigit?: number | null;
  doubleBotDigits?: number[];
  doubleBotPatternStr?: string;
  hasMasterDoublePattern?: boolean;
  masterDoubleTwinDigit?: number | null;
  masterDoubleTargetDigit?: number | null;
  masterDoublePatternStr?: string;
  hasDoubleEndPattern?: boolean;
  doubleEndType?: 'PAIR' | 'THRICE' | null;
  doubleEndBaseDigit?: number | null;
  doubleEndDifferTarget?: number | null;
  doubleEndPatternStr?: string;
  doubleEndDigits?: number[];
}

export interface SystemAutoStatus {
  isRunning: boolean;
  isSettling: boolean;
  strategyMode: AutoTerminalStrategy;
  activeMarketIndex: number;
  currentMarket: AscendingMarket;
  nextMarket: AscendingMarket;
  tradedSymbolsInCycle: MarketSymbol[];
  cycleCompletedCount: number;
  cycleTotalCount: number;
  currentStake: number;
  totalTrades: number;
  totalWins: number;
  totalLosses: number;
  winRate: number;
  netProfit: number;
  consecutiveWins: number;
  consecutiveLosses: number;
  maxConsecutiveWins: number;
  maxConsecutiveLosses: number;
  currentCycle: number;
  activeContractId: string | null;
  activeDifferDigit: number | null;
  activeTriggerReason: string | null;
  activeContractTicks: TradeContractTick[];
  statusMessage: string;
  lastExecutionMs: number;
  stopReason: string | null;
  lastSettledProfit: number | null;
  lastSettledBalance: number | null;
  lastSettledMarketName: string | null;
  lastSettledTriggerReason: string | null;
  lastTradedSymbol: MarketSymbol | null;
  lastTradedMarketName: string | null;
  qualifyingCount: number;
  singleTradeSequentialMode: boolean;
  isTradeActive: boolean;
  scanPhase: 'IDLE' | 'SCANNING' | 'TRADE_ACTIVE' | 'TRADE_SETTLING' | 'POST_TRADE_COOLDOWN';
  postTradeCountdownSec: number | null;
  virtualLossFilterEnabled: boolean;
  virtualModeState: 'VIRTUAL' | 'REAL_ARMED' | 'REAL_ACTIVE';
  virtualWins: number;
  virtualLosses: number;
  virtualConsecutiveLosses: number;
  virtualNetProfit: number;
  digitSelectTargetDigit: number;
  digitSelectVolatilitySymbol: MarketSymbol;
  lastDigitDifferMarketSymbol: MarketSymbol;
  lastDigitDifferImmediateDigit: number;
  entryPointMarketSymbol: MarketSymbol;
  entryPointTargetDigit: number;
  double1SelectMarketSymbol: MarketSymbol;
  double1SelectMaxDigitsRange: number;
  double1SelectState: 'HUNTING' | 'WAITING_FOR_REAPPEARANCE';
  double1SelectLockedDigit: number | null;
  double1SelectInterveningDigits: number[];
  rangeLongWindowDigits: number[];
  rangeLongCurrentCount: number;
  rangeLongMostAppearingDigit: number | null;
  rangeLongMostAppearingCount: number;
  rangeLongDigitFrequencies: Record<number, number>;
  rangeLongDiffersMarketSymbol: MarketSymbol;
  // ⚡ Double End Bot Status Fields
  doubleEndMarketSymbol: MarketSymbol;
  doubleEndPatternMode: 'PAIR_OR_THRICE' | 'PAIR_ONLY' | 'THRICE_ONLY';
  doubleEndDetectedPattern: 'NONE' | 'PAIR' | 'THRICE';
  doubleEndBaseDigit: number | null;
  doubleEndDifferTarget: number | null;
  doubleEndDigits: number[];
  // ⚡ Fast Last Differ Status Fields
  fastLastDifferChosenDigit: number;
  fastLastDifferTriggeredMarket: MarketSymbol | null;
  // 🧩 Combiner Bot Status Fields
  combinerCurrentStage: 1 | 2 | 3 | 4;
  combinerCycleCount: number;
  combinerStage3State: 'HUNTING_DOUBLE' | 'LOCKED_WAITING_FOR_REAPPEARANCE';
  combinerStage3LockedDigit: number | null;
  combinerStage3InterveningDigits: number[];
  combinerStageWins: [number, number, number, number];
  combinerStageLosses: [number, number, number, number];
  combinerStageMarkets: [MarketSymbol, MarketSymbol, MarketSymbol, MarketSymbol];
  manipulationThreatScore: number;
  manipulationThreatLevel: string;
  isProfitLocked: boolean;
  profitLockReason?: string;
  isZeroTraceMode: boolean;
  lastShieldJitterMs: number;
  isAntiTrackingShieldActive: boolean;
  isDecoyTrafficActive: boolean;
  isDynamicMarketHopping: boolean;
}

class SystemAutoDifferEngine {
  private config: SystemAutoConfig = {
    strategyMode: 'DOUBLE_IDENTICAL_2TICK',
    baseStake: 0.50,
    stakeMode: 'MARTINGALE',
    martingaleMultiplier: 11.2,
    maxMartingaleSteps: 4,
    compoundingPercent: 50,
    durationTicks: 1,
    marketScope: 'ALL_10_TO_100',
    specificMarketSymbol: 'R_10',
    selectedSymbols: ['R_10', '1HZ10V', '1HZ15V', 'R_25', '1HZ25V', '1HZ30V', 'R_50', '1HZ50V', 'R_75', '1HZ75V', '1HZ90V', 'R_100', '1HZ100V'],
    takeProfit: 25,
    stopLoss: 50,
    maxConsecutiveLosses: 3,
    delayBetweenTradesMs: 0, // 0ms = Instant Zero-Lag Execution
    marketCooldownSec: 0, // 0s cooldown for immediate next-trade trigger
    alternatingTargetDigit: 5,
    alternatingCooldownSec: 5,
    alternatingPatternLength: 3,
    digitSelectTargetDigit: 5,
    digitSelectVolatilitySymbol: 'R_100',
    masterDouble2SelectedPatterns: [0, 1, 2, 3, 4, 5, 6, 7, 8],
    lastDigitDifferMarketSymbol: 'R_25',
    entryPointMarketSymbol: 'R_100',
    entryPointTargetDigit: 5,
    double1SelectMarketSymbol: 'R_100',
    double1SelectMaxDigitsRange: 6,
    digitMarkerMarketSymbol: 'R_100',
    digitMarkerTargetDigit: 6,
    rangeLongDiffersMarketSymbol: 'R_100',
    doubleEndMarketSymbol: 'R_100',
    doubleEndPatternMode: 'PAIR_OR_THRICE',
    fastLastDifferChosenDigit: 5,
    combinerStage1Market: 'R_10',
    combinerStage2Market: 'R_25',
    combinerStage3Market: 'R_50',
    combinerStage4Market: 'R_100',
    combinerExecutionMode: 'ASCENDING_SEQUENTIAL',
    combinerAdvanceOn: 'ALWAYS',
    combinerStage3MaxWaitTicks: 20,
    singleTradeSequentialMode: true, // Default: 1 trade, wait for close, then scan again
    postTradeScanDelaySec: 1, // Default: 1s clean pause after trade close before scanning again
    requireFreshPatternAfterClose: true, // Clear prior trigger states on close
    virtualLossFilterEnabled: false, // Default off: toggleable via UI button
    virtualDemoStake: 1.00,
  };

  private isRunning: boolean = false;
  private isSettling: boolean = false;
  private scanPhase: 'IDLE' | 'SCANNING' | 'TRADE_ACTIVE' | 'TRADE_SETTLING' | 'POST_TRADE_COOLDOWN' = 'IDLE';
  private postTradeCountdownSec: number | null = null;
  private postTradeCountdownTimer: number | null = null;
  private lastTradeClosedTime: number = 0;
  private activeMarketIndex: number = 0;
  private currentStake: number = 0.50;
  private consecutiveWins: number = 0;
  private consecutiveLosses: number = 0;
  private maxConsecutiveWins: number = 0;
  private maxConsecutiveLosses: number = 0;
  private totalWins: number = 0;
  private totalLosses: number = 0;
  private netProfit: number = 0;
  private currentCycle: number = 1;
  private currentStepInCycle: number = 0;
  private activeContractId: string | null = null;
  private activeDifferDigit: number | null = null;
  private activeTriggerReason: string | null = null;
  private activeContractTicks: TradeContractTick[] = [];
  private previousDifferDigit: number | null = null;
  private statusMessage: string = 'System Auto Terminal Ready. Double Identical Digit 1-Tick Instant Differ Sniper enabled.';
  private stopReason: string | null = null;
  private lastTradeStartTime: number = 0;
  private lastExecutionMs: number = 0;
  private consecutiveWinProfitAccumulator: number = 0;
  private currentMartingaleStep: number = 0;

  // 🎯 Double 1 Select Runtime State
  private double1SelectLockedDigit: number | null = null;
  private double1SelectInterveningDigits: number[] = [];
  private double1SelectState: 'HUNTING' | 'WAITING_FOR_REAPPEARANCE' = 'HUNTING';

  // ⚡ Double End Bot Runtime State
  private doubleEndDetectedPattern: 'NONE' | 'PAIR' | 'THRICE' = 'NONE';
  private doubleEndBaseDigit: number | null = null;
  private doubleEndDifferTarget: number | null = null;
  private doubleEndDigits: number[] = [];

  // ⚡ Fast Last Differ Runtime State
  private fastLastDifferTriggeredMarket: MarketSymbol | null = null;

  // 🧪 Virtual Loss Hook State Machine
  private virtualModeState: 'VIRTUAL' | 'REAL_ARMED' | 'REAL_ACTIVE' = 'VIRTUAL';
  private virtualWins: number = 0;
  private virtualLosses: number = 0;
  private virtualConsecutiveLosses: number = 0;
  private virtualNetProfit: number = 0;

  private currentBalanceUsd: number = 10000;
  private lastSettledProfit: number | null = null;
  private lastSettledBalance: number | null = null;
  private lastSettledMarketName: string | null = null;
  private lastSettledTriggerReason: string | null = null;
  private lastTradedSymbol: MarketSymbol | null = null;
  private lastTradedMarketName: string | null = null;
  private onBalanceUpdateCallback: ((profit: number, newBalance: number) => void) | null = null;

  private trackedContractIds = new Set<string>();
  private watchdogTimer: number | null = null;
  private nextTradeTimer: number | null = null;

  // Track traded markets in the current ascending cycle (1 trade per market from Vol 10 to 100)
  private tradedMarketsInCycle = new Set<MarketSymbol>();

  // Market cooldowns and trigger memory to prevent duplicate entries on identical tick events
  private marketLastTradeTime = new Map<string, number>();
  private marketLastTriggerPrice = new Map<string, number>();

  private marketStates = new Map<MarketSymbol, MarketLiveState>();
  private tradeHistory: TradeRecord[] = [];
  private listeners = new Set<(status: SystemAutoStatus) => void>();
  private configListeners = new Set<(config: SystemAutoConfig) => void>();
  private historyListeners = new Set<(trades: TradeRecord[]) => void>();
  private marketLiveListeners = new Set<(states: Map<MarketSymbol, MarketLiveState>) => void>();

  private isProcessingTrade: boolean = false;
  private rangeLongWindowDigits: number[] = [];
  private rangeLongLockedModeDigit: number | null = null;

  // 🧩 Combiner Bot Runtime State
  private combinerCurrentStage: 1 | 2 | 3 | 4 = 1;
  private combinerCycleCount: number = 1;
  private combinerStage3State: 'HUNTING_DOUBLE' | 'LOCKED_WAITING_FOR_REAPPEARANCE' = 'HUNTING_DOUBLE';
  private combinerStage3LockedDigit: number | null = null;
  private combinerStage3InterveningDigits: number[] = [];
  private combinerStageWins: [number, number, number, number] = [0, 0, 0, 0];
  private combinerStageLosses: [number, number, number, number] = [0, 0, 0, 0];

  constructor() {
    this.initLiveSubscriptions();
    this.loadSavedConfig();
  }

  public getRangeLongAnalysis(): {
    windowDigits: number[];
    count: number;
    mostAppearingDigit: number | null;
    mostAppearingCount: number;
    frequencies: Record<number, number>;
  } {
    const digits = [...this.rangeLongWindowDigits];
    const freqs: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0 };
    for (const d of digits) {
      if (d >= 0 && d <= 9) freqs[d] = (freqs[d] || 0) + 1;
    }
    let bestDigit: number | null = null;
    let maxCount = 0;
    // Find the digit with highest frequency; if tie, prioritize the most recently appeared digit in window
    for (let i = digits.length - 1; i >= 0; i--) {
      const d = digits[i];
      const count = freqs[d] || 0;
      if (count > maxCount) {
        maxCount = count;
        bestDigit = d;
      }
    }
    return {
      windowDigits: digits,
      count: digits.length,
      mostAppearingDigit: bestDigit,
      mostAppearingCount: maxCount,
      frequencies: freqs,
    };
  }

  public resetRangeLongWindow() {
    this.rangeLongWindowDigits = [];
    this.rangeLongLockedModeDigit = null;
    this.notifyStatus();
  }

  public selectRangeLongDiffersMarket(symbol: MarketSymbol) {
    this.config.rangeLongDiffersMarketSymbol = symbol;
    this.rangeLongWindowDigits = [];
    this.rangeLongLockedModeDigit = null;
    this.saveConfig(this.config);
    this.notifyStatus();
  }

  /**
   * 🔀 Phantom Market Hopping:
   * Rotates between volatility markets so broker dealing-desk algorithms
   * cannot profile or counter the trader on a single asset order book.
   */
  public hopToNextMarket() {
    const pool = ASCENDING_VOLATILITY_MARKETS;
    const currentSym = this.config.rangeLongDiffersMarketSymbol || this.config.digitMarkerMarketSymbol || this.config.specificMarketSymbol || 'R_100';
    const currIdx = pool.findIndex((m) => m.symbol === currentSym);
    const nextIdx = (currIdx + 1) % pool.length;
    const nextMarket = pool[nextIdx];

    this.config.rangeLongDiffersMarketSymbol = nextMarket.symbol;
    this.config.digitMarkerMarketSymbol = nextMarket.symbol;
    this.config.specificMarketSymbol = nextMarket.symbol;
    this.rangeLongWindowDigits = [];
    this.saveConfig(this.config);
    strategyShield.logShieldEvent(`🔀 Phantom Hopping: Switched active asset to ${nextMarket.name} (${nextMarket.shortName}) to break dealer profiling`, 'hopping');
    this.notifyStatus();
  }

  public getMarketPool(): AscendingMarket[] {
    if (this.config.strategyMode === 'COMBINER_BOT') {
      const m1 = this.config.combinerStage1Market || 'R_10';
      const m2 = this.config.combinerStage2Market || 'R_25';
      const m3 = this.config.combinerStage3Market || 'R_50';
      const m4 = this.config.combinerStage4Market || 'R_100';
      const symbols = [m1, m2, m3, m4];
      const uniqueSymbols = Array.from(new Set(symbols));
      const found = ASCENDING_VOLATILITY_MARKETS.filter((m) => uniqueSymbols.includes(m.symbol));
      return found.length > 0 ? found : [ASCENDING_VOLATILITY_MARKETS[0]];
    }

    if (this.config.strategyMode === 'RANGE_LONG_DIFFERS') {
      const targetSym = this.config.rangeLongDiffersMarketSymbol || 'R_100';
      const found = ASCENDING_VOLATILITY_MARKETS.filter((m) => m.symbol === targetSym);
      return found.length > 0 ? found : [ASCENDING_VOLATILITY_MARKETS.find((m) => m.symbol === 'R_100') || ASCENDING_VOLATILITY_MARKETS[0]];
    }

    if (this.config.strategyMode === 'LAST_DIGIT_DIFFER') {
      const targetSym = this.config.lastDigitDifferMarketSymbol || 'R_25';
      const found = ASCENDING_VOLATILITY_MARKETS.filter((m) => m.symbol === targetSym);
      return found.length > 0 ? found : [ASCENDING_VOLATILITY_MARKETS.find((m) => m.symbol === 'R_25') || ASCENDING_VOLATILITY_MARKETS[0]];
    }

    if (this.config.strategyMode === 'ENTRY_POINT_DIFFER') {
      const targetSym = this.config.entryPointMarketSymbol || 'R_100';
      const found = ASCENDING_VOLATILITY_MARKETS.filter((m) => m.symbol === targetSym);
      return found.length > 0 ? found : [ASCENDING_VOLATILITY_MARKETS.find((m) => m.symbol === 'R_100') || ASCENDING_VOLATILITY_MARKETS[0]];
    }

    if (this.config.strategyMode === 'DIGIT_SELECT_DIFFER') {
      const targetSym = this.config.digitSelectVolatilitySymbol || this.config.specificMarketSymbol || 'R_100';
      const found = ASCENDING_VOLATILITY_MARKETS.filter((m) => m.symbol === targetSym);
      return found.length > 0 ? found : [ASCENDING_VOLATILITY_MARKETS[0]];
    }

    if (this.config.strategyMode === 'DOUBLE_1_SELECT') {
      const targetSym = this.config.double1SelectMarketSymbol || this.config.specificMarketSymbol || 'R_100';
      const found = ASCENDING_VOLATILITY_MARKETS.filter((m) => m.symbol === targetSym);
      return found.length > 0 ? found : [ASCENDING_VOLATILITY_MARKETS.find((m) => m.symbol === 'R_100') || ASCENDING_VOLATILITY_MARKETS[0]];
    }

    if (this.config.strategyMode === 'DIGIT_MARKER_DIFFER') {
      const targetSym = this.config.digitMarkerMarketSymbol || 'R_100';
      const found = ASCENDING_VOLATILITY_MARKETS.filter((m) => m.symbol === targetSym);
      return found.length > 0 ? found : [ASCENDING_VOLATILITY_MARKETS.find((m) => m.symbol === 'R_100') || ASCENDING_VOLATILITY_MARKETS[0]];
    }

    switch (this.config.marketScope) {
      case 'SINGLE_SPECIFIC': {
        const targetSym = this.config.specificMarketSymbol || 'R_10';
        const found = ASCENDING_VOLATILITY_MARKETS.filter((m) => m.symbol === targetSym);
        return found.length > 0 ? found : [ASCENDING_VOLATILITY_MARKETS[0]];
      }
      case 'CUSTOM_SELECTED': {
        const selected = this.config.selectedSymbols || [];
        if (selected.length === 0) return ASCENDING_VOLATILITY_MARKETS;
        const filtered = ASCENDING_VOLATILITY_MARKETS.filter((m) => selected.includes(m.symbol));
        return filtered.length > 0 ? filtered : ASCENDING_VOLATILITY_MARKETS;
      }
      case 'STANDARD_10_TO_100':
        return STANDARD_ASCENDING_MARKETS;
      case 'ONESECOND_10_TO_100':
        return ONESECOND_ASCENDING_MARKETS;
      case 'ALL_10_TO_100':
      default:
        return ASCENDING_VOLATILITY_MARKETS;
    }
  }

  /**
   * Set target differ digit for Digit Select Differ bot (0..9)
   */
  public selectDigitSelectTargetDigit(digit: number) {
    if (digit < 0 || digit > 9) return;
    this.config.digitSelectTargetDigit = digit;
    this.saveConfig(this.config);
    soundManager.playButtonClick();
    this.statusMessage = `🎯 Digit Select Differ: Target Differ Digit set to ≠${digit}`;
    this.notifyStatus();
  }

  /**
   * Set volatility index for Digit Select Differ bot
   */
  public selectDigitSelectVolatility(symbol: MarketSymbol) {
    this.config.digitSelectVolatilitySymbol = symbol;
    this.saveConfig(this.config);
    const target = ASCENDING_VOLATILITY_MARKETS.find((m) => m.symbol === symbol) || ASCENDING_VOLATILITY_MARKETS[0];
    soundManager.playButtonClick();
    this.statusMessage = `🎯 Digit Select Differ: Volatility market set to [${target.shortName}]`;
    this.notifyStatus();
  }

  /**
   * Set target volatility market for Last Digit Differ bot (e.g. Volatility 25 Index)
   */
  public selectLastDigitDifferMarket(symbol: MarketSymbol) {
    this.config.lastDigitDifferMarketSymbol = symbol;
    this.saveConfig(this.config);
    const target = ASCENDING_VOLATILITY_MARKETS.find((m) => m.symbol === symbol) || ASCENDING_VOLATILITY_MARKETS[0];
    soundManager.playButtonClick();
    const live = this.marketStates.get(symbol);
    const immediateDigit = live ? live.lastDigit : 0;
    this.statusMessage = `🎯 Last Digit Differ: Market locked on [${target.shortName}]. Current immediate last digit: [${immediateDigit}] ➔ Differ ≠ ${immediateDigit} (1t Settle)`;
    this.notifyStatus();
  }

  /**
   * Set target volatility market for Entry Point bot (e.g. Volatility 100 Index)
   */
  public selectEntryPointMarket(symbol: MarketSymbol) {
    this.config.entryPointMarketSymbol = symbol;
    this.saveConfig(this.config);
    const target = ASCENDING_VOLATILITY_MARKETS.find((m) => m.symbol === symbol) || ASCENDING_VOLATILITY_MARKETS[0];
    soundManager.playButtonClick();
    const live = this.marketStates.get(symbol);
    const curD = live ? live.lastDigit : 0;
    const targetDigit = this.config.entryPointTargetDigit !== undefined ? this.config.entryPointTargetDigit : 5;
    this.statusMessage = `🎯 Entry Point Bot: Market set to [${target.shortName}]. Scanning for digit [${targetDigit}] (Live digit: [${curD}]) ➔ When digit [${targetDigit}] appears, buys Differ ≠ ${targetDigit} (1t close)`;
    this.notifyStatus();
  }

  /**
   * Set target digit to trade Differ when it appears on the market (0..9)
   */
  public selectEntryPointTargetDigit(digit: number) {
    const d = Math.max(0, Math.min(9, Math.floor(digit)));
    this.config.entryPointTargetDigit = d;
    this.saveConfig(this.config);
    soundManager.playButtonClick();
    const targetSymbol = this.config.entryPointMarketSymbol || 'R_100';
    const target = ASCENDING_VOLATILITY_MARKETS.find((m) => m.symbol === targetSymbol) || ASCENDING_VOLATILITY_MARKETS[0];
    const live = this.marketStates.get(targetSymbol);
    const curD = live ? live.lastDigit : 0;
    this.statusMessage = `🎯 Entry Point Bot: Target Differ Digit set to [${d}]. Scanning [${target.shortName}] (Live: [${curD}]) ➔ When digit [${d}] appears, immediately buys Differ ≠ ${d}!`;
    this.notifyStatus();
  }

  /**
   * Set target volatility market for Double 1 Select bot (e.g. Volatility 100 Index)
   */
  public selectDouble1SelectMarket(symbol: MarketSymbol) {
    this.config.double1SelectMarketSymbol = symbol;
    this.saveConfig(this.config);
    const target = ASCENDING_VOLATILITY_MARKETS.find((m) => m.symbol === symbol) || ASCENDING_VOLATILITY_MARKETS[0];
    soundManager.playButtonClick();
    this.double1SelectLockedDigit = null;
    this.double1SelectInterveningDigits = [];
    this.double1SelectState = 'HUNTING';
    const range = this.config.double1SelectMaxDigitsRange ?? 6;
    this.statusMessage = `🎯 [Double 1 Select]: Market set to [${target.shortName}]. Scanning for [d, d] twins ➔ lock digit ➔ wait for reappearance within next ${range} digits ➔ Differ ≠ d (1t settle)`;
    this.notifyStatus();
  }

  /**
   * Set max digits range for Double 1 Select bot (default 6)
   */
  public selectDouble1SelectRange(range: number) {
    const r = Math.max(3, Math.min(12, Math.floor(range)));
    this.config.double1SelectMaxDigitsRange = r;
    this.saveConfig(this.config);
    soundManager.playButtonClick();
    this.statusMessage = `🎯 [Double 1 Select]: Digits range limit set to max ${r} digits after twin pattern.`;
    this.notifyStatus();
  }

  /**
   * Set target volatility market for Digit Marker Bot (e.g. Volatility 100 Index)
   */
  public selectDigitMarkerMarket(symbol: MarketSymbol) {
    this.config.digitMarkerMarketSymbol = symbol;
    this.saveConfig(this.config);
    const target = ASCENDING_VOLATILITY_MARKETS.find((m) => m.symbol === symbol) || ASCENDING_VOLATILITY_MARKETS[0];
    soundManager.playButtonClick();
    const live = this.marketStates.get(symbol);
    const curD = live ? live.lastDigit : 0;
    const targetDigit = this.config.digitMarkerTargetDigit !== undefined ? this.config.digitMarkerTargetDigit : 6;
    this.statusMessage = `🎯 [Digit Marker Bot]: Market set to [${target.shortName}]. Scanning for marked digit [${targetDigit}] (Current: [${curD}]) ➔ When digit [${targetDigit}] appears, buys Differ ≠ ${targetDigit} (1-Tick settle)`;
    this.notifyStatus();
  }

  /**
   * Set marked digit to Differ when it appears on the market (0..9, e.g. 6)
   */
  public selectDigitMarkerTargetDigit(digit: number) {
    const d = Math.max(0, Math.min(9, Math.floor(digit)));
    this.config.digitMarkerTargetDigit = d;
    this.saveConfig(this.config);
    soundManager.playButtonClick();
    const targetSymbol = this.config.digitMarkerMarketSymbol || 'R_100';
    const target = ASCENDING_VOLATILITY_MARKETS.find((m) => m.symbol === targetSymbol) || ASCENDING_VOLATILITY_MARKETS[0];
    const live = this.marketStates.get(targetSymbol);
    const curD = live ? live.lastDigit : 0;
    this.statusMessage = `🎯 [Digit Marker Bot]: Marked Differ Digit set to [${d}]. Scanning [${target.shortName}] (Live: [${curD}]) ➔ When digit [${d}] appears, immediately buys Differ ≠ ${d} (1-Tick settle)!`;
    this.notifyStatus();
  }

  /**
   * Set target volatility market for Double End Bot (e.g. Volatility 100 Index)
   */
  public selectDoubleEndMarket(symbol: MarketSymbol) {
    this.config.doubleEndMarketSymbol = symbol;
    this.saveConfig(this.config);
    const target = ASCENDING_VOLATILITY_MARKETS.find((m) => m.symbol === symbol) || ASCENDING_VOLATILITY_MARKETS[0];
    soundManager.playButtonClick();
    const live = this.marketStates.get(symbol);
    const curD = live ? live.lastDigit : 0;
    const mode = this.config.doubleEndPatternMode || 'PAIR_OR_THRICE';
    const modeLabel = mode === 'PAIR_ONLY' ? 'Pair [x, x, y]' : mode === 'THRICE_ONLY' ? 'Thrice [x, x, x, y]' : 'Pair [x, x, y] or Thrice [x, x, x, y]';
    this.statusMessage = `⚡ [Double End Bot]: Target Market set to [${target.shortName}] (Current Digit: [${curD}]). Scanning for ${modeLabel} ➔ Buys Differ ≠ y (1-Tick Settle)`;
    this.notifyStatus();
  }

  /**
   * Set pattern scan mode for Double End Bot
   */
  public selectDoubleEndPatternMode(mode: 'PAIR_OR_THRICE' | 'PAIR_ONLY' | 'THRICE_ONLY') {
    this.config.doubleEndPatternMode = mode;
    this.saveConfig(this.config);
    soundManager.playButtonClick();
    const modeLabel = mode === 'PAIR_ONLY' ? 'Pair Only [x, x, y]' : mode === 'THRICE_ONLY' ? 'Thrice Only [x, x, x, y]' : 'Pair or Thrice [x, x, y] / [x, x, x, y]';
    this.statusMessage = `⚡ [Double End Bot]: Pattern mode set to [${modeLabel}].`;
    this.notifyStatus();
  }

  /**
   * Directly choose and lock the bot to trade on a single specific market volatility
   */
  public selectSpecificMarket(symbol: MarketSymbol) {
    this.config.marketScope = 'SINGLE_SPECIFIC';
    this.config.specificMarketSymbol = symbol;
    this.activeMarketIndex = 0;
    this.tradedMarketsInCycle.clear();
    this.saveConfig(this.config);
    const target = ASCENDING_VOLATILITY_MARKETS.find((m) => m.symbol === symbol) || ASCENDING_VOLATILITY_MARKETS[0];
    soundManager.playButtonClick();
    if (this.isRunning) {
      const dur = this.config.durationTicks || 2;
      this.statusMessage = `🎯 Sniper Locked on [${target.shortName}] (≠Differ ${dur}t settle) ➔ Scanning for Double Identical twin digits...`;
      this.notifyStatus();
      if (this.config.strategyMode === 'DOUBLE_IDENTICAL_2TICK') {
        const targetState = this.marketStates.get(symbol);
        if (targetState?.hasTwinDigit && targetState.twinDigit !== null) {
          this.handleDoubleIdenticalDetected(target, targetState.twinDigit, targetState.price);
        }
      }
    } else {
      this.statusMessage = `🎯 Target market locked to [${target.shortName}]. Ready to run.`;
      this.notifyStatus();
    }
  }

  /**
   * Toggle a market inclusion in custom multi-select mode
   */
  public toggleCustomMarketSymbol(symbol: MarketSymbol) {
    const current = this.config.selectedSymbols && this.config.selectedSymbols.length > 0
      ? this.config.selectedSymbols
      : ASCENDING_VOLATILITY_MARKETS.map((m) => m.symbol);
    let next: MarketSymbol[];
    if (current.includes(symbol)) {
      if (current.length === 1) {
        return; // Don't allow empty list
      }
      next = current.filter((s) => s !== symbol);
    } else {
      next = [...current, symbol];
    }
    this.config.marketScope = 'CUSTOM_SELECTED';
    this.config.selectedSymbols = next;
    this.activeMarketIndex = 0;
    this.tradedMarketsInCycle.clear();
    this.saveConfig(this.config);
    soundManager.playButtonClick();
    this.notifyStatus();
  }

  private loadSavedConfig() {
    try {
      const saved = localStorage.getItem('system_auto_terminal_config');
      if (saved) {
        const parsed = JSON.parse(saved);
        this.config = { ...this.config, ...parsed };
        if (this.config.strategyMode === 'DOUBLE_IDENTICAL_2TICK' && (!parsed.durationTicks || parsed.durationTicks === 2)) {
          this.config.durationTicks = 1;
        }
        if (parsed.singleTradeSequentialMode === undefined) {
          this.config.singleTradeSequentialMode = true;
        }
        if (parsed.postTradeScanDelaySec === undefined) {
          this.config.postTradeScanDelaySec = 1;
        }
        if (parsed.requireFreshPatternAfterClose === undefined) {
          this.config.requireFreshPatternAfterClose = true;
        }
        if (parsed.virtualLossFilterEnabled !== undefined) {
          this.config.virtualLossFilterEnabled = Boolean(parsed.virtualLossFilterEnabled);
        }
        if (parsed.virtualDemoStake !== undefined) {
          this.config.virtualDemoStake = Number(parsed.virtualDemoStake) || 1.00;
        }
        if (parsed.digitSelectTargetDigit !== undefined) {
          this.config.digitSelectTargetDigit = Number(parsed.digitSelectTargetDigit);
        }
        if (parsed.digitSelectVolatilitySymbol !== undefined) {
          this.config.digitSelectVolatilitySymbol = parsed.digitSelectVolatilitySymbol;
        }
        if (parsed.masterDouble2SelectedPatterns !== undefined && Array.isArray(parsed.masterDouble2SelectedPatterns)) {
          this.config.masterDouble2SelectedPatterns = parsed.masterDouble2SelectedPatterns;
        }
        if (parsed.lastDigitDifferMarketSymbol !== undefined) {
          this.config.lastDigitDifferMarketSymbol = parsed.lastDigitDifferMarketSymbol;
        }
        if (parsed.entryPointMarketSymbol !== undefined) {
          this.config.entryPointMarketSymbol = parsed.entryPointMarketSymbol;
        }
        if (parsed.entryPointTargetDigit !== undefined) {
          this.config.entryPointTargetDigit = Number(parsed.entryPointTargetDigit);
        }
        if (parsed.digitMarkerMarketSymbol !== undefined) {
          this.config.digitMarkerMarketSymbol = parsed.digitMarkerMarketSymbol;
        }
        if (parsed.digitMarkerTargetDigit !== undefined) {
          this.config.digitMarkerTargetDigit = Number(parsed.digitMarkerTargetDigit);
        }
        if (parsed.combinerStage1Market !== undefined) this.config.combinerStage1Market = parsed.combinerStage1Market;
        if (parsed.combinerStage2Market !== undefined) this.config.combinerStage2Market = parsed.combinerStage2Market;
        if (parsed.combinerStage3Market !== undefined) this.config.combinerStage3Market = parsed.combinerStage3Market;
        if (parsed.combinerStage4Market !== undefined) this.config.combinerStage4Market = parsed.combinerStage4Market;
        if (parsed.combinerExecutionMode !== undefined) this.config.combinerExecutionMode = parsed.combinerExecutionMode;
        if (parsed.combinerAdvanceOn !== undefined) this.config.combinerAdvanceOn = parsed.combinerAdvanceOn;
        if (parsed.combinerStage3MaxWaitTicks !== undefined) this.config.combinerStage3MaxWaitTicks = Number(parsed.combinerStage3MaxWaitTicks);
        this.currentStake = this.config.baseStake;
      }
    } catch {
      // fallback
    }
  }

  public saveConfig(newConfig: Partial<SystemAutoConfig>) {
    const prevScope = this.config.marketScope;
    const prevTarget = this.config.specificMarketSymbol;
    const prevStrategy = this.config.strategyMode;
    this.config = { ...this.config, ...newConfig };
    try {
      localStorage.setItem('system_auto_terminal_config', JSON.stringify(this.config));
    } catch {
      // fallback
    }

    // Set intelligent defaults if switching strategies
    if (newConfig.strategyMode && newConfig.strategyMode !== prevStrategy) {
      if (newConfig.strategyMode === 'COMBINER_BOT') {
        if (newConfig.durationTicks === undefined) this.config.durationTicks = 1;
        if (!this.config.combinerStage1Market) this.config.combinerStage1Market = 'R_10';
        if (!this.config.combinerStage2Market) this.config.combinerStage2Market = 'R_25';
        if (!this.config.combinerStage3Market) this.config.combinerStage3Market = 'R_50';
        if (!this.config.combinerStage4Market) this.config.combinerStage4Market = 'R_100';
        if (this.config.combinerExecutionMode === undefined) this.config.combinerExecutionMode = 'ASCENDING_SEQUENTIAL';
        if (this.config.combinerAdvanceOn === undefined) this.config.combinerAdvanceOn = 'ALWAYS';
        if (this.config.combinerStage3MaxWaitTicks === undefined) this.config.combinerStage3MaxWaitTicks = 20;
      } else if (newConfig.strategyMode === 'LAST_DIGIT_DIFFER') {
        if (newConfig.durationTicks === undefined) this.config.durationTicks = 1;
        if (!this.config.lastDigitDifferMarketSymbol) this.config.lastDigitDifferMarketSymbol = 'R_25';
      } else if (newConfig.strategyMode === 'ENTRY_POINT_DIFFER') {
        if (newConfig.durationTicks === undefined) this.config.durationTicks = 1;
        if (this.config.entryPointTargetDigit === undefined) this.config.entryPointTargetDigit = 5;
        if (!this.config.entryPointMarketSymbol) this.config.entryPointMarketSymbol = 'R_100';
      } else if (newConfig.strategyMode === 'DOUBLE_1_SELECT') {
        if (newConfig.durationTicks === undefined) this.config.durationTicks = 1;
        if (!this.config.double1SelectMarketSymbol) this.config.double1SelectMarketSymbol = 'R_100';
        if (this.config.double1SelectMaxDigitsRange === undefined) this.config.double1SelectMaxDigitsRange = 6;
      } else if (newConfig.strategyMode === 'DIGIT_MARKER_DIFFER') {
        if (newConfig.durationTicks === undefined) this.config.durationTicks = 1;
        if (this.config.digitMarkerTargetDigit === undefined) this.config.digitMarkerTargetDigit = 6;
        if (!this.config.digitMarkerMarketSymbol) this.config.digitMarkerMarketSymbol = 'R_100';
      } else if (newConfig.strategyMode === 'DIGIT_SELECT_DIFFER') {
        if (newConfig.durationTicks === undefined) this.config.durationTicks = 1;
        if (this.config.digitSelectTargetDigit === undefined) this.config.digitSelectTargetDigit = 5;
        if (!this.config.digitSelectVolatilitySymbol) this.config.digitSelectVolatilitySymbol = 'R_100';
      } else if (newConfig.strategyMode === 'TWIN_0_AND_9_DIFFER') {
        if (newConfig.durationTicks === undefined) this.config.durationTicks = 1;
      } else if (newConfig.strategyMode === 'DOUBLE_BOT_1TICK') {
        if (newConfig.durationTicks === undefined) this.config.durationTicks = 1;
      } else if (newConfig.strategyMode === 'ALTERNATING_DIGITS') {
        if (newConfig.durationTicks === undefined) this.config.durationTicks = 1;
        if (this.config.alternatingTargetDigit === undefined) this.config.alternatingTargetDigit = 5;
        if (this.config.alternatingCooldownSec === undefined) this.config.alternatingCooldownSec = 5;
      } else if (newConfig.strategyMode === 'DOUBLE_IDENTICAL_2TICK') {
        if (newConfig.durationTicks === undefined) this.config.durationTicks = 1;
      } else if (newConfig.strategyMode === 'ASCENDING_SEQUENTIAL_1TICK') {
        if (newConfig.durationTicks === undefined) this.config.durationTicks = 1;
      } else if (newConfig.strategyMode === 'RANGE_LONG_DIFFERS') {
        if (newConfig.durationTicks === undefined) this.config.durationTicks = 1;
        if (!this.config.rangeLongDiffersMarketSymbol) this.config.rangeLongDiffersMarketSymbol = 'R_100';
        this.rangeLongWindowDigits = [];
      }
    }

    // Reset cycle and market index if market scope or specific market changes
    if (newConfig.marketScope !== undefined && newConfig.marketScope !== prevScope) {
      this.activeMarketIndex = 0;
      this.tradedMarketsInCycle.clear();
    }
    if (newConfig.specificMarketSymbol !== undefined && newConfig.specificMarketSymbol !== prevTarget) {
      this.activeMarketIndex = 0;
      this.tradedMarketsInCycle.clear();
    }
    if (this.config.marketScope === 'SINGLE_SPECIFIC') {
      this.activeMarketIndex = 0;
    }

    if (!this.isRunning) {
      this.currentStake = this.config.baseStake;
      const pool = this.getMarketPool();
      const currentTarget = pool[this.activeMarketIndex % (pool.length || 1)] || pool[0];
      const dur = this.config.durationTicks || 1;
      if (this.config.strategyMode === 'COMBINER_BOT') {
        const m1 = ASCENDING_VOLATILITY_MARKETS.find((m) => m.symbol === (this.config.combinerStage1Market || 'R_10'))?.shortName || 'Vol 10';
        const m2 = ASCENDING_VOLATILITY_MARKETS.find((m) => m.symbol === (this.config.combinerStage2Market || 'R_25'))?.shortName || 'Vol 25';
        const m3 = ASCENDING_VOLATILITY_MARKETS.find((m) => m.symbol === (this.config.combinerStage3Market || 'R_50'))?.shortName || 'Vol 50';
        const m4 = ASCENDING_VOLATILITY_MARKETS.find((m) => m.symbol === (this.config.combinerStage4Market || 'R_100'))?.shortName || 'Vol 100';
        this.statusMessage = `🧩 [Combiner Bot Ready] Ascending Ladder: Stage 1 [${m1}: x,x,y➔≠y] ➔ Stage 2 [${m2}: x,y,x,x➔≠x] ➔ Stage 3 [${m3}: Lock [x,x]➔≠x] ➔ Stage 4 [${m4}: Differ Last Digit]. Click RUN to start.`;
      } else if (this.config.strategyMode === 'LAST_DIGIT_DIFFER') {
        const targetSymbol = this.config.lastDigitDifferMarketSymbol || 'R_25';
        const targetMarket = ASCENDING_VOLATILITY_MARKETS.find((m) => m.symbol === targetSymbol) || ASCENDING_VOLATILITY_MARKETS.find(m => m.symbol === 'R_25') || ASCENDING_VOLATILITY_MARKETS[0];
        const live = this.marketStates.get(targetSymbol);
        const curD = live ? live.lastDigit : 0;
        this.statusMessage = `🎯 Last Digit Differ ready: [${targetMarket.shortName}] immediate last digit is [${curD}]. Click RUN to trade Differ ≠ ${curD} (1-Tick Settle).`;
      } else if (this.config.strategyMode === 'ENTRY_POINT_DIFFER') {
        const targetDigit = this.config.entryPointTargetDigit !== undefined ? this.config.entryPointTargetDigit : 5;
        const targetSymbol = this.config.entryPointMarketSymbol || 'R_100';
        const targetMarket = ASCENDING_VOLATILITY_MARKETS.find((m) => m.symbol === targetSymbol) || ASCENDING_VOLATILITY_MARKETS[0];
        const live = this.marketStates.get(targetSymbol);
        const curD = live ? live.lastDigit : 0;
        this.statusMessage = `🎯 Entry Point Bot ready: Scanning [${targetMarket.shortName}] for digit [${targetDigit}] (Current: [${curD}]). Once [${targetDigit}] appears, bot buys Differ ≠ ${targetDigit} (1-Tick close). Click RUN to start.`;
      } else if (this.config.strategyMode === 'DOUBLE_1_SELECT') {
        const targetSymbol = this.config.double1SelectMarketSymbol || 'R_100';
        const targetMarket = ASCENDING_VOLATILITY_MARKETS.find((m) => m.symbol === targetSymbol) || ASCENDING_VOLATILITY_MARKETS[0];
        const range = this.config.double1SelectMaxDigitsRange ?? 6;
        this.statusMessage = `🎯 [Double 1 Select] ready on [${targetMarket.shortName}]: Scans for [d, d] twins ➔ locks digit ➔ waits for reappearance within next ${range} digits ➔ buys Differ ≠ d (1-Tick close). Click RUN to start.`;
      } else if (this.config.strategyMode === 'DIGIT_MARKER_DIFFER') {
        const targetDigit = this.config.digitMarkerTargetDigit !== undefined ? this.config.digitMarkerTargetDigit : 6;
        const targetSymbol = this.config.digitMarkerMarketSymbol || 'R_100';
        const targetMarket = ASCENDING_VOLATILITY_MARKETS.find((m) => m.symbol === targetSymbol) || ASCENDING_VOLATILITY_MARKETS[0];
        const live = this.marketStates.get(targetSymbol);
        const curD = live ? live.lastDigit : 0;
        this.statusMessage = `🎯 [Digit Marker Bot] ready: Scanning [${targetMarket.shortName}] for marked digit [${targetDigit}] (Current: [${curD}]). The moment [${targetDigit}] appears, bot buys Differ ≠ ${targetDigit} (1-Tick close). Click RUN to start.`;
      } else if (this.config.strategyMode === 'DIGIT_SELECT_DIFFER') {
        const targetDigit = this.config.digitSelectTargetDigit ?? 5;
        const targetSymbol = this.config.digitSelectVolatilitySymbol || 'R_100';
        const targetMarket = ASCENDING_VOLATILITY_MARKETS.find((m) => m.symbol === targetSymbol) || ASCENDING_VOLATILITY_MARKETS[0];
        this.statusMessage = `🎯 Digit Select Differ ready: Differ ≠ ${targetDigit} on [${targetMarket.shortName}]. Click RUN to execute immediately.`;
      } else if (this.config.strategyMode === 'RANGE_LONG_DIFFERS') {
        const targetSymbol = this.config.rangeLongDiffersMarketSymbol || 'R_100';
        const targetMarket = ASCENDING_VOLATILITY_MARKETS.find((m) => m.symbol === targetSymbol) || ASCENDING_VOLATILITY_MARKETS[0];
        this.statusMessage = `📊 [Range Long Differs] ready on [${targetMarket.shortName}]: Collects 7 live digits generated ➔ identifies most appearing digit ➔ on 7th digit buys Differ ≠ that digit ➔ settles on 8th digit (1t). Click RUN to start.`;
      } else if (this.config.strategyMode === 'TWIN_0_AND_9_DIFFER') {
        this.statusMessage = `⚡ Twin 0 & 9 Differ Scanner ready on ${pool.length} markets ([0,0] ➔ Differ ≠ 0 | [9,9] ➔ Differ ≠ 9, ${dur}t settle).`;
      } else if (this.config.strategyMode === 'DOUBLE_BOT_1TICK') {
        this.statusMessage = `⚡ Double Bot configured ([x, x, y] ➔ Differ ≠ y, e.g. 3,3,4 ➔ ≠4 | 5,5,6 ➔ ≠6, ${dur}t settle). Ready to run.`;
      } else if (this.config.strategyMode === 'ALTERNATING_DIGITS') {
        const targetDigit = this.config.alternatingTargetDigit ?? 5;
        this.statusMessage = `⚡ Alternating Digits Bot configured (Target Differ ≠ ${targetDigit}, ${dur}t, 5s Cooldown). Ready to run.`;
      } else if (this.config.marketScope === 'SINGLE_SPECIFIC') {
        this.statusMessage = `🎯 Target market locked to [${currentTarget.shortName}]. Differ duration: ${dur}t (${dur === 1 ? 'Instant' : 'Standard'}). Ready to run.`;
      } else {
        this.statusMessage = `⚡ ${this.config.strategyMode === 'DOUBLE_IDENTICAL_2TICK' ? 'Double Identical 1-Tick Instant Differ Sniper' : 'Ascending Sequential Ladder'} ready on ${pool.length} markets.`;
      }
    } else {
      const pool = this.getMarketPool();
      const currentTarget = pool[this.activeMarketIndex % (pool.length || 1)] || pool[0];
      const dur = this.config.durationTicks || 1;
      if (this.config.strategyMode === 'COMBINER_BOT') {
        const curStage = this.combinerCurrentStage || 1;
        const curSym = this.getCombinerMarketForStage(curStage);
        const curMarket = ASCENDING_VOLATILITY_MARKETS.find((m) => m.symbol === curSym) || ASCENDING_VOLATILITY_MARKETS[0];
        const stageNames = [
          'Stage 1: Scanning for [x, x, y] ➔ Differ ≠ y',
          'Stage 2: Scanning for [x, y, x, x] ➔ Differ ≠ x',
          'Stage 3: Hunting double [x, x] ➔ Lock ➔ Reappearance Differ ≠ x',
          'Stage 4: Differ Last Digit',
        ];
        this.statusMessage = `🧩 Combiner Bot Active on ${stageNames[curStage - 1]} on [${curMarket.shortName}] (1-Tick Settle)...`;
      } else if (this.config.strategyMode === 'LAST_DIGIT_DIFFER') {
        const targetSymbol = this.config.lastDigitDifferMarketSymbol || 'R_25';
        const targetMarket = ASCENDING_VOLATILITY_MARKETS.find((m) => m.symbol === targetSymbol) || ASCENDING_VOLATILITY_MARKETS.find(m => m.symbol === 'R_25') || ASCENDING_VOLATILITY_MARKETS[0];
        this.statusMessage = `🎯 Last Digit Differ Active: Executing Differ of immediate last digit on [${targetMarket.shortName}] (1-Tick Settle)...`;
      } else if (this.config.strategyMode === 'ENTRY_POINT_DIFFER') {
        const targetDigit = this.config.entryPointTargetDigit !== undefined ? this.config.entryPointTargetDigit : 5;
        const targetSymbol = this.config.entryPointMarketSymbol || 'R_100';
        const targetMarket = ASCENDING_VOLATILITY_MARKETS.find((m) => m.symbol === targetSymbol) || ASCENDING_VOLATILITY_MARKETS[0];
        const live = this.marketStates.get(targetSymbol);
        const curD = live ? live.lastDigit : 0;
        this.statusMessage = `🎯 Entry Point Bot Active: Scanning [${targetMarket.shortName}] for digit [${targetDigit}] (Live digit: [${curD}])...`;
      } else if (this.config.strategyMode === 'DOUBLE_1_SELECT') {
        const targetSymbol = this.config.double1SelectMarketSymbol || 'R_100';
        const targetMarket = ASCENDING_VOLATILITY_MARKETS.find((m) => m.symbol === targetSymbol) || ASCENDING_VOLATILITY_MARKETS[0];
        const range = this.config.double1SelectMaxDigitsRange ?? 6;
        this.statusMessage = `🎯 [Double 1 Select] Active on [${targetMarket.shortName}]: Scanning for identical digits [d, d] ➔ lock digit ➔ wait within ${range} digits ➔ Differ ≠ d (1t settle)...`;
      } else if (this.config.strategyMode === 'DIGIT_MARKER_DIFFER') {
        const targetDigit = this.config.digitMarkerTargetDigit !== undefined ? this.config.digitMarkerTargetDigit : 6;
        const targetSymbol = this.config.digitMarkerMarketSymbol || 'R_100';
        const targetMarket = ASCENDING_VOLATILITY_MARKETS.find((m) => m.symbol === targetSymbol) || ASCENDING_VOLATILITY_MARKETS[0];
        const live = this.marketStates.get(targetSymbol);
        const curD = live ? live.lastDigit : 0;
        this.statusMessage = `🎯 [Digit Marker Bot] Active: Scanning [${targetMarket.shortName}] for marked digit [${targetDigit}] (Current: [${curD}])...`;
      } else if (this.config.strategyMode === 'DIGIT_SELECT_DIFFER') {
        const targetDigit = this.config.digitSelectTargetDigit ?? 5;
        const targetSymbol = this.config.digitSelectVolatilitySymbol || 'R_100';
        const targetMarket = ASCENDING_VOLATILITY_MARKETS.find((m) => m.symbol === targetSymbol) || ASCENDING_VOLATILITY_MARKETS[0];
        this.statusMessage = `🎯 Digit Select Differ Active: Executing immediate Differ ≠ ${targetDigit} on [${targetMarket.shortName}] (1-Tick Settle)...`;
      } else if (this.config.strategyMode === 'RANGE_LONG_DIFFERS') {
        const targetSymbol = this.config.rangeLongDiffersMarketSymbol || 'R_100';
        const targetMarket = ASCENDING_VOLATILITY_MARKETS.find((m) => m.symbol === targetSymbol) || ASCENDING_VOLATILITY_MARKETS[0];
        this.statusMessage = `📊 [Range Long Differs] Active on [${targetMarket.shortName}]: Collecting 7 live digits (${this.rangeLongWindowDigits.length}/7)...`;
      } else if (this.config.strategyMode === 'TWIN_0_AND_9_DIFFER') {
        this.statusMessage = `⚡ Twin 0 & 9 Differ Scanner Active ➔ Scanning all ${pool.length} markets simultaneously for [0,0] or [9,9] (${dur}t)...`;
      } else if (this.config.strategyMode === 'DOUBLE_BOT_1TICK') {
        this.statusMessage = `⚡ Double Bot Active ➔ Scanning all ${pool.length} markets for [x, x, y] ➔ Differ ≠ y (e.g. 3,3,4 ➔ ≠4 | 5,5,6 ➔ ≠6, ${dur}t)...`;
      } else if (this.config.strategyMode === 'ALTERNATING_DIGITS') {
        const targetDigit = this.config.alternatingTargetDigit ?? 5;
        this.statusMessage = `⚡ Alternating Digits Bot Active ➔ Scanning for Alternating Odd/Even pattern (Target Differ ≠ ${targetDigit}, ${dur}t)...`;
      } else if (this.config.marketScope === 'SINGLE_SPECIFIC') {
        this.statusMessage = `🎯 Sniper Locked on [${currentTarget.shortName}]! Scanning for Double Identical twin digits (≠Differ ${dur}t settle)...`;
      }
    }

    try {
      localStorage.setItem('system_auto_terminal_config', JSON.stringify(this.config));
    } catch {
      // fallback
    }
    this.notifyConfig();
    this.notifyStatus();
  }

  public getConfig(): SystemAutoConfig {
    return { ...this.config };
  }

  private initLiveSubscriptions() {
    ASCENDING_VOLATILITY_MARKETS.forEach((market) => {
      // Initialize default state
      this.marketStates.set(market.symbol, {
        symbol: market.symbol,
        price: 0,
        displayPrice: '---',
        lastDigit: Math.floor(Math.random() * 10),
        lastTickTime: Date.now(),
        recentDigits: [],
        hasTwinDigit: false,
        twinDigit: null,
        lastTwinTime: null,
        twinOccurrencesCount: 0,
      });

      // Subscribe live ticks
      derivWS.subscribeTicks(market.symbol, (tick: Tick) => {
        const pipSize = tick.pipSize ?? market.pipSize ?? 2;
        const lastDigit = extractDerivLastDigit(tick.quote, pipSize, tick.symbol);
        const displayPrice = formatDerivQuote(tick.quote, pipSize);

        const current = this.marketStates.get(market.symbol);
        const prevDigits = current ? current.recentDigits : [];
        const recent = [...prevDigits.slice(-39), lastDigit];

        // Check if the last two digits are identical (Double Identical Digit Trigger e.g. [3, 3])
        const len = recent.length;
        const isTwin = len >= 2 && recent[len - 1] === recent[len - 2] && Number.isInteger(lastDigit) && lastDigit >= 0 && lastDigit <= 9;
        const twinDigit = isTwin ? lastDigit : null;
        const isTwin09 = isTwin && (lastDigit === 0 || lastDigit === 9);
        const twin09Digit = isTwin09 ? lastDigit : null;
        const twinTime = isTwin ? Date.now() : current?.lastTwinTime ?? null;
        const prevTwinCount = current?.twinOccurrencesCount || 0;
        const twinOccurrencesCount = isTwin && (!current?.hasTwinDigit || current.lastDigit !== lastDigit) ? prevTwinCount + 1 : prevTwinCount;

        // Check Alternating Odd/Even Pattern (Length 3, consecutive digits different)
        let hasAlternating = false;
        let alternatingPatternText = '';
        let alternatingDigits: number[] = [];
        if (len >= 3) {
          const d3 = recent[len - 3];
          const d2 = recent[len - 2];
          const d1 = recent[len - 1];
          const isOdd = (n: number) => n % 2 !== 0;
          const o3 = isOdd(d3);
          const o2 = isOdd(d2);
          const o1 = isOdd(d1);
          // Condition 1: Consecutive digits are different
          // Condition 2: Alternating Odd/Even pattern (Length 3)
          if (d3 !== d2 && d2 !== d1 && o3 !== o2 && o2 !== o1) {
            hasAlternating = true;
            alternatingPatternText = `${o3 ? 'Odd' : 'Even'}-${o2 ? 'Odd' : 'Even'}-${o1 ? 'Odd' : 'Even'}`;
            alternatingDigits = [d3, d2, d1];
          }
        }

        // Check Double Bot Pattern: [x, x, y] where d3 === d2 and d1 !== d2
        // e.g. [3, 3, 4] ➔ Differ ≠ 4 | [5, 5, 6] ➔ Differ ≠ 6
        let hasDoubleBot = false;
        let doubleBotTargetDigit: number | null = null;
        let doubleBotDigits: number[] = [];
        let doubleBotPatternStr = '';
        if (len >= 3) {
          const d3 = recent[len - 3];
          const d2 = recent[len - 2];
          const d1 = recent[len - 1];
          if (d3 === d2 && d1 !== d2) {
            hasDoubleBot = true;
            doubleBotTargetDigit = d1;
            doubleBotDigits = [d3, d2, d1];
            doubleBotPatternStr = `[${d3}, ${d2}, ${d1}] ➔ Differ ≠ ${d1}`;
          }
        }

        // Check Master Double Pattern: [d, d] where twin digit d is in {0, 1, 2, 3, 4, 5, 6, 7, 8}
        // User rule:
        // 0,0 ➔ Differ ≠ 1 (next digit after double 0 should not be 1)
        // 1,1 ➔ Differ ≠ 2
        // 2,2 ➔ Differ ≠ 3
        // 3,3 ➔ Differ ≠ 4
        // 4,4 ➔ Differ ≠ 5
        // 5,5 ➔ Differ ≠ 6
        // 6,6 ➔ Differ ≠ 7
        // 7,7 ➔ Differ ≠ 8
        // 8,8 ➔ Differ ≠ 9
        // Trade strictly using those patterns and digits only!
        let hasMasterDouble = false;
        let masterDoubleTwinDigit: number | null = null;
        let masterDoubleTargetDigit: number | null = null;
        let masterDoublePatternStr = '';
        if (isTwin && twinDigit !== null && twinDigit >= 0 && twinDigit <= 8) {
          hasMasterDouble = true;
          masterDoubleTwinDigit = twinDigit;
          masterDoubleTargetDigit = twinDigit + 1;
          masterDoublePatternStr = `[${twinDigit}, ${twinDigit}] ➔ Differ ≠ ${masterDoubleTargetDigit}`;
        }

        // Check Double End Bot Pattern:
        // "after a pair or thrice digits appears the next different digit is bought as a differ"
        // e.g. 5, 5, 7 ➔ Differ ≠ 7
        // e.g. 9, 9, 4 ➔ Differ ≠ 4
        // e.g. 5, 5, 5, 7 ➔ Differ ≠ 7
        let hasDoubleEnd = false;
        let doubleEndType: 'PAIR' | 'THRICE' | null = null;
        let doubleEndBaseDigit: number | null = null;
        let doubleEndDifferTarget: number | null = null;
        let doubleEndPatternStr = '';
        let doubleEndDigits: number[] = [];

        if (len >= 4) {
          const d4 = recent[len - 4];
          const d3 = recent[len - 3];
          const d2 = recent[len - 2];
          const d1 = recent[len - 1];
          if (d4 === d3 && d3 === d2 && d1 !== d2) {
            hasDoubleEnd = true;
            doubleEndType = 'THRICE';
            doubleEndBaseDigit = d2;
            doubleEndDifferTarget = d1;
            doubleEndDigits = [d4, d3, d2, d1];
            doubleEndPatternStr = `Thrice [${d2}, ${d2}, ${d2}] ➔ Differ ≠ ${d1}`;
          } else if (d3 === d2 && d1 !== d2) {
            hasDoubleEnd = true;
            doubleEndType = 'PAIR';
            doubleEndBaseDigit = d2;
            doubleEndDifferTarget = d1;
            doubleEndDigits = [d3, d2, d1];
            doubleEndPatternStr = `Pair [${d2}, ${d2}] ➔ Differ ≠ ${d1}`;
          }
        } else if (len >= 3) {
          const d3 = recent[len - 3];
          const d2 = recent[len - 2];
          const d1 = recent[len - 1];
          if (d3 === d2 && d1 !== d2) {
            hasDoubleEnd = true;
            doubleEndType = 'PAIR';
            doubleEndBaseDigit = d2;
            doubleEndDifferTarget = d1;
            doubleEndDigits = [d3, d2, d1];
            doubleEndPatternStr = `Pair [${d2}, ${d2}] ➔ Differ ≠ ${d1}`;
          }
        }

        this.marketStates.set(market.symbol, {
          symbol: market.symbol,
          price: tick.quote,
          displayPrice,
          lastDigit,
          lastTickTime: Date.now(),
          recentDigits: recent,
          hasTwinDigit: isTwin,
          twinDigit,
          hasTwin0or9: isTwin09,
          twin0or9Digit: twin09Digit,
          lastTwinTime: twinTime,
          twinOccurrencesCount,
          hasAlternatingPattern: hasAlternating,
          alternatingPatternText,
          alternatingDigits,
          hasDoubleBotPattern: hasDoubleBot,
          doubleBotTargetDigit,
          doubleBotDigits,
          doubleBotPatternStr,
          hasMasterDoublePattern: hasMasterDouble,
          masterDoubleTwinDigit,
          masterDoubleTargetDigit,
          masterDoublePatternStr,
          hasDoubleEndPattern: hasDoubleEnd,
          doubleEndType,
          doubleEndBaseDigit,
          doubleEndDifferTarget,
          doubleEndPatternStr,
          doubleEndDigits,
        });

        this.notifyMarketStates();

        // 🎯 LIVE SCANNER CHECK: Evaluates real-time triggers across markets
        // In 1-Trade Sequential Mode, strictly requires scanPhase === 'SCANNING'
        if (
          this.isRunning &&
          !this.isProcessingTrade &&
          !this.isSettling &&
          this.activeContractId === null &&
          (this.scanPhase === 'SCANNING' || !this.config.singleTradeSequentialMode)
        ) {
          if (this.config.strategyMode === 'COMBINER_BOT') {
            this.evaluateCombinerScan(market, lastDigit, tick.quote);
          } else if (this.config.strategyMode === 'LAST_DIGIT_DIFFER') {
            const chosenSym = this.config.lastDigitDifferMarketSymbol || 'R_25';
            if (market.symbol === chosenSym) {
              this.executeLastDigitDifferTrade();
            }
          } else if (this.config.strategyMode === 'ENTRY_POINT_DIFFER') {
            const chosenSym = this.config.entryPointMarketSymbol || 'R_100';
            if (market.symbol === chosenSym) {
              const targetDigit = this.config.entryPointTargetDigit !== undefined ? this.config.entryPointTargetDigit : 5;
              if (lastDigit === targetDigit) {
                this.executeEntryPointDifferTrade(market, lastDigit);
              }
            }
          } else if (this.config.strategyMode === 'DOUBLE_1_SELECT') {
            const chosenSym = this.config.double1SelectMarketSymbol || 'R_100';
            if (market.symbol === chosenSym) {
              this.evaluateDouble1SelectScan(market, lastDigit, tick.quote);
            }
          } else if (this.config.strategyMode === 'DIGIT_MARKER_DIFFER') {
            const chosenSym = this.config.digitMarkerMarketSymbol || 'R_100';
            if (market.symbol === chosenSym) {
              const targetDigit = this.config.digitMarkerTargetDigit !== undefined ? this.config.digitMarkerTargetDigit : 6;
              if (lastDigit === targetDigit) {
                this.executeDigitMarkerDifferTrade(market, lastDigit);
              }
            }
          } else if (this.config.strategyMode === 'RANGE_LONG_DIFFERS') {
            const chosenSym = this.config.rangeLongDiffersMarketSymbol || 'R_100';
            if (market.symbol === chosenSym) {
              this.evaluateRangeLongDiffersTick(market, lastDigit, tick.quote);
            }
          } else if (this.config.strategyMode === 'DIGIT_SELECT_DIFFER') {
            const chosenSym = this.config.digitSelectVolatilitySymbol || 'R_100';
            if (market.symbol === chosenSym) {
              this.executeDigitSelectDifferTrade();
            }
          } else if (this.config.strategyMode === 'MASTER_DOUBLE') {
            this.evaluateMasterDoubleScan(market, hasMasterDouble, masterDoubleTwinDigit, masterDoubleTargetDigit, tick.quote);
          } else if (this.config.strategyMode === 'MASTER_DOUBLE_2') {
            this.evaluateMasterDouble2Scan(market, hasMasterDouble, masterDoubleTwinDigit, masterDoubleTargetDigit, tick.quote);
          } else if (this.config.strategyMode === 'TWIN_0_AND_9_DIFFER') {
            this.evaluateTwin0And9Scan(market, isTwin09, twin09Digit, tick.quote);
          } else if (this.config.strategyMode === 'DOUBLE_BOT_1TICK') {
            this.evaluateDoubleBotScan(market, hasDoubleBot, doubleBotTargetDigit, doubleBotDigits, tick.quote);
          } else if (this.config.strategyMode === 'DOUBLE_END_BOT') {
            const chosenSym = this.config.doubleEndMarketSymbol || 'R_100';
            if (market.symbol === chosenSym) {
              this.evaluateDoubleEndScan(market, hasDoubleEnd, doubleEndType, doubleEndBaseDigit, doubleEndDifferTarget, doubleEndDigits, tick.quote);
            }
          } else if (this.config.strategyMode === 'FAST_LAST_DIFFER') {
            this.evaluateFastLastDifferScan(market, lastDigit, tick.quote);
          } else if (this.config.strategyMode === 'DOUBLE_IDENTICAL_2TICK') {
            this.evaluateSimultaneousMarketScan(market, isTwin, twinDigit, tick.quote);
          } else if (this.config.strategyMode === 'ALTERNATING_DIGITS') {
            this.evaluateAlternatingDigitsScan(market, recent, tick.quote);
          }
        }
      });
    });

    // Listen for auth/balance changes from Deriv WebSocket server
    derivWS.subscribeAuth((auth) => {
      if (auth.balance !== undefined && Number.isFinite(auth.balance) && auth.balance > 0) {
        this.currentBalanceUsd = auth.balance;
      }
    });

    // Listen for contract completion
    derivWS.subscribeContracts((contract: ActiveContract) => {
      const isTracked = this.trackedContractIds.has(contract.id) || contract.id === this.activeContractId;
      const isOpenInHistory = this.tradeHistory.some((t) => t.id === contract.id && t.result === 'OPEN');

      if (isTracked || isOpenInHistory) {
        // Collect tick progression if available
        if (contract.historySpots && contract.historySpots.length > 0) {
          const pipSize = ASCENDING_VOLATILITY_MARKETS.find((m) => m.symbol === contract.symbol)?.pipSize ?? 2;
          this.activeContractTicks = contract.historySpots.map((spot, idx) => ({
            tickNum: idx + 1,
            spot,
            digit: extractDerivLastDigit(spot, pipSize, contract.symbol),
            epoch: Date.now(),
            isExit: idx === contract.historySpots.length - 1,
          }));
          this.notifyStatus();
        }

        if (contract.status !== 'OPEN') {
          this.handleContractSettled(contract);
        }
      }
    });

    // Connect into Strategy Shield global zero-trace purge listener
    strategyShield.onPurgeHistory(() => {
      this.purgeAllTradeHistory();
    });
  }

  /**
   * Purges all trade history, logs, and strategy footprint from the engine.
   * Ensures zero local storage / memory tracking footprint.
   */
  public purgeAllTradeHistory() {
    this.tradeHistory = [];
    this.activeContractTicks = [];
    this.virtualNetProfit = 0;
    this.virtualWins = 0;
    this.virtualLosses = 0;
    this.virtualConsecutiveLosses = 0;
    this.notifyHistory();
    this.notifyStatus();
  }

  public setBalance(balance: number) {
    if (Number.isFinite(balance) && balance > 0) {
      this.currentBalanceUsd = balance;
    }
  }

  public setBalanceUpdater(cb: (profit: number, newBalance: number) => void) {
    this.onBalanceUpdateCallback = cb;
  }

  public getStatus(): SystemAutoStatus {
    const pool = this.getMarketPool();
    const safeIndex = this.activeMarketIndex % (pool.length || 1);
    const currentMarket = pool[safeIndex] || pool[0] || ASCENDING_VOLATILITY_MARKETS[0];
    const nextMarket = pool[(safeIndex + 1) % (pool.length || 1)] || pool[0] || ASCENDING_VOLATILITY_MARKETS[0];
    const total = this.totalWins + this.totalLosses;
    const winRate = total > 0 ? Number(((this.totalWins / total) * 100).toFixed(1)) : 0;

    return {
      isRunning: this.isRunning,
      isSettling: this.isSettling,
      strategyMode: this.config.strategyMode,
      activeMarketIndex: safeIndex,
      currentMarket,
      nextMarket,
      tradedSymbolsInCycle: Array.from(this.tradedMarketsInCycle),
      cycleCompletedCount: this.tradedMarketsInCycle.size,
      cycleTotalCount: pool.length,
      currentStake: Number(this.currentStake.toFixed(2)),
      totalTrades: total,
      totalWins: this.totalWins,
      totalLosses: this.totalLosses,
      winRate,
      netProfit: Number(this.netProfit.toFixed(2)),
      consecutiveWins: this.consecutiveWins,
      consecutiveLosses: this.consecutiveLosses,
      maxConsecutiveWins: this.maxConsecutiveWins,
      maxConsecutiveLosses: this.maxConsecutiveLosses,
      currentCycle: this.currentCycle,
      activeContractId: this.activeContractId,
      activeDifferDigit: this.activeDifferDigit,
      activeTriggerReason: this.activeTriggerReason,
      activeContractTicks: this.activeContractTicks,
      statusMessage: this.statusMessage,
      lastExecutionMs: this.lastExecutionMs,
      stopReason: this.stopReason,
      lastSettledProfit: this.lastSettledProfit,
      lastSettledBalance: this.lastSettledBalance,
      lastSettledMarketName: this.lastSettledMarketName,
      lastSettledTriggerReason: this.lastSettledTriggerReason,
      lastTradedSymbol: this.lastTradedSymbol,
      lastTradedMarketName: this.lastTradedMarketName,
      qualifyingCount: Array.from(this.marketStates.values()).filter(
        (s) => pool.some((p) => p.symbol === s.symbol) && (this.config.strategyMode === 'ALTERNATING_DIGITS' ? s.hasAlternatingPattern : s.hasTwinDigit)
      ).length,
      singleTradeSequentialMode: this.config.singleTradeSequentialMode !== false,
      isTradeActive: this.activeContractId !== null || this.isProcessingTrade,
      scanPhase: this.scanPhase,
      postTradeCountdownSec: this.postTradeCountdownSec,
      virtualLossFilterEnabled: Boolean(this.config.virtualLossFilterEnabled),
      virtualModeState: this.virtualModeState,
      virtualWins: this.virtualWins,
      virtualLosses: this.virtualLosses,
      virtualConsecutiveLosses: this.virtualConsecutiveLosses,
      virtualNetProfit: Number(this.virtualNetProfit.toFixed(2)),
      digitSelectTargetDigit: this.config.digitSelectTargetDigit ?? 5,
      digitSelectVolatilitySymbol: this.config.digitSelectVolatilitySymbol || 'R_100',
      lastDigitDifferMarketSymbol: this.config.lastDigitDifferMarketSymbol || 'R_25',
      lastDigitDifferImmediateDigit: this.marketStates.get(this.config.lastDigitDifferMarketSymbol || 'R_25')?.lastDigit ?? 0,
      entryPointMarketSymbol: this.config.entryPointMarketSymbol || 'R_100',
      entryPointTargetDigit: this.config.entryPointTargetDigit !== undefined ? this.config.entryPointTargetDigit : 5,
      double1SelectMarketSymbol: this.config.double1SelectMarketSymbol || 'R_100',
      double1SelectMaxDigitsRange: this.config.double1SelectMaxDigitsRange ?? 6,
      double1SelectState: this.double1SelectState,
      double1SelectLockedDigit: this.double1SelectLockedDigit,
      double1SelectInterveningDigits: [...this.double1SelectInterveningDigits],
      rangeLongWindowDigits: [...this.rangeLongWindowDigits],
      rangeLongCurrentCount: this.rangeLongWindowDigits.length,
      rangeLongMostAppearingDigit: this.getRangeLongAnalysis().mostAppearingDigit,
      rangeLongMostAppearingCount: this.getRangeLongAnalysis().mostAppearingCount,
      rangeLongDigitFrequencies: this.getRangeLongAnalysis().frequencies,
      rangeLongDiffersMarketSymbol: this.config.rangeLongDiffersMarketSymbol || 'R_100',
      doubleEndMarketSymbol: this.config.doubleEndMarketSymbol || 'R_100',
      doubleEndPatternMode: this.config.doubleEndPatternMode || 'PAIR_OR_THRICE',
      doubleEndDetectedPattern: this.doubleEndDetectedPattern,
      doubleEndBaseDigit: this.doubleEndBaseDigit,
      doubleEndDifferTarget: this.doubleEndDifferTarget,
      doubleEndDigits: [...this.doubleEndDigits],
      fastLastDifferChosenDigit: this.config.fastLastDifferChosenDigit !== undefined ? this.config.fastLastDifferChosenDigit : 5,
      fastLastDifferTriggeredMarket: this.fastLastDifferTriggeredMarket,
      combinerCurrentStage: this.combinerCurrentStage,
      combinerCycleCount: this.combinerCycleCount,
      combinerStage3State: this.combinerStage3State,
      combinerStage3LockedDigit: this.combinerStage3LockedDigit,
      combinerStage3InterveningDigits: [...this.combinerStage3InterveningDigits],
      combinerStageWins: [...this.combinerStageWins] as [number, number, number, number],
      combinerStageLosses: [...this.combinerStageLosses] as [number, number, number, number],
      combinerStageMarkets: [
        this.config.combinerStage1Market || 'R_10',
        this.config.combinerStage2Market || 'R_25',
        this.config.combinerStage3Market || 'R_50',
        this.config.combinerStage4Market || 'R_100',
      ],
      manipulationThreatScore: strategyShield.getManipulationThreatScore(),
      manipulationThreatLevel: strategyShield.getManipulationMetrics().threatLevel,
      isProfitLocked: strategyShield.isProfitLockActive().locked,
      profitLockReason: strategyShield.isProfitLockActive().reason,
      isZeroTraceMode: strategyShield.isZeroTraceModeEnabled(),
      lastShieldJitterMs: strategyShield.getLastAppliedJitterMs(),
      isAntiTrackingShieldActive: Boolean(strategyShield.getConfig().enableAntiTrackingShield),
      isDecoyTrafficActive: Boolean(strategyShield.getConfig().enableDecoyTraffic),
      isDynamicMarketHopping: Boolean(strategyShield.getConfig().enableDynamicMarketHopping),
    };
  }

  /**
   * Toggle or set Virtual-to-Real Trading Hook:
   * When enabled, the bot scans and trades on Demo until 1 single loss occurs.
   * Immediately after 1 virtual loss, the next trade is taken on the Real account!
   * After a win on the Real account, it automatically switches back to Demo mode.
   */
  public setVirtualLossFilter(enabled: boolean) {
    this.config.virtualLossFilterEnabled = enabled;
    if (!enabled) {
      this.virtualModeState = 'VIRTUAL';
    } else {
      this.virtualModeState = 'VIRTUAL';
      this.virtualConsecutiveLosses = 0;
    }
    this.saveConfig({ virtualLossFilterEnabled: enabled });
    soundManager.playButtonClick();
    this.notifyConfig();
    this.notifyStatus();
  }

  public setVirtualDemoStake(stake: number) {
    const valid = Math.max(0.35, Number(stake) || 1.00);
    this.config.virtualDemoStake = valid;
    this.saveConfig({ virtualDemoStake: valid });
    this.notifyConfig();
    this.notifyStatus();
  }

  /**
   * Returns whether next trade should be Virtual (Demo) or Real, along with appropriate stake
   */
  private getExecutionPlan(): { isVirtual: boolean; stakeToUse: number; accountType: 'DEMO' | 'REAL'; label: string } {
    if (this.config.virtualLossFilterEnabled) {
      if (this.virtualModeState === 'REAL_ARMED' || this.virtualModeState === 'REAL_ACTIVE') {
        return {
          isVirtual: false,
          stakeToUse: Number(this.currentStake.toFixed(2)),
          accountType: 'REAL',
          label: 'REAL ACCOUNT',
        };
      } else {
        // Hunting for 1 virtual loss in Demo
        return {
          isVirtual: true,
          stakeToUse: Number((this.config.virtualDemoStake || 1.00).toFixed(2)),
          accountType: 'DEMO',
          label: 'DEMO / VIRTUAL',
        };
      }
    }

    return {
      isVirtual: false,
      stakeToUse: Number(this.currentStake.toFixed(2)),
      accountType: 'REAL',
      label: 'ACTIVE ACCOUNT',
    };
  }

  public getMarketStates(): Map<MarketSymbol, MarketLiveState> {
    return new Map(this.marketStates);
  }

  public getTradeHistory(): TradeRecord[] {
    return [...this.tradeHistory];
  }

  public subscribeConfig(cb: (config: SystemAutoConfig) => void): () => void {
    this.configListeners.add(cb);
    cb(this.getConfig());
    return () => this.configListeners.delete(cb);
  }

  public subscribeStatus(cb: (status: SystemAutoStatus) => void): () => void {
    this.listeners.add(cb);
    cb(this.getStatus());
    return () => this.listeners.delete(cb);
  }

  public subscribeHistory(cb: (trades: TradeRecord[]) => void): () => void {
    this.historyListeners.add(cb);
    cb(this.getTradeHistory());
    return () => this.historyListeners.delete(cb);
  }

  public subscribeMarketStates(cb: (states: Map<MarketSymbol, MarketLiveState>) => void): () => void {
    this.marketLiveListeners.add(cb);
    cb(this.getMarketStates());
    return () => this.marketLiveListeners.delete(cb);
  }

  private notifyConfig() {
    const cfg = this.getConfig();
    this.configListeners.forEach((cb) => {
      try { cb(cfg); } catch (e) { console.error('Error in config listener', e); }
    });
  }

  private notifyStatus() {
    const status = this.getStatus();
    this.listeners.forEach((cb) => {
      try { cb(status); } catch (e) { console.error('Error in status listener', e); }
    });
  }

  private notifyHistory() {
    const hist = this.getTradeHistory();
    this.historyListeners.forEach((cb) => {
      try { cb(hist); } catch (e) { console.error('Error in history listener', e); }
    });
  }

  private notifyMarketStates() {
    const states = this.getMarketStates();
    this.marketLiveListeners.forEach((cb) => {
      try { cb(states); } catch (e) { console.error('Error in market listener', e); }
    });
  }

  /**
   * Resets pattern trigger flags across all markets so prior stale patterns do not auto-trigger
   */
  public resetPatternFlagsAcrossMarkets() {
    for (const [sym, st] of this.marketStates.entries()) {
      this.marketStates.set(sym, {
        ...st,
        hasTwinDigit: false,
        twinDigit: null,
        hasTwin0or9: false,
        twin0or9Digit: null,
        hasAlternatingPattern: false,
        alternatingDigits: [],
        alternatingPatternText: '',
        hasDoubleBotPattern: false,
        doubleBotTargetDigit: null,
        doubleBotDigits: [],
        doubleBotPatternStr: '',
        hasMasterDoublePattern: false,
        masterDoubleTwinDigit: null,
        masterDoubleTargetDigit: null,
        masterDoublePatternStr: '',
        hasDoubleEndPattern: false,
        doubleEndType: null,
        doubleEndBaseDigit: null,
        doubleEndDifferTarget: null,
        doubleEndPatternStr: '',
        doubleEndDigits: [],
      });
    }
    this.notifyMarketStates();
  }

  public startBot(startMarketIndex: number = 0) {
    if (this.isRunning) return;

    // Reset Strategy Shield locks so fresh bot run isn't blocked by previous session limits
    strategyShield.resetCircuitBreaker();
    strategyShield.resetProfitLock();
    strategyShield.clearAnomalies();

    this.isRunning = true;
    this.stopReason = null;
    this.activeMarketIndex = startMarketIndex;
    this.tradedMarketsInCycle.clear();
    this.lastTradedSymbol = null;
    this.lastTradedMarketName = null;
    this.currentStake = this.config.baseStake;
    this.currentMartingaleStep = 0;
    this.consecutiveWinProfitAccumulator = 0;
    this.isProcessingTrade = false;
    this.isSettling = false;
    this.activeContractId = null;
    this.activeDifferDigit = null;
    this.activeTriggerReason = null;
    this.activeContractTicks = [];
    this.previousDifferDigit = null;
    this.marketLastTradeTime.clear();
    this.marketLastTriggerPrice.clear();
    this.lastTradeClosedTime = Date.now();
    this.scanPhase = 'SCANNING';
    this.postTradeCountdownSec = null;
    if (this.postTradeCountdownTimer) {
      window.clearInterval(this.postTradeCountdownTimer);
      this.postTradeCountdownTimer = null;
    }

    soundManager.playStart();

    if (this.config.virtualLossFilterEnabled) {
      this.virtualModeState = 'VIRTUAL';
      this.virtualConsecutiveLosses = 0;
    }

    const pool = this.getMarketPool();
    const currentTarget = pool[this.activeMarketIndex % (pool.length || 1)] || pool[0];

    // 🧩 Combiner Bot Strategy:
    // Combines 4 strategies in selected volatility markets in ascending order:
    // Stage 1: Market 1 ➔ [x, x, y] differ digit y
    // Stage 2: Market 2 ➔ [x, y, x, x] differ digit x
    // Stage 3: Market 3 ➔ double [x, x] lock ➔ reappearance differ digit x
    // Stage 4: Market 4 ➔ differ the last digit
    if (this.config.strategyMode === 'COMBINER_BOT') {
      this.combinerCurrentStage = 1;
      this.combinerStage3State = 'HUNTING_DOUBLE';
      this.combinerStage3LockedDigit = null;
      this.combinerStage3InterveningDigits = [];
      const m1Sym = this.config.combinerStage1Market || 'R_10';
      const m1 = ASCENDING_VOLATILITY_MARKETS.find((m) => m.symbol === m1Sym) || ASCENDING_VOLATILITY_MARKETS[0];
      const virtualTag = this.config.virtualLossFilterEnabled
        ? `🧪 [DEMO HUNT] Virtual Mode Active (Demo Stake: $${(this.config.virtualDemoStake || 1.00).toFixed(2)}). Waiting for 1 single demo loss to arm REAL account ($${this.currentStake.toFixed(2)}) ➔ `
        : '';
      this.scanPhase = 'SCANNING';
      this.statusMessage = `${virtualTag}🧩 Combiner Bot Active! Ascending sequence started at Stage 1 [${m1.shortName}]: Scanning for [x, x, y] ➔ Differ ≠ y (1-Tick close)...`;
      this.notifyStatus();
      return;
    }

    // 🎯 Last Digit Differ Strategy: Immediately executes Differ ≠ immediateLastDigit on the selected Volatility market!
    if (this.config.strategyMode === 'LAST_DIGIT_DIFFER') {
      const targetSymbol = this.config.lastDigitDifferMarketSymbol || 'R_25';
      const targetMarket = ASCENDING_VOLATILITY_MARKETS.find((m) => m.symbol === targetSymbol) || ASCENDING_VOLATILITY_MARKETS.find(m => m.symbol === 'R_25') || ASCENDING_VOLATILITY_MARKETS[0];
      const live = this.marketStates.get(targetSymbol);
      const immediateDigit = live ? live.lastDigit : 0;
      const virtualTag = this.config.virtualLossFilterEnabled
        ? `🧪 [DEMO HUNT] Virtual Mode Active (Demo Stake: $${(this.config.virtualDemoStake || 1.00).toFixed(2)}). Waiting for 1 single demo loss to arm REAL account ($${this.currentStake.toFixed(2)}) ➔ `
        : '';
      this.statusMessage = `${virtualTag}🎯 Last Digit Differ Active: Executing Differ ≠ ${immediateDigit} (immediate last digit) on [${targetMarket.shortName}] (1-Tick Settle)...`;
      this.notifyStatus();
      this.executeLastDigitDifferTrade();
      return;
    }

    // 🎯 Entry Point Differ Strategy: Scans selected market until selected digit appears, then immediately buys Differ ≠ targetDigit (1-Tick close)
    if (this.config.strategyMode === 'ENTRY_POINT_DIFFER') {
      const targetDigit = this.config.entryPointTargetDigit !== undefined ? this.config.entryPointTargetDigit : 5;
      const targetSymbol = this.config.entryPointMarketSymbol || 'R_100';
      const targetMarket = ASCENDING_VOLATILITY_MARKETS.find((m) => m.symbol === targetSymbol) || ASCENDING_VOLATILITY_MARKETS[0];
      const live = this.marketStates.get(targetSymbol);
      const curD = live ? live.lastDigit : 0;
      const virtualTag = this.config.virtualLossFilterEnabled
        ? `🧪 [DEMO HUNT] Virtual Mode Active (Demo Stake: $${(this.config.virtualDemoStake || 1.00).toFixed(2)}). Waiting for 1 single demo loss to arm REAL account ($${this.currentStake.toFixed(2)}) ➔ `
        : '';

      this.scanPhase = 'SCANNING';
      if (curD === targetDigit) {
        this.statusMessage = `${virtualTag}🎯 Entry Point Detected! Immediate digit on [${targetMarket.shortName}] is [${targetDigit}] ➔ Executing Differ ≠ ${targetDigit} (1-Tick Close)...`;
        this.notifyStatus();
        this.executeEntryPointDifferTrade(targetMarket, targetDigit);
      } else {
        this.statusMessage = `${virtualTag}🎯 Entry Point Bot Active: Scanning [${targetMarket.shortName}] for digit [${targetDigit}]. Current digit is [${curD}]. Waiting for Entry Point [${targetDigit}] to appear!`;
        this.notifyStatus();
      }
      return;
    }

    // 🎯 Digit Marker Bot Strategy: Scans selected market for marked digit (e.g. 6).
    // The moment marked digit appears, buys Differ ≠ markedDigit. Immediate next tick settles trade (1-tick duration).
    if (this.config.strategyMode === 'DIGIT_MARKER_DIFFER') {
      const targetDigit = this.config.digitMarkerTargetDigit !== undefined ? this.config.digitMarkerTargetDigit : 6;
      const targetSymbol = this.config.digitMarkerMarketSymbol || 'R_100';
      const targetMarket = ASCENDING_VOLATILITY_MARKETS.find((m) => m.symbol === targetSymbol) || ASCENDING_VOLATILITY_MARKETS[0];
      const live = this.marketStates.get(targetSymbol);
      const curD = live ? live.lastDigit : 0;
      const virtualTag = this.config.virtualLossFilterEnabled
        ? `🧪 [DEMO HUNT] Virtual Mode Active (Demo Stake: $${(this.config.virtualDemoStake || 1.00).toFixed(2)}). Waiting for 1 single demo loss to arm REAL account ($${this.currentStake.toFixed(2)}) ➔ `
        : '';

      this.scanPhase = 'SCANNING';
      if (curD === targetDigit) {
        this.statusMessage = `${virtualTag}🎯 [Digit Marker]: Marked Digit [${targetDigit}] detected on [${targetMarket.shortName}]! Buying Differ ≠ ${targetDigit} (1-Tick Close)...`;
        this.notifyStatus();
        this.executeDigitMarkerDifferTrade(targetMarket, targetDigit);
      } else {
        this.statusMessage = `${virtualTag}🎯 [Digit Marker Bot Active]: Scanning [${targetMarket.shortName}] for marked digit [${targetDigit}]. Current digit: [${curD}]. Waiting for digit [${targetDigit}] to appear!`;
        this.notifyStatus();
      }
      return;
    }

    // 🎯 Range Long Differs Strategy:
    // Observes 7 live digits generated on the selected volatility market.
    // Identifies the most appearing digit within the 7 digits.
    // On the 7th digit, automatically buys Differ ≠ most appearing digit. Settles on the 8th digit (1-tick).
    if (this.config.strategyMode === 'RANGE_LONG_DIFFERS') {
      this.rangeLongWindowDigits = [];
      this.rangeLongLockedModeDigit = null;
      const targetSymbol = this.config.rangeLongDiffersMarketSymbol || 'R_100';
      const targetMarket = ASCENDING_VOLATILITY_MARKETS.find((m) => m.symbol === targetSymbol) || ASCENDING_VOLATILITY_MARKETS[0];
      const virtualTag = this.config.virtualLossFilterEnabled
        ? `🧪 [DEMO HUNT] Virtual Mode Active (Demo Stake: $${(this.config.virtualDemoStake || 1.00).toFixed(2)}). Waiting for 1 single demo loss to arm REAL account ($${this.currentStake.toFixed(2)}) ➔ `
        : '';

      this.scanPhase = 'SCANNING';
      this.statusMessage = `${virtualTag}📊 [Range Long Differs Active]: Scanning [${targetMarket.shortName}]. Collecting 7 live digits (0/7 ticks)... When 7th digit arrives, buys Differ ≠ most appearing digit (Settles on 8th digit).`;
      this.notifyStatus();
      return;
    }

    // 🎯 Double 1 Select Strategy:
    // Scans selected market. When [d, d] (or [d, d, d]) appears, locks d.
    // Waits for d to appear within next 6 digits. When it does, buys Differ ≠ d (1-Tick settle).
    if (this.config.strategyMode === 'DOUBLE_1_SELECT') {
      this.double1SelectLockedDigit = null;
      this.double1SelectInterveningDigits = [];
      this.double1SelectState = 'HUNTING';
      const targetSymbol = this.config.double1SelectMarketSymbol || 'R_100';
      const targetMarket = ASCENDING_VOLATILITY_MARKETS.find((m) => m.symbol === targetSymbol) || ASCENDING_VOLATILITY_MARKETS[0];
      const range = this.config.double1SelectMaxDigitsRange ?? 6;
      const virtualTag = this.config.virtualLossFilterEnabled
        ? `🧪 [DEMO HUNT] Virtual Mode Active (Demo Stake: $${(this.config.virtualDemoStake || 1.00).toFixed(2)}). Waiting for 1 single demo loss to arm REAL account ($${this.currentStake.toFixed(2)}) ➔ `
        : '';

      this.scanPhase = 'SCANNING';
      this.statusMessage = `${virtualTag}🎯 [Double 1 Select] Active on [${targetMarket.shortName}]: Scanning for identical digits [d, d] or [d, d, d] to lock ➔ then waiting for [d] within next ${range} digits ➔ Differ ≠ d (1t settle)...`;
      this.notifyStatus();
      return;
    }

    // ⚡ Double End Bot Strategy:
    // Scans a given market. When a pair [x, x] or thrice [x, x, x] appears, the next different digit y
    // is bought as a differ (Differ ≠ y). The next digit generated closes and settles the trade (1-tick duration).
    if (this.config.strategyMode === 'DOUBLE_END_BOT') {
      const targetSymbol = this.config.doubleEndMarketSymbol || 'R_100';
      const targetMarket = ASCENDING_VOLATILITY_MARKETS.find((m) => m.symbol === targetSymbol) || ASCENDING_VOLATILITY_MARKETS[0];
      const live = this.marketStates.get(targetSymbol);
      const virtualTag = this.config.virtualLossFilterEnabled
        ? `🧪 [DEMO HUNT] Virtual Mode Active (Demo Stake: $${(this.config.virtualDemoStake || 1.00).toFixed(2)}). Waiting for 1 single demo loss to arm REAL account ($${this.currentStake.toFixed(2)}) ➔ `
        : '';
      const mode = this.config.doubleEndPatternMode || 'PAIR_OR_THRICE';
      const modeLabel = mode === 'PAIR_ONLY' ? 'Pair [x, x, y]' : mode === 'THRICE_ONLY' ? 'Thrice [x, x, x, y]' : 'Pair [x, x, y] or Thrice [x, x, x, y]';

      this.scanPhase = 'SCANNING';
      if (
        live?.hasDoubleEndPattern &&
        live.doubleEndDifferTarget !== null &&
        live.doubleEndBaseDigit !== null &&
        live.doubleEndType &&
        live.doubleEndDigits &&
        (mode === 'PAIR_OR_THRICE' || (mode === 'PAIR_ONLY' && live.doubleEndType === 'PAIR') || (mode === 'THRICE_ONLY' && live.doubleEndType === 'THRICE'))
      ) {
        this.statusMessage = `${virtualTag}🎯 Double End Pattern Detected! ${live.doubleEndPatternStr} on [${targetMarket.shortName}] ➔ Buying Differ ≠ ${live.doubleEndDifferTarget} (1-Tick settle)...`;
        this.notifyStatus();
        this.executeDoubleEndTrade(targetMarket, live.doubleEndDifferTarget, live.doubleEndBaseDigit, live.doubleEndType, live.doubleEndDigits);
      } else {
        const curDigits = live?.recentDigits.slice(-5).join(', ') || 'none';
        this.statusMessage = `${virtualTag}🎯 Double End Bot Active: Scanning [${targetMarket.shortName}] for ${modeLabel} (Recent: [${curDigits}]) ➔ Next different digit bought as Differ (1t settle)!`;
        this.notifyStatus();
      }
      return;
    }

    // ⚡ Fast Last Differ Strategy:
    // When started, it scans all markets at once simultaneously.
    // When the user-chosen digit (0..9) appears in ANY market,
    // the first market to produce that digit immediately buys Differ ≠ chosenDigit.
    // The very next digit settles the trade (1-tick duration).
    if (this.config.strategyMode === 'FAST_LAST_DIFFER') {
      const chosenDigit = this.config.fastLastDifferChosenDigit !== undefined ? this.config.fastLastDifferChosenDigit : 5;
      const virtualTag = this.config.virtualLossFilterEnabled
        ? `🧪 [DEMO HUNT] Virtual Mode Active (Demo Stake: $${(this.config.virtualDemoStake || 1.00).toFixed(2)}). Waiting for 1 single demo loss to arm REAL account ($${this.currentStake.toFixed(2)}) ➔ `
        : '';

      this.scanPhase = 'SCANNING';
      this.fastLastDifferTriggeredMarket = null;
      this.statusMessage = `${virtualTag}⚡ Fast Last Differ Active: Scanning all 13 volatility markets simultaneously for chosen digit [${chosenDigit}] ➔ First market to hit [${chosenDigit}] buys Differ ≠ ${chosenDigit} immediately (1-Tick settle)!`;
      this.notifyStatus();
      return;
    }

    // 🎯 Digit Select Differ Strategy: Immediately executes Differ ≠ selectedDigit on the selected Volatility market!
    if (this.config.strategyMode === 'DIGIT_SELECT_DIFFER') {
      const targetDigit = this.config.digitSelectTargetDigit ?? 5;
      const targetSymbol = this.config.digitSelectVolatilitySymbol || 'R_100';
      const targetMarket = ASCENDING_VOLATILITY_MARKETS.find((m) => m.symbol === targetSymbol) || ASCENDING_VOLATILITY_MARKETS[0];
      const virtualTag = this.config.virtualLossFilterEnabled
        ? `🧪 [DEMO HUNT] Virtual Mode Active (Demo Stake: $${(this.config.virtualDemoStake || 1.00).toFixed(2)}). Waiting for 1 single demo loss to arm REAL account ($${this.currentStake.toFixed(2)}) ➔ `
        : '';
      this.statusMessage = `${virtualTag}🎯 Digit Select Differ Active: Executing immediate Differ ≠ ${targetDigit} on [${targetMarket.shortName}] (1-Tick Settle)...`;
      this.notifyStatus();
      this.executeDigitSelectDifferTrade();
      return;
    }

    // In 1-Trade Sequential Mode, reset prior trigger flags and start scanning fresh incoming ticks
    if (this.config.singleTradeSequentialMode) {
      if (this.config.requireFreshPatternAfterClose !== false) {
        this.resetPatternFlagsAcrossMarkets();
      }
      const virtualTag = this.config.virtualLossFilterEnabled
        ? `🧪 [DEMO HUNT] Virtual Mode Active (Demo Stake: $${(this.config.virtualDemoStake || 1.00).toFixed(2)}). Waiting for 1 single demo loss to arm REAL account ($${this.currentStake.toFixed(2)}) ➔ `
        : '';
      this.statusMessage = `${virtualTag}🚀 1-Trade Scanner Active: Monitoring all ${pool.length} markets for fresh triggers. Bot takes 1 trade ➔ waits for it to close ➔ scans again...`;
      this.notifyStatus();
      return;
    }

    if (this.config.strategyMode === 'TWIN_0_AND_9_DIFFER') {
      const dur = this.config.durationTicks || 1;
      if (this.config.marketScope === 'SINGLE_SPECIFIC') {
        this.statusMessage = `🎯 Polar Twin Sniper Locked on [${currentTarget.shortName}]! Scanning for [0, 0] ➔ ≠0 or [9, 9] ➔ ≠9 (${dur}t settle)...`;
        this.notifyStatus();
        const targetState = this.marketStates.get(currentTarget.symbol);
        if (targetState?.hasTwin0or9 && targetState.twin0or9Digit !== null) {
          this.handleTwin0And9Detected(currentTarget, targetState.twin0or9Digit, targetState.price);
        }
      } else {
        this.statusMessage = `🚀 Simultaneous Polar Twin Scanner Active! Scanning all ${pool.length} markets at once. When any market gets [9,9] ➔ buys Differ ≠ 9, or [0,0] ➔ buys Differ ≠ 0 (${dur}t Differ)...`;
        this.notifyStatus();
        this.checkAllMarketsForTwin09Trigger();
      }
    } else if (this.config.strategyMode === 'MASTER_DOUBLE') {
      const dur = this.config.durationTicks || 1;
      if (this.config.marketScope === 'SINGLE_SPECIFIC') {
        this.statusMessage = `🎯 Master Double Locked on [${currentTarget.shortName}]! Scanning for [d, d] ➔ Differ ≠ (d+1) (e.g. 0,0 ➔ ≠1 | 1,1 ➔ ≠2 ... 8,8 ➔ ≠9, ${dur}t)...`;
        this.notifyStatus();
        const targetState = this.marketStates.get(currentTarget.symbol);
        if (targetState?.hasMasterDoublePattern && targetState.masterDoubleTwinDigit !== null && targetState.masterDoubleTargetDigit !== null) {
          this.handleMasterDoubleDetected(
            currentTarget,
            targetState.masterDoubleTwinDigit,
            targetState.masterDoubleTargetDigit,
            dur,
            targetState.price
          );
        }
      } else {
        this.statusMessage = `🚀 Master Double Scanner Active! Monitoring all ${pool.length} markets for twin patterns [d, d] (0,0➔≠1, 1,1➔≠2, 2,2➔≠3... 8,8➔≠9). Next digit settles (${dur}t Differ)...`;
        this.notifyStatus();
        this.checkAllMarketsForMasterDoubleTrigger();
      }
    } else if (this.config.strategyMode === 'MASTER_DOUBLE_2') {
      const dur = this.config.durationTicks || 1;
      const selPatterns = this.config.masterDouble2SelectedPatterns || [0, 1, 2, 3, 4, 5, 6, 7, 8];
      const patternDesc = selPatterns.length === 9 ? 'All [0..8]' : selPatterns.map((p) => `${p},${p}➔≠${p + 1}`).join(', ');
      if (this.config.marketScope === 'SINGLE_SPECIFIC') {
        this.statusMessage = `🎯 Master Double [2] Locked on [${currentTarget.shortName}]! Scanning for selected patterns [${patternDesc}] (${dur}t)...`;
        this.notifyStatus();
        const targetState = this.marketStates.get(currentTarget.symbol);
        if (
          targetState?.hasMasterDoublePattern &&
          targetState.masterDoubleTwinDigit !== null &&
          targetState.masterDoubleTargetDigit !== null &&
          selPatterns.includes(targetState.masterDoubleTwinDigit)
        ) {
          this.handleMasterDouble2Detected(
            currentTarget,
            targetState.masterDoubleTwinDigit,
            targetState.masterDoubleTargetDigit,
            dur,
            targetState.price
          );
        }
      } else {
        this.statusMessage = `🚀 Master Double [2] Scanner Active! Monitoring all ${pool.length} markets for selected patterns [${patternDesc}]. Next digit settles (${dur}t Differ)...`;
        this.notifyStatus();
        this.checkAllMarketsForMasterDouble2Trigger();
      }
    } else if (this.config.strategyMode === 'DOUBLE_BOT_1TICK') {
      const dur = this.config.durationTicks || 1;
      if (this.config.marketScope === 'SINGLE_SPECIFIC') {
        this.statusMessage = `🎯 Double Bot Locked on [${currentTarget.shortName}]! Scanning for [x, x, y] ➔ Differ ≠ y (${dur}t settle)...`;
        this.notifyStatus();
        const targetState = this.marketStates.get(currentTarget.symbol);
        if (targetState?.hasDoubleBotPattern && targetState.doubleBotTargetDigit !== null && targetState.doubleBotDigits) {
          this.handleDoubleBotDetected(
            currentTarget,
            targetState.doubleBotTargetDigit,
            dur,
            targetState.doubleBotDigits,
            targetState.price
          );
        }
      } else {
        this.statusMessage = `🚀 Simultaneous Double Bot Scanner Active! Scanning all ${pool.length} markets for pattern [x, x, y] (e.g. 3,3,4 ➔ ≠4 | 5,5,6 ➔ ≠6). Next digit settles (${dur}t Differ)...`;
        this.notifyStatus();
        this.checkAllMarketsForDoubleBotTrigger();
      }
    } else if (this.config.strategyMode === 'ALTERNATING_DIGITS') {
      const dur = this.config.durationTicks || 1;
      const targetDigit = this.config.alternatingTargetDigit ?? 5;
      const cooldownSec = this.config.alternatingCooldownSec ?? 5;
      if (this.config.marketScope === 'SINGLE_SPECIFIC') {
        this.statusMessage = `🎯 Alternating Digits Bot Locked on [${currentTarget.shortName}]! Scanning for Alternating Odd/Even pattern (Target Differ ≠ ${targetDigit}, ${dur}t settle, ${cooldownSec}s cooldown)...`;
        this.notifyStatus();
        const targetState = this.marketStates.get(currentTarget.symbol);
        if (targetState && targetState.recentDigits.length >= 3) {
          this.evaluateAlternatingDigitsScan(currentTarget, targetState.recentDigits, targetState.price);
        }
      } else {
        this.statusMessage = `🚀 Alternating Digits Bot Active! Scanning all ${pool.length} markets for Alternating Odd/Even pattern (Length 3). Target Differ ≠ ${targetDigit} (${dur}t, ${cooldownSec}s cooldown)...`;
        this.notifyStatus();
        this.checkAllMarketsForAlternatingTrigger();
      }
    } else if (this.config.strategyMode === 'DOUBLE_IDENTICAL_2TICK') {
      const dur = this.config.durationTicks || 1;
      if (this.config.marketScope === 'SINGLE_SPECIFIC') {
        this.statusMessage = `🎯 Sniper Locked on [${currentTarget.shortName}]! Scanning for Double Identical twin digits (≠Differ ${dur}t settle)...`;
        this.notifyStatus();
        const targetState = this.marketStates.get(currentTarget.symbol);
        if (targetState?.hasTwinDigit && targetState.twinDigit !== null) {
          this.handleDoubleIdenticalDetected(currentTarget, targetState.twinDigit, targetState.price);
        }
      } else {
        this.statusMessage = `🚀 Simultaneous All-Markets Scanner Active! Scanning all ${pool.length} markets at the same time. Any market that triggers [d, d] will be traded randomly (${dur}t Differ)...`;
        this.notifyStatus();
        // Check if any pool market is already qualifying right now
        this.checkAllMarketsForTrigger();
      }
    } else {
      this.statusMessage = `🚀 Ascending Bot started at ${currentTarget.shortName} (${pool.length} market${pool.length > 1 ? 's' : ''})`;
      this.notifyStatus();
      this.executeNextMarketTrade();
    }
  }

  public skipToNextMarket() {
    if (this.isProcessingTrade || this.isSettling || this.activeContractId !== null) return;
    const pool = this.getMarketPool();
    const prevMarket = pool[this.activeMarketIndex % (pool.length || 1)];
    this.activeMarketIndex = (this.activeMarketIndex + 1) % (pool.length || 1);
    const nextMarket = pool[this.activeMarketIndex % (pool.length || 1)];
    if (this.activeMarketIndex === 0) {
      this.currentCycle++;
      this.tradedMarketsInCycle.clear();
    }
    this.statusMessage = `⏭️ Skipped ${prevMarket.shortName} ➔ Now scanning [${nextMarket.shortName}] in ascending ladder (Market ${this.activeMarketIndex + 1}/${pool.length}, Cycle #${this.currentCycle})`;
    soundManager.playButtonClick();
    this.notifyStatus();
    if (this.isRunning && this.config.strategyMode === 'ASCENDING_SEQUENTIAL_1TICK') {
      this.executeNextMarketTrade();
    }
  }

  public stopBot(reason: string = 'User stopped bot') {
    this.isRunning = false;
    this.stopReason = reason;

    if (this.nextTradeTimer) {
      window.clearTimeout(this.nextTradeTimer);
      this.nextTradeTimer = null;
    }
    if (this.postTradeCountdownTimer) {
      window.clearInterval(this.postTradeCountdownTimer);
      this.postTradeCountdownTimer = null;
    }
    this.postTradeCountdownSec = null;
    this.isSettling = false;

    // Check if an in-flight trade is currently active or open in trade history
    const hasOpenTrade =
      this.activeContractId !== null ||
      this.isProcessingTrade ||
      this.tradeHistory.some((t) => t.result === 'OPEN');

    if (hasOpenTrade) {
      const openTrade = this.tradeHistory.find((t) => t.result === 'OPEN');
      const marketName = openTrade?.marketName || 'active market';
      const differInfo = openTrade
        ? `≠ ${openTrade.differDigit}`
        : this.activeDifferDigit !== null
        ? `≠ ${this.activeDifferDigit}`
        : '';
      this.statusMessage = `🛑 Stopping bot: waiting for 2-tick in-flight trade on ${marketName} (${differInfo}) to settle cleanly and update balance...`;
    } else {
      if (this.watchdogTimer) {
        window.clearTimeout(this.watchdogTimer);
        this.watchdogTimer = null;
      }
      this.isProcessingTrade = false;
      this.scanPhase = 'IDLE';
      this.activeContractId = null;
      this.activeDifferDigit = null;
      this.activeTriggerReason = null;
      this.statusMessage = `🛑 Bot stopped: ${reason}`;
    }

    soundManager.playStop();
    this.notifyStatus();
  }

  public resetStats() {
    strategyShield.resetCircuitBreaker();
    strategyShield.resetProfitLock();
    strategyShield.clearAnomalies();

    this.double1SelectLockedDigit = null;
    this.double1SelectInterveningDigits = [];
    this.double1SelectState = 'HUNTING';

    this.combinerCurrentStage = 1;
    this.combinerCycleCount = 1;
    this.combinerStageWins = [0, 0, 0, 0];
    this.combinerStageLosses = [0, 0, 0, 0];
    this.combinerStage3State = 'HUNTING_DOUBLE';
    this.combinerStage3LockedDigit = null;
    this.combinerStage3InterveningDigits = [];

    this.fastLastDifferTriggeredMarket = null;

    if (this.watchdogTimer) {
      window.clearTimeout(this.watchdogTimer);
      this.watchdogTimer = null;
    }
    if (this.nextTradeTimer) {
      window.clearTimeout(this.nextTradeTimer);
      this.nextTradeTimer = null;
    }
    if (this.postTradeCountdownTimer) {
      window.clearInterval(this.postTradeCountdownTimer);
      this.postTradeCountdownTimer = null;
    }
    this.postTradeCountdownSec = null;
    this.scanPhase = 'IDLE';
    this.isSettling = false;
    this.lastSettledProfit = null;
    this.lastSettledBalance = null;
    this.lastSettledMarketName = null;
    this.lastSettledTriggerReason = null;
    this.totalWins = 0;
    this.totalLosses = 0;
    this.netProfit = 0;
    this.consecutiveWins = 0;
    this.consecutiveLosses = 0;
    this.maxConsecutiveWins = 0;
    this.maxConsecutiveLosses = 0;
    this.currentCycle = 1;
    this.currentStepInCycle = 0;
    this.activeMarketIndex = 0;
    this.tradedMarketsInCycle.clear();
    this.lastTradedSymbol = null;
    this.lastTradedMarketName = null;
    this.tradeHistory = [];
    this.trackedContractIds.clear();
    this.currentStake = this.config.baseStake;
    this.currentMartingaleStep = 0;
    this.consecutiveWinProfitAccumulator = 0;
    this.previousDifferDigit = null;
    this.activeContractId = null;
    this.activeDifferDigit = null;
    this.activeTriggerReason = null;
    this.activeContractTicks = [];
    this.fastLastDifferTriggeredMarket = null;
    this.marketLastTradeTime.clear();
    this.marketLastTriggerPrice.clear();
    this.isProcessingTrade = false;
    this.statusMessage = 'System Auto Terminal stats and trade history reset.';
    this.notifyStatus();
    this.notifyHistory();
  }

  /**
   * 🎯 Simultaneous All-Markets Scanner Evaluation:
   * Scans all markets in the active pool simultaneously.
   * Any market randomly that triggers the trading pattern (Double Identical digits [d, d]),
   * the bot trades on it.
   * After it closes trade, it continues scanning waiting for another market to get another.
   */
  private evaluateSimultaneousMarketScan(
    incomingMarket: AscendingMarket,
    isIncomingTwin: boolean,
    incomingTwinDigit: number | null,
    incomingQuote: number
  ) {
    if (!this.isRunning || this.isProcessingTrade || this.isSettling || this.activeContractId !== null) {
      return;
    }

    const pool = this.getMarketPool();
    if (pool.length === 0) return;

    // If locked to single specific market, only trade that market
    if (this.config.marketScope === 'SINGLE_SPECIFIC') {
      const targetSymbol = this.config.specificMarketSymbol || 'R_10';
      if (incomingMarket.symbol === targetSymbol && isIncomingTwin && incomingTwinDigit !== null) {
        const targetMarket = ASCENDING_VOLATILITY_MARKETS.find((m) => m.symbol === targetSymbol) || incomingMarket;
        this.handleDoubleIdenticalDetected(targetMarket, incomingTwinDigit, incomingQuote);
      }
      return;
    }

    // Must be a market in the active pool
    const isPoolMarket = pool.some((m) => m.symbol === incomingMarket.symbol);
    if (!isPoolMarket) return;

    // 🎯 1-TRADE SEQUENTIAL SCANNER:
    // If enabled, only execute if THIS incoming tick on incomingMarket triggered the twin pattern.
    // Immediately trade on this market, then pause scanning until contract settles and closes!
    if (this.config.singleTradeSequentialMode) {
      if (!isIncomingTwin || incomingTwinDigit === null) return;
      if (this.lastTradedSymbol && pool.length > 1 && incomingMarket.symbol === this.lastTradedSymbol) {
        return; // Wait for another market to trigger
      }
      const chosenPoolIndex = pool.findIndex((m) => m.symbol === incomingMarket.symbol);
      if (chosenPoolIndex !== -1) {
        this.activeMarketIndex = chosenPoolIndex;
      }
      this.handleDoubleIdenticalDetected(incomingMarket, incomingTwinDigit, incomingQuote);
      return;
    }

    // Collect all markets in the active pool that currently satisfy the pattern
    const qualifyingList: Array<{ market: AscendingMarket; digit: number; price: number }> = [];

    // Check the incoming market if it triggered
    if (isIncomingTwin && incomingTwinDigit !== null) {
      qualifyingList.push({ market: incomingMarket, digit: incomingTwinDigit, price: incomingQuote });
    }

    // Also check other markets in the pool that currently have an active twin pattern
    for (const m of pool) {
      if (m.symbol === incomingMarket.symbol) continue;
      const st = this.marketStates.get(m.symbol);
      if (st?.hasTwinDigit && st.twinDigit !== null && st.price > 0) {
        qualifyingList.push({ market: m, digit: st.twinDigit, price: st.price });
      }
    }

    if (qualifyingList.length === 0) return;

    // 🔄 Post-Trade Market Rotation:
    // "after it closes trade it continues scanning waiting for another market to get another"
    let eligibleCandidates = qualifyingList;
    if (this.lastTradedSymbol && pool.length > 1) {
      const otherMarkets = qualifyingList.filter((q) => q.market.symbol !== this.lastTradedSymbol);
      if (otherMarkets.length > 0) {
        eligibleCandidates = otherMarkets;
      } else {
        // Only the last traded market matches; wait for another market to trigger
        return;
      }
    }

    // 🎲 "any market randomly that triggers the trading pattern the bot trades on it"
    const chosenIndex = Math.floor(Math.random() * eligibleCandidates.length);
    const chosen = eligibleCandidates[chosenIndex];

    // Align active market index for telemetry display
    const chosenPoolIndex = pool.findIndex((m) => m.symbol === chosen.market.symbol);
    if (chosenPoolIndex !== -1) {
      this.activeMarketIndex = chosenPoolIndex;
    }

    this.handleDoubleIdenticalDetected(chosen.market, chosen.digit, chosen.price);
  }

  /**
   * Scans all active markets in the pool immediately (e.g. after settling finishes or at start)
   * to check if any other market is already displaying the pattern.
   */
  private checkAllMarketsForTrigger() {
    if (!this.isRunning || this.isProcessingTrade || this.isSettling || this.activeContractId !== null) return;
    const pool = this.getMarketPool();
    if (pool.length === 0) return;

    const qualifyingList: Array<{ market: AscendingMarket; digit: number; price: number }> = [];
    for (const m of pool) {
      const st = this.marketStates.get(m.symbol);
      if (st?.hasTwinDigit && st.twinDigit !== null && st.price > 0) {
        qualifyingList.push({ market: m, digit: st.twinDigit, price: st.price });
      }
    }

    if (qualifyingList.length === 0) return;

    let eligibleCandidates = qualifyingList;
    if (this.lastTradedSymbol && pool.length > 1) {
      const otherMarkets = qualifyingList.filter((q) => q.market.symbol !== this.lastTradedSymbol);
      if (otherMarkets.length > 0) {
        eligibleCandidates = otherMarkets;
      } else {
        return; // Wait for another market to trigger
      }
    }

    const chosen = eligibleCandidates[Math.floor(Math.random() * eligibleCandidates.length)];
    const chosenPoolIndex = pool.findIndex((m) => m.symbol === chosen.market.symbol);
    if (chosenPoolIndex !== -1) {
      this.activeMarketIndex = chosenPoolIndex;
    }
    this.handleDoubleIdenticalDetected(chosen.market, chosen.digit, chosen.price);
  }

  /**
   * 🎯 Polar Twin [0,0] & [9,9] Scanner Evaluation:
   * Rule Conditions:
   * - Consecutive digits [9, 9] detected ➔ Buy Digit 9 Differ (Differ ≠ 9)
   * - Consecutive digits [0, 0] detected ➔ Buy Digit 0 Differ (Differ ≠ 0)
   * Scans all markets simultaneously in parallel.
   */
  private evaluateTwin0And9Scan(
    incomingMarket: AscendingMarket,
    isIncomingTwin09: boolean,
    incomingTwin09Digit: number | null,
    incomingQuote: number
  ) {
    if (!this.isRunning || this.isProcessingTrade || this.isSettling || this.activeContractId !== null) {
      return;
    }

    const pool = this.getMarketPool();
    if (pool.length === 0) return;

    if (this.config.marketScope === 'SINGLE_SPECIFIC') {
      const targetSymbol = this.config.specificMarketSymbol || 'R_10';
      if (incomingMarket.symbol === targetSymbol && isIncomingTwin09 && (incomingTwin09Digit === 0 || incomingTwin09Digit === 9)) {
        const targetMarket = ASCENDING_VOLATILITY_MARKETS.find((m) => m.symbol === targetSymbol) || incomingMarket;
        this.handleTwin0And9Detected(targetMarket, incomingTwin09Digit, incomingQuote);
      }
      return;
    }

    const isPoolMarket = pool.some((m) => m.symbol === incomingMarket.symbol);
    if (!isPoolMarket) return;

    // 🎯 1-TRADE SEQUENTIAL SCANNER:
    // If enabled, only execute if THIS incoming tick triggered the [0,0] or [9,9] pattern.
    if (this.config.singleTradeSequentialMode) {
      if (!isIncomingTwin09 || (incomingTwin09Digit !== 0 && incomingTwin09Digit !== 9)) return;
      if (this.lastTradedSymbol && pool.length > 1 && incomingMarket.symbol === this.lastTradedSymbol) {
        return; // Wait for another market to trigger
      }
      const chosenPoolIndex = pool.findIndex((m) => m.symbol === incomingMarket.symbol);
      if (chosenPoolIndex !== -1) {
        this.activeMarketIndex = chosenPoolIndex;
      }
      this.handleTwin0And9Detected(incomingMarket, incomingTwin09Digit, incomingQuote);
      return;
    }

    // Collect all markets in active pool currently matching [0,0] or [9,9]
    const qualifyingList: Array<{ market: AscendingMarket; digit: number; price: number }> = [];

    if (isIncomingTwin09 && (incomingTwin09Digit === 0 || incomingTwin09Digit === 9)) {
      qualifyingList.push({ market: incomingMarket, digit: incomingTwin09Digit, price: incomingQuote });
    }

    for (const m of pool) {
      if (m.symbol === incomingMarket.symbol) continue;
      const st = this.marketStates.get(m.symbol);
      if (st?.hasTwin0or9 && (st.twin0or9Digit === 0 || st.twin0or9Digit === 9) && st.price > 0) {
        qualifyingList.push({ market: m, digit: st.twin0or9Digit, price: st.price });
      }
    }

    if (qualifyingList.length === 0) return;

    let eligibleCandidates = qualifyingList;
    if (this.lastTradedSymbol && pool.length > 1) {
      const otherMarkets = qualifyingList.filter((q) => q.market.symbol !== this.lastTradedSymbol);
      if (otherMarkets.length > 0) {
        eligibleCandidates = otherMarkets;
      } else {
        return; // Wait for another market to trigger
      }
    }

    const chosen = eligibleCandidates[Math.floor(Math.random() * eligibleCandidates.length)];
    const chosenPoolIndex = pool.findIndex((m) => m.symbol === chosen.market.symbol);
    if (chosenPoolIndex !== -1) {
      this.activeMarketIndex = chosenPoolIndex;
    }

    this.handleTwin0And9Detected(chosen.market, chosen.digit, chosen.price);
  }

  /**
   * Check all active markets in pool immediately for [0, 0] or [9, 9] polar twins
   */
  private checkAllMarketsForTwin09Trigger() {
    if (!this.isRunning || this.isProcessingTrade || this.isSettling || this.activeContractId !== null) return;
    const pool = this.getMarketPool();
    if (pool.length === 0) return;

    const qualifyingList: Array<{ market: AscendingMarket; digit: number; price: number }> = [];
    for (const m of pool) {
      if (this.config.marketScope === 'SINGLE_SPECIFIC' && m.symbol !== this.config.specificMarketSymbol) continue;
      const st = this.marketStates.get(m.symbol);
      if (st?.hasTwin0or9 && (st.twin0or9Digit === 0 || st.twin0or9Digit === 9) && st.price > 0) {
        qualifyingList.push({ market: m, digit: st.twin0or9Digit, price: st.price });
      }
    }

    if (qualifyingList.length === 0) return;

    let eligibleCandidates = qualifyingList;
    if (this.lastTradedSymbol && pool.length > 1 && this.config.marketScope !== 'SINGLE_SPECIFIC') {
      const otherMarkets = qualifyingList.filter((q) => q.market.symbol !== this.lastTradedSymbol);
      if (otherMarkets.length > 0) {
        eligibleCandidates = otherMarkets;
      } else {
        return;
      }
    }

    const chosen = eligibleCandidates[Math.floor(Math.random() * eligibleCandidates.length)];
    const chosenPoolIndex = pool.findIndex((m) => m.symbol === chosen.market.symbol);
    if (chosenPoolIndex !== -1) {
      this.activeMarketIndex = chosenPoolIndex;
    }
    this.handleTwin0And9Detected(chosen.market, chosen.digit, chosen.price);
  }

  /**
   * Trade execution handler for Polar Twin [0,0] (buy Differ ≠ 0) or [9,9] (buy Differ ≠ 9)
   */
  private handleTwin0And9Detected(market: AscendingMarket, twinDigit: number, quote: number) {
    if (!this.isRunning || this.isProcessingTrade || this.isSettling || this.activeContractId !== null) {
      return;
    }

    const now = Date.now();
    const lastTrade = this.marketLastTradeTime.get(market.symbol) || 0;
    const cooldownMs = (this.config.marketCooldownSec ?? 1) * 1000;
    if (cooldownMs > 0 && now - lastTrade < cooldownMs) return;

    if (this.netProfit >= this.config.takeProfit) {
      this.stopBot(`🎯 Take Profit reached (+${this.netProfit.toFixed(2)} USD >= +${this.config.takeProfit} USD)`);
      soundManager.playWin();
      return;
    }

    if (this.netProfit <= -Math.abs(this.config.stopLoss)) {
      this.stopBot(`⚠️ Stop Loss reached (${this.netProfit.toFixed(2)} USD <= -${this.config.stopLoss} USD)`);
      soundManager.playLoss();
      return;
    }

    if (this.consecutiveLosses >= this.config.maxConsecutiveLosses) {
      this.stopBot(`🛑 Max consecutive losses limit reached (${this.consecutiveLosses} consecutive losses)`);
      soundManager.playLoss();
      return;
    }

    this.isProcessingTrade = true;
    this.scanPhase = 'TRADE_ACTIVE';
    this.isSettling = false;
    this.marketLastTradeTime.set(market.symbol, now);
    this.marketLastTriggerPrice.set(market.symbol, quote);
    this.lastTradeStartTime = performance.now();
    this.activeDifferDigit = twinDigit;
    this.activeContractTicks = [];

    const triggerReason = `Polar Twin [${twinDigit}, ${twinDigit}] on ${market.shortName}`;
    this.activeTriggerReason = triggerReason;
    const duration = this.config.durationTicks || 1;
    const plan = this.getExecutionPlan();

    if (plan.isVirtual) {
      this.statusMessage = `🧪 [DEMO] [${market.shortName}] Polar Twin [${twinDigit}, ${twinDigit}] ➔ Virtual Differ ≠ ${twinDigit} (${duration}t, Demo Stake: $${plan.stakeToUse.toFixed(2)})`;
    } else if (this.config.virtualLossFilterEnabled) {
      this.statusMessage = `🔥 [REAL ACCOUNT] [${market.shortName}] 1 Virtual Loss Confirmed! ➔ REAL Differ ≠ ${twinDigit} (${duration}t, Real Stake: $${plan.stakeToUse.toFixed(2)})`;
    } else {
      this.statusMessage = `⚡ [${market.shortName}] Triggered Polar Twin [${twinDigit}, ${twinDigit}] ➔ Buying Differ ≠ ${twinDigit} (${duration} Tick${duration > 1 ? 's' : ''}, Stake: $${plan.stakeToUse.toFixed(2)})`;
    }
    this.notifyStatus();

    try {
      const contract = derivWS.purchaseContract({
        symbol: market.symbol,
        symbolName: market.name,
        contractType: 'DIGITDIFF',
        stake: plan.stakeToUse,
        durationTicks: duration,
        durationUnit: 't',
        targetDigit: twinDigit,
        forceVirtual: plan.isVirtual,
      });

      if (contract.status === 'CANCELLED') {
        this.isProcessingTrade = false;
        this.scanPhase = 'SCANNING';
        this.activeContractId = null;
        this.statusMessage = `⚠️ Trade shielded/cancelled on ${market.shortName}: Order not sent. Resuming live scan...`;
        this.notifyStatus();
        return;
      }

      if (this.config.virtualLossFilterEnabled && this.virtualModeState === 'REAL_ARMED') {
        this.virtualModeState = 'REAL_ACTIVE';
      }

      this.activeContractId = contract.id;
      this.trackedContractIds.add(contract.id);

      const record: TradeRecord = {
        id: contract.id,
        timestamp: Date.now(),
        timeString: new Date().toLocaleTimeString(),
        symbol: market.symbol,
        marketName: market.shortName,
        differDigit: twinDigit,
        triggerReason: triggerReason,
        twinPattern: `[${twinDigit}, ${twinDigit}]`,
        intermediateDigit: null,
        exitDigit: null,
        stake: plan.stakeToUse,
        profit: 0,
        result: 'OPEN',
        durationTicks: duration,
        entryPrice: contract.entrySpot,
        cycleNumber: this.currentCycle,
        ticksCaptured: [],
        accountType: plan.accountType,
        isVirtual: plan.isVirtual,
      };

      this.tradeHistory.unshift(record);
      if (this.tradeHistory.length > 200) this.tradeHistory.pop();
      this.notifyHistory();
      this.notifyStatus();

      // Arm watchdog timer
      if (this.watchdogTimer) window.clearTimeout(this.watchdogTimer);
      const watchdogTimeoutMs = Math.max(4500, duration * 2500 + 2500);
      this.watchdogTimer = window.setTimeout(() => {
        this.resolveHangingTrade(contract.id, market, twinDigit, triggerReason);
      }, watchdogTimeoutMs);

    } catch (err: any) {
      console.error('Polar Twin Differ purchase failed:', err);
      this.isProcessingTrade = false;
      this.statusMessage = `Trade failed: ${err?.message || 'Error placing contract'}`;
      this.notifyStatus();
    }
  }

  /**
   * 🎯 Alternating Digits Scanner Evaluation:
   * Rule Conditions:
   * 1. Consecutive digits are different (e.g. d3 != d2 && d2 != d1)
   * 2. Alternating Odd/Even pattern (Length 3, e.g. Odd-Even-Odd or Even-Odd-Even)
   * Target Digit: 5 (Differ ≠ 5)
   * Contract: DIGITDIFF (1 Tick Duration)
   * Cooldown: 5s
   */
  private evaluateAlternatingDigitsScan(
    incomingMarket: AscendingMarket,
    recentDigits: number[],
    incomingQuote: number
  ) {
    if (!this.isRunning || this.isProcessingTrade || this.isSettling || this.activeContractId !== null) {
      return;
    }

    const pool = this.getMarketPool();
    if (pool.length === 0) return;

    if (this.config.marketScope === 'SINGLE_SPECIFIC') {
      const targetSymbol = this.config.specificMarketSymbol || 'R_10';
      if (incomingMarket.symbol !== targetSymbol) return;
    } else {
      const isPoolMarket = pool.some((m) => m.symbol === incomingMarket.symbol);
      if (!isPoolMarket) return;
    }

    const isOdd = (n: number) => n % 2 !== 0;
    const targetDigit = this.config.alternatingTargetDigit ?? 5;
    const duration = this.config.durationTicks || 1;

    // Check incoming market
    const len = recentDigits.length;
    let isIncomingMatch = false;
    let incomingPatternStr = '';
    if (len >= 3) {
      const d3 = recentDigits[len - 3];
      const d2 = recentDigits[len - 2];
      const d1 = recentDigits[len - 1];
      const o3 = isOdd(d3);
      const o2 = isOdd(d2);
      const o1 = isOdd(d1);
      if (d3 !== d2 && d2 !== d1 && o3 !== o2 && o2 !== o1) {
        isIncomingMatch = true;
        incomingPatternStr = `[${d3}, ${d2}, ${d1}] (${o3 ? 'Odd-Even-Odd' : 'Even-Odd-Even'})`;
      }
    }

    const qualifyingList: Array<{ market: AscendingMarket; patternStr: string; price: number }> = [];
    if (isIncomingMatch) {
      qualifyingList.push({ market: incomingMarket, patternStr: incomingPatternStr, price: incomingQuote });
    }

    // 🎯 1-TRADE SEQUENTIAL SCANNER:
    // If enabled, only execute if THIS incoming tick triggered the alternating pattern.
    if (this.config.singleTradeSequentialMode) {
      if (!isIncomingMatch) return;
      if (this.lastTradedSymbol && pool.length > 1 && this.config.marketScope !== 'SINGLE_SPECIFIC' && incomingMarket.symbol === this.lastTradedSymbol) {
        return; // Wait for another market to trigger
      }
      const chosenPoolIndex = pool.findIndex((m) => m.symbol === incomingMarket.symbol);
      if (chosenPoolIndex !== -1) {
        this.activeMarketIndex = chosenPoolIndex;
      }
      this.handleAlternatingDigitsDetected(incomingMarket, targetDigit, duration, incomingPatternStr, incomingQuote);
      return;
    }

    // Also check other pool markets
    if (this.config.marketScope !== 'SINGLE_SPECIFIC') {
      for (const m of pool) {
        if (m.symbol === incomingMarket.symbol) continue;
        const st = this.marketStates.get(m.symbol);
        if (st && st.hasAlternatingPattern && st.recentDigits.length >= 3 && st.price > 0) {
          const r = st.recentDigits;
          const l = r.length;
          const d3 = r[l - 3];
          const d2 = r[l - 2];
          const d1 = r[l - 1];
          const o3 = isOdd(d3);
          const pStr = `[${d3}, ${d2}, ${d1}] (${o3 ? 'Odd-Even-Odd' : 'Even-Odd-Even'})`;
          qualifyingList.push({ market: m, patternStr: pStr, price: st.price });
        }
      }
    }

    if (qualifyingList.length === 0) return;

    let eligibleCandidates = qualifyingList;
    if (this.lastTradedSymbol && pool.length > 1 && this.config.marketScope !== 'SINGLE_SPECIFIC') {
      const otherMarkets = qualifyingList.filter((q) => q.market.symbol !== this.lastTradedSymbol);
      if (otherMarkets.length > 0) {
        eligibleCandidates = otherMarkets;
      } else {
        return; // Wait for another market to trigger
      }
    }

    const chosen = eligibleCandidates[Math.floor(Math.random() * eligibleCandidates.length)];
    const chosenPoolIndex = pool.findIndex((m) => m.symbol === chosen.market.symbol);
    if (chosenPoolIndex !== -1) {
      this.activeMarketIndex = chosenPoolIndex;
    }

    this.handleAlternatingDigitsDetected(chosen.market, targetDigit, duration, chosen.patternStr, chosen.price);
  }

  /**
   * Check all pool markets immediately for alternating digits trigger
   */
  private checkAllMarketsForAlternatingTrigger() {
    if (!this.isRunning || this.isProcessingTrade || this.isSettling || this.activeContractId !== null) return;
    const pool = this.getMarketPool();
    if (pool.length === 0) return;

    const isOdd = (n: number) => n % 2 !== 0;
    const targetDigit = this.config.alternatingTargetDigit ?? 5;
    const duration = this.config.durationTicks || 1;

    const qualifyingList: Array<{ market: AscendingMarket; patternStr: string; price: number }> = [];
    for (const m of pool) {
      if (this.config.marketScope === 'SINGLE_SPECIFIC' && m.symbol !== this.config.specificMarketSymbol) continue;
      const st = this.marketStates.get(m.symbol);
      if (st && st.hasAlternatingPattern && st.recentDigits.length >= 3 && st.price > 0) {
        const r = st.recentDigits;
        const l = r.length;
        const d3 = r[l - 3];
        const d2 = r[l - 2];
        const d1 = r[l - 1];
        const o3 = isOdd(d3);
        const pStr = `[${d3}, ${d2}, ${d1}] (${o3 ? 'Odd-Even-Odd' : 'Even-Odd-Even'})`;
        qualifyingList.push({ market: m, patternStr: pStr, price: st.price });
      }
    }

    if (qualifyingList.length === 0) return;

    let eligibleCandidates = qualifyingList;
    if (this.lastTradedSymbol && pool.length > 1 && this.config.marketScope !== 'SINGLE_SPECIFIC') {
      const otherMarkets = qualifyingList.filter((q) => q.market.symbol !== this.lastTradedSymbol);
      if (otherMarkets.length > 0) {
        eligibleCandidates = otherMarkets;
      } else {
        return;
      }
    }

    const chosen = eligibleCandidates[Math.floor(Math.random() * eligibleCandidates.length)];
    const chosenPoolIndex = pool.findIndex((m) => m.symbol === chosen.market.symbol);
    if (chosenPoolIndex !== -1) {
      this.activeMarketIndex = chosenPoolIndex;
    }

    this.handleAlternatingDigitsDetected(chosen.market, targetDigit, duration, chosen.patternStr, chosen.price);
  }

  /**
   * 🎯 Alternating Digits Trade Execution Handler:
   * Executes DIGITDIFF with configured target digit (Default: 5) and duration (Default: 1 tick)
   * Enforces 5s cooldown between trades
   */
  private handleAlternatingDigitsDetected(
    market: AscendingMarket,
    targetDigit: number,
    duration: number,
    patternStr: string,
    quote: number
  ) {
    if (!this.isRunning || this.isProcessingTrade || this.isSettling || this.activeContractId !== null) return;

    // Check cooldown
    const now = Date.now();
    const lastTrade = this.marketLastTradeTime.get(market.symbol) || 0;
    const cooldownMs = (this.config.alternatingCooldownSec ?? 5) * 1000;
    if (cooldownMs > 0 && now - lastTrade < cooldownMs) return;

    // Check risk limits
    if (this.netProfit >= this.config.takeProfit) {
      this.stopBot(`🎯 Take Profit reached (+${this.netProfit.toFixed(2)} USD >= +${this.config.takeProfit} USD)`);
      soundManager.playWin();
      return;
    }

    if (this.netProfit <= -Math.abs(this.config.stopLoss)) {
      this.stopBot(`⚠️ Stop Loss reached (${this.netProfit.toFixed(2)} USD <= -${this.config.stopLoss} USD)`);
      soundManager.playLoss();
      return;
    }

    if (this.consecutiveLosses >= this.config.maxConsecutiveLosses) {
      this.stopBot(`🛑 Max consecutive losses limit reached (${this.consecutiveLosses} consecutive losses)`);
      soundManager.playLoss();
      return;
    }

    this.isProcessingTrade = true;
    this.scanPhase = 'TRADE_ACTIVE';
    this.isSettling = false;
    this.marketLastTradeTime.set(market.symbol, now);
    this.marketLastTriggerPrice.set(market.symbol, quote);
    this.lastTradeStartTime = performance.now();
    this.activeDifferDigit = targetDigit;
    this.activeContractTicks = [];

    const triggerReason = `Alternating ${patternStr} on ${market.shortName}`;
    this.activeTriggerReason = triggerReason;
    const plan = this.getExecutionPlan();

    if (plan.isVirtual) {
      this.statusMessage = `🧪 [DEMO] [${market.shortName}] Alternating Pattern ${patternStr} ➔ Virtual Differ ≠ ${targetDigit} (${duration}t, Demo Stake: $${plan.stakeToUse.toFixed(2)})`;
    } else if (this.config.virtualLossFilterEnabled) {
      this.statusMessage = `🔥 [REAL ACCOUNT] [${market.shortName}] 1 Virtual Loss Confirmed! ➔ REAL Differ ≠ ${targetDigit} (${duration}t, Real Stake: $${plan.stakeToUse.toFixed(2)})`;
    } else {
      this.statusMessage = `⚡ [${market.shortName}] Triggered Alternating Pattern ${patternStr} ➔ Buying DIFF ${targetDigit} (≠${targetDigit}, ${duration} Tick${duration > 1 ? 's' : ''}, Stake: $${plan.stakeToUse.toFixed(2)})`;
    }
    this.notifyStatus();

    try {
      const contract = derivWS.purchaseContract({
        symbol: market.symbol,
        symbolName: market.name,
        contractType: 'DIGITDIFF',
        stake: plan.stakeToUse,
        durationTicks: duration,
        durationUnit: 't',
        targetDigit: targetDigit,
        forceVirtual: plan.isVirtual,
      });

      if (contract.status === 'CANCELLED') {
        this.isProcessingTrade = false;
        this.scanPhase = 'SCANNING';
        this.activeContractId = null;
        this.statusMessage = `⚠️ Trade shielded/cancelled on ${market.shortName}: Order not sent. Resuming live scan...`;
        this.notifyStatus();
        return;
      }

      if (this.config.virtualLossFilterEnabled && this.virtualModeState === 'REAL_ARMED') {
        this.virtualModeState = 'REAL_ACTIVE';
      }

      this.activeContractId = contract.id;
      this.trackedContractIds.add(contract.id);

      const record: TradeRecord = {
        id: contract.id,
        timestamp: Date.now(),
        timeString: new Date().toLocaleTimeString(),
        symbol: market.symbol,
        marketName: market.shortName,
        differDigit: targetDigit,
        triggerReason: triggerReason,
        twinPattern: patternStr,
        intermediateDigit: null,
        exitDigit: null,
        stake: plan.stakeToUse,
        profit: 0,
        result: 'OPEN',
        durationTicks: duration,
        entryPrice: contract.entrySpot,
        cycleNumber: this.currentCycle,
        ticksCaptured: [],
        accountType: plan.accountType,
        isVirtual: plan.isVirtual,
      };

      this.tradeHistory.unshift(record);
      if (this.tradeHistory.length > 200) {
        this.tradeHistory.pop();
      }
      this.notifyHistory();
      this.notifyStatus();

      // Watchdog timer (resolve hanging contract if WebSocket misses end event)
      if (this.watchdogTimer) {
        window.clearTimeout(this.watchdogTimer);
      }
      const watchdogTimeoutMs = Math.max(4500, duration * 2500 + 2500);
      this.watchdogTimer = window.setTimeout(() => {
        this.resolveHangingTrade(contract.id, market, targetDigit, triggerReason);
      }, watchdogTimeoutMs);

      soundManager.playButtonClick();
    } catch (err: any) {
      console.error('Alternating Digits Differ purchase failed:', err);
      this.isProcessingTrade = false;
      this.statusMessage = `Trade failed: ${err?.message || 'Error placing contract'}`;
      this.notifyStatus();
    }
  }

  /**
   * 🎯 Double Bot Scanner Evaluation:
   * Detects pattern [x, x, y] (e.g. 3,3,4 or 5,5,6) where two identical digits
   * are followed by a differing digit 'y'.
   * Buys Digit Differ ≠ y with 1-tick duration (the very next digit settles the trade).
   */
  private evaluateDoubleBotScan(
    market: AscendingMarket,
    hasDoubleBot: boolean,
    targetDigit: number | null,
    digits: number[],
    quote: number
  ) {
    if (!this.isRunning || this.isProcessingTrade || this.isSettling || this.activeContractId !== null) return;
    if (this.config.singleTradeSequentialMode && this.scanPhase !== 'SCANNING') return;

    if (this.config.marketScope === 'SINGLE_SPECIFIC') {
      if (market.symbol !== this.config.specificMarketSymbol) return;
    }

    if (!hasDoubleBot || targetDigit === null || digits.length < 3) return;

    // Check market cooldown
    const now = Date.now();
    const lastTrade = this.marketLastTradeTime.get(market.symbol) || 0;
    const cooldownMs = (this.config.marketCooldownSec ?? 0) * 1000;
    if (cooldownMs > 0 && now - lastTrade < cooldownMs) return;

    const duration = this.config.durationTicks || 1;

    // Diversify across markets if multi-market
    const pool = this.getMarketPool();
    if (this.lastTradedSymbol && pool.length > 1 && this.config.marketScope !== 'SINGLE_SPECIFIC') {
      if (market.symbol === this.lastTradedSymbol) {
        return; // Let another market trigger next
      }
    }

    const poolIndex = pool.findIndex((m) => m.symbol === market.symbol);
    if (poolIndex !== -1) {
      this.activeMarketIndex = poolIndex;
    }

    this.handleDoubleBotDetected(market, targetDigit, duration, digits, quote);
  }

  /**
   * Check all pool markets immediately for Double Bot trigger [x, x, y]
   */
  private checkAllMarketsForDoubleBotTrigger() {
    if (!this.isRunning || this.isProcessingTrade || this.isSettling || this.activeContractId !== null) return;
    const pool = this.getMarketPool();
    if (pool.length === 0) return;

    const duration = this.config.durationTicks || 1;

    const qualifyingList: Array<{
      market: AscendingMarket;
      targetDigit: number;
      digits: number[];
      patternStr: string;
      price: number;
    }> = [];

    for (const m of pool) {
      if (this.config.marketScope === 'SINGLE_SPECIFIC' && m.symbol !== this.config.specificMarketSymbol) continue;
      const st = this.marketStates.get(m.symbol);
      if (
        st &&
        st.hasDoubleBotPattern &&
        st.doubleBotTargetDigit !== null &&
        st.doubleBotDigits &&
        st.doubleBotDigits.length >= 3 &&
        st.price > 0
      ) {
        qualifyingList.push({
          market: m,
          targetDigit: st.doubleBotTargetDigit,
          digits: st.doubleBotDigits,
          patternStr: st.doubleBotPatternStr || `[${st.doubleBotDigits.join(',')}] ➔ Differ ≠ ${st.doubleBotTargetDigit}`,
          price: st.price,
        });
      }
    }

    if (qualifyingList.length === 0) return;

    let eligibleCandidates = qualifyingList;
    if (this.lastTradedSymbol && pool.length > 1 && this.config.marketScope !== 'SINGLE_SPECIFIC') {
      const otherMarkets = qualifyingList.filter((q) => q.market.symbol !== this.lastTradedSymbol);
      if (otherMarkets.length > 0) {
        eligibleCandidates = otherMarkets;
      } else {
        return;
      }
    }

    const chosen = eligibleCandidates[Math.floor(Math.random() * eligibleCandidates.length)];
    const chosenPoolIndex = pool.findIndex((m) => m.symbol === chosen.market.symbol);
    if (chosenPoolIndex !== -1) {
      this.activeMarketIndex = chosenPoolIndex;
    }

    this.handleDoubleBotDetected(chosen.market, chosen.targetDigit, duration, chosen.digits, chosen.price);
  }

  /**
   * 🎯 Double Bot Trade Execution Handler:
   * Places Digit Differ ≠ y on pattern [x, x, y]. 1 tick duration (next digit settles).
   */
  private async handleDoubleBotDetected(
    market: AscendingMarket,
    targetDigit: number,
    duration: number,
    digits: number[],
    quote: number
  ) {
    if (!this.isRunning || this.isProcessingTrade || this.isSettling || this.activeContractId !== null) return;

    const now = Date.now();
    const lastTrade = this.marketLastTradeTime.get(market.symbol) || 0;
    const cooldownMs = (this.config.marketCooldownSec ?? 0) * 1000;
    if (cooldownMs > 0 && now - lastTrade < cooldownMs) return;

    // Check risk limits
    if (this.netProfit >= this.config.takeProfit) {
      this.stopBot(`🎯 Take Profit reached (+${this.netProfit.toFixed(2)} USD >= +${this.config.takeProfit} USD)`);
      soundManager.playWin();
      return;
    }

    if (this.netProfit <= -Math.abs(this.config.stopLoss)) {
      this.stopBot(`⚠️ Stop Loss reached (${this.netProfit.toFixed(2)} USD <= -${this.config.stopLoss} USD)`);
      soundManager.playLoss();
      return;
    }

    if (this.consecutiveLosses >= this.config.maxConsecutiveLosses) {
      this.stopBot(`⚠️ Max consecutive losses (${this.config.maxConsecutiveLosses}) reached. Safe guard engaged.`);
      soundManager.playLoss();
      return;
    }

    const pool = this.getMarketPool();
    this.tradedMarketsInCycle.add(market.symbol);
    if (this.tradedMarketsInCycle.size >= pool.length) {
      this.tradedMarketsInCycle.clear();
      this.currentCycle += 1;
    }

    this.isProcessingTrade = true;
    this.scanPhase = 'TRADE_ACTIVE';
    this.activeDifferDigit = targetDigit;
    const patternStr = `[${digits.join(',')}] ➔ Differ ≠ ${targetDigit}`;
    const triggerReason = `Double Bot Pattern [${digits.join(',')}] ➔ Differ ≠ ${targetDigit} (1 Tick Settle)`;
    this.activeTriggerReason = triggerReason;
    this.activeContractTicks = [];
    this.lastTradedSymbol = market.symbol;
    this.lastTradedMarketName = market.shortName;
    this.marketLastTradeTime.set(market.symbol, now);
    this.marketLastTriggerPrice.set(market.symbol, quote);
    const plan = this.getExecutionPlan();

    if (plan.isVirtual) {
      this.statusMessage = `🧪 [DEMO] [${market.shortName}] Pattern [${digits.join(',')}] ➔ Virtual Differ ≠ ${targetDigit} (${duration}t, Demo Stake: $${plan.stakeToUse.toFixed(2)})`;
    } else if (this.config.virtualLossFilterEnabled) {
      this.statusMessage = `🔥 [REAL ACCOUNT] [${market.shortName}] 1 Virtual Loss Confirmed! ➔ REAL Differ ≠ ${targetDigit} (${duration}t, Real Stake: $${plan.stakeToUse.toFixed(2)})`;
    } else {
      this.statusMessage = `⚡ [${market.shortName}] Triggered Double Bot Pattern [${digits.join(',')}] ➔ Buying DIFF ${targetDigit} (≠${targetDigit}, 1 Tick Settle, Next digit settles)...`;
    }
    this.notifyStatus();

    try {
      const contract = derivWS.purchaseContract({
        symbol: market.symbol,
        symbolName: market.name,
        contractType: 'DIGITDIFF',
        stake: plan.stakeToUse,
        durationTicks: duration,
        durationUnit: 't',
        targetDigit: targetDigit,
        forceVirtual: plan.isVirtual,
      });

      if (contract.status === 'CANCELLED') {
        this.isProcessingTrade = false;
        this.scanPhase = 'SCANNING';
        this.activeContractId = null;
        this.statusMessage = `⚠️ Trade shielded/cancelled on ${market.shortName}: Order not sent. Resuming live scan...`;
        this.notifyStatus();
        return;
      }

      if (this.config.virtualLossFilterEnabled && this.virtualModeState === 'REAL_ARMED') {
        this.virtualModeState = 'REAL_ACTIVE';
      }

      this.activeContractId = contract.id;
      this.trackedContractIds.add(contract.id);

      const record: TradeRecord = {
        id: contract.id,
        timestamp: Date.now(),
        timeString: new Date().toLocaleTimeString(),
        symbol: market.symbol,
        marketName: market.shortName,
        differDigit: targetDigit,
        triggerReason: triggerReason,
        twinPattern: patternStr,
        intermediateDigit: null,
        exitDigit: null,
        stake: plan.stakeToUse,
        profit: 0,
        result: 'OPEN',
        durationTicks: duration,
        entryPrice: contract.entrySpot,
        cycleNumber: this.currentCycle,
        ticksCaptured: [],
        accountType: plan.accountType,
        isVirtual: plan.isVirtual,
      };

      this.tradeHistory.unshift(record);
      if (this.tradeHistory.length > 200) {
        this.tradeHistory.pop();
      }
      this.notifyHistory();
      this.notifyStatus();

      // Watchdog timer (resolve hanging contract if WebSocket misses end event)
      if (this.watchdogTimer) {
        window.clearTimeout(this.watchdogTimer);
      }
      const watchdogTimeoutMs = Math.max(4500, duration * 2500 + 2500);
      this.watchdogTimer = window.setTimeout(() => {
        this.resolveHangingTrade(contract.id, market, targetDigit, triggerReason);
      }, watchdogTimeoutMs);

      soundManager.playButtonClick();
    } catch (err: any) {
      console.error('Double Bot Differ purchase failed:', err);
      this.isProcessingTrade = false;
      this.statusMessage = `Trade failed: ${err?.message || 'Error placing contract'}`;
      this.notifyStatus();
    }
  }

  /**
   * 🎯 Master Double Scanner Evaluation:
   * Detects twin identical digits [d, d] where d is in {0, 1, 2, 3, 4, 5, 6, 7, 8}.
   * When two identical digits appear, it immediately buys Digit Differ of (d + 1).
   * Patterns:
   *  0,0 ➔ Differ ≠ 1
   *  1,1 ➔ Differ ≠ 2
   *  2,2 ➔ Differ ≠ 3
   *  3,3 ➔ Differ ≠ 4
   *  4,4 ➔ Differ ≠ 5
   *  5,5 ➔ Differ ≠ 6
   *  6,6 ➔ Differ ≠ 7
   *  7,7 ➔ Differ ≠ 8
   *  8,8 ➔ Differ ≠ 9
   * (Strictly limited to these patterns and digits only)
   * Duration = 1 tick (immediate next tick settles the trade).
   */
  private evaluateMasterDoubleScan(
    market: AscendingMarket,
    hasMasterDouble: boolean,
    twinDigit: number | null,
    targetDigit: number | null,
    quote: number
  ) {
    if (!this.isRunning || this.isProcessingTrade || this.isSettling || this.activeContractId !== null) return;
    if (this.config.singleTradeSequentialMode && this.scanPhase !== 'SCANNING') return;

    if (this.config.marketScope === 'SINGLE_SPECIFIC') {
      if (market.symbol !== this.config.specificMarketSymbol) return;
    }

    if (!hasMasterDouble || twinDigit === null || targetDigit === null) return;

    // Check market cooldown
    const now = Date.now();
    const lastTrade = this.marketLastTradeTime.get(market.symbol) || 0;
    const cooldownMs = (this.config.marketCooldownSec ?? 0) * 1000;
    if (cooldownMs > 0 && now - lastTrade < cooldownMs) return;

    const duration = this.config.durationTicks || 1;

    // In Multi-Market Pool, wait for another market if this was the last traded market
    const pool = this.getMarketPool();
    if (this.config.marketScope !== 'SINGLE_SPECIFIC' && pool.length > 1 && this.lastTradedSymbol === market.symbol) {
      return;
    }

    this.handleMasterDoubleDetected(market, twinDigit, targetDigit, duration, quote);
  }

  /**
   * Scans all active markets in the pool for active Master Double pattern [d, d] (d <= 8)
   */
  private checkAllMarketsForMasterDoubleTrigger() {
    if (!this.isRunning || this.isProcessingTrade || this.isSettling || this.activeContractId !== null) return;
    const pool = this.getMarketPool();
    if (pool.length === 0) return;

    const qualifyingList: Array<{ market: AscendingMarket; twinDigit: number; targetDigit: number; price: number }> = [];

    for (const m of pool) {
      const st = this.marketStates.get(m.symbol);
      if (st?.hasMasterDoublePattern && st.masterDoubleTwinDigit !== null && st.masterDoubleTargetDigit !== null && st.price > 0) {
        qualifyingList.push({
          market: m,
          twinDigit: st.masterDoubleTwinDigit,
          targetDigit: st.masterDoubleTargetDigit,
          price: st.price,
        });
      }
    }

    if (qualifyingList.length === 0) return;

    let eligibleCandidates = qualifyingList;
    if (this.lastTradedSymbol && pool.length > 1) {
      const otherMarkets = qualifyingList.filter((q) => q.market.symbol !== this.lastTradedSymbol);
      if (otherMarkets.length > 0) {
        eligibleCandidates = otherMarkets;
      } else {
        return;
      }
    }

    const chosen = eligibleCandidates[Math.floor(Math.random() * eligibleCandidates.length)];
    const chosenPoolIndex = pool.findIndex((m) => m.symbol === chosen.market.symbol);
    if (chosenPoolIndex !== -1) {
      this.activeMarketIndex = chosenPoolIndex;
    }

    const duration = this.config.durationTicks || 1;
    this.handleMasterDoubleDetected(chosen.market, chosen.twinDigit, chosen.targetDigit, duration, chosen.price);
  }

  /**
   * Handles Master Double execution on detected [d, d] ➔ Differ ≠ (d + 1)
   */
  private handleMasterDoubleDetected(
    market: AscendingMarket,
    twinDigit: number,
    targetDigit: number,
    duration: number,
    quote: number
  ) {
    if (!this.isRunning || this.isProcessingTrade || this.isSettling || this.activeContractId !== null) return;

    const now = Date.now();
    const lastTrade = this.marketLastTradeTime.get(market.symbol) || 0;
    const cooldownMs = (this.config.marketCooldownSec ?? 0) * 1000;
    if (cooldownMs > 0 && now - lastTrade < cooldownMs) return;

    // Check risk limits
    if (this.config.takeProfit > 0 && this.netProfit >= this.config.takeProfit) {
      this.stopBot('Take Profit target reached! Net Profit: $' + this.netProfit.toFixed(2));
      return;
    }
    if (this.config.stopLoss > 0 && this.netProfit <= -this.config.stopLoss) {
      this.stopBot('Stop Loss limit reached! Net Loss: $' + this.netProfit.toFixed(2));
      return;
    }
    if (this.config.maxConsecutiveLosses && this.consecutiveLosses >= this.config.maxConsecutiveLosses) {
      this.stopBot(`Max consecutive losses (${this.config.maxConsecutiveLosses}) reached!`);
      return;
    }

    this.isProcessingTrade = true;
    this.lastTradeStartTime = performance.now();
    this.marketLastTradeTime.set(market.symbol, now);
    this.marketLastTriggerPrice.set(market.symbol, quote);

    const patternStr = `[${twinDigit}, ${twinDigit}] ➔ ≠${targetDigit}`;
    const triggerReason = `Master Double [${twinDigit}, ${twinDigit}] on ${market.shortName} ➔ Differ ≠ ${targetDigit}`;
    this.activeDifferDigit = targetDigit;
    this.activeTriggerReason = triggerReason;
    this.activeContractTicks = [];

    const plan = this.getExecutionPlan();

    const modeBadge = plan.isVirtual ? '🧪 [VIRTUAL DEMO]' : '⚡ [REAL MONEY]';
    this.statusMessage = `${modeBadge} [${market.shortName}] Master Double [${twinDigit}, ${twinDigit}] Detected ➔ Immediately Buying Differ ≠ ${targetDigit} (${duration}t, Stake: $${plan.stakeToUse.toFixed(2)})... Next digit must not be ${targetDigit}!`;
    this.notifyStatus();

    try {
      const contract = derivWS.purchaseContract({
        symbol: market.symbol,
        symbolName: market.name,
        contractType: 'DIGITDIFF',
        stake: plan.stakeToUse,
        durationTicks: duration,
        durationUnit: 't',
        targetDigit: targetDigit,
        forceVirtual: plan.isVirtual,
      });

      if (contract.status === 'CANCELLED') {
        this.isProcessingTrade = false;
        this.scanPhase = 'SCANNING';
        this.activeContractId = null;
        this.statusMessage = `⚠️ Trade shielded/cancelled on ${market.shortName}: Order not sent. Resuming live scan...`;
        this.notifyStatus();
        return;
      }

      if (this.config.virtualLossFilterEnabled && this.virtualModeState === 'REAL_ARMED') {
        this.virtualModeState = 'REAL_ACTIVE';
      }

      this.activeContractId = contract.id;
      this.trackedContractIds.add(contract.id);

      const record: TradeRecord = {
        id: contract.id,
        timestamp: Date.now(),
        timeString: new Date().toLocaleTimeString(),
        symbol: market.symbol,
        marketName: market.shortName,
        differDigit: targetDigit,
        triggerReason: triggerReason,
        twinPattern: patternStr,
        intermediateDigit: null,
        exitDigit: null,
        stake: plan.stakeToUse,
        profit: 0,
        result: 'OPEN',
        durationTicks: duration,
        entryPrice: contract.entrySpot,
        cycleNumber: this.currentCycle,
        ticksCaptured: [],
        accountType: plan.accountType,
        isVirtual: plan.isVirtual,
      };

      this.tradeHistory.unshift(record);
      if (this.tradeHistory.length > 200) {
        this.tradeHistory.pop();
      }
      this.notifyHistory();
      this.notifyStatus();

      // Watchdog timer (resolve hanging contract if WebSocket misses end event)
      if (this.watchdogTimer) {
        window.clearTimeout(this.watchdogTimer);
      }
      const watchdogTimeoutMs = Math.max(4500, duration * 2500 + 2500);
      this.watchdogTimer = window.setTimeout(() => {
        this.resolveHangingTrade(contract.id, market, targetDigit, triggerReason);
      }, watchdogTimeoutMs);

      soundManager.playButtonClick();
    } catch (err: any) {
      console.error('Master Double Differ purchase failed:', err);
      this.isProcessingTrade = false;
      this.statusMessage = `Trade failed: ${err?.message || 'Error placing contract'}`;
      this.notifyStatus();
    }
  }

  /**
   * 🎯 Master Double [2] Scanner Evaluation:
   * Same logic as Master Double 1, but filters by user's selected patterns (masterDouble2SelectedPatterns).
   * Patterns:
   *  0,0 ➔ Differ ≠ 1
   *  1,1 ➔ Differ ≠ 2
   *  2,2 ➔ Differ ≠ 3
   *  3,3 ➔ Differ ≠ 4
   *  4,4 ➔ Differ ≠ 5
   *  5,5 ➔ Differ ≠ 6
   *  6,6 ➔ Differ ≠ 7
   *  7,7 ➔ Differ ≠ 8
   *  8,8 ➔ Differ ≠ 9
   * (Allows user to select which pattern(s) to trade from the above list)
   */
  private evaluateMasterDouble2Scan(
    market: AscendingMarket,
    hasMasterDouble: boolean,
    twinDigit: number | null,
    targetDigit: number | null,
    quote: number
  ) {
    if (!this.isRunning || this.isProcessingTrade || this.isSettling || this.activeContractId !== null) return;
    if (this.config.singleTradeSequentialMode && this.scanPhase !== 'SCANNING') return;

    if (this.config.marketScope === 'SINGLE_SPECIFIC') {
      if (market.symbol !== this.config.specificMarketSymbol) return;
    }

    if (!hasMasterDouble || twinDigit === null || targetDigit === null) return;

    const allowed = this.config.masterDouble2SelectedPatterns || [0, 1, 2, 3, 4, 5, 6, 7, 8];
    if (!allowed.includes(twinDigit)) return;

    // Check market cooldown
    const now = Date.now();
    const lastTrade = this.marketLastTradeTime.get(market.symbol) || 0;
    const cooldownMs = (this.config.marketCooldownSec ?? 0) * 1000;
    if (cooldownMs > 0 && now - lastTrade < cooldownMs) return;

    const duration = this.config.durationTicks || 1;

    // In Multi-Market Pool, wait for another market if this was the last traded market
    const pool = this.getMarketPool();
    if (this.config.marketScope !== 'SINGLE_SPECIFIC' && pool.length > 1 && this.lastTradedSymbol === market.symbol) {
      return;
    }

    this.handleMasterDouble2Detected(market, twinDigit, targetDigit, duration, quote);
  }

  /**
   * Scans all active markets in the pool for active selected Master Double [2] pattern
   */
  private checkAllMarketsForMasterDouble2Trigger() {
    if (!this.isRunning || this.isProcessingTrade || this.isSettling || this.activeContractId !== null) return;
    const pool = this.getMarketPool();
    if (pool.length === 0) return;

    const allowed = this.config.masterDouble2SelectedPatterns || [0, 1, 2, 3, 4, 5, 6, 7, 8];
    const qualifyingList: Array<{ market: AscendingMarket; twinDigit: number; targetDigit: number; price: number }> = [];

    for (const m of pool) {
      const st = this.marketStates.get(m.symbol);
      if (
        st?.hasMasterDoublePattern &&
        st.masterDoubleTwinDigit !== null &&
        st.masterDoubleTargetDigit !== null &&
        allowed.includes(st.masterDoubleTwinDigit) &&
        st.price > 0
      ) {
        qualifyingList.push({
          market: m,
          twinDigit: st.masterDoubleTwinDigit,
          targetDigit: st.masterDoubleTargetDigit,
          price: st.price,
        });
      }
    }

    if (qualifyingList.length === 0) return;

    let eligibleCandidates = qualifyingList;
    if (this.lastTradedSymbol && pool.length > 1) {
      const otherMarkets = qualifyingList.filter((q) => q.market.symbol !== this.lastTradedSymbol);
      if (otherMarkets.length > 0) {
        eligibleCandidates = otherMarkets;
      } else {
        return;
      }
    }

    const chosen = eligibleCandidates[Math.floor(Math.random() * eligibleCandidates.length)];
    const chosenPoolIndex = pool.findIndex((m) => m.symbol === chosen.market.symbol);
    if (chosenPoolIndex !== -1) {
      this.activeMarketIndex = chosenPoolIndex;
    }

    const duration = this.config.durationTicks || 1;
    this.handleMasterDouble2Detected(chosen.market, chosen.twinDigit, chosen.targetDigit, duration, chosen.price);
  }

  /**
   * Handles Master Double [2] execution on detected [d, d] ➔ Differ ≠ (d + 1)
   */
  private handleMasterDouble2Detected(
    market: AscendingMarket,
    twinDigit: number,
    targetDigit: number,
    duration: number,
    quote: number
  ) {
    if (!this.isRunning || this.isProcessingTrade || this.isSettling || this.activeContractId !== null) return;

    const now = Date.now();
    const lastTrade = this.marketLastTradeTime.get(market.symbol) || 0;
    const cooldownMs = (this.config.marketCooldownSec ?? 0) * 1000;
    if (cooldownMs > 0 && now - lastTrade < cooldownMs) return;

    // Check risk limits
    if (this.config.takeProfit > 0 && this.netProfit >= this.config.takeProfit) {
      this.stopBot('Take Profit target reached! Net Profit: $' + this.netProfit.toFixed(2));
      return;
    }
    if (this.config.stopLoss > 0 && this.netProfit <= -this.config.stopLoss) {
      this.stopBot('Stop Loss limit reached! Net Loss: $' + this.netProfit.toFixed(2));
      return;
    }
    if (this.config.maxConsecutiveLosses && this.consecutiveLosses >= this.config.maxConsecutiveLosses) {
      this.stopBot(`Max consecutive losses (${this.config.maxConsecutiveLosses}) reached!`);
      return;
    }

    this.isProcessingTrade = true;
    this.lastTradeStartTime = performance.now();
    this.marketLastTradeTime.set(market.symbol, now);
    this.marketLastTriggerPrice.set(market.symbol, quote);

    const patternStr = `[${twinDigit}, ${twinDigit}] ➔ ≠${targetDigit}`;
    const triggerReason = `Master Double [2] [${twinDigit}, ${twinDigit}] on ${market.shortName} ➔ Differ ≠ ${targetDigit}`;
    this.activeDifferDigit = targetDigit;
    this.activeTriggerReason = triggerReason;
    this.activeContractTicks = [];

    const plan = this.getExecutionPlan();

    const modeBadge = plan.isVirtual ? '🧪 [VIRTUAL DEMO]' : '⚡ [REAL MONEY]';
    this.statusMessage = `${modeBadge} [${market.shortName}] Master Double [2] [${twinDigit}, ${twinDigit}] Detected ➔ Immediately Buying Differ ≠ ${targetDigit} (${duration}t, Stake: $${plan.stakeToUse.toFixed(2)})... Next digit must not be ${targetDigit}!`;
    this.notifyStatus();

    try {
      const contract = derivWS.purchaseContract({
        symbol: market.symbol,
        symbolName: market.name,
        contractType: 'DIGITDIFF',
        stake: plan.stakeToUse,
        durationTicks: duration,
        durationUnit: 't',
        targetDigit: targetDigit,
        forceVirtual: plan.isVirtual,
      });

      if (contract.status === 'CANCELLED') {
        this.isProcessingTrade = false;
        this.scanPhase = 'SCANNING';
        this.activeContractId = null;
        this.statusMessage = `⚠️ Trade shielded/cancelled on ${market.shortName}: Order not sent. Resuming live scan...`;
        this.notifyStatus();
        return;
      }

      if (this.config.virtualLossFilterEnabled && this.virtualModeState === 'REAL_ARMED') {
        this.virtualModeState = 'REAL_ACTIVE';
      }

      this.activeContractId = contract.id;
      this.trackedContractIds.add(contract.id);

      const record: TradeRecord = {
        id: contract.id,
        timestamp: Date.now(),
        timeString: new Date().toLocaleTimeString(),
        symbol: market.symbol,
        marketName: market.shortName,
        differDigit: targetDigit,
        triggerReason: triggerReason,
        twinPattern: patternStr,
        intermediateDigit: null,
        exitDigit: null,
        stake: plan.stakeToUse,
        profit: 0,
        result: 'OPEN',
        durationTicks: duration,
        entryPrice: contract.entrySpot,
        cycleNumber: this.currentCycle,
        ticksCaptured: [],
        accountType: plan.accountType,
        isVirtual: plan.isVirtual,
      };

      this.tradeHistory.unshift(record);
      if (this.tradeHistory.length > 200) {
        this.tradeHistory.pop();
      }
      this.notifyHistory();
      this.notifyStatus();

      // Watchdog timer (resolve hanging contract if WebSocket misses end event)
      if (this.watchdogTimer) {
        window.clearTimeout(this.watchdogTimer);
      }
      const watchdogTimeoutMs = Math.max(4500, duration * 2500 + 2500);
      this.watchdogTimer = window.setTimeout(() => {
        this.resolveHangingTrade(contract.id, market, targetDigit, triggerReason);
      }, watchdogTimeoutMs);

      soundManager.playButtonClick();
    } catch (err: any) {
      console.error('Master Double [2] Differ purchase failed:', err);
      this.isProcessingTrade = false;
      this.statusMessage = `Trade failed: ${err?.message || 'Error placing contract'}`;
      this.notifyStatus();
    }
  }

  /**
   * 🎯 Double Identical Digit Trigger Handler:
   * Called when any scanned market outputs 2 identical digits in a row (e.g. 3, 3).
   * Buys a Differ contract on that digit with duration = 2 ticks (2nd tick settles the trade).
   */
  private handleDoubleIdenticalDetected(market: AscendingMarket, twinDigit: number, quote: number) {
    if (!this.isRunning || this.isProcessingTrade || this.isSettling || this.activeContractId !== null) return;

    // Check market cooldown (0s by default for instant trading)
    const now = Date.now();
    const lastTrade = this.marketLastTradeTime.get(market.symbol) || 0;
    const cooldownMs = (this.config.marketCooldownSec ?? 0) * 1000;
    if (cooldownMs > 0 && now - lastTrade < cooldownMs) return;

    // Check risk limits
    if (this.netProfit >= this.config.takeProfit) {
      this.stopBot(`🎯 Take Profit reached (+${this.netProfit.toFixed(2)} USD >= +${this.config.takeProfit} USD)`);
      soundManager.playWin();
      return;
    }

    if (this.netProfit <= -Math.abs(this.config.stopLoss)) {
      this.stopBot(`⚠️ Stop Loss reached (${this.netProfit.toFixed(2)} USD <= -${this.config.stopLoss} USD)`);
      soundManager.playLoss();
      return;
    }

    if (this.consecutiveLosses >= this.config.maxConsecutiveLosses) {
      this.stopBot(`🛑 Max consecutive losses limit reached (${this.consecutiveLosses} consecutive losses)`);
      soundManager.playLoss();
      return;
    }

    // Mark trade lock immediately
    this.isProcessingTrade = true;
    this.scanPhase = 'TRADE_ACTIVE';
    this.isSettling = false;
    this.marketLastTradeTime.set(market.symbol, now);
    this.marketLastTriggerPrice.set(market.symbol, quote);
    this.lastTradeStartTime = performance.now();
    this.activeDifferDigit = twinDigit;
    this.activeContractTicks = [];

    const triggerReason = `Twin [${twinDigit}, ${twinDigit}] on ${market.shortName}`;
    this.activeTriggerReason = triggerReason;
    const duration = this.config.durationTicks || 1;
    const plan = this.getExecutionPlan();

    if (plan.isVirtual) {
      this.statusMessage = `🧪 [DEMO] [${market.shortName}] Double Identical [${twinDigit}, ${twinDigit}] ➔ Virtual Differ ≠ ${twinDigit} (${duration}t, Demo Stake: $${plan.stakeToUse.toFixed(2)})`;
    } else if (this.config.virtualLossFilterEnabled) {
      this.statusMessage = `🔥 [REAL ACCOUNT] [${market.shortName}] 1 Virtual Loss Confirmed! ➔ REAL Differ ≠ ${twinDigit} (${duration}t, Real Stake: $${plan.stakeToUse.toFixed(2)})`;
    } else {
      this.statusMessage = `⚡ [${market.shortName}] Triggered Double Identical [${twinDigit}, ${twinDigit}] ➔ Buying DIFF ${twinDigit} (≠${twinDigit}, ${duration} Tick${duration > 1 ? 's' : ' Instant'} Settle, Stake: $${plan.stakeToUse.toFixed(2)})`;
    }
    this.notifyStatus();

    try {
      const contract = derivWS.purchaseContract({
        symbol: market.symbol,
        symbolName: market.name,
        contractType: 'DIGITDIFF',
        stake: plan.stakeToUse,
        durationTicks: duration,
        durationUnit: 't',
        targetDigit: twinDigit,
        forceVirtual: plan.isVirtual,
      });

      if (contract.status === 'CANCELLED') {
        this.isProcessingTrade = false;
        this.scanPhase = 'SCANNING';
        this.activeContractId = null;
        this.statusMessage = `⚠️ Trade shielded/cancelled on ${market.shortName}: Order not sent. Resuming live scan...`;
        this.notifyStatus();
        return;
      }

      if (this.config.virtualLossFilterEnabled && this.virtualModeState === 'REAL_ARMED') {
        this.virtualModeState = 'REAL_ACTIVE';
      }

      this.activeContractId = contract.id;
      this.trackedContractIds.add(contract.id);

      const record: TradeRecord = {
        id: contract.id,
        timestamp: Date.now(),
        timeString: new Date().toLocaleTimeString(),
        symbol: market.symbol,
        marketName: market.shortName,
        differDigit: twinDigit,
        triggerReason: triggerReason,
        twinPattern: `[${twinDigit}, ${twinDigit}]`,
        intermediateDigit: null,
        exitDigit: null,
        stake: plan.stakeToUse,
        profit: 0,
        result: 'OPEN',
        durationTicks: duration,
        entryPrice: contract.entrySpot,
        cycleNumber: this.currentCycle,
        ticksCaptured: [],
        accountType: plan.accountType,
        isVirtual: plan.isVirtual,
      };

      this.tradeHistory.unshift(record);
      if (this.tradeHistory.length > 200) this.tradeHistory.pop();
      this.notifyHistory();
      this.notifyStatus();

      // Arm watchdog timer for 2-tick duration
      if (this.watchdogTimer) window.clearTimeout(this.watchdogTimer);
      const watchdogTimeoutMs = Math.max(4500, duration * 2500 + 2500);
      this.watchdogTimer = window.setTimeout(() => {
        this.resolveHangingTrade(contract.id, market, twinDigit, triggerReason);
      }, watchdogTimeoutMs);

    } catch (err: any) {
      console.error('Double Identical Differ purchase failed:', err);
      this.isProcessingTrade = false;
      this.statusMessage = `Trade failed: ${err?.message || 'Error placing contract'}`;
      this.notifyStatus();
    }
  }

  /**
   * Sequential Ascending Volatility Execution Mode (10 ➔ 100)
   */
  private executeNextMarketTrade() {
    if (!this.isRunning || this.isProcessingTrade || this.isSettling) return;

    if (this.netProfit >= this.config.takeProfit) {
      this.stopBot(`🎯 Take Profit reached (+${this.netProfit.toFixed(2)} USD >= +${this.config.takeProfit} USD)`);
      soundManager.playWin();
      return;
    }

    if (this.netProfit <= -Math.abs(this.config.stopLoss)) {
      this.stopBot(`⚠️ Stop Loss reached (${this.netProfit.toFixed(2)} USD <= -${this.config.stopLoss} USD)`);
      soundManager.playLoss();
      return;
    }

    if (this.consecutiveLosses >= this.config.maxConsecutiveLosses) {
      this.stopBot(`🛑 Max consecutive losses limit reached (${this.consecutiveLosses} consecutive losses)`);
      soundManager.playLoss();
      return;
    }

    const pool = this.getMarketPool();
    if (pool.length === 0) {
      this.stopBot('No markets in active pool.');
      return;
    }

    const targetMarket = pool[this.activeMarketIndex % pool.length];
    const liveState = this.marketStates.get(targetMarket.symbol);

    let differDigit = liveState ? liveState.lastDigit : 0;
    if (differDigit === undefined || !Number.isInteger(differDigit) || differDigit < 0 || differDigit > 9) {
      differDigit = Math.floor(Math.random() * 10);
    }

    if (this.previousDifferDigit !== null && differDigit === this.previousDifferDigit) {
      const altDigit = liveState?.recentDigits?.slice(-5).find((d) => d !== this.previousDifferDigit && Number.isInteger(d) && d >= 0 && d <= 9);
      differDigit = altDigit !== undefined ? altDigit : (differDigit + 1) % 10;
    }
    this.previousDifferDigit = differDigit;

    this.isProcessingTrade = true;
    this.isSettling = false;
    this.lastTradeStartTime = performance.now();
    this.activeDifferDigit = differDigit;
    this.activeTriggerReason = `Ascending Seq on ${targetMarket.shortName}`;
    const duration = this.config.durationTicks || 1;
    const plan = this.getExecutionPlan();

    if (plan.isVirtual) {
      this.statusMessage = `🧪 [DEMO] [${targetMarket.shortName}] Last digit: ${differDigit} ➔ Virtual DIFF ${differDigit} (${duration}t, Demo Stake: $${plan.stakeToUse.toFixed(2)})`;
    } else if (this.config.virtualLossFilterEnabled) {
      this.statusMessage = `🔥 [REAL ACCOUNT] [${targetMarket.shortName}] 1 Virtual Loss Confirmed! ➔ REAL DIFF ${differDigit} (${duration}t, Real Stake: $${plan.stakeToUse.toFixed(2)})`;
    } else {
      this.statusMessage = `⚡ [${targetMarket.shortName}] Last digit: ${differDigit} ➔ Executing DIFF ${differDigit} (Stake: $${plan.stakeToUse.toFixed(2)})`;
    }
    this.notifyStatus();

    try {
      const contract = derivWS.purchaseContract({
        symbol: targetMarket.symbol,
        symbolName: targetMarket.name,
        contractType: 'DIGITDIFF',
        stake: plan.stakeToUse,
        durationTicks: duration,
        durationUnit: 't',
        targetDigit: differDigit,
        forceVirtual: plan.isVirtual,
      });

      if (this.config.virtualLossFilterEnabled && this.virtualModeState === 'REAL_ARMED') {
        this.virtualModeState = 'REAL_ACTIVE';
      }

      this.activeContractId = contract.id;
      this.trackedContractIds.add(contract.id);

      const record: TradeRecord = {
        id: contract.id,
        timestamp: Date.now(),
        timeString: new Date().toLocaleTimeString(),
        symbol: targetMarket.symbol,
        marketName: targetMarket.shortName,
        differDigit: differDigit,
        triggerReason: `Ascending Seq #${this.activeMarketIndex + 1}`,
        exitDigit: null,
        stake: plan.stakeToUse,
        profit: 0,
        result: 'OPEN',
        durationTicks: duration,
        entryPrice: contract.entrySpot,
        cycleNumber: this.currentCycle,
        ticksCaptured: [],
        accountType: plan.accountType,
        isVirtual: plan.isVirtual,
      };

      this.tradeHistory.unshift(record);
      if (this.tradeHistory.length > 200) this.tradeHistory.pop();
      this.notifyHistory();
      this.notifyStatus();

      if (this.watchdogTimer) window.clearTimeout(this.watchdogTimer);
      const watchdogTimeoutMs = Math.max(3500, duration * 2500 + 2000);
      this.watchdogTimer = window.setTimeout(() => {
        this.resolveHangingTrade(contract.id, targetMarket, differDigit, record.triggerReason);
      }, watchdogTimeoutMs);

    } catch (err: any) {
      console.error('System Auto Differ trade purchase failed:', err);
      this.isProcessingTrade = false;
      this.statusMessage = `Trade failed: ${err?.message || 'Error placing contract'}`;
      this.notifyStatus();

      if (this.isRunning) {
        window.setTimeout(() => {
          if (this.isRunning) this.executeNextMarketTrade();
        }, 1500);
      }
    }
  }

  /**
   * 🎯 Digit Select Differ Immediate Execution:
   * Buys a Differ contract on the user-selected digit (Differ ≠ targetDigit)
   * on the user-selected Volatility market immediately upon run.
   * Duration = 1 Tick (Immediate).
   * Trade wins if the immediate next tick's digit is NOT the selected digit!
   */
  public executeDigitSelectDifferTrade() {
    if (!this.isRunning || this.isProcessingTrade || this.isSettling || this.activeContractId !== null) return;

    const targetSymbol = this.config.digitSelectVolatilitySymbol || 'R_100';
    const targetMarket = ASCENDING_VOLATILITY_MARKETS.find((m) => m.symbol === targetSymbol) || ASCENDING_VOLATILITY_MARKETS[0];
    const targetDigit = this.config.digitSelectTargetDigit ?? 5;
    const duration = 1; // 1-tick immediate duration

    // Cooldown check if configured
    const now = Date.now();
    const lastTrade = this.marketLastTradeTime.get(targetMarket.symbol) || 0;
    const cooldownMs = (this.config.marketCooldownSec ?? 0) * 1000;
    if (cooldownMs > 0 && now - lastTrade < cooldownMs) return;

    // Check risk limits
    if (this.netProfit >= this.config.takeProfit) {
      this.stopBot(`🎯 Take Profit reached (+${this.netProfit.toFixed(2)} USD >= +${this.config.takeProfit} USD)`);
      soundManager.playWin();
      return;
    }

    if (this.netProfit <= -Math.abs(this.config.stopLoss)) {
      this.stopBot(`⚠️ Stop Loss reached (${this.netProfit.toFixed(2)} USD <= -${this.config.stopLoss} USD)`);
      soundManager.playLoss();
      return;
    }

    if (this.consecutiveLosses >= this.config.maxConsecutiveLosses) {
      this.stopBot(`🛑 Max consecutive losses limit reached (${this.consecutiveLosses} consecutive losses)`);
      soundManager.playLoss();
      return;
    }

    // Mark locks
    this.isProcessingTrade = true;
    this.scanPhase = 'TRADE_ACTIVE';
    this.isSettling = false;
    this.marketLastTradeTime.set(targetMarket.symbol, now);
    this.lastTradeStartTime = performance.now();
    this.activeDifferDigit = targetDigit;
    this.activeContractTicks = [];

    const triggerReason = `Digit Select Differ ≠ ${targetDigit} on ${targetMarket.shortName}`;
    this.activeTriggerReason = triggerReason;
    const plan = this.getExecutionPlan();

    if (plan.isVirtual) {
      this.statusMessage = `🧪 [DEMO] [${targetMarket.shortName}] Immediate Differ ≠ ${targetDigit} (${duration}t, Demo Stake: $${plan.stakeToUse.toFixed(2)})`;
    } else if (this.config.virtualLossFilterEnabled) {
      this.statusMessage = `🔥 [REAL ACCOUNT] [${targetMarket.shortName}] 1 Virtual Loss Confirmed! ➔ REAL Differ ≠ ${targetDigit} (${duration}t, Real Stake: $${plan.stakeToUse.toFixed(2)})`;
    } else {
      this.statusMessage = `⚡ [${targetMarket.shortName}] Immediate Digit Select Differ: Buying ≠${targetDigit} (1-Tick Immediate Settle, Stake: $${plan.stakeToUse.toFixed(2)})`;
    }
    this.notifyStatus();

    try {
      const contract = derivWS.purchaseContract({
        symbol: targetMarket.symbol,
        symbolName: targetMarket.name,
        contractType: 'DIGITDIFF',
        stake: plan.stakeToUse,
        durationTicks: duration,
        durationUnit: 't',
        targetDigit: targetDigit,
        forceVirtual: plan.isVirtual,
      });

      if (contract.status === 'CANCELLED') {
        this.isProcessingTrade = false;
        this.scanPhase = 'SCANNING';
        this.activeContractId = null;
        this.statusMessage = `⚠️ Trade cancelled on ${targetMarket.shortName}: Order not sent. Resuming...`;
        this.notifyStatus();
        return;
      }

      if (this.config.virtualLossFilterEnabled && this.virtualModeState === 'REAL_ARMED') {
        this.virtualModeState = 'REAL_ACTIVE';
      }

      this.activeContractId = contract.id;
      this.trackedContractIds.add(contract.id);

      const record: TradeRecord = {
        id: contract.id,
        timestamp: Date.now(),
        timeString: new Date().toLocaleTimeString(),
        symbol: targetMarket.symbol,
        marketName: targetMarket.shortName,
        differDigit: targetDigit,
        triggerReason: triggerReason,
        twinPattern: `Selected Digit ≠ ${targetDigit}`,
        intermediateDigit: null,
        exitDigit: null,
        stake: plan.stakeToUse,
        profit: 0,
        result: 'OPEN',
        durationTicks: duration,
        entryPrice: contract.entrySpot,
        cycleNumber: this.currentCycle,
        ticksCaptured: [],
        accountType: plan.accountType,
        isVirtual: plan.isVirtual,
      };

      this.tradeHistory.unshift(record);
      if (this.tradeHistory.length > 200) this.tradeHistory.pop();
      this.notifyHistory();
      this.notifyStatus();

      if (this.watchdogTimer) window.clearTimeout(this.watchdogTimer);
      const watchdogTimeoutMs = Math.max(3500, duration * 2500 + 2000);
      this.watchdogTimer = window.setTimeout(() => {
        this.resolveHangingTrade(contract.id, targetMarket, targetDigit, record.triggerReason);
      }, watchdogTimeoutMs);

    } catch (err: any) {
      console.error('System Auto Digit Select Differ trade purchase failed:', err);
      this.isProcessingTrade = false;
      this.statusMessage = `Trade failed: ${err?.message || 'Error placing contract'}`;
      this.notifyStatus();

      if (this.isRunning) {
        window.setTimeout(() => {
          if (this.isRunning && !this.activeContractId) {
            this.executeDigitSelectDifferTrade();
          }
        }, 2000);
      }
    }
  }

  /**
   * 🎯 Last Digit Differ Execution:
   * Selects the immediate last digit of the user-selected market (e.g. Volatility 25 Index)
   * and trades Differ on that exact immediate digit (Differ ≠ immediateLastDigit).
   * Duration = 1 Tick.
   * The immediate next digit generated will settle the trade!
   */
  public executeLastDigitDifferTrade() {
    if (!this.isRunning || this.isProcessingTrade || this.isSettling || this.activeContractId !== null) return;

    const targetSymbol = this.config.lastDigitDifferMarketSymbol || 'R_25';
    const targetMarket = ASCENDING_VOLATILITY_MARKETS.find((m) => m.symbol === targetSymbol) || ASCENDING_VOLATILITY_MARKETS.find(m => m.symbol === 'R_25') || ASCENDING_VOLATILITY_MARKETS[0];
    const liveState = this.marketStates.get(targetMarket.symbol);
    const immediateDigit = liveState ? liveState.lastDigit : (Number.isInteger(extractDerivLastDigit(liveState?.price || 0, targetMarket.pipSize, targetMarket.symbol)) ? extractDerivLastDigit(liveState?.price || 0, targetMarket.pipSize, targetMarket.symbol) : 5);
    const targetDigit = immediateDigit;
    const duration = 1; // 1-tick immediate duration: next digit generated settles the trade

    // Cooldown check if configured
    const now = Date.now();
    const lastTrade = this.marketLastTradeTime.get(targetMarket.symbol) || 0;
    const cooldownMs = (this.config.marketCooldownSec ?? 0) * 1000;
    if (cooldownMs > 0 && now - lastTrade < cooldownMs) return;

    // Check risk limits
    if (this.netProfit >= this.config.takeProfit) {
      this.stopBot(`🎯 Take Profit reached (+${this.netProfit.toFixed(2)} USD >= +${this.config.takeProfit} USD)`);
      soundManager.playWin();
      return;
    }

    if (this.netProfit <= -Math.abs(this.config.stopLoss)) {
      this.stopBot(`⚠️ Stop Loss reached (${this.netProfit.toFixed(2)} USD <= -${this.config.stopLoss} USD)`);
      soundManager.playLoss();
      return;
    }

    if (this.consecutiveLosses >= this.config.maxConsecutiveLosses) {
      this.stopBot(`🛑 Max consecutive losses limit reached (${this.consecutiveLosses} consecutive losses)`);
      soundManager.playLoss();
      return;
    }

    // Mark locks
    this.isProcessingTrade = true;
    this.scanPhase = 'TRADE_ACTIVE';
    this.isSettling = false;
    this.marketLastTradeTime.set(targetMarket.symbol, now);
    this.lastTradeStartTime = performance.now();
    this.activeDifferDigit = targetDigit;
    this.activeContractTicks = [];

    const triggerReason = `Last Digit Differ ≠ ${targetDigit} on ${targetMarket.shortName} (Immediate Digit [${immediateDigit}])`;
    this.activeTriggerReason = triggerReason;
    const plan = this.getExecutionPlan();

    if (plan.isVirtual) {
      this.statusMessage = `🧪 [DEMO] [${targetMarket.shortName}] Immediate Last Digit [${immediateDigit}] ➔ Virtual Differ ≠ ${targetDigit} (1t, Demo Stake: $${plan.stakeToUse.toFixed(2)})`;
    } else if (this.config.virtualLossFilterEnabled) {
      this.statusMessage = `🔥 [REAL ACCOUNT] [${targetMarket.shortName}] 1 Virtual Loss Confirmed! ➔ REAL Differ ≠ ${targetDigit} (Immediate Digit [${immediateDigit}], 1t, Real Stake: $${plan.stakeToUse.toFixed(2)})`;
    } else {
      this.statusMessage = `⚡ [${targetMarket.shortName}] Last Digit Differ: Immediate Digit is [${immediateDigit}] ➔ Buying Differ ≠ ${targetDigit} (1-Tick Settle, Next digit settles, Stake: $${plan.stakeToUse.toFixed(2)})`;
    }
    this.notifyStatus();

    try {
      const contract = derivWS.purchaseContract({
        symbol: targetMarket.symbol,
        symbolName: targetMarket.name,
        contractType: 'DIGITDIFF',
        stake: plan.stakeToUse,
        durationTicks: duration,
        durationUnit: 't',
        targetDigit: targetDigit,
        forceVirtual: plan.isVirtual,
      });

      if (contract.status === 'CANCELLED') {
        this.isProcessingTrade = false;
        this.scanPhase = 'SCANNING';
        this.activeContractId = null;
        this.statusMessage = `⚠️ Trade cancelled on ${targetMarket.shortName}: Order not sent. Resuming...`;
        this.notifyStatus();
        return;
      }

      if (this.config.virtualLossFilterEnabled && this.virtualModeState === 'REAL_ARMED') {
        this.virtualModeState = 'REAL_ACTIVE';
      }

      this.activeContractId = contract.id;
      this.trackedContractIds.add(contract.id);

      const record: TradeRecord = {
        id: contract.id,
        timestamp: Date.now(),
        timeString: new Date().toLocaleTimeString(),
        symbol: targetMarket.symbol,
        marketName: targetMarket.shortName,
        differDigit: targetDigit,
        triggerReason: triggerReason,
        twinPattern: `Immediate Last Digit: [${immediateDigit}] ➔ Differ ≠ ${targetDigit}`,
        intermediateDigit: null,
        exitDigit: null,
        stake: plan.stakeToUse,
        profit: 0,
        result: 'OPEN',
        durationTicks: duration,
        entryPrice: contract.entrySpot,
        cycleNumber: this.currentCycle,
        ticksCaptured: [],
        accountType: plan.accountType,
        isVirtual: plan.isVirtual,
      };

      this.tradeHistory.unshift(record);
      if (this.tradeHistory.length > 200) this.tradeHistory.pop();
      this.notifyHistory();
      this.notifyStatus();

      if (this.watchdogTimer) window.clearTimeout(this.watchdogTimer);
      const watchdogTimeoutMs = Math.max(3500, duration * 2500 + 2000);
      this.watchdogTimer = window.setTimeout(() => {
        this.resolveHangingTrade(contract.id, targetMarket, targetDigit, record.triggerReason);
      }, watchdogTimeoutMs);

    } catch (err: any) {
      console.error('System Auto Last Digit Differ trade purchase failed:', err);
      this.isProcessingTrade = false;
      this.statusMessage = `Trade failed: ${err?.message || 'Error placing contract'}`;
      this.notifyStatus();

      if (this.isRunning) {
        window.setTimeout(() => {
          if (this.isRunning && !this.activeContractId) {
            this.executeLastDigitDifferTrade();
          }
        }, 2000);
      }
    }
  }

  /**
   * 🎯 Entry Point Differ Execution:
   * Scans the selected market (e.g. Volatility 100 Index, Volatility 25 Index).
   * Has a digit select panel where the user selects which digit to trade differ.
   * Once the selected digit appears on the market, it immediately buys that digit differ (Differ ≠ targetDigit).
   * Duration = 1 Tick.
   * The next digit generated closes and settles the trade!
   */
  public executeEntryPointDifferTrade(market?: AscendingMarket, triggeredDigit?: number) {
    if (!this.isRunning || this.isProcessingTrade || this.isSettling || this.activeContractId !== null) return;

    const targetSymbol = this.config.entryPointMarketSymbol || 'R_100';
    const targetMarket = market || ASCENDING_VOLATILITY_MARKETS.find((m) => m.symbol === targetSymbol) || ASCENDING_VOLATILITY_MARKETS[0];
    const targetDigit = triggeredDigit !== undefined ? triggeredDigit : (this.config.entryPointTargetDigit !== undefined ? this.config.entryPointTargetDigit : 5);
    const duration = 1; // 1-tick duration: next digit generated settles the trade

    // Cooldown check if configured
    const now = Date.now();
    const lastTrade = this.marketLastTradeTime.get(targetMarket.symbol) || 0;
    const cooldownMs = (this.config.marketCooldownSec ?? 0) * 1000;
    if (cooldownMs > 0 && now - lastTrade < cooldownMs) return;

    // 🛡️ Strategy Shield & Anti-Manipulation Checks
    const manipStatus = strategyShield.isManipulationDetected();
    if (manipStatus.detected && strategyShield.isEvasiveHoldActive()) {
      this.statusMessage = `🛡️ [SHIELD] Entry Point Protected: Quote feed delayed (${manipStatus.reason}). Holding evasively...`;
      this.notifyStatus();
      return;
    }

    const profitLock = strategyShield.isProfitLockActive();
    if (profitLock.locked) {
      this.stopBot(`💰 [SHIELD] Profit Secured! ${profitLock.reason}`);
      soundManager.playWin();
      return;
    }

    // Check risk limits
    if (this.netProfit >= this.config.takeProfit) {
      this.stopBot(`🎯 Take Profit reached (+${this.netProfit.toFixed(2)} USD >= +${this.config.takeProfit} USD)`);
      soundManager.playWin();
      return;
    }

    if (this.netProfit <= -Math.abs(this.config.stopLoss)) {
      this.stopBot(`⚠️ Stop Loss reached (${this.netProfit.toFixed(2)} USD <= -${this.config.stopLoss} USD)`);
      soundManager.playLoss();
      return;
    }

    if (this.consecutiveLosses >= this.config.maxConsecutiveLosses) {
      this.stopBot(`🛑 Max consecutive losses limit reached (${this.consecutiveLosses} consecutive losses)`);
      soundManager.playLoss();
      return;
    }

    // Mark locks
    this.isProcessingTrade = true;
    this.scanPhase = 'TRADE_ACTIVE';
    this.isSettling = false;
    this.marketLastTradeTime.set(targetMarket.symbol, now);
    this.lastTradeStartTime = performance.now();
    this.activeDifferDigit = targetDigit;
    this.activeContractTicks = [];

    const triggerReason = `Entry Point Trigger: Digit [${targetDigit}] appeared on ${targetMarket.shortName} ➔ Bought Differ ≠ ${targetDigit} (1-Tick Close)`;
    this.activeTriggerReason = triggerReason;
    const plan = this.getExecutionPlan();

    if (plan.isVirtual) {
      this.statusMessage = `🧪 [DEMO] [${targetMarket.shortName}] Entry Point [${targetDigit}] Appeared ➔ Virtual Differ ≠ ${targetDigit} (1t, Demo Stake: $${plan.stakeToUse.toFixed(2)})`;
    } else if (this.config.virtualLossFilterEnabled) {
      this.statusMessage = `🔥 [REAL ACCOUNT] [${targetMarket.shortName}] Entry Point [${targetDigit}] Appeared! ➔ REAL Differ ≠ ${targetDigit} (1t, Real Stake: $${plan.stakeToUse.toFixed(2)})`;
    } else {
      this.statusMessage = `🎯 [${targetMarket.shortName}] Entry Point [${targetDigit}] Appeared! ➔ Buying Differ ≠ ${targetDigit} (1-Tick Close, Stake: $${plan.stakeToUse.toFixed(2)})`;
    }
    this.notifyStatus();

    try {
      const contract = derivWS.purchaseContract({
        symbol: targetMarket.symbol,
        symbolName: targetMarket.name,
        contractType: 'DIGITDIFF',
        stake: plan.stakeToUse,
        durationTicks: duration,
        durationUnit: 't',
        targetDigit: targetDigit,
        forceVirtual: plan.isVirtual,
      });

      if (contract.status === 'CANCELLED') {
        this.isProcessingTrade = false;
        this.scanPhase = 'SCANNING';
        this.activeContractId = null;
        this.statusMessage = `⚠️ Trade cancelled on ${targetMarket.shortName}: Order not sent. Resuming...`;
        this.notifyStatus();
        return;
      }

      if (this.config.virtualLossFilterEnabled && this.virtualModeState === 'REAL_ARMED') {
        this.virtualModeState = 'REAL_ACTIVE';
      }

      this.activeContractId = contract.id;
      this.trackedContractIds.add(contract.id);

      const record: TradeRecord = {
        id: contract.id,
        timestamp: Date.now(),
        timeString: new Date().toLocaleTimeString(),
        symbol: targetMarket.symbol,
        marketName: targetMarket.shortName,
        differDigit: targetDigit,
        triggerReason: triggerReason,
        twinPattern: `Entry Point: Digit [${targetDigit}] ➔ Differ ≠ ${targetDigit}`,
        intermediateDigit: null,
        exitDigit: null,
        stake: plan.stakeToUse,
        profit: 0,
        result: 'OPEN',
        durationTicks: duration,
        entryPrice: contract.entrySpot,
        cycleNumber: this.currentCycle,
        ticksCaptured: [],
        accountType: plan.accountType,
        isVirtual: plan.isVirtual,
      };

      this.tradeHistory.unshift(record);
      if (this.tradeHistory.length > 200) this.tradeHistory.pop();
      this.notifyHistory();
      this.notifyStatus();

      if (this.watchdogTimer) window.clearTimeout(this.watchdogTimer);
      const watchdogTimeoutMs = Math.max(3500, duration * 2500 + 2000);
      this.watchdogTimer = window.setTimeout(() => {
        this.resolveHangingTrade(contract.id, targetMarket, targetDigit, record.triggerReason);
      }, watchdogTimeoutMs);

    } catch (err: any) {
      console.error('System Auto Entry Point Differ trade purchase failed:', err);
      this.isProcessingTrade = false;
      this.statusMessage = `Trade failed: ${err?.message || 'Error placing contract'}`;
      this.notifyStatus();

      if (this.isRunning) {
        window.setTimeout(() => {
          if (this.isRunning && !this.activeContractId) {
            this.scanPhase = 'SCANNING';
            this.notifyStatus();
          }
        }, 2000);
      }
    }
  }

  /**
   * 🎯 [Digit Marker Bot] Strategy:
   * Scans the selected volatility market. When marked digit appears (e.g. 6),
   * bot immediately buys Differ ≠ markedDigit (1-Tick settle).
   * The immediate next digit settles the trade (e.g. 9 ≠ 6 => WIN)!
   */
  public async executeDigitMarkerDifferTrade(targetMarket: AscendingMarket, targetDigit: number) {
    if (!this.isRunning || this.isProcessingTrade || this.activeContractId !== null) return;
    const now = Date.now();
    const duration = 1;

    // Check profit lock
    const profitLock = strategyShield.isProfitLockActive();
    if (profitLock.locked) {
      this.stopBot(`💰 [SHIELD] Profit Secured! ${profitLock.reason}`);
      soundManager.playWin();
      return;
    }

    // Check risk limits
    if (this.netProfit >= this.config.takeProfit) {
      this.stopBot(`🎯 Take Profit reached (+${this.netProfit.toFixed(2)} USD >= +${this.config.takeProfit} USD)`);
      soundManager.playWin();
      return;
    }

    if (this.netProfit <= -Math.abs(this.config.stopLoss)) {
      this.stopBot(`⚠️ Stop Loss reached (${this.netProfit.toFixed(2)} USD <= -${this.config.stopLoss} USD)`);
      soundManager.playLoss();
      return;
    }

    if (this.consecutiveLosses >= this.config.maxConsecutiveLosses) {
      this.stopBot(`🛑 Max consecutive losses limit reached (${this.consecutiveLosses} consecutive losses)`);
      soundManager.playLoss();
      return;
    }

    // Mark locks
    this.isProcessingTrade = true;
    this.scanPhase = 'TRADE_ACTIVE';
    this.isSettling = false;
    this.marketLastTradeTime.set(targetMarket.symbol, now);
    this.lastTradeStartTime = performance.now();
    this.activeDifferDigit = targetDigit;
    this.activeContractTicks = [];

    // 🛡️ ANTI-TRACKING SUB-TICK JITTER:
    // Randomize entry micro-delay (e.g. +95ms) so Deriv dealing desk cannot detect robotic millisecond triggers
    const jitterDelay = strategyShield.getAntiManipulationDelay();
    if (jitterDelay > 0) {
      this.statusMessage = `🛡️ [ANTI-TRACKING] Applying +${jitterDelay}ms stealth jitter on ${targetMarket.shortName} (Differ ≠ ${targetDigit}). Obfuscating machine cadence...`;
      this.notifyStatus();
      await new Promise((r) => setTimeout(r, jitterDelay));
      if (!this.isRunning) {
        this.isProcessingTrade = false;
        this.scanPhase = 'SCANNING';
        return;
      }
    }

    const triggerReason = `Digit Marker: Marked Digit [${targetDigit}] appeared on ${targetMarket.shortName} ➔ Bought Differ ≠ ${targetDigit} (Immediate 1-Tick Close)`;
    this.activeTriggerReason = triggerReason;
    const plan = this.getExecutionPlan();

    if (plan.isVirtual) {
      this.statusMessage = `🧪 [DEMO] [${targetMarket.shortName}] Digit Marker [${targetDigit}] Appeared ➔ Virtual Differ ≠ ${targetDigit} (1t, Demo Stake: $${plan.stakeToUse.toFixed(2)})`;
    } else if (this.config.virtualLossFilterEnabled) {
      this.statusMessage = `🔥 [REAL ACCOUNT] [${targetMarket.shortName}] Digit Marker [${targetDigit}] Appeared! ➔ REAL Differ ≠ ${targetDigit} (1t, Real Stake: $${plan.stakeToUse.toFixed(2)})`;
    } else {
      this.statusMessage = `🎯 [${targetMarket.shortName}] Digit Marker [${targetDigit}] Appeared! ➔ Buying Differ ≠ ${targetDigit} (Immediate 1-Tick Close, Stake: $${plan.stakeToUse.toFixed(2)})`;
    }
    this.notifyStatus();

    try {
      const contract = derivWS.purchaseContract({
        symbol: targetMarket.symbol,
        symbolName: targetMarket.name,
        contractType: 'DIGITDIFF',
        stake: plan.stakeToUse,
        durationTicks: duration,
        durationUnit: 't',
        targetDigit: targetDigit,
        forceVirtual: plan.isVirtual,
      });

      if (contract.status === 'CANCELLED') {
        this.isProcessingTrade = false;
        this.scanPhase = 'SCANNING';
        this.activeContractId = null;
        this.statusMessage = `⚠️ Trade cancelled on ${targetMarket.shortName}: Order not sent. Resuming...`;
        this.notifyStatus();
        return;
      }

      if (this.config.virtualLossFilterEnabled && this.virtualModeState === 'REAL_ARMED') {
        this.virtualModeState = 'REAL_ACTIVE';
      }

      this.activeContractId = contract.id;
      this.trackedContractIds.add(contract.id);

      const record: TradeRecord = {
        id: contract.id,
        timestamp: Date.now(),
        timeString: new Date().toLocaleTimeString(),
        symbol: targetMarket.symbol,
        marketName: targetMarket.shortName,
        differDigit: targetDigit,
        triggerReason: triggerReason,
        twinPattern: `Digit Marker: [${targetDigit}] ➔ Differ ≠ ${targetDigit}`,
        intermediateDigit: targetDigit,
        exitDigit: null,
        stake: plan.stakeToUse,
        profit: 0,
        result: 'OPEN',
        durationTicks: duration,
        entryPrice: contract.entrySpot,
        cycleNumber: this.currentCycle,
        ticksCaptured: [],
        accountType: plan.accountType,
        isVirtual: plan.isVirtual,
        appliedJitterMs: jitterDelay,
        fuzzedStakeDiff: Number((contract.stake - plan.stakeToUse).toFixed(2)),
      };

      this.tradeHistory.unshift(record);
      if (this.tradeHistory.length > 200) this.tradeHistory.pop();
      this.notifyHistory();
      this.notifyStatus();

      if (this.watchdogTimer) window.clearTimeout(this.watchdogTimer);
      const watchdogTimeoutMs = Math.max(3500, duration * 2500 + 2000);
      this.watchdogTimer = window.setTimeout(() => {
        this.resolveHangingTrade(contract.id, targetMarket, targetDigit, record.triggerReason);
      }, watchdogTimeoutMs);

    } catch (err: any) {
      console.error('System Auto Digit Marker Differ trade purchase failed:', err);
      this.isProcessingTrade = false;
      this.activeContractId = null;
      this.scanPhase = 'SCANNING';
      this.statusMessage = `Trade failed: ${err?.message || 'Error placing contract'}`;
      this.notifyStatus();

      if (this.isRunning) {
        window.setTimeout(() => {
          if (this.isRunning && !this.activeContractId) {
            this.scanPhase = 'SCANNING';
            this.notifyStatus();
          }
        }, 1000);
      }
    }
  }

  /**
   * Directly test-fires a Digit Marker trade on a market with a specific digit
   */
  public triggerManualDigitMarkerDiffer(symbol: MarketSymbol, targetDigit: number) {
    const market = ASCENDING_VOLATILITY_MARKETS.find((m) => m.symbol === symbol) || ASCENDING_VOLATILITY_MARKETS[0];
    this.executeDigitMarkerDifferTrade(market, targetDigit);
  }

  /**
   * 📊 [Range Long Differs] Strategy Scanner:
   * Observes 7 live digits generated [d1..d7] on the selected volatility market.
   * Finds the most appearing digit within the 7 digits.
   * On reaching the 7th digit, automatically buys Differ ≠ most appearing digit (1-tick duration).
   * The 8th digit closes and settles the contract!
   */
  private evaluateRangeLongDiffersTick(market: AscendingMarket, lastDigit: number, quote: number) {
    if (!this.isRunning || this.isProcessingTrade || this.isSettling || this.activeContractId !== null) return;

    const chosenSym = this.config.rangeLongDiffersMarketSymbol || 'R_100';
    if (market.symbol !== chosenSym) return;

    // Append incoming digit to our 7-digit window
    this.rangeLongWindowDigits.push(lastDigit);

    const analysis = this.getRangeLongAnalysis();
    const currentLen = this.rangeLongWindowDigits.length;

    if (currentLen < 7) {
      const leaderDigit = analysis.mostAppearingDigit !== null ? analysis.mostAppearingDigit : lastDigit;
      const leaderCount = analysis.mostAppearingCount > 0 ? analysis.mostAppearingCount : 1;
      const windowStr = this.rangeLongWindowDigits.join(', ');
      this.statusMessage = `📊 [Range Long Differs] Generating 7 digits on [${market.shortName}]: [${windowStr}] (${currentLen}/7). Most appearing: Digit [${leaderDigit}] (${leaderCount}x). Awaiting ${7 - currentLen} more digit${7 - currentLen > 1 ? 's' : ''}...`;
      this.notifyStatus();
      return;
    }

    // Exactly 7 digits reached!
    const targetDigit = analysis.mostAppearingDigit !== null ? analysis.mostAppearingDigit : lastDigit;
    const count = analysis.mostAppearingCount;
    const windowSnapshot = [...this.rangeLongWindowDigits];
    const windowStr = windowSnapshot.join(', ');

    this.statusMessage = `🎯 [Range Long Differs] 7th digit reached! Range: [${windowStr}] ➔ Most appearing digit: [${targetDigit}] (${count}x) ➔ Buying Differ ≠ ${targetDigit} (1-Tick, Settles on 8th digit)...`;
    this.notifyStatus();
    soundManager.playPatternDetected();

    // Reset window so next 7-digit cycle starts clean after trade settlement
    this.rangeLongWindowDigits = [];

    this.executeRangeLongDiffersTrade(market, targetDigit, windowSnapshot, count);
  }

  public async executeRangeLongDiffersTrade(
    targetMarket: AscendingMarket,
    targetDigit: number,
    windowDigits: number[],
    count: number
  ) {
    if (!this.isRunning || this.isProcessingTrade || this.activeContractId !== null) return;
    const now = Date.now();
    const duration = 1;

    // Check profit lock
    const profitLock = strategyShield.isProfitLockActive();
    if (profitLock.locked) {
      this.stopBot(`💰 [SHIELD] Profit Secured! ${profitLock.reason}`);
      soundManager.playWin();
      return;
    }

    // Check risk limits
    if (this.netProfit >= this.config.takeProfit) {
      this.stopBot(`🎯 Take Profit reached (+${this.netProfit.toFixed(2)} USD >= +${this.config.takeProfit} USD)`);
      soundManager.playWin();
      return;
    }

    if (this.netProfit <= -Math.abs(this.config.stopLoss)) {
      this.stopBot(`⚠️ Stop Loss reached (${this.netProfit.toFixed(2)} USD <= -${this.config.stopLoss} USD)`);
      soundManager.playLoss();
      return;
    }

    if (this.consecutiveLosses >= this.config.maxConsecutiveLosses) {
      this.stopBot(`🛑 Max consecutive losses limit reached (${this.consecutiveLosses} consecutive losses)`);
      soundManager.playLoss();
      return;
    }

    // Mark locks
    this.isProcessingTrade = true;
    this.scanPhase = 'TRADE_ACTIVE';
    this.isSettling = false;
    this.marketLastTradeTime.set(targetMarket.symbol, now);
    this.lastTradeStartTime = performance.now();
    this.activeDifferDigit = targetDigit;
    this.activeContractTicks = [];

    // 🛡️ ANTI-TRACKING SUB-TICK JITTER:
    // Randomize entry micro-delay (e.g. +95ms) so Deriv dealing desk cannot detect robotic millisecond triggers
    const jitterDelay = strategyShield.getAntiManipulationDelay();
    if (jitterDelay > 0) {
      this.statusMessage = `🛡️ [ANTI-TRACKING] Applying +${jitterDelay}ms stealth jitter on ${targetMarket.shortName} (Differ ≠ ${targetDigit}). Obfuscating machine cadence...`;
      this.notifyStatus();
      await new Promise((r) => setTimeout(r, jitterDelay));
      if (!this.isRunning) {
        this.isProcessingTrade = false;
        this.scanPhase = 'SCANNING';
        return;
      }
    }

    const seqStr = windowDigits.join(', ');
    const triggerReason = `Range Long Differs: 7-digit range [${seqStr}] had most appearing [${targetDigit}] (${count}x) ➔ Bought Differ ≠ ${targetDigit} (Settles on 8th digit)`;
    this.activeTriggerReason = triggerReason;
    const plan = this.getExecutionPlan();

    if (plan.isVirtual) {
      this.statusMessage = `🧪 [DEMO] [${targetMarket.shortName}] Range Long (7 Digits: [${seqStr}]) ➔ Differ ≠ ${targetDigit} (Demo Stake: $${plan.stakeToUse.toFixed(2)}, Settles on 8th digit)`;
    } else if (this.config.virtualLossFilterEnabled) {
      this.statusMessage = `🔥 [REAL ACCOUNT] [${targetMarket.shortName}] Range Long [${seqStr}] ➔ REAL Differ ≠ ${targetDigit} (Real Stake: $${plan.stakeToUse.toFixed(2)}, Settles on 8th digit)`;
    } else {
      this.statusMessage = `🎯 [${targetMarket.shortName}] Range Long [${seqStr}] ➔ Buying Differ ≠ ${targetDigit} (Stake: $${plan.stakeToUse.toFixed(2)}, Settles on 8th digit)`;
    }
    this.notifyStatus();

    try {
      const contract = derivWS.purchaseContract({
        symbol: targetMarket.symbol,
        symbolName: targetMarket.name,
        contractType: 'DIGITDIFF',
        stake: plan.stakeToUse,
        durationTicks: duration,
        durationUnit: 't',
        targetDigit: targetDigit,
        forceVirtual: plan.isVirtual,
      });

      if (contract.status === 'CANCELLED') {
        this.isProcessingTrade = false;
        this.scanPhase = 'SCANNING';
        this.activeContractId = null;
        this.statusMessage = `⚠️ Trade cancelled on ${targetMarket.shortName}: Order not sent. Resuming...`;
        this.notifyStatus();
        return;
      }

      if (this.config.virtualLossFilterEnabled && this.virtualModeState === 'REAL_ARMED') {
        this.virtualModeState = 'REAL_ACTIVE';
      }

      this.activeContractId = contract.id;
      this.trackedContractIds.add(contract.id);

      const record: TradeRecord = {
        id: contract.id,
        timestamp: Date.now(),
        timeString: new Date().toLocaleTimeString(),
        symbol: targetMarket.symbol,
        marketName: targetMarket.shortName,
        differDigit: targetDigit,
        triggerReason: triggerReason,
        twinPattern: `Range Long [7 Digits]: Most Frequent ≠ ${targetDigit}`,
        intermediateDigit: targetDigit,
        exitDigit: null,
        stake: plan.stakeToUse,
        profit: 0,
        result: 'OPEN',
        durationTicks: duration,
        entryPrice: contract.entrySpot,
        cycleNumber: this.currentCycle,
        ticksCaptured: [],
        accountType: plan.accountType,
        isVirtual: plan.isVirtual,
        appliedJitterMs: jitterDelay,
        fuzzedStakeDiff: Number((contract.stake - plan.stakeToUse).toFixed(2)),
      };

      this.tradeHistory.unshift(record);
      if (this.tradeHistory.length > 200) this.tradeHistory.pop();
      this.notifyHistory();
      this.notifyStatus();

      if (this.watchdogTimer) window.clearTimeout(this.watchdogTimer);
      const watchdogTimeoutMs = Math.max(3500, duration * 2500 + 2000);
      this.watchdogTimer = window.setTimeout(() => {
        this.resolveHangingTrade(contract.id, targetMarket, targetDigit, record.triggerReason);
      }, watchdogTimeoutMs);

    } catch (err: any) {
      console.error('System Auto Range Long Differ trade purchase failed:', err);
      this.isProcessingTrade = false;
      this.activeContractId = null;
      this.scanPhase = 'SCANNING';
      this.statusMessage = `Trade failed: ${err?.message || 'Error placing contract'}`;
      this.notifyStatus();
    }
  }

  /**
   * 🎯 [Double 1 Select] Strategy Scanner:
   * Scans ONLY the selected market.
   * State 1: HUNTING - looks for two identical digits (e.g. 4, 4) or three identical digits (4, 4, 4).
   * Once found, locks that digit (lockedDigit = 4).
   * State 2: WAITING_FOR_REAPPEARANCE - waits for the SAME digit to appear within the next 6 digits.
   * The moment it reappears within 6 digits ➔ immediately buys Differ ≠ lockedDigit (1-Tick settle).
   * Next digit generated closes and settles the contract.
   * Range limit: if 6 digits elapse without the locked digit appearing, pattern expires and bot looks for another pattern!
   */
  private evaluateDouble1SelectScan(market: AscendingMarket, lastDigit: number, quote: number) {
    if (!this.isRunning || this.isProcessingTrade || this.isSettling || this.activeContractId !== null) return;

    const chosenSym = this.config.double1SelectMarketSymbol || 'R_100';
    if (market.symbol !== chosenSym) return;

    const state = this.marketStates.get(market.symbol);
    const recent = state?.recentDigits || [];
    const rangeLimit = this.config.double1SelectMaxDigitsRange ?? 6;

    if (this.double1SelectState === 'HUNTING') {
      // Look for identical consecutive digits at end of stream [d, d] or [d, d, d]
      if (recent.length >= 2) {
        const d1 = recent[recent.length - 1];
        const d2 = recent[recent.length - 2];
        if (d1 === d2) {
          const isTriple = recent.length >= 3 && recent[recent.length - 3] === d1;
          this.double1SelectLockedDigit = d1;
          this.double1SelectInterveningDigits = [];
          this.double1SelectState = 'WAITING_FOR_REAPPEARANCE';
          const patternLabel = isTriple ? `[${d1}, ${d1}, ${d1}]` : `[${d1}, ${d1}]`;
          this.statusMessage = `🔒 [Double 1 Select] Locked Digit [${d1}] from pattern ${patternLabel} on [${market.shortName}]! Waiting for [${d1}] to appear within next ${rangeLimit} digits (0/${rangeLimit} elapsed)...`;
          this.notifyStatus();
          soundManager.playPatternDetected();
          return;
        }
      }

      const recentStr = recent.slice(-6).join(', ');
      this.statusMessage = `🎯 [Double 1 Select] Scanning [${market.shortName}] for twin identical digits [d, d]... Recent: [${recentStr}]`;
      this.notifyStatus();
      return;
    }

    if (this.double1SelectState === 'WAITING_FOR_REAPPEARANCE') {
      const locked = this.double1SelectLockedDigit;
      if (locked === null) {
        this.double1SelectState = 'HUNTING';
        return;
      }

      // Check if current incoming digit is the locked digit
      if (lastDigit === locked) {
        const elapsedCount = this.double1SelectInterveningDigits.length + 1;
        if (elapsedCount <= rangeLimit) {
          // Success! Locked digit reappeared within range
          const trail = [...this.double1SelectInterveningDigits, lastDigit];
          this.statusMessage = `⚡ [Double 1 Select] Digit [${locked}] REAPPEARED on [${market.shortName}] (digit ${elapsedCount}/${rangeLimit}, trail: [${trail.join(', ')}])! ➔ Buying Differ ≠ ${locked} (1-Tick Close)...`;
          this.notifyStatus();

          // Reset tracker before placing trade so fresh pattern starts after settle
          this.double1SelectState = 'HUNTING';
          this.double1SelectLockedDigit = null;
          this.double1SelectInterveningDigits = [];

          this.executeDouble1SelectTrade(market, locked, trail);
          return;
        }
      }

      // Did not match: record intervening digit
      this.double1SelectInterveningDigits.push(lastDigit);

      if (this.double1SelectInterveningDigits.length >= rangeLimit) {
        // Range exceeded without locked digit appearing: expire and look for fresh pattern
        const trail = this.double1SelectInterveningDigits.join(', ');
        this.statusMessage = `🔄 [Double 1 Select] Digit [${locked}] did NOT appear within ${rangeLimit} digits [${trail}]. Range limit reached. Hunting for fresh twin pattern...`;
        this.double1SelectState = 'HUNTING';
        this.double1SelectLockedDigit = null;
        this.double1SelectInterveningDigits = [];
        this.notifyStatus();
        return;
      }

      // Still within the 6-digit range:
      const rem = rangeLimit - this.double1SelectInterveningDigits.length;
      this.statusMessage = `⏳ [Double 1 Select] Pattern [${locked}, ${locked}] ➔ Digits: [${this.double1SelectInterveningDigits.join(', ')}] (${this.double1SelectInterveningDigits.length}/${rangeLimit}). Waiting for [${locked}] (${rem} tick${rem > 1 ? 's' : ''} remaining)...`;
      this.notifyStatus();
    }
  }

  /**
   * 🎯 Execute Double 1 Select Trade:
   * Buys Differ ≠ lockedDigit with 1-tick duration on the selected market.
   * The next digit generated closes and settles the trade.
   */
  public executeDouble1SelectTrade(market: AscendingMarket, targetDigit: number, trailDigits?: number[]) {
    if (!this.isRunning || this.isProcessingTrade || this.isSettling || this.activeContractId !== null) return;

    // Check risk limits
    if (this.netProfit >= this.config.takeProfit) {
      this.stopBot(`🎯 Take Profit reached (+${this.netProfit.toFixed(2)} USD >= +${this.config.takeProfit} USD)`);
      soundManager.playWin();
      return;
    }

    if (this.netProfit <= -Math.abs(this.config.stopLoss)) {
      this.stopBot(`⚠️ Stop Loss reached (${this.netProfit.toFixed(2)} USD <= -${this.config.stopLoss} USD)`);
      soundManager.playLoss();
      return;
    }

    if (this.consecutiveLosses >= this.config.maxConsecutiveLosses) {
      this.stopBot(`🛑 Max consecutive losses limit reached (${this.consecutiveLosses} consecutive losses)`);
      soundManager.playLoss();
      return;
    }

    const manipStatus = strategyShield.isManipulationDetected();
    if (manipStatus.detected && strategyShield.isEvasiveHoldActive()) {
      this.statusMessage = `🛡️ [SHIELD] Double 1 Select: Quote feed delayed (${manipStatus.reason}). Waiting for normalization...`;
      this.notifyStatus();
      return;
    }

    const profitLock = strategyShield.isProfitLockActive();
    if (profitLock.locked) {
      this.stopBot(`💰 [SHIELD] Profit Secured! ${profitLock.reason}`);
      soundManager.playWin();
      return;
    }

    const duration = 1; // 1-tick duration: next digit generated settles the trade
    this.isProcessingTrade = true;
    this.scanPhase = 'TRADE_ACTIVE';
    this.isSettling = false;
    this.marketLastTradeTime.set(market.symbol, Date.now());
    this.lastTradeStartTime = performance.now();
    this.activeDifferDigit = targetDigit;
    this.activeContractTicks = [];

    const trailStr = trailDigits && trailDigits.length > 0 ? ` [${trailDigits.join(', ')}]` : '';
    const triggerReason = `Double 1 Select: [${targetDigit}, ${targetDigit}] ➔ Reappeared${trailStr} ➔ Differ ≠ ${targetDigit} (1-Tick Close)`;
    this.activeTriggerReason = triggerReason;
    const plan = this.getExecutionPlan();

    if (plan.isVirtual) {
      this.statusMessage = `🧪 [DEMO] [${market.shortName}] Double 1 Select: Digit [${targetDigit}] Reappeared ➔ Virtual Differ ≠ ${targetDigit} (1t, Demo Stake: $${plan.stakeToUse.toFixed(2)})`;
    } else if (this.config.virtualLossFilterEnabled) {
      this.statusMessage = `🔥 [REAL ACCOUNT] [${market.shortName}] Double 1 Select: Digit [${targetDigit}] Reappeared! ➔ REAL Differ ≠ ${targetDigit} (1t, Real Stake: $${plan.stakeToUse.toFixed(2)})`;
    } else {
      this.statusMessage = `🎯 [${market.shortName}] Double 1 Select: Digit [${targetDigit}] Reappeared! ➔ Buying Differ ≠ ${targetDigit} (1-Tick Close, Stake: $${plan.stakeToUse.toFixed(2)})`;
    }
    this.notifyStatus();

    try {
      const contract = derivWS.purchaseContract({
        symbol: market.symbol,
        symbolName: market.name,
        contractType: 'DIGITDIFF',
        stake: plan.stakeToUse,
        durationTicks: duration,
        durationUnit: 't',
        targetDigit: targetDigit,
        forceVirtual: plan.isVirtual,
      });

      if (contract.status === 'CANCELLED') {
        this.isProcessingTrade = false;
        this.scanPhase = 'SCANNING';
        this.activeContractId = null;
        this.statusMessage = `⚠️ Trade cancelled on ${market.shortName}: Order not sent. Resuming...`;
        this.notifyStatus();
        return;
      }

      if (this.config.virtualLossFilterEnabled && this.virtualModeState === 'REAL_ARMED') {
        this.virtualModeState = 'REAL_ACTIVE';
      }

      this.activeContractId = contract.id;
      this.trackedContractIds.add(contract.id);

      const record: TradeRecord = {
        id: contract.id,
        timestamp: Date.now(),
        timeString: new Date().toLocaleTimeString(),
        symbol: market.symbol,
        marketName: market.shortName,
        differDigit: targetDigit,
        triggerReason: triggerReason,
        twinPattern: `Double 1 Select: [${targetDigit}, ${targetDigit}] ➔ Reappeared${trailStr} ➔ Differ ≠ ${targetDigit}`,
        intermediateDigit: null,
        exitDigit: null,
        stake: plan.stakeToUse,
        profit: 0,
        result: 'OPEN',
        durationTicks: duration,
        entryPrice: contract.entrySpot,
        cycleNumber: this.currentCycle,
        ticksCaptured: [],
        accountType: plan.accountType,
        isVirtual: plan.isVirtual,
      };

      this.tradeHistory.unshift(record);
      if (this.tradeHistory.length > 200) this.tradeHistory.pop();
      this.notifyHistory();
      this.notifyStatus();

      if (this.watchdogTimer) window.clearTimeout(this.watchdogTimer);
      const watchdogTimeoutMs = Math.max(3500, duration * 2500 + 2000);
      this.watchdogTimer = window.setTimeout(() => {
        this.resolveHangingTrade(contract.id, market, targetDigit, record.triggerReason);
      }, watchdogTimeoutMs);

    } catch (err: any) {
      console.error('System Auto Double 1 Select trade purchase failed:', err);
      this.isProcessingTrade = false;
      this.scanPhase = 'SCANNING';
      this.activeContractId = null;
      this.statusMessage = `Trade failed: ${err?.message || 'Error placing contract'}`;
      this.notifyStatus();

      if (this.isRunning) {
        window.setTimeout(() => {
          if (this.isRunning && !this.activeContractId) {
            this.scanPhase = 'SCANNING';
            this.notifyStatus();
          }
        }, 2000);
      }
    }
  }

  // ============================================================================
  // ⚡ DOUBLE END BOT: PAIR OR THRICE ➔ DIFFER NEXT DIFFERENT DIGIT (1-TICK SETTLE)
  // ============================================================================

  /**
   * 🎯 Double End Bot Scanner Evaluation:
   * "scan a given market and after a pair or thrice digits appears the next different digit is bought as a differ"
   * e.g., 5, 5, 7 ➔ buy digit 7 differ.
   * e.g., 9, 9, 4 ➔ buy digit 4 differ.
   * e.g., 5, 5, 5, 7 ➔ buy digit 7 differ.
   * Next digit settles the trade (1-tick duration).
   */
  private evaluateDoubleEndScan(
    market: AscendingMarket,
    hasDoubleEnd: boolean,
    doubleEndType: 'PAIR' | 'THRICE' | null,
    baseDigit: number | null,
    differTarget: number | null,
    digits: number[],
    quote: number
  ) {
    if (!this.isRunning || this.isProcessingTrade || this.isSettling || this.activeContractId !== null) return;
    if (this.config.singleTradeSequentialMode && this.scanPhase !== 'SCANNING') return;

    const targetSymbol = this.config.doubleEndMarketSymbol || 'R_100';
    if (market.symbol !== targetSymbol) return;

    if (!hasDoubleEnd || !doubleEndType || baseDigit === null || differTarget === null || digits.length < 3) {
      return;
    }

    const mode = this.config.doubleEndPatternMode || 'PAIR_OR_THRICE';
    if (mode === 'PAIR_ONLY' && doubleEndType !== 'PAIR') return;
    if (mode === 'THRICE_ONLY' && doubleEndType !== 'THRICE') return;

    this.doubleEndDetectedPattern = doubleEndType;
    this.doubleEndBaseDigit = baseDigit;
    this.doubleEndDifferTarget = differTarget;
    this.doubleEndDigits = [...digits];

    const targetMarket = ASCENDING_VOLATILITY_MARKETS.find((m) => m.symbol === targetSymbol) || market;
    this.executeDoubleEndTrade(targetMarket, differTarget, baseDigit, doubleEndType, digits);
  }

  /**
   * 🎯 Execute Double End Bot Trade:
   * Places DIGITDIFF contract on differTarget digit with 1-tick duration.
   * The next digit generated closes and settles the contract!
   */
  public async executeDoubleEndTrade(
    targetMarket: AscendingMarket,
    differDigit: number,
    baseDigit: number,
    patternType: 'PAIR' | 'THRICE',
    patternDigits: number[]
  ) {
    if (!this.isRunning || this.isProcessingTrade || this.isSettling || this.activeContractId !== null) return;

    // Check profit lock
    const profitLock = strategyShield.isProfitLockActive();
    if (profitLock.locked) {
      this.stopBot(`💰 [SHIELD] Profit Secured! ${profitLock.reason}`);
      soundManager.playWin();
      return;
    }

    // Check risk limits
    if (this.netProfit >= this.config.takeProfit) {
      this.stopBot(`🎯 Take Profit reached (+${this.netProfit.toFixed(2)} USD >= +${this.config.takeProfit} USD)`);
      soundManager.playWin();
      return;
    }

    if (this.netProfit <= -Math.abs(this.config.stopLoss)) {
      this.stopBot(`⚠️ Stop Loss reached (${this.netProfit.toFixed(2)} USD <= -${this.config.stopLoss} USD)`);
      soundManager.playLoss();
      return;
    }

    if (this.consecutiveLosses >= this.config.maxConsecutiveLosses) {
      this.stopBot(`🛑 Max consecutive losses limit reached (${this.consecutiveLosses} consecutive losses)`);
      soundManager.playLoss();
      return;
    }

    const manipStatus = strategyShield.isManipulationDetected();
    if (manipStatus.detected && strategyShield.isEvasiveHoldActive()) {
      this.statusMessage = `🛡️ [SHIELD] Double End Bot: Quote feed delayed (${manipStatus.reason}). Waiting for normalization...`;
      this.notifyStatus();
      return;
    }

    const duration = 1; // 1-tick duration: next digit generated settles the trade
    this.isProcessingTrade = true;
    this.scanPhase = 'TRADE_ACTIVE';
    this.isSettling = false;
    this.marketLastTradeTime.set(targetMarket.symbol, Date.now());
    this.lastTradeStartTime = performance.now();
    this.activeDifferDigit = differDigit;
    this.activeContractTicks = [];

    // Jitter delay if enabled
    const jitterDelay = strategyShield.getAntiManipulationDelay();
    if (jitterDelay > 0) {
      this.statusMessage = `🛡️ [ANTI-TRACKING] Applying +${jitterDelay}ms stealth jitter on ${targetMarket.shortName} (Differ ≠ ${differDigit}). Obfuscating cadence...`;
      this.notifyStatus();
      await new Promise((r) => setTimeout(r, jitterDelay));
      if (!this.isRunning) {
        this.isProcessingTrade = false;
        this.scanPhase = 'SCANNING';
        return;
      }
    }

    const seqStr = patternDigits.join(', ');
    const typeLabel = patternType === 'THRICE' ? 'Thrice' : 'Pair';
    const triggerReason = `Double End Bot: ${typeLabel} [${baseDigit}] followed by [${differDigit}] (${seqStr}) ➔ Bought Differ ≠ ${differDigit} (Next digit settles)`;
    this.activeTriggerReason = triggerReason;
    const plan = this.getExecutionPlan();

    if (plan.isVirtual) {
      this.statusMessage = `🧪 [DEMO] [${targetMarket.shortName}] ${typeLabel} [${seqStr}] ➔ Virtual Differ ≠ ${differDigit} (1t, Demo Stake: $${plan.stakeToUse.toFixed(2)}, Next digit settles)`;
    } else if (this.config.virtualLossFilterEnabled) {
      this.statusMessage = `🔥 [REAL ACCOUNT] [${targetMarket.shortName}] ${typeLabel} [${seqStr}] ➔ REAL Differ ≠ ${differDigit} (1t, Real Stake: $${plan.stakeToUse.toFixed(2)}, Next digit settles)`;
    } else {
      this.statusMessage = `🎯 [${targetMarket.shortName}] Double End: ${typeLabel} [${seqStr}] ➔ Buying Differ ≠ ${differDigit} (Stake: $${plan.stakeToUse.toFixed(2)}, 1t Settle)`;
    }
    this.notifyStatus();
    soundManager.playPatternDetected();

    try {
      const contract = derivWS.purchaseContract({
        symbol: targetMarket.symbol,
        symbolName: targetMarket.name,
        contractType: 'DIGITDIFF',
        stake: plan.stakeToUse,
        durationTicks: duration,
        durationUnit: 't',
        targetDigit: differDigit,
        forceVirtual: plan.isVirtual,
      });

      if (contract.status === 'CANCELLED') {
        this.isProcessingTrade = false;
        this.scanPhase = 'SCANNING';
        this.activeContractId = null;
        this.statusMessage = `⚠️ Trade cancelled on ${targetMarket.shortName}: Order not sent. Resuming scan...`;
        this.notifyStatus();
        return;
      }

      if (this.config.virtualLossFilterEnabled && this.virtualModeState === 'REAL_ARMED') {
        this.virtualModeState = 'REAL_ACTIVE';
      }

      this.activeContractId = contract.id;
      this.trackedContractIds.add(contract.id);

      const record: TradeRecord = {
        id: contract.id,
        timestamp: Date.now(),
        timeString: new Date().toLocaleTimeString(),
        symbol: targetMarket.symbol,
        marketName: targetMarket.shortName,
        differDigit: differDigit,
        triggerReason: triggerReason,
        twinPattern: `${typeLabel} [${seqStr}] ➔ Differ ≠ ${differDigit}`,
        intermediateDigit: differDigit,
        exitDigit: null,
        stake: plan.stakeToUse,
        profit: 0,
        result: 'OPEN',
        durationTicks: duration,
        entryPrice: contract.entrySpot,
        cycleNumber: this.currentCycle,
        ticksCaptured: [],
        accountType: plan.accountType,
        isVirtual: plan.isVirtual,
        appliedJitterMs: jitterDelay,
        fuzzedStakeDiff: Number((contract.stake - plan.stakeToUse).toFixed(2)),
      };

      this.tradeHistory.unshift(record);
      if (this.tradeHistory.length > 200) this.tradeHistory.pop();
      this.notifyHistory();
      this.notifyStatus();

      if (this.watchdogTimer) window.clearTimeout(this.watchdogTimer);
      const watchdogTimeoutMs = Math.max(3500, duration * 2500 + 2000);
      this.watchdogTimer = window.setTimeout(() => {
        this.resolveHangingTrade(contract.id, targetMarket, differDigit, record.triggerReason);
      }, watchdogTimeoutMs);

    } catch (err: any) {
      console.error('System Auto Double End Differ trade purchase failed:', err);
      this.isProcessingTrade = false;
      this.scanPhase = 'SCANNING';
      this.activeContractId = null;
      this.statusMessage = `Trade failed: ${err?.message || 'Error placing contract'}`;
      this.notifyStatus();
    }
  }

  public triggerManualDoubleEndDiffer(symbol: MarketSymbol, targetDigit: number) {
    const market = ASCENDING_VOLATILITY_MARKETS.find((m) => m.symbol === symbol) || ASCENDING_VOLATILITY_MARKETS[0];
    const live = this.marketStates.get(symbol);
    const recent = live?.recentDigits || [];
    const base = recent.length >= 2 ? recent[recent.length - 2] : 5;
    this.executeDoubleEndTrade(market, targetDigit, base, 'PAIR', [base, base, targetDigit]);
  }

  // ============================================================================
  // ⚡ FAST LAST DIFFER BOT ENGINE
  // ============================================================================

  /**
   * Sets the user's chosen digit for Fast Last Differ (0..9)
   */
  public selectFastLastDifferChosenDigit(digit: number) {
    const valid = Math.max(0, Math.min(9, Math.floor(digit)));
    this.config.fastLastDifferChosenDigit = valid;
    this.saveConfig({ fastLastDifferChosenDigit: valid });
    soundManager.playButtonClick();
    this.statusMessage = `⚡ Fast Last Differ: Chosen digit set to [${valid}]. Bot will scan all markets simultaneously for digit [${valid}].`;
    this.notifyConfig();
    this.notifyStatus();
  }

  /**
   * Evaluates incoming tick across all markets for Fast Last Differ:
   * "this bot when start it scans all market at once and when a chosen digit appears in any of the market
   * it buys that digit differ on that market and the next digit settles the trade.....
   * the first market to produce that selected digit the bot buys that digit differ immediately as it appears."
   */
  private evaluateFastLastDifferScan(
    market: AscendingMarket,
    lastDigit: number,
    quote: number
  ) {
    if (!this.isRunning || this.isProcessingTrade || this.isSettling || this.activeContractId !== null) return;
    if (this.config.singleTradeSequentialMode && this.scanPhase !== 'SCANNING') return;

    const chosenDigit = this.config.fastLastDifferChosenDigit !== undefined ? this.config.fastLastDifferChosenDigit : 5;

    // Check if incoming tick's last digit matches the chosen digit
    if (lastDigit !== chosenDigit) return;

    // First market to produce the selected digit immediately triggers execution!
    this.fastLastDifferTriggeredMarket = market.symbol;
    this.executeFastLastDifferTrade(market, chosenDigit, quote);
  }

  /**
   * 🎯 Execute Fast Last Differ Trade:
   * Buys Digit Differ contract on the chosen digit (Differ ≠ chosenDigit) on the triggering market.
   * Duration = strictly 1 tick (the next digit generated settles the trade).
   */
  public async executeFastLastDifferTrade(
    targetMarket: AscendingMarket,
    targetDigit: number,
    quote: number
  ) {
    if (!this.isRunning || this.isProcessingTrade || this.isSettling || this.activeContractId !== null) return;

    // Check profit lock
    const profitLock = strategyShield.isProfitLockActive();
    if (profitLock.locked) {
      this.stopBot(`💰 [SHIELD] Profit Secured! ${profitLock.reason}`);
      soundManager.playWin();
      return;
    }

    // Check risk limits
    if (this.netProfit >= this.config.takeProfit) {
      this.stopBot(`🎯 Take Profit reached (+${this.netProfit.toFixed(2)} USD >= +${this.config.takeProfit} USD)`);
      soundManager.playWin();
      return;
    }

    if (this.netProfit <= -Math.abs(this.config.stopLoss)) {
      this.stopBot(`⚠️ Stop Loss reached (${this.netProfit.toFixed(2)} USD <= -${this.config.stopLoss} USD)`);
      soundManager.playLoss();
      return;
    }

    if (this.consecutiveLosses >= this.config.maxConsecutiveLosses) {
      this.stopBot(`🛑 Max consecutive losses limit reached (${this.consecutiveLosses} consecutive losses)`);
      soundManager.playLoss();
      return;
    }

    const manipStatus = strategyShield.isManipulationDetected();
    if (manipStatus.detected && strategyShield.isEvasiveHoldActive()) {
      this.statusMessage = `🛡️ [SHIELD] Fast Last Differ: Quote feed delayed (${manipStatus.reason}). Waiting for normalization...`;
      this.notifyStatus();
      return;
    }

    const duration = 1; // 1-tick duration: next digit settles trade
    this.isProcessingTrade = true;
    this.scanPhase = 'TRADE_ACTIVE';
    this.isSettling = false;
    this.marketLastTradeTime.set(targetMarket.symbol, Date.now());
    this.lastTradeStartTime = performance.now();
    this.activeDifferDigit = targetDigit;
    this.activeContractTicks = [];
    this.fastLastDifferTriggeredMarket = targetMarket.symbol;

    // Jitter delay if enabled
    const jitterDelay = strategyShield.getAntiManipulationDelay();
    if (jitterDelay > 0) {
      this.statusMessage = `🛡️ [ANTI-TRACKING] Applying +${jitterDelay}ms stealth jitter on ${targetMarket.shortName} (Fast Differ ≠ ${targetDigit})...`;
      this.notifyStatus();
      await new Promise((r) => setTimeout(r, jitterDelay));
      if (!this.isRunning) {
        this.isProcessingTrade = false;
        this.scanPhase = 'SCANNING';
        return;
      }
    }

    const triggerReason = `Fast Last Differ: Market [${targetMarket.shortName}] produced chosen digit [${targetDigit}] ➔ Bought Differ ≠ ${targetDigit} (1-tick settle)`;
    this.activeTriggerReason = triggerReason;
    const plan = this.getExecutionPlan();

    if (plan.isVirtual) {
      this.statusMessage = `🧪 [DEMO] [${targetMarket.shortName}] Produced [${targetDigit}] ➔ Virtual Differ ≠ ${targetDigit} (1t, Demo Stake: $${plan.stakeToUse.toFixed(2)}, Next digit settles)`;
    } else if (this.config.virtualLossFilterEnabled) {
      this.statusMessage = `🔥 [REAL ACCOUNT] [${targetMarket.shortName}] Produced [${targetDigit}] ➔ REAL Differ ≠ ${targetDigit} (1t, Real Stake: $${plan.stakeToUse.toFixed(2)}, Next digit settles)`;
    } else {
      this.statusMessage = `⚡ [${targetMarket.shortName}] Fast Last Differ: Produced [${targetDigit}] ➔ Buying Differ ≠ ${targetDigit} (Stake: $${plan.stakeToUse.toFixed(2)}, 1t Settle)`;
    }
    this.notifyStatus();
    soundManager.playPatternDetected();

    try {
      const contract = derivWS.purchaseContract({
        symbol: targetMarket.symbol,
        symbolName: targetMarket.name,
        contractType: 'DIGITDIFF',
        stake: plan.stakeToUse,
        durationTicks: duration,
        durationUnit: 't',
        targetDigit: targetDigit,
        forceVirtual: plan.isVirtual,
      });

      if (contract.status === 'CANCELLED') {
        this.isProcessingTrade = false;
        this.scanPhase = 'SCANNING';
        this.activeContractId = null;
        this.statusMessage = `⚠️ Trade cancelled on ${targetMarket.shortName}: Order not sent. Resuming scan...`;
        this.notifyStatus();
        return;
      }

      if (this.config.virtualLossFilterEnabled && this.virtualModeState === 'REAL_ARMED') {
        this.virtualModeState = 'REAL_ACTIVE';
      }

      this.activeContractId = contract.id;
      this.trackedContractIds.add(contract.id);

      const record: TradeRecord = {
        id: contract.id,
        timestamp: Date.now(),
        timeString: new Date().toLocaleTimeString(),
        symbol: targetMarket.symbol,
        marketName: targetMarket.shortName,
        differDigit: targetDigit,
        triggerReason: triggerReason,
        twinPattern: `Fast Last Differ [${targetMarket.shortName}] ➔ Differ ≠ ${targetDigit}`,
        intermediateDigit: targetDigit,
        exitDigit: null,
        stake: plan.stakeToUse,
        profit: 0,
        result: 'OPEN',
        durationTicks: duration,
        entryPrice: contract.entrySpot,
        cycleNumber: this.currentCycle,
        ticksCaptured: [],
        accountType: plan.accountType,
        isVirtual: plan.isVirtual,
        appliedJitterMs: jitterDelay,
        fuzzedStakeDiff: Number((contract.stake - plan.stakeToUse).toFixed(2)),
      };

      this.tradeHistory.unshift(record);
      if (this.tradeHistory.length > 200) this.tradeHistory.pop();
      this.notifyHistory();
      this.notifyStatus();

      if (this.watchdogTimer) window.clearTimeout(this.watchdogTimer);
      const watchdogTimeoutMs = Math.max(3500, duration * 2500 + 2000);
      this.watchdogTimer = window.setTimeout(() => {
        this.resolveHangingTrade(contract.id, targetMarket, targetDigit, record.triggerReason);
      }, watchdogTimeoutMs);

    } catch (err: any) {
      console.error('System Auto Fast Last Differ trade purchase failed:', err);
      this.isProcessingTrade = false;
      this.scanPhase = 'SCANNING';
      this.activeContractId = null;
      this.statusMessage = `Trade failed: ${err?.message || 'Error placing contract'}`;
      this.notifyStatus();
    }
  }

  /**
   * Manual test trigger for Fast Last Differ
   */
  public triggerManualFastLastDiffer(targetDigit?: number, customSymbol?: MarketSymbol) {
    const digitToDiffer = targetDigit !== undefined ? targetDigit : (this.config.fastLastDifferChosenDigit ?? 5);
    const sym = customSymbol || 'R_100';
    const market = ASCENDING_VOLATILITY_MARKETS.find((m) => m.symbol === sym) || ASCENDING_VOLATILITY_MARKETS[0];
    const live = this.marketStates.get(market.symbol);
    const price = live?.price ?? 100;
    this.executeFastLastDifferTrade(market, digitToDiffer, price);
  }

  // ============================================================================
  // 🧩 COMBINER BOT: MULTI-STRATEGY ASCENDING LADDER ENGINE
  // ============================================================================

  /**
   * Returns assigned market symbol for a given combiner stage (1..4)
   */
  public getCombinerMarketForStage(stage: 1 | 2 | 3 | 4): MarketSymbol {
    switch (stage) {
      case 1:
        return this.config.combinerStage1Market || 'R_10';
      case 2:
        return this.config.combinerStage2Market || 'R_25';
      case 3:
        return this.config.combinerStage3Market || 'R_50';
      case 4:
        return this.config.combinerStage4Market || 'R_100';
    }
  }

  /**
   * Assign a market symbol to a specific combiner stage (1..4)
   */
  public setCombinerStageMarket(stage: 1 | 2 | 3 | 4, symbol: MarketSymbol) {
    if (stage === 1) this.config.combinerStage1Market = symbol;
    else if (stage === 2) this.config.combinerStage2Market = symbol;
    else if (stage === 3) this.config.combinerStage3Market = symbol;
    else if (stage === 4) this.config.combinerStage4Market = symbol;
    this.saveConfig(this.config);
    soundManager.playButtonClick();
    const m = ASCENDING_VOLATILITY_MARKETS.find((mk) => mk.symbol === symbol);
    this.statusMessage = `🧩 Combiner Stage ${stage} assigned to [${m?.shortName || symbol}].`;
    this.notifyStatus();
  }

  /**
   * Auto-sorts selected combiner markets in ascending volatility order
   */
  public sortCombinerMarketsAscending() {
    const m1 = this.config.combinerStage1Market || 'R_10';
    const m2 = this.config.combinerStage2Market || 'R_25';
    const m3 = this.config.combinerStage3Market || 'R_50';
    const m4 = this.config.combinerStage4Market || 'R_100';

    const syms = [m1, m2, m3, m4];
    const sorted = [...syms].sort((a, b) => {
      const ma = ASCENDING_VOLATILITY_MARKETS.find((m) => m.symbol === a);
      const mb = ASCENDING_VOLATILITY_MARKETS.find((m) => m.symbol === b);
      const volA = ma ? ma.volatility + (ma.isOneSecond ? 0.5 : 0) : 0;
      const volB = mb ? mb.volatility + (mb.isOneSecond ? 0.5 : 0) : 0;
      return volA - volB;
    });

    this.config.combinerStage1Market = sorted[0];
    this.config.combinerStage2Market = sorted[1];
    this.config.combinerStage3Market = sorted[2];
    this.config.combinerStage4Market = sorted[3];
    this.saveConfig(this.config);
    soundManager.playButtonClick();
    const sNames = sorted.map((s) => ASCENDING_VOLATILITY_MARKETS.find((m) => m.symbol === s)?.shortName || s);
    this.statusMessage = `🔀 Combiner Markets auto-sorted ascending: Stage 1 [${sNames[0]}] ➔ Stage 2 [${sNames[1]}] ➔ Stage 3 [${sNames[2]}] ➔ Stage 4 [${sNames[3]}]`;
    this.notifyStatus();
  }

  /**
   * Jump or force active stage in Combiner Bot (1..4)
   */
  public setCombinerStage(stage: 1 | 2 | 3 | 4) {
    this.combinerCurrentStage = stage;
    if (stage !== 3) {
      this.combinerStage3State = 'HUNTING_DOUBLE';
      this.combinerStage3LockedDigit = null;
      this.combinerStage3InterveningDigits = [];
    }
    soundManager.playButtonClick();
    const sym = this.getCombinerMarketForStage(stage);
    const m = ASCENDING_VOLATILITY_MARKETS.find((mk) => mk.symbol === sym);
    this.statusMessage = `📍 Combiner forced to Stage ${stage} on [${m?.shortName || sym}].`;
    this.notifyStatus();
  }

  /**
   * Reset combiner cycle and stage statistics
   */
  public resetCombinerStats() {
    this.combinerCurrentStage = 1;
    this.combinerCycleCount = 1;
    this.combinerStageWins = [0, 0, 0, 0];
    this.combinerStageLosses = [0, 0, 0, 0];
    this.combinerStage3State = 'HUNTING_DOUBLE';
    this.combinerStage3LockedDigit = null;
    this.combinerStage3InterveningDigits = [];
    soundManager.playButtonClick();
    this.statusMessage = '🔄 Combiner Bot cycles and stage statistics reset.';
    this.notifyStatus();
  }

  /**
   * 🧩 [Combiner Bot] Strategy Scanner:
   * Evaluates incoming ticks and matches pattern for the active stage.
   * - Stage 1 (Market 1): pattern [x, x, y] ➔ differ digit y
   * - Stage 2 (Market 2): pattern [x, y, x, x] ➔ differ digit x
   * - Stage 3 (Market 3): double [x, x] appears ➔ lock x ➔ wait reappearance ➔ differ digit x
   * - Stage 4 (Market 4): differ the last digit
   */
  private evaluateCombinerScan(market: AscendingMarket, lastDigit: number, quote: number) {
    if (!this.isRunning || this.isProcessingTrade || this.isSettling || this.activeContractId !== null) return;
    if (this.config.singleTradeSequentialMode && this.scanPhase !== 'SCANNING') return;

    const currentStage = this.combinerCurrentStage || 1;
    const stageMarketSym = this.getCombinerMarketForStage(currentStage);

    if (market.symbol !== stageMarketSym) return;

    const state = this.marketStates.get(market.symbol);
    const recent = state?.recentDigits || [];

    // Stage 1: [x, x, y] differ digit y
    if (currentStage === 1) {
      if (recent.length >= 3) {
        const d3 = recent[recent.length - 3]; // x
        const d2 = recent[recent.length - 2]; // x
        const d1 = recent[recent.length - 1]; // y
        if (d3 === d2 && d1 !== d2) {
          this.executeCombinerTrade(
            market,
            1,
            d1,
            [d3, d2, d1],
            `Combiner Stage 1 [${market.shortName}]: Pattern [${d3}, ${d2}, ${d1}] (x,x,y) ➔ Differ ≠ ${d1}`
          );
          return;
        }
      }
      return;
    }

    // Stage 2: [x, y, x, x] differ digit x
    if (currentStage === 2) {
      if (recent.length >= 4) {
        const d4 = recent[recent.length - 4]; // x
        const d3 = recent[recent.length - 3]; // y
        const d2 = recent[recent.length - 2]; // x
        const d1 = recent[recent.length - 1]; // x
        if (d4 === d2 && d2 === d1 && d3 !== d4) {
          this.executeCombinerTrade(
            market,
            2,
            d1,
            [d4, d3, d2, d1],
            `Combiner Stage 2 [${market.shortName}]: Pattern [${d4}, ${d3}, ${d2}, ${d1}] (x,y,x,x) ➔ Differ ≠ ${d1}`
          );
          return;
        }
      }
      return;
    }

    // Stage 3: Double [x, x] locks x ➔ waits for reappearance ➔ differ digit x
    if (currentStage === 3) {
      if (this.combinerStage3State === 'HUNTING_DOUBLE') {
        if (recent.length >= 2) {
          const d2 = recent[recent.length - 2];
          const d1 = recent[recent.length - 1];
          if (d2 === d1) {
            this.combinerStage3LockedDigit = d1;
            this.combinerStage3InterveningDigits = [];
            this.combinerStage3State = 'LOCKED_WAITING_FOR_REAPPEARANCE';
            this.statusMessage = `🔒 Combiner Stage 3 [${market.shortName}]: Locked double [${d1}, ${d1}]! Watching for digit [${d1}] to reappear ➔ then Differ ≠ ${d1}...`;
            this.notifyStatus();
            soundManager.playPatternDetected();
            return;
          }
        }
        return;
      }

      if (this.combinerStage3State === 'LOCKED_WAITING_FOR_REAPPEARANCE') {
        const locked = this.combinerStage3LockedDigit;
        if (locked === null) {
          this.combinerStage3State = 'HUNTING_DOUBLE';
          return;
        }

        if (lastDigit === locked) {
          const trail = [...this.combinerStage3InterveningDigits, lastDigit];
          this.combinerStage3State = 'HUNTING_DOUBLE';
          this.combinerStage3LockedDigit = null;
          this.combinerStage3InterveningDigits = [];
          this.executeCombinerTrade(
            market,
            3,
            locked,
            trail,
            `Combiner Stage 3 [${market.shortName}]: Double [${locked},${locked}] locked ➔ Reappeared [${lastDigit}] ➔ Differ ≠ ${locked}`
          );
          return;
        } else {
          this.combinerStage3InterveningDigits.push(lastDigit);
          const maxWait = this.config.combinerStage3MaxWaitTicks ?? 20;
          if (maxWait > 0 && this.combinerStage3InterveningDigits.length >= maxWait) {
            this.combinerStage3State = 'HUNTING_DOUBLE';
            this.combinerStage3LockedDigit = null;
            this.combinerStage3InterveningDigits = [];
            this.statusMessage = `🔄 Combiner Stage 3 [${market.shortName}]: Timeout (${maxWait} ticks). Hunting fresh double [x,x]...`;
            this.notifyStatus();
          } else {
            this.statusMessage = `⏳ Combiner Stage 3 [${market.shortName}]: Locked [${locked}]. Intervening: [${this.combinerStage3InterveningDigits.join(', ')}]. Waiting for [${locked}]...`;
            this.notifyStatus();
          }
          return;
        }
      }
      return;
    }

    // Stage 4: Differ last digit
    if (currentStage === 4) {
      this.executeCombinerTrade(
        market,
        4,
        lastDigit,
        [lastDigit],
        `Combiner Stage 4 [${market.shortName}]: Differ Last Digit [${lastDigit}] ➔ Differ ≠ ${lastDigit}`
      );
      return;
    }
  }

  /**
   * Executes a Differ trade for the active Combiner Bot stage
   */
  public async executeCombinerTrade(
    targetMarket: AscendingMarket,
    stageNum: 1 | 2 | 3 | 4,
    targetDigit: number,
    patternDigits: number[],
    customReason?: string
  ) {
    if (!this.isRunning || this.isProcessingTrade || this.activeContractId !== null) return;
    const now = Date.now();
    const duration = 1;

    // Check risk limits
    if (this.netProfit >= this.config.takeProfit) {
      this.stopBot(`🎯 Take Profit reached (+${this.netProfit.toFixed(2)} USD >= +${this.config.takeProfit} USD)`);
      soundManager.playWin();
      return;
    }

    if (this.netProfit <= -Math.abs(this.config.stopLoss)) {
      this.stopBot(`⚠️ Stop Loss reached (${this.netProfit.toFixed(2)} USD <= -${this.config.stopLoss} USD)`);
      soundManager.playLoss();
      return;
    }

    if (this.consecutiveLosses >= this.config.maxConsecutiveLosses) {
      this.stopBot(`🛑 Max consecutive losses limit reached (${this.consecutiveLosses} consecutive losses)`);
      soundManager.playLoss();
      return;
    }

    const manipStatus = strategyShield.isManipulationDetected();
    if (manipStatus.detected && strategyShield.isEvasiveHoldActive()) {
      this.statusMessage = `🛡️ [SHIELD] Combiner Stage ${stageNum}: Quote feed delayed (${manipStatus.reason}). Waiting for normalization...`;
      this.notifyStatus();
      return;
    }

    const profitLock = strategyShield.isProfitLockActive();
    if (profitLock.locked) {
      this.stopBot(`💰 [SHIELD] Profit Secured! ${profitLock.reason}`);
      soundManager.playWin();
      return;
    }

    this.isProcessingTrade = true;
    this.scanPhase = 'TRADE_ACTIVE';
    this.isSettling = false;
    this.marketLastTradeTime.set(targetMarket.symbol, now);
    this.lastTradeStartTime = performance.now();
    this.activeDifferDigit = targetDigit;
    this.activeContractTicks = [];

    // 🛡️ ANTI-TRACKING SUB-TICK JITTER:
    const jitterDelay = strategyShield.getAntiManipulationDelay();
    if (jitterDelay > 0) {
      this.statusMessage = `🛡️ [ANTI-TRACKING] Applying +${jitterDelay}ms stealth jitter on ${targetMarket.shortName} (Stage ${stageNum} Differ ≠ ${targetDigit}). Obfuscating machine cadence...`;
      this.notifyStatus();
      await new Promise((r) => setTimeout(r, jitterDelay));
      if (!this.isRunning) {
        this.isProcessingTrade = false;
        this.scanPhase = 'SCANNING';
        return;
      }
    }

    const triggerReason = customReason || `Combiner Stage ${stageNum} [${targetMarket.shortName}]: Pattern [${patternDigits.join(',')}] ➔ Differ ≠ ${targetDigit}`;
    this.activeTriggerReason = triggerReason;
    const plan = this.getExecutionPlan();

    if (plan.isVirtual) {
      this.statusMessage = `🧪 [DEMO] Stage ${stageNum} [${targetMarket.shortName}] ➔ Differ ≠ ${targetDigit} (Demo Stake: $${plan.stakeToUse.toFixed(2)}, 1-Tick close)`;
    } else if (this.config.virtualLossFilterEnabled) {
      this.statusMessage = `🔥 [REAL ACCOUNT] Stage ${stageNum} [${targetMarket.shortName}] ➔ REAL Differ ≠ ${targetDigit} (Real Stake: $${plan.stakeToUse.toFixed(2)}, 1-Tick close)`;
    } else {
      this.statusMessage = `🎯 [${targetMarket.shortName}] Stage ${stageNum} ➔ Buying Differ ≠ ${targetDigit} (Stake: $${plan.stakeToUse.toFixed(2)}, 1-Tick close)`;
    }
    this.notifyStatus();

    try {
      const contract = derivWS.purchaseContract({
        symbol: targetMarket.symbol,
        symbolName: targetMarket.name,
        contractType: 'DIGITDIFF',
        stake: plan.stakeToUse,
        durationTicks: duration,
        durationUnit: 't',
        targetDigit: targetDigit,
        forceVirtual: plan.isVirtual,
      });

      if (contract.status === 'CANCELLED') {
        this.isProcessingTrade = false;
        this.scanPhase = 'SCANNING';
        this.activeContractId = null;
        this.statusMessage = `⚠️ Trade cancelled on ${targetMarket.shortName}: Order not sent. Resuming...`;
        this.notifyStatus();
        return;
      }

      if (this.config.virtualLossFilterEnabled && this.virtualModeState === 'REAL_ARMED') {
        this.virtualModeState = 'REAL_ACTIVE';
      }

      this.activeContractId = contract.id;
      this.trackedContractIds.add(contract.id);

      const stageTitles = [
        `Stage 1: [x,x,y] ➔ Differ ≠ ${targetDigit}`,
        `Stage 2: [x,y,x,x] ➔ Differ ≠ ${targetDigit}`,
        `Stage 3: Lock [x,x] ➔ Reappeared ➔ Differ ≠ ${targetDigit}`,
        `Stage 4: Differ Last Digit ≠ ${targetDigit}`,
      ];

      const record: TradeRecord = {
        id: contract.id,
        timestamp: Date.now(),
        timeString: new Date().toLocaleTimeString(),
        symbol: targetMarket.symbol,
        marketName: targetMarket.shortName,
        differDigit: targetDigit,
        triggerReason: triggerReason,
        twinPattern: stageTitles[stageNum - 1] || `Combiner Stage ${stageNum}`,
        intermediateDigit: null,
        exitDigit: null,
        stake: plan.stakeToUse,
        profit: 0,
        result: 'OPEN',
        durationTicks: duration,
        entryPrice: contract.entrySpot,
        cycleNumber: this.combinerCycleCount,
        ticksCaptured: [],
        accountType: plan.accountType,
        isVirtual: plan.isVirtual,
        appliedJitterMs: jitterDelay,
      };

      this.tradeHistory.unshift(record);
      if (this.tradeHistory.length > 200) this.tradeHistory.pop();
      this.notifyHistory();
      this.notifyStatus();

      if (this.watchdogTimer) window.clearTimeout(this.watchdogTimer);
      const watchdogTimeoutMs = Math.max(3500, duration * 2500 + 2000);
      this.watchdogTimer = window.setTimeout(() => {
        this.resolveHangingTrade(contract.id, targetMarket, targetDigit, record.triggerReason);
      }, watchdogTimeoutMs);
    } catch (err: any) {
      console.error('System Auto Combiner trade purchase failed:', err);
      this.isProcessingTrade = false;
      this.activeContractId = null;
      this.scanPhase = 'SCANNING';
      this.statusMessage = `Trade failed: ${err?.message || 'Error placing contract'}`;
      this.notifyStatus();

      if (this.isRunning) {
        window.setTimeout(() => {
          if (this.isRunning && !this.activeContractId) {
            this.scanPhase = 'SCANNING';
            this.notifyStatus();
          }
        }, 2000);
      }
    }
  }

  /**
   * Manual trigger test button for a combiner stage
   */
  public triggerManualCombinerDiffer(stage: 1 | 2 | 3 | 4, symbol: MarketSymbol, differDigit: number) {
    const market = ASCENDING_VOLATILITY_MARKETS.find((m) => m.symbol === symbol) || ASCENDING_VOLATILITY_MARKETS[0];
    this.executeCombinerTrade(
      market,
      stage,
      differDigit,
      [differDigit],
      `Manual Combiner Stage ${stage} trigger on [${market.shortName}] ➔ Differ ≠ ${differDigit}`
    );
  }

  /**
   * Safety Watchdog: Force-resolves a trade if the WebSocket fails to emit a completion event in time
   */
  private resolveHangingTrade(contractId: string, market: AscendingMarket, targetDigit: number, triggerReason?: string) {
    const existingLog = this.tradeHistory.find((t) => t.id === contractId && t.result === 'OPEN');
    if (!existingLog) return;

    console.warn(`[System Auto Differ] Safety Watchdog resolving 2-tick trade ${contractId} on ${market.shortName}`);
    const liveState = this.marketStates.get(market.symbol);
    const exitPrice = liveState?.price ?? (existingLog.entryPrice || 100);
    const pipSize = market.pipSize ?? 2;
    const exitDigit = liveState ? liveState.lastDigit : extractDerivLastDigit(exitPrice, pipSize, market.symbol);
    const isWin = exitDigit !== targetDigit;
    const profit = isWin ? Number((existingLog.stake * 0.098).toFixed(2)) : -existingLog.stake;

    const simulatedContract: ActiveContract = {
      id: contractId,
      symbol: market.symbol,
      symbolName: market.name,
      contractType: 'DIGITDIFF',
      entrySpot: existingLog.entryPrice,
      currentSpot: exitPrice,
      exitSpot: exitPrice,
      exitDigit: exitDigit,
      targetDigit: targetDigit,
      stake: existingLog.stake,
      potentialPayout: Number((existingLog.stake * 1.098).toFixed(2)),
      currentProfit: profit,
      startTime: existingLog.timestamp,
      expiryTime: Date.now(),
      durationTicks: existingLog.durationTicks,
      remainingTicks: 0,
      durationUnit: 't',
      status: isWin ? 'WON' : 'LOST',
      isWin: isWin,
      historySpots: [existingLog.entryPrice, exitPrice],
    };

    this.handleContractSettled(simulatedContract);
  }

  private handleContractSettled(contract: ActiveContract) {
    const isOurContract =
      this.trackedContractIds.has(contract.id) ||
      contract.id === this.activeContractId ||
      this.tradeHistory.some((t) => t.id === contract.id && t.result === 'OPEN');

    if (!isOurContract) return;

    this.trackedContractIds.delete(contract.id);
    if (this.watchdogTimer) {
      window.clearTimeout(this.watchdogTimer);
      this.watchdogTimer = null;
    }

    this.lastExecutionMs = Math.round(performance.now() - this.lastTradeStartTime);
    const isWin = contract.isWin || contract.status === 'WON';
    const profit = Number(contract.currentProfit || (isWin ? contract.stake * 0.098 : -contract.stake));

    const pipSize = ASCENDING_VOLATILITY_MARKETS.find((m) => m.symbol === contract.symbol)?.pipSize ?? 2;

    // Extract exit digit (Tick 2 settlement digit)
    let exitDigit: number | null = null;
    if (contract.exitDigit !== undefined && contract.exitDigit !== null) {
      exitDigit = contract.exitDigit;
    } else if (contract.currentSpot !== undefined && contract.currentSpot !== null) {
      exitDigit = extractDerivLastDigit(contract.currentSpot, pipSize, contract.symbol);
    }

    // Update log
    const existingLog = this.tradeHistory.find((t) => t.id === contract.id);
    const isVirtual = Boolean(contract.isVirtual || existingLog?.isVirtual || existingLog?.accountType === 'DEMO');

    // Extract intermediate digit if available (Tick 1)
    let intermediateDigit: number | null = null;
    let intermediateSpot: number | null = null;
    if (contract.historySpots && contract.historySpots.length > 1) {
      intermediateSpot = contract.historySpots[0];
      intermediateDigit = extractDerivLastDigit(intermediateSpot, pipSize, contract.symbol);
    } else if (existingLog?.intermediateDigit !== undefined && existingLog.intermediateDigit !== null) {
      intermediateDigit = existingLog.intermediateDigit;
    } else if (existingLog?.differDigit !== undefined && existingLog.differDigit !== null) {
      intermediateDigit = existingLog.differDigit;
    }

    if (existingLog) {
      existingLog.result = isWin ? 'WIN' : 'LOSS';
      existingLog.profit = Number(profit.toFixed(2));
      existingLog.exitDigit = exitDigit;
      existingLog.exitPrice = contract.exitSpot ?? contract.currentSpot;
      existingLog.intermediateDigit = intermediateDigit;
      existingLog.intermediateSpot = intermediateSpot;
      existingLog.ticksCaptured = this.activeContractTicks;
      existingLog.accountType = isVirtual ? 'DEMO' : 'REAL';
      existingLog.isVirtual = isVirtual;
      if (contract.stake && Number.isFinite(contract.stake) && contract.stake > 0) {
        existingLog.stake = Number(contract.stake.toFixed(2));
      }
      this.notifyHistory();
    }

    // Update statistics & Virtual State Machine
    if (isVirtual) {
      if (isWin) {
        this.virtualWins++;
        this.virtualConsecutiveLosses = 0;
        this.virtualNetProfit += profit;
        // Still hunting for 1 virtual loss
        this.virtualModeState = 'VIRTUAL';
        soundManager.playButtonClick();
      } else {
        this.virtualLosses++;
        this.virtualConsecutiveLosses++;
        this.virtualNetProfit += profit;
        // 1 SINGLE VIRTUAL LOSS OCCURRED!
        // Immediately trigger audible alert and arm next trade on REAL account
        this.virtualModeState = 'REAL_ARMED';
        soundManager.playAlert();
      }
    } else {
      // REAL ACCOUNT TRADE
      if (isWin) {
        this.totalWins++;
        this.consecutiveWins++;
        this.consecutiveLosses = 0;
        this.currentMartingaleStep = 0;
        this.consecutiveWinProfitAccumulator += profit;
        if (this.consecutiveWins > this.maxConsecutiveWins) {
          this.maxConsecutiveWins = this.consecutiveWins;
        }
        this.netProfit += profit;
        soundManager.playWin();

        // After win on real account, revert back to demo mode!
        if (this.config.virtualLossFilterEnabled) {
          this.virtualModeState = 'VIRTUAL';
          this.virtualConsecutiveLosses = 0;
        }
      } else {
        this.totalLosses++;
        this.consecutiveLosses++;
        this.consecutiveWins = 0;
        this.consecutiveWinProfitAccumulator = 0;
        this.currentMartingaleStep++;
        if (this.consecutiveLosses > this.maxConsecutiveLosses) {
          this.maxConsecutiveLosses = this.consecutiveLosses;
        }
        this.netProfit += profit;
        soundManager.playLoss();

        // Real loss: stay armed on real account so Martingale can recover
        if (this.config.virtualLossFilterEnabled) {
          this.virtualModeState = 'REAL_ARMED';
        }
      }

      // Explicit Balance Update (Real trades only)
      const newBalance = Number((this.currentBalanceUsd + profit).toFixed(2));
      this.currentBalanceUsd = newBalance;
      this.lastSettledProfit = profit;
      this.lastSettledBalance = newBalance;
      this.lastSettledMarketName = existingLog?.marketName || contract.symbolName || contract.symbol;
      this.lastSettledTriggerReason = existingLog?.triggerReason || this.activeTriggerReason;

      // Register outcome with Strategy Shield for anti-manipulation & profit tracking
      strategyShield.registerTradeOutcome(isWin, profit);

      if (this.onBalanceUpdateCallback) {
        this.onBalanceUpdateCallback(profit, newBalance);
      }
      derivWS.refreshBalance();

      // Calculate next stake (reset to base stake on win, apply Martingale on loss)
      this.calculateNextStake(isWin);
    }

    // 🕵️ STEALTH ZERO-TRACE MODE:
    // If enabled, automatically wipe trade history logs so broker/device cannot trace strategy
    if (strategyShield.isZeroTraceModeEnabled()) {
      this.tradeHistory = [];
      this.activeContractTicks = [];
      this.notifyHistory();
    }

    // 💰 POST-PROFIT CAPITAL LOCK CHECK
    // If profit target is reached, halt bot to avoid broker manipulation giveback
    const profitLockStatus = strategyShield.isProfitLockActive();
    if (!isVirtual && profitLockStatus.locked) {
      this.isSettling = false;
      this.stopBot(`💰 [SHIELD] Profit Target Secured! ${profitLockStatus.reason}`);
      soundManager.playWin();
      return;
    }

    // Enter Settling State (waiting for previous market to close and balance to update)
    this.isSettling = true;
    this.isProcessingTrade = false;
    this.activeContractId = null;
    this.activeDifferDigit = null;
    this.activeTriggerReason = null;
    this.fastLastDifferTriggeredMarket = null;

    const prevMarketShort = existingLog?.marketName || this.lastSettledMarketName || contract.symbolName || contract.symbol;
    const balanceText = `$${this.currentBalanceUsd.toFixed(2)}`;
    const settleInfo = intermediateDigit !== null
      ? `(Tick 1: [${intermediateDigit}] ➔ Tick 2 Settle: [${exitDigit}])`
      : `(Exit Digit: [${exitDigit}])`;
    const twinTag = existingLog?.twinPattern ? `${existingLog.twinPattern} ` : '';

    let outcomeText = '';
    if (isVirtual) {
      if (!isWin) {
        outcomeText = `🚨 [1 VIRTUAL LOSS CONFIRMED!] Demo Loss (-$${Math.abs(profit).toFixed(2)}) on ${prevMarketShort} ➔ REAL ACCOUNT ARMED! Next trade executes on REAL ACCOUNT ($${this.currentStake.toFixed(2)})!`;
      } else {
        outcomeText = `🧪 [DEMO WON] (+$${profit.toFixed(2)}) on ${prevMarketShort} ${settleInfo}. Scanning for 1 virtual loss...`;
      }
    } else {
      if (isWin) {
        outcomeText = this.config.virtualLossFilterEnabled
          ? `🎉 [REAL WIN] (+$${profit.toFixed(2)}) on ${prevMarketShort}! Reverting back to DEMO mode to hunt for next virtual loss...`
          : `✅ WON (+$${profit.toFixed(2)}) on ${prevMarketShort} ${settleInfo}`;
      } else {
        outcomeText = this.config.virtualLossFilterEnabled
          ? `⚠️ [REAL LOSS] (-$${Math.abs(profit).toFixed(2)}) on ${prevMarketShort}. Real Account remains ARMED for Martingale recovery ($${this.currentStake.toFixed(2)})...`
          : `❌ LOST (-$${Math.abs(profit).toFixed(2)}) on ${prevMarketShort} ${settleInfo}`;
      }
    }

    if (!this.isRunning) {
      this.isSettling = false;
      this.statusMessage = `🛑 Bot stopped. Trade settled: ${outcomeText} • Balance: ${balanceText}`;
      this.notifyStatus();
      return;
    }

    // Check risk limits (only applied to real account trades)
    if (!isVirtual) {
      if (this.netProfit >= this.config.takeProfit) {
        this.isSettling = false;
        this.stopBot(`🎯 Take Profit reached (+${this.netProfit.toFixed(2)} USD >= +${this.config.takeProfit} USD) • Balance: ${balanceText}`);
        soundManager.playWin();
        return;
      }

      if (this.netProfit <= -Math.abs(this.config.stopLoss)) {
        this.isSettling = false;
        this.stopBot(`⚠️ Stop Loss reached (${this.netProfit.toFixed(2)} USD <= -${this.config.stopLoss} USD) • Balance: ${balanceText}`);
        soundManager.playLoss();
        return;
      }

      if (this.consecutiveLosses >= this.config.maxConsecutiveLosses) {
        this.isSettling = false;
        this.stopBot(`🛑 Max consecutive losses limit reached (${this.consecutiveLosses} consecutive losses) • Balance: ${balanceText}`);
        soundManager.playLoss();
        return;
      }
    }

    // Mark settled market as traded
    const pool = this.getMarketPool();
    const settledSymbol = contract.symbol;
    this.lastTradedSymbol = settledSymbol;
    this.lastTradedMarketName = prevMarketShort;
    this.tradedMarketsInCycle.add(settledSymbol);
    this.lastTradeClosedTime = Date.now();
    this.scanPhase = 'TRADE_SETTLING';

    // Clear previous pattern flags so we strictly wait for fresh pattern generation after trade close
    if (this.config.requireFreshPatternAfterClose !== false) {
      this.resetPatternFlagsAcrossMarkets();
    }

    // Cycle tracking
    let cycleCompleted = false;
    if (this.tradedMarketsInCycle.size >= pool.length) {
      this.currentCycle++;
      this.currentStepInCycle = 0;
      this.tradedMarketsInCycle.clear();
      cycleCompleted = true;
    } else {
      this.currentStepInCycle = this.tradedMarketsInCycle.size;
    }

    if (this.config.strategyMode === 'COMBINER_BOT') {
      this.isSettling = false;
      this.isProcessingTrade = false;
      this.activeContractId = null;
      this.activeDifferDigit = null;
      this.activeTriggerReason = null;
      this.scanPhase = 'SCANNING';
      this.postTradeCountdownSec = null;
      if (this.postTradeCountdownTimer) {
        window.clearInterval(this.postTradeCountdownTimer);
        this.postTradeCountdownTimer = null;
      }

      const completedStage = this.combinerCurrentStage;
      if (isWin) {
        this.combinerStageWins[completedStage - 1] = (this.combinerStageWins[completedStage - 1] || 0) + 1;
      } else {
        this.combinerStageLosses[completedStage - 1] = (this.combinerStageLosses[completedStage - 1] || 0) + 1;
      }

      const shouldAdvance = this.config.combinerAdvanceOn === 'WIN_ONLY' ? isWin : true;

      if (shouldAdvance) {
        if (completedStage < 4) {
          this.combinerCurrentStage = (completedStage + 1) as (1 | 2 | 3 | 4);
        } else {
          this.combinerCycleCount += 1;
          this.combinerCurrentStage = 1;
          soundManager.playWin();
        }
      }

      if (this.combinerCurrentStage !== 3) {
        this.combinerStage3State = 'HUNTING_DOUBLE';
        this.combinerStage3LockedDigit = null;
        this.combinerStage3InterveningDigits = [];
      }

      const nextStageNum = this.combinerCurrentStage;
      const nextMarketSym = this.getCombinerMarketForStage(nextStageNum);
      const nextMarket = ASCENDING_VOLATILITY_MARKETS.find((m) => m.symbol === nextMarketSym) || ASCENDING_VOLATILITY_MARKETS[0];
      const stageNames = [
        'Stage 1: [x,x,y] ➔ Differ ≠ y',
        'Stage 2: [x,y,x,x] ➔ Differ ≠ x',
        'Stage 3: Lock [x,x] ➔ Reappeared ➔ Differ ≠ x',
        'Stage 4: Differ Last Digit',
      ];

      if (completedStage === 4 && shouldAdvance) {
        this.statusMessage = `🏆 [COMBINER CYCLE #${this.combinerCycleCount - 1} COMPLETED] ${outcomeText} on ${prevMarketShort}! 🔄 Ascending Loop Restarting at Stage 1 [${nextMarket.shortName}]...`;
      } else {
        this.statusMessage = `${outcomeText} on ${prevMarketShort} (Stage ${completedStage}) ➔ Advancing to Stage ${nextStageNum}: ${stageNames[nextStageNum - 1]} on [${nextMarket.shortName}]!`;
      }
      this.notifyStatus();
      return;
    } else if (this.config.strategyMode === 'LAST_DIGIT_DIFFER') {
      const postDelay = this.config.postTradeScanDelaySec ?? 1;
      this.statusMessage = `${outcomeText} on ${prevMarketShort} Differed ≠${existingLog?.differDigit ?? '?'} ${settleInfo} ➔ 💰 Balance: ${balanceText} ➔ ⏳ Next Last Digit Differ trade ${postDelay > 0 ? `in ${postDelay}s` : 'executing immediately'}...`;
    } else if (this.config.strategyMode === 'ENTRY_POINT_DIFFER') {
      const targetDigit = this.config.entryPointTargetDigit !== undefined ? this.config.entryPointTargetDigit : 5;
      this.isSettling = false;
      this.isProcessingTrade = false;
      this.activeContractId = null;
      this.activeDifferDigit = null;
      this.activeTriggerReason = null;
      this.scanPhase = 'SCANNING';
      this.postTradeCountdownSec = null;
      if (this.postTradeCountdownTimer) {
        window.clearInterval(this.postTradeCountdownTimer);
        this.postTradeCountdownTimer = null;
      }
      this.statusMessage = `${outcomeText} on ${prevMarketShort} Differed ≠${targetDigit} ${settleInfo} ➔ 💰 Balance: ${balanceText} ➔ ⚡ Instant scan ready for Entry Point [${targetDigit}]!`;
      this.notifyStatus();
      return;
    } else if (this.config.strategyMode === 'DIGIT_MARKER_DIFFER') {
      const targetDigit = this.config.digitMarkerTargetDigit !== undefined ? this.config.digitMarkerTargetDigit : 6;
      this.isSettling = false;
      this.isProcessingTrade = false;
      this.activeContractId = null;
      this.activeDifferDigit = null;
      this.activeTriggerReason = null;
      this.scanPhase = 'SCANNING';
      this.postTradeCountdownSec = null;
      if (this.postTradeCountdownTimer) {
        window.clearInterval(this.postTradeCountdownTimer);
        this.postTradeCountdownTimer = null;
      }
      this.statusMessage = `${outcomeText} on ${prevMarketShort} Differed ≠${targetDigit} (Immediate next digit: [${exitDigit}]) ➔ 💰 Balance: ${balanceText} ➔ ⚡ Instant scan ready for next marked digit [${targetDigit}]!`;
      this.notifyStatus();
      if (exitDigit === targetDigit && this.isRunning) {
        const targetSymbol = this.config.digitMarkerMarketSymbol || 'R_100';
        const targetMarket = ASCENDING_VOLATILITY_MARKETS.find((m) => m.symbol === targetSymbol) || ASCENDING_VOLATILITY_MARKETS[0];
        this.executeDigitMarkerDifferTrade(targetMarket, targetDigit);
      }
      return;
    } else if (this.config.strategyMode === 'RANGE_LONG_DIFFERS') {
      this.isSettling = false;
      this.isProcessingTrade = false;
      this.activeContractId = null;
      this.activeDifferDigit = null;
      this.activeTriggerReason = null;
      this.scanPhase = 'SCANNING';
      this.rangeLongWindowDigits = [];
      this.postTradeCountdownSec = null;
      if (this.postTradeCountdownTimer) {
        window.clearInterval(this.postTradeCountdownTimer);
        this.postTradeCountdownTimer = null;
      }

      // 🔀 PHANTOM MARKET HOPPING: Rotate asset if enabled to break single-market dealer tracking
      if (strategyShield.getConfig().enableDynamicMarketHopping && this.isRunning) {
        this.hopToNextMarket();
        const newSym = this.config.rangeLongDiffersMarketSymbol || 'R_100';
        const newMarketName = ASCENDING_VOLATILITY_MARKETS.find((m) => m.symbol === newSym)?.shortName || newSym;
        this.statusMessage = `${outcomeText} on ${prevMarketShort} (8th digit: [${exitDigit}]) ➔ 🔀 Hopped to [${newMarketName}] to break dealer profiling! Starting fresh 7-digit range...`;
      } else {
        this.statusMessage = `${outcomeText} on ${prevMarketShort} Differed ≠${existingLog?.differDigit ?? '?'} (8th digit settled: [${exitDigit}]) ➔ 💰 Balance: ${balanceText} ➔ 🔄 Starting fresh 7-digit range...`;
      }
      this.notifyStatus();
      return;
    } else if (this.config.strategyMode === 'DIGIT_SELECT_DIFFER') {
      const targetDigit = this.config.digitSelectTargetDigit ?? 5;
      const postDelay = this.config.postTradeScanDelaySec ?? 1;
      this.statusMessage = `${outcomeText} on ${prevMarketShort} Differed ≠${targetDigit} ${settleInfo} ➔ 💰 Balance: ${balanceText} ➔ ⏳ Next Differ trade ${postDelay > 0 ? `in ${postDelay}s` : 'executing immediately'}...`;
    } else if (this.config.strategyMode === 'MASTER_DOUBLE') {
      const postDelay = this.config.postTradeScanDelaySec ?? 1;
      this.statusMessage = `${outcomeText} on ${prevMarketShort} Differed ≠${existingLog?.differDigit ?? '?'} ${settleInfo} ➔ 💰 Balance: ${balanceText} ➔ ⏳ Master Double trade closed. Scanning for next twin [d, d] (0,0➔≠1.. 8,8➔≠9) ${postDelay > 0 ? `in ${postDelay}s` : 'instantly'}...`;
    } else if (this.config.strategyMode === 'MASTER_DOUBLE_2') {
      const postDelay = this.config.postTradeScanDelaySec ?? 1;
      const sel = this.config.masterDouble2SelectedPatterns || [0, 1, 2, 3, 4, 5, 6, 7, 8];
      const desc = sel.length === 9 ? 'All [0..8]' : sel.map((p) => `${p},${p}➔≠${p + 1}`).join(', ');
      this.statusMessage = `${outcomeText} on ${prevMarketShort} Differed ≠${existingLog?.differDigit ?? '?'} ${settleInfo} ➔ 💰 Balance: ${balanceText} ➔ ⏳ Master Double [2] closed. Scanning selected [${desc}] ${postDelay > 0 ? `in ${postDelay}s` : 'instantly'}...`;
    } else if (this.config.strategyMode === 'DOUBLE_1_SELECT') {
      const postDelay = this.config.postTradeScanDelaySec ?? 1;
      const targetSymbol = this.config.double1SelectMarketSymbol || 'R_100';
      const targetMarket = ASCENDING_VOLATILITY_MARKETS.find((m) => m.symbol === targetSymbol) || ASCENDING_VOLATILITY_MARKETS[0];
      const range = this.config.double1SelectMaxDigitsRange ?? 6;
      this.statusMessage = `${outcomeText} on ${prevMarketShort} Differed ≠${existingLog?.differDigit ?? '?'} ${settleInfo} ➔ 💰 Balance: ${balanceText} ➔ ⏳ [Double 1 Select] Trade closed. Hunting fresh identical digits on [${targetMarket.shortName}] (range ${range}t) ${postDelay > 0 ? `in ${postDelay}s` : 'instantly'}...`;
    } else if (this.config.strategyMode === 'DOUBLE_END_BOT') {
      const postDelay = this.config.postTradeScanDelaySec ?? 1;
      const targetSymbol = this.config.doubleEndMarketSymbol || 'R_100';
      const targetMarket = ASCENDING_VOLATILITY_MARKETS.find((m) => m.symbol === targetSymbol) || ASCENDING_VOLATILITY_MARKETS[0];
      this.statusMessage = `${outcomeText} on ${prevMarketShort} Differed ≠${existingLog?.differDigit ?? '?'} ${settleInfo} ➔ 💰 Balance: ${balanceText} ➔ ⏳ Double End Bot trade closed. Scanning [${targetMarket.shortName}] for next pair/thrice pattern ${postDelay > 0 ? `in ${postDelay}s` : 'instantly'}...`;
    } else if (this.config.singleTradeSequentialMode) {
      const postDelay = this.config.postTradeScanDelaySec ?? 1;
      this.statusMessage = `${outcomeText} on ${prevMarketShort} ${twinTag}Differed ≠${existingLog?.differDigit ?? '?'} ${settleInfo} ➔ 💰 Balance: ${balanceText} ➔ ⏳ Trade closed. Preparing to resume scanning ${postDelay > 0 ? `in ${postDelay}s` : 'instantly'}...`;
    } else if (this.config.strategyMode === 'ALTERNATING_DIGITS') {
      const cdSec = this.config.alternatingCooldownSec ?? 5;
      this.statusMessage = `${outcomeText} on ${prevMarketShort} Differed ≠${existingLog?.differDigit ?? '?'} ${settleInfo} ➔ 💰 Balance: ${balanceText} ➔ ⏳ ${cdSec}s cooldown before next Alternating Digits trade...`;
    } else if (this.config.marketScope === 'SINGLE_SPECIFIC') {
      const targetMarket = pool[0] || ASCENDING_VOLATILITY_MARKETS[0];
      this.statusMessage = `${outcomeText} on ${prevMarketShort} ${twinTag}Differed ≠${existingLog?.differDigit ?? '?'} ${settleInfo} ➔ 💰 Balance: ${balanceText} ➔ Ready on [${targetMarket.shortName}]...`;
    } else {
      this.statusMessage = `${outcomeText} on ${prevMarketShort} ${twinTag}Differed ≠${existingLog?.differDigit ?? '?'} ${settleInfo} ➔ 💰 Balance: ${balanceText} ➔ Scanning all ${pool.length} markets simultaneously, waiting for another market...`;
    }
    this.notifyStatus();

    const delay = this.config.singleTradeSequentialMode
      ? 0 // Controlled by postTradeScanDelaySec countdown
      : this.config.strategyMode === 'ALTERNATING_DIGITS'
      ? (this.config.alternatingCooldownSec ?? 5) * 1000
      : Math.max(0, this.config.delayBetweenTradesMs ?? 0);

    if (this.nextTradeTimer) {
      window.clearTimeout(this.nextTradeTimer);
      this.nextTradeTimer = null;
    }

    const startFreshScan = () => {
      this.scanPhase = 'SCANNING';
      this.isSettling = false;
      this.postTradeCountdownSec = null;
      if (this.postTradeCountdownTimer) {
        window.clearInterval(this.postTradeCountdownTimer);
        this.postTradeCountdownTimer = null;
      }

      if (this.config.strategyMode === 'COMBINER_BOT') {
        const curStage = this.combinerCurrentStage || 1;
        const sym = this.getCombinerMarketForStage(curStage);
        const stageMarket = ASCENDING_VOLATILITY_MARKETS.find((m) => m.symbol === sym) || ASCENDING_VOLATILITY_MARKETS[0];
        const stageNames = [
          'Stage 1: Scanning for [x, x, y] ➔ Differ ≠ y',
          'Stage 2: Scanning for [x, y, x, x] ➔ Differ ≠ x',
          'Stage 3: Hunting double [x, x] ➔ Lock ➔ Reappearance Differ ≠ x',
          'Stage 4: Differ Last Digit',
        ];
        this.statusMessage = `⚡ Trade closed (${outcomeText}) • Combiner Bot Active on ${stageNames[curStage - 1]} on [${stageMarket.shortName}] (1t Settle)...`;
        this.notifyStatus();
        return;
      }

      if (this.config.strategyMode === 'LAST_DIGIT_DIFFER') {
        const targetSymbol = this.config.lastDigitDifferMarketSymbol || 'R_25';
        const targetMarket = ASCENDING_VOLATILITY_MARKETS.find((m) => m.symbol === targetSymbol) || ASCENDING_VOLATILITY_MARKETS.find(m => m.symbol === 'R_25') || ASCENDING_VOLATILITY_MARKETS[0];
        const live = this.marketStates.get(targetSymbol);
        const curD = live ? live.lastDigit : 0;
        this.statusMessage = `⚡ Trade closed (${outcomeText}) • Last Digit Differ executing Differ ≠ ${curD} (immediate digit) on [${targetMarket.shortName}]...`;
        this.notifyStatus();
        this.executeLastDigitDifferTrade();
        return;
      }

      if (this.config.strategyMode === 'ENTRY_POINT_DIFFER') {
        const targetDigit = this.config.entryPointTargetDigit !== undefined ? this.config.entryPointTargetDigit : 5;
        const targetSymbol = this.config.entryPointMarketSymbol || 'R_100';
        const targetMarket = ASCENDING_VOLATILITY_MARKETS.find((m) => m.symbol === targetSymbol) || ASCENDING_VOLATILITY_MARKETS[0];
        const live = this.marketStates.get(targetSymbol);
        const curD = live ? live.lastDigit : 0;
        this.statusMessage = `⚡ Trade closed (${outcomeText}) • Entry Point Bot resumed scanning [${targetMarket.shortName}] for digit [${targetDigit}] (Current: [${curD}])...`;
        this.notifyStatus();
        if (curD === targetDigit) {
          this.executeEntryPointDifferTrade(targetMarket, targetDigit);
        }
        return;
      }

      if (this.config.strategyMode === 'DIGIT_MARKER_DIFFER') {
        const targetDigit = this.config.digitMarkerTargetDigit !== undefined ? this.config.digitMarkerTargetDigit : 6;
        const targetSymbol = this.config.digitMarkerMarketSymbol || 'R_100';
        const targetMarket = ASCENDING_VOLATILITY_MARKETS.find((m) => m.symbol === targetSymbol) || ASCENDING_VOLATILITY_MARKETS[0];
        const live = this.marketStates.get(targetSymbol);
        const curD = live ? live.lastDigit : 0;
        this.statusMessage = `⚡ Trade closed (${outcomeText}) • [Digit Marker] resumed scanning [${targetMarket.shortName}] for marked digit [${targetDigit}] (Current: [${curD}])...`;
        this.notifyStatus();
        if (curD === targetDigit) {
          this.executeDigitMarkerDifferTrade(targetMarket, targetDigit);
        }
        return;
      }

      if (this.config.strategyMode === 'DIGIT_SELECT_DIFFER') {
        const targetDigit = this.config.digitSelectTargetDigit ?? 5;
        const targetSymbol = this.config.digitSelectVolatilitySymbol || 'R_100';
        const targetMarket = ASCENDING_VOLATILITY_MARKETS.find((m) => m.symbol === targetSymbol) || ASCENDING_VOLATILITY_MARKETS[0];
        this.statusMessage = `⚡ Trade closed (${outcomeText}) • Digit Select Differ executing immediate Differ ≠ ${targetDigit} on [${targetMarket.shortName}]...`;
        this.notifyStatus();
        this.executeDigitSelectDifferTrade();
        return;
      }

      if (this.config.strategyMode === 'MASTER_DOUBLE') {
        const dur = this.config.durationTicks || 1;
        if (this.config.marketScope === 'SINGLE_SPECIFIC') {
          const targetMarket = pool[0] || ASCENDING_VOLATILITY_MARKETS[0];
          this.statusMessage = `⚡ Trade closed (${outcomeText}) • Master Double Active on [${targetMarket.shortName}] (Trade #${this.totalWins + this.totalLosses + 1}) ➔ Scanning for [d, d] ➔ Differ ≠ (d+1) (${dur}t)...`;
        } else {
          this.statusMessage = `⚡ Trade closed (${outcomeText}) ➔ Resumed scanning all ${pool.length} markets for fresh Master Double triggers [d, d] (0,0➔≠1.. 8,8➔≠9, 1 trade at a time)...`;
        }
        this.notifyStatus();
        this.checkAllMarketsForMasterDoubleTrigger();
        return;
      }

      if (this.config.strategyMode === 'MASTER_DOUBLE_2') {
        const dur = this.config.durationTicks || 1;
        const sel = this.config.masterDouble2SelectedPatterns || [0, 1, 2, 3, 4, 5, 6, 7, 8];
        const desc = sel.length === 9 ? 'All [0..8]' : sel.map((p) => `${p},${p}➔≠${p + 1}`).join(', ');
        if (this.config.marketScope === 'SINGLE_SPECIFIC') {
          const targetMarket = pool[0] || ASCENDING_VOLATILITY_MARKETS[0];
          this.statusMessage = `⚡ Trade closed (${outcomeText}) • Master Double [2] Active on [${targetMarket.shortName}] (Trade #${this.totalWins + this.totalLosses + 1}) ➔ Scanning for selected [${desc}] (${dur}t)...`;
        } else {
          this.statusMessage = `⚡ Trade closed (${outcomeText}) ➔ Resumed scanning all ${pool.length} markets for selected Master Double [2] triggers [${desc}] (1 trade at a time)...`;
        }
        this.notifyStatus();
        this.checkAllMarketsForMasterDouble2Trigger();
        return;
      }

      if (this.config.strategyMode === 'DOUBLE_1_SELECT') {
        this.double1SelectState = 'HUNTING';
        this.double1SelectLockedDigit = null;
        this.double1SelectInterveningDigits = [];
        const chosenSym = this.config.double1SelectMarketSymbol || 'R_100';
        const targetMarket = ASCENDING_VOLATILITY_MARKETS.find((m) => m.symbol === chosenSym) || ASCENDING_VOLATILITY_MARKETS[0];
        const rangeLimit = this.config.double1SelectMaxDigitsRange ?? 6;
        this.statusMessage = `⚡ Trade closed (${outcomeText}) • [Double 1 Select] Active on [${targetMarket.shortName}]: Hunting fresh identical digits [d, d] or [d, d, d] to lock ➔ then waiting for [d] within ${rangeLimit} digits...`;
        this.notifyStatus();
        return;
      }

      if (this.config.strategyMode === 'DOUBLE_END_BOT') {
        const chosenSym = this.config.doubleEndMarketSymbol || 'R_100';
        const targetMarket = ASCENDING_VOLATILITY_MARKETS.find((m) => m.symbol === chosenSym) || ASCENDING_VOLATILITY_MARKETS[0];
        const mode = this.config.doubleEndPatternMode || 'PAIR_OR_THRICE';
        const modeLabel = mode === 'PAIR_ONLY' ? 'Pair [x, x, y]' : mode === 'THRICE_ONLY' ? 'Thrice [x, x, x, y]' : 'Pair [x, x, y] or Thrice [x, x, x, y]';
        this.statusMessage = `⚡ Trade closed (${outcomeText}) • Double End Bot resumed scanning [${targetMarket.shortName}] for ${modeLabel} ➔ Differ ≠ y (1-Tick settle)...`;
        this.notifyStatus();
        return;
      }

      if (this.config.strategyMode === 'FAST_LAST_DIFFER') {
        const chosenDigit = this.config.fastLastDifferChosenDigit !== undefined ? this.config.fastLastDifferChosenDigit : 5;
        this.fastLastDifferTriggeredMarket = null;
        this.statusMessage = `⚡ Trade closed (${outcomeText}) • Fast Last Differ resumed scanning all 13 markets for chosen digit [${chosenDigit}] ➔ First to produce [${chosenDigit}] buys Differ ≠ ${chosenDigit} (1-Tick settle)...`;
        this.notifyStatus();
        return;
      }

      if (this.config.strategyMode === 'TWIN_0_AND_9_DIFFER') {
        const dur = this.config.durationTicks || 1;
        if (this.config.marketScope === 'SINGLE_SPECIFIC') {
          const targetMarket = pool[0] || ASCENDING_VOLATILITY_MARKETS[0];
          this.statusMessage = `⚡ Trade closed (${outcomeText}) • Polar Twin Scanner Active on [${targetMarket.shortName}] (Trade #${this.totalWins + this.totalLosses + 1}) ➔ Scanning for [0,0] or [9,9] (${dur}t)...`;
        } else {
          this.statusMessage = `⚡ Trade closed (${outcomeText}) ➔ Resumed scanning all ${pool.length} markets for fresh [0,0] or [9,9] triggers (1 trade at a time)...`;
        }
      } else if (this.config.strategyMode === 'DOUBLE_BOT_1TICK') {
        const dur = this.config.durationTicks || 1;
        if (this.config.marketScope === 'SINGLE_SPECIFIC') {
          const targetMarket = pool[0] || ASCENDING_VOLATILITY_MARKETS[0];
          this.statusMessage = `⚡ Trade closed (${outcomeText}) • Double Bot Active on [${targetMarket.shortName}] (Trade #${this.totalWins + this.totalLosses + 1}) ➔ Scanning for [x, x, y] ➔ Differ ≠ y (${dur}t)...`;
        } else {
          this.statusMessage = `⚡ Trade closed (${outcomeText}) ➔ Resumed scanning all ${pool.length} markets for fresh Double Bot [x, x, y] triggers (1 trade at a time)...`;
        }
      } else if (this.config.strategyMode === 'ALTERNATING_DIGITS') {
        const targetDigit = this.config.alternatingTargetDigit ?? 5;
        const dur = this.config.durationTicks || 1;
        this.statusMessage = `⚡ Trade closed (${outcomeText}) ➔ Resumed scanning markets for Alternating Odd/Even pattern (Differ ≠ ${targetDigit}, ${dur}t)...`;
      } else if (this.config.strategyMode === 'DOUBLE_IDENTICAL_2TICK') {
        if (this.config.marketScope === 'SINGLE_SPECIFIC') {
          const targetMarket = pool[0] || ASCENDING_VOLATILITY_MARKETS[0];
          this.statusMessage = `⚡ Trade closed (${outcomeText}) • Sniper Active on [${targetMarket.shortName}] (Trade #${this.totalWins + this.totalLosses + 1}) ➔ Scanning for fresh Double Identical twin digits...`;
        } else {
          this.statusMessage = `⚡ Trade closed (${outcomeText}) ➔ Resumed scanning all ${pool.length} markets for fresh Double Identical twin digits (1 trade at a time)...`;
        }
      } else {
        this.statusMessage = `⚡ Trade closed (${outcomeText}) ➔ Resumed scanning markets for next trade...`;
      }

      this.notifyStatus();
    };

    const proceedToNext = () => {
      this.nextTradeTimer = null;

      if (!this.isRunning) {
        this.isSettling = false;
        this.scanPhase = 'IDLE';
        this.notifyStatus();
        return;
      }

      // 🎯 1-Trade Sequential Mode:
      // Bot took 1 trade, waited for it to close, and now resumes scanning fresh incoming ticks.
      if (this.config.singleTradeSequentialMode) {
        const delaySec = Math.max(0, this.config.postTradeScanDelaySec ?? 1);
        if (delaySec <= 0) {
          startFreshScan();
        } else {
          this.scanPhase = 'POST_TRADE_COOLDOWN';
          this.isSettling = true;
          this.postTradeCountdownSec = delaySec;
          this.statusMessage = `⏳ Trade closed (${outcomeText}) ➔ Resuming market scan in ${delaySec}s (1 trade at a time mode)...`;
          this.notifyStatus();

          if (this.postTradeCountdownTimer) {
            window.clearInterval(this.postTradeCountdownTimer);
            this.postTradeCountdownTimer = null;
          }

          let remaining = delaySec;
          this.postTradeCountdownTimer = window.setInterval(() => {
            remaining--;
            if (!this.isRunning) {
              if (this.postTradeCountdownTimer) {
                window.clearInterval(this.postTradeCountdownTimer);
                this.postTradeCountdownTimer = null;
              }
              return;
            }
            if (remaining <= 0) {
              if (this.postTradeCountdownTimer) {
                window.clearInterval(this.postTradeCountdownTimer);
                this.postTradeCountdownTimer = null;
              }
              startFreshScan();
            } else {
              this.postTradeCountdownSec = remaining;
              this.statusMessage = `⏳ Trade closed (${outcomeText}) ➔ Resuming market scan in ${remaining}s (1 trade at a time mode)...`;
              this.notifyStatus();
            }
          }, 1000);
        }
        return;
      }

      this.isSettling = false;
      this.scanPhase = 'SCANNING';

      if (this.config.strategyMode === 'LAST_DIGIT_DIFFER') {
        const targetSymbol = this.config.lastDigitDifferMarketSymbol || 'R_25';
        const targetMarket = ASCENDING_VOLATILITY_MARKETS.find((m) => m.symbol === targetSymbol) || ASCENDING_VOLATILITY_MARKETS[0];
        const live = this.marketStates.get(targetSymbol);
        const curD = live ? live.lastDigit : 0;
        this.statusMessage = `⚡ Last Digit Differ Active: Executing Differ ≠ ${curD} (immediate digit) on [${targetMarket.shortName}]...`;
        this.notifyStatus();
        this.executeLastDigitDifferTrade();
        return;
      }

      if (this.config.strategyMode === 'ENTRY_POINT_DIFFER') {
        const targetDigit = this.config.entryPointTargetDigit !== undefined ? this.config.entryPointTargetDigit : 5;
        const targetSymbol = this.config.entryPointMarketSymbol || 'R_100';
        const targetMarket = ASCENDING_VOLATILITY_MARKETS.find((m) => m.symbol === targetSymbol) || ASCENDING_VOLATILITY_MARKETS[0];
        const live = this.marketStates.get(targetSymbol);
        const curD = live ? live.lastDigit : 0;
        this.statusMessage = `⚡ Entry Point Bot Active: Scanning [${targetMarket.shortName}] for digit [${targetDigit}] (Current: [${curD}])...`;
        this.notifyStatus();
        if (curD === targetDigit) {
          this.executeEntryPointDifferTrade(targetMarket, targetDigit);
        }
        return;
      }

      if (this.config.strategyMode === 'DIGIT_MARKER_DIFFER') {
        const targetDigit = this.config.digitMarkerTargetDigit !== undefined ? this.config.digitMarkerTargetDigit : 6;
        const targetSymbol = this.config.digitMarkerMarketSymbol || 'R_100';
        const targetMarket = ASCENDING_VOLATILITY_MARKETS.find((m) => m.symbol === targetSymbol) || ASCENDING_VOLATILITY_MARKETS[0];
        const live = this.marketStates.get(targetSymbol);
        const curD = live ? live.lastDigit : 0;
        this.statusMessage = `⚡ [Digit Marker Bot Active]: Scanning [${targetMarket.shortName}] for marked digit [${targetDigit}] (Current: [${curD}])...`;
        this.notifyStatus();
        if (curD === targetDigit) {
          this.executeDigitMarkerDifferTrade(targetMarket, targetDigit);
        }
        return;
      }

      if (this.config.strategyMode === 'FAST_LAST_DIFFER') {
        const chosenDigit = this.config.fastLastDifferChosenDigit !== undefined ? this.config.fastLastDifferChosenDigit : 5;
        this.fastLastDifferTriggeredMarket = null;
        this.statusMessage = `⚡ Fast Last Differ Active: Scanning all 13 markets simultaneously for chosen digit [${chosenDigit}] ➔ First market to hit [${chosenDigit}] buys Differ ≠ ${chosenDigit} (1-Tick settle)...`;
        this.notifyStatus();
        return;
      }

      if (this.config.strategyMode === 'DIGIT_SELECT_DIFFER') {
        const targetDigit = this.config.digitSelectTargetDigit ?? 5;
        const targetSymbol = this.config.digitSelectVolatilitySymbol || 'R_100';
        const targetMarket = ASCENDING_VOLATILITY_MARKETS.find((m) => m.symbol === targetSymbol) || ASCENDING_VOLATILITY_MARKETS[0];
        this.statusMessage = `⚡ Digit Select Differ Active: Executing immediate Differ ≠ ${targetDigit} on [${targetMarket.shortName}]...`;
        this.notifyStatus();
        this.executeDigitSelectDifferTrade();
        return;
      }

      if (this.config.strategyMode === 'MASTER_DOUBLE') {
        const dur = this.config.durationTicks || 1;
        if (this.config.marketScope === 'SINGLE_SPECIFIC') {
          const targetMarket = pool[0] || ASCENDING_VOLATILITY_MARKETS[0];
          this.statusMessage = `⚡ Master Double Active on [${targetMarket.shortName}] (Trade #${this.totalWins + this.totalLosses + 1}) ➔ Scanning for [d, d] ➔ Differ ≠ (d+1) (${dur}t)...`;
        } else {
          this.statusMessage = `⚡ Master Double Active ➔ Scanning all ${pool.length} markets for twin patterns [d, d] (0,0➔≠1.. 8,8➔≠9, ${dur}t)...`;
        }
        this.notifyStatus();
        this.checkAllMarketsForMasterDoubleTrigger();
      } else if (this.config.strategyMode === 'MASTER_DOUBLE_2') {
        const dur = this.config.durationTicks || 1;
        const sel = this.config.masterDouble2SelectedPatterns || [0, 1, 2, 3, 4, 5, 6, 7, 8];
        const desc = sel.length === 9 ? 'All [0..8]' : sel.map((p) => `${p},${p}➔≠${p + 1}`).join(', ');
        if (this.config.marketScope === 'SINGLE_SPECIFIC') {
          const targetMarket = pool[0] || ASCENDING_VOLATILITY_MARKETS[0];
          this.statusMessage = `⚡ Master Double [2] Active on [${targetMarket.shortName}] (Trade #${this.totalWins + this.totalLosses + 1}) ➔ Scanning for selected [${desc}] (${dur}t)...`;
        } else {
          this.statusMessage = `⚡ Master Double [2] Active ➔ Scanning all ${pool.length} markets for selected patterns [${desc}] (${dur}t)...`;
        }
        this.notifyStatus();
        this.checkAllMarketsForMasterDouble2Trigger();
      } else if (this.config.strategyMode === 'TWIN_0_AND_9_DIFFER') {
        const dur = this.config.durationTicks || 1;
        if (this.config.marketScope === 'SINGLE_SPECIFIC') {
          const targetMarket = pool[0] || ASCENDING_VOLATILITY_MARKETS[0];
          this.statusMessage = `⚡ Polar Twin Scanner Active on [${targetMarket.shortName}] (Trade #${this.totalWins + this.totalLosses + 1}) ➔ Scanning for [0,0] or [9,9] (${dur}t)...`;
        } else {
          this.statusMessage = `⚡ Scanning all ${pool.length} markets for [0,0] ➔ Differ ≠ 0 or [9,9] ➔ Differ ≠ 9 (${this.tradedMarketsInCycle.size}/${pool.length} traded in Cycle #${this.currentCycle}) ➔ Waiting for another market (≠${prevMarketShort}) to trigger...`;
        }
        this.notifyStatus();
        this.checkAllMarketsForTwin09Trigger();
      } else if (this.config.strategyMode === 'DOUBLE_BOT_1TICK') {
        const dur = this.config.durationTicks || 1;
        if (this.config.marketScope === 'SINGLE_SPECIFIC') {
          const targetMarket = pool[0] || ASCENDING_VOLATILITY_MARKETS[0];
          this.statusMessage = `⚡ Double Bot Active on [${targetMarket.shortName}] (Trade #${this.totalWins + this.totalLosses + 1}) ➔ Scanning for [x, x, y] ➔ Differ ≠ y (${dur}t)...`;
        } else {
          this.statusMessage = `⚡ Double Bot Active ➔ Scanning all ${pool.length} markets for [x, x, y] (e.g. 3,3,4 ➔ ≠4 | 5,5,6 ➔ ≠6, ${dur}t)...`;
        }
        this.notifyStatus();
        this.checkAllMarketsForDoubleBotTrigger();
      } else if (this.config.strategyMode === 'ALTERNATING_DIGITS') {
        const targetDigit = this.config.alternatingTargetDigit ?? 5;
        const dur = this.config.durationTicks || 1;
        if (this.config.marketScope === 'SINGLE_SPECIFIC') {
          const targetMarket = pool[0] || ASCENDING_VOLATILITY_MARKETS[0];
          this.statusMessage = `⚡ Alternating Digits Bot Active on [${targetMarket.shortName}] ➔ Scanning for Alternating Odd/Even pattern (Target Differ ≠ ${targetDigit}, ${dur}t)...`;
        } else {
          this.statusMessage = `⚡ Alternating Digits Bot Active ➔ Scanning all ${pool.length} markets for Alternating Odd/Even pattern (Target Differ ≠ ${targetDigit}, ${dur}t)...`;
        }
        this.notifyStatus();
        this.checkAllMarketsForAlternatingTrigger();
      } else if (this.config.strategyMode === 'ASCENDING_SEQUENTIAL_1TICK') {
        this.executeNextMarketTrade();
      } else if (this.config.marketScope === 'SINGLE_SPECIFIC') {
        const targetMarket = pool[0] || ASCENDING_VOLATILITY_MARKETS[0];
        this.statusMessage = `⚡ Sniper Active on [${targetMarket.shortName}] (Trade #${this.totalWins + this.totalLosses + 1}) ➔ Scanning for Double Identical twin digits...`;
        this.notifyStatus();
      } else {
        if (cycleCompleted) {
          this.statusMessage = `🎉 All ${pool.length} markets traded in Cycle #${this.currentCycle - 1}! Starting Cycle #${this.currentCycle} ➔ Scanning all markets at the same time, waiting for another market (≠${prevMarketShort}) to trigger...`;
        } else {
          this.statusMessage = `⚡ Scanning all ${pool.length} markets at the same time (${this.tradedMarketsInCycle.size}/${pool.length} traded in Cycle #${this.currentCycle}) ➔ Waiting for another market (≠${prevMarketShort}) to trigger...`;
        }
        this.notifyStatus();
        // Check if any other market in the pool already has an active trigger ready
        this.checkAllMarketsForTrigger();
      }
    };

    if (delay === 0) {
      queueMicrotask(proceedToNext);
    } else {
      this.nextTradeTimer = window.setTimeout(proceedToNext, delay);
    }
  }

  private calculateNextStake(wasWin: boolean) {
    const { baseStake, stakeMode, martingaleMultiplier, maxMartingaleSteps, compoundingPercent } = this.config;

    if (wasWin) {
      if (stakeMode === 'COMPOUNDING') {
        const compoundBoost = (this.consecutiveWinProfitAccumulator * (compoundingPercent / 100));
        this.currentStake = Number((baseStake + compoundBoost).toFixed(2));
      } else if (stakeMode === 'HYBRID') {
        const compoundBoost = (this.consecutiveWinProfitAccumulator * 0.25);
        this.currentStake = Number((baseStake + compoundBoost).toFixed(2));
      } else {
        this.currentStake = baseStake;
      }
    } else {
      if (stakeMode === 'MARTINGALE' || stakeMode === 'HYBRID') {
        if (this.currentMartingaleStep >= maxMartingaleSteps) {
          this.currentStake = baseStake;
          this.currentMartingaleStep = 0;
        } else {
          this.currentStake = Number((this.currentStake * martingaleMultiplier).toFixed(2));
        }
      } else {
        this.currentStake = baseStake;
      }
    }

    if (this.currentStake < 0.35) this.currentStake = 0.35;
    if (this.currentStake > 5000) this.currentStake = 5000;
  }

  public triggerManualDiffer(symbol: MarketSymbol) {
    const liveState = this.marketStates.get(symbol);
    const pool = this.getMarketPool();
    const market = pool.find((m) => m.symbol === symbol) || pool[0] || ASCENDING_VOLATILITY_MARKETS[0];
    let differDigit = liveState ? liveState.lastDigit : 0;
    if (differDigit === undefined || !Number.isInteger(differDigit) || differDigit < 0 || differDigit > 9) {
      differDigit = Math.floor(Math.random() * 10);
    }

    try {
      derivWS.purchaseContract({
        symbol: market.symbol,
        symbolName: market.name,
        contractType: 'DIGITDIFF',
        stake: this.config.baseStake,
        durationTicks: this.config.durationTicks,
        durationUnit: 't',
        targetDigit: differDigit,
      });
      soundManager.playButtonClick();
    } catch (err) {
      console.error('Manual trade trigger error:', err);
    }
  }

  /**
   * Quick Manual Entry Point Differ Trigger on selected market
   */
  public triggerManualEntryPointDiffer(symbol?: MarketSymbol, digit?: number) {
    const sym = symbol || this.config.entryPointMarketSymbol || 'R_100';
    const market = ASCENDING_VOLATILITY_MARKETS.find((m) => m.symbol === sym) || ASCENDING_VOLATILITY_MARKETS[0];
    const targetDigit = digit !== undefined ? digit : (this.config.entryPointTargetDigit !== undefined ? this.config.entryPointTargetDigit : 5);

    try {
      derivWS.purchaseContract({
        symbol: market.symbol,
        symbolName: market.name,
        contractType: 'DIGITDIFF',
        stake: this.config.baseStake,
        durationTicks: 1,
        durationUnit: 't',
        targetDigit: targetDigit,
      });
      soundManager.playButtonClick();
    } catch (err) {
      console.error('Manual entry point differ trigger error:', err);
    }
  }

  /**
   * Quick Manual Double Identical Differ Sniper Trigger on any market
   */
  public triggerManualDoubleDiffer(symbol: MarketSymbol, twinDigit: number) {
    const pool = this.getMarketPool();
    const market = pool.find((m) => m.symbol === symbol) || pool[0] || ASCENDING_VOLATILITY_MARKETS[0];

    try {
      derivWS.purchaseContract({
        symbol: market.symbol,
        symbolName: market.name,
        contractType: 'DIGITDIFF',
        stake: this.config.baseStake,
        durationTicks: this.config.durationTicks || 1,
        durationUnit: 't',
        targetDigit: twinDigit,
      });
      soundManager.playButtonClick();
    } catch (err) {
      console.error('Manual double differ trigger error:', err);
    }
  }

  /**
   * Quick Manual Master Double Differ Trigger on any market
   */
  public triggerManualMasterDouble(symbol: MarketSymbol, twinDigit: number, targetDigit: number) {
    const pool = this.getMarketPool();
    const market = pool.find((m) => m.symbol === symbol) || pool[0] || ASCENDING_VOLATILITY_MARKETS[0];

    try {
      derivWS.purchaseContract({
        symbol: market.symbol,
        symbolName: market.name,
        contractType: 'DIGITDIFF',
        stake: this.config.baseStake,
        durationTicks: this.config.durationTicks || 1,
        durationUnit: 't',
        targetDigit: targetDigit,
      });
      soundManager.playButtonClick();
    } catch (err) {
      console.error('Manual master double trigger error:', err);
    }
  }

  /**
   * Toggle pattern inclusion for Master Double [2] (0..8)
   */
  public toggleMasterDouble2Pattern(twinDigit: number) {
    const current = this.config.masterDouble2SelectedPatterns && this.config.masterDouble2SelectedPatterns.length > 0
      ? this.config.masterDouble2SelectedPatterns
      : [0, 1, 2, 3, 4, 5, 6, 7, 8];

    let next: number[];
    if (current.includes(twinDigit)) {
      if (current.length === 1) return; // Keep at least one pattern active
      next = current.filter((d) => d !== twinDigit);
    } else {
      next = [...current, twinDigit].sort((a, b) => a - b);
    }

    this.config.masterDouble2SelectedPatterns = next;
    this.saveConfig(this.config);
    soundManager.playButtonClick();
    this.notifyStatus();
  }

  /**
   * Select or deselect all patterns in Master Double [2]
   */
  public setMasterDouble2AllPatterns(selectAll: boolean) {
    this.config.masterDouble2SelectedPatterns = selectAll ? [0, 1, 2, 3, 4, 5, 6, 7, 8] : [0];
    this.saveConfig(this.config);
    soundManager.playButtonClick();
    this.notifyStatus();
  }

  public triggerManualMasterDouble2(symbol: MarketSymbol, twinDigit: number, targetDigit: number) {
    this.triggerManualMasterDouble(symbol, twinDigit, targetDigit);
  }
}

export const systemAutoEngine = new SystemAutoDifferEngine();
