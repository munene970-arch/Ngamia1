import { getStoredAccounts, DerivOAuthAccount } from '../utils/derivOAuth';
import { derivWS } from './derivWebSocket';
import { MarketSymbol } from '../types/deriv';

export interface RealMirrorLeg {
  contractId: string;
  type: 'HIGHER' | 'LOWER';
  stake: number;
  barrier: string;
  profit: number;
  status: 'OPEN' | 'WON' | 'LOST' | 'ERROR';
}

export interface RealMirrorPairResult {
  runIndex: number;
  timestamp: number;
  realAccountId: string;
  symbol: string;
  higherLeg: RealMirrorLeg;
  lowerLeg: RealMirrorLeg;
  totalStake: number;
  totalPayout: number;
  netProfit: number;
  status: 'OPEN' | 'SETTLED' | 'ERROR';
  errorMessage?: string;
}

export interface RealMirrorStatus {
  isConnected: boolean;
  isConnecting: boolean;
  realAccountId: string | null;
  realBalance: number;
  currency: string;
  error: string | null;
  activeMirrorTrades: number;
  totalCopiedRuns: number;
  totalCopiedNetProfit: number;
}

type RealMirrorListener = (status: RealMirrorStatus) => void;
type RealMirrorTradeListener = (result: RealMirrorPairResult) => void;

class RealAccountMirrorService {
  private ws: WebSocket | null = null;
  private token: string | null = null;
  private appId: string = '1089';
  private realAccountId: string | null = null;
  private realBalance: number = 0;
  private currency: string = 'USD';
  private isConnected: boolean = false;
  private isConnecting: boolean = false;
  private errorMessage: string | null = null;
  private totalCopiedRuns: number = 0;
  private totalCopiedNetProfit: number = 0;

  private listeners = new Set<RealMirrorListener>();
  private tradeListeners = new Set<RealMirrorTradeListener>();
  private activePairs = new Map<string, {
    result: RealMirrorPairResult;
    resolve: (res: RealMirrorPairResult) => void;
  }>();

  constructor() {
    this.loadSavedRealToken();
    this.initAutoConnect();
  }

  private loadSavedRealToken() {
    try {
      const savedToken = localStorage.getItem('mboko_real_mirror_token');
      if (savedToken) {
        this.token = savedToken.trim();
        return;
      }

      // Check stored accounts from Deriv OAuth
      const accounts = getStoredAccounts();
      const realAcc = accounts.find((a) => a.type === 'REAL' && a.token);
      if (realAcc) {
        this.token = realAcc.token.trim();
        this.realAccountId = realAcc.account;
      }
    } catch {
      // Ignore storage errors
    }
  }

  private initAutoConnect() {
    // If primary DerivWebSocket is already connected to a real account, sync credentials
    if (typeof window !== 'undefined') {
      window.setTimeout(() => {
        if (!this.token) {
          const accounts = getStoredAccounts();
          const realAcc = accounts.find((a) => a.type === 'REAL' && a.token);
          if (realAcc) {
            this.setRealToken(realAcc.token, realAcc.account);
          }
        } else if (!this.isConnected && !this.isConnecting) {
          this.connect();
        }
      }, 1000);
    }
  }

  public setRealToken(token: string, accountId?: string) {
    const clean = token.trim().replace(/^bearer\s+/i, '').replace(/[\s'"\r\n\t]/g, '');
    if (!clean) return;

    this.token = clean;
    if (accountId) this.realAccountId = accountId;
    try {
      localStorage.setItem('mboko_real_mirror_token', clean);
      if (accountId) localStorage.setItem('mboko_real_mirror_account', accountId);
    } catch {}

    this.connect();
  }

  public getStatus(): RealMirrorStatus {
    return {
      isConnected: this.isConnected,
      isConnecting: this.isConnecting,
      realAccountId: this.realAccountId,
      realBalance: this.realBalance,
      currency: this.currency,
      error: this.errorMessage,
      activeMirrorTrades: this.activePairs.size,
      totalCopiedRuns: this.totalCopiedRuns,
      totalCopiedNetProfit: this.totalCopiedNetProfit,
    };
  }

  public subscribe(cb: RealMirrorListener): () => void {
    this.listeners.add(cb);
    cb(this.getStatus());
    return () => this.listeners.delete(cb);
  }

  public subscribeTrades(cb: RealMirrorTradeListener): () => void {
    this.tradeListeners.add(cb);
    return () => this.tradeListeners.delete(cb);
  }

  private notify() {
    const status = this.getStatus();
    this.listeners.forEach((cb) => {
      try { cb(status); } catch {}
    });
  }

  private notifyTrade(res: RealMirrorPairResult) {
    this.tradeListeners.forEach((cb) => {
      try { cb(res); } catch {}
    });
  }

  public connect() {
    if (!this.token) {
      this.errorMessage = 'No Real Account API Token found. Connect or enter Real token.';
      this.notify();
      return;
    }

    if (this.ws) {
      try { this.ws.close(); } catch {}
      this.ws = null;
    }

    this.isConnecting = true;
    this.errorMessage = null;
    this.notify();

    const url = `wss://ws.derivws.com/websockets/v3?app_id=${encodeURIComponent(this.appId)}`;
    const ws = new WebSocket(url);
    this.ws = ws;

    ws.onopen = () => {
      if (ws !== this.ws) return;
      console.info('[RealMirrorService] Connected to Deriv WS. Sending authorization...');
      ws.send(JSON.stringify({ authorize: this.token }));
    };

    ws.onmessage = (event) => {
      if (ws !== this.ws) return;
      try {
        const data = JSON.parse(event.data);
        this.handleMessage(data);
      } catch (e) {
        console.error('[RealMirrorService] Error parsing WS message:', e);
      }
    };

    ws.onerror = (err) => {
      if (ws !== this.ws) return;
      console.warn('[RealMirrorService] WebSocket error:', err);
      this.isConnecting = false;
      this.isConnected = false;
      this.errorMessage = 'Connection error on Real mirror link.';
      this.notify();
    };

    ws.onclose = () => {
      if (ws !== this.ws) return;
      this.isConnecting = false;
      this.isConnected = false;
      this.notify();
    };
  }

  private handleMessage(data: any) {
    if (data.msg_type === 'authorize') {
      this.isConnecting = false;
      if (data.error) {
        this.isConnected = false;
        this.errorMessage = data.error.message || 'Authorization failed for Real token.';
        console.error('[RealMirrorService] Auth error:', data.error);
        this.notify();
        return;
      }

      this.isConnected = true;
      this.errorMessage = null;
      this.realAccountId = data.authorize?.loginid || this.realAccountId;
      this.currency = data.authorize?.currency || 'USD';
      const bal = Number(data.authorize?.balance);
      if (Number.isFinite(bal)) this.realBalance = bal;

      console.info(`[RealMirrorService] 🟢 Real Account Authorized: ${this.realAccountId} (${this.currency} ${this.realBalance})`);
      this.notify();

      // Subscribe to live balance
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ balance: 1, subscribe: 1 }));
      }
    } else if (data.msg_type === 'balance') {
      const bal = Number(data.balance?.balance);
      if (Number.isFinite(bal)) {
        this.realBalance = bal;
        this.notify();
      }
    } else if (data.msg_type === 'proposal_open_contract') {
      this.handleContractUpdate(data.proposal_open_contract);
    }
  }

  /**
   * Mirrors a Dual Hedge Pair (Higher + Lower) to the Real Account simultaneously
   */
  public async mirrorPair(params: {
    symbol: string;
    higherBarrier: string;
    lowerBarrier: string;
    stake: number;
    durationTicks: number;
    runIndex: number;
  }): Promise<RealMirrorPairResult> {
    const pairKey = `REAL_PAIR_${params.runIndex}_${Date.now()}`;
    const initialResult: RealMirrorPairResult = {
      runIndex: params.runIndex,
      timestamp: Date.now(),
      realAccountId: this.realAccountId || 'Real',
      symbol: params.symbol,
      higherLeg: {
        contractId: '',
        type: 'HIGHER',
        stake: params.stake,
        barrier: params.higherBarrier,
        profit: 0,
        status: 'OPEN',
      },
      lowerLeg: {
        contractId: '',
        type: 'LOWER',
        stake: params.stake,
        barrier: params.lowerBarrier,
        profit: 0,
        status: 'OPEN',
      },
      totalStake: params.stake * 2,
      totalPayout: 0,
      netProfit: 0,
      status: 'OPEN',
    };

    // If main WebSocket is ALREADY authorized to a Real live account, we can place the live order via main derivWS
    if (derivWS.getIsAuthorized() && !derivWS.getCachedIsVirtual()) {
      console.info(`[RealMirrorService] ⚡ Executing live mirror trade directly on primary Real WS (${derivWS.getCachedLoginId()})...`);
      try {
        const higher = derivWS.purchaseContract({
          symbol: params.symbol as MarketSymbol,
          symbolName: `Vol ${params.symbol.replace('R_', '')}`,
          contractType: 'HIGHER',
          stake: params.stake,
          durationTicks: params.durationTicks,
          barrier: params.higherBarrier,
          forceVirtual: false,
        });

        const lower = derivWS.purchaseContract({
          symbol: params.symbol as MarketSymbol,
          symbolName: `Vol ${params.symbol.replace('R_', '')}`,
          contractType: 'LOWER',
          stake: params.stake,
          durationTicks: params.durationTicks,
          barrier: params.lowerBarrier,
          forceVirtual: false,
        });

        initialResult.higherLeg.contractId = higher.id;
        initialResult.lowerLeg.contractId = lower.id;
        initialResult.realAccountId = derivWS.getCachedLoginId() || 'Real';
        this.totalCopiedRuns += 1;
        this.notifyTrade(initialResult);
        this.notify();
        return initialResult;
      } catch (err: any) {
        console.error('[RealMirrorService] Failed to place live trade via primary WS:', err);
        initialResult.status = 'ERROR';
        initialResult.errorMessage = err?.message || 'Trade submission failed';
        return initialResult;
      }
    }

    // Otherwise, execute on dedicated Real Mirror WebSocket link
    if (!this.isConnected || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
      initialResult.status = 'ERROR';
      initialResult.errorMessage = 'Real Account Mirror is not connected. Enter Real API token in settings.';
      this.notifyTrade(initialResult);
      return initialResult;
    }

    return new Promise((resolve) => {
      this.activePairs.set(pairKey, { result: initialResult, resolve });

      try {
        // Buy Leg 1: HIGHER
        this.buyMirrorLeg(params.symbol, 'HIGHER', params.higherBarrier, params.stake, params.durationTicks, pairKey);
        // Buy Leg 2: LOWER
        this.buyMirrorLeg(params.symbol, 'LOWER', params.lowerBarrier, params.stake, params.durationTicks, pairKey);
      } catch (e: any) {
        initialResult.status = 'ERROR';
        initialResult.errorMessage = e?.message || 'Error submitting order';
        this.activePairs.delete(pairKey);
        resolve(initialResult);
      }
    });
  }

  private buyMirrorLeg(
    symbol: string,
    contractType: 'HIGHER' | 'LOWER',
    barrier: string,
    stake: number,
    duration: number,
    pairKey: string
  ) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    const req = {
      buy: 1,
      price: stake,
      parameters: {
        amount: stake,
        basis: 'stake',
        contract_type: contractType,
        currency: this.currency || 'USD',
        duration: Math.max(1, duration),
        duration_unit: 't',
        symbol,
        barrier,
      },
      passthrough: {
        pairKey,
        contractType,
      },
    };

    console.info(`[RealMirrorService] 🛒 Submitting Real Buy: ${contractType} (${barrier}) stake: $${stake}`);
    this.ws.send(JSON.stringify(req));
  }

  private handleContractUpdate(poc: any) {
    if (!poc) return;
    const contractId = String(poc.contract_id || poc.id || '');
    const isEnded = Boolean(poc.is_sold || poc.is_expired || poc.is_settled);

    for (const [pairKey, item] of this.activePairs.entries()) {
      const res = item.result;
      const profit = Number(poc.profit ?? (Number(poc.payout || 0) - Number(poc.buy_price || 0)));

      if (res.higherLeg.contractId === contractId) {
        if (isEnded) {
          res.higherLeg.profit = profit;
          res.higherLeg.status = profit > 0 ? 'WON' : 'LOST';
        }
      } else if (res.lowerLeg.contractId === contractId) {
        if (isEnded) {
          res.lowerLeg.profit = profit;
          res.lowerLeg.status = profit > 0 ? 'WON' : 'LOST';
        }
      }

      // Check if both settled
      const bothDone =
        ['WON', 'LOST', 'ERROR'].includes(res.higherLeg.status) &&
        ['WON', 'LOST', 'ERROR'].includes(res.lowerLeg.status);

      if (bothDone && res.status === 'OPEN') {
        res.status = 'SETTLED';
        res.netProfit = Number((res.higherLeg.profit + res.lowerLeg.profit).toFixed(2));
        res.totalPayout = (res.higherLeg.profit > 0 ? res.higherLeg.stake + res.higherLeg.profit : 0) +
                          (res.lowerLeg.profit > 0 ? res.lowerLeg.stake + res.lowerLeg.profit : 0);

        this.totalCopiedRuns += 1;
        this.totalCopiedNetProfit = Number((this.totalCopiedNetProfit + res.netProfit).toFixed(2));
        this.activePairs.delete(pairKey);
        item.resolve(res);
        this.notifyTrade(res);
        this.notify();
      }
    }
  }
}

export const realAccountMirrorService = new RealAccountMirrorService();
