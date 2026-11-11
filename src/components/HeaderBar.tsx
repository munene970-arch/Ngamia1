import React, { useEffect, useState } from 'react';
import { ConnectionState } from '../types/deriv';
import { DerivOAuthAccount } from '../utils/derivOAuth';
import { AppLayoutId } from '../types/layout';
import { Shield, ShieldCheck, ShieldAlert, Zap, RefreshCw, Key, Wallet, SlidersHorizontal, Bot, Radar, Download, Link2, LogOut, LayoutGrid, CircleDot, Grid, Sparkles, BarChart2, FlaskConical, CheckCircle2, Rocket, Radio, Binary, Code2, Activity, Percent, GitFork, AlertTriangle, Globe } from 'lucide-react';
import { InstallAppModal } from './InstallAppModal';
import { strategyShield, StrategyShieldConfig } from '../services/strategyShield';
import { derivWS } from '../services/derivWebSocket';
import { REGISTERED_DERIV_APP_ID, DerivEndpointConfig } from '../config/deriv';

interface HeaderBarProps {
  connectionState: ConnectionState;
  derivNickname?: string;
  onUpdateConnection: (appId: string, token: string) => void;
  onDisconnect?: () => void;
  onClearAuthError?: () => void;
  onOpenTokenModal?: () => void;
  onOAuthRedirect?: (appId: string) => void;
  onResetDemoBalance: () => void;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  availableAccounts?: DerivOAuthAccount[];
  onSelectAccount?: (account: DerivOAuthAccount) => void;
  currentLayout: AppLayoutId;
  onSelectLayout: (layout: AppLayoutId) => void;
  onOpenLayoutModal: () => void;
  isTestMode?: boolean;
  onToggleTestMode?: (enabled: boolean) => void;
  onOpenShieldModal?: () => void;
}

export const HeaderBar: React.FC<HeaderBarProps> = ({
  connectionState,
  derivNickname,
  onUpdateConnection,
  onDisconnect,
  onClearAuthError,
  onOpenTokenModal,
  onOAuthRedirect,
  onResetDemoBalance,
  activeTab,
  setActiveTab,
  availableAccounts = [],
  onSelectAccount,
  currentLayout,
  onSelectLayout,
  onOpenLayoutModal,
  isTestMode = false,
  onToggleTestMode,
  onOpenShieldModal,
}) => {
  const [showInstallModal, setShowInstallModal] = useState(false);
  const [token, setToken] = useState(connectionState.token || '');
  const [appId, setAppId] = useState(connectionState.appId || REGISTERED_DERIV_APP_ID);
  const [showToken, setShowToken] = useState(false);
  const [shieldConfig, setShieldConfig] = useState<StrategyShieldConfig>(() => strategyShield.getConfig());
  const [shieldPing, setShieldPing] = useState<number>(() => derivWS.getPingMs() || 28);
  const [circuitBreakerSec, setCircuitBreakerSec] = useState<number>(() => strategyShield.getRemainingCircuitBreakerSec());
  const [liveBotRunning, setLiveBotRunning] = useState<boolean>(false);
  const [liveBotMarket, setLiveBotMarket] = useState<string>('Vol 10');
  const [currentEndpoint, setCurrentEndpoint] = useState<DerivEndpointConfig>(() => derivWS.getCurrentEndpoint());

  useEffect(() => {
    const cb = (ep: DerivEndpointConfig) => setCurrentEndpoint(ep);
    derivWS.subscribeEndpoint(cb);
    return () => derivWS.unsubscribeEndpoint(cb);
  }, []);

  useEffect(() => {
    let mounted = true;
    const checkLiveBot = async () => {
      try {
        const res = await fetch('/api/system-auto-live/status');
        if (res.ok) {
          const json = await res.json();
          if (mounted && json.success && json.data) {
            setLiveBotRunning(Boolean(json.data.isRunning));
            if (json.data.currentMarket?.shortName) {
              setLiveBotMarket(json.data.currentMarket.shortName);
            }
          }
        }
      } catch {}
    };
    checkLiveBot();
    const t = setInterval(checkLiveBot, 3000);
    return () => {
      mounted = false;
      clearInterval(t);
    };
  }, []);

  const handleHeaderStopLiveBot = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await fetch('/api/system-auto-live/stop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'Stopped via header bar quick button' }),
      });
      setLiveBotRunning(false);
    } catch {}
  };

  useEffect(() => {
    const unsub = strategyShield.subscribe((cfg) => {
      setShieldConfig(cfg);
    });
    const interval = window.setInterval(() => {
      setShieldPing(derivWS.getPingMs() || 28);
      setCircuitBreakerSec(strategyShield.getRemainingCircuitBreakerSec());
    }, 600);
    return () => {
      unsub();
      window.clearInterval(interval);
    };
  }, []);

  useEffect(() => setToken(connectionState.token || ''), [connectionState.token]);
  useEffect(() => setAppId(connectionState.appId || REGISTERED_DERIV_APP_ID), [connectionState.appId]);

  const navItems = [
    { id: 'system_auto_live', label: 'System Auto Live', icon: Radio },
    { id: 'candle_analysis', label: 'Candle Analysis', icon: BarChart2 },
    { id: 'live_analyzer', label: 'Live Market Analyzer', icon: Activity },
    { id: 'terminal', label: 'System Auto Terminal', icon: Zap },
    { id: 'higher_lower_hedging', label: 'Higher/Lower Hedging', icon: GitFork },
    { id: 'deriv_digit', label: 'Deriv Digit Interface', icon: Percent },
    { id: 'dbot', label: 'DBot Studio', icon: SlidersHorizontal },
    { id: 'botstore', label: 'Bot Store', icon: Bot },
    { id: 'scanner', label: 'Market Scanner', icon: Radar },
    { id: 'autotrader', label: 'Auto Trader', icon: Rocket },
    { id: 'copy', label: 'Copy Trading', icon: Shield },
    { id: 'copilot', label: 'AI Copilot', icon: Key },
    { id: 'tools', label: 'P2P & Risk Tools', icon: Wallet },
  ];

  const handleConnect = () => onUpdateConnection(appId.trim() || REGISTERED_DERIV_APP_ID, token.trim());

  const handleToggleDemoSwitch = () => {
    if (onToggleTestMode) {
      onToggleTestMode(!isTestMode);
    }
  };

  const getLayoutLabel = (id: AppLayoutId) => {
    switch (id) {
      case 'pro_terminal':
        return 'Pro Terminal';
      case 'digit_specialist':
        return 'Digit Specialist';
      case 'bot_operator':
        return 'Bot Operator';
      case 'multi_market_grid':
        return 'Quad Grid';
      default:
        return 'Pro Terminal';
    }
  };

  const isRealLive = connectionState.isAuthorized && connectionState.accountType === 'REAL' && !isTestMode;
  const isDerivDemoLive = connectionState.isAuthorized && connectionState.accountType === 'DEMO' && !isTestMode;

  return (
    <header className="bg-slate-900 border-b border-slate-800 text-white sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-3 py-3">
          <div className="flex items-center space-x-3 shrink-0">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-red-600 via-red-500 to-rose-400 flex items-center justify-center font-bold text-xl text-white shadow-lg shadow-red-900/30">M</div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-extrabold text-lg tracking-tight">MBOKO</span>
                <span className="text-xs font-bold px-2 py-0.5 rounded bg-red-950/80 border border-red-700/50 text-red-400 tracking-wider">AUTO STEPS</span>
              </div>
              <p className="text-[11px] text-slate-400 hidden sm:block">Live WebSocket Trading Terminal</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 justify-end">

            {/* 24/7 Live Bot Active Indicator & Quick Stop */}
            {liveBotRunning && (
              <div
                id="header-live-bot-indicator"
                onClick={() => setActiveTab && setActiveTab('system_auto_live')}
                className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-gradient-to-r from-emerald-950 via-slate-900 to-emerald-950 border border-emerald-500/80 text-emerald-300 shadow-lg shadow-emerald-950/60 cursor-pointer hover:border-emerald-400 transition-all animate-pulse"
                title="System Auto Live is actively trading in the background. Click to view panel."
              >
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-400" />
                </span>
                <div className="flex flex-col text-left leading-none">
                  <span className="text-[9px] uppercase font-black text-emerald-400 tracking-wider">
                    24/7 LIVE BOT
                  </span>
                  <span className="text-[11px] font-black text-white font-mono mt-0.5">
                    {liveBotMarket} (RUNNING)
                  </span>
                </div>
                <button
                  type="button"
                  id="btn-header-stop-live-bot"
                  onClick={handleHeaderStopLiveBot}
                  className="ml-1 px-2.5 py-1 rounded-lg bg-red-600 hover:bg-red-500 text-white text-[10px] font-black tracking-wider uppercase shadow-md transition-all cursor-pointer"
                  title="Manually stop 24/7 Live Bot immediately"
                >
                  STOP
                </button>
              </div>
            )}

            {/* Strategy Shield & Anti-Manipulation Protection Button */}
            <button
              id="btn-open-strategy-shield"
              onClick={onOpenShieldModal}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all shadow-md ${
                circuitBreakerSec > 0
                  ? 'bg-rose-950/90 border-rose-500 text-rose-300 animate-pulse shadow-rose-950/50'
                  : shieldConfig.enabled
                  ? 'bg-emerald-950/80 border-emerald-500/80 text-emerald-300 hover:bg-emerald-900/90 shadow-emerald-950/40'
                  : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-white'
              }`}
              title="Strategy Shield & Anti-Manipulation Protection: Click to configure anti-fingerprint jitter, latency guard, stake fuzzing, and circuit breakers."
            >
              <div className="flex items-center gap-1.5">
                {circuitBreakerSec > 0 ? (
                  <ShieldAlert className="w-3.5 h-3.5 text-rose-400 animate-bounce" />
                ) : shieldConfig.enabled ? (
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <Shield className="w-3.5 h-3.5 text-slate-500" />
                )}
                <div className="flex flex-col text-left">
                  <span className="text-[9px] uppercase tracking-wider text-slate-400 font-extrabold leading-none">
                    Strategy Shield
                  </span>
                  <span className="text-[11px] font-black leading-tight flex items-center gap-1">
                    {circuitBreakerSec > 0 ? (
                      <span className="text-rose-400 font-mono">PAUSED ({circuitBreakerSec}s)</span>
                    ) : shieldConfig.enabled ? (
                      <span className="text-emerald-300 flex items-center gap-1">
                        ARMED <span className="text-[10px] text-emerald-400/80 font-mono">({shieldPing}ms)</span>
                      </span>
                    ) : (
                      <span className="text-slate-500">STANDBY</span>
                    )}
                  </span>
                </div>
              </div>
              <span className={`text-[9px] px-1.5 py-0.5 rounded font-black ${
                circuitBreakerSec > 0
                  ? 'bg-rose-500 text-white'
                  : shieldConfig.enabled
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                  : 'bg-slate-800 text-slate-400'
              }`}>
                SHIELD
              </span>
            </button>

            {/* Interactive Layout Switcher Button */}
            <button
              id="btn-open-layout-selector"
              onClick={onOpenLayoutModal}
              className="flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-amber-950/80 to-slate-900 hover:from-amber-900 hover:to-slate-850 border border-amber-600/50 hover:border-amber-500 rounded-xl text-xs font-bold text-amber-300 shadow-md transition-all group"
              title="Click to explore and switch workspace layouts"
            >
              <LayoutGrid className="w-4 h-4 text-amber-400 group-hover:rotate-90 transition-transform" />
              <div className="flex flex-col items-start text-left">
                <span className="text-[9px] text-amber-400/80 uppercase font-black tracking-wider leading-none">Layout</span>
                <span className="text-[11px] font-black text-white leading-tight">{getLayoutLabel(currentLayout)}</span>
              </div>
              <span className="ml-1 text-[9px] px-1.5 py-0.5 rounded bg-amber-500 text-slate-950 font-black">CHOOSE</span>
            </button>

            {/* Strategy Testing Switch (when authorized) */}
            {connectionState.isAuthorized && (
              <button
                id="btn-toggle-demo-switch"
                onClick={handleToggleDemoSwitch}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all shadow-md ${
                  isTestMode
                    ? 'bg-amber-950/80 border-amber-500 text-amber-300 hover:bg-amber-900/90 shadow-amber-950/40'
                    : isRealLive
                    ? 'bg-emerald-950/80 border-emerald-500 text-emerald-300 hover:bg-emerald-900/90 shadow-emerald-950/40'
                    : 'bg-amber-950/80 border-amber-500/80 text-amber-300 hover:bg-amber-900/90 shadow-amber-950/40'
                }`}
                title={
                  isTestMode
                    ? 'Test Simulation Active: Simulated trades executed against real live Deriv tick stream. Click to execute live on your Deriv account.'
                    : `Live Execution Active: Orders executed directly on Deriv account (${connectionState.loginid || connectionState.accountType}). Click to test strategies safely in simulation.`
                }
              >
                <div className="flex items-center gap-1.5">
                  <FlaskConical className={`w-3.5 h-3.5 ${isTestMode ? 'text-amber-400 animate-bounce' : 'text-slate-400'}`} />
                  <div className="flex flex-col text-left">
                    <span className="text-[9px] uppercase tracking-wider text-slate-400 font-extrabold leading-none">Trading Mode</span>
                    <span className="text-[11px] font-black leading-tight flex items-center gap-1">
                      {isTestMode ? (
                        <span className="text-amber-300">TEST SIMULATOR</span>
                      ) : isRealLive ? (
                        <span className="text-emerald-300">REAL LIVE ORDER</span>
                      ) : (
                        <span className="text-amber-300">DERIV DEMO ORDER</span>
                      )}
                    </span>
                  </div>
                </div>

                <div
                  className={`w-9 h-5 rounded-full p-0.5 transition-colors relative flex items-center ${
                    isTestMode ? 'bg-amber-600' : 'bg-emerald-600'
                  }`}
                >
                  <div
                    className={`w-4 h-4 rounded-full bg-white shadow-sm transform transition-transform ${
                      isTestMode ? 'translate-x-0' : 'translate-x-4'
                    }`}
                  />
                </div>
              </button>
            )}

            {/* Account Status Badge */}
            <div className={`flex items-center space-x-2 px-3 py-1.5 rounded-xl text-xs font-semibold border ${
              connectionState.isAuthorized
                ? isRealLive
                  ? 'bg-emerald-950/90 border-emerald-500/80 text-emerald-300'
                  : 'bg-amber-950/90 border-amber-500/80 text-amber-300'
                : connectionState.isConnecting
                ? 'bg-blue-950/90 border-blue-500 text-blue-300 animate-pulse'
                : 'bg-slate-800/90 border-slate-700/80 text-slate-300'
            }`}>
              <span className={`w-2 h-2 rounded-full ${
                connectionState.isAuthorized
                  ? isRealLive
                    ? 'bg-emerald-400 animate-pulse'
                    : 'bg-amber-400 animate-pulse'
                  : connectionState.isConnecting
                  ? 'bg-blue-400 animate-ping'
                  : 'bg-slate-500'
              }`} />
              <div className="flex flex-col text-left leading-tight">
                <span className="text-[9px] uppercase font-black tracking-wider text-slate-400">Account</span>
                <span className="text-[11px] font-black">
                  {connectionState.isAuthorized
                    ? `${connectionState.accountType === 'REAL' ? '🟢 REAL' : '🟡 DEMO'} ${connectionState.loginid || ''}${derivNickname ? ` • ${derivNickname}` : ''}`
                    : connectionState.isConnecting
                    ? 'Connecting to Deriv…'
                    : 'Practice Simulation'}
                </span>
              </div>
            </div>

            {/* Connect / Disconnect Controls */}
            {connectionState.isAuthorized ? (
              <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-700/80 rounded-xl p-1">
                {/* Active Server Indicator & Quick Toggle */}
                <button
                  type="button"
                  onClick={() => {
                    const ep = derivWS.switchToNextEndpoint();
                    derivWS.connect(connectionState.appId, connectionState.token);
                  }}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-emerald-400 hover:text-white bg-slate-900 hover:bg-slate-800 text-[10px] font-mono border border-slate-800 transition-colors"
                  title={`Active Deriv Server: ${currentEndpoint.name}. Click to switch server endpoint.`}
                >
                  <Globe className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="font-bold">{currentEndpoint.id === 'binaryws' ? 'Mirror' : currentEndpoint.id === 'primary' ? 'Primary' : currentEndpoint.id}</span>
                </button>

                {onOpenTokenModal && (
                  <button
                    onClick={onOpenTokenModal}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-slate-300 hover:text-white bg-slate-900 hover:bg-slate-800 text-[11px] font-bold transition-all border border-slate-800"
                    title="Deriv API Token & Security Configuration"
                  >
                    <Key className="w-3.5 h-3.5 text-amber-400" />
                    <span>Token Info</span>
                  </button>
                )}
                {onDisconnect && (
                  <button
                    onClick={onDisconnect}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-rose-950/60 hover:bg-rose-900 border border-rose-800/80 text-rose-300 text-[11px] font-bold transition-all"
                    title="Disconnect account and clear token"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Disconnect</span>
                  </button>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-1 bg-slate-950 border border-slate-700 rounded-xl p-1">
                {/* Server Endpoint Switcher */}
                <button
                  type="button"
                  onClick={() => {
                    derivWS.switchToNextEndpoint();
                    derivWS.connect(appId.trim() || REGISTERED_DERIV_APP_ID, token.trim());
                  }}
                  className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-emerald-400 hover:text-white bg-slate-900 hover:bg-slate-800 text-[10px] font-mono border border-slate-800 transition-colors"
                  title={`Current Server: ${currentEndpoint.name}. Click to switch endpoint (e.g. Deriv Mirror for ISP bypass).`}
                >
                  <Globe className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="hidden sm:inline font-bold">{currentEndpoint.id === 'binaryws' ? 'Mirror' : 'Primary'}</span>
                </button>

                <input
                  value={appId}
                  onChange={(e) => setAppId(e.target.value)}
                  placeholder="App ID (34O00AdC2O6jw2JRyd0WG)"
                  className="w-24 sm:w-36 bg-transparent px-2 py-1.5 text-[11px] font-mono text-slate-300 outline-none"
                  aria-label="Deriv App ID"
                />
                <input
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  type={showToken ? 'text' : 'password'}
                  placeholder="Paste Deriv API Token"
                  className="w-36 sm:w-52 bg-transparent px-2 py-1.5 text-[11px] font-mono text-white outline-none"
                  aria-label="Deriv API token"
                  autoComplete="off"
                />
                <button
                  type="button"
                  onClick={() => setShowToken((v) => !v)}
                  className="px-2 py-1.5 text-[10px] text-slate-400 hover:text-white"
                  title={showToken ? 'Hide token' : 'Show token'}
                >
                  {showToken ? 'HIDE' : 'SHOW'}
                </button>
                <button
                  type="button"
                  onClick={handleConnect}
                  disabled={(!token.trim() && !appId.trim()) || connectionState.isConnecting}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-[11px] font-extrabold rounded-lg flex items-center gap-1 transition-all"
                >
                  {connectionState.isConnecting ? (
                    <RefreshCw className="w-3 h-3 animate-spin" />
                  ) : (
                    <Link2 className="w-3 h-3" />
                  )}
                  {connectionState.isConnecting ? 'Connecting…' : 'Connect'}
                </button>
                {onOpenTokenModal && (
                  <button
                    type="button"
                    onClick={onOpenTokenModal}
                    className="p-1.5 text-slate-400 hover:text-amber-400 hover:bg-slate-900 rounded-lg"
                    title="Open API Token Security Guide & Help"
                  >
                    <Key className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            )}

            {connectionState.isAuthorized && availableAccounts.filter((a) => a.account && a.account !== 'Manual_Token').length > 1 && onSelectAccount && (
              <select
                value={connectionState.token || ''}
                onChange={(e) => { const account = availableAccounts.find((a) => a.token === e.target.value); if (account) onSelectAccount(account); }}
                className="bg-slate-800 border border-slate-700 rounded-xl px-2.5 py-2 text-xs text-emerald-300 font-mono max-w-[150px]"
              >
                {availableAccounts.filter((a) => a.account && a.account !== 'Manual_Token').map((acc, idx) => <option key={idx} value={acc.token}>{acc.type === 'REAL' ? 'REAL' : 'DEMO'}: {acc.account}</option>)}
              </select>
            )}

            {/* Wallet Balance Display */}
            <div className="flex items-center bg-slate-800/90 border border-slate-700/80 rounded-xl px-3 py-1.5 space-x-2">
              <Wallet className="w-4 h-4 text-emerald-400" />
              <div>
                <div className="text-[10px] text-slate-400 uppercase font-semibold">
                  {connectionState.isAuthorized
                    ? connectionState.accountType === 'REAL'
                      ? `REAL LIVE • ${connectionState.currency}`
                      : `DERIV DEMO • ${connectionState.currency}`
                    : `PRACTICE SIMULATION • ${connectionState.currency}`}
                </div>
                <div className="font-mono font-bold text-sm text-emerald-400">
                  {connectionState.balanceUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>
              {!connectionState.isAuthorized && (
                <button
                  onClick={onResetDemoBalance}
                  title="Reset practice balance to $10,000"
                  className="p-1 text-slate-400 hover:text-amber-300 transition-colors"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {onOAuthRedirect && <button onClick={() => onOAuthRedirect(connectionState.appId)} className="px-3 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-bold rounded-xl">Deriv OAuth</button>}
            <button onClick={() => setShowInstallModal(true)} className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl"><Download className="w-4 h-4" /> Install</button>
          </div>
        </div>

        {/* Clear & Dismissible Connection Notice Banner with Failover Trigger */}
        {connectionState.authError && (
          <div className={`mb-2 px-4 py-3 rounded-xl border text-xs font-medium flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-lg animate-fade-in ${
            connectionState.authError.includes('switched to') || connectionState.authError.includes('Connected to')
              ? 'bg-emerald-950/80 border-emerald-600/80 text-emerald-200'
              : 'bg-rose-950/90 border-rose-700 text-rose-200'
          }`}>
            <div className="flex items-start md:items-center gap-2.5">
              {connectionState.authError.includes('switched to') || connectionState.authError.includes('Connected to') ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5 md:mt-0" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5 md:mt-0" />
              )}
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold">
                    {connectionState.authError.includes('switched to') ? 'Failover Connected:' : 'Notice:'}
                  </span>
                  <span>{connectionState.authError}</span>
                </div>
                <span className="text-slate-300 block text-[11px] mt-1 font-mono">
                  Active Server: <strong className="text-emerald-300">{currentEndpoint.name}</strong> • App ID: <strong className="text-white">{REGISTERED_DERIV_APP_ID}</strong>
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0 self-end md:self-auto">
              <button
                type="button"
                onClick={() => {
                  const next = derivWS.switchToNextEndpoint();
                  derivWS.connect(appId.trim() || REGISTERED_DERIV_APP_ID, token.trim());
                }}
                className="text-xs px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-bold transition-colors flex items-center gap-1 border border-slate-700"
                title="Switch to next Deriv WebSocket endpoint"
              >
                <RefreshCw className="w-3 h-3" />
                <span>Switch Server</span>
              </button>
              {onClearAuthError && (
                <button
                  type="button"
                  onClick={onClearAuthError}
                  className="text-xs px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold shrink-0 transition-colors border border-slate-700"
                >
                  Dismiss
                </button>
              )}
            </div>
          </div>
        )}

        {/* Navigation Tabs + Direct Layout Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-t border-slate-800/80 py-2 gap-2">
          <div className="flex space-x-1 overflow-x-auto no-scrollbar">
            {navItems.map((item) => {
              const Icon = item.icon;
              return <button key={item.id} onClick={() => setActiveTab(item.id)} className={`flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${activeTab === item.id ? 'bg-red-600 text-white shadow-md shadow-red-900/20' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'}`}><Icon className="w-4 h-4" /><span>{item.label}</span></button>;
            })}
          </div>

          {/* Direct Quick Layout Pill Switcher */}
          <div className="hidden lg:flex items-center gap-1 bg-slate-950 border border-slate-800 rounded-xl p-1 shrink-0">
            <span className="text-[10px] font-bold text-slate-500 px-2 uppercase">Layout:</span>
            <button
              onClick={() => onSelectLayout('pro_terminal')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${
                currentLayout === 'pro_terminal'
                  ? 'bg-amber-500 text-slate-950 font-black'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Pro Trader Terminal"
            >
              Pro Terminal
            </button>
            <button
              onClick={() => onSelectLayout('digit_specialist')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${
                currentLayout === 'digit_specialist'
                  ? 'bg-red-600 text-white font-black'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Digit Specialist & Circle Radar"
            >
              Circles Radar
            </button>
            <button
              onClick={() => onSelectLayout('bot_operator')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${
                currentLayout === 'bot_operator'
                  ? 'bg-cyan-500 text-slate-950 font-black'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="DBot Algorithmic Command"
            >
              Bot Operator
            </button>
            <button
              onClick={() => onSelectLayout('multi_market_grid')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${
                currentLayout === 'multi_market_grid'
                  ? 'bg-emerald-500 text-slate-950 font-black'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Quad Multi-Market Grid"
            >
              Quad Grid
            </button>
          </div>
        </div>
      </div>
      <InstallAppModal isOpen={showInstallModal} onClose={() => setShowInstallModal(false)} />
    </header>
  );
};

