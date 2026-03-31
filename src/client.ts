/**
 * CashActivityClient
 * HTTP client with automatic JWT auth management.
 * - Logs in on first request
 * - Decodes JWT exp and proactively refreshes 5 min before expiry
 * - On 401: retries once with refreshed token
 */

interface TokenPair {
  token: string;
  refresh_token: string;
}

function decodeJwtExp(token: string): number {
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("Invalid JWT format");
  const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf-8"));
  return payload.exp as number; // unix seconds
}

export class CashActivityClient {
  private baseUrl: string;
  private email: string;
  private password: string;
  private accessToken: string | null = null;
  private refreshToken: string | null = null;
  private tokenExpAt: number = 0; // unix seconds
  private refreshTimer: NodeJS.Timeout | null = null;

  constructor() {
    this.baseUrl = (process.env.CASH_API_URL ?? "https://cash-api.noersy.my.id").replace(/\/$/, "");
    this.email = process.env.CASH_API_EMAIL ?? "";
    this.password = process.env.CASH_API_PASSWORD ?? "";
    if (!this.email || !this.password) {
      throw new Error("CASH_API_EMAIL and CASH_API_PASSWORD must be set");
    }
  }

  // ── Auth ──────────────────────────────────────────────────────────────────

  private async login(): Promise<void> {
    const res = await fetch(`${this.baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: this.email, password: this.password }),
    });
    if (!res.ok) {
      throw new Error(`Login failed: ${res.status} ${await res.text()}`);
    }
    const data = (await res.json()) as TokenPair;
    this.setTokens(data);
  }

  private async refresh(): Promise<void> {
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
    const data = (await res.json()) as TokenPair;
    this.setTokens(data);
  }

  private setTokens(pair: TokenPair): void {
    this.accessToken = pair.token;
    this.refreshToken = pair.refresh_token;
    this.tokenExpAt = decodeJwtExp(pair.token);
    this.scheduleRefresh();
  }

  private scheduleRefresh(): void {
    if (this.refreshTimer) clearTimeout(this.refreshTimer);
    const nowSec = Math.floor(Date.now() / 1000);
    // Refresh 5 minutes before expiry
    const delayMs = Math.max(0, (this.tokenExpAt - nowSec - 300)) * 1000;
    this.refreshTimer = setTimeout(() => {
      this.refresh().catch(console.error);
    }, delayMs);
    // Don't block process exit
    if (this.refreshTimer.unref) this.refreshTimer.unref();
  }

  private async ensureAuth(): Promise<void> {
    if (!this.accessToken) {
      await this.login();
    }
  }

  // ── HTTP ──────────────────────────────────────────────────────────────────

  async request<T>(
    method: string,
    path: string,
    body?: unknown,
    query?: Record<string, string | number | undefined>
  ): Promise<T> {
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
      if (qs) url += `?${qs}`;
    }

    const doRequest = async (token: string): Promise<Response> => {
      return fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
    };

    let res = await doRequest(this.accessToken!);

    // 401 → refresh once and retry
    if (res.status === 401) {
      await this.refresh();
      res = await doRequest(this.accessToken!);
    }

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`API error ${res.status}: ${text}`);
    }

    // 204 No Content
    if (res.status === 204) return null as T;

    return res.json() as Promise<T>;
  }

  // Convenience methods
  get<T>(path: string, query?: Record<string, string | number | undefined>): Promise<T> {
    return this.request<T>("GET", path, undefined, query);
  }

  post<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>("POST", path, body);
  }

  put<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>("PUT", path, body);
  }

  delete<T>(path: string): Promise<T> {
    return this.request<T>("DELETE", path);
  }
}
