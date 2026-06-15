import type { BoocontextConfig } from "../types.js";
/**
 * Start a single monorepo-root watcher that dispatches file-change events
 * to per-package rebuilds. Runs until SIGINT (Ctrl+C).
 */
export declare function watchMonorepo(root: string, userConfig: BoocontextConfig): Promise<void>;
