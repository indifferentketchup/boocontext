export function makeVerdict(verdict, summary, details, metadata) {
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
