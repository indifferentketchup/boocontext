/**
 * BrightScript (.brs) extraction.
 *
 * Regex-based — BrightScript has no official AST parser available as a Node
 * dependency, and real-world .brs code is simple enough for line-oriented
 * regex to achieve good recall. Matches the convention of extract-swift,
 * extract-dart, extract-php, etc.
 *
 * Exposed helpers:
 * - extractBrightScriptFunctions: top-level function/sub declarations
 * - extractBrightScriptObservers: m.top.observeField / m.global.observeField
 * - extractBrightScriptShowScreenCalls: ShowScreen / CloseScreen / GetCurrentScreen
 * - extractBrightScriptGraphqlCalls: makeGraphqlCall / roUrlTransfer site hits
 * - extractBrightScriptGlobalFields: m.global.AddField(...) registrations
 * - extractBrightScriptRudderstackEvents: event names passed to RudderstackTask
 */
import type { ExportItem } from "../types.js";
export interface BrightScriptObserver {
    field: string;
    handler: string;
    scope: "top" | "global" | "other";
    line: number;
}
export interface ShowScreenCall {
    target: string;
    modal: boolean;
    helper: "show" | "close" | "current";
    line: number;
}
export interface GraphqlCallSite {
    url: string;
    /** Line number (1-indexed) of the call-site. */
    line: number;
}
export interface GlobalFieldRegistration {
    name: string;
    type: string;
    line: number;
}
export interface RudderstackEvent {
    name: string;
    line: number;
}
/**
 * Extract top-level function / sub declarations from .brs source.
 *
 * BrightScript syntax is case-insensitive. Declarations we recognize:
 *   function Foo(a, b as string) as object
 *   Function Foo()
 *   sub Bar(x)
 *   Sub Bar()
 *
 * We only match declarations that begin at column 0 to exclude nested
 * inline function expressions (which BrightScript supports inside tables).
 */
export declare function extractBrightScriptFunctions(content: string): ExportItem[];
/**
 * Extract observeField / observeFieldScoped registrations.
 *
 * Patterns recognized:
 *   m.top.observeField("fieldName", "handlerName")
 *   m.global.observeField("fieldName", "handlerName")
 *   someNode.observeField("fieldName", "handlerName")
 *   m.top.observeFieldScoped("fieldName", "handlerName")
 */
export declare function extractBrightScriptObservers(content: string): BrightScriptObserver[];
/**
 * Extract screen-open call-sites for a configurable set of helper names.
 *
 * Roku apps don't have a standard navigation helper — some use `ShowScreen`,
 * others `pushScreen`, `NavigateTo`, `showView`, or project-specific names.
 * This generalized form scans for any `<helperName>(target, [modal?])`
 * call site where the target is a node variable or bare identifier.
 *
 * Returns one entry per call-site. `modal` is true when the second positional
 * argument is the literal `true` (Roku BrightScript has no named args).
 */
export declare function extractBrightScriptNavigationCalls(content: string, helperNames: string[]): ShowScreenCall[];
/**
 * Extract screen-stack navigation call-sites.
 *
 * Matches the FrontRow-style helpers:
 *   ShowScreen(target)
 *   ShowScreen(target, true)
 *   CloseScreen()
 *   GetCurrentScreen()
 *
 * Retained for back-compat; new code should prefer
 * `extractBrightScriptNavigationCalls` which takes a configurable name set.
 */
export declare function extractBrightScriptShowScreenCalls(content: string): ShowScreenCall[];
/**
 * Extract GraphQL + raw HTTP call sites.
 *
 * makeGraphqlCall(url, payload, params) — used across FrontRow Roku code.
 * Also catches bare CreateObject("roUrlTransfer").
 */
export declare function extractBrightScriptGraphqlCalls(content: string): GraphqlCallSite[];
/**
 * Extract m.global.AddField("name", "type", ...) registrations.
 * Used by middleware + config detectors as app-wide declared state.
 */
export declare function extractBrightScriptGlobalFields(content: string): GlobalFieldRegistration[];
/**
 * Heuristic: RudderstackTask event name payloads.
 *
 * Common shapes in FrontRow code:
 *   rudderstackTask.event = { event: "EventName", properties: {...} }
 *   rudderstackTask.callFunc("trackEvent", "EventName", {...})
 */
export declare function extractBrightScriptRudderstackEvents(content: string): RudderstackEvent[];
/**
 * Find `m.xxxView = m.top.findNode("xxxView")` style bindings.
 * Used by routes detector to resolve `ShowScreen(m.xxxView)` back to a node id.
 */
export declare function extractFindNodeBindings(content: string): Record<string, string>;
