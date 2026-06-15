import type { HclBlock, TerraformPluginConfig } from "./types.js";
export interface ScoredBlock {
    block: HclBlock;
    score: number;
}
/**
 * Find all HCL blocks belonging to a given service.
 * Uses a multi-signal scoring algorithm: file name, label prefix/exact,
 * image URI, enable flags, and user-configured aliases.
 */
export declare function matchServiceBlocks(projectName: string, blocks: HclBlock[], config: TerraformPluginConfig): HclBlock[];
/**
 * Normalise a service name for comparison.
 * "query-service" → "query_service"
 * "QueryService" → "query_service"
 * "query-service-app" → "query_service_app"
 */
export declare function normaliseServiceName(name: string): string;
