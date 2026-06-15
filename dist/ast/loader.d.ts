export declare function loadTypeScript(projectRoot: string): any | null;
export declare function resetCache(): void;
export declare function parseSourceFile(ts: any, fileName: string, content: string): any;
/**
 * Get decorators from a node, handling both TS 4.x (node.decorators)
 * and TS 5.x (node.modifiers with SyntaxKind.Decorator).
 */
export declare function getDecorators(ts: any, node: any): any[];
/**
 * Extract the name and first string argument from a decorator.
 * @returns { name: string, arg: string | null }
 */
export declare function parseDecorator(ts: any, sf: any, decorator: any): {
    name: string;
    arg: string | null;
};
/**
 * Get text from a node safely.
 */
export declare function getText(sf: any, node: any): string;
