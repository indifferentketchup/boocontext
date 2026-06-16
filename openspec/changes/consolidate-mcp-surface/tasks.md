## 1. Add dispatch + alias infrastructure

- [x] 1.1 Add `GETTER_SECTIONS` map (section -> existing handler fn) in `src/mcp-server.ts` -- verify: `pnpm build` compiles
- [x] 1.2 Add `HIDDEN_FROM_LIST` set of legacy getter tool names (simpler than a separate alias map: getters stay in `TOOLS` so `tools/call` still finds them, and are filtered out of `tools/list`) -- verify: `pnpm build` compiles

## 2. Add boocontext_get tool

- [x] 2.1 Add `boocontext_get` ToolDefinition with `section` enum + all optional filter params, handler dispatches via `GETTER_SECTIONS`, unknown section returns helpful error -- verify: appears in `tools/list`
- [x] 2.2 Update both hardcoded hints in `mcp-server.ts` (`toolGetSummary` line 256, `toolGetWikiIndex` line 274) to reference `boocontext_get` -- verify: grep shows no `boocontext_get_*` literal in those strings

## 3. Remove getters from advertised surface

- [x] 3.1 Hide the 12 getters from the advertised surface by filtering `HIDDEN_FROM_LIST` out of the `tools/list` response (definitions stay in `TOOLS`) -- verify: `tools/list` returns 12 tools, none named `boocontext_get_*`/`lint_wiki`
- [x] 3.2 Getters remain in `TOOLS`, so the unchanged `tools/call` lookup still dispatches old names -- verify: `boocontext_get_summary` alias test byte-matches `boocontext_get {section:summary}`

## 4. Update stale references (validator findings V2/V4)

- [x] 4.1 Update `src/generators/ai-config.ts` lines 238-243 (claude-code profile) to `boocontext_get {section: ...}` syntax -- verify: grep shows no `boocontext_get_*` literal
- [x] 4.2 Update the two README tool tables (lines ~100-102 and ~627-638) to document `boocontext_get` + sections -- verify: grep count of stale names drops

## 5. Test alias dispatch (validator finding V5)

- [x] 5.1 Add test: `tools/list` includes `boocontext_get`, excludes `boocontext_get_*`/`boocontext_lint_wiki` -- verify: `pnpm test` passes
- [x] 5.2 Add test: `boocontext_get_routes` (alias) output byte-identical to `boocontext_get {section:routes}` -- verify: `pnpm test` passes

## 6. Verify everything

- [x] 6.1 `pnpm build` compiles clean -- verify: exit 0
- [x] 6.2 `pnpm test` passes (incl. existing `tools/list includes all 7 boocontext tools` + new alias tests) -- verify: exit 0
- [x] 6.3 Live smoke: `tools/list` count == 12; `boocontext_get {section:routes}` and alias `boocontext_get_routes` byte-equal -- verify: equal
- [x] 6.4 `git diff --stat` reviewed: expected files are `src/mcp-server.ts`, `src/generators/ai-config.ts`, `README.md`, `tests/boocontext.test.ts`, regenerated `dist/*`, and the change folder -- verify: no unexpected files
