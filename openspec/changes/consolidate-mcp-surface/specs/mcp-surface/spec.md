## ADDED Requirements

### Requirement: Consolidated context-retrieval tool
The server SHALL expose a single `boocontext_get` tool that retrieves any scan-derived context slice selected by a `section` parameter.

#### Scenario: Retrieve a section
- **WHEN** `boocontext_get` is called with `section: "routes"` and optional filters
- **THEN** it returns the same output as the legacy `boocontext_get_routes` for those filters

#### Scenario: Unknown section
- **WHEN** `boocontext_get` is called with a `section` not in the valid set
- **THEN** it returns an error string listing the valid section names

### Requirement: Reduced advertised surface
The `tools/list` response SHALL NOT include the 12 legacy getter tools, reducing the advertised count to 12.

#### Scenario: List excludes getters
- **WHEN** a client requests `tools/list`
- **THEN** no tool named `boocontext_get_*` or `boocontext_lint_wiki` appears, and `boocontext_get` does appear

### Requirement: Backward-compatible getter aliases
Legacy getter tool names SHALL remain callable via `tools/call` even though they are unlisted.

#### Scenario: Legacy name still works
- **WHEN** `tools/call` is invoked with name `boocontext_get_routes`
- **THEN** the response is byte-identical to `boocontext_get` with `section: "routes"` and the same filters

### Requirement: Unchanged analysis verbs
The verdict-envelope tools and `scan`, `refresh`, `severity`, `explore` SHALL remain listed and unchanged.

#### Scenario: Verdict tools intact
- **WHEN** `tools/list` is requested
- **THEN** `overview`, `map`, `health`, `symbols`, `callgraph`, `impact`, `types` are all still present
