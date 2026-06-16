import test from "node:test";
import assert from "node:assert/strict";
import {
  classifySeverity,
  findWeakestDimension,
  gradeToRank,
  computeHotspotScore,
  runGitLog,
  runFileLOC,
  daysAgo,
} from "../src/tools/severity.js";

test("gradeToRank", () => {
  assert.equal(gradeToRank("A"), 0);
  assert.equal(gradeToRank("B"), 1);
  assert.equal(gradeToRank("C"), 2);
  assert.equal(gradeToRank("D"), 3);
  assert.equal(gradeToRank("F"), 4);
  assert.equal(gradeToRank("X"), -1);
});

test("findWeakestDimension", () => {
  assert.equal(findWeakestDimension({ size: 92, complexity: 48, structure: 85 }), "complexity");
  assert.equal(findWeakestDimension({ size: 80, structure: 80, complexity: 90 }), "size");
  assert.equal(findWeakestDimension({}), "structure");
});

test("classifySeverity basic mapping", () => {
  const dims = { size: 95, complexity: 90, dependencies: 100, duplication: 97, structure: 88 };
  assert.deepEqual(classifySeverity("A", dims), { severity: "INFO", domain: "MAINTAINABILITY" });
  assert.deepEqual(classifySeverity("B", dims), { severity: "INFO", domain: "MAINTAINABILITY" });
  assert.deepEqual(classifySeverity("C", dims), { severity: "MINOR", domain: "MAINTAINABILITY" });
  assert.deepEqual(classifySeverity("D", dims), { severity: "MAJOR", domain: "MAINTAINABILITY" });
  assert.deepEqual(classifySeverity("F", dims), { severity: "CRITICAL", domain: "MAINTAINABILITY" });
});

test("classifySeverity RELIABILITY when complexity is weakest and grade D/F", () => {
  const dims = { size: 95, complexity: 30, dependencies: 100, duplication: 97, structure: 88 };
  assert.equal(classifySeverity("D", dims).domain, "RELIABILITY");
  assert.equal(classifySeverity("F", dims).domain, "RELIABILITY");
  assert.equal(classifySeverity("C", dims).domain, "MAINTAINABILITY");
});

test("computeHotspotScore v2: multi-factor ranking", () => {
  // D-grade frequently-changed > F-grade stale
  const dFrequent = computeHotspotScore(40, 15, 300, 7);
  const fStale = computeHotspotScore(20, 3, 200, 200);
  assert.ok(dFrequent > fStale, `Expected ${dFrequent} > ${fStale}`);

  // A-grade with many commits = 0 (healthy)
  assert.equal(computeHotspotScore(100, 50, 500, 30), 0);

  // Clamping: health_score > 100 → healthPenalty=0 → score=0
  assert.equal(computeHotspotScore(200, 10, 200, 10), 0);

  // Clamping: health_score < 0 → max penalty
  assert.ok(computeHotspotScore(-10, 10, 200, 10) > 0);

  // Larger files rank higher (same health, commits, recency)
  const smallFile = computeHotspotScore(50, 10, 50, 10);
  const largeFile = computeHotspotScore(50, 10, 500, 10);
  assert.ok(largeFile > smallFile);

  // Recent changes rank higher than stale (same health, commits, loc)
  const recent = computeHotspotScore(50, 10, 200, 1);
  const stale = computeHotspotScore(50, 10, 200, 365);
  assert.ok(recent > stale);

  // 0 commits = 0 score regardless of other factors
  assert.equal(computeHotspotScore(20, 0, 1000, 1), 0);
});

test("daysAgo", () => {
  const now = Math.floor(Date.now() / 1000);
  assert.equal(daysAgo(now - 86400), 1);
  assert.equal(daysAgo(now - 86400 * 7), 7);
  assert.equal(daysAgo(now), 0);
});

test("runGitLog returns fileStats with timestamps", () => {
  const { fileStats, gitUnavailable } = runGitLog(process.cwd());
  assert.equal(gitUnavailable, false);
  assert.ok(fileStats instanceof Map);
  assert.ok(fileStats.size > 0, `Expected >0 files in git log, got ${fileStats.size}`);
  const first = [...fileStats.values()][0];
  assert.ok(typeof first.commits === "number");
  assert.ok(typeof first.lastModified === "number");
});

test("runGitLog handles non-git directory", () => {
  const { fileStats, gitUnavailable } = runGitLog("/tmp/opencode");
  assert.equal(gitUnavailable, true);
  assert.equal(fileStats.size, 0);
});

test("runFileLOC returns LOC map for git repo", () => {
  const loc = runFileLOC(process.cwd());
  assert.ok(loc instanceof Map);
  assert.ok(loc.size > 0, `Expected >0 files with LOC, got ${loc.size}`);
  const first = [...loc.values()][0];
  assert.ok(typeof first === "number" && first > 0);
});
