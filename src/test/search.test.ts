/**
 * Unit tests for search tool logic
 * Tests: keyword matching, limit, no results, param schema in output
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

process.env.CASH_API_URL = "https://fake-api.test";
process.env.CASH_API_EMAIL = "test@example.com";
process.env.CASH_API_PASSWORD = "testpass";

const { buildRegistry } = await import("../registry.js");
const { CashActivityClient } = await import("../client.js");

// Replicate the search logic from index.ts so it can be tested independently
function search(registry: ReturnType<typeof buildRegistry>, query: string, limit = 10) {
  const q = query.toLowerCase();
  return registry
    .filter(f =>
      f.name.includes(q) ||
      f.description.toLowerCase().includes(q) ||
      Object.keys(f.params).some(k => k.includes(q))
    )
    .slice(0, limit)
    .map(f => ({
      name: f.name,
      description: f.description,
      destructive: f.destructive ?? false,
      params: f.params,
    }));
}

describe("search tool logic", () => {
  type MockClient = InstanceType<typeof CashActivityClient>;
  const client = {
    get: async () => ({}),
    post: async () => ({}),
    put: async () => ({}),
    delete: async () => null,
  } as unknown as MockClient;

  const registry = buildRegistry(client);

  it("returns results matching function name", () => {
    const results = search(registry, "wallet");
    assert.ok(results.length > 0);
    // All results should match on name OR description OR a param name
    assert.ok(results.every(r =>
      r.name.includes("wallet") ||
      r.description.toLowerCase().includes("wallet") ||
      Object.keys(r.params).some(k => k.includes("wallet"))
    ));
  });

  it("returns results matching description keyword", () => {
    const results = search(registry, "savings");
    assert.ok(results.length > 0);
    assert.ok(results.some(r => r.description.toLowerCase().includes("savings")));
  });

  it("returns results matching param name", () => {
    const results = search(registry, "counterparty");
    assert.ok(results.length > 0);
    assert.ok(results.some(r => Object.keys(r.params).includes("counterparty_name")));
  });

  it("returns empty array for unmatched query", () => {
    const results = search(registry, "zzznomatch_xyzabc");
    assert.equal(results.length, 0);
  });

  it("respects limit parameter", () => {
    const results = search(registry, "a", 3); // 'a' matches many things
    assert.ok(results.length <= 3);
  });

  it("default limit is 10", () => {
    const results = search(registry, "e"); // 'e' matches almost everything
    assert.ok(results.length <= 10);
  });

  it("each result includes name, description, destructive, params", () => {
    const results = search(registry, "wallet");
    for (const r of results) {
      assert.ok("name" in r);
      assert.ok("description" in r);
      assert.ok("destructive" in r);
      assert.ok("params" in r);
    }
  });

  it("destructive functions appear with destructive: true", () => {
    const results = search(registry, "delete");
    assert.ok(results.length > 0);
    assert.ok(results.every(r => r.destructive === true));
  });

  it("search 'transaction' returns create, list, delete", () => {
    const results = search(registry, "transaction");
    const names = results.map(r => r.name);
    assert.ok(names.includes("list_transactions"));
    assert.ok(names.includes("create_transaction"));
    assert.ok(names.includes("delete_transaction"));
  });

  it("search 'breakdown' returns get_category_breakdown", () => {
    const results = search(registry, "breakdown");
    const names = results.map(r => r.name);
    assert.ok(names.includes("get_category_breakdown"));
  });

  it("search 'monthly' returns get_monthly_trend", () => {
    const results = search(registry, "monthly");
    const names = results.map(r => r.name);
    assert.ok(names.includes("get_monthly_trend"));
  });

  it("search 'trend' returns get_monthly_trend", () => {
    const results = search(registry, "trend");
    const names = results.map(r => r.name);
    assert.ok(names.includes("get_monthly_trend"));
  });

  it("case-insensitive matching", () => {
    const lower = search(registry, "wallet");
    const upper = search(registry, "WALLET");
    assert.equal(lower.length, upper.length);
    assert.deepEqual(lower.map(r => r.name), upper.map(r => r.name));
  });
});
