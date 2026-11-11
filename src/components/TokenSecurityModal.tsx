import React, { useState } from 'react';
import { ShieldCheck, Lock, Eye, EyeOff, ExternalLink, Key, CheckCircle2, AlertTriangle, X, Trash2, Server, Copy, Check, Globe, RefreshCw } from 'lucide-react';
import { parseDerivOAuthInput } from '../utils/derivOAuth';
import { REGISTERED_DERIV_APP_ID, STING_REDIRECT_URI, getDerivRedirectUri, DERIV_WEBSOCKET_ENDPOINTS, DerivEndpointConfig } from '../config/deriv';
import { derivWS } from '../services/derivWebSocket';

interface TokenSecurityModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentToken?: string | null;
  currentAppId?: string;
  activeScopes?: string[];
  activeEndpoint?: string;
  onSaveToken: (token: string, appId: string, remember: boolean) => void;
  onClearToken: () => void;
}

export const TokenSecurityModal: React.FC<TokenSecurityModalProps> = ({
  isOpen,
  onClose,
  currentToken,
  currentAppId = REGISTERED_DERIV_APP_ID,
  activeScopes = ['read', 'trade'],
  activeEndpoint = 'wss://ws.derivws.com/websockets/v3',
  onSaveToken,
  onClearToken,
}) => {
  const [tokenInput, setTokenInput] = useState(currentToken || '');
  const [showToken, setShowToken] = useState(false);
  const [rememberToken, setRememberToken] = useState(false);
  const [pasteError, setPasteError] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard?.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPasteError(null);

    let clean = tokenInput.trim();
    if (!clean) {
      setPasteError('Please enter a valid Deriv API token or paste a Deriv OAuth URL.');
      return;
    }

    // Try parsing if user pasted full URL or query string
    const parsed = parseDerivOAuthInput(clean);
    if (parsed.length > 0) {
      clean = parsed[0].token;
    } else {
      clean = clean.replace(/^bearer\s+/i, '').replace(/['"\r\n\t\s]/g, '');
    }

    onSaveToken(clean, REGISTERED_DERIV_APP_ID, rememberToken);
    onClose();
  };

  const hasRead = activeScopes.includes('read');
  const hasTrade = activeScopes.includes('trade');
  const hasPayments = activeScopes.includes('payments');
  const hasAdmin = activeScopes.includes('admin');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-xl w-full p-6 shadow-2xl space-y-6 relative overflow-hidden max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white shadow-lg shadow-emerald-950/50">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-extrabold text-white flex items-center gap-2">
                <span>Deriv API Token & Security Settings</span>
              </h2>
              <p className="text-xs text-slate-400">
                Encrypted WebSocket (WSS) & Scoped Token Permissions
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white bg-slate-800/80 hover:bg-slate-800 rounded-xl transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Secure HTTPS & WSS Banner with Multi-Endpoint Switcher */}
        <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between text-xs font-bold text-slate-200">
            <div className="flex items-center space-x-2">
              <Lock className="w-4 h-4 text-emerald-400" />
              <span>TLS / SSL 256-Bit Encrypted Connections</span>
            </div>
            <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded text-[10px] font-extrabold uppercase">
              WSS Active
            </span>
          </div>

          <div className="text-[11px] text-slate-400 space-y-2 bg-slate-900/80 p-3 rounded-xl border border-slate-800 font-mono">
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Protocol:</span>
              <span className="text-emerald-400 font-bold">WSS (WebSocket Secure)</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Active Server:</span>
              <span className="text-white font-bold">{derivWS.getCurrentEndpoint().name}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Active Endpoint:</span>
              <span className="text-slate-200 truncate max-w-[260px]">{activeEndpoint}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Registered App ID:</span>
              <span className="text-emerald-300 font-bold">{REGISTERED_DERIV_APP_ID}</span>
            </div>
          </div>

          {/* Deriv Server Endpoint Selector (Fix for Error 1006) */}
          <div className="space-y-2 pt-1">
            <div className="flex items-center justify-between text-[11px] font-bold text-slate-300">
              <span className="flex items-center gap-1.5">
                <Server className="w-3.5 h-3.5 text-cyan-400" />
                <span>Deriv Gateway Server Selector</span>
              </span>
              <span className="text-[10px] text-amber-400 font-medium">Bypass ISP & 1006 Blocks</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
              {DERIV_WEBSOCKET_ENDPOINTS.map((ep) => {
                const isActive = derivWS.getCurrentEndpoint().id === ep.id;
                return (
                  <button
                    key={ep.id}
                    type="button"
                    onClick={() => {
                      derivWS.setEndpoint(ep.id);
                    }}
                    className={`p-2.5 rounded-xl border text-left transition-all ${
                      isActive
                        ? 'bg-emerald-950/60 border-emerald-500/80 text-emerald-200 shadow-md shadow-emerald-950/30'
                        : 'bg-slate-900/80 hover:bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold flex items-center gap-1.5">
                        <span className={`w-2 h-2 rounded-full ${isActive ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'}`} />
                        {ep.name.split(' ')[1] || ep.name}
                      </span>
                      {isActive && <span className="text-[9px] font-black uppercase text-emerald-400 bg-emerald-950 px-1.5 py-0.5 rounded border border-emerald-500/40">ACTIVE</span>}
                    </div>
                    <div className="text-[10px] text-slate-400 mt-1 truncate font-mono">{ep.host}</div>
                    <div className="text-[10px] text-slate-500 mt-0.5 leading-tight">{ep.description}</div>
                  </button>
                );
              })}
            </div>
            <p className="text-[10px] text-slate-400 leading-normal bg-slate-900/50 p-2 rounded-lg border border-slate-800/60">
              💡 <strong className="text-slate-300">Error 1006 Solution:</strong> If your local internet service provider (ISP) or network firewall blocks <code className="text-emerald-400">ws.derivws.com</code>, switch to <strong className="text-white">Deriv Mirror (<code className="text-emerald-400">ws.binaryws.com</code>)</strong>. It operates on identical trading protocols and bypasses regional Cloudflare drops.
            </p>
          </div>
        </div>

        {/* Deriv App Registration & Redirect URIs */}
        <div className="bg-slate-950/90 border border-slate-800 rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-white flex items-center space-x-2">
              <Globe className="w-4 h-4 text-emerald-400" />
              <span>Deriv App Registration & Redirect URIs</span>
            </h3>
            <a
              href="https://api.deriv.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] font-bold text-red-400 hover:text-red-300 underline flex items-center space-x-1"
            >
              <span>Register at api.deriv.com</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>

          <p className="text-[11px] text-slate-400 leading-relaxed">
            When registering your application on the Deriv Developer Dashboard (<code className="text-slate-300">api.deriv.com</code>), use the redirect URL below:
          </p>

          <div className="space-y-2">
            <div className="bg-slate-900 border border-slate-800 p-2.5 rounded-xl space-y-1">
              <div className="flex items-center justify-between text-[10px] text-slate-400 font-bold uppercase">
                <span>Current App Redirect URL (Active)</span>
                {copiedKey === 'current' ? (
                  <span className="text-emerald-400 flex items-center gap-1 font-bold">
                    <Check className="w-3 h-3" /> Copied!
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleCopy(getDerivRedirectUri(), 'current')}
                    className="text-slate-400 hover:text-white flex items-center gap-1"
                  >
                    <Copy className="w-3 h-3" /> Copy
                  </button>
                )}
              </div>
              <div className="font-mono text-[11px] text-emerald-300 break-all bg-slate-950 p-1.5 rounded border border-slate-800">
                {getDerivRedirectUri()}
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-2.5 rounded-xl space-y-1">
              <div className="flex items-center justify-between text-[10px] text-slate-400 font-bold uppercase">
                <span>GitHub Pages / Production Fallback URL</span>
                {copiedKey === 'github' ? (
                  <span className="text-emerald-400 flex items-center gap-1 font-bold">
                    <Check className="w-3 h-3" /> Copied!
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleCopy(STING_REDIRECT_URI, 'github')}
                    className="text-slate-400 hover:text-white flex items-center gap-1"
                  >
                    <Copy className="w-3 h-3" /> Copy
                  </button>
                )}
              </div>
              <div className="font-mono text-[11px] text-slate-300 break-all bg-slate-950 p-1.5 rounded border border-slate-800">
                {STING_REDIRECT_URI}
              </div>
            </div>
          </div>
        </div>

        {/* Permission Scopes Audit (Minimal Required Scopes) */}
        <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-200 flex items-center space-x-2">
              <Key className="w-4 h-4 text-amber-400" />
              <span>Token Granted Permission Scopes</span>
            </h3>
            <a
              href="https://app.deriv.com/account/api-token"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] font-bold text-red-400 hover:text-red-300 underline flex items-center space-x-1"
            >
              <span>Get Token on Deriv</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>

          <p className="text-[11px] text-slate-400 leading-relaxed">
            Per Deriv security best practices, this trading terminal requires only <strong>Read</strong> & <strong>Trade</strong> permissions. Sensitive operations like deposits/withdrawals or account management are never requested.
          </p>

          <div className="grid grid-cols-2 gap-2 text-[11px]">
            <div className={`p-2.5 rounded-xl border flex items-center justify-between ${hasRead ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300' : 'bg-slate-900 border-slate-800 text-slate-400'}`}>
              <span className="font-bold flex items-center space-x-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Read Scope</span>
              </span>
              <span className="text-[10px] font-mono">{hasRead ? 'Granted' : 'Required'}</span>
            </div>

            <div className={`p-2.5 rounded-xl border flex items-center justify-between ${hasTrade ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300' : 'bg-slate-900 border-slate-800 text-slate-400'}`}>
              <span className="font-bold flex items-center space-x-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Trade Scope</span>
              </span>
              <span className="text-[10px] font-mono">{hasTrade ? 'Granted' : 'Required'}</span>
            </div>

            <div className={`p-2.5 rounded-xl border flex items-center justify-between ${hasPayments ? 'bg-amber-950/40 border-amber-500/40 text-amber-300' : 'bg-slate-900/60 border-slate-800/80 text-slate-500'}`}>
              <span className="font-semibold flex items-center space-x-1.5">
                <span>🛡️ Payments</span>
              </span>
              <span className="text-[10px] font-mono">Not Required</span>
            </div>

            <div className={`p-2.5 rounded-xl border flex items-center justify-between ${hasAdmin ? 'bg-amber-950/40 border-amber-500/40 text-amber-300' : 'bg-slate-900/60 border-slate-800/80 text-slate-500'}`}>
              <span className="font-semibold flex items-center space-x-1.5">
                <span>🛡️ Admin</span>
              </span>
              <span className="text-[10px] font-mono">Not Required</span>
            </div>
          </div>
        </div>

        {/* Token Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-300">
              Deriv API Token
            </label>
            <div className="relative flex items-center">
              <input
                type={showToken ? 'text' : 'password'}
                value={tokenInput}
                onChange={(e) => setTokenInput(e.target.value)}
                placeholder="e.g. a1b2c3d4e5f6g7h8..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-3 pr-10 py-2.5 text-xs text-white focus:outline-none focus:border-red-500 font-mono"
              />
              <button
                type="button"
                onClick={() => setShowToken(!showToken)}
                className="absolute right-3 text-slate-400 hover:text-white p-1"
                title={showToken ? 'Hide token' : 'Show token'}
              >
                {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 flex items-center justify-between text-xs">
            <span className="text-slate-400">Registered App ID:</span>
            <span className="text-emerald-400 font-mono font-bold bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
              {REGISTERED_DERIV_APP_ID} (Built-in)
            </span>
          </div>

          <div className="flex items-center justify-between text-xs text-slate-300 pt-1">
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={rememberToken}
                onChange={(e) => setRememberToken(e.target.checked)}
                className="rounded border-slate-700 bg-slate-950 text-emerald-500 focus:ring-emerald-500"
              />
              <span>Remember token for current session (SessionStorage)</span>
            </label>
          </div>

          {pasteError && (
            <div className="p-2.5 bg-red-950/60 border border-red-500/40 rounded-xl text-xs text-red-300 flex items-center space-x-2">
              <AlertTriangle className="w-4 h-4 flex-shrink-0 text-red-400" />
              <span>{pasteError}</span>
            </div>
          )}

          <div className="flex gap-2 pt-2">
            {currentToken && (
              <button
                type="button"
                onClick={() => {
                  onClearToken();
                  setTokenInput('');
                  onClose();
                }}
                className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-red-400 font-bold text-xs rounded-xl transition-colors flex items-center space-x-1.5"
              >
                <Trash2 className="w-4 h-4" />
                <span>Disconnect</span>
              </button>
            )}

            <button
              type="submit"
              className="flex-1 py-2.5 px-4 bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-600 hover:from-emerald-500 hover:to-teal-500 text-white font-extrabold text-xs rounded-xl shadow-lg shadow-emerald-950/50 flex items-center justify-center space-x-1.5 transition-all transform hover:scale-[1.01]"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>Connect Securely over WSS</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
