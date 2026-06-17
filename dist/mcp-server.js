import { resolve, join } from "node:path";
import { readFile } from "node:fs/promises";
import { analyzeBlastRadius, analyzeMultiFileBlastRadius } from "./detectors/blast-radius.js";
import { writeOutput } from "./formatter.js";
import { readWikiArticle, listWikiArticles, lintWiki } from "./generators/wiki.js";
import { loadConfig } from "./config.js";
import { getScanResult, clearCache } from "./scan-cache.js";
import { VERSION } from "./core.js";
import { ChildServerManager } from "./child-server.js";
import { createOverviewTool } from "./tools/overview.js";
import { createMapTool } from "./tools/map.js";
import { createHealthTool } from "./tools/health.js";
import { createSymbolsTool } from "./tools/symbols.js";
import { createCallgraphTool } from "./tools/callgraph.js";
import { createImpactTool } from "./tools/impact.js";
import { createTypesTool } from "./tools/types.js";
import { createSeverityTool } from "./tools/severity.js";
import { createExploreTool } from "./tools/explore.js";
let transportMode = "framed";
function looksLikeFramedTransport(buffer) {
    return /^Content-Length\s*:/i.test(buffer);
}
function send(msg) {
    const json = JSON.stringify(msg);
    if (transportMode === "newline") {
        process.stdout.write(`${json}\n`);
        return;
    }
    const header = `Content-Length: ${Buffer.byteLength(json)}\r\n\r\n`;
    process.stdout.write(header + json);
}
export const childManager = new ChildServerManager();
// =================== TOOL IMPLEMENTATIONS ===================
async function toolScan(args) {
    const dir = args.directory ? resolve(args.directory) : process.cwd();
    const result = await getScanResult(args.directory);
    const outputContent = await writeOutput(result, resolve(dir, ".boocontext"));
    return outputContent.replace(/Saves ~\d[\d,]* tokens/, `Saves ~${result.tokenStats.saved.toLocaleString()} tokens`);
}
async function toolGetRoutes(args) {
    const result = await getScanResult(args.directory);
    let routes = result.routes;
    // Filter by prefix
    if (args.prefix) {
        routes = routes.filter((r) => r.path.startsWith(args.prefix));
    }
    // Filter by tag
    if (args.tag) {
        routes = routes.filter((r) => r.tags.includes(args.tag));
    }
    // Filter by method
    if (args.method) {
        routes = routes.filter((r) => r.method === args.method.toUpperCase());
    }
    const lines = routes.map((r) => {
        const tags = r.tags.length > 0 ? ` [${r.tags.join(", ")}]` : "";
        const params = r.params ? ` params(${r.params.join(", ")})` : "";
        return `${r.method} ${r.path}${params}${tags} — ${r.file}`;
    });
    return lines.length > 0 ? `${lines.length} routes:\n${lines.join("\n")}` : "No routes found matching filters.";
}
async function toolGetSchema(args) {
    const result = await getScanResult(args.directory);
    let models = result.schemas;
    if (args.model) {
        models = models.filter((m) => m.name.toLowerCase().includes(args.model.toLowerCase()));
    }
    const lines = [];
    for (const model of models) {
        lines.push(`### ${model.name} (${model.orm})`);
        for (const field of model.fields) {
            const flags = field.flags.length > 0 ? ` (${field.flags.join(", ")})` : "";
            lines.push(`  ${field.name}: ${field.type}${flags}`);
        }
        if (model.relations.length > 0) {
            lines.push(`  relations: ${model.relations.join(", ")}`);
        }
        lines.push("");
    }
    return lines.length > 0 ? `${models.length} models:\n${lines.join("\n")}` : "No models found.";
}
async function toolGetBlastRadius(args) {
    const result = await getScanResult(args.directory);
    const maxDepth = args.depth || 3;
    let br;
    if (args.files && Array.isArray(args.files)) {
        br = analyzeMultiFileBlastRadius(args.files, result, maxDepth);
    }
    else if (args.file) {
        br = analyzeBlastRadius(args.file, result, maxDepth);
    }
    else {
        return "Error: provide 'file' (string) or 'files' (array) parameter.";
    }
    const lines = [];
    lines.push(`## Blast Radius for ${br.file}`);
    lines.push(`Depth: ${br.depth} hops\n`);
    if (br.affectedFiles.length > 0) {
        lines.push(`### Affected Files (${br.affectedFiles.length})`);
        for (const f of br.affectedFiles.slice(0, 30)) {
            lines.push(`- ${f}`);
        }
        if (br.affectedFiles.length > 30) {
            lines.push(`- ... +${br.affectedFiles.length - 30} more`);
        }
        lines.push("");
    }
    if (br.affectedRoutes.length > 0) {
        lines.push(`### Affected Routes (${br.affectedRoutes.length})`);
        for (const r of br.affectedRoutes) {
            lines.push(`- ${r.method} ${r.path} — ${r.file}`);
        }
        lines.push("");
    }
    if (br.affectedModels.length > 0) {
        lines.push(`### Potentially Affected Models (${br.affectedModels.length})`);
        for (const m of br.affectedModels) {
            lines.push(`- ${m}`);
        }
        lines.push("");
    }
    if (br.affectedMiddleware.length > 0) {
        lines.push(`### Affected Middleware (${br.affectedMiddleware.length})`);
        for (const m of br.affectedMiddleware) {
            lines.push(`- ${m}`);
        }
        lines.push("");
    }
    if (br.affectedFiles.length === 0 && br.affectedRoutes.length === 0) {
        lines.push("No downstream dependencies found. This file change has minimal blast radius.");
    }
    return lines.join("\n");
}
async function toolGetEnv(args) {
    const result = await getScanResult(args.directory);
    const envVars = result.config.envVars;
    if (args.required_only) {
        const required = envVars.filter((e) => !e.hasDefault);
        const lines = required.map((e) => `${e.name} **required** — ${e.source}`);
        return `${required.length} required env vars (no defaults):\n${lines.join("\n")}`;
    }
    const lines = envVars.map((e) => {
        const status = e.hasDefault ? "(has default)" : "**required**";
        return `${e.name} ${status} — ${e.source}`;
    });
    return `${envVars.length} env vars:\n${lines.join("\n")}`;
}
async function toolGetHotFiles(args) {
    const result = await getScanResult(args.directory);
    const limit = args.limit || 15;
    const hotFiles = result.graph.hotFiles.slice(0, limit);
    if (hotFiles.length === 0)
        return "No import graph data. Run a full scan first.";
    const lines = hotFiles.map((h) => `${h.file} — imported by ${h.importedBy} files`);
    return `Top ${hotFiles.length} most-imported files (change carefully):\n${lines.join("\n")}`;
}
async function toolGetSummary(args) {
    const result = await getScanResult(args.directory);
    const { project, routes, schemas, components, config, middleware, graph, tokenStats } = result;
    const fw = project.frameworks.join(", ") || "generic";
    const orm = project.orms.join(", ") || "none";
    const lines = [];
    lines.push(`# ${project.name}`);
    lines.push(`Stack: ${fw} | ${orm} | ${project.componentFramework} | ${project.language}`);
    if (project.isMonorepo) {
        const repoLabel = project.repoType === "meta" ? "Meta-repo"
            : project.repoType === "microservices" ? "Microservices"
                : "Monorepo";
        lines.push(`${repoLabel}: ${project.workspaces.map((w) => w.name).join(", ")}`);
    }
    lines.push("");
    lines.push(`${routes.length} routes | ${schemas.length} models | ${components.length} components | ${config.envVars.length} env vars | ${middleware.length} middleware | ${graph.edges.length} import links`);
    lines.push(`Token savings: ~${tokenStats.saved.toLocaleString()} per conversation`);
    lines.push("");
    // Top routes summary
    if (routes.length > 0) {
        lines.push(`Key API areas: ${[...new Set(routes.map((r) => r.path.split("/").slice(0, 3).join("/")))].slice(0, 8).join(", ")}`);
    }
    // Hot files
    if (graph.hotFiles.length > 0) {
        lines.push(`High-impact files: ${graph.hotFiles
            .slice(0, 5)
            .map((h) => h.file)
            .join(", ")}`);
    }
    // Required env
    const required = config.envVars.filter((e) => !e.hasDefault);
    if (required.length > 0) {
        lines.push(`Required env: ${required
            .slice(0, 8)
            .map((e) => e.name)
            .join(", ")}${required.length > 8 ? ` +${required.length - 8} more` : ""}`);
    }
    lines.push("");
    lines.push("Use boocontext_get with section=routes, schema, or blast_radius for details.");
    return lines.join("\n");
}
async function toolRefresh(args) {
    clearCache();
    const result = await getScanResult(args.directory);
    return `Refreshed. ${result.routes.length} routes, ${result.schemas.length} models, ${result.graph.edges.length} import links, ${result.config.envVars.length} env vars.`;
}
async function toolGetWikiIndex(args) {
    const result = await getScanResult(args.directory);
    const outputDir = join(result.project.root, ".boocontext");
    const index = await readWikiArticle(outputDir, "index");
    if (index)
        return index;
    // Wiki not generated yet — return a summary pointing to --wiki
    return `Wiki not generated yet. Run \`npx boocontext --wiki\` to generate the knowledge base.\n\nFor now, use boocontext_get with section=summary for a quick overview.\n\nProject: ${result.project.name} | ${result.routes.length} routes | ${result.schemas.length} models`;
}
async function toolGetWikiArticle(args) {
    if (!args.article)
        return "Error: provide 'article' parameter (e.g., 'overview', 'auth', 'database', 'payments')";
    const result = await getScanResult(args.directory);
    const outputDir = join(result.project.root, ".boocontext");
    const content = await readWikiArticle(outputDir, args.article);
    if (content)
        return content;
    // Article not found — list available ones
    const available = await listWikiArticles(outputDir);
    if (available.length === 0) {
        return `Wiki not generated. Run \`npx boocontext --wiki\` first.\nAvailable articles will include: overview, database, auth, payments, and one per API domain.`;
    }
    return `Article '${args.article}' not found.\nAvailable articles: ${available.join(", ")}`;
}
async function toolLintWiki(args) {
    const result = await getScanResult(args.directory);
    const outputDir = join(result.project.root, ".boocontext");
    return lintWiki(result, outputDir);
}
async function toolGetEvents(args) {
    const result = await getScanResult(args.directory);
    const events = result.events;
    if (!events || events.length === 0) {
        return "No async events or queues detected. Events are auto-detected from BullMQ, Celery, Kafka, Redis pub/sub, Socket.io, and EventEmitter usage.";
    }
    let filtered = events;
    if (args.system) {
        filtered = events.filter((e) => e.system === args.system);
        if (filtered.length === 0)
            return `No events found for system: ${args.system}`;
    }
    const lines = [`Events & Queues (${filtered.length} total)`, ""];
    const bySystem = new Map();
    for (const e of filtered) {
        if (!bySystem.has(e.system))
            bySystem.set(e.system, []);
        bySystem.get(e.system).push(e);
    }
    for (const [system, items] of bySystem) {
        lines.push(`## ${system}`);
        for (const item of items) {
            lines.push(`- ${item.name} [${item.type}] — ${item.file}`);
        }
        lines.push("");
    }
    return lines.join("\n");
}
async function toolGetCoverage(args) {
    const result = await getScanResult(args.directory);
    const cov = result.testCoverage;
    if (!cov || cov.testFiles.length === 0) {
        return "No test files detected. Add test files matching *.test.ts, *.spec.ts, test_*.py, *_test.go, etc.";
    }
    const httpRoutes = result.routes.filter((r) => !["QUERY", "MUTATION", "SUBSCRIPTION", "RPC", "WS", "WS-ROOM"].includes(r.method));
    const uncoveredRoutes = httpRoutes.filter((r) => !cov.testedRoutes.includes(`${r.method}:${r.path}`));
    const uncoveredModels = result.schemas
        .filter((m) => !m.name.startsWith("enum:") && !cov.testedModels.includes(m.name));
    const lines = [
        `Test Coverage: ${cov.coveragePercent}%`,
        `Test files: ${cov.testFiles.length}`,
        `Covered routes: ${cov.testedRoutes.length}/${httpRoutes.length}`,
        `Covered models: ${cov.testedModels.length}/${result.schemas.filter((m) => !m.name.startsWith("enum:")).length}`,
        "",
    ];
    if (uncoveredRoutes.length > 0) {
        lines.push(`Uncovered routes (${uncoveredRoutes.length}):`);
        for (const r of uncoveredRoutes.slice(0, 20)) {
            lines.push(`  ${r.method} ${r.path} — ${r.file}`);
        }
        if (uncoveredRoutes.length > 20)
            lines.push(`  ... +${uncoveredRoutes.length - 20} more`);
        lines.push("");
    }
    if (uncoveredModels.length > 0) {
        lines.push(`Uncovered models: ${uncoveredModels.map((m) => m.name).join(", ")}`);
    }
    return lines.join("\n");
}
async function toolGetKnowledge(args) {
    const dir = args.directory ? resolve(args.directory) : process.cwd();
    const config = await loadConfig(dir);
    const outputDirName = config.outputDir ?? ".boocontext";
    const knowledgePath = join(dir, outputDirName, "KNOWLEDGE.md");
    try {
        return await readFile(knowledgePath, "utf8");
    }
    catch {
        return `Knowledge map not found. Run \`npx boocontext --mode knowledge\` in ${dir} to generate it.\n\nThis scans all .md/.mdx files and extracts decisions, open questions, people, and recurring themes into a compact AI context file.`;
    }
}
// =================== TOOL DEFINITIONS ===================
const GETTER_SECTIONS = {
    summary: toolGetSummary,
    routes: toolGetRoutes,
    schema: toolGetSchema,
    env: toolGetEnv,
    hot_files: toolGetHotFiles,
    events: toolGetEvents,
    coverage: toolGetCoverage,
    blast_radius: toolGetBlastRadius,
    wiki_index: toolGetWikiIndex,
    wiki_article: toolGetWikiArticle,
    wiki_lint: toolLintWiki,
    knowledge: toolGetKnowledge,
};
const GETTER_SECTION_NAMES = Object.keys(GETTER_SECTIONS);
// Legacy getter tools stay callable via tools/call but are hidden from tools/list,
// shrinking the advertised surface while keeping existing integrations working.
const HIDDEN_FROM_LIST = new Set(GETTER_SECTION_NAMES.map((s) => `boocontext_${s === "wiki_lint" ? "lint_wiki" : `get_${s}`}`));
async function toolGet(args) {
    const section = args?.section;
    const fn = section ? GETTER_SECTIONS[section] : undefined;
    if (!fn) {
        return `Unknown section '${section ?? ""}'. Valid sections: ${GETTER_SECTION_NAMES.join(", ")}.`;
    }
    return fn(args);
}
const TOOLS = [
    {
        name: "boocontext_scan",
        description: "Full codebase scan. Returns complete AI context map with routes, schema, components, libraries, config, middleware, and dependency graph. Use this for initial project understanding.",
        inputSchema: {
            type: "object",
            properties: {
                directory: { type: "string", description: "Directory to scan (defaults to cwd)" },
            },
        },
        handler: toolScan,
    },
    {
        name: "boocontext_get",
        description: "Retrieve any precompiled context slice in one call. Pick a `section`: summary (project overview, start here) | routes (API endpoints, filter by prefix/tag/method) | schema (DB models, filter by model) | env (environment vars) | hot_files (most-imported files) | events (queues/topics/pub-sub) | coverage (test coverage) | blast_radius (impact of changing a file, needs file/files) | wiki_index | wiki_article (needs article) | wiki_lint | knowledge. Replaces the individual boocontext_get_* tools.",
        inputSchema: {
            type: "object",
            properties: {
                section: {
                    type: "string",
                    enum: GETTER_SECTION_NAMES,
                    description: "Which context slice to retrieve",
                },
                directory: { type: "string", description: "Directory (defaults to cwd)" },
                prefix: { type: "string", description: "routes: filter by path prefix (e.g. '/api/users')" },
                tag: { type: "string", description: "routes: filter by tag (e.g. 'auth', 'payment')" },
                method: { type: "string", description: "routes: filter by HTTP method" },
                model: { type: "string", description: "schema: filter by model name (partial match)" },
                required_only: { type: "boolean", description: "env: only vars without defaults" },
                limit: { type: "number", description: "hot_files: number of files (default 15)" },
                system: { type: "string", description: "events: filter by system (bullmq|kafka|celery|...)" },
                file: { type: "string", description: "blast_radius: single file path" },
                files: { type: "array", items: { type: "string" }, description: "blast_radius: multiple file paths" },
                depth: { type: "number", description: "blast_radius: max traversal depth (default 3)" },
                article: { type: "string", description: "wiki_article: article name without .md (e.g. 'auth')" },
            },
            required: ["section"],
        },
        handler: toolGet,
    },
    {
        name: "boocontext_get_summary",
        description: "Compact project summary (~500 tokens). Stack, key stats, high-impact files, required env vars. Use this first before diving deeper.",
        inputSchema: {
            type: "object",
            properties: {
                directory: { type: "string", description: "Directory (defaults to cwd)" },
            },
        },
        handler: toolGetSummary,
    },
    {
        name: "boocontext_get_routes",
        description: "Get API routes with methods, paths, params, tags, and handler files. Supports filtering by prefix, tag, or HTTP method.",
        inputSchema: {
            type: "object",
            properties: {
                directory: { type: "string", description: "Directory (defaults to cwd)" },
                prefix: { type: "string", description: "Filter routes by path prefix (e.g., '/api/users')" },
                tag: { type: "string", description: "Filter routes by tag (e.g., 'auth', 'db', 'payment', 'ai')" },
                method: { type: "string", description: "Filter by HTTP method (e.g., 'GET', 'POST')" },
            },
        },
        handler: toolGetRoutes,
    },
    {
        name: "boocontext_get_schema",
        description: "Get database models with fields, types, constraints, and relations. Optionally filter by model name.",
        inputSchema: {
            type: "object",
            properties: {
                directory: { type: "string", description: "Directory (defaults to cwd)" },
                model: { type: "string", description: "Filter by model name (partial match)" },
            },
        },
        handler: toolGetSchema,
    },
    {
        name: "boocontext_get_blast_radius",
        description: "Blast radius analysis. Given a file (or list of files), returns all transitively affected files, routes, models, and middleware. Use before making changes to understand impact.",
        inputSchema: {
            type: "object",
            properties: {
                directory: { type: "string", description: "Directory (defaults to cwd)" },
                file: { type: "string", description: "Single file path (relative to project root)" },
                files: {
                    type: "array",
                    items: { type: "string" },
                    description: "Multiple file paths for combined blast radius",
                },
                depth: { type: "number", description: "Max traversal depth (default: 3)" },
            },
        },
        handler: toolGetBlastRadius,
    },
    {
        name: "boocontext_get_env",
        description: "Get environment variables across the codebase with required/default status and source file.",
        inputSchema: {
            type: "object",
            properties: {
                directory: { type: "string", description: "Directory (defaults to cwd)" },
                required_only: { type: "boolean", description: "Only show required vars (no defaults)" },
            },
        },
        handler: toolGetEnv,
    },
    {
        name: "boocontext_get_hot_files",
        description: "Get the most-imported files in the project. These have the highest blast radius — changes here affect the most other files.",
        inputSchema: {
            type: "object",
            properties: {
                directory: { type: "string", description: "Directory (defaults to cwd)" },
                limit: { type: "number", description: "Number of files to return (default: 15)" },
            },
        },
        handler: toolGetHotFiles,
    },
    {
        name: "boocontext_refresh",
        description: "Force re-scan the project. Use after making significant changes to get updated context.",
        inputSchema: {
            type: "object",
            properties: {
                directory: { type: "string", description: "Directory (defaults to cwd)" },
            },
        },
        handler: toolRefresh,
    },
    {
        name: "boocontext_get_wiki_index",
        description: "Get the wiki index (~200 tokens). Lists all available wiki articles with one-line summaries. Read this at session start for instant project orientation. If wiki not generated, run `npx boocontext --wiki` first.",
        inputSchema: {
            type: "object",
            properties: {
                directory: { type: "string", description: "Directory (defaults to cwd)" },
            },
        },
        handler: toolGetWikiIndex,
    },
    {
        name: "boocontext_get_wiki_article",
        description: "Read a specific wiki article by name. Each article covers one subsystem in narrative form (~300-500 tokens). Use for targeted questions: 'how does auth work?' → article='auth', 'what models exist?' → article='database', 'what routes are there?' → article='api'. Much cheaper than loading the full context map.",
        inputSchema: {
            type: "object",
            properties: {
                directory: { type: "string", description: "Directory (defaults to cwd)" },
                article: {
                    type: "string",
                    description: "Article name without .md extension (e.g. 'overview', 'auth', 'payments', 'database', 'ui', or any domain name)",
                },
            },
            required: ["article"],
        },
        handler: toolGetWikiArticle,
    },
    {
        name: "boocontext_lint_wiki",
        description: "Health check the wiki. Finds orphan articles, missing cross-links, and articles that may be stale. Run after making significant changes to verify wiki integrity.",
        inputSchema: {
            type: "object",
            properties: {
                directory: { type: "string", description: "Directory (defaults to cwd)" },
            },
        },
        handler: toolLintWiki,
    },
    {
        name: "boocontext_get_events",
        description: "Get event queues, Kafka topics, Redis pub/sub channels, and EventEmitter events detected in the project. Useful for understanding async data flows.",
        inputSchema: {
            type: "object",
            properties: {
                directory: { type: "string", description: "Directory (defaults to cwd)" },
                system: { type: "string", description: "Filter by system: bullmq | celery | kafka | redis-pub-sub | socket.io | eventemitter" },
            },
        },
        handler: toolGetEvents,
    },
    {
        name: "boocontext_get_coverage",
        description: "Get test coverage summary: which routes and models have corresponding tests. Shows coverage percentage and lists uncovered endpoints.",
        inputSchema: {
            type: "object",
            properties: {
                directory: { type: "string", description: "Directory (defaults to cwd)" },
            },
        },
        handler: toolGetCoverage,
    },
    {
        name: "boocontext_get_knowledge",
        description: "Get the knowledge map for a second-brain or docs folder: decisions made, open questions, recurring themes, people mentioned, and an index of all notes by type (ADR, meeting, retro, spec, etc.). Run `npx boocontext --mode knowledge` first to generate it.",
        inputSchema: {
            type: "object",
            properties: {
                directory: { type: "string", description: "Directory (defaults to cwd)" },
            },
        },
        handler: toolGetKnowledge,
    },
];
const boocontextTools = [
    createOverviewTool(),
    createMapTool(),
    createHealthTool(childManager),
    createSymbolsTool(childManager),
    createCallgraphTool(childManager),
    createImpactTool(childManager),
    createTypesTool(childManager),
    createSeverityTool(childManager),
    createExploreTool(childManager),
];
for (const tool of boocontextTools) {
    TOOLS.push(tool);
}
const TOOL_CALL_TIMEOUT_MS = 60_000;
// =================== MCP PROTOCOL ===================
async function handleRequest(req) {
    if (req.method === "initialize") {
        send({
            jsonrpc: "2.0",
            id: req.id ?? null,
            result: {
                protocolVersion: "2024-11-05",
                capabilities: { tools: {} },
                serverInfo: { name: "boocontext", version: VERSION },
            },
        });
        return;
    }
    if (req.method === "notifications/initialized") {
        return;
    }
    if (req.method === "tools/list") {
        send({
            jsonrpc: "2.0",
            id: req.id ?? null,
            result: {
                tools: TOOLS.filter((t) => !HIDDEN_FROM_LIST.has(t.name)).map(({ name, description, inputSchema }) => ({
                    name,
                    description,
                    inputSchema,
                })),
            },
        });
        return;
    }
    if (req.method === "tools/call") {
        const toolName = req.params?.name;
        const args = req.params?.arguments || {};
        const tool = TOOLS.find((t) => t.name === toolName);
        if (tool) {
            try {
                const result = await Promise.race([
                    tool.handler(args),
                    new Promise((_, reject) => setTimeout(() => reject(new Error(`Tool ${toolName} timed out after ${TOOL_CALL_TIMEOUT_MS}ms`)), TOOL_CALL_TIMEOUT_MS)),
                ]);
                const text = typeof result === "string" ? result : JSON.stringify(result);
                send({
                    jsonrpc: "2.0",
                    id: req.id ?? null,
                    result: {
                        content: [{ type: "text", text }],
                    },
                });
            }
            catch (err) {
                send({
                    jsonrpc: "2.0",
                    id: req.id ?? null,
                    result: {
                        content: [{ type: "text", text: `Error: ${err.message}` }],
                        isError: true,
                    },
                });
            }
            return;
        }
        send({
            jsonrpc: "2.0",
            id: req.id ?? null,
            error: { code: -32601, message: `Unknown tool: ${toolName}` },
        });
        return;
    }
    if (req.id !== undefined) {
        send({
            jsonrpc: "2.0",
            id: req.id,
            error: { code: -32601, message: `Method not found: ${req.method}` },
        });
    }
}
export async function startMCPServer() {
    transportMode = "framed";
    process.on("SIGTERM", async () => {
        await childManager.shutdown();
        process.exit(0);
    });
    process.on("SIGINT", async () => {
        await childManager.shutdown();
        process.exit(0);
    });
    let buffer = "";
    const messageQueue = [];
    let processing = false;
    function enqueueRawJson(raw) {
        const trimmed = raw.trim();
        if (!trimmed)
            return;
        try {
            const req = JSON.parse(trimmed);
            messageQueue.push(req);
        }
        catch {
            send({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } });
        }
    }
    async function processQueue() {
        if (processing)
            return;
        processing = true;
        while (messageQueue.length > 0) {
            const req = messageQueue.shift();
            try {
                await handleRequest(req);
            }
            catch {
                send({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } });
            }
        }
        processing = false;
    }
    process.stdin.setEncoding("utf-8");
    process.stdin.on("data", (chunk) => {
        buffer += chunk;
        while (true) {
            const headerEnd = buffer.indexOf("\r\n\r\n");
            if (headerEnd === -1) {
                if (looksLikeFramedTransport(buffer))
                    break;
                const newlineIndex = buffer.indexOf("\n");
                if (newlineIndex === -1)
                    break;
                const line = buffer.substring(0, newlineIndex);
                buffer = buffer.substring(newlineIndex + 1);
                transportMode = "newline";
                enqueueRawJson(line);
                continue;
            }
            transportMode = "framed";
            const header = buffer.substring(0, headerEnd);
            const lengthMatch = header.match(/Content-Length:\s*(\d+)/i);
            if (!lengthMatch) {
                buffer = buffer.substring(headerEnd + 4);
                continue;
            }
            const contentLength = parseInt(lengthMatch[1], 10);
            const bodyStart = headerEnd + 4;
            if (buffer.length < bodyStart + contentLength)
                break;
            const body = buffer.substring(bodyStart, bodyStart + contentLength);
            buffer = buffer.substring(bodyStart + contentLength);
            try {
                const req = JSON.parse(body);
                messageQueue.push(req);
            }
            catch {
                send({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } });
            }
        }
        processQueue();
    });
    process.stdin.on("end", () => {
        if (buffer.trim()) {
            enqueueRawJson(buffer);
            buffer = "";
            processQueue();
        }
    });
    await new Promise(() => { });
}
