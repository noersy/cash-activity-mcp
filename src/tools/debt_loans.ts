import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { CashActivityClient } from "../client.js";

export function registerDebtLoanTools(server: McpServer, client: CashActivityClient): void {
  server.tool(
    "list_debt_loans",
    "List all debts and loans",
    {},
    async () => {
      const data = await client.get("/api/debt-loans");
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "create_debt_loan",
    "Record a new debt or loan",
    {
      type: z.enum(["DEBT", "LOAN"]).describe("DEBT = you owe someone; LOAN = someone owes you"),
      amount: z.string().describe("Amount as string"),
      counterparty_name: z.string().describe("Name of the person you owe or who owes you"),
      wallet_id: z.string().uuid().describe("Wallet UUID to associate with this record"),
      description: z.string().optional().describe("Optional description"),
      due_date: z.string().optional().describe("Due date in RFC3339 or YYYY-MM-DD format (optional)"),
    },
    async ({ type, amount, counterparty_name, wallet_id, description, due_date }) => {
      const data = await client.post("/api/debt-loans", {
        type,
        amount,
        counterparty_name,
        wallet_id,
        description,
        due_date,
      });
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "repay_debt_loan",
    "Record a repayment for a debt or loan. ⚠️ Requires confirm: true",
    {
      id: z.string().uuid().describe("Debt/Loan UUID"),
      amount: z.string().describe("Repayment amount as string"),
      wallet_id: z.string().uuid().describe("Wallet UUID to deduct from"),
      confirm: z.boolean().describe("Must be true to confirm repayment"),
    },
    async ({ id, amount, wallet_id, confirm }) => {
      if (!confirm) {
        return { content: [{ type: "text", text: "Set confirm: true to proceed with this destructive action." }] };
      }
      const data = await client.post(`/api/debt-loans/${id}/repay`, { amount, wallet_id });
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );
}
