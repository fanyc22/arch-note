/* global Zotero */

var ArchNotePrefs = {
  prefix: "extensions.arch-note-zotero.",

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
    this.input("arch-note-skill-format").value = this.get("skillFormat", "detailed");
    this.input("arch-note-skill-top-k").value = this.get("skillTopK", 4);
    this.input("arch-note-skill-timeout").value = this.get("skillTimeoutSeconds", 300);
    this.input("arch-note-api-key").value = this.get("apiKey", "");
    this.input("arch-note-base-url").value = this.get("baseUrl", "https://api.deepseek.com");
    this.input("arch-note-model").value = this.get("model", "deepseek-v4-flash");
    this.input("arch-note-max-chars").value = this.get("maxChars", 60000);
    this.input("arch-note-max-tokens").value = this.get("maxTokens", 4096);
    this.input("arch-note-delay").value = this.get("delaySeconds", 20);
    this.input("arch-note-style").value = this.get("style", "group_meeting");
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
    this.set("skillFormat", this.input("arch-note-skill-format").value);
    this.set("skillTopK", Number(this.input("arch-note-skill-top-k").value || 4));
    this.set("skillTimeoutSeconds", Number(this.input("arch-note-skill-timeout").value || 300));
    this.set("apiKey", this.input("arch-note-api-key").value.trim());
    this.set("baseUrl", this.input("arch-note-base-url").value.trim() || "https://api.deepseek.com");
    this.set("model", this.input("arch-note-model").value.trim() || "deepseek-v4-flash");
    this.set("maxChars", Number(this.input("arch-note-max-chars").value || 60000));
    this.set("maxTokens", Number(this.input("arch-note-max-tokens").value || 4096));
    this.set("delaySeconds", Number(this.input("arch-note-delay").value || 20));
    this.set("style", this.input("arch-note-style").value);
    this.set("language", this.input("arch-note-language").value);
    window.alert("Arch Note Zotero settings saved.");
  }
};

window.ArchNotePrefs = ArchNotePrefs;
ArchNotePrefs.init();
