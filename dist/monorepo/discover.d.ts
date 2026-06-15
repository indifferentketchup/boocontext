import type { MonorepoConfig } from "../types.js";
export interface PackageInfo {
    name: string;
    dir: string;
}
/**
 * Discover qualifying workspace packages from the monorepo root.
 * Reads pnpm-workspace.yaml (or package.json workspaces as fallback),
 * expands globs, and applies the minFiles / src / package.json filters.
 */
export declare function discoverPackages(root: string, config: MonorepoConfig): Promise<PackageInfo[]>;
