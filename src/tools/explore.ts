import { getScanResult } from "../scan-cache.js";
import { makeVerdict, type VerdictEnvelope } from "../verdict.js";
import { ChildServerManager } from "../child-server.js";
import type { ScanResult } from "../types.js";

export interface Citation {
  cite: string; // "path" or "path:line"
  reason: string;
  facet: "route" | "schema" | "component" | "lib" | "middleware" | "event" | "hot-file" | "symbol";
  score: number;
}

function terms(query: string): string[] {
  return query
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 1);
}

function overlap(haystack: string, qterms: string[]): number {
  const hay = haystack.toLowerCase();
  let hits = 0;
  for (const t of qterms) {
    if (hay.includes(t)) hits += 1;
  }
  return hits;
}

function rankFacets(scan: ScanResult, qterms: string[]): Citation[] {
  const cites: Citation[] = [];

  for (const r of scan.routes) {
    const score = overlap(`${r.method} ${r.path} ${r.tags.join(" ")} ${r.file}`, qterms);
    if (score > 0) cites.push({ cite: r.file, reason: `${r.method} ${r.path}`, facet: "route", score: score * 3 });
  }

  for (const m of scan.schemas) {
    const fields = m.fields.map((f) => f.name).join(" ");
    const score = overlap(`${m.name} ${fields} ${m.relations.join(" ")}`, qterms);
    if (score > 0) cites.push({ cite: m.name, reason: `${m.orm} model ${m.name}`, facet: "schema", score: score * 2 });
  }

  for (const c of scan.components) {
    const score = overlap(`${c.name} ${c.props.join(" ")} ${c.file}`, qterms);
    if (score > 0) cites.push({ cite: c.file, reason: `component ${c.name}`, facet: "component", score: score * 2 });
  }

  for (const lib of scan.libs) {
    for (const ex of lib.exports) {
      const score = overlap(`${ex.name} ${ex.signature ?? ""} ${lib.file}`, qterms);
      if (score > 0) cites.push({ cite: lib.file, reason: `${ex.kind} ${ex.name}`, facet: "lib", score: score * 2 });
    }
  }

  for (const mw of scan.middleware) {
    const score = overlap(`${mw.name} ${mw.type} ${mw.file}`, qterms);
    if (score > 0) cites.push({ cite: mw.file, reason: `${mw.type} middleware ${mw.name}`, facet: "middleware", score });
  }

  for (const ev of scan.events ?? []) {
    const score = overlap(`${ev.name} ${ev.type} ${ev.system} ${ev.file}`, qterms);
    if (score > 0) cites.push({ cite: ev.file, reason: `${ev.system} ${ev.type} ${ev.name}`, facet: "event", score });
  }

  for (const hf of scan.graph.hotFiles) {
    const score = overlap(hf.file, qterms);
    if (score > 0)
      cites.push({ cite: hf.file, reason: `hot file (imported by ${hf.importedBy})`, facet: "hot-file", score });
  }

  return cites;
}

function dedupe(cites: Citation[]): Citation[] {
  const best = new Map<string, Citation>();
  for (const c of cites) {
    const prev = best.get(c.cite);
    if (!prev || c.score > prev.score) best.set(c.cite, c);
  }
  return [...best.values()].sort((a, b) => b.score - a.score);
}

export function createExploreTool(manager: ChildServerManager) {
  return {
    name: "boocontext_explore",
    description:
      "Delegated exploration: maps a natural-language query to compact file/line citations off the precompiled scan index (routes, schemas, components, libs, middleware, events, hot files), then folds in tree-sitter-analyzer BM25 symbol hits for line-level precision. Deterministic, no LLM. Returns a ranked citation list instead of file dumps — use before editing to locate relevant code cheaply.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "What to find, e.g. 'where are auth sessions validated'" },
        directory: { type: "string", description: "Directory (defaults to cwd)" },
        k: { type: "number", description: "Max citations to return (default 12)" },
      },
      required: ["query"],
    },
    async handler(args: any): Promise<VerdictEnvelope> {
      const start = Date.now();
      const k = typeof args.k === "number" ? args.k : 12;
      try {
        const qterms = terms(args.query ?? "");
        const scan = await getScanResult(args.directory);
        let cites = rankFacets(scan, qterms);

        let symbolHits: any = null;
        try {
          const tsa = await manager.getServer("tree-sitter-analyzer");
          if (args.directory) {
            await tsa.callTool({ name: "set_project_path", arguments: { project_path: args.directory } });
          }
          symbolHits = await tsa.callTool({ name: "search", arguments: { action: "content", query: args.query } });
        } catch {
          symbolHits = null;
        }

        cites = dedupe(cites).slice(0, k);

        const verdict = cites.length > 0 ? "INFO" : "CAUTION";
        const summary =
          cites.length > 0
            ? `${cites.length} citation(s) for "${args.query}"`
            : `No index match for "${args.query}" — fall back to live search`;

        return makeVerdict(verdict, summary, { citations: cites, symbolHits }, {
          tool: "boocontext_explore",
          source: symbolHits ? "merged" : "boocontext",
          duration_ms: Date.now() - start,
        });
      } catch (err: any) {
        return makeVerdict("UNSAFE", `Explore failed: ${err.message}`, { error: err.message }, {
          tool: "boocontext_explore",
          source: "boocontext",
          duration_ms: Date.now() - start,
        });
      }
    },
  };
}
