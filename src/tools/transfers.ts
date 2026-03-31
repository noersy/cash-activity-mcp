import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { CashActivityClient } from "../client.js";

export function registerTransferTools(server: McpServer, client: CashActivityClient): void {
  server.tool(
    "create_wallet_transfer",
    "Transfer funds between two wallets",
    {
      source_wallet_id: z.string().uuid().describe("Source wallet UUID"),
      destination_wallet_id: z.string().uuid().describe("Destination wallet UUID"),
      amount: z.string().describe("Transfer amount as string"),
      scanned_from_receipt: z.boolean().optional().describe("Whether this was scanned from a receipt (optional)"),
    },
    async ({ source_wallet_id, destination_wallet_id, amount, scanned_from_receipt }) => {
      const data = await client.post("/api/wallet-transfers", {
        source_wallet_id,
        destination_wallet_id,
        amount,
        scanned_from_receipt: scanned_from_receipt ?? false,
      });
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );
}
