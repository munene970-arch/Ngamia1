import { MarketSymbol, Tick, ActiveContract } from '../types/deriv';
import { REGISTERED_DERIV_APP_ID } from '../config/deriv';
import { clearDerivPatCredentials, fetchDerivPatOtpUrl, DerivPatAccount } from './derivPatConnection';
import { strategyShield } from './strategyShield';

export type TickListener = (tick: Tick) => void;
export type ContractListener = (contract: ActiveContract) => void;

export interface AuthStatus {
  isAuthorized: boolean;
  loginid?: string;
  email?: string;
  balance?: number;
  currency?: string;
  isVirtual?: boolean;
  scopes?: string[];
  error?: string | null;
  appId?: string;
  activeEndpoint?: string;
  pingMs?: number;
}

export type AuthListener = (status: AuthStatus) => void;
type PendingTrade = { contract: ActiveContract; currency: string };
type ClientContract = ActiveContract & { liveContractId?: string };

export const DERIV_MARKET_PIP_SIZES: Record<string, number> = {
  'R_10': 3,
  'R_25': 3,
  'R_50': 4,
  'R_75': 4,
  'R_100': 2,
  '1HZ10V': 2,
  '1HZ25V': 2,
  '1HZ50V': 4,
  '1HZ75V': 4,
  '1HZ100V': 2,
  '1HZ150V': 2,
  '1HZ250V': 2,
  'CRASH1000': 2,
  'CRASH500': 2,
  'CRASH300': 2,
  'BOOM1000': 2,
  'BOOM500': 2,
  'BOOM300': 2,
  'STEPINDEX': 2,
  'JUMP10': 2,
  'JUMP25': 2,
  'JUMP50': 2,
  'JUMP75': 2,
  'JUMP100': 2,
  'RDBEAR': 2,
  'RDBULL': 2,
};

export function getMarketPipSize(symbol?: string): number {
  if (!symbol) return 2;
  return DERIV_MARKET_PIP_SIZES[symbol] ?? 2;
}

/**
 * Rough UI-only payout estimate for Higher/Lower barrier planning.
 * Actual payout is determined by Deriv's live proposal and is never guaranteed
 * by this estimate. This helper does not alter purchase or execution logic.
 */
export function calculateDerivPayoutMultiplier(symbol: string, barrierOffset: number): number {
  const referenceOffsets: Record<string, number> = {
    R_10: 1.10, R_25: 1.80, R_50: 0.85, R_75: 22.50, R_100: 0.45,
    '1HZ10V': 0.85, '1HZ15V': 1.00, '1HZ25V': 1.50, '1HZ30V': 1.80,
    '1HZ50V': 0.80, '1HZ75V': 20.00, '1HZ90V': 22.00, '1HZ100V': 0.45,
  };
  const offset = Math.abs(Number(barrierOffset));
  const reference = referenceOffsets[symbol];
  if (!Number.isFinite(offset) || offset <= 0 || !reference) return 1;
  // Planning estimate only: scale from the app's configured reference barrier.
  return Math.max(1, Number((11 * Math.pow(offset / reference, 1.2)).toFixed(2)));
}

export function extractDerivLastDigit(quote: number | string, pipSize?: number, symbol?: string): number {
  if (typeof quote === 'string') {
    const clean = quote.trim();
    if (clean.length > 0) {
      const lastChar = clean.slice(-1);
      const parsed = parseInt(lastChar, 10);
      if (!isNaN(parsed) && parsed >= 0 && parsed <= 9) return parsed;
    }
  }
  const numeric = typeof quote === 'number' ? quote : parseFloat(String(quote));
  if (!Number.isFinite(numeric)) return 0;
  const decimals = Number.isInteger(pipSize) && pipSize !== undefined && pipSize >= 0 && pipSize <= 8
    ? pipSize
    : getMarketPipSize(symbol);
  const formatted = numeric.toFixed(decimals);
  const lastChar = formatted.slice(-1);
  const parsed = parseInt(lastChar, 10);
  if (!isNaN(parsed) && parsed >= 0 && parsed <= 9) return parsed;
  return 0;
}

export function formatDerivQuote(quote: number | string, pipSize?: number, symbol?: string): string {
  if (typeof quote === 'string' && quote.trim().length > 0) return quote.trim();
  const numeric = typeof quote === 'number' ? quote : parseFloat(String(quote));
  if (!Number.isFinite(numeric)) return '--';
  const decimals = Number.isInteger(pipSize) && pipSize !== undefined && pipSize >= 0 && pipSize <= 8
    ? pipSize
    : getMarketPipSize(symbol);
  return numeric.toFixed(decimals);
}

export type HistoryData = {
  symbol: MarketSymbol;
  prices: number[];
  times: number[];
  pipSize: number;
};
export type HistoryListener = (data: HistoryData) => void;

class DerivWebSocketService {
  private ws: WebSocket | null = null;
  private appId = REGISTERED_DERIV_APP_ID;
  private token: string | null = null;
  private isPatOtpConnection = false;
  private patAccountId: string | null = null;
  private patAccountIsVirtual = false;
  private currency = 'USD';
  private isConnected = false;
  private isAuthorized = false;
  private intentionallyClosed = false;
  private reconnectTimer: number | null = null;
  private reconnectAttempts = 0;
  private connectGeneration = 0;

  private tickListeners = new Map<MarketSymbol, Set<TickListener>>();
  private historyListeners = new Map<MarketSymbol, Set<HistoryListener>>();
  private activeSubscriptions = new Set<MarketSymbol>();
  private currentPrices = new Map<MarketSymbol, number>();
  private marketPipSizes = new Map<MarketSymbol, number>();
  private lastTicks = new Map<MarketSymbol, Tick>();
  private activeContracts = new Map<string, ActiveContract>();
  private pendingTrades = new Map<string, PendingTrade>();
  private simulatedContracts = new Map<string, ActiveContract & { pipSize?: number }>();
  private liveToClientContract = new Map<string, string>();
  private settlementPollTimers = new Map<string, number>();
  private settledContracts = new Set<string>();
  private contractListeners = new Set<ContractListener>();
  private authListeners = new Set<AuthListener>();
  private testModeListeners = new Set<(isTest: boolean) => void>();
  private isTestMode: boolean = false;
  private cachedEmail?: string;
  private cachedLoginId?: string;
  private cachedIsVirtual = false;
  private cachedBalance: number = 0;
  private activeEndpointUrl = 'Deriv Public WebSocket';
  private pingInterval: number | null = null;
  private lastPingSentTime: number = 0;
  private currentPingMs: number = 28;

  constructor() {
    if (typeof window !== 'undefined') {
      const savedTestMode = localStorage.getItem('deriv_strategy_test_mode');
      if (savedTestMode !== null) {
        this.isTestMode = savedTestMode === 'true';
      }
      window.setTimeout(() => {
        if (!this.ws && !this.intentionallyClosed) {
          this.connect(this.appId, undefined);
        }
      }, 200);
    }
  }

  public subscribeAuth(callback: AuthListener) { this.authListeners.add(callback); }
  public unsubscribeAuth(callback: AuthListener) { this.authListeners.delete(callback); }
  public subscribeContracts(callback: ContractListener) { this.contractListeners.add(callback); }
  public unsubscribeContracts(callback: ContractListener) { this.contractListeners.delete(callback); }
  public subscribeTestMode(callback: (isTest: boolean) => void) { this.testModeListeners.add(callback); }
  public unsubscribeTestMode(callback: (isTest: boolean) => void) { this.testModeListeners.delete(callback); }
  public subscribeHistory(symbol: MarketSymbol, callback: HistoryListener) {
    let listeners = this.historyListeners.get(symbol);
    if (!listeners) {
      listeners = new Set<HistoryListener>();
      this.historyListeners.set(symbol, listeners);
    }
    listeners.add(callback);
  }
  public unsubscribeHistory(symbol: MarketSymbol, callback: HistoryListener) {
    const listeners = this.historyListeners.get(symbol);
    if (!listeners) return;
    listeners.delete(callback);
    if (listeners.size === 0) {
      this.historyListeners.delete(symbol);
    }
  }
  public setTestMode(enabled: boolean) {
    this.isTestMode = Boolean(enabled);
    if (typeof window !== 'undefined') {
      localStorage.setItem('deriv_strategy_test_mode', enabled ? 'true' : 'false');
    }
    this.testModeListeners.forEach((cb) => {
      try { cb(this.isTestMode); } catch (_) {}
    });
  }
  public getIsTestMode(): boolean { return this.isTestMode; }
  private notifyAuth(status: AuthStatus) { this.authListeners.forEach((callback) => callback(status)); }
  private notifyContract(contract: ActiveContract) { this.contractListeners.forEach((callback) => callback({ ...contract, historySpots: [...contract.historySpots] })); }

  public sanitizeToken(rawToken?: string | null): string | null {
    if (!rawToken) return null;
    const clean = rawToken.trim().replace(/^bearer\s+/i, '').replace(/[\s'"\r\n\t]/g, '');
    return clean || null;
  }

  public connect(appId: string = REGISTERED_DERIV_APP_ID, rawToken?: string) {
    this.appId = appId?.trim() || REGISTERED_DERIV_APP_ID;
    clearDerivPatCredentials();
    this.isPatOtpConnection = false;
    this.patAccountId = null;
    this.token = this.sanitizeToken(rawToken);
    this.intentionallyClosed = false;
    this.isAuthorized = false;
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.connectGeneration += 1;
    if (this.reconnectTimer !== null) { window.clearTimeout(this.reconnectTimer); this.reconnectTimer = null; }
    this.closeSocket(false);
    this.openSocket(this.connectGeneration);
  }

  public connectWithPatAccount(account: DerivPatAccount, appId?: string) {
    this.appId = appId?.trim() || this.appId;
    this.token = null;
    this.isPatOtpConnection = true;
    this.patAccountId = account.account_id;
    this.patAccountIsVirtual = Boolean(account.is_virtual);
    this.cachedLoginId = account.loginid || account.account_id;
    this.currency = account.currency || 'USD';
    this.cachedBalance = Number(account.balance) || 0;
    this.intentionallyClosed = false;
    this.isAuthorized = false;
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.connectGeneration += 1;
    if (this.reconnectTimer !== null) { window.clearTimeout(this.reconnectTimer); this.reconnectTimer = null; }
    this.closeSocket(false);
    this.openSocket(this.connectGeneration);
  }

  public disconnect() {
    this.intentionallyClosed = true;
    this.token = null;
    this.isPatOtpConnection = false;
    this.patAccountId = null;
    clearDerivPatCredentials();
    this.isAuthorized = false;
    this.isConnected = false;
    this.connectGeneration += 1;
    if (this.reconnectTimer !== null) { window.clearTimeout(this.reconnectTimer); this.reconnectTimer = null; }
    if (this.pingInterval !== null) { window.clearInterval(this.pingInterval); this.pingInterval = null; }
    this.settlementPollTimers.forEach((timer) => window.clearTimeout(timer));
    this.settlementPollTimers.clear();
    this.closeSocket(false);
    this.notifyAuth({ isAuthorized: false, appId: this.appId, activeEndpoint: this.activeEndpointUrl, pingMs: this.currentPingMs, error: null });
  }

  private closeSocket(clearHandlers = true) {
    if (this.pingInterval !== null) { window.clearInterval(this.pingInterval); this.pingInterval = null; }
    if (!this.ws) return;
    if (clearHandlers) { this.ws.onopen = null; this.ws.onclose = null; this.ws.onerror = null; this.ws.onmessage = null; }
    try { this.ws.close(); } catch (_) {}
    this.ws = null;
  }

  private async getAuthenticatedWebSocketUrl(generation: number): Promise<{ url: string; accountId?: string }> {
    if (this.isPatOtpConnection) {
      if (!this.patAccountId) throw new Error('Select a Deriv account before connecting.');
      const url = await fetchDerivPatOtpUrl(this.patAccountId);
      if (generation !== this.connectGeneration || this.intentionallyClosed) throw new Error('Connection attempt was cancelled.');
      return { url, accountId: this.patAccountId };
    }
    if (!this.token) {
      // Public Deriv WebSocket for tick streaming in demo/free mode
      return { url: `wss://ws.derivws.com/websockets/v3?app_id=${encodeURIComponent(this.appId || '1089')}` };
    }
    const response = await fetch('/.netlify/functions/deriv-otp', { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify({ appId: this.appId, token: this.token, accountId: this.cachedLoginId || undefined }), cache: 'no-store' });
    const body = await response.text();
    let data: any;
    try { data = JSON.parse(body); } catch { throw new Error(body || `OTP request failed (${response.status})`); }
    if (!response.ok || !data?.url) throw new Error(data?.error || `OTP request failed (${response.status})`);
    if (generation !== this.connectGeneration || this.intentionallyClosed) throw new Error('Connection attempt was cancelled.');
    return { url: String(data.url), accountId: data.accountId ? String(data.accountId) : undefined };
  }

  private openSocket(generation: number) {
    if (generation !== this.connectGeneration || this.intentionallyClosed) return;
    this.getAuthenticatedWebSocketUrl(generation).then(({ url, accountId }) => {
      if (generation !== this.connectGeneration || this.intentionallyClosed) return;
      this.activeEndpointUrl = this.isPatOtpConnection ? 'Deriv authenticated OTP WebSocket' : url;
      if (accountId) this.cachedLoginId = accountId;
      const ws = new WebSocket(url);
      this.ws = ws;
      ws.onopen = () => {
        if (generation !== this.connectGeneration || ws !== this.ws) { try { ws.close(); } catch (_) {} return; }
        this.isConnected = true;
        this.reconnectAttempts = 0;

        if (this.isPatOtpConnection) {
          // OTP WebSocket URLs are already authenticated. Never send a second authorize request.
          try {
            ws.send(JSON.stringify({ balance: 1 }));
            ws.send(JSON.stringify({ get_settings: 1 }));
          } catch (err) {
            console.error('[Deriv WS] Could not request PAT account details:', err);
          }
        } else if (this.token) {
          try {
            console.info('[Deriv WS] Sending authorize handshake for token...');
            ws.send(JSON.stringify({ authorize: this.token }));
          } catch (err) {
            console.error('[Deriv WS] Error sending authorize:', err);
          }
        } else {
          this.isAuthorized = false;
          this.notifyAuth({
            isAuthorized: false,
            loginid: undefined,
            email: undefined,
            balance: this.cachedBalance || 10000,
            currency: this.currency,
            isVirtual: true,
            appId: this.appId,
            activeEndpoint: this.activeEndpointUrl,
            pingMs: this.currentPingMs,
            error: null,
          });
        }

        this.activeSubscriptions.forEach((symbol) => this.sendTickSubscription(symbol));

        // Start ping loop for real-time latency & slippage protection
        if (this.pingInterval !== null) window.clearInterval(this.pingInterval);
        this.pingInterval = window.setInterval(() => {
          if (this.ws?.readyState === WebSocket.OPEN) {
            this.lastPingSentTime = Date.now();
            try { this.ws.send(JSON.stringify({ ping: 1 })); } catch (_) {}
          }
        }, 4000);
      };
      ws.onmessage = (event) => { if (generation !== this.connectGeneration || ws !== this.ws) return; try { this.handleMessage(JSON.parse(event.data)); } catch (error) { console.error('[Deriv WS] Invalid JSON message:', error); } };
      ws.onerror = () => { if (generation !== this.connectGeneration || ws !== this.ws) return; this.isConnected = false; this.isAuthorized = false; this.notifyAuth({ isAuthorized: false, appId: this.appId, activeEndpoint: this.activeEndpointUrl, error: 'Deriv WebSocket connection error.' }); };
      ws.onclose = (event) => { if (generation !== this.connectGeneration || ws !== this.ws) return; this.ws = null; this.isConnected = false; this.isAuthorized = false; const error = `Deriv WebSocket connection closed. Code: ${event.code} Reason: ${event.reason || 'none'}`; console.warn('[Deriv WS]', error); if (!this.intentionallyClosed) { this.notifyAuth({ isAuthorized: false, appId: this.appId, activeEndpoint: this.activeEndpointUrl, error }); this.scheduleReconnect(generation); } };
    }).catch((error) => { if (generation !== this.connectGeneration || this.intentionallyClosed) return; this.isConnected = false; this.isAuthorized = false; const message = error instanceof Error ? error.message : String(error); console.error('[Deriv WS] Failed to open WebSocket:', message); this.notifyAuth({ isAuthorized: false, appId: this.appId, activeEndpoint: this.activeEndpointUrl, error: message }); if (!this.isPatOtpConnection) this.scheduleReconnect(generation); });
  }

  private scheduleReconnect(generation: number) { if (this.reconnectTimer !== null || generation !== this.connectGeneration) return; const delay = Math.min(30000, 1000 * Math.pow(2, this.reconnectAttempts)); this.reconnectAttempts += 1; this.reconnectTimer = window.setTimeout(() => { this.reconnectTimer = null; this.openSocket(generation); }, delay); }
  public getIsLiveWs(): boolean { return !this.isTestMode && this.isConnected && this.isAuthorized; }
  public getIsLiveFeed(): boolean { return this.isConnected; }
  public getActiveEndpoint(): string { return this.activeEndpointUrl; }
  public getLastTick(symbol: MarketSymbol): Tick | undefined { return this.lastTicks.get(symbol); }
  public getCurrentPrice(symbol: MarketSymbol): number { return this.currentPrices.get(symbol) || 0; }
  public getPingMs(): number { return this.currentPingMs; }
  public getCachedBalance(): number { return this.cachedBalance; }
  public getTickAgeMs(symbol: MarketSymbol): number {
    const tick = this.lastTicks.get(symbol);
    if (!tick || !tick.epoch) return 0;
    return Math.max(0, Date.now() - tick.epoch * 1000);
  }

  private handleMessage(data: any) {
    if (data.error) { this.handleApiError(data); return; }
    switch (data.msg_type) {
      case 'authorize': this.handleAuthorize(data.authorize); break;
      case 'balance': this.handleBalance(data.balance); break;
      case 'get_settings': this.handleSettings(data.get_settings); break;
      case 'tick': this.handleTick(data.tick); break;
      case 'history': this.handleHistory(data); break;
      case 'proposal': this.handleProposal(data); break;
      case 'buy': this.handleBuy(data); break;
      case 'proposal_open_contract': this.handleContractUpdate(data.proposal_open_contract); break;
      case 'ping':
        if (this.lastPingSentTime > 0) {
          this.currentPingMs = Math.max(1, Date.now() - this.lastPingSentTime);
          this.notifyAuth({
            isAuthorized: this.isAuthorized,
            loginid: this.cachedLoginId,
            email: this.cachedEmail,
            currency: this.currency,
            isVirtual: this.cachedIsVirtual,
            appId: this.appId,
            activeEndpoint: this.activeEndpointUrl,
            pingMs: this.currentPingMs,
            error: null,
          });
        }
        break;
      default: break;
    }
  }

  private handleHistory(data: any) {
    if (!data?.history?.prices) return;
    const symbol = (data.echo_req?.ticks_history || data.echo_req?.ticks) as MarketSymbol;
    if (!symbol) return;
    const prices: number[] = data.history.prices || [];
    const times: number[] = data.history.times || [];
    const pipSize = Number.isInteger(data.pip_size) ? Number(data.pip_size) : getMarketPipSize(symbol);
    this.marketPipSizes.set(symbol, pipSize);

    if (prices.length > 0) {
      const lastPrice = prices[prices.length - 1];
      this.currentPrices.set(symbol, lastPrice);
      const lastTime = times.length > 0 ? times[times.length - 1] : Math.floor(Date.now() / 1000);
      const previousPrice = prices.length > 1 ? prices[prices.length - 2] : lastPrice;
      const tick: Tick = {
        epoch: lastTime,
        quote: lastPrice,
        symbol,
        pipSize,
        change: lastPrice - previousPrice,
      };
      this.lastTicks.set(symbol, tick);
    }

    const payload: HistoryData = { symbol, prices, times, pipSize };
    this.historyListeners.get(symbol)?.forEach((cb) => {
      try { cb(payload); } catch (e) { console.error('[Deriv WS] Error in history listener:', e); }
    });
  }

  private handleAuthorize(auth: any) {
    if (!auth) return;
    this.isAuthorized = true;
    this.cachedLoginId = auth.loginid || this.cachedLoginId;
    this.cachedEmail = auth.email || this.cachedEmail;
    this.currency = auth.currency || this.currency || 'USD';
    this.cachedIsVirtual = Boolean(auth.is_virtual);
    const balanceNum = Number(auth.balance);
    if (Number.isFinite(balanceNum)) {
      this.cachedBalance = balanceNum;
    }
    const scopes = Array.isArray(auth.scopes)
      ? auth.scopes
      : auth.scopes && typeof auth.scopes === 'object'
      ? Object.keys(auth.scopes)
      : [];

    console.info(`[Deriv WS] Authorized successfully as ${this.cachedLoginId} (${this.cachedIsVirtual ? 'DEMO/VIRTUAL' : 'REAL'}). Balance: ${this.currency} ${this.cachedBalance}`);

    this.notifyAuth({
      isAuthorized: true,
      loginid: this.cachedLoginId,
      email: this.cachedEmail,
      balance: this.cachedBalance,
      currency: this.currency,
      isVirtual: this.cachedIsVirtual,
      scopes,
      appId: this.appId,
      activeEndpoint: this.activeEndpointUrl,
      pingMs: this.currentPingMs,
      error: null,
    });

    // Subscribe to live balance stream and account settings
    if (this.ws?.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify({ balance: 1, subscribe: 1 }));
        this.ws.send(JSON.stringify({ get_settings: 1 }));
      } catch (err) {
        console.warn('[Deriv WS] Error sending balance subscription:', err);
      }
    }
  }
  private handleBalance(balance: any) {
    if (!balance) return;
    const value = Number(balance.balance);
    if (!Number.isFinite(value)) return;
    this.currency = balance.currency || this.currency;
    this.cachedLoginId = balance.loginid || balance.account || this.cachedLoginId;
    this.cachedBalance = value;
    if (this.isPatOtpConnection && this.cachedLoginId) {
      const wasAuthorized = this.isAuthorized;
      this.isAuthorized = true;
      this.cachedIsVirtual = this.patAccountIsVirtual;
      this.notifyAuth({ isAuthorized: true, loginid: this.cachedLoginId, email: this.cachedEmail, balance: value, currency: this.currency, isVirtual: this.cachedIsVirtual, appId: this.appId, activeEndpoint: this.activeEndpointUrl, error: null });
      if (!wasAuthorized && this.ws?.readyState === WebSocket.OPEN) {
        try {
          this.ws.send(JSON.stringify({ balance: 1, subscribe: 1 }));
          this.ws.send(JSON.stringify({ get_settings: 1 }));
        } catch (error) { console.warn('[Deriv WS] Could not subscribe to PAT account updates:', error); }
      }
      return;
    }
    this.notifyAuth({ isAuthorized: this.isAuthorized, loginid: this.cachedLoginId, email: this.cachedEmail, balance: value, currency: this.currency, isVirtual: this.cachedIsVirtual, appId: this.appId, activeEndpoint: this.activeEndpointUrl, error: this.isAuthorized ? null : 'Account is not authorized.' });
  }
  private handleSettings(settings: any) { if (!settings) return; if (settings.email) this.cachedEmail = settings.email; if (this.isAuthorized) this.notifyAuth({ isAuthorized: true, loginid: this.cachedLoginId, email: this.cachedEmail, currency: this.currency, isVirtual: this.cachedIsVirtual, appId: this.appId, activeEndpoint: this.activeEndpointUrl, error: null }); }

  private cancelPendingTrade(clientId: string, reason: string) {
    const pending = this.pendingTrades.get(clientId);
    if (!pending) return;
    this.pendingTrades.delete(clientId);
    pending.contract.status = 'CANCELLED';
    pending.contract.isWin = false;
    pending.contract.currentProfit = 0;
    pending.contract.remainingTicks = 0;
    this.activeContracts.delete(clientId);
    this.notifyContract(pending.contract);
    console.warn('[Deriv WS] Trade cancelled before execution:', reason);
    this.refreshBalance();
  }

  private handleApiError(data: any) {
    const message = data.error?.message || 'Deriv API request failed.';
    const code = data.error?.code || 'API_ERROR';
    console.warn(`[Deriv WS] ${code}: ${message}`, data.error);
    const clientId = data.echo_req?.passthrough?.client_contract_id;
    const isDirectBuy = data.echo_req?.passthrough?.is_direct_buy;
    const fallback = data.echo_req?.passthrough?.fallback_params;

    if (isDirectBuy && fallback && clientId && this.pendingTrades.has(clientId) && this.ws?.readyState === WebSocket.OPEN) {
      console.warn(`[Deriv WS] Direct buy returned ${code}, attempting instant proposal fallback...`);
      const req: Record<string, any> = {
        proposal: 1,
        amount: fallback.amount,
        basis: 'stake',
        contract_type: fallback.contract_type,
        currency: this.currency,
        duration: fallback.duration,
        duration_unit: fallback.duration_unit,
        underlying_symbol: fallback.underlying_symbol,
        passthrough: { client_contract_id: clientId },
      };
      if (fallback.barrier !== undefined) req.barrier = String(fallback.barrier);
      try {
        this.ws.send(JSON.stringify(req));
        return;
      } catch (_) {}
    }

    if (clientId && this.pendingTrades.has(clientId)) this.cancelPendingTrade(String(clientId), `${code}: ${message}`);
    const contractId = data.echo_req?.contract_id;
    if (contractId) this.clearSettlementPolling(String(contractId));
    if (this.isAuthorized || this.isPatOtpConnection) {
      this.notifyAuth({ isAuthorized: this.isAuthorized, loginid: this.cachedLoginId, email: this.cachedEmail, currency: this.currency, isVirtual: this.cachedIsVirtual, appId: this.appId, activeEndpoint: this.activeEndpointUrl, error: `${code}: ${message}` });
    }
  }

  public refreshBalance() {
    if (this.ws?.readyState !== WebSocket.OPEN || !this.isAuthorized) return;
    try { this.ws.send(JSON.stringify({ balance: 1 })); } catch (error) { console.warn('[Deriv WS] Balance refresh failed:', error); }
  }

  private handleTick(tickData: any) {
    if (!tickData?.symbol) return;
    const symbol = tickData.symbol as MarketSymbol;
    const quote = Number(tickData.quote);
    if (!Number.isFinite(quote)) return;
    const previous = this.currentPrices.get(symbol) ?? quote;
    const pipSize = Number.isInteger(tickData.pip_size) ? Number(tickData.pip_size) : getMarketPipSize(symbol);
    this.marketPipSizes.set(symbol, pipSize);

    const tick: Tick = {
      epoch: Number(tickData.epoch) || Math.floor(Date.now() / 1000),
      quote,
      symbol,
      id: tickData.id ? String(tickData.id) : undefined,
      change: quote - previous,
      pipSize,
    };
    this.currentPrices.set(symbol, quote);
    this.lastTicks.set(symbol, tick);

    // Process simulated demo contracts on real market ticks FIRST
    const now = Date.now();
    this.simulatedContracts.forEach((contract, clientId) => {
      if (contract.symbol !== symbol || contract.status !== 'OPEN') return;
      contract.currentSpot = quote;
      contract.historySpots.push(quote);
      if (contract.historySpots.length > 50) contract.historySpots.shift();

      const isTimeBased = contract.durationUnit === 'm' || contract.durationUnit === 's';
      let isExpired = false;

      if (isTimeBased) {
        if (contract.expiryTime && now >= contract.expiryTime) {
          isExpired = true;
        }
      } else {
        contract.remainingTicks = Math.max(0, contract.remainingTicks - 1);
        if (contract.remainingTicks <= 0) {
          isExpired = true;
        }
      }

      if (isExpired) {
        // Contract has completed
        const exitDigit = extractDerivLastDigit(quote, pipSize, contract.symbol);
        contract.exitSpot = quote;
        contract.exitSpotDisplay = formatDerivQuote(quote, pipSize, contract.symbol);
        contract.exitDigit = exitDigit;
        contract.pipSize = pipSize;
        let isWin = false;
        let profit = -contract.stake;

        if (contract.contractType === 'DIGITDIFF') {
          const target = contract.targetDigit ?? 0;
          isWin = exitDigit !== target;
          profit = isWin ? Number((contract.stake * 0.095).toFixed(2)) : -contract.stake;
        } else if (contract.contractType === 'DIGITMATCH') {
          const target = contract.targetDigit ?? 0;
          isWin = exitDigit === target;
          profit = isWin ? Number((contract.stake * 7.85).toFixed(2)) : -contract.stake;
        } else if (contract.contractType === 'CALL' || contract.contractType === 'HIGHER') {
          isWin = quote > contract.entrySpot;
          profit = isWin ? Number((contract.stake * 0.95).toFixed(2)) : -contract.stake;
        } else if (contract.contractType === 'PUT' || contract.contractType === 'LOWER') {
          isWin = quote < contract.entrySpot;
          profit = isWin ? Number((contract.stake * 0.95).toFixed(2)) : -contract.stake;
        } else if (contract.contractType === 'DIGITEVEN') {
          isWin = exitDigit % 2 === 0;
          profit = isWin ? Number((contract.stake * 0.95).toFixed(2)) : -contract.stake;
        } else if (contract.contractType === 'DIGITODD') {
          isWin = exitDigit % 2 !== 0;
          profit = isWin ? Number((contract.stake * 0.95).toFixed(2)) : -contract.stake;
        } else if (contract.contractType === 'DIGITOVER') {
          isWin = exitDigit > (contract.targetDigit ?? 5);
          profit = isWin ? Number((contract.stake * 0.95).toFixed(2)) : -contract.stake;
        } else if (contract.contractType === 'DIGITUNDER') {
          isWin = exitDigit < (contract.targetDigit ?? 5);
          profit = isWin ? Number((contract.stake * 0.95).toFixed(2)) : -contract.stake;
        } else {
          isWin = quote >= contract.entrySpot;
          profit = isWin ? Number((contract.stake * 0.95).toFixed(2)) : -contract.stake;
        }

        contract.status = isWin ? 'WON' : 'LOST';
        contract.isWin = isWin;
        contract.currentProfit = profit;
        contract.remainingTicks = 0;
        strategyShield.registerTradeOutcome(isWin, profit);
        this.simulatedContracts.delete(clientId);
        this.activeContracts.set(clientId, contract);
        this.notifyContract(contract);
      } else {
        this.notifyContract(contract);
      }
    });

    // Notify tick listeners so new pattern evaluations / purchases run after current contracts tick
    this.tickListeners.get(symbol)?.forEach((callback) => callback(tick));
  }

  public requestTicksHistory(symbol: MarketSymbol, count: number = 500) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify({
          ticks_history: symbol,
          end: 'latest',
          count: Math.max(10, Math.min(1000, count)),
          style: 'ticks',
        }));
      } catch (err) {
        console.warn('[Deriv WS] Failed to request ticks_history for', symbol, err);
      }
    }
  }

  public subscribeTicks(symbol: MarketSymbol, callback: TickListener) {
    let listeners = this.tickListeners.get(symbol);
    if (!listeners) {
      listeners = new Set<TickListener>();
      this.tickListeners.set(symbol, listeners);
    }
    listeners.add(callback);
    this.activeSubscriptions.add(symbol);
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.sendTickSubscription(symbol);
    }
  }

  public unsubscribeTicks(symbol: MarketSymbol, callback: TickListener) {
    const listeners = this.tickListeners.get(symbol);
    if (!listeners) return;
    listeners.delete(callback);
    if (listeners.size > 0) return;
    this.tickListeners.delete(symbol);
    this.activeSubscriptions.delete(symbol);
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ forget_all: 'ticks' }));
      this.activeSubscriptions.forEach((activeSymbol) => this.sendTickSubscription(activeSymbol));
    }
  }

  private sendTickSubscription(symbol: MarketSymbol) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify({ ticks: symbol, subscribe: 1 }));
        this.ws.send(JSON.stringify({
          ticks_history: symbol,
          end: 'latest',
          count: 500,
          style: 'ticks',
        }));
      } catch (err) {
        console.warn('[Deriv WS] Error sending tick subscription for', symbol, err);
      }
    }
  }

  private createClientContract(params: {
    symbol: MarketSymbol;
    contractType: string;
    stake: number;
    durationTicks?: number;
    durationValue?: number;
    durationUnit?: 't' | 's' | 'm' | 'h' | 'd';
    barrier?: number;
    targetDigit?: number;
    multiplier?: number;
    growthRate?: number;
    takeProfit?: number;
    stopLoss?: number;
    symbolName: string;
  }): ActiveContract {
    const spot = this.currentPrices.get(params.symbol) ?? 0;
    const durationUnit = params.durationUnit || 't';
    const durationVal = params.durationValue || params.durationTicks || 1;
    const durationTicks = Math.max(1, Math.floor(params.durationTicks || (durationUnit === 't' ? durationVal : durationVal * 60)));
    
    let durationMs = durationTicks * 1000;
    if (durationUnit === 'm') durationMs = durationVal * 60 * 1000;
    else if (durationUnit === 's') durationMs = durationVal * 1000;
    else if (durationUnit === 'h') durationMs = durationVal * 3600 * 1000;

    return {
      id: `PENDING_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      symbol: params.symbol,
      symbolName: params.symbolName,
      contractType: params.contractType,
      entrySpot: spot,
      currentSpot: spot,
      barrier: params.barrier,
      targetDigit: params.targetDigit,
      multiplier: params.multiplier,
      growthRate: params.growthRate,
      takeProfit: params.takeProfit,
      stopLoss: params.stopLoss,
      stake: params.stake,
      potentialPayout: Number((params.stake * 1.92).toFixed(2)),
      currentProfit: 0,
      startTime: Date.now(),
      expiryTime: Date.now() + durationMs,
      durationTicks: durationTicks,
      remainingTicks: durationTicks,
      durationUnit: durationUnit,
      durationValue: durationVal,
      status: 'OPEN',
      historySpots: spot ? [spot] : [],
    };
  }

  public purchaseContract(params: {
    symbol: MarketSymbol;
    contractType: string;
    stake: number;
    durationTicks?: number;
    durationValue?: number;
    durationUnit?: 't' | 's' | 'm' | 'h' | 'd';
    barrier?: number;
    targetDigit?: number;
    multiplier?: number;
    growthRate?: number;
    takeProfit?: number;
    stopLoss?: number;
    symbolName: string;
  }): ActiveContract {
    // 🛡️ Strategy Shield & Anti-Manipulation Protection Checks
    if (strategyShield.isCircuitBreakerActive()) {
      const remainingSec = strategyShield.getRemainingCircuitBreakerSec();
      const reason = strategyShield.getCircuitBreakerReason();
      console.warn(`🛡️ [STRATEGY SHIELD] Trade BLOCKED by Circuit Breaker (${remainingSec}s remaining): ${reason}`);
      const contract = this.createClientContract(params);
      contract.status = 'CANCELLED';
      contract.currentProfit = 0;
      contract.remainingTicks = 0;
      this.notifyContract(contract);
      return contract;
    }

    // Check real-time latency & tick staleness
    const latencyCheck = strategyShield.checkLatencySafe(this.currentPingMs, this.getLastTick(params.symbol)?.epoch);
    if (!latencyCheck.safe) {
      console.warn(`🛡️ [STRATEGY SHIELD] Trade BLOCKED by Latency Guard: ${latencyCheck.reason}`);
      const contract = this.createClientContract(params);
      contract.status = 'CANCELLED';
      contract.currentProfit = 0;
      contract.remainingTicks = 0;
      this.notifyContract(contract);
      return contract;
    }

    // Apply Stake Fuzzing / Anti-Martingale footprint masking
    const { stake: effectiveStake } = strategyShield.calculateFuzzedStake(params.stake, this.cachedBalance > 0 ? this.cachedBalance : undefined);
    const modifiedParams = { ...params, stake: effectiveStake };

    const contract = this.createClientContract(modifiedParams);
    const clientId = contract.id;
    const stake = Number(modifiedParams.stake);
    if (!Number.isFinite(stake) || stake <= 0) {
      contract.status = 'CANCELLED';
      contract.currentProfit = 0;
      contract.remainingTicks = 0;
      this.notifyContract(contract);
      return contract;
    }
    this.activeContracts.set(clientId, contract);
    this.notifyContract(contract);

    if (this.isTestMode || !this.isAuthorized || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
      // In demo/simulated mode (or Test Mode for safe strategy testing), ensure ticks are subscribed and progress contract
      this.subscribeTicks(modifiedParams.symbol, () => {});
      this.simulatedContracts.set(clientId, { ...contract });
      return contract;
    }

    this.pendingTrades.set(clientId, { contract, currency: this.currency });
    const durationUnit = modifiedParams.durationUnit || 't';
    const durationVal = modifiedParams.durationValue || modifiedParams.durationTicks || 1;
    
    // Direct Instant Buy (Single packet round-trip with Deriv WebSocket API)
    const directBuyParams: Record<string, any> = {
      amount: stake,
      basis: 'stake',
      contract_type: modifiedParams.contractType,
      currency: this.currency,
      duration: Math.max(1, Math.floor(durationVal)),
      duration_unit: durationUnit,
      symbol: modifiedParams.symbol,
    };
    if (['DIGITDIFF', 'DIGITMATCH', 'DIGITOVER', 'DIGITUNDER'].includes(modifiedParams.contractType)) {
      const digit = modifiedParams.targetDigit;
      if (digit === undefined || !Number.isInteger(digit) || digit < 0 || digit > 9) {
        this.cancelPendingTrade(clientId, 'invalid digit prediction');
        return contract;
      }
      directBuyParams.barrier = String(digit);
      contract.barrier = digit;
      contract.targetDigit = digit;
    } else if (modifiedParams.barrier !== undefined) {
      directBuyParams.barrier = String(modifiedParams.barrier);
    }

    const directBuyRequest = {
      buy: 1,
      price: stake,
      parameters: directBuyParams,
      passthrough: {
        client_contract_id: clientId,
        is_direct_buy: 1,
        fallback_params: {
          amount: stake,
          contract_type: modifiedParams.contractType,
          duration: Math.max(1, Math.floor(durationVal)),
          duration_unit: durationUnit,
          underlying_symbol: modifiedParams.symbol,
          barrier: directBuyParams.barrier,
        },
      },
    };

    // Instant zero-delay dispatch to Deriv WebSocket (bypassing artificial delays)
    try {
      console.info('[Deriv WS] Executing INSTANT Direct Buy:', directBuyRequest);
      this.ws.send(JSON.stringify(directBuyRequest));
    } catch (error) {
      this.cancelPendingTrade(clientId, error instanceof Error ? error.message : String(error));
    }
    return contract;
  }

  private handleProposal(data: any) {
    const clientId = data.echo_req?.passthrough?.client_contract_id;
    if (!clientId) return;
    const pending = this.pendingTrades.get(clientId);
    if (!pending) return;
    if (data.error || !data.proposal?.id) {
      this.cancelPendingTrade(String(clientId), data.error?.message || 'proposal was not created');
      return;
    }
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    const proposalId = String(data.proposal.id);
    const askPrice = Number(data.proposal.ask_price ?? pending.contract.stake);
    const buyRequest = {
      buy: proposalId,
      price: Math.max(pending.contract.stake, askPrice),
      passthrough: { client_contract_id: clientId },
    };
    pending.contract.potentialPayout = Number(data.proposal.payout) || pending.contract.stake;
    try {
      console.info('[Deriv WS] Instant Buying proposal:', proposalId);
      this.ws.send(JSON.stringify(buyRequest));
    } catch (error) {
      this.cancelPendingTrade(String(clientId), error instanceof Error ? error.message : String(error));
    }
  }

  private handleBuy(data: any) {
    const clientId = data.echo_req?.passthrough?.client_contract_id || data.buy?.passthrough?.client_contract_id;
    if (!clientId || !this.pendingTrades.has(clientId)) return;
    const pending = this.pendingTrades.get(clientId)!;
    if (data.error || !data.buy?.contract_id) {
      this.cancelPendingTrade(String(clientId), data.error?.message || 'buy request was rejected');
      return;
    }
    const liveId = String(data.buy.contract_id);
    this.liveToClientContract.set(liveId, clientId);
    this.pendingTrades.delete(clientId);
    const clientContract = pending.contract as ClientContract;
    clientContract.liveContractId = liveId;
    clientContract.entrySpot = Number(data.buy.start_spot ?? clientContract.entrySpot);
    clientContract.currentSpot = clientContract.entrySpot;
    clientContract.potentialPayout = Number(data.buy.payout) || clientContract.potentialPayout;
    clientContract.historySpots = clientContract.entrySpot ? [clientContract.entrySpot] : [];
    clientContract.status = 'OPEN';
    this.activeContracts.delete(clientId);
    this.activeContracts.set(clientId, clientContract);
    this.notifyContract(clientContract);
    this.refreshBalance();
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ proposal_open_contract: 1, contract_id: liveId, subscribe: 1 }));
      this.beginSettlementPolling(liveId, 0);
    }
  }

  private beginSettlementPolling(liveId: string, attempt: number) {
    if (this.settledContracts.has(liveId) || this.settlementPollTimers.has(liveId)) return;
    if (attempt >= 25) {
      this.settlementPollTimers.delete(liveId);
      return;
    }
    const timer = window.setTimeout(() => {
      this.settlementPollTimers.delete(liveId);
      if (this.settledContracts.has(liveId)) return;
      if (this.ws?.readyState === WebSocket.OPEN) {
        try {
          this.ws.send(JSON.stringify({ proposal_open_contract: 1, contract_id: liveId }));
        } catch (_) {}
      }
      this.beginSettlementPolling(liveId, attempt + 1);
    }, attempt === 0 ? 100 : 150);
    this.settlementPollTimers.set(liveId, timer);
  }
  private clearSettlementPolling(liveId: string) { const timer = this.settlementPollTimers.get(liveId); if (timer !== undefined) window.clearTimeout(timer); this.settlementPollTimers.delete(liveId); }
  private getContractProfit(poc: any, contract: ActiveContract): number { const directProfit = Number(poc?.profit); if (Number.isFinite(directProfit)) return directProfit; const sellPrice = Number(poc?.sell_price); const buyPrice = Number(poc?.buy_price); if (Number.isFinite(sellPrice) && Number.isFinite(buyPrice)) return sellPrice - buyPrice; const payout = Number(poc?.payout); if (Number.isFinite(payout) && Number.isFinite(buyPrice)) return payout - buyPrice; const status = String(poc?.status || '').toLowerCase(); if (['lost', 'sold'].includes(status) || poc?.is_sold || poc?.is_expired || poc?.is_settled) return -Number(contract.stake || 0); return Number(contract.currentProfit) || 0; }

  private handleContractUpdate(poc: any) {
    if (!poc) return;
    const liveId = String(poc.contract_id || poc.id || '');
    if (!liveId) return;
    const clientId = this.liveToClientContract.get(liveId) || liveId;
    const contract = this.activeContracts.get(clientId);
    if (!contract) return;

    const pipSize = this.marketPipSizes.get(contract.symbol) ?? getMarketPipSize(contract.symbol);
    contract.pipSize = pipSize;

    if (poc.current_spot !== undefined) {
      const currentSpot = Number(poc.current_spot);
      if (Number.isFinite(currentSpot)) {
        contract.currentSpot = currentSpot;
        if (contract.historySpots[contract.historySpots.length - 1] !== currentSpot) contract.historySpots.push(currentSpot);
        if (contract.historySpots.length > 100) contract.historySpots.shift();
      }
    }
    if (poc.entry_spot !== undefined) {
      const value = Number(poc.entry_spot);
      if (Number.isFinite(value)) contract.entrySpot = value;
    }
    if (poc.entry_tick_display_value) {
      contract.entrySpotDisplay = String(poc.entry_tick_display_value);
    } else if (contract.entrySpot) {
      contract.entrySpotDisplay = formatDerivQuote(contract.entrySpot, pipSize, contract.symbol);
    }
    if (poc.payout !== undefined) {
      const value = Number(poc.payout);
      if (Number.isFinite(value)) contract.potentialPayout = value;
    }
    if (poc.exit_tick !== undefined) {
      const value = Number(poc.exit_tick);
      if (Number.isFinite(value)) contract.exitSpot = value;
    }
    if (poc.exit_tick_display_value) {
      contract.exitSpotDisplay = String(poc.exit_tick_display_value);
    } else if (contract.exitSpot !== undefined) {
      contract.exitSpotDisplay = formatDerivQuote(contract.exitSpot, pipSize, contract.symbol);
    }
    if (contract.exitSpotDisplay) {
      contract.exitDigit = extractDerivLastDigit(contract.exitSpotDisplay, pipSize, contract.symbol);
    } else if (contract.exitSpot !== undefined) {
      contract.exitDigit = extractDerivLastDigit(contract.exitSpot, pipSize, contract.symbol);
    }
    if (poc.exit_tick_time !== undefined) {
      const value = Number(poc.exit_tick_time);
      if (Number.isFinite(value)) contract.expiryTime = value * 1000;
    }

    const status = String(poc.status || '').toLowerCase();
    const ended = Boolean(poc.is_sold || poc.is_expired || poc.is_settled || ['won', 'lost', 'sold'].includes(status));
    if (ended) {
      if (this.settledContracts.has(liveId)) return;
      this.settledContracts.add(liveId);
      this.clearSettlementPolling(liveId);
      const profit = this.getContractProfit(poc, contract);
      contract.currentProfit = Number.isFinite(profit) ? profit : 0;
      contract.isWin = contract.currentProfit > 0;
      contract.status = status === 'sold' || poc.is_sold ? 'SOLD' : (contract.currentProfit > 0 ? 'WON' : 'LOST');
      contract.remainingTicks = 0;
      if (poc.exit_tick !== undefined) {
        const value = Number(poc.exit_tick);
        if (Number.isFinite(value)) contract.exitSpot = value;
      }
      if (poc.exit_tick_display_value) {
        contract.exitSpotDisplay = String(poc.exit_tick_display_value);
      } else if (contract.exitSpot !== undefined) {
        contract.exitSpotDisplay = formatDerivQuote(contract.exitSpot, pipSize, contract.symbol);
      }
      if (contract.exitSpotDisplay) {
        contract.exitDigit = extractDerivLastDigit(contract.exitSpotDisplay, pipSize, contract.symbol);
      } else if (contract.exitSpot !== undefined) {
        contract.exitDigit = extractDerivLastDigit(contract.exitSpot, pipSize, contract.symbol);
      }
      strategyShield.registerTradeOutcome(contract.isWin, contract.currentProfit);
      this.activeContracts.set(clientId, contract);
      this.notifyContract(contract);
      this.refreshBalance();
      window.setTimeout(() => this.refreshBalance(), 350);
      return;
    }
    const reportedProfit = Number(poc.profit);
    if (Number.isFinite(reportedProfit)) contract.currentProfit = reportedProfit;
    contract.status = 'OPEN';
    if (poc.tick_count !== undefined && poc.tick_count !== null) {
      const tickCount = Number(poc.tick_count);
      if (Number.isFinite(tickCount)) contract.remainingTicks = Math.max(0, contract.durationTicks - tickCount);
    }
    this.notifyContract(contract);
  }

  public sellContractEarly(contractId: string): ActiveContract | null { const contract = this.activeContracts.get(contractId); if (!contract || contract.status !== 'OPEN' || !this.ws || this.ws.readyState !== WebSocket.OPEN) return null; const liveId = (contract as ClientContract).liveContractId || this.liveToClientContract.get(contractId) || contractId; this.ws.send(JSON.stringify({ sell: liveId, price: 0 })); return contract; }
}

export const derivWS = new DerivWebSocketService();