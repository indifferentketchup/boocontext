import { readdir, stat, readFile } from "node:fs/promises";
import { join } from "node:path";
import type { Dirent } from "node:fs";
import type { MonorepoConfig } from "../types.js";

export interface PackageInfo {
  name: string;   // value of "name" field in package.json
  dir: string;    // absolute path to package directory
}

/**
 * Discover qualifying workspace packages from the monorepo root.
 * Reads pnpm-workspace.yaml (or package.json workspaces as fallback),
 * expands globs, and applies the minFiles / src / package.json filters.
 */
export async function discoverPackages(
  root: string,
  config: MonorepoConfig
): Promise<PackageInfo[]> {
  const patterns = await readWorkspacePatterns(root, config.workspaceFile);
  if (patterns.length === 0) {
    throw new Error(
      "No workspace patterns found. Add pnpm-workspace.yaml or a workspaces field to package.json."
    );
  }

  const positivePatterns = patterns.filter((p) => !p.startsWith("!"));
  const negativePatterns = patterns.filter((p) => p.startsWith("!")).map((p) => p.slice(1));

  // Expand positive patterns to candidate directories
  const candidateDirs = new Set<string>();
  for (const pattern of positivePatterns) {
    for (const dir of await expandGlobPattern(root, pattern)) {
      candidateDirs.add(dir);
    }
  }

  // Build exclusion set from negative patterns
  const excludedDirs = new Set<string>();
  for (const pattern of negativePatterns) {
    for (const dir of await expandGlobPattern(root, pattern)) {
      excludedDirs.add(dir);
    }
  }

  const minFiles = config.minFiles ?? 10;
  const qualified: PackageInfo[] = [];

  for (const dir of candidateDirs) {
    if (excludedDirs.has(dir)) continue;

    // Must have package.json
    const pkgName = await readPackageName(dir);
    if (pkgName === null) continue;

    // Explicit exclude list
    if (config.exclude?.includes(pkgName)) continue;

    // Explicit include list bypasses remaining filters
    if (config.include?.includes(pkgName)) {
      qualified.push({ name: pkgName, dir });
      continue;
    }

    // Must have src/ directory
    if (!(await dirExists(join(dir, "src")))) continue;

    // Must meet minimum source file count
    const count = await countSourceFiles(dir);
    if (count < minFiles) continue;

    qualified.push({ name: pkgName, dir });
  }

  return qualified;
}

// --- Helpers ---

async function readWorkspacePatterns(root: string, workspaceFile?: string): Promise<string[]> {
  const yamlPath = join(root, workspaceFile ?? "pnpm-workspace.yaml");
  try {
    const yaml = await readFile(yamlPath, "utf-8");
    const patterns: string[] = [];
    let inPackages = false;
    for (const line of yaml.split("\n")) {
      if (/^packages\s*:/.test(line)) { inPackages = true; continue; }
      if (inPackages) {
        if (/^[a-zA-Z]/.test(line)) break; // new top-level key
        const match = line.match(/^\s*-\s*['"]?([^'"#\n]+?)['"]?\s*(?:#.*)?$/);
        if (match) patterns.push(match[1].trim());
      }
    }
    if (patterns.length > 0) return patterns;
  } catch {}

  // Fallback: package.json workspaces
  try {
    const pkg = JSON.parse(await readFile(join(root, "package.json"), "utf-8"));
    if (Array.isArray(pkg.workspaces)) return pkg.workspaces;
    if (Array.isArray(pkg.workspaces?.packages)) return pkg.workspaces.packages;
  } catch {}

  return [];
}

/**
 * Expand a single glob pattern relative to root.
 * Supports patterns like "packages/*" (one level) and "packages/**" (recursive).
 * Does not implement full glob syntax — only the subset used by pnpm workspaces.
 */
async function expandGlobPattern(root: string, pattern: string): Promise<string[]> {
  // Find base dir: everything before the first path segment containing *
  const parts = pattern.split("/");
  const baseParts: string[] = [];
  let isRecursive = false;
  for (const part of parts) {
    if (part.includes("*")) {
      isRecursive = part === "**";
      break;
    }
    baseParts.push(part);
  }

  const baseDir = join(root, ...baseParts);

  if (isRecursive || pattern.includes("**")) {
    return walkForPackageDirs(baseDir);
  }

  if (pattern.includes("*")) {
    // Single-level glob: direct children of baseDir
    return shallowPackageDirs(baseDir);
  }

  // Literal path
  return [join(root, pattern)];
}

/**
 * Recursively walk a directory tree, returning directories that contain package.json.
 * Stops recursing into a directory once package.json is found (no nested packages).
 * Skips node_modules and hidden directories.
 */
async function walkForPackageDirs(dir: string): Promise<string[]> {
  const results: string[] = [];
  await _walk(dir, results);
  return results;
}

async function _walk(dir: string, results: string[]): Promise<void> {
  let entries: Dirent[];
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }

  const hasPackageJson = entries.some((e) => e.isFile() && e.name === "package.json");
  if (hasPackageJson) {
    results.push(dir);
    return; // Don't recurse into a package
  }

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
    await _walk(join(dir, entry.name), results);
  }
}

async function shallowPackageDirs(baseDir: string): Promise<string[]> {
  const results: string[] = [];
  try {
    const entries = await readdir(baseDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name.startsWith(".")) continue;
      const candidate = join(baseDir, entry.name);
      try {
        await stat(join(candidate, "package.json"));
        results.push(candidate);
      } catch {}
    }
  } catch {}
  return results;
}

async function readPackageName(dir: string): Promise<string | null> {
  try {
    const pkg = JSON.parse(await readFile(join(dir, "package.json"), "utf-8"));
    return typeof pkg.name === "string" ? pkg.name : null;
  } catch {
    return null;
  }
}

async function dirExists(path: string): Promise<boolean> {
  try {
    const s = await stat(path);
    return s.isDirectory();
  } catch {
    return false;
  }
}

const SOURCE_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx"]);

/**
 * Count source files (.ts, .tsx, .js, .jsx) under dir, excluding node_modules.
 * Returns early once count reaches the threshold (short-circuit optimization).
 */
async function countSourceFiles(dir: string, threshold = 50): Promise<number> {
  let count = 0;
  await _countFiles(dir, { count: 0 }, threshold, (c) => { count = c; });
  return count;
}

async function _countFiles(
  dir: string,
  state: { count: number },
  threshold: number,
  onDone: (n: number) => void
): Promise<void> {
  let entries: Dirent[];
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (state.count >= threshold) { onDone(state.count); return; }
    if (entry.isFile()) {
      const ext = entry.name.slice(entry.name.lastIndexOf("."));
      if (SOURCE_EXTENSIONS.has(ext)) state.count++;
    } else if (entry.isDirectory() && entry.name !== "node_modules" && !entry.name.startsWith(".")) {
      await _countFiles(join(dir, entry.name), state, threshold, onDone);
    }
  }
  onDone(state.count);
}
