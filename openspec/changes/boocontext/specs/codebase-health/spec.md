## ADDED Requirements

### Requirement: boocontext_health tool
The server MUST provide a `boocontext_health` tool that returns A–F code health grades for a project or a specific file, aggregated from tree-sitter-analyzer's project and file health tools. Output MUST be wrapped in a verdict envelope. Backend: tree-sitter-analyzer child server (spawned via `uvx`).

#### Scenario: Project-level health returns aggregate A–F grade
When the tool is called with `{ directory: "<project>" }`
Then the response must have `verdict: "INFO"` if all files grade C or above
Or `verdict: "CAUTION"` if any files grade D or F
And `details` must include `overall_grade` (A–F), `file_count`, `grade_distribution` (count per grade), `hotspots` (top 10 lowest-scoring files)

#### Scenario: Per-file health returns grade with smell breakdown
When the tool is called with `{ directory: "<project>", file: "src/module.ts" }`
Then the response must include `details.overall_grade` for that file
And `details.smells` must be an array of findings with `type`, `severity`, `location`

#### Scenario: Health call spawns TSA child server on first use
When no TSA child server has been started yet in this session
And `boocontext_health` is called
Then a TSA child process must be spawned via `uvx`
And the tool must complete successfully within 30 seconds (including spawn time)

### Requirement: boocontext_symbols tool
The server MUST provide a `boocontext_symbols` tool that performs BM25-ranked symbol search using tree-sitter-analyzer's search capabilities. Output MUST be wrapped in a verdict envelope.

#### Scenario: Symbol search returns ranked results
When the tool is called with `{ query: "MCP", directory: "<project>" }`
Then the response must have `verdict: "INFO"`
And `details.results` must be an array of matches ranked by relevance, each with `symbol`, `file`, `line`, `context`

#### Scenario: No matches returns empty results
When the tool is called with `{ query: "zzzznotfound", directory: "<project>" }`
Then the response must have `verdict: "INFO"`
And `details.results` must be an empty array
And `summary` must indicate zero matches
