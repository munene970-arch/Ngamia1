# Ngamia1 Deriv PAT account connection

Ngamia1 connects the selected Deriv account through the existing `derivWS` service. Bot Studio, Auto Trader, digit strategies, and the other features that use this shared service continue to use the same authenticated trading socket.

## User setup

1. Register or select a Deriv application and copy its numeric App ID.
2. Create a Deriv Personal Access Token (PAT) with the `trade` permission and any read permission needed for account details.
3. Open Ngamia1 and choose **Connect Deriv with PAT**.
4. Enter the App ID and PAT, then select **Connect and load accounts**.
5. Choose a DEMO account first and select **Connect selected account**.
6. Confirm the displayed login ID and balance before starting any strategy.

Never paste a PAT into GitHub, source files, screenshots, issue comments, or ChatGPT messages.

## Security and connection flow

- The PAT is held in browser module/component memory only. It is not stored in localStorage, sessionStorage, cookies, URLs, or logs.
- The browser sends the PAT only in HTTPS POST bodies to the same-origin `/api/deriv-pat-accounts` and `/api/deriv-pat-otp` endpoints.
- The backend calls fixed Deriv Trading API endpoints and returns account metadata only; it does not store or return the PAT.
- Before issuing an OTP, the backend verifies that the selected account belongs to the supplied PAT.
- The one-time OTP WebSocket URL is host-validated, not cached, and not exposed as the displayed endpoint.
- The OTP-authenticated socket is already authorized. Ngamia1 does not send a second `authorize` request.
- If PAT OTP retrieval fails, the PAT connection does not fall back to a public unauthenticated trading socket.
- Basic same-origin checks, request-size validation, timeouts, and per-IP rate limiting are applied.

## Hosting

The Express backend serves the two endpoints directly. If the app is served behind a reverse proxy with a different host, set `DERIV_ALLOWED_ORIGINS` to a comma-separated list of exact allowed browser origins, for example `https://your-ngamia1-domain.example`.

## Testing

Test account listing, demo OTP connection, account switching, balance updates, and a small demo trade before enabling any real-account strategy. Never use a real account as the first connection test.
