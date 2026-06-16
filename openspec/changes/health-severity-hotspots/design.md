## Architecture

```
boocontext MCP Server
├── tools/health.ts (modified)
│   └── adds severity + domain tags to existing health output (backward compatible)
├── tools/severity.ts (NEW)
│   ├── classifySeverity(grade, dimensions) → { severity, domain }
│   ├── findWeakestDimension(dimensions) → string  // lowest score
│   ├── gradeToRank(grade) → number  // A=0..F=4
│   ├── healthScoreToNorm(tsaHealthScore) → number  // 0-100 → 0-1
│   ├── computeHotspotScore(healthScoreNorm, commitCount) → number
│   ├── runGitLog(projectRoot) → { commits: Map, gitUnavailable: boolean }
│   └── createSeverityTool(manager) → ToolDefinition with handler()
├── verdict.ts (unchanged — no type changes)
└── mcp-server.ts (modified)
    └── imports createSeverityTool, append to boocontextTools array
```

## Key Decisions

### D1: Severity ladder from SonarQube, not CodeScene
**Choice**: SonarQube's `INFO → MINOR → MAJOR → CRITICAL` (4 levels).
**Rationale**: SonarQube's 5-level `INFO→MINOR→MAJOR→CRITICAL→BLOCKER` is industry-standard and widely recognized. BLOCKER is dropped for now — we lack the rule depth to justify it. CodeScene's numeric `indication` 1-3 is less intuitive outside their ecosystem.
**Reference**: `sonar-core/SoftwareQualitiesMetrics.java:33-285`, `sonar-core/RuleType.java:31`

### D2: Domain mapping from tree-sitter dimensions, not new rules
**Choice**: Map tree-sitter-analyzer's existing 5 dimensions to 2 active domains. The dimension with the lowest numerical score is the "weakest dimension." `complexity` as weakest + grade D or F → `RELIABILITY`; all other cases → `MAINTAINABILITY`. SECURITY is reserved.
**Rationale**: Cyclomatic complexity correlates with bug density. Only flagging RELIABILITY on D/F files keeps the domain signal conservative. The grade rank check (not string comparison) ensures correct ordering.
**Reference**: `sonar-core/SoftwareQualitiesMetrics.java` (3-domain model)

### D3: Hotspot score formula — multiplicative, not additive
**Choice**: `(1 - normalized_health) * log(commit_count + 1)`. TSA provides `health_score` (0-100) per file. Files with 0 commits or git unavailable score 0 regardless of health.
**Rationale**: A frequently-changed D-grade file is more urgent than a stale F-grade file. The log dampens extreme commit counts. CodeScene uses a similar multiplicative model with their proprietary DCP algorithm.
**Reference**: CodeScene hotspot prioritization (observed behavior)

### D4: Separate `boocontext_severity` tool, not merged into `boocontext_health`
**Choice**: New tool, not an optional param on the existing health tool.
**Rationale**: `boocontext_health` is a thin wrapper around tree-sitter-analyzer that forwards raw output. Adding severity/hotspot logic there mixes concerns. A standalone tool keeps the health tool stable and lets users opt into severity analysis explicitly.

### D5: git log via child_process, not git2 npm
**Choice**: `child_process.execSync('git log -n 100 --numstat --format=%H')` with `encoding: "utf8"` in a try/catch, 5s timeout. Returns `{ commits, gitUnavailable }` struct.
**Rationale**: Zero npm dependencies. `git` is installed on any machine that would run boocontext. The `gitUnavailable` flag distinguishes "no git" from "no commits." Binary file lines (`-\t-\tfile`) are skipped.

### D6: VerdictGrade unchanged — PASS/FAIL kept as tool-local verdicts
**Choice**: `VerdictGrade` stays `"SAFE" | "CAUTION" | "UNSAFE" | "INFO"`. The severity tool uses `"INFO"` verdict for PASS and `"CAUTION"` for FAIL, mapped in the handler by checking for CRITICAL findings.
**Rationale**: Avoids downstream breakage for consumers doing exhaustive switch on VerdictGrade. The PASS/FAIL semantics are embedded in the verdict+summary of the severity tool's output, not in the type system.
**Contradiction resolved**: proposal originally claimed PASS/FAIL extension of VerdictGrade. Both reviews flagged this as a breaking change. Resolved by not modifying the type.

## File-by-file design

### `src/tools/severity.ts` (NEW)

```ts
import { execSync } from "node:child_process";
import { resolve, relative } from "node:path";
import { makeVerdict, type VerdictEnvelope } from "../verdict.js";
import type { ChildServerManager } from "../child-server.js";

type Severity = "INFO" | "MINOR" | "MAJOR" | "CRITICAL";
type Domain = "MAINTAINABILITY" | "RELIABILITY" | "SECURITY";

interface SeverityFinding {
  file: string;
  grade: string;
  severity: Severity;
  domain: Domain;
  weakest_dimension: string;
  health_score: number;
  commits: number;
  hotspot_score: number;
}

// Grade to severity mapping
const GRADE_TO_SEVERITY: Record<string, Severity> = {
  A: "INFO", B: "INFO", C: "MINOR", D: "MAJOR", F: "CRITICAL"
};

// Grade to rank for ordered comparison (A=0..F=4)
const GRADE_RANK: Record<string, number> = { A: 0, B: 1, C: 2, D: 3, F: 4 };

function gradeToRank(grade: string): number {
  return GRADE_RANK[grade] ?? -1;
}

// Dimension with the lowest numerical score is the weakest
function findWeakestDimension(dimensions: Record<string, number>): string {
  let weakest = "";
  let minScore = Infinity;
  for (const [dim, score] of Object.entries(dimensions)) {
    if (score < minScore) { minScore = score; weakest = dim; }
  }
  return weakest || "structure";
}

function classifySeverity(grade: string, dimensions: Record<string, number>):
  { severity: Severity; domain: Domain } {
  const severity = GRADE_TO_SEVERITY[grade] ?? "INFO";
  const weakest = findWeakestDimension(dimensions);
  const rank = gradeToRank(grade);
  const domain = (weakest === "complexity" && rank >= 3) ? "RELIABILITY" : "MAINTAINABILITY";
  return { severity, domain };
}

function computeHotspotScore(healthScore: number, commits: number): number {
  if (commits === 0) return 0;
  const norm = Math.max(0, Math.min(1, healthScore / 100));
  return (1 - norm) * Math.log(commits + 1);
}

function runGitLog(root: string): { commits: Map<string, number>; gitUnavailable: boolean } {
  try {
    const out = execSync("git log -n 100 --numstat --format=%H",
      { cwd: root, timeout: 5000, encoding: "utf8" });
    const commits = new Map<string, number>();
    for (const line of out.split("\n")) {
      if (!line.trim()) continue;         // blank line
      if (line.length === 40 && !line.includes("\t")) continue;  // commit hash
      const parts = line.split("\t");
      if (parts.length < 3) continue;
      if (parts[0] === "-" || parts[1] === "-") continue;  // binary files
      const file = parts[2].trim();
      if (!file) continue;
      commits.set(file, (commits.get(file) ?? 0) + 1);
    }
    return { commits, gitUnavailable: false };
  } catch {
    return { commits: new Map(), gitUnavailable: true };
  }
}

export function createSeverityTool(manager: ChildServerManager) {
  return {
    name: "boocontext_severity",
    description:
      "Code health with SonarQube-style severity ladder (INFO/MINOR/MAJOR/CRITICAL), software-quality domains (MAINTAINABILITY/RELIABILITY), and CodeScene-style git-aware hotspot prioritization. Returns findings sorted by organizational impact (health x commit frequency). Falls back to severity-only when git unavailable.",
    inputSchema: {
      type: "object",
      properties: {
        directory: { type: "string", description: "Directory to analyze (defaults to cwd)" },
      },
    },
    async handler(args: any): Promise<VerdictEnvelope> {
      const start = Date.now();
      try {
        const tsaClient = await manager.getServer("tree-sitter-analyzer");
        if (args.directory) {
          await tsaClient.callTool({ name: "set_project_path", arguments: { project_path: args.directory } });
        }

        const result = await tsaClient.callTool({ name: "health", arguments: { action: "project", scope: "project" } });
        const text = extractText(result);

        // Try to parse structured data from TSA response
        let parsed: any = {};
        try {
          parsed = JSON.parse(text);
        } catch {
          // TSA returned plain text — no structured severity possible
          return makeVerdict("INFO", "Severity unavailable (TSA returned unstructured output)", { raw: text }, {
            tool: "boocontext_severity", source: "tree-sitter-analyzer", duration_ms: Date.now() - start,
          });
        }

        const root = args.directory ? resolve(args.directory) : process.cwd();
        const { commits: gitCommits, gitUnavailable } = runGitLog(root);

        const findings: SeverityFinding[] = (parsed.files ?? []).map((f: any) => {
          const { severity, domain } = classifySeverity(f.grade, f.dimensions);
          const commits = gitCommits.get(f.file_path) ?? 0;
          const healthScore = f.health_score ?? 50;
          return {
            file: f.file_path,
            grade: f.grade,
            severity,
            domain,
            weakest_dimension: findWeakestDimension(f.dimensions),
            health_score: healthScore,
            commits,
            hotspot_score: computeHotspotScore(healthScore, commits),
          };
        });

        findings.sort((a, b) => b.hotspot_score - a.hotspot_score);

        const critical = findings.filter((f) => f.severity === "CRITICAL").length;
        const major = findings.filter((f) => f.severity === "MAJOR").length;
        const minor = findings.filter((f) => f.severity === "MINOR").length;
        const verdict = critical > 0 ? "CAUTION" : "INFO";
        const summary = `${critical} CRITICAL, ${major} MAJOR, ${minor} MINOR, ${findings.length} total`;

        return makeVerdict(verdict, summary, { findings, git_unavailable: gitUnavailable || undefined }, {
          tool: "boocontext_severity",
          source: "merged",
          duration_ms: Date.now() - start,
        });
      } catch (err: any) {
        return makeVerdict("UNSAFE", `Severity check failed: ${err.message}`, { error: err.message }, {
          tool: "boocontext_severity",
          source: "merged",
          duration_ms: Date.now() - start,
        });
      }
    },
  };
}

function extractText(result: any): string {
  const content = (result as any).content ?? [];
  return content.map((c: any) => c.text ?? "").join("\n");
}
```

### `tools/health.ts` (modified)
Enhance existing handler to include severity tags in details alongside raw TSA output. The `boocontext_health` handler gains an optional post-processing step after receiving the TSA result: if the TSA output contains a parseable JSON `files` array, each file entry gains `severity` and `domain` fields. The raw TSA text output in `details.content` is preserved unchanged.

```ts
// After line 35: try parsing structured data from result text
const text = extractText(result);
try {
  const parsed = JSON.parse(text);
  if (parsed.files) {
    parsed.files = parsed.files.map((f: any) => ({
      ...f,
      severity: classifySeverity(f.grade, f.dimensions).severity,
      domain: classifySeverity(f.grade, f.dimensions).domain,
    }));
    return makeVerdict(verdict, hasDF ? "Some files scored D-F" : "All files healthy", parsed, {
      tool: "boocontext_health",
      source: "tree-sitter-analyzer",
      duration_ms: Date.now() - start,
    });
  }
} catch { /* TSA returned plain text — pass through raw result unchanged */ }
```

### `mcp-server.ts` (modified)
Import and register following existing `boocontextTools` array pattern:
```ts
import { createSeverityTool } from "./tools/severity.js";

// Add to the tool definitions array alongside other boocontextTools:
const boocontextTools = [
  createOverviewTool(),
  createMapTool(),
  createHealthTool(childManager),
  createSymbolsTool(childManager),
  createCallgraphTool(childManager),
  createImpactTool(childManager),
  createTypesTool(childManager),
  createSeverityTool(childManager),
];
```

### `src/tools/index.ts` (modified)
Add re-export:
```ts
export { createSeverityTool } from "./severity.js";
```

## Verdict mapping (no type change)

`VerdictGrade` remains `"SAFE" | "CAUTION" | "UNSAFE" | "INFO"`. The severity tool maps:
- 0 CRITICAL findings → verdict `"INFO"`, summary starts with "0 CRITICAL"
- 1+ CRITICAL findings → verdict `"CAUTION"`, summary starts with "N CRITICAL"

This avoids a breaking type change while still providing the PASS/FAIL signal in the verdict + summary.

## Test strategy

- **Unit**: `classifySeverity` for A→INFO/MAINTAINABILITY, F→CRITICAL/MAINTAINABILITY, C+complexity→MINOR/RELIABILITY
- **Unit**: `findWeakestDimension` for normal case and tie-breaking
- **Unit**: `gradeToRank` for all grades
- **Unit**: `computeHotspotScore` for D+3commits > F+0commits, A+any_commits=0
- **Unit**: `runGitLog` parse with mock numstat output including binary markers and commit hashes
- **Integration**: `boocontext_severity` on boocontext repo — verify verdict and structured findings array
- **Integration**: `boocontext_severity` with git unavailable — verify `git_unavailable: true` in details
- **Regression**: `boocontext_health` still returns raw TSA output with optional severity tags
