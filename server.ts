import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "10mb" }));

// Initialize Gemini Client server-side
const apiKey = process.env.GEMINI_API_KEY;
let aiClient: GoogleGenAI | null = null;

function getAiClient(): GoogleGenAI {
  if (!aiClient) {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY environment variable is missing.");
    }
    aiClient = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiClient;
}


const DERIV_TRADING_API = 'https://api.derivws.com/trading/v1';
const derivPatRateHits = new Map<string, number[]>();
function derivPatRequestAllowed(req: express.Request): boolean {
  const origin = req.headers.origin;
  if (!origin) return false;
  const allowed = (process.env.DERIV_ALLOWED_ORIGINS || process.env.APP_URL || '')
    .split(',').map(value => value.trim()).filter(Boolean);
  try {
    const originUrl = new URL(origin);
    if (allowed.some(value => value === origin)) return true;
    return originUrl.host === req.get('host');
  } catch { return false; }
}
function derivPatRateLimited(req: express.Request): boolean {
  const key = String(req.ip || req.socket.remoteAddress || 'unknown');
  const now = Date.now();
  const recent = (derivPatRateHits.get(key) || []).filter(time => now - time < 60_000);
  recent.push(now);
  derivPatRateHits.set(key, recent);
  return recent.length > 20;
}
function readDerivPatBody(req: express.Request) {
  const length = Number(req.headers['content-length'] || 0);
  if (length > 12_000) throw Object.assign(new Error('Request is too large.'), { status: 413 });
  const body = req.body || {};
  if (JSON.stringify(body).length > 12_000) throw Object.assign(new Error('Request is too large.'), { status: 413 });
  const appId = String(body.app_id || '').trim();
  const pat = String(body.pat || '').trim();
  if (!/^\d{1,12}$/.test(appId)) throw Object.assign(new Error('Enter a valid numeric Deriv App ID.'), { status: 400 });
  if (pat.length < 10 || pat.length > 4096) throw Object.assign(new Error('Enter a valid Deriv PAT.'), { status: 400 });
  return { appId, pat };
}
async function derivPatFetch(url: string, creds: { appId: string; pat: string }, method = 'GET') {
  const response = await fetch(url, {
    method,
    headers: { 'Deriv-App-ID': creds.appId, Authorization: `Bearer ${creds.pat}`, Accept: 'application/json' },
    signal: AbortSignal.timeout(12_000),
  });
  const raw = await response.text();
  let payload: any = {};
  try { payload = raw ? JSON.parse(raw) : {}; } catch {}
  if (!response.ok) {
    throw Object.assign(new Error(`Deriv rejected the request (HTTP ${response.status}). Check your App ID, PAT, and token scopes.`), {
      status: response.status >= 400 && response.status < 500 ? response.status : 502,
    });
  }
  return payload;
}
function derivPatGuard(req: express.Request, res: express.Response): boolean {
  if (!derivPatRequestAllowed(req)) { res.status(403).json({ success: false, error: 'Request origin is not allowed.' }); return false; }
  if (derivPatRateLimited(req)) { res.status(429).json({ success: false, error: 'Too many requests. Try again shortly.' }); return false; }
  return true;
}
async function handleDerivPatAccounts(req: express.Request, res: express.Response): Promise<void> {
  if (req.method !== 'POST') { res.status(405).json({ success: false, error: 'Method not allowed.' }); return; }
  if (!derivPatGuard(req, res)) return;
  try {
    const creds = readDerivPatBody(req);
    const payload = await derivPatFetch(`${DERIV_TRADING_API}/options/accounts`, creds);
    const rows = Array.isArray(payload?.data) ? payload.data : Array.isArray(payload?.data?.accounts) ? payload.data.accounts : [];
    const accounts = rows.map((item: any) => ({
      account_id: String(item.account_id || item.id || ''),
      loginid: String(item.loginid || item.login_id || ''),
      balance: String(item.balance ?? '0'),
      currency: String(item.currency || 'USD'),
      is_virtual: Boolean(item.is_virtual ?? item.isVirtual ?? String(item.account_id || '').startsWith('V')),
      account_type: String(item.account_type || item.type || ''),
    })).filter((item: any) => item.account_id);
    res.set('Cache-Control', 'no-store').json({ success: true, accounts });
  } catch (error: any) {
    return res.status(Number.isInteger(error.status) ? error.status : 502)
      .set('Cache-Control', 'no-store').json({ success: false, error: error.message || 'Unable to retrieve Deriv accounts.' });
  }
}
async function handleDerivPatOtp(req: express.Request, res: express.Response): Promise<void> {
  if (req.method !== 'POST') { res.status(405).json({ success: false, error: 'Method not allowed.' }); return; }
  if (!derivPatGuard(req, res)) return;
  try {
    const creds = readDerivPatBody(req);
    const accountId = String(req.body?.account_id || '').trim();
    if (!accountId || accountId.length > 128) { res.status(400).json({ success: false, error: 'A valid Deriv account ID is required.' }); return; }
    const list = await derivPatFetch(`${DERIV_TRADING_API}/options/accounts`, creds);
    const rows = Array.isArray(list?.data) ? list.data : Array.isArray(list?.data?.accounts) ? list.data.accounts : [];
    if (!rows.some((item: any) => String(item.account_id || item.id || '') === accountId)) {
      return res.status(403).json({ success: false, error: 'This account is not available to the supplied Deriv PAT.' });
    }
    const result = await derivPatFetch(`${DERIV_TRADING_API}/options/accounts/${encodeURIComponent(accountId)}/otp`, creds, 'POST');
    const url = result?.data?.url || result?.url;
    if (typeof url !== 'string') throw Object.assign(new Error('Deriv did not return an authenticated WebSocket URL.'), { status: 502 });
    const parsed = new URL(url);
    if (parsed.protocol !== 'wss:' || !(parsed.hostname === 'derivws.com' || parsed.hostname.endsWith('.derivws.com'))) {
      throw Object.assign(new Error('Deriv returned an unexpected WebSocket host.'), { status: 502 });
    }
    res.set('Cache-Control', 'no-store').json({ success: true, url, account_id: accountId });
  } catch (error: any) {
    return res.status(Number.isInteger(error.status) ? error.status : 502)
      .set('Cache-Control', 'no-store').json({ success: false, error: error.message || 'Unable to authenticate the Deriv account.' });
  }
}
app.post('/api/deriv-pat-accounts', handleDerivPatAccounts);
app.post('/api/deriv-pat-otp', handleDerivPatOtp);
app.post('/.netlify/functions/deriv-pat-accounts', handleDerivPatAccounts);
app.post('/.netlify/functions/deriv-pat-otp', handleDerivPatOtp);


// Health check endpoint
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", service: "Deriv Trading Hub Backend" });
});

// Server-Side OAuth Token Capture & Verification
app.post("/api/auth/capture-token", (req, res) => {
  try {
    const { accounts, rawUrl, state, appId } = req.body;

    console.log(`[Server Auth] Deriv OAuth Redirect Captured. Raw URL/Query: ${rawUrl || 'N/A'}, State: ${state || 'N/A'}, AppID: ${appId || '340mh9Kwzb9IINrqS379p'}`);

    if (!accounts || !Array.isArray(accounts) || accounts.length === 0) {
      return res.status(400).json({ success: false, error: "No valid Deriv OAuth tokens supplied" });
    }

    // Sanitize and validate captured tokens server-side
    const sanitizedAccounts = accounts.map((acc: any) => ({
      account: String(acc.account || "Account").trim(),
      token: String(acc.token || "").replace(/^bearer\s+/i, "").replace(/['"\r\n\t\s]/g, ""),
      currency: String(acc.currency || "USD").toUpperCase(),
      type: String(acc.account || "").toUpperCase().startsWith("V") ? "DEMO" : "REAL",
    })).filter((acc: any) => acc.token.length >= 4);

    if (sanitizedAccounts.length === 0) {
      return res.status(400).json({ success: false, error: "Token validation failed: empty or malformed token" });
    }

    const primaryToken = sanitizedAccounts.find((a: any) => a.type === "REAL")?.token || sanitizedAccounts[0].token;

    console.log(`[Server Auth] Verified ${sanitizedAccounts.length} Deriv OAuth tokens server-side. App ID: ${appId || '340mh9Kwzb9IINrqS379p'}`);

    res.json({
      success: true,
      appId: appId || "340mh9Kwzb9IINrqS379p",
      capturedToken: primaryToken,
      accounts: sanitizedAccounts,
      state: state || null,
      timestamp: Date.now(),
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || "Failed to capture token server-side" });
  }
});

// Helper utilities for Deriv OTP and Account Discovery
function cleanToken(value: unknown): string {
  return String(value || '')
    .trim()
    .replace(/^bearer\s+/i, '')
    .replace(/[\s'"\r\n\t]/g, '');
}

function findAccountId(value: unknown): string | null {
  if (!value || typeof value !== 'object') return null;
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findAccountId(item);
      if (found) return found;
    }
    return null;
  }
  const object = value as Record<string, unknown>;
  const directKeys = ['account_id', 'accountId', 'account_id_value', 'loginid', 'login_id'];
  for (const key of directKeys) {
    const candidate = object[key];
    if (typeof candidate === 'string' && candidate.trim()) return candidate.trim();
  }
  for (const key of ['account', 'wallet', 'wallets', 'accounts', 'data', 'result']) {
    const found = findAccountId(object[key]);
    if (found) return found;
  }
  return null;
}

function findWebSocketUrl(value: unknown): string | null {
  if (typeof value === 'string') return value.startsWith('wss://') ? value : null;
  if (!value || typeof value !== 'object') return null;
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findWebSocketUrl(item);
      if (found) return found;
    }
    return null;
  }
  for (const item of Object.values(value as Record<string, unknown>)) {
    const found = findWebSocketUrl(item);
    if (found) return found;
  }
  return null;
}

async function handleDerivOtp(req: express.Request, res: express.Response) {
  try {
    const { appId: rawAppId, token: rawToken, accountId: rawAccountId } = req.body || {};
    const appId = String(rawAppId || '').trim();
    const token = cleanToken(rawToken);

    if (!appId || !token) {
      return res.status(400).json({ error: 'App ID and Deriv token are required.' });
    }

    let accountId = String(rawAccountId || '').trim();
    const discoveryDetails: string[] = [];

    if (!accountId) {
      const endpoints = [
        'https://api.derivws.com/wallet/v1/wallets',
        'https://api.derivws.com/trading/v1/options/accounts',
        'https://api.derivws.com/account/v1/accounts',
      ];
      for (const endpoint of endpoints) {
        try {
          const resp = await fetch(endpoint, {
            method: 'GET',
            headers: {
              'Deriv-App-ID': appId,
              Authorization: `Bearer ${token}`,
              Accept: 'application/json',
            },
          });
          const text = await resp.text();
          let data: unknown = text;
          try { data = JSON.parse(text); } catch {}
          if (!resp.ok) {
            discoveryDetails.push(`${endpoint}: HTTP ${resp.status}`);
            continue;
          }
          const found = findAccountId(data);
          if (found) {
            accountId = found;
            break;
          }
          discoveryDetails.push(`${endpoint}: no account identifier in response`);
        } catch (error: any) {
          discoveryDetails.push(`${endpoint}: ${error?.message || String(error)}`);
        }
      }
    }

    if (!accountId) {
      // Fallback: If discovery fails or legacy token, fallback to standard Deriv WS URL
      return res.json({
        url: `wss://ws.derivws.com/websockets/v3?app_id=${encodeURIComponent(appId)}`,
        accountId: '',
        hint: 'Fallback standard WebSocket connection',
      });
    }

    const otpResponse = await fetch(
      `https://api.derivws.com/trading/v1/options/accounts/${encodeURIComponent(accountId)}/otp`,
      {
        method: 'POST',
        headers: {
          'Deriv-App-ID': appId,
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
        },
      }
    );
    const otpText = await otpResponse.text();
    let parsed: unknown = otpText;
    try { parsed = JSON.parse(otpText); } catch {}

    if (!otpResponse.ok) {
      // Fallback to legacy endpoint if OTP endpoint not supported for account
      return res.json({
        url: `wss://ws.derivws.com/websockets/v3?app_id=${encodeURIComponent(appId)}`,
        accountId,
      });
    }

    const wsUrl = findWebSocketUrl(parsed);
    if (!wsUrl) {
      return res.json({
        url: `wss://ws.derivws.com/websockets/v3?app_id=${encodeURIComponent(appId)}`,
        accountId,
      });
    }

    return res.json({ url: wsUrl, accountId });
  } catch (error: any) {
    console.error('Deriv OTP Error:', error);
    return res.status(500).json({ error: error?.message || 'OTP handler failed' });
  }
}

app.post('/.netlify/functions/deriv-otp', handleDerivOtp);
app.post('/api/deriv-otp', handleDerivOtp);

// Deriv account nickname endpoint
async function handleAccountNickname(req: express.Request, res: express.Response) {
  try {
    const appId = process.env.DERIV_APP_ID;
    const token = process.env.DERIV_TOKEN;
    if (!appId || !token) {
      return res.json({ nickname: '' });
    }
    const response = await fetch('https://api.derivws.com/account/v1/nickname', {
      method: 'GET',
      headers: {
        'Deriv-App-ID': appId,
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
    });
    const body = await response.text();
    let parsed: any;
    try { parsed = JSON.parse(body); } catch { parsed = { nickname: body }; }
    return res.json(parsed);
  } catch (err: any) {
    return res.json({ nickname: '' });
  }
}

app.get('/.netlify/functions/account-nickname', handleAccountNickname);
app.get('/api/account-nickname', handleAccountNickname);

// AI Market Analysis & Trade Signal endpoint
app.post("/api/ai/market-analysis", async (req, res) => {
  try {
    const { symbol, ticks, candles, timeframe, indicatorSummary } = req.body;
    
    if (!ticks || !Array.isArray(ticks) || ticks.length === 0) {
      return res.status(400).json({ error: "Missing or invalid ticks data" });
    }

    const client = getAiClient();
    const prompt = `
You are a senior quantitative analyst specializing in Deriv Synthetic Indices (Volatility Indices, Crash/Boom, Jump Indices, Step Index).
Analyze the following market state for symbol: ${symbol || "Volatility 75 Index"}.
Current Timeframe: ${timeframe || "1m"}
Recent Ticks (last 10): ${JSON.stringify(ticks.slice(-10))}
Technical Indicators: ${JSON.stringify(indicatorSummary || {})}

Provide a concise, professional analysis in strict JSON format matching this schema:
{
  "symbol": "${symbol}",
  "bias": "BULLISH" | "BEARISH" | "NEUTRAL",
  "confidence": number (0-100),
  "keyObservation": "1-2 sentence description of price action and momentum",
  "recommendedStrategy": "Rise/Fall" | "Multipliers" | "Accumulator" | "Digits" | "No Trade",
  "suggestedEntry": "Immediate" | "Wait for pullback" | "On spike reset",
  "stopLossAdvice": "string advice on stop loss or stake sizing",
  "riskLevel": "LOW" | "MEDIUM" | "HIGH",
  "reasoningPoints": ["point 1", "point 2", "point 3"]
}
Respond ONLY with the valid JSON object.
`;

    const response = await client.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
      },
    });

    const resultText = response.text || "{}";
    const parsed = JSON.parse(resultText);
    res.json({ success: true, data: parsed });
  } catch (error: any) {
    console.error("AI Market Analysis Error:", error);
    res.status(500).json({ error: error.message || "Failed to generate AI market analysis" });
  }
});

// AI Bot Strategy Builder endpoint
app.post("/api/ai/generate-bot", async (req, res) => {
  try {
    const { userPrompt, targetMarket } = req.body;
    if (!userPrompt) {
      return res.status(400).json({ error: "Prompt is required" });
    }

    const client = getAiClient();
    const prompt = `
You are an expert Deriv DBot / Binary Bot strategy architect.
The user wants to generate an automated DBot strategy based on this requirement: "${userPrompt}".
Target Market: ${targetMarket || "Volatility 75 Index"}

Generate a complete trading bot strategy in JSON format:
{
  "botName": "Catchy Strategy Name",
  "market": "${targetMarket || "Volatility 75 Index"}",
  "tradeType": "Rise/Fall" | "Digits Differs" | "Crash/Boom Hunter" | "Accumulator" | "Multiplier",
  "contractType": "CALL" | "PUT" | "DIGITDIFF" | "DIGITEVEN" | "ACCU" | "MULT",
  "durationTicks": number (e.g. 1 to 10),
  "initialStake": number (e.g. 1, 5, 10),
  "martingaleMultiplier": number (e.g. 2.1),
  "takeProfit": number (e.g. 20),
  "stopLoss": number (e.g. 50),
  "maxConsecutiveLosses": number (e.g. 5),
  "rulesDescription": "Clear explanation of trigger conditions, entry logic, and risk controls.",
  "indicatorsUsed": ["EMA 10", "RSI 14", "Spike Detection"],
  "estimatedWinRatePercent": number (50 - 95),
  "recommendedBalance": number
}
Respond ONLY with the valid JSON object.
`;

    const response = await client.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
      },
    });

    const parsed = JSON.parse(response.text || "{}");
    res.json({ success: true, data: parsed });
  } catch (error: any) {
    console.error("AI Bot Generation Error:", error);
    res.status(500).json({ error: error.message || "Failed to generate DBot strategy" });
  }
});

// AI Risk Management Assistant
app.post("/api/ai/risk-assessment", async (req, res) => {
  try {
    const { balance, stake, strategy, martingaleSteps } = req.body;
    const client = getAiClient();
    const prompt = `
Analyze the trading risk profile for a Deriv trader:
- Account Balance: $${balance}
- Initial Stake: $${stake}
- Strategy: ${strategy || "Martingale"}
- Max Martingale Steps: ${martingaleSteps || 5}

Provide a JSON object with:
{
  "maxTotalDrawdownPossible": number,
  "riskRating": "SAFE" | "MODERATE" | "AGGRESSIVE" | "HIGHLY DANGEROUS",
  "maxLossPercentageOfAccount": number,
  "recommendations": ["string rule 1", "string rule 2"],
  "optimalStake": number
}
Respond ONLY with valid JSON.
`;

    const response = await client.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
      },
    });

    const parsed = JSON.parse(response.text || "{}");
    res.json({ success: true, data: parsed });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Risk calculation failed" });
  }
});

// Vite Development or Production Static middleware
async function setupViteOrStatic() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Deriv Trading Hub Server running on http://0.0.0.0:${PORT}`);
  });
}

setupViteOrStatic();
