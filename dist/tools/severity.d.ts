import { type VerdictEnvelope } from "../verdict.js";
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
declare function gradeToRank(grade: string): number;
declare function findWeakestDimension(dimensions: Record<string, number>): string;
declare function classifySeverity(grade: string, dimensions: Record<string, number>): {
    severity: Severity;
    domain: Domain;
};
declare function computeHotspotScore(healthScore: number, commits: number, loc: number, daysSinceLastCommit: number): number;
declare function runGitLog(root: string): {
    fileStats: Map<string, FileGitStats>;
    gitUnavailable: boolean;
};
declare function runFileLOC(root: string): Map<string, number>;
declare function daysAgo(timestamp: number): number;
export declare function createSeverityTool(manager: ChildServerManager): {
    name: string;
    description: string;
    inputSchema: {
        type: string;
        properties: {
            directory: {
                type: string;
                description: string;
            };
        };
    };
    handler(args: any): Promise<VerdictEnvelope>;
};
export { classifySeverity, findWeakestDimension, gradeToRank, computeHotspotScore, runGitLog, runFileLOC, daysAgo };
export type { Severity, Domain, SeverityFinding, FileGitStats };
