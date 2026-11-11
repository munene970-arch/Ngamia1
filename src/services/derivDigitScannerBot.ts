import { MarketSymbol, Tick, ActiveContract } from '../types/deriv';
import { derivWS, extractDerivLastDigit, formatDerivQuote, getMarketPipSize } from './derivWebSocket';
import { soundManager } from '../utils/soundEffects';

export interface VolatilityScannerMarket {
  symbol: MarketSymbol;
  name: string;
  shortName: string;
  volatility: number;
  isOneSecond: boolean;
  pipSize: number;
}

export const SCANNER_ASCENDING_MARKETS: VolatilityScannerMarket[] = [
  { symbol: 'R_10', name: 'Volatility 10 Index', shortName: 'Vol 10', volatility: 10, isOneSecond: false, pipSize: 3 },
  { symbol: 'R_25', name: 'Volatility 25 Index', shortName: 'Vol 25', volatility: 25, isOneSecond: false, pipSize: 3 },
  { symbol: 'R_50', name: 'Volatility 50 Index', shortName: 'Vol 50', volatility: 50, isOneSecond: false, pipSize: 4 },
  { symbol: 'R_75', name: 'Volatility 75 Index', shortName: 'Vol 75', volatility: 75, isOneSecond: false, pipSize: 4 },
  { symbol: 'R_100', name: 'Volatility 100 Index', shortName: 'Vol 100', volatility: 100, isOneSecond: false, pipSize: 2 },
];

export const SCANNER_1S_ASCENDING_MARKETS: VolatilityScannerMarket[] = [
  { symbol: '1HZ10V', name: 'Volatility 10 (1s) Index', shortName: 'Vol 10 (1s)', volatility: 10, isOneSecond: true, pipSize: 2 },
  { symbol: '1HZ15V', name: 'Volatility 15 (1s) Index', shortName: 'Vol 15 (1s)', volatility: 15, isOneSecond: true, pipSize: 2 },
  { symbol: '1HZ25V', name: 'Volatility 25 (1s) Index', shortName: 'Vol 25 (1s)', volatility: 25, isOneSecond: true, pipSize: 2 },
  { symbol: '1HZ30V', name: 'Volatility 30 (1s) Index', shortName: 'Vol 30 (1s)', volatility: 30, isOneSecond: true, pipSize: 2 },
  { symbol: '1HZ50V', name: 'Volatility 50 (1s) Index', shortName: 'Vol 50 (1s)', volatility: 50, isOneSecond: true, pipSize: 2 },
  { symbol: '1HZ75V', name: 'Volatility 75 (1s) Index', shortName: 'Vol 75 (1s)', volatility: 75, isOneSecond: true, pipSize: 2 },
  { symbol: '1HZ90V', name: 'Volatility 90 (1s) Index', shortName: 'Vol 90 (1s)', volatility: 90, isOneSecond: true, pipSize: 2 },
  { symbol: '1HZ100V', name: 'Volatility 100 (1s) Index', shortName: 'Vol 100 (1s)', volatility: 100, isOneSecond: true, pipSize: 2 },
];

export const ALL_SCANNER_MARKETS: VolatilityScannerMarket[] = [
  ...SCANNER_ASCENDING_MARKETS,
  ...SCANNER_1S_ASCENDING_MARKETS,
].sort((a, b) => a.volatility - b.volatility || (a.isOneSecond ? 1 : -1));

export type ScannerMarketScope =
  | 'COMBINED_ALL'
  | 'STANDARD_10_TO_100'
  | 'ONESECOND_10_TO_100'
  | 'ALL_PLUS_HIGH_VOL';

export type ScannerStakeMode =
  | 'COMPOUND'
  | 'COMPOUND_STEPS'
  | 'BALANCE_PERCENT'
  | 'MARTINGALE'
  | 'DALEMBERT'
  | 'REVERSE_DALEMBERT'
  | 'FIBONACCI'
  | 'PAROLI'
  | 'OSCARS_GRIND'
  | 'KELLY_CRITERION'
  | 'FLAT';

export type StreakRepeatMode =
  | '3_OR_4_REPEATS'    // User Strategy: Triggers on 3 or 4 repeats followed by streak breaker (e.g. 4,4,4,5 or 6,6,6,6,4)
  | '3_REPEATS_ONLY'    // Exactly 3 repeats + breaker (e.g. 4,4,4,5)
  | '4_REPEATS_ONLY'    // Exactly 4 repeats + breaker (e.g. 6,6,6,6,4)
  | '3_OR_MORE_REPEATS';// 3 or more repeats + breaker (e.g. 3x, 4x, 5x+)

export type ScannerExecutionMode =
  | 'STREAK_BREAK_SNIPER'        // Primary Strategy: Scans all markets simultaneously, buys Differ on immediate breaker digit
  | 'STREAK_BREAK_WITH_AI_FILTER'// Streak break + AI Safety gate verification
  | 'SEQUENTIAL_STREAK_SCANNER'; // Steps Vol 10 ➔ 100 looking for streak breaks

export interface ScannerBotConfig {
  baseStake: number;
  stakeMode: ScannerStakeMode;
  executionMode: ScannerExecutionMode;
  streakRepeatMode: StreakRepeatMode;
  minSafetyScore: number; // For AI filter mode
  martingaleMultiplier: number;
  maxMartingaleSteps: number;
  // Compounding options
  compoundReinvestPct: number; // e.g. 100 = 100% of profit added to stake, 50 = 50%
  compoundMaxSteps: number; // 0 = unlimited, 3 = reset to base stake after 3 wins
  compoundBalancePct: number; // For BALANCE_PERCENT mode (e.g. 1.0%, 2.0%)
  // Advanced Betting Strategies Options
  dalembertStep: number; // Step increment/decrement for D'Alembert
  paroliConsecutiveTarget: number; // Consecutive wins target before banking (e.g. 3)
  paroliMultiplier: number; // Multiplier on win for Paroli (e.g. 2x)
  kellyFraction: number; // Fraction of optimal Kelly criterion (e.g. 0.25 = 25% Kelly)
  oscarsTargetUnit: number; // Cycle target units for Oscar's Grind (default 1 unit)
  maxStakeCap: number; // Safety maximum stake ceiling (0 = uncapped)
  durationTicks: number;
  marketScope: ScannerMarketScope;
  sampleTicks: number;
  takeProfit: number; // 0 = unlimited
  stopLoss: number; // 0 = unlimited
  delayBetweenTradesMs: number;
  lossCooldownSeconds: number; // Pause after loss to protect capital
  maxConsecutiveLosses: number; // Safety stop if loss streak hits threshold
  continuousTrading: boolean; // Continuous infinite loop vs single cycle
}

export interface ScannerTradeRecord {
  id: string;
  timestamp: number;
  timeString: string;
  symbol: MarketSymbol;
  marketName: string;
  redBarDigit: number;
  streakDigit?: number;
  streakCount?: number;
  safetyScore: number;
  markovRiskPct: number;
  reason: string;
  patternString?: string;
  exitDigit: number | null;
  stake: number;
  profit: number;
  result: 'WIN' | 'LOSS' | 'OPEN';
  durationTicks: number;
  entrySpot: number;
  exitSpot?: number;
  cycle: number;
  balanceAfter?: number;
}

export interface DigitAiSafetyMetric {
  digit: number;
  safetyScore: number; // 0.0 - 99.9%
  markovRiskPct: number; // Probability of jumping to this digit from current spot
  microFreqPct: number; // 25-tick frequency %
  midFreqPct: number; // 100-tick frequency %
  macroFreqPct: number; // 300-tick frequency %
  ticksSinceLastSeen: number;
  burstHazard: boolean; // recent cluster flag
  repeatHazard: boolean; // is current digit or immediate repeat risk
  ratingTier: 'ULTRA_SAFE' | 'HIGH_SAFETY' | 'MODERATE' | 'HAZARD';
  safetyReason: string;
}

export interface StreakBreakSetup {
  isTriggerReady: boolean;
  streakDigit: number; // e.g. 4 or 6
  streakCount: number; // e.g. 3 or 4
  breakerDigit: number; // e.g. 5 or 4 (Target for DIGITDIFF)
  patternSequence: number[]; // e.g. [4, 4, 4, 5]
  patternLabel: string; // e.g. "4, 4, 4 ➔ 5 (3x Streak Break)"
  triggerTimestamp: number;
  // In-progress streak tracking
  activeStreakDigit: number;
  activeStreakCount: number;
  activeStreakLabel: string;
}

export interface MarketDigitAnalysis {
  symbol: MarketSymbol;
  name: string;
  shortName: string;
  lastPrice: number;
  lastDigit: number;
  digitCounts: number[];
  digitPercentages: number[];
  redBarDigit: number;
  redBarPercentage: number;
  greenBarDigit: number;
  greenBarPercentage: number;
  ticksCount: number;
  // Streak Break Strategy Analytics
  streakSetup: StreakBreakSetup;
  recentDigits: number[]; // Last 10 digits
  // AI Enhanced Analytics
  safestDigit: number;
  safestScore: number; // AI Composite Safety Score %
  safestMarkovRisk: number; // P(D_next = safest | D_curr) %
  safestAbsenceTicks: number; // Ticks since safest digit appeared
  safestRatingTier: 'ULTRA_SAFE' | 'HIGH_SAFETY' | 'MODERATE' | 'HAZARD';
  digitMetrics: DigitAiSafetyMetric[];
  markovMatrix: number[][]; // 10x10 transition matrix
  shannonEntropy: number;
  isSafeToTrade: boolean;
  safetySummary: string;
}

export interface ScannerBotStatus {
  isRunning: boolean;
  isSettling: boolean;
  isAnalyzing: boolean;
  isWaitingForSetup: boolean;
  currentMarketIndex: number;
  currentMarket: VolatilityScannerMarket;
  nextMarket: VolatilityScannerMarket;
  activeRedBarDigit: number | null;
  activeRedBarPct: number | null;
  activeSafetyScore: number | null;
  activeMarkovRisk: number | null;
  activePatternLabel: string | null;
  currentStake: number;
  totalTrades: number;
  totalWins: number;
  totalLosses: number;
  winRate: number;
  netProfit: number;
  consecutiveWins: number;
  consecutiveLosses: number;
  maxConsecutiveWins: number;
  currentMartingaleStep: number;
  compoundStep: number;
  currentCycle: number;
  activeContractId: string | null;
  statusMessage: string;
  stopReason: string | null;
  lastSettledProfit: number | null;
  lastSettledBalance: number | null;
  lastSettledMarketName: string | null;
  topSafetyMarket: VolatilityScannerMarket | null;
  topSafetyScore: number;
  topSafestDigit: number;
  readyStreakMarketsCount: number;
}

type StatusListener = (status: ScannerBotStatus) => void;
type TradeListener = (trades: ScannerTradeRecord[]) => void;
type AnalysisListener = (analysis: Record<string, MarketDigitAnalysis>) => void;
type BalanceUpdater = (profit: number, newBalance: number) => void;

const FIBONACCI_STEPS = [1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89];

class DerivDigitScannerBotEngine {
  private config: ScannerBotConfig = {
    baseStake: 1.0,
    stakeMode: 'COMPOUND',
    executionMode: 'STREAK_BREAK_SNIPER',
    streakRepeatMode: '3_OR_4_REPEATS',
    minSafetyScore: 85.0,
    martingaleMultiplier: 11.0,
    maxMartingaleSteps: 2,
    compoundReinvestPct: 100, // 100% of profit compounded
    compoundMaxSteps: 0, // 0 = unlimited compounding
    compoundBalancePct: 2.0, // 2% of account balance
    dalembertStep: 0.35,
    paroliConsecutiveTarget: 3,
    paroliMultiplier: 2.0,
    kellyFraction: 0.25,
    oscarsTargetUnit: 1,
    maxStakeCap: 0, // 0 = uncapped
    durationTicks: 1,
    marketScope: 'COMBINED_ALL',
    sampleTicks: 100,
    takeProfit: 0, // 0 = unlimited
    stopLoss: 0, // 0 = unlimited
    delayBetweenTradesMs: 600,
    lossCooldownSeconds: 3,
    maxConsecutiveLosses: 3,
    continuousTrading: true,
  };

  private statusListeners: Set<StatusListener> = new Set();
  private tradeListeners: Set<TradeListener> = new Set();
  private analysisListeners: Set<AnalysisListener> = new Set();
  private balanceUpdater: BalanceUpdater | null = null;

  private accountBalance: number = 0;
  private startBalance: number = 0;
  private trades: ScannerTradeRecord[] = [];

  // Market tick history cache
  private marketTicks: Map<MarketSymbol, number[]> = new Map();
  private marketAnalyses: Map<MarketSymbol, MarketDigitAnalysis> = new Map();
  // Prevent duplicate execution on the same tick setup
  private lastTradedPatternKeys: Map<MarketSymbol, string> = new Map();

  private executionTimeout: any = null;
  private contractListenersRegistered = false;
  private marketListenersRegistered = false;
  private isEvaluating = false;
  private fibonacciIndex: number = 0;
  private oscarsCycleProfit: number = 0;
  private dalembertStepCount: number = 0;

  private status: ScannerBotStatus = {
    isRunning: false,
    isSettling: false,
    isAnalyzing: false,
    isWaitingForSetup: false,
    currentMarketIndex: 0,
    currentMarket: SCANNER_ASCENDING_MARKETS[0],
    nextMarket: SCANNER_ASCENDING_MARKETS[1],
    activeRedBarDigit: null,
    activeRedBarPct: null,
    activeSafetyScore: null,
    activeMarkovRisk: null,
    activePatternLabel: null,
    currentStake: 1.0,
    totalTrades: 0,
    totalWins: 0,
    totalLosses: 0,
    winRate: 0,
    netProfit: 0,
    consecutiveWins: 0,
    consecutiveLosses: 0,
    maxConsecutiveWins: 0,
    currentMartingaleStep: 0,
    compoundStep: 0,
    currentCycle: 1,
    activeContractId: null,
    statusMessage: 'Ready to scan Deriv markets for 3x/4x Digit Repeat Streak Breaks.',
    stopReason: null,
    lastSettledProfit: null,
    lastSettledBalance: null,
    lastSettledMarketName: null,
    topSafetyMarket: null,
    topSafetyScore: 0,
    topSafestDigit: 0,
    readyStreakMarketsCount: 0,
  };

  constructor() {
    this.initMarketSubscriptions();
  }

  public setBalance(bal: number) {
    this.accountBalance = Number(bal.toFixed(2));
    if (!this.status.isRunning && this.status.totalTrades === 0) {
      this.startBalance = this.accountBalance;
    }
  }

  public setBalanceUpdater(fn: BalanceUpdater) {
    this.balanceUpdater = fn;
  }

  public getConfig(): ScannerBotConfig {
    return { ...this.config };
  }

  public setConfig(newConfig: Partial<ScannerBotConfig>) {
    this.config = { ...this.config, ...newConfig };
    if (!this.status.isRunning) {
      this.status.currentStake = this.config.baseStake;
      this.updateMarketList();
    }
    this.notifyStatus();
  }

  public subscribeStatus(cb: StatusListener): () => void {
    this.statusListeners.add(cb);
    cb(this.getStatus());
    return () => this.statusListeners.delete(cb);
  }

  public subscribeTrades(cb: TradeListener): () => void {
    this.tradeListeners.add(cb);
    cb([...this.trades]);
    return () => this.tradeListeners.delete(cb);
  }

  public subscribeAnalysis(cb: AnalysisListener): () => void {
    this.analysisListeners.add(cb);
    cb(this.getAllAnalyses());
    return () => this.analysisListeners.delete(cb);
  }

  public getStatus(): ScannerBotStatus {
    return { ...this.status };
  }

  public getTrades(): ScannerTradeRecord[] {
    return [...this.trades];
  }

  public getAllAnalyses(): Record<string, MarketDigitAnalysis> {
    const res: Record<string, MarketDigitAnalysis> = {};
    this.marketAnalyses.forEach((v, k) => {
      res[k] = { ...v };
    });
    return res;
  }

  public getActiveMarketList(): VolatilityScannerMarket[] {
    switch (this.config.marketScope) {
      case 'ONESECOND_10_TO_100':
        return SCANNER_1S_ASCENDING_MARKETS;
      case 'STANDARD_10_TO_100':
        return SCANNER_ASCENDING_MARKETS;
      case 'ALL_PLUS_HIGH_VOL':
      case 'COMBINED_ALL':
      default:
        return ALL_SCANNER_MARKETS;
    }
  }

  private updateMarketList() {
    const markets = this.getActiveMarketList();
    const curIdx = Math.min(this.status.currentMarketIndex, markets.length - 1);
    this.status.currentMarketIndex = curIdx;
    this.status.currentMarket = markets[curIdx] || markets[0];
    this.status.nextMarket = markets[(curIdx + 1) % markets.length] || markets[0];
  }

  private initMarketSubscriptions() {
    if (this.marketListenersRegistered) return;
    this.marketListenersRegistered = true;

    ALL_SCANNER_MARKETS.forEach((m) => {
      derivWS.subscribeHistory(m.symbol, (data) => {
        if (data.prices && data.prices.length > 0) {
          const list = data.prices.slice(-500);
          this.marketTicks.set(m.symbol, list);
          this.computeMarketAnalysis(m.symbol);
        }
      });

      derivWS.subscribeTicks(m.symbol, (tick: Tick) => {
        const existing = this.marketTicks.get(m.symbol) || [];
        const updated = [...existing, tick.quote].slice(-500);
        this.marketTicks.set(m.symbol, updated);
        this.computeMarketAnalysis(m.symbol);
        
        // If bot is running, immediately check if this tick triggers a streak break trade
        if (this.status.isRunning && !this.status.isSettling && !this.status.activeContractId && !this.isEvaluating) {
          this.executeAiTrade();
        }
      });

      derivWS.requestTicksHistory(m.symbol, 300);
    });

    if (!this.contractListenersRegistered) {
      this.contractListenersRegistered = true;
      derivWS.subscribeContracts(this.handleContractUpdate.bind(this));
    }
  }

  /**
   * Comprehensive Multi-Horizon AI Digit Behavior, Streak Break Scanner & Markov Transition Engine
   */
  public computeMarketAnalysis(symbol: MarketSymbol): MarketDigitAnalysis | null {
    const prices = this.marketTicks.get(symbol);
    if (!prices || prices.length < 15) return null;

    const pip = getMarketPipSize(symbol);
    const lastPrice = prices[prices.length - 1];
    const lastDigit = extractDerivLastDigit(lastPrice, pip, symbol);

    // Extract all historical digits
    const allDigits = prices.map((p) => extractDerivLastDigit(p, pip, symbol)).filter((d) => d >= 0 && d <= 9);
    const totalTicks = allDigits.length;
    if (totalTicks < 15) return null;

    // Horizon slices
    const microSample = allDigits.slice(-25);
    const midSample = allDigits.slice(-100);
    const macroSample = allDigits.slice(-300);

    // Frequencies across horizons
    const microCounts = new Array(10).fill(0);
    const midCounts = new Array(10).fill(0);
    const macroCounts = new Array(10).fill(0);

    microSample.forEach((d) => microCounts[d]++);
    midSample.forEach((d) => midCounts[d]++);
    macroSample.forEach((d) => macroCounts[d]++);

    const microPcts = microCounts.map((c) => Number(((c / microSample.length) * 100).toFixed(1)));
    const midPcts = midCounts.map((c) => Number(((c / midSample.length) * 100).toFixed(1)));
    const macroPcts = macroCounts.map((c) => Number(((c / macroSample.length) * 100).toFixed(1)));

    // ==========================================
    // 🎯 USER STRATEGY: STREAK BREAK DETECTION
    // Strategy: Finds a digit that occurred 3x or 4x, and triggers on the immediate breaker digit
    // e.g., 4, 4, 4, 5 ➔ Buy Differ 5
    // e.g., 6, 6, 6, 6, 4 ➔ Buy Differ 4
    // ==========================================
    const len = allDigits.length;
    let isTriggerReady = false;
    let streakDigit = 0;
    let streakCount = 0;
    let breakerDigit = lastDigit;
    let patternSequence: number[] = [];
    let patternLabel = 'No active streak break';

    // 1. Check if the current tick is the immediate breaker of a preceding streak
    if (len >= 4) {
      const prevDigit = allDigits[len - 2];
      // Only a streak break if current tick is different from previous tick!
      if (lastDigit !== prevDigit) {
        // Count how many times prevDigit repeated immediately before lastDigit
        let count = 0;
        for (let i = len - 2; i >= 0; i--) {
          if (allDigits[i] === prevDigit) {
            count++;
          } else {
            break;
          }
        }

        streakDigit = prevDigit;
        streakCount = count;
        breakerDigit = lastDigit;

        // Check if streakCount matches user requirement
        let matchesRequirement = false;
        if (this.config.streakRepeatMode === '3_OR_4_REPEATS') {
          matchesRequirement = count === 3 || count === 4;
        } else if (this.config.streakRepeatMode === '3_REPEATS_ONLY') {
          matchesRequirement = count === 3;
        } else if (this.config.streakRepeatMode === '4_REPEATS_ONLY') {
          matchesRequirement = count === 4;
        } else if (this.config.streakRepeatMode === '3_OR_MORE_REPEATS') {
          matchesRequirement = count >= 3;
        }

        if (matchesRequirement) {
          isTriggerReady = true;
          patternSequence = allDigits.slice(-(count + 1));
          patternLabel = `[${patternSequence.slice(0, -1).join(', ')} ➔ ${breakerDigit}] (${count}x Streak Break)`;
        }
      }
    }

    // 2. Track in-progress building streak (for live HUD alerts: e.g. [4, 4, 4] currently active!)
    let activeStreakCount = 0;
    const activeStreakDigit = lastDigit;
    for (let i = len - 1; i >= 0; i--) {
      if (allDigits[i] === activeStreakDigit) {
        activeStreakCount++;
      } else {
        break;
      }
    }
    const activeStreakLabel =
      activeStreakCount >= 3
        ? `🔥 ${activeStreakCount}x Repeat of Digit ${activeStreakDigit} (Awaiting breaker tick...)`
        : activeStreakCount === 2
        ? `⚡ 2x Repeat of Digit ${activeStreakDigit}`
        : `1x Spot (${activeStreakDigit})`;

    const streakSetup: StreakBreakSetup = {
      isTriggerReady,
      streakDigit,
      streakCount,
      breakerDigit,
      patternSequence,
      patternLabel,
      triggerTimestamp: Date.now(),
      activeStreakDigit,
      activeStreakCount,
      activeStreakLabel,
    };

    // 10x10 Markov Transition Matrix
    const transitionMatrix: number[][] = Array.from({ length: 10 }, () => new Array(10).fill(0));
    for (let i = 0; i < allDigits.length - 1; i++) {
      const from = allDigits[i];
      const to = allDigits[i + 1];
      if (from >= 0 && from <= 9 && to >= 0 && to <= 9) {
        transitionMatrix[from][to]++;
      }
    }

    // Conditional probability of jumping from current lastDigit to next digit
    const currentTransitions = transitionMatrix[lastDigit] || new Array(10).fill(0);
    const currentTotalTransitions = currentTransitions.reduce((a, b) => a + b, 0);

    // Ticks since last seen for each digit (absence dormancy)
    const ticksSinceLastSeen = new Array(10).fill(0);
    for (let d = 0; d < 10; d++) {
      let seenDist = 0;
      let found = false;
      for (let i = allDigits.length - 1; i >= 0; i--) {
        if (allDigits[i] === d) {
          ticksSinceLastSeen[d] = seenDist;
          found = true;
          break;
        }
        seenDist++;
      }
      if (!found) ticksSinceLastSeen[d] = allDigits.length;
    }

    // Shannon Entropy of digit distribution
    let entropy = 0;
    midPcts.forEach((pct) => {
      if (pct > 0) {
        const p = pct / 100;
        entropy -= p * Math.log2(p);
      }
    });
    const normalizedEntropy = Math.min(1.0, entropy / 3.3219);

    // Recent 5-tick cluster burst check
    const recent5 = allDigits.slice(-5);
    const recent5Counts = new Array(10).fill(0);
    recent5.forEach((d) => recent5Counts[d]++);

    // Compute AI Safety Metrics for each digit 0-9
    const digitMetrics: DigitAiSafetyMetric[] = [];

    for (let d = 0; d < 10; d++) {
      // 1. Markov Risk %
      let markovRiskPct = 10.0;
      if (currentTotalTransitions > 0) {
        markovRiskPct = Number(((currentTransitions[d] / currentTotalTransitions) * 100).toFixed(1));
      }
      const markovScore = Math.max(0, 100 - markovRiskPct * 5);

      // 2. Multi-Horizon Frequency
      const microF = microPcts[d] ?? 10.0;
      const midF = midPcts[d] ?? 10.0;
      const macroF = macroPcts[d] ?? 10.0;
      const weightedFreq = 0.40 * microF + 0.40 * midF + 0.20 * macroF;
      let freqScore = Math.max(0, Math.min(100, (15 - weightedFreq) * 8.33));

      // 3. Absence / Dormancy Score
      const absence = ticksSinceLastSeen[d];
      let absenceScore = 75;
      if (absence === 0) {
        absenceScore = 15;
      } else if (absence === 1) {
        absenceScore = 45;
      } else if (absence >= 15) {
        absenceScore = Math.min(100, 75 + (absence - 15) * 1.5);
      }

      // 4. Repeat & Burst Hazards
      const repeatHazard = d === lastDigit || (recent5.length >= 2 && recent5[recent5.length - 2] === d);
      const burstHazard = recent5Counts[d] >= 2;

      let penalty = 0;
      if (repeatHazard) penalty += 25;
      if (burstHazard) penalty += 20;

      const rawComposite =
        0.38 * markovScore +
        0.32 * freqScore +
        0.18 * absenceScore +
        0.12 * (normalizedEntropy * 100) -
        penalty;

      const safetyScore = Number(Math.max(5.0, Math.min(99.4, rawComposite)).toFixed(1));

      let ratingTier: 'ULTRA_SAFE' | 'HIGH_SAFETY' | 'MODERATE' | 'HAZARD' = 'MODERATE';
      if (safetyScore >= 92.0 && markovRiskPct <= 5.0 && !repeatHazard && !burstHazard) {
        ratingTier = 'ULTRA_SAFE';
      } else if (safetyScore >= 85.0 && markovRiskPct <= 9.0) {
        ratingTier = 'HIGH_SAFETY';
      } else if (safetyScore < 75.0 || repeatHazard || burstHazard || markovRiskPct >= 15.0) {
        ratingTier = 'HAZARD';
      }

      let safetyReason = `P(next|curr)=${markovRiskPct}%, Freq=${weightedFreq.toFixed(1)}%, Absent ${absence}t`;
      if (d === breakerDigit && isTriggerReady) {
        safetyReason = `🎯 Streak Breaker: Differ Digit ${d} after ${streakCount}x repeat of ${streakDigit}`;
      } else if (ratingTier === 'ULTRA_SAFE') {
        safetyReason = `🛡️ Ultra-Cold Consensus: 0-5% Markov Jump Risk & multi-horizon dormancy`;
      } else if (ratingTier === 'HIGH_SAFETY') {
        safetyReason = `✨ High Safety: Freq ${weightedFreq.toFixed(1)}% with low Markov recurrence`;
      }

      digitMetrics.push({
        digit: d,
        safetyScore,
        markovRiskPct,
        microFreqPct: microF,
        midFreqPct: midF,
        macroFreqPct: macroF,
        ticksSinceLastSeen: absence,
        burstHazard,
        repeatHazard,
        ratingTier,
        safetyReason,
      });
    }

    // Mid 100-tick min/max
    let minMidCount = Infinity;
    let minMidDigit = 0;
    let maxMidCount = -1;
    let maxMidDigit = 0;

    for (let i = 0; i < 10; i++) {
      if (midCounts[i] < minMidCount) {
        minMidCount = midCounts[i];
        minMidDigit = i;
      }
      if (midCounts[i] > maxMidCount) {
        maxMidCount = midCounts[i];
        maxMidDigit = i;
      }
    }

    // Highest safety score digit
    let bestSafetyScore = -1;
    let bestDigit = minMidDigit;

    digitMetrics.forEach((m) => {
      if (m.safetyScore > bestSafetyScore) {
        bestSafetyScore = m.safetyScore;
        bestDigit = m.digit;
      }
    });

    const bestMetric = digitMetrics[bestDigit] || digitMetrics[0];
    const allMarkets = ALL_SCANNER_MARKETS;
    const info = allMarkets.find((m) => m.symbol === symbol);

    const isSafe = bestSafetyScore >= this.config.minSafetyScore && bestMetric.ratingTier !== 'HAZARD';

    const analysis: MarketDigitAnalysis = {
      symbol,
      name: info?.name || symbol,
      shortName: info?.shortName || symbol,
      lastPrice,
      lastDigit,
      digitCounts: midCounts,
      digitPercentages: midPcts,
      redBarDigit: minMidDigit,
      redBarPercentage: midPcts[minMidDigit] ?? 10.0,
      greenBarDigit: maxMidDigit,
      greenBarPercentage: midPcts[maxMidDigit] ?? 10.0,
      ticksCount: totalTicks,
      streakSetup,
      recentDigits: allDigits.slice(-10),
      safestDigit: isTriggerReady ? breakerDigit : bestDigit,
      safestScore: isTriggerReady ? 95.0 : bestSafetyScore,
      safestMarkovRisk: digitMetrics[breakerDigit]?.markovRiskPct || bestMetric.markovRiskPct,
      safestAbsenceTicks: digitMetrics[breakerDigit]?.ticksSinceLastSeen || bestMetric.ticksSinceLastSeen,
      safestRatingTier: isTriggerReady ? 'ULTRA_SAFE' : bestMetric.ratingTier,
      digitMetrics,
      markovMatrix: transitionMatrix,
      shannonEntropy: Number((normalizedEntropy * 100).toFixed(1)),
      isSafeToTrade: isSafe || isTriggerReady,
      safetySummary: isTriggerReady
        ? `🔥 STREAK TRIGGER: Differ Digit ${breakerDigit} (Broke ${streakCount}x repeat of ${streakDigit})`
        : `Safest: Differ Digit ${bestDigit} (${bestSafetyScore}% Safety | Markov Risk ${bestMetric.markovRiskPct}%)`,
    };

    this.marketAnalyses.set(symbol, analysis);
    this.updateGlobalTopSafety();
    this.notifyAnalysis();
    return analysis;
  }

  private updateGlobalTopSafety() {
    const markets = this.getActiveMarketList();
    let topScore = -1;
    let topMarket: VolatilityScannerMarket | null = null;
    let topDigit = 0;
    let readyCount = 0;

    markets.forEach((m) => {
      const a = this.marketAnalyses.get(m.symbol);
      if (a) {
        if (a.streakSetup?.isTriggerReady) {
          readyCount++;
        }
        if (a.safestScore > topScore) {
          topScore = a.safestScore;
          topMarket = m;
          topDigit = a.safestDigit;
        }
      }
    });

    this.status.readyStreakMarketsCount = readyCount;
    if (topMarket) {
      this.status.topSafetyMarket = topMarket;
      this.status.topSafetyScore = topScore;
      this.status.topSafestDigit = topDigit;
    }
  }

  public start() {
    if (this.status.isRunning) return;

    this.startBalance = this.accountBalance;
    this.status.isRunning = true;
    this.status.isSettling = false;
    this.status.isAnalyzing = false;
    this.status.isWaitingForSetup = false;
    this.status.stopReason = null;
    this.status.currentMartingaleStep = 0;
    this.status.compoundStep = 0;
    this.fibonacciIndex = 0;
    this.oscarsCycleProfit = 0;
    this.dalembertStepCount = 0;
    this.lastTradedPatternKeys.clear();

    if (this.config.stakeMode === 'BALANCE_PERCENT' && this.accountBalance > 0) {
      let initStake = this.accountBalance * (this.config.compoundBalancePct / 100);
      if (this.config.maxStakeCap > 0 && initStake > this.config.maxStakeCap) initStake = this.config.maxStakeCap;
      this.status.currentStake = Math.max(0.35, Number(initStake.toFixed(2)));
    } else if (this.config.stakeMode === 'KELLY_CRITERION' && this.accountBalance > 0) {
      let initStake = this.accountBalance * (this.config.kellyFraction || 0.25) * 0.08;
      if (this.config.maxStakeCap > 0 && initStake > this.config.maxStakeCap) initStake = this.config.maxStakeCap;
      this.status.currentStake = Math.max(0.35, Number(initStake.toFixed(2)));
    } else {
      let initStake = this.config.baseStake;
      if (this.accountBalance > 0 && initStake > this.accountBalance) {
        initStake = this.accountBalance;
      }
      this.status.currentStake = Math.max(0.35, Number(initStake.toFixed(2)));
    }

    this.status.statusMessage = '🚀 3x/4x Streak Break Scanner started! Actively monitoring all Volatility markets...';
    this.updateMarketList();
    this.notifyStatus();
    soundManager.playStart();

    // Begin execution loop
    this.scheduleNextTrade(200);
  }

  public stop(reason: string = 'User stopped scanner bot') {
    if (!this.status.isRunning) return;

    if (this.executionTimeout) {
      clearTimeout(this.executionTimeout);
      this.executionTimeout = null;
    }

    this.status.isRunning = false;
    this.status.isSettling = false;
    this.status.isAnalyzing = false;
    this.status.isWaitingForSetup = false;
    this.status.stopReason = reason;
    this.status.statusMessage = `🛑 Scanner stopped: ${reason}`;
    this.notifyStatus();
    soundManager.playLoss();
  }

  public resetStats() {
    this.trades = [];
    this.lastTradedPatternKeys.clear();
    this.status.totalTrades = 0;
    this.status.totalWins = 0;
    this.status.totalLosses = 0;
    this.status.winRate = 0;
    this.status.netProfit = 0;
    this.status.consecutiveWins = 0;
    this.status.consecutiveLosses = 0;
    this.status.maxConsecutiveWins = 0;
    this.status.currentMartingaleStep = 0;
    this.status.compoundStep = 0;
    this.fibonacciIndex = 0;
    this.oscarsCycleProfit = 0;
    this.dalembertStepCount = 0;
    this.status.currentCycle = 1;
    this.status.currentMarketIndex = 0;
    this.status.activeContractId = null;
    this.status.lastSettledProfit = null;
    this.status.lastSettledBalance = null;
    this.status.lastSettledMarketName = null;
    this.status.activePatternLabel = null;
    this.status.currentStake = this.config.baseStake;
    this.updateMarketList();
    this.notifyStatus();
    this.notifyTrades();
  }

  private scheduleNextTrade(delayMs: number) {
    if (!this.status.isRunning) return;

    if (this.executionTimeout) {
      clearTimeout(this.executionTimeout);
    }

    this.executionTimeout = setTimeout(() => {
      this.executeAiTrade();
    }, delayMs);
  }

  /**
   * Main Strategy Execution Dispatcher
   * Strategy: Scans all markets for 3x or 4x digit repeat streaks that break into a new digit,
   * then buys DIGITDIFF on that immediate breaker digit!
   */
  private async executeAiTrade() {
    if (!this.status.isRunning || this.isEvaluating || this.status.isSettling || this.status.activeContractId) return;
    this.isEvaluating = true;

    try {
      // 1. Check Take Profit & Stop Loss
      if (this.config.takeProfit > 0 && this.status.netProfit >= this.config.takeProfit) {
        this.stop(`🎯 Take Profit reached (+${this.status.netProfit.toFixed(2)} USD)`);
        soundManager.playWin();
        return;
      }

      if (this.config.stopLoss > 0 && this.status.netProfit <= -Math.abs(this.config.stopLoss)) {
        this.stop(`🛑 Stop Loss reached (${this.status.netProfit.toFixed(2)} USD)`);
        soundManager.playLoss();
        return;
      }

      // 2. Safety Streak Breaker
      if (
        this.config.maxConsecutiveLosses > 0 &&
        this.status.consecutiveLosses >= this.config.maxConsecutiveLosses
      ) {
        this.stop(`🛡️ Streak Protection: Max consecutive losses (${this.status.consecutiveLosses}) hit.`);
        soundManager.playLoss();
        return;
      }

      // 3. Balance verification and auto-clamping
      if (this.accountBalance > 0) {
        if (this.status.currentStake > this.accountBalance) {
          if (this.accountBalance >= 0.35) {
            this.status.currentStake = Math.max(0.35, Number(this.accountBalance.toFixed(2)));
          } else {
            this.stop(`⚠️ Insufficient balance for next stake ($${this.status.currentStake.toFixed(2)} vs $${this.accountBalance.toFixed(2)})`);
            return;
          }
        }
      }

      // 4. Scan for 3x/4x Streak Break Opportunity across active markets
      const activeMarkets = this.getActiveMarketList();
      let selectedMarket: VolatilityScannerMarket | null = null;
      let targetDigit: number = 0;
      let streakDigit: number = 0;
      let streakCount: number = 0;
      let targetSafetyScore: number = 95.0;
      let targetMarkovRisk: number = 5.0;
      let patternString: string = '';
      let targetReason: string = '';

      if (this.config.executionMode === 'STREAK_BREAK_SNIPER' || this.config.executionMode === 'STREAK_BREAK_WITH_AI_FILTER') {
        // Evaluate ALL active markets simultaneously for ready streak breaks
        const readyCandidates: {
          market: VolatilityScannerMarket;
          analysis: MarketDigitAnalysis;
          patternKey: string;
        }[] = [];

        for (const m of activeMarkets) {
          const a = this.marketAnalyses.get(m.symbol);
          if (a && a.streakSetup?.isTriggerReady) {
            const setup = a.streakSetup;
            const patternKey = `${m.symbol}_${setup.streakDigit}x${setup.streakCount}_${setup.breakerDigit}_${a.ticksCount}`;
            
            // Check if we haven't already traded this exact tick pattern
            if (this.lastTradedPatternKeys.get(m.symbol) !== patternKey) {
              if (this.config.executionMode === 'STREAK_BREAK_WITH_AI_FILTER') {
                const breakerMetric = a.digitMetrics[setup.breakerDigit];
                if (breakerMetric && breakerMetric.safetyScore >= this.config.minSafetyScore) {
                  readyCandidates.push({ market: m, analysis: a, patternKey });
                }
              } else {
                readyCandidates.push({ market: m, analysis: a, patternKey });
              }
            }
          }
        }

        if (readyCandidates.length === 0) {
          // Find any markets currently in progress of building 3x or 4x streaks to notify user
          const building = activeMarkets
            .map((m) => ({ m, a: this.marketAnalyses.get(m.symbol) }))
            .filter((x) => x.a && x.a.streakSetup && x.a.streakSetup.activeStreakCount >= 2)
            .sort((x, y) => (y.a?.streakSetup.activeStreakCount || 0) - (x.a?.streakSetup.activeStreakCount || 0));

          this.status.isWaitingForSetup = true;
          if (building.length > 0 && building[0].a) {
            const top = building[0];
            const setup = top.a!.streakSetup;
            this.status.statusMessage = `👀 Scanning markets... [${top.m.shortName}] has ${setup.activeStreakCount}x repeat of Digit ${setup.activeStreakDigit} (Awaiting breaker tick)...`;
          } else {
            this.status.statusMessage = `🛡️ Scanning ${activeMarkets.length} markets for 3x/4x digit repeats followed by streak breaker digit...`;
          }
          this.notifyStatus();
          this.scheduleNextTrade(400);
          return;
        }

        // Prioritize 4x streaks over 3x streaks if multiple ready
        readyCandidates.sort((a, b) => b.analysis.streakSetup.streakCount - a.analysis.streakSetup.streakCount);

        const chosen = readyCandidates[0];
        selectedMarket = chosen.market;
        const setup = chosen.analysis.streakSetup;
        targetDigit = setup.breakerDigit;
        streakDigit = setup.streakDigit;
        streakCount = setup.streakCount;
        patternString = setup.patternLabel;
        targetSafetyScore = chosen.analysis.safestScore;
        targetMarkovRisk = chosen.analysis.safestMarkovRisk;
        targetReason = `Streak Break: ${chosen.market.shortName} broke ${streakCount}x repeat of Digit ${streakDigit} into Digit ${targetDigit} ➔ Buy Differ ${targetDigit}`;

        // Mark pattern as executed to avoid duplicate execution on the same tick
        this.lastTradedPatternKeys.set(selectedMarket.symbol, chosen.patternKey);
      } else {
        // SEQUENTIAL_STREAK_SCANNER (Steps Vol 10 ➔ 100 looking for streak breaks)
        const market = activeMarkets[this.status.currentMarketIndex] || activeMarkets[0];
        const analysis = this.marketAnalyses.get(market.symbol);

        if (analysis && analysis.streakSetup?.isTriggerReady) {
          const setup = analysis.streakSetup;
          const patternKey = `${market.symbol}_${setup.streakDigit}x${setup.streakCount}_${setup.breakerDigit}_${analysis.ticksCount}`;

          if (this.lastTradedPatternKeys.get(market.symbol) !== patternKey) {
            selectedMarket = market;
            targetDigit = setup.breakerDigit;
            streakDigit = setup.streakDigit;
            streakCount = setup.streakCount;
            patternString = setup.patternLabel;
            targetSafetyScore = analysis.safestScore;
            targetMarkovRisk = analysis.safestMarkovRisk;
            targetReason = `Sequential Streak: ${market.shortName} broke ${streakCount}x repeat of Digit ${streakDigit} into Digit ${targetDigit} ➔ Differ ${targetDigit}`;
            this.lastTradedPatternKeys.set(market.symbol, patternKey);
          }
        }

        if (!selectedMarket) {
          this.status.isWaitingForSetup = true;
          this.status.statusMessage = `[${market.shortName}] Waiting for 3x/4x streak break. Stepping to next index...`;
          this.notifyStatus();
          this.advanceSequentialMarket();
          this.scheduleNextTrade(300);
          return;
        }
      }

      this.status.isWaitingForSetup = false;
      this.status.currentMarket = selectedMarket;
      this.status.activeRedBarDigit = targetDigit;
      this.status.activeSafetyScore = targetSafetyScore;
      this.status.activeMarkovRisk = targetMarkovRisk;
      this.status.activePatternLabel = patternString;
      this.status.statusMessage = `🎯 [${selectedMarket.shortName}] STREAK BREAK TRIGGER! Buying Differ Digit ${targetDigit} (${patternString}) with Stake $${this.status.currentStake.toFixed(2)}...`;
      this.notifyStatus();

      // 5. Execute Deriv DIGITDIFF contract
      const contract = derivWS.purchaseContract({
        symbol: selectedMarket.symbol,
        contractType: 'DIGITDIFF',
        stake: this.status.currentStake,
        durationTicks: this.config.durationTicks,
        targetDigit,
        symbolName: selectedMarket.name,
      });

      this.status.activeContractId = contract.id;
      this.notifyStatus();

      // 6. Record open trade
      const record: ScannerTradeRecord = {
        id: contract.id,
        timestamp: Date.now(),
        timeString: new Date().toLocaleTimeString(),
        symbol: selectedMarket.symbol,
        marketName: selectedMarket.name,
        redBarDigit: targetDigit,
        streakDigit,
        streakCount,
        safetyScore: targetSafetyScore,
        markovRiskPct: targetMarkovRisk,
        reason: targetReason,
        patternString,
        exitDigit: null,
        stake: this.status.currentStake,
        profit: 0,
        result: 'OPEN',
        durationTicks: this.config.durationTicks,
        entrySpot: contract.entrySpot || 0,
        cycle: this.status.currentCycle,
      };

      this.trades = [record, ...this.trades.slice(0, 99)];
      this.notifyTrades();
    } catch (err: any) {
      console.error('[ScannerBot] Trade execution error:', err);
      this.status.statusMessage = `⚠️ Execution error: ${err.message || 'Retrying in 2s'}`;
      this.notifyStatus();
      this.scheduleNextTrade(2000);
    } finally {
      this.isEvaluating = false;
    }
  }

  private advanceSequentialMarket() {
    const markets = this.getActiveMarketList();
    const nextIdx = (this.status.currentMarketIndex + 1) % markets.length;
    if (nextIdx === 0) {
      this.status.currentCycle++;
    }
    this.status.currentMarketIndex = nextIdx;
    this.status.currentMarket = markets[nextIdx];
    this.status.nextMarket = markets[(nextIdx + 1) % markets.length];
  }

  private handleContractUpdate(contract: ActiveContract) {
    if (!this.status.isRunning && !this.status.activeContractId) return;
    if (contract.id !== this.status.activeContractId) return;

    if (contract.status === 'WON' || contract.status === 'LOST') {
      const isWin = contract.status === 'WON';
      const profit = isWin ? contract.currentProfit : -contract.stake;

      const pip = getMarketPipSize(contract.symbol);
      const exitDigit =
        contract.exitSpot !== undefined
          ? extractDerivLastDigit(contract.exitSpot, pip, contract.symbol)
          : null;

      // Update trade record
      this.trades = this.trades.map((t) => {
        if (t.id === contract.id) {
          const newBal = this.accountBalance + profit;
          return {
            ...t,
            result: isWin ? 'WIN' : 'LOSS',
            profit,
            exitDigit,
            exitSpot: contract.exitSpot,
            balanceAfter: newBal,
          };
        }
        return t;
      });
      this.notifyTrades();

      // Update stats
      this.status.totalTrades++;
      if (isWin) {
        this.status.totalWins++;
        this.status.consecutiveWins++;
        this.status.consecutiveLosses = 0;
        this.status.currentMartingaleStep = 0;
        if (this.status.consecutiveWins > this.status.maxConsecutiveWins) {
          this.status.maxConsecutiveWins = this.status.consecutiveWins;
        }

        // Compounding & Advanced Betting Strategies
        if (this.config.stakeMode === 'COMPOUND') {
          this.status.compoundStep++;
          const reinvest = profit * (this.config.compoundReinvestPct / 100);
          let nextStake = this.status.currentStake + reinvest;
          if (this.config.maxStakeCap > 0 && nextStake > this.config.maxStakeCap) {
            nextStake = this.config.maxStakeCap;
          }
          const updatedBal = Math.max(0, this.accountBalance + profit);
          if (updatedBal > 0 && nextStake > updatedBal) {
            nextStake = updatedBal;
          }
          this.status.currentStake = Math.max(0.35, Number(nextStake.toFixed(2)));
        } else if (this.config.stakeMode === 'COMPOUND_STEPS') {
          this.status.compoundStep++;
          if (this.config.compoundMaxSteps > 0 && this.status.compoundStep >= this.config.compoundMaxSteps) {
            this.status.compoundStep = 0;
            this.status.currentStake = this.config.baseStake;
          } else {
            const reinvest = profit * (this.config.compoundReinvestPct / 100);
            let nextStake = this.status.currentStake + reinvest;
            if (this.config.maxStakeCap > 0 && nextStake > this.config.maxStakeCap) {
              nextStake = this.config.maxStakeCap;
            }
            const updatedBal = Math.max(0, this.accountBalance + profit);
            if (updatedBal > 0 && nextStake > updatedBal) {
              nextStake = updatedBal;
            }
            this.status.currentStake = Math.max(0.35, Number(nextStake.toFixed(2)));
          }
        } else if (this.config.stakeMode === 'BALANCE_PERCENT') {
          const newBal = Math.max(0, this.accountBalance + profit);
          let nextStake = newBal * (this.config.compoundBalancePct / 100);
          if (this.config.maxStakeCap > 0 && nextStake > this.config.maxStakeCap) {
            nextStake = this.config.maxStakeCap;
          }
          if (newBal > 0 && nextStake > newBal) {
            nextStake = newBal;
          }
          this.status.currentStake = Math.max(0.35, Number(nextStake.toFixed(2)));
        } else if (this.config.stakeMode === 'DALEMBERT') {
          // D'Alembert on Win: Decrease stake by step down to baseStake
          this.dalembertStepCount = Math.max(0, this.dalembertStepCount - 1);
          const step = this.config.dalembertStep || 0.35;
          let nextStake = Math.max(this.config.baseStake, this.status.currentStake - step);
          this.status.currentStake = Math.max(0.35, Number(nextStake.toFixed(2)));
        } else if (this.config.stakeMode === 'REVERSE_DALEMBERT') {
          // Contra-D'Alembert on Win: Increase stake by step
          const step = this.config.dalembertStep || 0.35;
          let nextStake = this.status.currentStake + step;
          if (this.config.maxStakeCap > 0 && nextStake > this.config.maxStakeCap) {
            nextStake = this.config.maxStakeCap;
          }
          this.status.currentStake = Math.max(0.35, Number(nextStake.toFixed(2)));
        } else if (this.config.stakeMode === 'FIBONACCI') {
          // Fibonacci on Win: Move back 2 steps
          this.fibonacciIndex = Math.max(0, this.fibonacciIndex - 2);
          const mult = FIBONACCI_STEPS[this.fibonacciIndex] || 1;
          let nextStake = this.config.baseStake * mult;
          if (this.config.maxStakeCap > 0 && nextStake > this.config.maxStakeCap) {
            nextStake = this.config.maxStakeCap;
          }
          this.status.currentStake = Math.max(0.35, Number(nextStake.toFixed(2)));
        } else if (this.config.stakeMode === 'PAROLI') {
          // Paroli on Win: Scale stake up to consecutive win target, then bank
          const targetWins = this.config.paroliConsecutiveTarget || 3;
          if (this.status.consecutiveWins < targetWins) {
            const mult = this.config.paroliMultiplier || 2.0;
            let nextStake = this.status.currentStake * mult;
            if (this.config.maxStakeCap > 0 && nextStake > this.config.maxStakeCap) {
              nextStake = this.config.maxStakeCap;
            }
            this.status.currentStake = Math.max(0.35, Number(nextStake.toFixed(2)));
          } else {
            // Target reached! Bank profit and reset to base stake
            this.status.currentStake = this.config.baseStake;
          }
        } else if (this.config.stakeMode === 'OSCARS_GRIND') {
          // Oscar's Grind: Goal is +1 unit per cycle
          this.oscarsCycleProfit += profit;
          const targetProfit = (this.config.oscarsTargetUnit || 1) * this.config.baseStake;
          if (this.oscarsCycleProfit >= targetProfit) {
            // Target achieved: reset cycle
            this.oscarsCycleProfit = 0;
            this.status.currentStake = this.config.baseStake;
          } else {
            // Increase stake by 1 unit
            let nextStake = this.status.currentStake + this.config.baseStake;
            if (this.config.maxStakeCap > 0 && nextStake > this.config.maxStakeCap) {
              nextStake = this.config.maxStakeCap;
            }
            this.status.currentStake = Math.max(0.35, Number(nextStake.toFixed(2)));
          }
        } else if (this.config.stakeMode === 'KELLY_CRITERION') {
          const newBal = Math.max(0, this.accountBalance + profit);
          const fraction = this.config.kellyFraction || 0.25;
          let nextStake = newBal * fraction * 0.08;
          if (this.config.maxStakeCap > 0 && nextStake > this.config.maxStakeCap) {
            nextStake = this.config.maxStakeCap;
          }
          this.status.currentStake = Math.max(0.35, Number(nextStake.toFixed(2)));
        } else if (this.config.stakeMode === 'MARTINGALE' || this.config.stakeMode === 'FLAT') {
          this.status.currentStake = this.config.baseStake;
        }

        soundManager.playWin();
      } else {
        this.status.totalLosses++;
        this.status.consecutiveLosses++;
        this.status.consecutiveWins = 0;
        this.status.compoundStep = 0;

        if (this.config.stakeMode === 'MARTINGALE') {
          if (this.status.currentMartingaleStep < this.config.maxMartingaleSteps) {
            this.status.currentMartingaleStep++;
            this.status.currentStake = Number((this.status.currentStake * this.config.martingaleMultiplier).toFixed(2));
          } else {
            this.status.currentMartingaleStep = 0;
            this.status.currentStake = this.config.baseStake;
          }
        } else if (this.config.stakeMode === 'DALEMBERT') {
          // D'Alembert on Loss: Increase stake by step
          this.dalembertStepCount++;
          const step = this.config.dalembertStep || 0.35;
          let nextStake = this.status.currentStake + step;
          if (this.config.maxStakeCap > 0 && nextStake > this.config.maxStakeCap) {
            nextStake = this.config.maxStakeCap;
          }
          this.status.currentStake = Math.max(0.35, Number(nextStake.toFixed(2)));
        } else if (this.config.stakeMode === 'REVERSE_DALEMBERT') {
          // Contra-D'Alembert on Loss: Decrease stake by step down to baseStake
          const step = this.config.dalembertStep || 0.35;
          let nextStake = Math.max(this.config.baseStake, this.status.currentStake - step);
          this.status.currentStake = Math.max(0.35, Number(nextStake.toFixed(2)));
        } else if (this.config.stakeMode === 'FIBONACCI') {
          // Fibonacci on Loss: Move forward 1 step
          this.fibonacciIndex = Math.min(FIBONACCI_STEPS.length - 1, this.fibonacciIndex + 1);
          const mult = FIBONACCI_STEPS[this.fibonacciIndex] || 1;
          let nextStake = this.config.baseStake * mult;
          if (this.config.maxStakeCap > 0 && nextStake > this.config.maxStakeCap) {
            nextStake = this.config.maxStakeCap;
          }
          this.status.currentStake = Math.max(0.35, Number(nextStake.toFixed(2)));
        } else if (this.config.stakeMode === 'PAROLI') {
          // Paroli on Loss: Reset to base stake
          this.status.currentStake = this.config.baseStake;
        } else if (this.config.stakeMode === 'OSCARS_GRIND') {
          // Oscar's Grind on Loss: Stake stays same
          this.oscarsCycleProfit += profit;
          // Keep current stake
        } else if (this.config.stakeMode === 'KELLY_CRITERION') {
          const newBal = Math.max(0, this.accountBalance + profit);
          const fraction = this.config.kellyFraction || 0.25;
          let nextStake = newBal * fraction * 0.08;
          if (this.config.maxStakeCap > 0 && nextStake > this.config.maxStakeCap) {
            nextStake = this.config.maxStakeCap;
          }
          this.status.currentStake = Math.max(0.35, Number(nextStake.toFixed(2)));
        } else if (this.config.stakeMode === 'BALANCE_PERCENT') {
          const newBal = Math.max(0, this.accountBalance + profit);
          let nextStake = newBal * (this.config.compoundBalancePct / 100);
          if (this.config.maxStakeCap > 0 && nextStake > this.config.maxStakeCap) {
            nextStake = this.config.maxStakeCap;
          }
          if (newBal > 0 && nextStake > newBal) {
            nextStake = newBal;
          }
          this.status.currentStake = Math.max(0.35, Number(nextStake.toFixed(2)));
        } else {
          this.status.currentStake = this.config.baseStake;
        }
        soundManager.playLoss();
      }

      this.status.netProfit = Number((this.status.netProfit + profit).toFixed(2));
      this.status.winRate = Number(((this.status.totalWins / this.status.totalTrades) * 100).toFixed(1));

      // Balance sync
      const updatedBalance = Math.max(0, this.accountBalance + profit);
      this.accountBalance = updatedBalance;
      if (this.balanceUpdater) {
        this.balanceUpdater(profit, updatedBalance);
      }
      derivWS.refreshBalance();

      // Settlement State & Advance
      this.status.activeContractId = null;
      this.status.isSettling = true;
      this.status.lastSettledProfit = profit;
      this.status.lastSettledBalance = updatedBalance;
      this.status.lastSettledMarketName = this.status.currentMarket.name;

      if (this.config.executionMode === 'SEQUENTIAL_STREAK_SCANNER') {
        this.advanceSequentialMarket();
      }

      this.status.statusMessage = `✅ Settled on ${this.status.lastSettledMarketName} (${isWin ? '+' : ''}$${profit.toFixed(2)}). Balance: $${updatedBalance.toFixed(2)}`;
      this.notifyStatus();

      // Enforce pause (or extra cool-off after a loss to protect capital)
      const basePause = Math.max(400, this.config.delayBetweenTradesMs);
      const extraCooloff = !isWin && this.config.lossCooldownSeconds > 0 ? this.config.lossCooldownSeconds * 1000 : 0;
      const totalPause = basePause + extraCooloff;

      setTimeout(() => {
        if (this.status.isRunning) {
          this.status.isSettling = false;
          this.notifyStatus();
          this.scheduleNextTrade(100);
        }
      }, totalPause);
    }
  }

  private notifyStatus() {
    const s = this.getStatus();
    this.statusListeners.forEach((l) => l(s));
  }

  private notifyTrades() {
    const t = this.getTrades();
    this.tradeListeners.forEach((l) => l(t));
  }

  private notifyAnalysis() {
    const a = this.getAllAnalyses();
    this.analysisListeners.forEach((l) => l(a));
  }
}

export const derivDigitScannerBot = new DerivDigitScannerBotEngine();
