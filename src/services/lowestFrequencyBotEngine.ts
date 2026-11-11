import { MarketSymbol, Tick, ActiveContract } from '../types/deriv';
import { derivWS, extractDerivLastDigit, formatDerivQuote, getMarketPipSize } from './derivWebSocket';
import { soundManager } from '../utils/soundEffects';
import { strategyShield } from './strategyShield';

export interface LowestFrequencyMarket {
  symbol: MarketSymbol;
  name: string;
  shortName: string;
  volatility: number;
  pipSize: number;
  stepIndex: number;
}

// Strictly continuous volatility 10 to 100 index (no 1s markets)
export const LOWEST_FREQUENCY_MARKETS: LowestFrequencyMarket[] = [
  { symbol: 'R_10', name: 'Volatility 10 Index', shortName: 'Vol 10', volatility: 10, pipSize: 3, stepIndex: 0 },
  { symbol: 'R_25', name: 'Volatility 25 Index', shortName: 'Vol 25', volatility: 25, pipSize: 3, stepIndex: 1 },
  { symbol: 'R_50', name: 'Volatility 50 Index', shortName: 'Vol 50', volatility: 50, pipSize: 4, stepIndex: 2 },
  { symbol: 'R_75', name: 'Volatility 75 Index', shortName: 'Vol 75', volatility: 75, pipSize: 4, stepIndex: 3 },
  { symbol: 'R_100', name: 'Volatility 100 Index', shortName: 'Vol 100', volatility: 100, pipSize: 2, stepIndex: 4 },
];

export interface LowestDigitDistributionItem {
  digit: number;
  count: number;
  percentage: number;
  isLowest: boolean;
  isHighest: boolean;
  isCurrent: boolean;
}

export interface LowestFrequencyMarketState {
  symbol: MarketSymbol;
  name: string;
  shortName: string;
  volatility: number;
  lastPrice: number;
  lastDigit: number;
  sampleCount: number;
  lowestDigit: number;
  lowestPct: number;
  lowestCount: number;
  highestDigit: number;
  highestPct: number;
  digitStats: LowestDigitDistributionItem[];
  isCurrentTradingMarket: boolean;
  stepStatus: 'PENDING' | 'SCANNING' | 'TRADING' | 'COMPLETED_WIN' | 'COMPLETED_LOSS';
}

export interface LowestFrequencyConfig {
  sampleSize: number; // 500 ticks as requested
  baseStake: number;
  stakeMode: 'FLAT' | 'MARTINGALE' | 'COMPOUND' | 'BALANCE_PERCENT';
  martingaleMultiplier: number;
  maxMartingaleSteps: number;
  maxStakeCap: number;
  takeProfit: number;
  stopLoss: number;
  maxConsecutiveLosses: number;
  continuousCycles: boolean;
  forceVirtual: boolean;
  virtualTradeOptionEnabled: boolean; // Virtual trade option: trades on virtual until 1 loss, then next trade on real account, then moves to next market
  virtualDemoStake: number; // Demo stake for virtual trades (default $1.00)
  delayBetweenMarketsMs: number; // Strictly 5000ms (5 seconds) as requested
}

export interface LowestFrequencyTradeRecord {
  id: string;
  time: number;
  timeString: string;
  symbol: MarketSymbol;
  marketName: string;
  cycle: number;
  stepNumber: number; // 1 to 5
  lowestDigit: number;
  lowestPct: number;
  sampleSize: number;
  stake: number;
  profit: number;
  result: 'WIN' | 'LOSS' | 'OPEN';
  entrySpot: number;
  exitSpot?: number;
  exitDigit?: number;
  isVirtual: boolean; // Virtual demo trade vs Real account trade
  reason: string;
}

export interface LowestFrequencyStatus {
  isRunning: boolean;
  currentStepIndex: number; // 0=Vol10, 1=Vol25, 2=Vol50, 3=Vol75, 4=Vol100
  currentCycle: number;
  activeMarketSymbol: MarketSymbol;
  activeTargetDigit: number | null;
  activeContractId: string | null;
  isTradeActive: boolean;
  isSettling: boolean;
  isWaitingDelay: boolean;
  delaySecondsRemaining: number;
  nextMarketSymbol: MarketSymbol | null;
  virtualModeState: 'VIRTUAL_HUNTING' | 'REAL_ARMED' | 'REAL_ACTIVE' | 'REAL_DIRECT';
  virtualWins: number;
  virtualLosses: number;
  isCurrentTradeVirtual: boolean;
  statusMessage: string;
  totalTrades: number;
  wins: number;
  losses: number;
  winRate: number;
  netProfit: number;
  currentStake: number;
  consecutiveLosses: number;
  lastTradeOutcome: string | null;
  completedStepsThisCycle: number;
}

type StatusListener = (status: LowestFrequencyStatus) => void;
type TradeListener = (trades: LowestFrequencyTradeRecord[]) => void;
type MarketStatesListener = (states: Map<MarketSymbol, LowestFrequencyMarketState>) => void;
type BalanceUpdater = (profit: number, newBalance: number) => void;

class LowestFrequencyBotEngine {
  private config: LowestFrequencyConfig = {
    sampleSize: 500, // strictly 500 ticks
    baseStake: 1.0,
    stakeMode: 'FLAT',
    martingaleMultiplier: 11.0,
    maxMartingaleSteps: 3,
    maxStakeCap: 50.0,
    takeProfit: 10.0,
    stopLoss: 25.0,
    maxConsecutiveLosses: 3,
    continuousCycles: true,
    forceVirtual: false,
    virtualTradeOptionEnabled: true, // Default to true as requested
    virtualDemoStake: 1.00,
    delayBetweenMarketsMs: 5000, // 5 seconds wait after trade closes
  };

  private status: LowestFrequencyStatus = {
    isRunning: false,
    currentStepIndex: 0,
    currentCycle: 1,
    activeMarketSymbol: 'R_10',
    activeTargetDigit: null,
    activeContractId: null,
    isTradeActive: false,
    isSettling: false,
    isWaitingDelay: false,
    delaySecondsRemaining: 0,
    nextMarketSymbol: null,
    virtualModeState: 'VIRTUAL_HUNTING',
    virtualWins: 0,
    virtualLosses: 0,
    isCurrentTradeVirtual: false,
    statusMessage: 'Lowest Frequency Bot ready. Virtual Mode: Demo until 1 loss ➔ Real Account ➔ Next Volatility.',
    totalTrades: 0,
    wins: 0,
    losses: 0,
    winRate: 0,
    netProfit: 0,
    currentStake: 1.0,
    consecutiveLosses: 0,
    lastTradeOutcome: null,
    completedStepsThisCycle: 0,
  };

  private trades: LowestFrequencyTradeRecord[] = [];
  private balanceUsd: number = 10000;
  private balanceUpdater?: BalanceUpdater;

  // Tick and market state caches
  private marketPrices: Map<MarketSymbol, number[]> = new Map();
  private marketStates: Map<MarketSymbol, LowestFrequencyMarketState> = new Map();

  // Listeners
  private statusListeners: Set<StatusListener> = new Set();
  private tradeListeners: Set<TradeListener> = new Set();
  private marketStatesListeners: Set<MarketStatesListener> = new Set();

  private isProcessingTrade: boolean = false;
  private subscriptionsActive: boolean = false;
  private transitionTimer: NodeJS.Timeout | null = null;
  private countdownInterval: NodeJS.Timeout | null = null;

  private clearDelays() {
    if (this.countdownInterval) {
      clearInterval(this.countdownInterval);
      this.countdownInterval = null;
    }
    if (this.transitionTimer) {
      clearTimeout(this.transitionTimer);
      this.transitionTimer = null;
    }
    this.status.isWaitingDelay = false;
    this.status.delaySecondsRemaining = 0;
    this.status.nextMarketSymbol = null;
  }

  constructor() {
    this.loadSavedConfig();
  }

  private loadSavedConfig() {
    try {
      const saved = localStorage.getItem('mboko_lowest_frequency_config');
      if (saved) {
        const parsed = JSON.parse(saved);
        this.config = {
          ...this.config,
          ...parsed,
          sampleSize: 500, // Strictly enforce 500 ticks sample size
          virtualTradeOptionEnabled: parsed.virtualTradeOptionEnabled ?? true,
          virtualDemoStake: parsed.virtualDemoStake ?? 1.00,
          delayBetweenMarketsMs: 5000,
        };
        this.status.currentStake = this.config.baseStake;
        this.status.virtualModeState = this.config.virtualTradeOptionEnabled ? 'VIRTUAL_HUNTING' : 'REAL_DIRECT';
      }
    } catch {
      // Ignore storage errors
    }
  }

  public saveConfig(newConfig: Partial<LowestFrequencyConfig>) {
    this.config = {
      ...this.config,
      ...newConfig,
      sampleSize: 500, // Strictly enforced 500 ticks
    };
    if (!this.status.isRunning) {
      this.status.currentStake = this.config.baseStake;
      if (newConfig.virtualTradeOptionEnabled !== undefined) {
        this.status.virtualModeState = newConfig.virtualTradeOptionEnabled ? 'VIRTUAL_HUNTING' : 'REAL_DIRECT';
      }
    }
    try {
      localStorage.setItem('mboko_lowest_frequency_config', JSON.stringify(this.config));
    } catch {
      // Ignore storage errors
    }
    this.notifyStatus();
  }

  public setVirtualTradeOption(enabled: boolean) {
    this.saveConfig({ virtualTradeOptionEnabled: enabled });
    if (!this.status.isRunning) {
      this.status.virtualModeState = enabled ? 'VIRTUAL_HUNTING' : 'REAL_DIRECT';
      this.notifyStatus();
    }
  }

  public setVirtualDemoStake(stake: number) {
    this.saveConfig({ virtualDemoStake: Math.max(0.35, stake) });
  }

  public getConfig(): LowestFrequencyConfig {
    return { ...this.config };
  }

  public getStatus(): LowestFrequencyStatus {
    return { ...this.status };
  }

  public getTrades(): LowestFrequencyTradeRecord[] {
    return [...this.trades];
  }

  public getAllMarketStates(): Map<MarketSymbol, LowestFrequencyMarketState> {
    return new Map(this.marketStates);
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

  public subscribeMarketStates(cb: MarketStatesListener): () => void {
    this.initSubscriptions();
    this.marketStatesListeners.add(cb);
    cb(new Map(this.marketStates));
    return () => this.marketStatesListeners.delete(cb);
  }

  private notifyStatus() {
    const s = this.getStatus();
    this.statusListeners.forEach((cb) => cb(s));
    const all = new Map(this.marketStates);
    this.marketStatesListeners.forEach((cb) => cb(all));
  }

  private notifyTrades() {
    const t = this.getTrades();
    this.tradeListeners.forEach((cb) => cb(t));
  }

  /**
   * Initializes WebSocket subscriptions for all 5 continuous volatility markets (Vol 10, 25, 50, 75, 100)
   * Only called on demand when the bot or its view is activated.
   */
  public initSubscriptions() {
    if (this.subscriptionsActive) return;
    this.subscriptionsActive = true;

    LOWEST_FREQUENCY_MARKETS.forEach((m) => {
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
      });

      // Request initial 500 ticks history
      derivWS.requestTicksHistory(m.symbol, 500);
    });

    derivWS.subscribeContracts(this.handleContractUpdate.bind(this));
  }

  /**
   * Computes the Real Digit Percentage Distribution on the 500-tick sample for a market
   */
  public updateMarketState(symbol: MarketSymbol): LowestFrequencyMarketState | null {
    const prices = this.marketPrices.get(symbol);
    const mMeta = LOWEST_FREQUENCY_MARKETS.find((m) => m.symbol === symbol);
    if (!mMeta) return null;

    const pip = mMeta.pipSize;
    const lastPrice = prices && prices.length > 0 ? prices[prices.length - 1] : 0;
    const lastDigit = lastPrice > 0 ? extractDerivLastDigit(lastPrice, pip, symbol) : 0;

    // Strict 500-tick sample as requested
    const sampleSize = 500;
    const samplePrices = prices ? prices.slice(-sampleSize) : [];
    const sampleDigits = samplePrices.map((p) => extractDerivLastDigit(p, pip, symbol));
    const total = sampleDigits.length;

    // Count occurrences for each digit 0..9
    const counts = new Array(10).fill(0);
    sampleDigits.forEach((d) => {
      if (d >= 0 && d <= 9) counts[d]++;
    });

    // Compute exact percentages matching Deriv formula (rounded to 1 decimal place)
    const percentages = counts.map((c) => (total > 0 ? Number(((c / total) * 100).toFixed(1)) : 10.0));

    // Find min (lowest frequency) and max (highest frequency)
    const minPct = Math.min(...percentages);
    const maxPct = Math.max(...percentages);

    // Find digits with lowest frequency (pick first / lowest digit if tied)
    let lowestDigit = 0;
    let lowestCount = counts[0];
    let minFound = percentages[0];

    for (let d = 0; d <= 9; d++) {
      if (percentages[d] < minFound || (percentages[d] === minFound && counts[d] < lowestCount)) {
        minFound = percentages[d];
        lowestDigit = d;
        lowestCount = counts[d];
      }
    }

    // Find highest frequency digit
    let highestDigit = 0;
    let maxFound = percentages[0];
    for (let d = 0; d <= 9; d++) {
      if (percentages[d] > maxFound) {
        maxFound = percentages[d];
        highestDigit = d;
      }
    }

    const isCurrentTrading =
      this.status.isRunning &&
      this.status.currentStepIndex === mMeta.stepIndex;

    let stepStatus: LowestFrequencyMarketState['stepStatus'] = 'PENDING';
    if (this.status.isRunning) {
      if (mMeta.stepIndex < this.status.currentStepIndex) {
        stepStatus = 'COMPLETED_WIN';
      } else if (mMeta.stepIndex === this.status.currentStepIndex) {
        stepStatus = this.status.isTradeActive ? 'TRADING' : 'SCANNING';
      } else {
        stepStatus = 'PENDING';
      }
    }

    const digitStats: LowestDigitDistributionItem[] = counts.map((count, d) => ({
      digit: d,
      count,
      percentage: percentages[d],
      isLowest: d === lowestDigit,
      isHighest: d === highestDigit,
      isCurrent: d === lastDigit,
    }));

    const state: LowestFrequencyMarketState = {
      symbol,
      name: mMeta.name,
      shortName: mMeta.shortName,
      volatility: mMeta.volatility,
      lastPrice,
      lastDigit,
      sampleCount: total,
      lowestDigit,
      lowestPct: minFound,
      lowestCount,
      highestDigit,
      highestPct: maxFound,
      digitStats,
      isCurrentTradingMarket: isCurrentTrading,
      stepStatus,
    };

    this.marketStates.set(symbol, state);
    return state;
  }

  /**
   * Starts the Lowest Frequency Bot
   * Initiates scanning at Volatility 10 Index and prepares trade execution
   */
  /**
   * Starts the Lowest Frequency Bot
   * Initiates scanning at Volatility 10 Index and prepares trade execution
   */
  public startBot() {
    this.initSubscriptions();
    if (this.status.isRunning) return;

    soundManager.playStart();
    this.status.isRunning = true;
    this.status.currentStepIndex = 0; // Starts at Volatility 10 Index
    this.status.completedStepsThisCycle = 0;
    this.status.currentStake = this.calculateStake();
    this.status.activeMarketSymbol = LOWEST_FREQUENCY_MARKETS[0].symbol;
    this.status.virtualWins = 0;
    this.status.virtualLosses = 0;
    this.status.virtualModeState = this.config.virtualTradeOptionEnabled ? 'VIRTUAL_HUNTING' : 'REAL_DIRECT';
    this.status.isCurrentTradeVirtual = false;

    this.status.statusMessage = this.config.virtualTradeOptionEnabled
      ? `🚀 Lowest Frequency Bot Started: Scanning 500 ticks on ${LOWEST_FREQUENCY_MARKETS[0].name} (Step 1/5) in Virtual Mode...`
      : `🚀 Lowest Frequency Bot Started: Scanning 500 ticks on ${LOWEST_FREQUENCY_MARKETS[0].name} (Step 1/5)...`;
    this.notifyStatus();

    // Ensure 500 ticks are requested for all 5 markets
    LOWEST_FREQUENCY_MARKETS.forEach((m) => {
      derivWS.requestTicksHistory(m.symbol, 500);
    });

    // Execute first market trade after brief warm-up buffer (500ms)
    setTimeout(() => {
      if (this.status.isRunning) {
        this.executeCurrentStepTrade();
      }
    }, 500);
  }

  /**
   * Stops the bot cleanly
   */
  public stopBot(reason?: string) {
    this.clearDelays();

    this.status.isRunning = false;
    this.status.isTradeActive = false;
    this.status.isSettling = false;
    this.status.activeContractId = null;
    this.status.activeTargetDigit = null;
    this.isProcessingTrade = false;
    this.status.statusMessage = reason || 'Lowest Frequency Bot stopped by user.';
    soundManager.playButtonClick();
    this.notifyStatus();
  }

  /**
   * Resets performance stats and history
   */
  public resetStats() {
    this.clearDelays();
    this.status.totalTrades = 0;
    this.status.wins = 0;
    this.status.losses = 0;
    this.status.virtualWins = 0;
    this.status.virtualLosses = 0;
    this.status.virtualModeState = this.config.virtualTradeOptionEnabled ? 'VIRTUAL_HUNTING' : 'REAL_DIRECT';
    this.status.winRate = 0;
    this.status.netProfit = 0;
    this.status.consecutiveLosses = 0;
    this.status.lastTradeOutcome = null;
    this.status.currentStake = this.config.baseStake;
    this.status.currentCycle = 1;
    this.status.completedStepsThisCycle = 0;
    this.trades = [];
    this.notifyTrades();
    this.notifyStatus();
    soundManager.playButtonClick();
  }

  /**
   * Executes the 1-tick Differ trade on the current market in the sequence
   */
  private async executeCurrentStepTrade() {
    if (!this.status.isRunning || this.status.isTradeActive || this.isProcessingTrade) return;

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
      this.stopBot(`🛑 Max consecutive losses hit (${this.status.consecutiveLosses} losses)`);
      soundManager.playLoss();
      return;
    }

    const currentMarket = LOWEST_FREQUENCY_MARKETS[this.status.currentStepIndex];
    if (!currentMarket) return;

    this.isProcessingTrade = true;
    this.status.activeMarketSymbol = currentMarket.symbol;

    // Update state to get current lowest frequency digit on 500-tick sample
    let mState = this.updateMarketState(currentMarket.symbol);
    if (!mState || mState.sampleCount < 10) {
      derivWS.requestTicksHistory(currentMarket.symbol, 500);
      this.status.statusMessage = `⏳ Gathering 500-tick sample on ${currentMarket.name}...`;
      this.notifyStatus();
      setTimeout(() => {
        this.isProcessingTrade = false;
        if (this.status.isRunning) this.executeCurrentStepTrade();
      }, 800);
      return;
    }

    const targetDigit = mState.lowestDigit;
    const lowestPct = mState.lowestPct;

    // Determine Virtual vs Real execution:
    // USER REQUIREMENT:
    // "after obtaining the lowest frequency digit it trades on virtual until it hits one loss and the next trade is taken on real account,then moves to the next volatility market"
    let isVirtual = false;
    let stakeToUse = this.calculateStake();

    if (this.config.virtualTradeOptionEnabled) {
      if (this.status.virtualModeState === 'REAL_ARMED') {
        // 1 loss occurred on virtual! Next trade is taken on REAL account!
        isVirtual = false;
        this.status.virtualModeState = 'REAL_ACTIVE';
        stakeToUse = this.calculateStake();
      } else {
        // Trade on Virtual mode until it hits 1 loss
        isVirtual = true;
        this.status.virtualModeState = 'VIRTUAL_HUNTING';
        stakeToUse = this.config.virtualDemoStake || 1.00;
      }
    } else {
      isVirtual = this.config.forceVirtual;
      this.status.virtualModeState = 'REAL_DIRECT';
      stakeToUse = this.calculateStake();
    }

    this.status.isCurrentTradeVirtual = isVirtual;

    // Check anti-manipulation jitter delay
    const jitterDelay = strategyShield.getAntiManipulationDelay();
    if (jitterDelay > 0 && !isVirtual) {
      this.status.statusMessage = `🛡️ [SHIELD] Micro-delay +${jitterDelay}ms on ${currentMarket.shortName}...`;
      this.notifyStatus();
      await new Promise((r) => setTimeout(r, jitterDelay));
      if (!this.status.isRunning) {
        this.isProcessingTrade = false;
        return;
      }
    }

    this.status.isTradeActive = true;
    this.status.activeTargetDigit = targetDigit;

    if (isVirtual) {
      this.status.statusMessage = `🧪 [VIRTUAL DEMO] ${currentMarket.name}: Lowest Digit [${targetDigit}] @ ${lowestPct.toFixed(1)}% (500t). Virtual Differ ≠ ${targetDigit} ($${stakeToUse.toFixed(2)})... Waiting for 1 loss to arm Real Account!`;
    } else {
      this.status.statusMessage = `💎 [REAL ACCOUNT] ${currentMarket.name}: Lowest Digit [${targetDigit}] @ ${lowestPct.toFixed(1)}% (500t). REAL Differ ≠ ${targetDigit} ($${stakeToUse.toFixed(2)})!`;
      soundManager.playPatternDetected();
    }
    this.notifyStatus();

    try {
      const contract = derivWS.purchaseContract({
        symbol: currentMarket.symbol,
        symbolName: currentMarket.name,
        contractType: 'DIGITDIFF',
        stake: stakeToUse,
        durationTicks: 1, // 1-tick settlement
        durationUnit: 't',
        targetDigit: targetDigit,
        forceVirtual: isVirtual,
      });

      if (contract.status === 'CANCELLED') {
        this.status.isTradeActive = false;
        this.isProcessingTrade = false;
        this.status.statusMessage = `⚠️ Order rejected on ${currentMarket.shortName}. Retrying...`;
        this.notifyStatus();
        setTimeout(() => {
          if (this.status.isRunning) this.executeCurrentStepTrade();
        }, 1000);
        return;
      }

      this.status.activeContractId = contract.id;

      const record: LowestFrequencyTradeRecord = {
        id: contract.id,
        time: Date.now(),
        timeString: new Date().toLocaleTimeString(),
        symbol: currentMarket.symbol,
        marketName: currentMarket.name,
        cycle: this.status.currentCycle,
        stepNumber: this.status.currentStepIndex + 1,
        lowestDigit: targetDigit,
        lowestPct,
        sampleSize: mState.sampleCount,
        stake: stakeToUse,
        profit: 0,
        result: 'OPEN',
        entrySpot: contract.entrySpot || mState.lastPrice,
        isVirtual,
        reason: isVirtual
          ? `[VIRTUAL DEMO • ${currentMarket.shortName}] Lowest Digit [${targetDigit}] (${lowestPct.toFixed(1)}%) ➔ Demo Differ ≠ ${targetDigit}`
          : `[REAL TRADE • ${currentMarket.shortName}] Lowest Digit [${targetDigit}] (${lowestPct.toFixed(1)}%) ➔ Real Differ ≠ ${targetDigit}`,
      };

      this.trades.unshift(record);
      this.trades = this.trades.slice(0, 100);
      this.notifyTrades();
      this.notifyStatus();
    } catch (err: any) {
      console.error('[LowestFrequencyBot] Trade purchase error:', err);
      this.status.isTradeActive = false;
      this.isProcessingTrade = false;
      this.status.statusMessage = `❌ Purchase Error: ${err?.message || 'Failed to place trade'}`;
      this.notifyStatus();
    }
  }

  /**
   * Handles contract updates from Deriv WebSocket
   */
  private handleContractUpdate(contract: ActiveContract) {
    if (!this.status.activeContractId || contract.id !== this.status.activeContractId) return;

    if (contract.status === 'WON' || contract.status === 'LOST') {
      const isWin = contract.status === 'WON';
      const profit = contract.currentProfit;
      const exitSpot = contract.currentSpot;
      const exitDigit = extractDerivLastDigit(exitSpot, getMarketPipSize(contract.symbol), contract.symbol);
      const isVirtual = this.status.isCurrentTradeVirtual;

      // Update trade log
      const tradeRec = this.trades.find((t) => t.id === contract.id);
      if (tradeRec) {
        tradeRec.result = isWin ? 'WIN' : 'LOSS';
        tradeRec.profit = profit;
        tradeRec.exitSpot = exitSpot;
        tradeRec.exitDigit = exitDigit;
        tradeRec.isVirtual = isVirtual;
      }

      const targetD = this.status.activeTargetDigit;
      const currentMarket = LOWEST_FREQUENCY_MARKETS[this.status.currentStepIndex];

      // -------------------------------------------------------------
      // VIRTUAL TRADE SETTLEMENT LOGIC
      // -------------------------------------------------------------
      if (isVirtual) {
        if (isWin) {
          // Virtual Win: continue on virtual mode on the same market until 1 loss occurs!
          this.status.virtualWins += 1;
          soundManager.playButtonClick();

          const outcomeText = `🧪 VIRTUAL WIN on ${currentMarket.shortName}! Exit [${exitDigit}] ≠ target [${targetD}] (Demo). Continuing virtual mode on ${currentMarket.shortName} until 1 loss occurs...`;
          this.status.lastTradeOutcome = outcomeText;
          this.status.statusMessage = outcomeText;
          this.status.isTradeActive = false;
          this.status.isSettling = false;
          this.status.activeContractId = null;
          this.status.activeTargetDigit = null;
          this.isProcessingTrade = false;
          this.status.virtualModeState = 'VIRTUAL_HUNTING';
          this.notifyTrades();
          this.notifyStatus();

          // Wait brief delay (700ms) and execute another virtual trade on the same market!
          if (this.status.isRunning) {
            setTimeout(() => {
              if (this.status.isRunning && !this.status.isTradeActive) {
                this.executeCurrentStepTrade();
              }
            }, 700);
          }
          return;
        } else {
          // ❌ ONE VIRTUAL LOSS HIT!
          // "trades on virtual until it hits one loss and the next trade is taken on real account"
          this.status.virtualLosses += 1;
          soundManager.playAlert();

          const outcomeText = `❌ 1 VIRTUAL LOSS on ${currentMarket.shortName}! Exit digit [${exitDigit}] matched target [${targetD}]. Risk absorbed on demo! NEXT TRADE SWITCHES TO REAL ACCOUNT!`;
          this.status.lastTradeOutcome = outcomeText;
          this.status.statusMessage = outcomeText;
          this.status.isTradeActive = false;
          this.status.isSettling = false;
          this.status.activeContractId = null;
          this.status.activeTargetDigit = null;
          this.isProcessingTrade = false;
          this.status.virtualModeState = 'REAL_ARMED';
          this.notifyTrades();
          this.notifyStatus();

          // Next trade is taken immediately on Real Account!
          if (this.status.isRunning) {
            setTimeout(() => {
              if (this.status.isRunning && !this.status.isTradeActive) {
                this.executeCurrentStepTrade();
              }
            }, 800);
          }
          return;
        }
      }

      // -------------------------------------------------------------
      // REAL ACCOUNT TRADE SETTLEMENT LOGIC
      // -------------------------------------------------------------
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

      // Update real balance
      this.balanceUsd += profit;
      if (this.balanceUpdater) {
        this.balanceUpdater(profit, this.balanceUsd);
      }

      // Adjust stake for real money management
      this.handlePostTradeMoneyManagement(isWin);

      const outcomeText = isWin
        ? `💎 REAL WIN on ${currentMarket.shortName}! Exit digit [${exitDigit}] ≠ target [${targetD}] (+${profit.toFixed(2)} USD)`
        : `❌ REAL LOSS on ${currentMarket.shortName}! Exit digit [${exitDigit}] matched target [${targetD}] (${profit.toFixed(2)} USD)`;

      this.status.lastTradeOutcome = outcomeText;
      this.status.isTradeActive = false;
      this.status.isSettling = false;
      this.status.activeContractId = null;
      this.status.activeTargetDigit = null;
      this.isProcessingTrade = false;
      // Reset virtual mode state back to VIRTUAL_HUNTING for the next volatility market
      this.status.virtualModeState = this.config.virtualTradeOptionEnabled ? 'VIRTUAL_HUNTING' : 'REAL_DIRECT';
      this.notifyTrades();

      // Sequential progression to NEXT market:
      // USER REQUIREMENT:
      // "then moves to the next volatility market" (with 5 seconds pause)
      if (!this.status.isRunning) return;

      const nextStepIndex = (this.status.currentStepIndex + 1) % LOWEST_FREQUENCY_MARKETS.length;
      const isCycleComplete = this.status.currentStepIndex === LOWEST_FREQUENCY_MARKETS.length - 1;
      const nextMarket = LOWEST_FREQUENCY_MARKETS[nextStepIndex];

      if (isCycleComplete && !this.config.continuousCycles) {
        this.status.completedStepsThisCycle = 5;
        this.stopBot(`🏆 Cycle ${this.status.currentCycle} complete! All 5 markets traded on Real Account successfully.`);
        soundManager.playWin();
        return;
      }

      // Pre-fetch fresh 500 ticks for the upcoming market so it's ready
      derivWS.requestTicksHistory(nextMarket.symbol, 500);

      // Start 5-second wait countdown
      this.clearDelays();
      this.status.isWaitingDelay = true;
      let remainingSeconds = 5;
      this.status.delaySecondsRemaining = remainingSeconds;
      this.status.nextMarketSymbol = nextMarket.symbol;

      const nextLabel = isCycleComplete
        ? `Cycle ${this.status.currentCycle + 1} • Vol 10 (Step 1/5)`
        : `Step ${nextStepIndex + 1}/5: ${nextMarket.name}`;

      this.status.statusMessage = `${outcomeText} | ⏳ Waiting 5s pause... Next: ${nextLabel} in ${remainingSeconds}s`;
      this.notifyStatus();

      this.countdownInterval = setInterval(() => {
        remainingSeconds -= 1;
        this.status.delaySecondsRemaining = Math.max(0, remainingSeconds);

        if (remainingSeconds > 0) {
          this.status.statusMessage = `${outcomeText} | ⏳ Waiting 5s pause... Next: ${nextLabel} in ${remainingSeconds}s`;
          this.notifyStatus();
        } else {
          if (this.countdownInterval) {
            clearInterval(this.countdownInterval);
            this.countdownInterval = null;
          }
        }
      }, 1000);

      // After exactly 5 seconds, move to next volatility and start virtual mode (or direct real) on that market!
      this.transitionTimer = setTimeout(() => {
        this.clearDelays();
        if (!this.status.isRunning) return;

        if (isCycleComplete) {
          this.status.currentCycle += 1;
          this.status.currentStepIndex = 0;
          this.status.completedStepsThisCycle = 0;
        } else {
          this.status.currentStepIndex = nextStepIndex;
          this.status.completedStepsThisCycle += 1;
        }

        // Reset virtual counters for the new market
        this.status.virtualWins = 0;
        this.status.virtualLosses = 0;
        this.status.virtualModeState = this.config.virtualTradeOptionEnabled ? 'VIRTUAL_HUNTING' : 'REAL_DIRECT';

        this.status.activeMarketSymbol = nextMarket.symbol;
        this.status.statusMessage = this.config.virtualTradeOptionEnabled
          ? `⚡ Moved to ${nextMarket.name}! Starting Virtual Mode on 500 ticks sample... Waiting for 1 loss to arm Real Account.`
          : `⚡ Moved to ${nextMarket.name}! Buying lowest frequency digit on 500 ticks sample...`;
        this.notifyStatus();

        this.executeCurrentStepTrade();
      }, 5000);
    }
  }

  /**
   * Executes a single test trade on the currently selected step market
   */
  public triggerManualDifferTest(marketIndex?: number) {
    if (this.status.isTradeActive) return;
    const targetIdx = marketIndex !== undefined ? marketIndex : this.status.currentStepIndex;
    this.status.currentStepIndex = targetIdx;
    const targetM = LOWEST_FREQUENCY_MARKETS[targetIdx];
    this.status.activeMarketSymbol = targetM.symbol;
    this.executeCurrentStepTrade();
  }

  private calculateStake(): number {
    let stake = this.status.currentStake || this.config.baseStake;

    if (this.config.stakeMode === 'BALANCE_PERCENT') {
      const pct = 0.01;
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
        this.status.currentStake = Number(
          (this.status.currentStake + this.status.currentStake * 0.09).toFixed(2)
        );
      } else {
        this.status.currentStake = this.config.baseStake;
      }
    } else {
      this.status.currentStake = this.config.baseStake;
    }
  }
}

export const lowestFrequencyBotEngine = new LowestFrequencyBotEngine();
