import { getScanResult } from "../scan-cache.js";
import { makeVerdict } from "../verdict.js";
export function createImpactTool(manager) {
    return {
        name: "boocontext_impact",
        description: "Impact analysis. Merges tree-sitter-analyzer trace_impact (symbol-level) with boocontext blast_radius (file-level). Use before making changes to understand change propagation.",
        inputSchema: {
            type: "object",
            properties: {
                symbol: { type: "string", description: "Symbol name for TSA trace_impact" },
                file: { type: "string", description: "File path for boocontext blast_radius" },
                directory: { type: "string", description: "Directory (defaults to cwd)" },
            },
        },
        async handler(args) {
            const start = Date.now();
            try {
                const tsaClient = await manager.getServer("tree-sitter-analyzer");
                if (args.symbol && args.directory) {
                    await tsaClient.callTool({ name: "set_project_path", arguments: { project_path: args.directory } });
                }
                let tsaResult = null;
                let scannerResult = null;
                if (args.symbol) {
                    tsaResult = await tsaClient.callTool({ name: "nav", arguments: { action: "impact", symbol: args.symbol, scope: "project" } });
                }
                if (args.file) {
                    const scanResult = await getScanResult(args.directory);
                    const { analyzeBlastRadius } = await import("../detectors/blast-radius.js");
                    scannerResult = analyzeBlastRadius(args.file, scanResult);
                }
                const merged = {
                    ...(tsaResult ? { trace: tsaResult } : {}),
                    ...(scannerResult ? { blastRadius: scannerResult } : {}),
                };
                const hasAffected = scannerResult?.affectedFiles?.length > 0;
                const hasUncertainty = !tsaResult && !scannerResult;
                const verdict = hasUncertainty ? "CAUTION" : hasAffected ? "UNSAFE" : "SAFE";
                const summary = hasAffected
                    ? `${scannerResult.affectedFiles.length} affected file(s)`
                    : hasUncertainty
                        ? "No symbol or file provided — cannot assess impact"
                        : "No impact detected";
                return makeVerdict(verdict, summary, merged, {
                    tool: "boocontext_impact",
                    source: "merged",
                    duration_ms: Date.now() - start,
                });
            }
            catch (err) {
                return makeVerdict("UNSAFE", `Impact analysis failed: ${err.message}`, { error: err.message }, {
                    tool: "boocontext_impact",
                    source: "merged",
                    duration_ms: Date.now() - start,
                });
            }
        },
    };
}
