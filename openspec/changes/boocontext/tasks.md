## 1. Scaffold boocontext fork

- [ ] 1.1 Verify the fork at `/opt/forks/boocontext` is at HEAD `6946ca3` and codesight remote is set to fetch-only (`git remote set-url --push origin no-push`)
- [ ] 1.2 Update `package.json` in boocontext: change `name` from `codesight` to `boocontext`, update `description` and `bin` entry to `boocontext-mcp`
- [ ] 1.3 Add `@modelcontextprotocol/sdk` dependency for MCP client (child server connection)
- [ ] 1.4 Create `src/child-server.ts` — `ChildServerManager` class with spawn/connect/cache/kill lifecycle using MCP stdio client from SDK
- [ ] 1.5 Create `src/verdict.ts` — `VerdictEnvelope` type and `makeVerdict(verdict, summary, details, metadata)` builder function
- [ ] 1.6 Create `src/dcp.ts` — DCP compression module (optional): compress output if string length > threshold (default 50k chars), add decompression hint to metadata
- [ ] 1.7 Create `src/tools/` directory with index.ts that exports all tool handlers
- [ ] 1.8 Create `src/boocontext-plugin.ts` — thin opencode plugin wrapper if needed for skill discovery (plugin.json with base name, version, description, triggers)

## 2. Child server wiring

- [ ] 2.1 `src/child-server.ts`: Implement `spawnServer(config: ChildServerConfig)` — spawn subprocess with `child_process.spawn`, connect via `@modelcontextprotocol/sdk` Client, negotiate capabilities
- [ ] 2.2 `src/child-server.ts`: Implement `getServer(name)` — return cached client or spawn on demand; throw if spawn fails
- [ ] 2.3 `src/child-server.ts`: Implement `callTool(serverName, tool, args)` — route tool call to the correct child server, handle timeouts, propagate errors
- [ ] 2.4 `src/child-server.ts`: Implement `shutdown()` — send `exit` signal to all child servers, close MCP connections
- [ ] 2.5 `src/child-server.ts`: Handle SIGTERM/SIGINT in boocontext main process → call `shutdown()`
- [ ] 2.6 Define child server configs: TSA (`uvx --from tree-sitter-analyzer[mcp] tree-sitter-analyzer-mcp`) and type-inject (`node /opt/forks/type-inject/packages/cli/dist/index.js` + optional npx fallback)
- [ ] 2.7 Write unit test for `ChildServerManager`: spawn, call tool, verify response shape, shutdown

## 3. Unified tools (boocontext_*)

- [ ] 3.1 `src/tools/overview.ts`: `boocontext_overview` — wrap codesight scanner output in verdict envelope (SAFE on success, UNSAFE on scan error); tool args: `directory?`
- [ ] 3.2 `src/tools/map.ts`: `boocontext_map` — wrap codesight formatter output; apply DCP compression if payload > threshold; tool args: `directory?`, `compress?`
- [ ] 3.3 `src/tools/health.ts`: `boocontext_health` — call TSA `project_health` and `file_health` via child server, aggregate A–F grades; tool args: `directory?`, `file?` (optional: single file); verdict: INFO if only aggregate, CAUTION if some files score D–F
- [ ] 3.4 `src/tools/symbols.ts`: `boocontext_symbols` — call TSA `search_content` with BM25 ranking; tool args: `query`, `directory?`, `limit?`; verdict: INFO
- [ ] 3.5 `src/tools/callgraph.ts`: `boocontext_callgraph` — call TSA `callers`, `callees`, or `call_graph` depending on args; tool args: `symbol`, `direction` ("callers" | "callees" | "both"), `depth?`, `file?`; verdict: INFO
- [ ] 3.6 `src/tools/impact.ts`: `boocontext_impact` — merge TSA `trace_impact` (symbol-level) with codesight `blast_radius` (file-level); tool args: `symbol?`, `file?`; verdict: UNSAFE if affected files exist (calls attention), CAUTION if uncertain, SAFE if none
- [ ] 3.7 `src/tools/types.ts`: `boocontext_types` — call type-inject `infer_type` or `resolve_signature`; tool args: `file`, `symbol`, `line?`, `column?`; verdict: INFO or UNSAFE (if resolution fails)
- [ ] 3.8 `src/mcp-server.ts`: Import all tool handlers, register in tool list, implement routing logic (local tool vs child server tool)
- [ ] 3.9 `src/mcp-server.ts`: Wrap every tool handler response with `makeVerdict()` — ensure all 7 tools return the verdict envelope schema
- [ ] 3.10 `src/mcp-server.ts`: Wire `ChildServerManager` into server lifecycle — instantiate on boot, call `shutdown()` on exit
- [ ] 3.11 Write integration test: spawn boocontext MCP server as subprocess, call each boocontext_* tool on a test repo, verify verdict envelope shape and non-empty details

## 4. Skill + agents

- [ ] 4.1 Create `~/.claude/plugins/cache/han/han-core/1.0.0/skills/boocontext/SKILL.md` with frontmatter: name, description, arguments, allowed-tools. Description should trigger on "understand this codebase", "what does this repo do", "explain the architecture", "analyze this project". Allowed-tools: `Bash(uvx *)`, `Bash(node *)`, `Read`, `Grep`, `Glob`, `Agent`.
- [ ] 4.2 Create skill directory for agents: `~/.claude/plugins/cache/han/han-core/1.0.0/skills/boocontext/agents/`
- [ ] 4.3 Create `agents/context-cartographer.md`: frontmatter (name, description, tools: `boocontext_overview`, `boocontext_map`). Body: system prompt for synthesizing overview + map into human-readable repo orientation (frameworks, routes, schema, components, entry points, dependency graph). Include example output format.
- [ ] 4.4 Create `agents/dependency-analyst.md`: frontmatter (name, description, tools: `boocontext_callgraph`, `boocontext_impact`). Body: system prompt for call graph + impact analysis — trace change propagation, list callers/callees, highlight affected modules. Include depth guidelines and output format.
- [ ] 4.5 Create `agents/health-auditor.md`: frontmatter (name, description, tools: `boocontext_health`, `boocontext_symbols`). Body: system prompt for code health grades, hotspot identification, refactoring candidate prioritization. Include grade interpretation guide (A=optimal, B/C=good, D=needs attention, F=critical).
- [ ] 4.6 Validate skill discovery: confirm `opencode` picks up the skill from `~/.claude/plugins/cache/han/han-core/1.0.0/skills/boocontext/SKILL.md` (check skill loaded list)

## 5. Host wiring

- [ ] 5.1 Register in `~/.config/opencode/opencode.json`: add `mcp.boocontext` block with command `node`, args pointing to boocontext build output (`/opt/forks/boocontext/dist/mcp-server.js`), and env vars for TSA/type-inject paths if non-default
- [ ] 5.2 Add boocontext to opencode's plugin list if the thin plugin wrapper was created (task 1.8); otherwise register as a skill only
- [ ] 5.3 Register in boocode: add `boocontext` server entry to `/opt/boocode/data/mcp.json` (or the boocode equivalent MCP config location) with same stdio command
- [ ] 5.4 Register in claude: add `boocontext` server entry to `~/.claude/mcp.json` with same stdio command
- [ ] 5.5 Optionally create a symlink or copy of the boocontext skill under `~/.claude/skills/` for claude desktop compatibility
- [ ] 5.6 Verify host registrations: run `openspec validate boocontext` to confirm all wiring artifacts are present

## 6. Verification

- [ ] 6.1 Smoke test — run boocontext MCP server standalone: `node dist/mcp-server.js` + send a JSON-RPC request for `boocontext_overview` via stdin, verify verdict envelope output
- [ ] 6.2 Smoke test — call `boocontext_health` on `/opt/forks/boocontext` (itself), verify TSA child server spawns and returns A–F grades
- [ ] 6.3 Smoke test — call `boocontext_symbols` on codesight source with query `"MCP"`, verify BM25-ranked results
- [ ] 6.4 Smoke test — call `boocontext_callgraph` with a known symbol from codesight, verify callers/callees returned
- [ ] 6.5 Smoke test — call `boocontext_types` on a TypeScript file in codesight, verify type resolution
- [ ] 6.6 Integration test — call all 7 tools in sequence in one session, verify child servers stay alive for subsequent calls
- [ ] 6.7 Integration test — send SIGTERM to boocontext, verify child servers are killed (check process list)
- [ ] 6.8 Run `openspec validate boocontext` — confirm all artifacts satisfy applyRequires
- [ ] 6.9 Open in opencode: confirm skill appears in skill list, confirm a simple prompt ("what does this repo do?") triggers boocontext skill
