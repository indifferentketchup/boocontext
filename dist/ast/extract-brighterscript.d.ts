/**
 * BrighterScript (.bs) extraction.
 *
 * BrighterScript is a superset of BrightScript with added language features:
 *   - class X extends Y
 *   - namespace X.Y
 *   - enum X
 *   - interface X
 *   - import "pkg:/source/path/File.brs"
 *   - try/catch
 *   - optional chaining (?.)
 *
 * This extractor handles only BrighterScript-specific constructs; it composes
 * with extract-brightscript for functions/subs/observers/etc. so .bs files
 * get both layers of detection.
 */
import type { ExportItem } from "../types.js";
/**
 * Extract import targets from `import "pkg:/..."` statements.
 * BrighterScript imports must be at the top of a file, but we scan the whole
 * file for robustness against unusual layouts.
 */
export declare function extractBrighterScriptImports(content: string): string[];
/**
 * Extract BrighterScript-only exports (class, namespace, enum, interface)
 * plus functions/subs via the BrightScript extractor.
 *
 * Access modifiers in BrighterScript are not applied to module-level
 * declarations; every class/namespace/enum/interface is effectively public.
 */
export declare function extractBrighterScriptExports(content: string): ExportItem[];
