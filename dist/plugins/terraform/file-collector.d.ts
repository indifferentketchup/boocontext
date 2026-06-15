import type { TerraformPluginConfig } from "./types.js";
export interface CollectedFiles {
    tfFiles: string[];
    tfvarsFiles: string[];
    basePath: string;
}
/**
 * Collect .tf and .tfvars files from the best-matching infrastructure location.
 * Tries: explicit config path → in-project subdirs → sibling repos → project root.
 */
export declare function collectTfFiles(projectRoot: string, config: TerraformPluginConfig): Promise<CollectedFiles>;
/**
 * Read a file's contents, returning empty string on failure.
 */
export declare function readFileSafe(path: string): Promise<string>;
