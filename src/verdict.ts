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

export function makeVerdict(
  verdict: VerdictGrade,
  summary: string,
  details: any,
  metadata: Partial<VerdictEnvelope["metadata"]> & { tool: string },
): VerdictEnvelope {
  return {
    verdict,
    summary,
    details,
    metadata: {
      source: metadata.source ?? "boocontext",
      tool: metadata.tool,
      duration_ms: metadata.duration_ms ?? 0,
      truncated: metadata.truncated ?? false,
    },
  };
}
