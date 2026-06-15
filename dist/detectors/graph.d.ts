import type { DependencyGraph, ProjectInfo } from "../types.js";
export declare function detectDependencyGraph(files: string[], project: ProjectInfo): Promise<DependencyGraph>;
