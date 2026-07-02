/* eslint-env browser */

(function initLibraryScan(root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  } else {
    root.ArchNoteLibraryScan = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function libraryScanFactory() {
  "use strict";

  const DEFAULT_PAPER_ITEM_TYPES = new Set([
    "journalArticle",
    "conferencePaper",
    "preprint",
    "report",
    "thesis",
    "manuscript",
    "bookSection"
  ]);

  function getItemTypeName(item) {
    return item?.itemType || item?.itemTypeName || "";
  }

  function isCandidatePaperItem(item, options) {
    const opts = options || {};
    if (!item || !(item.isRegularItem && item.isRegularItem())) {
      return false;
    }
    const paperTypes = opts.paperItemTypes || DEFAULT_PAPER_ITEM_TYPES;
    return paperTypes.has(getItemTypeName(item));
  }

  function itemSortKey(item) {
    const dateAdded = item?.dateAdded || item?.getField?.("dateAdded") || "";
    const title = item?.getField?.("title") || item?.title || "";
    const id = Number(item?.id || 0);
    return {
      dateAdded: String(dateAdded),
      title: String(title).toLocaleLowerCase(),
      id
    };
  }

  function sortItemsForBatch(items) {
    return (items || []).slice().sort((a, b) => {
      const left = itemSortKey(a);
      const right = itemSortKey(b);
      if (left.dateAdded !== right.dateAdded) {
        return left.dateAdded.localeCompare(right.dateAdded);
      }
      if (left.title !== right.title) {
        return left.title.localeCompare(right.title);
      }
      return left.id - right.id;
    });
  }

  function normalizeID(value) {
    if (value && typeof value === "object") {
      return normalizeID(value.id || value.collectionID);
    }
    const id = Number(value);
    return Number.isFinite(id) && id > 0 ? id : null;
  }

  function getItemCollectionIDs(item) {
    const rawCollections = item?.getCollections
      ? item.getCollections()
      : item?.collections || [];
    return (rawCollections || [])
      .map(normalizeID)
      .filter((id) => id !== null);
  }

  function itemBelongsToAnyCollection(item, collectionIDs) {
    const wanted = new Set((collectionIDs || []).map(normalizeID).filter((id) => id !== null));
    if (!wanted.size) {
      return false;
    }
    return getItemCollectionIDs(item).some((id) => wanted.has(id));
  }

  function libraryCanReceiveNotes(library) {
    return Boolean(library && library.editable !== false);
  }

  return {
    DEFAULT_PAPER_ITEM_TYPES,
    getItemTypeName,
    getItemCollectionIDs,
    isCandidatePaperItem,
    itemBelongsToAnyCollection,
    libraryCanReceiveNotes,
    sortItemsForBatch
  };
});
