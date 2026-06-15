import { makeVerdict } from "../verdict.js";
export function createHealthTool(manager) {
    return {
        name: "boocontext_health",
        description: "Code health analysis. Calls tree-sitter-analyzer to get A–F grades. Returns aggregate grades and per-file breakdown.",
        inputSchema: {
            type: "object",
            properties: {
                directory: { type: "string", description: "Directory to analyze (defaults to cwd)" },
                file: { type: "string", description: "Optional: specific file to analyze" },
            },
        },
        async handler(args) {
            const start = Date.now();
            try {
                const tsaClient = await manager.getServer("tree-sitter-analyzer");
                if (args.directory) {
                    await tsaClient.callTool({ name: "set_project_path", arguments: { project_path: args.directory } });
                }
                if (args.file) {
                    const result = await tsaClient.callTool({ name: "health", arguments: { action: "file", file_path: args.file, scope: "file" } });
                    return makeVerdict("INFO", `Health for ${args.file}`, result, {
                        tool: "boocontext_health",
                        source: "tree-sitter-analyzer",
                        duration_ms: Date.now() - start,
                    });
                }
                const result = await tsaClient.callTool({ name: "health", arguments: { action: "project", scope: "project" } });
                const text = extractText(result);
                const hasDF = /[DF]\s*:/i.test(text);
                const verdict = hasDF ? "CAUTION" : "INFO";
                return makeVerdict(verdict, hasDF ? "Some files scored D–F" : "All files healthy", result, {
                    tool: "boocontext_health",
                    source: "tree-sitter-analyzer",
                    duration_ms: Date.now() - start,
                });
            }
            catch (err) {
                return makeVerdict("UNSAFE", `Health check failed: ${err.message}`, { error: err.message }, {
                    tool: "boocontext_health",
                    source: "tree-sitter-analyzer",
                    duration_ms: Date.now() - start,
                });
            }
        },
    };
}
function extractText(result) {
    const content = result.content ?? [];
    return content.map((c) => c.text ?? "").join("\n");
}
