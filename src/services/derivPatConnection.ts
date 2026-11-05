export interface DerivPatAccount {
  account_id: string;
  loginid: string;
  balance: string;
  currency: string;
  is_virtual: boolean;
  account_type: string;
}

type Credentials = { appId: string; pat: string };
let credentials: Credentials | null = null;

/** PAT credentials remain in this module's memory only. */
export function setDerivPatCredentials(appId: string, pat: string): void {
  credentials = { appId: appId.trim(), pat: pat.trim() };
}

export function clearDerivPatCredentials(): void {
  credentials = null;
}

export function hasDerivPatCredentials(): boolean {
  return Boolean(credentials?.appId && credentials?.pat);
}

async function post<T>(path: string, payload: Record<string, string>): Promise<T> {
  const response = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(payload),
    cache: 'no-store',
    credentials: 'same-origin',
  });
  const body = await response.text();
  let data: any;
  try { data = JSON.parse(body); } catch { throw new Error(body || `Deriv request failed (${response.status}).`); }
  if (!response.ok || data?.success === false) {
    throw new Error(data?.error || `Deriv request failed (${response.status}).`);
  }
  return data as T;
}

export async function fetchDerivPatAccounts(appId: string, pat: string): Promise<DerivPatAccount[]> {
  const cleanAppId = appId.trim();
  const cleanPat = pat.trim();
  if (!/^\\d{1,12}$/.test(cleanAppId)) throw new Error('Enter your numeric Deriv App ID.');
  if (cleanPat.length < 10 || cleanPat.length > 4096) throw new Error('Enter a valid Deriv Personal Access Token.');
  const data = await post<{ success: boolean; accounts: DerivPatAccount[] }>('/api/deriv-pat-accounts', {
    app_id: cleanAppId, pat: cleanPat,
  });
  if (!Array.isArray(data.accounts) || data.accounts.length === 0) {
    throw new Error('No Deriv accounts were returned for this PAT.');
  }
  setDerivPatCredentials(cleanAppId, cleanPat);
  return data.accounts;
}

export async function fetchDerivPatOtpUrl(accountId: string): Promise<string> {
  if (!credentials) throw new Error('Enter your Deriv App ID and PAT again to reconnect.');
  if (!accountId || accountId.length > 128) throw new Error('Select a valid Deriv account.');
  const data = await post<{ success: boolean; url: string }>('/api/deriv-pat-otp', {
    app_id: credentials.appId, pat: credentials.pat, account_id: accountId,
  });
  const url = new URL(data.url);
  if (url.protocol !== 'wss:' || !(url.hostname === 'derivws.com' || url.hostname.endsWith('.derivws.com'))) {
    throw new Error('Deriv returned an unexpected WebSocket address.');
  }
  return url.toString();
}
