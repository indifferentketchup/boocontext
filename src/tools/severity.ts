import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { makeVerdict, type VerdictEnvelope } from "../verdict.js";
import type { ChildServerManager } from "../child-server.js";

type Severity = "INFO" | "MINOR" | "MAJOR" | "CRITICAL";
type Domain = "MAINTAINABILITY" | "RELIABILITY" | "SECURITY";

interface FileGitStats {
  commits: number;
  lastModified: number;
}

interface SeverityFinding {
  file: string;
  grade: string;
  severity: Severity;
  domain: Domain;
  weakest_dimension: string;
  health_score: number;
  commits: number;
  loc: number;
  days_since_last_commit: number;
  hotspot_score: number;
}

const GRADE_TO_SEVERITY: Record<string, Severity> = {
  A: "INFO", B: "INFO", C: "MINOR", D: "MAJOR", F: "CRITICAL"
};

const GRADE_RANK: Record<string, number> = { A: 0, B: 1, C: 2, D: 3, F: 4 };

function gradeToRank(grade: string): number {
  return GRADE_RANK[grade] ?? -1;
}

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

function computeHotspotScore(healthScore: number, commits: number, loc: number, daysSinceLastCommit: number): number {
  if (commits === 0) return 0;
  const healthPenalty = Math.max(0, Math.min(1, 1 - healthScore / 100));
  const commitWeight = Math.log(commits + 1);
  const sizeWeight = loc > 0 ? Math.log(loc + 1) : 1;
  const recencyWeight = 1 / (1 + Math.log(Math.max(1, daysSinceLastCommit + 1)));
  return healthPenalty * commitWeight * sizeWeight * recencyWeight;
}

function runGitLog(root: string): { fileStats: Map<string, FileGitStats>; gitUnavailable: boolean } {
  try {
    const out = execSync('git log -n 100 --numstat --pretty=format:"%H %at"',
      { cwd: root, timeout: 5000, encoding: "utf8", shell: "/bin/bash" });
    const fileStats = new Map<string, FileGitStats>();
    let currentTimestamp = 0;
    for (const line of out.split("\n")) {
      if (!line.trim()) continue;
      if (!line.includes("\t")) {
        const parts = line.trim().split(/\s+/);
        if (parts.length === 2 && parts[0].length === 40) {
          currentTimestamp = parseInt(parts[1], 10) || 0;
        }
        continue;
      }
      const parts = line.split("\t");
      if (parts.length < 3) continue;
      if (parts[0] === "-" || parts[1] === "-") continue;
      const file = parts[2].trim();
      if (!file) continue;
      const existing = fileStats.get(file);
      if (existing) {
        existing.commits++;
        if (currentTimestamp > existing.lastModified) existing.lastModified = currentTimestamp;
      } else {
        fileStats.set(file, { commits: 1, lastModified: currentTimestamp });
      }
    }
    return { fileStats, gitUnavailable: false };
  } catch {
    return { fileStats: new Map(), gitUnavailable: true };
  }
}

function runFileLOC(root: string): Map<string, number> {
  try {
    const out = execSync("git ls-files",
      { cwd: root, timeout: 5000, encoding: "utf8" });
    const files = out.split("\n").filter(Boolean);
    const loc = new Map<string, number>();
    for (const file of files) {
      try {
        const content = readFileSync(resolve(root, file), "utf8");
        const lines = content.split("\n").length;
        if (lines > 0) loc.set(file, lines);
      } catch { /* binary or deleted */ }
    }
    return loc;
  } catch {
    return new Map();
  }
}

function daysAgo(timestamp: number): number {
  const now = Math.floor(Date.now() / 1000);
  return Math.floor((now - timestamp) / 86400);
}

function extractText(result: any): string {
  const content = (result as any).content ?? [];
  return content.map((c: any) => c.text ?? "").join("\n");
}

export function createSeverityTool(manager: ChildServerManager) {
  return {
    name: "boocontext_severity",
    description:
      "Code health with SonarQube-style severity ladder (INFO/MINOR/MAJOR/CRITICAL), software-quality domains (MAINTAINABILITY/RELIABILITY), and CodeScene-style git-aware hotspot prioritization. Returns findings sorted by organizational impact (health x commit frequency).",
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

        let parsed: any = {};
        try {
          parsed = JSON.parse(text);
        } catch {
          return makeVerdict("INFO", "Severity unavailable (TSA returned unstructured output)", { raw: text }, {
            tool: "boocontext_severity", source: "tree-sitter-analyzer", duration_ms: Date.now() - start,
          });
        }

        const root = args.directory ? resolve(args.directory) : process.cwd();
        const { fileStats, gitUnavailable } = runGitLog(root);
        const fileLOC = gitUnavailable ? new Map<string, number>() : runFileLOC(root);

        const findings: SeverityFinding[] = (parsed.files ?? []).map((f: any) => {
          const { severity, domain } = classifySeverity(f.grade, f.dimensions);
          const stats = fileStats.get(f.file_path);
          const commits = stats?.commits ?? 0;
          const lastModified = stats?.lastModified ?? 0;
          const healthScore = f.health_score ?? 50;
          const loc = fileLOC.get(f.file_path) ?? 0;
          const daysSinceLastCommit = lastModified > 0 ? daysAgo(lastModified) : 365;
          return {
            file: f.file_path,
            grade: f.grade,
            severity,
            domain,
            weakest_dimension: findWeakestDimension(f.dimensions),
            health_score: healthScore,
            commits,
            loc,
            days_since_last_commit: daysSinceLastCommit,
            hotspot_score: computeHotspotScore(healthScore, commits, loc, daysSinceLastCommit),
          };
        });

        const severityRank: Record<Severity, number> = { CRITICAL: 0, MAJOR: 1, MINOR: 2, INFO: 3 };
        findings.sort((a, b) => {
          const hsDiff = b.hotspot_score - a.hotspot_score;
          if (hsDiff !== 0) return hsDiff;
          return (severityRank[a.severity] ?? 99) - (severityRank[b.severity] ?? 99);
        });

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

export { classifySeverity, findWeakestDimension, gradeToRank, computeHotspotScore, runGitLog, runFileLOC, daysAgo };
export type { Severity, Domain, SeverityFinding, FileGitStats };
