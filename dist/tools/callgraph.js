import { makeVerdict } from "../verdict.js";
export function createCallgraphTool(manager) {
    return {
        name: "boocontext_callgraph",
        description: "Call graph analysis. Calls tree-sitter-analyzer callers, callees, or call_graph depending on direction arg. Use to trace function call relationships.",
        inputSchema: {
            type: "object",
            properties: {
                symbol: { type: "string", description: "Symbol (function/class) to analyze" },
                direction: {
                    type: "string",
                    enum: ["callers", "callees", "both"],
                    description: "Direction to traverse (default: both)",
                },
                depth: { type: "number", description: "Max traversal depth (default: 1)" },
                file: { type: "string", description: "Optional: restrict to a specific file" },
            },
            required: ["symbol"],
        },
        async handler(args) {
            const start = Date.now();
            try {
                const tsaClient = await manager.getServer("tree-sitter-analyzer");
                if (args.directory) {
                    await tsaClient.callTool({ name: "set_project_path", arguments: { project_path: args.directory } });
                }
                const direction = args.direction ?? "both";
                if (direction === "both") {
                    const navArgs = { symbol: args.symbol, scope: "project" };
                    const [callersResult, calleesResult] = await Promise.all([
                        tsaClient.callTool({ name: "nav", arguments: { action: "callers", ...navArgs } }),
                        tsaClient.callTool({ name: "nav", arguments: { action: "callees", ...navArgs } }),
                    ]);
                    return makeVerdict("INFO", `Call graph for "${args.symbol}" (callers + callees)`, {
                        callers: callersResult,
                        callees: calleesResult,
                    }, {
                        tool: "boocontext_callgraph",
                        source: "tree-sitter-analyzer",
                        duration_ms: Date.now() - start,
                    });
                }
                const result = await tsaClient.callTool({
                    name: "nav",
                    arguments: { action: direction, symbol: args.symbol, scope: "project" },
                });
                return makeVerdict("INFO", `${direction} for "${args.symbol}"`, result, {
                    tool: "boocontext_callgraph",
                    source: "tree-sitter-analyzer",
                    duration_ms: Date.now() - start,
                });
            }
            catch (err) {
                return makeVerdict("UNSAFE", `Call graph analysis failed: ${err.message}`, { error: err.message }, {
                    tool: "boocontext_callgraph",
                    source: "tree-sitter-analyzer",
                    duration_ms: Date.now() - start,
                });
            }
        },
    };
}
