import type { MiddlewareInfo, ProjectInfo } from "../types.js";
export declare function detectMiddleware(files: string[], project: ProjectInfo): Promise<MiddlewareInfo[]>;
