import type { ScanResult, KnowledgeMap } from "./types.js";
export declare function writeOutput(result: ScanResult, outputDir: string): Promise<string>;
/**
 * Detect standard CRUD groups: same resource base path with GET, POST,
 * GET/:id, PUT/:id, DELETE/:id — collapse to a summary line in routes output.
 */
export declare function computeCrudGroups(routes: ScanResult["routes"]): import("./types.js").CrudGroup[];
export declare function formatKnowledge(map: KnowledgeMap, projectName: string, version: string): string;
export declare function writeKnowledgeOutput(map: KnowledgeMap, outputDir: string, projectName: string, version: string): Promise<string>;
