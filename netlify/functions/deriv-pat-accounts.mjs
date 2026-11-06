const API = "https://api.derivws.com/trading/v1";
const hits = new Map();

function json(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }
  });
}

function allowedOrigin(request) {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  const allow = (process.env.DERIV_ALLOWED_ORIGINS || process.env.URL || process.env.DEPLOY_PRIME_URL || "")
    .split(",").map(value => value.trim()).filter(Boolean);
  try {
    const parsed = new URL(origin);
    return allow.includes(origin) || parsed.host === request.headers.get("host");
  } catch {
    return false;
  }
}

function rateLimited(request) {
  const forwarded = request.headers.get("x-forwarded-for") || "";
  const ip = request.headers.get("x-nf-client-connection-ip") || forwarded.split(",")[0].trim() || "unknown";
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter(timestamp => now - timestamp < 60000);
  recent.push(now);
  hits.set(ip, recent);
  return recent.length > 20;
}

function credentials(body) {
  const appId = String(body?.app_id || "").trim();
  const pat = String(body?.pat || "").trim();
  if (!/^\d{1,12}$/.test(appId)) throw Object.assign(new Error("Enter a valid numeric Deriv App ID."), { statusCode: 400 });
  if (pat.length < 10 || pat.length > 4096) throw Object.assign(new Error("Enter a valid Deriv PAT."), { statusCode: 400 });
  return { appId, pat };
}

async function derivFetch(url, creds, method = "GET") {
  const response = await fetch(url, {
    method,
    headers: { "Deriv-App-ID": creds.appId, Authorization: `Bearer ${creds.pat}`, Accept: "application/json" },
    signal: AbortSignal.timeout(12000)
  });
  const raw = await response.text();
  let data = {};
  try { data = raw ? JSON.parse(raw) : {}; } catch {}
  if (!response.ok) {
    throw Object.assign(new Error(`Deriv rejected the request (HTTP ${response.status}). Check your App ID, PAT, and token scopes.`), {
      statusCode: response.status >= 400 && response.status < 500 ? response.status : 502
    });
  }
  return data;
}

async function parseBody(request) {
  const declaredLength = Number(request.headers.get("content-length") || 0);
  if (declaredLength > 12000) throw Object.assign(new Error("Request is too large."), { statusCode: 413 });
  const raw = await request.text();
  if (raw.length > 12000) throw Object.assign(new Error("Request is too large."), { statusCode: 413 });
  try {
    return JSON.parse(raw || "{}");
  } catch {
    throw Object.assign(new Error("Invalid JSON request body."), { statusCode: 400 });
  }
}

function rowsFrom(payload) {
  return Array.isArray(payload?.data) ? payload.data : Array.isArray(payload?.data?.accounts) ? payload.data.accounts : [];
}

export default async (request) => {
  if (request.method !== "POST") return json(405, { success: false, error: "Method not allowed." });
  if (!allowedOrigin(request)) return json(403, { success: false, error: "Request origin is not allowed." });
  if (rateLimited(request)) return json(429, { success: false, error: "Too many requests. Try again shortly." });

  try {
    const creds = credentials(await parseBody(request));
    const payload = await derivFetch(`${API}/options/accounts`, creds);
    const accounts = rowsFrom(payload).map(item => ({
      account_id: String(item.account_id || item.id || ""),
      loginid: String(item.loginid || item.login_id || ""),
      balance: String(item.balance ?? "0"),
      currency: String(item.currency || "USD"),
      is_virtual: Boolean(item.is_virtual ?? item.isVirtual ?? String(item.account_id || "").startsWith("V")),
      account_type: String(item.account_type || item.type || "")
    })).filter(item => item.account_id);
    return json(200, { success: true, accounts });
  } catch (error) {
    return json(error.statusCode || 502, { success: false, error: error.message || "Unable to retrieve Deriv accounts." });
  }
};
