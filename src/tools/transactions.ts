import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { CashActivityClient } from "../client.js";

export function registerTransactionTools(server: McpServer, client: CashActivityClient): void {
  server.tool(
    "list_transactions",
    "List all transactions for the authenticated user",
    {},
    async () => {
      const data = await client.get("/api/transactions");
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "create_transaction",
    "Create a new income or expense transaction",
    {
      amount: z.string().describe("Transaction amount as string (e.g. '50000')"),
      type: z.enum(["income", "expense"]).describe("Transaction type"),
      category: z.string().describe("Category display name"),
      category_id: z.string().uuid().optional().describe("Category UUID (optional)"),
      wallet_id: z.string().uuid().optional().describe("Wallet UUID (optional)"),
      date: z.string().optional().describe("Date in RFC3339 format (optional, defaults to now)"),
      description: z.string().optional().describe("Optional description"),
      image_url: z.string().optional().describe("Optional image URL"),
    },
    async ({ amount, type, category, category_id, wallet_id, date, description, image_url }) => {
      const data = await client.post("/api/transactions", {
        amount,
        type,
        category,
        category_id,
        wallet_id,
        date,
        description,
        image_url,
      });
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "delete_transaction",
    "Delete a transaction by ID. ⚠️ Irreversible — requires confirm: true",
    {
      id: z.string().uuid().describe("Transaction UUID"),
      confirm: z.boolean().describe("Must be true to confirm deletion"),
    },
    async ({ id, confirm }) => {
      if (!confirm) {
        return { content: [{ type: "text", text: "Set confirm: true to proceed with this destructive action." }] };
      }
      await client.delete(`/api/transactions/${id}`);
      return { content: [{ type: "text", text: `Transaction ${id} deleted successfully.` }] };
    }
  );
}
