import type { ProjectInfo } from "./types.js";
/**
 * Read .boocontextignore at the project root and return ignore patterns.
 * One glob pattern per line. Lines starting with # are comments.
 */
export declare function readBoocontextIgnore(root: string): Promise<string[]>;
/**
 * File hash cache — persists per-file content hashes so incremental scans
 * only reprocess files that changed. Cache stored in .boocontext/cache.json.
 */
export interface FileHashCache {
    version: number;
    hashes: Record<string, string>;
}
export declare function loadFileHashCache(outputDir: string): Promise<FileHashCache>;
export declare function saveFileHashCache(outputDir: string, cache: FileHashCache): Promise<void>;
export declare function hashFileContent(content: string): string;
export declare function collectFiles(root: string, maxDepth?: number, ignorePatterns?: string[]): Promise<string[]>;
export declare function readFileSafe(path: string): Promise<string>;
export declare function detectProject(root: string): Promise<ProjectInfo>;
/**
 * Check whether a directory looks like a Roku channel.
 *
 * Roku apps are anchored by a plain text file named `manifest` (no extension)
 * at the channel root, containing key=value lines including `title=` and
 * `major_version=`. This is the definitive Roku signal — no other ecosystem
 * uses this exact pattern, so no secondary signals are needed.
 */
export declare function hasRokuManifest(dir: string): Promise<boolean>;
/**
 * Detect BrighterScript-based Roku channel roots without a `manifest` file.
 *
 * Two layouts are recognized:
 *
 *   1. rokucommunity/brighterscript-template — bsconfig.json at root,
 *      channel under `src/manifest`.
 *
 *   2. Enterprise / custom layout — bsconfig.json at root with `rootDir: ""`
 *      (channel root IS the project root). Manifest is absent because it is
 *      generated at build time (e.g. python/gulp build scripts). The canonical
 *      Roku directories `source/` and `components/` with at least one .brs
 *      file serve as the structural signal instead.
 */
export declare function detectBrighterScriptTemplateRoot(dir: string): Promise<boolean>;
/**
 * Detect a Roku multi-channel monorepo layout. 90% of Roku repos are
 * single-channel (manifest at root), but a small set of larger codebases
 * ship multiple channels from one repo using `roku-deploy` + `gulp` to merge
 * per-channel assets with a shared `common/` layer at build time.
 *
 * Required signals (all must hold):
 *   1. No manifest at `root` (otherwise it's a standard single-channel repo)
 *   2. `root/package.json` declares `roku-deploy` in deps or devDeps
 *   3. Some container dir `C` contains:
 *        - a `common/` subdirectory, AND
 *        - at least 2 sibling directories of `common/` that each have their
 *          own `manifest` file
 *
 * When these match, returns `{ containerDir, channelDirs, commonDir }`.
 * Otherwise returns null and the caller treats the repo as single-channel
 * (or not a Roku repo at all).
 */
export declare function detectRokuMonorepo(root: string): Promise<{
    containerDir: string;
    channelDirs: string[];
    commonDir: string;
} | null>;
