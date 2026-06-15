import { execSync } from "node:child_process";
import process from "node:process";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const CONNECT_TIMEOUT_MS = 15_000;
const CHILD_TOOL_TIMEOUT_MS = 30_000;

const TREE_SITTER_CMD = process.env.TREE_SITTER_MCP_CMD ?? "uvx";
const TREE_SITTER_ARGS = process.env.TREE_SITTER_MCP_ARGS ? process.env.TREE_SITTER_MCP_ARGS.split(" ") : ["--from", "tree-sitter-analyzer[mcp]", "tree-sitter-analyzer-mcp"];

// Minimal client interface that both real MCP Client and FailedServerClient satisfy
interface ChildClient {
  callTool(params: { name: string; arguments?: any }, options?: any): Promise<any>;
  close(): Promise<void>;
}

/**
 * Soft-fail client returned when a child server fails to connect.
 * Returns a text result with an error message instead of throwing,
 * allowing tool handlers to degrade gracefully rather than crash.
 */
class FailedServerClient implements ChildClient {
  private serverName: string;
  private error: string;
  private fallbackContent: string;

  constructor(serverName: string, error: string, fallbackContent?: string) {
    this.serverName = serverName;
    this.error = error;
    this.fallbackContent = fallbackContent ?? "Falling back to fallback result.";
  }

  async callTool(_params: { name: string; arguments?: any }): Promise<any> {
    return {
      content: [{ type: "text", text: `[boocontext] ${this.serverName} is unavailable: ${this.error}. ${this.fallbackContent}` }],
      isError: false,
    };
  }

  async close(): Promise<void> {
    // no-op
  }
}

function checkUvxAvailable(): boolean {
  try {
    execSync("uvx --version", { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

export interface ChildServerConfig {
  name: string;
  command: string;
  args: string[];
  env?: Record<string, string>;
  tools: string[];
  cwd?: string;
}

interface ServerEntry {
  config: ChildServerConfig;
  client: ChildClient;
  transport?: StdioClientTransport;
}

export class ChildServerManager {
  private servers = new Map<string, ServerEntry>();

  private async spawnServer(config: ChildServerConfig): Promise<ServerEntry> {
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

    const client = new Client(
      { name: "boocontext", version: "1.0.0" },
      { capabilities: {} },
    );

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(new Error(`Connect timeout after ${CONNECT_TIMEOUT_MS}ms`)), CONNECT_TIMEOUT_MS);

    try {
      await client.connect(transport);
    } catch (err: any) {
      transport.close();
      const msg = `Failed to connect to "${config.name}": ${err.message}`;
      console.warn(`[boocontext] ${msg}. Continuing with degraded functionality.`);
      const failedClient = new FailedServerClient(config.name, err.message);
      const entry: ServerEntry = { config, client: failedClient };
      this.servers.set(config.name, entry);
      return entry;
    } finally {
      clearTimeout(timer);
    }

    const entry: ServerEntry = { config, client, transport };
    this.servers.set(config.name, entry);
    return entry;
  }

  async getServer(name: string): Promise<ChildClient> {
    const existing = this.servers.get(name);
    if (existing) return existing.client;

    const config = CHILD_SERVER_CONFIGS.find((c) => c.name === name);
    if (!config) {
      throw new Error(`Unknown child server: "${name}". Available: ${CHILD_SERVER_CONFIGS.map((c) => c.name).join(", ")}`);
    }

    const entry = await this.spawnServer(config);
    return entry.client;
  }

  async callTool(serverName: string, tool: string, args: any): Promise<any> {
    const client = await this.getServer(serverName);
    const result = await client.callTool({
      name: tool,
      arguments: args,
      // @ts-expect-error - MCP SDK supports request options with timeout via AbortSignal
      signal: AbortSignal.timeout(CHILD_TOOL_TIMEOUT_MS),
    });
    return result;
  }

  async shutdown(): Promise<void> {
    const errors: Error[] = [];
    for (const [name, entry] of this.servers) {
      try {
        await entry.client.close();
      } catch (err: any) {
        errors.push(new Error(`Failed to shutdown "${name}": ${err.message}`));
      }
    }
    this.servers.clear();
    if (errors.length > 0) {
      console.error(`[boocontext] Shutdown completed with ${errors.length} error(s)`);
    }
  }

  getActiveServers(): string[] {
    return Array.from(this.servers.keys());
  }
}

export const CHILD_SERVER_CONFIGS: ChildServerConfig[] = [
  {
    name: "tree-sitter-analyzer",
    command: "uvx",
    args: ["--from", "tree-sitter-analyzer[mcp]", "tree-sitter-analyzer-mcp"],
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
