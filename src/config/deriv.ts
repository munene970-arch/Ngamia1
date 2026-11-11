/**
 * Deriv application configuration.
 *
 * The public WebSocket API can use App ID 1089 for token-based account
 * connections. OAuth continues to use the registered application ID.
 */
export const DERIV_WEBSOCKET_APP_ID = '1089';

export const REGISTERED_DERIV_APP_ID =
  (typeof import.meta !== 'undefined' && (import.meta as any).env && (import.meta as any).env.VITE_DERIV_APP_ID)
    ? (import.meta as any).env.VITE_DERIV_APP_ID
    : '1089';

export const STING_REDIRECT_URI =
  (typeof import.meta !== 'undefined' && (import.meta as any).env && (import.meta as any).env.VITE_DERIV_REDIRECT_URI)
    ? (import.meta as any).env.VITE_DERIV_REDIRECT_URI
    : 'https://munene970-arch.github.io/kaongo-1/';

export const DERIV_OAUTH_SCOPE = 'trade';

export interface DerivEndpointConfig {
  id: string;
  name: string;
  host: string;
  description: string;
  isMirror?: boolean;
}

export const DERIV_WEBSOCKET_ENDPOINTS: DerivEndpointConfig[] = [
  {
    id: 'primary',
    name: 'Deriv Primary (ws.derivws.com)',
    host: 'ws.derivws.com',
    description: 'Standard global WebSocket gateway',
  },
  {
    id: 'binaryws',
    name: 'Deriv Mirror (ws.binaryws.com)',
    host: 'ws.binaryws.com',
    description: 'Anycast mirror gateway (bypasses ISP & Cloudflare 1006 blocks)',
    isMirror: true,
  },
  {
    id: 'frontend',
    name: 'Deriv Frontend (frontend.derivws.com)',
    host: 'frontend.derivws.com',
    description: 'Frontend cluster gateway',
  },
  {
    id: 'green',
    name: 'Deriv Green Gateway (green.derivws.com)',
    host: 'green.derivws.com',
    description: 'Secondary regional cluster',
  },
];

export const getDerivRedirectUri = (): string => {
  if (typeof window !== 'undefined' && window.location && window.location.origin) {
    const current = `${window.location.origin}${window.location.pathname}`;
    // If user explicitly configured an environment variable, honor it
    if ((import.meta as any).env?.VITE_DERIV_REDIRECT_URI) {
      return (import.meta as any).env.VITE_DERIV_REDIRECT_URI;
    }
    return current;
  }
  return STING_REDIRECT_URI;
};

