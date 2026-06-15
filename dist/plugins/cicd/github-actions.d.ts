import type { CICDPipeline } from "./types.js";
/**
 * Extract GitHub Actions workflow pipelines from a parsed YAML object.
 */
export declare function extractGitHubActionsWorkflow(parsed: any, relPath: string, rawContent: string): CICDPipeline | null;
