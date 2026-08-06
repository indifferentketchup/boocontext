import type { HclBlock, ServiceInfrastructure, EnvironmentOverrides, TerraformPluginConfig } from "./types.js";
export declare const REDACTED = "[redacted]";
export declare function isSensitiveKey(name: string): boolean;
export declare function looksLikeSecretValue(value: string): boolean;
export declare function redactValue(name: string, value: string): {
    value: string;
    sensitive: boolean;
};
/**
 * Extract structured infrastructure context from matched HCL blocks.
 */
export declare function extractServiceInfrastructure(matchedBlocks: HclBlock[], allBlocks: HclBlock[], config: TerraformPluginConfig): ServiceInfrastructure;
/**
 * Parse .tfvars files and extract per-environment overrides for this service.
 */
export declare function extractEnvironments(tfvarsFiles: string[], serviceName: string): Promise<Record<string, EnvironmentOverrides>>;
