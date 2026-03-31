/**
 * Function Registry — defines all available Cash Activity API operations.
 * Used by the `search` and `execute` meta-tools.
 */

import { CashActivityClient } from "./client.js";

export interface ParamDef {
  type: string;
  description: string;
  required: boolean;
  enum?: string[];
}

export interface FunctionDef {
  name: string;
  description: string;
  params: Record<string, ParamDef>;
  destructive?: boolean; // requires confirm: true
  handler: (client: CashActivityClient, params: Record<string, unknown>) => Promise<unknown>;
}

export function buildRegistry(client: CashActivityClient): FunctionDef[] {
  return [
    // ── Auth (read-only operations) ───────────────────────────────────────

    {
      name: "get_profile",
      description: "Get the current user's profile",
      params: {},
      handler: async () => client.get("/api/profile"),
    },
    {
      name: "update_profile",
      description: "Update the current user's profile",
      params: {
        full_name: { type: "string", description: "Full name", required: false },
        avatar_url: { type: "string", description: "Avatar URL", required: false },
        currency: { type: "string", description: "Preferred currency code (e.g. IDR)", required: false },
      },
      handler: async (_, p) => client.put("/api/profile", p),
    },

    // ── Transactions ──────────────────────────────────────────────────────

    {
      name: "list_transactions",
      description: "List all transactions for the current user",
      params: {},
      handler: async () => client.get("/api/transactions"),
    },
    {
      name: "create_transaction",
      description: "Create a new income or expense transaction",
      params: {
        amount: { type: "string", description: "Amount as string e.g. '50000'", required: true },
        type: { type: "string", description: "income or expense", required: true, enum: ["income", "expense"] },
        category: { type: "string", description: "Category display name", required: true },
        category_id: { type: "string", description: "Category UUID (optional)", required: false },
        wallet_id: { type: "string", description: "Wallet UUID (optional)", required: false },
        date: { type: "string", description: "RFC3339 date (optional, defaults to now)", required: false },
        description: { type: "string", description: "Optional description", required: false },
        image_url: { type: "string", description: "Optional image URL", required: false },
      },
      handler: async (_, p) => client.post("/api/transactions", p),
    },
    {
      name: "delete_transaction",
      description: "Delete a transaction by ID. Irreversible.",
      params: {
        id: { type: "string", description: "Transaction UUID", required: true },
        confirm: { type: "boolean", description: "Must be true to confirm deletion", required: true },
      },
      destructive: true,
      handler: async (_, p) => {
        if (!p.confirm) throw new Error("Set confirm: true to proceed with this destructive action.");
        return client.delete(`/api/transactions/${p.id}`);
      },
    },

    // ── Wallets ───────────────────────────────────────────────────────────

    {
      name: "list_wallets",
      description: "List all wallets",
      params: {},
      handler: async () => client.get("/api/wallets"),
    },
    {
      name: "create_wallet",
      description: "Create a new wallet",
      params: {
        name: { type: "string", description: "Wallet name", required: true },
        type: { type: "string", description: "Wallet type e.g. cash, bank, e-wallet", required: true },
        currency: { type: "string", description: "Currency code e.g. IDR", required: true },
      },
      handler: async (_, p) => client.post("/api/wallets", p),
    },
    {
      name: "update_wallet",
      description: "Update wallet name or type",
      params: {
        id: { type: "string", description: "Wallet UUID", required: true },
        name: { type: "string", description: "New wallet name", required: true },
        type: { type: "string", description: "New wallet type", required: true },
      },
      handler: async (_, p) => client.put(`/api/wallets/${p.id}`, { name: p.name, type: p.type }),
    },
    {
      name: "delete_wallet",
      description: "Delete a wallet by ID. Irreversible.",
      params: {
        id: { type: "string", description: "Wallet UUID", required: true },
        confirm: { type: "boolean", description: "Must be true", required: true },
      },
      destructive: true,
      handler: async (_, p) => {
        if (!p.confirm) throw new Error("Set confirm: true to proceed with this destructive action.");
        return client.delete(`/api/wallets/${p.id}`);
      },
    },

    // ── Categories ────────────────────────────────────────────────────────

    {
      name: "list_categories",
      description: "List all transaction categories",
      params: {},
      handler: async () => client.get("/api/categories"),
    },
    {
      name: "create_category",
      description: "Create a new category",
      params: {
        name: { type: "string", description: "Category name", required: true },
        type: { type: "string", description: "income or expense", required: true, enum: ["income", "expense"] },
        icon: { type: "string", description: "Icon identifier (optional)", required: false },
        color: { type: "string", description: "Color hex e.g. #FF5733 (optional)", required: false },
      },
      handler: async (_, p) => client.post("/api/categories", p),
    },
    {
      name: "delete_category",
      description: "Delete a category by ID. Irreversible.",
      params: {
        id: { type: "string", description: "Category UUID", required: true },
        confirm: { type: "boolean", description: "Must be true", required: true },
      },
      destructive: true,
      handler: async (_, p) => {
        if (!p.confirm) throw new Error("Set confirm: true to proceed with this destructive action.");
        return client.delete(`/api/categories/${p.id}`);
      },
    },

    // ── Budgets ───────────────────────────────────────────────────────────

    {
      name: "list_budgets",
      description: "List all budgets with category info",
      params: {},
      handler: async () => client.get("/api/budgets"),
    },
    {
      name: "upsert_budget",
      description: "Create or update a budget for a category",
      params: {
        category_id: { type: "string", description: "Category UUID", required: true },
        amount: { type: "string", description: "Budget amount as string", required: true },
      },
      handler: async (_, p) => client.post("/api/budgets", p),
    },
    {
      name: "delete_budget",
      description: "Delete a budget. Irreversible.",
      params: {
        id: { type: "string", description: "Budget UUID", required: true },
        confirm: { type: "boolean", description: "Must be true", required: true },
      },
      destructive: true,
      handler: async (_, p) => {
        if (!p.confirm) throw new Error("Set confirm: true to proceed with this destructive action.");
        return client.delete(`/api/budgets/${p.id}`);
      },
    },

    // ── Goals ─────────────────────────────────────────────────────────────

    {
      name: "list_goals",
      description: "List all savings goals",
      params: {},
      handler: async () => client.get("/api/goals"),
    },
    {
      name: "create_goal",
      description: "Create a new savings goal",
      params: {
        name: { type: "string", description: "Goal name", required: true },
        target_amount: { type: "string", description: "Target amount as string", required: true },
        deadline: { type: "string", description: "Deadline YYYY-MM-DD or RFC3339", required: true },
        icon_path: { type: "string", description: "Icon path (optional)", required: false },
        color_hex: { type: "string", description: "Color hex (optional)", required: false },
      },
      handler: async (_, p) => client.post("/api/goals", p),
    },
    {
      name: "update_goal",
      description: "Update an existing savings goal",
      params: {
        id: { type: "string", description: "Goal UUID", required: true },
        name: { type: "string", description: "Goal name", required: true },
        target_amount: { type: "string", description: "Target amount as string", required: true },
        deadline: { type: "string", description: "Deadline date", required: true },
        icon_path: { type: "string", description: "Icon path (optional)", required: false },
        color_hex: { type: "string", description: "Color hex (optional)", required: false },
      },
      handler: async (_, p) => client.put(`/api/goals/${p.id}`, { name: p.name, target_amount: p.target_amount, deadline: p.deadline, icon_path: p.icon_path, color_hex: p.color_hex }),
    },
    {
      name: "delete_goal",
      description: "Delete a savings goal. Irreversible.",
      params: {
        id: { type: "string", description: "Goal UUID", required: true },
        confirm: { type: "boolean", description: "Must be true", required: true },
      },
      destructive: true,
      handler: async (_, p) => {
        if (!p.confirm) throw new Error("Set confirm: true to proceed with this destructive action.");
        return client.delete(`/api/goals/${p.id}`);
      },
    },
    {
      name: "deposit_to_goal",
      description: "Deposit savings into a goal from a wallet",
      params: {
        id: { type: "string", description: "Goal UUID", required: true },
        amount: { type: "string", description: "Amount to deposit", required: true },
        wallet_id: { type: "string", description: "Source wallet UUID", required: true },
      },
      handler: async (_, p) => client.post(`/api/goals/${p.id}/deposit`, { amount: p.amount, wallet_id: p.wallet_id }),
    },
    {
      name: "withdraw_from_goal",
      description: "Withdraw savings from a goal back to wallet. Irreversible.",
      params: {
        id: { type: "string", description: "Goal UUID", required: true },
        amount: { type: "string", description: "Amount to withdraw", required: true },
        wallet_id: { type: "string", description: "Destination wallet UUID", required: true },
        confirm: { type: "boolean", description: "Must be true", required: true },
      },
      destructive: true,
      handler: async (_, p) => {
        if (!p.confirm) throw new Error("Set confirm: true to proceed with this destructive action.");
        return client.post(`/api/goals/${p.id}/withdraw`, { amount: p.amount, wallet_id: p.wallet_id });
      },
    },

    // ── Debt & Loans ──────────────────────────────────────────────────────

    {
      name: "list_debt_loans",
      description: "List all debts and loans",
      params: {},
      handler: async () => client.get("/api/debt-loans"),
    },
    {
      name: "create_debt_loan",
      description: "Record a new debt or loan. DEBT = you owe; LOAN = someone owes you.",
      params: {
        type: { type: "string", description: "DEBT or LOAN", required: true, enum: ["DEBT", "LOAN"] },
        amount: { type: "string", description: "Amount as string", required: true },
        counterparty_name: { type: "string", description: "Name of the other party", required: true },
        wallet_id: { type: "string", description: "Wallet UUID", required: true },
        description: { type: "string", description: "Optional description", required: false },
        due_date: { type: "string", description: "Due date YYYY-MM-DD (optional)", required: false },
      },
      handler: async (_, p) => client.post("/api/debt-loans", p),
    },
    {
      name: "repay_debt_loan",
      description: "Record repayment for a debt or loan. Irreversible.",
      params: {
        id: { type: "string", description: "Debt/Loan UUID", required: true },
        amount: { type: "string", description: "Repayment amount", required: true },
        wallet_id: { type: "string", description: "Wallet to deduct from", required: true },
        confirm: { type: "boolean", description: "Must be true", required: true },
      },
      destructive: true,
      handler: async (_, p) => {
        if (!p.confirm) throw new Error("Set confirm: true to proceed with this destructive action.");
        return client.post(`/api/debt-loans/${p.id}/repay`, { amount: p.amount, wallet_id: p.wallet_id });
      },
    },

    // ── Transfers ─────────────────────────────────────────────────────────

    {
      name: "create_wallet_transfer",
      description: "Transfer funds between two wallets",
      params: {
        source_wallet_id: { type: "string", description: "Source wallet UUID", required: true },
        destination_wallet_id: { type: "string", description: "Destination wallet UUID", required: true },
        amount: { type: "string", description: "Amount to transfer", required: true },
        scanned_from_receipt: { type: "boolean", description: "From receipt scan? (optional)", required: false },
      },
      handler: async (_, p) => client.post("/api/wallet-transfers", p),
    },
    {
      name: "get_transfer_settings",
      description: "Get wallet transfer fee/settings configuration",
      params: {},
      handler: async () => client.get("/api/transfer-settings"),
    },
    {
      name: "update_transfer_settings",
      description: "Update wallet transfer settings",
      params: {
        settings: { type: "object", description: "Settings key-value pairs to update", required: true },
      },
      handler: async (_, p) => client.put("/api/transfer-settings", p.settings),
    },

    // ── Analytics ─────────────────────────────────────────────────────────

    {
      name: "get_category_breakdown",
      description: "Get spending/income breakdown by category for a date range",
      params: {
        type: { type: "string", description: "income or expense (optional)", required: false, enum: ["income", "expense"] },
        start_date: { type: "string", description: "Start date YYYY-MM-DD (optional)", required: false },
        end_date: { type: "string", description: "End date YYYY-MM-DD (optional)", required: false },
      },
      handler: async (_, p) => client.get("/api/analytics/category-breakdown", p as Record<string, string>),
    },
    {
      name: "get_monthly_trend",
      description: "Get monthly income vs expense trend",
      params: {
        months: { type: "number", description: "Number of months to look back (default 6, max 24)", required: false },
      },
      handler: async (_, p) => client.get("/api/analytics/monthly-trend", p as Record<string, number>),
    },
    {
      name: "bulk_categorize",
      description: "Auto-categorize multiple transactions using AI",
      params: {
        transaction_ids: { type: "array", description: "Array of transaction UUIDs", required: true },
      },
      handler: async (_, p) => client.post("/api/analytics/bulk-categorize", p),
    },
  ];
}
