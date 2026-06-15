/**
 * Purpose-built YAML parser for CI/CD config files (GitHub Actions, CircleCI).
 *
 * Handles the subset of YAML used in CI configs:
 * - Block mappings (nested to ~7 levels)
 * - Block sequences of scalars and of mappings (steps, jobs)
 * - Mixed scalar/mapping sequences (CircleCI workflow jobs)
 * - Literal block scalars (|) for multi-line shell commands
 * - Flow sequences [a, b, c]
 * - Plain, single-quoted, double-quoted scalars
 * - Comments (full-line and inline)
 * - ${{ }} and << >> expressions as opaque strings
 *
 * Does NOT handle: anchors/aliases, tags, flow mappings {}, merge keys, multi-document.
 */
export declare function parseYAML(text: string): any;
export declare function parseFlowSequence(s: string): any[];
