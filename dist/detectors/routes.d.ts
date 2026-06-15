import type { RouteInfo, ProjectInfo, BoocontextConfig } from "../types.js";
export declare function detectRoutes(files: string[], project: ProjectInfo, config?: BoocontextConfig): Promise<RouteInfo[]>;
