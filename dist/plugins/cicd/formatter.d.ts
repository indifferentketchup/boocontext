import type { CICDPipeline } from "./types.js";
/**
 * Format CI/CD pipeline data into markdown for the custom section output.
 */
export declare function formatCICD(pipelines: CICDPipeline[]): string;
