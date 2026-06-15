/**
 * Knowledge detector: scans .md files and extracts structured AI context.
 *
 * Handles:
 * - Obsidian vaults (frontmatter, [[backlinks]], #tags)
 * - ADRs / decision records
 * - Meeting notes, retrospectives, session logs
 * - Project specs / PRDs / backlogs
 * - Any markdown-based knowledge base
 *
 * Outputs a compact KnowledgeMap usable as AI context primer.
 */
import type { KnowledgeMap } from "../types.js";
export declare function detectKnowledge(files: string[], root: string): Promise<KnowledgeMap>;
