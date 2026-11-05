import React, { useState } from 'react';
import { DerivPatAccount, clearDerivPatCredentials, fetchDerivPatAccounts, hasDerivPatCredentials, setDerivPatCredentials } from '../services/derivPatConnection';

interface Props {
  onConnectAccount: (account: DerivPatAccount, appId: string) => void;
  isConnecting?: boolean;
  isConnected?: boolean;
  onDisconnect: () => void;
}

export const DerivPatConnector: React.FC<Props> = ({ onConnectAccount, isConnecting = false, isConnected = false, onDisconnect }) => {
  const [open, setOpen] = useState(false);
  const [appId, setAppId] = useState('');
  const [pat, setPat] = useState('');
  const [accounts, setAccounts] = useState<DerivPatAccount[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');

  const loadAccounts = async () => {
    setError('');
    setStatus('');
    setBusy(true);
    try {
      const rows = await fetchDerivPatAccounts(appId, pat);
      setAccounts(rows);
      const preferred = rows.find(account => account.is_virtual) || rows[0];
      setSelectedId(preferred.account_id);
      setStatus(`Loaded ${rows.length} account(s). Select an account to connect.`);
    } catch (e) {
      clearDerivPatCredentials();
      setAccounts([]);
      setSelectedId('');
      setStatus('');
      setError(e instanceof Error ? e.message : 'Could not load Deriv accounts.');
    } finally {
      setBusy(false);
    }
  };

  const connectSelected = () => {
    const account = accounts.find(item => item.account_id === selectedId);
    if (!account) {
      setError('Select a Deriv account first.');
      return;
    }
    setError('');
    if (pat.trim()) setDerivPatCredentials(appId, pat);
    if (!hasDerivPatCredentials()) {
      setError('Re-enter your PAT and load accounts before connecting.');
      return;
    }
    onConnectAccount(account, appId.trim());
    setPat('');
    setStatus(`Connecting to ${account.loginid || account.account_id}…`);
  };

  return (
    <div className="fixed right-4 top-24 z-[70]">
      <button type="button" onClick={() => setOpen(value => !value)}
        className="rounded-xl border border-emerald-500/50 bg-emerald-700 px-3 py-2 text-xs font-extrabold text-white shadow-lg">
        {open ? 'Close PAT connection' : 'Connect Deriv with PAT'}
      </button>
      {open && (
        <section aria-label="Deriv Personal Access Token connection"
          className="mt-2 w-[min(390px,calc(100vw-2rem))] max-h-[75vh] overflow-y-auto rounded-2xl border border-slate-700 bg-slate-900 p-4 text-white shadow-2xl">
          <h2 className="text-base font-extrabold">Deriv account connection</h2>
          <p className="mt-1 text-xs text-slate-400">Enter your App ID and Personal Access Token. Credentials are kept in memory and sent only to this app's HTTPS backend.</p>
          <label className="mt-4 block text-xs font-semibold text-slate-300">Deriv App ID
            <input value={appId} onChange={e => setAppId(e.target.value)} inputMode="numeric" autoComplete="off"
              placeholder="Numeric App ID" className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white" />
          </label>
          <label className="mt-3 block text-xs font-semibold text-slate-300">Personal Access Token
            <input value={pat} onChange={e => setPat(e.target.value)} type="password" autoComplete="off"
              placeholder="Paste your Deriv PAT" className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white" />
          </label>
          <button type="button" onClick={loadAccounts} disabled={busy || isConnecting || !appId.trim() || !pat.trim()}
            className="mt-3 w-full rounded-lg bg-emerald-600 px-3 py-2 text-sm font-bold text-white disabled:opacity-50">
            {busy ? 'Loading accounts…' : 'Connect and load accounts'}
          </button>
          {accounts.length > 0 && <>
            <label className="mt-4 block text-xs font-semibold text-slate-300">Choose account
              <select value={selectedId} onChange={e => setSelectedId(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white">
                {accounts.map(account => <option key={account.account_id} value={account.account_id}>
                  {account.loginid || account.account_id} · {account.is_virtual ? 'DEMO' : 'REAL'} · {account.balance} {account.currency}
                </option>)}
              </select>
            </label>
            <button type="button" onClick={connectSelected} disabled={busy || isConnecting}
              className="mt-3 w-full rounded-lg bg-amber-500 px-3 py-2 text-sm font-extrabold text-slate-950 disabled:opacity-50">
              {isConnecting ? 'Connecting…' : 'Connect selected account'}
            </button>
          </>}
          {(isConnected || accounts.length > 0) && <button type="button" onClick={onDisconnect} className="mt-3 w-full rounded-lg border border-rose-500/50 bg-rose-950/50 px-3 py-2 text-xs font-bold text-rose-200">Disconnect and clear PAT</button>}
          {status && <p role="status" className="mt-3 text-xs text-emerald-300">{status}</p>}
          {error && <p role="alert" className="mt-3 text-xs text-rose-300">{error}</p>}
          <p className="mt-3 text-[11px] leading-relaxed text-slate-400">The PAT is not saved in localStorage, sessionStorage, cookies, or URLs. After a page refresh, enter it again. Test on DEMO before using a REAL account.</p>
        </section>
      )}
    </div>
  );
};
