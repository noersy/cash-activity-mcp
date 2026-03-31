import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CashActivityClient } from "./client.js";
import { registerTransactionTools } from "./tools/transactions.js";
import { registerWalletTools } from "./tools/wallets.js";
import { registerCategoryTools } from "./tools/categories.js";
import { registerBudgetTools } from "./tools/budgets.js";
import { registerGoalTools } from "./tools/goals.js";
import { registerDebtLoanTools } from "./tools/debt_loans.js";
import { registerTransferTools } from "./tools/transfers.js";
import { registerTransferSettingsTools } from "./tools/transfer_settings.js";
import { registerAnalyticsTools } from "./tools/analytics.js";
import { registerProfileTools } from "./tools/profile.js";
async function main() {
    const client = new CashActivityClient();
    const server = new McpServer({
        name: "cash-activity",
        version: "1.0.0",
    });
    // Register all tool groups
    registerTransactionTools(server, client);
    registerWalletTools(server, client);
    registerCategoryTools(server, client);
    registerBudgetTools(server, client);
    registerGoalTools(server, client);
    registerDebtLoanTools(server, client);
    registerTransferTools(server, client);
    registerTransferSettingsTools(server, client);
    registerAnalyticsTools(server, client);
    registerProfileTools(server, client);
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("Cash Activity MCP server running on stdio");
}
main().catch((err) => {
    console.error("Fatal error:", err);
    process.exit(1);
});
