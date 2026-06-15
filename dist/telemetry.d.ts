/**
 * Token telemetry: measures real before/after token usage by simulating
 * what an AI agent would do with and without boocontext context.
 *
 * Approach: for each standard task (explain architecture, add route, review diff),
 * measure the actual bytes of context that would be consumed.
 *
 * "Without boocontext": count tokens from the files an AI would need to read
 * to discover routes, schema, components, config, etc.
 *
 * "With boocontext": count tokens from the BOOCONTEXT.md output.
 */
import type { ScanResult } from "./types.js";
export interface TelemetryTask {
    name: string;
    description: string;
    /** Files the AI would need to read without boocontext */
    filesRead: string[];
    /** Tool calls the AI would make (glob, grep, read) */
    toolCalls: number;
    /** Tokens consumed reading those files */
    tokensWithout: number;
    /** Tokens consumed from boocontext output */
    tokensWith: number;
    /** Reduction factor */
    reduction: number;
}
export interface TelemetryReport {
    project: string;
    tasks: TelemetryTask[];
    summary: {
        totalTokensWithout: number;
        totalTokensWith: number;
        averageReduction: number;
        totalToolCallsSaved: number;
    };
}
export declare function runTelemetry(root: string, result: ScanResult, outputDir: string): Promise<TelemetryReport>;
