## Why

AI-assisted development requires understanding codebases at multiple granularities — project overview for initial orientation, deep analysis (call graphs, type information, impact zones) for targeted changes. Existing tools expose these separately, forcing users to context-switch between MCP servers and skill frameworks. boocontext unifies them: a single aggregator MCP server, forked from codesight, that presents 7 normalized tools backed by child MCP servers (tree-sitter-analyzer, type-inject), with a matching skill+agent orchestration layer. Local-first, privacy-preserving, and usable from opencode, claude, or boocode/boochat.

## What Changes

- **Fork codesight** into `/opt/forks/boocontext` (already cloned). Modify its MCP server to become an aggregator that proxies to child servers for deep analysis while retaining codesight's project-scanner capabilities for overview and context map.
- **Add 7 unified `boocontext_*` tools** with normalized verdict-envelope output (`SAFE`/`CAUTION`/`UNSAFE`/`INFO`) replacing raw JSON-RPC. Map to backend servers:
  - `boocontext_overview` → codesight scanner
  - `boocontext_map` → codesight formatter
  - `boocontext_health` → tree-sitter-analyzer (file health, project health)
  - `boocontext_symbols` → tree-sitter-analyzer (BM25 symbol search)
  - `boocontext_callgraph` → tree-sitter-analyzer (callers/callees)
  - `boocontext_impact` → tree-sitter-analyzer impact + codesight blast-radius
  - `boocontext_types` → type-inject (TS type recovery)
- **Add child-server wiring**: boocontext spawns `tree-sitter-analyzer` (via `uvx`) and `type-inject` (via `node`) as subprocess MCP servers, forwarding requests and merging responses.
- **Create skill + 3 agents** at `~/.claude/plugins/cache/han/han-core/1.0.0/skills/boocontext/`:
  - `SKILL.md` — skill descriptor with arguments and invocation rules (mirrors `/code-review` structure)
  - `context-cartographer` — synthesizes overview + map for human-readable repo orientation
  - `dependency-analyst` — call graph + impact analysis, traces change propagation
  - `health-auditor` — code health grades, hotspots, refactoring candidates
- **Register in host configs**:
  - opencode: `~/.config/opencode/opencode.json` → `mcp.boocontext` block
  - boocode: `/opt/boocode/data/mcp.json` → `boocontext` server entry
  - claude: `~/.claude/mcp.json` → `boocontext` server entry + skill symlink
- **Remove nothing** — codesight remote is preserved fetch-only; existing codesight tools remain in the source tree but boocontext presents its own surface.

## Capabilities

### New Capabilities

- `codebase-context`: Unified project overview + context map + "what is this repo?" synthesis. Backed by codesight scanner + formatter. Entry point for onboarding to any repo.
- `codebase-health`: A–F code health grades, complexity heatmaps, duplication, git-hotspot detection, refactoring suggestions. Backed by tree-sitter-analyzer.
- `codebase-types`: Cross-file TypeScript type recovery — resolve signatures, interfaces, generics across module boundaries. Backed by type-inject.

## Impact

- **`/opt/forks/boocontext`**: Modified MCP server (add aggregator layer, child server spawning, verdict envelope, 7 new tools). Codesight code reused, not removed.
- **`~/.config/opencode/opencode.json`**: New `mcp.boocontext` entry with stdio command and env.
- **`~/.claude/plugins/cache/han/han-core/1.0.0/skills/boocontext/`**: New skill directory with SKILL.md + 3 agent files.
- **`/opt/boocode/data/mcp.json`**: New boocontext server entry.
- **`/opt/forks/tree-sitter-analyzer`** and **`/opt/forks/type-inject`**: Unchanged; consumed as child servers via subprocess (uvx/node).
- **`~/.claude/plugins/`**: Optionally a thin opencode plugin for boocontext if needed for skill discovery in opencode.
