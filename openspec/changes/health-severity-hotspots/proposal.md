## Why

boocontext_health currently returns raw tree-sitter-analyzer A-F grades with no severity classification, no distinction between maintainability and security concerns, and no prioritization by organizational impact. Two battle-tested taxonomies exist in the codebase ecosystem:

- **SonarQube** (`/opt/forks/sonarqube/sonar-core/SoftwareQualitiesMetrics.java`): 3-domain model (maintainability/reliability/security) with a severity ladder (INFO→MINOR→MAJOR→CRITICAL→BLOCKER), rule types (CODE_SMELL/BUG/VULNERABILITY/SECURITY_HOTSPOT), and impact mapping (`SoftwareQuality × Severity`).
- **CodeScene** (MCP server, observed via `codescene_code_health_review`): git-aware hotspot analysis — file health scores combined with commit frequency to rank refactoring targets by how much the team actually touches them.

Adopting these patterns gives boocontext_health output that is actionable (severity), categorized (domain), and prioritized (hotspots) without adding external dependencies — git log parsing is built into Node.js.

## What Changes

- **Add severity ladder + software-quality domains to boocontext_health output** — wrap raw tree-sitter-analyzer grades with a classification layer mapping each file finding to a `severity` (INFO/MINOR/MAJOR/CRITICAL) and a `domain` (MAINTAINABILITY/RELIABILITY).
- **Add git-aware hotspot prioritization** — run `git log -n 100 --numstat` via Node.js `child_process` to get per-file commit frequency, then sort health findings by `(1 - health_score/100) * log(commits + 1)` to surface files that are both unhealthy AND frequently changed. Falls back gracefully when git is unavailable.
- **Add `boocontext_severity` tool** — a standalone tool that returns severity-classified findings with hotspot ranking, leaving `boocontext_health` unchanged (backward compatible).
- **VerdictGrade unchanged** — PASS/FAIL semantics conveyed via verdict ("INFO" when 0 CRITICAL, "CAUTION" otherwise) rather than extending the type system, avoiding downstream breakage.

## Capabilities

### New Capabilities
- Per-file severity classification with domain attribution
- Git-aware hotspot ranking (health score × commit frequency)
- Dedicated `boocontext_severity` tool for severity-first workflows

### Modified Capabilities
- `boocontext_health` output enhanced with severity tags when TSA returns structured JSON (backward compatible — raw output preserved)

### What Stays the Same
- `boocontext_health` retains existing `CAUTION`/`INFO` verdict logic on raw grades
- `VerdictGrade` type unchanged
- All existing tools unchanged

## Impact

- **Files touched**: `src/tools/severity.ts` (new ~130 lines), `src/tools/health.ts` (+15 lines), `src/mcp-server.ts` (+2 lines), `src/tools/index.ts` (+1 line)
- **~150 lines added**
- **No npm dependencies** — `child_process.execSync` calls the system `git` binary (already a prerequisite for boocontext use)
- **No breaking changes** — new tool + backward-compatible health enhancement
