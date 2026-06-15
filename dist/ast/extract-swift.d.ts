/**
 * Swift / SwiftUI / Vapor extraction.
 * Regex-based — no Swift compiler needed.
 *
 * Supports:
 * - SwiftUI: struct X: View detection → ComponentInfo
 * - Vapor: app.get(), app.post(), routes.get(), etc.
 * - Swift public exports: public class/struct/func/protocol/enum
 */
import type { RouteInfo, ComponentInfo, ExportItem } from "../types.js";
export declare function extractVaporRoutes(filePath: string, content: string, tags: string[]): RouteInfo[];
export declare function extractSwiftUIViews(filePath: string, content: string): ComponentInfo[];
export declare function extractSwiftExports(content: string): ExportItem[];
