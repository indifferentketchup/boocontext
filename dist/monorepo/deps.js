import { readdir, readFile, writeFile, mkdir } from "node:fs/promises";
import { join, extname } from "node:path";
const SOURCE_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"]);
// Matches: import ... from '@scope/pkg' and export ... from '@scope/pkg'
// and require('@scope/pkg')
const IMPORT_PATTERNS = [
    /(?:import|export)\s+(?:.*?from\s+)?['"](@[^'"]+)['"]/g,
    /require\s*\(\s*['"](@[^'"]+)['"]\s*\)/g,
];
/**
 * Scan all source files under packageDir and return the names of workspace
 * packages (from workspacePackageNames) that are imported.
 * Does not recurse into node_modules.
 */
export async function extractCrossPackageDeps(packageDir, workspacePackageNames) {
    const nameSet = new Set(workspacePackageNames);
    const found = new Set();
    const files = await collectSourceFiles(packageDir);
    for (const file of files) {
        let content;
        try {
            content = await readFile(file, "utf-8");
        }
        catch {
            continue;
        }
        for (const pattern of IMPORT_PATTERNS) {
            pattern.lastIndex = 0;
            let match;
            while ((match = pattern.exec(content)) !== null) {
                const importedPkg = match[1];
                if (nameSet.has(importedPkg))
                    found.add(importedPkg);
            }
        }
    }
    return Array.from(found).sort();
}
/**
 * Write deps.md to the package's .boocontext/ output directory.
 * Creates the directory if it doesn't exist.
 */
export async function writeDepsFile(packageDir, deps, outputDirName) {
    const outputDir = join(packageDir, outputDirName);
    await mkdir(outputDir, { recursive: true });
    const lines = ["## Cross-package dependencies\n"];
    if (deps.length === 0) {
        lines.push("_(none)_\n");
    }
    else {
        for (const dep of deps) {
            lines.push(`- ${dep}`);
        }
        lines.push("");
    }
    await writeFile(join(outputDir, "deps.md"), lines.join("\n"), "utf-8");
}
async function collectSourceFiles(dir) {
    const results = [];
    await _collectFiles(dir, results);
    return results;
}
async function _collectFiles(dir, results) {
    let entries;
    try {
        entries = await readdir(dir, { withFileTypes: true });
    }
    catch {
        return;
    }
    for (const entry of entries) {
        if (entry.isFile() && SOURCE_EXTENSIONS.has(extname(entry.name))) {
            results.push(join(dir, entry.name));
        }
        else if (entry.isDirectory() && entry.name !== "node_modules" && !entry.name.startsWith(".")) {
            await _collectFiles(join(dir, entry.name), results);
        }
    }
}
