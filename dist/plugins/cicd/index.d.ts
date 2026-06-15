import type { BoocontextPlugin } from "../../types.js";
export type { CICDPipeline, CICDTrigger, CICDJob, CICDSystem } from "./types.js";
export interface CICDPluginConfig {
    /** CI systems to scan. Default: all supported systems. */
    systems?: ("github-actions" | "circleci")[];
}
/**
 * Create a CI/CD pipeline detection plugin for boocontext.
 *
 * Scans GitHub Actions workflow files and CircleCI config files,
 * extracts pipeline structure (triggers, jobs, secrets, deploy targets),
 * and produces a cicd.md section.
 *
 * CI/CD configs live in dotfile directories (.github/, .circleci/) which
 * boocontext's collectFiles() skips. This plugin discovers them independently
 * from project.root, similar to how the Terraform plugin discovers .tf files.
 *
 * @example
 * // Detect all supported CI systems
 * createCICDPlugin()
 *
 * @example
 * // Only scan GitHub Actions
 * createCICDPlugin({ systems: ["github-actions"] })
 */
export declare function createCICDPlugin(config?: CICDPluginConfig): BoocontextPlugin;
