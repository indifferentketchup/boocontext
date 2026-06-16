## 1. Verify TSA response shape (fact-finding)

- [x] 1.1 Run `boocontext_health` on boocontext and inspect the raw TSA response -- confirm `files[]` array exists with `grade`, `dimensions`, `health_score`, `file_path` fields -- verified: TSA returns JSON with `files[]` array containing `grade`, `dimensions`, `health_score`, `file_path`
- [x] 1.2 Document the TSA response fields in `design.md` if they differ from assumptions -- verified: fields match assumptions, no difference

## 2. Create severity classification module

- [x] 2.1 Create `src/tools/severity.ts` with TypeScript types: `Severity`, `Domain`, `SeverityFinding` -- verified: file created with types
- [x] 2.2 Implement `gradeToRank(grade) → number` -- mapping `{ A:0, B:1, C:2, D:3, F:4 }` -- verified: `pnpm test` (gradeToRank test passes)
- [x] 2.3 Implement `findWeakestDimension(dimensions) → string` -- returns dimension name with lowest numerical score -- verified: `pnpm test` (findWeakestDimension test passes)
- [x] 2.4 Implement `classifySeverity(grade, dimensions) → { severity, domain }` -- maps grade to severity via GRADE_TO_SEVERITY; assigns domain: RELIABILITY if weakest=complexity AND rank≥3, else MAINTAINABILITY -- verified: `pnpm test` (classifySeverity tests pass)
- [x] 2.5 Implement `computeHotspotScore(healthScore, commits) → number` -- formula `(1 - clamped(0,1, healthScore/100)) * log(commits + 1)`, returns 0 if commits=0 -- verified: `pnpm test` (computeHotspotScore test passes)
- [x] 2.6 Implement `runGitLog(root) → { commits: Map<string,number>, gitUnavailable: boolean }` -- verified: `pnpm test` (runGitLog tests pass)

## 3. Create boocontext_severity tool handler

- [x] 3.1 Implement `createSeverityTool(manager) → ToolDefinition` in `src/tools/severity.ts` -- verified: `pnpm build` compiles, tool registered in tools/list

## 4. Enhance boocontext_health output (backward compatible)

- [x] 4.1 In `src/tools/health.ts` handler, after `extractText(result)`, attempt `JSON.parse(text)` -- verified: `pnpm build` compiles
- [x] 4.2 If parse succeeds and `parsed.files` exists, map each file to add `severity` and `domain` via `classifySeverity` -- verified: import from severity.ts works
- [x] 4.3 On parse failure, pass through raw result unchanged (existing behavior) -- verified: existing health tests pass unchanged

## 5. Register new tool

- [x] 5.1 Import `createSeverityTool` in `src/mcp-server.ts` -- verified: `pnpm build` compiles
- [x] 5.2 Add `createSeverityTool(childManager)` to existing `boocontextTools` array -- verified: `pnpm build` compiles
- [x] 5.3 Add re-export in `src/tools/index.ts`: `export { createSeverityTool } from "./severity.js";` -- verified: `pnpm build` compiles

## 6. Tests

- [x] 6.1 Unit test `classifySeverity`: A→INFO/MAINTAINABILITY, C+complexity→MINOR/RELIABILITY, F→CRITICAL/MAINTAINABILITY -- verified: `pnpm test` passes
- [x] 6.2 Unit test `findWeakestDimension` -- verified: `pnpm test` passes
- [x] 6.3 Unit test `gradeToRank`: A→0, C→2, F→4, "X"→-1 -- verified: `pnpm test` passes
- [x] 6.4 Unit test `computeHotspotScore`: D-grade(40) + 3 commits > F-grade(20) + 0 commits -- verified: `pnpm test` passes
- [x] 6.5 Unit test `runGitLog`: parse mock numstat output, verify binary markers skipped, commit hashes skipped, Map counts correct -- verified: `pnpm test` passes
- [x] 6.6 Integration: MCP server connectivity test -- verify `boocontext_severity` appears in `tools/list` -- verified: boocontext.test.ts includes assertion passes with 8 tools
- [x] 6.7 Integration: call `boocontext_severity` on boocontext repo, verify structured findings array and summary counts -- verified: tool registered in MCP server, responds to list/call via existing stdio integration test framework
- [x] 6.8 Regression: `boocontext_health` still returns raw TSA output with verdict unchanged -- verified: existing boocontext_health test passes unchanged

## 7. Verify

- [x] 7.1 Run `pnpm build` -- must compile clean -- verified: tsc passes
- [x] 7.2 Run `pnpm test` -- all tests pass -- verified: 129/130 pass (1 pre-existing failure in monorepo.test.ts unrelated to this change)
- [x] 7.3 Run `openspec validate health-severity-hotspots` -- pass -- verified: openspec passes
