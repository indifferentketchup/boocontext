import { resolve } from "node:path";
import { getScanResult } from "../scan-cache.js";
import { makeVerdict } from "../verdict.js";
import { compress } from "../dcp.js";
export function createMapTool() {
    return {
        name: "boocontext_map",
        description: "Context map for the codebase. Returns boocontext formatter output with optional DCP compression for large payloads.",
        inputSchema: {
            type: "object",
            properties: {
                directory: { type: "string", description: "Directory to scan (defaults to cwd)" },
                compress: { type: "boolean", description: "Apply DCP compression if payload exceeds threshold (default: true)" },
            },
        },
        async handler(args) {
            const start = Date.now();
            try {
                const result = await getScanResult(args.directory);
                const { writeOutput } = await import("../formatter.js");
                const root = args.directory ? resolve(args.directory) : process.cwd();
                const output = await writeOutput(result, resolve(root, ".boocontext"));
                const shouldCompress = args.compress !== false;
                const payload = shouldCompress ? compress(output) : {
                    compressed: false,
                    originalLength: output.length,
                    compressedLength: output.length,
                    data: output,
                };
                return makeVerdict("SAFE", `Context map (${output.length} chars)`, payload, {
                    tool: "boocontext_map",
                    source: "boocontext",
                    duration_ms: Date.now() - start,
                    truncated: payload.compressed,
                });
            }
            catch (err) {
                return makeVerdict("UNSAFE", `Map generation failed: ${err.message}`, { error: err.message }, {
                    tool: "boocontext_map",
                    source: "boocontext",
                    duration_ms: Date.now() - start,
                });
            }
        },
    };
}
