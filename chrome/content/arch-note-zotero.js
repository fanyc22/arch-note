/* global Zotero, IOUtils, OS */

(function initArchNoteZotero(root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  } else {
    root.ArchNoteZotero = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function archNoteZoteroFactory() {
  "use strict";

  const PREF_PREFIX = "extensions.arch-note-zotero.";
  const MENU_ID = "arch-note-zotero-run-selected";
  const BATCH_MENU_ID = "arch-note-zotero-run-missing-library";
  const COLLECTION_BATCH_MENU_ID = "arch-note-zotero-run-missing-collection";
  const SETTINGS_MENU_ID = "arch-note-zotero-settings";

  const state = {
    pluginID: null,
    version: null,
    rootURI: null,
    prompt: null,
    libraryScan: null,
    progress: null,
    skillRunner: null,
    deepSeek: null,
    markdown: null,
    observerID: null,
    queue: [],
    queuedItemIDs: new Set(),
    processingItemIDs: new Set(),
    timers: new Map(),
    processing: false
  };

  function log(message) {
    Zotero.debug(`Arch Note Zotero: ${message}`);
  }

  function getPref(name, fallback) {
    const value = Zotero.Prefs.get(`${PREF_PREFIX}${name}`);
    return value === undefined || value === null ? fallback : value;
  }

  function setPref(name, value) {
    Zotero.Prefs.set(`${PREF_PREFIX}${name}`, value);
  }

  function makeMenuItem(doc, id, label, onCommand) {
    const item = doc.createXULElement ? doc.createXULElement("menuitem") : doc.createElement("menuitem");
    item.id = id;
    item.setAttribute("label", label);
    item.addEventListener("command", onCommand);
    return item;
  }

  function getTagNames(item) {
    return (item.getTags ? item.getTags() : []).map((tag) => tag.tag || tag.name || String(tag));
  }

  function getItemTitle(item) {
    const title = item?.getField ? item.getField("title") : item?.title;
    return title || `item ${item?.id || ""}`.trim();
  }

  async function saveItem(item) {
    if (item.saveTx) {
      await item.saveTx();
      return;
    }
    await item.save();
  }

  async function resolveRegularItem(item) {
    if (!item) {
      return null;
    }
    if (item.isRegularItem && item.isRegularItem()) {
      return item;
    }
    if (item.isAttachment && item.isAttachment() && item.parentID) {
      return Zotero.Items.getAsync(item.parentID);
    }
    return null;
  }

  function creatorName(creator) {
    if (!creator) {
      return "";
    }
    if (creator.name) {
      return creator.name;
    }
    return [creator.firstName, creator.lastName].filter(Boolean).join(" ").trim();
  }

  function extractYear(item) {
    const date = item.getField("date") || "";
    const match = String(date).match(/\b(19|20)\d{2}\b/);
    return match ? match[0] : "";
  }

  function collectMetadata(item) {
    return {
      title: item.getField("title") || "",
      creators: (item.getCreators ? item.getCreators() : []).map(creatorName).filter(Boolean),
      year: extractYear(item),
      date: item.getField("date") || "",
      venue: item.getField("conferenceName") || item.getField("publicationTitle") || item.getField("proceedingsTitle") || "",
      doi: item.getField("DOI") || "",
      url: item.getField("url") || "",
      abstractNote: item.getField("abstractNote") || "",
      tags: getTagNames(item)
    };
  }

  async function getPdfAttachments(item) {
    if (!item.getAttachments) {
      return [];
    }
    const ids = await item.getAttachments();
    const attachments = [];
    for (const id of ids) {
      const attachment = await Zotero.Items.getAsync(id);
      if (!attachment || !(attachment.isAttachment && attachment.isAttachment())) {
        continue;
      }
      const contentType = attachment.attachmentContentType || "";
      const filename = attachment.getFilename ? attachment.getFilename() : "";
      if (contentType === "application/pdf" || /\.pdf$/i.test(filename)) {
        attachments.push(attachment);
      }
    }
    return attachments;
  }

  async function getFirstPdfPath(item) {
    const attachments = await getPdfAttachments(item);
    for (const attachment of attachments) {
      if (attachment.getFilePathAsync) {
        const path = await attachment.getFilePathAsync();
        if (path) {
          return path;
        }
      }
    }
    return "";
  }

  async function pathExists(path) {
    if (!path) {
      return false;
    }
    if (typeof IOUtils !== "undefined" && IOUtils.exists) {
      return IOUtils.exists(path);
    }
    if (typeof OS !== "undefined" && OS.File && OS.File.exists) {
      return OS.File.exists(path);
    }
    return false;
  }

  async function readFileText(path) {
    if (Zotero.File?.getContentsAsync) {
      return Zotero.File.getContentsAsync(path);
    }
    if (typeof IOUtils !== "undefined" && IOUtils.readUTF8) {
      return IOUtils.readUTF8(path);
    }
    throw new Error("No supported Zotero file reader is available");
  }

  async function getFulltextCachePath(attachment) {
    if (!Zotero.Fulltext?.getItemCacheFile) {
      return "";
    }
    const cacheFile = Zotero.Fulltext.getItemCacheFile(attachment);
    if (!cacheFile) {
      return "";
    }
    return cacheFile.path || String(cacheFile);
  }

  async function indexAttachmentIfNeeded(attachment) {
    if (!getPref("forceIndex", true) || !Zotero.Fulltext?.indexItems) {
      return;
    }
    try {
      await Zotero.Fulltext.indexItems([attachment.id], { complete: false, ignoreErrors: true });
    } catch (error) {
      log(`full-text indexing skipped for attachment ${attachment.id}: ${error.message}`);
    }
  }

  async function readAttachmentText(attachment) {
    await indexAttachmentIfNeeded(attachment);
    const cachePath = await getFulltextCachePath(attachment);
    if (cachePath && await pathExists(cachePath)) {
      return readFileText(cachePath);
    }
    return "";
  }

  async function collectPaperText(item) {
    const attachments = await getPdfAttachments(item);
    const blocks = [];
    for (const attachment of attachments) {
      const filename = attachment.getFilename ? attachment.getFilename() : `attachment-${attachment.id}`;
      const text = await readAttachmentText(attachment);
      if (text.trim()) {
        blocks.push(`## ${filename}\n\n${text.trim()}`);
      }
    }
    return blocks.join("\n\n");
  }

  async function findExistingReportNote(item) {
    if (!item.getNotes) {
      return null;
    }
    const reportTag = getPref("reportTag", "arch-note:report");
    const noteIDs = await item.getNotes();
    for (const id of noteIDs) {
      const note = await Zotero.Items.getAsync(id);
      if (!note) {
        continue;
      }
      const noteTags = getTagNames(note);
      const html = note.getNote ? note.getNote() : "";
      if (noteTags.includes(reportTag) || state.markdown.noteContainsReport(html)) {
        return note;
      }
    }
    return null;
  }

  async function saveReportNote(item, markdown, metadata) {
    const reportTag = getPref("reportTag", "arch-note:report");
    const noteHTML = state.markdown.markdownToNoteHTML(markdown, metadata);
    let note = await findExistingReportNote(item);
    if (!note) {
      note = new Zotero.Item("note");
      note.libraryID = item.libraryID;
      note.parentID = item.id;
    }
    note.setNote(noteHTML);
    note.addTag(reportTag);
    await saveItem(note);
    return note;
  }

  async function markItem(item, tagName, removeTagName) {
    if (removeTagName && item.removeTag) {
      item.removeTag(removeTagName);
    }
    if (tagName && item.addTag) {
      item.addTag(tagName);
    }
    await saveItem(item);
  }

  async function processItem(item, options) {
    const opts = options || {};
    const doneTag = getPref("doneTag", "arch-note:done");
    const failedTag = getPref("failedTag", "arch-note:failed");
    if (opts.skipIfReportExists && await findExistingReportNote(item)) {
      log(`skipping item ${item.id}; arch-note report already exists`);
      return "skipped";
    }
    if (!opts.force && getTagNames(item).includes(doneTag)) {
      log(`skipping item ${item.id}; ${doneTag} is already present`);
      return "skipped";
    }

    const apiKey = String(getPref("apiKey", "") || "").trim();
    if (!apiKey) {
      throw new Error("DeepSeek API key is missing. Configure it in Zotero Preferences > Arch Note Zotero.");
    }

    const language = getPref("language", "zh-CN");
    const model = getPref("model", "deepseek-v4-flash");
    const metadata = collectMetadata(item);
    const fallbackSystem = state.prompt.systemMessage(language);
    let messages;

    if (getPref("useSkill", true)) {
      try {
        const paperPath = await getFirstPdfPath(item);
        const paperText = paperPath ? "" : await collectPaperText(item);
        const skillResult = await state.skillRunner.runSkillPrompt({
          itemID: item.id,
          command: getPref("skillCommand", "arch-note"),
          dbPath: getPref("skillDbPath", ""),
          format: getPref("skillFormat", "detailed"),
          style: getPref("style", "group_meeting"),
          topK: Number(getPref("skillTopK", 4)),
          maxChars: Number(getPref("maxChars", 60000)),
          timeoutSeconds: Number(getPref("skillTimeoutSeconds", 300)),
          keepArtifacts: Boolean(getPref("keepSkillArtifacts", false)),
          paperPath,
          paperText,
          metadata,
          query: metadata.title
        }, {
          Zotero,
          Components: typeof Components !== "undefined" ? Components : undefined,
          IOUtils: typeof IOUtils !== "undefined" ? IOUtils : undefined,
          OS: typeof OS !== "undefined" ? OS : undefined,
          PathUtils: typeof PathUtils !== "undefined" ? PathUtils : undefined
        });
        messages = state.skillRunner.promptToMessages(skillResult.prompt, fallbackSystem);
        log(`using arch-note skill prompt for item ${item.id}`);
      } catch (error) {
        if (!getPref("fallbackToInternalPrompt", true)) {
          throw error;
        }
        log(`skill prompt failed for item ${item.id}; falling back to internal prompt: ${error.message}`);
      }
    }

    if (!messages) {
      const paperText = await collectPaperText(item);
      const prompt = state.prompt.buildPaperPrompt({
        metadata,
        text: paperText,
        style: getPref("style", "group_meeting"),
        maxChars: Number(getPref("maxChars", 60000))
      });
      messages = [
        { role: "system", content: fallbackSystem },
        { role: "user", content: prompt }
      ];
    }

    const markdown = await state.deepSeek.complete({
      apiKey,
      baseUrl: getPref("baseUrl", "https://api.deepseek.com"),
      model,
      messages,
      temperature: Number(getPref("temperature", 0.2)),
      maxTokens: Number(getPref("maxTokens", 4096))
    });

    await saveReportNote(item, markdown, {
      title: `Arch Note 导读: ${metadata.title || "Untitled"}`,
      model,
      generatedAt: new Date().toISOString()
    });
    await markItem(item, doneTag, failedTag);
    log(`generated report for item ${item.id}`);
    return "success";
  }

  function createBatch(win, headline, total) {
    const reporter = state.progress?.createProgressReporter
      ? state.progress.createProgressReporter({ Zotero, win, log }, { headline, total })
      : null;
    return {
      total,
      completed: 0,
      succeeded: 0,
      failed: 0,
      skipped: 0,
      reporter
    };
  }

  function batchSnapshot(batch, extra) {
    return {
      total: batch.total,
      completed: batch.completed,
      succeeded: batch.succeeded,
      failed: batch.failed,
      skipped: batch.skipped,
      ...(extra || {})
    };
  }

  function startBatchItem(batch, item) {
    if (!batch?.reporter) {
      return;
    }
    batch.reporter.update(batchSnapshot(batch, {
      phase: "processing",
      currentTitle: getItemTitle(item)
    }));
  }

  function finishBatchItem(batch, item, status) {
    if (!batch) {
      return;
    }
    batch.completed += 1;
    if (status === "success") {
      batch.succeeded += 1;
    } else if (status === "failed") {
      batch.failed += 1;
    } else {
      batch.skipped += 1;
    }
    if (batch.reporter) {
      const snapshot = batchSnapshot(batch, {
        phase: batch.completed >= batch.total ? "complete" : "processing",
        currentTitle: getItemTitle(item)
      });
      if (batch.completed >= batch.total) {
        batch.reporter.finish(snapshot);
      } else {
        batch.reporter.update(snapshot);
      }
    }
  }

  async function drainQueue() {
    if (state.processing) {
      return;
    }
    state.processing = true;
    try {
      while (state.queue.length) {
        const { itemID, options, batch } = state.queue.shift();
        state.queuedItemIDs.delete(itemID);
        state.processingItemIDs.add(itemID);
        let item = null;
        let regularItem = null;
        let status = "skipped";
        try {
          item = await Zotero.Items.getAsync(itemID);
          regularItem = await resolveRegularItem(item);
          if (regularItem) {
            startBatchItem(batch, regularItem);
            status = await processItem(regularItem, options) || "success";
          }
        } catch (error) {
          status = "failed";
          const failedID = regularItem?.id || itemID;
          log(`failed to process item ${failedID}: ${error.stack || error.message}`);
          try {
            if (regularItem) {
              await markItem(regularItem, getPref("failedTag", "arch-note:failed"), null);
            }
          } catch (tagError) {
            log(`failed to tag item ${failedID}: ${tagError.message}`);
          }
        } finally {
          state.processingItemIDs.delete(itemID);
          finishBatchItem(batch, regularItem || item || { id: itemID, title: `item ${itemID}` }, status);
        }
      }
    } finally {
      state.processing = false;
    }
  }

  function queueItem(itemID, options, batch) {
    if (state.queuedItemIDs.has(itemID) || state.processingItemIDs.has(itemID)) {
      return false;
    }
    state.queuedItemIDs.add(itemID);
    state.queue.push({ itemID, options: options || {}, batch: batch || null });
    return true;
  }

  function enqueue(itemID, options, batch) {
    const queued = queueItem(itemID, options, batch);
    if (!queued) {
      return false;
    }
    drainQueue();
    return true;
  }

  function enqueueBatch(win, items, options, headline) {
    const unique = [];
    const seen = new Set();
    for (const item of items || []) {
      if (!item?.id || seen.has(item.id)) {
        continue;
      }
      seen.add(item.id);
      if (!state.queuedItemIDs.has(item.id) && !state.processingItemIDs.has(item.id)) {
        unique.push(item);
      }
    }
    if (!unique.length) {
      return { queued: 0, progressVisible: false };
    }

    const batch = createBatch(win, headline, unique.length);
    if (batch.reporter) {
      batch.reporter.update(batchSnapshot(batch, { phase: "queued" }));
    }
    let queued = 0;
    for (const item of unique) {
      if (queueItem(item.id, options, batch)) {
        queued += 1;
      }
    }
    drainQueue();
    return {
      queued,
      progressVisible: Boolean(batch.reporter?.isVisible && batch.reporter.isVisible())
    };
  }

  function scheduleItemID(itemID, options) {
    const opts = options || {};
    if (state.timers.has(itemID)) {
      clearTimeout(state.timers.get(itemID));
    }
    const delayMs = opts.force ? 0 : Number(getPref("delaySeconds", 20)) * 1000;
    const timer = setTimeout(async () => {
      state.timers.delete(itemID);
      const item = await Zotero.Items.getAsync(itemID);
      const regularItem = await resolveRegularItem(item);
      if (regularItem) {
        enqueue(regularItem.id, opts);
      }
    }, delayMs);
    state.timers.set(itemID, timer);
  }

  const observer = {
    async notify(event, type, ids) {
      if (type !== "item") {
        return;
      }
      if (!getPref("enabled", true) || !getPref("autoRunOnNewItems", true)) {
        return;
      }
      if (!["add", "index"].includes(event)) {
        return;
      }
      for (const id of ids) {
        scheduleItemID(id, { reason: event });
      }
    }
  };

  async function runForSelected(win, options) {
    const pane = win.ZoteroPane;
    const selected = pane.getSelectedItems ? pane.getSelectedItems() : [];
    if (!selected.length) {
      win.alert("Select one or more Zotero items first.");
      return;
    }
    const regularItems = [];
    for (const item of selected) {
      const regularItem = await resolveRegularItem(item);
      if (regularItem) {
        regularItems.push(regularItem);
      }
    }
    if (!regularItems.length) {
      win.alert("No eligible paper items were selected.");
      return;
    }
    const result = enqueueBatch(win, regularItems, { ...(options || {}), force: true, reason: "manual" }, "Arch Note: selected items");
    if (!result.queued) {
      win.alert("The selected paper(s) are already queued or processing.");
    } else if (!result.progressVisible) {
      win.alert(`Queued ${result.queued} paper(s). Zotero will generate reports sequentially in the background.`);
    }
  }

  function getSelectedLibraryID(win) {
    if (win.ZoteroPane?.getSelectedLibraryID) {
      const libraryID = win.ZoteroPane.getSelectedLibraryID();
      if (libraryID) {
        return libraryID;
      }
    }
    return Zotero.Libraries.userLibraryID;
  }

  function normalizeObjectID(value) {
    if (value && typeof value === "object") {
      return normalizeObjectID(value.id || value.collectionID);
    }
    const id = Number(value);
    return Number.isFinite(id) && id > 0 ? id : null;
  }

  async function resolveCollection(value) {
    if (!value) {
      return null;
    }
    if (value.ref) {
      return resolveCollection(value.ref);
    }
    if (value.collection) {
      return resolveCollection(value.collection);
    }
    const id = normalizeObjectID(value);
    if (value && typeof value === "object" && id && value.libraryID !== undefined) {
      return value;
    }
    if (id && Zotero.Collections?.get) {
      return Zotero.Collections.get(id);
    }
    return null;
  }

  async function getSelectedCollection(win) {
    const pane = win.ZoteroPane;
    const view = pane?.collectionsView;
    const probes = [
      () => pane?.getSelectedCollection?.(),
      () => pane?.getSelectedCollectionID?.(),
      () => view?.getSelectedCollection?.(),
      () => view?.getSelectedCollectionID?.(),
      () => view?.getSelectedTreeRow?.(),
      () => view?.selectedTreeRow
    ];
    for (const probe of probes) {
      try {
        const collection = await resolveCollection(await probe());
        if (collection) {
          return collection;
        }
      } catch (error) {
        log(`selected collection probe failed: ${error.message}`);
      }
    }
    return null;
  }

  function getCollectionName(collection) {
    if (!collection) {
      return "selected collection";
    }
    if (collection.name) {
      return collection.name;
    }
    if (collection.getName) {
      return collection.getName();
    }
    return `collection ${collection.id || collection.collectionID}`;
  }

  async function getChildCollections(collection) {
    if (!collection) {
      return [];
    }
    if (collection.getChildCollections) {
      const children = await collection.getChildCollections();
      return children || [];
    }
    if (Zotero.Collections?.getByParent) {
      const children = await Zotero.Collections.getByParent(collection.id);
      return children || [];
    }
    return [];
  }

  async function collectCollectionIDs(collection, seen) {
    const ids = seen || new Set();
    const collectionID = normalizeObjectID(collection);
    if (!collectionID || ids.has(collectionID)) {
      return ids;
    }
    ids.add(collectionID);
    const children = await getChildCollections(collection);
    for (const child of children) {
      const childCollection = await resolveCollection(child);
      await collectCollectionIDs(childCollection, ids);
    }
    return ids;
  }

  async function findMissingReportItemsInLibrary(libraryID) {
    const allItems = await Zotero.Items.getAll(libraryID, true, false);
    const candidates = state.libraryScan.sortItemsForBatch(
      allItems.filter((item) => state.libraryScan.isCandidatePaperItem(item))
    );
    const missing = [];
    for (const item of candidates) {
      if (!await findExistingReportNote(item)) {
        missing.push(item);
      }
    }
    return missing;
  }

  async function findMissingReportItemsInCollection(collection) {
    const collectionIDs = Array.from(await collectCollectionIDs(collection));
    const libraryID = collection.libraryID || Zotero.Libraries.userLibraryID;
    const allItems = await Zotero.Items.getAll(libraryID, true, false);
    const candidates = state.libraryScan.sortItemsForBatch(
      allItems.filter((item) => (
        state.libraryScan.isCandidatePaperItem(item) &&
        state.libraryScan.itemBelongsToAnyCollection(item, collectionIDs)
      ))
    );
    const missing = [];
    for (const item of candidates) {
      if (!await findExistingReportNote(item)) {
        missing.push(item);
      }
    }
    return missing;
  }

  async function runMissingForCurrentLibrary(win) {
    const libraryID = getSelectedLibraryID(win);
    const library = Zotero.Libraries.get(libraryID);
    if (!state.libraryScan.libraryCanReceiveNotes(library)) {
      win.alert("The selected Zotero library is not editable.");
      return;
    }

    const missing = await findMissingReportItemsInLibrary(libraryID);
    if (!missing.length) {
      win.alert("No eligible papers without Arch Note reports were found in the current library.");
      return;
    }

    const libraryName = library?.name || `library ${libraryID}`;
    const confirmed = win.confirm(
      `Generate Arch Note Markdown for ${missing.length} paper(s) in ${libraryName}? ` +
      "This will call DeepSeek once per paper and process items sequentially."
    );
    if (!confirmed) {
      return;
    }

    const result = enqueueBatch(win, missing, {
      force: true,
      skipIfReportExists: true,
      reason: "batch-missing-library"
    }, `Arch Note: ${libraryName}`);
    if (!result.queued) {
      win.alert("The eligible paper(s) are already queued or processing.");
    } else if (!result.progressVisible) {
      win.alert(`Queued ${result.queued} paper(s). Zotero will generate reports sequentially in the background.`);
    }
  }

  async function runMissingForSelectedCollection(win) {
    const collection = await getSelectedCollection(win);
    if (!collection) {
      win.alert("Select a Zotero collection first.");
      return;
    }

    const libraryID = collection.libraryID || getSelectedLibraryID(win);
    const library = Zotero.Libraries.get(libraryID);
    if (!state.libraryScan.libraryCanReceiveNotes(library)) {
      win.alert("The selected Zotero library is not editable.");
      return;
    }

    const missing = await findMissingReportItemsInCollection(collection);
    const collectionName = getCollectionName(collection);
    if (!missing.length) {
      win.alert("No eligible papers without Arch Note reports were found in the selected collection.");
      return;
    }

    const confirmed = win.confirm(
      `Generate Arch Note Markdown for ${missing.length} paper(s) in "${collectionName}"? ` +
      "This will include papers in child collections when Zotero exposes them, call DeepSeek once per paper, and process items sequentially."
    );
    if (!confirmed) {
      return;
    }

    const result = enqueueBatch(win, missing, {
      force: true,
      skipIfReportExists: true,
      reason: "batch-missing-collection"
    }, `Arch Note: ${collectionName}`);
    if (!result.queued) {
      win.alert("The eligible paper(s) are already queued or processing.");
    } else if (!result.progressVisible) {
      win.alert(`Queued ${result.queued} paper(s). Zotero will generate reports sequentially in the background.`);
    }
  }

  function openPreferences(win) {
    if (win.ZoteroPane?.openPreferences) {
      win.ZoteroPane.openPreferences(state.pluginID);
    } else {
      win.alert("Open Zotero Preferences and select Arch Note Zotero.");
    }
  }

  return {
    init(options) {
      state.pluginID = options.pluginID;
      state.version = options.version;
      state.rootURI = options.rootURI;
      state.prompt = options.prompt;
      state.libraryScan = options.libraryScan;
      state.progress = options.progress;
      state.skillRunner = options.skillRunner;
      state.deepSeek = options.deepSeek;
      state.markdown = options.markdown;
      state.observerID = Zotero.Notifier.registerObserver(observer, ["item"], state.pluginID);
    },

    addToWindow(win) {
      const doc = win.document;
      const popup = doc.getElementById("menu_ToolsPopup");
      if (!popup || doc.getElementById(MENU_ID)) {
        return;
      }
      const item = makeMenuItem(doc, MENU_ID, "Generate Arch Note with DeepSeek", () => runForSelected(win, { force: true }));
      const batch = makeMenuItem(doc, BATCH_MENU_ID, "Generate Missing Arch Notes in Current Library", () => runMissingForCurrentLibrary(win));
      const collectionBatch = makeMenuItem(doc, COLLECTION_BATCH_MENU_ID, "Generate Missing Arch Notes in Selected Collection", () => runMissingForSelectedCollection(win));
      const settings = makeMenuItem(doc, SETTINGS_MENU_ID, "Arch Note Zotero Settings", () => openPreferences(win));
      popup.appendChild(item);
      popup.appendChild(batch);
      popup.appendChild(collectionBatch);
      popup.appendChild(settings);
    },

    removeFromWindow(win) {
      const doc = win.document;
      for (const id of [MENU_ID, BATCH_MENU_ID, COLLECTION_BATCH_MENU_ID, SETTINGS_MENU_ID]) {
        const element = doc.getElementById(id);
        if (element) {
          element.remove();
        }
      }
    },

    runForSelected,
    runMissingForCurrentLibrary,
    runMissingForSelectedCollection,
    findMissingReportItemsInCollection,
    enqueue,
    enqueueBatch,
    scheduleItemID,
    setPref,

    async shutdown() {
      if (state.observerID) {
        Zotero.Notifier.unregisterObserver(state.observerID);
      }
      for (const timer of state.timers.values()) {
        clearTimeout(timer);
      }
      state.timers.clear();
      state.queue = [];
      state.queuedItemIDs.clear();
      state.processingItemIDs.clear();
      state.processing = false;
    }
  };
});
