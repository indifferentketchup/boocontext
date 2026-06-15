/**
 * Test coverage mapper.
 * Identifies which routes and schema models have corresponding test files.
 * Uses heuristics: file path matching and string pattern searching in test files.
 */
import type { RouteInfo, SchemaModel, TestCoverage } from "../types.js";
export declare function isTestFile(file: string): boolean;
export declare function detectTestCoverage(files: string[], routes: RouteInfo[], schemas: SchemaModel[], projectRoot: string): Promise<TestCoverage>;
