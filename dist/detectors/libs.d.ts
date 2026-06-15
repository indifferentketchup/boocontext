import type { LibExport, ProjectInfo } from "../types.js";
export declare function detectLibs(files: string[], project: ProjectInfo): Promise<LibExport[]>;
