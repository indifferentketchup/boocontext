import type { ScanResult, BoocontextConfig } from "./types.js";
export declare const VERSION: string;
export declare const BRAND = "boocontext";
export declare function scan(root: string, outputDirName: string, maxDepth: number, userConfig?: BoocontextConfig, quiet?: boolean): Promise<ScanResult>;
