import { z } from "zod";
export function registerAnalyticsTools(server, client) {
    server.tool("get_category_breakdown", "Get spending/income breakdown by category for a date range", {
        type: z.enum(["income", "expense"]).optional().describe("Filter by transaction type (optional)"),
        start_date: z.string().optional().describe("Start date in YYYY-MM-DD or RFC3339 (optional)"),
        end_date: z.string().optional().describe("End date in YYYY-MM-DD or RFC3339 (optional)"),
    }, async ({ type, start_date, end_date }) => {
        const data = await client.get("/api/analytics/category-breakdown", {
            type,
            start_date,
            end_date,
        });
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    });
    server.tool("get_monthly_trend", "Get monthly income and expense trend", {
        months: z.number().int().min(1).max(24).optional().describe("Number of months to look back (default: 6)"),
    }, async ({ months }) => {
        const data = await client.get("/api/analytics/monthly-trend", {
            months,
        });
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    });
    server.tool("bulk_categorize", "Auto-categorize multiple transactions using AI", {
        transaction_ids: z.array(z.string().uuid()).describe("Array of transaction UUIDs to categorize"),
    }, async ({ transaction_ids }) => {
        const data = await client.post("/api/analytics/bulk-categorize", { transaction_ids });
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    });
}
