const assert = require("node:assert/strict");
const test = require("node:test");

const prompt = require("../chrome/content/prompt.js");

test("buildPaperPrompt includes metadata, style, and critique patterns", () => {
  const content = prompt.buildPaperPrompt({
    metadata: {
      title: "A Hardware Accelerator",
      creators: ["A. Author", "B. Builder"],
      year: "2025",
      venue: "ISCA",
      doi: "10.123/example",
      tags: ["accelerator"]
    },
    text: "We propose a new accelerator and compare it with a CPU baseline.",
    style: "uw_review",
    maxChars: 1000
  });

  assert.match(content, /A Hardware Accelerator/);
  assert.match(content, /A\. Author, B\. Builder/);
  assert.match(content, /review form/);
  assert.match(content, /weak baseline/);
  assert.match(content, /missing sensitivity study/);
  assert.match(content, /CPU baseline/);
});

test("truncateText respects maxChars", () => {
  const truncated = prompt.truncateText("abcdef", 3);
  assert.equal(truncated.startsWith("abc"), true);
  assert.match(truncated, /Truncated to 3 characters/);
});

test("systemMessage switches language", () => {
  assert.match(prompt.systemMessage("en"), /English/);
  assert.match(prompt.systemMessage("zh-CN"), /Chinese/);
});

