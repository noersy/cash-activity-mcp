import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { CashActivityClient } from "../client.js";

export function registerWalletTools(server: McpServer, client: CashActivityClient): void {
  server.tool(
    "list_wallets",
    "List all wallets for the authenticated user",
    {},
    async () => {
      const data = await client.get("/api/wallets");
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "create_wallet",
    "Create a new wallet",
    {
      name: z.string().describe("Wallet name"),
      type: z.string().describe("Wallet type (e.g. 'cash', 'bank', 'e-wallet')"),
      currency: z.string().describe("Currency code (e.g. 'IDR', 'USD')"),
    },
    async ({ name, type, currency }) => {
      const data = await client.post("/api/wallets", { name, type, currency });
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "update_wallet",
    "Update a wallet's name or type",
    {
      id: z.string().uuid().describe("Wallet UUID"),
      name: z.string().describe("New wallet name"),
      type: z.string().describe("New wallet type"),
    },
    async ({ id, name, type }) => {
      const data = await client.put(`/api/wallets/${id}`, { name, type });
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "delete_wallet",
    "Delete a wallet by ID. ⚠️ Irreversible — requires confirm: true",
    {
      id: z.string().uuid().describe("Wallet UUID"),
      confirm: z.boolean().describe("Must be true to confirm deletion"),
    },
    async ({ id, confirm }) => {
      if (!confirm) {
        return { content: [{ type: "text", text: "Set confirm: true to proceed with this destructive action." }] };
      }
      await client.delete(`/api/wallets/${id}`);
      return { content: [{ type: "text", text: `Wallet ${id} deleted successfully.` }] };
    }
  );
}
