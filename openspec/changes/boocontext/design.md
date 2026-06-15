## Context

boocontext is forked from codesight (14+ languages, 40+ frameworks, 13 MCP tools, TypeScript compiler AST + regex scanner). codesight provides project-level overview: routes, schemas, components, dependency graph, blast-radius. It does not do deep per-file analysis (call graphs, code health, type recovery).

tree-sitter-analyzer (Python, SQLite index, 8+ MCP tools) provides the deep layer: call graph (callers/callees/call-paths), A–F code health grading, BM25-ranked symbol search, change impact, complexity heatmaps. It ships as `tree-sitter-analyzer[mcp]` on PyPI, launchable via `uvx`.

type-inject (TypeScript/Node) provides cross-file TS type recovery: resolved signatures, interfaces, generics.

boocontext aggregates these into one MCP server process so host applications register a single server, not three.

Current state: fork exists at `/opt/forks/boocontext` (untouched), tree-sitter-analyzer at `/opt/forks/tree-sitter-analyzer`, type-inject at `/opt/forks/type-inject`. No wiring exists yet.

Constraints:
- Zero new inference — boocontext is a tool server. The calling host (opencode/claude/boocode/boochat) owns LLM synthesis.
- All 7 tools return verdict envelopes (structured facts + safety classification).
- Child servers must be lazily spawned on first use and kept alive for the session.
- Compression (DCP) is optional — only applied to `boocontext_map` output when payload exceeds threshold.

## Goals / Non-Goals

**Goals:**
- Single MCP server registration per host (not 3 separate servers)
- 7 normalized tools with consistent verdict-envelope output
- Transparent child-server lifecycle (spawn, route, merge, teardown)
- Skill + 3 agents that use the tools for human-readable repo reports
- Works in opencode (via plugin + mcp block), claude (via MCP + skill), boocode/boochat (via data/mcp.json + skill)

**Non-Goals:**
- Not a general-purpose MCP gateway — only boocontext-specific child servers
- No caching layer (child servers cache internally; boocontext caches scan result per session)
- No web UI, no HTTP API beyond MCP stdio
- No inference, no LLM integration inside the server
- No TypeScript type recovery for non-TS languages (type-inject is TS-only)
- No replacement of codesight — codesight continues to exist as the upstream; boocontext extends the fork

## Decisions

### D1: Aggregator-fork, not wrapper
boocontext modifies codesight's `mcp-server.ts` in-place rather than wrapping it in a separate process. This avoids double-scans (codesight and boocontext would each crawl the repo). The codesight scanner is reused directly; new tools are added alongside existing ones.

### D2: Child servers via subprocess stdio, not HTTP
tree-sitter-analyzer and type-inject are spawned as child processes with MCP stdio transport. boocontext uses the `@modelcontextprotocol/sdk` client to connect. Rationale: no port conflicts, no network exposure, same machine, simple lifecycle management.

### D3: Lazy spawn on first tool call
Child servers are not started at boocontext startup. They are spawned on the first tool call that needs them (`boocontext_health`, `boocontext_symbols`, `boocontext_callgraph`, `boocontext_impact` → spawn TSA; `boocontext_types` → spawn type-inject). Once spawned, the child process stays alive for the session and is killed when boocontext exits.

### D4: Verdict envelope schema
All 7 tools return output wrapped in a uniform envelope:

```typescript
interface BoocontextResult {
  verdict: "SAFE" | "CAUTION" | "UNSAFE" | "INFO";
  summary: string;
  details: any;
  metadata: {
    source: "codesight" | "tree-sitter-analyzer" | "type-inject" | "merged";
    tool: string;
    duration_ms: number;
    truncated: boolean;
  };
}
```

- **SAFE**: No issues found. Data is complete and actionable.
- **CAUTION**: Minor issues or warnings. Data may be partial.
- **UNSAFE**: Significant problems (e.g., analysis failed, index missing, project too large).
- **INFO**: Informational response (no error, no warning — e.g., help text or ping).

### D5: Tool → backend mapping

| boocontext tool | Backend server | Backend tool(s) called | Notes |
|---|---|---|---|
| `boocontext_overview` | codesight (local) | `scan` + `getSummary` | Reuses codesight scanner directly, no child server |
| `boocontext_map` | codesight (local) | formatter output | Reuses `.codesight/` output; optional DCP compression |
| `boocontext_health` | tree-sitter-analyzer | `file_health`, `project_health` | Spawns TSA child server |
| `boocontext_symbols` | tree-sitter-analyzer | `search_content`, `query_code` | BM25 symbol search via TSA |
| `boocontext_callgraph` | tree-sitter-analyzer | `callers`, `callees`, `call_graph` | TSA call graph |
| `boocontext_impact` | tree-sitter-analyzer + codesight | TSA `trace_impact` + codesight `blast_radius` | Merged symbol-level + file-level impact |
| `boocontext_types` | type-inject | `infer_type`, `resolve_signature` | TS type recovery |

### D6: codesight tools preserved
The existing codesight tools (`codesight_scan`, `codesight_get_routes`, etc.) remain in the source tree but are not advertised in the boocontext tool list. The `boocontext_*` tools are the public surface. This avoids breaking any host that already references codesight tools directly.

### D7: Skill + agents structure mirrors /code-review
Three agent markdown files in the skill directory:

```
~/.claude/plugins/cache/han/han-core/1.0.0/skills/boocontext/
  SKILL.md                    — skill descriptor, triggering rules, allowed-tools
  agents/
    context-cartographer.md   — overview + map synthesis for repo orientation
    dependency-analyst.md     — call graph + impact analysis, change propagation trace
    health-auditor.md         — code health grades, hotspots, refactoring suggestions
```

Each agent file has frontmatter (name, description, tools it calls) and system prompt body with usage examples.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                     HOST (opencode / claude / boocode)              │
│   Skill dispatch → agent orchestration → tool calls → synthesis    │
└──────────────────────────────┬──────────────────────────────────────┘
                               │ MCP stdio
┌──────────────────────────────▼──────────────────────────────────────┐
│                     boocontext MCP server (TS)                       │
│  forked from codesight, adds:                                        │
│   - 7 boocontext_* tools with verdict envelopes                      │
│   - ChildServerManager (spawn/route/merge/kill)                      │
│   - DCP compression module (optional)                                │
│                                                                      │
│  ┌────────────┐  ┌──────────────────┐  ┌────────────────────────┐   │
│  │ codesight  │  │ tree-sitter-     │  │ type-inject (node)    │   │
│  │ scanner    │  │ analyzer (uvx)   │  │ child server           │   │
│  │ (in-proc)  │  │ child server     │  │                        │   │
│  └────────────┘  └──────────────────┘  └────────────────────────┘   │
└──────────────────────────────────────────────────────────────────────┘
```

## Child Server Protocol

Boocontext implements a `ChildServerManager` class:

```typescript
interface ChildServerConfig {
  name: string;
  command: string;         // "uvx" | "node"
  args: string[];
  env?: Record<string, string>;
  tools: string[];          // tools this child serves (e.g., ["file_health", "callers"])
}

class ChildServerManager {
  private servers: Map<string, McpClient>;
  
  async getServer(name: string): Promise<McpClient>;
  async callTool(serverName: string, tool: string, args: any): Promise<any>;
  async shutdown(): Promise<void>;
}
```

On first call to a boocontext tool that routes to TSA or type-inject, `getServer()` spawns the child process, connects via MCP stdio client, and caches the client. Subsequent calls reuse the cached connection.

Teardown: `ChildServerManager.shutdown()` is called on server SIGTERM/SIGINT.

## Risks / Trade-offs

- **[Risk] Child server startup latency**: First call to any TSA-backed tool incurs `uvx` startup time (~2-5s for Python). Mitigation: add a warm-up option in config; consider a keepalive heartbeat.
- **[Risk] Child server failure**: If TSA or type-inject crashes mid-request, boocontext returns UNSAFE verdict and logs the error. Client is expected to retry. Mitigation: single retry with fresh child server spawn.
- **[Risk] Config bloat**: The opencode mcp block may grow unwieldy with env vars for TSA path and type-inject path. Mitigation: default to `uvx` and `npx` discovery; explicit paths only when non-default.
- **[Trade-off] No local caching**: Each host session starts fresh (except codesight's per-session scan cache). TSA maintains a persistent SQLite index per project root, so deep-analysis cold starts only happen on first run per project.
