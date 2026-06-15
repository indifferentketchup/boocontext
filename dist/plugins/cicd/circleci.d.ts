import type { CICDPipeline } from "./types.js";
/**
 * Extract CircleCI pipelines from a parsed config.yml.
 *
 * CircleCI has a two-level structure:
 * - `jobs:` defines job bodies (executor, steps)
 * - `workflows:` composes jobs with dependencies, contexts, and filters
 *
 * Each workflow becomes a CICDPipeline.
 */
export declare function extractCircleCIWorkflows(parsed: any, relPath: string, rawContent: string): CICDPipeline[];
