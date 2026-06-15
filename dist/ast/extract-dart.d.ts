/**
 * Dart / Flutter extraction.
 * Regex-based — no Dart compiler needed.
 *
 * Supports:
 * - go_router: GoRoute(path: '/path') detection
 * - Widget detection: StatelessWidget, StatefulWidget, ConsumerWidget, HookWidget
 * - Dart public exports: classes, functions (no leading _ = public in Dart)
 */
import type { RouteInfo, ComponentInfo, ExportItem } from "../types.js";
export declare function extractFlutterRoutes(filePath: string, content: string, tags: string[]): RouteInfo[];
export declare function extractFlutterWidgets(filePath: string, content: string): ComponentInfo[];
export declare function extractDartExports(content: string): ExportItem[];
