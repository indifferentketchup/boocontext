import test from "node:test";
import assert from "node:assert/strict";
import { ChildServerManager, CHILD_SERVER_CONFIGS } from "../src/child-server.js";

test("ChildServerConfigs have correct structure", () => {
  assert.ok(Array.isArray(CHILD_SERVER_CONFIGS));
  assert.equal(CHILD_SERVER_CONFIGS.length, 2);

  const tsa = CHILD_SERVER_CONFIGS.find((c) => c.name === "tree-sitter-analyzer");
  assert.ok(tsa, "TSA config should exist");
  assert.equal(tsa.command, "uvx");
  assert.ok(tsa.tools.includes("health"));
  assert.ok(tsa.tools.includes("search"));

  const ti = CHILD_SERVER_CONFIGS.find((c) => c.name === "type-inject");
  assert.ok(ti, "type-inject config should exist");
  assert.equal(ti.command, "npx");
  assert.ok(ti.tools.includes("infer_type"));
});

test("ChildServerManager starts empty", () => {
  const manager = new ChildServerManager();
  assert.equal(manager.getActiveServers().length, 0);
});

test("ChildServerManager.getServer throws for unknown server", async () => {
  const manager = new ChildServerManager();
  await assert.rejects(
    () => manager.getServer("nonexistent"),
    /Unknown child server/,
  );
});

test("ChildServerManager.shutdown on empty manager does not throw", async () => {
  const manager = new ChildServerManager();
  await manager.shutdown();
  assert.equal(manager.getActiveServers().length, 0);
});
