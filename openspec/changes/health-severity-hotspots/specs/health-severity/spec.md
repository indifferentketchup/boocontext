## ADDED Requirements

### Requirement: boocontext_severity tool
The server MUST provide a `boocontext_severity` tool that classifies tree-sitter-analyzer health grades using a severity ladder (INFO/MINOR/MAJOR/CRITICAL) and software-quality domains (MAINTAINABILITY/RELIABILITY), combined with git commit frequency for hotspot prioritization. The tool MUST degrade gracefully when git is unavailable. The tool MUST use verdict "INFO" when 0 CRITICAL findings exist and "CAUTION" when 1+ CRITICAL findings exist.

#### Scenario: Project with mixed health grades returns severity classification
When the tool is called with `{ directory: "<project>" }`
Then the response must have verdict "INFO" if 0 CRITICAL files, or "CAUTION" otherwise
And `details.findings` must be an array sorted by hotspot_score descending
And each finding must include `file`, `grade`, `severity`, `domain`, `weakest_dimension`, `health_score`, `commits`, `hotspot_score`

#### Scenario: Healthy file maps to INFO severity with MAINTAINABILITY domain
Given a file with grade A or B
When severity classification runs
Then severity MUST be "INFO"
And domain MUST be "MAINTAINABILITY"

#### Scenario: Critical file maps to CRITICAL severity
Given a file with grade F
When severity classification runs
Then severity MUST be "CRITICAL"
And domain MUST be "MAINTAINABILITY" (complexity-is-weakest+grade≤C rule does not apply: F has rank 4, threshold is rank 3)

#### Scenario: Reliability domain assigned when complexity is weakest and file is unhealthy
Given a file with grade D and complexity as the weakest dimension (lowest score)
When severity classification runs
Then severity MUST be "MAJOR"
And domain MUST be "RELIABILITY" (complexity is weakest AND grade rank is 3+)

#### Scenario: Hotspot ranking prioritizes frequently-changed unhealthy files
Given a D-grade file with 15 commits and an F-grade file with 0 commits
When hotspot score is computed as `(1 - health_score/100) * log(commits + 1)`
Then the D-grade file MUST rank higher than the F-grade file

#### Scenario: Git unavailable degrades gracefully
Given a directory without git
When `boocontext_severity` is called
Then findings MUST be returned sorted by severity (no hotspot score; all hotspot_score = 0)
And `details.git_unavailable` MUST be true
And verdict logic MUST still apply based on severity

### Requirement: Severity ladder types
The codebase SHALL define TypeScript types for the severity ladder and software-quality domains in `src/tools/severity.ts`.

#### Scenario: Severity type is a string union
Given the severity ladder implementation
Then `Severity` type MUST be `"INFO" | "MINOR" | "MAJOR" | "CRITICAL"`
And `Domain` type MUST be `"MAINTAINABILITY" | "RELIABILITY" | "SECURITY"`
And `SeverityFinding` type MUST include `{ file, grade, severity, domain, weakest_dimension, health_score, commits, hotspot_score }`

### Requirement: Grade-to-rank comparison
The domain assignment logic MUST use an explicit grade-to-rank mapping (`{ A: 0, B: 1, C: 2, D: 3, F: 4 }`) rather than string comparison. RELIABILITY domain SHALL only be assigned when the weakest dimension is "complexity" AND the grade rank is >= 3 (D or F).

#### Scenario: Grade rank comparison is rank-based
Given `gradeToRank` mapping
Then `gradeToRank("A")` MUST be 0
And `gradeToRank("F")` MUST be 4
And `gradeToRank("C")` MUST be 2
And domain assignment MUST use rank >= 3 as the RELIABILITY threshold

### Requirement: findWeakestDimension function
The codebase SHALL define a `findWeakestDimension(dimensions) → string` function that returns the dimension name with the lowest numerical score. In case of ties, the first encountered lowest score wins.

#### Scenario: Weakest dimension is the lowest score
Given dimensions `{ size: 92, complexity: 48, structure: 85 }`
When `findWeakestDimension` is called
Then it MUST return "complexity" (score 48 is lowest)

### Requirement: runGitLog returns structured result
The git log parser SHALL return `{ commits: Map<string, number>, gitUnavailable: boolean }` to disambiguate "no git installed" from "empty commit history." It SHALL skip binary file markers (`-\t-\tfile`), commit hash lines, and blank lines.

#### Scenario: Git available with commits
Given a git repository with files changed in recent commits
When `runGitLog` is called
Then it MUST return `gitUnavailable: false`
And `commits` MUST be a Map with per-file commit counts

#### Scenario: Git not installed
Given a system without git in PATH
When `runGitLog` is called
Then it MUST return `gitUnavailable: true`
And `commits` MUST be an empty Map

## MODIFIED Requirements

### Requirement: boocontext_health tool enhanced with severity tags
The existing `boocontext_health` tool MUST continue to return raw tree-sitter-analyzer output in `details.content`. Additionally, when TSA returns parseable JSON output, each file entry in the parsed data MUST gain `severity` and `domain` fields mapped from the file's grade and dimensions.

#### Scenario: Health output includes severity tags when TSA returns structured JSON
When the tool is called with `{ directory: "<project>" }`
And TSA returns JSON with a `files` array containing `grade` and `dimensions`
Then each file in the parsed output MUST include `severity` (INFO/MINOR/MAJOR/CRITICAL) and `domain` (MAINTAINABILITY/RELIABILITY)

#### Scenario: Health output works unchanged when TSA returns plain text
When the tool is called with `{ directory: "<project>" }`
And TSA returns plain text (not JSON)
Then `details.content` MUST still contain the raw TSA text output unchanged
Then no severity or domain fields are added (JSON parse fails silently)
