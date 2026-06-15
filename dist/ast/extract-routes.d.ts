/**
 * AST-based route extraction for TypeScript/JavaScript frameworks.
 * Provides higher accuracy than regex for:
 * - Express/Hono/Fastify/Koa/Elysia: method calls with path strings
 * - NestJS: decorator-based routes with controller prefix combining
 * - tRPC: router object with procedure chains and nesting
 */
import type { RouteInfo, Framework } from "../types.js";
/**
 * Try AST-based route extraction for a single file.
 * Returns routes with confidence: 'ast', or empty array if AST cannot handle this file.
 */
export declare function extractRoutesAST(ts: any, filePath: string, content: string, framework: Framework, tags: string[]): RouteInfo[];
