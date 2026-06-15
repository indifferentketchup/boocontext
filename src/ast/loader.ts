/**
 * Dynamic TypeScript compiler loader.
 * Loads the TypeScript compiler from the scanned project's node_modules.
 * Zero new dependencies — borrows TS from the project being analyzed.
 * Falls back gracefully when TypeScript is not available.
 */
import { createRequire } from "node:module";
import { readdirSync } from "node:fs";
import { join } from "node:path";

let cached: any = undefined; // undefined = not tried, null = tried and failed
let cachedRoot: string = "";

export function loadTypeScript(projectRoot: string): any | null {
  if (cached !== undefined && cachedRoot === projectRoot) return cached;
  cachedRoot = projectRoot;

  // Strategy 1: createRequire from project root (works for npm/yarn)
  try {
    const req = createRequire(join(projectRoot, "package.json"));
    cached = req("typescript");
    return cached;
  } catch {}

  // Strategy 2: Direct path (works for pnpm with public-hoist-pattern)
  try {
    const directPath = join(projectRoot, "node_modules", "typescript");
    const req = createRequire(join(directPath, "package.json"));
    cached = req(directPath);
    return cached;
  } catch {}

  // Strategy 3: Find in pnpm .pnpm store (strict mode fallback)
  try {
    const pnpmDir = join(projectRoot, "node_modules", ".pnpm");
    const entries = readdirSync(pnpmDir);
    const tsDir = entries.find((e) => e.startsWith("typescript@"));
    if (tsDir) {
      const tsPath = join(pnpmDir, tsDir, "node_modules", "typescript");
      const req = createRequire(join(tsPath, "package.json"));
      cached = req(tsPath);
      return cached;
    }
  } catch {}

  // TypeScript not available — fall back to regex
  cached = null;
  return null;
}

export function resetCache(): void {
  cached = undefined;
}

export function parseSourceFile(ts: any, fileName: string, content: string): any {
  return ts.createSourceFile(
    fileName,
    content,
    ts.ScriptTarget.Latest,
    true // setParentNodes — needed for walking up the tree
  );
}

/**
 * Get decorators from a node, handling both TS 4.x (node.decorators)
 * and TS 5.x (node.modifiers with SyntaxKind.Decorator).
 */
export function getDecorators(ts: any, node: any): any[] {
  if (node.decorators) return Array.from(node.decorators);
  if (node.modifiers) {
    return node.modifiers.filter((m: any) => m.kind === ts.SyntaxKind.Decorator);
  }
  return [];
}

/**
 * Extract the name and first string argument from a decorator.
 * @returns { name: string, arg: string | null }
 */
export function parseDecorator(ts: any, sf: any, decorator: any): { name: string; arg: string | null } {
  const SK = ts.SyntaxKind;
  const expr = decorator.expression;
  if (!expr) return { name: "", arg: null };

  // @Get() or @Get('path') — CallExpression
  if (expr.kind === SK.CallExpression) {
    const callee = expr.expression;
    const name = callee.kind === SK.Identifier ? callee.getText(sf) : "";
    let arg: string | null = null;
    if (expr.arguments?.length > 0) {
      const first = expr.arguments[0];
      if (first.kind === SK.StringLiteral || first.kind === SK.NoSubstitutionTemplateLiteral) {
        arg = first.text;
      }
    }
    return { name, arg };
  }

  // @Controller (without parens) — Identifier
  if (expr.kind === SK.Identifier) {
    return { name: expr.getText(sf), arg: null };
  }

  return { name: "", arg: null };
}

/**
 * Get text from a node safely.
 */
export function getText(sf: any, node: any): string {
  try {
    return node.getText(sf);
  } catch {
    return node.escapedText || node.text || "";
  }
}
