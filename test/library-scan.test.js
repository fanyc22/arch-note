const assert = require("node:assert/strict");
const test = require("node:test");

const libraryScan = require("../chrome/content/library-scan.js");

function item(overrides) {
  const data = {
    id: 1,
    itemType: "journalArticle",
    dateAdded: "2026-01-01 00:00:00",
    title: "Paper",
    isRegularItem: () => true,
    getField(name) {
      return this[name] || "";
    },
    ...overrides
  };
  return data;
}

test("isCandidatePaperItem accepts Zotero paper-like item types", () => {
  assert.equal(libraryScan.isCandidatePaperItem(item({ itemType: "journalArticle" })), true);
  assert.equal(libraryScan.isCandidatePaperItem(item({ itemType: "conferencePaper" })), true);
  assert.equal(libraryScan.isCandidatePaperItem(item({ itemType: "book" })), false);
  assert.equal(libraryScan.isCandidatePaperItem(item({ isRegularItem: () => false })), false);
});

test("sortItemsForBatch produces deterministic oldest-first order", () => {
  const sorted = libraryScan.sortItemsForBatch([
    item({ id: 3, title: "B", dateAdded: "2026-01-02 00:00:00" }),
    item({ id: 2, title: "B", dateAdded: "2026-01-01 00:00:00" }),
    item({ id: 1, title: "A", dateAdded: "2026-01-01 00:00:00" })
  ]);

  assert.deepEqual(sorted.map((row) => row.id), [1, 2, 3]);
});

test("libraryCanReceiveNotes rejects read-only libraries", () => {
  assert.equal(libraryScan.libraryCanReceiveNotes({ editable: true }), true);
  assert.equal(libraryScan.libraryCanReceiveNotes({ editable: false }), false);
  assert.equal(libraryScan.libraryCanReceiveNotes(null), false);
});

