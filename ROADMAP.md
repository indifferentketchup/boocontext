# Roadmap

## Self-contained code intelligence (lift TSA natively)

Today the deep tools (`symbols`, `callgraph`, `impact`, `health`, `severity`, `types`) shell out to external child MCP servers: `tree-sitter-analyzer` via `uvx` (Python) and `type-inject` via `npx`. The `@modelcontextprotocol/sdk` dependency (and its ~91 transitive packages) exists *only* to be a client to those child servers.

The goal: reimplement those analyses natively on the TypeScript compiler API (which boocontext already loads from the host project in `ast/loader.ts`), so the deep tools need no Python, no child process, and no SDK. This matches boocontext's existing model: TypeScript gets full AST precision, other languages fall back to the scan/regex layer.

Incremental plan (each step ships independently):

1. **Native symbol search**: BM25 over already-extracted symbols. Cheap, high value, removes the most-used deep tool's dependency on TSA.
2. **Native health grades**: complexity metrics on the TS AST.
3. **Native type inference**: replace `type-inject` using the TS compiler.
4. **Native call graph + impact**: caller/callee resolution via the TS compiler (the hard part).
5. **Delete the SDK + `uvx` requirement** once no child-server consumer remains. Only then is "zero dependencies, self-contained, one npx call" literally true.

Deep-tool coverage for non-TypeScript languages narrows to the scan layer they already use. Multi-language deep analysis via bundled `web-tree-sitter` WASM grammars was considered and rejected: it trades a Python process for megabytes of bundled grammars, against the goal of a lean install.

## Smaller follow-ups

- Lazy-load the MCP SDK so pure-CLI/scan users do not pay for child-server machinery they never invoke.
- Container image: add `uv` to the Docker image so the deep tools work in-container (currently inert; core scan tools work).
