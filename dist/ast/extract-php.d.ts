/**
 * Laravel-specific route and Eloquent ORM extraction.
 * Regex-based — no PHP parser needed.
 *
 * Supports:
 * - routes/api.php + routes/web.php: Route::get(), Route::post(), Route::resource(), Route::apiResource()
 * - Eloquent models: extends Model → $fillable, $casts, relationship methods
 */
import type { RouteInfo, SchemaModel, ExportItem } from "../types.js";
export declare function extractLaravelRoutes(filePath: string, content: string, tags: string[]): RouteInfo[];
export declare function extractEloquentModels(_filePath: string, content: string): SchemaModel[];
export declare function extractPhpExports(content: string): ExportItem[];
