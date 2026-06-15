import { writeFile, mkdir, stat } from "node:fs/promises";
import { join, relative } from "node:path";
import { scan } from "../core.js";
import { discoverPackages } from "./discover.js";
import { extractCrossPackageDeps, writeDepsFile } from "./deps.js";
const GLOBAL_INDEX_FILENAME = "BOOCONTEXT.md";
/**
 * Run the full monorepo scan or refresh a single named package.
 * When targetPackage is provided, only that package is (re)scanned.
 */
export async function runMonorepoScan(root, userConfig, targetPackage) {
    const monorepoConfig = userConfig.monorepo ?? {};
    const outputDirName = userConfig.outputDir ?? ".boocontext";
    const maxDepth = userConfig.maxDepth ?? 10;
    // Discover all qualifying packages
    let packages = await discoverPackages(root, monorepoConfig);
    // Collect all package names for cross-dep detection
    const allPackageNames = packages.map((p) => p.name);
    if (targetPackage) {
        const match = packages.find((p) => p.name === targetPackage);
        if (!match) {
            console.warn(`  boocontext --refresh: package "${targetPackage}" not found or filtered out.`);
            return [];
        }
        packages = [match];
    }
    console.log(`\n  boocontext monorepo — scanning ${packages.length} package(s)\n`);
    for (const pkg of packages) {
        process.stdout.write(`  [${pkg.name}]...`);
        try {
            await scan(pkg.dir, outputDirName, maxDepth, userConfig, true /* quiet */);
            const deps = await extractCrossPackageDeps(pkg.dir, allPackageNames);
            await writeDepsFile(pkg.dir, deps, outputDirName);
            console.log(` done`);
        }
        catch (err) {
            console.error(` ERROR: ${err.message}`);
        }
    }
    // Write or refresh global index
    await writeGlobalIndex(root, packages.map((p) => p.dir), outputDirName);
    console.log(`\n  Global index updated: ${GLOBAL_INDEX_FILENAME}\n`);
    return packages;
}
async function writeGlobalIndex(root, qualifyingPackageDirs, outputDirName) {
    // Only list packages that actually have a .boocontext/ directory
    const confirmed = [];
    for (const dir of qualifyingPackageDirs) {
        try {
            await stat(join(dir, outputDirName));
            confirmed.push(relative(root, dir));
        }
        catch { }
    }
    confirmed.sort();
    const lines = [
        "# CodeSight — Monorepo Index",
        "",
        "This project uses per-package CodeSight context files. Before using grep/find",
        "to explore a package, check if `.boocontext/BOOCONTEXT.md` exists in that",
        "package's directory — it will be faster and cheaper.",
        "",
        "## Packages with CodeSight context",
        "",
        ...confirmed,
        "",
    ];
    const outDir = join(root, outputDirName);
    await mkdir(outDir, { recursive: true });
    await writeFile(join(outDir, GLOBAL_INDEX_FILENAME), lines.join("\n"), "utf-8");
}
