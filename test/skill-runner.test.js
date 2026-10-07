const assert = require("node:assert/strict");
const test = require("node:test");

const skillRunner = require("../chrome/content/skill-runner.js");

test("buildPaperTextArgs builds arch-note paper text command", () => {
  assert.deepEqual(
    skillRunner.buildPaperTextArgs({ paperPath: "/tmp/paper.pdf", outPath: "/tmp/paper.txt" }),
    ["paper", "text", "/tmp/paper.pdf", "--out", "/tmp/paper.txt"]
  );
});

test("buildPromptArgs includes corpus db and output path", () => {
  const args = skillRunner.buildPromptArgs({
    paperTextPath: "/tmp/paper.skill.txt",
    promptPath: "/tmp/prompt.md",
    dbPath: "/tmp/corpus.sqlite",
    format: "detailed",
    style: "group_meeting",
    topK: 4,
    maxChars: 60000,
    query: "paper title"
  });

  assert.deepEqual(args, [
    "prompt",
    "--paper",
    "/tmp/paper.skill.txt",
    "--db",
    "/tmp/corpus.sqlite",
    "--format",
    "detailed",
    "--style",
    "group_meeting",
    "--top-k",
    "4",
    "--max-chars",
    "60000",
    "--out",
    "/tmp/prompt.md",
    "--query",
    "paper title"
  ]);
});

test("promptToMessages uses the unified system while preserving skill evidence", () => {
  const messages = skillRunner.promptToMessages("# SYSTEM\nold format\n\n# USER\nfactual anchors", "unified system");
  assert.deepEqual(messages, [
    { role: "system", content: "unified system" },
    { role: "user", content: "factual anchors" }
  ]);
});

test("promptToMessages uses the unified system for unstructured skill output", () => {
  assert.deepEqual(skillRunner.promptToMessages("paper text and context", "unified system"), [
    { role: "system", content: "unified system" },
    { role: "user", content: "paper text and context" }
  ]);
});

test("metadataPrefix carries Zotero metadata into skill paper text", () => {
  const prefix = skillRunner.metadataPrefix({
    title: "Paper",
    creators: ["A", "B"],
    year: "2026",
    venue: "ISCA",
    abstractNote: "Abstract text."
  });

  assert.match(prefix, /# Zotero Metadata/);
  assert.match(prefix, /Title: Paper/);
  assert.match(prefix, /Authors: A, B/);
  assert.match(prefix, /# Paper Text/);
});
