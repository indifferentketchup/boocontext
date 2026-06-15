import type { ScanResult } from "../types.js";
/**
 * Token counting heuristic.
 *
 * Claude / GPT tokenization averages ~3.5 chars/token for English prose, but
 * code is denser (~2.8 chars/token for identifiers/symbols, ~5 for whitespace).
 * We use a blended estimate that weights code sections differently from prose.
 *
 * Still zero external dependencies — this is an estimate, not tiktoken.
 */
export declare function estimateTokens(text: string): number;
/**
 * Cost model for manual AI exploration — how many tokens an AI would spend
 * discovering the same information without boocontext.
 *
 * Based on empirical observation of Claude Code tool call patterns:
 *  - Each route discovered: ~400 tokens (read handler file + grep pattern)
 *  - Each schema model: ~300 tokens (read schema/migration file)
 *  - Each component: ~250 tokens (read component file + search for usage)
 *  - Each lib file: ~200 tokens (read exports)
 *  - Each env var: ~100 tokens (grep across .env files)
 *  - Each middleware: ~200 tokens (read middleware registration)
 *  - Each hot file: ~150 tokens (read file to understand dependencies)
 *  - File search overhead: ~80 tokens per file (glob + stat), capped at 50 files
 *  - GraphQL/gRPC operations: ~350 tokens each (read resolver + schema)
 *  - Event/queue entry: ~150 tokens (read queue registration)
 *  - 1.3x revisit multiplier (AI re-reads files across multi-turn conversation)
 */
export declare function calculateTokenStats(result: ScanResult, outputText: string, fileCount: number): import("../types.js").TokenStats;
