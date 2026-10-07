const assert = require("node:assert/strict");
const test = require("node:test");

const prompt = require("../chrome/content/prompt.js");

test("buildPaperPrompt supplies metadata and evidence without a competing output format", () => {
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
    maxChars: 1000
  });

  assert.match(content, /A Hardware Accelerator/);
  assert.match(content, /A\. Author, B\. Builder/);
  assert.match(content, /system prompt 的 13 项结构/);
  assert.doesNotMatch(content, /TL;DR|review form|请包含这些 Markdown 小节/);
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

test("the unified system prompt covers all 13 steps and evidence boundaries", () => {
  const content = prompt.systemMessage("zh-CN");
  const steps = [...content.matchAll(/^(\d+)\. /gm)].map((match) => Number(match[1]));
  assert.deepEqual(steps, Array.from({ length: 13 }, (_, index) => index + 1));
  for (const term of ["思考路径", "数学推导", "baseline", "反例", "后续研究", "novel", "Andrej Karpathy", "Kaiming He"]) {
    assert.ok(content.includes(term), term);
  }
  for (const term of ["论文原文", "已有文献", "合理推断", "不确定猜测", "未进行联网检索", "新颖性尚未验证"]) {
    assert.ok(content.includes(term), term);
  }
});

test("validateGuide rejects short, incomplete, reordered, and repeated sections", () => {
  const valid = Array.from({ length: 13 }, (_, index) => `## ${index + 1}. Topic\nExplanation.`).join("\n\n");
  assert.doesNotThrow(() => prompt.validateGuide(valid));
  assert.throws(() => prompt.validateGuide("# Paper\nOne-sentence summary\nThree insights\nFlaw\nImplication"), /required 13-section/);
  assert.throws(() => prompt.validateGuide(valid.replace("## 13. Topic", "### 13. Topic")), /required 13-section/);
  assert.throws(() => prompt.validateGuide(valid.replace("## 2. Topic", "## 1. Topic")), /required 13-section/);
  assert.throws(() => prompt.validateGuide(valid + "\n## 13. Extra"), /required 13-section/);
});
