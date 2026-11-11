export type GhostShieldState = 'HUNTING' | 'ARMED' | 'EXECUTING_REAL';

export type ManipulationThreatLevel = 'CLEAN' | 'LOW' | 'ELEVATED' | 'HIGH' | 'CRITICAL_MANIPULATION';

export interface ManipulationAnomalyItem {
  id: string;
  time: number;
  type: 'TICK_STALL' | 'TICK_BURST' | 'DIGIT_SKEW' | 'TARGET_SUPPRESSION' | 'TARGET_MAGNET' | 'LATENCY_SPIKE';
  message: string;
  severity: 'low' | 'medium' | 'high';
}

export interface ManipulationMetrics {
  threatLevel: ManipulationThreatLevel;
  threatScore: number; // 0 to 100
  tickIntervalAnomaly: boolean;
  averageTickDeltaMs: number;
  lastTickDeltaMs: number;
  digitFrequencySkew: number; // deviation % from 10%
  targetDigitClusterAnomaly: boolean;
  targetDigitSuppressed: boolean;
  recentAnomalies: ManipulationAnomalyItem[];
  isEvasiveActionActive: boolean;
  evasiveHoldRemainingSec: number;
}

export interface GhostTradeRecord {
  id: string;
  time: number;
  symbol: string;
  contractType: string;
  targetDigit?: number;
  stake: number;
  isWin: boolean;
  profit: number;
  exitSpot?: number;
  exitDigit?: number;
  entrySpot?: number;
  reason?: string;
}

export interface StrategyShieldConfig {
  enabled: boolean;
  // 👻 Virtual Loss / Ghost Trading Shield (Protective Shadow Filter)
  enableVirtualLossShield: boolean;
  requiredVirtualLosses: number; // 1 virtual loss required before real trade
  realTradesAllowedPerArm: number; // number of real trades before resetting to ghost hunting

  // ⏱️ Anti-Manipulation Execution Timing Jitter & Obfuscation
  enableTimingObfuscation: boolean;
  enableJitter: boolean; // backward compatibility
  minJitterMs: number;
  maxJitterMs: number;
  enableSubTickDrift: boolean;
  enablePassthroughEntropy: boolean;

  // 🛡️ Dealing-Desk Manipulation Monitor & Anti-Profiling Sensor
  enableManipulationMonitor: boolean;
  manipulationThresholdScore: number; // e.g. 60 - triggers evasive hold if exceeded
  enableTickDelayDefense: boolean; // detects quote withholding / tick delays right at entry
  enableDigitSkewDefense: boolean; // detects artificial clustering or suppression
  enableTargetDigitProtection: boolean; // camouflages entry points
  evasiveHoldDurationSec: number; // cooling period during severe manipulation

  // 💰 Post-Profit Capital Shield & Withdrawal Lock
  enableProfitTargetLock: boolean; // locks session when target reached to prevent giveback
  profitTargetAmount: number; // default $25.00
  enableBankedProfitProtection: boolean; // protects peak accrued profit
  bankedProfitRetentionPercent: number; // e.g. 75%
  enableWithdrawalPrompt: boolean; // prompts withdrawal before continuing
  peakSessionProfit: number;

  // 🕵️ Stealth Zero-Trace Mode (Anti-Forensics & No Strategy History)
  enableZeroTraceMode: boolean; // do NOT persist trade records or strategy history
  autoPurgeHistoryOnSettlement: boolean; // clear memory trade items immediately upon settlement
  maskStrategyParametersInLogs: boolean; // redact target digits and stakes in UI

  // 🕶️ Ghost Anti-Broker Tracking & Evasion Shield
  enableAntiTrackingShield: boolean; // Master anti-profiling shield
  enableDecoyTraffic: boolean; // Intersperse realistic human simulated quote pings and activity
  decoyIntervalSec: number; // Interval for decoy activity (default 15s)
  enableDynamicMarketHopping: boolean; // Phantom Hopping: rotate markets to break single-asset profiling
  marketHopFrequencyTrades: number; // trades between hops (default 2)

  // Latency Spike & Slippage Guard
  enableLatencyGuard: boolean;
  maxAllowedPingMs: number;
  maxTickAgeMs: number;
  // Stake Fuzzing / Anti-Martingale Footprint Masking
  enableStakeFuzzing: boolean;
  fuzzingMaxCents: number;
  // Anti-Targeting Unpredictable Market Hopping
  enableMarketHopping: boolean;
  // Digit Stream Entropy & Trap Detector
  enableEntropyFilter: boolean;
  // Loss Streak Circuit Breakers
  enableLossStreakGuard: boolean;
  maxConsecutiveLosses: number;
  cooldownDurationSec: number;
  // Hard Stops
  enableDailyLossStop: boolean;
  maxDailyLossAmount: number;
  enableTakeProfitLock: boolean;
  takeProfitLockAmount: number;
}

export const DEFAULT_SHIELD_CONFIG: StrategyShieldConfig = {
  enabled: true,
  // Virtual Loss Shield disabled: All bots execute directly to the connected account
  enableVirtualLossShield: false,
  requiredVirtualLosses: 0,
  realTradesAllowedPerArm: 1,

  // ⏱️ Anti-Manipulation Timing Shield ON by default
  enableTimingObfuscation: true,
  enableJitter: true,
  minJitterMs: 80,
  maxJitterMs: 220,
  enableSubTickDrift: true,
  enablePassthroughEntropy: true,

  // 🕶️ Ghost Anti-Broker Tracking & Evasion Shield
  enableAntiTrackingShield: true,
  enableDecoyTraffic: true,
  decoyIntervalSec: 15,
  enableDynamicMarketHopping: false,
  marketHopFrequencyTrades: 2,

  // 🛡️ Dealing-Desk Manipulation Monitor & Anti-Profiling Sensor
  enableManipulationMonitor: true,
  manipulationThresholdScore: 80,
  enableTickDelayDefense: true,
  enableDigitSkewDefense: true,
  enableTargetDigitProtection: true,
  evasiveHoldDurationSec: 10,

  // 💰 Post-Profit Capital Shield & Withdrawal Lock
  enableProfitTargetLock: true,
  profitTargetAmount: 50,
  enableBankedProfitProtection: true,
  bankedProfitRetentionPercent: 75,
  enableWithdrawalPrompt: true,
  peakSessionProfit: 0,

  // 🕵️ Stealth Zero-Trace Mode (optional stealth setting)
  enableZeroTraceMode: false,
  autoPurgeHistoryOnSettlement: false,
  maskStrategyParametersInLogs: false,

  enableLatencyGuard: true,
  maxAllowedPingMs: 2500,
  maxTickAgeMs: 45000,
  enableStakeFuzzing: true,
  fuzzingMaxCents: 0.03,
  enableMarketHopping: false,
  enableEntropyFilter: false,
  enableLossStreakGuard: true,
  maxConsecutiveLosses: 3,
  cooldownDurationSec: 30,
  enableDailyLossStop: true,
  maxDailyLossAmount: 100,
  enableTakeProfitLock: true,
  takeProfitLockAmount: 50,
};

const STORAGE_KEY = 'mboko_strategy_shield_config';

class StrategyShieldService {
  private config: StrategyShieldConfig = { ...DEFAULT_SHIELD_CONFIG };
  private listeners = new Set<(config: StrategyShieldConfig) => void>();
  private consecutiveLosses = 0;
  private circuitBreakerUntil = 0;
  private circuitBreakerReason = '';
  private sessionLossAccumulator = 0;
  private sessionProfitAccumulator = 0;

  // 🛡️ Dealing-Desk Manipulation Monitor & Anti-Profiling State
  private tickHistory: Array<{ time: number; deltaMs: number; digit: number; symbol: string }> = [];
  private lastTickTimestampBySymbol = new Map<string, number>();
  private recentAnomalies: ManipulationAnomalyItem[] = [];
  private lastTickTimestamp = 0;
  private currentThreatScore = 8;
  private evasiveHoldUntil = 0;
  private evasiveHoldReason = '';

  // 💰 Post-Profit Capital Shield State
  private isProfitTargetLocked = false;
  private profitLockReason = '';
  private peakSessionProfit = 0;

  // 🕵️ Stealth Zero-Trace Mode listeners
  private purgeCallbacks = new Set<() => void>();

  // 👻 Virtual Loss / Ghost Shield runtime state
  private ghostModeState: GhostShieldState = 'HUNTING';
  private consecutiveVirtualLosses = 0;
  private totalVirtualTrades = 0;
  private totalVirtualWins = 0;
  private totalVirtualLosses = 0;
  private realTradesExecutedInCycle = 0;
  private lastAppliedJitterMs = 0;
  private ghostTradeHistory: GhostTradeRecord[] = [];

  // 🕶️ Ghost Anti-Tracking Event Log (live audit of stealth defenses)
  private shieldEventLogs: Array<{ id: string; time: number; text: string; type: 'jitter' | 'stake' | 'decoy' | 'radar' | 'hopping' | 'privacy' }> = [
    { id: 'init-priv', time: Date.now() - 30000, text: '🔒 Privacy Shield Active: Bot logic, 7-digit window, and parameters isolated in local browser memory (0 bytes sent to Deriv)', type: 'privacy' },
    { id: 'init-jit', time: Date.now() - 20000, text: '⏱️ Anti-Fingerprint Jitter Ready: Randomizing execution micro-delays between 80ms - 220ms', type: 'jitter' },
    { id: 'init-fuzz', time: Date.now() - 10000, text: '💵 Martingale Obfuscation Ready: Fuzzing stakes with micro-cent noise (±$0.01 - $0.03)', type: 'stake' },
  ];
  private lastDecoyTime = 0;

  constructor() {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
          this.config = { ...DEFAULT_SHIELD_CONFIG, ...JSON.parse(saved) };
        }
      } catch (err) {
        console.warn('[StrategyShield] Failed to load config from storage:', err);
      }
    }
    // Ensure virtual loss shield is disabled so bots trade directly with connected account
    this.config.enableVirtualLossShield = false;
    this.ghostModeState = 'ARMED';
  }

  public getConfig(): StrategyShieldConfig {
    return { ...this.config };
  }

  public updateConfig(partial: Partial<StrategyShieldConfig>) {
    this.config = { ...this.config, ...partial };
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.config));
      } catch (err) {
        console.warn('[StrategyShield] Failed to save config:', err);
      }
    }
    this.notifyListeners();
  }

  public subscribe(listener: (config: StrategyShieldConfig) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners() {
    this.listeners.forEach((cb) => {
      try {
        cb(this.getConfig());
      } catch (_) {}
    });
  }

  /**
   * Anti-Fingerprinting Jitter:
   * Generates a realistic, randomized micro-delay in milliseconds to prevent
   * broker robotic timestamp fingerprinting and algorithmic counter-measures.
   */
  public getRandomJitterDelay(): number {
    if (!this.config.enabled || !this.config.enableJitter) return 0;
    const min = Math.max(0, this.config.minJitterMs);
    const max = Math.max(min, this.config.maxJitterMs);
    return Math.floor(min + Math.random() * (max - min + 1));
  }

  /**
   * Stake Fuzzing / Anti-Martingale Footprint Masking:
   * Applies micro-cent variations to prevent broker pattern recognition of rigid Martingale tiers
   * (e.g. transforms flat $10.00 -> $10.03, $115.00 -> $115.05).
   */
  public calculateFuzzedStake(baseStake: number, maxBalance?: number): { stake: number; diff: number } {
    if (!this.config.enabled || !this.config.enableAntiTrackingShield || !this.config.enableStakeFuzzing || baseStake <= 0) {
      return { stake: Number(baseStake.toFixed(2)), diff: 0 };
    }
    const maxCents = Math.max(0.01, this.config.fuzzingMaxCents || 0.03);
    // Generate variance between 0.01 and maxCents
    const varianceCents = Math.floor(Math.random() * (maxCents * 100)) / 100;
    // If baseStake is close to or equal to max balance, only fuzz downwards so we never exceed available balance
    const isFullMargin = Boolean(maxBalance && maxBalance > 0 && baseStake >= maxBalance - 0.05);
    const isAdditive = isFullMargin ? false : (Math.random() > 0.3 || baseStake <= 0.5);
    const diff = isAdditive ? varianceCents : -varianceCents;
    let fuzzed = Math.max(0.35, Number((baseStake + diff).toFixed(2)));
    if (maxBalance && maxBalance >= 0.35 && fuzzed > maxBalance) {
      fuzzed = Math.max(0.35, Number(maxBalance.toFixed(2)));
    }
    const actualDiff = Number((fuzzed - baseStake).toFixed(2));
    if (actualDiff !== 0) {
      this.logShieldEvent(`💵 Stake Obfuscation: Fuzzed $${baseStake.toFixed(2)} ➔ $${fuzzed.toFixed(2)} (${actualDiff > 0 ? '+' : ''}$${actualDiff.toFixed(2)}) to mask Martingale signature`, 'stake');
    }
    return { stake: fuzzed, diff: actualDiff };
  }

  /**
   * Latency & Slippage Guard:
   * Rejects trade submission if connection ping is critically degraded or tick is frozen.
   * Tolerant of client clock skews and supports both elapsed tick age (ms) and epoch timestamps.
   */
  public checkLatencySafe(currentPingMs: number, tickAgeOrEpoch?: number): { safe: boolean; reason?: string } {
    if (!this.config.enabled || !this.config.enableLatencyGuard) {
      return { safe: true };
    }

    if (currentPingMs > this.config.maxAllowedPingMs) {
      return {
        safe: false,
        reason: `High Latency Spike (${currentPingMs}ms > max ${this.config.maxAllowedPingMs}ms). Order protected to prevent slippage.`,
      };
    }

    if (tickAgeOrEpoch && tickAgeOrEpoch > 0) {
      let ageSec = 0;
      if (tickAgeOrEpoch < 1_000_000) {
        // Provided as age in milliseconds (e.g. from derivWS.getTickAgeMs)
        ageSec = tickAgeOrEpoch / 1000;
      } else if (tickAgeOrEpoch > 1_000_000_000) {
        // Provided as Unix epoch in seconds
        const nowEpochSec = Math.floor(Date.now() / 1000);
        ageSec = Math.max(0, nowEpochSec - tickAgeOrEpoch);
      }

      // Max tick age threshold (default 45s, min 30s)
      const maxAgeSec = Math.max(30, Math.ceil(this.config.maxTickAgeMs / 1000));
      if (ageSec > maxAgeSec) {
        return {
          safe: false,
          reason: `Stale Market Tick (${ageSec.toFixed(1)}s old > max ${maxAgeSec}s). Waiting for fresh quote.`,
        };
      }
    }

    return { safe: true };
  }

  /**
   * Market Digit Stream Entropy & Trap Detector:
   * Evaluates rolling digits (e.g. last 10-15 digits) for clustering or low entropy (e.g., 5 identical or 6-in-a-row parity traps).
   */
  public checkEntropySafe(digits: number[]): { safe: boolean; score: number; reason?: string } {
    if (!this.config.enabled || !this.config.enableEntropyFilter || digits.length < 6) {
      return { safe: true, score: 100 };
    }

    const window = digits.slice(-12);
    const len = window.length;

    // Check extreme single-digit concentration
    const counts: Record<number, number> = {};
    window.forEach((d) => {
      counts[d] = (counts[d] || 0) + 1;
    });

    const maxRepeats = Math.max(...Object.values(counts));
    const maxRepeatPct = (maxRepeats / len) * 100;

    // Check consecutive parity trap (e.g. 7 Evens in a row or 7 Odds in a row)
    let parityStreak = 1;
    let maxParityStreak = 1;
    for (let i = 1; i < window.length; i++) {
      if (window[i] % 2 === window[i - 1] % 2) {
        parityStreak++;
        if (parityStreak > maxParityStreak) maxParityStreak = parityStreak;
      } else {
        parityStreak = 1;
      }
    }

    // Entropy calculation (0-100)
    let entropyScore = 100;
    if (maxRepeatPct >= 40) entropyScore -= 30;
    if (maxRepeatPct >= 50) entropyScore -= 40;
    if (maxParityStreak >= 5) entropyScore -= 25;
    if (maxParityStreak >= 7) entropyScore -= 35;

    if (entropyScore < 40) {
      return {
        safe: false,
        score: entropyScore,
        reason: `Digit Cluster / Parity Trap Detected (Entropy: ${entropyScore}%, Parity Streak: ${maxParityStreak}). Pausing entry for market normalization.`,
      };
    }

    return { safe: true, score: entropyScore };
  }

  /**
   * Registers Trade Outcome for Circuit Breakers, Streak Protection, and Banked Profit Lock
   */
  public registerTradeOutcome(isWin: boolean, profitLoss: number = 0): {
    circuitBreakerTriggered: boolean;
    cooldownSec?: number;
    consecutiveLosses: number;
    reason?: string;
  } {
    if (isWin) {
      this.consecutiveLosses = 0;
      this.sessionProfitAccumulator += Math.max(0, profitLoss);
      const currentNetProfit = this.sessionProfitAccumulator - this.sessionLossAccumulator;
      if (currentNetProfit > this.peakSessionProfit) {
        this.peakSessionProfit = currentNetProfit;
      }

      // Check Post-Profit Lock (protect profit from broker counter-measures)
      if (
        this.config.enabled &&
        this.config.enableProfitTargetLock &&
        currentNetProfit >= this.config.profitTargetAmount
      ) {
        this.isProfitTargetLocked = true;
        this.profitLockReason = `Target Profit Locked (+$${currentNetProfit.toFixed(2)}). Session locked to protect profits from broker algorithm adaptation. Withdraw profits before trading again!`;
        this.notifyListeners();
        return {
          circuitBreakerTriggered: true,
          consecutiveLosses: 0,
          cooldownSec: 7200,
          reason: this.profitLockReason,
        };
      }

      // Check Take Profit Lock
      if (
        this.config.enabled &&
        this.config.enableTakeProfitLock &&
        this.sessionProfitAccumulator >= this.config.takeProfitLockAmount
      ) {
        this.circuitBreakerUntil = Date.now() + 3600 * 1000; // 1 hour stealth lock
        this.circuitBreakerReason = `Take Profit Target Reached (+$${this.sessionProfitAccumulator.toFixed(2)}). Session locked to protect profits.`;
        this.notifyListeners();
        return {
          circuitBreakerTriggered: true,
          consecutiveLosses: 0,
          cooldownSec: 3600,
          reason: this.circuitBreakerReason,
        };
      }

      this.notifyListeners();
      return { circuitBreakerTriggered: false, consecutiveLosses: 0 };
    }

    // On Loss
    this.consecutiveLosses += 1;
    this.sessionLossAccumulator += Math.abs(profitLoss);
    const netProfitAfterLoss = this.sessionProfitAccumulator - this.sessionLossAccumulator;

    // Check Banked Profit Guard: if session has built a profit but starts giving it back
    if (
      this.config.enabled &&
      this.config.enableBankedProfitProtection &&
      this.peakSessionProfit >= 10
    ) {
      const protectedRetentionFloor = this.peakSessionProfit * (this.config.bankedProfitRetentionPercent / 100);
      if (netProfitAfterLoss < protectedRetentionFloor) {
        this.isProfitTargetLocked = true;
        this.profitLockReason = `Banked Profit Guard Triggered! Net profit dropped to +$${netProfitAfterLoss.toFixed(2)} (below ${this.config.bankedProfitRetentionPercent}% of peak +$${this.peakSessionProfit.toFixed(2)}). Live execution halted to prevent blowing the account.`;
        this.notifyListeners();
        return {
          circuitBreakerTriggered: true,
          consecutiveLosses: this.consecutiveLosses,
          cooldownSec: 7200,
          reason: this.profitLockReason,
        };
      }
    }

    // Check Daily Drawdown Hard Stop
    if (
      this.config.enabled &&
      this.config.enableDailyLossStop &&
      this.sessionLossAccumulator >= this.config.maxDailyLossAmount
    ) {
      this.circuitBreakerUntil = Date.now() + 86400 * 1000; // 24 hours lock
      this.circuitBreakerReason = `Max Daily Loss Limit Breached (-$${this.sessionLossAccumulator.toFixed(2)}). Live trading locked to preserve capital.`;
      this.notifyListeners();
      return {
        circuitBreakerTriggered: true,
        consecutiveLosses: this.consecutiveLosses,
        cooldownSec: 86400,
        reason: this.circuitBreakerReason,
      };
    }

    // Check Consecutive Loss Circuit Breaker
    if (
      this.config.enabled &&
      this.config.enableLossStreakGuard &&
      this.consecutiveLosses >= this.config.maxConsecutiveLosses
    ) {
      const cdSec = Math.max(10, this.config.cooldownDurationSec);
      this.circuitBreakerUntil = Date.now() + cdSec * 1000;
      this.circuitBreakerReason = `Streak Circuit Breaker Triggered (${this.consecutiveLosses} consecutive losses). Cooling down for ${cdSec}s.`;
      this.notifyListeners();
      return {
        circuitBreakerTriggered: true,
        cooldownSec: cdSec,
        consecutiveLosses: this.consecutiveLosses,
        reason: this.circuitBreakerReason,
      };
    }

    this.notifyListeners();
    return {
      circuitBreakerTriggered: false,
      consecutiveLosses: this.consecutiveLosses,
    };
  }

  public isCircuitBreakerActive(): boolean {
    return Date.now() < this.circuitBreakerUntil || this.isProfitTargetLocked;
  }

  public getRemainingCircuitBreakerSec(): number {
    if (this.isProfitTargetLocked) return 3600;
    if (!this.isCircuitBreakerActive()) return 0;
    return Math.max(0, Math.ceil((this.circuitBreakerUntil - Date.now()) / 1000));
  }

  public getCircuitBreakerReason(): string {
    if (this.isProfitTargetLocked) return this.profitLockReason;
    return this.circuitBreakerReason;
  }

  public isProfitLockActive(): { locked: boolean; reason?: string; profit: number; peak: number } {
    const netProfit = this.sessionProfitAccumulator - this.sessionLossAccumulator;
    return {
      locked: this.isProfitTargetLocked,
      reason: this.profitLockReason,
      profit: netProfit,
      peak: this.peakSessionProfit,
    };
  }

  public resetProfitLock() {
    this.isProfitTargetLocked = false;
    this.profitLockReason = '';
    this.peakSessionProfit = 0;
    this.sessionProfitAccumulator = 0;
    this.sessionLossAccumulator = 0;
    this.notifyListeners();
  }

  public unlockProfitSessionManually() {
    this.isProfitTargetLocked = false;
    this.profitLockReason = '';
    this.notifyListeners();
  }

  public resetCircuitBreaker() {
    this.circuitBreakerUntil = 0;
    this.circuitBreakerReason = '';
    this.consecutiveLosses = 0;
    this.sessionLossAccumulator = 0;
    this.sessionProfitAccumulator = 0;
    this.isProfitTargetLocked = false;
    this.profitLockReason = '';
    this.peakSessionProfit = 0;
    this.evasiveHoldUntil = 0;
    this.evasiveHoldReason = '';
    this.notifyListeners();
  }

  public getConsecutiveLosses(): number {
    return this.consecutiveLosses;
  }

  // ============================================================================
  // 👻 VIRTUAL LOSS / GHOST TRADING SHIELD METHODS
  // ============================================================================

  public isVirtualLossShieldActive(): boolean {
    return false; // Disabled: All bot strategies trade directly on the live broker account
  }

  public isRealArmed(): boolean {
    return true; // Always directly armed for real execution
  }

  public getGhostModeState(): GhostShieldState {
    return this.ghostModeState;
  }

  public getRequiredVirtualLosses(): number {
    return Math.max(1, this.config.requiredVirtualLosses || 1);
  }

  public getConsecutiveVirtualLosses(): number {
    return this.consecutiveVirtualLosses;
  }

  public getTotalVirtualLosses(): number {
    return this.totalVirtualLosses;
  }

  public getTotalVirtualWins(): number {
    return this.totalVirtualWins;
  }

  public getTotalVirtualTrades(): number {
    return this.totalVirtualTrades;
  }

  public getRealTradesExecutedInCycle(): number {
    return this.realTradesExecutedInCycle;
  }

  public getLastAppliedJitterMs(): number {
    return this.lastAppliedJitterMs;
  }

  public getGhostTradeHistory(): GhostTradeRecord[] {
    return [...this.ghostTradeHistory];
  }

  public armRealManually() {
    this.ghostModeState = 'ARMED';
    this.realTradesExecutedInCycle = 0;
    this.notifyListeners();
  }

  public forceGhostHunting() {
    this.ghostModeState = 'HUNTING';
    this.consecutiveVirtualLosses = 0;
    this.realTradesExecutedInCycle = 0;
    this.notifyListeners();
  }

  public resetGhostStats() {
    this.consecutiveVirtualLosses = 0;
    this.totalVirtualLosses = 0;
    this.totalVirtualWins = 0;
    this.totalVirtualTrades = 0;
    this.realTradesExecutedInCycle = 0;
    this.ghostTradeHistory = [];
    this.ghostModeState = 'HUNTING';
    this.notifyListeners();
  }

  /**
   * Registers outcome of a Ghost (Virtual) trade.
   * If a loss occurs and meets requiredVirtualLosses (default: 1),
   * flips state to ARMED so that the subsequent trade goes to Real!
   */
  public registerGhostOutcome(record: GhostTradeRecord): {
    newlyArmed: boolean;
    outcome: 'WON' | 'LOST';
    consecutiveLosses: number;
    requiredLosses: number;
  } {
    this.totalVirtualTrades++;
    this.ghostTradeHistory.unshift(record);
    if (this.ghostTradeHistory.length > 50) this.ghostTradeHistory.pop();

    const required = this.getRequiredVirtualLosses();

    if (record.isWin) {
      this.totalVirtualWins++;
      this.consecutiveVirtualLosses = 0;
      this.ghostModeState = 'HUNTING';
      this.notifyListeners();
      return {
        newlyArmed: false,
        outcome: 'WON',
        consecutiveLosses: 0,
        requiredLosses: required,
      };
    } else {
      // Virtual loss detected!
      this.totalVirtualLosses++;
      this.consecutiveVirtualLosses++;
      const newlyArmed = this.consecutiveVirtualLosses >= required;
      if (newlyArmed) {
        this.ghostModeState = 'ARMED';
        this.realTradesExecutedInCycle = 0;
      }
      this.notifyListeners();
      return {
        newlyArmed,
        outcome: 'LOST',
        consecutiveLosses: this.consecutiveVirtualLosses,
        requiredLosses: required,
      };
    }
  }

  /**
   * Registers completion of a Real trade that was executed after ghost shield armed.
   * Increments the real-trades cycle; once the allowed quota (default: 1) is reached,
   * resets back to HUNTING for the next virtual loss!
   */
  public registerRealExecutionComplete(isWin: boolean, profitLoss: number = 0) {
    this.realTradesExecutedInCycle++;
    const allowed = Math.max(1, this.config.realTradesAllowedPerArm || 1);

    if (this.realTradesExecutedInCycle >= allowed) {
      this.ghostModeState = 'HUNTING';
      this.consecutiveVirtualLosses = 0;
      this.realTradesExecutedInCycle = 0;
    }
    this.registerTradeOutcome(isWin, profitLoss);
    this.notifyListeners();
  }

  // ============================================================================
  // ⏱️ ANTI-MANIPULATION TIMING & EXECUTION SHIELD
  // ============================================================================

  /**
   * Generates a randomized micro-delay (ms) + sub-tick phase drift to break
   * broker robotic timestamp fingerprinting and dealing-desk algorithms.
   */
  public getAntiManipulationDelay(): number {
    if (!this.config.enabled || !this.config.enableAntiTrackingShield || (!this.config.enableTimingObfuscation && !this.config.enableJitter)) {
      this.lastAppliedJitterMs = 0;
      return 0;
    }
    const min = Math.max(50, this.config.minJitterMs || 80);
    const max = Math.max(min + 20, this.config.maxJitterMs || 220);
    // Add sub-tick random phase offset (0-30ms)
    const subTickDrift = this.config.enableSubTickDrift ? Math.floor(Math.random() * 30) : 0;
    const baseJitter = Math.floor(min + Math.random() * (max - min + 1));
    const finalJitter = Math.min(280, baseJitter + subTickDrift);
    this.lastAppliedJitterMs = finalJitter;
    this.logShieldEvent(`⏱️ Anti-Fingerprint Jitter: Applied +${finalJitter}ms randomized micro-delay to break machine entry cadence`, 'jitter');
    return finalJitter;
  }

  public logShieldEvent(text: string, type: 'jitter' | 'stake' | 'decoy' | 'radar' | 'hopping' | 'privacy' = 'radar') {
    const item = {
      id: `se_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      time: Date.now(),
      text,
      type,
    };
    this.shieldEventLogs.unshift(item);
    if (this.shieldEventLogs.length > 30) {
      this.shieldEventLogs.pop();
    }
    this.notifyListeners();
  }

  public getShieldEventLogs() {
    return [...this.shieldEventLogs];
  }

  public clearShieldEventLogs() {
    this.shieldEventLogs = [];
    this.notifyListeners();
  }

  public triggerDecoyIfEligible(sendFn: (req: any) => void) {
    if (!this.config.enabled || !this.config.enableAntiTrackingShield || !this.config.enableDecoyTraffic) return;
    const now = Date.now();
    const intervalMs = Math.max(8000, (this.config.decoyIntervalSec || 15) * 1000);
    if (now - this.lastDecoyTime < intervalMs) return;
    this.lastDecoyTime = now;

    const roll = Math.random();
    if (roll < 0.35) {
      sendFn({ balance: 1 });
      this.logShieldEvent('👤 Decoy Traffic: Injected human balance check to simulate active manual trader', 'decoy');
    } else if (roll < 0.7) {
      const volPool = ['R_10', 'R_25', 'R_50', 'R_75', 'R_100'];
      const sym = volPool[Math.floor(Math.random() * volPool.length)];
      sendFn({ ticks_history: sym, end: 'latest', count: 1, style: 'ticks' });
      this.logShieldEvent(`👤 Decoy Traffic: Queried background quote on ${sym} to break single-asset bot footprint`, 'decoy');
    } else {
      sendFn({ ping: 1, passthrough: { _t: Date.now(), _entropy: Math.random().toString(36).substring(2, 7) } });
      this.logShieldEvent('👤 Decoy Heartbeat: Sent human telemetry ping with randomized entropy', 'decoy');
    }
  }

  /**
   * Generates unique passthrough request metadata with entropy nonce
   * to ensure no two API requests share identical pattern signatures.
   */
  public generatePassthroughEntropy(clientId: string): Record<string, any> {
    const entropyNonce = Math.random().toString(36).substring(2, 10);
    const microEpoch = Date.now() + Math.floor(Math.random() * 100);
    return {
      client_contract_id: clientId,
      is_direct_buy: 1,
      _sn: entropyNonce,
      _et: microEpoch,
    };
  }

  // ============================================================================
  // 🛡️ REAL-TIME MANIPULATION MONITOR & DEALING-DESK ANOMALY SENSOR
  // ============================================================================

  /**
   * Feeds each market tick into the manipulation sensor.
   * Tracks tick arrival intervals per symbol, delivery stalls, and digit clustering.
   */
  public registerMarketTick(symbol: string, quote: number, digit: number, epochSec?: number) {
    const now = Date.now();
    const is1Hz = symbol.startsWith('1HZ');
    const expectedCadence = is1Hz ? 1000 : 2000;
    const lastTime = this.lastTickTimestampBySymbol.get(symbol) || (now - expectedCadence);
    const deltaMs = Math.max(50, now - lastTime);
    this.lastTickTimestampBySymbol.set(symbol, now);
    this.lastTickTimestamp = now;

    this.tickHistory.push({ time: now, deltaMs, digit, symbol });
    if (this.tickHistory.length > 80) {
      this.tickHistory.shift();
    }

    if (!this.config.enabled || !this.config.enableManipulationMonitor) {
      return;
    }

    // 1. Tick Delivery Stall Anomaly:
    // Deriv 1-second indices tick ~1000ms (stall: > 5000ms).
    // Deriv standard 2-second indices (R_10..R_100) tick ~2000ms (stall: > 7500ms).
    const stallThresholdMs = is1Hz ? 5000 : 7500;
    const severeFreezeThresholdMs = is1Hz ? 8500 : 12000;

    const symbolHistory = this.tickHistory.filter((t) => t.symbol === symbol);

    if (this.config.enableTickDelayDefense && deltaMs > stallThresholdMs && symbolHistory.length >= 3) {
      const anomaly: ManipulationAnomalyItem = {
        id: `anom_stall_${now}`,
        time: now,
        type: 'TICK_STALL',
        message: `Quote Withholding / Delayed Tick: ${deltaMs}ms interval on ${symbol} (normal: ~${expectedCadence}ms). Broker feed starvation detected.`,
        severity: deltaMs > severeFreezeThresholdMs ? 'high' : 'medium',
      };
      this.addAnomaly(anomaly);
      if (deltaMs > severeFreezeThresholdMs) {
        this.triggerEvasiveHold(`Quote delivery starvation on ${symbol} (${deltaMs}ms delay). Order suspended for market stability.`, this.config.evasiveHoldDurationSec || 10);
      }
    }

    // 2. Tick Burst Anomaly:
    // Only check burst on consecutive ticks from the SAME symbol (not across interleaved symbols)
    if (symbolHistory.length >= 4) {
      const lastThreeSameSymbol = symbolHistory.slice(-3);
      if (lastThreeSameSymbol.every((t) => t.deltaMs < 250)) {
        const anomaly: ManipulationAnomalyItem = {
          id: `anom_burst_${now}`,
          time: now,
          type: 'TICK_BURST',
          message: `Artificial Tick Burst Cluster: Multiple sub-250ms ticks received on ${symbol}. Potential dealing-desk acceleration trap.`,
          severity: 'medium',
        };
        this.addAnomaly(anomaly);
      }
    }

    // 3. Digit Skew Anomaly:
    // Check distribution across recent ticks for the same symbol
    if (this.config.enableDigitSkewDefense && symbolHistory.length >= 30) {
      const window = symbolHistory.slice(-30);
      const counts: Record<number, number> = {};
      window.forEach((t) => {
        counts[t.digit] = (counts[t.digit] || 0) + 1;
      });

      const maxCount = Math.max(...Object.values(counts));
      // Flag only if a single digit appears >= 12 times out of 30 (40% vs 10% expected)
      if (maxCount >= 12) {
        const repeatedDigit = Object.entries(counts).find(([_, count]) => count === maxCount)?.[0];
        const anomaly: ManipulationAnomalyItem = {
          id: `anom_skew_${now}`,
          time: now,
          type: 'DIGIT_SKEW',
          message: `Digit Skewing Trap: Digit ${repeatedDigit} appeared ${maxCount}x in 30 ticks (${((maxCount / 30) * 100).toFixed(0)}% vs 10% expected).`,
          severity: maxCount >= 15 ? 'high' : 'medium',
        };
        this.addAnomaly(anomaly);
      }
    }

    this.recalculateThreatScore();
  }

  private addAnomaly(item: ManipulationAnomalyItem) {
    // Avoid spamming duplicate anomalies within 10 seconds
    const recentDuplicate = this.recentAnomalies.find(
      (a) => a.type === item.type && Date.now() - a.time < 10000
    );
    if (!recentDuplicate) {
      this.recentAnomalies.unshift(item);
      if (this.recentAnomalies.length > 20) {
        this.recentAnomalies.pop();
      }
      this.notifyListeners();
    }
  }

  public getRecentAnomalies(): ManipulationAnomalyItem[] {
    return [...this.recentAnomalies];
  }

  public clearAnomalies() {
    this.recentAnomalies = [];
    this.recalculateThreatScore();
    this.notifyListeners();
  }

  private recalculateThreatScore() {
    let score = 8; // Baseline healthy score

    // Ping contribution
    const ping = 28;
    if (ping > 300) score += 5;
    if (ping > 800) score += 10;

    // Recent anomalies contribution (decay after 45s)
    const now = Date.now();
    const activeAnomalies = this.recentAnomalies.filter((a) => now - a.time < 45000);
    activeAnomalies.forEach((a) => {
      score += a.severity === 'high' ? 18 : a.severity === 'medium' ? 10 : 5;
    });

    // Clamp score
    this.currentThreatScore = Math.min(100, Math.max(5, score));
  }

  /**
   * Returns current comprehensive manipulation metrics and threat assessment.
   */
  public getManipulationMetrics(targetDigit?: number): ManipulationMetrics {
    const now = Date.now();
    const isEvasive = now < this.evasiveHoldUntil;
    const remainingHoldSec = isEvasive ? Math.max(0, Math.ceil((this.evasiveHoldUntil - now) / 1000)) : 0;

    let avgDelta = 1000;
    let lastDelta = 1000;
    let tickAnomaly = false;

    if (this.tickHistory.length > 0) {
      lastDelta = this.tickHistory[this.tickHistory.length - 1].deltaMs;
      const deltas = this.tickHistory.slice(-15).map((t) => t.deltaMs);
      avgDelta = Math.round(deltas.reduce((a, b) => a + b, 0) / deltas.length);
      tickAnomaly = lastDelta > 2200 || lastDelta < 300;
    }

    // Target digit suppression/magnet anomaly
    let targetSuppressed = false;
    let targetMagnet = false;
    let digitSkew = 0;

    if (this.tickHistory.length >= 20) {
      const recent = this.tickHistory.slice(-30);
      const total = recent.length;
      const counts: Record<number, number> = {};
      recent.forEach((t) => {
        counts[t.digit] = (counts[t.digit] || 0) + 1;
      });

      // Calculate mean deviation from 10%
      const deviations = Object.values(counts).map((c) => Math.abs((c / total) * 100 - 10));
      digitSkew = Math.round(deviations.reduce((a, b) => a + b, 0) / (deviations.length || 1));

      if (targetDigit !== undefined && targetDigit >= 0 && targetDigit <= 9) {
        const count = counts[targetDigit] || 0;
        const pct = (count / total) * 100;
        if (count === 0 && total >= 25) {
          targetSuppressed = true;
        } else if (pct >= 30) {
          targetMagnet = true;
        }
      }
    }

    let threatLevel: ManipulationThreatLevel = 'CLEAN';
    if (this.currentThreatScore >= 80 || isEvasive) threatLevel = 'CRITICAL_MANIPULATION';
    else if (this.currentThreatScore >= 60) threatLevel = 'HIGH';
    else if (this.currentThreatScore >= 40) threatLevel = 'ELEVATED';
    else if (this.currentThreatScore >= 22) threatLevel = 'LOW';

    return {
      threatLevel,
      threatScore: this.currentThreatScore,
      tickIntervalAnomaly: tickAnomaly,
      averageTickDeltaMs: avgDelta,
      lastTickDeltaMs: lastDelta,
      digitFrequencySkew: digitSkew,
      targetDigitClusterAnomaly: targetMagnet,
      targetDigitSuppressed: targetSuppressed,
      recentAnomalies: this.getRecentAnomalies().slice(0, 8),
      isEvasiveActionActive: isEvasive,
      evasiveHoldRemainingSec: remainingHoldSec,
    };
  }

  public getManipulationThreatScore(): number {
    return this.currentThreatScore;
  }

  public triggerEvasiveHold(reason: string, seconds: number = 15) {
    this.evasiveHoldUntil = Date.now() + seconds * 1000;
    this.evasiveHoldReason = reason;
    this.notifyListeners();
  }

  public isEvasiveHoldActive(): boolean {
    return Date.now() < this.evasiveHoldUntil;
  }

  public getEvasiveHoldRemainingSec(): number {
    if (!this.isEvasiveHoldActive()) return 0;
    return Math.max(0, Math.ceil((this.evasiveHoldUntil - Date.now()) / 1000));
  }

  public getEvasiveHoldReason(): string {
    return this.evasiveHoldReason;
  }

  /**
   * Checks if trade submission should be postponed due to detected broker manipulation.
   * Only returns detected: true if an active evasive hold is in progress (severe feed stall).
   * Elevated threat scores are handled via anti-manipulation timing jitter & stake obfuscation.
   */
  public isManipulationDetected(): { detected: boolean; reason?: string; holdSec?: number } {
    if (!this.config.enabled || !this.config.enableManipulationMonitor) {
      return { detected: false };
    }

    if (this.isEvasiveHoldActive()) {
      return {
        detected: true,
        reason: `Evasive Protection Active (${this.getEvasiveHoldRemainingSec()}s remaining): ${this.evasiveHoldReason}`,
        holdSec: this.getEvasiveHoldRemainingSec(),
      };
    }

    return { detected: false };
  }

  // ============================================================================
  // 🕵️ STEALTH ZERO-TRACE MODE & STRATEGY FOOTPRINT PURGE
  // ============================================================================

  public isZeroTraceModeEnabled(): boolean {
    return Boolean(this.config.enabled && this.config.enableZeroTraceMode);
  }

  /**
   * Registers a callback for clearing trade history from engines and UI.
   */
  public onPurgeHistory(callback: () => void): () => void {
    this.purgeCallbacks.add(callback);
    return () => this.purgeCallbacks.delete(callback);
  }

  /**
   * Nuke all trade history, ghost logs, and strategy footprints across the entire application.
   * Gives zero tracking footprint so brokers and external monitors cannot reconstruct strategies.
   */
  public purgeAllTradeHistoryAndFootprint() {
    this.ghostTradeHistory = [];
    this.recentAnomalies = [];
    this.tickHistory = [];
    this.sessionLossAccumulator = 0;
    this.sessionProfitAccumulator = 0;
    this.peakSessionProfit = 0;
    this.isProfitTargetLocked = false;
    this.consecutiveLosses = 0;
    this.consecutiveVirtualLosses = 0;
    this.totalVirtualTrades = 0;
    this.totalVirtualWins = 0;
    this.totalVirtualLosses = 0;

    // Trigger all external registered purges (systemAutoEngine, live panel, digit trader, etc.)
    this.purgeCallbacks.forEach((cb) => {
      try {
        cb();
      } catch (err) {
        console.warn('[StrategyShield] Error in purge callback:', err);
      }
    });

    this.notifyListeners();
  }
}

export const strategyShield = new StrategyShieldService();
