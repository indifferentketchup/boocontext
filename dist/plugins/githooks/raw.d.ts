import type { GitHook } from "./types.js";
export declare function parseRawHooks(root: string): Promise<GitHook[]>;
