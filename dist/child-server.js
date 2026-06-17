import { execSync } from "node:child_process";
import process from "node:process";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
const CONNECT_TIMEOUT_MS = 15_000;
const CHILD_TOOL_TIMEOUT_MS = 30_000;
const TREE_SITTER_CMD = process.env.TREE_SITTER_MCP_CMD ?? "uvx";
const TREE_SITTER_ARGS = process.env.TREE_SITTER_MCP_ARGS ? process.env.TREE_SITTER_MCP_ARGS.split(" ") : ["--from", "tree-sitter-analyzer[mcp]", "tree-sitter-analyzer-mcp"];
/**
 * Soft-fail client returned when a child server fails to connect.
 * Returns a text result with an error message instead of throwing,
 * allowing tool handlers to degrade gracefully rather than crash.
 */
class FailedServerClient {
    serverName;
    error;
    fallbackContent;
    constructor(serverName, error, fallbackContent) {
        this.serverName = serverName;
        this.error = error;
        this.fallbackContent = fallbackContent ?? "Falling back to fallback result.";
    }
    async callTool(_params) {
        return {
            content: [{ type: "text", text: `[boocontext] ${this.serverName} is unavailable: ${this.error}. ${this.fallbackContent}` }],
            isError: false,
        };
    }
    async close() {
        // no-op
    }
}
function checkUvxAvailable() {
    try {
        execSync("uvx --version", { stdio: "ignore" });
        return true;
    }
    catch {
        return false;
    }
}
export class ChildServerManager {
    servers = new Map();
    async spawnServer(config) {
        const transport = new StdioClientTransport({
            command: config.command,
            args: config.args,
            env: config.env,
            cwd: config.cwd,
            stderr: "pipe",
        });
        transport.onclose = () => {
            this.servers.delete(config.name);
        };
        const client = new Client({ name: "boocontext", version: "1.0.0" }, { capabilities: {} });
        let timer;
        const connectTimeout = new Promise((_, reject) => {
            timer = setTimeout(() => reject(new Error(`Connect timeout after ${CONNECT_TIMEOUT_MS}ms`)), CONNECT_TIMEOUT_MS);
        });
        try {
            await Promise.race([client.connect(transport), connectTimeout]);
        }
        catch (err) {
            transport.close();
            const msg = `Failed to connect to "${config.name}": ${err.message}`;
            console.warn(`[boocontext] ${msg}. Continuing with degraded functionality.`);
            const failedClient = new FailedServerClient(config.name, err.message);
            const entry = { config, client: failedClient };
            this.servers.set(config.name, entry);
            return entry;
        }
        finally {
            clearTimeout(timer);
        }
        const entry = { config, client, transport };
        this.servers.set(config.name, entry);
        return entry;
    }
    async getServer(name) {
        const existing = this.servers.get(name);
        if (existing)
            return existing.client;
        const config = CHILD_SERVER_CONFIGS.find((c) => c.name === name);
        if (!config) {
            throw new Error(`Unknown child server: "${name}". Available: ${CHILD_SERVER_CONFIGS.map((c) => c.name).join(", ")}`);
        }
        const entry = await this.spawnServer(config);
        return entry.client;
    }
    async callTool(serverName, tool, args) {
        const client = await this.getServer(serverName);
        const result = await client.callTool({
            name: tool,
            arguments: args,
            // @ts-expect-error - MCP SDK supports request options with timeout via AbortSignal
            signal: AbortSignal.timeout(CHILD_TOOL_TIMEOUT_MS),
        });
        return result;
    }
    async shutdown() {
        const errors = [];
        for (const [name, entry] of this.servers) {
            try {
                await entry.client.close();
            }
            catch (err) {
                errors.push(new Error(`Failed to shutdown "${name}": ${err.message}`));
            }
        }
        this.servers.clear();
        if (errors.length > 0) {
            console.error(`[boocontext] Shutdown completed with ${errors.length} error(s)`);
        }
    }
    getActiveServers() {
        return Array.from(this.servers.keys());
    }
}
export const CHILD_SERVER_CONFIGS = [
    {
        name: "tree-sitter-analyzer",
        command: TREE_SITTER_CMD,
        args: TREE_SITTER_ARGS,
        tools: ["health", "search", "nav", "project", "index", "structure", "viz"],
    },
    {
        name: "type-inject",
        command: "npx",
        args: ["-y", "@nick-vi/type-inject-mcp"],
        tools: ["infer_type", "resolve_signature"],
    },
];
if (!checkUvxAvailable()) {
    console.warn("[boocontext] uvx not found on PATH — tree-sitter-analyzer child server will not start. Install with: curl -LsSf https://astral.sh/uv/install.sh | sh");
}
