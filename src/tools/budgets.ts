import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { CashActivityClient } from "../client.js";

export function registerBudgetTools(server: McpServer, client: CashActivityClient): void {
  server.tool(
    "list_budgets",
    "List all budgets with their category info",
    {},
    async () => {
      const data = await client.get("/api/budgets");
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "upsert_budget",
    "Create or update a budget for a category",
    {
      category_id: z.string().uuid().describe("Category UUID"),
      amount: z.string().describe("Budget amount as string (e.g. '500000')"),
    },
    async ({ category_id, amount }) => {
      const data = await client.post("/api/budgets", { category_id, amount });
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "delete_budget",
    "Delete a budget by ID. ⚠️ Irreversible — requires confirm: true",
    {
      id: z.string().uuid().describe("Budget UUID"),
      confirm: z.boolean().describe("Must be true to confirm deletion"),
    },
    async ({ id, confirm }) => {
      if (!confirm) {
        return { content: [{ type: "text", text: "Set confirm: true to proceed with this destructive action." }] };
      }
      await client.delete(`/api/budgets/${id}`);
      return { content: [{ type: "text", text: `Budget ${id} deleted successfully.` }] };
    }
  );
}
