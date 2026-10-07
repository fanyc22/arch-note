const assert = require("node:assert/strict");
const test = require("node:test");

const prompt = require("../chrome/content/prompt.js");
const skillRunner = require("../chrome/content/skill-runner.js");
const client = require("../chrome/content/deepseek-client.js");
const markdown = require("../chrome/content/markdown.js");
const libraryScan = require("../chrome/content/library-scan.js");

function generation(t, scenario) {
  const prefs = new Map(Object.entries({
    apiProvider: scenario.provider,
    apiKey: "sk-deepseek-test",
    poixeApiKey: scenario.missingKey ? "" : "sk-poixe-test",
    model: "deepseek-v4-pro",
    poixeModel: "relay-model",
    language: scenario.language || "zh-CN",
    delaySeconds: 0,
    useSkill: scenario.useSkill,
    forceIndex: false,
    // Legacy output preferences must not change the unified system prompt.
    skillFormat: "brief",
    style: "uw_review"
  }).map(([name, value]) => [`extensions.arch-note-zotero.${name}`, value]));
  let finishSaving;
  const saved = new Promise((resolve) => { finishSaving = resolve; });
  const papers = [1, 2].map((id) => ({
    id,
    libraryID: 1,
    itemType: "conferencePaper",
    dateAdded: `2026-01-0${id} 00:00:00`,
    tags: [],
    getField: (name) => ({ title: `Paper ${id}`, date: "2026" })[name] || "",
    getCreators: () => [{ name: "Test Author" }],
    isRegularItem: () => true,
    getAttachments: () => [id + 10],
    getNotes: () => [],
    getCollections: () => [10],
    getTags() { return this.tags.map((tag) => ({ tag })); },
    addTag(tag) { this.tags.push(tag); },
    removeTag() {},
    async saveTx() {
      if (papers.every((paper) => paper.tags.includes("arch-note:done"))) {
        finishSaving();
      }
    }
  }));
  const attachments = [11, 12].map((id) => ({
    id,
    isAttachment: () => true,
    attachmentContentType: "application/pdf",
    getFilename: () => `${id}.pdf`,
    getFilePathAsync: async () => `/tmp/${id}.pdf`
  }));
  const requests = [];
  const notes = [];
  const logs = [];
  const skillCalls = [];
  let finish;
  const completed = new Promise((resolve) => { finish = resolve; });
  const previousZotero = global.Zotero;
  const previousIOUtils = global.IOUtils;
  let observer;
  global.IOUtils = { exists: async () => true };
  global.Zotero = {
    Prefs: { get: (name) => prefs.get(name) },
    Notifier: {
      registerObserver(value) { observer = value; return 1; },
      unregisterObserver() {}
    },
    Items: {
      getAsync: async (id) => [...papers, ...attachments].find((item) => item.id === id),
      getAll: async () => papers.slice().reverse()
    },
    Libraries: { userLibraryID: 1, get: () => ({ editable: true }) },
    Fulltext: { getItemCacheFile: (attachment) => ({ path: `/tmp/${attachment.id}.txt` }) },
    File: { getContentsAsync: async (path) => `PDF evidence from ${path}` },
    Item: class {
      setNote(html) { this.html = html; }
      addTag() {}
      async saveTx() { notes.push(this); }
    },
    debug: (message) => logs.push(message)
  };
  delete require.cache[require.resolve("../chrome/content/arch-note-zotero.js")];
  const api = require("../chrome/content/arch-note-zotero.js");
  api.init({
    pluginID: "arch-note-zotero-deepseek@example.com",
    prompt,
    libraryScan,
    markdown,
    progress: {
      createProgressReporter: () => ({ isVisible: () => true, update() {}, finish })
    },
    skillRunner: {
      ...skillRunner,
      async runSkillPrompt(options) {
        skillCalls.push(options);
        if (scenario.skillFails) {
          throw new Error("skill unavailable");
        }
        return { prompt: `# SYSTEM\nOLD SKILL SYSTEM\n\n# USER\nFactual anchors and PDF evidence for ${options.metadata.title}` };
      }
    },
    deepSeek: {
      ...client,
      complete: (options) => client.complete(options, async (url, init) => {
        requests.push({ url, headers: init.headers, body: JSON.parse(init.body) });
        return {
          ok: true,
          text: async () => JSON.stringify({ choices: [{ message: { content: "# Paper guide\n\nEvidence-based summary." } }] })
        };
      })
    }
  });
  t.after(async () => {
    await api.shutdown();
    global.Zotero = previousZotero;
    global.IOUtils = previousIOUtils;
  });
  const win = {
    ZoteroPane: {
      getSelectedItems: () => papers,
      getSelectedLibraryID: () => 1,
      getSelectedCollection: () => ({ id: 10, libraryID: 1, name: "Architecture", getChildCollections: () => [] })
    },
    alert: (message) => assert.fail(message),
    confirm: () => true
  };
  return { api, win, papers, completed, saved, observer, requests, notes, logs, skillCalls };
}

for (const scenario of [
  { name: "selected items with built-in evidence", provider: "deepseek", useSkill: false, action: "runForSelected" },
  { name: "library backfill with skill evidence", provider: "deepseek", useSkill: true, action: "runMissingForCurrentLibrary" },
  { name: "collection backfill with Poixe and skill evidence", provider: "poixe", useSkill: true, action: "runMissingForSelectedCollection", language: "en" },
  { name: "Poixe skill failure with built-in fallback", provider: "poixe", useSkill: true, skillFails: true, action: "runForSelected" }
]) {
  test(`generation uses the unified system: ${scenario.name}`, { timeout: 2000 }, async (t) => {
    const env = generation(t, scenario);
    await env.api[scenario.action](env.win);
    const result = await env.completed;
    assert.equal(result.succeeded, 2);
    assert.equal(result.failed, 0);
    assert.equal(env.notes.length, 2);
    assert.deepEqual(env.notes.map((note) => note.parentID), [1, 2]);
    assert.ok(env.papers.every((paper) => paper.tags.includes("arch-note:done")));
    assert.equal(env.requests.length, 2);
    for (const request of env.requests) {
      assert.equal(request.body.messages[0].role, "system");
      assert.equal(request.body.messages[0].content, prompt.systemMessage(scenario.language || "zh-CN"));
      assert.equal(request.body.messages.length, 2);
      assert.match(request.body.messages[1].content, /PDF evidence/);
      assert.doesNotMatch(request.body.messages[0].content, /OLD SKILL SYSTEM/);
      if (scenario.provider === "poixe") {
        assert.equal(request.url, "https://api.poixe.com/v1/chat/completions");
        assert.equal(request.headers.Authorization, "Bearer sk-poixe-test");
        assert.equal(request.body.model, "relay-model");
      } else {
        assert.equal(request.url, "https://api.deepseek.com/chat/completions");
        assert.equal(request.headers.Authorization, "Bearer sk-deepseek-test");
        assert.equal(request.body.model, "deepseek-v4-pro");
      }
    }
    if (scenario.useSkill) {
      assert.equal(env.skillCalls.length, 2);
      assert.ok(env.skillCalls.every((call) => call.format === "detailed" && call.style === "group_meeting"));
    }
    if (scenario.skillFails) {
      assert.ok(env.logs.some((message) => message.includes("falling back to internal prompt")));
    }
  });
}

test("Poixe with no key fails without using the saved DeepSeek key", { timeout: 2000 }, async (t) => {
  const env = generation(t, { provider: "poixe", useSkill: false, missingKey: true });
  await env.api.runForSelected(env.win);
  const result = await env.completed;
  assert.equal(result.failed, 2);
  assert.equal(env.requests.length, 0);
  assert.equal(env.notes.length, 0);
  assert.ok(env.logs.some((message) => message.includes("Poixe API key is missing")));
  assert.ok(env.papers.every((paper) => paper.tags.includes("arch-note:failed")));
});

test("new-item notifications generate guides with the same system and Poixe profile", { timeout: 2000 }, async (t) => {
  const env = generation(t, { provider: "poixe", useSkill: true });
  await env.observer.notify("add", "item", [1, 2]);
  await env.saved;
  assert.equal(env.notes.length, 2);
  assert.equal(env.requests.length, 2);
  for (const request of env.requests) {
    assert.equal(request.body.messages[0].content, prompt.systemMessage("zh-CN"));
    assert.equal(request.url, "https://api.poixe.com/v1/chat/completions");
    assert.equal(request.headers.Authorization, "Bearer sk-poixe-test");
  }
});
