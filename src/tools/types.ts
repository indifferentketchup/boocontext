import { makeVerdict, type VerdictEnvelope } from "../verdict.js";
import { ChildServerManager } from "../child-server.js";

export function createTypesTool(manager: ChildServerManager) {
  return {
    name: "boocontext_types",
    description:
      "TypeScript type recovery. Calls type-inject infer_type or resolve_signature to resolve cross-file TS types, interfaces, and generics.",
    inputSchema: {
      type: "object",
      properties: {
        file: { type: "string", description: "File path" },
        symbol: { type: "string", description: "Symbol name to resolve" },
        line: { type: "number", description: "Optional: line number" },
        column: { type: "number", description: "Optional: column number" },
      },
      required: ["file", "symbol"],
    },
    async handler(args: any): Promise<VerdictEnvelope> {
      const start = Date.now();
      try {
        const tiClient = await manager.getServer("type-inject");
        const result = await tiClient.callTool({
          name: "infer_type",
          arguments: { file: args.file, symbol: args.symbol, line: args.line, column: args.column },
        });

        return makeVerdict("INFO", `Type for ${args.symbol} in ${args.file}`, result, {
          tool: "boocontext_types",
          source: "type-inject",
          duration_ms: Date.now() - start,
        });
      } catch (err: any) {
        return makeVerdict("UNSAFE", `Type resolution failed: ${err.message}`, { error: err.message }, {
          tool: "boocontext_types",
          source: "type-inject",
          duration_ms: Date.now() - start,
        });
      }
    },
  };
}
