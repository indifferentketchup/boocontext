import type { RouteInfo, ProjectInfo } from "../types.js";
/**
 * Enhances route info with request/response type information
 * by scanning the route handler files for type annotations
 */
export declare function enrichRouteContracts(routes: RouteInfo[], project: ProjectInfo): Promise<RouteInfo[]>;
