## Why

boocontext advertises 23 MCP tools. Documented cross-model research places the tool-selection confusion threshold at ~30 tools, where descriptions begin to overlap and agents mis-select ([Workato](https://docs.workato.com/mcp/mcp-server-tool-design.html), [AWS](https://docs.aws.amazon.com/prescriptive-guidance/latest/mcp-strategies/mcp-tool-strategy.html), [Speakeasy](https://www.speakeasy.com/mcp/tool-design/less-is-more)). boocontext sits at 23 and climbing.

Twelve of those tools are homogeneous `get_*` getters that all read one cached scan result and return a markdown slice of it (`get_summary`, `get_routes`, `get_schema`, `get_env`, `get_hot_files`, `get_events`, `get_coverage`, `get_blast_radius`, `get_wiki_index`, `get_wiki_article`, `lint_wiki`, `get_knowledge`). Anthropic's guidance names exactly this shape (thin getters over one source) as the consolidation target, while warning against collapsing genuinely distinct high-leverage verbs ([Anthropic](https://www.anthropic.com/engineering/writing-tools-for-agents)).

## What Changes

- **Add `boocontext_get` tool** with a `section` enum that dispatches to the existing getter handlers. Output stays homogeneous (always a context slice), so this is consolidation, not the branching-semantics anti-pattern.
- **Remove the 12 getter tools from the advertised `tools/list`**, dropping the listed surface from 23 to 12.
- **Keep the 12 old getter names callable but unlisted** via a hidden alias map in `tools/call`, so existing integrations do not break.
- **Update every in-repo reference to the removed names** to use `boocontext_get` syntax: the two hardcoded hints in `mcp-server.ts` (`toolGetSummary` line 256, `toolGetWikiIndex` line 274), the `claude-code` profile generator in `src/generators/ai-config.ts` (lines 238-243, written into user CLAUDE.md at runtime), and the two README tool tables.
- **Add an automated test** asserting alias dispatch is byte-identical to `boocontext_get` and that `tools/list` excludes the getters.

## Capabilities

### New Capabilities
- `boocontext_get({ section, ...filters })` single entry point for all scan-slice retrieval.

### Modified Capabilities
- Advertised tool surface reduced from 23 to 11 listed tools.

### What Stays the Same
- Every getter's behavior, output, and filter parameters are unchanged (same handler functions).
- Old getter tool names remain callable (hidden aliases) for backward compatibility.
- The 7 verdict-envelope tools (`overview`, `map`, `health`, `symbols`, `callgraph`, `impact`, `types`), plus `scan`, `refresh`, `severity`, `explore`, are untouched as distinct verbs.

## Impact

- **Files touched**: `src/mcp-server.ts` (new tool + two maps + alias resolution + two hint strings; remove 12 getter definitions), `src/generators/ai-config.ts` (lines 238-243), `README.md` (two tool tables), `tests/boocontext.test.ts` (new alias + surface tests). `dist/` is git-tracked (162 files), so `pnpm build` will also restage `dist/mcp-server.js` and `dist/generators/ai-config.js` — expected, part of the change.
- **No npm dependencies added.**
- **No breaking changes** — old names still resolve; no test asserts the getters are listed (`tests/boocontext.test.ts:94` asserts only the 7 verdict tools).
- **Final advertised tool count: 12** (`scan`, `refresh`, `get`, `overview`, `map`, `health`, `symbols`, `callgraph`, `impact`, `types`, `severity`, `explore`).
