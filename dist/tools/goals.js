import { z } from "zod";
export function registerGoalTools(server, client) {
    server.tool("list_goals", "List all savings goals", {}, async () => {
        const data = await client.get("/api/goals");
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    });
    server.tool("create_goal", "Create a new savings goal", {
        name: z.string().describe("Goal name"),
        target_amount: z.string().describe("Target savings amount as string"),
        deadline: z.string().describe("Deadline date in RFC3339 or YYYY-MM-DD format"),
        icon_path: z.string().optional().describe("Optional icon path"),
        color_hex: z.string().optional().describe("Optional color hex (e.g. '#FF5733')"),
    }, async ({ name, target_amount, deadline, icon_path, color_hex }) => {
        const data = await client.post("/api/goals", { name, target_amount, deadline, icon_path, color_hex });
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    });
    server.tool("update_goal", "Update an existing savings goal", {
        id: z.string().uuid().describe("Goal UUID"),
        name: z.string().describe("Goal name"),
        target_amount: z.string().describe("Target savings amount as string"),
        deadline: z.string().describe("Deadline date in RFC3339 or YYYY-MM-DD format"),
        icon_path: z.string().optional().describe("Optional icon path"),
        color_hex: z.string().optional().describe("Optional color hex"),
    }, async ({ id, name, target_amount, deadline, icon_path, color_hex }) => {
        const data = await client.put(`/api/goals/${id}`, { name, target_amount, deadline, icon_path, color_hex });
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    });
    server.tool("delete_goal", "Delete a savings goal. ⚠️ Irreversible — requires confirm: true", {
        id: z.string().uuid().describe("Goal UUID"),
        confirm: z.boolean().describe("Must be true to confirm deletion"),
    }, async ({ id, confirm }) => {
        if (!confirm) {
            return { content: [{ type: "text", text: "Set confirm: true to proceed with this destructive action." }] };
        }
        await client.delete(`/api/goals/${id}`);
        return { content: [{ type: "text", text: `Goal ${id} deleted successfully.` }] };
    });
    server.tool("deposit_to_goal", "Deposit savings into a goal from a wallet", {
        id: z.string().uuid().describe("Goal UUID"),
        amount: z.string().describe("Deposit amount as string"),
        wallet_id: z.string().uuid().describe("Source wallet UUID"),
    }, async ({ id, amount, wallet_id }) => {
        const data = await client.post(`/api/goals/${id}/deposit`, { amount, wallet_id });
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    });
    server.tool("withdraw_from_goal", "Withdraw savings from a goal back to a wallet. ⚠️ Requires confirm: true", {
        id: z.string().uuid().describe("Goal UUID"),
        amount: z.string().describe("Withdrawal amount as string"),
        wallet_id: z.string().uuid().describe("Destination wallet UUID"),
        confirm: z.boolean().describe("Must be true to confirm withdrawal"),
    }, async ({ id, amount, wallet_id, confirm }) => {
        if (!confirm) {
            return { content: [{ type: "text", text: "Set confirm: true to proceed with this destructive action." }] };
        }
        const data = await client.post(`/api/goals/${id}/withdraw`, { amount, wallet_id });
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    });
}
