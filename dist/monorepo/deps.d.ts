/**
 * Scan all source files under packageDir and return the names of workspace
 * packages (from workspacePackageNames) that are imported.
 * Does not recurse into node_modules.
 */
export declare function extractCrossPackageDeps(packageDir: string, workspacePackageNames: string[]): Promise<string[]>;
/**
 * Write deps.md to the package's .boocontext/ output directory.
 * Creates the directory if it doesn't exist.
 */
export declare function writeDepsFile(packageDir: string, deps: string[], outputDirName: string): Promise<void>;
