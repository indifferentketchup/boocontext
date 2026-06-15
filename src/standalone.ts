#!/usr/bin/env node
import { startMCPServer } from "./mcp-server.js";

startMCPServer().catch((err) => {
  console.error("boocontext MCP server error:", err);
  process.exit(1);
});
