/* global ChromeUtils, Zotero */

let ServicesRef;
try {
  ServicesRef = typeof Services !== "undefined"
    ? Services
    : ChromeUtils.importESModule("resource://gre/modules/Services.sys.mjs").Services;
} catch (error) {
  throw new Error(`Arch Note Zotero requires Zotero 8+ Services.sys.mjs support: ${error.message}`);
}

let pluginScope = null;
let pluginID = null;
let preferencePaneID = null;
let chromeHandle = null;

function log(message) {
  Zotero.debug(`Arch Note Zotero: ${message}`);
}

function describeError(error) {
  return `${error && error.message ? error.message : error}\n${error && error.stack ? error.stack : ""}`;
}

function reportStartupError(error) {
  const message = describeError(error);
  log(`startup failed: ${message}`);
  try {
    ServicesRef.prompt.alert(null, "Arch Note Zotero startup failed", message);
  } catch (_) {
    // The browser console/debug log still carries the error.
  }
}

function registerChrome(rootURI) {
  if (chromeHandle) {
    return;
  }
  const aomStartup = Components.classes["@mozilla.org/addons/addon-manager-startup;1"]
    .getService(Components.interfaces.amIAddonManagerStartup);
  const manifestURI = ServicesRef.io.newURI(`${rootURI}manifest.json`);
  chromeHandle = aomStartup.registerChrome(manifestURI, [
    ["content", "arch-note-zotero", `${rootURI}chrome/content/`]
  ]);
}

function loadScript(rootURI, name, scope) {
  ServicesRef.scriptloader.loadSubScriptWithOptions(`${rootURI}chrome/content/${name}`, {
    charset: "UTF-8",
    target: scope
  });
}

async function startup({ id, version, rootURI, resourceURI }) {
  try {
    await Zotero.initializationPromise;

    pluginID = id;
    rootURI ||= resourceURI?.spec;
    if (!rootURI) {
      throw new Error("Arch Note Zotero could not resolve plugin rootURI");
    }
    log(`startup begin ${version}`);
    registerChrome(rootURI);

    pluginScope = {
      Zotero,
      ChromeUtils,
      Components: typeof Components !== "undefined" ? Components : undefined,
      Cc: typeof Cc !== "undefined" ? Cc : undefined,
      Ci: typeof Ci !== "undefined" ? Ci : undefined,
      Services: ServicesRef,
      console: typeof console !== "undefined" ? console : undefined,
      fetch: typeof fetch !== "undefined" ? fetch : undefined,
      setTimeout,
      clearTimeout,
      PathUtils: typeof PathUtils !== "undefined" ? PathUtils : undefined,
      IOUtils: typeof IOUtils !== "undefined" ? IOUtils : undefined,
      OS: typeof OS !== "undefined" ? OS : undefined
    };
    pluginScope.globalThis = pluginScope;
    pluginScope.window = pluginScope;

    loadScript(rootURI, "prompt.js", pluginScope);
    loadScript(rootURI, "library-scan.js", pluginScope);
    loadScript(rootURI, "progress.js", pluginScope);
    loadScript(rootURI, "skill-runner.js", pluginScope);
    loadScript(rootURI, "deepseek-client.js", pluginScope);
    loadScript(rootURI, "markdown.js", pluginScope);
    loadScript(rootURI, "arch-note-zotero.js", pluginScope);

    pluginScope.ArchNoteZotero.init({
      pluginID: id,
      version,
      rootURI,
      prompt: pluginScope.ArchNotePrompt,
      libraryScan: pluginScope.ArchNoteLibraryScan,
      progress: pluginScope.ArchNoteProgress,
      skillRunner: pluginScope.ArchNoteSkillRunner,
      deepSeek: pluginScope.ArchNoteDeepSeek,
      markdown: pluginScope.ArchNoteMarkdown
    });

    preferencePaneID = await Zotero.PreferencePanes.register({
      pluginID: id,
      id: "arch-note-zotero-prefpane",
      label: "Arch Note Zotero",
      src: `${rootURI}preferences.xhtml`,
      scripts: [`${rootURI}preferences.js`]
    });

    await Zotero.uiReadyPromise;
    for (const win of Zotero.getMainWindows()) {
      pluginScope.ArchNoteZotero.addToWindow(win);
    }

    log(`started ${version}`);
  } catch (error) {
    reportStartupError(error);
    throw error;
  }
}

function onMainWindowLoad({ window }) {
  if (pluginScope?.ArchNoteZotero) {
    pluginScope.ArchNoteZotero.addToWindow(window);
  }
}

function onMainWindowUnload({ window }) {
  if (pluginScope?.ArchNoteZotero) {
    pluginScope.ArchNoteZotero.removeFromWindow(window);
  }
}

async function shutdown() {
  if (pluginScope?.ArchNoteZotero) {
    await pluginScope.ArchNoteZotero.shutdown();
  }

  if (preferencePaneID) {
    Zotero.PreferencePanes.unregister(preferencePaneID);
  }

  if (chromeHandle) {
    chromeHandle.destruct();
    chromeHandle = null;
  }

  pluginScope = null;
  pluginID = null;
  preferencePaneID = null;
}

async function install() {}

async function uninstall() {}
