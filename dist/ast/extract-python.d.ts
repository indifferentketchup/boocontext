/**
 * Python AST extraction via subprocess.
 * Spawns python3 with an inline script using stdlib `ast` module.
 * Zero dependencies — if the project uses Python, the interpreter is there.
 *
 * Extracts:
 * - FastAPI/Flask route decorators with precise path + method
 * - Django urlpatterns with path() calls
 * - SQLAlchemy model classes with Column types, flags, and relationships
 */
import type { RouteInfo, SchemaModel, Framework } from "../types.js";
/**
 * Extract routes from a Python file using AST.
 * Returns routes with confidence: "ast", or null if Python is unavailable.
 */
export declare function extractPythonRoutesAST(filePath: string, content: string, framework: Framework, tags: string[]): Promise<RouteInfo[] | null>;
/**
 * Extract SQLAlchemy models from a Python file using AST.
 * Returns models with confidence: "ast", or null if Python is unavailable.
 */
export declare function extractSQLAlchemyAST(filePath: string, content: string): Promise<SchemaModel[] | null>;
/**
 * Extract Django ORM models from a Python file using AST.
 * Handles models.Model subclasses with CharField, ForeignKey, etc.
 */
export declare function extractDjangoModelsAST(filePath: string, content: string): Promise<SchemaModel[] | null>;
/**
 * Extract SQLModel table models from a Python file using AST.
 * Detects class X(SQLModel, table=True) with typed field annotations.
 */
export declare function extractSQLModelAST(filePath: string, content: string): Promise<SchemaModel[] | null>;
/**
 * Check if Python 3 is available on this system.
 */
export declare function isPythonAvailable(): Promise<boolean>;
