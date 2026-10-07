const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const client = require("../chrome/content/deepseek-client.js");
const markup = readFileSync(join(__dirname, "../preferences.xhtml"), "utf8");
const script = readFileSync(join(__dirname, "../preferences.js"), "utf8");
const prefix = "extensions.arch-note-zotero.";

function preferences(values = {}) {
  const stored = new Map(Object.entries(values).map(([name, value]) => [`${prefix}${name}`, value]));
  const inputs = new Map([...markup.matchAll(/\bid="([^"]+)"/g)].map((match) => [match[1], { value: "", checked: false }]));
  const context = {
    Zotero: { Prefs: { get: (name) => stored.get(name), set: (name, value) => stored.set(name, value) } },
    document: { getElementById: (id) => inputs.get(id) || null },
    window: { alert() {} },
    ArchNoteDeepSeek: client
  };
  vm.runInNewContext(script, context);
  return {
    api: context.window.ArchNotePrefs,
    input: (id) => inputs.get(`arch-note-${id}`),
    get: (name) => stored.get(`${prefix}${name}`)
  };
}

test("existing DeepSeek preferences load with no provider migration", () => {
  const prefs = preferences({ apiKey: "sk-original-test", model: "deepseek-v4-pro", maxTokens: 4096 });
  assert.equal(prefs.input("provider").value, "deepseek");
  assert.equal(prefs.input("api-key").value, "sk-original-test");
  assert.equal(prefs.input("base-url").value, "https://api.deepseek.com");
  assert.equal(prefs.input("model").value, "deepseek-v4-pro");
  assert.equal(prefs.input("max-tokens").value, 4096);
  prefs.api.save();
  assert.equal(prefs.get("apiKey"), "sk-original-test");
  assert.equal(prefs.get("poixeApiKey"), undefined);
});

test("provider switching retains drafts and stores keys, URLs, and models separately", () => {
  const prefs = preferences({ apiKey: "sk-deepseek-test", model: "deepseek-v4-pro" });
  prefs.input("model").value = "edited-deepseek-model";
  prefs.input("provider").value = "poixe";
  prefs.api.changeProvider();
  assert.equal(prefs.input("api-key").value, "");
  assert.equal(prefs.input("base-url").value, "https://api.poixe.com/v1");
  assert.equal(prefs.input("model").value, "gpt-5.2");
  assert.equal(prefs.get("apiProvider"), undefined);

  prefs.input("api-key").value = " sk-poixe-test ";
  prefs.input("base-url").value = "https://api-eu-central-1-dc8.poixe.com/v1";
  prefs.input("model").value = "custom/relay-model";
  prefs.input("provider").value = "deepseek";
  prefs.api.changeProvider();
  assert.equal(prefs.input("api-key").value, "sk-deepseek-test");
  assert.equal(prefs.input("model").value, "edited-deepseek-model");
  prefs.input("provider").value = "poixe";
  prefs.api.changeProvider();
  assert.equal(prefs.input("model").value, "custom/relay-model");
  prefs.api.save();

  assert.equal(prefs.get("apiProvider"), "poixe");
  assert.equal(prefs.get("apiKey"), "sk-deepseek-test");
  assert.equal(prefs.get("model"), "edited-deepseek-model");
  assert.equal(prefs.get("poixeApiKey"), "sk-poixe-test");
  assert.equal(prefs.get("poixeModel"), "custom/relay-model");
  assert.equal(prefs.get("poixeBaseUrl"), "https://api-eu-central-1-dc8.poixe.com/v1");
});

test("saved Poixe profile loads independently of the DeepSeek profile", () => {
  const prefs = preferences({
    apiProvider: "poixe", apiKey: "sk-deepseek-test", poixeApiKey: "sk-poixe-test", poixeModel: "relay-model"
  });
  assert.equal(prefs.input("provider").value, "poixe");
  assert.equal(prefs.input("api-key").value, "sk-poixe-test");
  assert.equal(prefs.input("model").value, "relay-model");
  assert.equal(prefs.input("max-tokens").value, 16384);
  assert.equal(prefs.input("style"), undefined);
  assert.equal(prefs.input("skill-format"), undefined);
  assert.equal(prefs.input("use-skill"), undefined);
  assert.equal(prefs.input("skill-command"), undefined);
});
