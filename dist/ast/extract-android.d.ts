/**
 * Android / Kotlin extraction.
 * Regex-based — no Kotlin compiler needed.
 *
 * Supports:
 * - Retrofit: @GET/@POST/@PUT/@DELETE on interface methods -> RouteInfo[]
 * - Room: @Entity classes with @PrimaryKey, @ColumnInfo -> SchemaModel[]
 * - Jetpack Compose: @Composable fun Name(params) -> ComponentInfo[]
 * - Navigation: res/navigation/*.xml destinations -> RouteInfo[]
 * - AndroidManifest: activity declarations -> RouteInfo[]
 */
import type { RouteInfo, SchemaModel, ComponentInfo } from "../types.js";
export declare function extractRetrofitRoutes(filePath: string, content: string, tags: string[]): RouteInfo[];
export declare function extractRoomEntities(_filePath: string, content: string): SchemaModel[];
export declare function extractComposeComponents(filePath: string, content: string): ComponentInfo[];
export declare function extractNavigationRoutes(filePath: string, content: string): RouteInfo[];
export declare function extractActivitiesFromManifest(filePath: string, content: string): RouteInfo[];
