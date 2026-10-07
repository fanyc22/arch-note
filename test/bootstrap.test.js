const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

test("bootstrap loads fresh runtime modules without the removed skill integration", async () => {
  const root = join(__dirname, "..");
  const loaded = [];
  const context = vm.createContext({
    ChromeUtils: {},
    URL,
    setTimeout,
    clearTimeout,
    Zotero: {
      initializationPromise: Promise.resolve(),
      uiReadyPromise: Promise.resolve(),
      debug() {},
      Notifier: { registerObserver: () => 1, unregisterObserver() {} },
      PreferencePanes: { register: () => "arch-note-zotero-prefpane", unregister() {} },
      getMainWindows: () => []
    },
    Services: {
      io: { newURI: (uri) => uri },
      scriptloader: {
        loadSubScriptWithOptions(uri, options) {
          loaded.push({ uri, ignoreCache: options.ignoreCache });
          vm.runInNewContext(readFileSync(uri, "utf8"), options.target, { filename: uri });
        }
      },
      prompt: { alert: (_, title, message) => assert.fail(`${title}: ${message}`) }
    },
    Components: {
      classes: {
        "@mozilla.org/addons/addon-manager-startup;1": {
          getService: () => ({ registerChrome: () => ({ destruct() {} }) })
        }
      },
      interfaces: {}
    }
  });
  vm.runInContext(readFileSync(join(root, "bootstrap.js"), "utf8"), context);
  await context.startup({ id: "arch-note-zotero-deepseek@example.com", version: "0.1.10", rootURI: `${root}/` });
  assert.equal(loaded.length, 6);
  assert.ok(loaded.every((entry) => entry.ignoreCache === true));
  assert.ok(loaded.every((entry) => !entry.uri.includes("skill-runner")));
  await context.shutdown();
});
