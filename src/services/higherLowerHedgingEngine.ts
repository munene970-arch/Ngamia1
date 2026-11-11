import { MarketSymbol, Tick, ActiveContract } from '../types/deriv';
import { derivWS, formatDerivQuote, getMarketPipSize, calculateDerivPayoutMultiplier } from './derivWebSocket';
import { soundManager } from '../utils/soundEffects';
import { strategyShield } from './strategyShield';
import { realAccountMirrorService } from './realAccountMirrorService';

export interface HedgeLeg {
  contractId: string;
  type: 'HIGHER' | 'LOWER';
  stake: number;
  barrier: string;
  entrySpot: number;
  exitSpot?: number;
  profit: number;
  payout: number;
  status: 'OPEN' | 'WON' | 'LOST' | 'CANCELLED';
}

export interface RealMirrorTradeRecord {
  accountId: string;
  higherContractId?: string;
  lowerContractId?: string;
  higherProfit?: number;
  lowerProfit?: number;
  netProfit: number;
  status: 'PENDING' | 'SETTLED' | 'ERROR';
  confirmed: boolean;
}

export interface HedgePairTrade {
  pairId: string;
  runIndex: number;
  timestamp: number;
  timeString: string;
  symbol: MarketSymbol;
  marketName: string;
  entrySpot: number;
  exitSpot?: number;
  durationTicks: number;
  higherLeg: HedgeLeg;
  lowerLeg: HedgeLeg;
  totalStake: number;
  totalPayout: number;
  netProfit: number;
  status: 'OPEN' | 'SETTLED' | 'CANCELLED';
  summaryMessage: string;
  isVirtualRun?: boolean;
  realMirror?: RealMirrorTradeRecord;
}

export interface HigherLowerHedgingConfig {
  symbol: MarketSymbol;
  stakePerLeg: number;
  durationTicks: number;
  barrierOffset: number; // e.g. 0.45 on Vol 100, 22.50 on Vol 75
  hedgingMode: 'DUAL_STRADDLE' | 'ASYMMETRIC';
  cooldownBetweenPairsMs: number;
  maxRuns: number; // e.g. 24 runs as in screenshot, 0 = unlimited
  takeProfit: number;
  stopLoss: number;
  forceVirtual: boolean;
  autoLoop: boolean; // Auto-trigger next pair after settlement
  copyToRealAccount: boolean; // Auto copy trades/profits from demo to real account
  mirrorStakeMultiplier: number; // Multiplier when copying to real account (default: 1.0)
  targetRealAccountId?: string;
}

export interface HigherLowerHedgingStatus {
  isRunning: boolean;
  isPairActive: boolean;
  activePair: HedgePairTrade | null;
  currentRunCount: number;
  totalRunsCompleted: number;
  contractsWon: number;
  contractsLost: number;
  totalStakeAllRuns: number;
  totalPayoutAllRuns: number;
  netProfitTotal: number;
  winRate: number;
  statusMessage: string;
  lastSpot: number;
  pipSize: number;
  isRealCopyActive: boolean;
  realCopiedRuns: number;
  realCopiedNetProfit: number;
  realAccountId: string | null;
  realAccountBalance: number;
  isRealConnected: boolean;
}

export const RECOMMENDED_BARRIERS: Record<string, number> = {
  R_10: 1.10,
  R_25: 1.80,
  R_50: 0.85,
  R_75: 22.50, // Volatility 75 Index (~42,500 spot) calibrated for ~1100% (+3.86 USD on 0.35) payout
  R_100: 0.45, // Volatility 100 Index (~975 spot) calibrated for ~1100% payout
  '1HZ10V': 0.85,
  '1HZ15V': 1.00,
  '1HZ25V': 1.50,
  '1HZ30V': 1.80,
  '1HZ50V': 0.80,
  '1HZ75V': 20.00,
  '1HZ90V': 22.00,
  '1HZ100V': 0.45,
};

export const MARKET_BARRIER_PRESETS: Record<string, number[]> = {
  R_75: [15.00, 18.50, 22.50, 26.00, 32.00],
  '1HZ75V': [15.00, 18.50, 20.00, 24.00, 30.00],
  '1HZ90V': [16.00, 19.00, 22.00, 25.00, 30.00],
  R_100: [0.25, 0.35, 0.45, 0.55, 0.75],
  '1HZ100V': [0.25, 0.35, 0.45, 0.55, 0.75],
  R_50: [0.40, 0.60, 0.85, 1.10, 1.40],
  '1HZ50V': [0.40, 0.60, 0.80, 1.00, 1.30],
  R_25: [0.90, 1.30, 1.80, 2.20, 2.80],
  '1HZ25V': [0.80, 1.10, 1.50, 1.90, 2.40],
  R_10: [0.50, 0.80, 1.10, 1.40, 1.80],
  '1HZ10V': [0.40, 0.65, 0.85, 1.10, 1.50],
};

type StatusListener = (status: HigherLowerHedgingStatus) => void;
type PairHistoryListener = (history: HedgePairTrade[]) => void;
type BalanceUpdater = (profit: number, newBalance: number) => void;

class HigherLowerHedgingEngine {
  private config: HigherLowerHedgingConfig = {
    symbol: 'R_100', // Volatility 100 Index (default matching user's screenshot with spot ~975)
    stakePerLeg: 1.0, // $1.00 per leg ($2.00 total per pair)
    durationTicks: 5, // Deriv Higher/Lower standard duration
    barrierOffset: 0.45, // +0.45 / -0.45
    hedgingMode: 'DUAL_STRADDLE',
    cooldownBetweenPairsMs: 2000,
    maxRuns: 24, // 24 runs matching user screenshot
    takeProfit: 50.0,
    stopLoss: 25.0,
    forceVirtual: false,
    autoLoop: true,
    copyToRealAccount: false,
    mirrorStakeMultiplier: 1.0,
  };

  private status: HigherLowerHedgingStatus = {
    isRunning: false,
    isPairActive: false,
    activePair: null,
    currentRunCount: 0,
    totalRunsCompleted: 0,
    contractsWon: 0,
    contractsLost: 0,
    totalStakeAllRuns: 0,
    totalPayoutAllRuns: 0,
    netProfitTotal: 0,
    winRate: 0,
    statusMessage: 'Ready. Dual Simultaneous Higher & Lower Hedging Engine initialized.',
    lastSpot: 0,
    pipSize: 2,
    isRealCopyActive: false,
    realCopiedRuns: 0,
    realCopiedNetProfit: 0,
    realAccountId: null,
    realAccountBalance: 0,
    isRealConnected: false,
  };

  private pairHistory: HedgePairTrade[] = [];
  private statusListeners = new Set<StatusListener>();
  private historyListeners = new Set<PairHistoryListener>();
  private balanceUpdater: BalanceUpdater | null = null;
  private balanceUsd: number = 0;
  private subscriptionsActive = false;
  private isProcessingPair = false;
  private nextRunTimer: number | null = null;

  constructor() {
    this.loadSavedConfig();
    this.initSubscriptions();
    this.initRealMirrorSubscription();
  }

  private initRealMirrorSubscription() {
    realAccountMirrorService.subscribe((realStat) => {
      this.status.isRealConnected = realStat.isConnected;
      this.status.realAccountId = realStat.realAccountId;
      this.status.realAccountBalance = realStat.realBalance;
      this.status.isRealCopyActive = this.config.copyToRealAccount && realStat.isConnected;
      this.notifyStatus();
    });
  }

  private loadSavedConfig() {
    try {
      const saved = localStorage.getItem('mboko_higher_lower_hedging_cfg');
      if (saved) {
        const parsed = JSON.parse(saved);
        this.config = { ...this.config, ...parsed };
      }
    } catch {
      // Ignore
    }
  }

  public saveConfig(newConfig: Partial<HigherLowerHedgingConfig>) {
    this.config = { ...this.config, ...newConfig };
    try {
      localStorage.setItem('mboko_higher_lower_hedging_cfg', JSON.stringify(this.config));
    } catch {
      // Ignore
    }
    this.notifyStatus();
  }

  public getConfig(): HigherLowerHedgingConfig {
    return { ...this.config };
  }

  public getStatus(): HigherLowerHedgingStatus {
    return { ...this.status };
  }

  public getHistory(): HedgePairTrade[] {
    return [...this.pairHistory];
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

  public subscribeHistory(cb: PairHistoryListener): () => void {
    this.historyListeners.add(cb);
    cb([...this.pairHistory]);
    return () => this.historyListeners.delete(cb);
  }

  private notifyStatus() {
    const s = this.getStatus();
    this.statusListeners.forEach((cb) => cb(s));
  }

  private notifyHistory() {
    const h = this.getHistory();
    this.historyListeners.forEach((cb) => cb(h));
  }

  private initSubscriptions() {
    if (this.subscriptionsActive) return;
    this.subscriptionsActive = true;

    derivWS.subscribeTicks(this.config.symbol, (tick: Tick) => {
      this.status.lastSpot = tick.quote;
      this.status.pipSize = tick.pipSize || getMarketPipSize(this.config.symbol);
    });

    derivWS.subscribeContracts(this.handleContractUpdate.bind(this));
  }

  /**
   * Starts the continuous Hedging Loop
   */
  public async startBot() {
    if (this.status.isRunning) return;
    this.status.isRunning = true;
    this.status.statusMessage = `🚀 Hedging Bot started on ${this.config.symbol}. Initiating simultaneous Higher & Lower contract pair...`;
    this.notifyStatus();
    soundManager.playAlert();

    await this.executeDualHedgePair();
  }

  /**
   * Stops the Hedging Bot
   */
  public stopBot(reason?: string) {
    if (this.nextRunTimer !== null) {
      window.clearTimeout(this.nextRunTimer);
      this.nextRunTimer = null;
    }
    this.status.isRunning = false;
    this.status.statusMessage = reason || '🛑 Hedging Bot stopped.';
    this.notifyStatus();
    soundManager.playClickSound();
  }

  /**
   * Resets session stats and performance scorecard
   */
  public resetStats() {
    this.status.currentRunCount = 0;
    this.status.totalRunsCompleted = 0;
    this.status.contractsWon = 0;
    this.status.contractsLost = 0;
    this.status.totalStakeAllRuns = 0;
    this.status.totalPayoutAllRuns = 0;
    this.status.netProfitTotal = 0;
    this.status.winRate = 0;
    this.status.realCopiedRuns = 0;
    this.status.realCopiedNetProfit = 0;
    this.status.statusMessage = 'Session statistics reset to zero.';
    this.pairHistory = [];
    this.notifyHistory();
    this.notifyStatus();
    soundManager.playButtonClick();
  }

  /**
   * Manual 1-click test button: Launches a single dual hedge pair immediately
   */
  public async triggerManualHedgePair() {
    if (this.status.isPairActive || this.isProcessingPair) {
      console.warn('[HedgingEngine] A hedge pair is currently active. Please wait for settlement.');
      return;
    }
    await this.executeDualHedgePair(true);
  }

  /**
   * Core Simultaneous Dual Contract Execution:
   * Buys both HIGHER and LOWER contracts at the exact same tick and spot!
   */
  public async executeDualHedgePair(isManualSingle: boolean = false) {
    if (this.isProcessingPair || this.status.isPairActive) return;
    this.isProcessingPair = true;

    // Check risk limits
    if (this.status.netProfitTotal >= this.config.takeProfit && !isManualSingle) {
      this.stopBot(`🎯 Take Profit reached (+${this.status.netProfitTotal.toFixed(2)} USD >= +${this.config.takeProfit} USD)`);
      soundManager.playWin();
      this.isProcessingPair = false;
      return;
    }

    if (this.status.netProfitTotal <= -Math.abs(this.config.stopLoss) && !isManualSingle) {
      this.stopBot(`⚠️ Stop Loss reached (${this.status.netProfitTotal.toFixed(2)} USD <= -${this.config.stopLoss} USD)`);
      soundManager.playLoss();
      this.isProcessingPair = false;
      return;
    }

    if (this.config.maxRuns > 0 && this.status.totalRunsCompleted >= this.config.maxRuns && !isManualSingle) {
      this.stopBot(`🏁 Target run count reached (${this.status.totalRunsCompleted} / ${this.config.maxRuns} runs completed).`);
      soundManager.playWin();
      this.isProcessingPair = false;
      return;
    }

    const sym = this.config.symbol;
    const stake = this.config.stakePerLeg;
    const offset = Math.abs(this.config.barrierOffset || RECOMMENDED_BARRIERS[sym] || 0.45);
    const duration = this.config.durationTicks || 5;

    // Format barrier offsets
    const higherBarrier = `+${offset.toFixed(2)}`;
    const lowerBarrier = this.config.hedgingMode === 'DUAL_STRADDLE' ? `-${offset.toFixed(2)}` : `+${offset.toFixed(2)}`;

    const currentSpot = this.status.lastSpot || derivWS.getCurrentPrice(sym) || 975.23;
    const runIdx = this.status.totalRunsCompleted + 1;
    const pairId = `PAIR_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

    this.status.isPairActive = true;
    this.status.currentRunCount = runIdx;
    this.status.statusMessage = `⚡ [RUN #${runIdx}] Buying DUAL CONTRACTS simultaneously: HIGHER (${higherBarrier}) + LOWER (${lowerBarrier}) at Spot ${currentSpot.toFixed(2)}...`;
    this.notifyStatus();
    soundManager.playTradeTakenSound();

    try {
      // Leg 1: HIGHER Contract (with +offset barrier)
      const higherContract = derivWS.purchaseContract({
        symbol: sym,
        symbolName: `Vol ${sym.replace('R_', '')}`,
        contractType: 'HIGHER',
        stake: stake,
        durationTicks: duration,
        barrier: higherBarrier,
        forceVirtual: this.config.forceVirtual,
      });

      // Leg 2: LOWER Contract (with -offset or +offset barrier)
      const lowerContract = derivWS.purchaseContract({
        symbol: sym,
        symbolName: `Vol ${sym.replace('R_', '')}`,
        contractType: 'LOWER',
        stake: stake,
        durationTicks: duration,
        barrier: lowerBarrier,
        forceVirtual: this.config.forceVirtual,
      });

      const isVirtualRun = Boolean(this.config.forceVirtual || derivWS.getIsTestMode() || derivWS.getCachedIsVirtual());

      const newPair: HedgePairTrade = {
        pairId,
        runIndex: runIdx,
        timestamp: Date.now(),
        timeString: new Date().toLocaleTimeString(),
        symbol: sym,
        marketName: `Volatility ${sym.replace('R_', '')} Index`,
        entrySpot: higherContract.entrySpot || currentSpot,
        durationTicks: duration,
        isVirtualRun,
        higherLeg: {
          contractId: higherContract.id,
          type: 'HIGHER',
          stake,
          barrier: higherBarrier,
          entrySpot: higherContract.entrySpot || currentSpot,
          profit: 0,
          payout: 0,
          status: 'OPEN',
        },
        lowerLeg: {
          contractId: lowerContract.id,
          type: 'LOWER',
          stake,
          barrier: lowerBarrier,
          entrySpot: lowerContract.entrySpot || currentSpot,
          profit: 0,
          payout: 0,
          status: 'OPEN',
        },
        totalStake: stake * 2,
        totalPayout: 0,
        netProfit: 0,
        status: 'OPEN',
        summaryMessage: `Pair #${runIdx} Active • Waiting 5-Tick Settlement...`,
      };

      // ⚡ COPY TRADING ENGINE: If copyToRealAccount is active,
      // simultaneously mirror the exact same Higher & Lower contract pair to the Real Deriv Account!
      if (this.config.copyToRealAccount) {
        const realStake = Math.max(0.35, Number((stake * (this.config.mirrorStakeMultiplier || 1.0)).toFixed(2)));
        newPair.realMirror = {
          accountId: this.status.realAccountId || 'Connecting Real...',
          netProfit: 0,
          status: 'PENDING',
          confirmed: false,
        };
        this.status.isRealCopyActive = true;
        console.info(`[HedgingEngine] 🔁 Mirroring Run #${runIdx} to Real Account ($${realStake} per leg)...`);

        realAccountMirrorService.mirrorPair({
          symbol: sym,
          higherBarrier,
          lowerBarrier,
          stake: realStake,
          durationTicks: duration,
          runIndex: runIdx,
        }).then((realRes) => {
          if (newPair.realMirror) {
            newPair.realMirror.accountId = realRes.realAccountId;
            newPair.realMirror.higherContractId = realRes.higherLeg.contractId;
            newPair.realMirror.lowerContractId = realRes.lowerLeg.contractId;
            newPair.realMirror.higherProfit = realRes.higherLeg.profit;
            newPair.realMirror.lowerProfit = realRes.lowerLeg.profit;
            newPair.realMirror.netProfit = realRes.netProfit;
            newPair.realMirror.status = realRes.status === 'SETTLED' ? 'SETTLED' : realRes.status === 'ERROR' ? 'ERROR' : 'PENDING';
            newPair.realMirror.confirmed = realRes.status === 'SETTLED';
          }
          this.status.realCopiedNetProfit = Number((this.status.realCopiedNetProfit + realRes.netProfit).toFixed(2));
          this.status.realCopiedRuns += 1;
          this.notifyHistory();
          this.notifyStatus();
        }).catch((err) => {
          console.warn('[HedgingEngine] Real mirror error:', err);
          if (newPair.realMirror) {
            newPair.realMirror.status = 'ERROR';
          }
          this.notifyHistory();
        });
      }

      this.status.activePair = newPair;
      this.pairHistory.unshift(newPair);
      this.notifyHistory();
      this.notifyStatus();
    } catch (err: any) {
      console.error('[HedgingEngine] Error executing hedge pair:', err);
      this.status.isPairActive = false;
      this.status.statusMessage = `❌ Error placing dual hedge: ${err?.message || 'Failed to purchase'}`;
      this.notifyStatus();
    } finally {
      this.isProcessingPair = false;
    }
  }

  /**
   * Listens to live Deriv contract lifecycle updates and resolves the pair when both legs settle
   */
  private handleContractUpdate(contract: ActiveContract) {
    if (!this.status.activePair) return;
    const pair = this.status.activePair;

    let legUpdated = false;

    // Check if contract belongs to Higher Leg
    if (contract.id === pair.higherLeg.contractId || (contract as any).liveContractId === pair.higherLeg.contractId) {
      if (['WON', 'LOST', 'SOLD', 'CANCELLED'].includes(contract.status)) {
        pair.higherLeg.status = contract.status === 'WON' ? 'WON' : 'LOST';
        pair.higherLeg.profit = contract.currentProfit;
        pair.higherLeg.payout = contract.status === 'WON' ? contract.stake + contract.currentProfit : 0;
        if (contract.exitSpot !== undefined) {
          pair.higherLeg.exitSpot = contract.exitSpot;
          pair.exitSpot = contract.exitSpot;
        }
        legUpdated = true;
      }
    }

    // Check if contract belongs to Lower Leg
    if (contract.id === pair.lowerLeg.contractId || (contract as any).liveContractId === pair.lowerLeg.contractId) {
      if (['WON', 'LOST', 'SOLD', 'CANCELLED'].includes(contract.status)) {
        pair.lowerLeg.status = contract.status === 'WON' ? 'WON' : 'LOST';
        pair.lowerLeg.profit = contract.currentProfit;
        pair.lowerLeg.payout = contract.status === 'WON' ? contract.stake + contract.currentProfit : 0;
        if (contract.exitSpot !== undefined) {
          pair.lowerLeg.exitSpot = contract.exitSpot;
          pair.exitSpot = contract.exitSpot;
        }
        legUpdated = true;
      }
    }

    if (!legUpdated) return;

    // Check if BOTH legs have settled!
    const bothSettled =
      ['WON', 'LOST', 'CANCELLED'].includes(pair.higherLeg.status) &&
      ['WON', 'LOST', 'CANCELLED'].includes(pair.lowerLeg.status);

    if (bothSettled && pair.status === 'OPEN') {
      pair.status = 'SETTLED';
      pair.totalPayout = pair.higherLeg.payout + pair.lowerLeg.payout;
      pair.netProfit = Number((pair.higherLeg.profit + pair.lowerLeg.profit).toFixed(2));

      // Calculate winning contract count & losing contract count (matching screenshot)
      const wonCount = (pair.higherLeg.status === 'WON' ? 1 : 0) + (pair.lowerLeg.status === 'WON' ? 1 : 0);
      const lostCount = 2 - wonCount;

      this.status.contractsWon += wonCount;
      this.status.contractsLost += lostCount;
      this.status.totalStakeAllRuns += pair.totalStake;
      this.status.totalPayoutAllRuns += pair.totalPayout;
      this.status.netProfitTotal = Number((this.status.netProfitTotal + pair.netProfit).toFixed(2));
      this.status.totalRunsCompleted += 1;

      if (this.config.copyToRealAccount && this.config.forceVirtual) {
        this.status.realCopiedNetProfit = Number((this.status.realCopiedNetProfit + pair.netProfit * (this.config.mirrorStakeMultiplier || 1.0)).toFixed(2));
      }

      const totalContracts = this.status.contractsWon + this.status.contractsLost;
      this.status.winRate = totalContracts > 0 ? (this.status.contractsWon / totalContracts) * 100 : 0;

      // Update user balance
      if (this.balanceUpdater) {
        this.balanceUpdater(pair.netProfit, this.balanceUsd + pair.netProfit);
      }

      // Build summary message
      if (pair.higherLeg.status === 'WON') {
        pair.summaryMessage = `🎉 Higher won (+${pair.higherLeg.profit.toFixed(2)} USD), Lower lost (-${pair.lowerLeg.stake.toFixed(2)} USD) ➔ Net Pair Profit: +${pair.netProfit.toFixed(2)} USD!`;
        soundManager.playWin();
      } else if (pair.lowerLeg.status === 'WON') {
        pair.summaryMessage = `🎉 Lower won (+${pair.lowerLeg.profit.toFixed(2)} USD), Higher lost (-${pair.higherLeg.stake.toFixed(2)} USD) ➔ Net Pair Profit: +${pair.netProfit.toFixed(2)} USD!`;
        soundManager.playWin();
      } else {
        pair.summaryMessage = `Flat range: Both legs missed barrier ➔ Net: -${pair.totalStake.toFixed(2)} USD`;
        soundManager.playLoss();
      }

      this.status.statusMessage = `Pair #${pair.runIndex} Completed: ${pair.summaryMessage}`;
      this.status.isPairActive = false;
      this.status.activePair = null;

      this.notifyHistory();
      this.notifyStatus();

      // If Bot is in continuous running loop, schedule next dual pair after cooldown
      if (this.status.isRunning && this.config.autoLoop) {
        const delay = Math.max(1000, this.config.cooldownBetweenPairsMs);
        this.nextRunTimer = window.setTimeout(() => {
          this.nextRunTimer = null;
          if (this.status.isRunning) {
            this.executeDualHedgePair();
          }
        }, delay);
      }
    }
  }

  public getEstimatedPayout(symbol?: string, barrierOffset?: number): {
    payoutPercent: number;
    multiplier: number;
    isProfitableHedging: boolean;
    warning?: string;
  } {
    const sym = symbol || this.config.symbol;
    const offset = barrierOffset !== undefined ? barrierOffset : this.config.barrierOffset;
    const mult = calculateDerivPayoutMultiplier(sym, offset);
    const payoutPercent = Math.round(mult * 100);
    // In dual straddle hedging, buying 2 legs with 1x stake each costs 2.0x total stake.
    // Therefore winning leg must pay > 105% profit (> 2.05x return) to be net positive!
    const isProfitableHedging = mult > 1.05;
    let warning: string | undefined;

    if (!isProfitableHedging) {
      if (sym.includes('75')) {
        warning = `Barrier ±${offset.toFixed(2)} on Volatility 75 pays only ~${payoutPercent}% (+0.33 on 0.35 stake). Winning leg cannot cover the losing leg (-0.35), causing -$0.02 loss per run. Auto-calibrate to ±22.50 to get +1100% (+3.86 USD) payout!`;
      } else {
        warning = `Barrier ±${offset.toFixed(2)} pays only ~${payoutPercent}%. Hedging requires >200% payout to be profitable. Auto-calibrate offset for +1100% payout.`;
      }
    }

    return {
      payoutPercent,
      multiplier: mult,
      isProfitableHedging,
      warning,
    };
  }

  public calibrateBarrierForMarket(sym: MarketSymbol): number {
    const rec = RECOMMENDED_BARRIERS[sym] || 0.45;
    this.saveConfig({ symbol: sym, barrierOffset: rec });
    return rec;
  }
}

export const higherLowerHedgingEngine = new HigherLowerHedgingEngine();
export default higherLowerHedgingEngine;
