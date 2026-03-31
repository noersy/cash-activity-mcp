/**
 * Unit tests for the function registry
 * Tests: all functions exist, destructive guard, handler routing
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

process.env.CASH_API_URL = "https://fake-api.test";
process.env.CASH_API_EMAIL = "test@example.com";
process.env.CASH_API_PASSWORD = "testpass";

const { buildRegistry } = await import("../registry.js");
const { CashActivityClient } = await import("../client.js");

// ── Mock client ───────────────────────────────────────────────────────────────

type MockCall = { method: string; path: string; body?: unknown; query?: unknown };
type MockClient = InstanceType<typeof CashActivityClient>;

function makeMockClient(): { client: MockClient; calls: MockCall[] } {
  const calls: MockCall[] = [];
  const client = {
    get: async (path: string, query?: unknown) => { calls.push({ method: "GET", path, query }); return {}; },
    post: async (path: string, body?: unknown) => { calls.push({ method: "POST", path, body }); return {}; },
    put: async (path: string, body?: unknown) => { calls.push({ method: "PUT", path, body }); return {}; },
    delete: async (path: string) => { calls.push({ method: "DELETE", path }); return null; },
  } as unknown as MockClient;
  return { client, calls };
}

// ── Expected function names ───────────────────────────────────────────────────

const EXPECTED_FUNCTIONS = [
  "get_profile", "update_profile",
  "list_transactions", "create_transaction", "delete_transaction",
  "list_wallets", "create_wallet", "update_wallet", "delete_wallet",
  "list_categories", "create_category", "delete_category",
  "list_budgets", "upsert_budget", "delete_budget",
  "list_goals", "create_goal", "update_goal", "delete_goal",
  "deposit_to_goal", "withdraw_from_goal",
  "list_debt_loans", "create_debt_loan", "repay_debt_loan",
  "create_wallet_transfer", "get_transfer_settings", "update_transfer_settings",
  "get_category_breakdown", "get_monthly_trend", "bulk_categorize",
];

const DESTRUCTIVE_FUNCTIONS = [
  "delete_transaction", "delete_wallet", "delete_category",
  "delete_budget", "delete_goal", "withdraw_from_goal",
  "repay_debt_loan",
];

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("Registry", () => {

  describe("completeness", () => {
    const { client } = makeMockClient();
    const registry = buildRegistry(client);
    const names = new Set(registry.map(f => f.name));

    it(`contains all ${EXPECTED_FUNCTIONS.length} expected functions`, () => {
      assert.equal(registry.length, EXPECTED_FUNCTIONS.length);
    });

    for (const fn of EXPECTED_FUNCTIONS) {
      it(`has function: ${fn}`, () => {
        assert.ok(names.has(fn), `Missing: ${fn}`);
      });
    }
  });

  describe("schema integrity", () => {
    const { client } = makeMockClient();
    const registry = buildRegistry(client);

    for (const fn of registry) {
      it(`${fn.name}: has name, description, params, handler`, () => {
        assert.ok(typeof fn.name === "string" && fn.name.length > 0);
        assert.ok(typeof fn.description === "string" && fn.description.length > 0);
        assert.ok(typeof fn.params === "object");
        assert.ok(typeof fn.handler === "function");
      });

      for (const [paramName, param] of Object.entries(fn.params)) {
        it(`${fn.name}.${paramName}: has type, description, required`, () => {
          assert.ok(typeof param.type === "string", `${fn.name}.${paramName} missing type`);
          assert.ok(typeof param.description === "string", `${fn.name}.${paramName} missing description`);
          assert.ok(typeof param.required === "boolean", `${fn.name}.${paramName} missing required`);
        });
      }
    }
  });

  describe("destructive flag", () => {
    const { client } = makeMockClient();
    const registry = buildRegistry(client);
    const fnMap = new Map(registry.map(f => [f.name, f]));

    for (const name of DESTRUCTIVE_FUNCTIONS) {
      it(`${name}: is marked destructive`, () => {
        assert.ok(fnMap.get(name)?.destructive === true, `${name} should be destructive`);
      });

      it(`${name}: rejects without confirm: true`, async () => {
        const fn = fnMap.get(name)!;
        const params: Record<string, unknown> = { id: "fake-uuid", wallet_id: "fake-uuid", amount: "1000", confirm: false };
        await assert.rejects(
          () => fn.handler(client, params),
          /confirm/i
        );
      });

      it(`${name}: rejects with confirm missing`, async () => {
        const fn = fnMap.get(name)!;
        const params: Record<string, unknown> = { id: "fake-uuid", wallet_id: "fake-uuid", amount: "1000" };
        await assert.rejects(
          () => fn.handler(client, params),
          /confirm/i
        );
      });
    }

    it("non-destructive functions do not have destructive: true", () => {
      const nonDestructive = registry.filter(f => !DESTRUCTIVE_FUNCTIONS.includes(f.name));
      for (const fn of nonDestructive) {
        assert.ok(!fn.destructive, `${fn.name} should not be destructive`);
      }
    });
  });

  describe("handler routing", () => {
    it("list_wallets → GET /api/wallets", async () => {
      const { client, calls } = makeMockClient();
      const registry = buildRegistry(client);
      const fn = registry.find(f => f.name === "list_wallets")!;
      await fn.handler(client, {});
      assert.equal(calls[0].method, "GET");
      assert.equal(calls[0].path, "/api/wallets");
    });

    it("create_wallet → POST /api/wallets with body", async () => {
      const { client, calls } = makeMockClient();
      const registry = buildRegistry(client);
      const fn = registry.find(f => f.name === "create_wallet")!;
      await fn.handler(client, { name: "Gopay", type: "e-wallet", currency: "IDR" });
      assert.equal(calls[0].method, "POST");
      assert.equal(calls[0].path, "/api/wallets");
    });

    it("update_wallet → PUT /api/wallets/{id}", async () => {
      const { client, calls } = makeMockClient();
      const registry = buildRegistry(client);
      const fn = registry.find(f => f.name === "update_wallet")!;
      await fn.handler(client, { id: "abc-123", name: "Gopay+", type: "e-wallet" });
      assert.equal(calls[0].method, "PUT");
      assert.ok(calls[0].path.includes("abc-123"));
    });

    it("delete_wallet → DELETE /api/wallets/{id} when confirmed", async () => {
      const { client, calls } = makeMockClient();
      const registry = buildRegistry(client);
      const fn = registry.find(f => f.name === "delete_wallet")!;
      await fn.handler(client, { id: "abc-123", confirm: true });
      assert.equal(calls[0].method, "DELETE");
      assert.ok(calls[0].path.includes("abc-123"));
    });

    it("get_category_breakdown → GET /api/analytics/category-breakdown", async () => {
      const { client, calls } = makeMockClient();
      const registry = buildRegistry(client);
      const fn = registry.find(f => f.name === "get_category_breakdown")!;
      await fn.handler(client, { type: "expense", start_date: "2026-01-01" });
      assert.equal(calls[0].method, "GET");
      assert.ok(calls[0].path.includes("category-breakdown"));
    });

    it("deposit_to_goal → POST /api/goals/{id}/deposit", async () => {
      const { client, calls } = makeMockClient();
      const registry = buildRegistry(client);
      const fn = registry.find(f => f.name === "deposit_to_goal")!;
      await fn.handler(client, { id: "goal-123", amount: "100000", wallet_id: "wallet-1" });
      assert.equal(calls[0].method, "POST");
      assert.ok(calls[0].path.includes("goal-123"));
      assert.ok(calls[0].path.includes("deposit"));
    });

    it("withdraw_from_goal → POST /api/goals/{id}/withdraw when confirmed", async () => {
      const { client, calls } = makeMockClient();
      const registry = buildRegistry(client);
      const fn = registry.find(f => f.name === "withdraw_from_goal")!;
      await fn.handler(client, { id: "goal-123", amount: "50000", wallet_id: "wallet-1", confirm: true });
      assert.equal(calls[0].method, "POST");
      assert.ok(calls[0].path.includes("withdraw"));
    });

    it("repay_debt_loan → POST /api/debt-loans/{id}/repay when confirmed", async () => {
      const { client, calls } = makeMockClient();
      const registry = buildRegistry(client);
      const fn = registry.find(f => f.name === "repay_debt_loan")!;
      await fn.handler(client, { id: "debt-1", amount: "200000", wallet_id: "wallet-1", confirm: true });
      assert.equal(calls[0].method, "POST");
      assert.ok(calls[0].path.includes("repay"));
    });
  });
});
