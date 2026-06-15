/**
 * Go structured parser for routes and models.
 * Uses brace-tracking + regex for near-AST accuracy on Go's regular syntax.
 *
 * Go's syntax is regular enough that structured parsing (tracking braces,
 * extracting struct bodies, parsing field tags) achieves AST-level accuracy
 * without needing the Go compiler.
 *
 * Extracts:
 * - Gin/Fiber/Echo/Chi/net-http routes with group prefixes
 * - GORM model structs with field types, tags (primaryKey, unique, etc.)
 */
import type { RouteInfo, SchemaModel, Framework } from "../types.js";
/**
 * Extract routes from a Go file with group/prefix tracking.
 * Works for Gin, Fiber, Echo, Chi, and net/http.
 */
export declare function extractGoRoutesStructured(filePath: string, content: string, framework: Framework, tags: string[]): RouteInfo[];
/**
 * Extract GORM model structs from a Go file.
 * Parses struct bodies, field types, and gorm tags.
 */
export declare function extractGORMModelsStructured(_filePath: string, content: string): SchemaModel[];
export declare function extractEntSchemasStructured(_filePath: string, content: string): SchemaModel[];
