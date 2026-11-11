import { MarketSymbol, Tick, ActiveContract } from '../types/deriv';
import { derivWS, extractDerivLastDigit, formatDerivQuote, getMarketPipSize } from './derivWebSocket';
import { soundManager } from '../utils/soundEffects';
import { strategyShield } from './strategyShield';

export interface ColdestFrequencyConfig {
  targetMarket: MarketSymbol | 'ALL';
  sampleSize: number; // Deriv standard: 100 ticks (1 occurrence = 1.0%)
  coldThresholdPct: number; // User requirement: strictly 6.0% (no below, no above)
  ignoreRising: boolean; // User requirement: strictly true (ignore rising %)
  autoScanAnotherMarketOnTie: boolean; // User requirement: if market has another 6.0% digit or not unique, scan another market
  baseStake: number;
  stakeMode: 'FLAT' | 'MARTINGALE' | 'COMPOUND' | 'BALANCE_PERCENT';
  martingaleMultiplier: number;
  maxMartingaleSteps: number;
  compoundReinvestPct: number;
  maxStakeCap: number;
  takeProfit: number;
  stopLoss: number;
  maxConsecutiveLosses: number;
  singleTradeMode: boolean;
  forceVirtual: boolean;
  lossCooldownSeconds: number;
}

export interface DigitDistributionItem {
  digit: number;
  count: number;
  percentage: number;
  isColdest: boolean;
  isHottest: boolean;
  isCurrent: boolean;
}

export interface ColdestMarketState {
  symbol: MarketSymbol;
  marketName: string;
  lastPrice: number;
  lastDigit: number;
  coldestDigit: number;
  coldestPct: number;
  prevColdestPct: number;
  trendDirection: 'DROPPING' | 'RISING' | 'FLAT';
  isExactSixPercent: boolean;
  isUniqueColdest: boolean;
  hasAnotherDigitAtSixPercentNotColdest: boolean;
  otherDigitsAtSixPercent: number[];
  qualificationStatus:
    | 'QUALIFIED'
    | 'NOT_EXACT_6_ABOVE'
    | 'NOT_EXACT_6_BELOW'
    | 'ANOTHER_DIGIT_6_NOT_COLDEST'
    | 'TIED_OR_DUPLICATE_6'
    | 'RISING_IGNORED';
  qualificationReason: string;
  isTriggerArmed: boolean;
  digitStats: DigitDistributionItem[];
  sampleCount: number;
}

export interface ColdestTradeRecord {
  id: string;
  time: number;
  timeString: string;
  symbol: MarketSymbol;
  marketName: string;
  coldestDigit: number;
  coldestPct: number;
  direction: 'DROPPING' | 'RISING' | 'FLAT';
  stake: number;
  profit: number;
  result: 'WIN' | 'LOSS' | 'OPEN';
  entrySpot: number;
  exitSpot?: number;
  exitDigit?: number;
  durationTicks: number;
  reason: string;
}

export interface ColdestFrequencyStatus {
  isRunning: boolean;
  isTradeActive: boolean;
  isSettling: boolean;
  activeContractId: string | null;
  activeDifferDigit: number | null;
  activeMarketSymbol: MarketSymbol | null;
  statusMessage: string;
  totalTrades: number;
  wins: number;
  losses: number;
  winRate: number;
  netProfit: number;
  currentStake: number;
  consecutiveLosses: number;
  lastTradeOutcome: string | null;
  currentMarketState: ColdestMarketState | null;
}

export interface MarketMetadata {
  symbol: MarketSymbol;
  name: string;
  shortName: string;
  volatility: number;
  pipSize: number;
}

export const COLDEST_BOT_MARKETS: MarketMetadata[] = [
  { symbol: 'R_10', name: 'Volatility 10 Index', shortName: 'Vol 10', volatility: 10, pipSize: 3 },
  { symbol: 'R_25', name: 'Volatility 25 Index', shortName: 'Vol 25', volatility: 25, pipSize: 3 },
  { symbol: 'R_50', name: 'Volatility 50 Index', shortName: 'Vol 50', volatility: 50, pipSize: 4 },
  { symbol: 'R_75', name: 'Volatility 75 Index', shortName: 'Vol 75', volatility: 75, pipSize: 4 },
  { symbol: 'R_100', name: 'Volatility 100 Index', shortName: 'Vol 100', volatility: 100, pipSize: 2 },
  { symbol: '1HZ10V', name: 'Volatility 10 (1s) Index', shortName: 'Vol 10 (1s)', volatility: 10, pipSize: 2 },
  { symbol: '1HZ15V', name: 'Volatility 15 (1s) Index', shortName: 'Vol 15 (1s)', volatility: 15, pipSize: 2 },
  { symbol: '1HZ25V', name: 'Volatility 25 (1s) Index', shortName: 'Vol 25 (1s)', volatility: 25, pipSize: 2 },
  { symbol: '1HZ30V', name: 'Volatility 30 (1s) Index', shortName: 'Vol 30 (1s)', volatility: 30, pipSize: 2 },
  { symbol: '1HZ50V', name: 'Volatility 50 (1s) Index', shortName: 'Vol 50 (1s)', volatility: 50, pipSize: 2 },
  { symbol: '1HZ75V', name: 'Volatility 75 (1s) Index', shortName: 'Vol 75 (1s)', volatility: 75, pipSize: 2 },
  { symbol: '1HZ90V', name: 'Volatility 90 (1s) Index', shortName: 'Vol 90 (1s)', volatility: 90, pipSize: 2 },
  { symbol: '1HZ100V', name: 'Volatility 100 (1s) Index', shortName: 'Vol 100 (1s)', volatility: 100, pipSize: 2 },
];

type StatusListener = (status: ColdestFrequencyStatus) => void;
type TradeListener = (trades: ColdestTradeRecord[]) => void;
type MarketStateListener = (state: ColdestMarketState | null) => void;
type AllMarketStatesListener = (states: Map<MarketSymbol, ColdestMarketState>) => void;
type BalanceUpdater = (profit: number, newBalance: number) => void;

class ColdestFrequencyBotEngine {
  private config: ColdestFrequencyConfig = {
    targetMarket: 'R_100',
    sampleSize: 100,
    coldThresholdPct: 6.0,
    ignoreRising: true,
    autoScanAnotherMarketOnTie: true,
    baseStake: 1.0,
    stakeMode: 'FLAT',
    martingaleMultiplier: 11.0,
    maxMartingaleSteps: 3,
    compoundReinvestPct: 100,
    maxStakeCap: 50.0,
    takeProfit: 10.0,
    stopLoss: 25.0,
    maxConsecutiveLosses: 3,
    singleTradeMode: false,
    forceVirtual: false,
    lossCooldownSeconds: 0,
  };

  private status: ColdestFrequencyStatus = {
    isRunning: false,
    isTradeActive: false,
    isSettling: false,
    activeContractId: null,
    activeDifferDigit: null,
    activeMarketSymbol: null,
    statusMessage: 'Coldest Frequency Bot initialized. Waiting to start...',
    totalTrades: 0,
    wins: 0,
    losses: 0,
    winRate: 0,
    netProfit: 0,
    currentStake: 1.0,
    consecutiveLosses: 0,
    lastTradeOutcome: null,
    currentMarketState: null,
  };

  private trades: ColdestTradeRecord[] = [];
  private balanceUsd: number = 10000;
  private balanceUpdater?: BalanceUpdater;

  // Tick and history caches
  private marketPrices: Map<MarketSymbol, number[]> = new Map();
  private prevColdestPcts: Map<MarketSymbol, number> = new Map();
  private prevLastDigits: Map<MarketSymbol, number> = new Map();
  private marketStates: Map<MarketSymbol, ColdestMarketState> = new Map();

  // Listeners
  private statusListeners: Set<StatusListener> = new Set();
  private tradeListeners: Set<TradeListener> = new Set();
  private marketStateListeners: Set<MarketStateListener> = new Set();
  private allMarketStatesListeners: Set<AllMarketStatesListener> = new Set();

  private isEvaluating: boolean = false;
  private isProcessingTrade: boolean = false;
  private subscriptionsActive: boolean = false;
  private lastTradeContractId: string | null = null;
  private cooldownUntilTime: number = 0;

  constructor() {
    this.loadSavedConfig();
  }

  private loadSavedConfig() {
    try {
      const saved = localStorage.getItem('mboko_coldest_frequency_config');
      if (saved) {
        const parsed = JSON.parse(saved);
        this.config = {
          ...this.config,
          ...parsed,
          coldThresholdPct: 6.0, // Strictly enforced: only exact 6.0% allowed
          ignoreRising: true, // Strictly enforced: ignore rising %
        };
        this.status.currentStake = this.config.baseStake;
      }
    } catch {
      // Ignore storage errors
    }
  }

  public saveConfig(newConfig: Partial<ColdestFrequencyConfig>) {
    this.config = {
      ...this.config,
      ...newConfig,
      coldThresholdPct: 6.0, // Strictly locked to 6.0%
      ignoreRising: true, // Strictly locked to true
    };
    if (!this.status.isRunning) {
      this.status.currentStake = this.config.baseStake;
    }
    try {
      localStorage.setItem('mboko_coldest_frequency_config', JSON.stringify(this.config));
    } catch {
      // Ignore storage errors
    }
    this.notifyStatus();
  }

  public getConfig(): ColdestFrequencyConfig {
    return { ...this.config };
  }

  public getStatus(): ColdestFrequencyStatus {
    return { ...this.status };
  }

  public getTrades(): ColdestTradeRecord[] {
    return [...this.trades];
  }

  public setBalance(bal: number) {
    this.balanceUsd = bal;
  }

  public setBalanceUpdater(fn: BalanceUpdater) {
    this.balanceUpdater = fn;
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

  public subscribeMarketState(cb: MarketStateListener): () => void {
    this.initSubscriptions();
    this.marketStateListeners.add(cb);
    cb(this.status.currentMarketState);
    return () => this.marketStateListeners.delete(cb);
  }

  public subscribeAllMarketStates(cb: AllMarketStatesListener): () => void {
    this.initSubscriptions();
    this.allMarketStatesListeners.add(cb);
    cb(new Map(this.marketStates));
    return () => this.allMarketStatesListeners.delete(cb);
  }

  public getAllMarketStates(): Map<MarketSymbol, ColdestMarketState> {
    return new Map(this.marketStates);
  }

  private notifyStatus() {
    const s = this.getStatus();
    this.statusListeners.forEach((cb) => cb(s));
    this.marketStateListeners.forEach((cb) => cb(s.currentMarketState));
    const all = new Map(this.marketStates);
    this.allMarketStatesListeners.forEach((cb) => cb(all));
  }

  private notifyTrades() {
    const t = this.getTrades();
    this.tradeListeners.forEach((cb) => cb(t));
  }

  public initSubscriptions() {
    if (this.subscriptionsActive) return;
    this.subscriptionsActive = true;

    COLDEST_BOT_MARKETS.forEach((m) => {
      derivWS.subscribeHistory(m.symbol, (data) => {
        if (data.prices && data.prices.length > 0) {
          this.marketPrices.set(m.symbol, data.prices.slice(-1000));
          this.updateMarketState(m.symbol);
        }
      });

      derivWS.subscribeTicks(m.symbol, (tick: Tick) => {
        const existing = this.marketPrices.get(m.symbol) || [];
        const updated = [...existing, tick.quote].slice(-1000);
        this.marketPrices.set(m.symbol, updated);
        this.updateMarketState(m.symbol);

        // Check trigger if bot is running
        if (
          this.status.isRunning &&
          !this.status.isTradeActive &&
          !this.status.isSettling &&
          !this.isProcessingTrade &&
          Date.now() >= this.cooldownUntilTime
        ) {
          this.evaluateTickTrigger(m.symbol);
        }
      });

      derivWS.requestTicksHistory(m.symbol, 200);
    });

    derivWS.subscribeContracts(this.handleContractUpdate.bind(this));
  }

  /**
   * Computes the Real Digit Percentage Distribution for a market matching Deriv's official formula
   */
  public updateMarketState(symbol: MarketSymbol): ColdestMarketState | null {
    const prices = this.marketPrices.get(symbol);
    if (!prices || prices.length < 10) return null;

    const mMeta = COLDEST_BOT_MARKETS.find((m) => m.symbol === symbol) || COLDEST_BOT_MARKETS[0];
    const pip = mMeta.pipSize;
    const lastPrice = prices[prices.length - 1];
    const lastDigit = extractDerivLastDigit(lastPrice, pip, symbol);

    // Extract digits for the configured sample size
    const sampleSize = Math.max(10, this.config.sampleSize);
    const samplePrices = prices.slice(-sampleSize);
    const sampleDigits = samplePrices.map((p) => extractDerivLastDigit(p, pip, symbol));
    const total = sampleDigits.length;

    // Count occurrences for each digit 0..9
    const counts = new Array(10).fill(0);
    sampleDigits.forEach((d) => {
      if (d >= 0 && d <= 9) counts[d]++;
    });

    // Compute exact percentages matching Deriv formula (rounded to 1 decimal place)
    const percentages = counts.map((c) => (total > 0 ? Number(((c / total) * 100).toFixed(1)) : 10.0));

    // Find min (coldest) and max (hottest)
    const minPct = Math.min(...percentages);
    const maxPct = Math.max(...percentages);

    // Find all digits in this market that hold the true minimum percentage (coldest)
    const digitsWithMinPct: number[] = [];
    percentages.forEach((pct, d) => {
      if (pct === minPct) {
        digitsWithMinPct.push(d);
      }
    });

    // The true coldest digit on this market (first one if tied)
    const coldestDigit = digitsWithMinPct[0];

    // Find all digits in this market that have exactly 6.0%
    const digitsWithExactSixPct: number[] = [];
    percentages.forEach((pct, d) => {
      if (pct === 6.0) {
        digitsWithExactSixPct.push(d);
      }
    });

    // Other digits on this market that have 6.0% but are NOT the coldest digit
    const otherDigitsAtSixPercent = digitsWithExactSixPct.filter((d) => d !== coldestDigit);
    const hasAnotherDigitAtSixPercentNotColdest = otherDigitsAtSixPercent.length > 0;

    // USER REQUIREMENT:
    // 1. "not trade any other percentage whether below 6% or above 6%..it should only wait for the coldest digit % to only drop to 6.0% no any other percentage"
    // 2. "and it should only be the coldest digit on that market, if that market has another digit which has 6.0% and is not the coldest the bot should ignore it and scan another market and wait for the coldest digit to drop it's percentage to 6.0%"
    // 3. "only when the percentage drops to 6.0% and it's the coldest digit, ignore the rising %"
    const isExactSixPercent = minPct === 6.0 && digitsWithExactSixPct.length === 1;
    const isUniqueColdest = isExactSixPercent && digitsWithMinPct.length === 1;

    const prevColdPct = this.prevColdestPcts.get(symbol) ?? minPct;
    const prevLastD = this.prevLastDigits.get(symbol);

    // Trend Direction determination:
    // If the latest tick generated is the coldest digit itself (lastDigit === coldestDigit),
    // that means this digit just appeared, so its frequency is RISING or active!
    // The user's rule explicitly states: "only when the percentage drops to 6.0% and it's the coldest digit ,ignore the rising %"
    let trendDirection: 'DROPPING' | 'RISING' | 'FLAT' = 'FLAT';

    if (prevLastD !== undefined && lastDigit === coldestDigit) {
      trendDirection = 'RISING';
    } else if (minPct < prevColdPct) {
      trendDirection = 'DROPPING';
    } else if (minPct > prevColdPct) {
      trendDirection = 'RISING';
    } else if (minPct === 6.0 && prevLastD !== undefined && lastDigit !== coldestDigit) {
      // At exact 6.0% and coldest digit did not appear: continuing drop/dormancy
      trendDirection = 'DROPPING';
    } else {
      trendDirection = 'FLAT';
    }

    // Save for next tick comparison
    this.prevColdestPcts.set(symbol, minPct);
    this.prevLastDigits.set(symbol, lastDigit);

    // Qualification Status determination according to strict user rules:
    let qualificationStatus:
      | 'QUALIFIED'
      | 'NOT_EXACT_6_ABOVE'
      | 'NOT_EXACT_6_BELOW'
      | 'ANOTHER_DIGIT_6_NOT_COLDEST'
      | 'TIED_OR_DUPLICATE_6'
      | 'RISING_IGNORED' = 'NOT_EXACT_6_ABOVE';
    let qualificationReason = '';

    if (minPct > 6.0) {
      qualificationStatus = 'NOT_EXACT_6_ABOVE';
      qualificationReason = `Coldest digit [${coldestDigit}] is ${minPct.toFixed(1)}% (> 6.0% - waiting for drop to exactly 6.0%)`;
    } else if (hasAnotherDigitAtSixPercentNotColdest && minPct < 6.0) {
      // USER REQUIREMENT: "if that market has another digit which has 6.0% and is not the coldest the bot should ignore it and scan another market"
      qualificationStatus = 'ANOTHER_DIGIT_6_NOT_COLDEST';
      qualificationReason = `Digit(s) [${otherDigitsAtSixPercent.join(', ')}] on ${symbol} have 6.0% but are NOT the coldest digit (coldest is [${coldestDigit}] @ ${minPct.toFixed(1)}%). Ignored per rule — scanning another market...`;
    } else if (minPct < 6.0) {
      // USER REQUIREMENT: "not trade any other percentage whether below 6% or above 6%"
      qualificationStatus = 'NOT_EXACT_6_BELOW';
      qualificationReason = `Coldest digit [${coldestDigit}] is ${minPct.toFixed(1)}% (< 6.0% - strictly ignored, bot only trades exact 6.0%)`;
    } else if (digitsWithExactSixPct.length > 1) {
      // USER REQUIREMENT: "and it should only be the coldest digit on that market"
      qualificationStatus = 'TIED_OR_DUPLICATE_6';
      qualificationReason = `Multiple digits [${digitsWithExactSixPct.join(', ')}] have 6.0% on ${symbol}. Neither is the sole unique coldest digit — ignored per rule, scanning another market...`;
    } else if (trendDirection === 'RISING' || lastDigit === coldestDigit) {
      // USER REQUIREMENT: "ignore the rising %"
      qualificationStatus = 'RISING_IGNORED';
      qualificationReason = `Coldest digit [${coldestDigit}] is 6.0% but frequency is rising (just appeared on tick ${lastPrice}) — strictly ignored per rule`;
    } else {
      // minPct === 6.0 AND strictly sole unique coldest digit AND dropping / not rising
      qualificationStatus = 'QUALIFIED';
      qualificationReason = `🎯 ARMED: Coldest digit [${coldestDigit}] dropped to EXACTLY 6.0% (strictly sole unique coldest digit on ${symbol}, no ties, not rising)! Ready to buy Differ ≠ ${coldestDigit}`;
    }

    const isTriggerArmed = qualificationStatus === 'QUALIFIED';

    const digitStats: DigitDistributionItem[] = counts.map((count, d) => ({
      digit: d,
      count,
      percentage: percentages[d],
      isColdest: d === coldestDigit,
      isHottest: percentages[d] === maxPct,
      isCurrent: d === lastDigit,
    }));

    const state: ColdestMarketState = {
      symbol,
      marketName: mMeta.name,
      lastPrice,
      lastDigit,
      coldestDigit,
      coldestPct: minPct,
      prevColdestPct: prevColdPct,
      trendDirection,
      isExactSixPercent,
      isUniqueColdest,
      hasAnotherDigitAtSixPercentNotColdest,
      otherDigitsAtSixPercent,
      qualificationStatus,
      qualificationReason,
      isTriggerArmed,
      digitStats,
      sampleCount: total,
    };

    this.marketStates.set(symbol, state);

    // Update active display market
    const activeTarget = this.config.targetMarket === 'ALL' ? 'R_100' : this.config.targetMarket;
    if (symbol === activeTarget || !this.status.currentMarketState) {
      this.status.currentMarketState = state;
    }

    return state;
  }

  /**
   * Evaluates incoming tick against the strict Coldest Frequency rules:
   * - Only trades when coldest digit % drops to EXACTLY 6.0% (no below 6%, no above 6%)
   * - Must be strictly the sole coldest digit on that market (no duplicate 6.0% digits / ties)
   * - If that market has another 6.0% digit or is not unique, ignore it and scan another market
   * - Rising % is strictly ignored
   */
  private async evaluateTickTrigger(symbol: MarketSymbol) {
    if (this.isEvaluating || !this.status.isRunning) return;

    // Check risk limits
    if (this.status.netProfit >= this.config.takeProfit) {
      this.stopBot(`🎯 Take Profit reached (+${this.status.netProfit.toFixed(2)} USD >= +${this.config.takeProfit} USD)`);
      soundManager.playWin();
      return;
    }

    if (this.status.netProfit <= -Math.abs(this.config.stopLoss)) {
      this.stopBot(`⚠️ Stop Loss reached (${this.status.netProfit.toFixed(2)} USD <= -${this.config.stopLoss} USD)`);
      soundManager.playLoss();
      return;
    }

    if (this.status.consecutiveLosses >= this.config.maxConsecutiveLosses) {
      this.stopBot(`🛑 Max consecutive losses limit hit (${this.status.consecutiveLosses} losses)`);
      soundManager.playLoss();
      return;
    }

    const state = this.marketStates.get(symbol);
    if (!state) return;

    // 1. If the current incoming tick's market QUALIFIES strictly:
    if (state.qualificationStatus === 'QUALIFIED') {
      if (this.config.targetMarket === 'ALL' || this.config.targetMarket === symbol || this.config.autoScanAnotherMarketOnTie) {
        this.isEvaluating = true;
        try {
          this.status.currentMarketState = state;
          await this.executeColdestDifferTrade(state);
        } finally {
          this.isEvaluating = false;
        }
        return;
      }
    }

    // 2. USER REQUIREMENT:
    // "if that market has another digit which has 6.0% and is not the coldest the bot should ignore it and scan another market and wait for the coldest digit to drop it's percentage to 6.0%"
    if (
      state.qualificationStatus === 'ANOTHER_DIGIT_6_NOT_COLDEST' ||
      state.qualificationStatus === 'TIED_OR_DUPLICATE_6'
    ) {
      this.status.statusMessage = `⚠️ [${symbol}] ${state.qualificationReason}`;
      this.notifyStatus();
    }

    // 3. Scan other volatility markets if targetMarket is ALL, or if autoScanAnotherMarketOnTie is enabled (default true):
    if (this.config.targetMarket === 'ALL' || this.config.autoScanAnotherMarketOnTie) {
      for (const m of COLDEST_BOT_MARKETS) {
        if (m.symbol === symbol) continue;
        const otherState = this.marketStates.get(m.symbol);
        if (otherState && otherState.qualificationStatus === 'QUALIFIED') {
          this.isEvaluating = true;
          try {
            this.status.currentMarketState = otherState;
            await this.executeColdestDifferTrade(otherState);
          } finally {
            this.isEvaluating = false;
          }
          return;
        }
      }
    }
  }

  /**
   * Executes Deriv 1-Tick Differ contract on the coldest digit
   */
  public async executeColdestDifferTrade(state: ColdestMarketState, isManualTest: boolean = false) {
    if (this.isProcessingTrade) return;
    this.isProcessingTrade = true;

    const targetDigit = state.coldestDigit;
    const marketSym = state.symbol;
    const marketName = state.marketName;
    const stakeToUse = this.calculateStake();

    // Check anti-tracking shield delay
    const jitterDelay = strategyShield.getAntiManipulationDelay();
    if (jitterDelay > 0 && !isManualTest) {
      this.status.statusMessage = `🛡️ [ANTI-TRACKING] Applying +${jitterDelay}ms micro-cadence delay on ${marketSym}...`;
      this.notifyStatus();
      await new Promise((r) => setTimeout(r, jitterDelay));
      if (!this.status.isRunning && !isManualTest) {
        this.isProcessingTrade = false;
        return;
      }
    }

    this.status.isTradeActive = true;
    this.status.activeMarketSymbol = marketSym;
    this.status.activeDifferDigit = targetDigit;
    this.status.statusMessage = `🎯 [${marketSym}] Coldest Digit ${targetDigit} dropped to EXACTLY 6.0% (strictly unique sole coldest)! Buying Differ ≠ ${targetDigit} ($${stakeToUse.toFixed(2)}, 1t settle)...`;
    this.notifyStatus();
    soundManager.playPatternDetected();

    try {
      const contract = derivWS.purchaseContract({
        symbol: marketSym,
        symbolName: marketName,
        contractType: 'DIGITDIFF',
        stake: stakeToUse,
        durationTicks: 1, // "and the next generated digit should settle the trade"
        durationUnit: 't',
        targetDigit: targetDigit,
        forceVirtual: this.config.forceVirtual,
      });

      if (contract.status === 'CANCELLED') {
        this.status.isTradeActive = false;
        this.isProcessingTrade = false;
        this.status.statusMessage = `⚠️ Order not accepted on ${marketSym}. Resuming scan...`;
        this.notifyStatus();
        return;
      }

      this.status.activeContractId = contract.id;
      this.lastTradeContractId = contract.id;

      const record: ColdestTradeRecord = {
        id: contract.id,
        time: Date.now(),
        timeString: new Date().toLocaleTimeString(),
        symbol: marketSym,
        marketName,
        coldestDigit: targetDigit,
        coldestPct: state.coldestPct,
        direction: state.trendDirection,
        stake: stakeToUse,
        profit: 0,
        result: 'OPEN',
        entrySpot: contract.entrySpot || state.lastPrice,
        durationTicks: 1,
        reason: `Coldest Digit ${targetDigit} dropped to EXACTLY 6.0% (strictly unique sole coldest digit on ${marketSym}, no tie) ➔ 1-Tick Differ ≠ ${targetDigit}`,
      };

      this.trades.unshift(record);
      this.trades = this.trades.slice(0, 100);
      this.notifyTrades();
      this.notifyStatus();
    } catch (err: any) {
      console.error('[ColdestFrequencyBot] Error purchasing contract:', err);
      this.status.isTradeActive = false;
      this.isProcessingTrade = false;
      this.status.statusMessage = `❌ Trade Error: ${err?.message || 'Failed to purchase contract'}`;
      this.notifyStatus();
    }
  }

  /**
   * Listens to Deriv contract lifecycle updates and resolves settlements
   */
  private handleContractUpdate(contract: ActiveContract) {
    if (!this.status.activeContractId || contract.id !== this.status.activeContractId) return;

    if (contract.status === 'WON' || contract.status === 'LOST') {
      const isWin = contract.status === 'WON';
      const profit = contract.currentProfit;
      const exitSpot = contract.currentSpot;
      const exitDigit = extractDerivLastDigit(exitSpot, getMarketPipSize(contract.symbol), contract.symbol);

      // Update trade log record
      const tradeRec = this.trades.find((t) => t.id === contract.id);
      if (tradeRec) {
        tradeRec.result = isWin ? 'WIN' : 'LOSS';
        tradeRec.profit = profit;
        tradeRec.exitSpot = exitSpot;
        tradeRec.exitDigit = exitDigit;
      }

      // Update bot statistics
      this.status.totalTrades += 1;
      this.status.netProfit += profit;
      if (isWin) {
        this.status.wins += 1;
        this.status.consecutiveLosses = 0;
        soundManager.playWin();
      } else {
        this.status.losses += 1;
        this.status.consecutiveLosses += 1;
        soundManager.playLoss();
      }

      this.status.winRate =
        this.status.totalTrades > 0
          ? Number(((this.status.wins / this.status.totalTrades) * 100).toFixed(1))
          : 0;

      // Update balance
      this.balanceUsd += profit;
      if (this.balanceUpdater) {
        this.balanceUpdater(profit, this.balanceUsd);
      }

      // Adjust stake for next trade
      this.handlePostTradeMoneyManagement(isWin);

      const targetD = this.status.activeDifferDigit;
      const outcomeText = isWin
        ? `✅ WIN! Exit digit [${exitDigit}] ≠ target [${targetD}] (+${profit.toFixed(2)} USD)`
        : `❌ LOSS! Exit digit [${exitDigit}] matched target [${targetD}] (${profit.toFixed(2)} USD)`;

      this.status.lastTradeOutcome = outcomeText;
      this.status.statusMessage = `${outcomeText} on ${contract.symbol}. Resuming scan...`;
      this.status.isTradeActive = false;
      this.status.isSettling = false;
      this.status.activeContractId = null;
      this.status.activeDifferDigit = null;
      this.status.activeMarketSymbol = null;
      this.isProcessingTrade = false;

      // Cooldown buffer
      if (!isWin && this.config.lossCooldownSeconds > 0) {
        this.cooldownUntilTime = Date.now() + this.config.lossCooldownSeconds * 1000;
        this.status.statusMessage = `⏸️ Loss cooldown active (${this.config.lossCooldownSeconds}s pause)...`;
      } else {
        this.cooldownUntilTime = Date.now() + 500; // brief anti-double-fire buffer
      }

      if (this.config.singleTradeMode) {
        this.stopBot(`Single trade mode completed (${outcomeText})`);
      }

      this.notifyTrades();
      this.notifyStatus();
    }
  }

  private calculateStake(): number {
    let stake = this.status.currentStake || this.config.baseStake;

    if (this.config.stakeMode === 'BALANCE_PERCENT') {
      const pct = 0.01; // 1% of balance
      stake = Math.max(0.35, Number((this.balanceUsd * pct).toFixed(2)));
    }

    if (this.config.maxStakeCap > 0) {
      stake = Math.min(stake, this.config.maxStakeCap);
    }

    return Math.max(0.35, Number(stake.toFixed(2)));
  }

  private handlePostTradeMoneyManagement(isWin: boolean) {
    if (this.config.stakeMode === 'MARTINGALE') {
      if (isWin) {
        this.status.currentStake = this.config.baseStake;
      } else {
        if (this.status.consecutiveLosses < this.config.maxMartingaleSteps) {
          const nextStake = this.status.currentStake * this.config.martingaleMultiplier;
          this.status.currentStake = Number(nextStake.toFixed(2));
        } else {
          this.status.currentStake = this.config.baseStake;
        }
      }
    } else if (this.config.stakeMode === 'COMPOUND') {
      if (isWin) {
        // Reinvest profit % into next stake
        const lastProfit = this.trades[0]?.profit || 0;
        const addOn = (lastProfit * (this.config.compoundReinvestPct || 100)) / 100;
        this.status.currentStake = Number((this.status.currentStake + addOn).toFixed(2));
      } else {
        this.status.currentStake = this.config.baseStake;
      }
    } else {
      // FLAT
      this.status.currentStake = this.config.baseStake;
    }

    if (this.config.maxStakeCap > 0 && this.status.currentStake > this.config.maxStakeCap) {
      this.status.currentStake = this.config.maxStakeCap;
    }
  }

  public startBot() {
    this.initSubscriptions();
    if (this.status.isRunning) return;
    this.status.isRunning = true;
    this.status.currentStake = this.config.baseStake;
    this.status.statusMessage = `🚀 Coldest Frequency Bot started! Scanning for coldest digit dropping to ≤ ${this.config.coldThresholdPct}% on ${this.config.targetMarket}...`;
    soundManager.playButtonClick();
    this.notifyStatus();
  }

  public stopBot(reason?: string) {
    if (!this.status.isRunning) return;
    this.status.isRunning = false;
    this.isProcessingTrade = false;
    this.status.statusMessage = reason || '⏸️ Coldest Frequency Bot stopped by trader.';
    soundManager.playButtonClick();
    this.notifyStatus();
  }

  public resetStats() {
    this.status.totalTrades = 0;
    this.status.wins = 0;
    this.status.losses = 0;
    this.status.winRate = 0;
    this.status.netProfit = 0;
    this.status.consecutiveLosses = 0;
    this.status.currentStake = this.config.baseStake;
    this.status.lastTradeOutcome = null;
    this.trades = [];
    soundManager.playButtonClick();
    this.notifyTrades();
    this.notifyStatus();
  }

  public triggerManualDifferTest(symbol?: MarketSymbol) {
    const sym = symbol || (this.config.targetMarket === 'ALL' ? 'R_100' : this.config.targetMarket);
    const state = this.marketStates.get(sym);
    if (!state) {
      this.status.statusMessage = `⚠️ Market data not yet available for ${sym}.`;
      this.notifyStatus();
      return;
    }
    this.executeColdestDifferTrade(state, true);
  }
}

export const coldestFrequencyBotEngine = new ColdestFrequencyBotEngine();
export default coldestFrequencyBotEngine;
