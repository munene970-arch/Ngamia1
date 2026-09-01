export interface StrategyShieldConfig {
  enabled: boolean;
  // Anti-Fingerprinting / Execution Timing Jitter
  enableJitter: boolean;
  minJitterMs: number;
  maxJitterMs: number;
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
  enableJitter: false,
  minJitterMs: 0,
  maxJitterMs: 0,
  enableLatencyGuard: true,
  maxAllowedPingMs: 1500,
  maxTickAgeMs: 25000,
  enableStakeFuzzing: false,
  fuzzingMaxCents: 0.00,
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
    if (!this.config.enabled || !this.config.enableStakeFuzzing || baseStake <= 0) {
      return { stake: Number(baseStake.toFixed(2)), diff: 0 };
    }
    const maxCents = Math.max(0.01, this.config.fuzzingMaxCents);
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
    return { stake: fuzzed, diff: Number((fuzzed - baseStake).toFixed(2)) };
  }

  /**
   * Latency & Slippage Guard:
   * Rejects trade submission if connection ping is degraded or tick timestamp is stale.
   */
  public checkLatencySafe(currentPingMs: number, tickEpochSec?: number): { safe: boolean; reason?: string } {
    if (!this.config.enabled || !this.config.enableLatencyGuard) {
      return { safe: true };
    }

    if (currentPingMs > this.config.maxAllowedPingMs) {
      return {
        safe: false,
        reason: `High Latency Spike (${currentPingMs}ms > max ${this.config.maxAllowedPingMs}ms). Order blocked to prevent slippage.`,
      };
    }

    if (tickEpochSec && tickEpochSec > 0) {
      const nowEpochSec = Math.floor(Date.now() / 1000);
      const ageMs = (nowEpochSec - tickEpochSec) * 1000;
      if (ageMs > this.config.maxTickAgeMs) {
        return {
          safe: false,
          reason: `Stale Market Tick (${(ageMs / 1000).toFixed(1)}s old > max ${(this.config.maxTickAgeMs / 1000).toFixed(1)}s). Waiting for fresh quote.`,
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
   * Registers Trade Outcome for Circuit Breakers and Streak Protection
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

      // Check Take Profit Lock
      if (
        this.config.enabled &&
        this.config.enableTakeProfitLock &&
        this.sessionProfitAccumulator >= this.config.takeProfitLockAmount
      ) {
        this.circuitBreakerUntil = Date.now() + 3600 * 1000; // 1 hour stealth lock
        this.circuitBreakerReason = `Take Profit Target Reached (+$${this.sessionProfitAccumulator.toFixed(2)}). Session locked to protect profits.`;
        return {
          circuitBreakerTriggered: true,
          consecutiveLosses: 0,
          cooldownSec: 3600,
          reason: this.circuitBreakerReason,
        };
      }

      return { circuitBreakerTriggered: false, consecutiveLosses: 0 };
    }

    // On Loss
    this.consecutiveLosses += 1;
    this.sessionLossAccumulator += Math.abs(profitLoss);

    // Check Daily Drawdown Hard Stop
    if (
      this.config.enabled &&
      this.config.enableDailyLossStop &&
      this.sessionLossAccumulator >= this.config.maxDailyLossAmount
    ) {
      this.circuitBreakerUntil = Date.now() + 86400 * 1000; // 24 hours lock
      this.circuitBreakerReason = `Max Daily Loss Limit Breached (-$${this.sessionLossAccumulator.toFixed(2)}). Live trading locked to preserve capital.`;
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
      return {
        circuitBreakerTriggered: true,
        cooldownSec: cdSec,
        consecutiveLosses: this.consecutiveLosses,
        reason: this.circuitBreakerReason,
      };
    }

    return {
      circuitBreakerTriggered: false,
      consecutiveLosses: this.consecutiveLosses,
    };
  }

  public isCircuitBreakerActive(): boolean {
    return Date.now() < this.circuitBreakerUntil;
  }

  public getRemainingCircuitBreakerSec(): number {
    if (!this.isCircuitBreakerActive()) return 0;
    return Math.max(0, Math.ceil((this.circuitBreakerUntil - Date.now()) / 1000));
  }

  public getCircuitBreakerReason(): string {
    return this.circuitBreakerReason;
  }

  public resetCircuitBreaker() {
    this.circuitBreakerUntil = 0;
    this.circuitBreakerReason = '';
    this.consecutiveLosses = 0;
    this.sessionLossAccumulator = 0;
    this.sessionProfitAccumulator = 0;
  }

  public getConsecutiveLosses(): number {
    return this.consecutiveLosses;
  }
}

export const strategyShield = new StrategyShieldService();
