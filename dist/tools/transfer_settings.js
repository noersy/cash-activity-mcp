import { z } from "zod";
export function registerTransferSettingsTools(server, client) {
    server.tool("get_transfer_settings", "Get the current wallet transfer fee/settings configuration", {}, async () => {
        const data = await client.get("/api/transfer-settings");
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    });
    server.tool("update_transfer_settings", "Update wallet transfer settings", {
        settings: z.record(z.string(), z.unknown()).describe("Settings object to update (key-value pairs)"),
    }, async ({ settings }) => {
        const data = await client.put("/api/transfer-settings", settings);
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    });
}
