/**
 * Configuration loader: reads boocontext.config.(ts|js|json) from project root.
 */
import type { BoocontextConfig } from "./types.js";
/**
 * Load config from project root. Returns empty config if no config file found.
 */
export declare function loadConfig(root: string): Promise<BoocontextConfig>;
/**
 * Merges CLI args with config file values (CLI takes precedence).
 */
export declare function mergeCliConfig(config: BoocontextConfig, cli: {
    maxDepth?: number;
    outputDir?: string;
    profile?: string;
    maxTokens?: number;
}): BoocontextConfig;
