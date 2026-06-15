## ADDED Requirements

### Requirement: boocontext_overview tool
The server MUST provide a `boocontext_overview` tool that returns a structured project overview including detected frameworks, routes, data schemas, components, entry points, and dependency graph. Output MUST be wrapped in a verdict envelope (`SAFE`/`CAUTION`/`UNSAFE`/`INFO`) with summary, details, and metadata fields. Backend: codesight scanner (in-process).

#### Scenario: Successful scan returns overview with frameworks and routes
Given a project root with known framework files (e.g., `package.json` with React, `next.config.js`)
When the tool is called with `{ directory: "<project>" }`
Then the response must have `verdict: "SAFE"`
And `details` must include `project` (type, framework, language), `routes` (array), `schemas` (array), `components` (array)

#### Scenario: Scan fails for non-existent directory
When the tool is called with `{ directory: "/nonexistent" }`
Then the response must have `verdict: "UNSAFE"`
And `details.error` must describe what went wrong

### Requirement: boocontext_map tool
The server MUST provide a `boocontext_map` tool that returns the full codesight context map output (formatted markdown with project overview, routes, schemas, etc.) and optionally compresses it via DCP when the payload exceeds a configurable threshold (default 50k characters). Output MUST be wrapped in a verdict envelope.

#### Scenario: Map returns formatted context with token savings
When the tool is called with `{ directory: "<project>" }`
Then the response must have `verdict: "SAFE"`
And `details` must contain the full context map text
And `metadata` must indicate token savings

#### Scenario: Map compression triggered for large projects
When the tool is called with `{ directory: "<large-project>", compress: true }`
And the output exceeds the compression threshold
Then the response must have `metadata.truncated: true`
And `details` must include a `decompression_hint` field
