/* global Zotero, ArchNoteDeepSeek */

var ArchNotePrefs = {
  prefix: "extensions.arch-note-zotero.",
  providerID: null,
  providerDrafts: {},

  get(name, fallback) {
    const value = Zotero.Prefs.get(`${this.prefix}${name}`);
    return value === undefined || value === null ? fallback : value;
  },

  set(name, value) {
    Zotero.Prefs.set(`${this.prefix}${name}`, value);
  },

  input(id) {
    return document.getElementById(id);
  },

  loadProvider(providerID) {
    const provider = ArchNoteDeepSeek.getProviderConfig(providerID);
    this.providerID = provider.id;
    this.input("arch-note-provider").value = provider.id;
    const draft = this.providerDrafts[provider.id] || {
      apiKey: this.get(provider.prefs.apiKey, ""),
      baseUrl: this.get(provider.prefs.baseUrl, provider.baseUrl),
      model: this.get(provider.prefs.model, provider.model)
    };
    this.input("arch-note-api-key").value = draft.apiKey;
    this.input("arch-note-base-url").value = draft.baseUrl;
    this.input("arch-note-model").value = draft.model;
  },

  captureProvider() {
    const provider = ArchNoteDeepSeek.getProviderConfig(this.providerID);
    this.providerDrafts[provider.id] = {
      apiKey: this.input("arch-note-api-key").value.trim(),
      baseUrl: this.input("arch-note-base-url").value.trim() || provider.baseUrl,
      model: this.input("arch-note-model").value.trim() || provider.model
    };
  },

  changeProvider() {
    this.captureProvider();
    this.loadProvider(this.input("arch-note-provider").value);
  },

  init() {
    if (!this.input("arch-note-enabled")) {
      return false;
    }
    this.input("arch-note-enabled").checked = Boolean(this.get("enabled", true));
    this.input("arch-note-auto-run").checked = Boolean(this.get("autoRunOnNewItems", true));
    this.input("arch-note-use-skill").checked = Boolean(this.get("useSkill", true));
    this.input("arch-note-fallback-internal").checked = Boolean(this.get("fallbackToInternalPrompt", true));
    this.input("arch-note-keep-artifacts").checked = Boolean(this.get("keepSkillArtifacts", false));
    this.input("arch-note-force-index").checked = Boolean(this.get("forceIndex", true));
    this.input("arch-note-skill-command").value = this.get("skillCommand", "arch-note");
    this.input("arch-note-skill-db").value = this.get("skillDbPath", "");
    this.input("arch-note-skill-top-k").value = this.get("skillTopK", 4);
    this.input("arch-note-skill-timeout").value = this.get("skillTimeoutSeconds", 300);
    this.providerDrafts = {};
    this.loadProvider(this.get("apiProvider", "deepseek"));
    this.input("arch-note-max-chars").value = this.get("maxChars", 60000);
    this.input("arch-note-max-tokens").value = this.get("maxTokens", 16384);
    this.input("arch-note-delay").value = this.get("delaySeconds", 20);
    this.input("arch-note-language").value = this.get("language", "zh-CN");
    return true;
  },

  save() {
    if (!this.input("arch-note-enabled")) {
      return;
    }
    this.set("enabled", this.input("arch-note-enabled").checked);
    this.set("autoRunOnNewItems", this.input("arch-note-auto-run").checked);
    this.set("useSkill", this.input("arch-note-use-skill").checked);
    this.set("fallbackToInternalPrompt", this.input("arch-note-fallback-internal").checked);
    this.set("keepSkillArtifacts", this.input("arch-note-keep-artifacts").checked);
    this.set("forceIndex", this.input("arch-note-force-index").checked);
    this.set("skillCommand", this.input("arch-note-skill-command").value.trim() || "arch-note");
    this.set("skillDbPath", this.input("arch-note-skill-db").value.trim());
    this.set("skillTopK", Number(this.input("arch-note-skill-top-k").value || 4));
    this.set("skillTimeoutSeconds", Number(this.input("arch-note-skill-timeout").value || 300));
    this.captureProvider();
    this.set("apiProvider", this.providerID);
    for (const [providerID, draft] of Object.entries(this.providerDrafts)) {
      const provider = ArchNoteDeepSeek.getProviderConfig(providerID);
      for (const field of ["apiKey", "baseUrl", "model"]) {
        this.set(provider.prefs[field], draft[field]);
      }
    }
    this.set("maxChars", Number(this.input("arch-note-max-chars").value || 60000));
    this.set("maxTokens", Number(this.input("arch-note-max-tokens").value || 16384));
    this.set("delaySeconds", Number(this.input("arch-note-delay").value || 20));
    this.set("language", this.input("arch-note-language").value);
    window.alert("Arch Note Zotero settings saved.");
  }
};

window.ArchNotePrefs = ArchNotePrefs;
ArchNotePrefs.init();
