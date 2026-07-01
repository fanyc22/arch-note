const assert = require("node:assert/strict");
const test = require("node:test");

const markdown = require("../chrome/content/markdown.js");

test("markdownToNoteHTML escapes content and embeds marker", () => {
  const html = markdown.markdownToNoteHTML("# Title\n<script>alert(1)</script>", {
    title: "Guide <x>",
    model: "deepseek-v4-flash",
    generatedAt: "2026-06-30T00:00:00Z"
  });

  assert.match(html, /arch-note-zotero-report/);
  assert.match(html, /Guide &lt;x&gt;/);
  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.equal(markdown.noteContainsReport(html), true);
});

