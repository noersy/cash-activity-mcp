/**
 * CashActivityClient
 * HTTP client with automatic JWT auth management.
 * - Logs in on first request
 * - Decodes JWT exp and proactively refreshes 5 min before expiry
 * - On 401: retries once with refreshed token
 */
function decodeJwtExp(token) {
    const parts = token.split(".");
    if (parts.length !== 3)
        throw new Error("Invalid JWT format");
    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf-8"));
    return payload.exp; // unix seconds
}
export class CashActivityClient {
    baseUrl;
    email;
    password;
    accessToken = null;
    refreshToken = null;
    tokenExpAt = 0; // unix seconds
    refreshTimer = null;
    constructor() {
        this.baseUrl = (process.env.CASH_API_URL ?? "https://cash-api.noersy.my.id").replace(/\/$/, "");
        this.email = process.env.CASH_API_EMAIL ?? "";
        this.password = process.env.CASH_API_PASSWORD ?? "";
        if (!this.email || !this.password) {
            throw new Error("CASH_API_EMAIL and CASH_API_PASSWORD must be set");
        }
    }
    // ── Auth ──────────────────────────────────────────────────────────────────
    async login() {
        const res = await fetch(`${this.baseUrl}/api/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: this.email, password: this.password }),
        });
        if (!res.ok) {
            throw new Error(`Login failed: ${res.status} ${await res.text()}`);
        }
        const data = (await res.json());
        this.setTokens(data);
    }
    async refresh() {
        if (!this.refreshToken) {
            await this.login();
            return;
        }
        const res = await fetch(`${this.baseUrl}/api/auth/refresh`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ refresh_token: this.refreshToken }),
        });
        if (!res.ok) {
            // Refresh token expired — re-login
            await this.login();
            return;
        }
        const data = (await res.json());
        this.setTokens(data);
    }
    setTokens(pair) {
        this.accessToken = pair.token;
        this.refreshToken = pair.refresh_token;
        this.tokenExpAt = decodeJwtExp(pair.token);
        this.scheduleRefresh();
    }
    scheduleRefresh() {
        if (this.refreshTimer)
            clearTimeout(this.refreshTimer);
        const nowSec = Math.floor(Date.now() / 1000);
        // Refresh 5 minutes before expiry
        const delayMs = Math.max(0, (this.tokenExpAt - nowSec - 300)) * 1000;
        this.refreshTimer = setTimeout(() => {
            this.refresh().catch(console.error);
        }, delayMs);
        // Don't block process exit
        if (this.refreshTimer.unref)
            this.refreshTimer.unref();
    }
    async ensureAuth() {
        if (!this.accessToken) {
            await this.login();
        }
    }
    // ── HTTP ──────────────────────────────────────────────────────────────────
    async request(method, path, body, query) {
        await this.ensureAuth();
        let url = `${this.baseUrl}${path}`;
        if (query) {
            const params = new URLSearchParams();
            for (const [k, v] of Object.entries(query)) {
                if (v !== undefined && v !== null && v !== "") {
                    params.set(k, String(v));
                }
            }
            const qs = params.toString();
            if (qs)
                url += `?${qs}`;
        }
        const doRequest = async (token) => {
            return fetch(url, {
                method,
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: body !== undefined ? JSON.stringify(body) : undefined,
            });
        };
        let res = await doRequest(this.accessToken);
        // 401 → refresh once and retry
        if (res.status === 401) {
            await this.refresh();
            res = await doRequest(this.accessToken);
        }
        if (!res.ok) {
            const text = await res.text();
            throw new Error(`API error ${res.status}: ${text}`);
        }
        // 204 No Content
        if (res.status === 204)
            return null;
        return res.json();
    }
    // Convenience methods
    get(path, query) {
        return this.request("GET", path, undefined, query);
    }
    post(path, body) {
        return this.request("POST", path, body);
    }
    put(path, body) {
        return this.request("PUT", path, body);
    }
    delete(path) {
        return this.request("DELETE", path);
    }
}
