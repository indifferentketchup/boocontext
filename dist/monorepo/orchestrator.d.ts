import { type PackageInfo } from "./discover.js";
import type { BoocontextConfig } from "../types.js";
/**
 * Run the full monorepo scan or refresh a single named package.
 * When targetPackage is provided, only that package is (re)scanned.
 */
export declare function runMonorepoScan(root: string, userConfig: BoocontextConfig, targetPackage?: string): Promise<PackageInfo[]>;
