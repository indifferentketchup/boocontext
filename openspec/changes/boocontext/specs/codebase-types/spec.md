## ADDED Requirements

### Requirement: boocontext_types tool
The server MUST provide a `boocontext_types` tool that resolves TypeScript type information (signatures, interfaces, generics) across file boundaries using type-inject. Output MUST be wrapped in a verdict envelope. Backend: type-inject child server (spawned via `node`).

#### Scenario: Type resolution returns signature for known symbol
When the tool is called with `{ file: "src/server.ts", symbol: "getScanResult" }`
Then the response must have `verdict: "INFO"`
And `details` must include `signature` (resolved TypeScript signature string), `file`, `line`, `type_parameters` (if any)

#### Scenario: Type resolution fails gracefully for unknown symbol
When the tool is called with `{ file: "src/server.ts", symbol: "nonExistentSymbol" }`
Then the response must have `verdict: "UNSAFE"`
And `details.error` must describe why resolution failed

### Requirement: boocontext_callgraph tool
The server MUST provide a `boocontext_callgraph` tool that returns callers and/or callees for a given symbol using tree-sitter-analyzer's call graph tools. Output MUST be wrapped in a verdict envelope.

#### Scenario: Callers returned for a function symbol
When the tool is called with `{ symbol: "detectRoutes", direction: "callers", depth: 1 }`
Then the response must have `verdict: "INFO"`
And `details.callers` must be an array of caller entries, each with `caller_symbol`, `file`, `line`

#### Scenario: Callees returned for a function symbol
When the tool is called with `{ symbol: "scan", direction: "callees", depth: 2 }`
Then the response must have `verdict: "INFO"`
And `details.callees` must be an array of callee entries, each with `callee_symbol`, `file`, `line`

### Requirement: boocontext_impact tool
The server MUST provide a `boocontext_impact` tool that analyzes what breaks if you change a symbol or file, merging tree-sitter-analyzer's trace_impact (symbol-level) with codesight's blast_radius (file-level). Output MUST be wrapped in a verdict envelope.

#### Scenario: Symbol-level impact returns affected symbols and files
When the tool is called with `{ symbol: "send", file: "src/mcp-server.ts" }`
Then the response must have `verdict: "CAUTION"` if affected items exist
And `details.affected_symbols` must be an array of downstream symbols
And `details.affected_files` must be an array of impacted files
And `details.depth` must indicate how many hops were traversed

#### Scenario: No impact returns SAFE verdict
When the tool is called with `{ file: "src/standalone.ts" }` (leaf file with no dependents)
Then the response must have `verdict: "SAFE"`
And `details.affected_files` must be empty or contain only the file itself
