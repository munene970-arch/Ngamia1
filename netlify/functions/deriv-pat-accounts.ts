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
    const body = await request.json() as { app_id?: string; pat?: string };
    const appId = String(body.app_id || Deno.env.get("DERIV_APP_ID") || "").trim();
    const pat = String(body.pat || "").trim();
    if (!/^\\d{1,12}$/.test(appId)) return json(400, { success: false, error: "Configure a valid numeric DERIV_APP_ID in Netlify or enter your numeric Deriv App ID." });
    if (pat.length < 10 || pat.length > 4096) return json(400, { success: false, error: "Enter a valid Deriv Personal Access Token." });

    const response = await fetch(API + "/options/accounts", {
      method: "GET",
      headers: { Authorization: `Bearer ${pat}`, "Deriv-App-ID": appId, Accept: "application/json" },
      signal: AbortSignal.timeout(12000),
    });
    const payload = await response.json().catch(() => ({})) as any;
    if (!response.ok) {
      const message = payload?.errors?.[0]?.message || payload?.error?.message || `Deriv rejected the request (HTTP ${response.status}). Check the PAT scopes and App ID.`;
      return json(response.status >= 400 && response.status < 500 ? response.status : 502, { success: false, error: message });
    }
    const raw = Array.isArray(payload?.data) ? payload.data : payload?.data ? [payload.data] : [];
    const accounts = raw.map((item: any) => ({
      account_id: String(item.account_id || item.id || ""),
      loginid: String(item.loginid || item.login_id || item.account_id || item.id || ""),
      balance: String(item.balance ?? "0"),
      currency: String(item.currency || "USD"),
      is_virtual: Boolean(item.is_virtual ?? item.isVirtual ?? String(item.account_type || item.type || "").toLowerCase() === "demo"),
      account_type: String(item.account_type || item.type || ""),
    })).filter((item: any) => item.account_id);
    if (!accounts.length) return json(404, { success: false, error: "No Options trading accounts were returned for this PAT. Check that the PAT has the trade scope." });
    return json(200, { success: true, accounts });
  } catch (error) {
    return json(502, { success: false, error: error instanceof Error ? error.message : "Unable to retrieve Deriv accounts." });
  }
};
