import type { HclBlock } from "./types.js";
/**
 * Parse all top-level HCL blocks from a .tf file.
 * Uses regex + brace-counting — zero dependencies.
 */
export declare function parseHclFile(content: string, filePath: string): HclBlock[];
/**
 * Parse a .tfvars file into simple key=value pairs.
 * tfvars files are flat: `key = value` per line, no blocks.
 * NOTE: multiline values (lists, maps, heredocs) are silently truncated to the first line.
 * This is sufficient for scalar overrides (enable flags, counts, tags) but won't capture
 * complex tfvars structures. Extend if needed.
 */
export declare function parseTfvars(content: string): Record<string, string>;
/**
 * Strip HCL comments while preserving string contents.
 * Handles #, //, and block comments.
 */
export declare function stripComments(content: string): string;
/**
 * Extract content between matched braces, starting after the opening brace.
 * Handles strings, heredocs, and nested braces.
 * Based on the pattern from boocontext's extract-go.ts.
 */
export declare function extractBraceBlock(content: string, startAfterOpenBrace: number): string | null;
