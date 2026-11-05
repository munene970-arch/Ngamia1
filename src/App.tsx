import React, { useState, useEffect } from 'react';
import { MarketSymbol, MarketInfo, ActiveContract, ConnectionState, DBotStrategy } from './types/deriv';
import { AppLayoutId } from './types/layout';
import { INITIAL_MARKETS } from './services/derivMarketsData';
import { derivWS, AuthStatus } from './services/derivWebSocket';
import { soundManager } from './utils/soundEffects';
import { HeaderBar } from './components/HeaderBar';
import { SystemAutoTerminal } from './components/Terminal/SystemAutoTerminal';
import { DBotStudio } from './components/BotStudio/DBotStudio';
import { BotStore } from './components/BotStudio/BotStore';
import { MarketScanner } from './components/Analyzer/MarketScanner';
import { AutoTrader } from './components/AutoTrader/AutoTrader';
import { CopyTradingHub } from './components/CopyTrading/CopyTradingHub';
import { AICopilotPanel } from './components/Copilot/AICopilotPanel';
import { RiskAndTools } from './components/AccountTools/RiskAndTools';
import { CandleAnalysisPanel } from './components/CandleAnalysis/CandleAnalysisPanel';
import { DerivDigitTrader } from './components/DerivDigitTrader/DerivDigitTrader';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { DigitSpecialistLayout } from './components/Layouts/DigitSpecialistLayout';
import { MultiMarketGridLayout } from './components/Layouts/MultiMarketGridLayout';
import { BotOperatorLayout } from './components/Layouts/BotOperatorLayout';
import { LayoutSelectorModal } from './components/Layouts/LayoutSelectorModal';
import { StrategyShieldModal } from './components/common/StrategyShieldModal';
import { DerivOAuthAccount, parseDerivOAuthInput, getStoredAccounts, saveStoredAccounts } from './utils/derivOAuth';
import { REGISTERED_DERIV_APP_ID, STING_REDIRECT_URI, DERIV_OAUTH_SCOPE } from './config/deriv';
import { DerivPatConnector } from './components/DerivPatConnector';
import { DerivPatAccount } from './services/derivPatConnection';

export default function App() {
  const [activeTab, setActiveTabState] = useState<string>('terminal');
  const [currentLayout, setCurrentLayoutState] = useState<AppLayoutId>(() => {
    return (localStorage.getItem('deriv_preferred_layout') as AppLayoutId) || 'pro_terminal';
  });
  const [isLayoutModalOpen, setIsLayoutModalOpen] = useState<boolean>(false);
  const [isShieldModalOpen, setIsShieldModalOpen] = useState<boolean>(false);

  const handleSelectLayout = (layout: AppLayoutId) => {
    setCurrentLayoutState(layout);
    localStorage.setItem('deriv_preferred_layout', layout);
    soundManager.playButtonClick();
  };

  const setActiveTab = (tab: string) => {
    setActiveTabState(tab);
    const hashVal = tab === 'terminal' ? 'dashboard' : tab;
    if (window.location.hash !== `#${hashVal}`) window.history.replaceState(null, '', `#${hashVal}`);
  };

  useEffect(() => {
    const sync = () => {
      const h = window.location.hash.replace('#', '').toLowerCase();
      if (!h) return;
      if (['dashboard', 'terminal', 'trade'].includes(h)) setActiveTabState('terminal');
      else if (['candle_analysis', 'candles', 'candle'].includes(h)) setActiveTabState('candle_analysis');
      else if (['deriv_digit', 'digit', 'digits', 'deriv_digits', 'diffbot', 'diff'].includes(h)) setActiveTabState('deriv_digit');
      else if (['dbot', 'botstore', 'scanner', 'autotrader', 'auto', 'copy', 'copilot', 'tools'].includes(h)) {
        if (h === 'auto') setActiveTabState('autotrader');
        else setActiveTabState(h);
      }
    };
    sync();
    window.addEventListener('hashchange', sync);
    return () => window.removeEventListener('hashchange', sync);
  }, []);

  const [markets] = useState<MarketInfo[]>(INITIAL_MARKETS);
  const [derivNickname, setDerivNickname] = useState<string>('');
  const [selectedSymbol, setSelectedSymbol] = useState<MarketSymbol>('R_75');
  const [activeContracts, setActiveContracts] = useState<ActiveContract[]>([]);
  const [autoConfiguredBot, setAutoConfiguredBot] = useState<DBotStrategy | null>(null);
  const [availableAccounts, setAvailableAccounts] = useState<DerivOAuthAccount[]>([]);
  const [isTestMode, setIsTestMode] = useState<boolean>(() => {
    const saved = localStorage.getItem('deriv_strategy_test_mode');
    return saved !== null ? saved === 'true' : false;
  });
  const [demoBalanceUsd, setDemoBalanceUsd] = useState<number>(() => {
    const saved = localStorage.getItem('deriv_demo_balance');
    return saved ? Number(saved) : 10000;
  });
  const [liveBalanceUsd, setLiveBalanceUsd] = useState<number>(0);

  const [connectionState, setConnectionState] = useState<ConnectionState>({
    isConnected: false,
    mode: 'DEMO_SIMULATED',
    appId: REGISTERED_DERIV_APP_ID,
    accountType: 'DEMO',
    balanceUsd: 10000,
    currency: 'USD',
    isAuthorized: false,
    isConnecting: false,
    isTestMode: false,
    authError: null,
  });

  useEffect(() => {
    derivWS.setTestMode(isTestMode);
    const testModeListener = (test: boolean) => {
      setIsTestMode(test);
    };
    derivWS.subscribeTestMode(testModeListener);
    return () => derivWS.unsubscribeTestMode(testModeListener);
  }, []);

  const handleToggleTestMode = (enableTestMode?: boolean) => {
    const nextVal = typeof enableTestMode === 'boolean' ? enableTestMode : !isTestMode;
    setIsTestMode(nextVal);
    derivWS.setTestMode(nextVal);
    soundManager.playButtonClick();
  };

  const connectWithToken = (appId: string, token: string) => {
    const cleanToken = derivWS.sanitizeToken(token);
    const cleanAppId = appId?.trim() || REGISTERED_DERIV_APP_ID;
    if (!cleanToken) {
      setConnectionState((p) => ({ ...p, isConnecting: false, isAuthorized: false, authError: 'Enter a valid Deriv API token.' }));
      return;
    }
    sessionStorage.removeItem('deriv_token');
    localStorage.removeItem('deriv_token');
    localStorage.removeItem('deriv_app_id');
    setConnectionState((p) => ({ ...p, appId: cleanAppId, token: undefined, isConnecting: true, isAuthorized: false, authError: null }));
    derivWS.connect(cleanAppId, cleanToken);
  };

  const connectWithParsedAccounts = (accounts: DerivOAuthAccount[]) => {
    if (!accounts?.length) return;
    setAvailableAccounts(accounts);
    const a = accounts.find((x) => x.type === 'REAL') || accounts[0];
    if (a?.token) connectWithToken(REGISTERED_DERIV_APP_ID, a.token);
  };

  useEffect(() => {
    const settled = new Set<string>();
    const contractListener = (c: ActiveContract) => {
      setActiveContracts((p) => {
        const i = p.findIndex((x) => x.id === c.id);
        if (i >= 0) {
          const n = [...p];
          n[i] = { ...c };
          return n;
        }
        return [{ ...c }, ...p].slice(0, 26);
      });
      if (['WON', 'LOST', 'SOLD'].includes(c.status) && !settled.has(c.id)) {
        settled.add(c.id);
        if (c.isWin || c.status === 'WON') soundManager.playWinSound();
        else soundManager.playLossSound();
      }
    };

    const authListener = (s: AuthStatus) => {
      if (s.balance !== undefined) {
        setLiveBalanceUsd(s.balance);
      }
      setConnectionState((cs) => ({
        ...cs,
        isConnected: Boolean(s.isAuthorized),
        mode: s.isAuthorized ? 'DERIV_WEBSOCKET_LIVE' : 'DEMO_SIMULATED',
        isAuthorized: s.isAuthorized,
        isConnecting: false,
        loginid: s.loginid || cs.loginid,
        email: s.email || cs.email,
        balanceUsd: s.balance !== undefined ? s.balance : cs.balanceUsd,
        currency: s.currency || cs.currency || 'USD',
        accountType: s.isVirtual ? 'DEMO' : s.isVirtual === false ? 'REAL' : cs.accountType,
        scopes: s.scopes || cs.scopes,
        activeEndpoint: s.activeEndpoint || cs.activeEndpoint,
        authError: s.error || null,
        isTestMode: derivWS.getIsTestMode(),
      }));

      if (s.isAuthorized) {
        fetch('/.netlify/functions/account-nickname', {
          method: 'GET',
          headers: {
            Accept: 'application/json',
          },
          cache: 'no-store',
        })
          .then(async (response) => {
            const body = await response.text();
            if (!response.ok) throw new Error(body || `Nickname request failed (${response.status})`);
            try {
              return JSON.parse(body);
            } catch {
              return { nickname: body };
            }
          })
          .then((data) => {
            const nickname = typeof data?.nickname === 'string' ? data.nickname.trim() : '';
            if (nickname) setDerivNickname(nickname);
          })
          .catch((error) => {
            console.warn('[Deriv nickname] Request failed; trading connection remains unaffected.', error);
            setDerivNickname('');
          });
      } else {
        setDerivNickname('');
      }
    };

    derivWS.subscribeContracts(contractListener);
    derivWS.subscribeAuth(authListener);

    const oauthMessage = (e: MessageEvent) => {
      if (e.data?.type !== 'DERIV_OAUTH_SUCCESS') return;
      const { accounts, token, appId } = e.data;
      if (Array.isArray(accounts) && accounts.length) {
        saveStoredAccounts(accounts);
        setAvailableAccounts(accounts);
      }
      if (token) connectWithToken(appId || REGISTERED_DERIV_APP_ID, token);
    };
    window.addEventListener('message', oauthMessage);

    const processAuth = async () => {
      const search = window.location.search || '';
      const hash = window.location.hash || '';
      const full = `${search} ${hash}`;
      const params = new URLSearchParams(search);
      const returnedState = params.get('state');
      const savedState = sessionStorage.getItem('deriv_oauth_state');
      sessionStorage.removeItem('deriv_token');
      localStorage.removeItem('deriv_token');
      localStorage.removeItem('deriv_app_id');
      localStorage.removeItem('deriv_accounts');
      if (returnedState && savedState && returnedState !== savedState) console.warn('[Deriv OAuth] State mismatch');
      if (returnedState) sessionStorage.removeItem('deriv_oauth_state');
      const parsed = parseDerivOAuthInput(full);
      let token = '';
      if (parsed.length) {
        setAvailableAccounts(parsed);
        token = (parsed.find((a) => a.type === 'REAL') || parsed[0])?.token || token;
      }
      setConnectionState((p) => ({ ...p, appId: REGISTERED_DERIV_APP_ID, token, isConnecting: Boolean(token) }));
      if (token) derivWS.connect(REGISTERED_DERIV_APP_ID, token);
      if (parsed.length || returnedState) window.history.replaceState({}, document.title, window.location.pathname);
    };
    processAuth();

    return () => {
      derivWS.unsubscribeContracts(contractListener);
      derivWS.unsubscribeAuth(authListener);
      window.removeEventListener('message', oauthMessage);
    };
  }, []);

  useEffect(() => {
    const i = window.setInterval(
      () =>
        setConnectionState((cs) => ({
          ...cs,
          isConnected: derivWS.getIsLiveWs(),
          mode: derivWS.getIsLiveWs() ? 'DERIV_WEBSOCKET_LIVE' : 'DEMO_SIMULATED',
        })),
      2000
    );
    return () => window.clearInterval(i);
  }, []);

  const handleSelectAccount = (a: DerivOAuthAccount) => {
    if (a?.token) connectWithToken(connectionState.appId || REGISTERED_DERIV_APP_ID, a.token);
  };

  const handleConnectPatAccount = (account: DerivPatAccount, appId: string) => {
    setConnectionState((previous) => ({
      ...previous,
      appId,
      token: undefined,
      isConnecting: true,
      isAuthorized: false,
      isConnected: false,
      accountType: account.is_virtual ? 'DEMO' : 'REAL',
      loginid: account.loginid || account.account_id,
      balanceUsd: Number(account.balance) || 0,
      currency: account.currency || 'USD',
      authError: null,
    }));
    derivWS.connectWithPatAccount(account);
  };

  const handleOAuthRedirect = () => {
    const state = 'state_' + Math.random().toString(36).slice(2, 11) + '_' + Date.now().toString(36);
    sessionStorage.setItem('deriv_oauth_state', state);
    const url = `https://oauth.deriv.com/oauth2/authorize?app_id=${encodeURIComponent(REGISTERED_DERIV_APP_ID)}&l=EN&scope=${encodeURIComponent(DERIV_OAUTH_SCOPE)}&redirect_uri=${encodeURIComponent(STING_REDIRECT_URI)}&state=${encodeURIComponent(state)}`;
    window.location.assign(url);
  };

  const handleResetDemoBalance = () => {
    setDemoBalanceUsd(10000);
    localStorage.setItem('deriv_demo_balance', '10000');
    setConnectionState((p) => ({ ...p, balanceUsd: 10000 }));
  };

  const handleUpdateBalance = (n: number) => {
    const fixed = Number(n.toFixed(2));
    if (isTestMode || !connectionState.isAuthorized) {
      setDemoBalanceUsd(fixed);
      localStorage.setItem('deriv_demo_balance', String(fixed));
      setConnectionState((p) => ({ ...p, balanceUsd: fixed }));
    } else {
      setLiveBalanceUsd(fixed);
      setConnectionState((p) => ({ ...p, balanceUsd: fixed }));
    }
  };

  const effectiveBalance = isTestMode || !connectionState.isAuthorized
    ? demoBalanceUsd
    : (liveBalanceUsd > 0 ? liveBalanceUsd : (connectionState.balanceUsd || demoBalanceUsd));

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans antialiased selection:bg-red-600 selection:text-white">
      <HeaderBar
        connectionState={{ ...connectionState, balanceUsd: effectiveBalance }}
        derivNickname={derivNickname}
        onUpdateConnection={(id, t) => connectWithToken(id || REGISTERED_DERIV_APP_ID, t)}
        onOAuthRedirect={handleOAuthRedirect}
        onResetDemoBalance={handleResetDemoBalance}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        availableAccounts={availableAccounts}
        onSelectAccount={handleSelectAccount}
        currentLayout={currentLayout}
        onSelectLayout={handleSelectLayout}
        onOpenLayoutModal={() => setIsLayoutModalOpen(true)}
        isTestMode={isTestMode}
        onToggleTestMode={handleToggleTestMode}
        onOpenShieldModal={() => setIsShieldModalOpen(true)}
      />
      <DerivPatConnector onConnectAccount={handleConnectPatAccount} isConnecting={connectionState.isConnecting} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Render Primary Terminal Workspace according to selected layout */}
        {activeTab === 'terminal' && (
          <SystemAutoTerminal
            markets={markets}
            selectedSymbol={selectedSymbol}
            onSelectSymbol={setSelectedSymbol}
            balanceUsd={effectiveBalance}
            onUpdateBalance={handleUpdateBalance}
            activeContracts={activeContracts}
          />
        )}

        {/* Specialized Tabs */}
        {activeTab === 'candle_analysis' && (
          <ErrorBoundary fallbackTitle="Candle Analysis Panel Error">
            <CandleAnalysisPanel
              markets={markets}
              selectedSymbol={selectedSymbol}
              onSelectSymbol={setSelectedSymbol}
              balanceUsd={effectiveBalance}
              onUpdateBalance={handleUpdateBalance}
              activeContracts={activeContracts}
            />
          </ErrorBoundary>
        )}
        {activeTab === 'deriv_digit' && (
          <ErrorBoundary fallbackTitle="Deriv Digit Interface Error">
            <DerivDigitTrader
              markets={markets}
              balanceUsd={effectiveBalance}
              onUpdateBalance={handleUpdateBalance}
              initialSymbol={selectedSymbol}
            />
          </ErrorBoundary>
        )}
        {activeTab === 'dbot' && (
          <DBotStudio
            markets={markets}
            balanceUsd={effectiveBalance}
            onUpdateBalance={handleUpdateBalance}
            activeBotOverride={autoConfiguredBot}
          />
        )}
        {activeTab === 'botstore' && (
          <BotStore
            markets={markets}
            onImportBotToStudio={(b) => {
              setAutoConfiguredBot(b);
              setActiveTab('dbot');
            }}
          />
        )}
        {activeTab === 'scanner' && (
          <MarketScanner
            markets={markets}
            balanceUsd={effectiveBalance}
            onAutoConfigureBot={(b) => {
              setAutoConfiguredBot(b);
              setActiveTab('dbot');
            }}
            onNavigateTab={(t) => setActiveTab(t)}
            onUpdateBalance={handleUpdateBalance}
            onSelectMarket={(s) => {
              setSelectedSymbol(s);
              setActiveTab('terminal');
            }}
          />
        )}
        {activeTab === 'autotrader' && (
          <AutoTrader
            markets={markets}
            balanceUsd={effectiveBalance}
            onUpdateBalance={handleUpdateBalance}
            onNavigateTab={(t) => setActiveTab(t)}
          />
        )}
        {activeTab === 'copy' && <CopyTradingHub balanceUsd={connectionState.balanceUsd} />}
        {activeTab === 'copilot' && (
          <AICopilotPanel
            markets={markets}
            selectedSymbol={selectedSymbol}
            balanceUsd={connectionState.balanceUsd}
          />
        )}
        {activeTab === 'tools' && <RiskAndTools />}
      </main>

      {/* Strategy Shield & Anti-Manipulation Engine Modal */}
      <StrategyShieldModal
        isOpen={isShieldModalOpen}
        onClose={() => setIsShieldModalOpen(false)}
      />

      {/* Layout Selector Modal */}
      <LayoutSelectorModal
        isOpen={isLayoutModalOpen}
        onClose={() => setIsLayoutModalOpen(false)}
        currentLayout={currentLayout}
        onSelectLayout={handleSelectLayout}
      />

      <footer className="border-t border-slate-900 bg-slate-950 py-6 text-center text-xs text-slate-500">
        <div>MBOKO AUTO STEPS • Real-time Synthetics, DBot & Copy Trading</div>
      </footer>
    </div>
  );
}

