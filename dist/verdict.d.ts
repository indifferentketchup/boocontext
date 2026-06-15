export type VerdictGrade = "SAFE" | "CAUTION" | "UNSAFE" | "INFO";
export interface VerdictEnvelope {
    verdict: VerdictGrade;
    summary: string;
    details: any;
    metadata: {
        source: "boocontext" | "tree-sitter-analyzer" | "type-inject" | "merged";
        tool: string;
        duration_ms: number;
        truncated: boolean;
    };
}
export declare function makeVerdict(verdict: VerdictGrade, summary: string, details: any, metadata: Partial<VerdictEnvelope["metadata"]> & {
    tool: string;
}): VerdictEnvelope;
