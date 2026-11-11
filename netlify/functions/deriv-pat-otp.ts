const API = "https://api.derivws.com/trading/v1";

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}

export default async (request: Request) => {
  if (request.method !== "POST") return json(405, { success: false, error: "Method not allowed." });
  const origin = request.headers.get("origin");
  const allowed = (Deno.env.get("DERIV_ALLOWED_ORIGINS") || "").split(",").map(v => v.trim()).filter(Boolean);
  if (!origin || (allowed.length && !allowed.includes(origin))) {
    return json(403, { success: false, error: "Request origin is not allowed. Check Ngamia1's DERIV_ALLOWED_ORIGINS setting." });
  }

  try {
    const body = await request.json() as { app_id?: string; pat?: string; account_id?: string };
    const appId = String(body.app_id || Deno.env.get("DERIV_APP_ID") || "").trim();
    const pat = String(body.pat || "").trim();
    const accountId = String(body.account_id || "").trim();
    if (!/^\\d{1,12}$/.test(appId)) return json(400, { success: false, error: "Configure a valid numeric DERIV_APP_ID in Netlify or enter your numeric Deriv App ID." });
    if (pat.length < 10 || pat.length > 4096) return json(400, { success: false, error: "Enter a valid Deriv Personal Access Token." });
    if (!accountId || accountId.length > 128) return json(400, { success: false, error: "Select a valid Deriv account." });

    const response = await fetch(API + `/options/accounts/${encodeURIComponent(accountId)}/otp`, {
      method: "POST",
      headers: { Authorization: `Bearer ${pat}`, "Deriv-App-ID": appId, Accept: "application/json" },
      signal: AbortSignal.timeout(12000),
    });
    const payload = await response.json().catch(() => ({})) as any;
    if (!response.ok) {
      const message = payload?.errors?.[0]?.message || payload?.error?.message || `Deriv OTP request failed (HTTP ${response.status}).`;
      return json(response.status >= 400 && response.status < 500 ? response.status : 502, { success: false, error: message });
    }
    const url = payload?.data?.url || payload?.url;
    if (typeof url !== "string") return json(502, { success: false, error: "Deriv did not return an authenticated WebSocket URL." });
    const parsed = new URL(url);
    if (parsed.protocol !== "wss:" || !(parsed.hostname === "api.derivws.com" || parsed.hostname.endsWith(".derivws.com"))) {
      return json(502, { success: false, error: "Deriv returned an unexpected WebSocket host." });
    }
    return json(200, { success: true, url, account_id: accountId });
  } catch (error) {
    return json(502, { success: false, error: error instanceof Error ? error.message : "Unable to authenticate the Deriv account." });
  }
};
