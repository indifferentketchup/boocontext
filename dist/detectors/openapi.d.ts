/**
 * OpenAPI / Swagger spec ingestion.
 * Parses openapi.yaml, openapi.json, swagger.yaml, swagger.json and extracts
 * routes (paths + methods) and schema models (components/schemas, definitions).
 */
import type { RouteInfo, SchemaModel, ProjectInfo } from "../types.js";
export interface OpenAPIResult {
    routes: RouteInfo[];
    schemas: SchemaModel[];
    specFile: string | null;
}
export declare function detectOpenAPISpec(root: string, project: ProjectInfo): Promise<OpenAPIResult>;
