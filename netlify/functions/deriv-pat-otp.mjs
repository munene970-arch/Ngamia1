const API = "https://api.derivws.com/trading/v1";
const hits = new Map();

function json(statusCode, body) {
  return { statusCode, headers: { "content-type": "application/json", "cache-control": "no-store" }, body: JSON.stringify(body) };
}
function allowedOrigin(event) {
  const origin = event.headers?.origin || event.headers?.Origin;
  if (!origin) return false;
  const allow = (process.env.DERIV_ALLOWED_ORIGINS || process.env.URL || process.env.DEPLOY_PRIME_URL || "")
    .split(",").map(x => x.trim()).filter(Boolean);
  try {
    const parsed = new URL(origin);
    return allow.includes(origin) || parsed.host === (event.headers?.host || event.headers?.Host);
  } catch { return false; }
}
function rateLimited(event) {
  const ip = event.headers?.["x-nf-client-connection-ip"] || event.headers?.["x-forwarded-for"]?.split(",")[0] || "unknown";
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter(t => now - t < 60000);
  recent.push(now);
  hits.set(ip, recent);
  return recent.length > 20;
}
function credentials(body) {
  const appId = String(body?.app_id || "").trim();
  const pat = String(body?.pat || "").trim();
  if (!/^\\d{1,12}$/.test(appId)) throw Object.assign(new Error("Enter a valid numeric Deriv App ID."), { statusCode: 400 });
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
  if (!response.ok) throw Object.assign(new Error(`Deriv rejected the request (HTTP ${response.status}). Check your App ID, PAT, and token scopes.`), { statusCode: response.status >= 400 && response.status < 500 ? response.status : 502 });
  return data;
}
function guard(event) {
  if (!allowedOrigin(event)) return json(403, { success: false, error: "Request origin is not allowed." });
  if (rateLimited(event)) return json(429, { success: false, error: "Too many requests. Try again shortly." });
  return null;
}
function parseBody(event) {
  if (Number(event.headers?.["content-length"] || 0) > 12000 || String(event.body || "").length > 12000) {
    throw Object.assign(new Error("Request is too large."), { statusCode: 413 });
  }
  let body = {};
  try { body = event.isBase64Encoded ? JSON.parse(Buffer.from(event.body || "", "base64").toString("utf8")) : JSON.parse(event.body || "{}"); }
  catch { throw Object.assign(new Error("Invalid JSON request body."), { statusCode: 400 }); }
  return body;
}
function rowsFrom(payload) {
  return Array.isArray(payload?.data) ? payload.data : Array.isArray(payload?.data?.accounts) ? payload.data.accounts : [];
}

export default async (event) => {
  if (event.httpMethod !== "POST") return json(405, { success: false, error: "Method not allowed." });
  const denied = guard(event); if (denied) return denied;
  try {
    const body = parseBody(event);
    const creds = credentials(body);
    const accountId = String(body.account_id || "").trim();
    if (!accountId || accountId.length > 128) return json(400, { success: false, error: "A valid Deriv account ID is required." });
    const list = await derivFetch(`${API}/options/accounts`, creds);
    if (!rowsFrom(list).some(item => String(item.account_id || item.id || "") === accountId)) {
      return json(403, { success: false, error: "This account is not available to the supplied Deriv PAT." });
    }
    const result = await derivFetch(`${API}/options/accounts/${encodeURIComponent(accountId)}/otp`, creds, "POST");
    const url = result?.data?.url || result?.url;
    if (typeof url !== "string") throw Object.assign(new Error("Deriv did not return an authenticated WebSocket URL."), { statusCode: 502 });
    const parsed = new URL(url);
    if (parsed.protocol !== "wss:" || !(parsed.hostname === "derivws.com" || parsed.hostname.endsWith(".derivws.com"))) {
      throw Object.assign(new Error("Deriv returned an unexpected WebSocket host."), { statusCode: 502 });
    }
    return json(200, { success: true, url, account_id: accountId });
  } catch (error) {
    return json(error.statusCode || 502, { success: false, error: error.message || "Unable to authenticate the Deriv account." });
  }
};
