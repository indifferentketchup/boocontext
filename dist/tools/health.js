import { makeVerdict } from "../verdict.js";
import { classifySeverity } from "./severity.js";
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
                    const ftext = extractText(result);
                    try {
                        const parsed = JSON.parse(ftext);
                        if (parsed.grade && parsed.dimensions) {
                            parsed.severity = classifySeverity(parsed.grade, parsed.dimensions).severity;
                            parsed.domain = classifySeverity(parsed.grade, parsed.dimensions).domain;
                            return makeVerdict("INFO", `Health for ${args.file}`, parsed, {
                                tool: "boocontext_health",
                                source: "tree-sitter-analyzer",
                                duration_ms: Date.now() - start,
                            });
                        }
                    }
                    catch { /* plain text — pass through unchanged */ }
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
                // Try to enhance with severity tags if TSA returned structured JSON
                try {
                    const parsed = JSON.parse(text);
                    if (parsed.files) {
                        parsed.files = parsed.files.map((f) => ({
                            ...f,
                            severity: classifySeverity(f.grade, f.dimensions).severity,
                            domain: classifySeverity(f.grade, f.dimensions).domain,
                        }));
                        return makeVerdict(verdict, hasDF ? "Some files scored D–F" : "All files healthy", parsed, {
                            tool: "boocontext_health",
                            source: "tree-sitter-analyzer",
                            duration_ms: Date.now() - start,
                        });
                    }
                }
                catch { /* TSA returned plain text — pass through raw result unchanged */ }
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
