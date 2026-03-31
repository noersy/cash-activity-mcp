import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { CashActivityClient } from "../client.js";

export function registerCategoryTools(server: McpServer, client: CashActivityClient): void {
  server.tool(
    "list_categories",
    "List all categories for the authenticated user",
    {},
    async () => {
      const data = await client.get("/api/categories");
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "create_category",
    "Create a new transaction category",
    {
      name: z.string().describe("Category name"),
      type: z.enum(["income", "expense"]).describe("Category type"),
      icon: z.string().optional().describe("Icon identifier (optional)"),
      color: z.string().optional().describe("Color hex code (optional)"),
    },
    async ({ name, type, icon, color }) => {
      const data = await client.post("/api/categories", { name, type, icon, color });
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "delete_category",
    "Delete a category by ID. ⚠️ Irreversible — requires confirm: true",
    {
      id: z.string().uuid().describe("Category UUID"),
      confirm: z.boolean().describe("Must be true to confirm deletion"),
    },
    async ({ id, confirm }) => {
      if (!confirm) {
        return { content: [{ type: "text", text: "Set confirm: true to proceed with this destructive action." }] };
      }
      await client.delete(`/api/categories/${id}`);
      return { content: [{ type: "text", text: `Category ${id} deleted successfully.` }] };
    }
  );
}
