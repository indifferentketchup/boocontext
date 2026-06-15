/**
 * AST-based component extraction for React.
 * Provides higher accuracy than regex for:
 * - Component name detection from function/arrow function declarations
 * - Prop extraction from destructured parameters and Props interface/type
 * - Distinguishes client/server components via directive detection
 */
import type { ComponentInfo } from "../types.js";
/**
 * Extract React components from a file using AST.
 */
export declare function extractReactComponentsAST(ts: any, filePath: string, content: string, relPath: string): ComponentInfo[];
