import { resolve } from "node:path";
import { detectProject, collectFiles, readBoocontextIgnore } from "./scanner.js";
import { loadConfig } from "./config.js";
import { detectRoutes } from "./detectors/routes.js";
import { detectSchemas } from "./detectors/schema.js";
import { detectComponents } from "./detectors/components.js";
import { detectLibs } from "./detectors/libs.js";
import { detectConfig } from "./detectors/config.js";
import { detectMiddleware } from "./detectors/middleware.js";
import { detectDependencyGraph } from "./detectors/graph.js";
import { enrichRouteContracts } from "./detectors/contracts.js";
import { calculateTokenStats } from "./detectors/tokens.js";
import { detectGraphQLRoutes, detectGRPCRoutes, detectWebSocketRoutes } from "./detectors/graphql.js";
import { detectEvents } from "./detectors/events.js";
import { writeOutput, computeCrudGroups } from "./formatter.js";
import type { ScanResult } from "./types.js";

let cachedResult: ScanResult | null = null;
let cachedRoot: string | null = null;

export async function getScanResult(directory?: string): Promise<ScanResult> {
  const root = resolve(directory || process.cwd());

  if (cachedResult && cachedRoot === root) return cachedResult;

  const project = await detectProject(root);
  const userConfig = await loadConfig(root);
  const ignoreFromFile = await readBoocontextIgnore(root);
  const allIgnore = [...(userConfig.ignorePatterns ?? []), ...ignoreFromFile];
  const files = await collectFiles(root, userConfig.maxDepth ?? 10, allIgnore);

  const [rawHttpRoutes, schemas, components, libs, config, middleware, graph,
         graphqlRoutes, grpcRoutes, wsRoutes, events] = await Promise.all([
    detectRoutes(files, project),
    detectSchemas(files, project),
    detectComponents(files, project),
    detectLibs(files, project),
    detectConfig(files, project),
    detectMiddleware(files, project),
    detectDependencyGraph(files, project),
    detectGraphQLRoutes(files, project),
    detectGRPCRoutes(files, project),
    detectWebSocketRoutes(files, project),
    detectEvents(files, project),
  ]);

  const rawRoutes = [...rawHttpRoutes, ...graphqlRoutes, ...grpcRoutes, ...wsRoutes];
  const routes = await enrichRouteContracts(rawRoutes, project);
  const crudGroups = computeCrudGroups(routes);

  const tempResult: ScanResult = {
    project,
    routes,
    schemas,
    components,
    libs,
    config,
    middleware,
    graph,
    tokenStats: { outputTokens: 0, estimatedExplorationTokens: 0, saved: 0, fileCount: files.length },
    events: events.length > 0 ? events : undefined,
    crudGroups: crudGroups.length > 0 ? crudGroups : undefined,
  };

  const outputContent = await writeOutput(tempResult, resolve(root, ".boocontext"));
  const tokenStats = calculateTokenStats(tempResult, outputContent, files.length);

  cachedResult = { ...tempResult, tokenStats };
  cachedRoot = root;
  return cachedResult;
}

export function clearCache(): void {
  cachedResult = null;
  cachedRoot = null;
}
