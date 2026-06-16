import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = resolve(__dirname, "..");
const entrypoint = resolve(projectRoot, "dist/index.js");

function startServer() {
  return spawn("node", [entrypoint, "--mcp"], {
    cwd: projectRoot,
    stdio: ["pipe", "pipe", "pipe"],
  });
}

async function readFramedResponse(child: ReturnType<typeof startServer>, timeoutMs = 3000) {
  const stdout = child.stdout;
  return await new Promise<any>((resolvePromise, reject) => {
    let buffer = Buffer.alloc(0);
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error(`Timed out (${timeoutMs}ms)`));
    }, timeoutMs);
    function cleanup() {
      clearTimeout(timer);
      stdout.off("data", onData);
      child.off("error", onError);
      child.off("exit", onExit);
    }
    function onError(error: Error) { cleanup(); reject(error); }
    function onExit(code: number | null, signal: string | null) {
      cleanup();
      reject(new Error(`Process exited (code=${code}, signal=${signal})`));
    }
    function onData(chunk: Buffer) {
      buffer = Buffer.concat([buffer, chunk]);
      const headerEnd = buffer.indexOf("\r\n\r\n");
      if (headerEnd === -1) return;
      const header = buffer.subarray(0, headerEnd).toString("utf8");
      const lengthMatch = header.match(/Content-Length:\s*(\d+)/i);
      if (!lengthMatch) { cleanup(); reject(new Error("Missing Content-Length")); return; }
      const contentLength = Number.parseInt(lengthMatch[1], 10);
      const bodyStart = headerEnd + 4;
      if (buffer.length < bodyStart + contentLength) return;
      const body = buffer.subarray(bodyStart, bodyStart + contentLength).toString("utf8");
      cleanup();
      resolvePromise(JSON.parse(body));
    }
    stdout.on("data", onData);
    child.on("error", onError);
    child.on("exit", onExit);
  });
}

function writeFramedMessage(child: ReturnType<typeof startServer>, payload: unknown) {
  const input = child.stdin;
  const body = JSON.stringify(payload);
  input.write(`Content-Length: ${Buffer.byteLength(body)}\r\n\r\n${body}`);
}

async function stopServer(child: ReturnType<typeof startServer>) {
  child.kill("SIGTERM");
  await new Promise((resolvePromise) => child.once("exit", () => resolvePromise(undefined)));
}

async function initialize(child: ReturnType<typeof startServer>) {
  writeFramedMessage(child, {
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "test-client", version: "1.0.0" },
    },
  });
  return await readFramedResponse(child);
}

test("boocontext server reports correct server info", async () => {
  const child = startServer();
  try {
    const response = await initialize(child);
    assert.equal(response.result.serverInfo.name, "boocontext");
    assert.equal(response.result.serverInfo.version, "1.15.0");
  } finally {
    await stopServer(child);
  }
});

test("tools/list includes all 9 boocontext analysis tools", async () => {
  const child = startServer();
  try {
    await initialize(child);
    writeFramedMessage(child, {
      jsonrpc: "2.0",
      id: 2,
      method: "tools/list",
    });
    const response = await readFramedResponse(child);
    const toolNames = response.result.tools.map((t: any) => t.name);
    assert.ok(toolNames.includes("boocontext_overview"), "should have overview");
    assert.ok(toolNames.includes("boocontext_map"), "should have map");
    assert.ok(toolNames.includes("boocontext_callgraph"), "should have callgraph");
    assert.ok(toolNames.includes("boocontext_types"), "should have types");
    assert.ok(toolNames.includes("boocontext_impact"), "should have impact");
    assert.ok(toolNames.includes("boocontext_symbols"), "should have symbols");
    assert.ok(toolNames.includes("boocontext_health"), "should have health");
    assert.ok(toolNames.includes("boocontext_severity"), "should have severity");
    assert.ok(toolNames.includes("boocontext_explore"), "should have explore");
  } finally {
    await stopServer(child);
  }
});

test("boocontext_overview returns verdict envelope", async () => {
  const child = startServer();
  try {
    await initialize(child);
    writeFramedMessage(child, {
      jsonrpc: "2.0",
      id: 3,
      method: "tools/call",
      params: {
        name: "boocontext_overview",
        arguments: { directory: projectRoot },
      },
    });
    const response = await readFramedResponse(child, 10000);
    const result = response.result;
    assert.ok(result, "should have result");

    const content = result.content[0];
    const envelope = JSON.parse(content.text);
    assert.ok(["SAFE", "UNSAFE", "CAUTION", "INFO"].includes(envelope.verdict));
    assert.ok(typeof envelope.summary === "string");
    assert.ok(envelope.details);
    assert.ok(envelope.metadata);
    assert.equal(envelope.metadata.tool, "boocontext_overview");
    assert.equal(envelope.metadata.source, "boocontext");
    assert.ok(typeof envelope.metadata.duration_ms === "number");
  } finally {
    await stopServer(child);
  }
});

test("tools/list advertises boocontext_get and hides the legacy getters", async () => {
  const child = startServer();
  try {
    await initialize(child);
    writeFramedMessage(child, { jsonrpc: "2.0", id: 2, method: "tools/list" });
    const response = await readFramedResponse(child);
    const toolNames: string[] = response.result.tools.map((t: any) => t.name);

    assert.ok(toolNames.includes("boocontext_get"), "should advertise consolidated boocontext_get");
    const leaked = toolNames.filter((n) => n.startsWith("boocontext_get_") || n === "boocontext_lint_wiki");
    assert.deepEqual(leaked, [], `legacy getters must not be listed, found: ${leaked.join(", ")}`);
    assert.equal(toolNames.length, 12, `expected 12 advertised tools, got ${toolNames.length}: ${toolNames.join(", ")}`);
  } finally {
    await stopServer(child);
  }
});

test("legacy getter alias is byte-identical to boocontext_get with a section", async () => {
  const child = startServer();
  try {
    await initialize(child);
    writeFramedMessage(child, {
      jsonrpc: "2.0",
      id: 3,
      method: "tools/call",
      params: { name: "boocontext_get", arguments: { section: "summary", directory: projectRoot } },
    });
    const viaSection = await readFramedResponse(child, 10000);

    writeFramedMessage(child, {
      jsonrpc: "2.0",
      id: 4,
      method: "tools/call",
      params: { name: "boocontext_get_summary", arguments: { directory: projectRoot } },
    });
    const viaAlias = await readFramedResponse(child, 10000);

    assert.equal(
      viaAlias.result.content[0].text,
      viaSection.result.content[0].text,
      "alias output must match boocontext_get {section: summary}",
    );
  } finally {
    await stopServer(child);
  }
});

test("boocontext_get with an unknown section returns a helpful error", async () => {
  const child = startServer();
  try {
    await initialize(child);
    writeFramedMessage(child, {
      jsonrpc: "2.0",
      id: 5,
      method: "tools/call",
      params: { name: "boocontext_get", arguments: { section: "nonsense", directory: projectRoot } },
    });
    const response = await readFramedResponse(child, 10000);
    const text: string = response.result.content[0].text;
    assert.match(text, /Unknown section/);
    assert.match(text, /Valid sections/);
  } finally {
    await stopServer(child);
  }
});
