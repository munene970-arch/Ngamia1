import { MarketSymbol, Tick, ActiveContract } from '../types/deriv';
import { derivWS, extractDerivLastDigit } from './derivWebSocket';
import { INITIAL_MARKETS } from './derivMarketsData';
import { soundManager } from '../utils/soundEffects';

export interface MarketPatternState {
  symbol: MarketSymbol;
  displayName: string;
  history: number[];
  ticksSeen: number;
  inTrade: boolean;
  activeContractId: string | null;
  activeContract: ActiveContract | null;
  lastPattern?: [number, number, number];
  lastPrediction?: number;
  lastQuote?: number;
  currentStake: number;
  trades: number;
  wins: number;
  losses: number;
  profit: number;
  status: 'IDLE' | 'SCANNING' | 'XXY_SIGNAL' | 'IN_TRADE' | 'WON' | 'LOST';
  lastMessage: string;
  lastUpdated: number;
}

export interface DoubleRepeatConfig {
  scanMode: 'ALL_VOLATILITIES' | 'SELECTED_ONLY' | 'STANDARD_VOLATILITIES' | 'HIGH_SPEED_1S';
  selectedSymbols: MarketSymbol[];
  baseStake: number;
  martingaleFactor: number;
  maxMartingaleLevel: number;
  takeProfit: number;
  stopLoss: number;
  maxConcurrentVolatilities: number; // Max concurrent active trades across all markets (e.g. 12 = 1 per each)
  compoundingStake?: boolean;
}

export interface DoubleRepeatStatus {
  running: boolean;
  scanMode: 'ALL_VOLATILITIES' | 'SELECTED_ONLY' | 'STANDARD_VOLATILITIES' | 'HIGH_SPEED_1S';
  scannedSymbols: MarketSymbol[];
  baseStake: number;
  totalTicksSeen: number;
  totalTrades: number;
  totalWins: number;
  totalLosses: number;
  totalProfit: number;
  activeTradesCount: number;
  maxConcurrentVolatilities: number;
  markets: Record<string, MarketPatternState>;
  globalMessage: string;
  takeProfitReached: boolean;
  stopLossReached: boolean;
}

export const ALL_VOLATILITY_SYMBOLS: MarketSymbol[] = [
  'R_10', 'R_25', 'R_50', 'R_75', 'R_100',
  '1HZ10V', '1HZ15V', '1HZ25V', '1HZ30V', '1HZ50V', '1HZ75V', '1HZ90V', '1HZ100V',
];

export const STANDARD_VOLATILITY_SYMBOLS: MarketSymbol[] = [
  'R_10', 'R_25', 'R_50', 'R_75', 'R_100',
];

export const HIGH_SPEED_VOLATILITY_SYMBOLS: MarketSymbol[] = [
  '1HZ10V', '1HZ15V', '1HZ25V', '1HZ30V', '1HZ50V', '1HZ75V', '1HZ90V', '1HZ100V',
];

type StatusListener = (status: DoubleRepeatStatus) => void;

class DoubleRepeatStrategyService {
  private running = false;
  private scanMode: DoubleRepeatConfig['scanMode'] = 'ALL_VOLATILITIES';
  private selectedSymbols: MarketSymbol[] = [...ALL_VOLATILITY_SYMBOLS];
  private baseStake = 10;
  private martingaleFactor = 11.5;
  private maxMartingaleLevel = 3;
  private takeProfit = 50;
  private stopLoss = 100;
  private maxConcurrentVolatilities = 12; // 1 trade per every volatility
  private compoundingStake = false;

  private markets: Map<MarketSymbol, MarketPatternState> = new Map();
  private tickListeners: Map<MarketSymbol, (tick: Tick) => void> = new Map();
  private contractListener?: (contract: ActiveContract) => void;
  private statusListeners = new Set<StatusListener>();

  private totalTicksSeen = 0;
  private totalTrades = 0;
  private totalWins = 0;
  private totalLosses = 0;
  private totalProfit = 0;
  private globalMessage = 'Ready to scan all volatility markets';
  private takeProfitReached = false;
  private stopLossReached = false;

  constructor() {
    this.initializeMarkets(ALL_VOLATILITY_SYMBOLS);

    this.contractListener = (contract: ActiveContract) => {
      this.handleContractSettlement(contract);
    };
    derivWS.subscribeContracts(this.contractListener);
  }

  private initializeMarkets(symbols: MarketSymbol[]) {
    symbols.forEach((sym) => {
      if (!this.markets.has(sym)) {
        const info = INITIAL_MARKETS.find((m) => m.symbol === sym);
        this.markets.set(sym, {
          symbol: sym,
          displayName: info?.displayName || sym,
          history: [],
          ticksSeen: 0,
          inTrade: false,
          activeContractId: null,
          activeContract: null,
          currentStake: this.baseStake,
          trades: 0,
          wins: 0,
          losses: 0,
          profit: 0,
          status: 'IDLE',
          lastMessage: 'Idle',
          lastUpdated: Date.now(),
        });
      }
    });
  }

  public subscribeStatus(listener: StatusListener) {
    this.statusListeners.add(listener);
    listener(this.getStatus());
    return () => {
      this.statusListeners.delete(listener);
    };
  }

  private notify() {
    const status = this.getStatus();
    this.statusListeners.forEach((listener) => listener(status));
  }

  public getStatus(): DoubleRepeatStatus {
    const marketsObj: Record<string, MarketPatternState> = {};
    let activeTradesCount = 0;

    this.markets.forEach((val, key) => {
      marketsObj[key] = { ...val, history: [...val.history] };
      if (val.inTrade || val.activeContractId) {
        activeTradesCount++;
      }
    });

    return {
      running: this.running,
      scanMode: this.scanMode,
      scannedSymbols: [...this.selectedSymbols],
      baseStake: this.baseStake,
      totalTicksSeen: this.totalTicksSeen,
      totalTrades: this.totalTrades,
      totalWins: this.totalWins,
      totalLosses: this.totalLosses,
      totalProfit: Number(this.totalProfit.toFixed(2)),
      activeTradesCount,
      maxConcurrentVolatilities: this.maxConcurrentVolatilities,
      markets: marketsObj,
      globalMessage: this.globalMessage,
      takeProfitReached: this.takeProfitReached,
      stopLossReached: this.stopLossReached,
    };
  }

  public setConfig(config: Partial<DoubleRepeatConfig>) {
    if (config.baseStake !== undefined && config.baseStake > 0) {
      this.baseStake = config.baseStake;
      // update base stakes for non-in-trade markets
      this.markets.forEach((m) => {
        if (!m.inTrade) m.currentStake = this.baseStake;
      });
    }
    if (config.martingaleFactor !== undefined && config.martingaleFactor >= 1) {
      this.martingaleFactor = config.martingaleFactor;
    }
    if (config.compoundingStake !== undefined) {
      this.compoundingStake = config.compoundingStake;
    }
    if (config.takeProfit !== undefined) this.takeProfit = config.takeProfit;
    if (config.stopLoss !== undefined) this.stopLoss = config.stopLoss;
    if (config.maxConcurrentVolatilities !== undefined) {
      this.maxConcurrentVolatilities = Math.max(1, config.maxConcurrentVolatilities);
    }
    if (config.scanMode !== undefined) {
      this.scanMode = config.scanMode;
      if (config.scanMode === 'ALL_VOLATILITIES') {
        this.selectedSymbols = [...ALL_VOLATILITY_SYMBOLS];
      } else if (config.scanMode === 'STANDARD_VOLATILITIES') {
        this.selectedSymbols = [...STANDARD_VOLATILITY_SYMBOLS];
      } else if (config.scanMode === 'HIGH_SPEED_1S') {
        this.selectedSymbols = [...HIGH_SPEED_VOLATILITY_SYMBOLS];
      }
    }
    if (config.selectedSymbols !== undefined && config.selectedSymbols.length > 0) {
      this.selectedSymbols = [...config.selectedSymbols];
    }

    this.initializeMarkets(this.selectedSymbols);
    this.notify();
  }

  public setStake(stake: number) {
    this.setConfig({ baseStake: stake });
  }

  public setSymbol(symbol: MarketSymbol) {
    if (this.scanMode === 'SELECTED_ONLY' && this.selectedSymbols[0] === symbol) return;
    this.selectedSymbols = [symbol];
    this.initializeMarkets([symbol]);
    this.notify();
  }

  public setScanMode(mode: DoubleRepeatConfig['scanMode'], specificSymbols?: MarketSymbol[]) {
    const wasRunning = this.running;
    if (wasRunning) this.stop(false);

    this.scanMode = mode;
    if (mode === 'ALL_VOLATILITIES') {
      this.selectedSymbols = [...ALL_VOLATILITY_SYMBOLS];
    } else if (mode === 'STANDARD_VOLATILITIES') {
      this.selectedSymbols = [...STANDARD_VOLATILITY_SYMBOLS];
    } else if (mode === 'HIGH_SPEED_1S') {
      this.selectedSymbols = [...HIGH_SPEED_VOLATILITY_SYMBOLS];
    } else if (specificSymbols && specificSymbols.length) {
      this.selectedSymbols = [...specificSymbols];
    }

    this.initializeMarkets(this.selectedSymbols);
    if (wasRunning) this.start();
    else this.notify();
  }

  public start(scanSymbols: MarketSymbol[] = this.selectedSymbols, stake = this.baseStake) {
    this.stop(false);

    this.selectedSymbols = scanSymbols.length ? scanSymbols : [...ALL_VOLATILITY_SYMBOLS];
    this.baseStake = stake;
    this.takeProfitReached = false;
    this.stopLossReached = false;
    this.running = true;

    this.initializeMarkets(this.selectedSymbols);

    // Reset market states for active scanning
    this.selectedSymbols.forEach((sym) => {
      const m = this.markets.get(sym);
      if (m) {
        m.history = [];
        m.inTrade = false;
        m.activeContractId = null;
        m.activeContract = null;
        m.currentStake = this.baseStake;
        m.status = 'SCANNING';
        m.lastMessage = 'Scanning for [X, X, Y] pattern (Y ≠ X)';
      }
    });

    this.globalMessage = `Omni-Scanner Active: Monitoring ${this.selectedSymbols.length} Volatility Indices (1 Trade/Market Limit)`;

    // Subscribe ticks for each scanned volatility index
    this.selectedSymbols.forEach((sym) => {
      const listener = (tick: Tick) => this.onMarketTick(sym, tick);
      this.tickListeners.set(sym, listener);
      derivWS.subscribeTicks(sym, listener);
    });

    this.notify();
  }

  public stop(update = true) {
    // Unsubscribe all active tick listeners
    this.tickListeners.forEach((listener, sym) => {
      derivWS.unsubscribeTicks(sym, listener);
    });
    this.tickListeners.clear();

    this.running = false;
    this.markets.forEach((m) => {
      m.status = 'IDLE';
      m.inTrade = false;
      m.activeContractId = null;
      m.lastMessage = 'Scanner Stopped';
    });

    this.globalMessage = 'Multi-Market XXY Bot Stopped';
    if (update) this.notify();
  }

  public resetStats() {
    this.totalTicksSeen = 0;
    this.totalTrades = 0;
    this.totalWins = 0;
    this.totalLosses = 0;
    this.totalProfit = 0;
    this.takeProfitReached = false;
    this.stopLossReached = false;
    this.markets.forEach((m) => {
      m.trades = 0;
      m.wins = 0;
      m.losses = 0;
      m.profit = 0;
      m.currentStake = this.baseStake;
      m.history = [];
    });
    this.globalMessage = 'Session statistics reset';
    this.notify();
  }

  private onMarketTick(symbol: MarketSymbol, tick: Tick) {
    if (!this.running) return;
    if (tick.symbol !== symbol) return;

    const market = this.markets.get(symbol);
    if (!market) return;

    const digit = extractDerivLastDigit(tick.quote, tick.pipSize);
    market.lastQuote = tick.quote;
    market.history.push(digit);
    if (market.history.length > 3) {
      market.history.shift();
    }

    market.ticksSeen += 1;
    market.lastUpdated = Date.now();
    this.totalTicksSeen += 1;

    // Buffer not full yet
    if (market.history.length < 3) {
      market.status = 'SCANNING';
      market.lastMessage = `Collecting ticks: [${market.history.join(', ')}]`;
      this.notify();
      return;
    }

    const [x1, x2, y] = market.history;
    const isXXY = x1 === x2 && y !== x1;
    market.lastPattern = [x1, x2, y];

    if (!isXXY) {
      market.status = 'SCANNING';
      if (x1 === x2 && x2 === y) {
        market.lastMessage = `Skip [${x1}, ${x2}, ${y}] (Triple duplicate XXX)`;
      } else {
        market.lastMessage = `Scanning: [${x1}, ${x2}, ${y}]`;
      }
      this.notify();
      return;
    }

    // STRICT USER REQUIREMENT: Only 1 trade per every volatility at any time!
    if (market.inTrade || market.activeContractId) {
      market.lastMessage = `XXY [${x1}, ${x2}, ${y}] held (1-trade limit active on ${market.displayName})`;
      this.notify();
      return;
    }

    // Check global max concurrent trades limit across all markets
    let currentActiveTrades = 0;
    this.markets.forEach((m) => {
      if (m.inTrade || m.activeContractId) currentActiveTrades++;
    });

    if (currentActiveTrades >= this.maxConcurrentVolatilities) {
      market.lastMessage = `XXY [${x1}, ${x2}, ${y}] waiting (Global max concurrent limit: ${this.maxConcurrentVolatilities})`;
      this.notify();
      return;
    }

    // Check Take Profit or Stop Loss triggers
    if (this.takeProfitReached || this.stopLossReached) {
      return;
    }

    // EXECUTE 1-TICK DIFFERS ON THIS SPECIFIC VOLATILITY (TARGET REPEATING DIGIT X)
    market.lastPrediction = x1;
    market.inTrade = true;
    market.status = 'IN_TRADE';
    market.trades += 1;
    this.totalTrades += 1;

    const targetStake = market.currentStake > 0 ? market.currentStake : this.baseStake;
    market.lastMessage = `🎯 XXY [${x1}, ${x2}, ${y}] → BUY DIFFERS ${x1} (Differ Repeating Digit X) (1-tick) | Stake: $${targetStake.toFixed(2)}`;
    this.globalMessage = `Signal triggered on ${market.displayName}: Pattern [${x1}, ${x2}, ${y}] → BUY DIFFERS ${x1}`;

    try {
      const contract = derivWS.purchaseContract({
        symbol: market.symbol,
        symbolName: market.displayName,
        contractType: 'DIGITDIFF',
        stake: targetStake,
        durationTicks: 1,
        targetDigit: x1,
        barrier: x1,
      });

      market.activeContractId = contract.id;
      market.activeContract = contract;
      soundManager.playTradeTakenSound();
    } catch (err) {
      market.inTrade = false;
      market.activeContractId = null;
      market.activeContract = null;
      market.lastMessage = `Order error: ${err instanceof Error ? err.message : String(err)}`;
    }

    this.notify();
  }

  private handleContractSettlement(contract: ActiveContract) {
    // Check if this contract belongs to one of our scanned markets
    let matchedMarket: MarketPatternState | null = null;
    this.markets.forEach((m) => {
      if (m.activeContractId === contract.id || (m.inTrade && m.symbol === contract.symbol)) {
        matchedMarket = m;
      }
    });

    if (!matchedMarket) return;

    if (contract.status === 'OPEN') {
      matchedMarket.activeContract = contract;
      this.notify();
      return;
    }

    if (['WON', 'LOST', 'SOLD', 'CANCELLED'].includes(contract.status)) {
      matchedMarket.inTrade = false;
      matchedMarket.activeContractId = null;
      matchedMarket.activeContract = null;
      matchedMarket.history = []; // Flush history so next trade requires a strictly fresh 3-digit XXY pattern

      const isWin = contract.isWin || contract.status === 'WON';
      const isLoss = contract.status === 'LOST';
      const profitAmount = Number(contract.currentProfit ?? 0);

      soundManager.playTradeClosedSound(isWin);

      matchedMarket.profit = Number((matchedMarket.profit + profitAmount).toFixed(2));
      this.totalProfit = Number((this.totalProfit + profitAmount).toFixed(2));

      if (isWin) {
        matchedMarket.wins += 1;
        this.totalWins += 1;
        matchedMarket.status = 'WON';
        if (this.compoundingStake) {
          const nextCompoundedStake = Number((matchedMarket.currentStake + Math.max(0, profitAmount)).toFixed(2));
          matchedMarket.currentStake = nextCompoundedStake;
          matchedMarket.lastMessage = `✅ WON +$${profitAmount.toFixed(2)} on DIFFERS ${matchedMarket.lastPrediction ?? ''} → Compounding Next Stake: $${nextCompoundedStake.toFixed(2)}`;
        } else {
          matchedMarket.currentStake = this.baseStake; // Reset on win
          matchedMarket.lastMessage = `✅ WON +$${profitAmount.toFixed(2)} on DIFFERS ${matchedMarket.lastPrediction ?? ''} → Ready for next XXY`;
        }
      } else if (isLoss) {
        matchedMarket.losses += 1;
        this.totalLosses += 1;
        matchedMarket.status = 'LOST';
        // Martingale calculation on loss
        const nextStake = Number((matchedMarket.currentStake * this.martingaleFactor).toFixed(2));
        matchedMarket.currentStake = nextStake;
        matchedMarket.lastMessage = `❌ LOST -$${Math.abs(profitAmount).toFixed(2)} → Next stake: $${nextStake.toFixed(2)}`;
      } else {
        matchedMarket.lastMessage = `Trade Settled: ${contract.status} (${profitAmount >= 0 ? '+' : ''}$${profitAmount.toFixed(2)})`;
      }

      // Check Take Profit or Stop Loss
      if (this.totalProfit >= this.takeProfit) {
        this.takeProfitReached = true;
        this.globalMessage = `🎉 TAKE PROFIT TARGET REACHED (+$${this.totalProfit.toFixed(2)} / $${this.takeProfit.toFixed(2)})! Scanner Paused.`;
        this.stop(false);
      } else if (this.totalProfit <= -this.stopLoss) {
        this.stopLossReached = true;
        this.globalMessage = `🛑 STOP LOSS HIT (-$${Math.abs(this.totalProfit).toFixed(2)} / $${this.stopLoss.toFixed(2)})! Scanner Protected.`;
        this.stop(false);
      } else {
        this.globalMessage = `${matchedMarket.displayName} settled ${isWin ? 'WON ✅' : 'LOST ❌'} (${profitAmount >= 0 ? '+' : ''}$${profitAmount.toFixed(2)}). All ${this.selectedSymbols.length} volatilities scanning...`;
      }

      this.notify();
    }
  }
}

export const doubleRepeatStrategy = new DoubleRepeatStrategyService();
