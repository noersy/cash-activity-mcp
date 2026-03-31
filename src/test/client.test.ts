/**
 * Unit tests for CashActivityClient
 * Tests: login, token decode, proactive refresh, 401 retry, request methods
 */

import { describe, it, mock, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeJwt(expOffsetSec: number): string {
  const payload = {
    user_id: "test-user",
    email: "test@example.com",
    exp: Math.floor(Date.now() / 1000) + expOffsetSec,
  };
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${header}.${body}.fakesig`;
}

function makeTokenPair(expOffsetSec = 86400) {
  return {
    token: makeJwt(expOffsetSec),
    refresh_token: "fake-refresh-token",
  };
}

// ── Mock fetch factory ────────────────────────────────────────────────────────

type FetchCall = { url: string; method: string; body: unknown };

function makeMockFetch(responses: Map<string, { status: number; body: unknown }>, calls: FetchCall[]) {
  return async (url: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const urlStr = url.toString();
    const method = init?.method ?? "GET";
    const body = init?.body ? JSON.parse(init.body as string) : undefined;
    calls.push({ url: urlStr, method, body });

    const key = `${method}:${new URL(urlStr).pathname}`;
    const match = responses.get(key);
    if (!match) throw new Error(`Unexpected fetch: ${method} ${urlStr}`);

    return new Response(JSON.stringify(match.body), {
      status: match.status,
      headers: { "Content-Type": "application/json" },
    });
  };
}

// ── Import client (after env setup) ──────────────────────────────────────────

// Set env before dynamic import
process.env.CASH_API_URL = "https://fake-api.test";
process.env.CASH_API_EMAIL = "test@example.com";
process.env.CASH_API_PASSWORD = "testpass";

const { CashActivityClient } = await import("../client.js");

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("CashActivityClient", () => {

  describe("constructor", () => {
    it("throws if CASH_API_EMAIL is missing", () => {
      const orig = process.env.CASH_API_EMAIL;
      process.env.CASH_API_EMAIL = "";
      assert.throws(() => new CashActivityClient(), /CASH_API_EMAIL/);
      process.env.CASH_API_EMAIL = orig;
    });

    it("throws if CASH_API_PASSWORD is missing", () => {
      const orig = process.env.CASH_API_PASSWORD;
      process.env.CASH_API_PASSWORD = "";
      assert.throws(() => new CashActivityClient(), /CASH_API_PASSWORD/);
      process.env.CASH_API_PASSWORD = orig;
    });
  });

  describe("login on first request", () => {
    it("calls /api/auth/login before the first real request", async () => {
      const calls: FetchCall[] = [];
      const tokenPair = makeTokenPair();

      const responses = new Map([
        ["POST:/api/auth/login", { status: 200, body: tokenPair }],
        ["GET:/api/profile",     { status: 200, body: { id: "1", full_name: "Test" } }],
      ]);

      const origFetch = globalThis.fetch;
      globalThis.fetch = makeMockFetch(responses, calls) as typeof fetch;

      const client = new CashActivityClient();
      await client.get("/api/profile");

      globalThis.fetch = origFetch;

      assert.equal(calls[0].method, "POST");
      assert.ok(calls[0].url.toString().includes("/api/auth/login"));
      assert.equal(calls[1].method, "GET");
      assert.ok(calls[1].url.toString().includes("/api/profile"));
    });

    it("sends correct credentials in login body", async () => {
      const calls: FetchCall[] = [];
      const responses = new Map([
        ["POST:/api/auth/login", { status: 200, body: makeTokenPair() }],
        ["GET:/api/profile",     { status: 200, body: {} }],
      ]);

      const origFetch = globalThis.fetch;
      globalThis.fetch = makeMockFetch(responses, calls) as typeof fetch;

      const client = new CashActivityClient();
      await client.get("/api/profile");
      globalThis.fetch = origFetch;

      assert.equal((calls[0].body as any).email, "test@example.com");
      assert.equal((calls[0].body as any).password, "testpass");
    });
  });

  describe("token handling", () => {
    it("does not login twice if already authenticated", async () => {
      const calls: FetchCall[] = [];
      const responses = new Map([
        ["POST:/api/auth/login", { status: 200, body: makeTokenPair() }],
        ["GET:/api/profile",     { status: 200, body: {} }],
        ["GET:/api/wallets",     { status: 200, body: [] }],
      ]);

      const origFetch = globalThis.fetch;
      globalThis.fetch = makeMockFetch(responses, calls) as typeof fetch;

      const client = new CashActivityClient();
      await client.get("/api/profile");
      await client.get("/api/wallets");
      globalThis.fetch = origFetch;

      const loginCalls = calls.filter(c => c.url.toString().includes("/api/auth/login"));
      assert.equal(loginCalls.length, 1, "Should only login once");
    });

    it("attaches Bearer token to requests", async () => {
      const calls: FetchCall[] = [];
      const responses = new Map([
        ["POST:/api/auth/login", { status: 200, body: makeTokenPair() }],
        ["GET:/api/profile",     { status: 200, body: {} }],
      ]);

      let capturedHeaders: Headers | undefined;
      const origFetch = globalThis.fetch;
      globalThis.fetch = async (url: RequestInfo | URL, init?: RequestInit) => {
        capturedHeaders = new Headers(init?.headers as HeadersInit);
        return makeMockFetch(responses, calls)(url as string, init);
      };

      const client = new CashActivityClient();
      await client.get("/api/profile");
      globalThis.fetch = origFetch;

      // Last call should have Authorization header (profile call, not login)
      // We check the profile request specifically
      const profileCallIndex = calls.findIndex(c => c.url.toString().includes("/api/profile"));
      assert.ok(profileCallIndex >= 0);
      // capturedHeaders holds the last request's headers
      assert.ok(capturedHeaders?.get("authorization")?.startsWith("Bearer "));
    });
  });

  describe("401 retry", () => {
    it("refreshes token on 401 and retries the request", async () => {
      const calls: FetchCall[] = [];
      let profileCallCount = 0;

      const origFetch = globalThis.fetch;
      globalThis.fetch = async (url: RequestInfo | URL, init?: RequestInit) => {
        const method = init?.method ?? "GET";
        const body = init?.body ? JSON.parse(init.body as string) : undefined;
        calls.push({ url: url.toString(), method, body });

        if (url.toString().includes("/api/auth/login")) {
          return new Response(JSON.stringify(makeTokenPair(86400)), { status: 200 });
        }
        if (url.toString().includes("/api/auth/refresh")) {
          return new Response(JSON.stringify(makeTokenPair(86400)), { status: 200 });
        }
        if (url.toString().includes("/api/profile")) {
          profileCallCount++;
          // First call: 401, second call: 200
          if (profileCallCount === 1) {
            return new Response("Unauthorized", { status: 401 });
          }
          return new Response(JSON.stringify({ id: "1" }), { status: 200 });
        }
        throw new Error(`Unexpected: ${url}`);
      };

      const client = new CashActivityClient();
      const result = await client.get("/api/profile");
      globalThis.fetch = origFetch;

      assert.equal(profileCallCount, 2, "Should retry once after 401");
      assert.deepEqual(result, { id: "1" });

      const refreshCall = calls.find(c => c.url.toString().includes("/api/auth/refresh"));
      assert.ok(refreshCall, "Should call refresh on 401");
    });

    it("throws after second 401 (no infinite loop)", async () => {
      const origFetch = globalThis.fetch;
      globalThis.fetch = async (url: RequestInfo | URL, init?: RequestInit) => {
        if (url.toString().includes("/api/auth/login") || url.toString().includes("/api/auth/refresh")) {
          return new Response(JSON.stringify(makeTokenPair(86400)), { status: 200 });
        }
        return new Response("Unauthorized", { status: 401 });
      };

      const client = new CashActivityClient();
      await assert.rejects(
        () => client.get("/api/profile"),
        /401/
      );
      globalThis.fetch = origFetch;
    });
  });

  describe("HTTP methods", () => {
    async function setupClient() {
      const calls: FetchCall[] = [];
      const responses = new Map([
        ["POST:/api/auth/login", { status: 200, body: makeTokenPair() }],
      ]);

      const origFetch = globalThis.fetch;
      globalThis.fetch = async (url: RequestInfo | URL, init?: RequestInit) => {
        const method = init?.method ?? "GET";
        const body = init?.body ? JSON.parse(init.body as string) : undefined;
        calls.push({ url: url.toString(), method, body });

        const key = `${method}:${new URL(url.toString()).pathname}`;
        const match = responses.get(key);
        if (match) {
          return new Response(JSON.stringify(match.body), { status: match.status });
        }
        // Default: return the method back as JSON
        return new Response(JSON.stringify({ method, url }), { status: 200 });
      };

      const client = new CashActivityClient();
      // Pre-login
      await client.get("/api/profile").catch(() => {});
      calls.length = 0; // reset after login
      return { client, calls, restore: () => { globalThis.fetch = origFetch; } };
    }

    it("GET appends query params", async () => {
      const { client, calls, restore } = await setupClient();
      await client.get("/api/analytics/category-breakdown", { type: "expense", start_date: "2026-01-01" });
      restore();
      const call = calls[0];
      assert.ok(call.url.toString().includes("type=expense"));
      assert.ok(call.url.toString().includes("start_date=2026-01-01"));
    });

    it("GET skips undefined query params", async () => {
      const { client, calls, restore } = await setupClient();
      await client.get("/api/analytics/monthly-trend", { months: undefined });
      restore();
      assert.ok(!calls[0].url.toString().includes("months"));
    });

    it("POST sends JSON body", async () => {
      const { client, calls, restore } = await setupClient();
      await client.post("/api/wallets", { name: "Gopay", type: "e-wallet", currency: "IDR" });
      restore();
      assert.equal(calls[0].method, "POST");
      assert.deepEqual(calls[0].body, { name: "Gopay", type: "e-wallet", currency: "IDR" });
    });

    it("PUT sends JSON body", async () => {
      const { client, calls, restore } = await setupClient();
      await client.put("/api/wallets/123", { name: "Gopay+", type: "e-wallet" });
      restore();
      assert.equal(calls[0].method, "PUT");
      assert.deepEqual(calls[0].body, { name: "Gopay+", type: "e-wallet" });
    });

    it("DELETE sends no body", async () => {
      const { client, calls, restore } = await setupClient();
      // Simulate 204
      const origFetch = globalThis.fetch;
      globalThis.fetch = async (url: RequestInfo | URL, init?: RequestInit) => {
        const method = init?.method ?? "GET";
        calls.push({ url: url.toString(), method, body: undefined });
        return new Response(null, { status: 204 });
      };
      const result = await client.delete("/api/wallets/123");
      globalThis.fetch = origFetch;
      restore();
      assert.equal(calls[0].method, "DELETE");
      assert.equal(result, null);
    });
  });

  describe("error handling", () => {
    it("throws on non-2xx non-401 response", async () => {
      const origFetch = globalThis.fetch;
      globalThis.fetch = async (url: RequestInfo | URL) => {
        if (url.toString().includes("/api/auth/login")) {
          return new Response(JSON.stringify(makeTokenPair(86400)), { status: 200 });
        }
        return new Response("Not Found", { status: 404 });
      };

      const client = new CashActivityClient();
      await assert.rejects(
        () => client.get("/api/wallets/nonexistent"),
        /404/
      );
      globalThis.fetch = origFetch;
    });

    it("throws if login fails", async () => {
      const origFetch = globalThis.fetch;
      globalThis.fetch = async () => new Response("Bad credentials", { status: 401 });

      const client = new CashActivityClient();
      await assert.rejects(
        () => client.get("/api/profile"),
        /Login failed/
      );
      globalThis.fetch = origFetch;
    });
  });
});
