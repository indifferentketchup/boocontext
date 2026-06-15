import type { BoocontextPlugin } from "../../types.js";
import type { TerraformPluginConfig } from "./types.js";
export type { TerraformPluginConfig } from "./types.js";
/**
 * Create a Terraform infrastructure plugin for boocontext.
 *
 * Scans .tf files — either co-located in the project or in a separate
 * infrastructure repo — and generates an infrastructure section with
 * deployment context for AI agents.
 *
 * @example
 * // Auto-discover infrastructure
 * createTerraformPlugin()
 *
 * @example
 * // Explicit centralised infra repo
 * createTerraformPlugin({
 *   infraPath: '../infrastructure',
 *   serviceName: 'query-service',
 * })
 */
export declare function createTerraformPlugin(config?: TerraformPluginConfig): BoocontextPlugin;
