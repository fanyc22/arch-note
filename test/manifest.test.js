const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const { test } = require("node:test");

const manifest = JSON.parse(readFileSync(join(__dirname, "../manifest.json"), "utf8"));
const pkg = JSON.parse(readFileSync(join(__dirname, "../package.json"), "utf8"));
const updates = JSON.parse(readFileSync(join(__dirname, "../updates.json"), "utf8"));

test("manifest includes Zotero 9 permanent-install metadata", () => {
  assert.equal(manifest.manifest_version, 2);
  assert.equal(manifest.version, pkg.version);
  assert.equal(manifest.applications.zotero.id, "arch-note-zotero-deepseek@example.com");
  assert.match(manifest.applications.zotero.update_url, /^https:\/\//);
  assert.equal(manifest.applications.zotero.strict_min_version, "8.0.1");
  assert.equal(manifest.applications.zotero.strict_max_version, "10.*");
});

test("updates manifest matches the add-on id and package version", () => {
  const addonID = manifest.applications.zotero.id;
  const update = updates.addons[addonID].updates[0];

  assert.equal(update.version, pkg.version);
  assert.ok(update.update_link.includes(`/v${pkg.version}/`));
  assert.match(update.update_hash, /^sha256:[a-f0-9]{64}$/);
  assert.equal(update.applications.zotero.strict_min_version, manifest.applications.zotero.strict_min_version);
  assert.equal(update.applications.zotero.strict_max_version, manifest.applications.zotero.strict_max_version);
});
