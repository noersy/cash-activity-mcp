import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { CashActivityClient } from "../client.js";

export function registerProfileTools(server: McpServer, client: CashActivityClient): void {
  server.tool(
    "get_profile",
    "Get the current user's profile",
    {},
    async () => {
      const data = await client.get("/api/profile");
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "update_profile",
    "Update the current user's profile",
    {
      full_name: z.string().optional().describe("Full name (optional)"),
      avatar_url: z.string().optional().describe("Avatar URL (optional)"),
      currency: z.string().optional().describe("Preferred currency code (optional)"),
    },
    async ({ full_name, avatar_url, currency }) => {
      const data = await client.put("/api/profile", { full_name, avatar_url, currency });
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );
}
