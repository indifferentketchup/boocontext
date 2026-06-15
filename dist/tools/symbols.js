import { makeVerdict } from "../verdict.js";
export function createSymbolsTool(manager) {
    return {
        name: "boocontext_symbols",
        description: "BM25-ranked symbol search. Calls tree-sitter-analyzer for semantic code search. Returns ranked results matching the query.",
        inputSchema: {
            type: "object",
            properties: {
                query: { type: "string", description: "Search query" },
                directory: { type: "string", description: "Directory to search (defaults to cwd)" },
            },
            required: ["query"],
        },
        async handler(args) {
            const start = Date.now();
            try {
                const tsaClient = await manager.getServer("tree-sitter-analyzer");
                if (args.directory) {
                    await tsaClient.callTool({ name: "set_project_path", arguments: { project_path: args.directory } });
                }
                const result = await tsaClient.callTool({
                    name: "search",
                    arguments: { action: "content", query: args.query },
                });
                return makeVerdict("INFO", `Symbol search for "${args.query}"`, result, {
                    tool: "boocontext_symbols",
                    source: "tree-sitter-analyzer",
                    duration_ms: Date.now() - start,
                });
            }
            catch (err) {
                return makeVerdict("UNSAFE", `Symbol search failed: ${err.message}`, { error: err.message }, {
                    tool: "boocontext_symbols",
                    source: "tree-sitter-analyzer",
                    duration_ms: Date.now() - start,
                });
            }
        },
    };
}
