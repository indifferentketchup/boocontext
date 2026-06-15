import type { ScanResult } from "../types.js";
export declare function generateAIConfigs(result: ScanResult, root: string): Promise<string[]>;
/**
 * Generate a profile-specific config file optimized for a particular AI tool.
 * Includes tool-specific instructions on how to use boocontext outputs.
 */
export declare function generateProfileConfig(result: ScanResult, root: string, profile: string): Promise<string>;
/**
 * Generate AI config files (CLAUDE.md, .cursorrules, etc.) with monorepo-appropriate content.
 * Uses the same append-if-exists logic as generateAIConfigs for single-project mode.
 */
export declare function generateMonorepoAIConfigs(root: string, packages: Array<{
    name: string;
    dir: string;
}>, outputDirName: string): Promise<string[]>;
