const assert = require("node:assert/strict");
const { test } = require("node:test");

test("addToWindow injects the Arch Note Tools menu actions", () => {
  global.Zotero = {
    Prefs: { get() {}, set() {} },
    Notifier: {
      registerObserver() {
        return 1;
      },
      unregisterObserver() {}
    },
    debug() {}
  };

  delete require.cache[require.resolve("../chrome/content/arch-note-zotero.js")];
  const api = require("../chrome/content/arch-note-zotero.js");
  api.init({
    pluginID: "arch-note-zotero-deepseek@example.com",
    version: "0.1.6",
    rootURI: "jar:file:///test!/",
    prompt: {},
    libraryScan: {},
    skillRunner: {},
    deepSeek: {},
    markdown: {}
  });

  const nodes = new Map();
  function makeNode(tag) {
    return {
      tag,
      attrs: {},
      children: [],
      listeners: {},
      id: "",
      setAttribute(key, value) {
        this.attrs[key] = value;
        if (key === "id") {
          this.id = value;
          nodes.set(value, this);
        }
      },
      getAttribute(key) {
        return this.attrs[key];
      },
      appendChild(child) {
        this.children.push(child);
        return child;
      },
      addEventListener(name, fn) {
        this.listeners[name] = fn;
      }
    };
  }

  const popup = makeNode("menupopup");
  popup.id = "menu_ToolsPopup";
  nodes.set("menu_ToolsPopup", popup);

  api.addToWindow({
    document: {
      getElementById(id) {
        return nodes.get(id) || null;
      },
      createXULElement: makeNode
    }
  });

  assert.deepEqual(
    popup.children.map((item) => [item.id, item.getAttribute("label")]),
    [
      ["arch-note-zotero-run-selected", "Generate Arch Note with DeepSeek"],
      ["arch-note-zotero-run-missing-library", "Generate Missing Arch Notes in Current Library"],
      ["arch-note-zotero-settings", "Arch Note Zotero Settings"]
    ]
  );
});
