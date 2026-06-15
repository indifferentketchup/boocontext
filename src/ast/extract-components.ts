/**
 * AST-based component extraction for React.
 * Provides higher accuracy than regex for:
 * - Component name detection from function/arrow function declarations
 * - Prop extraction from destructured parameters and Props interface/type
 * - Distinguishes client/server components via directive detection
 */
import type { ComponentInfo } from "../types.js";
import { parseSourceFile, getText } from "./loader.js";

/**
 * Extract React components from a file using AST.
 */
export function extractReactComponentsAST(
  ts: any,
  filePath: string,
  content: string,
  relPath: string
): ComponentInfo[] {
  try {
    const sf = parseSourceFile(ts, filePath, content);
    return extractComponents(ts, sf, content, relPath);
  } catch {
    return [];
  }
}

function extractComponents(ts: any, sf: any, content: string, relPath: string): ComponentInfo[] {
  const components: ComponentInfo[] = [];
  const SK = ts.SyntaxKind;

  const isClient = content.slice(0, 80).includes("use client");
  const isServer = content.slice(0, 80).includes("use server");

  // Collect all Props interfaces/types in the file
  const propsTypes = new Map<string, string[]>(); // type name -> prop names

  function collectPropsTypes(node: any) {
    // interface FooProps { ... } or type FooProps = { ... }
    if (node.kind === SK.InterfaceDeclaration || node.kind === SK.TypeAliasDeclaration) {
      const name = node.name ? getText(sf, node.name) : "";
      if (!name.includes("Props") && !name.includes("props")) {
        ts.forEachChild(node, collectPropsTypes);
        return;
      }

      const props: string[] = [];

      // For interfaces: node.members
      if (node.members) {
        for (const member of node.members) {
          if (member.kind === SK.PropertySignature && member.name) {
            const propName = getText(sf, member.name);
            if (propName !== "children") props.push(propName);
          }
        }
      }

      // For type aliases: node.type might be TypeLiteral
      if (node.type?.kind === SK.TypeLiteral && node.type.members) {
        for (const member of node.type.members) {
          if (member.kind === SK.PropertySignature && member.name) {
            const propName = getText(sf, member.name);
            if (propName !== "children") props.push(propName);
          }
        }
      }

      if (props.length > 0) propsTypes.set(name, props);
    }

    ts.forEachChild(node, collectPropsTypes);
  }

  collectPropsTypes(sf);

  // Find exported functions/consts that start with uppercase (components)
  function findComponents(node: any) {
    // export function ComponentName(...) or export default function ComponentName(...)
    if (node.kind === SK.FunctionDeclaration) {
      const name = node.name ? getText(sf, node.name) : "";
      if (!name || !/^[A-Z]/.test(name)) {
        ts.forEachChild(node, findComponents);
        return;
      }

      // Check if exported
      const isExported = node.modifiers?.some(
        (m: any) => m.kind === SK.ExportKeyword || m.kind === SK.DefaultKeyword
      );
      if (!isExported) {
        ts.forEachChild(node, findComponents);
        return;
      }

      const props = extractPropsFromParams(ts, sf, node.parameters, propsTypes);
      components.push({
        name,
        file: relPath,
        props: props.slice(0, 10),
        isClient,
        isServer,
        confidence: "ast",
      });
    }

    // export const ComponentName = (...) => { ... }
    if (node.kind === SK.VariableStatement) {
      const isExported = node.modifiers?.some((m: any) => m.kind === SK.ExportKeyword);
      if (!isExported) {
        ts.forEachChild(node, findComponents);
        return;
      }

      for (const decl of node.declarationList?.declarations || []) {
        if (decl.kind !== SK.VariableDeclaration) continue;
        const name = decl.name ? getText(sf, decl.name) : "";
        if (!name || !/^[A-Z]/.test(name)) continue;

        // Check if the initializer is an arrow function or function expression
        const init = decl.initializer;
        if (!init) continue;

        let params: any[] | null = null;
        if (init.kind === SK.ArrowFunction || init.kind === SK.FunctionExpression) {
          params = init.parameters;
        }
        // React.forwardRef((...) => { ... })
        if (init.kind === SK.CallExpression) {
          const callee = init.expression;
          const calleeName = callee?.kind === SK.PropertyAccessExpression
            ? getText(sf, callee.name)
            : callee?.kind === SK.Identifier ? getText(sf, callee) : "";
          if (calleeName === "forwardRef" || calleeName === "memo") {
            const innerFn = init.arguments?.[0];
            if (innerFn && (innerFn.kind === SK.ArrowFunction || innerFn.kind === SK.FunctionExpression)) {
              params = innerFn.parameters;
            }
          }
        }

        if (params) {
          const props = extractPropsFromParams(ts, sf, params, propsTypes);
          components.push({
            name,
            file: relPath,
            props: props.slice(0, 10),
            isClient,
            isServer,
            confidence: "ast",
          });
        }
      }
    }

    ts.forEachChild(node, findComponents);
  }

  findComponents(sf);
  return components;
}

/**
 * Extract prop names from function parameters.
 * Handles: ({ prop1, prop2 }: Props) and (props: Props)
 */
function extractPropsFromParams(
  ts: any,
  sf: any,
  params: any[],
  propsTypes: Map<string, string[]>
): string[] {
  if (!params || params.length === 0) return [];
  const SK = ts.SyntaxKind;

  const firstParam = params[0];

  // Destructured: ({ prop1, prop2, ...rest }: Props)
  if (firstParam.name?.kind === SK.ObjectBindingPattern) {
    const props: string[] = [];
    for (const element of firstParam.name.elements || []) {
      if (element.dotDotDotToken) continue; // skip ...rest
      const propName = element.name ? getText(sf, element.name) : "";
      if (propName && propName !== "children") props.push(propName);
    }

    // If we got props from destructuring, great
    if (props.length > 0) return props;

    // Fall back to type annotation if destructuring is empty
  }

  // Type annotation: (props: FooProps) or ({ ... }: FooProps)
  if (firstParam.type) {
    // TypeReference: FooProps
    if (firstParam.type.kind === SK.TypeReference) {
      const typeName = firstParam.type.typeName ? getText(sf, firstParam.type.typeName) : "";
      const typeProps = propsTypes.get(typeName);
      if (typeProps) return typeProps;
    }

    // TypeLiteral: { prop1: string; prop2: number }
    if (firstParam.type.kind === SK.TypeLiteral) {
      const props: string[] = [];
      for (const member of firstParam.type.members || []) {
        if (member.kind === SK.PropertySignature && member.name) {
          const propName = getText(sf, member.name);
          if (propName !== "children") props.push(propName);
        }
      }
      return props;
    }
  }

  return [];
}
