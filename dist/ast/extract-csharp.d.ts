/**
 * C# / ASP.NET Core route and Entity Framework model extraction.
 * Regex-based (no external compiler needed).
 *
 * Supports:
 * - Controller-style routes: [HttpGet], [HttpPost], etc. + [Route] class prefix
 * - Minimal API routes: app.MapGet(), app.MapPost(), etc. (Program.cs)
 * - Entity Framework: DbContext subclass → DbSet<Model> extraction
 */
import type { RouteInfo, SchemaModel, ExportItem } from "../types.js";
export declare function extractAspNetControllerRoutes(filePath: string, content: string, tags: string[]): RouteInfo[];
export declare function extractAspNetMinimalApiRoutes(filePath: string, content: string, tags: string[]): RouteInfo[];
export declare function extractEntityFrameworkModels(_filePath: string, content: string): SchemaModel[];
export declare function extractCSharpExports(content: string): ExportItem[];
