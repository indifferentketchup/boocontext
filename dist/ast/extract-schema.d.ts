/**
 * AST-based schema extraction for TypeScript/JavaScript ORMs.
 * Provides higher accuracy than regex for:
 * - Drizzle: pgTable/mysqlTable/sqliteTable with field types and chained modifiers
 * - TypeORM: @Entity + @Column/@PrimaryGeneratedColumn decorators
 */
import type { SchemaModel } from "../types.js";
/**
 * Extract Drizzle schema from a file using AST.
 */
export declare function extractDrizzleSchemaAST(ts: any, filePath: string, content: string): SchemaModel[];
/**
 * Extract TypeORM entities from a file using AST.
 */
export declare function extractTypeORMSchemaAST(ts: any, filePath: string, content: string): SchemaModel[];
