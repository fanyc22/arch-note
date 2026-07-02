const assert = require("node:assert/strict");
const { test } = require("node:test");

const libraryScan = require("../chrome/content/library-scan.js");

function makeItem(overrides) {
  return {
    id: 1,
    itemType: "conferencePaper",
    dateAdded: "2026-01-01 00:00:00",
    title: "Paper",
    isRegularItem: () => true,
    getField(name) {
      return this[name] || "";
    },
    getTags: () => [],
    getNotes: async () => [],
    getCollections: () => [],
    ...overrides
  };
}

test("findMissingReportItemsInCollection includes child collections and skips existing reports", async () => {
  const rootCollection = {
    id: 10,
    libraryID: 1,
    name: "Architecture",
    getChildCollections: async () => [{ id: 11, libraryID: 1, name: "Memory" }]
  };
  const childCollection = { id: 11, libraryID: 1, name: "Memory", getChildCollections: async () => [] };
  const reportNote = {
    id: 100,
    getTags: () => [{ tag: "arch-note:report" }],
    getNote: () => ""
  };
  const items = [
    makeItem({ id: 1, title: "Root Paper", getCollections: () => [10] }),
    makeItem({ id: 2, title: "Child Paper", getCollections: () => [11] }),
    makeItem({ id: 3, title: "Other Paper", getCollections: () => [12] }),
    makeItem({ id: 4, itemType: "book", title: "Book", getCollections: () => [10] }),
    makeItem({ id: 5, title: "Done Paper", getCollections: () => [10], getNotes: async () => [100] })
  ];

  global.Zotero = {
    Prefs: { get() {}, set() {} },
    Notifier: {
      registerObserver() {
        return 1;
      },
      unregisterObserver() {}
    },
    Collections: {
      get(id) {
        return id === 11 ? childCollection : rootCollection;
      }
    },
    Items: {
      getAll: async () => items,
      getAsync: async (id) => (id === 100 ? reportNote : items.find((item) => item.id === id))
    },
    Libraries: { userLibraryID: 1 },
    debug() {}
  };

  delete require.cache[require.resolve("../chrome/content/arch-note-zotero.js")];
  const api = require("../chrome/content/arch-note-zotero.js");
  api.init({
    pluginID: "arch-note-zotero-deepseek@example.com",
    version: "0.1.8",
    rootURI: "jar:file:///test!/",
    prompt: {},
    libraryScan,
    progress: {},
    skillRunner: {},
    deepSeek: {},
    markdown: { noteContainsReport: () => false }
  });

  const missing = await api.findMissingReportItemsInCollection(rootCollection);
  assert.deepEqual(missing.map((item) => item.id), [2, 1]);
  await api.shutdown();
});
