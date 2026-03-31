import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { CashActivityClient } from "./client.js";
import { buildRegistry } from "./registry.js";
async function main() {
    const client = new CashActivityClient();
    const registry = buildRegistry(client);
    // Build a name→def map for O(1) lookup
    const fnMap = new Map(registry.map((f) => [f.name, f]));
    const server = new McpServer({
        name: "cash-activity",
        version: "2.0.0",
    });
    // ── Tool 1: search ────────────────────────────────────────────────────────
    //
    // Searches the function registry by keyword.
    // Returns matching function names, descriptions, and parameter schemas.
    // Use this first to discover what functions are available.
    server.tool("search", "Search available Cash Activity API functions by keyword. Returns function names, descriptions, and parameter schemas. Call this first to discover what functions exist before calling `execute`.", {
        query: z.string().describe("Keyword to search (e.g. 'wallet', 'transaction', 'goal', 'analytics')"),
        limit: z.number().int().min(1).max(20).optional().describe("Max results to return (default: 10)"),
    }, async ({ query, limit = 10 }) => {
        const q = query.toLowerCase();
        const results = registry
            .filter((f) => f.name.includes(q) ||
            f.description.toLowerCase().includes(q) ||
            Object.keys(f.params).some((k) => k.includes(q)))
            .slice(0, limit)
            .map((f) => ({
            name: f.name,
            description: f.description,
            destructive: f.destructive ?? false,
            params: Object.fromEntries(Object.entries(f.params).map(([k, v]) => [
                k,
                {
                    type: v.type,
                    description: v.description,
                    required: v.required,
                    ...(v.enum ? { enum: v.enum } : {}),
                },
            ])),
        }));
        if (results.length === 0) {
            return {
                content: [
                    {
                        type: "text",
                        text: `No functions matched "${query}". Try broader terms like: wallet, transaction, budget, goal, category, debt, transfer, analytics, profile.`,
                    },
                ],
            };
        }
        return {
            content: [
                {
                    type: "text",
                    text: JSON.stringify(results, null, 2),
                },
            ],
        };
    });
    // ── Tool 2: execute ───────────────────────────────────────────────────────
    //
    // Executes a Cash Activity API function by name with given parameters.
    // Use `search` first to discover the function name and required params.
    server.tool("execute", "Execute a Cash Activity API function by name. Use `search` first to discover available function names and their parameter schemas. Destructive functions require `confirm: true` in params.", {
        function: z.string().describe("Function name to execute (from search results)"),
        params: z.record(z.string(), z.unknown()).optional().describe("Parameters to pass to the function"),
    }, async ({ function: fnName, params = {} }) => {
        const fn = fnMap.get(fnName);
        if (!fn) {
            const suggestions = registry
                .filter((f) => f.name.includes(fnName.split("_")[0] ?? ""))
                .slice(0, 5)
                .map((f) => f.name);
            return {
                content: [
                    {
                        type: "text",
                        text: `Unknown function: "${fnName}". Use the \`search\` tool to find valid function names.${suggestions.length > 0 ? `\n\nDid you mean: ${suggestions.join(", ")}?` : ""}`,
                    },
                ],
            };
        }
        try {
            const result = await fn.handler(client, params);
            return {
                content: [
                    {
                        type: "text",
                        text: result === null || result === undefined
                            ? "Success (no content returned)."
                            : JSON.stringify(result, null, 2),
                    },
                ],
            };
        }
        catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            return {
                content: [{ type: "text", text: `Error: ${msg}` }],
            };
        }
    });
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("Cash Activity MCP v2.0.0 running on stdio (2 tools: search + execute)");
}
main().catch((err) => {
    console.error("Fatal error:", err);
    process.exit(1);
});
