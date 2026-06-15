import type { ScanResult, BlastRadiusResult } from "../types.js";
/**
 * Blast radius analysis: given a file, find all transitively affected
 * files, routes, models, and middleware using BFS through the import graph.
 */
export declare function analyzeBlastRadius(filePath: string, result: ScanResult, maxDepth?: number): BlastRadiusResult;
/**
 * Multi-file blast radius: given a list of changed files (e.g., from git diff),
 * find the combined blast radius.
 */
export declare function analyzeMultiFileBlastRadius(files: string[], result: ScanResult, maxDepth?: number): BlastRadiusResult;
