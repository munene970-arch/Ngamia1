import { MarketSymbol, Tick, ActiveContract } from '../types/deriv';
import { derivWS, extractDerivLastDigit, formatDerivQuote } from './derivWebSocket';
import { soundManager } from '../utils/soundEffects';

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
  { symbol: 'R_25', name: 'Volatility 25 Index', shortName: 'Vol 25', volatility: 25, isOneSecond: false, pipSize: 3 },
  { symbol: '1HZ25V', name: 'Volatility 25 (1s) Index', shortName: 'Vol 25 (1s)', volatility: 25, isOneSecond: true, pipSize: 2 },
  { symbol: 'R_50', name: 'Volatility 50 Index', shortName: 'Vol 50', volatility: 50, isOneSecond: false, pipSize: 4 },
  { symbol: '1HZ50V', name: 'Volatility 50 (1s) Index', shortName: 'Vol 50 (1s)', volatility: 50, isOneSecond: true, pipSize: 2 },
  { symbol: 'R_75', name: 'Volatility 75 Index', shortName: 'Vol 75', volatility: 75, isOneSecond: false, pipSize: 4 },
  { symbol: '1HZ75V', name: 'Volatility 75 (1s) Index', shortName: 'Vol 75 (1s)', volatility: 75, isOneSecond: true, pipSize: 2 },
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
export type AutoTerminalStrategy = 'DOUBLE_IDENTICAL_2TICK' | 'ASCENDING_SEQUENTIAL_1TICK';

export interface SystemAutoConfig {
  strategyMode: AutoTerminalStrategy;
  baseStake: number;
  stakeMode: MoneyManagementMode;
  martingaleMultiplier: number;
  maxMartingaleSteps: number;
  compoundingPercent: number;
  durationTicks: number; // Defaults to 2 ticks for Double Identical Differ
  marketScope: MarketScopeMode;
  specificMarketSymbol?: MarketSymbol; // For SINGLE_SPECIFIC mode
  selectedSymbols?: MarketSymbol[]; // For CUSTOM_SELECTED mode
  takeProfit: number;
  stopLoss: number;
  maxConsecutiveLosses: number;
  delayBetweenTradesMs: number;
  marketCooldownSec: number;
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
  lastTwinTime: number | null;
  twinOccurrencesCount: number;
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
}

class SystemAutoDifferEngine {
  private config: SystemAutoConfig = {
    strategyMode: 'DOUBLE_IDENTICAL_2TICK',
    baseStake: 0.50,
    stakeMode: 'MARTINGALE',
    martingaleMultiplier: 11.2,
    maxMartingaleSteps: 4,
    compoundingPercent: 50,
    durationTicks: 2, // 2 ticks duration: Trade settles on 2nd tick
    marketScope: 'ALL_10_TO_100',
    specificMarketSymbol: 'R_10',
    selectedSymbols: ['R_10', '1HZ10V', 'R_25', '1HZ25V', 'R_50', '1HZ50V', 'R_75', '1HZ75V', 'R_100', '1HZ100V'],
    takeProfit: 25,
    stopLoss: 50,
    maxConsecutiveLosses: 3,
    delayBetweenTradesMs: 0, // 0ms = Instant Zero-Lag Execution
    marketCooldownSec: 0, // 0s cooldown for immediate next-trade trigger
  };

  private isRunning: boolean = false;
  private isSettling: boolean = false;
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
  private statusMessage: string = 'System Auto Terminal Ready. Double Identical Digit 2-Tick Differ Sniper enabled.';
  private stopReason: string | null = null;
  private lastTradeStartTime: number = 0;
  private lastExecutionMs: number = 0;
  private consecutiveWinProfitAccumulator: number = 0;
  private currentMartingaleStep: number = 0;

  private currentBalanceUsd: number = 10000;
  private lastSettledProfit: number | null = null;
  private lastSettledBalance: number | null = null;
  private lastSettledMarketName: string | null = null;
  private lastSettledTriggerReason: string | null = null;
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

  constructor() {
    this.initLiveSubscriptions();
    this.loadSavedConfig();
  }

  public getMarketPool(): AscendingMarket[] {
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
        if (this.config.strategyMode === 'DOUBLE_IDENTICAL_2TICK' && !this.config.durationTicks) {
          this.config.durationTicks = 2;
        }
        this.currentStake = this.config.baseStake;
      }
    } catch {
      // fallback
    }
  }

  public saveConfig(newConfig: Partial<SystemAutoConfig>) {
    const prevScope = this.config.marketScope;
    const prevTarget = this.config.specificMarketSymbol;
    this.config = { ...this.config, ...newConfig };

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
      const dur = this.config.durationTicks || 2;
      if (this.config.marketScope === 'SINGLE_SPECIFIC') {
        this.statusMessage = `🎯 Target market locked to [${currentTarget.shortName}]. Differ duration: ${dur}t. Ready to run.`;
      }
    } else {
      const pool = this.getMarketPool();
      const currentTarget = pool[this.activeMarketIndex % (pool.length || 1)] || pool[0];
      const dur = this.config.durationTicks || 2;
      if (this.config.marketScope === 'SINGLE_SPECIFIC') {
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
        const twinTime = isTwin ? Date.now() : current?.lastTwinTime ?? null;
        const prevTwinCount = current?.twinOccurrencesCount || 0;
        const twinOccurrencesCount = isTwin && (!current?.hasTwinDigit || current.lastDigit !== lastDigit) ? prevTwinCount + 1 : prevTwinCount;

        this.marketStates.set(market.symbol, {
          symbol: market.symbol,
          price: tick.quote,
          displayPrice,
          lastDigit,
          lastTickTime: Date.now(),
          recentDigits: recent,
          hasTwinDigit: isTwin,
          twinDigit,
          lastTwinTime: twinTime,
          twinOccurrencesCount,
        });

        this.notifyMarketStates();

        // 🎯 LIVE SCANNER CHECK: If bot is running in DOUBLE_IDENTICAL_2TICK mode, evaluate real-time trigger
        if (
          this.isRunning &&
          this.config.strategyMode === 'DOUBLE_IDENTICAL_2TICK' &&
          !this.isProcessingTrade &&
          !this.isSettling &&
          this.activeContractId === null
        ) {
          const pool = this.getMarketPool();
          if (this.config.marketScope === 'SINGLE_SPECIFIC') {
            const targetSymbol = this.config.specificMarketSymbol || 'R_10';
            if (market.symbol === targetSymbol && isTwin && twinDigit !== null) {
              const targetMarket = ASCENDING_VOLATILITY_MARKETS.find((m) => m.symbol === targetSymbol) || market;
              this.handleDoubleIdenticalDetected(targetMarket, twinDigit, tick.quote);
            }
          } else {
            const targetMarket = pool[this.activeMarketIndex % (pool.length || 1)];
            // Only evaluate the current target market
            if (targetMarket && targetMarket.symbol === market.symbol && isTwin && twinDigit !== null) {
              this.handleDoubleIdenticalDetected(targetMarket, twinDigit, tick.quote);
            }
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

  public startBot(startMarketIndex: number = 0) {
    if (this.isRunning) return;

    this.isRunning = true;
    this.stopReason = null;
    this.activeMarketIndex = startMarketIndex;
    this.tradedMarketsInCycle.clear();
    this.currentStake = this.config.baseStake;
    this.currentMartingaleStep = 0;
    this.consecutiveWinProfitAccumulator = 0;
    this.isProcessingTrade = false;
    this.activeContractId = null;
    this.activeDifferDigit = null;
    this.activeTriggerReason = null;
    this.activeContractTicks = [];
    this.previousDifferDigit = null;
    this.marketLastTradeTime.clear();
    this.marketLastTriggerPrice.clear();

    soundManager.playStart();

    const pool = this.getMarketPool();
    const currentTarget = pool[this.activeMarketIndex % (pool.length || 1)] || pool[0];

    if (this.config.strategyMode === 'DOUBLE_IDENTICAL_2TICK') {
      const dur = this.config.durationTicks || 2;
      if (this.config.marketScope === 'SINGLE_SPECIFIC') {
        this.statusMessage = `🎯 Sniper Locked on [${currentTarget.shortName}]! Scanning for Double Identical twin digits (≠Differ ${dur}t settle)...`;
      } else {
        this.statusMessage = `🚀 Ascending Scanner Active! Starting at [${currentTarget.shortName}] (Market 1/${pool.length} in Cycle #${this.currentCycle}). Scanning for Double Identical twin digits (${dur}t Differ)...`;
      }
      this.notifyStatus();

      // Check if target market already has an active twin digit right now!
      const targetState = this.marketStates.get(currentTarget.symbol);
      if (targetState?.hasTwinDigit && targetState.twinDigit !== null) {
        this.handleDoubleIdenticalDetected(currentTarget, targetState.twinDigit, targetState.price);
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
      this.activeContractId = null;
      this.activeDifferDigit = null;
      this.activeTriggerReason = null;
      this.statusMessage = `🛑 Bot stopped: ${reason}`;
    }

    soundManager.playStop();
    this.notifyStatus();
  }

  public resetStats() {
    if (this.watchdogTimer) {
      window.clearTimeout(this.watchdogTimer);
      this.watchdogTimer = null;
    }
    if (this.nextTradeTimer) {
      window.clearTimeout(this.nextTradeTimer);
      this.nextTradeTimer = null;
    }
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
    this.marketLastTradeTime.clear();
    this.marketLastTriggerPrice.clear();
    this.isProcessingTrade = false;
    this.statusMessage = 'System Auto Terminal stats and trade history reset.';
    this.notifyStatus();
    this.notifyHistory();
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
    this.isSettling = false;
    this.marketLastTradeTime.set(market.symbol, now);
    this.marketLastTriggerPrice.set(market.symbol, quote);
    this.lastTradeStartTime = performance.now();
    this.activeDifferDigit = twinDigit;
    this.activeContractTicks = [];

    const triggerReason = `Twin [${twinDigit}, ${twinDigit}] on ${market.shortName}`;
    this.activeTriggerReason = triggerReason;
    const duration = this.config.durationTicks || 2;

    this.statusMessage = `⚡ [${market.shortName}] Triggered Double Identical [${twinDigit}, ${twinDigit}] ➔ Buying DIFF ${twinDigit} (≠${twinDigit}, ${duration} Tick${duration > 1 ? 's' : ''} to Settle, Stake: $${this.currentStake.toFixed(2)})`;
    this.notifyStatus();

    try {
      const contract = derivWS.purchaseContract({
        symbol: market.symbol,
        symbolName: market.name,
        contractType: 'DIGITDIFF',
        stake: Number(this.currentStake.toFixed(2)),
        durationTicks: duration,
        durationUnit: 't',
        targetDigit: twinDigit,
      });

      if (contract.status === 'CANCELLED') {
        this.isProcessingTrade = false;
        this.activeContractId = null;
        this.statusMessage = `⚠️ Trade shielded/cancelled on ${market.shortName}: Order not sent. Resuming live scan...`;
        this.notifyStatus();
        return;
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
        stake: Number(this.currentStake.toFixed(2)),
        profit: 0,
        result: 'OPEN',
        durationTicks: duration,
        entryPrice: contract.entrySpot,
        cycleNumber: this.currentCycle,
        ticksCaptured: [],
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

    this.statusMessage = `⚡ [${targetMarket.shortName}] Last digit: ${differDigit} ➔ Executing DIFF ${differDigit} (Stake: $${this.currentStake.toFixed(2)})`;
    this.notifyStatus();

    try {
      const contract = derivWS.purchaseContract({
        symbol: targetMarket.symbol,
        symbolName: targetMarket.name,
        contractType: 'DIGITDIFF',
        stake: Number(this.currentStake.toFixed(2)),
        durationTicks: duration,
        durationUnit: 't',
        targetDigit: differDigit,
      });

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
        stake: Number(this.currentStake.toFixed(2)),
        profit: 0,
        result: 'OPEN',
        durationTicks: duration,
        entryPrice: contract.entrySpot,
        cycleNumber: this.currentCycle,
        ticksCaptured: [],
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

    // Extract intermediate digit if available (Tick 1)
    let intermediateDigit: number | null = null;
    let intermediateSpot: number | null = null;
    if (contract.historySpots && contract.historySpots.length > 1) {
      intermediateSpot = contract.historySpots[0];
      intermediateDigit = extractDerivLastDigit(intermediateSpot, pipSize, contract.symbol);
    }

    // Update log
    const existingLog = this.tradeHistory.find((t) => t.id === contract.id);
    if (existingLog) {
      existingLog.result = isWin ? 'WIN' : 'LOSS';
      existingLog.profit = Number(profit.toFixed(2));
      existingLog.exitDigit = exitDigit;
      existingLog.exitPrice = contract.exitSpot ?? contract.currentSpot;
      existingLog.intermediateDigit = intermediateDigit;
      existingLog.intermediateSpot = intermediateSpot;
      existingLog.ticksCaptured = this.activeContractTicks;
      this.notifyHistory();
    }

    // Update statistics
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
    }

    // Explicit Balance Update
    const newBalance = Number((this.currentBalanceUsd + profit).toFixed(2));
    this.currentBalanceUsd = newBalance;
    this.lastSettledProfit = profit;
    this.lastSettledBalance = newBalance;
    this.lastSettledMarketName = existingLog?.marketName || contract.symbolName || contract.symbol;
    this.lastSettledTriggerReason = existingLog?.triggerReason || this.activeTriggerReason;

    if (this.onBalanceUpdateCallback) {
      this.onBalanceUpdateCallback(profit, newBalance);
    }
    derivWS.refreshBalance();

    // Calculate next stake
    this.calculateNextStake(isWin);

    // Enter Settling State (waiting for previous market to close and balance to update)
    this.isSettling = true;
    this.isProcessingTrade = false;
    this.activeContractId = null;
    this.activeDifferDigit = null;
    this.activeTriggerReason = null;

    const prevMarketShort = this.lastSettledMarketName;
    const outcomeText = isWin ? `✅ WON (+$${profit.toFixed(2)})` : `❌ LOST (-$${Math.abs(profit).toFixed(2)})`;
    const balanceText = `$${newBalance.toFixed(2)}`;
    const twinTag = existingLog?.twinPattern ? `${existingLog.twinPattern} ` : '';
    const settleInfo = intermediateDigit !== null
      ? `(Tick 1: [${intermediateDigit}] ➔ Tick 2 Settle: [${exitDigit}])`
      : `(Exit Digit: [${exitDigit}])`;

    if (!this.isRunning) {
      this.isSettling = false;
      this.statusMessage = `🛑 Bot stopped. Trade settled: ${outcomeText} on ${prevMarketShort} Differed ≠${existingLog?.differDigit ?? '?'} ${settleInfo} • Balance: ${balanceText}`;
      this.notifyStatus();
      return;
    }

    // Check risk limits
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

    // Mark settled market as traded in current ascending cycle
    const pool = this.getMarketPool();
    const settledSymbol = contract.symbol;
    this.tradedMarketsInCycle.add(settledSymbol);

    // Advance to next market in ascending volatility sequence (10 -> 100)
    const nextIndex = this.activeMarketIndex + 1;
    let cycleCompleted = false;
    if (nextIndex >= pool.length) {
      this.activeMarketIndex = 0;
      this.currentCycle++;
      this.currentStepInCycle = 0;
      this.tradedMarketsInCycle.clear();
      cycleCompleted = true;
    } else {
      this.activeMarketIndex = nextIndex;
      this.currentStepInCycle = nextIndex;
    }

    const nextTargetMarket = pool[this.activeMarketIndex % (pool.length || 1)] || pool[0];

    if (this.config.marketScope === 'SINGLE_SPECIFIC') {
      this.statusMessage = `${outcomeText} on ${prevMarketShort} ${twinTag}Differed ≠${existingLog?.differDigit ?? '?'} ${settleInfo} ➔ 💰 Balance Updated: ${balanceText} ➔ Ready on [${nextTargetMarket.shortName}]...`;
    } else {
      this.statusMessage = `${outcomeText} on ${prevMarketShort} ${twinTag}Differed ≠${existingLog?.differDigit ?? '?'} ${settleInfo} ➔ 💰 Balance Updated: ${balanceText} ➔ Next Ascending Market: ${nextTargetMarket.shortName}...`;
    }
    this.notifyStatus();

    const delay = Math.max(0, this.config.delayBetweenTradesMs ?? 0);

    if (this.nextTradeTimer) {
      window.clearTimeout(this.nextTradeTimer);
      this.nextTradeTimer = null;
    }

    const proceedToNext = () => {
      this.nextTradeTimer = null;
      this.isSettling = false;

      if (!this.isRunning) {
        this.notifyStatus();
        return;
      }

      if (this.config.strategyMode === 'ASCENDING_SEQUENTIAL_1TICK') {
        this.executeNextMarketTrade();
      } else {
        if (this.config.marketScope === 'SINGLE_SPECIFIC') {
          this.statusMessage = `⚡ Sniper Active on [${nextTargetMarket.shortName}] (Trade #${this.totalWins + this.totalLosses + 1}) ➔ Scanning for Double Identical twin digits...`;
        } else if (cycleCompleted) {
          this.statusMessage = `🎉 Ascending Cycle #${this.currentCycle - 1} Complete! All ${pool.length} selected markets traded once. Starting Cycle #${this.currentCycle} at [${nextTargetMarket.shortName}]...`;
        } else {
          this.statusMessage = `⚡ Ascending Target [Market #${this.activeMarketIndex + 1}/${pool.length}: ${nextTargetMarket.shortName}] ➔ Scanning for Double Identical twin digits (1 trade for this market)...`;
        }
        this.notifyStatus();
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
        durationTicks: this.config.durationTicks || 2,
        durationUnit: 't',
        targetDigit: twinDigit,
      });
      soundManager.playButtonClick();
    } catch (err) {
      console.error('Manual double differ trigger error:', err);
    }
  }
}

export const systemAutoEngine = new SystemAutoDifferEngine();
