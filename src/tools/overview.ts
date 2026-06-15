import { getScanResult } from "../scan-cache.js";
import { makeVerdict, type VerdictEnvelope } from "../verdict.js";

export function createOverviewTool() {
  return {
    name: "boocontext_overview",
    description:
      "Full codebase overview. Wraps boocontext scanner output in a verdict envelope with project summary, routes, schema, components, and dependency graph.",
    inputSchema: {
      type: "object",
      properties: {
        directory: { type: "string", description: "Directory to scan (defaults to cwd)" },
      },
    },
    async handler(args: any): Promise<VerdictEnvelope> {
      const start = Date.now();
      try {
        const result = await getScanResult(args.directory);
        return makeVerdict("SAFE", `Project overview for ${result.project.name}`, result, {
          tool: "boocontext_overview",
          source: "boocontext",
          duration_ms: Date.now() - start,
        });
      } catch (err: any) {
        return makeVerdict("UNSAFE", `Scan failed: ${err.message}`, { error: err.message }, {
          tool: "boocontext_overview",
          source: "boocontext",
          duration_ms: Date.now() - start,
        });
      }
    },
  };
}
